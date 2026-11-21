# Current native design integration

## Candidate

Status: **APPLIED_TO_ISOLATED_BRANCH_AWAITING_RUNTIME_AND_VISUAL_VERIFICATION**.

The user confirmed `dev` as the source and asked to see the finished three screens. The existing branch `sf-design-polish` retains its direct origin at dev `948fab6ef2f8bbbcf2c8a6b787755a1d5713e6e1`.

The current dependency chain is:

| Dependency | Exact head | Base |
| --- | --- | --- |
| [#572 · native Web contracts and transport](https://github.com/gustavomhss/Orchestra-SF/pull/572) | `4aa86a2ce41c9689b218ec0ceb462cf39242be08` | dev `b5297b938735eab8ae37a686f01015f37c727724` |
| [#573 · native Web shell](https://github.com/gustavomhss/Orchestra-SF/pull/573) | `a22e4296bfa802b70597fc73485d1833658cced4` | #572 |

Both PRs were open drafts at inspection. Their branches, PR metadata and dev have not been modified. The design candidate composes #573's exact tree, which includes #572 and current dev, with the existing design documents and the seven first-wave presentation files. Its ancestry records the original work branch and the current dependency head.

This supersedes the previous application blocker for this isolated candidate. It does not mean that the dependency PRs have merged or that the design has passed visual acceptance.

## Applied design scope

- UI29: `home/index.tsx` and new `home/today.css`.
- UI33: `decisions/cases/index.tsx`, presentation markup in `create.tsx`, and new `cases.css`.
- CAP01: `dashboard/executive/index.tsx` and new `executive.css`.
- The shared design reference records the local source measurements. Actual rendered values and contrast remain to be checked.

Paths above are relative to `packages/app-shell/src/orchestra/chapters/sucafina/`. Shared `n24.css`, `u02.css`, `edit.tsx` and the Budget page remain unchanged. No native HuGR screen or legacy console receives a design edit.

All 70 inventory entrypoint blobs match the current #573 tree `76c9b3a151d9d8e1f4a8dbdc7e986fdfae93ae4a`. The route registry remains `6e1e711e2ff3a95e460026053cb91772693da572`. Each first-wave patch was replayed with exact hunk positions, context and removals against #573.

## Rendering and verification route

The real native app must be served from the installed local operator's public origin. A separate Vite origin cannot satisfy the transport's origin contract. The existing `apps/cli/test/sucafina-native-web.test.ts` builds the Web app into a temporary directory, serves its actual bytes through the installed CLI and verifies authenticated native discovery/context.

The dependency's linked [run 44876426416](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44876426416) passed that smoke test on its own composed SHA. It did not launch a browser and is not evidence for this design candidate.

The next check uses the same existing hosted workflow, scoped to the installed native Web test. Real browser capture will use a narrow Playwright spec and the existing authorized production config, with an actual local installation, enrollment and owner descriptor. Screenshots must contain the true rendered UI29/UI33/CAP01 state. No workflow allowlist, authentication gate or legacy route will be substituted.

## Current results

| Gate | Current status |
| --- | --- |
| Current native source/branch ancestry | Verified through GitHub |
| Unified patch replay against #573 | Exact for all seven product files |
| Application to isolated candidate | Applied |
| Current-candidate native Web build/context smoke | NOT_RUN |
| Current-candidate package typecheck / guardrails | NOT_RUN |
| Native browser interactions / screenshots | NOT_RUN |
| Actual dark/light, narrow/zoom and contrast review | NOT_RUN |
| Palette generator/parity | NOT_RUN |
| Visual acceptance | NOT_RUN |
