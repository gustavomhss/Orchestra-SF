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
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { createSfDashboardRecordSourceAccess } from "../../../product/decision-memory/source-access.ts"
import { digestSfEvidenceRef } from "../../../product/contracts/canonical.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiLease } from "../../../product/contracts/sf-execution.ts"

const at = "2026-11-13T00:00:00Z"
const period = { start: "2026-11-13", end: "2026-11-13" }
const call: TrustedDomainContext = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "admin", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as TrustedUiLease }

test("Dashboard record memory egress reauthorizes its exact current scoped reference", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-record-memory-"))
  const store = await openLocalStore(directory, { lockTimeoutMs: 500 })
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]; snapshot.data.hotTopics = [{ id: "topic-1", status: "open", action: "confidential action" }]; return { commit: true, value: undefined } })
    const session = { active: true }
    const host: DomainPortHost = { persistence, authenticate: async (request, context) => request.headers.get("authorization") === "admin" ? resolve("admin", [...context!.roleMap], (group) => session.active && group === "admins") : null, environment: async () => ({ at, id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test", { headers: { authorization: "admin" } }), revalidate: async () => session.active && await store.transaction("dashboard", async () => ({ commit: false, value: true })) }
    const records = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
    const issued = await records.issue({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: "topic-1", fields: ["status"], period }, call)
    expect(issued.status).toBe("ok")
    if (issued.status !== "ok") return
    const access = createSfDashboardRecordSourceAccess({ host, records })
    const fresh = await access(issued.value, call)
    expect(fresh.state).toBe("fresh")
    expect(fresh.currentRef).toEqual(issued.value)
    expect(JSON.stringify(fresh.authorizedProjection)).toContain("open")
    expect(JSON.stringify(fresh)).not.toContain("confidential action")
    const forged = { ...issued.value, target: { ...issued.value.target, fields: ["action"] }, refDigest: "" }
    expect((await access({ ...forged, refDigest: digestSfEvidenceRef(forged) }, call)).state).toBe("unavailable")
    const other: TrustedDomainContext = { ...call, binding: { ...call.binding, principalRef: "other" } }
    expect((await access(issued.value, other)).state).toBe("unavailable")
    await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.hotTopics as { status: string }[])[0]!.status = "done"; return { commit: true, value: undefined } })
    expect((await access(issued.value, call)).state).toBe("unavailable")
    session.active = false
    expect((await access(issued.value, call)).state).toBe("unavailable")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
