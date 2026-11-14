import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import type { Actor } from "../../../runtime/contract.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector, projectSfSourceScope } from "../../../product/integration/source-projections.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { simulateDashboardCommand, applyDashboardPreview } from "../../../product/dashboard/commands.ts"
import { dashboardMutationImpact, prepareDashboardMutationScope } from "../../../product/dashboard/mutation-scope.ts"
import type { DashboardMutationScope } from "../../../product/dashboard/mutation-scope.ts"
import { createDashboardPreparedMutation } from "../../../product/dashboard/prepared.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const at = "2026-11-13T00:00:00Z"
const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "admin", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext

test("existing YTD owner record is fenced and updated without binding another owner", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-keyed-update-"))
  const store = await openLocalStore(directory)
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]
      snapshot.data.opexOwners = [{ id: "o", name: "Owner", budget: 1200 }, { id: "other", name: "Other", budget: 600 }]
      snapshot.data.opexEntries = []
      snapshot.data.budgetYtd = { opex: { "2026:o": { amount: 100, months: 2, perMonth: 50, at }, "2026:other": { amount: 200, months: 2, perMonth: 100, at } } }
      return { commit: true, value: undefined }
    })
    const request = new Request("https://example.test", { headers: { authorization: "admin" } })
    const host: DomainPortHost = { persistence, authenticate: async (incoming, context) => incoming.headers.get("authorization") === "admin" ? resolve("admin", [...context!.roleMap], (group) => group === "admins") : null, environment: async () => ({ at, id: randomUUID, directory: [] }), requestFor: () => request, revalidate: async () => persistence.transaction("dashboard", async () => ({ commit: false, value: true })) }
    const issue = createDashboardRecordSourceIssuer({ host, scopedSources: persistence })
    const selection = { page: "OPEX Detail", recordType: "budgetYtd", recordId: JSON.stringify(["opex", "2026:o"]), fields: ["amount", "months", "perMonth", "at"], period }
    const first = await issue(selection, binding)
    expect(first).toBeDefined()
    if (!first) return
    await persistence.transaction("dashboard", async (snapshot) => { const group = snapshot.data.budgetYtd as { opex: Record<string, { amount: number }> }; group.opex["2026:other"]!.amount = 201; return { commit: true, value: undefined } })
    const afterOther = await issue(selection, binding)
    expect(afterOther?.source.incarnation).toBe(first.source.incarnation)
    expect(afterOther?.source.version).toBe(first.source.version)
    expect(await issue({ ...selection, fields: ["secret"] }, binding)).toBeUndefined()
    expect(await issue({ ...selection, period: { start: "2026-01-01", end: "2026-01-31" } }, binding)).toBeUndefined()
    const state = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const actor: Actor = { id: "admin", roles: ["admin"], canWrite: true, assigned: [], domains: [] }
    const command = { page: "OPEX Detail", action: "year-amount", id: "o", version: 0, values: { year: 2026, amount: 2400 } }
    const reservedIds: string[] = []
    const preview = simulateDashboardCommand(state, actor, command, { at, id: () => { const id = `entry-${reservedIds.length + 1}`; reservedIds.push(id); return id }, directory: [] })
    expect(preview.status).toBe("preview")
    if (preview.status !== "preview") return
    const environment = () => { let index = 0; return { at, id: () => reservedIds[index++] ?? "", directory: [] } }
    const staged = structuredClone(state)
    expect(applyDashboardPreview(staged, actor, command, environment(), preview.baseDigest, preview.commandDigest).ok).toBe(true)
    const impact = dashboardMutationImpact(state, staged, command, period)!
    expect(impact).toContainEqual(expect.objectContaining({ type: "budgetYtd", id: selection.recordId, operation: "update" }))
    expect(impact.some((change) => change.id === JSON.stringify(["opex", "2026:other"]))).toBe(false)
    const targets: DashboardMutationScope["targets"][number][] = []
    for (const change of impact.filter((change) => change.operation !== "create")) {
      const granted = await issue({ page: "OPEX Detail", recordType: change.type, recordId: change.id, fields: change.fields, period: change.period }, binding)
      expect(granted).toBeDefined()
      if (granted) targets.push(granted)
    }
    const owner = await issue({ page: "OPEX Detail", recordType: "opexOwners", recordId: "o", fields: ["budget"], period }, binding)
    expect(owner).toBeDefined()
    if (!owner) return
    targets.push(owner)
    const creates = impact.filter((change) => change.operation === "create").map((change) => ({ type: change.type, id: change.id, fields: change.fields, period: change.period }))
    const proof = prepareDashboardMutationScope({ snapshot: state, actor, environment: environment(), command, baseDigest: preview.baseDigest, previewDigest: preview.commandDigest, period, targets, creates, reservedIds })
    expect(proof).toBeDefined()
    if (!proof) return
    const mutation = createDashboardPreparedMutation({ actorId: actor.id, target: owner.source, command, baseDigest: preview.baseDigest, previewDigest: preview.commandDigest, idempotencyKey: "ytd-update", mutationScope: proof, projectScope: (snapshot, _actor, scope) => projectSfSourceScope("dashboard", snapshot, scope, at) })
    expect(mutation).toBeDefined()
    if (!mutation) return
    expect(await persistence.transaction("dashboard", async (snapshot) => mutation.execute(snapshot, actor, environment()))).toMatchObject({ status: "applied" })
    const data = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.budgetYtd }))
    expect(data).toMatchObject({ opex: { "2026:o": { amount: 2400 }, "2026:other": { amount: 201 } } })
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.budgetYtd = { opex: { malformed: { amount: 1 } } }; return { commit: true, value: undefined } })
    expect(await issue(selection, binding)).toBeUndefined()
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.projects = [{ id: "independent" }]; return { commit: true, value: undefined } })
    expect(await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.projects }))).toEqual([{ id: "independent" }])
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
