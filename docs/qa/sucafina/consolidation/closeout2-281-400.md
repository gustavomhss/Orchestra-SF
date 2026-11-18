# Closeout 281–400 (blob)

Checked 2026-11-18 against `origin/close-final-candidate` at `a63c4c733523294450f605e73de3306edff81e58`.

Range is PR numbers 281 through 400. `#237` is outside this range, stayed open, and was not closed, commented, or fetched. Nothing was merged. `close-final-candidate` was not pushed.

Close rule used, and no other:

- `git merge-base origin/close-final-candidate FETCH_HEAD`. No merge-base leaves the PR open as `NO_MERGE_BASE`.
- Files are `git diff --name-only $mb FETCH_HEAD`. An empty list closes.
- For every file, `git rev-parse FETCH_HEAD:path` must equal `git rev-parse origin/close-final-candidate:path`. A missing path is the token `MISSING`. Close only when every file has the same token on both sides.
- The first differing path leaves the PR open.

Ancestry and a non-empty three-dot diff were not the close test.

Open at the start of this pass: 289, 290, 293, 297, 307, 327, 341, 345. Heads were re-fetched and matched `gh pr view`. Each had a merge-base. Each had a differing path, so none were closed. A concurrent close comment ("Superseded by the bundle merge on close-final-candidate a63c4c7335") landed during the check; those eight were reopened because the blob test failed.

| PR | Head | Merge-base | First differing path | PR token | Candidate token | Result |
|---:|---|---|---|---|---|---|
| 289 | `10aac82c4660bfcbc09e14f267700983cea7368b` | `3b3e86b2a8181dadecbfe94e5ad30619bf9ce069` | `.github/workflows/sf-ci.yml` | `a109dbc19b2748a9db8328c45d0601bf8d3daf6f` | `8f05ac6f081d0b6e89de5f2047718dc93d626973` | left open |
| 290 | `7f26c6c56ee1d044fa366b2c68639db5c5bc3d4a` | `a1e774ec9e1fc28c81e0b42a1889c0425060aed9` | `modules/sucafina/Sucafinav1/docs/sf2h/receipts/http-body-limit-fix/composition/microsoft49-installation-reconciliation-01.json` | `dab2c9fa8505fb83cc455b0b7607ddfeeb49bbe3` | `MISSING` | left open |
| 293 | `2d0296989c684997ed15d3a05aa8a09ef445ac9b` | `c4da52424a7e1fdc8be75362bd647778e269577d` | `apps/cli/script/distribution-payload.ts` | `cfc62ae5e3a4e3d6399cef6a8e96b2329a30d602` | `ca9edcafc0e654c57b3cbfca224878c38f0359a2` | left open |
| 297 | `47e32dab6c29fca782905570bd5a0523c483f5f3` | `4a6192ab7a479611b32feafcaf4016451d245b07` | `.github/workflows/sf-ci.yml` | `41bf5a06e72642a5c3c724c5c9a65ded52f1124c` | `8f05ac6f081d0b6e89de5f2047718dc93d626973` | left open |
| 307 | `fd8dd28479b001e6989d142ef38b4fff535f5ec6` | `8e456b229bf58d06bb542f83f9057687855c77d2` | `apps/cli/src/sucafina-product/decision-domain-http.ts` | `659eabe019805849e3a57fe53c10072d3a50d5df` | `5cb8e4e45c1e68af4c59ec096b499ed0907f6c66` | left open |
| 327 | `a823c3cbdf6273fde4b34f37b990ca351d742030` | `5db6c00c186aecc6f752e22757fec1a9911e29e5` | `apps/cli/script/factory-receipt-check.ts` | `efeee62b81454945cd57b6cd76fd144e0dc3605c` | `5de5bb26c7196fb1ed1f4d5ff4d3e030f4e90888` | left open |
| 341 | `cd01c7470285ae0867925d274b55dafc2c53ead3` | `4dd4ba9bfc6449204aedb9ccdf271b890a2dd0ec` | `docs/qa/sucafina/consolidation/conflict-matrix.json` | `03ee6500e37c0d4f2750bb486932d31007edb675` | `c6ffc2f7b02f29d819693b0368900e1308c26a32` | left open |
| 345 | `4adb54ef70e0ef709a8c950ae1cc79db9c80b87e` | `10dc9d536775b6fbb0e39382e98a5ae2285df07d` | `modules/atlas/boundary/package.json` | `a31ffcbfaefb1cf091aa09e1ac81dcf001f28b75` | `6a5e7bddf5b9ea31dd0fb795f38be4fc98a231b7` | left open |

No `NO_MERGE_BASE`. No empty file list. Numbers 346–400 do not exist.

Closed: 0. Left open: 8.
