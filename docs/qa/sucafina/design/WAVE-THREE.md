# Wave three — fifteen native Sucafina areas

Status: **IMPLEMENTED_VERIFIED_PENDING_USER_REVIEW**. User instruction: “Otimo. Pga maos um bloco grqnde 15 ai e manda bala com seus agents”.

The requested fifteen-area candidate is implemented on `sf-design-fifteen`. Final product: `e378923d7619c168b2d7b2c82b1232449eca2c45`. Review: [PR #587](https://github.com/gustavomhss/Orchestra-SF/pull/587). The branch starts directly from dev `acc0181508ceda7416bce57284b2307a9b20385b`.

**Review the [177-image gallery](wave-three/evidence/README.md), [verification](wave-three/VALIDATION.md), [integration record](wave-three/INTEGRATION.md) and [exact state map](wave-three/scope.json).** These are actual native application captures from isolated canonical test data. New visual acceptance remains pending; this wave has not been merged.

| Group | Areas | Route patterns | Functional states | Pictured states | Captures |
| --- | ---: | ---: | ---: | ---: | ---: |
| People / portfolio | 5 | 18 | 28 | 28 | 58 |
| Finance / planner | 5 | 18 | 35 | 26 | 47 |
| Operations | 5 | 20 | 25 | 25 | 72 |
| **Total** | **15** | **56** | **88** | **79** | **177** |

The campaign now has six accepted/merged areas, fifteen implemented areas awaiting this review and 49 inventoried areas remaining. That is **21 of 70 implemented**, with acceptance and merge tracked separately. Screenshots, locale, theme and viewport variants do not increase the area count.

## Pinned start and scope

Integration branch `sf-design-fifteen` starts directly from dev `acc0181508ceda7416bce57284b2307a9b20385b`, which includes the accepted first two waves merged through PR #583. This wave covers the next 15 inventory items, CAP05 through CAP19: 56 registered route patterns. It does not count theme, locale, viewport or duplicate screenshot variants as additional screens.

The prior six areas and their 21 documented business views remain accepted. This wave's design acceptance and visual evidence are not inferred from that earlier approval.

| Area | Name | Worker group | Main route |
| --- | --- | --- | --- |
| CAP05 | CAPEX — realizado e previsão | finance | `/orchestra/sf-dashboard/capex` |
| CAP06 | Pessoas — visão geral | people | `/orchestra/sf-people/overview` |
| CAP07 | Estrutura e membros | people | `/orchestra/sf-people/structure` |
| CAP08 | Talentos | people | `/orchestra/sf-people/talent` |
| CAP09 | Portfólio — visão geral | people | `/orchestra/sf-portfolio/overview` |
| CAP10 | Projetos | people | `/orchestra/sf-portfolio/projects` |
| CAP11 | Serviço e SLA | operations | `/orchestra/sf-operations/service` |
| CAP12 | Segurança | operations | `/orchestra/sf-operations/security` |
| CAP13 | Riscos | operations | `/orchestra/sf-operations/risks` |
| CAP14 | Contratos | finance | `/orchestra/sf-procurement/contracts` |
| CAP15 | Stakeholders | operations | `/orchestra/sf-operations/stakeholders` |
| CAP16 | Desempenho operacional | operations | `/orchestra/sf-operations/performance` |
| CAP17 | Planner — visão geral | finance | `/orchestra/sf-planner/overview` |
| CAP18 | Planner OPEX | finance | `/orchestra/sf-planner/opex` |
| CAP19 | Planner CAPEX | finance | `/orchestra/sf-planner/capex` |

## Three real workers

| Owner | Branch | Assigned areas |
| --- | --- | --- |
| redesign_finance_five | `sf-polish-finance` | CAP05, CAP14, CAP17, CAP18, CAP19 |
| redesign_people_five | `sf-polish-people` | CAP06, CAP07, CAP08, CAP09, CAP10 |
| redesign_operations_five | `sf-polish-ops` | CAP11, CAP12, CAP13, CAP15, CAP16 |

Finance owns CAPEX, Contracts and the three Planner areas. People owns People overview, Structure, Talent and both Portfolio areas. Operations owns Service/SLA, Security, Risks, Stakeholders and Performance. Root owns common frame/navigation/access integration, installed-fixture seeding, shared browser support, Actions execution, final visual review and the consolidated inventory/evidence.

Workers own only their assigned page modules, page-scoped styles, owned catalogs and their group-specific journey/report files. Shared catalog ownership must be announced before editing. No worker may alter root's host/frame files, another group's modules, shared dev, workflows, guards, allowlists or the verified previous-wave semantics.

## Design contract

Read the repository's orchestra-design-system and orchestra-visual-qa skills, app AGENTS and current `packages/app-shell/src/orchestra/DESIGN.md`. The current quiet-glass specification and accepted Sucafina sections 10/11 govern older broad skill prose.

Use native type and tokens, 1160px content width, 32/24/16px frame gutters, 44px controls, coherent 20px panel rhythm and focused editor/review composition (usually up to 760px). Favor one readable surface for lists/ledgers, clear identity and numeric alignment, explicit source/absence and one primary action per active view. Keep editor drafts mounted through collapse/review where their controller requires it. Long tables need named keyboard-focusable scrollers or meaningful narrow records. No document overflow or clipped actions.

Preserve current source adapters, routing, owners, grants, CAS, idempotency, pending/unknown handling, receipts and source values. No fabricated totals, currency, permissions or status. Existing English keys and text are frozen; new visible copy needs English and Brazilian Portuguese. The legacy white/green console and native HuGR core remain outside scope.

## Delivery and verification

Each worker maps list/detail/create/edit/review and special states for all five areas, supplies actual source-seeding requirements and stable locators, and records unverified states honestly. Root integrates before the grouped scoped Actions runs. The grouped production journeys share a genuine isolated installation helper and canonical producer data, with dark/light desktop, Portuguese, narrow layout and meaningful interactions for each area.

All repository work uses GitHub MCP; no shell, local builds/tests or user-machine runtime. All execution is through existing scoped test-ci snapshots. Do not run sf-ci, add epic labels or change CI mechanisms. No mocks or synthetic authentication/grants. Runtime/source errors found during actual verification must be fixed at their source rather than hidden by tests.

Final evidence distinguishes areas, registered routes, distinct business views and capture variants. Passing tests do not establish user visual approval. User-facing screenshots and a complete gallery are required. The completed scope leaves 49 inventory areas for the next rounds. The remaining work is listed in the central inventory.
