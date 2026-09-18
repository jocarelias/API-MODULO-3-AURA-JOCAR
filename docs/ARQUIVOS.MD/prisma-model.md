# Modelo Prisma — Módulo G3 (Avaliações e Horários)

Ficheiro de referência: `prisma/schema.prisma` (fonte única de verdade).
Migração do módulo: `prisma/migrations/20260909000000_add_schedules_assessments` (renomeação `Evaluation→Assessment`, `EvaluationGrade→Grade` com dados preservados).

## Entidades do módulo

### `Assessment` → tabela `assessments`

| Campo | Tipo | Regras |
|---|---|---|
| `id` | `String @id @default(uuid())` | PK |
| `schoolId` / `academicYearId` / `termId` / `classId` / `subjectId` / `teacherId` | `String` | FKs (multi-tenancy partilhado, sem auth no módulo) |
| `name` | `String` | título da avaliação |
| `type` | `EvaluationType` | `TEST`, `EXAM`, `ASSIGNMENT`, `QUIZ`, `PROJECT`, `PRACTICAL`, `ORAL`, `OTHER` |
| `date` | `DateTime` | dia/hora |
| `maxScore` | `Decimal(5,2)` | default `20`; CHECK > 0 |
| `weight` | `Decimal(5,3)` | default `1`; CHECK > 0 |
| `status` | `EvaluationStatus` | `DRAFT`, `SCHEDULED`, `OPEN`, `CLOSED`, `CANCELLED` (default `DRAFT`) |

Relações: `grades Grade[]`. Índices: `schoolId`, `academicYearId`, `termId`, `classId`, `subjectId`, `teacherId`, `date`, `status`, e compostos `(schoolId, classId|subjectId|teacherId)`.

### `Grade` → tabela `grades`

| Campo | Tipo | Regras |
|---|---|---|
| `id` | `String @id @default(uuid())` | PK |
| `assessmentId` | `String` | FK→Assessment (Cascade) |
| `studentId` | `String` | FK→Student (Cascade) |
| `score` | `Decimal(5,2)` | `[0, maxScore]` validado no domínio |
| `comment` | `String?` | opcional |
| `status` | `GradeStatus` | `SUBMITTED`, `APPROVED`, `REVISED` |

**`@@unique([assessmentId, studentId])`** → 1 nota por aluno por avaliação (duplicado → 409).
Relações: `assessment`, `student`.

### `Schedule` → tabela `schedules`

| Campo | Tipo | Regras |
|---|---|---|
| `id` | `String @id @default(uuid())` | PK |
| `schoolId` / `academicYearId` / `termId` / `classId` / `subjectId` / `teacherId` | `String` | FKs |
| `dayOfWeek` | `DayOfWeek` | `MONDAY`..`SATURDAY` |
| `startTime` / `endTime` | `String` | `HH:mm`, `start < end` |
| `room` | `String?` | opcional |
| `status` | `ScheduleStatus` | `ACTIVE`, `INACTIVE`, `CANCELLED` |

Índices compostos úteis para conflitos: `(schoolId, teacherId, dayOfWeek)`, `(schoolId, classId, dayOfWeek)`, `(schoolId, room, dayOfWeek)`. Conflito professor/turma/sala → 409 (regra no service).

### `Result` → tabela `results`

| Campo | Tipo | Regras |
|---|---|---|
| `id` | `String @id @default(uuid())` | PK |
| `studentId` / `classId` / `subjectId` / `termId` / `schoolId` / `academicYearId` | `String` | FKs |
| `average` | `Decimal?` | média ponderada (2 casas) |
| `finalScore` / `weightedTotal` | `Decimal?` | campos auxiliares de cálculo |
| `status` | `ResultStatus` | `APPROVED`, `FAILED`, `RECOVERY`, `PENDING`, `IN_PROGRESS` |
| `calculatedAt` | `DateTime?` | carimbo do último cálculo |

**`@@unique([studentId, classId, subjectId, termId])`** → 1 resultado por aluno/turma/disciplina/período.

## Relações principais

- `Assessment 1─* Grade` (uma avaliação tem várias notas; `onDelete: Cascade`)
- `Result` é **derivado** das notas (upsert em `$transaction`) — média `Σ(nota×peso)/Σ(pesos)`
- Entidades externas partilhadas referenciadas: `School`, `AcademicYear`, `Term`, `Class`, `Subject`, `Teacher`, `Student`, `Enrollment`

## Enumerações relevantes

- `EvaluationType`: `TEST`, `EXAM` (as restantes existem no modelo partilhado; o módulo restringe a `TEST`/`EXAM`)
- `EvaluationStatus`: `DRAFT`, `SCHEDULED`, `OPEN`, `CLOSED`, `CANCELLED`
- `ScheduleStatus`: `ACTIVE`, `INACTIVE`, `CANCELLED`
- `DayOfWeek`: `MONDAY`..`SATURDAY`
- `ResultStatus`: `APPROVED`, `FAILED`, `RECOVERY`, `PENDING`, `IN_PROGRESS`

> API aberta: sem `User`/`RefreshToken` no ciclo pedido pelas rotas G3 (módulo não autentica). `User` e `Role` permanecem no schema partilhado para outros módulos, mas o G3 não os usa.

## Mapeamento API ↔ BD (tipo)

| Tipo API (Zod/DTO) | Valor BD |
|---|---|
| `TESTE` | `TEST` |
| `EXAME_NORMAL` | `EXAM` |
| `EXAME_RECURRENCIA` | `EXAM` (via `TYPE_MAP` igual a EXAME_NORMAL no BD) |

`TYPE_MAP` em `application/schedulesAssessmentsService.js`; reverse-map no DTO devolve `TESTE`/`EXAME_NORMAL`.

## Verificação

```bash
npm run db:migrate            # em aplicar → gera migrations
prisma migrate status         # "Database schema is up to date!"
prisma studio                 # evidencias visuais (ver docs/evidence/02-prisma)
```