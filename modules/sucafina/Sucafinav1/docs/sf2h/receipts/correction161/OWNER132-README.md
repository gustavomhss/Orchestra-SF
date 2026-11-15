# Mission 161 — owner132-only terminal seam (inert)

The attached `OWNER132-NATIVE-TERMINAL.patch` is **not applied** in this branch. It is a complete unified diff for the two paths excluded from mission161's writer authority, pinned to the exact preimages:

- `modules/sucafina/Sucafinav1/product/integration/native-evidence.ts`: `0502f30e054e40049df1283c00d4f5af1545f7c2`
- `apps/cli/src/sucafina-product/host-context.ts`: `297a4050323d80648684725f9c7e9a8680aa318f`

The source change in `native-host.ts` (`0c11d6ede57c9d40bf6b1a1a5480d1efa3e7e48d`) now includes optional, deny-only `budget.settlePreparation(reservation, "failed" | "cancelled")` after the resource cleanup. Until owner132 wires this callback it is absent; C08's durable reservation remains in place and C15's owned tombstone remains deny-only, so a failed preparation cannot silently become a retry or authorized run. This is intentional source-ready, not a finished durable recovery contract.

The owner patch proposes a monotonic, root-private terminal annotation on the existing `sf:native-session:<id>` record and a hard refusal to append token receipts after terminalization. It uses serializable `Persistence.transaction("dashboard", ...)` because an aborted Request cannot pass the existing `SfProductStatePort.transaction` revalidation. **Security/authority review required before applying**: it writes the protected `__sfProductV1` pref metadata directly and advances the aggregate and namespace versions. If that privileged deny-only settlement cannot be admitted as written, owner132 must provide an equivalent root-private C08 capability with the same exact source/consumer signature, CAS, monotonicity, and NO new authorization. Do not replace this with an unauthenticated Request, plain `runId`, removed marker, authorization bypass or permissive rebind.

Source boundary: previously the `native-host.ts` preparation returned early after C08/C15, `Session.create`, identity mismatch, skill load and narrow; the only finalizer started later. Now an outer finalizer, request-abort listener and identity-fenced `SessionV2.remove` cover the failure window. A mismatch is never deleted; cleanup failure does not restore permission. A successful retained binding continues using existing `release/interrupt` and permission checks.

Consumer validation: 149 compiler/guards and 150 product CI only after integration by 132. All current tests and runtime proofs: `NOT_RUN`. This document and patch confer no shared-file write authority, no lease, no release, and no claim that Astra or an execution session ID was observed.
