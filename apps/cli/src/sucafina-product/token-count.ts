import { InvalidRequestReason, LLMError } from "@orchestra/llm"
import type { RequestExecutor } from "@orchestra/llm/route"
import { Effect, Schema } from "effect"
import { HttpClientRequest } from "effect/unstable/http"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"

export type SfTokenCountReceipt = {
  schema: "sf-token-count-v1"
  oracle: "https://api.openai.com/v1/responses/input_tokens"
  model: string
  inputDigest: string
  requestDigest: string
  inputTokens: number
  contextBudgetTokens: number
  maxOutputTokens: number
  observedAt: string
}

/** This is an oracle adapter, not an installed Session gate. The host must enforce it on every SF turn. */
export function enforceSfResponseTokenBudget(request: HttpClientRequest.HttpClientRequest, executor: RequestExecutor.Interface, admission: {
  model: string
  contextBudgetTokens: number
  revalidate: () => Effect.Effect<boolean, unknown>
  persistReceipt: (receipt: SfTokenCountReceipt) => Effect.Effect<void, unknown>
}) {
  const bound = Object.freeze({ ...admission })
  return Effect.gen(function* () {
    const budget = bound.contextBudgetTokens
    if (!Number.isSafeInteger(budget) || budget < 1 || !bound.model) return yield* Effect.fail(refusal("invalid-budget-admission"))
    const url = URL.canParse(request.url) ? new URL(request.url) : undefined
    if (request.method !== "POST" || !url || url.origin !== "https://api.openai.com" || url.pathname !== "/v1/responses" ||
      url.search || url.hash || request.urlParams.params.length || request.body._tag !== "Uint8Array" || request.body.contentType.split(";", 1)[0] !== "application/json")
      return yield* Effect.fail(refusal("budget-provider-or-transport-unsupported"))
    const text = yield* Effect.try({ try: () => new TextDecoder("utf-8", { fatal: true }).decode(request.body._tag === "Uint8Array" ? request.body.body : new Uint8Array()), catch: () => refusal("budget-body-invalid") })
    const decoded = yield* Schema.decodeUnknownEffect(Schema.UnknownFromJsonString)(text).pipe(Effect.mapError(() => refusal("budget-body-invalid")))
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return yield* Effect.fail(refusal("budget-body-invalid"))
    const body = decoded as Record<string, unknown>
    // These are the documented count endpoint fields; other input-affecting options fail closed.
    const counted = ["model", "input", "instructions", "parallel_tool_calls", "personality", "reasoning", "text", "tool_choice", "tools", "truncation"]
    const generation = ["stream", "store", "service_tier", "prompt_cache_key", "include", "max_output_tokens", "temperature", "top_p"]
    if (body.model !== bound.model || Object.keys(body).some((key) => !counted.includes(key) && !generation.includes(key)) ||
      (body.truncation !== undefined && body.truncation !== "disabled") ||
      (body.max_output_tokens !== undefined && (!Number.isSafeInteger(body.max_output_tokens) || Number(body.max_output_tokens) < 1)))
      return yield* Effect.fail(refusal("budget-model-or-input-options-mismatch"))
    const stableRequest = HttpClientRequest.bodyText(request, text, "application/json")
    if (!(yield* bound.revalidate().pipe(Effect.catch(() => Effect.succeed(false))))) return yield* Effect.fail(refusal("budget-authority-unavailable"))
    const countBody = Object.fromEntries(Object.entries(body).filter(([key]) => counted.includes(key)))
    const countRequest = HttpClientRequest.bodyJsonUnsafe(HttpClientRequest.setUrl(stableRequest, "https://api.openai.com/v1/responses/input_tokens"), countBody)
    // The original immutable request retains its existing authentication. No credential is read or logged here.
    const response = yield* executor.execute(countRequest).pipe(Effect.mapError(() => refusal("budget-oracle-unavailable")))
    const result: unknown = yield* response.json.pipe(Effect.mapError(() => refusal("budget-oracle-invalid-response")))
    if (response.status !== 200 || !result || typeof result !== "object" || Array.isArray(result) ||
      !("object" in result) || result.object !== "response.input_tokens" || !("input_tokens" in result) ||
      typeof result.input_tokens !== "number" || !Number.isSafeInteger(result.input_tokens) || result.input_tokens < 0)
      return yield* Effect.fail(refusal("budget-oracle-invalid-response"))
    if (result.input_tokens >= budget) return yield* Effect.fail(refusal("context-budget-exceeded"))
    const maxOutputTokens = Math.min(Number(body.max_output_tokens ?? 4096), budget - result.input_tokens)
    const guardedBody = { ...body, max_output_tokens: maxOutputTokens }
    const guarded = HttpClientRequest.bodyJsonUnsafe(stableRequest, guardedBody)
    const receipt: SfTokenCountReceipt = Object.freeze({ schema: "sf-token-count-v1", oracle: "https://api.openai.com/v1/responses/input_tokens", model: bound.model,
      inputDigest: digestSfValue(countBody), requestDigest: digestSfValue(guardedBody), inputTokens: result.input_tokens,
      contextBudgetTokens: budget, maxOutputTokens, observedAt: new Date().toISOString() })
    if (!(yield* bound.revalidate().pipe(Effect.catch(() => Effect.succeed(false))))) return yield* Effect.fail(refusal("budget-authority-changed"))
    yield* bound.persistReceipt(receipt).pipe(Effect.mapError(() => refusal("budget-receipt-not-durable")))
    if (!(yield* bound.revalidate().pipe(Effect.catch(() => Effect.succeed(false))))) return yield* Effect.fail(refusal("budget-authority-changed"))
    return guarded
  })
}

function refusal(message: string) {
  return new LLMError({ module: "SucafinaTokenBudget", method: "admit", reason: new InvalidRequestReason({ message }) })
}
