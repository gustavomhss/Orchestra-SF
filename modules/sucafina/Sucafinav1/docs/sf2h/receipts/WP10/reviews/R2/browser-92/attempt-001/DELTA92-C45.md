# DELTA92 — integração material de egress C44 → C45 (append-only)

**C44 reviewed first:** `eecbdacb21734695094332deb6142aa35d5c9c3c`, tree `4d4b149917a2c74cfeb73e45774fe098666c208d`.
**C45 newly observed:** `5585e57f90d7b8d45e0577a8f0f4aa7884d3b58d`, tree `5bb9151ba20f606c42b8a073f246365e49d6e116`, direct parent C44, one commit ahead. **Status from C45 manifest:** `MATERIAL_COMPOSED_VALIDATION_NOT_RUN`, not a frozen FINAL C.

Read **actual C45 code** `runtime/application.ts`, blob `a0deff8a3b272019f472aa2f93499d1940a78370`:
- At 714–771 initial actor/snapshot/sourceDigest capture.
- At 782 generation outside initial transaction (intentionally).
- At 785–793 a new transaction re-authenticates principal/roles; rejects actor mismatch with 403, public source/version digest mismatch with 409.
- At 793–813 returns bytes only after the second gate; preserves HEAD and aborted signal boundaries.

**Corrected status of F92-EGRESS-01**: OPEN at C44 (historical finding remains true), SOURCE_CORRECTION_COMPOSED at C45, **NOT VERIFIED ON COMPOSED C45**. The source PR86 R1 50-pass witness, if independently verified, is for W/S of that source branch, **not a 50-pass on C45**. Recheck legacy 66 race, revoke, source-change, private drift/HEAD and cancellation on exact C; no automatic FINAL.

Other original findings/requirements do not vanish: WP14 registry persistence, original-key first-save87/UI52, C10/oracles, M31, auth72+59/85, transport74, Atlas restart/real scanner and global gates. Do not replace the original `FINDINGS92.json` snapshot; this file appends a materially new composition observation.

Owner 71/dispatcher45: bind real exact-C candidate/run evidence by deduplicated keys; R2 will independently recheck when C is explicitly frozen. No tests or CI dispatched here. **GLOBAL_RELEASE=false**.
