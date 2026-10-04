import {
  StudentProfileDto,
  studentProfileDto,
  TeacherProfileDto,
  teacherProfileDto,
  EnrolmentDto,
  enrolmentDto,
  FinancialStatusDto,
  financialStatusDto,
  AssessmentChargeDto,
  AssessmentChargeInputDto,
  CONTRACT_ERROR_CODES,
} from '@smartcampus/shared-types';
import { DomainError } from '../../application/schedulesAssessmentsService';
import { CircuitBreaker, CircuitOpenError, withRetry } from './resilience';

export type ContractService = 'students' | 'teachers' | 'enrolments' | 'finance';

export interface ContractCallContext {
  token: string;
  correlationId: string;
  userId?: string;
  role?: string;
}

export interface ContractApiConfig {
  studentsUrl?: string;
  teachersUrl?: string;
  enrolmentsUrl?: string;
  financeUrl?: string;
  timeoutMs?: number;
  financeServiceToken?: string;
  retryAttempts?: number;
  retryBaseDelayMs?: number;
  circuitFailureThreshold?: number;
  circuitResetTimeoutMs?: number;
  now?: () => number;
}

export interface EnrolmentFilters {
  schoolId?: string;
  studentId?: string;
  subjectId?: string;
  academicYearId?: string;
  classId?: string;
  termId?: string;
  status?: string;
}

const HTTP_TO_ERROR: Record<number, string> = {
  401: CONTRACT_ERROR_CODES.UNAUTHENTICATED,
  403: CONTRACT_ERROR_CODES.FORBIDDEN,
};

function isTransient(error: unknown): boolean {
  if (!(error instanceof DomainError)) {
    return true;
  }
  const status = error.httpStatus ?? 0;
  if (status >= 500 || status === 429) {
    return true;
  }
  return (
    error.code === CONTRACT_ERROR_CODES.UPSTREAM_UNAVAILABLE ||
    error.code === CONTRACT_ERROR_CODES.UPSTREAM_ERROR ||
    error.code === CONTRACT_ERROR_CODES.FINANCIAL_VERIFICATION_UNAVAILABLE
  );
}

export class ContractGateway {
  private studentsUrl?: string;
  private teachersUrl?: string;
  private enrolmentsUrl?: string;
  private financeUrl?: string;
  private timeoutMs: number;
  private financeServiceToken?: string;
  private retryAttempts: number;
  private retryBaseDelayMs: number;
  private breakers: Record<ContractService, CircuitBreaker>;

  constructor(config: ContractApiConfig = {}) {
    this.studentsUrl = config.studentsUrl;
    this.teachersUrl = config.teachersUrl;
    this.enrolmentsUrl = config.enrolmentsUrl;
    this.financeUrl = config.financeUrl;
    this.timeoutMs = (config.timeoutMs ?? Number(process.env.CONTRACT_TIMEOUT_MS ?? 5000)) || 5000;
    this.financeServiceToken = config.financeServiceToken ?? process.env.FINANCIAL_SERVICE_TOKEN ?? process.env.SMARTCAMPUS_SERVICE_TOKEN;
    this.retryAttempts = config.retryAttempts ?? (Number(process.env.CONTRACT_RETRY_ATTEMPTS ?? 2) || 2);
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? (Number(process.env.CONTRACT_RETRY_BASE_DELAY_MS ?? 50) || 50);
    const failureThreshold = config.circuitFailureThreshold ?? (Number(process.env.CONTRACT_CIRCUIT_FAILURE_THRESHOLD ?? 5) || 5);
    const resetTimeoutMs = config.circuitResetTimeoutMs ?? (Number(process.env.CONTRACT_CIRCUIT_RESET_TIMEOUT_MS ?? 30_000) || 30_000);
    const now = config.now ?? Date.now;
    this.breakers = (['students', 'teachers', 'enrolments', 'finance'] as const).reduce(
      (acc, service) => {
        acc[service] = new CircuitBreaker({ name: service, failureThreshold, resetTimeoutMs, now });
        return acc;
      },
      {} as Record<ContractService, CircuitBreaker>,
    );
  }

  circuitStates(): Record<ContractService, { state: string; failures: number }> {
    return (Object.keys(this.breakers) as ContractService[]).reduce(
      (acc, service) => {
        const snapshot = this.breakers[service].snapshot();
        acc[service] = { state: snapshot.state, failures: snapshot.failures };
        return acc;
      },
      {} as Record<ContractService, { state: string; failures: number }>,
    );
  }

  private unavailableError(service: ContractService): DomainError {
    return new DomainError(
      service === 'finance' ? CONTRACT_ERROR_CODES.FINANCIAL_VERIFICATION_UNAVAILABLE : CONTRACT_ERROR_CODES.UPSTREAM_UNAVAILABLE,
      service === 'finance'
        ? 'Serviço financeiro indisponível — operação bloqueada por segurança'
        : `Serviço de ${service} indisponível`,
      [{ service }],
    );
  }

  private studentsBase(): string {
    return (this.studentsUrl ?? process.env.STUDENTS_SERVICE_URL ?? 'http://students:4101').replace(/\/$/, '');
  }

  private teachersBase(): string {
    return (this.teachersUrl ?? process.env.TEACHERS_SERVICE_URL ?? 'http://teachers:4102').replace(/\/$/, '');
  }

  private enrolmentsBase(): string {
    return (this.enrolmentsUrl ?? process.env.ENROLMENTS_SERVICE_URL ?? 'http://enrolments:4103').replace(/\/$/, '');
  }

  private financeBase(): string {
    return (this.financeUrl ?? process.env.FINANCE_SERVICE_URL ?? 'http://finance:4104').replace(/\/$/, '');
  }

  private async call(url: string, ctx: ContractCallContext, service: ContractService, options: { method?: string; body?: unknown; tokenOverride?: string; retry?: boolean } = {}): Promise<unknown> {
    const { method = 'GET', body, tokenOverride, retry = false } = options;
    const token = tokenOverride ?? ctx.token;
    const serverError = (upstreamStatus: number): boolean => upstreamStatus >= 500;

    const attempt = async (): Promise<unknown> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(url, {
          method,
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${token}`,
            'x-correlation-id': ctx.correlationId,
            'x-request-id': ctx.correlationId,
            accept: 'application/json',
            ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        const parsed = (await response.json().catch(() => null)) as { data?: unknown; code?: string; message?: string; correlationId?: string } | null;

        if (!response.ok) {
          const code = parsed?.code ?? HTTP_TO_ERROR[response.status] ?? CONTRACT_ERROR_CODES.UPSTREAM_ERROR;
          const message = parsed?.message ?? `Serviço de ${service} respondeu com estado ${response.status}`;
          const httpStatus = service === 'finance' && (code === CONTRACT_ERROR_CODES.UPSTREAM_UNAVAILABLE || code === CONTRACT_ERROR_CODES.UPSTREAM_ERROR || response.status === 503 || serverError(response.status))
            ? 503
            : response.status === 404
              ? 404
              : serverError(response.status)
                ? 502
                : 400;
          if (httpStatus === 404) {
            const notFoundCode = service === 'students' ? 'STUDENT_NOT_FOUND' : service === 'teachers' ? 'TEACHER_NOT_FOUND' : CONTRACT_ERROR_CODES.UPSTREAM_ERROR;
            const notFoundMessage = service === 'students' ? 'Aluno não encontrado no catálogo' : service === 'teachers' ? 'Professor não encontrado no catálogo' : message;
            throw new DomainError(code ?? notFoundCode, notFoundMessage);
          }
          const error = new DomainError(code, message, [{ service, upstreamStatus: response.status }]);
          error.httpStatus = httpStatus;
          throw error;
        }
        return parsed?.data;
      } catch (error) {
        if (error instanceof DomainError) {
          throw error;
        }
        throw new DomainError(
          service === 'finance' ? CONTRACT_ERROR_CODES.FINANCIAL_VERIFICATION_UNAVAILABLE : CONTRACT_ERROR_CODES.UPSTREAM_UNAVAILABLE,
          service === 'finance' ? 'Serviço financeiro indisponível — operação bloqueada por segurança' : `Serviço de ${service} indisponível`,
          [{ service }],
        );
      } finally {
        clearTimeout(timer);
      }
    };

    const breaker = this.breakers[service];
    try {
      breaker.assertCallable();
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        throw this.unavailableError(service);
      }
      throw error;
    }

    try {
      const data = await withRetry(attempt, {
        attempts: retry ? this.retryAttempts : 1,
        baseDelayMs: this.retryBaseDelayMs,
        maxDelayMs: this.retryBaseDelayMs * 8,
        shouldRetry: (error) => isTransient(error),
      });
      breaker.onSuccess();
      return data;
    } catch (error) {
      if (isTransient(error)) {
        breaker.onFailure();
      }
      throw error instanceof DomainError ? error : this.unavailableError(service);
    }
  }

  async getStudent(studentId: string, ctx: ContractCallContext): Promise<StudentProfileDto> {
    const data = await this.call(`${this.studentsBase()}/api/v1/students/${encodeURIComponent(studentId)}`, ctx, 'students');
    return studentProfileDto(data as Record<string, unknown>);
  }

  async getMyStudent(ctx: ContractCallContext): Promise<StudentProfileDto | null> {
    try {
      const data = await this.call(`${this.studentsBase()}/api/v1/students/me`, ctx, 'students');
      return studentProfileDto(data as Record<string, unknown>);
    } catch (error) {
      if (error instanceof DomainError && error.code === 'STUDENT_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async getTeacher(teacherId: string, ctx: ContractCallContext): Promise<TeacherProfileDto> {
    const data = await this.call(`${this.teachersBase()}/api/v1/teachers/${encodeURIComponent(teacherId)}`, ctx, 'teachers');
    return teacherProfileDto(data as Record<string, unknown>);
  }

  async getEnrolments(filters: EnrolmentFilters, ctx: ContractCallContext): Promise<EnrolmentDto[]> {
    const query = new URLSearchParams();
    if (filters.schoolId) query.set('schoolId', filters.schoolId);
    if (filters.studentId) query.set('studentId', filters.studentId);
    if (filters.subjectId) query.set('subjectId', filters.subjectId);
    if (filters.academicYearId) query.set('academicYearId', filters.academicYearId);
    if (filters.classId) query.set('classId', filters.classId);
    if (filters.termId) query.set('termId', filters.termId);
    if (filters.status) query.set('status', filters.status);
    query.set('pageSize', '1000');
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const data = await this.call(`${this.enrolmentsBase()}/api/v1/enrolments${suffix}`, ctx, 'enrolments');
    const rows = Array.isArray(data) ? data : [];
    return rows.map((row) => enrolmentDto(row as Record<string, unknown>));
  }

  async getFinancialStatus(studentId: string, ctx: ContractCallContext): Promise<FinancialStatusDto> {
    const data = await this.call(
      `${this.financeBase()}/api/v1/financial-status/${encodeURIComponent(studentId)}`,
      ctx,
      'finance',
      { tokenOverride: this.financeServiceToken, retry: true },
    );
    return financialStatusDto(data as Record<string, unknown>);
  }

  async chargeAssessment(input: AssessmentChargeInputDto, ctx: ContractCallContext): Promise<AssessmentChargeDto> {
    const data = await this.call(
      `${this.financeBase()}/api/v1/financial/integration/assessment-charges`,
      ctx,
      'finance',
      { method: 'POST', body: input, tokenOverride: this.financeServiceToken },
    );
    return data as AssessmentChargeDto;
  }
}