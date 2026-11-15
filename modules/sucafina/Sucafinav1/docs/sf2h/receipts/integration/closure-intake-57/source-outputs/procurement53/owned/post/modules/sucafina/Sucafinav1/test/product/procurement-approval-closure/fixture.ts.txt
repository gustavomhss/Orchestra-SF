import { object, rows } from "../../../runtime/contract.ts"
import type { Actor, Command } from "../../../runtime/contract.ts"
import { createApplication } from "../../../runtime/application.ts"
import { domain, pages } from "../../../runtime/procurement.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createProcurementApprovalLifecycle } from "../../../product/procurement/decision-preparation.ts"
import { createProcurementSourceResolver } from "../../../product/procurement/sources.ts"
import { createProcurementScenarioProducer } from "../../../product/procurement/scenario-producer.ts"
import { createScenarioFixture, scenarioPeriod } from "../procurement-decision-producer/fixture.ts"

/** Synthetic identities and data; mutations use the production HTTP/domain and SQLite adapters. */
export async function createApprovalFixture(input: { directory?: string; requestId?: string } = {}) {
  const base = await createScenarioFixture(input)
  const actors: Record<string, Actor> = {
    alice: { id: "alice", canWrite: true, roles: ["requester"] },
    bob: { id: "bob", canWrite: true, roles: ["approver"] },
  }
  const host: DomainPortHost = {
    ...base.host,
    authenticate: async (request) => {
      const principal = await base.host.authenticate(request)
      const actor = principal && actors[principal.id]
      return actor ? { id: actor.id, canWrite: actor.canWrite, roles: actor.roles.map((role) => ({ surface: "procurement" as const, role })) } : null
    },
  }
  const sources = createProcurementSourceResolver({ host, scopedSources: base.persistence, contextFor: async (binding: TrustedDomainContext) => ({ status: "ok", value: { installationId: binding.binding.installationId, projectId: binding.binding.projectId, principalRef: binding.binding.principalRef, accessRevision: binding.binding.accessRevision, policyVersion: binding.binding.policyVersion, surface: "procurement", period: scenarioPeriod, currency: "USD", sourceRefs: [], capabilities: [] } }) })
  const lifecycle = createProcurementApprovalLifecycle({ host })
  const http = createApplication("/sf", {
    persistence: base.persistence, authenticate: host.authenticate, environment: host.environment, maxJsonBytes: 1024 * 1024,
    domains: { dashboard: [], planner: [], procurement: [{ pages, domain, render: () => undefined }] },
  })
  const post = async (principal: string, command: Command) => {
    const response = await http(new Request("https://scenario.invalid/sf/procurement", { method: "POST", headers: { authorization: `Bearer ${principal}`, origin: "https://scenario.invalid", "content-type": "application/json" }, body: JSON.stringify(command) }))
    if (!response) throw new Error("Canonical Procurement command endpoint unavailable")
    return response
  }
  const issue = async (principal = "alice") => {
    const admitted = await base.admit(principal)
    const source = await sources.issue("procurement-request", base.requestId, admitted.context)
    if (source.status !== "ok") throw new Error(`Current source issuance unavailable: ${source.reason}`)
    return { ...admitted, sourceRef: source.value }
  }
  const review = async (principal = "alice") => {
    const admitted = await issue(principal)
    const current = await lifecycle.review(admitted.sourceRef, admitted.context)
    if (current.status !== "ok") throw new Error(`Canonical lifecycle review unavailable: ${current.reason}`)
    return { ...admitted, review: current.value }
  }
  const configureHolder = async (holderId: string | null) => {
    const snapshot = await base.snapshot()
    const settings = object(object(snapshot.data.store).settings)
    const result = await base.execute({ id: "admin", roles: ["admin"], canWrite: true }, { page: "Settings", action: "save", version: snapshot.versions.settings?.version ?? 0, values: { levels: rows(settings.levels).map((level) => ({ ...level, holderId })) } })
    if (!result.ok) throw new Error("Synthetic directory holder setup failed")
  }
  // Preserve the initial thresholds, stages, mode and self-approval setting.
  if (!input.requestId) await configureHolder("bob")
  return {
    ...base, actors, host, sources, lifecycle, http, post, issue, review, configureHolder,
    producer: createProcurementScenarioProducer({ host, sources }),
    current: async () => object(object(object(object((await base.snapshot()).data.store).requests)[base.requestId]).request),
  }
}
