# Primeira leva pronta para despacho — missão77

**Estado: PREPARED_NOT_AUTHORIZED.** A sessão77 só publica revisão. Os pacotes abaixo são instruções futuras concretas; ninguém está autorizado por este documento a implementar, testar ou alterar o plano original. S0 decide a adoção do adendo e a liberação da implementação; 71 mantém a integração de sf2-stack, 45 mantém checks/geração. Não há uma pergunta técnica pendente necessária para entender o primeiro lote. O head posterior da PR76 recebeu triagem em LATE-DRIFT.md:71 precisa adotar um contrato e um mapa de leases únicos, sem despachar pacotes sobrepostos.

## Ordem, capacidade e dependências

Um integrador N0 e até três autores simultâneos. IDs77A–77E são subfatias de N0/N1/N2/N5/N10, não novos WPs canônicos. Não criar onze sessões nem presumir runners. Uma substituição ocupa somente slot realmente liberado.

1. S0/71 registram adoção do contrato review77-native-pilot-1, blob, candidato/base e leases exclusivas. Último checkpoint reconciliado por delta: C35/e87e22d163924635bf0b41785c9bc80bf780ac0a; qualquer avanço posterior exige checkpoint/delta e preimages, sem copiar branches de produtores.
2. 77A (integrador), 77B (contrato/API) e 77C (componentes mínimos) avançam em paralelo. 77B publica cedo schemas/assinaturas de DTO e operação.
3. 77D (Procurement) ocupa o terceiro slot de autoria após esse checkpoint de schemas, consumindo os contratos congelados; seu aceite espera 77A/B/C compostos.
4. 77E (qualificação) ocupa slot liberado. Pode preparar roteiro/evidência enquanto D fecha, mas execução só pela interface admitida de45, no candidato composto e depois de autorização específica.
5. Depois do piloto, liberar famílias N3–N9 em até três frentes; UI32 espera R77-F06, MonthlyGrid/N4 espera R77-F07. Essas dependências não desaparecem porque saíram do caminho crítico do piloto.

O produto completo continua com15 chapters,28 CAP,42 entradas complementares,74 tasks,1.610 critérios,17 contratos e13jornadas. Stub, fixture visual, registro ou flag off não fecha capacidade.

## Regras comuns de todos os pacotes

Ler AGENTS aplicáveis, canônico pinado, fonte real do produtor e este contrato. ACK antes de escrever produto com branch/base/tree/modelo real ou limite desconhecido/lease/paths/critérios. Ler novamente autoridade corrente; nenhuma ausência de mensagem significa liberação de arquivo.

Cada autor só escreve seu subtree. Patches de arquivos compartilhados são entregues inertes ao N0 com pre/postimage e requisito; N0 só aplica depois do release/ACK do proprietário. 72–76,65,52,45 mantêm suas custódias. Não mexer em engines, scanner, permissões, body limits, cookies, source lifecycle ou readonly roots para fazer a UI passar.

Handoff obrigatório: SHA/tree/source parent, manifesto dos arquivos e blobs, patch completo, dependências consumidas/digests, CAP/UI/tasks/critérios, comportamento e limites, evidência no SHA correto, casos não executados e consumer ACK solicitado. Não preencher provider model/session/W/S/run/job fictícios.

### 77A — N0: composição de navegação, owner e registries

**Objetivo:** uma única transição de contexto e montagem real das peças publicadas por B/C/D.

**Escrita exclusiva — arquivos existentes (prefixo packages/app-shell/src):**

- context/layout-route.ts; context/language.tsx;
- orchestra/navigation.ts; orchestra/chapter-route.tsx; orchestra/sidebar.tsx;
- orchestra/shell/navigation-commands.tsx; orchestra/compact-navigation.ts;
- orchestra/shell/mobile-navigation.tsx somente wiring/foco do drawer;
- app.tsx, inclusive ConnectionGate;
- i18n/orchestra.ts e registries existentes efetivamente necessários.

**Arquivos novos de A:** orchestra/chapters/sucafina/route-manifest.ts; entrypoints/route-context.ts; entrypoints/owner.tsx; entrypoints/transition.ts; entrypoints/client.ts; entrypoints/procurement.tsx; demais wrappers de registry somente quando a capacidade correspondente for integrada. Grupos/disclosure permanecem no shell único.

**Patches centrais exclusivos aplicados por A após release:**

| Área | Paths exatos e alteração |
| --- | --- |
| Discovery global | packages/protocol/src/api.ts registra só grupo metadata; packages/server/src/handlers.ts e routes.ts compõem provider opcional; apps/cli/src/commands/handlers/serve.ts passa instalação carregada |
| Instalação | apps/cli/src/sucafina-product/installation.ts valida/exporta provider; modules/sucafina/Sucafinav1/local/entry.ts faz prepare/bootstrap/dispatch/return bridge |
| Porta privada | modules/sucafina/Sucafinav1/product/contracts/host-context.ts adiciona nativeHttp; apps/cli/src/sucafina-product/host-context.ts compõe adapter, preservando delta native64 de C31 |
| Precondição do comando nativo | modules/sucafina/Sucafinav1/runtime/application.ts recebe hook síncrono nativeCommandPrecondition na transação antes de Domain.execute; local/entry compõe o precheck e callback, somente após release/ACK73/74 |
| Client público | packages/client/src/contract.ts inclui nome do grupo metadata, se necessário; packages/client/script/build.ts emite alvos dedicados; package.json de schema/protocol/client publica exports e check:generated |
| Geração | src/generated e generated-effect globais apenas por codegen do novo metadata; src/generated-sucafina e generated-sucafina-effect por codegen SF; sem edição manual |

**Fronteiras:** não escrever subtrees B/C/D, runtime/procurement.ts, local-identity.ts, local-store.ts, source-lifecycle.ts, read-snapshot.ts, workflows ou produtores 72–76. Mudança central depende de delta/lease; não substituir arquivo inteiro com preimage C28 sobre C31.

**Entradas:** CONTRACT-FREEZE §§1–4, schemas B, LeaveGuard C, chapter D. **Saídas:** registry real, owner/URL/seleção coerentes, auth binding alcançável, generation/exports registrados e consumidores montados. Incluir plural tipado em language.tsx; leaf en/br sozinhos não ampliam PluralKey. Preservar outros locales/fallback; grupos por owner não reutilizam a única preferência global Advanced.

**Critérios:** WP01.T01.DOD.01/CHK.02/INV.01; WP01.T03.CMP.01; CAMP.INV.04/07, QLT.02/03.

**Rechecagem futura discriminante:** URLA/seleçãoB; menu/atalho/histórico; A indisponível/B saudável; resposta tardia; dois principais; dirty saída; não-SF preservado; entrypoint real. Não basta unit de parser nem snapshot de menu.

### 77B — N1: contratos, discovery e HTTP autenticado

**Objetivo:** transformar os produtores existentes em DTO mínimo e fechado, sem renderizar HTML ou expor snapshot.

**Escrita exclusiva — novos paths:**

- packages/schema/src/sucafina.ts e sucafina/{native-binding,context,procurement,errors}.ts;
- packages/protocol/src/groups/{sucafina-binding,sucafina-native,sucafina-legacy-command}.ts;
- packages/protocol/src/sucafina-api.ts;
- packages/client/src/{sucafina-contract,sucafina,sucafina-effect}.ts;
- packages/server/src/sucafina-native-binding.ts e handlers/sucafina-binding.ts;
- apps/cli/src/sucafina-product/native-ui/{binding,http,return-intents}.ts;
- modules/sucafina/Sucafinav1/product/native-ui/{context,procurement,errors,command-owner}.ts;
- modules/sucafina/Sucafinav1/test/native-ui-contract/**, somente verificações futuras do contrato.

**Exports congelados:** NativeBindingSelector/NativeBinding, NativeContext, ProcurementQueuePage/ProcurementRequestDetail, SaveRequestTitleInput/Result, NativeFailure; SucafinaBindingGroup, SucafinaNativeGroup, SucafinaLegacyCommandGroup, SucafinaApi; createSucafinaClient/createSucafinaEffectClient; createSfNativeBindingProvider/createSfNativeHttp. Os nomes finais públicos não levam sufixo v1; a revisão é campo de contrato.

O grupo metadata entra no HttpApi global via A. SucafinaApi dedicado compõe grupo nativo sob /api/native e o comando legado no path /procurement sem esse prefixo. Não herda Authorization global como autoridade SF. SucafinaApi é o agregado de codegen. createSfNativeHttp monta só /api/native e devolve undefined fora desse namespace; /procurement continua exclusivamente no Application legado. A base do client dedicado é origin+mount. O binding usa o client global da conexão exata. Os wrappers expõem somente operações fechadas.

**Geração:** propor target no build existente, exports @orchestra/client/sucafina e @orchestra/client/sucafina/effect, schema ./sucafina e protocol ./sucafina-api/grupos usados. A/45 executam geração e freshness incluindo ambos outputs novos e a descrição obrigatória do header de owner no método nativo de save. O check atual ignora dirs novos; seu escopo precisa ser ampliado. B não escreve generated à mão.

**Inputs reais:** SfHostRuntime.identity; SfHostServices.ui/productView; bootstrapLocalSurface; Procurement domain.view, queue-page/queue-view; endpoint Application existente. Passar Request preparado, não reconstruído. Efetuar reads preparatórias fora do lock e current/finish na sequência do freeze.

**Saídas:** discovery, context, return-intents, queue, detail e método typed saveRequestTitle; DTO por allowlist; classificação segura de erro; X-SF-Native-Owner e precondição síncrona dentro da transação conforme freeze; patches centrais inertes para A. Não ampliar todas as famílias de API neste lote.

**Critérios:** WP10.QLT.10; WP10.T06.INV.01/QLT.01; WP04.T01.CHK.01/INV.01/INV.02; CAMP.INV.01/02/04.

**Rechecagem futura:** método/body/digest/Origin, readonly positivo, absent/hidden, cancel/final fence, duas sessões, save real/CAS/response-loss, first-admin/mapa vazio. Qualificação live espera ACK72/73/74; sem isso entregar autoria independente completa e handoff, nunca mock permissivo ou green fictício.

### 77C — N2: cinco composições e guarda de edição

**Objetivo:** fundação visual mínima suficiente para a primeira ação real.

**Paths novos exclusivos:**

- packages/app-shell/src/orchestra/chapters/sucafina/shared/page-frame/**;
- shared/query-state/**; shared/record-table/**; shared/object-detail/**;
- shared/change-review/**; shared/draft-state/**;
- packages/app-shell/src/i18n/orchestra-chapters/sf-common.ts.

**Contratos de consumo:**

| Export | Entrada/saída |
| --- | --- |
| SfPageFrame | título/descrição/contexto/ação/children/variante de largura; MxPage e tokens existentes |
| SfQueryState | estado discriminado loading/empty/filtered-empty/ready/partial/unavailable/denied/stale/session-expired; callbacks explícitos |
| SfRecordTable<Row> | rowKey, colunas tipadas, seleção, ação por linha; sem endpoint/ACL interno |
| SfObjectDetail | objeto/contexto/conteúdo e callback close, foco restaurado |
| SfChangeReview | base/draft/current autorizado, estado de envio e callbacks Review/Submit/Cancel |
| DraftState/LeaveGuard | phase/ownerKey/retorno de foco; decisão stay/discard-and-leave/review do freeze |

Não usar JSX com strings visíveis literais nem depender de cor única. Kit, dialogs, fonte Inter, tokens, Theme/Language providers existentes. Variantes largas só locais SF; não editar kit.css ou paletas geradas.

**Retirados da dependência imediata:** MonthlyGrid com N4, ChartFrame com N9, RunState com N6/N9, Evidence com respectivos consumidores. Continuam no escopo completo; antes de delegar simultaneamente, N0 divide shared por componente, sem dois donos de shared/**.

**Critérios:** WP01.T02; WP01.T03.CMP.01/SUC.01; CAMP.QLT.01/02/03. **Rechecagem futura:** 320/768/1440 e zoom200; teclado/foco; temas sete; en/br/frases longas; contraste medido, sem alegar auditoria WCAG pela prancha. Não criar testes que apenas repitam props; provar o fluxo real em77E.

### 77D — N5: fila, detalhe e edição do título

**Paths novos exclusivos:** packages/app-shell/src/orchestra/chapters/sucafina/procurement/**; packages/app-shell/src/i18n/orchestra-chapters/sf-procurement.ts. Wrapper/registry pertencem a A.

**Dependências:** checkpoint de schemas B para iniciar; A/B/C completos para aceitar. Usa contrato e client públicos, sem importar Core/Server ou runtime privado no browser.

**Entrega exata:** fila Requests autorizada, detalhe por URL opaca, dados/versões/origem/cobertura visíveis, formulário título, preview antes/depois, confirmação explícita e POST canônico do freeze. Preserva seleção/scroll ao voltar. Estado pending bloqueia duplo envio; conflito conserva tentativa; outcome-unknown oferece consulta sem replay; revogação remove conteúdo. Não exibir “aprovação concluída”, receipt ou compra emitida.

**Critérios:** WP04.T01.CHK.01; WP04.T02.CHK.03; WP01.T01.CHK.02; WP01.T03.CMP.01; CAMP.INV.02/04 e QLT.03. **Consumidor:** A/N0 faz ACK aplicado/parcial/retido com causa. A prontidão do piloto não fecha todo WP04 nem M31/MI07.

### 77E — N10/45: qualificação futura do piloto composto

**Paths novos de autoria:** packages/app-shell/e2e/sucafina/native/**; test-browser/sucafina-native/**; path de evidência emitido pelo integrador. Não editar três specs canônicos, helpers atuais ou workflows sem handoff/owner. Checks executados só por45/runner autorizado; esta sessão não dispara nada.

**Seleção mínima discriminante, sem afirmar que cobre o epic:**

1. Dois contextos e dois principais: URL A versus seleção B, resposta tardia, revogação e denied/503 separados; mount A→B com ID/CAS iguais e cookie A→B com ambos autorizados recusam draft do owner antigo antes de executar.
2. First admin/mapa ausente versus mapa vazio; sessão e retorno válido/expirado; cookies/mount preservados.
3. Requester lê apenas o permitido em lista/detalhe/refs/contagens; direct-call não abre outro pedido; ausência/invisibilidade sem oracle depois de73.
4. Título muda em persistência real, campos restantes intactos e reload coerente; conflito CAS conserva draft.
5. Perda de resposta não dispara segundo efeito nem cria receipt; investigação autorizada não infere causalidade indevida.
6. Sair com draft por menu/atalho/back, Ficar/Revisar/Descartar e foco correto.
7. Mesmo shell/sidebar/Chat/Inbox, sem iframe/HTML legado; temas/idiomas/viewports/teclado, sem trunca valores ou ações.
8. Codegen/freshness dos clients/global metadata, typechecks do grafo/app/e2e e guards pertinentes pela interface de45.

Registrar W/S/C/tree, request normalizado, seleção coletada, pass/fail/skip/filtered, run/job/attempt/digests e limites. Nenhum resultado de fonte se transfere ao composto. Preservar os gates integrais oito seleções, AM01–06, C/G7 e D/G8.

## Correção do dispatch FINAL

A tripla da linha122 de ACCEPTANCE.md não governa a qualificação. Preservar os escopos canônicos:

| Revisor FINAL | Escopo |
| --- | --- |
| R1 | Produto/UX,28 capacidades, estados, acessibilidade e consumidores UI das contribuições residentes |
| R2 | Finanças, semântica, permissões/identidade, CAS/C03/C06/C12, persistência e memória protegida |
| R3 | IA real, perfis/skills, MCP, Atlas/scanner, Relay/Schedule/documentos, WP14, integração e retomada |

Três pessoas/agentes independentes dos arquivos julgados, com substituição se houver autoria e exame do mesmo candidato corrigido. As três frentes de apoio desta missão77 são revisão de plano e não preenchem esses receipts FINAL.

## Condições de liberação e autoridade

- S0 decide adoção deste adendo e autorização futura de fundação/piloto. A missão77 termina com parecer e pacote pronto, sem iniciar implementação.
- 71 é único integrador stack sob ACK71, lease S0-C-e13-browser71; sua eventual sucessão deve ser explicitamente reconciliada.
- 45 é o executor de checks; não há autorização implícita de workflow/runner.
- Autoria independente de UI/contratos pode ser liberada sem esperar a correção de todos os domínios. Composição de auth/local-entry e aceitação live esperam releases/ACK72/73/74 e os gates pertinentes.
- N3/UI32, N4/MonthlyGrid, Reports, P03, M31/MI07, Native/Relay/Schedule e scanner continuam com seus requisitos. Não bloquear o planejamento inteiro nem apagar bloqueios para declarar a leva concluída.
