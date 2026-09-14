# G3 — Avaliações, Horários e Resultados

API aberta pública para gestão de **avaliações**, **lançamento de notas**, **cálculo de médias**, **horários** e **resultados académicos** — desenvolvida para a **Universidade de Ciências e Tecnologias Joaquim Alberto Chissano (UCT-JAC)**, curso de **Engenharia Informática**.

## Stack

- **Node.js 24** + **TypeScript** + **Express 5** + **Zod 3** (validação de entrada)
- **Prisma 6** + **PostgreSQL 16** (Docker, porta 5434)
- **Vitest 3** + **Supertest 7** (testes)
- **Workspaces npm**: `@smartcampus/shared-types`, `@smartcampus/validation`, `@smartcampus/api-client`
- **Swagger/OpenAPI 3.0** em `/api/docs` (assets locais, sem CDN)

## Estrutura

```
src/
├── main.ts                                              # boot na porta G3_PORT || 4100
├── app.ts                                               # Express app, mount /api/v1
├── openapi.ts                                           # spec OpenAPI 3.0.0 (sem security)
└── modules/schedules-assessments/
    ├── domain/evaluation.ts                             # regras: tipos, media ponderada, status, horas
    ├── domain/evaluation.test.ts                        # 21 testes unitários (Vitest)
    ├── application/schedulesAssessmentsService.ts       # casos de uso, transações ACID, DomainError
    ├── infrastructure/{prisma,httpError}.ts             # singleton Prisma + mapeamento erro→HTTP
    ├── schemas/index.ts                                 # schemas Zod autoritativos (fonte única)
    ├── http/schedulesAssessmentsRouter.ts               # router Express + Zod + correlationId
    └── tests/                                           # e2e (23) + ACID/rollback (2)
packages/
├── shared-types/src/index.ts                            # DTOs, constantes, campusModules
├── validation/src/index.ts                              # re-exporta schemas do módulo
└── api-client/src/index.ts                              # cliente HTTP fetch (Node 24, TypeScript)
prisma/
├── schema.prisma                                        # Assessment, Grade, Schedule, Result
├── migrations/
└── seed.ts                                              # dados de demonstração (UCT-JAC)
docs/                                                    # openapi.yaml, manual, diagramas, evidências
```

## Primeiros passos

```bash
# 1. subir o banco (Docker)
docker compose up -d

# 2. instalar dependências
npm install

# 3. gerar client Prisma
npm run prisma:generate

# 4. migrar + seed (dados UCT-JAC)
npm run db:reset -- --force
```

## Executar

```bash
npm run dev            # http://localhost:4100/api/v1 (tsx com watch)
# ou
npm run build && npm run start   # compilar TS e correr dist/
```

- **API:** `http://localhost:4100/api/v1`
- **Swagger:** `http://localhost:4100/api/docs`
- **Health:** `GET /api/v1/health`

## Endpoints (abertos — sem autenticação)

| Método | Rota | Descrição |
|---|---|---|
| GET/POST | `/api/v1/assessments` | Lista/cria avaliações |
| GET/PATCH/DELETE | `/api/v1/assessments/:id` | Detalhe, atualização, eliminação |
| GET/POST | `/api/v1/assessments/:assessmentId/grades` | Lista notas / lança nota |
| PATCH | `/api/v1/assessments/:assessmentId/grades/:gradeId` | Atualiza nota |
| GET/POST | `/api/v1/schedules` | Lista/cria horários |
| GET/PATCH/DELETE | `/api/v1/schedules/:id` | Detalhe, atualização, eliminação |
| GET/POST | `/api/v1/results` | Lista resultados / recálculo em lote |
| GET/PATCH | `/api/v1/results/:id` | Detalhe / recálculo individual |
| GET | `/api/v1/print/class/:classId/schedule` | Horário da turma (impressão) |
| GET | `/api/v1/print/class/:classId/pauta` | Pauta de notas da turma |

Tipos de avaliação: `TESTE`, `EXAME_NORMAL`, `EXAME_RECURRENCIA` (armazenados como `TEST`/`EXAM`). Peso obrigatório **> 0**; média `Σ(nota×peso)/Σ(pesos)`.

## Contratos

- **Sucesso:** `{ data, meta: { correlationId } }`
- **Listagem:** `{ data, meta: { correlationId, page, pageSize, total } }` — listas aceitam `?page=&pageSize=` (máx. 100)
- **Erro:** `{ code, message, details, correlationId }`
- Status: 400, 404, 409, 500 — nunca 401/403 (`correlationId` ecoa o header `x-request-id`)

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor com watch (tsx) |
| `npm run build` | Compilar TypeScript |
| `npm run start` | Inicia o servidor (dist/) |
| `npm run typecheck` | Verificar tipos (tsc --noEmit) |
| `npm run test` | Todos os testes (unit + e2e) |
| `npm run test:unit` | Testes unitários (domínio) |
| `npm run test:e2e` | Testes de integração + ACID |
| `npm run prisma:generate` | Gera o client Prisma |
| `npm run prisma:studio` | Prisma Studio |
| `npm run db:migrate` | Cria/aplica migrações |
| `npm run db:deploy` | Aplica migrações (produção) |
| `npm run db:reset` | Zera o banco e reexecuta migrations + seed |
| `npm run db:seed` | Executa o seed |

## Variáveis de ambiente (`.env`)

| Variável | Padrão | Descrição |
|---|---|---|
| `DATABASE_URL` | `postgresql://smartcampos:smartcampos@localhost:5434/smartcampos` | Conexão PostgreSQL |
| `G3_PORT` | `4100` | Porta do servidor |
| `ACADEMIC_PASSING_SCORE` / `ACADEMIC_RECOVERY_SCORE` | `10` / `8` | Nota de corte (escala 0–20) |

## Testes

```bash
npm run test          # 21 unit + 25 e2e = 46 testes
npm run test:unit     # domínio: tipos, pesos (> 0), média, status, time range
npm run test:e2e      # integração: contratos, CRUD+DELETE, 409s, recálculo, impressão, rollback ACID
```

Pré-requisito dos testes e2e: banco migrado e com seed (`npm run db:reset -- --force`).

## Documentação

Ver `docs/` — `openapi.yaml`, `entity-model.md`, `manual-apis-core.md`, `reflection-questions.md`, `implementation-evidence.md`, `test-evidence.md`, `diagrams/` e o relatório final `.docx`.
