# Evidências de Implementação — Módulo G3 (Avaliações e Horários)

Data da verificação: **2026-09-09**. Ambiente: Node v24.19.0, npm 11.17.0, PostgreSQL 16 (Docker `localhost:5434`), Prisma 6.

## 1. Renomeação do modelo e migration aplicada

`prisma/schema.prisma`: `model Assessment` (`@@map("assessments")`), `model Grade` (`@@map("grades")`), coluna `assessmentId` em grades, relações com School/AcademicYear/Term/Class/Subject/Teacher/Student (ver `docs/entity-model.md`).

```bash
$ npx prisma validate              # ✔ schema válido
$ npx prisma migrate deploy        # ✔ aplica 20260909000000_add_schedules_assessments
$ npx prisma migrate status        # ✔ Database schema is up to date!
$ npx prisma generate              # ✔ cliente regenerado (Assessment/Grade)
```

Migration autorada `prisma/migrations/20260909000000_add_schedules_assessments/migration.sql` — renomeia tabelas/colunas **sem recriar dados**:

```sql
ALTER TABLE "evaluation_grades" RENAME TO "grades";
ALTER TABLE "evaluations" RENAME TO "assessments";
ALTER TABLE "grades" RENAME COLUMN "evaluationId" TO "assessmentId";
```

## 2. Dados preservados após a renomeação

| Entidade | Antes | Depois |
|---|---|---|
| Assessment (evaluations) | 31 | 31 ✔ |
| Grade (evaluationGrade) | 101 | 101 ✔ |
| Schedule | 15 | 15 ✔ |
| Result | 50 | 50 ✔ |

## 3. CHECK constraints activas (defesa em profundidade)

```sql
SELECT conname FROM pg_constraint
 WHERE conname IN ('check_assessment_max_score_positive','check_assessment_weight_positive',
                   'check_grade_score_range','check_schedule_time_range','check_result_average_range');
```

Verificações manuais realizadas via psql (com `?schema=public` removido da `DATABASE_URL`):

- `INSERT grades score=150` → rejeitado por `check_grade_score_range`;
- `INSERT grades score=15` → aceite;
- `UPDATE assessments weight=0` → rejeitado por `check_assessment_weight_positive`.

## 4. Workspaces npm e pacotes partilhados

`package.json` root: `"workspaces": ["packages/*"]`.

```bash
$ npm install          # ✔ 617 packages pruned/regra adicionados; symlinks node_modules/@smartcampus/*
$ ls node_modules/@smartcampus/   # api-client, shared-types, validation
```

- `packages/shared-types/src/index.js` — DTOs (`assessmentDto`/`gradeDto`/`scheduleDto`/`resultDto`, reverse map `TEST→TESTE`), constantes, `campusModules.G3_AVALIACOES_HORARIOS`.
- `packages/validation/src/index.js` — re-exporta os schemas Zod do módulo (fonte única).
- `packages/api-client/src/index.js` — cliente HTTP fetch (Node 24) com envelope `{data, meta}`.

## 5. Regras de negócio implementadas

- `domain/evaluation.js:validateWeight` — **peso > 0** (mensagem "Peso deve ser maior que 0"); testes atualizados (21 unit);
- **Nenhuma duplicação** de assessment por (termId, classId, subjectId, name) → `CONFLICT`;
- **Peso/maxScore imutáveis** após existirem notas → `CONFLICT`;
- **DELETE assessment bloqueado** com notas → `CONFLICT`; permitido sem notas;
- Nota só em avaliação `OPEN` → `CONFLICT`; 1 nota por aluno (`@@unique`) → `CONFLICT`;
- Validação do professor leciona a turma/disciplina (via schedules + assessments existentes);
- Conflitos de horário (professor/turma/sala) → `409` com `details`;
- Atingir status de resultado: `APPROVED ≥ 10`, `RECOVERY ≥ 8`, `FAILED`, `IN_PROGRESS`, `PENDING`;
- **Recálculo atómico**: `createGrade`/`updateGrade`/`createResults`/`patchResult` usam `prisma.$transaction` com `_recalculateInTx`.

## 6. Rotas implementadas (contrato da ficha)

| Rota | Métodos | Status |
|---|---|---|
| `/api/v1/assessments` | GET, POST | ✔ |
| `/api/v1/assessments/:id` | GET, PATCH, DELETE | ✔ |
| `/api/v1/assessments/:assessmentId/grades` | GET, POST | ✔ |
| `/api/v1/assessments/:assessmentId/grades/:gradeId` | PATCH | ✔ |
| `/api/v1/schedules` | GET, POST | ✔ |
| `/api/v1/schedules/:id` | GET, PATCH, DELETE | ✔ |
| `/api/v1/results` | GET, POST | ✔ |
| `/api/v1/results/:id` | GET, PATCH | ✔ |
| `/api/v1/print/class/:classId/schedule` | GET | ✔ |
| `/api/v1/print/class/:classId/pauta` | GET | ✔ |

## 7. Verificações funcionais (smoke)

```bash
node src/main.js
# ✔ G3 (Avaliações e Horários) ouvindo em http://localhost:4100/api/v1
curl -s http://localhost:4100/api/v1/health            # 200 {status ok}
curl -s -o /dev/null -w '%{http_code}' http://localhost:4100/api/v1/assessments   # 200
curl -s -o /dev/null -w '%{http_code}' http://localhost:4100/api/docs             # 200
```

## 8. Artefactos de suporte

- `docs/openapi.yaml` + `src/openapi.js` (spec 3.0.0, **sem** `securitySchemes`/`security`);
- `docs/diagrams/*` (contexto, componentes, sequências de nota/horário);
- `docs/manual-apis-core.md` (manual de consumo);
- `docs/entity-model.md` (modelo aplicado);
- `prisma/seed.js` (convertido de `seed.ts`, sem TypeScript/argon2).