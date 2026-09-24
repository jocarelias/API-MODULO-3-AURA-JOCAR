import { Prisma } from '@prisma/client';
interface HttpErrorBody {
    code: string;
    message: string;
    details: unknown[];
    correlationId: string;
}
declare function errorBody(code: string, message: string, details: unknown[], correlationId: string): HttpErrorBody;
declare function isPrismaUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError;
export declare function toHttpError(error: unknown, correlationId: string): {
    status: number;
    body: HttpErrorBody;
};
export { errorBody, isPrismaUniqueViolation };
//# sourceMappingURL=httpError.d.ts.map