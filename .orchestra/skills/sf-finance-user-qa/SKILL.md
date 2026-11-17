---
name: sf-finance-user-qa
description: Play Finance, Budget Owner and CIO as distinct real users to execute Orchestra-SF forecast/planner UAT (QA2-001, SF-E2E-002, J02), using visible UI forms, version comparisons and independent money oracles.
---

# SF Finance — actually use the planner

**First load `sf-user-journey-qa`**; its browser, identity, evidence and stop rules are mandatory. Story: `docs/qa/sucafina/uat-cio/quality-v2/STEP-LEVEL-DOSSIERS.md#qa2-001`; proof plan: `quality-v3/pilot-proof-plan.json` relative to the UAT folder. This skill gives the LLM the **user's intent**, not a hidden API script.

1. **Sofie / Finance:** sign into the QA installation; inspect *Planner → Versions/OPEX* and the source's actual version, year, currency and lock state. From the UI, record the official USD 590,000 outlook, USD 600,000 budget and the license line USD 72,000; verify that these fixture values **exist** before continuing.
2. **Sofie:** create a separate *What-if A* using the visible version controls; change only the license line to USD 84,000 through the editable form, save, return to the list, and reread A. The source baseline must remain unchanged.
3. **Budget Owner:** in an **independent authenticated browser profile**, create *What-if B* from the same original baseline (not from A); change only the line to USD 78,000. Reread B and both version identities.
4. **CIO:** open Dashboard/BI/planner comparison through the real navigation. Verify **A = USD 602,000**, **B = USD 596,000**, deltas against official +12,000/+6,000 and margins against budget −2,000/+4,000. Recompute independently in **integer cents**, using the original unchanged non-license component, not the UI's own delta.
5. **Negative:** attempt an edit of official/locked using a genuinely unentitled actor; assert no source change. For a stale-version attempt, leave one browser on the old revision while the other saves, then check conflict and draft retention. An EUR line without permitted FX must show unavailable/incompatible, **not zero**.
6. **Evidence:** identity on each profile, visible edition/version selection, old/new values, saved UI state and authorized source reread, rejection and no-commit witness. If a version or permission is missing, report the **exact blocker**, not fabricated totals.

Do not use Planner HTTP writes, SQL or a copied producer calculation to manufacture the result. Continue to next step only after observing the prior one. **Do not publish a scenario as official or modify real Finance data.**
