# Credenciais de Desenvolvimento — Módulo G3

> **Aviso.** Estas credenciais são geradas por `prisma/seed.ts` e servem apenas
> para desenvolvimento e testes locais. Não as usar em nenhum ambiente
> partilhado, publicado ou de produção.

Verificadas contra a API a correr em `2026-10-05` — todas devolveram `HTTP 200`
em `POST /api/v1/auth/login`.

---

## 1. Como obter um token

```bash
curl -s -X POST http://localhost:4100/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"prof1@ucjac.ac.mz","password":"prof123"}'
```

O token vem em `data.accessToken` (não no topo da resposta):

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshExpiresIn": 604800,
    "user": { "id": "...", "role": "TEACHER", "name": "..." }
  }
}
```

Depois usa-se como `Authorization: Bearer <accessToken>`.

Validade: **15 minutos** para o access token (`expiresIn: 900`) e **7 dias**
para o refresh token (`refreshExpiresIn: 604800`). Para renovar:

```bash
curl -s -X POST http://localhost:4100/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}'
```

---

## 2. Utilizadores

| Role | Email | Password | Nome |
|---|---|---|---|
| `SUPER_ADMIN` | `admin@ucjac.ac.mz` | `admin123` | Administrador UCT-JAC |
| `TEACHER` | `prof1@ucjac.ac.mz` | `prof123` | Armando Correia |
| `TEACHER` | `prof2@ucjac.ac.mz` | `prof123` | Leandro Titos |
| `TEACHER` | `prof3@ucjac.ac.mz` | `prof123` | Carsolino Sambo |
| `STUDENT` | `aluno1@student.ucjac.ac.mz` | `aluno123` | Ana JAC |
| `STUDENT` | `aluno2@student.ucjac.ac.mz` | `aluno123` | Berto Catarina |
| `STUDENT` | `aluno3@student.ucjac.ac.mz` | `aluno123` | Carlos UC |

### Resumo

| Role | Password |
|---|---|
| `SUPER_ADMIN` | `admin123` |
| `TEACHER` | `prof123` |
| `STUDENT` | `aluno123` |

A password **não** é individual: é a mesma para todos os utilizadores da mesma
role. Só o `admin` tem password própria.

---

## 3. Testar o endpoint escolhido

`GET /api/v1/assessments/{assessmentId}/grades`

Avaliações úteis do seed:

| assessmentId | Descrição |
|---|---|
| `a4a6c3b2-65cc-4d29-a11d-361eeb5be091` | turma do `aluno1` — o STUDENT tem posse |
| `587aa5cc-59fb-487b-af89-44f380e5ee8b` | outra turma — anti-BOLA |

```bash
# TEACHER -> 200, devolve todas as notas da turma
curl -s -X GET \
  http://localhost:4100/api/v1/assessments/a4a6c3b2-65cc-4d29-a11d-361eeb5be091/grades \
  -H "Authorization: Bearer $TOKEN_PROF"

# STUDENT -> 200, devolve apenas a nota dele
curl -s -X GET \
  http://localhost:4100/api/v1/assessments/a4a6c3b2-65cc-4d29-a11d-361eeb5be091/grades \
  -H "Authorization: Bearer $TOKEN_ALUNO"

# STUDENT noutra turma -> 403 FORBIDDEN
curl -s -X GET \
  http://localhost:4100/api/v1/assessments/587aa5cc-59fb-487b-af89-44f380e5ee8b/grades \
  -H "Authorization: Bearer $TOKEN_ALUNO"

# sem token -> 401 UNAUTHENTICATED
curl -s -X GET \
  http://localhost:4100/api/v1/assessments/a4a6c3b2-65cc-4d29-a11d-361eeb5be091/grades

# id inexistente -> 404 NOT_FOUND
curl -s -X GET \
  http://localhost:4100/api/v1/assessments/00000000-0000-0000-0000-000000000001/grades \
  -H "Authorization: Bearer $TOKEN_PROF"
```

---

## 4. No Swagger UI

1. Abrir `http://localhost:4100/api/docs`
2. Expandir `Autenticação` → `POST /api/v1/auth/login` → **Try it out** → **Execute**
3. Copiar `data.accessToken`
4. Clicar em **Authorize**, colar o token (só o token, sem a palavra `Bearer`) e confirmar
5. Expandir `Notas` → `GET /api/v1/assessments/{assessmentId}/grades` → **Try it out**

Para trocar de role, recarregar a página (o Swagger UI não persiste o token) e
repetir os passos 2–4.

Capturas de referência em `docs/evidence/semana-06/swagger-ui/`.

---

## 5. Outras credenciais de desenvolvimento

| Serviço | Valor |
|---|---|
| PostgreSQL (dev) | `postgresql://smartcampos:smartcampos@localhost:5434/smartcampos` |
| PostgreSQL (testes) | `postgresql://smartcampos:smartcampos@localhost:5434/smartcampos_test` |
| students | `http://localhost:4101/api/v1` |
| finance | `http://localhost:4104/api/v1` |
| API G3 | `http://localhost:4100/api/v1` |

A assinatura dos JWTs é `JWT_SECRET` em `.env`. Alterar essa variável invalida
todos os tokens emitidos.

---

## 6. Regras de segurança aplicadas no módulo

- Todas as rotas exigem `Authorization: Bearer <token>`, excepto
  `POST /auth/login` e `POST /auth/refresh`.
- O token é validado por assinatura, expiração e payload: um token com
  assinatura adulterada, payload forjado ou `exp` no passado devolve
  `401 UNAUTHENTICATED`.
- As roles são declaradas numa fonte única (`routeAccess.ts`) e a tabela
  `docs/ROUTE_ACCESS.md` é gerada a partir dela.
- O acesso a notas é filtrado por posse (`resolveStudentScope`), não apenas por
  role — um `STUDENT` só recebe as notas da sua turma.