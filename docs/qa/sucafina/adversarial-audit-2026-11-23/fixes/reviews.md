# Review and mobile reading fixes

Implementation starts from `e115b667d845822a1df5f523bbfd828ab57ca978`. Validation is recorded separately against the integrated candidate.

## Changes

- B2: captured dashboard paths have an explicit, localized field/record presentation catalog. Record names come only from unique fields in the same preserved projection, including captured OPEX/CAPEX parent references. Values are grouped by their exact captured record path. Unknown paths remain literal, visible identities; no field or currency is inferred from an opaque UUID. Bare scalars remain literal (including years); only an explicit unit/currency enables numeric formatting. The original JSON, comparisons, evidence and export payload are unchanged.
- B3: UI50 has one Office format control and the original section selection. The unused title and legacy duplicate report form are removed. One original report action retains its admission, idempotency and recovery.
- B4: confirmed preservation opens that exact review with the same owner selection. Review/report entry routes accept an existing reference and let the destination reauthorize it. No list or successful read is invented.
- B5: source requests have a separate abort lifetime, immediately clear prior links, and fence transport, owner generation, stamp, review identity/version and the active request. Failures are visible with an explicit read retry. A stale source refreshes the preserved review instead of repeatedly comparing against an obsolete local version. Topic changes, revocation and unmount remove old source navigation.
- ROOT-01: at narrow widths, each original chart period is paired with its observed value and unit. The signed mark uses the same model and scale; there is no financial recalculation. Desktop SVG remains available.
- ROOT-02: comparison rows retain their native table headers and show localized Previous/Current labels inside full-width, vertically stacked mobile cells. The final320/390px refinement prevents currency/source labels from breaking inside narrow half-width columns. Business fields precede provenance. Source-only changes remain nonnumeric; all lineage stays available in disclosures.
- ROOT-03: the native not-admitted boundary uses a localized frame with contextual read retry and a same-owner, F01-guarded return to Today. No route admission has been loosened.

## Qualification

The original preserved-review journey passed in Linux production Actions: [Reading8](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45233056529), source `0bbe4b694b666db77420aabe9b271a330ecaba22`, snapshot `18ce38f9c2f08eb69426a00fc0011b2bf4e4c128`. One case passed with no retry, skip, flaky result or page error. Artifact14848153650 contains41 named PNG paths/38 unique hashes; its ZIP SHA256 is `c952a3e5e729d78406decbec59aaf33c4ec84ea50171d201bd1657a2d7d90626`.

The BI/native-state case passed in [Reading6](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230262835). Only that case is qualified from this mixed run: its second case failed on the test's incorrect stale-action label and is superseded by Reading8. The BI's original unit and currency both absent are presented as localized “Currency not provided”; no currency or numeric transformation is invented. Independent inspection of the320px capture confirms period, value, signed mark and unit remain associated.

The semantic/browser gates in [Gates8](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45233064600) passed: app and e2e typechecks,28 semantic cases/122 assertions,130 browser DOM cases/1801 assertions,78 guard rules with no errors or approved overrides, and exact regeneration of seven palette files. The final integration gate is indexed in [CLOSURE.md](../CLOSURE.md); overlapping runs must not be summed.

## Original source refusal and recovery

The source endpoint actually returns HTTP409 with exactly `{status:"stale",reason:"review-read-changed"}`. Its protected read detects a changed original source. The final test accepts either an exact original successful link response or this specific original refusal; it does not accept an arbitrary failure. It asserts no stale links, visible stale feedback, and the native **Current source** recovery action. That action rereads the same preserved review with an original200, removes the old panel and makes a later explicit Open source available. No automatic retry or write is introduced.

Positive source opening is **not qualified** by this execution because the original producer refused it. The backend integrity/authorization fence was neither removed nor bypassed. The earlier abort is an explicit negative control, and the subsequent409 is the actual producer response. The diagnostic Reading5 soft200 expectation belongs only to its disposable snapshot and is not a final passing proof.

Behavior cold review identified the stale-retry dead-end. System cold review checked the final original-response oracle and the mobile-cell/currency change. Root separately inspected the final UI49 at320/390, UI50 selection at320, the stale recovery panel at320, and the reread in light desktop. All original fields, record IDs, values and provenance remain available; year scalars are not formatted as monetary values. Own-property lookup prevents prototype names from masquerading as semantic catalog entries.

## Evidence boundary

UI50's one format control, original section selection, disabled empty selection, preserved identity, content and notes are exercised. This journey does not claim DOCX/PPTX generation or download. It is an original isolated installed producer in Chromium/Linux, not live Microsoft or all browsers/devices. Captured paths are not equivalent to distinct images or fully exercised business journeys.

[reading-evidence.json](reading-evidence.json) records exact receipts, hashes, reviewed images, historical failures and source parity. [reading-test-map.json](reading-test-map.json) maps the two original cases into two supported named specs:67 assertion statements retained, original660/720second case budgets and zero retries. Wrapper/request files exist only in disposable CI snapshots.
