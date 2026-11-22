# G08 — executor privado da UI atual, grants e rascunhos

## Escopo e estado

Este é o mesmo executor privado introduzido na #644 e reconciliado na #659. A adaptação usa o painel administrativo real da #661, a autorização privada de Session da #663 e o Chat nativo da #667, compostos pela frente de produto na #665. Nenhum desses produtores é reimplementado aqui.

Os **nove controles Teams** estão mapeados aos nove IDs originais. Isso descreve a implementação do executor e suas dependências, não um resultado instalado: **todas as obrigações e grupos permanecem NOT_RUN** até a execução original no ambiente reservado e no mesmo tar G07. U15, U39, U40, F04 e AZ02 continuam obrigatórios, em invocações separadas. Não há skip nem redução do inventário para aparentar fechamento.

Fontes imutáveis consultadas:

- Base integrada [dev ad6d245](https://github.com/gustavomhss/Orchestra-SF/tree/ad6d245119ef2d69fb96471edd62dd6413ae185f), merge da [#657](https://github.com/gustavomhss/Orchestra-SF/pull/657): navegação, projeção autenticada no-teams/revoked, administração HTTP e política.
- Painel [#661@6c96110](https://github.com/gustavomhss/Orchestra-SF/blob/6c96110aea248594f47e92cfd569e97867f72396/packages/app-shell/src/components/team-profile-administration.tsx): catálogo real, comandos UI, CAS opaco e invalidação por geração/principal.
- Produtor privado [#663](https://github.com/gustavomhss/Orchestra-SF/pull/663), observado em [eaa9f126](https://github.com/gustavomhss/Orchestra-SF/blob/eaa9f126c71dccbeec195cdcb47d6d44fdb69343/modules/sucafina/Sucafinav1/runtime/team-session-admission.ts): grants explícitos por operação, Microsoft atual, mesmo Request original e namespace por owner. [HTTP Session canônico](https://github.com/gustavomhss/Orchestra-SF/blob/eaa9f126c71dccbeec195cdcb47d6d44fdb69343/packages/server/src/session-http.ts).
- Chat [#667@b663dd0](https://github.com/gustavomhss/Orchestra-SF/blob/b663dd0865fa91c705f732c88975473de8d49c50/packages/app-shell/src/pages/team-profile.tsx) e [composer nativo](https://github.com/gustavomhss/Orchestra-SF/blob/b663dd0865fa91c705f732c88975473de8d49c50/packages/app-shell/src/pages/team-session.tsx): PromptInputV2 original, rascunho em memória, diálogo real, troca de Team e novo endereço de Chat.
- Integração [#665@7a28c5e](https://github.com/gustavomhss/Orchestra-SF/tree/7a28c5eefece4cae5de0e376ad3bafbe5290a928): fonte proposta da composição atual, não ACK final de Migração/Release.
- [Plano obrigatório736a](https://github.com/gustavomhss/Orchestra-SF/blob/736a5087c223629be4d73c8a4535d615fcafd96a/docs/architecture/teams-profile-test-plan.json), gate G08-NATIVE-TEAMS; [cenários anteriores #644](https://github.com/gustavomhss/Orchestra-SF/blob/aa928b6ae4a5944e5dad4b5bd206d5c123d2238e/packages/app-shell/e2e/sucafina/g08/teams-installed.spec.ts).

A #659 comprovou controles de ferramenta e DOM em seu próprio SHA, com sete casos listados e nenhuma execução instalada. Seus cinco mapeamentos integrais, dois parciais e dois ausentes são o registro histórico daquela versão. Nesta versão, os contratos de UI/grants/chat foram encontrados e adaptados; a existência deles em PR aberta não prova integração, instalação, autoridade Microsoft ou aprovação de G08.

## Matriz de equivalência

A cobertura abaixo exige os contratos citados no **C realmente instalado**. Até lá, o estado é NOT_RUN.

| Obrigação original | Controle atual e oráculo |
| --- | --- |
| same-team-distinct-grants | Dois contexts e principals Microsoft distintos no mesmo Team. Cada ator lê seu próprio namespace Session. O requester cria um único registro de ID aleatório, relê o efeito e tem o inventário exato esperado. A criação pelo holder recebe 401, seu inventário completo permanece igual e a leitura e o F02 continuam admitidos. Cleanup elimina somente os IDs dessa execução e relê ambos os inventários. |
| aba-two-windows | A UI emite F02 original na troca A→B→A. URLs e owners correspondem ao Team escolhido; a janela irmã permanece em A e conserva o owner após reload. |
| account-without-team | F02 selection identifica o principal original no-teams. Team explícito retorna revoked sem owner/dados; a rota original de negócio recebe 403 sem corpo. Um 403 isolado não identifica o ator. |
| foreign-deep-link-reload | Deep link próprio e reload são admitidos. Instalação estrangeira permanece na URL, mostra invalid e não emite F02 de Team. Reload conserva essa recusa; o link próprio volta a funcionar. |
| admin-without-team | O administrador original sem Team abre o painel nativo pelo toggle. O GET da própria UI e o catálogo renderizado concordam. F02 administrativo é available, mas o Team explícito e a rota de negócio continuam recusados. O painel permanece utilizável no contexto revogado. API positiva sozinha não satisfaz o caso. |
| narrow-keyboard-draft | Em 320px, Tab alcança o novo Chat e Enter abre o workspace real. F02 e lista Session emitidos pela UI vinculam o mesmo owner; o PromptInputV2 recebe texto sem submit. Controles permanecem alcançáveis, o inventário não muda e nenhum POST Session ocorre. |
| draft-cancel-discard | O diálogo nativo bloqueia a troca para B enquanto A possui rascunho. Cancelar preserva owner, URL e texto, sem leitura de navegação. Confirmar gera F02/lista Session originais para B e descarta o texto; retornar a A não o ressuscita. Inventários de A/B intactos e nenhuma submissão de prompt. |
| real-revoke-restore | O painel real emite uma única operação disable com CAS exatamente observado. Catálogo relido, F02 revogado e 403 de ambos os atores comprovam o corte; B permanece intacto. Restore usa uma única operação original com o CAS atual e comprova catálogo e admissão restaurados. |
| logout-original-context | POST original 204, mesmo contexto 401, janela irmã 401 após reload e holder original ainda admitido. Não implica logout global Entra, replay bruto ou restart, que pertencem a AZ02. |

O admin atual é um painel na landing autenticada, não a rota histórica independente /orchestra/sf-home/administration. O oráculo foi adaptado ao painel existente mantendo a obrigação positiva de UI. O CAS preserva ConfigRevision exatamente, inclusive string ou número zero; não há cálculo de +1.

### O que constitui grants distintos

Identidades diferentes, destinations vazios, um 403 genérico ou a recusa de acessar a sessão pessoal do outro ator não bastam. O controle usa a mesma operação create, o mesmo Team e cada namespace pessoal original:

1. GET completo e autorizado para ambos os atores, com namespace e linhas estritamente decodificados.
2. POST create do requester com um ID novo da execução; GET e inventário comprovam exatamente o registro criado.
3. POST create do holder com outro ID novo recebe 401; GET completo e F02 posteriores continuam positivos e o inventário permanece byte a byte equivalente à projeção original.
4. Limpeza somente dos dois IDs aleatórios, por seus owners originais, seguida de igualdade dos inventários com a linha de base.

Isso prova autorização efetiva distinta para uma operação concreta. Não publica nem infere listas privadas de grants, grupos Entra, provider bindings ou credenciais. Não afirma que todos os recursos de negócio possuam a mesma matriz.

Os registros não recebem prompt, não executam modelo, ferramenta ou shell e não usam dados de produção. DELETE só pode visar IDs ses_g08 gerados pela invocação atual. Resultado incerto é reconciliado por leitura; nenhuma mutação é repetida automaticamente. Se um registro inesperado não puder ser removido, a execução falha e a reserva conserva a pendência para o operador. Não há recibo de sucesso com cleanup incompleto.

O transcript de grants fica em session-grants.json no diretório privado, com as projeções reais antes/depois. O verificador exige proveniência da execução inteira, relatório exato e cleanup, valida o vínculo de owner/Team/invocação, o efeito positivo, a ausência de efeito da recusa e a restauração. O recibo público recebe apenas seu hash. Esse arquivo é produzido pelo teste; não é uma declaração manual de permissão aceita como prova.

## Grupos obrigatórios separados

| Grupo | Inventário preservado | Dependência e prova necessária |
| --- | --- | --- |
| U15 / CAP14 | 6 títulos originais | Capítulo admitido e bundle list/editable/denied/stale/lost; segundo editor Microsoft na mesma versão CAS; dados isolados e cleanup do produtor. |
| U39 / CAP04/2026 | 22 títulos originais | Bundle entry/empty/source/readonly/denied/revoked/stale/late; revogador real e segundo escritor; fonte e oráculos originais. |
| U40 / CAP05/2026 | 22 títulos originais | Contrato completo por caso em invocação CAP05 própria. Não colapsar 22 casos em um cenário de entrada. |
| F04 | 3 controles originais | Guest no ingresso real; selector moderno malformado recusado; cliente real com geração vencida produz zero rede. Invocação Bun/Happy DOM com manifest instalado, sem inferir positivo CDP. |
| AZ02 | preflight 14, actors 11, producer 2, after-revoke 2, logout 2, after-restart 1 | Tenant/Team/host/revisões modernos; CAS409/422 com estado intacto; revogação observada; cookies/replay; restart real do mesmo C/T/tar. |

[obligations.json](./obligations.json) conserva todos os IDs, títulos, fontes/blobs e contagens. Os 50 registros de U15/U39/U40 não são 50 execuções. Esses grupos continuam NOT_RUN; esta adaptação não porta journeys antigos nem ressuscita o console legado. Sua composição técnica e os respectivos produtores de casos ainda precisam de execução e recibos próprios.

O agregado do plano também conserva o papel de recovery/G09 com seu dono. Este executor não o assume nem emite seu recibo. G01–G04/pool, #349 e G09/#588 permanecem fora desta escrita.

## Reserva e admissão instalada

Somente o job manual installed-teams-current de [g08-private-preflight.yml](../../../../../.github/workflows/g08-private-preflight.yml) conecta o browser. Requisitos cumulativos:

1. C/T final confirmado por Migração e Release, recibo G07 original PACKAGE_VERIFIED, ZIP/tar/manifest/factory imutáveis e instalação desses bytes. Esta entrega não preenche ACK final.
2. Navegação, admin UI/HTTP, projeção autenticada, Session HTTP privado, grants e Chat/rascunhos integrados nesse mesmo C. O preflight recusa arquivos ausentes; presença de arquivo não prova montagem. As ações e respostas originais continuam obrigatórias.
3. Reserva exclusiva QA com dono, VM ID, janela e referência original. Autorizações devem cobrir os quatro atores, logout, disable/restore temporário do Team A e criação/remoção dos registros Session descartáveis. Label de runner ou environment não é reserva; referência de autorização não concede grant.
4. Quatro BrowserContexts Microsoft originais, distintos e identificados pelo F02 atual: requester e holder admitidos em A, requester também em B; denied sem Team; dashboardAdmin com administração e sem negócio. Para este caso de grants, requester precisa de read/create/write e holder de read sem create, efetivamente observados pelo produtor. Não se criam contexts, logins, sessões clonadas ou storageState.
5. Root privado 0700, arquivos regulares 0600, mesmo UID, sem symlink/hardlink, fora do checkout. plan.json canônico, recibo G07 exato e browser-endpoint.txt loopback. Nenhum segredo no repositório.
6. Witness antes/depois: instalador real, bytes/modos, current source, PID/exe/argv/factory/config, listener do PID, IMDS da VM, Caddy ativo e discovery loopback/HTTPS com mesmo hostId. installation:null do empacotador não satisfaz isso.
7. Cache/SW bypass e respostas originais ligadas ao frame/peer HTTPS 443 da VM reservada, inclusive XHR/fetch. O fetch do browser usa o cookie jar original; o nonce apenas correlaciona a observação.
8. Páginas próprias fechadas, attach desconectado, nenhum contexto criado, ingresso sem erros, mesmos processo/binding antes/depois, catálogo restaurado e fixtures Session removidas. Audit/CAS avançado não é apagado.

O plano conserva sf-g08-private-plan-v1 e seus campos originais:

~~~text
candidate: { sha: C completo, tree: T completo }
packageReceiptSha256: digest do recibo original G07
reservation: { reference, owner, startsAt, endsAt, vmId, environment: qa-isolated, exclusive: true }
approvals: { actorsReference, mutationReference, scope: qualification-only }
invocation: { id: nonce32hex, runId, runAttempt, workflowSha }
target/teamB/foreignInstallation: { serverKey, discoveryOrigin, shellOrigin, publicOrigin,
  installationId, tenantId, teamObjectId, projectId, hostId, mount, chapterHref }
actors: { requester, holder, denied, dashboardAdmin }
scratchRoot: diretório privado absoluto
~~~

A/B usam a mesma instalação/tenant/host e Teams distintos. O negativo muda somente installationId. chapterHref admite as três entradas de contexto originais e seu query fechado; o executor abre o Chat existente pelo controle nativo e observa /orchestra/sf-sessions/new. Não trata URL, pasta ou Project ID como autoridade.

Sem reserva e esses insumos, não despachar instalado. A sequência admit → host-before → Playwright → host-after → verify não instala, reinicia serviço, clona sessão ou fabrica consentimento. G08/G10 podem qualificar o mesmo tar em reservas separadas autorizadas; produção exige decisão de go/no-go e janela próprias.

## CI, composição e recibos

Os controles hosted Linux executam Node para admissão/recusas, Python para o witness somente leitura, Bun/Happy DOM para a landing/painel/Chat reais com transporte controlado, typecheck do pacote isolado, Playwright --list e guards canônicos contra origin/dev. Outputs ficam em RUNNER_TEMP, fora do checkout. Não há exceção ao guard nem teste local.

Quando o produto está pendente de integração, a branch de teste teams-admin-check pode ser composta explicitamente sobre o source original do integrador, com somente os nove blobs desta frente sobrepostos. A PR e o recibo devem declarar separadamente a base dev D, a fonte de produto S e o commit/tree C da composição. Um teste nessa composição não é teste do dev ainda não integrado. Após integração, é necessário qualificar o candidato final real.

- sf-g08-executor-inventory-v3 / CURRENT_CONTRACT_INVENTORY_VERIFIED: nove registros LISTED_NOT_RUN, installed:false e todas as obrigações NOT_RUN.
- sf-g08-current-installed-v3 / CURRENT_TEAMS_SUBSET_INSTALLED_VERIFIED: apenas após os nove resultados reais no host e tar reservados. As nove obrigações Teams passam somente no alcance observado; grupos separados continuam NOT_RUN.
- Ambos mantêm proofScope:current-teams-subset, g08Closed:false e productionCutover:false. O subconjunto refere-se ao gate inteiro, incluindo seus cinco grupos obrigatórios.
- require-closed-gate recusa a conclusão enquanto qualquer grupo estiver pendente. Inventários vazios, incompletos, duplicados, desconhecidos ou contagens forjadas também são recusados.

O controle de DOM usa os mesmos seletores do executor e componentes/clientes de produto, com somente a rede controlada. Isso demonstra compatibilidade do oráculo, sem provar Entra, instalação ou autorização real. A contagem exata é nove, workers 1/retries 0, sem filtros, shards, skips, flake, falhas ou resultados ausentes.

Somente digests, C/T, IDs estáveis, contagens e estados de cobertura são públicos. Cookies, CDP, URLs privadas, env, claims, corpos, transcripts Session, vídeos e screenshots ficam fora do recibo público. A política da reserva governa retenção dos dados privados.

## Fechamento

G08 requer os nove cenários Teams, U15/U39/U40 completos em suas invocações, F04 e todas as fases AZ02, mesmo candidato/tar G07, atores/grants reais, autorização das mutações e cleanup observado. A composição de ferramenta ou nove casos listados não satisfaz essa condição.

A prova 222 (2) continua 4/4 no QA original atestado pelo handoff; seu backlink/SHA/tar não foi recuperado nesta frente e não é promovido ao candidato atual. Ver a [matriz de preparação](../../../../../docs/qa/sucafina/go-live/g08-teams-qa.md) e o [ledger](../../../../../docs/qa/sucafina/go-live/status.json). Evidências anteriores conservam seus SHAs e escopos.
