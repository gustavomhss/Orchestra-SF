import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { Actor, Snapshot } from "../../../runtime/contract.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import type { SfSourceScope } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { projectSfSourceScope } from "../../../product/integration/source-projections.ts"
import { roleMap } from "../../../runtime/admin.ts"
import { simulateDashboardCommand, applyDashboardPreview } from "../../../product/dashboard/commands.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DashboardMutationScope } from "../../../product/dashboard/mutation-scope.ts"
import { normalizeDashboardRecords } from "../../../product/dashboard/records.ts"
import { dashboardImpactCovered, dashboardMutationImpact, prepareDashboardMutationScope } from "../../../product/dashboard/mutation-scope.ts"
import { createDashboardPreparedMutation } from "../../../product/dashboard/prepared.ts"

const target = { surface: "dashboard" as const, type: "opexOwners", id: "o", incarnation: "inc", version: 1, fields: ["budget"], period: { start: "2026-01-01", end: "2026-12-31" }, observedAt: "2026-11-13T00:00:00Z" }
const input = { actorId: "admin", target, command: { page: "OPEX Detail", action: "annual-entry", id: "o", version: 0, values: { year: 2026, annual: 2400 } }, baseDigest: "a".repeat(64), previewDigest: "b".repeat(64), idempotencyKey: "change-1" }

test("one record reference cannot authorize a multi-record budget mutation", () => {
  expect(createDashboardPreparedMutation(input)).toBeUndefined()
  expect(createDashboardPreparedMutation({ ...input, target: { ...target, fields: ["name"], period: { start: "2026-01-01", end: "2026-01-31" } } })).toBeUndefined()
  expect(createDashboardPreparedMutation({ ...input, command: { ...input.command, action: "year-amount", values: { year: 2026, amount: 100 } } })).toBeUndefined()
  expect(createDashboardPreparedMutation({ ...input, target: { ...target, type: "opexEntries", fields: ["actual"] }, command: { ...input.command, action: "save-entry", values: { year: 2026, month: 1, actual: 100 } } })).toBeUndefined()
  expect(createDashboardPreparedMutation({ ...input, command: { ...input.command, action: "delete", values: {} } })).toBeUndefined()
})

test("other dashboard mutations stay unavailable without a proven complete footprint", () => {
  expect(createDashboardPreparedMutation({ ...input, target: { ...target, type: "projects" }, command: { ...input.command, page: "All Projects", action: "save", values: { name: "Changed" } } })).toBeUndefined()
})

test("actual staged footprint requires every changed record and month", () => {
  const before = { data: { opexOwners: [{ id: "o", budget: 1200 }], opexEntries: [{ id: "jan", ownerId: "o", year: 2026, month: 1, budget: 100 }] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const after = structuredClone(before)
  after.data.opexOwners[0]!.budget = 2400
  after.data.opexEntries[0]!.budget = 200
  after.data.opexEntries.push({ id: "feb", ownerId: "o", year: 2026, month: 2, budget: 200 })
  const impact = dashboardMutationImpact(before, after, input.command, target.period)!
  const scope = { period: target.period, impactDigest: digestSfValue(impact), reservedIds: ["feb"], observedAt: target.observedAt, targets: [], creates: [] }
  expect(impact).toHaveLength(3)
  expect(dashboardImpactCovered(impact, scope)).toBe(false)
  expect(impact.find((entry) => entry.id === "jan")?.period).toEqual({ start: "2026-01-01", end: "2026-01-31" })
  expect(dashboardMutationImpact(before, after, { ...input.command, values: { year: "2026", annual: 2400 } }, target.period)).toEqual(impact)
  expect(impact.find((entry) => entry.id === "feb")?.operation).toBe("create")
  const february = impact.filter((entry) => entry.id === "feb")
  const granted = { ...scope, creates: [{ type: "opexEntries", id: "feb", fields: february[0]!.fields, period: target.period }] }
  expect(dashboardImpactCovered(february, granted)).toBe(true)
  expect(dashboardImpactCovered(february, { ...granted, period: { start: "2026-01-01", end: "2026-01-31" } })).toBe(false)
  const numericBefore = { ...before, data: { opexOwners: [{ id: 7, budget: 1 }] } }
  const numericAfter = { ...before, data: { opexOwners: [{ id: 7, budget: 2 }] } }
  expect(dashboardMutationImpact(numericBefore, numericAfter, input.command, target.period)).toEqual(expect.arrayContaining([expect.objectContaining({ type: "opexOwners", id: "7", fields: ["budget"] })]))
})

test("annual write applies only with an authorized scope for every generated entry", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "dashboard-scope-"))
  const store = await openLocalStore(directory)
  const actor = { id: "admin", roles: ["admin"], canWrite: true, assigned: [], domains: [] }
  const project = (snapshot: Snapshot, _actor: Actor, scope: SfSourceScope) => (snapshot.data[scope.recordType] as { id: string }[] | undefined)?.find((row) => row.id === scope.recordId)
  const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, createId: randomUUID, projectScope: (_surface, snapshot, scope) => project(snapshot, actor, scope) })
  try {
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.opexOwners = [{ id: "o", name: "Owner", budget: 1200 }]; snapshot.data.opexEntries = []; return { commit: true, value: undefined } })
    const state = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const command = { page: "OPEX Detail", action: "annual-entry", id: "o", version: 0, values: { year: 2026, annual: 2400 } }
    const reservedIds = Array.from({ length: 12 }, (_, index) => `month-${index + 1}`)
    const environment = () => { let used = 0; return { at: "2026-11-13T00:00:00Z", id: () => reservedIds[used++] ?? "", directory: [] } }
    const preview = simulateDashboardCommand(state, actor, command, environment())
    expect(preview.status).toBe("preview")
    if (preview.status !== "preview") return
    const staged = structuredClone(state)
    expect(applyDashboardPreview(staged, actor, command, environment(), preview.baseDigest, preview.commandDigest).ok).toBe(true)
    const impact = dashboardMutationImpact(state, staged, command, target.period)!
    const scope = { principalRef: actor.id, accessRevision: "1", policyVersion: "1", recordType: "opexOwners", recordId: "o", selector: { actor, fields: ["budget"], period: target.period } }
    const issued = await persistence.readScopedSource("dashboard", scope, async () => true)
    expect(issued).toBeDefined()
    if (!issued) return
    const source = { ...target, incarnation: issued.incarnation, version: issued.version }
    const proof = prepareDashboardMutationScope({ snapshot: state, actor, environment: environment(), command, baseDigest: preview.baseDigest, previewDigest: preview.commandDigest, period: target.period, targets: [{ source, scope }], creates: impact.filter((entry) => entry.operation === "create").map((entry) => ({ type: entry.type, id: entry.id, fields: entry.fields, period: entry.period })), reservedIds })
    expect(proof).toBeDefined()
    if (!proof) return
    const build = (mutationScope: typeof proof) => createDashboardPreparedMutation({ actorId: actor.id, target: source, command, baseDigest: preview.baseDigest, previewDigest: preview.commandDigest, idempotencyKey: "annual", mutationScope, projectScope: project })!
    const registered = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const omitted = build({ ...proof, creates: proof.creates.slice(1) })
    expect(omitted.execute(registered, actor, environment())).toMatchObject({ commit: false, value: { status: "conflict", reason: "mutation-scope-mismatch" } })
    const narrow = build({ ...proof, targets: [{ source: { ...source, fields: ["name"] }, scope }] })
    expect(narrow).toBeUndefined()
    const result = await persistence.transaction("dashboard", async (snapshot) => build(proof).execute(snapshot, actor, environment()))
    expect(result).toMatchObject({ status: "applied" })
    const saved = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.opexEntries }))
    expect(saved).toHaveLength(12)
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})

test("real budget commands expose monthly, annual-YTD and deletion footprints", () => {
  const actor = { id: "admin", roles: ["admin"], canWrite: true }
  const base: Snapshot = { data: { opexOwners: [{ id: "o", name: "Owner", budget: 1200 }], opexEntries: [{ id: "jan", ownerId: "o", year: 2026, month: 1, budget: 100, actual: 10, forecast: 0 }] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const env = () => { let serial = 0; return { at: "2026-11-13T00:00:00Z", id: () => `generated-${++serial}`, directory: [] } }
  const cases = [
    { action: "save-entry", id: "jan", values: { year: 2026, month: 1, actual: 20 } },
    { action: "year-amount", id: "o", values: { year: 2026, amount: 2400 } },
    { action: "delete", id: "o", values: { year: 2026 } },
  ]
  const impacts = cases.map((item) => {
    const command = { page: "OPEX Detail", version: 0, ...item }
    const preview = simulateDashboardCommand(base, actor, command, env())
    expect(preview.status).toBe("preview")
    if (preview.status !== "preview") return []
    const staged = structuredClone(base)
    expect(applyDashboardPreview(staged, actor, command, env(), preview.baseDigest, preview.commandDigest).ok).toBe(true)
    return dashboardMutationImpact(base, staged, command, target.period) ?? []
  })
  expect(impacts[0]).toEqual(expect.arrayContaining([expect.objectContaining({ type: "opexEntries", id: "jan", fields: expect.arrayContaining(["actual"]), period: { start: "2026-01-01", end: "2026-01-31" } })]))
  expect(impacts[1]).toEqual(expect.arrayContaining([expect.objectContaining({ type: "budgetYtd", id: JSON.stringify(["opex", "2026:o"]) }), expect.objectContaining({ type: "opexEntries", id: "jan" })]))
  expect(impacts[2]).toEqual(expect.arrayContaining([expect.objectContaining({ type: "opexOwners", id: "o", operation: "delete" }), expect.objectContaining({ type: "opexEntries", id: "jan", operation: "delete" })]))
})

test("monthly, year-amount and cascading delete use real scoped grants", async () => {
  const cases = [
    { action: "save-entry", id: "jan", values: { year: 2026, month: 1, actual: 20 } },
    { action: "year-amount", id: "o", values: { year: 2026, amount: 2400 } },
    { action: "delete", id: "o", values: { year: 2026 } },
  ]
  for (const item of cases) {
    const directory = await mkdtemp(path.join(await realpath(tmpdir()), "dashboard-mutation-"))
    const store = await openLocalStore(directory)
    const actor = { id: "admin", roles: ["admin"], canWrite: true, assigned: [], domains: [] }
    const project = (snapshot: Snapshot, _actor: Actor, scope: SfSourceScope) => projectSfSourceScope("dashboard", snapshot, scope, "2026-11-13T00:00:00Z")
    const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, createId: randomUUID, projectScope: (_surface, snapshot, scope) => project(snapshot, actor, scope) })
    try {
      await persistence.initializeSources("dashboard")
      await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.opexOwners = [{ id: "o", name: "Owner", budget: 1200 }]; snapshot.data.opexEntries = [{ id: "jan", ownerId: "o", year: 2026, month: 1, budget: 100, actual: 10, forecast: 0 }]; return { commit: true, value: undefined } })
      const state = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
      const command = { page: "OPEX Detail", version: 0, ...item }
      const reservedIds: string[] = []
      const previewEnvironment = { at: "2026-11-13T00:00:00Z", id: () => { const id = `generated-${reservedIds.length + 1}`; reservedIds.push(id); return id }, directory: [] }
      const preview = simulateDashboardCommand(state, actor, command, previewEnvironment)
      expect(preview.status).toBe("preview")
      if (preview.status !== "preview") continue
      const environment = () => { let used = 0; return { at: previewEnvironment.at, id: () => reservedIds[used++] ?? "", directory: [] } }
      const staged = structuredClone(state)
      expect(applyDashboardPreview(staged, actor, command, environment(), preview.baseDigest, preview.commandDigest).ok).toBe(true)
      const impact = dashboardMutationImpact(state, staged, command, target.period)!
      if (item.action === "year-amount") expect(impact).toEqual(expect.arrayContaining([expect.objectContaining({ type: "budgetYtd", id: JSON.stringify(["opex", "2026:o"]), operation: "create" })]))
      const records = impact.filter((change) => change.operation !== "create")
      if (!records.some((entry) => entry.id === command.id)) records.push({ type: "opexOwners", id: "o", operation: "update", fields: ["budget"], period: target.period, before: undefined, after: undefined })
      const targets: DashboardMutationScope["targets"][number][] = []
      for (const change of records) {
        const scope = { principalRef: actor.id, accessRevision: "1", policyVersion: "1", recordType: change.type, recordId: change.id, selector: { page: "OPEX Detail", actor, fields: change.fields, period: change.period, roleMapDigest: digestSfValue(roleMap(state, "dashboard")) } }
        const issued = await persistence.readScopedSource("dashboard", scope, async () => true)
        expect(issued).toBeDefined()
        if (!issued) continue
        targets.push({ scope, source: { surface: "dashboard", type: change.type, id: change.id, incarnation: issued.incarnation, version: issued.version, fields: change.fields, period: change.period, observedAt: previewEnvironment.at } })
      }
      const source = targets.find((entry) => entry.source.id === command.id)?.source
      expect(source).toBeDefined()
      if (!source) continue
      const creates = impact.filter((change) => change.operation === "create").map((change) => ({ type: change.type, id: change.id, fields: change.fields, period: change.period }))
      const proof = prepareDashboardMutationScope({ snapshot: state, actor, environment: environment(), command, baseDigest: preview.baseDigest, previewDigest: preview.commandDigest, period: target.period, targets, creates, reservedIds })
      expect(proof).toBeDefined()
      if (!proof) continue
      const mutation = createDashboardPreparedMutation({ actorId: actor.id, target: source, command, baseDigest: preview.baseDigest, previewDigest: preview.commandDigest, idempotencyKey: item.action, mutationScope: proof, projectScope: project })
      expect(mutation).toBeDefined()
      if (!mutation) continue
      expect(await persistence.transaction("dashboard", async (snapshot) => mutation.execute(snapshot, actor, environment()))).toMatchObject({ status: "applied" })
    } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
  }
})

test("keyed budget maps produce isolated logical records", () => {
  const before: Snapshot = { data: { budgetYtd: { opex: { "2026:o": { amount: 100, months: 2 }, "2026:private": { amount: 50, months: 1 } } }, deviations: { "opex-o-2026-2": { flag: "dev-red", text: "note" } }, revenueByYear: { 2026: 200 }, budgetCurrentMonth: { 2026: 2 } }, versions: {}, sequences: {}, audit: [], notices: [] }
  const after = structuredClone(before)
  ;((after.data.budgetYtd as { opex: Record<string, { amount: number }> }).opex["2026:o"]!).amount = 120
  const impact = dashboardMutationImpact(before, after, input.command, target.period)!
  expect(impact).toHaveLength(1)
  expect(impact[0]).toMatchObject({ type: "budgetYtd", id: JSON.stringify(["opex", "2026:o"]), fields: ["amount"], period: target.period })
  expect(JSON.stringify(impact)).not.toContain("private")
  const malformed = structuredClone(after)
  malformed.data.budgetYtd = { opex: { "invalid-key": { amount: 1 } } }
  expect(dashboardMutationImpact(before, malformed, input.command, target.period)).toBeUndefined()
})


test("keyed dashboard record identities retain their real time scope", () => {
  expect(normalizeDashboardRecords("deviations", { "capex-project-with-hyphens-2026-2": { flag: "dev-red", text: "note" } })).toEqual([{ id: "capex-project-with-hyphens-2026-2", kind: "capex", ownerId: "project-with-hyphens", year: 2026, month: 2, flag: "dev-red", text: "note" }])
  expect(normalizeDashboardRecords("budgetCurrentMonth", { 2026: 2 })).toEqual([{ id: "2026", year: 2026, value: 2 }])
  expect(normalizeDashboardRecords("revenueByYear", { 2026: 100 })).toEqual([{ id: "2026", year: 2026, value: 100 }])
  expect(normalizeDashboardRecords("budgetYtd", { opex: { "2026:owner:with:colons": { amount: 100 } } })).toEqual([{ id: JSON.stringify(["opex", "2026:owner:with:colons"]), kind: "opex", ownerId: "owner:with:colons", year: 2026, amount: 100 }])
  expect(normalizeDashboardRecords("deviations", { "opex-o-2026-13": { flag: "dev-red" } })).toBeUndefined()
})
