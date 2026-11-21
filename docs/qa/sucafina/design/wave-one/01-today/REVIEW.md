# Today / UI29 — native design candidate

**Status: implementation candidate; native import and visual validation pending.** This branch contains a real source patch and its review record. It does not change the running product.

## Base and precise scope

The branch `sf-polish-today` starts from planning commit `20bd10681b83c51d1f5d369b7a438b58d57c9f18`, whose single parent is the selected `dev` commit `948fab6ef2f8bbbcf2c8a6b787755a1d5713e6e1`. That target has no native Sucafina chapter, navigation or registrations. Applying this patch to that target now is unsupported; importing the historical frontend wholesale would exceed this design task.

[candidate.patch](candidate.patch) targets only the native `/orchestra/sf-home` screen from [the pinned reference commit](https://github.com/gustavomhss/Orchestra-SF/commit/fdeb988881c927f952a2d9fd5b8002c892f56635):

| Candidate path | Operation | Original Git blob SHA |
| --- | --- | --- |
| `packages/app-shell/src/orchestra/chapters/sucafina/home/index.tsx` | Local markup/classes and stylesheet import | `3f777bf0485a5e4d27b716d3e0d40291953f2021` |
| `packages/app-shell/src/orchestra/chapters/sucafina/home/today.css` | New page-local stylesheet | Absent in the pinned home directory |

The candidate postimage blob SHAs are `7719cce45d7469e8985a7683214ddfd6b762a242` for the TSX and `b18d27c32b717cd9355b5b114b9ae63907f14958` for the CSS. They are computed Git blob hashes, not claims that those product files exist on this branch. [provenance.json](provenance.json) records the source files, precise SHAs, method and validation state. The [inventory](../../README.md) defines the wider campaign.

## Observed weaknesses in source

The existing page places attention, risks, forecast, resume, meetings and material changes in six similarly weighted cells. Permanent unavailable sections receive the same card treatment as work that can be acted on. The content has no page-local typography hierarchy: bullet lists mix large title buttons and block metadata; forecast values and provenance share an unstructured definition list; cases and routines have no clear internal layout. These are source findings, not screenshot measurements.

## Composition and design decisions

The candidate follows the current Orchestra `DESIGN.md` quiet-glass grammar and native chapter kit. The newer quiet-glass guidance takes precedence over older glass prose in the design skill. Existing native card materials remain in use; there is no new blur, shadow, grain, rim, palette, branding or font family.

- Attention and risks form a balanced pair when the actual workspace container has at least 860 CSS pixels. Narrower workspaces use one column.
- Forecast spans the content width. Three comparable values use the native 24px numeric tier, tabular figures and explicit label/value groups. Source, owner and deadline remain visible below in a quieter provenance row. The values stack below 640 container pixels.
- Resume spans the content width. Cases and routines use a 2:1 layout above 860 container pixels and stack below it. Case identity, version and the existing resume action are aligned as a readable row.
- Meetings and material changes stay visible at the end, with their original headings and unavailable state. They use compact divided sections, reducing their prominence without hiding or collapsing their information.
- Native type roles are explicit: 13px body, 12px supporting text, 14px row titles and 16px section headings. Monospace is reserved for existing identifiers. Local spacing is 20px between regions, 14px between rows, 10px within compact groups and 6px between details.
- Content grids use `minmax(0, …)`, descendants can shrink, long text wraps, and actions keep the existing 44px frame target. Source title actions have visible focus and a text hover treatment. Case actions can wrap without fixed-height clipping.

All new selectors are scoped to `.sf-today`. Container queries use the existing named `sf-frame` container, so the available content width governs reflow. No shared state/frame/kit rule, token definition, global palette, shell surface or legacy white/green interface is changed.

These geometry choices are proposed values. A later integrated delivery should record the actually validated metrics in the design documentation; this candidate does not claim they were measured in an installed app.

## Preserved behavior and contracts

All business logic before the main JSX return is byte-identical after excluding the single stylesheet import. The patch preserves the source owner/read fencing, freshness and identity checks, source-authorized navigation, resume preflight, retained-draft behavior, queue-microtask focus restoration and retry/back callbacks.

The complete sets of `state`, `when`, `each`, `onClick`, `onBack`, `onRetryRead`, `ref`, `disabled`, `messageKey` and `aria-label` attribute expressions match after whitespace normalization. Data selectors and localization-key occurrences also match. These comparisons provide bounded source evidence; they do not substitute for running Solid, compiling TypeScript or exercising the browser.

The exact contracts `section[aria-labelledby="sf-u01-meetings"]` and `section[aria-labelledby="sf-u01-changes"]` remain present with `SfStatePanel state="unavailable"`. Loading, stale, denied, invalid, removed, session-expired and unavailable paths remain controlled by their original logic. No values, actions, projected data or availability states are invented. There is no modal on this screen to redesign.

## Evidence actually obtained

| Check | Result and limit |
| --- | --- |
| Branch ancestry and reference files | Read through GitHub MCP; planning commit parent and source blobs verified |
| Exact source bytes | Git blob hash reproduced and matched GitHub SHA |
| Unified patch structure | Independent JavaScript hunk reconstruction matched both complete candidate postimages exactly |
| Functional expressions and source selectors | Source comparisons passed as described above |
| Native CSS variables | Referenced variables found in the fetched native theme, kit and frame sources |
| Visual rendering, screenshots, computed styles | **NOT_RUN** |
| Typecheck, application tests, browser journeys, guardrails | **NOT_RUN** |
| Palette generation, generated parity, measured contrast | **NOT_RUN** |
| Product integration | **BLOCKED** by absent native frontend in target `dev` |

No terminal, local tests, CI workflow, PR, merge or installed-app mutation was performed. An in-memory patch check is not `git apply --check`, a compiler result or visual approval.

## Required integration and acceptance

1. Establish the separately approved native frontend import on a dev-based integration branch, including the real host/navigation/context dependencies. Verify this pinned source or reconcile any changed blob explicitly. Then run `git apply --check` for this patch and review the applied diff.
2. Execute the existing relevant regression contracts: `e2e/sucafina/native/journeys/u01.spec.ts`, `u01-host231.spec.ts` with its actual host prerequisites, and `test-browser/sucafina-native/today-resume227.test.ts`, under the repository's required CI workflow. Run the applicable typecheck and guardrails. Nothing here records those jobs as passed.
3. Inspect the actual installed build at 320, 768, 1024, 1280 and 1440 CSS pixels, at 200% zoom and at 400% reflow equivalent to 320 CSS pixels. Confirm no page-level horizontal overflow, readable wrapping of long localized titles/identifiers/numbers, visible headings and intact actions. Existing CAP25-only zoom evidence does not cover Today.
4. Exercise pointer and keyboard source navigation, retry/back paths, blocked resume, successful resume and restored focus. Include wrong-identity and late producer replies, stale data, session expiry and denied access. Confirm unavailable meetings/material changes stay visible and lists remain announced as lists.
5. Review the actual configured palettes in dark and light schemes, including nested state panels and focus contrast. Follow the design skill's palette regeneration and parity/AA gates after stylesheet changes, even though the generator currently has a fixed source list that excludes this new Sucafina stylesheet. Do not edit generated palette files by hand.
6. Capture real whole-screen and close-up evidence for the ready and relevant state paths, and compare against native Orchestra reference screens. Record measured contrast, computed typography/spacing and any remaining defects before marking the implementation visually approved.

The principal remaining risk is integration and rendering compatibility, not an observed test failure: neither the target route nor this candidate was run in this session. Long text wrapping, zoom behavior, theme contrast, focus position and the quieter availability treatment require actual browser inspection.
