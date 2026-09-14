# AGENTS.md — G3 Avaliações e Horários

Guia para agentes de IA. Leia antes de editar.

## Stack

- **Node.js 24** + **TypeScript** + **Express 5** + **Zod 3** (validação de entrada)
- **Prisma 6** + **PostgreSQL 16** (Docker na porta **5434**)
- **Vitest 3** + **Supertest 7** (testes unitários e e2e)
- **Workspaces npm**: `packages/shared-types`, `packages/validation`, `packages/api-client` (`@smartcampus/*`)
- **Swagger/OpenAPI 3.0** via `/api/docs` (assets locais do `swagger-ui-dist`)
- **TypeScript** (.ts em todo o código) — `.tsx` para frontend se necessário

```bash
# Verificação antes de concluir tarefa:
npm run test:unit     # vitest (src/**/*.test.ts)
npm run test:e2e      # vitest (src/modules/schedules-assessments/tests/**/*.e2e.test.ts)

# Banco
npm run db:migrate -- --name <nome>
npm run db:seed        # tsx prisma/seed.ts
npm run prisma:generate

# Servidor
npx tsx src/main.ts    # porta 4100 (G3_PORT || 4100)
npm run build          # tsc → dist/
npm run typecheck      # tsc --noEmit
```

## Estrutura

```
src/
├── main.ts                                          # boot, dotenv, porta 4100
├── app.ts                                           # Express, health, mount /api/v1, /api/docs, /api/openapi.json
├── openapi.ts                                       # spec OpenAPI 3.0.0 (sem security)
└── modules/schedules-assessments/
    ├── domain/
    │   ├── evaluation.ts                             # regras puras: tipos, média ponderada, status, horas
    │   └── evaluation.test.ts                        # 21 testes unitários
    ├── application/
    │   └── schedulesAssessmentsService.ts             # casos de uso, transações ACID, DomainError, TYPE_MAP
    ├── infrastructure/
    │   ├── prisma.ts                                 # singleton do PrismaClient
    │   └── httpError.ts                              # mapeamento erro → HTTP (500/400/404/409)
    ├── schemas/
    │   └── index.ts                                  # schemas Zod autoritativos do módulo
    ├── http/
    │   └── schedulesAssessmentsRouter.ts              # router Express + Zod + correlationId
    └── tests/
        ├── g3.e2e.test.ts                            # 23 testes de integração (API aberta)
        └── g3.transaction.e2e.test.ts                # 2 testes ACID (rollback forçado)
packages/
├── shared-types/src/index.ts                         # DTOs, constantes, campusModules
├── validation/src/index.ts                           # re-exporta schemas do módulo
└── api-client/src/index.ts                           # cliente HTTP fetch (Node 24, TypeScript)
prisma/
├── schema.prisma                                     # Assessment, Grade, Schedule, Result (+ modelos reutilizados)
├── migrations/
└── seed.ts                                           # dados UCT-JAC (Moçambique)
docs/                                                 # artefactos: openapi.yaml, manuals, evidências, relatório final
```

## Rotas (contrato da ficha / via `/api/v1`)

- `GET|POST /api/v1/assessments`
- `GET|PATCH|DELETE /api/v1/assessments/:id`
- `GET|POST /api/v1/assessments/:assessmentId/grades`
- `PATCH /api/v1/assessments/:assessmentId/grades/:gradeId`
- `GET|POST /api/v1/schedules`
- `GET|PATCH|DELETE /api/v1/schedules/:id`
- `GET|POST /api/v1/results`
- `GET|PATCH /api/v1/results/:id`
- `GET /api/v1/print/class/:classId/schedule`
- `GET /api/v1/print/class/:classId/pauta`

> **Paginação (listas):** `GET /api/v1/assessments|schedules|results` aceitam `page` (≥1) e `pageSize` (1–100); meta devolve `page`, `pageSize`, `total`.
> **`@smartcampus/api-client`:** inclui `updateResult(id, payload?)` (alias de `PATCH /api/v1/results/:id`).

## Convenções

- **Sem comentários** no código.
- Imports entre módulos via caminhos relativos; `@smartcampus/*` só para DTOs/constantes partilhadas.
- **Contratos:** sucesso `{data, meta:{correlationId, [page,pageSize,total]}}`; erro `{code, message, details, correlationId}`.
- **Nunca 401/403** — API aberta sem autenticação.
- `correlationId` via header `x-request-id` ou `randomUUID()`; ecoado na resposta.
- Status de erro: 400 `VALIDATION_ERROR`/`BAD_REQUEST`, 404 `NOT_FOUND`, 409 `CONFLICT`, 500 `INTERNAL_ERROR`.
- `DomainError` com `httpStatus` e `code`; erros Prisma P2002 → 409 (`infrastructure/httpError.ts`).

## Regras de negócio

### Avaliações
- Tipos (API): `TESTE`, `EXAME_NORMAL`, `EXAME_RECURRENCIA` (Zod) → DB `TEST`/`EXAM` via `TYPE_MAP`; DTO devolve `TESTE`/`EXAME_NORMAL` (reverse map).
- **Peso > 0** obrigatório (nível domínio + Zod + CHECK no DB).
- Média: `Σ(nota×peso)/Σ(pesos)` com `round2`; fallback aritmético se Σ(pesos)=0.
- Status: `APPROVED` (≥10), `RECOVERY` (≥8), `FAILED`, `IN_PROGRESS`, `PENDING`.
- Não duplicar avaliação (mesmo `termId+classId+subjectId+name`) → 409.
- Peso/`maxScore` **imutáveis após existirem notas** (409).
- DELETE de avaliação **bloqueado se houver notas** (409).

### Notas
- 1 nota por aluno/avaliação (`@@unique([assessmentId, studentId])`) — duplicada → 409.
- Nota só em avaliação `OPEN` (409); aluno tem de estar matriculado na turma+disciplina do período.
- Nota `[0, maxScore]` (400).
- **Recálculo de resultados é atómico**: create/update de nota dentro do `prisma.$transaction` + recálculo.

### Horários
- Dias `MONDAY`..`SATURDAY`; `HH:mm`; `start < end`.
- Conflito de professor, turma ou sala no mesmo dia/período → 409 com `details`.
- DELETE de horário permitido.

### Resultados
- `POST /api/v1/results` recalcula em lote (turma/disciplina/período); `PATCH /api/v1/results/:id` recalcula um.
- Upsert por `studentId_classId_subjectId_termId`; derivado das notas (nunca editado manualmente).

## Testes

- **Unitários** (`src/**/*.test.ts`): regras puras do domínio — sem banco.
- **E2E** (`src/modules/schedules-assessments/tests/*.e2e.test.ts`): Supertest em app Express ephemeral (porta 0). IDs buscados dinamicamente via Prisma. Sem auth. Verifica contratos, correlationId, Zod, CRUD+DELETE, 409s, impressão, OpenAPI sem security, rollback ACID.
- **Prisma:** `prisma db seed` cria dados UCT-JAC; `npm run db:reset` para recriar.

## Banco

- Modelos G3: `Assessment` (`@@map("assessments")`), `Grade` (`@@map("grades")`), `Schedule`, `Result`. Renomeados de `Evaluation`/`EvaluationGrade` na migration `20260909000000_add_schedules_assessments` (dados preservados).
- Enums DB: `EvaluationType` (`TEST`, `EXAM`, `ASSIGNMENT`, ...), `EvaluationStatus`, `GradeStatus`, `ScheduleStatus`, `DayOfWeek`, `ResultStatus`.
- `schoolId` em todas as entidades (multi-tenancy, mas sem auth neste módulo).
- `prisma migrate` — nunca editar a migration `_init` já aplicada; novas mudanças geram novas migrations com `npm run db:migrate`.
