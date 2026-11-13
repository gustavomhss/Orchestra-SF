import { expect, test } from "bun:test"
import { Deferred, Effect, Fiber } from "effect"
import { HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { enforceSfResponseTokenBudget } from "../../../../../../../apps/cli/src/sucafina-product/token-count.ts"
import type { SfTokenCountReceipt } from "../../../../../../../apps/cli/src/sucafina-product/token-count.ts"

// Protocol boundary fixture only. This does not qualify the live authenticated OpenAI oracle or C15.
function fixture() {
  const state = { tokens: 20, active: true, revokeAfterCount: false, persistenceAvailable: true }
  const calls: { url: string; body: Record<string, unknown> }[] = []
  const receipts: SfTokenCountReceipt[] = []
  const executor: Parameters<typeof enforceSfResponseTokenBudget>[1] = { execute: (request) => Effect.gen(function* () {
    const web = yield* HttpClientRequest.toWeb(request).pipe(Effect.orDie)
    const body = yield* Effect.promise(() => web.json())
    calls.push({ url: request.url, body })
    if (request.url.endsWith("/input_tokens") && state.revokeAfterCount) state.active = false
    return HttpClientResponse.fromWeb(request, new Response(JSON.stringify(request.url.endsWith("/input_tokens")
      ? { object: "response.input_tokens", input_tokens: state.tokens } : { emitted: true }), { status: 200 }))
  }) }
  const admission = { model: "fixture-model", contextBudgetTokens: 100,
    revalidate: () => Effect.sync(() => state.active),
    persistReceipt: (receipt: SfTokenCountReceipt) => Effect.try({ try: () => {
      if (!state.persistenceAvailable) throw new Error("Fixture durable storage failure")
      receipts.push(receipt)
    }, catch: (error) => error }),
  }
  const request = HttpClientRequest.bodyJsonUnsafe(HttpClientRequest.post("https://api.openai.com/v1/responses"), {
    model: "fixture-model", input: [{ role: "user", content: "Dados atuais: café, 日本語, 0 e ausência." }],
    tools: [{ type: "function", name: "sf_case_read", parameters: { type: "object", properties: {} } }],
    stream: true, store: false, max_output_tokens: 1000,
  })
  const run = () => Effect.runPromise(enforceSfResponseTokenBudget(request, executor, admission).pipe(Effect.flatMap(executor.execute)))
  return { state, calls, receipts, executor, admission, request, run }
}

test("counts actual prepared input and tools before emission, reserves output and persists provenance", async () => {
  const app = fixture()
  await app.run()
  expect(app.calls.map((call) => call.url)).toEqual(["https://api.openai.com/v1/responses/input_tokens", "https://api.openai.com/v1/responses"])
  expect(app.calls[0]!.body.input).toEqual(app.calls[1]!.body.input)
  expect(app.calls[0]!.body.tools).toEqual(app.calls[1]!.body.tools)
  expect(app.calls[1]!.body.max_output_tokens).toBe(80)
  expect(app.receipts).toMatchObject([{ inputTokens: 20, contextBudgetTokens: 100, maxOutputTokens: 80, model: "fixture-model" }])
  expect(app.receipts[0]!.inputDigest).toMatch(/^[a-f0-9]{64}$/)
  const original = await Effect.runPromise(HttpClientRequest.toWeb(app.request).pipe(Effect.orDie))
  expect((await original.json()).max_output_tokens).toBe(1000)
})

test("oracle over-budget response blocks emission even for short input", async () => {
  const app = fixture()
  app.state.tokens = 101
  await expect(app.run()).rejects.toThrow("context-budget-exceeded")
  expect(app.calls).toHaveLength(1)
  expect(app.receipts).toHaveLength(0)
})

test("revocation after counting and unavailable receipt storage both block emission", async () => {
  const revoked = fixture()
  revoked.state.revokeAfterCount = true
  await expect(revoked.run()).rejects.toThrow("budget-authority-changed")
  expect(revoked.calls).toHaveLength(1)
  const unavailable = fixture()
  unavailable.state.persistenceAvailable = false
  await expect(unavailable.run()).rejects.toThrow("budget-receipt-not-durable")
  expect(unavailable.calls).toHaveLength(1)
})

test("model mismatch and unsupported endpoint fail before any counter or inference request", async () => {
  const app = fixture()
  await expect(Effect.runPromise(enforceSfResponseTokenBudget(app.request, app.executor, { ...app.admission, model: "other-model" }))).rejects.toThrow("budget-model-or-input-options-mismatch")
  await expect(Effect.runPromise(enforceSfResponseTokenBudget(HttpClientRequest.setUrl(app.request, "https://other.example/v1/responses"), app.executor, app.admission))).rejects.toThrow("budget-provider-or-transport-unsupported")
  expect(app.calls).toHaveLength(0)
})


test("interrupting durable receipt work cancels the same fiber before inference", async () => {
  const app = fixture()
  await Effect.runPromise(Effect.gen(function* () {
    const entered = yield* Deferred.make<void>()
    const guarded = enforceSfResponseTokenBudget(app.request, app.executor, {
      ...app.admission,
      persistReceipt: () => Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never)),
    }).pipe(Effect.flatMap(app.executor.execute))
    const fiber = yield* guarded.pipe(Effect.forkChild)
    yield* Deferred.await(entered)
    yield* Fiber.interrupt(fiber)
  }))
  expect(app.calls.map((call) => call.url)).toEqual(["https://api.openai.com/v1/responses/input_tokens"])
  expect(app.receipts).toHaveLength(0)
})
