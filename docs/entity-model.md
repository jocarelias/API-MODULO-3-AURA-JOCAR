# Modelação de Entidades — Módulo G3 (Avaliações e Horários)

## 1. Assessment (Avaliação)

| Atributo | Tipo | Obrigatório | PK/FK | Descrição |
|---|---|---|---|---|
| id | UUID | Sim | PK | Identificador único |
| schoolId | UUID | Sim | FK → School | Escola (multi-tenancy) |
| academicYearId | UUID | Sim | FK → AcademicYear | Ano lectivo |
| termId | UUID | Sim | FK → Term | Período/Trimestre |
| classId | UUID | Sim | FK → Class | Turma |
| subjectId | UUID | Sim | FK → Subject | Disciplina |
| teacherId | UUID | Sim | FK → Teacher | Professor |
| name | String | Sim | | Nome da avaliação |
| type | EvaluationType | Sim | | TEST, EXAM, etc. |
| description | String? | Não | | Descrição opcional |
| date | DateTime | Sim | | Data da avaliação |
| maxScore | Decimal | Sim | default(20) | Nota máxima |
| weight | Decimal | Sim | default(1) | Peso na média |
| status | EvaluationStatus | Sim | default(DRAFT) | Estado |
| createdAt | DateTime | Sim | auto | Registo criado |
| updatedAt | DateTime | Sim | auto | Última alteração |

**Relações:** belongs to School, AcademicYear, Term, Class, Subject, Teacher; has many Grades.

## 2. Grade (Nota)

| Atributo | Tipo | Obrigatório | PK/FK | Descrição |
|---|---|---|---|---|
| id | UUID | Sim | PK | Identificador único |
| assessmentId | UUID | Sim | FK → Assessment | Avaliação |
| studentId | UUID | Sim | FK → Student | Aluno |
| score | Decimal | Sim | | Nota obtida |
| comment | String? | Não | | Comentário |
| status | GradeStatus | Sim | default(SUBMITTED) | Estado |
| createdAt | DateTime | Sim | auto | Registo criado |
| updatedAt | DateTime | Sim | auto | Última alteração |

**Restrições:** @@unique([assessmentId, studentId]) — 1 nota por aluno/avaliação.

## 3. Schedule (Horário)

| Atributo | Tipo | Obrigatório | PK/FK | Descrição |
|---|---|---|---|---|
| id | UUID | Sim | PK | Identificador único |
| schoolId | UUID | Sim | FK → School | Escola |
| academicYearId | UUID | Sim | FK → AcademicYear | Ano lectivo |
| termId | UUID | Sim | FK → Term | Período |
| classId | UUID | Sim | FK → Class | Turma |
| subjectId | UUID | Sim | FK → Subject | Disciplina |
| teacherId | UUID | Sim | FK → Teacher | Professor |
| dayOfWeek | DayOfWeek | Sim | | Dia da semana |
| startTime | String | Sim | HH:mm | Hora de início |
| endTime | String | Sim | HH:mm | Hora de fim |
| room | String? | Não | | Sala/Local |
| status | ScheduleStatus | Sim | default(ACTIVE) | Estado |
| createdAt | DateTime | Sim | auto | |
| updatedAt | DateTime | Sim | auto | |

**Relações:** belongs to School, AcademicYear, Term, Class, Subject, Teacher.

## 4. Result (Resultado)

| Atributo | Tipo | Obrigatório | PK/FK | Descrição |
|---|---|---|---|---|
| id | UUID | Sim | PK | Identificador único |
| schoolId | UUID | Sim | FK → School | Escola |
| academicYearId | UUID | Sim | FK → AcademicYear | Ano lectivo |
| termId | UUID | Sim | FK → Term | Período |
| classId | UUID | Sim | FK → Class | Turma |
| subjectId | UUID | Sim | FK → Subject | Disciplina |
| studentId | UUID | Sim | FK → Student | Aluno |
| average | Decimal? | Não | | Média ponderada |
| finalScore | Decimal? | Não | | Nota final |
| status | ResultStatus | Sim | default(PENDING) | Estado |
| calculatedAt | DateTime? | Não | | Data do cálculo |
| createdAt | DateTime | Sim | auto | |
| updatedAt | DateTime | Sim | auto | |

**Restrições:** @@unique([studentId, classId, subjectId, termId]) — 1 resultado por aluno/turma/disciplina/período.

## 5. Fórmulas e Regras

### Média Ponderada
```
notaFinal = Σ(nota × peso) / Σ(pesos)
```
Fallback: média aritmética se Σ(pesos) = 0.

### Estados do Resultado
- **APPROVED**: média ≥ 10
- **RECOVERY**: 8 ≤ média < 10
- **FAILED**: média < 8
- **IN_PROGRESS**: existem avaliações sem notas lançadas
- **PENDING**: sem avaliações cadastradas

### Regras de Bloqueio
1. Avaliação não pode ser eliminada se tiver notas lançadas
2. Peso e maxScore são imutáveis após existirem notas
3. Nota deve estar no intervalo [0, maxScore]
4. Horários não podem conflitar (professor, turma ou sala no mesmo período)
