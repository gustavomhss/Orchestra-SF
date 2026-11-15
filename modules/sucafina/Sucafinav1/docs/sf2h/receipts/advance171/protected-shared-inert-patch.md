# Mission 171 — inert owner-only patch (NOT APPLIED)

This file is **not executable code and not a source amendment**. It transmits exact preimage-to-postimage replacements for five shared files outside A12 ownership. The JSON sibling includes the complete before/after text, checked preimage blob IDs, and postimage Git blob IDs. Those postimage blobs were created as unreferenced Git objects by GitHub MCP; **no protected path has been updated**.

Producer verified: `apps/cli/src/sucafina-product/work-destinations.ts::createSfWorkDestinations.read(selection, actionRef, TrustedDomainContext)` returns `PortResult<{view,verify}>`. The real host already creates `workDestinations` and uses it for HTML. The first two patches expose only `read` to the authorized native UI host, not the grant/authority object.

Privacy: registry `projection.search` changes only from GET+q in URI to bounded `POST` with JSON `{q}` and `maxRequestBytes:4096`. Browser transport and desktop IPC must independently fail closed against stale GET metadata. Both already generate/read the existing POST read idempotency header and send the original authenticated Request.

**162 application order:** (1) verify target preimages one-by-one against the current `sf2-stack` tree and secure current lease; (2) apply exact postimage blobs for all five affected files atomically into the sole C candidate, no force/reset; (3) include A12 author commits; (4) confirm operation codec and exports and UI consumers use the POST private read; (5) publish consumer ACK with source SHA, source tree, and accepted blob IDs; (6) then request 163 compilation/guards and 164 hosted CI. Drift => stop and reconcile with the current owner, never rebase silently.

Current manifest target head: `913b6b8f143e6c3e869eee293d02f04259c7cdd1`. Receipt input: modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance171/protected-shared-inert-patch.json. No integrated/runtime evidence claimed, no local tests.
