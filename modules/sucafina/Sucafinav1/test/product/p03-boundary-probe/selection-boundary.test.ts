import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { selectionKey } from "../../../product/decisions/portfolio-selection.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createPlannerResultPersistence } from "../../../product/planner/persistence.ts"
import { createPortfolioAnalysis } from "../../../product/portfolio/analysis.ts"
import { createWp13AnalysisFixture } from "../wp13/sensitivity-fixture.ts"

/**
 * Mission109: discriminant, NOT the 72-assertion P03 journey. Source declarations
 * and initial human grants are synthetic; Planner, LocalStore, C08, criterion
 * revisions, result persistence and consumed UI admission are real.
 *
 * Observe only public boundaries; do not memoize a callback, clone its result,
 * bypass an authorization, or change the original WP13 fixture/test.
 */
async function boundaryWorld(label: string) {
  const world = await createWp13AnalysisFixture({ renewal: {} })
  try {
    const authorization = "p03-boundary109:" + label
    world.request.headers.set("authorization", authorization)
    const operation = "sf_portfolio_evaluate"
    const inputDigest = digestSfValue(world.analysisRequest.portfolio)
    const binding = world.context.binding
    const identity = {
      installationId: binding.installationId,
      projectId: binding.projectId,
      principalRef: binding.principalRef,
      policyVersion: binding.policyVersion,
      accessRevision: binding.accessRevision,
    }
    const ui = createSfUiAuthority({
      authorize: async (request, name, digest) =>
        world.access.allowed && request === world.request &&
        request.headers.get("authorization") === authorization &&
        name === operation && digest === inputDigest ? identity : undefined,
      commandIdentity: async () => "p03-boundary109-" + label,
      createId: () => "p03-boundary109-" + label + "-request",
      now: () => Date.parse("2026-11-15T00:00:00Z"),
    })
    const admitted = await ui.admit(world.request, operation, inputDigest)
    if (admitted.status !== "ok" || !await ui.validate(admitted.value, operation, inputDigest)) throw new Error("UI admission failed")
    const context = admitted.value
    world.host.requestFor = (trusted) => trusted.kind === "ui" ? ui.requestFor(trusted) : undefined
    world.host.revalidate = (trusted) => trusted.kind === "ui" ? ui.revalidate(trusted) : Promise.resolve(false)
    const selected = await world.selection.register({
      caseRef: world.caseRef,
      baselineAlternativeId: "baseline",
      alternativeId: "selected",
      criteria: world.analysisRequest.portfolio.constraints,
      expectedVersion: 0,
    }, context)
    if (selected.status !== "ok") throw new Error("real selection refused: " + JSON.stringify(selected))
    return { world, ui, context, cleanup: async () => { ui.finish(context); await world.cleanup() } }
  } catch (error) {
    await world.cleanup()
    throw error
  }
}

test("P03/109 observes amplification before any real selection drift; C08/Planner getters and revocation remain live", async () => {
  const { world, ui, context, cleanup } = await boundaryWorld("selection")
  const observations = { plannerCompares: 0, historicalReads: 0, callbacks: [] as string[] }
  const originalCompare = world.plannerWithCriteria.compareScenarios
  const originalHistorical = world.results.readHistoricalScenario
  try {
    // Instrument the SAME real producers already referenced by the services.
    // No shallow copy replaces a context, request, result or host callback.
    world.plannerWithCriteria.compareScenarios = async (...args: Parameters<typeof originalCompare>) => {
      observations.callbacks.push("planner:enter")
      observations.plannerCompares++
      const result = await originalCompare(...args)
      observations.callbacks.push("planner:" + result.status)
      return result
    }
    world.results.readHistoricalScenario = async (...args: Parameters<typeof originalHistorical>) => {
      observations.historicalReads++
      observations.callbacks.push("c08:historical:enter")
      const result = await originalHistorical(...args)
      observations.callbacks.push("c08:historical:" + result.status)
      return result
    }
    const preference = async () => world.state.read(world.request, "preferences", (state) => state.preferences[selectionKey(world.caseRef)])
    const original = await preference()
    expect(original.status).toBe("ok")
    const selected = await world.selectPortfolio(world.analysisRequest, context)
    expect(selected.status).toBe("ok")
    if (selected.status !== "ok") throw new Error(JSON.stringify(selected))
    expect(selected.value.baselineRef).toBe(world.baselineRef)
    expect(selected.value.alternativeRef).toBe(world.selectedRef)
    // The production resolver reads the selection twice; each selection read
    // replays the case's comparison twice, across C08 and canonical Planner.
    expect(observations.plannerCompares).toBeGreaterThanOrEqual(4)
    expect(observations.historicalReads).toBeGreaterThan(0)
    expect(observations.callbacks.filter((entry) => entry === "planner:enter").length)
      .toBe(observations.callbacks.filter((entry) => entry.startsWith("planner:") && entry !== "planner:enter").length)
    expect(observations.callbacks.filter((entry) => entry === "c08:historical:enter").length)
      .toBe(observations.callbacks.filter((entry) => entry.startsWith("c08:historical:") && entry !== "c08:historical:enter").length)
    const stable = await preference()
    expect(stable.status).toBe("ok")
    if (original.status !== "ok" || stable.status !== "ok") throw new Error("C08 preference unavailable")
    expect(digestSfValue(stable.value)).toBe(digestSfValue(original.value))

    // The C08 serializer must still observe a getter, not reuse its last value.
    let getterCalls = 0
    const accessor = await world.state.read(world.request, "cases", (state) => ({
      get version() { getterCalls++; return state.cases[world.caseRef.id]?.version },
    }))
    expect(accessor.status).toBe("ok")
    if (accessor.status === "ok") expect(accessor.value.version).toBe(world.caseRef.version)
    expect(getterCalls).toBeGreaterThan(0)
    let noncloneableRefused = false
    try {
      const incompatible = await world.state.read(world.request, "cases", () => ({ callback: () => true }))
      noncloneableRefused = incompatible.status !== "ok"
    } catch { noncloneableRefused = true }
    expect(noncloneableRefused).toBe(true)

    // Real canonical rule CAS changes replay without changing the human
    // selection's C08 bytes. A stale read here is NOT evidence of a new choice.
    const revised = await world.reviseRule()
    expect(revised.status).toBe("ok")
    const replayDrift = await world.selectPortfolio(world.analysisRequest, context)
    expect(replayDrift.status).not.toBe("ok")
    const unchangedSelection = await preference()
    expect(unchangedSelection.status).toBe("ok")
    if (unchangedSelection.status === "ok") expect(digestSfValue(unchangedSelection.value)).toBe(digestSfValue(original.value))

    world.access.allowed = false
    const revoked = await world.selectPortfolio(world.analysisRequest, context)
    expect(revoked.status).not.toBe("ok")
    world.access.allowed = true
    ui.finish(context)
    const ended = await world.selectPortfolio(world.analysisRequest, context)
    expect(ended.status).not.toBe("ok")
    console.info("[p03-boundary109]", JSON.stringify({
      phase: "selection-amplification",
      plannerCompares: observations.plannerCompares,
      historicalReads: observations.historicalReads,
      callbackEvents: observations.callbacks.length,
      stableSelectionDigest: digestSfValue(original.value),
      replayDriftStatus: replayDrift.status,
      replayDriftReason: replayDrift.status === "ok" ? null : replayDrift.reason,
      revokedStatus: revoked.status,
      endedStatus: ended.status,
      source: "real C08 + Planner + UI admission; synthetic finance-source fixture",
    }))
  } finally {
    world.plannerWithCriteria.compareScenarios = originalCompare
    world.results.readHistoricalScenario = originalHistorical
    await cleanup()
  }
}, 60000)

test("P03/109 exposes the exact analysis boundary where a changed rule is mislabeled as selection drift", async () => {
  const { world, context, cleanup } = await boundaryWorld("rule-cas")
  try {
    const readSelection = () => world.state.read(world.request, "preferences", (state) => state.preferences[selectionKey(world.caseRef)])
    const initial = await readSelection()
    expect(initial.status).toBe("ok")
    let firstSelect: "ok" | "other" | undefined
    let ruleRevision: string | undefined
    const phases: string[] = []
    const select: typeof world.selectPortfolio = async (...args) => {
      const selected = await world.selectPortfolio(...args)
      phases.push("select:" + selected.status + (selected.status === "ok" ? "" : ":" + selected.reason))
      if (firstSelect === undefined) {
        firstSelect = selected.status === "ok" ? "ok" : "other"
        if (selected.status === "ok") {
          // A real authorized CAS occurs after the first fully verified select,
          // before the later independent compare/binding/select observations.
          const revision = await world.reviseRule()
          ruleRevision = revision.status
          phases.push("rule-cas:" + revision.status)
        }
      }
      return selected
    }
    const planner = world.plannerWithCriteria
    const analysis = createPortfolioAnalysis({
      planner,
      results: world.results,
      bindings: world.comparisonBindings,
      persist: createPlannerResultPersistence({
        store: world.results,
        scenarios: world.scenarios,
        comparisonBindings: world.comparisonBindings,
        replay: planner,
        resolveCase: async () => ({ status: "ok", value: world.caseRef }),
      }),
      select,
      idempotencyKey: async (digest) => "p03-boundary109-comparison:" + digest,
    })
    const observed = await analysis.evaluate(world.analysisRequest, context)
    phases.push("analysis:" + observed.status + (observed.status === "ok" ? "" : ":" + observed.reason))
    const after = await readSelection()
    expect(firstSelect).toBe("ok")
    expect(ruleRevision).toBe("ok")
    expect(initial.status).toBe("ok")
    expect(after.status).toBe("ok")
    if (initial.status === "ok" && after.status === "ok") {
      expect(digestSfValue(after.value)).toBe(digestSfValue(initial.value))
    }
    expect(observed.status).not.toBe("ok")
    console.info("[p03-boundary109]", JSON.stringify({
      phase: "analysis-masked-canonical-rule-cas",
      callbacks: phases,
      selectionC08Unchanged: initial.status === "ok" && after.status === "ok" && digestSfValue(initial.value) === digestSfValue(after.value),
      outcome: observed.status === "ok" ? "ok" : { status: observed.status, reason: observed.reason },
      interpretation: "A selection-changed reason alone cannot prove changed C08 preference; compare the first failed nested status",
    }))
  } finally { await cleanup() }
}, 60000)
