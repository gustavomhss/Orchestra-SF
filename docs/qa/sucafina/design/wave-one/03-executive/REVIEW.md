# CAP01 Executive — scoped design candidate

**Status: review candidate only. Not applied, not compiled, not rendered, not visually approved.**

The worker branch `sf-polish-executive` starts at planning commit `20bd10681b83c51d1f5d369b7a438b58d57c9f18`, whose parent is dev `948fab6ef2f8bbbcf2c8a6b787755a1d5713e6e1`. This commit publishes documents only.

The target dev tree lacks the native Sucafina frontend and its registrations. [candidate.patch](candidate.patch) is a real unified implementation diff against native source `fdeb988881c927f952a2d9fd5b8002c892f56635` (`sf-join-four`), for `/orchestra/sf-dashboard/executive`. It cannot be applied meaningfully to the current dev tree by itself. Integrate it only after the intended native frontend has been composed into a dev-descended candidate. If its source blob has changed, review/rebase the small diff; do not replace newer files with this older source.

## Ownership correction

Inspection established that Budget CAP03 imports both Executive's `u02.css` and `SfU02Edit`. They are shared, despite their directory. Both remain byte-for-byte unchanged. CAP03's own source is unchanged.

The product patch has exactly two paths:

- `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/executive/index.tsx`: eight bounded presentation/accessibility substitutions.
- `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/executive/executive.css`: a new 409-line stylesheet imported only by CAP01, with every ordinary rule rooted at `.sf-u02-page[data-sf-surface="CAP01"]`.

No shared shell, frame, kit, token, palette, controller, transport, route, calculation, read projection, other dashboard or legacy interface is changed. The new stylesheet explicitly neutralizes the shared mobile table border if Budget's stylesheet is also loaded.

## Concrete defects and decisions

| Source finding | Candidate response |
| --- | --- |
| The old page uses fallback names such as `--background-primary`, `--radius-lg` and `currentColor`; headings use fractional rem sizes. | Use the actual native `--mx-*` and `--orchestra-*` roles, exact native typography/radii, and centralized CAP01 layout measurements. Source and dev theme/kit contents were compared and are identical. |
| Repeated bordered KPI tiles compete with the section, and values lack a stable label baseline. | Keep a quiet raised section, remove individual KPI borders/fills, reserve two complete label lines, and use equal financial/variance columns and four equal people columns before narrow reflow. |
| Missing/unscoped messages occupy the same large numeric treatment as real values. | Add presentation-only availability attributes using the existing `knownNumber` predicate. Preserve every message and value; display availability text at body size and weight. |
| The shared table rule right-aligns textual signal columns. | Distinguish financial and signal tables. Align financial numeric headers/cells to the end, retain readable start-aligned signal text and provenance, emphasize the actual finance total row. |
| Overflow tables have no explicit keyboard scroll target. | Make the two existing scroll wrappers named, focusable regions; use the existing financial caption and signal heading as accessible labels. Add visible native focus and quiet edge cues. |
| Editor styles target `.sf-u02-editor`, which the actual shared editor does not emit. | Style its real `data-sf-u02-edit` root within CAP01. Give fields 44px controls, aligned actions, readable source-version/status text and full-width inline review. |
| Review-entry buttons compete as saturated actions. | Render the entry buttons quietly within CAP01 while retaining the existing actual confirmation action's native primary treatment. No write starts earlier and no new command is introduced. |

The current `DESIGN.md` quiet-glass specification governs this candidate. No wide saturated glass, rim, sheen, grain, added backdrop blur, custom palette, font, invented KPI or new user-facing copy is introduced. Existing inline review remains inline.

## Preserved behavior

All original i18n keys/text, finance/period logic, CAP01 flags, independent filters, source availability warnings, BI slots, numeric formatting, signal ordering and priority, navigation targets, editor read/review/confirm guards, version/provenance bindings, confidentiality handling and callbacks remain intact. The existing `SfStatePanel` continues to determine whether private children render. No CSS hides a warning or state.

All existing identity/provenance selectors remain. Added selectors are presentation hooks and accessible table labels. The candidate does not serialize independent editor sessions; inspect the existing simultaneous-review state when reviewing action hierarchy.

## Pinned evidence

Complete file paths, commits and blob IDs for 21 read sources are recorded in [source-lock.json](source-lock.json). Critical preimages are:

| Path, relative to `packages/app-shell/src/orchestra/` | Blob SHA |
| --- | --- |
| `chapters/sucafina/dashboard/executive/index.tsx` | `81d4dd0c878f8b8a7a3a36a1eea8d668d714f69f` |
| `chapters/sucafina/dashboard/executive/edit.tsx` — unchanged | `1b0448160a6d71fbb2176120df8d2181b6192a85` |
| `chapters/sucafina/dashboard/executive/u02.css` — unchanged | `8488212dc742eb6454418f9fb10ef2f4363c706b` |
| `chapters/sucafina/dashboard/budget/index.tsx` — unchanged | `e5986221a5b5fe2d94a395d794b9894846cafaa9` |
| `chapters/sucafina/shared/frame/frame.css` — unchanged | `2477afe718a6631d088b0244e1939e1fd398650a` |
| `theme.css` — identical in native source and dev | `5f557ab4917ba9a7c850cce8b265ac0900ca373d` |
| `chapters/kit.css` — identical in native source and dev | `d90cfcf2b4b5063931b663fe74bb7b8a4bec85fe` |

The new stylesheet was confirmed absent at the pinned source.

### Source-only verification completed

Reversing the eight declared TSX substitutions restores the original file exactly. The sequence of CAP01/U02 copy and command identifiers and selected callback/authority prop lines is unchanged. Independent unified-diff replay reconstructs the intended two postimages exactly, with valid hunk counts. The patch changes 12/adds and 8/removes TSX lines and adds the new stylesheet.

All 22 external CSS roles resolve to definitions in the native theme/kit. Rule selectors are CAP01-scoped, braces balance, local measurement tokens are referenced, and the candidate contains no hardcoded color or legacy fallback token. These are artifact/source checks performed in code-mode JavaScript, not product tests or proof of computed layout, accessibility or contrast.

## Required integration verification — all NOT_RUN

Follow the [first-wave validation plan](https://github.com/gustavomhss/Orchestra-SF/blob/e69bb9bc1b3354520e07bdec61e575de73151d99/docs/qa/sucafina/design/VALIDATION.md) on the actual composed candidate SHA.

1. Run the existing change-scoped hosted Linux checks, package typecheck and guardrail checks. Do not run local product tests/typecheck, a broad SF suite, or fabricate missing native harness inputs.
2. Run `e2e/sucafina/native/journeys/u02.spec.ts` for **CAP01 and CAP03**: original source values, independent period, no write from filter change, no cross-chapter save, Budget explicit review and denied/expired confidentiality. Its installed Executive/Budget URLs and dashboard year/month must be real. Relevant existing cross-link/signal checks remain applicable if integration affects their presentation.
3. Use actual CAP01 entries in `e2e/sucafina/native/visual.spec.ts` and `accessibility.spec.ts`. Capture Dark/Light at 1440×900, 1280×800, 1024×768, 390×844 and 320 CSS px. Inspect 200% text and 400% equivalent reflow on CAP01 itself; the existing Q02 200% case targets CAP25 and proves nothing about this candidate.
4. Review English/pt-BR, long provenance/labels/values, actual ready, missing/unscoped, empty, stale, partial, error, denied and expired states where supported. Inspect both editors, validation/conflict/unknown-outcome states, inline review, confirm, cancel/revise, disabled controls, keyboard order, visible focus and keyboard table scrolling.
5. Compare CAP03 before/after, including navigating CAP01 → CAP03 after the new stylesheet has loaded. Unchanged shared files plus CAP01 selector scope are a structural guard; actual computed appearance is still unverified.
6. Rerun the existing palette generator/parity/contrast gate. Dev's fixed `PALETTE_SOURCES` list includes theme/kit but no Sucafina leaf stylesheet. This candidate consumes existing roles and does not edit generated output. Verify Graphite, Gruvbox, GitHub, Nord and AMOLED in the actual native app, and measure composite text 4.5:1 / meaningful icons 3:1. Token names alone do not prove AA.
7. Add the measurements below to shared `DESIGN.md` in the actual integration change, as required by the design skill. This worker's ownership intentionally excludes that shared file.

Screenshots, computed values, compiler/formatter output, palette results, Actions URLs and reviewer-approved visual baselines are absent. Keep those gates open; do not auto-accept a baseline or label this document branch visually complete.

## Integration DESIGN.md addendum

CAP01 uses native sans/emphasis fonts, 13px body, 12px labels/table copy, 16px section headings, 14px subheadings and 24px numeric values. Missing/unscoped values use 13px body hierarchy. Native small/medium/large radii remain 6/8/10px.

Local spacing tokens are 6/10/14/20/24px; section gap/padding is 20px and compact padding 14px. Controls are at least 44px tall. Hairlines are 1px; focus is 2px with 2px offset. Body/heading/value line heights are 1.6/1.4/1.25; numeric tracking is −0.035em. Labels reserve two body line boxes except in the narrow single-column arrangement.

Metric/editor minimum tracks are 140/280px; financial/signal table readable minimum widths are 480/640px inside keyboard-accessible local scrollers. Copy measure is 68ch. Scroll fade/shadow extents are 20/12px. Named `sf-frame` container thresholds are 767px (two metric columns) and 420px (single-column controls/metrics/editors and stacked navigation/actions). Shared frame gutters, reading width, global materials and source semantics remain unchanged.
