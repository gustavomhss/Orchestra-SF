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
import { createDashboardAgendaSelector } from "../../../product/dashboard/agenda.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

test("agenda resolves all, a selected project, and an explicit empty selection through real sources", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-agenda-"))
  const store = await openLocalStore(directory)
  try {
    const at = "2026-11-13T00:00:00Z"
    const period = { start: "2026-01-01", end: "2026-12-31" }
    const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "admin", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]; snapshot.data.projects = [{ id: "p1", name: "First", milestones: [{ id: "m1", name: "First milestone", date: "2026-11-10" }] }, { id: "p2", name: "Second", milestones: [{ id: "m2", name: "Second milestone", date: "2026-11-11" }] }]; snapshot.data.opexOwners = [{ id: "o1", name: "One", budget: 1200 }, { id: "o2", name: "Two", budget: 2400 }]; snapshot.data.opexEntries = [{ id: "e1", ownerId: "o1", year: 2026, month: 1, actual: 1 }, { id: "e2", ownerId: "o2", year: 2026, month: 1, actual: 2 }]; snapshot.data.capexProjects = []; snapshot.data.capexEntries = []; return { commit: true, value: undefined } })
    const host: DomainPortHost = { persistence, authenticate: async (_request, binding) => resolve("admin", [...binding!.roleMap], (group) => group === "admins"), environment: async () => ({ at, id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test"), revalidate: async () => true }
    const sources = createDashboardSourceHost({ host, scopedSources: persistence })
    const dashboard = createDashboardPort({ host, sources })
    const recordEvidence = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
    const page = await createDashboardSourceIssuer({ host, scopedSources: persistence })({ page: "Portfolio Dashboard", fields: ["projects", "milestoneDates"], period }, context)
    expect(page.status).toBe("ok")
    if (page.status !== "ok") return
    const select = createDashboardAgendaSelector({ dashboard, sources, recordEvidence, host })
    const request = { selectionRef: page.value.selectionRef, topic: "projects" as const, period }
    const all = await select(request, context)
    expect(all.status).toBe("ok")
    if (all.status !== "ok") return
    expect(all.value.recordCount).toBe(2)
    const one = await select({ ...request, recordRefs: [all.value.recordRefs[0]!] }, context)
    expect(one.status).toBe("ok")
    if (one.status === "ok") { expect(one.value.recordCount).toBe(1); expect(one.value.projection.values.some((value) => value.id.includes("p2"))).toBe(false) }
    const empty = await select({ ...request, recordRefs: [] }, context)
    expect(empty.status === "ok" && empty.value.recordCount).toBe(0)
    if (empty.status === "ok") expect(empty.value.projection.values).toEqual([])
    expect((await select({ ...request, recordRefs: ["not-a-source"] }, context)).status).not.toBe("ok")
    const budget = await createDashboardSourceIssuer({ host, scopedSources: persistence })({ page: "Budget Overview", fields: ["opexOwners", "opexEntries", "capexProjects", "capexEntries", "budgetMetrics"], period }, context)
    expect(budget.status).toBe("ok")
    if (budget.status === "ok") {
      const budgetRequest = { selectionRef: budget.value.selectionRef, topic: "budget", period }
      const allBudget = await select(budgetRequest, context)
      expect(allBudget.status).toBe("ok")
      if (allBudget.status === "ok") {
        expect(allBudget.value.recordCount).toBe(2)
        const selectedBudget = await select({ ...budgetRequest, recordRefs: [allBudget.value.recordRefs[0]!] }, context)
        expect(selectedBudget.status).toBe("ok")
        if (selectedBudget.status === "ok") {
          expect(selectedBudget.value.projection.values.some((value) => value.id.startsWith("budget:") || value.id.startsWith("budgetMetrics."))).toBe(false)
          expect(selectedBudget.value.projection.values.some((value) => value.id.startsWith("opexEntries[id:e1]"))).toBe(true)
          expect(selectedBudget.value.projection.values.some((value) => value.id.startsWith("opexEntries[id:e2]"))).toBe(false)
        }
      }
    }
    const headcount = await createDashboardSourceIssuer({ host, scopedSources: persistence })({ page: "Headcount Overview", fields: ["members"], period }, context)
    expect(headcount.status).toBe("ok")
    if (headcount.status === "ok") {
      const selectedHeadcount = await select({ selectionRef: headcount.value.selectionRef, topic: "headcount", period }, context)
      expect(selectedHeadcount).toMatchObject({ status: "ok", value: { recordCount: 0, recordRefs: [] } })
    }
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = []; return { commit: true, value: undefined } })
    expect((await select(request, context)).status).not.toBe("ok")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
