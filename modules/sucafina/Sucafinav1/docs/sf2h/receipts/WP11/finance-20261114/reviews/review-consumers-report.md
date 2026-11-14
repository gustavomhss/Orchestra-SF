# Revisão independente de consumidores — WP03/WP05/WP11

**Produto revisto:** `66bbe152c145f04c16223a938589c63cedb3b716`  
**Tree:** `f727ae5bfcef26383ff47a2b06bb65b161295dd2`  
**Método:** somente leitura de código, contratos, taskwork e testes; conferência documental determinística. Nenhum produto/teste foi executado localmente, nenhum CI foi disparado e nenhum checkout de produto foi modificado. O revisor não é autor da implementação.

## Resultado mais importante

Há dois defeitos funcionais observáveis por rastreio estático no candidato: as contribuições usuais de comparação A/B perdem a navegação para fontes e o Overview legado ainda mistura actual ausente com zero explícito. Nenhum dos dois exige inventar uma fórmula financeira. Os 303 critérios estão textualmente preservados; isso não prova sua satisfação.

## C1 — Contribuições A/B do Planner não oferecem origem no waterfall ou nas barras

**Severidade:** high. **Classificação:** functional_gap_in_current_producer.

Local principal: `modules/sucafina/Sucafinav1/product/planner/bi-difference.ts:21,35-36`.

O produtor atribui drilldown somente quando refs.length === 1. Em uma linha/mês matched entre v0 e v1, rowRefs inclui as referências canônicas das duas versões; logo drilldown é null. Waterfall e BI03 condicionam botão, teclado e origem a drilldown. A fábrica CLI real usa esse produtor. É ausência de ação no resultado produzido, não apenas falta de ensaio browser.

### Reprodução por leitura

1. Usar as duas versões canônicas já presentes no teste planner-integration (590000 e 602000), com a mesma linha nas duas versões.
2. Chamar plannerDifferencePresentation(analysis, BI02) ou BI03. Os componentes matched têm sourceRefs das duas versões e drilldown null por construção.
3. RenderWaterfall/renderBiView exibem a contribuição, mas não registram ação, tabindex ou botão de origem para ela; a tabela diz Indisponível.

**Prova que falta:** O teste real de waterfall confirma 590000/602000, zero, SVG e tabelas, mas não clica em nenhuma contribuição nem exige referência. Os casos de callback genérico não demonstram esta composição A/B.

**Correção delimitada:** Os contratos existentes já contêm sourceRefs múltiplos e BiSelection.reference singular. Um seletor explícito de origem pode encaminhar um desses refs sem inventar cálculo. O consumidor deve aceitar somente igualdade integral com um ref da MESMA ProjectionValue redispatchada, mantendo context/version/engine/period/selectionRef, C17/currentRef e fences finais; a UI deve identificar a origem escolhida e preservar o delta. Não escolher silenciosamente o primeiro ref. Alternativamente, um cálculo canônico emitido por host exige delta externo. Nenhum fix foi aplicado por este revisor.

**Discriminante necessário:** Comparação real de duas versões, contribuição não zero e zero: ambas as origens selecionáveis por mouse/teclado/tabela, mesmo valueId/contexto/versão, rejeição de terceiro ref, ref com campos trocados, versão trocada e revogação após C17. Não aceitar overview por fallback.

**Critérios:** WP05.T01.CHK.05, WP05.T01.SUC.02, WP05.T02.CHK.05, WP05.T02.SUC.01, WP05.T04.CHK.04, WP05.INV.01.

**Ownership:** WP03 produtor + WP05 renderer/consumer; affordance no entrypoint e asset têm handoff WP01/WP10.

Outros locais inspecionados:

- `modules/sucafina/Sucafinav1/product/planner/port.ts:117`
- `modules/sucafina/Sucafinav1/product/analytics/waterfall.ts:71-83,126-128`
- `modules/sucafina/Sucafinav1/product/analytics/view.ts:333-345,393-401`
- `modules/sucafina/Sucafinav1/product/analytics/consumer.ts:58-68`
- `foreign-intake/WP10/apps/cli/src/sucafina-product/bi-services.ts:114-120`
- `modules/sucafina/Sucafinav1/test/product/wp05/planner-integration.test.ts:102-160`

## C2 — Overview legado confunde actual ausente com zero explícito

**Severidade:** medium. **Classificação:** existing_functional_gap_in_runtime_consumer.

Local principal: `modules/sucafina/Sucafinav1/runtime/planner.ts:1078-1085,1853-1864`.

A tabela Overview usa numericMonths(summary.actual), exibindo zero para meses fechados ausentes, e troca por travessão todo zero em mês aberto. O gráfico repete a regra value === 0 para actual aberto. A projeção financeira própria distingue null/absent de zero/confirmed, mas este entrypoint usa o summary legado e não transporta a qualificação. Não é solicitação de alterar cálculo legado.

### Reprodução por leitura

1. Fechar janeiro; manter a[0]=null numa linha, e comparar com a[0]=0. O cálculo legado produz actual zero nos dois casos; tabela e ponto do Overview são iguais.
2. Abrir fevereiro e registrar explicitamente a[1]=0. A condição i >= closed && actual[i] === 0 o exibe como travessão e o remove do gráfico.

**Prova que falta:** Os testes C02/Overview novo verificam os estados corretos, mas não validam a equivalência no renderPage Overview legado. A pendência UI declarada é adequada e deve conservar esse caso concreto.

**Correção delimitada:** Expor/consumir a qualificação de presença do produtor no Overview; manter o valor numérico legado quando exigido e acrescentar estado de ausência. Não decidir presença por value === 0.

**Discriminante necessário:** Tabela e SVG no entrypoint real com actual fechado null/zero e actual aberto zero; exigir rótulos/estados distintos e preservação do zero observado.

**Critérios:** WP03.QLT.01, WP03.T01.INV.03, WP03.T05.CMP.02.

**Ownership:** runtime/planner.ts é escopo WP03; confirmar montagem no host atual antes de afirmar fechamento.

Outros locais inspecionados:

- `modules/sucafina/Sucafinav1/src/planner-accounts.ts:56-60`
- `modules/sucafina/Sucafinav1/product/planner/port.ts:153-166,192-205`
- `modules/sucafina/Sucafinav1/product/planner/overview.ts:34-40,62-65`

## Lacunas de prova e composição

### G1 — Prévia mensal e recuperação de conflito ainda não fecham o fluxo de usuário

No consumidor do snapshot, o endpoint mensal aceita apenas drafts, enquanto o produtor tem operation/entity/setting. A UI lê errors/result, mas ignora before/after e não apresenta impacto anual/meses afetados. Num 409 mantém texto e exibe valor corrente, porém conserva row.revision da carga; não há rebase/refetch que permita retry corrigido sem reload. O e2e existente cria sessão/linhas reais e testa paste inválido, correção, save, reload, filtros e official; não executa conflito concorrente, annual/spread/reset, HR ou cadastros.

**Próxima prova:** Fluxo montado com prévia de impacto, conflito entre dois operadores, preservação de outras linhas e reaplicação com revisão atual. Consumidor precisa resolver esse caminho, não apenas status de host.

**Critérios:** WP03.T02.INV.02, WP03.T02.SUC.01, WP03.T02.SUC.03, WP03.T02.CHK.03.

**Limite de pin:** product/ui e interface são leitura do snapshot W3; não atribuir este código ao pin INTERFACE903bcee sem obter e comparar seus blobs. Owner-deltas já conserva falta de provas UI, logo não é claim nova de aceite.

Locais:

- `modules/sucafina/Sucafinav1/product/ui/planner-monthly.ts:82-110`
- `modules/sucafina/Sucafinav1/product/interface/planner-http.ts:29-35`
- `modules/sucafina/Sucafinav1/product/contracts/host-context.ts:25-26,53-56`
- `modules/sucafina/Sucafinav1/product/planner/monthly-host.ts:70-96`
- `packages/app-shell/e2e/sucafina/wp03/planner-mounted.spec.ts:38-80,117-145`

### G2 — Inversão de vantagem é verificada fora do render; a diferença visual usa convenção inversa

O teste faz +30000/−10000 em advantageComparison fora do DOM. O comparisonRef entregue ao BI é compared([renewed, selected]), portanto a diferença canônica exibida é −30000/+10000. renderObservation verifica componentes, subtotal/total, coverage e origem de training, sem assertion da diferença ou de seu sentido. A distinção de sinais está documentada e não constitui defeito do motor.

**Próxima prova:** Assertar texto/label do delta efetivamente exibido, com direção baseline/candidato clara; se o aceite visual exigir vantagem +30000→−10000, usar comparação canônica inversa produzida e rotulada, sem apenas negá-la no teste.

**Critérios:** WP05.T05.CHK.20, WP05.SUC.20, WP05.T05.SUC.01.

Locais:

- `modules/sucafina/Sucafinav1/test/product/wp05/choice-history-bi.test.ts:51-55,73-79,115-128`
- `modules/sucafina/Sucafinav1/test/product/wp11/renewal-choice-fixture.ts:152-163`
- `modules/sucafina/Sucafinav1/product/analytics/decision-view.ts:17-18`

### G3 — Fábrica CLI existe, mas o HTTP observado permanece recortado ao Dashboard

createSfBiServices compõe Planner, Procurement e decisões reais. O HTTP COMPOSE3 observado constrói outra fonte de Dashboard para BI01/BI07/BI08 e bi-source usa apenas selectionRef, retornando page/year. Ele não consome a marca completa nem readBiDestination. decisionPresentation declara ausência de waterfall/timeline de decisão. Não afirmar zero callers porque o checkout de revisão é esparso. A entrada UI atual foi lida no intake do commit externo e5afff327dc64735bbd8a646124570a0c97a9c6b (blob 305ee63cd74658f6665a6ebbca885fe5995ea95f, após desconsiderar uma newline adicional no arquivo baixado): openSource envia só selectionRef em bi-source, conserva valueId apenas no histórico local e admite apenas destino page/year no mesmo path. Portanto não transporta a seleção completa nem o destino específico C17; renderBiView recebe callback simples, sem adaptador navigation.

**Próxima prova:** Composição pelo owner com a fábrica e destino C17 completos, entrada UI que transmita seleção exata, retorno de foco e provas dos oito gráficos. O handoff atual já registra o limite; não foi modificado.

**Critérios:** WP05.DOD.03, WP05.DOD.04, WP05.CMP.02, WP05.CMP.03, WP05.T04.CHK.04, WP05.T05.DOD.01.

Locais:

- `foreign-intake/WP10/apps/cli/src/sucafina-product/bi-services.ts:87-138,173`
- `foreign-intake/COMPOSE3/modules/sucafina/Sucafinav1/product/integration/bi-http.ts:63-80,90-115,125-134`
- `foreign-intake/INTERFACE5/modules/sucafina/Sucafinav1/product/interface/bi-entry.ts:46-68,112,125-127`

## Conferência dos 303 critérios

Comparação recursiva de cada par `id/text` do `canonical_work_package` com `criteria.json` no checkout de documentação indicado pelo coordenador. Resultado: zero faltantes, extras, duplicados ou divergências literais.

| WP | IDs e textos iguais | SHA-256 do receipt lido |
|---|---:|---|
| WP03 | 112/112 | `517127e8ef8079b928c438b283d7367423df73ea458e552a19f6804f8a91f644` |
| WP05 | 108/108 | `63ac6d559254512bef76fefb65de7c6a00ecea7006321fe1b202f390619384ad` |
| WP11 | 83/83 | `ca57c1a7c1d1b6693f5fa5ed8d4ffabff52b846767f2822453b971bb3ee6eb08` |

A conferência de igualdade não é uma revisão comportamental exaustiva de todos os critérios. Os campos de CI dos receipts estavam sendo reconciliados pelo coordenador; estes hashes descrevem a observação desta revisão.

## O que os consumidores e testes inspecionados realmente demonstram

| Área | Sustentado pela leitura | Limite necessário |
|---|---|---|
| Mensal | Parser preserva texto inválido; host simula/executa o domínio e retorna resultados por linha; e2e existente usa sessão/CLI e operações reais | E2e não cobre conflito concorrente/rebase, annual/spread/reset com impacto, HR nem catálogos; sem novo PASS neste review |
| HR | FTE planejado e budget autorizados vêm do produtor; rate/FX ausentes não viram custo confirmado no C02; dados pessoais excluídos da projeção BI | Numeric test termina em callbacks do render, sem destino HTTP instalado/retorno de foco |
| FX/catálogos | Host mantém FX por versão e entidades/allocations compartilhadas, com comandos do domínio e referências protegidas | Não há nova prova de UI montada nesta sessão; não usar testes de objeto como prova de operação visual |
| Overview/Versions | Contribuição nova distingue base/candidato/oficial e tem drilldown por registro/mês; Versions invoca o comando canônico | Novo export não substitui por si o Overview legado observado; este conserva o defeito C2 |
| BI01/04 | Testes usam produtor real, dispatcher e Chromium; escalas/tabela/zero/ausência/privacy têm assertions discriminantes | Callback capturado não equivale a navegação C17 instalada |
| BI02/03 | Produtor real calcula contribuições e reconciliação, usado pela fábrica CLI | Contribuições A/B perdem origem por `drilldown:null` (C1) |
| Mesmo caso antes/depois | Mutações reais de alternativa/escolha e resultados SQLite; fonte training criada por comandos Planner; escolha anterior preservada | Autoridade/captures de fixture são sintéticos; não aplica escolha; diferença visual ainda não é assertada (G2) |

## Constatações favoráveis e limites

- Capacity numeric test uses real SQLite, scoped Planner issuer, UI authority and capability dispatch; FTE/cost numeric values, independent scales, common crop, table/mouse/keyboard exact refs and exclusion of personal data are specifically asserted. Browser navigation ends at captured callback, accurately disclosed.
- Monthly/HR/catalog hosts invoke the canonical domain and preserve producer authorization/revision checks. No new concrete redaction or scale defect found in the inspected HR path.
- Same-case fixture calls real addAlternative and recordChoice mutations and persists results; it explicitly marks source declarations and grants synthetic. Choice preservation is distinct from applying any prepared command.
- New Overview contribution presents null as Unavailable and renders record/month detail. It must not be conflated with the still-mounted legacy Overview path.
- Receipts preserve explicit not-accepted/current-run-unproven conditions; historical evidence does not validate W3.

O escopo numérico foi dividido com `review_financial` e autoridade/proveniência/persistência com `review_authority`. Não foi inferida inexistência de callers a partir do snapshot esparso; o consumo CLI foi rastreado nos arquivos fornecidos em `foreign-intake`. Nenhum resultado CI foi confirmado autonomamente por este revisor.

**Parecer limitado ao pin W3. Sem aceite integral, READY, DONE ou veredicto C/D.**
