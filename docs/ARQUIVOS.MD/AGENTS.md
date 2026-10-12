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
npm run test:unit      # vitest (src/**/*.test.ts)
npm run test:e2e       # vitest (src/modules/schedules-assessments/tests/**/*.e2e.test.ts)
npm run test:services  # vitest (services/*/src/*.e2e.test.ts — serviços Core)
npm run test:coverage  # unit + e2e + services com coverage (thresholds 80%)
npm run docs           # regenera docs/openapi.yaml + docs/ROUTE_ACCESS.md

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
├── openapi.ts                                       # spec OpenAPI 3.0.0 (security global BearerAuth)
└── modules/schedules-assessments/
    ├── domain/
    │   ├── evaluation.ts                             # regras puras: tipos, média ponderada, status, horas
    │   ├── evaluation.test.ts                        # 21 testes unitários
    │   ├── calculationEngine.ts                      # motor de cálculo: 6 métodos, registry, arredondamento
    │   └── calculationEngine.test.ts                 # 54 testes unitários do motor
    ├── application/
    │   └── schedulesAssessmentsService.ts             # casos de uso, transações ACID, DomainError, TYPE_MAP
    ├── infrastructure/
    │   ├── prisma.ts                                 # singleton do PrismaClient
    │   ├── httpError.ts                              # DomainError/Prisma -> HTTP (401/403/404/409/503)
    │   ├── httpError.test.ts                         # 17 testes do mapeamento de erros
    │   ├── auth/
    │   │   ├── routeAccess.ts                        # FONTE ÚNICA da tabela Rota -> Roles + posse
    │   │   ├── routeAccess.test.ts                   # 12 testes da tabela de acessos
    │   │   ├── accessPolicy.ts                       # guards de posse (anti-BOLA) por rota
    │   │   ├── authMiddleware.ts                     # verificação do JWT e carregamento do perfil
    │   │   ├── authMiddleware.test.ts                # 14 testes do middleware de autenticação
    │   │   ├── identityProvider.ts                   # perfis: BD local + Core, cache e timeout
    │   │   └── identityProvider.test.ts              # 27 testes do provedor de identidade
    │   └── contracts/
    │       ├── gateway.ts                            # chamadas HTTP aos serviços Core (students/teachers/enrolments/finance)
    │       ├── academicRegistry.ts                   #CircuitBreaker + cache + fallback p/ espelho local
    │       ├── academicRegistry.test.ts              # 19 testes de resiliência e fallback
    │       └── resilience.ts                         # primitivas de circuit breaker e cache
    ├── http/
    │   └── schedulesAssessmentsRouter.ts             # router Express + Zod + requireRole + anti-BOLA + correlationId
    └── tests/
        ├── g3.e2e.test.ts                            # 29 testes de integração (API autenticada)
        ├── g3.catalog.e2e.test.ts                    # 17 testes de catálogo + nomes legíveis
        ├── calculation.e2e.test.ts                   # 18 testes e2e do motor de cálculo
        ├── error-scenarios.e2e.test.ts               # 3 testes de cenários de erro (400/404/500)
        ├── g3.transaction.e2e.test.ts                # 2 testes ACID (rollback forçado)
        ├── auth.e2e.test.ts                          # 10 testes: autenticação/RBAC/scoping (401/403, login)
        ├── auth.refresh.e2e.test.ts                  # 8 testes de refresh token e revogação
        ├── bola.e2e.test.ts                          # 25 testes anti-BOLA (posse de objectos)
        ├── spec-conformance.e2e.test.ts              # 18 testes: o endpoint escolhido vs openapi.yaml
        ├── specValidator.test.ts                     # 20 testes de validação do spec
        ├── contractTestEnv.ts                        # arranca os serviços Core em memória + envs de teste
        ├── contract-debt.e2e.test.ts                 # contrato de dívida (409/503/mascaração)
        ├── financial-access.e2e.test.ts              # regra financeira: 403/503/404, /me/financial-status
        └── assessment-plan.e2e.test.ts               # plano de avaliações do docente (201/400/403/409)
packages/
├── shared-types/src/index.ts                         # DTOs, constantes, campusModules, códigos financeiros
├── validation/src/index.ts                           # re-exporta schemas do módulo
└── api-client/src/index.ts                           # cliente HTTP fetch (Node 24, TypeScript)
services/
├── students/src/                                    # serviço Core Students (porta 4101)
├── teachers/src/                                    # serviço Core Teachers (porta 4102)
├── enrolments/src/                                  # serviço Core Enrolments (porta 4103)
└── finance/src/                                     # serviço Core Finance (porta 4104)
    ├── routes/financialStatus.ts                    # GET /financial-status/:studentId (service token)
    └── routes/assessmentCharges.ts                   # POST /financial/integration/assessment-charges (idempotente)
prisma/
├── schema.prisma                                     # Assessment, Grade, Schedule, Result (+ core: User/Student/FinancialStatus...)
├── migrations/
└── seed.ts                                           # dados UCT-JAC (Moçambique)
docs/                                                 # artefactos: diagramas, evidências, manuais, relatório final
docker-compose.yml                                    # PostgreSQL 16 na porta 5434
```

## Rotas (contrato da ficha / via `/api/v1`)

- `POST /api/v1/auth/login` — login, devolve accessToken (Bearer, TTL 3600s)
- `POST /api/v1/auth/refresh` — renova o accessToken a partir do refreshToken
- `GET /api/v1/me/financial-status` — estado financeiro do próprio estudante (`ACTIVE`|`BLOCKED`, sem montantes)
- `GET /api/v1/financial/integration/students/:studentUserId/standing` — regularidade (ACTIVE/BLOCKED) no serviço Finance (service token; `User.id` do Core)
- `GET|POST /api/v1/assessments`
- `POST /api/v1/assessments/plan` — plano de avaliações (nomes/tipos/pesos) definido pelo docente
- `GET|PATCH|DELETE /api/v1/assessments/:id`
- `GET|POST /api/v1/assessments/:assessmentId/grades`
- `PATCH /api/v1/assessments/:assessmentId/grades/:gradeId`
- `GET|POST /api/v1/schedules`
- `GET|PATCH|DELETE /api/v1/schedules/:id`
- `GET|POST /api/v1/results`
- `GET|PATCH /api/v1/results/:id`
- `GET /api/v1/results/calculation-methods` — lista métodos de cálculo disponíveis
- `POST /api/v1/results/calculate` — calcula nota com método flexível (6 métodos)
- `GET /api/v1/print/class/:classId/schedule`
- `GET /api/v1/print/class/:classId/pauta`
- `GET /api/v1/schools` — catálogo de escolas
- `GET /api/v1/academic-years` — catálogo de anos letivos
- `GET /api/v1/terms` — catálogo de períodos (`?academicYearId=`)
- `GET /api/v1/classes` — catálogo de turmas (`?termId=` ou `?academicYearId=`)
- `GET /api/v1/subjects` — catálogo de disciplinas
- `GET /api/v1/teachers` — catálogo de professores
- `GET /api/v1/students` — catálogo de alunos (`?classId=` ou `?termId=`)

> **Nomes legíveis:** DTOs de `AssessmentDto`/`GradeDto`/`ScheduleDto`/`ResultDto` incluem `*Name`
> (`className`, `subjectName`, `teacherName`, `studentName`, `termName`); o service usa `include` nas queries.
> Catálogos devolvem `id` + `name` para montar formulários sem decorar UUIDs.
> **Paginação (listas):** `GET /api/v1/assessments|schedules|results` + catálogos aceitam `page` (≥1) e `pageSize` (1–100); meta devolve `page`, `pageSize`, `total`.
> **`@smartcampus/api-client`:** inclui `updateResult(id, payload?)`, `listCalculationMethods()`, `calculate(payload)` e `listSchools()|listAcademicYears()|listTerms()|listClasses()|listSubjects()|listTeachers()|listStudents()`.

## Autorização (RBAC + anti-BOLA)

- **Fonte única:** `infrastructure/auth/routeAccess.ts` declara, para cada rota,
  os roles permitidos e a verificação de posse exigida. `npm run docs:access-table`
  gera `docs/ROUTE_ACCESS.md` a partir dessa tabela — não editar o Markdown à mão.
- **Papéis:** `SCHOOL_ADMIN`, `TEACHER`, `STUDENT`; credencial interna
  `SERVICE_ROLE='__SERVICE__'` (service token) para o Finance.
- **Ter o role certo não basta.** O router aplica também `enforcePossession`, que
  impede um `STUDENT` de ler recursos de outro estudante (BOLA) e limita o
  `TEACHER` às turmas que lecciona.
- **Endpoint escolhido para a Semana 6:** `GET /api/v1/assessments/{assessmentId}/grades`.
  Conformance verificado em `tests/spec-conformance.e2e.test.ts`.
- **Prova mutacional:** remover a verificação de posse faz a suite falhar
  (ver `docs/evidence/semana-05/prova-mutacional-anti-bola.txt`).

## Convenções

- **Sem comentários** no código.
- Imports entre módulos via caminhos relativos; `@smartcampus/*` só para DTOs/constantes partilhadas.
- **Contratos:** sucesso `{data, meta:{correlationId, [page,pageSize,total]}}`; erro `{code, message, details, correlationId}`.
- **Autenticação obrigatória** (Bearer JWT) em toda a API exceto `/api/v1/auth/login` e `/api/v1/health`. Papéis: `SCHOOL_ADMIN`, `TEACHER`, `STUDENT`; credencial interna `SERVICE_ROLE='__SERVICE__'` (service token) para o Finance.
- `correlationId` via headers `x-correlation-id` (precedência) ou `x-request-id`, ou `randomUUID()`; ecoado na resposta; propagado aos serviços de contratos.
- Variáveis de runtime: `SMARTCAMPUS_JWT_SECRET`, `FINANCIAL_SERVICE_TOKEN` (fallback `SMARTCAMPUS_SERVICE_TOKEN`), `STUDENTS/TEACHERS/ENROLMENTS/FINANCE_SERVICE_URL`, `CONTRACT_TIMEOUT_MS`.
- Status de erro: 400 `VALIDATION_ERROR`/`BAD_REQUEST`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`/`FINANCIAL_ACCESS_BLOCKED`, 404 `NOT_FOUND`/`STUDENT_NOT_FOUND`, 409 `CONFLICT`/`GRADES_BLOCKED_DUE_TO_DEBT`, 500 `INTERNAL_ERROR`, 503 `FINANCIAL_VERIFICATION_UNAVAILABLE` (fail-closed).
- `DomainError` com `httpStatus` e `code`; erros Prisma P2002 → 409 (`infrastructure/httpError.ts`).

## Integração com os serviços Core (gateway)

- `contracts/gateway.ts`: `call(url, ctx, service, { method, body, tokenOverride, retry })` com headers `x-correlation-id` + `x-request-id`.
- **Financeiro** usa sempre `tokenOverride` = senha de serviço (`FINANCIAL_SERVICE_TOKEN`) — nunca o JWT do aluno.
- `getFinancialStatus(studentId, ctx)`: GET com 2 tentativas; erros de rede → `FINANCIAL_VERIFICATION_UNAVAILABLE` (503) — **fail-closed**, nunca assume regular.
- `getFinancialStandingCheck(studentUserId, ctx)`: `GET /api/v1/financial/integration/students/:studentUserId/standing` (contrato 03-financeiro). Usa o `User.id` do Core e devolve apenas `ACTIVE`/`BLOCKED` + `checkedAt`, **sem montantes**. Só service token (403 para tokens de utilizador); aluno desconhecido → 404. O G3 usa-a no **caminho de leitura** (notas/resultados/pauta/`/me/financial-status`), pois não expõe valores privados. O **caminho de escrita** (lançar nota, `POST /results`) mantém `getFinancialStatus` para devolver `409 GRADES_BLOCKED_DUE_TO_DEBT` com `outstandingAmount`.
- `chargeAssessment(...)`: POST `/api/v1/financial/integration/assessment-charges` (o serviço é idempotente por `sourceModule:sourceRequestId:studentUserId:feeCode`).

## Regra financeira

- Rotas de consulta de notas para `STUDENT` (`GET /results`, `/results/:id`, `/assessments/:id/grades`, `/print/class/:id/pauta`):
  - sem perfil académico → `404 STUDENT_NOT_FOUND`;
  - com dívida (`hasDebt`) → `403 FINANCIAL_ACCESS_BLOCKED` (mensagem: "Regularize a sua situação financeira");
  - service indisponível → `503 FINANCIAL_VERIFICATION_UNAVAILABLE`.
- `assertStudentCanViewNotes(requestedStudentId, ctx)` — **assinatura com 2 argumentos**; o router passa `query.studentId` quando aplicável. A verificação agora usa a rota de integração `standing` (por `User.id`), com fallback para a rota interna detalhada quando o perfil não tem `userId` ligado.
- Staff (SCHOOL_ADMIN/TEACHER): pauta mascara linhas de endividados (`debtRestricted: true`, `average: null`); lançar nota de endividado → `409 GRADES_BLOCKED_DUE_TO_DEBT` (usa a rota detalhada para devolver `outstandingAmount`).

## Regras de negócio

### Avaliações
- Tipos (API): `TESTE`, `EXAME_NORMAL`, `EXAME_RECURRENCIA`, `TRABALHO`, `PROJETO`, `QUESTIONARIO`, `PRATICA`, `ORAL`, `OUTRO` (Zod) → DB `TEST`/`EXAM`/`ASSIGNMENT`/`PROJECT`/`QUIZ`/`PRACTICAL`/`ORAL`/`OTHER` via `TYPE_MAP`; DTO devolve o tipo de API via reverse map (`apiAssessmentType`).
- **Plano definido pelo docente:** `POST /api/v1/assessments/plan` cria em transação o conjunto de avaliações (nomes, tipos e pesos) — substitui a lista fixa. Nomes repetidos no plano → 400; nome já existente no mesmo `termId+classId+subjectId` → 409; docente de outra docência → 403.
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
- `Result.calculationMethod` (enum `CalculationMethod`) — qual método gerou o resultado.

### Motor de Cálculo de Notas
- `POST /api/v1/results/calculate` — calcula nota sem persistir (pure in-memory).
- `GET /api/v1/results/calculation-methods` — lista os 6 métodos com metadata.
- **Métodos:** `ARITHMETIC_MEAN`, `WEIGHTED_PERCENTAGE` (padrão), `PERCENTAGE_SUM`, `NORMALIZED_WEIGHTED_MEAN`, `COMPONENT_BASED`, `CUSTOM_WEIGHTED`.
- **Fórmulas customizadas:** `SUM`, `MAX`, `MIN`, `WEIGHTED_100`, `NORMALIZED_MEAN`, `MEAN_OF_TOP_K` — registry controlado, sem `eval`.
- **Arredondamento:** `rounding.decimals` 0|1|2 (default 2). Cálculo interno exato, arredondamento só no final.
- **Intervalo de notas:** `minScore`/`maxScore` configurável (default 0/20).
- **Pesos:** 0–100; `WEIGHTED_PERCENTAGE` exige soma = `expectedTotal` (default 100); `COMPONENT_BASED` exige componentes com sub-items e soma dos pesos = 100.
- **Erros:** `EMPTY_ITEMS`, `INVALID_SCORE`, `INVALID_WEIGHT`, `WEIGHT_TOTAL_MISMATCH`, `WEIGHT_SUM_MUST_BE_POSITIVE`, `COMPONENT_WEIGHT_MISMATCH` → 400/409; `FORMULA_NOT_REGISTERED` → 400; assessment inexistente → 404.

## Testes

Contagem verificada com `npm run test:coverage` (496 testes, 29 ficheiros).

- **Unitários** (`src/**/*.test.ts`): regras puras do domínio sem banco, mais os
  testes de infraestrutura (auth, RBAC, contratos, mapeamento de erros).
  evaluation 21 + calculationEngine 54 + routeAccess 12 + authMiddleware 14 +
  identityProvider 27 + academicRegistry 19 + resilience 20 + httpError 17 +
  verifiers 21 + auth/index 8 + openapi 25 + specValidator 20.
- **E2E G3** (`src/modules/schedules-assessments/tests/*.e2e.test.ts`): Supertest
  em app Express ephemeral, IDs via Prisma. Inclui auth (401/403/scoping),
  refresh, anti-BOLA, conformidade com o spec, lançamento bloqueado por dívida
  (409), regra financeira (403/503/404), mascaração da pauta, `/me/financial-status`
  e contratos HTTP com os serviços Core (via `contractTestEnv.ts`, arrancados em
  memória). Total: 167.
- **Services** (`services/*/src/*.e2e.test.ts` via `vitest.services.config.ts`):
  contratos dos serviços Core (students/teachers/enrolments/finance, inclui
  assessment-charges idempotente). Total: 71.
- **Cobertura** (`npm run test:coverage`, `vitest.coverage.config.ts`): thresholds
  de 80% em statements/branches/functions/lines. Estado actual: 89,36% linhas,
  82,24% ramos, 93,03% funções.
- **Env de teste e2e:** `SMARTCAMPUS_JWT_SECRET=g3-e2e-secret`, `FINANCIAL_SERVICE_TOKEN=g3-e2e-service-token` (definidos em `contractTestEnv.ts`).
- **Prisma:** `prisma db seed` cria dados UJAC; `npm run db:reset` para recriar.

## Banco

- Modelos G3: `Assessment` (`@@map("assessments")`), `Grade` (`@@map("grades")`), `Schedule`, `Result`. Renomeados de `Evaluation`/`EvaluationGrade` na migration `20260909000000_add_schedules_assessments` (dados preservados).
- Modelos Core reutilizados: `School`, `User`, `AcademicYear`, `Term`, `Class`, `Subject`, `Teacher`, `Student`, `Enrollment`, `FinancialStatus` (`financial_statuses`).
- Enums DB: `EvaluationType` (`TEST`, `EXAM`, `ASSIGNMENT`, ...), `EvaluationStatus`, `GradeStatus`, `ScheduleStatus`, `DayOfWeek`, `ResultStatus`, `CalculationMethod` (6 valores).
- `schoolId` em todas as entidades (multi-tenancy).
- `prisma migrate` — nunca editar a migration `_init` já aplicada; novas mudanças geram novas migrations com `npm run db:migrate`.
