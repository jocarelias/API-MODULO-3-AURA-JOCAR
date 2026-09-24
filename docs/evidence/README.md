# Evidências de Implementação — Módulo G3

Todos os resultados abaixo foram recolhidos diretamente do ambiente (sem simulação): comandos reais, respostas HTTP reais e logs de execução.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `01-modeling` | Diagramas (SVG + PNG): ER, classes, casos de uso, sequência, fluxo da média (+ fontes `.mmd`/`.dbml`/`.drawio` em `docs/diagrams/`) |
| `02-prisma` | `migrate status` __"3 migrations found … up to date"__ · Prisma Studio em `:5555` |
| `03-crud` | HTTP real (curl): health, listas com paginação, create assessment/schedule, recálculo lote, impressão, OpenAPI, Swagger UI, delete schedule |
| `04-business-rules` | Nota 201 · duplicado 409 · peso/maxScore imutável 409 · delete com notas 409 · nota fora da escala 400 · avaliação fechada 409 · delete sem notas 200 |
| `05-transaction` | Prova ACID: `g3.transaction.e2e.test.ts` (2 testes) — rollback forçado no recálculo (nota NÃO persiste) |
| `06-errors` | Envelopes de erro reais: 400 Zod (payload, peso 0, pageSize>100, aluno não matriculado), 404, 409 horário, 500 simulada |
| `07-data-quality` | psql real: CHECK constraints (peso>0, nota≤100, horário, average) · UNIQUE indexes (grade por avaliação+aluno; result por aluno+turma+disciplina+período) · contagens · amostra média/status |
| `tests` | Logs: `unit-tests.log` (75 passed) e `e2e-tests.log` (52 passed, incl. 2 ACID) |

## Como ler cada prova

- `03-crud/02-list-assessments.json` → `{"data":[3], "meta":{"page":1,"pageSize":3,"total":31}}` — paginação real.
- `04-business-rules/03-immutable-weight-409.json` → peso imutável após notas.
- `05-transaction` → o teste injeta falha no recálculo dentro do `$transaction` e confirma que a nota lançada **não fica persistida**.
- `07-data-quality/constraints.txt` → constraints ativas no PostgreSQL (defesa em profundidade).

## Reprodução

```bash
npm run test:unit          # 75 passed
npm run test:e2e           # 52 passed (incl. 2 ACID)
prisma migrate status      # up to date (3 migrations)
prisma studio --port 5555  # http://localhost:5555
npx tsx src/main.ts        # http://localhost:4100/api/v1
```