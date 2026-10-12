# Contrato de integração — Financeiro ↔ Avaliações e Horários

**Versão:** 0.2 · **Data:** 2026-10-08 · **Emissor:** Gestão Financeira de Estudantes · **Destinatário:** Avaliações e Horários.

**Estado: proposta para revisão entre grupos.** “Existente” significa implementado na branch local `feature/financial-core-alignment` do Core; não significa publicado num servidor partilhado. “Declarado pelo parceiro” refere-se ao documento recebido, sem teste independente. As rotas `/financial/integration/*`, scopes e cobranças de origem são propostas **ainda não implementadas**. Este ficheiro é autónomo e pode ser enviado isoladamente.

## Fonte e alterações desta versão

Base: documento recebido «Arquitetura e Especificação do Módulo G3 — Avaliações, Horários e Visão Geral do Core Académico», secções 2.2–2.5. A cópia original está em `recebidos/modulo-g3-arquitetura.docx` neste pacote. O documento declara uma arquitectura e rotas; não comprova que estejam implementadas ou testadas.

A v0.2 alinha a consulta de resultados com `/api/v1/results`, retira inscrições em avaliações e sessões do âmbito assumido como confirmado e dá preferência à comunicação interna no monólito. Nenhuma restrição financeira foi aceite pelo G3 até ao momento.

## Responsabilidades e âmbito

Avaliações e Horários é **um único módulo de grupo (G3)**. Declara gerir avaliações, horários e resultados. Disciplina, Estudante e Docente são entidades relacionadas; a sua menção não transfere a propriedade dos dados dos outros grupos. O Financeiro fornece regularidade e situação de cobranças; não recebe nem altera notas. Inscrições em avaliações, sessões, exames pagos e respectivos estados **não estão definidos no documento recebido**.

### API declarada pelo G3

| Método e rota | Pedido descrito pelo G3 | Sucesso | Erros declarados |
|---|---|---|---|
| GET `/api/v1/assessments` | — | 200 | 401, 403 |
| GET `/api/v1/schedules` | — | 200 | 401, 403 |
| GET `/api/v1/results` | — | 200 | 401, 403 |
| POST `/api/v1/assessments` | Dados da avaliação; campos por definir | 201 | 400, 401, 403 |
| POST `/api/v1/results` | Dados do resultado; campos por definir | 201 | 400, 401, 403 |

A matriz de permissões declara STUDENT para consultar avaliações disponíveis, os seus horários e os seus resultados; TEACHER para gerir avaliações/resultados das suas disciplinas; COORDINATOR para gerir horários. O G3 deve confirmar a associação exacta destas permissões a cada rota, incluindo acesso de docentes às consultas. Não foi declarada uma rota de escrita de horários nem uma permissão ADMIN/FINANCE sobre os dados do G3.

Faltam DTOs de pedido/resposta, campos obrigatórios, paginação/filtros, identificadores e relações, estados/transições e códigos de erro de domínio. Os paths frontend `/assessments` e `/schedules` estão declarados como `development`; não foi indicado um path frontend próprio para resultados.

### Dependências financeiras propostas

| Operação | Fornecedor → consumidor | Estado |
|---|---|---|
| Regularidade antes de consultar resultados, caso a regra seja aprovada | Financeiro → G3 | Proposta; não consta do documento recebido |
| Cobrança de taxa de exame/recurso | G3 → Financeiro | Opcional; depende de o grupo confirmar este processo |
| Verificação do estudante e da operação que origina uma taxa | G3 → Financeiro | Interface e recurso por definir, apenas se houver cobrança |
| Consultas normais de avaliações e horários | G3 → utilizador | Sem dependência financeira proposta por defeito |

### Dados mínimos a acordar

O G3 deve indicar como Resultado e Horário se relacionam com `User.id`, `StudentProfile.id` e Disciplina, e como verifica que uma disciplina pertence ao docente. O utilizador autenticado é resolvido pelo Core; um `studentId` enviado pelo browser não prova a titularidade. Os DTOs de resultados pertencem ao G3 e não devem ser enviados ao Financeiro para verificar regularidade.

As rotas `/api/v1/assessments/registrations/:id` e `/api/v1/schedules/sessions/:id` sugeridas na v0.1 **não são rotas declaradas pelo parceiro e deixam de ser requisitos desta proposta**. Se houver taxas, acordar primeiro um recurso individual de origem, o identificador estável, a ligação ao estudante e as condições de elegibilidade. Não atribuir estados PENDING/CONFIRMED/CANCELLED a entidades do G3 antes desse acordo.

### Regras de negócio a confirmar pelo grupo

- A consulta STUDENT em `GET /api/v1/results` deve respeitar a titularidade declarada pelo G3, independentemente de qualquer regra financeira.
- **Bloqueio financeiro de resultados: pendente de aprovação pelo G3 e coordenação.** Só se aprovado, o backend G3 consulta a regularidade antes de devolver os resultados próprios: BLOCKED → 403 `FINANCIAL_ACCESS_BLOCKED`; indisponibilidade → 503 `FINANCIAL_VERIFICATION_UNAVAILABLE`; ACTIVE → prosseguir com as regras académicas. Estes códigos são adições propostas, não erros já declarados/implementados pelo parceiro. Aplicar a mesma regra a futuras vias de consulta/exportação equivalentes, se forem criadas.
- Não estender essa proposta ao lançamento de resultados em `POST /api/v1/results`, à gestão docente de avaliações ou à consulta normal de horários. O Financeiro não concede autorização para gerir disciplinas ou notas.
- Se uma operação paga for confirmada, definir se exige regularidade, regularização da taxa específica ou ambas. `externalResourceId` deve identificar essa operação para aquele estudante; não usar o ID de uma avaliação comum a vários estudantes. `EXAM_RESIT` abaixo é apenas um código ilustrativo.
- Alterações de sala/data não geram automaticamente taxas. Cancelamentos e reembolsos precisam de regras próprias se o grupo introduzir cobranças.
- Após regularização, repetir a verificação na próxima operação sujeita à regra, sem conservar um bloqueio antigo no login.

## Convenções e identidade

Base relativa: `/api/v1`. URL de cada ambiente e responsáveis técnicos: **a preencher pelos grupos**. JSON UTF-8; datas ISO 8601 UTC; IDs strings opacas. A emissão de tokens pertence ao Core/Auth, não ao Financeiro. Propagar `x-correlation-id` e devolver a correlação no envelope.

```json
{"data":{"exemplo":"valor"},"meta":{"correlationId":"corr-exemplo"}}
```

```json
{"code":"FORBIDDEN","message":"Sem permissão para esta operação.","details":[],"correlationId":"corr-exemplo"}
```

Identidades distintas: `studentUserId = User.id` do Core; `studentProfileId = StudentProfile.id`; número de matrícula é `studentNumber`. No endpoint financeiro actual, o parâmetro chamado `studentId` significa **User.id**. No contrato recebido de Estudantes e Docentes, `Enrolment.studentId` significa **StudentProfile.id**. O consumidor resolve e verifica a correspondência; não compara nem copia estes IDs como se fossem iguais.

## Autenticação e permissões

**Existente:** `Authorization: Bearer <accessToken>` do Core, com permissões por utilizador. Nas consultas financeiras, STUDENT vê apenas os seus dados; FINANCE e ADMIN podem consultar outros estudantes. COORDINATOR e TEACHER não ganham acesso financeiro automaticamente.

**Arquitectura preferida para G3:** o documento recebido descreve um monólito modular, com API e PostgreSQL partilhados. Propomos uma interface interna da camada de aplicação financeira, com contexto autenticado do Core, autorização explícita da operação e DTO mínimo. O G3 não consulta directamente tabelas financeiras. Esta interface ainda precisa de implementação e acordo; não exige criar tokens de serviço para chamadas dentro do mesmo processo.

**Alternativa para integrações HTTP, se necessária:** uma identidade de serviço por módulo, com operações permitidas explícitas e origem derivada da credencial validada. O Core actual não emite estes tokens de serviço nem implementa os scopes deste documento. Antes de activar as rotas propostas, acordar com a coordenação a emissão/verificação e os scopes. Uma role de utilizador não identifica um módulo; o campo `sourceModule` enviado no corpo também não autentica ninguém.

No monorepo, a alternativa é uma interface interna de aplicação que recebe identidade/contexto autorizado e aplica as mesmas regras. Não chamar funções financeiras ignorando autorização. Em serviços separados, usar HTTPS, destinatário do token validado e credenciais de serviço. Não partilhar contas ADMIN/FINANCE, palavras-passe ou segredos JWT entre grupos.

## Consulta de regularidade

**Existente na branch local do Core:** `GET /api/v1/financial/students/:studentId/status`. Destina-se aos perfis acima e contém detalhes financeiros. Exemplo de sucesso, com os campos efectivamente existentes:

```json
{"data":{"studentId":"user-123","status":"ACTIVE","reason":null,"blockedAt":null,"overdueDebtsCount":0,"totalOverdueAmount":0,"updatedAt":"2026-10-08T08:00:00.000Z"},"meta":{"correlationId":"corr-exemplo"}}
```

**Proposta para consumo entre módulos:** `GET /api/v1/financial/integration/students/:studentUserId/standing`, com permissão proposta `financial:standing:read`. Esta rota **ainda não existe**. Resposta mínima proposta, sem saldo, dívidas ou motivos privados:

```json
{"data":{"studentUserId":"user-123","status":"ACTIVE","checkedAt":"2026-10-08T08:00:00.000Z"},"meta":{"correlationId":"corr-exemplo"}}
```

Campos obrigatórios: `studentUserId: string`, `status: ACTIVE | BLOCKED`, `checkedAt: string` ISO date-time. A resposta deve corresponder ao estudante solicitado. `ACTIVE` significa regular segundo a política financeira, **não ausência de todas as dívidas nem pagamento de uma taxa específica**. `BLOCKED` é calculado considerando vencimento, tolerância, limite e activação do bloqueio automático. Estado financeiro não substitui estado académico, autorização de acesso ou disponibilidade de um serviço.

A consulta é feita no backend do consumidor imediatamente antes da operação sujeita a validação. É uma observação naquele instante, não uma reserva nem uma transacção distribuída. Não confiar num estado enviado pelo browser ou guardado no login. Não cancelar automaticamente operações já confirmadas devido a alterações posteriores.

## Falhas e recuperação

| Resposta/situação | Comportamento do consumidor |
|---|---|
| 200 ACTIVE, identidade correcta | Aplicar as restantes regras da operação; verificar taxa específica se exigida |
| 200 BLOCKED | Aplicar apenas a restrição expressamente acordada; não bloquear todo o sistema |
| 404 STUDENT_NOT_FOUND | Tratar identidade desconhecida; não concluir que está regular |
| 401/403 na chamada de serviço | Registar falha de configuração/permissão; devolver erro de indisponibilidade ao utilizador, sem o classificar como devedor |
| Timeout, rede, 429/5xx, JSON inválido ou identidade divergente | Não confirmar a operação que exige validação; devolver 503 FINANCIAL_VERIFICATION_UNAVAILABLE e permitir nova tentativa |
| 400 VALIDATION_ERROR / 409 de negócio | Corrigir dados ou apresentar conflito; não repetir cegamente |

No Core, 401 pode usar `UNAUTHORIZED` ou `TOKEN_INVALID`; o contrato de Estudantes e Docentes usa `UNAUTHENTICATED`; o documento G3 indica apenas os estados HTTP. Tratar o estado HTTP e negociar a uniformização; não exigir um único código ainda não harmonizado.

Timeout proposto de 5 segundos por chamada; até 3 tentativas totais para consultas/idempotentes em falha de rede ou 5xx, com espera progressiva. Em 429, respeitar `Retry-After`; se exceder o tempo do pedido, adiar a retoma. Não repetir automaticamente escritas sem chave de idempotência. Conservar a correlação em logs sem tokens ou dados pessoais desnecessários.

## Cobrança de uma operação — contrato proposto

Extensão **opcional**, sem processo de cobrança confirmado pelo G3. Não é pré-requisito das cinco rotas declaradas. As rotas abaixo são **por implementar** no Financeiro:

| Método e rota | Permissão de serviço proposta | Resultado |
|---|---|---|
| POST `/api/v1/financial/integration/charges` | `financial:charges:create` restrito à origem deste grupo | 201 criação; 200 repetição idêntica |
| GET `/api/v1/financial/integration/charges/:debtId` | `financial:charges:read` restrito à mesma origem | 200 estado da cobrança; 404 inexistente ou de outra origem |

Pedido POST com cabeçalhos `Authorization`, `Idempotency-Key` e `x-correlation-id`:

```json
{"sourceModule":"assessments-schedules","sourceRequestId":"pedido-001","studentUserId":"user-123","externalResourceId":"recurso-001","feeCode":"EXAM_RESIT"}
```

Todos os campos são strings obrigatórias, não vazias. Limites propostos: IDs e chave até 200 caracteres; `feeCode` até 60. `sourceModule` é o valor fixo indicado neste documento e deve corresponder à identidade do serviço. `externalResourceId` identifica a operação de origem definida abaixo. A chave `Idempotency-Key` é `assessments-schedules:pedido-001` e deve corresponder a `sourceRequestId`.

O Financeiro determina valor e vencimento a partir de um catálogo de taxas aprovado, ainda por implementar. O consumidor não escolhe livremente o montante, não confirma pagamentos e não escreve nas tabelas financeiras. Antes de criar, validar que o recurso de origem existe, pertence ao estudante e está elegível; a rota/interface que permite essa verificação deve ser acordada antes da implementação.

Resposta proposta para criação, repetição ou consulta:

```json
{"data":{"debtId":"debt-001","sourceModule":"assessments-schedules","sourceRequestId":"pedido-001","studentUserId":"user-123","externalResourceId":"recurso-001","feeCode":"EXAM_RESIT","amount":"1500.00","currency":"MZN","dueDate":"2026-11-01T00:00:00.000Z","status":"PENDENTE"},"meta":{"correlationId":"corr-exemplo"}}
```

Todos os campos são obrigatórios. `amount` é uma string decimal positiva com duas casas; `currency` é `MZN`; `status` é `PENDENTE | VENCIDA | REGULARIZADA | CANCELADA`. A API administrativa existente usa montantes numéricos: este formato é exclusivo da proposta de integração e não uma alteração já aplicada.

Persistir atomicamente a criação e as chaves únicas `(sourceModule, sourceRequestId)` e `(sourceModule, externalResourceId, feeCode)`. Mesmo pedido/chave devolve a dívida original, mesmo se o catálogo tiver mudado. Chave repetida com conteúdo diferente: 409 `IDEMPOTENCY_CONFLICT`. Nova chave para a mesma origem/recurso/taxa: 409 `CHARGE_ALREADY_EXISTS`, com identificação da cobrança só para a origem autorizada. Não guardar estes identificadores apenas no campo textual `origin` da dívida actual.

Outros erros propostos: 400 `UNKNOWN_FEE_CODE`/`VALIDATION_ERROR`; 404 `STUDENT_NOT_FOUND`/`SOURCE_RESOURCE_NOT_FOUND`; 409 `SOURCE_RESOURCE_CONFLICT` (recurso cancelado ou estudante divergente); 503 `SOURCE_VERIFICATION_UNAVAILABLE`. A consulta devolve 404 `CHARGE_NOT_FOUND` sem revelar cobranças de outra origem.

Uma taxa `REGULARIZADA` satisfaz a obrigação dessa cobrança, incluindo eventual dispensa por contestação procedente; não é necessariamente prova de entrada de dinheiro. `CANCELADA` exige reavaliar a operação de origem, não vale como pagamento. Cancelamento, reembolso, estorno e substituição de cobrança não estão incluídos nesta versão. Se não forem necessários pagamentos, não criar uma dependência financeira para essa operação.

## Critérios mínimos de aceitação conjunta

Estes são testes a executar em conjunto, não resultados de testes já realizados. Primeiro verificar as cinco rotas declaradas e a titularidade: STUDENT não vê resultados/horários de outro estudante; TEACHER não gere avaliações/resultados de disciplina alheia. Confirmar a rota de gestão de horários do COORDINATOR quando o G3 a definir. Os cenários financeiros abaixo só se aplicam às operações cuja dependência financeira seja acordada.

1. Resolver `StudentProfile.id → User.id` e confirmar que os IDs do pedido e da resposta coincidem.
2. Testar ACTIVE, BLOCKED, estudante inexistente, token ausente/inválido e serviço sem permissão.
3. Impedir consulta/escrita sobre recursos de outro estudante ou de outra origem; testar pedidos directos à API.
4. Simular timeout e indisponibilidade: nunca confirmar silenciosamente a operação nem atribuir dívida por falha técnica.
5. Se houver cobranças, testar repetição idêntica, chave com conteúdo divergente e duas criações concorrentes: só uma dívida válida.
6. Após regularização, repetir a validação e confirmar o comportamento acordado, sem cache antiga na sessão.
7. Verificar que nenhum endpoint de integração expõe histórico financeiro, telefone, palavra-passe ou tokens desnecessários.

## Pontos para confirmar e aceite

Antes de implementar em conjunto, registar: responsáveis de ambos os grupos; URL/ambiente; versão do Core; mecanismo de autenticação de serviço; scopes; endpoints reais do fornecedor; IDs; operações que exigem regularidade/taxa; códigos e catálogo de taxas; política para cancelamentos; resultados dos testes.

| Campo | Preenchimento pelos grupos |
|---|---|
| Responsável do Financeiro | A preencher |
| Responsável do módulo parceiro | A preencher |
| URLs e ambiente de testes | A preencher |
| Rotas e versão aceites | A preencher |
| DTOs, IDs e estados do G3 | A definir pelo G3 |
| Associação de roles às rotas | A confirmar pelo G3 |
| Interface interna ou HTTP | Proposta: interna no monólito; a acordar |
| Restrição de GET /results por regularidade | Não aprovada; confirmar com G3 e coordenação |
| Existe operação paga? Recurso e taxa? | Não declarado; a confirmar |
| Operações/restrições aprovadas | A preencher |
| Data de acordo | A preencher |
| Estado | Proposta para revisão; não aprovado |

Alterações incompatíveis exigem versão de contrato e nota de migração. Este documento não autoriza bloquear funcionalidades adicionais nem dá acesso administrativo ao módulo consumidor.
