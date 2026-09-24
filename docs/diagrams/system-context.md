# Diagrama de Contexto do Sistema — Módulo G3

```mermaid
flowchart LR
    subgraph Usuarios
        SEC[Secretaria]
        DOC[Professor]
        ALU[Aluno]
    end

    subgraph API_G3["API aberta do módulo G3 (porta 4100)"]
        ROUTER[Router Express /api/v1]
    end

    subgraph DB["PostgreSQL 16 (localhost:5434, smartcampos)"]
        TABLES[(schools · academic_years · terms · classes · subjects / teachers / students / enrollments · assessments · grades · schedules · results)]
    end

    UIS[Outras aplicações Smart Campus]
    OAS[Swagger UI /api/docs]

    SEC -->|HTTP/JSON sem auth| ROUTER
    DOC -->|lança notas, horários| ROUTER
    ALU -->|consulta resultados| ROUTER
    UIS -->|API aberta| ROUTER
    OAS -->|openapi.json| ROUTER

    ROUTER -->|Prisma ORM| DB
```

**Notas de contexto**
- API **aberta**: nenhum mecanismo de autenticação (sem JWT/Bearer/RBAC/Senha) neste módulo — sem `401/403`.
- Contrato uniforme: sucesso `{data, meta:{correlationId}}`, erro `{code, message, details, correlationId}`.
- `swagger-ui-dist` servido localmente em `/api/docs` (sem CDN externo).