# Test Payloads — Módulo G3 (Avaliações e Horários)

JSONs prontos a usar (validados contra os schemas Zod do módulo). Substitua os UUID se recriar o
seed. A API corre em `http://localhost:4100/api/v1`.

## Ficheiros

| Ficheiro | Usar em | Método |
|---|---|---|
| `create-assessment.json` | `/assessments` | POST |
| `update-assessment.json` | `/assessments/:id` | PATCH |
| `create-grade.json` | `/assessments/:assessmentId/grades` | POST |
| `update-grade.json` | `/assessments/:assessmentId/grades/:gradeId` | PATCH |
| `create-schedule.json` | `/schedules` | POST |
| `update-schedule.json` | `/schedules/:id` | PATCH |
| `recalculate-results.json` | `/results` | POST |
| `calculate-score.json` | `/results/calculate` | POST |

## Exemplos

```bash
BASE=http://localhost:4100/api/v1
ASM=595b586c-ceac-4722-9ac0-49c5501d451d   # Teste 1 - PTP 3 (OPEN)

# Criar avaliação
curl -s -X POST "$BASE/assessments" \
  -H 'Content-Type: application/json' \
  -d @docs/test-payloads/create-assessment.json

# Lançar uma nota (avaliação OPEN, aluno matriculado)
curl -s -X POST "$BASE/assessments/$ASM/grades" \
  -H 'Content-Type: application/json' \
  -d @docs/test-payloads/create-grade.json

# Recalcular resultados de uma turma/disciplina/período
curl -s -X POST "$BASE/results" \
  -H 'Content-Type: application/json' \
  -d @docs/test-payloads/recalculate-results.json

# Calcular uma nota com método ponderado (sem persistir)
curl -s -X POST "$BASE/results/calculate" \
  -H 'Content-Type: application/json' \
  -d @docs/test-payloads/calculate-score.json

# Imprimir pauta da turma
curl -s "$BASE/print/class/df12a7a2-b47b-413e-8308-b0d5b6ef53dd/pauta?subjectId=26c5ef3c-67ce-436c-9c45-c2a4cf28ceaf&termId=b1ec59f2-8ae4-48e2-b9b0-24172da51ce8"
```

> Todos os UUID de referência estão em `docs/UUID_REFERENCE.md`.