# Modelo de Entidades — Módulo G3 (Avaliações e Horários)

Baseado no `prisma/schema.prisma` real do projecto.

## Entidades Principais do Módulo

### 1. Assessment (Avaliação)

| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| id | String (UUID) | PK, @default(uuid()) | Identificador único |
| schoolId | String | FK → School, NOT NULL | Escola (multi-tenancy) |
| academicYearId | String | FK → AcademicYear, NOT NULL | Ano letivo |
| termId | String | FK → Term, NOT NULL | Período/semestre |
| classId | String | FK → Class, NOT NULL | Turma |
| subjectId | String | FK → Subject, NOT NULL | Disciplina |
| teacherId | String | FK → Teacher, NOT NULL | Professor |
| name | String | NOT NULL | Nome da avaliação |
| type | EvaluationType | ENUM, NOT NULL | Tipo (TEST, EXAM, ...) |
| description | String? | | Descrição opcional |
| date | DateTime | NOT NULL | Data da avaliação |
| maxScore | Decimal(5,2) | NOT NULL, DEFAULT 20, CHECK > 0 | Nota máxima |
| weight | Decimal(5,3) | NOT NULL, DEFAULT 1, CHECK > 0 | Peso na média |
| status | EvaluationStatus | ENUM, DEFAULT DRAFT | Estado |
| createdAt | DateTime | DEFAULT now() | Criação |
| updatedAt | DateTime | @updatedAt | Actualização |

**Índices:** schoolId, academicYearId, termId, classId, subjectId, teacherId, date, status, e compostos (schoolId+classId, schoolId+subjectId, schoolId+teacherId).

**Mapa tabela:** `assessments`

### 2. Grade (Nota)

| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| id | String (UUID) | PK | Identificador único |
| assessmentId | String | FK → Assessment, NOT NULL | Avaliação |
| studentId | String | FK → Student, NOT NULL | Aluno |
| score | Decimal(5,2) | NOT NULL, CHECK >= 0 AND <= 100 | Nota obtida |
| comment | String? | | Comentário |
| status | GradeStatus | ENUM, DEFAULT SUBMITTED | Estado |
| createdAt | DateTime | DEFAULT now() | Criação |
| updatedAt | DateTime | @updatedAt | Actualização |

**Constraint única:** `@@unique([assessmentId, studentId])` — 1 nota por aluno por avaliação.

**Mapa tabela:** `grades`

### 3. Schedule (Horário)

| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| id | String (UUID) | PK | Identificador único |
| schoolId | String | FK → School, NOT NULL | Escola |
| academicYearId | String | FK → AcademicYear, NOT NULL | Ano letivo |
| termId | String | FK → Term, NOT NULL | Período |
| classId | String | FK → Class, NOT NULL | Turma |
| subjectId | String | FK → Subject, NOT NULL | Disciplina |
| teacherId | String | FK → Teacher, NOT NULL | Professor |
| dayOfWeek | DayOfWeek | ENUM, NOT NULL | Dia da semana |
| startTime | String | NOT NULL, CHECK < endTime | Hora início (HH:mm) |
| endTime | String | NOT NULL | Hora fim (HH:mm) |
| room | String? | | Sala |
| status | ScheduleStatus | ENUM, DEFAULT ACTIVE | Estado |
| createdAt | DateTime | DEFAULT now() | Criação |
| updatedAt | DateTime | @updatedAt | Actualização |

**Índices compostos para detecção de conflitos:** (schoolId+teacherId+dayOfWeek), (schoolId+classId+dayOfWeek), (schoolId+room+dayOfWeek).

**Mapa tabela:** `schedules`

### 4. Result (Resultado)

| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| id | String (UUID) | PK | Identificador único |
| schoolId | String | FK → School, NOT NULL | Escola |
| academicYearId | String | FK → AcademicYear, NOT NULL | Ano letivo |
| termId | String | FK → Term, NOT NULL | Período |
| classId | String | FK → Class, NOT NULL | Turma |
| subjectId | String | FK → Subject, NOT NULL | Disciplina |
| studentId | String | FK → Student, NOT NULL | Aluno |
| teacherId | String? | FK → Teacher, SetNull | Professor |
| average | Decimal(5,2)? | CHECK >= 0 AND <= 100 OR NULL | Média ponderada |
| finalScore | Decimal(5,2)? | | Pontuação final |
| weightedTotal | Decimal(5,2)? | | Total ponderado |
| status | ResultStatus | ENUM, DEFAULT PENDING | Estado |
| calculatedAt | DateTime? | | Data do cálculo |
| createdAt | DateTime | DEFAULT now() | Criação |
| updatedAt | DateTime | @updatedAt | Actualização |

**Constraint única:** `@@unique([studentId, classId, subjectId, termId])`.

**Mapa tabela:** `results`

## Enums Utilizados

### EvaluationType (Tipo de Avaliação)
- `TEST` — Teste
- `EXAM` — Exame
- `ASSIGNMENT` — Trabalho
- `QUIZ` — Quiz
- `PROJECT` — Projecto
- `PRACTICAL` — Prático
- `ORAL` — Oral
- `OTHER` — Outro

### EvaluationStatus (Estado da Avaliação)
- `DRAFT` — Rascunho
- `SCHEDULED` — Agendada
- `OPEN` — Aberta (aceita notas)
- `CLOSED` — Encerrada
- `CANCELLED` — Cancelada

### GradeStatus (Estado da Nota)
- `SUBMITTED` — Submetida
- `APPROVED` — Aprovada
- `REVISED` — Revista

### DayOfWeek (Dia da Semana)
- `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY`

### ScheduleStatus (Estado do Horário)
- `ACTIVE` — Activo
- `INACTIVE` — Inactivo
- `CANCELLED` — Cancelado

### ResultStatus (Estado do Resultado)
- `APPROVED` — Aprovado (média >= 10)
- `RECOVERY` — Recuperação (8 <= média < 10)
- `FAILED` — Reprovado (média < 8)
- `PENDING` — Pendente
- `IN_PROGRESS` — Em progresso (faltam notas)

## Relações entre Entidades

```
School ──1:N──> Assessment
AcademicYear ──1:N──> Assessment
Term ──1:N──> Assessment
Class ──1:N──> Assessment
Subject ──1:N──> Assessment
Teacher ──1:N──> Assessment
Assessment ──1:N──> Grade
Student ──1:N──> Grade

School ──1:N──> Schedule
AcademicYear ──1:N──> Schedule
Term ──1:N──> Schedule
Class ──1:N──> Schedule
Subject ──1:N──> Schedule
Teacher ──1:N──> Schedule

School ──1:N──> Result
AcademicYear ──1:N──> Result
Term ──1:N──> Result
Class ──1:N──> Result
Subject ──1:N──> Result
Student ──1:N──> Result
Teacher ──1:?──> Result
```

## Mapeamento API ↔ Database

| Campo API (Zod) | Campo DB (Prisma) | Observação |
|-----------------|-------------------|------------|
| TESTE | TEST | TYPE_MAP conversão |
| EXAME_NORMAL | EXAM | TYPE_MAP conversão |
| EXAME_RECURRENCIA | EXAM | TYPE_MAP conversão |

## Constraints CHECK (PostgreSQL)

```sql
CHECK ("weight" > 0)             -- assessments
CHECK ("maxScore" > 0)           -- assessments
CHECK ("score" >= 0 AND "score" <= 100)  -- grades
CHECK ("startTime" < "endTime")  -- schedules
CHECK ("average" IS NULL OR ("average" >= 0 AND "average" <= 100))  -- results
```
