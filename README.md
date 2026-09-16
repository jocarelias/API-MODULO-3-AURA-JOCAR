# G3 — Avaliações, Horários e Resultados

API aberta pública para gestão de **avaliações**, **lançamento de notas**, **cálculo de médias**, **horários** e **resultados académicos** — desenvolvida para a **UJAC**, curso de **Engenharia Informática**.

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
    └── tests/                                           # e2e: 29 g3 + 18 calculation + 3 error + 2 ACID
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
| GET | `/api/v1/results/calculation-methods` | Métodos de cálculo disponíveis |
| POST | `/api/v1/results/calculate` | Calcula nota com método flexível |
| GET | `/api/v1/print/class/:classId/schedule` | Horário da turma (impressão) |
| GET | `/api/v1/print/class/:classId/pauta` | Pauta de notas da turma |

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
| `DATABASE_URL` | `postgresql://smartcampos:smartcampos@localhost:5434/smartcampos` | Conexão PostgreSQL (Docker, porta 5434) |
| `G3_PORT` | `4100` | Porta do servidor |
| `G3_API_URL` | `http://localhost:4100` | URL base usada pelo `@smartcampus/api-client` |

As notas de corte da escala académica (10 aprovação, 8 recuperação) são constantes do domínio em `src/modules/schedules-assessments/domain/evaluation.ts`.

## Testes

```bash
npm run test          # 75 unit + 52 e2e = 127 testes
npm run test:unit     # domínio: tipos, pesos (> 0), média, status, time range + motor de cálculo (54)
npm run test:e2e      # integração: contratos, CRUD+DELETE, 409s, recálculo, impressão, rollback ACID, cálculo flexível
```

Pré-requisito dos testes e2e: banco migrado e com seed (`npm run db:reset -- --force`).

## Documentação

Ver `docs/` — `openapi.yaml`, `entity-model.md`, `manual-apis-core.md`, `reflection-questions.md`, `implementation-evidence.md`, `test-evidence.md`, `diagrams/` e o relatório final `.docx`.

### Ficha de exercícios — respostas e evidências

| Artefacto | Descrição |
|---|---|---|
| `docs/G3-exercicios-respostas.md` | Respostas consolidadas dos 7 exercícios (markdown) |
| `docs/API_TESTS_JSON.md` | Exemplos JSON (pedido+resposta) de **todos** os endpoints |
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
| `docs/evidence/tests/` | Saída real do `npm test` (127 testes) |
| `docs/evidence/data-quality/` | Constraints CHECK e registos rejeitados |
