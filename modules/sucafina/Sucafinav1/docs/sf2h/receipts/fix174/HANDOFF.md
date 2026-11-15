# Missão 174 — A02 Planner typed surface catalog (handoff)

**Status:** ARTIFACT_READY_UNINTEGRATED. **Epoch:** `native-fix-e1-browser174`; **branch:** `sf-ux-w15`, **PR:** #116 to `sf2-stack`. Effective model GPT-6, GitHub actor gustavomhss, session ID not exposed. `GLOBAL_RELEASE=false`; native Goal paused.

**Root cause:** compiler163 run 43766055614/job 132971280139 on product W 690a34c detected TS2322 at `planner.ts:250` and 22+ TS2345 variants. The generic parameter P was unanchored at its callsites; `keyof CommandValues[P]` collapsed to common `import-workbook`, and `CommandValues[P][A]` was not provably an Effect schema `Top`.

**Implemented source-only correction:** Capability `CAP17…CAP23` is the first literal argument to `legacyInput`; selected page maps to the same seven canonical legacy names; action is constrained by `keyof CommandValues[capability]`; concrete `Values extends Schema.Top` is intersected with that selected action schema. All 29 source-locked callsites now pass explicit capability, action and the unchanged exact schema. No `any` / casts / strings-as-action / permissive schema / test weakening.

**Source preimage:** `8ecb147aacd13e089ee0a39824fc823e9801bd41` at `056f1ac648466630a276cc2d7977ebcf70bfdbff` tree `9017930ad69e3c48a55a5d4ecd2217d1c89cd1fb`. **Source postimage:** `0a85a3f33bc384196100ee75c974102e04f9868a`. **Consumer preimage:** sf2-stack `913b6b8f143e6c3e869eee293d02f04259c7cdd1`, tree `99d4788774ce548d4cd64a96c0f2481db1fb15eb`, blob `8ecb147aacd13e089ee0a39824fc823e9801bd41`. **Consumer postimage:** NOT_YET_INTEGRATED, 162-owned. [Exact patch](./PATCH-162.md), [machine evidence](./EVIDENCE.json), [requests](./REQUESTS-163-164.json).

**Acceptance mapping:** A02-AC01 unchanged concrete values/0/null/versions; A02-AC02 action now keyed to exact capability with unchanged schemas and strict fieldsets; A02-AC03 unchanged page/action, versions and current Request/transport; A02-TSV unchanged 0..11→1..12 and original host CAS/preview/apply. All require hosted qualification before PASS. Exactly-12 array checks and 133 isMinLength/isMaxLength fixes preserved. 190 source constraints untouched.

**Actual previous runs:** 163 compiler FAIL old W 690a34; 164 Planner 11 PASS old W 690a34, but decisions source import blocked and later unrelated browser lanes failed on W 6d42. No new run and no local test/typecheck/parser/build/validator; **NOT_RUN for this new blob**.

**Handoff:** 162 sole integrator must reconcile HEAD + preblob and adopt this released file exactly; no shared seam modification required. After 162 integrates, 163 owns scoped package typecheck/SDK/guards; 164 owns the existing hosted Planner test. Do not dispatch identical failed inputs, expand suites, merge/deploy/restart, or declare native Goal/release.
