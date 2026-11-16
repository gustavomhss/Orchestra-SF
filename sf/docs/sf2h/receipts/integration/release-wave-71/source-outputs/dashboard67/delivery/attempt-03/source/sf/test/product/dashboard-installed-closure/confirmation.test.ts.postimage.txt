import { expect, test } from "bun:test"
import { createDashboardProofFixture } from "./fixture.ts"
import { classifyDashboardConfirmationChange, type DashboardConfirmationObservation } from "../../../product/dashboard/confirmation.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { ConfirmationScope } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { rows } from "../../../runtime/contract.ts"

const january = { start: "2026-01-01", end: "2026-01-31" }
const annual = { start: "2026-01-01", end: "2026-12-31" }
type Fixture = Awaited<ReturnType<typeof createDashboardProofFixture>>

function available(value: DashboardConfirmationObservation) {
  expect(value.state).toBe("available")
  if (value.state !== "available") throw new Error("The real C06 observation is unavailable")
  return value
}

async function seedBudget(f: Fixture, actual?: number) {
  // Only starting business data is fixed. Admission, source identities, projections,
  // versioning and fences are the production producers over the actual SQLite store.
  await f.persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.opexOwners = [{ id: "operating-line", name: "Private fiscal line", budget: 1200 }]
    snapshot.data.opexEntries = [
      { id: "january", ownerId: "operating-line", year: 2026, month: 1, budget: 200, forecast: 0, ...(actual === undefined ? {} : { actual }) },
      { id: "february", ownerId: "operating-line", year: 2026, month: 2, budget: 100, actual: 10, forecast: 95 },
    ]
    return { commit: true, value: undefined }
  })
}

async function budgetScope(f: Fixture, context: TrustedDomainContext): Promise<ConfirmationScope> {
  const page = await f.observer.issueForActor({ recordType: "dashboard-page", recordId: "Budget Overview", fields: ["budgetSeries"], period: january }, context)
  expect(page.status).toBe("ok")
  if (page.status !== "ok") throw new Error("The authorized January page source was not issued")
  const dependency = await f.records.issue({ page: "OPEX Detail", recordType: "opexOwners", recordId: "operating-line", fields: ["budget"], period: annual }, context)
  expect(dependency.status).toBe("ok")
  if (dependency.status !== "ok") throw new Error("The authorized annual dependency was not issued")
  const read = await f.records.read(dependency.value.refId, context)
  expect(read.status).toBe("ok")
  if (read.status !== "ok" || read.value.context.sourceRefs.length !== 1) throw new Error("The dependency has no exact producer source reference")
  const target = page.value.target
  return { sourceRef: { surface: "dashboard", type: target.recordType, id: target.recordId, incarnation: target.incarnation },
    fields: ["budgetSeries"], period: january, materialDependencies: read.value.context.sourceRefs, scopeDefinitionVersion: "dashboard-c06-v1" }
}

async function lockedFence(f: Fixture, scope: ConfirmationScope, observation: Extract<DashboardConfirmationObservation, { state: "available" }>, context: TrustedDomainContext) {
  if (!f.persistence.transactionAll) throw new Error("The real C06 fence requires the production transactionAll driver")
  return f.persistence.transactionAll(async () => ({ commit: false, value: await f.observer.fence(scope, observation, context) }))
}

test("C06 real admissions retain the original observation while monthly material and dependencies advance independently", async () => {
  const f = await createDashboardProofFixture()
  try {
    await seedBudget(f, 0)
    const proof = await f.read(async (context) => {
      const scope = await budgetScope(f, context)
      const scopeBefore = structuredClone(scope)
      const original = available(await f.observer.observe(scope, context))
      const originalBefore = structuredClone(original)
      expect(original.evidence.target.version).toBe(original.sourceVersion)
      expect(original.projection.context.principalRef).toBe(f.principal())
      expect(original.projection.context.sourceRefs[0]?.version).toBe(original.sourceVersion)
      expect(original.projection.values.find((value) => value.id === "budget:2026-01:actual")).toMatchObject({ value: 0, evidenceState: "confirmed", period: january })
      expect(JSON.stringify(original.projection)).not.toContain("Private fiscal line")
      expect(JSON.stringify(original.projection)).not.toContain("privateDependencyDigest")
      expect(await f.observer.fence(scope, original, context)).toBe(false)
      expect(await lockedFence(f, scope, original, context)).toBe(true)

      const february = await f.command({ page: "OPEX Detail", action: "save-entry", id: "february", version: 0,
        values: { ownerId: "operating-line", year: 2026, month: 2, budget: 100, actual: 99, forecast: 95 } })
      expect(february.status).toBe(200)
      const outside = available(await f.observer.observe(scope, context))
      expect(outside.scopeFingerprint).toBe(original.scopeFingerprint)
      expect(outside.sourceVersion).toBe(original.sourceVersion)
      expect(classifyDashboardConfirmationChange(outside, original)).toBe("unchanged-scope")
      expect(await lockedFence(f, scope, original, context)).toBe(true)

      // January has an explicit positive override. Changing the annual owner budget
      // affects the selected external dependency, not January's displayed values.
      const annualChange = await f.command({ page: "OPEX Detail", action: "save", id: "operating-line", version: 0,
        values: { name: "Private fiscal line", budget: 2400 } })
      expect(annualChange.status).toBe(200)
      const dependency = available(await f.observer.observe(scope, context))
      expect(dependency.sourceFingerprint).toBe(original.sourceFingerprint)
      expect(dependency.dependencyFingerprint).not.toBe(original.dependencyFingerprint)
      expect(classifyDashboardConfirmationChange(dependency, original)).toBe("dependency-change")
      expect(await lockedFence(f, scope, original, context)).toBe(false)
      expect(await lockedFence(f, scope, dependency, context)).toBe(true)

      const januaryChange = await f.command({ page: "OPEX Detail", action: "save-entry", id: "january", version: 0,
        values: { ownerId: "operating-line", year: 2026, month: 1, budget: 200, actual: 1, forecast: 0 } })
      expect(januaryChange.status).toBe(200)
      const material = available(await f.observer.observe(scope, context))
      expect(material.sourceVersion).toBeGreaterThan(original.sourceVersion)
      expect(material.sourceFingerprint).not.toBe(dependency.sourceFingerprint)
      expect(classifyDashboardConfirmationChange(material, dependency)).toBe("material-change")
      expect(material.projection.values.find((value) => value.id === "budget:2026-01:actual")?.value).toBe(1)
      expect(await lockedFence(f, scope, dependency, context)).toBe(false)
      expect(await lockedFence(f, scope, material, context)).toBe(true)
      expect(original).toEqual(originalBefore)
      expect(scope).toEqual(scopeBefore)
      return { scope, original, originalBefore, material }
    })
    await f.reopen()
    await f.read(async (context) => {
      const reopened = available(await f.observer.observe(proof.scope, context))
      expect(reopened.scopeFingerprint).toBe(proof.material.scopeFingerprint)
      expect(reopened.sourceVersion).toBe(proof.material.sourceVersion)
      expect(await lockedFence(f, proof.scope, reopened, context)).toBe(true)
    })
    expect(proof.original).toEqual(proof.originalBefore)
    expect(proof.original.sourceVersion).toBeLessThan(proof.material.sourceVersion)
  } finally { await f.close() }
})

test("C06 actual absence and recorded zero remain distinct under the real source projection and a durable domain command", async () => {
  const f = await createDashboardProofFixture()
  try {
    await seedBudget(f)
    await f.read(async (context) => {
      const scope = await budgetScope(f, context)
      const absent = available(await f.observer.observe(scope, context))
      const preserved = digestSfValue(absent)
      expect(absent.projection.values.find((value) => value.id === "budget:2026-01:actual")).toMatchObject({ value: null, evidenceState: "absent" })
      expect(absent.projection.missing).toContainEqual({ field: "budget:2026-01:actual", reason: "missing" })
      const written = await f.command({ page: "OPEX Detail", action: "save-entry", id: "january", version: 0,
        values: { ownerId: "operating-line", year: 2026, month: 1, budget: 200, actual: 0, forecast: 0 } })
      expect(written.status).toBe(200)
      const zero = available(await f.observer.observe(scope, context))
      expect(zero.projection.values.find((value) => value.id === "budget:2026-01:actual")).toMatchObject({ value: 0, evidenceState: "confirmed" })
      expect(zero.projection.missing).not.toContainEqual({ field: "budget:2026-01:actual", reason: "missing" })
      expect(zero.scopeFingerprint).not.toBe(absent.scopeFingerprint)
      expect(zero.sourceVersion).toBeGreaterThan(absent.sourceVersion)
      expect(classifyDashboardConfirmationChange(zero, absent)).toBe("material-change")
      expect(await lockedFence(f, scope, absent, context)).toBe(false)
      expect(await lockedFence(f, scope, zero, context)).toBe(true)
      expect(digestSfValue(absent)).toBe(preserved)
    })
    await f.reopen()
    const persisted = await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
      value: rows(snapshot.data.opexEntries).find((entry) => entry.id === "january") }))
    expect(persisted?.actual).toBe(0)
  } finally { await f.close() }
})

test("C06 real authority and source replacement cannot revive a previous observation or its locked fence", async () => {
  const f = await createDashboardProofFixture()
  try {
    const proof = await f.read(async (context) => {
      const day = new Date(f.clock.at).toISOString().slice(0, 10)
      const fields = ["action", "owner", "due", "priority", "notes"]
      const issued = await f.records.issue({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: "topic", fields, period: { start: day, end: day } }, context)
      expect(issued.status).toBe("ok")
      if (issued.status !== "ok") throw new Error("The real Hot Topic source is unavailable")
      const target = issued.value.target
      const scope: ConfirmationScope = { sourceRef: { surface: "dashboard", type: "hotTopics", id: target.recordId, incarnation: target.incarnation },
        fields, period: target.period!, materialDependencies: [], scopeDefinitionVersion: "dashboard-c06-v1" }
      const original = available(await f.observer.observe(scope, context))
      const originalBefore = structuredClone(original)
      expect(await lockedFence(f, scope, original, context)).toBe(true)
      f.policies.owner.readable = false
      const denied = await f.observer.observe(scope, context)
      expect(denied).toEqual({ state: "access-unavailable", sourceVersion: 0 })
      expect(JSON.stringify(denied)).not.toContain("Private operator context")
      expect(await lockedFence(f, scope, original, context)).toBe(false)
      f.policies.owner.readable = true
      // Revalidation closes the old admission. Restoring policy cannot resurrect
      // that request's lease; subsequent reads require a fresh real admission.
      expect(await f.observer.observe(scope, context)).toEqual({ state: "access-unavailable", sourceVersion: 0 })
      expect(await lockedFence(f, scope, original, context)).toBe(false)
      expect(original).toEqual(originalBefore)
      return { day, fields, target, scope, original, originalBefore }
    })

    await f.read(async (context) => {
      const { day, fields, target, scope, original, originalBefore } = proof
      const readmitted = available(await f.observer.observe(scope, context))
      expect(readmitted.scopeFingerprint).toBe(original.scopeFingerprint)
      expect(readmitted.sourceVersion).toBe(original.sourceVersion)
      expect(readmitted.physicalIncarnation).toBe(original.physicalIncarnation)
      expect(await lockedFence(f, scope, readmitted, context)).toBe(true)
      const removed = await f.command({ page: "Hot Topics & Actions", action: "delete", id: "topic", version: 0, values: {}, confirmed: true })
      expect(removed.status).toBe(200)
      expect((await f.observer.observe(scope, context)).state).not.toBe("available")
      expect(await lockedFence(f, scope, original, context)).toBe(false)
      // A genuinely later row with the same text ID is a different physical source.
      // The production source driver, not this fixture, assigns its incarnation.
      await f.persistence.transaction("dashboard", async (snapshot) => {
        snapshot.data.hotTopics = [...rows(snapshot.data.hotTopics), { id: "topic", action: "Replacement action", owner: "Operations", due: "2026-12-01", status: "open", priority: "normal", notes: "Replacement private context" }]
        return { commit: true, value: undefined }
      })
      const replaced = await f.observer.observe(scope, context)
      // Replacement also supersedes the old scoped incarnation. An unknown old
      // selection is unavailable; it must never acquire the replacement's values.
      expect(replaced).toEqual({ state: "access-unavailable", sourceVersion: 0 })
      expect(JSON.stringify(replaced)).not.toContain("Replacement private context")
      expect(await lockedFence(f, scope, original, context)).toBe(false)
      const newSource = await f.records.issue({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: "topic", fields, period: { start: day, end: day } }, context)
      expect(newSource.status).toBe("ok")
      if (newSource.status !== "ok") throw new Error("Replacement source was not issued independently")
      expect(newSource.value.target.incarnation).not.toBe(target.incarnation)
      const currentScope = { ...scope, sourceRef: { ...scope.sourceRef, incarnation: newSource.value.target.incarnation } }
      const current = available(await f.observer.observe(currentScope, context))
      expect(current.physicalIncarnation).not.toBe(original.physicalIncarnation)
      expect(await lockedFence(f, currentScope, current, context)).toBe(true)
      expect((await f.logout())?.status).toBe(204)
      expect(await f.observer.observe(currentScope, context)).toEqual({ state: "access-unavailable", sourceVersion: 0 })
      expect(await lockedFence(f, currentScope, current, context)).toBe(false)
      expect(original).toEqual(originalBefore)
    })
    const other = await f.page("Hot Topics & Actions", "other")
    expect(other.status).toBe(200)
    expect(await other.text()).toContain("Unrelated action")
  } finally { await f.close() }
})
