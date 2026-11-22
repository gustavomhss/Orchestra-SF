# Native Team Chat — production benchmark evidence

## Observed outcome

The corrected control [45042022479](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45042022479) completed **18/18 cases**, with three repetitions and no retries. All original assertions passed. The earlier 50–57% streaming slowdown did not recur in this control.

The active-session adapter defect is independently fixed: the generated API returns `{ data, namespace? }`, while the generic app needs the data map. The previous adapter enumerated the envelope and requested the nonexistent session `data`. The corrected adapter extracts the map and refuses a corporate namespace that it cannot admit. The actual generated client and HTTP boundary are exercised by the focused controls.

These measurements do **not** isolate the patch's causal performance effect. The final runner used AWS/us-west-2 and Ubuntu image revision 20261116.133.1; the earlier runs used Azure and revision 20261116.376.1. CPU SKU and load were not recorded. Three repeats on different runners support the observations below, not a universal speedup or a stable performance margin.

## Comparable observations

| Role | Source SHA | Run | Result used |
| --- | --- | --- | --- |
| Original pre-Chat tabs | `6c96110aea248594f47e92cfd569e97867f72396` | [45031940658](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45031940658) | Six valid tab cases only |
| Repaired pre-Chat streaming/review | `685befe8c5cd4d940769db2320f0115b8db071ab` | [45036866886](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45036866886) | 12/12 PASS |
| First integrated observation | `fde191dfc1970d37021d82370cccac657efac246` | [45037404119](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45037404119) | 18/18 PASS; slower streaming observed |
| Corrected adapter control | `bf9b3b03be1fb295999acc3bb7051392f0a89efd` | [45042022479](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45042022479) | 18/18 PASS; slowdown not reproduced |

The source and disposable runner SHA are separate in each JSON record. The final performance runner is `e14308fd848ad8c12e67882d61ec02c9f1728572`; the source tree is `4f76b0657a344ba031a31dfbaf0253c080e2e6cd`. The later literal-only test correction does not change the production adapter. The subsequent Team business projection is backend code and does not change the generic UI or benchmark files measured here.

## Streaming completion

Medians of three samples, in seconds. The workload has CPU throttle **30**, **320 history turns**, **160 deltas** and **eventBatch 1**; these are synthetic benchmark times, not real-provider latency.

| Scenario | Repaired baseline | First integrated | Corrected | Corrected vs baseline |
| --- | ---: | ---: | ---: | ---: |
| Review closed, no diffs | 88.6330 | 133.1622 | 73.4959 | −17.08% |
| Review closed, 72 diffs | 92.6158 | 140.1082 | 77.7278 | −16.07% |
| Review open, 72 diffs | 128.6762 | 201.6229 | 102.7436 | −20.15% |

The three final ranges are 73.4395–76.4962 s, 71.6545–84.0241 s and 88.5223–103.8072 s. Complete samples, RAF gaps, long-task time and first-content observations remain in [comparison.json](./comparison.json) and the raw records.

## Functional and rendering invariants

All nine final streaming samples delivered 160 deltas, left zero pending, reached observed progress 160 and produced 3,515 text characters. The row and Markdown DOM nodes were preserved. Streaming geometry recorded zero drift and zero blank samples.

The six tab cases contain 90 transitions. Wrong-destination, unknown-destination and missing/replaced review-host samples were all zero. Tabs did record **140 transient blank samples**, versus 147 in the original baseline and 152 in the first observation. Zero blanks is therefore a streaming-only statement.

The isolated review case uses 72 history turns and 72 diffs without the streaming CPU throttle. Its final median stable-ready time was 323.2 ms, versus 344.2 ms in the repaired baseline. Tab comparisons use the median of three per-repeat medians, each built from five transitions. Their exact summaries are in the raw records.

## Preserved history and methodology

The original baseline failed its 12 streaming/review cases. Those failures remain in [baseline-before-chat.json](./baseline-before-chat.json); they are excluded from the repaired streaming baseline.

The fixture repair corrected the original `session.next.text.*` names and emits one `server.connected` greeting for its logical endpoint queue. Repeating a greeting in every finite response falsely signaled a reconnect, causing a static HTTP refetch to remove the streamed text. The same repaired fixture was used before and after Chat. The renderer, assertions, workload, three repeats, no-retry setting and single worker were preserved.

This fixture uses finite HTTP response batches for its synthetic SSE queue. It is not a physical continuous-SSE network measurement. CPU and visual profiling were disabled; DOM/geometry observations do not constitute a pixel comparison. No machine-specific release threshold was introduced.

The first integrated run took 32m07s for the Playwright command; the corrected control took 18m18s. The build portions were approximately 58s and 43s. The records support where time was observed, not an exclusive causal attribution to the adapter patch.

## Files and operational boundary

- [baseline-streaming-repaired.json](./baseline-streaming-repaired.json): 12 valid baseline records, fixture rationale and failed-run history.
- [after-chat-first.json](./after-chat-first.json): the slower 18-case observation, kept intact.
- [after-chat-corrected.json](./after-chat-corrected.json): the final 18-case control and artifact identity.
- [comparison.json](./comparison.json): numeric samples, descriptive comparisons, environments and precise invariant scopes.
- [../teams-native-chat-components.json](../teams-native-chat-components.json): source-bound runtime, authority, generation, types and G08 control evidence.

These are production-browser component observations. No LIVE Microsoft identity, installed G08/G10 qualification, real provider completion or production cutover is claimed.
