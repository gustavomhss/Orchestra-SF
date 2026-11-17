# Orchestra-SF · Histórias de homologação por superfície

**Status:** DESIGN DE TESTE, não execução. **Base usada para abrir o branch QA:** `a1e774ec9e1fc28c81e0b42a1889c0425060aed9`; inventário original revisado: `42d344a0efc4d85187388f149c54acac2db171da`. O baseline deve ser recongelado na execução.

**Roteiro:** um caso principal e uma contraprova própria para cada uma das **70 superfícies** originais. Cada caso inclui ator, objetivo, contexto sintético, passos e critérios observáveis. Uma tela registrada não implica producer instalado.

**Importante:** este documento acompanha, mas não substitui, as histórias multiator de ponta a ponta nem a matriz de 165 rotas. Cada cenário começa `DESIGNED_NOT_EXECUTED`.


## SF-CAP01-P01 · CAP01: Preparar o briefing executivo sem tomar decisões na leitura

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J01, J05 · **Superfície:** CAP01 · **Rota:** `/orchestra/sf-dashboard/executive` · **Teste-fonte:** u02

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero preparar o briefing executivo sem tomar decisões na leitura para tomar a próxima ação com prova e governança.

**Dados e contexto:** BRF-CIO-01 · setembro/2026 · forecast USD 590.000 · risco R-07

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: BRF-CIO-01 · setembro/2026 · forecast USD 590.000 · risco R-07. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Selecionar competência setembro/2026 e tenant SF-LAB
3. Abrir Executive Dashboard e identificar três prioridades com origem explícita
4. Entrar no detalhe da prioridade EDI de embarques e retornar mantendo filtros
5. Preparar pauta contendo orçamento, risco e decisão de procurement, sem aplicar operações
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Prioridade EDI aparece com fonte e data de atualização
- Forecast mostra USD 590.000 e distingue de budget USD 600.000
- Pauta referencia IDs e revisões originais, sem efeito no orçamento
- Navegação de volta preserva competência e owner
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP01-N01 · CAP01: contraprova — Nega-se acesso a uma revisão histórica da carteira após revogar a permissão do CIO durante a sessão

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J01, J05 · **Superfície:** CAP01 · **Rota:** `/orchestra/sf-dashboard/executive` · **Teste-fonte:** u02

> Como QA adversarial, quero desafiar Dashboard: Executive Dashboard no contexto BRF-CIO-01 · setembro/2026 · forecast USD 590.000 · risco R-07 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** BRF-CIO-01 · setembro/2026 · forecast USD 590.000 · risco R-07

**Dado que**
- Story SF-CAP01-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Nega-se acesso a uma revisão histórica da carteira após revogar a permissão do CIO durante a sessão
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Nenhum cartão protegido, detalhe, export ou cache revela a revisão revogada
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP02-P01 · CAP02: Registrar e conduzir um assunto crítico que atravessa áreas

**Prioridade:** P1 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J01, J05 · **Superfície:** CAP02 · **Rota:** `/orchestra/sf-dashboard/hot-topics` · **Teste-fonte:** u38

> Como Caio, líder/contribuidor de TI, quero registrar e conduzir um assunto crítico que atravessa áreas para tomar a próxima ação com prova e governança.

**Dados e contexto:** HOT-EDI-07 · atraso fictício 6 dias · responsável LEADER-Caio

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: HOT-EDI-07 · atraso fictício 6 dias · responsável LEADER-Caio. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Hot Topics e localizar HOT-EDI-07
3. Criar tópico “Integração EDI Porto Santos” com prazo e owner de domínio
4. Anexar projeto P-004 e nota M-002 usando referências selecionadas
5. Encaminhar para revisão de Finance e verificar fila do responsável
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Tópico tem identificador estável e uma única entrada
- Referências são IDs distintos e corretos, não títulos homônimos
- O encaminhamento aparece em Meu trabalho apenas para o autorizado
- Abrir o tópico não produz aprovação financeira
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP02-N01 · CAP02: contraprova — Dois tópicos de mesmo título e owners distintos; encaminhar usando apenas o título

**Prioridade:** P1 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J01, J05 · **Superfície:** CAP02 · **Rota:** `/orchestra/sf-dashboard/hot-topics` · **Teste-fonte:** u38

> Como QA adversarial, quero desafiar Dashboard: Hot Topics & Actions no contexto HOT-EDI-07 · atraso fictício 6 dias · responsável LEADER-Caio para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** HOT-EDI-07 · atraso fictício 6 dias · responsável LEADER-Caio

**Dado que**
- Story SF-CAP02-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Dois tópicos de mesmo título e owners distintos; encaminhar usando apenas o título
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Aplicação exige referência opaca canônica e não associa o tópico errado
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP03-P01 · CAP03: Entender orçamento aprovado, consumido e projeção de fim de ano

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J01, J05 · **Superfície:** CAP03 · **Rota:** `/orchestra/sf-dashboard/budget` · **Teste-fonte:** u02, u39, u40

> Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero entender orçamento aprovado, consumido e projeção de fim de ano para tomar a próxima ação com prova e governança.

**Dados e contexto:** BUD-2026-IT · budget 600000 · actual Jan–Set 400000 · open 190000 USD

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: BUD-2026-IT · budget 600000 · actual Jan–Set 400000 · open 190000 USD. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Selecionar versão oficial V-2026-OFFICIAL e período anual
3. Abrir Budget Overview e inspecionar budget, actual, forecast e variações
4. Entrar em OPEX e CAPEX conferindo composição e moeda
5. Retornar e comparar com hipótese V-2026-WHATIF-A
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- 600000/400000/590000 USD rotulados por medida e período
- Desvio base vs budget é -10000 USD
- Hipótese A 602000 USD não altera versão oficial
- Null, zero e período incompleto recebem tratamento distinto
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP03-N01 · CAP03: contraprova — Remover FX de EUR e abrir indicador consolidado com linha em EUR

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J01, J05 · **Superfície:** CAP03 · **Rota:** `/orchestra/sf-dashboard/budget` · **Teste-fonte:** u02, u39, u40

> Como QA adversarial, quero desafiar Dashboard: Budget Overview no contexto BUD-2026-IT · budget 600000 · actual Jan–Set 400000 · open 190000 USD para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** BUD-2026-IT · budget 600000 · actual Jan–Set 400000 · open 190000 USD

**Dado que**
- Story SF-CAP03-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Remover FX de EUR e abrir indicador consolidado com linha em EUR
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Indicador incompatível fica indeterminado/partial; não vira zero nem aplica conversão implícita
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP04-P01 · CAP04: Corrigir uma linha OPEX com rastreio de versão

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J01, J05 · **Superfície:** CAP04 · **Rota:** `/orchestra/sf-dashboard/opex` · **Teste-fonte:** u39, u40

> Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero corrigir uma linha OPEX com rastreio de versão para tomar a próxima ação com prova e governança.

**Dados e contexto:** OPEX-LIC-01 · USD 72000 → 84000 · centro de custo IT-OPS

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: OPEX-LIC-01 · USD 72000 → 84000 · centro de custo IT-OPS. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir OPEX Detail na hipótese V-2026-WHATIF-A
3. Criar/editar linha OPEX-LIC-01 com justificativa “renovação SaaS”
4. Salvar com revisão observada e voltar à lista
5. Reabrir e comparar impacto anual e mensal
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Nova hipótese aumenta outlook 590000→602000 USD, delta +12000
- Justificativa e ator persistem na trilha
- Actual Jan–Set permanece 400000 e versão official intacta
- Lista mantém filtro/competência após retorno
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP04-N01 · CAP04: contraprova — FINANCE-B edita mesma linha no intervalo e FINANCE-A salva revisão velha

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J01, J05 · **Superfície:** CAP04 · **Rota:** `/orchestra/sf-dashboard/opex` · **Teste-fonte:** u39, u40

> Como QA adversarial, quero desafiar Dashboard: OPEX Detail no contexto OPEX-LIC-01 · USD 72000 → 84000 · centro de custo IT-OPS para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** OPEX-LIC-01 · USD 72000 → 84000 · centro de custo IT-OPS

**Dado que**
- Story SF-CAP04-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. FINANCE-B edita mesma linha no intervalo e FINANCE-A salva revisão velha
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Conflito CAS é visível, edição local é preservada e nada é sobrescrito
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP05-P01 · CAP05: Avaliar CAPEX de infraestrutura com approval de mudança explícito

**Prioridade:** P0 · **Ator:** Budget Owner sintético BO-01 · **Jornadas:** J01, J05 · **Superfície:** CAP05 · **Rota:** `/orchestra/sf-dashboard/capex` · **Teste-fonte:** u39, u40

> Como Budget Owner sintético BO-01, quero avaliar CAPEX de infraestrutura com approval de mudança explícito para tomar a próxima ação com prova e governança.

**Dados e contexto:** CAPEX-SCANNER-01 · USD 91827 · 2027 · Projeto P-009

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: CAPEX-SCANNER-01 · USD 91827 · 2027 · Projeto P-009. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir CAPEX Projects e selecionar P-009
3. Registrar CAPEX-SCANNER-01 com 91827 USD, janela 2027 e responsável
4. Inspecionar detalhe e vínculo com portfolio
5. Voltar e verificar total apenas no cenário editável
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- CAPEX identifica moeda e calendário independentes de OPEX
- Relação P-009 é exata e visível no detalhe
- Projeto não ingressa em versão official sem governança
- Registros preservam histórico e owner
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP05-N01 · CAP05: contraprova — Tentar editar CAPEX na versão official/locked com role de leitura

**Prioridade:** P0 · **Ator:** Budget Owner sintético BO-01 · **Jornadas:** J01, J05 · **Superfície:** CAP05 · **Rota:** `/orchestra/sf-dashboard/capex` · **Teste-fonte:** u39, u40

> Como QA adversarial, quero desafiar Dashboard: CAPEX Projects no contexto CAPEX-SCANNER-01 · USD 91827 · 2027 · Projeto P-009 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** CAPEX-SCANNER-01 · USD 91827 · 2027 · Projeto P-009

**Dado que**
- Story SF-CAP05-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Tentar editar CAPEX na versão official/locked com role de leitura
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- UI e produtor recusam operação; nenhuma mudança no total publicado
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP06-P01 · CAP06: Entender gap de headcount e a proveniência do dado

**Prioridade:** P1 · **Ator:** HR sintética HR-01 · **Jornadas:** J02, J08 · **Superfície:** CAP06 · **Rota:** `/orchestra/sf-people/overview` · **Teste-fonte:** u03

> Como HR sintética HR-01, quero entender gap de headcount e a proveniência do dado para tomar a próxima ação com prova e governança.

**Dados e contexto:** HC-SEP-26 · 42 FTE plan · 40 ocupados · 2 vagas

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: HC-SEP-26 · 42 FTE plan · 40 ocupados · 2 vagas. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Headcount Overview e selecionar setembro/2026
3. Distinguir posição aprovada de pessoa atual
4. Inspecionar variância por departamento e custo
5. Abrir Team Structure e retornar
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- 42/40/2 reconciliam sem contar contractor duas vezes
- Dados sensíveis aparecem conforme grant de HR
- Competência e unidade FTE ficam visíveis
- Navegação não modifica roster
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP06-N01 · CAP06: contraprova — Viewer sem escopo salarial tenta drilldown de custo nominativo

**Prioridade:** P1 · **Ator:** HR sintética HR-01 · **Jornadas:** J02, J08 · **Superfície:** CAP06 · **Rota:** `/orchestra/sf-people/overview` · **Teste-fonte:** u03

> Como QA adversarial, quero desafiar Dashboard: Headcount Overview no contexto HC-SEP-26 · 42 FTE plan · 40 ocupados · 2 vagas para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** HC-SEP-26 · 42 FTE plan · 40 ocupados · 2 vagas

**Dado que**
- Story SF-CAP06-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Viewer sem escopo salarial tenta drilldown de custo nominativo
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Valor e export sensíveis ficam redigidos ou acesso negado inclusive via URL direta
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP07-P01 · CAP07: Manter o quadro de pessoas sem confundir organograma com autorização Entra

**Prioridade:** P0 · **Ator:** HR sintética HR-01 · **Jornadas:** J02, J08 · **Superfície:** CAP07 · **Rota:** `/orchestra/sf-people/structure` · **Teste-fonte:** u03

> Como HR sintética HR-01, quero manter o quadro de pessoas sem confundir organograma com autorização Entra para tomar a próxima ação com prova e governança.

**Dados e contexto:** EMP-SYN-014 · Gestão TI · líder ID P-001 · 1 FTE

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: EMP-SYN-014 · Gestão TI · líder ID P-001 · 1 FTE. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Team Structure e registrar membro sintético EMP-SYN-014
3. Associar a líder por referência imutável e centro de custo
4. Alterar cargo fictício e navegar pelo organograma
5. Comparar quadro do produto com diretório Microsoft sem inferir equivalência
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- A estrutura reflete 1 FTE e vínculo correto
- Mudança de cargo não concede role de segurança
- Identidade do produto não é confundida com nome ou email do Entra
- Ações deixam rastro de origem e revisão
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP07-N01 · CAP07: contraprova — Ciclo de chefia A→B→A e pessoa com nome homônimo são introduzidos em fixture

**Prioridade:** P0 · **Ator:** HR sintética HR-01 · **Jornadas:** J02, J08 · **Superfície:** CAP07 · **Rota:** `/orchestra/sf-people/structure` · **Teste-fonte:** u03

> Como QA adversarial, quero desafiar Dashboard: Team Structure no contexto EMP-SYN-014 · Gestão TI · líder ID P-001 · 1 FTE para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** EMP-SYN-014 · Gestão TI · líder ID P-001 · 1 FTE

**Dado que**
- Story SF-CAP07-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Ciclo de chefia A→B→A e pessoa com nome homônimo são introduzidos em fixture
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Organograma evita loop, sinaliza inconsistência e não funde perfis
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP08-P01 · CAP08: Conduzir review de talentos mantendo confidencialidade

**Prioridade:** P0 · **Ator:** HR sintética HR-01 · **Jornadas:** J02, J08 · **Superfície:** CAP08 · **Rota:** `/orchestra/sf-people/talent` · **Teste-fonte:** u47

> Como HR sintética HR-01, quero conduzir review de talentos mantendo confidencialidade para tomar a próxima ação com prova e governança.

**Dados e contexto:** TAL-014 · rating fictício 3/5 · ciclo 2026-H2

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: TAL-014 · rating fictício 3/5 · ciclo 2026-H2. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Selecionar Talent Review do ciclo H2
3. Editar avaliação do membro sintético TAL-014 sob grant de HR
4. Salvar justificativa com revisão e conferir histórico
5. Exportar somente quando entitlement de RH for válido
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Rating 3/5 e ciclo persistem com ator e versão
- Dados pessoais seguem políticas de redação e exportação
- Leitores não autorizados não recebem arquivo antigo
- Review não concede mudança no quadro de aprovações
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP08-N01 · CAP08: contraprova — Revogar grant de RH após criar export e tentar baixar link anterior

**Prioridade:** P0 · **Ator:** HR sintética HR-01 · **Jornadas:** J02, J08 · **Superfície:** CAP08 · **Rota:** `/orchestra/sf-people/talent` · **Teste-fonte:** u47

> Como QA adversarial, quero desafiar Dashboard: Talent Review no contexto TAL-014 · rating fictício 3/5 · ciclo 2026-H2 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** TAL-014 · rating fictício 3/5 · ciclo 2026-H2

**Dado que**
- Story SF-CAP08-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Revogar grant de RH após criar export e tentar baixar link anterior
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Download revalida acesso e nega sem vazar conteúdo
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP09-P01 · CAP09: Monitorar portfólio com projetos em diferentes estágios

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J02, J08 · **Superfície:** CAP09 · **Rota:** `/orchestra/sf-portfolio/overview` · **Teste-fonte:** u05

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero monitorar portfólio com projetos em diferentes estágios para tomar a próxima ação com prova e governança.

**Dados e contexto:** PORT-2026 · 25 projetos sintéticos · P-004 crítico · P-009 CAPEX

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: PORT-2026 · 25 projetos sintéticos · P-004 crítico · P-009 CAPEX. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Portfolio Dashboard com filtro global
3. Inspecionar distribuição por estado e orçamento dos 25 projetos
4. Entrar no risco do P-004 e voltar ao dashboard
5. Criar pauta executiva com projetos críticos
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Cada projeto aparece uma vez na contagem
- Total por estado reconcilia com 25 referências
- Mudanças financeiras em Planner não são inventadas no portfolio
- Filtro e owner persistem no retorno
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP09-N01 · CAP09: contraprova — Dois projetos têm nomes iguais, IDs P-004/P-023

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J02, J08 · **Superfície:** CAP09 · **Rota:** `/orchestra/sf-portfolio/overview` · **Teste-fonte:** u05

> Como QA adversarial, quero desafiar Dashboard: Portfolio Dashboard no contexto PORT-2026 · 25 projetos sintéticos · P-004 crítico · P-009 CAPEX para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** PORT-2026 · 25 projetos sintéticos · P-004 crítico · P-009 CAPEX

**Dado que**
- Story SF-CAP09-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Dois projetos têm nomes iguais, IDs P-004/P-023
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Drilldown utiliza ID e não funde orçamento, risco ou owner
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP10-P01 · CAP10: Gerenciar execução de projeto e milestones verificáveis

**Prioridade:** P1 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J02, J08 · **Superfície:** CAP10 · **Rota:** `/orchestra/sf-portfolio/projects` · **Teste-fonte:** u05

> Como Caio, líder/contribuidor de TI, quero gerenciar execução de projeto e milestones verificáveis para tomar a próxima ação com prova e governança.

**Dados e contexto:** P-004 · EDI Logistics · milestone MS-04 due 2026-12-15

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: P-004 · EDI Logistics · milestone MS-04 due 2026-12-15. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Criar projeto P-004 ou abrir o seed existente
3. Registrar milestone MS-04 e responsável funcional
4. Alterar status com nota explicando dependência de fornecedor
5. Voltar ao portfolio e abrir histórico
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Milestone aparece sob P-004, com prazo e dono corretos
- Alteração é visível em listagem e trilha
- Risco R-07 permanece referenciado
- Sem duplicação de milestone ao repetir leitura
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP10-N01 · CAP10: contraprova — Enviar duas vezes a criação do mesmo milestone após perder resposta de rede

**Prioridade:** P1 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J02, J08 · **Superfície:** CAP10 · **Rota:** `/orchestra/sf-portfolio/projects` · **Teste-fonte:** u05

> Como QA adversarial, quero desafiar Dashboard: All Projects no contexto P-004 · EDI Logistics · milestone MS-04 due 2026-12-15 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** P-004 · EDI Logistics · milestone MS-04 due 2026-12-15

**Dado que**
- Story SF-CAP10-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Enviar duas vezes a criação do mesmo milestone após perder resposta de rede
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Retry recupera recibo/registro original e não duplica MS-04
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP11-P01 · CAP11: Atualizar operação de TI com métricas e tempo coerentes

**Prioridade:** P1 · **Ator:** Operador de TI OPS-01 · **Jornadas:** J08 · **Superfície:** CAP11 · **Rota:** `/orchestra/sf-operations/service` · **Teste-fonte:** u04

> Como Operador de TI OPS-01, quero atualizar operação de TI com métricas e tempo coerentes para tomar a próxima ação com prova e governança.

**Dados e contexto:** OPS-SEP-26 · uptime 99.7% · meta 99.9% · 3 incidentes

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: OPS-SEP-26 · uptime 99.7% · meta 99.9% · 3 incidentes. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir IT Operations setembro/2026
3. Inspecionar SLO, incidentes e fonte de dados
4. Editar mês mantendo unidade porcentagem
5. Navegar para Security e retornar
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- 99.7% e 99.9% não são arredondados para o mesmo estado
- 3 incidentes e mês correto persistem
- Métrica mostra revisão e responsável
- Dashboards derivados reconstroem dados de fonte, sem escrita incidental
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP11-N01 · CAP11: contraprova — Alterar input para 997 ou -0.1% e tentar salvar

**Prioridade:** P1 · **Ator:** Operador de TI OPS-01 · **Jornadas:** J08 · **Superfície:** CAP11 · **Rota:** `/orchestra/sf-operations/service` · **Teste-fonte:** u04

> Como QA adversarial, quero desafiar Dashboard: IT Operations no contexto OPS-SEP-26 · uptime 99.7% · meta 99.9% · 3 incidentes para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** OPS-SEP-26 · uptime 99.7% · meta 99.9% · 3 incidentes

**Dado que**
- Story SF-CAP11-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Alterar input para 997 ou -0.1% e tentar salvar
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Validação de intervalo rejeita valor fora de contrato e preserva último mês
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP12-P01 · CAP12: Interpretar KPIs de segurança sem mascara de dados ausentes

**Prioridade:** P1 · **Ator:** Responsável Segurança SEC-01 · **Jornadas:** J08 · **Superfície:** CAP12 · **Rota:** `/orchestra/sf-operations/security` · **Teste-fonte:** u29

> Como Responsável Segurança SEC-01, quero interpretar KPIs de segurança sem mascara de dados ausentes para tomar a próxima ação com prova e governança.

**Dados e contexto:** SEC-SEP-26 · 4 endpoints críticos sem patch / 200 · 0 breaches conhecidos

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: SEC-SEP-26 · 4 endpoints críticos sem patch / 200 · 0 breaches conhecidos. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir IT Security KPIs e filtrar setembro/2026
3. Revisar denominador, período, fonte e tendência
4. Atualizar referência do KPI autorizado
5. Inspecionar ações e incidentes ligados
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- 4/200 = 2% de endpoints atrasados e zero breaches é zero conhecido
- Campo sem coleta permanece missing
- Incidentes têm status e dono
- Alteração do KPI não apaga evidências anteriores
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP12-N01 · CAP12: contraprova — Fonte do denominador indisponível retorna null em vez de 200

**Prioridade:** P1 · **Ator:** Responsável Segurança SEC-01 · **Jornadas:** J08 · **Superfície:** CAP12 · **Rota:** `/orchestra/sf-operations/security` · **Teste-fonte:** u29

> Como QA adversarial, quero desafiar Dashboard: IT Security KPIs no contexto SEC-SEP-26 · 4 endpoints críticos sem patch / 200 · 0 breaches conhecidos para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** SEC-SEP-26 · 4 endpoints críticos sem patch / 200 · 0 breaches conhecidos

**Dado que**
- Story SF-CAP12-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Fonte do denominador indisponível retorna null em vez de 200
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Taxa não é calculada nem apresentada como 0%
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP13-P01 · CAP13: Abrir risco corporativo com plano de mitigação e dependências

**Prioridade:** P1 · **Ator:** Risk Owner RISK-01 · **Jornadas:** J08 · **Superfície:** CAP13 · **Rota:** `/orchestra/sf-operations/risks` · **Teste-fonte:** u30

> Como Risk Owner RISK-01, quero abrir risco corporativo com plano de mitigação e dependências para tomar a próxima ação com prova e governança.

**Dados e contexto:** R-07 · EDI Logistics · likelihood 3/5 impact 4/5

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: R-07 · EDI Logistics · likelihood 3/5 impact 4/5. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Criar risco R-07 com projeto P-004 e owner
3. Registrar mitigação e revisão com data
4. Alterar severidade conforme política registrada
5. Revisar no painel de prioridades do CIO
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Risco mantém likelihood/impact em escalas explícitas
- Painel e portfólio usam mesmo riskRef
- Histórico mostra mudança e justificativa
- Nenhuma ação financeira ocorre por simples elevação de risco
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP13-N01 · CAP13: contraprova — Contribuidor de outro domínio tenta fechar R-07 por deep link

**Prioridade:** P1 · **Ator:** Risk Owner RISK-01 · **Jornadas:** J08 · **Superfície:** CAP13 · **Rota:** `/orchestra/sf-operations/risks` · **Teste-fonte:** u30

> Como QA adversarial, quero desafiar Dashboard: IT Risks no contexto R-07 · EDI Logistics · likelihood 3/5 impact 4/5 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** R-07 · EDI Logistics · likelihood 3/5 impact 4/5

**Dado que**
- Story SF-CAP13-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Contribuidor de outro domínio tenta fechar R-07 por deep link
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- 403 e histórico de risco inalterado
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP14-P01 · CAP14: Ver contrato de fornecedor e a responsabilidade por renovação

**Prioridade:** P0 · **Ator:** Pedro, buyer Procurement · **Jornadas:** J04 · **Superfície:** CAP14 · **Rota:** `/orchestra/sf-procurement/contracts` · **Teste-fonte:** u15

> Como Pedro, buyer Procurement, quero ver contrato de fornecedor e a responsabilidade por renovação para tomar a próxima ação com prova e governança.

**Dados e contexto:** CON-042 · fornecedor SUP-003 · renovação 2027-02-01

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: CON-042 · fornecedor SUP-003 · renovação 2027-02-01. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Vendor Contracts e localizar CON-042
3. Registrar período/renovação e documento autorizado
4. Relacionar contrato à solicitação PR-32000
5. Verificar fornecedor vigente e link com sourcing
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Contrato tem supplierRef e datas explícitas
- Relação com requisição não altera estágio da PR
- Informações restritas do fornecedor são redigidas por grant
- Histórico de renovação permanece auditável
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP14-N01 · CAP14: contraprova — Fornecedor é desativado após contrato entrar em revisão

**Prioridade:** P0 · **Ator:** Pedro, buyer Procurement · **Jornadas:** J04 · **Superfície:** CAP14 · **Rota:** `/orchestra/sf-procurement/contracts` · **Teste-fonte:** u15

> Como QA adversarial, quero desafiar Dashboard: Vendor Contracts no contexto CON-042 · fornecedor SUP-003 · renovação 2027-02-01 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** CON-042 · fornecedor SUP-003 · renovação 2027-02-01

**Dado que**
- Story SF-CAP14-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Fornecedor é desativado após contrato entrar em revisão
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- UI sinaliza impedimento e produtor rejeita novo compromisso inelegível
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP15-P01 · CAP15: Acompanhar stakeholders internos e externos em tópico sensível

**Prioridade:** P1 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J08 · **Superfície:** CAP15 · **Rota:** `/orchestra/sf-operations/stakeholders` · **Teste-fonte:** u30

> Como Caio, líder/contribuidor de TI, quero acompanhar stakeholders internos e externos em tópico sensível para tomar a próxima ação com prova e governança.

**Dados e contexto:** STK-011 · parceiro fictício Maritime Labs · owner P-003

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: STK-011 · parceiro fictício Maritime Labs · owner P-003. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Stakeholder Management
3. Registrar novo relacionamento com stakeholder STK-011
4. Vincular HOT-EDI-07 e atualizar próxima ação
5. Verificar que apenas papel autorizado pode ler notas restritas
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Relação vincula IDs imutáveis e prazo
- Próxima ação aparece na fila do responsável quando admitida
- Notas não vazam em pesquisa geral
- Export exige entitlement atual
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP15-N01 · CAP15: contraprova — Usuário com acesso ao tema, mas não à nota privada, acessa link direto da nota

**Prioridade:** P1 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J08 · **Superfície:** CAP15 · **Rota:** `/orchestra/sf-operations/stakeholders` · **Teste-fonte:** u30

> Como QA adversarial, quero desafiar Dashboard: Stakeholder Management no contexto STK-011 · parceiro fictício Maritime Labs · owner P-003 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** STK-011 · parceiro fictício Maritime Labs · owner P-003

**Dado que**
- Story SF-CAP15-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Usuário com acesso ao tema, mas não à nota privada, acessa link direto da nota
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Sem vazamento via HTML, busca, exportação ou histórico
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP16-P01 · CAP16: Medir contrato de desempenho de TI e subitens

**Prioridade:** P1 · **Ator:** Operador de TI OPS-01 · **Jornadas:** J08 · **Superfície:** CAP16 · **Rota:** `/orchestra/sf-operations/performance` · **Teste-fonte:** u31

> Como Operador de TI OPS-01, quero medir contrato de desempenho de TI e subitens para tomar a próxima ação com prova e governança.

**Dados e contexto:** PERF-01 · disponibilidade 99.7 vs SLA 99.9 · 3 subitens

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: PERF-01 · disponibilidade 99.7 vs SLA 99.9 · 3 subitens. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir IT Performance Contract
3. Criar item PERF-01 com owner e meta
4. Adicionar três subitens e registrar evidência mensal
5. Revisar atraso e eventual correção
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Meta/real são rastreáveis por período
- Subitens reconciliam com o item pai
- Mudança não forja aprovação de performance
- A lista mostra status e data da última evidência
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP16-N01 · CAP16: contraprova — Subitem eliminado enquanto outro usuário revisa uma versão antiga

**Prioridade:** P1 · **Ator:** Operador de TI OPS-01 · **Jornadas:** J08 · **Superfície:** CAP16 · **Rota:** `/orchestra/sf-operations/performance` · **Teste-fonte:** u31

> Como QA adversarial, quero desafiar Dashboard: IT Performance Contract no contexto PERF-01 · disponibilidade 99.7 vs SLA 99.9 · 3 subitens para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** PERF-01 · disponibilidade 99.7 vs SLA 99.9 · 3 subitens

**Dado que**
- Story SF-CAP16-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Subitem eliminado enquanto outro usuário revisa uma versão antiga
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- CAS e mensagem de conflito impedem ressurreição de subitem
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP17-P01 · CAP17: Separar versão oficial de hipóteses antes de discutir forecast

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J02 · **Superfície:** CAP17 · **Rota:** `/orchestra/sf-planner/overview` · **Teste-fonte:** u06

> Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero separar versão oficial de hipóteses antes de discutir forecast para tomar a próxima ação com prova e governança.

**Dados e contexto:** V-2026-OFFICIAL locked · V-2026-WHATIF-A e B

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: V-2026-OFFICIAL locked · V-2026-WHATIF-A e B. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Planner Overview com competência anual
3. Selecionar versão oficial e anotar valores da linha OPEX-LIC-01
4. Alternar para hipóteses A e B
5. Comparar total e estado de lock sem executar publish
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Official continua 590000 USD
- What-if A/B exibem 602000/596000 USD
- Legendas impedem confundir cenários com números aprovados
- A seleção de versão acompanha navegação
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP17-N01 · CAP17: contraprova — Tentar editar valor na versão official bloqueada

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J02 · **Superfície:** CAP17 · **Rota:** `/orchestra/sf-planner/overview` · **Teste-fonte:** u06

> Como QA adversarial, quero desafiar Planner: Overview no contexto V-2026-OFFICIAL locked · V-2026-WHATIF-A e B para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** V-2026-OFFICIAL locked · V-2026-WHATIF-A e B

**Dado que**
- Story SF-CAP17-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Tentar editar valor na versão official bloqueada
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Producer rejeita atualização e exibe razão de bloqueio
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP18-P01 · CAP18: Projetar renovação SaaS em cenários concorrentes

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J02 · **Superfície:** CAP18 · **Rota:** `/orchestra/sf-planner/opex` · **Teste-fonte:** u07, u48

> Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero projetar renovação SaaS em cenários concorrentes para tomar a próxima ação com prova e governança.

**Dados e contexto:** OPEX-LIC-01 · 72000 baseline / 84000 A / 78000 B USD

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: OPEX-LIC-01 · 72000 baseline / 84000 A / 78000 B USD. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Planner OPEX na hipótese A
3. Modificar licença anual 72000→84000 com nota
4. Criar/abrir hipótese B sem copiar dados de A inadvertidamente
5. Comparar OPEX por centro de custo e total
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- A=602000, B=596000, base=590000 USD
- Deltas A +12000 e B +6000 corretos
- Actual/official imutáveis
- Linhas identificam currency, período e versão
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP18-N01 · CAP18: contraprova — Dois usuários alteram mesma linha e período em A

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J02 · **Superfície:** CAP18 · **Rota:** `/orchestra/sf-planner/opex` · **Teste-fonte:** u07, u48

> Como QA adversarial, quero desafiar Planner: OPEX no contexto OPEX-LIC-01 · 72000 baseline / 84000 A / 78000 B USD para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** OPEX-LIC-01 · 72000 baseline / 84000 A / 78000 B USD

**Dado que**
- Story SF-CAP18-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Dois usuários alteram mesma linha e período em A
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Segundo save stale não sobrescreve o primeiro
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP19-P01 · CAP19: Planejar CAPEX por projeto e período sem dupla contabilização

**Prioridade:** P0 · **Ator:** Budget Owner sintético BO-01 · **Jornadas:** J02 · **Superfície:** CAP19 · **Rota:** `/orchestra/sf-planner/capex` · **Teste-fonte:** u07, u48

> Como Budget Owner sintético BO-01, quero planejar CAPEX por projeto e período sem dupla contabilização para tomar a próxima ação com prova e governança.

**Dados e contexto:** CAPEX-SCANNER-01 · 91827 USD · 2027 · P-009

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: CAPEX-SCANNER-01 · 91827 USD · 2027 · P-009. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Planner CAPEX na hipótese V-2027-WHATIF
3. Relacionar item de CAPEX a P-009 e janela 2027
4. Revisar aprovação e total consolidado
5. Comparar com visão CAPEX Dashboard
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Uma única linha de CAPEX soma 91827 no período 2027
- Duas vistas exibem mesma fonte sob política comum
- Não mistura CAPEX 2027 ao forecast OPEX 2026
- Referência do projeto é preservada
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP19-N01 · CAP19: contraprova — Inserir segunda linha com mesmo ID e combinação de período

**Prioridade:** P0 · **Ator:** Budget Owner sintético BO-01 · **Jornadas:** J02 · **Superfície:** CAP19 · **Rota:** `/orchestra/sf-planner/capex` · **Teste-fonte:** u07, u48

> Como QA adversarial, quero desafiar Planner: CAPEX no contexto CAPEX-SCANNER-01 · 91827 USD · 2027 · P-009 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** CAPEX-SCANNER-01 · 91827 USD · 2027 · P-009

**Dado que**
- Story SF-CAP19-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Inserir segunda linha com mesmo ID e combinação de período
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Detecta duplicata ou exige novo ID sem duplicar projeção
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP20-P01 · CAP20: Projetar posições por competência sem confundir lotação e custo

**Prioridade:** P0 · **Ator:** HR sintética HR-01 · **Jornadas:** J02 · **Superfície:** CAP20 · **Rota:** `/orchestra/sf-planner/headcount` · **Teste-fonte:** u08

> Como HR sintética HR-01, quero projetar posições por competência sem confundir lotação e custo para tomar a próxima ação com prova e governança.

**Dados e contexto:** HC-SEP-26 · 42 planejados / 40 ocupados / 2 vagas

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: HC-SEP-26 · 42 planejados / 40 ocupados / 2 vagas. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Planner Headcount setembro/2026
3. Inspecionar posição VAG-02, rate e centro de custo
4. Alterar hipótese de contratação de outubro, não actual de setembro
5. Comparar roster e custo mensal
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- FTE não é convertido automaticamente em pessoa distinta
- Outubro reflete apenas hipótese
- Setembro fechado permanece inalterado
- Rate/fonte/moeda visíveis conforme grant de HR
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP20-N01 · CAP20: contraprova — Usuário sem HR tenta acessar custo individual por URL de position edit

**Prioridade:** P0 · **Ator:** HR sintética HR-01 · **Jornadas:** J02 · **Superfície:** CAP20 · **Rota:** `/orchestra/sf-planner/headcount` · **Teste-fonte:** u08

> Como QA adversarial, quero desafiar Planner: Headcount no contexto HC-SEP-26 · 42 planejados / 40 ocupados / 2 vagas para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** HC-SEP-26 · 42 planejados / 40 ocupados / 2 vagas

**Dado que**
- Story SF-CAP20-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Usuário sem HR tenta acessar custo individual por URL de position edit
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Grant é revalidado no servidor, resposta sem dados privados
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP21-P01 · CAP21: Alocar custo entre entidades sem ultrapassar 100%

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J02 · **Superfície:** CAP21 · **Rota:** `/orchestra/sf-planner/allocations` · **Teste-fonte:** u09

> Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero alocar custo entre entidades sem ultrapassar 100% para tomar a próxima ação com prova e governança.

**Dados e contexto:** ALLOC-EDI-01 · 60% Centro IT-EU · 40% IT-BR

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: ALLOC-EDI-01 · 60% Centro IT-EU · 40% IT-BR. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Entities & allocations
3. Criar alocação ALLOC-EDI-01 para contrato EDI
4. Registrar splits 60/40 por entidade autorizada
5. Conferir consolidação em Planner e BI
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Soma é exatamente 100% e reconcilia moeda/base
- Não replica o custo integral em ambas entidades
- Entidade fora do escopo não é navegável
- Revisão e sourceRef ficam disponíveis
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP21-N01 · CAP21: contraprova — Alterar splits a 60/50 e tentar aplicar

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J02 · **Superfície:** CAP21 · **Rota:** `/orchestra/sf-planner/allocations` · **Teste-fonte:** u09

> Como QA adversarial, quero desafiar Planner: Entities & allocations no contexto ALLOC-EDI-01 · 60% Centro IT-EU · 40% IT-BR para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** ALLOC-EDI-01 · 60% Centro IT-EU · 40% IT-BR

**Dado que**
- Story SF-CAP21-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Alterar splits a 60/50 e tentar aplicar
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Validation impede alocação >100%, sem gravação parcial
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP22-P01 · CAP22: Registrar taxa FX com fonte temporal explicita

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J02 · **Superfície:** CAP22 · **Rota:** `/orchestra/sf-planner/fx` · **Teste-fonte:** u45

> Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero registrar taxa FX com fonte temporal explicita para tomar a próxima ação com prova e governança.

**Dados e contexto:** FX-EURUSD-SEP26 · EUR→USD =1.08 · fonte sintética 2026-09-30

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: FX-EURUSD-SEP26 · EUR→USD =1.08 · fonte sintética 2026-09-30. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir FX rates e selecionar competência setembro/2026
3. Consultar par EUR/USD e proveniência
4. Adicionar/editar taxa 1.08 em hipótese, se policy permitir
5. Comparar cotações de EUR 28000 de Procurement
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- 28000 EUR × 1.08 = 30240 USD quando fonte compatível
- Cotação e competência visíveis
- Taxa não altera cálculo histórico congelado sem revisão
- Ausência de taxa permanece missing
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP22-N01 · CAP22: contraprova — Excluir taxa de EUR e comparar proposta

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J02 · **Superfície:** CAP22 · **Rota:** `/orchestra/sf-planner/fx` · **Teste-fonte:** u45

> Como QA adversarial, quero desafiar Planner: FX rates no contexto FX-EURUSD-SEP26 · EUR→USD =1.08 · fonte sintética 2026-09-30 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** FX-EURUSD-SEP26 · EUR→USD =1.08 · fonte sintética 2026-09-30

**Dado que**
- Story SF-CAP22-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Excluir taxa de EUR e comparar proposta
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- UI declara comparação indeterminada e impede escolha baseada em FX fictícia
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP23-P01 · CAP23: Criar versão hipotética sem destravar baseline publicado

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J02 · **Superfície:** CAP23 · **Rota:** `/orchestra/sf-planner/versions` · **Teste-fonte:** u46

> Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero criar versão hipotética sem destravar baseline publicado para tomar a próxima ação com prova e governança.

**Dados e contexto:** V-2026-OFFICIAL locked; V-2026-WHATIF-A/B

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: V-2026-OFFICIAL locked; V-2026-WHATIF-A/B. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Versions e criar WHATIF-A a partir de baseline conhecido
3. Inspecionar parentVersion, lock e competência
4. Criar versão B independente
5. Comparar A, B e official
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Oficial permanece intocado e locked
- Histórico registra autor, base e criação
- A/B não se mesclam implicitamente
- Versão inválida não é apresentada como aprovada
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP23-N01 · CAP23: contraprova — Contribuidor tenta publicar versão official sem autorização

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J02 · **Superfície:** CAP23 · **Rota:** `/orchestra/sf-planner/versions` · **Teste-fonte:** u46

> Como QA adversarial, quero desafiar Planner: Versions no contexto V-2026-OFFICIAL locked; V-2026-WHATIF-A/B para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** V-2026-OFFICIAL locked; V-2026-WHATIF-A/B

**Dado que**
- Story SF-CAP23-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Contribuidor tenta publicar versão official sem autorização
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Negação explícita e nenhuma alteração no snapshot oficial
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP24-P01 · CAP24: Diagnosticar fila de Procurement e seus atrasos por etapa

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J04 · **Superfície:** CAP24 · **Rota:** `/orchestra/sf-procurement/overview` · **Teste-fonte:** SEM E2E DEDICADO

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero diagnosticar fila de Procurement e seus atrasos por etapa para tomar a próxima ação com prova e governança.

**Dados e contexto:** PR-32000 · draft→PR→sourcing→PO · 3 pedidos sintéticos no painel

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: PR-32000 · draft→PR→sourcing→PO · 3 pedidos sintéticos no painel. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Procurement Dashboard para a organização SF-LAB
3. Reconstruir contagem por PR pendente, sourcing e PO com três IDs
4. Abrir pedido PR-32000 e voltar com filtros intactos
5. Conferir aging por timestamp de entrada no estágio e comparação com fila de Gabriel
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Contagens reconciliam com requisições fonte, sem duplicatas
- Aging mede estágio atual real, não data da página
- Pedido sem holder válido não aparece como aprovado
- CAP24 recebe evidência E2E dedicada, não apenas teste genérico de rota
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP24-N01 · CAP24: contraprova — Pedido PR-32000 muda de estágio durante leitura do dashboard

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J04 · **Superfície:** CAP24 · **Rota:** `/orchestra/sf-procurement/overview` · **Teste-fonte:** SEM E2E DEDICADO

> Como QA adversarial, quero desafiar Procurement: Dashboard no contexto PR-32000 · draft→PR→sourcing→PO · 3 pedidos sintéticos no painel para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** PR-32000 · draft→PR→sourcing→PO · 3 pedidos sintéticos no painel

**Dado que**
- Story SF-CAP24-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Pedido PR-32000 muda de estágio durante leitura do dashboard
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Refresh mostra fila e aging consistentes, sem status fantasma
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP25-P01 · CAP25: Abrir requisição para integração de cargas e acompanhar PR→PO

**Prioridade:** P0 · **Ator:** Caio, requester Procurement · **Jornadas:** J04 · **Superfície:** CAP25 · **Rota:** `/orchestra/sf-procurement/requests` · **Teste-fonte:** u12

> Como Caio, requester Procurement, quero abrir requisição para integração de cargas e acompanhar PR→PO para tomar a próxima ação com prova e governança.

**Dados e contexto:** PR-32000 · pedido USD 32000 · CC IT-BR

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: PR-32000 · pedido USD 32000 · CC IT-BR. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Criar requisição PR-32000 com item e justificativa da integração EDI
3. Salvar draft, reler e submeter PR
4. Entrar como Buyer e consultar sourcing somente após etapa admitida
5. Conferir histórico e relação com contrato CON-042
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Ciclo draft→pr_pending aparece com receipt
- Requester não ganha privilégio de Buyer ou approver
- Valores/unidade e centro de custo persistem
- Novo estágio tem histórico e revisão
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP25-N01 · CAP25: contraprova — Enviar PR com owner divergente ou estágio já alterado

**Prioridade:** P0 · **Ator:** Caio, requester Procurement · **Jornadas:** J04 · **Superfície:** CAP25 · **Rota:** `/orchestra/sf-procurement/requests` · **Teste-fonte:** u12

> Como QA adversarial, quero desafiar Procurement: Requests no contexto PR-32000 · pedido USD 32000 · CC IT-BR para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** PR-32000 · pedido USD 32000 · CC IT-BR

**Dado que**
- Story SF-CAP25-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Enviar PR com owner divergente ou estágio já alterado
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- CAS/owner fence recusa submissão e não cria requisição duplicada
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP26-P01 · CAP26: Deliberar em fila onde é o holder real

**Prioridade:** P0 · **Ator:** Gabriel, holder/aprovador Procurement · **Jornadas:** J04 · **Superfície:** CAP26 · **Rota:** `/orchestra/sf-procurement/approvals` · **Teste-fonte:** u13

> Como Gabriel, holder/aprovador Procurement, quero deliberar em fila onde é o holder real para tomar a próxima ação com prova e governança.

**Dados e contexto:** PR-32000 · Gabriel holder da etapa PR

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: PR-32000 · Gabriel holder da etapa PR. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Entrar como Gabriel no contexto correto
3. Abrir My approvals e localizar PR-32000 pendente
4. Analisar valores, etapa, histórico, fornecedor e orçamento
5. Aprovar com justificativa e conferir receipt/releitura
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Apenas holder atual recebe ação de aprovação
- Aprovação muda exatamente uma etapa, com audit
- Pedido some da fila pendente do mesmo holder
- Não emite PO nem aciona ERP externo automaticamente
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP26-N01 · CAP26: contraprova — Buyer Pedro tenta aprovar a etapa do holder Gabriel por URL direta

**Prioridade:** P0 · **Ator:** Gabriel, holder/aprovador Procurement · **Jornadas:** J04 · **Superfície:** CAP26 · **Rota:** `/orchestra/sf-procurement/approvals` · **Teste-fonte:** u13

> Como QA adversarial, quero desafiar Procurement: My approvals no contexto PR-32000 · Gabriel holder da etapa PR para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** PR-32000 · Gabriel holder da etapa PR

**Dado que**
- Story SF-CAP26-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Buyer Pedro tenta aprovar a etapa do holder Gabriel por URL direta
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- 403, nenhuma mudança de estado, audit de aplicação ausente
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP27-P01 · CAP27: Manter fornecedor apto e protegido para sourcing

**Prioridade:** P0 · **Ator:** Supplier Admin SA-01 · **Jornadas:** J04 · **Superfície:** CAP27 · **Rota:** `/orchestra/sf-procurement/suppliers` · **Teste-fonte:** u14

> Como Supplier Admin SA-01, quero manter fornecedor apto e protegido para sourcing para tomar a próxima ação com prova e governança.

**Dados e contexto:** SUP-003 · Maritime Labs S.A. fictícia · status active

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: SUP-003 · Maritime Labs S.A. fictícia · status active. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Suppliers e selecionar SUP-003
3. Atualizar contatos e status cadastral
4. Consultar vínculo com CON-042 e PR-32000
5. Revisar mascaramento dos dados bancários conforme grant
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Fornecedor selecionado é o mesmo ID nos consumidores
- Histórico registra status e owner
- Dados bancários não aparecem em leitor comum
- Só fornecedor elegível participa de nova adjudicação
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP27-N01 · CAP27: contraprova — Buyer tenta ler conta bancária via busca/export sem grant específico

**Prioridade:** P0 · **Ator:** Supplier Admin SA-01 · **Jornadas:** J04 · **Superfície:** CAP27 · **Rota:** `/orchestra/sf-procurement/suppliers` · **Teste-fonte:** u14

> Como QA adversarial, quero desafiar Procurement: Suppliers no contexto SUP-003 · Maritime Labs S.A. fictícia · status active para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** SUP-003 · Maritime Labs S.A. fictícia · status active

**Dado que**
- Story SF-CAP27-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Buyer tenta ler conta bancária via busca/export sem grant específico
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- 403/redaction aplicável, sem vazamento de valor em logs ou DOM
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP28-P01 · CAP28: Ver regras de Procurement sem alterar governança por acidente

**Prioridade:** P0 · **Ator:** Admin de domínio Procurement PA-01 · **Jornadas:** J04 · **Superfície:** CAP28 · **Rota:** `/orchestra/sf-procurement/settings` · **Teste-fonte:** u36

> Como Admin de domínio Procurement PA-01, quero ver regras de Procurement sem alterar governança por acidente para tomar a próxima ação com prova e governança.

**Dados e contexto:** PROC-POLICY-2026 · estágios PR/SRC/PO · limite sintético 30000 USD

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: PROC-POLICY-2026 · estágios PR/SRC/PO · limite sintético 30000 USD. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Procurement Settings com papel admin de domínio
3. Ler estágios, holders e regras efetivamente instaladas
4. Solicitar alteração em ambiente QA sob política admitida
5. Revalidar fluxo PR-32000 após revisão de policy
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Alteração é permitida somente se produtor atual expuser comando autorizado
- Mudança não reaprova estágios antigos automaticamente
- Versão de policy é rastreada
- Role de domínio não equivale a supreme-admin Entra
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-CAP28-N01 · CAP28: contraprova — Regular Buyer tenta editar configuração de aprovação

**Prioridade:** P0 · **Ator:** Admin de domínio Procurement PA-01 · **Jornadas:** J04 · **Superfície:** CAP28 · **Rota:** `/orchestra/sf-procurement/settings` · **Teste-fonte:** u36

> Como QA adversarial, quero desafiar Procurement: Settings no contexto PROC-POLICY-2026 · estágios PR/SRC/PO · limite sintético 30000 USD para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** PROC-POLICY-2026 · estágios PR/SRC/PO · limite sintético 30000 USD

**Dado que**
- Story SF-CAP28-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Regular Buyer tenta editar configuração de aprovação
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Form/action oculto ou negado, sem alteração na política
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI29-P01 · UI29: Começar o dia com prioridades e contexto reais

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J08 · **Superfície:** UI29 · **Rota:** `/orchestra/sf-home` · **Teste-fonte:** u01

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero começar o dia com prioridades e contexto reais para tomar a próxima ação com prova e governança.

**Dados e contexto:** TODAY-2026-11-17 · HOT-EDI-07 · PR-32000 · R-07

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: TODAY-2026-11-17 · HOT-EDI-07 · PR-32000 · R-07. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Autenticar, selecionar instalação e projeto
3. Abrir Hoje e revisar prioridades com origem, etapa e prazo
4. Abrir HOT-EDI-07 e voltar mantendo contexto
5. Confirmar separação entre atividade pessoal e visão global
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Atividades pertencem ao principal logado
- Prazos e títulos não criam autorizações novas
- Link para ação abre referência válida sem trocar owner
- A ausência de atividades é estado vazio, não erro 500
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI29-N01 · UI29: contraprova — Viewer abre link privado compartilhado da Home de um executivo

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J08 · **Superfície:** UI29 · **Rota:** `/orchestra/sf-home` · **Teste-fonte:** u01

> Como QA adversarial, quero desafiar Hoje no contexto TODAY-2026-11-17 · HOT-EDI-07 · PR-32000 · R-07 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** TODAY-2026-11-17 · HOT-EDI-07 · PR-32000 · R-07

**Dado que**
- Story SF-UI29-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Viewer abre link privado compartilhado da Home de um executivo
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Sem vazar tarefas do executivo; estado próprio ou acesso negado
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI30-P01 · UI30: Executar trabalho pendente reunido de múltiplos domínios

**Prioridade:** P1 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J01, J06 · **Superfície:** UI30 · **Rota:** `/orchestra/sf-work` · **Teste-fonte:** u41

> Como Caio, líder/contribuidor de TI, quero executar trabalho pendente reunido de múltiplos domínios para tomar a próxima ação com prova e governança.

**Dados e contexto:** WORK-Caio · HOT-EDI-07 · TASK-023 · OPEX-LIC-01

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: WORK-Caio · HOT-EDI-07 · TASK-023 · OPEX-LIC-01. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Meu trabalho com filtros “meu/pendente”
3. Entrar em tarefa HOT-EDI-07 atribuída a Caio
4. Revisar escopo e confirmar somente ação autorizada
5. Voltar à lista e conferir alteração de estado e posição
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- A lista não duplica tarefa por múltiplas relações
- Confirmação não muda valor de Planner
- Owner e período permanecem no retorno
- Tarefa de Gabriel não é apresentada como tarefa de Caio
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI30-N01 · UI30: contraprova — Trocar conta/tenant enquanto Meu trabalho está aberto

**Prioridade:** P1 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J01, J06 · **Superfície:** UI30 · **Rota:** `/orchestra/sf-work` · **Teste-fonte:** u41

> Como QA adversarial, quero desafiar Meu trabalho no contexto WORK-Caio · HOT-EDI-07 · TASK-023 · OPEX-LIC-01 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** WORK-Caio · HOT-EDI-07 · TASK-023 · OPEX-LIC-01

**Dado que**
- Story SF-UI30-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Trocar conta/tenant enquanto Meu trabalho está aberto
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Lista e cache da identidade anterior são invalidados imediatamente
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI31-P01 · UI31: Encontrar evidências autorizadas sem indexar segredos no endereço

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J08 · **Superfície:** UI31 · **Rota:** `/orchestra/sf-home/search` · **Teste-fonte:** u42

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero encontrar evidências autorizadas sem indexar segredos no endereço para tomar a próxima ação com prova e governança.

**Dados e contexto:** SEARCH-EDI-07 · documentos e itens de 3 domínios

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: SEARCH-EDI-07 · documentos e itens de 3 domínios. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Busca SF e pesquisar “EDI Santos”
3. Comparar resultados por tipo/fonte, mantendo contexto
4. Abrir um resultado e conferir ID opaco
5. Inspecionar URL, histórico do navegador e logs sanitizados
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Busca recebe payload via POST sem query confidencial em URL
- Resultados omitem objetos fora dos grants
- Trechos são redigidos conforme fonte
- Navegação para item usa routeRef canônico
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI31-N01 · UI31: contraprova — Tentar GET com search terms na query URL em vez de POST JSON

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J08 · **Superfície:** UI31 · **Rota:** `/orchestra/sf-home/search` · **Teste-fonte:** u42

> Como QA adversarial, quero desafiar Busca SF no contexto SEARCH-EDI-07 · documentos e itens de 3 domínios para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** SEARCH-EDI-07 · documentos e itens de 3 domínios

**Dado que**
- Story SF-UI31-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Tentar GET com search terms na query URL em vez de POST JSON
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- NAV-01 rejeita o transporte indevido sem executar pesquisa
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI32-P01 · UI32: Salvar visão operacional e retomá-la quando V2 estiver disponível

**Prioridade:** P1 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J01, J06 · **Superfície:** UI32 · **Rota:** `/orchestra/sf-work/views/:viewId` · **Teste-fonte:** u43

> Como Caio, líder/contribuidor de TI, quero salvar visão operacional e retomá-la quando V2 estiver disponível para tomar a próxima ação com prova e governança.

**Dados e contexto:** VIEW-EDI-Caio · filtros IT-BR e pendente

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: VIEW-EDI-Caio · filtros IT-BR e pendente. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Inspecionar se o produtor Saved Views V2 está instalado
3. Se disponível, salvar VIEW-EDI-Caio e retornar em nova sessão
4. Se indisponível, registrar estado de capability/unavailable sem forçar ação
5. Confirmar que a visão legada não foi vendida como V2
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Teste tem duas saídas condicionais documentadas pelo release contract
- V2 instalada restaura owner/filtros e não revela dados revogados
- V2 não instalada é registrada como GAP funcional, não PASS
- Nenhum fallback silencioso inventa operação
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI32-N01 · UI32: contraprova — Acessar viewId pertencente a outro usuário mesmo se rota estiver registrada

**Prioridade:** P1 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J01, J06 · **Superfície:** UI32 · **Rota:** `/orchestra/sf-work/views/:viewId` · **Teste-fonte:** u43

> Como QA adversarial, quero desafiar Visões salvas no contexto VIEW-EDI-Caio · filtros IT-BR e pendente para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** VIEW-EDI-Caio · filtros IT-BR e pendente

**Dado que**
- Story SF-UI32-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Acessar viewId pertencente a outro usuário mesmo se rota estiver registrada
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Sem leitura cruzada nem exposição de filtros privados
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI33-P01 · UI33: Abrir caso de decisão que cite fatos e alternativas

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J04, J06 · **Superfície:** UI33 · **Rota:** `/orchestra/sf-decisions` · **Teste-fonte:** u16

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero abrir caso de decisão que cite fatos e alternativas para tomar a próxima ação com prova e governança.

**Dados e contexto:** CASE-EDI-01 · selecionar fornecedor + timeline de TI

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: CASE-EDI-01 · selecionar fornecedor + timeline de TI. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir lista de decisões e criar CASE-EDI-01
3. Registrar pergunta, escopo de negócio e fontes P-004/PR-32000
4. Salvar draft e reabrir
5. Convidar papéis de leitura específicos, não aprovação implícita
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Caso tem caseRef e versão próprios
- Dados de fontes são referências autorizadas
- Novo caso não aplica compra
- Leitor restrito só vê campos admitidos
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI33-N01 · UI33: contraprova — Criar caso com referência de outra instalação

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J04, J06 · **Superfície:** UI33 · **Rota:** `/orchestra/sf-decisions` · **Teste-fonte:** u16

> Como QA adversarial, quero desafiar Lista/criação de casos no contexto CASE-EDI-01 · selecionar fornecedor + timeline de TI para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** CASE-EDI-01 · selecionar fornecedor + timeline de TI

**Dado que**
- Story SF-UI33-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Criar caso com referência de outra instalação
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Criar/reler é recusado, sem copiar dado cross-tenant
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI34-P01 · UI34: Ver escopo, intenção e fontes antes de escolher

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J04, J06 · **Superfície:** UI34 · **Rota:** `/orchestra/sf-decisions/:caseRef` · **Teste-fonte:** u01, u16

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero ver escopo, intenção e fontes antes de escolher para tomar a próxima ação com prova e governança.

**Dados e contexto:** CASE-EDI-01 · intenção adjudicar integração EDI

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: CASE-EDI-01 · intenção adjudicar integração EDI. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir CASE-EDI-01 por ID
3. Inspecionar autor, fonte, moeda, data e estágio das decisões
4. Abrir alternativa B e retornar ao resumo
5. Registrar revisão sem executar mudança
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Resumo identifica o que está pendente de decisão humana
- Estado da fonte e da escolha não são confundidos
- Permissão atual é validada na releitura
- Nenhum efeito financeiro ocorre na leitura
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI34-N01 · UI34: contraprova — Fonte PR-32000 é revogada entre abrir e atualizar o case

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J04, J06 · **Superfície:** UI34 · **Rota:** `/orchestra/sf-decisions/:caseRef` · **Teste-fonte:** u01, u16

> Como QA adversarial, quero desafiar Resumo/intenção do caso no contexto CASE-EDI-01 · intenção adjudicar integração EDI para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** CASE-EDI-01 · intenção adjudicar integração EDI

**Dado que**
- Story SF-UI34-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Fonte PR-32000 é revogada entre abrir e atualizar o case
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Resumo redige o conteúdo e deixa sinal de fonte inacessível
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI35-P01 · UI35: Comparar alternativas com custo elegibilidade e FX conhecido

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J04, J06 · **Superfície:** UI35 · **Rota:** `/orchestra/sf-decisions/:caseRef/alternatives` · **Teste-fonte:** u17

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero comparar alternativas com custo elegibilidade e FX conhecido para tomar a próxima ação com prova e governança.

**Dados e contexto:** ALT-A 32400 USD · ALT-B 28000 EUR×1.08 · ALT-C 29000 USD ineligible

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: ALT-A 32400 USD · ALT-B 28000 EUR×1.08 · ALT-C 29000 USD ineligible. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir alternativas de CASE-EDI-01
3. Registrar A/B/C com critérios e fonte da avaliação
4. Calcular equivalência de B e marcar C tecnicamente inelegível
5. Abrir detalhe e submeter para escolha humana
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- B equivalente a 30240 USD
- C não vence apesar do menor preço
- Score publicado precisa reproduzir componentes 87.9333 e 85 do oráculo quando aplicável
- Comparação isolada não aprova pedido
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI35-N01 · UI35: contraprova — FX do período deixa de existir antes da comparação

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J04, J06 · **Superfície:** UI35 · **Rota:** `/orchestra/sf-decisions/:caseRef/alternatives` · **Teste-fonte:** u17

> Como QA adversarial, quero desafiar Alternativas e comparação no contexto ALT-A 32400 USD · ALT-B 28000 EUR×1.08 · ALT-C 29000 USD ineligible para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** ALT-A 32400 USD · ALT-B 28000 EUR×1.08 · ALT-C 29000 USD ineligible

**Dado que**
- Story SF-UI35-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. FX do período deixa de existir antes da comparação
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- B fica incomparável e a UI não substitui por taxa atual arbitrária
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI36-P01 · UI36: Registrar premissas e divergências sem inventar consenso

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J04, J06 · **Superfície:** UI36 · **Rota:** `/orchestra/sf-decisions/:caseRef/assumptions` · **Teste-fonte:** u17

> Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero registrar premissas e divergências sem inventar consenso para tomar a próxima ação com prova e governança.

**Dados e contexto:** ASM-FX-EDI · taxa EURUSD 1.08 de 2026-09-30

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: ASM-FX-EDI · taxa EURUSD 1.08 de 2026-09-30. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir premissas de CASE-EDI-01
3. Adicionar ASM-FX-EDI com justificativa e fonte temporal
4. Confrontar divergência de Finance vs Buyer
5. Registrar correção/revisão separada
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Premissas são versionadas e referenciáveis
- Divergência continua explícita até resolução humana
- Alterar premissa não reescreve recibo passado
- Fonte/competência de FX permanecem associadas
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI36-N01 · UI36: contraprova — Buyer edita premissa reservada à área Finance

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J04, J06 · **Superfície:** UI36 · **Rota:** `/orchestra/sf-decisions/:caseRef/assumptions` · **Teste-fonte:** u17

> Como QA adversarial, quero desafiar Premissas e divergências no contexto ASM-FX-EDI · taxa EURUSD 1.08 de 2026-09-30 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** ASM-FX-EDI · taxa EURUSD 1.08 de 2026-09-30

**Dado que**
- Story SF-UI36-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Buyer edita premissa reservada à área Finance
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Permissão de mutation negada e divergência preservada
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI37-P01 · UI37: Encaminhar pergunta a responsável sem virar aprovador

**Prioridade:** P1 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J04, J06 · **Superfície:** UI37 · **Rota:** `/orchestra/sf-decisions/:caseRef/questions` · **Teste-fonte:** u17

> Como Caio, líder/contribuidor de TI, quero encaminhar pergunta a responsável sem virar aprovador para tomar a próxima ação com prova e governança.

**Dados e contexto:** Q-EDI-FX-01 · finance owner Sofie

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: Q-EDI-FX-01 · finance owner Sofie. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir ciclo de perguntas de CASE-EDI-01
3. Criar Q-EDI-FX-01 para Sofie como Finance
4. Responder com fonte do FX e marcar dúvida resolvida
5. Voltar ao histórico do caso
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Pergunta/resposta têm timestamp, principal e fonte
- Owner não é derivado de nome exibido
- Resposta não executa PO
- A conclusão aparece no caso sem excluir mensagens anteriores
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI37-N01 · UI37: contraprova — Enviar pergunta a homônimo Sofie de outro owner

**Prioridade:** P1 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J04, J06 · **Superfície:** UI37 · **Rota:** `/orchestra/sf-decisions/:caseRef/questions` · **Teste-fonte:** u17

> Como QA adversarial, quero desafiar Perguntas e ciclos no contexto Q-EDI-FX-01 · finance owner Sofie para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** Q-EDI-FX-01 · finance owner Sofie

**Dado que**
- Story SF-UI37-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Enviar pergunta a homônimo Sofie de outro owner
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Referência do destinatário impede entrega ao principal errado
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI38-P01 · UI38: Registrar escolha humana consciente sem executar aplicação

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J04, J06 · **Superfície:** UI38 · **Rota:** `/orchestra/sf-decisions/:caseRef/choice` · **Teste-fonte:** u17, u18

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero registrar escolha humana consciente sem executar aplicação para tomar a próxima ação com prova e governança.

**Dados e contexto:** CHOICE-EDI-01 · ALT-B após validação Finance

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: CHOICE-EDI-01 · ALT-B após validação Finance. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Escolha atual em CASE-EDI-01
3. Inspecionar alternativas e ressalva de FX
4. Selecionar ALT-B com justificativa explícita
5. Confirmar que escolha é registrada separadamente de apply
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Escolha aponta para ALT-B e versão das fontes
- Justificativa/autor são auditáveis
- PR-32000 não muda de estágio automaticamente
- Botão de aplicar só habilita com prepared change autorizado
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI38-N01 · UI38: contraprova — Alternativa muda de elegibilidade após escolha

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J04, J06 · **Superfície:** UI38 · **Rota:** `/orchestra/sf-decisions/:caseRef/choice` · **Teste-fonte:** u17, u18

> Como QA adversarial, quero desafiar Escolha humana atual no contexto CHOICE-EDI-01 · ALT-B após validação Finance para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** CHOICE-EDI-01 · ALT-B após validação Finance

**Dado que**
- Story SF-UI38-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Alternativa muda de elegibilidade após escolha
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Preparação de aplicação exige revisão e não aceita fonte stale
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI39-P01 · UI39: Aplicar somente mudança preparada com dupla checagem

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J04, J06 · **Superfície:** UI39 · **Rota:** `/orchestra/sf-decisions/:caseRef/changes/:changeRef` · **Teste-fonte:** u18

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero aplicar somente mudança preparada com dupla checagem para tomar a próxima ação com prova e governança.

**Dados e contexto:** CHANGE-EDI-01 · CASE-EDI-01 · PR-32000

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: CHANGE-EDI-01 · CASE-EDI-01 · PR-32000. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir mudança preparada e ler diff before/after
3. Revisar owner, escopo, revisão e efeitos no produtor
4. Confirmar humana e registrar attempt ID
5. Aplicar uma vez e abrir recibo do producer
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Sem confirmação não há commit
- Aplicação tem exatamente um recibo com versionamento
- Estado novo é relido da fonte governada
- Uma análise ou comentário não pode acionar mudança
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI39-N01 · UI39: contraprova — Enviar mesma confirmação em paralelo após timeout de resposta

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J04, J06 · **Superfície:** UI39 · **Rota:** `/orchestra/sf-decisions/:caseRef/changes/:changeRef` · **Teste-fonte:** u18

> Como QA adversarial, quero desafiar Mudanças preparadas no contexto CHANGE-EDI-01 · CASE-EDI-01 · PR-32000 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** CHANGE-EDI-01 · CASE-EDI-01 · PR-32000

**Dado que**
- Story SF-UI39-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Enviar mesma confirmação em paralelo após timeout de resposta
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Consultar attempt original, recuperar recibo e não duplicar efeito
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI40-P01 · UI40: Verificar qual mudança foi de fato persistida

**Prioridade:** P0 · **Ator:** Auditor sintético AUD-01 · **Jornadas:** J04, J06 · **Superfície:** UI40 · **Rota:** `/orchestra/sf-decisions/:caseRef/receipts/:receiptRef` · **Teste-fonte:** u18

> Como Auditor sintético AUD-01, quero verificar qual mudança foi de fato persistida para tomar a próxima ação com prova e governança.

**Dados e contexto:** RECEIPT-EDI-01 · attempt CHANGE-EDI-01

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: RECEIPT-EDI-01 · attempt CHANGE-EDI-01. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir recibo pelo case/receiptRef
3. Conferir origem, ator, revisão e resultado de negócio
4. Comparar before/after com fonte relida
5. Verificar histórico mesmo após nova leitura sem reaplicar
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Recibo é estável, não calculado a partir do estado atual
- Apply effect não duplica em refresh
- Negado não expõe recibo de outro tenant
- Resultado tem estado terminal verificável
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI40-N01 · UI40: contraprova — Attempt existe mas resposta foi perdida após commit

**Prioridade:** P0 · **Ator:** Auditor sintético AUD-01 · **Jornadas:** J04, J06 · **Superfície:** UI40 · **Rota:** `/orchestra/sf-decisions/:caseRef/receipts/:receiptRef` · **Teste-fonte:** u18

> Como QA adversarial, quero desafiar Recibo/histórico de aplicação no contexto RECEIPT-EDI-01 · attempt CHANGE-EDI-01 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** RECEIPT-EDI-01 · attempt CHANGE-EDI-01

**Dado que**
- Story SF-UI40-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Attempt existe mas resposta foi perdida após commit
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Recuperação retorna mesmo receiptRef e nunca emite nova ordem
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI41-P01 · UI41: Acompanhar análise assíncrona sem tomá-la por decisão aprovada

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J04, J06 · **Superfície:** UI41 · **Rota:** `/orchestra/sf-decisions/:caseRef/analyses/:analysisRef` · **Teste-fonte:** u37

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero acompanhar análise assíncrona sem tomá-la por decisão aprovada para tomar a próxima ação com prova e governança.

**Dados e contexto:** AN-EDI-01 · análise do CASE-EDI-01

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: AN-EDI-01 · análise do CASE-EDI-01. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir análise assíncrona e admitir execução autorizada
3. Acompanhar queued→running→completed/failed conforme retorno real
4. Ler output e verifier independente
5. Relacionar contribuição a CASE-EDI-01 sem aplicar
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- runRef é consistente e estado observado é honesto
- Output inválido não vira recomendação verificada
- Proveniência inclui skill/model/input versionados
- Nenhuma alteração em Procurement ocorre somente por completion
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI41-N01 · UI41: contraprova — Modelo devolve JSON fora do schema ou usa fonte fora do scope

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J04, J06 · **Superfície:** UI41 · **Rota:** `/orchestra/sf-decisions/:caseRef/analyses/:analysisRef` · **Teste-fonte:** u37

> Como QA adversarial, quero desafiar Análise assíncrona no contexto AN-EDI-01 · análise do CASE-EDI-01 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** AN-EDI-01 · análise do CASE-EDI-01

**Dado que**
- Story SF-UI41-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Modelo devolve JSON fora do schema ou usa fonte fora do scope
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Verifier falha fechado, resultado não é promovido a evidência aprovada
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI42-P01 · UI42: Avaliar combinações de projetos com restrições financeiras

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J02, J08 · **Superfície:** UI42 · **Rota:** `/orchestra/sf-portfolio/scenarios/:caseRef` · **Teste-fonte:** u19

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero avaliar combinações de projetos com restrições financeiras para tomar a próxima ação com prova e governança.

**Dados e contexto:** SCN-PORT-01 · 25 candidatos · teto sintético 200000 USD

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: SCN-PORT-01 · 25 candidatos · teto sintético 200000 USD. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir campanha de cenários e configurar escopo
3. Selecionar candidatos P-001…P-025 com limites
4. Executar avaliação admitida pela fonte
5. Inspecionar escolhas candidatas e salvar versão do resultado
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Resultado reporta restrições, custos e fontes
- Projetos não são duplicados em um conjunto
- Salvar cenário não altera portfolio official
- Resultados têm IDs e revisões rastreáveis
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI42-N01 · UI42: contraprova — Candidato sem CAPEX conhecido é tratado como custo zero

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J02, J08 · **Superfície:** UI42 · **Rota:** `/orchestra/sf-portfolio/scenarios/:caseRef` · **Teste-fonte:** u19

> Como QA adversarial, quero desafiar Campanha/candidatos no contexto SCN-PORT-01 · 25 candidatos · teto sintético 200000 USD para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** SCN-PORT-01 · 25 candidatos · teto sintético 200000 USD

**Dado que**
- Story SF-UI42-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Candidato sem CAPEX conhecido é tratado como custo zero
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Sistema deve identificar custo indeterminado e não aprovar combinação enganosa
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI43-P01 · UI43: Consultar resultado preservado e comparar campanhas

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J02, J08 · **Superfície:** UI43 · **Rota:** `/orchestra/sf-portfolio/scenarios/:caseRef/results/:resultRef` · **Teste-fonte:** u19

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero consultar resultado preservado e comparar campanhas para tomar a próxima ação com prova e governança.

**Dados e contexto:** SCN-PORT-01/R-001 · conjunto P-004/P-009

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: SCN-PORT-01/R-001 · conjunto P-004/P-009. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir resultado R-001 de SCN-PORT-01
3. Examinar composição, pesos, elegibilidade e data de origem
4. Alterar origem em outro contexto e voltar
5. Comparar com nova execução sem sobrescrever R-001
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Resultado R-001 é preservado e versionado
- Mudança da fonte não altera snapshot antigo
- Resultados incompatíveis são sinalizados
- Origem não é reclassificada como oficial
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI43-N01 · UI43: contraprova — Remover acesso a P-009 após criação do resultado

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J02, J08 · **Superfície:** UI43 · **Rota:** `/orchestra/sf-portfolio/scenarios/:caseRef/results/:resultRef` · **Teste-fonte:** u19

> Como QA adversarial, quero desafiar Combinações/histórico no contexto SCN-PORT-01/R-001 · conjunto P-004/P-009 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** SCN-PORT-01/R-001 · conjunto P-004/P-009

**Dado que**
- Story SF-UI43-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Remover acesso a P-009 após criação do resultado
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Releitura e export aplicam autorização atual e redigem/negam campos
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI44-P01 · UI44: Medir sensibilidade sem apresentar certeza artificial

**Prioridade:** P1 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J02, J08 · **Superfície:** UI44 · **Rota:** `/orchestra/sf-portfolio/sensitivity/:caseRef/:resultRef` · **Teste-fonte:** u19

> Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero medir sensibilidade sem apresentar certeza artificial para tomar a próxima ação com prova e governança.

**Dados e contexto:** SENS-EDI-01 · EURUSD 1.08 ±0.05

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: SENS-EDI-01 · EURUSD 1.08 ±0.05. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir sensibilidade do cenário R-001
3. Definir mudança de FX 1.03/1.13 com unidade
4. Recalcular impacto da cotação B sobre decisão
5. Comparar intervalos e restrições
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- B=28840 USD em 1.03 e 31640 USD em 1.13
- Limites e moeda são visíveis
- Mudança de sensibilidade não altera FX oficial
- Limite não suportado é reportado como não calculável
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI44-N01 · UI44: contraprova — Entrada usa taxa -1, NaN ou unidade percentual misturada

**Prioridade:** P1 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J02, J08 · **Superfície:** UI44 · **Rota:** `/orchestra/sf-portfolio/sensitivity/:caseRef/:resultRef` · **Teste-fonte:** u19

> Como QA adversarial, quero desafiar Sensibilidade no contexto SENS-EDI-01 · EURUSD 1.08 ±0.05 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** SENS-EDI-01 · EURUSD 1.08 ±0.05

**Dado que**
- Story SF-UI44-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Entrada usa taxa -1, NaN ou unidade percentual misturada
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Validação recusa e mantém cálculo anterior
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI45-P01 · UI45: Selecionar BI com fontes autorizadas de múltiplas áreas

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J02 · **Superfície:** UI45 · **Rota:** `/orchestra/sf-bi` · **Teste-fonte:** u20, u21, u22

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero selecionar BI com fontes autorizadas de múltiplas áreas para tomar a próxima ação com prova e governança.

**Dados e contexto:** BI-EXEC-01 · orçamento, riscos, PR, backlog

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: BI-EXEC-01 · orçamento, riscos, PR, backlog. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir catálogo BI e conferir visões habilitadas por papel
3. Selecionar BI-EXEC-01 para período setembro/2026
4. Conferir cobertura de origem e atualização
5. Abrir drilldown de OPEX
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Catálogo não lista fontes proibidas
- Fonte parcial não é disfarçada de total completo
- Moedas/períodos compatíveis estão rotulados
- Drilldown respeita grants do usuário
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI45-N01 · UI45: contraprova — Viewer procura visão de talentos que não possui grant

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J02 · **Superfície:** UI45 · **Rota:** `/orchestra/sf-bi` · **Teste-fonte:** u20, u21, u22

> Como QA adversarial, quero desafiar Catálogo BI no contexto BI-EXEC-01 · orçamento, riscos, PR, backlog para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** BI-EXEC-01 · orçamento, riscos, PR, backlog

**Dado que**
- Story SF-UI45-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Viewer procura visão de talentos que não possui grant
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Catálogo ou requisição direta não revela dados, títulos privados ou contagem sensível
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI46-P01 · UI46: Explicar um número do BI até a linha de origem

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J02 · **Superfície:** UI46 · **Rota:** `/orchestra/sf-bi/:viewId` · **Teste-fonte:** u20, u21, u22

> Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero explicar um número do BI até a linha de origem para tomar a próxima ação com prova e governança.

**Dados e contexto:** BI-OPEX-01 · USD590000; linha OPEX-LIC-01

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: BI-OPEX-01 · USD590000; linha OPEX-LIC-01. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir visual BI-OPEX-01
3. Clicar no delta da licença e rastrear até linha OPEX
4. Comparar com versão what-if e conferir query/updatedAt
5. Voltar ao BI sem perder competência e versão
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- 590000 e deltas reconciliam com Planner
- Drilldown traz sourceRef/version/period
- Revisão por ator conserva filtros
- Nenhuma transformação oculta missing como zero
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI46-N01 · UI46: contraprova — Linha de origem é revogada após renderização do gráfico

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J02 · **Superfície:** UI46 · **Rota:** `/orchestra/sf-bi/:viewId` · **Teste-fonte:** u20, u21, u22

> Como QA adversarial, quero desafiar Visual BI e drilldown no contexto BI-OPEX-01 · USD590000; linha OPEX-LIC-01 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** BI-OPEX-01 · USD590000; linha OPEX-LIC-01

**Dado que**
- Story SF-UI46-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Linha de origem é revogada após renderização do gráfico
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Drilldown refaz autorização e não devolve linha privada por cache
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI47-P01 · UI47: Organizar com antecedência reunião global de TI

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J05 · **Superfície:** UI47 · **Rota:** `/orchestra/sf-reviews/agenda` · **Teste-fonte:** u25

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero organizar com antecedência reunião global de TI para tomar a próxima ação com prova e governança.

**Dados e contexto:** REV-EXEC-NOV · 25 projetos + budget + risks + PR

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: REV-EXEC-NOV · 25 projetos + budget + risks + PR. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Criar pauta com blocos de budget, portfolio, security e procurement
3. Escolher períodos distintos e rotular cada competência
4. Preservar snapshot da pauta
5. Conferir versões/fonte/quantidade antes de apresentar
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- 25 projetos aparecem exatamente uma vez
- Competências diferentes são explícitas
- Snapshot possui reviewRef e revisão imutável
- Criar pauta não muda dados de domínio
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI47-N01 · UI47: contraprova — Dois itens de projeto têm nomes idênticos e um item está sem origem

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J05 · **Superfície:** UI47 · **Rota:** `/orchestra/sf-reviews/agenda` · **Teste-fonte:** u25

> Como QA adversarial, quero desafiar Seleção da pauta no contexto REV-EXEC-NOV · 25 projetos + budget + risks + PR para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** REV-EXEC-NOV · 25 projetos + budget + risks + PR

**Dado que**
- Story SF-UI47-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Dois itens de projeto têm nomes idênticos e um item está sem origem
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Snapshot exige IDs distintos, bloqueia/explicita ausência em vez de omitir silenciosamente
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI48-P01 · UI48: Apresentar revisão histórica com fidelidade mesmo após mudança de dados

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J05 · **Superfície:** UI48 · **Rota:** `/orchestra/sf-reviews/reviews/:reviewRef` · **Teste-fonte:** u32

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero apresentar revisão histórica com fidelidade mesmo após mudança de dados para tomar a próxima ação com prova e governança.

**Dados e contexto:** REV-EXEC-NOV/R1 · 25 projetos · nota longa P-004

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: REV-EXEC-NOV/R1 · 25 projetos · nota longa P-004. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir revisão preservada R1 em modo apresentação
3. Exibir 25 projetos e notas extensas
4. Alterar a fonte original P-004 em sessão separada
5. Reabrir R1 e conferir estabilidade textual e numérica
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- R1 mantém 25 projetos e valores originais sem recomputação
- Ordem e texto não mudam
- Acesso é revalidado na releitura
- Nova revisão precisa receber outro ID
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI48-N01 · UI48: contraprova — Sessão de viewer é revogada enquanto apresentação está aberta

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J05 · **Superfície:** UI48 · **Rota:** `/orchestra/sf-reviews/reviews/:reviewRef` · **Teste-fonte:** u32

> Como QA adversarial, quero desafiar Revisões preservadas no contexto REV-EXEC-NOV/R1 · 25 projetos · nota longa P-004 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** REV-EXEC-NOV/R1 · 25 projetos · nota longa P-004

**Dado que**
- Story SF-UI48-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Sessão de viewer é revogada enquanto apresentação está aberta
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Refresh e link direto bloqueiam material e não retêm dados sensíveis no cliente
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI49-P01 · UI49: Comparar duas revisões sem confundir mudança e ausência

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J05 · **Superfície:** UI49 · **Rota:** `/orchestra/sf-reviews/compare` · **Teste-fonte:** u32

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero comparar duas revisões sem confundir mudança e ausência para tomar a próxima ação com prova e governança.

**Dados e contexto:** REV-EXEC-NOV/R1 vs R2 · CAPEX P-009 → 91827

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: REV-EXEC-NOV/R1 vs R2 · CAPEX P-009 → 91827. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Selecionar R1 e R2 com competências conhecidas
3. Comparar projetos, números e notas
4. Conferir diferença entre zero, null, ausência e 91827
5. Abrir detalhe de uma mudança e verificar origem
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Deltas têm unidade e sinais corretos
- Mudança só textual é identificada separadamente
- Comparação incompatível é declarada, não somada
- Fontes e timestamps preservados
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI49-N01 · UI49: contraprova — Comparar R1 USD setembro com R2 EUR outubro sem FX declarada

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J05 · **Superfície:** UI49 · **Rota:** `/orchestra/sf-reviews/compare` · **Teste-fonte:** u32

> Como QA adversarial, quero desafiar Comparar revisões no contexto REV-EXEC-NOV/R1 vs R2 · CAPEX P-009 → 91827 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** REV-EXEC-NOV/R1 vs R2 · CAPEX P-009 → 91827

**Dado que**
- Story SF-UI49-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Comparar R1 USD setembro com R2 EUR outubro sem FX declarada
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Comparação financeira é classificada incompatível ou explicitamente convertida conforme contrato
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI50-P01 · UI50: Entregar slides e documento que reproduzem revisão auditada

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J05 · **Superfície:** UI50 · **Rota:** `/orchestra/sf-reviews/reports/:reviewRef` · **Teste-fonte:** u33

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero entregar slides e documento que reproduzem revisão auditada para tomar a próxima ação com prova e governança.

**Dados e contexto:** REV-EXEC-NOV/R1 · report DOCX/PPTX

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: REV-EXEC-NOV/R1 · report DOCX/PPTX. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir relatório de R1 e solicitar DOCX e PPTX
3. Aguardar status terminal do job sem tratar started como sucesso
4. Baixar arquivo gerado e abrir externamente
5. Conferir 25 projetos, valores e notas com R1
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Arquivos existem, são legíveis e têm revisão R1 identificada
- Dados e ordem coincidem com snapshot, não com fonte atual
- Links respeitam revogação
- Falhas/timeout deixam status e sem download fantasma
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI50-N01 · UI50: contraprova — Revogar direito de export de um usuário após gerar PDF/DOCX

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J05 · **Superfície:** UI50 · **Rota:** `/orchestra/sf-reviews/reports/:reviewRef` · **Teste-fonte:** u33

> Como QA adversarial, quero desafiar Exportar relatório no contexto REV-EXEC-NOV/R1 · report DOCX/PPTX para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** REV-EXEC-NOV/R1 · report DOCX/PPTX

**Dado que**
- Story SF-UI50-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Revogar direito de export de um usuário após gerar PDF/DOCX
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Download posterior recusa a permissão atual, mesmo com URL original
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI51-P01 · UI51: Ligar registros de áreas sem supor equivalência por título

**Prioridade:** P1 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J01, J06 · **Superfície:** UI51 · **Rota:** `/orchestra/sf-work/relations/:relationRef` · **Teste-fonte:** u44

> Como Caio, líder/contribuidor de TI, quero ligar registros de áreas sem supor equivalência por título para tomar a próxima ação com prova e governança.

**Dados e contexto:** REL-EDI-01 · HOT-EDI-07 ↔ PR-32000 ↔ P-004

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: REL-EDI-01 · HOT-EDI-07 ↔ PR-32000 ↔ P-004. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir relações e selecionar HOT-EDI-07
3. Adicionar relação com PR-32000 por ref canônico
4. Criar segundo vínculo P-004
5. Validar navegação de cada ponta após salvar
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Refs são tipadas e diferenciam domínio
- Card mostra ambas origens e permissões
- Repetir criação não duplica relação
- Não há mutação no source somente pelo vínculo
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI51-N01 · UI51: contraprova — Usar string de título “EDI Santos” em vez de ref canônico

**Prioridade:** P1 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J01, J06 · **Superfície:** UI51 · **Rota:** `/orchestra/sf-work/relations/:relationRef` · **Teste-fonte:** u44

> Como QA adversarial, quero desafiar Relações entre registros no contexto REL-EDI-01 · HOT-EDI-07 ↔ PR-32000 ↔ P-004 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** REL-EDI-01 · HOT-EDI-07 ↔ PR-32000 ↔ P-004

**Dado que**
- Story SF-UI51-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Usar string de título “EDI Santos” em vez de ref canônico
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Handler não aceita associação ambígua ou forjada
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI52-P01 · UI52: Registrar discussão sobre bloqueio técnico sem aprovar orçamento

**Prioridade:** P1 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J01, J06 · **Superfície:** UI52 · **Rota:** `/orchestra/sf-work/threads/:threadRef` · **Teste-fonte:** u44

> Como Caio, líder/contribuidor de TI, quero registrar discussão sobre bloqueio técnico sem aprovar orçamento para tomar a próxima ação com prova e governança.

**Dados e contexto:** THREAD-EDI-01 · HOT-EDI-07 · comentário de Caio

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: THREAD-EDI-01 · HOT-EDI-07 · comentário de Caio. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir thread do HOT-EDI-07
3. Enviar comentário documentando atraso de fornecedor
4. Responder como Sofie com dado financeiro autorizado
5. Consultar histórico e links em nova sessão
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Mensagens têm autor e horário, sem edição retroativa invisível
- Thread vincula um registro correto
- Resposta não é aprovação Finance
- Leitor sem acesso ao caso não recebe conteúdo da thread
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI52-N01 · UI52: contraprova — Comentário contém link para documento revogado

**Prioridade:** P1 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J01, J06 · **Superfície:** UI52 · **Rota:** `/orchestra/sf-work/threads/:threadRef` · **Teste-fonte:** u44

> Como QA adversarial, quero desafiar Thread contextual no contexto THREAD-EDI-01 · HOT-EDI-07 · comentário de Caio para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** THREAD-EDI-01 · HOT-EDI-07 · comentário de Caio

**Dado que**
- Story SF-UI52-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Comentário contém link para documento revogado
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Preview e histórico não incluem cópia persistente do documento privado
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI53-P01 · UI53: Confirmar que revisão foi feita sem falsificar mudança

**Prioridade:** P1 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J01, J06 · **Superfície:** UI53 · **Rota:** `/orchestra/sf-work/confirmations/:selectionRef` · **Teste-fonte:** u44

> Como Caio, líder/contribuidor de TI, quero confirmar que revisão foi feita sem falsificar mudança para tomar a próxima ação com prova e governança.

**Dados e contexto:** CONFIRM-EDI-01 · TASK-023 · versão observada v3

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: CONFIRM-EDI-01 · TASK-023 · versão observada v3. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir confirmação de seleção TASK-023
3. Ler versão v3 da fonte antes de confirmar
4. Escolher “sem alteração” com justificativa
5. Reabrir fila e verificar registro de confirmação
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Confirmação grava versão realmente vista
- Não altera valores financeiros
- Tarefa não reaparece sem mudança material
- Outra competência permanece independente
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI53-N01 · UI53: contraprova — Terceiro modifica TASK-023 para v4 antes de confirmação v3

**Prioridade:** P1 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J01, J06 · **Superfície:** UI53 · **Rota:** `/orchestra/sf-work/confirmations/:selectionRef` · **Teste-fonte:** u44

> Como QA adversarial, quero desafiar Confirmar sem alteração no contexto CONFIRM-EDI-01 · TASK-023 · versão observada v3 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** CONFIRM-EDI-01 · TASK-023 · versão observada v3

**Dado que**
- Story SF-UI53-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Terceiro modifica TASK-023 para v4 antes de confirmação v3
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Conflito informado e obrigação de reabrir v4 sem aplicar confirmação falsa
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI54-P01 · UI54: Encaminhar decisão sobre assunto crítico de modo governado

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J01, J05 · **Superfície:** UI54 · **Rota:** `/orchestra/sf-dashboard/hot-topics/proposals/:proposalRef` · **Teste-fonte:** u38

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero encaminhar decisão sobre assunto crítico de modo governado para tomar a próxima ação com prova e governança.

**Dados e contexto:** PROPOSAL-EDI-07 · HOT-EDI-07 · LEADER Caio

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: PROPOSAL-EDI-07 · HOT-EDI-07 · LEADER Caio. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir proposta vinculada a HOT-EDI-07
3. Inspecionar mudança preparada, responsável e origem
4. Confirmar encaminhamento para Caio
5. Consultar receipt e Meu trabalho do destinatário
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- A proposta tem ID e versão de origem
- Exatamente uma ação é aberta para Caio
- Efeito não aprova compra nem edita Planner
- Retry retorna recibo da aplicação original
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI54-N01 · UI54: contraprova — Duas confirmações idênticas em abas paralelas

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J01, J05 · **Superfície:** UI54 · **Rota:** `/orchestra/sf-dashboard/hot-topics/proposals/:proposalRef` · **Teste-fonte:** u38

> Como QA adversarial, quero desafiar Encaminhar Hot Topic no contexto PROPOSAL-EDI-07 · HOT-EDI-07 · LEADER Caio para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** PROPOSAL-EDI-07 · HOT-EDI-07 · LEADER Caio

**Dado que**
- Story SF-UI54-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Duas confirmações idênticas em abas paralelas
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Deduplicação por attempt/ID produz no máximo um encaminhamento
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI55-P01 · UI55: Carregar workbook de TI com prévia segura e auditável

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J03 · **Superfície:** UI55 · **Rota:** `/orchestra/sf-imports/new` · **Teste-fonte:** u23

> Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero carregar workbook de TI com prévia segura e auditável para tomar a próxima ação com prova e governança.

**Dados e contexto:** IMPORT-OPEX-SEP26.xlsx · 12 linhas · centro IT-BR

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: IMPORT-OPEX-SEP26.xlsx · 12 linhas · centro IT-BR. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Selecionar destino Dashboard/Planner admitido pelo produto
3. Enviar workbook IMPORT-OPEX-SEP26.xlsx com linhas válidas/invalidas
4. Solicitar preview antes de qualquer commit
5. Registrar quantidade, digest e origem
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Upload não grava transação financeira
- Retorno registra aceitação/rejeição por linha
- Preview preserva valores originais e revisões
- A operação usa sessão autorizada e formato realmente suportado
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI55-N01 · UI55: contraprova — Enviar arquivo com macro, extensão falsa ou MIME incorreto

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J03 · **Superfície:** UI55 · **Rota:** `/orchestra/sf-imports/new` · **Teste-fonte:** u23

> Como QA adversarial, quero desafiar Arquivos/destino de import no contexto IMPORT-OPEX-SEP26.xlsx · 12 linhas · centro IT-BR para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** IMPORT-OPEX-SEP26.xlsx · 12 linhas · centro IT-BR

**Dado que**
- Story SF-UI55-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Enviar arquivo com macro, extensão falsa ou MIME incorreto
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Rejeição file-not-accepted é clara, sem 200 enganoso ou commit
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI56-P01 · UI56: Decidir o impacto de um import antes de aplicar

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J03 · **Superfície:** UI56 · **Rota:** `/orchestra/sf-imports/:manifestId/preview` · **Teste-fonte:** u23

> Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero decidir o impacto de um import antes de aplicar para tomar a próxima ação com prova e governança.

**Dados e contexto:** IMPORT-OPEX-SEP26 · 10 valid/1 duplicate/1 invalid synthetic

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: IMPORT-OPEX-SEP26 · 10 valid/1 duplicate/1 invalid synthetic. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir manifestId da prévia versionada
3. Conferir 10 linhas válidas, 1 duplicata e 1 inválida
4. Comparar inserts, updates e removals permitidos
5. Corrigir a fonte e pedir nova prévia antes de aplicar
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Prévias não alteram fonte
- Invalid/duplicate visíveis e não ignorados silenciosamente
- O digest mostra versão dos dados
- Revisão de fonte obriga novo manifesto
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI56-N01 · UI56: contraprova — Modificar linha fonte após preview e confirmar versão stale

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J03 · **Superfície:** UI56 · **Rota:** `/orchestra/sf-imports/:manifestId/preview` · **Teste-fonte:** u23

> Como QA adversarial, quero desafiar Prévia/impacto de import no contexto IMPORT-OPEX-SEP26 · 10 valid/1 duplicate/1 invalid synthetic para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** IMPORT-OPEX-SEP26 · 10 valid/1 duplicate/1 invalid synthetic

**Dado que**
- Story SF-UI56-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Modificar linha fonte após preview e confirmar versão stale
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- 409/422 conforme contrato, nenhuma atualização parcial
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI57-P01 · UI57: Comprovar que uma importação aplicou uma só vez

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J03 · **Superfície:** UI57 · **Rota:** `/orchestra/sf-imports/:manifestId/receipt` · **Teste-fonte:** u23

> Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero comprovar que uma importação aplicou uma só vez para tomar a próxima ação com prova e governança.

**Dados e contexto:** IMPORT-OPEX-SEP26 · manifest digest M1 · attempt A1

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: IMPORT-OPEX-SEP26 · manifest digest M1 · attempt A1. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir manifest M1 validado e confirmar Apply
3. Observar resposta/receipt e reler Planner
4. Simular perda de resposta e consultar A1
5. Abrir histórico do import e conferir contagem exata
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- One Apply = one atomic business effect
- Recibo reporta 10 linhas aplicáveis ou falha total conforme contrato
- Repetir consulta não duplica efeitos
- Audit identifica actor, digest e versão aplicados
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI57-N01 · UI57: contraprova — Repetir Apply com mesmo attempt ID e payload alterado

**Prioridade:** P0 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J03 · **Superfície:** UI57 · **Rota:** `/orchestra/sf-imports/:manifestId/receipt` · **Teste-fonte:** u23

> Como QA adversarial, quero desafiar Aplicação/recibo de import no contexto IMPORT-OPEX-SEP26 · manifest digest M1 · attempt A1 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** IMPORT-OPEX-SEP26 · manifest digest M1 · attempt A1

**Dado que**
- Story SF-UI57-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Repetir Apply com mesmo attempt ID e payload alterado
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Rejeitar colisão de idempotency, mantendo receipt anterior e zero novo commit
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI58-P01 · UI58: Registrar documento com fonte e classificação adequadas

**Prioridade:** P0 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J05 · **Superfície:** UI58 · **Rota:** `/orchestra/sf-documents` · **Teste-fonte:** u24

> Como Caio, líder/contribuidor de TI, quero registrar documento com fonte e classificação adequadas para tomar a próxima ação com prova e governança.

**Dados e contexto:** DOC-EDI-01 · relatório sintético de incidente de integração

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: DOC-EDI-01 · relatório sintético de incidente de integração. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir catálogo Documentos e adicionar DOC-EDI-01
3. Preencher classificação e vínculo P-004
4. Inspecionar metadata, autor e integridade
5. Abrir extração em fluxo autorizado
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Documento tem docRef, digest e origem
- Conteúdo não se publica automaticamente no BI
- Viewer não autorizado não vê trechos ou filename privado
- Metadados identificam versionamento
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI58-N01 · UI58: contraprova — Enviar documento de outro tenant ou formato não aceito

**Prioridade:** P0 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J05 · **Superfície:** UI58 · **Rota:** `/orchestra/sf-documents` · **Teste-fonte:** u24

> Como QA adversarial, quero desafiar Catálogo de documentos no contexto DOC-EDI-01 · relatório sintético de incidente de integração para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** DOC-EDI-01 · relatório sintético de incidente de integração

**Dado que**
- Story SF-UI58-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Enviar documento de outro tenant ou formato não aceito
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Sem indexar, extrair ou persistir conteúdo fora do escopo
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI59-P01 · UI59: Validar trechos extraídos antes de usá-los como evidência

**Prioridade:** P0 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J05 · **Superfície:** UI59 · **Rota:** `/orchestra/sf-documents/:documentRef/evidence` · **Teste-fonte:** u24

> Como Caio, líder/contribuidor de TI, quero validar trechos extraídos antes de usá-los como evidência para tomar a próxima ação com prova e governança.

**Dados e contexto:** DOC-EDI-01 · trecho “6 dias de atraso”

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: DOC-EDI-01 · trecho “6 dias de atraso”. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir evidências candidatas extraídas
3. Inspecionar trecho, página, score e contexto
4. Rejeitar candidato sem suporte e confirmar candidato válido
5. Comparar estado pending vs confirmed
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Candidato não confirmado não é fato
- Confirmação registra humano, trecho, origem e revisão
- Trecho de evidência não altera contrato nem PR
- Só dados autorizados são visíveis
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI59-N01 · UI59: contraprova — Extração atribui prazo de 60 dias por leitura errada do documento

**Prioridade:** P0 · **Ator:** Caio, líder/contribuidor de TI · **Jornadas:** J05 · **Superfície:** UI59 · **Rota:** `/orchestra/sf-documents/:documentRef/evidence` · **Teste-fonte:** u24

> Como QA adversarial, quero desafiar Extração/confirmação no contexto DOC-EDI-01 · trecho “6 dias de atraso” para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** DOC-EDI-01 · trecho “6 dias de atraso”

**Dado que**
- Story SF-UI59-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Extração atribui prazo de 60 dias por leitura errada do documento
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Revisor rejeita candidato e sistema não o promove a fato
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI60-P01 · UI60: Usar somente evidências confirmadas em cenário

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J05 · **Superfície:** UI60 · **Rota:** `/orchestra/sf-documents/:documentRef/scenario` · **Teste-fonte:** u24

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero usar somente evidências confirmadas em cenário para tomar a próxima ação com prova e governança.

**Dados e contexto:** DOC-EDI-01 confirmado ↔ SCN-PORT-01

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: DOC-EDI-01 confirmado ↔ SCN-PORT-01. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir documento para cenário
3. Selecionar somente evidência confirmada
4. Relacionar evidência a premissa do cenário
5. Inspecionar rastreabilidade e rever cenário
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Cenário aponta para docRef/segmentRef, não texto sem origem
- Não muda documento original
- Revogação impede seguir referência privada
- Sem confirmação humana, contribuição permanece inativa
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI60-N01 · UI60: contraprova — Usar trecho pending como razão para aprovação

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J05 · **Superfície:** UI60 · **Rota:** `/orchestra/sf-documents/:documentRef/scenario` · **Teste-fonte:** u24

> Como QA adversarial, quero desafiar Documento para cenário no contexto DOC-EDI-01 confirmado ↔ SCN-PORT-01 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** DOC-EDI-01 confirmado ↔ SCN-PORT-01

**Dado que**
- Story SF-UI60-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Usar trecho pending como razão para aprovação
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Produto bloqueia ou marca explicitamente não aprovado, sem efeito de decisão
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI61-P01 · UI61: Identificar sinal relevante e descartar falso positivo

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J07 · **Superfície:** UI61 · **Rota:** `/orchestra/sf-memory/signals` · **Teste-fonte:** u26

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero identificar sinal relevante e descartar falso positivo para tomar a próxima ação com prova e governança.

**Dados e contexto:** SIG-EDI-07 · atraso de 6 dias vs limiar 3

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: SIG-EDI-07 · atraso de 6 dias vs limiar 3. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Sinais/materialidade
3. Filtrar por risco e período
4. Inspecionar SIG-EDI-07 e evidências de origem
5. Classificar materialidade e encaminhar para revisão humana
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- 6>3 gera sinal material conforme política explícita
- Fonte e limiar são auditáveis
- Sinal não vira decisão automática
- Outros sinais sem fontes não são classificados como certos
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI61-N01 · UI61: contraprova — Limiar ausente e sinal com unidade diferente

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J07 · **Superfície:** UI61 · **Rota:** `/orchestra/sf-memory/signals` · **Teste-fonte:** u26

> Como QA adversarial, quero desafiar Sinais/materialidade no contexto SIG-EDI-07 · atraso de 6 dias vs limiar 3 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** SIG-EDI-07 · atraso de 6 dias vs limiar 3

**Dado que**
- Story SF-UI61-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Limiar ausente e sinal com unidade diferente
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Classificação fica indeterminada, sem severidade fabricada
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI62-P01 · UI62: Encontrar casos anteriores semelhantes sem vazar dados

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J07 · **Superfície:** UI62 · **Rota:** `/orchestra/sf-memory/cases` · **Teste-fonte:** u26

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero encontrar casos anteriores semelhantes sem vazar dados para tomar a próxima ação com prova e governança.

**Dados e contexto:** CASE-EDI-01 ↔ CASE-EDI-OLD-02 · score de similaridade

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: CASE-EDI-01 ↔ CASE-EDI-OLD-02 · score de similaridade. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Casos semelhantes a partir de CASE-EDI-01
3. Inspecionar score e justificativa da correspondência
4. Abrir caso autorizado e retornar
5. Comparar com resultado de u26 + teste especializado similarity217/ui62
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Similaridade não é equivalência nem decisão automática
- Scores mostram origem, versão e critérios
- Caso inacessível não revela título ou snippet privado
- Busca não reabre acesso revogado
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI62-N01 · UI62: contraprova — Caso de outro tenant com título muito semelhante

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J07 · **Superfície:** UI62 · **Rota:** `/orchestra/sf-memory/cases` · **Teste-fonte:** u26

> Como QA adversarial, quero desafiar Casos semelhantes no contexto CASE-EDI-01 ↔ CASE-EDI-OLD-02 · score de similaridade para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** CASE-EDI-01 ↔ CASE-EDI-OLD-02 · score de similaridade

**Dado que**
- Story SF-UI62-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Caso de outro tenant com título muito semelhante
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Resultado é omitido/redigido, mesmo se semanticamente próximo
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI63-P01 · UI63: Comparar resultado observado com previsão e aprender sem reescrever história

**Prioridade:** P1 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J07 · **Superfície:** UI63 · **Rota:** `/orchestra/sf-memory/outcomes/:selectionRef` · **Teste-fonte:** u26

> Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero comparar resultado observado com previsão e aprender sem reescrever história para tomar a próxima ação com prova e governança.

**Dados e contexto:** OUTCOME-EDI-01 · previsão 6 dias · observado 9 dias

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: OUTCOME-EDI-01 · previsão 6 dias · observado 9 dias. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Previsto versus observado da decisão CASE-EDI-01
3. Selecionar seleção/receipt versionada
4. Registrar ou conferir observado 9 dias vs previsto 6
5. Inspecionar delta e fontes com período consistente
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Desvio de prazo = +3 dias
- Previsão preservada não é recalculada com observado
- Diferença de unidade e fonte incompleta visíveis
- Lições não concedem aprovação automática futura
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI63-N01 · UI63: contraprova — Observed ainda não publicado ou não confiável

**Prioridade:** P1 · **Ator:** Sofie, Finance (conta existente quando tenant de demonstração for aprovado) · **Jornadas:** J07 · **Superfície:** UI63 · **Rota:** `/orchestra/sf-memory/outcomes/:selectionRef` · **Teste-fonte:** u26

> Como QA adversarial, quero desafiar Previsto versus observado no contexto OUTCOME-EDI-01 · previsão 6 dias · observado 9 dias para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** OUTCOME-EDI-01 · previsão 6 dias · observado 9 dias

**Dado que**
- Story SF-UI63-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Observed ainda não publicado ou não confiável
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Tela distingue absent/pending de delta zero
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI64-P01 · UI64: Selecionar rotina verificável antes de delegar análise

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J07 · **Superfície:** UI64 · **Rota:** `/orchestra/sf-routines` · **Teste-fonte:** u27

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero selecionar rotina verificável antes de delegar análise para tomar a próxima ação com prova e governança.

**Dados e contexto:** ROUTINE-EDI-RISK-v1 · escopo P-004 e R-07

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: ROUTINE-EDI-RISK-v1 · escopo P-004 e R-07. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir catálogo de rotinas e escolher recipe publicada
3. Conferir digest, owner, escopo, custo/modelo e permissões
4. Preparar input com fontes autorizadas e conferir preview
5. Admitir execução uma vez
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- A receita usa versão/digest fixados
- Admissão devolve runRef e state real
- Ausência de modelo/skill fica unavailable, não inventa resultado
- Rotina não tem poderes sobre mutações financeiras sem confirmação
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI64-N01 · UI64: contraprova — Trocar digest da recipe entre preview e run

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J07 · **Superfície:** UI64 · **Rota:** `/orchestra/sf-routines` · **Teste-fonte:** u27

> Como QA adversarial, quero desafiar Catálogo/admissão de rotinas no contexto ROUTINE-EDI-RISK-v1 · escopo P-004 e R-07 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** ROUTINE-EDI-RISK-v1 · escopo P-004 e R-07

**Dado que**
- Story SF-UI64-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Trocar digest da recipe entre preview e run
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Admissão recusa input stale sem executar receita alterada
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI65-P01 · UI65: Acompanhar um run até conclusão verificável e auditável

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J07 · **Superfície:** UI65 · **Rota:** `/orchestra/sf-routines/runs/:runRef` · **Teste-fonte:** u27

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero acompanhar um run até conclusão verificável e auditável para tomar a próxima ação com prova e governança.

**Dados e contexto:** RUN-EDI-RISK-01 · recipe ROUTINE-EDI-RISK-v1

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: RUN-EDI-RISK-01 · recipe ROUTINE-EDI-RISK-v1. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir execução RUN-EDI-RISK-01
3. Ler estados queued/running/needs-input/completed ou failed
4. Inspecionar saída, provenance e verifier independente
5. Cancelar quando habilitado e conferir efeito terminal
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- started não equivale a success
- Run final tem schema/output verificados quando complete
- Cancelamento tardio não falseia status
- Nenhuma mutação de domínio resulta de texto de agente
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI65-N01 · UI65: contraprova — Provider responde output incompleto e run acaba failed

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J07 · **Superfície:** UI65 · **Rota:** `/orchestra/sf-routines/runs/:runRef` · **Teste-fonte:** u27

> Como QA adversarial, quero desafiar Execução/resultado de rotina no contexto RUN-EDI-RISK-01 · recipe ROUTINE-EDI-RISK-v1 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** RUN-EDI-RISK-01 · recipe ROUTINE-EDI-RISK-v1

**Dado que**
- Story SF-UI65-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Provider responde output incompleto e run acaba failed
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- UI apresenta erro honesto sem elevar recomendação a approved
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI66-P01 · UI66: Entender e controlar recorrência de uma rotina

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J07 · **Superfície:** UI66 · **Rota:** `/orchestra/sf-routines/schedules/:scheduleRef` · **Teste-fonte:** u34

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero entender e controlar recorrência de uma rotina para tomar a próxima ação com prova e governança.

**Dados e contexto:** SCHED-EDI-DAILY · recipe ROUTINE-EDI-RISK-v1 · 08:00 BRT

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: SCHED-EDI-DAILY · recipe ROUTINE-EDI-RISK-v1 · 08:00 BRT. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir schedules e selecionar SCHED-EDI-DAILY
3. Verificar se scheduleDetails.read está realmente disponível
4. Consultar timezone, cron, recipe e última ocorrência
5. Pausar ou editar apenas se port corrente admitir e devolver recibo
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Leitura detalhada mantém timezone explícito
- started do schedule é só admissão, não completion do run
- Produtor indisponível mostra capability/unavailable e bloqueia edição
- Histórico de execução relaciona scheduleRef→runRef
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI66-N01 · UI66: contraprova — Port do scheduler não suporta leitura de detalhes atuais

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J07 · **Superfície:** UI66 · **Rota:** `/orchestra/sf-routines/schedules/:scheduleRef` · **Teste-fonte:** u34

> Como QA adversarial, quero desafiar Recorrência no contexto SCHED-EDI-DAILY · recipe ROUTINE-EDI-RISK-v1 · 08:00 BRT para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** SCHED-EDI-DAILY · recipe ROUTINE-EDI-RISK-v1 · 08:00 BRT

**Dado que**
- Story SF-UI66-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Port do scheduler não suporta leitura de detalhes atuais
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Sem edição cega nem merge com defaults; ação permanece indisponível
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI67-P01 · UI67: Autenticar em Microsoft e selecionar contexto corporativo válido

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J08 · **Superfície:** UI67 · **Rota:** `/orchestra/sf-home/context` · **Teste-fonte:** u01-host231, shell-guard237

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero autenticar em Microsoft e selecionar contexto corporativo válido para tomar a próxima ação com prova e governança.

**Dados e contexto:** OIDC resource tenant · project SF-LAB · owner CIO

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: OIDC resource tenant · project SF-LAB · owner CIO. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Entrar via OIDC com conta Entra autorizada
3. Inspecionar sessão, contexto e grants atuais sem exibir segredos
4. Trocar instalação/projeto autorizado
5. Deslogar e tentar reabrir deep link anterior
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Claims tid/oid e principal são vinculados ao tenant recurso
- Contexto inclui instalação/projeto/owner atual
- Após logout deep link privado é negado
- local-operator não é fallback em nuvem
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI67-N01 · UI67: contraprova — OIDC assinado de tenant errado, CSRF inválido, nonce ou code replay

**Prioridade:** P0 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J08 · **Superfície:** UI67 · **Rota:** `/orchestra/sf-home/context` · **Teste-fonte:** u01-host231, shell-guard237

> Como QA adversarial, quero desafiar Login/contexto/acesso no contexto OIDC resource tenant · project SF-LAB · owner CIO para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** OIDC resource tenant · project SF-LAB · owner CIO

**Dado que**
- Story SF-UI67-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. OIDC assinado de tenant errado, CSRF inválido, nonce ou code replay
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Autenticação falha fechada, sem sessão válida nem troca de owner
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI68-P01 · UI68: Exportar informação de compras preservando autorização e efeito comprovado

**Prioridade:** P0 · **Ator:** Pedro, buyer Procurement · **Jornadas:** J03 · **Superfície:** UI68 · **Rota:** `/orchestra/sf-imports/exports` · **Teste-fonte:** u23

> Como Pedro, buyer Procurement, quero exportar informação de compras preservando autorização e efeito comprovado para tomar a próxima ação com prova e governança.

**Dados e contexto:** EXPORT-PR-32000 · PO-EDI-01

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: EXPORT-PR-32000 · PO-EDI-01. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Exports de dados/PO
3. Selecionar PO e formato admitido
4. Solicitar export, conferir status terminal e baixar
5. Abrir arquivo e comparar valores com fonte atual/autorizada
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Arquivo existe e mantém IDs, valores e moeda sem erro
- Export interno não comprova envio ao ERP
- Grants e redaction aplicados ao conteúdo
- Link revogado não permite download posterior
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI68-N01 · UI68: contraprova — Buyer perde grant de fornecedor após gerar export

**Prioridade:** P0 · **Ator:** Pedro, buyer Procurement · **Jornadas:** J03 · **Superfície:** UI68 · **Rota:** `/orchestra/sf-imports/exports` · **Teste-fonte:** u23

> Como QA adversarial, quero desafiar Exports de dados/PO no contexto EXPORT-PR-32000 · PO-EDI-01 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** EXPORT-PR-32000 · PO-EDI-01

**Dado que**
- Story SF-UI68-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Buyer perde grant de fornecedor após gerar export
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Revalidação bloqueia download do arquivo antigo e não vaza dados bancários
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI69-P01 · UI69: Operar ferramentas locais sem assumir identidade Entra

**Prioridade:** P0 · **Ator:** Operador local LO-01 · **Jornadas:** J08 · **Superfície:** UI69 · **Rota:** `/orchestra/sf-home/administration` · **Teste-fonte:** u28

> Como Operador local LO-01, quero operar ferramentas locais sem assumir identidade Entra para tomar a próxima ação com prova e governança.

**Dados e contexto:** LOCAL-SF-01 · instalação isolada em localhost

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: LOCAL-SF-01 · instalação isolada em localhost. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir ferramentas locais de administração em ambiente isolated
3. Inspecionar status e comandos de suporte permitidos
4. Executar ação de leitura/diagnóstico com local operator
5. Comparar comportamento ao tentar mesma URL em Azure
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Local tools só existem no contexto local previsto
- Não são atalhos para permissões Microsoft
- Não alteram snapshots corporativos indevidamente
- Acesso e diagnóstico têm trilha se operação causar efeito
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI69-N01 · UI69: contraprova — Enviar token/local-operator por browser hospedado em Azure

**Prioridade:** P0 · **Ator:** Operador local LO-01 · **Jornadas:** J08 · **Superfície:** UI69 · **Rota:** `/orchestra/sf-home/administration` · **Teste-fonte:** u28

> Como QA adversarial, quero desafiar Ferramentas locais de administração no contexto LOCAL-SF-01 · instalação isolada em localhost para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** LOCAL-SF-01 · instalação isolada em localhost

**Dado que**
- Story SF-UI69-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Enviar token/local-operator por browser hospedado em Azure
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Sem fallback de identidade, ação ou tela administrativas recusadas
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI70-P01 · UI70: Observar contribuição de residentes sem imaginar autonomia irrestrita

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J07 · **Superfície:** UI70 · **Rota:** `/orchestra/sf-routines/residents` · **Teste-fonte:** u35

> Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero observar contribuição de residentes sem imaginar autonomia irrestrita para tomar a próxima ação com prova e governança.

**Dados e contexto:** RES-EDI-01 · agente residente de riscos · último run R-014

**Dado que**
- Instalação SF-LAB isolada e dados sintéticos preparados; SHA de produto, ambiente, contexto e role/grants registrados.
- Conta Entra, local ou ator de demonstração realmente autenticado; sem auto-concessão de grants.
- Fixture disponível: RES-EDI-01 · agente residente de riscos · último run R-014. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

**Quando (passos manuais)**
1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Residents e conferir versão da receita e owner
3. Inspecionar último run R-014 com fonte e hora
4. Comparar contribution e decisão humana do CASE-EDI-01
5. Suspender ou rever apenas capability admitida
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

**Então (oráculos verificáveis)**
- Estado do residente se baseia em execução real
- Contribuição não altera PR, Planner ou approval
- Output tem provenance e verificador quando aplicável
- Cancelamento/disable não inventa run completion
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência obrigatória:** screenshot_before, screenshot_after, redacted_network_trace, source_re_read, receipt_or_absence. **Status de origem:** `DESIGNED_NOT_EXECUTED`.


## SF-UI70-N01 · UI70: contraprova — Residente falhou mas UI preserva badge completed anterior

**Prioridade:** P1 · **Ator:** André (persona CIO, simulado no roteiro; conta somente se autorizada) · **Jornadas:** J07 · **Superfície:** UI70 · **Rota:** `/orchestra/sf-routines/residents` · **Teste-fonte:** u35

> Como QA adversarial, quero desafiar Estado/perfil de residentes no contexto RES-EDI-01 · agente residente de riscos · último run R-014 para demonstrar ausência de efeito indevido, vazamento e regressão.

**Dados e contexto:** RES-EDI-01 · agente residente de riscos · último run R-014

**Dado que**
- Story SF-UI70-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Quando (passos manuais)**
1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Residente falhou mas UI preserva badge completed anterior
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

**Então (oráculos verificáveis)**
- Status deve refletir falha/último sucesso de maneira não ambígua
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

**Evidência obrigatória:** before_after_source_hash, redacted_HTTP_status, actor_role_scope, audit_query, screenshot_denial. **Status de origem:** `DESIGNED_NOT_EXECUTED`.

