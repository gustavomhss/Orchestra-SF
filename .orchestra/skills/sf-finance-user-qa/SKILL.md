---
name: sf-finance-user-qa
description: Play Finance, Budget Owner and CIO as distinct real users to execute Orchestra-SF forecast/planner UAT (QA2-001, SF-E2E-002, J02), using visible UI forms, version comparisons and independent money oracles.
internal: true
---

# SF Finance — actually use the planner

**First load `sf-user-journey-qa`**; its browser, identity, evidence and stop rules are mandatory. Story: `docs/qa/sucafina/uat-cio/quality-v2/STEP-LEVEL-DOSSIERS.md#qa2-001`; proof plan: `quality-v3/pilot-proof-plan.json` relative to the UAT folder. This skill gives the LLM the **user's intent**, not a hidden API script.

1. **Sofie / Finance:** sign into the QA installation; inspect *Planner → Versions* and record official `versionRef`, year and lock; *Dashboard → Budget/OPEX* is a separate annual/monthly projection without a plan-version selector. From the UI, record the official USD 590,000 outlook, USD 600,000 budget and the license line USD 72,000; verify that these fixture values **exist** before continuing.
2. **Sofie:** create *What-if A* via *Planner → Versions → New/Copy* when admitted; record source-assigned `versionRef`, select it in *Planner → OPEX*, change license to USD 84,000, save and reread by the same ID. No Dashboard write substitutes for a scenario. The source baseline must remain unchanged.
3. **Budget Owner:** in an **independent authenticated browser profile**, create *What-if B* by New/Copy of the same official baseline, not A; select its distinct `versionRef` in Planner OPEX and change the line to USD 78,000. Reread both IDs.
4. **CIO:** open Dashboard → Budget/OPEX for year-only baseline, then Planner → Versions/Compare and OPEX by recorded versionRefs for A/B/official. Do not claim WHATIF or lock controls on Dashboard. Verify **A = USD 602,000**, **B = USD 596,000**, deltas against official +12,000/+6,000 and margins against budget −2,000/+4,000. Recompute independently in **integer cents**, using the original unchanged non-license component, not the UI's own delta.
5. **Negative:** attempt an edit of official/locked using a genuinely unentitled actor; assert no source change. For a stale-version attempt, leave one browser on the old revision while the other saves, then check conflict and draft retention. An EUR line without permitted FX must show unavailable/incompatible, **not zero**.
6. **Evidence:** identity on each profile, visible Planner versionRef selection distinct from Dashboard year, old/new values, saved UI state and authorized source reread, rejection and no-commit witness. If a version or permission is missing, report the **exact blocker**, not fabricated totals.

Do not use Planner HTTP writes, SQL or a copied producer calculation to manufacture the result. Continue to next step only after observing the prior one. **Do not publish a scenario as official or modify real Finance data.**
