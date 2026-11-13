import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence, sfSourceIdentity } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { digestSfEvidenceRef } from "../../../product/contracts/canonical.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const at = "2026-11-13T00:00:00Z"
const period = { start: "2026-11-13", end: "2026-11-13" }
const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "admin", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext

test("record evidence uses authorized scoped identity and revalidates each reference", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-record-evidence-"))
  const store = await openLocalStore(directory)
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]; snapshot.data.hotTopics = [{ id: "topic-1", status: "open", action: "confidential action" }]; return { commit: true, value: undefined } })
    const current = { request: new Request("https://example.test", { headers: { authorization: "admin" } }) }
    const host: DomainPortHost = { persistence, authenticate: async (request, context) => request.headers.get("authorization") === "admin" ? resolve("admin", [...context!.roleMap], (group) => group === "admins") : null, environment: async () => ({ at, id: randomUUID, directory: [] }), requestFor: () => current.request, revalidate: async () => persistence.transaction("dashboard", async () => ({ commit: false, value: true })) }
    const evidenceHost = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
    const selection = { page: "Hot Topics & Actions", recordType: "hotTopics", recordId: "topic-1", fields: ["status"], period }
    const issued = await evidenceHost.issue(selection, binding)
    expect(issued.status).toBe("ok")
    if (issued.status !== "ok") return
    const physical = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "hotTopics", "topic-1") }))
    expect(issued.value.target.incarnation).not.toBe(physical?.incarnation)
    expect(issued.value.refDigest).toBe(digestSfEvidenceRef(issued.value))
    expect(issued.value.target).toMatchObject({ recordType: "hotTopics", recordId: "topic-1", fields: ["status"], period })
    expect(JSON.stringify(issued)).not.toContain("confidential action")
    const read = await evidenceHost.read(issued.value.refId, binding)
    expect(read.status).toBe("ok")
    if (read.status === "ok") {
      expect(read.value.values).toContainEqual(expect.objectContaining({ id: "hotTopics:topic-1:status", value: "open", period, sourceRefs: [issued.value] }))
      expect(read.value.context.sourceRefs[0]).toMatchObject({ type: "hotTopics", id: "topic-1", fields: ["status"] })
      expect(JSON.stringify(read)).not.toContain("confidential action")
      expect(JSON.stringify(read)).not.toContain("privateDependencyDigest")
    }
    await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.hotTopics as { action: string }[])[0]!.action = "another private action"; return { commit: true, value: undefined } })
    expect(await evidenceHost.resolve(issued.value.refId, binding)).toEqual(issued)
    await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.hotTopics as { status: string }[])[0]!.status = "done"; return { commit: true, value: undefined } })
    expect(await evidenceHost.resolve(issued.value.refId, binding)).toMatchObject({ status: "stale" })
    expect(await evidenceHost.read(issued.value.refId, binding)).toMatchObject({ status: "stale" })
    const updated = await evidenceHost.issue(selection, binding)
    expect(updated.status).toBe("ok")
    if (updated.status !== "ok") return
    expect(updated.value.target.version).toBe(issued.value.target.version + 1)
    const today = { start: "2026-11-13", end: "2026-11-13" }
    const daily = await evidenceHost.issue({ ...selection, period: today }, binding)
    expect(daily.status).toBe("ok")
    if (daily.status === "ok") expect(daily.value.target.period).toEqual(today)
    expect(await evidenceHost.issue({ ...selection, period: { start: "2026-11-12", end: "2026-11-12" } }, binding)).toMatchObject({ status: "denied" })
    expect(await evidenceHost.issue({ ...selection, period: { start: "2026-01-01", end: "2026-12-31" } }, binding)).toMatchObject({ status: "denied" })
    current.request = new Request("https://example.test", { headers: { authorization: "other" } })
    expect(await evidenceHost.resolve(updated.value.refId, binding)).toMatchObject({ status: "denied" })
    expect(await evidenceHost.read(updated.value.refId, binding)).toMatchObject({ status: "denied" })
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
