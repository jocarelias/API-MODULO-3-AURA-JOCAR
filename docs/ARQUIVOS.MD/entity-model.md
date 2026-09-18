# Modelo de Entidades — Módulo G3 (Avaliações e Horários)

Formato exigido pela ficha: `Entidade | Campo | Tipo | Obrigatório | Chave | Descrição`.
Campos reais extraídos de `prisma/schema.prisma`.

---

## Assessment (Avaliação) — tabela `assessments`

| Entidade | Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|---|
| Assessment | id | String (UUID) | Sim | **PK** | Identificador único da avaliação |
| Assessment | schoolId | String (UUID) | Sim | FK → School | Escola (contexto multi-tenant) |
| Assessment | academicYearId | String (UUID) | Sim | FK → AcademicYear | Ano letivo em que se realiza |
| Assessment | termId | String (UUID) | Sim | FK → Term | Período académico (semestre/trimestre) |
| Assessment | classId | String (UUID) | Sim | FK → Class | Turma avaliada |
| Assessment | subjectId | String (UUID) | Sim | FK → Subject | Disciplina avaliada |
| Assessment | teacherId | String (UUID) | Sim | FK → Teacher | Professor responsável |
| Assessment | name | String (200) | Sim | — | Nome da avaliação (ex.: «Teste 1») |
| Assessment | type | Enum `EvaluationType` | Sim | — | `TEST` ou `EXAM` (API: TESTE/EXAME_NORMAL/EXAME_RECURRENCIA) |
| Assessment | description | String (500) | Não | — | Notas/observações opcionais |
| Assessment | date | DateTime | Sim | — | Data/hora da avaliação |
| Assessment | maxScore | Decimal(5,2) | Sim | CHECK > 0 | Nota máxima (default 20) |
| Assessment | weight | Decimal(5,3) | Sim | CHECK > 0 | Peso da avaliação na média (default 1) |
| Assessment | status | Enum `EvaluationStatus` | Sim | — | DRAFT/SCHEDULED/OPEN/CLOSED/CANCELLED (default DRAFT) |
| Assessment | createdAt | DateTime | Sim | — | Data de criação |
| Assessment | updatedAt | DateTime | Sim | — | Data da última actualização |

**Unique composto:** `(termId, classId, subjectId, name)` — impede avaliação duplicada (409).
**Índices:** schoolId, academicYearId, termId, classId, subjectId, teacherId, date, status e compostos (schoolId+classId, schoolId+subjectId, schoolId+teacherId).

---

## Grade (Nota) — tabela `grades`

| Entidade | Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|---|
| Grade | id | String (UUID) | Sim | **PK** | Identificador único da nota |
| Grade | assessmentId | String (UUID) | Sim | FK → Assessment | Avaliação a que pertence a nota |
| Grade | studentId | String (UUID) | Sim | FK → Student | Aluno que obteve a nota |
| Grade | score | Decimal(5,2) | Sim | CHECK [0, maxScore] | Nota obtida (0–20 na escala padrão) |
| Grade | comment | String (500) | Não | — | Comentário opcional do professor |
| Grade | status | Enum `GradeStatus` | Sim | — | SUBMITTED/APPROVED/REVISED (default SUBMITTED) |
| Grade | createdAt | DateTime | Sim | — | Data de criação |
| Grade | updatedAt | DateTime | Sim | — | Data da última actualização |

**Unique composto:** `(assessmentId, studentId)` — **1 nota por aluno por avaliação** (duplicada → 409).

---

## Schedule (Horário) — tabela `schedules`

| Entidade | Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|---|
| Schedule | id | String (UUID) | Sim | **PK** | Identificador único do horário |
| Schedule | schoolId | String (UUID) | Sim | FK → School | Escola |
| Schedule | academicYearId | String (UUID) | Sim | FK → AcademicYear | Ano letivo |
| Schedule | termId | String (UUID) | Sim | FK → Term | Período académico |
| Schedule | classId | String (UUID) | Sim | FK → Class | Turma a que se destina a aula |
| Schedule | subjectId | String (UUID) | Sim | FK → Subject | Disciplina leccionada |
| Schedule | teacherId | String (UUID) | Sim | FK → Teacher | Professor da aula |
| Schedule | dayOfWeek | Enum `DayOfWeek` | Sim | — | MONDAY..SATURDAY |
| Schedule | startTime | String (HH:mm) | Sim | CHECK < endTime | Hora de início da aula |
| Schedule | endTime | String (HH:mm) | Sim | CHECK > startTime | Hora de fim da aula |
| Schedule | room | String (100) | Não | — | Sala/laboratório |
| Schedule | status | Enum `ScheduleStatus` | Sim | — | ACTIVE/INACTIVE/CANCELLED (default ACTIVE) |
| Schedule | createdAt | DateTime | Sim | — | Data de criação |
| Schedule | updatedAt | DateTime | Sim | — | Data da última actualização |

**Índices de conflito:** (schoolId+teacherId+dayOfWeek), (schoolId+classId+dayOfWeek), (schoolId+room+dayOfWeek) — suportam a regra de conflitos (409).

---

## Result (Resultado) — tabela `results`

| Entidade | Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|---|
| Result | id | String (UUID) | Sim | **PK** | Identificador único do resultado |
| Result | schoolId | String (UUID) | Sim | FK → School | Escola |
| Result | academicYearId | String (UUID) | Sim | FK → AcademicYear | Ano letivo |
| Result | termId | String (UUID) | Sim | FK → Term | Período académico |
| Result | classId | String (UUID) | Sim | FK → Class | Turma |
| Result | subjectId | String (UUID) | Sim | FK → Subject | Disciplina |
| Result | studentId | String (UUID) | Sim | FK → Student | Aluno |
| Result | teacherId | String (UUID) | Não | FK → Teacher | Professor (opcional) |
| Result | average | Decimal(5,2) | Não | CHECK [0,100] ou NULL | Média ponderada das notas |
| Result | finalScore | Decimal(5,2) | Não | — | Pontuação final |
| Result | weightedTotal | Decimal(5,2) | Não | — | Total ponderado |
| Result | calculationMethod | Enum `CalculationMethod` | Não | — | Método usado (ex.: WEIGHTED_PERCENTAGE) |
| Result | status | Enum `ResultStatus` | Sim | — | APPROVED/RECOVERY/FAILED/PENDING/IN_PROGRESS |
| Result | calculatedAt | DateTime | Não | — | Data do último cálculo |
| Result | createdAt | DateTime | Sim | — | Data de criação |
| Result | updatedAt | DateTime | Sim | — | Data da última actualização |

**Unique composto:** `(studentId, classId, subjectId, termId)` — **1 resultado por aluno/contexto**.
O resultado é **derivado** das notas (nunca editado manualmente); recalcula-se em transacção ACID.

---

## Enums utilizados

| Enum | Valores | Descrição |
|---|---|---|
| EvaluationType | `TEST`, `EXAM`, `ASSIGNMENT`, `QUIZ`, `PROJECT`, `PRACTICAL`, `ORAL`, `OTHER` | Tipo da avaliação (API usa TESTE/EXAME_NORMAL/EXAME_RECURRENCIA → TEST/EXAM) |
| EvaluationStatus | `DRAFT`, `SCHEDULED`, `OPEN`, `CLOSED`, `CANCELLED` | Estado da avaliação (notas só em OPEN) |
| GradeStatus | `SUBMITTED`, `APPROVED`, `REVISED` | Estado da nota |
| ScheduleStatus | `ACTIVE`, `INACTIVE`, `CANCELLED` | Estado do horário |
| DayOfWeek | `MONDAY`–`SATURDAY` | Dia da semana |
| ResultStatus | `APPROVED` (≥10), `RECOVERY` (≥8), `FAILED` (<8), `PENDING`, `IN_PROGRESS` | Situação académica |
| CalculationMethod | `ARITHMETIC_MEAN`, `WEIGHTED_PERCENTAGE`, `PERCENTAGE_SUM`, `NORMALIZED_WEIGHTED_MEAN`, `COMPONENT_BASED`, `CUSTOM_WEIGHTED` | Método de cálculo usado |

---

## Mapeamento API ↔ Database

| Campo API (Zod) | Campo DB (Prisma) | Observação |
|---|---|---|
| TESTE | TEST | `TYPE_MAP` no service |
| EXAME_NORMAL | EXAM | `TYPE_MAP` no service |
| EXAME_RECURRENCIA | EXAM | `TYPE_MAP` no service (DTO devolve EXAME_NORMAL) |

---

## Constraints CHECK (PostgreSQL)

```sql
CHECK ("weight" > 0)                              -- assessments
CHECK ("maxScore" > 0)                            -- assessments
CHECK ("score" >= 0 AND "score" <= 100)           -- grades (Zod valida [0, maxScore])
CHECK ("startTime" < "endTime")                   -- schedules
CHECK ("average" IS NULL OR ("average" >= 0 AND "average" <= 100))  -- results
```

Evidência real: `docs/evidence/07-data-quality/constraints.txt`.