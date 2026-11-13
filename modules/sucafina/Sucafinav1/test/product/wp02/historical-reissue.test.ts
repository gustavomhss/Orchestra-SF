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
import { createDashboardConfirmationObserver } from "../../../product/dashboard/confirmation.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

test("historical record reissue permits material changes and a new day but rejects replacement", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-historical-reissue-"))
  const store = await openLocalStore(directory)
  try {
    const clock = { at: "2026-11-13T00:00:00Z", principal: "a" }
    const context = (principal: string) => ({ kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: principal, requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} }) as unknown as TrustedDomainContext
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => clock.at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]; snapshot.data.hotTopics = [{ id: "t", action: "Original", status: "open", due: "2026-11-01" }]; return { commit: true, value: undefined } })
    const host: DomainPortHost = { persistence, authenticate: async (_request, current) => resolve(clock.principal, [...current!.roleMap], (group) => group === "admins"), environment: async () => ({ at: clock.at, id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test"), revalidate: async () => true }
    const records = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
    const original = await records.issue({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: "t", fields: ["action"], period: { start: "2026-11-13", end: "2026-11-13" } }, context("a"))
    expect(original.status).toBe("ok")
    if (original.status !== "ok") return
    await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.hotTopics as { action: string }[])[0]!.action = "Changed"; return { commit: true, value: undefined } })
    clock.at = "2026-11-14T00:00:00Z"
    clock.principal = "b"
    const observer = createDashboardConfirmationObserver({ host, scopedSources: persistence, readProjection: async () => ({ status: "unavailable", reason: "not-used" }) })
    const proof = await observer.prepareHistoricalReissue(original.value, context("b"))
    expect(proof.status).toBe("ok")
    if (proof.status === "ok") {
      expect(await proof.value.fence()).toBe(false)
      expect(await persistence.transactionAll!(async () => ({ commit: false, value: await proof.value.fence() }))).toBe(true)
    }
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.hotTopics = []; return { commit: true, value: undefined } })
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.hotTopics = [{ id: "t", action: "Replacement" }]; return { commit: true, value: undefined } })
    expect((await observer.prepareHistoricalReissue(original.value, context("b"))).status).not.toBe("ok")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
