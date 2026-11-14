# W27 record participation — owned overlay

Base: W26 `a1434e7ea7340aa1d1c8ce6bb48958b724218170`. Two owned files only. This directory is an isolated overlay; staging `repo/`, foreign inputs and earlier seals are unchanged.

The generic API remains `(incoming, call, work)`. An unexported AsyncLocalStorage owner is created only after the complete witness succeeds inside the actual LocalStore transaction. Identical dependency bundles can participate when every complete input ref already belongs to that owner. Different bundles retain the full W26 qualification and separate witness; they receive no borrowed authority or closure.

Participating children still execute their actual canonical callback once and revalidate/authenticate/read environment at both boundaries. They compare current defensive snapshot copies and source fences by complete bytes, and retain their own reader, getter, complete-input, Request/all-header, binding, lease, dependency and selection pins until the owner completes. A late reader change after a successful child return therefore invalidates the owner. The implementation retains no returned projection, pending Promise or successful authorization decision.

The owner cannot complete successfully with pending children. A continuation carrying a closed token is refused before canonical work and cannot reopen a new scope. A mismatch, attempted nested writer, exception or after-work change invalidates the owner/ancestors without retry. No returned currentRef extends the closure. The original exact current-scope materialization function is byte-identical to W26; the fresh undefined result and pre-work cold/preferences fallback remain.

## Proof inventory

The existing three tests, 24 literal expectation calls and 120000 ms budgets are byte-identical. Thirteen new source cases in the same whole file cover real repeated and recursive canonical work with only two owner witnesses, six transient boundary changes restored after refusal, late reader/input changes after child completion, full-ref closure refusal, detached continuation and a real nested writer. The fixture forwards to real C08/authority/LocalStore/business producers. No successful verifier or product-state result is synthesized.

## Remaining verification and cost

This is a static builder package, not an independent review or hosted pass. No product was imported, built, typechecked or executed locally. The unchanged eight-file A request can select this whole file after publication. Full root before/after witnesses and all canonical producer calls remain. Retained pins add a linear synchronous scan per liveness check, potentially quadratic over many completed participants; the guarantee is intentional and elapsed benefit must be measured in hosted CI.

The separate Memory overlay must qualify the whole partition through the atlas namespace grant, preserve all external sf-memory-case-fence hooks, and compare complete common witness components across the external before-witness, authorized partition capture and fresh root entry. This helper does not move those hooks or cache Atlas results.
