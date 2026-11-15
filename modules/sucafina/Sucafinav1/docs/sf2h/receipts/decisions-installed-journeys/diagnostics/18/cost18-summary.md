# Diagnostic18 — supplied CLI profiles

Parser state: `PARSED_VALID_PROFILES`. This diagnostic is not an acceptance run.

| Input | Ordinal | Mode | Events | End elapsed (ms) | Handler outcome | Active stages at abort |
|---|---:|---|---|---:|---|---|
| 1 | 1 | compare | start → end | 4668.120 | returned | — |
| 1 | 2 | compare | start → end | 4537.302 | returned | — |
| 1 | 3 | compare | start → end | 6774.434 | returned | — |
| 1 | 4 | choose | start → end | 8129.195 | returned | — |
| 1 | 5 | choose | start → end | 517.181 | returned | — |

## Interpretation limits

- Each input is a separate CLI process stream; ordinals are process-local and do not identify a test, user, case or request payload.
- Stage durations are inclusive and may overlap. Do not add parent and child buckets or compare their sum with wall time.
- completed and count mean a measured call settled, whether it returned or threw; they do not mean a successful business operation.
- active = started - completed describes calls still in flight at that event; their unfinished durations are absent from total_ms and max_ms.
- Mode aggregates use only the end snapshot once per profile. An abort snapshot is cumulative evidence at that instant, not another completed profile.
- choice.capture is inside choice.save; runtime surface buckets are inside their root bucket; auth.sql is inside auth.read; canonical digests may be nested in any of these.
- The HTTP root timer includes handler admission and finalization. It does not measure browser receipt or prove an HTTP response, persisted choice or test success.
- The abort event is the server Request.signal observation; absence does not prove that the browser did not abort. post_abort_until_end_ms is server continuation only.
- An absent stage is merely not observed in the supplied log; a missing end or active work at end remains explicit.
- This is diagnostic-only evidence and supplies no nominal acceptance fragments.
