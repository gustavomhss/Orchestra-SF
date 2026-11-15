# Inventário completo e mapa de destinos

**28 capacidades originais + 42 entradas adicionais de composição/fluxo = 70 entradas de inventário.** Não são 70 páginas independentes: várias são tabs, detalhes, ações ou estados dentro dos quinze chapters. Todas as funções previstas no planejamento têm destino; a contagem não altera a unidade canônica de 74 tasks.

## Legenda de evidência

- **Fonte atual:** código presente em C27 e inspecionado por leitura; o delta Reports48 de C28 foi reconciliado ao encerrar a pesquisa. Isso não significa teste executado nem aceite do composto.
- **Previsto:** obrigação canônica; mesmo quando há fonte parcial, a composição nativa ainda é proposta.
- **Nativo:** nenhuma das linhas abaixo foi declarada implementada no shell durante esta sessão.
- Estados HOLD e dependências estão em [MIGRATION-AND-HANDOFFS](MIGRATION-AND-HANDOFFS.md).
- Todas as rotas recebem o contexto server/project/installation definido em [UX-DESIGN](UX-DESIGN.md). Parâmetros de entidade são referências opacas, nunca autoridade.

## A. As 28 capacidades, sem exclusão

A fonte da lista é [src/nav.ts em C27](https://github.com/gustavomhss/Orchestra-SF/blob/b10c424a6b318879fc30f11d03ba1cfeffda7d1a/modules/sucafina/Sucafinav1/src/nav.ts); a correspondência de IDs vem do coverage canônico. Os arquivos de runtime citados estão sob `modules/sucafina/Sucafinav1/runtime/`.

| ID / origem | Destino nativo | Funções preservadas | Produtor atual / limite |
| --- | --- | --- | --- |
| CAP01 · Dashboard: Executive Dashboard | `/orchestra/sf-dashboard/executive` | Indicadores executivos, orçamento, custo por usuário, headcount/attrition, projetos/riscos/performance; drilldown, ano próprio, receita e usuários autorizados | `dashboard-budget.ts`. Dashboard roles; agregados redigidos. |
| CAP02 · Dashboard: Hot Topics & Actions | `/orchestra/sf-dashboard/hot-topics` | Criar/editar/excluir tópico e ações, responsável, prioridade, prazo, status, notas; preparar/revisar/aplicar encaminhamento sem duplicar identidade | `dashboard-people.ts + product/dashboard`. Dashboard; atribuição e ação canônica. |
| CAP03 · Dashboard: Budget Overview | `/orchestra/sf-dashboard/budget` | Budget/actual/outlook, YTD, competência, desvios e manutenção permitida de entradas/receita/usuários | `dashboard-budget.ts`. Dashboard; budgetLineWrite/linhas atribuídas. |
| CAP04 · Dashboard: OPEX Detail | `/orchestra/sf-dashboard/opex` | Owners, entradas anuais/mensais, importação, save/delete, desvios, período e origem | `dashboard-budget.ts`. Dashboard; edição ampla não implica acesso amplo. |
| CAP05 · Dashboard: CAPEX Projects | `/orchestra/sf-dashboard/capex` | Projetos/entradas CAPEX, importação, valores anuais/mensais, desvios e escopo | `dashboard-budget.ts`. Dashboard; mesmas regras financeiras. |
| CAP06 · Dashboard: Headcount Overview | `/orchestra/sf-people/overview` | Headcount, tipos/status, capacidade e saídas; distinguir ausente e zero; agregados autorizados | `dashboard-people.ts`. Dashboard; não expor Talent por agregação. |
| CAP07 · Dashboard: Team Structure | `/orchestra/sf-people/structure` | CIO/líderes/membros, organização, vínculos, save/delete, importação e exportação de membros | `dashboard-people.ts`. Dashboard; manter controles de substituição/import. |
| CAP08 · Dashboard: Talent Review | `/orchestra/sf-people/talent` | Classificação, outlook, status, notas e demais campos de Talent; alteração somente no papel admitido | `dashboard-people.ts`. Dashboard; privacidade de membro/campo. |
| CAP09 · Dashboard: Portfolio Dashboard | `/orchestra/sf-portfolio/overview` | Revisão de projetos, saúde, prioridade, budget/spent, marcos e filtros; mesma coleção de All Projects | `dashboard-portfolio.ts`. Dashboard roles/assigned domains. |
| CAP10 · Dashboard: All Projects | `/orchestra/sf-portfolio/projects` | Criar/editar/excluir/importar projetos; watch/watchList, responsáveis, datas, progresso, notas e marcos save/delete | `dashboard-portfolio.ts`. Dashboard; IDs e relações atuais. |
| CAP11 · Dashboard: IT Operations | `/orchestra/sf-operations/service` | SLA, tickets por categoria, heatmap, categorias/itens, save e import-month com prévia/substituição | `dashboard-operations.ts`. Dashboard Operations; mês e versões de catálogos. |
| CAP12 · Dashboard: IT Security KPIs | `/orchestra/sf-operations/security` | KPIs, incidentes, phishing/campanhas e ações; referência/ano próprios, save/delete e estados conhecidos | `dashboard-operations.ts`. Dashboard security; período independente. |
| CAP13 · Dashboard: IT Risks | `/orchestra/sf-operations/risks` | Risco, impacto/probabilidade, mitigação, responsável, prazo, status, notas e manutenção | `dashboard-portfolio.ts`. Dashboard risks; fatores/scoring canônicos. |
| CAP14 · Dashboard: Vendor Contracts | `/orchestra/sf-procurement/contracts` | Contrato, fornecedor, moeda/valor/tipo, vigência, renovação/aviso, avaliação e notas; save/delete, vínculos e decisão contextual | `dashboard-portfolio.ts`. DASHBOARD contracts, mesmo sob chapter Procurement. |
| CAP15 · Dashboard: Stakeholder Management | `/orchestra/sf-operations/stakeholders` | Pessoa/posição/empresa/departamento, fatores/relevância, prioridade, responsável, ação e notas; manutenção | `dashboard-portfolio.ts`. Dashboard; sem inferir principal por nome/email. |
| CAP16 · Dashboard: IT Performance Contract | `/orchestra/sf-operations/performance` | Contrato de performance, itens/subitens, pesos, score/status, responsável, marcos/trimestres; save/delete item/sub | `dashboard-portfolio.ts`. Dashboard; pesos e cálculo atuais. |
| CAP17 · Planner: Overview | `/orchestra/sf-planner/overview` | Composição financeira, budget/actual/forecast/outlook, ano, versão e cenários; comparação explicável | `planner.ts + product/finance`. Planner por papel e versão. |
| CAP18 · Planner: OPEX | `/orchestra/sf-planner/opex` | Linhas/owners/entidade/alocação/elemento/moeda; anual e 12 meses, save/delete/spread/reset; import-workbook | `planner.ts + product/planner`. Planner; budget/actual/forecast, lock e owner. |
| CAP19 · Planner: CAPEX | `/orchestra/sf-planner/capex` | Linhas CAPEX, projeto/classificação, anuais/mensais, manutenção, import, composição/cenário | `planner.ts`. Planner; não replicar engine financeiro. |
| CAP20 · Planner: Headcount | `/orchestra/sf-planner/headcount` | Posições, roster sync, tipo/FTE, salário/rates/reajustes, meses e custo; leitura/edição HR autorizada | `planner.ts`. Planner HR/finance conforme domínio; salário redigido. |
| CAP21 · Planner: Entities & allocations | `/orchestra/sf-planner/allocations` | Entidades e alocações, cadastro/edição/exclusão, alocação comum e estrutura | `planner.ts`. Planner; catálogo não vira motor de rateio. |
| CAP22 · Planner: FX rates | `/orchestra/sf-planner/fx` | Adicionar/editar/remover moedas/rates, base, moeda em uso, FX ausente e recorte | `planner.ts`. Planner; fonte e unidade preservadas. |
| CAP23 · Planner: Versions | `/orchestra/sf-planner/versions` | Criar/salvar/copiar/excluir, ano, tornar oficial, lock/unlock e comparar; manter versões/IDs | `planner.ts`. Planner; controles de oficial/actual/lock. |
| CAP24 · Procurement: Dashboard | `/orchestra/sf-procurement/overview` | Estoque por etapa, filtros, aging demonstrável, holder atual e próximos passos; registrar/download | `procurement.ts + product/procurement`. Procurement; não mostrar contagem não autorizada. |
| CAP25 · Procurement: Requests | `/orchestra/sf-procurement/requests` | Criar/salvar PR; linhas/anexos/contexto; sourcing, ofertas/score/FX/select_quote; PO, pagamento; submit_pr/submit_sourcing/submit_po/reject/cancel/issue interno | `procurement.ts`. Requester/buyer/holder conforme etapa e versão. |
| CAP26 · Procurement: My approvals | `/orchestra/sf-procurement/approvals` | Fila do holder; resumo PR/sourcing/PO; approve/reject, versão/valor congelado, ressubmissão, reconciliação e recibo | `procurement.ts + product/procurement/decision-http.ts`. M31/MI07 não resolvidos por redesign. |
| CAP27 · Procurement: Suppliers | `/orchestra/sf-procurement/suppliers` | Criar/salvar/ativar/bloquear/inativar/excluir; geral/categorias/contatos/comercial/compliance/banco, pedidos vinculados, auditoria e CSV | `procurement.ts`. Supplier admin/admin para banco/status; privacidade mantida. |
| CAP28 · Procurement: Settings | `/orchestra/sf-procurement/settings` | Formulário e listas, regras/holders de aprovação, moeda/FX, endereços/faturas/entrega, save/reset e demais opções existentes | `procurement.ts`. Procurement admin; não concede papel ao usuário. |

## B. Áreas previstas, detalhes e funções transversais

Paths HTTP abreviados pertencem a `modules/sucafina/Sucafinav1/product/` ou `apps/cli/src/sucafina-product/`; [SOURCE-BASELINE](SOURCE-BASELINE.json) identifica as fontes lidas. Os IDs UI são apenas índices desta adaptação, não novas tasks ou critérios canônicos.

| ID / vista ou fluxo | Rota/destino | Funções e estados | Planejamento / fonte / fatia |
| --- | --- | --- | --- |
| UI29 · Hoje | `/orchestra/sf-home` | Resumo autorizado de pendências, casos, runs e retomada; sem nova fila ou persistência de tarefa | WP01.T05; WP08.T04; `interface/http.ts; work-http.ts`; N3. |
| UI30 · Meu trabalho | `/orchestra/sf-work` | Aprovações, ações, perguntas, confirmações; filtros/seleções e resolver destino atual | WP08.T04; `interface/http.ts; work-http.ts`; N3. |
| UI31 · Busca SF | `/orchestra/sf-home/search` | Busca de conhecimento/registros autorizados; contagens e seleção com origem; integrada ao comando de busca existente | WP01.T04; WP14.T02; `interface/http.ts; BusinessContextService`; N3. |
| UI32 · Visões salvas | `/orchestra/sf-work/views/:viewId` | Criar/ler/alterar/excluir preferências/visões pessoais; compartilha padrão com outras listas, sem ACL derivada da view | WP01.T04; `interface/views-http.ts; personal views`; N3. |
| UI33 · Lista/criação de casos | `/orchestra/sf-decisions` | Casos persistentes, participantes, intenção estruturada e versão; criar/abrir/editar | WP11.T01; WP01.T05; `interface/http.ts; decisions/http.ts`; N6. |
| UI34 · Resumo/intenção do caso | `/orchestra/sf-decisions/:caseRef` | Contexto, objetivos, restrições, critérios, fontes e análise contextual editável | WP11.T01; WP12.T02; `decisions/http.ts; analysis-http.ts`; N6. |
| UI35 · Alternativas e comparação | `/orchestra/sf-decisions/:caseRef/alternatives` | Premissas/cobertura, simular/comparar, crítica, promover análise, critérios e explicação financeira | WP11.T02; WP12.T03; WP05.T05; `decisions/http.ts; PlannerPort`; N6. |
| UI36 · Premissas e divergências | `/orchestra/sf-decisions/:caseRef/assumptions` | Fonte/versão, categorias omitidas, confirmação, divergência e cobertura completa/parcial | WP11.T02; WP12.T02; `decisions/http.ts; C10/C14`; N6. |
| UI37 · Perguntas e ciclos | `/orchestra/sf-decisions/:caseRef/questions` | Pergunta decisiva, destinatário resolvido, resposta escopada, nova análise/run quando necessário | WP08.T06; WP12.T03; `collaboration/http.ts; decisions/http.ts`; N6. |
| UI38 · Escolha humana atual | `/orchestra/sf-decisions/:caseRef/choice` | Registrar escolha/critérios/razão; preparar/promover current choice com fence e revalidação | WP11.T03; `current-choice-http.ts; decisions/http.ts`; N6. |
| UI39 · Mudanças preparadas | `/orchestra/sf-decisions/:caseRef/changes/:changeRef` | Revisar por domínio, rejeitar/aplicar, conflitos, validação da escolha e recuperação parcial | WP11.T03; WP11.T04; `decisions/http.ts; PreparedApplyPort`; N6. |
| UI40 · Recibo/histórico de aplicação | `/orchestra/sf-decisions/:caseRef/receipts/:receiptRef` | Consultar estado após timeout, receipt autoritativo, tentativas e reenvio idempotente permitido | WP11.T04; `decisions/http.ts; application-status`; N6. |
| UI41 · Análise assíncrona | `/orchestra/sf-decisions/:caseRef/analyses/:analysisRef` | Iniciar/listar/ler/output/cancelar; needs-input, stale e retomada com nova versão | WP12.T01; WP12.T04; WP09.T07; `analysis-http.ts; SfHostServices.analyses`; N6. |
| UI42 · Campanha/candidatos | `/orchestra/sf-portfolio/scenarios/:caseRef` | Universo/candidatos/compromissos, catálogo autorizado, preview/evaluate e seleção | WP13.T01; WP13.T02; `portfolio-http.ts; decisions/http.ts`; N6. |
| UI43 · Combinações/histórico | `/orchestra/sf-portfolio/scenarios/:caseRef/results/:resultRef` | Viabilidade/condições, read/list/history/reconcile; promover e preparar sem segunda execução | WP13.T02; WP13.T04; `portfolio-http.ts; history ports`; N6. |
| UI44 · Sensibilidade | `/orchestra/sf-portfolio/sensitivity/:caseRef/:resultRef` | Unidades, parâmetro, base, limite e consequência determinística; leitura/evaluate | WP13.T03; WP05.T05; `portfolio-http.ts`; N6. |
| UI45 · Catálogo BI | `/orchestra/sf-bi` | BI01–BI11, pergunta, cobertura, filtros e tabela equivalente | WP05.T01–T05; `integration/bi-http.ts; extended-http.ts`; N9. |
| UI46 · Visual BI e drilldown | `/orchestra/sf-bi/:viewId` | Dados/opções/source/decision, seleção/ref/digest, período/versão; embutir compositores nativos nas áreas | WP05.T01–T05; `extended-http.ts`; N9. |
| UI47 · Seleção da pauta | `/orchestra/sf-reviews/agenda` | Períodos por seção, seleção e ordem exatas, cobertura e tópicos | WP07.T01; `dashboard-http.ts; reviews/http.ts`; N8. |
| UI48 · Revisões preservadas | `/orchestra/sf-reviews/reviews/:reviewRef` | Preservar/ler/histórico; meeting view estável com fontes/decisões e notas | WP07.T02; `dashboard-http.ts; reviews/http.ts`; N8. |
| UI49 · Comparar revisões | `/orchestra/sf-reviews/compare` | Anterior/atual, compatibilidade e diferenças; primeira revisão explícita | WP07.T03; `reviews/http.ts; extended-http.ts`; N8. |
| UI50 · Exportar relatório | `/orchestra/sf-reviews/reports/:reviewRef` | PPTX/DOCX completos/paginados, títulos, seções/longas notas, download autorizado | WP07.T04; `extended-http.ts; reviews/http.ts`; N8. |
| UI51 · Relações entre registros | `/orchestra/sf-decisions/:caseRef/relations` | Vínculo explícito de fontes/pedido/contrato/linha/versão; criar/ler/remover conforme contrato; contextual em cada detalhe | WP08.T01; `collaboration/http.ts`; N9. |
| UI52 · Thread contextual | `/orchestra/sf-work/threads/:threadRef` | Comentários/esclarecimentos com message/incarnation/version e acesso; deep link de origem | WP08.T02; `collaboration/http.ts; review thread routes`; N9. |
| UI53 · Confirmar sem alteração | `/orchestra/sf-work/confirmations/:selectionRef` | Recorte material C06, estado válido/stale/revogado/ausente; confirmação sem alterar domínio | WP08.T03; `collaboration service; dashboard workbench`; N9. |
| UI54 · Encaminhar Hot Topic | `/orchestra/sf-dashboard/hot-topics/proposals/:proposalRef` | Rascunho, seleção de responsável, prepare/review/apply, correlação e deduplicação | WP08.T05; WP02.T04; `dashboard-http.ts; decisions/http.ts`; N9. |
| UI55 · Arquivos/destino de import | `/orchestra/sf-imports/new` | Descobrir targets, formato/aba/opções, admitir arquivo sob limites/scanner vigente | WP06.T01; `interface/import-http.ts`; N7. |
| UI56 · Prévia/impacto de import | `/orchestra/sf-imports/:manifestId/preview` | Parse, normalização, alterados/ignorados/removidos, deltas e versão-base | WP06.T02; `interface/import-http.ts`; N7. |
| UI57 · Aplicação/recibo de import | `/orchestra/sf-imports/:manifestId/receipt` | Review/Apply explícito, reprévia por conflito, cancelamento sem efeitos e roundtrip | WP06.T03; WP06.T04; `interface/import-http.ts`; N7. |
| UI58 · Catálogo de documentos | `/orchestra/sf-documents` | Requests/search/open/sources/schemas; disponibilidade e controle de acesso | WP06.T05; `interface/document-http.ts`; N7. |
| UI59 · Extração/confirmação | `/orchestra/sf-documents/:documentRef/evidence` | Admit/extract/candidates/confirm, trecho/versão, documento alterado, parser/scanner indisponível | WP06.T05; WP12.T02; `interface/document-http.ts`; N7. |
| UI60 · Documento para cenário | `/orchestra/sf-documents/:documentRef/scenario` | Targets/preview; mesma evidenceRef confirmada no cenário e dossiê sourcing | WP06.T05; WP09.T04; `interface/document-scenario-http.ts`; N7. |
| UI61 · Sinais/materialidade | `/orchestra/sf-memory/signals` | Condições, seleção/avaliação de materialidade, deduplicação/invalidação sem cobrar mudança irrelevante | WP14.T01; WP14.T04; `memory-http.ts`; N9. |
| UI62 · Casos semelhantes | `/orchestra/sf-memory/cases` | Busca autorizada de memória/Atlas e retorno à origem sem vazar fontes | WP14.T02; WP14.T05; `memory-http.ts; BCS/Atlas`; N9. |
| UI63 · Previsto versus observado | `/orchestra/sf-memory/outcomes/:selectionRef` | Cutoff/base/resultado, compatibilidade, lacunas e ausência de atribuição causal | WP14.T03; `memory-http.ts`; N9. |
| UI64 · Catálogo/admissão de rotinas | `/orchestra/sf-routines` | Catálogo e prepare/read admission, receitas pinadas, modelos/sessões admitidos; sem bypass | WP09.T01; WP12.T01; `BusinessPorts.routines; host-context`; N9. |
| UI65 · Execução/resultado de rotina | `/orchestra/sf-routines/runs/:runRef` | Preparar revisão, forecast, sourcing, encaminhamentos e análise; ler resultado/cancelar/retomar conforme produtor | WP09.T02–T05; WP09.T07; `interface/http.ts; SfHostServices.routineRuns`; N9. |
| UI66 · Recorrência | `/orchestra/sf-routines/schedules/:scheduleRef` | Create/update/pause/list/readRun via Schedule; timezone, revogação e dedup; HOLD até readiness real | WP09.T06; `BusinessPorts.schedules`; N9. |
| UI67 · Login/contexto/acesso | `/orchestra/sf-home/context` | Seletor do shell, contexto SF, Microsoft login/logout/retorno, B2B, instalação indisponível e troca segura | WP00.T04; WP10.T01; `local/entry.ts; local-identity.ts; chapter-route.tsx`; N0; N1. |
| UI68 · Exports de dados/PO | `/orchestra/sf-imports/exports` | Export JSON administrativo, workbook Excel do Planner, suppliers CSV, request register e PO interno; links contextuais e downloads autorizados | WP00.T01; WP04.T05; WP06.T04; `runtime/application.ts; procurement.ts`; N7. |
| UI69 · Ferramentas locais de administração | `/orchestra/sf-home/administration` | Notificações/backups existentes somente no perfil local operator; não disponibilizar no cloud/Microsoft por conveniência | WP10.T01; `local/entry.ts`; N1. |
| UI70 · Estado/perfil de residentes | `/orchestra/sf-routines/residents` | Contribuições dos cinco perfis, dezoito skills, oito packs/39 operações e links para ferramentas Orchestra quando permitidos; diagnóstico só autorizado | WP10.T06; WP10.T07; `resident-ui-consumption; host services`; N9. |

## C. Operações e informações que o redesenho precisa conservar

| Família | Inventário funcional de preservação | Composição proposta |
| --- | --- | --- |
| Budget Dashboard | Entradas anuais/mensais, aplicação de valor anual, receita, usuários, desvios, import/delete; IDs/versões e atribuição de linhas | Editores de detalhe e revisão do escopo; tabela de leitura separada da edição |
| Pessoas/Hot Topics | saveCio/saveLeader/deleteLeader/saveMember/deleteMember; import/exportAllMembers; tópicos, ações, responsáveis, prazo, prioridade/status/notas | Editor de objeto, import com impacto e lista canônica de ações |
| Operações/Segurança | SLA/tickets/heatmap/categorias/itens/import-month; KPI, campanhas, incidentes, ações e referência | Tabs de serviço/segurança; alteração de catálogo e import nunca no clique de um KPI |
| Projetos/Riscos/Contratos/Stakeholders | save/delete/import de projeto, marcos save/delete; riscos/fatores, contrato/moeda/renovação/aviso, stakeholders/fatores e ações | Listas e detalhe, manutenção da mesma coleção |
| Performance | Items/subitems save/delete, pesos, scores, status/trimestre e responsáveis | Lista hierárquica dentro da tela com totais explicados |
| Planner | Version save/copy/official/lock/unlock/delete; linhas save/delete/spread/reset; positions/HR/rates, roster sync; entities/allocations/common; FX save/delete; import-workbook | Grid, editor por linha, revisão de alterações e gestão de versões |
| Procurement | create/save/submit_pr/submit_sourcing/select_quote/submit_po/approve/reject/issue/cancel; transições e holder por etapa; referências de contrato/asset não se tornam vínculos financeiros implicitamente | Formulário progressivo, comparação, resumo de aprovação e recibo |
| Suppliers/Settings | create/save/activate/block/inactivate/delete/change-bank; dados gerais, categorias, contatos, comercial, compliance, banco, pedidos/auditoria; settings save/reset, FX, regras/formulários/endereço | Fichas e formulários administrativos sob papel/estado |
| Colaboração | Relações explícitas, comentários/perguntas/respostas, confirmação C06, ciclos e Hot Topic handoff | Painel de contexto e destinos por thread/seleção, sem motor de tarefas novo |
| Decisão/Portfólio | Intenção, alternativas, cobertura/critério, choice/current-choice, change prepare/review/apply/reject, receipts; portfolio catalog/preview/evaluate/read/list/history/reconcile/select/promote/prepare; sensitivity units/evaluate/read | Páginas amplas com condição/versão e aplicação por domínio |
| Import/Documentos | targets/reference/admit/preview/detail/apply; formato/aba/opções; document requests/search/open/schemas/sources/admit/extract/candidates/confirm e scenario targets/preview | Fluxos explícitos, mesma evidenceRef, limites e scanner atuais |
| Arquivos/backup | Upload/download/asset-link privados com recordVersion, captura/remoção de referências e scanner; backup-import JSON administrativo e export Excel do Planner; preservar formatos/abas de cada produtor (inclusive caminho Operations que anuncia XLSM, sujeito à validação real) | Seções de anexo nos objetos e Importações; restauração administrativa com escopo explícito, sem unificar limites por conveniência |
| BI/Reuniões | options/data/source/decision; pauta/review-preserve/read/history/compare; review-update/source, referências de thread/message/incarnation/version; PPTX/DOCX | Visuais com tabela equivalente, reunião preservada e export completo |
| Rotinas/Memória | Catálogo/admissão/run/resultado/estado; schedule create/update/pause/list/readRun; memory catalog/conditions/signals/materiality/outcome/condition/outcome-selection | Disponibilidade real, versões, evidência e escolha humana |

**Campos não são descartados por não caberem na primeira dobra.** Os grupos de campos completos dos produtores (incluindo endereço, contatos, banco, compliance, notas longas, watchList, itens/subitens, moedas e flags de import) permanecem em seções de detalhe ou etapa do fluxo. O envelope nativo define DTOs por capacidade; não se usa um formulário genérico que exponha o snapshot bruto.

## D. Estado atual versus alvo

| Área | O que se observa nas bases fixadas | O que falta para o alvo nativo |
| --- | --- | --- |
| 28 capacidades | Contribuições de domínio e renderizadores HTML, `screen-shell.ts` e runtime montado | Projeções tipadas próprias para consumo browser e composição SolidJS por chapter |
| Produto ampliado | Handlers e serviços de decisão, docs/import, colaboração, BI/reviews, memória e rotinas | Adapters nativos, DTOs, registro, estados completos e provas no composto |
| Procurement53 / CurrentChoice46 | Fonte admitida no stack com limitações explícitas | Fechamento M31/MI07 pelo produtor; UI não pode contornar |
| Portfolio54 + Runtime56 | C27 compõe material; P03 FAIL58, nova qualificação ainda necessária | Prova P03 original por responsável; cenários nativos depois |
| Reports48 | Unidade de 45 paths composta em C28; qualificação HOLD, quatro jornadas abertas | Consumir contrato reconciliado, sem transferir PASS da fonte |
| Decisions52 | Fonte não liberada no pin reconciliado por 60; nominal 06 3 PASS / 2 FAIL | Release explícita e consumer ACK antes da composição; M31/MI07 preservados |
| Native41 / Schedule | Fonte integrada, readiness real não estabelecida | Admissão/continuação/serviços configurados e AMs; sem botão de sucesso simulado |

## E. Cobertura de visualizações e assistência

BI01–BI08 são os oito gráficos operacionais originais; BI09–BI11 ampliam consequência e sensibilidade. O catálogo completo, e não apenas os oito iniciais, deve ser mantido. São composições dos dados calculados pelo domínio.

IA01–IA18, R01–R41, RA01–RA06, cinco perfis residentes, dezoito skills, oito packs/39 operações, C01–C17 e J01–J13 estão indexados em [TRACEABILITY](TRACEABILITY.md). O menu não expõe um item por skill ou operação: a capacidade aparece no contexto da tarefa, com Rotinas/Decisões para execução e ferramentas Orchestra para configuração técnica autorizada.
