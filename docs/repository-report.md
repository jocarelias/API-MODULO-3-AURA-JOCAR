# REPOSITORY_REPORT — Módulo G3 (Avaliações e Horários)

> Produzido pelo **01. RepositoryAnalysisAgent** antes de qualquer alteração.

## 1. Contexto

- **Projecto:** `g3-avaliacoes-horarios` (Smart Campus — grupo G3).
- **Localização:** `Documents/API HORARIOS/`.
- **Natureza:** API pública (sem autenticação) para avaliações, horários, notas, resultados e impressão de pautas/horários.
- **Stack real verificada:** Node.js 24 (CommonJS), Express 5, Prisma 6 + PostgreSQL 16 (Docker, porta **5434**), Zod 3, Vitest 3, Supertest 7, OpenAPI 3.0.0 (gerado em `src/openapi.js`, servido em `/api/openapi.json` + Swagger UI em `/api/docs`).

## 2. Estrutura real do repositório (antes da reorganização)

```
docs/
├── Documentacao_Tecnica_Swagger_API_G3.docx   # manual antigo (binário, desactualizado)
prisma/
├── schema.prisma      # 15 modelos, 13 enums, índices e FKs
├── seed.ts            # seed UCT-JAC em TypeScript (proibido pela ficha)
└── migrations/
    └── 20260827075045_init/migration.sql   # 1 migration aplicada (622 linhas)
src/
├── main.js            # boot, dotenv, porta 4100 (G3_PORT || 4100)
├── app.js             # Express: /api/v1, /api/docs, /api/openapi.json, 404, erro global
├── openapi.js         # spec OpenAPI 3.0.0 programática (sem security)
└── modules/schedules-assessments/
    ├── domain/evaluation.js          # regras puras (tipos, peso, média, status, tempo)
    ├── domain/evaluation.test.js     # 20 testes unitários
    ├── application/schedulesAssessmentsService.js  # casos de uso + Prisma + DomainError
    └── http/schedulesAssessmentsRouter.js          # router + Zod + correlationId
test/
└── g3.e2e.test.js     # 12 testes de integração (supertest)
```

## 3. Stack auditada

| Camada | Tecnologia | Observação |
|---|---|---|
| Runtime | Node.js 24 + JavaScript puro (CJS) | Sem TypeScript no módulo (existe `seed.ts` — a converter) |
| HTTP | Express 5.2.1 | `express.json()` com limite 1mb |
| ORM | Prisma 6 / `@prisma/client` 6.19 | PostgreSQL |
| Validação | Zod 3.25 | Schemas inline no router |
| Testes | Vitest 3 + Supertest 7 | Unit + e2e |
| API Docs | OpenAPI 3.0.0 + swagger-ui-dist | `/api/docs`, `/api/openapi.json` |

## 4. Banco de dados (estado verificado)

- Datasource: `postgresql://localhost:5434/smartcampos` ↔ Docker `smart-campos-postgres`.
- **1 migration aplicada** (`20260827075045_init`) — `prisma migrate status` = *up to date*.
- Tabelas existentes relevantes ao módulo: `evaluations`, `evaluation_grades`, `schedules`, `results` (nome actual — a ficha exige `Assessment`/`Grade`).
- Contagens reais no PostgreSQL: 31 avaliações, 101 notas, 50 resultados, 15 horários.
- Dados conferem com as constraints planeadas: 0 pesos ≤ 0; notas entre 6 e 20; 0 horários inválidos.

## 5. Roteamento e API existente

Mount actual: `POST/GET` sob `/api/v1/schedules-assessments`:

| Método | Rota actual |
|---|---|
| GET | `/evaluations` (filtros) |
| GET/POST | `/evaluations/:id` |
| PATCH | `/evaluations/:id` |
| GET/POST | `/evaluations/:evaluationId/grades` |
| PATCH | `/evaluations/:evaluationId/grades/:gradeId` |
| GET/POST | `/schedules`, `/schedules/:id (GET/PATCH)` |
| GET | `/results` |
| GET | `/print/class/:classId/schedule`, `/print/class/:classId/pauta` |

A ficha exige: `/api/v1/assessments`, `/api/v1/schedules`, `/api/v1/results` (API aberta, sem `/schedules-assessments`).

## 6. Middleware global, erros e correlationId

- Middleware de `correlationId`: lê `x-request-id` ou gera `randomUUID()`; devolve no header e no `meta`.
- Envelope de sucesso: `{ data, meta: { correlationId, page?, pageSize?, total? } }`.
- Envelope de erro: `{ code, message, details, correlationId }`.
- Error handler global em `app.js` mapeia `error.httpStatus`; router faz o mesmo internamente (duplicação).
- `DomainError`: `NOT_FOUND→404`, `CONFLICT→409`, `VALIDATION_ERROR→400`, `BAD_REQUEST→400`. **Sem 401/403** — API aberta.

## 7. Packages partilhados (estado)

Não existem `packages/` nem monorepo. A ficha exige:

```text
packages/shared-types/src/index.js
packages/validation/src/index.js
packages/api-client/src/index.js
```

Serão criados como pacotes locais do próprio projecto (`npm workspaces`).

## 8. Funcionalidade já implementada

- CRUD de avaliações, notas e horários; listagem de resultados.
- Regras de domínio: tipos `TESTE/EXAME_NORMAL/EXAME_RECURRENCIA`, média ponderada
  `Σ(nota×peso)/Σ(pesos)`, status de resultado (`APPROVED≥10`, `RECOVERY≥8`, `FAILED<P8`).
- Detecção de conflitos de horário (professor/turma/sala) → 409.
- Recálculo automático de resultados após lançamento de nota (com `try/catch` silencioso — falha de consistência ACID a corrigir).
- Impressão de horário e pauta por turma.
- OpenAPI/Swagger funcional, sem security.

## 9. Lacunas identificadas face à ficha

1. Entidade `Assessment` não existe (usa `Evaluation`) — renomear modelo, tabela, rotas, DTOs e testes.
2. Entidade `Grade` não existe (usa `EvaluationGrade`).
3. Apartição do módulo: faltam `infrastructure/`, `schemas/` e `tests/`.
4. Rotas da ficha (`/api/v1/assessments`, `/schedules`, `/results`) não existem.
5. Sem `DELETE` (avaliação/horário) nem regra de delete bloqueada.
6. Sem operação ACID real: `createGrade` + recálculo fora de `$transaction` (recálculo com erro silencioso).
7. Sem `POST /results` / `GET /results/:id` (lançamento de resultado).
8. Sem instâncias `packages/shared-types`, `packages/validation`, `packages/api-client`.
9. Sem `docs/openapi.yaml`, `docs/manual-apis-core.md`, diagramas, `entity-model.md`, reflexão, evidências.
10. `prisma/seed.ts` é TypeScript e usa `argon2`/`ts-node` — converter para JavaScript puro.
11. Regras de peso: `validateWeight` permite peso 0 — a ficha exige peso **> 0**.
12. Error handling duplicado (router vs app) — centralizar.

## 10. Conclusão

O módulo tem uma base sólida, mas precisa de **reorganização para o contrato da ficha**
(Assessment/Schedule/Result, rotas `/api/v1/...`, camadas `infrastructure/`, `schemas/`, `tests/`,
packages partilhados) e de **completar** ACID, DELETE, qualidade de dados, documentação e evidências.