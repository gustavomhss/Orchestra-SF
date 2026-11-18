# Cold cross-review de execução — contratos de outros autores

**Escopo:** revisão independente dos arquivos `CONTRACTS.md`, `contract-catalog.json`, `SURFACE-SPECS.md`, `surface-manifest.json`, `COMPONENT-CONTRACTS.md` e `component-signatures.ts`, escritos por outros autores. A autoria de `manifest.json`, work orders, protocolo e validador pertence a este reviewer; a checagem desses arquivos é integridade documental, **não** cold approval do próprio trabalho.

**Baseline observado:** planning `2f143330a0a44d34eb764ebfb851804c504edb6d`; contratos de produto `faa30fddb7e7b61696b66fd069f51cf18c51125f`; renderers fonte das capacidades nos pins declarados pelo manifesto. As referências de linha abaixo são do draft observado em 2026-11-15; os títulos/JSON Pointers são os identificadores estáveis de localização.

**Estado desta revisão: FECHADO_DOCUMENTALMENTE — nenhum dos CEX-01…CEX-11 permanece aberto no recorte examinado.** As correções foram relidas nos arquivos de outros autores. Isto permite congelar essas decisões de planejamento; não é autorização de execução nem aceitação de produto. Os gates operacionais externos continuam explícitos.

## Findings e prova de fechamento

### CEX-01 — P1 — Superfícies e componentes usavam enums diferentes de estado

**Prova:** o READ-01 original publicava `filter-empty`, resolving-context, read-only, removed/not-found e revoked; o enum fechado de COMPONENT-CONTRACTS não continha vários desses nomes. Um executor precisaria inventar o mapping ou alargar o enum. O novo enum de draft também precisava distinguir fases de submissão dos estados de página.

**Correção solicitada:** somente `filtered-empty`; `not-found` distinto de coleção vazia; mapping explícito das variantes semânticas. Draft pending/succeeded/revoked não pode criar uma terceira máquina implícita.

**Estado: FECHADO_DOCUMENTALMENTE.** COMPONENT-CONTRACTS §1/§2 contém `not-found` e mappings fixos; SURFACE-SPECS READ-01/DRAFT-01 coincide. `edit-common` mapeia pending→outcome-unknown, succeeded→clean após projeção autoritativa ou confirmed-without-projection, e revoked→availability revoked/purge. Os enums de `component-signatures.ts` são a fonte única de implementação, sem inventar phase adicional.

### CEX-02 — P1 — Inputs de endpoints novos apontavam para source inexistente

**Prova:** `contract-catalog.json#/operations/ctx.context/inputRef` e `#/operations/ctx.installations/inputRef` diziam usar os campos do branch pinado, mas `sourceSelector` identificava um branch `NEW`. Os schemas de input ainda não existiam no pin. A descrição do wiring e a descrição da resposta não resolviam esse input.

**Correção:** declarar o contrato NEW: discovery usa somente os campos Location existentes do SDK; contexto não recebe query/body nem parâmetros de rota livres; mount vem do descriptor; rejeitar extras/duplicatas. Separar evidência do wiring antigo da especificação nova.

**Estado: FECHADO_DOCUMENTALMENTE.** CONTRACTS §2.1, linha 21, define os inputs novos; os dois `inputRef` agora apontam a esse contrato e contêm a forma fechada. Não é uma afirmação de endpoint já implementado.

### CEX-03 — P1 — Logout tinha duas políticas incompatíveis de draft

**Prova:** CONTRACTS §2.3 dizia que logout/revogação não podiam aguardar prompt; COMPONENT-CONTRACTS §7 permitia guard antes de logout voluntário. Sem distinguir pedido de logout e efeito confirmado, um autor poderia impedir purge ou eliminar draft antes de o usuário decidir permanecer.

**Correção:** o pedido voluntário pode oferecer permanecer/descarte antes do ato; após confirmação, logout efetivo/revogação não aguardam prompt. Sessão expirada só permite quarentena efêmera não renderizável e restauração após a revalidação explícita descrita no contrato.

**Estado: FECHADO_DOCUMENTALMENTE.** CONTRACTS §2.3, linha 61, e COMPONENT-CONTRACTS §7, linha 96, agora distinguem essas transições. Nenhum evento de revogação espera escolha do usuário.

### CEX-04 — P2 — Assinatura de contexto e catálogo discordavam sobre o wire

**Prova:** `ctx.context/inputRef.type` era `undefined`, mas `createSfContextClient` recebia `Readonly<Record<never,never>>`. `outputRef.type` era `SfContext`, embora o wire e o client devolvessem `SfContextResult`, a união com status e payload. `ctx.login` ainda herdava header/descrição de JSON apesar de ser navegação de autenticação.

**Correção solicitada:** input `undefined`; output `SfContextResult`, com `SfContext` somente em `value`; login navegação separada, sem promessa de decoder JSON. Rejeitar chaves extras no runtime, não confiar em `Record<never,never>` como object schema fechado.

**Estado: FECHADO_DOCUMENTALMENTE.** CONTRACTS §6.1 e `host-signatures.ts` usam input undefined/output SfContextResult; os respectivos pointers do catálogo coincidem. ctx.login tem requestHeaders vazio e output navigation-only, ligado a createSfAuthActions, sem decoder JSON.

### CEX-05 — P1 — Componente de revisão exigia autoridade que o produtor não emite

**Prova:** `component-signatures.ts`, linhas 254–277, exigia `reviewRef` e `reviewDigest` para toda confirmação admitted, além de ref/version em todos os snapshots base/proposed. Os comandos legados descritos em CONTRACTS §5.2 usam `{page,action,id?,version,values,confirmed?}` e não emitem aqueles review tokens para todo create/save. Uma entidade ainda não criada tampouco tem ref persistida. O contrato empurrava o executor a fabricar tokens/refs ou bloquear uma ação legítima.

**Correção solicitada:** distinguir binding de preview/review real de binding de comando versionado legado; preservar os tokens somente quando existem no produtor. Representar draft/new intent como identidade local explícita, distinta de entidade persistida; base ausente apenas quando o fluxo do produtor permite create. A UI não ganha autoridade por portar a estrutura de apresentação.

**Estado: FECHADO_DOCUMENTALMENTE.** O tipo final distingue producer-review de catalog-command. Este último só contém operationId e a versão record/admission/none, mais confirmação presentation-only ou campo real do produtor; não exige sourcePage/actionId para routines/Schedule. Snapshots distinguem persisted/draft local/not-provided; base nula só antes da criação admitida. `SfDraftInput` e `confirmSave` também distinguem ausência legítima de base e sucesso confirmado sem projeção. Releitura verificou os tipos concretos, não apenas uma proibição em prosa.

### CEX-06 — P2 — Callback de layout contradizia a regra de callbacks

**Prova:** `SfPageFrameProps.onLayoutMode` em `component-signatures.ts:102` precisa notificar uma mudança de largura; a regra final do mesmo arquivo dizia que callbacks só ocorrem por gesto humano. Resize/layout inicial não são comandos de domínio.

**Correção solicitada:** classificar `onLayoutMode` explicitamente como notificação idempotente de apresentação, emitida apenas quando o modo muda; proibir que ela faça fetch/escrita/autoridade. Manter a regra de gesto para callbacks de ação/efeito.

**Estado: FECHADO_DOCUMENTALMENTE.** As restrições finais do arquivo TypeScript permitem explicitamente onLayoutMode no mount/resize como notificação de apresentação; callbacks de efeito continuam dependentes de gesto humano. Layout não dispara rede/comando.

### CEX-07 — P2 — Enrollment confundia payload do produtor e envelope de correlação Dock

**Prova:** CONTRACTS §4.3 define `enrollNativeLocal()` sem argumentos devolvendo dados de instalação/URL/expiração. O option de `attachSfNativeEnrollment` em §6.1, linha 284, exigia `SfNativeEnrollmentReply`, posteriormente definido como o envelope completo com `kind`, `launchId` e `requestId`. A função sem argumentos do produtor não conhece o requestId da mensagem recebida.

**Correção solicitada:** dois tipos privados exatos: payload original do produtor e reply correlacionado Dock. `attachSfNativeEnrollment` acrescenta somente os IDs da mensagem/canal corrente, valida o descriptor e preserva a credencial original single-use. O main consome o envelope completo; renderer nunca o recebe.

**Estado: FECHADO_DOCUMENTALMENTE.** CONTRACTS §6.1 e host-signatures declaram SfLocalEnrollment (payload) e SfNativeEnrollmentReply (payload mais kind/launchId/requestId). O callback no-arg retorna somente o payload; attach acrescenta os IDs do request corrente. O import público AppDockSocket/socket-transport substitui uma suposição de subpath transport não publicado.

### CEX-08 — P1 — Registro aprovado de conexões remotas do desktop ainda era uma abstração sem produtor

**Prova:** CONTRACTS §6.1 dizia que I00 espelharia o “evento de conexão aprovado” para um registry privado main. O source pinado `apps/desktop/src/main/server.ts:17–29` só define get/set de default URL; `main/ipc.ts:117–120` recebe a URL do renderer. `renderer/index.tsx:442–473` monta conexões remotas a partir do estado recuperado e `packages/app-shell/src/context/server.tsx` contém a lista persistida do renderer. Não foi identificado nesse desenho um registry main existente com conexão/credencial aprovada ou um evento com a forma presumida.

**Correção solicitada:** declarar o seam NEW de registro, sua fonte de conexão/credencial e o evento/método exato que I00 compõe antes de bind, ou apontar o produtor real existente. OwnedServe já tem referência concreta. Um `serverKey` recebido de renderer não pode criar uma conexão por efeito colateral de bind; o integrador não deve escolher sozinho o mecanismo de confiança de conexões externas.

**Estado: FECHADO_DOCUMENTALMENTE.** CONTRACTS §4.1 e host-signatures definem registerConnection NEW, canal, candidate fechado, validação, diálogo nativo antes da rede do broker, registry em memória e exceção ownedServe com fonte main real. bind não registra destinos. release distingue binding de conexão (serverKey/projectId/generation), inclusive registro aprovado ainda sem bind, e remove credenciais/handles somente da geração correspondente. I00 possui o hook de server.tsx; D01 possui connections.ts, IPC leaf e cinco textos COPY-02. É uma decisão de produto planejado; não houve login/credencial/aprovação operacional nesta sessão.


### CEX-09 — P1 — Os novos imports públicos não atravessavam os export maps dos pacotes

**Prova:** os packages pinados usam mapas explícitos: Schema blob `adc53ecfa8f4ac83fee37854db2dc0ec2bb9136a`; Client blob `4cd0244e98ff18b5e65d3c2808196705095b6691`, com somente `.`, `./effect` e `./contract`. Criar arquivos `src/sucafina/*.ts` e barrels não publica esses subpaths. Sem uma decisão explícita, executores fariam import privado ou o build falharia.

**Correção e estado: FECHADO_DOCUMENTALMENTE.** CONTRACTS §6.1–§6.2 fixa exports explícitos de context/common/transport, quinze famílias, operation-registry e bindings. I00 possui os dois package.json exatos e `package_exports` fechado; não há wildcard, dependency/lockfile change ou owner concorrente. I00-AC04 exige resolução dos imports no compiler gate da implementação composta, ainda não executado.

### CEX-10 — P1 — Tipo de rota compartilhado estava em uma camada que Client não pode importar

**Prova:** o login do F02/D01 recebia SfResolvedRoute, inicialmente tratado como APP-only, enquanto o client deveria depender somente dos schemas públicos. A primeira declaração host também usava uma consulta import de JSON inadequada, e os documentos separadamente declaravam variantes de OwnerSelection/OperationId.

**Correção e estado: FECHADO_DOCUMENTALMENTE.** `route-signatures.ts` fecha 70 SurfaceIds e 165 pares superfície/kind/params, com destino de implementação F01 Schema/context. APP/context/contracts.ts reexporta esses tipos e acrescenta somente SfSurfaceProps e tipos de estado/UI. Host e componentes importam a única declaração documental de rota; OperationId vem do conjunto fechado do catálogo/F02 Schema/common, sem segunda marca nominal. CONTRACTS §6.2 fixa owner/path de cada tipo, e o validador confronta os 165 pares com os paths reais do surface-manifest. Não foi alegado typecheck de produto.

### CEX-11 — P1 — Registro agregado ameaçava a fronteira de ownership e recriava uma barreira global

**Prova:** a primeira localização proposta para a metadata global era `Schema/sucafina/operations.ts`, já pertencente à família Operations/A11. Um registro runtime único que importasse codecs dos quinze adapters também faria F02/piloto depender de todas as famílias, apesar da closure enxuta publicada.

**Correção e estado: FECHADO_DOCUMENTALMENTE.** Metadata completa usa I00 `operation-registry.ts`, separado do leaf A11. `SfNativeOperationBindings` em index.ts contém somente codecs reais admitidos no candidato, por injeção em F02/D01. Ausência de binding conhecido falha com o motivo tipado contract-unavailable antes de rede; não existe schema permissivo ou sucesso fictício. Piloto exige 43 bindings de F01/F02/A03 (auth/SDK em seus modos próprios), metadata permanece com 305 IDs; C final exige todos os 305. O validador confere key sets e que os owners do subset estão na closure do piloto.

## Conferências cruzadas que não constituem achado

- O catálogo preserva método/URL/envelope/admission dos HTTP JSON existentes e separa as projeções/seams novos; não há pedido para reimplementar os produtores ou criar um segundo codegen.
- Os métodos de `BusinessPorts.routines` e `BusinessPorts.schedules` citados em CONTRACTS §5.4 existem no source `product/contracts/ports.ts:92–106`. Seus bindings operacionais continuam requisitos externos; a implementação de um estado unavailable não fecha Native41/Relay/Schedule.
- O callback Dock reutiliza o `Transport` original; o source de socket transport de fato não fornece removeListener. O contrato descreve dispose como invalidar/ignorar callback, sem inventar uma API que o produtor não possui.
- O path real do registry de tradução é `packages/app-shell/src/i18n/orchestra.ts`; não existe um `orchestra-chapters/index.ts` equivalente no source observado. A própria allowlist de I00 foi corrigida antes desta conclusão.
- A especificação reconhece o desktop `oc://renderer` e exige broker/session e prova instalada reais. A política web de same-origin não foi apresentada como suporte desktop.

## Integridade do pacote de execução — validação autoral, separada do cold review

O resultado versionável está em `execution-structure-check.json`: PASS_DOCUMENT_STRUCTURE, zero errors/warnings. Há 78 IDs, 47 fatias de UI, 361 claims de ownership sem colisão inclusive ancestor/descendant, dois grafos com 78 nós, 175 vínculos de componente com locks nos três campos, 73 vínculos superfície→owner de operação, 70 superfícies/165 rotas tipadas e 305 operações. O grupo atômico F01/F02/S03 tem F03 como pré-requisito; S03 consome F01/F02 somente por tipos, e I00 injeta a factory. Os 8 outputs parciais têm propriedade e dependências explícitas.

A closure planejada do piloto contém somente A03, D01, F01–F04, S01, S03, U10.queue, U13.pr-approval, Q01.pilot e Q02.pilot. As matrizes completas de Q01/Q02 e todos os 47 outputs de UI continuam obrigatórios para as revisões finais. A divisão elimina uma espera artificial por grid, evidence/collaboration e BI que a jornada piloto não consome.

Os 1.610 pointers e IDs canônicos foram resolvidos, com 74 tasks referenciadas. A materialização local continha exatamente um LF adicional; removê-lo reproduz o Git blob pinado `71b56906f8bb190c4d568f60c7511ce1ff63d5f3` e SHA256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. A campanha não foi duplicada nem reescrita.

Não foram executados testes de produto, typecheck, geração, CI, startup, deployment ou mutações remotas por este reviewer. PASS_DOCUMENT_STRUCTURE não significa assinatura sem defeitos, produto correto, produtor disponível ou autorização para implementação.

## Snapshot dos contratos revisados

As somas abaixo identificam exatamente os bytes de contratos relidos neste fechamento. Mudança normativa posterior invalida o ACK dos consumidores afetados conforme o protocolo; não rebatizar evidência antiga como revisão de conteúdo novo.

| Arquivo | SHA256 |
| --- | --- |
| CONTRACTS.md | `d3fa19390c8673ec1f6dfa24d95cec33f251e76f553d916995c7cedb83986642` |
| contract-catalog.json | `7cd799147af22376a84c2a0844fd9893e37a19b3d7ad389270dde93efb571725` |
| SURFACE-SPECS.md | `5e3d8e92adcdb70f92f7b1a21af46b587b6fd90d620a6795d83e841b21f4f49f` |
| surface-manifest.json | `28633c40d9f6a0e5e6dcb2c7de6fc9cf3272e3aafe9b2e97d492a80252e17cbd` |
| COMPONENT-CONTRACTS.md | `079eb0c07092e514ae0b7bb771f366e6bf9ba9be9227f8888f49592920f701c0` |
| component-signatures.ts | `ec77a2fbec74154b90fb7a5b8b2edb47021a6f8bbc92b528bb8c6a48af7569a2` |
| host-signatures.ts | `72919a84e8c03e157376ed610f62673b668ae8c86084f3249aeac32cb0b86524` |
| route-signatures.ts | `ece53b32c660ee87cbae4ed88239c96e800110afa317268628b6722f29a1eaaf` |
