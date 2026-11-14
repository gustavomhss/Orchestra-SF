# R1 — Parecer independente de produto/UX — W

**Veredito: changes-required.** Candidato publicado `eee00ac3ef2b68c987970535ba5bba5e4c6ad01b`. Cinco achados obrigatórios corrigíveis em WP10 permanecem abertos neste SHA. Nenhum aceite visual, nativo ou global foi concedido.

Data do parecer: 2026-11-14T02:22:36.906458+00:00.

## Identidade, independência e lease

Reviewer: `/root/review_product`. Authors de produto: `/root`, `/root/authority_builder`, `/root/composition_intake`, `/root/runtime_analysis`, mais owners dos outputs publicados WP01–WP09/WP11–WP14. Reviewer e authors são disjuntos; R1 não escreveu produto. Esta identificação aplica-se também ao relatório JSON por seção e por critério.

Lease somente leitura aceito para W, tree `dcfc04896c3a83e6a69d3ecd1d948ff54231ddf7`, parent `fdbb184f1df7c58f00ee8555e42bce017fd0e942`, branch `astra-wp10`, PR29 contra `sf2-stack`. Builders estavam CLOSED na atribuição. Após o aviso de correções do root, somente `analysis/frozen-W/repo` foi usado como fonte de W. Nenhuma correção em `repo/` foi avaliada como parte de W.

Foram escritas somente as duas peças deste parecer. R1 não executou testes, build, typecheck, servidor, browser ou análise nativa local; não escreveu remoto e não usou gh/git remoto.

## Fontes e validade da evidência

Reviewer: `/root/review_product`. Authors examinados: /root, /root/authority_builder, /root/composition_intake, /root/runtime_analysis, published producer owners WP01–WP09 and WP11–WP14; ownership retained by their published outputs.

Lidos AGENTS, handoff, pack canônico, intake, mapa preliminar do builder e manifesto congelado. Foram lidos e triados os **171 critérios das sete tasks mais axiomas do WP**; a matriz JSON conserva cada ID e texto e não marca critério aceito. O mapa preliminar do builder é insumo, sem autoridade de aceite.

Os 175 deltas do manifesto coincidem com os SHA256 da cópia congelada, sem ausências ou divergências. Para os diretórios publicados UI, interface e CLI product, 130 blobs foram confrontados por GitHub MCP somente leitura no SHA exato W e coincidem com os bytes locais. A cópia é parcial: ausência local fora desse recorte não foi convertida em ausência remota.

Os achados abaixo são contraprovas por leitura do encadeamento real de código. Os cenários estão especificados para execução hospedada, mas R1 não os apresenta como observação de navegador.

## Achados obrigatórios em W

Reviewer desta seção e de cada achado: `/root/review_product`. Authors: /root, /root/authority_builder, /root/composition_intake, /root/runtime_analysis, published producer owners WP01–WP09 and WP11–WP14; ownership retained by their published outputs.

| ID | Severidade | Resultado para a pessoa | Owner da correção |
| --- | --- | --- | --- |
| R1-UX-01 | P2 | A navegação para review e BI perde o período selecionado | WP10/composição do host |
| R1-UX-02 | P1 | Review preservado não oferece atualização utilizável nem conserva o contexto do sucessor | WP10/composição do host |
| R1-UX-03 | P1 | Forecast legado prepara entrada sem o registro canônico exigido no start | WP10/composição do host |
| R1-UX-04 | P1 | O seletor de BI oferece oito visualizações sem caminho para escolher seus produtores | WP10/composição do host |
| R1-UX-05 | P2 | Saved views recusa filtros que o contrato e a própria página permitem salvar | WP10/composição do host |

### R1-UX-01 — A navegação para review e BI perde o período selecionado

**P2 · obrigatório · changes-required em `eee00ac3ef2b68c987970535ba5bba5e4c6ad01b`.** Reviewer `/root/review_product`; authors de produto: /root, /root/authority_builder, /root/composition_intake, /root/runtime_analysis, published producer owners WP01–WP09 and WP11–WP14; ownership retained by their published outputs. Nenhuma interseção de autoria.

**Critérios:** WP10.T01.QLT.01, WP10.T01.CMP.01, WP10.T02.CMP.01, WP10.T02.QLT.01, CAMP.INV.03.

**Cenário reproduzível:**

1. Abrir Dashboard Budget Overview no ano 2027, sendo diferente do ano corrente, com acesso e dados válidos.
2. Usar Prepare review and reports pela navegação inserida pelo host; repetir com Business intelligence.
3. Conferir URL, bootstrap/seleção, prévia e material gerado.

**Traço no candidato:**

- [apps/cli/src/sucafina-product/extended-business-services.ts:66–69](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/apps/cli/src/sucafina-product/extended-business-services.ts#L66-L69): Os links carregam sf/page, mas não o período da página de origem.
- [apps/cli/src/sucafina-product/extended-http.ts:34–38](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/apps/cli/src/sucafina-product/extended-http.ts#L34-L38): O período ausente passa a ser o ano UTC corrente.
- [apps/cli/src/sucafina-product/extended-http.ts:81–84](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/apps/cli/src/sucafina-product/extended-http.ts#L81-L84): A agenda do review é descoberta usando esse período substituto.
- [apps/cli/src/sucafina-product/extended-bi-browser.ts:14–18](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/apps/cli/src/sucafina-product/extended-bi-browser.ts#L14-L18): A UI de BI também inicializa as datas com o ano corrente quando os parâmetros faltam.

**Comportamento determinado pelo código:** O link de review preserva page, mas apaga year/start/end. O handler usa o ano corrente; a preparação de review não oferece seletor de período para recuperar a intenção. O BI também inicia em outro período, embora tenha campos de data visíveis.

**Consequência:** Uma pessoa pode preparar material referente a outro ano sem ter alterado sua escolha. Viola a conservação de contexto temporal exigida pelo roteiro e prejudica a interpretação dos números.

**Correção mínima:** Transportar o Request/contexto temporal autorizado até a decoração privada de HTML e carregar o período explícito nos links; quando não houver período inequívoco, exigir escolha humana antes de descobrir a seleção. Não inferir o período por dado mais recente.

**Escopo do owner:** WP10 shared host composition. O defeito não pode ser reclassificado como dependência estrangeira só para encerrar a revisão.

**Recheck exigido em novo SHA congelado:**

- Pela navegação real de uma página com ano não corrente, abrir review e BI e conferir exatamente start/end da origem.
- Conferir que preview, preservação e material conservam o período; cobrir contexto sem período com escolha explícita.

Estado da rechecagem: **não executada**. W continua imutável; correção anunciada não é aceite.

### R1-UX-02 — Review preservado não oferece atualização utilizável nem conserva o contexto do sucessor

**P1 · obrigatório · changes-required em `eee00ac3ef2b68c987970535ba5bba5e4c6ad01b`.** Reviewer `/root/review_product`; authors de produto: /root, /root/authority_builder, /root/composition_intake, /root/runtime_analysis, published producer owners WP01–WP09 and WP11–WP14; ownership retained by their published outputs. Nenhuma interseção de autoria.

**Critérios:** WP10.T01.DOD.01, WP10.T01.SUC.01, WP10.T02.CHK.02, WP10.T02.CMP.01, WP10.T05.CHK.02, CAMP.INV.06.

**Cenário reproduzível:**

1. Preparar e preservar uma revisão de IT Operations com período escolhido.
2. Abrir a reunião preservada, alterar uma origem pelo fluxo autorizado e usar a ação de verificar atualizações.
3. Tentar criar revisão sucessora, comparar com a anterior e abrir as origens/pontos da revisão anterior.

**Traço no candidato:**

- [apps/cli/src/sucafina-product/extended-browser.ts:9–22](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/apps/cli/src/sucafina-product/extended-browser.ts#L9-L22): checkUpdate sempre retorna unavailable; abrir meeting remove page/período e a preparação não recebe previousReviewRef.
- [modules/sucafina/Sucafinav1/product/reviews/meeting.ts:369–389](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/reviews/meeting.ts#L369-L389): O botão de criar atualização só é oferecido após checkUpdate ok e available.
- [modules/sucafina/Sucafinav1/product/reviews/meeting.ts:63–88](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/reviews/meeting.ts#L63-L88): Navegação para revisão anterior depende de openReviewSection, omitido na composição.
- [modules/sucafina/Sucafinav1/product/reviews/meeting.ts:96–105](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/reviews/meeting.ts#L96-L105): Navegação para origem depende de openSource, também omitido.
- [apps/cli/src/sucafina-product/extended-http.ts:74–84](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/apps/cli/src/sucafina-product/extended-http.ts#L74-L84): Ao remover reviewRef sem contexto a seleção volta a Budget Overview no período default.
- [modules/sucafina/Sucafinav1/product/reviews/workspace.ts:9–18](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/reviews/workspace.ts#L9-L18): O consumer publicado aceita previousReviewRef; o host não o fornece ao reabrir.

**Comportamento determinado pelo código:** Verificar atualização termina sempre em Update status unavailable, antes da criação de um sucessor. Mesmo se o callback fosse liberado isoladamente, requestUpdate apenas excluiria reviewRef de uma URL cujo page/período já foi descartado. Não se transmite previousReviewRef. Os hooks de fonte e revisão anterior estão ausentes.

**Consequência:** O ciclo preservar → atualizar origem → preparar sucessora → comparar não é concluível pela UI montada. A pessoa perde seleção, ordem/contexto e vínculo histórico, ou precisa reconstruir o trabalho manualmente.

**Correção mínima:** Compor uma verificação autorizada de atualizações, restaurar a seleção preservada com período e previousReviewRef e oferecer sucessor sem apagar a revisão anterior. Ligar openSource/openReviewSection a destinos que revalidem autoridade. Corrigir em WP10, utilizando os hooks do consumer publicado.

**Escopo do owner:** WP10 shared host composition. O defeito não pode ser reclassificado como dependência estrangeira só para encerrar a revisão.

**Recheck exigido em novo SHA congelado:**

- Preservar IT Operations em período não corrente; reabrir em nova sessão e conferir seleção/ordem/período.
- Alterar origem; manter o conteúdo da revisão antiga autorizado e estável; criar sucessora e comparar diferenças reais.
- Abrir fontes e revisão anterior por UI; revogação e fonte removida/substituída devem recusar sem revelar conteúdo.
- Rechecar também R2-F03: atualizar a origem não pode tornar todo o review histórico indisponível por mera desigualdade de versão.

Estado da rechecagem: **não executada**. W continua imutável; correção anunciada não é aceite.

### R1-UX-03 — Forecast legado prepara entrada sem o registro canônico exigido no start

**P1 · obrigatório · changes-required em `eee00ac3ef2b68c987970535ba5bba5e4c6ad01b`.** Reviewer `/root/review_product`; authors de produto: /root, /root/authority_builder, /root/composition_intake, /root/runtime_analysis, published producer owners WP01–WP09 and WP11–WP14; ownership retained by their published outputs. Nenhuma interseção de autoria.

**Critérios:** WP10.T01.CHK.02, WP10.T01.DOD.01, WP10.T01.SUC.01, WP10.T02.CMP.01, WP10.T06.CHK.01, WP10.T06.SUC.01, WP10.T06.SUC.60.

**Cenário reproduzível:**

1. Criar caso novo autorizado com duas fontes distintas de forecast presentes no caso e modelo disponível.
2. Não inserir manualmente sf:analysis-selection nem realizar outra preparação canônica para esse request.
3. Na UI existente de Forecast, escolher as duas fontes, período/moeda e iniciar análise.

**Traço no candidato:**

- [modules/sucafina/Sucafinav1/product/ui/forecast-analysis.ts:225–238](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/ui/forecast-analysis.ts#L225-L238): A UI prepara por workbench-forecast e inicia workbench-analysis; falha no start conserva retry incerto.
- [modules/sucafina/Sucafinav1/product/interface/forecast-http.ts:20–26](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/interface/forecast-http.ts#L20-L26): O endpoint legado delega a forecastInputs.prepare sob sf_forecast_compare.
- [apps/cli/src/sucafina-product/host-context.ts:810–815](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/apps/cli/src/sucafina-product/host-context.ts#L810-L815): O serviço exposto continua sendo business.forecastInputs.
- [apps/cli/src/sucafina-product/business-services.ts:378–398](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/apps/cli/src/sucafina-product/business-services.ts#L378-L398): O preparo compara fontes e devolve ForecastExplainInput, sem preparar/persistir a seleção de análise canônica.
- [apps/cli/src/sucafina-product/analysis-host-services.ts:101–102](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/apps/cli/src/sucafina-product/analysis-host-services.ts#L101-L102): O scope de seleção inclui sfAnalysisSkillIds, abrangendo Forecast.
- [apps/cli/src/sucafina-product/analysis-selection-scope.ts:161–175](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/apps/cli/src/sucafina-product/analysis-selection-scope.ts#L161-L175): Fora da preparação ativa, verificar depende de um registro durável exato; sem registro retorna indisponibilidade.
- [apps/cli/src/sucafina-product/host-context.ts:421–436](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/apps/cli/src/sucafina-product/host-context.ts#L421-L436): A falha do verificador impede a admissão do run e vira analysis-source-unavailable.

**Comportamento determinado pelo código:** O preparo legado pode produzir skillInput válido, mas não cria o registro durável que o verificador escopado exige para todas as skills. O start falha antes da execução nativa por ausência da seleção humana canônica; a UI apresenta retry da mesma solicitação incerta.

**Consequência:** A análise especializada anunciada no caminho já existente deixa de funcionar em caso novo. Retry do mesmo payload não cria a seleção que falta, mantendo a pessoa bloqueada sem próximo passo eficaz.

**Correção mínima:** Adaptar o fluxo legado à preparação canônica com a mesma escolha humana, principal, caso, versão, período e digest, sem desativar o fence ou aceitar dados do cliente como prova. Preservar o contrato externo por composição privada, se necessário.

**Escopo do owner:** WP10 shared host composition. O defeito não pode ser reclassificado como dependência estrangeira só para encerrar a revisão.

**Recheck exigido em novo SHA congelado:**

- Executar pela rota/UI legada com caso novo e fontes reais autorizadas, sem semear seleção; comprovar prepare e start admitido no mesmo request contextual.
- Alterar/remover/substituir uma fonte ou revogar acesso entre prepare/start e comprovar recusa.
- Separar a prova de HTTP/admissão da prova nativa sf_finance/SessionV2.skill/output consumido, que continua obrigatória e ainda não foi observada por R1.

Estado da rechecagem: **não executada**. W continua imutável; correção anunciada não é aceite.

### R1-UX-04 — O seletor de BI oferece oito visualizações sem caminho para escolher seus produtores

**P1 · obrigatório · changes-required em `eee00ac3ef2b68c987970535ba5bba5e4c6ad01b`.** Reviewer `/root/review_product`; authors de produto: /root, /root/authority_builder, /root/composition_intake, /root/runtime_analysis, published producer owners WP01–WP09 and WP11–WP14; ownership retained by their published outputs. Nenhuma interseção de autoria.

**Critérios:** WP10.T01.CHK.02, WP10.T01.DOD.01, WP10.T01.CMP.01, WP10.T01.SUC.01, WP10.T02.CMP.01, WP10.T05.CHK.02, CAMP.CMP.04.

**Cenário reproduzível:**

1. Entrar em Business intelligence pelo link normal do Dashboard, sem preparar URL manualmente.
2. Escolher BI02, BI03, BI04, BI05, BI06, BI09, BI10 ou BI11.
3. Manter dados/versões autorizados e o produtor correspondente disponível; tentar escolher os registros usados na comparação.

**Traço no candidato:**

- [apps/cli/src/sucafina-product/extended-bi-browser.ts:10–13](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/apps/cli/src/sucafina-product/extended-bi-browser.ts#L10-L13): O seletor oferece todos os 11 biViews.
- [apps/cli/src/sucafina-product/extended-bi-browser.ts:30–33](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/apps/cli/src/sucafina-product/extended-bi-browser.ts#L30-L33): A requisição só inclui selectionRef se já veio na URL inicial; a página não cria a seleção.
- [apps/cli/src/sucafina-product/extended-business-services.ts:66–69](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/apps/cli/src/sucafina-product/extended-business-services.ts#L66-L69): A navegação real entra em sf=bi sem seleção de produtor.
- [apps/cli/src/sucafina-product/extended-http.ts:54–64](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/apps/cli/src/sucafina-product/extended-http.ts#L54-L64): Sem selectionRef, somente a resolução Dashboard pode criar uma seleção; demais views recebem choose-producer-selection/422.
- [modules/sucafina/Sucafinav1/product/dashboard/bi-metadata.ts:10–15](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/dashboard/bi-metadata.ts#L10-L15): O resolvedor automático contempla apenas BI01, BI07 e BI08.
- [apps/cli/src/sucafina-product/bi-services.ts:87–118](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/apps/cli/src/sucafina-product/bi-services.ts#L87-L118): Existem produtores reais Planner/Procurement/cenário/portfólio montados para as views restantes.
- [apps/cli/src/sucafina-product/extended-bi-browser.ts:54–54](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/apps/cli/src/sucafina-product/extended-bi-browser.ts#L54-L54): A mensagem manda abrir a análise pelos dados/versões, mas o host não liga esse caminho na navegação inspecionada.

**Comportamento determinado pelo código:** As oito views chegam a bi-data sem selectionRef e recebem 422 antes de invocar seu produtor. A UI não permite selecionar versões, pedido, cenário, resultado ou artefato. Os helpers encode de seleção existem, mas não há consumer deles nos diretórios UI/interface/CLI publicados inspecionados (130 blobs confrontados com W).

**Consequência:** O catálogo sugere capacidades que não são alcançáveis pela jornada normal. Mesmo com os produtores disponíveis, a pessoa não consegue escolher fontes nem obter o resultado sem construir uma referência/URL fora do produto.

**Correção mínima:** Adicionar escolha humana de fontes/versões/resultados autorizados na composição ou links reais dos contextos produtores; encaminhar selectionRef exata sem adotar latest implícito. Distinguir falta de seleção de produtor indisponível e manter limites explícitos para variantes ainda estrangeiras.

**Escopo do owner:** WP10 shared host composition. O defeito não pode ser reclassificado como dependência estrangeira só para encerrar a revisão.

**Recheck exigido em novo SHA congelado:**

- Abrir pela navegação normal uma comparação Planner BI02/03/04 e uma Procurement BI05/06 com seleção explícita e projeção real.
- Cobrir cenário/portfólio/sensibilidade somente com artefatos reais elegíveis; indisponibilidade deve explicar o pré-requisito e permitir recuperar a escolha.
- Trocar a view e o período sem reutilizar selectionRef de produtor incompatível; recusar fonte revogada/substituída.

Estado da rechecagem: **não executada**. W continua imutável; correção anunciada não é aceite.

### R1-UX-05 — Saved views recusa filtros que o contrato e a própria página permitem salvar

**P2 · obrigatório · changes-required em `eee00ac3ef2b68c987970535ba5bba5e4c6ad01b`.** Reviewer `/root/review_product`; authors de produto: /root, /root/authority_builder, /root/composition_intake, /root/runtime_analysis, published producer owners WP01–WP09 and WP11–WP14; ownership retained by their published outputs. Nenhuma interseção de autoria.

**Critérios:** WP10.T01.CHK.04, WP10.T01.CMP.02, WP10.T01.SUC.10, WP10.T02.CMP.01, CAMP.QLT.03.

**Cenário reproduzível:**

1. Como usuário autorizado, abrir Planner OPEX e selecionar uma versão válida pela própria página.
2. Dar nome à view e usar Save this page and filters; repetir com página inicial preferida.
3. Considerar também uma view pré-existente com version/request/status válido e tentar list/open.

**Traço no candidato:**

- [apps/cli/src/sucafina-product/host-context.ts:790–808](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/apps/cli/src/sucafina-product/host-context.ts#L790-L808): authorizeView bloqueia todas as seleções fora de uma lista reduzida de year/month/own antes de verificar a página.
- [modules/sucafina/Sucafinav1/product/interface/personal-views.ts:15–35](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/interface/personal-views.ts#L15-L35): O contrato canônico permite version/owner/class/mode/filter/status/topicStatus/memberStatus/request/supplier por página.
- [modules/sucafina/Sucafinav1/product/ui/personal-views.ts:36–40](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/ui/personal-views.ts#L36-L40): A captura da UI envia exatamente as seleções admitidas pelo contrato da página.
- [modules/sucafina/Sucafinav1/product/ui/personal-views.ts:145–154](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/ui/personal-views.ts#L145-L154): Salvar e escolher página inicial enviam esses filtros.
- [modules/sucafina/Sucafinav1/product/interface/personal-views.ts:59–73](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/interface/personal-views.ts#L59-L73): A mesma autorização filtra list, bloqueia open e devolve denied no save.
- [modules/sucafina/Sucafinav1/product/ui/personal-views.ts:31–49](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/ui/personal-views.ts#L31-L49): 403 elimina o widget e informa Your access changed, embora o acesso não tenha mudado.

**Comportamento determinado pelo código:** O filtro version é recusado em authorizeView, gerando denied/403 e substituindo todo o widget por aviso de acesso alterado. Outras chaves canônicas também são recusadas. Views existentes que contêm esses filtros são omitidas ou ficam indisponíveis.

**Consequência:** A preferência não guarda a seleção de trabalho mais relevante do Planner e de várias páginas Dashboard/Procurement. A mensagem atribui o defeito a uma mudança de permissão inexistente e impede recuperação pelo próprio widget.

**Correção mínima:** Usar o vocabulário canônico por superfície/página e reautorizar referências efetivas (como versão, pedido e fornecedor) na própria fonte. Não apenas ampliar a lista sem verificar a autoridade; não acusar revogação por filtro suportado.

**Escopo do owner:** WP10 shared host composition. O defeito não pode ser reclassificado como dependência estrangeira só para encerrar a revisão.

**Recheck exigido em novo SHA congelado:**

- Salvar versão/filtros reais de Planner OPEX e um filtro Dashboard/Procurement; reabrir em nova sessão autorizada com a seleção idêntica.
- Conferir página inicial preferida e list/open após reload.
- Revogar acesso ou substituir a referência e verificar recusa sem reaparecer dados privados, conservando o tratamento apropriado ao motivo.

Estado da rechecagem: **não executada**. W continua imutável; correção anunciada não é aceite.

## Corroboração sem duplicar achado

Reviewer: `/root/review_product`. Authors: /root, /root/authority_builder, /root/composition_intake, /root/runtime_analysis, published producer owners WP01–WP09 and WP11–WP14; ownership retained by their published outputs. Owner do achado: `/root/review_finance`.

**R2-F03**: salvar revisão em v1, editar normalmente a origem para v2 e reler a revisão leva à recusa quando o host exige versão corrente exata e não monta `historicalSource`. O traço independente em `review-services.ts:65–80` e `reviews/port.ts:125–152` corrobora a perda de reabertura. É obrigatório corrigível na composição WP10. Não foi contado como um sexto achado R1. Deve ser rechecado junto de UX02, preservando ACL/encarnação atuais e conteúdo histórico original.

## Cobertura de responsabilidades

Reviewer: `/root/review_product`. Authors: /root, /root/authority_builder, /root/composition_intake, /root/runtime_analysis, published producer owners WP01–WP09 and WP11–WP14; ownership retained by their published outputs.

| Grupo | Critérios canônicos | Cobertura e limite do parecer |
| --- | ---: | --- |
| WP10 — Axiomas do WP inteiro | 25 | Leitura integral dos 25 textos; cinco defeitos de jornada e limites de evidência impedem aceite do WP. Oito seleções finais/full epic permanecem com S0 após bundle integral. |
| WP10.T01 — Composição e compatibilidade | 21 | Traço dos entrypoints, decoração HTML, HTTP de análise/review/BI, consumers legados, preferências, imports/documentos e estado protegido. Há cinco achados locais corrigíveis e corroboração de histórico R2-F03. |
| WP10.T02 — Jornadas e experiência | 17 | Inspeção de caminhos de entrada, seleção, indisponibilidade, reabertura e comparação. Spec Playwright próprio lido; nenhuma jornada, imagem, teclado, viewport ou medição foi executada/observada por R1. |
| WP10.T03 — Revisão independente | 15 | R1 sem autoria, lease somente leitura, fontes congeladas e achados enviados imediatamente. Este parecer é changes-required e não conta como três aceites. Recheck do novo SHA permanece necessário. |
| WP10.T04 — CI e evidência | 22 | Fonte da suíte própria e snapshots unit/check examinados; resultados finais recebidos do root: unit 156 pass/13 fail, checks Atlas/guards pass e Sucafina/CLI typecheck fail. Logs não inspecionados por R1 e nenhum resultado admite cenário UX. Não atribuir testes antigos/W4 ou outro SHA a W. |
| WP10.T05 — Guia e entrega | 14 | README de W lido integralmente: papéis, semânticas, recuperação, roteiro sintético e pendências explícitas. Reconciliação do guia com links/seleções/ciclos corrigidos deve ocorrer antes do novo freeze. D não serve para mudar guia normativo. |
| WP10.T06 — Perfis, skills e consumo | 27 | Inspecionados seleção de perfis/skills/operações, registries de prepare/verify, escolha humana e consumer Forecast. Não há aceite de carga nativa das 18 skills, oito packs, isolamento, 39 rotas ou consumo real; complementar com R3 e AM. |
| WP10.T07 — Contexto, memória e templates | 30 | Inspecionados fronteira protegida, ligação Atlas emit/read, derivações owner/kind e map/validate de task/project. R1 não executou scanner, append/read/restart, casos de template errado ou packaging; complementar com R2/R3 e AM05. |

O JSON contém a matriz completa de 171 IDs, texto canônico, reviewer/authors, SHA, findings ligados e estado. **Leitura/triagem não equivale a verificação ou aceite de cada critério.**

### Guia, documentos/imports, perfis e templates

Reviewer: `/root/review_product`. Authors: /root, /root/authority_builder, /root/composition_intake, /root/runtime_analysis, published producer owners WP01–WP09 and WP11–WP14; ownership retained by their published outputs.

**Guide and product semantics.** Guide distinguishes zero, absence, estimate, known subtotal, full/conditional comparison, incompatible currency/period and historical state. Publication is explicitly not homologation. Generic role/step narrative still requires real reproduction on corrected candidate. No current visual or native acceptance inferred.

Fontes: `modules/sucafina/Sucafinav1/README.md`.

**Document and import journeys.** Real route ordering preserves Documents/Imports links; strict query/body/context and revalidation paths inspected. Preview script distinguishes added/changed/removed/unchanged/ignored/rejected and absence/null. Import analysis uses canonical prepare/start. No document bytes/scanner/import apply/download observed by R1; foreign producer execution remains pending.

Fontes: `modules/sucafina/Sucafinav1/local/entry.ts`, `modules/sucafina/Sucafinav1/product/interface/document-http.ts`, `modules/sucafina/Sucafinav1/product/interface/import-http.ts`, `modules/sucafina/Sucafinav1/product/imports/workbench-script.ts`, `modules/sucafina/Sucafinav1/product/imports/analysis-workbench.ts`, `modules/sucafina/Sucafinav1/product/imports/analysis-options.ts`.

**Profiles and human analysis choices.** Profile/skill/operation intersections and explicit durable selections inspected. Duplicates/ambiguous selections are not treated as authority; native output and every distributed skill source remain subject to R3/hosted verification. Legacy Forecast mismatch is R1-UX-03.

Fontes: `apps/cli/src/sucafina-product/host-context.ts`, `apps/cli/src/sucafina-product/analysis-http.ts`, `apps/cli/src/sucafina-product/analysis-choice-http.ts`, `apps/cli/src/sucafina-product/analysis-host-services.ts`, `apps/cli/src/sucafina-product/analysis-services.ts`, `apps/cli/src/sucafina-product/analysis-selection-scope.ts`.

**Templates and memory.** Map derives owner from authenticated context, checks unique case event/ledger, creates task/project fields and invokes canonical validator/memoryKindOf. Host calls task mapping from ledger and real boundary emit/read. Wrong-template, key-extra, pr/logbook, scanner, project/policy variants and restart are not accepted by source inspection; AM05 required.

Fontes: `modules/sucafina/Sucafinav1/product/decision-memory/atlas-projection.ts`, `modules/sucafina/Sucafinav1/product/host-binding/atlas-memory.ts`, `modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts`.

**Negative hypotheses discarded.** Did not report a speculative Procurement select-default failure: factory bypasses default selection when only one candidate. Did not report generic authorAnalysis omission for the currently offered contest skill, whose contract embeds its author input. These do not strengthen any acceptance claim.

Fontes: `modules/sucafina/Sucafinav1/product/analytics/factory.ts`, `apps/cli/src/sucafina-product/host-context.ts`.

## CI próprio, observações e limites

Reviewer: `/root/review_product`. Authors: /root, /root/authority_builder, /root/composition_intake, /root/runtime_analysis, published producer owners WP01–WP09 and WP11–WP14; ownership retained by their published outputs. Root mantém a execução e publicação de CI.

Ao fechar o parecer, root informou os resultados finais de W: unit run `43544861337`, snapshot `d6dd636ec1ff6c6162eab8bd67f9398f847cc0d5`, com **156 pass / 13 fail, 42 arquivos, 169 testes**; check run `43544864518`, snapshot `e216f8c3ce944eb81d4869828959ed189068a73d`, com Atlas generate/typecheck e spawn/product guards PASS, mas **Sucafina e CLI typecheck FAIL**. Referências fornecidas: `analysis/hosted/job-132293688965.log` e `analysis/hosted/job-132293700346.log`. R1 não inspecionou esses logs e registra os resultados como comunicados pelo root; nenhum cenário UX recebe PASS com base neles. Não há reatribuição de CI histórico/W4 a W.

Foi lida a fonte própria `packages/app-shell/e2e/sucafina/wp10/composition.spec.ts`: Dashboard Budget, criação/reabertura de decisão, Procurement Requests e BI01/tabela. A suíte usa 1440×900. Reabrir a decisão nesse script mantém o servidor ativo; não prova persistência após restart. BI01 não cobre as oito views bloqueadas de UX04. Fonte de spec, screenshots planejados e construção de recibo não são execução observada.

Não foram observados por R1 os 320/768/1440 px completos, zoom, teclado/foco, relatório com 25 registros e campo negado, downloads, lista densa/ausência, 30 repetições/feedback/p95, J01–J13 ou análise nativa. Esses limites permanecem explícitos, sem alegar aceite de usabilidade global.

## Dependências permitidas pendentes e fechamento

Reviewer: `/root/review_product`. Authors: /root, /root/authority_builder, /root/composition_intake, /root/runtime_analysis, published producer owners WP01–WP09 and WP11–WP14; ownership retained by their published outputs.

**PENDING-GLOBAL — S0/integrator.** Full epic, oito seleções finais, suites adicionais e AM01–AM06 no mesmo candidato após bundle integral. Não disparados por R1; não são dispensados nem convertidos em PASS. Critérios: WP10.T04.CHK.41, WP10.T04.CMP.40, WP10.T05.DOD.01.

**PENDING-NATIVE — root CI controller / R3 / S0.** 5 perfis/18 skills/8 packs/39 operações, skills distribuídas, MCP real, saída consumida, isolamento/revogação e Atlas/scanner/restart não observados. Catálogo, leitura de código e teste antigo não substituem esses recibos. Critérios: WP10.T02.CMP.10, WP10.T06.DOD.01, WP10.T06.CHK.07, WP10.T07.DOD.01.

**PENDING-FOREIGN — respective published domain producers; root/S0 reconcile.** W/README explicita lacunas dos produtores para 6 handlers C07, variantes históricas/recall/contestação, portfólio/preparação/aplicação, categorias não aplicáveis e gráficos waterfall/timeline. São dependências rastreáveis, não dispensas de critérios. Os cinco R1-UX e R2-F03 são falhas da composição disponível e não podem ser reclassificados aqui. Critérios: WP10.T01.DOD.01, WP10.T06.SUC.60, WP10.T05.QLT.10.

**PENDING-UX-OBSERVATION — root hosted Playwright / independent R1 / S0.** Ainda não observados: J01–J13, 25 registros em relatório com campo negado, downloads/formatos reais, teclado, foco, 320/768/1440 e zoom, dados ausentes/densos, 30 repetições/feedback/p95. O spec próprio em W cobre quatro fluxos em 1440x900 e não autoriza essas generalizações. Critérios: WP10.T02.DOD.01, WP10.T02.CHK.03, WP10.T02.CHK.05, WP10.T02.SUC.10.

As dependências acima podem continuar pendentes neste parecer escopado, mas impedem aceite integral quando obrigatórias. Os cinco defeitos R1 e a corroboração R2-F03 têm correção na composição atual e não se enquadram como dependência estrangeira dispensável.

## Rechecagem e handoff

Reviewer: `/root/review_product`. Authors: /root, /root/authority_builder, /root/composition_intake, /root/runtime_analysis, published producer owners WP01–WP09 and WP11–WP14; ownership retained by their published outputs.

Todos os achados foram enviados ao root durante a inspeção. Root reconheceu UX01/02/03 como obrigatórios e anunciou correções; anúncio não foi julgado como delta corrigido. UX04/05 também foram enviados. Este parecer inicial de W está concluído, com **changes-required**.

Para retomar: publicar e congelar W2, informar seu tree/parent/delta e aceitar novo lease somente leitura; R1 inspeciona os deltas e os consumers afetados, confere recibos hospedados correspondentes ao SHA e reexecuta sua avaliação independente. Oito seleções finais e full epic pertencem a S0 após bundle integral. Nenhuma edição do guia/teste/produto deve ser escondida em D como evidência.
