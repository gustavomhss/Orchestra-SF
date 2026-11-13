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
import { digestSfEvidenceRef } from "../../../product/contracts/canonical.ts"

test("historical record reissue permits material changes and a new day but rejects replacement", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-historical-reissue-"))
  const store = await openLocalStore(directory)
  try {
    const clock = { at: "2026-11-13T00:00:00Z", principal: "a", allowed: true }
    const context = (principal: string) => ({ kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: principal, requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} }) as unknown as TrustedDomainContext
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => clock.at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]; snapshot.data.hotTopics = [{ id: "t", action: "Original", status: "open", due: "2026-11-01" }]; return { commit: true, value: undefined } })
    const host: DomainPortHost = { persistence, authenticate: async (_request, current) => clock.allowed ? resolve(clock.principal, [...current!.roleMap], (group) => group === "admins") : null, environment: async () => ({ at: clock.at, id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test"), revalidate: async () => clock.allowed }
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
      clock.allowed = false
      expect(await persistence.transactionAll!(async () => ({ commit: false, value: await proof.value.fence() }))).toBe(false)
      expect((await observer.prepareHistoricalReissue(original.value, context("b"))).status).not.toBe("ok")
      clock.allowed = true
      await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.hotTopics as { action: string }[])[0]!.action = "Changed after observation"; return { commit: true, value: undefined } })
      expect(await persistence.transactionAll!(async () => ({ commit: false, value: await proof.value.fence() }))).toBe(false)
    }
    expect((await observer.prepareHistoricalReissue({ ...original.value, refDigest: "forged" }, context("b"))).status).not.toBe("ok")
    const foreign = { ...original.value, projectId: "another-project" }
    expect((await observer.prepareHistoricalReissue({ ...foreign, refDigest: digestSfEvidenceRef(foreign) }, context("b"))).status).not.toBe("ok")
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.hotTopics = []; return { commit: true, value: undefined } })
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.hotTopics = [{ id: "t", action: "Replacement" }]; return { commit: true, value: undefined } })
    expect((await observer.prepareHistoricalReissue(original.value, context("b"))).status).not.toBe("ok")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})

test("historical dated entries keep the original competence after the observation year changes", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-historical-period-"))
  const store = await openLocalStore(directory)
  try {
    const clock = { at: "2026-11-13T00:00:00Z" }
    const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "a", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => clock.at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]
      snapshot.data.opexOwners = [{ id: "owner", name: "Owner", budget: 1200 }]
      snapshot.data.opexEntries = [{ id: "january", ownerId: "owner", year: 2026, month: 1, budget: 100, actual: 80, forecast: 90 }]
      return { commit: true, value: undefined }
    })
    const host: DomainPortHost = { persistence, authenticate: async (_request, current) => resolve("a", [...current!.roleMap], (group) => group === "admins"), environment: async () => ({ at: clock.at, id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test"), revalidate: async () => true }
    const records = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
    const original = await records.issue({ page: "OPEX Detail", recordType: "opexEntries", recordId: "january", fields: ["actual"], period: { start: "2026-01-01", end: "2026-01-31" } }, context)
    expect(original.status).toBe("ok")
    if (original.status !== "ok") return
    clock.at = "2027-01-13T00:00:00Z"
    const observer = createDashboardConfirmationObserver({ host, scopedSources: persistence, readProjection: async () => ({ status: "unavailable", reason: "not-used" }) })
    const proof = await observer.prepareHistoricalReissue(original.value, context)
    expect(proof.status).toBe("ok")
    if (proof.status === "ok") expect(await persistence.transactionAll!(async () => ({ commit: false, value: await proof.value.fence() }))).toBe(true)
    expect(original.value.target.period).toEqual({ start: "2026-01-01", end: "2026-01-31" })
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})

test("historical security captures revalidate current observation fields after the year changes", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-historical-security-"))
  const store = await openLocalStore(directory)
  try {
    const clock = { at: "2026-11-13T00:00:00Z" }
    const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "a", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => clock.at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]
      snapshot.data.secActions = [{ id: "action", text: "Review access", done: false }]
      snapshot.data.secIncidents = [{ id: "incident", title: "Current investigation", date: "2026-09-03", contained: false }]
      snapshot.data.secPhishing = [{ id: "campaign", name: "Current campaign", start: "2026-10-01", targeted: 100 }]
      return { commit: true, value: undefined }
    })
    const host: DomainPortHost = { persistence, authenticate: async (_request, current) => resolve("a", [...current!.roleMap], (group) => group === "admins"), environment: async () => ({ at: clock.at, id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test"), revalidate: async () => true }
    const records = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
    const observer = createDashboardConfirmationObserver({ host, scopedSources: persistence, readProjection: async () => ({ status: "unavailable", reason: "not-used" }) })
    const selections = [{ recordType: "secActions", recordId: "action", fields: ["text"] }, { recordType: "secIncidents", recordId: "incident", fields: ["contained"] }, { recordType: "secPhishing", recordId: "campaign", fields: ["targeted"] }]
    const original = await Promise.all(selections.map((selection) => records.issue({ page: "IT Security KPIs", ...selection, period: { start: "2026-01-01", end: "2026-12-31" } }, context)))
    expect(original.every((source) => source.status === "ok")).toBe(true)
    clock.at = "2027-01-13T00:00:00Z"
    for (const source of original) {
      if (source.status !== "ok") throw new Error("Expected current security source")
      const proof = await observer.prepareHistoricalReissue(source.value, context)
      expect(proof.status).toBe("ok")
      if (proof.status === "ok") expect(await persistence.transactionAll!(async () => ({ commit: false, value: await proof.value.fence() }))).toBe(true)
    }
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})

