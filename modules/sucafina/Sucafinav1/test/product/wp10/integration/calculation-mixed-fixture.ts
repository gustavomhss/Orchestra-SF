import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { ScenarioRequest } from "../../../../product/contracts/operations.ts"
import { object } from "../../../../runtime/contract.ts"
import { calculationRootFixture } from "./calculation-root-fixture.ts"

// The SQLite, consumed UI lease, Planner source, result and bound request all
// come from the real producers. Pending coverage remains explicit fixture data.
export async function calculationMixedFixture(count = 0) {
  const f = await calculationRootFixture()
  try {
    // Seed an ordinary second version before producing any cited source. Its
    // scoped identity stays absent until a test invokes the actual source issuer.
    await f.persistence.transaction("planner", async (snapshot) => {
      const versions = snapshot.data.versions
      if (!Array.isArray(versions)) throw new Error("Planner versions unavailable")
      const original = versions.find((value) => object(value).id === "v0")
      if (!original) throw new Error("Planner v0 unavailable")
      snapshot.data.versions = [...versions, { ...structuredClone(object(original)), id: "v1", name: "Auxiliary source fixture" }]
      return { commit: true, value: undefined }
    })
    let produced = 0
    const source = async (versionId: string) => {
      const lease = await f.admit("sf_scenario_simulate")
      try {
        const issued = await f.business.plannerProduct.issueSource(versionId, lease.call)
        if (issued.status !== "ok") throw new Error(`Actual Planner source unavailable: ${issued.reason}`)
        return issued.value.evidence
      } finally { f.authority.ui.finish(lease.call) }
    }
    const produce = async (evidenceRefs: readonly BusinessEvidenceRef[] = [], versionId = "v0") => {
      const lease = await f.admit("sf_scenario_simulate")
      const idempotencyKey = `mixed-fixture-${produced++}`
      try {
        const created = await f.business.withCase(lease.call, f.caseRef, {}, async () => {
          const issued = await f.business.plannerProduct.issueSource(versionId, lease.call)
          if (issued.status !== "ok") return issued
          const request: ScenarioRequest = { baseRef: issued.value.evidence.refId, operations: [], assumptions: evidenceRefs.length
            ? [{ id: "prior-analysis", value: "Cite prior analysis without confirming a financial assumption", state: "hypothetical", evidenceRefs }]
            : [] }
          const result = await f.business.planner.simulateScenario(request, lease.call)
          if (result.status !== "ok") return result
          const saved = await f.business.calculations.persist({ kind: "scenario", request, result: result.value }, idempotencyKey, lease.call)
          if (saved.status !== "ok") return saved
          const calculation = await f.business.calculations.issue(saved.value.resultRef, lease.call)
          return calculation.status === "ok" ? { status: "ok" as const,
            value: { request, result: result.value, calculation: calculation.value, source: issued.value.evidence } } : calculation
        })
        if (created.status !== "ok") throw new Error(`Actual mixed calculation unavailable: ${created.reason}`)
        return created.value
      } finally { f.authority.ui.finish(lease.call) }
    }
    const inners: Awaited<ReturnType<typeof produce>>[] = []
    for (let index = 0; index < count; index++) inners.push(await produce())
    if (new Set(inners.map((value) => value.calculation.target.runId)).size !== count) throw new Error("Distinct actual runs required")
    const sources = () => f.persistence.transaction("planner", async (snapshot) =>
      ({ commit: false, value: structuredClone(snapshot.sfSources) }))
    return { ...f, inners, produce, source, sources }
  } catch (error) { await f.dispose(); throw error }
}
