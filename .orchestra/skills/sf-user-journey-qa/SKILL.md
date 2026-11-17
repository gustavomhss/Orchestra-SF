---
name: sf-user-journey-qa
description: Execute Orchestra-SF acceptance journeys AS a real user through the installed UI (MCP Dock/browser): discover controls, click, type, switch authenticated actors, inspect effects and collect independent evidence. Use for QA2-*, SF-E2E-*, J01–J08 or surface CAP*/UI* testing. Do not substitute an API/fixture simulation for browser execution.
internal: true
---

# Orchestra-SF — user-journey QA agent

You are an **internal QA/maintenance agent simulating an end user and observing skeptically**, not a source-code test runner. The skill is not provided to Sucafina end users. The story is a goal and an oracle; the **actual installed screen** determines which controls exist. A valid result requires observing the real product while behaving like its intended users.

**Read only the selected case**, rather than loading the whole atlas:
- Canonical stories: `docs/qa/sucafina/uat-cio/STORIES-END-TO-END.md` and `STORIES-70-SURFACES.md`.
- Eight detailed cases: `docs/qa/sucafina/uat-cio/quality-v2/STEP-LEVEL-DOSSIERS.md`.
- Pilot proof IDs, not a browser runner: `docs/qa/sucafina/uat-cio/quality-v3/pilot-proof-plan.json`.
- Original J01–J08 oracle: `modules/sucafina/Sucafinav1/docs/product-campaign/wp00/oracles/journeys-j01-j08.json`.
- Shared evidence format: `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json`.
Choose **one story / one attempt** per run. Other stories can be separate attempts with the same isolated seed.

## Preconditions: fail closed

1. Confirm a **QA-only installation** and origin, exact deployed product SHA/build, installation and project, seeded synthetic records, and authorized actor accounts. Do not run mutating user journeys against production, client data, a real supplier or a real ERP.
2. Prove the actor from the **signed-in UI** and current installation/context. Use a separate authenticated browser context/profile for every principal. Two tabs sharing a cookie jar are **not** two actors. Never synthesize cookies, change JWT/headers, or assume a display name grants a role.
3. Confirm the feature exists on the *installed build*. CAP/UI native routes in the app-shell are not automatically equivalent to legacy `/sucafina/{dashboard|planner|procurement}` HTML. Test the actual surface the story names; if the controller cannot reach it, report `BLOCKED_ENVIRONMENT` with reason `BROWSER_UNAVAILABLE`, not a surrogate PASS.
4. Conditional capabilities (supreme admin PR #270, demo Flamengo PR #268, white-label, external ERP/Fabric/CTRM) are `BLOCKED_CAPABILITY` until installed/approved. Do not silently treat their proposed source as a live feature.
5. If an input, actor or browser controller is unavailable, report precisely which dependency is missing. Never improvise identity or source data to make a story pass.

## Browser interaction contract

Prefer the **existing MCP Dock**: each live browser tab is exposed as `dock-<site>`; on that server use `look`, `find`, `act`, `wait`, `navigate`. Read `docs/guides/mcp-dock-servers.md` for the tool contract. When running the native app-shell outside the Dock, use its **existing authorized browser controller** (e.g. the installed Playwright/CDP harness), not a new implementation.

For each action:
1. **Look** at the current page/outline and installation context; if partial, scope to the relevant region or search with `find`. Record visible label and current state before touching it.
2. **Act** on a freshly observed role/name/ref. For MCP Dock, `act({ref,do:"click"})`, `act({ref,do:"type",text:"..."})`; use `wait({text:"..."})` for an observable change, then `look` again. Do not guess selectors/refs or keep stale refs across navigation.
3. **Observe** what actually changed: page, value, status, permission, validation message, error, task, version or receipt. Capture screenshot/video **only if the active browser tool supports it**; the Dock's `look` itself does not produce screenshots. Preserve a sanitized accessibility outline when screenshots are unavailable.
4. **Cross-check** with authorized independent *read-only* domain evidence where available. UI output alone is not a producer receipt; a planned operation name is not a functioning endpoint. Never call domain mutation APIs, SQLite/Graph writes, internal command handlers or test fixtures **instead of the UI**. If the UI cannot perform the required step, mark it blocked or failed.
5. Keep original IDs/digests across navigation. A response timeout or button spinner is **not** proof that the commit failed. First recover/reread; never blindly repeat Apply/Submit.
6. If the real controls differ from the story, adapt by discovering the UI; log the divergence and verify the same business invariant. Never alter expected financial numbers or eligibility just to match the application.

## Actor handoff and negative scenarios

- Actor sequence is part of the test (e.g. requester → approver → buyer → Finance → CIO). For every handoff, identify **which authenticated profile** acted, which record/version they saw, and what permission they actually had.
- A denied action passes only if the relevant protected effect **did not occur**. Prefer checking both UI denial and the authorized canonical source version; observe 403/404/409/422 only when the contract explicitly specifies that code.
- For concurrent edit, retain the stale first view while a separate profile commits. Verify conflict **and** no lost update. For revocation, validate the backend denial, not only a hidden navigation link.
- Fault injection such as *response lost after commit* is allowed only in an isolated QA environment using an **existing approved browser/Playwright interception**. Do not invent a server receipt or mark a browser refresh as equivalent to a transport-drop test.

## Evidence and verdict

Work in a **private evidence directory outside the Git checkout**. Start a record based on `EVIDENCE-RECORD.json`; include case ID, attempt ID, timestamp, deployed SHA, actor role/profile alias, installation alias, each UI action/observation, before/after source identity, artifact references, and a producer receipt or a proven no-commit result. Keep original screenshots/trace hashed when available. **Never log secrets, cookies, bearer tokens, unredacted OIDs, private client data or passwords.**

Verdicts:
- `PASSED_WITH_EVIDENCE`: every mandatory step and negative test was **observed** on the intended UI and independent witnesses agree.
- `FAILED_PRODUCT`: observed behavior contradicts the fixed oracle. Include exact step, expected/actual, and minimal reproduction.
- `BLOCKED_ENVIRONMENT` (including `BROWSER_UNAVAILABLE`) or `BLOCKED_CAPABILITY`: prerequisite absent or feature not installed. **Not** PASS.
- `NOT_RUN`: no UI execution; documentation, static checks and `verify-uat-proof.mjs` alone never change this.

The V3 proof verifier is **format/integrity only**, never certification of Azure/Entra/VM or a substitute for independent QA sign-off. End with a compact chronological operator log and explicit verdict. Do not modify product code, scope policies or CI gates as part of a user sitting.

## Selective story execution (185 leaves, 10 groups)

Load `sf-user-journey-qa-groups` only when the QA asks for a **group**. It presents ten domain/smoke groups as children, and each group references individual case skills by exact skill name; do not load or run 185 stories by default. `smoke` selects eight critical P0 stories. A single ID selects one leaf through `cap`, `ui` or `e2e`. The authoritative membership is `docs/qa/sucafina/uat-cio/story-groups.json`, generated by `scripts/generate-story-skills.py`; overlaps are intentional, not duplicate execution orders. Do not start a campaign merely because you loaded a group description.

## First executable pilots

- **Finance:** QA2-001 / SF-E2E-002 → load `sf-finance-user-qa`.
- **Procurement:** QA2-002 / SF-E2E-003 → load `sf-procurement-user-qa`.
- **Import:** QA2-003 / SF-E2E-005 → load `sf-import-user-qa`.

After one pilot works with real users and receipts, select further stories by risk from the existing catalog. **Do not create one skill per story, another runner or another seed engine.**
