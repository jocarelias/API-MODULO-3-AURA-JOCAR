# Diagrama de Componentes — Módulo G3 (Estrutura aplicada)

```mermaid
flowchart LR
    subgraph App["src/app.js / main.js (Express 5)"]
        H[GET /api/v1/health]
        DOCS[GET /api/docs · /api/openapi.json]
        R[GET/POST/PATCH/DELETE /api/v1/*]
    end

    subgraph Module["src/modules/schedules-assessments/"]
        HTTP["http/schedulesAssessmentsRouter.js"]
        SCH["schemas/index.js (Zod)"]
        APP["application/schedulesAssessmentsService.js"]
        DOM["domain/evaluation.js"]
        INF["infrastructure/prisma.js + httpError.js"]
    end

    subgraph Packages["packages/* (workspaces @smartcampus)"]
        ST["shared-types (DTOs · constantes)"]
        VL["validation (re-exporta schemas)"]
        AC["api-client (cliente HTTP)"]
    end

    subgraph ORM["Prisma Client 6"]
        P1[(PostgreSQL 16)]
    end

    R --> HTTP
    HTTP -->|valida e normaliza| SCH
    HTTP --> APP
    SCH --> VL
    HTTP --> INF
    APP -->|casos de uso + $transaction| INF
    APP -->|regras puras| DOM
    APP -->|serialização| ST
    AC -->|fetch| HTTP
    INF --> ORM --> P1

    classDef package fill:#eef,stroke:#88a;
    class ST,VL,AC package;
```

**Frontier/regra**: os schemas Zod autoritativos vivem no módulo (`schemas/index.js`); `packages/validation` apenas os re-exporta para outros módulos/futura infra. DTOs partilhados ficam em `packages/shared-types`. `httpError.js` centraliza o mapeamento erro → HTTP (inclui P2002 → 409).