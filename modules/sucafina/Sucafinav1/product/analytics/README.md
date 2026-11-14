# Analytics composition

`readBiView` accepts the frozen `BiViewRequest`, an injected `BiSourcePort`, and the host `SfDomainValidation`. It requires an already-consumed binding with a matching operation and input digest before reading; the source reads the requested view from a domain and revalidates authority. Its output is the frozen `DomainProjection` used by `sf_bi_view`. The composition host owns binding, input/output validation, receipt generation and final C16 dispatch. A source must revalidate before the read and at egress; the BI layer does not grant access or calculate domain values.

`readBiPresentation` adds an explicit producer-supplied `BiPresentation` for rendering. Its series reference actual projection value IDs and declare labels, roles, units and limitations; unknown or duplicate IDs and mixed currencies are rejected. This interface does not add fields to the frozen MCP output. When no valid series description is available, `renderBiView` shows the available data in a table and reports the chart unavailable. It never derives monthly data, aging, stage history, a conversion rate, a financial delta or missing FX.

`renderBiView` returns a DOM element, preserving the projection context and selected period in the drilldown callback. Its optional `BiDecisionNavigation` callbacks expose the exact result, evidence, coverage, question, case and component references; the host reauthorizes each destination and can return focus using `restoreBiFocus`. The host must reauthenticate and revalidate the reference when opening the destination. `renderDecisionView` consumes the current authorized C10 result/comparison and optionally an engine-produced sensitivity result. These elements do not fetch or persist data themselves.

The catalog defines eleven questions. Catalog entries alone are not evidence that an individual view is supported: each requires its real domain producer, semantic description, native/UI composition, and the acceptance checks in WP05. Waterfall cumulative positions and planned/completed milestone semantics must be supplied explicitly by the producer rather than inferred by this package.

`createProcurementBiSource` adapts the WP04 collection port for BI05 and BI06. It passes through producer-computed counts and ages, keeps per-request evidence references, checks that every row has the same authorized context, and does not treat unknown age as zero. The host supplies the actual collection port and its revalidation boundary. WP04 must provide an open-request selection for BI05; until that is verified the catalog question cannot be treated as a proven integrated view.

`resolveWaterfall` requires domain-projected start and end values for each contribution and an explicit producer reconciliation state. It checks continuity and the final endpoint but does not sum financial contributions or introduce a residual. `renderWaterfall` uses those projected coordinates and provides an equivalent table; its producer binding and integrated proof remain pending.

`createBiDescriptor(source, authority)` binds `sf_bi_view` to the existing C16 dispatcher. The dispatcher must consume the one-use lease first; the handler verifies the host receipt, decodes the frozen request and output, invokes the same `readBiView` port, and revalidates before returning a host-issued receipt. Calling the handler directly without a consumed binding is denied. This is the composition seam; a live host still has to register it and inject the authorized source.

`createBiSourceRouter` combines explicitly registered view sources; an unregistered view returns `producer-unavailable`. For example, the host may bind BI05 and BI06 to the same `createProcurementBiSource` instance after WP04's collection port is composed. The router cannot make an unimplemented domain view available.

`createPlannerBiSource` is an injected adapter for the actual `PlannerPort.compareForecast` result. The host resolves the authorized versions and supplies an explicit series description and selected baseline/candidate; the adapter exposes the corresponding unchanged domain projection. It re-reads and compares the projection, ignoring only the per-read observation timestamp, before returning presentation metadata. The adapter never sums components, calculates FX or interprets value IDs. Real host binding and producer-supplied metadata are still required.

`createDashboardBiSource` accepts the real `DashboardPort.read` output together with producer-defined series metadata from a trusted host. It re-reads and compares the projection, ignoring only the per-read observation timestamp, before exposing metadata. Fields without the required period, unit or series semantics stay in the table; the adapter does not infer them from flattened field names.

`TimelinePlan` binds milestone labels and planned/completed state to authorized date values supplied by the producer. Missing or invalid dates remain in the list without a fallback; a completed state is shown only for a confirmed date. The UI does not infer completion or calculate financial effects from moving a date.

For BI04, each FTE and cost series must include matching `alignmentKeys` (one per value, same order and selected periods); otherwise the paired charts are unavailable and the table remains visible. This prevents independent scales from suggesting that unrelated groups align.

`bindDashboardBiPort` connects the actual `DashboardPort.read` to a host-authorized field resolver and producer presentation function. `bindPlannerBiPort` similarly connects `PlannerPort.compareForecast` to a host-authorized version resolver. Neither resolver may accept authority or arbitrary provider configuration from the caller; the host fixes the source and validates selection access.

BI01 and BI07 position points by their supplied dates, preserve temporal gaps, and reject repeated periods within one series. A filtered period that only partially overlaps a projected year or month retains the source row in the table but does not pretend to have a finer chart point. The producer must separate ticket categories/types into distinct series.

After returning from a drilldown, the host can call `restoreBiFocus(container, selection)` to focus the originating mark or table action. If a changed filter removed that value, focus falls back to the filter action. The host is responsible for restoring the selected context and revalidating the reference before navigation.

`renderPortfolioView` consumes a freshly authorized `PortfolioResult` directly, preserving each combination's eligibility, coverage references, conflicts, restrictions and component evidence. It never sums portfolio amounts or treats missing components as zero. Where no producer supplies cumulative waterfall positions, the component table is the available representation.

`readPortfolioBi` reads the authorized portfolio from `DomainProjection.decision`, the same projection returned by `sf_bi_view`. The host must resolve and revalidate every persisted decision and evidence reference and the full projection on egress. Missing decision metadata remains unavailable; the UI does not invent it.

`bindPortfolioBiPort` accepts the real WP13 evaluation port plus a trusted selection resolver and producer projection. It rejects a different horizon before evaluation. WP13's current output does not provide per-combination scenario/comparison references; the host must not claim waterfall or total parity until those references and the domain projection are available.

`bindStoredPortfolioBiPort` connects the persisted portfolio projection reader to a host-resolved selection and producer-defined presentation. It checks the persisted result reference and period; the host revalidates all access and evidence.

`createPortfolioBiSource` exposes the same host source to the C16 router, with fresh source validation and a re-read before presentation metadata. The host's `revalidate` must check the binding, selection and all portfolio/evidence references even when no bundle argument is supplied, and compare any supplied expected projection against current authorized source state. The adapter rejects projections without a persisted portfolio reference.

Sensitivity charts use the producer’s canonical `SensitivityResult.parameterUnit` and `resultUnit` for their axes. Legacy results without both fields retain their point list and mark the chart unavailable; the single `unit` field does not establish which axis it describes. Portfolio combinations with canonical `analysis` display the supplied scenario and comparison with their references; legacy combinations explicitly mark that analysis unavailable.

Sensitivity points expose their engine-provided `resultRef` to the `openResult` callback; the host revalidates access on open. `restoreBiFocus` also accepts that reference string to return focus after the result view closes.

`createSfBiFactory` composes explicitly registered, host-authorized Dashboard, Planner, Procurement and stored Portfolio ports into a shared source and C16 descriptor. Duplicate registrations within a producer and domain-incompatible views fail closed. When several producers serve a view, the host must select through its authorized registry; an unregistered selection is denied. Missing registrations remain unavailable; registering a route is not evidence that the producer or browser integration is complete.

`createStoredScenarioBiProjection` binds a host-authorized C02 selection to persisted C08 scenario and comparison results from the same case. When requested, sensitivity is read through the persistent sensitivity reader, which must revalidate the criterion and sampled results. The projection and results are re-read before return; the host's projection validator must verify the selection, the comparison's current decision binding and all source references. Matching result IDs alone do not prove the comparison binding. `bindStoredScenarioBiPort` and `createScenarioBiSource` pass that same projection to UI and `sf_bi_view`; BI11 is unavailable without the persisted sensitivity result. The host owns selection resolution, authority and drilldown.

`bindProjectedPlannerBiPort` accepts a real Planner `compareForecast` plus a producer-owned projection such as `plannerDifferencePresentation`; it checks context, period and currency and re-reads before presenting. BI only consumes the producer's endpoints and reconciliation, never calculates a financial difference.

## Consumer and drilldown

`dispatchBiPresentation` is the C08 consumer for a freshly admitted UI or native context. It invokes `dispatchSfCapability` with the same descriptor used by MCP, then verifies the presentation against that operation's result. A projection change between dispatch and presentation returns `stale`. A direct unconsumed handler call, a reused lease or revoked access cannot return data. The rendering metadata is separate from the closed C16 output schema.

`createSfBiFactory(...).dispatchPresentation(request, context)` exposes that consumer with the registered real producers. Overlapping routes are pinned to one producer for each context/request across asynchronous read, describe and revalidation; changing the human selection requires a new host admission. Projection and presentation snapshots are detached from callback-owned objects.

`readBiDestination` accepts the original `BiSelection`, a fresh `sf_bi_view` admission, the same producer and the host's real `BusinessContextService.resolve`. It rereads the projection, matches value ID, version, engine, context and the entire C17 reference, then resolves that exact reference and revalidates on egress. It returns the authorized source projection and selection for the existing detail surface. It never manufactures a collection URL. Historical, replaced, revoked or missing references return an explicit failure without source content. The host retains the originating selection and calls `restoreBiFocus` after returning.

A period brush adds `visualPeriod` to the selected mark and leaves `context.period` and its C17 reference unchanged. The destination validates that this display crop is inside the original authorized request, rereads that original request, and returns the crop for restoring the view. A display crop never becomes a new authorization scope or a reconstructed source reference.

The current WP10 HTTP entrypoint still needs to consume this port and register Planner, Procurement and decision sources. The patch and dependency receipt under `docs/sf2h/receipts/WP05/` describe that owner boundary. Component tests do not qualify the common entrypoint or native execution.

## Contextual filters and artifacts

The sixth `renderBiView` argument accepts `BiFilterControls` for stage, holder and buyer. Both options and current values come from the authorized domain catalog. Applying the controls requests a new selection from the host; analytics does not filter raw records, reconstruct permissions or change counts locally. The host must replace the chart/table with its freshly authorized projection before returning success. An unavailable or denied response remains explicit. WP04/WP10 must supply this selection lifecycle; unavailable producer filters are not fabricated from visible labels.

`createContextualBiSelectionReader` validates and preserves the entire frozen `DashboardReadRequest`, including `fields`, before exposing contextual BI input. `createStoredContextualBiSelectionReader` reopens both artifact references and checks their case, selection and latest human choice. Actual persistence, reference integrity and source authorization remain with the WP10 store.

## Visual semantics

- A numeric residual marked `absent` does not affect scales or draw a mark. Confirmed zero remains a value.
- Financial trajectories and dated ticket series reject overlapping or unordered periods. Annual data is never expanded into months.
- Waterfall displays producer-supplied initial/final totals and signed contributions with the same references in its table. Incompatible periods/currencies are rejected and no residual adjustment is invented.
- Aging displays one point per authorized request, grouped using its projected approval type. Unknown age and holder remain explicit; history strings are never interpreted here.
- Milestones with no date remain in their own list and in the equivalent table even after a period brush.
- Sensitivity has a keyboard-accessible point table, declared axis units, result/coverage references and a condition label beside its threshold.

## Evidence boundary

WP05 tests distinguish pure adapters, browser components, real domain/store integrations and unavailable native/host evidence. Only GitHub Actions executions qualify the tested commit. A runtime prerequisite published on another WP branch is a dependency, not an automatic part of this candidate. In particular, shared BI types/schemas and the WP10 artifact store must be integrated by their owners; native SkillLoadReceipt, reload, revocation and universal-coverage witnesses cannot be replaced with controlled callbacks.
