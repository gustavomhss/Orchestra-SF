import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { domain } from "../../../runtime/procurement.ts"
import { object } from "../../../runtime/contract.ts"
import type { Actor, Command, Persistence } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { projectProcurementScope } from "../../../product/procurement/source-projection.ts"
import { createProcurementSourceResolver } from "../../../product/procurement/sources.ts"
import { createProcurementScenarioProducer } from "../../../product/procurement/scenario-producer.ts"

export const scenarioPeriod = { start: "2026-01-01", end: "2026-12-31" }
export const scenarioAt = "2026-11-14T12:00:00Z"

/** Synthetic inputs, real SQLite, source lifecycle, UI admission and domain. */
export async function createScenarioFixture(input: { amount?: number | null; directory?: string; requestId?: string } = {}) {
  const directory = input.directory ?? await mkdtemp(join(await realpath(tmpdir()), "sf-procurement-scenario-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const writes: string[] = []
  const tracked: Persistence = { transaction: (surface, work, options) => store.transaction(surface, async (snapshot) => {
    const result = await work(snapshot)
    if (result.commit) writes.push(surface)
    return result
  }, options) }
  const persistence = createSfSourcePersistence({ persistence: tracked, createId: randomUUID, projectScope: projectProcurementScope, enumerate: enumerateSfSources })
  const access = { allowed: true }
  const clock = { at: scenarioAt }
  const principal = (request: Request) => {
    const id = request.headers.get("authorization")?.replace(/^Bearer /, "")
    return access.allowed && (id === "alice" || id === "bob") ? id : undefined
  }
  const ui = createSfUiAuthority({
    authorize: async (request) => {
      const id = principal(request)
      return id ? { installationId: "scenario-install", projectId: "scenario-project", principalRef: id, accessRevision: "access-1", policyVersion: "policy-1" } : undefined
    },
    commandIdentity: async () => randomUUID(), createId: randomUUID, now: Date.now,
  })
  const host: DomainPortHost = {
    persistence,
    authenticate: async (request) => {
      const id = principal(request)
      return id ? { id, canWrite: true, roles: [{ surface: "procurement", role: "requester" }] } : null
    },
    requestFor: (binding) => binding.kind === "ui" ? ui.requestFor(binding) : undefined,
    revalidate: (binding) => binding.kind === "ui" ? ui.revalidate(binding) : Promise.resolve(false),
    environment: async () => ({ at: clock.at, id: randomUUID, directory: [{ id: "alice", name: "Alice" }, { id: "bob", name: "Bob" }] }),
  }
  const sources = createProcurementSourceResolver({ host, scopedSources: persistence, contextFor: async (binding: TrustedDomainContext) => ({ status: "ok", value: { installationId: binding.binding.installationId, projectId: binding.binding.projectId, principalRef: binding.binding.principalRef, accessRevision: binding.binding.accessRevision, policyVersion: binding.binding.policyVersion, surface: "procurement", period: scenarioPeriod, currency: "USD", sourceRefs: [], capabilities: [] } }) })
  const admit = async (id = "alice") => {
    const request = new Request("https://scenario.invalid/procurement", { headers: { authorization: `Bearer ${id}` } })
    const digest = digestSfValue({ scenario: "synthetic", principalRef: id })
    const admitted = await ui.admit(request, "sf_scenario_simulate", digest)
    if (admitted.status !== "ok" || !await ui.validate(admitted.value, "sf_scenario_simulate", digest)) throw new Error("Synthetic UI admission failed")
    return { request, context: admitted.value }
  }
  const execute = async (actor: Actor, command: Command) => persistence.transaction("procurement", async (snapshot) => {
    const result = domain.execute(snapshot, actor, command, { at: clock.at, id: randomUUID, directory: [] })
    return { commit: result.ok, value: result }
  })
  const requester: Actor = { id: "alice", roles: ["requester"], canWrite: true }
  const seed = async () => {
    await persistence.initializeSources("procurement")
    const settings = await execute({ id: "admin", roles: ["admin"], canWrite: true }, { page: "Settings", action: "reset", version: 0, values: {} })
    if (!settings.ok) throw new Error("Synthetic Settings initialization failed")
    const created = await execute(requester, { page: "Requests", action: "create", version: 0, values: { pr: { title: "Synthetic purchase", type: "service", description: "Scenario producer fixture", estAmount: input.amount === undefined ? 100 : input.amount, recurring: false, expenseType: "OPEX", costCenter: "IT", needBy: "2026-12-01", justification: "Compare amount" } } })
    if (!created.ok) throw new Error("Synthetic requisition creation failed")
    return String(object(created.value).number)
  }
  const requestId = input.requestId ?? await seed()
  const admitted = await admit()
  const source = await sources.issue("procurement-request", requestId, admitted.context)
  if (source.status !== "ok") throw new Error("Synthetic source issuance failed")
  const resolved = await sources.resolveForPreparation(source.value, admitted.context)
  if (resolved.status !== "ok") throw new Error("Synthetic source resolution failed")
  return {
    directory, store, persistence, host, sources, ui, access, clock, writes, admit, execute, requester, requestId,
    request: admitted.request, context: admitted.context, sourceRef: source.value, evidence: resolved.value.evidence,
    producer: createProcurementScenarioProducer({ host, sources }),
    snapshot: () => persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) })),
    close: () => store.dispose(),
    dispose: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}
