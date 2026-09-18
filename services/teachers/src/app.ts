import { randomUUID } from 'node:crypto';
import express, { Express, Request, Response, NextFunction } from 'express';
import { createTeachersRouter } from './routes/teachers';

interface ServiceRequest extends Request {
  correlationId?: string;
}

function correlationId(req: Request): string {
  return (req.get('x-request-id') as string | undefined) || randomUUID();
}

export function createApp(): Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.use((req: ServiceRequest, res: Response, next: NextFunction) => {
    req.correlationId = correlationId(req);
    res.setHeader('x-request-id', req.correlationId);
    next();
  });

  app.get('/api/v1/health', (req: ServiceRequest, res: Response) => {
    res.status(200).json({ data: { status: 'ok' }, meta: { correlationId: req.correlationId } });
  });

  app.use('/api/v1', createTeachersRouter());

  app.use((req: ServiceRequest, res: Response) => {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Recurso não encontrado', details: [], correlationId: req.correlationId });
  });

  app.use((error: unknown, req: ServiceRequest, res: Response, _next: NextFunction) => {
    const mapped = error as { httpStatus?: number; code?: string; message?: string; details?: unknown[] };
    res.status(mapped?.httpStatus ?? 500).json({
      code: mapped?.code ?? 'INTERNAL_ERROR',
      message: mapped?.message ?? 'Erro interno do servidor',
      details: mapped?.details ?? [],
      correlationId: req.correlationId,
    });
  });

  return app;
}