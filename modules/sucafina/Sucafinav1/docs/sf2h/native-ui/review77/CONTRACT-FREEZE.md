# Freeze proposto da primeira leva — missão77

**Revisão documental; implementação não autorizada nem executada.** Este adendo torna a primeira leva revisável e delegável sem reescrever a PR76. Identificador de consumo: **review77-native-pilot-1**. Sua identidade imutável é o Git blob deste arquivo no commit publicado; o integrador registra esse blob no ACK antes da autoria. Mudança do contrato exige novo blob e ACK explícito dos consumidores.

A arquitetura de quinze chapters, sidebar única, Solid, providers e tema Orchestra é mantida. A descoberta abaixo acrescenta somente metadados ao HttpApi global. A API de negócio continua dedicada, dentro do mount SF; autenticação global do Orchestra não substitui a identidade SF.

## 1. Alcance e topologia

| Situação | Primeira leva | Regra |
| --- | --- | --- |
| Orchestra web e instalação SF no mesmo publicOrigin | Elegível após composição/ACKs | Mesma conexão selecionada, cookies existentes no mount |
| Desktop com renderer oc:// e sidecar HTTP | HOLD | Não alegar suporte pelo bridge HTTP; requer contrato de retorno/transporte e owner próprios |
| Web cross-origin ou SDK sem provider de binding | Indisponível | Não alargar CORS/cookie, copiar token, criar proxy de credenciais ou escolher outro servidor |
| Instalação sem perfil SF | Shell anterior preservado | Home/Chat/Inbox/Maestro/busca/WIP e suas ações conservam comportamento |
| Destino ainda não portado | Não recebe aceite | Catálogo distingue permitido de implementado; não habilitar CTA fictícia |

O piloto entra em **/orchestra/sf-procurement/requests**, e detalhe em **/orchestra/sf-procurement/requests/:ref**. O overview de Procurement e Hoje permanecem o destino final previsto no plano; a ativação limitada do piloto não muda o default global para uma home inexistente. As outras quatorze áreas continuam obrigatórias e sem aceitação por registro, placeholder ou flag desativada.

## 2. Rota, descoberta e owner

### 2.1 Codec único

A rota conserva o formato da PR76:

`/orchestra/<chapter>/<rest>?server=<key>&project=<projectId>&installation=<installationId>`

Os quinze IDs e seus defaults são os da tabela UX-DESIGN: sf-home, sf-dashboard, sf-planner, sf-procurement, sf-portfolio, sf-decisions, sf-work, sf-reviews, sf-people, sf-operations, sf-bi, sf-documents, sf-imports, sf-memory, sf-routines.

O codec aceita um valor por chave, decodifica uma vez e rejeita parâmetros duplicados, escapes inválidos, path traversal, fragmento de autoridade e contexto parcial. Chapter/rest devem estar no manifest. IDs continuam seletores opacos; nunca credenciais. Nenhum directory, principal, papel, token ou draft vai à rota. No piloto, só lista/detalhe Requests e os três parâmetros de contexto são necessários. Filtro textual permanece em memória. Filtros de outras famílias só entram com allowlist tipada daquele destino.

Sem os três parâmetros, abrir o seletor; escolher explicitamente uma conexão/localização antes de consultar SF. Com os três parâmetros, resolver a conexão pelo key exato, sem usar server.current como fallback. URL A tem precedência sobre seleção B persistida. Destino/capacidade não disponível mostra recuperação explícita, sem cair silenciosamente em Dashboard/Hoje.

### 2.2 Discovery de metadados no Orchestra

**GET /api/sucafina/native-binding**, pelo client da mesma conexão selecionada e Authorization existente do Orchestra. Não usar middleware que crie/resolva uma pasta a partir do seletor.

Query é uma união fechada:

| select | Campos permitidos | Fonte |
| --- | --- | --- |
| ids | installationId, projectId | Deep link explícito |
| location | directory, workspaceID opcional | Location.Info canônica já selecionada pelo shell |

Cada chave ocorre uma vez; select é obrigatório; braços misturados/campos extras/forma inválida retornam 400 sem ecoar entrada. Provider ausente, identity ainda não pronta ou mismatch retorna 200 com `{status:"unavailable"}`, sem inventário de instalações, IDs alternativos ou motivos que enumerem dados.

O provider é uma função opcional fornecida pela instalação carregada pela trusted-code factory. Compara os seletores com a identity privada corrente; não chama projects.resolve para entrada arbitrária. O modo ids funciona sem conhecer directoryA. O modo location compara a location configurada exatamente, inclusive workspaceID quando pertinente.

Resposta ready, sem campos adicionais:

```ts
type NativeBinding = {
  status: "ready"
  contractRevision: "review77-native-pilot-1"
  publicOrigin: string
  mount: string
  installationId: string
  hostId: string
  projectId: string
}
```

publicOrigin provém da composição validada (transport.publicOrigin quando aplicável), nunca de Host/forwarded recebidos. O mount usa a validação existente. Não devolver principal/grants/grupos/directory/dados/segredos. Resposta no-store.

Antes de prosseguir, exigir `publicOrigin === origin(conexão selecionada) === window.location.origin`. Uma segunda conexão com mesmo origin não substitui o key selecionado; a chave de estado conserva esse key.

### 2.3 Contexto SF autenticado

**GET <mount>/api/native/context?installationId=...&projectId=...&hostId=...**. Query fechada, sem duplicatas. IDs representam expectativas, não grants. O handler compara runtime identity antes/depois; hostId alterado pede rediscovery da mesma conexão.

Depois de prepare/bootstrap permitidos, usar a admissão real **sf_request_read** com o digest de **procurementQueueIntent(period)**. O período é o ano UTC corrente do environment.at, conforme queue-page.ts; não criar filtro arbitrário nem cálculo de aging no browser. Validar o mesmo operation/digest e navegação Procurement, revalidar antes de responder, e finish em finally. Leitura não deve depender de humanActions(), que pode estar vazia para quem não escreve.

Resposta ready:

- contractRevision, publicOrigin, mount, installationId, hostId, projectId;
- location canônica autorizada de runtime.identity(), nunca loaded.directory do armazenamento;
- principalRef não vazio obrigatório; displayName opcional quando disponível/autorizado;
- accessRevision e policyVersion observadas na autoridade real;
- period; catálogo do piloto com Requests e estados efetivos de disponibilidade;
- contextStamp derivado desses eixos, apenas para consistência; não é bearer token nem autorização reutilizável.

Schemas devem usar os tipos canônicos de ID/location/period e rejeitar campos desconhecidos. Não publicar TrustedUiContext, Request, lease, claims, snapshot, roleMap ou diretório de pessoas. O catálogo futuro será produzido por capacidade/superfície real; não somar papéis de Dashboard/Planner/Procurement.

Estados fechados: 401 somente sessão ausente/expirada comprovada; 403 recusa comprovada; 409 expectativa de binding obsoleta; 503 autoridade/runtime indisponível. Nenhuma exceção genérica vira 403. Todos sem dados restritos, no-store e nosniff.

### 2.4 Publicação e transição atômicas

Estados do resolver: unselected → resolving → ready, ou unauthenticated/denied/unavailable/stale. Durante resolving não renderizar dados do owner antigo sob a seleção nova. A chave do owner inclui key da conexão, instalação, host, projeto/location, principal, accessRevision/policyVersion e geração de requests.

Uma única operação **requestNativeTransition(destination, cause)** atende sidebar, menu de projeto, atalhos, links, back/forward e reload. Ela aplica §3 antes de alterar a seleção. Depois da resolução e autenticação, publica URL, seleção visual e owner coerentes; nenhum evento intermediário pode despachar comando ao owner anterior. Um comando captura o owner/geração de sua edição; se divergirem, recusa localmente e revalida no servidor.

Troca de projeto dentro de SF mantém a área permitida e remove detalhe/filtro específico do objeto anterior. Não abre Chat automaticamente. O servidor explícito inválido não é substituído por um saudável. AbortController e geração impedem resposta tardia de atualizar outro owner; caches e drafts nunca atravessam principal. Preferência de disclosure pode persistir só booleans por owner, sem dados de negócio.

N0 também resolve ConnectionGate antes do Router para que uma conexão global B não impeça a resolução explícita de A nem a falsifique.

## 3. Draft, saída, erro e foco

77C fornece contratos locais, sem persistência paralela:

```ts
type DraftPhase = "clean" | "dirty" | "saving" | "outcome-unknown"
type LeaveDecision = "stay" | "discard-and-leave" | "review"
type TransitionCause = "link" | "sidebar" | "project" | "shortcut" | "history"
```

O registro liga phase, ownerKey, elemento de retorno de foco e callback de revisão à superfície ativa. Há um coordenador por owner acima da boundary keyed por chapter e abaixo dos providers SDK/Models; nenhum draft global compartilhado entre instalações. A chave owner+surface+recordRef/editScopeKey é estável, sem baseVersion no lookup. Navegar entre capítulos/objetos do mesmo owner conserva draft e indicador de retomada. Componentes recebem callbacks tipados, não mutam URL por conta própria. Esta decisão também reaproveita o avanço documental DRAFT-01 do head posterior indicado em LATE-DRIFT; não criar um segundo controller.

| Estado/evento | Comportamento obrigatório |
| --- | --- |
| clean, saída voluntária | Pode transicionar |
| dirty com perda potencial | Dialog Ficar / Descartar e sair / Revisar antes de sair; URL/owner intactos até escolha |
| dirty, navegação interna no mesmo owner sem perda | Conservar draft em memória acima do chapter e mostrar retomada; não pedir descarte desnecessário |
| review | Fecha dialog, volta ao formulário/preview no mesmo owner; nenhum save implícito |
| saving | Não iniciar envio concorrente; informar operação em andamento; sair não cancela o efeito já enviado |
| outcome-unknown | Explicar resultado incerto; oferecer consulta autorizada e saída explícita; nunca retry automático |
| 503/timeout de leitura | Conservar entrada local no mesmo owner ainda autorizado; distinguir de revogação |
| revogação comprovada/logout/principal trocado | Remover conteúdo privado e descartar dados incompatíveis; não oferecer Ficar expondo conteúdo perdido |
| back/forward recusado | Restaurar rota/seleção anterior sem loop e foco no acionador/formulário |
| refresh/fechar navegador com edição | Usar proteção beforeunload existente/adaptada; não substituir a guarda SPA |

O “descartar” é do estado de edição; nunca promete cancelar um POST já entregue. Conflito preserva base, tentativa e atual autorizado, sem sobrescrever. Armazenamento privado do draft é somente memória deste owner; nada de localStorage ou draft em query.

Todos os textos usam LanguageProvider. Status não depende só de cor; erro junto ao campo e resumo navegável; foco retorna ao acionador, ou ao cabeçalho se removido.

## 4. Composição, autenticação e login

### 4.1 Porta privada explícita

N1 implementa `nativeHttp(request): Promise<Response | undefined>` como porta privada nova, independente de Application["product"]. N0 adiciona a porta a SfHostServices e a compõe no runtime/instalação. Ela é chamada depois de identity.prepare e antes do roteador business legado. Nenhum listener novo.

A instalação externa já adapta/clona Request antes de prepare. A invariante é conservar **o mesmo objeto preparado recebido no handler da instalação**, atravessando nativeHttp, admissão e produtor. Não chamar endpoint legado com URL reconstruída nem emitir um Request a partir de actorId.

Reusar proteção de host/origin, transport Microsoft, privacy/logging, limites de body e aborts existentes. Não desativar scanners ou guards. SucafinaApi agrega os grupos nativo e legado para geração dos clients. createSfNativeHttp monta somente o grupo nativo sob <mount>/api/native. Fora desse namespace, devolve undefined para o roteamento existente; dentro dele, path desconhecido devolve 404 e método incompatível 405. O POST <mount>/procurement permanece exclusivamente no Application legado; não ganha segundo handler, redirect ou chamada interna. A bridge de retorno é interceptada separadamente em local/entry.ts pelo marcador exato, sem ampliar o namespace da API.

Primeiro acesso Procurement: N0 chama a função existente **bootstrapLocalSurface** para procurement, nas mesmas condições de pessoa autenticada/configuração não-operator do legado. Somente mapa ausente pode ser semeado após confirmação viva de admin; roleMap explicitamente vazio permanece vazio. Não inicializar as três superfícies por conveniência.

### 4.2 Retorno ao destino nativo

A bridge opaca já proposta na PR76 fica fechada assim:

1. **POST <mount>/api/native/return-intents** aceita apenas o destino canônico do piloto (chapter/rest e os três seletores de rota, sem URL absoluta, principal, draft ou texto livre). Origin exato, JSON fechado e limite pequeno de corpo (4 KiB) antes de parse; sem aceitar credenciais no payload. É metadado de retorno, não grant nem comando de domínio.
2. Validar codec, binding installation/project corrente e origin público; armazenar destino em mapa privado efêmero, com referência aleatória de pelo menos 128 bits, expiração de até cinco minutos e teto de 256 pendências por instalação. Ao atingir teto, retornar indisponível; não desalojar uma pendência ativa silenciosamente. Não gravar em banco de negócio nem logar conteúdo.
3. Retornar apenas loginUrl construído pelo servidor: auth/login existente com returnTo permitido **<mount>/dashboard?sf=native-return&resume=<opaqueRef>**. safeReturn e OAuth/cookies existentes não mudam.
4. Handler de GET/HEAD desse marcador, depois de identity.prepare, usa query fechada e token válido. GET consome uma vez, revalida sessão/binding e a leitura Procurement; então 303 no-store para rota relativa permitida no mesmo origin. HEAD não consome. Inexistente/expirado/reutilizado: mensagem genérica de retorno indisponível e recuperação explícita, sem Dashboard silencioso.
5. Retorno nunca repete uma mutação. Destino de objeto recebe sua autorização normal ao abrir; a referência de retorno não aumenta acesso. Reinício invalida tickets com recuperação legível.

Com draft e sessão expirada, o fluxo de login deve preservar a instância SPA em memória (login em contexto separado, seguido de retry explícito). Depois do login, apenas o mesmo principal e contexto reautorizado podem recuperar a edição. Se uma navegação completa for inevitável, a guarda informa a perda antes de sair; não alegar persistência de draft não implementada. Em revogação comprovada, prevalece limpeza.

Esta costura requer revisão/ACK72 antes da composição e prova live. Nenhuma autorização de novo login, Azure, token ou infraestrutura é emitida pela missão77.

## 5. Leituras do piloto e wire DTO

Operações novas, com os três campos de expectativa do §2.3 em query fechada:

| Operação | Método/path | Produtor |
| --- | --- | --- |
| native.context | GET /api/native/context | sf_request_read + identidade do host |
| procurement.requests.list | GET /api/native/procurement/queues | productView(request, procurement, Requests) |
| procurement.requests.detail | GET /api/native/procurement/requests/:ref | Mesma view/coleção autorizada e domain.view |

Paths são relativos ao mount. Não aceitar query de período não suportado. Fila retorna o período e todas as linhas já autorizadas do produtor atual; filtros locais da primeira leva só atuam nesse conjunto. Volume/virtualização/paginação futura não inventam total ou truncamento silencioso.

Sequência: productView preparada fora do lock → transação Procurement → autenticação com roleMap atual e canWrite atual → página autorizada → prepared.current(snapshot, actor) → domain.view → allowlist → revalidação final → resposta. finish sempre em finally, inclusive erro/abort. Usar readProcurementQueueView apenas no servidor, onde seu WeakSet continua válido. Não serializar a marca nem aceitar JSON de cliente como apresentação confiável.

DTO de fila tem somente:
id, sourceRef autorizada C17, projectionVersion, status, subject, holder, approvalStage, stageEnteredAt, ageDays, baseAmount/baseCurrency, submittedAmount/submittedCurrency, originalAmount/originalCurrency, monetaryState, reason, nextStep.

Campos ausentes permanecem null. Valores vêm de C02; nada de FX, aging, ranking, totais ou alçada recalculados no client. Não transportar stock/aging/projection inteiros por conveniência.

Detalhe acrescenta id/number, title de request.pr.title, status, **expectedVersionCAS** de view.versions["requests:"+id].version e affordance advisory saveTitle. A affordance é produzida no servidor com as condições existentes (canWrite, papel admitido, PR draft/pr_rejected e creator/admin), subordinada à reautorização do comando. Browser não infere ACL. Extração de política compartilhada só pelo owner do produtor depois da liberação; não é necessária para ampliar regra.

**projectionVersion C02 e expectedVersionCAS não são intercambiáveis.** ID não visto na coleção autorizada recebe resposta indistinguível de ausente; qualificação depende da correção73 para o endpoint de mutação e suas falhas, não só do DTO novo.

## 6. Única mutação: salvar o título de uma PR

Método tipado **saveRequestTitle({id, expectedVersionCAS, title})**. Não publicar action:string nem values arbitrário no client nativo.

POST real para **<mount>/procurement**, fora do prefixo /api/native:

```json
{"page":"Requests","action":"save","id":"<id autorizado>","version":7,"values":{"pr":{"title":"<novo título>"}}}
```

É edição de uma PR existente em draft/pr_rejected. Não é submit, aprovação, rejeição, escolha de fornecedor, emissão de PO nem Apply M31. O formulário contém somente título; prévia mostra antes/depois e versão. A operação preserva demais campos e usa Application/Domain.execute existentes para Origin, limite/schema, autenticação, CAS, auditoria, historyNames, dataset version e redaction.

Client usa mesma conexão/origin/mount e Request de browser real. Sem redirect de POST, loopback ou chamada interna do handler com Request fabricada. O target de geração representa o path legado explicitamente; o prefixo /api/native não pode modificar esse método. O grupo legado existe no agregado de codegen, mas somente o Application atual monta o endpoint.

### Precondição de owner na mesma transação

O client nativo ligado ao owner envia obrigatoriamente **X-SF-Native-Owner**. Valor: JSON UTF-8 codificado em base64url sem padding, no máximo 2048 bytes antes de decodificar, com exatamente installationId, hostId, projectId e principalRef não vazios dos schemas canônicos. Um único header; forma combinada/duplicada, campos extras ou parcial são inválidos. Esses valores são expectativas de consistência, nunca identidade concedida. O wrapper captura-os do NativeContext da edição; não aceita sobrescrita por props ou formulário.

N0 compõe um precheck na instalação: parse fechado, Request/runtime/store/identity da instância corrente capturados sem reler body; binding divergente retorna409 genérico. Header presente sem o fence instalado retorna503, nunca cai no legado sem proteção. Header ausente conserva o comportamento dos consumidores legados existentes; o método nativo gerado/wrapper sempre o exige.

N0 também adiciona **nativeCommandPrecondition** opcional a Application, depois de release/ACK73/74. Ele é chamado DENTRO da transação, depois de authenticate, actor e página autorizados, imediatamente antes de Domain.execute para o comando nativo. Input privado: o mesmo Request, actor autenticado, surface/page e Command já parseado pelo mecanismo existente. Callback síncrono/puro: sem I/O, nova leitura de store, lock aninhado ou nova admissão. Sua implementação fica em product/native-ui/command-owner.ts; Application fornece o actor real, jamais actor lido do header.

A precondição confirma que runtime/store/identity capturados continuam os mesmos, request não foi abortado, tuple privado corrente coincide e actor.id é o principalRef esperado. Também exige page Requests, action save e somente values.pr.title no comando nativo. Formato/ação fora do contrato retorna400; mismatch retorna409 seguro, commit=false, sem revelar IDs. Gates de autorização normais continuam podendo retornar401/403. Se o hook não estiver disponível ou a instância não estiver pronta,503/commit=false.

Runtime/store/identity capturados não podem ser rerroteados após await; reconfiguração cria outra instância/hostId. A garantia de commit continua a do persistence e signal existentes, sem transação global nova. O caminho title-save é síncrono entre esse fence e a proposta de commit; repetir a comparação de binding antes de retornar commit=true caso haja qualquer await introduzido nesse intervalo. Não usar uma mera consulta de contexto antes do POST como substituto. Sessão trocada de A para B, mesmo B autorizado, e mount reconfigurado A→B com IDs/CAS coincidentes recusam o save antigo antes de Domain.execute. Essa alteração NÃO mexe no domínio Procurement nem em política/alçada; é uma precondição adicional do consumidor nativo. A composição fica bloqueada até os ACKs, mas o patch está definido para autoria.

Resultado real: 200 com ok:true e warnings opcionais. Falhas de domínio conservam status, errors, fieldErrors e versão corrente redigida conforme o produtor. 401/413/415 de fronteira podem ser texto: normalizar para erro visível sem renderizar HTML/stack/resposta arbitrária.

**Não há receipt C12 nem deduplicação durável em save.** Bloquear duplo clique em pending; CAS protege concorrência. Sucesso aciona leitura autorizada e confirmação de gravação. Perda de resposta produz outcome-unknown e consulta autorizada, sem replay. Mesmo título observado depois não prova causalidade deste envio e não pode virar recibo.

O piloto usa dois atores com permissões reais: requester A edita seu draft; B não autorizado não vê ID/título/contagem/ref desse pedido nem consegue alterá-lo por chamada direta. Um segundo editor legitimamente autorizado produz o caso de conflito CAS. Esses são cenários futuros, não fixtures permissivas.

## 7. Matriz de admissão que os próximos consumidores devem conservar

| Família/operação existente | Verbo/gate obrigatório | Tratamento nativo |
| --- | --- | --- |
| views: list/open/save/remove | POST + Origin + JSON + Idempotency-Key; human.authorize do payload exato | Não promover a GET/PATCH/DELETE |
| analyses: list/read/output | POST; analysis.read com digest/payload exatos | DTO do resultado real após admissão; não renderizar/parsear o HTML do output legado |
| demais análises/mutações humanas | Operação fechada já admitida pelo produtor | Congelar payload/action/port/resultado por operação antes de despachar consumer |
| receipts C03/C12 reais | Identidade idempotente e reconsulta do produtor onde existem | Não estender a saves legados sem receipt |
| routines/watch | Admissão native/Relay/Schedule atual | C31 mantém ativação HOLD; presença de código não habilita ação |

Idempotency-Key pode ser exigida para admissão/correlação sem que toda operação ofereça deduplicação durável. A matriz final distingue ambos. Nenhuma incompatibilidade autoriza mudar human-authority, clonar Request após prepare ou sintetizar TrustedUiContext.

## 8. Contratos obrigatórios antes das próximas famílias

**Personal views / R77-F06.** Reservar produtor existente ao seu owner e publicar delta versionado aditivo: target discriminado legado (surface/page) ou nativo (chapter/view permitido); filtros por target; landingPreference opcional por principal/instalação/projeto. Sem cast de sf-work para dashboard. Listar/salvar/abrir/remove reautorizam destino, preservam CAS, dados antigos e C06; preference não concede ACL. Hoje só é fallback sem preferência válida. UI32 fica HOLD até esse contrato e migração terem ACK. Não bloquear o title-save por essa dependência.

**MonthlyGrid / R77-F07.** N2/N4 definem seleção retangular, colagem TSV e preview antes de alterar draft; campos inválidos/fora do intervalo/locked ficam explícitos. Consumir monthly-edit/monthly-host, inclusive revisão independente por linha e resultados parciais. Conservar texto tentado, remover somente mudanças salvas e reenviar somente correções. Annual/spread/reset continuam separados e com preview. Mobile oferece entrada/preview de intervalo com mesma semântica; editor por mês é opção adicional. Não criar motor financeiro no frontend.

**Aprovações.** Depois do piloto, N5 prepara variantes PR/sourcing/PO com etapa, holder intermediário/final, versão congelada, moeda/FX, diferença, fontes, motivo de rejeição, confirmação, conflito e retorno. Board04 sozinho não é a decisão completa. M31/MI07 permanece com o produtor.

## 9. Migração e reversão

M1 adiciona um caminho nativo pequeno, sem mudar persistência. Links legados só viram redirects de GET/HEAD após autorização e prontidão daquela capacidade. POSTs, auth, downloads, assets e endpoints consumidos por agentes mantêm handlers próprios. A tabela das 28 CAP da PR76 continua a fonte de page→chapter; não inventar aliases pelo título.

No piloto: Requests legado corresponde a sf-procurement/requests; detalhe conserva referência, tuple e seleção. Se o query legado contiver filtro não representável, manter o destino legado explicitamente e informar a limitação — não redirecionar descartando intenção. Links unknown/duplicados/malformados não abrem Dashboard silenciosamente. Vendor Contracts conserva ACL Dashboard quando chegar ao chapter Procurement.

Rollout é configuração de apresentação por instalação/capacidade, não grant. Legado temporário não conta como integração nativa nem substitui o destino Solid. Reversão muda a apresentação da família; não restaura banco, apaga receipts ou copia draft entre pessoas. Não desativar renderização legada antes das jornadas, paridade e consumidores compatíveis.

## 10. Limites de prova

Tudo acima é contrato proposto. Checks/typechecks/guards/builds/CI/AM/UI live estão **NOT_RUN nesta missão**. A identidade do candidato a implementar será fixada por 71/S0; o último delta de impacto lido chegou a C35 em e87e22d163924635bf0b41785c9bc80bf780ac0a; seams fundamentais foram relidos em C31. Ver LATE-DRIFT.md. Fontes PASS não viram prova do candidato composto. Nenhum target novo é aceito sem geração e frescor dos dois clients, composição real, matriz de papéis e gate dos owners.
