# Sucafina nativa — inventário e retrabalho das telas

## Quarto bloco — 20 áreas aprovadas e mescladas

O quarto bloco implementa **CAP20–CAP28, UI30–UI32 e UI34–UI41**, com 49 padrões de rota já existentes. O [PR #588](https://github.com/gustavomhss/Orchestra-SF/pull/588) foi aprovado pelo usuário e mesclado em `f2a6c23551289ef8705baea03f8cec2425b8445a`. [Registro verificado do merge](wave-four/MERGE.md).

[Galeria completa da rodada](wave-four/evidence/README.md) · [Resultado e decisões de implementação](WAVE-FOUR.md) · [Validação e limites](wave-four/VALIDATION.md) · [Mapa de áreas, rotas e estados](wave-four/scope.json)

| Situação da campanha | Áreas |
| --- | ---: |
| Rodadas anteriores já mescladas | 21 |
| Áreas deste bloco aprovadas e mescladas | 20 |
| Total implementado e mesclado | **41 de 70** |
| Ainda por retrabalhar | **29** |

| Grupo deste bloco | Áreas | Rotas existentes |
| --- | ---: | ---: |
| Planejamento — Headcount, Alocações, FX, Versões/Comparação | 4 | 14 |
| Compras — Visão geral, Requisições/Sourcing, Aprovações, Fornecedores, Configurações | 5 | 17 |
| Trabalho, Busca e Visões salvas | 3 | 5 |
| Decisões — Intenção, Alternativas, Premissas, Perguntas, Escolha, Alterações, Histórico/Recibos, Análises | 8 | 13 |
| **Total** | **20** | **49** |

O candidato técnico `0550c4bb8fc3b4b4e68561777010ca03483e2391` incorpora `dev 2eeb114266f8b9c9df9bb8f78a02ccf242cdc68b`. O [Gate17](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44972927162) passou **15 checks e 89 regressões**, incluindo tipos completos da aplicação, E2E e CLI. As jornadas usam instalação e produtores originais; a galeria contém **146 capturas revisadas** deste bloco. Decisões passou também após o limite de cinco minutos que antes bloqueava o caso. As origens das imagens e os limites de cada fluxo estão na validação; o usuário aprovou estas vinte áreas após examinar as capturas, e o merge foi confirmado pela API do GitHub.

## Histórico — terceira rodada mesclada

O usuário autorizou a integração de **CAP05–CAP19**: “Vai pro merge, se tiver tudo verde”. A composição com `dev 2a68bcb676ed0c159c5c48130c2413e0e5637a00` passou nas jornadas reais e nos gates técnicos. O [PR #587](https://github.com/gustavomhss/Orchestra-SF/pull/587) foi mesclado em `d9ab14b6d9cab74843b0689d5d67d1c70d45cc02`. Os números desta seção descrevem o fechamento da terceira rodada. Candidato validado: [141336f8](https://github.com/gustavomhss/Orchestra-SF/commit/141336f8b17fe661cb0370ef99a7ff528737ef23).

[Verificação do merge](wave-three/MERGE.md) · [Galeria de 177 capturas](wave-three/evidence/README.md) · [Mapa exato de estados](wave-three/scope.json)

| Situação da campanha | Áreas |
| --- | ---: |
| Rodadas anteriores, mescladas antes deste PR | 6 |
| Áreas deste bloco, com integração autorizada e validada | 15 |
| Total implementado e aceito para integração | **21 de 70** |
| Ainda por retrabalhar | **49** |

As quinze áreas correspondem a 56 rotas cadastradas, 88 estados funcionais exercitados e 79 estados fotografados. A galeria contém 177 imagens, incluindo variantes; nove estados de Finanças foram exercitados sem captura dedicada. A nova verificação da composição executou dez testes do bloco e dois das áreas anteriores, além dos gates técnicos. O inventário distingue área, rota, estado e variante.

## Histórico — segunda rodada aceita e mesclada

**Hot Topics (CAP02), Visão do orçamento (CAP03) e OPEX (CAP04)** foram retrabalhados por três agentes, integrados e verificados na branch [`sf-design-two`](https://github.com/gustavomhss/Orchestra-SF/tree/sf-design-two), criada diretamente de `dev bcdc109326de02e20c01c32ffb6b00bee3ff978d`. Produto verificado: [`5012d7a`](https://github.com/gustavomhss/Orchestra-SF/commit/5012d7adf0e5d02576fe6a0add6f79331a812137).

Veja a [galeria com 39 capturas reais](wave-two/evidence/README.md), incluindo 11 em português; o [resumo da rodada](WAVE-TWO.md) e a [validação](wave-two/VALIDATION.md) registram o resultado. A jornada no navegador, os tipos da aplicação/E2E, as regras e a paridade da paleta passaram. Os seis casos de proteção do rascunho confirmado também passaram.

Após avaliar o resultado, o usuário autorizou a integração das duas rodadas na `dev`. O [PR #583](https://github.com/gustavomhss/Orchestra-SF/pull/583) registra o estado do merge; [DEV-INTEGRATION.md](DEV-INTEGRATION.md) registra a composição e a verificação sobre a `dev` atual. A aprovação explícita anterior de Hoje, Casos/Decisões e Visão executiva permanece preservada. Ao fim da segunda rodada, o inventário tinha **seis áreas retrabalhadas** e **64 para as próximas etapas**. Esses números são históricos; o total atual está no resumo acima.

## Primeiras três telas aprovadas

A primeira entrega foi rejeitada pelo usuário. Esta versão refaz a composição de **Hoje (UI29), Casos/Decisões (UI33) e Visão executiva (CAP01)**. Os testes anteriores não foram tratados como aprovação visual. A [galeria](evidence/README.md) apresenta a aplicação real; [VALIDATION.md](VALIDATION.md) registra resultados e limites.

Branch: [`sf-design-polish`](https://github.com/gustavomhss/Orchestra-SF/tree/sf-design-polish), criada diretamente de `dev` em `948fab6ef2f8bbbcf2c8a6b787755a1d5713e6e1` e sincronizada com `dev 1fd255026dec8e1db1f4342f7ec206a6812b42ea`. Produto desta revisão: [`245e15bf10b5c5287fa9338aa98d0adb28aeda76`](https://github.com/gustavomhss/Orchestra-SF/commit/245e15bf10b5c5287fa9338aa98d0adb28aeda76). A branch compartilhada `dev` não foi alterada pelo agente.

| Tela | Mudança na composição |
| --- | --- |
| Hoje | Previsão em uma faixa compacta; atenção e retomada na coluna principal; riscos e rotinas na lateral; alturas independentes e metadados mais compactos |
| Casos / Decisões | Uma superfície de lista; criação de até 760px com etapas de edição e revisão; lista oculta durante o formulário; volta à lista preserva o rascunho; campos em português completos |
| Visão executiva | Período como barra de ferramentas; financeiro e tabela juntos; indicadores em linhas de rótulo/valor; navegação compacta; ausências explícitas e revisão do editor em uma etapa própria |

Os três agentes responsáveis voltaram a trabalhar, cada um na própria tela. A inspeção das primeiras imagens desta rodada encontrou e corrigiu a cascata que espremia indicadores, a concorrência da lista com o editor e o excesso de altura em atenção. O registro está em [WAVE-ONE.md](WAVE-ONE.md).

As regras e os materiais nativos do Orchestra continuam sendo a referência. O núcleo HuGR e a interface legacy branca/verde estão fora deste redesign. Pequenos reparos necessários de integração, incluindo declarações de tipos herdadas de dev, estão descritos em [INTEGRATION.md](INTEGRATION.md).

## Verificação da primeira rodada aprovada

- **PASS:** jornada real no Chromium, incluindo criação/revisão, retomada de rascunho e revisão/cancelamento/descarte do Executivo — [execução 44913429642](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44913429642).
- **PASS:** tipos da aplicação, tipos E2E, regras do repositório e paridade dos sete arquivos de paleta — [execução 44913434039](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44913434039).
- **28 capturas reais**, com cinco imagens em português, na [galeria](evidence/README.md) e no [manifesto](evidence/manifest.json).

As imagens usam dados isolados de teste. Incluem desktop em claro/escuro, português no tema escuro, janela de notebook com 800px de altura, Casos/Executivo a 320 CSS px e Hoje a 390 CSS px. O formulário de decisão e sua revisão também foram capturados em português. Os limites da matriz estão no relatório; reflow não é apresentado como zoom real.

**Aprovação visual recebida em 21/11/2026:** o usuário respondeu “aprovado” após ver as capturas finais de Hoje (UI29), Decisões (UI33) e Visão executiva (CAP01). O produto aprovado é `245e15bf10b5c5287fa9338aa98d0adb28aeda76`, apresentado com a evidência `032eb5b8b93c3e75dbad3ebf19cd64f8a40f73a6`. Naquele momento, 67 superfícies permaneciam inventariadas. CAP02, CAP03 e CAP04 foram posteriormente retrabalhadas na segunda rodada; naquele momento restavam 64 áreas.

## Exact inventory

The source route registry contains **70 unique surfaces, 165 route patterns and 15 native chapters**. These numbers describe route recognition; they do not prove runtime admission, data availability or visual acceptance. Every entrypoint below exists as a blob in the pinned native source tree. `inventory.json` preserves every route variant and source blob SHA, including create, edit, detail, review, comparison and alias routes.

The first wave follows the first three Sucafina destinations in the source navigation: **Today (UI29), Decisions/Cases (UI33), Executive dashboard (CAP01)**. Wave two continues with Hot Topics (CAP02), Budget Overview (CAP03) and OPEX (CAP04). Wave three implements CAP05–CAP19. Wave four implements CAP20–CAP28, UI30–UI32 and UI34–UI41. The campaign now has 41 implemented and merged areas: 21 from earlier waves and 20 in user-approved PR #588. There are 29 remaining areas. The implemented route scope is 118 of 165 existing patterns; 47 remain. Route coverage is not a claim that every route/state/locale combination was exercised.

| Order | Surface | Screen | Main route | Native source entrypoint |
| --- | --- | --- | --- | --- |
| 1 · wave 1 | UI29 | Hoje / Today | `/orchestra/sf-home` | [`home/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/home/index.tsx) |
| 2 · wave 1 | UI33 | Casos / Decisões | `/orchestra/sf-decisions` | [`decisions/cases/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/decisions/cases/index.tsx) |
| 3 · wave 1 | CAP01 | Dashboard executivo | `/orchestra/sf-dashboard/executive` | [`dashboard/executive/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/executive/index.tsx) |
| 4 · wave 2 | CAP02 | Hot topics | `/orchestra/sf-dashboard/hot-topics` | [`dashboard/hot-topics/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/hot-topics/index.tsx) |
| 5 · wave 2 | CAP03 | Visão de orçamento | `/orchestra/sf-dashboard/budget` | [`dashboard/budget/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/budget/index.tsx) |
| 6 · wave 2 | CAP04 | OPEX — realizado e previsão | `/orchestra/sf-dashboard/opex` | [`dashboard/opex/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/index.tsx) |
| 7 · wave 3 | CAP05 | CAPEX — realizado e previsão | `/orchestra/sf-dashboard/capex` | [`dashboard/capex/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/capex/index.tsx) |
| 8 · wave 3 | CAP06 | Pessoas — visão geral | `/orchestra/sf-people/overview` | [`people/overview/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/people/overview/index.tsx) |
| 9 · wave 3 | CAP07 | Estrutura e membros | `/orchestra/sf-people/structure` | [`people/structure/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/people/structure/index.tsx) |
| 10 · wave 3 | CAP08 | Talentos | `/orchestra/sf-people/talent` | [`people/talent/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/people/talent/index.tsx) |
| 11 · wave 3 | CAP09 | Portfólio — visão geral | `/orchestra/sf-portfolio/overview` | [`portfolio/overview/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/overview/index.tsx) |
| 12 · wave 3 | CAP10 | Projetos | `/orchestra/sf-portfolio/projects` | [`portfolio/projects/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/index.tsx) |
| 13 · wave 3 | CAP11 | Serviço e SLA | `/orchestra/sf-operations/service` | [`operations/service/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/operations/service/index.tsx) |
| 14 · wave 3 | CAP12 | Segurança | `/orchestra/sf-operations/security` | [`operations/security/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/operations/security/index.tsx) |
| 15 · wave 3 | CAP13 | Riscos | `/orchestra/sf-operations/risks` | [`operations/risks/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/operations/risks/index.tsx) |
| 16 · wave 3 | CAP14 | Contratos | `/orchestra/sf-procurement/contracts` | [`procurement/contracts/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/procurement/contracts/index.tsx) |
| 17 · wave 3 | CAP15 | Stakeholders | `/orchestra/sf-operations/stakeholders` | [`operations/stakeholders/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/operations/stakeholders/index.tsx) |
| 18 · wave 3 | CAP16 | Desempenho operacional | `/orchestra/sf-operations/performance` | [`operations/performance/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/operations/performance/index.tsx) |
| 19 · wave 3 | CAP17 | Planner — visão geral | `/orchestra/sf-planner/overview` | [`planner/overview/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/planner/overview/index.tsx) |
| 20 · wave 3 | CAP18 | Planner OPEX | `/orchestra/sf-planner/opex` | [`planner/opex/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/planner/opex/index.tsx) |
| 21 · wave 3 | CAP19 | Planner CAPEX | `/orchestra/sf-planner/capex` | [`planner/capex/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/planner/capex/index.tsx) |
| 22 · wave 4 | CAP20 | Headcount | `/orchestra/sf-planner/headcount` | [`planner/headcount/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/planner/headcount/index.tsx) |
| 23 · wave 4 | CAP21 | Alocações | `/orchestra/sf-planner/allocations` | [`planner/allocations/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/planner/allocations/index.tsx) |
| 24 · wave 4 | CAP22 | Câmbio / FX | `/orchestra/sf-planner/fx` | [`planner/fx/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/planner/fx/index.tsx) |
| 25 · wave 4 | CAP23 | Versões e comparação | `/orchestra/sf-planner/versions` | [`planner/versions/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/planner/versions/index.tsx) |
| 26 · wave 4 | CAP24 | Compras — visão geral | `/orchestra/sf-procurement/overview` | [`procurement/overview/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/procurement/overview/index.tsx) |
| 27 · wave 4 | CAP25 | Requisições, fila e sourcing | `/orchestra/sf-procurement/requests` | [`procurement/requests/page.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx) |
| 28 · wave 4 | CAP26 | Aprovações | `/orchestra/sf-procurement/approvals` | [`procurement/approvals/pr/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/procurement/approvals/pr/index.tsx) |
| 29 · wave 4 | CAP27 | Fornecedores | `/orchestra/sf-procurement/suppliers` | [`procurement/suppliers/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/procurement/suppliers/index.tsx) |
| 30 · wave 4 | CAP28 | Configurações de compras | `/orchestra/sf-procurement/settings` | [`procurement/settings/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/procurement/settings/index.tsx) |
| 31 · wave 4 | UI30 | Meu trabalho | `/orchestra/sf-work` | [`work/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/work/index.tsx) |
| 32 · wave 4 | UI31 | Busca Sucafina | `/orchestra/sf-home/search` | [`search/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/search/index.tsx) |
| 33 · wave 4 | UI32 | Visões salvas | `/orchestra/sf-work/views/:viewId` | [`views/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/views/index.tsx) |
| 34 · wave 4 | UI34 | Intenção do caso | `/orchestra/sf-decisions/:caseRef` | [`decisions/intent/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/decisions/intent/index.tsx) |
| 35 · wave 4 | UI35 | Alternativas | `/orchestra/sf-decisions/:caseRef/alternatives` | [`decisions/alternatives/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/decisions/alternatives/index.tsx) |
| 36 · wave 4 | UI36 | Premissas e divergências | `/orchestra/sf-decisions/:caseRef/assumptions` | [`decisions/assumptions/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/decisions/assumptions/index.tsx) |
| 37 · wave 4 | UI37 | Perguntas e respostas | `/orchestra/sf-decisions/:caseRef/questions` | [`decisions/questions/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/decisions/questions/index.tsx) |
| 38 · wave 4 | UI38 | Escolha da decisão | `/orchestra/sf-decisions/:caseRef/choice` | [`decisions/choice/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/decisions/choice/index.tsx) |
| 39 · wave 4 | UI39 | Alterações preparadas | `/orchestra/sf-decisions/:caseRef/changes/:changeRef` | [`decisions/changes/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/decisions/changes/index.tsx) |
| 40 · wave 4 | UI40 | Histórico e recibos | `/orchestra/sf-decisions/:caseRef/receipts/:receiptRef` | [`decisions/receipts/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/decisions/receipts/index.tsx) |
| 41 · wave 4 | UI41 | Análises | `/orchestra/sf-decisions/:caseRef/analyses/:analysisRef` | [`decisions/analyses/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/decisions/analyses/index.tsx) |
| 42 | UI42 | Cenários de portfólio — lista | `/orchestra/sf-portfolio/scenarios/:caseRef` | [`portfolio/scenarios/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/scenarios/index.tsx) |
| 43 | UI43 | Cenário de portfólio — detalhe | `/orchestra/sf-portfolio/scenarios/:caseRef/results/:resultRef` | [`portfolio/scenarios/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/scenarios/index.tsx) |
| 44 | UI44 | Sensibilidade | `/orchestra/sf-portfolio/sensitivity/:caseRef/:resultRef` | [`portfolio/sensitivity/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/sensitivity/index.tsx) |
| 45 | UI45 | Catálogo de BI | `/orchestra/sf-bi` | [`bi/catalog/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/bi/catalog/index.tsx) |
| 46 | UI46 | Visão contextual de BI | `/orchestra/sf-bi/:viewId` | [`bi/catalog/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/bi/catalog/index.tsx) |
| 47 | UI47 | Agenda de revisão | `/orchestra/sf-reviews/agenda` | [`reviews/agenda/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/reviews/agenda/index.tsx) |
| 48 | UI48 | Revisões preservadas | `/orchestra/sf-reviews/reviews/:reviewRef` | [`reviews/preserved/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx) |
| 49 | UI49 | Comparação de revisões | `/orchestra/sf-reviews/compare` | [`reviews/compare/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/reviews/compare/index.tsx) |
| 50 | UI50 | Relatórios | `/orchestra/sf-reviews/reports/:reviewRef` | [`reviews/reports/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/reviews/reports/index.tsx) |
| 51 | UI51 | Relações | `/orchestra/sf-work/relations/:relationRef` | [`collaboration-pages/relations/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/collaboration-pages/relations/index.tsx) |
| 52 | UI52 | Conversas e threads | `/orchestra/sf-work/threads/:threadRef` | [`collaboration-pages/threads/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/collaboration-pages/threads/index.tsx) |
| 53 | UI53 | Confirmações | `/orchestra/sf-work/confirmations/:selectionRef` | [`collaboration-pages/confirmations/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/collaboration-pages/confirmations/index.tsx) |
| 54 | UI54 | Propostas de hot topics | `/orchestra/sf-dashboard/hot-topics/proposals/:proposalRef` | [`dashboard/hot-topics/proposals/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/hot-topics/proposals/index.tsx) |
| 55 | UI55 | Nova importação | `/orchestra/sf-imports/new` | [`imports/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx) |
| 56 | UI56 | Prévia da importação | `/orchestra/sf-imports/:manifestId/preview` | [`imports/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx) |
| 57 | UI57 | Histórico, recibo e revisão de importação | `/orchestra/sf-imports/:manifestId/receipt` | [`imports/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx) |
| 58 | UI58 | Documentos | `/orchestra/sf-documents` | [`documents/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/documents/index.tsx) |
| 59 | UI59 | Evidências de documentos | `/orchestra/sf-documents/:documentRef/evidence` | [`documents/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/documents/index.tsx) |
| 60 | UI60 | Cenários de documentos | `/orchestra/sf-documents/:documentRef/scenario` | [`documents/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/documents/index.tsx) |
| 61 | UI61 | Sinais de memória | `/orchestra/sf-memory/signals` | [`memory/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/memory/index.tsx) |
| 62 | UI62 | Casos semelhantes | `/orchestra/sf-memory/cases` | [`memory/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/memory/index.tsx) |
| 63 | UI63 | Resultados / Outcomes | `/orchestra/sf-memory/outcomes/:selectionRef` | [`memory/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/memory/index.tsx) |
| 64 | UI64 | Catálogo de rotinas | `/orchestra/sf-routines` | [`routines/catalog/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/routines/catalog/index.tsx) |
| 65 | UI65 | Execuções de rotinas | `/orchestra/sf-routines/runs/:runRef` | [`routines/runs/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/routines/runs/index.tsx) |
| 66 | UI66 | Agendamentos | `/orchestra/sf-routines/schedules/:scheduleRef` | [`routines/schedules/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/routines/schedules/index.tsx) |
| 67 | UI67 | Contexto da instalação | `/orchestra/sf-home/context` | [`context/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/context/index.tsx) |
| 68 | UI68 | Exportações e arquivos | `/orchestra/sf-imports/exports` | [`imports/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx) |
| 69 | UI69 | Administração local | `/orchestra/sf-home/administration` | [`local-administration/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/local-administration/index.tsx) |
| 70 | UI70 | Residentes | `/orchestra/sf-routines/residents` | [`routines/residents/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/0550c4bb8fc3b4b4e68561777010ca03483e2391/packages/app-shell/src/orchestra/chapters/sucafina/routines/residents/index.tsx) |


## Design sources and review boundaries

The source of truth is the native Orchestra `DESIGN.md`, read together with the repository's `orchestra-design-system` and `orchestra-visual-qa` skills. The current quiet-glass rules govern over older broad visual guidance. Page-scoped styles use existing fonts, color roles, radii and focus treatments; no substitute branding or new global palette is introduced.

The inventory records 70 unique native surfaces, 165 recognized route patterns and 15 chapters. Those counts describe route recognition and source components, not runtime admission or visual acceptance of every destination. `inventory.json` preserves the historical source and the current candidate component blobs; links in the table above open this candidate's entrypoints.

All original worker artifacts remain historical provenance. Their source-only NOT_RUN statements describe their authoring moment. First-wave product, CI, screenshots and acceptance remain in [INTEGRATION.md](INTEGRATION.md), [VALIDATION.md](VALIDATION.md) and its [evidence manifest](evidence/manifest.json). The current second-wave evidence is in [wave-two/INTEGRATION.md](wave-two/INTEGRATION.md), [wave-two/VALIDATION.md](wave-two/VALIDATION.md) and [wave-two/evidence/manifest.json](wave-two/evidence/manifest.json).
