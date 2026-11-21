# Wave four — twenty native Sucafina areas

Status: **IN_PROGRESS**. User instruction: “a outra sessao esta mergeando o que ja tinha feito. Preciso que voce pegue o proximo bloco de 20 pra fazer”.

Branch `sf-design-twenty` starts from `dev@2a68bcb676ed0c159c5c48130c2413e0e5637a00`. The separate session owns the merge of PR #587. Its fifteen areas are outside this implementation's ownership. The isolated candidate composes the exact prior-wave dependency `f6da3aaf613053309ea205786eabae11eb394c6c` while that merge is owned by the other session. PR #587 subsequently merged as `d9ab14b6d9cab74843b0689d5d67d1c70d45cc02`. This candidate now incorporates that real dev merge, preserving its final documentation and Finance response-observation fix. No changes were made to the other session’s branch.

## Exact scope

The next twenty previously unredesigned inventory areas are CAP20–CAP28, UI30–UI32 and UI34–UI41: **20 areas / 49 registered route patterns**. Routes, states, captures, acceptance and merge are separate measures. The earlier 21 areas plus this implementation will total 41/70, leaving 29 areas; that future count is not a completion claim.

| Owner | Branch | Areas |
| --- | --- | --- |
| Planner and work | `sf-twenty-planner` | CAP20–CAP23, UI30–UI32 (7 areas) |
| Procurement | `sf-twenty-procurement` | CAP24–CAP28 (5 areas) |
| Decisions | `sf-twenty-decisions` | UI34–UI41 (8 areas) |

- **CAP20 — Headcount**: `/orchestra/sf-planner/headcount`
- **CAP21 — Alocações**: `/orchestra/sf-planner/allocations`
- **CAP22 — Câmbio / FX**: `/orchestra/sf-planner/fx`
- **CAP23 — Versões e comparação**: `/orchestra/sf-planner/versions`
- **CAP24 — Compras — visão geral**: `/orchestra/sf-procurement/overview`
- **CAP25 — Requisições, fila e sourcing**: `/orchestra/sf-procurement/requests`
- **CAP26 — Aprovações**: `/orchestra/sf-procurement/approvals`
- **CAP27 — Fornecedores**: `/orchestra/sf-procurement/suppliers`
- **CAP28 — Configurações de compras**: `/orchestra/sf-procurement/settings`
- **UI30 — Meu trabalho**: `/orchestra/sf-work`
- **UI31 — Busca Sucafina**: `/orchestra/sf-home/search`
- **UI32 — Visões salvas**: `/orchestra/sf-work/views`
- **UI34 — Intenção do caso**: `/orchestra/sf-decisions/:caseRef`
- **UI35 — Alternativas**: `/orchestra/sf-decisions/:caseRef/alternatives`
- **UI36 — Premissas e divergências**: `/orchestra/sf-decisions/:caseRef/assumptions`
- **UI37 — Perguntas e respostas**: `/orchestra/sf-decisions/:caseRef/questions`
- **UI38 — Escolha da decisão**: `/orchestra/sf-decisions/:caseRef/choice`
- **UI39 — Alterações preparadas**: `/orchestra/sf-decisions/:caseRef/changes`
- **UI40 — Histórico e recibos**: `/orchestra/sf-decisions/:caseRef/history`
- **UI41 — Análises**: `/orchestra/sf-decisions/:caseRef/analyses`

The machine-readable scope is [wave-four/scope.json](wave-four/scope.json). Root owns shared frame/navigation integration, shared installation/harness, E2E type coverage, consolidated evidence and inventory. Workers own only their enumerated page subtrees, page styles, coordinated catalogs, group journey files and group reports. Shared files have a single writer.

## Design contract

Use `.claude/skills/orchestra-design-system/SKILL.md`, `.claude/skills/orchestra-visual-qa/SKILL.md`, app AGENTS and current `packages/app-shell/src/orchestra/DESIGN.md`. Current quiet-glass and approved Sucafina specifications override old generic material guidance. Keep native fonts, roles, geometry and theme architecture; use the 1160px axis, 32/24/16px gutters, 44px controls, 20px panel rhythm and focused editor/review stages. Compose each destination around its work, with clear list/detail/edit/review boundaries, source honesty and useful narrow records or named keyboard-scrollable ledgers.

Preserve original routes, owner fencing, source values, provenance links, grants, CAS, idempotency, drafts, pending/unknown recovery, explicit confirmations and receipts. Do not manufacture currency, totals, absence-as-zero, approval or permissions. Existing English keys/text remain unchanged; any new copy has English and Brazilian Portuguese. The legacy white/green console and HuGR native core remain outside scope.

## Verification contract

All repository operations use GitHub MCP. No shell, local builds/tests or owner-machine runtime. Execute scoped snapshots through the existing test-ci Actions workflow; do not run sf-ci, apply epic labels or change workflow/guard mechanisms. Use real isolated native installations, original enrollment and canonical producer commands. No mocked authentication, grants, business responses or receipts.

Exercise all twenty areas and meaningful lists, details, editors, reviews and special states. Capture actual dark/light, Portuguese and narrow application output, inspect screenshots and fix observed faults. Distinguish CSS reflow from actual browser zoom and state explicitly what was not exercised. Verify application/E2E types, guards, palette parity and preserved English copy. Runtime/source defects must be repaired at their actual boundary without hiding failures.

Current implementation, runtime, visual review and acceptance are **not yet complete**. The final report will cite exact source commits, Actions runs, state/capture maps and unresolved limits.
