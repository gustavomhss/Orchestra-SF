# Cold review adversarial — arquitetura, contratos e autorização

Reviewer: cold_arch. Planejamento examinado: PR76 / `sf-sidebar-plan`, SHA `2f143330a0a44d34eb764ebfb851804c504edb6d`. Código de integração examinado por GitHub MCP: `faa30fddb7e7b61696b66fd069f51cf18c51125f`. Os arquivos locais são cópias de leitura. Não houve implementação de produto, startup, teste de runtime, CI, deploy ou mudança externa por este reviewer.

**Veredito do plano recebido: não estava pronto para dispatch de execução.** Havia uma incompatibilidade concreta com o desktop, um ciclo de discovery, contratos ainda delegados ao futuro integrador e caminhos de montagem/primeiro login que falhariam. As correções propostas foram fechadas em `execution/CONTRACTS.md` e `execution/contract-catalog.json`; isso fecha decisões de desenho, não comprova funcionamento em produção.

## Achados

### AR-01 — Crítico: a topologia documentada não atende o desktop nativo

**Local:** API-AND-ISOLATION.md original §§1/6, linhas19–23 e106–112; NATIVE-ARCHITECTURE.md transporte/contexto.

**Evidência direta:** [`renderer-origin.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/faa30fddb7e7b61696b66fd069f51cf18c51125f/apps/desktop/src/main/renderer-origin.ts) fixa `oc://renderer`; [`windows.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/faa30fddb7e7b61696b66fd069f51cf18c51125f/apps/desktop/src/main/windows.ts), linha443, carrega esse protocolo. [`renderer/index.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/faa30fddb7e7b61696b66fd069f51cf18c51125f/apps/desktop/src/renderer/index.tsx), linhas284–286, implementa Platform.fetch apenas com fetch do renderer. O cookie SF tem Path=mount, HttpOnly e SameSite=Lax; os handlers POST comparam Origin ao origin da instalação. O preload lido não tem broker de sessão SF.

**Causalidade:** exigir shell/instalação no mesmo HTTPS origin exclui o renderer empacotado; selecionar servidor no shell não transforma oc://renderer em HTTPS nem transfere o cookie de um browser externo. O piloto poderia passar no browser e falhar no produto principal.

**Correção decidida:** D01 novo broker main-only por operação, Session isolada em memória por binding, `net.request` com session/credentials/origin documentados, auth BrowserWindow sem preload na mesma partition, allowlist de sender principal e URL, cancel/generation/logout e download mechanism real. Microsoft não ganha proxy/token novo. Local-operator reaproveita enrollment original pelo canal Dock autenticado já existente, sem stdout/renderer/cookie import.

**Fechamento verificável:** CONTRACTS §4; D01/F04 exigem prova no aplicativo instalado oc://renderer, tenant/B2B real configurado, SameSite/Origin intactos, cross-owner e rejeição de subframe/auth-window. **Design fechado; prova de runtime futura.**

### AR-02 — Alto: mount da nova API pode ficar atrás de um 404 irrevogável

**Local:** API-AND-ISOLATION.md original §§2/5; tabela de montagem sem posição concreta no dispatcher.

**Evidência direta:** [`runtime/application.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/faa30fddb7e7b61696b66fd069f51cf18c51125f/modules/sucafina/Sucafinav1/runtime/application.ts), linhas54–59, restringe pathname a dashboard/planner/procurement. Só na linha68 chama `application.product`. [`host-context.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/faa30fddb7e7b61696b66fd069f51cf18c51125f/apps/cli/src/sucafina-product/host-context.ts), linha839, compõe productHttp sob esse caminho legado.

**Causalidade:** acrescentar `<mount>/api/native/...` nessa cadeia, embora pareça o lugar natural do adapter, nunca alcança o handler.

**Correção decidida:** novo native router diretamente em `local/entry.ts`, após ingress/identity.prepare/bootstrap e antes de business(). Rotas JSON existentes continuam em seus paths originais. I00 aplica o shared patch; F02 fornece função fechada.

**Fechamento verificável:** request real para /api/ui/context e cada projeção chega ao handler; path desconhecido não cai em outra superfície; nenhum rewrite synthetic Request. CONTRACTS §§2.2/3.4/6.

### AR-03 — Alto: primeiro login nativo pode produzir contexto vazio

**Local:** API-AND-ISOLATION.md original §§3/5/6; PLANNING-BRIEF fluxo inicial.

**Evidência direta:** [`local/entry.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/faa30fddb7e7b61696b66fd069f51cf18c51125f/modules/sucafina/Sucafinav1/local/entry.ts), linhas233–237, chama `bootstrapLocalSurface` somente nas três páginas legadas. [`local-bootstrap.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/faa30fddb7e7b61696b66fd069f51cf18c51125f/modules/sucafina/Sucafinav1/runtime/local-bootstrap.ts) exige principal real/membership admin e só grava quando `roleMap === undefined`.

**Causalidade:** o novo entrypoint /context não passa por esses path guards. Mesmo um admin legítimo de instalação nova pode autenticar e não obter destinos; uma “correção” ingênua que preenche todo roleMap vazio restauraria revogações intencionais.

**Correção decidida:** chamar helper original nas três superfícies antes do contexto; preservar distinção absent versus empty, Graph membership e transação originais. Nenhum bootstrap de grants no frontend.

**Fechamento verificável:** perfis fresh-map/empty-map/revoked/non-admin/Graph unavailable distintos. CONTRACTS §2.2.

### AR-04 — Alto: discovery do mount depende do próprio endpoint ainda desconhecido

**Local:** API-AND-ISOLATION.md original linha11 e §§3/5; NATIVE-ARCHITECTURE owner.

**Evidência direta:** `ServerConnection` distingue http/sidecar/ssh e resolve URL/conexão, não descriptor SF. A factory CLI conhece origin/mount e `runtime.identity()` conhece projectId real. O plano dizia “configuração publicada” sem produtor/path/schema de leitura. `host-context.ts` usa ProjectV2 para resolver o projeto; não equivale ao installationId.

**Causalidade:** o client precisa de mount para consultar /context, mas atribui a /context a descoberta do próprio binding. Guess de mount, cwd ou projeto abre erro cruzado de instalação.

**Correção decidida:** único GET /api/sucafina/installations no HttpApi existente, metadata-only, Authorization + LocationMiddleware, filtro exato de projectId. Trusted factory → composeSfInstallation → CLI serve → createRoutes.Options.sucafinaInstallations → registry Server; nenhuma dependência Server→CLI. Schema obrigatório e rejeição de query extra fechados em CONTRACTS §2.1.

**Fechamento verificável:** duas instalações/projetos e nenhuma enumeração cruzada; seleção ambígua pede escolha; deep link incompatível não escolhe outra; descriptor não contém directory/principal/grants. Geração normal uma vez I00.

### AR-05 — Alto: catálogo de APIs era menu futuro, com duplicação maciça de HTTP existente

**Local:** API-AND-ISOLATION.md original linhas27–39,62–91 e139–143; DELIVERY-PLAN freeze N0/N1.

**Evidência direta:** linha89 exige que N0/N1 ainda especifiquem nomes finais e schema de cada ação. Linhas30–37 criam fragment/sub-API/client/generation novos. [`packages/client/script/build.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/faa30fddb7e7b61696b66fd069f51cf18c51125f/packages/client/script/build.ts) gera um ClientApi global. Os handlers JSON reais já incluem planner monthly, forecast, sourcing, personal views, current-choice, decision controls, portfolio, collaboration, imports, documents, reviews/BI, memory e analyses.

**Causalidade:** workers ainda escolheriam nomes/payloads/erros; integração concentraria decisões e uma segunda geração, causando retrabalho. Redesenhar PATCH/DELETE/REST também perderia o envelope, admission e Idempotency-Key existentes.

**Correção decidida:** wrappers typed por família e source-lock de input/output; reutilizar HTTP JSON/bytes. Novas projeções apenas para partes que só renderizam HTML e seams tipados estreitos de rotina/schedule já publicados como BusinessPorts. Um único endpoint global de discovery usa geração normal; nenhum alvo dedicado. As 28 páginas e ações têm operationId fechado.

**Fechamento verificável:** cada resource resolve a um registro concreto; cada registro aponta source pin/validator ou contrato NEW explícito; métodos/paths/revisões são comuns entre browser e broker; sem nova engine/aliases de types. CONTRACTS §§1/5/6 e catálogo.

### AR-06 — Alto: header obrigatório omitido impede inclusive leituras POST

**Local:** API-AND-ISOLATION.md original linhas55/64/128, sem lifecycle de correlation.

**Evidência direta:** `host-context.ts` linhas144–149: GET/HEAD recebem commandIdentity própria; todo outro método exige Idempotency-Key na regex `[A-Za-z0-9._:-]{8,128}`. `planner-http.ts`, `views-http.ts`, `forecast-http.ts`, `sourcing-input-http.ts` e `analysis-http.ts` rejeitam header ausente antes de admission. Personal views/list e vários reads collaboration/portfolio são POST.

**Causalidade:** um worker pode implementar corretamente body/schema e receber denied/invalid para todas essas ações. Repetir comando com UUID novo após timeout pode duplicar efeito, mesmo com versão/receipt parcial.

**Correção decidida:** key UUID por invocação de POST read; key estável por intenção de mutação; alteração de payload é nova intenção; timeout pós-envio outcome-unknown; sem retry automático ou falsa garantia de rollback. Preserve expectedVersion/digest/receipt do produtor.

**Fechamento verificável:** POST read sem key é rejeitado; wrapper fornece key; double-click não cria segunda intenção; response perdida exige lookup/reconciliação canônica. CONTRACTS §3.2.

### AR-07 — Alto: reusar handler com Request reescrita pode invalidar a autoridade

**Local:** API-AND-ISOLATION.md original §§4/5; nova matriz de endpoints sobre handlers com shape próprio.

**Evidência direta:** [`ui-authority.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/faa30fddb7e7b61696b66fd069f51cf18c51125f/modules/sucafina/Sucafinav1/product/integration/ui-authority.ts) armazena Request/operation/digest/commandId/expiry/consumed em WeakMap, revalida e consome uma vez. Procurement scenario verifica `host.requestFor(context) === request`. Domain.read/procurement queue usam preparação fora do lock e `current()` dentro da transação.

**Causalidade:** adaptação interna que cria Request novo para path legado perde vinculação/digest; executar facade reentrante dentro do store lock pode deadlock. Duplicar handlers também tem precedência relevante: portfolio já intercepta decision-review/prepare-changes antes de procurement decision-http, host analysis intercepta prepare/start antes do base.

**Correção decidida:** client chama o endpoint original; novas projeções recebem o Request real e chamam produtor/admission com o mesmo objeto. Preparação fora, auth/redaction/current dentro, revalidate antes serializar e finally.finish. Preservar chain host-context existente e registrar effective handler no catálogo.

**Fechamento verificável:** identidade por referência, lease one-use, after-await revoke e concorrência sem lock reentrante; nenhum Request synthetic pós-admission. CONTRACTS §3.4.

### AR-08 — Alto: lifecycle de chapter destrói rascunho no mesmo owner

**Local:** NATIVE-ARCHITECTURE e UX-DESIGN originais: cache por owner/chapter, mas nenhum ponto de montagem concreto do provider.

**Evidência direta:** [`chapter-route.tsx`](https://github.com/gustavomhss/Orchestra-SF/blob/faa30fddb7e7b61696b66fd069f51cf18c51125f/packages/app-shell/src/orchestra/chapter-route.tsx) monta providers do owner, depois ChapterBoundary keyed pelo chapter. `ServerConnection.key(sidecar)` é estável entre launches; só serverKey não captura host restart/principal/accessRevision.

**Causalidade:** provider dentro do chapter perde draft na navegação comum; remount em cada poll perde foco/edição. Cache keyed só por server pode reapresentar resposta de principal/instalação/host anterior.

**Correção decidida:** provider fora da ChapterBoundary, abaixo SDK/Models; owner tuple + authEpoch, request generation, hostId e accessRevision. Same-owner refetch não remonta; source change marca stale; revoke/logout purgam; expiry oculta e permite apenas quarentena efêmera até reautorização exata. F01 recebe transport por injection; não cria ciclo runtime com F02.

**Fechamento verificável:** navegação cross-chapter conserva draft, change owner não; late response descartada; 503 não é revoke; 401 não apresenta dado em quarentena. CONTRACTS §2.3/6.1 e COMPONENT-CONTRACTS §7.

### AR-09 — Médio: retorno opaqueRef tinha storage/lifetime/resolução indefinidos

**Local:** API-AND-ISOLATION.md original linhas108–112.

**Evidência direta:** `local-identity.ts` já guarda Login state criptografado com returnTo, nonce, verifier e expiry, mas safeReturn só aceita as três superfícies. A proposta adicionava resume opaqueRef sem definir quem o cria, retém, expira ou valida.

**Causalidade:** duas implementações de auth state ou retorno externo podem surgir; o desktop não pode finalizar login navegando a janela principal para a URL remota.

**Correção decidida:** bridge única /auth/native-return sob mount; routeId/params fechados do manifest, state criptografado existente no web e main-memory generation no desktop. Nenhum target URL arbitrário ou novo vault. Callback não chega ao renderer; /context atual confirma identidade antes de retomar.

**Fechamento verificável:** expiração/replay/target inválido/owner trocado/IDP externo bloqueados; fallback de rota autorizado explícito. CONTRACTS §4.2.

### AR-10 — Alto: estados de readiness e erro ainda podiam fabricar produto operacional

**Local:** API-AND-ISOLATION.md original linhas57/85/89/133; MIGRATION-AND-HANDOFFS Native41/Relay/Schedule.

**Evidência direta:** [`ports.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/faa30fddb7e7b61696b66fd069f51cf18c51125f/modules/sucafina/Sucafinav1/product/contracts/ports.ts) linhas92–106 publica shapes de routines e schedules. [`routine-services.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/faa30fddb7e7b61696b66fd069f51cf18c51125f/apps/cli/src/sucafina-product/routine-services.ts) implementa routines com native/publication checks; `host-context.ts` linhas297–320 instala descriptors somente onReady e declara watch sem native Schedule admission como unadvertised. `SfHostServices` expunha só discoverRuns em routineRuns, não HTTP de todas as operações. `PortResult` distingue unavailable/denied/stale/conflict/provider-conflict/failed, e handlers legados têm envelopes diferentes.

**Causalidade:** tipagem disponível não equivale a runtime instalado; ausência de HTTP também não equivale a ausência de contrato. Uma UI “ready” por lista estática ou uma lista vazia por infraestrutura indisponível mentiria sobre capacidade. Um adapter que assume um único envelope pode traduzir falha em sucesso ou permitir retry incorreto.

**Correção decidida:** novos adapters HTTP estreitos para BusinessPorts tipados, disponibilidade independente de permissão, gate operacional preservado. Schedules só chama binding de producer real quando existir; sem binding retorna motivo explícito. Residents projeta registry selecionado/autorizado, não fabrica cinco/18 entries nem usa choices limitado como catálogo completo. União/resultado HTTP existente é preservada; novos seams referenciam contratos NEW explícitos.

**Fechamento verificável:** catálogos com implementação ausente retornam unavailable, sem botão de run/create; types/shape podem ser executados pelo worker sem redesenhar produtor; readiness não encerra o gate runtime. CONTRACTS §§2.2/5.4/7 e catálogo. **Contrato fechado; Native41/Relay/Schedule ainda exigem evidência externa correspondente.**

## Decisões finais e limite do veredito

Foram entregues contratos revisados, catálogo com paths e source bindings concretos, split de ownership e necessidades explícitas de composição. Não há aprovação de runtime nem prova Microsoft/desktop nesta sessão. A aceitação deste planejamento pode autorizar a execução das fatias segundo os contratos; aceitação de capability operacional depende dos gates de instalação/autorização/producer/testes previstos. A revisão cruzada dos artefatos de outros autores é registrada separadamente em `reviews/cross-arch.md`.
