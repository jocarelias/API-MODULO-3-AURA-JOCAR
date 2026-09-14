import path from 'node:path';
import express, { Express, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { createSchedulesAssessmentsRouter } from './modules/schedules-assessments/http/schedulesAssessmentsRouter';
import { toHttpError } from './modules/schedules-assessments/infrastructure/httpError';
import { buildOpenApi } from './openapi';

const SWAGGER_UI_DIR = path.join(__dirname, '../node_modules/swagger-ui-dist');

interface AppRequest extends Request {
  correlationId?: string;
}

export function createApp(): Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.use((req: AppRequest, res: Response, next: NextFunction) => {
    req.correlationId = (req.get('x-request-id') as string) || randomUUID();
    res.setHeader('x-request-id', req.correlationId);
    next();
  });

  app.get('/api/v1/health', (req: AppRequest, res: Response) => {
    res.status(200).json({ data: { status: 'ok' }, meta: { correlationId: req.correlationId } });
  });

  app.use('/api/v1', createSchedulesAssessmentsRouter());

  app.get('/api/docs', (req: Request, res: Response) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html>
  <head>
    <title>G3 - Avaliações e Horários - OpenAPI</title>
    <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
    <script>
      SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#swagger-ui' });
    </script>
  </body>
</html>`);
  });

  app.use('/api/docs/assets', express.static(SWAGGER_UI_DIR));

  app.get('/api/openapi.json', (_req: Request, res: Response) => {
    res.status(200).json(buildOpenApi());
  });

  app.use((req: AppRequest, res: Response) => {
    const mapped = toHttpError({ httpStatus: 404, code: 'NOT_FOUND', message: 'Recurso não encontrado', details: [] }, req.correlationId as string);
    res.status(mapped.status).json(mapped.body);
  });

  app.use((error: unknown, req: AppRequest, res: Response, _next: NextFunction) => {
    const mapped = toHttpError(error, req.correlationId as string);
    res.status(mapped.status).json(mapped.body);
  });

  return app;
}