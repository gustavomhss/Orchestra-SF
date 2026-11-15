# Mission49: explicit HTTPS installation integration

These are inert, complete integration artifacts for integration47, the sole writer of the shared source files. Mission49 does not apply them to `sf2-stack` or modify its existing composition. The producer implementation lives in the authorized `runtime/microsoft-*` files and reuses the existing Entra client and identity engine.

## Exact source and reconciliation

`mission49-installation-manifest.json` pins every complete preimage and postimage, the target paths, Git blob IDs and SHA-256 digests, plus the individual and combined patches. The preimages are from `217b4295e2aeb00bc2f4accb9fb893451b9795e9`. GitHub MCP reads confirmed that all three target blobs are unchanged at integration47 target `ee1a3ea147ab7d7f4f6b231217e623456e294c84`, tree `8563e04f8751ed786ccdbc086ed6566c410af3fe`.

Before adoption, integration47 must compare the current target blobs to the manifest. A mismatch requires reconciliation with the complete preimage/postimage; it does not authorize overwriting intervening work. The three changes form one composition and must be adopted together with the mission49 runtime files. `mission49-installation.patch` contains the complete combined diff; each target also has its own patch.

## Real routing path

The existing `orchestra serve --installation` loader continues to load the selected trusted factory. The default Sucafina factory selects `SUCAFINA_MICROSOFT_CONFIG` only when explicitly present; otherwise it retains `SUCAFINA_LOCAL_CONFIG` and the original loopback-only configuration loader. Microsoft configuration and isolation are checked before opening the product database. The serve patch also moves installation loading before daemon/password lookup and the explicit legacy-session database import in `serveForever`. It preserves the first shutdown finalizer so installation disposal still completes before process exit. The existing `Runtime.handler` only returns the supplied effect; its handler environment explicitly excludes the local database because opening it applies migrations.

The exported `createMicrosoftInstallation(context, file, environment?, overrides?)` prepares the Microsoft identity and calls the same exported `createConfiguredInstallation(context, loaded, microsoft?)` as the local factory. Only the controlled hosted fixtures supply `fetch` and `now` overrides. Production uses the normal Entra endpoints and server-private credential reader. The product composition, source persistence, product runtime, BI, procurement and workbench routes remain the existing ones.

The cloud composition selects `business-microsoft`, supplies the validated separate `workspaceDirectory` to the host runtime, and passes only the explicit product grants. `sourceRoot` and the product capability registry remain unchanged. Cloud unsafe methods require the exact public `Origin` and reject cross-site requests; the local operator retains its original POST fence and local identity.

`loadSfInstallation` calls the same exported `composeSfInstallation(value, listenerOrigin)` used by the hosted fixtures. Its explicit transport contains separate canonical listener, ingress and public origins. The listener must match the factory context exactly. Each incoming raw Host and URL origin must match the configured ingress. All `Forwarded` and `X-Forwarded-*` headers are removed before the pinned Effect adapter converts a Node request to a Web Request. The actual mission49 `microsoftRequest` helper repeats the origin fence and builds the request using the pinned HTTPS public origin. No proxy header selects the tenant, identity or redirect origin.

The route converts failures and unexpected defects into a fixed empty 503 response, so the HTTP framework does not report the original adapter/canonicalization cause with its request URL. The listener remains a private HTTP ingress behind the Azure TLS proxy. Its network exposure must be restricted to that trusted ingress by the provisioning owner; a client-supplied Host alone is not a trust boundary. Provisioning is outside mission49.

## HTTP trace privacy

The pinned Effect `4.0.0-beta.83` HTTP tracer starts before route middleware and records full URL/query fields. Disabling the HTTP logger does not disable that tracer. The loader therefore returns a `privacy` layer which disables HTTP tracing for the explicit cloud listener, including malformed callback paths and responses. The serve patch supplies that layer before starting `HttpRouter.serve`. This scope intentionally covers the listener rather than relying on pathname matching after request tracing has started.

For an in-memory handler, merge `installation.privacy` into the application layer passed to `HttpRouter.toWebHandler`; providing it only to the route registration layer discards the service before request handling. The production serve patch provides it to the complete serving layer. The HTTP logger is already disabled by the existing serve path. Azure ingress and upstream diagnostics must independently omit query strings, cookies and authorization headers; mission49 does not change those external services.

Dependency evidence was read through GitHub MCP from the pinned official Effect source:

- `packages/effect/src/unstable/http/HttpServerRequest.ts`: `toURL` derives protocol from `x-forwarded-proto`, so sanitizing only after `toWeb` is too late for the Node adapter.
- `packages/effect/src/unstable/http/HttpEffect.ts`: `toHandled` wraps middleware with the tracer, and `toWebHandlerLayerWith` captures the built application context.
- `packages/effect/src/unstable/http/HttpMiddleware.ts`: `TracerDisabledWhen` is checked before span creation; the tracer records URL/query and headers.

The source tag is `effect@4.0.0-beta.83` in `Effect-TS/effect-smol`. The repository's existing Effect patch does not modify those files.

## Hosted verification of the actual postimages

Mission49's hosted tests verify both pinned image hashes and compare the current canonical file to those complete images. When the canonical file still equals the preimage, the fixture writes the complete postimage unchanged to a temporary sibling `.ts` file, imports it and removes it after the suite. Relative imports resolve exactly as they will after integration47 applies the patch. When the canonical file already equals the postimage, the fixture imports that installed canonical file directly. Any other source drift fails verification. The tests therefore cover both the producer branch and integration47's exact installed composition without recreating its logic in test code or applying a shared patch themselves.

For the request privacy check, a `Tracer.make` implementation can capture `new Tracer.NativeSpan(options)` via `Layer.succeed(Tracer.Tracer)`. A control handler without the privacy layer must produce a span; the configured handler must produce no HTTP span for login, callback, invalid callback, logout or malicious proxy-header requests. Fixtures contain only controlled synthetic authorization codes, keys and tokens.

The hosted Node fixture uses an ephemeral loopback listener and the actual Node adapter with forged forwarded-protocol headers, so it covers the pre-`toWeb` sanitization that a Web Request fixture cannot exercise. A separate preflight case imports the exact serve postimage and invokes it without daemon or database services: the real Microsoft configuration reader must fail with its fixed missing-configuration error before either service is required.

No product tests, typechecks or heavy checks were run locally while producing these artifacts. Actual GitHub Actions results belong to the mission49 terminal receipt. Real Microsoft login and B2B tenant validation remain **not executed** until the provisioning session validates them.
