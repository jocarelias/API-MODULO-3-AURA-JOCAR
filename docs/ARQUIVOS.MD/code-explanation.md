# Explicação do Código — Módulo G3 (Avaliações e Horários)

Explicação pedagógica, parte a parte, dos ficheiros principais do módulo.
As numerações referem-se às linhas actuais (consulte o ficheiro correspondente).

---

## 1. `src/modules/schedules-assessments/domain/evaluation.ts`

**Papel:** regras puras do domínio. Não importa Prisma nem Express — apenas define constantes,
tipos e funções de validação/cálculo puras (mesmo input → mesmo output).

### Constantes e tipos

```
1  export type EvaluationType = 'TESTE' | 'EXAME_NORMAL' | 'EXAME_RECURRENCIA';
3  export const EVALUATION_TYPES: EvaluationType[] = ['TESTE', 'EXAME_NORMAL', 'EXAME_RECURRENCIA'];
```

- `EvaluationType` é o tipo *da API* (em português). No banco guardamos `TEST`/`EXAM` (compacto),
  e o service converte com o `TYPE_MAP` (ver secção 3).
- `EVALUATION_TYPES` serve para validar com Zod e para iterar.

```
5  export const EVALUATION_DEFAULT_MAX_SCORE = 20;
6  export const EVALUATION_MIN_SCORE = 0;
8  export const PASSING_SCORE = 10;
9  export const RECOVERY_SCORE = 8;
```

- São os cortes da escala académica 0–20: aprovação a partir de 10; recuperação de 8.
  Concentrados aqui para nunca divergirem do DONDE se decide o status.

### `round2(value)`

```
11  export function round2(value: number): number {
12    return Math.round((value + Number.EPSILON) * 100) / 100;
13  }
```

- Arredonda a 2 casas. `Number.EPSILON` corrige casos como `1.005` que arredondaria
  erroneamente para 1.00 sem ele. É a função usada na média ponderada das notas.

### `validateWeight(weight)`

```
27  if (typeof weight !== 'number' || Number.isNaN(weight)) {
28    return { valid: false, error: 'Peso deve ser um número' };
29  }
31  if (weight <= EVALUATION_MIN_WEIGHT) {
32    return { valid: false, error: `Peso deve ser maior que ${EVALUATION_MIN_WEIGHT}` };
33  }
```

- Regra de negócio: **peso tem de ser > 0**. Devolve um *discriminador* `{ valid: true | false }`
  em vez de lançar excepção — o service decide o que fazer (lançar `DomainError` 400).

### `validateScore(score, maxScore)`

- Nota não pode ser negativa nem ultrapassar `maxScore` (a nota máxima da avaliação).
  Este mesmo intervalo é validado em três camadas: Zod, domínio e CHECK no PostgreSQL.

### `weightedAverage(grades)`

```
54  export function weightedAverage(grades: GradeInput[]): number | null {
57    const totalWeight = grades.reduce((acc, g) => acc + g.weight, 0);
58    const weightedSum  = grades.reduce((acc, g) => acc + g.score * g.weight, 0);
61    if (totalWeight <= 0) {
62      const sum = grades.reduce((acc, g) => acc + g.score, 0);
63      return round2(sum / grades.length);
64    }
65    return round2(weightedSum / totalWeight);
67  }
```

- **Média ponderada:** `Σ(nota × peso) / Σ(pesos)`.
- Fallback: se a soma dos pesos for 0 (ou negativa), usa média aritmética simples.
- Devolve `null` quando a lista está vazia — sinal de que ainda não há notas.

### `resolveResultStatus(...)`

```
79  if (gradedCount === 0 && missingCount === 0) return 'PENDING';
83  if (missingCount > 0) return 'IN_PROGRESS';
89  if (average >= PASSING_SCORE) return 'APPROVED';
91  if (average >= RECOVERY_SCORE) return 'RECOVERY';
93  return 'FAILED';
```

- **PENDING:** não há avaliações nem notas no contexto.
- **IN_PROGRESS:** já existem notas, mas faltam notas para outras avaliações.
- **APPROVED/RECOVERY/FAILED:** conforme a média face aos cortes 10 e 8.

### `validateTimeRange(startTime, endTime)`

- Valida o formato `HH:MM` (regex `TIME_PATTERN`) e que `start < end`.
  É a fundação da regra de horários (um dia de aula não pode terminar antes de começar).

---

## 2. `src/modules/schedules-assessments/domain/evaluation.test.ts`

Testa cada função pura **sem tocar no banco**:

- tipos válidos/inválidos;
- peso 0/negativo rejeitado, peso positivo aceite;
- nota fora do intervalo rejeitada;
- `weightedAverage` com pesos iguais (média aritmética), pesos diferentes, lista vazia;
- `resolveResultStatus` em todos os estados;
- `validateTimeRange` com hora invertida.

Total: **21 testes**. Permite confiar nas regras sem depender de PostgreSQL.

---

## 3. `src/modules/schedules-assessments/application/schedulesAssessmentsService.ts`

**Papel:** casos de uso (orquestrar). Cada método liga HTTP/entrada ao domínio e à persistência.

### Imports principais

- `@prisma/client` — tipos do banco (`Prisma`, `PrismaClient`, enums).
- `../domain/evaluation` — funções puras (validações, média, status).
- `../domain/calculationEngine` — motor de cálculo `calculate(...)`.
- `@smartcampus/shared-types` — DTOs de saída (`assessmentDto`, `scheduleDto`, ...).

### `TYPE_MAP`

```
36  export const TYPE_MAP: Record<string, string> = {
37    TESTE: 'TEST',
38    EXAME_NORMAL: 'EXAM',
39    EXAME_RECURRENCIA: 'EXAM',
40  };
```

- Converte o tipo da API (`TESTE`) no valor guardado no banco (`TEST`).
- `EXAME_NORMAL` e `EXAME_RECURRENCIA` partilham o mesmo valor DB `EXAM`.

### `DomainError`

```
42  export class DomainError extends Error {
48    this.httpStatus = ({ NOT_FOUND: 404, CONFLICT: 409, VALIDATION_ERROR: 400, BAD_REQUEST: 400 })[code] ?? 400;
```

- Erro de domínio com `code` e `details`. O `httpError.ts` lê `httpStatus` e produz o envelope HTTP.
- Concentra o mapeamento código → status HTTP num único sítio.

### `assertRelation(value, message)`

```
75  function assertRelation<T>(value, message): asserts value is T {
77    if (value === null || value === undefined) throw new DomainError('NOT_FOUND', message);
```

- Helper de TypeScript: garante que uma entidade consultada existe, senão lança 404.

### `createAssessment(input)` — passo a passo

1. `withValidAssessmentType(input.type)` — valida o tipo e converte para DB.
2. `validateWeight(input.weight)` — peso > 0.
3. Busca **em paralelo** (`Promise.all`) termo, turma, disciplina, professor e ano letivo — evita N consultas sequenciais.
4. `assertRelation(...)` a cada — se faltar algum, 404.
5. Confere que termo/turma/ano letivo pertencem **ao mesmo ano lectivo** (regra de contexto) → 409.
6. Procura avaliação duplicada `(termId, classId, subjectId, name)` → 409.
7. Confere que o professor lecciona a disciplina na turma (pelo horário/avaliações existentes) → 409.
8. `prisma.assessment.create(...)` — persiste.

### `createGrade(assessmentId, input)` — a operação ACID

```
409  const created = await this.prisma.$transaction(async (tx) => {
411    const row = await tx.grade.create({ data: { ... } });
418    await this._recalculateInTx(tx, { classId, subjectId, termId, ... }, [input.studentId]);
422    return row;
423  });
```

- **Nota + recálculo do resultado na MESMA transacção.** Se o recálculo falhar, a nota não fica gravada (rollback).
- Antes disto valida: avaliação existe (404), está `OPEN` (409), nota dentro de `[0, maxScore]` (400),
  aluno matriculado na turma **e** disciplina (400), sem nota duplicada `(assessmentId, studentId)` (409).

### `_recalculateInTx(tx, assessment, studentIds)`

1. Busca todas as avaliações da turma/disciplina/período com as notas (`include: { grades: true }`).
2. Se não houver avaliações, sai (nada a recalcular).
3. Obtém os alunos (recebidos ou via `enrollment` ACTIVE).
4. Para cada aluno: agrupa notas existentes (`{score, weight}`), conta as que faltam (`missing`),
   calcula `weightedAverage` e `resolveResultStatus`.
5. `tx.result.upsert` — cria ou actualiza o resultado do aluno (`studentId+classId+subjectId+termId`),
   gravando média, resultado final, método (`WEIGHTED_PERCENTAGE`) e status.

É aqui que se prova a atomicidade: se o `.upsert` falhar, toda a transacção reverte.

### `findConflicts(input, existing)` — regra de horário

```
550  for (const s of active) {
551    const overlaps = input.startTime < s.endTime && s.startTime < input.endTime;
553    if (input.teacherId === s.teacherId)  → conflito TEACHER
556    if (input.classId === s.classId)      → conflito CLASS
559    if (input.room && input.room === s.room) → conflito ROOM
```

- Dois intervalos sobrepõem-se se `início_A < fim_B && início_B < fim_A`.
- Cada sobreposição pode gerar até 3 conflitos (professor, turma, sala), com `details` descritivos.

### `createResults(input)` e `patchResult(id)`

- `POST /results` recalcula a turma/disciplina/período inteira e devolve os resultados.
- `PATCH /results/:id` recalcula **um** resultado (todos os que dependem desse aluno/contexto).
- Ambos usam `$transaction` → atomicidade.

### `calculateResult(input)` — motor flexível

- Recolhe todos os `assessmentId` (incluindo componentes aninhados) e confirma que existem (404 se não).
- Delega no `calculationEngine.calculate(...)` e mapeia `CalculationError` para `DomainError` com o status correcto (400/409).

---

## 4. `src/modules/schedules-assessments/http/schedulesAssessmentsRouter.ts`

**Papel:** transporte HTTP. Rotas curtas — sem regras de negócio extensas.

- `handler(callback)` — wrapper try/catch que chama o service e passa o erro a `toHttpError`.
- `validate(schema, value)` — `safeParse` do Zod; se falhar, lança `DomainError('VALIDATION_ERROR', ..., details)` com os issues mapeados (`field` + `message`) → 400.
- `correlationId` — middleware define `req.correlationId` a partir de `x-request-id` ou `randomUUID()` e ecoa no header.
- `success(res, data, status, correlationId, pagination?)` — envelope `{ data, meta: { correlationId, [page/pageSize/total] } }`.
- Rotas seguem o padrão:

```
router.get('/assessments',  handler(async (req, res) => {
  const query = validate(assessmentQuerySchema, req.query);
  const data  = await service.listAssessments(query);
  const { rows, meta } = paginate(data, query);
  return success(res, rows, 200, req.correlationId, meta);
}));
```

Cada parametro de URL é validado (`idParamsSchema`, `assessmentIdParamsSchema`, ...) antes de chegar ao service — IDs não-UUID são rejeitados com 400.

---

## 5. `src/modules/schedules-assessments/schemas/index.ts`

**Papel:** fonte única de validação Zod. Re-exportada pelo `@smartcampus/validation`.

- `uuidSchema` — `z.string().uuid('ID inválido (deve ser um UUID)')`.
- `pageSchema` / `pageSizeSchema` — paginação com limites (page ≥ 1, pageSize 1–100).
- `createAssessmentSchema` — `.object({...}).strict()`:
  - UUIDs obrigatórios (`termId`, `academicYearId`, `classId`, `subjectId`, `teacherId`);
  - `type` enum de `EVALUATION_TYPES`;
  - `date` no formato ISO-8601 com offset;
  - `maxScore` > 0 (default 20), `weight` > 0 (default 1).
- `createScheduleSchema` — dia da semana (enum), horas `HH:mm` via `TIME_PATTERN`, sala opcional.
- `createResultSchema` — turma/disciplina/período obrigatórias + `studentIds[]` opcionais.
- Schemas de **update** — todos os campos ficam `.optional()` (PATCH parcial).
- `calculationInputSchema` — superRefine para regras cruzadas:
  - `items` não pode ser vazio para métodos que não são `COMPONENT_BASED`;
  - `minScore < maxScore`;
  - `CUSTOM_WEIGHTED` exige `formula`;
  - `COMPONENT_BASED` exige `components`.

Separação schema/controller (pergunta 3 da reflexão): a validação é testável e reutilizável, e o router fica só com roteamento.

---

## 6. `src/app.ts` — arranque Express

```
16  app.use(express.json({ limit: '1mb' }));
18  app.use((req, res, next) => { req.correlationId = req.get('x-request-id') || randomUUID(); res.setHeader('x-request-id', req.correlationId); next(); });
28  app.use('/api/v1', createSchedulesAssessmentsRouter());
30  app.get('/api/docs', ...)          → Swagger UI local
50  app.get('/api/openapi.json', ...)  → spec runtime (buildOpenApi())
54  404 catch-all → envelope de erro
59  error middleware → toHttpError
```

- O `correlationId` global é atribuído a **todos** os pedidos no início do pipeline.
- Erros lançados em qualquer middleware caem no handler final → envelope `{code, message, details, correlationId}`.

---

## 7. `packages/shared-types/src/index.ts` — DTOs

- `assessmentDto(record)` — converte a linha do Prisma num objecto **apenas com campos da API**.
- `apiAssessmentType(dbType)` — reverse map `TEST → TESTE`, `EXAM → EXAME_NORMAL`.
- `toNumber(value)` — converte `Decimal` do Prisma para `number | null`.
- `toIso(value)` — normaliza datas para ISO-8601.
- `campusModules.G3_AVALIACOES_HORARIOS` — metadados do módulo (basePath, recursos, `open: true`).

**Porquê DTOs:** o cliente não deve ver `Decimal`/`Date` do driver — recebe primitivos JSON limpos. Também centraliza o mapeamento de tipos API↔DB.

---

## 8. `packages/api-client/src/index.ts` — cliente tipado

- `SmartCampusApiClient` com `request<T>(method, path, body, query)` baseado em `fetch` (Node 24), timeout via `AbortController`.
- `get/post/patch/delete<T>` genéricos.
- Métodos do domínio: `listAssessments`, `createAssessment`, `createGrade`, `listSchedules`, `createResults`, `patchResult`, `printClassPauta`, `calculate`, `deleteResult`, etc.
- Erros da API viram `ApiError` com `status`, `code`, `details`, `correlationId` — o consumidor sabe tratar 400/404/409 sem depender de HTTP puro.

---

## 9. `prisma/schema.prisma` — resumo

- **Assessment** (`@@map("assessments")`): FKs para School/AcademicYear/Term/Class/Subject/Teacher; `@@unique([termId, classId, subjectId, name])`.
- **Grade** (`@@map("grades")`): `@@unique([assessmentId, studentId])` — 1 nota por aluno/avaliação.
- **Schedule** (`@@map("schedules")`): índices compostos para conflitos (teacher/class/room + dayOfWeek).
- **Result** (`@@map("results")`): `@@unique([studentId, classId, subjectId, termId])`, `calculationMethod` enum.
- **Enums** DB alinhados com Zod/DTOs (ver `docs/entity-model.md`).

---

## 10. Fluxos ilustrativos

### Lançar nota (ACID)

```
POST /assessments/:id/grades { studentId, score }
   → Zod (400) → service.createGrade (404/409/400)
   → $transaction {
        tx.grade.create(...)
        _recalculateInTx(tx, ...) → tx.result.upsert(...)
     }
   → commit (ou rollback total se algo falhar)
```

### Imprimir pauta

```
GET /print/class/:classId/pauta?subjectId=&termId=
   → service.getPrintClassPauta
   → para cada aluno: avaliações + notas → weightedAverage + resolveResultStatus →
     linhas { studentId, studentName, average, status, evaluations }
```

Detalhe: o pauta **recalcula na hora** a média e o status — não depende dos registos `results` estarem actualizados.