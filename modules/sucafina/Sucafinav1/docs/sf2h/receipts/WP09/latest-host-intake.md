# WP09 — intake dos produtores publicados mais recentes

Data da inspeção: 2026-11-14. Estado deste recibo: **LATEST_PUBLISHED_INTAKE_STATIC_ONLY**.

## Decisão

**D1 e D2 continuam abertos nos novos SHAs publicados.** WP10 acrescentou composição de produtores/verificadores de análises e WP00 melhorou o diagnóstico dos consumidores. Nenhum desses deltas fornece a admissão C07 ou o leitor terminal/artefato exigidos pelo produto WP09 atual.

É possível compor seletivamente cinco blobs publicados para qualificar o consumidor WP00 e as novas cercas de estado C08 em CI hospedado. Essa composição tem um contraexemplo de migração ainda não resolvido no provider WP10, descrito abaixo. Ela não deve ser apresentada como caminho para obter aprovação nativa ou um gate verde por inferência.

Não importar o pack WP10 inteiro sobre WP09: seu manifesto e os dois arquivos conferidos diretamente ainda contêm produto WP09 de W1, anterior às correções R1–R8. A composição deve preservar `product/routines/` e `test/product/wp09/` do candidato WP09 atual.

Nenhum produto, teste ou typecheck foi executado nesta inspeção; nenhum blob de produto foi importado e nenhum arquivo de outro owner foi editado. A única escrita foi este recibo. Não foi atribuído resultado ao CI de W9 em andamento.

## SHAs e fonte da leitura

As consultas remotas usaram exclusivamente GitHub MCP, com refs imutáveis. Os heads das duas PRs foram confirmados por `get_pr_info`; ambas permaneciam abertas e draft no momento da consulta. Os corpos das PRs ainda citavam os heads anteriores, portanto os SHAs abaixo vêm dos metadados e dos arquivos consultados, não do texto antigo da descrição.

| Fonte | Anterior | Consultado agora |
| --- | --- | --- |
| [WP10 / PR29](https://github.com/gustavomhss/Orchestra-SF/pull/29) | `d02c64430d459d183eeb9e467e1c35d9a6b958f8` | `87f7317d5f983adb255a5707b65d6f07bfa5a0d4` |
| [WP00 / PR20](https://github.com/gustavomhss/Orchestra-SF/pull/20) | `29f40e0f0fafa8d526df9b280151962187f1440d` | `1e09268b53e08fa4190c3969424973def7e1327e` |
| [WP09 / candidato W9](https://github.com/gustavomhss/Orchestra-SF/commit/c4e332cb2e1c6ee9b2432ce6ff19a70efc2014a9) | — | `c4e332cb2e1c6ee9b2432ce6ff19a70efc2014a9` |

## D1 — a composição de análises avançou, a admissão de rotina permanece indisponível

Em [host-context.ts no WP10 atual](https://github.com/gustavomhss/Orchestra-SF/blob/87f7317d5f983adb255a5707b65d6f07bfa5a0d4/apps/cli/src/sucafina-product/host-context.ts), linhas 225–235 passam a montar `createSfAnalysisServices` com forecast, cenários, sourcing, colaboração, revisões e documentos. As linhas 238–241 expõem preparação de análise sob autorização humana e contexto do caso. Isso é uma melhoria concreta na composição desses produtores.

Entretanto, a linha **442** ainda define os cinco métodos de `BusinessPorts["routines"]` como `unavailable`: `catalog`, `prepareAdmission`, `readAdmission`, `readRun` e `run`. A instância de `createSfAnalysisHost` recebe esse objeto na linha seguinte. O [business-services.ts atual](https://github.com/gustavomhss/Orchestra-SF/blob/87f7317d5f983adb255a5707b65d6f07bfa5a0d4/apps/cli/src/sucafina-product/business-services.ts) não importa nem instancia `createSfRoutineProduct`; `extraDescriptors` não recebe o factory no composition root examinado.

O novo [analysis-services.ts](https://github.com/gustavomhss/Orchestra-SF/blob/87f7317d5f983adb255a5707b65d6f07bfa5a0d4/apps/cli/src/sucafina-product/analysis-services.ts) associa pares de producer/verifier por skill, faz descoberta e revalida seleção, caso e autoridade. Seus bindings de revisão em 54–56 e 87–89 recebem a porta WP07. Não recebem `RoutineResultAccess`, `prepareAdmission`, um arm C07 ou um leitor de execução terminal. `discovery()` declara expressamente que não comprova execução nem consumo posterior. O [teste novo dessa composição](https://github.com/gustavomhss/Orchestra-SF/blob/87f7317d5f983adb255a5707b65d6f07bfa5a0d4/modules/sucafina/Sucafinav1/test/product/wp10/analysis-composition/analysis-services.test.ts), linhas 48–59, usa um par de fronteira explicitamente sem prova nativa.

Além disso, o [verificador atual de rotinas](https://github.com/gustavomhss/Orchestra-SF/blob/87f7317d5f983adb255a5707b65d6f07bfa5a0d4/apps/cli/src/sucafina-product/analysis-verifier-routines.ts) preserva as recusas:

- Linha 27: `MeetingMaterialInput.factualRoutineResults` não vazio retorna `review-result-link-unavailable`.
- Linha 92: revisão executiva com `factualRoutineResults`, `confirmations`, `routinePreparation` ou `admittedRun` retorna o mesmo motivo.
- Linhas 114–115: a saída da revisão executiva também recusa `orderedResultRefs`, `runRef` ou `resultRef`.

O [producer executivo](https://github.com/gustavomhss/Orchestra-SF/blob/87f7317d5f983adb255a5707b65d6f07bfa5a0d4/apps/cli/src/sucafina-product/input-producer-executive.ts) confirma essa fronteira: linha 74 recusa `includeConfirmations`/`includeRoutineResults`; linha 64 monta arrays vazios para ambos. O delta do verificador desde o head anterior corrige sintaxe e tratamento de chart; não remove a fronteira de ligação ao resultado de rotina.

**Delta ainda necessário, WP10/S0:** montar o factory WP09 corrente com portas nativas de publicação/admissão/run/leitura, autoridade SF da sessão, registro admitido completo e recibos C07. Ligar o resultado autorizado ao producer/verifier executivo e aos descritores/descoberta. Não converter uma execução de análise residente em recibo Relay por alteração de rótulos, nem sintetizar Task/arm/aprovação para preencher os vínculos ausentes.

## D2 — C08 de estado e resultado terminal são provas distintas

No WP00 anterior e no atual, os quatro blobs de contrato abaixo são idênticos:

| Path relativo a `modules/sucafina/Sucafinav1/` | Blob Git |
| --- | --- |
| `product/contracts/ports.ts` | `88b6efb4840b8731f707862a8baf14683526c7a9` |
| `product/contracts/context.ts` | `ae2d6b73a24970ba23d21e17694b54fd32d1a700` |
| `product/contracts/outputs.ts` | `4db2e631bd83ccda67442824557881c2ed990c92` |
| `product/contracts/output-schemas.ts` | `0d9fc51d26a0ca726d32e74605b555f871d99af6` |

[ports.ts:92–98](https://github.com/gustavomhss/Orchestra-SF/blob/1e09268b53e08fa4190c3969424973def7e1327e/modules/sucafina/Sucafinav1/product/contracts/ports.ts) continua oferecendo as cinco portas de rotina. [context.ts:145–163](https://github.com/gustavomhss/Orchestra-SF/blob/1e09268b53e08fa4190c3969424973def7e1327e/modules/sucafina/Sucafinav1/product/contracts/context.ts) continua definindo `RoutineResult` sem estado terminal, revisão da execução e digest imutável de conclusão. Os mapeamentos de saída e schema de `sf_routine_result` continuam sendo esses metadados.

O WP09 corrente exige separadamente `expectedInputDigest`, `readExecution`, `readArtifact`, `revalidateArtifact` e autorização, retornando `{ run, execution, output }`. O novo WP10 não monta essas funções. Seu leitor de contribuições/`analyses.output` valida o lifecycle e o envelope de análise residente; isso não constitui o snapshot terminal e o artefato de uma rotina admitida por C07.

**Delta ainda necessário, WP00/WP10/S0:** publicar o contrato completo de saída ou um seam explícito correspondente e ligar os leitores a recibos/artefatos nativos persistidos. O digest da entrada deve vir do registro admitido integral; o digest da saída deve ser pinado pelo registro terminal. O avanço de `checkNamespaces` no provider de estado é útil, mas não substitui essas evidências.

## O que o consumidor WP00 atual comprova sobre WP09

O [contract-consumers.test.ts atual](https://github.com/gustavomhss/Orchestra-SF/blob/1e09268b53e08fa4190c3969424973def7e1327e/modules/sucafina/Sucafinav1/test/product/wp00/contract-consumers.test.ts) mudou do blob `de0a94a7938819060d78c529005de5df67a2f7c2` para `92f2efc066c2018bdbf1a27559a2ffd8a7b5843f`.

O delta separa cada export e campo aditivo em um teste, captura autorizações/callbacks/versões/snapshots antes da asserção agregada e verifica os seis campos da migração após gravação/retry. `stateConsumer()` e sua chamada ao provider não mudaram. O arquivo não chama `createSfRoutineProduct`, `openResult`, `readExecution` ou `expectedInputDigest`.

Nas linhas 17–23, `Bun.file()` lê texto e um regex confere o nome exportado. Não verifica assinatura, instanciação ou execução. As seis operações de rotina apontam, no freeze atual, para `product/routines/capabilities.ts`:

| Operação | Export esperado e presente no WP09 atual |
| --- | --- |
| `sf_routine_catalog` | `readRoutineCatalog` |
| `sf_routine_prepare` | `prepareRoutine` |
| `sf_routine_run` | `runAdmittedRoutine` |
| `sf_routine_status` | `readRoutineStatus` |
| `sf_routine_result` | `readRoutineResult` |
| `sf_watch_prepare` | `prepareWatch` |

O vínculo de WP00 ao factory permanece **somente de tipo** em [contracts/host-context.ts](https://github.com/gustavomhss/Orchestra-SF/blob/1e09268b53e08fa4190c3969424973def7e1327e/modules/sucafina/Sucafinav1/product/contracts/host-context.ts): import na linha 14 e `routineRuns?: Pick<ReturnType<typeof createSfRoutineProduct>, "discoverRuns">` na linha 48. O factory publicado elimina o import estrutural ausente; esse consumidor não demonstra seu uso operacional.

## Composição seletiva possível agora

O conjunto abaixo é o mínimo identificado para carregar o consumidor novo e alinhar suas dependências diretas de tipos/provider. **É um candidato de qualificação, não uma previsão de aprovação.** Cada arquivo deve ser copiado literalmente do SHA indicado, com comparação de blob, sem reescrita de fontes WP00/WP10. Os contratos e o provider novos alteram interfaces compartilhadas; a composição exige novo typecheck hospedado e seleção afetada, sem reaproveitar automaticamente o resultado de W9.

| Fonte imutável | Path relativo a `modules/sucafina/Sucafinav1/` | Blob Git | Necessidade |
| --- | --- | --- | --- |
| WP00 `1e09268b53e08fa4190c3969424973def7e1327e` | `test/product/wp00/contract-consumers.test.ts` | `92f2efc066c2018bdbf1a27559a2ffd8a7b5843f` | Novo consumidor; ausente no tree W9 consultado. |
| Mesmo WP00 | `product/contracts/state-layout.ts` | `c3a6e039badc5ed49b20caa7153cb01979ebec9a` | Import necessário; ausente no tree W9 consultado. |
| Mesmo WP00 | `product/contracts/state.ts` | `755639b2a16265fe164ba2e6343738c1362d168c` | Declara `bi-artifacts`, campos aditivos e `checkNamespaces`; W9 tem `d1e3ed1cdb64e38f6770ea5e864f80b41b05b688`. |
| Mesmo WP00 | `product/contracts/context.ts` | `ae2d6b73a24970ba23d21e17694b54fd32d1a700` | Fornece `BiPresentation`/`BiViewId` importados pelo novo `state.ts`; W9 tem `dbaa8dd7a57134769aa12d4e196db1013cb278cb`. |
| WP10 `87f7317d5f983adb255a5707b65d6f07bfa5a0d4` | `product/host-binding/state-provider.ts` | `ac905cec7c0d65c9f2b96a0d4ec97bd87866ef6f` | Implementação publicada de `bi-artifacts`/`checkNamespaces`; W9 tem `b7988a2963a2797a96ea19ab2b3a481564548213`. |

O provider selecionado autoriza as dependências de leitura (`50–54`), verifica suas versões antes do callback (`83–84`) e revalida essa autoridade antes do commit (`88–89`). Essas implementações são diferenças aproveitáveis em relação ao provider de W9; sua execução deve ser qualificada pelo consumidor. Não se afirma que todas foram introduzidas nos dois commits mais recentes de WP10.

Não é necessário trocar `freeze-v1.json` apenas para o scan de exports: os 39 trios `operation`/`handlerPath`/`handlerExport` são iguais entre W9 (`1f8e96add2bd7aa593387a1379f0888d9f34b499`) e WP00 atual (`ae8b96bc50ddd64404ae16c9e3ee1129cc6e3104`). Outros metadados diferem; essa equivalência não se estende aos demais usos do freeze. `product/ai/resident.ts`, `runtime/contract.ts` e `test/fixture/persistence.ts` já são blobs idênticos nos refs W9/WP00 consultados, respectivamente `3e025a1395511af4f09de903b35d6b1cf20198ac`, `b62fce6f0fb0845dbfd18cc94009c33f1586b9c5` e `b33c8f41fb719266e6100e8dc307c53ec66cdcff`.

`analysis-services.ts`, `host-context.ts` e `business-services.ts` novos pertencem a uma composição WP10 mais ampla, com dependências de workspace, dashboard e outros producers. Importá-los isoladamente não fecha D1/D2. Não são parte do conjunto mínimo acima. Caso S0 componha essa camada, deve seguir os pins transitivos publicados, preservar os blobs próprios WP09 atuais e qualificar o composition root completo.

### Finding compartilhado: migração C08 ainda incompleta

**Contraexemplo estático reproduzível por caso já escrito; owner WP10/S0.** O [layout WP00, linha 26](https://github.com/gustavomhss/Orchestra-SF/blob/1e09268b53e08fa4190c3969424973def7e1327e/modules/sucafina/Sucafinav1/product/contracts/state-layout.ts) exige os seis campos aditivos: `claimBindings`, `commandProposals`, `compositeScenarios`, `decisionResults`, `nativeRuns` e `biArtifacts`. O consumidor atual, linhas 45–91, remove esses campos do estado legado, grava sob autoridade, repete o comando e compara todos com `{}`.

No [provider WP10 atual](https://github.com/gustavomhss/Orchestra-SF/blob/87f7317d5f983adb255a5707b65d6f07bfa5a0d4/modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts), `emptySfState():149–151` inicializa apenas `biArtifacts` dentre os seis. `readSfState():154–166` acrescenta apenas `biArtifacts` ao legado; a transação em 37–140 não inicializa os outros cinco. Assim, a leitura estática prevê cinco campos `undefined` no contraexemplo. O caso não foi executado nesta inspeção.

**Delta concreto ao owner:** completar a inicialização/migração dos seis campos na gravação autorizada dentro da transação existente, preservar campos já presentes e o retry exato, manter leitura sem commit e as cercas por namespace. Não alterar o teste para aceitar campos ausentes. Até a correção publicada e a execução hospedada, a composição de cinco arquivos torna esse problema observável; não resolve a migração nem D2.

## Pins WP10 e risco de regressão por composição integral

O [composition-pins.json atual](https://github.com/gustavomhss/Orchestra-SF/blob/87f7317d5f983adb255a5707b65d6f07bfa5a0d4/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/composition-pins.json), blob `db7d40e1601b3b9b3d741eb5251af48f4f271184`, mantém as mesmas **595 entradas de origem** do head anterior (blob `c6482187ea8feccbd1be766ae1bd51c8360c4e7e`). O avanço acrescenta `wp10Deltas` com os overrides próprios e suporte publicado; não atualiza os pins WP09/WP00 dessas entradas.

- Os **42 paths WP09** continuam pinados em `115326b1337b73c5e275624a8d401b41e8ed1c9e` (W1).
- Os **20 paths WP00** continuam pinados em `29f40e0f0fafa8d526df9b280151962187f1440d`.
- Os arquivos remotos WP10 `product/routines/factory.ts` e `result-access.ts` foram conferidos diretamente: blobs `ace7a8c564abfcb923f967868d31e69ba4c76708` e `a2756676b5991bd75ecb1a724086a2131b8cd8b0`, iguais aos pins W1. O segundo ainda não exige `readExecution`.

A importação integral desse pack sobre W9 reintroduziria o leitor anterior ao pin terminal e às correções registradas em `independent-review.md`. O caminho correto é selecionar somente fontes estrangeiras necessárias e registrar a precedência dos blobs próprios WP09 correntes. A atualização dos pins do composition root integrado pertence a WP10/S0.

### Outros blobs WP10 lidos

Todos no commit `87f7317d5f983adb255a5707b65d6f07bfa5a0d4`:

| Path | Blob Git |
| --- | --- |
| `apps/cli/src/sucafina-product/host-context.ts` | `c02776411a3eafe6070b088ed284575071be9e0c` |
| `apps/cli/src/sucafina-product/analysis-verifier-routines.ts` | `68905e46890ae489669e0efaca00826f21cbae6f` |
| `apps/cli/src/sucafina-product/analysis-services.ts` | `d510fdb54e91e49a215e6f030f1382b5905f4bfb` |
| `apps/cli/src/sucafina-product/business-services.ts` | `e8e9fb1a5eea0e5af05519ad92c220ba000d635d` |
| `apps/cli/src/sucafina-product/input-producer-executive.ts` | `dcaaf60436a26bd6c95883f803f12025ac082485` |
| `modules/sucafina/Sucafinav1/test/product/wp10/analysis-composition/analysis-services.test.ts` | `f8e2886ac152eccaf4cf101475fbe49619c668eb` |

O contrato `product/contracts/host-context.ts` lido no WP00 atual tem blob `fa0d39f3dfc23bfce751d91b00ae6c8fc2a87686`. Nenhum desses pins constitui recibo de execução. GNATIVE, aprovação de CI, critérios integrados e release permanecem sujeitos às evidências próprias e à revisão de S0.
