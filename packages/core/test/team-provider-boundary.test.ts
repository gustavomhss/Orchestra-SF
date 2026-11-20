import { expect, test } from "bun:test"
import { Context, Effect, Exit, Layer } from "effect"
import { AISDK } from "../src/aisdk"
import { AppNodeBuilder } from "../src/effect/app-node-builder"
import { LayerNode } from "../src/effect/layer-node"
import { ModelV2 } from "../src/model"
import { ProviderV2 } from "../src/provider"
import { SessionOwner } from "../src/session/owner"
import { teamSessionFixture } from "./fixture/team-session"
import { testEffect } from "./lib/effect"

const providerID = ProviderV2.ID.make("synthetic-private-provider")
const modelID = ModelV2.ID.make("synthetic-model")
const model = ModelV2.Info.make({
  ...ModelV2.Info.empty(providerID, modelID),
  api: { type: "aisdk", id: modelID, package: "@ai-sdk/openai", settings: { apiKey: "synthetic-inline-secret" } },
})
const event = (): AISDK.SDKEvent => ({ model, package: "@ai-sdk/openai", options: {} })

test("team-provider-01: a model name or inline key never admits a corporate SDK without a private provider source", async () => {
  await using f = await teamSessionFixture()
  let sdkCalls = 0
  let languageCalls = 0
  await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
    const owners = yield* SessionOwner.Service
    const context = yield* Layer.build(LayerNode.compile(AISDK.node, [
      [SessionOwner.node, Layer.succeed(SessionOwner.Service, owners)],
    ]))
    const service = Context.get(context, AISDK.Service)
    yield* service.hook.sdk(() => { sdkCalls++ })
    yield* service.hook.language(() => { languageCalls++ })
    expect(Exit.isFailure(yield* Effect.exit(service.runSDK(event())))).toBe(true)
    expect(Exit.isFailure(yield* Effect.exit(service.runLanguage({ model, sdk: {}, options: {} })))).toBe(true)
    const result = yield* Effect.exit(service.language(model))
    expect(Exit.isFailure(result)).toBe(true)
    if (result._tag !== "Failure") throw new Error("Private provider definition must be required")
    const reason = result.cause.reasons[0]
    expect(reason?._tag).toBe("Fail")
    if (reason?._tag !== "Fail") throw new Error("Expected typed provider unavailability")
    expect(reason.error).toBeInstanceOf(AISDK.InitError)
    expect(sdkCalls).toBe(0)
    expect(languageCalls).toBe(0)
  })))
}, 30000)

const technical = testEffect(AppNodeBuilder.build(LayerNode.group([AISDK.node])))
technical.effect("team-provider-02: the technical graph keeps SDK and language hooks live", () => Effect.gen(function* () {
  const service = yield* AISDK.Service
  let sdkCalls = 0
  let languageCalls = 0
  yield* service.hook.sdk(() => { sdkCalls++ })
  yield* service.hook.language(() => { languageCalls++ })
  const sdkEvent = event()
  const languageEvent: AISDK.LanguageEvent = { model, sdk: {}, options: {} }
  expect(yield* service.runSDK(sdkEvent)).toBe(sdkEvent)
  expect(yield* service.runLanguage(languageEvent)).toBe(languageEvent)
  expect(sdkCalls).toBe(1)
  expect(languageCalls).toBe(1)
}))
