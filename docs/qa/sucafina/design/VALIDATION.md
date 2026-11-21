# Second-composition validation and limits

The first delivery was rejected by the user. This report covers the rebuilt native UI29, UI33 and CAP01 only.

Product: `245e15bf10b5c5287fa9338aa98d0adb28aeda76` on `sf-design-polish`, descended from dev `1fd255026dec8e1db1f4342f7ec206a6812b42ea`. Subsequent screenshot/documentation commits do not change the tested application or E2E sources.

## Hosted checks

| Check | Exact hosted evidence | Result |
| --- | --- | --- |
| App-shell typecheck | [run 44913434039](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44913434039), snapshot `39538989aabc7a99a3b1dc5ee2929827d05c125f` | PASS, exit 0 |
| Permanent E2E typecheck | Same run, `bun run typecheck:e2e` | PASS, exit 0 |
| Repository guardrails | Same run, exact dev base `1fd255026dec8e1db1f4342f7ec206a6812b42ea` | 78 rules, 57 candidate/snapshot files; zero errors/approvals, two warnings |
| Palette generation/parity | Same run, original palette writer | PASS, seven generated files byte-identical |

Four checks, 11 assertions and six real Omni spawns completed in 29.73 s. The two existing guard warnings concern the 190 s real-installation fixture deadline and 240 s whole-journey deadline. Neither was increased to fix an interaction. Assertions retain their original deadlines and retries=0. No guard, approval environment, workflow allowlist or compiler option was relaxed.

The verification wrapper exists only in the disposable CI snapshot. Its parent is the exact product commit. It pins dev only in that disposable checkout's remote-tracking ref and never writes the shared remote branch.

## Native browser journey

**PASS** — [run 44913429642](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44913429642), job `136873867100`, snapshot `2d54bb98b4d0df307b7b383be88f0a34e3b58eb2`, parent product `245e15bf10b5c5287fa9338aa98d0adb28aeda76`: one Chromium journey, retries=0, reported **2.5 minutes**. It emitted **28 complete JPEG previews**, totaling **2,525,469 bytes**, with canonical PNGs in artifact `14710568781`.

All three English flows and the Portuguese views completed. The exact annual missing-text accessibility assertion, source editor round-trip and decision draft preservation passed. The final product differs from `3de6133a9753b6c2eecd57b7260e5c9867d23c4f` only in the capture's selection of the genuine operator cookie at its original mounted path.

The capture uses the existing production Playwright configuration, an actual native Web bundle, a real CLI installation and one public origin. Canonical producers seed clearly identified isolated test data. Enrollment is real and single-use. No forged grants, cookies, receipts or response mocks are used.

Coverage:

- UI29 authorized attention/risk values, forecast, case resumption and honest meeting/material-change absence.
- Native Context and access menu: keyboard opening, reachable original actions, Escape and focus return.
- UI33 one actual case creation, explicit review/confirmation, exactly one POST, source-returned href and working filter/keyboard clear.
- UI33 editing → Back → Resume retains draft and focus; review cancellation restores all five fields; confirmed Back unmounts only the completed instance; a new case starts empty.
- UI33 desktop and 320 px review actions remain fully in viewport. The real scroller centers the narrow footer with breathing room; `ratio:1` was not lowered.
- CAP01 source budget/forecast, real year/month selection, honest missing annual risks and exact accessible absence content. Definition children must equal the message; no extra numeric child is accepted.
- CAP01 users 128 → draft 129 → review → cancel → discard 128, without saving.
- Portuguese native routes and source readiness; Portuguese decision editing/review and return to list, without a second creation.
- Native owner/frame readiness, same-origin source requests, no document/page horizontal overflow and no unhandled page errors. Named local table scrollers may scroll horizontally.

## Visual review

Root inspected the actual final Portuguese images for all three destinations, the Portuguese editor/review, final English light images and the corresponding desktop/narrow/review states. The respective workers independently inspected their final Portuguese captures.

- Today: forecast and source disclosure share a header; attention and resumption form a clear main column. In the actual 1440×800 image, the resume action is entirely visible at approximately y724–768. Closed disclosure and narrow text wrap without overlap.
- Cases: search, labeled refresh and list identity align. The 760px editor and separate review contain no competing list. Portuguese labels and actions fit; Cancel and Confirm remain whole at 320 px. Native date controls display the browser's format, and review retains ISO; regional Brazilian date formatting is not claimed.
- Executive: People labels stay intact in label/value rows, financial totals align in both themes and missing values retain explicit absence. Original 128 / Current 128 / Proposed 129 remain legible in review with complete actions. Portuguese financial numbers use 420.000 / 28.800 / 33.300 without inventing currency.

This is a bounded technical review of captured states, not user approval or exhaustive accessibility certification.

The rejected first delivery's source-only peer notes and successful historical CI do not establish acceptance for this version. Three workers inspected their actual rendered screens during this round; root reviewed the integrated screenshots.

## Evidence boundaries

These are actual Chromium screenshots of isolated **test data**. English record titles are source fixture data, not untranslated Portuguese labels. JPEGs are the original bounded browser previews without retouching or reconstruction; canonical PNGs are attached to the run.

Coverage includes 1440×1100 dark/light in English, 1440×800 dark in English, 320×1100 light for UI33/CAP01, 390×1100 dark for UI29, and 1440×1100 dark in Portuguese. Portuguese decision editing/review is included. This is not a full locale/theme/viewport Cartesian matrix.

A 320/390 CSS-pixel viewport is reflow evidence, not actual 200%/400% browser zoom. No quantitative contrast certification of every composite surface, exhaustive denied/stale/error/recovery matrix, CAP03 browser journey or approval of image baselines is claimed. The unknown-outcome return-to-list path was source-reviewed; it is not exercised by fabricating a lost response.

The shared CAP01/CAP03 editor's retained `untrack` fix is documented in [INTEGRATION.md](INTEGRATION.md). The other 67 screens were inventoried, not redesigned or accepted. No deployment or merge is implied.

## This round's failures and corrections

| Run | Observed failure | Resolution |
| --- | --- | --- |
| [44910888762](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44910888762) | Narrow UI33 footer ratio 0.99857956, approximately 0.172px under the clipped scroll edge | 24 px scroll margin and centered actual scroll; retained full-visibility assertion |
| Same run, visual review | People labels squeezed into shared four-column grid; tall narrow nav; list competed with case editor; Today attention too tall | Page-specific cascade resets, horizontal nav, focused editor/list stages and compact attention |
| [44910893748](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44910893748) | Inherited Suppliers and E2E type declarations incompatible with existing callers | Type-only unions, exact transitive modules and literal server option; runtime unchanged |
| [44912079289](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44912079289) | Test asked for an accessible name on a native `definition`, whose naming is prohibited by Playwright 1.59.1 | Remove unsupported author labels; assert exact accessible child text instead |
| [44912914816](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44912914816) | English flows completed; fresh Portuguese context omitted the genuinely issued path-scoped cookie and was correctly rejected as unauthenticated | Select existing cookies at the actual mounted URL, preserving the issued cookie and its policy |
| [44912079289](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44912079289), short-window review | Today resume action was below the 800 px viewport | Source disclosure moved onto forecast heading and forecast spacing reduced |

The platform semantics were checked in the exact [Playwright 1.59.1 naming implementation](https://github.com/microsoft/playwright/blob/v1.59.1/packages/injected/src/roleUtils.ts) and [ARIA snapshot documentation](https://github.com/microsoft/playwright/blob/v1.59.1/docs/src/aria-snapshots.md). The correction preserves native semantics instead of adding a different role.

## Historical first-delivery failures

| Run | Actual failure | Resolution |
| --- | --- | --- |
| [44882844362](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44882844362) | CAP01 Year select lacked an exact accessible label | Existing localized label applied to Year and Operations month |
| [44883948061](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44883948061) | Test incorrectly expected the current risk count in an annual-only projection | Test now asserts the genuine missing state; no fabricated value or fallback |
| [44884676701](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44884676701) | Selecting a month mounted a self-subscribing draft sync effect and made CAP01 unavailable | `receiveRemote` is untracked while incoming props/controller remain dependencies |
| 44885831175 / 44885840943 | Snapshot request filename error stopped the workflow before tests | Corrected to the existing `.ci-run.json` contract; product unchanged |

Earlier authentic native Web build/discovery/context smoke passed in [44881051985](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44881051985), on product ancestor `ccfe14a55826a7caee519d3682e14b9fb5214522`. That historical pass is not substituted for the final installed browser result.



## Acceptance

**APPROVED BY USER — 2026-11-21 (America/Sao_Paulo).** After the final screenshots and branch were presented, the user explicitly replied “aprovado”. The approval covers the second composition of UI29, UI33 and CAP01 in product `245e15bf10b5c5287fa9338aa98d0adb28aeda76`, presented through evidence commit `032eb5b8b93c3e75dbad3ebf19cd64f8a40f73a6`.

This is actual user visual acceptance, distinct from the preceding technical checks. The remaining 67 surfaces keep their inventory-only status. This documentation update does not change application code, test baselines, merge state or deployment.
