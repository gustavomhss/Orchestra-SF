import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { DashboardBudget } from "../../../runtime/dashboard-budget.ts"
import { DashboardPeople } from "../../../runtime/dashboard-people.ts"
import { ProcurementModule } from "../../../runtime/procurement.ts"
import { PlannerModule } from "../../../runtime/planner.ts"
import { object, text } from "../../../runtime/contract.ts"
import type { Command, Domain, Result, Snapshot } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"
import type { Surface } from "../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { createProcurementSourceResolver } from "../../../product/procurement/sources.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { collaborationHumanActions, createCollaborationHumanAuthority } from "../../../product/collaboration/human.ts"
import type { CollaborationHumanAction } from "../../../product/collaboration/human.ts"
import { createCollaborationAuthority } from "../../../product/collaboration/authority.ts"
import { createCollaborationMutationFence } from "../../../product/collaboration/mutation-fence.ts"
import { createRelationPort } from "../../../product/collaboration/relations.ts"
import { createThreadPort } from "../../../product/collaboration/threads.ts"

export function available<T>(result: PortResult<T>): T {
  if (result.status !== "ok") throw new Error(`${result.status}: ${result.reason}`)
  return result.value
}

function applied(result: Result) {
  if (!result.ok) throw new Error(`Canonical fixture rejected: ${result.status} ${result.errors?.join(", ") ?? ""}`)
  return result
}

function businessSnapshot(snapshot: Snapshot) {
  return { ...snapshot, data: Object.fromEntries(Object.entries(snapshot.data).filter(([key]) => key !== "__sfProductV1")) }
}

/** Real SQLite, source producers and human admission; authentication is an explicit test fixture. */
export async function createRelationsFixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-relations-sources-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const transactionAll = store.transactionAll
  if (!transactionAll) throw new Error("SQLite fixture requires transactionAll")
  const at = "2026-11-13T00:00:00Z"
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const gate = { active: true, dashboard: true, procurement: true, planner: true }
  const person = { id: "person", name: "Person" }
  const environment = (id = randomUUID()) => ({ at, id: () => id, directory: [person] })
  const actor = { id: person.id, roles: ["admin", "buyer"], canWrite: true }
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
  for (const surface of ["dashboard", "planner", "procurement"] as const) {
    await persistence.initializeSources(surface)
    await persistence.transaction(surface, async (snapshot) => {
      snapshot.data.roleMap = [{ surface, role: "admin", entra: "admins", version: 1, by: person.id }, ...(surface === "procurement" ? [{ surface, role: "buyer", entra: "buyers", version: 1, by: person.id }] : [])]
      snapshot.data.access = { person: { assigned: [], domains: [] } }
      return { commit: true, value: undefined }
    })
  }
  const mutate = async (surface: Surface, domain: Domain, command: Command, id?: string) => persistence.transaction(surface, async (snapshot) => ({ commit: true, value: applied(domain.execute(snapshot, actor, command, environment(id))) }))
  await mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", version: 0, values: { name: "Shared project", budget: 100, spent: 20, status: "In Progress", risk: "Low", notes: "Initial notes" } }, "project")
  await mutate("dashboard", DashboardBudget.domain, { page: "CAPEX Projects", action: "save", version: 0, values: { name: "Shared project", budget: 250 } }, "capex")
  await mutate("dashboard", DashboardPortfolio.domain, { page: "Vendor Contracts", action: "save", version: 0, values: { vendor: "Same Vendor", name: "Selected contract", amount: 50, currency: "USD" } }, "contract")
  await mutate("dashboard", DashboardPeople.domain, { page: "Hot Topics & Actions", action: "save", version: 0, values: { action: "Independent operational action", owner: person.name, due: "2026-12-01", priority: "normal", notes: "" } }, "topic")
  await mutate("procurement", ProcurementModule.domain, { page: "Settings", action: "reset", version: 0, values: {} })
  await mutate("procurement", ProcurementModule.domain, { page: "Requests", action: "create", version: 0, values: { title: "Independent purchase", estAmount: 75, expenseType: "opex" } })
  await mutate("procurement", ProcurementModule.domain, { page: "Suppliers", action: "create", version: 0, values: { legalName: "Same Vendor", taxId: "A", categories: ["IT"] } }, "supplier-A")
  const secondSupplier = await mutate("procurement", ProcurementModule.domain, { page: "Suppliers", action: "create", version: 0, values: { legalName: "Same Vendor", taxId: "B", categories: ["IT"] } }, "supplier-B")
  await mutate("planner", PlannerModule.domain, { page: "Versions", action: "save", version: 0, values: {} }, "planner-version")
  const request = () => new Request("https://example.test/product", { method: "POST", headers: { origin: "https://example.test", actor: person.id } })
  const ui = createSfUiAuthority({ authorize: async (candidate) => gate.active && candidate.headers.get("actor") === person.id ? { installationId: "installation", projectId: "project", principalRef: person.id, accessRevision: "access", policyVersion: "policy" } : undefined, commandIdentity: async () => randomUUID(), createId: randomUUID, now: () => Date.parse(at), privateCommands: collaborationHumanActions.map((action) => `sf-human:${action}`) })
  const human = createCollaborationHumanAuthority({ origin: "https://example.test", ui })
  const host: DomainPortHost = {
    persistence,
    authenticate: async (candidate, options) => gate.active && candidate.headers.get("actor") === person.id && options && gate[options.surface] ? resolve(person.id, [...options.roleMap], (group) => ["admins", "buyers"].includes(group)) : null,
    environment: async () => ({ at, id: randomUUID, directory: [person] }),
    requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
    revalidate: async (context) => context.kind === "ui" && await ui.revalidate(context),
  }
  const payload = { recordRefs: [] }
  const read = available(await ui.admit(request(), "sf_relation_read", digestSfValue(payload)))
  if (!await ui.validate(read, "sf_relation_read", digestSfValue(payload))) throw new Error("Read admission unavailable")
  const admit = async (action: CollaborationHumanAction, value: unknown) => available(await human.admit(request(), action, value))
  const records = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
  const contextFor = async (context: TrustedDomainContext) => ({ status: "ok" as const, value: { installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, surface: "procurement" as const, period, currency: await persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: text(object(object(snapshot.data.store).settings).currency) })), sourceRefs: [], capabilities: [] } })
  const suppliers = createProcurementSourceResolver({ host, scopedSources: persistence, contextFor })
  const evidence = createSfBusinessContext({ revalidate: host.revalidate, resolveSource: async (ref, context) => {
    const result = ref.kind !== "record" ? undefined : ref.target.surface === "dashboard" ? await records.resolve(ref.refId, context) : ref.target.surface === "procurement" ? await suppliers.resolve(ref.refId, context) : undefined
    const current = result?.status === "ok" ? "evidence" in result.value ? result.value.evidence : result.value : undefined
    return { state: current && digestSfValue(current) === digestSfValue(ref) ? "fresh" : "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: at }
  }, proveContinuity: async () => false, recall: async () => [], emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" }, reason: "not-selected" }) })
  const creationTarget = { ref: "workspace", incarnation: "workspace-inc" }
  const state = createSfProductState({ persistence, createId: randomUUID, resolveTarget: async () => ({ incarnation: creationTarget.incarnation }), authorize: async (candidate) => gate.active && candidate.headers.get("actor") === person.id ? { principalRef: person.id, accessRevision: "access", policyVersion: "policy" } : undefined })
  const authority = createCollaborationAuthority({ host, evidence })
  const mutationFence = createCollaborationMutationFence(host)
  const relations = createRelationPort({ state, host, human, mutationFence, creationTarget, handoffPermit: Symbol("fixture"), authorizePair: authority.authorizePair, checkRecipientAtCommit: authority.checkRecipientAtCommit, createId: randomUUID, now: () => at })
  const threads = createThreadPort({ state, host, human, mutationFence, creationTarget, authorize: authority.authorizeThread, checkRecipientAtCommit: authority.checkRecipientAtCommit, createId: randomUUID, now: () => at })
  return { store, persistence, period, person, gate, request, read, admit, records, suppliers, state, relations, threads, mutate, secondSupplier, host, human, evidence, creationTarget, authority, mutationFence, ui,
    snapshots: () => transactionAll(async (snapshots) => ({ commit: false, value: { dashboard: businessSnapshot(snapshots.dashboard), planner: businessSnapshot(snapshots.planner), procurement: businessSnapshot(snapshots.procurement) } })),
    dispose: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}
