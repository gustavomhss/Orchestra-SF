# Attempt 8 — exact preview emission and direct source timing

The full first analytics journey still failed at its original **60-second preview response wait**. [Run 44990498105](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44990498105), test job `137110279816`, used product `d8faa155002f0a9f3df029d946a026462af65e69` and snapshot `9b4863d87ecbb9cca0516db439e979321f3f53fb`. Cleanup job `137112053274` succeeded. The existing production Playwright config, strict omni control, production channel, one worker and zero retries remained unchanged.

First-declaration overlay `2c9fde9f7ffcfa74dcd6e3077387350156059635` removes only the independent BI declaration from full spec `94c0de8e8e2016782156507256247a06b0c13ece`. The permanent UI42–UI44 assertions and budgets are unchanged. The original source preparation is `0e5745f13e3eaacabd4e19bd3b64e0d0f7b4c5e9`; helper `ebbab2a37b7f1fe5b65bbe4595dbc4b12347ae02` adds bounded request/response identity and elapsed-time diagnostics.

## Original source and timing

The genuine selection again registered once as version 1 for case version 6. Its original alternative pair, required criterion, source references, canonical returned receipt and fresh controls/comparison readbacks matched. The closed criterion-pair physical-read change was the only portfolio production delta since Attempt 7; its separate real integration and negative tests passed before this run.

| Original operation | HTTP/body | Measured elapsed time |
| --- | --- | ---: |
| Comparison before registration |200 / ok|25,795ms|
| Original human portfolio selection registration |200 / ok|78,614ms|
| Comparison after registration |200 / ok|27,053ms|
| Empty-case native history |200 / ok|425ms|
| Main-case native history |200 / ok|774ms|

These are direct timings from this execution. Earlier Attempt 7 comparison intervals were approximately 39/119/40 seconds; that comparison across hosted runs is not a controlled latency benchmark. The separate integration test directly demonstrated the physical-read reduction while retaining all original scenario resolves and negative fences.

At 05:48:49.853Z, Playwright observed **one original preview POST** targeted to the exact selected owner's mounted `/dashboard` endpoint. Its original 60-second response wait expired. No response status or body was observed before teardown, and no explicit evaluation was submitted. The request-emission evidence rules out a repeated client no-request failure; it does not on its own identify which server stage was pending. UI43 and UI44 remain unqualified.

## Screenshot review

All seven original JPEGs are durable. Only [the pending preview at timeout](UI42-preview-pending-after-60000ms.jpg) was actually emitted and inspected in this attempt. It shows the real source case, checked candidate and constraint, disabled controls during Running, and the existing pending skeleton. No success state or result is supplied. The six other captures remain explicitly unreviewed for this attempt in [manifest.json](manifest.json).

[Canonical artifact 14741482763](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44990498105/artifacts/14741482763): `playwright-ubuntu-24.04-1`, 8,807,370 bytes, SHA-256 `167be4e671dd2776a317ce92e2055a183a58c5bed437c3baf96764ea355a7f69`.

## Bounded diagnostic, not a changed passing criterion

Snapshot `ed96d0f667d6d2ed4516ca73115b6f3d165d4ab8`, [run 44991578651](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44991578651), observes the **same** first native request for up to 360 additional seconds after recording the original 60-second failure. It then rethrows that original failure. It never replays the request or submits an evaluation. Timers are inserted inside original method bodies, with per-Request aggregate counters for metric, comparison, selection and portfolio proof calls. Inputs, return values, published method identities and source checks are preserved; inclusive nested durations must not be summed as total latency.

The diagnostic has four snapshot-only overlays listed in the manifest. They must not be integrated into production. The permanent wait and product remain unchanged while this next execution measures whether the source completes and where the time is spent.
