# Mission52 — source hosted checks compared exactly with mission44

The authorized source check completed with **failure**, with the same 130 TypeScript diagnostics, 43 guard gates and 18 warnings as mission44. No diagnostic site, code, full message or continuation changed. No guard finding was added or removed. These are still failures; the comparison does not create a waiver or an acceptance result.

## Exact run and source

| Field | Evidence |
| --- | --- |
| Workflow run | [43661892542](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43661892542) |
| Job / attempt | [132652817225](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43661892542/job/132652817225) / 1 |
| Branch | `astra-check-wp11` |
| Checked source | `14360372153592d944aa10e42bcac1b6d86680f5` |
| Checked tree | `47341d2756b567632ef450555493cefbdd4bdb68` |
| Workflow blob | `3b361b6b22c7c5628d6b149321f73934ea5f9a84` — unchanged from44 |
| Guard base | `a1d37698a7bb097c1578f827eba6a19b9917ef07` — unchanged from44 |
| Merge base | `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf` — unchanged from44 |
| Artifact | `14140103060` / `astra-wp11-checks-14360372153592d944aa10e42bcac1b6d86680f5-1` |
| ZIP SHA256 | `aa9dd24c62ae44c770bb46dd061816bfaf811fa90abab61fba77e05583d35beb` — matches GitHub artifact digest |
| Reference run44 | `43650398020` / job `132617339891` |
| Reference source44 | `ff0bd96d1303ef55204d498f286ba0da8543419d` |

Only run43661892542 was retrieved for check52. Root's earlier c106 source pointer push carried `[skip ci]`; no separate check run was created for it. This read-only review performed no dispatch or rerun. The evidence set contains three exact ZIP members: source.json, typecheck.log and guards.log. The decoded job log was also saved and correlated with artifact line numbers.

## Exact differences

| Comparison | Before44 | Check52 | Added | Removed | Changed text |
| --- | ---: | ---: | ---: | ---: | ---: |
| TypeScript diagnostic sites/codes | 130 | 130 | 0 | 0 | 0 |
| Paths with TypeScript diagnostics | 44 | 44 | 0 | 0 | 0 |
| Guard GATE findings | 43 | 43 | 0 | 0 | 0 |
| Guard WARN findings | 18 | 18 | 0 | 0 | 0 |

TypeScript exit code: **2**. Guardrails exit code: **1**. All 130 diagnostic records match by repository-normalized path, line, column, TS code, first message and every continuation line. All61 guard records match by severity, path/line location, rule and message. There are no line-movement substitutions or text-only exceptions in this comparison.

The complete normalized file stores every current diagnostic/finding, exact reference job-log line, current artifact-log line and current job-log line, with explicit empty added/removed/text-variation arrays. The two text variations recorded by mission44 relative to its own older baseline are not reused: check52 matches mission44's actual messages exactly, including those two sites.

## Ownership and inherited findings

The literal write_paths in the pinned mission52 package were applied separately from the changed-path set. **All130 TypeScript diagnostics are outside mission52's owned paths and outside the nine material paths changed since the check44 source.** The source branch has not absorbed current stack shared/other-owner changes, so unchanged inherited diagnostics are evidence about this source commit, not a claim about all current integration candidates.

All43 gates are the same `agent-scratch` findings under prior WP11 receipt paths outside mission52's write scope. The18 warnings consist of one inherited binary artifact warning, ten inherited dependency warnings and seven timeout warnings. Five timeout warnings lie in the owned Decisions spec, which has other mission52 edits, but the timeout statements themselves remain exactly `test.setTimeout(180_000)` at lines13,22,36,88,136. Their original blob is `2d9c867af87fa0a26b182365b1780232b49bcaf9`; current checked blob is `b6f63bfa1b8eacb5bf37a5c5b0d508fd658d70cf`. Thus those warnings are inherited relative to origin/dev and are not evidence of a mission52 timeout increase.

The three distinct axes are preserved per record: whether the path is owned by52, whether the source path changed after check44, and whether the finding is identical to44. No inherited failure was silently reclassified as passed. No guard source, workflow, timeout or waiver was modified by this review.

## Scope limit

The unchanged workflow runs `bun typecheck` in `modules/sucafina`, expanding to `bun --cwd Sucafinav1 typecheck` and `tsgo --noEmit`, followed by `bun run check:guards --base origin/dev`. Some CLI source diagnostics arise through the Sucafina import graph. This does not independently typecheck all CLI, app-shell or E2E packages.

The run checks source14360372153592d944aa10e42bcac1b6d86680f5, including the owned narrow HTTP factory. It does not compile or validate the proposed shared case-route adapter, C23/C25 host binding or installation body patch as a complete isolated composition. It does not replace any of the five nominal UI journeys, their mandatory financial case, or later same-composition validation.

## Files

- `checks/source-01.json`: complete diagnostic and guard index, zero-diff arrays, exact source/run/artifact metadata and scope limits.
- `compare44-source.json`: read-only GitHub compare metadata and patches for the nine material changed paths; predecessor44 terminal documentation is also in this comparison and is not attributed to52.
- `scope-inputs.json`: pinned mission52 write scope and exact before/after timeout evidence.
- `extracted/`: exact three artifact members; retained locally for reproducibility, not proposed as repository raw-log additions.

Artifact member SHA256 values:

- `guards.log`: `584c2006ea4f157522b75d1ccfea1d96d6537fc0553682e680bedf6ae569a95f`
- `source.json`: `2cbe10a2006a8d93cb2487d63f3fd3f951a5319cda4fffbb49f78c0bb1638bd9`
- `typecheck.log`: `5a7e2134901935a8a940e1d907c4d1e667c20379309769972657a72fbb799ef4`

Normalized JSON SHA256: `2a3ec402ff61922153a9e3acf7b58d3365b3001c043de0ffeb4d2227a1f1cc8a`.
