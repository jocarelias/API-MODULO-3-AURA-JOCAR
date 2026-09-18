# Evidências de Testes — Módulo G3 (Avaliações e Horários)

Data: **2026-09-09**. Ferramentas: Vitest 3 + Supertest 7 + Prisma 6 (PostgreSQL 16 dev). Comandos: `npm run test:unit` e `npm run test:e2e`.

## Resultado final consolidado

```text
Unit (domínio):  21 passed
E2E (API aberta): 25 passed
Total:            46 passed  0 failed
```

## Suite unitária — `src/modules/schedules-assessments/domain/evaluation.test.js` (21)

Cobre: tipos `TESTE|EXAME_NORMAL|EXAME_RECURRENCIA`; `validateWeight` (**peso 0 rejeitado**), `validateScore` (intervalo e maxScore custom), `weightedAverage` (ponderada + fallback aritmética + lista vazia), `resolveResultStatus` (PENDING/IN_PROGRESS/APPROVED/RECOVERY/FAILED), `computeCompleteResult`, `validateTimeRange` (formato e orientação). Sem acesso a banco.

## Suite e2e — `src/modules/schedules-assessments/tests/g3.e2e.test.js` (23)

| # | Teste | Verificação-chave |
|---|---|---|
| 1 | GET assessments sem auth | 200, `data` array, meta.correlationId |
| 2 | Respostas sem credenciais | sem passwordHash/token/bearer |
| 3 | Health abierto | 200 `{status:ok}` |
| 4 | Echo `x-request-id` | meta + header iguais ao fornecido |
| 5 | Rota inexistente | 404 `NOT_FOUND`, meta ausente |
| 6 | Zod payload inválido | 400 `VALIDATION_ERROR` com `details` |
| 7 | Zod peso zero | 400 (novo requisito da ficha) |
| 8 | Zod tipo inexistente | 400 |
| 9 | CRUD create+get | 201/200, `type: TESTE`, maxScore 20 |
| 10 | Duplicata de assessment | 409 `CONFLICT` |
| 11 | Peso/maxScore pós-notas | 409 (imutabilidade) |
| 12 | DELETE com notas | 409 (bloqueio) |
| 13 | DELETE sem notas | 200 `{id, deleted:true}` + GET 404 |
| 14 | Nota fora da escala | 400; nota no limite aceite 201 |
| 15 | Nota duplicada (aluno) | 409 |
| 16 | Nota em avaliação não OPEN | 409 |
| 17 | Recálculo automático ao lançar | result `IN_PROGRESS` após nova avaliação sem nota |
| 18 | PATCH recálculo individual | 200 com average/status |
| 19 | POST /results lote | 201, lista resultante |
| 20 | Horário: criar/duplicar/eliminar | 201 → 409 (conflito) → 200 |
| 21 | Impressão horário de turma | 200 com schedules |
| 22 | Pauta sem subjectId | 400 `BAD_REQUEST` |
| 23 | openapi.json | rotas novas sem `/schedules-assessments`; sem security |

## Suite ACID — `src/modules/schedules-assessments/tests/g3.transaction.e2e.test.js` (2)

- **Rollback forçado**: `_recalculateInTx` substituído por função que lança erro → `createGrade` rejeita, e **a nota não fica persistida** (`grade` é null) e o resultado anterior mantém average/status intactos.
- **Sucesso atómico**: nota criada com recálculo persistido (grade legível no DB).

## Smoke manual (execução real do servidor)

```text
node src/main.js
health:             200 ✔
GET /api/v1/assessments: 200 ✔
GET /api/docs:          200 ✔ (Swagger local)
```

## Correlação ficha ↔ testes

- **400/404/409/500**: cobertos (1,5-8,10-16,20,22).
- **Sem 401/403**: sem qualquer teste/assert a exigir auth; spec sem security (2,23).
- **ACID**: rollback e commit verificados (transaction suite).
- **Qualidade de dados**: 400/409 por duplicação e estado; pesos/escalas validadas no domínio, na API e no DB (CHECKs — ver `implementation-evidence.md`).