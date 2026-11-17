---
name: sf-procurement-user-qa
description: Behave as the actual requester, buyer, holder approver, Finance and CIO in Orchestra-SF procurement (QA2-002, SF-E2E-003, J04): PR→quotes→sourcing→PO, with eligibility, FX and role-denial checks via the real UI.
---

# SF Procurement — buyer, requester and approver sitting

**Load `sf-user-journey-qa` first**, then read only `QA2-002` in `docs/qa/sucafina/uat-cio/quality-v2/STEP-LEVEL-DOSSIERS.md`. No direct domain/API write or backend `act()` call may replace a browser interaction. Each named actor requires an independently authenticated QA profile.

1. **Caio / Requester:** from actual Procurement *Requests*, create a synthetic requisition for the EDI shipment-data integration, estimated **USD 32,000**. Submit from the screen; capture generated PR reference and the displayed pending holder, stage and revision. Do not invent a PR number.
2. **Gabriel / current holder:** switch profile, verify identity and see the assigned request in *My approvals*. Approve only if the UI and current domain holder confirm he is entitled. Verify the PR transitions into sourcing. An approval by another role or a self-approval is not acceptable.
3. **Pedro / Buyer:** open this exact PR, register sourcing with three fixture offers: **A: USD 32,400 eligible; B: EUR 28,000 eligible at EUR→USD 1.08; C: USD 29,000 technically ineligible**. Resolve actual supplier references and statuses through the product; do not inject quote JSON into hidden endpoints.
4. **Sofie / Finance:** inspect the actual FX policy/version *as shown by the current product*. Only proceed with the **USD 30,240** comparison if the installed fixture really supports the specified 1.08 rate; otherwise report `BLOCKED_FIXTURE` under `BLOCKED_ENVIRONMENT`. C cannot win on price because technical eligibility is a hard constraint.
5. **CIO:** if decision Case UI is installed and authorized, compare alternatives and make a **human choice** with an explicit reason. A case choice is **not** a PO approval and must leave the producer unchanged until the next authorized action.
6. **Pedro → Gabriel → Pedro:** submit sourcing, secure the current holder's stage-specific approval, prepare/submit PO, obtain current holder approval, and issue **internally** using the real UI. After *every* handoff reread stage, version, holder, audit and receipt. Do **not** interpret internal issue as delivery to ERP or supplier.
7. **Contraprovas:** Pedro tries to approve Gabriel's assigned stage through his own signed-in session (including direct navigation if admitted by the UI); C is rejected by eligibility; a supplier becomes blocked or FX changes between review and submit; stale revision/replayed apply produces no extra PO. Observe the refusal and corroborate **no commit** by authorized reread. Do not mutate Entra groups to create the denial.
8. **Evidence:** actor-by-actor browser log, PR/PO references, quote eligibility, effective FX timestamp, stage graph observed, approvals linked to holders, receipt count, original-retry linkage and screenshots/outline. Preserve sanitized private evidence outside Git.

Oracle money math uses **integer cents**: EUR 28,000 × 1.08 = USD 30,240. The exact scoring display must derive from observed supplier criteria, not fabricated 87.9333/85 numbers. If any transition lacks a usable UI, stop with `BLOCKED_CAPABILITY` or `FAILED_PRODUCT`; **never shortcut to the backend to finish the story**.
