# W22 — owner output probe

**Sealed data archive. Root selected only the five-file renewal closure for its separate intake24.** This builder did not modify repo, remote refs, foreign sources or prior receipts and executed no product code.

## CHECK and freeze results

PR32 `9048e0e65351a5bd80768458a79fed94a4993db7` versus `f9990ecc7ade0d64122633d51258ddafe2c93802` has no change to any of the thirteen W21 failing diagnostic paths. Its `freeze-v1.json`, `contracts-v1.md` and `contract-freeze.test.ts` are exact bytes of the current published cohort. Static hashing remains **37/38**. The only mismatch is the CLI host: expected `6a608e24847fe730b645d5f51f86e47d83e803875162820038e0c05d18f96772`; current W21/W22 host `42839b627194c59febff34052b813a6e4725414dcf84c8308397539b734b3893`. No replacement freeze for that host was found at the requested pin.

PR35 `ec052c2c3bef96f492512f3d5f663919580f25c8` versus `c449efc092e507fca2b4f61d1e7ce057faf05c89` publishes nine TypeScript deltas. None directly changes a W21 failing diagnostic path. The exact fetch of `wp09/decision-answer-consumer.test.ts` at this PR35 commit returned **404**; its existing composed source is preserved. This probe does not close any of the thirteen CHECK diagnostics.

## Selected renewal closure

All five files come from PR35 `ec052c2c3bef96f492512f3d5f663919580f25c8` / tree `ec517fa26571228bc1ce5e3698fcfc9c5d137ae3`:

| File | Exact Git blob |
|---|---|
| `port.ts` | `8389709232225424b5905638d0951d8cdbb71dd7` |
| `renewal-operation-verifier.ts` | `df3c335c95bf9d8d06d00474ff0bc391dd852b4e` |
| `renewal-choice-fixture.ts` | `2da82bf379910826f4558b5b330c97cdaf6806df` |
| `renewal-source-admission.test.ts` | `4a5780b82989b9e8c3437bb3758779d7cfb76733` |
| `renewal-case-read-scope.test.ts` | `75a2cbcd0c3907fc2d14f18f2b35f131331ecfb2` |

Planner `plannerSourceActor` is an extraction of the previous actor construction. The renewal verifier uses that canonical mapper and projector for real source-only admission, with two projection/source observations. Nonempty scenarios retain the canonical operation verifier. The grouped case adapter opens one immutable readonly snapshot per invocation, awaits all siblings and keeps the final asynchronous authority call inside the scope. No proof, authorization result or pending Promise is shared across invocations.

The history fixture now binds this case adapter. Its separate DomainProjection observation uses sourcePlanner; financial/C10 calculations are not replaced. The two new whole-file tests cover standalone source/admission races and grouped no-write, swallowed nested write, changed source on a later invocation and callback revocation. D expands from16 to18 files; no budget changes. Existing D renewal history, coverage sensitivity and reconciliation price consumers remain selected. No new R-specific test is needed for this bounded closure.

`renewal-restart-reader.ts` is exact blob `3086ebdaf8049ab38cc0855934389bdec3f251c8`, unchanged at the new pin. It still calls the per-scenario verifier via Promise.all. The owner's two grouped consumers are history and human-choice; no grouped restart performance claim is made.

## Held CurrentChoice group

Finding **W22-OWNER-CURRENT-CHOICE-FINAL-LEASE-01** is **static, unexecuted and pending owner review**. The proposed CurrentChoice read adds a final awaited C08 state read, then checks byte equality and abort state without an explicit final private-lease/requestFor check. Real composed C08 authenticates principal/namespace separately from the UI call lease. A lease ending during that final await with unchanged Request/principal/state is therefore a boundary requiring a composed counterproof. This is not an observed hosted failure.

The new test folds `ui.revalidate(context)` into its C08 authorizer and tests membership/preferences changes while the lease remains live; it does not qualify that host boundary. The producer also adds REQUIRED `verifySources`. Its two archived owner tests supply it. The complete hydrated W21 product/CLI namespaces have no production invocation; broader unhydrated tests were not claimed exhaustively searched. CurrentChoicePreview, its two tests and the independent human-choice fixture remain archived and excluded from the five-file intake.

## Provenance and limits

`proposal.json` contains exact paths, blobs, SHA256 and existing W21 tree entries. `import-closure.json` verifies68 relative import edges with zero unresolved paths against selected blobs or exact W21 dependencies. The five new paths among all nine deltas were verified absent from the full18,890-entry W21 tree and independently returned404 at the W21 commit. Local hydration absence was not used as proof of novelty.

All beforeBlobs and saved diffs remain anchored to W21 `532da498e08fa36fadbd3c01e3e7da00d869dd47` even when root subsequently copies its selected bytes into repo. Downloaded content uses immutable GitHub MCP refs and base64; every Git blob hash was recomputed. PR bodies, compare responses, source bytes, owner receipts and404 responses are archived.

Hosted CHECK and affected whole-file CI remain required on W22. Owner S25/S26 and any W21 B results stay bound to their respective SHA; no result transfers to the new Planner producer. This is a builder inspection, not an independent review or native/global acceptance.
