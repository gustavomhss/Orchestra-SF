# Close proof 281-400

Candidate: `origin/close-final-candidate` `a63c4c733523294450f605e73de3306edff81e58`.

Rule, and no other close rule: `mb=$(git merge-base origin/close-final-candidate FETCH_HEAD)`, files are `git diff --name-only $mb FETCH_HEAD`. Close only when that list is empty, or every file has the same `git rev-parse` blob token on `FETCH_HEAD` and on `origin/close-final-candidate` (`MISSING` if absent). A differing file is unique work and stays open. A closed PR with a differing file is reopened. No three-dot diff. No close because a bundle commit mentions the number. No branch delete. `#237` not touched.

Proof ran in an isolated clone so a shared `FETCH_HEAD` could not race. Each `FETCH_HEAD` matched the PR head SHA from GitHub and was unchanged at the end of that PR's comparison.

## Counts

- closed this pass: 1 (`#332`)
- reopened this pass: 6 (`#289` `#290` `#293` `#297` `#307` `#327`)
- left open (already open, unique, not closed): 4 (`#302` `#340` `#341` `#345`)
- already closed and blob-matched, left closed: 2 (`#338` `#339`)
- merged, untouched: 52
- absent: 55 (`#346`-`#400`)
- end open: 10 (`#289` `#290` `#293` `#297` `#302` `#307` `#327` `#340` `#341` `#345`)

Actions used `gh pr close` / `gh pr reopen` with `--repo gustavomhss/Orchestra-SF` and no `--comment` and no `--delete-branch`. Head SHAs were unchanged between proof and action.

## Decisions

| PR | state at action | proof | files | differ | action | head | merge-base |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 281 | MERGED | UNIQUE | 267 | 24 | untouched merged | `1ca55640c9cb49c281064a7f025212f6de3c6054` | `cde922f6bcf4d423492e6fa99a1c70f1b4757a37` |
| 282 | MERGED | UNIQUE | 5 | 5 | untouched merged | `883febbae8e3aa11780e9f560bca1fc3d14232ff` | `a1e774ec9e1fc28c81e0b42a1889c0425060aed9` |
| 283 | MERGED | UNIQUE | 5 | 1 | untouched merged | `ab99de216b51a40a7055db77b8ba134f891684ff` | `67156e12b9d77af870408557371e2c978a1dbeb7` |
| 284 | MERGED | UNIQUE | 1 | 1 | untouched merged | `54e48da54417a7e44915dc37a21141cac8769def` | `c4da52424a7e1fdc8be75362bd647778e269577d` |
| 285 | MERGED | MATCH | 0 | 0 | untouched merged | `cde922f6bcf4d423492e6fa99a1c70f1b4757a37` | `cde922f6bcf4d423492e6fa99a1c70f1b4757a37` |
| 286 | MERGED | UNIQUE | 17 | 6 | untouched merged | `d121b80b8deda3b1b08db8338ac429c7e6ab08d5` | `c4da52424a7e1fdc8be75362bd647778e269577d` |
| 287 | MERGED | UNIQUE | 9 | 5 | untouched merged | `9702af5cd4e2dfa567587ab3f1ec0c219b43ec47` | `6117cfc46ac3e282474b767e4550875abf814844` |
| 288 | MERGED | UNIQUE | 5 | 4 | untouched merged | `4d10a14a62b5796cbf6dc159dee0bc59c362c882` | `cde922f6bcf4d423492e6fa99a1c70f1b4757a37` |
| 289 | OPEN | UNIQUE | 14 | 10 | reopen | `10aac82c4660bfcbc09e14f267700983cea7368b` | `3b3e86b2a8181dadecbfe94e5ad30619bf9ce069` |
| 290 | OPEN | UNIQUE | 44 | 42 | reopen | `7f26c6c56ee1d044fa366b2c68639db5c5bc3d4a` | `a1e774ec9e1fc28c81e0b42a1889c0425060aed9` |
| 291 | MERGED | UNIQUE | 17 | 8 | untouched merged | `ec2cb9ff4d19c9ead03b85904f8c16fa8045f123` | `c4da52424a7e1fdc8be75362bd647778e269577d` |
| 292 | MERGED | MATCH | 0 | 0 | untouched merged | `4a6192ab7a479611b32feafcaf4016451d245b07` | `4a6192ab7a479611b32feafcaf4016451d245b07` |
| 293 | OPEN | UNIQUE | 25 | 16 | reopen | `2d0296989c684997ed15d3a05aa8a09ef445ac9b` | `c4da52424a7e1fdc8be75362bd647778e269577d` |
| 294 | MERGED | UNIQUE | 14 | 8 | untouched merged | `d609950cf828bf14afaa19c02b42e5d27cc7af31` | `e673573521f32a3cfeb5f564bda79d66ac1192be` |
| 295 | MERGED | MATCH | 1 | 0 | untouched merged | `a8f7b3a2998bd6dca30c1d92ba0c0fa1ec2808cf` | `3b3e86b2a8181dadecbfe94e5ad30619bf9ce069` |
| 296 | MERGED | UNIQUE | 8 | 3 | untouched merged | `5ab447ead9395da3890c821add831358160a466f` | `4a6192ab7a479611b32feafcaf4016451d245b07` |
| 297 | OPEN | UNIQUE | 21 | 19 | reopen | `47e32dab6c29fca782905570bd5a0523c483f5f3` | `4a6192ab7a479611b32feafcaf4016451d245b07` |
| 298 | MERGED | MATCH | 0 | 0 | untouched merged | `3b3e86b2a8181dadecbfe94e5ad30619bf9ce069` | `3b3e86b2a8181dadecbfe94e5ad30619bf9ce069` |
| 299 | MERGED | UNIQUE | 7 | 1 | untouched merged | `d3c4cc06d1e719785b8f3cdac03ec7e2fdafa170` | `3b3e86b2a8181dadecbfe94e5ad30619bf9ce069` |
| 300 | MERGED | UNIQUE | 3 | 2 | untouched merged | `0d5b6f564c005d389d5ccf95f01af4e2f743351d` | `3b3e86b2a8181dadecbfe94e5ad30619bf9ce069` |
| 301 | MERGED | MATCH | 1 | 0 | untouched merged | `4e29e7b88415252dca294288f79a629aba7f8073` | `3b3e86b2a8181dadecbfe94e5ad30619bf9ce069` |
| 302 | OPEN | UNIQUE | 3 | 3 | leave open | `a776fc9bb0a668540374664b5b4e77ebf9a3c02e` | `3b3e86b2a8181dadecbfe94e5ad30619bf9ce069` |
| 303 | MERGED | UNIQUE | 3 | 2 | untouched merged | `4b5e569deb8111e56ddafec850835600a40079e1` | `3b3e86b2a8181dadecbfe94e5ad30619bf9ce069` |
| 304 | MERGED | UNIQUE | 15 | 5 | untouched merged | `77c341f939e33dce1bd39b82a2522ffa1b7742b1` | `d624e44db8e2f8f15825566277ced51cfac8b0c7` |
| 305 | MERGED | UNIQUE | 2 | 2 | untouched merged | `d547d40516b548618c203e2e58d759d2aa2ff422` | `3b3e86b2a8181dadecbfe94e5ad30619bf9ce069` |
| 306 | MERGED | MATCH | 23 | 0 | untouched merged | `aa40d2d35f77f682a4ad6bfb74542ea02d90a05f` | `c4da52424a7e1fdc8be75362bd647778e269577d` |
| 307 | OPEN | UNIQUE | 12 | 7 | reopen | `fd8dd28479b001e6989d142ef38b4fff535f5ec6` | `8e456b229bf58d06bb542f83f9057687855c77d2` |
| 308 | MERGED | MATCH | 0 | 0 | untouched merged | `8e456b229bf58d06bb542f83f9057687855c77d2` | `8e456b229bf58d06bb542f83f9057687855c77d2` |
| 309 | MERGED | UNIQUE | 8 | 1 | untouched merged | `2bd22d0afa5caec0f05c13d7adc8b3e33ea22433` | `3945770d22b808a1f67329a48da5355459a52004` |
| 310 | MERGED | UNIQUE | 9 | 8 | untouched merged | `f73654b7135b7f1f915a462bdf8fb3bffdee9a74` | `5b5bbe2a7094403122141e001bb34f821572d38a` |
| 311 | MERGED | UNIQUE | 18 | 6 | untouched merged | `55fe2e8e4b4ca79954931960b6809bfaeaf8a7c5` | `8e456b229bf58d06bb542f83f9057687855c77d2` |
| 312 | MERGED | MATCH | 17 | 0 | untouched merged | `2affd70f55cf588f29a34165ea4006dcef86a2d1` | `5b5bbe2a7094403122141e001bb34f821572d38a` |
| 313 | MERGED | UNIQUE | 12 | 2 | untouched merged | `794710cb8b77db69006b2dac8e6951102a9ee5c1` | `5b5bbe2a7094403122141e001bb34f821572d38a` |
| 314 | MERGED | MATCH | 3 | 0 | untouched merged | `ae7a7390bd39cd8826616385429747a1fcee02ff` | `dd378ad2ac14dff3559aa3aa546e6d87b43140c8` |
| 315 | MERGED | UNIQUE | 10 | 5 | untouched merged | `2f6c9326652a47a80f3aa3cb5c147007e99666dc` | `dd378ad2ac14dff3559aa3aa546e6d87b43140c8` |
| 316 | MERGED | UNIQUE | 20 | 6 | untouched merged | `e2fcd97cd96b393e53c191fc7fc306501e469c13` | `5b5bbe2a7094403122141e001bb34f821572d38a` |
| 317 | MERGED | UNIQUE | 13 | 2 | untouched merged | `5de2c4ffc7006edf2d39cceebee13a1a3b481482` | `5b5bbe2a7094403122141e001bb34f821572d38a` |
| 318 | MERGED | MATCH | 6 | 0 | untouched merged | `691c7bbf25fd178d2e18b54ad0254266850fef45` | `d624e44db8e2f8f15825566277ced51cfac8b0c7` |
| 319 | MERGED | MATCH | 6 | 0 | untouched merged | `3f0369bf11dc39c0aa18444779766b47578992e9` | `d624e44db8e2f8f15825566277ced51cfac8b0c7` |
| 320 | MERGED | UNIQUE | 5 | 2 | untouched merged | `539487c8839a1ada4a5c860bf46d451715926658` | `dd378ad2ac14dff3559aa3aa546e6d87b43140c8` |
| 321 | MERGED | MATCH | 2 | 0 | untouched merged | `5621f73c3da5140169db0178bb6550f884802d19` | `dd378ad2ac14dff3559aa3aa546e6d87b43140c8` |
| 322 | MERGED | UNIQUE | 12 | 8 | untouched merged | `f8988335e50384f3d88ab98c549c4985ea49817f` | `d624e44db8e2f8f15825566277ced51cfac8b0c7` |
| 323 | MERGED | MATCH | 5 | 0 | untouched merged | `c1044e2a87bb5f444abc11eff42a2b9bdc9f4f51` | `d624e44db8e2f8f15825566277ced51cfac8b0c7` |
| 324 | MERGED | UNIQUE | 3 | 1 | untouched merged | `318592163594d1228c9ae1637420c9f5b4789c5f` | `d624e44db8e2f8f15825566277ced51cfac8b0c7` |
| 325 | MERGED | MATCH | 1 | 0 | untouched merged | `45f7063b68be865e76d5fa1e104cb4487eddab39` | `d624e44db8e2f8f15825566277ced51cfac8b0c7` |
| 326 | MERGED | MATCH | 2 | 0 | untouched merged | `264d7f198f00acf4f7de1edbb48bb3fa4f2bb8ec` | `3945770d22b808a1f67329a48da5355459a52004` |
| 327 | OPEN | UNIQUE | 28 | 28 | reopen | `a823c3cbdf6273fde4b34f37b990ca351d742030` | `5db6c00c186aecc6f752e22757fec1a9911e29e5` |
| 328 | MERGED | MATCH | 3 | 0 | untouched merged | `8e5a58799292d6ae14aa3663485fa294c43d6a9b` | `fdd5f3013384e8521149e8cfdeeaec0315c7a218` |
| 329 | MERGED | MATCH | 2 | 0 | untouched merged | `c81f29d1c45a03bd7fbf9c698dbe8a834350b600` | `e673573521f32a3cfeb5f564bda79d66ac1192be` |
| 330 | MERGED | MATCH | 0 | 0 | untouched merged | `c383a7e05ccccded6161247a077504d0119cd5a8` | `c383a7e05ccccded6161247a077504d0119cd5a8` |
| 331 | MERGED | MATCH | 4 | 0 | untouched merged | `3170987c78d60de267b54e86f1bc3f7a170abf6d` | `e673573521f32a3cfeb5f564bda79d66ac1192be` |
| 332 | OPEN | MATCH | 9 | 0 | close | `65f9cf5546e42616789a85aed7c6820d18c08cc0` | `c383a7e05ccccded6161247a077504d0119cd5a8` |
| 333 | MERGED | UNIQUE | 1 | 1 | untouched merged | `74ce0d256d9bfcc291ac183075c58908d554aecf` | `50d05ff381c7656da642ce818ab7d744c1f98608` |
| 334 | MERGED | UNIQUE | 3 | 2 | untouched merged | `a4d0b05a5d1f4fb5274773a6d6a46d4ad82a826e` | `c383a7e05ccccded6161247a077504d0119cd5a8` |
| 335 | MERGED | MATCH | 1 | 0 | untouched merged | `02bd4ec94718ad6f8485a0ca5efcac744927e840` | `50d05ff381c7656da642ce818ab7d744c1f98608` |
| 336 | MERGED | MATCH | 9 | 0 | untouched merged | `30c4144f373d658fd86026d904ac23441f9e73cc` | `9c2a43e2ed63254a94ae698cac52c476a3fb2653` |
| 337 | MERGED | MATCH | 0 | 0 | untouched merged | `33bc9a0cc364cd1650b9a4a4816800d47b04181a` | `33bc9a0cc364cd1650b9a4a4816800d47b04181a` |
| 338 | CLOSED | MATCH | 0 | 0 | leave closed | `3cc561639eab9dac789f9d2c86acfdaebf316fa8` | `3cc561639eab9dac789f9d2c86acfdaebf316fa8` |
| 339 | CLOSED | MATCH | 0 | 0 | leave closed | `ecc1c292c9d93be94777c720cabd2a9e9b8b68eb` | `ecc1c292c9d93be94777c720cabd2a9e9b8b68eb` |
| 340 | OPEN | UNIQUE | 6 | 6 | leave open | `3795b5605b14cd5b34167fa1b3e25697ce651eb1` | `ac76f90261f168c39420d79a3ff89661b45e915e` |
| 341 | OPEN | UNIQUE | 2 | 2 | leave open | `cd01c7470285ae0867925d274b55dafc2c53ead3` | `4dd4ba9bfc6449204aedb9ccdf271b890a2dd0ec` |
| 342 | MERGED | MATCH | 0 | 0 | untouched merged | `ee1b1118ae84f2663b86a9f58e8cd5e522dd1328` | `ee1b1118ae84f2663b86a9f58e8cd5e522dd1328` |
| 343 | MERGED | MATCH | 0 | 0 | untouched merged | `82e86fc4efbb99ba6a9a307162489a5f0a57c7eb` | `82e86fc4efbb99ba6a9a307162489a5f0a57c7eb` |
| 344 | MERGED | MATCH | 0 | 0 | untouched merged | `44f3cd01ef7a651ec7b73ab15e711a45a708b4a0` | `44f3cd01ef7a651ec7b73ab15e711a45a708b4a0` |
| 345 | OPEN | UNIQUE | 606 | 604 | leave open | `4adb54ef70e0ef709a8c950ae1cc79db9c80b87e` | `10dc9d536775b6fbb0e39382e98a5ae2285df07d` |
| 346 | absent | ABSENT |  |  | none |  |  |
| 347 | absent | ABSENT |  |  | none |  |  |
| 348 | absent | ABSENT |  |  | none |  |  |
| 349 | absent | ABSENT |  |  | none |  |  |
| 350 | absent | ABSENT |  |  | none |  |  |
| 351 | absent | ABSENT |  |  | none |  |  |
| 352 | absent | ABSENT |  |  | none |  |  |
| 353 | absent | ABSENT |  |  | none |  |  |
| 354 | absent | ABSENT |  |  | none |  |  |
| 355 | absent | ABSENT |  |  | none |  |  |
| 356 | absent | ABSENT |  |  | none |  |  |
| 357 | absent | ABSENT |  |  | none |  |  |
| 358 | absent | ABSENT |  |  | none |  |  |
| 359 | absent | ABSENT |  |  | none |  |  |
| 360 | absent | ABSENT |  |  | none |  |  |
| 361 | absent | ABSENT |  |  | none |  |  |
| 362 | absent | ABSENT |  |  | none |  |  |
| 363 | absent | ABSENT |  |  | none |  |  |
| 364 | absent | ABSENT |  |  | none |  |  |
| 365 | absent | ABSENT |  |  | none |  |  |
| 366 | absent | ABSENT |  |  | none |  |  |
| 367 | absent | ABSENT |  |  | none |  |  |
| 368 | absent | ABSENT |  |  | none |  |  |
| 369 | absent | ABSENT |  |  | none |  |  |
| 370 | absent | ABSENT |  |  | none |  |  |
| 371 | absent | ABSENT |  |  | none |  |  |
| 372 | absent | ABSENT |  |  | none |  |  |
| 373 | absent | ABSENT |  |  | none |  |  |
| 374 | absent | ABSENT |  |  | none |  |  |
| 375 | absent | ABSENT |  |  | none |  |  |
| 376 | absent | ABSENT |  |  | none |  |  |
| 377 | absent | ABSENT |  |  | none |  |  |
| 378 | absent | ABSENT |  |  | none |  |  |
| 379 | absent | ABSENT |  |  | none |  |  |
| 380 | absent | ABSENT |  |  | none |  |  |
| 381 | absent | ABSENT |  |  | none |  |  |
| 382 | absent | ABSENT |  |  | none |  |  |
| 383 | absent | ABSENT |  |  | none |  |  |
| 384 | absent | ABSENT |  |  | none |  |  |
| 385 | absent | ABSENT |  |  | none |  |  |
| 386 | absent | ABSENT |  |  | none |  |  |
| 387 | absent | ABSENT |  |  | none |  |  |
| 388 | absent | ABSENT |  |  | none |  |  |
| 389 | absent | ABSENT |  |  | none |  |  |
| 390 | absent | ABSENT |  |  | none |  |  |
| 391 | absent | ABSENT |  |  | none |  |  |
| 392 | absent | ABSENT |  |  | none |  |  |
| 393 | absent | ABSENT |  |  | none |  |  |
| 394 | absent | ABSENT |  |  | none |  |  |
| 395 | absent | ABSENT |  |  | none |  |  |
| 396 | absent | ABSENT |  |  | none |  |  |
| 397 | absent | ABSENT |  |  | none |  |  |
| 398 | absent | ABSENT |  |  | none |  |  |
| 399 | absent | ABSENT |  |  | none |  |  |
| 400 | absent | ABSENT |  |  | none |  |  |

## Closed: #332 matching blobs

Head `65f9cf5546e42616789a85aed7c6820d18c08cc0`, merge-base `c383a7e05ccccded6161247a077504d0119cd5a8`. All nine changed files have the same token on `FETCH_HEAD` and `origin/close-final-candidate`.

- `modules/sucafina/Sucafinav1/product/documents/parser.ts` `7fece85708178f1394027ffa47cf0cfc49d45a02`
- `modules/sucafina/Sucafinav1/product/interface/import-http.ts` `f6b4f6175abcd3a00714dcdbf3997f040304dfc5`
- `modules/sucafina/Sucafinav1/runtime/local-backups.ts` `03003d4e7f7db1e07fcefb2428b2403ab1b70304`
- `modules/sucafina/Sucafinav1/runtime/local-jobs.ts` `64d1dd5fb32152ca34d0eda31cba14e712d68380`
- `modules/sucafina/Sucafinav1/test/document-parser-resilience.test.ts` `ab92f216653b33deed4d6342ff745a58926b6300`
- `modules/sucafina/Sucafinav1/test/fixture/parser-probe-worker.ts` `376e9066675cf043177ef30b95337b116c944aae`
- `modules/sucafina/Sucafinav1/test/fixture/parser-ready-hanging-worker.ts` `e70c0e5d009d13d55577bf83ba2a72d1ba290dc6`
- `modules/sucafina/Sucafinav1/test/import-http-admission.test.ts` `d3c3044f558e27f14bc842999f0158e88a88142e`
- `modules/sucafina/Sucafinav1/test/local-maintenance-resilience.test.ts` `165dc54682b7484b1c21f04b697bbc7a06c865f1`

## Already closed matches

- `#338` head `3cc561639eab9dac789f9d2c86acfdaebf316fa8`, merge-base equal to head, `git diff --name-only` empty.
- `#339` head `ecc1c292c9d93be94777c720cabd2a9e9b8b68eb`, merge-base equal to head, `git diff --name-only` empty.

## Unique files

Token pair is `FETCH_HEAD` then `origin/close-final-candidate`. `MISSING` means `git rev-parse` failed because the path is absent.

### #281 MERGED differ 24 of 267

- `.github/workflows/sf-ci.yml` `7179c35515d949b67584be0420e7c39bb9c8e69b` `8f05ac6f081d0b6e89de5f2047718dc93d626973`
- `.orchestra/skills/sf-finance-user-qa/SKILL.md` `63f0b90398b5912357ba69873454381cdf1898ad` `39b0c047820d5f20dbc6193e40fbd2793527edcc`
- `.orchestra/skills/sf-user-journey-qa/cap/cap01-05/cap03-n01/SKILL.md` `1e325336cf212d0a4fce4218d2f4a4cf9c01bd1f` `bc04eee3e3bf4b179822456d60b51ebeb96be268`
- `.orchestra/skills/sf-user-journey-qa/cap/cap01-05/cap03-p01/SKILL.md` `26c8744e8ac56fa28a423c075c6583f380144026` `7c84fd62404632e9678cc8d738e5385f1da82c01`
- `.orchestra/skills/sf-user-journey-qa/cap/cap01-05/cap04-n01/SKILL.md` `f37a0d5ca7604714751b50f5ae08723717b0c641` `fddc648367b8be5f2a68e9c7e3acf4d0e458452e`
- `.orchestra/skills/sf-user-journey-qa/cap/cap01-05/cap04-p01/SKILL.md` `487c596305f80c03cdb2b028b88d606e0cb0709b` `ed0cece05c52aa2667b4930ec4d61a02cd98e14a`
- `.orchestra/skills/sf-user-journey-qa/cap/cap01-05/cap05-n01/SKILL.md` `f1bc58a06a337bed047aa297e988cdfca7163cd1` `e0d370569b91f3447f6677a3d6dd86dd52af933a`
- `.orchestra/skills/sf-user-journey-qa/cap/cap01-05/cap05-p01/SKILL.md` `724309a6144172fc0dd217b20c2232c512317871` `09717e677732b34b43c44e84e2b182fe1c89577b`
- `.orchestra/skills/sf-user-journey-qa/cap/cap16-20/cap18-n01/SKILL.md` `ff1194b56a502bc6b5e82c2fcc02eaea3812e219` `6a9670ecbdc90e34f10a9f838b72c4c698064a0b`
- `.orchestra/skills/sf-user-journey-qa/cap/cap16-20/cap18-p01/SKILL.md` `076a8940c6a5d4e63cd78f62cb2eb9d7dcb40e70` `dcfcb04d0f274c0fc12ee822432c0b10df56c526`
- `.orchestra/skills/sf-user-journey-qa/cap/cap21-25/cap23-n01/SKILL.md` `b273a593066168c9c6e1c0f9e6c5c5dd88bc77ef` `91a3cd3507b1bbbb433827df45d46ed56e4c9b13`
- `.orchestra/skills/sf-user-journey-qa/cap/cap21-25/cap23-p01/SKILL.md` `bfd263506bd7796fe53cabe32cdd0628bd4b2118` `446cf9b8a61cf11b2a2443204e0a47a56159a516`
- `.orchestra/skills/sf-user-journey-qa/e2e/e2e019-027/024/SKILL.md` `f961b6af542d50bf72757d3d0fb46bdb15cbcdef` `73df60cc496b8ae449cc3f51b5c927cb53b260c2`
- `.orchestra/skills/sf-user-journey-qa/groups/reviews/SKILL.md` `e2a43c4943d5863d341b8576feced1586ec903a1` `896bfbc6ab05737bfb7a98d3988d5215c8c8eb0f`
- `.orchestra/skills/sf-user-journey-qa/ui/ui49-53/ui50-n01/SKILL.md` `0479b8a68faf693b77ea005a475bcc149883ab58` `7e60512767ff663e88138ea1ec66ee9a41dafd15`
- `.orchestra/skills/sf-user-journey-qa/ui/ui49-53/ui50-p01/SKILL.md` `92ecc2e0db4afa749b59f96c522bb6d92d97f5fc` `6a73f984227776bde81a1795884be5e47722e074`
- `docs/qa/sucafina/uat-cio/QA-TRACEABILITY.json` `d5bc59038f50ea0633a801483f8d81b98a584acf` `b585b389de8471664cc4daddf50fac396d94c829`
- `docs/qa/sucafina/uat-cio/README.md` `f71a5934ddd53749cd7b857f46d615a4c03d54cc` `5f702b1027a6fa7f7f3dd41122c790e0fb0aa14c`
- `docs/qa/sucafina/uat-cio/STORIES-END-TO-END.md` `52b394e8a171b2f6af16ed2db0af6e4e0a70db5d` `f7993946de0e5452dd4e8731cfb633eb6e44ef9c`
- `docs/qa/sucafina/uat-cio/TEST-STRATEGY.md` `698a53adbbf729447c7a40ba9ec1824305190648` `6b6aa7883ea4d807770673e5982ffb5e7e816055`
- `docs/qa/sucafina/uat-cio/quality-v2/STEP-LEVEL-DOSSIERS.md` `7b6b00b2bcad064d35a0ad3af7436d89cbdb0d0d` `f0d22455c067acfa031b49b33138767b7913b835`
- `docs/qa/sucafina/uat-cio/scripts/validate_qa_pack.py` `73f2bcc734940c35514cb512bb57a770d47fe578` `05e16cdbc099b42cfedc7a0423a49bedd788bfef`
- `docs/qa/sucafina/uat-cio/stories_70x2.jsonl` `df262801ed56dde149f538508c65ca14f61f1df7` `1df3705f595d4e59f58a65213ebbef9e1d80b703`
- `docs/qa/sucafina/uat-cio/stories_e2e.jsonl` `d21136c91e7880ef5cbefd7aaba15caa71047b04` `97985a5c291fd878bf6d7615a40cdd2a66196f93`

### #282 MERGED differ 5 of 5

- `.github/workflows/sf-ci.yml` `f8ee50138705ba93f1c3674936acc880fa59b94b` `8f05ac6f081d0b6e89de5f2047718dc93d626973`
- `sf/ci/GPT-PLAN-10.md` `b8b8c99d14f4a5105b82aa95fa02673a67a24380` `c8b91806ee7930d846b8c40d51cedeb0090ce0ad`
- `sf/ci/coverage-notes/e2e-inclusion.md` `2803b318cf71ba264a00f7f57657003f8c265f5d` `MISSING`
- `sf/ci/coverage-notes/guard-base-comparison.md` `ccac349d4dd128dc6c0a4a39599ab5a3ab9bd895` `MISSING`
- `sf/ci/coverage-notes/recipe-equivalence.md` `c6fab9aa247ad6007ddb7595b0c5155b602b574a` `MISSING`

### #283 MERGED differ 1 of 5

- `.github/workflows/sf-ci.yml` `47c7fcc0dc400a8666f7b450f4463c5793480590` `8f05ac6f081d0b6e89de5f2047718dc93d626973`

### #284 MERGED differ 1 of 1

- `.github/workflows/sf-ci.yml` `e7d1137d59248d6a49e347408ad074337f4407a8` `8f05ac6f081d0b6e89de5f2047718dc93d626973`

### #286 MERGED differ 6 of 17

- `apps/cli/script/distribution-payload.ts` `cfc62ae5e3a4e3d6399cef6a8e96b2329a30d602` `ca9edcafc0e654c57b3cbfca224878c38f0359a2`
- `apps/cli/src/sucafina-product/host-context.ts` `20fd35fb72843647aba38592cdedfa59a12dd00e` `13b7db59d3f305bc2ecf83acdd343099ffb1c5e0`
- `apps/cli/src/sucafina-product/installation.ts` `2eb01a18503385f3c82567326ddf3d86e9a90b35` `9a9c6df0d5b450224baceefe443d84ca3d494a59`
- `apps/cli/test/distribution-web-native.test.ts` `2c72db84605c33bd19d04ea5eb023d271f2578f1` `550a84c826aebd935d3d4c6ab6a5e2b64c523728`
- `apps/cli/test/distribution-web.test.ts` `74ce1253e30c52d15369360114f8cab4e3b77936` `8ceef2a78929e16af952d95c15d79d9b159d895d`
- `modules/sucafina/Sucafinav1/local/entry.ts` `4a0b659eb0249529a5491e2622ea83663ac0d36f` `e9e374960600212bd8d6e8e0a37f2ff45f63c21d`

### #287 MERGED differ 5 of 9

- `packages/app-shell/src/orchestra/chapters/sucafina/context/index.tsx` `2524005246033f35969be97160fdbc550c3be08c` `8638f3bb5b37ee26fa8c8981793380f0c72c2fca`
- `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx` `cbda1afa5b20d113a64c81690bc9d47d54f9e588` `53a40de7452d8a67c72a6651acb8389a550fb9c7`
- `packages/app-shell/test-browser/sucafina-native/draft-quarantine.test.ts` `beb1314c7217720f1e819ddb9ae268f041dc549a` `e058f78c1bbcaec5038bd1f1e272b386b2a64166`
- `packages/app-shell/test-browser/sucafina-native/transport-contract.test.ts` `4d5b4f3503f9817e3b7a07e3f267316012efb3da` `5c2fd204149dc65160abcae9b2c815fbbe594d0d`
- `sf/ci/suites.json` `e9d1cfa42c9b5d0e4441ad9e5fc3d26811373452` `63f18aeb7b0df778b17b7fa3ed726f903cbc0622`

### #288 MERGED differ 4 of 5

- `.github/workflows/sf-ci.yml` `fb0029397c801a14b225c6e57bb42256be788357` `8f05ac6f081d0b6e89de5f2047718dc93d626973`
- `script/sf-ci/gate.mjs` `5838fb11a86e4c19ee637f33fd8a4290c7ada2e9` `1ccf87ef27dcf7b374b9c970494f8fc18cf3695e`
- `script/sf-ci/gate.test.mjs` `0b4cc853f1ffa553ed84e806490cfd60ed4cb5e4` `320db6a06bb5db8ee7ff1ce3a96eeedcc213b48d`
- `sf/ci/suites.json` `955dbeb0ec7cb89a54af3da53354bd111b4fcb0b` `63f18aeb7b0df778b17b7fa3ed726f903cbc0622`

### #289 OPEN differ 10 of 14

- `.github/workflows/sf-ci.yml` `a109dbc19b2748a9db8328c45d0601bf8d3daf6f` `8f05ac6f081d0b6e89de5f2047718dc93d626973`
- `apps/cli/src/sucafina-product/decision-domain-http.ts` `659eabe019805849e3a57fe53c10072d3a50d5df` `5cb8e4e45c1e68af4c59ec096b499ed0907f6c66`
- `apps/cli/src/sucafina-product/decision-domain-services.ts` `b70dcb7b9753954a714096597da6c8d3eda7c51b` `9f8cd652fca2bc771e2ee6fa5c8a1e9df373a592`
- `apps/cli/src/sucafina-product/portfolio-authority.ts` `11dc0e69c8e3b5a07074bceb33a92e39d0d43338` `138238ca9273e84f39f8e1db484378a3e62d41d4`
- `modules/sucafina/Sucafinav1/product/decisions/comparison.ts` `eaf44e5937a539a446a29cc450fd4b63cd52e894` `8d86bc416c711169fdc678635cc5eed12481fdea`
- `modules/sucafina/Sucafinav1/runtime/procurement.ts` `5b737d813c4457c344e967c581b0c76b79cd390d` `0b45547ca50e672dc84d37223a662efb7222e241`
- `packages/app-shell/e2e/sucafina/decisions-support/journey.ts` `eba5c0704a3940d9a44d3926dc4ca45b398f4ea9` `d349726f3eeb19db47e34861de2fd2f669882b3d`
- `packages/app-shell/e2e/sucafina/decisions-support/planner-sources.ts` `b039ffd879d133ca042a759820b36f3030ad9521` `a7474e92dae7623da0e4af89b2abbf2b31fbaf0e`
- `packages/app-shell/e2e/sucafina/decisions-support/procurement-source.ts` `de9d94e28057cbb343aee651ae2fc7c8ab2ccff4` `3d8327c576b21f8813769960eb8a93fb757cea93`
- `packages/app-shell/e2e/sucafina/wp03/installation-fixture.ts` `467074efa326f3774029368b2ae2a96e3fc72662` `649071bfb59dcd0a7d7c63ac81dc3d39113e06df`

### #290 OPEN differ 42 of 44

- `modules/sucafina/Sucafinav1/docs/sf2h/receipts/http-body-limit-fix/composition/microsoft49-installation-reconciliation-01.json` `dab2c9fa8505fb83cc455b0b7607ddfeeb49bbe3` `MISSING`
- `modules/sucafina/Sucafinav1/runtime/contract.ts` `a6ace74dc5159f5870d5496936337c6d50b369b7` `8be1156b64e957eae4670f7ad1bb6cd51e61e649`
- `modules/sucafina/Sucafinav1/test/business-browser.test.ts` `2b45e7b4a1c1afb3c5fd0816afb834f331fa57b9` `2949c56347cd55cd404fea1c7a3418b89b1543a3`
- `modules/sucafina/Sucafinav1/test/form-layout.test.ts` `d049515c795df3536d2b03232b60f113bcad759f` `017f90d16b373971e45cda8db634e0984c9d12ba`
- `modules/sucafina/Sucafinav1/test/installation.test.ts` `81a291feb0b4abe9703395bacea2dd3935ec1304` `dd8ad154a36b014f106f90ffe70b2b823435f766`
- `modules/sucafina/Sucafinav1/test/io-browser.test.ts` `b98e863997e2787c22fb41df88ec56da9f8c0fa9` `def57f27a01943e623aae6d8dca733dffd6a4f66`
- `modules/sucafina/Sucafinav1/test/microsoft-login/integration-fixture.ts` `00ecbb65fe8b43ecc824913564dd06a35b844d37` `6aec0d65da787030ddd94fc14b474a05c865a1a3`
- `modules/sucafina/Sucafinav1/test/microsoft-routes.test.ts` `b1a9a02f23169e352e0a5fa0fd4fc88f9dad573a` `dad523572076009e91a2605afd96dc6cb11c6047`
- `modules/sucafina/Sucafinav1/test/operator-browser.test.ts` `2fed7d88ed09be911d7a9a4557ea0877992eac9d` `e2695004b81956efd3e82cb9bc8245c217ed7a58`
- `modules/sucafina/Sucafinav1/test/presentation.test.ts` `2fbcb12b5ce7ff55e36711ac4920edd2d0576aaf` `e2c4335e02974bef2092cb6a2440742e55b5c870`
- `modules/sucafina/Sucafinav1/test/product/forecast-cancel-visibility/fixture.ts` `fc32be217ecd5d966af80e83237a0f0638c94024` `3f7fdbc50bd1e879a84008a5cf7acc95a2e5d346`
- `modules/sucafina/Sucafinav1/test/product/forecast-cancel-visibility/journey.ts` `5a0974e1db22115345750b11861b727db9bba90f` `bb70fd8e7da9db90fdd4851078beade6191ad507`
- `modules/sucafina/Sucafinav1/test/product/ui-ack-completion/ordinary-thread.test.ts` `e2a7bf62f7bf929abe31e51b01f9f505973a71b1` `c440ee01904089d463e664aa59eec352d60fe5e1`
- `modules/sucafina/Sucafinav1/test/product/ui-ack-completion/recipient-recovery.test.ts` `c10440b7e0a08cbd09b4982db18b5b8bb32c7a90` `d343ca2eb20faa63bab9c3e31487fab089c24ce9`
- `modules/sucafina/Sucafinav1/test/product/ui-ack-completion/recipient-refusal.test.ts` `c68152d42bceb6fd9062588b3264ab1e755f71d2` `a5d4d5ad97bc23d0a952ff4217af73ab6b84e6f3`
- `modules/sucafina/Sucafinav1/test/product/ui-ack-completion/source-replacement.test.ts` `1f12c67545ada196c847b01079cae8c9c0a2a4cd` `e375041217437ac5fc4c8018a78d31b7fd91a054`
- `modules/sucafina/Sucafinav1/test/product/ui-split/ui-work/exact-confirmation.test.ts` `ac551dbd64c4c270c9e25f5c6ac3398a618435cb` `adc0b32bd43eab6823b2ab8af99b79160e1508d2`
- `modules/sucafina/Sucafinav1/test/product/ui-split/ui-work/reply-identity.test.ts` `9af14f581fad7b15c17f76327e63d1c60cb2d82d` `56bd09d4d53b5491917fd917a63a3d1b1111d18e`
- `modules/sucafina/Sucafinav1/test/product/ui-split/ui-work/selection-recovery.test.ts` `3ee93d339e528ae0adbb6b21668144a05d393710` `132303aedbcb5524262aeacf0dec294b91be4290`
- `modules/sucafina/Sucafinav1/test/product/work-split/work-g03/g03-conflict-review.test.ts` `878a23d475773901f3442843672b404f34e31561` `38042d9ad60e65c411c0024c77faf0194bb6163f`
- `modules/sucafina/Sucafinav1/test/product/work-split/work-reuse/confirmation-diagnostic.test.ts` `3aa6ad0b69c0fa0fc339942a832b070e13086816` `7e1c6339d8f10d896e5d9f48dedeb268a0deee48`
- `modules/sucafina/Sucafinav1/test/product/wp01/README.md` `7c2fb5df7b81c97de739883fd8a87a00cb98a7d1` `4bca9c1ef90e07e4167292d612cc55cc6330f26f`
- `modules/sucafina/Sucafinav1/test/product/wp01/browser-fixture.ts` `dee6bee7325e09c3b5064689e2cadf9cddc056c6` `156beb2d4ea52e4312c3bfb3c3298bcc32edfc0e`
- `modules/sucafina/Sucafinav1/test/product/wp01/browser-lifecycle.test.ts` `b900ecab1e680372096942f4b0e15bf1c48f467d` `260151909d86dfc77f6dc3229b660e63e5745033`
- `modules/sucafina/Sucafinav1/test/product/wp01/browser-startup.test.ts` `77d08ed75b1ab3571d0646dddfe88afd43ae6138` `f681ca2a663d0540898c4b4472dce86355ef20ae`
- `modules/sucafina/Sucafinav1/test/product/wp01/case-work-selection.test.ts` `653e81ec78fa19238fd53913d7bc2e26aaa5cae0` `3699a3c9c3206e86878770768a2399fc49d11618`
- `modules/sucafina/Sucafinav1/test/product/wp01/decision-conflict-recovery.test.ts` `1b8c4e257a5afaa01435b9178055680c347b5fd0` `70f1f6e634c92cd23a271d653ede0bf305bd22a7`
- `modules/sucafina/Sucafinav1/test/product/wp01/decision-mutations.test.ts` `3bf093319e1393bddb4de29a97d457d79be8d5a2` `393b34550b39c796a4bd7125162eba1c2fae806b`
- `modules/sucafina/Sucafinav1/test/product/wp01/portfolio-recovery.test.ts` `0413accf37ab70703d468184f39ca0b5d67f7ce5` `712645acac294d0d3a8dc3a87f83b656189c9201`
- `modules/sucafina/Sucafinav1/test/product/wp01/question-recipients.test.ts` `5971661338663ce06b12e15eba09fe4a31740877` `b47b29497f2ec9a2673bfbb299829191de32622f`
- `modules/sucafina/Sucafinav1/test/product/wp01/record-search.test.ts` `1b5164d7c5ee988aec07254140a16e4d7ee500ef` `6706c7753cc241889195d65622ee7e0c4d38eb6a`
- `modules/sucafina/Sucafinav1/test/product/wp01/shell-recovery.test.ts` `f140ef854668977190ba05d6f2cd2f5a729511ea` `e5c3e7f569b3009de9b4aaed27a3231ddd089736`
- `modules/sucafina/Sucafinav1/test/product/wp01/shell-refresh.test.ts` `161ffd951c73dbae6b344521d8cdde959a6c0161` `8fca620410456af1ad786ee9f7739ff5642b19b7`
- `modules/sucafina/Sucafinav1/test/product/wp01/shell-state.test.ts` `d99e601047fa8842469bd9bfa7d1d15e5aa5a734` `10fe1c087aae8b4f9d19124634676cd3840f69d8`
- `modules/sucafina/Sucafinav1/test/product/wp01/thread-recovery.test.ts` `73f1b384e52945ba07adf6fd7dac2a05a54799a0` `a5f684fed8b90cf44e0c54dad39572284835a494`
- `modules/sucafina/Sucafinav1/test/product/wp01/two-actor-conflict.test.ts` `83473b61189ace45ae22dd0226591461a01d0965` `04132b4a9225057fcdb33868e5e3a22f24115363`
- `modules/sucafina/Sucafinav1/test/product/wp01/unavailable-views.test.ts` `b9f75fb0b2eaa4dd24f40bdf0f2966f0cde76d93` `5b3c1e1115a81a9d880ee08f9d8c28b6c55b6e2b`
- `modules/sucafina/Sucafinav1/test/product/wp01/work-destination-recovery.test.ts` `8b4db0ae48e526b0478dbf528acf775faa302508` `f90a6f1a4663e90a9ab8fe354be781baf4e94d78`
- `modules/sucafina/Sucafinav1/test/product/wp02/workbench-ack.test.ts` `2b3072a5fd3103ec45d471fa1d7dcb6900b1109f` `4d7823be0abff16b4505910d080b47cf7cb96522`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/forecast-submit.test.ts` `d98a12371c698a2299c4838f423e635d64942c79` `b312f2dda7029b79c7420af91d52ca6fec1b098d`
- `modules/sucafina/Sucafinav1/test/s1.test.ts` `7a90c4662aad5aa25d87f5d9dbd04f791edfcacc` `ac391979eb8d5248532049a5fc15c1dc28448246`
- `modules/sucafina/Sucafinav1/test/visual-layout.test.ts` `6e3159e923b143be811a1231d15d64e86cd202dd` `d809fa195f3932c90b4ff64df0fab258f49fba5a`

### #291 MERGED differ 8 of 17

- `apps/cli/script/distribution-payload.ts` `cfc62ae5e3a4e3d6399cef6a8e96b2329a30d602` `ca9edcafc0e654c57b3cbfca224878c38f0359a2`
- `apps/cli/script/factory-receipt-check.ts` `c9ff1c0d1936bf2e907d781d49c31cba38587c11` `5de5bb26c7196fb1ed1f4d5ff4d3e030f4e90888`
- `apps/cli/src/sucafina-product/host-context.ts` `20fd35fb72843647aba38592cdedfa59a12dd00e` `13b7db59d3f305bc2ecf83acdd343099ffb1c5e0`
- `apps/cli/src/sucafina-product/installation.ts` `2eb01a18503385f3c82567326ddf3d86e9a90b35` `9a9c6df0d5b450224baceefe443d84ca3d494a59`
- `apps/cli/test/distribution-web-native.test.ts` `2c72db84605c33bd19d04ea5eb023d271f2578f1` `550a84c826aebd935d3d4c6ab6a5e2b64c523728`
- `apps/cli/test/distribution-web.test.ts` `74ce1253e30c52d15369360114f8cab4e3b77936` `8ceef2a78929e16af952d95c15d79d9b159d895d`
- `apps/cli/test/factory-distribution-linux.test.ts` `6f4e8c4e616190321404946808bb29bcbbe0b9ae` `266ed73a79babb3726351d815752c033fedfcbe9`
- `modules/sucafina/Sucafinav1/local/entry.ts` `4a0b659eb0249529a5491e2622ea83663ac0d36f` `e9e374960600212bd8d6e8e0a37f2ff45f63c21d`

### #293 OPEN differ 16 of 25

- `apps/cli/script/distribution-payload.ts` `cfc62ae5e3a4e3d6399cef6a8e96b2329a30d602` `ca9edcafc0e654c57b3cbfca224878c38f0359a2`
- `apps/cli/script/factory-receipt-check.ts` `657c8747ad75e4482d8b06726bac119768e60b42` `5de5bb26c7196fb1ed1f4d5ff4d3e030f4e90888`
- `apps/cli/script/repro-login-403.ts` `a3e5dedcee51570e6b4441f9b534dfd5ea1fba95` `MISSING`
- `apps/cli/src/sucafina-product/host-context.ts` `20fd35fb72843647aba38592cdedfa59a12dd00e` `13b7db59d3f305bc2ecf83acdd343099ffb1c5e0`
- `apps/cli/src/sucafina-product/installation.ts` `2eb01a18503385f3c82567326ddf3d86e9a90b35` `9a9c6df0d5b450224baceefe443d84ca3d494a59`
- `apps/cli/test/distribution-web-native.test.ts` `2c72db84605c33bd19d04ea5eb023d271f2578f1` `550a84c826aebd935d3d4c6ab6a5e2b64c523728`
- `apps/cli/test/distribution-web.test.ts` `74ce1253e30c52d15369360114f8cab4e3b77936` `8ceef2a78929e16af952d95c15d79d9b159d895d`
- `apps/cli/test/factory-distribution-linux.test.ts` `b1fe6a722d029a5763f5625bed269082b27545f7` `266ed73a79babb3726351d815752c033fedfcbe9`
- `apps/cli/test/sucafina-host-context.test.ts` `df60dc155baa996f69022f267099adc9f04c3558` `4d038580458b0fd18a78ac696c3a126b4f117ad2`
- `modules/sucafina/Sucafinav1/local/enroll.ts` `616d3d84afaf58e5f9bdd28c50d20270e2bcc7fa` `6c1728044af046bf2472144f4d8ecfef58ce982c`
- `modules/sucafina/Sucafinav1/local/entry.ts` `ec6130a2d5ad6b6c8e4db75d91dde86d253412ea` `e9e374960600212bd8d6e8e0a37f2ff45f63c21d`
- `modules/sucafina/Sucafinav1/runtime/local-configuration.ts` `9b3feb0152a1c175fae004a2ea5bbbd80350195b` `9fd36deee7a2ef4b3584faa7f49b682d0304741f`
- `modules/sucafina/Sucafinav1/runtime/operator-identity.ts` `7041209016760d391ccd94ca0adfb1ef864a6408` `ec9da845f186bc48f57f4611b8d08429f00169f1`
- `modules/sucafina/Sucafinav1/test/local-entry.test.ts` `4c1c99169a5acd2faf861ac66d8fa66b84deddcb` `bf57cb46b12446f8ff6d271f0b9f27b7ef995d19`
- `modules/sucafina/Sucafinav1/test/operator-enroll.test.ts` `163203c713f367ffd38521c7693e7fcebd65229e` `d0cb78bfc1812f3880e22e3bbed460dca9af4196`
- `modules/sucafina/Sucafinav1/test/operator-identity.test.ts` `26be95a667c3ccb246b45de339dce0e0fee81a61` `23e3db0071c676e8aa4bc93daeb8fe3e68129466`

### #294 MERGED differ 8 of 14

- `.github/workflows/sf-ci.yml` `2a50b07eb635f75c5e48b2572907dae424170c2e` `8f05ac6f081d0b6e89de5f2047718dc93d626973`
- `modules/sucafina/Sucafinav1/runtime/application.ts` `6de4834850423a541e373bb51c6bd9e970626a8d` `a0deff8a3b272019f472aa2f93499d1940a78370`
- `modules/sucafina/Sucafinav1/runtime/entra-client.ts` `5efab3c06095b8bd3c746281bc247c0a21414642` `4d149f3947cdb2bc697ebed8849a3c91337c398f`
- `modules/sucafina/Sucafinav1/runtime/microsoft-installation.ts` `bffa2c3dcda0759385c05f53b5af1a0a038f1985` `6e3b56e13795b60949bc14548921c37af16b615f`
- `modules/sucafina/Sucafinav1/test/microsoft-entra-client.test.ts` `b545a6b3224ebe8d25ce0edfcdd1be9e749e5052` `17422dc0c812b22da51cc3bd6b57bb9e9ab01966`
- `modules/sucafina/Sucafinav1/test/microsoft-routes.test.ts` `e3d333fcddc31de10327836abbc9c900522dd602` `dad523572076009e91a2605afd96dc6cb11c6047`
- `script/sf-ci/gate.test.mjs` `fe18b0f8dcef64acde1a7a91fde765dc7d870e10` `320db6a06bb5db8ee7ff1ce3a96eeedcc213b48d`
- `script/sf-ci/workflow-contract.mjs` `2ff6dc0958397c549623d09007672065bb15905b` `b4fbb1cfc0d7c6472bcaeae499532e5bf834f9d1`

### #296 MERGED differ 3 of 8

- `modules/sucafina/Sucafinav1/product/reviews/render.ts` `653bcebf944dafb30bac88d83c7d7070a34e4998` `7010c9e5ec1f5300388408573b5ace1273662070`
- `packages/app-shell/e2e/sucafina/reports-support/production-installation.ts` `31ad26eb61aba3afd6bfc7db6262609a007cff55` `d3626790269abfaf6116440aeea77a979a6297da`
- `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts` `4374d97541062cf9d2a834bab73df29be4edab29` `a76262ff265b1f13ecfba7c6ab0784e6d94b4428`

### #297 OPEN differ 19 of 21

- `.github/workflows/sf-ci.yml` `41bf5a06e72642a5c3c724c5c9a65ded52f1124c` `8f05ac6f081d0b6e89de5f2047718dc93d626973`
- `modules/sucafina/Sucafinav1/test/business-browser.test.ts` `6d431a37065ef9ede480c92be7ba3693eefd5b42` `2949c56347cd55cd404fea1c7a3418b89b1543a3`
- `modules/sucafina/Sucafinav1/test/form-layout.test.ts` `6ec328d797618b13ba42ff40fe6e38028cee92ed` `017f90d16b373971e45cda8db634e0984c9d12ba`
- `modules/sucafina/Sucafinav1/test/installation.test.ts` `9e746c371523968c737954fea9bd83a1bf540fb5` `dd8ad154a36b014f106f90ffe70b2b823435f766`
- `modules/sucafina/Sucafinav1/test/microsoft-login/integration-fixture.ts` `6b61067a8752c35b765e689a545346ff6ece3c5b` `6aec0d65da787030ddd94fc14b474a05c865a1a3`
- `modules/sucafina/Sucafinav1/test/microsoft-login/microsoft49-installed-reconciliation.json` `24fb8614d339421f180a9ebd2f71fb570d9b9710` `11e134bf5a2ab2ec5349300b19339fa12e51705e`
- `modules/sucafina/Sucafinav1/test/microsoft-routes.test.ts` `b8294f60c3b42a877a74469887d667c2b4c1af02` `dad523572076009e91a2605afd96dc6cb11c6047`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/memory.test.ts` `0f030f357504843ad49f6726dc60ddd70342bbe9` `9d8a45cd2fe28b64fa21b2f89d91e37bd5f97f33`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/recall-health.test.ts` `a51aa5210fb2a916fd333641e08290df19c2b17b` `e09dc5b1dfc16dfc6852a4e80b8b23476554e40a`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/report-health.test.ts` `859a00ee8bb47394b16c2007be4dad2f3827b569` `44f9baa1dba82224a260f1660b654bdbaaee98fc`
- `modules/sucafina/Sucafinav1/test/presentation.test.ts` `fde0c4dfe47d1a29a3b0f19b2f8de6f93f018049` `e2c4335e02974bef2092cb6a2440742e55b5c870`
- `modules/sucafina/Sucafinav1/test/product/export-artifact-closure/fixture.ts` `b05e3f3389707b48e236a25e8b2c805719d114b0` `03c918632f8c7bf40e1b4bbb91e71a6ae3de74ac`
- `modules/sucafina/Sucafinav1/test/product/wp01/README.md` `6c865881d6960db5fcb1891db96b7ef47e866be5` `4bca9c1ef90e07e4167292d612cc55cc6330f26f`
- `modules/sucafina/Sucafinav1/test/product/wp01/browser-fixture.ts` `2bc9c89fcf28bb4789aa2c1e46c885dfff20cef8` `156beb2d4ea52e4312c3bfb3c3298bcc32edfc0e`
- `modules/sucafina/Sucafinav1/test/s1.test.ts` `e033a3e5282ecac30547345131eba117420b4d7c` `ac391979eb8d5248532049a5fc15c1dc28448246`
- `modules/sucafina/Sucafinav1/test/visual-layout.test.ts` `0d99910b0a5533648e4450a4ae561719fa81af19` `d809fa195f3932c90b4ff64df0fab258f49fba5a`
- `script/sf-ci/gate.mjs` `56ed63e192e20329f2b1eb4159d2b91a87212050` `1ccf87ef27dcf7b374b9c970494f8fc18cf3695e`
- `script/sf-ci/gate.test.mjs` `00bb6c0e3509a34ffc0d6cc1b867157772a616d5` `320db6a06bb5db8ee7ff1ce3a96eeedcc213b48d`
- `script/sf-ci/workflow-contract.mjs` `84cec07977c4018a61c09ee3889a24d0afdc17c8` `b4fbb1cfc0d7c6472bcaeae499532e5bf834f9d1`

### #299 MERGED differ 1 of 7

- `.github/workflows/sf-ci.yml` `7731aabb7d8175847503b7ba8a93c81b8aad5c28` `8f05ac6f081d0b6e89de5f2047718dc93d626973`

### #300 MERGED differ 2 of 3

- `packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx` `9c1175af4cdd29ac93081703efdb146221658782` `95bbda4324f635f7bb360dc40d6a40b2863f1bed`
- `sf/ci/suites.json` `58447ee9272baac0864e85330fe6a1aa6c1da176` `63f18aeb7b0df778b17b7fa3ed726f903cbc0622`

### #302 OPEN differ 3 of 3

- `apps/cli/test/sucafina-host-context.test.ts` `6443feb247f50875b08a657c920fc5b6491fa5ab` `4d038580458b0fd18a78ac696c3a126b4f117ad2`
- `modules/sucafina/Sucafinav1/runtime/procurement.ts` `d77cd85ff6b86996866ef1e11ad90fe655e8125b` `0b45547ca50e672dc84d37223a662efb7222e241`
- `modules/sucafina/Sucafinav1/test/product/wp04/queue-view.test.ts` `eaa10b7e57dd90e29f95d6250fc9a497e8e6f5ae` `7c2e638a90e088e81494665d2910ea780dd7b654`

### #303 MERGED differ 2 of 3

- `.github/workflows/sf-ci.yml` `86769fe84b54d3b783e5bee5dbfbc91d30d76876` `8f05ac6f081d0b6e89de5f2047718dc93d626973`
- `modules/sucafina/Sucafinav1/runtime/procurement.ts` `7f6d4573c9fd7810a5db5409661318a60adf4600` `0b45547ca50e672dc84d37223a662efb7222e241`

### #304 MERGED differ 5 of 15

- `modules/sucafina/Sucafinav1/test/installation.test.ts` `2d484a5d554ce9afdce2a4770b1df02d360ac49a` `dd8ad154a36b014f106f90ffe70b2b823435f766`
- `modules/sucafina/Sucafinav1/test/microsoft-login/integration-fixture.ts` `84067d72c3925268cbd91290403d09dabb7a78ca` `6aec0d65da787030ddd94fc14b474a05c865a1a3`
- `modules/sucafina/Sucafinav1/test/microsoft-routes.test.ts` `2fb3aeb46c2a9ace1cf99832d3e20d20263e7ed9` `dad523572076009e91a2605afd96dc6cb11c6047`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/report-health.test.ts` `24bdc721091421712e56781c4b87a7c9c41fe381` `44f9baa1dba82224a260f1660b654bdbaaee98fc`
- `modules/sucafina/Sucafinav1/test/product/export-artifact-closure/fixture.ts` `6ebea98002d97ce14cd18bc3a7f27cf0f1f3d481` `03c918632f8c7bf40e1b4bbb91e71a6ae3de74ac`

### #305 MERGED differ 2 of 2

- `sf/azure/runtime/ORCHESTRA-WEB-CUTOVER.md` `3e1a4623df4016746d3e9f4f76767f5d3c45c370` `6b794266ea5d47b86032c0febaff51d6a4c7f30a`
- `sf/ci/assemble-orchestra-web.mjs` `e4d76a643731b7cd132288f6623a45e578a2e38c` `34ed1aa2f74e4395bfa339ea0cc0af6565483820`

### #307 OPEN differ 7 of 12

- `apps/cli/src/sucafina-product/decision-domain-http.ts` `659eabe019805849e3a57fe53c10072d3a50d5df` `5cb8e4e45c1e68af4c59ec096b499ed0907f6c66`
- `apps/cli/src/sucafina-product/decision-domain-services.ts` `b70dcb7b9753954a714096597da6c8d3eda7c51b` `9f8cd652fca2bc771e2ee6fa5c8a1e9df373a592`
- `apps/cli/src/sucafina-product/portfolio-authority.ts` `11dc0e69c8e3b5a07074bceb33a92e39d0d43338` `138238ca9273e84f39f8e1db484378a3e62d41d4`
- `modules/sucafina/Sucafinav1/product/decisions/comparison.ts` `895d1c66c7854d50a11f4bd4328caf9f894d3946` `8d86bc416c711169fdc678635cc5eed12481fdea`
- `packages/app-shell/e2e/sucafina/decisions-support/planner-sources.ts` `f091ddee39fe2a6218c369f48d1d2c877a7cfdff` `a7474e92dae7623da0e4af89b2abbf2b31fbaf0e`
- `packages/app-shell/e2e/sucafina/decisions-support/procurement-source.ts` `076b1bb32aa018ce5032c47d59e273c709f45ff1` `3d8327c576b21f8813769960eb8a93fb757cea93`
- `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts` `a6ca30c68d79beccd67be4759ee9241b25f5a117` `a76262ff265b1f13ecfba7c6ab0784e6d94b4428`

### #309 MERGED differ 1 of 8

- `packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx` `c15bd4d6109bf3b3aa5ac4fe1d07e95111e9e609` `fd5e173de15a42431d5053d1fd132b593564752b`

### #310 MERGED differ 8 of 9

- `packages/app-shell/src/orchestra/chapters/sucafina/decisions/alternatives/eligibility.tsx` `f2d59b99941009baf358d2e6fec927192ad0b14b` `10fe29e76dd14bc178f0d34049b3cd998b8bb6cf`
- `packages/app-shell/src/orchestra/chapters/sucafina/decisions/alternatives/index.tsx` `3b72cbe62b8055ed6321a22d964a44f533028d97` `3e88cf1ae186b79a75934846bef5acc7298de0fd`
- `packages/app-shell/src/orchestra/chapters/sucafina/decisions/assumptions/divergence.tsx` `19e0c327b9c53606e430bde58da9425320499a53` `0b1733dd88a0e8fdf5ae50ef6b84348c785e12b2`
- `packages/app-shell/src/orchestra/chapters/sucafina/decisions/assumptions/index.tsx` `b8074af6c61b80271ea39f5f5a8df8a2a84d5fe2` `4cd6338b5e37179ff2168247f029f55bfd913a2e`
- `packages/app-shell/src/orchestra/chapters/sucafina/decisions/questions/answer.tsx` `6e0b82ff19fc3a9f0400aa81dcae3b5a6a0e81e5` `18845b33249392a9bb649d03de5c16b07e896a23`
- `packages/app-shell/src/orchestra/chapters/sucafina/decisions/questions/consume.tsx` `443cc65f53ccf7428aca491a89b84da5c0dc6db7` `3d83d70de2d0f2e0a1974f06d7eb9914da4c58f9`
- `packages/app-shell/src/orchestra/chapters/sucafina/decisions/questions/human-editor.tsx` `ed8055d803e8ae04f3d3260b2fbe98573897a1be` `c0fbb6483415338044bb011cdd0b45543106f758`
- `packages/app-shell/src/orchestra/chapters/sucafina/decisions/questions/index.tsx` `f5646fc91e1655e00a3bc363c06b94a2ad103ad2` `b19145f80487835f77bc74c7bc6fa64ac8e9df68`

### #311 MERGED differ 6 of 18

- `apps/cli/src/sucafina-product/host-context.ts` `024fe765249f6815d0fe6b97fbda0bcfcbbe542c` `13b7db59d3f305bc2ecf83acdd343099ffb1c5e0`
- `modules/sucafina/Sucafinav1/product/documents/scenario-links.ts` `5b93b9c54a5ed8add23de4d046fac84e9e257ed8` `2dedc1eb90593e1196ed16764abd137a7ce07073`
- `packages/app-shell/src/orchestra/chapters/sucafina/documents/index.tsx` `6935424175ab0dc6733b3839fdb5a53d21d4dc1c` `5c167c3f4a69690c8277aa5cf02747cc2b2e3044`
- `packages/client/src/sucafina/files.ts` `454da6b505348a631a2f242e15b60530ffe4886e` `dcdbddc3a9e8280cf16b48ba1df2797350b19097`
- `packages/client/src/sucafina/transport.ts` `ee0f85588cb39a9d319de2ac801d3588318bb84b` `a6172389d87a55f07da18ba6d0a99173b37c6989`
- `packages/schema/src/sucafina/files.ts` `0c9f869039d87bba5a629a35ba50dd13c02e0665` `1ce6d771734f172443e458e426d18fb3edfdce45`

### #313 MERGED differ 2 of 12

- `apps/cli/src/sucafina-product/host-context.ts` `fc5daeec2e4cb12d44885ba3236f92016f05a021` `13b7db59d3f305bc2ecf83acdd343099ffb1c5e0`
- `modules/sucafina/Sucafinav1/product/interface/analysis-http.ts` `69db36407a2ee313635c3e096315ae8a92096ae1` `5081beb3dbf18c6faa855d508d70b0d658a141a2`

### #315 MERGED differ 5 of 10

- `packages/app-shell/src/orchestra/chapters/sucafina/context/contracts.ts` `98451175da59e41948e21594a3deadc75237702b` `7674c079e9b614fa84085d3fa11ae75b2564183b`
- `packages/app-shell/src/orchestra/chapters/sucafina/cross-links/index.ts` `2228fb177a1f8b510282e52bcaaef83bb01eb0e7` `d4eaef9d19cd797e91f97e5b8a92dd8b31b537a7`
- `packages/app-shell/src/orchestra/chapters/sucafina/cross-links/view.tsx` `7cc56c214d869589b4dc0bf7c7dff3d80407652c` `9b4b0436b9140744cb189d84d8f133d8f0ada3f4`
- `packages/app-shell/src/orchestra/chapters/sucafina/portfolio/overview/index.tsx` `44387914ff5640d2da9c90ebd9add127f9cfa9b1` `b030348f51b806dd25eee4cda3f186436b580624`
- `packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/index.tsx` `861bd7f10e3fa0b73482050e14a35d0920260265` `3ddf9f47d01caf69db2eff9cdf890b5b08385172`

### #316 MERGED differ 6 of 20

- `apps/cli/src/sucafina-product/native-ui/procurement.ts` `8c2da1fd5904d551c632d5cb687b1607eabd8fb8` `26f8dd0c82db3c159baa7890aced788b8ba8e0fd`
- `packages/client/src/sucafina/bindings.ts` `18daa2496a30e78daa6eceb67c743d74f23e43df` `aff16695246561bd2cfe154c1ac892084ce119a4`
- `packages/client/src/sucafina/files.ts` `13ddc102a2f679fc5e6e40c7367bb034f44656a9` `dcdbddc3a9e8280cf16b48ba1df2797350b19097`
- `packages/client/src/sucafina/transport.ts` `ec2375196028901f49d2e55fa57cafda84a4d885` `a6172389d87a55f07da18ba6d0a99173b37c6989`
- `packages/schema/src/sucafina/files.ts` `16b1e2aa1249602fa7b93a601bf5b7e238ecb375` `1ce6d771734f172443e458e426d18fb3edfdce45`
- `packages/schema/src/sucafina/procurement.ts` `aee56a89df664dcb581f1ee87406c1e2b24d424d` `272c2643bc6c5e0773526402766b906d34c71b7b`

### #317 MERGED differ 2 of 13

- `apps/cli/src/sucafina-product/native-ui/planner.ts` `48188c50cdf13db28a5ad0aaef119bb76d59eca8` `0a952e2af1b49dd7c53bb56f1425a763c526bcf6`
- `modules/sucafina/Sucafinav1/runtime/planner.ts` `6a59f83696becf60a8a5f7beb214e6d16ed113d3` `de99f191004a14e85756951ab5942d98db710d89`

### #320 MERGED differ 2 of 5

- `apps/web/src/entry.tsx` `f66ee0aa4d6d260a7c60ebc8c4c2511474beb574` `cdc9bb1d32c86be9e85b87188a72a661f8536fff`
- `modules/sucafina/Sucafinav1/test/local-entry.test.ts` `0b10e33c475aabd7f04a0091a25a014e43f3dc49` `bf57cb46b12446f8ff6d271f0b9f27b7ef995d19`

### #322 MERGED differ 8 of 12

- `modules/sucafina/Sucafinav1/product/documents/parser.ts` `3570aaf7cd0dac8f5c774eef68090f6343b8c2ce` `7fece85708178f1394027ffa47cf0cfc49d45a02`
- `modules/sucafina/Sucafinav1/product/interface/import-http.ts` `71382a6a38f46745511449ffed0c44155b353b2a` `f6b4f6175abcd3a00714dcdbf3997f040304dfc5`
- `modules/sucafina/Sucafinav1/runtime/local-backups.ts` `3eb4eea784d3402577b0edd6441bf1b8a1a142ad` `03003d4e7f7db1e07fcefb2428b2403ab1b70304`
- `modules/sucafina/Sucafinav1/runtime/local-jobs.ts` `a05168d5fcac5afdcbdf08521fe90ce0d2da5133` `64d1dd5fb32152ca34d0eda31cba14e712d68380`
- `modules/sucafina/Sucafinav1/test/document-parser-resilience.test.ts` `107027d2ca8b45549af3f7b5ea97e156b4d7835d` `ab92f216653b33deed4d6342ff745a58926b6300`
- `modules/sucafina/Sucafinav1/test/fixture/parser-probe-worker.ts` `fad385197e470561a20d6098cc7b663f76f64bfb` `376e9066675cf043177ef30b95337b116c944aae`
- `modules/sucafina/Sucafinav1/test/import-http-admission.test.ts` `6adba9ace9c096d6e66a111b90ab9b0de12793b0` `d3c3044f558e27f14bc842999f0158e88a88142e`
- `modules/sucafina/Sucafinav1/test/local-maintenance-resilience.test.ts` `15f227a01a4a815fa5854a64bd8e0285ab0b03db` `165dc54682b7484b1c21f04b697bbc7a06c865f1`

### #324 MERGED differ 1 of 3

- `modules/sucafina/Sucafinav1/test/t8-auth-frontier.test.ts` `ef34524718b640c1eabdd1acf20511615f77a2df` `5c96933e6728f5c1f93d579733faa10722110cab`

### #327 OPEN differ 28 of 28

- `apps/cli/script/factory-receipt-check.ts` `efeee62b81454945cd57b6cd76fd144e0dc3605c` `5de5bb26c7196fb1ed1f4d5ff4d3e030f4e90888`
- `apps/cli/src/sucafina-product/extended-business-services.ts` `cd5583939061fc0ed185c5e6ff1aa6f32854d35c` `ff43e324d280498e629f867d0ac93714bdf608cc`
- `apps/cli/src/sucafina-product/host-context.ts` `68350f9e4940e230c4067b2b15ceb73ca18a079f` `13b7db59d3f305bc2ecf83acdd343099ffb1c5e0`
- `apps/cli/test/factory-distribution-linux.test.ts` `846f19ce4eff89c960954681fabbcf310a2f8ed7` `266ed73a79babb3726351d815752c033fedfcbe9`
- `modules/sucafina/Sucafinav1/local/README.md` `e25ba8b42207f8d52db01f24aa542a1ba8d64f91` `d3aaf8d1c4327c651fb3146dd6866ab9f4e117d6`
- `modules/sucafina/Sucafinav1/local/entry.ts` `9b9e601c7ba8cb6c71ff16257933ed192a3f0f5a` `e9e374960600212bd8d6e8e0a37f2ff45f63c21d`
- `modules/sucafina/Sucafinav1/product/integration/host-presentation.ts` `MISSING` `70725d5dcd4c76893b8c8a85350bcd83ef796734`
- `modules/sucafina/Sucafinav1/product/interface/html.ts` `MISSING` `e97f2b64609001264be11d1b2a5f972932ec439f`
- `modules/sucafina/Sucafinav1/runtime/application.ts` `6e80c04457bfb5fd6c47bd1e083eb0175ff42e4a` `a0deff8a3b272019f472aa2f93499d1940a78370`
- `modules/sucafina/Sucafinav1/test/local-entry.test.ts` `5a2d53a3a47e630d27c38f7990b86d1af48510cc` `bf57cb46b12446f8ff6d271f0b9f27b7ef995d19`
- `modules/sucafina/Sucafinav1/test/product/dashboard-installed-closure/ownhost-fixture.ts` `cca6caa4504fe74e2b7e23f413de214be0405041` `d5ffdc24f23b20557613383d38cc03155e5e68c4`
- `modules/sucafina/Sucafinav1/test/product/wp01/contextual-decision.test.ts` `113018057e634839e9b96b117eba612422899124` `671168b256283f2d4da00f0ab59fcafe371fa513`
- `modules/sucafina/Sucafinav1/test/product/wp01/decision-conflict-recovery.test.ts` `422bb2e2f0b8819187f1a28ecee2f486cd17cd42` `70f1f6e634c92cd23a271d653ede0bf305bd22a7`
- `modules/sucafina/Sucafinav1/test/product/wp01/http.test.ts` `31e21d2a7bb7c230352df258c803fd25d656f0d9` `9db949c188d8e3309a2275e9c14ed2f210a75ba5`
- `modules/sucafina/Sucafinav1/test/product/wp01/personal-views.test.ts` `1cecfd23bca79ea5891b12b44b912a212daea89c` `78782eefb64824c440066055be6908a962055725`
- `modules/sucafina/Sucafinav1/test/product/wp01/planner-monthly.test.ts` `b17d34065c3e1586f6fcb7e877df27154ce86edc` `124ca3c11382a89de59f1e89086434af6636a0a3`
- `modules/sucafina/Sucafinav1/test/product/wp01/record-search.test.ts` `6101ea40d3168cc8d04276d672432e30cbf35352` `6706c7753cc241889195d65622ee7e0c4d38eb6a`
- `modules/sucafina/Sucafinav1/test/product/wp01/unavailable-views.test.ts` `1879eab81e80f0068efc5f054551b0c45a2f0047` `5b3c1e1115a81a9d880ee08f9d8c28b6c55b6e2b`
- `modules/sucafina/Sucafinav1/test/product/wp02/host-workbench.test.ts` `2d8c9e76e6c190515afa0c4ebaf8a1b60fe83296` `bbfad3882e0ab38ebab9b943eadad8b4c478ac07`
- `modules/sucafina/Sucafinav1/test/product/wp02/import-report-consumer.test.ts` `e012e89f96f6f68a9223a3b3b5bb757b9bcb099b` `8d716fcdaa686599173c031693d151e87906829c`
- `modules/sucafina/Sucafinav1/test/product/wp02/workbench-recovery-fixture.ts` `6aeb601cfe9667056157baa4689cfe272f90d5bb` `593a46dad67e490dcfdd4fdc1878353088138dc7`
- `modules/sucafina/Sucafinav1/test/product/wp04/queue-view.test.ts` `21aea44dd75ae1fca7c0637829317d923378a938` `7c2e638a90e088e81494665d2910ea780dd7b654`
- `modules/sucafina/Sucafinav1/test/product/wp06/documents/candidates.test.ts` `dfa3f129897d6ef665cee9064f2e27ef04048a80` `d60a3f8540371a0a3cd41b7d642ad38f1e26f46c`
- `modules/sucafina/Sucafinav1/test/product/wp06/documents/egress-fences.test.ts` `6b56d3110521f15af26ec735d667fa5da2a3411c` `69d041d3e9938a27a380eb13e75b173e46bf5201`
- `modules/sucafina/Sucafinav1/test/product/wp06/imports/html-policy.test.ts` `63e21f50f79d99221b53143b88d7a6b995b72921` `34fefdfbcca6401b833fb5e75911fb29b9b18841`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/extended-ui-regressions.test.ts` `8d343223af8fe376f5fbf06fd3388a70bfa006f8` `637aaa353295c8f94ff1b689bb76b1e216fcb252`
- `modules/sucafina/Sucafinav1/test/runtime-http.test.ts` `7163047f109d76079bf87be5e6eaff9e67d0cb4c` `6455ddae758839c617771c85a8344cae24f9cca2`
- `modules/sucafina/Sucafinav1/test/t8-auth-frontier.test.ts` `95c85ccb408d034407c1b02e3a1ffb7deb4e0add` `5c96933e6728f5c1f93d579733faa10722110cab`

### #333 MERGED differ 1 of 1

- `docs/qa/sucafina/consolidation-board-2026-11-17.md` `c82bea4a447fd85d70d7ffe7cfb78cf21ab6de0b` `7e8c67af6855c7034a19b54c36e247097f614d02`

### #334 MERGED differ 2 of 3

- `docs/qa/sucafina/open-pr-merge-plan.md` `16bd0444bd47f8f9dbc9236793b31495af8113e1` `ef25227110f49463474fe91d3f3bed15661c2012`
- `docs/qa/sucafina/open-pr-parallelization.md` `80b44500e5e7112b8cac44efbc2bb07d443452bd` `c0b90656f77bf6b2a8ef8271caefc803b58e7e5e`

### #340 OPEN differ 6 of 6

- `packages/app-shell/e2e/sucafina/decisions-support/planner-sources.ts` `be9c4c6b57c356dd8f01269b245614d82dd0e3b2` `a7474e92dae7623da0e4af89b2abbf2b31fbaf0e`
- `packages/app-shell/e2e/sucafina/decisions-support/procurement-source.ts` `de1cfa750a5f6022b772f296048c27b992911990` `3d8327c576b21f8813769960eb8a93fb757cea93`
- `packages/app-shell/e2e/sucafina/native/journeys/u39.spec.ts` `35e2f0c87794a13038f41b0e955ebf4cfafc475d` `bcdf73cc65782bfa6d8fcbeb52d3f546aee2a3c2`
- `packages/app-shell/e2e/sucafina/native/journeys/u40.spec.ts` `919472dfdb47edbf885eac829b30b8ed9254b9c4` `94bec3aa596ee0155f47f916a657a546a557c695`
- `packages/app-shell/test-browser/sucafina-native/draft-quarantine.test.ts` `8521bce85f00b23fb8049726fd6bfc30b3ec7532` `e058f78c1bbcaec5038bd1f1e272b386b2a64166`
- `packages/app-shell/test-browser/sucafina-native/w13-pr-approval.test.ts` `88698bb72c399433f7f85d0c69b0e55ce39a8634` `MISSING`

### #341 OPEN differ 2 of 2

- `docs/qa/sucafina/consolidation/conflict-matrix.json` `03ee6500e37c0d4f2750bb486932d31007edb675` `c6ffc2f7b02f29d819693b0368900e1308c26a32`
- `script/sf-ci/conflict-audit.mjs` `a8cbb29bc0d6b3de785ed378f4cded4241564e4d` `a52783ed8b419356de550e428ac2dae2d5433455`

### #345 OPEN differ 604 of 606

- `modules/atlas/boundary/package.json` `a31ffcbfaefb1cf091aa09e1ac81dcf001f28b75` `6a5e7bddf5b9ea31dd0fb795f38be4fc98a231b7`
- `modules/sucafina/NATIVE-CONTRACT.md` `8171f687add1c346e1432a5cc81d58c0afa71d3e` `MISSING`
- `modules/sucafina/README.md` `d31e96598146a216ab77aed6c4ff5ca184d2621d` `MISSING`
- `modules/sucafina/Sucafinav1/README.md` `641ba972788845ffc2a697038bac4d27d2243934` `80e3de58b1527c4c6e66a232f172d2566e336c90`
- `modules/sucafina/Sucafinav1/local/README.md` `80fd89b95fe82d017c8df11e2eaa1f9951b0f861` `d3aaf8d1c4327c651fb3146dd6866ab9f4e117d6`
- `modules/sucafina/Sucafinav1/local/enroll.ts` `616d3d84afaf58e5f9bdd28c50d20270e2bcc7fa` `6c1728044af046bf2472144f4d8ecfef58ce982c`
- `modules/sucafina/Sucafinav1/local/entry.ts` `85a2fcb701fdbae648081d7e1bf6106f81a4c307` `e9e374960600212bd8d6e8e0a37f2ff45f63c21d`
- `modules/sucafina/Sucafinav1/product/ai/analysis-host.ts` `337f6764a6e4fa84c09d4b53afd87c814a8d1fab` `79bc5b933253daf8db73171d20e84f77436f5bbe`
- `modules/sucafina/Sucafinav1/product/ai/analysis-port.ts` `3c78f724a50c37757570e80ba18af950a9469132` `0238f4a03a11f4bba393bd10c4ceaf5409c81e40`
- `modules/sucafina/Sucafinav1/product/ai/continuation.ts` `fa0e6dce5d63c7a1f9fadb20005b77e2e4c0a227` `940a98787420b7f88e625d7f7e9aeee39373f215`
- `modules/sucafina/Sucafinav1/product/ai/contribution-builder.ts` `28a1af7a227af64f98d83cc32be5b997a898e4d6` `e0f70be52df22cac36dbaa88aa1ca7404f4abecc`
- `modules/sucafina/Sucafinav1/product/ai/contribution-reader.ts` `e7a20228f81e9e4af51cd29fda7fb4a76f3a7ef0` `db9faeec0e1d35c0724a25a0d9cf53fee93961ee`
- `modules/sucafina/Sucafinav1/product/ai/resident.ts` `7e3d3849272bb5755d793a9e2b00ad34c523c188` `af08dda2a87ae7fe3bef92b58ff37102dbc515fb`
- `modules/sucafina/Sucafinav1/product/ai/run-store.ts` `1ebb11deacb55df8d09e3071130b52f34159d47c` `978e4d54d2d54d1308152b7a4e9625f5c54b36ae`
- `modules/sucafina/Sucafinav1/product/analytics/capabilities.ts` `e799cdfed890b15daa49e6bbe24d870b7e55a794` `87e36883d92f6982cc8765337f8802ffacd6e52c`
- `modules/sucafina/Sucafinav1/product/analytics/consumer.ts` `df7de2433773b283ab9eb76d34e4208ed9e9bc36` `117c0fc6191b9d7797a4e08db19e90c3079fe129`
- `modules/sucafina/Sucafinav1/product/analytics/decision-view.ts` `3e5cf79d39a09c383b792ee27c867023a624231a` `bb4e49ccf5eb0ea8957400322fb3a75e8e2ce5f8`
- `modules/sucafina/Sucafinav1/product/analytics/factory.ts` `93bc4fb74dee9c55fa3e396bd7108ebc9d3da895` `9cc4cc81538a7247cd87893f958acf5665194eb5`
- `modules/sucafina/Sucafinav1/product/analytics/milestones.ts` `f8311d1e9774c6320739e9a672c5822e08109f54` `a0f6ea59467c6e617f92ce8906063c26d977044d`
- `modules/sucafina/Sucafinav1/product/analytics/portfolio.ts` `4fd2a1ec2fc8cc78b21699e5a008362fec588444` `fda4f51c8ccc8e45c959e8531f0cd63435c24d57`
- `modules/sucafina/Sucafinav1/product/analytics/projection.ts` `3e585a0d0371fc2d1f642f4b59c8d76325ccd451` `29f32617de3ce33bbf414a7439f97d64806bbaa9`
- `modules/sucafina/Sucafinav1/product/analytics/scenario.ts` `c116831c71e2df3e30c6b058f4eff8d26ce6ce07` `4d165428dc731e59c2faf01a4e47b352e691dfbc`
- `modules/sucafina/Sucafinav1/product/analytics/semantics.ts` `ef1adaaf457c2ef3846fe12be8674455ca2d72c4` `b88301e2f956aefb5fff723d5a1f97af31423f4d`
- `modules/sucafina/Sucafinav1/product/analytics/source-navigation.ts` `3866a95cdad732d51afb9094db7908d107ca920d` `c6f3d5cf5772b588cb0da9f0648ce69f8775f357`
- `modules/sucafina/Sucafinav1/product/analytics/stored-scenario.ts` `36e477bb5a37c565e3a719f09b02fa7f70caba2c` `f5bb6d732ffc588626553097d53d3c0e1457a81c`
- `modules/sucafina/Sucafinav1/product/analytics/view.ts` `85480f85cf36f20ab7ba7ac7e142d457653ae292` `b131fb28a385105f0e8ef5b337ffa4e5bca15f21`
- `modules/sucafina/Sucafinav1/product/analytics/waterfall.ts` `98d2510a3a44e45ab341aed6a1f2560339ec8578` `cc4d834d3336ca17ca5b7bf15883c6dbd77f64ab`
- `modules/sucafina/Sucafinav1/product/collaboration/answer-reuse.ts` `134ce5cd8c4f0779380936de6a439c9ea124d932` `012175e4acc2be40547089b43f248144beb6c712`
- `modules/sucafina/Sucafinav1/product/collaboration/answer-work.ts` `0bec2b428730833b6e2823c700aacfa059f76b92` `f1e638546518f35aef1dcd053ae0f2a202cdadd3`
- `modules/sucafina/Sucafinav1/product/collaboration/authority.ts` `729b1390d452e7ad99cb8c6119b1e293b7315593` `bde64fb8cb1a25e8f10eb979ed5ff111cdb2042e`
- `modules/sucafina/Sucafinav1/product/collaboration/case-selection.ts` `ec80e2916c8a06cbb471cf02e30bb1cb5ebd9cc0` `cd9a67887f41986243809672572c972440c832ec`
- `modules/sucafina/Sucafinav1/product/collaboration/composition.ts` `6ebbe23c3788d4dbd91521af823917796262f0c9` `f2a5da4f9471e5985cb1e1dd1f86dce62aa89f11`
- `modules/sucafina/Sucafinav1/product/collaboration/confirmation-observations.ts` `8219b413786bf3d4db93df4c4d95172861b108e9` `66aec87e1027226d04710dc2521413ec98866aaa`
- `modules/sucafina/Sucafinav1/product/collaboration/confirmation.ts` `b6f6c3f18f0ddfa7fc500ffaa31f386a44b9e725` `9d38a30265e6efc2c9667371087a87bcce8e682f`
- `modules/sucafina/Sucafinav1/product/collaboration/dispatch.ts` `4a1ebe9298dd62d2846a45f294aa1b6331343040` `7d30096e973b003f222698bf2f605fc24031aba5`
- `modules/sucafina/Sucafinav1/product/collaboration/evidence.ts` `53f3497f4e9e5c4cc9432522f13bd1efec25379a` `6379310c439d2643ba64efd4c54777aac10e582c`
- `modules/sucafina/Sucafinav1/product/collaboration/host.ts` `b55bf37a353acc771021b23b6906eb79ae4d43f1` `674506c6f08d77caf16ccca3f8e94fde68cf0f7d`
- `modules/sucafina/Sucafinav1/product/collaboration/hot-topic-host.ts` `41636dae0e7f8ff8e68848ba3a8e02983183fffc` `aaae9db90459f8e6b34d9a1a2a1aedfda2a4affb`
- `modules/sucafina/Sucafinav1/product/collaboration/http-routes.ts` `283a7a5b80fafa38a3cfc378014bac1056c29602` `a266e12bd80a2ff95922c2492225ced86eda3ac3`
- `modules/sucafina/Sucafinav1/product/collaboration/http.ts` `91091bf444bc23221d1f427138ebb9e5ca4c51bb` `63d16a5023caa402669cfe8f05255e52543e9c53`
- `modules/sucafina/Sucafinav1/product/collaboration/recipient-actions.ts` `87dcbf239a47677662349f52c6ea7478385debde` `22c6309c61b27b89914086a7602bf3bea61a988b`
- `modules/sucafina/Sucafinav1/product/collaboration/recipient-authority.ts` `bf1845e8673fd10425713085e20b04373885fabb` `3b7080be16213512835902c37e58e1c88ca8405f`
- `modules/sucafina/Sucafinav1/product/collaboration/recipient-thread.ts` `5e63ddba51c89a8af9f3276e587f57e001660872` `438cbf76c6b230ed5a9b3328ef67cbecc73106c6`
- `modules/sucafina/Sucafinav1/product/collaboration/relations.ts` `059322b5d21b19bd744fdd1c81bf3f9c77be7710` `b682f711d93108d27119ed6bbbae97169ca3faf3`
- `modules/sucafina/Sucafinav1/product/collaboration/thread-context.ts` `e0745ad913c6c1e93e83794ed1b4de6082868519` `930e7a5febbc981ba1881fc67e9ab065691e3eb8`
- `modules/sucafina/Sucafinav1/product/collaboration/thread-history.ts` `42ad710351aea392df2368ea84ab057ffd248e10` `59a923fbf7f04b212b24cd4c32f09d67620bccda`
- `modules/sucafina/Sucafinav1/product/collaboration/thread-reads.ts` `5c8b811692c3e8aea1859b2f346096f0410e82f8` `134b3bb6dd682c23eceb2c525ba35aa0c0584c39`
- `modules/sucafina/Sucafinav1/product/collaboration/threads.ts` `f39c3c29a83ec1f861cade74748a2f526436d48d` `b7f69a1b71e40af5204280054cb83d0c2e2970c6`
- `modules/sucafina/Sucafinav1/product/collaboration/work-port.ts` `22a2a7fab04757667fcfed82147b7676d6928fee` `0c49c363917ffaf9062366e54a7b7b970ae471cc`
- `modules/sucafina/Sucafinav1/product/contracts/freeze-v1.json` `ae8b96bc50ddd64404ae16c9e3ee1129cc6e3104` `b20cf5cecf22885dd8858f3659056a50ab88f485`
- `modules/sucafina/Sucafinav1/product/contracts/host-context.ts` `f6d7b659945cd90f1bc09b6c24d8a3962d156ad4` `1c677b85c0a672cb76b6f6aafde49bb4f5d63acd`
- `modules/sucafina/Sucafinav1/product/contracts/output-schemas.ts` `bbb80f4a218de28164b2a7f93bb1701432dbe50e` `0d9fc51d26a0ca726d32e74605b555f871d99af6`
- `modules/sucafina/Sucafinav1/product/contracts/outputs.ts` `9f4863d980655cfb4940430da06c3f90c9ef8963` `4db2e631bd83ccda67442824557881c2ed990c92`
- `modules/sucafina/Sucafinav1/product/contracts/state.ts` `898a1c2117ba7a011c35dbbd92b586034fe72d6f` `755639b2a16265fe164ba2e6343738c1362d168c`
- `modules/sucafina/Sucafinav1/product/dashboard/confirmation.ts` `fefdb4b7814be4953e1a5e7f12e2385e0a6a03c4` `f90bf0c0d177a04d3fec2a6840b11de079b9def0`
- `modules/sucafina/Sucafinav1/product/dashboard/hot-topics.ts` `3f1e411fee14260fc4c9eb5d6a26cd4fea100079` `051be54adbf197a0f4b290ab6bc6aaa9f0f563d5`
- `modules/sucafina/Sucafinav1/product/decision-memory/atlas-projection.ts` `7c1b3dd08dc663e9dfa406b09dc2af5920281131` `4ffa4bffc3e3fe3bfffd3a047f1e11c473697e36`
- `modules/sucafina/Sucafinav1/product/decision-memory/case-features.ts` `48ba2b9e167c1449898bb5f0d27fa3cca8667399` `ff95a311352c0c04b9ca42ab6523783284a8001e`
- `modules/sucafina/Sucafinav1/product/decision-memory/case-recall.ts` `80291e7ab170ee0c445098b0bcdecebf8894f8e3` `03e75875386483c7e37dce3f7bb21189f3066774`
- `modules/sucafina/Sucafinav1/product/decision-memory/domain-outcome.ts` `024733060d3a5eb0729a81ea81f2487b6420843f` `aad2b8a655c3259a86e526efcf562602851df8bc`
- `modules/sucafina/Sucafinav1/product/decision-memory/invalidation.ts` `430cad970087abab2fcb05d299f5d358834c93e9` `3bafcac1d0114eff9cd6869fd8040a9fe414ed7f`
- `modules/sucafina/Sucafinav1/product/decision-memory/materiality.ts` `cd87d8a7af91ac66e8e6a8d2e9ae48ed1db5ec74` `1c586d321cf10bdaeccd95b4ac2a2100b439fe7f`
- `modules/sucafina/Sucafinav1/product/decision-memory/outcome-selection.ts` `bc30d168f18a186a9cbdc149607fec9c30223247` `5fbc7ac4b086893c12c2d9d8fcd01b107c6f3ed0`
- `modules/sucafina/Sucafinav1/product/decision-memory/outcome.ts` `c84aac867aab332b9ac7e4e92d03bf3f7e7ad430` `97d23e90f627472e525c50288fdf4163e3cc3c54`
- `modules/sucafina/Sucafinav1/product/decision-memory/recall.ts` `b63fcc3744065daed31406ad19bc18a3ec983110` `2d8524b42448ea63a7dd9ab0e9337c90540dc383`
- `modules/sucafina/Sucafinav1/product/decision-memory/signal-list.ts` `2d41f7fc3a718b625a49e2fe85e414cca1c473c8` `c4a1d8d1f4e540c41c3e7d09efb92bb003ab6d8b`
- `modules/sucafina/Sucafinav1/product/decision-memory/signal-registry.ts` `83b77eab0314943f3a6e5dfc16b648f1a166db33` `b6edcf44f55923cbaa764ff9374ce127145b0f9e`
- `modules/sucafina/Sucafinav1/product/decision-memory/signal-work.ts` `44d56975554badd68d9156622c9f94df8145bcdd` `3cc6b0ae5fd75ce84724eeafc053264fc9370740`
- `modules/sucafina/Sucafinav1/product/decision-memory/source-access.ts` `15f3da92e658ec21b234888a16ed7f1b87cc5f4e` `41741c5131ea66242c881126c22c6d03cfd9c3c3`
- `modules/sucafina/Sucafinav1/product/decisions/analysis-acceptance.ts` `dfa866f8f334615eac7cdc86807240fed77cb4a8` `c2f91a8cdfc590dc10a1b3a2a9c56be8a424bd5a`
- `modules/sucafina/Sucafinav1/product/decisions/analysis-promotion.ts` `e0c77974ac694132c5dbdc370fa3a48151c4d825` `43e1de8c347faea2953ff5baa2919b3b061fc4e4`
- `modules/sucafina/Sucafinav1/product/decisions/application-status.ts` `29a01e27af230df149e8862beb370f466abf0808` `77d29655b4e162a4d191de3bb1f7bd581cb3def4`
- `modules/sucafina/Sucafinav1/product/decisions/apply.ts` `535c689f075db0d306cd2e8152930e875f6be13a` `a2d08250d5104285dcdee87d86e39076535cf554`
- `modules/sucafina/Sucafinav1/product/decisions/case-port.ts` `67203e058f6e08d9e32e0c51e0b1a01e5fadf322` `122281c82d15e5732fee287cc4bcead4b6f97eb4`
- `modules/sucafina/Sucafinav1/product/decisions/comparison.ts` `eaf44e5937a539a446a29cc450fd4b63cd52e894` `8d86bc416c711169fdc678635cc5eed12481fdea`
- `modules/sucafina/Sucafinav1/product/decisions/composite-planner.ts` `74cd720489adde4b8a341c3d4c378194f58afa16` `571bd21a23c9992ab6d8f32363a173596fdc704e`
- `modules/sucafina/Sucafinav1/product/decisions/cost-coverage.ts` `09097eaba2e0eae71d33d88077a2f86e83e1dde9` `bfcb6e419cbd0b29fbf4fc14bfa33fde400948a9`
- `modules/sucafina/Sucafinav1/product/decisions/current-choice-preview.ts` `d19f735539df9b9b4fa637367f58fa0c0b674562` `db487cd1b6263835302e9bcf80499d18531aa592`
- `modules/sucafina/Sucafinav1/product/decisions/current-choice-promotion.ts` `94cdbd50b560b8741ac5c64f1ca0f807c0952860` `6333d208823355d26b2c02259859a13e0eae9b19`
- `modules/sucafina/Sucafinav1/product/decisions/host-product.ts` `ff67ec4d58788c3c2e4c1a88d016620940660d9c` `f6e3d0473338553dc71340fe632d3de59b08deb9`
- `modules/sucafina/Sucafinav1/product/decisions/hot-topic-draft.ts` `5e0b80a470958dd201db4283bde96d594935e68d` `d880fe5a5f7fd3c9c4fa249dbc374620a39a43a7`
- `modules/sucafina/Sucafinav1/product/decisions/http.ts` `b1fca9569190eb42880387bd12c49dd769304522` `596512b4e12c094fd178ea845f4b560bbf23a348`
- `modules/sucafina/Sucafinav1/product/decisions/human-grants.ts` `853f9d95c361ae9caa2c5e2c0d40a4d5395ca12f` `1cd4e7ddd5640fd3dd156ce45b486a4b3f0d6917`
- `modules/sucafina/Sucafinav1/product/decisions/mutations.ts` `e0840d775274ea73c6b938711764c69593dadca0` `3f31dd52babca16249fb04fec29abbf74e7a5da4`
- `modules/sucafina/Sucafinav1/product/decisions/prepared-apply.ts` `a45436a6fef8598b7ef9eae33d061ddebf0aa43d` `a2bb5e7f74d7f1ac7c29ff3c604df14e11d30119`
- `modules/sucafina/Sucafinav1/product/decisions/product.ts` `476a08b14df449f3f32ee65a18e90d3b6427cc3d` `1ba2255fd5792cf78d161fe82233ed21cff54f04`
- `modules/sucafina/Sucafinav1/product/decisions/proposals.ts` `2c72dff8e8b7ad2d12dd572d033c3855f00eee63` `b74c0d1699f64b5675517632f898ca318f8f67d8`
- `modules/sucafina/Sucafinav1/product/decisions/receipt-review-binding.ts` `6987eddae37ae2c90fe03b2d8e81ea28e8b5221f` `b8c6af0cd15dbafc70c543901ca922701748537a`
- `modules/sucafina/Sucafinav1/product/decisions/result-store.ts` `bc32bfb39e8b6012230ee0d136bed142340e5d89` `c76d9bc385a4b5102b756812b778c844f20ab733`
- `modules/sucafina/Sucafinav1/product/decisions/scenario-request-store.ts` `368a7f2e207c4f551ac3c6f77424797c97f794f3` `13b41a023714ca58409d8860d1a7851e58ea8e69`
- `modules/sucafina/Sucafinav1/product/documents/capabilities.ts` `6b655187d4444cff5b8966e868ba163191adfc42` `343dc9cbc8e3942dbca74a8a1735f4caff2e84fa`
- `modules/sucafina/Sucafinav1/product/documents/host.ts` `fede075378ee964fccdb73f0d95958a5f56c7159` `a31630fd258d8a15f4098ab90f263c90cbf8f702`
- `modules/sucafina/Sucafinav1/product/documents/parser-worker.ts` `eb61a085ca1a80861277e88e7788450bf71d0901` `47789d792f5eba0b734cfc515ccfd9aad09aa6f5`
- `modules/sucafina/Sucafinav1/product/documents/parser.ts` `8d38f0e11069f102496e99db487f695238784bb8` `7fece85708178f1394027ffa47cf0cfc49d45a02`
- `modules/sucafina/Sucafinav1/product/documents/scenario-inputs.ts` `3ed17452b35186a59315dbd60643ffe0acc1b56c` `566776cda673751c1b6fe78f55ef53f573e83b37`
- `modules/sucafina/Sucafinav1/product/documents/workbench.ts` `d9769a4fbd2dd1d5c73b9f82dd021f8f3298333b` `3d21a461c88da2372eae57d0e066ff59d9f21f55`
- `modules/sucafina/Sucafinav1/product/host-binding/atlas-memory.ts` `730d4fec9085bc94918fb6d2bcf1bbe62ec46741` `3ce00f44f2f072342b8e894bfc54b2f2a16f25c4`
- `modules/sucafina/Sucafinav1/product/host-binding/business-context.ts` `6e586c570369e2a8d0d25babf2f22a1483ea184f` `12d6b27c52e29ac0cb8ccc65fba63ad20ddbc4ef`
- `modules/sucafina/Sucafinav1/product/host-binding/sf-mcp-bridge.ts` `bc00a2fe70bb37d6132369c3767388e544e18510` `472b44cc594db8cafd7669e8424d0f494d38cc9a`
- `modules/sucafina/Sucafinav1/product/host-binding/skill-loader.ts` `0a26a1ed086b9ce0a4a1907a233b705e6061e659` `d98b7fbb550d34ef5a2b9c35b25cf5ce5a7aeae7`
- `modules/sucafina/Sucafinav1/product/imports/FORMATS.md` `ae4512cd124a94c182765c1430ab27e4e2135b74` `bf14d63e55549231d956049080e1811ab6a05293`
- `modules/sucafina/Sucafinav1/product/imports/dashboard-preview.ts` `5747576ed0ce7fd8f38b0c837d560a7e8dfc5ba3` `778643e87812ef81d02dabfb8de53f7dd02b26aa`
- `modules/sucafina/Sucafinav1/product/imports/dashboard.ts` `3a2dbbf47fb9e5d430ccd0edde2efccdf8412437` `289d66175e64cdf4f13d5246d6647b8b74c9c4d4`
- `modules/sucafina/Sucafinav1/product/imports/workbench-script.ts` `67c1f5c6e0c9e79b48f519a770c0b87cd8006f4b` `4cfc3c61b365a9dd5fa0202a3bfc371acedaf433`
- `modules/sucafina/Sucafinav1/product/imports/workbench.ts` `73be922368d5df9cc5cec8a16b5eec7c67d73adf` `16261f0b2a33f31c5c7cabf24cd21e65a2b161bc`
- `modules/sucafina/Sucafinav1/product/integration/bi-http.ts` `23c183666cef9d97925ba05c67fe678d9b058255` `e6487e027dd56ae682c572ac52778217f7ef1627`
- `modules/sucafina/Sucafinav1/product/integration/dashboard-preview.ts` `2790bb80c52fa401abf3a3450d0f596c281225a9` `880be9582a60bd41bf62e435f38827ff79749931`
- `modules/sucafina/Sucafinav1/product/integration/host-presentation.ts` `MISSING` `70725d5dcd4c76893b8c8a85350bcd83ef796734`
- `modules/sucafina/Sucafinav1/product/integration/human-authority.ts` `91bc24bf7b2402f30a517148db24bf003b686a14` `9019c41e2545f66ec07233a4c8fae96514c88de6`
- `modules/sucafina/Sucafinav1/product/integration/planner-sources.ts` `6230f22e7dd66fec1103f28cc9a7937b2dca1449` `02d75207b2978cc5c05368cc7e3517efeb3ce3ce`
- `modules/sucafina/Sucafinav1/product/integration/procurement-projections.ts` `c4726e79928ee5486aaac0cdf7a2cb92c5247f07` `3e8830c3dddc8b9609f583f877b2fe7458eccd28`
- `modules/sucafina/Sucafinav1/product/integration/product-authority.ts` `99c9cef3c95e52f0ebcfb887913c7cad47fead8a` `d00e6d8707aef8e99bdeabb485599399408d7ced`
- `modules/sucafina/Sucafinav1/product/integration/source-inventory.ts` `eac8e0b28e591b7cc50ef5cb7fb1ebe768526509` `ddc5323d714c58de2d5b47eed2563176099f15b5`
- `modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts` `65867a3e6aa9b5b85266bb637fb22cf1c6c6d539` `0e812842ad0d534998c182100a8466548d70e915`
- `modules/sucafina/Sucafinav1/product/integration/source-projections.ts` `ec265772aa3100f6f69648cbd444fcdfde01b754` `4e0fd90ab35f9c03d79d4a1bb65b7bdc7385681c`
- `modules/sucafina/Sucafinav1/product/interface/contextual-decision.ts` `5245f469fab7f23474c4c406ddd1d2f1f43d65a2` `c00afe5f9bec072c6236441e1b650327d26853ea`
- `modules/sucafina/Sucafinav1/product/interface/dashboard-workbench.ts` `d2ba7d4325ae016fe8232bb0f63803565cdd106d` `f5551f84a43dd5b29d99d2c34fcb3d1f8da9c778`
- `modules/sucafina/Sucafinav1/product/interface/document-http.ts` `8f679deec37dc99ae335c4bacae2162c9a7a076a` `69f1ab3be1319b0a98f5ce57e96fba00fe3426f2`
- `modules/sucafina/Sucafinav1/product/interface/document-scenario-http.ts` `d6926db6f770692e4d2ccbe9f425bf389a9f5c95` `d57b80a0f2ab49fa123ebc23f22541e536713836`
- `modules/sucafina/Sucafinav1/product/interface/import-http.ts` `9ef67dac700401023fc6218b6f269286d67eff72` `f6b4f6175abcd3a00714dcdbf3997f040304dfc5`
- `modules/sucafina/Sucafinav1/product/planner/README.md` `ee6e1efa7e336ea3abad4d16992c1dad936d3471` `0d6843b7fc95ab008d65d8dc694175c14f6c91cf`
- `modules/sucafina/Sucafinav1/product/planner/calculation-evidence.ts` `a1d2b84c59732b05c5944cd81be82f247c2c9c91` `aaacc8bf7df9fa67870c4067154fe67a58c34a22`
- `modules/sucafina/Sucafinav1/product/planner/capabilities.ts` `21a42acdf214494fcb0112cd772aa7afdc665180` `0947902acfba1b45d7f2950e8aaa64e1c7305f6d`
- `modules/sucafina/Sucafinav1/product/planner/catalogs.ts` `d119281a3a9b6c61adac92740880e03bb836b0d5` `33c71b931253b48d46e6b491549b128b9183924c`
- `modules/sucafina/Sucafinav1/product/planner/current-choice.ts` `7c4a00f3a43a9257bdd0159707bd49d1de4b6d94` `349d7bb7bde86d8e4fc8e605a9c981ff4b0ab6ae`
- `modules/sucafina/Sucafinav1/product/planner/exact-threshold.ts` `f19893e117c7a9de4a821183950b26d595a9111d` `59fcb482078a1c33a8ab4c6e0d5e691228b6ae43`
- `modules/sucafina/Sucafinav1/product/planner/headcount.ts` `e59fcae363a424896f062e5b43c8c0ac04c383a0` `7c6b2f0b03c29dddc743537f0e8964799155ae57`
- `modules/sucafina/Sucafinav1/product/planner/interval-proof.ts` `4c697c5c7307aa071bfb57f8841c85fd6c635173` `55a701b7be49fb3f550a0b52b580e6f7dc819b31`
- `modules/sucafina/Sucafinav1/product/planner/monthly-host.ts` `b63dda153fcc1c5225a3d6c59bf13a1b116919c4` `b8bdf6ef06a9883952faa010efdec80f8d3b69d5`
- `modules/sucafina/Sucafinav1/product/planner/operation-verifier.ts` `8cd886a36673aa93b501c927bbbc01ec5e4d69c1` `086c0100a39525f5d78f5864ad589e2d72fc40cd`
- `modules/sucafina/Sucafinav1/product/planner/persistence.ts` `7034edde0df04b87ae52a2cb00104fb3f55b7805` `1d750c4d699eb27acd2b5066d23b66307f5ae931`
- `modules/sucafina/Sucafinav1/product/planner/port.ts` `dba62042653bd061fa099e2956cae4d11a0475ce` `13800a1ac7dbe1b9bc95ca0a10480708760b4936`
- `modules/sucafina/Sucafinav1/product/planner/product.ts` `4d34958a4acec914ec848df7bbfcfda3f03eeb0e` `d3d616e972a73748e6ccac95e3aa7aafdfd204c8`
- `modules/sucafina/Sucafinav1/product/planner/scenario-comparison-port.ts` `78e88d872b849e536a6353212ecc950c20e4a904` `1782c2094239c3712d3a895a6a25f4160fb429c7`
- `modules/sucafina/Sucafinav1/product/planner/scenario-port.ts` `f474ed278b7f41e1a754d6ba7a59d2108b6785d3` `fc15d2d9130e23d0a290f5a14f61423152d2c72c`
- `modules/sucafina/Sucafinav1/product/planner/sensitivity-units.ts` `1673c86995cf71b61e288d91492ae7b691934171` `29ef0758be90aa2851a2631de8ed3aff5e0cc332`
- `modules/sucafina/Sucafinav1/product/planner/stored-scenarios.ts` `fca509789efd2bf1b7d9453d09a3a460ee778feb` `529e29806b3faf15f88eec009c198e783f4248a3`
- `modules/sucafina/Sucafinav1/product/portfolio/README.md` `4bdad097bb82f3dc96a74090bacc567835295680` `323db18c9bd1bcf576c6b84ebdc6088bfdd6c86b`
- `modules/sucafina/Sucafinav1/product/portfolio/analysis.ts` `347d1c97952167523f9b2b04f1ab4fac7178cc9a` `03576f1ec52d3d3c1f022c91d6c85257fa0491b8`
- `modules/sucafina/Sucafinav1/product/portfolio/campaign-proposals.ts` `3ad0b190ad5d50c33e99d3c622831b6f0cc6cdac` `5d09df9ff7f2c1cc81993459116ea8267dfbb78a`
- `modules/sucafina/Sucafinav1/product/portfolio/campaign.ts` `d364563602bb002ebe24f22d36572b888008f665` `d5fe38ec0a02ce23dedd756869a8f10c15e3db4d`
- `modules/sucafina/Sucafinav1/product/portfolio/catalog.ts` `841a02df28796dfd4e96a21cb6d8a484a2536ad7` `cb75aeeae32310911063b673fc27e9c94eef3762`
- `modules/sucafina/Sucafinav1/product/portfolio/handoff.ts` `7b56f439ce6e1a1483242d87f7feb42079a7cd11` `7a236670dcec3ba93a316c7e41db59daefbaaca4`
- `modules/sucafina/Sucafinav1/product/portfolio/history-provenance.ts` `5b1877a97620c1863c7ee43d3274594ddedde8f9` `caa3b783b41f95287bba8a4bab3c652c8375c320`
- `modules/sucafina/Sucafinav1/product/portfolio/planner-sensitivity.ts` `1b103be1730a0227df903800f7c176f9763ab758` `9d29046dd40adffc88985be5e1b1603b64491129`
- `modules/sucafina/Sucafinav1/product/portfolio/port.ts` `cf8903ea6854a1c10f7bc6e2980a2b422b11d0d4` `452877ad2c82835fe883ea05dbf15f80f84f51c5`
- `modules/sucafina/Sucafinav1/product/portfolio/product.ts` `8fc915379f153fdb437be09c2c84924d7d59b6ed` `d4c5d9c9aabcf70bb71739d3952776517dc55923`
- `modules/sucafina/Sucafinav1/product/portfolio/proof.ts` `e07714d6c390a655b6eac7f5c2d56193b7bbfc7b` `d99af3b43388b510e510908fff2371a34b57eee1`
- `modules/sucafina/Sucafinav1/product/portfolio/read-snapshot.ts` `095a0e5764e115fb874a5f5c0c16a9c73466c340` `3cf82bd82b2716ee689b4c48bd9551540b058287`
- `modules/sucafina/Sucafinav1/product/portfolio/reconciliation.ts` `387e78deeb6a1e97a21a68bd84839c3f1e979254` `aedc80310eee2752d067dd52afa6312a9558b87a`
- `modules/sucafina/Sucafinav1/product/portfolio/result-store.ts` `f134c70c0e38879bfb36bc31c9743c99a6ad509a` `ee4e54c4b7761109ebddc1a4a2f6e6becea4ba48`
- `modules/sucafina/Sucafinav1/product/portfolio/sensitivity-store.ts` `22e23b3f6f3f59b603a25162a11e935da6937e44` `d2528cc98eabfea36025f25cdb0cb2bf9c54c42c`
- `modules/sucafina/Sucafinav1/product/portfolio/sensitivity-v6.ts` `bf8f775085a26adcaf4566fba4daff22ae33262b` `f675fdca70dd48caa4635cb1542b85bbc25d204c`
- `modules/sucafina/Sucafinav1/product/portfolio/sensitivity.ts` `6c08aae11dd559553d5f9274d1aa5750686ff8fc` `247a0cdc456f386475f53765e6da2e1db156eba8`
- `modules/sucafina/Sucafinav1/product/portfolio/threshold-proof.ts` `89ba60857babe8a5c80f409de39b7e0598695b96` `ce7d267d126992bc1a0796e2b64e5dc1c87bb12b`
- `modules/sucafina/Sucafinav1/product/portfolio/verification.ts` `f23f28c0662a3a805648344fcabe8df129f2d9ba` `254e22ea35f5b422b59c8f0549c8f12d1d4fb492`
- `modules/sucafina/Sucafinav1/product/procurement/decision-host.ts` `0c970d36c5af4f5a58dfca80e1c46cf12d478f5f` `9b48c999661e4b8a10593ae7cd5d6e2ed1e2f635`
- `modules/sucafina/Sucafinav1/product/procurement/decision-http.ts` `d6ce17ec9d81b5c1d2feb91b7ccaf640295f6e3b` `fa83ce380647f02d8942f01ffbc1981cf1b2494d`
- `modules/sucafina/Sucafinav1/product/procurement/monetary.ts` `5ed7b1c7e8f140c2820d9e3095a7427374d10f69` `c9a224b12c13b7cec506be90527300caa7e984fd`
- `modules/sucafina/Sucafinav1/product/procurement/prepared-review.ts` `b7d25206bb7ba11d20b293495f09e6cb70430a84` `7af4f596f6eabce32d2c3a21947300278c345cd9`
- `modules/sucafina/Sucafinav1/product/procurement/prepared.ts` `1cc3b43ae6e0673b18195a15c8b86d99a701a6a3` `68a309ddc7c637ba1c473fb2edb4848250a51ab6`
- `modules/sucafina/Sucafinav1/product/procurement/scenario-preparation.ts` `82b7d822ec5ca65ba9450cde74c5e8f39da84493` `3a13c3401d7629904155664b3b5e08665c2713cc`
- `modules/sucafina/Sucafinav1/product/procurement/sourcing-analysis.ts` `987f7179101ffe3db0276d9c6172b3bcf6024329` `e54386d4b84331ff255546dc891ccad5b1391709`
- `modules/sucafina/Sucafinav1/product/reports/storage.ts` `4e85f0e809455aefdeebb586fa7c268c09d49de3` `b98b59c80d8208926ef1b61fccfe098389000230`
- `modules/sucafina/Sucafinav1/product/reviews/agenda-picker.ts` `4d2e9087e4adfb57cdcfb6b0c686e1a6b9d7a516` `4a49ca7808ae1fe64060ff002c85643c87a85d1a`
- `modules/sucafina/Sucafinav1/product/reviews/application.ts` `9a508eea9d01cdebc28ee2fed72a279782c0ba79` `de76611be141d599b9eecc96e1173559e06be26d`
- `modules/sucafina/Sucafinav1/product/reviews/browser.ts` `73f38f0040f053ff24ca17ca9bc53dde84bf0082` `ea194a5c8cf0624c278c8dc2bf81c0dac6222887`
- `modules/sucafina/Sucafinav1/product/reviews/capabilities.ts` `fd79690c368087f48276e0cb21198f91f59d5e63` `aaec725b79e900ef11c046b816495bc80ce837e7`
- `modules/sucafina/Sucafinav1/product/reviews/closure-action.ts` `92e74e4f231e02a4d357232da08cb21e1bedc158` `caf603047af112cf4e11130601fb5e171403d8ab`
- `modules/sucafina/Sucafinav1/product/reviews/compare.ts` `3ef456060b03e6ad1f4460505e964990d71e8820` `5d5009d14e31078218bfacdd289c13bac9a53507`
- `modules/sucafina/Sucafinav1/product/reviews/composition.ts` `a0a35f08941e6fbbaa5890ae87ebd7bd547300c3` `e55a1ebbddb54d9a300948ba7c954da7412f627c`
- `modules/sucafina/Sucafinav1/product/reviews/decision.ts` `54d3bf74bf136692e1aa20889b24b82d6f138695` `0e2918cfda9bf1204d99b264534995b90211d9b0`
- `modules/sucafina/Sucafinav1/product/reviews/http.ts` `3411fe33f7e907cdb98c35841161342fda43a3c8` `de93cca2ed76a3afb612e609cd937f2faedea36a`
- `modules/sucafina/Sucafinav1/product/reviews/inclusion.ts` `7fa03e1967278a47c2e8bba9ee0fae7d4b512564` `460e5d3e88f06f71fc8d2f42b36977e243681738`
- `modules/sucafina/Sucafinav1/product/reviews/meeting.ts` `4939f825fcacc4cdfb7995389909b362404b400f` `4b148e2bfea0e356641c18f0821e503b18e33590`
- `modules/sucafina/Sucafinav1/product/reviews/outcome.ts` `1a628eb2841f9241a3521acb7adb8afa7736585e` `c32bc935e80c640110db8df28a8ab3adefad1b61`
- `modules/sucafina/Sucafinav1/product/reviews/port.ts` `1b93fd89a1f544808455c15d12f9c06cc18e21f3` `1290845a260606bd6e2b30594ba4247724ed7290`
- `modules/sucafina/Sucafinav1/product/reviews/render.ts` `b86ae1f0c012922610a9567a3ef6a4af1fd5e050` `7010c9e5ec1f5300388408573b5ace1273662070`
- `modules/sucafina/Sucafinav1/product/reviews/report-layout.ts` `ed6d3f5342d06fac2782ae4ae63c1158e6b1c2fb` `bdf1ddb2b2c2fe9e604990fdbb01fdd16f389012`
- `modules/sucafina/Sucafinav1/product/reviews/selection.ts` `90e42fbf42c07b11d7a1546a3e828d2de5e970fd` `3de1bf6369b1ca68e09dbae5ab6ffecaa87b85dc`
- `modules/sucafina/Sucafinav1/product/reviews/services.ts` `072d49caa29b32020def8b65c6fb46849e48e154` `b4e16a0c948d1232cc73f2785a6ee1d2bc0e3dd7`
- `modules/sucafina/Sucafinav1/product/reviews/thread-access.ts` `a432b41361da396a119b459819520cbbb3e4ecc4` `9d00f632224d36a7e073f1dd66d50c885a1ad872`
- `modules/sucafina/Sucafinav1/product/reviews/thread-context.ts` `993d8fed23f398c4317dc6ed63bed05a5b79fd08` `5123063a55dbb7ab8935ff95e432b8bf1a77fd0d`
- `modules/sucafina/Sucafinav1/product/reviews/workspace.ts` `74ea2daa2cc37fab3edb7c0d4ab2e31f7bceb1e6` `bc60164d6606c583a44247346e261674a7859ef0`
- `modules/sucafina/Sucafinav1/product/routines/capabilities.ts` `8f07a33f0f40d66946724232935c8a9d6729d6bb` `b8adcb574a84c213bfdec0659c7cc074a543564c`
- `modules/sucafina/Sucafinav1/product/routines/confirmation.ts` `acaa9ac57833b63722ea86685428c6a8ea5a02ab` `7c8fbe1fccd59de8371e53ad267f41d2b2a8cf70`
- `modules/sucafina/Sucafinav1/product/routines/dossier-host.ts` `bec25128959bb61a5c797356ed8bbd8eb91ab3cf` `02fe642f37b3e705aa7c2bdeea775b67da364fe6`
- `modules/sucafina/Sucafinav1/product/routines/dossier.ts` `c662bc71faca16222b9998a5efabe4a34c67becd` `ed88a6ff4f6c42eecfd80ba13824e8122fcc774e`
- `modules/sucafina/Sucafinav1/product/routines/factory.ts` `56ab7cf58e65d2d051279aac484d58b17ccf1f0e` `387dd1238698a0f70cf719c517a749fd62a77e5c`
- `modules/sucafina/Sucafinav1/product/routines/forecast.ts` `67d73492002cf91ce31d36b911b0fecee09c27d0` `6f73318052e4e9b18ab31f0abacce5bed2912a71`
- `modules/sucafina/Sucafinav1/product/routines/material.ts` `07078ebd561cbbce0fa9cbc9adf180b995395b59` `39b794c05bf7734522d3e7cd28a7d55072aad21d`
- `modules/sucafina/Sucafinav1/product/routines/publication.ts` `96225e43f007fb3d83aaa1c3447297ef22413bc4` `0c1eef9e9f298d5bada09d3e46c38ff8d228b1f2`
- `modules/sucafina/Sucafinav1/product/routines/result-access.ts` `2695f4d4564b071a92529e55910e7edd54599392` `098a92920857926f117e266f5b63325f6ad112ca`
- `modules/sucafina/Sucafinav1/product/routines/review-confirmation.ts` `7ca5a824c2cfd2b720f6e946311c139b02ead1a8` `a5a36ae5c3ed05c7d13820ae22d80520c8dccf8f`
- `modules/sucafina/Sucafinav1/product/routines/review-host.ts` `17bd4aaeac65c7c641abb76e33cd15b1a38d73de` `3a2b6ac526b5e104cc1a62a8d93106e24413f4e6`
- `modules/sucafina/Sucafinav1/product/routines/review-result.ts` `02468d1cd7dbe19b3d9ad82a285e7c1c6a7ed274` `67c891483193579b2811c46ad76a714d282f5a39`
- `modules/sucafina/Sucafinav1/product/routines/review.ts` `fd0ef08175ee5e61d6fbda64f9b1225e4b19857f` `d38633a4486d322263b8c53691ac6c8c545f9f64`
- `modules/sucafina/Sucafinav1/product/routines/schedule-native.ts` `dcba9e0b9776d9df34e535b2f671f02a3f9ee95c` `0711a5d689e303f7cbca97b46d10a10aab4c2b8e`
- `modules/sucafina/Sucafinav1/product/routines/schedule.ts` `56ca29211a52d2226686fc8ea8ddb1999cfb4e6c` `c2f76fb6ebf2f05b8b89a08561bfac14cc52ad66`
- `modules/sucafina/Sucafinav1/product/ui/case-work-selection.ts` `3f76f17d51d09b86fa63a5c98c70cd4e77c91713` `cc0bfcdbd7b31d1aa31d65300251b574aaad4fb9`
- `modules/sucafina/Sucafinav1/product/ui/components.ts` `cd559d550b6fa799549b23c5c2c9f353781145cb` `8de96e7fef8b1db5f174baaff47864b68f8d2fca`
- `modules/sucafina/Sucafinav1/product/ui/decision-alternatives.ts` `a731b36427ffbdbc30d19b3b7785be16e5c9747d` `8c89acd506b8fc7177ea07ef7a2ffaba74634853`
- `modules/sucafina/Sucafinav1/product/ui/shell-state.ts` `58f7a218124cffed60d6e639d7f3ee675cf159d2` `74ccb3c50dcadd85878987870f0e388926898d53`
- `modules/sucafina/Sucafinav1/runtime/admin-surface.ts` `c4dc921cd795fc1b6a6ca12e912cdecb8a2b5eca` `MISSING`
- `modules/sucafina/Sucafinav1/runtime/admin.ts` `ce15f5d2ad4d6afb9028e9393b1610ee6e155da4` `64cfaf1fcada712548c5f28a12be12aff37f9620`
- `modules/sucafina/Sucafinav1/runtime/application.ts` `6f08c33849c474782aaf2f4f75e19aded8f90b12` `a0deff8a3b272019f472aa2f93499d1940a78370`
- `modules/sucafina/Sucafinav1/runtime/contract.ts` `1cf67eb10510ac5b14e47215956c37f594e2694e` `8be1156b64e957eae4670f7ad1bb6cd51e61e649`
- `modules/sucafina/Sucafinav1/runtime/dashboard-budget.ts` `4344414baec60cb4c1b0d126d9a8c7314e7b1e6f` `21e1a63b3a88db673c79170cdf873be0c9949a27`
- `modules/sucafina/Sucafinav1/runtime/dashboard-operations.ts` `b3941f209a7d769786ca613e836d7fafcd92ba0d` `e9080c80975246722a5f9e11084bc44f5d677f6e`
- `modules/sucafina/Sucafinav1/runtime/dashboard-people.ts` `15722c4b255e6f30927743f73a02d5f959b60625` `c8be36e9eb49f6fbd10fae3429d6f3cd2af0151e`
- `modules/sucafina/Sucafinav1/runtime/dashboard-portfolio.ts` `9d0dd026b1a82d2cddb8afc19fdcf2513f5b4d0e` `3b4e54da44683e56687cc744cd7c42ba7da4d8a4`
- `modules/sucafina/Sucafinav1/runtime/downloads.ts` `fa365f9d350be341348ab69d789e40779c8b9756` `ac73b9edc44bd5c8a616ce583084969d2a69e771`
- `modules/sucafina/Sucafinav1/runtime/local-configuration.ts` `b8518a74fb1ee222229572b8194fddb8c4994ac1` `9fd36deee7a2ef4b3584faa7f49b682d0304741f`
- `modules/sucafina/Sucafinav1/runtime/local-contract.ts` `69275afbb0ecd7bcdaf7b9eefc2a9dc1d39db917` `55982088948974d0451bf5171e589d3039317a83`
- `modules/sucafina/Sucafinav1/runtime/operator-contract.ts` `5c4b0481e83a81ac208c0d64726dcecd7ebe7d4a` `5492bf119c26bed2daa47d1cf29ea0e43e92f862`
- `modules/sucafina/Sucafinav1/runtime/operator-identity.ts` `f67105e8a153bade1457be192cbaa8ac60997cb3` `ec9da845f186bc48f57f4611b8d08429f00169f1`
- `modules/sucafina/Sucafinav1/runtime/planner.ts` `ae7f5754d816cb7fab41b0e3617312e2c46880c5` `de99f191004a14e85756951ab5942d98db710d89`
- `modules/sucafina/Sucafinav1/runtime/reports.ts` `13649e22bc45fbef036d9cf605cd1bc6e491d5d2` `729a6eeadd72f3ed122cd2ebc94ad8e4b52956c5`
- `modules/sucafina/Sucafinav1/runtime/workbook-amount.ts` `3396650ac1f0c29346b7d11d6809920fbcef3deb` `MISSING`
- `modules/sucafina/Sucafinav1/runtime/workbooks.ts` `ba8021c204d1d3fce18fa633934cc71d0c255992` `a1b569413d4214a4c4310429b1d7a139e6d12204`
- `modules/sucafina/Sucafinav1/src/dashboard-accounts.ts` `e68eb56b5ad63c48a2a40101620807a47f0613ae` `967e8619c7c59ed83d941888618f503f492238b9`
- `modules/sucafina/Sucafinav1/src/form.ts` `8ff5e0b3d7bd566a9a8534baa2a1ffb87a8a2419` `5c2ceed59b5af1a0e2958e93c2267bee9e72a0dc`
- `modules/sucafina/Sucafinav1/src/planner-accounts.ts` `e1150d144b701a43f80a286134464035cc39d41c` `6ca9b19e8b54e3279c2c16667e92ad7df748b3ea`
- `modules/sucafina/Sucafinav1/src/planner-role.ts` `5463ffbe06b32e5068d7dd5efa2f147960d7e075` `15ff3391a6bde761e0c176b37d88ec3dd000e72d`
- `modules/sucafina/Sucafinav1/src/screen-shell.ts` `5e7d697d811d818d1b42183f9a6fc69ed5e3d955` `f1573e02df562db7569f53931d7a4524a108ad4b`
- `modules/sucafina/Sucafinav1/src/workbook-date.ts` `256637bdca884e6eebd9455d45379b06c4db6788` `MISSING`
- `modules/sucafina/Sucafinav1/test/admin-surface.test.ts` `c8519c798df3ca0bfac3e361321346b104ff5ceb` `MISSING`
- `modules/sucafina/Sucafinav1/test/business-browser.test.ts` `2b45e7b4a1c1afb3c5fd0816afb834f331fa57b9` `2949c56347cd55cd404fea1c7a3418b89b1543a3`
- `modules/sucafina/Sucafinav1/test/dashboard-operations-runtime.test.ts` `698f15edde691661619f3fdee2fd2d75ecb6506f` `46f384e8117100f4bb0f7b8b3d1cb6cd7a117b4b`
- `modules/sucafina/Sucafinav1/test/dashboard-people-runtime.test.ts` `93372bbd8070c60490e1f1fd1a68e9267d2a6809` `15a403d69350dc7d68a9f834523b675959db9e03`
- `modules/sucafina/Sucafinav1/test/dashboard-portfolio-runtime.test.ts` `00dddbffdfadf080ae23948e7f324ec7dafeff70` `fd436c62f6473ff8f0c7d573b1ca1dc3bf23930d`
- `modules/sucafina/Sucafinav1/test/fixture/native-write.ts` `075894418365ac0fc2f8c3bb5b07a4bd05ddcc35` `MISSING`
- `modules/sucafina/Sucafinav1/test/form-layout.test.ts` `7748fcbd3aa9073c5ec487d5b649bf47310956bd` `017f90d16b373971e45cda8db634e0984c9d12ba`
- `modules/sucafina/Sucafinav1/test/installation.test.ts` `81a291feb0b4abe9703395bacea2dd3935ec1304` `dd8ad154a36b014f106f90ffe70b2b823435f766`
- `modules/sucafina/Sucafinav1/test/io-browser.test.ts` `25a4dbefcfd7a5fe50ab3e939c072f88743e0669` `def57f27a01943e623aae6d8dca733dffd6a4f66`
- `modules/sucafina/Sucafinav1/test/local-bootstrap.test.ts` `485c61f3ec9806d828a0f06215010e9d64d8e1b4` `38faf2e35e622b22794c0c513109967ed929372c`
- `modules/sucafina/Sucafinav1/test/local-entry.test.ts` `4c1c99169a5acd2faf861ac66d8fa66b84deddcb` `bf57cb46b12446f8ff6d271f0b9f27b7ef995d19`
- `modules/sucafina/Sucafinav1/test/microsoft-entra-client.test.ts` `9f6556bd33444d37b4e5ddb6931e560d234cd28e` `17422dc0c812b22da51cc3bd6b57bb9e9ab01966`
- `modules/sucafina/Sucafinav1/test/microsoft-login/microsoft49-installed-reconciliation.json` `24fb8614d339421f180a9ebd2f71fb570d9b9710` `11e134bf5a2ab2ec5349300b19339fa12e51705e`
- `modules/sucafina/Sucafinav1/test/native-action-boundary.test.ts` `19ad3b856c9389443668a3f6c0d777a23d5614a3` `MISSING`
- `modules/sucafina/Sucafinav1/test/native-domain-actions.test.ts` `62fdedbac32aa4b8578aafc6197ceb7cfb8e778b` `MISSING`
- `modules/sucafina/Sucafinav1/test/native-gateway.test.ts` `ee69ee4785e23dd781482e017c3bdeafdc9422d1` `MISSING`
- `modules/sucafina/Sucafinav1/test/native-installation.test.ts` `90d662947ed16f93cf1018a237b11be41a3919e5` `MISSING`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/analyses.test.ts` `8fb0ddb6631d5c35bc568a8a06a24294b25ca95e` `03aaaca3e278b05c0610e735bd1f7c6ca7bfbea8`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/bi.test.ts` `26017329781b67185ffdfb2b0e5cfdfc00c001b2` `09d294a0ff7131f625420aa1a94c560891f880bf`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/collaboration.test.ts` `c9b26645df1e36d2104b22cb333ce4a467454e49` `fed9a0e1bd83ebe9dab814c9343a525df88e2212`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/decisions.test.ts` `d5d4d12874d7afa9cd32f0724d9967e9f3a2d481` `880235336ad2d5afee7a65d11a56dd82b4249ef0`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/domain-health.test.ts` `1f3dc49ebc0a26a056aa7c0674fe42dea7fcf355` `eb3b12a050e2744ac08a41bda10ca53631140bcc`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/domain.test.ts` `1eca59606897df8c2a291bff860e51cb6e3f81ad` `8963d8e5e174692391f67110ea0a58c90670dbb0`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/files.test.ts` `1c4d58aaf184a277ca2dd04b263ce0ad500a66d6` `4d9ab87bc931052e606b7e68c27773a6c29a63e0`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/live-context.test.ts` `9fc888c5ceba20ca321e90ff8bc8e64e0c3acdad` `aa0feb2c58be8276dfdf3256693a22dda17f64e0`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/memory.test.ts` `b658352fdbdb336ef1eb57815ce2b457e6654dcb` `9d8a45cd2fe28b64fa21b2f89d91e37bd5f97f33`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/operations-mounted.test.ts` `4766ef2a49a1a7f3c314188281091cee636cf1f0` `e71bf01c5c564ab1bd14369d2d724329d34d382d`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/operations.test.ts` `0a692b53eadcab8eb619ee49298c3fa97516f70a` `7604d7adb643698970eefd96340e2757a34c9970`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/people.test.ts` `0f5d05fba397355585e8a96013387f146f4208f5` `16661879c65c608e63451743c13caabe97b63feb`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/planner-operational.test.ts` `f8d0123e88ce508b99cd7d7d5ff01bcc05003398` `0a3db2ca7a552aaca009a13e8cd4a8d32dc4fb6e`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/planner.test.ts` `1630180b74a5775280e4c90038849f9df99b87ff` `642a5b2c023abc45d55d5b0798518bee09ec9c0a`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/portfolio.test.ts` `3820d0dea2470e7ad620bbf48ee50120ccdaece6` `515e6eaa31599d5d2e2c43b74fa57e056e07c3c4`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/procurement.test.ts` `a2554957371a7fc1dcaa63a41ad2815f95252e45` `e003a32b14d5865925249b63ed7ee87915bd7b39`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/recall-health.test.ts` `9a8bdb6c70444a3aa15676800a2c62fec31fff88` `e09dc5b1dfc16dfc6852a4e80b8b23476554e40a`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/reviews.test.ts` `9f2edb98f220c741e9b5cbb9c80b7ebf916867cc` `96282446a1bbefcfcddafd9ff48393c99ccfa852`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/routines.test.ts` `f5e8046200167c6e224ac4d5ff85e8e9ed2725ee` `9b86d64f4f6f421b9e395417cf0fbc98c572e155`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/sdk-query-repair.test.ts` `d0d54dca9245feb151f9f6cf6015f344cfe741e2` `c5450a8c62d4f5ebe2e09d1d1257ee0faee91ebe`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/transport.test.ts` `0789f34911cd97d82a870dcee2f17fa37c8b4578` `e6c9ed2ffca9b0d4ae6512b05d7c86da7886cf4a`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/work.test.ts` `18d330c2980cc18bb35cd4976c8635ec94295828` `beb05c8db34378fff05f53a14e9e367a400ae9e0`
- `modules/sucafina/Sucafinav1/test/native-write-budget.test.ts` `6e1ce84743d75ea5a14770b8c58daadbf434625e` `MISSING`
- `modules/sucafina/Sucafinav1/test/native-write-fixture.test.ts` `ccb933ef621537903e5211f61388d6c2b0ca0dc7` `MISSING`
- `modules/sucafina/Sucafinav1/test/native-write-operations.test.ts` `1409fc7fe8f9a2a988b7f9d5b6d18903d5e50e9d` `MISSING`
- `modules/sucafina/Sucafinav1/test/native-write-people.test.ts` `edfb4291b7c4b58dbb14a971a50adf3ffa8b8f4e` `MISSING`
- `modules/sucafina/Sucafinav1/test/native-write-planner-hr.test.ts` `f46892747d3c7e2b5d91d731fe8dfa59a7df3914` `MISSING`
- `modules/sucafina/Sucafinav1/test/native-write-planner-lines.test.ts` `98a0cfb19694712a0fffa3d0179e0cfe2d2dfb4d` `MISSING`
- `modules/sucafina/Sucafinav1/test/native-write-portfolio.test.ts` `e8c951285b19bd1531a03cae0577d72e363aa1a4` `MISSING`
- `modules/sucafina/Sucafinav1/test/native-write-procurement-flow.test.ts` `54c29b7f49557703cab0d5ad8e6a19f2f08e2ccc` `MISSING`
- `modules/sucafina/Sucafinav1/test/native-write-suppliers.test.ts` `cf26f08eabc86a4a7557b43958fbdabae627aa4a` `MISSING`
- `modules/sucafina/Sucafinav1/test/operator-browser.test.ts` `c837f6eca10f054f974abba6ad54d8aaaeeb65b3` `e2695004b81956efd3e82cb9bc8245c217ed7a58`
- `modules/sucafina/Sucafinav1/test/operator-enroll.test.ts` `163203c713f367ffd38521c7693e7fcebd65229e` `d0cb78bfc1812f3880e22e3bbed460dca9af4196`
- `modules/sucafina/Sucafinav1/test/operator-identity.test.ts` `7f132586a0364a02f873a9b46d06bbdd2c38a414` `23e3db0071c676e8aa4bc93daeb8fe3e68129466`
- `modules/sucafina/Sucafinav1/test/planner-runtime.test.ts` `8614fc14850eb5b9729caae3aea7a05e761a9e9a` `486b12ef50bf3096586078aa5326f76566891e24`
- `modules/sucafina/Sucafinav1/test/presentation.test.ts` `ff4c839c55592bce04138e9c443d57f5d6775787` `e2c4335e02974bef2092cb6a2440742e55b5c870`
- `modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts` `d622fa8463ee6d05a5c03de6517381045b6f0241` `5c25f109c4df835761e8aba8351686174ac6d7aa`
- `modules/sucafina/Sucafinav1/test/product/atlas-memory-composed/fixture-assertions.ts` `83ca43d9785787613daadd26dbb9cd1a5ddbbfb9` `6de4bc15cf24cd4bf71671680c56ccc1d3be239c`
- `modules/sucafina/Sucafinav1/test/product/atlas-memory-composed/rank-tail.test.ts` `31f6297303d1dd1abc204f120a9a859134705f80` `fcaa2d108e4ecd24e24c71690ab79cd22c37dca7`
- `modules/sucafina/Sucafinav1/test/product/atlas-memory-composed/recall-groups.test.ts` `71b947d40374176f225634cddfd4fffcd4dd7061` `c5f1305c1b7f10a79cfb11971d3c579978d34d1f`
- `modules/sucafina/Sucafinav1/test/product/bi-cost-waterfall/presentation.test.ts` `75191a84a15c93c6a990c4b098ab25a6e9baea77` `4f9e4323f0684fc2cb95eb0f25046194062467f2`
- `modules/sucafina/Sucafinav1/test/product/c12-receipt-recovery/fixture.ts` `33650407123163ea881eca9d4940fde364b27c54` `d96709db609b399ef801f487e443a381863d6298`
- `modules/sucafina/Sucafinav1/test/product/dashboard-installed-closure/ownhost-fixture.ts` `cca6caa4504fe74e2b7e23f413de214be0405041` `d5ffdc24f23b20557613383d38cc03155e5e68c4`
- `modules/sucafina/Sucafinav1/test/product/diagnostics/calculation/source-observation.test.ts` `2bf73c9b16a502ba9b858227697d0b509e3a7d60` `e39a569201bff1daf590c3323acc8de60d32cf1f`
- `modules/sucafina/Sucafinav1/test/product/diagnostics/memory/persistence-observer.test.ts` `8cccdc2a4fab35115e01f5e3e6b87ee9878464a5` `986de13f9658d364b99a8460dc214b8a3633cc43`
- `modules/sucafina/Sucafinav1/test/product/diagnostics/memory/persistence-observer.ts` `a2b3917c8a186ae3ea024bd2df50b0a919550bc1` `6f7dd187e3f311d7317442f05201f311587fbef8`
- `modules/sucafina/Sucafinav1/test/product/export-artifact-closure/composed-storage.test.ts` `4f268069e082f0ea463a251e7bceb27f4da74700` `795a1460353e7612cd3cf5477f0a9f52c5ba8e3b`
- `modules/sucafina/Sucafinav1/test/product/export-artifact-closure/fixture.ts` `d941eaf91e301ff530a174c1e92192237e3d3ef0` `03c918632f8c7bf40e1b4bbb91e71a6ae3de74ac`
- `modules/sucafina/Sucafinav1/test/product/export-artifact-closure/preserved-source-drift.test.ts` `1cff4b1331ce1a2d1d095b2c54aa6279c2904809` `5321c1fa17c9ddf6299364770c28e695b60282de`
- `modules/sucafina/Sucafinav1/test/product/finance-persistence-performance/surface-demand.test.ts` `8a81665075aab6f8afa37105d3174d698f18bb9e` `0ac3c01f77c013d05ee8fecb69c401acd126b942`
- `modules/sucafina/Sucafinav1/test/product/finance-state-read-performance/isolation.test.ts` `18f3140769260dafbe7f639d6694ea493f3ea535` `68bc02293a7f6baa3c2e46b4617af3341b9a03ea`
- `modules/sucafina/Sucafinav1/test/product/forecast-cancel-visibility/fixture.ts` `fc32be217ecd5d966af80e83237a0f0638c94024` `3f7fdbc50bd1e879a84008a5cf7acc95a2e5d346`
- `modules/sucafina/Sucafinav1/test/product/forecast-cancel-visibility/journey.ts` `5a0974e1db22115345750b11861b727db9bba90f` `bb70fd8e7da9db90fdd4851078beade6191ad507`
- `modules/sucafina/Sucafinav1/test/product/http-body-limit-fix/binary-domain.test.ts` `7d0ccfe23def8601eb152b8cbe45ddb1df40456d` `2044835954009e55b8ba751022539596fa878d4d`
- `modules/sucafina/Sucafinav1/test/product/http-body-limit-fix/binary-fixture.ts` `c8865ac73ae4932ba79c8e90c38ce5ee78b3486c` `1c7d2b14701911a9db2516f62b11bed3403adfbb`
- `modules/sucafina/Sucafinav1/test/product/http-body-limit-fix/workbench.test.ts` `869a66168c1b43189b2291f50a80742761ce6043` `0a1cb6665c8df14609dbc95b201028de1f273526`
- `modules/sucafina/Sucafinav1/test/product/import-history218/real-receipts.test.ts` `a302126ef23e706972b3b80b14c78f3280feacf3` `09023e83a000befece1b1d84fcab0db468e8a846`
- `modules/sucafina/Sucafinav1/test/product/installed-bi-closure/canonical-presentation.test.ts` `e2638923ca123b918b99e2cb4e6b703147f7119b` `0dabb3896f372ed7932993dc2c5eef9bfd31050e`
- `modules/sucafina/Sucafinav1/test/product/installed-bi-closure/temporal-contract.test.ts` `252b519f6dfaee461323d3b16407fc6f5849e668` `f1a257005ef80d4217f14b59a1d6c1860a9efca1`
- `modules/sucafina/Sucafinav1/test/product/installed-bi-closure/view-rendering.test.ts` `9fae52985c3e940845cbd746d850da8f52b8f68f` `5e6ac478a5369f7b4e3fe1473069b3ad06e9c7dd`
- `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am01/portfolio-recall-proof.test.ts` `3aa9c1e325853678a738a793580c0d0a6f035e33` `49fb61c4254ac3c82c4ec2d091136802d416ade6`
- `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am01/recall-five-profiles.test.ts` `71170944471b600c01d80d921bb4bf356931ba8a` `e345f3c4d7a910865c37494ce4b0da4d05f00486`
- `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am02/observe-native-c16.ts` `fdee242c35f56644c3aaba912eb33f40f49216d7` `2610f2e2f346d122dac6f347f372ef1649ffa1d8`
- `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am02/performance-public-c16-reopen.test.ts` `39fadbd24ce24da349393ea5a1bcddd8a010f597` `a4d576684d38259aff85d1c38dcf51e94762c326`
- `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am03/provider-generation.test.ts` `4081eaaed8cc3e3c8bdfcaf153cc015f9bb19ef4` `3a4918721bac33d0c661c463b5d4f9618d56764a`
- `modules/sucafina/Sucafinav1/test/product/minimal-first-save/first-save-recovery.test.ts` `566e765f201d1a45677c0c52c75eb92ecb16d482` `14e6ff5807ff2599fe8cc7793d22864c25af6652`
- `modules/sucafina/Sucafinav1/test/product/native-acceptance/preparation.test.ts` `cbdafedbcd2062603db72d547a18b538514bdcc8` `MISSING`
- `modules/sucafina/Sucafinav1/test/product/native-admission-closure/admission.test.ts` `e6d0f3c7f8f2e6cfa19da57de109984bf3c7ada9` `0098a065c267101c92054194dd5f0a3548c001b7`
- `modules/sucafina/Sucafinav1/test/product/native-child-admission/child-admission.test.ts` `3b50f3273c8a28da2a0bf4d3e2cee24c45e188f5` `MISSING`
- `modules/sucafina/Sucafinav1/test/product/native-host-provider/producer.test.ts` `5132e7459ab965a4bc2d6e8769499f1d1a8f2b1d` `MISSING`
- `modules/sucafina/Sucafinav1/test/product/p03-causal-closure/result-read-projection.test.ts` `a9de18da611f0921fb1a0b84898c523d2d9a366c` `MISSING`
- `modules/sucafina/Sucafinav1/test/product/planner-p03-finish/calculation-fixture.ts` `f3f5cad776aa603610c99dec829c10d565e1d60f` `MISSING`
- `modules/sucafina/Sucafinav1/test/product/planner-p03-finish/calculation-sources.test.ts` `7013df4178b57b6ea55c55e223749904008095a0` `MISSING`
- `modules/sucafina/Sucafinav1/test/product/planner-p03-finish/diagnostic-cost.test.ts` `8f0051c478d0ade11b044d95e2928206a008308a` `MISSING`
- `modules/sucafina/Sucafinav1/test/product/planner-p03-finish/diagnostic-expected.ts` `bdb17de3aa609fc56720fe5653a853c07ded3748` `MISSING`
- `modules/sucafina/Sucafinav1/test/product/planner-p03-finish/diagnostic-fixture.ts` `55f12d0958487f7b8cd1ae263cb0487ecb2c9cc0` `MISSING`
- `modules/sucafina/Sucafinav1/test/product/planner-p03-finish/diagnostic-probe.ts` `fdf2758ea7b21de74ea0e15b30f266c5e8f811b9` `MISSING`
- `modules/sucafina/Sucafinav1/test/product/planner-p03-finish/stored-final-detachment.test.ts` `92db0d29ae71b5342f6561640dba6016a634e189` `MISSING`
- `modules/sucafina/Sucafinav1/test/product/portfolio-p03-performance/trace.ts` `84d8b45cf88a9ac852eb09e4762932aced3c7433` `MISSING`
- `modules/sucafina/Sucafinav1/test/product/procurement-approval-closure/scenario-composition.test.ts` `d71a7b8003071bcbc0f144f682cc34920cd00d0a` `f0c056bd742647c66ae0afd57067cfa53eb003b7`
- `modules/sucafina/Sucafinav1/test/product/procurement-decision-producer/financial-policy.test.ts` `6e795a84dbab450a280f4c2043e166743ca5df78` `51288f53dcda77f721cb6395e7f4eeeebbcef0d5`
- `modules/sucafina/Sucafinav1/test/product/procurement-decision-producer/preparation.test.ts` `3c37f7868a62182658adf2b22d88e66869de8d73` `191021892019874e9ec8dec594b019f5addf7f3f`
- `modules/sucafina/Sucafinav1/test/product/reports-draft-reconciliation/history-provider-read.test.ts` `291e72cf1c356d76f1671ec971eac5b44a70edd0` `88c0cbf4dd0fe2b2dd856ecf7819b0bd613e33f7`
- `modules/sucafina/Sucafinav1/test/product/reports-draft-reconciliation/installed-read-integrity.test.ts` `65dd8c157ad31d288ee0f9142e1b41e08221de7c` `68973132641e5eb09cce84383156235d87e296d9`
- `modules/sucafina/Sucafinav1/test/product/review-fixes/finance-journey/journey-phase.test.ts` `5ca793fc4c7ae6d06f1af9cfb2f53faaa963c70b` `MISSING`
- `modules/sucafina/Sucafinav1/test/product/review-fixes/finance-journey/observed-coverage.ts` `0b6bdc6285b9a57c38939f5dea469bfdc060eb2f` `MISSING`
- `modules/sucafina/Sucafinav1/test/product/review-fixes/finance-journey/observed-ports.ts` `5e8740a9e3372e75624674617b63fadb5f81bfbc` `MISSING`
- `modules/sucafina/Sucafinav1/test/product/review-fixes/finance-journey/phase-trace.ts` `7123f5147720f643ef909b0a2d1ad1943afd3df5` `MISSING`
- `modules/sucafina/Sucafinav1/test/product/ui-ack-completion/ordinary-thread.test.ts` `e2a7bf62f7bf929abe31e51b01f9f505973a71b1` `c440ee01904089d463e664aa59eec352d60fe5e1`
- `modules/sucafina/Sucafinav1/test/product/ui-ack-completion/recipient-recovery.test.ts` `c10440b7e0a08cbd09b4982db18b5b8bb32c7a90` `d343ca2eb20faa63bab9c3e31487fab089c24ce9`
- `modules/sucafina/Sucafinav1/test/product/ui-ack-completion/recipient-refusal.test.ts` `c68152d42bceb6fd9062588b3264ab1e755f71d2` `a5d4d5ad97bc23d0a952ff4217af73ab6b84e6f3`
- `modules/sucafina/Sucafinav1/test/product/ui-ack-completion/source-replacement.test.ts` `1f12c67545ada196c847b01079cae8c9c0a2a4cd` `e375041217437ac5fc4c8018a78d31b7fd91a054`
- `modules/sucafina/Sucafinav1/test/product/ui-split/ui-recovery/recovery.test.ts` `529f6b98b6215f750912ac87161555eb2d9a555d` `8c6555129f5a1846e2b353515a0e86ecd03676c7`
- `modules/sucafina/Sucafinav1/test/product/ui-split/ui-work/actors-fixture.ts` `5d0feb74e3a41424afa5c94ef09178dac80caecf` `91205e4a9d58290733a4ce4ea511d00ed96734b9`
- `modules/sucafina/Sucafinav1/test/product/ui-split/ui-work/exact-confirmation.test.ts` `ac551dbd64c4c270c9e25f5c6ac3398a618435cb` `adc0b32bd43eab6823b2ab8af99b79160e1508d2`
- `modules/sucafina/Sucafinav1/test/product/ui-split/ui-work/reply-identity.test.ts` `9af14f581fad7b15c17f76327e63d1c60cb2d82d` `56bd09d4d53b5491917fd917a63a3d1b1111d18e`
- `modules/sucafina/Sucafinav1/test/product/ui-split/ui-work/selection-recovery.test.ts` `70c56df6b32d64b23a5ceb8f1819aca6e385749e` `132303aedbcb5524262aeacf0dec294b91be4290`
- `modules/sucafina/Sucafinav1/test/product/work-split/work-ack/recipient-boundary.test.ts` `1edd33775053761e69e76c57c2989210734ebeea` `MISSING`
- `modules/sucafina/Sucafinav1/test/product/work-split/work-g03/g03-conflict-review.test.ts` `878a23d475773901f3442843672b404f34e31561` `38042d9ad60e65c411c0024c77faf0194bb6163f`
- `modules/sucafina/Sucafinav1/test/product/work-split/work-reuse/confirmation-diagnostic.test.ts` `3aa6ad0b69c0fa0fc339942a832b070e13086816` `7e1c6339d8f10d896e5d9f48dedeb268a0deee48`
- `modules/sucafina/Sucafinav1/test/product/wp00/baseline-corpus-coverage.test.ts` `0d57555f689332a82a715d6b772ccf8eb9f9197f` `637cef4b9fb9ec24b3f279035a6a7f1c644d7cc1`
- `modules/sucafina/Sucafinav1/test/product/wp00/contract-boundaries.test.ts` `a4ecc232cb671bd1e9bd6caf1d978189f0acbe4a` `08ae098aec6ec8149dc5b4a30c18f7ef888884ba`
- `modules/sucafina/Sucafinav1/test/product/wp00/contract-consumers.test.ts` `92f2efc066c2018bdbf1a27559a2ffd8a7b5843f` `171bae7720aba6145351b5ed088b10995f8e02b7`
- `modules/sucafina/Sucafinav1/test/product/wp00/contract-freeze.test.ts` `d209121a1922787ca98ed4b713c3c19bab12e70f` `8c31f74816d482569ad68f3aba1cb8e766ad9952`
- `modules/sucafina/Sucafinav1/test/product/wp00/corpus-consumer.test.ts` `1f1c060f7a5b0f96e16ee8394a31d5f4511671e4` `9a61b8c4f81012e43a48acb070a7dc18f6072ed7`
- `modules/sucafina/Sucafinav1/test/product/wp00/corpus-reconciliation.test.ts` `9ed7e3f7b98fa9f054d41715bcd82434ed279840` `1e8c720bf2c34a4031a63a3027e2e515f83dfb6c`
- `modules/sucafina/Sucafinav1/test/product/wp00/fixtures/planner.ts` `c5a46dde2ed1cd5f88a1d3df08391274a19e893e` `2d7179d7588e689355b3d34dfca595067b6157b4`
- `modules/sucafina/Sucafinav1/test/product/wp00/fixtures/volume.ts` `8e0165e07d33d0c84a223cecc7523f6cb35217b8` `a7ef476a2ca076451fbf439bd316a21c39174474`
- `modules/sucafina/Sucafinav1/test/product/wp00/ownership.test.ts` `c8e196509be4ee3eda54e26276c830a4df1dff98` `dfb0cb32de54ef3d704b8ac0c15017871262c566`
- `modules/sucafina/Sucafinav1/test/product/wp01/README.md` `9d191a1556c7a3a57be3a4426d2de597b9c12538` `4bca9c1ef90e07e4167292d612cc55cc6330f26f`
- `modules/sucafina/Sucafinav1/test/product/wp01/browser-fixture.ts` `3a747f523a1705fdf32146e95e5c1571fbb9a88b` `156beb2d4ea52e4312c3bfb3c3298bcc32edfc0e`
- `modules/sucafina/Sucafinav1/test/product/wp01/browser-lifecycle.test.ts` `ee88e46d2633ff3dcdd53470c9cbaed2aac4ddd3` `260151909d86dfc77f6dc3229b660e63e5745033`
- `modules/sucafina/Sucafinav1/test/product/wp01/browser-startup.test.ts` `6952098674a027afafb11ff9cdf6d942580c4149` `f681ca2a663d0540898c4b4472dce86355ef20ae`
- `modules/sucafina/Sucafinav1/test/product/wp01/case-work-selection.test.ts` `653e81ec78fa19238fd53913d7bc2e26aaa5cae0` `3699a3c9c3206e86878770768a2399fc49d11618`
- `modules/sucafina/Sucafinav1/test/product/wp01/components.test.ts` `234fb542a0c799f6971b6d05a6e4e3532806ea9a` `3cbb432ce00ef680dbe7ccc74390b089038a7d17`
- `modules/sucafina/Sucafinav1/test/product/wp01/contextual-decision.test.ts` `6dfaa2323767eeab8937dcf4a0dce1c8a1179570` `671168b256283f2d4da00f0ab59fcafe371fa513`
- `modules/sucafina/Sucafinav1/test/product/wp01/decision-conflict-recovery.test.ts` `e22020011f464a2cc7277d4fe0f9a999c5587d38` `70f1f6e634c92cd23a271d653ede0bf305bd22a7`
- `modules/sucafina/Sucafinav1/test/product/wp01/decision-mutations.test.ts` `bf7c937edc920b8ac213193ceb64ab52c30c0e67` `393b34550b39c796a4bd7125162eba1c2fae806b`
- `modules/sucafina/Sucafinav1/test/product/wp01/edit-recovery.test.ts` `9a09c1f1a0ea5e422b34f2a2a224a6c93040ccd2` `be4e6c1f990ab190291022f2133e239fb9239eb8`
- `modules/sucafina/Sucafinav1/test/product/wp01/portfolio-recovery.test.ts` `0413accf37ab70703d468184f39ca0b5d67f7ce5` `712645acac294d0d3a8dc3a87f83b656189c9201`
- `modules/sucafina/Sucafinav1/test/product/wp01/question-recipients.test.ts` `5971661338663ce06b12e15eba09fe4a31740877` `b47b29497f2ec9a2673bfbb299829191de32622f`
- `modules/sucafina/Sucafinav1/test/product/wp01/record-search.test.ts` `1b5164d7c5ee988aec07254140a16e4d7ee500ef` `6706c7753cc241889195d65622ee7e0c4d38eb6a`
- `modules/sucafina/Sucafinav1/test/product/wp01/shell-recovery.test.ts` `f140ef854668977190ba05d6f2cd2f5a729511ea` `e5c3e7f569b3009de9b4aaed27a3231ddd089736`
- `modules/sucafina/Sucafinav1/test/product/wp01/shell-refresh.test.ts` `161ffd951c73dbae6b344521d8cdde959a6c0161` `8fca620410456af1ad786ee9f7739ff5642b19b7`
- `modules/sucafina/Sucafinav1/test/product/wp01/shell-state.test.ts` `755e4d2fe5e65e0281674528eefece30dea56183` `10fe1c087aae8b4f9d19124634676cd3840f69d8`
- `modules/sucafina/Sucafinav1/test/product/wp01/thread-domain-fixture.ts` `d239f1056f97a85f4caafac772ee79921806289a` `333cb8751dea4833ce0f127d9d924e2c790b3e2e`
- `modules/sucafina/Sucafinav1/test/product/wp01/thread-recovery.test.ts` `73f1b384e52945ba07adf6fd7dac2a05a54799a0` `a5f684fed8b90cf44e0c54dad39572284835a494`
- `modules/sucafina/Sucafinav1/test/product/wp01/two-actor-conflict.test.ts` `83473b61189ace45ae22dd0226591461a01d0965` `04132b4a9225057fcdb33868e5e3a22f24115363`
- `modules/sucafina/Sucafinav1/test/product/wp01/unavailable-views.test.ts` `bf49284de952cbc4c3b4a136b3d572dfbc3aaf97` `5b3c1e1115a81a9d880ee08f9d8c28b6c55b6e2b`
- `modules/sucafina/Sucafinav1/test/product/wp01/work-destination-recovery.test.ts` `6321582683cfaec721ad5cf0624a8e2da6e37226` `f90a6f1a4663e90a9ab8fe354be781baf4e94d78`
- `modules/sucafina/Sucafinav1/test/product/wp02/browser-driver-fixture.ts` `6dfd08d7c0bcc423b1af622fc73b91b2cb7e0b8e` `cd43fad88f3424ac160f32be743df17b80a74336`
- `modules/sucafina/Sucafinav1/test/product/wp02/collaboration-consumer.test.ts` `9c703f6e49b1491f4f4b2a6c503eff16c49a4428` `b429e974e4b104e5f576f144b157b642e88f127f`
- `modules/sucafina/Sucafinav1/test/product/wp02/dashboard-browser.test.ts` `700b4c459a812f05c13a7cae986f03dd79469dc3` `72b0a66701b30c1adffc3c28a8e58abf8cb65505`
- `modules/sucafina/Sucafinav1/test/product/wp02/host-integration.test.ts` `a0ded8f3d46bf5f7974d2d07058eecfb01ae3b01` `dd2c21f7a187daf53afadda628d0678c6cbcb345`
- `modules/sucafina/Sucafinav1/test/product/wp02/host-workbench.test.ts` `cffc985d9714dd0ae6201c37ca9622a35ab501c8` `bbfad3882e0ab38ebab9b943eadad8b4c478ac07`
- `modules/sucafina/Sucafinav1/test/product/wp02/hot-topics.test.ts` `ba4cf28643bafd3e4d3afb19a1dbac95579a69e4` `15d54cfea98fc362333dafb25ea28f4d5b13cff1`
- `modules/sucafina/Sucafinav1/test/product/wp02/import-report-consumer.test.ts` `e012e89f96f6f68a9223a3b3b5bb757b9bcb099b` `8d716fcdaa686599173c031693d151e87906829c`
- `modules/sucafina/Sucafinav1/test/product/wp02/native-capabilities-fixture.ts` `57f9d00320d08e8890712f9a8525e7a2c56f22fc` `93d24c34b73bdd6d1a6ef4c6fe57a855f6820b26`
- `modules/sucafina/Sucafinav1/test/product/wp02/workbench-ack.test.ts` `2b3072a5fd3103ec45d471fa1d7dcb6900b1109f` `4d7823be0abff16b4505910d080b47cf7cb96522`
- `modules/sucafina/Sucafinav1/test/product/wp02/workbench-recovery-fixture.ts` `6aeb601cfe9667056157baa4689cfe272f90d5bb` `593a46dad67e490dcfdd4fdc1878353088138dc7`
- `modules/sucafina/Sucafinav1/test/product/wp02/workbench-recovery.test.ts` `e6c22b6df3ec47ebc7dff5c745514da94d0d53a2` `f96b7353b3fb595c133b8af87edea11c56f1c028`
- `modules/sucafina/Sucafinav1/test/product/wp03/calculation-evidence.test.ts` `9d0fd989e33c1705e247232211df1ecba2a718b5` `a0a67918c69a636120daa66877669020803c108e`
- `modules/sucafina/Sucafinav1/test/product/wp03/parity-matrix.test.ts` `9a8236fad4a5a8e6f36fa509c94d3d1064050b13` `49aa288b0ef6fcd90debecc0bfea0bfc4749eb15`
- `modules/sucafina/Sucafinav1/test/product/wp03/persistence-comparison.test.ts` `c5c29d7ac94354318bdb32a3328ed6b93dc887e9` `5c0a15b19d6cff2f47e7ec292babf9cf98d2288f`
- `modules/sucafina/Sucafinav1/test/product/wp03/port.test.ts` `52d95dce1aad6d67344ef1f99635d1ca1999178d` `2c6a3519024d2cca0fcf5256dcf9055fa1d7ae26`
- `modules/sucafina/Sucafinav1/test/product/wp03/prepared-apply-integration.test.ts` `9f45358312014bb7b96ddf61e7141e8f2b5343c8` `5961c1eebeec21b75228bccb7caf1ca283fa6c9a`
- `modules/sucafina/Sucafinav1/test/product/wp03/resume-engine-freshness.test.ts` `317499b1e96ace3f56f23421e303bf5e6c47b414` `a36804ccf32440e4aabcb6f5e1c9a73b5d48bd65`
- `modules/sucafina/Sucafinav1/test/product/wp03/scenario-capability-parity.test.ts` `aa60133da6545a39eaae792d4656a08ffadfd3ad` `379c46b2c1f25d0bf8b1200bba6a9d9f276d075b`
- `modules/sucafina/Sucafinav1/test/product/wp03/scenario-engine-fixture.ts` `6d1810ce1d6b3dcfe688c4057a4cf28a06566209` `fd6a6b8b75152e858961360d16f7432233700b2f`
- `modules/sucafina/Sucafinav1/test/product/wp03/scenario-qualification.test.ts` `e0f2b7b6e1d99293e0cebac9c375eba34c796d9c` `8ba0ad3e8e4ce04df044dbe77df8e745008f5191`
- `modules/sucafina/Sucafinav1/test/product/wp04/finance-sourcing-integration.test.ts` `c9fa74a4e59e9204e6873619b9c580257d7d793d` `268c49a2bedbaf85eab24de01bbed2fb71f3c8cc`
- `modules/sucafina/Sucafinav1/test/product/wp04/host-integration.test.ts` `ae82f2d972c44256f2328dc3b733627c44bb3dd6` `a71839833d50fa3da37f18b2c1fca4597032a5b7`
- `modules/sucafina/Sucafinav1/test/product/wp04/prepared-production.test.ts` `c2bfdd97c92b67bc64f9edee8528dde4ebd648e3` `eaa14e509dadbba9242dade7b70e5cf41cc8b51b`
- `modules/sucafina/Sucafinav1/test/product/wp04/queue-view.test.ts` `0be7868bec9fc8886965a5957c91d557c8b1a7d0` `7c2e638a90e088e81494665d2910ea780dd7b654`
- `modules/sucafina/Sucafinav1/test/product/wp05/browser.ts` `08cc1017f6053ca3bc7e9b74e6790e4eff45f44b` `4f5a9f1068ca99b2c81dfe428bce4e89ec954bae`
- `modules/sucafina/Sucafinav1/test/product/wp05/choice-history-bi.test.ts` `9ecb910e6a45fda0f77125fdb6832ad650a011df` `cf93dff4919989322c28a3a04fd6380629f3caa1`
- `modules/sucafina/Sucafinav1/test/product/wp05/consumer.test.ts` `f487239bb4b29355661ef9678f914ca35cb9e1c9` `d4b730aacf05f0d3c193d78276b41ed3779aecfc`
- `modules/sucafina/Sucafinav1/test/product/wp05/engine-coverage.test.ts` `793a080bbfd04631f5234b5c686fe4e44cf74c19` `1ab7dd28bfbb9fef868f0992cb1653e00a151114`
- `modules/sucafina/Sucafinav1/test/product/wp05/engine-fixture.ts` `8724e535c625d8ffff8b8018c4052f7bb9e1dd27` `608b1a95b491740041f8689a41b4a064c7254b24`
- `modules/sucafina/Sucafinav1/test/product/wp05/engine-revision-fixture.ts` `93e9c37cfea05574c3c0b3ae080a03fdd5063056` `856381de3f333ca79b302483d3b8893d55f00441`
- `modules/sucafina/Sucafinav1/test/product/wp05/planner-integration.test.ts` `61a2262b176c62729612e0adad880f35ccd6fa29` `219f08eacd4df0de26c8219708ac8364d1c10082`
- `modules/sucafina/Sucafinav1/test/product/wp05/planner-origins.test.ts` `600d8d96a3517f0a3c1c51b6c2978213f9c8a066` `bf92905dccfd01eaedc624841d808d5ce21b6f21`
- `modules/sucafina/Sucafinav1/test/product/wp05/procurement-stages.test.ts` `08a28d60fb4c01a1277c0ae73082423039396233` `2eac642deb1e422017b28d41cc0eceba237568f4`
- `modules/sucafina/Sucafinav1/test/product/wp05/projection.test.ts` `9a8a3f82f14789cb637340e5f6e0bf8209f868cb` `52e71583353ca80cfbba6746c5bb0dadac48d042`
- `modules/sucafina/Sucafinav1/test/product/wp05/semantic-discriminants.test.ts` `3e16b69e139b9a93d1da9bc205b3c7dddc4a14cd` `0930332c1a46b8ee81e40402870f9d9f6081fa86`
- `modules/sucafina/Sucafinav1/test/product/wp05/stored-bi-fences.test.ts` `bd00deb467e5df32c426f200deb83c8d31f6dd3a` `2e18729fa382d1c8c1cc68d98703644e5c018be7`
- `modules/sucafina/Sucafinav1/test/product/wp06/documents/dossier-runtime.test.ts` `fb8a556a350ffa00953f037c51a1ce9d245b92f7` `312eedee019b1118707a9024749bbdbc862b5976`
- `modules/sucafina/Sucafinav1/test/product/wp06/documents/egress-fences.test.ts` `6b56d3110521f15af26ec735d667fa5da2a3411c` `69d041d3e9938a27a380eb13e75b173e46bf5201`
- `modules/sucafina/Sucafinav1/test/product/wp06/documents/runtime-e2e.test.ts` `e6163671e0123e977b9ac8a9d333ca84fe05fec6` `6183b5a77945fa2fe66f02e92c070359775d1129`
- `modules/sucafina/Sucafinav1/test/product/wp06/documents/scenario-consumer.test.ts` `95db3b471a1be78add9a6fd46b696db55e2d39fd` `819f3499172dc69a97710e389fc1363c457d973c`
- `modules/sucafina/Sucafinav1/test/product/wp06/imports/end-to-end.test.ts` `66e10ae6f1d2d1f29b2e667070b90080d5a0cc0e` `cce2a91907a6a46b02aa4f4596f8631cfd484a50`
- `modules/sucafina/Sucafinav1/test/product/wp06/imports/html-policy.test.ts` `63e21f50f79d99221b53143b88d7a6b995b72921` `34fefdfbcca6401b833fb5e75911fb29b9b18841`
- `modules/sucafina/Sucafinav1/test/product/wp06/imports/source-fences.test.ts` `8bb8f5f6aa3bdbd10295fd1bcbe3eb736162eef2` `2b2d90d85057dd9f78e20021b867b2a5b5068936`
- `modules/sucafina/Sucafinav1/test/product/wp06/native/fixture.ts` `9f647d64cf621733c68c844fec202d9244ee1c39` `8cdbe78f64fe61757ec7cd2b82a09917fae90659`
- `modules/sucafina/Sucafinav1/test/product/wp06/native/import-analysis.test.ts` `4087659570356188c546b59ba112dfd33a2a189c` `9c2895e47b9e49b742f1ebdcdc67abc9c7a0b6fc`
- `modules/sucafina/Sucafinav1/test/product/wp06/runtime-fixture.ts` `42512241dac897799b795d609518b49b9387e4e9` `5f45ba3357aa724af2746687761fc32fd4ca48ef`
- `modules/sucafina/Sucafinav1/test/product/wp07/application.test.ts` `bd0f0f731ad8d13f2ca76c78c9c680f3209f7cfd` `0d9a00095fa0e34ba5bb3f8de067f8b540807902`
- `modules/sucafina/Sucafinav1/test/product/wp07/artifact-storage.test.ts` `416bcf1de69ab2650572f9b1a52284c554e325f5` `a27c692fa69afbf9b9d618fb2a693dcea978fcdf`
- `modules/sucafina/Sucafinav1/test/product/wp07/browser-build.test.ts` `f2274e98de44db74d99dff5f4993720325f02170` `5d75db3b4f22259b239a69c0e37e90f4ce1a851d`
- `modules/sucafina/Sucafinav1/test/product/wp07/browser-ui.test.ts` `202153714575667402a9a413c51edcc1bfd82289` `7e0692bd9868f66cb1b6b01f5b3563c3a75ee104`
- `modules/sucafina/Sucafinav1/test/product/wp07/comment-continuity.test.ts` `f03cb8c536ad4715c03cd0df0e47e9a418c53a0a` `a71e8a912fee205b0e1b43df50ceb8e9fe5810e4`
- `modules/sucafina/Sucafinav1/test/product/wp07/dashboard-agenda-consumer.test.ts` `2c5f2b662e8fe538e96fb15568c5b29626168f6e` `8fc4478a9b2ddde3a57c9e8e3cb5d992eb99b8c1`
- `modules/sucafina/Sucafinav1/test/product/wp07/export-completeness.test.ts` `d27fe67e7ec6ad37c6c5dec495f6049faaf12c61` `0c2077c9523e99d7cf0f38e6e387c699ec1c85a7`
- `modules/sucafina/Sucafinav1/test/product/wp07/generate-export-fixtures.ts` `a033c612863d033ce70497bac97e44d1fbb08e62` `97cf2eb8d1a65605916b3f105af0bd569afc8250`
- `modules/sucafina/Sucafinav1/test/product/wp07/review-port.test.ts` `0b10585a9ea34b26a132816a4e56670ac5de23a8` `33389b8ebc1524763a800a7f047cd93792726f9a`
- `modules/sucafina/Sucafinav1/test/product/wp07/review-thread-context.test.ts` `dd87cd75426072d3884ac8a0ddcf063989f1c29e` `00bd120ba9086a781943fad51cb952ed28948798`
- `modules/sucafina/Sucafinav1/test/product/wp07/selection.test.ts` `8e053c34d75e663ecff2b04ee1e650dae4c867b3` `ae64be65445d7c96556e0cbe812bab1d3d1b9919`
- `modules/sucafina/Sucafinav1/test/product/wp07/thread-access.test.ts` `3688c5140c8b04c9cfefff3227a7167f2aaffc29` `a3db8c2b14243dbacc303a799e23dc3b3579ab86`
- `modules/sucafina/Sucafinav1/test/product/wp08/answer-evidence.test.ts` `12f5181b8e93673710b76a0f6ab6e681ef444c2f` `3fbaf232b91957d85e43f38d80141fb5952fa1ff`
- `modules/sucafina/Sucafinav1/test/product/wp08/answer-official-source.test.ts` `234a21c08dd9be75bd2993f8bf795572c1fac312` `327581c272809658c884f0f68e656623d8602584`
- `modules/sucafina/Sucafinav1/test/product/wp08/answer-reuse.test.ts` `d03e3444c85391f5b801396dfee4eca84ba6e686` `506127c65b0e86c5e69303589f3d42102e62fefc`
- `modules/sucafina/Sucafinav1/test/product/wp08/collaboration-http.test.ts` `6dec97c58bc556ed76761e8cd57cbb12085eabe3` `6365cdfc08d1f6550919566b8462966f034b2194`
- `modules/sucafina/Sucafinav1/test/product/wp08/collaboration-journey.test.ts` `68dda95afd92154dc426ef40479648c21576de01` `ca0e83b316f368be5ede080f881db86743bd0435`
- `modules/sucafina/Sucafinav1/test/product/wp08/confirmation-integration.test.ts` `348d6489f4c2ab311b5eb13f9ed2025539294070` `36ddb67ceb7f5fbf5c9698efe553d64693a8f8e5`
- `modules/sucafina/Sucafinav1/test/product/wp08/confirmation-observations.test.ts` `7eb9cbf57f9e8f22f77b0fd4cf62f0a3c025e492` `a45c06afd6910286616ff3127e88063b60b4f88a`
- `modules/sucafina/Sucafinav1/test/product/wp08/confirmation-real-dependencies.test.ts` `3686fbefed59fe6956c7dca338c68d338fc1c426` `853ade04c3cc0f08fc10501310f91da981ab5a83`
- `modules/sucafina/Sucafinav1/test/product/wp08/confirmation-source-lifecycle.test.ts` `c0306e091cf0440258d3bf08feabac2ecca6950c` `43a998264e1603a26a947586c6de3b84eb2d50aa`
- `modules/sucafina/Sucafinav1/test/product/wp08/confirmation-work-integration.test.ts` `20ab2e370ae16086932f4f23a53e11f6e44b6881` `2308b7ebbf791e792894c1d2ac777b70e17d83b1`
- `modules/sucafina/Sucafinav1/test/product/wp08/host-answer-reuse.test.ts` `02e6ecaea3a6ce08e4f0831f882b98f190e4d44f` `7652cb023376e2321662acae5e46ac530f491d81`
- `modules/sucafina/Sucafinav1/test/product/wp08/question-consumer.test.ts` `878e27f5abab286fd2c8e0720ba192b1b253af08` `ab57b52bd0901c5e396f070c1ff444f3ba7d7b9f`
- `modules/sucafina/Sucafinav1/test/product/wp08/reissue.test.ts` `9c8c16cef3a53fa4099f4e2b0408f9eaedac8f36` `dc0c7c770701f64914f91651d4971462a7110b01`
- `modules/sucafina/Sucafinav1/test/product/wp08/relations-fixture.ts` `a116f5d39ce2c021dee962595aa4f4cc5a7d8673` `d7983764984d04dba911819b004701866810e179`
- `modules/sucafina/Sucafinav1/test/product/wp08/relations-integrity.test.ts` `88e44b5ddd362d3e8187f80eb4e2f0d5f7108fab` `6a765d0c99b0be31a8d4fe5c75dd8d8a7d474e45`
- `modules/sucafina/Sucafinav1/test/product/wp08/relations-value-time.test.ts` `ad7a86413049ff9bf939007bc61d3c72268ccd87` `93964222c2aef2ae7f712bc9e42c459298c9cb01`
- `modules/sucafina/Sucafinav1/test/product/wp08/thread-actors-fixture.ts` `77f20cb40101809b19c1f7d4d87f76db753a604a` `aae326accb08bc5645a408271688052a725a30a5`
- `modules/sucafina/Sucafinav1/test/product/wp08/thread-history-fixture.ts` `2f55115067511ae38c17b6220592f4e6cdb42090` `7f99dee8c6995dd685272a150b939d74a75fd653`
- `modules/sucafina/Sucafinav1/test/product/wp08/threads-lifecycle.test.ts` `62cb309bd8f192f8cedc6801869df1b0ad4ba458` `11162741f8021b7d79a23c1022c06f636a393f26`
- `modules/sucafina/Sucafinav1/test/product/wp09/confirmation.test.ts` `561ee4a6cb01b21c40fbf4bcd5503faef7d2935f` `4cce1922b5e61ca5c7bf564f1063ecaead51d06c`
- `modules/sucafina/Sucafinav1/test/product/wp09/decision-answer-consumer.test.ts` `712cce53626fca058f0e66dbfafb6fb09cccc9cf` `e0ff844b564285cb6503a7c491a568c8c64e43c1`
- `modules/sucafina/Sucafinav1/test/product/wp09/planner-confirmation-consumer.test.ts` `732d1a6c5ace00391c489cdc3f77f949646269de` `9a0dee5501aa3b5f385e81858a417624ffa6b7bc`
- `modules/sucafina/Sucafinav1/test/product/wp09/result-access.test.ts` `407bf16aae31dcde3e4148088c636a92025b648f` `0d70e60587dff4f3379e9dc0c6a633c1074e5311`
- `modules/sucafina/Sucafinav1/test/product/wp09/review.test.ts` `75bbfe7797204faf84f19ecb42ce1b87549b41eb` `daaf3a6fd0b3b0f5caf1c701431bf48781397fe0`
- `modules/sucafina/Sucafinav1/test/product/wp09/schedule-boundaries.test.ts` `c54a9c651f79c22ed747bee780d0a9177998f854` `2e4b277dc0e2b15bbc7ff83fc3d6fae0d0d2f400`
- `modules/sucafina/Sucafinav1/test/product/wp09/schedule-native.test.ts` `2b821527073805733056765847155dd7dcba8c45` `d50cefb50aa0b92637a7fd45e04fc5281beabf0d`
- `modules/sucafina/Sucafinav1/test/product/wp10/analysis-composition/alternative-selection.test.ts` `641d9ba4998b64db456502a7caf01a2e8909ca9c` `339a7ba1b57f31ca985b6b1015e0242ac60e2eb3`
- `modules/sucafina/Sucafinav1/test/product/wp10/analysis-composition/analysis-variants.test.ts` `e4da29605080af7f148f9db54ade40de17747931` `871f557e1c8b4509c7bc2c997add40a4c22070b7`
- `modules/sucafina/Sucafinav1/test/product/wp10/analysis-composition/decision-controls.test.ts` `ed90df4710a52574c31488a7a80883360899c425` `8de25849acd13dd8f58b5225e1cc16a84f5e33ab`
- `modules/sucafina/Sucafinav1/test/product/wp10/analysis-composition/historical-memory.test.ts` `022c5166fb5343f50cae86e9deccc5e8dfb85959` `ee5c725ae78e0eba5c12600da80eb51b7173c2ed`
- `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/atlas-recovery.test.ts` `a7395e072db32bec6aa72d1e2dba9a9400c9c6c9` `b4af8ec1ca2b944f89bdfea23fd339c510154182`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/alternative-call-scope.test.ts` `f8d6d9cf328c7c0e7aa958190d74620eb261fa16` `00a8eef27c49ae1530e8601de387ccce032771c8`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/analysis-lifecycle-admission.test.ts` `d4f8162b24dd9c4e97aff176e2dc4410b079271a` `d5ff9678845709429a80f04d98f552ef1b45c1fe`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/analysis-run-context.test.ts` `8bccf7136a0a2a9f4faf116ae912000756ad32f4` `bcfd19a5b52f195d3dcf064e5df9131ef9990d6e`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/analysis-stale-calculation.test.ts` `727997f3fb0554c44056a7e2930888a28e6184ca` `e8b12ab55f3b4101f7e8585d070bcb770ac2e537`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/bi-access-browser-fixture.ts` `cc9ab830592c5f27a84c73a4fdda2dfde3216b86` `cdb880dfd2030ac510a5e343b0fd11aca14392cc`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/bi-advantage-selection.test.ts` `f391b6d8012cf39f0928f01d3d5ae9e6626549dd` `61c1040725c55d07ded391b993f96ab11f062b5c`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/bi-call-scope.test.ts` `9c844f4e1e506eb0984bf3f59edf4e00de8de9dd` `097848feb1d2f2ef8e3e2040814e693cd41b062e`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/bi-case-access.test.ts` `be3b015a4a2de0c9b48d65fa7947b1a73f45d7d5` `95ab95bbcf4eac9004791f6501131cd97a8d3bd5`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/bi-lifecycle.test.ts` `a6e4dbe4bddc18866a8fe8082fa889540ac75972` `80994cb20463fbb4faa56d9d4ef6e1bb58600661`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/calculation-ancestry-composition.test.ts` `0cd792293ecffe8fad0e1eff838de9ab332fdcfe` `0d9094ae67866a919573c9c172176ca2bc88d4dc`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/calculation-case-scope.test.ts` `1597762d1d983d32fb710d49c497b70278d1a53b` `bd6fe733ecc35b7e82161c0d3456880c552c4e56`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/dashboard-after-apply.test.ts` `54f7ba8bf3038c7ace5ba68dc52fd8f85ca7d719` `e4dbc0913068f3e35ed4023eaf3cd64d9a6a2bcd`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/dossier-consumers.test.ts` `2d050ce3967e6f68e8ddcb918ab497bb8514a6bb` `37eb1c18612a426a8597021710dd7f08cee7a8eb`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/extended-ui-regressions.test.ts` `8d343223af8fe376f5fbf06fd3388a70bfa006f8` `637aaa353295c8f94ff1b689bb76b1e216fcb252`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/forecast-submit.test.ts` `d98a12371c698a2299c4838f423e635d64942c79` `b312f2dda7029b79c7420af91d52ca6fec1b098d`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/memory-fixture.ts` `50c7c59d4f945554b74701210365feec6d28963f` `a041a506b45bebc137fb30ed071ce753e1e88d62`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/memory-services.test.ts` `5b8025565264a65d08dbbb93a0a2db211ff5a8b4` `079583d0a4148e93ff723127e724b4600dffc7c9`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/personal-view-persistence.test.ts` `592c754d77d0d74ad8dffc1125dd036d2a53f59b` `8126ca893ba78a2f166688864819fe6283c6127a`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/planner-calculation.test.ts` `5f510ae6ba293257b2ffb74bc0adf1739a43dda8` `72742aebc51eb8436fd5a424ff3935f8f3a42f46`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/planner-evidence.test.ts` `9285f9c2fa6a417a6d9a57a35392ff3a281c6f46` `4092804b5ba52baea87bf58b1c252c6ce5917f30`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/planner-recorded-history.test.ts` `432ca1f9c72fbbb3d278a8cb687b9c65ddaadb0a` `f65b117800e417fdcc302f362294a1af534b5af1`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/portfolio-exact-threshold.test.ts` `e526fffa28318367b9180b419509949c93abb273` `fa4bdf61e69af2498b5668a5dfceb9286613d0bd`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/portfolio-promotion.test.ts` `7075e3a3864b3d48b06d59331d7649701b1a6c29` `b9e8d3ff849327f31a6f6ccae78962376302deb5`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/procurement-record-read-scope.test.ts` `77a0d6f197c215bb4e59794f65bf1e5673a4ee9f` `b1137e58b9800eb94587848d3e3882a87c1a11a4`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/product-authority.test.ts` `7937bd30026928e390f3b9d5c823e43b1e9a4025` `a059b3e711f2b627ead1bd7aa16738ff2d7ef97c`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/review-access-browser-fixture.ts` `34805fe3b91e8f21e3ba3db0b92b03d8decf73c0` `2e2dd8398758cc91d9d42b7f3e0633172a8305f0`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/review-portfolio-http.test.ts` `671bb2b556f7713c80a54da742a3664025fd5ff9` `493dd867e954addce6d3ebc70553333567235770`
- `modules/sucafina/Sucafinav1/test/product/wp10/integration/scenario-operation-access.test.ts` `f0adea5368fb0e027d2e920bdf2c2038b37b3d84` `2b198e3a3f51c6c4e1abbc3a9a8cf77a18a2183d`
- `modules/sucafina/Sucafinav1/test/product/wp10/memory-integrity/fixture.ts` `352efd3fa2aefefa7fbdf88e6ef2d0886a669737` `f9c99a8a886211d1aba60371a2d3b0aa287293b5`
- `modules/sucafina/Sucafinav1/test/product/wp10/native-host/native-host-disposal.test.ts` `c976d8231bba0956af21d3b7148d34e1fb77e177` `cf90ba55860b36ce085fa500c0c51f987ad06743`
- `modules/sucafina/Sucafinav1/test/product/wp10/resident-runtime/private-mcp.test.ts` `886c56cf2638502d789e93e234b5282894ef4c27` `5dc267e9ff70762bcd315352b81f6ce20fb7a494`
- `modules/sucafina/Sucafinav1/test/product/wp11/analysis-promotion.test.ts` `1e7d6545ee6f040ad566500e273cabb5316d8e14` `b6006c50664364aab74152286fa58d943b9f3a97`
- `modules/sucafina/Sucafinav1/test/product/wp11/application-indeterminate.test.ts` `d13ec6d28ff5eb89bb00e8db39ef9065aab394a2` `5e1b9f2b9a9368e25e8ff97d647288742f3cf7eb`
- `modules/sucafina/Sucafinav1/test/product/wp11/calculation-history.test.ts` `7cda99c2d2a0ae9f0400d95f6b4ffae9f1935842` `f003e08be6231bac4656554ef916d5970a60f454`
- `modules/sucafina/Sucafinav1/test/product/wp11/calculation-persistence.test.ts` `04185fa8e4e3c9c2c25d7bf4e898831f4f891ea7` `f0d1d60a0426cd10a5f559b4bcf0fc2858bae60c`
- `modules/sucafina/Sucafinav1/test/product/wp11/case-operation-access.test.ts` `481c41b0c6422839967fd62f01db02ec87fb5b73` `3db0c244e28a64ebbab28dc93f56c5f42ab2edfe`
- `modules/sucafina/Sucafinav1/test/product/wp11/case-port.test.ts` `ed68e903fdaaa313ea14b18f194ee319b6dbdf09` `15bbdbc610f4982a7be48e0757b143049550cb8a`
- `modules/sucafina/Sucafinav1/test/product/wp11/choice-prepared-execution.test.ts` `326a262f17914de6675657dd1e6f82baec31e5c3` `d530558df74f6a0a0c7458a1a308ffdc0114b66b`
- `modules/sucafina/Sucafinav1/test/product/wp11/composite-coverage.test.ts` `b4da64e28c6a207311859595b0a36e07e0c5151b` `27e0580d6c9ba7b4c549bc33e5d252a7ce74ae66`
- `modules/sucafina/Sucafinav1/test/product/wp11/coverage-access.test.ts` `3077eff1666c152db2b483c5393ccb4b1daacf74` `762d27dd6c1f90d95b3c6e9b156e587ba368176a`
- `modules/sucafina/Sucafinav1/test/product/wp11/criterion-rules.test.ts` `ea9146c2bf47822f4a7fb47f540b0f66afa35615` `403bccda901a88d713b4b6a5cdbd9f0c17a31144`
- `modules/sucafina/Sucafinav1/test/product/wp11/cross-domain-execution.test.ts` `3cf9948e4fefbeceb4c2e99b04dc47b4e29ad816` `2be9d8b282315bf6c030eea4b92e1fd39ed20d55`
- `modules/sucafina/Sucafinav1/test/product/wp11/current-choice-lifecycle.test.ts` `45d2821fbd01c13183d450f1347e9017adba9fe2` `b2f96bec220a6ec2f674057546541d5a700e969e`
- `modules/sucafina/Sucafinav1/test/product/wp11/current-choice-read-fence.test.ts` `46b004a1b374229ad46077930134ba0469213087` `e3b25caeece77ca1d755bc64e8253ca003179793`
- `modules/sucafina/Sucafinav1/test/product/wp11/execution-reconciliation.test.ts` `62365bd79c1f90b6ee90e64746678bfe779011cf` `b6499c30a3a2482cd96c72e3b4b6bf9b2a04c72e`
- `modules/sucafina/Sucafinav1/test/product/wp11/hot-topic-draft-domain.test.ts` `d75d700de4a9a607550691382dc0e14237c289a0` `9810a5665701722cfef59aa8028796764051f604`
- `modules/sucafina/Sucafinav1/test/product/wp11/hot-topic-snapshot.test.ts` `f3f66378b7e310565e46eef1767f8110675d38de` `447ae83e4a49175f6751138d44d3221f364b0731`
- `modules/sucafina/Sucafinav1/test/product/wp11/planner-apply.test.ts` `9d6ec819d26902055e793d0e4db12d823aa16022` `160df21d7dd44109c392cf213680629b6c26d450`
- `modules/sucafina/Sucafinav1/test/product/wp11/prepared-apply.test.ts` `06b23fde1210112b54c8075c88dd60ca54382db9` `3d1380e7aaacd894d082fdeb06cfaaa51bf92dbb`
- `modules/sucafina/Sucafinav1/test/product/wp11/proposal-coverage.test.ts` `be3f5a5116a09dea9c3549cc709bc6f99b23196f` `fa55d820dec5c6dce1d449d469cb6f1d2c350b8a`
- `modules/sucafina/Sucafinav1/test/product/wp11/renewal-choice-fixture.ts` `2da82bf379910826f4558b5b330c97cdaf6806df` `0dc89d86866620a8109051c68bc2d2b4d92c508f`
- `modules/sucafina/Sucafinav1/test/product/wp11/renewal-choice-history.test.ts` `a9bd9674d033d5a990dda651e01371cc024d4a52` `cbce0fa5bc9cff4131ce540e98e05db70574015b`
- `modules/sucafina/Sucafinav1/test/product/wp11/renewal-coverage-fixture.ts` `dd85ea61929f7a7180ed81b60ab4f866b6423f0c` `d1b8c7b91c071ee970ff217c3a2745d84b99486b`
- `modules/sucafina/Sucafinav1/test/product/wp11/renewal-human-choice-fixture.ts` `3bbcabb4272ba2d083aa39b03142498178e95193` `582c69e353bdfd96663c479713ffb9ff6d7585a5`
- `modules/sucafina/Sucafinav1/test/product/wp11/renewal-operation-verifier.ts` `2338917427497733e4bd88aec852985206cce066` `df3c335c95bf9d8d06d00474ff0bc391dd852b4e`
- `modules/sucafina/Sucafinav1/test/product/wp11/result-store.test.ts` `d68a6d2ff044fe44590299e21c4b193910630f78` `7a1a95e476a183b0ce1eaf1abe6f693b21f3707b`
- `modules/sucafina/Sucafinav1/test/product/wp12/analysis.test.ts` `26a68897d99f4de620a7e54992d94a9a48820f3b` `ab321fb2d1562255cf987571477233767c5240e3`
- `modules/sucafina/Sucafinav1/test/product/wp12/author-reader.test.ts` `c732e2b5e43bab39df06bea2a4b26acbd2c69951` `bc76ac585880bb3d160aa5156878b62234cd4c3b`
- `modules/sucafina/Sucafinav1/test/product/wp12/continuation.test.ts` `4a4191b7b7b556d5e3c0fd6b66f96bb042f375df` `14c0349d5d425533c6132e7eec802bae35425644`
- `modules/sucafina/Sucafinav1/test/product/wp12/contribution-builder.test.ts` `9d8272cfc49899193d396f143235cb48709f0f43` `fa507f9830c73fb789c5bca2bd06895d95772472`
- `modules/sucafina/Sucafinav1/test/product/wp12/contribution-reader.test.ts` `5ec69851b6f94dd20804ba1e69ea4178edf97204` `f8305eeb2dae22565dbb27e21137cbd1237afae3`
- `modules/sucafina/Sucafinav1/test/product/wp12/historical-reader.test.ts` `445e8f6add5c500a1aa8d8711e4ae7d3c4986c29` `6806a786ac9e41a6b87c539ab7e2eccc38871cb4`
- `modules/sucafina/Sucafinav1/test/product/wp12/native-execution-scenarios-review.test.ts` `80da902f35f80d9b61175fd90d5c10fa7b3f00aa` `cef673fe075775a8e4000734b4f028e941fa875f`
- `modules/sucafina/Sucafinav1/test/product/wp12/native-mission-harness.ts` `49300a78a44ac0739791d10a11c386b317f4b51a` `ebd55c6798bd81f37b29a62f8364dfff28edaee7`
- `modules/sucafina/Sucafinav1/test/product/wp12/native-scenario-preparation.ts` `3f02a1ad9ee2985b4094690bd32c16e22a0dda75` `5d483cad26e595b7744794098a9ffe15605e3b8f`
- `modules/sucafina/Sucafinav1/test/product/wp12/publication-lifecycle.test.ts` `e3e3dacbb3af4c62cc5c3f57582dfaac5581ae3c` `6bf1130c94bca4b3cd1377875492b8f910b4259a`
- `modules/sucafina/Sucafinav1/test/product/wp12/resident-authority.test.ts` `a2da68aa5f5bf2122616b82b74a06aa4f54a3988` `c49afce4a463d07d6a0f5f853ac30a5bdd3316a1`
- `modules/sucafina/Sucafinav1/test/product/wp12/resident-native.test.ts` `1edebb418e33025cf4d33c853807ed9bb040d931` `b95e8b8b5c281872b07164f7faa47f21f64de684`
- `modules/sucafina/Sucafinav1/test/product/wp12/resident.test.ts` `a5151b55edd232a5bb3426ff705f759e02e1326e` `6b83c09abb8a65ca109f31d953de30e8f9f955d3`
- `modules/sucafina/Sucafinav1/test/product/wp12/run-store.test.ts` `5620d5aac6bd469f726dfba18dabcbd889c36b35` `d12d8702f5914c94475b3ad1205718ecf1899fe9`
- `modules/sucafina/Sucafinav1/test/product/wp13/analysis-recovery.test.ts` `e5018d275bfe420e9cc066c6d58587bb3b584442` `d85a362360301686d2c5ca72f3938551c119b38a`
- `modules/sucafina/Sucafinav1/test/product/wp13/campaign.test.ts` `1f66588a3db522f40fb8ed98bcecfc09c7e74098` `3002c859033795cac7db65261a1ff44c44a61d43`
- `modules/sucafina/Sucafinav1/test/product/wp13/coverage-preview-fixture.ts` `dfa8caeb55841ecac74eee2f94319b68ebdac77b` `6e56a64ee1b76422706d685e2f646a156a8ade39`
- `modules/sucafina/Sucafinav1/test/product/wp13/coverage-preview.test.ts` `ea5f94f0c3f036625688c7e60ce9ee9c4ad328d2` `3d7a0cc397b6afd0877779fdac642bc50e5c40a6`
- `modules/sucafina/Sucafinav1/test/product/wp13/coverage-sensitivity-integration.test.ts` `1a0dc5a9bc71923aafd3ec5eaf476f7a3f780bdc` `7025de0601768ccc0bec76d8e0675882dee7cda9`
- `modules/sucafina/Sucafinav1/test/product/wp13/coverage.test.ts` `b6ff1dd3b2f2cad15556521a9406ba6985dcb753` `775a63f5cd25a68542508f6f8fa154fe7324a2bc`
- `modules/sucafina/Sucafinav1/test/product/wp13/handoff-c08-integration.test.ts` `0980fe4e1230cf5856871ce925304b558d9ebdec` `d5327a70410a6c52c64b534056939cbfc9eb9483`
- `modules/sucafina/Sucafinav1/test/product/wp13/handoff-domain-integration.test.ts` `56befede439f9d08233a75fc7b9c25c013e73b4c` `de2315abe69288edc26d66424f676ce5dbe625ea`
- `modules/sucafina/Sucafinav1/test/product/wp13/handoff-integration.test.ts` `6eec9c363eaa957aec1776cec3284c67424abcb2` `9fefc7bc347bfa123fc718fa9b0000d82dfc8a80`
- `modules/sucafina/Sucafinav1/test/product/wp13/handoff-persistence.test.ts` `ebf3ea6a5e62d653ce063dfc6a48ef56cfc94948` `c844715b58fc3f911d032c96aa94b1d5aaed94a9`
- `modules/sucafina/Sucafinav1/test/product/wp13/handoff.test.ts` `f3895ac74c4245c3551bc696ff41ed0d2065bec9` `dc7e73e53c3fc7c67e4340597dab6afa726b52cc`
- `modules/sucafina/Sucafinav1/test/product/wp13/history-provenance.test.ts` `af081946dfffcb885059bff9e56c691460ff1a56` `09b5c3fe64493d15cbd42596ce73d7c7f0a52188`
- `modules/sucafina/Sucafinav1/test/product/wp13/persistence-recovery.test.ts` `4efa414f8ecadde5799e7246337863b145373210` `63f262129fb37adf74013f58ea5fc56bb4ecd79e`
- `modules/sucafina/Sucafinav1/test/product/wp13/planner-sensitivity-boundary.test.ts` `33193aabe586aee6bdedb8a8a06238783ece25a2` `e20e97e54d60c156952fbc43fab356cf479221de`
- `modules/sucafina/Sucafinav1/test/product/wp13/portfolio.test.ts` `fdfff64a4067a4d9a36398af42f4044b266f749e` `01584c151cde11035a0f5154ed1ecb77b8c0b7d8`
- `modules/sucafina/Sucafinav1/test/product/wp13/reconciliation.test.ts` `6b2a318f73aa8adb67840958add758f151f0bade` `599464bcbcfd1c885fd76098e3bbc061ce80d107`
- `modules/sucafina/Sucafinav1/test/product/wp13/renewal-sensitivity.test.ts` `f68bcdf3c5a7ffeeb10cd9ed11a577e63c40062e` `fbd176312c247e445054aa86a5bf3d153eb9b56c`
- `modules/sucafina/Sucafinav1/test/product/wp13/semantic-union-source-scenario.test.ts` `6effa6053a00758e987e52f0c6fcf9baf9a7906a` `47b5358c8dda3179045499388ce98871576a2aa9`
- `modules/sucafina/Sucafinav1/test/product/wp13/sensitivity-fixture.ts` `ab00e903d0d263fddaf7aa481c201627b9835b1d` `5b868fdcb3cc9371a6592b000f33ba0b357329c5`
- `modules/sucafina/Sucafinav1/test/product/wp13/sensitivity-read-scope.test.ts` `a25539d00f8a43f2e7e3be02a16c29ba1c0272f2` `56d4f7342696245fae89fd00d15a037dd9cb33a4`
- `modules/sucafina/Sucafinav1/test/product/wp13/sensitivity-units-boundary.test.ts` `2aa8d065edd25c94a90b84a64839c0fc72dce5c2` `dbbe5f7dc64d3accee536b38ae4196034562cf8f`
- `modules/sucafina/Sucafinav1/test/product/wp13/sensitivity-v6.test.ts` `7d9d1454aa0f7dbe780989d129a3e35f1d05a0b7` `a22b4625c8375d7c88037e1c66c1a0fee17e5c83`
- `modules/sucafina/Sucafinav1/test/product/wp13/sensitivity.test.ts` `41be1c7840056f40b6693feec56431e95bc438d6` `0444570a0a961c979f75388fb0708812f98497e5`
- `modules/sucafina/Sucafinav1/test/product/wp13/source-scenario-fixture.ts` `b5c433ff0bc233856093962d1a540c453c1c5535` `39a6164af40df18c4634196e31e84a8180c822a5`
- `modules/sucafina/Sucafinav1/test/product/wp13/source-scenario.test.ts` `a2cf45f6c343c384c37a36e0c36437e379178b43` `d5ad83048d49c79d7f83bd13b4f6c81e3d4ca31c`
- `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` `30ebaf3aac1940c2760b21761dcd72be52d050d9` `c2efe0e5054b4a33a35daae1d5353ff730434577`
- `modules/sucafina/Sucafinav1/test/product/wp14/atlas-restart-reader.ts` `60f768da8420782418b516b2f7e839845a101197` `65c5fd04f6af34a241e6cc0bd40cd968cdc6e353`
- `modules/sucafina/Sucafinav1/test/product/wp14/domain-outcome.test.ts` `3904520e863976a432c98b98de942c42ebf32e08` `04c4f57bef8b66ec2c055ac825bf04319580265a`
- `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` `54438ff168810a69af2ef71ce2df149805ee78a8` `90e6dd5f1b87b03f6fe2440703443b64507ed375`
- `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` `aee559a4815e95c5a40ee2a0c867389630bba944` `832dec005b43eca42d6b4bde027aee77c5857d00`
- `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` `533103800b6e5037644be6f12ee3a80357235e34` `1c33f4da2a87b25ae8b22cf181c755ee6fa60bc7`
- `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` `42e2a8df724b4771b48f8ebc4509c678a1ce5e2a` `694bf7f659b5b26eb8a1441db38699223af00e3d`
- `modules/sucafina/Sucafinav1/test/product/wp14/signal-registry.test.ts` `3e8d2e790d9b1224723b685f8962ceda534605b6` `8aa8e69757b14fb1ef7b4173b974c9a9204917c2`
- `modules/sucafina/Sucafinav1/test/product/wp14/source-access-atlas.test.ts` `fbe627ffde443ff7e2d3b1204bbcf67523404f41` `75f8fe05373865d0497184a9c710a382ff06a737`
- `modules/sucafina/Sucafinav1/test/product/wp14/source-access-procurement.test.ts` `cc33cb115e31b5f07c0bd338e1372fdff8383dd0` `7c34d4f11d490e0697fb4d45d40dbc3b5e1c618a`
- `modules/sucafina/Sucafinav1/test/regression-calendar-local.test.ts` `759c053a2b8953ad3fad4ff0fd893b5d75be1c42` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-dashboard-access.test.ts` `a0f87f7853297fe4bb1680147ede62cce0f8f77c` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-dashboard-cell-clear.test.ts` `ae41f76c6f9547dc94e6e99059ca2bcdc3d772ca` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-dashboard-numbers.test.ts` `0dcd0e1bdd0c895f0ca2806859d752e1b3d48ce6` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-headcount-active.test.ts` `b6d080e508eced04f397f297ad7b56e3ab204c94` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-headcount-date-boundaries.test.ts` `82a1480b34816ee3434638b87c63871ddb15f74a` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-headcount-date-parity.test.ts` `27849d0f6d6e3fed9b8bf67c5f0af2e219aa5b1a` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-headcount-display-scope.test.ts` `059ebfa1669041a48180391c1a4b200bd185982f` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-native-admission.test.ts` `81e29b940f452ad8b1604ca8f1f01f85cdfe4745` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-native-budget-summary.test.ts` `65a6d83c3d9f29ab03ead6ca7c8f5f88ed81c62b` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-native-origin.test.ts` `8df9d8e1e472dae6d4f4da558d2c3ae3247aff92` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-native-people-summary.test.ts` `11956ba9811eaf1001b03a24e0c15a401674f82b` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-native-portfolio-conflict.test.ts` `a2bb0c60e040defb209abb518674dd6d43290446` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-native-security-summary.test.ts` `590dc936c392e72b6661c3aaccb903ef3de608c6` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-planner-authority.test.ts` `17f3f57cd8730e11c8815e40d2416ca7256b1852` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-planner-control.test.ts` `03800b74d219d5e280cd250b9176fa297646bc43` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-planner-excel.test.ts` `c2af36eb3611e41952d8fa34b5ec46332362cbab` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-planner-import-scope.test.ts` `775b67af93b51a576f87f2928350ce7b26f96c10` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-planner-integrity.test.ts` `85a1463c2cd1b5fac091fc26707bb4ab8ff45400` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-planner-newline-scope.test.ts` `3eb66362174188f920c16325fdf5361d8d6e2b8f` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-planner-number-parity.test.ts` `55d298960fe3950cad652e9b8b76f6a81efd727f` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-procurement-value-fallback.test.ts` `1b031a4bde0e0d192e6037bf0f2631fcdf57c7bd` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-procurement-values.test.ts` `f8b173735b394c61e060d50fcfa2421247f83ac7` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-procurement-visibility.test.ts` `d43d540e5e77442957feb492ba4ae228b713a763` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-project-blank-leader.test.ts` `023a733855510ed88869be36329a159904191987` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-project-import.test.ts` `63d2d5748405a27cf13b2901b0abc23446864c76` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-security-asof.test.ts` `88109d472d2f9dc2ad43d22b065116ac62ca7178` `MISSING`
- `modules/sucafina/Sucafinav1/test/regression-supplier-bank-projection.test.ts` `cfa45ebfc6fc50742796b2dee46eed8fcd899182` `MISSING`
- `modules/sucafina/Sucafinav1/test/runtime-http.test.ts` `7163047f109d76079bf87be5e6eaff9e67d0cb4c` `6455ddae758839c617771c85a8344cae24f9cca2`
- `modules/sucafina/Sucafinav1/test/s1.test.ts` `7a90c4662aad5aa25d87f5d9dbd04f791edfcacc` `ac391979eb8d5248532049a5fc15c1dc28448246`
- `modules/sucafina/Sucafinav1/test/visual-layout.test.ts` `8fb32fc4e0ae2d000c830c8af87fba9f5e4eb2df` `d809fa195f3932c90b4ff64df0fab258f49fba5a`
- `modules/sucafina/package.json` `55ccce6d7034cc9b434b031814221d960a44d6f4` `bb491f8fe5f6617d23d8e80b9982d488a238edd2`
- `modules/sucafina/porta/codigo.test.ts` `9b8c6d9c9cce65bc10303654a1b7e0885d31fa5c` `957db86b5262af76cf09f636180919c64cbea5b2`
- `modules/sucafina/porta/linha.test.ts` `908b9e0c3e310fccd5213da0d6b43d9122e56098` `692f4133f3100d18ac78969a1b0b9b80ae083b36`
- `modules/sucafina/src/native-installation.ts` `b1181a158c44ac5968edd73d6ad0b2c367c6c360` `MISSING`
- `modules/sucafina/src/native.ts` `99af16762089e132cbc725efbf264eafae982b23` `MISSING`
- `modules/sucafina/tsconfig.json` `080a6e969d4bb50a177f5ca8c1e3179ed77b46fe` `MISSING`

