# Wave three — integration record

## Current integration

Status: **VALIDATED_FOR_INTEGRATION**. The user authorized integration conditional on green checks. Candidate `141336f8b17fe661cb0370ef99a7ff528737ef23` incorporates dev `2a68bcb676ed0c159c5c48130c2413e0e5637a00`; the native tree is `3213aecbbd258b9c00bd22f7f7dc19c046786e61`. All scoped browser journeys and technical gates passed. [MERGE.md](MERGE.md) and [MERGE.json](MERGE.json) contain the current runs, source-composition audit, one E2E observation correction and acceptance. [PR #587](https://github.com/gustavomhss/Orchestra-SF/pull/587) is authoritative for merge state and commit.

## Historical review-stage record

The following record describes the earlier review candidate and its then-current dev inspection. Its pending status and proposed next integration steps are historical; the current integration is recorded above.


Status: **REVIEW_READY_NOT_MERGED**. Branch `sf-design-fifteen`; base branch `dev`. Final product `e378923d7619c168b2d7b2c82b1232449eca2c45`; native Sucafina tree `bbbacbfc2cc344df42d367477622636ba8e4c193`. [PR #587](https://github.com/gustavomhss/Orchestra-SF/pull/587).

## Base and three workers

The branch was created directly from `dev acc0181508ceda7416bce57284b2307a9b20385b`, the merge containing the six accepted earlier areas through PR #583. Work is restricted to the next fifteen native Sucafina inventory areas, CAP05–CAP19. The white/green legacy console and HuGR core are outside the change.

| Worker | Branch | Areas | Final worker commit |
| --- | --- | --- | --- |
| redesign_people_five | `sf-polish-people` | CAP06–CAP10 | `19213217280ba59ada452585446e1a3d9d407250` |
| redesign_finance_five | `sf-polish-finance` | CAP05, CAP14, CAP17–CAP19 | `b02b9a268cffefd53385e90e89cb3dbef9fed32d` |
| redesign_operations_five | `sf-polish-ops` | CAP11–CAP13, CAP15–CAP16 | `05afd18d1ceee381c418b588f26186db1ad3b9b4` |

Root integrated owned file trees with expected-head ref updates, preserving worker ancestry and the shared native frame. Neither root nor workers changed CI workflows, guards, allowlists, source producers or schemas. All executions used existing disposable test-ci snapshots; no shell/local runtime, synthetic auth/grants, application restart or production business write was used.

## Source parity of browser evidence

The final browser runs are pinned independently so that a documentation update does not pretend to rerun a product. A complete path and dependency audit compared each baseline with `4402684c3ccd2b88b4b4bf548e25fcacd9aab960`:

| Successful evidence | Product baseline | Relevant post-run product/spec changes |
| --- | --- | --- |
| People / portfolio | `741a05b44afccafc53e6ae2aa6c0255027cf1653` | **0** |
| Finance / planner | `68ad2eec9d92bcd0a81823646c04678944487e85` | **0** |
| Service / Security | `68ad2eec9d92bcd0a81823646c04678944487e85` | **0** |
| Earlier six areas regression | `0f960826a6219dbd1fa65580a9d79ee7f707fbda` | **0** |
| Risks / Stakeholders / Performance + Operations BR | `4402684c3ccd2b88b4b4bf548e25fcacd9aab960` | CAP16 diagnostic logging removal only |

Shared frame, host/navigation, context, route registry and installed fixtures did not change after any of those baselines. The final monthly-grid blob `ef701ae0d98b81d4e0c3992dc9bbf665092bc2c9` was already present in Finance and previous-six regression. The People baseline precedes that change, but the thirteen pertinent People/Portfolio modules do not import the grid, and its added scrolling executes only inside the grid's keyboard handler.

Only local Operations modules and a CAP15-scoped priority CSS rule changed after Finance/Service. The additional Service and sf-u04 changes since the earlier-six regression affect only CAP11; no existing catalog entry changed. E2E changes are confined to the new Finance/Ops specs and including both split Operations files in the E2E TypeScript configuration.

After the clean Operations run, the final product removes the temporary `performStage` assignments and expanded CAP16 catch logger, restoring the original logger. No condition, command, controller call, confirmation, refresh, layout, catalog or spec changed. The worker checked the inverse patch against the exact tested file; root reviewed the full removal diff and confirmed that only the CAP16 entrypoint hash changed in the final native tree. Tested blob: `fbc8c8fe23a35a9bb0f4827b4eedaa3468fb8c80`; final blob: `1691c2d651e3bc5655bda000ee1f1540fadf156e`. Final technical gates run on this cleaned product.

See [source-audit.json](source-audit.json) for all 66 final entrypoint blobs, scope checks and parity records. The seven generated palette files remain byte-identical to the base, and the [catalog audit](catalog-audit.json) preserves all 649 original English entries while checking 256 new translations.

## Current dev inspection

During this wave, `dev` advanced to `abb7f0d110f8afc69541f5331a396c2e1ddc9f4d`: four commits and 29 changed paths since the pinned base. The commits are #585 CurrentChoice for Teams, #584 purchase tools invoke, #580 procurement MCP pack and #586 Microsoft Team purchase MCP host.

The complete base-to-dev file list and union of individual commit paths have **zero overlap** with this candidate. There are no renames or file/directory-prefix conflicts. The audited merge-base is the original `acc018`. This is a source/history check, not a runtime integration test against the advanced dev.

The review branch intentionally preserves the pinned tested base. **No merge into dev has been performed for these fifteen areas.** A later approved integration must preserve both the new dev work and this candidate and validate the resulting merge as appropriate. The six earlier areas are already merged through PR #583.

## Evidence and review

[Validation](VALIDATION.md) records five successful group runs, eleven confirmed writes, final technical gates, previous-six regression and their limits. [The gallery](evidence/README.md) preserves 177 real JPEGs. Their byte lengths and Git blob SHAs were read back after upload; every capture maps to a distinct business state or an explicit variant.

This candidate is ready for user visual review. Approval and merge are not inferred from a passing test or from approval of the earlier six areas.
