# PR closeout 1-120

Candidate `origin/close-final-candidate` `a63c4c733523294450f605e73de3306edff81e58`.

Close test was blob equality. Not ancestry. Not `git diff base...head`. For each PR still open in range: `gh pr view`, `git fetch origin pull/N/head`, `mb=$(git merge-base origin/close-final-candidate FETCH_HEAD)`, files from `git diff --name-only $mb FETCH_HEAD`. An empty list is absorbed. Otherwise `git rev-parse FETCH_HEAD:path` must equal `git rev-parse origin/close-final-candidate:path`. A side that lacks the path is `MISSING` (`does not exist` or `exists on disk, but not in`). Closed only when every file had the same token. First differing path left the PR open. #237 not touched. #13 #17 #65 skipped.

A concurrent supersede pass had closed many of these with `Superseded by the bundle merge on close-final-candidate a63c4c7335`. That comment is not this test. Differing PRs from that pass were reopened. #2 is a Dependabot PR whose head branch `dependabot/bun/npm-9e993f0168` is deleted; GitHub refused the reopen (`state cannot be changed`). A later tree-diff pass (`git diff --quiet` of the whole head, not the changed-file list) reopened #16 and also reopened skipped #13 and #17. #16 was closed again: its two changed files match. #13 and #17 were not touched. The required close comment on #16 was blocked by GitHub's secondary rate limit; the close itself is confirmed CLOSED.

Closed 1 (#16). Left open 102. Reopen refused 1 (#2). Not open at start, left untouched: 1, 4, 5, 6, 7, 8, 9, 10, 11, 15, 18, 19. No PR 111. Skipped 13, 17, 65.

#1 NOT_OPEN CLOSED
#2 LEFT_OPEN DIFF files=22 path=`apps/cli/package.json` head=`5add2b8726c425613c83e110d9da0c08adbc19fe` candidate=`8da3d31f6fbb4888221dbf69088690b168597f8e` REOPEN_REFUSED branch-deleted
#3 LEFT_OPEN DIFF files=227 path=`.github/inherited-workflows/artifact-native.yml` head=`d18645ea4a9888998d188ea7012542b1bd310818` candidate=`MISSING`
#4 NOT_OPEN MERGED
#5 NOT_OPEN MERGED
#6 NOT_OPEN MERGED
#7 NOT_OPEN MERGED
#8 NOT_OPEN MERGED
#9 NOT_OPEN MERGED
#10 NOT_OPEN MERGED
#11 NOT_OPEN MERGED
#12 LEFT_OPEN DIFF files=13 path=`.github/workflows/azure-mvp.yml` head=`23ef076ac8561e08ded2b0289dc40daf98d1df8d` candidate=`MISSING`
#13 SKIP already closed
#14 LEFT_OPEN DIFF files=29 path=`docs/guides/sucafina-workbench.md` head=`c2e9eca438ecc914e3ac048fd1318a170bc1ce62` candidate=`7f5ff192708870d92e0b869be81c394ed7b15cb9`
#15 NOT_OPEN MERGED
#16 CLOSED blob-match files=2 head=`ce99678c1414e4a1b7c130e5fa1f4b64ac5fbbcb` `packages/core/src/effect/layer-node.ts` `4d1491948140e05894193050f07b664163a69912` `packages/core/test/effect/layer-node/layer-node.test.ts` `a6c69252cb08f42b3a12057ce2768d006a21ac2f`
#17 SKIP already closed
#18 NOT_OPEN MERGED
#19 NOT_OPEN MERGED
#20 LEFT_OPEN DIFF files=101 path=`.github/workflows/astra-wp00-check.yml` head=`0f15b83946ecc4ed974578ec1a5a33da02e8b734` candidate=`MISSING`
#21 LEFT_OPEN DIFF files=133 path=`.github/workflows/astra-wp02-check.yml` head=`90725d66aaa20271231dff806e67794e2a01ba60` candidate=`MISSING`
#22 LEFT_OPEN DIFF files=123 path=`.github/workflows/astra-wp03-check.yml` head=`ec20973e55311f2dd5d78d65fea9645e4c47c6df` candidate=`MISSING`
#23 LEFT_OPEN DIFF files=374 path=`.github/workflows/astra-wp04-check.yml` head=`dab8d29f69d78ba304325333e03fb8d729fe026e` candidate=`MISSING`
#24 LEFT_OPEN DIFF files=117 path=`.github/workflows/astra-wp05-check.yml` head=`e6689a2e3f55d20067bc0df75c528abc781cc69a` candidate=`MISSING`
#25 LEFT_OPEN DIFF files=58 path=`.github/workflows/astra-wp01-check.yml` head=`a879ece94ac9a6c7224011a9e261549ce8a10053` candidate=`MISSING`
#26 LEFT_OPEN DIFF files=156 path=`.github/workflows/astra-wp06-check.yml` head=`3ef58454a7ee92241e9288240b372df2d6d22126` candidate=`MISSING`
#27 LEFT_OPEN DIFF files=428 path=`.github/workflows/astra-wp07-check.yml` head=`28c453f4b7735f944e1237715e399e955d86546c` candidate=`MISSING`
#28 LEFT_OPEN DIFF files=73 path=`.github/workflows/astra-wp08-check.yml` head=`a658349afb82adf87ac06aa1c881402ac122f378` candidate=`MISSING`
#29 LEFT_OPEN DIFF files=2052 path=`.github/workflows/astra-wp10-check.yml` head=`56ccb98dd74d3acbfdb43645bd9d54c9bf18816d` candidate=`MISSING`
#30 LEFT_OPEN DIFF files=220 path=`.github/workflows/astra-wp09-check.yml` head=`883e87de0196c580ac8160d74d8e5211a967e286` candidate=`MISSING`
#31 LEFT_OPEN DIFF files=431 path=`.github/workflows/astra-interface-check.yml` head=`07dc48b96b629984b081d33c9d3c82b6c54f15d2` candidate=`MISSING`
#32 LEFT_OPEN DIFF files=1208 path=`.github/workflows/astra-compose-check.yml` head=`e7a815a797e960e826af4268dd381cb4c5df6ffc` candidate=`MISSING`
#33 LEFT_OPEN DIFF files=378 path=`.github/workflows/astra-collaboration-check.yml` head=`4afe67e9fca51b5c41f265bc1958fb923e141148` candidate=`MISSING`
#34 LEFT_OPEN DIFF files=411 path=`.github/workflows/astra-operations-check.yml` head=`ec63fc5e1a355ada4f1b73cc518c225719e9b08e` candidate=`MISSING`
#35 LEFT_OPEN DIFF files=661 path=`.github/workflows/astra-finance-check.yml` head=`8a9666334436c9f7e5db9f8f7719c21aa096ae61` candidate=`MISSING`
#36 LEFT_OPEN DIFF files=309 path=`.github/workflows/astra-intelligence-check.yml` head=`874298c77901961e50afcf3d4824e4d39b00576b` candidate=`MISSING`
#37 LEFT_OPEN DIFF files=460 path=`.github/workflows/astra-wp13-check.yml` head=`3d7978dcedfdbb5488c4056f6ab3f2b80ecef4ae` candidate=`MISSING`
#38 LEFT_OPEN DIFF files=152 path=`.github/workflows/astra-wp14-check.yml` head=`2b0b36f3b9277a17cc22c3bab8144303d7c77830` candidate=`MISSING`
#39 LEFT_OPEN DIFF files=756 path=`.github/workflows/astra-wp12-check.yml` head=`1533bd2f8e1766d1ad6f40d8f500c91f7e5cc22f` candidate=`MISSING`
#40 LEFT_OPEN DIFF files=1191 path=`.github/workflows/astra-wp11-check.yml` head=`3b361b6b22c7c5628d6b149321f73934ea5f9a84` candidate=`MISSING`
#41 LEFT_OPEN DIFF files=469 path=`.github/workflows/astra-collaboration-check.yml` head=`4afe67e9fca51b5c41f265bc1958fb923e141148` candidate=`MISSING`
#42 LEFT_OPEN DIFF files=1203 path=`.github/workflows/astra-finance-check.yml` head=`8a9666334436c9f7e5db9f8f7719c21aa096ae61` candidate=`MISSING`
#43 LEFT_OPEN DIFF files=444 path=`.github/workflows/astra-interface-check.yml` head=`07dc48b96b629984b081d33c9d3c82b6c54f15d2` candidate=`MISSING`
#44 LEFT_OPEN DIFF files=1220 path=`.github/workflows/astra-compose-check.yml` head=`e7a815a797e960e826af4268dd381cb4c5df6ffc` candidate=`MISSING`
#45 LEFT_OPEN DIFF files=497 path=`.github/workflows/astra-interface-check.yml` head=`07dc48b96b629984b081d33c9d3c82b6c54f15d2` candidate=`MISSING`
#46 LEFT_OPEN DIFF files=452 path=`.github/workflows/astra-interface-check.yml` head=`07dc48b96b629984b081d33c9d3c82b6c54f15d2` candidate=`MISSING`
#47 LEFT_OPEN DIFF files=499 path=`.github/workflows/astra-interface-check.yml` head=`07dc48b96b629984b081d33c9d3c82b6c54f15d2` candidate=`MISSING`
#48 LEFT_OPEN DIFF files=459 path=`.github/workflows/astra-interface-check.yml` head=`07dc48b96b629984b081d33c9d3c82b6c54f15d2` candidate=`MISSING`
#49 LEFT_OPEN DIFF files=306 path=`modules/sucafina/Sucafinav1/docs/sf2h/control/allocation-12-admitted.json` head=`d5e8d53b1ae213d8aed569b8bef1cfcfb8afa7e5` candidate=`MISSING`
#50 LEFT_OPEN DIFF files=311 path=`modules/sucafina/Sucafinav1/docs/sf2h/control/allocation-12-admitted.json` head=`d5e8d53b1ae213d8aed569b8bef1cfcfb8afa7e5` candidate=`MISSING`
#51 LEFT_OPEN DIFF files=306 path=`modules/sucafina/Sucafinav1/docs/sf2h/control/allocation-12-admitted.json` head=`d5e8d53b1ae213d8aed569b8bef1cfcfb8afa7e5` candidate=`MISSING`
#52 LEFT_OPEN DIFF files=424 path=`.github/workflows/astra-operations-check.yml` head=`ec63fc5e1a355ada4f1b73cc518c225719e9b08e` candidate=`MISSING`
#53 LEFT_OPEN DIFF files=483 path=`.github/workflows/astra-interface-check.yml` head=`07dc48b96b629984b081d33c9d3c82b6c54f15d2` candidate=`MISSING`
#54 LEFT_OPEN DIFF files=482 path=`.github/workflows/astra-interface-check.yml` head=`07dc48b96b629984b081d33c9d3c82b6c54f15d2` candidate=`MISSING`
#55 LEFT_OPEN DIFF files=1690 path=`.github/workflows/astra-wp10-check.yml` head=`56ccb98dd74d3acbfdb43645bd9d54c9bf18816d` candidate=`MISSING`
#56 LEFT_OPEN DIFF files=1066 path=`.github/workflows/astra-finance-check.yml` head=`8a9666334436c9f7e5db9f8f7719c21aa096ae61` candidate=`MISSING`
#57 LEFT_OPEN DIFF files=425 path=`.github/workflows/astra-operations-check.yml` head=`ec63fc5e1a355ada4f1b73cc518c225719e9b08e` candidate=`MISSING`
#58 LEFT_OPEN DIFF files=411 path=`.github/workflows/astra-operations-check.yml` head=`ec63fc5e1a355ada4f1b73cc518c225719e9b08e` candidate=`MISSING`
#59 LEFT_OPEN DIFF files=1684 path=`.github/workflows/astra-wp10-check.yml` head=`56ccb98dd74d3acbfdb43645bd9d54c9bf18816d` candidate=`MISSING`
#60 LEFT_OPEN DIFF files=451 path=`.github/workflows/astra-operations-check.yml` head=`ec63fc5e1a355ada4f1b73cc518c225719e9b08e` candidate=`MISSING`
#61 LEFT_OPEN DIFF files=487 path=`.github/workflows/astra-interface-check.yml` head=`07dc48b96b629984b081d33c9d3c82b6c54f15d2` candidate=`MISSING`
#62 LEFT_OPEN DIFF files=303 path=`.github/workflows/astra-intelligence-check.yml` head=`874298c77901961e50afcf3d4824e4d39b00576b` candidate=`MISSING`
#63 LEFT_OPEN DIFF files=343 path=`modules/sucafina/Sucafinav1/docs/sf2h/control/allocation-12-admitted.json` head=`d5e8d53b1ae213d8aed569b8bef1cfcfb8afa7e5` candidate=`MISSING`
#64 LEFT_OPEN DIFF files=345 path=`modules/sucafina/Sucafinav1/docs/sf2h/control/allocation-12-admitted.json` head=`d5e8d53b1ae213d8aed569b8bef1cfcfb8afa7e5` candidate=`MISSING`
#65 SKIP already closed
#66 LEFT_OPEN DIFF files=346 path=`modules/sucafina/Sucafinav1/docs/sf2h/control/allocation-12-admitted.json` head=`d5e8d53b1ae213d8aed569b8bef1cfcfb8afa7e5` candidate=`MISSING`
#67 LEFT_OPEN DIFF files=426 path=`modules/sucafina/Sucafinav1/docs/sf2h/control/allocation-12-admitted.json` head=`d5e8d53b1ae213d8aed569b8bef1cfcfb8afa7e5` candidate=`MISSING`
#68 LEFT_OPEN DIFF files=56 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/review-first-agenda/ACCESSIBLE-CONTROLS-FIX.json` head=`ce973062c418b4d216affed5582168af37cd2eeb` candidate=`MISSING`
#69 LEFT_OPEN DIFF files=40 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/microsoft-login/ACK49.json` head=`1a88688e881137f6813609666497556cca790e0d` candidate=`MISSING`
#70 LEFT_OPEN DIFF files=20 path=`.github/workflows/app-build.yml` head=`f04834e614c0a8e6b052073a216e904a38c45c2e` candidate=`MISSING`
#71 LEFT_OPEN DIFF files=43 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/runtime-fresh-copy-cost/ACCEPTANCE.json` head=`27b62340f2067d6b3765ab719240f0c8136772ce` candidate=`MISSING`
#72 LEFT_OPEN DIFF files=56 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/runtime-readonly-root/ACK59.json` head=`7e3dbb6f3175dfef4271772598c3357bf1809f61` candidate=`MISSING`
#73 LEFT_OPEN DIFF files=55 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/mixed-source-contracts/ACK61.json` head=`15885582c679c0019d99518a93ffa42f28aeaa23` candidate=`MISSING`
#74 LEFT_OPEN DIFF files=59 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/c12-recovery-closure/ACK65.json` head=`d95482ea0183e2157542798afc760b7cf4566b5d` candidate=`MISSING`
#75 LEFT_OPEN DIFF files=65 path=`apps/cli/src/sucafina-product/bi-services.ts` head=`4f7d24f93838fd6e19ed0403b4b3bbdf644b3575` candidate=`ea3cfb1b006d335266197a889cc9ce7f842f0434`
#76 LEFT_OPEN DIFF files=118 path=`modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` head=`a52acbb183418f18d550801ca0415e7de2e029b4` candidate=`MISSING`
#77 LEFT_OPEN DIFF files=80 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/export-artifact-closure/ACK66.json` head=`e724b594380f4feb49d1d02c536196c43c4e7265` candidate=`MISSING`
#78 LEFT_OPEN DIFF files=249 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/operations-installed-finish/ACK75.json` head=`a8bfd48c2ac7ec79cadb157008e9e809cac4e7f4` candidate=`MISSING`
#79 LEFT_OPEN DIFF files=51 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/atlas-memory-composed/ACK69.json` head=`2e99b0c3d86998e2a0d88d8c25461a49247136dd` candidate=`MISSING`
#80 LEFT_OPEN DIFF files=52 path=`apps/cli/src/sucafina-product/routine-native-governance.ts` head=`f22fba2172e6502e6c1bed5a2ed8d5b5434ec845` candidate=`0cd11988124227563676f3b53ab5eedcb3688197`
#81 LEFT_OPEN DIFF files=74 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/workbench-mcp-closure/ACK68.json` head=`9954066f19415f23e51f8f099384e3c57c347182` candidate=`MISSING`
#82 LEFT_OPEN DIFF files=143 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/dashboard-installed-closure/ACK67.json` head=`94eb9905abbc519a36b2311fbedc27accde4300e` candidate=`MISSING`
#83 LEFT_OPEN DIFF files=6 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/cold-auth-review/ACK70.json` head=`17fe47407e25199a164db230a95acd7981efdb7b` candidate=`MISSING`
#84 LEFT_OPEN DIFF files=74 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/auth-readonly-composition/ACK85.json` head=`4b282b749e7632c618381eb9528d0702bdc6fabf` candidate=`MISSING`
#85 LEFT_OPEN DIFF files=79 path=`apps/cli/src/sucafina-product/installation.ts` head=`34d74d6651031c5194db1d22c823baae60e9a260` candidate=`9a9c6df0d5b450224baceefe443d84ca3d494a59`
#86 LEFT_OPEN DIFF files=43 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/export-egress-privacy/ACK86.json` head=`8814e7a3cbe81d4fbb40dac3d51fffb28a46bc7e` candidate=`MISSING`
#87 LEFT_OPEN DIFF files=49 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/canonical-read-cost/ACK76.json` head=`ed9ed5842ed8070f533b910a6011f61495e66ac3` candidate=`MISSING`
#88 LEFT_OPEN DIFF files=35 path=`modules/sucafina/Sucafinav1/docs/sf2h/control/reconciliation78/ACK78.json` head=`a1681c91b06620a911e103b14d0c5fd141d94a20` candidate=`MISSING`
#89 LEFT_OPEN DIFF files=73 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/installed-post-cause/ACK79.json` head=`c8a2544f87dc697bf841f745b5d37c08b524672a` candidate=`MISSING`
#90 LEFT_OPEN DIFF files=32 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/cost-coverage-closure/ACK80.json` head=`99a3583cb5d09e397e11b79bfb2f64ef89ce1cba` candidate=`MISSING`
#91 LEFT_OPEN DIFF files=10 path=`modules/sucafina/Sucafinav1/docs/sf2h/native-ui/review77/ACK77.json` head=`6a07ed30d7ffdacebdd8bb9aa46fccc5996c72c2` candidate=`MISSING`
#92 LEFT_OPEN DIFF files=12 path=`apps/cli/src/sucafina-product/dashboard-decisions.ts` head=`b4d70dfb9467d59e3ac8861e0b4fc1c628d09bc6` candidate=`c432524a112c873117309377d941845bf9923096`
#93 LEFT_OPEN DIFF files=11 path=`.github/workflows/test-ci.yml` head=`9841ca8009b7ef4b838571733c04df2fbae19b00` candidate=`fa45579123a38a4e909ff4ed1ddbc621af9b1bda`
#94 LEFT_OPEN DIFF files=6 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/auth-cold-recheck/ACK84.json` head=`f94828e385be1926e3c6300f38e025f9526da358` candidate=`MISSING`
#95 LEFT_OPEN DIFF files=51 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/p03-causal-closure/ACK99.json` head=`b53b6e70ff1b893a685fa231d8e56c2400dc02cf` candidate=`MISSING`
#96 LEFT_OPEN DIFF files=42 path=`apps/cli/src/sucafina-product/routine-native-registry.ts` head=`b5a92ee1653873463e85e2445919c85828c7ef4d` candidate=`adf4fdc04d783ee77bf0640f6f906c37e909fb1d`
#97 LEFT_OPEN DIFF files=9 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/reviews/R2/browser-92/attempt-001/ACK92.json` head=`7d5a350f432acbbe0a4681f37a642ea554720bc1` candidate=`MISSING`
#98 LEFT_OPEN DIFF files=8 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/reviews/R3/browser-93/attempt-001/ACK93.md` head=`139f05d1ad21092e696e35c33b9545eb1b3a1634` candidate=`MISSING`
#99 LEFT_OPEN DIFF files=134 path=`modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` head=`3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` candidate=`MISSING`
#100 LEFT_OPEN DIFF files=7 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/reviews/R1/browser-91/attempt-001/ACK91.json` head=`6a8a6d44dbdd6ac53379dc6bb5ece0251e6ad4fc` candidate=`MISSING`
#101 LEFT_OPEN DIFF files=8 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/report-title-fix/ACK-98.json` head=`1b33189428b407e76562948efcad82aa876092ae` candidate=`MISSING`
#102 LEFT_OPEN DIFF files=10 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/denied-read-fix/ACK-97.json` head=`434c4532eb5bcb23bff99969efcd07f5e1568562` candidate=`MISSING`
#103 LEFT_OPEN DIFF files=14 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/creation-reload-fix/ACK96.json` head=`5ab4db0a55022968ddbb845e93806d653cc476b8` candidate=`MISSING`
#104 LEFT_OPEN DIFF files=16 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/correction161/ACK161.json` head=`cb814c33ddc1cdf24352462be2a9e77bc487ffae` candidate=`MISSING`
#105 LEFT_OPEN DIFF files=15 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/correction142/ACK-142.json` head=`1089272fb63ca0c0464cf7ba4d79591d02c6a0c0` candidate=`MISSING`
#106 LEFT_OPEN DIFF files=76 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance150/ACK150.json` head=`c71332432e9566d24d6f7a57011fb6c499a00e6a` candidate=`MISSING`
#107 LEFT_OPEN DIFF files=46 path=`.github/workflows/sf-compiler-c53.yml` head=`fd463eb8af4b72fef2cd831cf7e6377656be3532` candidate=`MISSING`
#108 LEFT_OPEN DIFF files=4 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/reviews/R1/browser-112/attempt-001/ACK-112.json` head=`d1048a2527ad06cebd2d742b5f4159f980b1d8df` candidate=`MISSING`
#109 LEFT_OPEN DIFF files=12 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/creation-recovery-link/ACK111.json` head=`21c569036fb79f19e3f761b22df28e633a1a4593` candidate=`MISSING`
#110 LEFT_OPEN DIFF files=12 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-child-admission/ACK110.json` head=`59fd8b6be4199f8a7c825561208a93ff8980d22c` candidate=`MISSING`
#111 NO_PR
#112 LEFT_OPEN DIFF files=8 path=`apps/cli/src/sucafina-product/bi-services.ts` head=`597b5c3b536c2416d9d7d39c7d4329ce5c4183ff` candidate=`ea3cfb1b006d335266197a889cc9ce7f842f0434`
#113 LEFT_OPEN DIFF files=22 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/matcher-type-repair/ACK117.json` head=`b932a17179c4a4680ff3d8577896e54902ad5c14` candidate=`MISSING`
#114 LEFT_OPEN DIFF files=43 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/fixture-type-repair/ACK118.json` head=`64e722fd3afbc5a8ad167b7465f7a2b2be109171` candidate=`MISSING`
#115 LEFT_OPEN DIFF files=168 path=`modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` head=`3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` candidate=`MISSING`
#116 LEFT_OPEN DIFF files=181 path=`apps/cli/src/sucafina-product/native-ui/planner.ts` head=`fee901b48a7c9bd612abb547b0465f5e04ce355e` candidate=`0a952e2af1b49dd7c53bb56f1425a763c526bcf6`
#117 LEFT_OPEN DIFF files=9 path=`modules/sucafina/Sucafinav1/docs/sf2h/receipts/creation-proof-repair/ACK121.json` head=`c6007d9de5aa71e8aff84527b768acb5cd0d6cbe` candidate=`MISSING`
#118 LEFT_OPEN DIFF files=181 path=`modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` head=`3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` candidate=`MISSING`
#119 LEFT_OPEN DIFF files=169 path=`modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` head=`3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` candidate=`MISSING`
#120 LEFT_OPEN DIFF files=187 path=`modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` head=`3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` candidate=`MISSING`
