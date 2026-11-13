# WP05 — independent dependency ledger

Observation: 2026-11-13. All remote reads used GitHub MCP. No owner branch was merged, no foreign product path was edited, and no local product test or typecheck was run by the reviewer. Pins below describe observed immutable sources; they do not assert that those revisions have been integrated into the proposed WP05 HEAD.

Planning pin: `dbf9547211d9b0fade619790de7c19c0869b7c7d`. WP05 seed: `b33541ede0fd715fc0990aebeb3fe484d0991cb7`. Observed sf2-stack: `6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0`.

## Owner snapshots

| Owner | Observed branch | Commit | Kind |
|---|---|---|---|
| WP04 | astra-wp04 | `d183840f71eaa07244d984f314facfb76ef25799` | current-owner-branch |
| WP02 | astra-wp02 | `38d340a8857b96904f7246320091c14c051f1929` | current-owner-branch |
| WP00 | astra-wp00 | `72342f0efbbe099231aa2e30a964769b14e4fbb2` | current-owner-branch |
| WP03 | astra-wp03 | `9fc1a2aeae4f69ae832f52c8205497c39ab135d6` | current-owner-branch |
| WP10 | sf2-host-ready | `dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f` | preserved-owner-snapshot |
| WP11 | sf2-decisions-ready | `ba2822bb06a8ad741ecbcf0d47654d1a86a3a95b` | preserved-owner-snapshot |
| WP13 | sf2-portfolio-ready | `27375325788fa571d39137728ec7f0666e89f22c` | preserved-owner-snapshot |

`astra-wp10`, `astra-wp11` and `astra-wp13` returned 404 at observation. The three sf2-*-ready branches above are preserved owner snapshots, not current astra branch heads and not permission to merge a whole branch.

## Exact files

All paths below are relative to `modules/sucafina/Sucafinav1/`. The linked source includes the immutable commit and complete repository path.

| Owner | Path at owner pin | Owner blob | Seed relation |
|---|---|---|---|
| WP04 | [product/procurement/port.ts](https://github.com/gustavomhss/Orchestra-SF/blob/d183840f71eaa07244d984f314facfb76ef25799/modules/sucafina/Sucafinav1/product/procurement/port.ts) | `d71fe619dc24ac3a0aad41d1ff7a0529e3690ee6` | different blob |
| WP02 | [product/dashboard/bi-metadata.ts](https://github.com/gustavomhss/Orchestra-SF/blob/38d340a8857b96904f7246320091c14c051f1929/modules/sucafina/Sucafinav1/product/dashboard/bi-metadata.ts) | `da697797e33a54f8d7c3c3ecc0d7f16d516c68c3` | same blob |
| WP00 | [product/contracts/context.ts](https://github.com/gustavomhss/Orchestra-SF/blob/72342f0efbbe099231aa2e30a964769b14e4fbb2/modules/sucafina/Sucafinav1/product/contracts/context.ts) | `ae2d6b73a24970ba23d21e17694b54fd32d1a700` | different blob |
| WP03 | [product/planner/port.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9fc1a2aeae4f69ae832f52c8205497c39ab135d6/modules/sucafina/Sucafinav1/product/planner/port.ts) | `dba62042653bd061fa099e2956cae4d11a0475ce` | different blob |
| WP02 | [product/dashboard/port.ts](https://github.com/gustavomhss/Orchestra-SF/blob/38d340a8857b96904f7246320091c14c051f1929/modules/sucafina/Sucafinav1/product/dashboard/port.ts) | `8891796fd24af859e06b13b50a9d10d600278ab0` | different blob |
| WP00 | [product/contracts/output-schemas.ts](https://github.com/gustavomhss/Orchestra-SF/blob/72342f0efbbe099231aa2e30a964769b14e4fbb2/modules/sucafina/Sucafinav1/product/contracts/output-schemas.ts) | `0d9fc51d26a0ca726d32e74605b555f871d99af6` | different blob |
| WP04 | [product/procurement/sources.ts](https://github.com/gustavomhss/Orchestra-SF/blob/d183840f71eaa07244d984f314facfb76ef25799/modules/sucafina/Sucafinav1/product/procurement/sources.ts) | `f620215786d5cb57d48a378ddef4228755045619` | different blob |
| WP03 | [product/planner/bi-difference.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9fc1a2aeae4f69ae832f52c8205497c39ab135d6/modules/sucafina/Sucafinav1/product/planner/bi-difference.ts) | `86ef1b9781ee46bc8cb30eeabc66870332094e7d` | different blob |
| WP00 | [product/contracts/state.ts](https://github.com/gustavomhss/Orchestra-SF/blob/72342f0efbbe099231aa2e30a964769b14e4fbb2/modules/sucafina/Sucafinav1/product/contracts/state.ts) | `755639b2a16265fe164ba2e6343738c1362d168c` | different blob |
| WP10 | [product/host-binding/state-provider.ts](https://github.com/gustavomhss/Orchestra-SF/blob/dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f/modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts) | `e899bc20f0e4661851a1a6ab9fc3bd31774b0622` | different blob |
| WP10 | [product/host-binding/business-context.ts](https://github.com/gustavomhss/Orchestra-SF/blob/dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f/modules/sucafina/Sucafinav1/product/host-binding/business-context.ts) | `bf1b8a62acefd0256211daf2736e10951e589d89` | different blob |
| WP10 | [product/host-binding/sf-mcp-bridge.ts](https://github.com/gustavomhss/Orchestra-SF/blob/dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f/modules/sucafina/Sucafinav1/product/host-binding/sf-mcp-bridge.ts) | `13a744dd479679240b47adbc431b74cff60d5d4d` | different blob |
| WP10 | [product/integration/bi-http.ts](https://github.com/gustavomhss/Orchestra-SF/blob/dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f/modules/sucafina/Sucafinav1/product/integration/bi-http.ts) | `bccdc1afdedd5ba6d8e5a8ab3c08d79ffde6092a` | same blob |
| WP11 | [product/decisions/coverage-interval.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ba2822bb06a8ad741ecbcf0d47654d1a86a3a95b/modules/sucafina/Sucafinav1/product/decisions/coverage-interval.ts) | `0747e3b98971a2e32fac9e3f892cc7d74f056e16` | absent in seed tree |
| WP11 | [product/decisions/coverage-interval-store.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ba2822bb06a8ad741ecbcf0d47654d1a86a3a95b/modules/sucafina/Sucafinav1/product/decisions/coverage-interval-store.ts) | `38fe7b91cfbad1d0f986c2252e68fed32446a2fd` | absent in seed tree |
| WP11 | [product/decisions/result-store.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ba2822bb06a8ad741ecbcf0d47654d1a86a3a95b/modules/sucafina/Sucafinav1/product/decisions/result-store.ts) | `0d2977360afb7b9af6d39b19eff6e9198c7c1c55` | different blob |
| WP13 | [product/portfolio/planner-sensitivity.ts](https://github.com/gustavomhss/Orchestra-SF/blob/27375325788fa571d39137728ec7f0666e89f22c/modules/sucafina/Sucafinav1/product/portfolio/planner-sensitivity.ts) | `e6313ad315f5235a87442c7094ff47f2c74ca6c3` | different blob |
| WP13 | [product/portfolio/sensitivity-store.ts](https://github.com/gustavomhss/Orchestra-SF/blob/27375325788fa571d39137728ec7f0666e89f22c/modules/sucafina/Sucafinav1/product/portfolio/sensitivity-store.ts) | `3d7d19b1de537638d0b1f9918c27c3712e2f534d` | same blob |
| WP13 | [test/product/wp13/sensitivity-fixture.ts](https://github.com/gustavomhss/Orchestra-SF/blob/27375325788fa571d39137728ec7f0666e89f22c/modules/sucafina/Sucafinav1/test/product/wp13/sensitivity-fixture.ts) | `b86eae347ac509e5e10bd859a6d3e8682916b36b` | absent in seed tree |
| WP02 | [product/dashboard/scope.ts](https://github.com/gustavomhss/Orchestra-SF/blob/38d340a8857b96904f7246320091c14c051f1929/modules/sucafina/Sucafinav1/product/dashboard/scope.ts) | `f53d0509b6f727947ec9b00888bce9dae1420094` | different blob; confirmed by root via GitHub MCP |

Seed blob hashes and the complete metadata are in `external-dependencies.json`; the independently retrieved metadata is also retained in `pinned-primary-files.json` and `pinned-preserved-files.json`.

## Required outside-owner work and criterion IDs

### EXT-CONTRACTS — WP00, S0

Status: **OWNER_DELTA_AVAILABLE_NOT_INTEGRATED**. Kind: `package-verification-gate`.

Seed contracts omit imported BI presentation types and SfBiArtifact; seed output schema does not admit sensitivityResultRef. Owner pin now supplies them. Canonical typecheck/runtime-schema proof on WP05 HEAD remains dependent on owner integration. No typecheck was run by reviewer.

Direct criterion dependencies: `WP05.QLT.10`, `WP05.T04.QLT.18`, `WP05.DOD.10`.

A package-wide gate; do not mark all 108 behavioral criteria failed or proved from this single issue. Exact numerical/UI invariants still need their own evidence.

Owner action: Owner/S0 integrates minimal compatible shared contract/schema delta, then CI runs canonical typecheck and operation-output positive/negative tests.

### EXT-HOST-CATALOG — WP10

Status: **BLOCKED_EXTERNAL_CONSUMER**. Kind: `real-consumer-composition`.

The pinned shared bi-http entrypoint is identical to the WP05 seed: Dashboard-only composition and BI01/BI07/BI08 description. Exporting the new WP05 factory/consumer does not register BI02-06/09-11 or bind canonical source/result stores.

Direct criterion dependencies: `WP05.DOD.03`, `WP05.DOD.04`, `WP05.DOD.10`, `WP05.CMP.03`, `WP05.CMP.04`, `WP05.SUC.03`, `WP05.SUC.10`, `WP05.T04.DOD.01`, `WP05.T04.CMP.02`, `WP05.T04.SUC.02`, `WP05.T04.CHK.05`, `WP05.T04.CHK.06`, `WP05.T05.DOD.01`.

Component or engine-adapter proof is partial for these composite criteria. No integrated classification until all required producers are reached through the shared host.

Owner action: WP10 registers all exact source adapters, preserves authorized producer selection, and records per-view actual producer/case plus consumer check against the same commit.

### EXT-EXACT-DETAIL — WP10

Status: **BLOCKED_EXTERNAL_CONSUMER**. Kind: `exact-destination-and-return`.

Pinned bi-source accepts only sf and selectionRef and returns a Dashboard overview URL; it does not consume valueId/C17/version/context. The new readBiDestination seam is not registered there.

Direct criterion dependencies: `WP05.INV.01`, `WP05.CMP.02`, `WP05.SUC.01`, `WP05.SUC.20`, `WP05.T01.CHK.05`, `WP05.T01.SUC.02`, `WP05.T02.CMP.02`, `WP05.T02.CHK.05`, `WP05.T02.SUC.01`, `WP05.T03.DOD.01`, `WP05.T03.CMP.02`, `WP05.T03.CHK.05`, `WP05.T03.SUC.01`, `WP05.T04.QLT.02`, `WP05.T04.CHK.04`, `WP05.T05.SUC.01`, `WP05.T05.SUC.20`.

Local callback identity/focus tests remain useful but do not prove the real detail consumer. The period-brush integration bug found in WP05 is independently repairable in WP05, not excused by this host blocker.

Owner action: WP10 exposes exact mark re-read/C17 resolution, retains display selection and case, returns to the original focus, and verifies eight real chart-to-detail journeys including restricted context.

### EXT-NATIVE-RESIDENT — WP10

Status: **BLOCKED_EXTERNAL_RUNTIME_PROOF**. Kind: `native-runtime-and-durable-consumer`.

A UI lease test uses actual UI authority/dispatcher, but injected producer/business callbacks and about:blank rendering do not execute native/MCP provider-bound runtime. The preserved host supports bi-artifacts storage but supplies no observed final ContextualBI choice/artifact consumer/reload witness here.

Direct criterion dependencies: `WP05.DOD.10`, `WP05.CMP.10`, `WP05.SUC.10`, `WP05.T04.DOD.18`, `WP05.T04.QLT.18`, `WP05.T04.CMP.18`, `WP05.T04.SUC.18`, `WP05.T04.CHK.18`.

The descriptor, closed schema, direct-call refusal and UI lease can be proved locally. The full criterion still requires production native authority, same base/result/version, revocation/generation negatives and actual resident consumption.

Owner action: WP10 runs UI/native/MCP against the same handler and source binding, produces attributable receipts, rejects direct/ungranted/revoked/provider-swap calls, persists and reopens human-approved artifacts through real readers.

### EXT-UNDATED-PRODUCER — WP02, S0

Status: **OWNER_DELTA_AVAILABLE_NOT_INTEGRATED**. Kind: `missing-origin-record`.

WP02 current dashboard/scope.ts and dashboard/port.ts together retain the undated record/current status and project its absent date; seed scope and port both discard an item without a string date. A WP05 renderer can list injected undated items but cannot recover a source item discarded upstream.

Direct criterion dependencies: `WP05.T04.CMP.01`, `WP05.T04.CHK.03`.

Related criteria whose local invariant may still be provable: `WP05.T04.DOD.01`, `WP05.T04.INV.02`, `WP05.T04.QLT.01`, `WP05.T04.SUC.01`.

Hard dependency applies to the real-producer undated witness, not to the renderer invariant itself. Do not mark the no-artificial-date invariant failed solely because upstream omits the record.

Owner action: Integrate both WP02 scope.ts and port.ts producer deltas and run actual planned/completed/undated producer-to-renderer evidence.

## Initial acceptance state

`traceability-initial.json` contains every one of the 108 canonical criterion IDs and exact requirement text. It assigns 39 `BLOCKED_EXTERNAL`, 69 `NOT_EVALUATED`, zero `PASS`, and `NOT_ACCEPTED` to all rows. `BLOCKED_EXTERNAL` means a required proof still depends on owner integration or a real consumer; it does not erase valid future component evidence. Tests merely prepared are not accepted, and the published-head CI result must populate execution evidence explicitly.

The 55,000 boundary, omitted training, 40,000 update, missing/zero/signs and temporal semantics are not blanket external blockers. WP05-owned tests can invoke actual available engines. They must distinguish engine proof, adapter proof and installed-host proof. A missing WP13 test fixture can be replaced by a WP05-owned fixture that invokes the real engine; a literal numeric object cannot substitute for it.

## WP10 minimal bi-http patch

`wp10-bi-http.patch` is a 48-line proposed patch against the exact seed `product/integration/bi-http.ts`, blob `bccdc1afdedd5ba6d8e5a8ab3c08d79ffde6092a`. The preserved WP10 file at `dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f` has the same blob, so the textual change targets the same baseline. The patch was generated from the exact original file. `git apply --check` against the unchanged seed file succeeded (exit 0); the patch was not applied to a foreign product file, compiled or executed.

The patch replaces only the duplicated `dispatchSfCapability` + `readBiPresentation` + projection comparison block with `dispatchBiPresentation(payload, next.value, source, authority)`. It removes the now-unused decoder/dispatcher/descriptor imports and descriptor variable, retains the final UI revalidation and both `ui.finish(...)` finally blocks, and returns the same successful HTTP fields: `request`, `projection`, `presentation`, `receipt`. Dashboard source issuance, bootstrap admission, route validation, method/origin checks, CSP and the existing bi-source route remain as in the seed.

Failure responses are the new consumer PortResult (`status`/`reason`) with the existing denied→403, otherwise409 mapping. The consumer discards the dispatcher’s unbound rejection receipt, and its stale-projection reason is more specific. The patch therefore does not promise byte-identical error envelopes. WP10 must decide whether an existing diagnostic consumer requires the unbound receipt; if so, preserve it through a typed consumer-error extension rather than synthesizing a receipt. The success shape and cleanup sequence are unchanged.

Applying this patch alone does not close any host integration criterion: it still uses the seed Dashboard-only source and overview destination.

## Exact remaining WP10 contracts

### 1. Producer catalog and admission

Use the exported `createSfBiFactory` to register the actual host-resolved Dashboard, Planner/projectedPlanner, Procurement, Scenario and Portfolio ports. Its `views` lists must match the source capability and the eleven catalog questions. If two producers serve a view, the host `select(request, trustedContext, candidates)` must choose from the current authorized selection and return one producer consistently throughout the request. Do not authorize a producer from a query string alone.

UI admission must use the original exact `BiViewRequest` (`viewId`, opaque `selectionRef`, `period`) and `digestSfValue(request)` for `sf_bi_view`; the host retains the real Request privately. `dispatchBiPresentation` is called once at the transport boundary with that unconsumed context. The host then returns its successful `BiPresentationResult` and calls the authority finish operation in finally. Neither source metadata nor renderer callbacks create an authority lease.

For Procurement, the host `list(selectionRef, context)` returns the actual authorized stock projection and aging projections from the producer, including rows with unknown age. Authorized filter options and `apply(filters)` must cause the host to issue a newly authorized selection and replace the projection; the renderer must not calculate role scope, stage counts, age or approval policy.

### 2. Exact mark destination and visual filter

The host receives the complete original `request: BiViewRequest` and the emitted `selection: BiSelection` (or a host-issued opaque token resolving to those exact values). A closed HTTP decoder must reject unsupported fields and malformed values. Both are selectors, never authority. It admits a fresh UI lease for the original sf_bi_view request and calls `readBiDestination({ request, selection, context, source: factory.source, authority, business })`, where business is the real `BusinessContextService`, not an injected success callback.

The destination reader re-dispatches the current BI projection, matches valueId, projectionVersion, engineVersion, exact C17 reference and authorized ProductContext, and calls BusinessContextService.resolve. WP10 displays the returned authorizedProjection with its exact source/version; it must not convert it to a collection/dashboard overview or rebuild a URL from record identifiers. Historical/stale/replaced/revoked/unavailable states remain explicit and must not disclose a new current record through the old mark.

The parent’s local brush correction was independently re-read: ProductContext stays unchanged and optional visualPeriod is carried separately and checked as a subset. WP10 must preserve that admitted subset through detail/return and restore the chart brush and `restoreBiFocus(container, selection)`. The authority digest remains tied to the original domain request; a display-only subset must not impersonate a newly authorized projection context.

The current bi-source query accepts only sf/selectionRef and therefore cannot implement this contract. WP10 must add a closed typed mark request or an opaque mark token and update the browser consumer together. The minimal patch intentionally does not guess a new persistence or transport protocol.

### 3. Native/MCP parity without double dispatch

Register `factory.descriptor` in the shared capability catalog with id `sf_bi_view`, frozen handlerExport `readBiView`, its closed input/output schema and existing granted profiles. The real native runtime retains its provider-owned binding, run/session ids and provider generation. Do not register `dispatchBiPresentation` as the descriptor handler: it is a boundary orchestrator and would consume the same one-use lease again if nested beneath an already-dispatching bridge.

At the native transport boundary, invoke the canonical dispatcher once with factory.descriptor and the actual native context. A transport replacing its own dispatch with dispatchBiPresentation must unwrap the canonical DomainProjection/receipt for sf_bi_view; the native output schema does not become BiPresentationResult. Presentation metadata may be used downstream, after the already-bound call, through `readPresentation`, with the exact projection comparison and final fences. No native authority may be reconstructed from a JSON context or from an example requestId.

The proof must record the actual UI/native/MCP receipts and shared handler/result digest/version for equal source/authority, then show direct/ungranted/revoked/provider-generation-change denial at the real destination. A synthetic private registry or false native callback only proves adapter behavior.

### 4. Durable ContextualBI choice and artifacts

Integrate the WP00 SfBiArtifact/state schema and the owner state-provider support for the `bi-artifacts` namespace. Bind `createStoredContextualBiSelectionReader` to host-owned `readHumanChoice(caseRef, context)` and `readArtifact(reference, context)`. The first resolves a real human-approved catalog choice plus opaque projectionRef/tableRef for that same case incarnation/version. The second resolves the persisted SfBiArtifact under current identity, access revision, policy and source fence, and verifies its digests and case/selection binding.

The two opaque artifact refs must open the same stored artifact with the exact projection/table bytes and canonical projection refs. Preserve the complete `dashboardSelection: DashboardReadRequest`, including fields. Revalidate the human choice and both artifact references after awaits and on reload. Ref changes, revoked evidence, mismatched table/projection digest, wrong case incarnation/version and stale source-fence states must fail explicitly. The WP05 reader does not grant source access or perform the owner’s persistence mutation.

## Unaccepted review finding

`cold-review-01.md` records R1 and the independently re-read correction: ProductContext is preserved, visualPeriod is carried separately and validated as a subset, and prepared consumer-dashboard/consumer tests join the brushed renderer selection to the real Dashboard C17 source-access reader. Review status is CORRECTED_STATIC_AWAITING_CI. No criterion is accepted from that static reread, and the scoped BI01 integration harness is not the installed full host or native runtime.


## Observed CI closure for R1

R1 is verified at the BI01 domain/store/browser harness level in [S2 run 43519544728](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43519544728): consumer-dashboard.test.ts passes after obtaining the selection from the real renderer, preserving the authorized annual context and monthly visualPeriod, and resolving the original C17 Dashboard page with a fresh UI admission. This supersedes the initial static-pending review status. The installed host, native/MCP parity and eight granular destinations remain unproved. The undated producer assertion remains failed and unchanged.
