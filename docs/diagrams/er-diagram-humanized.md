# Diagrama ER Humanizado — Módulo G3 (Avaliações e Horários)

Desenhado com caixas simples em preto e branco, como seria feito em papel, Excalidraw ou draw.io.
Campos reais extraídos de `prisma/schema.prisma`. Cardinalidades explícitas (1:N).

---

## Entidades principais do módulo

```
┌────────────────────────────────────┐
│            ASSESSMENT              │
├────────────────────────────────────┤
│ PK  id                 uuid        │
│     schoolId           uuid   FK   │
│     academicYearId     uuid   FK   │
│     termId             uuid   FK   │
│     classId            uuid   FK   │
│     subjectId          uuid   FK   │
│     teacherId          uuid   FK   │
│     name               string      │
│     type               enum        │  TEST | EXAM
│     description        string?     │
│     date               datetime    │
│     maxScore           decimal     │  > 0  (default 20)
│     weight             decimal     │  > 0  (default 1)
│     status             enum        │  DRAFT|SCHEDULED|OPEN|CLOSED|CANCELLED
│     createdAt          datetime    │
│     updatedAt          datetime    │
├────────────────────────────────────┤
│ UQ (termId, classId, subjectId,    │
│     name)                          │
└────────────────────────────────────┘
```

```
┌────────────────────────────────────┐
│              GRADE                 │
├────────────────────────────────────┤
│ PK  id                 uuid        │
│     assessmentId       uuid   FK   │
│     studentId          uuid   FK   │
│     score              decimal     │  [0, maxScore]
│     comment            string?     │
│     status             enum        │  SUBMITTED|APPROVED|REVISED
│     createdAt          datetime    │
│     updatedAt          datetime    │
├────────────────────────────────────┤
│ UQ (assessmentId, studentId)       │  1 nota por aluno por avaliação
└────────────────────────────────────┘
```

```
┌────────────────────────────────────┐
│             SCHEDULE               │
├────────────────────────────────────┤
│ PK  id                 uuid        │
│     schoolId           uuid   FK   │
│     academicYearId     uuid   FK   │
│     termId             uuid   FK   │
│     classId            uuid   FK   │
│     subjectId          uuid   FK   │
│     teacherId          uuid   FK   │
│     dayOfWeek          enum        │  MONDAY..SATURDAY
│     startTime          string      │  HH:mm
│     endTime            string      │  HH:mm (start < end)
│     room               string?     │
│     status             enum        │  ACTIVE|INACTIVE|CANCELLED
│     createdAt          datetime    │
│     updatedAt          datetime    │
└────────────────────────────────────┘
```

```
┌────────────────────────────────────┐
│              RESULT                │
├────────────────────────────────────┤
│ PK  id                 uuid        │
│     schoolId           uuid   FK   │
│     academicYearId     uuid   FK   │
│     termId             uuid   FK   │
│     classId            uuid   FK   │
│     subjectId          uuid   FK   │
│     studentId          uuid   FK   │
│     teacherId          uuid?  FK   │
│     average            decimal?    │  média ponderada
│     finalScore         decimal?    │
│     weightedTotal      decimal?    │
│     calculationMethod  enum?       │  ARITHMETIC_MEAN | WEIGHTED_PERCENTAGE | ...
│     status             enum        │  APPROVED|RECOVERY|FAILED|PENDING|IN_PROGRESS
│     calculatedAt       datetime?   │
│     createdAt          datetime    │
│     updatedAt          datetime    │
├────────────────────────────────────┤
│ UQ (studentId, classId, subjectId, │
│     termId)                        │  1 resultado por aluno/contexto
└────────────────────────────────────┘
```

---

## Relações principais (módulo G3)

```
            1                N
ASSESSMENT ─────────────►  GRADE
            1                N
ASSESSMENT ─────────────►  RESULT   (deriva das notas)

GRADE (N) ─────────────►  RESULT   (as notas alimentam o resultado)
```

```
┌──────────────────┐         1                    N  ┌──────────────────┐
│    ASSESSMENT    │ ───────────────────────────────►│      GRADE       │
│   PK id          │          (uma avaliação         │  PK id           │
│   ...            │          tem várias notas)      │  FK assessmentId │
└──────────────────┘                                 │  FK studentId    │
                                                      │  score           │
                                                      └──────────────────┘
```

```
┌──────────────────┐         1                    N  ┌──────────────────┐
│      RESULT      │ ◄───────────────────────────────│      GRADE       │
│  PK id           │  (o resultado deriva            │  FK assessmentId │
│  FK studentId    │   das notas do aluno)           │  FK studentId    │
│  average         │                                 └──────────────────┘
│  status          │
└──────────────────┘
```

---

## Contexto académico (entidades reutilizadas — NÃO duplicadas)

O módulo G3 **reutiliza** as entidades académicas já existentes (`School`, `AcademicYear`,
`Term`, `Class`, `Subject`, `Student`, `Teacher`, `Enrollment`). Não as recria.

```
SCHOOL 1 ────► N ACADEMIC_YEAR
SCHOOL 1 ────► N TERM              ACADEMIC_YEAR 1 ────► N TERM
SCHOOL 1 ────► N CLASS             ACADEMIC_YEAR 1 ────► N CLASS
SCHOOL 1 ────► N SUBJECT
SCHOOL 1 ────► N STUDENT
SCHOOL 1 ────► N TEACHER
SCHOOL 1 ────► N ENROLLMENT
TERM  1 ────► N ENROLLMENT         CLASS 1 ────► N ENROLLMENT
SUBJECT 1 ───► N ENROLLMENT        STUDENT 1 ───► N ENROLLMENT
```

### Como as entidades G3 se ligam ao contexto

```
TERM     1 ────► N ASSESSMENT      CLASS    1 ────► N ASSESSMENT
SUBJECT  1 ────► N ASSESSMENT      TEACHER  1 ────► N ASSESSMENT

TERM     1 ────► N SCHEDULE        CLASS    1 ────► N SCHEDULE
SUBJECT  1 ────► N SCHEDULE        TEACHER  1 ────► N SCHEDULE

TERM     1 ────► N RESULT          CLASS    1 ────► N RESULT
SUBJECT  1 ────► N RESULT          STUDENT  1 ────► N RESULT

STUDENT  1 ────► N GRADE           ASSESSMENT 1 ────► N GRADE
```

---

## Leitura do diagrama (resumo)

1. **Assessment 1:N Grade** — uma avaliação tem várias notas (uma por aluno — constraint `@@unique([assessmentId, studentId])`).
2. **Assessment 1:N Result (indirecto)** — os resultados da turma/disciplina/período são recalculados a partir de **todas** as avaliações do contexto.
3. **Grade N:1 Result** — cada nota contribui para o resultado do aluno.
4. **Schedule** — agenda do professor/turma/sala por dia e intervalo; conflitos → 409.

Todas as entidades do módulo pertencem a uma **School** e a um **AcademicYear** (contexto académico).

## Validação com dbdiagram.io

O modelo relacional foi conferido com a especificação DBML em `docs/diagrams/er-diagram.dbml` —
equivalente textual do `prisma/schema.prisma`.

Se preferir redesenhar à mão, use a versão editável `docs/diagrams/er-diagram.drawio`
(draw.io) ou recrie em Excalidraw usando as caixas acima como referência.