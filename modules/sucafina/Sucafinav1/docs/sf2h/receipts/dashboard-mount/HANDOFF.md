# Dashboard native mount — integration handoff

Base: `68795a5f118212be5f7f1a2bd51e29e29fd96928`. Branch: `sf-dashboard-mount`.
Status: **candidate; not integrated or validated**. The shared files are inert images and `complete.patch`; the branch itself does not activate the mount.

Apply `complete.patch` only after checking each preimage against the integration head. Its targets are:
- `packages/app-shell/src/orchestra/chapter-route.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/surface.tsx`

The new `host/dashboard-route.ts` and its test are live files on this branch and must accompany the patch. The proposed integration registers Dashboard in the existing owner lifetime, accepts only CAP01–CAP05 recognized routes and producer-validated period selectors, requires the actual ready/operational page operation and readable destination, preserves F01 transition/desktop staged preflight and guard237, and requires operational status for CAP04/05 actions. The leaf still makes the original producer read and independently gates actions. Catalog membership does not grant access.

Required before integration: resolve concurrent changes to the three shared files; typecheck app-shell; run scoped tests and browser coverage for all CAP01–CAP05 routes, owner changes, cancelled dirty edits, history, denied/revoked operation, cross-origin desktop staging and login; verify navigation entry and original producer read/write/confirmation behavior. In particular this candidate has **not** proved route ref selection with a real producer, sidebar entry, session recovery, or installed desktop/web operation. Revalidation for Dashboard drafts remains unavailable in the existing F01 owner and quarantined drafts therefore cannot be restored after authority refresh; design and prove producer-specific revalidation before claiming that behavior. Review the accepted query fields against the fixed manifest and existing source validators. Existing Dashboard leaf UX completeness, historical records and imports remain outside this mount increment.

Tests, typecheck, CI and guard: **NOT_RUN** by instruction. No runtime, security or CI pass is claimed. No BI or Planner code is included.
