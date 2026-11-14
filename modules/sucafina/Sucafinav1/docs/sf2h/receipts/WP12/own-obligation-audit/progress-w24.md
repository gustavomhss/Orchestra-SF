# WP12 — avanço das 27 obrigações após W24

Este adendo preserva o mapa D21 e os seus 108 critérios, 50 herdados, 18 skills, cinco perfis e 39 rotas AM02. Os textos e estados canônicos continuam nos arquivos publicados. O JSON adjunto mantém os 27 índices, perfil/skill/operação, ponteiro canônico e critérios vinculados, com ações próprias e pré-condições separadas.

## Resultado observado

O run **43611121344**, produto W24 **2ef423f09e0297fd9edb3c3e3f703d00410033bd**, terminou com **2 PASS, 0 FAIL, 496 asserts**, em 430,66 segundos. O [recibo terminal](../resume-20261114/run-19-new-missions.json) contém os 24 markers exatos, hash do log e quatro blobs de fontes confirmados por GitHub MCP. As cinco observações do catálogo estavam vazias; as duas missões registraram indisponibilidade. Não houve inferência, QuestionProposal, ContextualBIProposal, recibo de ferramenta nativa ou consumidor de contribuição nativa.

| Obrigação original | Código próprio | Prova deste voo | Trabalho que permanece |
|---|---|---|---|
| 16 — Question → handoff | Publicado; blob621efad2 | Preparação UI real; ação e relação C06; consumidor humano, recusa e retry/reabertura preservando uma ação | Executar a ramificação nativa existente com modelo real e comprovar seu recibo/QuestionProposal/consumidor C11 |
| 10 — BI → KPI | Publicado; blob7ddbda1c | Fontes públicas distintas de série/KPI no mesmo caso/período; KPI78000 igual aos12 componentes efetivos; WP05 e UI KPI reabertos; zero observado e ausências preservados | Executar a ramificação nativa e resolver a descoberta pública dos handles BI; a fonte auxiliar do KPI permanece no recibo da ferramenta, separada da proposta fechada |
| 11 — Meeting → review | Publicado em W25; blob33a81033; C25 tipos/guards PASS | Revisão estática e typecheck/guards hospedados; produto ainda não executado | CI próprio do novo driver, depois recibos/resultado/consumidor nativos quando houver modelo |
| 18/19 — Executive → report/artifact | Mesmo driver publicado em W25; C25 tipos/guards PASS | Revisão estática das seleções públicas humanas,44 células DOCX e consumo do artifactRef devolvido pela chamada nativa; ainda não executado | CI e caminho nativo efetivo; o teste original de403 histórico permanece intacto |

Assim, **cinco das27 entradas antes sem driver ganharam implementação própria**. Duas têm produção/consumo/reabertura humanos observados; três têm código publicado, revisão estática e typecheck/guards hospedados, com produto ainda não executado. **Nenhuma das 27 ganhou aceite nativo ou AM02 neste adendo.** O C25 run **43612042512**, produto **dc8f3b19d40f52c19aabd219544c291460592b99**, passou sem diagnósticos; esse check não executa as rotas de produto. O resultado BI não preenche a rota distinta Forecast → KPI.

## Trabalho próprio restante

| Grupo | Entradas | Próxima ação própria | Pré-condição externa identificada no recorte consumido |
|---|---:|---|---|
| Trabalho atual | 2 | Investigar a seleção pública Procurement ligada às fontes e à condição do mesmo caso; se válida, escrever driver separado e exigir consumidor, isolamento e revogação reais | O seletor de caso exige workSignals ausente. Isso não prova indisponibilidade de todas as seleções: o ramo Procurement existente é distinto e está em revisão |
| Compra/recibo | 4 | Usar uma escolha Procurement real, preparar mudanças pela rota humana, receber o alvo público e executar a skill/consumidor de recibo | C12 tem emissor legítimo de alvo para operação PR replace, mas o produtor C09 examinado simula base Planner. Não foi identificado produtor público da escolha Procurement exigida; inventar ChoiceRecord não é solução |
| Contrato | 2 | Manter parser/documento/contrato reais e acrescentar as chamadas na skill exata após a reconciliação do input | Produtor exige ref de superfície Procurement enquanto o contrato real é Dashboard; com documentos também há incompatibilidade entre id de schema e seletor completo. Objetivo humano não contorna esses gates |
| Forecast/KPI | 2 | Identificar relação real de métrica com a comparação Planner antes de escrever a rota exata | KPI Dashboard não é outra vista do mesmo produtor Planner. Copiar números ou usar a fonte BI não estabelece a proveniência exigida |
| Rotinas/watch | 12 | Consumir a montagem nativa publicada e escrever os witnesses e consumidores factuais por skill | Host consumido não fornece native a createSfRoutineServices nem anuncia seus descritores. Nome público de receita não cria admissão/run/result/watch governados |

As22 entradas sem implementação permanecem abertas. Vinte têm pré-condições concretas nas fontes consumidas; duas estão em investigação própria de uma rota pública alternativa. Isso não apaga o trabalho WP12 posterior ao delta do owner. Também continuam separados os cinco outputs ausentes enumerados no JSON: AnalysisPlan, EvidenceCandidate contratual, PreparedChangeSet, UnresolvedCondition independente e MatchExplanation de caso anterior.

## Rastreabilidade e limites

Os [pins adicionais](progress-w24-source-pins.json) têm 18 arquivos completos recuperados por GitHub MCP no D24 **24bae062742ad51abe80c2f50f62f9e5fe1049d1**, com URL imutável, Git blob, SHA256 e tamanho. O [mapa das 27 obrigações](progress-w24.json) liga cada índice à ação e à prova. Paths de scratch são identificados como metadados originais; não são links obrigatórios do pacote.

Nenhum resultado do Procurement ainda em andamento é antecipado. Não houve execução de produto ou typecheck local, edição de fontes alheias, alteração dos drivers congelados ou mudança de política financeira. O pacote não declara dívida própria zerada nem WP12 completo.
