# Diagrama ER — Módulo G3 (Avaliações e Horários)

## Ficheiros

| Ficheiro | Formato | Propósito |
|---|---|---|
| `er-diagram.svg` | SVG | Visual final (o diagrama) |
| `er-diagram.mmd` | Mermaid | Fonte editável do diagrama |
| `er-diagram.dbml` | DBML | Especificação textual de base de dados |
| `er-diagram.drawio` | draw.io XML | Edição em draw.io/diagrams.net |
| `er-diagram-humanized.md` | Markdown/Texto | Versão humanizada em caixas ASCII (preto e branco) |

## Entidades

- **Assessments** — avaliação (TEST/EXAM). Campos: `id`, `type`, `name`, `date`, `termId`, `classId`, `subjectId`, `teacherId`, `maxScore`, `weight`, `status`, `createdAt`, `updatedAt`. Não duplicação `(termId, classId, subjectId, name)` → 409. Checks: `maxScore > 0`, `weight > 0`.
- **Grades** — nota de um aluno numa avaliação. `id`, `assessmentId` (FK→Assessments), `studentId`, `score`, `comment`, `status`, `createdAt`, `updatedAt`. Unicidade composta `(assessmentId, studentId)` → **1 nota por aluno por avaliação**. `score ∈ [0, maxScore]`.
- **Results** — resultado agregado do aluno. `id`, `studentId`, `termId`, `classId`, `subjectId`, `teacherId`, `average`, `finalScore`, `calculationMethod` (método usado, ex.: `WEIGHTED_PERCENTAGE`), `status`, `calculatedAt`, `createdAt`, `updatedAt`. Unicidade `(studentId, classId, subjectId, termId)`. **Deriva das notas** (média ponderada, recalculado em transacção).
- **Schedules** — horário. `id`, `termId`, `classId`, `subjectId`, `teacherId`, `dayOfWeek`, `startTime`, `endTime`, `room`, `status`, `createdAt`, `updatedAt`. Conflito de professor/turma/sala → 409 (regra no service).

## Relações (cardinalidades)

- `Assessment 1──N Grade` (uma avaliação tem várias notas)
- `Grade *──N Result` (as notas derivam o resultado)
- Assessment/Schedule/Result referenciam **Term, Class, Subject, Student, Teacher** (entidades académicas partilhadas, fora do módulo G3)
- Todas as entidades do módulo referenciam **School** e **AcademicYear** (contexto académico)

## Como regenerar o SVG

```bash
npx mmdc -i docs/diagrams/er-diagram.mmd -o docs/diagrams/er-diagram.svg -b transparent
```

O `.mmd` também pode ser visualizado em [mermaid.live] ou editado no draw.io pelo `.drawio`.

## Regras de negócio associadas

- Lançar/atualizar nota → recalcula média e grava/recalcula `results` dentro do MESMO `$transaction` (ACID).
- `PASSING = 10`, `RECOVERY = 8` em `domain/evaluation.ts`.
- Upload de `maxScore`/`weight` é proibido depois de existirem notas (409).
- DELETE de avaliação com notas → 409.
- `RESULT_STATUS`: `APPROVED (≥10)` · `RECOVERY (≥8)` · `FAILED (<8)` · `IN_PROGRESS` · `PENDING`.