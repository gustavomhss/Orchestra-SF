import { describe, expect, test } from "bun:test"
import { SfPortfolio, type SfPortfolioOperationId } from "@orchestra/schema/sucafina/portfolio"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { SfNativeOperationBindings } from "../../../src/sucafina/bindings"
import { sfOperationUrl } from "../../../src/sucafina/transport"
import { sfPortfolioSourceSurface } from "../../../src/sucafina/transport/portfolio"

// Pure source-shape and route construction. These structural inputs establish
// neither a real case, an installation session, nor producer admission.
const caseRef = { id: "structural-case", incarnation: "structural-incarnation", version: 1 }
const request = {
  scope: { horizon: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD" },
  candidateRefs: ["structural-alternative"], operations: [], constraints: [], priorities: [],
  explorationLimit: 4,
}
const selection = {
  caseRef, request, selectedCandidateRefs: ["structural-alternative"],
  combinationId: "a".repeat(64), expectedEvaluationDigest: "b".repeat(64),
}
const inputs: Record<SfPortfolioOperationId, Record<string, unknown>> = {
  "portfolio.decision-portfolio-evaluate": { caseRef, request },
  "portfolio.decision-portfolio-preview": { caseRef, request },
  "portfolio.decision-portfolio-read": { caseRef, resultRef: "structural-result" },
  "portfolio.decision-portfolio-reconcile": {
    caseRef, portfolioResultRef: "structural-result", combinationId: "a".repeat(64), choiceId: "structural-choice",
  },
  "portfolio.decision-portfolio-results": { caseRef },
  "portfolio.decision-prepare-portfolio": { ...selection, choiceId: "structural-choice" },
  "portfolio.decision-promote-portfolio": {
    ...selection, title: "Structural contract input", coverageRef: "structural-coverage",
  },
  "portfolio.decision-sensitivity-evaluate": {
    caseRef, request: {
      scenarioRef: "structural-scenario",
      parameterBounds: { parameterRef: "structural-parameter", minimum: 200, maximum: 2200, steps: 2 },
      criterion: { id: "structural-criterion", operator: "gte", value: 2000 },
    },
  },
  "portfolio.decision-sensitivity-read": { caseRef, resultRef: "structural-result" },
  "portfolio.decision-sensitivity-units": {
    caseRef, scenarioRef: "structural-scenario", baselineRef: "structural-baseline", parameterRef: "structural-parameter",
  },
}
const binding: SfInstallationDescriptor = {
  installationId: "structural-installation", projectId: "structural-project", hostId: "structural-host",
  publicOrigin: "http://127.0.0.1:43117", mount: "/sucafina",
  authMode: "local-operator", contractRevision: "sf-native-ui/1",
}

describe("A05 original portfolio route selection", () => {
  test("the test inputs cover precisely the original closed family", () => {
    expect(Object.keys(inputs).sort()).toEqual(Object.keys(SfPortfolio).sort())
  })

  for (const operation of Object.values(SfPortfolio)) {
    test(operation.operationId + " preserves its source body and selects the installed dashboard route", () => {
      const input = inputs[operation.operationId]
      const codec = SfNativeOperationBindings[operation.operationId]!
      const decoded = codec.decodeInput(input)
      expect(decoded.status).toBe("ok")
      if (decoded.status !== "ok") return
      expect(decoded.value).toEqual(input)
      expect(decoded.value).not.toHaveProperty("surface")
      expect(sfPortfolioSourceSurface(operation.operationId, decoded.value)).toBe("dashboard")
      const metadata = SfOperationRegistry[operation.operationId]
      expect(metadata.method).toBe("POST")
      expect(sfOperationUrl(binding, metadata, decoded.value, operation.operationId))
        .toBe(binding.publicOrigin + binding.mount + "/dashboard?sf=" + metadata.fixedQuery?.sf)
      expect(codec.decodeInput({ ...input, surface: "dashboard" }))
        .toEqual({ status: "invalid" })
    })
  }

  test("closed inputs reject missing, extra, malformed and route-diverting fields", () => {
    const id = "portfolio.decision-portfolio-results"
    const codec = SfNativeOperationBindings[id]!
    for (const input of [
      undefined, null, [], {}, { caseRef: { ...caseRef, version: 0 } },
      { caseRef: { ...caseRef, id: "" } }, { caseRef, surface: "dashboard" },
      { caseRef, surface: "planner" }, { caseRef, url: "https://other.invalid/dashboard" },
      { caseRef, headers: { authorization: "unsupported" } },
      { caseRef: { ...caseRef, extra: true } },
    ]) {
      expect(codec.decodeInput(input)).toEqual({ status: "invalid" })
      expect(sfPortfolioSourceSurface(id, input)).toBeUndefined()
    }
    const sensitivity = SfNativeOperationBindings["portfolio.decision-sensitivity-evaluate"]!
    expect(sensitivity.decodeInput({
      caseRef, request: {
        scenarioRef: "structural-scenario",
        parameterBounds: { parameterRef: "structural-parameter", minimum: 0, maximum: Infinity, steps: 2 },
        criterion: { id: "structural-criterion", operator: "gte", value: 0 },
      },
    })).toEqual({ status: "invalid" })
  })

  test("source routing is bound to each installed origin and mount", () => {
    const id = "portfolio.decision-portfolio-results"
    const metadata = SfOperationRegistry[id]
    const input = { caseRef }
    expect(sfOperationUrl({ ...binding, publicOrigin: "https://analytics.example", mount: "/region/coffee",
      authMode: "microsoft" }, metadata, input, id))
      .toBe("https://analytics.example/region/coffee/dashboard?sf=decision-portfolio-results")
    expect(sfOperationUrl({ ...binding, publicOrigin: "http://127.0.0.1:43118", mount: "/another-installation" },
      metadata, input, id))
      .toBe("http://127.0.0.1:43118/another-installation/dashboard?sf=decision-portfolio-results")
    for (const invalid of [
      { ...binding, mount: "/sucafina/../other" }, { ...binding, mount: "//other" },
      { ...binding, publicOrigin: "https://analytics.example/path", authMode: "microsoft" as const },
      { ...binding, publicOrigin: "http://remote.example" },
      { ...binding, installationId: "" }, { ...binding, hostId: "" }, { ...binding, projectId: "" },
    ]) expect(sfOperationUrl(invalid, metadata, input, id)).toBeUndefined()
    expect(sfOperationUrl(binding, { ...metadata, pathTemplate: "https://other.invalid/dashboard" }, input, id))
      .toBeUndefined()
    expect(sfOperationUrl(binding, metadata, { caseRef, surface: "planner" }, id)).toBeUndefined()
  })

  test("unrelated fixed and selected source routes retain their original behavior", () => {
    const fixed = "decisions.controls.read"
    expect(SfOperationRegistry[fixed].pathTemplate).toBe("{mount}/dashboard")
    expect(sfPortfolioSourceSurface(fixed, { caseRef })).toBeUndefined()
    expect(sfOperationUrl(binding, SfOperationRegistry[fixed], undefined, fixed))
      .toBe(binding.publicOrigin + binding.mount + "/dashboard?sf=decision-controls&format=json")
    const selected = "files.asset.link"
    expect(SfOperationRegistry[selected].pathTemplate).toBe("{mount}/{surface}")
    expect(sfPortfolioSourceSurface(selected, { assetId: "structural-asset" })).toBeUndefined()
    expect(sfOperationUrl(binding, SfOperationRegistry[selected], { assetId: "structural-asset" }, selected))
      .toBeUndefined()
    expect(sfOperationUrl(binding, SfOperationRegistry[selected],
      { surface: "planner", assetId: "structural-asset" }, selected))
      .toBe(binding.publicOrigin + binding.mount + "/planner?asset-link=structural-asset")
  })
})
