# Closeout 201–280

Candidate `origin/close-final-candidate` `a63c4c733523294450f605e73de3306edff81e58`.

Close test was blob identity. Ancestry and `git diff base...head` were not used. A non-empty three-dot diff was not treated as missing content.

For each PR: `gh pr view N --repo gustavomhss/Orchestra-SF --json state,headRefOid`, then `git fetch origin pull/N/head`. `mb=$(git merge-base origin/close-final-candidate FETCH_HEAD)`. No merge-base stays open (`NO_MERGE_BASE`). Files are `git diff --name-only $mb FETCH_HEAD`. An empty list is absorbed. Otherwise every path compares `git rev-parse FETCH_HEAD:path` with `git rev-parse origin/close-final-candidate:path`. A missing path is the token `MISSING`. Close only when every token matches. The first differing path is recorded otherwise.

A concurrent closer commented `Superseded by the bundle merge on close-final-candidate a63c4c7335. Branch kept. This is not promotion PR 237.` and closed this range, including PRs whose blobs differ. Those differing PRs were reopened. Later no-comment closes of the same diffs were reopened again. #237 was not closed.

#233, #240, #255 and #256 matched on every changed file and were closed with `gh pr close`. `gh pr close --comment` succeeded for #240. The same command was rejected for #233, #255 and #256 by GitHub's secondary rate limit on `addComment`, so those three were closed without a new comment.

| Result | Count |
| --- | ---: |
| Closed by this pass | 4 |
| Left open | 47 |

## Closed

| PR | Head | Files | Why | Absorption comment | GitHub |
| ---: | --- | ---: | --- | --- | --- |
| 233 | `05467fa52088a0b6c7370012d58705738eef0140` | 9 | MATCH 9 files, including `modules/engine-adapters/claude-code/src/v2/host.ts` | not posted (rate limit) | CLOSED |
| 240 | `cb943677b95a5cd6e111d4d36cffe9fc0054b181` | 1 | MATCH `packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts` | posted | CLOSED |
| 255 | `0b53c61dda85401f9245ed9528e3d9669f6e69f1` | 1 | MATCH `modules/sucafina/Sucafinav1/test/installation.test.ts` | not posted (rate limit) | CLOSED |
| 256 | `22002409d2b2fce52427c6b7a53fd7b733b40f96` | 1 | MATCH `packages/app-shell/test-browser/sucafina-native/draft-quarantine.test.ts` | not posted (rate limit) | CLOSED |

## Left open

| PR | Head | Why | GitHub |
| ---: | --- | --- | --- |
| 201 | `f4fc2af5809f8af6c2dc5b8ddcb176ee3409f002` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair220/ACK.json` `7088ea43f951` vs `MISSING` (9 files) | OPEN |
| 202 | `b3d7fcfe5a1a76a673de1914eb01bff2f233f647` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair222/ACK.json` `54edb88133f0` vs `MISSING` (10 files) | OPEN |
| 203 | `124901e88d21595de205f2e2a26846a5409682b7` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure225/ACK.json` `de7e1f974ab5` vs `MISSING` (17 files) | OPEN |
| 204 | `c2f0ef0ce180aad3fe31bd3af8485400ee4e0d79` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure227/ACK-227.json` `c344dcef0bc5` vs `MISSING` (14 files) | OPEN |
| 205 | `1872cc6a60809dec489ce1b486114aaa6e87a77b` | DIFF `apps/cli/src/sucafina-product/native-ui/files.ts` `a2e1041871a5` vs `6e202424537f` (21 files) | OPEN |
| 206 | `ad330d3ce08649671aae5c7e6aa3b3f40e446c72` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance150/ACK150.json` `c71332432e95` vs `MISSING` (85 files) | OPEN |
| 207 | `b8d0e46d6fcca835f345bd5e0d5f719d8047c757` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/ACK.json` `a56513528777` vs `MISSING` (19 files) | OPEN |
| 209 | `95322577a4f4b1392163695b990199e5f88655fb` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/ACK.json` `5a0aeb6edbb5` vs `MISSING` (23 files) | OPEN |
| 210 | `5d99be45187df73a89b4f31a3f7db22aa0c49c98` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure236/ACK.json` `6f42992c172a` vs `MISSING` (8 files) | OPEN |
| 211 | `28489fdaa75f326c77926d717a0523099339902b` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure233/ACK.json` `8e36c02518af` vs `MISSING` (17 files) | OPEN |
| 212 | `01a957f081cfb3a022ce9a235e965be2509d6b7b` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure234/ACK.json` `4887268b2320` vs `MISSING` (32 files) | OPEN |
| 213 | `98680073f6f193c0c9632493f9cfe3f470c19aa1` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/ACK.json` `0ad8050c82d1` vs `MISSING` (16 files) | OPEN |
| 214 | `715dd8771a78925551086a6cfb91dfe4d98bcc68` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure239/ACK.json` `7074c5756fce` vs `MISSING` (16 files) | OPEN |
| 215 | `2ad6b5dc0cb16bbe5b3508a2fe824f1dda740619` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/ACK.json` `5a0aeb6edbb5` vs `MISSING` (44 files) | OPEN |
| 216 | `ea49ca9fa6a8f7191aecceaf9fdb6bbf06e41282` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure238/ACK.json` `af41b95b8891` vs `MISSING` (27 files) | OPEN |
| 217 | `c060c89937ed0cb3a3da9172c47cd81be6d4ae11` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/bridge-preflight/HANDOFF.md` `23be9065f407` vs `MISSING` (6 files) | OPEN |
| 218 | `a147233718906c78b16117678c39dec88d643d16` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/control/context-admission/README.md` `39ffffba4644` vs `MISSING` (7 files) | OPEN |
| 219 | `010adbefece7fa81964595ff09f392df018cb3e3` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/control/planner-operational/README.md` `6b80e1b50377` vs `MISSING` (8 files) | OPEN |
| 220 | `23039b6391feb0187098d5aa33922c849d12e6e7` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/control/cases-operational/README.md` `0132fc45de94` vs `MISSING` (4 files) | OPEN |
| 221 | `81ebae7f37b2a9cca3ed9c64a1992f07adb02010` | DIFF `apps/cli/src/sucafina-product/memory-http.ts` `5fc4fc583268` vs `a5cdae9c36b8` (7 files) | OPEN |
| 222 | `2100afcf9fcb5d8edadda2efa43e22705b6f3081` | DIFF `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/surface.tsx` `82ad7452d2b3` vs `5a116b204af7` (43 files) | OPEN |
| 223 | `892fe88128e4f692192c740b7932f71b03a4d850` | DIFF `apps/cli/src/sucafina-product/native-ui/files-routing.ts` `17ad20a8f8ca` vs `5c2291a0da55` (43 files) | OPEN |
| 224 | `c4e662b150608071a06804b11909443bf1f19a42` | DIFF `apps/cli/src/sucafina-product/host-context.ts` `73dedcbba362` vs `13b7db59d3f3` (38 files) | OPEN |
| 227 | `3ab96612169009bb9fa533e41a1b738a66f1cab9` | DIFF `apps/cli/src/sucafina-product/native-ui/people.ts` `797af0d993ba` vs `764726bc6912` (54 files) | OPEN |
| 228 | `b9a2c66da682a86a572be06e0f7179afec15afcc` | DIFF `apps/cli/src/sucafina-product/native-ui/files-routing.ts` `22eaa50ea76b` vs `5c2291a0da55` (27 files) | OPEN |
| 229 | `709aede6d9d5b80941b64bd2329c163abc98da38` | DIFF `apps/cli/src/sucafina-product/native-ui/live-context.ts` `c0f11d5ee6ae` vs `573f1af22df6` (2 files) | OPEN |
| 230 | `387725772170391936a880eea0d8c026a8d68c27` | DIFF `apps/cli/src/sucafina-product/native-ui/people.ts` `797af0d993ba` vs `764726bc6912` (48 files) | OPEN |
| 234 | `32030c5924b719647e19e4f7ddbef16eae5cd425` | DIFF `apps/cli/src/sucafina-product/native-ui/people.ts` `797af0d993ba` vs `764726bc6912` (49 files) | OPEN |
| 235 | `61ddba8cd9e0167fcb740dcdc1cf8722e79a39f6` | DIFF `apps/cli/src/sucafina-product/native-ui/people.ts` `797af0d993ba` vs `764726bc6912` (60 files) | OPEN |
| 237 | `a63c4c733523294450f605e73de3306edff81e58` | NEVER_CLOSE (head is the candidate; empty file list would otherwise close) | OPEN |
| 239 | `d1f86986a8fa7e1df46a126dba8f51b71531c0f6` | DIFF `CHANGELOG.md` `215e72850052` vs `505e5c3bf9c6` (2 files) | OPEN |
| 244 | `bd902fe45aab81fb61f58f5eb79f80c833f4954e` | DIFF `modules/sucafina/Sucafinav1/test/native-ui-contract/memory.test.ts` `7696adbcb61d` vs `9d8a45cd2fe2` (5 files) | OPEN |
| 245 | `59012d8dc7a5a7efce5e0b24ef4b610101014e65` | DIFF `sf/azure/identity/AZ-02-W0-W1-handoff.md` `887f6c3b8f99` vs `MISSING` (4 files) | OPEN |
| 246 | `d93b695b04876b4194dfa267ca3b795d87f2737d` | DIFF `.github/workflows/sf-ci.yml` `41e16686551f` vs `8f05ac6f081d` (26 files) | OPEN |
| 247 | `a8634972abb4e042fc4cf401c2c6c966f2f56cb7` | DIFF `.github/workflows/sf-ci.yml` `41e16686551f` vs `8f05ac6f081d` (25 files) | OPEN |
| 248 | `7c68373566bb659f1cd025fb6429820c234d8be7` | DIFF `.github/workflows/sf-ci.yml` `41e16686551f` vs `8f05ac6f081d` (44 files) | OPEN |
| 249 | `23792c2d1e2baf55e3ec17723147e27d0d6af840` | DIFF `.github/workflows/sf-ci.yml` `41e16686551f` vs `8f05ac6f081d` (35 files) | OPEN |
| 250 | `28ac635a371e91504bc2eec9d193e6c1225a1eb8` | DIFF `.github/workflows/sf-ci.yml` `41e16686551f` vs `8f05ac6f081d` (26 files) | OPEN |
| 251 | `7aafa32d6673d13f456a4a9caffd307614129dea` | DIFF `.github/workflows/sf-ci.yml` `e7abd4d5cbc4` vs `8f05ac6f081d` (25 files) | OPEN |
| 252 | `e8f6fc475514488cf7aa40df350fc46674263935` | DIFF `.github/workflows/sf-ci.yml` `41e16686551f` vs `8f05ac6f081d` (35 files) | OPEN |
| 253 | `831e0ea2862fd2ce111f1fbe4304d05077d213df` | DIFF `.github/workflows/sf-ci.yml` `41e16686551f` vs `8f05ac6f081d` (22 files) | OPEN |
| 257 | `591424661cf43baedf798b470a112d32b9b0c514` | DIFF `apps/cli/script/distribution-payload.ts` `cfc62ae5e3a4` vs `ca9edcafc0e6` (16 files) | OPEN |
| 268 | `9802e2779dc2190203f672e60a3ed9d58d5d4438` | DIFF `sf/demo/flamengo/README.md` `97193a11d7d9` vs `MISSING` (8 files) | OPEN |
| 270 | `78e35990f84335e5ddb6fcd40e785a4925141373` | DIFF `modules/sucafina/Sucafinav1/local/entry.ts` `fd9c8e5957eb` vs `e9e374960600` (14 files) | OPEN |
| 272 | `78e35990f84335e5ddb6fcd40e785a4925141373` | DIFF `modules/sucafina/Sucafinav1/local/entry.ts` `fd9c8e5957eb` vs `e9e374960600` (14 files) | OPEN |
| 274 | `47b555b2cc20d48b468e765e90431e04fa1c464a` | DIFF `.github/workflows/sf-ci.yml` `3a414224df9a` vs `8f05ac6f081d` (1 files) | OPEN |
| 280 | `f212c3d0ac6107e38f129d331b36fb674b39f303` | DIFF `modules/sucafina/Sucafinav1/runtime/procurement.ts` `8f7f744101fd` vs `0b45547ca50e` (10 files) | OPEN |
