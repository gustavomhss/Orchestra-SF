# Closeout 281–400

Checked 2026-11-18 against `origin/close-final-candidate` at `a63c4c733523294450f605e73de3306edff81e58`.

Range is open PR numbers 281 through 400 inclusive. `#237` is outside this range and was not touched. No other numbers were closed or commented. Nothing was merged. `close-final-candidate` was not pushed.

Close rule used, and no other:

- head is an ancestor of `origin/close-final-candidate`, or
- `git diff origin/close-final-candidate...<head>` is empty.

A non-empty three-dot diff is unique hunks. Those PRs stay open.

Open PRs in range, heads re-fetched and matched to `gh pr list`:

| PR | Head | Ancestor | Three-dot diff | Result |
|---:|---|---|---|---|
| 289 | `10aac82c4660bfcbc09e14f267700983cea7368b` | no | 14 files, +283/−43 | left open |
| 290 | `7f26c6c56ee1d044fa366b2c68639db5c5bc3d4a` | no | 44 files, +365/−333 | left open |
| 293 | `2d0296989c684997ed15d3a05aa8a09ef445ac9b` | no | 25 files, +1775/−28 | left open |
| 297 | `47e32dab6c29fca782905570bd5a0523c483f5f3` | no | 21 files, +201/−42 | left open |
| 307 | `fd8dd28479b001e6989d142ef38b4fff535f5ec6` | no | 12 files, +241/−44 | left open |
| 327 | `a823c3cbdf6273fde4b34f37b990ca351d742030` | no | 28 files, +123/−428 | left open |
| 341 | `cd01c7470285ae0867925d274b55dafc2c53ead3` | no | 2 files, +80200/−27 | left open |
| 345 | `4adb54ef70e0ef709a8c950ae1cc79db9c80b87e` | no | 606 files, +26694/−23103 | left open |

Known still-open candidates `#297`, `#307`, `#327`, `#341`, and `#345` fail both proofs, so they were not closed.

Closed: 0. Left open: 8.
