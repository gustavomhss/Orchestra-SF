# Independent source review — WP11 C12 fixture intake

Reviewed the two fixture decisions in `c12-fixture-intake.json`, without executing tests. Canonical Finance source was read independently through GitHub MCP at `981ad44102b2e2e67d31bfc8fb7d97208e390e5b`; local candidate bytes were hashed and compared with those returned source blobs and the prior Operations bytes.

| Fixture | Before Operations blob | Canonical Finance blob | W2 result blob |
|---|---|---|---|
| `wp11/prepared-apply.test.ts` | `eead54159fe2e6c56da3a4ba3fb8e09bf802c309` | `3d1380e7aaacd894d082fdeb06cfaaa51bf92dbb` | `3d1380e7aaacd894d082fdeb06cfaaa51bf92dbb` |
| `wp11/planner-apply.test.ts` | `cd5a0de4a3af51f064b69b538d5a619d09f3ebdc` | `bd5ca7d9c9451ef677ad8656d4504d5409eb67ce` | `160df21d7dd44109c392cf213680629b6c26d450` |

## Prepared application fixture

The result is byte-for-byte the canonical Finance fixture. Its only differences from the old Operations file introduce a mutable test digest, supply `reviewDigestFor`, explicitly withdraw the test human flag before retrying the recorded application, and assert `idempotency-content-changed` when the digest changes. Existing application, domain mutation, receipt lookup, wrong-command conflict and exact replay assertions remain. The withdrawal strengthens the recorded-receipt replay scenario; it does not relax first-application admission. The fixture's literal 64-character digest and Boolean human premise are component inputs, not proof of production human/native admission.

## Planner fixture

The result differs from the canonical Finance file in exactly one existing Operations line: all three surfaces (`dashboard`, `planner`, `procurement`) are initialized instead of just Planner. Against the previous Operations file, the sole change adds Finance's `reviewDigestFor` callback. The prepared command, stale-source scenario, physical target identity, human gate, receipt and replay assertions remain unchanged. The shared persistence fixture retains the prior WP04 initialization necessary for the composed source projector. No owner assertion or Operations scenario was dropped.

## Required hosted proof

No conflict-resolution defect or lost assertion was found. These fixtures changed materially for the new producer callback, so old W1 test passes do not qualify W2 bytes. Both files require their planned surgical hosted execution for the exact final candidate. W2's all-check run `43580277793` failed for the owned Procurement context type plus separate WP11 `case-port` and WP14 Atlas fixture consumers; this review does not convert that typecheck result into acceptance.
