# Native Sucafina sidebar — planning brief

Status: PLANNING ONLY. No implementation or runtime operations authorized by this brief.
Requested by the user in this campaign thread after identifying the independent SF HTML shell.
Product base: 8274e3fe307a5046b7802d6651b0d21fc4f8cbb7 on sf2-stack / PR65.
Canonical campaign plan: dbf9547211d9b0fade619790de7c19c0869b7c7d.
Original scope, T0 and GLOBAL_RELEASE requirements remain intact.

## Required product direction

Sucafina areas must appear as real native destinations in Orchestra's sidebar, in the same navigation system as Inbox, Chat and the existing chapters. Plan named business modules such as Dashboard, Planner and Procurement and all other planned SF areas. Propose exact grouping/order/labels for the complete inventory; do not replace this request with just one external Sucafina link or an isolated landing page.

Use the existing Orchestra shell, SolidJS chapter lifecycle, design-system components, tokens, themes and i18n. No iframe, embedded standalone HTML, second sidebar, independent app window or cosmetic CSS-only conversion as the target solution.

Reuse existing domain logic, persistence, authorization, financial rules, C08 receipts and native contracts. Do not duplicate engines or claim current native runtime proof where none exists.

## Existing connection points inspected by S0

- packages/app-shell/src/orchestra/navigation.ts — primaryNavigation, advancedNavigation, settingsNavigation.
- packages/app-shell/src/orchestra/chapter-route.tsx — chapterPages, lazy routes, ChapterPageProps server/directory ownership, suspense and providers.
- packages/app-shell/src/orchestra/sidebar.tsx — consumes navigation/chapterPages.
- packages/app-shell/src/app.tsx — common app/router/theme/i18n/provider composition.
- packages/app-shell/AGENTS.md — native UI, i18n and runtime constraints.
- modules/sucafina/Sucafinav1/src/screen-shell.ts — existing independent HTML/CSS layer to migrate.
- modules/sucafina/Sucafinav1/index.ts and runtime/application.ts — current domain composition.
- apps/cli/src/sucafina-product/installation.ts and modules/sucafina/Sucafinav1/local/entry.ts — current HTTP/runtime mounting.
- Microsoft login source PR69 is integrated in the current stack; preserve its session/privacy/access boundaries.
Inspect latest source and consumers; these paths are anchors, not a complete architecture proposal.

## Required planning output

Commit a reviewable plan and open a draft PR from sf-sidebar-plan to sf2-stack. Suggested folder: modules/sucafina/Sucafinav1/docs/sf2h/native-ui/.
Include:
1. Complete current/planned screen inventory, native sidebar mapping, routes and navigation state.
2. Concrete target composition using actual existing registries/components and user-facing navigation examples.
3. Authenticated API/client seam, per-principal/role/surface authorization and server/project selection; data must come from domain services, never scraped rendered HTML or privileged snapshot dumps.
4. Migration strategy preserving all behavior, deep links, accessibility, loading/error/access-loss states, ongoing writer work, Microsoft/B2B and standalone URL compatibility where needed. Existing standalone entry is not the final native UI.
5. Typed shared contracts and anchors, paths/owners, disjoint implementation slices and DAG; identify true shared registry/API changes and an integration owner. Freeze a concrete seam before dependent UI dispatch.
6. Validation plan: native navigation and representative real business journeys, same Orchestra themes/components, responsive/keyboarding, authorization negatives, existing regression retention and hosted CI only.
7. Traceability back to all 15 WPs/74 tasks/1610 criteria, detailing which UI obligations migration affects. Do not copy or rewrite immutable sf2h-plan; record an operational adaptation separately.
8. Honest sizing and dependencies, parallel sessions that can really work independently, blockers and explicit decisions needed. No unsupported hours/percentages or declaration of completed implementation.
9. Acceptance for native-module parity, not screenshot-only similarity; preserve final campaign gates.

## Limits

Read applicable AGENTS and the native UI source before planning. Reconcile product/integrator handoffs, especially successor57, without touching their branch or taking authority. No third-party messages; coordinate through repository handoff.

Only planning documents on sf-sidebar-plan may be written. No application, API, schema, auth, tests, workflows or financial policy edits. No tests, servers, restarts, deploy, Azure changes, merges or new workers/controller in this planning session. GitHub MCP only for remote repo operations, CAS and conventional commit/PR title. Do not infer another writer is dead from silence.

The user requested this plan to review before implementation. Deliver the plan, PR URL, SHA and concise recommendation; do not start implementation.
