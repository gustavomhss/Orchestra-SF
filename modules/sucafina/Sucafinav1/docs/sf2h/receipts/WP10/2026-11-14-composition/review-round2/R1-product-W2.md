# R1 — Rechecagem independente de produto/UX — W2

**Veredito: changes-required.** SHA `b7a6b5d4b66acf172762aba72f01e424bf9c0b90`. UX01 permanece aberto; UX06 e UX07 são novos achados obrigatórios. UX02–UX05 possuem correção estática no caminho especificado, mas ainda precisam de evidência hospedada discriminante.

Data: 2026-11-14T03:04:46.035671+00:00.

## Identidade, lease e fontes

Reviewer `/root/review_product`; authors: `/root`, `/root/authority_builder`, `/root/composition_intake`, `/root/runtime_analysis`, `UI corrections builder identified by published ui-corrections-W2 manifest`, `published producer owners WP01–WP09 and WP11–WP14`. Reviewer e authors são disjuntos; R1 não escreveu correções.

Lease somente leitura aceito após builders CLOSED. Fonte exclusiva `/workspace/scratch/cca507855f4a/analysis/frozen-W2/repo`. Tree `4fba27f0de68963a0da60debb8ced17fe3abd1e8`, parent `a43883c930cf996472b27c524aadb4694c13b5a3`. Não li o repo mutável para julgar W2. Nenhuma execução local de produto/teste/build/typecheck/browser/native e nenhuma escrita remota.

Manifesto SHA256 `4a2e542c5ba300543a822f8ac45fd0d37e051339054b28ea84219493f9b29063` conferido. Os **841 blobs** coincidem por bytes, SHA256 e Git blob SHA, sem faltas ou divergências. Os 62 deltas do manifesto são relativos ao pai; os novos controles e bindings presentes no pai foram inspecionados nos bytes exatos de W2. A matriz canônica de 171 critérios e AGENTS permanecem iguais aos lidos em W1.

## Disposição dos achados

Reviewer `/root/review_product`; authors: `/root`, `/root/authority_builder`, `/root/composition_intake`, `/root/runtime_analysis`, `UI corrections builder identified by published ui-corrections-W2 manifest`, `published producer owners WP01–WP09 and WP11–WP14`. Reviewer e authors são disjuntos; R1 não escreveu correções.

| Achado | Severidade | Estado em W2 |
| --- | --- | --- |
| R1-UX-01 — A navegação para review e BI perde o período selecionado | P2 | **open** |
| R1-UX-02 — Review preservado não oferece atualização utilizável nem conserva o contexto do sucessor | P1 | **needs-hosted-evidence** |
| R1-UX-03 — Forecast legado prepara entrada sem o registro canônico exigido no start | P1 | **needs-hosted-evidence** |
| R1-UX-04 — O seletor de BI oferece oito visualizações sem caminho para escolher seus produtores | P1 | **needs-hosted-evidence** |
| R1-UX-05 — Saved views recusa filtros que o contrato e a própria página permitem salvar | P2 | **needs-hosted-evidence** |
| R1-UX-06 — Releitura dos controles de decisão apaga rascunho autorizado ao mudar o fingerprint | P2 | **open** |
| R1-UX-07 — Versões distintas aparecem com rótulos idênticos na escolha de fonte dos controles | P2 | **open** |

`needs-hosted-evidence` significa que o defeito estrutural original foi corrigido no caminho inspecionado, mas o resultado humano ainda não foi comprovado na execução correspondente. Não equivale a closed nem a PASS de critério.

### R1-UX-01 — open

Reviewer `/root/review_product`; authors: `/root`, `/root/authority_builder`, `/root/composition_intake`, `/root/runtime_analysis`, `UI corrections builder identified by published ui-corrections-W2 manifest`, `published producer owners WP01–WP09 and WP11–WP14`. Reviewer e authors são disjuntos; R1 não escreveu correções.

**Critérios:** WP10.T01.QLT.01, WP10.T01.CMP.01, WP10.T02.CMP.01, WP10.T02.QLT.01, CAMP.INV.03.

O novo Request local conserva year/start/end no caminho Budget/OPEX. A correção ainda ignora o ano próprio e o mês das páginas Executive Dashboard, IT Operations e IT Security KPIs, portanto o achado continua aberto.

**Evidência de W2:**

- [modules/sucafina/Sucafinav1/local/entry.ts:102–120](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/modules/sucafina/Sucafinav1/local/entry.ts#L102-L120): AsyncLocalStorage transporta o Request para a decoração privada, sem alterar o contrato público de Application. Blob `26a330c62a0e5e9f3e2ea79be0b6854e7dca7363`.
- [modules/sucafina/Sucafinav1/local/entry.ts:199–205](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/modules/sucafina/Sucafinav1/local/entry.ts#L199-L205): A chamada real do módulo ocorre no Request local. Blob `26a330c62a0e5e9f3e2ea79be0b6854e7dca7363`.
- [apps/cli/src/sucafina-product/extended-business-services.ts:68–75](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/extended-business-services.ts#L68-L75): O link extrai somente year/start/end; não observa execYear/opsYear/secYear/own/mês. Blob `20aab2eba811c4c9a3377dd050001c6f7ddc41bd`.
- [modules/sucafina/Sucafinav1/runtime/application.ts:353–375](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/modules/sucafina/Sucafinav1/runtime/application.ts#L353-L375): A página real usa ano próprio por página ou alias own, e parâmetros próprios de mês. Blob `4edac56f32a082a0944a88fe5f231bc5aa739690`.
- [modules/sucafina/Sucafinav1/src/dashboard-screen.ts:88–94](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/modules/sucafina/Sucafinav1/src/dashboard-screen.ts#L88-L94): Os controles reais escrevem execYear, opsYear ou secYear. Blob `82e0cf7ed2eb8544f3e14b9107f1559d71cf9241`.

**Risco/limite restante:**

- Cenário: abrir IT Operations com year=2026 e opsYear=2027; a página usa 2027, mas os links produzem start/end em 2026. A variante Budget corrigida não refuta esta contraprova.
- O mesmo padrão se aplica a execYear/secYear e aos aliases; mês selecionado não é transportado. Período ou granularidade não podem mudar sem explicação.

**Correção ou prova exigida:**

- Corrigir somente a composição WP10 para derivar o período efetivo da página e seu ambiente, com as mesmas chaves canônicas e sem fallback temporal divergente.
- Em novo freeze, verificar pelo handler/UI real ano global diferente do próprio, aliases, mês, ano bissexto e default do ambiente.
- Root aceitou o residual; correção anunciada no mutable não foi lida nem aceita como W2.

### R1-UX-02 — needs-hosted-evidence

Reviewer `/root/review_product`; authors: `/root`, `/root/authority_builder`, `/root/composition_intake`, `/root/runtime_analysis`, `UI corrections builder identified by published ui-corrections-W2 manifest`, `published producer owners WP01–WP09 and WP11–WP14`. Reviewer e authors são disjuntos; R1 não escreveu correções.

**Critérios:** WP10.T01.DOD.01, WP10.T01.SUC.01, WP10.T02.CHK.02, WP10.T02.CMP.01, WP10.T05.CHK.02, CAMP.INV.06.

No caminho Dashboard simples, checkUpdate passou a fazer leitura real; a URL conserva contexto, previousReviewRef é fornecido, o sucessor exige confirmação explícita do novo conjunto de registros e os hooks de fontes/seções foram ligados. A rechecagem estática sustenta a correção do bloqueio original, sem aceitar a jornada completa.

**Evidência de W2:**

- [apps/cli/src/sucafina-product/extended-browser.ts:10–15](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/extended-browser.ts#L10-L15): reviewUrl preserva page/start/end e atualiza somente identificadores de review/section. Blob `a657a717b31609c6040758237c4d5f0ca56baacf`.
- [apps/cli/src/sucafina-product/extended-browser.ts:37–78](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/extended-browser.ts#L37-L78): Check real, sucessor vinculado e confirmação humana de seleção atual/exclusão de tópicos não reconstruíveis. Blob `a657a717b31609c6040758237c4d5f0ca56baacf`.
- [apps/cli/src/sucafina-product/extended-http.ts:55–74](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/extended-http.ts#L55-L74): Update/source reabrem review autorizado; source prova associação ao review ou predecessor. Blob `a888757e024f0c156d308b22eaf1bf193c3c12c0`.
- [apps/cli/src/sucafina-product/extended-http.ts:123–141](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/extended-http.ts#L123-L141): Reabertura de seção e preparação por previousReviewRef são compostas no HTTP real. Blob `a888757e024f0c156d308b22eaf1bf193c3c12c0`.
- [apps/cli/src/sucafina-product/extended-review-cycle.ts:24–51](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/extended-review-cycle.ts#L24-L51): Conserva ordem, IDs, período e notas; compara versões correntes e declara seleções que não podem ser reconstruídas. Blob `d7d0272d40c3bd7236540117b4c2572b761dec0e`.
- [apps/cli/src/sucafina-product/review-history.ts:53–76](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/review-history.ts#L53-L76): Histórico simples requer snapshot/recibo preservado e escopo atual; não basta aceitar qualquer versão antiga. Blob `0c9a68225d114ba77617af4a0e3acc2607ea0e5a`.
- [apps/cli/src/sucafina-product/review-services.ts:45–51](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/review-services.ts#L45-L51): HistoricalSource agora está efetivamente ligado à autorização de review. Blob `acdd613efe98532e61812fd2fbfd78d6a5891ed3`.
- [packages/app-shell/e2e/sucafina/wp10/extended-flows.ts:58–130](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/packages/app-shell/e2e/sucafina/wp10/extended-flows.ts#L58-L130): Fonte da prova própria prevê edição OPEX real, reabertura estável, sucessora e seção; não foi executada/observada por R1. Blob `cca702559ac29b877935dec567148a510398b3b3`.

**Risco/limite restante:**

- R2 confirmou residual obrigatório R2-F03 em histórico Portfolio: a resolução do case histórico exige withCase que review-read não fornece. Não se declara todo C04 fechado.
- O contrato publicado WP07 não conserva ReviewAgendaItem/recordRefs originais. A UI explicitamente pede uma nova escolha e exclusão de tópicos não reconstruíveis; isso não é preservação automática da seleção original.
- Fontes alteradas que não podem ser revalidadas como frescas continuam indisponíveis para navegação; snapshot histórico e dado corrente são separados.

**Correção ou prova exigida:**

- No novo candidato, executar OPEX/IT Operations em período escolhido: preservar → editar origem → reabrir revisão antiga estável → confirmar registros atuais → preservar sucessora → comparar e abrir seção/fonte.
- Cobrir exclusão explícita de tópico não reconstruível e fonte revogada/removida/substituída.
- R2 deve reavaliar Portfolio após a correção própria; não usar a prova simples como substituto.

### R1-UX-03 — needs-hosted-evidence

Reviewer `/root/review_product`; authors: `/root`, `/root/authority_builder`, `/root/composition_intake`, `/root/runtime_analysis`, `UI corrections builder identified by published ui-corrections-W2 manifest`, `published producer owners WP01–WP09 and WP11–WP14`. Reviewer e authors são disjuntos; R1 não escreveu correções.

**Critérios:** WP10.T01.CHK.02, WP10.T01.DOD.01, WP10.T01.SUC.01, WP10.T02.CMP.01, WP10.T06.CHK.01, WP10.T06.SUC.01, WP10.T06.SUC.60.

forecastInputs exposto pelo host agora usa createSfForecastInputAdapter. O adapter valida o intento legado, reconstrói o mesmo profile/skill/request da UI e chama inputs.prepare sob admissão humana canônica; o produtor financeiro real é consumido pelo registry.

**Evidência de W2:**

- [apps/cli/src/sucafina-product/host-context.ts:803–812](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/host-context.ts#L803-L812): O serviço efetivo usa o novo adapter. Blob `d576b5dbf7e16c4c77043d39c3720e8b15d64612`.
- [apps/cli/src/sucafina-product/forecast-input-adapter.ts:16–40](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/forecast-input-adapter.ts#L16-L40): Valida chamada legada, caso/versão, perfil/skill; admite analysis.prepare e prepara/decode/revalida, encerrando o contexto. Blob `5a9024f1acf214ff4e472a3898e322b6bc3f7838`.
- [modules/sucafina/Sucafinav1/product/ui/forecast-analysis.ts:34–43](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/modules/sucafina/Sucafinav1/product/ui/forecast-analysis.ts#L34-L43): A UI usa o mesmo primeiro profile/skill instalado, objetivo e operation scope. Blob `973a2f09b394426364c514b923ecdc8e10ffb184`.
- [apps/cli/src/sucafina-product/analysis-services-inputs.ts:49–57](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/analysis-services-inputs.ts#L49-L57): O preparo canônico usa comparação real e decodifica ForecastExplainInput. Blob `7f4ccee85c4eeaec82d932a69ba93c5fe6d59eff`.
- [modules/sucafina/Sucafinav1/test/product/wp10/analysis-composition/selection-scope.test.ts:238–284](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/modules/sucafina/Sucafinav1/test/product/wp10/analysis-composition/selection-scope.test.ts#L238-L284): O teste novo declara fixture financeira vazia: prova intenção/seleção durável, não comparação financeira ou execução nativa. Blob `68de34032839221fe0909aedec8a7330102c2c43`.

**Risco/limite restante:**

- A fixture de regressão exercita a boundary de seleção com entrada financeira deliberadamente vazia; não demonstra start completo no HTTP legado com duas fontes reais.
- Não houve resultado unit/browser W2 nem execução SessionV2.skill recebido por R1.

**Correção ou prova exigida:**

- Executar workbench-forecast → workbench-analysis em caso novo, duas fontes autorizadas reais, modelo disponível e sem pré-popular seleção. Verificar seleção durável exata e start admitido.
- Alterar payload, fonte ou acesso entre prepare/start deve recusar.
- Manter prova nativa de sf_finance e consumo do resultado separada e reservada aos gates aplicáveis.

### R1-UX-04 — needs-hosted-evidence

Reviewer `/root/review_product`; authors: `/root`, `/root/authority_builder`, `/root/composition_intake`, `/root/runtime_analysis`, `UI corrections builder identified by published ui-corrections-W2 manifest`, `published producer owners WP01–WP09 and WP11–WP14`. Reviewer e authors são disjuntos; R1 não escreveu correções.

**Critérios:** WP10.T01.CHK.02, WP10.T01.DOD.01, WP10.T01.CMP.01, WP10.T01.SUC.01, WP10.T02.CMP.01, WP10.T05.CHK.02, CAMP.CMP.04.

A ausência estrutural de seleção foi corrigida: bi-options enumera escolhas reais autorizadas, a UI oferece versões base/candidata e as rotas aceitam seleção explícita. Ainda não há evidência hospedada da comparação com duas versões e dos consumidores de resultados.

**Evidência de W2:**

- [apps/cli/src/sucafina-product/extended-bi-options.ts:34–66](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/extended-bi-options.ts#L34-L66): Escolhas Dashboard/Planner/Procurement vêm de produtores autorizados, sem latest implícito. Blob `6747503690394edb2aeb2d7336e876c4653310e0`.
- [apps/cli/src/sucafina-product/extended-bi-options.ts:68–116](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/extended-bi-options.ts#L68-L116): Resultados armazenados são filtrados por caso/acesso, relações exatas e leitura de cada candidato em admissão própria. Blob `6747503690394edb2aeb2d7336e876c4653310e0`.
- [apps/cli/src/sucafina-product/extended-bi-browser.ts:19–79](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/extended-bi-browser.ts#L19-L79): Formulário oferece escolha, versões/moeda, recarga e envio explícito de selectionRef ou par de versões. Blob `3441c4c9698de12669d36b5fcccdf10b50eadf28`.
- [apps/cli/src/sucafina-product/extended-http.ts:96–120](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/extended-http.ts#L96-L120): Valida par de versões e seleção exclusiva; reautoriza caso e dispatch real. Blob `a888757e024f0c156d308b22eaf1bf193c3c12c0`.
- [packages/app-shell/e2e/sucafina/wp10/extended-flows.ts:9–55](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/packages/app-shell/e2e/sucafina/wp10/extended-flows.ts#L9-L55): Em W2 o ramo Planner aceita ausência/erro e até mesma versão; Procurement exige200. Esses níveis de prova são distintos. Blob `cca702559ac29b877935dec567148a510398b3b3`.

**Risco/limite restante:**

- O Playwright publicado em W2 permite passar o ramo Planner com zero versões ou erro arbitrário que tenha reason; também aceita comparar a única versão consigo mesma. PASS do spec sozinho não fecha UX04.
- BI09/10/11 dependem de tuplas persistidas elegíveis e consumidores reais; não foram observadas.
- Seleções removidas, duplicadas/incompatíveis, expiradas ou revogadas precisam permanecer explícitas, sem substituto silencioso.

**Correção ou prova exigida:**

- Evidência afetada deve mostrar duas versões distintas escolhidas, HTTP200 e tabela/projeção Planner correspondente; mais Procurement200 por escolha explícita.
- Verificar troca de view/período sem reutilizar seleção incompatível e estados indisponíveis com próxima ação.
- Registrar variantes BI09/10/11 somente quando houver resultados reais elegíveis e consumo observado. Root anunciou fortalecimento futuro do spec, fora de W2.

### R1-UX-05 — needs-hosted-evidence

Reviewer `/root/review_product`; authors: `/root`, `/root/authority_builder`, `/root/composition_intake`, `/root/runtime_analysis`, `UI corrections builder identified by published ui-corrections-W2 manifest`, `published producer owners WP01–WP09 and WP11–WP14`. Reviewer e authors são disjuntos; R1 não escreveu correções.

**Critérios:** WP10.T01.CHK.04, WP10.T01.CMP.02, WP10.T01.SUC.10, WP10.T02.CMP.01, CAMP.QLT.03.

A allowlist reduzida do host foi substituída pelo vocabulário canônico por página. A nova autoridade consulta a projeção autorizada do destino, verifica referências/valores e relê a mesma fonte com revalidação do principal.

**Evidência de W2:**

- [apps/cli/src/sucafina-product/host-context.ts:803–805](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/host-context.ts#L803-L805): A autoridade nova está no serviço real de personalViews. Blob `d576b5dbf7e16c4c77043d39c3720e8b15d64612`.
- [apps/cli/src/sucafina-product/personal-view-authority.ts:14–60](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/personal-view-authority.ts#L14-L60): Admite chaves por página e valida versão, owner, classificação, modo, pedido, fornecedor e estados. Blob `ab705bc54819ab4c6a41d83b6c6170ada2859a9d`.
- [apps/cli/src/sucafina-product/personal-view-authority.ts:63–87](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/personal-view-authority.ts#L63-L87): Lê projeção do domínio para o principal e exige duas leituras concordantes/acesso atual. Blob `ab705bc54819ab4c6a41d83b6c6170ada2859a9d`.
- [modules/sucafina/Sucafinav1/product/interface/personal-views.ts:59–91](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/modules/sucafina/Sucafinav1/product/interface/personal-views.ts#L59-L91): List/open/save continuam a usar authorizeView; C08 conserva o CAS existente. Blob `34a1a5045e33a23edb5ca0f49dcced8532580c6f`.
- [modules/sucafina/Sucafinav1/test/product/wp10/integration/extended-ui-regressions.test.ts:51–87](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/modules/sucafina/Sucafinav1/test/product/wp10/integration/extended-ui-regressions.test.ts#L51-L87): O teste novo cobre gramática e revogação da autoridade, sem save/open browser de versão Planner. Blob `5a406869dd58673e740b2d6f629b2b1544d669a8`.

**Risco/limite restante:**

- Ainda falta prova da sequência salvar/listar/reabrir/preferida em nova sessão no host real com version e filtros.
- SfPersonalView publicado pelo WP01 guarda IDs lógicos sem incarnation. O adapter atual reautoriza o objeto corrente, mas não prova continuidade após exclusão/recriação com o mesmo ID; dependência explícita do contrato/produtor, sem alegação de cobertura desse negativo.

**Correção ou prova exigida:**

- Salvar e reabrir view Planner OPEX com versão/owner/class/mode e ao menos um filtro Dashboard/Procurement; verificar seleção idêntica e página inicial.
- Revogar/remover referência e verificar recusa correta sem conteúdo privado.
- Não aceitar o caso de same-ID replacement até o produtor fornecer identidade/incarnation apropriada ou prova de continuidade.

## Novos achados obrigatórios

Reviewer `/root/review_product`; authors: `/root`, `/root/authority_builder`, `/root/composition_intake`, `/root/runtime_analysis`, `UI corrections builder identified by published ui-corrections-W2 manifest`, `published producer owners WP01–WP09 and WP11–WP14`. Reviewer e authors são disjuntos; R1 não escreveu correções.

### R1-UX-06 — Releitura dos controles de decisão apaga rascunho autorizado ao mudar o fingerprint

Reviewer `/root/review_product`; authors: `/root`, `/root/authority_builder`, `/root/composition_intake`, `/root/runtime_analysis`, `UI corrections builder identified by published ui-corrections-W2 manifest`, `published producer owners WP01–WP09 and WP11–WP14`. Reviewer e authors são disjuntos; R1 não escreveu correções.

**P2 · open · owner WP10 own decision-controls composition.** Critérios: WP10.T02.CHK.01, WP10.T02.QLT.01, WP10.T01.CMP.01, CAMP.QLT.03.

**Cenário reproduzível:**

1. Abrir controles do caso A e digitar nota de classificação, sem salvar.
2. Em outra aba/sessão autorizada criar ou editar um caso B também legível, mantendo caso A e permissões atuais.
3. Voltar à aba A e gerar focus; a leitura JSON retorna200 com fingerprint diferente.

**Comportamento determinado pelo código:** O handler chama clear() para qualquer fingerprint diferente, removendo o formulário, rascunho e dados mesmo após leitura autorizada200. A lista completa de cases participa do fingerprint, portanto alteração alheia já basta.

**Consequência:** Perda silenciosa da entrada local durante uso normal em abas ou concorrência; a pessoa precisa refazer a classificação mesmo quando o caso editado permanece inalterado.

**Evidência:**

- [apps/cli/src/sucafina-product/decision-controls.ts:163–167](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/decision-controls.ts#L163-L167): clear elimina a região e seus controles. Blob `df789ad9673a2fa42aa8ea7d2a44cdf015fd4072`.
- [apps/cli/src/sucafina-product/decision-controls.ts:216–223](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/decision-controls.ts#L216-L223): Focus chama clear por fingerprint diferente ou falha. Blob `df789ad9673a2fa42aa8ea7d2a44cdf015fd4072`.
- [apps/cli/src/sucafina-product/decision-controls.ts:228–241](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/decision-controls.ts#L228-L241): Fingerprint inclui todo ControlsBody, inclusive cases e material atual. Blob `df789ad9673a2fa42aa8ea7d2a44cdf015fd4072`.

**Correção mínima:** Separar revogação/negação de mudanças autorizadas. Preservar rascunho humano e sinalizar/revalidar conflito material; não apagar por alterações na lista de outros casos. Revogação real deve continuar limpando conteúdo restrito.

**Recheck no novo SHA:**

- Rascunho em A + B alterado + focus200 conserva nota e contexto editável apropriado.
- Alteração concorrente relevante em A conserva rascunho e oferece reconciliação sem permitir overwrite stale.
- Revogação403 ainda remove dados restritos.

### R1-UX-07 — Versões distintas aparecem com rótulos idênticos na escolha de fonte dos controles

Reviewer `/root/review_product`; authors: `/root`, `/root/authority_builder`, `/root/composition_intake`, `/root/runtime_analysis`, `UI corrections builder identified by published ui-corrections-W2 manifest`, `published producer owners WP01–WP09 and WP11–WP14`. Reviewer e authors são disjuntos; R1 não escreveu correções.

**P2 · open · owner WP10 own decision-controls composition.** Critérios: WP10.T01.QLT.01, WP10.T02.SUC.01, WP10.T06.QLT.60, CAMP.QLT.03, CAMP.QLT.04.

**Cenário reproduzível:**

1. Associar ao caso duas versões reais distintas do Planner, ambas no mesmo período/moeda e revisão1.
2. Abrir o seletor Forecast para classificar ou o seletor de fonte de acompanhamento.
3. Comparar os rótulos mostrados para as duas fontes.

**Comportamento determinado pelo código:** O label contém somente tipo genérico, período, moeda e revisão; não inclui nome/recordId da versão. Ambas as opções ficam idênticas na UI, enquanto a identidade existe apenas no value/digest interno.

**Consequência:** A escolha humana não identifica inequivocamente qual forecast será classificado ou monitorado. Trocar uma opção pode vincular a classificação a outra fonte sem a pessoa conseguir distinguir antes de agir.

**Evidência:**

- [apps/cli/src/sucafina-product/decision-controls.ts:64–74](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/decision-controls.ts#L64-L74): A construção de label omite identidade da versão. Blob `df789ad9673a2fa42aa8ea7d2a44cdf015fd4072`.
- [apps/cli/src/sucafina-product/decision-controls.ts:142–146](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/decision-controls.ts#L142-L146): sourcePicker exibe somente label e guarda digest como value. Blob `df789ad9673a2fa42aa8ea7d2a44cdf015fd4072`.
- [apps/cli/src/sucafina-product/decision-controls.ts:155–156](https://github.com/gustavomhss/Orchestra-SF/blob/b7a6b5d4b66acf172762aba72f01e424bf9c0b90/apps/cli/src/sucafina-product/decision-controls.ts#L155-L156): Fonte de acompanhamento usa o mesmo label ambíguo. Blob `df789ad9673a2fa42aa8ea7d2a44cdf015fd4072`.

**Correção mínima:** Mostrar nome/identidade legível da versão e um discriminador estável autorizado, usando recordId quando necessário; conservar período/moeda/revisão. Mesmo nomes iguais devem continuar distinguíveis.

**Recheck no novo SHA:**

- Duas fontes distintas com mesmo nome/período/moeda/revisão exibem rótulos distinguíveis.
- A seleção e o registro persistido correspondem ao recordId escolhido.
- Fonte revogada/removida não permanece como opção válida.

## Histórico Portfolio e consumer externo

Reviewer `/root/review_product`; authors: `/root`, `/root/authority_builder`, `/root/composition_intake`, `/root/runtime_analysis`, `UI corrections builder identified by published ui-corrections-W2 manifest`, `published producer owners WP01–WP09 and WP11–WP14`. Reviewer e authors são disjuntos; R1 não escreveu correções.

**R2-F03 continua aberto sob R2.** O adapter de histórico simples está ligado, mas R2 confirmou que Portfolio após mudança da versão do caso ainda depende de `business.resolveCase` sem `withCase` na entrada review-read. A prova de SourceRef/OPEX não fecha essa variante. O relatório financeiro mantém cenário e owner; R1 não duplica aceite.

**WP01 AlternativeDraft permanece pendente.** A captura própria agora liga a seleção humana exata ao run em `decision-alternative-services.ts:96–140` e `host-context.ts:444–446`. Porém, o consumer publicado `ui/components.ts:60–65` omite seu label, e `ui/contribution-body.ts:8–54` omite seu corpo. A renderização interpola `undefined` em lugar de conteúdo útil. O check W2 confirma os erros nesses dois arquivos. É dependência estrangeira do consumer, permitida pendente no escopo WP10, mas impeditiva do aceite integral e da alegação de resultado consumido.

## Cobertura da rechecagem

Reviewer `/root/review_product`; authors: `/root`, `/root/authority_builder`, `/root/composition_intake`, `/root/runtime_analysis`, `UI corrections builder identified by published ui-corrections-W2 manifest`, `published producer owners WP01–WP09 and WP11–WP14`. Reviewer e authors são disjuntos; R1 não escreveu correções.

| Escopo | Inspeção e limite |
| --- | --- |
| UX01 request-local context | Real Request transport and canonical runtime period extraction compared; residual own-year/month defect OPEN. |
| UX02 review/historical/successor/navigation | HTTP, browser callbacks, explicit reconfirmation, source link membership and history adapter inspected. Simple Dashboard fix needs hosted proof; Portfolio residual stays R2 open. |
| UX03 Forecast | Adapter → canonical input registry → financial producer → durable selection verified by code; boundary test source inspected, no financial/native run credited. |
| UX04 BI | Options/producers, UI selectors, exact case bindings and sources inspected; Planner proof in W2 spec not discriminating enough for closure. |
| UX05 personal views | Canonical key vocabulary and actual actor-filtered destination authority inspected; full save/reopen remains unobserved; same-ID continuity remains declared WP01 contract limit. |
| Decision controls new parent delta | Real mount/link, case/source/registry readers, forms, POST payloads, scope/CAS and focus handling read. UX06/07 are new own mandatory findings. |
| AlternativeDraft new parent delta | Native selection snapshot and exact revalidation reviewed for consumer reachability. WP01 label/body omission remains explicitly pending; technical native verification belongs R3. |
| Guide/templates/docs/imports/global remainder | Canonical 171 texts unchanged; W1 inspection remains source context only. No new acceptance of broader J01–J13, templates/Atlas/scanner/restart, 5/18/8/39, documents/imports, accessibility or performance. S0 retains global C/AM/native acceptance. |

O JSON conserva os **171 IDs e textos canônicos**, com reviewer/authors disjuntos e estados reavaliados. Nenhum critério recebe aceite individual por quantidade de arquivos, fonte de teste, descrição do builder ou inspeção de autor.

## Evidência hospedada exata de W2

Reviewer `/root/review_product`; authors: `/root`, `/root/authority_builder`, `/root/composition_intake`, `/root/runtime_analysis`, `UI corrections builder identified by published ui-corrections-W2 manifest`, `published producer owners WP01–WP09 and WP11–WP14`. Reviewer e authors são disjuntos; R1 não escreveu correções.

Foi recebido e inspecionado o log do **run `43548947850`, job `132306683850`**, snapshot `55e5300c23b39054874060b34e36abda0a6f443d`. O log confirma checkout de W2 em linhas 329–342; o snapshot referencia o mesmo SHA e tree.

| Verificação | Resultado observado no log |
| --- | --- |
| Sucafina typecheck | FAIL: erros de sintaxe WP13, linhas 556–558. |
| CLI typecheck | FAIL: TS2339 próprio em planner-calculation-services.ts:116, linha565, além de erros estrangeiros. |
| Atlas generate/check:generated/typecheck | Etapas encerradas sem marcador de falha, linhas 674–688. |
| Spawn imports | Concluído: 4642 arquivos, 66 sites admitidos, linhas691–695. |
| Product guards | FAIL: dois gates pelos logs brutos de round1 arquivados no produto, linhas702–703/739/777–778. |
| Unit/browser de W2 | Nenhuma execução ou resultado recebido; não creditado. |

Log: `analysis/hosted/job-132306683850.log`; SHA256 `80df430efea9b2e8654db4cb5441622ff6b8fa89a6f5a9483b1cf6290b70e341`. Snapshot: `analysis/hosted/snapshot-W2-check.json`; SHA256 `83c8204edd039c047888f50cc1cd16b17045fd8ff99fc65b0f95b1a44428afe1`. O check do predecessor `43548298822` em `a43883c930cf996472b27c524aadb4694c13b5a3` **não recebe crédito em W2**.

O spec de BI de W2 permite ausência/erro no ramo Planner; uma futura execução verde só será qualificante para UX04 se demonstrar duas versões distintas e resultado200/projeção. O root anunciou fortalecimento em uma versão posterior, que não foi aceita neste parecer. Não foram observados screenshots, interação, keyboard/focus real, 30 repetições/p95 ou execução nativa de W2 por R1.

## Handoff para o próximo freeze

Reviewer `/root/review_product`; authors: `/root`, `/root/authority_builder`, `/root/composition_intake`, `/root/runtime_analysis`, `UI corrections builder identified by published ui-corrections-W2 manifest`, `published producer owners WP01–WP09 and WP11–WP14`. Reviewer e authors são disjuntos; R1 não escreveu correções.

Rechecagem estática de W2 concluída. Os residuais e novos achados foram enviados imediatamente ao root. Root reconheceu UX01 e UX06; UX07 foi enviado para correção. As mudanças anunciadas no repo mutável não alteram esta disposição.

Publicar novo candidato, fornecer tree/parent/delta e abrir lease imutável antes da próxima rechecagem. Repetir a prova afetada e os gates obrigatórios sem atribuir a um SHA o resultado de outro. Oito seleções finais, global C, AM01–AM06, 5/18/8/39 e aceite nativo continuam reservados a S0.
