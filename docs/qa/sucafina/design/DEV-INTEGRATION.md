# Native Sucafina design — integration into dev

The user accepted the delivered second-wave result and instructed completion of the merge to dev. The [PR #583](https://github.com/gustavomhss/Orchestra-SF/pull/583) is the authoritative merge record for both design waves.

## Scope and acceptance

The delivery includes Today (UI29), Decisions/Cases (UI33), Executive dashboard (CAP01), Hot Topics (CAP02), Budget Overview (CAP03) and OPEX (CAP04). The first three retain their earlier explicit approval. After the second wave was shown, the user wrote “thats great work. Jam ergeou tudo?” and, after receiving the outstanding merge status, “Ja sabe o que fazr entao”. This records authorization to integrate the six-screen delivery, not a fabricated CI or reviewer approval. No golden-image baseline is asserted.

The inventory still contains 70 native Sucafina surfaces; 64 remain outside these two redesign waves. Legacy white/green UI and native HuGR core are outside the design scope.

## Exact composition

- Design delivery: `9bb8efc01acab2d0fdd1b5b5c598e1720a0293af`.
- Current dev incorporated: `761abac2f8ee4106db0347189ff304a4a79bf026`.
- Common ancestor: `bcdc109326de02e20c01c32ffb6b00bee3ff978d`.
- Verified integration product: `85ebc5bb5774f3c3bc5942465235e7eb1689ec88`.
- Integration product tree: `636f12ee75ae4bbbfcf174b0c347a72cb1204292`.

Dev's new commit is the installed CurrentChoice preview fix from #582. It changes 19 paths: 16 modifications and three additions. The redesign changes 132 paths from the common ancestor. Their intersection is empty.

Root and an independent read-only reviewer verified both directions:

| Comparison | Exact result |
| --- | --- |
| [Design delivery → integration](https://github.com/gustavomhss/Orchestra-SF/compare/9bb8efc01acab2d0fdd1b5b5c598e1720a0293af...85ebc5bb5774f3c3bc5942465235e7eb1689ec88) | All 19 upstream paths and blob SHAs match dev's delta; no missing, extra or different file |
| [Current dev → integration](https://github.com/gustavomhss/Orchestra-SF/compare/761abac2f8ee4106db0347189ff304a4a79bf026...85ebc5bb5774f3c3bc5942465235e7eb1689ec88) | All 132 redesign paths and blob SHAs match the delivered design delta; no missing, extra or different file |

The integration commit has the design delivery as first parent and current dev as second parent. Both tips are ancestors. No textual conflict resolution or source-file rewrite was needed.

The relevant runtime contact is the real host/business-service composition and LocalStore. The design journeys exercise that installation and its canonical producers. The changed Reports helper is not imported by the design harness.

## Fresh Actions verification

| Gate | Exact snapshot | Result |
| --- | --- | --- |
| [Both design journeys — run 44933847309](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44933847309), job 136936092807 | `795082a26dd90fd34c81163e3ed65d23d3a35f32` | **2 passed, 0 failed**, 4.7 minutes, 67 complete preview captures, zero preview skips |
| [Technical gates — run 44933852596](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44933852596), job 136936109695 | `b373e5d5519b6c3262dcdc58c41e075754fe4a98` | **4 passed, 0 failed**, 11 assertions; app and E2E types pass; 78 guards, zero errors and five advisories; seven palette files byte-identical |

Both snapshots are direct children of the verified integration product and add only their request and, for technical gates, the disposable verification wrapper.

The two exact Playwright selections were `e2e/sucafina/design-wave-one.spec.ts` and `e2e/sucafina/design-wave-two.spec.ts`, using `e2e/playwright.production.config.ts`. The 67 captures cover UI29 (8), UI33 (12), CAP01 (8), CAP02 (15), CAP03 (10) and CAP04 (14), including 16 Portuguese captures. All preview parts were present.

The [Actions artifact 14718614204](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44933847309/artifacts/14718614204) contains original screenshots and diagnostics: 84800045 bytes, digest `sha256:28f8c0e82530c590d63666b0093cf97244211184a8406289bf057f1f912540a2`, expiry `2026-11-28T18:14:34Z`.

All requests use the existing scoped `test-ci` workflow on Linux with strict Omni. The verification wrapper and `.ci-run.json` are confined to disposable snapshots. No workflow, guard, allowlist, permission, grant, source receipt or assertion was weakened.

The six focused confirmed-draft registry tests from run [44919739363](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44919739363) remain applicable: registry, contracts and test blobs are unchanged. No unrelated full suite or repeat of the already-qualified C17 campaign was needed for this disjoint integration.

## Evidence and boundaries

The original user-reviewed galleries remain preserved: [wave one](evidence/README.md) and [wave two](wave-two/evidence/README.md). The fresh integration run supplies runtime evidence for the composed product; it does not redefine historical screenshots or golden baselines. The final evidence/status commit changes documentation only, preserving the tested runtime and test code exactly.

The original [wave-two validation](wave-two/VALIDATION.md) retains detailed behavior coverage and limits. Narrow reflow is not actual browser zoom; this is not a claim that all 70 surfaces, all browser engines or every error state were tested. The five timeout advisories are documented; there are no guard errors or suppressions.

The merge decision is conditioned on the recorded successful integration gates and an unchanged dev base at the final check. The PR records its final head, merge commit and completion state.
