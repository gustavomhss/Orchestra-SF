# Orchestra-SF — contratos reconciliados da equipe residente, MCP e Atlas

**Estado: especificação integrada; planejamento APPROVED_FOR_EXECUTION após rechecagem independente. Implementação e provas de produto: NOT_RUN.** [Pareceres e SHA examinado](../formal-review/round-2/SUMMARY.md).

Este documento explica o delta técnico de FR1-A, FR1-B e FR1-C, incluindo T-F01/T-F02/T-F03 e a parte técnica de P-F01/E-F01. O snapshot do plano é 5e6510cf5f514d30116d989ef27ee529b02f3184; a baseline de código examinada pelo GitHub MCP é 9e4f3d35833f9b2cea6abdf58f42331f3973d9bf. Não houve alteração de código do produto, GitHub, Azure, deploy, identidade empresarial ou permissões da instalação.

A especificação normativa está em [../campaign.json](../campaign.json), com espelhos em contracts.json e agents-atlas-mcp.json. Ela fornece contratos completos C08/C09/C11/C13/C14 alterados e C15/C16/C17 novos, manifestos 5/18/8, 39 operações, seis provas integradas, três novas tasks e acréscimos às tarefas/WPs afetados. Os artefatos derivados devem ser regenerados a partir da campanha integrada. Pareceres históricos permanecem preservados.

## 1. Decisões de arquitetura

### 1.1 A identidade percorre uma ponte privada por chamada

O MCP provided da baseline recebe name, key e connect sem contexto de usuário. O cliente padrão transmite name e arguments; o contexto nativo usado na permissão não segue automaticamente ao servidor. Configuração com o mesmo nome ainda tem precedência sobre provided. Portanto, capturar um actor global ou confiar em actor vindo dos argumentos é incompatível com duas sessões concorrentes. Fontes: [packages/core/src/mcp/provided.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/mcp/provided.ts) e [packages/core/src/mcp.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/mcp.ts).

O caminho escolhido usa as APIs públicas que já existem: Host.Contribution.locationNodes, Tools.Service.register, Tool.Context e o SDK Server/Client/InMemoryTransport. App Dock já usa esse transporte em processo com handlers ListTools/CallTool. A nova contribuição de SF é composta explicitamente pela instalação; não substitui os serviços reservados de sessão nem altera engines. Fontes: [packages/core/src/tool/tool.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/tool/tool.ts), [packages/core/src/tool/tools.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/tool/tools.ts), [packages/core/src/host.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/host.ts) e [modules/app-dock/src/dock-mcp.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/app-dock/src/dock-mcp.ts).

Há um único servidor lógico, **sucafina-workbench**, com oito packs. Cada chamada usa uma instância de transporte privada, como uma conexão autenticada de curta duração. Isso não cria um servidor por persona, listener HTTP, conta, OAuth ou endpoint empresarial novo.

A sequência normativa é:

1. O pedido SF passa pelo authenticator existente. O host lê o caso real, sua versão e encarnação, escolhe o perfil registrado e confere a skill carregada.
2. O host cria uma SessionV2 dedicada e guarda a ligação installation/project/location/session/run/case/principal/profile em um registro privado. A referência de autoridade conserva o Request real somente em memória; não reconstrói credenciais a partir de actorId.
3. Um wrapper sf_* recebe Tool.Context do runtime. Ele exige a ligação exata e confere session, agent, profile, caso, estado, versão, permissões e concessão da operação.
4. A ponte cria um par privado de Client/Server e uma CallLease fechada no handler. A lease contém operação, digest do payload, callId, generation, expiração e referência da autoridade; esses campos nunca são argumentos do modelo.
5. Initialize e listTools usam o objeto do servidor criado pela factory pinada. CallTool revalida a lease e encaminha ao mesmo dispatchSfCapability usado pela UI, e daí à porta real do domínio.
6. O domínio repete Application.authenticate com o Request verdadeiro e o roleMap/access do snapshot corrente; conserva seus locks, CAS, cálculo e política. O retorno também é revalidado antes de chegar ao modelo, interface, memória ou arquivo.
7. A lease é consumida e o transporte fechado. Mudança de generation, cancelamento, expiração ou revogação invalida a chamada. Reinício exige nova ligação autenticada.

A identidade é a ligação ao objeto e à autoridade do host. Um serverInfo com nome conhecido não é autenticador. Antes da descoberta/chamada, Mcp.config lê a configuração efetiva sem conectar; um sucafina-workbench homônimo, inclusive colisão normalizada, produz provider-conflict. A ponte nunca resolve esse servidor pelo nome nem cai no provider configurado. Ferramentas externas mcp_* continuam negadas aos perfis SF.

A lease dura no máximo cinco minutos. Não é autorização financeira. Seu escopo é a interseção de principal atual, instalação/projeto/location, sessão/caso, perfil/skill, operação e regra do domínio. sf_routine_run exige admissão C07 real ainda válida. Se a rotina não dispõe de autoridade revalidável, seu estado é needs-input/denied; não se inventa uma conta de serviço.

A API Application.authenticate e as três surfaces existentes permitem essa fronteira no composition root já autorizado. O plano não pede um quarto Surface nem novos grupos. Fonte: [modules/sucafina/Sucafinav1/runtime/application.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/runtime/application.ts) e [modules/sucafina/Sucafinav1/src/identity.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/src/identity.ts).

### 1.2 Perfis e skills possuem conteúdo, carga e consumo verificáveis

AgentV2.transform/draft.update fornece o registro de perfis. SkillV2 admite fontes reservadas e devolve o conteúdo parseado. SessionV2.skill registra a skill como contexto; messages/context permitem conferir o conteúdo efetivamente injetado. Agent.Info.skills sozinho é catálogo. SessionV2.generate é tool-less e não demonstra a execução de ferramentas. Fontes: [packages/core/src/agent.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/agent.ts), [packages/core/src/skill.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/skill.ts) e [packages/core/src/session.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/session.ts).

Os IDs SF não reutilizam Maestro, Lucy, backend ou outro seat técnico. As ferramentas de engenharia permanecem sob seus guards existentes. A contribuição registra os perfis após a configuração e fixa o piso deny-all mais suas concessões específicas. O host usa engine orchestra e uma referência de modelo já configurada; a classe do manifesto não é fornecedor ou conta nova. Fonte dos limites de seat: [modules/maestro/coordination/src/v2/seats.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/maestro/coordination/src/v2/seats.ts).

O manifesto runtime inicial native-probe.json contém sf_finance e sf-explicar-forecast com bytes e hashes reais até T+13. O manifesto integral resident.json chega até T+42. Ambos usam o mesmo schema e loader; o parcial não anuncia operações ausentes.

Cada SKILL.md possui versão, entrada tipada, sequência, ferramentas permitidas, saídas, limites, resposta a ausência/conflito e exemplos de aceite/recusa. O build calcula dois hashes: SHA-256 dos bytes do arquivo distribuído e SHA-256 das instruções parseadas realmente injetadas. A carga confere caminho contido, fonte reservada, versão, digest e mensagem de contexto. Divergência impede iniciar a execução.

No planejamento, hashes de arquivos ainda não implementados são declarados obrigatórios no build. Não há hash inventado. No probe e no aceite de implementação, campo vazio ou placeholder é erro.

O recibo por skill inclui run, sessão, perfil/versão, skill/versão, digests, mensagem carregada, modelo efetivo, fingerprint de contexto, outputRef e consumerRef. O output é schema-valid, persistido em C09/C11 e usado depois de recarregar a interface. Uma frase no chat, arquivo presente, nome de perfil ou trace sem consumidor não fecha o aceite.

### Perfis

| Perfil | Missão | Contexto máximo | Steps | Delegação máxima |
| --- | --- | ---: | ---: | ---: |
| sf_maestro | Enquadrar intenção, coordenar especialistas pertinentes e preparar revisão/perguntas. | 24000 tokens | 12 | 4 |
| sf_finance | Reconciliar forecast, comparar cenários e calcular sensibilidade pelo motor canônico. | 20000 tokens | 10 | 0 |
| sf_procurement | Comparar propostas e condições e preparar dossiê sem aprovar compra. | 20000 tokens | 10 | 0 |
| sf_portfolio | Examinar dependências, restrições e combinações com fontes confirmadas. | 20000 tokens | 10 | 0 |
| sf_reviewer | Contestar a proposta e testar a sustentação em execução própria. | 24000 tokens | 12 | 0 |

Os budgets são limites do trabalho, não obrigação de preencher contexto. Maestro só convoca especialistas pertinentes. O Revisor sempre usa uma SessionV2 nova, com run próprio, sem fork do histórico analítico. Ele recebe a proposta alvo e fontes autorizadas atuais; o recibo liga targetRunId/targetOutputDigest ao reviewerRunId. Usar o mesmo modelo disponível é permitido; reutilizar a mesma execução não é revisão independente.

### Skills e resultados humanos

| Skill | Perfil(s) | Saída canônica | Consumidores |
| --- | --- | --- | --- |
| sf-enquadrar-decisao | sf_maestro | IntentFrame, AnalysisPlan | WP11.T01, WP01.T05, WP06.T03 |
| sf-preparar-revisao-executiva | sf_maestro | DecisionBrief | WP07.T01, WP07.T02, WP01.T05, WP09.T01, WP09.T02, WP09.T07 |
| sf-coordenar-perguntas | sf_maestro | QuestionProposal | WP08.T02, WP08.T06, WP01.T04, WP01.T05 |
| sf-explicar-forecast | sf_finance | FinancialAnalysis | WP01.T05, WP05.T01, WP09.T03, WP06.T03 |
| sf-comparar-cenarios | sf_finance | ScenarioComparison | WP01.T05, WP05.T05, WP11.T02 |
| sf-avaliar-sensibilidade | sf_finance | SensitivityResult | WP05.T05, WP01.T05 |
| sf-comparar-sourcing | sf_procurement | CommercialComparison | WP01.T05, WP09.T04 |
| sf-revisar-condicoes-contratuais | sf_procurement | CommercialGap, EvidenceCandidate | WP09.T04, WP11.T02, WP01.T05 |
| sf-preparar-compra | sf_procurement | PreparedChangeSet, DossierDraft | WP11.T03, WP09.T04, WP01.T05 |
| sf-revisar-dependencias | sf_portfolio | DeliveryAssessment, DependencyConflict | WP13.T01, WP01.T05, WP08.T06 |
| sf-compor-portfolio | sf_portfolio | PortfolioComparison | WP01.T05, WP05.T05, WP13.T04 |
| sf-reavaliar-compromissos | sf_portfolio | ReconsiderationProposal | WP01.T05, WP08.T04, WP09.T07 |
| sf-contestar-decisao | sf_reviewer | CritiqueReport, UnresolvedCondition | WP11.T02, WP01.T05, WP08.T06 |
| sf-revisar-evidencias | sf_reviewer | ClaimIssue | WP01.T05, WP06.T05, WP11.T02 |
| sf-extrair-evidencias | sf_procurement, sf_maestro | DocumentEvidence | WP01.T05, WP11.T02, WP09.T04 |
| sf-produzir-bi-contextual | sf_finance, sf_portfolio, sf_maestro | ContextualBIProposal | WP05.T05, WP01.T05 |
| sf-produzir-material-reuniao | sf_maestro | MeetingMaterialProposal | WP07.T02, WP07.T04, WP01.T05 |
| sf-consultar-memoria-decisoria | sf_maestro, sf_finance, sf_procurement, sf_portfolio, sf_reviewer | CaseRecall, MatchExplanation | WP01.T05, WP11.T01, WP09.T07 |

O JSON contém para cada skill a entrada concreta de trabalho, grants, passos, tipos, estados visíveis e testemunho de consumo da matriz de produto. As fontes são artefatos futuros do runtime de Orchestra-SF. Não são skills instaladas ou executadas nesta sessão de planejamento.

## 2. Capability packs e paridade

| Pack | Operações |
| --- | --- |
| Performance | sf_dashboard_read; sf_kpi_explain; sf_bi_view; sf_source_get |
| Planning | sf_forecast_compare; sf_scenario_simulate; sf_scenario_compare; sf_sensitivity_evaluate; sf_portfolio_evaluate |
| Procurement | sf_request_read; sf_supplier_read; sf_contract_read; sf_sourcing_compare |
| Decisions | sf_case_read; sf_case_draft; sf_alternative_draft; sf_change_prepare; sf_receipt_get |
| Collaboration | sf_work_list; sf_question_prepare; sf_answer_read; sf_relation_read; sf_handoff_prepare |
| Documents & Reports | sf_document_extract; sf_import_preview; sf_review_prepare; sf_report_prepare; sf_artifact_get |
| Knowledge / Atlas SF | sf_context_get; sf_knowledge_search; sf_evidence_get; sf_decision_recall; sf_freshness_check |
| Routines | sf_routine_catalog; sf_routine_prepare; sf_routine_run; sf_routine_status; sf_routine_result; sf_watch_prepare |

As 39 operações são descritores tipados fornecidos pelos donos de domínio. Cada descritor aponta task produtora, path, export, schema de entrada/saída e perfis concedidos. WP10.T06 registra o transporte; não reimplementa a regra de negócio. O handler recebe o contexto confiável separado dos argumentos. As refs de negócio são seletores submetidos a ACL, não credenciais.

A prova de paridade usa a mesma base e autoridade em UI, chamada nativa e MCP e compara handler efetivo, resultado, versões e referências. O catálogo só lista as operações implementadas e concedidas; a tentativa direta de uma operação não listada continua sujeita à mesma recusa. Nenhuma operação aprova PR/PO, aplica orçamento genérico, altera papel ou envia algo externamente.

## 3. BusinessEvidenceRef e resolver documental

C17 define uma união discriminada para registro, documento, cálculo, recibo, evento de caso e política. Registro possui surface/type/id/incarnation/version/fields/period. Documento possui documento/incarnation/revisão, digest do blob, unidade e offsets do trecho, digest do texto e estado de confirmação. Cálculo conserva engine/input/result digests e as fontes; recibo conserva comando, idempotency key e encarnação.

O resolver não transforma esses objetos em StructRef. Ele verifica a autoridade da chamada e devolve fresh, historical, stale, revoked, replaced, missing, invalid ou unavailable. A existência de alvo alheio não é revelada. Uma referência histórica só fornece conteúdo quando o histórico continua autorizado, identificado como histórico e acompanhado das diferenças atuais. Fonte substituída não se torna atual porque o ID textual foi reutilizado.

WP06.T05 fornece resolveSfDocumentEvidence e createSfDocumentEvidenceAdapter. A implementação usa os exports públicos reais de @orchestra/rag-studio: Store/withStore, parseSource, searchWords e revisões. O Store de trabalho é hidratado só com fontes/chunks/revisões autorizados da chamada. Seu permission é deny por padrão; nenhum path externo fornecido pelo modelo vira arquivo admitido. O host fornece a raiz privada e o leitor de bytes de documentos já admitidos. A persistência concreta continua uma porta WP10. Fontes: [modules/rag-studio/src/context.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/rag-studio/src/context.ts), [modules/rag-studio/src/types.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/rag-studio/src/types.ts), [modules/rag-studio/src/index.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/rag-studio/src/index.ts) e [modules/rag-studio/package.json](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/rag-studio/package.json).

O export extract serve PDF digital e texto. Ele não é um parser DOCX: o caminho não PDF lê texto bruto. Por isso DOCX é normalizado com JSZip/saxes, dependências já presentes de SF, antes de entrar no parser. A falta de camada textual permanece explícita. Busca lexical real é parte da entrega; a simples existência de embeddings não será chamada de busca semântica pronta. Fonte: [modules/rag-studio/src/extract.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/rag-studio/src/extract.ts).

O hash de conteúdo RAG é BLAKE3 do texto. SHA-256 do arquivo/trecho e BLAKE3 RAG ficam em campos separados, com algoritmo. SpanRef é qualificado por documento, encarnação e revisão, porque sourceId/offset isolados não autenticam a evidência. Um resultado de extração é candidato até confirmação humana.

## 4. Atlas: adaptação compatível com o engine real

### 4.1 Owners, kinds e templates

A baseline permite quatro kinds fechados: task, project, pr e logbook. MemberId é uma string e Ref aceita StructRef ou string. A boundary SF usa **somente task e project**, com namespace empresarial; a autoridade empresarial continua separada. Fontes: [modules/atlas/packages/memory/src/types.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/memory/src/types.ts) e [modules/atlas/packages/memory/src/template.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/memory/src/template.ts).

| Fonte de negócio | Kind real | Owner derivado pelo host | Forma admitida |
| --- | --- | --- | --- |
| Trabalho/análise/escolha real no caso | task | sf-case-v1 + hash de instalação/projeto/caso/encarnação | taskId, attempted[], failedWith[], stoppedAt, lesson, ref |
| Procedimento ou política explicitamente revisados | project | sf-policy-v1 + hash de instalação/projeto/perfil/versão de política | rule, scope, frecency finito, grounding |
| PR ou logbook de engenharia | Recusado | Nenhum | Não fabricar prId, owner técnico ou fonte de código |

taskId é um ID de trabalho/evento SF existente. attempted registra alternativas/ações efetivamente consideradas; failedWith registra falhas/lacunas verificadas; stoppedAt é o estado real; lesson contém motivo e limites ligados às fontes. project aceita apenas regra explícita revisada e editável. Não infere uma preferência pessoal nem transforma texto do modelo em política.

A Ref Atlas é uma string opaca sf-evidence:v1:refId:digest. Apenas BusinessContextService resolve esse ponteiro no catálogo privado SF. O envelope SF externo conserva caseRef, sourceEventId, dependências completas por campo, versões/encarnações, principal escritor, revisão de acesso, digest da projeção e recibo de scanner. Nenhuma dessas keys extras é adicionada ao MemoryEntry.

WP14.T05 entrega mapSfAtlasEntry, deriveSfMemoryOwner e explicações puras. memoryKindOf e validate reais devem aceitar o objeto. WP14 continua sem persistir, ler store, renderizar ou agendar; WP10.T07 consome a transformação e possui toda a fronteira de I/O.

### 4.2 A autorização acontece antes do Atlas e no retorno

createMemoryRead.recall passa a query ao store sem inserir actor. Recall com kind e sem owner pode selecionar registros de vários owners. O próprio código distingue scoping de controle de acesso. Fontes: [modules/atlas/packages/adapter-io/src/memory-read.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/memory-read.ts) e [modules/atlas/packages/memory/src/inject.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/memory/src/inject.ts).

BusinessContextService primeiro resolve os casos e todas as dependências de cada registro sob a autorização atual. Um campo revogado, fonte inacessível ou encarnação substituída suprime a entrada inteira — inclusive resumo, título e contagem derivados. Só depois constrói uma façade de store já autorizada e chama createMemoryRead com owner/kind explicitamente derivados.

A ferramenta não aceita owner, kind ou rawAtlasQuery. A consulta externa define escopo de negócio; o host deriva as partições internas. Dois atores usando sf_finance não compartilham acesso por terem o mesmo perfil. projectSlab pode fornecer procedimentos autorizados; não são inventados headers de engenharia, Awareness ou StructRefs.

Cache/invalidation considera instalação/projeto/principal, revisão de acesso/política, owner/escopo, versões/encarnações das fontes e versões de boundary/schema/manifest/skills. Revalidação ocorre em recall, preparação de prompt, retorno, arquivo e link. O ledger do caso permanece oficial e é capaz de explicar a decisão mesmo quando uma projeção de memória está pending/refused.

### 4.3 DurableMemory síncrono dentro da transação assíncrona

DurableMemory tem read e append síncronos. A implementação pronta grava logs de repositório; não é escolhida para dados de negócio. Persistence.transaction SF, em contraste, é assíncrona e exige commit serializável com callback único e snapshot isolado. Fontes: [modules/atlas/packages/adapter-io/src/memory-store.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/memory-store.ts) e [modules/sucafina/Sucafinav1/runtime/contract.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/runtime/contract.ts).

O adapter escolhido implementa uma façade síncrona sobre o snapshot que já foi carregado dentro do callback. read dobra o journal validado; append apenas acrescenta o evento ao snapshot em staging. Nenhum método desse port devolve Promise. O await da transação externa determina a durabilidade.

Sequência:

1. Resolver fontes dos domínios fora da transação central e guardar tokens de versão/incarnação/acesso.
2. Entrar na transação dashboard existente, autenticar o Request atual e conferir o evento do caso/outbox e seus digests.
3. Hidratar a partição protegida e verificar os eventos pelas funções canônicas versioned/respawnFromRecord.
4. Criar createSfAtlasDurableMemory e chamar o createMemoryEmit real com owner empresarial e scanner real. Seus gates de template/owner/cap/scanner julgam o snapshot serializado.
5. Persistir no mesmo snapshot evento, envelope, índice de referências, idempotência e resultado do outbox. Mesma chave/payload recupera recibo; payload diferente conflita.
6. Só após commit confirmado devolver committed. Falha, cancelamento ou commit=false não deixa evento novo após reinício.
7. Ler em processo novo, aplicar novamente autorização atual e chamar createMemoryRead real antes de devolver o precedente.

O namespace escolhido é __sfProductV1.atlas no snapshot dashboard existente, protegido por WP10.T01. Isso é localização de armazenamento, não autorização transversal de Dashboard. O provider exclui o namespace de projeções, JSON business export/import, previews e auditoria genérica. Auditoria exposta contém IDs/digests/estado, não o conteúdo sensível. Não há store git empresarial ou transação global entre domínios.

### 4.4 Scanner e empacotamento

createMemoryEmit recusa scanner ausente e trata exceção como indisponibilidade. runScanner distingue clean, hit e could-not-run. A conveniência makeScannerAdapter reduz as duas últimas a bloqueio; a boundary SF preserva o motivo: clean retorna false, hit retorna true e could-not-run lança erro controlado. Assim scanner-unavailable não afirma que encontrou segredo. Fontes: [modules/atlas/packages/adapter-io/src/memory-emit.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/memory-emit.ts) e [modules/atlas/packages/adapter-io/src/scanner.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/scanner.ts).

O host fixa binário/spec/path/versão de gitleaks ou trufflehog. A prova usa scanner real, uma entrada limpa, um canary sintético e falta/timeout/erro. Sem binário qualificado, o gate de escrita permanece HOLD. Um scanner sempre-clean não serve. Preparar dependência de desenvolvimento/CI não cria acesso empresarial nem modifica Azure.

O workspace da raiz contém @orchestra/atlas-boundary, não os packages internos @atlas. O subpath native-memory existente compõe store ligado a repositório e não expõe as factories com DurableMemory customizável. Importá-las diretamente do package interno seria uma seam inexistente no produto. Fontes: [modules/atlas/boundary/package.json](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/boundary/package.json), [modules/atlas/packages/adapter-io/src/native-bound.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/native-bound.ts) e [package.json](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/package.json).

A exceção de empacotamento possui nove caminhos Atlas exatos sob WP10.T07/S0-A. A business entry expõe somente factories/types/validators/fold; o scanner real é reexportado aditivamente por native-bound.ts e consumido pelo subpath público native-memory. O gerador preserva os descritores atuais e resolve somente a dependência literal memory-emit.ts → ./scanner.js do bundle business-memory-ports como external para native-memory. Assim a constante NO_SCANNER_NAME continua canônica e nenhum novo bundle incorpora código de subprocesso. São gerados dois pares JS/d.ts; AST e check:spawn-imports verificam a rota sem modificar guard/allowlist. Detalhes e fontes em [atlas-packaging.md](atlas-packaging.md). Não se alteram templates, algoritmos, gates ou identidades. Fonte: [modules/atlas/boundary/script/build.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/boundary/script/build.ts).

WP10.T07 produz @orchestra/atlas-boundary/business-memory-ports. A receita inclui generate com admissão AST, check:generated, check:spawn-imports, typecheck, test e os imports de produção SF; arquivos gerados não são escritos manualmente.

## 5. Divisão de trabalho e caminho de prova

| Unidade | Entrega | Consumidor |
| --- | --- | --- |
| WP00.T02 | C15–C17, tipos, matriz e ownership | Todos os builders |
| WP12.T01 | Cinco perfis; sf-explicar-forecast e native-probe com hashes reais | T06, GNATIVE |
| WP12.T02 | Dezessete fontes restantes, resident.json e execução especializada | T06, C11 e UI |
| WP12.T03 | Revisor com sessão/run próprios | Alternativa, evidência e mesa |
| WP10.T06 | Registro, loader, binding e MCP privado | Perfil, UI, rotina |
| WP10.T01 | Store protegido e roots de composição | T06/T07 e domínios |
| WP06.T05 | Extração/resolver/RAG documental | BCS, evidência e UI |
| WP14.T05 | Mapeamento puro de owner/kind/templates | T07 |
| WP14.T02/T04 | Ranking/explicação e invalidação puros | BCS, UI e rotina |
| WP10.T07 | BCS, package boundary, scanner e Atlas transacional | Memória, prompts, relatórios e links |

O cronograma final pertence ao delta de execução. A tranche GNATIVE preserva: skill pronta T+13, caso real T+14, compareForecast real T+15, ponte T+16, composição T+18 e prova independente até T+20. O catálogo completo não é falsamente anunciado nessa tranche. Os 39 handlers e oito packs entram no candidato integral até G4; o aceite final exige consumo e contraprovas completos.

| Prova | O que precisa distinguir | Pacotes |
| --- | --- | --- |
| AM01 — Perfis e skills reais | Para cada uma das 18 skills: bytes/digest conferidos, carga SessionV2.skill observada, execução permitida com perfil previsto, output schema-valid persistido e ação real do consumidor após reload. | E11, E16 |
| AM02 — Paridade dos oito packs | Manifesto final contém 39 ferramentas distribuídas exatamente pelos 8 packs; cada operação possui handler/export/type/owner implementado. | E01, E16 |
| AM03 — Identidade, isolamento, revogação e provider | Duas sessões/principais usando sf_finance simultaneamente recebem somente suas fontes e casos; callIds/pairs/leases não compartilham actor global. | E11, E12, E15, E16 |
| AM04 — Escolha, mudanças preparadas e resposta perdida | Escolha humana gera PreparedChangeSet consumido com versão, preview, necessidade de aprovação e referências preservadas. | E10, E16 |
| AM05 — Evidências e memória Atlas após reinício | Instrumentação identifica import/módulo real do bundle: memoryKindOf/validate, createMemoryEmit, DurableMemory append, commit SF, restart e createMemoryRead.recall; consumidor abre precedente com diferenças atuais. | E12, E15, E16 |
| AM06 — Rotina nativa com contribuições e retorno | Receita publicada/pinada -> admissão real -> Relay -> skill/perfil necessário -> output canônico persistido -> mesa/Meu trabalho. | E11, E13, E14, E16 |

Cada skill tem seu próprio registro de carga/execução/consumo, embora várias possam compartilhar o mesmo cenário integrado. Cada operação tem seu registro de paridade. As seis provas não são seis amostras que permitem ignorar as outras skills ou packs.

Os cenários de isolamento podem usar IDs sintéticos explicitamente identificados no harness de autenticação e dados sintéticos já previstos, sem alegar contas empresariais reais. A cadeia nativa também precisa executar com a autoridade real já disponível da instalação. Nenhuma prova registra identidade fictícia como usuário corporativo nem exige novos acessos.

## 6. Critério de fechamento da correção

A revisão pode refutar a proposta, entre outros modos, se conseguir:

- satisfazer os checks canônicos com uma skill apenas catalogada, uma saída sem consumidor ou crítica na sessão do autor;
- transportar actor fornecido pelo modelo, misturar duas sessões, reaproveitar uma lease ou resolver provider homônimo como nativo;
- consultar Atlas sobre store compartilhado bruto, omitir a autorização por campo ou preservar referência substituída como válida;
- passar um objeto empresarial diretamente como template/StructRef, forjar PR/owner de engenharia ou esconder a ausência de scanner;
- anunciar sucesso antes do commit, perder uma escrita concorrente, duplicar evento após retry ou falhar ao ler após reinício;
- importar @atlas/* sem packaging real ou usar uma implementação própria com o mesmo nome no lugar dos módulos acordados.

Esses são defeitos verificáveis de planejamento/implementação, não autorização para reduzir produto. Todos os checks de runtime continuam NOT_RUN até ocorrerem no candidato implementado.

## 7. Evidência primária consultada

| Fonte | Fato relevante |
| --- | --- |
| [packages/core/src/mcp/provided.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/mcp/provided.ts) | McpProvided.Server.connect recebe zero contexto; serviço global lista name/key/Transport. Não basta para principal por chamada. |
| [packages/core/src/mcp.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/mcp.ts) | configured prefere homônimo configurado; mcpTool transmite apenas name/arguments; config() lê providers configurados sem abrir conexão. |
| [packages/core/src/tool/tool.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/tool/tool.ts) | Tool.Context fornece sessionID, agent, assistantMessageID, toolCallID e modelo capturado; é a entrada confiável do wrapper. |
| [packages/core/src/tool/tools.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/tool/tools.ts) | Tools.Service.register é capability pública de registro no Location; contribution não precisa usar registro interno. |
| [packages/core/src/host.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/host.ts) | Host.Contribution admite locationNodes aditivos e proíbe ownership de SessionV2/SessionExecution/LocationServiceMap/ScheduledTask. |
| [packages/core/src/agent.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/agent.ts) | AgentV2.transform/draft.update registra perfis e withPermissions usa regras atuais; ID ausente cai em deny. |
| [packages/core/src/skill.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/skill.ts) | SkillV2.DirectorySource reservado, get e content parseado existem; catálogo não demonstra execução da skill. |
| [packages/core/src/session.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/session.ts) | SessionV2.create/skill(resume:false)/prompt/messages/context existem; generate é tool-less e não substitui prova de ferramenta. |
| [modules/app-dock/src/dock-mcp.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/app-dock/src/dock-mcp.ts) | Server + InMemoryTransport.createLinkedPair + ListTools/CallTool handlers são composição SDK real já usada pelo repo. |
| [modules/maestro/coordination/src/v2/seats.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/maestro/coordination/src/v2/seats.ts) | Roster técnico restringe tools de Maestro/Atlas e skill trees por identidade; perfis SF não devem fingir seats. |
| [modules/atlas/packages/memory/src/types.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/memory/src/types.ts) | MemberId=string; kinds task/pr/project/logbook; Ref=StructRef|string; templates task/project explicitamente tipados. |
| [modules/atlas/packages/memory/src/template.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/memory/src/template.ts) | memoryKindOf deriva template por keys fechadas; validate exige tipos por campo; extra metadata e BusinessRef objeto não são entrada compatível. |
| [modules/atlas/packages/adapter-io/src/memory-read.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/memory-read.ts) | createMemoryRead.recall passa query/store a recallOver sem adicionar actor; exige filtro de autorização prévio. |
| [modules/atlas/packages/memory/src/inject.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/memory/src/inject.ts) | Recall(kind sem owner) pode ler múltiplos owners; scope Atlas não é controle de acesso. |
| [modules/atlas/packages/adapter-io/src/memory-emit.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/memory-emit.ts) | Gates kind/template/owner/cap/scanner precedem append; scanner ausente/throw é unavailable. |
| [modules/atlas/packages/adapter-io/src/memory-store.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/memory-store.ts) | DurableMemory.read/append são síncronos; implementação padrão usa logs no repo e não serve como store confidencial SF. |
| [modules/atlas/packages/adapter-io/src/scanner.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/scanner.ts) | runScanner distingue clean/hit/could-not-run; makeScannerAdapter reduz indisponibilidade a bloqueio, logo wrapper preserva causa via throw. |
| [modules/sucafina/Sucafinav1/runtime/contract.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/runtime/contract.ts) | Persistence.transaction é async, serializable e callback único com snapshot isolado; cancellation/commit failure não persistem. |
| [modules/sucafina/Sucafinav1/runtime/application.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/runtime/application.ts) | authenticate(Request, roleMap) roda dentro da transação; três surfaces, mesmo persistence de HTTP/jobs e sem listener novo. |
| [modules/sucafina/Sucafinav1/src/identity.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/src/identity.ts) | Surface fechado dashboard/planner/procurement; papel/surface resolve do mapa confiável, não do perfil de agente. |
| [modules/atlas/boundary/package.json](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/boundary/package.json) | Workspace público oferece generated exports; native-memory não é porta de storage customizável. |
| [modules/atlas/boundary/script/build.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/boundary/script/build.ts) | Gerador canônico resolve @atlas aliases, Bun bundle e declarações; novos ports precisam passar por esse entry/gerador. |
| [modules/atlas/packages/adapter-io/src/native-bound.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/native-bound.ts) | native-memory exporta composição presa a AtlasBinding repo/owner e tipos; não expõe createMemoryRead/Emit custom storage. |
| [package.json](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/package.json) | Raiz inclui modules/atlas/boundary, não todos packages Atlas; import runtime direto @atlas/adapter-io não é seam disponível. |
| [modules/atlas/packages/adapter-io/src/index.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/index.ts) | Factories, DurableMemory, scanner e ports realmente existem no barrel Atlas interno. |
| [modules/atlas/packages/memory/src/index.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/memory/src/index.ts) | versioned/respawn e template são exports do memory real a reexportar pelo bundle. |
| [modules/rag-studio/src/context.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/rag-studio/src/context.ts) | Store/Source/revision/chunk e textAt mostram offsets; memória de trabalho não é persistência/ACL automática. |
| [modules/rag-studio/src/types.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/rag-studio/src/types.ts) | Source.contentHash, Chunk.sourceHash, SpanRef(sourceId,start,end) e Revision são tipos reais. |
| [modules/rag-studio/src/index.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/rag-studio/src/index.ts) | Exports públicos withStore/parseSource/searchWords/openRevision/readRevision/citationProof estão disponíveis. |
| [modules/rag-studio/src/extract.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/rag-studio/src/extract.ts) | extract aceita path e trata PDF digital; outros arquivos viram texto bruto, logo DOCX exige normalização própria. |
| [modules/rag-studio/package.json](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/rag-studio/package.json) | Pacote público expõe raiz e ./extract e é workspace existente; unpdf é dependência real. |


## Cobertura autorizada das 39 operações

`resident_ai.operation_call_routes` nomeia uma rota positiva para cada operação: perfil, skill carregada, schema de entrada, produtor, saída, consumidores e AM02. A chamada direta do harness passa pelo wrapper C16 com o mesmo `SkillLoadReceipt` e binding; não existe uma porta especial sem skill. O validador recusa uma operação anunciada que nenhuma combinação perfil/skill consiga chamar.

`sf-produzir-bi-contextual` usa `sf_dashboard_read` como origem autorizada da visão. `sf-enquadrar-decisao` e `sf-explicar-forecast` podem usar `sf_import_preview` na entrada opcional de análise de um arquivo admitido. O output mantém `importPreviewRef`; o consumidor abre o mesmo manifesto C04 com deltas, erros e indicação de simulação. Nenhuma dessas skills recebe ferramenta de aplicação de importação.

`sf-preparar-revisao-executiva`, sob `sf_maestro`, conecta catálogo, proposta, execução admitida, status e resultado de rotinas. Sem admissão C07 atual, o resultado é `needs-input`/proposta e o run termina; a resposta humana inicia novo run. O host fixa `HostBoundEntryMode`: `interactive` pode preparar e executar mediante admissão; `routine-result` bloqueia prepare/run para impedir recursão. Esse modo não é um argumento controlado pelo modelo. AM06 exige o percurso real e a contraprova de loop recusado.
