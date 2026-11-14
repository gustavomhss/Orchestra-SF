# Decisions E2E — attempt 01 preparation

## Status

**PARTIAL / BLOCKED; runtime NOT_RUN at this preparation commit.** This delta installs the previously absent nominal spec and strict tests of reachable real consumers. It does not implement or accept the complete CI-UI-DECISIONS journey. Later append-only result and handoff files record the actual Actions outcome.

The branch remains `astra-wp11`, PR40 against `sf2-stack`. The prior W19 product and terminal handoffs remain untouched. Only the mission's spec, `decisions-support/` helpers and own receipts are added. No product correction from WP10 or Finance was copied.

## Executable selection

`request.json` selects only `e2e/sucafina/decisions.spec.ts` in the existing production Playwright configuration. The existing request validator and Playwright list/runtime evidence must confirm the selection in Actions. There are three tests:

| Test | Intended observable proof | Boundary |
| --- | --- | --- |
| create, edit and reopen the same durable case through Workbench | Dashboard link, ready human form, original UI POST, exact case id/incarnation, horizon/currency/criteria, current version after edit/reload/reopen | Does not assert historical choices or restart persistence |
| alternative discovery consumes a real Decisions catalog, not HTML 200 | A case created through UI, exact listed identity, exact catalog request/projection, empty alternatives and disabled save | An empty case is valid; positive alternatives/C10/choice remain unimplemented |
| recover a lost creation response by reading the same case without resubmitting | CDP observes and drops the original server response, preserved fields/error, one creation submission, authorized reopen/reload of the same case | Creation C09 only; no financial Apply retry/C12/AM04 proof |

The loss helper acts on the response stage of the browser's original request. It does not call APIRequest, route.fetch, fulfill, resubmit, or create a synthetic body. Assertions require the actual HTTP domain result and visible state together. The server-generated case reference is bound to the exact UI projection.

Tests reuse the read-only WP03 installation fixture: actual CLI, local entry, real enrollment, isolated storage, and only its own child process cleanup. The production config builds the app shell. The fixture's isolated child environment does not inherit provider credentials or ORCHESTRA_CHANNEL; this is recorded as a limit, not concealed as a provider or native proof.

## Blocking dependencies and required continuation

| ID | Exact prerequisite | Owner / scope |
| --- | --- | --- |
| D-CASE-READ | Installed caller must supply `verifyScenarioOperations` required by `createDecisionCasePort.read` | WP10 CLI composition; Finance owns producer contract |
| D-HOST-HTTP | Real host must mount decision-list/edit/portfolio/compare/choose/review/apply handlers | WP10; published PR29 changes are not installed in PR40 |
| D-INITIAL-ALTERNATIVES | Public human path to attach authorized sources and create at least two initial alternatives | Product/WP10 composition; no seed or direct POST substitute |
| D-APPLY-DIGEST | Consumer must preserve actual reviewDigest and exact approved intention through explicit Apply/recovery | Existing Decisions UI/WP10 and Finance owners |
| D-PROVIDER | A real provider/model and native independent reviewer must be available and observed | Native/provider host; current availability NOT_OBSERVED |
| D-HISTORY | Produce actual choices, financial receipts and persisted C17 history before asserting replay | WP11/Finance producers plus mounted consumer |

`static-audit.json` records producer/caller blobs, exact heads of PR29/42 inspected, and evidence limits. Static source findings are not observed runtime failures. The receipt after Actions must identify the first actual failure of each test.

After the owners compose the real prerequisites, continue the same spec through actual source/alternative UI, comparison C10, human choice, proposal/preview, explicit financial approval, true partial result, durable receipt, lost Apply response, explicit same-intention recovery and reload/history. **Choosing an alternative is not financial approval.** Missing/pending coverage must not be changed to zero. Native critique must not be filled with fabricated AI output. The existing append-only criteria matrix identifies the still unimplemented obligations.

## Validation policy

No local tests, local typecheck, local app or full/epic suite. One nominal product run at a time. W is the spec/receipt commit; S has W as parent and only `.ci-run.json` added. Product/config/fixture/test blobs must match. The existing scoped guard workflow may inspect the same W; it typechecks Sucafina, not app-shell or this E2E directory. The app/E2E typecheck is NOT_RUN under the read-only configuration constraint. A guard result cannot certify the journey.

Prior 83-criterion product evidence is preserved in `receipts/WP11/final-20261114`; this new matrix grants no acceptance from unexecuted tests or historical greens.
