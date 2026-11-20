# Read-only retained Reports nominal evidence

## Target and question

This is an isolated CI-only reader over product
`6c6303f5a52cd6123762f8875b33822ba28e1ed8`
(tree `a88331c0e06fccdaf41e946a30a7ce8f0b93d3a1`).
None of its workflow, reader, request or documentation is a product integration blob.

Read exactly the existing [run 44675679976](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44675679976),
job `136086802928`, attempt 1, cleanup `136091119506` success:
snapshot `46a4d879e86077a6ab35f0fd64b3df86e8807a33`, direct child of product6c630,
tree `627d1a6f2164023320cad2d7518d61a66b585e9a`, original request
`e543b74568002e8cf579d4aaf50e12fa1d010604`.

The nominal result was **1 passed / 3 failed, 11.3 minutes**. RPT-03 passed.
The three failures reached the original 180000 ms deadline. RPT-01 reached the
meeting reload after DOCX/PPTX downloads; RPT-02 surfaced cleanup failure in
lost-created-thread-read.ts:142; RPT-04 waited for collaboration-thread-create
through human-answer-flow.ts:54,170. Those stacks alone do not identify the
inner C05 wait or establish a server crash. Individual test durations must
come from the retained report, not differences between reporter log timestamps.

Pinned artifact:

- ID: `14602935208`
- Name: `playwright-ubuntu-24.04-1`
- Size: `1470718` bytes
- SHA256: `5c5c28592f0c20810b162112f1e1c7dce6722607e1a25ff7b471e13a825b35ea`
- Source head: `46a4d879e86077a6ab35f0fd64b3df86e8807a33`
- Retention observed through `2026-11-27T04:49:56Z`

Questions:

1. Which inner wait did RPT-02 reach before its finally/unroute masked the timeout:
   receipt/lost read, reconciliation, focus refresh, or explicit retry?
2. In RPT-04, which operation preceded the awaited thread-create, and what
   request/status evidence actually remains in the artifact?
3. In RPT-01 after export, how do HTML review navigation, review-read JSON and
   the report/download requests contribute to elapsed time?

A missing retained request remains unknown. The reader does not reconstruct
unrecorded browser traffic or infer a primary crash from teardown errors.

## Reused qualified implementation

The ZIP/embedded-HTML parser, step flattening and error/title sanitizer come
from `apps/cli/audit-reports-html-evidence.node-smoke.mjs`, blob
`cb6a7723bb20a2b8ceead1abbe9d9f3f8b8d9fc1`, at
`8d42f7c8dd4c21f47b819fdd32e9bfa8fb00a649`.
Its actual reader run `44651646714` / job `136007724941` was 1/0.
The earlier runtime-JSON/transport field selection was qualified in
`2923c59531d8e33b16744719ee5f344751102ac4`
(reader `44650485310` / job `136003830520`, 1/0).
That source is `audit-reports-nominal-evidence.node-smoke.mjs`,
blob `c4665f11a05c70a56f6177960c11c9241e6f69c1`.

The adaptation verifies the authenticated run and artifact metadata, refuses
redirects on metadata reads, follows only the explicit HTTPS artifact redirect
without forwarding the GitHub token, and checks the downloaded ZIP length
and SHA256 before parsing anything. The token is removed from the reader's
environment and is never printed. Network failures are reduced to fixed
messages. Each metadata/download request is bounded to 30 seconds; this is
only the reader's transport limit and does not change any product-test budget.

Only `playwright-runtime.json` is selected initially. Its four scenario
statuses, durations and source locations are always emitted as `SCENARIO`,
before any HTML fallback. Detailed HTML metadata is retained separately; no
invented cross-format equality assertion discards a difference. Only its four installation
manifests and existing numeric timing/transport attachments are then read.
If those result trees contain API steps with source locations for all four
scenarios, the HTML report is not extracted. Otherwise the qualified embedded-ZIP fallback reads
only retained `index.html` and its result JSON. No trace, screenshot, Office
document, preserved review body, C05 request/response payload or DOM snapshot
is extracted. The parser retains its entry, byte and depth bounds. The HTML fallback uses
the actually observed step/title/location shape; it does not require the
category/apiName fields absent from the qualified retained HTML reports.

Output is limited to pinned provenance, scenario status/duration, sanitized
step titles/error codes/API modes/file:line and step hierarchy, existing
transport fields (method/mode/resource/status/elapsed/codes), and numeric or
boolean timing values. It does not print raw URLs, signed locations, headers,
cookies, tokens, payloads, CLI log bodies or attachment bodies. Four actual
installation manifests must match the original snapshot. No result is treated
as a fresh product run.

The displayed tree is the union of the qualified slow selection (duration at
least 1000 ms or an error), the last 45 steps, all wait steps and all ancestors.
Every retained error is selected even when its code is outside the sanitizer
whitelist; only a failure boolean, never its raw message, is then printed.
Original flat indices and parent indices preserve ancestry. `flatCount`,
`selected` and `omitted` explicitly disclose the filtered step count. This
selection changes only reader output, not product execution or elapsed budgets.

Cold review found two concrete defects before executing this reader: the old
qualified HTML log (job `136007724941`) has no category/apiName fields, and its
RPT-01 contains 7781 valid steps. The unnecessary new 5000-step limit has been
removed. The qualified archive-size and depth limits remain unchanged. The
old scenario counts were 7781, 240, 213 and 4236; they are schema evidence,
not counts or results attributed to the current nominal.

## Isolated workflow and qualified reader

The only changes to `.github/workflows/test-ci.yml` are `actions: read` in
its existing read permission block and `REPORTS_ARTIFACT_TOKEN: github.token`
in the Run tests environment of this reader snapshot. Existing cleanup
permissions and all production-test commands remain byte-identical.
The reader imports only Node built-ins and never imports or launches product.

The planned request is the same qualified node-reader request
(blob `a1c53721f7e7ec4b112d6d171b4c50c83960c9e7`):

```json
{
  "package": "cli",
  "runner": "node",
  "args": ["audit-reports-html-evidence.node-smoke.mjs"],
  "env": {"ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER": "1"}
}
```

The reader was prepared and reviewed at
`d121a4b8e38dbc5facb1c761be3d8db3ca967eb1` with `[skip ci]`.
Its single CI snapshot `c144b39752a8f38c7d2774ecb1fe435e6fbc0efd`
(tree `11a6166a42f83ecc0bab8a41d501c34b0452d767`) added only the
qualified request. Reader run `44679031600`, job `136097709971`:
**1 passed / 0 failed / 0 skipped, 2328.06586 ms**, attempt 1.
Cleanup `136098187195` succeeded. No product compiler, browser retry,
nominal rerun, integration or sf-ci execution was performed.


## Observed result and remaining uncertainty

The durable sanitized records are
[REPORTS-NOMINAL-44675679976.json](REPORTS-NOMINAL-44675679976.json).
The reader verified the actual ZIP digest/length, all four installation
manifests, four runtime JSON results, four retained HTML trees and 13 existing
transport attachments. It read zero traces and ran zero product tests.

| Scenario | Original status | Duration from runtime JSON |
| --- | --- | ---: |
| RPT-01 | timedOut | 180020 ms |
| RPT-02 | timedOut | 180027 ms |
| RPT-03 | passed | 67367 ms |
| RPT-04 | timedOut | 180020 ms |

HTML metadata reports the same durations in this artifact; no equality
requirement was imposed by the reader. The detailed/selected/omitted step
counts are RPT-01 7786/64/7722, RPT-02 195/56/139, RPT-03 228/56/172 and
RPT-04 4174/56/4118.

### RPT-01: export and first meeting open consume the available time

The DOCX export step completed in 46815 ms; the PPTX step completed in
75725 ms. These are original whole-step durations, including their own
assertions. The request-to-response intervals below are arithmetic
differences within each retained transport attachment, not CPU measurements:

| Observed request | Response | Interval |
| --- | ---: | ---: |
| First review-report POST (DOCX) | 200 | 20594 - 41 = 20553 ms |
| First review-download GET | 200 | 24869 - 28 = 24841 ms |
| Second review-report POST (PPTX) | 200 | 39651 - 54 = 39597 ms |
| Second review-download GET | 200 | 34910 - 32 = 34878 ms |
| Meeting review HTML GET | 200 | 26184 - 88 = 26096 ms |
| Following review-read JSON GET | 200 | 44589 - 26229 = 18360 ms |

The HTML interval is distinguishable from an overlapping review fetch:
that fetch started at 15038 ms and failed at 25038 ms before the document
response. The meeting step (`reports.spec.ts:36`) lasted 44657 ms;
its first review-read waiter (`review-flow.ts:307`) completed in 44526 ms.
Only then was the reload waiter armed at `review-flow.ts:314`; it lasted
129 ms and reached the original deadline. Transport records show connection
refused at the end, including the reload document request at 44654 ms and
failure at 44656 ms. They do not establish a primary server crash.

Some download/navigation fetches record ERR_ABORTED, including document
download responses already observed as 200. The original complete export
steps passed their assertions. Background review GETs overlapped exports;
this evidence does not attribute a performance cost or cause to them.

### RPT-02 and RPT-04: initial creation wait, not later answer/recovery stages

RPT-02's real helper POST review-thread-context completed in 13432 ms at
`confirmation.ts:37`, followed by successful context assertions; its
storage-version helper call completed in 35 ms. The subsequent UI click at
`lost-created-thread-read.ts:65` completed in 37 ms. The initial create
receipt waiter at `:29` remained pending for 137262 ms, and the expected
read-loss requestfailed waiter at `:64` for 137259 ms. The code did not
advance to reconciliation (`:78`), focus refresh (`:92-96`) or exact
explicit retry (`:114-116`). The finally/unroute error at `:142` masked
this initial wait.

RPT-04's helper context POST completed in 11172 ms, then storage-version in
48 ms. The Ask click at `human-answer-flow.ts:171` completed in 57 ms.
The create response waiter at `:170`, called from `:54`, remained pending
for 118466 ms. No reply, answer confirmation or revocation stage was reached.

Those direct helper calls are different invocations from the browser UI's
own context/version preflight. The existing transport observer ends before
the C05 click period, so these retained records do not prove whether the UI
sent thread-create, received a preflight error, or waited on an unfinished
request. That is the concrete remaining evidence gap. A completed click is
not proof of completed asynchronous browser work.

All times are inclusive retained observations and may include teardown
settlement. Do not sum parent and child spans or compare elapsedMs origins
across transport attachments. This reader closes no product gate and
authorizes no retry.


## Supplemental retained UI metadata: prepared, not executed

The first reader located the initial Ask wait but retained no network observer
for the browser's subsequent preflights. The existing error-context markdown
may distinguish a suspended preflight, an intent already retained, or an
unresponsive control. A second, changed CI-only reader is prepared for that
specific question; no product test or retry is proposed.

The only reader addition selects error-context markdown through actual
attachments of RPT-02 and RPT-04. A directly referenced attachment must have
`text/markdown` content type and the exact error-context name or filename.
If that direct attachment is absent, the reader can use the actual directory
of the result's `trace` attachment (`application/zip`, filename `trace.zip`)
to select its sibling `error-context.md`. Only the trace attachment metadata
is inspected; no trace entry is extracted or decompressed.
Inline contents are allowed only for that identified attachment. Otherwise
the archive entry must equal the actual reference or share its complete
hierarchical suffix; no scenario slug, title-to-folder guess or loose basename
lookup is used. Multiple matching retained copies must be byte-identical.
If a reference is absent or unresolved, the reader emits only that availability
reason and sanitized attachment names/types. It does not read arbitrary files.

Primary JSON and retained HTML attachment references are inspected independently
and labeled by source. The same artifact, run, snapshot, byte count and SHA256
pins remain unchanged. No trace or full DOM snapshot is emitted.

The status extraction and known-button disabled flags are copied from the
qualified 8d42 reader, lines 107-113, retaining the same sanitizer. The sole
additional known button is `Reconcile discussion`, whose actual creation is
`modules/sucafina/Sucafinav1/product/reviews/collaboration-view.ts:248-250`
at product6c630 (blob `2286a1c4fcaf6c08c3fa708302ee12dc5429ec98`).
It distinguishes the suspended no-intent branch from `Reconcile action`
at line 254. No textbox value, question, recipient, request payload, header,
cookie or raw error-context text is printed.

All previously qualified parser, transport selection, scenario metadata,
step-tree selection, workflow and request behavior remain unchanged.
The supplemental reader awaits cold review and authorization; there is no
additional run ID yet.
