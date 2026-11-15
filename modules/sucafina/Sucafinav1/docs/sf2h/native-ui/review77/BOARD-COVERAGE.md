# Auditoria das 17 pranchas e do escopo integral

**Resultado:** direção visual coerente; prontidão funcional por família depende dos contratos e estados abaixo. Pranchas são propostas sintéticas, não capturas de produto em execução. Nenhuma variante não desenhada foi tratada automaticamente como exclusão de escopo.

Fonte visual: [UX-BOARDS.pdf@PR76](https://github.com/gustavomhss/Orchestra-SF/blob/2f143330a0a44d34eb764ebfb851804c504edb6d/modules/sucafina/Sucafinav1/docs/sf2h/native-ui/UX-BOARDS.pdf). Dezessete páginas foram extraídas/renderizadas e inspecionadas em contact sheets; páginas4 e16 também ampliadas pelo coordenador. Isso é inspeção de documento, sem executar app/testes. Texto dos17boards, UX-DESIGN, inventário e contratos foram confrontados.

## Juízo visual e de interação

A mesma sidebar agrupa os destinos SF, mantém Chat/Inbox no grupo de apoio e preserva acesso técnico. Lista/detalhe mantém contexto, valores relevantes têm unidade/origem e há distinção de revisão/edição/decisão. As pranchas usam uma hierarquia consistente, exemplos light/dark e tratam custo incompleto, valor submetido e memória sem causalidade presumida. Não há razão para substituir a arquitetura por outro app.

A insuficiência está nas costuras operacionais. Tabs e catálogo não demonstram as ações internas. Board04 mostra a etapa anterior à decisão, não aprovação/rejeição completa. Board07 promete salvar uma vista não representável pelo produtor atual. Boards03/16 não explicam colagem retangular e recusas seletivas. Board17 é útil, mas não liga saída com draft aos controles globais. Os achados são de desenho/contrato, sem alegar reprodução de defeito numa UI inexistente.

Correspondência dos nomes de achado do subsídio: UX-01=R77-F06; UX-02=R77-F07; UX-03=R77-F05; UX-04=R77-F08.

## Matriz dos dezessete boards

“Sem variante desenhada” não significa escopo excluído. Os vínculos abaixo permitem completar uma matriz de ação/estado/owner/critério sem exigir 1.610 telas nem redesenhar cada variante. Todos os boards são propostas estáticas; cada evidência executada continua futura.

| Board | Cobertura visual observada e índice | Lacuna útil para delegação / variante a vincular |
| --- | --- | --- |
| 01 Hoje — light | UI29; resumo de trabalho UI30 e sinais UI61; responsabilidade, reunião e retomada | Primeiro ciclo: não configurado × sem acesso × nenhuma pendência; seleção de responsáveis/período; entrada preferida. Vincular WP01.T04.CMP.02. |
| 02 Dashboard — dark | CAP01 visível; tabs CAP02–05; chart relacionado a BI01 | Fonte/drilldown e cobertura parcial; ações de manutenção de Budget/OPEX/CAPEX e Hot Topics têm inventário textual, mas precisam apontar para composição e estados concretos. |
| 03 Planner — light | CAP18 mensal; tabs dos CAP17–23 | UX-02: multi-linha, colagem, locks e retorno por linha. Vincular anual/spread/reset, versões, comparação e privacidade HR a contratos, sem tomar tabs por evidência visual das sete capacidades. |
| 04 Compras — light | CAP26: aprovação sourcing, valor/congelamento, CTA revisar; tabs CAP24/25/27/28 e CAP14 | Revisão antes da decisão, PR/sourcing/PO e holders intermediário/final, rejeição motivada, versão/recibo incerto. Contratos conservam autorização Dashboard; Suppliers banco/settings exigem papéis próprios. |
| 05 Portfólio — light | UI42/43: combinações viável/condicional/inviável; tabs CAP09/10 e UI44 | Criação/edição do universo e candidatos, restrições, comparação, sensibilidade e seleção histórica; manter distinção entre inviável e fonte/avaliação indisponível. |
| 06 Decisões — dark | UI34/35: intenção, critérios, duas alternativas, evidências, registrar escolha; tabs UI36–40 | Escolha atual → mudança preparada → review/apply → recibo/recovery; assíncrono/needs-input/stale e crítica de revisor em run independente. |
| 07 Meu trabalho — light | UI30 e ação UI32 “Salvar vista”; aprovações/perguntas/confirmações/ações | UX-01 contrato incompatível; primeiro ciclo e responsáveis do diretório autorizado; não duplicar ação canônica nem usar nome como identidade. |
| 08 Reuniões — dark | UI48: revisão preservada, seção 3/6, seleção de projetos e export; tabs UI47/49/50 | Pauta/ordem/períodos por seção, rejeição de seleção, primeira revisão/compatibilidade, export extenso/retry e thread autoritativa de contexto. |
| 09 Pessoas — light | CAP07 estrutura; resumo CAP06 e tab CAP08 | Estados de papel/readonly/redação, edição/importação/exportação de membros e Talent; agregados e busca não revelam campo privado. |
| 10 Operações — light | CAP11 serviço, fluxo/backlog e mês independente; tabs CAP12/13/15/16 | Preview/substituição do import-month, catálogo save, referência própria Security, manutenção de riscos/stakeholders/performance com mesmas fórmulas. |
| 11 Análises — light | UI45; cards BI01/02/03/09/10/11 visíveis; famílias indicam catálogo maior | UI46 de gráfico + tabela + fonte/decisão com refs revogadas, parcial/incompatível e estado vazio. Registrar os onze destinos sem alegar que só seis existem porque só seis foram ilustrados. |
| 12 Documentos — light | UI59: candidatos/trechos e confirmação; tabs de fontes/cenário/histórico | Admit/extract indisponível, scanner/parser, falta de texto, versão alterada/revogação; mesma evidenceRef confirmada alimenta cenário e sourcing. |
| 13 Importações — light | UI56 impacto, etapa 3, adicionados/alterados/ignorados e CTA Apply | Vínculo com manifest/preview/receipt e conflito→reprévia/cancelamento sem efeito; critérios específicos de formato para inválidos versus ignorados, sem inferir autorização do CTA ilustrado. |
| 14 Memória — dark | UI63 previsto/observado; UI61 material/irrelevante/duplicado; tab UI62 | Proveniência do recall e retorno à origem, fonte/memória indisponível/revogada, avaliação/reevaluação e base/cutoff; sem imputar causalidade. |
| 15 Rotinas — light | UI64 catálogo; resumo run needs-input; recorrência indisponível | UI65 run admitido/output/cancelar/retomar; UI66 timezone/pausa/revogação/dedup; UI70 consumo dos cinco perfis/dezoito skills com owners por contribuição, não apenas totais. |
| 16 Mobile — light | Três superfícies Hoje/aprovação/editor mensal, desenho de 360 px; regra textual 320 px | Nenhuma execução a 320/768/zoom200; mapear drawer aberto, teclado/foco, comparação e range de UX-02. O board não prova responsividade nem acessibilidade. |
| 17 Falhas — light | Conflito de versão, resultado incerto de import, acesso alterado | Completar vínculos de loading/empty/partial/validação/sessão expirada/read-only/cancelamento e UX-03 dirty navigation. A tabela global de UX já nomeia vários estados, falta a ligação aos fluxos/owners. |


## Cobertura por dimensão

| Dimensão | Evidência do plano / decisão de revisão | Obrigação mantida |
| --- | --- | --- |
| Destinos nativos |15 IDs, registry/chapter/sidebar comuns; sem item raiz que encapsula tudo | Componentes Solid no mesmo shell, acesso real pelo catálogo; sem iframe, segunda sidebar, HTML raspado ou app externo |
| Componentes | MxPage, dialogs/tokens/providers reais; comps SF ainda novos | Foundation mínima piloto; MonthlyGrid/Chart/Run/Evidence entregues com consumidores e ownership disjunto |
| Tema | Light/dark ilustrados | Dark, Light, Graphite, Gruvbox, GitHub, Nord, AMOLED; contraste/foco medidos no produto; paletas geradas intactas |
| i18n | Labels pt-BR/en propostos | LanguageProvider, dicionários en/br, plural tipado e registries por N0; demais locales/fallback e frases longas |
| Responsividade | Board16 ilustra360px; texto exige320/768/1440 e zoom200 | Mesmo drawer; fila/detalhe sequencial; comparação e range edit sem perda de capacidade |
| Acessibilidade | Regras textuais de teclado, APG, status, focus return e tabela equivalente | Verificação real de tab/setas/Enter/Esc, foco não encoberto, leitor, targets/contraste; sem selo WCAG por board |
| Papéis | Inventário preserva superfície produtora | Executivo, contribuidor, Finance/HR e requester/buyer/approver; Contratos continua Dashboard, HR protegido; positivo readonly e negativos diretos |
| Estados | Loading/empty/filter/partial/conflict/denied/503/expired indisponível nomeados | Cada ação tem base/draft/current, próximo passo e owner; consulta/receipt somente onde real |
| Finanças | Dados demonstrativos e contratos canônicos |590000→602000/596000; 28000EUR×1,08=30240USD vs32000; subtotal210000 com categoria ausente não vira total; motor determinístico único |
| IA/residentes | Catálogo e estados propostos |5 perfis/18 skills/8 packs/39 operações, mesma evidenceRef, contribuição persistida consumida após reload, revisor em run próprio; AM01–06 |
| Migração | M0–M5 e aliases textuais corretos | Codec/allowlist, first access, URL explícita, sem redirect de POST e sem perda silenciosa de filtro; rollback só apresentação |
| Prova | Índice/boards são planejamento |13 jornadas, oito seleções, três FINAL canônicos, C/G7 e D/G8; NOT_RUN nesta missão |

## Integridade do índice: o que foi de fato conferido

A campanha integral foi obtida pelo Git blob **71b56906f8bb190c4d568f60c7511ce1ff63d5f3**, no commit canônico **dbf9547211d9b0fade619790de7c19c0869b7c7d**. O conteúdo foi analisado em memória, sem teste de produto.

Comparação direta de todos os objetos id+text em campaign.axioms e campaign.work_packages com criteria-trace.json da PR76:

- 1.610 IDs canônicos,1.610 IDs no índice, todos únicos;
- zero IDs ausentes ou extras;
- zero divergências em canonicalPointer;
- 15 WPs,74 tasks,17 contratos,13 jornadas;
- 50 critérios de campanha +1.560 de WP/task.

A frente UX conferiu independentemente os1560IDs contra os15espelhos WP00–WP14 e os50IDs contra COMMON. O resultado nominal concorda. O ledger [TASK-COVERAGE.json](TASK-COVERAGE.json) registra as74tasks, owners propostos, destinos, achados aplicáveis e dependências. Não reclassifica canônico como PASS.

**Isto prova integridade nominal da rastreabilidade.** Não prova1.610 comportamentos, não transforma70entradas de inventário em70telas prontas e não dispensa matriz de ação/estado/papel. TRACEABILITY.md já diz que o índice classifica por task; a revisão preserva essa distinção.

## Continuidade dos quinze WPs

| WP | Task count | Destino/consumo principal | Condição mantida para a implementação |
| --- | ---: | --- | --- |
| WP00 |4| Baseline, contratos/corpus/native | Não reduzir28CAP/R01–41/IA01–18; registrar ambientes e limites reais |
| WP01 |5| Shell/Hoje/Meu trabalho/mesa | R77-F01/02/03/05/06; guardas/contexto e preferências antes dos consumers pertinentes |
| WP02 |4| Dashboard/Pessoas/Operações/Portfólio/Contratos | Mesmas16capacidades, comandos e ACLs, não só projeções |
| WP03 |5| Planner | R77-F07; sete capacidades, bulk/range, versões/locks/HR e números |
| WP04 |5| Procurement | Piloto é fração de T01/T02; aprovações/fornecedores/M31/MI07 continuam |
| WP05 |5| BI/Análises contextual | BI01–11, tabelas/fontes/acesso e ausência; não motor no browser |
| WP06 |5| Imports/Documentos | Formatos/preview/Apply/receipt, extração e mesma evidenceRef; scanner real ainda obrigatório |
| WP07 |4| Reuniões/Reports | Pauta/preservação/comparação/export completo; quatro jornadas/86 critérios permanecem sem transferência de prova |
| WP08 |6| Colaboração/Meu trabalho | Relações explícitas, threads, C06 material, Hot Topics e perguntas; sem task store paralelo |
| WP09 |7| Rotinas | Preparação/retorno/cancelamento/recorrência; native64 composto não habilita Relay/Schedule |
| WP10 |7| Composição/qualificação | R77-F08; três FINAL reais, seleção no candidato, sem aceite por planejamento |
| WP11 |4| Decisões | Caso/alternativas/escolha/prepared changes/C12 e recuperação parcial; release52/M31 preservados |
| WP12 |4| IA contextual | POST/admissão, provider real, crítica independente, outputs tipados sem HTML legado |
| WP13 |4| Portfólio/sensibilidade | P03 continua FAIL/HELD; não repetir input inalterado ou ampliar timeout |
| WP14 |5| Memória/reavaliação | Material/irrelevante/duplicado/stale/revogado; Atlas real/durável, mesma fonte e sem causalidade inventada |
