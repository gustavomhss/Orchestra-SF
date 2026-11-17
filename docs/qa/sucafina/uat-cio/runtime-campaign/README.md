# Runtime campaign for the 94 path-present model journeys

This package closes the missing **execution-control layer** between the model-user-journey audit and the existing append-only UAT evidence controller.

The audit records an aggregate of 94 `PATH_PRESENT_RUNTIME_REQUIRED` journeys, but its Markdown report does not publish a machine-readable per-story membership list. This package therefore refuses to guess those IDs. A reviewer must supply an immutable classification receipt containing **exactly 94 unique story IDs**; only then does the builder produce runnable agent packets.

## What it does

`docs/qa/sucafina/uat-cio/scripts/runtime_campaign/prepare.py`:

- reads the canonical 185 stories from `stories_70x2.jsonl` and `stories_e2e.jsonl`;
- requires exact candidate commit, tree and installed artifact SHA-256;
- requires exactly 94 unique stories, each explicitly classified `PATH_PRESENT_RUNTIME_REQUIRED` with an evidence reference;
- rejects conditional-release stories and any story no longer in `DESIGNED_NOT_EXECUTED` source state;
- emits one closed JSON job per story, preserving the original steps, expected outcomes, contraproofs and evidence requirements;
- assigns deterministic waves with no overlap in surface, actor or fixture lease keys;
- limits each wave to a configured parallelism cap;
- permits only `PASSED_WITH_EVIDENCE`, `FAILED_PRODUCT`, `BLOCKED_CAPABILITY` or `BLOCKED_ENVIRONMENT` as eventual outcomes;
- creates an `sf-uat-evidence-v1` template for later review and import through the existing `reconcile_execution.py` ledger;
- refuses to write the campaign or evidence inside the repository;
- verifies every job digest, wave mapping, lease collision and unexpected file before execution.

It **does not** open a browser, log in, seed data, grant authority, execute a story, update `MATRIX-185-STORIES.csv`, or claim a PASS.

## Classification input

The private selection must validate against `runtime-campaign/selection.schema.json` and have this shape:

```json
{
  "schema": "sf-runtime-ready-selection-v1",
  "candidate_sha": "<40 hex>",
  "candidate_tree_sha": "<40 hex>",
  "installed_artifact_sha256": "<64 hex>",
  "classification_source_ref": "audit/model-user-journeys@reviewed-receipt",
  "classification_source_sha256": "<64 hex>",
  "stories": [
    {
      "id": "SF-CAP17-P01",
      "classification": "PATH_PRESENT_RUNTIME_REQUIRED",
      "classification_evidence_ref": "audit-classification/SF-CAP17-P01"
    }
  ]
}
```

The `stories` array must contain exactly 94 entries. The example is intentionally incomplete and cannot pass validation by itself.

## Build and verify

Run only in an authorized operator environment, with the output path outside the checkout:

```bash
python3 docs/qa/sucafina/uat-cio/scripts/runtime_campaign/prepare.py build \
  --selection /private/orchestra-sf/runtime-ready-94.json \
  --output /private/orchestra-sf/campaign-94 \
  --max-parallel 8

python3 docs/qa/sucafina/uat-cio/scripts/runtime_campaign/prepare.py check \
  --directory /private/orchestra-sf/campaign-94
```

The output contains:

```text
manifest.json
jobs/SF-....json
```

`manifest.json` pins the candidate, tree, artifact, audit receipt, source inventory digest, selection digest, job digests and deterministic waves. The execution status is always `NOT_RUN` at preparation time.

## Evidence admission

After an agent finishes one job, an independent reviewer must complete the generated `sf-uat-evidence-v1` record and keep raw screenshots, traces and authorization snapshots in secured storage. The sanitized record is then admitted through the existing command:

```bash
python3 docs/qa/sucafina/uat-cio/scripts/reconcile_execution.py \
  --record /private/sanitized-case.json \
  --evidence-ref QA-RUN-ALIAS
```

The campaign builder never bypasses that ledger, its hash chain or its independent-review rules.

## CI and adversarial checks

The test module is deliberately named `runtime_campaign/test_reconcile_history.py`, so the existing UAT preflight discovery command executes it without adding a workflow or runner. It checks:

- exact 94-story cardinality;
- duplicate and conditional-story rejection;
- private-output enforcement;
- full job/wave verification;
- tampered-job digest rejection.

No protected workflow, guard, waiver, product, tenant or Azure path is changed by this package.
