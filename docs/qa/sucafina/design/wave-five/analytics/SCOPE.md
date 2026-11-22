# Wave five analytics: implementation and qualification scope

## Source and ownership

Pinned development source: `d3ccea42b5f8409c8d6c68e4909f7b868b50322c`.
Isolated implementation branch: `sf-next-analytics`.
Owned inventory areas: UI42 Portfolio scenarios, UI43 Portfolio results, UI44 Sensitivity, UI45 Analytics catalog, UI46 Analysis details.

The implementation changes only native presentation and the grouped real-installation journey. Original decision/portfolio/BI schemas, source producers, grants, CAS, idempotency and receipt semantics remain authoritative. English and Brazilian Portuguese catalogs are unchanged: every existing key and English value stays byte-for-byte intact, and the new compositions reuse existing localized phrases.

## Composition

- UI42 opens with a two-column authorized-case collection, then a source-bound configuration stage. Case currency, horizon and version form a compact fact band. Candidate scenarios occupy the primary column; constraints and priorities occupy the second column. Preview has its own stage while configuration controls remain mounted and retain selections.
- UI43 presents the recorded evaluation, conditional comparison and original limitations. Source references and combination evidence remain available in disclosures. No full cost total is inferred from pending coverage.
- UI44 groups scenario, baseline and parameter selection, then source-issued units, criterion and sampled bounds. Review hides the mounted controls. Cancel restores the same draft. Recorded samples retain unknown-versus-zero and original threshold evidence.
- UI45 groups all eleven original BI questions by their existing financial, operational and decision families. Choosing a question opens the existing context selectors; changing the period revokes previous source projections and links through the original controller.
- UI46 retains the selected original view, source periods, financial/operational/decision renderers, exact tables and source resolution. Large plots and tables have named keyboard-focusable local scrollers. Chart coordinates, values and producer-owned calculations are unchanged.

All five roots require `data-sf-wave="five"`. The shared frame retains a 1160px maximum, native fonts, quiet materials and the existing page gutters. Local panels use 20px padding, reduced to 16px at 479px; sensitivity editors/review are bounded at 760px. Controls retain 44px targets. Source tables remain readable in local 620px/720px scrollers and source plots retain their original 700px coordinate width. Actual 320px/390px CSS reflow is not browser zoom.

## Original data and planned gates

The Playwright journey reuses `withDesignInstallation(..., "four-decisions")`, the existing isolated installed host, original one-use enrollment and real HttpOnly session. The canonical seed creates its records through original domain commands and installed source endpoints: two Planner versions, one service line per version, source evidence, two cases, pending coverage, two alternatives, a registered criterion and a conditioned choice. It does not manufacture portfolio/sensitivity result rows.

`design-wave-five-analytics.spec.ts` contains two grouped journeys. The first previews and confirms a real one-candidate portfolio request, reads the stored result, issues sensitivity units and confirms a sampled evaluation. The second exercises the eleven-view catalog, real financial and operational data, source resolution, period invalidation and the genuine absence of a persisted sensitivity selection in its independent installation. English dark/light/desktop/320/390 and Brazilian Portuguese states are captured where the original source admits them.

Tests run only through the existing `.github/workflows/test-ci.yml`, using its production Playwright configuration and strict omni control. No routes or HTTP responses are mocked. A rendered title is never counted as successful source-backed content. Exact run evidence, actual captures, visual critique and limitations will be recorded after execution.

## Source diagnosis retained

Static inspection found an existing mismatch in `portfolio/scenarios/producer.ts`: the units adapter expects `value.units`, while the closed public sensitivity-units schema and the original portfolio HTTP product expose a flat binding with `parameterUnit`, `resultUnit`, `engineVersion`, `evidenceRefs` and `sensitivityRequest`. This diagnosis was sent to the integration owner for a narrowly scoped adapter correction; it is not resolved by fabricating a nested response or weakening the journey.

## Mutation transport note

The intended grouped qualification tree was created as Git tree `202f863180d01b5f0e51394f8ca2a4fd0eee759b`. A Git-data commit was readable but could not be attached because the connector returned an object-not-found error. Sequential GitHub Contents API writes produced the same tree on the authoritative branch at `b7da3ce3ae6654502421cd655f9db1dd43365218`. No shared or development branch was changed by this worker.
