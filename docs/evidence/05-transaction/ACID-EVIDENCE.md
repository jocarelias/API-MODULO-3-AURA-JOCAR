# Evidência de Atomicidade (ACID) — Lançamento de Notas

Ficheiro de teste: `src/modules/schedules-assessments/tests/g3.transaction.e2e.test.js`

## Resultado real (extraído de `docs/evidence/tests/e2e-tests.log`)

```
 RUN  v3.2.7 /home/Jocarelias/Documents/API HORARIOS

 ✓ src/modules/schedules-assessments/tests/g3.transaction.e2e.test.js (2 tests) 279ms
 ✓ src/modules/schedules-assessments/tests/g3.e2e.test.js (23 tests) 988ms

 Test Files  2 passed (2)
      Tests  25 passed (25)
```

## O que os 2 testes provam

1. **Rollback forçado**: um stub de `_recalculateInTx` faz o recálculo do resultado lançar um erro a meio do `prisma.$transaction`. Após o pedido, verifica-se que **a nota lançada NÃO existe** no banco — o rollback reverteu o `INSERT grade` juntamente com a falha do recálculo.
2. **Commit atómico**: no sucesso, a nota E o resultado recalculado são persistidos em conjunto; o resultado reflecte a nova média/status.

## Porque importa

Sem atomicidade, a nota ficaria gravada com média/status desactualizados — um estado corrompido e silencioso (aluno teria nota "lançada" mas situação errada). Com `$transaction`, não há ponto intermédio observável.

```js
// Padrão usado no serviço (application/schedulesAssessmentsService.js)
await prisma.$transaction(async (tx) => {
  const grade = await tx.grade.create(...);
  await recalculateForStudents(tx, assessment, [studentId]);
});
```