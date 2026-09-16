# Análise do Repositório — Smart Campos Core API (Módulo G3)

## 1. Identificação

| Item | Valor |
|---|---|
| Nome do repositório | Smart Campos Core API |
| Linguagem | TypeScript 5 (Node.js 24) |
| Framework web | Express 5 |
| ORM | Prisma 6 (PostgreSQL 16) |
| Validação | Zod 3 |
| Testes | Vitest 3 + Supertest 7 |
| Porta da API | 4100 |
| Banco (Docker) | `smart-campos-postgres` em `localhost:5434` (DB `smartcampos`) |

## 2. Estrutura de pastas

```
src/
├── app.ts                    # Express: health, mount /api/v1, /api/docs, /api/openapi.json
├── main.ts                   # boot (dotenv, porta G3_PORT || 4100)
├── openapi.ts                # spec OpenAPI 3.0.0 (sem security)
└── modules/schedules-assessments/
    ├── domain/evaluation.ts           (+ evaluation.test.ts)  # regras puras, 21 testes
    ├── domain/calculationEngine.ts    (+ calculationEngine.test.ts)  # motor 6 métodos, 54 testes
    ├── application/schedulesAssessmentsService.ts  # casos de uso + $transaction + DomainError
    ├── infrastructure/{prisma,httpError}.ts
    ├── schemas/index.ts               # Zod autoritativos
    ├── http/schedulesAssessmentsRouter.ts
    └── tests/{g3.e2e.test.ts, calculation.e2e.test.ts, error-scenarios.e2e.test.ts, g3.transaction.e2e.test.ts}
packages/
├── shared-types/src/index.ts   # DTOs + constantes + campusModules
├── validation/src/index.ts     # re-exporta schemas do módulo
└── api-client/src/index.ts     # cliente HTTP (fetch Node 24)
prisma/{schema.prisma, migrations/, seed.ts}
docs/                           # artefactos da ficha
```

## 3. Componentes e responsabilidades

| Componente | Ficheiro | Responsabilidade |
|---|---|---|
| Domínio | `domain/evaluation.ts` | funções puras: tipos, peso>0, nota≤max, média ponderada, status, horas |
| Motor de cálculo | `domain/calculationEngine.ts` | 6 métodos, registry de fórmulas registadas (sem `eval`), arredondamento |
| Aplicação | `application/schedulesAssessmentsService.ts` | orquestração, `TYPE_MAP`, `DomainError`, `$transaction`, conflitos, impressão |
| Infraestrutura | `infrastructure/prisma.ts`, `httpError.ts` | singleton Prisma; mapeamento erro→HTTP (P2002→409) |
| HTTP | `http/schedulesAssessmentsRouter.ts` | rotas, Zod, `correlationId`, envelope `{data,meta}/{code,message,details}` |
| Schemas | `schemas/index.ts` | fonte única de verdade para validação (re-exportada por `@smartcampus/validation`) |
| Partilhado | `packages/shared-types` | DTOs, constantes, `campusModules.G3_AVALIACOES_HORARIOS` |

## 4. Rotas expostas (API aberta — nunca 401/403)

- `GET|POST /api/v1/assessments` · `GET|PATCH|DELETE /api/v1/assessments/:id`
- `GET|POST /api/v1/assessments/:assessmentId/grades` · `PATCH .../grades/:gradeId`
- `GET|POST /api/v1/schedules` · `GET|PATCH|DELETE /api/v1/schedules/:id`
- `GET|POST /api/v1/results` · `GET|PATCH|DELETE /api/v1/results/:id`
- `GET /api/v1/results/calculation-methods` · `POST /api/v1/results/calculate`
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
| Unitários | `npm run test:unit` | **75 testes** — regras puras do domínio + motor de cálculo, sem banco |
| E2E | `npm run test:e2e` | **52 testes** — CRUD completo, envelope, Zod, 400/404/409/500, impressão, OpenAPI sem `security`, motor flexível, **rollback ACID** |

Servidor usado nos E2E: app Express ephemeral (porta 0), IDs buscados dinamicamente via Prisma. Total: **142 testes verdes**.

## 8. Banco de dados

- Migrations: `20260827075045_init` + `20260909000000_add_schedules_assessments` + `20260915071657_add_calculation_method`; `migrate status` = up-to-date.
- Modelos G3: `assessments`, `grades`, `schedules`, `results` com enums `EvaluationType`, `EvaluationStatus`, `GradeStatus`, `ScheduleStatus`, `DayOfWeek`, `ResultStatus`, `CalculationMethod`.
- Multi-tenancy presente (`schoolId`) mas sem autenticação no módulo; seed `UJAC` (Moçambique) em `prisma/seed.ts`.

## 9. Conformidade com a ficha

- ✔ TypeScript (.ts em todo o código)
- ✔ Express 5 + Prisma 6 + PostgreSQL + Zod + Vitest + Supertest
- ❌ Sem autenticação, passwords, JWT, RBAC, OpenAPI `security`, 401/403

## 10. Estado actual

- ✅ 142 testes a passar (75 unit + 67 e2e)
- ✅ Servidor arranca e `/health`, `/api/v1/assessments`, `/api/docs` → 200
- ✅ Diagramas, manuais, OpenAPI, relatório, evidências e documento Word (ver `docs/`)