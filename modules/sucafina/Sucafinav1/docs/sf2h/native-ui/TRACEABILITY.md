# Rastreabilidade da adaptação nativa

## 1. Imutabilidade e contagem

O planejamento canônico permanece em [dbf9547211d9b0fade619790de7c19c0869b7c7d](https://github.com/gustavomhss/Orchestra-SF/tree/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan), sem alteração, cópia substituta ou renumeração.

- Fonte: `campaign.json`, blob `71b56906f8bb190c4d568f60c7511ce1ff63d5f3`.
- SHA-256 canônico declarado: `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`.
- 15 WPs; 74 tasks; 1610 critérios únicos.
- T0 `2026-11-13T04:01:10Z`, C/G7, D/G8 e GLOBAL_RELEASE inalterados.
- Nenhum critério foi promovido/aceito nesta sessão. Os registros históricos de fontes e seus limites continuam válidos nos próprios pins.

O arquivo [criteria-trace.json](criteria-trace.json) indexa **cada um dos 1610 IDs**, com JSON Pointer exato para o texto/status imutáveis e mappingRef para o escopo task/WP/campanha. Não duplica o texto canônico. A leitura documental conferiu 1610 IDs únicos, 1610 pointers resolvidos e 74 mappings de task. Isso é integridade do índice, não teste de produto.

Regra de contagem: axiomas da campanha, axiomas dos WPs e checks/axiomas das tasks. RA01–RA06 aparecem como requisitos de cobertura e novamente em resident_ai; não são doze critérios adicionais. Permanecem todos rastreados na seção de residentes. As cinco famílias (DoD, invariants, quality, completeness, success) e checks não são filtradas pela preferência de UI.

| Escopo | Tasks | Critérios retidos |
| --- | ---: | ---: |
| Campanha | — | 50 |
| WP00 · Contratos, baseline e critérios de aceitação | 4 | 85 |
| WP01 · Interface comum e navegação | 5 | 75 |
| WP02 · Dashboard e manutenção dos domínios | 4 | 78 |
| WP03 · Budget Planner e cenários | 5 | 112 |
| WP04 · Procurement orientado à decisão | 5 | 111 |
| WP05 · BI contextual e gráficos | 5 | 108 |
| WP06 · Importação com impacto e recibo | 5 | 140 |
| WP07 · Revisões, reuniões e relatórios | 4 | 86 |
| WP08 · Colaboração, vínculos e Meu trabalho | 6 | 132 |
| WP09 · Rotinas de produto com Relay | 7 | 112 |
| WP10 · Composição, revisão independente e aceitação | 7 | 171 |
| WP11 · Casos de decisão e execução preparada | 4 | 83 |
| WP12 · IA contextual e análise verificável | 4 | 108 |
| WP13 · Cenários de portfólio e sensibilidade | 4 | 68 |
| WP14 · Reavaliação e memória das decisões | 5 | 91 |
| **Total** | **74** | **1610** |

## 2. Como interpretar o índice

`mappingRef=WPxx.Tyy` leva ao agrupamento histórico N0–N10, chapter, obrigação de adaptação e grupos NUI em taskMappings. Esses agrupamentos foram preservados para integridade do índice original; não são ordens atuais de execução. O pacote operacional vigente é [execution/manifest.json](execution/manifest.json); cada work order declara os IDs consumidos em canonical.task_refs, e cada superfície declara canonicalTaskIds. `mappingRef=WPxx` conserva axiomas herdados por todas as tasks daquele WP. `mappingRef=campaign` vale para o conjunto inteiro. Nenhum critério transversal fica dispensado porque não desenha um componente.

As classes UI_REDESIGN/UI_REBIND/STATE descrevem onde muda a apresentação. RETAIN_ENGINE/RETAIN_ORACLE/LIVE_GATE/QUALIFICATION/CONTRACT/BASELINE descrevem obrigação preservada. A classe é atribuída à task para orientar revisão; não afirma classificação semântica individual nem validação dos seus critérios.

Exemplo: `WP13.T02.CHK.20` continua exigindo o oráculo canônico; seu índice leva a N6/N4 e NUI07/NUI05, com P03 FAIL58 explícito. Uma nova tela de cenários não satisfaz esse critério. Da mesma forma, C06 materialidade e C10 cobertura não viram lógica frontend por estarem citados num componente.

## 3. Mapa explícito das 74 tasks

Cada título abaixo é referência ao task existente. “Todos” significa os 15 chapters sob as regras comuns, não autorização ampla. Paths exclusivos e os DAGs de autoria, integração e qualificação estão no [manifesto de execução](execution/manifest.json). A coluna N0–N10 abaixo é apenas referência histórica; não atribui ownership ou bloqueio.

| Task canônica | Chapters / fatias | Obrigação nesta adaptação | Aceite |
| --- | --- | --- | --- |
| [WP00.T01](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP00.json) · Fixar baseline funcional e decisões de escopo | all; **N0, N10** | Baseline das 28 capacidades, 70 entradas de inventário, contexto/links e paridade; não alterar escopo. | NUI04, NUI13, NUI16 |
| [WP00.T02](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP00.json) · Definir contratos de consumo e vocabulário | all; **N0, N1** | C01–C17 e vocabulário continuam; congelar DTO/route/admission que os expõe. | NUI03, NUI04, NUI11, NUI16 |
| [WP00.T03](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP00.json) · Preparar cenários sintéticos e resultados esperados | all; **N10** | Conservar corpus e resultados esperados; fixtures de design não provam produto. | NUI04, NUI05, NUI06, NUI07, NUI08, NUI09 |
| [WP00.T04](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP00.json) · Qualificar serviços nativos de IA Relay e execução de provas | sf-routines, sf-decisions; **N1, N9, N10** | Readiness de modelo/sessão/Relay real; estado indisponível até qualificar. | NUI03, NUI11, NUI16 |
| [WP01.T01](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP01.json) · Reorganizar shell e navegação contextual | all; **N0, N2** | Trocar shell independente por 15 chapters; manter contexto/ano/back/links de todas as capacidades. | NUI01, NUI13 |
| [WP01.T02](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP01.json) · Construir os padrões de revisar, editar e decidir | all; **N2** | Compor lista/detalhe, grid e revisão com primitivas reais e hierarquia especificada. | NUI02, NUI14 |
| [WP01.T03](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP01.json) · Tornar edição, falhas e conflitos compreensíveis | all; **N1, N2** | Erro por campo, conflito e retention conforme autoridade; sem unavailable→empty. | NUI15, NUI03 |
| [WP01.T04](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP01.json) · Oferecer busca, visões salvas e entrada por responsabilidade | sf-home, sf-work; **N3** | Busca/visões pessoais/entrada por responsabilidade sem dados ou contagem restrita. | NUI10, NUI13, NUI03 |
| [WP01.T05](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP01.json) · Entregar Hoje e mesa de decisão com IA | sf-home, sf-decisions; **N3, N6** | Hoje orientado a próxima ação e mesa de decisão contextual, sem chat como home. | NUI07, NUI11, NUI10 |
| [WP02.T01](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP02.json) · Publicar as projeções autorizadas das 16 capacidades | sf-dashboard, sf-people, sf-operations, sf-portfolio, sf-procurement; **N1, N3, N5** | Expor 16 projeções Dashboard, mesmo após redistribuir presentation/Contratos. | NUI04, NUI03 |
| [WP02.T02](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP02.json) · Entregar manutenção contextual com prévia e conflito legível | sf-dashboard, sf-people, sf-operations, sf-portfolio, sf-procurement; **N3, N5** | Manutenção contextual completa; preservar fields/actions/ACL e preview de comandos amplos. | NUI04, NUI15 |
| [WP02.T03](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP02.json) · Entregar as vistas de revisão do Dashboard | sf-dashboard, sf-portfolio, sf-reviews; **N3, N8** | Separar revisão de portfólio e manutenção de projetos da mesma coleção. | NUI04, NUI09 |
| [WP02.T04](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP02.json) · Publicar a porta canônica de Hot Topics | sf-dashboard, sf-work; **N3, N9** | Hot Topic canônico, correlação e retorno; nenhum novo motor de ação. | NUI10, NUI04 |
| [WP03.T01](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP03.json) · Publicar projeções e adapter financeiro puros | sf-planner, sf-dashboard, sf-decisions; **N1, N4** | Adapter financeiro puro retido; DTO consome cálculo sem recomputar. | NUI05, NUI04 |
| [WP03.T02](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP03.json) · Entregar edição mensal e linhas OPEX/CAPEX previsíveis | sf-planner; **N2, N4** | Grid mensal OPEX/CAPEX e editor por linha; zero/branco/herdado e locks explícitos. | NUI05, NUI14, NUI15 |
| [WP03.T03](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP03.json) · Entregar planejamento de pessoas e premissas de HR | sf-planner, sf-people; **N4** | HR/rates/FTE/roster com dados salariais redigidos e mesma matemática. | NUI05, NUI03 |
| [WP03.T04](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP03.json) · Entregar FX e cadastros com escopo explícito | sf-planner; **N4** | FX e catálogos sob escopo; ausente não vira paridade. | NUI05, NUI03 |
| [WP03.T05](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP03.json) · Entregar Overview e comparação explicável entre versões | sf-planner, sf-decisions; **N4, N6** | Overview/versões/compare; official/actual/lock e explicação dos deltas. | NUI05, NUI07 |
| [WP04.T01](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP04.json) · Filas e projeções de Procurement com próxima ação verificável | sf-procurement, sf-work; **N1, N5** | Fila com holder/etapa/próxima ação e aging comprovados. | NUI06, NUI10 |
| [WP04.T02](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP04.json) · Pedido guiado e preenchimento reaproveitado com origem | sf-procurement; **N5, N7** | Pedido progressivo, reaproveitamento com origem, campos existentes e docs confirmados. | NUI06, NUI08 |
| [WP04.T03](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP04.json) · Comparação honesta e valores financeiros consistentes | sf-procurement; **N5, N9** | Comparar ofertas/FX/score elegível e componentes; mesmos números. | NUI06, NUI05, NUI12 |
| [WP04.T04](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP04.json) · Resumo por tipo de aprovação e decisão sobre a versão correta | sf-procurement; **N5** | Resumo PR/sourcing/PO da versão correta; preservar M31/MI07 aberto. | NUI06, NUI15 |
| [WP04.T05](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP04.json) · Fornecedores e preservação completa do processo de compras | sf-procurement; **N5** | Suppliers/settings/controles bancários e transições completas; emitir internamente. | NUI06, NUI04, NUI03 |
| [WP05.T01](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP05.json) · Trajetória financeira e waterfall de cenários | sf-bi, sf-planner, sf-dashboard; **N9, N4** | BI01/02, trajetória e waterfall com dados/tabela equivalentes. | NUI12, NUI05 |
| [WP05.T02](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP05.json) · Contribuições divergentes e FTE/custo alinhados | sf-bi, sf-people, sf-planner; **N9, N3, N4** | BI03/04, contribuições/FTE/custo e unidades/cobertura. | NUI12, NUI03 |
| [WP05.T03](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP05.json) · Estoque por etapa e aging de Procurement | sf-bi, sf-procurement; **N9, N5** | BI05/06, estoque não funil, aging sem data desconhecida inventada. | NUI12, NUI06 |
| [WP05.T04](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP05.json) · Tickets, agenda de marcos e catálogo consumível de BI | sf-bi, sf-operations, sf-portfolio; **N9, N3** | BI07/08 tickets e marcos, datas/fontes e catálogo consumível. | NUI12, NUI04 |
| [WP05.T05](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP05.json) · Entregar BI de consequência e sensibilidade | sf-bi, sf-decisions, sf-portfolio; **N9, N6** | BI09/10/11 de composição, consequência e sensibilidade; reutilizar motor. | NUI12, NUI07 |
| [WP06.T01](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP06.json) · Preservar formatos e normalização dos arquivos originais | sf-imports; **N7** | Formatos/abas/normalização/limites originais, inclusive caminhos específicos dos produtores. | NUI08, NUI04 |
| [WP06.T02](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP06.json) · Construir prévia do impacto e manifesto de mudanças | sf-imports; **N7, N2** | Prévia com manifesto, escopo e alterações/remoções/ignorados. | NUI08, NUI15 |
| [WP06.T03](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP06.json) · Entregar Apply explícito, reprévia e recibo fiel | sf-imports; **N7, N1** | Apply explícito, base atual/reprévia, atomicidade e receipt verdadeiro. | NUI08, NUI15, NUI03 |
| [WP06.T04](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP06.json) · Qualificar roundtrip e entregar as fronteiras de importação | sf-imports; **N7, N10** | Roundtrip e contratos de import sem perda de identidade/valor. | NUI08, NUI13 |
| [WP06.T05](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP06.json) · Extrair evidências de documentos com confirmação | sf-documents, sf-decisions, sf-procurement; **N7, N6** | Trecho/extração/confirmar e mesma evidenceRef em cenário/dossiê; scanner real. | NUI08, NUI07, NUI11 |
| [WP07.T01](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP07.json) · Entregar a seleção autorizada da pauta | sf-reviews; **N8, N3** | Seleção/ordem autorizada, competência e contagens por seção. | NUI09, NUI03 |
| [WP07.T02](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP07.json) · Preservar e apresentar uma revisão estável | sf-reviews, sf-decisions; **N8, N6** | Review preservada/meeting view, decisão e conteúdo imutável com ACL atual. | NUI09, NUI07, NUI15 |
| [WP07.T03](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP07.json) · Comparar revisões com contexto compatível | sf-reviews, sf-memory; **N8, N9** | Comparação compatível, cutoff e primeira revisão; sem recalcular história com dados atuais. | NUI09, NUI12 |
| [WP07.T04](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP07.json) · Exportar o material completo e paginado | sf-reviews; **N8, N7** | PPTX/DOCX completos/paginados e download reautorizado. | NUI09, NUI08 |
| [WP08.T01](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP08.json) · Implementar relações explícitas entre referências | sf-decisions, sf-work, sf-procurement, sf-planner; **N9** | Relações explícitas entre IDs/versões, sem posting financeiro. | NUI10, NUI03 |
| [WP08.T02](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP08.json) · Entregar comentários e pedidos contextuais de esclarecimento | sf-work, sf-decisions, sf-reviews; **N9, N8** | Comentários/perguntas contextuais; draft e versão/incarnation/ref mantidos. | NUI10, NUI15 |
| [WP08.T03](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP08.json) · Confirmar sem alteração no escopo material revisado | sf-work, sf-dashboard; **N9, N3** | Confirmação material C06; janeiro válido após fevereiro independente. | NUI10, NUI12 |
| [WP08.T04](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP08.json) · Projetar Meu trabalho a partir das fontes canônicas | sf-work, sf-home; **N3, N9** | Meu trabalho deriva das fontes com holder real; Hoje usa a mesma projeção. | NUI10, NUI04 |
| [WP08.T05](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP08.json) · Encaminhar contexto para a ação Hot Topic existente | sf-dashboard, sf-work, sf-reviews; **N9, N3** | Hot Topic handoff confirmado/deduplicado com mesmo ID/correlação. | NUI10, NUI15 |
| [WP08.T06](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP08.json) · Inicializar ciclos e direcionar perguntas decisivas | sf-decisions, sf-work; **N9, N6** | Ciclos e perguntas decisivas com destinatário/autorização/escopo. | NUI10, NUI07 |
| [WP09.T01](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP09.json) · Conectar o ciclo de rotina à admissão e aos resultados | sf-routines; **N1, N9** | Admissão/version/run/result/erro e serviço real; conservar HOLD. | NUI11, NUI03 |
| [WP09.T07](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP09.json) · Executar análise e reavaliação de decisão por Relay | sf-routines, sf-decisions; **N9, N6** | Análise/reavaliação Relay e contribuições reais; T07 conserva posição/ID canônico. | NUI11, NUI07 |
| [WP09.T02](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP09.json) · Preparar revisão com checagem de cobertura | sf-routines, sf-reviews; **N9, N8** | Preparar review com cobertura e C06 válido, sem cobrança por alteração irrelevante. | NUI11, NUI09, NUI10 |
| [WP09.T03](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP09.json) · Preparar revisão de forecast e explicar diferenças | sf-routines, sf-planner; **N9, N4** | Revisão forecast/diferenças com componentes e motivos reais. | NUI11, NUI05 |
| [WP09.T04](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP09.json) · Preparar dossiê de sourcing | sf-routines, sf-procurement, sf-documents; **N9, N5, N7** | Sourcing usa evidenceRef C14 confirmada; não escolhe/submete/aprova. | NUI11, NUI06, NUI08 |
| [WP09.T05](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP09.json) · Consolidar encaminhamentos em ações propostas | sf-routines, sf-dashboard, sf-work; **N9, N3** | Consolidar encaminhamentos como propostas, pessoa/prazo não inventados. | NUI11, NUI10 |
| [WP09.T06](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP09.json) · Adicionar recorrência e resumos internos sem ruído | sf-routines; **N9** | Schedule/timezone/pausa/revogação/dedup; sem scheduler novo. | NUI11, NUI15 |
| [WP10.T01](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json) · Compor host e módulo continuamente desde o início | all; **N0, N1** | Compor host/DTO/mount continuamente, mesma persistência e authority. | NUI03, NUI04, NUI16 |
| [WP10.T02](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json) · Executar jornadas reais e verificar experiência | all; **N10** | Jornadas reais, revisão UX e prova em candidato, não apenas mock/screens. | NUI01, NUI02, NUI04, NUI14, NUI16 |
| [WP10.T03](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json) · Executar três revisões independentes e fechar correções | all; **N0, N10** | Três revisões FINAL independentes sem autojulgamento no mesmo C. | NUI16 |
| [WP10.T04](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json) · Concluir verificação cumulativa no candidato de produto C | all; **N0, N10** | G7 cumulativo, oito receitas+adicionais, 45 checks e todos blockers resolvidos. | NUI16 |
| [WP10.T05](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json) · Fechar a campanha e entregar o produto revisável | all; **N0, N10** | D/G8 envelope evidencial e aceite S0; não encerrar por UI parcial. | NUI16 |
| [WP10.T06](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json) · Registrar equipe residente e executar MCP com contexto confiável | sf-routines, sf-decisions; **N1, N9** | 5 perfis/18skills/8packs/39ops; MCP privado e contribuição consumida. | NUI11, NUI03 |
| [WP10.T07](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json) · Compor BusinessContextService e memória Atlas transacional | sf-memory, sf-documents, sf-decisions; **N1, N9, N7** | BCS/Atlas persistente/autorizado com refs C17, nenhuma duplicação. | NUI12, NUI11, NUI03 |
| [WP11.T01](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP11.json) · Implementar caso durável e versionado | sf-decisions; **N6** | Caso durável/versionado, intenção/contexto/participantes e leitura autorizada. | NUI07, NUI03 |
| [WP11.T02](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP11.json) · Estruturar alternativas e premissas comparáveis | sf-decisions; **N6, N4** | Alternativas/premissas comparáveis e cobertura C10 correta. | NUI07, NUI05 |
| [WP11.T03](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP11.json) · Registrar escolha humana e preparar mudanças | sf-decisions, sf-procurement; **N6, N5** | Escolha humana/changes; fences e approval original, sem substituir efeito por tela. | NUI07, NUI06 |
| [WP11.T04](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP11.json) · Reconciliar recibos e retomar execução parcial | sf-decisions; **N6, N1** | Receipts, aplicação parcial/retry idempotente explícito e revogação. | NUI07, NUI15, NUI03 |
| [WP12.T01](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP12.json) · Expor ferramentas e provider de IA com escopo | sf-routines, sf-decisions; **N1, N9, N6** | Ferramentas/provider sob escopo e modelo/sessão reais, sem secrets no browser. | NUI11, NUI03 |
| [WP12.T02](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP12.json) · Interpretar intenção e descobrir contradições | sf-decisions, sf-documents; **N6, N7** | Intenção estruturada e contradições com fonte/coverage, editáveis pela pessoa. | NUI07, NUI08, NUI11 |
| [WP12.T03](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP12.json) · Criticar e validar resultados estruturados | sf-decisions, sf-work; **N6, N9** | Crítica/categorias omitidas e perguntas decisivas; revisor em execução própria. | NUI07, NUI11 |
| [WP12.T04](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP12.json) · Controlar análise assíncrona e retorno de Relay | sf-decisions, sf-routines; **N6, N9** | Async/cancel/needs-input/continuação e stale com nova versão/run, sem replay cego. | NUI11, NUI15, NUI03 |
| [WP13.T01](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP13.json) · Definir campanha e candidatos de portfólio | sf-portfolio; **N6** | Campanha/candidatos/universo e compromissos por referências atuais. | NUI07, NUI03 |
| [WP13.T02](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP13.json) · Avaliar combinações e restrições | sf-portfolio, sf-decisions; **N6, N4** | Combinações/limites/coverage; P03 completo permanece requisito/FAIL58. | NUI07, NUI05 |
| [WP13.T03](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP13.json) · Calcular sensibilidade e limites da escolha | sf-portfolio, sf-bi; **N6, N9** | Sensibilidade/unidades/limiar, sem probabilidade inventada. | NUI07, NUI12 |
| [WP13.T04](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP13.json) · Encaminhar cenário escolhido sem duplicar execução | sf-portfolio, sf-decisions; **N6** | Promover/preparar escolha no caso, sem duplicar execução/financeiro. | NUI07, NUI15 |
| [WP14.T01](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP14.json) · Classificar mudanças materiais por escopo | sf-memory, sf-decisions; **N9, N6** | Sinais materiais por recorte/condição, preservando escolha. | NUI12, NUI07 |
| [WP14.T02](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP14.json) · Recuperar casos semelhantes sob autorização | sf-memory, sf-home; **N9** | Casos semelhantes autorizados com origem, busca sem vazamento. | NUI12, NUI03 |
| [WP14.T03](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP14.json) · Comparar previsto e observado sem atribuição falsa | sf-memory, sf-reviews; **N9, N8** | Previsto/observado e cutoff compatível; sem falsa causalidade. | NUI12, NUI09 |
| [WP14.T04](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP14.json) · Deduplicar sinais e qualificar invalidação | sf-memory, sf-decisions; **N9, N1** | Dedup/invalidação por materialidade e acesso; irrelevante não recobra. | NUI12, NUI15, NUI03 |
| [WP14.T05](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP14.json) · Traduzir projeções de negócio para templates Atlas admitidos | sf-memory; **N9, N1** | Projection para templates Atlas admitidos, C17 e memória real. | NUI12, NUI11, NUI03 |

## 4. R01–R41 e IA01–IA18

A composição das tasks acima preserva as coberturas do canônico. A tabela torna o caminho de revisão direto sem inventar novos requisitos.

| Requisito | Tasks canônicas | Destinos da adaptação |
| --- | --- | --- |
| R01 · Baseline, contratos e corpus verificável | WP00.T01, WP00.T02, WP00.T03, WP00.T04 | Todos, conforme escopo de cada task |
| R02 · Navegação e contexto entre módulos | WP01.T01 | Todos, conforme escopo de cada task |
| R03 · Padrões de revisar, editar e decidir | WP01.T02 | Todos, conforme escopo de cada task |
| R04 · Salvar, corrigir e resolver conflitos | WP01.T03, WP02.T02, WP03.T02, WP04.T04 | Todos, conforme escopo de cada task |
| R05 · Busca, visões salvas e entrada por responsabilidade | WP01.T04 | sf-home, sf-work |
| R06 · Dashboard com fatos, sinais e origem | WP02.T01, WP02.T03 | sf-dashboard, sf-people, sf-operations, sf-portfolio, sf-procurement, sf-reviews |
| R07 · Manutenção contextual dos domínios Dashboard | WP02.T02 | sf-dashboard, sf-people, sf-operations, sf-portfolio, sf-procurement |
| R08 · Portfolio para revisão e All Projects para manutenção | WP02.T03 | sf-dashboard, sf-portfolio, sf-reviews |
| R09 · Uma ação operacional canônica | WP02.T04 | sf-dashboard, sf-work |
| R10 · Composição financeira explicável e adapter puro | WP03.T01 | sf-planner, sf-dashboard, sf-decisions |
| R11 · Edição mensal OPEX e CAPEX | WP03.T02 | sf-planner |
| R12 · Headcount, FTE e custo de HR | WP03.T03 | sf-planner, sf-people |
| R13 · FX, entidades e alocações | WP03.T04 | sf-planner |
| R14 · Overview, versões e cenários comparáveis | WP03.T05 | sf-planner, sf-decisions |
| R15 · Fila de compras com próxima ação e responsável | WP04.T01 | sf-procurement, sf-work |
| R16 · Pedido progressivo e reaproveitamento com origem | WP04.T02 | sf-procurement |
| R17 · Comparação de propostas, ranking e moeda | WP04.T03 | sf-procurement |
| R18 · Decisão por PR, sourcing e PO | WP04.T04 | sf-procurement |
| R19 · Fornecedores e processo completo de compras | WP04.T05 | sf-procurement |
| R20 · Oito gráficos contextuais acionáveis | WP05.T01, WP05.T02, WP05.T03, WP05.T04 | sf-bi, sf-planner, sf-dashboard, sf-people, sf-procurement, sf-operations, sf-portfolio |
| R21 · Formatos e normalização de arquivos | WP06.T01 | sf-imports |
| R22 · Prévia de importação com impacto | WP02.T02, WP03.T01, WP06.T02 | sf-dashboard, sf-people, sf-operations, sf-portfolio, sf-procurement, sf-planner, sf-decisions, sf-imports |
| R23 · Apply, revalidação e recibo | WP06.T03 | sf-imports |
| R24 · Roundtrip e paridade dos imports | WP06.T04 | sf-imports |
| R25 · Pauta selecionável e autorizada | WP07.T01 | sf-reviews |
| R26 · Revisão preservada e meeting view | WP07.T02 | sf-reviews, sf-decisions |
| R27 · Mudanças desde a revisão anterior | WP07.T03 | sf-reviews, sf-memory |
| R28 · PPTX e DOCX completos | WP07.T04 | sf-reviews |
| R29 · Relações explícitas entre registros | WP08.T01 | sf-decisions, sf-work, sf-procurement, sf-planner |
| R30 · Comentários e esclarecimentos contextuais | WP08.T02 | sf-work, sf-decisions, sf-reviews |
| R31 · Revisei e nada mudou | WP08.T03 | sf-work, sf-dashboard |
| R32 · Meu trabalho consolidado | WP08.T04 | sf-work, sf-home |
| R33 · Encaminhar para Hot Topics | WP08.T05 | sf-dashboard, sf-work, sf-reviews |
| R34 · Ciclo nativo e seguro de rotina | WP09.T01 | sf-routines |
| R35 · Rotina preparar revisão | WP09.T02 | sf-routines, sf-reviews |
| R36 · Rotina forecast e explicar diferença | WP09.T03 | sf-routines, sf-planner |
| R37 · Rotina dossiê de sourcing | WP09.T04 | sf-routines, sf-procurement, sf-documents |
| R38 · Rotina consolidar encaminhamentos | WP09.T05 | sf-routines, sf-dashboard, sf-work |
| R39 · Recorrência e resumo interno | WP09.T06 | sf-routines |
| R40 · Composição e persistência real | WP10.T01 | Todos, conforme escopo de cada task |
| R41 · Aceitação e entrega completa | WP10.T02, WP10.T03, WP10.T04, WP10.T05 | Todos, conforme escopo de cada task |
| IA01 · Intenção estruturada e editável | WP12.T02, WP01.T05 | sf-decisions, sf-documents, sf-home |
| IA02 · Contradições com evidências | WP12.T02 | sf-decisions, sf-documents |
| IA03 · Alternativas tipadas e calculadas | WP11.T02, WP12.T02, WP03.T01, WP01.T05, WP05.T05 | sf-decisions, sf-documents, sf-planner, sf-dashboard, sf-home, sf-bi, sf-portfolio |
| IA04 · Crítica de custos e dependências | WP12.T03 | sf-decisions, sf-work |
| IA05 · Perguntas decisivas e resposta com escopo | WP08.T06, WP12.T03, WP12.T02 | sf-decisions, sf-work, sf-documents |
| IA06 · Casos e escolhas persistentes | WP11.T01, WP11.T03 | sf-decisions, sf-procurement |
| IA07 · Mudanças por domínio com recibos | WP11.T03, WP11.T04, WP10.T01 | Todos, conforme escopo de cada task |
| IA08 · Reavaliação material | WP14.T01, WP14.T04 | sf-memory, sf-decisions |
| IA09 · Ciclo assíncrono da análise | WP12.T04, WP01.T05 | sf-decisions, sf-routines, sf-home |
| IA10 · Cenários de portfólio | WP13.T01, WP13.T02, WP13.T03, WP13.T04 | sf-portfolio, sf-decisions, sf-bi |
| IA11 · Documentos com fonte e confirmação | WP06.T05, WP12.T02, WP09.T04 | sf-documents, sf-decisions, sf-procurement, sf-routines |
| IA12 · Memória previsto versus observado | WP14.T02, WP14.T03 | sf-memory, sf-home, sf-reviews |
| IA13 · Entrada contextual em contrato pedido e projeto | WP01.T05, WP02.T02, WP04.T02 | sf-home, sf-decisions, sf-dashboard, sf-people, sf-operations, sf-portfolio, sf-procurement |
| IA14 · Hoje e mesa de decisão | WP01.T05, WP08.T04 | sf-home, sf-decisions, sf-work |
| IA15 · BI de composição tempo e sensibilidade | WP05.T05 | sf-bi, sf-decisions, sf-portfolio |
| IA16 · Reunião vinculada às decisões | WP07.T02, WP07.T04 | sf-reviews, sf-decisions |
| IA17 · IA e Relay nativos reais | WP00.T04, WP09.T07, WP12.T01, WP10.T01 | Todos, conforme escopo de cada task |
| IA18 · Autorização e revogação em toda a cadeia | WP10.T01, WP11.T04, WP12.T04, WP14.T04 | Todos, conforme escopo de cada task |

## 5. Residentes, MCP e Atlas — escopo preservado

| Requisito residente | Tasks canônicas | Prova canônica |
| --- | --- | --- |
| RA01 · Cinco perfis residentes registrados e contribuições distintas | WP00.T02, WP12.T01, WP12.T02, WP10.T06 | AM01 |
| RA02 · Dezoito skills carregadas com digests e outputs persistidos consumidos | WP00.T02, WP12.T01, WP12.T02, WP12.T04, WP10.T06 | AM01 |
| RA03 · Servidor sucafina-workbench e oito packs/39 operações com paridade | WP00.T02, WP10.T06 | AM02 |
| RA04 · Identidade confiável por chamada, ACL/revogação e provider/generation pinados | WP00.T02, WP00.T04, WP10.T06, WP10.T07 | AM03 |
| RA05 · BusinessContextService e memória Atlas real persistente/autorizada | WP00.T02, WP06.T05, WP14.T05, WP14.T02, WP10.T07, WP10.T01 | AM05 |
| RA06 · Revisor em execução própria e contribuições usadas em decisão/rotina | WP12.T03, WP12.T04, WP09.T07, WP10.T02 | AM01, AM04, AM06 |

Cinco perfis, dezoito skills, oito packs e39 operações continuam obrigatórios. A UI mostra contribuições e resultados dentro de Decisões/Rotinas/Memória; configuração técnica continua nos módulos Orchestra. Nenhum novo motor/MCP privado é criado para a aparência. AM01–AM06 e consumo real não são substituídos por screenshot, catálogo ou fixtures.

## 6. Contratos e fronteiras de apresentação

| Contrato | Uso nativo proposto | Semântica que permanece no produtor |
| --- | --- | --- |
| C01 | Contexto, capabilities, referências e navegação | Identidade, escopo e autoridade não vêm da URL |
| C02 | DTO de leitura por capacidade, resumos/linhas | Redaction/ACL/cálculo e origem do domínio |
| C03 | Editores e comandos com expected version | Validação, atomicidade, transição e conflito |
| C04 | Import com prévia/manifesto/Apply | Normalização, impacto real, reprévia e recibo |
| C05 | Reunião/revisão preservada e export | Conteúdo estável, compatibilidade e acesso atual |
| C06 | Trabalho, perguntas, relações, confirmações e Hot Topics | Materialidade, identidade/correlação e ação canônica |
| C07 | Catálogo/admissão/run/resultado de rotinas | Execução/receita/retomada e Schedule separado |
| C08 | Adapter para BusinessPorts e composição instalada | Persistência/autorização/recibos; não substituir runtime |
| C09 | Caso/alternativas/versões na mesa de decisão | Estado durável e participantes |
| C10 | Comparação/composição/cobertura | Regra financeira, categorias ausentes e cenário condicionado |
| C11 | Intenção/crítica/análise contextual | Modelo, sessão, host, cancelamento e resultado válido |
| C12 | Mudanças preparadas, Apply e retomada parcial | Escolha humana, precondições, idempotência/receipts |
| C13 | Sinais/memória/previsto×observado | Materialidade, cutoff, dedup e autorização |
| C14 | Documentos/evidências e portfólio | Extração/confirmar, fonte atual e avaliação canônica |
| C15 | Contribuição residente visível no contexto | Perfis/skills realmente executados e consumo comprovado |
| C16 | UI chama portas sob Request e grant reais | MCP privado com 39 operações e paridade de autoridade |
| C17 | Fonte, evidência e memória Atlas na UI | BusinessContextService, identidade física/histórica e ACL |

## 7. Visualizações e jornadas completas

| Gráfico canônico | Task | Destino |
| --- | --- | --- |
| BI01 · Trajetória budget / actual / outlook | WP05.T01 | sf-bi, sf-planner, sf-dashboard |
| BI02 · Waterfall entre cenários | WP05.T01 | sf-bi, sf-planner, sf-dashboard |
| BI03 · Contribuições divergentes | WP05.T02 | sf-bi, sf-people, sf-planner |
| BI04 · FTE e custo em painéis alinhados | WP05.T02 | sf-bi, sf-people, sf-planner |
| BI05 · Estoque de compras por etapa | WP05.T03 | sf-bi, sf-procurement |
| BI06 · Aging de aprovações | WP05.T03 | sf-bi, sf-procurement |
| BI07 · Tickets abertos e fechados | WP05.T04 | sf-bi, sf-operations, sf-portfolio |
| BI08 · Agenda de marcos | WP05.T04 | sf-bi, sf-operations, sf-portfolio |
| BI09 · Composição financeira da decisão | WP05.T05 | sf-bi, sf-decisions, sf-portfolio |
| BI10 · Linha do tempo das consequências | WP05.T05 | sf-bi, sf-decisions, sf-portfolio |
| BI11 · Sensibilidade e limite de decisão | WP05.T05 | sf-bi, sf-decisions, sf-portfolio |

As 13 jornadas J01–J13 têm exercícios explícitos em ACCEPTANCE.md. Os oito gráficos BI01–BI08 não são toda a extensão prevista: BI09–BI11 também estão cobertos. CAP01–CAP28 têm correspondência nominal completa em SCREEN-INVENTORY.md; as 42 entradas UI29–UI70 não renumeram capacidades nem tasks.

## 8. Adaptações operacionais e alterações proibidas

A apresentação original de três superfícies vira 15 chapters. As superfícies **dashboard/planner/procurement** continuam sendo boundaries de domínio/permissão, inclusive quando seu conteúdo aparece em outro chapter. Portanto, a intenção canônica de navegação completa e contexto preservado continua válida.

O agrupamento histórico N0–N10 e a decomposição operacional atual não alteram dependências canônicas, estados de execução, ownership de produtores atuais ou gates. Não alterar deadlines, dados, assertions, criterios de coverage, política financeira ou autorização para facilitar a UI. Não converter bloqueado em “fora de escopo” e não zerar status no plano original.

Toda evidência futura deve ligar: ID canônico → capacidade/rota/ação → implementação/contrato → candidato/ator/recorte → teste/prova/artefato → limite. O índice entregue cobre os dois primeiros elos e os grupos de prova planejados; os demais serão preenchidos em receipts separados após execução autorizada.


## 5. Rastreabilidade operacional após o cold review

A decomposição atual tem 78 ordens, 70 superfícies e os mesmos 74 IDs de task canônica. O [validador documental](execution/validate_plan.py) verifica referências resolvidas, unicidade, owners, sobreposição de paths e ciclos; verifica também o índice canônico contra o blob imutável fornecido. A contagem de mapeamentos prova integridade estrutural, não satisfação semântica de 1610 critérios.

Leitura por executor: somente o protocolo comum, sua ficha e os contratos/componentes/trechos canônicos explicitamente referenciados. Axiomas de campanha e WP continuam herdados, mesmo sem cópia em todas as fichas. Revisor consulta os critérios relevantes por pointer; não reescreve nem abre outro backlog equivalente.

`ARTIFACT_READY`, `INTEGRATED` e `QUALIFIED` são estados diferentes. Uma superfície de indisponibilidade pode estar corretamente implementada enquanto o produtor segue HOLD; isso não cumpre a capacidade indisponível nem libera a campanha. As provas canônicas C/D e os bloqueios herdados continuam como descritos em [ACCEPTANCE](ACCEPTANCE.md).
