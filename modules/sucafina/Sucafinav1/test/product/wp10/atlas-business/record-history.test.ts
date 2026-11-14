import { expect, test } from "bun:test"
import { digestSfEvidenceRef } from "../../../../product/contracts/canonical.ts"
import type { DomainProjection } from "../../../../product/contracts/context.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import { createSfRecordHistory } from "../../../../product/host-binding/business-context.ts"
import { createSfDashboardRecordSourceAccess } from "../../../../product/decision-memory/source-access.ts"
import { createSfPlannerEvidence } from "../../../../../../../apps/cli/src/sucafina-product/planner-evidence.ts"
import { financialCompositionFixture } from "../integration/financial-composition-fixture.ts"

type Capture = { ref: BusinessEvidenceRef; projection: DomainProjection }
// This tests the continuity boundary with real source producers and SQLite. The
// injected capture is explicit fixture evidence; atlas-recovery exercises the
// protected Atlas reader with a real durable append and scanner separately.
test("record history keeps original bytes and rejects missing, changed, revoked or recreated sources", async () => {
  const f = await financialCompositionFixture()
  const call = await f.read()
  try {
    const records = f.business.dashboardRecords
    const fresh = createSfDashboardRecordSourceAccess({ host: f.authority.host, records })
    const issued = await records.issue({ page: "OPEX Detail", recordType: "opexOwners", recordId: "owner", fields: ["budget"], period: { start: "2026-01-01", end: "2026-12-31" } }, call)
    if (issued.status !== "ok") throw new Error(`Source unavailable: ${issued.reason}`)
    const original = issued.value
    const read = await fresh(original, call)
    if (read.state !== "fresh" || !read.authorizedProjection || !("values" in read.authorizedProjection)) throw new Error("Actual original projection unavailable")
    let captured: Capture | undefined = { ref: structuredClone(original), projection: structuredClone(read.authorizedProjection) }
    const originalCapture = structuredClone(captured)
    const action: { current?: () => Promise<void> } = {}
    const history = createSfRecordHistory({ host: f.authority.host, now: () => f.clock.at, readOriginalCapture: async () => structuredClone(captured),
      current: async (ref, page, context) => {
        if (!page || !ref.target.period) throw new Error("Original source scope unavailable")
        const current = await records.issue({ page, recordType: ref.target.recordType, recordId: ref.target.recordId, fields: ref.target.fields, period: ref.target.period }, context)
        if (current.status !== "ok") return { state: "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: f.clock.at }
        const value = await fresh(current.value, context)
        const run = action.current
        delete action.current
        await run?.()
        return value
      } })
    await f.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.opexOwners = [{ id: "owner", name: "Operations", budget: 1800 }]; return { commit: true, value: undefined } })
    const result = await history.resolve(original, call)
    expect(result.state).toBe("historical")
    expect(result.authorizedProjection).toEqual(originalCapture.projection)
    expect(result.differences).toContainEqual({ field: "opexOwners:owner:budget", before: 1200, after: 1800 })
    expect(result.currentRef?.refDigest).not.toBe(original.refDigest)
    if (!result.currentRef) throw new Error("Current authorized source missing")
    expect(await history.proveContinuity(original, result.currentRef, call)).toBe(true)
    captured = undefined
    expect((await history.resolve(original, call)).state).toBe("unavailable")
    captured = structuredClone(originalCapture)
    const forged = { ...original, refId: "forged" }
    expect((await history.resolve({ ...forged, refDigest: digestSfEvidenceRef(forged) }, call)).state).toBe("unavailable")
    action.current = async () => { captured = { ...originalCapture, projection: { ...originalCapture.projection, engineVersion: "changed-capture" } } }
    expect((await history.resolve(original, call)).state).toBe("unavailable")
    captured = structuredClone(originalCapture)
    const mutable = structuredClone(original)
    action.current = async () => { mutable.refId = "changed-during-read" }
    expect((await history.resolve(mutable, call)).state).toBe("unavailable")
    action.current = async () => { f.active.value = false }
    expect((await history.resolve(original, call)).state).toBe("unavailable")
    expect(action.current).toBeUndefined()
    f.active.value = true
    const restored = await f.read()
    try {
      expect((await history.resolve(original, restored)).state).toBe("historical")
      await f.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.opexOwners = []; return { commit: true, value: undefined } })
      await f.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.opexOwners = [{ id: "owner", name: "Operations", budget: 1800 }]; return { commit: true, value: undefined } })
      expect((await history.resolve(original, restored)).state).toBe("unavailable")
      expect(await history.proveContinuity(original, result.currentRef, restored)).toBe(false)
    } finally { f.authority.ui.finish(restored) }
  } finally { f.authority.ui.finish(call); await f.dispose() }
}, 60_000)

test("Planner history retains the original projection while separately proving the current forecast", async () => {
  const f = await financialCompositionFixture()
  const call = await f.read()
  const forecast = (amount: number) => ({ id: "v0", year: 2026, closed: 0,
    lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(120), a: Array(12).fill(null), f: Array(12).fill(amount) }],
    fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })
  try {
    await f.persistence.transaction("planner", async (snapshot) => { snapshot.data.versions = [forecast(120)]; return { commit: true, value: undefined } })
    const first = await f.business.plannerProduct.issueSource("v0", call)
    if (first.status !== "ok") throw new Error(`Planner source unavailable: ${first.reason}`)
    const ref = first.value.evidence
    const project = createSfPlannerEvidence({ host: f.authority.host, sources: f.business.plannerSources })
    const original = await project.readEvidence(ref, call)
    if (original.state !== "fresh" || !original.authorizedProjection || !("values" in original.authorizedProjection)) throw new Error("Planner projection unavailable")
    const captured = { ref, projection: original.authorizedProjection }
    const history = createSfRecordHistory({ host: f.authority.host, now: () => f.clock.at, readOriginalCapture: async () => structuredClone(captured),
      current: async (_original, _page, context) => {
        const current = await f.business.plannerProduct.issueSource("v0", context)
        return current.status === "ok" ? project.readEvidence(current.value.evidence, context) : { state: "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: f.clock.at }
      } })
    await f.persistence.transaction("planner", async (snapshot) => { snapshot.data.versions = [forecast(240)]; return { commit: true, value: undefined } })
    const result = await history.resolve(ref, call)
    expect(result.state).toBe("historical")
    expect(result.authorizedProjection).toEqual(captured.projection)
    expect(result.currentRef?.refDigest).not.toBe(ref.refDigest)
    expect(result.differences?.some((difference) => difference.field === "source.version")).toBe(true)
    if (!result.currentRef) throw new Error("Current forecast unavailable")
    expect(await history.proveContinuity(ref, result.currentRef, call)).toBe(true)
    await f.persistence.transaction("planner", async (snapshot) => { snapshot.data.versions = []; return { commit: true, value: undefined } })
    await f.persistence.transaction("planner", async (snapshot) => { snapshot.data.versions = [forecast(240)]; return { commit: true, value: undefined } })
    expect((await history.resolve(ref, call)).state).toBe("unavailable")
  } finally { f.authority.ui.finish(call); await f.dispose() }
}, 60_000)
