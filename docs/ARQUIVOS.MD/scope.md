# ESCOPO — Módulo G3 (Avaliações e Horários)

> Produzido pelo **02. ScopeAgent** com base no `repository-report.md` e na ficha oficial.

## Objectivo

Disponibilizar uma **API autenticada e com autorização por role (RBAC)** para a gestão de:

```text
Avaliações  ·  Notas  ·  Médias ponderadas  ·  Resultados  ·  Horários  ·  Impressão de pautas e horários
```

para uma instituição de ensino superior (UCT-JAC, Moçambique), alinhada com o núcleo académico
do Smart Campus (anos lectivos, termos, turmas, alunos, disciplinas, professores, matrículas).

> **Actualizado (Módulo 5 do guia).** A ficha original descrevia o G3 como uma API
> pública e sem autenticação. A Sessão de Autenticação, Autorização e RBAC passou a
> fazer parte do módulo: o G3 valida o JWT, aplica `requireRole` por rota e mantém
> o utilizador dentro dos seus próprios recursos (anti-BOLA). A tabela de
> responsabilidades está em `docs/ROUTE_ACCESS.md`, gerada a partir de
> `infrastructure/auth/routeAccess.ts`.

## Actores funcionais

| Actor | Descrição | Interacção com o módulo |
|---|---|---|
| Coordenador académico | Cria/edita avaliações e horários | Autenticado, role `COORDINATOR` (ou superior) |
| Professor | Lança e corrige notas; consulta pautas | Autenticado, role `TEACHER`, limitado às turmas que lecciona |
| Aluno | Consulta resultados, notas e horário da turma | Autenticado, role `STUDENT`, limitado aos seus próprios dados |
| Secretaria académica | Imprime pautas/horários | Autenticado, role `SECRETARY` |
| Cliente externo / SDK | Qualquer consumidor via `packages/api-client` | Autenticado, com `Authorization: Bearer <JWT>` |

> **Nota:** a instituição já existe na base (schema do núcleo). Este módulo **não cria
> utilizadores nem credenciais** — apenas **valida** as credenciais que o Core emite
> e autoriza cada pedido. A emissão de tokens é responsabilidade do Core.

## Casos de uso

1. Criar avaliação (com tipo `TESTE`, `EXAME_NORMAL`, `EXAME_RECURRENCIA`).
2. Listar avaliações (filtros por termo, turma, disciplina, professor).
3. Obter avaliação por ID.
4. Actualizar avaliação (nome, data, peso, tipo, status, maxScore).
5. Eliminar avaliação — **bloqueado** (409) se existirem notas lançadas.
6. Lançar nota de um aluno numa avaliação.
7. Corrigir/alterar nota.
8. Listar notas de uma avaliação.
9. Criar horário (com detecção de conflito de professor/turma/sala → 409).
10. Listar/obter horários (filtros por termo, turma, professor, aluno).
11. Actualizar horário (re-valida conflitos).
12. Eliminar horário.
13. Calcular/publicar resultados de uma turma+disciplina+termo (operação atómica).
14. Listar resultados (filtros por termo, turma, disciplina, aluno).
15. Obter resultado por ID.
16. Recalcular resultado individual (PATCH).
17. Imprimir horário de uma turma.
18. Imprimir pauta de uma turma/disciplina.

## Dentro do escopo

- `Assessment` (avaliação), `Schedule` (horário), `Result` (resultado) e o subsistema de `Grade` (nota).
- Média ponderada `Σ(nota×peso)/Σ(pesos)`; status de resultado (`APPROVED`, `RECOVERY`, `FAILED`, `IN_PROGRESS`, `PENDING`).
- Detecção de conflitos de horário.
- Lançamento de nota + recálculo de resultado **atómico** (`prisma.$transaction`).
- Qualidade de dados: constraints CHECK no PostgreSQL + validação Zod.
- OpenAPI, API Client, manual, diagramas, testes e artefactos de evidência.

## Fora do escopo

- **Emissão** de tokens: login, passwords, refresh tokens e gestão de utilizadores
  pertencem ao Core. O G3 apenas consome e valida o JWT (`Authorization: Bearer`).
- Gestão de utilizadores (CRUD de utilizadores).
- CRUD de escolas, anos lectivos, termos, turmas, alunos, disciplinas, professores e matrículas
  (fazem parte do núcleo; são apenas lidos/reutilizados).
- Pautas finais de ano / aprovação institucional (fora do G3).
- Frontend (Swagger UI é documentação, não aplicação).

## Entidades principais

| Entidade | Descrição | Tabela (PostgreSQL) |
|---|---|---|
| `Assessment` | Avaliação de uma turma/disciplina num termo | `assessments` |
| `Grade` | Nota de um aluno numa avaliação | `grades` |
| `Schedule` | Bloco de horário (professor/turma/sala/dia) | `schedules` |
| `Result` | Resultado calculado por aluno/turma/disciplina/termo | `results` |

## Dependências (entidades do núcleo, apenas de leitura)

`School`, `AcademicYear`, `Term`, `Class`, `Subject`, `Teacher`, `Student`, `Enrollment`.

## Regras académicas adoptadas

1. **Peso deve ser > 0** (ficha: "Uma avaliação não pode ter peso <= 0").
2. **Nota dentro do intervalo** `[0, maxScore]` (máximo por avaliação, padrão 20).
3. **Tipo de avaliação** limitado a `TESTE`, `EXAME_NORMAL`, `EXAME_RECURRENCIA`.
4. **Nota só pode ser lançada/editada em avaliação `OPEN`**.
5. **Uma nota por aluno por avaliação** (unique `assessmentId + studentId`).
6. **Avaliação com notas não pode ser eliminada** (409).
7. **Peso/notas não podem ser alterados após lançamento de notas** (integridade do histórico).
8. **Não duplicar avaliação equivalente**: mesmo `classId + subjectId + termId + name` é repetição.
9. **Horários sem conflito** (professor, turma ou sala sobrepostos no mesmo dia e termo → 409).
10. `startTime < endTime` (formato `HH:mm`) e dias `MONDAY..SATURDAY`.
11. Média = `Σ(nota×peso)/Σ(pesos)` (arredondada a 2 casas).
12. `APPROVED` ≥ 10; `RECOVERY` 8..9,99; `FAILED` < 8; `IN_PROGRESS` quando faltam notas; `PENDING` sem notas.