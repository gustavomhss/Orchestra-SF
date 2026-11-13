import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardSourceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import { createDashboardConfirmationObserver } from "../../../product/dashboard/confirmation.ts"
import { createConfirmationPort } from "../../../product/collaboration/confirmation.ts"
import { createConfirmationObservationReceipts } from "../../../product/collaboration/confirmation-observations.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"

test("dashboard observation supports a human confirmation and another authorized reader", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-confirmation-consumer-"))
  const store = await openLocalStore(directory)
  const at = "2026-11-13T00:00:00Z"
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }, { surface: "dashboard", role: "viewer", entra: "viewers", version: 1, by: "admin" }]
      snapshot.data.summaries = ["Budget Overview"]
      snapshot.data.opexOwners = [{ id: "o", budget: 1200 }]
      snapshot.data.opexEntries = [{ id: "jan", ownerId: "o", year: 2026, month: 1, budget: 200, actual: 0, forecast: 0 }, { id: "feb", ownerId: "o", year: 2026, month: 2, actual: 10 }]
      return { commit: true, value: undefined }
    })
    const ui = createSfUiAuthority({ authorize: async (request) => {
      const principalRef = request.headers.get("actor")
      return principalRef === "admin" || principalRef === "reader" ? { installationId: "i", projectId: "p", principalRef, accessRevision: "access", policyVersion: "policy" } : undefined
    }, commandIdentity: async () => "command", createId: randomUUID, now: () => Date.parse(at), privateCommands: ["sf-human:collaboration.confirmation.confirm"] })
    const human = createSfHumanAuthority({ origin: "https://example.test", ui })
    const host: DomainPortHost = { persistence, authenticate: async (request, options) => resolve(request.headers.get("actor")!, [...options!.roleMap], (group) => request.headers.get("actor") === "admin" ? group === "admins" : group === "viewers"), environment: async () => ({ at, id: randomUUID, directory: [] }), requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: async (context) => context.kind === "ui" && await ui.revalidate(context) }
    const admitRead = async (actor: string) => {
      const result = await ui.admit(new Request("https://example.test/read", { headers: { actor } }), "sf_work_list", digestSfValue({}))
      if (result.status !== "ok" || !await ui.validate(result.value, "sf_work_list", digestSfValue({}))) throw new Error("read admission failed")
      return result.value
    }
    const admin = await admitRead("admin")
    const reader = await admitRead("reader")
    const period = { start: "2026-01-01", end: "2026-01-31" }
    const page = await createDashboardSourceIssuer({ host, scopedSources: persistence })({ page: "Budget Overview", fields: ["budgetSeries"], period }, admin)
    if (page.status !== "ok") throw new Error("page issue failed")
    const scope = { sourceRef: { surface: "dashboard" as const, type: page.value.evidence.target.recordType, id: page.value.evidence.target.recordId, incarnation: page.value.evidence.target.incarnation }, fields: ["budgetSeries"], period, materialDependencies: [], scopeDefinitionVersion: "dashboard-c06-v1" }
    const dashboard = createDashboardPort({ host, sources: createDashboardSourceHost({ host, scopedSources: persistence }) })
    const observer = createDashboardConfirmationObserver({ host, scopedSources: persistence, readProjection: (selection, context) => dashboard.read({ selectionRef: selection.reference, fields: selection.fields, period: selection.period }, context) })
    const receipts = createConfirmationObservationReceipts({ host, observe: observer.observe, now: () => Date.parse(at) })
    const prepared = await receipts.prepare(scope, admin)
    if (prepared.status !== "ok") throw new Error("observation failed")
    const command = { scope, observedSourceVersion: prepared.value.sourceVersion, expectedScopeFingerprint: prepared.value.scopeFingerprint, expectedStorageVersion: 0, idempotencyKey: "confirm" }
    const admitted = await human.admit(new Request("https://example.test/confirm", { method: "POST", headers: { origin: "https://example.test", actor: "admin" } }), "collaboration.confirmation.confirm", command)
    if (admitted.status !== "ok") throw new Error("confirmation admission failed")
    const state = createSfProductState({ persistence, createId: randomUUID, resolveTarget: async () => ({ incarnation: "workspace-inc" }), authorize: async (request) => ({ principalRef: request.headers.get("actor")!, accessRevision: "access", policyVersion: "policy" }) })
    const port = createConfirmationPort({ host, state, human, creationTarget: { ref: "workspace", incarnation: "workspace-inc" }, observe: observer.observe, fence: async (selected, observation, context) => await observer.fenceManifest(selected, context) && await observer.fence(selected, observation, context), verifyObserved: receipts.verifyObserved, createId: randomUUID, now: () => at })
    const confirmed = await port.confirm(command, admitted.value)
    if (confirmed.status !== "ok") throw new Error(`confirmation failed: ${confirmed.reason}`)
    expect(confirmed.value).not.toHaveProperty("physicalIncarnation")
    const shared = await port.inspect(confirmed.value.id, reader)
    expect(shared).toMatchObject({ status: "ok", value: { authorId: "admin", observedSourceVersion: command.observedSourceVersion, period, validity: { state: "valid" } } })
    if (shared.status === "ok") expect(shared.value).not.toHaveProperty("sourceRef")
    await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.opexEntries as { actual: number }[])[1]!.actual = 99; return { commit: true, value: undefined } })
    expect(await port.project(confirmed.value.id, reader)).toMatchObject({ status: "ok", value: { state: "valid" } })
    await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.opexEntries as { actual: number }[])[0]!.actual = 1; return { commit: true, value: undefined } })
    expect(await port.project(confirmed.value.id, reader)).toMatchObject({ status: "ok", value: { state: "stale", reason: "material-change" } })
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
