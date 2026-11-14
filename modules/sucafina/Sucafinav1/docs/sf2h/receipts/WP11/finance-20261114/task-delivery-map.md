# Sessão 3 — mapa de entrega das 14 tarefas

**Estado: mapeado, sem aceite integral.** Este documento liga implementação e consumidores localizados às obrigações aprovadas. As evidências pertencem aos pins e escopos indicados.

Produto próprio inspecionado: W21 `8d065831356e8a73cfd0e4fbb072c5041b95d05f`; tree `77bef954682387ac0fdd3c01e7dd51b9201d2aac`. [PR #35](https://github.com/gustavomhss/Orchestra-SF/pull/35), `astra-finance` → `sf2-stack`. Os arquivos próprios foram confrontados com os blobs publicados. W22 `cfbf7c824d4351431d35533dbe2572de11084b9d` acrescentou depois um diagnóstico no fixture current-choice-lifecycle; seus bytes e sua execução são separados deste snapshot W21. O blob de current-choice-lifecycle neste mapa permanece `5b754d16c5d61764bffc8268075fbd4551dd2072`; o diagnóstico W22 tem blob `a8b72e8c30d6e365c77169e53d499dc163530318`.

O mapa incorpora W19/W20/W21 e o intake PR40 `2bf0197c5d607b43063c36e1c8fef9e769c716ca`. A via C17 histórica foi reinspecionada nos bytes COMPOSE6 `35b9fd4f532abeb1058f00281d4ad8885ca9966f`; o JSON conserva o pin de cada fonte externa, inclusive observações históricas COMPOSE5 que não foram relidas. O pin interface informado é `0c3d98dd1263a305ce294c78ad5939cdda110a78`. [external-reconciliation.json](external-reconciliation.json), [external-reconciliation.md](external-reconciliation.md) e [remote-reconciliation.json](remote-reconciliation.json) registram a reconciliação dos owners.

## Cobertura do mapa

| WP | Tarefas | Critérios locais | Critérios herdados do WP | Critérios únicos |
| --- | ---: | ---: | ---: | ---: |
| WP03 | 5 | 92 | 20 | 112 |
| WP05 | 5 | 81 | 27 | 108 |
| WP11 | 4 | 65 | 18 | 83 |
| Total | 14 | 238 | 65 | 303 |

Os 303 IDs e textos aparecem uma única vez no catálogo abaixo. Cada tarefa referencia seus critérios diretos e herda os critérios gerais do WP. As 545 associações tarefa–critério não são novos requisitos nem aprovações.

[task-delivery-map.json](task-delivery-map.json) contém os 14 objetos completos de tarefa, contratos herdados, bindings imutáveis, paths e hashes. [task-obligations.json](task-obligations.json) preserva o pacote literal de trabalho. Os mapas criteria.json continuam sendo a referência das observações e limites por ID.

## Como ler a evidência

Existência do produtor, consumidor localizado, teste autorado, resultado Actions, mount instalado e prova residente/nativa são níveis separados. Os testes por tarefa são candidatos afetados; sua listagem não atribui passagem. [product-tests.json](product-tests.json) guarda W/S/run e resultados; [hosted-checks.json](hosted-checks.json) guarda typecheck/guards; [reviews/manifest.json](reviews/manifest.json) guarda revisões pinadas. Uma observação de arquivo não quita todos os ramos de um critério.

S12, run [43587138878](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43587138878), executou W18: os nove casos de reconciliação de recibos passaram, mas a seleção completa terminou com 17 pass/5 fail. O JSON fixa o arquivo, cases, W/S e hash do log. Isso não qualifica os novos testes W19 nem os fixtures corrigidos W21.

S11, run [43586902727](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43586902727), teve 4 pass/1 fail e uma asserção após timeout: total 250000 esperado, null recebido. O fixture confirmava apenas novembro. W21 fornece o calendário sintético inteiro e fortalece as assertions antes do BI; a conclusão posterior fica no ledger central. O timeout de 180000 ms não foi ampliado e o risco de duração permanece registrado.

As seleções em andamento não têm conclusão congelada aqui. Campos históricos como PRODUCER_VERIFIED não são promovidos a aceite do head atual. Fonte publicada e revisão estática não substituem Actions nem prova instalada.

## Avanços próprios desde o mapa W18

| Incremento | Commit | Escopo observado em fonte |
| --- | --- | --- |
| W19 | `d9b84003ed6cd6dd77b5738dbfcc6b45d57f72c8` | Intake atual PR40, jornada humana ChoiceRecord→preparo→revisão→aplicação e fixtures scoped de C17/renovação. |
| W20 | `5e4c2b288665113e58162a616a9965c03e397e19` | Proof canônico na promoção sem operações; snapshot Dashboard no draft Hot Topic; regressões e revisão independente. |
| W21 | `8d065831356e8a73cfd0e4fbb072c5041b95d05f` | Calendário confirmado da cotação; nova admissão após revogação; CAS atual no restore. Assertions reforçadas. |

Ver [intake-reconciliation-pr40-latest.json](intake-reconciliation-pr40-latest.json), [fixture-corrections-s11-s12.json](fixture-corrections-s11-s12.json) e [published-increments.json](published-increments.json). Nenhum resultado upstream foi transferido ao grupo por ancestralidade.

## Obrigações herdadas

### WP03

Contratos lidos: `C01`, `C02`, `C03`, `C04`, `C08`, `C15`, `C16`, `C17`. Contratos fornecidos: `C02`, `C03`, `C04`, `C16`.

IDs herdados por todas as tarefas do WP: `WP03.DOD.01`, `WP03.DOD.02`, `WP03.DOD.03`, `WP03.DOD.10`, `WP03.INV.01`, `WP03.INV.02`, `WP03.INV.03`, `WP03.INV.10`, `WP03.QLT.01`, `WP03.QLT.02`, `WP03.QLT.03`, `WP03.QLT.10`, `WP03.CMP.01`, `WP03.CMP.02`, `WP03.CMP.03`, `WP03.CMP.10`, `WP03.SUC.01`, `WP03.SUC.02`, `WP03.SUC.03`, `WP03.SUC.10`.

### WP05

Contratos lidos: `C01`, `C02`, `C08`, `C09`, `C10`, `C13`, `C14`, `C15`, `C16`, `C17`. Contratos fornecidos: `C08`, `C01`, `C16`.

IDs herdados por todas as tarefas do WP: `WP05.DOD.01`, `WP05.DOD.02`, `WP05.DOD.03`, `WP05.DOD.04`, `WP05.DOD.20`, `WP05.DOD.10`, `WP05.INV.01`, `WP05.INV.02`, `WP05.INV.03`, `WP05.INV.20`, `WP05.INV.10`, `WP05.QLT.01`, `WP05.QLT.02`, `WP05.QLT.03`, `WP05.QLT.20`, `WP05.QLT.10`, `WP05.CMP.01`, `WP05.CMP.02`, `WP05.CMP.03`, `WP05.CMP.04`, `WP05.CMP.20`, `WP05.CMP.10`, `WP05.SUC.01`, `WP05.SUC.02`, `WP05.SUC.03`, `WP05.SUC.20`, `WP05.SUC.10`.

### WP11

Contratos lidos: `C01`, `C02`, `C03`, `C06`, `C08`, `C10`, `C15`, `C16`, `C17`. Contratos fornecidos: `C09`, `C12`, `C10`, `C16`.

IDs herdados por todas as tarefas do WP: `WP11.DOD.01`, `WP11.DOD.02`, `WP11.DOD.20`, `WP11.DOD.10`, `WP11.INV.01`, `WP11.INV.02`, `WP11.INV.20`, `WP11.INV.10`, `WP11.QLT.01`, `WP11.QLT.02`, `WP11.QLT.20`, `WP11.QLT.10`, `WP11.CMP.01`, `WP11.CMP.20`, `WP11.CMP.10`, `WP11.SUC.01`, `WP11.SUC.20`, `WP11.SUC.10`.

## Tarefas e consumidores

Os paths abaixo são relativos a modules/sucafina/Sucafinav1/, exceto os iniciados por apps/ ou modules/. O JSON registra os blobs de todos os fontes e testes, com origem própria ou externa explícita.

### WP03.T01 — Publicar projeções e adapter financeiro puros

Projeções, comandos e simulações usam o domínio Planner; capacidades e consumidores recebem os valores e qualificadores canônicos. Ausência, zero e FX preservam estados distintos.

**Implementação própria:** `product/planner/adapter.ts`, `product/planner/port.ts`, `product/planner/scenario-port.ts`, `product/planner/capabilities.ts`, `product/planner/actual-presence.ts`, `product/planner/persistence.ts`.

**Consumo observado:** createPlannerProduct compõe porta e emissor; business-services constrói esse produto com fontes escopadas, contexto e cobertura. A fábrica de BI usa suas projeções, sem refazer dinheiro.

Consumidores próprios: `product/planner/product.ts`, `product/analytics/planner.ts`, `product/analytics/planner-projected.ts`.

Fontes externas lidas: `apps/cli/src/sucafina-product/business-services.ts`.

**Testes candidatos afetados:** `test/product/wp03/adapter.test.ts`, `test/product/wp03/port.test.ts`, `test/product/wp03/capability-parity.test.ts`, `test/product/wp03/scenario-qualification.test.ts`.

**Critérios diretos (21):** `WP03.T01.DOD.01`, `WP03.T01.DOD.02`, `WP03.T01.DOD.18`, `WP03.T01.INV.01`, `WP03.T01.INV.02`, `WP03.T01.INV.03`, `WP03.T01.INV.18`, `WP03.T01.QLT.01`, `WP03.T01.QLT.02`, `WP03.T01.QLT.18`, `WP03.T01.CMP.01`, `WP03.T01.CMP.02`, `WP03.T01.CMP.18`, `WP03.T01.SUC.01`, `WP03.T01.SUC.02`, `WP03.T01.SUC.18`, `WP03.T01.CHK.01`, `WP03.T01.CHK.02`, `WP03.T01.CHK.03`, `WP03.T01.CHK.04`, `WP03.T01.CHK.18`.

Herda também os 20 critérios gerais de `WP03`; total de 41 associações.

**Pendências precisas:**

- Demonstrar UI/native/MCP residente com a mesma autoridade e os descritores C16 no candidato composto; teste de dispatcher em fixture não cobre essa cadeia.
- Conservar a paridade integral das sete páginas e as recusas de acesso/lock/referência nos consumidores instalados.

### WP03.T02 — Entregar edição mensal e linhas OPEX/CAPEX previsíveis

Grade mensal e host próprio usam preview e comando canônicos. A qualificação de cenários preserva ausência nos meses não endereçados, incluindo normalização incidental de linhas e deslocamento de valores.

**Implementação própria:** `product/planner/monthly-grid.ts`, `product/planner/monthly-edit.ts`, `product/planner/monthly-host.ts`, `product/planner/adapter.ts`, `runtime/planner.ts`.

**Consumo observado:** runtime/planner.ts monta renderMonthlyGrid em OPEX/CAPEX; monthly-host consome a grade e o domínio. A extensão do cliente e contrato mensal permanece uma proposta delimitada para os owners. Os consumidores externos reais são product/interface/planner-http.ts e product/ui/planner-monthly.ts; seus blobs foram conferidos no pin interface0c3d98. O contrato mensal foi conferido em COMPOSE6; os três permanecem sem o delta proposto.

Consumidores próprios: `product/planner/monthly-host.ts`, `runtime/planner.ts`.

Fontes externas lidas: `product/interface/planner-http.ts`, `product/ui/planner-monthly.ts`, `product/contracts/host-context.ts`.

**Testes candidatos afetados:** `test/product/wp03/monthly-grid.test.ts`, `test/product/wp03/monthly-host.test.ts`, `test/product/wp03/monthly-operations.test.ts`, `test/product/wp03/resume-ui-host-boundaries.test.ts`, `test/product/wp03/scenario-qualification.test.ts`.

**Critérios diretos (17):** `WP03.T02.DOD.01`, `WP03.T02.DOD.02`, `WP03.T02.INV.01`, `WP03.T02.INV.02`, `WP03.T02.INV.03`, `WP03.T02.QLT.01`, `WP03.T02.QLT.02`, `WP03.T02.CMP.01`, `WP03.T02.CMP.02`, `WP03.T02.SUC.01`, `WP03.T02.SUC.02`, `WP03.T02.SUC.03`, `WP03.T02.CHK.01`, `WP03.T02.CHK.02`, `WP03.T02.CHK.03`, `WP03.T02.CHK.04`, `WP03.T02.CHK.05`.

Herda também os 20 critérios gerais de `WP03`; total de 37 associações.

**Pendências precisas:**

- Reconciliar e aplicar o patch mensal de três arquivos no owner: before/after canônicos, annual/spread/reset e rebase explícito de conflito.
- Provar o mount preservando drafts não editados, retomada, body/key estáveis no retry incerto, revogação e qualificação dos meses não tocados.

### WP03.T03 — Entregar planejamento de pessoas e premissas de HR

Projeção de posições, rates, reajustes e meses HR conserva ausência, actual e forecast. O BI recebe FTE e custo em painéis alinhados com acesso definido pelo produtor.

**Implementação própria:** `product/planner/headcount.ts`, `product/planner/headcount-host.ts`, `product/planner/headcount-months.ts`, `product/planner/port.ts`, `product/planner/bi.ts`.

**Consumo observado:** headcount-host consulta projectHeadcount antes e depois do comando; a composição BI04 usa plannerCapacityPresentation sobre a projeção candidata do Planner.

Consumidores próprios: `product/planner/headcount-host.ts`, `product/analytics/planner-projected.ts`.

Fontes externas lidas: `apps/cli/src/sucafina-product/bi-services.ts`.

**Testes candidatos afetados:** `test/product/wp03/headcount-projection.test.ts`, `test/product/wp03/headcount-host.test.ts`, `test/product/wp03/port-hr.test.ts`, `test/product/wp05/capacity-numeric.test.ts`.

**Critérios diretos (16):** `WP03.T03.DOD.01`, `WP03.T03.DOD.02`, `WP03.T03.INV.01`, `WP03.T03.INV.02`, `WP03.T03.INV.03`, `WP03.T03.QLT.01`, `WP03.T03.QLT.02`, `WP03.T03.CMP.01`, `WP03.T03.CMP.02`, `WP03.T03.SUC.01`, `WP03.T03.SUC.02`, `WP03.T03.CHK.01`, `WP03.T03.CHK.02`, `WP03.T03.CHK.03`, `WP03.T03.CHK.04`, `WP03.T03.CHK.05`.

Herda também os 20 critérios gerais de `WP03`; total de 36 associações.

**Pendências precisas:**

- Demonstrar manutenção de HR, roster, rate cards e recusas nos papéis reais do produto instalado.
- Validar privacidade salarial e granularidade no mount; FTE planejado não prova disponibilidade real nem todos os fluxos de edição de HR.

### WP03.T04 — Entregar FX e cadastros com escopo explícito

Catálogos, FX e composição cambial têm host próprio e previews que consomem os comandos do domínio, com escopo de versão e ausência explícitos.

**Implementação própria:** `product/planner/catalogs.ts`, `product/planner/catalog-host.ts`, `product/planner/port.ts`, `product/planner/adapter.ts`.

**Consumo observado:** createPlannerCatalogHost consome plannerCatalogs/previewPlannerCatalog; previews reutilizam domain.execute. O envelope examinado não fornece prova de montagem de todos os catálogos.

Consumidores próprios: `product/planner/catalog-host.ts`.

**Testes candidatos afetados:** `test/product/wp03/catalog-boundaries.test.ts`, `test/product/wp03/catalog-lifecycle.test.ts`, `test/product/wp03/catalog-host.test.ts`, `test/product/wp03/resume-ui-host-boundaries.test.ts`.

**Critérios diretos (16):** `WP03.T04.DOD.01`, `WP03.T04.DOD.02`, `WP03.T04.INV.01`, `WP03.T04.INV.02`, `WP03.T04.INV.03`, `WP03.T04.QLT.01`, `WP03.T04.QLT.02`, `WP03.T04.CMP.01`, `WP03.T04.CMP.02`, `WP03.T04.SUC.01`, `WP03.T04.SUC.02`, `WP03.T04.CHK.01`, `WP03.T04.CHK.02`, `WP03.T04.CHK.03`, `WP03.T04.CHK.04`, `WP03.T04.CHK.05`.

Herda também os 20 critérios gerais de `WP03`; total de 36 associações.

**Pendências precisas:**

- Demonstrar criação/edição/remoção, unicidade, referências em uso, versão selecionada e locks no consumidor instalado.
- Preservar USD=1, FX ausente e allocations como classificação; não introduzir política cambial ou de rateio para completar a UI.

### WP03.T05 — Entregar Overview e comparação explicável entre versões

Overview, versões e comparação A/B expõem valores reconciliáveis. O batch agrupa irmãos somente na mesma observação e mantém fases independentes, reautorização e releituras de resultados/fontes.

**Implementação própria:** `product/planner/overview.ts`, `product/planner/overview-host.ts`, `product/planner/versions-host.ts`, `product/planner/version-comparison.ts`, `product/planner/scenario-comparison-port.ts`, `product/planner/bi-difference.ts`, `product/planner/stored-scenarios.ts`, `product/planner/sensitivity-units.ts`.

**Consumo observado:** createPlannerProduct compõe versions/overview; BI02/BI03 recebe seleção A/B e plannerDifferencePresentation. O wrapper C17 mantém ancestry por chamada. COMPOSE6 compõe o reader histórico privado por evento do ledger, com capture Atlas protegido prévio, fechamento somente de registros atuais, replay canônico e continuidade BCS. Essa implementação é distinta da leitura corrente estrita; não demonstra execução instalada.

Consumidores próprios: `product/planner/product.ts`, `product/planner/capabilities.ts`, `product/analytics/planner-projected.ts`.

Fontes externas lidas: `apps/cli/src/sucafina-product/bi-services.ts`, `apps/cli/src/sucafina-product/extended-http.ts`, `apps/cli/src/sucafina-product/planner-calculation-services.ts`, `apps/cli/src/sucafina-product/planner-calculation-history.ts`.

**Testes candidatos afetados:** `test/product/wp03/runtime-overview-presence.test.ts`, `test/product/wp03/versions-host.test.ts`, `test/product/wp03/persistence-comparison.test.ts`, `test/product/wp03/scenario-capability-parity.test.ts`, `test/product/wp03/composed-threshold.test.ts`, `test/product/wp11/scenario-batch.test.ts`, `test/product/wp03/resume-engine-freshness.test.ts`.

**Critérios diretos (22):** `WP03.T05.DOD.01`, `WP03.T05.DOD.02`, `WP03.T05.DOD.18`, `WP03.T05.INV.01`, `WP03.T05.INV.02`, `WP03.T05.INV.03`, `WP03.T05.INV.18`, `WP03.T05.QLT.01`, `WP03.T05.QLT.02`, `WP03.T05.QLT.18`, `WP03.T05.CMP.01`, `WP03.T05.CMP.02`, `WP03.T05.CMP.18`, `WP03.T05.SUC.01`, `WP03.T05.SUC.02`, `WP03.T05.SUC.18`, `WP03.T05.CHK.01`, `WP03.T05.CHK.02`, `WP03.T05.CHK.03`, `WP03.T05.CHK.04`, `WP03.T05.CHK.05`, `WP03.T05.CHK.18`.

Herda também os 20 critérios gerais de `WP03`; total de 42 associações.

**Pendências precisas:**

- Demonstrar seleção original, engine/versão/contexto e referências A/B no mount com retorno de foco/filtros.
- Concluir validação dos cenários antes lentos no pin apropriado; contagens menores não substituem o resultado do teste financeiro.
- Validar a via histórica COMPOSE6 no candidato composto com as cercas finais próprias: capture prévio, ledger/caso corrente, horizonte, origem, incarnação e revogação. Cálculo aninhado histórico, assumptions, replacement e fonte materialmente alterada permanecem fora do fechamento implementado.

### WP05.T01 — Trajetória financeira e waterfall de cenários

Trajetória e waterfall Planner renderizam os planos, valores, reconciliação e fontes publicados pelo produtor. Marcas de zero mantêm representação e referência.

**Implementação própria:** `product/analytics/planner.ts`, `product/analytics/planner-projected.ts`, `product/analytics/waterfall.ts`, `product/analytics/view.ts`, `product/analytics/projection.ts`, `product/analytics/factory.ts`.

**Consumo observado:** A fábrica CLI compõe BI01/BI02 e extended-http chama dispatchPresentation. No COMPOSE6 reinspecionado, o host já inclui as rotas estendidas além do antigo handler Dashboard. O plano de decisão BI09 é uma dependência diferente do waterfall Planner BI02.

Consumidores próprios: `product/analytics/factory.ts`, `product/analytics/capabilities.ts`.

Fontes externas lidas: `apps/cli/src/sucafina-product/bi-services.ts`, `apps/cli/src/sucafina-product/extended-http.ts`.

**Testes candidatos afetados:** `test/product/wp05/planner-integration.test.ts`, `test/product/wp05/waterfall.test.ts`, `test/product/wp05/planner-projected.test.ts`, `test/product/wp05/projection-validation.test.ts`.

**Critérios diretos (15):** `WP05.T01.DOD.01`, `WP05.T01.DOD.02`, `WP05.T01.INV.01`, `WP05.T01.INV.02`, `WP05.T01.QLT.01`, `WP05.T01.QLT.02`, `WP05.T01.CMP.01`, `WP05.T01.CMP.02`, `WP05.T01.SUC.01`, `WP05.T01.SUC.02`, `WP05.T01.CHK.01`, `WP05.T01.CHK.02`, `WP05.T01.CHK.03`, `WP05.T01.CHK.04`, `WP05.T01.CHK.05`.

Herda também os 27 critérios gerais de `WP05`; total de 42 associações.

**Pendências precisas:**

- Provar no mount o contexto e destino originais por marca, teclado e tabela, sem substituir o detalhe por uma coleção genérica.
- Preservar a investigação do stall de inspeção/teardown observado: uma execução diagnóstica que não o reproduz não comprova sua causa.

### WP05.T02 — Contribuições divergentes e FTE/custo alinhados

Contribuições conservam as duas origens A/B; o chooser exige uma origem explícita. FTE e custo usam escalas distintas e alinhadas. O retorno de foco confere visibilidade e activeElement.

**Implementação própria:** `product/analytics/view.ts`, `product/analytics/semantics.ts`, `product/analytics/planner-projected.ts`, `product/analytics/planner.ts`, `product/analytics/source-navigation.ts`, `product/analytics/projection.ts`.

**Consumo observado:** A composição usa plannerDifferencePresentation para BI03 e plannerCapacityPresentation para BI04; o browser estendido envia o refDigest escolhido. Lifecycle já existe no pin examinado.

Consumidores próprios: `product/analytics/view.ts`, `product/analytics/consumer.ts`.

Fontes externas lidas: `apps/cli/src/sucafina-product/bi-services.ts`, `apps/cli/src/sucafina-product/extended-bi-browser.ts`.

**Testes candidatos afetados:** `test/product/wp05/contributions-browser.test.ts`, `test/product/wp05/capacity-numeric.test.ts`, `test/product/wp05/planner-origins.test.ts`, `test/product/wp05/consumer.test.ts`.

**Critérios diretos (15):** `WP05.T02.DOD.01`, `WP05.T02.DOD.02`, `WP05.T02.INV.01`, `WP05.T02.INV.02`, `WP05.T02.QLT.01`, `WP05.T02.QLT.02`, `WP05.T02.CMP.01`, `WP05.T02.CMP.02`, `WP05.T02.SUC.01`, `WP05.T02.SUC.02`, `WP05.T02.CHK.01`, `WP05.T02.CHK.02`, `WP05.T02.CHK.03`, `WP05.T02.CHK.04`, `WP05.T02.CHK.05`.

Herda também os 27 critérios gerais de `WP05`; total de 42 associações.

**Pendências precisas:**

- Demonstrar escala, filtros, referência escolhida e retorno de foco no mount atual com refresh e revogação.
- Conservar privacidade e granularidade autorizadas pelo produtor; não ampliar dados pessoais para preencher um gráfico.

### WP05.T03 — Estoque por etapa e aging de Procurement

Estoque por etapa e aging preservam identidade de pedido, ausência da idade e contexto. A apresentação distingue estoque corrente de coorte ou conversão.

**Implementação própria:** `product/analytics/procurement.ts`, `product/analytics/view.ts`, `product/analytics/semantics.ts`, `product/analytics/factory.ts`, `product/analytics/source-navigation.ts`.

**Consumo observado:** BI05/BI06 recebe business.procurement.list. O adapter não duplica a idade calculada pelo domínio e mantém referencias por pedido.

Consumidores próprios: `product/analytics/factory.ts`, `product/analytics/consumer.ts`.

Fontes externas lidas: `apps/cli/src/sucafina-product/bi-services.ts`, `product/integration/procurement-projections.ts`, `product/procurement/source-projection.ts`.

**Testes candidatos afetados:** `test/product/wp05/procurement-stages.test.ts`, `test/product/wp05/procurement-integration.test.ts`, `test/product/wp05/aging-browser.test.ts`, `test/product/wp05/semantic-discriminants.test.ts`.

**Critérios diretos (15):** `WP05.T03.DOD.01`, `WP05.T03.DOD.02`, `WP05.T03.INV.01`, `WP05.T03.INV.02`, `WP05.T03.QLT.01`, `WP05.T03.QLT.02`, `WP05.T03.CMP.01`, `WP05.T03.CMP.02`, `WP05.T03.SUC.01`, `WP05.T03.SUC.02`, `WP05.T03.CHK.01`, `WP05.T03.CHK.02`, `WP05.T03.CHK.03`, `WP05.T03.CHK.04`, `WP05.T03.CHK.05`.

Herda também os 27 critérios gerais de `WP05`; total de 42 associações.

**Pendências precisas:**

- Validar o produtor Procurement atual e o destino autorizado de cada pedido no candidato composto.
- Manter idade indisponível como ausência; não criar SLA, histórico de coorte ou valor zero para preencher lacuna.

### WP05.T04 — Tickets, agenda de marcos e catálogo consumível de BI

Tickets, marcos e catálogo têm apresentações explícitas e consumidor de seleção C17. O destino próprio reabre e confere a projeção, a referência e a autoridade.

**Implementação própria:** `product/analytics/dashboard.ts`, `product/analytics/tickets.ts`, `product/analytics/milestones.ts`, `product/analytics/catalog.ts`, `product/analytics/capabilities.ts`, `product/analytics/consumer.ts`.

**Consumo observado:** A fábrica CLI compõe BI01/BI07/BI08. A rota estendida valida valueId/refDigest contra o valor autorizado e relê a projeção; o browser constrói essa seleção.

Consumidores próprios: `product/analytics/factory.ts`, `product/analytics/capabilities.ts`, `product/analytics/consumer.ts`.

Fontes externas lidas: `apps/cli/src/sucafina-product/bi-services.ts`, `apps/cli/src/sucafina-product/extended-http.ts`, `apps/cli/src/sucafina-product/extended-bi-browser.ts`.

**Testes candidatos afetados:** `test/product/wp05/tickets-integration.test.ts`, `test/product/wp05/dashboard-integration.test.ts`, `test/product/wp05/milestones.test.ts`, `test/product/wp05/approved-catalog.test.ts`.

**Critérios diretos (22):** `WP05.T04.DOD.01`, `WP05.T04.DOD.02`, `WP05.T04.DOD.18`, `WP05.T04.INV.01`, `WP05.T04.INV.02`, `WP05.T04.INV.18`, `WP05.T04.QLT.01`, `WP05.T04.QLT.02`, `WP05.T04.QLT.18`, `WP05.T04.CMP.01`, `WP05.T04.CMP.02`, `WP05.T04.CMP.18`, `WP05.T04.SUC.01`, `WP05.T04.SUC.02`, `WP05.T04.SUC.18`, `WP05.T04.CHK.01`, `WP05.T04.CHK.02`, `WP05.T04.CHK.03`, `WP05.T04.CHK.04`, `WP05.T04.CHK.05`, `WP05.T04.CHK.06`, `WP05.T04.CHK.18`.

Herda também os 27 critérios gerais de `WP05`; total de 49 associações.

**Pendências precisas:**

- Demonstrar tickets/marcos incluindo undated, seleção original, teclado/tabela e foco no mount de todos os oito gráficos.
- A correção do produtor undated em outro owner requer prova no bundle correspondente; a falha histórica não é diagnóstico do source atual nem um outro green fecha esse caso.

### WP05.T05 — Entregar BI de consequência e sensibilidade

Cenários, comparações e sensibilidade são lidos de stores com caseRef, digests e fontes. A vantagem usa comparação inversa persistida e conserva estado/valor do produtor, sem negar ou subtrair localmente. W21 corrige apenas a cotação sintética pontual: novembro 40000 e os outros onze meses explicitamente zero pelo comando OPEX. As assertions exigem o calendário confirmado e o resultado canônico antes da leitura BI.

**Implementação própria:** `product/analytics/stored-scenario.ts`, `product/analytics/scenario.ts`, `product/analytics/portfolio.ts`, `product/analytics/decision-view.ts`, `product/analytics/advantage-view.ts`, `product/analytics/projection.ts`.

**Consumo observado:** A fábrica CLI monta cenários BI09/10/11 e portfólio BI09/10. decisionPresentation ainda publica series vazias e limitações para planos waterfall/timeline de decisão. O parser e a igualdade de seleção reinspecionados em COMPOSE6 ainda não transportam advantageComparisonRef; a proposta exata fica no handoff externo.

Consumidores próprios: `product/analytics/factory.ts`, `product/analytics/decision-view.ts`.

Fontes externas lidas: `apps/cli/src/sucafina-product/bi-services.ts`, `apps/cli/src/sucafina-product/bi-selections.ts`, `product/portfolio/planner-sensitivity.ts`, `product/portfolio/verification.ts`, `product/portfolio/threshold-proof.ts`, `product/portfolio/sensitivity.ts`.

**Testes candidatos afetados:** `test/product/wp05/choice-history-bi.test.ts`, `test/product/wp05/engine-coverage.test.ts`, `test/product/wp05/stored-bi-fences.test.ts`, `test/product/wp05/sensitivity-integration.test.ts`.

Suporte de fixtures, com fronteiras sintéticas declaradas: `test/product/wp11/renewal-choice-fixture.ts`, `test/product/wp11/renewal-source-fixture.ts`, `test/product/wp11/renewal-coverage-fixture.ts`, `test/product/wp11/renewal-operation-verifier.ts`, `test/product/wp11/renewal-restart-reader.ts`, `test/product/wp11/fixture-trace.ts`.

**Critérios diretos (14):** `WP05.T05.DOD.01`, `WP05.T05.DOD.20`, `WP05.T05.INV.01`, `WP05.T05.INV.20`, `WP05.T05.QLT.01`, `WP05.T05.QLT.20`, `WP05.T05.CMP.01`, `WP05.T05.CMP.20`, `WP05.T05.SUC.01`, `WP05.T05.SUC.20`, `WP05.T05.CHK.01`, `WP05.T05.CHK.02`, `WP05.T05.CHK.03`, `WP05.T05.CHK.20`.

Herda também os 27 critérios gerais de `WP05`; total de 41 associações.

**Pendências precisas:**

- Aplicar o patch delimitado de advantageComparisonRef ao parser e à igualdade exata da seleção, usando referência realmente produzida e persistida.
- Receber planos financeiros/temporais dos produtores para BI09/10; não fabricar componentes em analytics.
- Demonstrar no consumidor instalado os thresholds persistidos/reabertos 55000/15000 e a passagem de vantagem condicionada30000 a completa−10000, sem reescrever ChoiceRecord nem aplicar simulação.

### WP11.T01 — Implementar caso durável e versionado

Casos, resultados e requests usam C08 com ator, versão, incarnação e revalidação. O caminho histórico próprio exige referência integral e evento persistido do ledger do caso corrente; consultas correntes permanecem estritas. W21 corrige as provas: nova admissão consumida após revogação, mantendo a anterior recusada, e restore no CAS do dataset 2 após delete, mantendo stale 1 recusado.

**Implementação própria:** `product/decisions/case-management.ts`, `product/decisions/case-port.ts`, `product/decisions/capabilities.ts`, `product/decisions/result-store.ts`, `product/decisions/scenario-request-store.ts`, `product/decisions/calculation-history.ts`.

**Consumo observado:** business-services compõe cases/result-store; Planner e BI consomem resultados persistidos. COMPOSE6 compõe o reader histórico privado por evento do ledger, com capture Atlas protegido prévio, fechamento somente de registros atuais, replay canônico e continuidade BCS. Essa implementação é distinta da leitura corrente estrita; não demonstra execução instalada.

Consumidores próprios: `product/decisions/product.ts`, `product/decisions/http.ts`, `product/planner/stored-scenarios.ts`, `product/analytics/stored-scenario.ts`.

Fontes externas lidas: `apps/cli/src/sucafina-product/business-services.ts`, `apps/cli/src/sucafina-product/planner-calculation-services.ts`, `product/host-binding/business-context.ts`, `apps/cli/src/sucafina-product/planner-calculation-history.ts`.

**Testes candidatos afetados:** `test/product/wp11/case-management.test.ts`, `test/product/wp11/case-port.test.ts`, `test/product/wp11/case-authority-concurrency.test.ts`, `test/product/wp11/case-import-incarnation.test.ts`, `test/product/wp11/http.test.ts`, `test/product/wp11/calculation-history.test.ts`, `test/product/wp11/calculation-persistence.test.ts`.

Suporte de fixtures, com fronteiras sintéticas declaradas: `test/product/wp11/fixture-trace.ts`.

**Critérios diretos (14):** `WP11.T01.DOD.01`, `WP11.T01.DOD.18`, `WP11.T01.INV.01`, `WP11.T01.INV.18`, `WP11.T01.QLT.01`, `WP11.T01.QLT.18`, `WP11.T01.CMP.01`, `WP11.T01.CMP.18`, `WP11.T01.SUC.01`, `WP11.T01.SUC.18`, `WP11.T01.CHK.01`, `WP11.T01.CHK.02`, `WP11.T01.CHK.03`, `WP11.T01.CHK.18`.

Herda também os 18 critérios gerais de `WP11`; total de 32 associações.

**Pendências precisas:**

- Demonstrar criação/reabertura em identidades reais e equivalência UI/native/MCP via mesma capacidade, sem confundir store temporário com instalação residente.
- Validar a via histórica COMPOSE6 no candidato composto com as cercas finais próprias: capture prévio, ledger/caso corrente, horizonte, origem, incarnação e revogação. Cálculo aninhado histórico, assumptions, replacement e fonte materialmente alterada permanecem fora do fechamento implementado.
- Qualificar o replay C17 aninhado e seu desempenho no candidato correto; preservar a medição e os timeouts observados.

### WP11.T02 — Estruturar alternativas e premissas comparáveis

Alternativas consomem simulação WP03 e inventário C10. Ausência de categoria deriva missing-category; included/shared/N/A/pending conservam referências e não duplicam parcelas. Fontes confirmadas e previews hipotéticos têm estados diferentes. W20 sempre solicita entries/proof do provider presente e usa o reassessment canônico mesmo quando o assessment coincide; a promoção sem operações continua cercada pelo snapshot e pela autoridade.

**Implementação própria:** `product/decisions/proposals.ts`, `product/decisions/cost-coverage.ts`, `product/decisions/coverage-access.ts`, `product/decisions/proposal-coverage.ts`, `product/decisions/alternative-replay.ts`, `product/decisions/composite-planner.ts`, `product/decisions/coverage-interval.ts`, `product/decisions/result-store.ts`, `product/decisions/mutations.ts`, `product/decisions/analysis-promotion.ts`.

**Consumo observado:** A composição manual fornece propostas e captura privada de seleção. O consumidor WP13 reinspecionado em COMPOSE6 usa parâmetro source-only e certificado do domínio; seu resultado persistido ainda exige prova no candidato. O gate de classificação N/A do host merece validação específica, sem inferir fechamento a partir do core C10.

Consumidores próprios: `product/decisions/product.ts`, `product/planner/scenario-comparison-port.ts`, `product/planner/sensitivity-units.ts`, `product/analytics/stored-scenario.ts`.

Fontes externas lidas: `apps/cli/src/sucafina-product/decision-alternative-services.ts`, `apps/cli/src/sucafina-product/decision-proposal-services.ts`, `product/portfolio/planner-sensitivity.ts`, `product/portfolio/verification.ts`, `apps/cli/src/sucafina-product/portfolio-coverage.ts`, `product/portfolio/threshold-proof.ts`, `product/portfolio/sensitivity.ts`.

**Testes candidatos afetados:** `test/product/wp11/composite-coverage.test.ts`, `test/product/wp11/coverage-access.test.ts`, `test/product/wp11/proposal-coverage.test.ts`, `test/product/wp11/analysis-promotion.test.ts`, `test/product/wp11/renewal-implementation-quote.test.ts`, `test/product/wp11/renewal-choice-revision.test.ts`, `test/product/wp03/composed-threshold.test.ts`, `test/product/wp11/source-promotion-coverage.test.ts`, `test/product/wp11/renewal-choice-history.test.ts`.

Suporte de fixtures, com fronteiras sintéticas declaradas: `test/product/wp11/renewal-choice-fixture.ts`, `test/product/wp11/renewal-source-fixture.ts`, `test/product/wp11/renewal-coverage-fixture.ts`, `test/product/wp11/renewal-operation-verifier.ts`, `test/product/wp11/renewal-restart-reader.ts`, `test/product/wp11/fixture-trace.ts`.

**Critérios diretos (21):** `WP11.T02.DOD.01`, `WP11.T02.DOD.20`, `WP11.T02.DOD.18`, `WP11.T02.INV.01`, `WP11.T02.INV.20`, `WP11.T02.INV.18`, `WP11.T02.QLT.01`, `WP11.T02.QLT.20`, `WP11.T02.QLT.18`, `WP11.T02.CMP.01`, `WP11.T02.CMP.20`, `WP11.T02.CMP.18`, `WP11.T02.SUC.01`, `WP11.T02.SUC.20`, `WP11.T02.SUC.18`, `WP11.T02.CHK.01`, `WP11.T02.CHK.02`, `WP11.T02.CHK.03`, `WP11.T02.CHK.20`, `WP11.T02.CHK.21`, `WP11.T02.CHK.18`.

Herda também os 18 critérios gerais de `WP11`; total de 39 associações.

**Pendências precisas:**

- Demonstrar todos os consumidores nomeados com o mesmo resultado/coverageRef, incluindo a classificação humana N/A evidenciada no host e AlternativeDraft com captura privada válida. O provider baseline portfolio-coverage de COMPOSE6 ainda recusa entradas not-applicable; o fix próprio de proof não relaxa esse gate.
- Validar composição, solver e persistência/replay conjuntamente: 55000 e 15000, categoria totalmente omitida, zero confirmado, null/FX ausente, shared sem dupla contagem e fonte revogada.
- Não usar a confirmação de subtotal ou limiar para promover coverage completa ou hipótese a compromisso.

### WP11.T03 — Registrar escolha humana e preparar mudanças

Escolha humana conserva snapshot e razão; nova escolha/justificativa acrescenta histórico. Prévia corrente e promoção são passos humanos separados com proveniência privada. Divergência entre premissa declarada e fonte oficial permanece visível. Rejeição só cancela proposta ainda sem tentativa/recibo. W20 seleciona Dashboard para validar o draft de Hot Topic. A jornada nova choice-prepared-execution encadeia ChoiceRecord persistido, preparo, revisão e aplicação sob concessões separadas; foi incorporada em W19 e requer seu próprio resultado Actions.

**Implementação própria:** `product/decisions/choice.ts`, `product/decisions/mutations.ts`, `product/decisions/prepared-change.ts`, `product/decisions/prepared-review.ts`, `product/decisions/current-choice-preview.ts`, `product/decisions/current-choice-promotion.ts`, `product/decisions/assumption-divergence.ts`, `product/decisions/host-product.ts`, `product/decisions/hot-topic-draft.ts`.

**Consumo observado:** As factories próprias compõem currentChoicePreview/promoteCurrentChoice e assumptionDivergence, com verifySources/observe/snapshot obrigatórios. A composição CLI manual examinada oferece preparação e propostas; não prova a montagem desses novos serviços/rotas.

Consumidores próprios: `product/decisions/product.ts`, `product/decisions/host-product.ts`, `product/decisions/http.ts`.

Fontes externas lidas: `apps/cli/src/sucafina-product/decision-change-services.ts`, `apps/cli/src/sucafina-product/decision-domain-services.ts`, `apps/cli/src/sucafina-product/decision-domain-http.ts`, `apps/cli/src/sucafina-product/dashboard-decisions.ts`.

**Testes candidatos afetados:** `test/product/wp11/choice-persistence.test.ts`, `test/product/wp11/renewal-choice-revision.test.ts`, `test/product/wp11/current-choice-lifecycle.test.ts`, `test/product/wp11/assumption-divergence.test.ts`, `test/product/wp11/prepared-rejection.test.ts`, `test/product/wp11/planner-apply.test.ts`, `test/product/wp11/http.test.ts`, `test/product/wp11/choice-prepared-execution.test.ts`, `test/product/wp11/hot-topic-draft-domain.test.ts`, `test/product/wp11/renewal-choice-history.test.ts`.

Suporte de fixtures, com fronteiras sintéticas declaradas: `test/product/wp11/renewal-choice-fixture.ts`, `test/product/wp11/renewal-source-fixture.ts`, `test/product/wp11/renewal-coverage-fixture.ts`, `test/product/wp11/renewal-operation-verifier.ts`, `test/product/wp11/renewal-restart-reader.ts`, `test/product/wp11/fixture-trace.ts`, `test/product/wp11/renewal-human-choice-fixture.ts`.

**Critérios diretos (15):** `WP11.T03.DOD.01`, `WP11.T03.DOD.18`, `WP11.T03.INV.01`, `WP11.T03.INV.18`, `WP11.T03.QLT.01`, `WP11.T03.QLT.18`, `WP11.T03.CMP.01`, `WP11.T03.CMP.18`, `WP11.T03.SUC.01`, `WP11.T03.SUC.18`, `WP11.T03.CHK.01`, `WP11.T03.CHK.02`, `WP11.T03.CHK.03`, `WP11.T03.CHK.20`, `WP11.T03.CHK.18`.

Herda também os 18 critérios gerais de `WP11`; total de 33 associações.

**Pendências precisas:**

- Montar serviços de escolha atual e divergência no host com callbacks reais de fontes/continuidade e verificações sob lock; não fornecer stubs para satisfazer a assinatura.
- Demonstrar revisão humana separada, manutenção/substituição da escolha, recusa de fonte stale/revogada e rejeição sem aplicar ou reverter domínios.
- Demonstrar o consumidor instalado preservando ChoiceRecord/subtotal/ressalva quando training = 40000 ou cotação = 70000 altera o cenário atual.

### WP11.T04 — Reconciliar recibos e retomar execução parcial

Execução reserva a tentativa durável antes do dispatch e reconcilia com recibo autoritativo. CAS renovado e fences C08 conservam caso, proof, recibo e unicidade depois dos callbacks; retry reconciliado também recebe leitura final. Ausência de recibo após tentativa fica indeterminada sem redispatch.

**Implementação própria:** `product/decisions/apply.ts`, `product/decisions/application-attempt.ts`, `product/decisions/application-status.ts`, `product/decisions/prepared-apply.ts`, `product/decisions/receipt-review-binding.ts`, `product/decisions/receipts.ts`.

**Consumo observado:** createDecisionProduct expõe apply/applicationStatus; createDecisionHttp oferece a leitura privada de status. O leitor canônico continua fonte de autoridade; snapshot é fence de consistência, sem leitura recursiva de receipt sob lock.

Consumidores próprios: `product/decisions/product.ts`, `product/decisions/http.ts`.

Fontes externas lidas: `apps/cli/src/sucafina-product/decision-change-services.ts`, `product/integration/procurement-projections.ts`, `product/procurement/source-projection.ts`.

**Testes candidatos afetados:** `test/product/wp11/execution-reconciliation.test.ts`, `test/product/wp11/application-indeterminate.test.ts`, `test/product/wp11/cross-domain-execution.test.ts`, `test/product/wp11/prepared-apply.test.ts`, `test/product/wp11/http.test.ts`, `test/product/wp11/choice-prepared-execution.test.ts`.

**Critérios diretos (15):** `WP11.T04.DOD.01`, `WP11.T04.DOD.02`, `WP11.T04.DOD.18`, `WP11.T04.INV.01`, `WP11.T04.INV.18`, `WP11.T04.QLT.01`, `WP11.T04.QLT.18`, `WP11.T04.CMP.01`, `WP11.T04.CMP.18`, `WP11.T04.SUC.01`, `WP11.T04.SUC.18`, `WP11.T04.CHK.01`, `WP11.T04.CHK.02`, `WP11.T04.CHK.03`, `WP11.T04.CHK.18`.

Herda também os 18 critérios gerais de `WP11`; total de 33 associações.

**Pendências precisas:**

- Os nove modos de reconciliação passaram em S12/W18, run43587138878, mas o run completo teve17pass/5fail. Preservar esse escopo e validar o candidato composto correspondente; o resultado não aceita o WP nem transfere prova aos novos testes de W19.
- Demonstrar Planner aplicado com Procurement conflitante no candidato composto, preservando a ordem e o estado parcial; não prometer atomicidade global. S12 falhou antes da emissão Procurement: o issuer exige approvalStage e o projector compartilhado dessa branch ainda omite esse campo; consumir a dependência canônica do owner e repetir o cenário afetado no bundle.
- Montar applicationStatus com readReceipt real e provar leitura de recibos restritos/revogação no host; tentativa persistida não é efeito aplicado.

## Oráculos preservados

Os valores e estados abaixo conservam os discriminantes aprovados; não declaram execução de todos os cenários no W21.

- Planner A/B:590000→602000, diferença+12000; variante596000, diferença+6000 contra a base e−4000 contra budget. Valores são saídas do domínio.
- AI-RENEWAL completo: referência240000; bridge60000+implantação45000+serviço105000=210000; vantagem30000; mínimo20000; fronteira real de implantação55000.
- Implantação confirmada70000: total235000, vantagem5000, abaixo do mínimo20000. Preservar componentes compartilhados, N/A evidenciado, fonte e escolha histórica.
- Training completamente omitido, sem linha pending pré-fabricada: derivar missing-category. Subtotal conhecido210000/vantagem conhecida30000 ficam condicionados; total coberto e diferença completa indisponíveis.
- No mesmo caso, training confirmado40000 produz total250000, vantagem−10000 e fronteira de implantação15000. A escolha anterior conserva subtotal210000, ressalva, fonte e versões. Training zero confirmado continua distinto de null/omitted/N/A sem evidência.
- Categorias shared reutilizam a mesma parcela sem duplicar dinheiro. N/A exige justificativa e evidência autorizadas; não é custo zero inventado. Inventário esperado não é reduzido às linhas presentes.
- Ausência não é zero observado. Qualificadores mantêm actual ausente, zero confirmado inclusive em mês aberto e FX ausente; o zero numérico legado não supre evidência. Moeda/período/origem são preservados e a política cambial não muda.
- Somente células endereçadas recebem qualificação nova; normalização incidental de outros meses não transforma ausência em estimativa zero. Defer trata origem/destino e conserva as demais lacunas.
- Actual/forecast/budget HR e permissão salarial permanecem independentes. O caso numérico de BI04 conserva FTE1/1.5 e custo10000/20000 para fevereiro/março com escalas alinhadas; não infere disponibilidade real.
- Limiar exato vem do solver/produtor, com prova de domínio e fronteira IEEE quando aplicável. Amostras não provam limiar. O certificado de subtotal conhecido pode coexistir com cobertura condicionada e não confirma a decisão inteira.
- Marca, teclado e tabela preservam valueId, contexto/período, engine/versão e referência exata. Referência escolhida deve pertencer ao valor autorizado; releitura e revogação continuam obrigatórias. Consumidor localizado não equivale a mount validado.
- Histórico exige o evento persistido e a referência C17 integral no caso corrente autorizado; não é fallback público de leitura corrente. Reabrir store e reproduzir cálculo não demonstra, por si só, BCS/Atlas/native instalados.
- AlternativeDraft conserva captura privada do run/proposta, versões e fontes verificadas. Texto de modelo, callback constante ou identidade nominal de agente não concede autoridade humana nem substitui proveniência.
- Confirmação humana de março enquanto a fonte oficial permanece maio registra a premissa e a divergência separadamente. Atualizar a fonte oficial exige comando autorizado próprio.
- Simulação não altera oficial/actual/compra. ChoiceRecord humano persistido é distinto de simulação e de aplicação. Aplicação exige revisão/grant próprios, comando do domínio e recibo autoritativo; nunca se infere do número produzido.
- Tentativa é persistida antes do dispatch. Perda de resposta consulta recibo canônico; ausência após tentativa permanece indeterminada, sem redispatch cego. Reconciliação preserva CAS atual, prova, identidade única e efeitos parciais sem promessa de transação global.

## Observações pinadas de composição e reconciliação corrente

COMPOSE6 compõe o reader histórico privado por evento do ledger, com capture Atlas protegido prévio, fechamento somente de registros atuais, replay canônico e continuidade BCS. Essa implementação é distinta da leitura corrente estrita; não demonstra execução instalada. Um primeiro append depois do avanço sem capture anterior permanece indisponível. Cálculos históricos aninhados, assumptions e replacement não são cobertos pela via. Fontes que mudaram materialmente não são reautorizadas com os bytes capturados. Ver [revisão COMPOSE6](reviews/review-compose6.md).

O host já possui fábrica/rotas estendidas de BI e ancestry por chamada. As observações históricas de Dashboard-only e guarda Map global estão superadas. Continuam delimitados: transporte advantageComparisonRef, planos de decisão BI09/10, patch mensal, prova dos serviços de escolha/divergência/status e consumidores reais de cobertura/sensibilidade. O gate baseline N/A do host não foi relaxado pelo fix próprio de promoção.

A cadeia manual decision-domain-services→decision-proposal-services→decision-alternative-services/decision-change-services é um consumidor real; sua observação COMPOSE5 não prova montagem dos novos exports. Os caminhos e pins estão no JSON. [external-reconciliation.json](external-reconciliation.json) mantém a situação atual do owner, inclusive a dependência Procurement observada no S12.
## Catálogo literal dos 303 critérios

Os textos seguintes foram comparados byte a byte como strings aos packs canônicos. Os títulos de scope são os scopes do proof map aprovado. O catálogo conserva cada requisito integral; nenhuma observação de teste foi usada para reescrever seu texto.

### WP03

- **WP03.DOD.01** — As sete páginas possuem contribuição de produto completa ou porta de composição explícita, e a matriz de paridade local aponta cada fluxo original a comportamento e prova específicos.
- **WP03.DOD.02** — Projeções e simulação financeira puras são publicadas conforme C02/C03/C04; WP05 e WP06 recebem exemplos válidos, negativos e de dados restritos, sem precisar copiar fórmulas.
- **WP03.DOD.03** — O pacote de evidências locais e o roteiro de montagem real são entregues ao WP10; aceitação integrada só pode ser declarada após consumo nos entrypoints reais.
- **WP03.DOD.10** — As entregas residentes atribuídas a WP03 têm produção, consumo e provas reais completos.
- **WP03.INV.01** — Budget, spread, flags manuais, actual, forecast, outlook, HR, FX, classificação e versões preservam a semântica do baseline 9e4f3d35833f9b2cea6abdf58f42331f3973d9bf; defeitos comprovados exigem registro de discrepância, efeito e decisão explícita antes de mudar a regra.
- **WP03.INV.02** — Papel, owner/domínio, lock, official e revisão esperada são respeitados em edição, composição, comparação e simulação; dados de remuneração não reaparecem em diferenças ou erros para usuários sem acesso.
- **WP03.INV.03** — Nenhuma hipótese altera a versão oficial por efeito colateral, nenhum pedido/contrato alimenta valores automaticamente e o adapter puro não grava estado nem executa I/O.
- **WP03.INV.10** — WP03 conserva autoridade, dados oficiais e ownership; não assume identidade técnica ou novo acesso empresarial.
- **WP03.QLT.01** — Cada total abre componentes que reconciliam com o motor; origem, versão, período e moeda permanecem explícitos, e zero observado não é confundido com ausência tratada como zero pela regra legada.
- **WP03.QLT.02** — Edição e comparação usam uma única lógica financeira; novos componentes apresentam valores e operações do domínio, sem implementar fórmulas concorrentes na UI.
- **WP03.QLT.03** — A pessoa distingue valor salvo, edição local, conflito, herança de budget e bloqueio pelo papel/estado, sem depender de códigos internos ou mensagens HTTP.
- **WP03.QLT.10** — Interfaces são concretas, versões/digests são verificáveis e falhas possuem causa e estado explícitos.
- **WP03.CMP.01** — A cobertura inclui OPEX total/breakdown, CAPEX com classificação OPEX/CAPEX, sete medidas de comparação, spread/reset, monthly budget/actual/forecast e códigos CPX.
- **WP03.CMP.02** — A cobertura inclui posições, rates, overrides, reajuste, roster, domínio manual, HR sintético/AF, FX, entidades/allocations, referências em uso e sigilo de remuneração.
- **WP03.CMP.03** — A cobertura inclui criação/cópia/ano/lock/unlock/official/delete de versões, formas legadas de dados, Overview, composição e comparação detalhada A/B.
- **WP03.CMP.10** — Todas as obrigações 5/18/8/C17 desta frente têm task, owner, paths, consumidor e negativos discriminantes.
- **WP03.SUC.01** — No cenário sintético, budget 600000, actual fechado 400000 e previsão aberta 190000 produzem outlook 590000; substituir uma premissa de 72000 por 84000 ou 78000 produz 602000 ou 596000 sem alterar budget, actual ou oficial.
- **WP03.SUC.02** — Um owner consegue salvar somente forecast autorizado; Finance mantém actual/forecast/fechamento em plano bloqueado; HR mantém premissas permitidas em plano editável; conflito preserva a entrada local.
- **WP03.SUC.03** — Os consumidores recebem projeção/simulação pelo contrato e conseguem reconciliar os resultados sem reproduzir regras financeiras.
- **WP03.SUC.10** — O consumidor integrado utiliza a saída de produção sem substituto fictício e o revisor consegue reproduzir o resultado.

### WP03.T01

- **WP03.T01.DOD.01** — As portas puras C02/C03/C04 do Planner estão exportadas e descritas com entradas, saídas, contexto e casos de rejeição.
- **WP03.T01.DOD.02** — Há prova local de paridade numérica, ausência de mutação e remoção de campos restritos, além do pacote de conformidade para WP10.
- **WP03.T01.DOD.18** — Descritores C16 de sf_forecast_compare, sf_scenario_simulate são implementados e consumidos por T06 com referências reais.
- **WP03.T01.INV.01** — Toda projeção e simulação reutiliza o cálculo e a autorização do domínio; não existe fórmula financeira paralela.
- **WP03.T01.INV.02** — Snapshot, relógio e gerador de IDs não são consultados por efeito global; dependências determinísticas seguem o contrato e a entrada original permanece intacta.
- **WP03.T01.INV.03** — Ausência permanece identificável mesmo quando a conta legada contribui zero; não se transforma informação ausente em actual confirmado.
- **WP03.T01.INV.18** — Permissões, locks, cálculos e comandos finais continuam no domínio; o transporte não cria poder novo.
- **WP03.T01.QLT.01** — Cada total publicado possui componentes suficientes para reconstruir sua soma, com versão, período, moeda e regra de origem.
- **WP03.T01.QLT.02** — Falhas e avisos identificam o registro/campo autorizado e distinguem validação, conflito e falta de permissão.
- **WP03.T01.QLT.18** — Schema fechado, ausência/falha explícitas e provenance permitem comparar UI/native/MCP.
- **WP03.T01.CMP.01** — As projeções cobrem budget, actual, forecast, outlook, comparação, HR, FTE, FX, classificação e versões legadas.
- **WP03.T01.CMP.02** — O adapter cobre comandos existentes de edição e importação sem assumir que todo ator pode consultar os mesmos campos.
- **WP03.T01.CMP.18** — Cobrir todos os exports desta task (2), caso autorizado, direto proibido, stale e indisponível.
- **WP03.T01.SUC.01** — Um consumidor calcula zero fórmulas adicionais para exibir total, composição ou impacto de comando.
- **WP03.T01.SUC.02** — Um mesmo comando inválido é rejeitado pela simulação e pela execução isolada sem qualquer mudança no snapshot de origem.
- **WP03.T01.SUC.18** — O usuário recebe a mesma capacidade e resultado pelas superfícies sem divergência ou efeitos adicionais.
- **WP03.T01.CHK.01** — Projetar e simular sobre snapshot congelado deixa snapshot, auditoria, sequências e versões originais idênticos; somente o resultado em memória contém o estado previsto.
- **WP03.T01.CHK.02** — Para o mesmo comando e contexto determinístico, simulação e execução isolada do domínio produzem os mesmos valores, flags, avisos e rejeições; nenhum componente de UI recalcula o resultado.
- **WP03.T01.CHK.03** — Versão legada em dicionário mantém IDs, valores e official por ano; uma leitura repetida não redistribui meses nem cria versão.
- **WP03.T01.CHK.04** — Usuário viewer/budget owner não recebe rates, overrides ou custos individuais em projeções, diffs ou payload de conflito; agregado permitido continua reconciliável.
- **WP03.T01.CHK.18** — Executar sf_forecast_compare, sf_scenario_simulate pela UI/native/MCP com base e autoridade iguais produz o mesmo handler, resultado e versão; chamada direta sem concessão ou após revogação é recusada pelo destino.

### WP03.T02

- **WP03.T02.DOD.01** — A grade e o detalhe contextual operam todos os fluxos OPEX/CAPEX inventariados com comandos C03 e estados locais explícitos.
- **WP03.T02.DOD.02** — Casos de branco/zero/herança, spread, papel e conflito têm provas específicas e roteiro de montagem para WP10.
- **WP03.T02.INV.01** — Apresentar forecast herdado não preenche seu armazenamento; zero digitado continua override explícito.
- **WP03.T02.INV.02** — Spread, reset, flags e arredondamento seguem o domínio; nenhuma edição anual altera meses fora da operação escolhida sem tornar o efeito visível.
- **WP03.T02.INV.03** — Lock, papel, owner/domínio e revisão esperada são rechecados pelo comando, independentemente da disponibilidade visual do controle.
- **WP03.T02.QLT.01** — A grade distingue salvo, pendente, conflito e não editável por texto e estado acessível, sem depender apenas de cor.
- **WP03.T02.QLT.02** — Navegação por teclado, identificação da linha e rótulo de versão/período permanecem utilizáveis ao percorrer os doze meses.
- **WP03.T02.CMP.01** — Estão cobertos os quatro modos de leitura, sete medidas de comparação, annual/mensal, spread/reset e actuals closed through.
- **WP03.T02.CMP.02** — Estão cobertos linhas, projetos, owners, entidades, allocations, moeda, classificação, total-only/breakdown, exclusões em uso e CPX.
- **WP03.T02.SUC.01** — O usuário altera uma previsão mensal e identifica seu efeito anual antes de confirmar, sem editar a versão errada.
- **WP03.T02.SUC.02** — Uma recusa por conflito ou autoridade não perde a entrada local nem deixa o usuário acreditar que os valores foram salvos.
- **WP03.T02.SUC.03** — O operador altera um intervalo mensal real, identifica rejeições e reaplica somente células corrigidas sem redigitação nem perda de valores bloqueados.
- **WP03.T02.CHK.01** — Em mês aberto com budget 100, forecast vazio resulta em 100 e forecast explícito 0 resulta em 0; em mês fechado, actual ausente preserva o resultado legado 0 e a indicação de ausência.
- **WP03.T02.CHK.02** — Com janeiro manual em 200 e annual alterado para 1520, os onze meses abertos recebem 120, janeiro permanece 200 e o total é 1520; reset libera flags e preserva o total com o arredondamento do baseline.
- **WP03.T02.CHK.03** — Duas edições em registros distintos são aceitas com suas revisões; duas edições concorrentes no mesmo registro produzem conflito na segunda, mantendo sua entrada local visível e sem sobrescrever a primeira.
- **WP03.T02.CHK.04** — Owner não altera budget/actual de linha alheia; Finance altera actual/forecast/closed permitido em versão bloqueada; linha sintética HR não admite budget manual.
- **WP03.T02.CHK.05** — CAPEX aceita linha classificada OPEX sem somá-la como capitalização; código CPX não se repete após cópia/exclusão e projeto referenciado não é excluído.

### WP03.T03

- **WP03.T03.DOD.01** — Headcount, rates, reajuste e sincronização estão cobertos por contribuição de produto e comandos autorizados.
- **WP03.T03.DOD.02** — C02 publica FTE/custo por mês e exceções com os mesmos resultados do domínio e provas por papel.
- **WP03.T03.INV.01** — Posições, rate, FTE, intervalo e reajuste alimentam HR sintético; não há budget HR manual paralelo.
- **WP03.T03.INV.02** — Actual/forecast HR permanecem independentes do cálculo de budget e não são substituídos por sincronização do roster.
- **WP03.T03.INV.03** — Campos salariais e Talent Review não são expandidos nem expostos a partir de agregado, diff, mensagem ou importação.
- **WP03.T03.QLT.01** — A interface identifica posição excluída, não presente no roster, nova contratação e sem rate sem fazer esses estados parecerem equivalentes.
- **WP03.T03.QLT.02** — Indicadores dizem FTE planejado e explicam o denominador; custo anual dividido por FTE dezembro não recebe rótulo de média anual sem essa definição.
- **WP03.T03.CMP.01** — Posições, rates automáticos/explícitos, overrides, reajuste, meses, inclusão, tipo, localização e domínio manual estão cobertos.
- **WP03.T03.CMP.02** — A sincronização, privacidade, bloqueio, HR por domínio e referências de rate em uso possuem casos de aceitação.
- **WP03.T03.SUC.01** — HR identifica quais posições explicam uma mudança mensal de custo sem editar linhas sintéticas de OPEX.
- **WP03.T03.SUC.02** — André recebe a evolução planejada de FTE/custo dentro de seu acesso, e ausência de rate não parece economia confirmada.
- **WP03.T03.CHK.01** — Posição incluída, FTE 1, rate anual USD 120000, início 7 e fim 12 gera budget HR 60000; reajuste de 10% a partir do mês 10 gera 63000 e mantém FTE dezembro 1.
- **WP03.T03.CHK.02** — Posição sem rate continua no FTE planejado, contribui custo zero pela regra atual e exibe No rate; excluir a posição do plano remove sua contribuição sem apagar seu cadastro.
- **WP03.T03.CHK.03** — Sincronização preserva domínio manual, marca ausência do roster e não admite pessoas futuras/terminadas conforme baseline; plano bloqueado não modifica posições.
- **WP03.T03.CHK.04** — Editar actual/forecast HR não altera seu budget derivado; tentativa de importar/editar budget sintético não é aceita como valor manual.
- **WP03.T03.CHK.05** — Owner/viewer vê agregados permitidos e nunca recebe annual cost individual, rate card privado, override ou reajuste em detalhe, comparação ou conflito.

### WP03.T04

- **WP03.T04.DOD.01** — FX e ambos os catálogos possuem os controles originais, contexto de escopo e prova de referência em uso.
- **WP03.T04.DOD.02** — A composição monetária e a ausência de taxa são publicadas para UI/BI/imports sem alterar a política cambial.
- **WP03.T04.INV.01** — FX pertence à versão e entidades/allocations mantêm o escopo compartilhado existente; troca de tela não muda essa autoridade.
- **WP03.T04.INV.02** — USD fixo, validação, precisão e resultado numérico de taxa ausente seguem o domínio, com a ausência explicitada.
- **WP03.T04.INV.03** — Chave de allocation é classificação; nenhum valor é rateado ou escrito em outro módulo por sua seleção.
- **WP03.T04.QLT.01** — Valor original, moeda, taxa aplicável e USD convertido podem ser inspecionados sem adivinhar a base.
- **WP03.T04.QLT.02** — Referências são apresentadas por nome legível e exclusões recusadas explicam o uso encontrado sem revelar informação restrita.
- **WP03.T04.CMP.01** — Criação, edição e exclusão de FX, entidades e allocations, chaves comuns e restrições de uso estão cobertas.
- **WP03.T04.CMP.02** — Casos de taxa ausente, código inválido, vírgula decimal, duplicidade normalizada e lock/papel têm resultados explícitos.
- **WP03.T04.SUC.01** — O usuário reconhece antes da gravação se altera uma premissa desta versão ou um cadastro compartilhado.
- **WP03.T04.SUC.02** — Taxa ausente e allocation não calculada permanecem visíveis como tais em qualquer consumidor autorizado.
- **WP03.T04.CHK.01** — Valor 100 em moeda com taxa USD 1.2 produz 120; taxa ausente mantém o resultado legado 0 e aviso de moeda sem taxa, sem informar perda/economia de 120 como fato.
- **WP03.T04.CHK.02** — USD não pode ser alterado/excluído, moeda em uso não é excluída e taxa válida com vírgula segue o mesmo parse e seis casas do baseline.
- **WP03.T04.CHK.03** — Nome equivalente normalizado é recusado como duplicata; entidade/allocation usada em outra versão ou HR AF não pode ser excluída.
- **WP03.T04.CHK.04** — Finance edita FX somente quando permitido pelo lock; administração de catálogos segue o papel original; tela e comando rejeitam a mesma mudança proibida.
- **WP03.T04.CHK.05** — Adicionar chaves comuns é idempotente e não altera distribuição de valores; By headcount continua referência, sem gerar pesos ou lançamentos.

### WP03.T05

- **WP03.T05.DOD.01** — Overview, gestão completa de Versions e comparação A/B são entregues com composição explicável e estados de hipótese/oficial.
- **WP03.T05.DOD.02** — O handoff contém todas as portas de domínio, matriz de paridade e roteiro exato de consumo por WP05/WP06/WP10.
- **WP03.T05.DOD.18** — Descritores C16 de sf_scenario_compare são implementados e consumidos por T06 com referências reais.
- **WP03.T05.INV.01** — Explorar uma cópia não altera official, budget ou actual de outra versão; oficialização permanece ação explícita autorizada.
- **WP03.T05.INV.02** — Comparação preserva moeda/período/contexto e identidade dos registros; não mistura anos, hipóteses ou naturezas contábeis sem identificá-los.
- **WP03.T05.INV.03** — Deltas são resultados do mesmo motor e respeitam redação salarial; não há integração automática de Procurement nem causalidade inferida.
- **WP03.T05.INV.18** — Permissões, locks, cálculos e comandos finais continuam no domínio; o transporte não cria poder novo.
- **WP03.T05.QLT.01** — Os maiores impactos podem ser abertos até linha/mês e toda diferença agregada reconcilia com seus componentes.
- **WP03.T05.QLT.02** — Orçamento oficial, versão base, hipótese e outlook têm rótulos distintos; seleção e estado permanecem visíveis ao navegar.
- **WP03.T05.QLT.18** — Schema fechado, ausência/falha explícitas e provenance permitem comparar UI/native/MCP.
- **WP03.T05.CMP.01** — Criar, copiar, editar nome/ano, bloquear, desbloquear, oficializar e excluir são preservados com todas as recusas pertinentes.
- **WP03.T05.CMP.02** — Overview mantém suas medidas e comparações originais e acrescenta detalhamento A/B; as sete páginas possuem cobertura e exports de composição.
- **WP03.T05.CMP.18** — Cobrir todos os exports desta task (1), caso autorizado, direto proibido, stale e indisponível.
- **WP03.T05.SUC.01** — André identifica em uma comparação o único item que leva 590000 a 602000 e consegue inspecionar o mês sem perder a referência de versão.
- **WP03.T05.SUC.02** — WP10 consegue montar as contribuições reais sem alterar a lógica financeira nem copiar fórmulas para BI ou imports.
- **WP03.T05.SUC.18** — O usuário recebe a mesma capacidade e resultado pelas superfícies sem divergência ou efeitos adicionais.
- **WP03.T05.CHK.01** — Base produz outlook 590000; cópia com o item 72000 substituído por 84000 produz 602000 e delta +12000; cópia com 78000 produz 596000 e delta +6000, mantendo budget 600000 e actual 400000.
- **WP03.T05.CHK.02** — No cenário de 596000, a UI mostra +6000 contra a base e -4000 contra budget, sem rotular os 4000 como economia contra a base.
- **WP03.T05.CHK.03** — As contribuições das linhas somam o delta total; diferenças de FX/HR/meses permanecem explicadas por campos alterados, e registros sem identidade correspondente não são unidos por nome.
- **WP03.T05.CHK.04** — Copiar e explorar não modifica official; tornar official troca apenas o ponteiro daquele ano e bloqueia a escolhida; official não é excluída/desbloqueada pela ação proibida.
- **WP03.T05.CHK.05** — A matriz cobre sete páginas e operações originais; provas de montagem real são encaminhadas ao WP10, e gráficos/imports ainda não compostos não são declarados integrados.
- **WP03.T05.CHK.18** — Executar sf_scenario_compare pela UI/native/MCP com base e autoridade iguais produz o mesmo handler, resultado e versão; chamada direta sem concessão ou após revogação é recusada pelo destino.

### WP05

- **WP05.DOD.01** — Os oito gráficos têm pergunta explícita, eixos/unidades, fonte C02, comportamento de ausência e drilldown exportado, com evidências verificáveis para cada um.
- **WP05.DOD.02** — Os gráficos são consumidores do C02 real: o pacote não calcula salários, OPEX/CAPEX, alçadas, ranking, aging ou métricas de tickets a partir de dados brutos.
- **WP05.DOD.03** — A entrega inclui tabela equivalente, operações por teclado e recibo de filtros/referências; WP10 verifica os gráficos nos entrypoints comuns com os produtores reais.
- **WP05.DOD.04** — Oito perguntas analíticas originais e três perguntas de decisão funcionam com o motor canônico, suas fontes e tabelas equivalentes; não basta renderizar novos gráficos vazios.
- **WP05.DOD.20** — BI e tabela consomem coverage/result refs reais junto às marcas.
- **WP05.DOD.10** — As entregas residentes atribuídas a WP05 têm produção, consumo e provas reais completos.
- **WP05.INV.01** — A mesma seleção contextual do domínio produz os mesmos valores no gráfico e no detalhe; moeda, período, versão e recorte autorizado não mudam silenciosamente no drilldown.
- **WP05.INV.02** — Ausente não é zero, estoque não é funil/coorte, prazo planejado não é conclusão real e idade sem evento comprovado não é duração conhecida.
- **WP05.INV.03** — Componentes financeiros são os fornecidos por C02; diferenças não reconciliadas ficam visíveis e não são escondidas por uma parcela de ajuste criada no BI.
- **WP05.INV.20** — Gráfico não calcula completude nem converte lacuna em zero, ganho confirmado ou ajuste residual.
- **WP05.INV.10** — WP05 conserva autoridade, dados oficiais e ownership; não assume identidade técnica ou novo acesso empresarial.
- **WP05.QLT.01** — Cada gráfico permite responder uma pergunta concreta sem depender apenas de cor, hover ou memória da escala.
- **WP05.QLT.02** — Sinais, unidades, eixos, arredondamento e granularidade ficam claros; FTE e moeda usam painéis alinhados em vez de um eixo duplo que sugira equivalência.
- **WP05.QLT.03** — Estados vazio, parcial, indisponível e restrito são distintos e não inventam números para preencher espaço.
- **WP05.QLT.20** — Rótulo de condicionado acompanha valor/limiar e a lista acessível explica categorias sem quantificação.
- **WP05.QLT.10** — Interfaces são concretas, versões/digests são verificáveis e falhas possuem causa e estado explícitos.
- **WP05.CMP.01** — Cobrir os oito gráficos, seus filtros e caminhos de drilldown, incluindo dados parciais, negativos, nulos e séries/tempos indisponíveis.
- **WP05.CMP.02** — Cobrir navegação por teclado, tabela equivalente, foco/retorno e contexto de dados restritos em cada par de gráficos.
- **WP05.CMP.03** — Identificar o produtor C02 e a referência de origem de cada marca ou agregado; fixtures de contrato não substituem a prova final com consumidores reais.
- **WP05.CMP.04** — Oito perguntas analíticas originais e três perguntas de decisão funcionam com o motor canônico, suas fontes e tabelas equivalentes; não basta renderizar novos gráficos vazios.
- **WP05.CMP.20** — Cobrir omissão inteira, pending, zero confirmado, fonte restrita e atualização que inverte a diferença.
- **WP05.CMP.10** — Todas as obrigações 5/18/8/C17 desta frente têm task, owner, paths, consumidor e negativos discriminantes.
- **WP05.SUC.01** — Nos roteiros, o usuário identifica desvio, contribuição, capacidade ou pendência e abre os registros que explicam o resultado sem refazer filtros.
- **WP05.SUC.02** — Mudar os valores projetados pelo domínio muda as marcas correspondentes; inserir um cálculo divergente, zero fictício ou registro fora do recorte faz uma verificação falhar.
- **WP05.SUC.03** — Oito visualizações funcionam com dados disponíveis e degradam honestamente quando o C02 não suporta uma série, componente ou data.
- **WP05.SUC.20** — Usuário encontra a categoria que muda a comparação e abre sua origem com o mesmo contexto.
- **WP05.SUC.10** — O consumidor integrado utiliza a saída de produção sem substituto fictício e o revisor consegue reproduzir o resultado.

### WP05.T01

- **WP05.T01.DOD.01** — Trajetória e waterfall estão exportados com tabela equivalente e produtor C02 identificável.
- **WP05.T01.DOD.02** — Granularidade, lacunas e reconciliação têm resultados esperados e falhas demonstráveis.
- **WP05.T01.INV.01** — Nenhum mês, realizado ou contribuição é fabricado para completar a visualização.
- **WP05.T01.INV.02** — O waterfall usa valores de domínio e não recalcula a semântica do cenário.
- **WP05.T01.QLT.01** — Competência, moeda, referência e cenário ficam legíveis na própria visualização.
- **WP05.T01.QLT.02** — Lacunas e contribuições negativas preservam significado em cor e texto.
- **WP05.T01.CMP.01** — Cobrir trajetória completa/parcial/anual e waterfall com aumentos, reduções, zero e falha de reconciliação.
- **WP05.T01.CMP.02** — Cobrir seleção por mouse/teclado e equivalência entre marcas e tabela.
- **WP05.T01.SUC.01** — O usuário distingue o que é orçamento, realizado disponível e outlook sem tratar previsão como realizado.
- **WP05.T01.SUC.02** — O usuário explica o delta de um cenário por seus componentes e acessa sua origem com o contexto preservado.
- **WP05.T01.CHK.01** — Receber apenas total anual sem distribuição mensal: a trajetória não gera 12 pontos por divisão/interpolação; informa granularidade disponível e não aparenta conhecer um perfil mensal.
- **WP05.T01.CHK.02** — Dado actual desconhecido em uma competência e zero confirmado em outra: o primeiro produz lacuna/indisponibilidade, o segundo marca zero; os dois casos não compartilham tooltip/representação.
- **WP05.T01.CHK.03** — Usar cenário C02 com referência 100, contribuições +20 e -5 e final 115: waterfall termina em 115 e cada seleção preserva seu componente; trocar o final para 116 deve sinalizar não reconciliação, não criar '+1 ajuste'.
- **WP05.T01.CHK.04** — Alterar moeda, competência ou versão entre contexto e projeção: o gráfico recusa a mistura ou apresenta grupos explicitamente separados conforme C02, sem sobrepor valores incompatíveis.
- **WP05.T01.CHK.05** — Abrir uma contribuição por teclado: destino recebe a referência e os filtros exatos e retorna mantendo foco; componente sem autorização nunca aparece no gráfico ou na tabela.

### WP05.T02

- **WP05.T02.DOD.01** — Contribuições e FTE/custo estão exportados com eixos, unidades, tabelas e referências reais.
- **WP05.T02.DOD.02** — A entrega documenta a origem de agrupamentos e o tratamento de componentes restritos/ausentes.
- **WP05.T02.INV.01** — Sinal da contribuição e unidade de cada medida não são alterados por ordenação ou formatação.
- **WP05.T02.INV.02** — FTE e custo permanecem medidas distintas e os dados pessoais ausentes do C02 não são reconstruídos.
- **WP05.T02.QLT.01** — As maiores contribuições positivas e negativas são comparáveis sem um gráfico visualmente dominado por valores absolutos.
- **WP05.T02.QLT.02** — Painéis alinhados mostram o mesmo recorte e usam escalas explícitas sem eixo duplo enganoso.
- **WP05.T02.CMP.01** — Cobrir positivos, negativos, zero, desconhecido, Top N parcial e agrupamento reconciliado.
- **WP05.T02.CMP.02** — Cobrir recorte agregado e restrito, filtro conjunto e drilldown autorizado dos dois painéis.
- **WP05.T02.SUC.01** — O usuário localiza quem aumenta e quem reduz o desvio e consegue abrir o componente correspondente.
- **WP05.T02.SUC.02** — O usuário compara capacidade e custo sem inferir produtividade ou custo unitário que o domínio não fornece.
- **WP05.T02.CHK.01** — Projetar contribuições +40 e -30: mostrar ambas com sinais corretos e delta 10 somente quando fornecido/reconciliado pelo C02; usar valor absoluto ou omitir a contribuição negativa deve falhar.
- **WP05.T02.CHK.02** — Receber Top N sem agregado do restante: não apresentar o subtotal como total; com 'outros' C02, a marca e o drilldown preservam os componentes definidos pelo produtor.
- **WP05.T02.CHK.03** — No mesmo recorte, FTE confirmado como zero e custo ausente: mostrar zero de FTE e custo indisponível, sem converter nenhum deles no outro ou presumir custo zero.
- **WP05.T02.CHK.04** — Aplicar um filtro/período: ambos os painéis usam o mesmo contexto, mantendo unidades e escalas separadas; nomes/custos pessoais removidos pelo C02 não podem aparecer em tooltip, tabela ou referência.
- **WP05.T02.CHK.05** — Navegar categoria por teclado e abrir detalhe: manter grupo, período, moeda, versão e retorno de foco; nenhuma seleção depende exclusivamente de hover.

### WP05.T03

- **WP05.T03.DOD.01** — Estoque e aging consomem as projeções reais de Procurement e têm drilldown para os pedidos correspondentes.
- **WP05.T03.DOD.02** — Estoque/coorte e idade comprovada/indisponível estão diferenciados na UI e nas contraprovas.
- **WP05.T03.INV.01** — A quantidade em etapas atuais não é convertida em taxa de conversão, abandono ou produtividade.
- **WP05.T03.INV.02** — Analytics não inventa idade nem exclui do universo os pedidos sem evento confiável.
- **WP05.T03.QLT.01** — Título e legenda deixam claro que a primeira visualização é estoque e a segunda é tempo na etapa.
- **WP05.T03.QLT.02** — Responsável desconhecido, idade indisponível e prazo informado são distinguíveis sem uso exclusivo de cor.
- **WP05.T03.CMP.01** — Cobrir todas as etapas abertas e aprovações, holder ausente, rejeição/ressubmissão e histórico insuficiente.
- **WP05.T03.CMP.02** — Cobrir filtros por papel e reconciliação entre agregado, pontos e lista autorizada.
- **WP05.T03.SUC.01** — O gestor identifica concentração de trabalho e abre seus pedidos sem inferir uma conversão inexistente.
- **WP05.T03.SUC.02** — O aprovador encontra o pedido mais antigo dentre os tempos comprovados e vê quantos não podem ser comparados.
- **WP05.T03.CHK.01** — Dado estoque com 7 PRs, 2 sourcings e 3 POs distintos: mostrar contagens atuais sem taxas entre barras, abandono ou conversão; rejeição/retorno muda a etapa de um pedido sem criar uma coorte histórica.
- **WP05.T03.CHK.02** — Receber do C02 pedido ressubmetido há 2 dias e salvo hoje: aging continua 2 dias; analytics não recalcula pelo save nem lê o histórico bruto.
- **WP05.T03.CHK.03** — Dois pedidos sem entrada comprovada: ambos aparecem no grupo 'idade indisponível' e no denominador autorizado; não entram em zero dias ou numa média fabricada.
- **WP05.T03.CHK.04** — Filtrar por requester restrito: contagem das barras, pontos e tabela corresponde exatamente aos pedidos visíveis no domínio; pedido alheio não vaza por agregado ou drilldown.
- **WP05.T03.CHK.05** — Clicar numa etapa e depois num pedido mantém o filtro e abre a referência correta; linha de SLA só existe se recebida com política/origem explícita, não pelo mero uso de uma cor vermelha.

### WP05.T04

- **WP05.T04.DOD.01** — Tickets e agenda estão exportados e o catálogo identifica os oito gráficos, produtores e destinos reais.
- **WP05.T04.DOD.02** — O recibo de interação/ausência/restrição permite a WP10 verificar composição sem descobrir contratos novos.
- **WP05.T04.DOD.18** — Descritores C16 de sf_bi_view são implementados e consumidos por T06 com referências reais.
- **WP05.T04.INV.01** — Fotografia atual não se transforma em histórico de tickets e data planejada não se transforma em conclusão.
- **WP05.T04.INV.02** — Nenhum marco sem data recebe data artificial e nenhuma fonte restrita é recuperada fora do C02.
- **WP05.T04.INV.18** — Permissões, locks, cálculos e comandos finais continuam no domínio; o transporte não cria poder novo.
- **WP05.T04.QLT.01** — A operação distingue entrada, conclusão, planejamento e desconhecido com texto, formas e unidades claros.
- **WP05.T04.QLT.02** — Os oito gráficos têm interação equivalente por teclado/tabela e retorno contextual previsível.
- **WP05.T04.QLT.18** — Schema fechado, ausência/falha explícitas e provenance permitem comparar UI/native/MCP.
- **WP05.T04.CMP.01** — Cobrir tickets com série válida e só fotografia, além de marcos planejados, concluídos e sem data.
- **WP05.T04.CMP.02** — Fechar o catálogo de oito gráficos com estados vazio/parcial/restrito, filtros e drilldowns verificáveis.
- **WP05.T04.CMP.18** — Cobrir todos os exports desta task (1), caso autorizado, direto proibido, stale e indisponível.
- **WP05.T04.SUC.01** — O time identifica o que entrou/foi concluído quando há evidência e localiza os marcos do horizonte sem interpretar planejado como entregue.
- **WP05.T04.SUC.02** — WP10 compõe o catálogo e verifica os consumidores reais sem refazer cálculo financeiro ou aceitar uma demonstração desconectada como entrega.
- **WP05.T04.SUC.18** — O usuário recebe a mesma capacidade e resultado pelas superfícies sem divergência ou efeitos adicionais.
- **WP05.T04.CHK.01** — Receber apenas contagem/status atual de tickets sem eventos ou agregados datados: mostrar fotografia com data de referência, sem série semanal nem taxa de resolução inventada; ao fornecer série C02 válida, os pontos reproduzem cada período.
- **WP05.T04.CHK.02** — Ticket aberto num período e fechado em outro segue os eventos/projeção do produtor; mover apenas status atual não deve retroativamente reescrever uma série histórica fornecida.
- **WP05.T04.CHK.03** — Marco planejado, marco concluído e marco sem data: os dois primeiros são distinguíveis e o terceiro permanece listado sem receber hoje, primeiro dia do mês ou outro fallback.
- **WP05.T04.CHK.04** — Para os oito gráficos, abrir por teclado uma marca/agregado com filtro, voltar e comparar com o detalhe: referência, versão, período, moeda, recorte e foco são preservados; falhar se o destino cair num overview sem a seleção.
- **WP05.T04.CHK.05** — Injetar valor ausente, componente restrito e série parcial nos consumidores reais de C02: nenhum aparece como zero ou dado completo em marca, tooltip ou tabela; registrar qual produtor/caso foi usado.
- **WP05.T04.CHK.06** — No handoff, cada gráfico aponta seu produtor real e check de composição WP10; um stub/fixture sem produtor identificável impede classificar o gráfico como integrado.
- **WP05.T04.CHK.18** — Executar sf_bi_view pela UI/native/MCP com base e autoridade iguais produz o mesmo handler, resultado e versão; chamada direta sem concessão ou após revogação é recusada pelo destino.

### WP05.T05

- **WP05.T05.DOD.01** — As três perguntas analíticas novas e as oito antigas são respondidas com produtores reais e valores reconciliados.
- **WP05.T05.DOD.20** — BI e tabela consomem coverage/result refs reais junto às marcas.
- **WP05.T05.INV.01** — Geometria usa o resultado do motor; visualização não recalcula regra de negócio nem estima probabilidades ausentes.
- **WP05.T05.INV.20** — Gráfico não calcula completude nem converte lacuna em zero, ganho confirmado ou ajuste residual.
- **WP05.T05.QLT.01** — Rótulos legíveis, sinais/unidades claros, comparação no mesmo horizonte e dados acessíveis por tabela e teclado.
- **WP05.T05.QLT.20** — Rótulo de condicionado acompanha valor/limiar e a lista acessível explica categorias sem quantificação.
- **WP05.T05.CMP.01** — Cobrir custo incerto, componente ausente, moeda, limite atingido/não atingido, cenário inviável e referência removida.
- **WP05.T05.CMP.20** — Cobrir omissão inteira, pending, zero confirmado, fonte restrita e atualização que inverte a diferença.
- **WP05.T05.SUC.01** — Usuário identifica qual componente ou premissa inverte a escolha e abre sua origem sem perder o caso.
- **WP05.T05.SUC.20** — Usuário encontra a categoria que muda a comparação e abre sua origem com o mesmo contexto.
- **WP05.T05.CHK.01** — Com outros custos 165 mil e referência 240 mil/meta 20 mil, limiteimplantação 55 mil provém do engine.
- **WP05.T05.CHK.02** — Atraso sem regra financeira não inventa economia ou obrigação eliminada.
- **WP05.T05.CHK.03** — Tabela e marcas retornam exatamente os mesmos valores autorizados.
- **WP05.T05.CHK.20** — A mesma revisão de AI-RENEWAL-OMITTED-CATEGORY aparece no gráfico e tabela: pending sem barra zero; training = 40000 altera total210000→250000 e diferença 30000→-10000, com fontes e snapshot histórico preservados.

### WP11

- **WP11.DOD.01** — Caso e escolhas sobrevivem a reinício e são compartilhados conforme autorização.
- **WP11.DOD.02** — Mudanças propostas chegam aos domínios reais e execução parcial é retomável no candidato integrado.
- **WP11.DOD.20** — Alternativas persistem inventário, avaliação de categorias e comparação C10 consumidos por UI, BI, crítica e portfólio.
- **WP11.DOD.10** — As entregas residentes atribuídas a WP11 têm produção, consumo e provas reais completos.
- **WP11.INV.01** — Escolha não é aprovação e simulação não grava em fonte oficial.
- **WP11.INV.02** — Não há transação global presumida nem efeito repetido em retry.
- **WP11.INV.20** — Soma reconciliada não prova cobertura. Categoria ausente/pending não vira zero; escolha preserva a condição conhecida na época.
- **WP11.INV.10** — WP11 conserva autoridade, dados oficiais e ownership; não assume identidade técnica ou novo acesso empresarial.
- **WP11.QLT.01** — Fontes, versões, hipóteses e efeitos são inspecionáveis.
- **WP11.QLT.02** — Falha conserva trabalho e estado de cada mudança.
- **WP11.QLT.20** — Subtotal, total coberto, diferença condicionada e benefício calculado confirmado têm rótulos e fontes distinguíveis.
- **WP11.QLT.10** — Interfaces são concretas, versões/digests são verificáveis e falhas possuem causa e estado explícitos.
- **WP11.CMP.01** — Cobrir intenção/alternativas/premissas/escolha/propostas/recibos, concorrência, import e revogação.
- **WP11.CMP.20** — Cobrir categoria incluída, inaplicável suportada, pendente, inteiramente omitida, zero confirmado e custo posterior que inverte a comparação.
- **WP11.CMP.10** — Todas as obrigações 5/18/8/C17 desta frente têm task, owner, paths, consumidor e negativos discriminantes.
- **WP11.SUC.01** — Uma decisão passa de pergunta a trabalho executável e pode ser retomada sem reconstruir sua razão.
- **WP11.SUC.20** — Usuário vê o que falta, confirma uma categoria e obtém reavaliação reproduzível sem perder a base da escolha original.
- **WP11.SUC.10** — O consumidor integrado utiliza a saída de produção sem substituto fictício e o revisor consegue reproduzir o resultado.

### WP11.T01

- **WP11.T01.DOD.01** — Caso é criado, retomado e atualizado no provider real da composição; adapter em memória isolado não fecha DoD.
- **WP11.T01.DOD.18** — Descritores C16 de sf_case_read, sf_case_draft são implementados e consumidos por T06 com referências reais.
- **WP11.T01.INV.01** — Ator e autorização vêm do host; versão e histórico não são escolhidos pelo modelo nem importados como confiança.
- **WP11.T01.INV.18** — Permissões, locks, cálculos e comandos finais continuam no domínio; o transporte não cria poder novo.
- **WP11.T01.QLT.01** — Falhas distinguem acesso, referência inválida e versão antiga; cada seção mantém origem/período/versão próprios.
- **WP11.T01.QLT.18** — Schema fechado, ausência/falha explícitas e provenance permitem comparar UI/native/MCP.
- **WP11.T01.CMP.01** — Cobrir rascunho, objetivo corrigido, referência revogada/substituída, concorrência e reinício.
- **WP11.T01.CMP.18** — Cobrir todos os exports desta task (2), caso autorizado, direto proibido, stale e indisponível.
- **WP11.T01.SUC.01** — André e um colaborador autorizado retomam a mesma pergunta e seus dados sem reconstruir contexto.
- **WP11.T01.SUC.18** — O usuário recebe a mesma capacidade e resultado pelas superfícies sem divergência ou efeitos adicionais.
- **WP11.T01.CHK.01** — Criar caso em uma sessão, reiniciar provider real e ler em outra identidade autorizada conserva conteúdo/versão/autoria; ator sem acesso recebe projeção reduzida ou recusa.
- **WP11.T01.CHK.02** — Duas atualizações com expected version idêntica produzem um commit e um conflito com rascunho recuperável, sem perda de dado.
- **WP11.T01.CHK.03** — Import JSON malicioso ou troca de registro com ID reutilizado não fabrica confirmação, não apaga histórico confiável nem mantém vínculo à encarnação antiga como válido.
- **WP11.T01.CHK.18** — Executar sf_case_read, sf_case_draft pela UI/native/MCP com base e autoridade iguais produz o mesmo handler, resultado e versão; chamada direta sem concessão ou após revogação é recusada pelo destino.

### WP11.T02

- **WP11.T02.DOD.01** — Alternativas persistidas consomem cálculo real WP03 e são editáveis no consumidor WP01.
- **WP11.T02.DOD.20** — Alternativa persistida entrega cálculo WP03 e cobertura C10 reais a todos os consumidores nomeados.
- **WP11.T02.DOD.18** — Descritores C16 de sf_alternative_draft são implementados e consumidos por T06 com referências reais.
- **WP11.T02.INV.01** — Simulação não altera oficial/actual/compra; ausência não vira zero e hipótese não vira compromisso.
- **WP11.T02.INV.20** — Nenhuma categoria some por não ter linha; cobertura não soma parcelas nem inventa valor, imposto ou fato confirmado.
- **WP11.T02.INV.18** — Permissões, locks, cálculos e comandos finais continuam no domínio; o transporte não cria poder novo.
- **WP11.T02.QLT.01** — Todo total pode ser reconciliado aos componentes com moeda, período e origem; campos inválidos têm erro específico.
- **WP11.T02.QLT.20** — Cada categoria mostra referência de parcela, motivo suportado de inaplicabilidade ou pergunta pendente; subtotal e total ficam distintos.
- **WP11.T02.QLT.18** — Schema fechado, ausência/falha explícitas e provenance permitem comparar UI/native/MCP.
- **WP11.T02.CMP.01** — Cobrir mesma base, base incompatível, operação inválida, alternativa incompleta e mudança de critério.
- **WP11.T02.CMP.20** — Cobrir inventário ausente, categoria omitida, not-applicable sem suporte, zero confirmado, fonte revogada, inclusão compartilhada e custo posterior inversor.
- **WP11.T02.CMP.18** — Cobrir todos os exports desta task (1), caso autorizado, direto proibido, stale e indisponível.
- **WP11.T02.SUC.01** — O usuário altera uma premissa e obtém uma comparação que pode explicar e reproduzir.
- **WP11.T02.SUC.20** — O usuário compreende a ressalva e resolve a informação que altera a comparação, sem refazer manualmente os números.
- **WP11.T02.SUC.18** — O usuário recebe a mesma capacidade e resultado pelas superfícies sem divergência ou efeitos adicionais.
- **WP11.T02.CHK.01** — AI-RENEWAL com inventário completo e fontes sintéticas confirmadas: 240000 vs 60000+45000+105000 = 210000; diferença 30000; implantação 70000 produz 235000 e diferença 5000. Taxas/migração/treinamento explicitamente cobertos ou inaplicáveis não são somados duas vezes.
- **WP11.T02.CHK.02** — Operação que substituiria contribuição já vinculada troca o componente uma vez; o teste com inclusão duplicada é recusado ou reconciliado pelo domínio.
- **WP11.T02.CHK.03** — Moeda sem FX, custo de saída pending e desconto hipotético mantêm comparação conditioned. Valor 0 confirmado difere de null, categoria omitted e declaração not-applicable sem evidência; nenhum estado desconhecido é promovido a zero.
- **WP11.T02.CHK.20** — AI-RENEWAL-OMITTED-CATEGORY remove training da entrada, sem linha, sem pending pré-cadastrado e com implementação explicitamente sem treinamento: validador deriva missing-category e knownSubtotal 210000; completeDifference/total coberto ficam indisponíveis e a comparação é conditioned em todos os consumidores.
- **WP11.T02.CHK.21** — Na mesma variante, confirmar novo componente training=40000 com fonte torna cobertura completa, total 250000, diferença -10000 e teto de implantação15000. A comparação de custo se inverte, condição mínima 20000 falha e a escolha original mantém subtotal 210000/ressalva pending/versões.
- **WP11.T02.CHK.18** — Executar sf_alternative_draft pela UI/native/MCP com base e autoridade iguais produz o mesmo handler, resultado e versão; chamada direta sem concessão ou após revogação é recusada pelo destino.

### WP11.T03

- **WP11.T03.DOD.01** — Escolha humana gera propostas revisáveis que chegam aos consumidores reais de cada domínio.
- **WP11.T03.DOD.18** — Descritores C16 de sf_change_prepare são implementados e consumidos por T06 com referências reais.
- **WP11.T03.INV.01** — Escolha gerencial não equivale a aprovação formal; UI ou IA não delegam autoridade inexistente.
- **WP11.T03.INV.18** — Permissões, locks, cálculos e comandos finais continuam no domínio; o transporte não cria poder novo.
- **WP11.T03.QLT.01** — Cada proposta mostra alteração, motivo, destino e estado; a justificativa continua vinculada aos números debatidos.
- **WP11.T03.QLT.18** — Schema fechado, ausência/falha explícitas e provenance permitem comparar UI/native/MCP.
- **WP11.T03.CMP.01** — Cobrir escolher, manter escolha sob nova justificativa, substituir escolha, rejeitar proposta e conflito da fonte.
- **WP11.T03.CMP.18** — Cobrir todos os exports desta task (1), caso autorizado, direto proibido, stale e indisponível.
- **WP11.T03.SUC.01** — A equipe consegue continuar o trabalho a partir da escolha sem transcrever sua justificativa e seus valores.
- **WP11.T03.SUC.18** — O usuário recebe a mesma capacidade e resultado pelas superfícies sem divergência ou efeitos adicionais.
- **WP11.T03.CHK.01** — Registrar escolha preserva a base financeira; alteração posterior de cotação e nova escolha não modificam o registro original.
- **WP11.T03.CHK.02** — Escolher alternativa não aprova PR/PO, não aplica cenário oficial nem cria ação automaticamente; propostas mostram destino e confirmação cabível.
- **WP11.T03.CHK.03** — Responsável confirma março enquanto projeto oficial segue maio: cenário usa premissa declarada, divergência permanece visível e atualização oficial exige comando próprio.
- **WP11.T03.CHK.20** — Registrar escolha condicionada na variante de treinamento omitido; confirmar treinamento 40000 depois conserva a escolha/subtotal/ressalva originais e apresenta nova alternativa250000/diferença -10000 sem reescrever a razão histórica ou autoalterar a escolha.
- **WP11.T03.CHK.18** — Executar sf_change_prepare pela UI/native/MCP com base e autoridade iguais produz o mesmo handler, resultado e versão; chamada direta sem concessão ou após revogação é recusada pelo destino.

### WP11.T04

- **WP11.T04.DOD.01** — O módulo integrado recupera falha parcial e resposta perdida usando recibos reais de domínio.
- **WP11.T04.DOD.02** — Recuperação consulta recibos de domínio gravados atomicamente com a mutação e reconcilia o caso; a prova inclui resposta perdida após commit e ausência de efeito duplicado.
- **WP11.T04.DOD.18** — Descritores C16 de sf_receipt_get são implementados e consumidos por T06 com referências reais.
- **WP11.T04.INV.01** — Não existe promessa de transação global; um erro posterior não desfaz ou oculta commits anteriores.
- **WP11.T04.INV.18** — Permissões, locks, cálculos e comandos finais continuam no domínio; o transporte não cria poder novo.
- **WP11.T04.QLT.01** — Estado informa efeito comprovado e ação de recuperação; correlação estável independe de narrativa IA.
- **WP11.T04.QLT.18** — Schema fechado, ausência/falha explícitas e provenance permitem comparar UI/native/MCP.
- **WP11.T04.CMP.01** — Cobrir sucesso total, sucesso parcial, conflito, pendência de aprovação, permissão revogada e resultado desconhecido.
- **WP11.T04.CMP.18** — Cobrir todos os exports desta task (1), caso autorizado, direto proibido, stale e indisponível.
- **WP11.T04.SUC.01** — O usuário sabe o que já foi feito e retoma só o restante, com ausência verificável de efeitos duplicados.
- **WP11.T04.SUC.18** — O usuário recebe a mesma capacidade e resultado pelas superfícies sem divergência ou efeitos adicionais.
- **WP11.T04.CHK.01** — Aplicar Planner com sucesso e recusar Procurement mantém o primeiro resultado e exibe parcial; retomada não reaplica o Planner.
- **WP11.T04.CHK.02** — Perder resposta depois do commit e reenviar a mesma correlação resulta em um efeito; caso sem receipt autoritativo fica indeterminado e exige reconciliação, nunca retry cego.
- **WP11.T04.CHK.03** — Revogar permissão entre preparação e aplicação recusa a mudança pendente e não expõe resultado restrito em recibo agregado.
- **WP11.T04.CHK.18** — Executar sf_receipt_get pela UI/native/MCP com base e autoridade iguais produz o mesmo handler, resultado e versão; chamada direta sem concessão ou após revogação é recusada pelo destino.

## Verificação documental e gates abertos

Esta edição verificou somente metadata, presença de arquivos, hashes Git/SHA256, scopes e igualdade literal dos 303 critérios/14 tarefas. Nenhum produto ou teste foi executado por esta auditoria. Não houve Bun, CI ou escrita remota.

Provas residentes/nativas, revisões independentes aceitas e gates C/D permanecem obrigatórios. S0 mantém a integração e o epic do bundle integral. A composição instalada e a ausência de efeitos duplicados exigem seus próprios recibos; uma simulação ou inspeção estática não os substitui.
