# Orchestra SF — equipe de agentes, skills, MCP e Atlas SF

Fonte original: https://chatgpt.com/space/page_72076eb5866c819184dacccc76662620

# Decisão de produto recomendada

**Especificação complementar — ainda não implementada.** A campanha precisa entregar uma equipe residente de IA, separada dos agentes que construirão o software.

A composição recomendada é **cinco perfis de agentes de negócio, dezoito skills, um novo servidor MCP específico da instalação e oito capability packs**. O conhecimento aparece como **Atlas SF Business Profile v1**, um perfil e uma boundary de negócio a implementar sobre componentes compatíveis do Orchestra.

Os nomes de agentes, skills, ferramentas e perfis desta página são contratos propostos. A baseline examinada continua sendo 9e4f3d35833f9b2cea6abdf58f42331f3973d9bf. Nenhum servidor, agente ou integração foi ativado nesta etapa.

# Os cinco agentes residentes

| Perfil / ID proposto | Trabalho próprio | Resultado utilizável | Limite de autoridade |
| --- | --- | --- | --- |
| **Maestro SF / sf_maestro** | Enquadrar a intenção, selecionar o trabalho necessário, reunir análises compatíveis, preparar perguntas e revisão executiva. | IntentFrame, AnalysisPlan, DecisionBrief, QuestionProposal. | Coordena e prepara; escolha, aprovação e aplicação seguem as ações e permissões do produto. |
| **Finance / sf_finance** | Explicar desvios, reconciliar forecast, comparar cenários e testar sensibilidade. | FinancialAnalysis, ScenarioComparison, SensitivityResult. | Consome o motor financeiro; acesso a HR e valores restritos depende do usuário. |
| **Compras e Contratos / sf_procurement** | Comparar propostas, revisar condições comerciais, identificar lacunas e preparar o dossiê de compra. | CommercialComparison, CommercialGap, EvidenceCandidate, PreparedChange. | Não aprova compra, altera alçada ou confirma automaticamente o conteúdo extraído. |
| **Portfólio e Entrega / sf_portfolio** | Examinar compromissos, dependências confirmadas, restrições e combinações de portfólio. | DeliveryAssessment, DependencyConflict, PortfolioComparison, ReconsiderationProposal. | Dependências e capacidade precisam de fonte; simular não altera o plano oficial. |
| **Revisor de Decisões / sf_reviewer** | Contestar evidências e alternativas em uma execução separada, procurar omissões e condições que mudariam a escolha. | CritiqueReport, ClaimIssue, UnresolvedCondition. | Leitura e simulação no mesmo escopo autorizado; seu parecer não é aprovação financeira. |

O catálogo contém cinco perfis, mas a composição de cada trabalho varia. Explicar uma diferença pode exigir apenas Finance. Renovar ou substituir um fornecedor pode envolver Compras e Finance, com Portfólio quando houver dependência de implantação. O Revisor entra em decisões materiais, mudanças relevantes ou por solicitação explícita.

O Maestro SF reutiliza a coordenação do Orchestra quando o binding for compatível. Os perfis de negócio são registrados via AgentV2 e host binding; não reutilizam identidades técnicas para atravessar guards do roster de engenharia.

# Skills a entregar

| Dono | Skill proposta | Saída e condição de conclusão |
| --- | --- | --- |
| Maestro SF | sf-enquadrar-decisao | Objetivo, horizonte, restrições, critérios, referências e lacunas explícitos. |
| Maestro SF | sf-preparar-revisao-executiva | Pauta factual com mudanças, decisões, pendências e links recuperáveis. |
| Maestro SF | sf-coordenar-perguntas | Perguntas relevantes atribuídas a identidades conhecidas, sem duplicação. |
| Finance | sf-explicar-forecast | Diferença reconciliada até seus componentes e fontes. |
| Finance | sf-comparar-cenarios | Alternativas avaliadas pelo motor canônico, com premissas explícitas. |
| Finance | sf-avaliar-sensibilidade | Condições e limites em que a preferência entre alternativas muda. |
| Compras | sf-comparar-sourcing | Comparação coerente de escopo, prazo, moeda, custo e critérios disponíveis. |
| Compras | sf-revisar-condicoes-contratuais | Condições comerciais e lacunas com trechos de origem; sem inventar interpretação jurídica conclusiva. |
| Compras | sf-preparar-compra | Dossiê e mudanças propostas associados à versão correta do pedido. |
| Portfólio | sf-revisar-dependencias | Relações confirmadas, conflitos e informações ausentes separados. |
| Portfólio | sf-compor-portfolio | Combinações comparáveis que respeitam as restrições informadas. |
| Portfólio | sf-reavaliar-compromissos | Efeito de mudança material sobre compromissos e condições existentes. |
| Revisor | sf-contestar-decisao | Objeções verificáveis, contraexemplos e condições não resolvidas. |
| Revisor | sf-revisar-evidencias | Claims sustentados, contraditos ou inconclusivos, com motivo. |
| Compartilhada | sf-extrair-evidencias | Campos candidatos e trechos de PDF digital, DOCX ou texto, sujeitos a confirmação. |
| Compartilhada | sf-produzir-bi-contextual | Visualização aprovada, tabela equivalente, unidade, período e drilldown. |
| Compartilhada | sf-produzir-material-reuniao | Revisão e relatório completos usando os resultados canônicos. |
| Compartilhada | sf-consultar-memoria-decisoria | Precedentes autorizados, razão de correspondência, contexto original e diferenças atuais. |

Cada skill precisa de versão e digest, entradas tipadas, sequência de trabalho, ferramentas permitidas, formato de saída, limites, tratamento de ausência/conflito e exemplos de aceite e recusa. O runtime deve provar que a skill foi carregada e usada; um arquivo no catálogo não satisfaz isso.

Cálculo, autorização, validação de schema, controle de versão, classificação de limiar e deduplicação permanecem funções determinísticas. O modelo recebe o que exige interpretação e julgamento.

# Configuração dos perfis

Cada perfil deve declarar ID, versão, missão, skills permitidas, operações autorizadas, schemas de saída, orçamento de contexto, limite de delegação, política de retomada e classe de modelo.

A classe de modelo é resolvida pelo host entre os modelos já configurados. Análise e crítica podem usar maior capacidade de raciocínio; extração estruturada pode usar um perfil mais econômico quando ele passar nas provas. O manifest registra o modelo efetivo de cada execução, sem depender de uma nova conta ou fixar um fornecedor inexistente.

O Revisor usa uma execução e instruções próprias. Ele não ganha permissões adicionais para revisar. Sua revisão complementa as verificações determinísticas.

# Experiência de uso

As entradas principais são ações de trabalho: **Analisar alternativas**, **Explicar diferença**, **Comparar propostas**, **Preparar revisão** e **Contestar decisão**.

A mesa mostra progresso útil, como “comparação financeira concluída; falta confirmar condição de saída”. Cada agente entrega um objeto persistente: alternativa, pergunta, evidência, crítica ou mudança preparada. O usuário pode abrir a fonte, corrigir a intenção, responder, cancelar ou pedir uma revisão específica.

Na visão principal, mostrar a contribuição e as fontes. Perfil, modelo, skill, versão e run ficam disponíveis no detalhe de proveniência. Um catálogo “Equipe SF” pode permitir descoberta e configuração; escolher manualmente um agente não é uma etapa obrigatória para executar o trabalho.

# MCP específico para a Sucafina

**Novo servidor proposto: sucafina-workbench.**

Ele expõe as capabilities do produto por um contrato único, dividido em oito packs. Não é um servidor por persona nem um novo motor por domínio. Agentes internos e interface usam as mesmas portas autorizadas; o MCP é outra superfície sobre essas portas.

| Pack | Ferramentas propostas — exemplos de contrato | Uso |
| --- | --- | --- |
| **Performance** | sf_dashboard_read; sf_kpi_explain; sf_bi_view; sf_source_get | Indicadores, desvios, gráficos, tabelas e origem dos números. |
| **Planning** | sf_forecast_compare; sf_scenario_simulate; sf_scenario_compare; sf_sensitivity_evaluate; sf_portfolio_evaluate | Cálculos e alternativas financeiras/portfólio. |
| **Procurement** | sf_request_read; sf_supplier_read; sf_contract_read; sf_sourcing_compare | Pedidos, fornecedores, contratos e comparação comercial. |
| **Decisions** | sf_case_read; sf_case_draft; sf_alternative_draft; sf_change_prepare; sf_receipt_get | Casos, alternativas e preparação de mudanças. |
| **Collaboration** | sf_work_list; sf_question_prepare; sf_answer_read; sf_relation_read; sf_handoff_prepare | Pessoas, perguntas, respostas, vínculos e encaminhamentos. |
| **Documents & Reports** | sf_document_extract; sf_import_preview; sf_review_prepare; sf_report_prepare; sf_artifact_get | Documentos admitidos, importações, reuniões e material exportável. |
| **Knowledge / Atlas SF** | sf_context_get; sf_knowledge_search; sf_evidence_get; sf_decision_recall; sf_freshness_check | Contexto, evidência, memória pertinente e atualidade. |
| **Routines** | sf_routine_catalog; sf_routine_prepare; sf_routine_run; sf_routine_status; sf_routine_result; sf_watch_prepare | Rotinas admitidas em Relay e recorrência em Schedule. |

Os nomes e assinaturas finais precisam ser congelados em WP00. As listas acima definem a superfície pretendida, não ferramentas já registradas.

## Política de concessão

| Perfil | Leitura | Simulação | Preparação | Execução |
| --- | --- | --- | --- | --- |
| Maestro SF | Caso e contexto transversal autorizado | Solicita ao especialista quando necessário | Caso, perguntas, pauta e rotina | Apenas rotina já admitida, nos limites da autorização vigente. |
| Finance | Planning, Performance e fontes permitidas | Cenários, reconciliação e sensibilidade | Alternativas financeiras e perguntas | Sem aprovação ou alteração financeira automática. |
| Compras | Procurement, documentos e fontes permitidas | Comparação comercial pelas regras existentes | Alternativas e mudanças preparadas | Sem aprovação de PR/PO ou envio a fornecedor. |
| Portfólio | Projetos, relações e contexto permitido | Combinações e restrições | Opções e perguntas | Sem alterar datas/compromissos oficiais por inferência. |
| Revisor | Escopo da decisão e suas evidências | Validações e simulações permitidas | Parecer e questões não resolvidas | Sem mutação de domínio ou agenda. |

Aplicar mudanças financeiras e registrar aprovações continua pelo comando do domínio e pela ação/autorização previstas na interface. Preparar uma proposta não concede o direito de aplicá-la.

A permissão efetiva resulta da identidade confiável do usuário, escopo da sessão/caso, operações concedidas ao perfil e regras atuais do domínio. Actor/role/project não são estabelecidos por argumentos gerados pelo modelo. Toda leitura, recuperação, exportação e execução revalida o acesso pertinente.

McpProvided não entrega automaticamente identidade SF. O servidor precisa de binding confiável de execução, usando um padrão equivalente à closure de turno existente no host. Também precisa impedir que outro provider configurado com o mesmo nome substitua silenciosamente o servidor nativo.

## O que reaproveitar

- Registry e execução de ferramentas do Orchestra.

- AgentV2 e permissões.

- Bridge/transportes MCP compatíveis com o host.

- Portas e motores de Dashboard, Planner e Procurement.

- Relay/Maestro para admissão e execução de rotinas.

- Schedule para recorrência.

- Componentes de RAG Studio para fontes, revisões, trechos e documentos.

- Componentes compatíveis de memória Atlas por uma boundary empresarial explícita.

O cliente MCP atual e a bridge do adaptador Claude não equivalem a um endpoint HTTP MCP genérico já instalado. O novo servidor, seu registro, binding e superfície de descoberta são trabalho de implementação.

# Integrações do produto

| Integração | Situação na entrega proposta |
| --- | --- |
| Dashboard / Planner / Procurement | Nativa, usando as mesmas projeções, versões, comandos e recibos da UI. |
| Arquivos e documentos | Upload/importação autorizados, formatos já previstos e extração com referência. |
| Relay e Schedule | Serviços nativos, com rotinas SF, admissão, versão, execução e retorno ao produto. |
| Modelos de IA | Provider existente do host; registrar modelo efetivo e indisponibilidade. |
| Diretório e identidade | Perfil real disponível da instalação; sem inventar identidades corporativas ou vínculos por nome. |
| Atlas SF / RAG Studio | Adapters de negócio a implementar e qualificar sobre componentes reais. |
| Fabric, SAP/ACM, CTRM e Microsoft Graph | Portas de integração futuras. Não declarar conectores ativos, acesso a dados ou envio externo sem conexão e autorização reais. |

Não há necessidade de pedir novos acessos para construir e provar as jornadas com os dados já presentes e os cenários sintéticos. Os conectores corporativos futuros alimentam as mesmas portas, preservando a experiência do produto.

# Atlas que vai para o time

**Nome de configuração proposto: Atlas SF Business Profile v1.** Esse é um identificador novo de produto, não uma release existente do Atlas.

O perfil registra separadamente a baseline do engine, versão da boundary, versão do schema empresarial, versão das skills e revisão das fontes. A versão do pacote de conhecimento não torna dados operacionais antigos atuais.

## Conteúdo do Atlas SF

| Camada | Conteúdo | Fonte de verdade |
| --- | --- | --- |
| Vocabulário e procedimentos | Significado de budget/actual/forecast, critérios, moedas, papéis e skills revisadas. | Pacote de negócio versionado e políticas explicitamente fornecidas. |
| Contexto operacional | Registros, componentes financeiros, projetos, compras e vínculos confirmados. | Projeções autorizadas C01/C02 e comandos dos domínios. |
| Evidência documental | Documento admitido, revisão, trecho, hash e campo candidato/confirmado. | Arquivo privado e componentes documentais de WP06/RAG Studio. |
| Memória decisória | Alternativas, condições, razão da escolha, perguntas, respostas e resultado observado. | Caso/ledger SF e projeções autorizadas C09/C13. |
| Contexto do papel | Subconjunto necessário ao especialista e à tarefa atual. | Binding do host, sujeito às permissões atuais. |

A recuperação deve explicar **por que o precedente é pertinente e o que mudou desde então**. Ela distingue fato observado, alegação, premissa, proposta e decisão. Preferências reutilizáveis precisam ser explícitas e editáveis; não inferir preferências pessoais ocultas.

## Adaptação necessária

O Atlas atual é voltado ao repositório, com referências estruturais a código e memória por seat. Seu código diz expressamente que scoping de memória não é controle de acesso. Portanto a instalação SF precisa de uma nova boundary de negócio.

A implementação deve:

1. Definir **BusinessEvidenceRef** para registro/versão, documento/trecho/hash e cálculo/recibo, separadamente dos StructRef de código.

2. Criar um **BusinessContextService** que resolva fontes atuais e autorizadas, cobertura e condições de desatualização.

3. Usar uma boundary empresarial para reaproveitar os módulos compatíveis de Atlas, como createMemoryRead/createMemoryEmit e o port DurableMemory.

4. Fornecer ao port memória persistida e serializada no armazenamento protegido da instalação SF. Nenhum dado de negócio precisa entrar no store git compartilhado.

5. Resolver owners, tipos e escopos de negócio de modo explícito. Não representar compras como PRs fictícios nem dar a Finance a identidade de um agente técnico.

6. Revalidar acesso e atualidade em recuperação, prompt, memória, relatório e link.

7. Manter a busca documental no componente apropriado e provar seu comportamento. Código de embeddings existente não demonstra busca semântica pronta.

Para chamar o Atlas de substrato integrado, a prova deve mostrar consumidores reais chamando seus módulos/ports, persistência após reinício, isolamento de acesso e retomada. Uma camada nova com o mesmo nome, sem esse consumo, não satisfaz esse critério.

# Encaixe na campanha existente

| Dono | Entrega adicional explicitada |
| --- | --- |
| WP00 | Manifest de perfis/skills/packs, contratos tipados, matriz de operações e identidade de execução. |
| WP10 | Registro AgentV2, carregamento efetivo das skills, servidor MCP e binding confiável; mesma porta final para UI/agente/MCP. |
| WP12 | Cinco perfis, roteamento, dezoito skills, saídas tipadas e execuções independentes de revisão. |
| WP06 + WP14 | Fontes documentais, boundary Atlas SF, memória autorizada, recuperação e invalidação. |
| WP09 | Rotinas que convocam as análises necessárias e retornam resultados reais. |
| WP01 + WP08 | Entradas por trabalho, progresso útil, perguntas e contribuições consumíveis na mesa. |
| WPs de domínio | Descritores de capabilities sobre as portas existentes, sem servidores ou cálculos paralelos. |

Esse detalhamento fecha lacunas de especificação; sua infraestrutura não deve ser contada como já implementada. Os limites de ownership para qualquer nova boundary/export precisam ser declarados por S0 antes da edição.

A meta de duas horas continua condicionada. A qualificação em T+20 deve incluir um perfil real, skill carregada, chamada autorizada pela ponte e retorno da porta de domínio. A recuperação de memória Atlas e a paridade de acesso precisam aparecer antes da aceitação integral. Se a adaptação exigir mais trabalho que o orçamento disponível, registrar o efeito no prazo preservando escopo e critérios.

# Axiomas desta camada

## Definition of Done

Os cinco perfis executam missões reais; as dezoito skills são carregadas e produzem saídas consumidas; o MCP lista e executa as operações concedidas; Atlas SF recupera contexto e memória persistidos pelos componentes reais; Relay devolve run e resultado verificáveis.

## Invariants

Identidade vem do host. Permissão é aplicada no destino. Fontes oficiais permanecem nos domínios. Modelo não concede alçada, não calcula valores oficiais por geração de texto nem transforma uma proposta em aprovação. Cada contribuição conserva versão, origem e escopo.

## Quality standards

Convocar apenas especialistas necessários. Mostrar progresso por resultado de trabalho. Erro, cancelamento, dados ausentes e desatualização mantêm contexto recuperável. Respostas explicam incerteza e mostram fontes acessíveis. Ferramentas e skills têm contratos estáveis e resultados tipados.

## Completeness criteria

Cobrir os cinco perfis, oito packs, dezoito skills, memória/documentos, ciclo de decisão, edição concorrente, revogação, chamada forçada, provider conflitante, falha/retry e uso real pela UI e MCP. Cobrir comportamento com dados completos, parciais e ausentes.

## Success criteria

Uma decisão recebe contribuição distinta dos especialistas necessários; uma resposta humana altera a análise; a escolha produz trabalho preparado e rastreável; um precedente é recuperado com diferenças atuais; o usuário conclui sem coordenar manualmente cinco conversas.

# Seis provas integradas

1. **Perfil e skill reais:** descoberta e execução permitidas; chamada direta a operação proibida também falha.

2. **Paridade:** UI, agente e MCP usam o mesmo domínio, versão e resultados.

3. **Isolamento:** sessão, ator ou caso incorretos não ampliam acesso; revogação alcança memória e relatórios.

4. **Mudança preparada:** escolha e aplicação mantêm os limites do domínio; resposta perdida não duplica efeito.

5. **Evidência e memória:** fontes/revisões recuperáveis, referência invalidada reconhecida e roundtrip persistente pelo adapter Atlas.

6. **Rotina:** admissão → Relay → operação SF → resultado → interface, com falha e intervenção visíveis.

# Fontes verificadas

- [Módulo Sucafina e seus serviços](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/README.md).

- [Atlas: finalidade, superfícies e limites](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/README.md).

- [Memória Atlas: escopo versus confidencialidade](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/memory/src/inject.ts).

- [Port DurableMemory](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/memory-store.ts).

- [Leitura de memória](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/memory-read.ts) e [escrita governada](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/memory-emit.ts).

- [Restrições do framework de seats](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/maestro/coordination/src/seats/seat.ts).

- [Registry e ferramentas](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/tool/registry.ts).

- [Bridge MCP por turno](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/engine-adapters/claude-code/src/v2/host.ts).

- [Store e fontes de RAG Studio](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/rag-studio/src/context.ts).

- [Catálogo de assets não equivale a carregamento](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/capability-assets/README.md).

