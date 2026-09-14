# Perguntas de Reflexão — Módulo G3

## 1. O que aconteceria aos dados se a operação do exercício 5 não fosse transaccional e falhasse a meio?

Se a operação de lançar nota + recálculo de resultado não fosse transaccional, uma falha a meio deixaria os dados num estado inconsistente. Por exemplo:

- A nota seria gravada na tabela `grades`, mas o resultado em `results` não seria actualizado.
- O aluno ficaria com uma nota lançada que não contabiliza na média.
- Outros resultados dependentes ficariam desactualizados.
- A média calculada não reflectiria a realidade.

Com a transacção ACID (`prisma.$transaction`), se qualquer passo falhar (como demonstrado no teste `g3.transaction.e2e.test.ts` com "falha forçada no recálculo"), **todo o rollback** é executado: a nota não é gravada e o resultado mantém os valores anteriores. A integridade dos dados é preservada.

**Exemplo real do módulo G3:**
```
transacção começa
  → grade.create(studentId: X, score: 15)    ✅ OK
  → _recalculateInTx()                       ❌ FALHA
rollback → grade NÃO é guardado
         → resultado mantém valores anteriores
         → nenhum estado parcial permanece
```

## 2. Qual foi a regra de negócio mais difícil de traduzir para código, e porquê?

A regra mais difícil foi o **cálculo da média ponderada dentro de uma transacção atómica**. As dificuldades foram:

1. **Atomicidade:** O cálculo envolve ler todas as avaliações, todas as notas do aluno, depois calcular a média e fazer upsert no resultado — tudo dentro de uma transacção. Se a transacção falhar, tudo tem que ser rollback.

2. **Múltiplos estados:** O resultado pode ser APPROVED, RECOVERY, FAILED, IN_PROGRESS ou PENDING dependendo das notas existentes. Determinar o estado correcto requer considerar todas as avaliações (não apenas a que está a ser lançada).

3. **Conflitos de horário:** A detecção de conflitos em horários (professor, turma e sala no mesmo período) exige cruzar múltiplos campos num conjunto de horários existentes e gerar mensagens de erro detalhadas com `details`.

**No código:**
```typescript
const created = await this.prisma.$transaction(async (tx) => {
  const row = await tx.grade.create({ data: { ... } });
  await this._recalculateInTx(tx, assessment, [input.studentId]);
  return row;
});
```

## 3. Que diferença fez ter o schema de validação separado do controller?

Ter os schemas Zod separados (em `schemas/index.ts`) do controller (em `http/schedulesAssessmentsRouter.ts`) trouxe benefícios concretos:

1. **Reutilização:** Os schemas são re-exportados pelo `@smartcampus/validation`, permitindo que outros módulos ou clientes usem as mesmas regras.

2. **Testabilidade:** Cada schema é uma unidade independente que pode ser testada isoladamente — verificar que peso=0 é rejeitado, que tipo inválido é bloqueado, etc.

3. **Responsabilidade única:** O controller foca-se em roteamento (mapear HTTP → service), e a validação fica encapsulada. O código fica mais limpo e legível.

4. **Consistência:** Todos os endpoints usam os mesmos padrões de validação. Não é possível esquecer uma validação num endpoint.

5. **Manutenção:** Alterar uma regra de validação (ex: adicionar um novo tipo de avaliação) requer apenas alterar o schema, sem tocar no controller ou no service.

## 4. Se outro grupo tivesse de reutilizar a API sem ver o código, o schema Prisma e o OpenAPI seriam suficientes para perceber o modelo?

**Sim, mas com limitações:**

**O que seria suficiente:**
- **OpenAPI (`openapi.yaml`)**: Documenta todos os endpoints, parâmetros, schemas de request/response e códigos de erro. Qualquer frontend/consumidor saberia exactamente o que enviar e receber.
- **Prisma (`schema.prisma`)**: Mostra todas as entidades, relações, tipos de dados, enums, índices e constraints. Um desenvolvedor perceberia a estrutura completa da base de dados.

**O que falta:**
- As **regras de negócio** não estão no OpenAPI nem no Prisma (ex: "peso é imutável depois de lançar notas", "não duplicar avaliação", "cálculo da média ponderada").
- O **mapeamento de tipos API↔DB** (TESTE → TEST, EXAME_NORMAL → EXAM) não é evidente.
- A **lógica transaccional** (atmicidade na criação de nota + recálculo) não aparece na documentação declarativa.

**Conclusão:** Um grupo experiente poderia reutilizar a API usando apenas OpenAPI + Prisma, mas precisaria da documentação adicional (`manual-apis-core.md`, `README`) para perceber as regras de negócio e decisões de design.
