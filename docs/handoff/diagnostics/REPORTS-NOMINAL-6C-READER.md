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

Only `playwright-runtime.json` is selected initially. Only its four installation
manifests and existing numeric timing/transport attachments are then read.
If those result trees contain API steps for all four scenarios, the HTML
report is not extracted. Otherwise the qualified embedded-ZIP fallback reads
only retained `index.html` and its result JSON. No trace, screenshot, Office
document, preserved review body, C05 request/response payload or DOM snapshot
is extracted. The parser retains its entry, byte and depth bounds.

Output is limited to pinned provenance, scenario status/duration, sanitized
step titles/error codes/API modes/file:line and step hierarchy, existing
transport fields (method/mode/resource/status/elapsed/codes), and numeric or
boolean timing values. It does not print raw URLs, signed locations, headers,
cookies, tokens, payloads, CLI log bodies or attachment bodies. Four actual
installation manifests must match the original snapshot. No result is treated
as a fresh product run.

## Isolated workflow and pending gate

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

The reader is prepared with `[skip ci]`. Its single CI snapshot will add only
the request after cold review and authorization. No product compiler, browser
retry, nominal rerun, integration or sf-ci execution is part of this work.
