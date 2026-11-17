---
name: sf-import-user-qa
description: Act as Finance and an independent auditor in the Orchestra-SF XLSX import UI (QA2-003, SF-E2E-005, J03): upload, preview, reject stale versions, apply once, recover an original receipt after delivery loss.
---

# SF Import — upload, preview, one apply, recovery

**Load `sf-user-journey-qa` first.** Authoritative story: `docs/qa/sucafina/uat-cio/quality-v2/STEP-LEVEL-DOSSIERS.md#qa2-003`. Existing test witness: `packages/app-shell/e2e/sucafina/operations-support/imports.ts`. **Use the actual browser form**; this skill is not a replay of its API assertions.

1. **Sofie / Finance:** inspect the installed Planner version and destination; observe and record **USD 72,000** renewal and **USD 518,000** unchanged line. Bind actual line/version references rather than assuming fixture names equal persisted IDs.
2. Navigate via the app's **Imports** screen, choose a real authorized destination and upload `docs/qa/sucafina/uat-cio/fixtures/IMPORT-OPEX-VALID.xlsx` using a browser file chooser. Use it only if the current importer accepts this workbook and line identities; otherwise the precise parser/fixture mismatch is a blocker.
3. Click **Preview** in the interface. Verify one intended change 72,000→84,000, unchanged line remains 518,000, state `preview` and **no write** when rereading Planner via another authorized profile. Cancel once; confirm no effect and create a fresh preview.
4. **Second Finance / independent profile:** modify the source record through the permitted UI between preview and Apply. Return to stale preview and verify it **cannot commit**. Resolve the conflict via a new preview; do not change expected values to make a stale fixture pass.
5. **Sofie:** inspect the fresh preview and click its **Apply** control exactly once. For the *lost response after commit* case, use only an **already approved browser-harness route interception in the QA installation** (the existing Playwright import journey has a sample); the interception must let the real producer commit, then drop only delivery. Without that capability, run the ordinary Apply branch and mark only this fault-injection substep `BLOCKED_ENVIRONMENT`; never fabricate a network error.
6. Reopen the import through the visible history/receipt page and recover the **original manifest/attempt receipt**, then reread Planner and export. Verify exactly one effect, source renewal now 84,000 and unchanged line 518,000. Do not click Apply again to “see if it worked”.
7. **Negative:** use the adversarial XLSX only with explicit QA fixture approval; confirm validation/rejection and no partial commit. Replaying the original attempt with a different payload, if an installed UI supports it, must not duplicate the transaction; otherwise mark that particular negative step blocked.
8. **Evidence:** browser events/timestamps, file hash, admitted reference, preview manifest and digest, before/after versions, each actor's identity, original Apply attempt, recovered receipt, verified export and any real denial. Redact tokens and identity data; save outside Git.

If the importer rejects an upload with 403/422, first distinguish **legitimate denial** from an **authorized Finance journey failure**; never rewrite an oracle from 200 to 403 or call an internal transport directly to bypass the UI.
