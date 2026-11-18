# Consolidation execution status

Generated during the campaign. Source of truth for dispositions remains
`ledger.jsonl`; this page tracks topology, delegated packages and open work.

## Branch topology

| Branch | Media | State |
| --- | --- | --- |
| `close-final-candidate` | base | protected by lease `ec3df1315c` |
| `consolidate/00-baseline-green` (PR #337) | baseline fixes, CI sharding, campaign tooling | active |
| `consolidate/10-platform-runtime` | B1 platform/auth/runtime | stacked on B0 |
| `consolidate/20-business-product` | B2 domains/product/native chapters | stacked on B1 |
| `consolidate/30-native-shell` | B3 shell/UX/e2e | stacked on B2 |
| `consolidate/90-integration` | B0+B1+B2+B3 integration preview | validation only |
| `close-final-candidate` → `go-live-close` | promotion (PR #237) | draft, fast-forward once green |

## Delegated work packages

| WP | Branch | Delivered | Absorbed into |
| --- | --- | --- | --- |
| WP1 | `consolidate/20-business-product-wp1` | B2 bulk ports | B2 (no-op, same lineage) |
| WP2 | `consolidate/20-overlaps` | local-store / state-provider / procurement unions | B2 |
| WP3 | `consolidate/30-native-shell-wp3` | installed Decisions/Reports E2E (#307) + native journeys | B3 |
| WP4 | `consolidate/10-platform-runtime-wp4` | native authority provider + child admission (#104/#110) | B1 |
| WP5 | `consolidation-ledger` | ledger.jsonl + `validate-ledger.mjs` + report | B0 |
| WP6 | `port-acceptance` | `accept-port.mjs` + tests | B0 |
| WP7 | `closeout-toolkit` | `closeout-prs.mjs` + templates + tests | B0 |
| WP8 | `queue-freeze` | `queue-drift.mjs` + snapshot format | B0 |
| WP9 | `conflict-audit` | `conflict-audit.mjs` + `conflict-matrix.json` | B0 |
| WP10 | `promotion-readiness` | `promotion-proof.mjs` + proof JSON + checklist | B0 |
| extra | `gpt-ci-sf-baseline-wp10-20261117` | route discriminants, legacy asset envelope, typed receipt | B2 |

## Ledger coverage (product paths only)

Counts exclude `package.json`, `bun.lock`, `.md`, `.json`, `.lock`, `.github/`, `docs/`.
"Touched" means the campaign branch content differs from the base blob; the
remaining paths are not automatically required work, because several are already
at base semantics or are superseded by a canonical owner.

| Bundle | Product paths in ledger | Touched by campaign | Untouched |
| --- | --- | --- | --- |
| B1 | 225 | 37 | 188 |
| B2 | 789 | 110 | 679 |
| B3 | 104 | 7 | 97 |

## CI facts

- `sf/test-CI-SF` is sharded into eight jobs with a proven complete/disjoint
  partition; each shard emits its own receipt and `sf/verify` checks the union
  against the reviewed baseline.
- The dependency cache is saved by `dev` and, during the campaign, by
  `consolidate/00-baseline-green` and `consolidate/90-integration` only.
- UI lanes upload `test-results/**` only on failure (`sf-ui-failure-<suite>`).

## Open items

- B0 must finish green including `sf/verify` before any bundle merge.
- Remaining static errors are tracked by owner in the ledger; the current set is
  in the latest mega run log and mapped with `script/sf-ci/triage` conventions.
- Coveralls baseline for `CI-SF` remains `PENDING_REAL_COMPLETE_RUN` until the
  first complete sharded run is reviewed and versioned.
- Closeout of historical PRs only after each bundle merge, using
  `closeout-prs.mjs` in dry-run first.
- Promotion requires the owner GO gate and the `promotion-proof.json` artifact.

## Hygiene rules

- GitHub Actions is the only oracle; no local `bun test`/`build`/`typecheck`.
- One writer per bundle; merges serial under the base lease.
- Never change an assertion to match behavior.
- Host-local artifacts (for example `.husky/_`) never enter a campaign branch.

## Consolidated status (2026-11-18)

Bundles merged into `close-final-candidate`: #337 -> `3ba969783a`, #342 -> `f30e1356a3`,
#343 -> `66ef77dcde`, #344 -> `a63c4c7335` (current base).

CI facts established after the merge:
- `CI-SF` runs as eight shards. The WP01 ordered browser pool cannot run inside a Bun
  multi-file process (Bun schedules files itself), so its 40 pool-owned files are
  declared as `harnessOwnedFiles`, excluded, and both directions are proven.
- A red shard now uploads its own `run.log` and `report.xml` for attribution.
- The base tree is red independently of the campaign: the historical single job ran
  only 289 of 918 files and finished with 43 failing tests while reporting success,
  which is why `sf/verify` was always red.

Open work is tracked in the branch `sf-red-clusters`:
- native phase fixture lost `@orchestra/ToolSafety` (location graph + replacement),
- private browser enrollment aborts immediately (diagnostic message now preserved),
- Decisions lane control lookup by label raced the selected option (name-based locators
  adopted from #307; the same PR's assertion deletions were not adopted),
- reports artifact `put` stalls after the second review read (traced behind
  `SF_REPORTS_TRACE`).
