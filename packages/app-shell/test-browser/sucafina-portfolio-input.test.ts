import { describe, expect, test } from "bun:test"
import { Option, Schema } from "effect"
import { createStore, unwrap } from "solid-js/store"
import { SfPortfolio } from "@orchestra/schema/sucafina/portfolio"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { sfOperationUrl } from "@orchestra/client/sucafina/transport"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { sfPortfolioDecodeInput } from "../src/orchestra/chapters/sucafina/portfolio/scenarios/source-input"

// Structural specimens only. No source, transport, principal, context, HTTP
// response or evaluation result is substituted by this boundary regression.
const caseRef = { id: "structural-case", incarnation: "structural-incarnation", version: 6 }
const request = {
  scope: { currency: "USD", horizon: { start: "2026-01-01", end: "2026-12-31" } },
  candidateRefs: ["portfolio-candidate:case%3Astructural:6:structural-alternative:1"],
  operations: [{ kind: "replace", targetRef: "original-component", amount: 200,
    currency: "USD", period: { start: "2026-02-01", end: "2026-02-28" } }],
  constraints: ["original-rule"], priorities: ["original-criterion"], explorationLimit: 4,
}
const binding = {
  installationId: "structural-installation", projectId: "structural-project", hostId: "structural-host",
  publicOrigin: "http://127.0.0.1:43117", mount: "/sucafina",
  authMode: "local-operator" as const, contractRevision: "sf-native-ui/1" as const,
}
const specimens = [
  ["portfolio.decision-portfolio-results", { caseRef }],
  ["portfolio.decision-portfolio-preview", { caseRef, request }],
  ["portfolio.decision-sensitivity-units", {
    caseRef, scenarioRef: "original-scenario", baselineRef: "original-baseline", parameterRef: "original-parameter",
  }],
  ["portfolio.decision-sensitivity-evaluate", { caseRef, request: {
    scenarioRef: "original-scenario",
    parameterBounds: { parameterRef: "original-parameter", minimum: 200, maximum: 400, steps: 4 },
    criterion: { id: "original-criterion", operator: "lte", value: 2000 },
  } }],
] as const

describe("portfolio native source input materialization", () => {
  for (const [id, specimen] of specimens) {
    test(id + " preserves clean, reactive, nested and retained raw values", () => {
      const input = structuredClone(specimen)
      const expected = structuredClone(input)
      const source: Schema.Decoder<unknown> = SfPortfolio[id].input
      const codec = SfNativeOperationBindings[id]!
      expect(codec.decodeInput(input).status).toBe("ok")
      const [state] = createStore({ input })
      expect(state.input).not.toBe(input)
      const fullReactive = Schema.decodeUnknownOption(source)(state.input)
      const rawAfterProxy = Schema.decodeUnknownOption(source)(unwrap(state.input))
      console.info("SF_ANALYTICS_INPUT_ADMISSION " + JSON.stringify({
        operationId: id, fullReactive: Option.isSome(fullReactive),
        rawAfterProxy: Option.isSome(rawAfterProxy), reactiveProxy: state.input !== input,
      }))
      // Spread creates an ordinary outer DTO while its nested values still
      // belong to the real store, matching the native request composition.
      const nested = { ...state.input }
      for (const value of [expected, state.input, nested, input]) {
        const decoded = sfPortfolioDecodeInput(source, value)
        expect(Option.isSome(decoded)).toBe(true)
        if (Option.isNone(decoded)) throw new Error("Original source input was not materialized")
        expect(decoded.value).toEqual(expected)
        expect(codec.decodeInput(decoded.value)).toEqual({ status: "ok", value: expected })
        expect(sfOperationUrl(binding, SfOperationRegistry[id], decoded.value, id))
          .toBe(binding.publicOrigin + binding.mount + "/dashboard?sf=" + SfOperationRegistry[id].fixedQuery.sf)
      }
      expect(JSON.stringify(state.input)).toBe(JSON.stringify(expected))
      expect(state.input.caseRef).toEqual(expected.caseRef)
    })
  }

  for (const [name, make] of [
    ["extra root field", () => ({ caseRef, request, surface: "dashboard" })],
    ["extra undefined root field", () => ({ caseRef, request, surface: undefined })],
    ["extra case identity field", () => ({ caseRef: { ...caseRef, anotherCase: "different" }, request })],
    ["extra scope field", () => ({ caseRef, request: { ...request, scope: { ...request.scope, scopeOverride: true } } })],
    ["extra nested period field", () => ({ caseRef, request: { ...request, scope: {
      ...request.scope, horizon: { ...request.scope.horizon, sourceVersion: 99 },
    } } })],
    ["extra operation field", () => ({ caseRef, request: { ...request, operations: [
      { ...request.operations[0], sourceOverride: "different" },
    ] } })],
    ["missing incarnation", () => ({ caseRef: { id: caseRef.id, version: caseRef.version }, request })],
    ["missing horizon end", () => ({ caseRef, request: { ...request, scope: {
      ...request.scope, horizon: { start: request.scope.horizon.start },
    } } })],
    ["empty case reference", () => ({ caseRef: { ...caseRef, id: "" }, request })],
    ["invalid case version", () => ({ caseRef: { ...caseRef, version: 0 }, request })],
    ["invalid candidate reference", () => ({ caseRef, request: { ...request, candidateRefs: [null] } })],
    ["nonfinite operation amount", () => ({ caseRef, request: { ...request, operations: [
      { ...request.operations[0], amount: Infinity },
    ] } })],
  ] as const) {
    test("retains the original rejection for " + name, () => {
      const input = structuredClone(make())
      const source = SfPortfolio["portfolio.decision-portfolio-preview"].input
      const codec = SfNativeOperationBindings["portfolio.decision-portfolio-preview"]!
      // Prove the malformed specimen was rejected before any Solid metadata.
      expect(codec.decodeInput(input).status).toBe("invalid")
      const [state] = createStore({ input })
      expect(state.input).not.toBe(input)
      for (const value of [input, state.input, { ...state.input }])
        expect(Option.isNone(sfPortfolioDecodeInput(source, value))).toBe(true)
    })
  }

  test("rejects malformed sensitivity references and numeric bounds without substitution", () => {
    const source = SfPortfolio["portfolio.decision-sensitivity-evaluate"].input
    for (const input of [
      { caseRef, request: { scenarioRef: "", parameterBounds: {
        parameterRef: "original-parameter", minimum: 200, maximum: 400, steps: 4,
      }, criterion: { id: "original-criterion", operator: "lte", value: 2000 } } },
      { caseRef, request: { scenarioRef: "original-scenario", parameterBounds: {
        parameterRef: "", minimum: 200, maximum: 400, steps: 4,
      }, criterion: { id: "original-criterion", operator: "lte", value: 2000 } } },
      { caseRef, request: { scenarioRef: "original-scenario", parameterBounds: {
        parameterRef: "original-parameter", minimum: NaN, maximum: 400, steps: 4,
      }, criterion: { id: "original-criterion", operator: "lte", value: 2000 } } },
    ]) {
      expect(SfNativeOperationBindings["portfolio.decision-sensitivity-evaluate"]!.decodeInput(input).status).toBe("invalid")
      const [state] = createStore({ input })
      expect(Option.isNone(sfPortfolioDecodeInput(source, state.input))).toBe(true)
    }
  })

  test("fails closed for a non-cloneable input without dispatch", () => {
    const input = { caseRef, request, substitute: () => "different" }
    const [state] = createStore({ input })
    expect(Option.isNone(sfPortfolioDecodeInput(SfPortfolio["portfolio.decision-portfolio-preview"].input, state.input))).toBe(true)
  })
})
