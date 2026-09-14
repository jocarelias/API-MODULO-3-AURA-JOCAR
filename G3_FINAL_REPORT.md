# G3_FINAL_REPORT.md — Módulo Avaliações e Horários

## Resumo executivo

O módulo G3 foi **completado e validado** — estrutura corrigida, contrato alinhado à ficha, transações ACID implementadas, **46 testes a passar (21 unit + 25 e2e)**, documentação de suporte completa, diagramas ER/UML, evidências reais de execução e **documento Word final**. API aberta sem autenticação.

**Principais entregas:**

| Artefacto | Estado |
|---|---|
| `prisma/schema.prisma` — modelos `Assessment`, `Grade` (renomeados com `@@map`, migration aplicada) | ✔ |
| Migration `20260909000000_add_schedules_assessments` — dados preservados | ✔ |
| CHECK constraints no banco (peso, nota, horário, resultado) | ✔ activos (`docs/evidence/07-data-quality`) |
| Regras de domínio (`evaluation.js`) — peso > 0, tipos, média ponderada, status | ✔ (21 testes unitários) |
| Service (`schedulesAssessmentsService.js`) — CRUD, transações `$transaction`, regras | ✔ |
| Router (`schedulesAssessmentsRouter.js`) — novas rotas, DELETE, schemas Zod, correlationId, **paginação** | ✔ |
| DTOs (`@smartcampus/shared-types`) — serialização, reverse map `TEST→TESTE` | ✔ |
| Schemas (`schemas/index.js`) — fonte única (incl. `page`/`pageSize`); `@smartcampus/validation` re-exporta | ✔ |
| `@smartcampus/api-client` — cliente HTTP fetch (com `updateResult` alias de `PATCH /results/:id`) | ✔ |
| `httpError.js` — mapeamento P2002 → 409, DomainError, 500 genérico | ✔ |
| `seed.js` — convertido de `.ts` (sem argon2/TS) | ✔ |
| `app.js` — router em `/api/v1` (não `/schedules-assessments`), health não colide com catch-all | ✔ |
| `openapi.js` + `docs/openapi.yaml` — spec 3.0.0, novas rotas, paginação, **sem security** | ✔ |
| Testes e2e (25) — CRUD, DELETE, 409/400/404, recálculo, impressão, API docs | ✔ |
| Testes ACID (2) — rollback forçado e sucesso atómico | ✔ |
| `vitest.config.js` — unit exclusivo (exclui `*.e2e.test.js`) | ✔ |
| Diagramas: `docs/diagrams/*.svg` (ER, classes, casos de uso, sequência, fluxo da média) + `.mmd/.dbml/.drawio` | ✔ |
| `docs/prisma-model.md` + `docs/REPOSITORY_ANALYSIS.md` | ✔ |
| `docs/reflection-questions.md` — **4 perguntas exactas da ficha** | ✔ |
| `docs/evidence/**` — migrate status, studio, psql, curls reais, logs de testes | ✔ |
| Documento Word `docs/G3_Avaliacoes_Horarios_Documentacao_Final.docx` (capa, TOC, 24 secções, figuras) | ✔ |
| `AGENTS.md` actualizado (rotas, estrutura, regras) | ✔ |

## Arquitectura aplicada

```
src/
├── main.js / app.js                       ← Express 5, /api/v1, Swagger local
├── openapi.js                             ← spec runtime
└── modules/schedules-assessments/
    ├── domain/evaluation.js               ← regras puras + 21 testes
    ├── application/schedulesAssessmentsService.js
    ├── infrastructure/{prisma,httpError}.js
    ├── schemas/index.js                   ← Zod (fonte única)
    ├── http/schedulesAssessmentsRouter.js ← express + correlationId + 404
    └── tests/                             ← 25 e2e + 2 ACID

packages/
├── shared-types/    ← DTOs, constantes, campusModules
├── validation/      ← re-export schemas
└── api-client/      ← fetch client
```

## Rotas finais

| Rota | Métodos |
|---|---|
| `/api/v1/assessments` | GET, POST |
| `/api/v1/assessments/:id` | GET, PATCH, DELETE |
| `/api/v1/assessments/:assessmentId/grades` | GET, POST |
| `/api/v1/assessments/:assessmentId/grades/:gradeId` | PATCH |
| `/api/v1/schedules` | GET, POST |
| `/api/v1/schedules/:id` | GET, PATCH, DELETE |
| `/api/v1/results` | GET, POST |
| `/api/v1/results/:id` | GET, PATCH |
| `/api/v1/print/class/:classId/schedule` | GET |
| `/api/v1/print/class/:classId/pauta` | GET |
| `/api/v1/health` | GET |
| `/api/docs` | Swagger UI |
| `/api/openapi.json` | spec JSON |

## Regras de negócio verificadas

- **Peso > 0**: domínio, Zod, CHECK no DB (verificado)
- **Tipo**: `TESTE|EXAME_NORMAL|EXAME_RECURRENCIA` (API) → `TEST|EXAM` (DB), DTO devolve `TESTE`
- **Média**: `Σ(nota×peso)/Σ(pesos)` com `round2`
- **Status**: `APPROVED ≥10`, `RECOVERY ≥8`, `FAILED`, `IN_PROGRESS`, `PENDING`
- **Não duplicar**: avaliação por (turma, disciplina, período, nome); nota por (avaliação, aluno); horário por conflito professor/turma/sala
- **Imutabilidade**: peso/maxScore bloqueados após existirem notas (409)
- **DELETE bloqueado**: assessment com notas → 409
- **ACID**: nota+recálculo na mesma transação; rollback forçado provado
- **Sem 401/403**: API aberta, sem expor credenciais
- **correlationId**: header `x-request-id` ou gerado, sempre ecoado

## Checklist da ficha

| Item da ficha | Estado |
|---|---|
| API aberta (no auth/401/403) | ✔ |
| Rotas `/api/v1/assessments`, `/schedules`, `/results` | ✔ |
| Impressão pauta/horário | ✔ |
| Média ponderada Σ(nota×peso)/Σ(pesos) | ✔ |
| Peso > 0 | ✔ |
| Tipos TESTE/EXAME_NORMAL/EXAME_RECURRENCIA | ✔ |
| DELETE assessment bloqueado com notas | ✔ |
| Conflitos de horário 409 | ✔ |
| Transação ACID em create/updateGrade + recálculo | ✔ |
| packages `@smartcampus/shared-types`, `validation`, `api-client` | ✔ |
| schema.prisma com Assessment/Grade | ✔ |
| migration preservando dados | ✔ |
| CHECK constraints (banco) | ✔ |
| Testes 400/404/409/500 | ✔ |
| Teste rollback transação forçado | ✔ |
| seed.ts → seed.js | ✔ |
| Swagger local (swagger-ui-dist) | ✔ |
| openapi.json / openapi.yaml sem security | ✔ |
| `docs/` (manuais, reflexão com as 4 perguntas, evidências, documento Word) | ✔ |
| `G3_FINAL_REPORT.md` | ✔ |
| Diagramas ER + UML (SVG e fontes `.mmd`/`.dbml`/`.drawio`) | ✔ |
| `docs/prisma-model.md` / `docs/REPOSITORY_ANALYSIS.md` | ✔ |
| Paginação `page`/`pageSize` (meta `page`, `pageSize`, `total`) | ✔ |

## FinalQualityGate — Checklist

| Verificação | Resultado |
|---|---|
| `npm run test:unit` | ✔ 21 passed (1 ficheiro, sem banco) |
| `npm run test:e2e` | ✔ 25 passed (2 ficheiros, app ephemeral) |
| `prisma migrate status` | ✔ "2 migrations found … Database schema is up to date!" |
| Prisma Studio `http://localhost:5555` | ✔ HTTP 200 (arranque headless) |
| Servidor `node src/main.js` → `/api/v1/health` | ✔ 200 |
| `/api/docs` e `/api/openapi.json` | ✔ 200 — spec sem `security`, sem `password`/`bearer` |
| CRUD + erros HTTP reais (200/201/400/404/409) | ✔ evidências em `docs/evidence/03-crud` e `06-errors` |
| CHECK/UNIQUE constraints (psql) | ✔ `docs/evidence/07-data-quality/constraints.txt` |
| Contagens `assessments=31 · grades=101 · schedules=15 · results=50` | ✔ `docs/evidence/07-data-quality/counts.txt` |
| Backup/consistência de dados pós-testes | ✔ criados de teste removidos (`ev-*`) |
| Documento Word abre sem erros | ✔ validado por conversão LibreOffice → PDF (A4, 12 pags) |

## Execução verificada

```bash
npm run test:unit   # 21 passed ✔  (regras puras, sem banco)
npm run test:e2e    # 25 passed ✔  (CRUD + 2 ACID rollback)
node src/main.js    # http://localhost:4100/api/v1 ✔
```