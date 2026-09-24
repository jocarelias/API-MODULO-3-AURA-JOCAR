import { campusModules } from '@smartcampus/shared-types';
export declare class ApiError extends Error {
    status: number;
    code: string;
    details: unknown[];
    correlationId: string;
    constructor(status: number, code: string, message: string, details: unknown[] | undefined, correlationId: string);
}
export interface QueryParams {
    [key: string]: string | number | boolean | undefined | null;
}
export declare class SmartCampusApiClient {
    private baseUrl;
    private timeoutMs;
    constructor({ baseUrl, timeoutMs }?: {
        baseUrl?: string;
        timeoutMs?: number;
    });
    request<T>(method: string, path: string, body?: unknown, query?: QueryParams): Promise<T>;
    get<T>(path: string, query?: QueryParams): Promise<T>;
    post<T>(path: string, body: unknown): Promise<T>;
    patch<T>(path: string, body?: unknown): Promise<T>;
    delete<T>(path: string): Promise<T>;
    listAssessments<T>(query?: QueryParams): Promise<T>;
    getAssessment<T>(id: string): Promise<T>;
    createAssessment<T>(payload: unknown): Promise<T>;
    updateAssessment<T>(id: string, payload: unknown): Promise<T>;
    deleteAssessment<T>(id: string): Promise<T>;
    listGrades<T>(assessmentId: string): Promise<T>;
    createGrade<T>(assessmentId: string, payload: unknown): Promise<T>;
    updateGrade<T>(assessmentId: string, gradeId: string, payload: unknown): Promise<T>;
    listSchedules<T>(query?: QueryParams): Promise<T>;
    getSchedule<T>(id: string): Promise<T>;
    createSchedule<T>(payload: unknown): Promise<T>;
    updateSchedule<T>(id: string, payload: unknown): Promise<T>;
    deleteSchedule<T>(id: string): Promise<T>;
    listResults<T>(query?: QueryParams): Promise<T>;
    getResult<T>(id: string): Promise<T>;
    createResults<T>(payload: unknown): Promise<T>;
    deleteResult<T>(id: string): Promise<T>;
    patchResult<T>(id: string): Promise<T>;
    updateResult<T>(id: string, payload?: unknown): Promise<T>;
    printClassSchedule<T>(classId: string, { termId }?: {
        termId?: string;
    }): Promise<T>;
    printClassPauta<T>(classId: string, { termId, subjectId }?: {
        termId?: string;
        subjectId?: string;
    }): Promise<T>;
    listCalculationMethods<T>(): Promise<T>;
    calculate<T>(payload: unknown): Promise<T>;
}
export { campusModules };
//# sourceMappingURL=index.d.ts.map