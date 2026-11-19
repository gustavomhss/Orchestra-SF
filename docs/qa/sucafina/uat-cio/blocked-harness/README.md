# Preflight harness for 13 capability-blocked and 8 environment-blocked stories

This package closes the missing fail-closed preflight for the **21 model-user journeys that cannot be judged from product code alone**:

- 13 `BLOCKED_CAPABILITY` candidates;
- 8 `BLOCKED_ENVIRONMENT` candidates.

It does not execute those journeys. It observes whether each reviewed prerequisite exists on one exact installed candidate and emits a ready/incomplete result or a sanitized blocked record compatible with the append-only UAT ledger.

## Supported entrypoint

Use `docs/qa/sucafina/uat-cio/scripts/blocked_harness/control.py` for both evaluation and verification. `evaluate.py` is the lower-level library; its structural checker alone is not the acceptance oracle.

The controller additionally:

- binds every selected `actor_role` to an actor explicitly declared by the canonical source story;
- validates every generated blocked record with `reconcile_execution.validate_record`;
- re-evaluates the complete bundle from the external reviewed selection and observations during checking;
- rejects coordinated edits to a result/record and its manifest digest.

## Why classification is an input

The audit publishes the aggregate counts 13 and 8, but not a machine-readable per-story membership map. The harness therefore requires a cold-reviewed classification receipt containing exactly 21 unique IDs. It will not infer capability or environment status from a title, route, branch name, open PR or absent UI control.

## Closed inputs

`blocked-harness/contracts.schema.json` documents two private sanitized inputs.

### Reviewed classification

Each story declares:

- exact story ID and an actor role already present in the canonical story;
- `BLOCKED_CAPABILITY` or `BLOCKED_ENVIRONMENT`;
- immutable classification evidence reference;
- one or more explicit requirements;
- requirement kind, safe blocked reason code and description.

The controller enforces exactly **13 capability + 8 environment** stories. Capability stories may use only capability requirement kinds; environment stories may use only environment kinds.

### Exact-candidate observations

Every requirement must have one sanitized observation pinned to the same:

- product commit SHA;
- Git tree SHA;
- installed artifact SHA-256;
- preflight bundle SHA-256;
- UTC observation timestamp.

Observation states are only `PRESENT`, `ABSENT` or `UNAVAILABLE`. Raw tokens, cookies, passwords, authorization headers and client secrets are forbidden from input and output contracts.

## Result semantics

| Story class | Observation | Result |
|---|---|---|
| Capability | any required capability `ABSENT` | `BLOCKED_CAPABILITY` |
| Capability | no absence, but any probe `UNAVAILABLE` | `PRECHECK_INCOMPLETE` |
| Capability | every requirement `PRESENT` | `READY_FOR_EXECUTION` |
| Environment | any requirement `ABSENT` or `UNAVAILABLE` | `BLOCKED_ENVIRONMENT` |
| Environment | every requirement `PRESENT` | `READY_FOR_EXECUTION` |

`READY_FOR_EXECUTION` is **not PASS**. The journey still needs its real actor, browser, source reread, contraproof and independent evidence review.

Terminal `BLOCKED_CAPABILITY` and `BLOCKED_ENVIRONMENT` results create sanitized `sf-uat-evidence-v1` records. `READY_FOR_EXECUTION` and `PRECHECK_INCOMPLETE` create no ledger record.

## Evaluate and verify

Run in an authorized operator environment. Inputs and output must remain outside the checkout:

```bash
python3 docs/qa/sucafina/uat-cio/scripts/blocked_harness/control.py evaluate \
  --selection /private/orchestra-sf/blocked-21-selection.json \
  --observations /private/orchestra-sf/blocked-21-observations.json \
  --output /private/orchestra-sf/blocked-21-result

python3 docs/qa/sucafina/uat-cio/scripts/blocked_harness/control.py check \
  --selection /private/orchestra-sf/blocked-21-selection.json \
  --observations /private/orchestra-sf/blocked-21-observations.json \
  --directory /private/orchestra-sf/blocked-21-result
```

The output contains:

```text
manifest.json
results/SF-....json
records/SF-....json   # terminal BLOCKED_* results only
```

The evaluate command prints the manifest SHA-256. Preserve it with the reviewed classification receipt and observation bundle. The check command rebuilds every result and record from those external inputs and requires exact JSON-object equality.

## Ledger admission

After independent review, each blocked record can be admitted individually:

```bash
python3 docs/qa/sucafina/uat-cio/scripts/reconcile_execution.py \
  --record /private/orchestra-sf/blocked-21-result/records/SF-....json \
  --evidence-ref QA-PREFLIGHT-ALIAS
```

The control entrypoint validates compatibility but never writes the ledger itself.

## CI and contraproofs

The test module remains named `blocked_harness/test_reconcile_history.py`, matching the existing UAT preflight discovery pattern without workflow changes. It proves:

- exact 13/8 cardinality;
- canonical actor-role binding;
- compatibility with the append-only ledger contract;
- `UNAVAILABLE` capability probes cannot become capability absence;
- present dependencies yield only `READY_FOR_EXECUTION`, never PASS;
- SHA mismatch, ordinary tampering and coordinated manifest tampering fail closed;
- output cannot be stored in Git.

No product, workflow, guard, waiver, tenant, Azure or release path is changed by this harness.
