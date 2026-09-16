import { campusModules } from '@smartcampus/shared-types';

const G3 = campusModules.G3_AVALIACOES_HORARIOS;

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown[];
  correlationId: string;

  constructor(status: number, code: string, message: string, details: unknown[] = [], correlationId: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.correlationId = correlationId;
  }
}

export interface QueryParams {
  [key: string]: string | number | boolean | undefined | null;
}

export class SmartCampusApiClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor({ baseUrl = process.env.G3_API_URL || 'http://localhost:4100', timeoutMs = 10000 }: { baseUrl?: string; timeoutMs?: number } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
  }

  async request<T>(method: string, path: string, body?: unknown, query: QueryParams = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${G3.basePath}${path}`);
    const searchParams = Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '');
    for (const [key, value] of searchParams) {
      url.searchParams.set(key, String(value));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const options: { method: string; headers: Record<string, string>; signal: AbortSignal; body?: string } = { method, headers: {}, signal: controller.signal };
    if (body !== undefined) {
      options.headers['content-type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, options);
    } finally {
      clearTimeout(timer);
    }

    const payload: Record<string, unknown> = (await response.json().catch(() => null)) as Record<string, unknown>;
    if (!payload) {
      throw new ApiError(response.status, 'INVALID_RESPONSE', 'Resposta sem corpo JSON', [], '');
    }
    if (!response.ok) {
      throw new ApiError(
        response.status,
        (payload.code as string) || 'UNKNOWN_ERROR',
        (payload.message as string) || 'Erro na chamada à API',
        (payload.details as unknown[]) || [],
        (payload.correlationId as string) || '',
      );
    }
    return payload.data as T;
  }

  get<T>(path: string, query: QueryParams = {}): Promise<T> {
    return this.request<T>('GET', path, undefined, query);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  patch<T>(path: string, body: unknown = {}): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  listAssessments<T>(query: QueryParams = {}): Promise<T> {
    return this.get<T>('/assessments', query);
  }

  getAssessment<T>(id: string): Promise<T> {
    return this.get<T>(`/assessments/${id}`);
  }

  createAssessment<T>(payload: unknown): Promise<T> {
    return this.post<T>('/assessments', payload);
  }

  updateAssessment<T>(id: string, payload: unknown): Promise<T> {
    return this.patch<T>(`/assessments/${id}`, payload);
  }

  deleteAssessment<T>(id: string): Promise<T> {
    return this.delete<T>(`/assessments/${id}`);
  }

  listGrades<T>(assessmentId: string): Promise<T> {
    return this.get<T>(`/assessments/${assessmentId}/grades`);
  }

  createGrade<T>(assessmentId: string, payload: unknown): Promise<T> {
    return this.post<T>(`/assessments/${assessmentId}/grades`, payload);
  }

  updateGrade<T>(assessmentId: string, gradeId: string, payload: unknown): Promise<T> {
    return this.patch<T>(`/assessments/${assessmentId}/grades/${gradeId}`, payload);
  }

  listSchedules<T>(query: QueryParams = {}): Promise<T> {
    return this.get<T>('/schedules', query);
  }

  getSchedule<T>(id: string): Promise<T> {
    return this.get<T>(`/schedules/${id}`);
  }

  createSchedule<T>(payload: unknown): Promise<T> {
    return this.post<T>('/schedules', payload);
  }

  updateSchedule<T>(id: string, payload: unknown): Promise<T> {
    return this.patch<T>(`/schedules/${id}`, payload);
  }

  deleteSchedule<T>(id: string): Promise<T> {
    return this.delete<T>(`/schedules/${id}`);
  }

  listResults<T>(query: QueryParams = {}): Promise<T> {
    return this.get<T>('/results', query);
  }

  getResult<T>(id: string): Promise<T> {
    return this.get<T>(`/results/${id}`);
  }

  createResults<T>(payload: unknown): Promise<T> {
    return this.post<T>('/results', payload);
  }

  deleteResult<T>(id: string): Promise<T> {
    return this.delete<T>(`/results/${id}`);
  }

  patchResult<T>(id: string): Promise<T> {
    return this.patch<T>(`/results/${id}`);
  }

  updateResult<T>(id: string, payload: unknown = {}): Promise<T> {
    return this.patch<T>(`/results/${id}`, payload);
  }

  printClassSchedule<T>(classId: string, { termId }: { termId?: string } = {}): Promise<T> {
    return this.get<T>(`/print/class/${classId}/schedule`, { termId });
  }

  printClassPauta<T>(classId: string, { termId, subjectId }: { termId?: string; subjectId?: string } = {}): Promise<T> {
    return this.get<T>(`/print/class/${classId}/pauta`, { termId, subjectId });
  }

  listCalculationMethods<T>(): Promise<T> {
    return this.get<T>('/results/calculation-methods');
  }

  calculate<T>(payload: unknown): Promise<T> {
    return this.post<T>('/results/calculate', payload);
  }
}

export { campusModules };