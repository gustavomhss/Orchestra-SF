# Especificação operacional das superfícies nativas

Estado: **planejamento; não é implementação, teste, prontidão do produtor ou autorização de execução**. Este documento e [surface-manifest.json](surface-manifest.json) fecham composição, roteamento, estado e paridade de controles das **28 capacidades e 42 entradas adicionais**. O manifesto tem uma entrada por ID de inventário; não cria 70 aplicações nem muda as 74 tasks/1610 critérios canônicos.

## 0. Autoridade, leitura e limites

O canônico `dbf9547211d9b0fade619790de7c19c0869b7c7d` conserva semântica e aceite. Os seis renderizadores/dispatchers inspecionados em C27 `b10c424a6b318879fc30f11d03ba1cfeffda7d1a` fixam campos, comandos, versões e redaction; seus paths, blobs e SHA-256 estão em `sourceReferences`. As decisões nativas deste suplemento completam a composição. Não redefinem cálculos, permissions, state machines nem contratos dos produtores.

Os seis blobs foram confrontados por GitHub MCP com `faa30fddb7e7b61696b66fd069f51cf18c51125f`, a base da arquitetura: **seis idênticos, nenhum drift conhecido delegado a I00**. [surface-source-comparison.json](surface-source-comparison.json) registra cada path, blob nos dois pins e URL. I00 verifica apenas deltas posteriores do candidato; não precisa reler uma fonte cujo blob continua idêntico.

Para executar uma fatia, ler apenas sua ordem, os IDs `surfaces` atribuídos, os patterns/estados referidos e as famílias de [CONTRACTS](CONTRACTS.md). `fieldContractRef` é JSON Pointer em [contract-catalog.json](contract-catalog.json), por exemplo `#/families/planner`; `resource` é a identidade funcional desta superfície, não autorização para inventar um endpoint. A operação congelada da família fornece `inputRef`/`outputRef`; os nomes em `acceptedInputs`/`acceptedOutputs` são checklist semântico da UX, não um schema JSON aberto. Nas fontes canônicas, `taskSelectors` fornece path, task ID e JSON Pointer; não é um anchor Markdown fictício.

I00 fixa o candidato de lançamento, compara os blobs e registra os digests. Drift de fonte/contrato exige revisão do binding antes do despacho do consumidor afetado. O executor não escolhe uma versão nova de uma regra, não resolve uma lacuna por aparência e não cria um campo ou API aproximado. Um campo/action/erro/route/schema ausente da combinação fonte + contrato + suplemento gera `BLOCKED_CONTRACT` para aquele output, com pointer preciso; trabalho independente já fechado continua.

As 17 pranchas originais `UX-BOARDS.pdf` r1 são direção visual conceitual; o adendo r2 registra as correções. As decisões operacionais abaixo prevalecem sobre simplificações gráficas. A ausência de um controle na primeira dobra da prancha não o remove. Esta correção foi produzida após cold review da baseline e passa pela revisão cruzada registrada no fechamento.

[component-signatures.ts](component-signatures.ts) é a especificação normativa de props, callbacks, unions e carriers dos componentes F03/S01–S05. [route-signatures.ts](route-signatures.ts) fecha o mapa tipado dos 70 SurfaceIds/165 templates, params decodificados e query validada pelo inputRef de cada recurso; F01 publica esses tipos em Schema/context, APP apenas os reexporta. São documentos TypeScript, sem implementação ou teste. O texto de COMPONENT-CONTRACTS explica comportamento; os arquivos tipados eliminam inferência de assinatura. `SfSurfaceProps` pertence somente aos compositores de página APP/F01/Uxx; componentes puros não recebem router, client ou contexto autenticado. Client/Protocol/Desktop nunca dependem de app-shell para tipo de rota.

## NAV-01 — Entrada, rota e retorno

### Entrada e quinze chapters

Resolver entrada inicial nesta ordem: **deep link explícito autorizado → entrada pessoal válida do mesmo owner → Hoje autorizado → primeiro destino autorizado na ordem estável da sidebar**. Um deep link inválido, removido ou negado mostra seu estado e retorno; não faz fallback silencioso. Preferência inacessível não seleciona outro registro com nome parecido: mostra `missingPreference`, usa o fallback autorizado e oferece “Usar como entrada”. Não há seleção automática de outro servidor, instalação, período ou versão.

O clique de chapter usa a primeira subentrada autorizada da ordem abaixo. Isso permite, por exemplo, que alguém com somente Vendor Contracts entre em Contratos dentro de Procurement, mantendo autoridade Dashboard. Se nenhuma subentrada é autorizada, o chapter fica ausente do catálogo; se o acesso desaparece enquanto aberto, usa o estado revogado. Não fabricar contagem zero para um chapter ausente.

| Chapter | Ordem de subentradas para entrada padrão autorizada |
| --- | --- |
| sf-home | `/sf-home`; contexto e administração são fluxos auxiliares, não fallback de negócio |
| sf-dashboard | executive, budget, opex, capex, hot-topics |
| sf-planner | overview, opex, capex, headcount, allocations, fx, versions |
| sf-procurement | overview, requests, approvals, suppliers, contracts, settings |
| sf-portfolio | overview, projects, scenarios, sensitivity |
| sf-decisions | lista de casos |
| sf-work | fila; vistas pessoais e relações são destinos explícitos |
| sf-reviews | agenda, reviews, reports |
| sf-people | overview, structure, talent |
| sf-operations | service, security, risks, stakeholders, performance |
| sf-bi | catálogo de perguntas |
| sf-documents | catálogo de documentos |
| sf-imports | histórico de manifests/recibos; ação “Importar arquivo” abre `/new` |
| sf-memory | signals, cases, outcomes; outcomes sem seleção abre seletor |
| sf-routines | catálogo, runs, schedules, residents |

Os paths relativos da tabela recebem `/orchestra/<chapter>`; os templates completos e variantes estão exclusivamente no manifesto. A ordem entre chapters e grupos continua a de UX-DESIGN. Nenhum destes fluxos cria uma segunda sidebar de módulos.

### Codec e contexto

I00 publica route builders; consumidores não concatenam strings. Cada parâmetro de referência de domínio em path usa `r_` seguido de base64url, sem padding, dos bytes UTF-8 da referência original. O decoder exige prefixo, alfabeto canônico, UTF-8 válido e roundtrip idêntico. Ele passa a referência original ao produtor. Isso evita colisões de registros legítimos chamados `new`, `review` ou `compare` com rotas estáticas, sem renomear IDs de domínio. O codec não é criptografia nem controle de acesso. Route builders são comuns a web e desktop; o transporte desktop segue `CONTRACTS.md#4-transport--broker-desktop-mínimo-e-novo`.

`server`, `project` e `installation` ficam em query, codificados por `URLSearchParams`, e são resolvidos pelo contexto autorizado. Principal vem da sessão no servidor, nunca da query. O tuple de ownership é servidor + projeto + instalação + principal; source surface e seleção de período/versão completam as chaves de dados. Sem o triplo na URL, usar somente a seleção explícita vigente no shell: zero instalações mostra indisponibilidade, uma instalação permite seleção determinística, várias exigem seletor. Sem vínculo autorizado, não buscar em outro owner. As refs não carregam grants.

Query pode conter ano, mês/período, versão, status, ordenação, cursor e seleção opaca admitidos pelo contrato. Texto livre de busca, notas, salário, dados bancários, prompt, conteúdo de documentos e draft ficam fora da URL. Busca compartilhável exige ação explícita e contrato que autorize seus termos; não é estado padrão. Filtros de cada vista são independentes: mudar Executive não altera Operations, Security ou Planner.

Seleção abre detalhe com URL; Voltar restaura lista, filtros, ordenação, cursor, posição e foco na mesma linha. Se a linha desapareceu, focar a próxima linha sobrevivente; se não há linha, o título da lista. Um `returnRef` é dado efêmero tipado para uma rota interna do mesmo owner, revalidado ao usar; nunca aceitar URL arbitrária ou credenciais em return. Reload sem returnRef usa a lista-pai especificada. Compartilhar um detalhe não compartilha o draft local.

Relação independente tem `/orchestra/sf-work/relations/:relationRef`. O alias `/orchestra/sf-decisions/:caseRef/relations` é uma vista filtrada das relações existentes daquele caso, não um redirecionamento para uma relação inventada; criar vínculo nunca cria caso implicitamente. A criação `/sf-work/relations/new` recebe refs autorizadas da origem e destino, com caso opcional. S05 possui o componente puro; U44 compõe as páginas, chama A13 e usa F01/S03; I00 registra a rota. UI51–53 têm U44 como primaryOwner e S05 como contributor, sem fetch no componente.

## LAYOUT-01 — Composição e responsividade

Usar os tokens, tipografia, `MxPage`, sidebar e mecanismos de tema existentes. O chapter não decide largura da sidebar. A largura útil `W` é a largura real da área de trabalho **após** sidebar, insets, gutters e padding do chapter. Desktop usa padding 32px, tablet 24px e mobile 16px conforme UX-DESIGN. Densidade padrão de linha 44px; compacta 36px é opção pessoal explícita e não reduz alvo interativo abaixo da regra de acessibilidade do kit.

| Condição | Decisão fechada |
| --- | --- |
| Viewport 320–767 CSSpx | Uma coluna; ações preservadas e agrupadas em menu com nome; lista e detalhe alternam por rota. Editor extenso é página. Barra de draft quebra linha e nunca cobre o último campo. |
| Viewport 768–1023 CSSpx | Uma superfície principal; split somente se `W >= 801px`, com mínimos abaixo. Contexto ocupa a área de detalhe ou página. |
| Viewport 1024–1439 CSSpx | Regra explícita de notebook: split somente se lista ≥320px + separador de 1px + detalhe ≥480px. Em largura menor, detalhe substitui lista e mantém retorno. Não forçar split por “desktop”. |
| Viewport ≥1440 CSSpx | Mesmos mínimos; lista 320–380px, detalhe restante; canvas amplo até a variante local definida em UX-DESIGN. Terceiro painel só com lista ≥320 + detalhe ≥480 + contexto ≥320 + dois separadores. |
| Painel de fonte/atividade/perguntas | Um por vez. Se seu mínimo não cabe, substitui a área de detalhe com retorno claro; se nem detalhe cabe, usa página. Nunca encolhe o grid abaixo da área legível. |
| Tabela em largura curta | Preservar campo-chave, estado e próxima ação; detalhe acessível contém todas as colunas. Colunas não viram informação descartada. Tabela com comparação essencial pode ter scroll horizontal local identificado. |
| Grid mensal | Região local de scroll bidimensional quando necessária; descrição e total fixos só se não consumirem a largura inteira. Alternativa obrigatória de editar uma linha com 12 meses empilhados. Sem scroll horizontal no documento inteiro. |
| Comparação | Duas ou três alternativas simultâneas conforme largura útil; em largura curta, uma alternativa por vez com seleção explícita e critérios na mesma ordem. Selecionar nunca muda o cenário ou a base. |

Os controles do contexto podem quebrar em linhas; título/estado/ação não se sobrepõem. Tabs em overflow tornam-se “Mais vistas”, mantendo o nome da seleção. Não cortar labels com significado nem substituir texto por ícone sem nome acessível. Notas longas e nomes de arquivo quebram em limites seguros; truncamento visual tem acesso ao texto inteiro por teclado e toque, sem depender de tooltip com hover.

### Matriz mínima eficiente de qualificação visual

Não executar o produto nesta fase. A futura prova usa **320, 768, 1024, 1280 e 1440 CSSpx**, mais 1366 quando o bug/fixture exigir o notebook específico. Testar uma vez cada pattern compartilhado com nomes/notas longos, erro e draft; folhas testam somente sua composição/variantes específicas. Isso evita repetir o cartesiano de 70 entradas × temas × larguras × estados.

200% de aumento de texto verifica redimensionamento; **400% em viewport 1280, equivalente a 320 CSSpx, verifica reflow**. Um não substitui o outro. Scroll bidimensional fica restrito a grids/tabelas cujo significado exige as duas dimensões; formulário, revisão, navegação e erros devem refluir. Referência: [WCAG 2.2, Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

Light/Dark cobrem a composição principal; os sete temas existentes — Dark, Light, Graphite, Gruvbox, GitHub, Nord e AMOLED — passam pela mesma amostra de tokens, texto, foco, seleção, erro, gráfico e ausência. Corrigir o componente compartilhado uma vez; não criar overrides por folha para esconder falha de tema.

## READ-01 — Leitura e estados comuns

`read-common` é obrigatório nas 70 entradas. O estado resulta do envelope autorizado; dados ausentes e erros não se tornam lista vazia. O consumidor não deriva uma permissão agregando papéis de outras superfícies.

Os nomes semânticos desta tabela não criam um segundo enum de componentes. O `SfUiState` de COMPONENT-CONTRACTS é a união fechada. Mapping: resolving-context → loading; read-only → ready + flag/reason readonly; removed/not-found → not-found, somente com resultado autorizado confirmado; revoked → denied + purge imediato do escopo; invalid-link → invalid; session-expired → session-expired + regra de quarentena; needs-input de formulário → invalid com mensagem do input exigido, sem tratá-lo como falha de infraestrutura. `filtered-empty` é a única grafia em código e docs. Fases do draft são estado separado: clean/dirty/validating/reviewing/submitting não ampliam SfUiState; submissão em voo usa busy, resultado enviado mas incerto usa outcome-unknown, validation-error usa invalid, conflito confirmado usa conflict e sucesso usa ready.

| Estado | Conteúdo e ação |
| --- | --- |
| resolving-context | Seletor/identidade do shell; nenhum payload antigo visível. |
| loading | Título/contexto já confirmados, esqueleto com `aria-busy`; sem contagem ou valor fabricados. |
| ready | Projeção autorizada, cobertura/unidade/período/versão e ações admitidas. |
| empty | “Ainda não há registros.”; criar somente se o catálogo autoriza. |
| filtered-empty | “Nenhum resultado para estes filtros.”; conservar filtros e oferecer removê-los. |
| partial | Exibir somente parte conhecida com cobertura/razão; não calcular total como se completo. |
| unavailable | Estado do produtor indisponível com tentativa novamente; não confundir com inexistência. |
| read-only | Leitura integral autorizada e rótulo; ações de mutação não ficam ativas. |
| denied | Sem conteúdo privado; mensagem de acesso e retorno ao catálogo autorizado. |
| revoked | Limpar projeções, selection/drafts e conteúdo embutido do escopo afetado imediatamente; permitir login/seleção novamente sem restaurar autoridade anterior. |
| session-expired | Bloquear/ocultar conteúdo privado. Quarentena efêmera somente sem revogação comprovada. F01 pode transferir para novo authEpoch após revalidar o mesmo servidor/identidade de transporte/origin/principal/instalação/projeto e acesso atual à entidade e a cada campo. Logout/revogação confirmados nunca restauram; identidade ou autorização incompatível purga o escopo afetado. |
| removed/not-found | Sem reconstrução por título ou outro servidor; retornar à lista. |
| stale | Preservar identificação e versão permitidas, sinalizar fonte atual e bloquear conclusões dependentes da versão até revalidar. |
| invalid-link | Mostrar erro de link; não normalizar para registro ou owner aproximado. |

Uma leitura de usuário que falha recebe estado inline ou toast existente de erro e log técnico redigido. Nunca `catch` silencioso que converte falha em ausência. Background decorativo pode falhar sem interromper o usuário somente se não altera materialidade, permissão ou conclusão.

## DRAFT-01 — Edição, navegação e concorrência

F01/S03 mantêm store efêmero por owner fora de `ChapterBoundary`, para navegar entre chapters do mesmo owner sem desmontar drafts. A chave de lookup é owner + editScopeKey estável + surface + identidade do registro/newIntent local; a revisão mutável `baseVersion` é conteúdo do draft, não parte da chave. editScopeKey distingue ano/versão financeira/escopo de edição de negócio, sem mudar por refetch da mesma entidade. Não persistir conteúdo privado em localStorage, URL ou cache compartilhado. Base confirmada, draft e resultado pendente são objetos distintos; mutation não altera silenciosamente a base usada na revisão.

| Evento | Resultado obrigatório |
| --- | --- |
| Entrar em edição | Capturar ref, versão e campos autorizados; uma cópia de draft. Campos ausentes por redaction continuam ausentes. |
| Navegar internamente no mesmo owner | Conservar draft e filtros em memória; retornar restaura edição. A navegação não salva. |
| Fechar painel/Escape/Voltar com dirty | Fechar a composição, conservar draft do mesmo owner; indicador de rascunho ao retomar. Não executar descarte por backdrop. |
| Descartar rascunho | Ação explícita; confirmar quando há mudanças; voltar à base autorizada. Nunca chama comando de domínio `delete` ou `cancel`. |
| Troca voluntária de owner/logout | Antes de efetivar, “Descartar o rascunho e mudar de contexto?” com descartar/continuar editando. Após confirmação de logout ou saída definitiva, abortar requests e limpar imediatamente conteúdo do owner antigo. |
| Revogação comprovada | Limpar imediatamente o escopo afetado; não manter dado privado para oferecer salvamento. Guard de dirty não atrasa revogação. |
| Expiração de sessão sem revogação comprovada | Ocultar/bloquear UI privada e colocar draft em quarentena efêmera. Transferência F01 para novo authEpoch é permitida somente após revalidar mesmo servidor, identidade de transporte, origin, principal, instalação e projeto, mais acesso atual à entidade/campos. Logout/revogação confirmados ou identidade/acesso incompatível purgam. Simples 200 de login não autoriza restauração. |
| Reload/fechar janela | Guard nativo de unload quando dirty/pendente; não prometer persistência após fechar. O texto final do prompt é controlado pelo navegador. |
| Refetch enquanto clean | Atualizar base, mantendo seleção e foco se o registro existe. |
| Refetch enquanto dirty | Guardar nova base separadamente; não substituir inputs nem fazer merge automático. Oferecer comparar/revisar contra versão atual. |
| Erro de validação | Preservar valores; resumo de erros com links para campos e foco no primeiro erro; mensagem específica do contrato. |
| Conflito de versão | Preservar draft e base; mostrar diferenças autorizadas em paralelo ou sequência. Nova revisão usa versão atual; nunca auto-overwrite. |
| Salvar aceito | Consumir resultado original; refetch autorizado do registro; marcar clean só quando o resultado identifica sucesso. Avisos não desaparecem. |
| Comando enviado/resposta perdida | `pending` com identidade/correlação original; consultar resultado antes de reenviar. Não mostrar sucesso por otimismo. |
| Remoção do objeto por outro ator | Bloquear salvamento sobre ref removida; conservar somente dados ainda autorizados; “Salvar como novo” apenas se o produtor oferece essa operação, nunca como default. |

`edit-common` inclui as situações clean, dirty, validating, validation-error, reviewing, submitting, pending, conflict, succeeded, failed e revoked; o código usa exclusivamente os tipos do arquivo normativo. Mapping obrigatório: pending após envio sem resultado → phase `outcome-unknown`; succeeded com projeção autoritativa → phase `clean` após `confirmSave`; sucesso confirmado sem projeção → availability `confirmed-without-projection`, sem transformar valores submetidos em leitura atual; revoked → availability `revoked` e purge, não um valor de phase. Quarentena → availability `quarantined`, sem getters de payload privado. Um efeito externo nunca é consequência de simplesmente visitar rota, montar componente, fechar painel, refazer leitura ou restaurar draft. Apenas os eventos explícitos e a admissão do produtor disparam comandos. Retry reutiliza a identidade admitida conforme CONTRACTS; não inventa novo idempotency key para obter efeito duplicado.

## ACTION-01 — Intenções distintas e revisão

Cada `domainCommands` contém source surface/page/action, local de controle, destino, revisão e pós-condição. O catálogo/handler original continua validando o pedido. Um botão visível não concede acesso; um botão oculto não é controle de segurança.

| Política | Decisão da interação |
| --- | --- |
| validate-save | Validar draft, apresentar erros, enviar somente campos aceitos e versão-base. Salvar não submete, aprova, escolhe, importa ou emite. |
| scope-review | Spread/reset/sync/common/copy/official/lock/unlock/status/banco mostram objeto, escopo, fonte, versão e consequência exatos; confirmar chama somente o comando indicado. |
| delete-confirm | Menu secundário destrutivo com nome/identidade do registro e consequência original. “Excluir rascunho” de compra é exclusivo do draft permitido; não é “Cancelar pedido”. |
| stage-review | Review de PR/sourcing/PO mostra a versão, valores/moedas, seleção e bloqueios. Save draft e Submit são intenções independentes. Emitir é emissão interna do produtor, não comunicação externa nova. |
| approval-review | Snapshot submetido, holder/etapa, valor/moeda/FX e razão. Approve/reject não salvam draft de outro editor; rejeição conserva o motivo exigido. |
| import-impact | Arquivo/destino → prévia → impacto/base → aplicar. Modo substituir/remover é explícito. Upload, parsing e prévia não alteram domínio. |
| settings-diff/reset-confirm | Review das seções e valores atuais; reset mostra escopo dos defaults canônicos e preservações documentadas pelo produtor. Nunca resetar ao abrir a tela. |
| export | Mostrar fonte, recorte, versão e formato. Revalidar autorização no download; arquivo não vira público por possuir link. |

Aplicar uma mudança preparada exige choice atual, versão e blockers admitidos; “Aplicar” não aparece ativo antes desse review. Receipt, import result e histórico são rotas de leitura: reload nelas não reaplica. UI57 fixa `/sf-imports/:manifestId/review` para revisão/aplicação e `/receipt` para consulta do resultado.

## FIELD-01 — Campos, valores e projeções sem perda

O contrato de campos é a união **autorizada** do input aceito e da projeção pública da fonte pinada, não o snapshot interno. `sourceBinding.selectors` usa nomes de símbolos exatos; `render(page="...")` significa o branch daquela função no page literal indicado, e `execute.fieldsByCollection.lines` significa a propriedade `lines` do objeto local `fieldsByCollection` na função `execute`. Esses são locators de leitura do source, não funções para importar no browser.

Para cada binding, preservar nomes/enum values, tipo, unidade, blank/null/zero, defaults canônicos, lista ordenada, nested row IDs, máscaras, readonly, dependências, validações, version/fence e mensagens específicas. O adapter projeta tipos explícitos; o UI não recebe `Record<string, unknown>` para construir editor genérico. Os valores de fonte e suas permissões vencem qualquer sugestão ou preenchimento de IA. Não scrape HTML, não montar iframe e não importar runtime/segredos do servidor no bundle.

Campos fonte cujo domínio permite escrita mas o renderer antigo não editava são preservados como dados read-only e roundtrip, não promovidos automaticamente a input. Campos retornados mas ausentes por redaction não ganham placeholders que revelem salário, banco ou inferências. Uma nova capacidade de edição requer decisão explícita do contrato; manter valores não significa conceder edição.

Campos de listas/nesting seguem as linhas e IDs originais: adicionar/remover item é uma intenção de draft até salvar; reordenar não remapeia identidade por índice. Hidden version/fence/record IDs são metadados tipados, nunca inputs editáveis. Datas sem hora continuam datas; timestamp/recorrência conserva timezone do contrato. Moeda não é presumida pelo símbolo legado `$`. “Indisponível”, blank, zero registrado e valor herdado são estados distintos.

### Seis bindings de paridade de campo

| Fonte | Locators e complemento fechado |
| --- | --- |
| dashboard-budget.ts | `domain.view`, `execute` e `render` por página. Preservar ano próprio, month/revenue/users/benchmark, coleções OPEX/CAPEX, versões por linha, annual-entry/year-amount, desvios e import de OPEX. CAPEX não ganha um Domain command `import` inexistente. |
| dashboard-people.ts | `cioFields`, `leaderFields`, `memberFields`, `topicFields`, `readMembers`, `memberForm` e branch render. Import/exportAllMembers pertence a Talent Review; Estrutura apenas aponta quando autorizado. |
| dashboard-portfolio.ts | `names.projects/risks/contracts/stakeholders`, `recordFields`, `publicRecord`, `renderMilestones`, `itemFields`, `subFields`, `publicPerformance`, `renderPerformance`, `perfSubs`. Preservar watch/watchList, moeda, itens/subitens e marcos; não derivar principal de nome/email. |
| dashboard-operations.ts | `ticketFields`, `periodFields`, `kpiFields`, action map e branches render/execute. Mês de Operations e referência de Security independentes; import-month explicita substituição e versões de catálogos. |
| planner.ts | `fieldsByCollection`, `plannerHeadcountInputs`, `publicPositionFields`, `renderPage`, `renderHeadcount`, `executeVersions`, `executeLists`, `workbookForm`. Valores mensais dinâmicos `b/a/f` de 0 a 11 pertencem à mesma linha/base. Variantes `closed` e `split` abaixo não são campos normais de linha. |
| procurement.ts | `prFields`, `sourceFields`, `poFields`, `supplierFields`, `bankFields`, `settingsFields`, `inputs`, `structuredInput`, `scalarFields`, `repeatRows`, `render` por página e execute/settings/supplier. Nested quotes, lines, weights, criteria, levels, contacts, commercial e compliance seguem os controles/inputs desses locators, não uma caixa JSON. |

### Planner: grid e variantes que não podem desaparecer

CAP18/19 têm leitura e edição separadas. Primeiro escolher ano, versão e recorte autorizado; só então editar. Linhas mostram descrição/ID secundário, owner, entidade/alocação, elemento/projeto, moeda e total com origem. O editor de detalhe conserva todos os campos do locator, mesmo quando o grid mostra só as colunas de trabalho. OPEX tem estrutura por elemento; CAPEX tem projeto/classificação; HR usa seu contrato próprio e não exibe salário por derivação de total/tooltip.

Cada célula mensal expõe mês, unidade, estado e fonte. Valor efetivo herdado mantém a referência de origem; editar cria o override permitido pelo produtor, limpar remove ou zera somente conforme semântica explícita do campo. Nunca transformar blank em zero ou copiar uma fórmula calculada para um input. Meses fechados são texto/ícone/estado, não apenas cor; editar actual fechado depende da operação admitida. O browser pode formatar e ordenar a projeção, não recalcular budget/actual/forecast/outlook, FX, rateio ou salário.

OPEX `save` tem variantes disjuntas: `{versionId, closed}` altera mês fechado (0–12, sob autoridade original), `{versionId, el, split}` altera estrutura do elemento sob permissão `structure`, e o payload de linha segue `fieldsByCollection.lines`. `closed`/`split` não se misturam com campos de célula. HR permanece breakdown; a regra de múltiplas linhas e mudança de split é do produtor. Spread/reset mostram escopo e prévia; se falta contrato de prévia, não simular resultado financeiro no browser. Workbook preserva formato/abas/opções de import originais.

Teclado do grid: um tab stop entra/sai da região; setas navegam células sem salvar; Enter/F2 inicia edição admitida; Escape cancela a edição da célula e conserva o draft de outras células; Tab/Shift+Tab no input valida a edição local e segue a sequência da página, sem salvar domínio. Home/End operam a linha; Ctrl+Home/Ctrl+End os extremos carregados da região; PageUp/PageDown movem a quantidade visível de linhas. Sem wrap nas bordas. A navegação não edita células readonly. Copiar dados usa escopo autorizado; **range/TSV é obrigatório**. Shift+setas seleciona retângulo; Ctrl/Cmd+V dispara `SfPasteRequest` com TSV original (sem heurística local de número e sem truncar vazios finais). Parser delimitado por tab/CRLF/newline preserva row-major e mapeia mês do grid 0..11 para mês do host 1..12 exatamente uma vez. Excesso de linhas/meses, range irregular, readonly/locked, versões ausentes e células inválidas aparecem em preview sem submissão silenciosa. A02 prepara `MonthlyDraft` por linha com revision do produtor, chama `planner.monthly.preview` e só após revisão explícita `planner.monthly.apply`; partial commit conserva tentativas falhas, remove apenas linhas confirmadas, reenvia somente correções em nova intenção. Retorno 503/outcome-unknown não autoriza replay; refetch e resposta por linha preservam CAS e semântica real. Mobile 320px mantém entrada TSV multi-linha e prévia acessível, não reduz à célula única. `monthly-edit/monthly-host` é autoridade de parser/preview/aplicação; não duplicar lógica financeira no browser. Referência de interação: [APG Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/).

### Procurement: etapas e ownership

U11 possui lista/editor de pedido e PR/PO; U12 possui sourcing e comparação; U13 possui review/aprovações. O header e route builder são compartilhados. Cada etapa usa o mesmo requestRef, versão e snapshots do produtor; a divisão de código não cria três pedidos nem stores concorrentes.

| Etapa | Ordem e field binding | Ações admitidas na superfície |
| --- | --- | --- |
| Requisição | `prFields`; identidade/assunto, necessidade e descrição, custo/moeda/classificação, datas, recorrência, justificativa; anexos como evidência autorizada | create/save/submit_pr; delete apenas no draft admitido; cancel é ação separada com motivo |
| Sourcing | `sourceFields` e nested quote fields em `structuredInput`/`render`; ofertas, evidências, comparação técnica/comercial, FX/base, seleção e justificativas | save, select_quote, submit_sourcing; nenhuma seleção reescreve a cotação ou aplica impacto financeiro |
| PO | `poFields` e nested lines; fornecedor/quote/fonte, itens, moeda/tipo, termos/pagamento/entrega, contrato/asset, endereços, aceite/garantia/notas | save, submit_po, issue quando admitido; emissão interna conserva recibo original |
| Aprovação | Snapshot PR/sourcing/PO submetido; holder e etapa, fonte/base, valor/currency/FX, alterações e bloqueios | approve/reject explícitos; sem salvar uma edição do requester/buyer |

Preenchimento herdado mostra fonte e versão; campo negociado manualmente não é sobrescrito por refetch ou por nova cotação. A ação de restaurar valor de origem, quando oferecida pelo produtor, é explícita. Exclusão do draft usa `deleteDraft` por `Requests/delete`; cancelamento usa `cancel` e motivo. My approvals continua fila de revisão e aponta para o pedido; os aliases admitidos pelo dispatcher estão registrados sem duplicar editor.

Suppliers usa Geral, Contatos, Comercial, Compliance, Banco, Pedidos e Auditoria na ordem fixada. `bankFields` só existe na projeção autorizada; mascaramento não substitui redaction. Ativar/bloquear/inativar/excluir/change-bank permanecem comandos separados. U36 possui Settings, com groups/listas/approval holders, FX, critérios e endereços definidos por `settingsFields`/`repeatRows`; reset continua ação secundária revisada. U28 possui administração local; notificações/backup-export/backup-import só aparecem no perfil local operator admitido e não viram concessão de papel para Microsoft/cloud.

## PATTERN-01 — Compositores compartilhados

`fixedSectionOrder` no manifesto fixa a ordem semântica. Uma seção sem dado fica vazia/indisponível conforme contrato; não desaparece de modo a fingir cobertura. Campos autorizados que não cabem na primeira dobra ficam na seção correspondente, nunca atrás de uma navegação sem rótulo.

| Pattern | Contrato de composição |
| --- | --- |
| overview | Header/contexto; até quatro medidas; explicação/gráfico + tabela; fatores/compromissos; fonte e drilldown. |
| collection | Toolbar/filtros; tabela ou lista; seleção/detalhe; edição explícita; retorno preservado. |
| queue-detail | Fila ordenada por fatos do produtor, holder e próxima ação; detalhe/review da versão submetida. Datas ausentes no grupo definido pela fonte, sem aging inventado. |
| monthly-grid | Grid S02 + row editor + barra draft S03; contexto/versão e meses sempre identificados. |
| object-sections/settings-sections | Seções na ordem do manifesto; um submit do escopo permitido; tabelas nested preservam IDs; dangerous actions separadas. |
| request-flow | Header de pedido, progressão original, etapa atual, fonte, anexos e histórico; PR/sourcing/PO são páginas de trabalho. |
| hierarchy | Lista de itens/subitens com profundidade explícita; pesos e total calculados pelo produtor; editar item não reordena irmãos. |
| comparison | Base/seleção, critérios na mesma ordem, consequência e cobertura, condições, fonte; escolha humana separada do cálculo. |
| review | Objeto/versão/escopo → diferença/efeito → impedimentos → ação explícita → resultado original. |
| receipt | Resultado autoritativo, identidade, efeito por domínio, pendências, histórico e recuperação. Nenhuma mutação ao carregar. |
| run | Objetivo/inputs, estado real, needs-input/cancelamento, resultado e continuação contextual. Não transformar texto gerado em efeito aprovado. |
| analysis | Parâmetro/unidade/base, visual + dados, cobertura, limites e fonte. Não inferir probabilidade ou causalidade. |
| catalog | Pergunta/tarefa, disponibilidade/coverage e seleção; detalhe explica entradas/versão antes de iniciar. |
| selection/presentation | Conteúdo preservado e períodos por seção; ordenação explícita. Apresentação usa o conteúdo preservado autorizado, sem substituí-lo pela projeção viva. |
| import-flow | Arquivo/destino, parsing/normalização, preview e impacto, versão-base, apply/receipt em rotas distintas. |
| document-evidence | Documento/revisão, trecho original, candidato e fato confirmado distintos; mesma evidenceRef para cenário e dossiê. |
| discussion | Origem/escopo, mensagens com incarnation/version, draft, pending/resultado. Comentário e resposta não aprovam decisão. |
| export | Recorte/versão/formato, cobertura, progresso e download autorizado; export completo conserva notas/registros e continuação. |
| administration/context | Perfil/owner e disponibilidade reais; operador local explicitamente identificado; nenhuma affordance eleva autorização. |

`run-common` distingue fila, em execução, needs-input, cancelamento solicitado, cancelado, falha, parcial, concluído e stale quando esses estados são suportados pelo produtor. O código usa os literals de `SfRunPhase`: cancelamento solicitado → `cancelling`, concluído → `complete`. Antes de haver run real, `SfRunIdentity.kind=unadmitted`; não exigir runRef, receita ou versão inexistentes para mostrar unavailable/ready. Não encerrar visualmente o run ao enviar cancelamento antes de ele confirmar. Resultado parcial conserva cobertura. Documento substituído, parser ocupado, scanner indisponível e acesso perdido usam as razões do envelope e ações correspondentes; não os comprimir em “sem documento”.

### Rotinas, recorrência e residentes: contexto exato

UI64 usa o envelope `caseRef` das operações routines de CONTRACTS §5.4. A entrada contextual pré-seleciona **um caso existente e autorizado**, após revalidar ref/incarnation/version. A entrada pelo catálogo mostra “Escolher um caso existente” antes de chamar esse seam. Sem caso autorizado, mostrar `needs-input` com `noAuthorizedCase` e navegação explícita “Abrir casos”; não criar caso fictício, não escolher o primeiro silenciosamente e não executar sem o contexto requerido. Essa exigência é da operação routines, não de relações ou tarefas simples de UI51.

UI66 usa inputs diretos de `BusinessPorts.schedules`: conditionRef/recipeRef/recurrence/timezone para create; scheduleRef/expectedVersion/recurrence/timezone para update; ref/versão para pause; sem caseRef acrescentado. A listagem atual fornece somente ref/versão/estado. **Update depende do detalhe atual autorizado**, obtido por `POST /api/ui/schedules/read` através da nova porta privada opcional `nativeUiProducts.scheduleDetails.read` fechada em CONTRACTS/host-signatures. Ela retorna ref/versão/estado/condição/receita/recorrência/fuso. Porta ausente retorna `schedule-detail-port-unavailable`: exibir `currentScheduleUnavailable` e manter update indisponível. Não oferecer edição com valores atuais desconhecidos, prefill inferido ou acesso direto a core Schedule. Create, pause e list mantêm admissão independente. Condição/receita são seleções de origem autorizada; ausência de serviço mantém unavailable/HOLD sem botão de sucesso simulado.

UI70 usa a projeção de residentes fechada no catálogo, a partir de `SfHostServices.selected` com allowlist pública, e envelopes de contribuição reais via operações existentes. O `analysis.choices` observado lista somente duas skills de import/forecast e não pode representar sozinho os cinco perfis/dezoito skills. Contagens 5/18/8/39 são cobertura do produto, não valores fabricados para uma instalação que fornece subset. UI70 mostra o que a projeção autorizada instalou; diagnóstico técnico é sob demanda e nunca inclui source paths, instruções privadas ou configuração de credencial.

## BI-01 — Semântica e errata normativa das pranchas

BI01–BI11 são IDs de prova, não títulos da interface. Usar pergunta/título de negócio da projeção/catálogo; ID técnico fica apenas no diagnóstico autorizado e nos artefatos de teste. BI01 conserva Budget, Actual e Outlook/forecast conforme contrato, corte e cobertura; actual ausente deixa lacuna real, zero registrado continua zero. A legenda simplificada da prancha 2 não autoriza remover Actual. Todo gráfico tem tabela equivalente do mesmo resultado, mesma ordenação/recorte/unidade, com fontes acessíveis por teclado.

BI05/06 não inventam data de entrada nem dias de aging; BI07 não cria séries históricas a partir de um mês; BI08 mantém marcos reais. BI09–BI11 preservam composição, consequência, parâmetro/unidade/base e condições; ausência de cobertura não ganha selo de recomendação. Chart/table/drilldown usam o mesmo selectionRef/result, sem refazer cálculo no cliente.

F04 mantém um corpus determinístico por identidade/owner/ano/versão. Pedido, oferta, cenário, receipt e gráfico que aparentem ser o mesmo exemplo devem referenciar o mesmo ID e recorte; uma oferta 2027 pode existir com hipótese 2026 somente quando o fixture declara a relação. Nomes similares em pranchas diferentes não são identidade canônica. A prancha 16 mostra 360px; não constitui prova de 320px nem apresenta overflow de título comprovado. Temas mostrados não reduzem a lista de temas a qualificar.

## COPY-01 — Texto, chaves e idiomas

O manifesto congela `titleCopy` e `primaryCopy` por entrada (`sf.cap01.title`, `sf.cap01.primary`, etc.), com valores `en` e `pt-BR`; `copy.shared` congela loading/empty/error/context/navigation/draft e ações novas. Esses são textos de produto; CAP/UI/BI/WP não aparecem em rótulo para o usuário. `primaryActionIntent` seleciona a intenção padrão, não manda exibir um botão de mutação em qualquer estado. A ação admitida atual pode ser leitura/retorno ou estar indisponível.

Para um label/opção/erro herdado, o inglês é literal do locator pinado, byte por byte. Chave determinística: `sf.<capability-lower>.field.<dot-path>.label` para campo; `.option.<enum-token>` para enum; `.action.<action-id>` para controle, com underscores apenas para caracteres que não são válidos no sistema tipado de chaves. Índices de array não fazem parte da chave; usar o path do item (`quotes.item.currency`). Não serializar valor de dado no nome da chave. Se duas fontes têm inglês diferente, as chaves permanecem separadas. Não mudar source English para facilitar tradução.

Textos novos e decisões de título/ação listados no manifesto são mudanças deliberadas desta UX. Demais mensagens de negócio continuam sendo as já tipadas no catálogo e source; erro desconhecido usa a mensagem genérica congelada + correlação técnica no diagnóstico, preserva draft e bloqueia a ação, sem inventar tradução ou reinterpretar status. Valores dinâmicos são placeholders tipados; mensagens completas, nunca fragmentos concatenados. Plurais usam a API comum, não lógica por locale no componente.

F03 possui `sf.common.*`; cada folha possui suas chaves de superfície e de campos nos arquivos definidos na work order. I00 importa/registra os fragmentos. Um consumidor reutiliza a chave compartilhada, não copia a tradução em outro arquivo. **Decisão fechada para a migração:** uma tradução pt-BR já existente na fonte pinada é reusada; quando a baseline não possui tradução, conservar em pt-BR exatamente o literal source English existente. Classificar essa igualdade no recibo como `legacy-source-copy-preserved`, decisão explícita deste plano para evitar tradução improvisada. Não há tarefa lexical deixada ao executor, nem exigência de escolher novos sinônimos antes de implementar. As novas strings de produto têm ambos os idiomas literais em `titleCopy`, `primaryCopy` e `copy.shared`; nenhuma nova mensagem pode usar esse fallback. Expansão editorial posterior é trabalho separado, com a política de corpora do `packages/app-shell/AGENTS.md`, sem mudar o escopo desta migração.

## COPY-02 — Diálogo nativo de conexão desktop

D01 possui `apps/desktop/src/main/sucafina/copy.ts`, com exports `SF_DESKTOP_COPY` e `SF_DESKTOP_COPY_BR`. Estes cinco textos são nativos do main, separados de F03/shared; não importar app-shell no main. Resolver idioma com `app.getLocale()`: prefixo `pt` usa pt-BR; os demais usam en. `connectionDetail` contém uma quebra de linha real, representada abaixo por `\n`; placeholders são somente a origin canônica e projectId validados do servidor selecionado.

| Chave | en | pt-BR |
| --- | --- | --- |
| sf.desktop.connectionTitle | Connect Sucafina | Conectar Sucafina |
| sf.desktop.connectionPrompt | Allow Sucafina to connect to this server? | Permitir que a Sucafina se conecte a este servidor? |
| sf.desktop.connectionDetail | `{origin}\nProject: {projectId}` | `{origin}\nProjeto: {projectId}` |
| sf.desktop.cancel | Cancel | Cancelar |
| sf.desktop.connect | Connect | Conectar |

Ordem dos botões: Cancelar, Conectar. `defaultId=0` e `cancelId=0`; fechar ou Escape cancela. Os literais e ownership estão também em `copy.desktop` do manifesto. Nenhum executor decide nova copy, idioma, ordem ou opção padrão desse consentimento.

## A11Y-01 — Interação comum

S01–S05/F03 implementam foco, semântica e estados uma vez; páginas compõem sem reimplementar. Cada página tem título/landmark e ordem de leitura equivalente à visual. Status não depende apenas de cor. Indicadores de carregamento/progresso não anunciam cada frame; resultado/erro material usa região viva adequada. Erro de formulário liga mensagem ao campo e mantém os valores.

Somente um modal por vez; foco inicial no primeiro controle apropriado ou título, trap dentro de modal, Escape conforme o fluxo, e retorno ao trigger existente. Para confirmação destrutiva, foco inicial na opção segura; formulário longo e comparação ficam em página, não em modal. Referência: [APG Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). Painel não modal não aprisiona foco; seu fechar/retorno é teclado-acessível. No grid, usar o contrato de teclado da seção Planner; tabela de leitura conserva semântica de tabela.

Nenhum valor sensível aparece em tooltip, gráfico, total, aria-label, DOM oculto, busca, erro ou export se foi redigido na projeção. Download revalida acesso. O leitor de tela recebe mês/unidade/estado/origem de célula; descrição de chart remete à tabela equivalente. Reduced-motion evita movimento de linhas sob interação. Foco não muda por refetch decorativo.

## Paridade de comandos e método de verificação

O manifesto enumera **109 controles CAP/comando** e **14 aliases adicionais admitidos pelos dispatchers**. Portfolio Dashboard aceita os cinco comandos da coleção Projects, mas sua composição de revisão aponta para manutenção; My approvals aceita aliases de Requests, mas sua composição é fila + revisão, sem um segundo editor. Cada alias conserva source page/autoridade original. Não confundir lista de comandos admitidos com autorização concedida ao ator ou com obrigação de duplicar controles.

O confronto dos seis arquivos extrai literais `command.action ===/!==`, listas `.includes(command.action)` e o mapa de ações de Operations; a aplicabilidade por page/collection foi conferida por leitura dos branches. `commandParityAudit` registra linhas, literais observados, IDs mapeados e limites do método. Nenhum literal observado ficou sem mapeamento. Isso é inventário documental limitado, **não** análise de controle de fluxo TypeScript, compilação, teste de acesso ou prova de runtime.

As correções concretas incluem `Requests/delete` separado de cancel; import/exportAllMembers em Talent Review; ausência de CAPEX Projects/import no Domain; OPEX closed/split; roles Dashboard para Contracts; reset de Settings explícito. Checks futuros usam cada action source/route/input/result, não só screenshots ou contagem de botões.

## Índice das 70 entradas

A tabela é um índice de leitura. Rotas de criação/detalhe/edição/review, contributors, campo source, section order, inputs/outputs, commands e cópia estão nas entradas de mesmo ID do manifesto. A propriedade `primaryOwner` indica quem escreve a composição; contributors não ganham acesso aos paths alheios.

| ID | Composição | Owner | Entrada | Pattern |
| --- | --- | --- | --- | --- |
| CAP01 | Visão executiva | U02 | `/orchestra/sf-dashboard/executive` | overview |
| CAP02 | Hot Topics e ações | U38 | `/orchestra/sf-dashboard/hot-topics` | collection |
| CAP03 | Visão do orçamento | U02 | `/orchestra/sf-dashboard/budget` | overview |
| CAP04 | Detalhe OPEX | U39 | `/orchestra/sf-dashboard/opex` | collection |
| CAP05 | Projetos CAPEX | U40 | `/orchestra/sf-dashboard/capex` | collection |
| CAP06 | Visão de headcount | U03 | `/orchestra/sf-people/overview` | overview |
| CAP07 | Estrutura da equipe | U03 | `/orchestra/sf-people/structure` | collection |
| CAP08 | Avaliação de talentos | U47 | `/orchestra/sf-people/talent` | collection |
| CAP09 | Visão do portfólio | U05 | `/orchestra/sf-portfolio/overview` | overview |
| CAP10 | Projetos | U05 | `/orchestra/sf-portfolio/projects` | collection |
| CAP11 | Serviço de TI | U04 | `/orchestra/sf-operations/service` | overview |
| CAP12 | Segurança de TI | U29 | `/orchestra/sf-operations/security` | collection |
| CAP13 | Riscos de TI | U30 | `/orchestra/sf-operations/risks` | collection |
| CAP14 | Contratos com fornecedores | U15 | `/orchestra/sf-procurement/contracts` | collection |
| CAP15 | Relacionamento | U30 | `/orchestra/sf-operations/stakeholders` | collection |
| CAP16 | Contrato de performance | U31 | `/orchestra/sf-operations/performance` | hierarchy |
| CAP17 | Visão do Planner | U06 | `/orchestra/sf-planner/overview` | overview |
| CAP18 | OPEX | U07 | `/orchestra/sf-planner/opex` | monthly-grid |
| CAP19 | CAPEX | U07 | `/orchestra/sf-planner/capex` | monthly-grid |
| CAP20 | Headcount | U08 | `/orchestra/sf-planner/headcount` | monthly-grid |
| CAP21 | Entidades e alocações | U09 | `/orchestra/sf-planner/allocations` | collection |
| CAP22 | Câmbio | U45 | `/orchestra/sf-planner/fx` | collection |
| CAP23 | Versões | U46 | `/orchestra/sf-planner/versions` | collection |
| CAP24 | Visão de Procurement | U10 | `/orchestra/sf-procurement/overview` | overview |
| CAP25 | Pedidos | U11 | `/orchestra/sf-procurement/requests` | request-flow |
| CAP26 | Minhas aprovações | U13 | `/orchestra/sf-procurement/approvals` | queue-detail |
| CAP27 | Fornecedores | U14 | `/orchestra/sf-procurement/suppliers` | object-sections |
| CAP28 | Configuração | U36 | `/orchestra/sf-procurement/settings` | settings-sections |
| UI29 | Hoje | U01 | `/orchestra/sf-home` | overview |
| UI30 | Meu trabalho | U41 | `/orchestra/sf-work` | collection |
| UI31 | Busca | U42 | `/orchestra/sf-home/search` | collection |
| UI32 | Vistas salvas | U43 | `/orchestra/sf-work/views/:viewId` | object-sections |
| UI33 | Decisões | U16 | `/orchestra/sf-decisions` | collection |
| UI34 | Resumo do caso | U16 | `/orchestra/sf-decisions/:caseRef` | object-sections |
| UI35 | Alternativas | U17 | `/orchestra/sf-decisions/:caseRef/alternatives` | comparison |
| UI36 | Premissas | U17 | `/orchestra/sf-decisions/:caseRef/assumptions` | collection |
| UI37 | Perguntas | U17 | `/orchestra/sf-decisions/:caseRef/questions` | object-sections |
| UI38 | Escolha atual | U18 | `/orchestra/sf-decisions/:caseRef/choice` | review |
| UI39 | Mudanças preparadas | U18 | `/orchestra/sf-decisions/:caseRef/changes/:changeRef` | review |
| UI40 | Resultado da aplicação | U18 | `/orchestra/sf-decisions/:caseRef/receipts/:receiptRef` | receipt |
| UI41 | Análise | U37 | `/orchestra/sf-decisions/:caseRef/analyses/:analysisRef` | run |
| UI42 | Cenários de portfólio | U19 | `/orchestra/sf-portfolio/scenarios/:caseRef` | object-sections |
| UI43 | Resultados do portfólio | U19 | `/orchestra/sf-portfolio/scenarios/:caseRef/results/:resultRef` | comparison |
| UI44 | Sensibilidade | U19 | `/orchestra/sf-portfolio/sensitivity/:caseRef/:resultRef` | analysis |
| UI45 | Análises | U21 | `/orchestra/sf-bi` | catalog |
| UI46 | Detalhe da análise | U21 | `/orchestra/sf-bi/:viewId` | analysis |
| UI47 | Pauta da reunião | U25 | `/orchestra/sf-reviews/agenda` | selection |
| UI48 | Revisão preservada | U32 | `/orchestra/sf-reviews/reviews/:reviewRef` | presentation |
| UI49 | Comparar revisões | U32 | `/orchestra/sf-reviews/compare` | comparison |
| UI50 | Relatório | U33 | `/orchestra/sf-reviews/reports/:reviewRef` | export |
| UI51 | Relações entre registros | U44 | `/orchestra/sf-work/relations/:relationRef` | object-sections |
| UI52 | Discussão | U44 | `/orchestra/sf-work/threads/:threadRef` | discussion |
| UI53 | Confirmar sem alteração | U44 | `/orchestra/sf-work/confirmations/:selectionRef` | review |
| UI54 | Proposta de encaminhamento | U38 | `/orchestra/sf-dashboard/hot-topics/proposals/:proposalRef` | review |
| UI55 | Importar arquivo | U23 | `/orchestra/sf-imports/new` | import-flow |
| UI56 | Prévia da importação | U23 | `/orchestra/sf-imports/:manifestId/preview` | import-flow |
| UI57 | Resultado da importação | U23 | `/orchestra/sf-imports/:manifestId/receipt` | receipt |
| UI58 | Documentos | U24 | `/orchestra/sf-documents` | collection |
| UI59 | Evidência do documento | U24 | `/orchestra/sf-documents/:documentRef/evidence` | document-evidence |
| UI60 | Evidência no cenário | U24 | `/orchestra/sf-documents/:documentRef/scenario` | review |
| UI61 | Sinais | U26 | `/orchestra/sf-memory/signals` | collection |
| UI62 | Casos semelhantes | U26 | `/orchestra/sf-memory/cases` | collection |
| UI63 | Previsto e observado | U26 | `/orchestra/sf-memory/outcomes/:selectionRef` | analysis |
| UI64 | Rotinas | U27 | `/orchestra/sf-routines` | catalog |
| UI65 | Resultado da rotina | U27 | `/orchestra/sf-routines/runs/:runRef` | run |
| UI66 | Recorrência | U34 | `/orchestra/sf-routines/schedules/:scheduleRef` | object-sections |
| UI67 | Contexto e acesso | F01 | `/orchestra/sf-home/context` | context |
| UI68 | Exportações | U23 | `/orchestra/sf-imports/exports` | export |
| UI69 | Administração local | U28 | `/orchestra/sf-home/administration` | administration |
| UI70 | Contribuições | U35 | `/orchestra/sf-routines/residents` | catalog |

## Critério de fechamento deste suplemento

Antes de despacho: 70 IDs únicos, 15 chapters únicos, owners válidos no manifesto operacional, cada resource ligado a família de contrato, rota com builder único, comandos/aliases preservados, fields/dicionários resolvidos na release e PDF conceitual com errata explícita. O root ou revisor independente confere a correção; este autor não se concede PASS da própria revisão.

Durante execução: um recibo de artefato pode declarar implementação estática pronta e manter bloqueio de integração/qualificação por produtor. M31/MI07, P03, Reports, Schedule, Native41 e demais dependências canônicas permanecem bloqueios reais. Nenhum componente nativo pode transformá-los em sucesso visual. O aceite só ocorre no composto/candidato autorizado com provas originais e regressão causal do dispatch, sem repetir trabalho já validado sem motivo.
