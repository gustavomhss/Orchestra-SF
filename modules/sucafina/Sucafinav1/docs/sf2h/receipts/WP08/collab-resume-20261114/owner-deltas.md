# WP08 — deltas delimitados para os owners

## Estado e proveniência

O produto atual é W7 `9e1f44af7689946d27d37ed48b9f5e9849417121`, tree `ac88fa893a3b8b9f36c4373c2889652025fcf0f3`, PR#41 com #33 preservada como origem. W7 altera somente dois testes e recibo; implementação e fixtures permanecem iguais a W6 `dc21cd389de67c2e7fac996b663d9c0aa7d8cae5`. Run43625515062, snapshot `a4f8c7bd673de3e4092f20185f4c3ea2d10d0ec3`, está **SUCCESS** para cinco nomes exatos. Os sete PASS W6 são reaproveitados; B149s e os dois R10 com observação inválida continuam FAIL no run anterior. Não se promove uma execução parcial.

As 17 tasks e 330 critérios dos três WPs permanecem preservados; WP08 mantém 132 critérios nas suas seis tasks. Cobertura não significa aceitação integral. Estas propostas são somente para fontes alheias. Nenhum host WP10, contrato compartilhado, implementação WP12 ou engine foi alterado. A leitura do host usa `astra-compose` em `9048e0e65351a5bd80768458a79fed94a4993db7`, `apps/cli/src/sucafina-product/business-services.ts`, blob `b3595989d0c08159c96484d96bd40a149a9721e6`. O owner deve reconciliar apenas o delta com seu head atual, sem substituir árvore ou arquivo inteiro.

## 1. WP10: conectar o consumidor aos produtores autenticados

### O que já existe

`createCollaborationHost` já recebe e compõe o observer de confirmação dos domínios; `answerReuse` já alimenta o dispatch. A afirmação antiga de que faltava passar `answerReuse` ao dispatch estava desatualizada. A montagem examinada contém `confirmationSource`, seleção de caso, proteções de história e o leitor de contribuição.

W2 acrescenta os seguintes seams privados:

| Entrada em createCollaborationHost | Responsabilidade |
| --- | --- |
| `authorizeReviewThreadContext` | Releitura C05 real do pin exato e do contexto original. |
| `prepareReviewThreadFence` | Prepara fora de C08 um callback que só verifica snapshots protegidos e autoridade atual. É obrigatório para mutações C05; pode ser derivado de `reviewAnswerSource.prepareThreadFence`. |
| `reviewRecipientAuthority.authorize` | Resolve e autoriza o destinatário real, separadamente do caller, para a revisão e todas as fontes originais. |
| `reviewRecipientAuthority.checkAtCommit` | Confere de forma síncrona a mesma lease no commit. Não faz I/O, não abre transação e não recolhe fontes. |
| `reviewAnswerSource` | Adapter WP07 de observação, confirmação e reuso da resposta no snapshot C05. |
| `reviewContexts` | Consumidor já publicado de `createReviewClosurePort(...).listByAction`, para a mesma ação canônica em Meu trabalho. |

No blob do host examinado, essas entradas C05 e a autoridade de destinatário não são fornecidas. Além disso, `issueForActor: individual.issueForActor` é o emissor Procurement; o owner deve compor o roteador de produtores Dashboard/Planner/Procurement já admitidos, mantendo suas regras de acesso. O consumidor WP08 não infere uma autoridade ausente.

### Patch de passagem, deliberadamente limitado

O trecho abaixo propõe somente adicionar as entradas tipadas e repassá-las à construção existente. Ele não implementa um emissor de identidade nem autoriza destinatários. O owner precisa compor os produtores reais antes de habilitar o fluxo. A ausência deles conserva o resultado indisponível.

```diff
+type ReviewCollaborationPorts = Pick<Parameters<typeof createCollaborationHost>[0],
+  "reviewContexts" | "authorizeReviewThreadContext" | "prepareReviewThreadFence" |
+  "reviewRecipientAuthority" | "reviewAnswerSource" | "recipientAuthority">
+
 export function createSfBusinessServices(input: {
   // parâmetros atuais preservados
+  reviewCollaboration?: ReviewCollaborationPorts
 }) {
   // composição atual preservada
   const collaboration = createCollaborationHost({
     host, state: input.authority.state,
     creationTarget: input.authority.creationTarget,
+    ...input.reviewCollaboration,
     scopedSources: input.persistence,
     // restantes parâmetros atuais preservados
   })
 }
```

Os comentários contextuais do diff representam trechos existentes, não um postimage substitutivo. O novo objeto é privado ao composition root e nunca vem do request, de metadados do caso ou de uma flag persistida.

A composição real usa `createReviewAnswerSource({ reviews: reviewServices.reviews, host, prepareAccess })` e a mesma instância de `reviewServices.threadContext.authorize`. O callback `prepareAccess(pin, basis, fullReview, context)` deve validar a revisão inteira e preparar as leases atuais de cada evidência original, inclusive de outras seções. O snapshot imutável não deve se tornar uma autorização permanente. O callback retornado verifica o mesmo pin, o digest completo armazenado, encarnações físicas, referências/campos/períodos, caller, revisões de ACL/política e métodos de produtor originais. A checagem executa dentro de `currentSnapshots`, sem emissão de C17, leitura C05 completa, coleta de projeção ou escrita aninhada.

O método geral `prepareThreadFence` não deriva `ConfirmationScope` nem usa `answerMaterial`. Assim, uma conversa C05 pode conservar documentos ou cálculos quando seus produtores fornecem a lease atual. A confirmação de resposta continua explicitamente indisponível para dependências que o escopo material C06 não representa. Não eliminar essas dependências para tornar a confirmação positiva.

Para o destinatário, a lease precisa vincular caller e destinatário a principals autenticados distintos e às respectivas revisões atuais. Diretório, homônimo, grupo, papel ou uma leitura bem-sucedida do caller não bastam. É proibido construir um `Request` com um ID de destinatário ou copiar a binding do caller. Uma lease antiga só pode autorizar o mesmo intent se o check atual confirmar novamente o mesmo pin e a autoridade vigente. W4 vincula o slot à instância real do contexto admitido e impede repinagem do objeto/métodos do provider durante um replay no mesmo contexto. O host não deve clonar a binding para fabricar um contexto nem reutilizar sucesso persistido como concessão.

### Critérios de integração

O owner deve exercitar no host instalado o pedido C05 para um destinatário real, resposta, edição, histórico, resolução, observação e confirmação explícitas, reuso e a única linha de Meu trabalho. As contraprovas exigidas são: homônimo sem acesso; revogação antes e no último await antes do commit; troca de provider/método; conteúdo C05 substituído; encarnação física substituída mantendo ID textual; dependência não verificável; perda e restauração de ACL; reenvio idempotente; nova instância após persistência.

Os testes usam SQLite, C05/C06/C08, produtores Dashboard e admissões reais da implementação. W5 provou destinatário/R09/WP07 e a recusa física; W6 concluiu confirmação/SQLite reopen, fonte corrente distinta/revogação, lease/física, histórico genérico, host, HTTP e unit reuse. W6 B falhou149408.75ms, e R10 falhou depois da recusa central porque a projeção de negócio removia estado privado. W7 mantém produto/fixtures iguais, conserva58 oráculos, reparte B em três cadeias completas e lê C05 pelo namespace C08 real. Os cinco casos W7 passaram no escopo exato.

A contraprova HTTP consome exatamente o `observationRef` retornado pelo preparo; não demonstra que uma UI instalada o apresentou à pessoa. O autenticador dos atores, a ACL de revisão e o arquivo histórico são fronteiras explícitas de fixture. Reabrir SQLite e compor consumidores não é prova de Session residente, identidade instalada, processo novo ou Relay nativo.

O helper R10 compara thread+baseline no snapshot protegido antes/depois do fence real; ele não coleta fontes dentroC08 e não substitui o grant do produtor por igualdade de storage. Os limites de latência253128.15ms (W5) e149408.75ms (W6 B) permanecem distintos da montagem ausente e da partição dos testes. A leitura R10 corrigida exige status, presença, id/versão, pin antes/depois e igualdade integral da revisão; nenhuma concessão ou implementação produtora foi afrouxada.

## 2. WP00/WP10: escopo C05 explícito em sf_answer_read

O `AnswerProjection` compartilhado atual devolve pergunta, corpo, evidências e estado, mas não representa `reviewRef/reviewVersion/reviewDigest/sectionId`. Uma resposta confirmada sobre o snapshot C05 pode continuar válida depois de uma mudança material nos dados correntes. Publicá-la como resposta corrente confirmada sem o pin perderia sua semântica.

Por isso, W2 recusa esse caso específico com `review-answer-output-contract-unavailable` no dispatch compartilhado. A leitura privada autenticada, o preparo HTTP e Meu trabalho conservam o pin. O caminho normal de resposta sobre dados correntes permanece disponível.

Proposta de contrato para o owner: admitir uma variante explicitamente discriminada de resposta preservada. Ela deve conter os quatro campos do pin, manter a versão realmente observada e conservar autoria e referências originais. O decoder fechado deve exigir todos os campos juntos e impedir a variante C05 sem marcador. A versão do schema/descriptor e os consumidores precisam ser atualizados conjuntamente; não incluir um campo que o transporte silenciosamente descarte.

Uma forma compatível a avaliar é manter a variante atual de `AnswerProjection` e acrescentar uma variante com `scopeKind: "preserved-review"` e `reviewContext` obrigatório. A semântica de `confirmed` nessa variante é confirmação da resposta sobre a revisão imutável, não confirmação dos dados correntes. Somente depois da admissão dessa variante, WP08 pode liberar o ramo do dispatch preservando sua comparação exata entre a mensagem e o baseline. Não criar uma referência C17 de revisão sintética para evitar o contrato.

Prova requerida: private HTTP, UI, native e MCP devem apresentar a mesma resposta/pin/base e negar a chamada após revogação. O domínio corrente alterado não deve herdar o baseline C05, nem uma nova pergunta herdar confirmação por corpo de texto semelhante.

## 3. WP01: apresentar a revisão que a pessoa está confirmando

O endpoint privado de preparo da resposta agora devolve `reviewContext` junto da resposta, autoria, scope e projeção de exibição. Dados de provider como `accessLeaseRef` e `physicalIncarnation` continuam fora do HTTP.

O consumidor deve mostrar que a resposta pertence à revisão preservada selecionada, a versão observada e o período. A condição atual de acesso não reescreve a versão histórica. A ação de confirmar deve usar a observação que a pessoa efetivamente viu e a mensagem exata; uma edição exige observação e confirmação novas. A prova disponível confere somente o mesmo observationRef retornado pelo HTTP e lido pelo teste; a apresentação à pessoa ainda precisa do consumidor instalado. Meu trabalho recebe `answer-stale` e `answer-changed` com o mesmo pin e uma única identidade comunicacional.

A interface ainda precisa exercitar o fluxo montado e o retorno à origem. Screenshot isolado, teste do port e metadados do componente não constituem essa prova.

## 4. WP04/WP00: B01 resolvido; jornada legal distinta permanece

O antigo finding B01 sobre `approvalStage` não é um bug aberto no head retomado. O commit `a3dcbb62c88231f95a7c57afb32e975404a3b59c` alinhou `integration/procurement-projections.ts` ao produtor. O blob `3e8830c3dddc8b9609f583f877b2fe7458eccd28` está preservado em W1.

O mesmo teste `work-presentation.test.ts`, blob `43103eea4e7a10e8da2f799a2495894627ce528a`, antes falho, passou no run `43584357490`, job `132415569882`, produto `ea5a6f965c803d436202934872c3650ab8f8eb19`, snapshot `c03b06bea510e0ed8ec8df105c269304d388317f`. Ele confere etapa Manager, título, destino, identidade canônica e revogação. O run inteiro terminou com 42 pass e duas falhas de outros casos; não é promovido a verde global.

Esse teste semeia o estado pending. Aprovação legal pela origem, transferência de holder, evolução de etapa e conclusão com atualização da fila ainda precisam de prova do produtor e host. Não duplicar o teste B01 resolvido nem retirar `approvalStage`.

## 5. Outros limites preservados

- WP00/WP11: QuestionProposal ainda precisa representar razão, efeito e prioridade decisiva, e o caso deve consumir a mesma resposta sem confundir premissa com alteração oficial. A prova C06 março/maio já publicada não substitui o fluxo C11.
- WP10 e owners C17 das fontes: captura histórica real e reemissão autorizada através de períodos devem conservar base original, ACL e continuidade física. WP12 é o consumidor nativo; não assume a implementação do produtor. WP08 não inventa período atual ou captura Atlas ausente.
- WP02/WP03/WP04: os manifests de dependências materiais, FX/regras, unidades/moeda e caminhos canônicos dos três domínios são dos produtores. Provas Dashboard não certificam a completude de Planner/Procurement.
- WP09/WP10: o leitor C07 de confirmação foi implementado; ausência de nova cobrança em recorrência exige execução real governada, não apenas zero itens em Meu trabalho.
- S0/WP10: o typecheck global e os witnesses nativos permanecem gates distintos. Não adicionar stubs permissivos para `verifyScenarioOperations`, não alterar engines, identidade ou política financeira e não declarar DONE por um teste isolado.

## 6. Avanço WP12 reconciliado: prova pública limitada já disponível

O avanço `dc8f3b19d40f52c19aabd219544c291460592b99`→`812f8427423dc143cefc2731edc3485eeb8d1f04` contém46 documentos e um teste, sem implementação. Run43615955284/job132510939072, W `6880666b15dc18bf400c908a8457580526b70f4d`, S `89799ce8ca1d9a78e25695353879dfe2bd0c229a`, terminou2 PASS/1 FAIL446 asserts. Executive Work e revisão pública populada/report/download/reload passaram; Question Work teve timeout360s. Ambos os PASS anteriores continuam reanexados.

O avanço seguinte até `f2cbdb30c1673bc89426db6618d19cb65601c8ef` acrescentou25 documentos e três testes, ainda sem implementação. O [run43619631569](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619631569), job `132522137649`, S `b5eb330f9b914953bf19fa7e265e9db11762cfd2`, terminou **3 PASS/0 FAIL367 asserts**. Question Work agora passou254350.31ms dentro360000ms, blob `c146fe374294f07f38c5beae9d34147d97c94968`. O Workbench real reabre a mesma ação idempotente e recusa a seleção removida antes do PASS. Esse timeout antigo não é bloqueio atual desse caminho público.

A origem depois chegou a `ba27411a7cda9301aa162680a94153a5e643be4d`, tree `e88a267c3eb31e2d2040693535076222dbad74e1`, com17 recibos e um teste novo, zero implementação. O teste `native-execution-dashboard-answer.test.ts`, blob `e7bdf4d8e2da41b8f3bdf05aa8f1384873d2d7a0`, prepara CAPEX2027, resposta não confirmada, Question e reabertura. Check43621280244 PASS é estático; até17:59:06 UTC não havia novo run de produto observado. Não transferir o PASS anterior de Question Work para `sf_answer_read`, C05 confirmado ou Planner.

Seis catálogos nativos vazios e três missões indisponíveis: nenhuma inferência/output. `questionId/outputRef/nativeCallId/nativeReceipt` são nulos, `sf_answer_read` não foi exercitado e `confirmedAnswerReuseAccepted` é falso. Não há novo produtor C17/C07, concessão de destinatário ou confirmação C05/C11. Os174 subprocessos Omni não são prova de inferência. O avanço foi reconciliado por GitHub MCP sem copiar a árvore, alterar WP12 ou duplicar os testes equivalentes.

Atribuição preservada: WP10 e owners das fontes implementam C17; WP12 consome nativamente. Os findings WP13 continuam sendo o replay numérico positivo fora do orçamento e a recusa sem private writer grant. O fix do provider já existe em WP10/PR32 em9048e0e; a cópia Finance ainda não incorpora o prefixo `sf:portfolio:campaign:` sob `proposalCoverageWrites`. Próxima ação: composição delimitada por WP10/S0 e qualificação da negativa por WP13, sem retirar o oráculo. Os seis PASS R5 são 4+2 somente nas duas fixtures corrigidas; não se amplia essa evidência para toda a jornada de colaboração.

## G03 incorporado, sem nova alteração alheia

O owner de Interface publicou a tradução de CAS conhecida em `9d65ea8fcd8ce6ea1249dc669e0fcc248b540241`, path `docs/sf2h/receipts/WP01/astra-interface/findings/patches/case-selection-known-cas.owner-only.patch`. W2 incorpora somente esse delta no arquivo próprio `product/collaboration/case-selection.ts`, cujo preimage remoto é `ec80e2916c8a06cbb471cf02e30bb1cb5ebd9cc0`. `conflict/product-state-changed` passa a `selection-not-committed`/HTTP 409; falhas diferentes e conflito de conteúdo da chave idempotente continuam indisponíveis. A contraprova usa concorrência real de estado e nenhuma escrita do perdedor.

