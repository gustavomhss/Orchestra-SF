# Actual local model for the onboarding recording

This helper belongs only to the isolated `onboarding-recording` branch. It prepares a real CPU model in the ephemeral GitHub Actions recording job and connects it through Orchestra's supported provider configuration API. The final answer must be submitted, streamed, and shown by the actual Chat UI. No response is injected, replaced, replayed, or hardcoded.

## Pinned public assets

| Asset | Pin | SHA-256 | Bytes | License |
| --- | --- | --- | ---: | --- |
| Official llama.cpp Ubuntu x64 CPU binary | `b12632`, source commit `8cb0d98ccd0a310879ae8eaa1ce2c41e4b40a052` | `3fe2107f1f58d7fb77c514d65b5873dc68ffe999f8e7fd3789a4448d477eb6e2` | 23,226,195 | MIT |
| Official Qwen3-0.6B Q8_0 GGUF | `Qwen/Qwen3-0.6B-GGUF`, revision `1eaf4d9657fe65ad10a51eab76a8db5b363bddaa` | `9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031` | 639,446,688 | Apache-2.0 |

Primary sources checked on 2026-11-22:

- [Official llama.cpp release b12632](https://github.com/ggml-org/llama.cpp/releases/tag/b12632). This is a pinned **prerelease** used for ephemeral recording, not a production release qualification. The selected asset is `llama-b12632-bin-ubuntu-x64.tar.gz` (asset ID 779362116); GitHub release metadata supplies its SHA-256 digest.
- [Exact llama.cpp server documentation](https://github.com/ggml-org/llama.cpp/blob/b12632/tools/server/README.md), covering `/health`, OpenAI-compatible `/v1/chat/completions`, `/v1/models`, `--metrics`, CPU/context/output settings and Qwen thinking switches.
- [llama.cpp MIT license](https://github.com/ggml-org/llama.cpp/blob/b12632/LICENSE).
- [Official Qwen GGUF model card](https://huggingface.co/Qwen/Qwen3-0.6B-GGUF), including Apache-2.0 licensing and non-thinking sampling guidance.
- [Pinned Qwen model revision](https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/commit/1eaf4d9657fe65ad10a51eab76a8db5b363bddaa).
- [Official Q8_0 LFS pointer](https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/raw/1eaf4d9657fe65ad10a51eab76a8db5b363bddaa/Qwen3-0.6B-Q8_0.gguf), whose SHA-256 object ID and exact size are enforced before starting inference.
- [Qwen Apache-2.0 license](https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/blob/1eaf4d9657fe65ad10a51eab76a8db5b363bddaa/LICENSE).

No API key, paid inference service, new account, Azure setting, or production provider is used. The model and binary are downloaded from official public sources into the owned temporary directory and removed after the managed process exits. They are not committed to the repository or included in the final video artifact. If redistribution is added later, retain the corresponding license and notice files.

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

CPU latency and the full agent system-context size still need measurement in recording CI. The fixture allows a 120-second server-load deadline; the recording test should allow several minutes for setup and an initial response. If a wait is shortened during editing, mark it. A context or inference failure is a failed recording attempt; no substitute text is permitted.
