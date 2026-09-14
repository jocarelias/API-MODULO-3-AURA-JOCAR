# Análise do Repositório — Smart Campos Core API (Módulo G3)

## 1. Identificação

| Item | Valor |
|---|---|
| Nome do repositório | Smart Campos Core API |
| Linguagem | JavaScript puro (Node.js 24) — **proibido TypeScript** |
| Framework web | Express 5 |
| ORM | Prisma 6 (PostgreSQL 16) |
| Validação | Zod 3 |
| Testes | Vitest 3 + Supertest 7 |
| Porta da API | 4100 |
| Banco (Docker) | `smart-campos-postgres` em `localhost:5434` (DB `smartcampos`) |

## 2. Estrutura de pastas (relevante para o módulo G3)

```
src/
├── app.js                    # Express: health, mount /api/v1, /api/docs, /api/openapi.json
├── main.js                   # boot (dotenv, porta G3_PORT || 4100)
├── openapi.js                # spec OpenAPI 3.0.0 (sem security)
└── modules/schedules-assessments/
    ├── domain/evaluation.js  (+ evaluation.test.js)     # regras puras, 21 testes
    ├── application/schedulesAssessmentsService.js        # casos de uso + $transaction + DomainError
    ├── infrastructure/{prisma,httpError}.js
    ├── schemas/index.js                                  # Zod autoritativos
    ├── http/schedulesAssessmentsRouter.js
    └── tests/{g3.e2e.test.js, g3.transaction.e2e.test.js}
packages/
├── shared-types/src/index.js   # DTOs + constantes + campusModules
├── validation/src/index.js     # re-exporta schemas do módulo
└── api-client/src/index.js     # cliente HTTP (fetch Node 24)
prisma/{schema.prisma, migrations/, seed.js}
docs/                            # artefactos da ficha
```

## 3. Componentes e responsabilidades

| Componente | Ficheiro | Responsabilidade |
|---|---|---|
| Domínio | `domain/evaluation.js` | funções puras: tipos, peso>0, nota≤max, média ponderada, status, horas |
| Aplicação | `application/schedulesAssessmentsService.js` | orquestração, `TYPE_MAP`, `DomainError`, `$transaction`, conflitos, impressão |
| Infraestrutura | `infrastructure/prisma.js`, `httpError.js` | singleton Prisma; mapeamento erro→HTTP (P2002→409) |
| HTTP | `http/schedulesAssessmentsRouter.js` | rotas, Zod, `correlationId`, envelope `{data,meta}/{code,message,details}` |
| Schemas | `schemas/index.js` | fonte única de verdade para validação (re-exportada por `@smartcampus/validation`) |
| Partilhado | `packages/shared-types` | DTOs, constantes, `campusModules.G3_AVALIACOES_HORARIOS` |

## 4. Rotas expostas (API aberta — nunca 401/403)

- `GET|POST /api/v1/assessments` · `GET|PATCH|DELETE /api/v1/assessments/:id`
- `GET|POST /api/v1/assessments/:assessmentId/grades` · `PATCH .../grades/:gradeId`
- `GET|POST /api/v1/schedules` · `GET|PATCH|DELETE /api/v1/schedules/:id`
- `GET|POST /api/v1/results` · `GET|PATCH /api/v1/results/:id`
- `GET /api/v1/print/class/:classId/schedule` · `GET /api/v1/print/class/:classId/pauta`
- Swagger: `GET /api/docs` · spec: `GET /api/openapi.json`

## 5. Formato de resposta

| Tipo | Formato |
|---|---|
| Sucesso | `{ data, meta: { correlationId, [pagination] } }` |
| Erro | `{ code, message, details, correlationId }` (400/404/409/500) |

`correlationId` vem do header `x-request-id` ou `randomUUID()`; ecoado na resposta.

## 6. Regras de negócio implementadas

1. **Média ponderada** = `Σ(nota×peso)/Σ(pesos)`, `round2`; fallback aritmético se Σ pesos = 0.
2. **Status**: `APPROVED`(≥10) · `RECOVERY`(≥8) · `FAILED`(<8) · `IN_PROGRESS`(faltam notas) · `PENDING`(sem avaliações).
3. **1 nota/aluno/avaliação** (unique duplicado → 409).
4. Nota só em avaliação `OPEN`; aluno deve estar matriculado na turma/disciplina/período.
5. Peso/`maxScore` imutáveis após existirem notas (409); DELETE de avaliação bloqueado se houver notas (409).
6. Sem duplicar avaliação com o mesmo `termId+classId+subjectId+name` (409).
7. Conflito de horário de professor/turma/sala → 409.
8. **Atomicidade**: lançar/atualizar nota recalcula `results` dentro do mesmo `prisma.$transaction`.
9. `results` são derivados das notas (upsert por `studentId_classId_subjectId_termId`).

## 7. Estratégia de testes

| Suíte | Comando | Cobertura |
|---|---|---|
| Unitários | `npm run test:unit` | 21 testes — regras puras do domínio, sem banco |
| E2E | `npm run test:e2e` | 25 testes — CRUD completo, envelope, Zod, 400/404/409, impressão, OpenAPI sem `security`, **rollback ACID** (2 testes) |

Servidor usado nos E2E: app Express ephemeral (porta 0), IDs buscados dinamicamente via Prisma. Total: **46 testes verdes**.

## 8. Banco de dados

- Migrations: `20260827075045_init` + `20260909000000_add_schedules_assessments`; `migrate status` = up-to-date.
- Modelos G3: `assessments`, `grades`, `schedules`, `results` com enums `EvaluationType`, `EvaluationStatus`, `GradeStatus`, `ScheduleStatus`, `DayOfWeek`, `ResultStatus`.
- Multi-tenancy presente (`schoolId`) mas sem autenticação no módulo; seed `UCT-JAC` (Moçambique) em `prisma/seed.js`.

## 9. Tecnologias evitadas (conformidade com a ficha)

- ❌ TypeScript / `.ts`
- ❌ NestJS, Mongoose/MongoDB
- ❌ Autenticação, passwords, JWT, RBAC, OpenAPI `security`, 401/403

## 10. Estado atual

- ✅ 46 testes a passar
- ✅ Servidor arranca e `/health`, `/api/v1/assessments`, `/api/docs` → 200
- ✅ Diagramas, manuais, OpenAPI, relatório, evidências e documento Word (ver `docs/`)