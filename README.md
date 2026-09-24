# G3 — Avaliações, Horários e Resultados

API autenticada (Bearer JWT + RBAC) para gestão de **avaliações**, **lançamento de notas**, **cálculo de médias**, **horários** e **resultados académicos** — desenvolvida para a **UJAC**, curso de **Engenharia Informática**. Integra-se por contrato HTTP com os módulos Core (students/teachers/enrolments/finance) e aplica a regra financeira de bloqueio de consulta de notas para estudantes com dívida.

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
├── openapi.ts                                           # spec OpenAPI 3.0.0 (security: BearerAuth)
└── modules/schedules-assessments/
    ├── domain/evaluation.ts                             # regras: tipos, media ponderada, status, horas
    ├── domain/evaluation.test.ts                        # 21 testes unitários (Vitest)
    ├── application/schedulesAssessmentsService.ts       # casos de uso, transações ACID, DomainError
    ├── infrastructure/{prisma,httpError}.ts             # singleton Prisma + mapeamento erro→HTTP
    ├── schemas/index.ts                                 # schemas Zod autoritativos (fonte única)
    ├── http/schedulesAssessmentsRouter.ts               # router Express + Zod + correlationId
    └── tests/                                           # e2e: 29 g3 + 18 calculation + 3 error + 2 ACID + 15 catálogo
packages/
├── shared-types/src/index.ts                            # DTOs, constantes, campusModules
├── validation/src/index.ts                              # re-exporta schemas do módulo
└── api-client/src/index.ts                              # cliente HTTP fetch (Node 24, TypeScript)
prisma/
├── schema.prisma                                        # Assessment, Grade, Schedule, Result
├── migrations/
└── seed.ts                                              # dados de demonstração (UJAC)
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

# 4. migrar + seed (dados UJAC)
npm run db:reset -- --force
```

## Configuração (.env)

Copie `.env.example` para `.env` e defina:
`SMARTCAMPUS_JWT_SECRET` (JWT), `FINANCIAL_SERVICE_TOKEN`/`SMARTCAMPUS_SERVICE_TOKEN` (credencial de serviço para o Finance) e as URLs dos serviços Core (`STUDENTS_SERVICE_URL`, `TEACHERS_SERVICE_URL`, `ENROLMENTS_SERVICE_URL`, `FINANCE_SERVICE_URL`) — ver `docs/G3-ARQUITETURA-INTEGRACAO.md`. O G3 comunica com o Finance com a credencial de serviço (nunca com o token do aluno).

## Executar

```bash
npm run dev            # http://localhost:4100/api/v1 (tsx com watch)
# ou
npm run build && npm run start   # compilar TS e correr dist/
```

- **API:** `http://localhost:4100/api/v1`
- **Swagger:** `http://localhost:4100/api/docs`
- **Health:** `GET /api/v1/health`

## Endpoints (autenticados — `Authorization: Bearer <JWT>`)

Obtenha o token em `POST /api/v1/auth/login` (`{ email, password }`). Exceções públicas: `/api/v1/auth/login` e `/api/v1/health`.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/v1/auth/login` | Login — devolve accessToken (TTL 3600s) |
| GET/POST | `/api/v1/assessments` | Lista/cria avaliações |
| GET/PATCH/DELETE | `/api/v1/assessments/:id` | Detalhe, atualização, eliminação |
| GET/POST | `/api/v1/assessments/:assessmentId/grades` | Lista notas / lança nota |
| PATCH | `/api/v1/assessments/:assessmentId/grades/:gradeId` | Atualiza nota |
| GET/POST | `/api/v1/schedules` | Lista/cria horários |
| GET/PATCH/DELETE | `/api/v1/schedules/:id` | Detalhe, atualização, eliminação |
| GET/POST | `/api/v1/results` | Lista resultados / recálculo em lote |
| GET/PATCH | `/api/v1/results/:id` | Detalhe / recálculo individual |
| GET | `/api/v1/me/financial-status` | Estado financeiro do próprio estudante (`ACTIVE`/`BLOCKED`, sem montantes) |
| GET | `/api/v1/results/calculation-methods` | Métodos de cálculo disponíveis |
| POST | `/api/v1/results/calculate` | Calcula nota com método flexível |
| GET | `/api/v1/print/class/:classId/schedule` | Horário da turma (impressão) |
| GET | `/api/v1/print/class/:classId/pauta` | Pauta de notas da turma |
| GET | `/api/v1/schools` | Catálogo: escolas (id + nome) |
| GET | `/api/v1/academic-years` | Catálogo: anos letivos |
| GET | `/api/v1/terms` | Catálogo: períodos/tipos letivos (`?academicYearId=`) |
| GET | `/api/v1/classes` | Catálogo: turmas (`?termId=` ou `?academicYearId=`) |
| GET | `/api/v1/subjects` | Catálogo: disciplinas |
| GET | `/api/v1/teachers` | Catálogo: professores |
| GET | `/api/v1/students` | Catálogo: alunos (`?classId=` ou `?termId=`) |

> **Regra financeira:** estudantes com dívida recebem `403 FINANCIAL_ACCESS_BLOCKED` em qualquer consulta de notas
> (`/results`, `/results/:id`, `/assessments/:id/grades`, `/print/class/:id/pauta`); serviço financeiro indisponível → `503 FINANCIAL_VERIFICATION_UNAVAILABLE` (fail-closed).
> Utilizador `STUDENT` sem perfil académico → `404 STUDENT_NOT_FOUND`. Lançamento de nota de aluno endividado → `409 GRADES_BLOCKED_DUE_TO_DEBT`.
> Nos catálogos e na pauta, o staff vê linhas de endividados mascaradas (`debtRestricted: true`).

> **Nomes legíveis:** todas as respostas de avaliações, notas, horários e resultados já incluem os nomes
> (`className`, `subjectName`, `teacherName`, `studentName`, `termName`) ao lado dos IDs — uso direto sem decifrar UUIDs.
> Para montar formulários, consulte os catálogos acima (`.data[].id` + `.data[].name`).

## Motor de Cálculo de Notas

A API suporta 6 métodos de cálculo de notas, expostos via `POST /api/v1/results/calculate`:

| Método | Descrição |
|---|---|
| `ARITHMETIC_MEAN` | Média aritmética simples (`Σ score / N`) |
| `WEIGHTED_PERCENTAGE` | Média ponderada (`Σ (score×weight) / Σ weight`) — método padrão |
| `PERCENTAGE_SUM` | Soma de percentagens ponderadas — pesos devem totalizar 100 |
| `NORMALIZED_WEIGHTED_MEAN` | Média ponderada com pesos normalizados (pesos relativos) |
| `COMPONENT_BASED` | Média por componentes (ex.: AC + Exame, cada um com sub-notas) |
| `CUSTOM_WEIGHTED` | Fórmula personalizada: `SUM`, `MAX`, `MIN`, `WEIGHTED_100`, `NORMALIZED_MEAN`, `MEAN_OF_TOP_K` |

**Exemplo — Média ponderada:**
```bash
curl -X POST http://localhost:4100/api/v1/results/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "method": "WEIGHTED_PERCENTAGE",
    "items": [
      { "assessmentId": "...", "score": 15, "weight": 2 },
      { "assessmentId": "...", "score": 17, "weight": 1 }
    ],
    "rounding": { "decimals": 2 }
  }'
# → { "data": { "method": "WEIGHTED_PERCENTAGE", "value": 15.67, ... } }
```

Tipos de avaliação: `TESTE`, `EXAME_NORMAL`, `EXAME_RECURRENCIA` (armazenados como `TEST`/`EXAM`). Peso obrigatório **> 0**; média `Σ(nota×peso)/Σ(pesos)`.

## Contratos

- **Sucesso:** `{ data, meta: { correlationId } }`
- **Listagem:** `{ data, meta: { correlationId, page, pageSize, total } }` — listas aceitam `?page=&pageSize=` (máx. 100)
- **Erro:** `{ code, message, details, correlationId }`
- Status: 400, 401, 403, 404, 409, 500, 503 (`correlationId` ecoa o header `x-correlation-id`/`x-request-id`)

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor com watch (tsx) |
| `npm run build` | Compilar TypeScript |
| `npm run start` | Inicia o servidor (dist/) |
| `npm run typecheck` | Verificar tipos (tsc --noEmit) |
| `npm run test` | Todos os testes (unit + e2e) |
| `npm run test:unit` | Testes unitários (domínio) |
| `npm run test:e2e` | Testes de integração + ACID + contratos |
| `npm run test:services` | Testes e2e dos serviços Core (services/*) |
| `npm run prisma:generate` | Gera o client Prisma |
| `npm run prisma:studio` | Prisma Studio |
| `npm run db:migrate` | Cria/aplica migrações |
| `npm run db:deploy` | Aplica migrações (produção) |
| `npm run db:reset` | Zera o banco e reexecuta migrations + seed |
| `npm run db:seed` | Executa o seed |

## Variáveis de ambiente (`.env`)

| Variável | Padrão | Descrição |
|---|---|---|
| `DATABASE_URL` | `postgresql://smartcampos:smartcampos@localhost:5434/smartcampos` | Conexão PostgreSQL (Docker, porta 5434) |
| `G3_PORT` | `4100` | Porta do servidor |
| `G3_API_URL` | `http://localhost:4100` | URL base usada pelo `@smartcampus/api-client` |
| `SMARTCAMPUS_JWT_SECRET` | — | Segredo de assinatura dos accessTokens JWT |
| `FINANCIAL_SERVICE_TOKEN` / `SMARTCAMPUS_SERVICE_TOKEN` | — | Credencial de serviço para o contrato Financeiro |
| `STUDENTS_SERVICE_URL` / `TEACHERS_SERVICE_URL` | `http://localhost:4101` / `4102` | URLs dos serviços Core |
| `ENROLMENTS_SERVICE_URL` / `FINANCE_SERVICE_URL` | `http://localhost:4103` / `4104` | URLs dos serviços Core |
| `CONTRACT_TIMEOUT_MS` | `4000` | Timeout das chamadas aos contratos |

As notas de corte da escala académica (10 aprovação, 8 recuperação) são constantes do domínio em `src/modules/schedules-assessments/domain/evaluation.ts`.

## Testes

```bash
npm run test:unit      # 80 testes de domínio (evaluation 21 + calculationEngine 54 + validation 5)
npm run test:e2e       # 97 testes de integração (g3, catálogo, cálculo, erro, ACID, auth, dívida/contratos)
npm run test:services  # 46 testes e2e dos serviços Core (students/teachers/enrolments/finance)
```

Pré-requisito dos testes e2e: banco migrado e com seed (`npm run db:reset -- --force`).

## Documentação

Ver `docs/` — `openapi.yaml`, `entity-model.md`, `G3-ARQUITETURA-INTEGRACAO.md`, `manual-apis-core.md`, `CONTRATOS-API.md`, `reflection-questions.md`, `implementation-evidence.md`, `test-evidence.md`, `diagrams/` e o relatório final `.docx`.

### Ficha de exercícios — respostas e evidências

| Artefacto | Descrição |
|---|---|---|
| `docs/G3-exercicios-respostas.md` | Respostas consolidadas dos 7 exercícios (markdown) |
| `docs/API_TESTS_JSON.md` / `.docx` | Exemplos JSON (pedido+resposta) de **todos** os endpoints |
| `docs/UUID_REFERENCE.md` / `.docx` | Todos os UUID do banco (seed UJAC) |
| `docs/test-payloads/` | JSONs de pedido prontos (validados contra Zod) |
| `docs/G3_HORARIO_AVALIACOES_TYPE_FINAL.md` / `.docx` | Documentação final completa (24 secções) |
| `docs/G3_Horario_Avaliacoes_Type_Documentacao.docx` | Versão Word com evidências e imagens reais |
| `docs/diagrams/er-diagram-humanized.md` | Diagrama ER em caixas ASCII (preto-e-branco) |
| `docs/code-explanation.md` | Explicação linha a linha do código do módulo |
| `docs/review/repository-audit.md` | Auditoria/revisão de código (problemas + correcções) |
| `docs/diagrams/er-diagram.{svg,png,pdf}` | Diagrama entidade-relação do módulo |
| `docs/entity-model.md` | Modelo de entidades detalhado |
| `docs/evidence/prisma/` | Evidências `prisma generate` / `migrate status` / migration SQL |
| `docs/evidence/crud/` | Create/Update/Delete reais (201/200) e validações (400) |
| `docs/evidence/business-rules/` | Regras de negócio (409) — duplicata, imutabilidade, delete bloqueado, conflito de horário |
| `docs/evidence/transaction/` | Evidência ACID (rollback forçado) |
| `docs/evidence/tests/` | Saída real do `npm run test` (unit + e2e + services) |
| `docs/evidence/data-quality/` | Constraints CHECK e registos rejeitados |
