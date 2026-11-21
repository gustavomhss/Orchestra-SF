# First wave — three delegated redesigns

The user rejected the original first-wave finish. The same three screens were rebuilt on the dev-descended `sf-design-polish` branch, synchronized with `1fd255026dec8e1db1f4342f7ec206a6812b42ea`. Product: `245e15bf10b5c5287fa9338aa98d0adb28aeda76`. The remaining 67 surfaces stay inventoried and outside this implementation.

## Second composition — three actual workers

| Screen | Agent and branch | Initial composition | Visual correction |
| --- | --- | --- | --- |
| UI29 | `redesign_today` · [sf-redesign-today](https://github.com/gustavomhss/Orchestra-SF/tree/sf-redesign-today) | [fcfad9f](https://github.com/gustavomhss/Orchestra-SF/commit/fcfad9f0debed19e1b422adc376557fffb667067) | [a1041bc](https://github.com/gustavomhss/Orchestra-SF/commit/a1041bc58f499de4292732fe0f12a2a93898abd3) |
| UI33 | `redesign_cases` · [sf-redesign-cases](https://github.com/gustavomhss/Orchestra-SF/tree/sf-redesign-cases) | [f78645e](https://github.com/gustavomhss/Orchestra-SF/commit/f78645e94f432323f14005a0c1259ff96e66c646) | [7d86706](https://github.com/gustavomhss/Orchestra-SF/commit/7d86706bdf0185a8e9b48fb3d9b1c16fa0969655) |
| CAP01 | `redesign_executive` · [sf-redesign-exec](https://github.com/gustavomhss/Orchestra-SF/tree/sf-redesign-exec) | [b6b3294](https://github.com/gustavomhss/Orchestra-SF/commit/b6b32946e0e25c7e338c987f79ae5ca95f370f1c) | [8b5f551](https://github.com/gustavomhss/Orchestra-SF/commit/8b5f5516a34dac29c36b3343282b82733882c43d) |

Root integrated native frame/access-menu work in `0b7ecb86c04d1c948ab2d1e4b056ec6199db3ded`, the three compositions in `7af5b436ee3d2e1fca3b1ffc2b4b1faae535565c`, and the reviewed corrections in `245e15bf10b5c5287fa9338aa98d0adb28aeda76`. Worker commits are merge parents, not unauditable pasted claims.

## Review that changed the implementation

| Screen | Actual rendered problem | Correction |
| --- | --- | --- |
| Today | Attention remained approximately 310px tall for one record; the resume action was low in the first large viewport | 20px panel padding, 10px header gap, inline wrapping metadata and reduced spacing; native fills and 44px targets retained |
| Cases | A second empty list below editing/review competed for attention; narrow review touched the rounded viewport edge | Hide the mounted list during editing; draft-preserving Back/Resume; actual centered scrolling with 24px margin and unchanged full-visibility assertions |
| Executive | Global shared CSS squeezed People into four narrow columns, made long words vertical and wrapped navigation into a tall mobile block | CAP01-specific label/value grid resets, natural word wrapping, aligned signal cells, nowrap navigation and two-column narrow actions |

Cases' six untranslated Portuguese form values were completed without altering English. The terminology check used the existing chapter catalog plus Thunderbird calendar and VS Code Portuguese corpora. Root added explicit localized editor/review captures, native access-menu keyboard checks, draft round-trips and 1440×800 captures.

The first new browser run [44910888762](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44910888762) stopped on an approximately 0.172px narrow-footer clipping assertion; it was not accepted as a pass. Its images exposed the remaining visual defects above. The first gate run [44910893748](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44910893748) exposed inherited dev type errors; [INTEGRATION.md](INTEGRATION.md) documents their type-only repairs.

Final evidence and its limits are in [VALIDATION.md](VALIDATION.md). The finished screenshots are reviewed as images; automated checks are not design acceptance.

## Historical first delivery — rejected

Each worker branch starts directly at planning commit `20bd10681b83c51d1f5d369b7a438b58d57c9f18`, whose single parent is the selected dev base. The inventory was committed before delegation.

| Order | Screen | Worker branch and commit | Concrete candidate |
| --- | --- | --- | --- |
| 1 | UI29 · Today | [`sf-polish-today`](https://github.com/gustavomhss/Orchestra-SF/tree/sf-polish-today) · [`1a31738`](https://github.com/gustavomhss/Orchestra-SF/commit/1a317384bd0dcef67c924e5056dc059edfcf547b) | [Patch](wave-one/01-today/candidate.patch) · [Review](wave-one/01-today/REVIEW.md) |
| 2 | UI33 · Cases / Decisions | [`sf-polish-cases`](https://github.com/gustavomhss/Orchestra-SF/tree/sf-polish-cases) · [`2f87d46`](https://github.com/gustavomhss/Orchestra-SF/commit/2f87d4637b127056495a5ab46cca864f64d0b10c) | [Patch](wave-one/02-cases/candidate.patch) · [Review](wave-one/02-cases/REVIEW.md) |
| 3 | CAP01 · Executive | [`sf-polish-executive`](https://github.com/gustavomhss/Orchestra-SF/tree/sf-polish-executive) · [`73b7e5b`](https://github.com/gustavomhss/Orchestra-SF/commit/73b7e5bbd7b378fdfdd3a64d79442a2447ee0a60) | [Patch](wave-one/03-executive/candidate.patch) · [Review](wave-one/03-executive/REVIEW.md) |

The first three follow the native navigation: `/orchestra/sf-home`, `/orchestra/sf-decisions`, and `/orchestra/sf-dashboard/executive`. The remaining 67 surfaces are inventoried and unassigned. [README.md](README.md) lists all 70 surfaces; [inventory.json](inventory.json) preserves all 165 recognized routes and source blobs.



The original patches and source-only review files remain historical records. They do not describe the current visual state; the first delivery was rejected.

## Final short-window and accessibility refinement

Capture2 [44912079289](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44912079289) reached 22 images, including the corrected UI33 narrow footer and CAP01 records. It failed because the test asked for an accessible name on a native definition element. Playwright 1.59.1 prohibits author naming for that role. The final test requires the exact accessible child text instead, with equal children; the product removes redundant aria-labels and retains its real absence text and machine state.

Today then moved source disclosure onto the forecast heading to recover vertical space at 1440×800 (worker 27746db). Executive added a narrow navigation fade and corrected definition semantics (worker 615b97f). Root replaced the ambiguous reset glyph with the existing visible refresh label, with a full-width search row at narrow sizes. All final source changes are in product `245e15bf10b5c5287fa9338aa98d0adb28aeda76`.

The final capture-only commit `245e15bf10b5c5287fa9338aa98d0adb28aeda76` corrects mounted-cookie selection for the fresh Portuguese context. [Capture 44913429642](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44913429642) passed with 28 real images; [gates 44913434039](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44913434039) passed all four checks. Each worker inspected the final Portuguese view(s) with no blocking geometry observed. The user explicitly approved this second composition on 2026-11-21 with “aprovado”, after seeing evidence commit `032eb5b8b93c3e75dbad3ebf19cd64f8a40f73a6`. Approval covers UI29, UI33 and CAP01; the next 67 surfaces remain inventoried.
