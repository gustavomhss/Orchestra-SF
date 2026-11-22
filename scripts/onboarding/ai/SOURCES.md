# Actual local model for the onboarding recording

This helper belongs only to the isolated `onboarding-recording` branch. It prepares a real CPU model in the ephemeral GitHub Actions recording job and connects it through Orchestra's supported provider configuration API. The final answer must be submitted, streamed, and shown by the actual Chat UI. No response is injected, replaced, replayed, or hardcoded.

## Pinned public assets

| Asset | Pin | SHA-256 | Bytes | License |
| --- | --- | --- | ---: | --- |
| Official llama.cpp Ubuntu x64 CPU binary | `b12632`, source commit `8cb0d98ccd0a310879ae8eaa1ce2c41e4b40a052` | `3fe2107f1f58d7fb77c514d65b5873dc68ffe999f8e7fd3789a4448d477eb6e2` | 23,226,195 | MIT |
| llama.cpp team conversion of Qwen3.5-0.8B Q8_0 GGUF | `ggml-org/Qwen3.5-0.8B-GGUF`, revision `316dea3b5462fd5755862bcec45a2f901bc0ba6b` | `37ae482d336108d23516fa35e8e0c4126688d81018b87178a18d752a1357814f` | 833,592,096 | Apache-2.0 |

Primary sources checked on 2026-11-22:

- [Official llama.cpp release b12632](https://github.com/ggml-org/llama.cpp/releases/tag/b12632). This is a pinned **prerelease** used for ephemeral recording, not a production release qualification. The selected asset is `llama-b12632-bin-ubuntu-x64.tar.gz` (asset ID 779362116); GitHub release metadata supplies its SHA-256 digest.
- [Exact llama.cpp server documentation](https://github.com/ggml-org/llama.cpp/blob/b12632/tools/server/README.md), covering `/health`, OpenAI-compatible `/v1/chat/completions`, `/v1/models`, `--metrics`, CPU/context/output settings and Qwen thinking switches.
- [llama.cpp MIT license](https://github.com/ggml-org/llama.cpp/blob/b12632/LICENSE).
- [Official Qwen3.5-0.8B model card at its pinned upstream revision](https://huggingface.co/Qwen/Qwen3.5-0.8B/blob/2fc06364715b967f1860aea9cf38778875588b17/README.md): Apache-2.0, native 262,144-token context, default non-thinking mode. This small model is intended for prototyping and development.
- [Exact primary Qwen configuration](https://huggingface.co/Qwen/Qwen3.5-0.8B/blob/2fc06364715b967f1860aea9cf38778875588b17/config.json): 24 hybrid layers, six full-attention layers, two KV heads of dimension 256, `max_position_embeddings: 262144`.
- [Pinned llama.cpp team GGUF revision](https://huggingface.co/ggml-org/Qwen3.5-0.8B-GGUF/tree/316dea3b5462fd5755862bcec45a2f901bc0ba6b). Its `.src_sha` identifies upstream Qwen commit `2fc06364715b967f1860aea9cf38778875588b17`.
- [Exact Q8_0 LFS pointer](https://huggingface.co/ggml-org/Qwen3.5-0.8B-GGUF/raw/316dea3b5462fd5755862bcec45a2f901bc0ba6b/Qwen3.5-0.8B-Q8_0.gguf). The recording owner verified its object ID and size; download enforces both before loading.
- [Primary Qwen Apache-2.0 license](https://huggingface.co/Qwen/Qwen3.5-0.8B/blob/2fc06364715b967f1860aea9cf38778875588b17/LICENSE).
- [Pinned llama.cpp argument source](https://github.com/ggml-org/llama.cpp/blob/8cb0d98ccd0a310879ae8eaa1ce2c41e4b40a052/common/arg.cpp): `--timeout` controls server read/write seconds. The bounded long recording sets it to **7,800 seconds**. This is an I/O allowance, not a throughput improvement or a completed-answer claim.


No API key, paid inference service, new account, Azure setting, or production provider is used. The model and binary are downloaded from the model author and llama.cpp team public sources into the owned temporary directory and removed after the managed process exits. They are not committed to the repository or included in the final video artifact. If redistribution is added later, retain the corresponding license and notice files.

## Product contract verified at exact base

All following source paths are at [`55d332a2451d2146e825d494b87878875d63b1c7`](https://github.com/gustavomhss/Orchestra-SF/tree/55d332a2451d2146e825d494b87878875d63b1c7):

- `packages/app-shell/e2e/sucafina/design-support/installation.ts`: actual native installation and managed `AppProcess.Service` / `LayerNode.compile(AppProcess.node)` scope.
- `packages/protocol/src/groups/config.ts` and `packages/server/src/handlers/config.ts`: supported authenticated `PATCH /api/config`; providers and model default may be configured without rewriting permission or disabled-provider lists.
- `packages/core/src/config/plugin/provider.ts`: credential-free providers work when `env` is omitted. Supplying an empty `env` array has different integration semantics and is intentionally avoided.
- `packages/core/src/session/runner/model.ts`: the OpenAI-compatible package uses the native model transport, configured endpoint and no authentication when no credential is supplied.
- `packages/core/src/session/runner/execution-host.ts`: Maestro with `engine: orchestra`, or no engine and a non-Anthropic session model, uses Orchestra's own loop. The helper requires the actual Maestro; it never substitutes another primary agent. If needed, the recording uses the ordinary Providers engine selector before invoking this helper. The helper writes no agent engine override.
- `packages/protocol/src/groups/agent.ts`, `model.ts`, `provider.ts`, and `message.ts`: ordinary authenticated API readback verifies catalog admission, actual agent identity and persisted Chat messages.

The public config schema exposes model names, not model limits or arbitrary generation settings. The helper therefore supplies only accepted keys and bounds context/output in the owned llama-server process. It does not change product schemas or try to override transport-protected request fields.

## Recording integration

Publish `local-model.ts` to `packages/app-shell/e2e/sucafina/design-support/local-model.ts`. Inside the existing native installation callback, after normal local-operator authentication, call:

```ts
await withLocalModel(context.request, installation, async (local) => {
  // Use the real Open project → Search folders flow for installation.root + '/workspace'.
  // In the actual UI, open Maestro's Chat, select local.modelName, then send local.prompt.
  // Wait for the real response to finish, and obtain the actual session ID from its URL.
  await local.captureProof(actualSessionId)
}, record)
```

`record(name, object)` must attach or save JSON in the recording artifact. The helper emits setup, readiness and actual Chat proof. The last includes the real persisted answer, selected IDs, completion time, token accounting when available, numeric server metrics and timings, plus explicit checks. Failures include bounded error name/code/message fields and a filtered startup tail; prompts, headers and credential values are not collected from server logs. It fails for an incorrect prompt/model/agent, an incomplete or empty response, any tool call or assistant error, truncation, or absent generated-token evidence.

Model readiness and configuration are not proof of an AI answer. Only the completed UI journey plus `captureProof` qualify the footage. The helper has not been executed locally; Linux CI is the execution and verification environment.

## Scope and practical limitations

Use the video label **“Local demonstration model”**. This is a small model demonstrating real inference through Orchestra. It does not establish production model quality, Microsoft tenant access, business-data retrieval, skill execution, Teams readiness, or a successful HuGR Claw connector action. The prompt explicitly supplies example staffing and quotation inputs, then requests three review questions or checks. It forbids tools, writes and claims to have inspected the business system. The example inputs are entered by the demonstrator, not retrieved by the model.

CPU latency must be measured in recording CI. The server-load deadline remains 120 seconds. The bounded long Chat-only recording allows a **120-minute response wait**, within a **130-minute test** and a **140-minute recording job**. There is no latency or completion promise. If waiting is shortened during editing, mark it. A context or inference failure is a failed recording attempt; no substitute text is permitted.

## Preserved prior observations and focused Chat take

The [AI3 recording](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45039502239) observed all five SF profiles, eighteen SF skills, the shared Maestro catalog (103 advertised tools and 67 skills), Connections, and the real empty Atlas store. Those original cuts remain valid. The first follow-up [run45041154033](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45041154033) genuinely sent the visible prompt, but Qwen3-0.6B rejected the unmodified request: **148,598 tokens against its configured 32,768 context**. Its actual GGUF training limit was 40,960. No completed Chat answer from that take qualifies. The generated session title does not qualify as the requested answer.

The same take proved that the physical Actions checkout still resolved to the `global` project. Its Workflow admission stayed intact. The next recording is **Chat only**, with no Workflow attempt or catalog replay.

Desktop Chat uses platform Maestro. `context/local.tsx` fixes its current agent to `maestro`, and Agents→Open Chat carries no alternate profile. An `@sf_reviewer` mention asks Maestro to use the task tool; it is not a direct Sucafina-agent session. The visible permission UI controls fourteen standard groups and configured MCP servers, not every native tool. The recording therefore preserves the complete original Maestro, all tool schemas, all prompts, and all permission rules, and changes only the owned demonstration model and its supported capacity.

### Capacity and memory proof

Qwen3.5-0.8B has a native 262,144-token context. The helper requests **196,608**, with one slot, and verifies actual `/v1/models` `meta.n_ctx_train >= 196608` plus `/props` `default_generation_settings.n_ctx === 196608`. No RoPE scaling, tokenizer, prompt, or tool schema override is used. The model alias is `qwen35-demo`; the UI name is **Qwen3.5-0.8B · local demo**. Non-thinking mode is supplied through the model's actual chat template; no special `/no_think` suffix is added to the business prompt.

The F16 full-attention KV estimate is six layers × two KV heads × 256 dimensions × key/value × two bytes × 196,608 tokens = **2.25 GiB**. The helper requires actual free RAM for that cache, the verified 833,592,096-byte model and an additional 2 GiB for hybrid state, batching and overhead; it records total/free RAM before load and free RAM afterward. Up to four actual available CPU threads are used. These capacity checks are separate from measured inference performance.

The public custom-provider API accepts model names but does not expose model limits. Only supported API keys are written; the catalog's actual reported limits are recorded alongside the server capacity. No private configuration workaround or product schema change is used.

### Persisted response and pagination

`packages/server/src/handlers/message.ts` returns `cursor.next` for every nonempty page, including the last one. The proof follows each cursor **without combining it with `order`**, until it reads an empty page, with repeated-ID/cursor checks and a 2,000-message upper bound. It then records the exact persisted assistant response, actual selected model/agent, completion, finish reason, tool count, errors, numeric inference metrics and timings. Only agreement between this response and the real rendered assistant turn qualifies cue06.

The genuine draft model picker and Send button are retained. `OrchestraComposeTools` renders the untouched Ask/auto-accept control only after a session exists. The recording never clicks that permission control, then verifies it remains Ask. Each minute of a long inference wait can record elapsed time, message count, partial text length and the numeric telemetry below. The actual answer is stored in the final proof and remains visible in the continuous video.

### Bounded CPU progress telemetry

The [30-minute native-context attempt](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45042453784) completed only the automatic title: 642 prompt tokens and 13 generated tokens, with 14.593 seconds of prompt processing and 21.897 seconds of generation. At its deadline, one request remained processing and the context high watermark was 67,584. The requested Chat session contained one user message and no assistant response. These observations qualify neither a completed answer nor an exact current prompt total; the older 148,598-token count came from Qwen3, not Qwen3.5.

The long-attempt helper preserves the exact binary/model pins, 196,608-token context, four-thread cap, one slot, business prompt, complete Maestro instructions, all admitted tool schemas and policies. Apart from the HTTP timeout, it changes only observability. It retains the existing batch/microbatch defaults and Flash Attention `auto`; it does not introduce a speculative performance optimization.

`local.readProgress()` returns a fixed, safe projection:

Its `elapsedMs` and prefill `observedAtMs` share a clock beginning at helper setup. They are diagnostic timestamps, not the source-video clock or a substitute for the recorded UI-send timestamp.

- `/metrics` numerical counters, including `n_decode_total` and the context high watermark.
- `/slots` numerical slot/task identity, context, current prefix length, processed/cached tokens, decoded/remaining tokens and prediction limit, plus the processing boolean. The complete response may contain prompts, generated text or grammar; those fields are never forwarded, recorded or attached.
- Parsed numbers from the existing information-level prompt-processing line: slot/task IDs, processed tokens, fractional progress, elapsed seconds and tokens per second. No raw log line is retained.
- The owned child process's CPU ticks, start-time ticks, RSS/high-water RSS, swap and thread count, plus runner memory headroom and available CPU count. It reads only `/proc/<owned-pid>/stat` and `/proc/<owned-pid>/status`, never the command line or environment.
- Startup batch sizes, resolved Flash Attention support, a validated CPU-backend basename and a fixed list of numerical CPU capability flags. Backend paths and full diagnostic output are omitted.

Primary implementation references at the pinned llama.cpp commit:

- [Server state, progress and metrics](https://github.com/ggml-org/llama.cpp/blob/8cb0d98ccd0a310879ae8eaa1ce2c41e4b40a052/tools/server/server-context.cpp): `server_slot::to_json`, `print_timings_pp`, `metrics_post_decode` and `metrics_flush_prompt`. During prefill, `n_prompt_tokens` is the currently stored prefix, not necessarily the total request. Global prompt counters can remain at completed work until pending computation is synchronized.
- [Slot logging prefix](https://github.com/ggml-org/llama.cpp/blob/8cb0d98ccd0a310879ae8eaa1ce2c41e4b40a052/tools/server/server-common.h): the numeric parser follows the actual `SLT_INF` slot/task prefix and prompt-processing format.
- [Actual defaults](https://github.com/ggml-org/llama.cpp/blob/8cb0d98ccd0a310879ae8eaa1ce2c41e4b40a052/common/common.h): logical batch 2,048, physical microbatch 512, Flash Attention `auto`.
- [Flash Attention resolution](https://github.com/ggml-org/llama.cpp/blob/8cb0d98ccd0a310879ae8eaa1ce2c41e4b40a052/src/llama-context.cpp): `resolve_fused_ops` probes backend support; forcing `on` is not a demonstrated acceleration.
- [Backend selection](https://github.com/ggml-org/llama.cpp/blob/8cb0d98ccd0a310879ae8eaa1ce2c41e4b40a052/ggml/src/ggml-backend-reg.cpp): the loader selects a supported backend variant and emits the basename captured by the strict parser.
- [Effect process identity at the repository's pinned dependency](https://github.com/Effect-TS/effect-smol/blob/effect%404.0.0-beta.83/packages/effect/src/unstable/process/ChildProcessSpawner.ts): `ChildProcessHandle.pid` is the branded numeric PID of the owned process; `isRunning` is queried from the same managed handle.

Telemetry reads are bounded and best-effort. A missing or delayed read is not a failure of inference. The stall detector requires a real, active, identified task, valid per-slot and decode counters, a valid process-start identity and CPU accounting. It reports `suspected` only after **ten continuous minutes with neither token/decode progress nor CPU-time progress**. A new task/process, a decreasing counter, an unavailable diagnostic read, or an inactive slot resets that baseline. This conservative detector does not replace the finite response/test/job deadlines.

The helper retains at most 150 sampled progress objects and includes them in the final proof or failure receipt. A title's generated-token counter, provider readiness or prefill progress can never satisfy the existing exact-session assistant/model/agent/completion/text/no-tool/no-error checks. Only the actual completed answer and matching visible/persisted result qualify the Chat scene.
