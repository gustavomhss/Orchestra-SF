# Mission36 — proposed hosted Reports E2E typecheck

Status: **PROPOSED_NOT_APPLIED_NOT_RUN**. Consumer: session33 and the existing authorized WP07 dispatcher.

C6 already includes the Reports spec and support graph in `packages/app-shell/e2e/tsconfig.json` (blob `141da754e380d7410da97f9ca44505880cca55c9`). The missing proof is an actual hosted `bun typecheck:e2e` execution. The existing source workflow `astra-wp07-check.yml` checks only Sucafina and guards; C6 itself does not contain that workflow.

This complete patch adds one seven-line step to the exact source workflow blob `28c453f4b7735f944e1237715e399e955d86546c`. It runs the existing package script from `packages/app-shell`, continues after an earlier check failure, and writes the full output under the evidence directory already uploaded by the workflow. The original trigger, permissions, checkout, job budget and all original steps stay intact.

## Owner consumption

Compare the current active workflow with the recorded preimage before applying. If consuming into C6 or a descendant without this workflow, explicitly import the recorded source workflow plus this delta; the patch is not evidence that a missing file existed. Do not import the source branch wholesale. Run only over a coherent candidate containing the actual Reports E2E graph and its transitive helpers.

The existing `astra-check-wp07` ref requires current-head and ancestry reconciliation through GitHub MCP CAS without force. This receipt does not authorize a second dispatcher, a duplicate run or a full/epic dispatch. Ancestry that cannot fast-forward remains an owner problem; no lease is bypassed.

Read `manifest.json` for exact source commit, blob/SHA256 identities, application rules and limits. Both source images have `.yml.txt` suffixes and are inert documentation. No active workflow or shared source was edited, and no test or check was executed while preparing these files.
