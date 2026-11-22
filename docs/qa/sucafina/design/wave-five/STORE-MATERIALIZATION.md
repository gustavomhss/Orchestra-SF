# Bounded local snapshot materialization

The full-year original import preview produces a dashboard payload of 4,701,823 UTF-16 units. Trace 7 recorded a complete normalized JSON copy of 3,077,742 units and a retained plan of 7,780,555 units. That plan nearly filled the existing 8,388,608-unit memo before Planner and Procurement were read. The same bytes repeatedly lost their plan: 276 new plans and 16 hits after preview. The earlier oversized/no-copy hypothesis was disproved.

[Trace provenance](collab/attempts/import-trace-07.json) and the collab attempt records retain the exact disposable snapshot, source and original-response limitations. This is measured decoder churn; forwarded wall-clock log delays are not attributed entirely to CPU work.

## Correction

The memo uses its existing SHA-256 identity for SQL payloads above half of its unchanged string budget. A complete normalized copy may then fit alongside other surfaces without also retaining the tagged SQL envelope. Fingerprint copy factories capture only the immutable plan. They cannot use offsets into SQL text; large strings are fully represented within the same budget or the original decoder runs.

Every root still reads SQL and checks the observed UTF-16 bytes and their length. Each materialization is detached. The three-plan, 8 Mi-unit, 200,000-node, 128-depth and 4,096-missing-path limits remain. Actual ACL data, cancellation, transaction fences, original codec identity and same-length byte replacements remain authoritative. This bound counts retained string content, not graph overhead or total heap.

## Verification

[Strict production Actions run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44987840434): **42 passed, 0 failed, 2 existing privileged-UID fixtures skipped, 512 assertions**. The original AppProcess wrapper and Omni positive control passed; cleanup succeeded. [Machine-readable receipt](store-materialization.json).

The first run deliberately remains a failure: the new fixture was too small to enter the intended branch. The corrected fixture has 24,000 structured records and asserts the actual encoded/normalized sizes before checking byte identity across all three SQL surfaces. The runtime source is identical between both runs. No assertion about detached copies or replacement detection was relaxed.

The import browser journey is a separate qualification. A green storage suite does not establish UI56 success or a domain application.
