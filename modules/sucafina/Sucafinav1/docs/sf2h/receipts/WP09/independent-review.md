# WP09 — Revisão independente

## Escopo e conclusão

Revisor: agente independente `/root/independent_review`, sem autoria das implementações examinadas. Data do registro: 2026-11-14.

**R1–R8 foram resolvidos na revisão estática do código e dos contraexemplos escritos em W2, commit `3b746ab9d6ae3b860bb7f97a3b5bc22e92179255`.** Essa conclusão cobre as correções descritas abaixo; não constitui aprovação do CI, das sete tasks completas, dos 112 critérios, de GNATIVE ou da integração global.

A revisão inicial examinou o trabalho publicado em W1, `115326b1337b73c5e275624a8d401b41e8ed1c9e`, e arquivos locais de preparação ainda em desenvolvimento. Os findings foram enviados ao coordenador antes das correções. A segunda revisão foi limitada a R1–R8 e ao isolamento das callbacks do factory. Os testes correspondentes foram conferidos no SHA W2 por GitHub MCP.

O coordenador informou que o produto corrente na redação deste documento é W5, `ed9a1da0420a0575e16c48118c6ce52edac6ae50`, com novo CI hospedado em andamento. **Este documento não afirma resultado desse CI nem estende automaticamente a revisão W2 aos deltas posteriores.**

Não foram executados produto, testes ou typecheck localmente. As fontes examinadas foram código, testes escritos, handoff/intake e o log hospedado indicado na seção do timeout. Esta atividade escreve somente este documento; não altera produto, mapas, arquivos de outros owners ou o teste WP06.

Referências imutáveis:

- [W2 revisado](https://github.com/gustavomhss/Orchestra-SF/commit/3b746ab9d6ae3b860bb7f97a3b5bc22e92179255).
- [W5 informado pelo coordenador](https://github.com/gustavomhss/Orchestra-SF/commit/ed9a1da0420a0575e16c48118c6ce52edac6ae50).
- [Handoff WP09](https://github.com/gustavomhss/Orchestra-SF/blob/a3d29d011ba3607a57914701300f09117a3e2de9/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/WP09.md).

## Findings originais e resolução em W2

Nesta seção, os paths são relativos a `modules/sucafina/Sucafinav1/`. As linhas de implementação e dos testes referem-se a W2; os contraexemplos descrevem o comportamento anterior à correção. `RESOLVED_STATIC_W2` significa resolução demonstrada pela leitura do código e presença de caso escrito relevante, sem afirmar execução aprovada.

| ID / severidade original | Finding e contraexemplo original | Correção observada em W2 | Caso escrito e estado |
| --- | --- | --- | --- |
| **R1 — P1** | `runAdmittedRoutine` aceitava a mesma admissão/documento/principal/projeto com correlação, fontes ou pins de autorização/arm/session substituídos. O caminho genérico UI/MCP verificava menos vínculos que o adapter de decisão. | `product/routines/capabilities.ts:94–118` fixa a admissão pelo decoder, compara correlação e digest integral das fontes, preserva pins opcionais existentes e isola callbacks. O decoder real faz `structuredClone` em `product/contracts/schema-admission.ts:56–60`. | `test/product/wp09/lifecycle-boundaries.test.ts:52–95`: substituição e remoção dos pins, alterações de identidade/incarnação/campos/versão/período das fontes, mutação da admissão durante await e callback mutadora. **RESOLVED_STATIC_W2.** |
| **R2 — P1** | Requests humanos de Schedule permaneciam mutáveis depois de `authorize`. Uma alteração do caller durante `owner`, `qualify` ou `read` podia fazer a execução receber payload diferente do autorizado. | `product/routines/schedule.ts:45–124` clona antes do primeiro await, fornece cópias às callbacks e repete a autorização do payload fixado imediatamente antes de create/update/pause/resume/runNow. | `schedule-boundaries.test.ts:86–137`: mutação do caller, mutação pelas callbacks e perda da autorização antes do comando, incluindo os cinco comandos. **RESOLVED_STATIC_W2.** |
| **R3 — P1** | `validateOccurrence` devolvia `pendingRefs`, mas a cerca de acesso consultava apenas agenda/run/resultado. Uma pendência privada podia sair num resultado `needs-review` sem ser verificada. | `product/routines/schedule.ts:148–159` fixa o resultado, valida strings e limites, deduplica e inclui todas as pendências na revalidação de egress. | `schedule-boundaries.test.ts:140–169`: pendência negada sem vazamento, referências inválidas/excessivas, deduplicação e alteração do objeto original durante a callback. **RESOLVED_STATIC_W2.** |
| **R4 — P1** | O adapter nativo de Schedule derivava `reviewable` de `admitted + resultRef`. C08 `RoutineResult` não transporta, sozinho, conclusão, falha ou cancelamento, nem comprova que o artefato pode ser aberto. | `product/routines/schedule-native.ts:91–112` exige estado de execução e resultado autenticado correspondente, usa `presentRoutineLifecycle` e relê os pins. Ausência das portas não promove a saída a revisável. `64–69` também relê o run e revalida acesso antes do retorno. | `schedule-native.test.ts:111–159`: referência insuficiente, falha/cancelamento, leitura autorizada requerida, pins trocados, acesso negado e cancelamento durante recuperação. **RESOLVED_STATIC_W2.** |
| **R5 — P1** | A última validação de Procurement ocorria antes da segunda leitura documental. Uma alteração de versão ou acesso do pedido durante essa leitura podia deixar o dossiê retornar material anterior. | `product/routines/dossier.ts:33,39,47–50` fixa o material/seleção iniciais e repete a cerca de Procurement depois da última leitura e comparação de evidências. | `preparation-egress.test.ts:91–109`: o segundo read documental altera a versão do pedido; espera-se `denied`, sem `value`. Esse caso está publicado em W2, não apenas num arquivo local posterior. **RESOLVED_STATIC_W2.** |
| **R6 — P1** | O hash da saída era conferido apenas contra o próprio envelope recebido. Substituir conteúdo e recalcular o hash, conservando `resultRef`, passava sem um pin externo de conclusão. | `product/routines/result-access.ts:73–88` exige snapshot terminal `completed`, revisão e digest esperado, compara o digest do envelope ao pin terminal e verifica sua estabilidade novamente em `97–99`. | `result-access.test.ts:68–91`: conteúdo substituído com hash recalculado, execução falha/cancelada e alteração terminal durante a recuperação. **RESOLVED_STATIC_W2**, condicionado à origem real do recibo no host; o fixture não prova essa origem. |
| **R7 — P2** | `expectedInputDigest` recebia o objeto `run` que seria devolvido. Na segunda chamada, podia alterar a identidade depois da validação do artefato/readback. | `product/routines/result-access.ts:72,79,94` conserva o digest original e fornece clones nas duas consultas de input digest. | `result-access.test.ts:94–103`: callback tenta substituir correlação e resultRef; o retorno esperado mantém os pins originais. **RESOLVED_STATIC_W2.** |
| **R8 — P2** | Preparar uma revisão nova apenas com `previousReviewRef`, sem `currentReviewRef`, não lia o histórico escolhido e entregava comparação ausente. | `product/routines/review.ts:130–141` lê diretamente o histórico autorizado; `review-host.ts:36–43` o usa na comparação. Quando existe `currentReviewRef`, a ligação preservada continua sendo verificada. | `review-product-consumer.test.ts:61–67`: rascunho novo com histórico escolhido, delta real de Planner e preservação humana posterior por WP07. **RESOLVED_STATIC_W2.** |

O isolamento de callbacks do factory também foi examinado em `product/routines/factory.ts:41–44,57–59`: a leitura e a descoberta conservam seus snapshots enquanto as callbacks recebem cópias.

## Limites de evidência e integração

### Estado terminal, artefato e recibos

`AuthorizedRoutineArtifactResult` em W2 retorna `run + execution + output`. O adapter verifica que a saída coincide com o digest esperado da execução terminal. **O objeto fornecido por uma callback tipada não é, por si, prova de recibo nativo.** WP10/S0 ainda precisam demonstrar a origem autenticada e persistida dessa leitura, sua revisão e sua ligação à execução governada.

O descriptor `sf_routine_result` devolve metadados de `RoutineResult`; seu recibo cobre esses metadados. Não deve ser citado como se cobrisse os bytes do artefato. O resultado aberto inclui a evidência terminal usada no pin de saída, cuja origem real ainda precisa ser qualificada no host.

### Receitas e execução Relay

Os testes de receitas exercitam AuthoringStore e aquisição/materialização por RelayWorkflowBinding reais. Isso prova publicação e versão adquirida. Não prova a execução dos produtores empresariais por uma Session Relay governada.

Na versão examinada, `recipes.ts` descreve etapas por instruções e referências de implementação. Os checks `package-verification` e `cold-review` pertencem ao mecanismo nativo de código/worktree: o primeiro chama o runner Bun em `modules/maestro/coordination/src/v2/workflow/settlement.ts:290–303`. O texto `assert` da receita não substitui uma invocação comprovada dos produtores ou a reconciliação determinística das evidências de negócio.

### Portas de domínio e identidade

Os consumidores de encaminhamento usam C06/Hot Topics/estado reais e os de revisão usam WP07/Planner reais. Os fixtures de identidade, autoridade ou snapshot nativo continuam limitados ao que cada teste declara. Não equivalem a SkillLoadReceipt, admissão governada C07, identidade residente, isolamento ou revogação de uma Session nativa completa.

Nenhuma das resoluções R1–R8 autoriza modificar engines Relay/Maestro/Schedule, preencher as portas ausentes com um ledger paralelo, marcar critérios nativos como concluídos ou declarar READY/GLOBAL_RELEASE sem os gates próprios.

## Timeout do consumidor WP06

### Fato observado e classificação

O [run `43536732467`](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43536732467), referente à rodada W2, registrou timeout em:

`modules/sucafina/Sucafinav1/test/product/wp06/documents/runtime-e2e.test.ts`

Nome do caso: `real host persists procurement document evidence and Planner import under current authority`.

O log de trabalho `handoff/wave2Test.log:1087–1094`, obtido pelo coordenador a partir do run hospedado, mostra início do arquivo às `00:52:04` e falha às `00:54:29`, duração informada de **144.662,94 ms** e limite de **120.000 ms**. Os três casos documentais `request-selection` imediatamente anteriores e os três `egress-fences` posteriores aparecem como aprovados. O run agregado W2 teve outras falhas; este diagnóstico não declara seu sucesso.

**Classificação: `INTEGRATION_TIMEOUT_NOT_LOCALIZED`.** O log não contém stack/checkpoints internos suficientes para localizar a etapa. A inspeção estática não demonstra deadlock causado por WP09 ou pelo preload Core, nem comprova que a barreira descrita abaixo foi atingida no run.

A fonte WP06 consumida é o commit `2f33fd0eac79606cd0ba9c0724f8035a7c9bffbb`; o blob do teste é `d1560811995f93324d7fbb5d5ea96f6ca8d0e7f7`. No intake do produtor, seu run final [WP06 `43525466970`](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43525466970) não executou as asserções desse arquivo: o import de `routines/dossier.ts` estava ausente. Portanto, esse recibo anterior não fornece um resultado verde do mesmo teste para demonstrar regressão em W2.

### Hipóteses examinadas

1. **Preload e relógio:** o preload Core exato de W2 só configura `ORCHESTRA_DB`, credenciais e modelos. Não substitui `Date`, timers ou `AsyncLocalStorage`. O helper `testEffect` fornece TestClock por Layer Effect, sem monkeypatch global. O LocalStore SF abre `installation.sqlite` no diretório temporário próprio do teste. Não há uma causa estática demonstrada de contaminação por esse preload.
2. **Autenticação dentro da transação:** `runtime-e2e.test.ts:58,143–148` chama autenticação dentro da transação. `operator-identity.ts:48–58` usa `secrets.get`; `local-store.ts:312–316` usa `operation(false)`, e `101–114` reutiliza a conexão do escopo herdado sem adquirir write lock. Essa chamada, por si, não forma um ciclo de espera no driver examinado.
3. **Custo acumulado:** o caso combina vários ciclos documentais, previews/aplicações de importação, retries e roster. `local-store.ts:199–205` lê as três superfícies por transação de topo; `153–161` serializa/copia snapshots; `product-authority.ts:60–77` volta a observar autoridade; `source-lifecycle.ts:36–51,114–124` aplica hashes e clones. O custo acumulado é uma hipótese plausível, sem medição por etapa que permita tratá-lo como causa confirmada.
4. **Barreira que mascara falha:** há um risco concreto de diagnóstico no próprio teste foreign, descrito a seguir. Não foi demonstrado que ele causou o timeout observado.

### Delta concreto proposto ao owner WP06/S0

Em `runtime-e2e.test.ts:300–313`, `entered.resolve()` só ocorre depois da primeira leitura/asserção. Se essa leitura ou asserção falhar, `locked` rejeita, mas a linha `await entered.promise` pode continuar pendente até o limite do teste. A espera deve observar a rejeição de `locked`, e a barreira `release` deve ser liberada mesmo em falha.

**Patch proposto, não aplicado.** Preserva as duas asserções, a concorrência com a escrita, os dados e o timeout de 120 segundos. Não corrige, por declaração, um eventual deadlock ou custo excessivo em outra etapa.

```diff
diff --git a/modules/sucafina/Sucafinav1/test/product/wp06/documents/runtime-e2e.test.ts b/modules/sucafina/Sucafinav1/test/product/wp06/documents/runtime-e2e.test.ts
--- a/modules/sucafina/Sucafinav1/test/product/wp06/documents/runtime-e2e.test.ts
+++ b/modules/sucafina/Sucafinav1/test/product/wp06/documents/runtime-e2e.test.ts
@@ -309,5 +309,14 @@
-    await entered.promise
-    const replacement = store.transaction("procurement", async (_, blobs) => { await blobs.put("supplier/s1/asset-1", new TextEncoder().encode("Price: 99"), "text/plain"); return { commit: true, value: undefined } })
-    release.resolve()
-    await locked
-    await replacement
+    try {
+      await Promise.race([
+        entered.promise,
+        locked.then(() => {
+          throw new Error("Blob isolation transaction ended before entering the read barrier")
+        }),
+      ])
+      const replacement = store.transaction("procurement", async (_, blobs) => { await blobs.put("supplier/s1/asset-1", new TextEncoder().encode("Price: 99"), "text/plain"); return { commit: true, value: undefined } })
+      release.resolve()
+      await Promise.all([locked, replacement])
+    } finally {
+      release.resolve()
+      await locked
+    }
```

A branch da race derivada de `locked` propaga sua rejeição anterior à entrada. A resolução inesperada sem entrada também encerra a espera com erro. Depois da entrada, `Promise.all` observa as duas operações; o `finally` garante a liberação e aguarda a transação. O patch é um delta de teste para o owner, não uma alteração de engine ou produção, e precisa de validação hospedada.

### Próxima verificação e custódia

É adequado executar o arquivo isoladamente num CI hospedado com o mesmo produto da seleção principal, preservando a falha W2. A seleção própria WP09 com `request-selection` e `egress-fences` pode ser executada separadamente, sem remover silenciosamente o consumidor pendente da entrega.

Registrar seleção exata, SHA de produto, snapshot, igualdade dos blobs e conclusão de cada run. Se o timeout se repetir, pedir ao owner checkpoints de fase e a correção da barreira; não registrar uma causa definitiva sem esse dado. O teste e os serviços WP06 permanecem sob custódia de WP06/S0. A integração com persistência/autoridade compartilhadas precisa ser diagnosticada sem atribuir automaticamente a falha ao dossiê WP09.

## Proveniência dos arquivos conferidos

Os blobs abaixo foram retornados pelo GitHub MCP. Paths abreviados nesta tabela são relativos a `modules/sucafina/Sucafinav1/`, exceto os que começam com `packages/`. O conteúdo de implementação foi lido no repo materializado e os pins foram conferidos no SHA indicado. Os testes de resolução foram consultados também na fonte remota W2.

### W2 — `3b746ab9d6ae3b860bb7f97a3b5bc22e92179255`

| Path | Blob Git |
| --- | --- |
| `product/routines/capabilities.ts` | `b8adcb574a84c213bfdec0659c7cc074a543564c` |
| `product/routines/schedule.ts` | `37447a219329c5207f3b1752353dab0320260803` |
| `product/routines/schedule-native.ts` | `120ba3a7dd065eb0926c3627f071c6a7245afe30` |
| `product/routines/dossier.ts` | `80acd28de7c3352410218e70dca4a2c7205ef3f7` |
| `product/routines/result-access.ts` | `2695f4d4564b071a92529e55910e7edd54599392` |
| `product/routines/review.ts` | `39d6928e701f3c5e9be7f48a2a7614fa04872a10` |
| `product/routines/review-host.ts` | `17bd4aaeac65c7c641abb76e33cd15b1a38d73de` |
| `product/routines/factory.ts` | `387dd1238698a0f70cf719c517a749fd62a77e5c` |
| `test/product/wp09/lifecycle-boundaries.test.ts` | `5761490639b56b35785c22516d3a2793db440606` |
| `test/product/wp09/schedule-boundaries.test.ts` | `c54a9c651f79c22ed747bee780d0a9177998f854` |
| `test/product/wp09/schedule-native.test.ts` | `5d70f317aee30e8b0fa1f94a4dea2b5d071c8dc8` |
| `test/product/wp09/result-access.test.ts` | `ff3d072a8804323cc2ee2df3d96b9e0ac9cba49d` |
| `test/product/wp09/preparation-egress.test.ts` | `732282d1a67c2d9877c98f8a9fbe3ed362cc8ec6` |
| `test/product/wp09/review-product-consumer.test.ts` | `ff3f8728d0f77e8a2e27db1837271e182c3e7fa1` |
| `runtime/local-store.ts` | `eefc1ed550a455abc4952430ec3b57a5abd5c9ee` |
| `runtime/operator-identity.ts` | `4845de24285df2459991da7d9895aad95eb93b19` |
| `packages/core/test/preload.ts` | `d23f2798fbbcf7fec5d91544e99907907f91f566` |
| `packages/core/test/lib/effect.ts` | `4e9a5c195d29d621f96f326041fa1d8a52be7147` |

### Produtor WP06 — `2f33fd0eac79606cd0ba9c0724f8035a7c9bffbb`

| Path | Blob Git |
| --- | --- |
| `test/product/wp06/documents/runtime-e2e.test.ts` | `d1560811995f93324d7fbb5d5ea96f6ca8d0e7f7` |

Este recibo registra uma revisão independente delimitada. Aceite de CI, critérios nativos e integração pertencem às evidências hospedadas e à revisão de S0; não são concedidos por este documento.

## Adendo — revisão cirúrgica do delta de apresentação W7

Data: 2026-11-14. Escopo: `product/routines/review.ts`, `product/routines/dossier.ts` e os cinco testes listados abaixo, no snapshot local preparado para W7 antes da publicação. A comparação foi feita contra o conteúdo de `handoff/wave4-files.json`, cujo SHA-256 é `6a44cb0321ee7689c3e357be272b5e3705bfab7e6151ade8b5dd9c6ef27ee6be`. Segundo o coordenador, W5/W6 não alteraram esses dois arquivos de produto. Este adendo fixa o conteúdo lido pelos hashes de blob; não atribui um SHA de commit ainda não conferido.

**Nenhum finding concreto novo foi identificado nesse delta delimitado.** A conclusão é estática: não houve execução de produto, testes ou typecheck, nem consulta a um resultado de CI W7. Os limites de CI e GNATIVE registrados acima permanecem.

| Ponto examinado | Observação estática e limite |
| --- | --- |
| Fontes indisponíveis e orientação | Em `review.ts:178–187`, apenas tópicos disponíveis e pendentes recebem `topicRef`. Os caminhos `source-unavailable` e `period-mismatch` produzem mensagens genéricas, sem identificador, fingerprint ou dados da fonte. Em `dossier.ts:68–78`, refs de orientação vêm somente de entradas documentais `pending`/`rejected`, já resolvidas; a orientação de `unavailable` não carrega ref. Essas adições não restauram o material suprimido pelos caminhos de indisponibilidade. |
| Fences e relógio | As releituras, comparações e verificações finais de autorização não mudaram. `lastUpdate` é um objeto constante, sem leitura do relógio, e portanto não introduz uma diferença entre os dois digests de `topicMaterialDigest` (`review.ts:193–194`). O digest continua removendo apenas os instantes de observação/avaliação já tratados pelo código anterior; conserva os vínculos de material e escopo. `nextSteps` e `explanation` são construídos de forma síncrona depois das cercas existentes. |
| Idade desconhecida | `review.ts:130` informa `source-update-time-unavailable`, separando última atualização material de `sourceObservedAt` e `freshness.evaluatedAt`. O contrato lido em `product/contracts/context.ts:39–49` não fornece um campo dedicado e confiável de última atualização material. O delta não infere idade nem usa a confirmação humana como data de atualização. |
| Cálculos e escolha de sourcing | `dossier.ts:117–135` formata `convertedAmount` e `score` já calculados; não recalcula câmbio, elegibilidade, ranking ou alternativas. A formatação textual limita decimais a dois, preservando os valores originais no objeto `comparison`. A escolha exibida vem da extensão `selection` produzida por `product/procurement/port.ts:171–173` e precisa coincidir com uma proposta existente. Não é inferida da posição no ranking; ausência de escolha/valor continua explícita. As refs da explicação são as mesmas de cada proposta. |

Os cinco arquivos de teste foram lidos, inclusive suas alterações em relação a W4:

- `planner-confirmation-consumer.test.ts:64–85` acrescenta ausência de orientação para recorte confirmado, orientação para alteração material, idade desconhecida e igualdade exata da orientação genérica após revogação. As asserções existentes continuam impedindo retorno de confirmação, fingerprint e valor revogados.
- `preparation-egress.test.ts:34–47` mantém o contraexemplo de versão material diferente e o caso em que apenas `evaluatedAt` avança; acrescenta `lastUpdate: unknown` e ausência de próximos passos para a confirmação válida.
- `request-dossier.test.ts:70–104` verifica orientação com a ref correta para candidato extraído/rejeitado e retirada da solicitação de confirmação após confirmação documental. As verificações de fonte alterada/revogada permanecem em `106–128`. O novo ramo de orientação genérica para uma entrada documental `unavailable` foi conferido por leitura do código; esses acréscimos não introduzem um caso dedicado que afirme essa mensagem exata.
- `review-product-consumer.test.ts:47–59` verifica os próximos passos dos dois recortes e idade desconhecida no consumidor WP07 real, conservando o retorno da seleção para preservação humana e a comparação do conteúdo preservado.
- `sourcing-consumer.test.ts:50–97` conserva igualdade integral da comparação com o produtor WP04, ranking, FX submetido, exclusão técnica e ausência de mutação; acrescenta refs da explicação, escolha registrada, valores indisponíveis e ausência de escolha fabricada nos casos sem proposta correspondente.

Esses são casos escritos, não resultados de execução. Os fixtures de autoridade/identidade e a ausência de Session Relay nativa continuam limitando o que se pode inferir deles.

### Pins do snapshot comparado

Paths relativos a `modules/sucafina/Sucafinav1/`. Os hashes abaixo foram calculados pelo formato Git `blob` sobre os bytes dos arquivos; nesta seção não foram obtidos de um commit remoto W7.

| Path | Blob no conteúdo W4 | Blob local preparado para W7 |
| --- | --- | --- |
| `product/routines/review.ts` | `39d6928e701f3c5e9be7f48a2a7614fa04872a10` | `fd0ef08175ee5e61d6fbda64f9b1225e4b19857f` |
| `product/routines/dossier.ts` | `ce3702b19f7f4cdc86015248fd49a38e2eadb8fd` | `ed88a6ff4f6c42eecfd80ba13824e8122fcc774e` |
| `test/product/wp09/planner-confirmation-consumer.test.ts` | `b274a4d588e09d66659d34a25d9c24b165e72608` | `732d1a6c5ace00391c489cdc3f77f949646269de` |
| `test/product/wp09/preparation-egress.test.ts` | `2fa49f20a83a087a07f15b5cee1451a86443735b` | `836c4f5bcd8cb0b8ed312409b3d8f1e25110120e` |
| `test/product/wp09/request-dossier.test.ts` | `8d3d6ecb4f3809f930e68598ec0a0083cd74e7d4` | `6df655d56a5b6b8a1e36c384d550ef2b4dc6c8b7` |
| `test/product/wp09/review-product-consumer.test.ts` | `af577f2042c41068c46f53de6c951d472021fc85` | `3286e1aa4415ade72aed5d1f6d3737ca32a9ab9a` |
| `test/product/wp09/sourcing-consumer.test.ts` | `84e02ef793e31bb0120bbd0976e3ea583eac173e` | `081c32f0ac84b9bd4016e875f6abb46c4625172f` |

## Evidência hospedada anexada pelo integrador WP09 após a revisão

Esta nota do integrador não amplia o escopo da revisão estática independente acima. O candidato final `a3dcbb62c88231f95a7c57afb32e975404a3b59c` passou 175 testes em 31 arquivos no run 43540247856. O timeout WP06 reproduziu isoladamente no run 43540684025: 0 pass / 1 fail, 57 expect calls, 120000 ms de limite,132734,06 ms reportados para o teste. A hipótese da barreira continua sem localização comprovada pelo log; o patch proposto não foi aplicado. Todos os SHAs e vínculos constam de ci-evidence.json.
