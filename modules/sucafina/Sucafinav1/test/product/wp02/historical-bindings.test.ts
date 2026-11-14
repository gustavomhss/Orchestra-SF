import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardConfirmationObserver } from "../../../product/dashboard/confirmation.ts"
import { createDashboardHistoricalBindings } from "../../../product/dashboard/historical-bindings.ts"
import type { DashboardHistoricalCapture } from "../../../product/dashboard/historical-bindings.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"

test("historical binding preserves the captured fact after material edits and rechecks current access and physical identity", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-history-binding-"))
  const store = await openLocalStore(directory)
  try {
    const clock = { at: "2026-11-13T00:00:00Z", principal: "author", allowed: true }
    const context = (principal: string) => ({ kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: principal, requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} }) as unknown as TrustedDomainContext
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => clock.at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]
      snapshot.data.hotTopics = [{ id: "topic", action: "Captured original", owner: "owner", due: "2026-12-01", status: "open", priority: "normal", notes: "" }]
      return { commit: true, value: undefined }
    })
    const host: DomainPortHost = { persistence, authenticate: async (_request, current) => clock.allowed ? resolve(clock.principal, [...current!.roleMap], (group) => group === "admins") : null,
      environment: async () => ({ at: clock.at, id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test"), revalidate: async (binding) => clock.allowed && binding.binding.principalRef === clock.principal }
    const records = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
    const observer = createDashboardConfirmationObserver({ host, scopedSources: persistence, readProjection: (selection, binding) => records.read(selection.reference, binding) })
    const race: { mode?: "remove" | "replace"; lastReadLocked: boolean } = { lastReadLocked: false }
    const bindings = createDashboardHistoricalBindings({ host, observer, records, readProtectedCapture: async (captureId, binding) => {
      if (!await host.revalidate(binding)) return { status: "denied", reason: "capture-access-unavailable" }
      race.lastReadLocked = !!persistence.currentSnapshots?.()?.dashboard
      const found = await persistence.transaction("dashboard", async (snapshot) => {
        const state = snapshot.data.__sfProductV1 as { preferences?: Record<string, DashboardHistoricalCapture> } | undefined
        const receipt = state?.preferences?.[captureId]
        return { commit: false, value: receipt ? { status: "ok" as const, value: structuredClone(receipt) } : { status: "unavailable" as const, reason: "capture-unavailable" } }
      })
      if (race.mode && found.status === "ok") {
        const mode = race.mode
        delete race.mode
        await persistence.transaction("dashboard", async (snapshot) => {
          const state = snapshot.data.__sfProductV1 as { preferences: Record<string, DashboardHistoricalCapture> }
          if (mode === "remove") delete state.preferences[captureId]
          if (mode === "replace") {
            const replaced = { ...found.value, capturedAt: "2026-11-13T00:01:00.000Z" }
            state.preferences[captureId] = { ...replaced, receiptDigest: digestSfValue(Object.fromEntries(Object.entries(replaced).filter(([name]) => name !== "receiptDigest"))) }
          }
          return { commit: true, value: undefined }
        })
      }
      return found
    } })
    const source = await records.issue({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: "topic", fields: ["action"], period: { start: "2026-11-13", end: "2026-11-13" } }, context("author"))
    expect(source.status).toBe("ok")
    if (source.status !== "ok") return
    const prepared = await bindings.prepare({ captureId: "review-capture", source: source.value }, context("author"))
    expect(prepared.status).toBe("ok")
    if (prepared.status !== "ok") return
    expect(await prepared.value.fence()).toBe(false)
    // Exercise the required host-side atomic capture: a rejected fence cannot persist a receipt.
    const committed = await persistence.transactionAll!(async (snapshots) => {
      if (!await prepared.value.fence()) return { commit: false, value: false }
      snapshots.dashboard.data.__sfProductV1 = { preferences: { "review-capture": structuredClone(prepared.value.receipt) } }
      return { commit: true, value: true }
    })
    expect(committed).toBe(true)
    await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.hotTopics as { action: string }[])[0]!.action = "Current changed fact"; return { commit: true, value: undefined } })
    clock.at = "2026-11-14T00:00:00Z"
    clock.principal = "reviewer"
    const historical = await bindings.reopen("review-capture", context("reviewer"))
    expect(historical.status).toBe("ok")
    expect(race.lastReadLocked).toBe(true)
    if (historical.status === "ok") {
      expect(historical.value).toMatchObject({ state: "historical", capturedBy: "author", capturedAt: "2026-11-13T00:00:00.000Z" })
      expect(historical.value.projection.values).toMatchObject([{ value: "Captured original", period: { start: "2026-11-13", end: "2026-11-13" } }])
    }
    for (const mode of ["replace", "remove"] as const) {
      race.mode = mode
      const changed = await bindings.reopen("review-capture", context("reviewer"))
      expect(changed.status).not.toBe("ok")
      expect(JSON.stringify(changed)).not.toContain("Captured original")
      expect(race.lastReadLocked).toBe(true)
      await persistence.transaction("dashboard", async (snapshot) => {
        (snapshot.data.__sfProductV1 as { preferences: Record<string, DashboardHistoricalCapture> }).preferences["review-capture"] = structuredClone(prepared.value.receipt)
        return { commit: true, value: undefined }
      })
    }
    clock.allowed = false
    expect((await bindings.reopen("review-capture", context("reviewer"))).status).toBe("denied")
    clock.allowed = true
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.hotTopics = []; return { commit: true, value: undefined } })
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.hotTopics = [{ id: "topic", action: "Replacement" }]; return { commit: true, value: undefined } })
    const replaced = await bindings.reopen("review-capture", context("reviewer"))
    expect(replaced.status).not.toBe("ok")
    expect(JSON.stringify(replaced)).not.toContain("Captured original")
    expect((await bindings.reopen("missing", context("reviewer"))).status).toBe("unavailable")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})

test("a caller cannot alter a prepared historical capture and keep its authorization fence", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-history-tamper-"))
  const store = await openLocalStore(directory)
  try {
    const at = "2026-11-13T00:00:00Z"
    const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "author", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]; snapshot.data.hotTopics = [{ id: "topic", action: "Original" }]; return { commit: true, value: undefined } })
    const host: DomainPortHost = { persistence, authenticate: async (_request, current) => resolve("author", [...current!.roleMap], (group) => group === "admins"), environment: async () => ({ at, id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test"), revalidate: async () => true }
    const records = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
    const observer = createDashboardConfirmationObserver({ host, scopedSources: persistence, readProjection: (selection, binding) => records.read(selection.reference, binding) })
    const bindings = createDashboardHistoricalBindings({ host, observer, records, readProtectedCapture: async () => ({ status: "unavailable", reason: "no-capture-stored" }) })
    const source = await records.issue({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: "topic", fields: ["action"], period: { start: "2026-11-13", end: "2026-11-13" } }, context)
    expect(source.status).toBe("ok")
    if (source.status !== "ok") return
    const prepared = await bindings.prepare({ captureId: "capture", source: source.value }, context)
    expect(prepared.status).toBe("ok")
    if (prepared.status !== "ok") return
    prepared.value.receipt.projection = { ...prepared.value.receipt.projection, values: [] }
    expect(await persistence.transactionAll!(async () => ({ commit: false, value: await prepared.value.fence() }))).toBe(false)
    expect((await bindings.reopen("capture", context)).status).toBe("unavailable")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
