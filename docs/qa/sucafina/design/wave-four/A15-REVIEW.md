# A15 — independent contract review

Status: **PASS_WITH_LIMITS**. Read-only review by the Planner/Work agent of product `250e8faf80931c807a86c5f06c0e797de469adca`. This review is not a browser execution result.

## Original route and body

All seven A15 overrides change only `pathTemplate`, from `{mount}/{surface}` to `{mount}/dashboard`. The closed A15 input schemas contain neither `surface` nor `action`; F02 still rejects excess fields and adds the original action discriminator. The original CLI and module handlers accept this dashboard route. POST, effect, `sf=workbench-analysis`, JSON output and the 65,536-byte bound remain unchanged. The frozen catalog is unmodified.

| Operation | Effect | Body |
| --- | --- | --- |
| choices | read | action: choices |
| list | read | action: list, caseRef |
| read | read | action: read, runRef |
| output | read | action: output, runRef |
| prepare | prepare | action: prepare, input |
| start | mutation | action: start, input |
| cancel | mutation | action: cancel, runRef |

F02 generates a new idempotency key for POST reads. Prepare/start/cancel still require an explicit key. No input codec, operation grant or original producer was widened.

The CLI handler owns choices/prepare/start. It inspects a cloned Request before returning undefined for the remaining operations, preserving the original body for the workbench fallback. The local product composition calls that fallback, whose original analysis handler owns list/read/output/cancel.

## Observed health boundary

The added host observer publishes readiness only for choices and list. Choices uses the original private action `sf-human:analysis.prepare` and cases namespace. List uses `sf-human:analysis.read` with cases/contributions. Both bind original readers, installed persistence, producer identity and private authority, require stable state across two observations, and finish admission in finally. The observer does not create a case, model, run or result.

An empty model catalog is a valid source result. Catalog/history success does not qualify prepare/start/cancel, nor run read/output. Those flows need their own original admitted operation and real run.

## Sources

- [Operation registry](../../../../../packages/schema/src/sucafina/operation-registry.ts)
- [A15 schemas](../../../../../packages/schema/src/sucafina/analyses.ts)
- [F02 transport](../../../../../packages/client/src/sucafina/transport.ts)
- [CLI handler](../../../../../apps/cli/src/sucafina-product/analysis-http.ts)
- [Original workbench handler](../../../../../modules/sucafina/Sucafinav1/product/interface/analysis-http.ts)
- [Local composition](../../../../../modules/sucafina/Sucafinav1/local/entry.ts)
- [Reading health](../../../../../apps/cli/src/sucafina-product/native-ui/analysis-reading-health.ts)
- [Host binding](../../../../../apps/cli/src/sucafina-product/host-context.ts)

The final runtime result belongs in [VALIDATION.md](VALIDATION.md); Decisions9 later lost original case availability during its longer narrow/localized sequence and is not counted as a passing full journey.
