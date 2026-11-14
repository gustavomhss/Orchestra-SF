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
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardSourceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

test("all published dashboard pages read through scoped sources and current authority", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-pages-"))
  const store = await openLocalStore(directory)
  try {
    const at = "2026-11-13T00:00:00Z"
    const period = { start: "2026-01-01", end: "2026-12-31" }
    const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "admin", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]; snapshot.data.opexOwners = []; snapshot.data.capexProjects = []; snapshot.data.opsTickets = []; snapshot.data.secKpi = []; return { commit: true, value: undefined } })
    const access = { allowed: true }
    const host: DomainPortHost = { persistence, authenticate: async (_request, context) => access.allowed ? resolve("admin", [...context!.roleMap], (group) => group === "admins") : null, environment: async () => ({ at, id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test"), revalidate: async () => true }
    const issuer = createDashboardSourceIssuer({ host, scopedSources: persistence })
    const port = createDashboardPort({ host, sources: createDashboardSourceHost({ host, scopedSources: persistence }) })
    const pages = [["Executive Dashboard", "executive"], ["Hot Topics & Actions", "hotTopics"], ["Budget Overview", "budgetSeries"], ["OPEX Detail", "opexOwners"], ["CAPEX Projects", "capexProjects"], ["Headcount Overview", "members"], ["Team Structure", "members"], ["Talent Review", "members"], ["Portfolio Dashboard", "projects"], ["All Projects", "projects"], ["IT Operations", "opsTickets"], ["IT Security KPIs", "secKpi"], ["IT Risks", "risks"], ["Vendor Contracts", "contracts"], ["Stakeholder Management", "stakeholders"], ["IT Performance Contract", "itperf"]] as const
    for (const [page, field] of pages) {
      const source = await issuer({ page, fields: [field], period }, binding)
      expect(source.status).toBe("ok")
      if (source.status !== "ok") continue
      const read = await port.read({ selectionRef: source.value.selectionRef, fields: [field], period }, binding)
      expect(read.status).toBe("ok")
      if (read.status === "ok") expect(read.value.context.sourceRefs[0]).toMatchObject({ id: page, fields: [field], period })
    }
    expect((await issuer({ page: "Unknown", fields: ["unknown"], period }, binding)).status).not.toBe("ok")
    access.allowed = false
    expect((await issuer({ page: "Budget Overview", fields: ["budgetSeries"], period }, binding)).status).not.toBe("ok")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
