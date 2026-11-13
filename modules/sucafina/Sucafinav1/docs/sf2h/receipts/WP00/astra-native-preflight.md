# WP00.T04 — independent source preflight

## Disposition

**DRAFT/BLOCKED for native qualification. GNATIVE, C07, AM01–AM06, model inference and scanner execution: NOT_RUN.** This is an independent static review by `/root/native_qualification`; it is not a native S3 receipt. No product/runtime/case source was edited and no test, provider request, hosted CI, remote mutation, token lookup or login was performed by this reviewer.

The native composition is implemented in the inspected candidate. Its existence is not evidence of availability in this ChatGPT session. The candidate also contains a concrete C07 gap: the analysis composition supplies an unavailable routine port. The newer host producer still has that gap.

## Pins and observed branches

- Handoff/pack: `4e4d873e7e93bba3dc82df45e243999e7c8e76b6`.
- Plan and mandatory appendices: `dbf9547211d9b0fade619790de7c19c0869b7c7d`.
- Candidate inspected: `astra-wp00`, `7631b186e4249abd0fc24c7d10beb62355db3f3b`; tree `de2e6496db7d686e111688903099bfdc24c7563a`. Rechecked unchanged after source inspection.
- Current producer inspected: `sf2-host-ready`, `dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f`; tree `6cda6f1b3686b054f454f19a4fcd78dc2c5fd0c7`.
- Current routine producer inspected: `sf2-relay-ready`, `b58601f92f3bc8742e5a7c72a34d5ddf1fd87fe8`; tree `7e1f6f078a44250d8f4b327757c073fabb8079aa`.
- GETs for `astra-wp09`, `astra-wp10`, and `astra-wp12` returned `Branch not found` at inspection. This does not mean no producer work exists: the two `sf2-*-ready` branches above do exist.

## What actually exists in the candidate

All source links in this section are pinned to the inspected candidate, not the moving branch.

| Stage | Source evidence | What the source establishes | What remains unobserved |
| --- | --- | --- | --- |
| Installation root | [installation.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/apps/cli/src/sucafina-product/installation.ts#L16-L32), [local/entry.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/modules/sucafina/Sucafinav1/local/entry.ts#L88-L110) | Trusted installation factory receives `createSfHostRuntime`; local application passes its persistence/authenticator/environment and mounts its services. | A running installation, its authenticated request and configured model are not exposed to this session. |
| Host identity/model | [host-context.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/apps/cli/src/sucafina-product/host-context.ts#L507-L546) | Resolves ProjectV2, installs Location-scoped services and queries `Catalog.model.available()`. Model and MCP metadata change provider generation. Credentials remain opaque. | No actual project/session/principal/model observation; no inference receipt. |
| Current business authority | [product-authority.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/modules/sucafina/Sucafinav1/product/integration/product-authority.ts#L60-L91), [native admission](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/modules/sucafina/Sucafinav1/product/integration/product-authority.ts#L134-L181) | Reauthenticates the true Request against current snapshots; intersects explicit grants/roles; rejects `local:` identities; compares persisted case incarnation/version, native run, Session placement/model and observed skill receipt. | Authorized and revoked paths must be exercised on the actual installation; a literal actor or engineering identity cannot stand in. |
| Resident registration | [resident-agents.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/modules/sucafina/Sucafinav1/product/host-binding/resident-agents.ts#L30-L74) | Registers reserved skill source, native `orchestra` engine, explicit profile/skill operations and deny-all baseline. | This reviewer did not register or execute profiles. |
| Actual skill receipt producer | [skill-loader.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/modules/sucafina/Sucafinav1/product/host-binding/skill-loader.ts#L9-L85) | Checks physical source containment, byte/instruction hashes and a uniquely observed `SessionV2.skill` message before returning `SkillLoadReceipt`. | No observed Session message or receipt in this session. |
| Session preparation/inference | [native-host.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/apps/cli/src/sucafina-product/native-host.ts#L107-L197), [execution](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/apps/cli/src/sucafina-product/native-host.ts#L211-L245) | Queries actual catalog; rejects namesake MCP; reserves and creates SessionV2; loads/narrows skill/tools; attaches current binding and budget ticket. Execute admits with `resume:false`, then resumes that Session. Read and cancellation revalidate authority. | No real provider turn, durable run result or revocation exercise was observed. |
| Private MCP | [contribution.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/apps/cli/src/sucafina-product/contribution.ts#L21-L57), [sf-mcp-bridge.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/modules/sucafina/Sucafinav1/product/host-binding/sf-mcp-bridge.ts#L12-L143) | Uses Tools/Tool.Context, SDK Client/Server/InMemoryTransport, private lease, `listTools`/`callTool`, current configuration and authority checks, digest/receipt parity, transport closure. | Source presence and synthetic SDK tests are not model-driven MCP qualification. |
| C16 binding/intersection | [execution-context.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/modules/sucafina/Sucafinav1/product/host-binding/execution-context.ts#L28-L108) | Admission checks receipt against selected manifest; lease requires Session/agent/message/call identity and operation intersection; `routine-result` denies prepare/run; consumed call identities prevent reuse. | Live direct denial, parallel principals, expiry/revocation and result isolation remain NOT_RUN. |
| Canonical forecast domain | [planner/capabilities.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/modules/sucafina/Sucafinav1/product/planner/capabilities.ts#L11-L22), [analysis-verifier.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/apps/cli/src/sucafina-product/analysis-verifier.ts#L15-L43) | `sf_forecast_compare` calls real `PlannerPort.compareForecast` and binds input/output receipts; analysis verifier replays the same domain output against the current C09 case and source refs. | No real C09/provider/consumer-chain execution was observed. |
| Scanner | [atlas-scanner.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/modules/sucafina/Sucafinav1/product/host-binding/atlas-scanner.ts#L8-L32) | Calls actual canonical detector and AppProcess `--version`; scan distinguishes unavailable from hit. | No binary was probed here; version/path/digest/clean/canary evidence remains unobserved. |

## Concrete blockers and owner actions

### NATIVE-01 — this execution surface has no SF native authority

The available-tool registry was inspected, including deferred tool names and descriptions. It contained 326 tool metadata entries and no Orchestra/SF Session, Maestro/Relay admission, native model catalog, scanner or `sf_*` callable method. This chat's own model and collaboration agents are not Orchestra native Sessions and cannot manufacture `SkillLoadReceipt` or the real Request required by C16.

The authorized remote channel is GitHub MCP. No installed SF host URL, true installation Request, native Session ID or available model observation was supplied by that channel. Generic remote-process tools would not be a substitute for the handoff's authorized native seam. No attempts were made to read credentials or manufacture an installation identity.

The existing `test-ci.yml` is a code-test runner triggered by push on `ci-run-*` (lines 1–14). Its request environment allow-list contains only the Omni experimental flag and production channel (lines 146–165). The inspected workflow has no provider credential injection or installed SF authority selection. A successful run there can qualify deterministic code and SDK behavior, not prove a configured native provider exists.

**Next action:** WP10/S0 exposes or runs the existing authenticated installation composition at the exact candidate SHA; an independent qualifier records its actual profile/skill/model/case/MCP/domain/output chain. Do not add a new account, credentials, mock provider or substitute Session.

### C07-01 — candidate analysis composition uses unavailable routine operations

At the inspected candidate, [host-context.ts lines 354–362](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/apps/cli/src/sucafina-product/host-context.ts#L354-L362) constructs the `routines` port with `catalog`, `prepareAdmission`, `readAdmission`, `readRun` and `run` all pointing to `analysis-operation-unavailable`. `product/routines/` is absent in the candidate directory listing, while `product/contracts/host-context.ts:14` imports its factory type. No execution through this supplied routine port can prove governed C07 admission.

The newer [host producer at dc6bf9e…](https://github.com/gustavomhss/Orchestra-SF/blob/dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f/apps/cli/src/sucafina-product/host-context.ts#L407-L415) still supplies the unavailable routine port. The [routine producer at b58601f…](https://github.com/gustavomhss/Orchestra-SF/blob/b58601f92f3bc8742e5a7c72a34d5ddf1fd87fe8/modules/sucafina/Sucafinav1/product/routines/factory.ts#L8-L22) has a real composition factory, but it explicitly takes `Omit<BusinessPorts['routines'], 'catalog'>` from the host. That factory does not establish the missing native admission/run provider.

**Next action:** WP09 supplies supported governed routine producer/result read contracts, and WP10/S0 composes them with current SF Request authority, admission, occurrence/run idempotency and revocation. WP00 records the seam; it must not import private Maestro internals or edit excluded engines. This is a verified candidate-composition gap, not a claim that no possible governed API exists anywhere in Orchestra.

### SCANNER-01 — no observed pinned binary; path pinning is incomplete in the inspected helper

`probeSfAtlasScanner` returns `{ spec, version }`; it does not resolve an absolute executable path or record the executable digest. The canonical [KNOWN_SCANNERS](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/modules/atlas/packages/adapter-io/src/scanner.ts#L81-L95) uses `command: 'gitleaks'` / `'trufflehog'`. [detectAvailableScanner](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/modules/atlas/packages/adapter-io/src/scanner.ts#L137-L145) returns that original spec after PATH detection. `--version` is implemented, but a source-level intention to probe is not an observed binary/path/version receipt. This review does not assert the installed machine lacks gitleaks; it has not inspected that machine.

**Next action:** WP10.T07 pins the real permitted build/runtime binary path and version, records clean/canary/could-not-run cases with elapsed cost, and retains C17 writes at HOLD until that evidence exists. No scanner engine/allowlist changes by WP00.

### Forecast coverage qualification limit

`business-services.ts:136–138` supplies an unavailable original-forecast coverage resolver. `planner/port.ts:67–107` deliberately preserves known numerical deltas but labels the result `conditioned`, with `completeDifference:null` and `cost-coverage-unavailable`. This is not evidence that compareForecast cannot run; it is evidence that a future native proof must preserve that limitation rather than silently claim fully covered costs.

## Meaningful surgical CI candidates

The following already exist in the candidate and can strengthen the deterministic test request without any local product test:

- `Sucafinav1/test/product/wp10/resident-runtime/execution-context.test.ts`: binding identity, mutation, scope and one-use behavior. Runtime assertions depend on its actual hosted result.
- `Sucafinav1/test/product/wp10/resident-runtime/private-mcp.test.ts`: real SDK transport and normalized provider collision. It uses a literal synthetic receipt and a handler returning `{ fixture: 'synthetic' }` (lines 19–45), so label it **deterministic SDK/authority test**, never GNATIVE.
- `Sucafinav1/test/product/wp10/resident-runtime/resident-agents.test.ts`: source registration and grants.
- `Sucafinav1/test/product/wp10/resident-runtime/capability-dispatch.test.ts`: authority and receipt dispatch contracts.
- `Sucafinav1/test/product/wp10/native-host/native-host.test.ts`: missing-budget refusal without creating a Session. It does not exercise a configured provider.

Whether to include a test depends on the root's actual changed contracts and complete dependency availability. No test listed here was executed by this reviewer. Broad consumer changes outside WP00 must stay with their owners.

## Qualification receipt that is still required

The independent native receipt must record exact product SHA/tree and installed runtime/SDK versions; installation/project/location/principal authority provenance; persisted C09 case ID/version/incarnation; actual `sf_finance` profile version/digest; actual `sf-explicar-forecast` file and parsed instruction digests; observed loaded Session message; actual available and executed model; native run/session IDs; private bridge object/lease/call identities; `listTools` and `callTool` observation; real `compareForecast` handler/export and domain-result digest; same authority/source versions used by UI; persisted contribution and consumer reopen/reload; authorized positive path; missing-context/no-skill/non-granted/namesake/revoked negative paths; scanner binary/path/version and actual verdicts. Missing fields or a synthetic final domain callback leave the relevant gate open.

No historical T+20 timing was reconstructed. Original windows are planning reservations, not observed latencies. During this review the live roster listed root plus exactly three children (contracts, baseline, this native reviewer), but this does not prove the historical S0/S3 lease schedule. A new WP00 qualification receipt should state current elapsed measurements explicitly.

## Criterion review map

The companion `native-criterion-review.json` covers all 26 criteria owned by WP00.T04. `STATIC_EVIDENCE` indicates source/process observation only. `NOT_RUN` and `BLOCKED` do not become PASS because a code test is green. WP00.T02's deterministic contract work remains independent of this blocked native gate.
