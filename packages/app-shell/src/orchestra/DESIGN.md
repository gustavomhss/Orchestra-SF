# Orchestra interface specification

Inbox Slack login extends only the existing Sources dialog: shared section, button, link and status styles;
no new glass layer, palette, material token or standalone settings page. The development fixture catalog remains
presentation-only and never mounts the real login controller. The account panel explicitly distinguishes a
verified login from explicit conversation selection and user-started acquisition. The selection uses a bounded
240px scroll region with standard checkbox rows and existing line/radius tokens, not another glass surface.
Work-source manual credentials remain in the existing form. GitHub's optional repository/class controls and
GitHub/Linear's explicit sync receipts use the same section/fieldset/button vocabulary inside Sources; no new
glass material, destination or universal settings engine. Saving collection preferences never starts a sync.
Mail and Teams reuse this section: explicit discovery, bounded checkbox selection, mail-only unread switch and
the same sync/disconnect receipt controls. No acquisition on dialog mount; no new visual surface or material.
Source sections use 12px grid rhythm, 8px checkbox/action gaps and wrapping action rows; explanatory text uses
the existing small/dim tokens. The controls do not touch or run together when discovery results are shown.
Calendar reuses the same bounded checkbox selection and explicit discover/save/sync controls. Calendar source
selection distinguishes Google Calendar from the mail provider label; it adds no new material or settings page.
Notification scopes and public feeds likewise reuse the existing Sources section/action-row vocabulary.

The rules, scales and values behind Orchestra's interface. The stylesheets are the source of truth; this document
explains them and records the numbers so a change can be judged before it is made. When the two disagree, the CSS
wins and this file is stale: fix it in the same change.

- Tokens and materials: `theme.css`. Session surface: `session.css`. Chapter kit: `chapters/kit.css`.
- Palettes: `palette/definitions.ts` (anchors) and `palette/generated/*` (output, never edited by hand).
- Dark values are listed first; light values follow where they differ.

## 1. Principles

1. **Quiet glass.** A narrow blur that darkens and slightly desaturates, with no rim, sheen or grain. The owner
   judged the wide, saturated glass with a light-catching rim worse (2026-10-27); do not bring it back without them.
2. **The wallpaper stays behind a veil.** A dark (or light) veil over the photograph keeps the chrome calm.
3. **One saturated element per view:** the primary action. Everything else is quiet.
4. **Tokens only.** A literal color, radius, size or duration appears only inside a token definition.
5. **Contrast is measured, not eyeballed.** Text holds 4.5:1 and icons 3:1 on the glass over the photograph.

## 2. Materials

Exactly three. Never stack glass on glass: inside a glass panel, depth comes from fill steps and hairlines.

### 2.1 Chrome glass

Sidebar, tab strip, toolbar, Home and chapter panels (`.orchestra-glass`, blur on `[data-glass-plate]`).

| Token | Dark | Light |
| --- | --- | --- |
| `--orchestra-glass-filter` | `blur(8px) brightness(0.74) saturate(0.9)` | `blur(16px) brightness(1.04) saturate(0.96)` |
| `--orchestra-glass-background` (tint) | `rgba(26,36,48,.5)` → `rgba(13,19,26,.46)` 46% → `rgba(10,15,21,.54)` | `rgba(255,255,255,.62)` → `rgba(248,250,252,.5)` 46% → `rgba(240,244,247,.6)` |
| `--orchestra-glass-rim`, `--orchestra-glass-sheen` | `none` (the masked ring and the sheen layer stay wired) | same |
| `--orchestra-glass-border` | `rgba(160,179,197,.16)` | `rgba(70,84,98,.16)` |
| `--orchestra-glass-shadow` | inset top highlight `.08`, inset bottom `rgba(0,0,0,.3)`, `0 1px 2px .4`, `0 4px 12px .2` | inset top white `.95`, inset bottom `.14`, `0 1px 2px .14`, `0 4px 12px .08` |
| `--orchestra-grain` | `none` | same |

The toolbar blurs a flat `blur(20px)` under its own tint. Toolbar and tab text: dark `#7d8b9b` labels, `#81909f`
tabs; light `#6b7480` labels, `#5f6874` tabs.

The tint is a vertical gradient: lighter at the top where light lands, denser at the bottom where text sits.

### 2.2 Float glass

Popovers, menus, selects, hover cards, the profile menu and dialogs. The strongest glass, because only text sits on
it and it is open briefly. Never make a floating layer opaque.

| Token | Dark | Light |
| --- | --- | --- |
| `--orchestra-float-filter` | `blur(40px) brightness(0.9) saturate(1.8)` | `blur(40px) brightness(1.08) saturate(1.8)` |
| `--orchestra-float-background` | `rgba(30,40,53,.72)` → `rgba(18,25,34,.8)` | `rgba(255,255,255,.8)` → `rgba(246,248,251,.86)` |
| `--orchestra-scrim` | `rgba(5,9,14,.42)` | `rgba(40,52,66,.2)` |
| `--orchestra-scrim-filter` | `blur(6px) saturate(1.1)` | same |

Every backdrop (`dialog::backdrop`, palette and sheet scrims in Actions, Atlas, Relay and the chapters) blurs
through `--orchestra-scrim-filter`; no backdrop carries its own blur literal.

### 2.3 Content base

Session panels, near-opaque for long reading (`--orchestra-session-*` in `session.css`). Like the chrome they carry
no rim, sheen or grain. Their blur comes from the fixed blurred wallpaper copy in `.orchestra-glass-layer`
(`--orchestra-session-filter`: dark `blur(16px) brightness(0.58) saturate(0.86)`, light
`blur(18px) brightness(1.02) saturate(0.98)`), not from their own filter.

- Dark background: `rgba(22,31,41,.8)` → `rgba(15,21,29,.85)` 50% → `rgba(12,17,24,.9)`.
- Text steps: heading `#e9eef3`, body `#c2ccd6`, secondary `#93a2b2`, meta `#7e90a2`.
- Rules: `rgba(160,181,200,.1)`; between messages `.09`.

### 2.4 Workspace overlay

`--orchestra-workspace-overlay` is a veil over the photograph that keeps the chrome calm.

- Dark: `rgba(9,14,20,.7)` → `.58` at 42% → `.74`, plus a radial `rgba(26,37,50,.42)` glow at the top left.
- Light: `rgba(226,231,236,.5)` → `.34` at 42% → `rgba(222,228,234,.56)`, plus a radial white `.5` glow.

### 2.5 Performance

A `backdrop-filter` repaints whenever anything inside its box paints. The sidebar and tab strip draw their blur on
`[data-glass-plate]` siblings, and session panels use the single blurred copy. Change values, never this mechanism.

## 3. Fill steps inside a panel

| Token | Dark | Use |
| --- | --- | --- |
| `--orchestra-surface` | `rgba(32,43,55,.7)` | resting control or card fill |
| `--orchestra-surface-hover` | `rgba(44,58,73,.8)` | hover |
| `--orchestra-surface-active` | `rgba(70,95,122,.62)` | pressed or selected |
| `--orchestra-overlay-hover` | `rgba(255,255,255,.045)` | hover wash on transparent rows |
| `--orchestra-overlay-pressed` | `rgba(255,255,255,.08)` | pressed wash |
| `--mx-raised` | `rgba(19,28,38,.55)` / light `rgba(255,255,255,.63)` | chapter cards |
| `--mx-soft` | `rgba(170,196,220,.055)` | quiet chips and wells |
| `--mx-rim` | `rgba(166,189,211,.24)` / light `rgba(65,86,107,.24)` | card rim on hover or focus-within |
| `--mx-highlight` | `0 0 transparent` | no top glint anywhere (quiet glass); kept so shadow lists keep one shape |

Hairlines: `--orchestra-border-muted` `.14`, `--orchestra-border` `.2`, `--orchestra-border-strong` `.34`
(all on `rgb(163,184,203)`); chapter kit `--mx-line` `rgba(166,189,211,.14)`.

## 4. Color

### 4.1 Role tokens

| Role | Dark | Light | Use |
| --- | --- | --- | --- |
| `--orchestra-text` | `#eef1f5` | `#1a1f26` | titles, strong text |
| `--orchestra-body` | `#c7d0d9` | `#353d48` | running text |
| `--orchestra-muted` | `#b2c0cf` | `#343d48` | labels, eyebrows |
| `--orchestra-faint` | `#aec2d4` | `#363e48` | meta |
| `--orchestra-accent` | `#9dc3e9` | `#0c3e6c` | links, focus, selection |
| `--orchestra-aura` | `#6fb0f0` | `#3f8ee0` | glow around a working agent's picture (2.4s breath, still under reduced motion) |
| `--orchestra-warm` | `#cfbd95` | `#4d390f` | warning |
| `--orchestra-success` | `#a6c8b7` | `#164431` | success |
| `--orchestra-danger` | `#e7b3b0` | `#5c302f` | error, destructive |

Every other color (`--orchestra-sidebar-*`, `--orchestra-tab-*`, `--orchestra-toolbar-*`, `--mx-*`) derives from
these. The legacy `--v2-*`, `--text-*`, `--surface-*` and `--border-*` names are aliases mapped in `theme.css`.

### 4.2 Rules

- Tints: `color-mix(in srgb, var(--role) N%, transparent)`, never a new literal.
- To fix contrast, change lightness and keep hue.
- Do not write light-mode overrides that restate a token's light value.
- Primary action: `--mx-primary` (flat `#3873b0`) with `--mx-primary-text` white. It is the only saturated
  fill on a screen.

### 4.3 Palettes

Dark and Light are hand-tuned. Graphite, Gruvbox, GitHub, Nord and AMOLED are generated: `palette/definitions.ts`
gives eight anchors per theme (background, surface, text, muted, accent, success, warning, danger), and
`bun script/orchestra-palettes.ts` (from `packages/app-shell`) remaps every Orchestra color by hue family and
fails if a palette cannot hold AA.

- AMOLED keeps true black: surface `#111111`, no photograph behind the glass, accent in the HuGR logo blue.
- After any change to an Orchestra stylesheet, rerun the generator: palettes copy every rule that carries a color.

## 5. Scales

### 5.1 Radius

| Token | Value | Use |
| --- | --- | --- |
| `--orchestra-radius-xs` | 4px | keycaps, tiny badges, inline code |
| `--orchestra-radius-sm` | 6px | buttons, nav items, inputs, pills, menu items |
| `--orchestra-radius-md` | 8px | small cards, popovers, list wells |
| `--orchestra-radius-lg` | 10px | panels (sidebar, main glass, session), chapter cards |
| `--orchestra-radius-xl` | 16px | the shell, dialogs, the ⌘K palette |
| `--orchestra-radius-full` | 999px | avatars, status dots, round toggles |

Nest concentrically: outer radius = inner radius + gap. The shell (16) holds panels (10) with a 6px gutter.

### 5.2 Type

Inter (bundled variable font), with `"Mx Inter"` and `"Mx Inter Medium"` for the chapter kit. Monospace
(`--mx-mono`) only for code, paths, IDs and branches; never for badges, chips or status.

| Token | Size | Use |
| --- | --- | --- |
| `--orchestra-font-size-2xs` | 10px | branch names, keycap glyphs |
| `--orchestra-font-size-xs` | 11px | eyebrows, pills, meta |
| `--orchestra-font-size-sm` | 12px | secondary text, table cells |
| `--orchestra-font-size-md` | 13px | body and navigation (line height 24px in panels) |
| `--orchestra-font-size-lg` | 14px | emphasized body, card titles |
| `--orchestra-font-size-xl` | 16px | section headings |
| `--orchestra-font-size-2xl` | 20px | dialog titles |
| `--orchestra-font-size-3xl` | 24px | KPI values |
| `--orchestra-font-size-4xl` | 30px | chapter titles (weight 600, line height 38px, tracking −0.035em) |

No half pixels. Hierarchy comes from size, weight and the color steps above, not from more sizes.
Eyebrow: `xs`, weight 600 via `--mx-emphasis`, tracking `0.1em`, uppercase, `--orchestra-muted`.

### 5.3 Motion

| Token | Value | Use |
| --- | --- | --- |
| `--orchestra-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | every one-shot transition |
| `--orchestra-duration-fast` | 120ms | hover, press, color changes |
| `--orchestra-duration-base` | 180ms | reveal, rotate, enter |

Under `prefers-reduced-motion` both durations become 0ms. Infinite loops (spinners, pulses) keep their own timing.
Dialogs and their overlay have no motion on purpose: `orchestra-accessibility.spec.ts` depends on it.

The opening splash (`apps/desktop/src/renderer/splash`) is the only opening mark: the comet video, at most 960 CSS px
wide (its 1920 px source at 2x), holds its last frame until the app mounts and then fades. Loading screens underneath
are plain `bg-background-base` surfaces marked `data-app-loading`, never a second logo.

## 6. Layout and spacing

Measured at 1920×1200 in the dev app. Spacing values sit on a 2px grid; most gaps are 2, 6, 10, 14 or 20.

| Element | Value |
| --- | --- |
| Shell | inset 12px from the window, radius 16px |
| Panel gutter | 6px between sidebar and main glass, and inside the shell |
| Sidebar | 230px wide, padding 14px 10px 13px, radius 10px |
| Brand block | centered, padding 4px 10px 16px. Lockup 120×40px: the HuGR symbol plus "uGR" (`hugr-lockup-*.svg`, the wordmark's H dropped because the symbol reads as one). Below it the product name "Orchestra", 10px weight 500, uppercase, tracked 0.6em to the lockup's ~110px ink width, with a −0.6em end margin so it stays centered. Compact navigation shows only the 32px symbol. The splash and error screens keep the full 121×32 wordmark |
| Nav item | 31px tall, padding 0 10px, gap 11px, radius 6px, 13px text, 1px between items |
| Nav icon | 16×16px |
| Sidebar active item | gradient fill, 1px inset rim, 3×(row−16px) rounded accent pill inset 3px from the start edge (logical, so RTL follows) |
| Sidebar list | scrolls between the fixed brand and profile card; 8px fade at the top edge, 16px at the bottom, never a hard cut. Padding moved from 16px bottom only to 8px top and 16px bottom, and the 2px top margin on the nav list is gone |
| Home scroll area | 16px fade at the bottom edge, so cards under the fold at 1280×800 never end in a hard cut |
| No-repository empty state | a chapter that needs git (Workspaces) shows a `.mx-empty` with a 32px `.mx-mark` branch icon in place of the generic dot, a title, one hint line and an "Open project" button; no action initializes a repository |
| WIP chip and page seal | shown only in dev builds, through `showWip` (`import.meta.env.DEV`); production hides both while the `wip: true` flags stay. The isolated dev app shows them |
| WIP chip (light) | `rgba(28,46,65,.05)` fill, ink `#4f3a14` |
| Light chrome text | toolbar labels, sidebar and tab text `#333c48`, icons ≥3:1 on the brightest glass band |
| Chapter column | `min(1020px, calc(100% - 72px))`, padding 52px top and 72px bottom |
| Chapter header | eyebrow, 4xl title, optional subtitle; primary action top right (`align-items: flex-start`) |
| Card | radius 10px, padding 19px 20px 18px |
| Segmented control | group padding 3px, gap 2px, radius 6px; segments 26px tall, padding 0 11px, 11px text |

## 7. Components

- **Buttons.** Primary: `--mx-primary` fill, white text, one per view. Secondary: no fill until hover, then
  `--orchestra-surface-hover`. Destructive: `--orchestra-danger` text, fill only on confirm.
- **Tabs.** The close button shows only on hover or for the active tab. A single seam between stacked surfaces.
  The active tab is a chrome glass plate (glass tint, border, shadow and filter) inside the strip.
- **Breadcrumb.** The window breadcrumb names built-in views in Title Case, the same words as the sidebar
  (Home, Agents, MCP Dock, Workspaces, Settings).
- **Text areas.** `.mx-field textarea` uses the sans body at md, line height 1.6. Only text areas for code,
  commands, JSON or env values (`spellcheck="false"`) switch to `--mx-mono` at sm, line height 1.65.
- **Panel controls.** Browser and Linux panel toolbars (MCP Dock) use `@orchestra/ui/icon` icons at small size,
  never Unicode arrows or box glyphs. Star toggles and the A-/A+ zoom stay text.
- **Lean summary.** Four equal tiles (`repeat(4, minmax(0, 1fr))`, gap 24px, top aligned), each value 3xl in
  `--mx-strong` with -0.04em tracking; no divider between tiles. Its empty state is `.mx-empty` stripped of its
  well (no border, fill or shadow) because it already sits in a card.
- **Cards.** No footer divider. Empty states never sit in a hero-number slot. `.mx-card` is a flat
  `--mx-raised` fill with `--mx-card-shadow` (a 1px contact shadow plus a soft 22px drop). Hover
  or focus inside firms the border to `--mx-rim` and swaps the drop for `--mx-pop-shadow`; cards never move.
- **Status chips.** `.mx-badge.good` and `.bad` carry a 5px dot and a 9% wash of their own color, no border.
  Neutral badges keep the `--mx-line` hairline.
- **Empty, error and loading states.** One shared well, `.mx-empty` (`chapters/kit.css`): padding 30px 24px 32px,
  1px solid `--mx-line` hairline, radius lg, a `--mx-soft` top gradient and the highlight rim, centered text. A 30px
  mark (radius md, dot and ring) sits above a `<strong>` title (md, emphasis, 600), then the hint (sm, dim) and at
  most one `.mx-btn` 14px below. `role="alert"` tints border, fill and mark with `--mx-bad`. Never a dashed box.
  Inside a dashboard card (Home) the empty slot is `.home-first`: left-aligned title, 46ch hint, primary button.
- **Chapter header.** Every chapter opens with `MxPage`: eyebrow `{{profile}} · Area` (always the middle dot,
  never a slash), an h1, one short sentence and at most one primary action on the right. Search follows in
  `.mx-toolbar` as `.mx-search` with a placeholder and the same text as `aria-label` (no visible label), the profile
  badge beside it. On WIP chapters the seal sits above the page and the page gives back its height (top padding
  14px), so the eyebrow lands at the same height (117px in the dev app) with or without it.
  Chapters that build their own page (Settings, Workspaces, Agents, the CI/CD library) use the same kit markup:
  `header.mx-heading` holding a `div` with `.mx-eyebrow`, the h1 and the sentence, then the action. The eyebrow
  appears once per view: a breadcrumb shows only on contextual pages, never above a chapter's own eyebrow.
- **Sidebar overflow.** The chapter list scrolls under a fade mask (8px top, 32px bottom) with matching block
  padding, so no entry is clipped flat against the chrome. Composer chips (28px) name a mode in one word; the full
  sentence lives in the picker.
- **Dialogs.** Float glass over the scrim, radius xl, title 2xl. The head is flat, the foot a
  `--mx-soft` wash, and the frame sits on `--mx-shadow` with no glint. The head's close icon is a 28px rounded
  square (radius sm, `--mx-dim`, `--mx-soft` on hover), so its focus ring is not a tight box around the glyph.
- **Row actions.** In a dense list (Flight Engineer meeting detail) a row's text actions fade in on hover or
  focus-within through opacity. They stay in the DOM and keyboard reachable, and stay visible on devices without
  hover. A state chip never repeats the value a segmented control on the same row already shows.
- **Inbox.** A standalone primary destination at `/orchestra/inbox`, not a meeting tab. The chapter column is
  at most 1240px, with 40px top / 28px bottom padding. One split surface: a 380px attention list, a single hairline,
  and an item/action pane with 32px padding. At 1000px container width the list is 320px and pane padding 24px;
  below 740px show either list or selected item with a back action. Rows use 18px padding (12px compact), source
  marks 22px and person initials 42px. The item pane shows only the ingested snippet, never conversation history.
  Everything / Messages / Notifications are event-kind filters; Needs you / All items is an independent attention
  filter. A provider can contribute both kinds. Contacts are neither messages nor notifications. Tab counts follow
  source and search filters. Messages foreground the person, circular initials and the reply. Notifications foreground
  the event title (24px), affected work, a square 42px event mark, and one contextual primary action: review PR/MR,
  inspect checks/pipeline, open issue/card/decision/deliverable, view release, or watch video. The source-aware primary
  action can also be an item-id handoff for a known commitment; the Board, channel updates, calendar and contact doors
  never offer a handoff. The source catalog is at most 780px, in three columns (two below 640px, one below 420px),
  grouped into conversations, work, updates and external contacts. Each card describes provider capabilities and
  restrictions; choosing a preview card filters samples, never connects an account.
  Quick actions, preferred next move, density and previews are local presentation preferences; credentials live
  behind Sources, not on the inbox canvas. Reply opens a composer, review freezes text and recipient, and only a
  second explicit click sends. No fabricated priorities, timestamps, unread counts or connected-source claims.
  `?preview=inbox` is development-only: fixtures and richer event metadata do not extend the storage/API contract;
  preview sends, drafts and triage never call inbox routes. Newly proposed integrations remain mock-only.
   The information architecture stays fixed. On 2026-11-06 the owner rejected the overly transparent, flat finish
   and requested density, volume and a visibly floating modal; the earlier visual approval is superseded.
   The split frame now has a 90% `--mx-modal` content fill over the existing chrome plate, without another blur.
   Its list well mixes 64% modal with the existing surface; selection fades from `--mx-enabled` into `--mx-soft`.
   A contact shadow (2px/4px) and broad 18px/42px shadow with -14px spread separate the frame from the canvas.
   The reading pane retains a tonal wash and the next-action area one seam rather than another bordered box.
   Catalog cards use the Board's lg radius, 18px/16px padding, 12px gaps and denser tonal fill. Source-account
   choices use the same raised material with 8px gaps. A local top rim (12% text dark, 94% float white light),
   inset lower shade and two drop-shadow scales give the cards thickness; hover broadens the drop without
   movement or another backdrop filter. Source glyphs
  have no nested square frames: catalog marks are 28px with 22px glyphs; list marks retain 22px. Brand silhouettes
  are bundled locally from Simple Icons (CC0), not approximated with generic symbols or downloaded at runtime.
  Header Sources and Customize are icon-only 34px controls with localized accessible names and tooltips, quiet
   until hover. Dialogs retain Orchestra's shared float blur (40px) and scrim, xl radius and a denser local fill:
   dark top 92% modal / 8% text, bottom 96% modal / 4% transparent; light top uses the existing 98% float surface.
   Contact (4px/8px), mid (24px/64px) and broad (48px/100px) shadows plus upper/lower edge lighting establish
   a distinct floating plane. Height is capped at min(820px, viewport minus 96px) to leave visible separation
   around the modal; its body scrolls and footer remains available. This overrides DialogV2's generic frame.
   A 12px bottom fade finishes the body. No global glass/shadow token or blur architecture is changed; palette
   output is regenerated from the source stylesheet, never edited by hand.
- **Focus.** A visible ring in `--orchestra-accent` on every interactive element (`hit-areas.spec.ts` pins it).
- **Clipping.** Anything cut off gets a fade mask, never a hard edge.

## 8. Content rules

- Every visible string goes through i18n (about 40 locales).
- No raw ISO timestamps in titles; counters must match their lists; no infinite skeletons.
- Some text looks like a bug but is pinned by tests; leave it alone:
  - "Status unknown · unknown" (`session-tasks-truth.spec.ts`).
  - A Tasks badge of 0 beside finished tasks (`session-cockpit.spec.ts`).
  - Home's "No repository" and "Not connected" (`chapter-kpis.spec.ts`).

## 9. Verification

- Look at the real app in dark and light; zoom to 2× to judge rims, grain and hairlines.
- Rerun the palette generator after any color, glass or overlay change; the palette test compares its output.
- e2e specs that freeze visuals:
  - `e2e/orchestra/identity.spec.ts` (glass fingerprint, 10px radius).
  - `hit-areas.spec.ts` (focus outline).
  - `regression/new-session-panel-corner.spec.ts`.

  When a value changes on purpose, read the new computed value from the live app and paste it in.

## 10. Sucafina first-wave chapter presentation

The user rejected the first presentation. This second composition remains limited to native UI29 (Today), UI33 (Cases) and CAP01 (Executive). The native shell, palette mechanics and font assets remain unchanged. Source geometry is listed below; real capture coverage and limits belong in `docs/qa/sucafina/design/VALIDATION.md`. Implementation and passing tests do not establish user design acceptance.

- Common frame: the explicit `data-sf-wave` marker scopes a 1160px maximum content width, shared 32/24/16px gutters, 12px/40px vertical page padding and a 24px header gap. The eyebrow reads Sucafina through i18n. Native Context and access actions use the existing DropdownMenu primitive on these three routes only; all original action handlers and admission gates remain.
- Typography: native md body (13px), sm secondary copy (12px), lg record headings (14px), xl section headings (16px), 3xl values (24px) and 4xl desktop titles (30px). At the narrow frame titles use 3xl. Monospace is reserved for identifiers and code. Panels use the native `--mx-raised` material without another blur or custom color palette.
- Today: forecast is a three-value band with source disclosure on the heading row, followed by independent 1.55:1 work columns. Attention and case resumption occupy the main column; risks and routines occupy the side column. Panels use 20px padding; attention metadata stays inline when space permits. The stacks become one below 767px, with the side panels adjacent until 479px. At 479px, forecast becomes label/value rows and resume actions use the full width. Provenance and authorship explanations are accessible disclosures; meeting/material-change absence stays visible.
- Cases: one list surface contains the title/count, compact 360px search and labeled refresh control. Identity is primary; the complete reference is in a native disclosure. The creation surface is at most 760px, with a two-line objective, dates/currency in a three-column row and full-width criteria. Editing and review occupy separate stages while the list is hidden. Collapsing hides the editor without unmounting its draft; Resume draft restores focus and values. Only a confirmed instance is discarded when returning to the list, enabling the next new case. An unknown outcome can return to the list for read reconciliation while retaining its mounted instance and recovery marker; an in-flight send stays fenced.
- Executive: period controls form a compact toolbar. Financial values and their ledger share one surface; source totals are disclosed without new calculations. Delivery/Security and People form two columns with label/value rows; Operations uses paired rows. Explicit CAP01 resets isolate these records from shared four-column metric rules. Missing metrics retain explicit machine state, accessible source-absence text and a visible common legend. Native definition elements expose the absence as content rather than an author-supplied accessible name. Tables retain 480px/740px minimum readable widths inside named keyboard-focusable scrollers. Review occupies the editor's full row while its input controls are hidden; cancel restores the existing editor.
- Controls and reflow: inputs and actions retain a 44px minimum block size. Native radius and 2px focus roles remain. CAP01 source navigation uses a horizontally scrollable underline strip on the same 1160px axis, with unchanged owner-bound destinations. Local tables may scroll; the document and page must not overflow.
- Isolation: page CSS roots at `.sf-today`, `.sf-cases`, or `.sf-u02-page[data-sf-surface="CAP01"]`; common frame rules require the wave marker, and navigation requires active CAP01. Other native chapters and the legacy interface are outside this redesign. The previously verified shared-editor `untrack` repair and CAP01 count-only presentation remain; CAS, reads, grants, values and write confirmation are preserved.

Actual 320/390 CSS-pixel reflow is not reported as browser zoom. User acceptance and golden-image approval remain separate from implementation and test evidence.


## 11. Sucafina second-wave chapter presentation

The next approved scope is native CAP02 (Hot Topics), CAP03 (Budget Overview) and CAP04 (OPEX). This is an implementation candidate; user design acceptance remains separate. It reuses section 10's explicit wave frame, typography, native raised/soft materials, 44px controls and Context and access menu. No global palette, glass, font asset or shell geometry changes are introduced.

- Hot Topics: one list surface aligns action/priority, owner, status and due date. Filtering and refresh share the list header; New topic is the list primary action. Below 979px the table becomes labeled records, with further stacking at 767px and 479px. The detail separates title, four metadata fields and notes; source/version/history are disclosures. The editor has a 760px maximum, a two-line action field, paired metadata fields and full-width notes. Review is a dedicated stage; cancellation or revision restores fields and focus. Delete review replaces the ordinary detail content until canceled.
- Budget Overview: a compact 170px period selector and source disclosure precede a single financial surface. Three 24px values and the OPEX/CAPEX ledger share that surface. Source totals remain explicitly unscoped; selecting a year never relabels them as annual totals. Missing annual values retain accessible absence text and one visible explanation. Source period is selectable again through the same owner-bound period navigation. Two annual readout panels expose current-month/revenue editors in native disclosures; review spans the annual band while the mounted fields are hidden. Panels use 20px padding and 16px gaps. The annual band stacks at 620px and review actions stack at 420px. The ledger keeps a 480px minimum inside a named keyboard-focusable scroller.
- OPEX: one list surface uses 20px padding and a 360px search. Currency absence is disclosed once. Selecting a line gives its detail the full canvas while the list remains mounted. The detail separates identity, annual budget, monthly ledger, source disclosure and annual adjustments. The ledger has an 860px readable minimum, becomes labeled monthly blocks below 620px, and preserves exact source values and explicit absence. Editor/review stages have a 760px maximum and 44px controls; fields and review actions stack below 420px. The detail header stacks below 767px. Native monthly command, draft, recovery and confirmation ownership remains in the existing controller.
- Isolation: CAP02 styles require the Hot Topics root; CAP03 styles require its Budget Overview root; CAP04 styles require `data-sf-budget="CAP04"`. Shared CAP01 and CAP05 presentations remain outside this redesign. Existing English catalog strings stay unchanged; Brazilian Portuguese uses the established finance and action vocabulary.
- Source navigation: the approved CAP01 underline strip is owned by the Sucafina source-navigation stylesheet and also applies when CAP02, CAP03 or CAP04 is active. The 1160px axis, 32/24/16px gutters and 44px targets are unchanged. On narrow layouts the strip scrolls horizontally and reveals the current destination after navigation or resizing. Original links and owner-bound admission remain unchanged; CAP05 retains its previous navigation.
- Verification: the permanent second-wave journey uses a genuine isolated installation and original producers. Real captures, current-source type checks, repository guards, palette parity and explicit limitations are recorded under `docs/qa/sucafina/design/wave-two`. Narrow CSS reflow is not actual browser zoom, and passing checks do not approve a golden baseline.


## 12. Sucafina third-wave chapter presentation

The third wave covers fifteen native inventory areas, CAP05–CAP19, across 56 registered route patterns. It starts from dev `acc0181508ceda7416bce57284b2307a9b20385b` on `sf-design-fifteen`. The six previously accepted areas remain part of the campaign history. Implementation, runtime verification and user design acceptance are distinct statuses; the current evidence and limitations belong in `docs/qa/sucafina/design/wave-three`.

- Shared frame: the existing wave stylesheet is loaded by the shared native frame. Only an explicit `data-sf-wave` marker activates its geometry. The 1160px maximum, 32/24/16px gutters, 12px/40px vertical page padding, 24px desktop header gap, native type scales and 44px controls remain unchanged. The compact Context and access menu and owner-bound source navigation now cover CAP01–CAP19. Navigation uses the same content axis, preserves the original chapter destinations and reveals the active item on narrow layouts. CAP20–CAP28 retain their prior presentation.
- CAPEX actuals and contracts: investment collections, monthly detail and contract terms have distinct reading and editing stages. Editors and confirmation stages use a 760px maximum. Native 20px panel spacing, labeled values and explicit source absence replace dense mixed reading/editing layouts. CAP05 monthly records reflow at narrow widths while financial values and the original monthly, deviation and annual commands remain unchanged. CAP14 terms are grouped by purpose; document and source links remain in their existing owners.
- People: CAP06 uses a single reported headcount band and a leader breakdown. CAP07 organizes CIO, leaders and members into a deliberate hierarchy, with searchable member records. CAP08 pairs the talent ledger with record detail and assessment editing. People forms group identity, employment and assessment, with notes spanning the grid. Detail, editor and review stages use a 760px maximum; small layouts use labeled records. Unavailable workbook bindings have specific explanations without a fabricated import, preview or download.
- Portfolio: CAP09 keeps the original project and milestone sources, with a compact filter area and a source disclosure. CAP10 uses its native list/detail owner to give the current stage the full canvas. Project reviews show source and proposed values while the existing draft remains mounted. Milestones have their own editing disclosures and record-specific confirmation. Local table scrolling remains named and keyboard reachable.
- Operations: CAP11 presents SLA measures in one band and transposes the ticket ledger into category/type rows with the same three source measures. CAP12 groups reported security measures, campaigns and incidents without inventing a period for unassigned actions. CAP13 and CAP15 give the list, detail, editor and confirmation their own stages. CAP16 presents objectives and subitems with their original weights, owners and quarterly measures. Forms use native spacing and bounded review stages; all calculations and warnings remain producer-owned.
- Planner: CAP17 presents version selection, source metrics, monthly series and comparison in a coherent reading order. CAP18 and CAP19 retain their version-bound lines, projects, twelve-month grids, editors, reviews, paste, closed-month and split behavior. Numeric absence remains distinct from a source zero; no currency, exchange rate, total or approval is fabricated by presentation.
- Isolation: each group scopes its styles to its existing native root and a CAP05–CAP19 marker. Shared controllers, source contracts, access grants, owner fencing, CAS, idempotency, pending/unknown recovery and receipt semantics remain authoritative. Existing English keys and text remain unchanged; new copy includes Brazilian Portuguese. Global shell geometry, palette mechanics, glass and font assets remain unchanged.

The grouped production journeys passed for all fifteen areas: 88 distinct functional states were exercised, 79 received dedicated screenshots and 177 actual JPEG captures were preserved. Eleven native writes were confirmed with source readback. The six earlier accepted areas also passed the regression after shared grid changes. Final types, repository guards, palette parity and targeted CAS/DTO checks are recorded in `docs/qa/sucafina/design/wave-three/VALIDATION.md`; exact state/capture mappings and limits live in the adjacent scope and evidence manifests. The user authorized integration conditional on green checks. The composed-candidate verification is recorded in `docs/qa/sucafina/design/wave-three/MERGE.md`; PR #587 records the merge state and commit. No golden-image baseline approval is inferred. Narrow CSS reflow is recorded separately from actual browser zoom.

The final presentation fixes preserve the existing command and draft owners: source integer CAS versions are admitted correctly, optional DTO values are materialized without undefined fields, and keyed review content retains its draft reference while a confirmed save changes the view. Applied risk/stakeholder filters select only already-authorized rows. Monthly grid keyboard reveal measures the two existing sticky columns before scrolling the selected cell into view. These are scoped repairs of observed behavior, with no changes to source producers, schemas, access controls, generated palettes or global shell geometry.


## 13. Sucafina fourth-wave chapter presentation

The fourth wave covers CAP20–CAP28, UI30–UI32 and UI34–UI41: twenty inventory areas and 49 registered route patterns. Work is isolated on `sf-design-twenty`; scope and verification status live in `docs/qa/sucafina/design/wave-four`. Implementation does not establish runtime verification or user visual approval.

All CAP01–CAP28 and UI29–UI41 destinations now share the established compact Context and access presentation. The source navigation strip admits only the original 28 capability destinations and their existing owner-bound links. Its explicit polished marker activates the same 1160px axis, gutters, 44px targets, underline selection and keyboard focus roles; resize/navigation reveals the active item. The presentation change does not alter route admission or source availability.

Fourth-wave page roots opt into the existing frame using `data-sf-wave="four"`. Native fonts, role colors and quiet materials remain authoritative. Lists, details, editors and reviews use deliberate work stages; drafts stay mounted where existing controllers require them. Preserve absent source values, authorization, CAS, idempotency, recovery and confirmation semantics. Evidence, outstanding limitations and acceptance will be recorded after the grouped real installed journeys.

## 14. Sucafina fifth-wave chapter presentation

The fifth wave is scoped to UI42–UI56: fifteen native inventory areas and 22 existing route patterns. The isolated branch is `sf-design-next`; the scoped ownership and current verification state live in `docs/qa/sucafina/design/wave-five/scope.json`. Previous-wave user approval does not establish acceptance for these fifteen areas.

Selected page roots opt into the existing `data-sf-wave="five"` geometry. The compact Context and access menu now applies to UI29–UI56 and the unchanged CAP01–CAP28 set. Original handlers, owner fences and access admission remain unchanged. The 1160px axis, 32/24/16px gutters, native type/material tokens and 44px controls are reused; no new global glass, palette, font or shell geometry is introduced.

Scenario, sensitivity and BI presentation remains bounded by original result/model availability. Review, collaboration and import presentation preserves canonical source versions, retained drafts, explicit unavailable states and original confirmation ownership. Imports UI57/UI68 share code with this wave but remain outside its presentation scope. Real browser evidence and final visual details will be recorded after qualification.


## 15. Second interface refinement pass

The second pass after PR #710 refines the existing visual system. It preserves the native palettes, quiet glass, blur architecture, type scale, source identities, labels and command owners. The issue ledger and original-capture evidence are recorded in `docs/qa/sucafina/visual-audit/ROUND-TWO.md`; PR #715 records the final verification and merge receipt.

- Home: KPI tiles become one column at viewport widths up to 479px so absence states and numeric values keep their reading space. Footer provenance and actions also stack at phone widths, so long localized labels keep their full width. The existing two-column 700px layout remains. "No repository" and "Not connected" keep their original copy and source meaning.
- Record details: Back has a start-aligned 44px target on its own line. The record heading, identity/status and action group share a wrapping summary row, with 16px spacing. CAP10 retains its local spacing and stacks this summary in the existing narrow container mode.
- Comfortable data tables: sort controls use the same 44px minimum block size as row actions. The header adds 4px vertical padding for the existing focus ring. Compact density, row identities, sorting cycles, selection and scroll ownership are unchanged.
- Procurement settings: below 620px, the seven section links form one horizontally scrollable, keyboard-focusable strip. Labels stay complete, controls retain a 44px minimum and the original fragment destinations remain authoritative.
- Reviews and reports: comparison sections use the existing section rhythm. Report coverage and selection use labeled metadata; the complete preserved-review identifier remains in a native, keyboard-operable disclosure with a 44px summary target.
- Proposal and administration sections: UI54 uses native line, raised and soft roles instead of legacy fallback colors, with the established section spacing. UI69 separates its form and current-source action inside the existing state content.
- Failure and destructive states: after a failed Skills save, the prior control is restored only while it remains inside the open dialog and the document body is active; other active controls remain untouched. Provider Disconnect uses the existing danger role while retaining its confirmation and credential-removal flow.

These are presentation and focus refinements. No producer, admission rule, public schema, financial value, currency, CAS, recovery policy or Microsoft integration is introduced by this pass. Evidence for CSS reflow remains distinct from actual browser zoom and from owner visual acceptance.


## 15. Third interface refinement pass

PR #716 refines Settings, provider dialogs, Planner native selects and Decisions presentation. The issue ledger, original-capture provenance and change-scoped validation are in `docs/qa/sucafina/visual-audit/ROUND-THREE.md` and `round-three-runs.json`.

- Settings measures its available view/panel width with local size containers. Below 760px of view space, section navigation becomes a wrapping row above the body. Below 620px it uses 16px horizontal gutters, 28px top and 40px bottom padding, and 44px navigation targets. Below 520px of panel space, permission copy sits above three equal 44px choices; model logo/identity and model actions occupy separate rows. Wide layout and the native toggle proportions remain.
- Permission radios draw their 2px native focus outline inward so the clipped segment preserves all four sides. The five generated palette overrides use the same focus-width token; their navigation outline stays 1px. Keyboard order, locked rules and the ordered save payload remain unchanged.
- The provider connection dialog uses native radius xl (16px), title 2xl (20px), 28px Back/Close targets and a 2px visible focus ring. Title height is natural. Local spacing variables add no material, blur, shadow or palette. Expected cancellation of a superseded provider-bootstrap query produces no failure toast; ordinary errors retain the existing notification and missing-directory paths.
- Planner selects reserve 32px logical end padding for the native arrow. Full source options and values remain; a long option can still truncate in a narrow closed select.
- Decisions keeps Back to case at the start of its grid on Alternatives, Assumptions and Questions. Assumptions distinguishes the all-state choice and filtered-empty result through existing keys. Prepared changes and Receipts label the already-selected case with the existing Current case key.

These changes preserve native role colors, quiet glass, typography, source identities and command owners. The final composed structural gate and merge receipt will be indexed in PR #716 after completion.
