import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createAssumptionDivergenceService } from "../../../product/decisions/assumption-divergence.ts"
import { createDecisionHttp } from "../../../product/decisions/http.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { rows } from "../../../runtime/contract.ts"
import { domain } from "../../../runtime/dashboard-portfolio.ts"
import { createAssumptionFixture } from "./assumption-fixture.ts"

test("a human-confirmed March assumption keeps the official May project and exposes the divergence until a separate domain command", async () => {
  const f = await createAssumptionFixture()
  try {
    const read = await f.admit("read-assumption", "decisions.portfolio.read", { caseRef: f.caseRef })
    const edit = { caseRef: f.caseRef, objective: f.initial.objective, criteria: f.initial.criteria, sourceRefs: f.initial.sourceRefs,
      assumptions: [{ id: "project-end", text: "2027-03-31", state: "confirmed" as const, evidenceRefs: [f.official.evidence] }] }
    const officialBefore = await f.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: digestSfValue({ view: domain.view(snapshot, f.actor, f.environment), audit: snapshot.audit }) }))
    const plannerBefore = await f.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))
    expect(await f.management.edit(edit, read)).toEqual({ status: "denied", reason: "human-edit-required" })
    expect(await f.planner.simulateScenario(f.scenario, read)).toEqual({ status: "denied", reason: "human-assumption-confirmation-required" })
    const confirmation = await f.admit("confirm-march", "decisions.edit", edit)
    f.confirmation.digest = digestSfValue(edit)
    const confirmed = await f.management.edit(edit, confirmation)
    expect(confirmed).toMatchObject({ status: "ok", value: { caseRef: { ...f.caseRef, version: 2 } } })
    if (confirmed.status !== "ok") throw new Error(confirmed.reason)
    const simulated = await f.planner.simulateScenario(f.scenario, read)
    expect(simulated.status).toBe("ok")
    if (simulated.status !== "ok") throw new Error(simulated.reason)
    expect(simulated.value).toMatchObject({ comparisonStatus: "conditioned", knownSubtotal: 45000, total: null, restrictions: ["preview-not-applied"] })
    expect(simulated.value.unresolvedConditions).toContain("assumption:project-end:confirmed:not-applied")
    expect(simulated.value.components.find((item) => item.id === "implementation:3")).toMatchObject({ amount: 45000, evidenceState: "hypothetical" })
    expect(simulated.value.components.find((item) => item.id === "implementation:5")).toMatchObject({ amount: 0, evidenceState: "hypothetical" })
    expect(simulated.value.sourceRefs).toContainEqual(f.official.evidence)
    expect(await f.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: digestSfValue({ view: domain.view(snapshot, f.actor, f.environment), audit: snapshot.audit }) }))).toBe(officialBefore)
    expect(await f.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(plannerBefore)

    const promotion = { caseRef: confirmed.value.caseRef, title: "March implementation as an explicitly declared scenario", scenario: f.scenario, coverageRef: "may-plan" }
    const promotedBy = await f.admit("save-march-scenario", "decisions.promote-alternative", promotion)
    const promoted = await f.mutations.addAlternative(promotion, promotedBy)
    expect(promoted.status).toBe("ok")
    if (promoted.status !== "ok") throw new Error(promoted.reason)
    const current = await f.cases.read({ caseRef: encodeCaseRef(f.caseRef) }, read)
    expect(current.status).toBe("ok")
    if (current.status !== "ok") throw new Error(current.reason)
    const alternative = current.value.case.alternatives[0]!
    expect(alternative.scenario.assumptions).toEqual(f.scenario.assumptions)
    expect(current.value.case.assumptions).toEqual(edit.assumptions)
    expect(current.value.case.choices).toEqual([])
    expect(current.value.case.preparedChanges).toEqual([])
    expect(current.value.case.receipts).toEqual([])
    const observation = async () => {
      const actual = await f.projectObservation()
      return { status: "ok" as const, value: { value: actual.value, evidenceRefs: [actual.evidence] } }
    }
    const divergence = createAssumptionDivergenceService({ cases: f.cases, host: f.host, observe: observation })
    const request = { caseRef: promoted.value.caseRef, alternativeId: alternative.id, alternativeVersion: alternative.version }
    expect(await divergence(request, read)).toEqual({ status: "ok", value: [{ assumptionId: "project-end", proposed: "2027-03-31", observed: "2027-05-31", state: "diverges", evidenceRefs: [f.official.evidence] }] })
    const empty = {} as unknown as Parameters<typeof createDecisionHttp>[0]
    const handle = createDecisionHttp({ ...empty, origin: "https://example.test", mount: "/decisions", human: f.human, assumptionDivergence: divergence,
      withCase: async (_context, _caseRef, options, action) => { expect(options.allowHistoricalRetry).toBe(false); return action() } })
    const body = { purpose: "assumption-divergence", ...request }
    const headers = new Headers(f.request("view-date-divergence").headers)
    headers.set("content-type", "application/json")
    const shown = await handle(new Request("https://example.test/decisions?sf=decision-assumption-divergence", { method: "POST", headers, body: JSON.stringify(body) }))
    expect(shown?.status).toBe(200)
    expect(await shown!.json()).toEqual(await divergence(request, read))
    expect((await handle(new Request("https://example.test/decisions?sf=decision-assumption-divergence", { method: "POST", headers, body: JSON.stringify({ ...body, officialDate: "2027-03-31" }) })))?.status).toBe(400)


    // The final source read is asynchronous. A case edit during that read cannot
    // leak a divergence for the superseded case version.
    let reads = 0
    const raced = createAssumptionDivergenceService({ cases: f.cases, host: f.host, observe: async () => {
      const value = await observation()
      if (++reads === 2) {
        const changed = { caseRef: request.caseRef, objective: "Reconsider the declared date", criteria: current.value.case.criteria, sourceRefs: current.value.case.sourceRefs, assumptions: current.value.case.assumptions }
        const context = await f.admit("reconsider-date", "decisions.edit", changed)
        expect((await f.management.edit(changed, context)).status).toBe("ok")
      }
      return value
    } })
    expect(await raced(request, read)).toEqual({ status: "stale", reason: "case-changed" })
    expect((await f.projectObservation()).value).toBe("2027-05-31")
    expect(await f.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: digestSfValue({ view: domain.view(snapshot, f.actor, f.environment), audit: snapshot.audit }) }))).toBe(officialBefore)
    // Official state is changed only by its own authorized Dashboard command.
    const command = { page: "All Projects", action: "save", id: "official-project", version: f.official.evidence.target.version, values: { end: "2027-03-31" } }
    const refused = await f.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: domain.execute(snapshot, { ...f.actor, canWrite: false }, command, f.environment) }))
    expect(refused).toMatchObject({ ok: false, status: 403 })
    const applied = await f.store.transaction("dashboard", async (snapshot) => {
      const result = domain.execute(snapshot, f.actor, command, f.environment)
      return { commit: result.ok, value: result }
    })
    expect(applied.ok).toBe(true)
    expect((await f.projectObservation()).value).toBe("2027-03-31")
    expect((await f.projectObservation()).evidence.target.version).toBe(f.official.evidence.target.version + 1)
    const storedPlanner = await f.store.transaction("planner", async (snapshot) => ({ commit: false, value: rows(snapshot.data.versions)[0] }))
    expect(rows(storedPlanner!.lines)[0]!.f).toEqual(Array.from({ length: 12 }, (_, month) => month === 4 ? 45000 : 0))
    const final = await f.readCase()
    if (final.status !== "ok" || !final.value) throw new Error("Case unavailable")
    expect(final.value.alternatives[0]).toEqual(alternative)
    expect(final.value.choices).toEqual([])
    expect(final.value.receipts).toEqual([])
    expect(await f.planner.simulateScenario(f.scenario, read)).toEqual({ status: "stale", reason: "scenario-evidence-not-current" })
  } finally { await f.cleanup() }
}, 180000)
