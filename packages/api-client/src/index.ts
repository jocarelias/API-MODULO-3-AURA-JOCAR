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
  private accessToken: string | null = null;
  private contractBaseUrls: { students: string; teachers: string; enrolments: string; finance: string };

  constructor({
    baseUrl = process.env.G3_API_URL || 'http://localhost:4100',
    timeoutMs = 10000,
    accessToken,
    contractBaseUrls = {},
  }: {
    baseUrl?: string;
    timeoutMs?: number;
    accessToken?: string;
    contractBaseUrls?: { students?: string; teachers?: string; enrolments?: string; finance?: string };
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
    this.accessToken = accessToken ?? null;
    this.contractBaseUrls = {
      students: (contractBaseUrls.students ?? process.env.STUDENTS_SERVICE_URL ?? 'http://localhost:4101').replace(/\/+$/, ''),
      teachers: (contractBaseUrls.teachers ?? process.env.TEACHERS_SERVICE_URL ?? 'http://localhost:4102').replace(/\/+$/, ''),
      enrolments: (contractBaseUrls.enrolments ?? process.env.ENROLMENTS_SERVICE_URL ?? 'http://localhost:4103').replace(/\/+$/, ''),
      finance: (contractBaseUrls.finance ?? process.env.FINANCE_SERVICE_URL ?? 'http://localhost:4104').replace(/\/+$/, ''),
    };
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private resolveUrl(path: string, baseOverride?: string): URL {
    const base = (baseOverride ?? `${this.baseUrl}${G3.basePath}`).replace(/\/+$/, '');
    return new URL(`${base}${path}`);
  }

  async request<T>(method: string, path: string, body?: unknown, query: QueryParams = {}, baseUrlOverride?: string): Promise<T> {
    const url = this.resolveUrl(path, baseUrlOverride);
    const searchParams = Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '');
    for (const [key, value] of searchParams) {
      url.searchParams.set(key, String(value));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const options: { method: string; headers: Record<string, string>; signal: AbortSignal; body?: string } = { method, headers: {}, signal: controller.signal };
    if (this.accessToken) {
      options.headers.authorization = `Bearer ${this.accessToken}`;
    }
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

  get<T>(path: string, query: QueryParams = {}, baseUrlOverride?: string): Promise<T> {
    return this.request<T>('GET', path, undefined, query, baseUrlOverride);
  }

  post<T>(path: string, body: unknown, baseUrlOverride?: string): Promise<T> {
    return this.request<T>('POST', path, body, {}, baseUrlOverride);
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

  listSchools<T>(query: QueryParams = {}): Promise<T> {
    return this.get<T>('/schools', query);
  }

  listAcademicYears<T>(query: QueryParams = {}): Promise<T> {
    return this.get<T>('/academic-years', query);
  }

  listTerms<T>(query: QueryParams = {}): Promise<T> {
    return this.get<T>('/terms', query);
  }

  listClasses<T>(query: QueryParams = {}): Promise<T> {
    return this.get<T>('/classes', query);
  }

  listSubjects<T>(query: QueryParams = {}): Promise<T> {
    return this.get<T>('/subjects', query);
  }

  listTeachers<T>(query: QueryParams = {}): Promise<T> {
    return this.get<T>('/teachers', query);
  }

  listStudents<T>(query: QueryParams = {}): Promise<T> {
    return this.get<T>('/students', query);
  }

  login<T>(email: string, password: string): Promise<T> {
    return this.post<T>(`/auth/login`, { email, password });
  }

  refresh<T>(refreshToken: string): Promise<T> {
    return this.post<T>(`/auth/refresh`, { refreshToken });
  }

  logout<T>(refreshToken: string): Promise<T> {
    return this.post<T>(`/auth/logout`, { refreshToken });
  }

  getStudentProfile<T>(studentId: string): Promise<T> {
    return this.get<T>(`/api/v1/students/${studentId}`, {}, this.contractBaseUrls.students);
  }

  getMyStudentProfile<T>(): Promise<T> {
    return this.get<T>(`/api/v1/students/me`, {}, this.contractBaseUrls.students);
  }

  listStudentsContract<T>(query: QueryParams = {}): Promise<T> {
    return this.get<T>(`/api/v1/students`, query, this.contractBaseUrls.students);
  }

  getTeacherProfile<T>(teacherId: string): Promise<T> {
    return this.get<T>(`/api/v1/teachers/${teacherId}`, {}, this.contractBaseUrls.teachers);
  }

  listTeachersContract<T>(query: QueryParams = {}): Promise<T> {
    return this.get<T>(`/api/v1/teachers`, query, this.contractBaseUrls.teachers);
  }

  listEnrolments<T>(query: QueryParams = {}): Promise<T> {
    return this.get<T>(`/api/v1/enrolments`, query, this.contractBaseUrls.enrolments);
  }

  getFinancialStatus<T>(studentId: string): Promise<T> {
    return this.get<T>(`/api/v1/financial-status/${studentId}`, {}, this.contractBaseUrls.finance);
  }
}

export { campusModules };