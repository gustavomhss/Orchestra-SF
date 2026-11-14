# Mission20 integration contract

Consumer: session14, sole writer of `sf2-stack`. Product branch/PR remain `astra-wp11` / PR40.

## Exact HTTP assembly

`http-mount.patch` is prepared against `sf2-stack@46cb4dd02f0a6d11b3fa7a0deac7f839e7b7af3c`, HTTP blob `81b7cd4ef5a73670642df42a2f891b9d95420dac`. Its resulting blob is `406187a4fe4e6f59a2cca5dc84c83758a063cd3a`. `http-mount.json` supplies exact replacement anchors, occurrence counts and the patch digest.

It adds one import, one form immediately after Edit, and one initializer immediately after the Edit initializer. It leaves the existing Apply, Choice, Sourcing, Forecast, Work, questions, contracts, authority revalidation and CSP calculation intact. Reconcile any later HTTP delta before applying; do not replace the file wholesale from PR40 or PR29.

The delivered Edit must also retain the structural conflict review consumed from PR43@2ee71fc90055814912654ae198f7a1dcf9583943, Edit blob `ebc7763548e3eaf476f36c17de72e1800f0fee2d`: criterion identity, added/removed confirmation, removed draft text, fresh comparison before adoption and before saving, access revocation and exact uncertain retry. Mission20 combines those behaviors with evidence attachment within its authorized Edit path. Apply is not an output of this mission. Its initial observed blob was `2e6c081ad2a5282654707f7fc7278183e7dfb20d`; the closure recheck at `sf2-stack@d81dc320a82044009dd4c39f2e5d062ad46719a9` found the newer C12/Finance Apply blob `a182c632c1714e3c48e6be07142adc7ed87d8f13`. Preserve the current accepted Apply, never restore the older blob. The HTTP preimage remains exactly `81b7cd4ef5a73670642df42a2f891b9d95420dac`, so the three mount fragments remain applicable without changing the patch.

## Canonical coverage read

`coverage-read.patch` is a separate, optional producer proposal, not an edit made by this writer. It targets the accepted `decision-controls.ts` blob `77563520dbfa9cab5876c0312eba294cb579e11d`, also current at the observed stack. Its manifest pins the exact preimage and result.

A fresh initial-alternatives journey can use the canonical coverage receipt returned by `decision-coverage`, retained in the same tab. A source with an existing classification but no retained receipt cannot safely reconstruct its `coverageRef`. The proposal exposes `forecast.coverage` through the existing authorized reader and existing `resolveForecastCoverage` port. It adds no endpoint, mutation, financial calculation, authority or policy exception. The module blocks instead of synthesizing a coverage reference or overwriting classification when neither path is available.

## Coverage retry across a concurrent case edit

The current `decision-coverage` host does not allow historical-CAS replay. A later case revision can produce HTTP403 with `reason: case-selection-unavailable`, even when current access remains valid. Mission20 distinguishes only that exact reason and performs a source-scoped authorized read. It preserves the original envelope on confirmed version conflict, or quarantines it if the read cannot establish current access. Quarantine hides protected content and permits an explicit GET access check only. No automatic mutation, new idempotency key, payload rewrite or rebase is performed. Actual denial removes the protected view and own stored buffers.

The producer limitation remains a precise unresolved consumer item: recovering an old coverage receipt after another writer advances the case may require a separately authorized producer change. It does not justify changing host/business files in this mission.

## Nominal selection after composition

`../nominal-request-not-dispatched.json` contains the existing authorized Playwright envelope for the single Decisions spec. It selects all four actual tests in that spec, including the three preserved tests. The new journey uses the real installation and Planner controls; it creates and copies versions, edits OPEX through the UI, discovers and inspects sources, attaches them, records pending coverage, and explicitly creates two alternatives.

It captures and drops only the original second-promotion response after the real server handler, then uses the visible retry button. Assertions require the same key, bytes, complete response, identity and final count of two alternatives. It reopens the case and consumes the persisted alternatives through current comparison and portfolio-catalog controls. No direct test POST, seed case, pasted internal reference or substitute application supplies product proof.

The known-cost example uses monthly projections of 100/200 USD and persisted annual subtotals of 1200/2400 USD. The comparison remains conditioned: complete total/difference is absent, category coverage is pending, and missing criterion rules remain unknown. These numbers are a narrow example and do not replace the pack's numeric oracles.

At this writer's closure the nominal journey is **BLOCKED / NOT RUN** until the actual shared assembly consumes the sources. Profile/manifest compatibility is already present in the observed consumer; the old bootstrap failure is historical. Do not rerun the unchanged old PR40 tree. Source equality or collection is not an E2E pass. S0 retains final acceptance, native/provider/AM gates, and final campaign dispatch.
