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
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

test("executive signals open authorized canonical records and fail closed without evidence", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-signal-evidence-"))
  const store = await openLocalStore(directory)
  try {
    const at = "2026-11-13T00:00:00Z"
    const period = { start: "2026-01-01", end: "2026-12-31" }
    const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "admin", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]; snapshot.data.hotTopics = [{ id: "t", action: "Review", status: "open", due: "2026-11-01" }]; snapshot.data.risks = [{ id: "r", title: "Risk", status: "open", impact: 4, probability: 4 }]; snapshot.data.contracts = [{ id: "c", vendor: "Vendor", renewal: "2026-12-01" }]; return { commit: true, value: undefined } })
    const host: DomainPortHost = { persistence, authenticate: async (_request, context) => resolve("admin", [...context!.roleMap], (group) => group === "admins"), environment: async () => ({ at, id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test"), revalidate: async () => true }
    const sources = createDashboardSourceHost({ host, scopedSources: persistence })
    const selection = await createDashboardSourceIssuer({ host, scopedSources: persistence })({ page: "Executive Dashboard", fields: ["signals"], period }, binding)
    expect(selection.status).toBe("ok")
    if (selection.status !== "ok") return
    const request = { selectionRef: selection.value.selectionRef, fields: ["signals"], period }
    expect(await createDashboardPort({ host, sources }).read(request, binding)).toMatchObject({ status: "unavailable", reason: "signal-evidence-unavailable" })
    const recordEvidence = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
    const result = await createDashboardPort({ host, sources, recordEvidence }).read(request, binding)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    for (const [id, type] of [["hotTopics:t", "hotTopics"], ["risks:r", "risks"], ["contracts:c", "contracts"]]) {
      const value = result.value.values.find((entry) => entry.id === `signals[id:${encodeURIComponent(id!)}].rule`)
      if (!value?.drilldown) throw new Error(`Signal ${id} has no canonical record evidence`)
      expect(value.drilldown).toMatchObject({ kind: "record", target: { recordType: type } })
      expect(value.sourceRefs).toEqual([value.drilldown])
    }
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = []; return { commit: true, value: undefined } })
    expect((await createDashboardPort({ host, sources, recordEvidence }).read(request, binding)).status).not.toBe("ok")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
