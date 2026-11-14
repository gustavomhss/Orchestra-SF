# Independent source review — Operations check guards mode

Reviewed source: `.github/workflows/astra-operations-check.yml` at Operations W2 `5e0c79ee7013ea84329ff1fab8b32ab04ebdc2c3`, Git blob `32d4b65247ee8574681b65bdd07d1dc38cb7a14d`. GitHub MCP returned the exact published bytes. This is a source review; no workflow, product, typecheck or guard was executed locally.

## Envelope and tree constraints

The original two-field envelope permits exactly `devSha` and `productSha` and selects `all`. An explicit `all` mode is rejected. The alternative permits exactly four fields: `devSha`, `mode`, `productSha`, `typecheckSha`, with `mode` exactly `guards`. Every SHA is required to be a lowercase 40-character hexadecimal string. Additional keys are rejected.

The snapshot checkout must equal the event SHA; its first parent must equal the named product. The complete product-to-snapshot tree delta must be exactly the added `.astra-operations-check.json`. Both WP04 and WP06 published ancestors must be ancestors of the product. The actual W2 snapshot independently has exactly one parent; the workflow checks the first parent rather than separately asserting parent count. This does not affect the observed W2 snapshot proof.

For `guards`, the workflow requires `typecheckSha` to be an ancestor of the product. The complete net tree diff from that SHA to the product is restricted by an anchored regex to `modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP04/operations-20261114/` or the corresponding `WP06/` directory, and only `.md`, `.json`, `.patch`, `.log`, or `.txt` files. Subdirectories inside those receipt roots are also accepted by `[^\n]+`; code, test, fixture, lockfile and workflow changes elsewhere are rejected. Git filenames are normalized tree paths; the script uses `execFileSync` argument arrays rather than a shell interpolation of input.

## Step conditions

The exact product is checked out after envelope validation. The product revision and `origin/dev` must equal the envelope, and the artifact records product SHA, tree, guard-base SHA and merge-base. Setup failure prevents all three check steps. In `all` mode both typechecks are selected. The explicit `!cancelled()` conditions allow the CLI typecheck and guards to report independently after a Sucafina typecheck failure. In `guards` mode both typechecks are skipped and the guards step still executes. The artifact upload runs even after failures.

## Evidence qualification

The workflow enforces unchanged-code eligibility for reuse; it does **not** query a previous Actions run or prove that the typechecks at `typecheckSha` passed. Its console statement about reuse therefore requires the separate receipt linking that product to the actual Sucafina and CLI typecheck outcomes. A successful guards-only run proves guards only and must not be described as newly executed typechecks. A known failed typecheck can also remain recorded without rerunning unchanged code; its failure and the failing aggregate gate must remain explicit.

The successful-typecheck prerequisite is currently unsatisfied for W2: hosted run `43580277793` at snapshot `ee2099e581eb4a6fc83283599763dd825c4a8ac4` executed `all`, and both typechecks failed. Its guards result passed. The older W1 run also had a Sucafina typecheck failure. Neither candidate can be cited as a successful two-typecheck baseline. For a later receipt-only delta, guards-only success could coexist with those retained failures, but could not close either typecheck or the aggregate gate. A claim of successful typecheck reuse requires a separately recorded successful result for the final unchanged code. Any later product/test/config change requires the affected validation again.

No allowlist escape or step-condition bug was found by this source review for the stated receipt-only use. This is not an acceptance of the current failing candidate.

## Follow-up: Sucafina-only mode before W4 publication

The subsequent source revision has blob `ec63fc5e1a355ada4f1b73cc518c225719e9b08e`. It adds a third effective mode, `sucafina`, using the same exact four-field envelope and ancestor constraint as `guards`. The complete net diff may additionally contain only the exact paths `test/product/wp11/case-port.test.ts`, `test/product/wp14/source-access-atlas.test.ts` under the Sucafinav1 product tests, and `.github/workflows/astra-operations-check.yml`. The two tests are outside the CLI program's input closure, as independently observed in the separate Sucafina/CLI diagnostics and the unchanged CLI configuration/import boundary. Workflow source is also outside that TypeScript program. No CLI package, tsconfig, product source, dependency lock or setup action is allowlisted.

For `sucafina`, Sucafina typecheck and guards execute while CLI is skipped. For `all`, both typechecks still execute. For `guards`, the allowlist remains receipt-only and both typechecks are skipped. Unknown modes, extra fields, missing or malformed SHAs and ancestry mismatches still fail closed. The source review found no new condition or allowlist defect for the proposed W4 change consisting only of the related case-port assertion corrections and this workflow revision.

The reusable CLI result is now concretely recorded: W3 product `d7d343ecb2ef4b4ccff925f50a5a60324d22b371`, run `43580747934`, job `132404768523`, CLI **success**; artifact `14107773891`, verified SHA256 `42b7470ecb760bd753cc80fe78b1cbe2a539d9791fac3e5ddc5f841f763efbbc`. Sucafina still failed only at the Atlas consumer. A later Sucafina-only run may reuse this specific CLI success while preserving that earlier failure and reporting its own Sucafina outcome. The new mode itself does not prove historical outcome success; the linked receipt remains required.
