# Vínculos adicionais de critérios após W21

**Escopo: 18 vínculos restritos, seis testes e 12 critérios existentes. Nenhum aceite integral.** Este adendo conserva o mapa auditado W21 e os 83 textos literais do mapa WP11. Ele identifica a propriedade exercitada pelos testes posteriores e o que falta para cada critério completo.

Pin de fonte observado: Finance W31 `c449efc092e507fca2b4f61d1e7ce057faf05c89`, tree `82ea6bff11f9647d14cac30587ccd2feb80c6950`. W31 acrescenta somente o guard explícito de capacidade no teste de leitura sobre W30. O [JSON companheiro](post-W21-criterion-bindings.json) contém o texto literal de cada critério vinculado, os blobs, os oráculos e os limites por vínculo.

## Regra de evidência

As descrições abaixo são oráculos autorados examinados estaticamente. **O resultado de execução vem somente de [product-tests.json](product-tests.json)**, no arquivo, W, S e caso efetivamente executados. Este adendo não congela um green futuro, não atribui a um blob novo o resultado de um anterior e não transforma um teste de harness em prova instalada/nativa. C/D e o bundle S0 permanecem separados.

## Execuções observadas no fechamento

O ledger central já registra S19, produto W30 `bd168e193e7bb4a43893c24c5370c9c3fa205fc1`, com 21 casos aprovados / 448 assertions e S21, produto W31 `c449efc092e507fca2b4f61d1e7ce057faf05c89`, com 3 casos aprovados / 9 assertions. Os cinco primeiros arquivos deste adendo usam seus casos de S19; o teste de leitura com guard W31 usa S21. O JSON registra run/job/W/S e os casos exatos por arquivo. Esses resultados qualificam as propriedades selecionadas, sem completar os critérios mais amplos.

| Seleção | Run | Snapshot S | Escopo neste adendo |
| --- | --- | --- | --- |
| S19 | [43594791351](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43594791351) | `823311ee83c6a28273bc8d63bb1157e9bdcb01e7` | Current-choice, escolha/preparo/aplicação, Hot Topic, promoção e revisão de escolha. |
| S21 | [43595579525](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43595579525) | `6c98bd185ed3041ecd6b1c9d6c3eb169968cd410` | Três casos do escopo real de leitura, com capacidade transactionAll exigida. |

## Arquivos observados

| Teste | Blob | Assertions literais | Timeout explícito |
| --- | --- | ---: | --- |
| `test/product/wp11/current-choice-lifecycle.test.ts` | `7a5100d9e60a81f654cc31714efd2b1e7d0b68f5` | 41 | 180000ms |
| `test/product/wp11/choice-prepared-execution.test.ts` | `326a262f17914de6675657dd1e6f82baec31e5c3` | 35 | 180000ms |
| `test/product/wp11/hot-topic-snapshot.test.ts` | `447ae83e4a49175f6751138d44d3221f364b0731` | 53 | Padrão da seleção CI; sem override no teste |
| `test/product/wp11/promotion-coverage-proof.test.ts` | `73f0e3b3b7e5579f2cc645503d78f067d9b832c9` | 39 | Padrão da seleção CI; sem override no teste |
| `test/product/wp11/renewal-choice-revision.test.ts` | `c2901936d6730b56422b2c495069c0ed0a0705ce` | 44 | 180000ms |
| `test/product/wp11/renewal-read-scope.test.ts` | `803a9a3154a2dcf99a8118253216bf97efb2e8f5` | 9 | Padrão da seleção CI; sem override no teste |

## current-choice-lifecycle

| Critério literal | Propriedade sob teste e oráculos discriminantes | Limite restante |
| --- | --- | --- |
| `WP11.DOD.01` — Caso e escolhas sobrevivem a reinício e são compartilhados conforme autorização. | Persistência e reabertura do mesmo caso com a escolha original e o resultado promovido separadamente. Após dispose/openLocalStore, caso v4 e estado reconsidering são lidos de C08. ChoiceRecord original e seu digest permanecem iguais; o ledger contém uma única choice-recorded. Retry da promoção após reabertura devolve o recibo anterior e não altera o caso. | Não demonstra compartilhamento entre identidades diferentes, reinício do provider instalado ou cadeia residente/nativa. |
| `WP11.INV.01` — Escolha não é aprovação e simulação não grava em fonte oficial. | Reavaliação e promoção humana de uma alternativa não aplicam as operações Planner da escolha histórica. O cenário histórico conserva suas três operações. O snapshot Planner após a cotação permanece idêntico depois da promoção e após reabertura/retry. preparedChanges e receipts de domínio continuam vazios. | Não cobre aprovações PR/PO nem as demais superfícies oficiais; não demonstra aplicação de ChoiceRecord. |
| `WP11.T03.CHK.01` — Registrar escolha preserva a base financeira; alteração posterior de cotação e nova escolha não modificam o registro original. | Nova cotação e promoção da reavaliação preservam a base financeira e o ChoiceRecord anterior. Escolha original conserva subtotal210000, totalnull e training ausente. Reavaliação produz subtotal250000, cobertura completa, comparação conditioned e totalnull; o cenário histórico continua hipotético. Escolhas e digest original permanecem idênticos após a promoção. | Esta jornada promove uma alternativa reavaliada; não registra uma nova escolha. A nova operação humana de escolha é coberta separadamente por renewal-choice-revision. |
| `WP11.T03.CMP.01` — Cobrir escolher, manter escolha sob nova justificativa, substituir escolha, rejeitar proposta e conflito da fonte. | Concessão separada, digest e versão atuais cercam a promoção da reavaliação. Preview sem autorização e alternativa versão9 são recusados. Promoção sem confirmação humana, digest adulterado e fonte recusada não passam. Mudança concorrente do caso torna a promoção antiga stale; novo preview precede a promoção permitida. | Não cobre todos os modos de escolher/manter/substituir/rejeitar proposta nem os transportes UI/native/MCP instalados. |

Consumidores reais examinados: `product/planner/current-choice.ts#createCurrentPlannerChoice`, `product/decisions/current-choice-preview.ts#createCurrentChoicePreview`, `product/decisions/current-choice-promotion.ts#createCurrentChoicePromotion`, `product/decisions/result-store.ts#createSfDecisionResultStore`.

## choice-prepared-execution

| Critério literal | Propriedade sob teste e oráculos discriminantes | Limite restante |
| --- | --- | --- |
| `WP11.T03.DOD.01` — Escolha humana gera propostas revisáveis que chegam aos consumidores reais de cada domínio. | ChoiceRecord criado pela operação humana real origina proposta revisável consumida pelo Planner canônico. Nenhuma escolha ou mudança é pré-semeada; recordChoice registra o resultado condicionado1200→1142. prepareChanges gera destino planner/v1, comando save/f0=42 e vínculo à escolha. O produtor real aplica a mudança somente depois da revisão e da concessão de aplicação. | Cobre apenas o domínio Planner em harness; os consumidores instalados de todos os domínios e o caso parcial cross-domain permanecem separados. |
| `WP11.T03.CHK.02` — Escolher alternativa não aprova PR/PO, não aplica cenário oficial nem cria ação automaticamente; propostas mostram destino e confirmação cabível. | Escolher, preparar e aplicar exigem operações humanas distintas, sem efeito oficial antecipado. Concessão de leitura não escolhe; concessão de escolha não prepara. Escolha e preparo preservam integralmente o snapshot oficial observado. Usar a concessão de preparo para aplicar é recusado antes do dispatch; concessão própria decisions.apply permite o comando. | Não executa aprovação PR/PO nem criação de Hot Topic; as provas desses destinos e a interação instalada continuam necessárias. |
| `WP11.T03.QLT.01` — Cada proposta mostra alteração, motivo, destino e estado; a justificativa continua vinculada aos números debatidos. | A proposta e a revisão mantêm destino, vínculo à escolha e alteração financeira produzida canonicamente. Mudança planejada preserva choiceId, destino planner/v1, comando e preview idêntico ao resultado da escolha. Revisão canônica mostra line:1:forecast, before100, after42 e moedaUSD. Review digest vincula escolha, versão do caso, mudança, campos e fonte à concessão aplicada. | Não qualifica a apresentação instalada de todas as propostas, motivos e estados, nem todos os destinos de domínio. |
| `WP11.INV.02` — Não há transação global presumida nem efeito repetido em retry. | Retry de uma aplicação Planner com receipt conhecido não repete o efeito. Receipt real é anexado à mudança aplicada e ao caso. Retries de execute/recordChoice/prepareChanges devolvem os resultados anteriores. Contador envolve o produtor real: dispatch permanece1 e snapshot final permanece idêntico. | Não injeta resposta perdida nem falha parcial entre domínios; não demonstra reconciliação de resultado desconhecido ou transação global. |

Consumidores reais examinados: `product/decisions/mutations.ts#createDecisionMutations`, `product/planner/prepared-review.ts#createPlannerPreparedReview`, `product/planner/prepared.ts#preparePlannerMutation`, `product/decisions/prepared-apply.ts#createSfPreparedApply`, `product/decisions/apply.ts#createPreparedExecution`.

## hot-topic-snapshot

| Critério literal | Propriedade sob teste e oráculos discriminantes | Limite restante |
| --- | --- | --- |
| `WP11.T03.CHK.02` — Escolher alternativa não aprova PR/PO, não aplica cenário oficial nem cria ação automaticamente; propostas mostram destino e confirmação cabível. | Draft humano de Hot Topic permanece privado e não cria ou altera automaticamente o registro oficial. Register sem concessão adequada é recusado. Draft autorizado persiste somente seus campos privados; casos, confirmações, receipts e resultados permanecem iguais. Read/list/retry conservam campos, target e versão; registros oficiais permanecem idênticos. | Esta jornada é de rascunho, não de ChoiceRecord aplicado; aprovação PR/PO e aplicação oficial de Hot Topic não são exercitadas. |
| `WP11.T03.CMP.01` — Cobrir escolher, manter escolha sob nova justificativa, substituir escolha, rejeitar proposta e conflito da fonte. | Conflitos de fonte/caso/autoridade e substituição tardia do draft impedem retorno ou commit de um draft antigo. A corrida de fonte exige commit real do comando Dashboard e exatamente um snapshot Dashboard verificado. Mudança de fonte/caso/autoridade conserva ausência de preferências, receipts e transação de draft indevida. Substituição no último callback de fonte de readCurrent ou no último authorizeCase de list retorna stale; versão nova continua acessível. | Não abrange todos os modos de escolha/retenção/rejeição de propostas, nem transporte ou usuário instalado. |

Consumidores reais examinados: `product/decisions/hot-topic-draft.ts#createHotTopicDraftStore`, `runtime/dashboard-people.ts#DashboardPeople.domain.execute`, `product/host-binding/state-provider.ts#createSfProductState`.

## promotion-coverage-proof

| Critério literal | Propriedade sob teste e oráculos discriminantes | Limite restante |
| --- | --- | --- |
| `WP11.T02.DOD.20` — Alternativa persistida entrega cálculo WP03 e cobertura C10 reais a todos os consumidores nomeados. | Promoção persistida consome cálculo Planner e prova C10 atual mesmo quando o cenário não contém operações. Duas ordens de fonte exercitam a entrada de cobertura e reassessment mesmo quando o assessment inicial coincide com o baseline. O resultado persistido conserva componentes/fontes canônicos e digest exato da prova de commit. Retry não reavalia nem grava de novo. | Não demonstra todos os consumidores UI, BI, crítica e portfólio; o total permanece condicionado e não é convertido em completude financeira. |
| `WP11.T02.INV.01` — Simulação não altera oficial/actual/compra; ausência não vira zero e hipótese não vira compromisso. | Promoções source-only e com operação hipotética permanecem sem aplicação oficial. Resultados source-only têm subtotal1200/2400 e totalnull. Variante replace42 preserva componente hypothetical, restrição preview-not-applied e totalnull. Escolhas, preparedChanges e receipts permanecem vazios; snapshots oficiais são conservados. | Não cobre todos os ramos de ausência/FX/zero nem todos os comandos de compra; não comprova execução aplicada. |
| `WP11.T02.CMP.20` — Cobrir inventário ausente, categoria omitida, not-applicable sem suporte, zero confirmado, fonte revogada, inclusão compartilhada e custo posterior inversor. | Prova ausente, autoridade revogada e fonte alterada entre observação e commit não autorizam promoção. Os quatro negativos missing-proof/revoke/source-change/case-change recusam resultado e valor. Não se persistem alternativas, resultados ou transação da promoção recusada. Na corrida de fonte, o comando canônico e a auditoria mudam a fonte; o resultado recusado não a desfaz. | Este arquivo cobre somente as negativas de proof/autoridade/fonte e caso; inventário ausente, N/A sem suporte, zero e custo inversor requerem suas outras provas. |

Consumidores reais examinados: `product/decisions/mutations.ts#createDecisionMutations`, `product/decisions/baseline-coverage.ts#createDecisionBaselineCoverage`, `product/decisions/cost-coverage.ts#reassessScenarioCoverage`, `product/planner/product.ts#createPlannerProduct`.

## renewal-choice-revision

| Critério literal | Propriedade sob teste e oráculos discriminantes | Limite restante |
| --- | --- | --- |
| `WP11.T03.CHK.01` — Registrar escolha preserva a base financeira; alteração posterior de cotação e nova escolha não modificam o registro original. | Após nova cotação, novas operações humanas substituem e mantêm uma escolha sem reescrever escolhas anteriores. Escolha original condicionada210000/totalnull/pending training é conservada por igualdade e digest. A cotação gera resultado250000 completo; nova escolha de renewal registra240000 e comparação inversa−10000 sem rebind silencioso do critério. Terceira escolha conserva os números da segunda e registra nova razão; ledger/digests e três identidades de operação permanecem distintos. | Não demonstra as mesmas ações em UI instalada, outras identidades ou novo provider; não aplica as escolhas. |
| `WP11.T03.CHK.20` — Registrar escolha condicionada na variante de treinamento omitido; confirmar treinamento 40000 depois conserva a escolha/subtotal/ressalva originais e apresenta nova alternativa250000/diferença -10000 sem reescrever a razão histórica ou autoalterar a escolha. | Treinamento confirmado altera a alternativa atual, preservando a escolha condicionada e exigindo nova decisão humana. Mesmo id/incarnation de caso; resultado atual250000 completo e comparação de custo orientada em+10000 com critério failed. Antes da substituição humana, o digest do ChoiceRecord original permanece igual. Nova escolha e retenção usam concessões/payloads próprios; nenhuma alteração oficial é causada pelas escolhas. | A orientação+10000 é o custo selecionado menos a base; a escolha inversa usa−10000 canônico. Este teste não calcula nem prova o threshold15000, a apresentação BI ou uma aplicação de domínio. |
| `WP11.T03.CMP.01` — Cobrir escolher, manter escolha sob nova justificativa, substituir escolha, rejeitar proposta e conflito da fonte. | Escolher, substituir e manter com nova razão possuem intenção, identidade e idempotência próprias. Origem HTTP não confiável é recusada. Concessões antigas não autorizam payloads de substituição/retenção; reutilizar a identidade com novo payload retorna idempotency-content-changed. Retries das três escolhas devolvem seus receipts C08 e não criam uma quarta escolha; snapshots Planner ficam iguais após cada escolha. | Não cobre rejeição de proposta nem conflito da fonte durante dispatch; as corridas de fonte são vínculos separados, não prova implícita deste caso. |

Consumidores reais examinados: `test/product/wp11/renewal-choice-fixture.ts#createRenewalChoiceHistory`, `test/product/wp11/renewal-human-choice-fixture.ts#createRenewalHumanChoices`, `product/decisions/mutations.ts#createDecisionMutations`, `product/integration/human-authority.ts#createSfHumanAuthority`.

## renewal-read-scope

| Critério literal | Propriedade sob teste e oráculos discriminantes | Limite restante |
| --- | --- | --- |
| `WP11.T02.INV.01` — Simulação não altera oficial/actual/compra; ausência não vira zero e hipótese não vira compromisso. | Verificação de cenário com operações e alternativa source-only não altera snapshots duráveis. Capacidade real transactionAll é exigida; sua ausência falha em vez de pular a prova. O verificador canônico aceita ambos os cenários e os três snapshots persistidos antes/depois são integralmente iguais. | É uma fronteira de verificação em fixture; não cobre todos os estados de ausência/zero/hipótese nem provas nativas ou aplicação oficial. |
| `WP11.T02.CMP.20` — Cobrir inventário ausente, categoria omitida, not-applicable sem suporte, zero confirmado, fonte revogada, inclusão compartilhada e custo posterior inversor. | Uma nova invocação observa fonte editada e a autorização continua revogável durante um callback aguardado. Comando OPEX canônico muda implementation para46000; nova verificação recusa a referência anterior. Revogar a concessão UI durante o segundo callback de fonte faz a verificação falhar e a revalidação do host retornarfalse. | Não qualifica todos os cenários de inventário/N/A/zero/custo inversor nem a freshness após liberar o lock. Não emite fontes scoped e não prova a cadeia residente. |

Consumidores reais examinados: `test/product/wp11/renewal-operation-verifier.ts#createRenewalOperationVerifier`, `product/planner/operation-verifier.ts#createPlannerOperationVerifier`, `product/planner/port.ts#createPlannerPort`, `runtime/local-store.ts#openLocalStore`.

## Distinções que este mapa conserva

A reavaliação de current-choice conserva as operações hipotéticas da escolha: subtotal250000 com cobertura completa continua com totalnull e comparação conditioned. Promover essa alternativa exige confirmação própria e não cria uma nova escolha nem aplica o Planner. O teste renewal-choice-revision registra novas escolhas humanas sobre a cotação confirmada, conserva os registros anteriores e continua sem aplicar mudanças de domínio. A jornada choice-prepared-execution é a que liga escolha, preparo, revisão, concessão separada e aplicação Planner real; seu retry usa um receipt conhecido, sem simular perda de resposta ou falha entre domínios.

A verificação de leitura prova snapshots duráveis iguais, mudança de fonte entre invocações e revogação UI durante um await. Ela não prova freshness depois de liberar o lock, emissão scoped, autorização residente, aplicação ou replay de um receipt. Nenhum desses limites é suprido por somar resultados de testes sem a composição exigida.

## Preservação

Não foram editados criteria.json, os dois task-delivery-map auditados, fontes de produto ou outros recibos. Os 83 IDs/textos continuam no [mapa integral WP11](criteria.json); este adendo mapeia apenas o subconjunto diretamente sustentado pelos seis arquivos. Não foram executados imports, Bun, testes, typecheck ou CI por este autor.
