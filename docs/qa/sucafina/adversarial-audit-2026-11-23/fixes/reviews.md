# Review and mobile reading fixes

Implementation starts from `e115b667d845822a1df5f523bbfd828ab57ca978`. Validation is recorded separately against the integrated candidate.

## Changes

- B2: captured dashboard paths have an explicit, localized field/record presentation catalog. Record names come only from unique fields in the same preserved projection, including captured OPEX/CAPEX parent references. Values are grouped by their exact captured record path. Unknown paths remain literal, visible identities; no field or currency is inferred from an opaque UUID. Bare scalars remain literal (including years); only an explicit unit/currency enables numeric formatting. The original JSON, comparisons, evidence and export payload are unchanged.
- B3: UI50 has one Office format control and the original section selection. The unused title and legacy duplicate report form are removed. One original report action retains its admission, idempotency and recovery.
- B4: confirmed preservation opens that exact review with the same owner selection. Review/report entry routes accept an existing reference and let the destination reauthorize it. No list or successful read is invented.
- B5: source requests have a separate abort lifetime, immediately clear prior links, and fence transport, owner generation, stamp, review identity/version and the active request. Failures are visible with an explicit read retry. A stale source refreshes the preserved review instead of repeatedly comparing against an obsolete local version. Topic changes, revocation and unmount remove old source navigation.
- ROOT-01: at narrow widths, each original chart period is paired with its observed value and unit. The signed mark uses the same model and scale; there is no financial recalculation. Desktop SVG remains available.
- ROOT-02: comparison rows retain their native table headers and show localized Previous/Current labels inside mobile cells. Business fields precede provenance. Source-only changes remain nonnumeric; all lineage stays available in disclosures.
- ROOT-03: the native not-admitted boundary uses a localized frame with contextual read retry and a same-owner, F01-guarded return to Today. No route admission has been loosened.

## Review

Behavior cold review of `d5de9bb` identified the stale-source retry dead-end; the retry now refreshes the review before another explicit source opening. No source links are retained across that reset.

## Regression intent

The existing production workflow journey is extended for paired 320/390px readings, exact original preserved fields, preserve-to-review navigation, root reference entry, one report format, and an explicit source-read failure/retry. The existing preserved-model unit suite checks grouping, captured names, ambiguity, unknown paths and unchanged values. Existing authority/comparability assertions remain.

Browser captures and tests remain pending until the composed Actions runs are attached to the closing ledger. The wrapper/request files belong only to disposable CI snapshots.
