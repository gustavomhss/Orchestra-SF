# Wave three — validation

Status: **IMPLEMENTED_VERIFIED_PENDING_USER_REVIEW**. This report covers native CAP05–CAP19 on `sf-design-fifteen`, created directly from dev `acc0181508ceda7416bce57284b2307a9b20385b`. Final product: `e378923d7619c168b2d7b2c82b1232449eca2c45`. The fifteen areas have not been merged or visually approved by the user. Earlier approval applies to the six areas already merged through [PR #583](https://github.com/gustavomhss/Orchestra-SF/pull/583).

## What the numbers mean

| Measure | People / portfolio | Finance / planner | Operations | This wave |
| --- | ---: | ---: | ---: | ---: |
| Inventory areas | 5 | 5 | 5 | **15** |
| Registered route patterns | 18 | 18 | 20 | **56** |
| Distinct functional states exercised | 28 | 35 | 25 | **88** |
| States with a dedicated capture | 28 | 26 | 25 | **79** |
| Actual JPEG captures | 58 | 47 | 72 | **177** |
| Capture variants beyond one per pictured state | 30 | 21 | 47 | **98** |
| Confirmed writes with source readback | 3 | 3 | 5 | **11** |

A registered route is scope, not a claim that every URL pattern was exercised independently. A business state is a list, detail, form, review or special workflow; locale, theme, width, scroll position, disclosure and repeated capture do not create another area or state. The [scope](scope.json) maps all states, and the [gallery manifest](evidence/manifest.json) maps captures to states and source runs.

The full inventory remains 70 areas and 165 route patterns. Six previously accepted areas plus this fifteen-area candidate make **21 implemented areas** and **49 still awaiting redesign**. The corresponding registered route scope is 69 implemented-area patterns and 96 remaining patterns. Only six areas are already merged; the other fifteen await this review.

## Real installed browser verification

All runs use the existing production Playwright configuration, a genuine isolated native installation, scoped operators and canonical producer commands. There are no mocked authentication, access grants, business responses or receipts. The photographs contain deliberately labeled isolated test data.

| Journey | Product | Actions run / job | Result | Captures |
| --- | --- | --- | --- | ---: |
| People and portfolio, EN + pt-BR | `741a05b4` | [44942301625](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44942301625) / 136961962626 | 2 passed, 3.9m | 58 |
| Finance and planner, EN + pt-BR | `68ad2eec` | [44947193512](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44947193512) / 136976981561 | 2 passed, 3.6m | 47 |
| Service and Security, EN | `68ad2eec` | [44947197315](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44947197315) / 136976994257 | 2 passed, 3.0m | 23 |
| Risks, Stakeholders and Performance, EN | `4402684c` | [44949738285](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44949738285) / 136984804316 | 3 passed, 4.1m | 24 |
| Operations, pt-BR | `4402684c` | [44949742205](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44949742205) / 136984816760 | 1 passed, 2.6m | 25 |
| Regression of the six accepted areas | `0f960826` | [44946402767](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44946402767) / 136974579384 | 2 passed, 4.6m | 67 |

All final group captures are complete: no preview skip or missing chunk. Console and page-error collections are empty in the final successful journeys. The 67 regression captures belong to the earlier six areas and are **not** added to this wave's 177.

Snapshots, full source commits, artifacts, digests, dimensions and image blob SHAs are recorded in the group manifests. The temporary snapshot branches may be removed by the existing CI cleanup; their commits and Actions runs remain identified. Permanent JPEG galleries in this repository survive the Actions artifact expiration.

### Confirmed source changes

People verified a member-title update, a project budget/description update and a milestone-note update. Finance verified a CAP05 monthly forecast, CAP14 notice/notes and CAP19 project description. Operations verified SLA, campaign, risk, stakeholder and performance subitem updates. Each successful mutation is followed by source projection and readback in its genuine isolated installation.

The CAP18 paste path verifies its canonical preview and cancels before applying; it is not counted as a write. Destructive confirmation screens are inspected and canceled; no deletion success is claimed.

## Final technical checks

Final gates: [44950683716](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44950683716), job 136987709812, product `e378923d7619c168b2d7b2c82b1232449eca2c45`, snapshot `9096c069ca9ab84252a2e1368dbebc69b8b3d9ff`.

- Application and E2E TypeScript checks pass. E2E configuration explicitly includes all three maintained Operations specs.
- Repository guards: **78 rules, zero errors, 24 E2E timeout warnings and zero approvals**. No guard or approval mechanism is changed.
- All **seven generated palette files** match the pinned base byte for byte.
- Three CAS-version unit cases pass, including the native integer zero; four browser-condition vendor DTO cases pass with a real Solid store proxy.
- Catalog audit: **649 existing English entries unchanged; all 256 new English entries have explicit Brazilian Portuguese text**, across 11 owned catalogs. See [catalog-audit.json](catalog-audit.json).
- Inventory audit: 70 areas, 165 route patterns, 15 chapters, 75 component references resolving to 66 distinct files. The route registry blob remains `6e1e711e2ff3a95e460026053cb91772693da572`.

The base-to-candidate file audit finds no changes to HuGR core, legacy console, source schemas, permissions, domain producer contracts, workflow definitions, guards or allowlists. Product changes remain in native Sucafina presentation and the necessary scoped DTO/version/transition repairs. Test-only setup uses original producers.

## Bugs found and repaired during verification

- People member/project writes now read the source's actual integer CAS version, including zero. Optional source absence is distinct from an unset value.
- Contract save creates an immutable plain DTO from the Solid draft and omits only undefined optional fields. Existing normalization and producer semantics remain authoritative.
- Monthly-grid keyboard navigation accounts for both sticky columns before revealing January/December. Focus stays on the chosen cell and frozen columns remain opaque and separate.
- Risk and stakeholder filters operate on already-authorized source rows only after Apply. Save DTOs preserve scalar values and omit undefined optionals.
- Review subtrees retain the draft object while a confirmed command changes the view. This removes exceptions during successful Service/Security and record review teardown; it does not weaken unknown-outcome handling or alter command/confirmation ownership.
- Review cancellation/revision remains fenced during pending or unknown outcomes, with reconciliation available in its existing owner.
- Security removal review presents admitted original/current source fields without converting absent flags into “No”. Monthly Service replacement review shows the existing source period when admitted by the version map.

The first record failures were real product failures. CAP13/CAP15 diagnostics proved that a successful response reached the confirmed-view transition before Solid threw; CAP16 had the homologous structure and an independently failing save. The final successful record run verifies all three writes and readbacks. Temporary stage/stack logging was then removed; the success path and all other product code remain identical to the tested candidate. Exact source parity is documented in [INTEGRATION.md](INTEGRATION.md).

## Visual inspection and limits

The workers inspected the actual native captures and performed cross-group reviews; root inspected the consolidated composition and targeted final corrections. Observed clipping, column collision, wrapped labels, absent review values and post-save failures were repaired before the final runs. “Passing” here records the tested result; user acceptance remains pending.

The matrix covers Chromium, 1440px desktop, 320px reflow in People/Finance, 390px reflow in Operations, English dark/light and Brazilian Portuguese dark. **Actual browser zoom and a cross-browser matrix were not measured.** Reflow screenshots are not claimed as zoom tests.

Nine Finance states were exercised without their own screenshot:
- CAP05: Editor anual (`annual-editor`).
- CAP05: Editor de desvio (`deviation-editor`).
- CAP05: Revisão da criação de projeto (`project-create-review`).
- CAP14: Criação de contrato (`contract-create`).
- CAP18: Lista de linhas (`lines`).
- CAP18: Criação de linha (`line-create`).
- CAP18: Configurações do plano (`settings`).
- CAP19: Lista de linhas (`lines`).
- CAP19: Editor de linha (`line-editor`).

CAP08 workbook import/export integrations are unavailable in the isolated installation and are shown honestly as unavailable in English and Portuguese. A missing leader catalog retains its admitted source identifier. The CAP19 native project projection does not expose stored approval/investment dates; the UI and assertions preserve that absence rather than inventing values. Pending/unknown/revocation branches are preserved and inspected in source, but a full fault-injection matrix is not claimed.

Detailed group coverage: [People](people/REVIEW.md), [Finance](finance/REVIEW.md), [Operations](operations/REVIEW.md).
