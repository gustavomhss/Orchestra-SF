# Restricted Maestro recording: source contract and limits

This is a separate recording candidate, `C-chat-restricted-context`. Its purpose is
to demonstrate a real response to explicitly supplied examples with tool access
denied by the ordinary product configuration. The previous run
[45048033900](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45048033900)
remains a failed historical attempt; no response from it is selected as success.

## Authorized operator setup

Only the fresh private workspace created by `withDesignInstallation(..., "four")`
is used. The original local-operator enrollment, installation ownership, project
selection, and host environment are retained. In particular,
`ORCHESTRA_DISABLE_PROJECT_CONFIG` is not changed.

1. Read the actual Maestro and its project file through the public location API.
2. Trust only that existing physical private workspace through the ordinary
   `POST /api/trust/approve` route, if it is not explicitly trusted already.
3. Copy every present editable non-permission field and the exact file revision
   from `GET /api/agent/maestro/file`; set only `permission: {"*": "deny"}` in the
   revision-protected public PUT.
4. Read the file, resolved agent, and agent detail again. All non-permission file
   fields and all resolved non-permission fields must match before and after.
   The core system/steps/engine/role fingerprint is checked again immediately
   before the actual UI send.
5. Require a resolved universal action/resource denial, with only further denies
   after it. Available skills must be empty. Advertised descriptors may be empty
   or contain only the source-proven residual `skill` descriptor described below.
6. Reload the actual Agents page normally, show its Tools tab and inherited deny
   labels, then open a real Chat draft, select the actual model, type the example,
   and click Send. The session's ordinary Ask control remains unchanged.

The setup is an explicit operator configuration. It does **not** claim that the
effective full request is identical to the unrestricted attempt: the original
core system, steps, engine and role remain unchanged, while permission-dependent
skill guidance and tool schemas change through the existing runtime.

The proposed editorial badge is **Provided facts · Tool access denied**. It must
not claim “no advertised tools” when the original registry retains `skill`.

## Pinned product-source evidence

All paths below are at
`55d332a2451d2146e825d494b87878875d63b1c7`, the actual product source used by this
recording family.

| Contract | Exact source |
|---|---|
| Public GET/PUT agent-file and `/detail` routes with location envelopes | [protocol/groups/agent.ts](https://github.com/gustavomhss/Orchestra-SF/blob/55d332a2451d2146e825d494b87878875d63b1c7/packages/protocol/src/groups/agent.ts), blob `edc5df027602a83e1a85a90f89c8f93939d7a7c0` |
| Editable fields, omitted-field behavior, revision | [schema/agent-file.ts](https://github.com/gustavomhss/Orchestra-SF/blob/55d332a2451d2146e825d494b87878875d63b1c7/packages/schema/src/agent-file.ts), blob `1fd3774ad15a772b5895ffd4351fc55206cb30c4` |
| Protected Maestro role, preservation of other frontmatter, exact revision conflict, replacement of representable permission rules | [config/agent-file.ts](https://github.com/gustavomhss/Orchestra-SF/blob/55d332a2451d2146e825d494b87878875d63b1c7/packages/core/src/config/agent-file.ts), blob `a9c4b087c78a6e6de5cc809091d583d16838b662` |
| Normal trust API, existing absolute physical directory, no filesystem-root approval | [protocol/groups/trust.ts](https://github.com/gustavomhss/Orchestra-SF/blob/55d332a2451d2146e825d494b87878875d63b1c7/packages/protocol/src/groups/trust.ts), blob `6edc0294a84214180849fb00e25ce7f5a10ea381`; [config/trust.ts](https://github.com/gustavomhss/Orchestra-SF/blob/55d332a2451d2146e825d494b87878875d63b1c7/packages/core/src/config/trust.ts), blob `a8b068f1fdb5c01e59ad43c56b9e6241ec3dfc78` |
| V2 configuration rereads global trust; normal agent reload rescans a newly created local `.orchestra` directory and still applies `ConfigTrust.runnable` | [config.ts](https://github.com/gustavomhss/Orchestra-SF/blob/55d332a2451d2146e825d494b87878875d63b1c7/packages/core/src/config.ts), blob `55ab9355db79be66fecd29f7ad45ea3d5128d391`; [config/plugin/agent.ts](https://github.com/gustavomhss/Orchestra-SF/blob/55d332a2451d2146e825d494b87878875d63b1c7/packages/core/src/config/plugin/agent.ts), blob `8e21386d092d22bd54ebece9a1279eb14f08b235` |
| Config-agent is booted normally, without a legacy environment-flag gate | [plugin/internal.ts](https://github.com/gustavomhss/Orchestra-SF/blob/55d332a2451d2146e825d494b87878875d63b1c7/packages/core/src/plugin/internal.ts), blob `f7d43af0a7d12df1fa5feb445ebe7e760887413c` |
| Actual descriptors are materialized from resolved permissions | [server/handlers/agent.ts](https://github.com/gustavomhss/Orchestra-SF/blob/55d332a2451d2146e825d494b87878875d63b1c7/packages/server/src/handlers/agent.ts), blob `640c9a2368bbe9d60c5921545fc52e9a9c649ed9`; [tool/registry.ts](https://github.com/gustavomhss/Orchestra-SF/blob/55d332a2451d2146e825d494b87878875d63b1c7/packages/core/src/tool/registry.ts), blob `27c06bb2060a792ca1a2237673f2627b8d04f3fc` |
| Possible residual `skill` descriptor: seat visibility appends only named skill denials; registry's advertisement check sees the last action match, while every runtime resource remains denied by the universal rule plus deny-only suffix | [coordination/v2/seats.ts](https://github.com/gustavomhss/Orchestra-SF/blob/55d332a2451d2146e825d494b87878875d63b1c7/modules/maestro/coordination/src/v2/seats.ts), blob `3eed4ad44f884d61003dcbff6106e39ddeb06af2`; [skill-sources.ts](https://github.com/gustavomhss/Orchestra-SF/blob/55d332a2451d2146e825d494b87878875d63b1c7/modules/maestro/coordination/src/v2/skill-sources.ts), blob `f69456425da16565b69b3b1f9b8385c4130c9330` |
| Available catalog skills filter the actual `skill` permission for each name | [core/skill.ts](https://github.com/gustavomhss/Orchestra-SF/blob/55d332a2451d2146e825d494b87878875d63b1c7/packages/core/src/skill.ts), blob `4fe232a113aef92a3adde83cc2bfbea074945790` |
| Real Tools tab, actual descriptor list and permission controls | [agents-detail.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/55d332a2451d2146e825d494b87878875d63b1c7/packages/app-shell/src/orchestra/chapters/agents-detail.tsx), blob `edefd218e3917ed9f74b63f7d709fe50e7840791`; [agents-view.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/55d332a2451d2146e825d494b87878875d63b1c7/packages/app-shell/src/orchestra/chapters/agents-view.tsx), blob `675ae1f7d104a6158c4a1c3059ac6f2406451043`; [agents-roster.ts](https://github.com/gustavomhss/Orchestra-SF/blob/55d332a2451d2146e825d494b87878875d63b1c7/packages/app-shell/src/orchestra/chapters/agents-roster.ts), blob `a92bfe1e544a8a4fc88153d88a0f26ac80fc6f89` |

## Model, execution bounds, and qualification

The copied model helper retains the previous verified llama.cpp `b12632` and
Qwen3.5-0.8B Q8 model pins, checksums, configured 196608-token server context within the verified 262144-token native window, CPU
thread count, output cap and nine exact-session completion checks. Model licenses
and upstream pins remain in `scripts/onboarding/ai/SOURCES.md`.

Only the example prompt, helper claim wording, and HTTP server timeout change in
that copy. The prompt explicitly separates staffing from the purchase and states
that quotation evidence has not been supplied. It asks for missing evidence as a
request, not as an established fact. No answer text is provided or substituted.

The response guard is 20 minutes, the test guard 30 minutes, and the proposed job
guard 40 minutes. Numeric progress and the conservative same-task token/CPU stall
diagnostics remain intact. The original Ask-mode, exact-session identity,
completed persisted text, actual model and agent, no tools/errors, non-truncated
finish, real generation, and rendered text agreement are still required.

Technical completion does not approve the answer's content. The actual response
must separately address all three requested points without inventing source
evidence, linking quoted hours to staffing, claiming a system read, or claiming
approval is complete. Only then may the response enter the final edit/narration.

The media transport variant keeps the original full artifact and copies original
proof bytes unchanged. It adds the two explicit restriction proof files to its
whitelist and uses the distinct new example identity. It never changes playback
speed, freezes/replays frames, or creates product states.

## Targeted editorial retake after completed take3

Take3 (45063603551 / e4bbc8e5f06591d35c0ad95fa6b9aa16eb97ec79) completed genuine inference, but its answer was not selected for the final edit: it merely restated the staffing difference and assigned an unsupported “general team” to a vague future review. The next prompt explicitly asks about service coverage, missing quotation evidence and one concrete human verification, and prohibits invented roles. The underlying factual example, original Maestro role, supported permission restriction, model weights, sampling, deadlines and nine completion checks remain unchanged.

The capture also adds a stronger observed-identity attachment. It asserts that the complete actual assistant DOM body, normalized by the existing helper, equals the persisted answer. The original raw `actual-chat-answer-identity.json` attachment records same-session/message identity, exact DOM text and hashes; the compact transport copies it unchanged. This supplements film-report digest redaction without rewriting the film report, substituting a response or weakening the original completion checks.
