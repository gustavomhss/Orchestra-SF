# Native Sucafina design integration

## Branch and source

The branch `sf-design-polish` was created directly from `dev` at `948fab6ef2f8bbbcf2c8a6b787755a1d5713e6e1`. The inventory was committed before delegation to three real workers.

Native Web contracts [#572](https://github.com/gustavomhss/Orchestra-SF/pull/572) and native Web shell [#573](https://github.com/gustavomhss/Orchestra-SF/pull/573) merged upstream during the original work. The first presentation was rejected by the user. For the second composition, merge `5b8574712ab89061fd1476812f1c9cb6ac87e2fa` incorporated `dev 1fd255026dec8e1db1f4342f7ec206a6812b42ea` into this owned branch. The inspected upstream and owned path sets did not overlap. No shared dev ref or upstream PR was written or merged by the agent.

Product under review: **`245e15bf10b5c5287fa9338aa98d0adb28aeda76`**. The application is byte-identical to `3de6133a9753b6c2eecd57b7260e5c9867d23c4f`; the final product changes only the capture's cookie-path selection. Evidence/documentation commits are separate from this product and do not change its application or E2E source.

## Product scope

Paths in this table are relative to `packages/app-shell/src/orchestra/chapters/sucafina/`.

| Scope | Files and behavior |
| --- | --- |
| UI29 | `home/index.tsx`, `home/today.css`: forecast band, independent work columns, compact metadata and source disclosures |
| UI33 | `decisions/cases/index.tsx`, `create.tsx`, `cases.css`: focused list/editor stages, preserved draft on return, separate review, 44px controls |
| CAP01 | `dashboard/executive/index.tsx`, `executive.css`: compact period toolbar, financial ledger, isolated label/value rows, honest missing state and review presentation |
| First-three frame only | `shared/wave-one.css` requires an explicit `data-sf-wave` marker; `host/owner-runtime231.tsx` uses the native Context and access DropdownMenu for UI29/UI33/CAP01 only |
| Catalogs | `src/i18n/orchestra-chapters/sf-design.ts`, `sf-u16.ts`, `sf-u02.ts` and composition in `src/i18n/orchestra.ts`; existing English strings remain unchanged |

CAP01 page selectors explicitly outrank the shared metric CSS that is also loaded by CAP03. This prevents four-column People grids and metric-card styles from leaking into the new label/value rows. Source navigation is scoped by active CAP01, uses one horizontal strip and preserves its actual destinations. The source-reference disclosure now has the native chevron. The narrow navigation ends with a 12px fade and padding that protects its final item. Native definition elements expose missing text as content, without an unsupported author-supplied name.

UI33 keeps its list controller and editor instance mounted when an unfinished draft returns to the list. Review cancellation restores all five fields. Only a confirmed instance is discarded on Back; the next New case then starts empty. An unknown result may return to the live list for read reconciliation while preserving the same marker and instance. An active submission cannot be closed. No new command, replay or marker reset is introduced.

## Previously required functional correction

The original browser journey exposed a self-subscribing remote-draft effect in `dashboard/executive/edit.tsx`, shared with CAP03. The retained fix calls `receiveRemote` inside Solid `untrack` while keeping incoming version/value and the controller as dependencies. It does not change draft transitions, owner checks, CAS, command payloads or confirmation rules.

A CAP01 + save-users display branch retains localized counts under the existing Total IT users label for base/current snapshots. Other operations keep their original numeric display. No CAP03 visual redesign is included.

## Inherited dev type compatibility

The first gate run of this round exposed existing declarations incompatible with their callers, also still present in the later inspected dev `65ec572f32ef635478198750bf733e8f7c13d086`.

- `shared/attachments/bound-assets.tsx`: extend the two local type unions with `supplier` and `Suppliers`, already accepted by the schema and transport and already used by the Suppliers caller. Runtime code is byte-identical.
- `e2e/playwright.production.config.ts`: keep the existing conditional server option typed as `stderr: "pipe" as const`; runtime value unchanged.
- `e2e/tsconfig.json`: include exactly the three transitive source modules `shell-state.ts`, `shell-command.ts`, and `shell-preview.ts`. No compiler option, exclusion or guard relaxation.

## Actual capture path

The permanent Playwright spec is `packages/app-shell/e2e/sucafina/design-wave-one.spec.ts`. Its two `design-support/` helpers build the real Web app into private temporary files, serve it through an actual installed CLI on its public origin, discover the genuine owner descriptor and enroll once through the real operator flow.

Data is isolated canonical-producer test data. One decision is created through explicit review and confirmation. The Executive editor reads 128 users, prepares 129, reviews, cancels and discards to 128 without saving. Missing annual-risk and meeting/change data remain unavailable.

Portuguese uses the app's existing persisted language preference `br` in a fresh browser context with actual issued session cookies selected at the original /sucafina path, preserving their policy. No producer response or authorization is fabricated. Trace and video are off; bounded failure diagnostics redact credentials and URLs.

The narrow footer is scrolled through the real DOM using centered alignment and a 24px scroll margin; full visibility assertions remain `ratio: 1`. The previous subpixel failure was not hidden by lowering the assertion. Shorter desktop captures check the composition at 1440×800 in addition to 1440×1100.

## Evidence and acceptance

[VALIDATION.md](VALIDATION.md) and the [gallery](evidence/README.md) identify the exact tested product and actual screenshots. Historical patches under `wave-one/` belong to the rejected first delivery and remain historical provenance.

No shared frame, native shell, global kit/palette, source route registry, API or legacy white/green interface redesign is included. The other 67 surfaces are inventoried only. The user explicitly approved the presented second composition on 2026-11-21 with “aprovado”; [VALIDATION.md](VALIDATION.md) pins its product and evidence commits. This records visual acceptance without modifying application code, golden baselines, merge state or deployment.
