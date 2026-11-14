# WP03 → WP01 / WP00 / WP10: Overview and Versions composition

## Delivered producer and current boundary

WP03 exports `createPlannerProduct(...).overview`, `.versions`, and `.presentComparison` from `product/planner/product.ts`. The original seven Planner routes and financial engine remain in `runtime/planner.ts`. The new Overview contribution and the Versions host are implemented and have deterministic integration tests under `test/product/wp03`; their exports alone do not establish that a production HTTP route mounts them.

The shared `SfHostServices` contract currently exposes `plannerMonthly` and `forecastInputs`, but has no Overview/Versions service. `product/interface/http.ts` mounts monthly preview/apply and forecast skill-input preparation; neither route is an Overview/Versions transport. WP03 has therefore left those owner files unchanged and specifies the exact composition delta below.

## Exact proposed patches — not applied

The following patches are based on GitHub MCP reads at commit `8f91131ad3357c94fa135392b6829908356d82e5`. [The patch manifest](overview-versions-owner-patches.json) records every observed source blob and proposed blob. Apply the three patches together in the listed order after the owners review them:

| Order | Owner | Patch | Concrete change |
| --- | --- | --- | --- |
| 1 | WP00 | [Host contract](wp00-overview-versions-contract.patch) | Context-first Overview and Versions services, with input/output types derived from the WP03 producers. |
| 2 | WP10 / CLI composition owner | [Private authority and composition](wp10-overview-versions-composition.patch) | Private `planner.read`, exact-intent read wrappers, the existing Planner product's version mutation authority, and current-version validation when C08 preferences are opened. |
| 3 | WP01 | [HTTP, page controls and preferences](wp01-overview-versions-interface.patch) | Closed same-origin transport, Overview selection/rendering on the existing page, preview/apply interception of existing Versions forms, and the `baseVersion`/`version` preference keys. |

`git apply --check` succeeded against separate copies of the observed blobs. These patches have **not** been applied to owner files, typechecked, or executed in a browser. That structural check establishes applicability to the pinned sources; it does not establish product acceptance. The runtime and UI gates remain pending until the responsible owners apply and validate the composition.

The proposed Versions client retains each rendered form's original revision, uses the annual official-pointer revision for the official action, and never sends a preview-generated ID as an apply target. A network failure after apply disables another apply and requires a reload/reconciliation; it does not assume a copy can safely be repeated. The private read action does not become a resident capability. Installations with an explicit grant list must grant `planner.read` deliberately.

## WP10: private authority and root composition

Use the existing root `DomainPortHost`, scoped source persistence, forecast/case coverage resolver and private authority. Do not deserialize an actor or grant from a browser request.

```ts
const plannerProduct = createPlannerProduct({
  host: authority.host,
  scopedSources,
  coverageFor,
  // Keep the same real scenario/criteria/evidence bindings used by the installation.
  versionAuthorize: authority.human.authorize,
})
```

`versionAuthorize` accepts only `planner.preview` or `planner.apply` and the exact `PlannerVersionRequest`. Those actions already exist in the private human authority. A producer created without this binding rejects mutation; it does not infer authority from the action name or UI controls.

For read-only Overview and Versions discovery, add private action `planner.read` to `sfHumanActions` in `product/integration/human-authority.ts` and the corresponding allowed read action in `product/integration/product-authority.ts`. Its installation grant must be explicit, and the product-authority read exception must allow a read-only principal as it already does for `views.read`. This action is a private HTTP admission, not a new resident capability. The deterministic fixture's `sf-human:planner.read` is intentionally local to the test; it does not prove this root composition exists.

The root retains the real `Request`, consumes the UI admission once, calls the producer, revalidates before sending the response, and finishes the private lease in `finally`. Reuse the existing origin, content-type, body-size and idempotency checks. Never construct a `TrustedUiContext` by casting JSON.

## WP00: service contract additions

Add owner-approved fields to `product/contracts/host-context.ts` using the producer types directly, rather than copying a monetary result schema. The exact patch retains the host's existing context-first convention:

```ts
plannerOverview?: {
  read: (context: TrustedUiContext, input: PlannerOverviewRequest) =>
    ReturnType<ReturnType<typeof createPlannerProduct>["overview"]>
}
// Versions similarly adapts read/preview/apply to context-first arguments.
```

The CLI composition adapts that argument order to the following producer signatures:

| Service | Request | Result |
| --- | --- | --- |
| `overview(request, context)` | `{ baseVersionId, candidateVersionId, period: { start, end } }` | `PortResult` of the authorized Overview model |
| `versions.read(selectedId, context)` | Explicit version ID or `undefined` | Version metadata, selection state, revisions and exact action permissions |
| `versions.preview(request, context)` | Closed `PlannerVersionRequest` | Original metadata, retained request, outcome, and a disposable preview when successful |
| `versions.apply(request, context)` | Same original request, admitted separately for apply | Current metadata, retained request and original-domain outcome |

The types are exported by `versions.ts`, `versions-host.ts` and `overview-host.ts`. No input field accepts principal, actor, role, source digest, salary or a model-provided total.

## WP01: mount the existing contribution

Add an owner-reviewed route in `product/interface/http.ts` with a matching adapter, following `planner-http.ts`'s transport conventions. Route Overview and Versions reads through the new private `planner.read` admission, and preview/apply through their existing exact human actions. Retain the request when a response is stale, conflicted, denied or unavailable.

For Overview, call:

```ts
const result = await plannerProduct.overview({
  baseVersionId,
  candidateVersionId,
  period,
}, admittedContext)

// Mount inside the existing Overview page after fresh authority is revalidated.
if (result.status === "ok") renderPlannerOverview(result.value)
```

The producer resolves the selected versions and the candidate year's official version through `issueSource` and `PlannerPort.compareForecast`, then rechecks version metadata and scoped source digests. It refuses an invalid/missing selection or mismatched year. It never silently chooses another baseline. An absent official remains explicit and does not rename the candidate budget as official.

The model separates `deltaToBase`, `varianceToCandidateBudget`, and `varianceToOfficialBudget`. For the acceptance fixture, candidate outlooks are 602000 and 596000 against base 590000; the deltas are +12000 and +6000, while the second candidate's variance to budget 600000 is -4000. Monthly actuals retain explicit zero and missing values. Planned FTE is labelled as planned capacity, and record additions/removals retain their source identities in the contribution table. A reconciled numeric difference remains conditioned if C10 is incomplete.

The Versions host uses the original domain commands. Bind buttons to `actions` from the current read model, and build the following requests without adding extra fields:

| Action | Closed request | Revision source |
| --- | --- | --- |
| First version | `{ action: "create", revision }` | `create.revision` |
| Edit | `{ action: "save", id, revision, name, year? }` | Version `revision` |
| Copy | `{ action: "copy", id, revision, name }` | Version `revision` |
| Lock / unlock / delete | `{ action, id, revision }` | Version `revision` |
| Make official | `{ action: "official", id, revision }` | Version `officialRevision`, the annual official pointer revision |

Admin is the domain authority for these mutations. Finance/HR/viewer metadata is readable when their page permission permits it, but mutation actions remain false and the domain independently rejects a forged submission. A current official cannot be unlocked or deleted. Year changes obey the original locked-version rule.

Preview's generated version identity is disposable; applying a copy resubmits the original copy request under a fresh apply admission. It must not send the preview identity as a persisted ID. On conflict, retain `result.value.request` and show `outcome.stored` next to the draft. The stored conflict is metadata only, not a raw version/position dump.

## WP01: existing C08 private preferences

Keep the existing `createSfPersonalViews` and private `preferences` namespace. The current `sfViewSelectionKeys("planner", "Overview")` supports `year`, `version`, `filter`; Versions supports `year`. Reuse `version` for the candidate and add `baseVersion` to the Overview allowlist/type and `version` to the Versions allowlist if the new selection is to be persisted. Update the existing personal-views client to restore those exact keys. Do not introduce another storage root.

The preference stores only the chosen IDs and filters. On opening it, reauthorize through the current host and issue new scoped source references. A removed or inaccessible version leaves the saved selection visibly unavailable; it does not grant access or turn into a different version.

The exact patch also carries `version` and `baseVersion` through Planner navigation and GET forms. The navigation click handler reads the current URL, including a comparison selection changed with `history.replaceState`. C08 permits the carried baseline key on Planner pages and uses `plannerVersions` with the authenticated actor and current snapshot to validate the selected IDs; this preserves the domain's dictionary/numeric-ID normalization. Its `Environment` is obtained before the persistence transaction. No alternate version normalizer or preference store is introduced.

Owner validation must include the following cases after applying the patches:

- Save and reopen a selection from a legacy version dictionary, including a numeric version ID, then remove the version and confirm the saved selection becomes visibly unavailable.
- Select another candidate, navigate Overview → OPEX → Overview, and verify both candidate and baseline survive. Also submit the existing Grid/filter/year forms after changing the candidate; their hidden fields must not restore an older selection.
- Apply one version rename, wait for the page's partial refresh, and make another change. The second action must still preview without mutation before its separate Apply action.
- Read through an explicitly granted viewer session, refuse missing grants and mismatched private intent, and revalidate after access or source changes.
- Exercise the actual mounted Overview and Versions controls through the real CLI after the separate CLI installation route-registration defect is corrected. An applicability check or producer test cannot replace that browser run.

## WP11 / WP05: cost changes and savings

`plannerScenarioCostPresentation(comparison)`, also exposed as `plannerProduct.presentComparison`, makes the sign explicit:

| Measure | Definition | 240000 renewal → 210000 transition | After 40000 training makes transition 250000 |
| --- | --- | --- | --- |
| Known cost change | alternative − baseline | -30000, conditioned | +10000 |
| Known savings | baseline − alternative | +30000, conditioned | -10000 |
| Complete savings | Requires complete current C10 | `null` | -10000 when all current coverage/proof checks pass |

This presentation does not change the comparison port's established sign or convert a pending category into zero. Missing evidence, absent amounts or unresolved FX keep full cost coverage unavailable. Unknown nonfinancial criteria remain independently marked unknown.

## Evidence boundary

`overview.test.ts`, `versions-host.test.ts`, `port-hr.test.ts`, and `scenario-costs.test.ts` exercise the producer through real local-store/source lifecycle or the authoritative engine. `capability-parity.test.ts` and `scenario-capability-parity.test.ts` exercise real UI authority, private execution registry, MCP SDK transport, shared dispatch and actual Planner ports; the latter includes real C08 result persistence and case/coverage access. Their native skill admission is a deterministic fixture. They do not witness `SessionV2.skill`, a hosted model, GNATIVE or this HTTP composition.

The integration owner must mount the services above and run hosted UI acceptance with a real resident session before claiming those remaining product/native gates. GitHub Actions run IDs and observed outcomes belong in the WP03 execution receipt; this handoff does not self-certify test execution.
