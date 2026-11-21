# First-wave validation and limits

Product: `41ea32b657ed2a9c170e544ac76ed6ecaaefe1ff` on `sf-design-polish`, descended from dev `39355aa1988b33653151ddc8b76bc2dac55e55dd`.

## Hosted checks

| Check | Exact hosted evidence | Result |
| --- | --- | --- |
| App-shell typecheck | [run 44886478223](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44886478223), snapshot `09c4e8cc74479ad9aaa116a1a7e6b1e095af5a22` | PASS, exit 0 |
| Permanent E2E typecheck | Same run, `bun run typecheck:e2e` | PASS, exit 0 |
| Repository guardrails | Same run, exact dev base `39355aa1988b33653151ddc8b76bc2dac55e55dd` | 78 rules, 29 candidate/snapshot files; zero errors, zero approvals, two warnings |
| Palette generation/parity | Same run, original palette writer | PASS, seven generated files byte-identical |

The four checks ran in 17.84 seconds with 11 assertions and six real Omni spawns. The two guard warnings flag the capture fixture's 190-second installation deadline and its 240-second whole-journey deadline. This scenario builds and starts a genuine installed application and captures multiple real routes. The deadlines were not increased to repair a failing interaction; the original browser assertion deadlines and retries=0 remain. No guard, approval environment, workflow allowlist or compiler option was relaxed.

The verification wrapper exists only in the disposable CI snapshot, under `apps/cli/test/`; it is not integrated into product. Its parent is the exact product commit above. It pins dev in the disposable runner's remote-tracking ref, never writes the shared remote branch.

## Native browser journey

**PASS** — [run 44886474787](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44886474787), job `136792735083`, snapshot `c273ef9bee8ce9fe8761a5437bcb6dd3589bdd72`, parent product `41ea32b657ed2a9c170e544ac76ed6ecaaefe1ff`: one real Chromium journey, retries=0, reported 3.2 minutes. It emitted 17 complete JPEG previews (1,587,090 bytes total) and canonical PNG attachments in artifact `14700078712`.

The preceding successful Capture5 ran the same spec and all three screen flows. Visual review then identified exactly two refinements: a full-width narrow Today resume action and count-only CAP01 base/current presentation. Capture6 exercises the unchanged required assertions on those final source changes.

The capture uses the existing `e2e/playwright.production.config.ts`, a real Web bundle and an actual CLI installation on one origin. Canonical producers seed clearly identified isolated test data. Enrollment is real and one-use, with private setup files; no forged grants, cookies, receipts or network response mocks.

Coverage is the specific first-wave flow:

- UI29 authorized attention/risk data, five forecast values, genuine unavailable meetings/material changes and complete resume text.
- UI33 one actual decision creation through review and a single confirmation; source-authorized link; real search, keyboard clear and visible focus; desktop/narrow review footers.
- CAP01 actual budget/forecast source values and honest missing annual-risk state; year/month controls; users 128 → draft 129 → review → cancel → discard → 128.
- Exact native owner frame and readiness, same origin, native routes and no document/page-scroller horizontal overflow. Local financial tables may scroll inside their named region.

## Visual peer review

Three real workers inspected their respective Capture5 screenshots, while root reviewed the dark/light, narrow and inline-review images. UI33 passed the observed scope with no blocking issue: list/search/refresh align, criteria are numbered, source absence is human-readable, and the full confirmation/cancel footer fits. The UI33 source and capture spec are identical in Capture6.

Today dark/light attention cards and forecast align; source availability remains visible. A narrow case title was cramped beside its action, so the final 390px capture was re-inspected after moving the action beneath the full-width title. The complete title now fits three lines and the CTA, routine area, meetings and material-change messages remain intact.

Executive dark/light/navigation/tables and the 320px period controls passed the observed visual scope. The review previously attached a currency warning to the user count. The final image was independently re-inspected: Original 128 / Current source 128 / Proposed 129, all under the existing Total IT users label, without imposed decimals or a currency warning. Actions and comparison columns remain aligned.

These are bounded visual findings, not formal contrast or exhaustive accessibility certification.

## Scope of evidence

Screenshots show isolated **test data**, in English. This is not a claim about live customer data or a published deployment. PNGs are attached to the browser run; their exact JPEG browser previews are retained under `evidence/` with source job and blob provenance.

Measured browser coverage is 1440×1100 desktop in dark/light, 320×1100 light for UI33/CAP01, and 390×1100 dark for UI29, plus real inline review states. A 320 CSS-pixel viewport is reflow evidence, **not actual 200%/400% browser zoom**.

Not established by this run: actual 200%/400% zoom, a full pt-BR render matrix, rendered screenshots for all generated palettes, quantitative contrast of every composite surface, every denied/stale/error/recovery combination, and a CAP03 browser journey. The unchanged source palette suite passed 16 individual tests earlier (run44881792714), including its own contrast checks; that overall historical run failed an unrelated verification-wrapper typecheck and is not reported as a green final run. Palette parity is confirmed on the final product. Source token tests do not establish every rendered surface's contrast.

CAP03 uses the same editor. The minimal untrack repair preserves its remote synchronization and CAS logic by source review; no visual CAP03 acceptance is claimed. Other 67 native screens were mapped, not redesigned or accepted. No expected-image baseline was updated or approved by the agent.

## Failures that led to corrections

| Run | Actual failure | Resolution |
| --- | --- | --- |
| [44882844362](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44882844362) | CAP01 Year select lacked an exact accessible label | Existing localized label applied to Year and Operations month |
| [44883948061](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44883948061) | Test incorrectly expected the current risk count in an annual-only projection | Test now asserts the genuine missing state; no fabricated value or fallback |
| [44884676701](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44884676701) | Selecting a month mounted a self-subscribing draft sync effect and made CAP01 unavailable | `receiveRemote` is untracked while incoming props/controller remain dependencies |
| 44885831175 / 44885840943 | Snapshot request filename error stopped the workflow before tests | Corrected to the existing `.ci-run.json` contract; product unchanged |

Earlier authentic native Web build/discovery/context smoke passed in [44881051985](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44881051985), on product ancestor `ccfe14a55826a7caee519d3682e14b9fb5214522`. That historical pass is not substituted for the final installed browser result.

## Acceptance

The deliverable is for the user's visual review. Source checks, passing browser assertions and peer visual review are evidence; they are not a fabricated user approval, automatic golden-baseline acceptance, merge or deployment.
