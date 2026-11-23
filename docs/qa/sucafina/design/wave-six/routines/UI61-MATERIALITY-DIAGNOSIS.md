# UI61 materiality — bounded diagnosis and local cancellation

## Observed limit

The materiality result remains **unqualified**. On source `cb924bd6cda9bb1fd2ac304618d3a8760b80d94e`, [R11 / job 137502251987](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45117078885/job/137502251987) delivered the original catalog, case choices, and recorded conditions with HTTP 200. Conditions took 6,046 ms; the first step completed with four captures.

Clicking **Review condition** then issued the original `GET /sucafina/dashboard?sf=memory-materiality` for the exact case/incarnation/version 5/condition. Its response body was not delivered within the original 40-second observation budget. No HTTP business verdict or materiality value was available to classify. Later localized navigation and a conditions reread also exceeded their original budgets; the signal GET never began. No page exception was recorded.

This establishes an unfinished read, not an original `unavailable` result, a computed comparison, or server-side cancellation. No deadline was increased. The forwarding observer's fetch cannot prove that the UI AbortSignal stopped server computation; the isolated cancellation test must observe the native request and `requestfailed` event without forwarding it.

## Source finding

The original path is [memory-http.ts](https://github.com/gustavomhss/Orchestra-SF/blob/cb924bd6cda9bb1fd2ac304618d3a8760b80d94e/apps/cli/src/sucafina-product/memory-http.ts) → [memory-services.ts](https://github.com/gustavomhss/Orchestra-SF/blob/cb924bd6cda9bb1fd2ac304618d3a8760b80d94e/apps/cli/src/sucafina-product/memory-services.ts) → [decision-memory/materiality.ts](https://github.com/gustavomhss/Orchestra-SF/blob/cb924bd6cda9bb1fd2ac304618d3a8760b80d94e/modules/sucafina/Sucafinav1/product/decision-memory/materiality.ts) → `decision-memory/planner-materiality.ts` → [planner/materiality.ts](https://github.com/gustavomhss/Orchestra-SF/blob/cb924bd6cda9bb1fd2ac304618d3a8760b80d94e/modules/sucafina/Sucafinav1/product/planner/materiality.ts). The last three paths are under `modules/sucafina/Sucafinav1/product`.

The HTTP handler preserves original admission and scope revalidation. Materiality performs repeated original observations, evidence checks, pair resolution, and comparisons. Scenario comparison in turn reads stored scenarios and evaluates original coverage. The observed fixture takes the single-criterion branch, not the additional multicriteria branch.

Repeated work is a plausible cost contributor, **not a measured attribution** of R11's delay. No malformed DTO, exact slow phase, missing provider, or lock cycle was demonstrated. The original calculation selector and ancestry guard already avoid known projection cycles; their presence does not identify this timeout. Backend, configuration, producer, and authority were left unchanged.

## Minimal consumer correction

Product commit [b25026d70e952c3e80ca10befe2e062d4247966b](https://github.com/gustavomhss/Orchestra-SF/commit/b25026d70e952c3e80ca10befe2e062d4247966b), based on coordinator `722b703b060e5cc578fa8d23568b3f9c56d72077`, changes only `memory/index.tsx`, one layout rule in `memory/memory.css`, and three EN/pt-BR keys in `sf-u26.ts`.

Before the change, replacement/case/owner changes aborted the detail read, but the user had no explicit cancellation action. Repeated clicks on the same loading condition were not guarded.

The corrected handler captures a plain case tuple, original owner, condition/choice IDs, generation, request epoch, and exact AbortController. It blocks duplicate reads synchronously and disables the corresponding **Review condition** button. After the original operation returns, publication requires all those identities to remain current. Original condition/choice validation and returned ready/stale/denied/error handling remain intact.

**Cancel materiality consultation** aborts only the detail controller, clears its result, and marks a local cancelled state. It preserves the authorized case, recorded conditions, and separately loaded signals. It sends no request, increments no shared epoch, and makes no rollback or server-stop claim. The abandoned response cannot pass the signal/controller fences.

The message explicitly says the consultation stopped **in this view**, with no current result received. **Read materiality** starts another consultation only after an explicit action. The same action element remains mounted across cancellation to preserve keyboard focus. Case/owner resets clear the cancelled state. There is no automatic timeout or retry.

Test-facing markers: `data-sf-memory-materiality-state` reports the original read state or local `cancelled`; the existing positive-result marker `data-sf-memory-materiality` is unchanged.

## Evidence boundary

The three product blobs were read back exactly. All existing EN/pt-BR entries remain byte-identical, with three new key pairs. Coordinator source review approved the product. Native browser and technical-gate results for this correction must be recorded by the memory/coordinator owners; they are not claimed here.

The memory owner prepared separate native materiality/signal cancellation journeys, observing Request/requestfailed without forwarding the expensive request. Those journeys retain their original budgets and check one request, no resend, focus, preserved conditions, and selection clearing. The original positive materiality oracle remains intact and independently unqualified; cancellation cannot replace it.

New Portuguese phrases reuse established U26 wording and were checked against [Mozilla Firefox pt-BR preferences](https://github.com/mozilla-l10n/firefox-l10n/blob/main/pt-BR/browser/browser/preferences/preferences.ftl) (retrieved blob `b3ddf52ca28ef421da7ca12549b67084b5b84735`, “Cancelar”, “Tentar novamente”) and [Microsoft VS Code pt-BR](https://github.com/microsoft/vscode-loc/blob/main/i18n/vscode-language-pack-pt-BR/translations/main.i18n.json) (blob `97d55c2befdf7f606f399a8f5526b635d777c784`, “Cancelar”, “Gravação de voz interrompida”). The existing domain term “materialidade” is retained.

## Preserved routines checkpoint

This diagnosis does not supersede or rerun the routines evidence. Accepted checkpoint [c633f23a9ec392d1282406098ade2c8c779fd9a8](https://github.com/gustavomhss/Orchestra-SF/commit/c633f23a9ec392d1282406098ade2c8c779fd9a8) remains committed in `sf-final-routines`:

- `routines/VALIDATION.md`: blob `336c6cad5c424b55b8542fb3aea0d7b7ec50a8b9`.
- `routines/validation.json`: blob `3e9e2007a0449e395a083edbbf69a7a80257f6f0`.

Both paths are under `docs/qa/sucafina/design/wave-six`. This additional diagnostic commit leaves the coordinator-base copies untouched.
