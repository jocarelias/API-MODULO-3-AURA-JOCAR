# G3 — Avaliacoes e Horarios Type

Respostas consolidadas da ficha de exercicios — todo o codigo, dados e resultados sao reais, obtidos por execucao directa do projecto.

---

## Exercicio 1 — Diagrama Entidade-Relacao

### O modulo G3 e constituido pelas entidades

1. **Assessment** (avaliacao)
2. **Grade** (nota)
3. **Schedule** (horario)
4. **Result** (resultado)

O diagrama foi gerado a partir do `prisma/schema.prisma` real do projecto.

**Ficheiros criados:**
- `docs/diagrams/er-diagram.svg`
- `docs/diagrams/er-diagram.png`
- `docs/diagrams/er-diagram.pdf`
- `docs/entity-model.md`

### Diagrama ER

Ver: [`docs/diagrams/er-diagram.svg`](diagrams/er-diagram.svg) / [`er-diagram.pdf`](diagrams/er-diagram.pdf) / [`er-diagram.png`](diagrams/er-diagram.png)

### Tabela de entidades

| Entidade | Finalidade | PK | Principais FK | Mapa Tabela |
|----------|------------|----|---------------|-------------|
| Assessment | Avaliacao academica (teste/exame) | id (UUID) | termId, classId, subjectId, teacherId, schoolId, academicYearId | assessments |
| Grade | Nota de um aluno numa avaliacao | id (UUID) | assessmentId, studentId | grades |
| Schedule | Horario de aula | id (UUID) | termId, classId, subjectId, teacherId, schoolId, academicYearId | schedules |
| Result | Resultado agregado do aluno por disciplina/periodo | id (UUID) | studentId, classId, subjectId, termId, schoolId, academicYearId | results |

### Relacoes

```
Assessment ──1:N──> Grade
Grade ──N:1──> Assessment (via assessmentId)
Grade ──N:1──> Student (via studentId)

Schedule ── referencia Term, Class, Subject, Teacher (FK directas)
Assessment ── referencia Term, Class, Subject, Teacher (FK directas)
Result ── referencia Term, Class, Subject, Student, Teacher (FK directas)
```

### Relacoes detalhadas

- **Assessment → School** (1:N) — cada avaliacao pertence a uma escola
- **Assessment → AcademicYear** (1:N) — pertence a um ano letivo
- **Assessment → Term** (1:N) — pertence a um periodo
- **Assessment → Class** (1:N) — e para uma turma especifica
- **Assessment → Subject** (1:N) — e de uma disciplina
- **Assessment → Teacher** (1:N) — avaliada por um professor
- **Assessment → Grade** (1:N) — uma avaliacao tem multiplas notas
- **Grade → Student** (N:1) — cada nota pertence a um aluno
- **Schedule → Teacher** (1:N) — horarios associados a um professor
- **Schedule → Class** (1:N) — horarios de uma turma
- **Result → Student** (N:1) — resultados por aluno

### Constraints relevantes

- `@@unique([assessmentId, studentId])` em Grade — 1 nota por aluno por avaliacao
- `@@unique([studentId, classId, subjectId, termId])` em Result — 1 resultado por aluno/turma/disciplina/periodo
- CHECK `weight > 0` em assessments
- CHECK `maxScore > 0` em assessments
- CHECK `score >= 0 AND score <= 100` em grades
- CHECK `startTime < endTime` em schedules
- CHECK `average >= 0 AND average <= 100 OR average IS NULL` em results

### Justificacao do modelo

O modelo segue o Padrao Academico Multi-Tenant: todas as entidades referenciam `schoolId`. As entidades Assessment, Grade, Schedule e Result constituem o nucleo do modulo G3, enquanto Student, Teacher, Subject, Class, Term e AcademicYear sao modelos compartilhados com outros modulos da plataforma SmartCampus. A separacao e clara: Assessment e a avaliacao (o que se avalia), Grade e a nota individual (nota do aluno na avaliacao), Schedule e o horario (quando a aula acontece), Result e o resultado agregado (media e status do aluno na disciplina/periodo).

---

## Exercicio 2 — Prisma e Migration

### Schema Prisma (bloco G3)

```prisma
// ENUMS do modulo G3
enum EvaluationType {
  TEST
  EXAM
  ASSIGNMENT
  QUIZ
  PROJECT
  PRACTICAL
  ORAL
  OTHER
}

enum EvaluationStatus {
  DRAFT
  SCHEDULED
  OPEN
  CLOSED
  CANCELLED
}

enum GradeStatus {
  SUBMITTED
  APPROVED
  REVISED
}

enum ScheduleStatus {
  ACTIVE
  INACTIVE
  CANCELLED
}

enum DayOfWeek {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
}

enum ResultStatus {
  APPROVED
  FAILED
  RECOVERY
  PENDING
  IN_PROGRESS
}

// MODELOS do modulo G3
model Assessment {
  id             String           @id @default(uuid())
  schoolId       String
  academicYearId String
  termId         String
  classId        String
  subjectId      String
  teacherId      String
  name           String
  type           EvaluationType
  description    String?
  date           DateTime
  maxScore       Decimal          @default(20) @db.Decimal(5, 2)
  weight         Decimal          @default(1) @db.Decimal(5, 3)
  status         EvaluationStatus @default(DRAFT)
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  school       School       @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  academicYear AcademicYear @relation(fields: [academicYearId], references: [id], onDelete: Cascade)
  term         Term         @relation(fields: [termId], references: [id], onDelete: Cascade)
  class        Class        @relation(fields: [classId], references: [id], onDelete: Cascade)
  subject      Subject      @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  teacher      Teacher      @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  grades       Grade[]

  @@index([schoolId])
  @@index([academicYearId])
  @@index([termId])
  @@index([classId])
  @@index([subjectId])
  @@index([teacherId])
  @@index([date])
  @@index([status])
  @@index([schoolId, classId])
  @@index([schoolId, subjectId])
  @@index([schoolId, teacherId])
  @@map("assessments")
}

model Grade {
  id           String      @id @default(uuid())
  assessmentId String
  studentId    String
  score        Decimal     @db.Decimal(5, 2)
  comment      String?
  status       GradeStatus @default(SUBMITTED)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  assessment Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  student    Student    @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([assessmentId, studentId])
  @@index([assessmentId])
  @@index([studentId])
  @@map("grades")
}

model Schedule {
  id             String         @id @default(uuid())
  schoolId       String
  academicYearId String
  termId         String
  classId        String
  subjectId      String
  teacherId      String
  dayOfWeek      DayOfWeek
  startTime      String
  endTime        String
  room           String?
  status         ScheduleStatus @default(ACTIVE)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  school       School       @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  academicYear AcademicYear @relation(fields: [academicYearId], references: [id], onDelete: Cascade)
  term         Term         @relation(fields: [termId], references: [id], onDelete: Cascade)
  class        Class        @relation(fields: [classId], references: [id], onDelete: Cascade)
  subject      Subject      @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  teacher      Teacher      @relation(fields: [teacherId], references: [id], onDelete: Cascade)

  @@index([schoolId])
  @@index([academicYearId])
  @@index([termId])
  @@index([classId])
  @@index([subjectId])
  @@index([teacherId])
  @@index([dayOfWeek])
  @@index([schoolId, teacherId, dayOfWeek])
  @@index([schoolId, classId, dayOfWeek])
  @@index([schoolId, room, dayOfWeek])
  @@map("schedules")
}

model Result {
  id             String       @id @default(uuid())
  schoolId       String
  academicYearId String
  termId         String
  classId        String
  subjectId      String
  studentId      String
  teacherId      String?
  average        Decimal?     @db.Decimal(5, 2)
  finalScore     Decimal?     @db.Decimal(5, 2)
  weightedTotal  Decimal?     @db.Decimal(5, 2)
  status         ResultStatus @default(PENDING)
  calculatedAt   DateTime?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  school       School       @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  academicYear AcademicYear @relation(fields: [academicYearId], references: [id], onDelete: Cascade)
  term         Term         @relation(fields: [termId], references: [id], onDelete: Cascade)
  class        Class        @relation(fields: [classId], references: [id], onDelete: Cascade)
  subject      Subject      @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  student      Student      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  teacher      Teacher?     @relation(fields: [teacherId], references: [id], onDelete: SetNull)

  @@unique([studentId, classId, subjectId, termId])
  @@index([schoolId])
  @@index([studentId])
  @@index([classId])
  @@index([subjectId])
  @@index([termId])
  @@index([academicYearId])
  @@map("results")
}
```

Ficheiro: `prisma/schema.prisma` (linhas 375-515)

### Migration

**Nome:** `20260909000000_add_schedules_assessments`

**Data:** 09/09/2026

**Migration SQL (relevante):**

```sql
-- 1) Renomeacao das tabelas existentes
ALTER TABLE "evaluations" RENAME TO "assessments";
ALTER TABLE "evaluation_grades" RENAME TO "grades";
ALTER TABLE "grades" RENAME COLUMN "evaluationId" TO "assessmentId";

-- 2) Renomeacao de constraints
ALTER TABLE "assessments" RENAME CONSTRAINT "evaluations_pkey" TO "assessments_pkey";
ALTER TABLE "grades" RENAME CONSTRAINT "evaluation_grades_pkey" TO "grades_pkey";
-- ... (renomeacao de todas as FK e indices)

-- 3) Constraints CHECK de qualidade de dados
ALTER TABLE "assessments"
  ADD CONSTRAINT "check_assessment_weight_positive" CHECK ("weight" > 0),
  ADD CONSTRAINT "check_assessment_max_score_positive" CHECK ("maxScore" > 0);

ALTER TABLE "grades"
  ADD CONSTRAINT "check_grade_score_range" CHECK ("score" >= 0 AND "score" <= 100);

ALTER TABLE "schedules"
  ADD CONSTRAINT "check_schedule_time_range" CHECK ("startTime" < "endTime");

ALTER TABLE "results"
  ADD CONSTRAINT "check_result_average_range" CHECK ("average" IS NULL OR ("average" >= 0 AND "average" <= 100));
```

### Verificacao

**Comando:**
```bash
npx prisma migrate status
```

**Resultado obtido:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "smartcampos", schema "public" at "localhost:5434"

2 migrations found in prisma/migrations

Database schema is up to date!
```

### Prisma Generate

**Comando:**
```bash
npx prisma generate
```

**Resultado obtido:**
```
✔ Generated Prisma Client (v6.19.3) to ./node_modules/@prisma/client in 275ms
```

### Conclusao

A migration `20260909000000_add_schedules_assessments` foi executada com sucesso, preservando todos os dados existentes (operacoes RENAME). A schema Prisma contem os 4 modelos do modulo G3 (Assessment, Grade, Schedule, Result) com as relacoes e constraints CHECK de qualidade de dados implementadas a nivel de PostgreSQL.

---

## Exercicio 3 — Create e Validacao

### 3.1 Create com sucesso

**Endpoint:** `POST /api/v1/assessments`

**Request:**
```http
POST /api/v1/assessments
Content-Type: application/json
```

```json
{
  "termId": "67bf93dc-7803-430c-9e03-0d34e450440f",
  "academicYearId": "b2d77293-e7f2-4619-bac7-60ff266e8bd7",
  "classId": "497ec6cc-2ba3-4777-abed-9f6a86c1dd52",
  "subjectId": "03e61c5c-446f-40c2-99ba-63aca10c6b9c",
  "teacherId": "9dee6e6d-1c29-46c8-ae71-3b4489b3c918",
  "name": "Mini-teste Exercicio 3",
  "type": "TESTE",
  "date": "2026-10-15T10:00:00.000Z",
  "maxScore": 20,
  "weight": 2,
  "status": "OPEN"
}
```

**Response obtida:**
```json
{
  "data": {
    "id": "fddfb6aa-c9b7-4217-8fd8-78c7f8bbacf0",
    "schoolId": "db3d1706-740d-4d88-9470-b7d350e8e36d",
    "academicYearId": "b2d77293-e7f2-4619-bac7-60ff266e8bd7",
    "termId": "67bf93dc-7803-430c-9e03-0d34e450440f",
    "classId": "497ec6cc-2ba3-4777-abed-9f6a86c1dd52",
    "subjectId": "03e61c5c-446f-40c2-99ba-63aca10c6b9c",
    "teacherId": "9dee6e6d-1c29-46c8-ae71-3b4489b3c918",
    "name": "Mini-teste Exercicio 3",
    "type": "TESTE",
    "description": null,
    "date": "2026-10-15T10:00:00.000Z",
    "maxScore": 20,
    "weight": 2,
    "status": "OPEN",
    "createdAt": "2026-09-14T12:00:12.752Z",
    "updatedAt": "2026-09-14T12:00:12.752Z"
  },
  "meta": {
    "correlationId": "63291e5e-7266-40ac-8479-79160c9acec3"
  }
}
```

**Status:** `201 Created`

**Explicacao:** O request contem todos os campos obrigatorios com tipos validos. O tipo `TESTE` e mapeado internamente para `TEST` (via `TYPE_MAP`). A avaliacao e criada com estado `OPEN` e devolvida no formato DTO (`type: "TESTE"` inverso ao DB).

Evidencia: `docs/evidence/crud/create-success.json`

### 3.2 Validacao falhada

**Endpoint:** `POST /api/v1/assessments`

**Payload invalido:**
```json
{
  "name": "",
  "weight": 0
}
```

**Response obtida:**
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Dados invalidos",
  "details": [
    { "field": "termId", "message": "Required" },
    { "field": "academicYearId", "message": "Required" },
    { "field": "classId", "message": "Required" },
    { "field": "subjectId", "message": "Required" },
    { "field": "teacherId", "message": "Required" },
    { "field": "name", "message": "Nome e obrigatorio" },
    { "field": "type", "message": "Tipo de avaliacao invalido" },
    { "field": "date", "message": "Required" }
  ],
  "correlationId": "274a1d11-546d-4ac3-9685-fec41836956f"
}
```

**Status:** `400 Bad Request`

**Segundo teste de validacao (peso zero):**
```json
{
  "termId": "...",
  "weight": 0
}
```
**Response:**
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Dados invalidos",
  "details": [{ "field": "weight", "message": "Peso deve ser maior que 0" }],
  "correlationId": "e75c4f35-7e06-4746-89ea-8b585920de94"
}
```
**Status:** `400`

**Regra de validacao responsavel:** Schema Zod `createAssessmentSchema` em `src/modules/schedules-assessments/schemas/index.ts`. A validacao rejeita pesos <= 0, campos obrigatorios ausentes e tipos invalidos antes de qualquer chamada a base de dados.

**Explicacao:** O Zod intercepta o payload no middleware da router. O `validation-error.json` e gerado pelo campo `details`, que lista todos os campos invalidos com as respectivas mensagens. O campo `correlationId` e gerado automaticamente pelo middleware de identificacao.

Evidencia: `docs/evidence/crud/validation-error.json`, `docs/evidence/crud/validation-error-missing.json`

**Conclusao:** O Zod impede que dados invalidos avancem para a camada de aplicacao/persistencia. A validacao e feita em dois niveis: schemas Zod (camada HTTP) e validacoes de dominio no service (ex.: `validateWeight`, `validateScore`).

---

## Exercicio 4 — Update, Delete e Regra de Negocio

### 4.1 Update bem-sucedido

**Endpoint:** `PATCH /api/v1/assessments/:id`

**Request:**
```http
PATCH /api/v1/assessments/2640f887-f452-4480-8f4c-2771a4a72526
Content-Type: application/json
```

```json
{
  "name": "Atualizado via PATCH",
  "status": "OPEN"
}
```

**Response obtida:**
```json
{
  "data": {
    "id": "2640f887-f452-4480-8f4c-2771a4a72526",
    "schoolId": "db3d1706-740d-4d88-9470-b7d350e8e36d",
    "academicYearId": "b2d77293-e7f2-4619-bac7-60ff266e8bd7",
    "termId": "67bf93dc-7803-430c-9e03-0d34e450440f",
    "classId": "497ec6cc-2ba3-4777-abed-9f6a86c1dd52",
    "subjectId": "03e61c5c-446f-40c2-99ba-63aca10c6b9c",
    "teacherId": "9dee6e6d-1c29-46c8-ae71-3b4489b3c918",
    "name": "Atualizado via PATCH",
    "type": "TESTE",
    "description": null,
    "date": "2026-11-01T10:00:00.000Z",
    "maxScore": 20,
    "weight": 1,
    "status": "OPEN",
    "createdAt": "2026-09-14T12:00:12.930Z",
    "updatedAt": "2026-09-14T12:00:13.014Z"
  },
  "meta": {
    "correlationId": "8b0576ad-70fd-401d-8539-6b919e94f645"
  }
}
```

**Status:** `200 OK`

O PATCH actualiza apenas os campos fornecidos (name e status). O campo `updatedAt` e actualizado automaticamente pelo Prisma.

Evidencia: `docs/evidence/crud/update-success.json`

### 4.2 Delete bem-sucedido

**Endpoint:** `DELETE /api/v1/assessments/:id`

**Request:**
```http
DELETE /api/v1/assessments/31fc4c84-495c-4c33-8b22-fd92176b8365
```

**Response obtida:**
```json
{
  "data": {
    "id": "31fc4c84-495c-4c33-8b22-fd92176b8365",
    "deleted": true
  },
  "meta": {
    "correlationId": "49a61e31-5a40-43f4-a1a5-3fb9cb03c734"
  }
}
```

**Status:** `200 OK`

A avaliacao foi criada sem notas associadas, portanto a eliminacao e permitida. O service verifica o `_count.grades` antes de apagar.

Evidencia: `docs/evidence/crud/delete-success.json`

### 4.3 Operacao bloqueada por regra de negocio

**Operacao:** `DELETE /api/v1/assessments/:id` num avaliacao com notas

**Regra de negocio:** Avaliacoes com notas lancadas nao podem ser eliminadas (integridade referencial logica). Definida em `schedulesAssessmentsService.ts:252-256`:

```typescript
if (assessment._count.grades > 0) {
  throw new DomainError(
    'CONFLICT',
    'Avaliacao nao pode ser eliminada porque ja possui notas lancadas',
  );
}
```

**Request:**
```http
DELETE /api/v1/assessments/f5770ad9-b701-4f2b-8f00-2481fa19d252
```

**Response obtida:**
```json
{
  "code": "CONFLICT",
  "message": "Avaliacao nao pode ser eliminada porque ja possui notas lancadas",
  "details": [],
  "correlationId": "85ce86a1-8a1d-462a-a81d-e331ecf62802"
}
```

**Status:** `409 Conflict`

**Outras regras de negocio demonstradas:**

1. **Avaliacao duplicada (409):**
   - Avaliacao com mesmo `name + termId + classId + subjectId` e rejeitada.
   - Response: `{"code":"CONFLICT","message":"Ja existe uma avaliacao com este nome para esta turma, disciplina e periodo"}`

2. **Peso imutavel apos notas (409):**
   - Alterar `weight` ou `maxScore` de avaliacao com notas lancadas e bloqueado.
   - Response: `{"code":"CONFLICT","message":"Peso e nota maxima nao podem ser alterados apos o lancamento de notas"}`

3. **Conflito de horario (409):**
   - Professor, turma ou sala com sobreposicao de horarios e bloqueado.
   - Response: `{"code":"CONFLICT","message":"Conflito de horario detectado","details":[{"type":"TEACHER","message":"Professor ja possui aula das 14:00 as 15:30"}]}`

Evidencia:
- `docs/evidence/business-rules/delete-blocked.json`
- `docs/evidence/business-rules/duplicate-assessment-409.json`
- `docs/evidence/business-rules/immutable-weight-409.json`
- `docs/evidence/business-rules/schedule-conflict-409.json`

### Justificacao

As regras de negocio sao implementadas a nivel de dominio no `SchedulesAssessmentsService`, usando `DomainError` com `httpStatus` e `code`. O `DomainError` mapeia automaticamente para o status HTTP correcto via `infrastructure/httpError.ts`. O `409 CONFLICT` e utilizado para todas as violacoes de integridade semantica (duplicatas, regras de imutabilidade, conflitos de horarios).

---

## Exercicio 5 — Transacao e Rollback

### 5.1 Codigo da transacao

Ficheiro: `src/modules/schedules-assessments/application/schedulesAssessmentsService.ts` (linhas 384-400)

```typescript
const created = await this.prisma.$transaction(async (tx) => {
  const row = await tx.grade.create({
    data: {
      assessmentId,
      studentId: input.studentId,
      score: input.score,
      comment: input.comment ?? null,
      status: 'SUBMITTED',
    },
  });
  await this._recalculateInTx(
    tx,
    {
      classId: assessment.classId,
      subjectId: assessment.subjectId,
      termId: assessment.termId,
      schoolId: assessment.schoolId,
      academicYearId: assessment.academicYearId,
    },
    [input.studentId],
  );
  return row;
});
```

A operacao `createGrade` usa `prisma.$transaction` para garantir atomicidade entre o INSERT da nota e o recalculo do resultado. Se o recálculo falhar, o INSERT e revertido automaticamente.

### 5.2 Falha forcada

Ficheiro de teste: `src/modules/schedules-assessments/tests/g3.transaction.e2e.test.ts` (linhas 16-83)

```typescript
it('lançar nota + recálculo é atómico: falha no recálculo faz rollback total', async () => {
  const service = new SchedulesAssessmentsService();
  service._recalculateInTx = async () => {
    throw new Error('falha forcada no recalculo');
  };

  await expect(
    service.createGrade(assessment.id, { studentId: enrollment.studentId, score: 15 }),
  ).rejects.toThrow('falha forcada no recalculo');
  // ...
```

A falha e provocada subistituindo `_recalculateInTx` por um stub que lança um `Error`. Isto simula uma falha na camada de persistencia a meio da transacao.

### 5.3 Resultado

**Antes da operacao:**
- Resultado do aluno com media/status existentes na BD.

**Apos a execucao da operacao com falha:**
```typescript
const grade = await prisma.grade.findUnique({
  where: { assessmentId_studentId: { assessmentId, studentId: enrollment.studentId } },
});
expect(grade).toBeNull();  // NOTA NAO FOI CRIADA — ROLLBACK

const resultAfter = await prisma.result.findUnique({ ... });
expect(resultAfter.average.toString()).toBe(resultBefore.average.toString());  // RESULTADO MANTIDO
expect(resultAfter.status).toBe(resultBefore.status);
```

**Estado depois:**
- Grade: **inexistente** (INSERT revertido pelo rollback)
- Result: **inalterado** (UPDATE não executado)

**Evidencia de rollback:**
- O assertion `expect(grade).toBeNull()` prova que o INSERT não permaneceu na BD.
- O assertion `expect(resultAfter.average.toString()).toBe(resultBefore.average.toString())` prova que o resultado não foi alterado.

### Conclusao

A transacao garantiu atomicidade porque, apos a falha provocada no `_recalculateInTx`, a operacao de INSERT da nota (Grade) foi revertida pelo `ROLLBACK` do Prisma `$transaction`. Nao existe estado parcial observavel na base de dados: ou ambas as operacoes (criar nota + recalcular resultado) sao commitadas, ou nenhuma permanece.

Evidencia: `docs/evidence/05-transaction/ACID-EVIDENCE.md`, `src/modules/schedules-assessments/tests/g3.transaction.e2e.test.ts`

---

## Exercicio 6 — Testes Automatizados

### 6.1 Cenário 1 — HTTP 400 (Validation Error)

Ficheiro: `src/modules/schedules-assessments/tests/error-scenarios.e2e.test.ts` (linhas 8-16)

```typescript
it('400 — VALIDATION_ERROR para payload invalido (peso zero)', async () => {
  const res = await request(apiBase)
    .post('/api/v1/assessments')
    .send({ name: 'Cenario 400', type: 'TESTE', weight: 0 });
  expect(res.status).toBe(400);
  expect(res.body.code).toBe('VALIDATION_ERROR');
  expect(Array.isArray(res.body.details)).toBe(true);
  expect(res.body.details[0]).toHaveProperty('field');
  expect(res.body.correlationId).toBeTruthy();
});
```

**Resultado obtido:** PASS (status 400, code VALIDATION_ERROR, details array com field/message)

### 6.2 Cenário 2 — HTTP 404 (Resource Not Found)

Ficheiro: `src/modules/schedules-assessments/tests/error-scenarios.e2e.test.ts` (linhas 18-24)

```typescript
it('404 — NOT_FOUND para recurso inexistente', async () => {
  const res = await request(apiBase).get('/api/v1/assessments/00000000-0000-0000-0000-000000000000');
  expect(res.status).toBe(404);
  expect(res.body.code).toBe('NOT_FOUND');
  expect(res.body.message).toBe('Avaliacao nao encontrada');
  expect(res.body.correlationId).toBeTruthy();
});
```

**Resultado obtido:** PASS (status 404, code NOT_FOUND, correlationId presente)

### 6.3 Cenário 3 — HTTP 500 (Internal Server Error)

Ficheiro: `src/modules/schedules-assessments/tests/error-scenarios.e2e.test.ts` (linhas 26-40)

```typescript
it('500 — INTERNAL_ERROR quando a infraestrutura falha', async () => {
  const countSpy = vi
    .spyOn(prisma.assessment, 'count')
    .mockRejectedValueOnce(new Error('falha simulada do banco de dados'));

  const res = await request(apiBase).post('/api/v1/results').send({
    termId: '67bf93dc-7803-430c-9e03-0d34e450440f',
    classId: '497ec6cc-2ba3-4777-abed-9f6a86c1dd52',
    subjectId: '03e61c5c-446f-40c2-99ba-63aca10c6b9c',
  });

  expect(countSpy).toHaveBeenCalled();
  expect(res.status).toBe(500);
  expect(res.body.code).toBe('INTERNAL_ERROR');
  expect(res.body.message).toBe('Erro interno do servidor');
  expect(res.body.correlationId).toBeTruthy();
  countSpy.mockRestore();
});
```

**Resultado obtido:** PASS (status 500, code INTERNAL_ERROR, prisma.assessment.count chamado)

O cenário de 500 e provocado substituindo `prisma.assessment.count` por um stub que lança um `Error` generico. Isto testa a rota `POST /api/v1/results` (que chama `assessment.count`) e verifica que o `toHttpError` mapeia erros desconhecidos para `500 INTERNAL_ERROR`.

### 6.4 npm test

**Comando:**
```bash
npm test
```

**Saida real:**
```
> g3-avaliacoes-horarios@1.0.0 test
> npm run test:unit && npm run test:e2e

> g3-avaliacoes-horarios@1.0.0 test:unit
> vitest run

 RUN  v3.2.7 /home/Jocarelias/Documents/API HORARIOS

 ✓ src/modules/schedules-assessments/domain/evaluation.test.ts (21 tests) 13ms

 Test Files  1 passed (1)
      Tests  21 passed (21)
   Start at  14:03:28
   Duration  743ms

> g3-avaliacoes-horarios@1.0.0 test:e2e
> vitest run --config vitest.e2e.config.ts

 RUN  v3.2.7 /home/Jocarelias/Documents/API HORARIOS

 ✓ src/modules/schedules-assessments/tests/g3.transaction.e2e.test.ts (2 tests) 393ms
   ✓ falha no recalculo faz rollback total  314ms
 ✓ src/modules/schedules-assessments/tests/error-scenarios.e2e.test.ts (3 tests) 192ms
 ✓ src/modules/schedules-assessments/tests/g3.e2e.test.ts (23 tests) 1275ms

 Test Files  3 passed (3)
      Tests  28 passed (28)
   Start at  14:03:30
   Duration  2.45s
```

**Resultado:** 49 testes passaram (21 unit + 28 e2e). 0 testes falharam.

Evidencia completa: `docs/evidence/tests/npm-test-output.txt`

### Conclusao

Os testes cobrem os 3 cenários de erro obrigatórios (400, 404, 500), mais os cenários de 409 (conflito). Todos os testes executam contra a API real usando Supertest com app Express ephemeral (porta 0) e IDs obtidos dinamicamente da BD via Prisma. A suite completa inclui 21 testes unitários do dominio e 28 testes de integração (e2e + ACID).

---

## Exercicio 7 — Qualidade dos Dados

### 7.1 Constraint / Validacao

**Tipo:** Constraints CHECK a nivel de PostgreSQL + validacoes Zod a nivel de aplicacao.

**Localizacao:**
- Constraints SQL: `prisma/migrations/20260909000000_add_schedules_assessments/migration.sql`
- Validacao Zod: `src/modules/schedules-assessments/schemas/index.ts`
- Validacao dominio: `src/modules/schedules-assessments/domain/evaluation.ts`

**Constraints CHECK verificadas na BD:**
```sql
check_assessment_weight_positive:  CHECK (weight > 0)
check_assessment_max_score_positive: CHECK (maxScore > 0)
check_grade_score_range:  CHECK (score >= 0 AND score <= 100)
check_result_average_range: CHECK (average IS NULL OR (average >= 0 AND average <= 100))
check_schedule_time_range: CHECK (startTime < endTime)
```

**Objectivo:** Garantir integridade dos dados a nivel de persistencia mesmo que a validacao de aplicacao seja contornada.

### 7.2 Registo rejeitado

**Teste 1 — FK inexistente:**

Request:
```http
POST /api/v1/assessments
Content-Type: application/json
```
```json
{
  "termId": "00000000-0000-0000-0000-000000000000",
  "academicYearId": "...",
  "classId": "...",
  "subjectId": "...",
  "teacherId": "...",
  "name": "FK test",
  "type": "TESTE",
  "date": "2026-10-15T10:00:00.000Z",
  "weight": 1
}
```

Response:
```json
{
  "code": "NOT_FOUND",
  "message": "Periodo (termo) nao encontrado",
  "details": [],
  "correlationId": "bbcff0a3-bc3c-4e2a-9fd5-365e8bb531be"
}
```
Status: `404 Not Found`

O `termId` "00000000..." nao existe na BD. O service verifica `term.findUnique` antes de criar a avaliacao e lança `DomainError('NOT_FOUND')`.

**Teste 2 — Tipo de avaliacao invalido:**

Request:
```json
{
  "termId": "...",
  "academicYearId": "...",
  "classId": "...",
  "subjectId": "...",
  "teacherId": "...",
  "name": "Enum test",
  "type": "INVALIDO",
  "date": "2026-10-15T10:00:00.000Z",
  "weight": 1
}
```

Response:
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Dados invalidos",
  "details": [{ "field": "type", "message": "Tipo de avaliacao invalido" }],
  "correlationId": "c2b6e3a3-49e1-4380-b130-f63469b1f468"
}
```
Status: `400 Bad Request`

O Zod valida que `type` e um membro do enum `EVALUATION_TYPES` (`TESTE`, `EXAME_NORMAL`, `EXAME_RECURRENCIA`). O valor `INVALIDO` nao pertence ao enum.

**Estado actual da BD:**
```
   entity    | total
-------------+-------
 assessments |    34
 grades      |   101
 schedules   |    16
 results     |    50
```

Evidencia:
- `docs/evidence/data-quality/fk-not-found.json`
- `docs/evidence/data-quality/invalid-enum.json`
- `docs/evidence/data-quality/check-constraints.txt`
- `docs/evidence/data-quality/counts.txt`

### Explicacao

Os registros invalidos sao rejeitados em tres camadas:

1. **Zod (HTTP):** `createAssessmentSchema` valida tipos, enums, range, formato (UUID, ISO-8601). Rejeita `400 VALIDATION_ERROR`.
2. **Service (Dominio):** `validateWeight`, `validateScore`, `assertRelation`, `withValidAssessmentType` verificam regras adicionais. Rejeita `400/404/409`.
3. **PostgreSQL (BD):** Constraints CHECK garantem integridade dos dados mesmo que a camada de aplicacao seja contornada (e.g., via Prisma Client directo).

### Conclusao

A proteccao de qualidade de dados e implementada em tres niveis: validacao Zod na entrada HTTP, regras de dominio no service, e constraints CHECK no PostgreSQL. Nenhum dado invalido ou inconsistente consegue ser persistido na base de dados.

---

## Estrutura de Pastas

```
src/modules/schedules-assessments/
├── application/
│   └── schedulesAssessmentsService.ts    # Casos de uso, transacoes ACID, DomainError
├── domain/
│   ├── evaluation.ts                     # Regras puras: tipos, media ponderada, status, horas
│   └── evaluation.test.ts                # 21 testes unitarios
├── http/
│   └── schedulesAssessmentsRouter.ts     # Router Express + Zod + correlationId
├── infrastructure/
│   ├── httpError.ts                      # Mapeamento erro -> HTTP (500/400/404/409)
│   └── prisma.ts                         # Singleton PrismaClient
├── schemas/
│   └── index.ts                          # Schemas Zod autoritativos
└── tests/
    ├── g3.e2e.test.ts                    # 23 testes de integracao
    ├── g3.transaction.e2e.test.ts        # 2 testes ACID (rollback forçado)
    └── error-scenarios.e2e.test.ts       # 3 testes: 400, 404, 500
```

**Outros ficheiros relevantes:**
```
packages/
├── shared-types/src/index.ts             # DTOs, constantes, campusModules
├── validation/src/index.ts               # Re-exporta schemas do modulo
└── api-client/src/index.ts               # Cliente HTTP fetch

prisma/
├── schema.prisma                         # Assessment, Grade, Schedule, Result
├── migrations/
│   ├── 20260827075045_init/
│   └── 20260909000000_add_schedules_assessments/
└── seed.ts                               # Dados UCT-JAC (Mocambique)

docs/
├── diagrams/er-diagram.{svg,png,pdf}     # Diagrama ER
├── entity-model.md                       # Modelo de entidades detalhado
├── evidence/                             # Todas as evidencias captadas
├── openapi.yaml                          # Especificacao OpenAPI 3.0
└── G3-exercicios-respostas.md            # Este documento
```

### Responsabilidade das pastas

- **domain/** — Regras fundamentais do dominio (peso > 0, media ponderada, resolucao de status, validacao de tempo). Sem dependencias externas.
- **application/** — Casos de uso e coordinacao (CRUD de avaliacoes, notas, horarios, resultados). Transacoes ACID com `prisma.$transaction`.
- **infrastructure/** — Persistencia (singleton Prisma) e mapeamento de erros para HTTP.
- **http/** — Router Express, validacao Zod, correlationId, enquadramento de respostas.
- **schemas/** — Schemas Zod autoritativos (unica fonte de validacao HTTP).
- **tests/** — Testes de integracao (API real com Supertest) e testes ACID.
- **packages/** — Pacotes compartilhados (DTOs, schemas, api-client).

### Justificacao

A estrutura segue o padrao hexagonal (Ports & Adapters): o `domain/` nao tem dependencias de frameworks, `application/` usa o Prisma como adaptador, `http/` e o adaptador Express. Esta separacao reduz acoplamento entre camadas, facilita testes unitarios (domain sem BD) e testes de integracao (app Express ephemeral).

---

## Conclusao

Todos os 7 exercicios foram executados com evidencia real:

- **Exercicio 1:** Diagrama ER gerado em SVG/PNG/PDF a partir do schema Prisma real.
- **Exercicio 2:** Prisma Client gerado, migration verificada, schema apresentado.
- **Exercicio 3:** Create com sucesso (201) e validacao Zod falhada (400) demonstrados com payloads reais.
- **Exercicio 4:** Update (200), Delete (200) e regras de negocio (409: duplicata, imutabilidade, conflito de horario) executadas.
- **Exercicio 5:** Transacao ACID demonstrada com falha forcada, rollback verificado na BD (grade inexistente, resultado inalterado).
- **Exercicio 6:** 49 testes executados com sucesso (21 unit + 28 e2e): 400, 404, 500, 409 cobertos. Saida real guardada.
- **Exercicio 7:** Constraints CHECK verificadas na BD, registos invalidos rejeitados (FK inexistente, enum invalido).

O modulo G3 esta implementado com TypeScript, Prisma 6, PostgreSQL 16, Express 5, Zod 3, Vitest 3 e Supertest 7, seguindo boas praticas de separacao de responsabilidades, validacao em multiplos niveis e atomicidade de transacoes.
