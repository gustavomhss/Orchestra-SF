import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardRecordSourceIssuer, createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost, createDashboardSourceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import { createDashboardAgendaSelector, dashboardPerformanceAgendaRecords } from "../../../product/dashboard/agenda.ts"
import { projectDashboardScope } from "../../../product/dashboard/scope.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

async function setup(omitPerformanceLifecycle = false) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-agenda-subset-"))
  const store = await openLocalStore(directory)
  const at = "2026-11-13T00:00:00Z"
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "admin", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: (surface, snapshot) => enumerateSfSources(surface, snapshot).filter((entry) => !omitPerformanceLifecycle || entry.recordType !== "itperf-item"), projectScope: createSfSourceScopeProjector(() => at) })
  await persistence.initializeSources("dashboard")
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]
    snapshot.data.opsCats = ["Infrastructure"]
    snapshot.data.opsTickets = [
      { id: "oct", year: 2026, month: 10, "Infrastructure|Incidents|Open": 10, "Infrastructure|Incidents|Closed": 5 },
      { id: "nov", year: 2026, month: 11, "Infrastructure|Incidents|Open": 20, "Infrastructure|Incidents|Closed": 15 },
    ]
    return { commit: true, value: undefined }
  })
  const host: DomainPortHost = { persistence, authenticate: async (_request, binding) => resolve("admin", [...binding!.roleMap], (group) => group === "admins"), environment: async () => ({ at, id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test"), revalidate: async () => true }
  const sources = createDashboardSourceHost({ host, scopedSources: persistence })
  const recordEvidence = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
  const dashboard = createDashboardPort({ host, sources, recordEvidence })
  return { context, period, persistence, select: createDashboardAgendaSelector({ dashboard, sources, recordEvidence, host }), issue: createDashboardSourceIssuer({ host, scopedSources: persistence }), close: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) } }
}

test("operations agenda subsets retain only the chosen monthly register and its missing cells", async () => {
  const fixture = await setup()
  try {
    const source = await fixture.issue({ page: "IT Operations", fields: ["opsTickets"], period: fixture.period }, fixture.context)
    expect(source.status).toBe("ok")
    if (source.status !== "ok") return
    const request = { selectionRef: source.value.selectionRef, topic: "it-operations", period: fixture.period }
    const all = await fixture.select(request, fixture.context)
    expect(all.status).toBe("ok")
    if (all.status !== "ok") return
    expect(all.value.recordCount).toBe(2)
    const chosen = await fixture.select({ ...request, recordRefs: [all.value.recordRefs[1]!] }, fixture.context)
    expect(chosen.status).toBe("ok")
    if (chosen.status !== "ok") return
    expect(chosen.value.recordRefs).toEqual([all.value.recordRefs[1]!])
    expect(chosen.value.projection.values.length).toBeGreaterThan(0)
    expect(chosen.value.projection.values.every((value) => value.id.startsWith("tickets:2026-11:"))).toBe(true)
    expect(chosen.value.projection.values.find((value) => value.id === "tickets:2026-11:Infrastructure|Incidents|Open")?.value).toBe(20)
    expect(chosen.value.projection.values.find((value) => value.id === "tickets:2026-11:Infrastructure|Service Requests|Open")?.value).toBeNull()
    expect(chosen.value.projection.missing.length).toBeGreaterThan(0)
    expect(chosen.value.projection.missing.every((entry) => entry.field.startsWith("tickets:2026-11:"))).toBe(true)
    expect(chosen.value.projection.components).toEqual([])
    const empty = await fixture.select({ ...request, recordRefs: [] }, fixture.context)
    expect(empty.status === "ok" && empty.value.projection.values).toEqual([])
    expect((await fixture.select({ ...request, recordRefs: ["unissued-reference"] }, fixture.context)).status).not.toBe("ok")
  } finally { await fixture.close() }
})

test("operations agenda cannot attribute duplicate monthly values to one physical record", async () => {
  const fixture = await setup()
  try {
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opsTickets = [{ id: "one", year: 2026, month: 11, "Infrastructure|Incidents|Open": 10 }, { id: "two", year: 2026, month: 11, "Infrastructure|Incidents|Open": 20 }]
      return { commit: true, value: undefined }
    })
    const source = await fixture.issue({ page: "IT Operations", fields: ["opsTickets"], period: fixture.period }, fixture.context)
    expect(source.status).toBe("ok")
    if (source.status !== "ok") return
    expect(await fixture.select({ selectionRef: source.value.selectionRef, topic: "it-operations", period: fixture.period }, fixture.context)).toMatchObject({ status: "unavailable", reason: "agenda-ticket-month-ambiguous" })
  } finally { await fixture.close() }
})

test("operations agenda revalidates source changes and current role access", async () => {
  const fixture = await setup()
  try {
    const source = await fixture.issue({ page: "IT Operations", fields: ["opsTickets"], period: fixture.period }, fixture.context)
    expect(source.status).toBe("ok")
    if (source.status !== "ok") return
    const request = { selectionRef: source.value.selectionRef, topic: "it-operations", period: fixture.period }
    const all = await fixture.select(request, fixture.context)
    expect(all.status).toBe("ok")
    if (all.status !== "ok") return
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opsTickets = [{ id: "oct", year: 2026, month: 10, "Infrastructure|Incidents|Open": 99 }]
      return { commit: true, value: undefined }
    })
    expect((await fixture.select({ ...request, recordRefs: [all.value.recordRefs[0]!] }, fixture.context)).status).not.toBe("ok")
    const fresh = await fixture.issue({ page: "IT Operations", fields: ["opsTickets"], period: fixture.period }, fixture.context)
    expect(fresh.status).toBe("ok")
    await fixture.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = []; return { commit: true, value: undefined } })
    if (fresh.status === "ok") expect((await fixture.select({ ...request, selectionRef: fresh.value.selectionRef }, fixture.context)).status).toBe("denied")
  } finally { await fixture.close() }
})

test("executive agenda retains its selected aggregate fields and explicitly subsets signal sources", async () => {
  const fixture = await setup()
  try {
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.hotTopics = [{ id: "h1", action: "Overdue action", due: "2026-11-01", status: "open" }, { id: "done", action: "Completed action", due: "2026-11-01", status: "done" }]
      snapshot.data.risks = [{ id: "r1", title: "Active risk", status: "open", impact: 4, probability: 4 }]
      snapshot.data.contracts = [{ id: "c1", vendor: "Renewal", renewal: "2026-12-01" }]
      return { commit: true, value: undefined }
    })
    const source = await fixture.issue({ page: "Executive Dashboard", fields: ["executive", "executiveMonths", "signals"], period: fixture.period }, fixture.context)
    expect(source.status).toBe("ok")
    if (source.status !== "ok") return
    const request = { selectionRef: source.value.selectionRef, topic: "executive", period: fixture.period }
    const all = await fixture.select(request, fixture.context)
    expect(all).toMatchObject({ status: "ok", value: { recordCount: 3, coverage: { unit: "signal-source-records", total: 3, selected: 3, aggregatesIncluded: true } } })
    if (all.status !== "ok") return
    expect(all.value.projection.values.some((value) => value.id.startsWith("executive."))).toBe(true)
    expect(all.value.projection.values.some((value) => value.id.startsWith("executiveMonths."))).toBe(true)
    const one = await fixture.select({ ...request, recordRefs: [all.value.recordRefs[0]!] }, fixture.context)
    expect(one).toMatchObject({ status: "ok", value: { recordCount: 1, coverage: { total: 3, selected: 1, aggregatesIncluded: false } } })
    if (one.status === "ok") {
      expect(one.value.projection.values.length).toBeGreaterThan(0)
      expect(one.value.projection.values.every((value) => value.id.startsWith("signals[id:"))).toBe(true)
      expect(one.value.projection.values.every((value) => value.drilldown?.refId === all.value.recordRefs[0])).toBe(true)
    }
    const empty = await fixture.select({ ...request, recordRefs: [] }, fixture.context)
    expect(empty).toMatchObject({ status: "ok", value: { recordCount: 0, projection: { values: [] }, coverage: { total: 3, selected: 0, aggregatesIncluded: false } } })
    expect((await fixture.select({ ...request, recordRefs: [source.value.selectionRef] }, fixture.context)).status).toBe("denied")
    await fixture.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = []; return { commit: true, value: undefined } })
    expect((await fixture.select({ ...request, recordRefs: [all.value.recordRefs[0]!] }, fixture.context)).status).toBe("denied")
  } finally { await fixture.close() }
})

test("performance item projection uses real unique IDs and preserves source privacy and current period", async () => {
  const fixture = await setup()
  try {
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.itperf = { items: [{ id: "item1", name: "Delivery", hiddenSecret: "private", subs: [{ id: "sub1", label: "Availability", score: 4, totalWeight: 1 }] }] }
      const projection = projectDashboardScope(snapshot, { id: "admin", roles: ["admin"], canWrite: true }, { page: "IT Performance Contract", fields: ["itperf"], period: fixture.period }, "2026-11-13T00:00:00Z")
      const items = dashboardPerformanceAgendaRecords(projection?.selected.itperf)
      expect(items).toHaveLength(1)
      expect(items?.[0]?.id).toBe("item1")
      expect(items?.[0]?.hiddenSecret).toBeUndefined()
      expect(projectDashboardScope(snapshot, { id: "admin", roles: ["admin"], canWrite: true }, { page: "IT Performance Contract", fields: ["itperf"], period: { start: "2025-01-01", end: "2025-12-31" } }, "2026-11-13T00:00:00Z")).toBeUndefined()
      return { commit: false, value: undefined }
    })
    expect(dashboardPerformanceAgendaRecords({ items: [{ id: "same" }, { id: "same" }] })).toBeUndefined()
    expect(dashboardPerformanceAgendaRecords({ items: [{ id: 1 }, { id: "1" }] })).toBeUndefined()
    expect(dashboardPerformanceAgendaRecords({ items: [{ name: "missing ID" }] })).toBeUndefined()
    expect(dashboardPerformanceAgendaRecords({ items: [null] })).toBeUndefined()
    expect(dashboardPerformanceAgendaRecords({ items: [] })).toEqual([])
  } finally { await fixture.close() }
})

test("performance agenda fails closed when the host has no physical item lifecycle", async () => {
  const fixture = await setup(true)
  try {
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.itperf = { items: [{ id: "item1", name: "Delivery", subs: [] }] }
      return { commit: true, value: undefined }
    })
    const source = await fixture.issue({ page: "IT Performance Contract", fields: ["itperf"], period: fixture.period }, fixture.context)
    expect(source.status).toBe("ok")
    if (source.status !== "ok") return
    expect(await fixture.select({ selectionRef: source.value.selectionRef, topic: "it-performance", period: fixture.period }, fixture.context)).toMatchObject({ status: "unavailable", reason: "agenda-performance-source-lifecycle-unavailable" })
  } finally { await fixture.close() }
})
