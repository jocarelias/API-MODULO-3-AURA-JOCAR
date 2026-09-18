# DOCUMENTAÇÃO FINAL — MÓDULO G3: AVALIAÇÕES E HORÁRIOS

**Sistema:** Smart Campus — Gestão Escolar
**Módulo:** G3 — Avaliações e Horários (API)
**Data:** 16 de Setembro de 2026
**Versão:** 1.0.0 (final)

---

## ÍNDICE

1. Introdução
2. Objectivos
3. Âmbito e Não-Âmbito
4. Estrutura do Repositório
5. Arquitectura da Solução
6. Camadas e Responsabilidades
7. Entidades do Domínio
8. Diagrama Entidade-Relacional (ER)
9. Diagrama de Classes (UML)
10. Mapa da Base de Dados (Prisma/Migrations)
11. Rotas e Contrato da API
12. Validação e Schemas (Zod)
13. Regras de Negócio
14. Cálculo de Médias e Situação Académica
15. Transacções ACID
16. Tratamento de Erros
17. Qualidade de Código e Auditoria
18. Testes Automatizados
19. API Aberta (Sem Autenticação)
20. Documentação e Evidências
21. OpenAPI / Swagger
22. Perguntas de Reflexão
23. Explicação do Código
24. Conclusão

---

## 1. Introdução

O módulo **G3 — Avaliações e Horários** é um subsistema do projecto Smart Campus, focado na
gestão de avaliações (testes e exames), notas, horários de aulas e cálculo automático dos
resultados académicos dos alunos, numa escala de 0 a 20 valores.

O módulo foi desenvolvido em **Node.js 24 + TypeScript + Express 5 + Prisma 6 + PostgreSQL 16**,
com **Zod 3** para validação, **Swagger/OpenAPI** para documentação e **Vitest + Supertest** para
testes. Está publicado como um conjunto de **workspaces npm** (`@smartcampus/shared-types`,
`@smartcampus/validation`, `@smartcampus/api-client`).

Toda a documentação de apoio, diagramas ER/UML, evidências de execução reais e este documento
Word foram gerados como artefactos do repositório em `docs/`.

## 2. Objectivos

1. Gerir avaliações (TESTE, EXAME_NORMAL, EXAME_RECURRENCIA) de turmas/disciplinas/períodos.
2. Lançar notas por aluno com validação de intervalo e unicidade (1 nota por aluno/avaliação).
3. Calcular automaticamente o **resultado** de cada aluno (média ponderada + situação académica).
4. Gerir horários de aulas com **detecção de conflitos** (professor, turma, sala).
5. Garantir **atomicidade** nas operações de nota + recálculo (transacções ACID).
6. Expor uma API aberta, sem autenticação, com contrato documentado em Swagger/OpenAPI.
7. Fornecer pauta e horário de turma em formato imprimível.
8. Publicar as bibliotecas partilhadas (DTOs, validação, cliente) para reutilização.

## 3. Âmbito e Não-Âmbito

**Dentro do âmbito:**

- Avaliações (CRUD), notas (CRUD), resultados (consulta/recálculo), horários (CRUD).
- Motor flexível de cálculo de notas com 6 métodos.
- Impressão de pauta e horário de turma.
- Documentação, diagramas, evidências e relatório final.

**Fora do âmbito (não foi implementado):**

- Autenticação, utilizadores, palavras-passe, roles/permissões, JWT/OAuth.
- Matrículas, gestão de alunos/professores (entidades reutilizadas, não criadas de novo).
- Pagamentos, mensalidades, finanças, CRM, recursos humanos.
- Frontend/interface de utilizador (a API é consumida por outros módulos).

## 4. Estrutura do Repositório

```
src/
├── main.ts                                          # boot, dotenv, porta 4100
├── app.ts                                           # Express, health, mount /api/v1, /api/docs, /api/openapi.json
├── openapi.ts                                       # spec OpenAPI 3.0.0 (sem security)
└── modules/schedules-assessments/
    ├── domain/
    │   ├── evaluation.ts                            # regras puras: tipos, média ponderada, status, horas
    │   ├── evaluation.test.ts                       # 21 testes unitários
    │   ├── calculationEngine.ts                     # motor de cálculo: 6 métodos, registry, sem eval
    │   └── calculationEngine.test.ts                # 54 testes unitários do motor
    ├── application/
    │   └── schedulesAssessmentsService.ts           # casos de uso, transações ACID, DomainError, TYPE_MAP
    ├── infrastructure/
    │   ├── prisma.ts                                # singleton do PrismaClient
    │   └── httpError.ts                             # mapeamento erro → HTTP (500/400/404/409)
    ├── schemas/
    │   └── index.ts                                 # schemas Zod autoritativos do módulo (inclui cálculo)
    ├── http/
    │   └── schedulesAssessmentsRouter.ts            # router Express + Zod + correlationId
    └── tests/
        ├── g3.e2e.test.ts                           # 29 testes de integração (API aberta)
        ├── calculation.e2e.test.ts                  # 18 testes e2e do motor de cálculo
        ├── error-scenarios.e2e.test.ts              # 3 testes de cenários de erro (400/404/500)
        └── g3.transaction.e2e.test.ts               # 2 testes ACID (rollback forçado)
packages/
├── shared-types/src/index.ts                        # DTOs, constantes, campusModules
├── validation/src/index.ts                          # re-exporta schemas do módulo
└── api-client/src/index.ts                          # cliente HTTP fetch (Node 24, TypeScript)
prisma/
├── schema.prisma                                    # Assessment, Grade, Schedule, Result
├── migrations/                                      # 3 migrations aplicadas
└── seed.ts                                          # dados UCT-JAC (Moçambique)
docs/                                                # diagramas, evidências, manuais, relatórios
docker-compose.yml                                   # PostgreSQL 16 na porta 5434
```

## 5. Arquitectura da Solução

A solução segue uma arquitectura em **camadas dentro do módulo** (`schedules-assessments`):

```
Consumidor ──HTTP/Swagger──► http/Router ──Zod──► schemas/index.ts
                                 │
                                 ▼ service
                            application/Service
                                 │
          ┌──────────────────────┼──────────────────────┐
          │  domain/evaluation.ts        (regras puras) │
          │  domain/calculationEngine.ts (motor)        │
          └──────────────────────┬──────────────────────┘
                                 │ Prisma
                            PostgreSQL 16
```

- **Domain (regras puras):** sem dependências de Express/Prisma. Testável instantaneamente.
- **Application/Service (orquestração):** usa o domínio e persiste com Prisma; faz transacções.
- **Infrastructure:** Prisma singleton e mapeamento erro→HTTP.
- **HTTP (Router):** só roteamento e validação Zod; sem regras de negócio.
- **Packages partilhados:** DTOs, validação e cliente tipado.

Decisão de auditoria: manteve-se o service coeso (~871 linhas) dentro do módulo, sem fracturar em
micro-camadas artificiais — a complexidade é dominada por regras concentradas nos ficheiros de domínio.

## 6. Camadas e Responsabilidades

| Camada | Ficheiro | Responsabilidade |
|---|---|---|
| Domínio | `domain/evaluation.ts` | Constantes (peso>0, cortes 10/8), validações puras, média ponderada, status |
| Domínio | `domain/calculationEngine.ts` | Motor de cálculo multi-método, registry de fórmulas, sem `eval` |
| Aplicação | `application/schedulesAssessmentsService.ts` | Casos de uso, `$transaction`, `TYPE_MAP`, regras |
| Infraestrutura | `infrastructure/prisma.ts` | Singleton do PrismaClient |
| Infraestrutura | `infrastructure/httpError.ts` | `toHttpError` (P2002→409, DomainError, 500) |
| Schemas | `schemas/index.ts` | Fonte única Zod; `@smartcampus/validation` re-exporta |
| HTTP | `http/schedulesAssessmentsRouter.ts` | Rotas, validate(), handler(), correlationId, paginação |
| Boot | `main.ts` / `app.ts` | Express, /api/v1, health, /api/docs, /api/openapi.json |
| Partilhado | `packages/*` | DTOs, schemas reutilizáveis, cliente HTTP |

## 7. Entidades do Domínio

**Assessment** (tabela `assessments`): uma avaliação de uma turma/disciplina/período.

- FKs: school, academicYear, term, class, subject, teacher.
- `name`, `type` (TEST/EXAM), `date`, `maxScore` (default 20), `weight` (default 1), `status`.
- Único por `(term, class, subject, name)`.

**Grade** (tabela `grades`): nota de um aluno numa avaliação.

- FKs: assessment, student.
- `score` ∈ [0, maxScore], `comment`, `status`.
- Único por `(assessment, student)` — 1 nota por aluno/avaliação.

**Schedule** (tabela `schedules`): aula do horário da turma.

- FKs: school, academicYear, term, class, subject, teacher.
- `dayOfWeek`, `startTime`, `endTime` (HH:mm), `room`, `status`.
- Índices compostos para conflitos (teacher/class/room + dayOfWeek).

**Result** (tabela `results`): resultado derivado do aluno num contexto.

- FKs: school, academicYear, term, class, subject, student, teacher (opcional).
- `average` (média ponderada), `finalScore`, `weightedTotal`, `calculationMethod`, `status`, `calculatedAt`.
- Único por `(student, class, subject, term)`. **Derivado**, nunca editado manualmente.

## 8. Diagrama Entidade-Relacional (ER)

**Versão humanizada em `docs/diagrams/er-diagram-humanized.md`** (caixas simples, preto-e-branco):

```
┌──────────────────────┐     1              N  ┌──────────────────────┐
│      ASSESSMENT      │ ──────────────────────►│        GRADE         │
│  PK id               │   (uma avaliação tem   │  PK id               │
│  FK term/class/      │    várias notas)       │  FK assessmentId     │
│      subject/teacher │                        │  FK studentId        │
│  name, type, date,   │                        │  score, comment      │
│  maxScore, weight    │                        └──────────────────────┘
└──────────────────────┘

┌──────────────────────┐     1              N  ┌──────────────────────┐
│       RESULT         │ ◄─────────────────────│        GRADE         │
│  PK id               │   (resultado deriva   │  FK assessmentId     │
│  FK student/class/   │    dos notas do aluno)│  FK studentId        │
│      subject/term    │                        └──────────────────────┘
│  average, status     │
└──────────────────────┘

SCHEDULE  →  1:N  TERM, CLASS, SUBJECT, TEACHER   (agenda por contexto)
```

**Contexto académico reutilizado (não duplicado):** `School 1:N AcademicYear/Term/Class/Subject/
Student/Teacher/Enrollment`; `Term 1:N Assessment/Schedule/Result`.

Versões editáveis: `docs/diagrams/er-diagram.dbml` (dbdiagram.io), `.drawio` e `.mmd`.

## 9. Diagrama de Classes (UML)

Em `docs/diagrams/class-diagram.mmd` (Mermaid, SVG exportado).

```
School    1 ─── *  Class        Term    1 ─── *  Assessment   Assessment 1 ─── * Grade
School    1 ─── *  Subject      Class   1 ─── *  Assessment   Grade      * ─── 1 Result
School    1 ─── *  Teacher      Subject 1 ─── *  Assessment   Result     1 ─── 1 Student
Teacher   1 ─── *  Assessment   Term    1 ─── *  Schedule
Teacher   1 ─── *  Schedule     Class   1 ─── *  Schedule
                                Subject 1 ─── *  Schedule
```

`Assessment.status` (EvaluationStatus), `Grade.status` (GradeStatus), `Schedule.status`
(ScheduleStatus), `Result.status` (ResultStatus) — enums do Prisma.

Mapeamento de tipo: API `TESTE|EXAME_NORMAL|EXAME_RECURRENCIA` → DB `TEST|EXAM` (via `TYPE_MAP`),
DTO devolve `TESTE|EXAME_NORMAL` (reverse map).

## 10. Mapa da Base de Dados (Prisma/Migrations)

### Migrations aplicadas (3)

| Migration | Conteúdo |
|---|---|
| `20260827075045_init` | Modelos base académicos (School, AcademicYear, Term, Class, Subject, Student, Teacher, Enrollment) |
| `20260909000000_add_schedules_assessments` | `Assessment`, `Grade`, `Schedule`, `Result` (renomeados de Evaluation/EvaluationGrade preservando dados) |
| `20260915071657_add_calculation_method` | `Result.calculationMethod` + enum `CalculationMethod` (6 métodos) |

`prisma migrate status` → **"3 migrations found … Database schema is up to date!"**. Evidência:
`docs/evidence/prisma/migrate-status.txt`.

### Enums do banco

- `EvaluationType`: TEST, EXAM, ASSIGNMENT, QUIZ, PROJECT, PRACTICAL, ORAL, OTHER.
- `EvaluationStatus`: DRAFT, SCHEDULED, OPEN, CLOSED, CANCELLED.
- `GradeStatus`: SUBMITTED, APPROVED, REVISED.
- `ScheduleStatus`: ACTIVE, INACTIVE, CANCELLED.
- `DayOfWeek`: MONDAY..SATURDAY.
- `ResultStatus`: APPROVED, RECOVERY, FAILED, PENDING, IN_PROGRESS.
- `CalculationMethod`: ARITHMETIC_MEAN, WEIGHTED_PERCENTAGE, PERCENTAGE_SUM,
  NORMALIZED_WEIGHTED_MEAN, COMPONENT_BASED, CUSTOM_WEIGHTED.

### Constraints CHECK activas

`weight > 0`, `maxScore > 0`, `score ∈ [0,100]`, `startTime < endTime`,
`average ∈ NULL|[0,100]` — evidência em `docs/evidence/07-data-quality/constraints.txt`.
---

## 11. Rotas e Contrato da API

Todas as rotas em `/api/v1`. Listas suportam paginação `page` (≥1) e `pageSize` (1–100), com `meta`.

| Rota | Métodos | Descrição |
|---|---|---|
| `/assessments` | GET, POST | Listar/criar avaliações |
| `/assessments/:id` | GET, PATCH, DELETE | Detalhe/actualizar/apagar avaliação |
| `/assessments/:assessmentId/grades` | GET, POST | Listar notas / lançar nota |
| `/assessments/:assessmentId/grades/:gradeId` | PATCH | Actualizar nota |
| `/schedules` | GET, POST | Listar/criar horários |
| `/schedules/:id` | GET, PATCH, DELETE | Detalhe/actualizar/apagar horário |
| `/results` | GET, POST | Listar resultados / recálculo em lote |
| `/results/:id` | GET, PATCH, DELETE | Detalhe/recálculo individual/apagar |
| `/results/calculation-methods` | GET | Listar 6 métodos de cálculo |
| `/results/calculate` | POST | Calcular nota com método flexível (sem persistir) |
| `/print/class/:classId/schedule` | GET | Horário imprimível da turma |
| `/print/class/:classId/pauta` | GET | Pauta imprimível da turma (recalculada na hora) |
| `/schools`, `/academic-years`, `/terms`, `/classes`, `/subjects`, `/teachers`, `/students` | GET | **Catálogo** (id + nome) para montar formulários sem decorar UUIDs |
| `/health` | GET | Health check |

**Contrato de resposta:** sucesso `{ data, meta: { correlationId, [page, pageSize, total] } }`;
erro `{ code, message, details, correlationId }`.

**Nomes legíveis:** todas as respostas de `assessments`, `grades`, `schedules` e `results` incluem
os nomes (`className`, `subjectName`, `teacherName`, `studentName`, `termName`) ao lado dos UUID —
para qualquer cliente conseguir usar a API directamente sem tabelas de referência.

**`@smartcampus/api-client`:** cliente tipado com `listAssessments`, `createAssessment`,
`createGrade`, `updateGrade`, `listSchedules`, `createResults`, `patchResult`/`updateResult`,
`deleteResult`, `printClassPauta`, `calculate`, `listCalculationMethods` e catálogos
(`listSchools`, `listAcademicYears`, `listTerms`, `listClasses`, `listSubjects`, `listTeachers`,
`listStudents`).

## 12. Validação e Schemas (Zod)

Fonte única em `src/modules/schedules-assessments/schemas/index.ts`, re-exportada por
`@smartcampus/validation`.

- `uuidSchema` — `z.string().uuid('ID inválido (deve ser um UUID)')`.
- `pageSchema` / `pageSizeSchema` — paginação (page ≥ 1, pageSize 1–100).
- `createAssessmentSchema` — `.strict()`: UUIDs obrigatórios, `type` enum de
  `EVALUATION_TYPES`, `date` ISO-8601 com offset, `maxScore` > 0 (default 20),
  `weight` > 0 (default 1).
- `createScheduleSchema` — dia da semana (enum), horas `HH:mm` (`TIME_PATTERN`), sala opcional.
- `createResultSchema` — turma/disciplina/período + `studentIds[]` opcionais.
- Schemas de **update** — todos os campos `.optional()` (PATCH parcial).
- `calculationInputSchema` — `superRefine` para regras cruzadas:
  - `items` não vazio (excepto `COMPONENT_BASED`);
  - `minScore < maxScore`;
  - `CUSTOM_WEIGHTED` exige `formula`;
  - `COMPONENT_BASED` exige `components`.

A validação corre em **três camadas**: Zod (HTTP) → domínio (regras puras) → PostgreSQL (CHECK/UNIQUE).

## 13. Regras de Negócio

### Avaliações

- Tipos (API): `TESTE`, `EXAME_NORMAL`, `EXAME_RECURRENCIA` (Zod) → DB `TEST`/`EXAM` via `TYPE_MAP`; DTO devolve `TESTE`/`EXAME_NORMAL` (reverse map).
- **Peso > 0** obrigatório (domínio + Zod + CHECK no DB).
- Média: `Σ(nota×peso)/Σ(pesos)` com `round2`; fallback aritmético se Σ(pesos)=0.
- Status: `APPROVED` (≥10), `RECOVERY` (≥8), `FAILED`, `IN_PROGRESS`, `PENDING`.
- Não duplicar avaliação (mesmo `termId+classId+subjectId+name`) → 409.
- Peso/`maxScore` **imutáveis após existirem notas** (409).
- DELETE de avaliação **bloqueado se houver notas** (409).

### Notas

- 1 nota por aluno/avaliação (`@@unique([assessmentId, studentId])`) — duplicada → 409.
- Nota só em avaliação `OPEN` (409); aluno tem de estar matriculado na turma+disciplina do período.
- Nota `[0, maxScore]` (400).
- **Recálculo de resultados é atómico**: create/update de nota dentro do `prisma.$transaction` + recálculo.

### Horários

- Dias `MONDAY`..`SATURDAY`; `HH:mm`; `start < end`.
- Conflito de professor, turma ou sala no mesmo dia/período → 409 com `details`.
- DELETE de horário permitido.

### Resultados

- `POST /api/v1/results` recalcula em lote (turma/disciplina/período); `PATCH /api/v1/results/:id` recalcula um.
- Upsert por `studentId_classId_subjectId_termId`; derivado das notas (nunca editado manualmente).
- `Result.calculationMethod` — qual método gerou o resultado.

## 14. Cálculo de Médias e Situação Académica

**Média ponderada** (escala 0–20):

```
média = Σ(nota × peso) / Σ(pesos)
```

- Arredondamento a 2 casas via `round2` (com `Number.EPSILON`).
- Fallback: se Σ(pesos) = 0 → média aritmética simples.

**Situação académica** (`resolveResultStatus`):

| Condição | Status |
|---|---|
| Sem avaliações nem notas no contexto | PENDING |
| Existem notas mas faltam outras avaliações | IN_PROGRESS |
| média ≥ 10 | APPROVED |
| 8 ≤ média < 10 | RECOVERY |
| média < 8 | FAILED |

**Motor de cálculo de notas** (`POST /results/calculate`, sem persistir):

- 6 métodos: `ARITHMETIC_MEAN`, `WEIGHTED_PERCENTAGE` (padrão), `PERCENTAGE_SUM`,
  `NORMALIZED_WEIGHTED_MEAN`, `COMPONENT_BASED`, `CUSTOM_WEIGHTED`.
- Fórmulas customizadas via **registry controlado** (`SUM`, `MAX`, `MIN`, `WEIGHTED_100`,
  `NORMALIZED_MEAN`, `MEAN_OF_TOP_K`) — **sem `eval`**.
- `minScore`/`maxScore` configuráveis (default 0/20); arredondamento final a 0/1/2 casas.
- Pesos 0–100; `WEIGHTED_PERCENTAGE` exige soma = `expectedTotal` (default 100); `COMPONENT_BASED`
  exige componentes com sub-items e soma dos pesos = 100.

## 15. Transacções ACID

**Cenário: lançar nota + recálculo de resultados** — tudo na mesma transacção:

```
prisma.$transaction(async (tx) => {
  const row = await tx.grade.create({ data: { assessmentId, studentId, score } });
  await this._recalculateInTx(tx, assessment, [studentId]);   // upsert em results
  return row;
});
```

Se qualquer passo falhar (por exemplo, o recálculo), **todo o rollback** é executado — a nota não
fica gravada e o resultado mantém os valores anteriores. Provado pelo teste
`g3.transaction.e2e.test.ts` com falha forçada no recálculo:

```
transacção começa
  → grade.create(...)            ✅ OK
  → _recalculateInTx(...)        ❌ FALHA
rollback → grade NÃO é guardado
         → resultado mantém valores anteriores
```

Isolamento, consistência e durabilidade garantidos pelo PostgreSQL + Prisma transaction support.

## 16. Tratamento de Erros

`infrastructure/httpError.ts` normaliza erros num envelope único:

`{ code, message, details, correlationId }`

| Erro | HTTP | `code` |
|---|---|---|
| Validação Zod / regra de domínio | 400 | `VALIDATION_ERROR` / `BAD_REQUEST` |
| Entidade não encontrada | 404 | `NOT_FOUND` |
| Conflito (duplicado, imutabilidade, horário, transacção) | 409 | `CONFLICT` |
| Violação de constraint Prisma (P2002) | 409 | `CONFLICT` |
| Erro inesperado | 500 | `INTERNAL_ERROR` |

A API **nunca devolve 401/403** (sem autenticação). `DomainError` concentra o mapeamento
código → status HTTP num único sítio.

## 17. Qualidade de Código e Auditoria

- **TypeScript estrito** (`tsc --noEmit` limpo em todo o workspace).
- **Sem comentários** no código (convenção do repositório).
- Arquitectura em camadas (domain/application/infrastructure/http/schemas).
- Regras de negócio **concentradas** no domínio — sem `eval`, sem lógica em rotas.
- Auditoria completa em `docs/review/repository-audit.md` (classificações
  ✅ 🔧 🔁 🗑 ➕ 🔄 ⚠️, problemas P1–P8 com impacto e correcção, checklist da ficha).
- Decisões registadas: manter service coeso; estrutura real `src/modules/...` validada no README
  e AGENTS.md; converter `.js→.ts`; remover código/documentação morta.

## 18. Testes Automatizados

**142 testes a passar (75 unitários + 67 e2e).**

| Suite | Ficheiro | Testes | Cobre |
|---|---|---|---|
| Unit | `domain/evaluation.test.ts` | 21 | Tipos, peso > 0, intervalo de nota, média ponderada, status, horas |
| Unit | `domain/calculationEngine.test.ts` | 54 | 6 métodos, fórmulas, arredondamento, erros 400/409 |
| E2E | `tests/g3.e2e.test.ts` | 29 | CRUD, DELETE, 409s, recálculo, impressão, contratos |
| E2E | `tests/calculation.e2e.test.ts` | 18 | Motor de cálculo via HTTP |
| E2E | `tests/error-scenarios.e2e.test.ts` | 3 | 400/404/500 |
| E2E | `tests/g3.transaction.e2e.test.ts` | 2 | ACID: rollback forçado + sucesso atómico |

```bash
npm run test:unit   # 75 passed
npm run test:e2e    # 52 passed
npm run typecheck   # limpo
```

Evidências reais: `docs/evidence/tests/` (logs actualizados).

## 19. API Aberta (Sem Autenticação)

Conforme a ficha, o módulo **não tem autenticação**: sem modelos User/Password/passwordHash,
sem login, sem JWT/Bearer, sem RBAC. Não existem rotas 401/403. O Swagger não contém
`securitySchemes`.

Os testes verificam explicitamente que as respostas **não contêm** as palavras
`password`, `passwordHash`, `senha`, `accessToken`, `refreshToken`, `bearer`.

## 20. Documentação e Evidências

| Artefacto | Local |
|---|---|
| Diagrama ER humanizado | `docs/diagrams/er-diagram-humanized.md` |
| Modelo de entidades | `docs/entity-model.md` |
| Explicação linha a linha do código | `docs/code-explanation.md` |
| Auditoria / revisão de código | `docs/review/repository-audit.md` |
| Análise do repositório | `docs/REPOSITORY_ANALYSIS.md` |
| Manual de APIs core | `docs/manual-apis-core.md` |
| Perguntas de reflexão (4 da ficha) | `docs/reflection-questions.md` |
| OpenAPI | `docs/openapi.yaml` |
| Modelo Prisma | `docs/prisma-model.md` |
| Evidências de execução | `docs/evidence/` (migrate, constraints, counts, curls, testes) |
| Testes com resposta da ficha | `docs/G3-exercicios-respostas.md` |
| Report final | `README.md`, `G3_FINAL_REPORT.md` |

## 21. OpenAPI / Swagger

- Spec **OpenAPI 3.0.0** servida em `/api/openapi.json` (runtime) e `docs/openapi.yaml` (estática).
- **Swagger UI** disponível em `/api/docs` (assets locais de `swagger-ui-dist`).
- Todas as rotas, parâmetros, schemas de request/response e erros documentados.
- Sem `securitySchemes`, sem `password`/`bearer`.

## 22. Perguntas de Reflexão

Respostas completas em `docs/reflection-questions.md`.

**1. O que aconteceria aos dados se a operação não fosse transaccional e falhasse a meio?**
Estado inconsistente: nota gravada em `grades` sem actualização do resultado; médias desactualizadas.
Com `prisma.$transaction`, qualquer falha → rollback total, integridade preservada.

**2. Qual foi a regra de negócio mais difícil de traduzir para código?**
O cálculo da média ponderada dentro de uma transacção atómica: (a) atomicidade do recálculo;
(b) múltiplos estados do resultado (APPROVED/RECOVERY/FAILED/IN_PROGRESS/PENDING); (c) conflitos
de horário cruzando professor+turma+sala no mesmo período.

**3. Que diferença fez ter o schema de validação separado do controller?**
Reutilização (`@smartcampus/validation`), testabilidade, responsabilidade única, consistência
entre endpoints e manutenção centralizada.

**4. Um outro grupo perceberia o modelo só com OpenAPI + Prisma?**
Sim com limitações: OpenAPI+Prisma mostram estrutura e contrato, mas as **regras de negócio**
(imutabilidade de peso, unicidades, cálculo da média, transacções) exigem a documentação
adicional (`manual-apis-core.md`, README, diagramas).

## 23. Explicação do Código

Documento dedicado: **`docs/code-explanation.md`** — explicação pedagógica linha a linha (com
referências de números de linha) de `evaluation.ts`, `calculationEngine.ts`, `schemas/index.ts`,
`router`, `app.ts`, DTOs e motor de cálculo. Inclui fluxos ilustrativos (lançar nota ACID e
imprimir pauta).

## 24. Conclusão

O módulo **G3 — Avaliações e Horários** está **completo e validado**:

- **142 testes verdes** (75 unit + 67 e2e) e `typecheck` limpo.
- **Transacções ACID** provadas com rollback forçado.
- **API aberta** (sem auth), contrato documentado e clientes tipados.
- **Diagramas ER/UML** humanizados e editáveis; **evidências reais** de execução.
- **Auditoria** registada e documentação **alinhada** (README, AGENTS.md, docs, Word).
- Instalação **1-comando** com `docker compose up -d` (PostgreSQL 16, porta 5434).

O módulo está pronto para ser avaliado e reutilizado por outros módulos do Smart Campus.
