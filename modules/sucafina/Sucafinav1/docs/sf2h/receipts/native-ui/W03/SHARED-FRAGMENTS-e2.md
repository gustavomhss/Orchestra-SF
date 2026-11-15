# W03/F02 — fragmentos de integração compartilhados para 114 (e2)
 
**Autor** W03, epoch `ux-native-w03-e2`. **Não aplicado**: os arquivos abaixo pertencem exclusivamente a `114/S0-C-e17-browser114`. Leia os blobs reais do C a integrar; os preimages são de `sf2-stack` observado no handoff, não leases sobre caminhos compartilhados. O código W03 está efetivamente em `7c1a365c01d5e9cc72554f3258117a33db9f59fe`, não em apenas `proposed/*.txt`.

## I00: exports explícitos (preimages e patch delimitado)

- `packages/schema/package.json`: blob `adc53ecfa8f4ac83fee37854db2dc0ec2bb9136a`; preservar todos os exports existentes, inserir no objeto `exports` o trecho seguinte, somente após os targets verdadeiros serem publicados por F01/I00:
```diff
@@ "exports": {
+    "./sucafina/common": "./src/sucafina/common.ts",
+    "./sucafina/context": "./src/sucafina/context.ts",
+    "./sucafina/operation-registry": "./src/sucafina/operation-registry.ts",
+    "./sucafina/bindings": "./src/sucafina/index.ts",
```
  A fonte `common.ts` do W03 já existe; `context.ts` é F01, `operation-registry.ts` e `index.ts` são I00. `./sucafina/bindings` publica apenas `SfNativeOperationBindings` reais admitidos, não `Schema.Any` e não importa famílias ausentes.

- `packages/client/package.json`: blob `4cd0244e98ff18b5e65d3c2808196705095b6691`; preservar exports existentes, inserir:
```diff
@@ "exports": {
+    "./sucafina/transport": "./src/sucafina/transport.ts",
+    "./sucafina/context": "./src/sucafina/context.ts",
```
  Target transport já existe; context é F01. Não adicionar wildcard nem nova camada SDK.

## I00: tabela e bindings reais

O import de W03 `@orchestra/schema/sucafina/operation-registry` exige `SfOperationRegistry` readonly com metadata `method,pathTemplate,fixedQuery,fixedBodyDiscriminator,effect,responseMode,maxRequestBytes` idêntica às 305 entradas do catálogo `31dbec1726fd8147156b01dc545726650ffd49e1`. O transporte recebe `operations: SfOperationBindings` com codecs realmente admitidos; falta de codec -> `contract-unavailable` **antes da rede**. Metadata não transporta autorização. Não sintetizar binding global de sucesso.

O `ctx.context` é servido por `createSfContextHandler` da F01, com original `Request`, após origin/CSRF e `identity.handle`/`identity.prepare`, com bootstrap e admissão reais e revalidação antes da resposta. `mountSfNativeProjections({ mount: config.mount, context, handlers: [...] })` deve ser montado **antes** de `business(request)`, não substituí-lo; só handlers que seus autores publicaram de verdade. Compartilhado observado: `modules/sucafina/Sucafinav1/local/entry.ts`, blob `04fa7d53b8f2a4d4f7375c0f069a6ae38523e877`. Região preimage do caminho canônico:

```ts
      const surface = url.pathname.slice(config.mount.length + 1)
      if (surface === "dashboard" || surface === "planner" || surface === "procurement") {
        const person = await identity.person(request)
        if (!person && request.method === "GET") return new Response(null, { status: 303, headers: { location: `${config.mount}/auth/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`, "Cache-Control": "no-store" } })
        if (person && !operator) await bootstrapLocalSurface({ request, surface, groups: config.groups[surface], identity, store })
      }
      const response = await presentationRequest.run(request, () => business(request))
```

**Não há patch aplicável antes das dependências:** `createSfContextHandler` F01 e handlers Axx precisam passar context real, e a posição de bootstrap não pode criar um roleMap de outras superfícies. A 114 executa essa composição após materialização real (sem placeholders), preservando o Request. O contrato `ctx.installations` permanece no HttpApi existente e generated normal, sem wrapper/endpoint novo no F02.

## Pendências de segurança de produtor que NÃO podem ser deslocadas ao Client

- `modules/sucafina/Sucafinav1/runtime/application.ts` preimage `a0deff8a3b272019f472aa2f93499d1940a78370`: I00 acrescenta `nativeCommandPrecondition` **dentro da transação original**, após actor auth e antes de `Domain.execute`. O `X-SF-Native-Owner` nunca é grant; port views/monthly revalidam próprios hosts.
- Auth de browser: contrato exato da resposta e lifecycle do `POST {mount}/api/ui/return-intents` são I00. Enquanto indisponível, `createSfAuthActions.login` recusa, sem criar JSON/login URL/safeReturn alternativos.
- D01 + F04: mídia binária/chunks/download; F02 permanece `contract-unavailable` nesses modos, sem buffers ou HTML redirect.
- Desacordo documental F01: `host-signatures.ts` declara método `ctx.context(input: undefined)`, `CONTRACTS.md §6.1` descreve input explícito `{installationId,projectId,hostId}`. O transporte W03 aceita somente codec legítimo F01 e constrói o GET com a tripla **da instalação aprovada**, nunca da seleção arbitrária. A 114/W02 confirmam a assinatura publicada na composição; nenhuma fuga para input permissivo.

## Gating

Nenhum shared file foi escrito pela W03. Sem `INTEGRATED`, `QUALIFIED`, runner/CI comprovado ou release. Preimage/postimage compartilhado: **preimage observado acima, postimage não aplicado, proprietário 114**, com os trechos exatos que cabem antes da composição. Toda integração final é revisada contra o HEAD vivo da 114. `GLOBAL_RELEASE=false`.
