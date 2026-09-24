# Manual das APIs Core — G3 Avaliações e Horários

## Visão Geral

API REST autenticada (Bearer JWT) para gestão académica de avaliações, notas, horários e resultados. Baseada em Node.js/TypeScript/Express/Prisma/PostgreSQL. Consome os serviços de contratos (students/teachers/enrolments/finance) via HTTP com credencial de serviço.

**URL base:** `http://localhost:4100`
**Docs Swagger:** `http://localhost:4100/api/docs`

---

## Autenticação

Toda a API exige `Authorization: Bearer <accessToken>` (TTL 3600s) obtido em:

### POST /api/v1/auth/login
- **Body:** `{ email, password }`
- **Response:** `{ data: { accessToken, tokenType, expiresIn, user }, meta: { correlationId } }`
- **Erros:** 400 VALIDATION_ERROR, 401 UNAUTHENTICATED (credenciais inválidas/inativo)

Papéis: `SCHOOL_ADMIN`, `TEACHER`, `STUDENT`. A comunicação G3 → Financeiro usa `FINANCIAL_SERVICE_TOKEN` (credencial de serviço), nunca o token do aluno. O `x-correlation-id`/`x-request-id` enviado pelo cliente é propagado aos serviços de contratos e ecoado como `meta.correlationId`.

## Regra financeira (bloqueio de notas)

- Estudante com registo financeiro em dívida → `403 FINANCIAL_ACCESS_BLOCKED` em todas as consultas de notas (resultados, notas de avaliação, pauta).
- Serviço financeiro indisponível → `503 FINANCIAL_VERIFICATION_UNAVAILABLE` (fail-closed, nunca assume regular).
- Lançamento de nota de aluno endividado → `409 GRADES_BLOCKED_DUE_TO_DEBT`.
- Pauta para staff mascara linhas de endividados (`debtRestricted: true`, `average: null`).
- `GET /api/v1/me/financial-status` reflecte o estado (só `ACTIVE`/`BLOCKED`, sem montantes) para o frontend silencioso.

---

## Endpoints

### GET /api/v1/assessments
- **Objectivo:** Lista avaliações (filtros opcionais)
- **Parâmetros query:** `termId`, `classId`, `subjectId`, `teacherId`, `page`, `pageSize`
- **Response:** `{ data: Assessment[], meta: { correlationId, page, pageSize, total } }`

### POST /api/v1/assessments
- **Objectivo:** Criar uma avaliação
- **Body:** `{ termId, academicYearId, classId, subjectId, teacherId, name, type, date, weight, ... }`
- **Regras:** peso > 0; tipo válido; não duplicar; período/turma/ano lectivo compatíveis; professor leciona a disciplina
- **Response:** `{ data: Assessment, meta: { correlationId } }`
- **Erros:** 400 VALIDATION_ERROR, 409 CONFLICT

### GET /api/v1/assessments/:id
- **Objectivo:** Obter avaliação por ID
- **Response:** `{ data: Assessment, meta: { correlationId } }`
- **Erros:** 404 NOT_FOUND

### PATCH /api/v1/assessments/:id
- **Objectivo:** Actualizar uma avaliação
- **Regras:** peso/maxScore imutáveis após notas lançadas (409)
- **Response:** `{ data: Assessment, meta: { correlationId } }`

### DELETE /api/v1/assessments/:id
- **Objectivo:** Eliminar avaliação
- **Regras:** bloqueado se tiver notas lançadas (409)
- **Response:** `{ data: { id, deleted: true }, meta: { correlationId } }`

### GET /api/v1/assessments/:assessmentId/grades
- **Objectivo:** Listar notas de uma avaliação
- **Regras:** STUDENT apenas se não tiver dívida (senão 403 FINANCIAL_ACCESS_BLOCKED / 503 fail-closed)
- **Response:** `{ data: Grade[], meta: { correlationId } }`

### POST /api/v1/assessments/:assessmentId/grades
- **Objectivo:** Lançar nota a um aluno
- **Regras:** avaliação deve estar OPEN; 1 nota por aluno; score ∈ [0, maxScore]; aluno matriculado; **transacção atómica com recálculo**
- **Response:** `{ data: Grade, meta: { correlationId } }`
- **Erros:** 400 VALIDATION_ERROR, 404 NOT_FOUND, 409 CONFLICT

### PATCH /api/v1/assessments/:assessmentId/grades/:gradeId
- **Objectivo:** Actualizar uma nota
- **Regras:** avaliação deve estar OPEN; transacção atómica com recálculo
- **Response:** `{ data: Grade, meta: { correlationId } }`

### GET /api/v1/schedules
- **Objectivo:** Listar horários (filtros opcionais)
- **Response:** `{ data: Schedule[], meta: { correlationId } }`

### POST /api/v1/schedules
- **Objectivo:** Criar horário
- **Regras:** startTime < endTime; HH:mm; conflitos professor/turma/sala → 409
- **Response:** `{ data: Schedule, meta: { correlationId } }`

### GET /api/v1/schedules/:id
- **Objectivo:** Obter horário por ID

### PATCH /api/v1/schedules/:id
- **Objectivo:** Actualizar horário (revalida conflitos)

### DELETE /api/v1/schedules/:id
- **Objectivo:** Eliminar horário (permitido)

### GET /api/v1/results
- **Objectivo:** Listar resultados académicos
- **Regras:** STUDENT vê só os próprios; com dívida → 403 FINANCIAL_ACCESS_BLOCKED; sem perfil académico → 404 STUDENT_NOT_FOUND

### GET /api/v1/me/financial-status
- **Objectivo:** Estado financeiro do próprio estudante
- **Response:** `{ data: { status: "ACTIVE" | "BLOCKED", checkedAt }, meta: { correlationId } }` (sem montantes)

### POST /api/v1/results
- **Objectivo:** Calcular resultados em lote (turma/disciplina/período)
- **Transacção atómica**
- Alunos endividados são excluídos e sinalizados (`blockedByDebt`)

### GET /api/v1/results/:id
- **Objectivo:** Obter resultado por ID
- **Regras:** STUDENT só os próprios; com dívida → 403 FINANCIAL_ACCESS_BLOCKED

### PATCH /api/v1/results/:id
- **Objectivo:** Recalcular um resultado individual
- **Transacção atómica**

### DELETE /api/v1/results/:id
- **Objectivo:** Eliminar um resultado
- **Response:** `{ data: { id, deleted: true }, meta: { correlationId } }`
- **Erros:** 404 NOT_FOUND

### GET /api/v1/results/calculation-methods
- **Objectivo:** Listar métodos de cálculo disponíveis
- **Response:** `{ data: CalculationMethodMeta[], meta: { correlationId } }`
- Retorna os 6 métodos com nome, descrição, campos requeridos e fórmulas customizadas suportadas

### POST /api/v1/results/calculate
- **Objectivo:** Calcular nota com método flexível (sem persistir — calculadora in-memory)
- **Body:** `{ method, items[], components?[], formula?, rounding?, minScore?, maxScore?, expectedTotal? }`
- **Métodos:** `ARITHMETIC_MEAN`, `WEIGHTED_PERCENTAGE`, `PERCENTAGE_SUM`, `NORMALIZED_WEIGHTED_MEAN`, `COMPONENT_BASED`, `CUSTOM_WEIGHTED`
- **Response:** `{ data: { method, value, decimals, breakdown[] }, meta: { correlationId } }`
- **Erros:** 400 VALIDATION_ERROR (método inválido, lista vazia, nota/peso inválido, COMPONENT_BASED sem componentes, fórmula não registada), 409 CONFLICT (pesos incompatíveis), 404 NOT_FOUND (assessmentId inexistente)

### GET /api/v1/print/class/:classId/schedule
- **Objectivo:** Dados para impressão do horário da turma

### GET /api/v1/print/class/:classId/pauta
- **Objectivo:** Dados para impressão da pauta
- **Parâmetros:** subjectId obrigatório

---

## Formatos de Resposta

### Sucesso
```json
{
  "data": { ... },
  "meta": {
    "correlationId": "sc-uuid",
    "page": 1,
    "pageSize": 100,
    "total": 50
  }
}
```

### Erro
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Dados inválidos",
  "details": [{ "field": "weight", "message": "Peso deve ser maior que 0" }],
  "correlationId": "sc-uuid"
}
```
