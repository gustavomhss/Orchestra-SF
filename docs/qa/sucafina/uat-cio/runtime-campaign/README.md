# Runtime campaign for the 94 path-present model journeys

This package closes the missing **execution-control layer** between the model-user-journey audit and the append-only UAT evidence controller.

The audit reports an aggregate of 94 `PATH_PRESENT_RUNTIME_REQUIRED` journeys, but it does not publish a machine-readable per-story membership list. The controller therefore refuses to guess those IDs. A cold-reviewed selection receipt must contain **exactly 94 unique story IDs** before any agent packets are produced.

## Supported entrypoint

Use `docs/qa/sucafina/uat-cio/scripts/runtime_campaign/control.py` for both build and verification. `prepare.py` is the lower-level library; its structural checker alone is not the acceptance oracle.

The controller:

- reads the canonical 185 stories from `stories_70x2.jsonl` and `stories_e2e.jsonl`;
- requires exact candidate commit, tree and installed artifact SHA-256;
- requires exactly 94 unique stories explicitly classified `PATH_PRESENT_RUNTIME_REQUIRED`;
- rejects conditional-release stories, duplicates, unknown IDs, source-state drift and secret-bearing keys;
- emits one closed JSON job per story with original steps, expected outcomes, contraproofs and evidence requirements;
- creates deterministic waves with no overlap in surface, actor or fixture leases and bounded parallelism;
- refuses to write campaign or evidence inside the checkout;
- verifies structure, digests and exact equality with a fresh rebuild from the external reviewed selection and canonical source inventory.

It **does not** open a browser, log in, seed data, grant authority, execute a story, update `MATRIX-185-STORIES.csv`, or claim a PASS.

## Classification input

The private selection validates against `runtime-campaign/selection.schema.json`:

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

The array must contain exactly 94 entries. The example is intentionally incomplete and cannot pass validation. The selection and its classification receipt remain external review inputs; this repository does not invent them.

## Build and verify

Run only in an authorized operator environment. Keep selection, output and evidence outside Git:

```bash
python3 docs/qa/sucafina/uat-cio/scripts/runtime_campaign/control.py build \
  --selection /private/orchestra-sf/runtime-ready-94.json \
  --output /private/orchestra-sf/campaign-94 \
  --max-parallel 8

python3 docs/qa/sucafina/uat-cio/scripts/runtime_campaign/control.py check \
  --selection /private/orchestra-sf/runtime-ready-94.json \
  --directory /private/orchestra-sf/campaign-94
```

The output contains:

```text
manifest.json
jobs/SF-....json
```

`manifest.json` pins the candidate, tree, artifact, classification receipt, source inventory digest, selection digest, job digests and deterministic waves. Preparation always records `execution_status: NOT_RUN`.

The build command prints the manifest SHA-256. Preserve that value with the reviewed selection receipt. The check command does not trust a self-consistent manifest: it rebuilds the expected campaign from the supplied selection and current canonical story inventory, then requires byte-equivalent JSON objects for the manifest and every job.

## Evidence admission

After an agent finishes one job, an independent reviewer must complete the generated `sf-uat-evidence-v1` template. Raw screenshots, traces, authorization snapshots and private refs stay in secured storage. The sanitized record is admitted only through the existing append-only controller:

```bash
python3 docs/qa/sucafina/uat-cio/scripts/reconcile_execution.py \
  --record /private/sanitized-case.json \
  --evidence-ref QA-RUN-ALIAS
```

A generated template is not an admitted result. All placeholder fields must be replaced and the independent-review rules still apply.

## CI and adversarial checks

The test module remains named `runtime_campaign/test_reconcile_history.py`, so the existing UAT preflight discovery executes it without a workflow change. Coverage includes:

- exact 94-story cardinality;
- duplicate and conditional-story rejection;
- private-output enforcement;
- full job/wave structural verification;
- ordinary job-digest tampering;
- coordinated job plus manifest-digest tampering rejected by canonical rebuild.

No product, workflow, guard, waiver, tenant or Azure path is changed by this package.
