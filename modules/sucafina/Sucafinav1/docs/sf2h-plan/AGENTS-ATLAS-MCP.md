# Equipe residente, MCP Sucafina e Atlas SF

**Especificação integrada à campanha; implementação e provas de produto: NOT_RUN.** O antigo adendo foi reconciliado em `campaign.json`, C15–C17, WPs, tarefas, ownership, cronograma, axiomas e provas. A proposta original está preservada em [sources/AGENTS-ATLAS-MCP-ORIGINAL.md](sources/AGENTS-ATLAS-MCP-ORIGINAL.md).

## O que chega ao trabalho de André e do time

O produto entrega cinco perfis com missões claras, dezoito skills e resultados usados na interface. A equipe aparece no contexto do caso, forecast, compra, portfólio, reunião ou memória. Cada contribuição indica o que examinou, o que falta, o que propõe e qual ação humana permite continuar. O usuário pode abrir as fontes, revisar condições, contestar a proposta e retomar a análise depois.

Os nomes e paths abaixo são contratos para implementação. A presença desta especificação não significa que os agentes estejam instalados ou executando.

## Cinco perfis

| Perfil | Missão | Skills permitidas |
| --- | --- | ---: |
| `sf_maestro` | Enquadrar intenção, coordenar especialistas pertinentes e preparar revisão/perguntas. | 7 |
| `sf_finance` | Reconciliar forecast, comparar cenários e calcular sensibilidade pelo motor canônico. | 5 |
| `sf_procurement` | Comparar propostas e condições e preparar dossiê sem aprovar compra. | 5 |
| `sf_portfolio` | Examinar dependências, restrições e combinações com fontes confirmadas. | 5 |
| `sf_reviewer` | Contestar a proposta e testar a sustentação em execução própria. | 3 |

O coordenador SF é um perfil empresarial chamado `sf_maestro`; ele não renomeia o Maestro nem substitui seus seats técnicos. Os especialistas só recebem contexto e operações pertinentes. O Revisor usa uma sessão nova e uma execução própria, ligadas ao digest da proposta contestada. Sua avaliação não concede aprovação de compra.

## Dezoito skills com resultados consumidos

| Skill | Perfis | Saída tipada | Tasks consumidoras |
| --- | --- | --- | --- |
| `sf-enquadrar-decisao` | sf_maestro | IntentFrame, AnalysisPlan | WP11.T01, WP01.T05 |
| `sf-preparar-revisao-executiva` | sf_maestro | DecisionBrief | WP07.T01, WP07.T02, WP01.T05 |
| `sf-coordenar-perguntas` | sf_maestro | QuestionProposal | WP08.T02, WP08.T06, WP01.T04, WP01.T05 |
| `sf-explicar-forecast` | sf_finance | FinancialAnalysis | WP01.T05, WP05.T01, WP09.T03 |
| `sf-comparar-cenarios` | sf_finance | ScenarioComparison | WP01.T05, WP05.T05, WP11.T02 |
| `sf-avaliar-sensibilidade` | sf_finance | SensitivityResult | WP05.T05, WP01.T05 |
| `sf-comparar-sourcing` | sf_procurement | CommercialComparison | WP01.T05, WP09.T04 |
| `sf-revisar-condicoes-contratuais` | sf_procurement | CommercialGap, EvidenceCandidate | WP09.T04, WP11.T02, WP01.T05 |
| `sf-preparar-compra` | sf_procurement | PreparedChangeSet, DossierDraft | WP11.T03, WP09.T04, WP01.T05 |
| `sf-revisar-dependencias` | sf_portfolio | DeliveryAssessment, DependencyConflict | WP13.T01, WP01.T05, WP08.T06 |
| `sf-compor-portfolio` | sf_portfolio | PortfolioComparison | WP01.T05, WP05.T05, WP13.T04 |
| `sf-reavaliar-compromissos` | sf_portfolio | ReconsiderationProposal | WP01.T05, WP08.T04, WP09.T07 |
| `sf-contestar-decisao` | sf_reviewer | CritiqueReport, UnresolvedCondition | WP11.T02, WP01.T05, WP08.T06 |
| `sf-revisar-evidencias` | sf_reviewer | ClaimIssue | WP01.T05, WP06.T05, WP11.T02 |
| `sf-extrair-evidencias` | sf_procurement, sf_maestro | DocumentEvidence | WP01.T05, WP11.T02, WP09.T04 |
| `sf-produzir-bi-contextual` | sf_finance, sf_portfolio, sf_maestro | ContextualBIProposal | WP05.T05, WP01.T05 |
| `sf-produzir-material-reuniao` | sf_maestro | MeetingMaterialProposal | WP07.T02, WP07.T04, WP01.T05 |
| `sf-consultar-memoria-decisoria` | sf_maestro, sf_finance, sf_procurement, sf_portfolio, sf_reviewer | CaseRecall, MatchExplanation | WP01.T05, WP11.T01, WP09.T07 |

A [matriz de consumo](resident-ui-consumption.json) detalha entrada na interface, dados exigidos, grants, saídas, persistência, falta/falha/stale e contraprovas de cada contribuição. A allowlist normativa fica em [agents-atlas-mcp.json](agents-atlas-mcp.json). `required_operations` é o subconjunto necessário para um uso; `authorized_operations` é o teto do manifesto, sempre limitado também pela autoridade atual do usuário e do domínio.

C15 exige arquivos reais de perfil e `SKILL.md` distribuídos com o produto, fonte reservada, versão, SHA-256 dos bytes e do conteúdo efetivamente injetado por `SessionV2.skill`. O recibo conserva sessão, run, modelo efetivo, mensagem de carga, contexto, output persistido e consumidor. Um nome de skill no catálogo não satisfaz essa condição.

## Um MCP específico para SF

O servidor lógico é **`sucafina-workbench`**. São oito packs e 39 operações, com schemas, handlers, producers, consumers, grants e evidências no manifesto.

| Pack | Operações | Catálogo |
| --- | ---: | --- |
| Performance | 4 | `sf_dashboard_read`, `sf_kpi_explain`, `sf_bi_view`, `sf_source_get` |
| Planning | 5 | `sf_forecast_compare`, `sf_scenario_simulate`, `sf_scenario_compare`, `sf_sensitivity_evaluate`, `sf_portfolio_evaluate` |
| Procurement | 4 | `sf_request_read`, `sf_supplier_read`, `sf_contract_read`, `sf_sourcing_compare` |
| Decisions | 5 | `sf_case_read`, `sf_case_draft`, `sf_alternative_draft`, `sf_change_prepare`, `sf_receipt_get` |
| Collaboration | 5 | `sf_work_list`, `sf_question_prepare`, `sf_answer_read`, `sf_relation_read`, `sf_handoff_prepare` |
| Documents & Reports | 5 | `sf_document_extract`, `sf_import_preview`, `sf_review_prepare`, `sf_report_prepare`, `sf_artifact_get` |
| Knowledge / Atlas SF | 5 | `sf_context_get`, `sf_knowledge_search`, `sf_evidence_get`, `sf_decision_recall`, `sf_freshness_check` |
| Routines | 6 | `sf_routine_catalog`, `sf_routine_prepare`, `sf_routine_run`, `sf_routine_status`, `sf_routine_result`, `sf_watch_prepare` |

C16 usa wrappers nativos `sf_*`, contexto confiável `Tool.Context` e uma conexão MCP privada em processo por chamada. O host vincula instalação, projeto, location, sessão, run, caso, principal, perfil e skill. A lease privada contém operação e digest; nenhum argumento do modelo cria identidade. O destino revalida a autorização e usa as mesmas portas da UI, com os cálculos, locks, versões e transições do domínio.

Configuração externa homônima gera `provider-conflict`. A ponte utiliza a factory pinada e não resolve autoridade pelo nome do servidor. Revogação, expiração, cancelamento, reinício e mudança de geração invalidam o contexto. A solução não exige endpoint corporativo novo, OAuth ou credenciais adicionais. Relay continua sujeito à admissão nativa C07.

## Atlas SF Business Profile v1

C17 adapta o Atlas existente à memória empresarial. `BusinessEvidenceRef` referencia dados/documentos com versão, encarnação e autorização. Sua referência externa não é fingida como um arquivo de código. A tradução usa os templates reais `task` e `project`; metadados empresariais adicionais ficam em envelope próprio.

O `BusinessContextService` seleciona apenas registros atualmente autorizados e verificáveis antes de `createMemoryRead`. Owner e kind não são filtros de autorização aceitos do modelo. Revogação de uma dependência retira a projeção inteira. O ledger da decisão é a origem canônica; falha de scanner ou escrita mantém o outbox pendente ou recusado, sem declarar memória persistida.

A fachada síncrona `DurableMemory` opera sobre um snapshot preparado dentro da transação assíncrona C08. Evento, índice de referências, idempotência e confirmação do outbox são gravados juntos. O estado protegido `__sfProductV1.atlas` não entra em exportações de dados empresariais. A prova exige leitura após reinício, acesso revogado, referência substituída e scanner real com casos clean/canary/indisponível.

O empacotamento público usa `@orchestra/atlas-boundary/business-memory-ports`. WP10.T07 possui exceções exatas para export, entry, gerador, artefatos gerados e teste; não recebe liberdade para alterar os algoritmos do Atlas. Os detalhes e fontes primárias estão em [specs/resident-runtime.md](specs/resident-runtime.md).

## Quem constrói e quando integra

| Unidade | Responsabilidade | Reserva alvo |
| --- | --- | --- |
| WP10.T06 | Registro de perfis, loader e MCP com identidade por chamada | T+10–45; incremento nativo até T+16 |
| WP10.T07 | Packaging Atlas, contexto autorizado e persistência | T+10–55; roundtrip até T+45 |
| WP14.T05 | Tradução empresarial pura para os tipos reais Atlas | T+10–20 |
| WP12.T01/T02 | Perfis, fontes das 18 skills, manifests e interpretação | Probe até T+13; bundle completo até T+42 |
| WP06.T05 | Documento e evidência autorizados, extração e adapter RAG | Referências até T+20; extração até T+35 |

Os [19 handoffs](output-handoffs.json), os dezoito leases de fonte e as alocações de [schedule.json](schedule.json) são normativos. Interfaces antecipadas permitem construção paralela; consumo final exige o produtor implementado. Os intervalos são reservas, não medições de produtividade.

## Seis provas integradas

| Prova | Resultado exigido | Pacotes |
| --- | --- | --- |
| AM01 | Perfis e skills reais | E11, E16 |
| AM02 | Paridade dos oito packs | E01, E16 |
| AM03 | Identidade, isolamento, revogação e provider | E11, E12, E15, E16 |
| AM04 | Escolha, mudanças preparadas e resposta perdida | E10, E16 |
| AM05 | Evidências e memória Atlas após reinício | E12, E15, E16 |
| AM06 | Rotina nativa com contribuições e retorno | E11, E13, E14, E16 |

[resident-proof-plan.json](resident-proof-plan.json) especifica atores, casos, checks, candidato, janela, rechecagem e recibos. Cada uma das dezoito skills precisa de carga real, saída persistida e uso observável. AM02 também testa chamadas diretas ao MCP; não exige uma skill artificial para esconder a ausência de paridade do handler.

Todos os níveis têm DoD, invariants, quality standards, completeness criteria e success criteria. Uma aprovação estrutural ou um parecer favorável do plano não aprova os critérios de implementação.
