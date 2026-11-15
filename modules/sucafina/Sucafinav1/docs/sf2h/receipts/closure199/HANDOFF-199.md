# Closure 199 — F04 installed host consumption + D01 packaged desktop

**Status:** COMMITTED_CODE_READY; real installed-host and D01 execution **NOT_RUN**, no PASS, no release. **PR:** https://github.com/gustavomhss/Orchestra-SF/pull/190 (sf-installed-host -> sf2-stack).

**Epoch:** native-closure-e1-browser199 · **integrated product base:** 6607c60d2a2be183d59c2e929b3ff06633e1cb54 · **original reserved HEAD:** 587a4a8c632a2a510c5992cac226743ddcff6caa · **code head before receipts:** 4854c466b94492ca690f8f1d0f91cfbdbdcdefa6 · **planning:** dbf9547211d9b0fade619790de7c19c0869b7c7d · **UX:** cbac654784714f68779ae1434d30e6ea8970c4d1.

**S0-FENCE/ACK:** S0-FENCE at prepared tree confirmed before writes; ACK 59642460dafca7ca5874f0fd03a567233b88c564; every branch move expected-head CAS, force:false. Effective model GPT-6; session ID **not exposed**.

## Exact provenance and pre/post blob ledger

All seven F04/187 files imported byte-for-byte from 187@96c01020db59d9b4f8d44300638418d67ee11fea on integrated preimages (closure-import commit 7617fbfba203ee3d4c15cd91a18620e5ca468932). Five files remain exact; fixture.ts was extended afterward. New files had no base blob.

| Authorized path | Pre blob | Post blob | Consumer / behavior |
|---|---|---|---|
| packages/app-shell/e2e/sucafina/native/fixture.ts | d699d74f092a8211fde2611c827ed4ebd83a9274 | a67dfce9c79309b182bb25100eeb2a51e49d9a3b | F04 exact imported, then real hosted Playwright worker/context override |
| packages/app-shell/e2e/sucafina/native/fixture/readiness.ts | bcea1fd620ba76dc24cc8bab159a91662c9b876e | 3cbd63012f43c43bbbe3d2c66c03fd2ded6343f9 | original F04 live actor/context/discovery checks |
| packages/app-shell/e2e/sucafina/native/fixture/scratch.ts | 75181ca2d425dd71b9fb032773be16e48883c775 | 0f2463a8e6dcc201f5a8a630172e3d88c7bb3d91 | exact 187 scratch, no guard bypass |
| packages/app-shell/e2e/sucafina/native/fixture/response-faults.ts | abfa55b1e87622ecee4fdbb1ca962b35039dd326 | 71adbaaf679331a5a201aae663123ba87bc4a0b5 | F04 real fault injection unchanged |
| packages/app-shell/e2e/sucafina/native/fixture/installed-manifest.ts | NEW | bc84476891d97e7baad4f6462933c60688c11847 | exact 187 private manifest writer |
| packages/app-shell/e2e/sucafina/native/fixture/journeys.ts | NEW | 66e269a78af8262764228557e2eeccd29bca1a36 | exact 187 canonical installed CAP14/04/05 helper |
| packages/app-shell/test-browser/sucafina-native/fixture/journeys.test.ts | NEW | 238d8329bc5677cdc98b9fa238426783bf4add65 | exact 187 pure helper tests; NOT_RUN |
| packages/app-shell/e2e/sucafina/native/fixture/installed-browser.ts | NEW | 567ef2bf1d472e248468ad4eed93ead751aaaa22 | existing hosted CDP and distinct real Microsoft contexts |
| packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts | NEW | 7a85a85d13895ce7e1a95c543f1b3a8f13757582 | private U15/U39/U40 F01 selection and original producer CAS/permissions read/recheck |
| packages/app-shell/e2e/sucafina/native/integrated-proofs/d01/desktop-host.ts | NEW | 1a6f2081664db3da72554df46fe347ae7a616352 | packaged executable path/sha + build/test run provenance |
| packages/app-shell/e2e/sucafina/native/integrated-proofs/d01/packaged-electron.spec.ts | NEW | 2925ff518a78c2034f855561589f504b9ca7e48b | real packaged Electron broker/partition/login/logout scenario |
| script/sf2h/proofs/installed/register.ts | NEW | 5fa9b5d1c82a9a70ea6351f4403b8854a64a2296 | host adapter registration, rollback on failure |
| script/sf2h/proofs/installed/consume.ts | NEW | ce5191c0217cc581ee4258cc244ca146e1d42f06 | real per-suite pre-run read/CAS revalidation |
| script/sf2h/proofs/installed/attest-d01.ts | NEW | 97bde2fea8f707aafebf7bd408a21bc43bfaa4d3 | hosted private packaged provenance/sha writer |
| script/sf2h/proofs/installed/README.md | NEW | 726b6cb98e697d4c583fa72e8289debf74258a5e | exact 191 +194/195 host interface contract |
| modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure199/ACK.json | NEW | a448b0b626801cff57df3178df8dab39e75160a5 | ACK published before first write |
| modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure199/EXTERNAL-DEPENDENCY.json | NEW | a02fb1acfd5af132c8f3a6a71311478fe896444f | sole external dependency record |
| modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure199/INERT-189-PLAYWRIGHT-PRODUCTION.patch | NEW | 659e9b958bb59904a526de212cd9483cd975f35b | 189-only inert complete full pre/post config patch |

The 189-owned shared config was **not edited**; its current preimage is e2b615a50c3907bbe21fd6158be47fcebf477679. The full inert replacement diff with complete pre/post is INERT-189-PLAYWRIGHT-PRODUCTION.patch. Scratch remains the 187 exact blob; 188 must resolve its causal guard without rename/bypass.

## Implemented behavior — no fabricated pass

**F04:** private 0700 root, 0600 manifest/CDP files, existing hosted CDP browser and distinct real Microsoft BrowserContexts; exact signed-in principal against original installation/context producer; real approved registry and per-case F01 SfResolvedRoute; capability / operational status, current policy/access revision and original source record/CAS version revalidation; U15 five registered case selections (six tests, list reused for responsive), U39/U40 single suite selection each (three UI tests per suite). Two genuine editor principals required for stale CAS, denied actor must lack CAP14 read. All private and fail-closed.

**D01:** exact candidate packaged executable hash and runner provenance with source build run preserved, actual Playwright Electron process / isPackaged, original preload/main broker, real Microsoft login window, dedicated Electron partition and defaultSession cookie-count negatives, original ctx.context via broker, false-owner attempts, logout purge and stale request failure. A hosted descriptor or a web run never proves D01.

**No tests, typechecks, builds, validators or workflows were launched** by this mission. No Azure/desktop/Orchestra server restarts, no guard/engine/allowlist writes, no cookies/tokens/credentials/principal IDs in public receipts. Actual runtime behavior requires the 191 hosted run.

## Exact blockers and consumer actions

Single canonical record: EXTERNAL-DEPENDENCY.json. 191 must supply the approved already-running browser, real F01/registry callbacks and Microsoft sessions, isolated suite-scoped roots, original domain producer, correct candidate SHA, and verified packaged Electron artifact + build/test provenance; then select actual U15/U39/U40/D01 specs. 189 must wire existing createSfDesktopBroker in packaged main with genuine operation codecs/ownedConnection/enrollment providers and apply the inert config patch, otherwise D01 cannot pass. 194 must replace default Playwright test with nativeInstalledFixture in its U15 spec, keeping all six cases; 195 consumes existing nativeInstalledFixture. 188 retains causal scratch guard responsibility.

**Surgical selectors to 191** (do not dispatch without accepted bundle C): packages/app-shell/e2e/sucafina/native/journeys/u15.spec.ts (CAP14/U15), packages/app-shell/e2e/sucafina/native/journeys/u39.spec.ts (CAP04/U39), packages/app-shell/e2e/sucafina/native/journeys/u40.spec.ts (CAP05/U40), packages/app-shell/e2e/sucafina/native/integrated-proofs/d01/packaged-electron.spec.ts (D01), and packages/app-shell/test-browser/sucafina-native/fixture/journeys.test.ts (pure helper selection). Run IDs / PASS require actual 191 run receipts at candidate SHA; mission 199 asserts none.

**Ownership:** 189 sole sf2-stack integrator PR65; 190 compiles PR107; 191 sole CI PR106; 194 U15 PR153; 195 U39/U40 PR150; 188 guard. Comments are notices, not ACK, not chat wake, and not CI dispatch.

**GLOBAL_RELEASE=false. Goal native PAUSED. No merge into dev.**
