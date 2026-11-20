# HANDOFF — sf-shard-b

## SHA e estado

- Estado: **IN_PROGRESS — entrega completa, verde e mergeada autorizada; este checkpoint não declara os shards aprovados.**
- Base imutável: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0` (`sf-join-four`).
- Código de B: `9293c770eae37bc15bc4a18cf0f88b20fcaf519c`; o próximo commit altera somente este handoff.
- Candidato integrado: `f2e12f39f4dcfbb72ba248e1e938bf2569de8c52`, árvore `63fdde2c33dab466a529bb8f73bdcf3b70e8d172`, branch `sfb-complete-composition`.
- Target incorporado por merge verdadeiro: `ab68f1989280e95ed7152bccd62fa7a52cdfc829`. Nenhum rebase.
- Inventários originais: **118 / 119 / 109 arquivos**, sem redistribuir por LPT. Requests originais `dd45d888617943df40e02815d58b59f88d8a18f7`, `f0bccdc48b42a9d000f3bda6565fa3d88286c845`, `204a74491764dcde4da22ebe558efc318e04a777`.
- Cópias verificáveis dos requests e listas exatas em blobs GitHub: shard4 `b1a3c76c86620cd94839bb056fbb4a0ce3729ab2`; shard5 `833689d8ece7c45375ced7a0806e53b5bc928a91`; shard6 `f9b588fc368a963b396101f1fd88769fe0ee2c62`.
- PR principal [#410](https://github.com/gustavomhss/Orchestra-SF/pull/410), draft até qualificação integral.
- GitHub somente; execução por Actions. Sem shell, sf-ci, edição de runtime/application.ts, ampliação de prazo/lease, recriação de console morto ou push nos quatro branches proibidos.

## Checkpoint atual — prevalece sobre os registros anteriores

### Resultados completos recentes

| Causa | Run | Resultado | Falhas e localização |
| --- | --- | --- | --- |
| Ancestry parser corrigido | [44683555039](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44683555039) | **51 pass / 2 fail**, 53 testes | `wp10/integration/calculation-ancestry-composition.test.ts:39`: prazo105s, outer314reads; `planner-calculation-ancestry-scope.test.ts:113`: fixture tentou rebinding proibido da cobertura. |
| Consumidores nativos / JSON | [44685338648](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44685338648) | **6 pass / 4 fail / 1 error**, 10 testes | Dashboard `dashboard-installed-closure/consumer-read.test.ts:67` e BI `wp10/integration/bi-lifecycle.test.ts:310`: body CDP descartado; BI `:402/:431`: labels antigas. |
| Recuperação nativa original | [44685955107](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44685955107) | **4 pass / 6 fail**, 10 testes | Todos6 recovery antes da UI em `native-ui-browser/session.ts:16`, chamada `ui-split/ui-recovery/fixture.ts:57`: Browser.newPage cria contexto owned, incompatível com nova página de enrollment. Todos4 health passaram. |
| S10 composição anterior | [44680602254](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44680602254) | **28 pass / 6 fail observados; incompleto**, sem sumário Bun | Run tests40min interrompido. Installed sensitivity-history `:19` duas vezes e `:66`; coverage-sensitivity-integration `:23/:184`; semantic-union-source-scenario `:33`. portfolio-exact-threshold interrompido; portfolio-sensitivity-observation e portfolio-promotion não iniciaram. |

Mensal1/0, HTTP1/0 e Personal Views1/0 passaram inteiros no run44685338648. Dashboard revogação1/0 e BI autoridade/origem2/0 também passaram; isso não torna o conjunto verde. S10: os17 controles de fixture e6 de read-scope passaram, mais5 casos WP13; não converter arquivos interrompidos/não iniciados em pass/fail.

### Correções concretas publicadas e pendências

- B `f6358733100431b77a554776c572c6d1a14043e9`: `wp11/fixture-input-pin.ts:12` e6 controles diferenciais; `fixture-read-observation.ts:42` mantém TODOS os pins/checks, substituindo somente o hash repetido pela igualdade canonical exata de objetos planos. Dados complexos mantêm o serializer completo. Não altera digest persistido, autoridade, C08, snapshots ou prazos. Revisão independente concluída; Actions pendente.
- Shared [#500](https://github.com/gustavomhss/Orchestra-SF/pull/500), head `88042f5584674f4246f87666962239e824ca6d4b`: `apps/cli/src/sucafina-product/planner-sensitivity-observation.ts:1` reconhece fases fechadas reais units/resolve/revalidate/preview/exact. Mesmos produtores, callbacks e testemunhas IEEE adjacentes. Fonte pura exige componente único confirmado USD, mesmo período e operação; digest do resultado atual. B `1e4d4f64f8ba19d008ad45566d6f6f9b43a87330` acrescenta28guards e liga o consumidor installed ao observer real. Review duplo concluído; Actions pendente.
- B `63c2495c055a3f91440a3f8cc99a8050a776ffbb`: `native-ui-browser/observed-fetch.ts:1` observa a cópia da única chamada fetch genuína antes da navegação/cancelamento, preservando payload/UUID; Dashboard e BI usam a mesma resposta. BI usa os campos nativos atuais e conserva o aborto obrigatório. Recovery cria contextos explícitos e permite enrollment real. Todas as asserções e prazos originais mantidos.
- Shared [#491](https://github.com/gustavomhss/Orchestra-SF/pull/491) head `f30a2bf3fa0cb1890a16b87f568d24c0f01556f4`: produção21paths; prepare/review recebem os mesmos escalares admitidos em JSON plain. Backend/health4PASS; seis jornadas browser ainda em qualificação. UUID original protegido, recuperação somente leitura, nenhum segundo apply; journal opaco com purge owner/logout/reload. Não declara recibo/GO fabricado.
- Shared [#481](https://github.com/gustavomhss/Orchestra-SF/pull/481) head `ae821e48d26a9110d05025795cb1707993ca0d89`: observa somente sufixos readonly autenticados de case-read/request-read e o simulador público. Todos os callbacks, duas leituras/fences e leaf eligibility preservados; histórico e escrita fora. B `a155b681c66b1aa674e064f1fd384aff02deadf6` contém26guards, troca real de callback de cobertura e marcos de diagnóstico no original105s. Union business `36463d04d60bc9f50e67f075a59dfaef5a1cf856` preserva #488. Actions pendente.
- S10 raw e ancestry ainda exigem resultado após esses fixes; nenhum ganho de tempo foi declarado sem Actions. A falha stale sample-coverage anterior pode decorrer da validade original300s do certificado após custo excessivo; hipótese, não causa temporal provada. TTL permanece300s.
- CF13 permanece pendente do receipt recovery e da composição final. Health4 e Personal Views1 já têm evidência por caso; conjuntos falhos continuam falhos no ledger. Preservar38artefatos, histórico BLOCKED/NOT_REVALIDATED e toda a matriz; sem baseline/digest de aprovação fabricado.
- Integração de target: B `9293c770eae37bc15bc4a18cf0f88b20fcaf519c` incorporou20paths sem overlap com52paths próprios. Owner union `253d3cf261218d7018ec6011b69b5fc35eb24788` mantém #448/#461/#491 e os4hunks externos de navegação. Runtime/application.ts intacto.

### Merges recentes verificados

- [#446](https://github.com/gustavomhss/Orchestra-SF/pull/446) → `c36c9b1a3f63d6b8e5931b7b09fbb01385972b00`: Personal Views original1/0, run44685338648.
- [#487](https://github.com/gustavomhss/Orchestra-SF/pull/487) → `ab68f1989280e95ed7152bccd62fa7a52cdfc829`: mensal original1/0 no mesmo run, raw/proxy/JSONextra/Preview=Apply/CAS409 preservados.
- Ambos seguem os merges já registrados abaixo. Target externo #478/#486/#489/#490 preservado. Os merges dos stacks restantes e #410 ainda estão pendentes.

### Gates ativos e fila exata

- Ativo [44685754065](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44685754065): `Complete-physical-read-phases-and-final-witness`, source `1a82eb89bde94c542dc154f44676223945b7bda5`, request `6af649d654a84c50234529da2a6c6e476d6a4a92`,9arquivos. Aguardar workflow completo/cleanup.
- Ativo [44687720789](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44687720789): `Native-explicit-context-and-response-capture`, source `5e56ee3b306100c47c395a59f7bb7169f492e8cb`, request `8fc6ca0aa75b6c5f4c055d80027cefa7006cd64d`,13casos (Dashboard2+BI5+recovery6).
- Fila ancestry readonly: source `510b723ed93575aecf40d32468a120a0953f2311`,4arquivos,56casos previstos,26guards+24calculation+5scope+1original. Publicar uma única vez ao liberar slot.
- Fila sensitivity physical/pins: mesma source `510b723ed93575aecf40d32468a120a0953f2311`,10arquivos (8anteriores+28guards+6pins). Ainda não publicado; não há rerun idêntico.
- Máximo2workflows simultâneos incluindo cleanup. Não usar sf-ci.

### Como retomar e ordem de merge

1. Ler os runs ativos acima e só depois publicar a próxima causa corrigida. Não repetir request sem mudança. Logs de job apenas concluído.
2. Qualificar as fatias restantes preservando os budgets originais e as falhas como evidência. Corrigir todo desvio; o objetivo do usuário é completo/verde/mergeado.
3. Merge dos stacks qualificados, sem rebase: performance #405→#445; #414; #420→#424; #403→#436→#441→#455→#464→#471→#472→#488→#500; #481 com união business; UI #449, #452→#480, #448/#461→#491. #446/#487 já mergeados. Resolver somente os overlaps reais e preservar `planner-memory-read-scope.test.ts` blob `f05df4dc2b74b829be1fbd97542ddd65bc4f273e`, que a árvore intermediária production-only de#488 omitiu.
4. Preparar CF13 com os receipts reais. Seu gate será o shard5 original119arquivos, junto de4/6 na mesma árvore final; sem gate CF13 avulso.
5. Rodar os inventários originais118/119/109 completos, no máximo2 simultâneos. Só depois mergear#410 e conferir o tree efetivamente mergeado.
6. Atualizar este handoff e responder por shard com run, Npass/Mfail, falhas(file:line) e SHA. Não somar gates focados como se fossem um shard completo.

## Registro de checkpoint anterior — histórico operacional

As informações desta seção correspondem ao checkpoint anterior e não substituem o estado atual acima.

### Continuação registrada anteriormente

Esta seção prevalece sobre o estado operacional histórico abaixo. Falhas antigas, cancelamentos e contagens incompletas permanecem fatos históricos; gates focados não somam uma qualificação integral.

### Checkpoint adicional — revisão e composição

- B `e2f6b942ec8a3db3fd5bf848773842fe97ee7987`: `wp01/personal-views.test.ts:109` captura cópia do fetch real no navegador antes de devolver a resposta ao consumidor. Mesmos argumentos, uma chamada original; 26expect+5browserExpect e assertRestored inalterados. Sem replay/mock de resposta.
- B `8b0954ae536ec7395c96b9dd27a81c7b05600cd9`: fixture/17controles de `wp10/integration/planner-observation-batch.test.ts:1`. Shared[#488](https://github.com/gustavomhss/Orchestra-SF/pull/488) `27c4a6b897529b3af34618d565a9cb84f16543e0`: fase pura completa, closure de inputs, todos callbacks canônicos, C08/3snapshots/sourcefences e egress frescos. Revisão independente concluída; Actions pendente. Business union `14512133f127a4c1d4389f91c618a797f79631d9` preserva #481.
- B `837d2872083d6b2d7399a4733e66aa3244bb072a`: `wp11/fixture-read-observation.ts:94–111` fecha ambiente após última autorização C08. 20guardas incluem final-day/final-actor/post-envelope-day. Não confundir com o gateS10 ativo, que usa o helper anterior.
- B `655da86459690b28a2e2cef61bca0e192a9f63af`: merge verdadeiro do target37beac, delta12paths lido. Preserva #484/#485/#475/#479 e Atlas receipt `f79cec065c37912a760dcab6b382e4fb18e81616` na master; a composição não sobrepõe mais esse blob pelo preimage antigo.
- B `8075d9f0c161477673af7e17c5f9933ddd307d83`: cinco arquivos de recuperação nativa; 4narrativas originais+1guard de outro owner/reload, todos60s. Shared[#491](https://github.com/gustavomhss/Orchestra-SF/pull/491) `d47adad059a1e02bc95363d437a94a66789ef715`,21paths, base de dependências `sfb-recovery-deps`51caa363. Backend/API revisados; fila de gate bloqueada durante dois fixes concretos encontrados na revisão: purge em403 da preparação e callback assíncrono do editor após cleanup. Nenhum gate recovery publicado ainda.
- Auditoria independente aplicou em memória os patches dos13PRs de performance sobre target37beac: os30postimages são byte idênticos à composição. No merge de #488, preservar explicitamente `planner-memory-read-scope.test.ts`f05df4dc, herdado de #436, pois a árvore production-only desse merge intermediário não o contém.

### Integrado e conferido

- #435 `82d2041d80784e2d905f99dee3bca91c63ef8350`, [44667463947](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44667463947) **3/0**.
- #442 `45514008d7ce275327003c5d92faaeeab2479739`, [44673967393](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44673967393) **18/0**.
- #433 `3910a644c7fdab1a438c2b5b39d69afc19361709`, [44675050868](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44675050868) **16/0**, arquivo Review completo, browser e purge.
- #466 `152be1f2bb7f3f5218ea3de06b60c31f37d8093f` e #434 `db14b2a3a04689841b033312cb989741e5677a50`: [44677071823](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44677071823) **33/1 no conjunto**, sendo planner-calculation **24/0**, calculation-case-scope **5/0**, similarity installed **4/0**. Falha independente na primeira produção ancestry; não pertence ao ramo settled. Bodies/merge commits registram precisamente esse limite.
- #439 `d1bcd200a3e9f34cf054671d16263ac2407410e1`: os dois testes completos de import-analysis passaram em [44678987832](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44678987832) (**2/0**). O conjunto nativo foi **7/10**, sem alegação de workflow integral verde.
- #468 `9d3a70179cc1ced293c58d4dfc032d5d2aa41bf6`: o mesmo run prova Chromium emparelhado iniciando em aproximadamente300ms, fronteira Node/AppProcess e encerramento físico. Prazo15s preservado. Os oito blobs pós-merge de #439/#468 coincidem exatamente com a composição qualificada.
- Merges de target preservaram C12 nativo, URLs BI Budget exatas, semantic-discriminants, C09 e Review; todos os deltas foram lidos. Pin diagnóstico atual resulta dos bytes reais de #442, sem baseline fabricado.

### Runs desta continuação

| Causa / gate | Run | Resultado observado | Código do gate |
| --- | --- | --- | --- |
| C03-transport | [44667407691](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44667407691) | 0 pass / 1 fail | registro histórico |
| AlternativeDraft-rendering | [44667463947](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44667463947) | 3 pass / 0 fail | registro histórico |
| S10-snapshot | [44667978696](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44667978696) | 16 pass / 2 fail | registro histórico |
| C03-enrollment-page | [44668069860](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668069860) | 0 pass / 1 fail | registro histórico |
| Native-sourcing-admission | [44668567443](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668567443) | 3 pass / 0 fail | registro histórico |
| C03-node-owner | [44668879392](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668879392) | 0 pass / 1 fail | registro histórico |
| Review-current-denial | [44669159725](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44669159725) | 15 pass / 1 fail | registro histórico |
| C03-current-denial | [44670314438](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670314438) | 1 pass / 0 fail | registro histórico |
| Native-monthly-browser | [44670331648](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670331648) | 0 pass / 2 fail | registro histórico |
| Planner-memory-observation | [44670534535](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670534535) | 28 pass / 2 fail | `91bcd283b6c4fbd9bc9575d232cbc62ddea9630b` |
| Portfolio-canonical-observation | [44670599697](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670599697) | 41 pass / 4 fail / 1 errors | `91bcd283b6c4fbd9bc9575d232cbc62ddea9630b` |
| Native-browser-fixture-composition | [44673683546](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44673683546) | 0 pass / 1 fail | registro histórico |
| C09-abort-provenance | [44673967393](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44673967393) | 18 pass / 0 fail | `32c97d3b4de5bb7960ca42f816b11ea37f594541` |
| Native-browser-half-close | [44674551510](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44674551510) | 1 pass / 1 fail | `50e2222b18cb44081df4a8ea9afea46204f12555` |
| Calculation-service-identity | [44674214842](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44674214842) | 17 pass / 4 fail | `32c97d3b4de5bb7960ca42f816b11ea37f594541` |
| Review-browser-purge | [44675050868](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44675050868) | 16 pass / 0 fail | `50e2222b18cb44081df4a8ea9afea46204f12555` |
| Native-connection-identity | [44675653919](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44675653919) | 0 pass / 3 fail | `e9f3ce75e387369686816cad758d24e3c72a1f9e` |
| Dependencies-observation-clock | [44675888290](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44675888290) | 0 pass / 1 fail | `e9f3ce75e387369686816cad758d24e3c72a1f9e` |
| Planner-physical-read-batch | [44676186908](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676186908) | 19 pass / 3 fail | `3e418a337751bc496d0d4c6cc0cfa38d6ee76faa` |
| Calculation-settled-recovery | [44677071823](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44677071823) | 33 pass / 1 fail | `a21c18957c075eeb913e7f97e627a0a23459e8aa` |
| Native-browser-runtime-and-consumers | [44678987832](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44678987832) | 7 pass / 10 fail | `24d6ff06dd796ebf237d8460e3ef3952b40d25a4` |
| Dashboard-case-physical-read-batch | [44679287587](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44679287587) | 11 pass / 1 fail | `5b0cb657c467ac1e953e9530bfcd54efab44bf75` |
| Mixed-case-physical-read-batch | [44680196613](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44680196613) | 36 pass / 1 fail | `aa58e28caa571b08da509668847300e38ccd0319` |
| Sensitivity-current-composition | [44680602254](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44680602254) | in_progress | `dd0f2e58232f0266ac7793908754d8a4164ed805` |
| Native-browser-consumer-boundaries | [44682182809](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44682182809) | 1 pass / 7 fail | `cecd55308fee7885cec1668ddd34ba42f4d29b76` |
| Calculation-completed-ancestry-observation | [44682675803](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44682675803) | 0 pass / 4 fail / 4 errors — importação falhou; nenhum teste executado | `be7f708a7b4349cd8d8edf13815393f22277cf83` |

| Calculation-ancestry-parser-correction | [44683555039](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44683555039) | in_progress | `ac009cd9fcf805ab357dca1c16fa32ed0c8d754b` |

### Resultado recente por causa e trabalho concreto

Caminhos de teste abaixo são relativos a `modules/sucafina/Sucafinav1/test/product/`.

- **Planner físico** — [44676186908](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676186908) **19/3**:18guardas passaram, AM01 five-profiles passou em807555ms; portfolio-recall240s e reevaluation300s excederam prazo. A guarda de scope ausente falhou em `wp10/integration/planner-case-read-batch.test.ts:317`: BCS recusa scope desaparecido antes de emitir. Fix B`73ca14579c734500361794d944e2d170058fdbd9` passa a provar recusa, zero recriação e C08/C02 íntegros; depois reemite explicitamente pelo issuer real e rejeita o ref antigo. Todos os60expect anteriores preservados +11. Shared#464 head`a00b6bb9134d80a6d377d5fee8fb519a3b272fb1`. Gate misto atual contém a guarda corrigida.
- **Batch misto** — [44680196613](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44680196613) **36/1**, 383expects,725.03s. Todos os19Planner+16mixedguards passaram; físicoPlanner162→5 e misto261→6, com todos os callbacks e projeções preservados. Purchase pending passou343855ms; complete excedeu360s em366873ms, `wp12/native-execution-purchase.test.ts:14`. Na variante complete, prepare31587ms, units46777ms, criteria8529ms, choose250997ms, readchosen2746ms. O próximo fix físico da fase readonly abrange também esse consumidor. Shared#471 ainda não mergeado.
- **Dashboard físico** — [44679287587](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44679287587) **11/1**. Os11controles em `wp10/integration/dashboard-case-read-batch.test.ts:1` passaram:384→6reads físicos, mesmas leituras lógicas de Planner/page/record/scopes, projeção completa e C08/C02 intactos. `wp12/native-execution-dependencies.test.ts:14` ainda excede420s,482073ms observados. Esse arquivo e suas guardas NÃO pertencem aos três inventários originais: são regressão adicional. Shared#472 permanece aguardando a composição final.
- **AM01/reevaluation/dependencies** — falha remanescente é trabalho repetido nas fases readonly de comparação/métrica/memória, não no cleanup. Desenvolvimento separado do owner físico genérico exige closure materializada também dos inputs; writes continuam fora. Memória só admite otimização quando recallScope.cases está explicitamente vazio e includeHistorical=false; pedidos de precedentes preservam fallback canônico.
- **Ancestry** — deadline original105s em `wp10/integration/calculation-ancestry-composition.test.ts:110`,470reads outer no run44677071823. Shared[#481](https://github.com/gustavomhss/Orchestra-SF/pull/481) head`f042f0d216e094e44e273c3bd6582fb2b07f2ebb` acrescenta prova completa lexical de folha, cycleguard original, C08 cases/preferences completos e callbacks frescos de fonte/cobertura. B`3b460540f34105e61c1ca32bedb5e3a49b1996ac` contém23novos controles, inclusive troca real de producers atrás da facade. Primeiro gate[44682675803](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44682675803) **0/4,4errors de importação**, nenhum dos53testes previstos executou: falta fechar o if em `apps/cli/src/sucafina-product/planner-calculation-ancestry-scope.ts:219`. Correção sintática de um único parêntese publicada em#481 `5b9ac06dc64707ca8357e56e9a2ce1b3800b877f`, blob2b8003a. Gate corrigido44683555039 em curso; não rerun idêntico.
- **S10/raw fixtures** — B`59087f07d0f0903a22d3bb37390a12b45885efba`,8paths. `wp11/fixture-read-observation.ts:25` compartilha só a transação física lexical dos fixtures WP05/WP11; executa todos os produtores e abre nova leitura C08 depois que o root fecha. Inclui envelope C08 inteiro,3snapshots, source fences, actor/day/request/lease/readers e testemunhos externos de Set/Map. `wp11/fixture-read-observation.test.ts:13` acrescenta17guardas; `wp13/sensitivity-read-scope.test.ts:1` mantém4originais e soma2unscoped#405. Todos os100expect-lines do full integration e38do scope preservados; prazos originais. Gate8arquivos[44680602254](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44680602254).
- **Runtime nativo** — [44678987832](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44678987832) **7/10**: import2/0, health4/0, BIorigin1/0. Nove falhas de teste mais um erro de controle Omni decorrente do HTTP falhar antes do spawn. Restam Dashboard2 (`dashboard-installed-closure/consumer-read.test.ts:34`), mensal (`wp01/planner-monthly.test.ts:74`), HTTP (`wp01/http.test.ts:89`), views (`wp01/personal-views.test.ts:126`) e BI4 (`wp10/integration/bi-lifecycle.test.ts:233`).
- **Fronteiras nativas** — [44682182809](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44682182809) **1/7**,8testes/4arquivos,71.06s,cleanupsuccess. Mensal passou ClipboardEvent, POSTpreview e células originais, avançando até Apply sem POST em `wp01/planner-monthly.test.ts:108`. HTTP passou descriptor e jornada completa até logout, falhando `wp01/http.test.ts:197` por esperar403 do endpoint nativo que distingue sessão ausente401; B`febcf57ecb9980333437c2e130c8b8573745764a` exige401 exato e ambos envelopes completos `{status:"unauthenticated"}`, preserva403CSRF. Views ainda perde recursoCDP em `wp01/personal-views.test.ts:128`, chamada:152: leitura imediata não bastou, revisão captura o fetch real no browser antes da navegação. BI4 continua sem catálogo em `wp10/integration/bi-lifecycle.test.ts:242`; identidade corrigida, mas faltava inicialização C08.
- **UI recovery não iniciado no baseline** — `ui-split/ui-recovery/recovery.test.ts:1`,4casos originais4×60s, em migração para editor/UI54. Backend readonly de recuperação mantém UUID original, intenção protegida em C08, recibo canônico completo, leitura antes de qualquer dispatch e fences de egress. Journal só guarda correlação opaca, com purge de F01 após logout/ownerchange inclusive outro capítulo e reload. Frontend recebe closedCommandReceipt, primeira gravação usa lookup original e draftRef exato, nunca título. Revisão de contrato em andamento; shared e gate próprios antes de aprovação.
- **Dashboard proxy** — shared[#480](https://github.com/gustavomhss/Orchestra-SF/pull/480) snapshot JSON antes do schema fechado de `private-draft-model.ts:67`; B`892b83032e78952754b1791148dc61e6d3df29dd` inclui prova com proxy real do browser e rejeição de JSON extra, mantendo todos os checks originais de `dashboard-installed-closure/consumer-read.test.ts`. Ainda sem gate após esse fix.
- **Apply mensal proxy** — shared[#487](https://github.com/gustavomhss/Orchestra-SF/pull/487), head`00f01d9f3eb872ce6de077364b42174a0b77c961`, dependente#446. `packages/client/src/sucafina/planner/monthly.ts:63` prepara snapshot JSON validado pelo mesmo schema fechado; `packages/app-shell/src/orchestra/chapters/sucafina/planner/opex/budget-view.tsx:499` usa após selecionar linhas revisadas. B`66aee6e14b49f0df34c22e8ca8b830d382b59bc8` prova raw/proxy/JSONextra no browser, POSTApply idêntico ao input de Preview e conserva conflito409/estado íntegro.
- **BI bootstrap** — B`fbe6b8e0795213574ce3de655cf4f96fa7a02e27`, `wp10/integration/bi-lifecycle.test.ts:234`: usa cookie do BrowserContext realmente inscrito e transaction autorizada no creationTarget para inicializar C08 vazio. Exige transaction/read ok e cases{}. Não altera grants, readiness, prazos ou quinto teste; o health original revalida suas duas leituras. Sem gate após esse fix.

- **CF13** — depende da evidência nativa e de recovery4 antes da atualização. Preservar38pins e histórico BLOCKED/NOT_REVALIDATED, matriz e consumerAcceptance completos; mudança de hash isolada não é aprovação.

### Gates ativos e fila

- **Sensitivity-current-composition**: [44680602254](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44680602254), source `dd0f2e58232f0266ac7793908754d8a4164ed805`, request `c26cd88e0987a25c0b1a3d32fb9c414f5e5c49a0`;8arquivos em curso. Aguardar também cleanup.
- **Calculation-ancestry-parser-correction**: [44683555039](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44683555039), source `ac009cd9fcf805ab357dca1c16fa32ed0c8d754b`, request `d6616c25952a2a190c2e4ca18aec2b765a0cfb96`;4arquivos/53testes previstos, depois do fix sintático concreto.
- **Fila Native-real-response-and-reactive-json**: source `e5bb7153d9b2f5cb38604b3e7b7432ec3661a3f4`,5arquivos/10testes: mensal/HTTP/personal/BI e consumer-read2. #480/#487, bootstrapC08/logout/body capture prontos. Ainda não publicado.
- **Fila Complete-physical-read-phases-and-final-witness**: source `1a82eb89bde94c542dc154f44676223945b7bda5`,9arquivos. #488 e follow-upS10,17+20controles novos/atualizados,19Planner+16mixed+11Dashboard, AM01portfolio/reeval/purchase/dependencies. Prazo/lease originais; Actions pendente.
- **Fila Native-original-intent-recovery**: source `c493bad6e5f68253bfa665160727f26a7f87049f`,2arquivos, bloqueada pela revisão final do frontend; atualizar source depois dos dois fixes concretos. #491 usa somente original UUID/seletores, reautoriza pelo produtor real e não reenvia apply.
- Máximo2workflows simultâneos incluindo cleanup; nenhuma repetição idêntica.

### Unions de produção preservadas

- business-services `14512133f127a4c1d4389f91c618a797f79631d9`: #403/#436/#441/#434/#464/#471/#472 +readerIdentity#481 +fase#488. Cada união conferida por reversão byte a byte.
- result-store `960ec20e78fb6a52e07cecebd2c6b12ce8c5393e`: #414+#438; verification `e47f875afd403b77703746fc5a70b4e490b6efd9`: #405+#445.
- analysis-http `eba00a3718bc9ee68dc393d6d9eea30d27d175d9`: #439+caseInput estrito já mergeados.
- host-context CLI `0e99a7f796c504a26f07345c78f46307aa233b6c` e produto `f4c1430b0bad4564116d496f9395272e9f475a12`: #446+#449+#491.
- owner `e3773a07ac58da3f4e8f7dc1c96a713eb663ec49`: #448+#461+#491.

### Ordem registrada anteriormente

1. Coletar os workflows ativos por GitHub Actions, incluindo cleanup. Registrar sumário/log e falhas file:line; nada de rerun idêntico.
2. Completar causas readonly AM01/ancestry e UI recovery/Dashboard; publicar fora de test/** somente em PR shared: separado, com controles. Gate apenas após fix concreto, máximo2. Falha idêntica duas vezes sem mudança vira unbound, não novo rerun.
3. Merge de dependências qualificadas: #403→#436/#441→#464→#471→#472→#488; #441→#455; #420→#424; #414; #405/#445; #446→#487 e #449/#452→#480→UI recovery#491; #448/#461; novos AM01/ancestry#481; CF13 com provas. #433/#435/#442/#434/#466/#439/#468 já mergeados. #438 foi mergeado externamente em`676584ba114e34da0a5ec523caa230746716591e` às04:09:27UTC e já pertence ao target; não repetir seu merge. Retarget após o pai, true merges e verificação dos blobs; nenhum rebase.
4. Executar os três inventários completos originais da base, no máximo dois simultâneos, sobre a mesma árvore composta final. Não somar passes de gates focados. Corrigir todas as falhas, inclusive os14arquivos do shard5 não iniciados no baseline.
5. Atualizar este documento com resultados finais e evidências; integrar #410, conferir árvore efetivamente mergeada e publicar a tabela final shard | run | N pass / M fail | falhas(file:line) | SHA do fix. Até lá o estado é IN_PROGRESS.


## Histórico da enumeração e das primeiras fatias

O restante conserva a enumeração original e as decisões daquela etapa. Frases como “nenhum merge”, “não há gate ativo”, “não integrado” e “pendente” nesta parte descrevem exclusivamente aquele momento; o estado corrente e a retomada estão acima.

## Por shard

| Shard | Run | SHA testado | N pass / M fail | Estado |
| --- | --- | --- | --- | --- |
| 4 | [44645900692](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645900692) | `dd45d888617943df40e02815d58b59f88d8a18f7` | **497 pass / 14 fail** | 511 testes, todos os 118 arquivos; Omni PASS, 428 spawns |
| 5 | [44645913808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645913808) | `f0bccdc48b42a9d000f3bda6565fa3d88286c845` | **≥576 pass / ≥21 fail observados, sem sumário final** | job cancelado no limite de 45 minutos; 105 de 119 arquivos iniciados |
| 6 | [44651628624](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44651628624) | `204a74491764dcde4da22ebe558efc318e04a777` | **409 pass / 23 fail / 2 skip** | 434 testes, 109 arquivos, 7243 asserções, 2226,61 s; Omni declared PASS, 18 declarados / 824 spawns |

No shard 5 há 576 marcadores pass (um concatenado ao final de uma linha Received de HTML), 20 marcadores fail e uma asserção adicional visível em `work-bridge.test.ts:386`, cujo marcador fail não consta depois da linha longa. Há um skip Windows/DACL pré-existente em Linux. Esses números são limites observados, não uma reconstrução do sumário ausente. A checagem Omni final não chegou a executar.

## Falhas do shard 4

Caminhos abaixo relativos a `modules/sucafina/Sucafinav1/test/product/`. A tabela registra a enumeração na base. Commits e gates posteriores estão nas seções abaixo; nenhum recorte qualifica o shard inteiro.

| File:line | Casos | Observação | Classificação / encaminhamento |
| --- | ---: | --- | --- |
| wp13/handoff-persistence.test.ts:95 | 1 | `ok` → `stale` | fixture-request-identity — novo Request em cada lookup (:58), incompatível com case-port.ts:84,107; C08 |
| wp13/coverage-sensitivity-integration.test.ts:115 | 1 | mutação de input aceita (`false` → `true`) | shared-security-input-mutation — `product/portfolio/verification.ts:203-205`; S10, PR #405 |
| wp13/handoff-domain-integration.test.ts:392 | 1 | preparação canônica indisponível | fixture sem `confirmed: false` (:391); correção publicada; ver fatias |
| wp13/handoff-c08-predispatch.test.ts:242 | 1 | replay retorna `conflict`, esperado `ok` | fixture-original-intent — substitui a versão do case em replay; produtor exige request original; C07 |
| wp13/handoff-canonical-integration.test.ts:176 | 1 | replay retorna `conflict`, esperado `ok` | fixture-original-intent — substitui a versão do case em replay; produtor exige request original; C07 |
| proof234/am04-c12-return.test.ts:78 → c12-receipt-recovery/consumer.ts:81 | 1 | leitura de receipts negada após revogação | fixture observa como Alice revogada; C02 — observação por Bob já autorizado publicada |
| wp12/native-execution-reevaluation.test.ts → wp12/native-portfolio-preparation.ts:150 | 1 | esperado total null, recebido 240000 | fixture confunde fonte sem operações com hipótese; C04 — correção publicada nos helpers de preparação |
| wp12/native-execution-purchase.test.ts → wp12/native-procurement-preparation.ts:193 | 2 | pending/complete: esperado total null, recebido 240000 | mesma causa de classificação da fonte; preservar null em hipóteses e cobertura incompleta |
| wp07/browser-ui.test.ts:242 | 1 | inscrição redireciona a `/`, ausente na fixture isolada | C03 — correção do cliente de inscrição publicada; componente existente permanece |
| ui-split/ui-source/draft-replay.test.ts:32 | 1 | replay exato após avanço legítimo: 403, esperado 200 | shared-draft-replay — `product/decisions/hot-topic-draft.ts:94-101,206-207`; S11, PR #406 |
| ui-split/ui-work/guards.test.ts:23 | 1 | exit 1 após 90011 ms | unbound — orçamento do subprocesso :19; somente WARN, nenhum finding de gate observado |
| integrated-proofs/am01/portfolio-recall-proof.test.ts:19 | 1 | timeout 240000 ms; 579798,97 ms observados | unbound — lifecycle do host; catálogo instalado vazio, sem inferência; limite :148 |
| integrated-proofs/am01/recall-five-profiles.test.ts:31 | 1 | SF_PRODUCT_AUTHORITY_CONFIG_INVALID | fixture duplica operações na linha 28; deduplicação publicada; C01 |

## Falhas observadas do shard 5

Mesmo prefixo de caminhos. Falhas observadas classificadas; nenhum resultado dos arquivos não iniciados é presumido.

| File:line | Casos | Observação | Classificação / encaminhamento |
| --- | ---: | --- | --- |
| installed-bi-closure/sensitivity-history.test.ts:19,66 | 3 | deadlines cooperativos de 165000 ms | unbound — desempenho/lifecycle; sem aumentar limite por palpite |
| similarity217/installed.test.ts:53,99,137 | 3 | `ok` → `unavailable` | shared-canonical-recall-availability — positivos C09+Atlas indisponíveis; reason interno não exposto pelo assert |
| wp12/native-execution-bi.test.ts:85 | 2 | predicado esperado true, recebido false | fixture-native-source-link — URL e label nativos exatos; mesma causa de work-bridge; C06 |
| wp11/source-promotion-coverage.test.ts:182 | 1 | ordem de evaluatedSourceRefs diverge | fixture-source-first-evidence-order — comparar exatamente com avaliação humana já validada; C05 |
| wp01/planner-monthly.test.ts:44 | 1 | inscrição seguida de navegação a console retirado | contrato de UI legado — usa `?page=OPEX`; não restaurar console |
| wp00/contract-freeze.test.ts:19 | 1 | hash de `product/contracts/decisions.ts` diverge | contract-freeze-drift — não atualizar hash somente para verde |
| wp10/integration/portfolio-promotion.test.ts:227 → :43 | 1 | deadline cooperativo de 285000 ms | unbound — desempenho/lifecycle |
| wp10/integration/review-portfolio-http.test.ts:271 | 1 | `denied` → `unavailable` | shared-grouped-revocation-status — C08 externo ok, leitura interna unavailable em vez de denied; sem evidência de divulgação |
| wp10/integration/review-access-browser-fixture.ts:29 | 1 | WP10_REVIEW_BROWSER_TRANSPORT_DEADLINE | unbound — deadline de transporte da fixture |
| wp10/integration/bi-lifecycle.test.ts:202 | 4 | inscrição redireciona a `/` não servida | contrato de shell legado; quatro casos de lifecycle, sem restaurar console |
| wp10/integration/portfolio-exact-threshold.test.ts:43 → :213 | 1 | denied/criterion-result-access-unavailable | shared-durable-sensitivity-access — verifySensitivity false / bind denied; dentro do orçamento, não timeout |
| wp10/integration/planner-calculation.test.ts:615 | 1 | 0 resoluções observadas, esperado 1 | fixture-instrumentation-copy — contador intercepta cópia retornada; Atlas usa objeto original (business-services.ts:540,726); preservar esperado 1 |
| wp10/integration/work-bridge.test.ts:386 | ≥1 erro de asserção adicional | HTML não contém `page=All+Projects`; marcador fail ausente após linha longa | fixture-native-source-link — mesma causa dos dois casos BI; C06 |

O cancelamento ocorreu durante `wp10/integration/planner-calculation.test.ts:684`, na chamada de recall em `:694`. Os dez casos seguintes não foram alcançados: `:718` (fonte persistida alterada), `:738` (oito variantes: source, membership, capture, coverage, selector, clock, principal, lease) e `:810` (isolamento lexical com cálculo paralelo). A cauda desse arquivo e os 14 arquivos abaixo ficam **unbound — não enumerados por limite do job**:

- `Sucafinav1/test/product/integrated-proofs/am06/correlate.test.ts`
- `Sucafinav1/test/product/review-fixes/finance-resume-performance/historical-batch.test.ts`
- `Sucafinav1/test/product/ui-split/ui-recovery/recovery.test.ts`
- `Sucafinav1/test/product/wp06/documents/dossier-runtime.test.ts`
- `Sucafinav1/test/product/wp06/imports/atomic-rejection.test.ts`
- `Sucafinav1/test/product/wp06/imports/dashboard-runtime.test.ts`
- `Sucafinav1/test/product/wp06/imports/dashboard-unchanged.test.ts`
- `Sucafinav1/test/product/wp06/imports/dashboard.test.ts`
- `Sucafinav1/test/product/wp06/imports/financial-impact.test.ts`
- `Sucafinav1/test/product/wp06/imports/receipt.test.ts`
- `Sucafinav1/test/product/wp06/imports/source-fences.test.ts`
- `Sucafinav1/test/product/wp10/analysis-composition/decision-controls.test.ts`
- `Sucafinav1/test/product/wp10/analysis-composition/decision-domain.test.ts`
- `Sucafinav1/test/product/wp10/atlas-business/case-event-continuity.test.ts`

## Feito e justificativas

1. Branch de trabalho criada exatamente na base; nenhuma outra branch de trabalho foi rebaseada.
2. Lidos AGENTS.md, contrato do runner, manifesto e seletor canônico. Nenhum shell ou teste local utilizado.
3. Inventário: 924 arquivos, menos 40 do harness ordenado e 1 release-only = 883 elegíveis. Partição e requests conferidos independentemente; shards 4/5/6 têm 118/119/109 arquivos. Nenhum arquivo foi removido.
4. O pedido literal fornecido não é admitido pelo runner da base:
   - `.github/workflows/test-ci.yml:30-37`: exige branch `ci-run-linux-*`.
   - `script/test-ci-request.ts:96-98`: exige `args`.
   - `script/test-ci-request.ts:12-15,133-140` e workflow `:144-159`: não permitem env `SF_*`.
   - `script/test-ci-package.ts:21-35`: resolve alias `sucafina`, não `modules/sucafina`.
5. Usados `package: sucafina`, `directory: modules/sucafina`, `runner: bun`, `args: [--timeout, 30000, ...todos os caminhos exatos do shard]`, env Omni=1. Branches de enumeração: `ci-run-linux-sfb-4r1`, `ci-run-linux-sfb-5r1`, `ci-run-linux-sfb-6`.
6. `runtime/application.ts:76-81,91-95,382` foi somente lido. HTML legado continua descomissionado. Nenhuma navegação de browser a :4110.
7. Quinze causas de fixture foram corrigidas em dezesseis commits, com um draft de testes (#410) e dois PRs shared (#405/#406). Gates somente após fix concreto; falhas reais de produtor não foram convertidas em expectativas de erro.

## Incidentes de admissão — zero testes de produto

- Runs 44645786965 e 44645800154 foram disparados na criação das branches no SHA base antes de existir `.ci-run.json`; falharam com ENOENT no passo Read request.
- Runs 44645789826 e 44645801987 receberam os arquivos exatos, mas falharam com `TEST_PACKAGE_NOT_FOUND:modules/sucafina` em `script/test-ci-package.ts:35`.
- As quatro execuções terminaram sem executar testes. Elas não são contadas como falhas de produto.
- Houve sobreposição transitória desses runs de admissão acima do limite de dois; não se declara cumprimento retroativo desse limite.
- Correção de publicação: criar árvore e commit completos via Git Data API ANTES de criar a ref `ci-run-linux-*`. Cada novo pedido passa a disparar somente um workflow. Pedidos seguintes usam o alias registrado e no máximo duas execuções ativas.
- As duas execuções involuntárias no SHA base repetiram o mesmo bloqueio de admissão ENOENT e ficam classificadas como `unbound`, sem testes de produto. Após corrigir a publicação e o alias de pacote, não houve repetição de pedido idêntico sem mudança.

## Limite da evidência

Os requests selecionam todos os arquivos canônicos de cada shard para verificação no Actions; o shard 5 foi interrompido e os shards 4 e 6 concluíram. O `test-ci` não produz o recibo completo de `sf-ci`, não executa sua verificação de cobertura e usa Omni no escopo `declared` para seleções explícitas. Não há alegação de baseline, coverage, digest de execução ou GO. Os hashes de seleção são cálculos de inventário, não recibos.


## Falhas do shard 6

Caminhos relativos a modules/sucafina/Sucafinav1/test/product/. Soma: 23 casos, sem contar novamente a lista repetida do sumário.

| File:line | Casos | Evidência | Classificação / encaminhamento |
| --- | ---: | --- | --- |
| dashboard-installed-closure/consumer-read.test.ts:64,179 | 2 | Inscrição antes de Hot Topics/summary | Migração de UI instalada; não restaurar console |
| wp13/semantic-union-source-scenario.test.ts:50 | 1 | stale/portfolio-selection-changed após 180034 ms; deadline 180000 ms | unbound — desempenho, 10404 leituras de cases / 126564 revalidações |
| wp04/capabilities.test.ts:88 | 1 | unavailable/requisition-unavailable | C15 — CAS canônico requests:PR-1 ausente |
| wp04/ui-sourcing-analysis.test.ts:98 | 1 | 503 esperado, undefined recebido | Migração/integração; interface/http.ts:26,30 não admite workbench-sourcing-input |
| wp12/native-question-consumer.test.ts:149 | 1 | answer-reuse-unavailable; Planner com 17 campos | Dependência shared existente #400; ainda sem gate deste teste nesse head |
| wp12/native-verifier-negatives.test.ts:147 | 1 | invalid-forecast-input após false-monthly-total | C14 — seleção HTTP com caseRef passada ao Forecast canônico |
| wp12/native-execution-documents-contract.test.ts:21 → native-procurement-preparation.ts:193 | 1 | null esperado, 240000 recebido | C04 — fonte sem operações vs hipótese |
| wp01/http.test.ts:56 | 1 | workbench legado 404, esperado 200 | Migração de UI; não restaurar contrato retirado |
| wp01/import-receipt-browser.test.ts:26 | 1 | File encontra upload e checkbox | C13 — locator exato |
| wp01/alternative-contribution.test.ts:46 | 2 | Subtotal null/0; corpo de proposta ausente | Migração/apresentação; contribution-body.ts default vazio:53; payload/envelope passaram:37–42 |
| wp01/personal-views.test.ts:82 | 1 | Inscrição antes de ?page=OPEX | Migração de UI; :83–90 usa densidade e global legados |
| wp10/integration/calculation-ancestry-composition.test.ts:26 → composition-test-deadline.ts:5 | 1 | Deadline 105000 ms em produce-outer | unbound — desempenho; 573 leituras, 102548 ms na fase |
| wp10/integration/bi-case-access.test.ts:136 → bi-access-browser-fixture.ts:198 | 1 | Espera botão singular Abrir origem | C16 — opções reais de múltiplas origens; distinto de C06 |
| wp10/native-host/native-host-disposal.test.ts:38 | 7 | SessionSubagentModels ausente nos 7 modos | C12 — composição do host de teste |
| wp06/native/import-analysis.test.ts:156 → :326 | 1 | Contribuição persistida sem preview link renderizado | Migração do consumidor; persistência/importPreviewRef/mensagem passaram:148–155; não fabricarURL |

## Fatias de teste publicadas

Locais abaixo referem-se à causa na base, salvo indicação explícita. Revisão de fonte não substitui Actions.

| Causa | SHA do fix | Arquivo:linha e decisão | Gate |
| --- | --- | --- | --- |
| C01 | 122e311c4950e8846cb221ad554fd53d3d9b41de | integrated-proofs/am01/recall-five-profiles.test.ts:28 — Set da união completa de operações; remove somente duplicatas | [44656693207](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656693207) — sem sumário final; cancelled |
| C02 | 6e5dd957823b937665b91ba0020246d3bca7770d | proof234/am04-c12-return.test.ts:78 — recuperação Alice permanece negada; Bob já autorizado observa e compara o estado completo | [44663503882](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663503882) — 1 pass / 0 fail; success |
| C03 | d61fe54b772e244c194789f43f94429026bc1906 | wp07/browser-ui.test.ts:242 — inscrição real sem seguir redirect; afirma 303/Location /, abre componente isolado existente | [44663570903](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663570903) — 0 pass / 1 fail; failure |
| C04 | dda42a61a089094f6560363449fdc734ad0566de | wp12/native-portfolio-preparation.ts:139–153; native-procurement-preparation.ts:190–199 — baseline conhecido exato 240000 e cobertura completa; hipóteses/null preservados | [44660393378](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660393378) — 1 pass / 3 fail + 1 erro(s); failure |
| C05 | 4bcbffc7160c3f0a47c98155c4e40d139cc8b433 | wp11/source-promotion-coverage.test.ts:182 — igualdade exata com ordem de fontes da avaliação humana já validada | [44663715036](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663715036) — 7 pass / 0 fail; success |
| C06 | 6248b54d66f1d35b996c1c3e10c2836bf11b3c37 | wp12/native-execution-bi.test.ts:85; wp10/integration/work-bridge.test.ts:386 — URL e label nativos completos com fonte, versão, período e ano | [44662186554](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662186554) — 3 pass / 0 fail; success |
| C07 | e062c6f06142d223c5b8dfd59bd181d9ec5a3b16 + extensão 8d84b40e83b0d3c5e7466ffc2fd64da8d0396f3e | wp13/handoff-c08-predispatch.test.ts:242; handoff-canonical-integration.test.ts:162,176 — versão alterada conflita; replay da request original devolve recibo completo idêntico; extensão handoff-persistence.test.ts:170 | [44663862857](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663862857) — 3 pass / 0 fail; success |
| C08 | b91d281808c5428e0e0643bc49fd9400cad5ddbc | wp13/handoff-persistence.test.ts:58; handoff-domain-integration.test.ts:358 — mesma Request admitida durante a operação; gate persistence, domain coberto por C09 | [44656700681](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656700681) — 0 pass / 1 fail; failure |
| C09 | 0e5a457f4d3728a149016b972eee88b2afcdf861 | wp13/handoff-domain-integration.test.ts:391 — intenção de rascunho confirmed:false; não é aprovação | [44662583356](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662583356) — 0 pass / 1 fail; failure |
| C12 | afb087bb3028f7f6ab3706e50da6bbed5ddb459d | wp10/native-host/native-host-disposal.test.ts:19,57 — SessionSubagentModels real importado e exportado pelo root | [44664197903](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44664197903) — 7 pass / 0 fail; success |
| C13 | 94763c9deec5898cdf5b20b2dfadc5858de4919e | wp01/import-receipt-browser.test.ts:26 — File com exact:true, sem modificar o resultado/contagem da importação | [44664193801](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44664193801) — 1 pass / 0 fail; success |
| C14 | 489f6d09cf96ca7348aa362c81635ee1713f05ed | wp12/native-verifier-negatives.test.ts:106,146,165,202 — projeção dos quatro campos canônicos; preserva caseRef no HTTP e todas as provas adversariais | [44662785880](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662785880) — 1 pass / 0 fail; success |
| C15 | 0e4541a5defc2f35385a45d50d9a4c9eb8a070aa | wp04/capabilities.test.ts:39 — CAS requests:PR-1 versão0, independente da revisão4 do wrapper legado | [44664473159](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44664473159) — 3 pass / 0 fail; success |
| C16 | 4dff91a6503aa4ee6800e98030bde1c38114118b | wp10/integration/bi-access-browser-fixture.ts:195 — controle atual de múltiplas origens + vínculo refDigest64hex; preserva200 retido/403/limpeza/resposta tardia | [44663094821](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663094821) — 1 pass / 0 fail; success |
| C17 | e55478bd29cd03d604116b855d45e3664270ba4e | wp13/handoff-persistence.test.ts:147 (gate C08) — perda explícita após receipt real; indisponibilidade antes da reserva; execução única, recibos completos e CAS5/5 | [44663862857](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663862857) — 3 pass / 0 fail; success |

### Justificativas e limites

- C01 mantém a união completa de operações. C02 mantém a revogação de Alice e a negativa da recuperação; Bob já autorizado observa o mesmo estado completo.
- C03/C13 exercitam componentes/HTTP isolados existentes, não uma jornada instalada. Nenhuma rota de produção foi recriada.
- C04: planner/scenario-port.ts:107–129, wp03/source-scenario.test.ts:32–81 e wp13/source-scenario.test.ts:36–38 distinguem observação sem operações de hipótese. Total 240000 exige cobertura completa; hipóteses e cobertura ausente mantêm null/conditioned. Fontes e digests permanecem.
- C05: decisions/cost-coverage.ts:99–121 preserva a ordem da evidência humana, integrante do digest. Comparação exata, sem sort/contains.
- C06: apps/cli/src/sucafina-product/extended-source-links.ts:61–62,76–78,94 define rota e label. BI passa de predicado parcial para igualdade completa; work-bridge exige anchor completo.
- C07: c12-recovery-closure/original-intent.test.ts:60–68 exige conflito para versão alterada e recibo idêntico para request original.
- C08: case-port.ts:84,107 exige identidade estável. Gate ultrapassou :95 e expôs :147, esperado case-reconciliation-pending, recebido recibo ok. Novo ponto corrigido por C17 e aprovado no gate conjunto com C07: 44663862857, 3 pass / 0 fail. O resultado C08 original permanece no histórico.
- C09: procurement-decision-producer/preparation.test.ts:55–74 exige intenção de rascunho explícita. confirmed:false não significa aprovação.
- C12: packages/core/src/session/subagent-models.ts:250 fornece o serviço real; package.json:397 exporta o módulo; AppNodeBuilder:24–33 fornece ao mapa de Locations os serviços exportados pelo root. Mesmas provas de grants, leases, tickets e interrupções nos 7 modos.
- C14: contracts/operations.ts:29–34,1167–1175 aceita somente baseRef/candidateRef/period/currency. caseRef HTTP, ataques, digests e provas de preservação continuam.
- C15: procurement/decision-preparation.ts:89–90 e prepared.ts:103–107 exigem CAS independente. Os probes collateral/settings de capabilities.test.ts:71,77 já omitiam confirmed:false e podem negar antes da razão nominal; este fix não amplia sua evidência.
- C16: analytics/source-navigation.ts:10–14,22–30 conserva todas as fontes e oferece rótulos A/B com digest verdadeiro. Permanecem200 autorizado retido,403 após revogação, ausência de dados privados e descarte do 200 tardio.

- C17: decisions/apply.ts:72–104 persiste a tentativa antes do dispatch e nega redispatch sem recibo; :125–158 já reconcilia o avanço normal do namespace. A fixture injeta perda da resposta somente após executePrepared real retornar ok, seguindo wp11/execution-reconciliation.test.ts:67–75. Indisponibilidade temporária do segundo producer ocorre antes da reserva. Exige os dois recibos reais completos, uma execução por domínio, valores 40/60 e CAS 5/5. Igualdades de receipts brutos usam state.read; cases.read continua nas provas da view. Revisão cruzada PASS e comportamento aprovado por Actions no gate conjunto C07+C17 (44663862857, 3 pass / 0 fail). A evidência continua limitada ao snapshot registrado; não cobre o rollback pré-commit de C09.

## Gates de correção

| Causa | Run | SHA do request | Resultado |
| --- | --- | --- | --- |
| C01 | [44656693207](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656693207) | a0010a3b9f37d0e762cf4bd3a043ea6d9a4eb773 | sem sumário final; cancelled |
| C08 | [44656700681](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656700681) | 9a699a80ee693cb257abe147d707ad073426143a | 0 pass / 1 fail; failure |
| S10 | [44657814166](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44657814166) | 1642f3229d99624550da44cedfc8df52848e537b | 9 pass / 2 fail; failure |
| C04 | [44660393378](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660393378) | be8321dfa6fb969650264c7282bc759940a0320c | 1 pass / 3 fail + 1 erro(s); failure |
| C06 | [44662186554](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662186554) | 2c3b227d23205cfd82ea42181e4cc2942acdaf33 | 3 pass / 0 fail; 10 filtrados; success |
| C09 | [44662583356](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662583356) | 54b955411b4bea65cfc246500b5f001f521e5c27 | 0 pass / 1 fail; failure |
| C14 | [44662785880](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662785880) | d9b371c6601f4d9c5cb3ea8649fa5da13be300f2 | 1 pass / 0 fail; success |
| C16 | [44663094821](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663094821) | aadfc91f667fdb42477499cc044d8e6c9fb5889c | 1 pass / 0 fail; success |
| C02 | [44663503882](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663503882) | 4ceb855f78c465e7e56fdc351f77d0d115133c45 | 1 pass / 0 fail; success |
| C03 | [44663570903](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663570903) | 53a48cafae8f16b16e99d01d753ef6ac733a698c | 0 pass / 1 fail; failure |
| C05 | [44663715036](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663715036) | a4980fbbe4e2bf7eae1f6636073ff32d791ab219 | 7 pass / 0 fail; success |
| C07-C17 | [44663862857](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663862857) | 479cf1947411cd16a117415bea34a914075596c0 | 3 pass / 0 fail; success |
| S11 | [44663906249](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663906249) | 3530f1eb5c560cef225b3f4937937d817f4e367e | 9 pass / 0 fail; success |
| C13 | [44664193801](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44664193801) | f2f92375bafaa0c27dc45826a03d2ba0b995da5b | 1 pass / 0 fail; success |
| C12 | [44664197903](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44664197903) | 4ab7cb5700c7d6b180c4ffd0b7e0f3106f1e37d2 | 7 pass / 0 fail; success |
| C15 | [44664473159](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44664473159) | 87320a6e2fdc0b237a41287f0f56485e23320611 | 3 pass / 0 fail; success |

Auditoria final dos 16 gates: todos concluídos, 10 success / 5 failure / 1 cancelled, sem gates ativos; cada run tem attempt=1, workflow .github/workflows/test-ci.yml e head_sha igual ao request registrado. Cada commit de request tem exatamente um pai, o SHA do fix associado, e modifica somente .ci-run.json. A ancestralidade de C07 original/extensão em C17 foi confirmada. Os intervalos created_at→updated_at confirmam máximo de dois workflows simultâneos nesses 16 gates, incluindo encerramento/cleanup. Essa conclusão não apaga os incidentes iniciais de admissão registrados acima.

C07+C17 compartilham um único gate de três arquivos porque a fixture persistence precisa das duas correções e C07 ainda não tinha gate. C04 agrupa os consumidores dos shards 4 e 6. C06 agrupa os dois arquivos do shard 5. Não converter a passagem de um recorte em passagem do shard inteiro.

### Falhas dos gates e evolução

- **C01 — [44656693207](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656693207):** Job cancelado no limite de 45 minutos, sem sumário Bun, sem marcadores pass/fail e sem checagem Omni final. Portanto N pass / M fail indisponível (0/0 marcadores não significa aprovação). Local: integrated-proofs/am01/recall-five-profiles.test.ts:24, entrada do teste; nenhum throw/asserção falha foi emitido. A configuração avançou além do antigo CONFIG_INVALID: catálogo inicial vazio, preparação canônica e negativos foram observados para finance, procurement, portfolio e maestro. Os marcadores de disponibilidade registram inferenceExecuted:false, outputRef:null, consumerRef:null e gnativeAccepted:false. Último checkpoint: sf_maestro em :98, às 02:33:30 UTC. sf_reviewer e a reabertura :132 não foram comprovados. O fonte define 900000 ms em :166, mas nenhum timeout Bun foi emitido; não atribuir o cancelamento a esse limite. Classificação: unbound — execução/desempenho ou lifecycle sem raiz interna demonstrada. Nenhum rerun.
- **C08 — [44656700681](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656700681):** 0 pass / 1 fail em wp13/handoff-persistence.test.ts:147. A identidade estável ultrapassou a falha inicial :95; o novo ponto esperava reconciliação pendente onde o produtor atual reconcilia normalmente. C17 substitui esse pressuposto por perda explícita da resposta após receipt real. O resultado histórico não é apagado; a nova fixture foi aprovada no gate C07+C17 (44663862857, 3 pass / 0 fail nos três arquivos). Omni não aplicável, zero spawns.
- **S10 — [44657814166](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44657814166):** 9 pass / 2 fail, 260 asserções, 11 testes/2 arquivos, 1143,59 s. Falhas em wp13/coverage-sensitivity-integration.test.ts:22 (timeout 300000 ms, duração reportada 395894,04 ms) e :141–142 → wp11/fixture-trace.ts:15 (bootstrap-start, deadline 180000 ms, trace 290514 ms). Classificação: unbound — desempenho/deadlines. O corpo confirmed continuou após o timeout e se sobrepôs ao bootstrap seguinte; a raiz interna não está demonstrada. omitted/bundled chegaram aos markers posteriores a :115, incluindo injeção de mutação, revogação e caso preservado; isso não aprova o teste fora do prazo. Cinco casos de integração e os quatro de sensitivity-read-scope passaram. Omni não aplicável, zero spawns. PR #405 permanece draft, sem qualificação de merge; nenhum limite ampliado.
- **C04 — [44660393378](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660393378):** 1 pass / 3 fail + 1 erro entre testes, 368 asserções, 1491,91 s. documents-contract.test.ts:15 passou (233854,25 ms). Os três fails são timeouts explícitos: native-execution-reevaluation.test.ts:24, limite 300000 ms em :152 (414910,63 ms reportados); native-execution-purchase.test.ts:14, variantes pending/complete, limite 360000 ms em :136 (417443,02 / 424437,39 ms). Houve um bloco adicional de erro em native-choice-preparation.ts:36 após pending: decision-choose/decision-authority-changed. Ambos purchase registram essa razão após cerca de 300 s desde a seleção e probes procurement-context-unavailable, mas somente um erro entre testes consta no sumário. Os checkpoints de preparação ultrapassaram as asserções corrigidas; a raiz interna da demora permanece unbound. Não renovar seleção, ampliar prazos ou remover guards para obter verde. Omni PASS focused/declared, 187 spawns e zero delegações.
- **C06 — [44662186554](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662186554):** PASS: 3 pass / 0 fail, 107,34 s, nos dois perfis native contextual BI (finance/maestro) e no caso C08 do anchor. Dez casos inalterados de work-bridge foram filtrados explicitamente; não é aprovação desse arquivo inteiro. URLs e labels completos passaram. Omni PASS no escopo focused/declared, 98 spawns e zero delegações; isso não afirma inferência nativa.
- **C09 — [44662583356](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662583356):** 0 pass / 1 fail, 45 asserções, 1191 ms. Novo ponto em wp13/handoff-domain-integration.test.ts:262: somente aggregateRevision muda de 10 para 11; receipts, proofs, incarnation e storageVersion=1 permanecem idênticos. A reserva em decisions/apply.ts:86–96 avança legitimamente o agregado antes da transação do domínio, cujo rollback ocorre no driver da fixture :327–337. A retomada esperada em :272–273 contradiz o guard conservador de apply.ts:72–75: tentativa sem recibo exige reconciliação, não redispatch. Classificação: pendência de contrato de recuperação pré-commit / envelope de estado da fixture. Não ignorar metadados nem liberar redispatch para verde; precisa desenhar evidência autoritativa de rollback/aborto em PR shared, se esse comportamento for requerido. Nenhum patch parcial ou gate exploratório. Omni não aplicável, zero spawns.
- **C14 — [44662785880](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662785880):** PASS: 1 pass / 0 fail, 9,46 s. O verifier executou os ataques preservados, o replay canônico e a reabertura do host sem alterar os digests/estado esperados. Omni PASS no recorte focused/declared, 57 spawns, zero delegações. A projeção remove caseRef somente da operação Forecast; a seleção HTTP e a autoridade do case permanecem.
- **C16 — [44663094821](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663094821):** PASS: 1 pass / 0 fail, 76,36 s. O componente usou controle real de origem com refDigest de 64 hex; o teste comprovou resposta 200 retida, segunda consulta 403 após revogação, ausência de projection/links, limpeza do DOM/opções e descarte do 200 tardio. Omni não aplicável, zero spawns. É prova do componente/HTTP pelo transporte Playwright declarado, sem qualificação de jornada nativa instalada.
- **C02 — [44663503882](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663503882):** PASS: 1 pass / 0 fail, 13,66 s. A recuperação por Alice revogada permanece negada; Bob, já autorizado, observa e compara o estado completo sem liberar autoridade adicional. Omni não aplicável, zero spawns.
- **C03 — [44663570903](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663570903):** 0 pass / 1 fail, 9,00 s, em wp07/browser-ui.test.ts:242 → playwright-core/lib/server/fetch.js:158. APIRequestContext recebe uma URL absoluta, mas _parseSetCookieHeader tenta interpretar a URL de resposta relativa e lança ERR_INVALID_URL sob Bun. Falha antes do status 303 e de todas as asserções do componente. O baseline já falhava ao seguir o redirect real para /, não montado no servidor isolado. Classificação: unbound — compatibilidade de transporte/Set-Cookie; causa interna não demonstrada. Não voltar à navegação antiga nem sintetizar cookies. Retomada: observar 303 autêntico no Chromium, distinguir explicitamente a landing 404 do fixture e então abrir o componente existente, com revisão própria. Omni não aplicável, zero spawns.
- **C05 — [44663715036](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663715036):** PASS: 7 pass / 0 fail, 728 ms. A ordem exata de evaluatedSourceRefs coincide com a avaliação humana já verificada, preservando digest, cobertura e as demais asserções do arquivo. Omni não aplicável, zero spawns.
- **C07-C17 — [44663862857](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663862857):** PASS: 3 pass / 0 fail em 3 arquivos, 858 ms. C07 exige conflito da intenção alterada e igualdade completa do replay original. C17 preserva perda explícita após o receipt real, recusa Procurement antes da reserva, reconciliação, uma execução por domínio, dois receipts completos e CAS 5/5. O arquivo persistence, que falhou no gate inicial C08, passou neste snapshot com C08+C07+C17. Omni não aplicável, zero spawns.
- **S11 — [44663906249](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663906249):** PASS: 9 pass / 0 fail em 3 arquivos, 1,82 s. Replay exato após avanço legítimo do case e regressões de fonte/escopo/autorização passaram. hot-topic-draft-domain é controle adicional do shard 3, sem qualificação desse shard. Omni não aplicável, zero spawns. PR #406 tem este gate focado aprovado; nenhuma composição com a base alvo posterior foi testada.
- **C13 — [44664193801](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44664193801):** PASS: 1 pass / 0 fail, 13,76 s. Locator File exato seleciona o upload; o componente recupera o receipt unchanged após resposta incerta e mantém applies=1. Omni não aplicável, zero spawns. Prova isolada do componente, sem aceitação de jornada instalada.
- **C12 — [44664197903](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44664197903):** PASS: 7 pass / 0 fail, 15,79 s. Passaram dispose, interrupt-failure, abort-attach, revoke-attach, throw-attach, throw-announcement e pending-interruption com SessionSubagentModels real no root. Asserções de sessões, grants, tickets, leases e liberação preservadas. Omni não aplicável, zero spawns; fixture de lifecycle com budget sintético declarado, sem prova de inferência nativa.
- **C15 — [44664473159](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44664473159):** PASS: 3 pass / 0 fail, 378 ms. A versão CAS explícita requests:PR-1=0 permitiu a preparação canônica e os demais testes do arquivo passaram. A revisão do wrapper de dados permanece 4 e independente. A limitação preexistente dos probes collateral/settings (confirmed:false ausente) continua registrada; não se atribui ao gate prova nova das suas razões nominais. Omni não aplicável, zero spawns.

### Seleções dos gates publicados

Caminhos relativos a modules/sucafina/; a árvore exata está no SHA do request.

| Causa | Arquivos |
| --- | --- |
| C01 | Sucafinav1/test/product/integrated-proofs/am01/recall-five-profiles.test.ts |
| C08 | Sucafinav1/test/product/wp13/handoff-persistence.test.ts |
| S10 | Sucafinav1/test/product/wp13/coverage-sensitivity-integration.test.ts; Sucafinav1/test/product/wp13/sensitivity-read-scope.test.ts |
| C04 | Sucafinav1/test/product/wp12/native-execution-reevaluation.test.ts; Sucafinav1/test/product/wp12/native-execution-purchase.test.ts; Sucafinav1/test/product/wp12/native-execution-documents-contract.test.ts |
| C06 | Sucafinav1/test/product/wp12/native-execution-bi.test.ts; Sucafinav1/test/product/wp10/integration/work-bridge.test.ts; seleção por nome descrita abaixo |
| C09 | Sucafinav1/test/product/wp13/handoff-domain-integration.test.ts |
| C14 | Sucafinav1/test/product/wp12/native-verifier-negatives.test.ts |
| C16 | Sucafinav1/test/product/wp10/integration/bi-case-access.test.ts |
| C02 | Sucafinav1/test/product/proof234/am04-c12-return.test.ts |
| C03 | Sucafinav1/test/product/wp07/browser-ui.test.ts |
| C05 | Sucafinav1/test/product/wp11/source-promotion-coverage.test.ts |
| C07-C17 | Sucafinav1/test/product/wp13/handoff-c08-predispatch.test.ts; Sucafinav1/test/product/wp13/handoff-canonical-integration.test.ts; Sucafinav1/test/product/wp13/handoff-persistence.test.ts |
| S11 | Sucafinav1/test/product/ui-split/ui-source/draft-replay.test.ts; Sucafinav1/test/product/wp11/hot-topic-draft-domain.test.ts; Sucafinav1/test/product/wp11/hot-topic-snapshot.test.ts |
| C13 | Sucafinav1/test/product/wp01/import-receipt-browser.test.ts |
| C12 | Sucafinav1/test/product/wp10/native-host/native-host-disposal.test.ts |
| C15 | Sucafinav1/test/product/wp04/capabilities.test.ts |

Filtro explícito de C06, passado depois de `-t`:

```text
^(native contextual BI \[|actual C08 work composition opens a current thread and survives rebuilding the host with the same durable key$)
```

Seleciona os dois casos BI (sf_finance e sf_maestro) e um caso C08 de work-bridge; dez outros casos de work-bridge ficam filtrados. Os demais gates selecionam todos os casos dos arquivos indicados.

## Produção compartilhada — PRs separados

| Causa | PR / branch | SHA do fix | Mudança e gate |
| --- | --- | --- | --- |
| S10 | [#405](https://github.com/gustavomhss/Orchestra-SF/pull/405), sf-shard-b-shared-sensitivity | 8da7b9c5c8600bad368b43432f6d71ed13317b4c | portfolio/verification.ts:203–205: sem sensitivityReadScope usa snapshots, token, captura provisória e fingerprints finais; gate coverage-sensitivity-integration + sensitivity-read-scope: **9 pass / 2 fail**, dois deadlines unbound; PR ainda sem qualificação de merge |
| S11 | [#406](https://github.com/gustavomhss/Orchestra-SF/pull/406), sf-shard-b-shared-draft-replay | 3190d29fa62e902f8ceefdffcf703eb367c9b2c9 | decisions/hot-topic-draft.ts:94–101,206–207: leitura na versão atual só para transação durável existente e versão não regredida; gate draft-replay + hot-topic-draft-domain + hot-topic-snapshot: **9 pass / 0 fail** no snapshot do fix |

Ambos drafts, título shared:, base sf-join-four, revisão independente PASS. Produção não foi incorporada em sf-shard-b. S10 preserva contexto original e caminho scoped. S11 mantém request original no digest, autorização e CAS; identidade/incarnação, escopo, fontes e integridade continuam verificados; novos comandos stale continuam negados.

S10: os deadlines se materializaram no gate 44657814166, em coverage-sensitivity-integration.test.ts:22 e :141–142 → fixture-trace.ts:15; ambos classificados unbound. Houve continuação assíncrona depois do primeiro timeout, sem demonstração da raiz interna. Nenhum limite foi ampliado. hot-topic-draft-domain pertence ao shard 3 e é regressão adicional, não sua enumeração/qualificação.

PRs alheios apenas inspecionados: [#398 Atlas](https://github.com/gustavomhss/Orchestra-SF/pull/398), [#400 resposta Planner](https://github.com/gustavomhss/Orchestra-SF/pull/400), [#401 custo BI](https://github.com/gustavomhss/Orchestra-SF/pull/401). Nenhum foi integrado, alterado ou rebaseado por esta sessão. #398 continua hipótese para similarity217 sem equivalência causal demonstrada no log. #400 corresponde à lacuna de escopo completo da resposta Planner em native-question-consumer:149 (17 campos no baseline). Foi mesclado externamente em 2026-11-20T02:12:31Z, merge 392cecab68288d4b669828adc5d1aaa738693d80, head 50ce9319b03ae52ec3871043161c19b17c49a1b3, e é ancestral do target d4ded812…. Ainda não há, nesta sessão, gate desse teste no candidato composto; não transferir green de outra sessão nem atribuir a revisão de um head anterior a esse head final.

## Pendente e como retomar

1. Não há gate ativo nem fix desta sessão aguardando seu gate. Os 16 resultados são finais para os snapshots registrados. Não repetir request idêntico nem disparar CI apenas para observar estado.
2. Próximas fatias devem começar com uma mudança concreta para uma causa classificada. Manter um gate por causa, agrupando arquivos com raiz comum, e no máximo dois workflows ativos até o fim do cleanup. Erro idêntico duas vezes sem mudança: parar e registrar unbound.
3. C01, C04 e S10: investigar os checkpoints/deadlines documentados e a continuação assíncrona. Os logs não provam uma raiz interna; não elevar prazos, renovar seleção ou reduzir guards por palpite. C03: corrigir o transporte de inscrição real preservando a observação de 303 e tratando a landing 404 da fixture; a URL passada ao APIRequestContext já é absoluta.
4. C09: decidir o contrato de recuperação pré-commit. A reserva anterior ao domínio altera aggregateRevision e impede redispatch sem receipt; se retry após rollback for requisito, desenhar evidência autoritativa de aborto em PR shared. Não ignorar metadados nem transformar essa falha em perda pós-commit. C17 prova outra situação e já passou.
5. Migrar os consumidores legados em trabalho próprio, preservando suas garantias sem restaurar #content, data-surface, details/summary ou form[data-command] como contrato. Os locais de UI, apresentação e navegação estão nas tabelas dos shards 5 e 6.
6. Contract-freeze exige decisão de contrato, sem trocar hash para verde. Corrigir a instrumentação de planner-calculation:112–123, que intercepta uma cópia retornada em business-services:726 enquanto Atlas usa o original em :540, preservando a expectativa de uma resolução. Tratar separadamente os contratos shared de revogação, acesso a sensibilidade e disponibilidade de recall.
7. O shard 5 conserva 14 arquivos não iniciados e a cauda Planner não enumerada, unbound pelo limite do job. Retomar essa enumeração somente dentro de uma próxima fatia com mudança concreta que trate a execução interrompida; nunca atribuir pass/fail a código não executado ou lançar gate exploratório.
8. Antes da integração, fixar o novo SHA alvo, verificar dependências e qualificar a composição modificada com recortes pertinentes. Os resultados desta sessão continuam vinculados à base f7dd58e… e aos SHAs de fix/request. Atualizar este handoff com novos runs, contagens e file:line, conservando o histórico.

## Integração e draft de testes

- Draft de testes: [#410](https://github.com/gustavomhss/Orchestra-SF/pull/410), head de código e55478bd29cd03d604116b855d45e3664270ba4e. Os commits seguintes desta branch apenas atualizam este handoff.
- Último target observado nesta auditoria: sf-join-four em **d4ded81224e05f2d3b9789b3eec40b9de8a32fa1**. Esta é uma observação pontual, não um lock do branch.
- O avanço f7dd58e… → 08854f14d83ab12d8665b0e3787881edbfaabd53 compreendeu 10 commits/14 caminhos, incluindo #399, #398, #404, #401 e #402. O [comparativo seguinte, 08854f14… → d4ded812…](https://github.com/gustavomhss/Orchestra-SF/compare/08854f14d83ab12d8665b0e3787881edbfaabd53...d4ded81224e05f2d3b9789b3eec40b9de8a32fa1), acrescenta 34 commits/84 arquivos, inclusive o merge externo de #400.
- Os dois comparativos não têm sobreposição de arquivos com os 17 testes/fixtures, o handoff ou os dois arquivos de produção dos nossos shared. Isso não substitui a verificação da composição e não declara mergeability do target futuro.
- **Mudança externa relevante para retomar:** script/sf-ci/gate.mjs agora usa planShards com custos históricos (LPT) em vez da partição por hash. Os números 4/5/6 deste handoff identificam os conjuntos fixos da base f7dd58e…, armazenados nos requests; não presumir que os mesmos índices no target atual contenham os mesmos arquivos. Recalcular e registrar o inventário do candidato antes de usar seus índices.
- O target também alterou externamente o teste de guards e a revisão do contract-freeze (#417). As falhas registradas nesta sessão continuam fatos do baseline f7dd58e…; não declará-las resolvidas nesse target sem evidência específica.
- Nenhuma mudança externa foi incorporada aos snapshots dos gates desta sessão. Todos os resultados continuam vinculados à base imutável e ao SHA de cada fix/request.

## Ordem de merge

Nenhum merge foi realizado por esta sessão. Primeiro qualificar/integrar **shared #405 e #406**, independentes entre si: #405 continua bloqueado pelos dois deadlines classificados; #406 tem gate focado 9/0 no snapshot registrado. Confirmar as dependências já integradas externamente, inclusive #400, no SHA alvo acordado e verificar a composição quando ela mudar. Depois integrar **sf-shard-b / #410**. Não rebasear branches alheias. A base atual usa outra distribuição de shards; preservar o vínculo entre inventário e SHA. UI legada, contratos pendentes e falhas unbound permanecem explícitos; não há GO.
