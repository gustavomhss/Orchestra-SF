import { describe, expect, test } from "bun:test"
import { Option, Schema } from "effect"
import { createStore } from "solid-js/store"
import { SfPortfolio } from "@orchestra/schema/sucafina/portfolio"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { sfOperationUrl } from "@orchestra/client/sucafina/transport"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"

// Structural input specimens only: no transport, principal, context, producer
// outcome or HTTP response is substituted. The browser journey uses real sources.
const caseRef = { id: "structural-case", incarnation: "structural-incarnation", version: 6 }
const request = {
  scope: { currency: "USD", horizon: { start: "2026-01-01", end: "2026-12-31" } },
  candidateRefs: ["portfolio-candidate:case%3Astructural:6:structural-alternative:1"],
  operations: [], constraints: [], priorities: [], explorationLimit: 4,
}
const binding = {
  installationId: "structural-installation", projectId: "structural-project", hostId: "structural-host",
  publicOrigin: "http://127.0.0.1:43117", mount: "/sucafina",
  authMode: "local-operator" as const, contractRevision: "sf-native-ui/1" as const,
}

describe("A05 input admission from native Solid state", () => {
  for (const [id, input] of [
    ["portfolio.decision-portfolio-results", { caseRef }],
    ["portfolio.decision-portfolio-preview", { caseRef, request }],
  ] as const) {
    test(id + " preserves plain and reactive input through original codecs", () => {
      const [state] = createStore({ input })
      const source: Schema.Top = SfPortfolio[id].input
      const fullPlain = Schema.decodeUnknownOption(source)(input)
      const fullReactive = Schema.decodeUnknownOption(source)(state.input)
      const codec = SfNativeOperationBindings[id]!
      const plain = codec.decodeInput(input)
      const reactive = codec.decodeInput(state.input)
      console.info("SF_ANALYTICS_INPUT_ADMISSION " + JSON.stringify({
        operationId: id, fullPlain: Option.isSome(fullPlain), fullReactive: Option.isSome(fullReactive),
        plainWire: plain.status, reactiveWire: reactive.status,
      }))
      expect(plain.status).toBe("ok")
      expect(reactive.status).toBe("ok")
      if (plain.status !== "ok" || reactive.status !== "ok") return
      expect(plain.value).toEqual(input)
      expect(reactive.value).toEqual(input)
      expect(sfOperationUrl(binding, SfOperationRegistry[id], reactive.value, id))
        .toBe(binding.publicOrigin + binding.mount + "/dashboard?sf=" + SfOperationRegistry[id].fixedQuery.sf)
      expect(codec.decodeInput({ ...state.input, surface: "dashboard" })).toEqual({ status: "invalid" })
      expect(Option.isSome(fullReactive)).toBe(Option.isSome(fullPlain))
    })
  }
})
