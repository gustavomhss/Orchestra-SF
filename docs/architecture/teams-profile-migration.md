# Orchestra-SF — migração de profile por repositório para Teams

## 0. Estado, escopo e força da evidência

**Data do estudo:** 19/11/2026, America/Sao_Paulo.  
**Repositório:** gustavomhss/Orchestra-SF.  
**Base lida:** `sf-join-four@f7dd58e32bc834f1485df20b91adbf759b4c4ad0`.  
**Tree:** `871b534fa92d22d6783305aaa73a8c521819f448`.  
**Entrega:** estudo de código e plano de implementação. **Implementação: NOT_STARTED. Testes desta mudança: NOT_RUN. Migração de dados reais: NOT_RUN.**

A base foi verificada no GitHub: as frentes recentes de integração apontam para `sf-join-four`. A branch default continua sendo `dev`; não foi usada como substituta silenciosa da base do produto. Este pin é uma referência de integração observada, não uma declaração de release aprovada. Antes da execução, atualizar o pin e reconciliar os deltas, especialmente as frentes de shell, owner, host e CI ainda em andamento.

O estudo teve três frentes de leitura: runtime/configuração; identidade Microsoft/autoridade do produto; interface/persistência/Dock. A consolidação examinou também CI, integridade de sessões e consumidores que executam sem a tela aberta. Foram enumeradas árvores completas de nomes de arquivos nos principais pacotes e lidos os produtores e consumidores centrais. **Não houve busca textual integral em todos os blobs do monorepo, execução de aplicação, validação no tenant, nem prova de ausência de resíduos.** A busca de código do GitHub cobre a branch default e não serve para certificar o pin estudado.

**Rechecagem de integração:** durante a revisão, `sf-join-four` avançou para `a5b15b51b78469a054ba97b0e87fd1e36e31f73a` (merge #399). O compare completo do pin até esse head contém dois commits e altera apenas `private-admission.check.ts` e o helper E2E `operations-support/installation.ts`: inicialização do host real e observações do scanner. Os patches foram lidos; não alteram os produtores centrais de profile/identidade aqui estudados. Os ajustes de fixture devem ser preservados na execução. A branch documental continua baseada no pin declarado; isso não congela nem aprova a branch de integração.

O arquivo [teams-profile-inventory.json](./teams-profile-inventory.json) é o inventário inicial rastreável: distingue evidência lida, destino proposto, testes existentes e verificações ainda obrigatórias. Sua existência não significa cobertura integral ou aprovação da mudança.

## 1. Objetivo e decisões de produto

Remover a função de **identidade, seleção, configuração e isolamento de profile derivada de repositório** no Orchestra-SF. O usuário entra com sua identidade corporativa, e o produto resolve seu contexto a partir de Teams/Microsoft Graph/Entra e das políticas locais autorizadas.

Critério central: o Orchestra-SF deve iniciar, escolher o contexto permitido, navegar, criar trabalho, retomar sessões e executar suas jornadas **sem repositório aberto, sem Git, sem pasta que represente uma equipe e sem fallback de profile para cwd/global**.

Decisões para orientar a implementação:

1. Microsoft é a origem de usuários, grupos, equipes e relações organizacionais. O Orchestra não vira um segundo cadastro manual de identidades.
2. Configuração do produto e vínculos grupo→papel são gravados, versionados e auditados somente no store da instalação. Nenhuma alteração de profile escreve em Entra/Teams.
3. O profile de equipe não concede permissões. Continuam existindo autenticação, papéis por superfície, grants explícitos, regras do recurso e restrições de execução.
4. Preservar o shell nativo, os temas, glass/blur, geometria e guardas de navegação. A mudança troca o fundamento do contexto e suas affordances; não pede outro produto visual.
5. Preservar as três superfícies de negócio e suas 15 ROWS: Dashboard (admin, domain leader, contributor, viewer), Planner (admin, finance, hr, budget owner, viewer) e Procurement (requester, buyer, approver, supplier admin, admin, viewer). [S01]
6. A administração suprema deve usar o grupo corporativo configurado pelo dono, com negação no backend e ausência de affordances para quem não pertence a ele. A implementação desse requisito **não foi comprovada nos fluxos lidos**; deverá ser localizada/integrada, sem hardcode de nomes de pessoas.
7. Não recriar o console legado descomissionado. Entrada, erro, retomada e testes devem usar as superfícies nativas.
8. Todo desenvolvimento posterior usa branches isoladas. Verificação por GitHub Actions no Linux x64 definido para SF. Este estudo não dispara `sf-ci`, não modifica Azure e não altera código de produto.

### O significado de “sem resíduos”

Ao concluir a execução, não pode haver produtor ou consumidor **ativo no produto SF** que derive o profile de remoto Git, project/worktree/directory, pasta confiável ou ausência de seleção.

Isso inclui caminhos indiretos: restauração de storage, novo chat, atalhos, deep links, mobile, SDK, eventos, jobs agendados, readoção de sessão, geração de tools, credenciais e discovery de instalação.

Uma referência histórica numa migração imutável, uma localização de arquivo ou um profile de workflow não é automaticamente repo-profile. Cada ocorrência mantida precisa de classificação e evidência de que não seleciona nem autoriza o profile SF. Código específico do modelo antigo que fica sem consumidor deve ser removido, não escondido por flag. Não será aceita uma exclusão ampla de diretórios para “zerar” o scanner.

## 2. Diagnóstico comprovado no código

| Frente | Evidência observada no pin | Implicação |
|---|---|---|
| Seletor de profile | `sidebar.tsx` deriva profile de servidor, seleção de diretório, sessão e raiz de projeto; lê agentes, branch Git e pendências por diretório. | Trocar texto/menu não resolve a identidade. [S02] |
| Home e montagem de capítulos | `layout.tsx` persiste `{server,directory}`; `chapter-route.tsx` usa servidor + path como owner e monta SDK/Models por diretório. | Mudar seleção, restauração, montagem e dependências conjuntamente. [S03][S25] |
| Abas e novo chat | Titlebar/filtro de tabs usam raiz de projeto; sem diretório o filtro admite todas as abas do servidor; novo chat pode cair no primeiro projeto ou abrir pasta. | “Sem equipe” não pode significar “todas as abas”. [S04][S26] |
| UI estreita | Home sem sidebar ainda usa `HomeProjects`; Apps Panel muda a semântica de profile no breakpoint de 768 px. | A mesma identidade precisa valer em todos os breakpoints. [S05][S27] |
| Cache/eventos | Queries e distribuição de eventos usam directory; persistência possui chaves de workspace e aliases legados. | Troca A→B exige novas chaves e descarte de respostas de A. [S06][S28][S29] |
| Browser/Dock | `appDockProfile` cria `repo-` + FNV64(server,directory). Registry associa profile a storageKey; IDs aceitam até 32 caracteres; cookies têm partição persistente. | Não substituir por GUID truncado nem compartilhar cookie jar entre usuários. [S07][S30] |
| Projeto/Location | `Project.resolve` usa remoto Git, cache e root commit; sem Git retorna `ProjectID.global`. Location tem directory/workspace e resolve projeto. | Cwd/Git não podem continuar como fonte do profile empresarial. [S08] |
| Serviços do runtime | `LocationServiceMap` monta serviços por Location, incluindo consumidores que capturam config/profile na construção. | Mesma pasta em equipes distintas não pode reutilizar um contexto privilegiado. [S09][S31] |
| Sessões | `project_id` obrigatório com FK cascade; create pode retornar sessão pelo ID antes de resolver Location; archive filtra antes da paginação. | Migrar ownership e autorização sem apagar histórico; negar readoção entre equipes. [S10][S32][S33] |
| Configuração | Discovery de `orchestra.json/.orchestra`, plugins de agent/skill e instruções herdam o diretório e a confiança do projeto. | Arquivos do cwd não podem controlar agentes, modelos, tools ou política do profile SF. [S11] |
| MCP/Arsenal/ToolSafety/Relay/Lean | Stores e hooks derivados de projectID; Lean deriva hash(projectID,directory); MCP escreve config de projeto e pode confiar na pasta. | Migrar todos os leitores/escritores e preservar restrições de execução. [S12][S34][S35][S36][S37] |
| Identidade Microsoft | JWT e tenant verificados; grupos imutáveis e membership relido; roleMap e grants explícitos. | Reutilizar a autoridade existente; não confiar no Team enviado pelo browser. [S13] |
| Diretório Teams | `graphDirectory?` existe como contrato, mas o cliente/factory lidos não o implementam; modo web pede User.Read e directory retorna só /me. | Implementar capacidade de diretório/Teams; não presumir integração já pronta. [S14] |
| Dados SF | `installation.sqlite` tem snapshots por surface, não por repositório nem por time; bootstrap preserva mapas existentes, inclusive vazios. | Não repartir dados empresariais ou reseedar acessos por causa da mudança de profile. [S15][S38] |
| Autoridade nativa | `projectId` participa de discovery, owner, accessRevision, sessões e tickets. | Substituir o vínculo de negócio com equivalência das guardas, não apenas remover campos. [S16] |
| CI | SF cobre suas suites; não executa por si todos os testes de core, server, Arsenal, Relay ou Dock afetados. | Verde de SF sozinho não qualifica esta mudança. [S17] |

### Duas diferenças que o plano precisa respeitar

**O contrato Teams ainda está incompleto.** `EntraGraphDirectory` contém users com department/jobTitle/managerId/groupIds e groups com sinalizador team. Porém o caminho web existente foi desenhado para login restrito, inclusive convidados, e seus testes exigem esse comportamento. Ampliar seus escopos silenciosamente seria outra regressão. Criar leitura corporativa explícita, mantendo a autenticação mínima separada da capacidade de listar organização/equipes. [S13][S14]

**“Team Structure” não prova integração com Microsoft.** CAP07 atualmente projeta cio/leaders/members do snapshot e permite saveCio/saveLeader/saveMember. Classificar seus campos: identidade/organograma vem de Graph; dados operacionais próprios de RH podem continuar locais, referenciando Object IDs e sem se converterem em autoridade de acesso. Não apagar histórico de RH nem manter cadastro paralelo de identidade por acidente. [S18]

## 3. Arquitetura proposta

### 3.1 Conceitos separados

Os nomes abaixo são propostas de contrato, não símbolos já implementados.

| Conceito | Identidade/dono | Regra |
|---|---|---|
| Principal autenticado | tenant de recurso + Object ID do usuário | Resolvido no servidor; email/nome não são chaves. |
| TeamProfileRef | installationId + tenantId + teamObjectId | Identidade durável do profile compartilhado; nome é apresentação. |
| Configuração do profile | TeamProfileRef + configRevision | Policies, catálogo e defaults autorizados; gravação com versão e auditoria. |
| Estado pessoal | principal + TeamProfileRef + categoria | Preferências, drafts e histórico privados; não viram propriedade coletiva. |
| Estado da janela | identidade de janela + principal + seleção verificada | Trocar uma janela não troca outra por variável global. |
| Autorização efetiva | principal, membership atual, roleMap, grants e regras do recurso | Independente da seleção visual; restrições de profile só podem reduzir autoridade. |
| Contexto de execução | instalação/host, sessão e Location técnica | Diretório é localização física; não define profile, tenant ou pessoa. |
| Dados empresariais | ownership e grants existentes por recurso/instalação | Profile não transfere casos, documentos, recibos, reuniões ou memória. |

A chave compartilhada não inclui a pessoa; a chave de estado privado inclui. Transporte/origem verificados continuam necessários: o nome do servidor não é identidade de tenant, e tenant sozinho não identifica uma instalação.

Não reutilizar `SessionScope` como esse conceito: ele já representa limites de skills/tools/budgets de sessões filhas. Não converter `ProjectID` em Team ID por cast, prefixo ou pasta fictícia.

### 3.2 Resolução do contexto

Fluxo proposto:

1. Autenticar pelo mecanismo Microsoft existente e verificar tenant de recurso/principal.
2. Obter equipes elegíveis através da capacidade Graph de leitura, com resultado completo e verificável.
3. Cruzar as equipes com os profiles habilitados/política da instalação.
4. Restaurar a última seleção apenas se ela continuar autorizada; se houver exatamente uma opção elegível, selecioná-la; com múltiplas e sem seleção válida, pedir escolha explícita; sem opção, mostrar ausência de acesso.
5. Resolver configuração e direitos atuais no servidor. A UI recebe uma projeção mínima do contexto e seus destinos admitidos.
6. Vincular sessão, cache, eventos, drafts, integrações e execução à identidade/revisão corretas.
7. Revalidar nos pontos de leitura protegida, escrita, admissão, retomada e efeitos; nenhum handle enviado pelo cliente é suficiente por si.

“Graph indisponível”, “capacidade não consentida”, “resultado parcial”, “nenhuma equipe elegível” e “acesso revogado” são estados distintos. Não converter erros em lista vazia nem cair no repo-profile anterior.

A configuração comum pode ser cacheada por TeamProfileRef + configRevision. Serviços que capturam principal, grants, permissões, credenciais ou material privado não podem ser compartilhados apenas por TeamProfileRef: o binding inclui o principal autenticado e a revisão de autoridade, ou esses elementos são fornecidos por chamada, imutáveis. Location técnica compartilhada não compartilha autoridade. Um cache não retorna resultado privado sem verificar o solicitante atual. Isso vale para dois usuários simultâneos da mesma equipe, não somente para trocar de conta.

O contexto de negócio precisa entrar na identidade dos serviços que capturam configuração. Serviços puramente físicos podem continuar compartilhados quando sua independência for provada. Um único resolvedor de profile, consumido pelas fronteiras já existentes, é preferível a um framework paralelo de identidade.

### 3.3 Relação com o Core

A decisão é **desacoplar a identidade de profile do Project/Location**, preservando a função técnica que ainda for necessária. Para o runtime SF, uma identidade técnica privada pode continuar representando execução e referências históricas, desde que não derive do repositório do usuário, não apareça como profile e não forneça permissões.

Isso exige implementação real: não basta renomear `projectId` para `teamId` ou criar um Git repo de cada equipe. Onde o Core ainda exige project_id, planejar a associação técnica e o novo scope de profile de modo explícito e versionado, antes de alterar as FKs. Ownership novo de sessões deve ser durável, verificável e usado nas consultas do servidor.

Histórico e eventos antigos não serão reescritos para afirmar que sempre pertenceram a uma equipe. Um mapa de migração auditável vincula o que pode ser vinculado; o restante permanece retido sem acesso indevido. O destino definitivo de cada leitor/escritor antigo precisa constar no inventário.

### 3.4 Fronteira de autenticação e transporte

A identidade Microsoft instalada é restrita à origem e ao mount; seu cookie tem Path do mount. A autenticação geral do host usa outra autoridade: Basic de host quando configurado, passthrough quando não há senha nessa camada; capabilities podem resolver operador. Esses fatos **não provam por si um bypass na instalação em produção**, pois é preciso conferir alcance e montagem. Provam que login Microsoft e autorização geral do host não podem ser presumidos equivalentes. [S39][S40][S41][S42]

WP1/WP3 devem mapear todos os entrypoints HTTP, SSE, WebSocket, IPC e chamadas internas que alcançam profiles, sessões, eventos, configuração e ferramentas. Cada caminho protegido SF recebe contexto de principal/equipe admitido pelo servidor, ou permanece privado e acessível apenas por mediação confiável da instalação.

A decisão padrão é manter os serviços internos mediados pela autoridade corporativa existente; qualquer exposição direta requer a mesma admissão explícita. Basic de host, bearer de operador, Session ID conhecido e Team ID enviado pelo cliente não representam a identidade corporativa do usuário nem concedem acesso a seus dados. A autorização precede seleção de serviços, leitura de sessão e emissão de resultados/eventos.

Não ampliar Path de cookie como atalho, expor token Graph no renderer, aceitar principal de header arbitrário ou criar segunda sessão permissiva. Alteração de transporte/cookie deve ter contrato e prova próprios. Endpoints legados sem o novo contexto devem recusar no SF ou deixar de ser alcançáveis por ele. A mediação não pode passar silenciosamente a autoridade de operador ao pedido de um usuário.

## 4. Microsoft/Teams: leitura, organização e autorização

### 4.1 Contrato do leitor

Acrescentar operações mínimas para equipes elegíveis do principal, verificação de membership e visão organizacional autorizada. Reutilizar os limites, timeout, validação de endpoint/origem e tratamento de paginação já existentes; ampliar a allowlist apenas para endpoints concretos exigidos pelo contrato.

O contrato de diretório deve declarar completude e origem das relações. Um array de groupIds sem distinguir grupo, Team, canal compartilhado e relação administrativa não basta para autorizar profile.

- Usar Object IDs imutáveis e tenant de recurso; nomes iguais, rename ou mudança de email não mudam identidade.
- Equipe ativa não equivale a todos os grupos de segurança do usuário. Não criar um profile para cada grupo automaticamente.
- Membership de grupo que produz papel e membership que permite selecionar Team têm funções distintas.
- Manager/department são relações organizacionais; não concedem automaticamente papel ou acesso a todos os subordinados.
- Paginar sem duplicação, ciclos ou troca de origem; retornar estado explícito ao exceder limites.
- Distinguir resultado vazio completo de leitura parcial, 403, 429, timeout e token expirado.
- Retentar somente de forma limitada, respeitando respostas do provedor; não manter concessões privilegiadas por stale cache.
- Cache de labels/organograma pode ser separado da verificação atual de autorização. Preservar a releitura de membership já existente nas operações protegidas.
- Não reutilizar tokens, caches ou mapeamentos de um tenant para outro, incluindo convidados B2B.
- “Leitura Graph” significa ausência de mutação de dados Microsoft, não proibir todo HTTP POST: a consulta existente checkMemberGroups usa POST. Permitir somente operações de leitura explicitamente contratadas; negar criação/edição/exclusão de usuários, grupos, Teams e memberships.
- Validar os scopes realmente solicitados, presentes e consentidos no ambiente. A configuração lembrada de outra branch/sessão não é prova do tenant atual.

As APIs Microsoft têm diferenças importantes: `joinedTeams` lista participação direta e não inclui automaticamente o Team que hospeda um canal compartilhado ao qual o usuário tem acesso. Membership de canal não autoriza o Team inteiro. Consultas transitivas de grupos também não são equivalentes a essa lista. O comportamento de canais compartilhados deve ser explicitamente limitado; não ampliar permissões para “completar” o picker. [M01][M02]

O endpoint com /me exige contexto delegado; permissões de enumeração e tipos de conta precisam ser tratados por capacidade. Tokens podem indicar excesso de grupos em vez de listar todos; não interpretar ausência da claim como ausência definitiva de memberships, nem seguir URL arbitrária vinda de claims. [M03][M04]

### 4.2 Papéis, grants e administração

Preservar as 15 ROWS e seus nomes canônicos. O mapa grupo→papel permanece editável somente por autoridade admitida, com compare-and-swap e auditoria. Um mapa vazio é uma decisão válida; restart/migração não pode recolocar defaults.

Manter grants de operação/namespace/ação humana e validação por recurso. Uma pessoa em Teams A e B não recebe acesso cruzado por unir tudo num “superprofile”; a política precisa avaliar a operação no contexto selecionado e o recurso real.

A implementação atual clona grants ao montar a autoridade. Atualização persistida não implica hot reload. Definir uma única revisão efetiva e recarga/rebind explícito: o próximo uso protegido consulta a política atual e recusa handles emitidos sob política obsoleta. Não depender somente de reiniciar a tela. [S16]

Administração suprema, admin de superfície, proprietário de equipe e operador local são funções distintas. Não promover owner de Teams ou “líder” de organograma a admin do Orchestra. A tela de administração local atual não serve como substituta dessa prova.

## 5. Interface, estado e mudança de equipe

### 5.1 Superfícies que mudam juntas

Substituir no SF:

- card/picker de profile e informações de branch/repositório;
- home, empty states e ações abrir/editar/revelar/fechar pasta;
- seletor de projeto no prompt e breadcrumb do novo chat;
- atalhos de alternar projeto, command palette e deep links que selecionam repo-profile;
- filtro/ordem de tabs, recent/closed tabs e restauração;
- seleção persistida, drafts, prompt state e queries/events;
- discovery de instalação por pasta como fonte de profile;
- copy/i18n que instrui a abrir repositório para usar o produto.

O novo card mostra equipe e contexto corporativo admitido. Não oferece escolher um papel para ganhar acesso. Conta/instalação continuam visíveis quando necessárias para evitar confusão, sem expor chaves técnicas no fluxo normal.

Todas as superfícies usam o mesmo contexto em desktop, janela estreita e navegação por teclado. Respeitar foco, leitores de tela, loading e erro. Não aceitar “mobile ficou para depois”.

Inventariar builders e parsers de URL por família de capítulo, além de back/forward e URL persistida por janela. Há parsers que recusam query keys desconhecidas/duplicadas e tuple parcial; acrescentar team/tenant/context sem atualizar ambos os lados transforma a entrada em invalid-link. WP1 define o contrato externo e sua versão, a resposta a links legados/incompletos e o destino de IDs técnicos mantidos; WP2 atualiza builder, parser e teste juntos. Não preencher partes faltantes a partir de outro profile lembrado. [S43][S44]

### 5.2 Transição A → B

Preservar o guard de saída existente. Draft não enviado pode demandar decisão de preservar/descartar; operação já submetida com resultado desconhecido exige reconciliação, não descarte genérico.

A sequência deve ser atômica do ponto de vista da experiência:

1. Verificar possibilidade de saída e autorização de B.
2. Invalidar a geração visual anterior e cancelar assinaturas/consultas associadas.
3. Manter o owner durável dos trabalhos já admitidos em A.
4. Ativar B com sua revisão e montar dependências.
5. Exibir somente estado cuja chave e revisão correspondam a B.

Uma resposta lenta de A não pode aparecer, atualizar cache ou abrir aba em B. Cancelamento do pedido não prova que o efeito não aconteceu; preservar recibos e caminho de consulta do resultado.

A troca voluntária de equipe respeita o guard de draft e afeta a seleção da janela que a iniciou. Revogação, logout, expiração que invalida autoridade ou substituição de principal/tenant retiram acesso privado assim que observados, independentemente de confirmação do usuário. Invalidar o epoch de autenticação, streams, consultas e handles em todas as janelas vinculadas; aba em background ou reconexão antiga não ressuscita o owner. Cancelar um modal de discard não pode vetar revogação.

Preservar registros duráveis necessários à reconciliação de operações submetidas, acessíveis somente sob autoridade atual; não reenviar nem apagar efeito incerto como draft. Duas janelas podem operar em equipes distintas; RPC e resolver usam a janela/principal autenticados, não um activeProfileID global. Uma troca voluntária local não muda a equipe das outras janelas.

### 5.3 Dock e credenciais

Classificar se cada binding Dock é alcançável no pacote SF Linux atual; testar a implementação que efetivamente é entregue. O código Electron auditado não justifica executar lanes macOS/Windows nem provar algo apenas numa plataforma que não será lançada.

Para bindings mantidos:

- Usar mapeamento opaco, persistente e sem colisão para a identidade do profile; o limite atual de 32 caracteres não admite inserir GUID de Graph diretamente.
- Preservar storageKey somente quando titular, tenant, instalação e vínculo contexto de origem→destino forem comprovados e autorizados. Reatribuir uma chave existente transfere acesso ao cookie jar mesmo sem copiar arquivos. Vínculo ausente/ambíguo exige partição nova e reautenticação; o conteúdo legado permanece isolado/retido. Nunca reatribuir storageKey por pasta, nome ou equipe atualmente selecionada.
- Preservar revisão/CAS, gravação atômica e lifecycle active→deleting→deleted tanto ao conservar quanto ao criar a chave.
- Isolar cookies/autenticação por principal, tenant, instalação e contexto definido pela política.
- Não copiar cookie jar, token OAuth, bookmarks/history privados ou drafts do antigo profile para um Team compartilhado.
- Tratar history/bookmarks globais no manifest: definir propriedade pessoal e impedir exposição entre contas.
- Preservar sandbox, contextIsolation, negação de Node no renderer, prevenção de late-open/late-navigation e cercas de geração.

Credenciais MCP continuam pertencendo ao titular e à conexão autorizada. Publicar a configuração de uma integração para o Team não publica a credencial do usuário. [S07][S12]

## 6. Runtime e consumidores indiretos

| Família | Trabalho obrigatório |
|---|---|
| Config/agent/skill/instruction | Tornar o resolvedor corporativo a fonte de profile; retirar o discovery repo-local como autoridade no SF. Defaults empacotados continuam com origem conhecida. Arquivos lidos como conteúdo não ganham autoridade de instrução/configuração. |
| Sessões | Persistir scope e owner; validar acesso antes de retornar Session ID existente; filtrar listagem/busca/export/replay antes de paginação; conservar idempotência no mesmo scope. |
| HTTP/SDK/eventos | Atualizar schema→protocol/core→server→client conforme dependências; eventos indicam owner validado e não são roteados só por directory; gerar clients pela ferramenta oficial do repo. |
| MCP | Migrar config writers/readers/locks e remover efeito de confiar numa pasta ao cadastrar integração do Team; separar catálogo, permissão de execução e credencial. |
| Arsenal/ToolSafety | Trocar chave de store e todos os profile tools; manter decode, limites, symlink/TOCTOU e regra de que preferências não elevam permissão. |
| Relay | Migrar profile/hook/arm/ledger bindings e confiança; jobs preservam owner e configuração admitidos, com revalidação de autoridade. Templates de workflow não são repo-profile por conterem a palavra profile. |
| Lean/telemetria | Migrar produtor, store, schema, protocolo e consumidor; métricas antigas conservam proveniência, sem atribuição por equipe hoje selecionada. |
| Schedules | Persistir principal/scope/revisão de origem e revalidar antes de nova admissão/efeito/retomada; não executar após revogação só porque existe sessão. Preservar recibo de prompt já admitido. |
| Inbox/Board | Inbox já é por instalação; migrar somente seleção/visibilidade dependente de projeto. Troca de equipe não arquiva atenção pendente de outro scope. |
| RAG/Atlas | Não deixar aliases de path unir corpora de equipes diferentes. Manter grants e recusa de catálogo estrangeiro. Atlas territorial e memória de negócio exigem classificações diferentes. |
| Reuniões/memória pessoal | Preservar dono, acesso e consentimento; uma reunião do usuário não vira reunião do Team ao trocar profile. |

O scope da sessão é propriedade durável do agregado, não da janela. Parent/child, fork, move, import e eventos que ligam sessões validam ownership e autorização nas duas pontas. Children herdam o scope autorizado da parent e grants no máximo iguais aos permitidos para delegação. Move altera placement físico, sem transferir Team/titularidade. Transferência entre scopes, se futuramente suportada, exige operação separada e explicitamente autorizada; não ocorre por create/replay ou mapping heurístico. Referências históricas e a associação migrada são validadas antes da projeção, sem alterar os eventos originais.

Schedules retomam a Location gravada; capability owner compara sessão/projeto/diretório, mas esse ponto não representa membership Teams atual. RAG atualmente adota aliases pelo path. Inbox declara dono de instalação e Board filtra repo_project_id. Reuniões e address book têm semântica pessoal própria. Esses casos demonstram por que uma substituição global de project por team produziria perda de isolamento ou transferência indevida. [S19][S20][S21][S22]

## 7. Migração de persistência e corte

### 7.1 Classificação antes de qualquer escrita real

Inventariar os stores por categoria:

| Categoria | Destino |
|---|---|
| Configuração compartilhável do profile | Novo store por TeamProfileRef, apenas campos aprovados e com revisão/proveniência. |
| Preferências pessoais, tabs, drafts | Dono pessoal + contexto; migrar apenas quando a correspondência for inequívoca e autorizada. |
| Tokens, cookies e segredos | Não copiar para o Team; preservar titularidade, segregação e processo de reautenticação quando necessário. |
| Sessões, eventos, transcripts e métricas | Preservar IDs, autoria, relações e proveniência; acrescentar associação verificável, sem reescrever história. |
| Dados de negócio installation-wide | Permanecem sob suas regras e grants; profile não provoca reparticionamento automático. |
| Jobs/hooks/schedules pendentes | Associação explícita, suspensão quando não houver vínculo/autoridade atual; recibos de efeitos anteriores preservados. |
| Material sem correspondência autorizada | Retido em quarentena administrativa, inacessível no novo contexto até destino explícito; sem heurística por nome. |

Um repositório pode ter servido mais de uma equipe ou conter estado de mais de uma pessoa. A relação não é necessariamente 1:1. O plano de migração registra origem, categoria, dono original, destino autorizado, regra, versão e checksums relevantes. **Nunca inferir o destino de email, displayName, slug, remoto Git ou primeiro Team retornado.**

Quarentena é retenção com bloqueio de migração, não um novo grant de leitura. Administradores podem resolver metadados/vínculos permitidos; conteúdo privado continua sujeito à autoridade original aplicável. Inventários, journals e logs não carregam texto privado, tokens, cookies ou segredos por padrão. Backup e restore preservam acesso e cifragem; conteúdo sensível não vai para artefatos de CI.

### 7.2 Procedimento

1. **Diagnóstico/dry-run:** levantar objetos, relações e conflitos; emitir plano sem alterações. Ausência/ambiguidade de vínculo impede ativação daquele conteúdo e impede declarar migração completa.
2. **Barreira de escrita e snapshot recuperável:** antes do snapshot final/backfill, impedir novas admissões nos stores afetados, reconciliar escritas/efeitos/jobs já admitidos e fixar uma geração de migração. Adotar por padrão uma janela de manutenção limitada a esses stores; não improvisar dual write. Registrar versão de aplicação/schema, referências e integridade. Logout/revogação continuam prevalecendo e nunca são perdidos por restauração.
3. **Migração aditiva:** criar estrutura nova, backfill determinístico, journal de progresso/idempotência e testes de interrupção. Preservar FKs e históricos antigos.
4. **Verificação:** comparar contagens por categoria, relações, hashes onde aplicável e leitura funcional; verificar casos cruzados e dados vazios. Contagem igual sozinha não prova ownership correto.
5. **Corte único:** comparar geração/revisões de origem e ativar atomicamente a nova autoridade. A barreira impede escrita atrasada de processo, browser, hook ou scheduler antigos. Rejeitar schema/generation obsoletos inclusive após restart; impedir processo antigo de reabrir o store migrado. Efeitos em voo de resultado desconhecido são reconciliados, nunca presumidos cancelados. Não existe instante admitido em que os dois modelos aceitam escrita. Sem “tentar Teams e, se falhar, usar repo”.
6. **Retirada:** remover leitores/escritores/pickers/rotas do modelo antigo que ficaram sem função; remover índices/campos somente quando seus leitores ativos e dependências estiverem migrados.
7. **Encerramento:** provar zero writer legado e zero uso de fallback repo-profile; reexecutar migração como no-op verificável; atualizar guias e inventário final.

Uma alternativa de migração online com captura de deltas exigiria desenho/prova próprios; não é o padrão deste plano. CAS de um objeto novo sozinho não protege a transição entre stores. O fence deve ser imposto no servidor e na abertura do store, não depender da boa vontade de clientes antigos.

A ferramenta de migração deve ser limitada ao escopo declarado e recusar schema/config inesperados. O leitor legado pode existir somente como importador explícito e testado, nunca no caminho normal de requests. Histórico de migrações não é reeditado.

### 7.3 Recuperação e falhas

O plano de recuperação precisa funcionar com autorização atual. Restaurar backup antigo não pode reativar um grupo revogado, devolver tokens inválidos ou tornar um profile de repositório novamente acessível. Usar snapshot de dados junto de política atual revalidada, ou modo de manutenção que recusa operações até reconciliação.

Antes do corte, é possível abandonar a migração e manter a versão anterior sem liberar a nova funcionalidade. Depois do corte, só restaurar para uma versão comprovadamente compatível com o novo esquema/autoridade; se isso não existir, suspender operações afetadas e reparar adiante. Não prometer rollback genérico por `git revert`.

Falha entre backfill, journal e ativação; execução duplicada; concorrência de escrita; restart; mudança de membership durante migração; dado corrupto; e reabertura de sessão antiga são testes obrigatórios.

## 8. Execução em seis pacotes, com contratos e propriedade de arquivos

São pacotes propostos, não sessões já iniciadas. Cada pacote terá branch própria curta, base pinada, diff pequeno e gates por alteração. Um integrador conserva o contrato comum e resolve conflitos por semântica; não se portam snapshots inteiros de branches antigas.

| Pacote | Dono técnico e arquivos principais | Entrega | Dependência e saída |
|---|---|---|---|
| WP0 — inventário fechado | Integrador: manifesto, grafo de imports/callers, plano de testes, ledger de campos/stores | Inventário integral por símbolo/alcançabilidade, entrypoint e builder/parser de URL no SHA de execução; cada ocorrência com dono, destino e teste; baseline observado | Primeiro. Nenhuma contagem de scan ou CI inventada. |
| WP1 — contrato e autoridade Teams | Schema/contexto, cliente Entra/leitor Graph, local-identity, policy, product-authority, discovery/host | TeamProfileRef e revisão efetiva; leitor real; admissão corporativa em transportes do host; seleção/autoridade server-side; admin corporativo; contrato público e URLs versionados | Após WP0. Positivos e negativos de tenant/membership/grants; clients regenerados. |
| WP2 — shell e estado pessoal | app-shell: layout/sidebar/titlebar/home/new-session/tabs/persist/sdk/queries/events/contexto SF | Toda navegação e restauração usam contexto Teams; mesmas guardas em todos breakpoints; sem pasta/Git no fluxo | Após contrato WP1. UI/cache/races/drafts/duas janelas qualificados. |
| WP3 — runtime e consumidores | Core/server e bindings: config/session/MCP/Arsenal/ToolSafety/Relay/Lean/schedules; adapters RAG/Atlas/Inbox alcançáveis | Ownership durável; admissão antes de SessionLocation/LocationServiceMap; serviços isolados por autoridade; consumidores livres de autoridade por repo; contexto técnico separado | Após WP1. Pode correr em paralelo com WP2 com ownership de arquivos explícito. |
| WP4 — dados e integrações privadas | Migrador e suas novas migrations; persistência browser/Dock; vínculos de credenciais | Dry-run, backfill, integridade, interrupção/replay; partições pessoais; corte/recuperação | Planejar após WP0; implementar contra contratos WP1–3. Não duplicar edição dos stores de WP2/3. |
| WP5 — qualificação e retirada | Integrador e revisão independente: cobertura, bundle SF, guias, inventário final | Substituição equivalente de testes legados, execução Linux, revisão de resíduos e prova das jornadas; limpeza final | Somente depois dos gates dos pacotes e migração qualificada. Um candidato final com SHA/tree exatos. |

Regras de integração:

- Schemas compartilhados, formato de contexto e migrations têm dono único; consumidores pedem alteração ao dono.
- Cada arquivo modificado tem um responsável; testes de uma fronteira pertencem ao mesmo pacote que muda o contrato.
- WP2 não contorna backend ausente com mock de membership; WP3 não preserva repo fallback para compatibilizar a UI antiga.
- Nenhum pacote remove guards, amplia grants, muda CORS ou fabrica aprovação para compilar.
- Mudanças de produto planejadas e correções do go-live atual não são misturadas silenciosamente. Reconciliar patches concorrentes no SHA inicial e novamente no candidato final.
- Commits de documentação/integração usam a cadência autorizada do repo; nenhuma execução integral por unidade de trabalho.

## 9. Estratégia de testes e CI

### 9.1 Preservar intenções, atualizar contratos deliberadamente

Há testes que exigem comportamento que será retirado: profile `repo-`, picker de pasta, git init, filtro por raiz e bootstrap de diretório. Eles não podem simplesmente ganhar `skip`, `todo`, timeout maior ou asserção removida.

Para cada teste afetado, registrar:

- feature antiga exercitada;
- motivo da mudança;
- comportamento novo equivalente;
- teste positivo e negativo que assumem a obrigação;
- caso removido exclusivamente porque a feature saiu do produto;
- alcance do pacote SF e de código técnico mantido.

Exemplo: “dois repositórios não compartilham sessão/cookie” vira “duas equipes e duas contas não compartilham estado privado”. O teste “abrir pasta inicializa Git” deixa de ser jornada SF e recebe prova de que primeira entrada/novo chat não exigem nem inicializam Git. Testes de git técnico ainda consumido não são apagados por associação nominal.

Os testes atuais de Microsoft web mínimo são intencionais. A nova capacidade Graph terá testes próprios; mudar o produto suportado exige atualização explícita da obrigação, não enfraquecer a prova de menor privilégio. [S23]

### 9.2 Grupos de regressão

| Grupo | Gates necessários |
|---|---|
| Contratos | Schemas/protocol, geração oficial de clients, compatibilidade de requests/events, rejeição de payload inventado. |
| Microsoft | entra-client, microsoft-entra-client, configuration, session, first-login, bootstrap e admin-runtime; novos Teams/org/membership/admin tests. |
| Autoridade SF | product-authority, host-context, instalação/discovery, owner/context stamps, native-entry e shell guards. |
| Core | Project/Location boundary, config/trust/instruction, create/list/archive/replay/session permissions e cache de serviços. |
| MCP e ferramentas | project-config substituído, auth/OAuth/recovery, Arsenal profile, ToolSafety e bindings. |
| Automação/memória | Relay hook/recovery/startup, schedules e claims, Inbox scope, RAG aliases e Atlas ownership, Lean/proveniência. |
| App unit/browser | layout/tabs/persist/titlebar/apps-panel-controller; contexto nativo e owner mount; duas janelas e stale requests. |
| E2E | Bootstrap sem repositório, Team switch, mobile/teclado, Dock↔Chat quando entregue e operações/decisões/reports nativos. |
| Migração | Dry-run, conflitos, dados vazios/corruptos, integridade, crash/replay, concorrência e recuperação com revogação. |
| Pacote final | Imports/build e bundle entregue sem caminhos ativos de repo-profile; inicialização limpa sem .git/config de projeto. |

O inventário JSON lista caminhos existentes de teste como ponto de partida. A lista precisa ser resolvida contra o SHA de execução; não é um comando pronto que foi rodado.

### 9.3 O que o CI atual prova e o que falta

`sf/ci/suites.json` declara CI-SF, CI-CLI, CI-APP-SRC, CI-APP-BROWSER, CI-ATLAS-BUSINESS e três E2Es. CI-APP-BROWSER seleciona a pasta de browser nativo SF, e CI-CLI usa lista explícita. O static verifica vários pacotes, mas isso não executa os testes de isolamento do Core/Arsenal/Relay/Dock. [S17]

Registrar os gates adicionais da mudança e garantir que não fiquem fora da seleção final. Não alterar a baseline histórica para fingir que cobria casos novos. Baselines pendentes do go-live não ficam verdes por este documento.

O workflow de recorte no pin exige branches `ci-run-linux-*`; rejeita outros sistemas antes da instalação. Sua validação de env aceita somente as chaves explicitamente listadas. Portanto não copiar solicitações antigas com variáveis de shard/env não admitidas. Enumerar os arquivos e usar a mecânica validada para esse SHA. Exemplo de formato para um recorte existente:

```json
{
  "package": "modules/sucafina",
  "runner": "bun",
  "args": ["Sucafinav1/test/microsoft-entra-client.test.ts"]
}
```

O exemplo demonstra formato, não atesta execução nem cobre a mudança inteira. [S24]

Cadência proposta: gates direcionados por pacote; typecheck/build/geração em Actions; prova de migração; depois um `sf-ci` no candidato integrado final, junto dos gates adicionais exigidos. Se o candidato mudar, as evidências precisam ser vinculadas ao novo conteúdo e gates afetados reexecutados. Nunca usar um run de outro SHA como aprovação do diff final.

Não abrir lanes Windows/macOS. A prova de runtime instalado deve usar o artefato e Linux x64 de destino. Login/membership/revogação reais no tenant são qualificação operacional separada dos testes determinísticos; fixtures não devem ser anunciadas como prova de Teams LIVE.

## 10. Matriz mínima de aceite

Todos os itens abaixo têm estado **PLANNED / NOT_RUN**.

| ID | Cenário | Resultado obrigatório |
|---|---|---|
| A01 | Instalação limpa, sem Git ou repositório | Login → equipe autorizada → capítulos e novo trabalho funcionam. |
| A02 | Nenhuma, uma e múltiplas equipes elegíveis | Estados distintos; seleção automática só da única opção validada; nenhuma escolha arbitrária. |
| A03 | Nome duplicado, rename e equipe recriada | IDs preservam identidade; novo Object ID não herda dados/grants antigos. |
| A04 | Dois tenants/instalações com nomes iguais; convidado | Nenhuma colisão; usa tenant de recurso e principal correto. |
| A05 | Browser inventa team/profile/role/context stamp | Backend recusa; picker não concede autoridade. |
| A06 | Grupo transitivo, overage e informação parcial | Sem concessão por suposição; consulta completa/validação definida. |
| A07 | Canal privado/compartilhado | Acesso ao canal não abre automaticamente o Team inteiro. |
| A08 | Graph 403/429/timeout/página faltante/ciclo | Erro explícito e acesso seguro; sem fallback repo ou falso vazio. |
| A09 | Revogação em leitura/edição/execução pendente | Novo efeito recusado; resposta/contexto obsoleto não é aceito. |
| A10 | Grupo/admin/policy muda | Revisão invalida handles; admin supremo e admin de superfície não se confundem. |
| A11 | RoleMap vazio antes de restart/migração | Continua vazio; seed não restaura acesso. |
| A12 | Equipes A/B usam o mesmo diretório físico | Config/cache/serviços/sessões/métricas não colidem. |
| A13 | Reutilizar Session ID de outro scope | Nega adoção; retry idempotente continua funcionando no mesmo scope. |
| A14 | Listagem/busca/export/replay/paginação | Filtro autorizado ocorre antes de limite/paginação e de retornar dados. |
| A15 | Troca A→B com requests/events/late-open em voo | Nada de A aparece ou é gravado em B; owner/generation corretos. |
| A16 | Duas janelas em equipes distintas | RPC, seleção, tabs e persistência independentes e autorizados. |
| A17 | Troca de usuário no mesmo dispositivo | Cookies/tokens/drafts/histórico privados não são herdados. |
| A18 | UI estreita, keyboard, deep link, novo chat | Mesmo contrato Teams; nenhum picker ou fallback de pasta/repo. |
| A19 | Draft não enviado e submissão com resultado incerto | Guard correto; recibo/reconciliação preservados. |
| A20 | orchestra.json/.orchestra/AGENTS perto do cwd | Não modificam o profile nem elevam autoridade SF. |
| A21 | MCP compartilhado e credencial pessoal | Catálogo pode ser comum; segredo e uso seguem titular/grants. |
| A22 | ToolSafety e profile de agente | Preferências não ampliam permissão; limites de arquivo e origem sobrevivem. |
| A23 | Job vence após logout/switch/revogação | Mantém dono original, revalida antes de efeito, registra suspensão/recusa honestamente. |
| A24 | Claim retoma após crash com prompt já admitido | Sem duplicar efeito nem falsificar recibo; autoridade atual aplicada. |
| A25 | Inbox muda de contexto | Não arquiva atenção pendente de outro contexto nem transfere contas. |
| A26 | RAG aliases/Atlas na mesma pasta | Nenhuma adoção cruzada de corpus/catálogo entre equipes. |
| A27 | Reuniões, endereço e dados empresariais compartilhados | Ownership original e grants preservados. |
| A28 | Migration dry-run e vínculo ambíguo | Zero escrita; conflito explícito; não há mapping por nome/primeiro Team. |
| A29 | Migração interrompida, repetida e concorrente | Idempotência, integridade e CAS; nenhum cascade perde história. |
| A30 | Recuperação após revogação | Não restaura concessões/segredos nem repo-profile ativo. |
| A31 | Store novo corrupto ou schema inesperado | Recusa segura; nunca recorre ao store repo antigo. |
| A32 | APIs/selectors/writers legados | Retirados ou recusam explicitamente no SF; não permanecem alias ativos de profile. |
| A33 | Scan/import graph/runtime tracing do pacote final | Zero ocorrência ativa não classificada de repo-profile; sem allowlist ampla. |
| A34 | Testes substituídos e suites selecionadas | Equivalência registrada; nenhuma asserção/seleção enfraquecida. |
| A35 | Jornadas reais Operations, Decisions, Reports | Funcionam no novo contexto sem regressão de proveniência/recuperação/guardas. |
| A36 | Tenant real e artefato Linux final | Login, memberships, troca, revogação e restart provados no ambiente; evidência separada dos mocks. |
| A37 | Dois usuários simultâneos no mesmo Team/pasta com grants distintos | Serviços/cache/queries/credenciais não retêm autoridade do outro; ordem de abertura não muda acesso. |
| A38 | Writer antigo e scheduler concorrem com snapshot/backfill/flip | Deltas reconciliados ou recusados pelo fence; geração obsoleta não escreve, inclusive após restart. |
| A39 | parentID/fork/move/import/replay entre scopes | Referências cruzadas negadas sem evento parcial; operações válidas preservam scope e grants estreitados. |
| A40 | Registry tenta reatribuir storageKey sem copiar cookies | Rebind sem titular/tenant/contexto autorizado é negado; partição nova exige reauth; legado permanece isolado. |
| A41 | Revogação durante modal de draft, janela em background e stream antigo | Retirada de autoridade vence confirmação; todas as janelas do auth epoch invalidam, sem perder reconciliação. |
| A42 | Basic/operador/cookie fora do mount/Session ID conhecido nos transportes | Não equivalem a principal Teams; todos entrypoints protegidos recusam sem contexto admitido, sem passthrough. |
| A43 | URL builder/parser, back/forward e restauração de link antigo | Seletores completos/versionados, duplicatas e chaves desconhecidas tratados; nunca compõe tuple com outro profile. |
| A44 | Operações Graph observadas | Consultas contratadas, inclusive POST de leitura, permitidas; nenhuma mutação de Microsoft por configurar profile. |

## 11. Scanner de resíduos e prova de encerramento

WP0 deve combinar busca textual completa com grafo de imports/rotas/callers. Usar os tokens abaixo como sementes, não como critério cego de exclusão:

`profileProject`, `HomeProjectSelection`, `appDockProfile`, `repo-`, `tabMatchesProfile`, `selectProject`, `project.open`, `home.selection`, `Project.resolve`, `ProjectID.global`, `project_id`, `projectId`, `projectID`, `worktree`, `directoryKey`, `serverWorkspace`, `McpProjectConfig`, `trustedProjects`, `trusted_projects`, `profileDirectory`, `LeanProfilePreferences`, `location_id`, `repo_project_id`, `orchestra.json`, `.orchestra`.

Por ocorrência, registrar path/símbolo, produtor/consumidor, entrypoint alcançável, store/campo, ação, responsável, obrigação de teste e prova no SHA. Classificações permitidas:

- migrado para contexto Teams;
- feature repo-profile retirada do SF e código morto removido;
- localização técnica mantida, comprovadamente sem escolher profile;
- propriedade pessoal/instalação mantida com motivo;
- significado diferente de profile (por exemplo workflow);
- histórico/migração, sem leitor normal de runtime.

Um símbolo mantido como “técnico” não pode continuar determinando seleção, policy, catálogo, acesso ou descoberta do profile. Verificar artefato compilado, endpoints e comportamento com arquivos de configuração armadilha, além de texto/imports.

Condições de encerramento:

1. Inventário integral no SHA final, sem ocorrência ativa não classificada.
2. Um resolvedor de profile e uma autoridade ativa; zero dual write/fallback para repo.
3. Dados migrados/retidos com destino e ownership explícitos, integridade e recuperação provadas.
4. Client/protocol gerados coerentes; nenhum cast/ignore para esconder incompatibilidade.
5. Todos os testes pertinentes selecionados e executados; skipped/cancelled/vazio não contam como verde.
6. Jornadas nativas e estados de erro qualificados, inclusive narrow e múltiplas janelas.
7. Revisão independente de segurança, persistência e resíduos concluída, achados resolvidos.
8. Artefato final identificável por commit/tree e resultados; nenhuma aprovação ou medição fabricada.
9. Qualificação operacional Microsoft/Linux discriminada da qualificação de código.
10. Guias, prompts/skills empacotados afetados, exemplos, fixtures e documentação atualizados; upstream que volte a introduzir repo-profile faz o gate falhar.

## 12. Riscos prioritários e limites conhecidos

| Risco | Tratamento exigido |
|---|---|
| Confundir profile com papel/credencial | Contratos separados; testes negativos de elevação e compartilhamento. |
| Apagar Project causa perda de histórico | Migração referencial antes de retirada; integridade e replay. |
| Reutilizar serviço por pasta entre equipes | Identidade de profile na chave dos serviços que capturam config. |
| Graph parcial equivale a “sem equipe” | Estado de completude explícito; sem concessão por ausência/erro. |
| Produto parece Teams, runtime lê .orchestra | Testes com config armadilha e trace do resolvedor ativo. |
| Cookies/histórico globais vazam ao mudar conta | Classificação pessoal, partições e prova por janela/principal. |
| Job antigo usa autoridade revogada | Scope durável e revalidação na admissão/retomada/efeito. |
| Migração reaplica maps vazios/defaults | Preserve-empty, CAS e auditoria; teste de restart. |
| Verde SF sem core/profile tests | Seleção adicional obrigatória e evidência no mesmo candidato. |
| Branch muda enquanto estudo é aplicado | Reconciliar o pin e refazer mapeamento de deltas antes de executar. |

Ainda não comprovados nesta entrega: consentimento Graph real, autoridade administrativa suprema integrada, dados reais a migrar, todas as ocorrências textuais do monorepo, alcance completo de cada módulo no bundle final e resultados de execução. Esses itens têm destino no plano e gates; não são tratados como PASS.

O estudo fundamenta a implementação. **Não certifica que o profile já foi migrado, que o código está verde ou que não existem resíduos.**

### 12.1 Revisão independente do documento

Três revisões técnicas independentes da autoria examinaram a primeira versão do plano (commit `77d16eed187931f1bf2434a449fed9894bc2137e`). Identificaram seis P1 e dois P2 de planejamento; não eram alegações de defeitos novos executados. Os ajustes foram incorporados:

| Finding | Severidade | Ajuste no plano |
|---|---|---|
| R01 — identidade do host versus usuário Microsoft | P1 | §3.4, WP1/WP3 e A42: admissão em todos os entrypoints antes de serviços/dados. |
| R02 — usuários diferentes no mesmo Team | P1 | §3.2 e A37: cache/serviço não compartilha autoridade capturada. |
| R03 — escritores antigos durante corte | P1 | §7.2 e A38: manutenção limitada, fence, geração e ativação atômica. |
| R04 — parent/fork/move/import de sessões | P1 | §6 e A39: ownership nas duas pontas e grant estreitado. |
| R05 — reatribuição silenciosa de storageKey | P1 | §5.3 e A40: vínculo autorizado ou nova partição com reautenticação. |
| R06 — modal de draft impedir revogação | P1 | §5.2 e A41: retirada compulsória de autoridade em todas as janelas do auth epoch. |
| R07 — quarentena interpretada como acesso admin ao privado | P2 | §7.1: retenção não concede leitura; logs/backup preservam sigilo e acesso. |
| R08 — parsers/builders de URL fora do inventário | P2 | §5.1, WP0–2 e A43: contrato versionado e seletores atômicos. |

A revisão é do planejamento e de fontes direcionadas; não certifica migração, CI, execução instalada ou ausência global de resíduos.

## 13. Fontes de código e documentação

Todos os links S usam o pin do estudo; os números de linha citados são desse pin. A documentação Microsoft foi consultada durante o estudo para validar as diferenças de identidade, memberships e Teams.

[S01]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/modules/sucafina/Sucafinav1/src/identity.ts
[S02]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/app-shell/src/orchestra/sidebar.tsx
[S03]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/app-shell/src/orchestra/chapter-route.tsx
[S04]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/app-shell/src/components/titlebar-tab-order.ts
[S05]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/app-shell/src/pages/home.tsx
[S06]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/app-shell/src/context/server-sdk.tsx
[S07]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/apps/desktop/src/main/app-dock-profile-registry.ts
[S08]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/core/src/project.ts
[S09]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/core/src/location-service-map.ts
[S10]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/core/src/session/sql.ts
[S11]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/core/src/config.ts
[S12]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/core/src/mcp/project-config.ts
[S13]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/modules/sucafina/Sucafinav1/runtime/entra-client.ts
[S14]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/modules/sucafina/Sucafinav1/runtime/local-contract.ts
[S15]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/modules/sucafina/Sucafinav1/runtime/local-store.ts
[S16]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/modules/sucafina/Sucafinav1/product/integration/product-authority.ts
[S17]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/sf/ci/suites.json
[S18]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/apps/cli/src/sucafina-product/native-ui/people.ts
[S19]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/core/src/scheduled-task.ts
[S20]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/core/src/inbox/install.ts
[S21]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/server/src/handlers/rag-studio-session.ts
[S22]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/core/src/session/meeting.sql.ts
[S23]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/modules/sucafina/Sucafinav1/test/microsoft-entra-client.test.ts
[S24]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/.github/workflows/test-ci.yml
[M01]: https://learn.microsoft.com/en-us/graph/api/user-list-joinedteams?view=graph-rest-1.0
[M02]: https://learn.microsoft.com/en-us/graph/api/user-list-transitivememberof?view=graph-rest-1.0
[M03]: https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation
[M04]: https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference

[S25]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/app-shell/src/context/layout.tsx
[S26]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/app-shell/src/components/titlebar.tsx
[S27]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/app-shell/src/pages/session/apps-panel.tsx
[S28]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/app-shell/src/context/server-queries.ts
[S29]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/app-shell/src/utils/persist.ts
[S30]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/app-shell/src/pages/session/apps-panel-controller.ts
[S31]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/core/src/location-services.ts
[S32]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/core/src/session.ts
[S33]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/core/src/session/archive.ts
[S34]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/core/src/tool-safety-profile.ts
[S35]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/core/src/session/lean-profile-preferences.ts
[S36]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/core/src/relay.ts
[S37]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/core/src/tool/maestro-arsenal.ts
[S38]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/modules/sucafina/Sucafinav1/runtime/local-bootstrap.ts

[S39]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/modules/sucafina/Sucafinav1/runtime/local-identity.ts
[S40]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/server/src/middleware/authorization.ts
[S41]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/server/src/middleware/capability-authorization.ts
[S42]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/protocol/src/api.ts
[S43]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/app-shell/src/orchestra/chapters/sucafina/host/people-route.tsx
[S44]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/apps/desktop/src/renderer/index.tsx
