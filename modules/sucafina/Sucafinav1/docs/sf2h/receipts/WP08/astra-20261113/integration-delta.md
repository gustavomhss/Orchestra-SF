# WP08 — deltas de integração por owner

## Escopo e situação evidencial

Este documento propõe mudanças nos owners correspondentes; nenhuma mudança estrangeira foi aplicada por este agente. O código WP08 fica em `modules/sucafina/Sucafinav1/product/collaboration/` e suas provas autoradas em `modules/sucafina/Sucafinav1/test/product/wp08/`. Inputs estrangeiros arquivados continuam preservados e não são versões canônicas.

A matriz `criteria-132.json` contém os 132 IDs/textos exatos do pack: 109 critérios das seis tasks e 23 axiomas WP-level, sem IDs extras, faltantes ou duplicados. Cada teste é um vínculo de escopo autorado, não uma prova integral inferida pelo nome do arquivo. `validation.json` é a fonte final dos product/CI SHAs, run IDs, resultados e limites de cada rodada hospedada; esse recibo distingue testes aprovados, falhas e gates ausentes. Este documento descreve o wiring e os deltas, sem transformar a seleção cirúrgica em aceite integral. As falhas concretas de Procurement correspondem ao bloqueio WP08-B01 abaixo. Nenhuma execução local de produto ocorreu.

## 1. WP10 — composição, rota HTTP e concessões

### Exports a consumir

- `modules/sucafina/Sucafinav1/product/collaboration/host.ts#createCollaborationHost` compõe relações, threads, handoff, Meu trabalho, ciclo, seleção de caso, confirmação e reuso de resposta.
- `modules/sucafina/Sucafinav1/product/collaboration/human.ts#createCollaborationHumanAuthority` e `collaborationHumanActions` implementam a admissão privada de mutações humanas. A instância deve receber a mesma `ui` devolvida pela autoridade autenticada da instalação.
- `modules/sucafina/Sucafinav1/product/collaboration/http.ts#createCollaborationHttp` recebe `{ origin, mount, host, human, admitRead, finishRead }` e devolve `(request) => Promise<Response | undefined>`.
- `modules/sucafina/Sucafinav1/product/collaboration/http-routes.ts#createCollaborationHttpRoutes` é a tabela interna de 28 rotas usada pelo adaptador. Não é uma tabela de concessões empresariais.

Montar `createCollaborationHttp` na composição autenticada já existente. `mount` é o pathname completo de uma superfície, por exemplo o mesmo pathname já fornecido à aplicação, e não apenas o prefixo comum. O adaptador exige origem, pathname, header Origin e POST compatíveis; atende somente `?sf=collaboration-*` e retorna `undefined` para outra família. Não se deve instalar um segundo servidor ou presumir que o arquivo estrangeiro inexistente `product/interface/collaboration-http.ts` contém esse consumidor.

`modules/sucafina/Sucafinav1/product/interface/http.ts#createSfWorkbenchHttp` continua owner WP01/WP10: seu allowlist atual contém `workbench-*`, não as novas rotas `collaboration-*`. O owner do router deve encadear o novo handler antes do fallback, sem simplesmente adicionar os nomes ao allowlist antigo. O serviço deve reutilizar a instância de `createCollaborationHost`, preservando o mapa privado de recibos prepare/confirm entre requisições.

### Dez ações humanas e quatro registros ainda necessários

O export `collaborationHumanActions` contém exatamente:

```ts
[
  "collaboration.thread.create",
  "collaboration.thread.reply",
  "collaboration.thread.resolve",
  "collaboration.thread.edit",
  "collaboration.relation.confirm",
  "collaboration.handoff.confirm",
  "collaboration.confirmation.confirm",
  "collaboration.selection.create",
  "collaboration.answer.confirm",
  "collaboration.question.confirm",
]
```

Em `modules/sucafina/Sucafinav1/product/integration/human-authority.ts#sfHumanActions`, o seed já registra as seis primeiras famílias antigas, mas faltam `collaboration.thread.edit`, `collaboration.selection.create`, `collaboration.answer.confirm` e `collaboration.question.confirm`. `modules/sucafina/Sucafinav1/product/integration/product-authority.ts#createSfProductAuthority` valida `SfProductGrant.humanActions` contra aquele array e constrói `ui.privateCommands` a partir dele. O owner deve unir o export WP08 à lista de ações aceitas e ao tipo de grant, sem remover as ações existentes. O host passa `createCollaborationHumanAuthority({ origin, ui })` ao consumidor e aos ports WP08.

Cada mutação necessita a ação exata em `humanActions`, autoridade de escrita atual e os namespaces pertinentes. Thread/create/reply/resolve/edit, answer/confirm e question/confirm escrevem `threads`; question/confirm também exige leitura atual de `cases` e, para output nativo, `contributions`; relation/handoff escrevem `relations`; confirmation/confirm escreve `confirmations`; selection/create escreve `preferences` e verifica a versão atual de `cases`. Handoff também exige a permissão final do domínio Hot Topics. Diretório, nome do destinatário ou uma relação existente não substituem grants.

### Leitura privada sem exigir escrita

As 15 leituras abaixo precisam de admissão privada sobre operação e digest do payload integral. Uma convenção concreta compatível com o adaptador é `sf-read:${operation}`; o prefixo é proposta de integração, não um export já instalado:

```ts
const collaborationReadActions = [
  "collaboration.thread.read",
  "collaboration.thread.history",
  "collaboration.relation.read",
  "collaboration.confirmation.prepare",
  "collaboration.confirmation.project",
  "collaboration.answer.prepare",
  "collaboration.answer.read",
  "collaboration.selection.list",
  "collaboration.selection.version",
  "collaboration.cycle.read",
  "collaboration.work.list",
  "collaboration.work.destination",
  "collaboration.recipients",
  "collaboration.storage.version",
  "collaboration.question.output",
] as const
```

O owner deve registrar esses nomes prefixados em `createSfUiAuthority.privateCommands` e em `SfProductGrant.operations` apenas para os principais autorizados. Eles não são novos capabilities residentes. A ramificação de autorização para essas leituras deve usar o grant de operação e os acessos atuais de origem/namespace, sem exigir `actor.canWrite`. Isso evita recriar o defeito em que abrir um Hot Topic em Meu trabalho exigia permissão de alteração.

Admissão proposta, usando a `ui` real já conectada a `DomainPortHost.requestFor`:

```ts
const admittedReads = new Set(collaborationReadActions)
const admitRead = async (request, operation, payload) => {
  if (!admittedReads.has(operation))
    return { status: "denied", reason: "collaboration-read-unavailable" }
  const command = `sf-read:${operation}`
  const digest = digestSfValue(payload)
  const admitted = await ui.admit(request, command, digest)
  if (admitted.status !== "ok") return admitted
  if (!await ui.validate(admitted.value, command, digest)) {
    ui.finish(admitted.value)
    return { status: "denied", reason: "collaboration-read-unavailable" }
  }
  return admitted
}
const handler = createCollaborationHttp({
  origin,
  mount: actualSurfacePathname,
  host: collaborationHost,
  human: createCollaborationHumanAuthority({ origin, ui }),
  admitRead,
  finishRead: ui.finish,
})
```

O snippet descreve wiring proposto e requer os imports/tipos do owner; não é evidência de mount. Não construir um `TrustedUiContext` por JSON ou headers do chamador. O adapter chama `finish`/`finishRead` no `finally` e mantém o payload exato para autorização humana.

Namespaces de leitura: thread/history e answer usam `threads`; relation usa `relations`; confirmation/project usa `confirmations`; selection usa `preferences` e `cases`; Meu trabalho lê `threads`, `relations` e `confirmations`, além de `preferences` para seleções de caso e os domínios efetivamente selecionados. `storage-version` consulta somente o namespace solicitado. As permissões reais de cada evidência e campo continuam nos produtores.

### Contrato HTTP exato

| Valor de `sf` | Ação recebida pelo adapter | Modalidade | Chaves externas do JSON |
|---|---|---|---|
| `collaboration-question-consume` | `collaboration.question.confirm` | Mutação humana | `proposal, sourceRef, period, mutation` |
| `collaboration-question-output` | `collaboration.question.output` | Leitura privada | `outputRef, caseRef` |
| `collaboration-thread-create` | `collaboration.thread.create` | Mutação humana | `draft, mutation` |
| `collaboration-thread-read` | `collaboration.thread.read` | Leitura privada | `id` |
| `collaboration-thread-reply` | `collaboration.thread.reply` | Mutação humana | `id, body, mutation` |
| `collaboration-thread-resolve` | `collaboration.thread.resolve` | Mutação humana | `id, mutation` |
| `collaboration-thread-edit` | `collaboration.thread.edit` | Mutação humana | `id, messageId, expectedVersion, body, mutation` |
| `collaboration-thread-history` | `collaboration.thread.history` | Leitura privada | `id, messageId, incarnation, version` |
| `collaboration-relation-create` | `collaboration.relation.confirm` | Mutação humana | `operation, pair, mutation` |
| `collaboration-relation-remove` | `collaboration.relation.confirm` | Mutação humana | `operation, id, pair, mutation` |
| `collaboration-relation-read` | `collaboration.relation.read` | Leitura privada | `recordRefs` |
| `collaboration-handoff-create` | `collaboration.handoff.confirm` | Mutação humana | `intent, sourceRef, relationKey, recipientRef?` |
| `collaboration-handoff-link` | `collaboration.handoff.confirm` | Mutação humana | `topicRef, sourceRefs, sourceRef, relationKey, recipientRef?` |
| `collaboration-handoff-update` | `collaboration.handoff.confirm` | Mutação humana | `topicId, expectedVersion, idempotencyKey, values, sourceRefs, sourceRef, relationKey, recipientRef?` |
| `collaboration-confirmation-prepare` | `collaboration.confirmation.prepare` | Leitura privada | `scope` |
| `collaboration-confirmation-confirm` | `collaboration.confirmation.confirm` | Mutação humana | `scope, observedSourceVersion, expectedScopeFingerprint, expectedStorageVersion, idempotencyKey` |
| `collaboration-confirmation-project` | `collaboration.confirmation.project` | Leitura privada | `id` |
| `collaboration-answer-prepare` | `collaboration.answer.prepare` | Leitura privada | `questionId, answerRef` |
| `collaboration-answer-confirm` | `collaboration.answer.confirm` | Mutação humana | `questionId, answerRef, mutation` |
| `collaboration-answer-read` | `collaboration.answer.read` | Leitura privada | `questionId` |
| `collaboration-selection-create` | `collaboration.selection.create` | Mutação humana | `draft, mutation` |
| `collaboration-selection-list` | `collaboration.selection.list` | Leitura privada | `caseRef` |
| `collaboration-selection-version` | `collaboration.selection.version` | Leitura privada | `(objeto vazio)` |
| `collaboration-cycle-read` | `collaboration.cycle.read` | Leitura privada | `caseRef, selection` |
| `collaboration-work-list` | `collaboration.work.list` | Leitura privada | `selectionRef, period` |
| `collaboration-work-destination` | `collaboration.work.destination` | Leitura privada | `selection, actionRef` |
| `collaboration-recipients` | `collaboration.recipients` | Leitura privada | `(objeto vazio)` |
| `collaboration-storage-version` | `collaboration.storage.version` | Leitura privada | `namespace` |

`relation-create` exige `operation: "create"`; `relation-remove`, `operation: "remove"`. Não remover esses campos antes da admissão. As chaves opcionais estão marcadas com `?`; validação semântica continua no port correspondente. A família `answer-prepare` remove do resultado observações privadas do provider, expondo somente recibo, versão/fingerprint, resposta/autoria/escopo e evidence/projection autorizadas.

## 2. WP10 e produtores — autoridade do destinatário e fences

`modules/sucafina/Sucafinav1/product/collaboration/recipient-authority.ts` publica:

```ts
type CollaborationRecipientAuthority = {
  authorize: (recipientRef, refs, context) => Promise<boolean>
  checkAtCommit?: (recipientRef, refs, context) => boolean
}
```

O host deve fornecer `recipientAuthority` a `createCollaborationHost`. `authorize` lê a autoridade empresarial atual do destinatário sobre cada referência, campo e período. `checkAtCommit` verifica sincronicamente um lease privado atual, vinculado ao destinatário, principal chamador, conjunto exato de refs e ACL atual. Não realiza I/O nem abre outra transação de fonte dentro da transação de metadata. `createRecipientCommitCheck` e a composição WP08 já encaminham esse guard a `createThreadPort` e `createRelationPort`; ausência, exceção ou retorno que não seja `true` nega atribuição cruzada. Uma checagem anterior bem-sucedida ou `() => true` não é implementação desse lease.

O provider real `runtime/local-store.ts` já carrega os três snapshots sob a mesma transação SQLite e expõe `currentSnapshots()`. As fences WP08 verificam os snapshots atuais; não dependem de um campo fictício `sourceFence` no comando. Provider sem a capacidade necessária falha fechado. Para leitura canônica de ação, a composição WP08 usa `createCollaborationHotTopicReadHost`, snapshot isolado, ator `canWrite:false` e `commit:false`; create/update usam o host de escrita e o lease humano ativo. O reader não deve ser trocado pelo writer no mount estrangeiro.

O host fornece `issueForActor`, `captureWorkSource`, `prepareReissueScope` e, quando necessário, `resolveAnswerScope` a partir dos produtores admitidos. Uma requisição fabricada como se viesse de outro usuário não implementa `issueForActor` nem `recipientAuthority`. `resolveAnswerScope` deve preservar identidade, campos/período e todas as dependências de evidência; o host WP08 revalida esse resultado contra a thread e o manifest do produtor.

### W04: fontes atuais de Meu trabalho e seleção privada de caso

`createCollaborationHost` aceita o input privado opcional `workCaseAuthority: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>`. WP10 deve passar **a mesma função `authorizeCase` usada pelo `createDecisionCasePort` canônico**, além do mesmo port `cases`. A closure observada em `apps/cli/src/sucafina-product/business-services.ts`, blob W03 `54cb9612b58e6c3bd1e665d0a0093011ea1aa2d5`, verifica participação do principal e `host.revalidate(context)`. Reutilizar essa instância conserva a política do produtor; um callback permissivo ou uma autoridade reconstruída pelo cliente não satisfaz esse contrato. A existência desse seam no WP08 não prova que o mount WP10 já o fornece.

O host constrói `work-source-refresh.ts#createWorkSourceRefresh` quando recebe `issueForActor` real. Encaminha o callback resultante `refreshWorkSource` tanto a `createCaseWorkSelection` quanto a `createCollaborationComposition`/`createCollaborationWorkPort`. Quem compuser esses ports diretamente deve encaminhar o mesmo callback. O issuer recebe o target antigo somente como seletor e emite evidência **atual** para o ator admitido. O helper exige a mesma identidade física C17, surface/type/id, campos, período, nível de evidência e instalação/projeto, além de digest, binding, ACL atual e fence dos snapshots correntes. Um selector cujo ledger C17 não exponha os campos/período exigidos permanece indisponível até existir contrato admitido compatível.

Esse refresh permite avaliar a pendência atual depois de uma alteração material. Não torna a evidência antiga `fresh`, não autoriza sua projeção histórica e não altera o `createCollaborationReissuer` global usado por threads e respostas. Referências de uma seleção que continuam autorizadas são conservadas; somente referências `record` indisponíveis podem ser atualizadas pelo helper. Uma referência de outro tipo que perdeu acesso interrompe a resolução. As origens de handoff em Meu trabalho consomem esse mesmo caminho, enquanto a ação Hot Topic é relida pelo port canônico e deve manter sua identidade física C17.

Na criação de uma seleção WP08, `preferences` conserva o digest do caso protegido original, id/incarnation/version, principal, período e as referências de evidência que o produtor do caso admitiu. No uso posterior, a seleção revalida as fontes atuais, o binding nativo quando aplicável e o caso original. Somente a recusa canônica exata `case-evidence-unavailable` admite a verificação alternativa de **metadados da seleção**: o caso protegido deve continuar idêntico, o principal deve continuar participante, o horizonte deve incluir o período e a mesma `workCaseAuthority` deve aprovar antes/depois da releitura. O callback recebe clones, e o digest é novamente verificado. Qualquer mudança de caso, mesmo sem aumento de versão, troca física da fonte, revogação ou ausência dessas provas falha fechado.

`selection.list` e `selection.resolve` podem assim recuperar uma seleção privada válida para mostrar uma pendência de releitura. Esse caminho não devolve corpo do caso nem reabre `cases.read`/`cycle.read` quando o produtor histórico recusa a evidência. Seleções anteriores que não possuam o digest e as referências protegidas não ganham esse poder por migração implícita. Para ler o caso/revisão histórico completo, o owner deve fornecer um produtor histórico admitido e autoridade própria; o callback de Meu trabalho não o substitui. A publicação Dashboard com `prepareHistoricalReissue`, identificada em `producer-pins.json`, foi apenas inspecionada e não foi instalada para ampliar essa fronteira.

### W04: resposta confirmada como projeção de pendência

O host cria `answer-work.ts#createAnswerWorkPort` a partir do `confirmationSource` real, C08, `DomainPortHost` e `authority.sources`, antes de compor Meu trabalho. Passa `answerWork: answerWork.project` a `createCollaborationComposition`, que o encaminha a `createCollaborationWorkPort`. Esse callback é interno: o cliente não fornece seu resultado e o mount não deve trocar o produtor por um estado de resposta cacheado.

`answerWork.project(questionId, context)` lê o baseline protegido em `threads` e pede ao produtor C06 que observe seu escopo exato. Verifica manifest/dependências, campos/período, continuidade física, referências correntes autorizadas, ACL e fence, e devolve `unconfirmed`, `valid` ou `stale`, com versões/período e refs atuais quando cabíveis. Nunca inclui o corpo histórico da resposta. Meu trabalho conserva a leitura usual para `unconfirmed`; `valid` suprime a pendência; `stale` produz uma única obrigação da thread, com `title: null`, estado `answer-stale` e motivo/versão atuais. A apresentação revalida essas projeções no retorno, inclusive as respostas válidas que foram suprimidas. Indisponibilidade não devolve conteúdo parcial.

Esse consumidor não resolve a thread, não altera o caso ou os dados oficiais e não relaxa a autorização de `answerReuse.read`. O destino histórico, a leitura ou uma nova resposta podem continuar indisponíveis após uma mudança material; a linha de pendência não demonstra uma jornada de nova resposta já executada. Uma mudança fora do período mantém a confirmação; uma mudança material no período pode exigir releitura sem exibir o texto antigo. A prova autorada usa `test/product/wp08/host-answer-reuse.test.ts`; a seleção/confirmação real com janeiro v7, mudança irrelevante de fevereiro que leva a página a v8, mudança material de janeiro, uma pendência, releituras estáveis e revogação está em `test/product/wp08/confirmation-work-integration.test.ts`. Resultados só são evidência para as afirmações exercitadas no SHA/run correspondente de `validation.json`. Nenhum desses cenários demonstra mount visual, sessão native real, MCP ou produtor histórico estrangeiro ausente.

## 3. WP00/WP04/WP10 — bloqueio concreto de Procurement (WP08-B01)

Os testes abaixo falharam na captura/projeção individual canônica de Procurement; os bindings e resultados por rodada estão em `validation.json`:

- `modules/sucafina/Sucafinav1/test/product/wp08/work-presentation.test.ts`
- `modules/sucafina/Sucafinav1/test/product/wp08/selection.test.ts`

A leitura do código confirma o motivo. `modules/sucafina/Sucafinav1/product/procurement/sources.ts#createProcurementSourceResolver` emite o selector individual de `procurement-request` com `approvalStage` imediatamente depois de `holder`. A emissão de membros em `createProcurementCollectionRegistry` inclui o mesmo campo. Porém `modules/sucafina/Sucafinav1/product/integration/procurement-projections.ts#projectSfProcurementScope` espera uma lista sem `approvalStage` e compara o digest da lista exata. A projeção individual retorna `undefined`; por consequência `modules/sucafina/Sucafinav1/product/procurement/collection-member.ts#createProcurementCollectionMemberIssuer` retorna indisponível ao capturar a evidência individual.

A inspeção remota também encontrou esse limite em publicações dos owners, sem instalá-las na árvore WP08:

| Owner | Commit observado | Artefato observado | Resultado da inspeção |
|---|---|---|---|
| WP00 | `29f40e0f0fafa8d526df9b280151962187f1440d` | `product/integration/procurement-projections.ts`, blob `08fdfb878f6f9282f70ec71b3e66122f1b95f6f5` | A lista exata do projetor individual não inclui `approvalStage`. |
| WP04 | `11c508d8c3a0986ac3ecaa23109e20f1819402d1` | `product/procurement/sources.ts`, blob `9d6a074fbe6486a4cb2ded43dd010c74a7ba31ea` | Importa `procurementRequestFields` de `source-projection.ts`; o consumidor de captura individual foi lido também no blob `4d35da609cc89817abc1d595cdf3de64193f4f1e` de `collection-member.ts`. |

Os paths da tabela são relativos a `modules/sucafina/Sucafinav1/`. Esses são commits observados por leitura, não uma alegação de head atual nem de admissão pelo S0. O diagnóstico não depende de restaurar os inputs estrangeiros arquivados.

**Delta exigido do owner:** WP00 deve publicar a projeção individual coerente com o contrato do emissor; WP04 deve confirmar o selector e a captura individual correspondentes; WP10/S0 devem consumir os pins compostos efetivamente admitidos. A mudança mínima candidata no projetor é incluir `"approvalStage"` entre `"holder"` e `"stageEnteredAt"`, conservando o valor derivado pelo domínio e a validação exata do selector. Não apagar o campo dos testes WP08, não aceitar um selector divergente e não usar a referência de coleção como identidade individual persistível.

Após o owner publicar a correção, executar novamente os dois testes sobre o commit composto real e registrar SHA/run ID. Em seguida provar holder/etapa e troca/conclusão por comandos legais do domínio com refresh em Meu trabalho. O failure de captura não constitui prova de que esse fluxo já funciona.

## 4. WP02/WP03/WP04 e WP10 — observadores C06

O export WP08 `modules/sucafina/Sucafinav1/product/collaboration/confirmation-source.ts#createCollaborationConfirmationSource` recebe `{ dashboard?, planner?, procurement? }`. Cada objeto deve implementar `observe`, `fence`, `verifyManifest` e `fenceManifest`, emitindo evidence/projection do próprio produtor. Instalar o objeto composto como `confirmationSource` de `createCollaborationHost`. Uma superfície ausente retorna indisponibilidade de dependência, sem tomar emprestado o manifest de outro produto.

`producer-pins.json` registra os três arquivos inspecionados pelo root e a qualificação `READ_ONLY_SOURCE_INSPECTION_NOT_ADMITTED_IN_WP08_PRODUCT_TREE`:

| Owner | Path | Commit observado | Blob observado |
|---|---|---|---|
| WP02 | `modules/sucafina/Sucafinav1/product/dashboard/confirmation.ts` | `4c36e6fc6e69e4dd1e98b5d0d5c2e50962ccfe80` | `5227c12b5d9d2259fc75c31bc64c78ab9b7dc506` |
| WP03 | `modules/sucafina/Sucafinav1/product/planner/confirmation.ts` | `815921f41636c449aa5966f43935771bb4d39e39` | `0d217f65b2a86aa9b5f5c78b70150128d17cc72b` |
| WP04 | `modules/sucafina/Sucafinav1/product/procurement/confirmation.ts` | `5cde6bbb3122e0511f0eed4a8b617c958bcd72ef` | `4fcda499e060bd77d595e4d567d7e9daed671fc4` |

O Dashboard observado também exporta `prepareHistoricalReissue`; o Planner observado exporta `prepareResimulationContinuity`. Esses exports pertencem aos produtores, não são autorização histórica implícita da seleção de Meu trabalho e não foram copiados para a árvore WP08. A composição S0 deve admitir o conjunto correto de commit, export, contrato e consumidor antes de depender deles.

A presença de um pin na tabela prova somente leitura do código. Não prova que o runtime em revisão consome aquele produtor, nem que o commit ainda seja o head do owner. Não restaurar cópias arquivadas para preencher a composição.

## 5. WP01 — consumidores humanos e navegação

A UI deve apresentar separadamente esclarecimento, revisão humana e ação operacional, consumindo `work.listPresentation` e `resolveWorkDestination`; o domínio resolve o destino atual. Não compor links diretamente a partir de IDs. O ciclo vazio pede seleção/entrada e não aparece concluído.

No reuso de resposta, chamar `answerReuse.prepare(questionId, answerRef, context)` pela rota de leitura; mostrar resposta, autor, escopo e `observedSourceVersion`. Confirmar explicitamente com `{ questionId, answerRef, mutation: { expectedStorageVersion, idempotencyKey, observationRef, observedSourceVersion, expectedScopeFingerprint } }`. Uma edição global irrelevante mantém a versão realmente observada; mudança material rejeita a observação; indisponibilidade/revogação impede reexibir conteúdo cacheado. `threadDigest` é CAS interno e não uma condição que invalida a resposta só porque a thread foi resolvida.

Para confirmação sem alteração, preparar o escopo por `confirmation-prepare` e usar a versão/fingerprint mostrados em `confirmation-confirm`. O host conserva prova privada de observação; enviar valores produzidos pelo browser não substitui a preparação.

Para handoff, oferecer criar ou vincular ação canônica selecionada. `handoff.link` recebe `{ topicRef, sourceRefs, sourceRef, recipientRef?, relationKey }`; create recebe `{ intent, sourceRef, recipientRef?, relationKey }`. Preservar correlação e intenção após `action-outcome-unknown-retry-same-correlation`; um retry não gera nova chave. Apresentar criada/existente/vinculada, recusada/conflito e resultado incerto como estados distintos. As rotas presentes no port não demonstram, por si, o fluxo visual, teclado ou foco.

## 6. WP00/WP11 — contrato de pergunta decisiva

O contrato atual é exatamente `modules/sucafina/Sucafinav1/product/contracts/outputs.ts#QuestionProposal`:

```ts
type QuestionProposal = {
  caseRef: string
  question: string
  criterionRef?: string
  recipientRef?: string
  evidenceRefs: readonly BusinessEvidenceRef[]
  expectedCaseVersion: number
}
```

`modules/sucafina/Sucafinav1/product/contracts/operations.ts#QuestionPrepareRequest` aceita `question: { text, criterionRef? }`, e `modules/sucafina/Sucafinav1/product/contracts/output-schemas.ts` contém o schema fechado `QuestionProposal_29`. A proposta atual não define por campo ou regra publicada por que a pergunta importa, qual premissa/decisão sua resposta altera e como a prioridade reflete uma condição decisiva. `WP08.T06.QLT.01` permanece bloqueado; `question` e `criterionRef` sozinhos não são prova dessas três obrigações.

WP00/WP11 devem publicar a semântica e o schema de razão/efeito/prioridade, com referencias autorizadas ao critério/condição. Se adotarem novos campos, devem atualizar input/output fechados, freeze/digest/contratos e produtores/consumidores juntos; os nomes dos novos campos não são inventados neste patch WP08. WP11 deve conservar pergunta/resposta canônica e distinguir premissa do caso de alteração oficial: resposta de março diante de projeto oficial em maio continua divergente até comando autorizado do domínio. Reusar autor/ref/escopo/versão observada não aprova compra nem altera cronograma.

### Consumidor próprio de QuestionProposal, com proveniência preservada

`product/collaboration/question-consumer.ts#createQuestionConsumer` é composto como `createCollaborationHost(...).questions`. Recebe a proposta realmente emitida por `sf_question_prepare` e cria a mesma thread canônica consumida por `threads.read`, `resolveQuestion` e Meu trabalho. Não escreve `DecisionCase.questions`, não cria um segundo ledger e não modifica registros oficiais. A associação ao caso fica em metadata própria `questionOrigin` no objeto protegido do namespace `threads`, preservando identidade/incarnação/versão do caso, digest bruto, horizon, digest da proposta, principal e referência/digests mínimos de proveniência. As projeções públicas comuns de thread omitem essa metadata; leitura de fonte não concede leitura do caso ou do output C11. O consumidor autorizado do caso pode receber a origem na resposta da confirmação.

O caminho determinístico da UI usa o `result` e o `receipt` completos do retorno real de `dispatchSfCapability`. `question-preparations.ts#createQuestionPreparations` guarda a observação privadamente somente depois do recibo final emitido pelo próprio capability. Vincula instalação, projeto, principal, access/policy, resultado e caso bruto. A observação tem validade finita de cinco minutos e recusa rollback de relógio; um JSON com receipt aparentemente correto não cria prova. A confirmação é uma nova admissão humana de `collaboration.question.confirm` sobre o payload integral:

```ts
{
  proposal: { kind: "prepared", result: prepared.result, receipt: prepared.receipt },
  sourceRef: explicitlySelectedRefId,
  period: explicitlySelectedPeriod,
  mutation: { expectedStorageVersion, idempotencyKey },
}
```

`sourceRef` deve selecionar exatamente uma evidência record da proposta. `period` deve ser exatamente o período dessa referência preparada e estar contido no horizonte atual do caso. Outro período exige captura e preparação canônicas novas; o consumidor não altera refs/digests para acomodar a seleção. O destinatário vem do resultado mostrado e precisa de identidade e acesso atuais. Ausência de destinatário ou de escopo compatível permanece explícita.

A confirmação revalida caso/versão/digest, critério, todas as evidências, destinatário e autoridade humana antes da transação. O callback C08 compara o caso protegido e os snapshots de domínio, além do lease síncrono de destinatário e do recibo privado, sem chamar leitores de fonte/caso/C11 dentro da transação. Origem canônica e comando idêntico recuperam a mesma thread após retry/recomposição; uma tentativa com novo conteúdo não reutiliza a chave idempotente. A leitura de retry ainda depende de autorização atual do caso e das fontes. Uma preparação ainda não consumida se perde com a instância do host e deve ser preparada novamente; uma thread já persistida não depende de reconstituir a autoridade do receipt por JSON.

Para uma contribuição nativa persistida, WP10 deve injetar **o reader canônico existente** `product/ai/contribution-reader.ts#createSfContributionReader` como `readQuestionContribution` em `createCollaborationHost`. Esse reader já verifica envelope ready, outputDigest, run/outputRef, SkillLoadReceipt, sessão e verificação privada do produtor. `questions.readOutput(outputRef, caseRef, context)` / `collaboration-question-output` apresentam somente o `QuestionProposal` autorizado e os seletores/digests necessários. O consumidor recebe então:

```ts
{
  proposal: {
    kind: "contribution",
    outputRef,
    outputDigest,
    caseRef: { id, incarnation, version },
    result: canonicalQuestionProposal,
  },
  sourceRef,
  period,
  mutation: { expectedStorageVersion, idempotencyKey },
}
```

O resultado apresentado precisa ser igual ao payload canônico. A versão esperada da proposta, a versão do caso e a referência do envelope devem concordar; se o contrato/produtor não puder provar essa relação, o consumidor recusa. O envelope e o run autorizados são comparados novamente no snapshot do commit. O WP08 não grava envelope C11 nem cunha SkillLoadReceipt/modelo/contextFingerprint. Sem `readQuestionContribution`, leitura e consumo desse caminho retornam `question-contribution-reader-unavailable`, sem fallback para um envelope fornecido pelo cliente.

`test/product/wp08/question-consumer.test.ts` contém cenários de UI/shared dispatcher real + SQLite + C09 + fonte Dashboard + confirmação humana/HTTP, inclusive versão/digest do caso, alteração de fonte no commit, escopo, ACL, payload/receipt adulterado e retry após recomposição. `question-consumer-evidence.json` associa os nomes e asserts; o recibo `validation.json` atribui somente o resultado da rodada hospedada que realmente os execute. Esses testes não executam uma sessão native, um modelo ou o reader C11 positivo. A publicação/consumo de outputRef nativo e o catálogo C16 instalado continuam dependências estrangeiras e permanecem PARTIAL, assim como o consumidor WP11 que incorpora respostas ao caso e o consumidor WP09 que evita recobrança.

## 7. WP09, WP14, WP07 e WP10 — recobrança, sinais e revisão preservada

WP09 deve consumir a mesma projeção C06 de `confirmation.project` e a identidade estável de `modules/sucafina/Sucafinav1/product/collaboration/confirmation-work.ts#confirmationWorkIdentity`. Mudança irrelevante em fevereiro não cria recobrança de janeiro; mudança material reabre uma obrigação por escopo, conservando a confirmação anterior como auditoria. A integração real de Meu trabalho exercita essa distinção, mas não executa o consumidor de rotina WP09.

WP14 é o owner dos classificadores/projeções puras de sinais. WP10 compõe os produtores de domínio, autorização e leitura atuais e fornece `workSignals` ao host WP08. Cada sinal precisa de `workRef` estável, `recipientRef` atual, destino e `sourceRefs` autorizadas para o período selecionado. Meu trabalho consome esse resultado sem inventar regra de classificação ou agenda. Caso selecionado sem produtor de sinais resulta em indisponibilidade; não instalar produtor vazio para tornar o teste verde.

As fixtures reais `collaboration-journey.test.ts`, `confirmation-work-integration.test.ts` e `host-answer-reuse.test.ts` usam o produtor Dashboard de sinais e só devolvem lista vazia quando a projeção canônica confirma que não há valores/sinais elegíveis nem faltantes naquele fixture. Isso cobre a ausência autorizada no cenário, não demonstra o caminho positivo WP14 de classificação, prioridade e entrega de sinal ao responsável. Esse consumidor exige sua própria composição e evidência hospedada.

WP07/WP10 devem fornecer a resolução autorizada da revisão preservada C05 para threads/handoff. O vínculo mantém a identidade/versão/período da revisão; nenhuma leitura histórica concede acesso atual. `collaboration-journey.test.ts` parte de um registro Dashboard real, cria um pedido contextual `review`, exige confirmação humana, conserva um Hot Topic canônico no retry e verifica a conclusão refletida em Meu trabalho. Ele não cria uma revisão preservada WP07. Ainda falta a execução conjunta de revisão preservada real → Hot Topic real com invariância dos números preservados, ausência de aprovação e nenhuma escrita no Planner. WP12 deve compor seus consumidores de compromissos usando essas mesmas referências quando aplicável.

## 8. WP10 — C16/native/MCP e prova de integração

`createCollaborationHost(...).capabilities` fornece os descritores reais abaixo, consumidos por `modules/sucafina/Sucafinav1/product/host-binding/capability-dispatch.ts#dispatchSfCapability` e `modules/sucafina/Sucafinav1/product/host-binding/sf-mcp-bridge.ts#createSfBusinessMcpBridge` na composição do owner:

| Operação | Handler export em `product/collaboration/capabilities.ts` | Modo | Profiles declarados |
|---|---|---|---|
| `sf_work_list` | `listWork` | read | `sf_maestro` |
| `sf_question_prepare` | `prepareQuestion` | prepare | `sf_maestro` |
| `sf_answer_read` | `readAnswer` | read | `sf_maestro` |
| `sf_relation_read` | `readRelations` | read | `sf_maestro`, `sf_portfolio` |
| `sf_handoff_prepare` | `prepareHandoff` | prepare | `sf_maestro` |

Registrar uma única instância de cada descriptor no catálogo realmente admitido. `requiredAuthority` deve provir da configuração real, e cada operação deve estar nos grants do principal. O profile declarado é requisito adicional, não concessão suficiente. UI e bridge nativa usam o dispatcher com schema admission, registry/context reais e receipt do mesmo input/result digest; chamada direta sem admissão ou contexto revogado deve ser recusada. Ações privadas humanas nunca entram no catálogo residente.

Evidência ainda necessária: mesmo base/principal/autoridade pelos caminhos UI, sessão native e MCP; SkillLoadReceipt da execução real; handlers/versões/resultados e efeitos iguais; recusas sem grant, após revogação, com origem substituída e fonte indisponível. Preservar os recibos com product SHA, source/consumer SHAs, run ID e referência da sessão. Arquivo de teste unitário que usa contexto injetado não fecha esse requisito.

## Regra de atualização do recibo

Após cada rodada hospedada, anexar o commit exato, CI snapshot, run/job IDs e os resultados às provas correspondentes em `validation.json`. `producer-pins.json` identifica inspeções de código de produtores; a matriz conserva o vínculo por critério e as lacunas. Um teste verde só pode atualizar a afirmação que ele realmente exercitou. Os bloqueios de contrato, mount/UI, producer e native permanecem até a evidência específica existir. Não declarar DONE integral com base na cobertura de 132 linhas ou apenas no CI da seleção cirúrgica.
