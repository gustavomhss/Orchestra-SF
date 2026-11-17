# Preflight harness for 13 capability-blocked and 8 environment-blocked stories

This package closes the missing fail-closed preflight for the **21 model-user journeys that cannot be judged from product code alone**:

- 13 `BLOCKED_CAPABILITY` candidates;
- 8 `BLOCKED_ENVIRONMENT` candidates.

It does not execute those journeys. It observes whether each reviewed prerequisite exists on one exact installed candidate and emits either a ready/incomplete result or a sanitized `sf-uat-evidence-v1` blocked record suitable for the existing append-only UAT ledger.

## Why classification is an input

The model-user-journey audit publishes the aggregate counts 13 and 8, but not a machine-readable per-story membership map. The harness therefore requires a cold-reviewed classification receipt with exactly 21 unique IDs. It will not infer capability or environment status from a title, route, open PR, branch name or absence of a UI control.

## Closed contracts

`blocked-harness/contracts.schema.json` describes two private inputs.

### 1. Reviewed classification

Each story declares:

- exact story ID and actor role alias;
- `BLOCKED_CAPABILITY` or `BLOCKED_ENVIRONMENT`;
- immutable classification evidence reference;
- one or more explicit requirements;
- requirement kind, safe blocked reason code and human-readable description.

The evaluator enforces exactly **13 capability + 8 environment** stories. Capability stories may use only capability requirement kinds; environment stories may use only environment kinds.

### 2. Exact-candidate observations

Every requirement must have exactly one sanitized observation pinned to the same:

- product commit SHA;
- Git tree SHA;
- installed artifact SHA-256;
- preflight bundle SHA-256;
- UTC observation timestamp.

Observation states are only:

- `PRESENT`;
- `ABSENT`;
- `UNAVAILABLE`.

Raw tokens, cookies, passwords, authorization headers and client secrets are forbidden from the input and output contracts.

## Result semantics

The evaluator deliberately distinguishes absence from inability to inspect:

| Story class | Observation | Result |
|---|---|---|
| Capability | any required capability `ABSENT` | `BLOCKED_CAPABILITY` |
| Capability | no absence, but any probe `UNAVAILABLE` | `PRECHECK_INCOMPLETE` |
| Capability | every requirement `PRESENT` | `READY_FOR_EXECUTION` |
| Environment | any requirement `ABSENT` or `UNAVAILABLE` | `BLOCKED_ENVIRONMENT` |
| Environment | every requirement `PRESENT` | `READY_FOR_EXECUTION` |

`READY_FOR_EXECUTION` is **not PASS**. The journey still needs its real actor, browser, source reread, contraproof and evidence review.

For `BLOCKED_CAPABILITY` and `BLOCKED_ENVIRONMENT`, the harness creates a sanitized `sf-uat-evidence-v1` record containing the exact candidate pins, operator/actor aliases, observed result, safe reason code and secured trace reference. The existing `reconcile_execution.py --record` command remains the only writer of the committed UAT matrix and append-only ledger.

## Evaluate and verify

Run in an authorized operator environment. Both the inputs and output must stay outside the checkout:

```bash
python3 docs/qa/sucafina/uat-cio/scripts/blocked_harness/evaluate.py evaluate \
  --selection /private/orchestra-sf/blocked-21-selection.json \
  --observations /private/orchestra-sf/blocked-21-observations.json \
  --output /private/orchestra-sf/blocked-21-result

python3 docs/qa/sucafina/uat-cio/scripts/blocked_harness/evaluate.py check \
  --directory /private/orchestra-sf/blocked-21-result
```

The output contains:

```text
manifest.json
results/SF-....json
records/SF-....json   # only for terminal BLOCKED_* results
```

The verifier rejects changed digests, mixed candidate SHAs, missing observations, unexpected files, unsafe refs, secret-bearing keys and any execution or PASS claim.

## Ledger admission

After independent review, each blocked record can be admitted individually:

```bash
python3 docs/qa/sucafina/uat-cio/scripts/reconcile_execution.py \
  --record /private/orchestra-sf/blocked-21-result/records/SF-....json \
  --evidence-ref QA-PREFLIGHT-ALIAS
```

A `READY_FOR_EXECUTION` or `PRECHECK_INCOMPLETE` result intentionally has no ledger record. It is not a terminal story outcome.

## CI and contraproofs

The tests live at `scripts/blocked_harness/test_reconcile_history.py`, matching the existing UAT preflight discovery pattern without changing workflows. They prove:

- exact 13/8 cardinality;
- compatibility of generated blocked records with `reconcile_execution.validate_record`;
- `UNAVAILABLE` capability probes cannot be misreported as capability absence;
- present dependencies yield only `READY_FOR_EXECUTION`, never PASS;
- candidate mismatch and record tampering fail closed;
- output cannot be stored in Git.

No product, workflow, guard, waiver, tenant, Azure or release path is changed by this harness.
