# G3 — Arquitetura de Integração com os Módulos Core

Como o módulo **G3 Avaliações e Horários** (porta `4100`) se integra com os serviços Core (students, teachers, enrolments, finance) por contrato HTTP, com autenticação JWT + RBAC e a regra financeira de bloqueio de consulta de notas.

---

## 1. Visão geral

```
                        ┌─────────────────────────────────────────────┐
   Frontend / cliente   │              MÓDULO G3 (4100)               │
   Authorization: Bearer│                                             │
                        │  /api/v1/auth/login      → jwt-sign         │
                        │  /api/v1/assessments ...                    │
                        │  /api/v1/results ...      ┌──────────────┐  │
                        │  /api/v1/me/financial-    │ gateway HTTP │  │
                        │        status             └──────┬───────┘  │
                        └──────────────────────────────────┼──────────┘
                                                   headers x-correlation-id,
                                                   x-request-id + token
        ┌──────────────┬──────────────┬──────────────┬──────────────┐
        ▼              ▼              ▼              ▼              ▼
  Students(4101)  Teachers(4102)  Enrolments(4103)  Finance(4104)
  GET /students   GET /teachers   GET /enrolments   GET /financial-status/:studentId
  …               …               …                 POST /financial/integration/
                                                     assessment-charges
```

## 2. Contratos consumidos (HTTP, via `gateway.ts`)

| Serviço | URL base (env) | Endpoints usados | Propósito |
| --- | --- | --- | --- |
| Students | `STUDENTS_SERVICE_URL` | `GET /api/v1/students` | validar/obter perfil de estudante por utilizador |
| Teachers | `TEACHERS_SERVICE_URL` | `GET /api/v1/teachers` | validar professor responsável |
| Enrolments | `ENROLMENTS_SERVICE_URL` | `GET /api/v1/enrolments` | matrícula ativa turma+disciplina+período |
| Finance | `FINANCE_SERVICE_URL` | `GET /api/v1/financial-status/:studentId` | situação financeira (regra de bloqueio) |
| Finance | `FINANCE_SERVICE_URL` | `POST /api/v1/financial/integration/assessment-charges` | cobrança de taxa de avaliação/exame (idempotente) |

- **Timeouts:** por serviço (`CONTRACT_TIMEOUT_MS`); **GET financeiro com 2 tentativas** (retry).
- **Correlation:** cada chamada envia `x-correlation-id` (e `x-request-id`); a resposta ecoa `meta.correlationId`.

## 3. Autenticação e credenciais

- **Login:** `POST /api/v1/auth/login` devolve `accessToken` (JWT HS256, TTL 3600s) com `{ id, role, schoolId }`.
- **Papéis:** `SCHOOL_ADMIN`, `TEACHER`, `STUDENT`; credencial interna `SERVICE_ROLE = '__SERVICE__'`.
- **Credencial de serviço:** a comunicação G3 → Finance *nunca* usa o JWT do aluno. Usa `FINANCIAL_SERVICE_TOKEN` (fallback `SMARTCAMPUS_SERVICE_TOKEN`) autenticada como service principal (comparação constant-time).
- **Env vars runtime:** `SMARTCAMPUS_JWT_SECRET`, `FINANCIAL_SERVICE_TOKEN`/`SMARTCAMPUS_SERVICE_TOKEN`, `FINANCE_SERVICE_URL`, `CONTRACT_TIMEOUT_MS`.

## 4. Regra financeira (bloqueio de consulta de notas)

Fluxo por request de um **STUDENT** em rotas de notas (`GET /results`, `/results/:id`, `/assessments/:id/grades`, `/print/class/:id/pauta`):

1. Auth: validar token; identificar `role`.
2. `STUDENT` → resolver o perfil académico (`Student` ligado ao `User`). Sem perfil → `404 STUDENT_NOT_FOUND`.
3. Consultar `GET /financial-status/:studentId` com a **credencial de serviço**.
   - Serviço indisponível / erro de rede → **`503 FINANCIAL_VERIFICATION_UNAVAILABLE`** (fail-closed — nunca assume regular).
4. `hasDebt = true` → **`403 FINANCIAL_ACCESS_BLOCKED`** (mensagem: *"A consulta das notas está indisponível. Regularize a sua situação financeira."*). Frontend permanece silencioso (não mostra mensagens).
5. `hasDebt = false` → devolve apenas resultados do próprio utilizador.

**Notas abertas (staff):** `SCHOOL_ADMIN`/`TEACHER` vêem notas/pautas de qualquer aluno; na pauta, linhas de endividados vêm mascaradas (`debtRestricted: true`, `average: null`). Lançamento de nota a aluno endividado → `409 GRADES_BLOCKED_DUE_TO_DEBT`.

**Frontend — estado:** `GET /api/v1/me/financial-status` devolve apenas `{ status: "ACTIVE" | "BLOCKED", checkedAt }` (sem montantes).

## 5. Cobranças de avaliação (assessment-charges)

`POST /api/v1/financial/integration/assessment-charges` (Finance):

```json
{ "sourceModule": "G3", "sourceRequestId": "uuid", "studentUserId": "uuid", "feeCode": "ASSESSMENT-TAKE" }
```

- **Catálogo de taxas:** `ASSESSMENT-TAKE` (150 MZN), `EXAM-TAKE` (250 MZN), vencimento 5 dias.
- **Idempotência:** a mesma chave `sourceModule:sourceRequestId:studentUserId:feeCode` devolve o mesmo registo (`externalRegistrationId`), evitando cobranças duplicadas em retries.
- **Erros:** `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 FEE_NOT_FOUND`/`STUDENT_NOT_FOUND`.
- **Sem transações distribuídas:** G3 não coordena N+1 serviços; cada contrato é atómico por serviço.

## 6. Entidades e relações entre módulos

```
School ◄── User (role; schoolId)
  │
  ├── AcademicYear ◄── Term ◄── Class            (core: estrutura letiva)
  │                        └── Enrollment ──┬── Student ── User (STUDENT)
  │                                        └── Subject ── Teacher ── User (TEACHER)
  │
  └── FinancialStatus ── Student            (módulo Finance)
      (hasDebt, status, outstandingAmount)

G3 (tabelas próprias, todas com schoolId):
  Assessment ──(1..n)── Grade ── Student
  Schedule
  Result ── Student + Class + Subject + Term  (derivado das grades — nunca editado)
```

- `Student.userId` / `Teacher.userId` (nullable, `SetNull`) ligam perfis académicos aos utilizadores; `User.schoolId` garante o contexto multi-tenant.
- `Enrollment` valida `classId + subjectId + termId` na matrícula do aluno antes de lançar notas.
- `FinancialStatus.studentId` é `@unique`: no mínimo uma linha por estudante (estado financeiro).

## 7. Semear e validar localmente

- Banco: `docker-compose.yml` → PostgreSQL 16 na porta `5434` (`smartcampos/smartcampos`).
- Seed (`prisma/seed.ts`): `admin@ucjac.ac.mz/admin123`, `profN@ucjac.ac.mz/prof123`, `alunoN@ucjac.ac.mz/aluno123` (inclui `financial_statuses`).
- Correr os três serviços de contratos antes dos e2e de integração (os testes iniciam-nos em memória via `contractTestEnv.ts`).