# CONTRATOS-API — Smart Campos · Módulo G3 (Avaliações e Horários)

Contrato oficial da API REST, derivado de `src/openapi.ts`, schemas Zod (`src/modules/schedules-assessments/schemas/index.ts`) e regras de domínio.

**URL base:** `http://localhost:4100`
**Swagger/OpenAPI:** `http://localhost:4100/api/docs`
**Spec machine-readable:** `GET /api/openapi.json`
**Health:** `GET /api/v1/health` → `{ data: { status: "ok" }, meta: { correlationId } }`

---

## 1. Convenções globais

### 1.1 Envelope de sucesso

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `data` | `any` | Recurso, lista de recursos ou objeto de cálculo |
| `meta.correlationId` | `string` | UUID da requisição (header `x-request-id` ou gerado) |
| `meta.page` | `number` | Opcional — presente em listas paginadas |
| `meta.pageSize` | `number` | Opcional — presente em listas paginadas |
| `meta.total` | `number` | Opcional — total de registos antes da paginação |

```json
{
  "data": { "id": "uuid", "name": "Teste 1" },
  "meta": { "correlationId": "sc-uuid", "page": 1, "pageSize": 100, "total": 50 }
}
```

### 1.2 Envelope de erro

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `code` | `string` | Código do erro (ver §1.3) |
| `message` | `string` | Mensagem legível |
| `details` | `array` | Detalhes por campo (`{ field, message }`) |
| `correlationId` | `string` | UUID da requisição |

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Dados inválidos",
  "details": [{ "field": "weight", "message": "Peso deve ser maior que 0" }],
  "correlationId": "sc-uuid"
}
```

### 1.3 HTTP status e códigos de erro

| HTTP | `code` | Uso |
| --- | --- | --- |
| `200` | — | Sucesso em GET/PATCH/DELETE e cálculos |
| `201` | — | Recurso criado (POST) |
| `400` | `VALIDATION_ERROR` | Falha de validação (Zod ou regra de domínio), fórmula não registada, itens vazios |
| `400` | `BAD_REQUEST` | Requisição malformada |
| `401` | `UNAUTHENTICATED` | Token em falta, inválido ou utilizador inativo (todos os endpoints protegidos) |
| `403` | `FORBIDDEN` | Papel sem permissão (RBAC) |
| `403` | `FINANCIAL_ACCESS_BLOCKED` | Estudante com dívida financeira tenta consultar notas/pauta |
| `404` | `NOT_FOUND` | Recurso não encontrado |
| `404` | `STUDENT_NOT_FOUND` | Utilizador STUDENT sem perfil académico registado na escola |
| `409` | `CONFLICT` | Duplicação, conflito de horário, peso/nota máxima imutável, notas lançadas, pesos incompatíveis |
| `409` | `GRADES_BLOCKED_DUE_TO_DEBT` | Lançamento de nota bloqueado por dívida financeira do aluno |
| `500` | `INTERNAL_ERROR` | Erro interno do servidor |
| `503` | `FINANCIAL_VERIFICATION_UNAVAILABLE` | Serviço financeiro indisponível/localidade — falha fechada (fail-closed) |

> **Autenticação obrigatória** em toda a API (`Authorization: Bearer <JWT>`) com exceção de `POST /api/v1/auth/login` e `GET /api/v1/health`.
> O token é emitido por `POST /api/v1/auth/login` (TTL 3600s). A comunicação do módulo com o serviço financeiro usa uma **credencial de serviço** (`FINANCIAL_SERVICE_TOKEN`), nunca o JWT do aluno.

### 1.4 Identificação da requisição

- Headers `x-correlation-id` ou `x-request-id` (opcionais): se enviados, o `x-correlation-id` tem precedência e é ecoado na resposta como `meta.correlationId` (e no header `x-request-id`).
- Se ausentes, a API gera um UUID; a resposta devolve sempre `meta.correlationId`.
- A chamada aos serviços de contratos (students/teachers/enrolments/finance) propaga ambos os headers.

### 1.5 Paginação

Aplicada às listas (`GET` de listagens e catálogos).

| Query | Tipo | Default | Regra |
| --- | --- | --- | --- |
| `page` | `number` | `1` | `>= 1` (máx. 10000) |
| `pageSize` | `number` | `100` | `1..100` |

### 1.6 Datas e horas

| Formato | Regra |
| --- | --- |
| `date` | ISO-8601 com offset (ex.: `2026-09-18T09:00:00+02:00`) |
| `startTime` / `endTime` | `HH:mm` com `00:00`..`23:59`, e `startTime < endTime` |
| `createdAt` / `updatedAt` / `calculatedAt` | ISO-8601 |

### 1.7 Enum API ↔ DB (tipos de avaliação)

| API (Zod/DTO) | DB (`EvaluationType`) |
| --- | --- |
| `TESTE` | `TEST` |
| `EXAME_NORMAL` | `EXAM` |
| `EXAME_RECURRENCIA` | `EXAM` |

### 1.8 Autenticação e regra financeira (bloqueio de notas)

**Autenticação:** envia `Authorization: Bearer <accessToken>` obtido em `POST /api/v1/auth/login`. Papéis: `SCHOOL_ADMIN`, `TEACHER`, `STUDENT` (e a credencial interna `__SERVICE__` reservada ao serviço financeiro).

**Regra financeira:**
- Estudantes com registo financeiro em dívida (`hasDebt=true`) ficam **bloqueados de consultar notas** (resultados, notas de avaliação e pauta).
- Resposta: `403 FINANCIAL_ACCESS_BLOCKED` — mensagem: *"A consulta das notas está indisponível. Regularize a sua situação financeira."*
- Se o **serviço financeiro estiver indisponível**, a API falha fechado (`fail-closed`): `503 FINANCIAL_VERIFICATION_UNAVAILABLE` — nunca assume que o aluno está regular.
- A verificação é feita por **credencial de serviço** (`FINANCIAL_SERVICE_TOKEN`), não pelo token do aluno.
- `POST /api/v1/assessments/:assessmentId/grades` para aluno endividado → `409 GRADES_BLOCKED_DUE_TO_DEBT`. O staff continua acessível: a pauta mascara a linha do endividado (`debtRestricted: true`, `average: null`).
- O frontend usa `GET /api/v1/me/financial-status` e **não expõe montantes**; devolve apenas `ACTIVE` ou `BLOCKED`.

---

## 2. Avaliações

### GET `/api/v1/assessments`

Lista avaliações.

| Query | Tipo | Opcional |
| --- | --- | --- |
| `termId` | uuid | sim |
| `classId` | uuid | sim |
| `subjectId` | uuid | sim |
| `teacherId` | uuid | sim |
| `page`, `pageSize` | — | sim (§1.5) |

**200:** `{ data: Assessment[], meta }`

### POST `/api/v1/assessments`

Cria uma avaliação.

**Body (todos obrigatórios, exceto os indicados):**

```json
{
  "academicYearId": "uuid",
  "termId": "uuid",
  "classId": "uuid",
  "subjectId": "uuid",
  "teacherId": "uuid",
  "name": "Teste 2 de Matemática",
  "type": "TESTE",
  "description": "opcional (máx. 500)",
  "date": "2026-09-18T09:00:00+02:00",
  "maxScore": 20,
  "weight": 1,
  "status": "DRAFT"
}
```

| Campo | Regra |
| --- | --- |
| `type` | `TESTE` | `EXAME_NORMAL` | `EXAME_RECURRENCIA` |
| `name` | obrigatório, `1..200` |
| `maxScore` | `0 < maxScore <= 100`, default `20` |
| `weight` | `> 0` e `<= 100`, default `1` |
| `status` | opcional: `DRAFT` | `SCHEDULED` | `OPEN` | `CLOSED` | `CANCELLED` |

**Regras de negócio:** período/turma/ano letivo compatíveis; professor deve lecionar a disciplina; não duplicar avaliação com o mesmo `termId + classId + subjectId + name` (409).

**201:** `{ data: Assessment, meta }`

### GET `/api/v1/assessments/:id`

**200:** `{ data: Assessment, meta }` · **404:** `NOT_FOUND`

### PATCH `/api/v1/assessments/:id`

Atualiza avaliação. Body parcial conforme `POST` (campos opcionais).

**Regras:** `weight` e `maxScore` são **imutáveis** após existirem notas lançadas → 409.

**200:** `{ data: Assessment, meta }`

### DELETE `/api/v1/assessments/:id`

**Regras:** bloqueado (409) se a avaliação tiver notas lançadas.

**200:** `{ data: { id, deleted: true }, meta }`

### Esquema `Assessment` (DTO)

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid | |
| `schoolId` | uuid | |
| `academicYearId` / `academicYearName` | uuid / string | nome legível |
| `termId` / `termName` | uuid / string | nome legível |
| `classId` / `className` | uuid / string | nome legível |
| `subjectId` / `subjectName` | uuid / string | nome legível |
| `teacherId` / `teacherName` | uuid / string | nome legível |
| `name` | string | |
| `type` | enum | API: `TESTE` | `EXAME_NORMAL` | `EXAME_RECURRENCIA` |
| `description` | string | nullable |
| `date` | date-time | |
| `maxScore` | number | |
| `weight` | number | |
| `status` | enum | DB: `DRAFT` | `SCHEDULED` | `OPEN` | `CLOSED` | `CANCELLED` |
| `createdAt` / `updatedAt` | date-time | |

---

## 3. Notas

### GET `/api/v1/assessments/:assessmentId/grades`

Lista notas da avaliação. `STUDENT`: apenas se não tiver dívida financeira, senão `403 FINANCIAL_ACCESS_BLOCKED`; serviço financeiro indisponível → `503 FINANCIAL_VERIFICATION_UNAVAILABLE`.

**200:** `{ data: Grade[], meta: { correlationId, page, pageSize, total } }`

### POST `/api/v1/assessments/:assessmentId/grades`

Lança nota a um aluno.

```json
{
  "studentId": "uuid",
  "score": 14.5,
  "comment": "opcional (máx. 500)"
}
```

**Regras:** avaliação deve estar `OPEN` (409); uma nota por aluno/avaliação (duplicado → 409); aluno matriculado na turma+disciplina do período (409); `0 <= score <= maxScore` (400). **Recálculo de resultados em transação atómica (ACID).**

**201:** `{ data: Grade, meta }` · **400/404/409:** envelope de erro

### PATCH `/api/v1/assessments/:assessmentId/grades/:gradeId`

Atualiza nota.

```json
{
  "score": 16,
  "comment": "opcional",
  "status": "SUBMITTED"
}
```

`status` DB: `SUBMITTED` | `APPROVED` | `REVISED`. Regras iguais ao POST. **Transação atómica com recálculo.**

**200:** `{ data: Grade, meta }`

### Esquema `Grade` (DTO)

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid | |
| `assessmentId` / `assessmentName` | uuid / string | nome legível |
| `studentId` / `studentName` | uuid / string | nome legível |
| `score` | number | |
| `comment` | string | nullable |
| `status` | enum | `SUBMITTED` | `APPROVED` | `REVISED` |
| `createdAt` / `updatedAt` | date-time | |

---

## 4. Horários

### GET `/api/v1/schedules`

Lista horários.

| Query | Tipo | Opcional |
| --- | --- | --- |
| `termId` | uuid | sim |
| `classId` | uuid | sim |
| `teacherId` | uuid | sim |
| `studentId` | uuid | sim |
| `page`, `pageSize` | — | sim |

**200:** `{ data: Schedule[], meta }`

### POST `/api/v1/schedules`

Cria horário.

```json
{
  "academicYearId": "uuid",
  "termId": "uuid",
  "classId": "uuid",
  "subjectId": "uuid",
  "teacherId": "uuid",
  "dayOfWeek": "MONDAY",
  "startTime": "07:30",
  "endTime": "09:00",
  "room": "Sala 12",
  "status": "ACTIVE"
}
```

| Campo | Regra |
| --- | --- |
| `dayOfWeek` | `MONDAY`..`SATURDAY` |
| `startTime` / `endTime` | `HH:mm`; `startTime < endTime` |
| `status` | opcional: `ACTIVE` | `INACTIVE` | `CANCELLED` |

**Regras:** conflito de **professor**, **turma** ou **sala** no mesmo dia/período → **409** com `details` (`{ type, message }`).

**201:** `{ data: Schedule, meta }`

### GET `/api/v1/schedules/:id`

**200:** `{ data: Schedule, meta }`

### PATCH `/api/v1/schedules/:id`

Atualiza horário (revalida conflitos). Body parcial conforme `POST`.

**200:** `{ data: Schedule, meta }`

### DELETE `/api/v1/schedules/:id`

Permitido (sem restrições).

**200:** `{ data: { id, deleted: true }, meta }`

### Esquema `Schedule` (DTO)

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid | |
| `schoolId` | uuid | |
| `academicYearId` | uuid | |
| `termId` / `termName` | uuid / string | nome legível |
| `classId` / `className` | uuid / string | nome legível |
| `subjectId` / `subjectName` | uuid / string | nome legível |
| `teacherId` / `teacherName` | uuid / string | nome legível |
| `dayOfWeek` | enum | `MONDAY`..`SATURDAY` |
| `startTime` / `endTime` | string | `HH:mm` |
| `room` | string | nullable |
| `status` | enum | `ACTIVE` | `INACTIVE` | `CANCELLED` |
| `createdAt` / `updatedAt` | date-time | |

---

## 5. Resultados

### GET `/api/v1/results`

Lista resultados académicos.

| Query | Tipo | Opcional |
| --- | --- | --- |
| `termId` | uuid | sim |
| `classId` | uuid | sim |
| `subjectId` | uuid | sim |
| `studentId` | uuid | sim |
| `page`, `pageSize` | — | sim |

**200:** `{ data: Result[], meta }`

### GET `/api/v1/me/financial-status`

Estado financeiro do próprio estudante (para o frontend refletir bloqueio sem expor valores).

**200:** `{ data: { status: "ACTIVE" | "BLOCKED", checkedAt: "ISO-8601" }, meta }` — *sem* `outstandingAmount` nem `hasDebt`.

**Restrições de acesso por papel:**
- `STUDENT`: consulta apenas os **próprios** resultados (`GET /results`, `/results/:id`, `/assessments/:id/grades`, pauta) — **apenas se não tiver dívida**; com dívida → `403 FINANCIAL_ACCESS_BLOCKED`.
- `SCHOOL_ADMIN` / `TEACHER`: vêem resultados e pautas de qualquer estudante (pauta mascara linhas de endividados).
- Utilizador `STUDENT` sem perfil académico na escola → `404 STUDENT_NOT_FOUND`.

### POST `/api/v1/results`

Calcula/atualiza resultados em lote (turma/disciplina/período).

```json
{
  "classId": "uuid",
  "subjectId": "uuid",
  "termId": "uuid",
  "studentIds": ["uuid"] // opcional, máx. 500
}
```

**Regras:** *upsert* por `studentId + classId + subjectId + termId`; valores derivados das notas (nunca editados manualmente); **transacção atómica.**

**201:** `{ data: Result[], meta }`

### GET `/api/v1/results/:id`

**200:** `{ data: Result, meta }`

### PATCH `/api/v1/results/:id`

Recalcula um resultado individual (body aceite é `{}`). **Transacção atómica.**

**200:** `{ data: Result, meta }`

### DELETE `/api/v1/results/:id`

**200:** `{ data: { id, deleted: true }, meta }` · **404:** `NOT_FOUND`

### Esquema `Result` (DTO)

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid | |
| `schoolId` | uuid | |
| `academicYearId` | uuid | |
| `termId` / `termName` | uuid / string | nome legível |
| `classId` / `className` | uuid / string | nome legível |
| `subjectId` / `subjectName` | uuid / string | nome legível |
| `studentId` / `studentName` | uuid / string | nome legível |
| `average` | number | nullable |
| `finalScore` | number | nullable |
| `calculationMethod` | enum | ver §7 · nullable |
| `status` | enum | `APPROVED` | `FAILED` | `RECOVERY` | `PENDING` | `IN_PROGRESS` |
| `calculatedAt` | date-time | |
| `weightedTotal` | number | nullable |
| `createdAt` / `updatedAt` | date-time | |

**Lógica de status:** `PENDING` (sem notas) → `IN_PROGRESS` (faltam notas) → `APPROVED` (média ≥ 10) → `RECOVERY` (≥ 8) → `FAILED` (< 8). Média padrão: `Σ(nota×peso)/Σ(pesos)` com arredondamento a 2 casas; se `Σ(pesos)=0`, fallback aritmético.

---

## 6. Motor de Cálculo

### GET `/api/v1/results/calculation-methods`

Lista os 6 métodos de cálculo disponíveis.

**200:** `{ data: CalculationMethodMeta[], meta }` — cada item:

| Campo | Tipo |
| --- | --- |
| `code` | enum |
| `name` | string |
| `description` | string |
| `formula` | string |

### POST `/api/v1/results/calculate`

Calcula nota **sem persistir** (calculadora in-memory, regras puras).

**Body:**

```json
{
  "method": "WEIGHTED_PERCENTAGE",
  "items": [
    { "assessmentId": "uuid", "name": "Teste 1", "type": "TESTE", "score": 14, "weight": 50 },
    { "name": "Exame", "type": "EXAME_NORMAL", "score": 16, "weight": 50 }
  ],
  "components": [],
  "formula": "WEIGHTED_100",
  "rounding": { "decimals": 2 },
  "minScore": 0,
  "maxScore": 20,
  "expectedTotal": 100,
  "allowNormalization": false,
  "top": 2
}
```

| Campo | Regra |
| --- | --- |
| `method` | obrigatório — um dos 6 métodos |
| `items` | obrigatório (máx. 500); vazio → 400 exceto para `COMPONENT_BASED`; `score >= 0` e `<= 100`; `weight` `0..100` |
| `components` | obrigatório para `COMPONENT_BASED` (1..100) |
| `formula` | obrigatório para `CUSTOM_WEIGHTED` (máx. 100) |
| `rounding.decimals` | `0` | `1` | `2` (default `2`) |
| `minScore` / `maxScore` | default `0` / `20`; `maxScore > minScore` |
| `expectedTotal` | default `100` (`> 0`, máx. 1000) |
| `top` | default `2` (`1..100`) para `MEAN_OF_TOP_K` |

**200:** `{ data: CalculationResult, meta }`:

```json
{
  "method": "WEIGHTED_PERCENTAGE",
  "value": 15.0,
  "decimals": 2,
  "formula": null,
  "breakdown": [{ "id": "…", "assessmentId": "uuid", "name": "…", "type": "TESTE", "label": "…", "score": 14, "weight": 50, "normalizedWeight": null, "contribution": 7.0, "children": [] }]
}
```

**Erros do motor:**

| HTTP | `code` | Motivo |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | `EMPTY_ITEMS`, `INVALID_SCORE`, `INVALID_WEIGHT`, `INVALID_COMPONENTS`, `FORMULA_NOT_REGISTERED` |
| `409` | `CONFLICT` | `WEIGHT_TOTAL_MISMATCH`, `WEIGHT_SUM_MUST_BE_POSITIVE`, `COMPONENT_WEIGHT_MISMATCH` |
| `404` | `NOT_FOUND` | `assessmentId` inexistente |

### Métodos de cálculo

| Código | Nome | Fórmula | Exige pesos = 100%? |
| --- | --- | --- | --- |
| `ARITHMETIC_MEAN` | Média aritmética | `Σnota / n` | não |
| `WEIGHTED_PERCENTAGE` | Média ponderada percentual | `Σ(nota × peso) / Σ(peso)` | sim (`expectedTotal`) |
| `PERCENTAGE_SUM` | Soma percentual | `Σ(nota × percentagem)` | sim |
| `NORMALIZED_WEIGHTED_MEAN` | Média ponderada normalizada | `Σ(nota × peso/Σpeso)` | não |
| `COMPONENT_BASED` | Cálculo por componentes | combinação hierárquica de componentes | sim (soma dos pesos por nível = 100) |
| `CUSTOM_WEIGHTED` | Cálculo personalizado | função registada (sem `eval`) | depende da fórmula |

### Fórmulas personalizadas (`CUSTOM_WEIGHTED`)

| Chave | Nome | Requer pesos? |
| --- | --- | --- |
| `SUM` | Soma das notas | não |
| `MAX` | Maior nota | não |
| `MIN` | Menor nota | não |
| `WEIGHTED_100` | Soma ponderada a 100% | sim |
| `NORMALIZED_MEAN` | Média ponderada normalizada | sim |
| `MEAN_OF_TOP_K` | Média das melhores notas (k default 2) | não |

---

## 7. Impressão

### GET `/api/v1/print/class/:classId/schedule`

Dados para impressão do horário da turma.

| Query | Tipo | Opcional |
| --- | --- | --- |
| `termId` | uuid | sim |

**200:** `{ data: { … }, meta }`

### GET `/api/v1/print/class/:classId/pauta`

Dados para impressão da pauta da turma/disciplina. `STUDENT`: com dívida → `403 FINANCIAL_ACCESS_BLOCKED`; serviço financeiro indisponível → `503 FINANCIAL_VERIFICATION_UNAVAILABLE`. Para `SCHOOL_ADMIN`/`TEACHER`, as linhas de alunos endividados vêm mascaradas (`debtRestricted: true`, `average: null`).

| Query | Tipo | Opcional |
| --- | --- | --- |
| `termId` | uuid | sim |
| `subjectId` | uuid | recomendado (filtra a disciplina) |

**200:** `{ data: { … }, meta }`

---

## 8. Catálogos (montagem de formulários)

Todos devolvem `{ data: { id, name, … }[], meta }` com paginação. `id` + nome legível (sem decorar UUIDs).

| Endpoint | Campos principais | Filtros |
| --- | --- | --- |
| `GET /api/v1/schools` | `id`, `name`, `code`, `phone?` | — |
| `GET /api/v1/academic-years` | `id`, `schoolId`, `name` | — |
| `GET /api/v1/terms` | `id`, `schoolId`, `academicYearId`, `name`, `startDate`, `endDate`, `status` | `academicYearId?` |
| `GET /api/v1/classes` | `id`, `schoolId`, `academicYearId`, `name`, `grade?`, `shift?`, `room?` | `termId?`, `academicYearId?` |
| `GET /api/v1/subjects` | `id`, `schoolId`, `name`, `code?` | — |
| `GET /api/v1/teachers` | `id`, `schoolId`, `name`, `email?` | — |
| `GET /api/v1/students` | `id`, `schoolId`, `name`, `email?`, `enrollmentNumber?` | `classId?`, `termId?` (matrículas ativas) |

---

## 9. Resumo de rotas

| Método + Rota | Descrição |
| --- | --- |
| `GET` / `POST` `/api/v1/assessments` | Listar / criar avaliação |
| `GET` / `PATCH` / `DELETE` `/api/v1/assessments/:id` | Obter / atualizar / eliminar avaliação |
| `GET` / `POST` `/api/v1/assessments/:assessmentId/grades` | Listar / lançar notas |
| `PATCH` `/api/v1/assessments/:assessmentId/grades/:gradeId` | Atualizar nota |
| `POST` `/api/v1/auth/login` | Login (Bearer JWT, TTL 3600s) |
| `GET` `/api/v1/me/financial-status` | Estado financeiro do próprio estudante |
| `GET` / `POST` `/api/v1/schedules` | Listar / criar horário |
| `GET` / `PATCH` / `DELETE` `/api/v1/schedules/:id` | Obter / atualizar / eliminar horário |
| `GET` / `POST` `/api/v1/results` | Listar / calcular em lote |
| `GET` / `PATCH` / `DELETE` `/api/v1/results/:id` | Obter / recalcular / eliminar resultado |
| `GET` `/api/v1/results/calculation-methods` | Listar métodos de cálculo |
| `POST` `/api/v1/results/calculate` | Calculadora in-memory |
| `GET` `/api/v1/print/class/:classId/schedule` | Impressão do horário |
| `GET` `/api/v1/print/class/:classId/pauta` | Impressão da pauta |
| `GET` `/api/v1/schools` | Catálogo de escolas |
| `GET` `/api/v1/academic-years` | Catálogo de anos letivos |
| `GET` `/api/v1/terms` | Catálogo de períodos |
| `GET` `/api/v1/classes` | Catálogo de turmas |
| `GET` `/api/v1/subjects` | Catálogo de disciplinas |
| `GET` `/api/v1/teachers` | Catálogo de professores |
| `GET` `/api/v1/students` | Catálogo de alunos |
| `GET` `/api/v1/health` | Healthcheck |
| `GET` `/api/docs` / `/api/openapi.json` | Swagger UI / spec |

> **Nota de roteamento:** `/results/calculation-methods` e `/results/calculate` são registadas antes de `/results/:id` (não há conflito de parâmetros).

## 10. Cliente oficial

`@smartcampus/api-client` (TypeScript, `fetch`, Node 24) inclui:

- `listAssessments`, `createAssessment`, `getAssessment`, `updateAssessment`, `deleteAssessment`
- `listGrades`, `createGrade`, `updateGrade`
- `listSchedules`, `createSchedule`, `getSchedule`, `updateSchedule`, `deleteSchedule`
- `listResults`, `createResults`, `getResult`, `updateResult`, `deleteResult`
- `listCalculationMethods()`, `calculate(payload)`
- `listSchools()`, `listAcademicYears()`, `listTerms()`, `listClasses()`, `listSubjects()`, `listTeachers()`, `listStudents()`

Envelope do cliente: tipados via `@smartcampus/shared-types` (DTOs com os campos legíveis `*Name`).