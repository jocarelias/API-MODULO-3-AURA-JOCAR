"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const node_path_1 = __importDefault(require("node:path"));
const express_1 = __importDefault(require("express"));
const node_crypto_1 = require("node:crypto");
const schedulesAssessmentsRouter_1 = require("./modules/schedules-assessments/http/schedulesAssessmentsRouter");
const httpError_1 = require("./modules/schedules-assessments/infrastructure/httpError");
const openapi_1 = require("./openapi");
const SWAGGER_UI_DIR = node_path_1.default.join(__dirname, '../node_modules/swagger-ui-dist');
function createApp() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json({ limit: '1mb' }));
    app.use((req, res, next) => {
        req.correlationId = req.get('x-request-id') || (0, node_crypto_1.randomUUID)();
        res.setHeader('x-request-id', req.correlationId);
        next();
    });
    app.get('/api/v1/health', (req, res) => {
        res.status(200).json({ data: { status: 'ok' }, meta: { correlationId: req.correlationId } });
    });
    app.use('/api/v1', (0, schedulesAssessmentsRouter_1.createSchedulesAssessmentsRouter)());
    app.get('/api/docs', (req, res) => {
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
    app.use('/api/docs/assets', express_1.default.static(SWAGGER_UI_DIR));
    app.get('/api/openapi.json', (_req, res) => {
        res.status(200).json((0, openapi_1.buildOpenApi)());
    });
    app.use((req, res) => {
        const mapped = (0, httpError_1.toHttpError)({ httpStatus: 404, code: 'NOT_FOUND', message: 'Recurso não encontrado', details: [] }, req.correlationId);
        res.status(mapped.status).json(mapped.body);
    });
    app.use((error, req, res, _next) => {
        const mapped = (0, httpError_1.toHttpError)(error, req.correlationId);
        res.status(mapped.status).json(mapped.body);
    });
    return app;
}
//# sourceMappingURL=app.js.map