# Wave six: routine catalog, results, schedule boundary and residents

## Qualification scope

**Status: the installed-boundary browser checks and native authority checks passed.** The final catalog request reached the original backend and returned HTTP 503 with `SF_NATIVE_PHASE_UNAVAILABLE`; the native C07 phase is still unavailable. Schedule admission remains denied by F01. The resident inventory and human case projection returned HTTP 200; analysis history was not admitted by the current context.

This report covers UI64, UI65, UI66 and UI70 in the final-fourteen composition. The browser evidence comes from the original native installation, the production app-shell bundle and Chromium launched by the existing Linux `test-ci` workflow with strict Omni. Screenshots are actual browser captures; no design mockups or substituted HTTP responses are used.

The polished frontend has a narrower operational scope than a complete C07/C15 go-live. UI64 renders the original authorized case workflow and the current catalog response. UI65 qualifies the state with no selected run and its real return to the catalog; this fixture has no governed C07 execution or verified output to display. UI66 qualifies the contextual F01 denial because the native Schedule port is absent. UI70 reads the actual installed resident inventory and case-scoped evidence boundaries. None of those limitations is represented as a successful routine run, completed schedule or verified model contribution.

## Design and interaction

The routine pages use the existing native glass, typography and color tokens with a bounded 1160 px content width. Spacing, section weight, focus indicators, 44 px controls, wrapping references and the wide-to-narrow layout are local to the routine workspace. No absent shared workflow stylesheet is imported. One new selection-instruction key is provided in English and pt-BR; all pre-existing English strings remain byte-identical.

UI64 now follows the user's actual progress. Its first view contains case and purpose; it does not claim a catalog is empty before any query. The published-recipe section appears after the original query starts, input references appear only for a selected recipe, and admission material appears only when the original recipe/admission state makes it relevant. Case, purpose and reload changes reset this presentation state. The original request handlers, pending and unknown states, source checks, admission boundaries and cancellation behavior remain intact.

UI65 has an owner-preserving catalog link available even when no run is selected. Its empty-state message now explicitly requests a run selection, avoiding the former generic claim that there are no records. The destination preserves server, project and installation and re-enters F01; a link does not create authority. Run proof, verifier and output checks remain unchanged.

UI66's list/detail/editor styles were refined, but the installed fixture cannot admit that leaf. The actual rendered result is the separately composed contextual F01 boundary: a schedule-specific heading, clear unavailable explanation and keyboard-accessible return to routines. The evidence asserts denied admission and zero UI66 leaves, rather than silently bypassing the original boundary.

UI70 presents five real selected profiles and their 25 admitted skills. The overview, filter, profile list, selected detail and technical disclosures form a clear hierarchy. The current human decision is independent of any claimed model contribution. Canonical profile IDs remain visible because the original producer does not supply an authorized human-name alias. Source missions and skill names are preserved as producer data.

## Strict wire values

The browser audit found that the catalog action stopped before HTTP dispatch. The original leaf passed a Solid store case reference directly to the closed codec. Solid 1.9.10 stores private symbol keys on reactive objects, while Effect 4.0.0-beta.83 checks all own keys when excess properties are errors. The private reactive metadata therefore caused a contract mismatch before the original endpoint was reached. The versions are pinned in the repository catalog; implementation references are [Solid store](https://github.com/solidjs/solid/blob/v1.9.10/packages/solid/store/src/store.ts) and [Effect object parser](https://github.com/Effect-TS/effect-smol/blob/effect%404.0.0-beta.83/packages/effect/src/SchemaAST.ts).

UI64, UI65's original-read fallback and UI70's analysis-history request now materialize exactly the authorized `id`, `incarnation` and `version` fields in a plain request object. No codec option, schema, permission or source comparison was relaxed. UI65's fallback payload received the same correction, while its live-result branch remains unqualified because the fixture supplies no governed run. The final browser oracle requires the actual catalog POST, compares its closed request with the exact case returned by the original choices service, and decodes the original response. When analysis list/read is admitted, it similarly requires a real UI70 history request and a successful original response. In the final installation that history branch was unavailable; no history response or verified contribution is claimed. Earlier R8/R9 visual runs are not treated as catalog HTTP qualification.

## Original authority and read infrastructure

Two narrowly scoped native readers restore original infrastructure missing from the composition:

- `native-ui/residents.ts` reads the actual selected resident bundle, intersects the original profile/skill/operation policies, uses live UI authority, validates the single-use lease once, and fences the current principal, access revision, registry, binding and producer identity.
- `native-ui/routine-health.ts` observes only the four registered routine reads through the original installed publication and C08 metadata. It does not run catalog planning, prepare an admission, start a routine, request approval or create a Schedule.

Discovery and every operation retain the original server/session/owner boundaries. Readiness is established through the installed current source and authority; an existing method name alone is insufficient. Root-owned wiring binds these readers to the real product handlers. Native schedule operations and prepare/run remain explicitly unavailable in this installation.

## Native verification

The latest composed native check ran on source `dc0698ec878427d5a8e6b78955b6b0ba31eadcbf`, with only the standard CI request in snapshot `744090c19ed6d07f2a7f6732c2c9dd663d0cde78`.

[Run 45102243868](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45102243868), [job 137455506028](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45102243868/job/137455506028): **53 tests passed, 647 assertions**. This combines 52 memory-observer tests with the complete original-installation test for routine and resident reads. Strict Omni positive control passed with one spawn and zero delegated launches. The run repeats the non-mutation proof after the additional F01 observers were composed.

The eleven resident-reader unit tests have separate earlier provenance: [run 45098223206](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45098223206), [job 137442746035](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45098223206/job/137442746035), source `82ce78c3a064eb0af4af48d9d69b2948e66abadc`, snapshot `b9ae0bd87d132130a934239d840c7a7493a549f4`. That run passed **12 tests and 417 assertions**: the eleven focused resident cases plus the original-installation test. The counts are not added together because the installation test was deliberately repeated.

The suite verifies five ready read operations: `projection.residents`, `projection.routine`, `routines.catalog`, `routines.read-admission` and `routines.read-run`. It verifies the actual five-profile inventory, rejects a request without the scoped application cookie even when server Basic authentication is valid, and rejects cross-site access. No approval request was submitted, and no Schedule port was installed.

The snapshot oracle compares C08 and business state exactly across those reads. Investigation identified original background maintenance of `localJobState` plus the resulting `dashboard-dataset` and `dashboard-page` source records. Only those two already-derived families may advance, and only when their digests match the original source enumerator, their incarnation/alive fields and every other field remain unchanged, their key set stays identical, and the integer version increases. All other data, cases, audits, versions, notices, scopes and identities remain exact. This accounts for evidenced concurrent maintenance; it does not permit the health readers to mutate business state.

A later type-only correction validates each Map lookup as a string before the same comparisons. It does not change the runtime oracle or reduce any assertion.

## Browser verification

[Run 45103228274](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45103228274), [job 137458598345](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45103228274/job/137458598345): **one complete browser journey passed in 4.7 minutes**, producing **20 PNG captures and 18 bounded JPEG previews**.

Source composition: `b4aa09ca71f1bd64d1ca3e0d105613fe0011d502`. Test-only correction: `84eca2de2aef4d82395c91400ada0cce7d5dec4e`. Exact CI snapshot: `fdf6f8d61a9b412e6fa3251d08c20863920ad41a`. [Artifact 14786049451](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45103228274/artifacts/14786049451), SHA-256 `7abd1cf46176eab2bbf3408506788494bd538433cbd5fb4b32a0722b98e96682`.

The final observed outcomes were:

| Original operation | Observed result |
| --- | --- |
| Browser case choices | HTTP 200 |
| Catalog POST from the UI | HTTP 503; closed body `{status:"unavailable", reason:"SF_NATIVE_PHASE_UNAVAILABLE"}` |
| Resident projection | HTTP 200 |
| Human case projection | HTTP 200 |
| Analysis list/read | Current context does not admit this branch; zero list responses claimed |
| Routine prepare/run and Schedule create/update/pause | Zero observed requests |
| Browser exceptions | Zero page errors |
| Browser console | One expected resource error for the original HTTP 503; no application exception |

The case tuple used by the oracle comes from a separate original `choices` read through the same authenticated browser context's APIRequestContext. Its response must be HTTP 200 and pass the closed source schema. The real UI selection and catalog POST remain mandatory, and that POST's body must equal the authorized tuple and entered purpose. The catalog is sent once; no response is mocked, fulfilled from fabricated data or resent to hide a refusal.

Detailed metadata and the original outcome summary are preserved in [validation.json](./validation.json).

The existing `final-routines.spec.ts` drives the original `four-decisions` installation and selects the exact seeded case by its actual option label/value. It selects `sf_maestro` by its exact heading; it does not choose an arbitrary first resident. The production-bundle check, original fixture deadlines, strict spawn controls and request handlers remain in force.

Browser checks cover:

- UI64 before query, exact case/purpose selection, the original catalog request and absence of an admitted preparation.
- UI65 no selected run, the specific instruction, unchanged owner query and keyboard activation of the real catalog link.
- UI66 explicit unavailable Schedule resource, original denied view, no leaf, contextual explanation, overflow checks and keyboard return through F01.
- UI70 actual inventory, empty filter/reset, exact profile and case, successful original human-case projection, and the explicitly unavailable history/contribution boundary.
- English and pt-BR, desktop 1440 × 1100 and narrow 360 × 900, both native themes across the matrix.

Theme changes are made through the real header control at desktop width before resizing to the mobile viewport. This respects the existing mobile header, which does not expose that desktop toggle. No DOM theme override is used.

The browser observer records routine and resident response paths/statuses and asserts that no routine prepare/run or schedule create/update/pause request was submitted. Actual catalog/read refusals are preserved in the report and evidence rather than replaced by successful mocks.

## Visual review

The final R12 dark and light catalog screenshots were inspected after the confirmed HTTP response. They show the authorized case and purpose, a third section with the original unavailable state, a disabled preparation action and retained source-revalidation controls. The pt-BR 360 px initial catalog and final light resident-detail state were also inspected without overlap or horizontal clipping.

Independent review by the records agent approved UI64's progressive initial layout from R6, UI70's dark inventory/light detail and UI66's light 360 px F01 boundary from R7, and UI65's final selection instruction in English desktop and pt-BR 360 px from R9. Their source runs and exact states are recorded in `validation.json`. These reviews qualify the shown states; they do not claim a Schedule editor, positive C07 output or admitted analysis history.

The final matrix includes:

| Area | English captures | pt-BR captures |
| --- | --- | --- |
| UI64 | Initial dark desktop; selected case after original request in dark/light desktop and light 360 px | Initial dark 360 px and light desktop |
| UI65 | No selected run and real return link in dark/light desktop | Same selection state in dark 360 px and light desktop |
| UI66 | F01 unavailable boundary in dark desktop and light 360 px | F01 unavailable boundary in dark 360 px and light desktop |
| UI70 | Actual inventory in dark desktop; selected resident/case in dark/light desktop and light 360 px | Actual installed inventory in dark 360 px and light desktop |

The two English light-360 leaf states are PNG attachments with overflow assertions; bounded JPEG previews were not emitted for them. No independent visual-review claim is made for those two PNG-only states.

The [central evidence gallery](../evidence/README.md) preserves the exact bounded viewport JPEGs emitted by the test helper. The CI artifact contains original PNG attachments and the complete browser report. Provenance identifies each area, state, viewport, source snapshot, run and job. UI66 images are F01 boundary evidence with `surfaceRendered: false`. No additional image copies are stored in this directory.

Two concrete findings were corrected during visual review: UI64's premature empty-catalog message and UI65's generic no-records message before a run selection. Independent review confirmed the final progressive UI64 initial layout, UI70 inventory/detail hierarchy and the narrow UI66 boundary. Review claims are limited to the states actually inspected.

## Remaining operational boundaries

| Area | Qualified behavior | Not established by this evidence |
| --- | --- | --- |
| UI64 | Current authorized case UI, progressive catalog presentation, original catalog request and guarded admission state | Governed recipe publication, admitted routine preparation or execution |
| UI65 | Selection guidance, real owner-preserving catalog return, preserved proof-rendering code | Positive C07 run, verified C08 output or cancel capability |
| UI66 | Contextual unavailable explanation, original F01 denial and catalog return | Mounted Schedule leaf, list/edit/create/pause or C15 completion |
| UI70 | Actual installed inventory, successful human-case projection and explicit history/contribution boundary | Admitted analysis history, attributed model execution, verified contribution or load receipt absent from the original projection |

These boundaries are observable properties of the supplied original installation. They must remain explicit in the merge and release description.
