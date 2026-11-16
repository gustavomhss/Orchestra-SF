# Procurement mount: CAP24 entry increment

Baseline: 68795a5f118212be5f7f1a2bd51e29e29fd96928; branch sf-procurement-mount. This is an inert, partial integration patch. It does not change runtime files until the integrator applies it.

Apply `git apply --check docs/sf2h/receipts/procurement-mount/cap24.patch`, then `git apply docs/sf2h/receipts/procurement-mount/cap24.patch` against the exact baseline or reconcile against the integrator's shared F01 and shell changes. Full preimages/postimages accompany the patch. The browser test is included in the patch; it is not a substitute for installed end-to-end evidence.

The increment mounts the existing CAP24 overview under the same F01 owner, keeps the existing guard and staged desktop bridge, and requires the original Dashboard destination and operational `domain.page.CAP24` before mounting. The component itself performs the authenticated producer read and checks its returned context stamp. Only the entry path and owner selectors are accepted; no financial policy or producer is changed.

Still open: CAP14 and CAP25–28, all procurement detail/create/review/sourcing routes, query selectors and owner-bound record preflight. Their producer and view contracts require separate integration. In particular, overview's link to CAP25 remains unavailable until CAP25 is integrated; do not treat the page as complete. F01 draft revalidation remains case-only; do not enable editing until producer-specific revalidation and unknown outcomes are addressed. No BI/Planner/Dashboard duplicate was added.

Validation NOT RUN by instruction: local CI, tests, typecheck and guard. After integration run the change-scoped hosted browser tests, installed owner/auth/transaction bridge tests, deny/unavailable/stale and dirty-draft transitions, package typecheck and `bun run check:guards --base origin/dev` in the authorized environment. Verify original producer projection and actual operation admission; do not infer access from the route catalog. No claim of runtime or UX proof.
