import {
  academicYearDto,
  classDto,
  subjectDto,
  termDto,
  type AcademicYearDto,
  type ClassDto,
  type SubjectDto,
  type TermDto,
} from '@smartcampus/shared-types';
import { DomainError } from '../../application/schedulesAssessmentsService';
import { prisma } from '../prisma';
import { CircuitBreaker, CircuitOpenError, TtlCache, withRetry } from './resilience';

export type RegistrySource = 'academic-registry' | 'local-mirror';

export interface RegistryResult<T> {
  items: T[];
  source: RegistrySource;
  degraded: boolean;
}

export interface AcademicRegistryConfig {
  baseUrl?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
  failureThreshold?: number;
  resetTimeoutMs?: number;
  fallbackToLocalMirror?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export interface ResolvedAcademicRegistryConfig {
  baseUrl?: string;
  timeoutMs: number;
  cacheTtlMs: number;
  failureThreshold: number;
  resetTimeoutMs: number;
  fallbackToLocalMirror: boolean;
  now: () => number;
  fetchImpl?: typeof fetch;
}

interface RegistryQuery {
  schoolId?: string;
  academicYearId?: string;
  termId?: string;
  classId?: string;
}

const DEFAULT_TIMEOUT_MS = 4000;
const DEFAULT_CACHE_TTL_MS = 60_000;
const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_RESET_TIMEOUT_MS = 30_000;

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function academicRegistryConfig(): ResolvedAcademicRegistryConfig {
  const fallback = (process.env.ACADEMIC_REGISTRY_FALLBACK ?? 'true').toLowerCase() !== 'false';
  return {
    baseUrl: process.env.ACADEMIC_REGISTRY_URL?.replace(/\/$/, ''),
    timeoutMs: readNumber(process.env.ACADEMIC_REGISTRY_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    cacheTtlMs: readNumber(process.env.ACADEMIC_REGISTRY_CACHE_TTL_MS, DEFAULT_CACHE_TTL_MS),
    failureThreshold: readNumber(process.env.ACADEMIC_REGISTRY_FAILURE_THRESHOLD, DEFAULT_FAILURE_THRESHOLD),
    resetTimeoutMs: readNumber(process.env.ACADEMIC_REGISTRY_RESET_TIMEOUT_MS, DEFAULT_RESET_TIMEOUT_MS),
    fallbackToLocalMirror: fallback,
    now: Date.now,
  };
}

export class AcademicRegistryClient {
  private readonly config: ResolvedAcademicRegistryConfig;
  private readonly breaker: CircuitBreaker;
  private readonly doFetch: typeof fetch;
  private readonly caches: {
    subjects: TtlCache<SubjectDto[]>;
    academicYears: TtlCache<AcademicYearDto[]>;
    terms: TtlCache<TermDto[]>;
    classes: TtlCache<ClassDto[]>;
  };

  constructor(config: Partial<AcademicRegistryConfig> = {}) {
    const resolved = { ...academicRegistryConfig(), ...config };
    this.config = resolved;
    this.doFetch = resolved.fetchImpl ?? fetch;
    this.breaker = new CircuitBreaker({
      name: 'academic-registry',
      failureThreshold: resolved.failureThreshold,
      resetTimeoutMs: resolved.resetTimeoutMs,
      now: resolved.now,
    });

    const cacheFor = <T>(load: () => Promise<T[]>, fallback: () => Promise<T[]>) =>
      new TtlCache<T[]>({
        ttlMs: resolved.cacheTtlMs,
        now: resolved.now,
        load,
        onError: (error) => {
          if (!resolved.fallbackToLocalMirror) {
            return undefined;
          }
          if (error instanceof CircuitOpenError) {
            return fallback();
          }
          return undefined;
        },
      });

    this.caches = {
      subjects: cacheFor(() => this.fetchRemote<SubjectDto>('/api/v1/subjects', (row) => subjectDto(row)), () =>
        this.localSubjects(),
      ),
      academicYears: cacheFor(
        () => this.fetchRemote<AcademicYearDto>('/api/v1/academic-years', (row) => academicYearDto(row)),
        () => this.localAcademicYears(),
      ),
      terms: cacheFor(() => this.fetchRemote<TermDto>('/api/v1/terms', (row) => termDto(row)), () => this.localTerms()),
      classes: cacheFor(() => this.fetchRemote<ClassDto>('/api/v1/classes', (row) => classDto(row)), () =>
        this.localClasses(),
      ),
    };
  }

  get enabled(): boolean {
    return Boolean(this.config.baseUrl);
  }

  circuitState(): string {
    return this.breaker.snapshot().state;
  }

  invalidateCaches(): void {
    Object.values(this.caches).forEach((cache) => cache.invalidate());
  }

  private async fetchRemote<T>(path: string, map: (row: Record<string, unknown>) => T): Promise<T[]> {
    if (!this.config.baseUrl) {
      throw new DomainError('UPSTREAM_UNAVAILABLE', 'ACADEMIC_REGISTRY_URL não configurado');
    }
    this.breaker.assertCallable();

    const url = `${this.config.baseUrl}${path}`;
    const attempt = async (): Promise<T[]> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const response = await this.doFetch(url, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        if (!response.ok) {
          throw new DomainError('UPSTREAM_ERROR', `Registo Académico respondeu ${response.status} em ${path}`);
        }
        const payload = (await response.json()) as { data?: unknown };
        const rows = Array.isArray(payload?.data) ? (payload.data as Record<string, unknown>[]) : [];
        return rows.map(map);
      } finally {
        clearTimeout(timer);
      }
    };

    try {
      const items = await withRetry(attempt, {
        attempts: 2,
        baseDelayMs: 100,
        maxDelayMs: 500,
        shouldRetry: (error) => !(error instanceof DomainError) || error.code === 'UPSTREAM_ERROR',
      });
      this.breaker.onSuccess();
      return items;
    } catch (error) {
      this.breaker.onFailure();
      throw error;
    }
  }

  private async localSubjects(): Promise<SubjectDto[]> {
    const rows = await prisma.subject.findMany({ orderBy: { name: 'asc' } });
    return rows.map((row) => subjectDto(row as unknown as Record<string, unknown>));
  }

  private async localAcademicYears(): Promise<AcademicYearDto[]> {
    const rows = await prisma.academicYear.findMany({ orderBy: { name: 'desc' } });
    return rows.map((row) => academicYearDto(row as unknown as Record<string, unknown>));
  }

  private async localTerms(): Promise<TermDto[]> {
    const rows = await prisma.term.findMany({ orderBy: { startDate: 'asc' } });
    return rows.map((row) => termDto(row as unknown as Record<string, unknown>));
  }

  private async localClasses(): Promise<ClassDto[]> {
    const rows = await prisma.class.findMany({ orderBy: { name: 'asc' } });
    return rows.map((row) => classDto(row as unknown as Record<string, unknown>));
  }

  private async resolve<T extends { id: string }>(
    cache: TtlCache<T[]>,
    local: () => Promise<T[]>,
    filters: RegistryQuery,
    predicate: (item: T, query: RegistryQuery) => boolean,
  ): Promise<RegistryResult<T>> {
    const fromRemote = async (): Promise<T[]> => {
      const items = await cache.get();
      return items.filter((item) => predicate(item, filters));
    };

    if (!this.enabled) {
      const items = (await local()).filter((item) => predicate(item, filters));
      return { items, source: 'local-mirror', degraded: true };
    }

    try {
      const items = await fromRemote();
      return { items, source: 'academic-registry', degraded: false };
    } catch (error) {
      if (!this.config.fallbackToLocalMirror) {
        if (error instanceof DomainError) {
          throw error;
        }
        throw new DomainError('UPSTREAM_UNAVAILABLE', 'Registo Académico indisponível', [{ service: 'academic-registry' }]);
      }
      const items = (await local()).filter((item) => predicate(item, filters));
      return { items, source: 'local-mirror', degraded: true };
    }
  }

  async listSubjects(filters: RegistryQuery = {}): Promise<RegistryResult<SubjectDto>> {
    return this.resolve(this.caches.subjects, () => this.localSubjects(), filters, (item, query) =>
      !query.schoolId || item.schoolId === query.schoolId,
    );
  }

  async listAcademicYears(filters: RegistryQuery = {}): Promise<RegistryResult<AcademicYearDto>> {
    return this.resolve(this.caches.academicYears, () => this.localAcademicYears(), filters, (item, query) =>
      !query.schoolId || item.schoolId === query.schoolId,
    );
  }

  async listTerms(filters: RegistryQuery = {}): Promise<RegistryResult<TermDto>> {
    return this.resolve(this.caches.terms, () => this.localTerms(), filters, (item, query) => {
      if (query.schoolId && item.schoolId !== query.schoolId) return false;
      if (query.academicYearId && item.academicYearId !== query.academicYearId) return false;
      return true;
    });
  }

  async listClasses(filters: RegistryQuery = {}): Promise<RegistryResult<ClassDto>> {
    return this.resolve(this.caches.classes, () => this.localClasses(), filters, (item, query) => {
      if (query.schoolId && item.schoolId !== query.schoolId) return false;
      if (query.academicYearId && item.academicYearId !== query.academicYearId) return false;
      return true;
    });
  }

  async assertSubjectExists(subjectId: string): Promise<void> {
    const { items } = await this.listSubjects();
    if (!items.some((item) => item.id === subjectId)) {
      throw new DomainError('NOT_FOUND', 'Disciplina não encontrada no Registo Académico', [{ subjectId }]);
    }
  }
}