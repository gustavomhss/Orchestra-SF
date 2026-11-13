# WP05 — mapa de implementação e limites da prova

Os caminhos nesta tabela são relativos a `product/analytics/` e `test/product/wp05/`. São componentes/consumidores existentes no candidato, não afirmações de que a composição do host já os utiliza. `ci-evidence.json` registra a execução concreta e `criteria.json` mantém os 108 critérios individuais.

| Pergunta | Caminho de produto/consumo | Testes selecionados relevantes | Limite de aceitação |
| --- | --- | --- | --- |
| BI01 — orçamento, realizado, outlook | `dashboard.ts` → `factory.ts` / `consumer.ts` → `view.ts` | `dashboard-integration.test.ts`, `consumer-dashboard.test.ts`, `semantics.test.ts` | Dashboard fornece forecast registrado e limita outlook combinado; prova nova abre a página C17 Budget Overview, não oito destinos granulares |
| BI02 — composição da diferença | `planner-projected.ts`, `waterfall.ts`, `view.ts` | `planner-projected.test.ts`, `waterfall.test.ts`, `projection-validation.test.ts`, `render-completion-browser.test.ts` | Valores/endpoints/reconciliação vêm do produtor; composição no host ainda pendente |
| BI03 — contribuições para desvio | `planner-projected.ts`, `semantics.ts`, `view.ts` | `planner-projected.test.ts`, `contributions-browser.test.ts`, `geometry.test.ts`, `semantic-discriminants.test.ts` | Preserva sinais e escalas próprias; não cria componente residual |
| BI04 — capacidade e custo | `planner.ts`, `semantics.ts`, `view.ts` | `planner-integration.test.ts`, `contributions-browser.test.ts`, `consumer.test.ts` | Eixos próprios, alignmentKeys e FTE zero; falta jornada real de detalhe no host |
| BI05 — estoque de pedidos | `procurement.ts`, `filter-controls.ts`, `view.ts` | `procurement-integration.test.ts`, `procurement.test.ts`, `render-completion-browser.test.ts` | Filtros solicitam nova seleção ao host; callback não comprova lifecycle de seleção em produção |
| BI06 — idade das aprovações | `procurement.ts`, `view.ts` | `procurement-integration.test.ts`, `aging-browser.test.ts`, `render-completion-browser.test.ts` | Pontos consomem ageDays/approvalStage/holder de C02; sem parsing de histórico ou cálculo de idade no BI |
| BI07 — entradas e conclusões | `tickets.ts`, `dashboard.ts`, `semantics.ts`, `view.ts` | `tickets-integration.test.ts`, `tickets.test.ts`, `projection-validation.test.ts`, `semantic-discriminants.test.ts` | Recusa granularidade/ordem incompatíveis e conserva lacunas |
| BI08 — marcos previstos/concluídos | `milestones.ts`, `view.ts` | `milestones.test.ts`, `view-browser.test.ts`, `render-completion-browser.test.ts` | Renderer retém itens sem data; produtor seed elimina alguns itens e depende da correção WP02 |
| BI09 — parcelas da alternativa | `stored-scenario.ts`, `scenario.ts`, `decision-view.ts`, `portfolio-view.ts` | `stored-scenario.test.ts`, `scenario.test.ts`, `portfolio.test.ts`, `engine-coverage.test.ts` | Resultados C08 são consumidos sem cálculo financeiro local; host comum e cobertura completa pendentes |
| BI10 — data que muda custo/viabilidade | `scenario.ts`, `decision-view.ts`, `milestones.ts` | `scenario.test.ts`, `view-browser.test.ts`, `render-completion-browser.test.ts`, `semantic-discriminants.test.ts` | Datas/estados vêm do produtor; UI não recalcula custo de mover uma data |
| BI11 — variável que altera condição | `stored-scenario.ts`, `scenario.ts`, `decision-view.ts` | `engine-coverage.test.ts`, `sensitivity-integration.test.ts`, `render-completion-browser.test.ts` | Solver exato e resultado integrado conditioned são provas distintas; schema compartilhado e host ainda dependem dos owners |

## Consumidores comuns

- `capabilities.ts` conserva o descriptor C16 `sf_bi_view` e o handler `readBiView`, com validação fechada de input/output e fences de acesso.
- `consumer.ts` despacha uma admissão nova e verifica que projeção/apresentação correspondem. `readBiDestination` exige seleção, valor, versão, motor e C17 exatos, e retorna apenas resolução autorizada atual.
- `factory.ts` fixa a escolha do produtor durante uma chamada; views sem produtor não são inventadas.
- `contextual.ts` conserva `DashboardReadRequest.fields` e o vínculo entre escolha humana, caso, projeção e tabela. O host mantém armazenamento e autorização dos artefatos.
- `review-chart.ts` é consumidor de gráficos aprovados; catálogo, seleção humana e abertura no runtime precisam ser compostos por seus owners.

## Distinções obrigatórias de evidência

Testes puros e de Chromium em about:blank demonstram semântica/interação do componente. Os testes com Planner/Dashboard/store demonstram a integração do adapter com esses produtores reais, com principal e fronteiras de host de fixture. Nenhum dos dois níveis cria uma sessão nativa, SkillLoadReceipt ou execução provider-bound. A matriz não usa callbacks de fixture como recibos nativos nem usa uma página Dashboard como prova de detalhe granular para todos os gráficos.
