# Orchestra-SF · Campanha de jornadas reais do CIO e da operação

**Contratos de design:** cada caso é um roteiro de teste manual assistido por QA, com atores distintos, contexto sintético persistível, eventos ordenados, invariantes e contraprovas. Nenhum foi executado por este pacote. **Aceite de produto exige o produtor e a instalação no SHA escolhido**, com evidência de autorização, fonte original e recibo de domínio quando houver mutação.

**Conexões e limites:** as stories sobre `/sucafina/admin/access` referem-se ao PR #270 (proposto, sem prova de go-live); a demo Flamengo ao PR #268 (DRAFT e não seed provado); white-label e integrações externas são condicionais, nunca características presumidamente instaladas. A arquitetura do Opera/Orchestra e a UI de 70 superfícies têm origens diferentes.


## SF-E2E-001 · O briefing das 8h: o CIO precisa decidir sem alterar a fonte

**Prioridade:** P0 · **Atores:** CIO, LEADER, FINANCE · **Jornadas:** J01, J02, J05, J06, J08 · **IDs UI:** CAP01, CAP02, CAP03, CAP09, CAP13, UI29, UI30, UI47 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Às 08:00, CIO revisa backlog EDI HOT-EDI-07, R-07, forecast USD590000 e pedido PR-32000.

**História do usuário:** Como CIO, LEADER, FINANCE, diante da situação descrita, preciso reunir prioridades, orçamento, riscos e encaminhamentos de TI em um briefing confiável, para orientar a reunião das 8h e responsabilizar a pessoa correta por cada pendência.

**Por que importa ao negócio:** orientar a reunião das 8h e responsabilizar a pessoa correta por cada pendência.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Às 08:00, CIO revisa backlog EDI HOT-EDI-07, R-07, forecast USD590000 e pedido PR-32000.

**Roteiro multiator, passo a passo**
1. CIO autentica e escolhe instalação correta
2. Abre Hoje e confere autoria e data de cada alerta
3. Abre dashboard e identifica P-004/risco R-07
4. Caio relata atraso de seis dias em Hot Topics
5. Sofie confirma base do forecast sem aprovar mudança
6. CIO cria pauta com data da fonte explícita
7. Salva snapshot e delega ação a Caio
8. CIO volta a Hoje e confirma que item foi encaminhado uma vez

**Oráculos de aceite**
- Contas da pauta mostram forecast 590000, budget 600000, não 0
- Alerta do risco P-004 possui origem auditável
- Caio recebe exatamente uma tarefa com seu principal
- Ação não muda status de PR ou orçamento
- Revisão preserva versão e autor do briefing
- Tópico com mesmo título mas outro ID não aparece por associação de string

**Contraprovas obrigatórias**
- Interromper sessão do CIO antes de salvar: sem pauta aplicada
- Simular perda de resposta na delegação: recuperar recibo sem duplicar

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-002 · Duas versões de forecast diante do comitê financeiro

**Prioridade:** P0 · **Atores:** FINANCE, BUDGET_OWNER, CIO · **Jornadas:** J01, J02, J05 · **IDs UI:** CAP03, CAP17, CAP18, CAP22, CAP23, UI45, UI46, UI49 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Sofie e Budget Owner discordam do aumento anual da licença; official=590000, WhatIf-A=602000, WhatIf-B=596000.

**História do usuário:** Como FINANCE, BUDGET_OWNER, CIO, diante da situação descrita, preciso comparar hipóteses conflitantes de renovação de licença com budget e actual oficiais intactos, para apresentar ao comitê as diferenças financeiras verificáveis antes de uma decisão.

**Por que importa ao negócio:** apresentar ao comitê as diferenças financeiras verificáveis antes de uma decisão.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Sofie e Budget Owner discordam do aumento anual da licença; official=590000, WhatIf-A=602000, WhatIf-B=596000.

**Roteiro multiator, passo a passo**
1. Sofie abre versão official locked e anota USD590000
2. Cria A baseada em 72000 e altera OPEX-LIC-01 para 84000
3. Outro ator cria B independente e altera para 78000
4. Ambos comparam ao orçamento 600000
5. CIO abre BI com versões A/B, sem assumir merge
6. Finance remove FX para testar uma linha adicional EUR
7. CIO compara cenário e registra decisão, sem publicar official
8. Releitura por terceiro atesta que official/actual seguem imutáveis

**Oráculos de aceite**
- A=602000 e delta +12000; margem vs budget -2000
- B=596000 e delta +6000; margem vs budget +4000
- A/B jamais alteram 590000 da fonte official
- Dado EUR sem FX fica incompatível/indeterminado, não zero
- CIO sabe qual versão está vendo em todos os capítulos
- Mudança de budget só ocorre mediante produtor autorizado separado

**Contraprovas obrigatórias**
- Ator com versão stale tenta save de OPEX e recebe conflito
- Usuário sem Finance tenta gravar versão locked e é negado

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-003 · A cotação mais barata não pode vencer quando é inelegível

**Prioridade:** P0 · **Atores:** REQUESTER, APPROVER, BUYER, SUPPLIER_ADMIN, CIO · **Jornadas:** J04, J06 · **IDs UI:** CAP24, CAP25, CAP26, CAP27, CAP28, UI33, UI35, UI38, UI39, UI40 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · PR-32000: integrar dados de embarques; três cotações A32400USD, B28000EUR×1.08=30240USD, C29000USD inelegível.

**História do usuário:** Como REQUESTER, APPROVER, BUYER, SUPPLIER_ADMIN, CIO, diante da situação descrita, preciso percorrer a compra com ofertas de moedas, elegibilidade técnica e autoridades distintas, para evitar escolha inválida ou aprovação por ator fora da etapa.

**Por que importa ao negócio:** evitar escolha inválida ou aprovação por ator fora da etapa.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- PR-32000: integrar dados de embarques; três cotações A32400USD, B28000EUR×1.08=30240USD, C29000USD inelegível.

**Roteiro multiator, passo a passo**
1. Caio cria PR32000 em USD e submete justificativa
2. Gabriel revisa pedido como holder atual e aprova etapa PR
3. Pedro abre sourcing e associa fornecedores ativos
4. Pedro registra A, B e C com suas elegibilidades
5. Sofie confirma FX temporal 1.08 e moeda
6. CIO abre CASE-EDI-01 para comparar A/B/C
7. CIO escolhe B e registra justificativa
8. Pedro avança sourcing, aprovação e PO por estados existentes
9. Gabriel aprova somente estágio em que é holder
10. Consultar recibo de emissão interna e não alegar transmissão a ERP

**Oráculos de aceite**
- B equivale exatamente a USD30240
- C permanece inelegível mesmo custando menos
- Scores do oráculo, se expostos, mostram 87.9333 e 85 com decomposição
- Cada stage tem holder/versão/recibo específicos
- Buyer não aprova a própria etapa se não for holder
- Emissão interna não equivale a envio externo
- No máximo uma PO resultante do mesmo comando admitido

**Contraprovas obrigatórias**
- Pedro tenta usar URL direta de Gabriel: 403, commit:false
- Marcar SUP-003 inactive durante sourcing: nova adjudicação deve falhar
- Alterar FX depois da comparação: escolha deve exigir revisão ou reavaliação

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-004 · Reunião preservada enquanto o sistema continua mudando

**Prioridade:** P0 · **Atores:** CIO, LEADER, AUDITOR · **Jornadas:** J05, J06, J08 · **IDs UI:** UI47, UI48, UI49, UI50, CAP09, UI51 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · CIO prepara reunião com 25 projetos, notas extensas, períodos mistos e snapshot R1.

**História do usuário:** Como CIO, LEADER, AUDITOR, diante da situação descrita, preciso guardar a fotografia dos 25 projetos e reproduzi-la após os registros vivos mudarem, para comprovar exatamente o que foi discutido sem reescrever o passado.

**Por que importa ao negócio:** comprovar exatamente o que foi discutido sem reescrever o passado.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- CIO prepara reunião com 25 projetos, notas extensas, períodos mistos e snapshot R1.

**Roteiro multiator, passo a passo**
1. CIO escolhe pauta com projetos P-001...P-025 e budget/risco
2. Preserva R1 e registra digest e ordem dos 25 projetos
3. Caio altera fonte do projeto P-004 e uma nota longa
4. CIO reabre R1 em modo apresentação sem recapturar
5. Cria R2 com mudanças explicitadas
6. Compara R1/R2 distinguindo campos e comentário
7. Gera DOCX e PPTX da R1 e abre os arquivos
8. Auditor compara o conteúdo exportado ao snapshot R1, não ao estado de hoje

**Oráculos de aceite**
- R1 contém 25 projetos uma vez, com texto longo sem truncamento silencioso
- P-004 em R1 mantém valor e nota anteriores à mutação
- R2 registra delta, sem reescrever R1
- Arquivos DOCX/PPTX têm bytes reais, hash e autoria
- Revisão misturando competências exibe cada rótulo
- Export não libera source private após revogação

**Contraprovas obrigatórias**
- Atualizar fonte após gerar relatório não altera R1
- Revogar leitor durante download impede extração nova de bytes

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-005 · A importação foi aplicada, mas a confirmação não chegou

**Prioridade:** P0 · **Atores:** FINANCE, LEADER, AUDITOR · **Jornadas:** J03, J01 · **IDs UI:** UI55, UI56, UI57, UI68, CAP18 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Import planner XLSX alinhado à coluna OPEX; renovação 72000→84000; não editar o 518000 inalterado.

**História do usuário:** Como FINANCE, LEADER, AUDITOR, diante da situação descrita, preciso aplicar uma única importação de OPEX, perder a resposta e reconciliar o recibo, para evitar dupla gravação financeira após timeout.

**Por que importa ao negócio:** evitar dupla gravação financeira após timeout.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Import planner XLSX alinhado à coluna OPEX; renovação 72000→84000; não editar o 518000 inalterado.

**Roteiro multiator, passo a passo**
1. Sofie exporta versão de Planner com linha renewal72000 e fixed518000
2. Modifica workbook somente na célula permitida para 84000
3. Seleciona destino real e admite arquivo com MIME XLSX correto
4. Revisa preview, digest, before/after e zero efeitos prévios
5. Confirma Apply uma vez usando attempt ID e versão fixados
6. QA intercepta apenas entrega da resposta após producer commit
7. Sofie aciona recuperação por attempt original sem reenviar Apply
8. Auditor compara tokens antes/depois e recibo original
9. Testa reabrir import em sessão nova e exportar versão

**Oráculos de aceite**
- Apenas renewal muda 72000→84000; fixed permanece 518000
- Preview não altera source nem tokens
- Exatamente uma transação, mesmo com perda da resposta
- Recibo recuparado refere mesmo manifest/attempt
- A reexportação reconcilia valores e versões
- Se arquivo não for admitido pelo produtor, o status é BLOCKED com código real e não efeito simulado

**Contraprovas obrigatórias**
- Tentar reaplicar com mesmo attempt e payload diferente: falha sem commit
- Trocar base depois de preview: CAS impede efeito parcial

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-006 · O documento diz 60, a extração leu 6

**Prioridade:** P0 · **Atores:** LEADER, CIO, FINANCE · **Jornadas:** J05, J07 · **IDs UI:** UI58, UI59, UI60, UI33, UI36, UI42 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Relatório DOC-EDI-01 contém prazo atrasado 6 dias; extrator sintetiza erroneamente 60.

**História do usuário:** Como LEADER, CIO, FINANCE, diante da situação descrita, preciso confrontar dado extraído com documento de origem antes de aprovar o uso em um cenário, para impedir que erro de IA vire valor oficial.

**Por que importa ao negócio:** impedir que erro de IA vire valor oficial.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Relatório DOC-EDI-01 contém prazo atrasado 6 dias; extrator sintetiza erroneamente 60.

**Roteiro multiator, passo a passo**
1. Caio envia documento sintético classificado
2. Inspeciona candidato de extração 60 e rejeita citando a página
3. Confirma apenas trecho correto “6 dias”
4. Vincula evidência confirmada ao risco R-07
5. CIO cria CASE-EDI-01 usando a evidência
6. Finance verifica fonte e competências antes da comparação
7. CIO executa cenário com rastreabilidade ao docRef
8. Auditor consulta histórico de rejeição, sem deletar evidência de erro

**Oráculos de aceite**
- Candidato 60 permanece rejeitado e não vira fato
- Evidência 6 contém documento, trecho, revisão e humano
- Nenhuma quote/PO é alterada pelo texto do documento
- Cenário mostra evidência confirmada e fonte
- Revogação da fonte impede releitura mesmo por links antigos

**Contraprovas obrigatórias**
- Repetir extração com output que omita página: permanece candidato não confirmado
- Usar documento de outro tenant: nenhuma leitura cruzada

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-007 · Drill-down executivo precisa fechar com a fonte

**Prioridade:** P0 · **Atores:** CIO, FINANCE, LEADER · **Jornadas:** J02, J08 · **IDs UI:** CAP03, CAP04, CAP05, CAP09, UI45, UI46 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Executivo questiona por que forecast indica 590000 mas outra visualização indica 602000.

**História do usuário:** Como CIO, FINANCE, LEADER, diante da situação descrita, preciso rastrear KPIs de BI até registros originais, filtros, moedas e data de referência, para sustentar decisões com números conciliáveis e sem contagem dupla.

**Por que importa ao negócio:** sustentar decisões com números conciliáveis e sem contagem dupla.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Executivo questiona por que forecast indica 590000 mas outra visualização indica 602000.

**Roteiro multiator, passo a passo**
1. CIO abre visão BI geral e identifica a versão mostrada
2. Sofie abre Planner OPEX e localiza 72000 oficial/84000 cenário A
3. CIO acessa drilldown de BI e inspeciona sourceRef
4. Caio abre portfolio e confirma que orçamento não foi aplicado ao projeto
5. CIO alterna de cenário A para official
6. QA compara data de atualização, intervalo e escala de moeda
7. Inspeciona um registro missing e outro valor zero
8. Retorna à visão geral mantendo o filtro

**Oráculos de aceite**
- Cada KPI identifica fonte, competência e versão
- 590000 official e 602000 cenário A não são tratados como conflito de soma
- Missing/zero têm semânticas diferentes
- Trocar versão não altera fonte de domínio
- Drilldown revalida grants na navegação

**Contraprovas obrigatórias**
- Revogar sourceRef após abrir painel: reconsulta não vaza linha
- Mudar unidade USD para EUR sem FX: KPI não é calculado com taxa arbitrária

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-008 · Headcount e remuneração sob segregação real

**Prioridade:** P0 · **Atores:** HR, FINANCE, CIO · **Jornadas:** J02, J08 · **IDs UI:** CAP06, CAP07, CAP08, CAP20, CAP21, UI45 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Plano 42 FTE, 40 ativos e 2 posições vagas; 1 contrata em outubro sem alterar setembro.

**História do usuário:** Como HR, FINANCE, CIO, diante da situação descrita, preciso planejar vaga e cenário de contratação sem expor dados de pessoa ou folha a leitores indevidos, para preservar privacidade e precisão do custo de pessoal.

**Por que importa ao negócio:** preservar privacidade e precisão do custo de pessoal.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Plano 42 FTE, 40 ativos e 2 posições vagas; 1 contrata em outubro sem alterar setembro.

**Roteiro multiator, passo a passo**
1. HR inspeciona Headcount Overview setembro
2. Abre organograma e confirma 40 pessoas sem ciclo
3. Consulta 2 posições planejadas e custos conforme grant
4. Cria hipótese de contratação de 1 FTE em outubro
5. Finance revisa impacto de custo sem ver notas privadas de talento
6. CIO abre BI agregado e verifica total não nominativo
7. HR confirma review TAL-014 e sua classificação
8. QA tenta exportar como Viewer sem grant

**Oráculos de aceite**
- 42 planned / 40 occupied / 2 vacant em setembro
- Mudança outubro não reescreve actual setembro
- Notas TAL-014 não aparecem no BI executivo sem permissão
- Cargo do funcionário não concede role Entra
- Viewer recebe negação/redaction e nenhum dado privado em cache

**Contraprovas obrigatórias**
- Nome homônimo ou ciclo manager A→B→A: não fundir perfis
- Vagas sem rate conhecido: custo agregado reportado incompleto

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-009 · Risco operacional vira decisão de portfólio

**Prioridade:** P0 · **Atores:** LEADER, RISK_OWNER, CIO · **Jornadas:** J05, J06, J08 · **IDs UI:** CAP09, CAP10, CAP13, CAP15, UI47, UI54 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · P-004 tem milestone 15/dez e risco R-07; stakeholder externo exige novo prazo.

**História do usuário:** Como LEADER, RISK_OWNER, CIO, diante da situação descrita, preciso ligar atraso do projeto, risco e impacto material a uma decisão humana, para priorizar corretamente e preservar justificativa.

**Por que importa ao negócio:** priorizar corretamente e preservar justificativa.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- P-004 tem milestone 15/dez e risco R-07; stakeholder externo exige novo prazo.

**Roteiro multiator, passo a passo**
1. Caio atualiza milestone MS-04 com justificativa
2. Risk Owner ajusta mitigação de R-07 sem mudar PR
3. Stakeholder STK-011 recebe registro de comunicação
4. CIO abre portfolio 25 projetos, não os duplica por vínculo
5. CIO prepara pauta incorporando risco e milestone
6. Revisão preserva a versão de ambos
7. CIO encaminha action a Caio
8. Caio confirma ação sem mexer em orçamento

**Oráculos de aceite**
- Milestone, risco e stakeholder mantêm IDs distintos
- Portfólio apresenta 25 projetos uma vez
- Encaminhamento produz uma tarefa, não commit Finance
- Pauta registra data de origem dos registros
- Histórico de alterações é auditável por autor

**Contraprovas obrigatórias**
- Alterar risco depois da revisão não muda snapshot antigo
- Reenviar ação após timeout não duplica tarefa

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-010 · Incidente de segurança com indicador e dono

**Prioridade:** P0 · **Atores:** SECURITY, OPS, CIO · **Jornadas:** J06, J08 · **IDs UI:** CAP11, CAP12, CAP13, CAP16, UI61, UI47 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Uptime 99.7% vs 99.9% SLA, 3 incidentes e 4 de 200 endpoints sem patch.

**História do usuário:** Como SECURITY, OPS, CIO, diante da situação descrita, preciso levar um incidente realista de TI até métricas, risco e escalonamento de gestão, para garantir resposta tempestiva sem inflar ou esconder métricas.

**Por que importa ao negócio:** garantir resposta tempestiva sem inflar ou esconder métricas.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Uptime 99.7% vs 99.9% SLA, 3 incidentes e 4 de 200 endpoints sem patch.

**Roteiro multiator, passo a passo**
1. Operações confirma downtime em setembro
2. Segurança valida 4 endpoints críticos sem patch
3. Risco R-07 recebe mitigação e autoridade própria
4. Finance/exec vê resultado agregado, não credenciais
5. Signals identifica materialidade acima do limiar
6. CIO inclui incidente na pauta da reunião
7. Auditor verifica numeradores e denominadores
8. QA marca 0 breaches com base conhecida, não missing

**Oráculos de aceite**
- Taxa de não conformidade = 2% se denominador=200
- Meta 99.9 e real 99.7 permanecem distinguíveis
- Incidentes e riscos associados não são fundidos em um registro
- Missing não é apresentado como 0 breaches
- A pauta não altera estado de incidente

**Contraprovas obrigatórias**
- Fazer denominador null: taxa indeterminada
- Viewer sem grant tenta acessar relatório nominativo de incidente: negado

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-011 · Dados bancários de fornecedor não são dados de comprador

**Prioridade:** P0 · **Atores:** SUPPLIER_ADMIN, BUYER, CIO · **Jornadas:** J04, J08 · **IDs UI:** CAP14, CAP25, CAP27, UI31, UI68 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · SUP-003 tem dados financeiros sensíveis sintéticos; buyer somente vê elegibilidade.

**História do usuário:** Como SUPPLIER_ADMIN, BUYER, CIO, diante da situação descrita, preciso revisar cadastro, aprovação e leitura de campos restritos em diferentes perfis, para não permitir exposição financeira indevida.

**Por que importa ao negócio:** não permitir exposição financeira indevida.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- SUP-003 tem dados financeiros sensíveis sintéticos; buyer somente vê elegibilidade.

**Roteiro multiator, passo a passo**
1. Supplier Admin cria/edita SUP-003 autorizado
2. Pedro consulta cadastro geral do fornecedor
3. Pedro abre cotação no contexto de PR-32000
4. QA tenta achar conta bancária por Busca SF
5. QA tenta exportar PO com campos privados
6. Revoga grant e repete URLs e downloads
7. Verifica logs sanitizados e redaction no DOM
8. Auditor confere ausência de commit pelo Buyer

**Oráculos de aceite**
- Buyer vê supplierRef, status e item elegível sem dados bancários
- Busca e export não vazam campos restritos
- Grant revogado faz efeito em sessão existente
- Cadastro não é atualizado por leitura
- Eventos de negação não persistem o segredo negado

**Contraprovas obrigatórias**
- URL direta a supplier bank data sem grant: 403/redaction
- Trocar objeto de fornecedor em requisição mantendo principal: deve falhar

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-012 · Duas pessoas editam a mesma linha no Planner

**Prioridade:** P0 · **Atores:** FINANCE, BUDGET_OWNER · **Jornadas:** J01, J02 · **IDs UI:** CAP18, CAP23, UI53 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Duas janelas no mesmo registro OPEX-LIC-01 v3; Sofie muda para 84000 e Budget Owner tenta salvar 78000 sobre v3.

**História do usuário:** Como FINANCE, BUDGET_OWNER, diante da situação descrita, preciso preservar a edição válida e rejeitar submissão obsoleta sob CAS, para não perder atualizações em períodos de fechamento.

**Por que importa ao negócio:** não perder atualizações em períodos de fechamento.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Duas janelas no mesmo registro OPEX-LIC-01 v3; Sofie muda para 84000 e Budget Owner tenta salvar 78000 sobre v3.

**Roteiro multiator, passo a passo**
1. Ambas contas leem v3 simultaneamente
2. Finance salva 84000 com CAS v3 e obtém v4
3. Budget Owner mantém editor antigo carregado
4. Budget Owner envia 78000 usando v3
5. QA registra status e diff mostrado
6. Usuário decide reload e cria hipótese B em vez de sobrescrever A
7. Reabre Fonte A e B em sessões separadas

**Oráculos de aceite**
- Segundo update recebe conflito, sem gravar 78000 sobre A
- Mudança local pode ser recuperada/reaplicada conscientemente
- A termina 84000 e B 78000, cada uma na versão correta
- Audit não registra sucesso para update stale
- Não há pending falsa em mês independente

**Contraprovas obrigatórias**
- Mudar principal no meio da requisição: binding stale rejeitado
- Responder 200 sem commit seria falha crítica

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-013 · Revogação deve valer inclusive para documentos já gerados

**Prioridade:** P0 · **Atores:** CIO, AUDITOR, LEADER · **Jornadas:** J05, J08 · **IDs UI:** UI48, UI50, UI31, UI62, UI67 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Leitor autorizado abriu revisão confidencial R1 e documento de Supplier; acesso é revogado antes do download.

**História do usuário:** Como CIO, AUDITOR, LEADER, diante da situação descrita, preciso cortar acesso a tela, histórico e download após perda da permissão, para assegurar que material sensível não sobreviva à revogação.

**Por que importa ao negócio:** assegurar que material sensível não sobreviva à revogação.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Leitor autorizado abriu revisão confidencial R1 e documento de Supplier; acesso é revogado antes do download.

**Roteiro multiator, passo a passo**
1. CIO cria R1 e documento acessível ao leitor temporariamente
2. Leitor abre link da R1 e solicita relatório
3. Admin revoga grant de leitura na instalação
4. Leitor recarrega página sem relogar
5. Tenta baixar DOCX já gerado e abrir revisão por URL direta
6. Tenta pesquisa de título e similar cases
7. Tenta usar URL antiga em segundo navegador
8. Auditor consulta log de permissão e snapshots de ausência de vazamento

**Oráculos de aceite**
- A revalidação não depende do clique inicial
- Downloads após revogação negados
- Search e similar cases não revelam conteúdo/nome privado
- Mudança de grant é aplicada a sessões válidas já existentes
- Sem fallback local-operator na nuvem

**Contraprovas obrigatórias**
- Replay de link assinado sob principal diferente: negado
- Cache offline com conteúdo sensível precisa invalidar/expirar segundo contrato

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-014 · Mesmo nome, dois tenants e nenhum vazamento

**Prioridade:** P0 · **Atores:** CIO, FINANCE, BUYER · **Jornadas:** J03, J04, J08 · **IDs UI:** UI67, CAP18, CAP25, UI58, UI68 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Instalação A SF-LAB e B SF-ISOLATED; IDs sintéticos parecidos mas projetos/principals distintos.

**História do usuário:** Como CIO, FINANCE, BUYER, diante da situação descrita, preciso trocar instalação/tenant com referências visualmente parecidas, para impedir leitura e escrita no conjunto errado.

**Por que importa ao negócio:** impedir leitura e escrita no conjunto errado.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Instalação A SF-LAB e B SF-ISOLATED; IDs sintéticos parecidos mas projetos/principals distintos.

**Roteiro multiator, passo a passo**
1. Autenticar Finance na instalação A e abrir OPEX-LIC-01
2. Capturar referência de A e trocar instalação para B
3. Tentar abrir OPEX e documento de A via URL adulterada
4. Buyer tenta consultar PR-32000 de A pela sessão B
5. CIO tenta exportar relatório de A com contexto B
6. Reabrir B pela rota normal e validar dados próprios
7. Trocar de volta para A e verificar ausência de novos commits

**Oráculos de aceite**
- Contexto B nunca acessa dados da instalação A só por ID
- Todas mutações exigem owner tuple atual
- Referências opacas não são autorização
- Tentativas negadas não escrevem dados em A/B
- Após troca, UI não mantém dados da sessão anterior

**Contraprovas obrigatórias**
- Passar X-SF-Native-Owner codificado que não bate com sessão: 409
- Ausência de fence quando exigida resulta bloqueio, nunca fallback

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-015 · Login corporativo sem atalhos na identidade

**Prioridade:** P0 · **Atores:** CIO, LEADER, BUYER · **Jornadas:** J08 · **IDs UI:** UI67, UI69 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Entra B2B resource tenant; sem gravar tokens/segredos em artefatos.

**História do usuário:** Como CIO, LEADER, BUYER, diante da situação descrita, preciso validar retorno do OIDC, sessão e proteção de origem/replay, para impedir impersonação e autorização por contexto falso.

**Por que importa ao negócio:** impedir impersonação e autorização por contexto falso.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Entra B2B resource tenant; sem gravar tokens/segredos em artefatos.

**Roteiro multiator, passo a passo**
1. Executar login real com principal autorizado e observar endpoint no browser
2. Conferir origem HTTPS e redirecionamento registado
3. Simular código OIDC reutilizado com autorização do QA
4. Testar nonce/state inválidos em ambiente controlado
5. Testar CSRF e origem ausente em POST de produto
6. Alterar tid/oid de token sintético no fixture de contraprova
7. Remover grupo do ator e validar nova negação
8. Verificar cookies, logs, cache e ausência de token em HTML

**Oráculos de aceite**
- Callback inválido falha fechada sem sessão
- tid/oid vinculados ao recurso; principal não é email/displayName
- POST exige origin/CSRF e policy atual
- 403/401 distinguidos de 200 legítimo
- Nenhum secret ou token acaba em screenshots, CI ou logs

**Contraprovas obrigatórias**
- Cross-tenant token com assinatura válida de outro tenant deve ser negado
- local-operator não substitui Microsoft session no Azure

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-016 · O organograma oficial precisa vir do Graph

**Prioridade:** P0 · **Atores:** CIO, LEADER, BUYER · **Jornadas:** J08 · **IDs UI:** UI67 · **Condição:** `PR270_NOT_PROMOTED`

**Situação de negócio.** SF-LAB-2026 · Feature proposta no PR #270: /sucafina/admin/access, FORA das 70 nativas; executar só após montagem real.

**História do usuário:** Como CIO, LEADER, BUYER, diante da situação descrita, preciso inspecionar hierarquia, cargo, times e grupos da organização de forma atual e completa, para administrar papéis a partir de identidade real, não cadastro paralelo.

**Por que importa ao negócio:** administrar papéis a partir de identidade real, não cadastro paralelo.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Feature proposta no PR #270: /sucafina/admin/access, FORA das 70 nativas; executar só após montagem real.

**Roteiro multiator, passo a passo**
1. Daniel ou André autentica como membro efetivo do grupo supremo
2. Abre /sucafina/admin/access e verifica renderização da árvore
3. QA fornece hierarquia Graph com 2 raízes, grupos nested e perfis homônimos
4. Valida que manager 404 fica sem manager, não usuário forjado
5. Navega por departamentos, Teams e grupos do usuário
6. Caio/Pedro/Zico tentam GET direto e link na UI
7. QA confere que links admin só existem para supreme, sem confiar neles como guard
8. Inspeciona que Graph foi acessado somente no servidor

**Oráculos de aceite**
- Árvore reflete todos os usuários retornados pela paginação sem duplicata
- Chaves são objectId, não título/username
- Caio/Pedro/Zico não veem link, recebem 403 em GET/POST
- Disconected roots são explicitadas; ciclo manager não causa loop
- Token Graph não aparece no HTML ou browser
- Se Graph falha, não há renderização parcial autoritativa

**Contraprovas obrigatórias**
- Usuário admin de tela (sem supreme) recebe 403
- Faltar grant de Graph numa conta guest gera 503 explícito, não acesso parcial

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-017 · Grupo concede papel; perfil recebe grant independente

**Prioridade:** P0 · **Atores:** CIO, PROC_ADMIN, BUYER · **Jornadas:** J08 · **IDs UI:** UI67, CAP25, CAP26 · **Condição:** `PR270_NOT_PROMOTED`

**Situação de negócio.** SF-LAB-2026 · Admin supremo define role por grupo para Dashboard, Planner, Procurement e grants diretos separados.

**História do usuário:** Como CIO, PROC_ADMIN, BUYER, diante da situação descrita, preciso configurar papel herdado de grupo e permissão direta por perfil sem confundi-los, para aplicar o modelo de acesso projetado pelo administrador.

**Por que importa ao negócio:** aplicar o modelo de acesso projetado pelo administrador.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Admin supremo define role por grupo para Dashboard, Planner, Procurement e grants diretos separados.

**Roteiro multiator, passo a passo**
1. Daniel seleciona grupo Graph existente como dashboard contributor
2. Seleciona finance para Planner em outro grupo
3. Configura procurement buyer para grupo de Pedro
4. Concede a um profile object ID operações exatas de um domínio
5. Salva via POST com revisão e confere PRG 303
6. Reloga como Pedro e testa comandos reais de buyer, não só UI
7. Tenta executar operação fora da grant e valida 403
8. Volta ao admin e consulta audit from/to e versão após restart

**Oráculos de aceite**
- Grupo→role e profile→grant são duas dimensões independentes
- Role de Buyer sem grant suficiente não inventa operações
- Grant sem role correspondente não inventa autoridade
- Estado persiste de forma atômica com actor objectId
- Nenhuma escrita toca Microsoft Graph
- Auditoria recupera from/to e UTC

**Contraprovas obrigatórias**
- Enviar role fora do enum ou namespace/operation não admitidos: 422 e no commit
- Enviar group ID inexistente: rejeição; não criar Graph group fictício

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-018 · Nem o administrador pode se autoconceder privilégios

**Prioridade:** P0 · **Atores:** CIO · **Jornadas:** J08 · **IDs UI:** UI67 · **Condição:** `PR270_NOT_PROMOTED`

**Situação de negócio.** SF-LAB-2026 · Daniel membro supreme tenta alterar seus próprios grants e role inheritance.

**História do usuário:** Como CIO, diante da situação descrita, preciso testar tentativa de autoelevação, autodeleção e escopo fora da allowlist, para reduzir riscos de abuso administrativo.

**Por que importa ao negócio:** reduzir riscos de abuso administrativo.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Daniel membro supreme tenta alterar seus próprios grants e role inheritance.

**Roteiro multiator, passo a passo**
1. Abrir admin como Daniel com roles vigentes
2. Capturar snapshots das três telas e próprio principal oid
3. Tentar atribuir a si mesmo novo grant de supplier-admin
4. Tentar remover o próprio grant ativo
5. Tentar trocar grupo→role que adicione papel herdado a Daniel
6. Tentar remover papel de um grupo do qual Daniel faz parte
7. Confirmar que nenhuma tentativa cria audit de sucesso
8. Reabrir como segundo admin e testar alteração legítima de outra pessoa

**Oráculos de aceite**
- Todas alterações próprias são rejeitadas conforme contrato anti-escalation/lockout
- Versão e snapshots não mudam nos casos negados
- O grupo supreme nunca pode ser editado pelo workbench
- Segundo admin pode alterar outro perfil sob CAS e policy, sem tocar Graph

**Contraprovas obrigatórias**
- Forjar actor oid no POST não muda identidade do servidor
- Trocar nome de grupo para simular group:<uuid> diferente não contorna guard

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-019 · Colaborador saiu: as permissões órfãs continuam visíveis

**Prioridade:** P0 · **Atores:** CIO, HR · **Jornadas:** J08 · **IDs UI:** UI67, CAP07 · **Condição:** `PR270_NOT_PROMOTED`

**Situação de negócio.** SF-LAB-2026 · Diretório Graph remove perfil de empregado, persistindo grant órfão na instalação.

**História do usuário:** Como CIO, HR, diante da situação descrita, preciso localizar identidades desaparecidas e revogar grants sem reconstruir pessoa falsa, para fechar acesso residual com auditoria.

**Por que importa ao negócio:** fechar acesso residual com auditoria.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Diretório Graph remove perfil de empregado, persistindo grant órfão na instalação.

**Roteiro multiator, passo a passo**
1. Admin carrega diretório completo com usuário sintético EMP-OLD-01
2. Grava grant específico àquele objectId de teste
3. Simula remoção do usuário do Graph na fixture
4. Reabre admin e verifica seção de permissões órfãs
5. Inspeciona scopes e ID sem inferir novo usuário pelo nome
6. Revoga grant órfão via transação CAS
7. Recarrega admin e confere desaparecimento do órfão
8. QA relê audit, versão e snapshots depois do restart

**Oráculos de aceite**
- Orfandade é declarada somente com Graph completo
- Grant órfão não é reatribuído a homônimo automaticamente
- Revogação é explícita, atômica e auditada
- Falha Graph 503 impede conclusão de órfãos
- A tela não escreve usuários no Entra

**Contraprovas obrigatórias**
- Falha de paginação deve bloquear tela, não sugerir excluir grants vivos
- Ao recuperar Graph, orphan reaparece ou some conforme fonte

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-020 · Graph indisponível não autoriza uma árvore parcial

**Prioridade:** P0 · **Atores:** CIO · **Jornadas:** J08 · **IDs UI:** UI67 · **Condição:** `PR270_NOT_PROMOTED`

**Situação de negócio.** SF-LAB-2026 · Graph paging: 2000 users, grupos nested, 429 throttle, 403 restricted guest.

**História do usuário:** Como CIO, diante da situação descrita, preciso injetar throttling, paginação incompleta e falta de permissão no diretório, para evitar decisões de acesso apoiadas em dados incompletos.

**Por que importa ao negócio:** evitar decisões de acesso apoiadas em dados incompletos.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Graph paging: 2000 users, grupos nested, 429 throttle, 403 restricted guest.

**Roteiro multiator, passo a passo**
1. Conferir leitura `/users` com múltiplas páginas
2. Simular página com nextLink em ciclo para testar limite
3. Simular 429 com retry autorizado e budget finito
4. Simular grupo oculto ou transitiveMembers 403
5. Validar que admin não renderiza org parcial como completo
6. Tentar salvar alteração quando Graph está incompleto
7. Recuperar Graph e repetir leitura
8. Verificar ausência de bearer token no DOM e logs

**Oráculos de aceite**
- Erro de qualquer etapa crítica resulta em 503 sem conclusão parcial
- Nenhuma alteração de role/grant ocorre sem snapshot Graph válido
- Paginação lida com limites, ciclos e duplicatas
- Nenhum redirect externo é seguido
- Uma falha não habilita escopo mais permissivo

**Contraprovas obrigatórias**
- Injetar nextLink host externo: blocked
- Conjunto de usuários vazio por falha não pode apagar grants legítimos

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-021 · Dois administradores alteram a mesma política

**Prioridade:** P0 · **Atores:** CIO, HR · **Jornadas:** J08 · **IDs UI:** UI67 · **Condição:** `PR270_NOT_PROMOTED`

**Situação de negócio.** SF-LAB-2026 · Daniel e André alteram roleMap de mesmo grupo em duas abas com revisão V7.

**História do usuário:** Como CIO, HR, diante da situação descrita, preciso submeter edições concorrentes do mapa de papéis e conferir CAS, auditoria e rollback, para não sobrescrever política de segurança silenciosamente.

**Por que importa ao negócio:** não sobrescrever política de segurança silenciosamente.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Daniel e André alteram roleMap de mesmo grupo em duas abas com revisão V7.

**Roteiro multiator, passo a passo**
1. Daniel e André abrem admin na versão V7
2. Daniel configura group→role Buyer e salva, vira V8
3. André tenta salvar snapshot V7 após editar Finance
4. QA captura 409 e corpo do erro
5. André recarrega V8 e refaz alteração válida
6. Comparar auditoria from/to de ambas ações
7. Reiniciar store sob QA e reler versões
8. Validar que nenhum change parcial ficou aplicado

**Oráculos de aceite**
- V7 stale recebe 409 e não escreve
- Auditoria contém apenas ações realmente admitidas
- Estado persiste após restart
- CAS por binding/perfil segue contrato e escopo
- Releitura de usuários obtém grants atuais em cada operação

**Contraprovas obrigatórias**
- Modificar policy fora do POST autorizado falha
- POST simultâneo não perde update do outro admin

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-022 · Mudança de grant deve produzir efeito na sessão ativa

**Prioridade:** P0 · **Atores:** CIO, BUYER, APPROVER · **Jornadas:** J04, J08 · **IDs UI:** CAP25, CAP26, UI67 · **Condição:** `PR270_NOT_PROMOTED`

**Situação de negócio.** SF-LAB-2026 · Pedro já está logado; Daniel revoga operação grant de sourcing.

**História do usuário:** Como CIO, BUYER, APPROVER, diante da situação descrita, preciso retirar ou acrescentar grant e comprovar releitura server-side sem depender de relogin, para manter autorização efetiva atualizada.

**Por que importa ao negócio:** manter autorização efetiva atualizada.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Pedro já está logado; Daniel revoga operação grant de sourcing.

**Roteiro multiator, passo a passo**
1. Pedro abre página sourcing com versão V3
2. Daniel acessa admin e revoga grant específico de Pedro
3. Pedro tenta POST sourcing a partir de form antiga
4. QA captura 403, snapshots before/after e accessRevision
5. Pedro recarrega página e valida ação desabilitada
6. Daniel readiciona grant em ambiente controlado
7. Pedro reloga/recarrega e testa nova permissão
8. Auditor valida que nenhuma tentativa negada escreveu PO

**Oráculos de aceite**
- Revogação efetiva sem aguardar restart
- Rota visível não concede capacidade de mutation
- 401/403 observados conforme sessão e policy real
- Group role sozinho não permite operação sem direct grant quando exigido
- Nenhum dado histórico é perdido por revogação

**Contraprovas obrigatórias**
- Tentar POST após grant revogado usando cookie de sessão antiga: negado
- Role admin da tela não concede supreme admin

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-023 · Planilha adversarial não pode contaminar o orçamento

**Prioridade:** P0 · **Atores:** FINANCE, AUDITOR · **Jornadas:** J03 · **IDs UI:** UI55, UI56, UI57 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Import XLSX MIME correto, arquivo XLSX com conteúdo CSV disfarçado e planilha com coluna Finance inválida.

**História do usuário:** Como FINANCE, AUDITOR, diante da situação descrita, preciso rejeitar arquivo malformado, duplicado e parcialmente válido sem commit parcial, para proteger dados financeiros e trilha de importação.

**Por que importa ao negócio:** proteger dados financeiros e trilha de importação.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Import XLSX MIME correto, arquivo XLSX com conteúdo CSV disfarçado e planilha com coluna Finance inválida.

**Roteiro multiator, passo a passo**
1. Preparar baseline sem nenhum novo lançamento
2. Enviar XLSX legítimo e capturar manifest preview
3. Cancelar sem Apply e comprovar banco imutável
4. Enviar arquivo `.xlsx` com bytes inválidos
5. Enviar workbook com header errado e linha duplicada
6. Repetir com row válida e row inválida, sem autorizar partial
7. Gerar nova prévia após corrigir e aplicar somente quando contratualmente admitido
8. Auditor compara digests/receipts e contagem efetiva

**Oráculos de aceite**
- Admissão inválida retorna erro sem efeitos
- Cancelamento de preview não escreve
- Aplicação válida tem fonte/versão/ID de attempt
- Erros de linha não são escondidos em sucesso agregado
- Se import exige all-valid, arquivo misto é rejeitado por inteiro

**Contraprovas obrigatórias**
- Arquivo com macros não deve ser executado
- Upload em destino de outro principal deve ser negado

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-024 · Relatório demorou: a UI não pode mentir

**Prioridade:** P0 · **Atores:** CIO, AUDITOR · **Jornadas:** J05 · **IDs UI:** UI47, UI48, UI50 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Snapshot R1 de 25 projetos com DOCX/PPTX; worker de geração atrasado intencionalmente.

**História do usuário:** Como CIO, AUDITOR, diante da situação descrita, preciso executar geração lenta e observar timeout, falha, cancelamento e recuperação, para evitar informar êxito quando o documento não existe.

**Por que importa ao negócio:** evitar informar êxito quando o documento não existe.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Snapshot R1 de 25 projetos com DOCX/PPTX; worker de geração atrasado intencionalmente.

**Roteiro multiator, passo a passo**
1. Criar review R1 e registrar hash
2. Solicitar relatório e observar estado started
3. Simular worker travado por > timeout operacional
4. Reabrir job em sessão nova
5. Inspecionar se arquivo de saída realmente existe
6. Cancelar/reexecutar apenas conforme contrato e sem duplicação
7. Recuperar worker e gerar output válido
8. Conferir byte/hash final contra R1

**Oráculos de aceite**
- Started nunca vira completed sem arquivo
- Timeout é diagnosticável com runRef e estado honesto
- Reexecução é autorizada, não retry cego
- Arquivo correto abre externamente e bate R1
- Revogação após geração impede download novo

**Contraprovas obrigatórias**
- Relatório aponta URL sem arquivo: FAIL
- Worker cria arquivo mas audit/receipt não aponta digest: FAIL

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-025 · 25 projetos, notas longas e apresentação acessível

**Prioridade:** P0 · **Atores:** CIO, AUDITOR · **Jornadas:** J05, J08 · **IDs UI:** UI47, UI48, UI49, UI50 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Pauta R1 com 25 projetos, 6 seções, notas multilinha e valores null/zero.

**História do usuário:** Como CIO, AUDITOR, diante da situação descrita, preciso capturar, navegar e exportar relatório volumoso em múltiplas larguras, para levar uma reunião executiva completa sem perda ou duplicação de conteúdo.

**Por que importa ao negócio:** levar uma reunião executiva completa sem perda ou duplicação de conteúdo.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Pauta R1 com 25 projetos, 6 seções, notas multilinha e valores null/zero.

**Roteiro multiator, passo a passo**
1. Criar 25 projetos ordenados e abrir pauta
2. Selecionar seis seções com competências distintas
3. Capturar R1 e comparar 25 projetos na apresentação
4. Rodar zoom 200 e 400% em browser e teclado
5. Abrir em viewport 320, 768 e 1440 px
6. Exportar DOCX/PPTX e inspecionar texto longo
7. Executar comparação R1/R2 depois de alterar uma nota
8. Rever autorização com auditor externo

**Oráculos de aceite**
- Sem perder projeto por paginação ou trunca silenciosa
- Tabulação e foco permanecem acessíveis
- Notação null/zero distinta na comparação
- Presentation e Office refletem R1, não fonte atual
- Se viewport necessitar scroll horizontal de tabela, container é controlado sem overflow da página

**Contraprovas obrigatórias**
- Carregar projeto com emoji/acento e 3 mil caracteres de nota: texto escapa e não injeta HTML
- Acesso revogado impede abrir apresentação antiga

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-026 · Agente nativo produz parecer, não aprovação automática

**Prioridade:** P0 · **Atores:** CIO, FINANCE, BUYER · **Jornadas:** J07, J04 · **IDs UI:** UI41, UI64, UI65, UI70, UI38 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Run “analisar riscos de fornecedor” oferece recomendação para PR32000, mas não tem grant de aplicar negócio.

**História do usuário:** Como CIO, FINANCE, BUYER, diante da situação descrita, preciso executar rotina com skill e verificador, diferenciando proposta de mutação efetiva, para usar IA com controle humano e prova técnica.

**Por que importa ao negócio:** usar IA com controle humano e prova técnica.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Run “analisar riscos de fornecedor” oferece recomendação para PR32000, mas não tem grant de aplicar negócio.

**Roteiro multiator, passo a passo**
1. Selecionar rotina com digest fixado e inputs versionados
2. Admitir run com usuário autorizado, orçamento/modelo permitido
3. Acompanhar estados reais até output terminal
4. Injetar output que propõe escolher C inelegível
5. Verifier independente aponta falha ou alerta
6. CIO registra escolha humana apenas com fontes admitidas
7. QA inspeciona Procurement e confirma nenhum efeito autônomo
8. Reexecutar run após revogar grant e verificar failclosed

**Oráculos de aceite**
- LLM não transforma texto em autorização
- Output inválido não vira aprovado
- Todas contributions identificam model/skill/run/input
- Nenhuma PR/PO muda por conclusão do run
- Revogação remove acesso às fontes na execução/releitura

**Contraprovas obrigatórias**
- Skill inexistente provoca unavailable, não fake completed
- Cancelamento em estágio terminal não forja cancelamento

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-027 · Rotina recorrente cruza fusos e muda de horário

**Prioridade:** P0 · **Atores:** CIO, OPS · **Jornadas:** J07 · **IDs UI:** UI64, UI65, UI66, UI70 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Recorrência 08:00 America/Sao_Paulo e revisão de ocorrência; producer native scheduleDetails.read pode estar indisponível.

**História do usuário:** Como CIO, OPS, diante da situação descrita, preciso programar execução, verificar ocorrência real e lidar com DST e indisponibilidade de detalhes, para não confundir agendamento com resultado concluído.

**Por que importa ao negócio:** não confundir agendamento com resultado concluído.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Recorrência 08:00 America/Sao_Paulo e revisão de ocorrência; producer native scheduleDetails.read pode estar indisponível.

**Roteiro multiator, passo a passo**
1. Abrir schedule e confirmar leitura de detalhes
2. Se porta indisponível, registrar BLOCKED em vez de editar às cegas
3. Se disponível, criar schedule para 08:00 America/Sao_Paulo
4. Observar primeira execução realmente disparada
5. Comparar state da ocorrência e state do run
6. Pausar schedule com autorização atual
7. Alterar timezone para UTC e revisar o próximo horário
8. QA confere que duas instâncias não executam mesma ocorrência duas vezes

**Oráculos de aceite**
- Hora da recorrência tem timezone e DST explícitos
- Schedule started não significa run completed
- Pause tem recibo/estado comprovado
- Native scheduler, não HTTP inventado, é usado
- Sem leitura detalhes, edição/destructive change é bloqueada

**Contraprovas obrigatórias**
- Perda de resposta no pause não causa duas alterações
- Revisão stale do scheduler exige reload

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-028 · Busca precisa preservar privacidade e proveniência

**Prioridade:** P0 · **Atores:** CIO, LEADER, AUDITOR · **Jornadas:** J06, J08 · **IDs UI:** UI31, UI32, UI62 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Busca sobre título “EDI Santos”, dois objetos homônimos e documento privado DOC-EDI-01.

**História do usuário:** Como CIO, LEADER, AUDITOR, diante da situação descrita, preciso buscar termos sensíveis sem colocá-los na URL, sob papéis diferentes, para evitar vazamento em logs, histórico e resultados.

**Por que importa ao negócio:** evitar vazamento em logs, histórico e resultados.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Busca sobre título “EDI Santos”, dois objetos homônimos e documento privado DOC-EDI-01.

**Roteiro multiator, passo a passo**
1. CIO pesquisa EDI Santos via POST JSON
2. Confere que URL não contém termo de busca
3. Abre dois resultados homônimos por IDs distintos
4. Auditor sem grant repete busca
5. Inspeciona resultados de similar cases
6. Tenta GET com parâmetros de query privados
7. Tenta saved view com filtros do CIO em outra conta
8. QA captura network trace sanitizada e ausência de informação privada

**Oráculos de aceite**
- POST e idempotency conforme contrato instalado
- GET with query é recusado, não convertido silenciosamente
- Resultados são privados por principal mesmo que título igual
- Saved Views V2 é tratado como indisponível se não instalado
- Nenhum resultado concede acesso à fonte

**Contraprovas obrigatórias**
- Ataque Unicode confusable no nome da referência não troca IDs
- Termos de busca não aparecem em URLs/Referer ou logs públicos

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-029 · Visão salva só existe quando a capacidade V2 está disponível

**Prioridade:** P1 · **Atores:** LEADER, CIO · **Jornadas:** J01, J08 · **IDs UI:** UI30, UI32 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · VIEW-EDI-Caio; no snapshot da auditoria UI32 V2 native indisponível.

**História do usuário:** Como LEADER, CIO, diante da situação descrita, preciso salvar filtro e restaurar visão somente com produtor versionado instalado, para não oferecer falsa persistência de visão.

**Por que importa ao negócio:** não oferecer falsa persistência de visão.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- VIEW-EDI-Caio; no snapshot da auditoria UI32 V2 native indisponível.

**Roteiro multiator, passo a passo**
1. Abrir Meu trabalho com filtro de Caio
2. Descobrir capability do producer de Saved Views V2
3. Se instalado, criar view com owner e filtros explícitos
4. Reabrir em segunda sessão e validar persistência
5. Se não instalado, capturar unavailable real
6. Comparar recursos legados sem classificá-los como V2
7. Revogar acesso e tentar reler view antiga
8. Registrar gap por release gate em vez de marcar sucesso

**Oráculos de aceite**
- Matriz tem estado CONDITIONAL e produto observado
- Não há claim de PASS de V2 sem produtor
- Owner controla reabertura e sharing
- View não armazena dados privados fora do escopo

**Contraprovas obrigatórias**
- Rota existente sem codec gera unavailable
- Filtros privados não aparecem em conta diferente

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-030 · O tema Sucafina preserva a arquitetura visual do Orchestra

**Prioridade:** P1 · **Atores:** CIO, LEADER, HR · **Jornadas:** J08 · **IDs UI:** CAP01, UI29, UI47, UI67 · **Condição:** `WHITE_LABEL_RELEASE_FEATURE_UNVERIFIED`

**Situação de negócio.** SF-LAB-2026 · Tema white-label Sucafina proposto, sem redesenhar glass/blur/geometria da arquitetura Orchestra.

**História do usuário:** Como CIO, LEADER, HR, diante da situação descrita, preciso avaliar white-label em loading, navegação, vidro, blur e acessibilidade, para entregar identidade visual premium sem regressão de UX.

**Por que importa ao negócio:** entregar identidade visual premium sem regressão de UX.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Tema white-label Sucafina proposto, sem redesenhar glass/blur/geometria da arquitetura Orchestra.

**Roteiro multiator, passo a passo**
1. Abrir telas com tema padrão da plataforma e capturar baseline visual
2. Ativar tema Sucafina em build que realmente o inclua
3. Conferir wordmark, favicon, loading, naming e motion
4. Testar glass, blur, transparências, shadows e geometria idênticos
5. Executar dark/light, zoom 200, reduced-motion, mobile 320 e desktop 1440
6. Percorrer navegação entre os 15 capítulos e modal
7. Verificar contraste WCAG e foco de teclado sem depender de cor
8. Comparar screenshots e registrar divergências pixel/semânticas

**Oráculos de aceite**
- Identidade Sucafina é coerente sem adulterar componentes funcionais
- Animação respeita prefers-reduced-motion
- Sem degradação de densidade, responsividade ou contraste
- O tema não escreve domínio nem muda RBAC
- Nenhum asset é inventado como “logo oficial” sem aprovação

**Contraprovas obrigatórias**
- Tema ausente no branch: status FEATURE_NOT_INSTALLED, não reprovação falsa do build legado
- Loading deve mostrar estado real e não ocultar erro de autorização

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-031 · Flamengo demonstra fluxo sem inventar autoridade

**Prioridade:** P0 · **Atores:** CIO, LEADER, FINANCE, BUYER, APPROVER · **Jornadas:** J01, J02, J03, J04, J05, J08 · **IDs UI:** CAP01, CAP24, CAP25, CAP26, UI47, UI55 · **Condição:** `PR268_DRAFT_NOT_PROMOTED`

**Situação de negócio.** SF-LAB-2026 · PR #268 em DRAFT: org FLAMENGO sintética com 3 diretorias, 6 departamentos, 12 centros de custo e 10 fornecedores.

**História do usuário:** Como CIO, LEADER, FINANCE, BUYER, APPROVER, diante da situação descrita, preciso executar campanha sintética com atores reais do tenant e efeitos verificáveis, para apresentar uma demo íntegra e reproduzível.

**Por que importa ao negócio:** apresentar uma demo íntegra e reproduzível.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- PR #268 em DRAFT: org FLAMENGO sintética com 3 diretorias, 6 departamentos, 12 centros de custo e 10 fornecedores.

**Roteiro multiator, passo a passo**
1. Selecionar instalação QA isolada para FLA-DEMO-2026
2. Inspecionar dados declarativos no sf/demo/flamengo sem assumir que já foram aplicados
3. Executar seed dry-run e registrar plano de admissões
4. Autorizar `--apply` somente com contas/portas reais e snapshots backup
5. Daniel/André validam contexto admin quando feature integrada
6. Caio faz request, Pedro sourcing, Gabriel aprovação, Sofie Finance
7. Zico sem grupo tenta abrir domínio e recebe negação
8. Auditor compara contagem seeded e IDs antes/depois de segunda aplicação
9. CIO prepara review demonstrativa usando os dados realmente persistidos

**Oráculos de aceite**
- Seed idempotente read-before-create sem INSERT direto
- Cada estado é efeito do produtor, não dados de showcase falsos
- Actor Zico recebe negação no servidor
- Não existem principalRef e sessão inventados pela fixture
- Falha de porto real é BLOCKED, não seed success
- Finance/Procurement e pauta reconciliam com fonte persistida

**Contraprovas obrigatórias**
- Replicar seed em produção é proibido
- Release sem fixture instalada não declara demo concluída

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-032 · CTRM, SAP e Fabric não viram features por aparecer no menu

**Prioridade:** P0 · **Atores:** CIO, FINANCE, BUYER · **Jornadas:** J02, J04, J08 · **IDs UI:** CAP03, CAP14, CAP25, UI45 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Contexto Sucafina inclui CTRM/ERP/SAP/Microsoft Fabric como possíveis sistemas externos, sem conector comprovado.

**História do usuário:** Como CIO, FINANCE, BUYER, diante da situação descrita, preciso distinguir conector real de mock, link e hipótese de integração, para evitar prometer fluxo externo que não foi executado.

**Por que importa ao negócio:** evitar prometer fluxo externo que não foi executado.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Contexto Sucafina inclui CTRM/ERP/SAP/Microsoft Fabric como possíveis sistemas externos, sem conector comprovado.

**Roteiro multiator, passo a passo**
1. Abrir dashboard e identificar fonte interna efetiva
2. QA registra se há conector externo instalado e sua versão
3. Validar leitura de contrato e origem da métrica
4. Simular falha do sistema externo apenas quando integração existir
5. Executar compra interna e ler receipt
6. Verificar se existe comprovante independente de envio ao ERP
7. Abrir BI e inspecionar linha de origem
8. Apresentar resumo ao CIO distinguindo internal e external

**Oráculos de aceite**
- Nenhuma operação interna é rotulada como “transmitida ao SAP” sem recibo externo
- Dashboard não inventa sincronização CTRM
- Origem de BI identifica produtor real
- Integração ausente é GAP/NOT_APPLICABLE documentado, não PASS inventado
- Timeout externo não resulta em transação interna duplicada

**Contraprovas obrigatórias**
- Serviço Fabric indisponível mas cálculo interno disponível: não substituir número com zero
- Callback externo duplicado tem idempotência quando contrato existir

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-033 · O servidor reiniciou, o recibo continua sendo o mesmo

**Prioridade:** P0 · **Atores:** OPS, AUDITOR, CIO · **Jornadas:** J03, J04, J05, J07, J08 · **IDs UI:** UI40, UI57, UI50, UI65, CAP25 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Após import aplicado e PR aprovada, processo e store são reiniciados de forma controlada.

**História do usuário:** Como OPS, AUDITOR, CIO, diante da situação descrita, preciso persistir transações e provar recuperação após restart/rollback, para não duplicar compras, decisões ou importações.

**Por que importa ao negócio:** não duplicar compras, decisões ou importações.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Após import aplicado e PR aprovada, processo e store são reiniciados de forma controlada.

**Roteiro multiator, passo a passo**
1. Capturar source SHA, schema migration e backup com hash
2. Executar import com receipt válido A1
3. Avançar PR32000 uma etapa e capturar receipt B1
4. Preservar review R1 e gerar report C1
5. Reiniciar instalação/VM sob runbook autorizado
6. Reautenticar e consultar A1/B1/R1/C1
7. Repetir apenas leituras, nunca repostar Apply
8. Conferir SQLite/WAL, CAS revisions e audit intactos
9. Simular rollback em ambiente separado e comparar snapshot

**Oráculos de aceite**
- Recibos são duráveis e no mesmo domínio após restart
- Releitura não duplica import/PO
- Review R1 ainda preservada e autorizada
- Rollback de código e dados é controlado e distinto
- Sem perda de audit ou grant durante restore

**Contraprovas obrigatórias**
- Falha no restore tem parada segura e evidência, não abre instância parcialmente válida
- Se SHA do pacote não bate com origem/recibo, NO-GO

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-034 · Todas as telas, papéis e estados: prova transversal de UX

**Prioridade:** P0 · **Atores:** CIO, LEADER, HR, BUYER · **Jornadas:** J08 · **IDs UI:** UI29, UI67, CAP24, UI50, UI66 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · 70 superfícies e 165 variantes de rota da revisão auditada; execução deve escolher atores/grants da política corrente.

**História do usuário:** Como CIO, LEADER, HR, BUYER, diante da situação descrita, preciso percorrer famílias de telas, rotas e estados de acesso usando matriz de risco, para identificar regressões que testes isolados não encontram.

**Por que importa ao negócio:** identificar regressões que testes isolados não encontram.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- 70 superfícies e 165 variantes de rota da revisão auditada; execução deve escolher atores/grants da política corrente.

**Roteiro multiator, passo a passo**
1. QA congela SHA e instala navegador real
2. Para cada superfície, executa story SF-*-P01 e SF-*-N01 correspondente
3. Para cada uma das 165 variantes, tenta entry/new/edit/detail/history dinamicamente com ref válida
4. Tenta ref opaca inválida, URL truncada e prioridade static vs dynamic
5. Repete navegação em 320/768/1440px e zoom 200%
6. Testa foco teclado, ARIA, texto longo, estados vazios/loading/error
7. Valida tema light/dark e redução de movimento quando disponível
8. Reexecuta matriz após revogação e troca de owner
9. Associa evidência a cada row, não a um print genérico

**Oráculos de aceite**
- 70/70 superfícies recebem resultado por ator/feature instalada, sem false PASS
- 165/165 rotas recebem status e evidência na versão final
- Ref dinâmica não dá autorização a recurso
- Teclado, contraste, foco e layout ficam utilizáveis
- Erros e estados não exibem informação antiga após troca de contexto

**Contraprovas obrigatórias**
- Se route reconhecida mas producer indisponível, estado é BLOCKED/UNAVAILABLE
- Um teste falhar em 320px não fica oculto por PASS em 1440px

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-035 · Sessões, contexto e agentes da plataforma Orchestra

**Prioridade:** P1 · **Atores:** CIO, OPS · **Jornadas:** J07, J08 · **IDs UI:** UI64, UI65, UI70 · **Condição:** `PLATFORM_CAPABILITY_DEPENDENT`

**Situação de negócio.** SF-LAB-2026 · Orchestra host integra sessões, agentes, skills, ferramentas, Maestro, Relay/MCP e estado de execução nativo, quando instalado.

**História do usuário:** Como CIO, OPS, diante da situação descrita, preciso inspecionar orquestração e permissões de sessão, skill, MCP e Relay, para preservar limites entre plataforma e produto de negócio.

**Por que importa ao negócio:** preservar limites entre plataforma e produto de negócio.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Orchestra host integra sessões, agentes, skills, ferramentas, Maestro, Relay/MCP e estado de execução nativo, quando instalado.

**Roteiro multiator, passo a passo**
1. Criar projeto/worktree isolado com duas sessões simultâneas
2. Selecionar provider/model com orçamento explícito
3. Admitir agente nativo com skill digest e permissões permitidas
4. Abrir output e verificar que host executou SessionV2/AgentV2/SkillV2 real
5. Desabilitar uma tool, testar deny e capturar provenance
6. Cancelar o run em estado admitido e conferir transição real
7. Abrir Relay/MCP somente se conexão está habilitada e testar contexto isolado
8. Inspecionar conteúdo ao trocar worktree e usuário
9. Comparar resultados com logs e event ordering

**Oráculos de aceite**
- Agente mostra run real, não mock visual
- Nenhuma tool fora da grant consegue escrita
- Contexto de worktree não vaza entre sessões
- Cancelamento tem state coerente, sem completed fantasma
- Provider indisponível falha fechado e preserva output anterior somente identificado como histórico

**Contraprovas obrigatórias**
- Trocar skill enquanto agente running exige digests fixos
- Relay não executa ação em outra sessão sem autorização

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-036 · A URL não pode conceder acesso ao registro

**Prioridade:** P0 · **Atores:** CIO, AUDITOR · **Jornadas:** J08 · **IDs UI:** CAP24, UI31, UI40, UI57 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Matriz de 165 routes com 21 padrões sintaticamente sobrepostos e refs r_base64url canônicos.

**História do usuário:** Como CIO, AUDITOR, diante da situação descrita, preciso testar referências opacas, padrões de rotas e manipulação de IDs, para impedir acesso por guessing ou colisões de roteamento.

**Por que importa ao negócio:** impedir acesso por guessing ou colisões de roteamento.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Matriz de 165 routes com 21 padrões sintaticamente sobrepostos e refs r_base64url canônicos.

**Roteiro multiator, passo a passo**
1. Selecionar rota estática /new e rota dinâmica /:ref do mesmo capítulo
2. Abrir URL com ref canônica e autorizada
3. Abrir URL com `r_` truncado ou base64url não canônico
4. Abrir URL com ref válida de outro owner
5. Testar encoding de barra e dot segments
6. Testar parameter pollution e percent encoding inválido
7. Repetir sem sessão e com revogação no meio
8. Conferir router static precedence e resposta de host

**Oráculos de aceite**
- Static routes resolvem antes de dynamic sem ambiguidade
- Ref válida continua exigindo autenticação/autorização
- Ref inválida não aciona recurso ou leaked path
- No redirect unsafe para domínio externo
- Erros não mostram nomes de fontes privadas

**Contraprovas obrigatórias**
- Ref de outro tenant nunca é aceito por coincidence de ID
- Rota 404 e rota 403 não podem vazar conteúdo no corpo

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-037 · O pedido foi rejeitado e precisa voltar à fila certa

**Prioridade:** P0 · **Atores:** REQUESTER, APPROVER, BUYER · **Jornadas:** J04 · **IDs UI:** CAP24, CAP25, CAP26, CAP28 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · PR32000 sofre rejeição no estágio PR; após correção segue sourcing, rejeição SRC e reenvio.

**História do usuário:** Como REQUESTER, APPROVER, BUYER, diante da situação descrita, preciso fazer a mesma compra percorrer rejeição, correção e nova submissão, para garantir histórico e segregação nas três etapas.

**Por que importa ao negócio:** garantir histórico e segregação nas três etapas.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- PR32000 sofre rejeição no estágio PR; após correção segue sourcing, rejeição SRC e reenvio.

**Roteiro multiator, passo a passo**
1. Caio cria PR draft 32000
2. Gabriel rejeita PR com motivo verificável
3. Caio reabre e reenvia a mesma requisição com versão nova
4. Gabriel aprova PR na nova revisão
5. Pedro cria sourcing e submete para holder SRC
6. Holder de SRC rejeita quote incompleta
7. Pedro substitui quote e reenvia SRC
8. Após aprovação válida, cria PO draft e pede aprovação
9. Auditor inspeciona histórico de todos os estágios e receipts

**Oráculos de aceite**
- Estados pr_rejected/src_rejected são distintos de draft
- Ressubmissão incrementa versão e mantém histórico de rejeição
- Holder de cada etapa é reavaliado, não copiado do estágio anterior
- Nenhum `po_issued` antes de `po_approved`
- Sem self approval implícita
- No máximo uma transição por attempt admitido

**Contraprovas obrigatórias**
- Cancelar pedido em estágio não permitido: recusa sem commit
- Rejeição sem motivo obrigatório, se contrato exigir: 422

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-038 · Fechamento financeiro: hipótese não edita versão oficial

**Prioridade:** P0 · **Atores:** FINANCE, BUDGET_OWNER, CIO · **Jornadas:** J02, J08 · **IDs UI:** CAP03, CAP18, CAP19, CAP22, CAP23 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Actual setembro fechado, forecast outubro aberto e versão annual locked.

**História do usuário:** Como FINANCE, BUDGET_OWNER, CIO, diante da situação descrita, preciso tentar reabrir actual fechado e editar versão locked por diferentes perfis, para preservar integridade do fechamento contábil.

**Por que importa ao negócio:** preservar integridade do fechamento contábil.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Actual setembro fechado, forecast outubro aberto e versão annual locked.

**Roteiro multiator, passo a passo**
1. Sofie abre versão annual e confirma setembro closed
2. Budget Owner cria cenário para outubro sem editar actual
3. Inspeciona import XLSX que afeta somente outubro
4. CIO revisa impacto anual com rótulo partial/total
5. QA tenta editar setembro closed por UI e API
6. Simula entrada de zero legítimo em outubro
7. Simula cell missing e compara ao zero
8. QA verifica audit e versão official

**Oráculos de aceite**
- Mês fechado não aceita alterações sem política explícita
- Zero legítimo não vira missing
- Partialidades mudam o estado de confiança do KPI
- Official e actual não mudam por import de cenário
- Toda abertura/fechamento exigiria comando e actor autorizado

**Contraprovas obrigatórias**
- Impor data/FX cruzados sem conversão: indeterminado
- Tentar forçar commit por deep link stale: falha

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-039 · 403, 422 e 503 têm significados diferentes

**Prioridade:** P0 · **Atores:** AUDITOR, LEADER, FINANCE · **Jornadas:** J03, J04, J08 · **IDs UI:** UI67, UI55, UI57, CAP25 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Probe histórico mostrou 403/422/503 em jornadas autorizadas; negar a pessoa errada é esperado, negar autorizado pode ser defeito.

**História do usuário:** Como AUDITOR, LEADER, FINANCE, diante da situação descrita, preciso reproduzir falhas de autorização, validação e backend sem mascarar causas, para abrir defeito correto e impedir falso PASS.

**Por que importa ao negócio:** abrir defeito correto e impedir falso PASS.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Probe histórico mostrou 403/422/503 em jornadas autorizadas; negar a pessoa errada é esperado, negar autorizado pode ser defeito.

**Roteiro multiator, passo a passo**
1. Congelar SHA e fixture para reprodução
2. Executar mesmo endpoint de import com Finance e com Zico
3. Capturar 200/403/422 reais e discriminar causas
4. Reproduzir JSON/headers/MIME, origem, principal, resource tenant e revision
5. Testar Procurement supplier/host 503 isolado
6. Conferir cada corpo e logs sem segredos
7. Corrigir pré-condição de teste somente quando era falsa
8. Reexecutar e associar run IDs a cada QA case

**Oráculos de aceite**
- 403 de Zico é prova de negação se a fonte não mudou
- 403 de Finance autorizado bloqueia jornada e deve ser investigado
- 422 significa validação, não sucesso
- 503 de producer impede homologar decisão
- Never weaken assertions, skip ou mock para obter verde

**Contraprovas obrigatórias**
- Um teste que não rodou por early bail permanece NOT_RUN
- Artefato verde de package não significa workflow funcional verde

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-040 · A promoção exige produto, identidade e governança

**Prioridade:** P0 · **Atores:** CIO, AUDITOR, OPS · **Jornadas:** J08 · **IDs UI:** CAP01, UI67, CAP24 · **Condição:** `RELEASE_POLICY_OWNER_APPROVAL`

**Situação de negócio.** SF-LAB-2026 · Release novo exige admin supreme, identidade Entra, demo Flamengo e o tema visual apenas se aprovado pelo owner.

**História do usuário:** Como CIO, AUDITOR, OPS, diante da situação descrita, preciso cruzar release candidate, admin, white-label, dados e tenant com evidência única, para assinar um go-live com rastreabilidade de ponta a ponta.

**Por que importa ao negócio:** assinar um go-live com rastreabilidade de ponta a ponta.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Release novo exige admin supreme, identidade Entra, demo Flamengo e o tema visual apenas se aprovado pelo owner.

**Roteiro multiator, passo a passo**
1. Congelar commit C, tree e pacote extraído fora checkout
2. Checar 12 jobs de sf-ci no mesmo SHA e 8 recibos de release
3. Validar Entra com atores permitidos e negados
4. Validar 70 superfícies + novo admin fora do manifesto
5. Executar stories FLA demo sobre instância realmente isolada
6. Executar smoke white label condicionado a inclusão real do tema
7. Verificar backup, restore e rollback com evidência
8. CIO assina GO/NO-GO com exceções e riscos explícitos

**Oráculos de aceite**
- Todos P0 obrigatórios têm provas E vinculadas a SHA/ator/dado
- Admin e identidade negam os atores não supreme
- Demo não é confundida com dado de produção
- Factory package não substitui sf-ci
- Sem evidência em um gate é NO-GO, não “quase verde”

**Contraprovas obrigatórias**
- Branch mudou SHA após CI: revalidar C inteiro
- Falta de consent Graph live significa não homologado

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-041 · Instalação vazia não inventa dashboard completo

**Prioridade:** P1 · **Atores:** CIO, LEADER · **Jornadas:** J01, J08 · **IDs UI:** UI29, CAP01, CAP24, UI45 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Instalação nova sem import/seed de produto, mas login e capítulos disponíveis.

**História do usuário:** Como CIO, LEADER, diante da situação descrita, preciso abrir todas as superfícies relevantes sem dados provisionados, para distinguir vazio verdadeiro de erro de serviço.

**Por que importa ao negócio:** distinguir vazio verdadeiro de erro de serviço.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Instalação nova sem import/seed de produto, mas login e capítulos disponíveis.

**Roteiro multiator, passo a passo**
1. Criar instalação QA vazia autorizada
2. Fazer login real e abrir Hoje, Dashboard, Procurement e BI
3. Inspecionar mensagens sem dados e sem permissões
4. Tentar buscar termo não existente
5. Tentar abrir link com referência antiga de outra instalação
6. Verificar menu e criação de primeira versão
7. Adicionar um dado real por produtor autorizado
8. Reabrir dashboard e verificar transição empty→data

**Oráculos de aceite**
- Sem registros retorna vazio honesto, nunca 500 ou dados de outro tenant
- Ausência de dados difere de 0 válido
- CAP24 vazio não inventa aging/contagem
- Após a primeira gravação, dados aparecem sem reconstrução manual
- Nenhuma referência obsoleta concede acesso

**Contraprovas obrigatórias**
- Permissão negada não pode ser mostrada como “sem dados” enganoso
- Na ausência de provider/codec, capability unavailable explícito

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-042 · O produto continua operável para teclado, zoom e idiomas

**Prioridade:** P1 · **Atores:** CIO, HR, LEADER · **Jornadas:** J08 · **IDs UI:** CAP01, UI29, UI31, UI47 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Usuários executivos em monitores grandes, notebook e mobile; idioma pode variar, dark/light.

**História do usuário:** Como CIO, HR, LEADER, diante da situação descrita, preciso executar interações críticas com zoom, teclado, contraste e textos longos, para servir colaboradores em ambientes e necessidades diversas.

**Por que importa ao negócio:** servir colaboradores em ambientes e necessidades diversas.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Usuários executivos em monitores grandes, notebook e mobile; idioma pode variar, dark/light.

**Roteiro multiator, passo a passo**
1. Abrir menu lateral e botões principais só com teclado
2. Tab, Shift+Tab, Enter e Esc em diálogos
3. Inspecionar foco após salvar/cancelar
4. Aplicar zoom 200 e viewport320,768,1440
5. Testar reduced-motion no loading do tema
6. Colar texto com acentos, emoji e linha longa em nota
7. Testar locale pt/en e fuso quando suportados
8. Conferir contraste em estados de erro, desabilitado e sucesso

**Oráculos de aceite**
- Sem teclado preso em modal
- Ações têm nome acessível e foco determinístico
- Form inválido preserva dados e aponta campo
- Tema não causa overflow do documento ou perda de legenda
- Traduções não mudam chaves de negócio/IDs
- Reduzir movimento elimina animação não essencial

**Contraprovas obrigatórias**
- Acento no nome não altera ID nem autorização
- Zoom 400% evidencia reflow quando obrigatório pelo produto

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-043 · A rede caiu no momento do Apply

**Prioridade:** P0 · **Atores:** CIO, FINANCE, BUYER · **Jornadas:** J01, J03, J04 · **IDs UI:** CAP18, CAP25, UI57 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Conexão da filial perde 10s enquanto alteração CAS é enviada e comprovante de negócio pode ou não existir.

**História do usuário:** Como CIO, FINANCE, BUYER, diante da situação descrita, preciso injetar queda de conectividade antes e depois do commit, para não executar uma segunda operação por engano.

**Por que importa ao negócio:** não executar uma segunda operação por engano.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Conexão da filial perde 10s enquanto alteração CAS é enviada e comprovante de negócio pode ou não existir.

**Roteiro multiator, passo a passo**
1. Registrar before snapshot da versão OPEX e PR
2. Enviar save de OPEX e interromper entrega da resposta
3. Não presumir commit nem fazer retry automático
4. Recuperar via leitura do registro/attempt quando protocolo permitir
5. Se não houve commit, permitir reenvio explícito com nova autorização
6. Repetir com Apply de import em que o commit ocorreu
7. Repetir com submissão de PR em que o commit não ocorreu
8. Auditor registra contagem de recibos e estados finais

**Oráculos de aceite**
- Nenhuma duplicidade para operações já persistidas
- UI distingue resposta perdida de transação negada
- Draft do usuário é preservado quando negócio não mudou
- O retry é idempotente quando contrato exige
- Ator atual e policy são revalidados na recuperação

**Contraprovas obrigatórias**
- Retry cego que produz duas PO/importações é P0
- Exibir success antes de ler receipt é defeito

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-044 · A reunião do CIO sob carga e múltiplas consultas

**Prioridade:** P1 · **Atores:** CIO, FINANCE, OPS · **Jornadas:** J02, J05, J08 · **IDs UI:** CAP01, CAP09, UI45, UI48, UI50 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Dataset 25 projetos, notas longas, 200 usuários Graph fixture e 10 jobs; nenhum SLA inventado.

**História do usuário:** Como CIO, FINANCE, OPS, diante da situação descrita, preciso simular acesso concorrente a dados, agendas e relatórios volumosos, para manter respostas íntegras e estados honestos sob pressão.

**Por que importa ao negócio:** manter respostas íntegras e estados honestos sob pressão.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Dataset 25 projetos, notas longas, 200 usuários Graph fixture e 10 jobs; nenhum SLA inventado.

**Roteiro multiator, passo a passo**
1. Congelar ambiente, hardware e profile de browser
2. Carregar 25 projetos e 10 documentos sintéticos
3. Abrir Executive, Portfolio, BI e presentation sequencialmente
4. Executar várias sessões de leitura simultânea sob contas permitidas
5. Registrar p50/p95 de carregamento e erros
6. Testar paginação Graph de 200 usuários somente no admin instalado
7. Gerar dois exports e inspecionar filas de jobs
8. Verificar que timeout mostra falha honesta e sem efeito duplicado

**Oráculos de aceite**
- Métrica de tempo possui hardware, quantidade de registros, SHA e limites acordados pelo owner
- Nenhuma leitura faz commit ou expõe dados de outro papel
- Falha de job não trava as demais superfícies indefinidamente
- Threshold de aceite é definido antes de executar e não ajustado após resultado

**Contraprovas obrigatórias**
- Sem definição de SLA, reportar medidas e risco, nunca PASS de performance sem limite
- Redução artificial de dados para ficar verde invalida teste

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`


## SF-E2E-045 · Auditoria consegue reconstruir a história de uma decisão

**Prioridade:** P0 · **Atores:** AUDITOR, CIO, HR · **Jornadas:** J05, J08 · **IDs UI:** UI40, UI48, UI57, UI68 · **Condição:** `BASELINE`

**Situação de negócio.** SF-LAB-2026 · Audit do workbench inclui actor, before, after e UTC; export pode conter informação corporativa restrita.

**História do usuário:** Como AUDITOR, CIO, HR, diante da situação descrita, preciso revisar atores, evidências, horários, mudanças, recibos e retenção, para permitir responsabilização e revisão independente.

**Por que importa ao negócio:** permitir responsabilização e revisão independente.

**Pré-condições**
- QA isolado, seed determinístico e snapshot BEFORE de todos os registros envolvidos; consumidores reais disponíveis ou status BLOCKED.
- Todos os atores autenticados como suas contas reais de teste, com grants válidos e versões de policy registradas.
- Audit do workbench inclui actor, before, after e UTC; export pode conter informação corporativa restrita.

**Roteiro multiator, passo a passo**
1. Identificar conjunto mínimo de campos de auditoria por operação
2. Capturar PR/import/grant com consent e contexto fictícios
3. Executar mutação admitida e observar audit atômico
4. Testar ação negada e verificar ausência de log falso de sucesso
5. Exercer consulta pelo auditor com grant próprio
6. Revogar acesso a pessoa e retestar download de export
7. Inspecionar a política de retenção assinada pelo owner
8. Testar backup/restore de audit e consistência dos recibos

**Oráculos de aceite**
- Audit preserva ator técnico e hora de forma confiável
- Acesso a audit é controlado e não vira painel público
- Dados pessoais/financeiros são minimizados conforme política acordada
- Retenção não pode ser presumida se não aprovada
- Quem assina GO/NO-GO tem evidência das negativas

**Contraprovas obrigatórias**
- Editar audit retroativamente ou removê-lo no rollback sem trilha é P0
- Auditor sem grant não pode ler audit por deep link

**Evidências:** screenshot_or_video_timeline, before_after_source_snapshot, sanitized_HTTP_statuses, receipt_or_no_commit_proof, actor_tenant_policy_snapshot, artifact_sha256. **Estado:** `DESIGNED_NOT_EXECUTED`

