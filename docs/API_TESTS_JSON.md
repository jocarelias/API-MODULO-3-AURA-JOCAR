# Testes JSON — Todos os Endpoints da API G3

Exemplos de **pedido** e **resposta** (JSON) para **todos** os endpoints do módulo, com UUID reais do banco. Formato de envelope: sucesso `{ data, meta: { correlationId, [page, pageSize, total] } }`; erro `{ code, message, details, correlationId }`.

**Base URL:** `http://localhost:4100/api/v1` · **Sem autenticação.**

| UUID | Entidade |
|---|---|
| `c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1` | School UJAC |
| `7059d983-da71-4221-9541-afacb32316c3` | AcademicYear 2026 |
| `b1ec59f2-8ae4-48e2-b9b0-24172da51ce8` | Term 1º Trimestre |
| `df12a7a2-b47b-413e-8308-b0d5b6ef53dd` | Class Eng. Informática - 1º Ano |
| `26c5ef3c-67ce-436c-9c45-c2a4cf28ceaf` | Subject PTP 3 |
| `e79e30fb-b3e6-4113-ad47-c212aefca3ac` | Teacher Armando Correia |
| `595b586c-ceac-4722-9ac0-49c5501d451d` | Assessment Teste 1 - PTP 3 |
| `99cf22c6-9ad1-4e3b-8402-16de34051558` | Student Ana JAC |
| `53e13f59-77bb-4394-8f5d-c3dfa673ef14` | Grade (exemplo) |
| `7b7e11e7-09c8-4fb2-91fb-b20464ccd7cd` | Result (exemplo) |

---

## 1. Assessments

### 1.1 GET /assessments — Listar avaliações (com filtros + paginação)

**GET** `http://localhost:4100/api/v1/assessments?termId=b1ec59f2-8ae4-48e2-b9b0-24172da51ce8&classId=df12a7a2-b47b-413e-8308-b0d5b6ef53dd&page=1&pageSize=10`  → **200**

Resposta:
```json
{
  "data": [
    {
      "id": "595b586c-ceac-4722-9ac0-49c5501d451d",
      "schoolId": "c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1",
      "academicYearId": "7059d983-da71-4221-9541-afacb32316c3",
      "academicYearName": "2026",
      "termId": "b1ec59f2-8ae4-48e2-b9b0-24172da51ce8",
      "termName": "1º Trimestre",
      "classId": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
      "className": "Engenharia Informática - 1º Ano",
      "subjectId": "26c5ef3c-67ce-436c-9c45-c2a4cf28ceaf",
      "subjectName": "PTP 3",
      "teacherId": "e79e30fb-b3e6-4113-ad47-c212aefca3ac",
      "teacherName": "Armando Correia",
      "name": "Teste 1 - PTP 3",
      "type": "TESTE",
      "description": "Avaliação de exemplo gerada pelo seed (UJAC)",
      "date": "2026-03-10T10:00:00.000Z",
      "maxScore": 20,
      "weight": 1,
      "status": "OPEN",
      "createdAt": "2026-09-15T07:40:11.553Z",
      "updatedAt": "2026-09-15T07:40:11.553Z"
    }
  ],
  "meta": {
    "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60",
    "page": 1,
    "pageSize": 10,
    "total": 1
  }
}
```

### 1.2 POST /assessments — Criar avaliação

**POST** `http://localhost:4100/api/v1/assessments`  → **201**

Pedido (body):
```json
{
  "name": "Teste 2 - PTP 3 (criar)",
  "type": "TESTE",
  "academicYearId": "7059d983-da71-4221-9541-afacb32316c3",
  "termId": "b1ec59f2-8ae4-48e2-b9b0-24172da51ce8",
  "classId": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
  "subjectId": "26c5ef3c-67ce-436c-9c45-c2a4cf28ceaf",
  "teacherId": "e79e30fb-b3e6-4113-ad47-c212aefca3ac",
  "date": "2026-05-20T10:00:00+02:00",
  "maxScore": 20,
  "weight": 1,
  "status": "SCHEDULED"
}
```

Resposta:
```json
{
  "data": {
    "id": "<uuid-gerado>",
    "schoolId": "c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1",
    "academicYearId": "7059d983-da71-4221-9541-afacb32316c3",
    "termId": "b1ec59f2-8ae4-48e2-b9b0-24172da51ce8",
    "classId": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
    "subjectId": "26c5ef3c-67ce-436c-9c45-c2a4cf28ceaf",
    "teacherId": "e79e30fb-b3e6-4113-ad47-c212aefca3ac",
    "name": "Teste 2 - PTP 3 (criar)",
    "type": "TESTE",
    "description": "Avaliação de exemplo gerada pelo seed (UJAC)",
    "date": "2026-03-10T10:00:00.000Z",
    "maxScore": 20,
    "weight": 1,
    "status": "SCHEDULED",
    "createdAt": "2026-09-15T07:40:11.553Z",
    "updatedAt": "2026-09-15T07:40:11.553Z"
  },
  "meta": {
    "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
  }
}
```

### 1.3 GET /assessments/:id — Obter avaliação

**GET** `http://localhost:4100/api/v1/assessments/595b586c-ceac-4722-9ac0-49c5501d451d`  → **200**

Resposta:
```json
{
  "data": {
    "id": "595b586c-ceac-4722-9ac0-49c5501d451d",
    "schoolId": "c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1",
    "academicYearId": "7059d983-da71-4221-9541-afacb32316c3",
    "termId": "b1ec59f2-8ae4-48e2-b9b0-24172da51ce8",
    "classId": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
    "subjectId": "26c5ef3c-67ce-436c-9c45-c2a4cf28ceaf",
    "teacherId": "e79e30fb-b3e6-4113-ad47-c212aefca3ac",
    "name": "Teste 1 - PTP 3",
    "type": "TESTE",
    "description": "Avaliação de exemplo gerada pelo seed (UJAC)",
    "date": "2026-03-10T10:00:00.000Z",
    "maxScore": 20,
    "weight": 1,
    "status": "OPEN",
    "createdAt": "2026-09-15T07:40:11.553Z",
    "updatedAt": "2026-09-15T07:40:11.553Z"
  },
  "meta": {
    "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
  }
}
```

### 1.4 PATCH /assessments/:id — Actualizar avaliação

**PATCH** `http://localhost:4100/api/v1/assessments/595b586c-ceac-4722-9ac0-49c5501d451d`  → **200**

Pedido (body):
```json
{
  "name": "Teste 1 - PTP 3 (actualizado)",
  "description": "Avaliação actualizada por PATCH"
}
```

Resposta:
```json
{
  "data": {
    "id": "595b586c-ceac-4722-9ac0-49c5501d451d",
    "schoolId": "c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1",
    "academicYearId": "7059d983-da71-4221-9541-afacb32316c3",
    "termId": "b1ec59f2-8ae4-48e2-b9b0-24172da51ce8",
    "classId": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
    "subjectId": "26c5ef3c-67ce-436c-9c45-c2a4cf28ceaf",
    "teacherId": "e79e30fb-b3e6-4113-ad47-c212aefca3ac",
    "name": "Teste 1 - PTP 3 (actualizado)",
    "type": "TESTE",
    "description": "Avaliação de exemplo gerada pelo seed (UJAC)",
    "date": "2026-03-10T10:00:00.000Z",
    "maxScore": 20,
    "weight": 1,
    "status": "OPEN",
    "createdAt": "2026-09-15T07:40:11.553Z",
    "updatedAt": "2026-09-15T07:40:11.553Z"
  },
  "meta": {
    "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
  }
}
```

### 1.5 DELETE /assessments/:id — Apagar avaliação (bloqueado se houver notas → 409)

**DELETE** `http://localhost:4100/api/v1/assessments/595b586c-ceac-4722-9ac0-49c5501d451d`  → **409**

Resposta:
```json
{
  "code": "CONFLICT",
  "message": "Não é possível apagar avaliação com notas lançadas",
  "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
}
```

### 1.6 POST /assessments — Validação (400) — peso 0

**POST** `http://localhost:4100/api/v1/assessments`  → **400**

Pedido (body):
```json
{
  "name": "Inválido",
  "type": "TESTE",
  "academicYearId": "7059d983-da71-4221-9541-afacb32316c3",
  "termId": "b1ec59f2-8ae4-48e2-b9b0-24172da51ce8",
  "classId": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
  "subjectId": "26c5ef3c-67ce-436c-9c45-c2a4cf28ceaf",
  "teacherId": "e79e30fb-b3e6-4113-ad47-c212aefca3ac",
  "date": "2026-05-20T10:00:00+02:00",
  "maxScore": 20,
  "weight": 0
}
```

Resposta:
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Dados inválidos",
  "details": [
    {
      "field": "weight",
      "message": "Peso deve ser maior que 0"
    }
  ],
  "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
}
```

### 1.7 POST /assessments — Duplicada (409)

**POST** `http://localhost:4100/api/v1/assessments`  → **409**

Pedido (body):
```json
{
  "name": "Teste 1 - PTP 3",
  "type": "TESTE",
  "academicYearId": "7059d983-da71-4221-9541-afacb32316c3",
  "termId": "b1ec59f2-8ae4-48e2-b9b0-24172da51ce8",
  "classId": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
  "subjectId": "26c5ef3c-67ce-436c-9c45-c2a4cf28ceaf",
  "teacherId": "e79e30fb-b3e6-4113-ad47-c212aefca3ac",
  "date": "2026-03-10T10:00:00+02:00",
  "maxScore": 20,
  "weight": 1
}
```

Resposta:
```json
{
  "code": "CONFLICT",
  "message": "Já existe uma avaliação com este nome na turma/disciplina/período",
  "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
}
```

---

## 2. Grades

### 2.1 GET /assessments/:assessmentId/grades — Listar notas da avaliação

**GET** `http://localhost:4100/api/v1/assessments/595b586c-ceac-4722-9ac0-49c5501d451d/grades`  → **200**

Resposta:
```json
{
  "data": [
    {
      "id": "53e13f59-77bb-4394-8f5d-c3dfa673ef14",
      "assessmentId": "5f290cf0-9a8d-480b-bf02-0adb9b8f72cd",
      "assessmentName": "Teste 1 - PTP 3",
      "studentId": "fc8221bd-1f2b-425a-8b5e-687573ab7731",
      "studentName": "Ana JAC",
      "score": 20,
      "comment": null,
      "status": "SUBMITTED",
      "createdAt": "2026-09-15T07:40:12.010Z",
      "updatedAt": "2026-09-15T07:40:12.010Z"
    }
  ],
  "meta": {
    "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60",
    "page": 1,
    "pageSize": 1,
    "total": 1
  }
}
```

### 2.2 POST /assessments/:assessmentId/grades — Lançar nota (201 + recálculo ACID)

**POST** `http://localhost:4100/api/v1/assessments/595b586c-ceac-4722-9ac0-49c5501d451d/grades`  → **201**

Pedido (body):
```json
{
  "studentId": "99cf22c6-9ad1-4e3b-8402-16de34051558",
  "score": 15,
  "comment": "Bom desempenho no teste"
}
```

Resposta:
```json
{
  "data": {
    "id": "<uuid-gerado>",
    "assessmentId": "5f290cf0-9a8d-480b-bf02-0adb9b8f72cd",
    "studentId": "99cf22c6-9ad1-4e3b-8402-16de34051558",
    "score": 15,
    "comment": null,
    "status": "SUBMITTED",
    "createdAt": "2026-09-15T07:40:12.010Z",
    "updatedAt": "2026-09-15T07:40:12.010Z"
  },
  "meta": {
    "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
  }
}
```

### 2.3 POST grades — Nota duplicada (409)

**POST** `http://localhost:4100/api/v1/assessments/595b586c-ceac-4722-9ac0-49c5501d451d/grades`  → **409**

Pedido (body):
```json
{
  "studentId": "fc8221bd-1f2b-425a-8b5e-687573ab7731",
  "score": 10
}
```

Resposta:
```json
{
  "code": "CONFLICT",
  "message": "Já existe uma nota para este aluno nesta avaliação",
  "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
}
```

### 2.4 POST grades — Nota fora do intervalo (400)

**POST** `http://localhost:4100/api/v1/assessments/595b586c-ceac-4722-9ac0-49c5501d451d/grades`  → **400**

Pedido (body):
```json
{
  "studentId": "99cf22c6-9ad1-4e3b-8402-16de34051558",
  "score": -1
}
```

Resposta:
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Dados inválidos",
  "details": [
    {
      "field": "score",
      "message": "Nota não pode ser negativa"
    }
  ],
  "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
}
```

### 2.5 PATCH /assessments/:assessmentId/grades/:gradeId — Actualizar nota (+ recálculo)

**PATCH** `http://localhost:4100/api/v1/assessments/595b586c-ceac-4722-9ac0-49c5501d451d/grades/53e13f59-77bb-4394-8f5d-c3dfa673ef14`  → **200**

Pedido (body):
```json
{
  "score": 18,
  "comment": "Corrigido após revisão"
}
```

Resposta:
```json
{
  "data": {
    "id": "53e13f59-77bb-4394-8f5d-c3dfa673ef14",
    "assessmentId": "5f290cf0-9a8d-480b-bf02-0adb9b8f72cd",
    "studentId": "fc8221bd-1f2b-425a-8b5e-687573ab7731",
    "score": 18,
    "comment": null,
    "status": "SUBMITTED",
    "createdAt": "2026-09-15T07:40:12.010Z",
    "updatedAt": "2026-09-15T07:40:12.010Z"
  },
  "meta": {
    "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
  }
}
```

---

## 3. Schedules

### 3.1 GET /schedules — Listar horários (com filtros + paginação)

**GET** `http://localhost:4100/api/v1/schedules?termId=b1ec59f2-8ae4-48e2-b9b0-24172da51ce8&classId=df12a7a2-b47b-413e-8308-b0d5b6ef53dd&page=1&pageSize=10`  → **200**

Resposta:
```json
{
  "data": [
    {
      "id": "74da6e64-ea71-494f-804b-9ebbef6f6c52",
      "schoolId": "c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1",
      "academicYearId": "7059d983-da71-4221-9541-afacb32316c3",
      "termId": "b1ec59f2-8ae4-48e2-b9b0-24172da51ce8",
      "termName": "1º Trimestre",
      "classId": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
      "className": "Engenharia Informática - 1º Ano",
      "subjectId": "26c5ef3c-67ce-436c-9c45-c2a4cf28ceaf",
      "subjectName": "PTP 3",
      "teacherId": "e79e30fb-b3e6-4113-ad47-c212aefca3ac",
      "teacherName": "Armando Correia",
      "dayOfWeek": "MONDAY",
      "startTime": "08:00",
      "endTime": "09:40",
      "room": "Laboratório de Informática",
      "status": "ACTIVE",
      "createdAt": "2026-09-15T07:40:11.588Z",
      "updatedAt": "2026-09-15T07:40:11.588Z"
    }
  ],
  "meta": {
    "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60",
    "page": 1,
    "pageSize": 10,
    "total": 1
  }
}
```

### 3.2 POST /schedules — Criar horário

**POST** `http://localhost:4100/api/v1/schedules`  → **201**

Pedido (body):
```json
{
  "academicYearId": "7059d983-da71-4221-9541-afacb32316c3",
  "termId": "b1ec59f2-8ae4-48e2-b9b0-24172da51ce8",
  "classId": "afadd13d-7f2e-4aeb-a839-9b4ff0e99cac",
  "subjectId": "eb659aed-8388-449b-95f6-65d7eb1041b8",
  "teacherId": "a4b8703f-22bc-46c6-932b-7dae7025d3e9",
  "dayOfWeek": "TUESDAY",
  "startTime": "10:00",
  "endTime": "11:40",
  "room": "Sala 203",
  "status": "ACTIVE"
}
```

Resposta:
```json
{
  "data": {
    "id": "<uuid-gerado>",
    "schoolId": "c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1",
    "academicYearId": "7059d983-da71-4221-9541-afacb32316c3",
    "termId": "b1ec59f2-8ae4-48e2-b9b0-24172da51ce8",
    "classId": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
    "subjectId": "26c5ef3c-67ce-436c-9c45-c2a4cf28ceaf",
    "teacherId": "e79e30fb-b3e6-4113-ad47-c212aefca3ac",
    "dayOfWeek": "TUESDAY",
    "startTime": "08:00",
    "endTime": "09:40",
    "room": "Laboratório de Informática",
    "status": "ACTIVE",
    "createdAt": "2026-09-15T07:40:11.588Z",
    "updatedAt": "2026-09-15T07:40:11.588Z"
  },
  "meta": {
    "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
  }
}
```

### 3.3 POST /schedules — Conflito de professor/turma/sala (409)

**POST** `http://localhost:4100/api/v1/schedules`  → **409**

Pedido (body):
```json
{
  "academicYearId": "7059d983-da71-4221-9541-afacb32316c3",
  "termId": "b1ec59f2-8ae4-48e2-b9b0-24172da51ce8",
  "classId": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
  "subjectId": "26c5ef3c-67ce-436c-9c45-c2a4cf28ceaf",
  "teacherId": "e79e30fb-b3e6-4113-ad47-c212aefca3ac",
  "dayOfWeek": "MONDAY",
  "startTime": "08:30",
  "endTime": "09:00",
  "room": "Laboratório de Informática",
  "status": "ACTIVE"
}
```

Resposta:
```json
{
  "code": "CONFLICT",
  "message": "Conflito de horário",
  "details": [
    {
      "teacherId": "e79e30fb-b3e6-4113-ad47-c212aefca3ac",
      "classId": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
      "room": "Laboratório de Informática"
    }
  ],
  "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
}
```

### 3.4 GET /schedules/:id — Obter horário + PATCH + DELETE

**GET/PATCH/DELETE** `http://localhost:4100/api/v1/schedules/74da6e64-ea71-494f-804b-9ebbef6f6c52`  → **200**

Pedido (body):
```json
{
  "room": "Sala 205"
}
```

Resposta:
```json
{
  "data": {
    "id": "74da6e64-ea71-494f-804b-9ebbef6f6c52",
    "schoolId": "c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1",
    "academicYearId": "7059d983-da71-4221-9541-afacb32316c3",
    "termId": "b1ec59f2-8ae4-48e2-b9b0-24172da51ce8",
    "classId": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
    "subjectId": "26c5ef3c-67ce-436c-9c45-c2a4cf28ceaf",
    "teacherId": "e79e30fb-b3e6-4113-ad47-c212aefca3ac",
    "dayOfWeek": "MONDAY",
    "startTime": "08:00",
    "endTime": "09:40",
    "room": "Sala 205",
    "status": "ACTIVE",
    "createdAt": "2026-09-15T07:40:11.588Z",
    "updatedAt": "2026-09-15T07:40:11.588Z"
  },
  "meta": {
    "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
  }
}
```

---

## 4. Results

### 4.1 GET /results — Listar resultados (com filtros + paginação)

**GET** `http://localhost:4100/api/v1/results?classId=df12a7a2-b47b-413e-8308-b0d5b6ef53dd&subjectId=26c5ef3c-67ce-436c-9c45-c2a4cf28ceaf&termId=b1ec59f2-8ae4-48e2-b9b0-24172da51ce8&page=1&pageSize=10`  → **200**

Resposta:
```json
{
  "data": [
    {
      "id": "7b7e11e7-09c8-4fb2-91fb-b20464ccd7cd",
      "schoolId": "c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1",
      "academicYearId": "7059d983-da71-4221-9541-afacb32316c3",
      "termId": "b1ec59f2-8ae4-48e2-b9b0-24172da51ce8",
      "termName": "1º Trimestre",
      "classId": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
      "className": "Engenharia Informática - 1º Ano",
      "subjectId": "eb659aed-8388-449b-95f6-65d7eb1041b8",
      "subjectName": "Administração de Redes",
      "studentId": "99cf22c6-9ad1-4e3b-8402-16de34051558",
      "studentName": "Ana JAC",
      "average": 19,
      "finalScore": 19,
      "calculationMethod": null,
      "status": "APPROVED",
      "calculatedAt": "2026-09-15T07:40:12.319Z"
    }
  ],
  "meta": {
    "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60",
    "page": 1,
    "pageSize": 10,
    "total": 1
  }
}
```

### 4.2 POST /results — Recalcular resultados em lote (201)

**POST** `http://localhost:4100/api/v1/results`  → **201**

Pedido (body):
```json
{
  "classId": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
  "subjectId": "26c5ef3c-67ce-436c-9c45-c2a4cf28ceaf",
  "termId": "b1ec59f2-8ae4-48e2-b9b0-24172da51ce8",
  "studentIds": [
    "99cf22c6-9ad1-4e3b-8402-16de34051558",
    "3fa2c658-25db-4d07-9a92-62085242a74e"
  ]
}
```

Resposta:
```json
{
  "data": [
    {
      "id": "7b7e11e7-09c8-4fb2-91fb-b20464ccd7cd",
      "schoolId": "c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1",
      "academicYearId": "7059d983-da71-4221-9541-afacb32316c3",
      "termId": "b1ec59f2-8ae4-48e2-b9b0-24172da51ce8",
      "termName": "1º Trimestre",
      "classId": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
      "className": "Engenharia Informática - 1º Ano",
      "subjectId": "eb659aed-8388-449b-95f6-65d7eb1041b8",
      "subjectName": "Administração de Redes",
      "studentId": "99cf22c6-9ad1-4e3b-8402-16de34051558",
      "studentName": "Ana JAC",
      "average": 19,
      "finalScore": 19,
      "calculationMethod": null,
      "status": "APPROVED",
      "calculatedAt": "2026-09-15T07:40:12.319Z"
    }
  ],
  "meta": {
    "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
  }
}
```

### 4.3 GET /results/:id — Obter resultado

**GET** `http://localhost:4100/api/v1/results/7b7e11e7-09c8-4fb2-91fb-b20464ccd7cd`  → **200**

Resposta:
```json
{
  "data": {
    "id": "7b7e11e7-09c8-4fb2-91fb-b20464ccd7cd",
    "schoolId": "c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1",
    "academicYearId": "7059d983-da71-4221-9541-afacb32316c3",
    "termId": "b1ec59f2-8ae4-48e2-b9b0-24172da51ce8",
    "classId": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
    "subjectId": "eb659aed-8388-449b-95f6-65d7eb1041b8",
    "studentId": "99cf22c6-9ad1-4e3b-8402-16de34051558",
    "average": 19,
    "finalScore": 19,
    "calculationMethod": null,
    "status": "APPROVED",
    "calculatedAt": "2026-09-15T07:40:12.319Z"
  },
  "meta": {
    "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
  }
}
```

### 4.4 PATCH /results/:id — Recalcular resultado individual (200)

**PATCH** `http://localhost:4100/api/v1/results/7b7e11e7-09c8-4fb2-91fb-b20464ccd7cd`  → **200**

Pedido (body):
```json
{}
```

Resposta:
```json
{
  "data": {
    "id": "7b7e11e7-09c8-4fb2-91fb-b20464ccd7cd",
    "schoolId": "c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1",
    "academicYearId": "7059d983-da71-4221-9541-afacb32316c3",
    "termId": "b1ec59f2-8ae4-48e2-b9b0-24172da51ce8",
    "classId": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
    "subjectId": "eb659aed-8388-449b-95f6-65d7eb1041b8",
    "studentId": "99cf22c6-9ad1-4e3b-8402-16de34051558",
    "average": 19,
    "finalScore": 19,
    "calculationMethod": null,
    "status": "APPROVED",
    "calculatedAt": "2026-09-15T07:40:12.319Z"
  },
  "meta": {
    "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
  }
}
```

### 4.5 DELETE /results/:id — Apagar resultado (200)

**DELETE** `http://localhost:4100/api/v1/results/7b7e11e7-09c8-4fb2-91fb-b20464ccd7cd`  → **200**

Resposta:
```json
{
  "data": {
    "id": "7b7e11e7-09c8-4fb2-91fb-b20464ccd7cd",
    "deleted": true
  },
  "meta": {
    "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
  }
}
```

### 4.6 GET /results/:id — Resultado inexistente (404)

**GET** `http://localhost:4100/api/v1/results/00000000-0000-4000-8000-000000000000`  → **404**

Resposta:
```json
{
  "code": "NOT_FOUND",
  "message": "Resultado não encontrado",
  "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
}
```

---

## 5. Motor de Cálculo

### 5.1 GET /results/calculation-methods — Listar métodos

**GET** `http://localhost:4100/api/v1/results/calculation-methods`  → **200**

Resposta:
```json
{
  "data": [
    {
      "code": "ARITHMETIC_MEAN",
      "name": "Média Aritmética",
      "description": "Soma das notas a dividir pelo nº de notas",
      "formula": "Σ score / n"
    },
    {
      "code": "WEIGHTED_PERCENTAGE",
      "name": "Média Ponderada (%)",
      "description": "Σ(score×weight)/100",
      "formula": "Σ(score·weight)/100"
    },
    {
      "code": "PERCENTAGE_SUM",
      "name": "Soma Percentual",
      "description": "Soma das notas (escala configurável)",
      "formula": "Σ score"
    },
    {
      "code": "NORMALIZED_WEIGHTED_MEAN",
      "name": "Média Ponderada Normalizada",
      "description": "Σ(score×weight)/Σ(weight)",
      "formula": "Σ(score·weight)/Σ(weight)"
    },
    {
      "code": "COMPONENT_BASED",
      "name": "Componentes",
      "description": "Média hierárquica por componentes",
      "formula": "Σ componente(Σ sub-items)"
    },
    {
      "code": "CUSTOM_WEIGHTED",
      "name": "Fórmula Custom",
      "description": "Fórmula registada no registry (sem eval)",
      "formula": "registry(formula)"
    }
  ],
  "meta": {
    "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
  }
}
```

### 5.2 POST /results/calculate — Calcular (WEIGHTED_PERCENTAGE)

**POST** `http://localhost:4100/api/v1/results/calculate`  → **200**

Pedido (body):
```json
{
  "method": "WEIGHTED_PERCENTAGE",
  "items": [
    {
      "assessmentId": "595b586c-ceac-4722-9ac0-49c5501d451d",
      "name": "Teste 1 - PTP 3",
      "score": 16,
      "weight": 40
    },
    {
      "name": "Exame Final - PTP 3",
      "score": 13,
      "weight": 60
    }
  ],
  "expectedTotal": 100,
  "minScore": 0,
  "maxScore": 20,
  "rounding": {
    "decimals": 2
  }
}
```

Resposta:
```json
{
  "data": {
    "method": "WEIGHTED_PERCENTAGE",
    "value": 14.2,
    "decimals": 2,
    "breakdown": [
      {
        "name": "Teste 1 - PTP 3",
        "score": 16,
        "weight": 40,
        "contribution": 6.4
      },
      {
        "name": "Exame Final - PTP 3",
        "score": 13,
        "weight": 60,
        "contribution": 7.8
      }
    ]
  },
  "meta": {
    "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
  }
}
```

### 5.3 POST /results/calculate — Soma dos pesos ≠ 100 (409)

**POST** `http://localhost:4100/api/v1/results/calculate`  → **409**

Pedido (body):
```json
{
  "method": "WEIGHTED_PERCENTAGE",
  "items": [
    {
      "name": "A",
      "score": 10,
      "weight": 50
    },
    {
      "name": "B",
      "score": 10,
      "weight": 30
    }
  ]
}
```

Resposta:
```json
{
  "code": "CONFLICT",
  "message": "A soma dos pesos deve ser 100",
  "details": [
    {
      "field": "items",
      "message": "WEIGHT_TOTAL_MISMATCH"
    }
  ],
  "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
}
```

### 5.4 POST /results/calculate — Método inexistente (400)

**POST** `http://localhost:4100/api/v1/results/calculate`  → **400**

Pedido (body):
```json
{
  "method": "INVALIDO",
  "items": [
    {
      "name": "A",
      "score": 10
    }
  ]
}
```

Resposta:
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Dados inválidos",
  "details": [
    {
      "field": "method",
      "message": "Método de cálculo inválido"
    }
  ],
  "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
}
```

---

## 6. Impressão

### 6.1 GET /print/class/:classId/schedule — Horário imprimível

**GET** `http://localhost:4100/api/v1/print/class/df12a7a2-b47b-413e-8308-b0d5b6ef53dd/schedule?termId=b1ec59f2-8ae4-48e2-b9b0-24172da51ce8`  → **200**

Resposta:
```json
{
  "data": {
    "classId": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
    "className": "Engenharia Informática - 1º Ano",
    "termId": "b1ec59f2-8ae4-48e2-b9b0-24172da51ce8",
    "weeks": [
      {
        "day": "MONDAY",
        "startTime": "08:00",
        "endTime": "09:40",
        "subject": "PTP 3",
        "teacher": "Armando Correia",
        "room": "Laboratório de Informática"
      }
    ]
  },
  "meta": {
    "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
  }
}
```

### 6.2 GET /print/class/:classId/pauta — Pauta imprimível (recalculada)

**GET** `http://localhost:4100/api/v1/print/class/df12a7a2-b47b-413e-8308-b0d5b6ef53dd/pauta?subjectId=26c5ef3c-67ce-436c-9c45-c2a4cf28ceaf&termId=b1ec59f2-8ae4-48e2-b9b0-24172da51ce8`  → **200**

Resposta:
```json
{
  "data": {
    "classId": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
    "className": "Engenharia Informática - 1º Ano",
    "subject": "PTP 3",
    "lines": [
      {
        "studentId": "99cf22c6-9ad1-4e3b-8402-16de34051558",
        "studentName": "Ana JAC",
        "average": 19,
        "status": "APPROVED",
        "evaluations": [
          {
            "assessmentId": "595b586c-ceac-4722-9ac0-49c5501d451d",
            "name": "Teste 1 - PTP 3",
            "score": 20
          }
        ]
      }
    ]
  },
  "meta": {
    "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
  }
}
```

---

## 7. Infraestrutura

### 7.1 GET /health — Health check

**GET** `http://localhost:4100/api/v1/health`  → **200**

Resposta:
```json
{
  "status": "ok",
  "uptime": 1234.56,
  "timestamp": "2026-09-16T12:00:00.000Z"
}
```

### 7.2 GET /api/openapi.json — Spec OpenAPI (sem security)

**GET** `http://localhost:4100/api/v1/api/openapi.json`  → **200**

Resposta:
```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Smart Campus — Avaliações e Horários (G3)",
    "version": "1.0.0"
  },
  "paths": {
    "/api/v1/assessments": {}
  },
  "components": {
    "securitySchemes": {}
  }
}
```

### 7.3 GET rota inexistente — 404 com envelope

**GET** `http://localhost:4100/api/v1/rota/inexistente`  → **404**

Resposta:
```json
{
  "code": "NOT_FOUND",
  "message": "Recurso não encontrado",
  "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60"
}
```

### 7.4 GET — correlationId a partir do header x-request-id

**GET** `http://localhost:4100/api/v1/health`  → **200**

Headers:
```json
{
  "x-request-id": "meu-id-custom"
}
```

Resposta:
```json
{
  "status": "ok",
  "uptime": 1234.56,
  "timestamp": "2026-09-16T12:00:00.000Z"
}
```

> Resposta inclui header `x-request-id: meu-id-custom`

---

## 8. Catálogo (referência para montar formulários)

> Todos devolvem `id` + `name`. Usados para obter os UUID antes de criar/avaliar horários ou notas.

### 8.1 GET /schools — Escolas

**GET** `http://localhost:4100/api/v1/schools`  → **200**

Resposta:
```json
{
  "data": [
    {
      "id": "c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1",
      "name": "UJAC",
      "code": "UJAC",
      "phone": null
    }
  ],
  "meta": { "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60", "page": 1, "pageSize": 1, "total": 1 }
}
```

### 8.2 GET /academic-years — Anos letivos

**GET** `http://localhost:4100/api/v1/academic-years`  → **200**

```json
{
  "data": [
    { "id": "7059d983-da71-4221-9541-afacb32316c3", "schoolId": "c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1", "name": "2026" }
  ],
  "meta": { "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60", "page": 1, "pageSize": 1, "total": 1 }
}
```

### 8.3 GET /terms — Períodos letivos

**GET** `http://localhost:4100/api/v1/terms?academicYearId=7059d983-da71-4221-9541-afacb32316c3`  → **200**

```json
{
  "data": [
    {
      "id": "b1ec59f2-8ae4-48e2-b9b0-24172da51ce8",
      "schoolId": "c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1",
      "academicYearId": "7059d983-da71-4221-9541-afacb32316c3",
      "name": "1º Trimestre",
      "startDate": "2026-01-15T00:00:00.000Z",
      "endDate": "2026-04-15T00:00:00.000Z",
      "status": "ACTIVE"
    }
  ],
  "meta": { "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60", "page": 1, "pageSize": 1, "total": 1 }
}
```

### 8.4 GET /classes — Turmas

**GET** `http://localhost:4100/api/v1/classes?termId=b1ec59f2-8ae4-48e2-b9b0-24172da51ce8`  → **200**

```json
{
  "data": [
    {
      "id": "df12a7a2-b47b-413e-8308-b0d5b6ef53dd",
      "schoolId": "c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1",
      "academicYearId": "7059d983-da71-4221-9541-afacb32316c3",
      "name": "Engenharia Informática - 1º Ano",
      "grade": "1",
      "shift": "Manhã",
      "room": "Sala 204"
    }
  ],
  "meta": { "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60", "page": 1, "pageSize": 1, "total": 1 }
}
```

### 8.5 GET /subjects — Disciplinas

**GET** `http://localhost:4100/api/v1/subjects`  → **200**

```json
{
  "data": [
    {
      "id": "26c5ef3c-67ce-436c-9c45-c2a4cf28ceaf",
      "schoolId": "c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1",
      "name": "PTP 3",
      "code": "SUBJ1"
    }
  ],
  "meta": { "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60", "page": 1, "pageSize": 1, "total": 1 }
}
```

### 8.6 GET /teachers — Professores

**GET** `http://localhost:4100/api/v1/teachers`  → **200**

```json
{
  "data": [
    {
      "id": "e79e30fb-b3e6-4113-ad47-c212aefca3ac",
      "schoolId": "c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1",
      "name": "Armando Correia",
      "email": "prof1@ucjac.ac.mz"
    }
  ],
  "meta": { "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60", "page": 1, "pageSize": 1, "total": 1 }
}
```

### 8.7 GET /students — Alunos

**GET** `http://localhost:4100/api/v1/students?classId=df12a7a2-b47b-413e-8308-b0d5b6ef53dd`  → **200**

```json
{
  "data": [
    {
      "id": "99cf22c6-9ad1-4e3b-8402-16de34051558",
      "schoolId": "c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1",
      "name": "Ana JAC",
      "email": "aluno1@student.ucjac.ac.mz",
      "enrollmentNumber": "UCJAC-2026-001"
    }
  ],
  "meta": { "correlationId": "e9f8a2b1-c123-4d5e-9f0a-1b2c3d4e5f60", "page": 1, "pageSize": 1, "total": 1 }
}
```

### 8.8 Exemplo de fluxo — obter UUID com nome e criar avaliação

1. `GET /api/v1/terms` → escolher `termId` (ex.: 1º Trimestre).
2. `GET /api/v1/classes?termId=...` → escolher `classId` (ex.: Eng. Informática - 1º Ano).
3. `GET /api/v1/subjects` → escolher `subjectId` (ex.: PTP 3).
4. `GET /api/v1/teachers` → escolher `teacherId` (ex.: Armando Correia).
5. `POST /api/v1/assessments` com esses UUID + `academicYearId` (de `/academic-years`).

---

> Nota: IDs `<uuid-gerado>` representam o valor devolvido pelo banco. `correlationId` é ecoado do header `x-request-id` ou gerado (`randomUUID`).
> Para executar na prática, ver `docs/test-payloads/README.md` (curls) e `docs/UUID_REFERENCE.md` (todos os UUID).