# Diagrama ER — Módulo G3 (Avaliações e Horários)

## Ficheiros

| Ficheiro | Formato | Propósito |
|---|---|---|
| `er-diagram.svg` | SVG | Visual final (o diagrama) |
| `er-diagram.mmd` | Mermaid | Fonte editável do diagrama |
| `er-diagram.dbml` | DBML | Especificação textual de base de dados |
| `er-diagram.drawio` | draw.io XML | Edição em draw.io/diagrams.net |

## Entidades

- **Assessments** — avaliação (TEST/EXAM). Campos: `id`, `type`, `termId`, `classId`, `subjectId`, `title`, `startTime`, `endTime`, `maxScore`, `weight`, `status`, `createdAt`, `updatedAt`. Unicidade composta `(termId, classId, subjectId, title)`. Checks: `endTime > startTime`, `maxScore > 0`, `weight > 0`.
- **Grades** — nota de um aluno numa avaliação. `id`, `assessmentId` (FK→Assessments), `studentId`, `score`, `createdAt`. Unicidade composta `(assessmentId, studentId)` → **1 nota por aluno por avaliação**. `score ∈ [0, maxScore]`.
- **Results** — resultado agregado do aluno. `id`, `studentId`, `termId`, `classId`, `subjectId`, `average`, `status`, `statusReason`, `createdAt`, `updatedAt`. Unicidade `(studentId, termId, classId, subjectId)`. **Deriva das notas** (média ponderada).
- **Schedules** — horário. `id`, `termId`, `classId`, `subjectId`, `startTime`, `endTime`, `room`, `professorId`, `createdAt`, `updatedAt`. Conflito de professor/turma/sala → 409 (regra no service).

## Relações (cardinalidades)

- `Assessment 1─* Grade` (uma avaliação tem várias notas)
- `Grade *─1 Result` (as notas derivam o resultado) — seta tracejada no diagrama
- Assessment/Result/Schedule referenciam **Term, Class, Subject, Student** (entidades externas partilhadas, fora do módulo G3)

## Como regenerar o PNG

Mermaid CLI está indisponível neste ambiente (npm bloqueado). O ficheiro `.mml`/`.mmd` pode ser visualizado em [mermaid.live] ou editado no draw.io pelo `.drawio`. O SVG foi escrito à mão como entregável estático.

## Regras de negócio associadas

- Lançar/atualizar nota → recalcula média e grava/recalcula `results` dentro do MESMO `$transaction` (ACID).
- `PASSING = 10`, `RECOVERY = 8` em `domain/evaluation.js`.
- Upload de `maxScore`/`weight` é proibido depois de existirem notas (409 `DISALLOWED_MUTATION`).