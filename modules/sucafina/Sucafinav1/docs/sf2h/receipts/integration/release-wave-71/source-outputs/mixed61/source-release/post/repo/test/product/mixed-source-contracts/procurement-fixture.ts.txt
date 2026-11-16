import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createProcurementSourceResolver } from "../../../product/procurement/sources.ts"
import { createScenarioFixture, scenarioPeriod } from "../procurement-decision-producer/fixture.ts"

/** Declared synthetic identity/data; every source, grant and snapshot comes from production code. */
export async function createProcurementContractFixture() {
  const base = await createScenarioFixture()
  const authorization = { allowed: true, principal: "alice", accessRevision: "access-1", policyVersion: "policy-1", roles: ["requester"] }
  const authenticate: DomainPortHost["authenticate"] = async (request) => {
    const principal = await base.host.authenticate(request)
    if (!authorization.allowed || !principal) return null
    return { ...principal, id: principal.id === "alice" ? authorization.principal : principal.id,
      roles: authorization.roles.map((role) => ({ surface: "procurement" as const, role })) }
  }
  const ui = createSfUiAuthority({
    authorize: async (request) => {
      const principal = await authenticate(request)
      return principal ? { installationId: "scenario-install", projectId: "scenario-project", principalRef: principal.id,
        accessRevision: authorization.accessRevision, policyVersion: authorization.policyVersion } : undefined
    },
    commandIdentity: async () => randomUUID(), createId: randomUUID, now: Date.now,
  })
  const host: DomainPortHost = { ...base.host, authenticate,
    requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
    revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
  }
  const observation: { reads: number; afterRead?: () => Promise<void> } = { reads: 0 }
  const scopedSources = { ...base.persistence, resolveScopedSource: async (...args: Parameters<typeof base.persistence.resolveScopedSource>) => {
    const resolved = await base.persistence.resolveScopedSource(...args)
    if (resolved) {
      observation.reads++
      await observation.afterRead?.()
    }
    return resolved
  } }
  const sources = createProcurementSourceResolver({ host, scopedSources,
    contextFor: async (context: TrustedDomainContext) => ({ status: "ok", value: {
      installationId: context.binding.installationId, projectId: context.binding.projectId,
      principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision,
      policyVersion: context.binding.policyVersion, surface: "procurement", period: scenarioPeriod,
      currency: "USD", sourceRefs: [], capabilities: [],
    } }),
  })
  const controller = new AbortController()
  const request = new Request("https://scenario.invalid/procurement", { headers: { authorization: "Bearer alice" }, signal: controller.signal })
  const digest = digestSfValue({ contract: "mixed-source-procurement", request: base.requestId })
  const admitted = await ui.admit(request, "sf_request_read", digest)
  if (admitted.status !== "ok" || !await ui.validate(admitted.value, "sf_request_read", digest)) {
    await base.dispose()
    throw new Error("Real source contract UI admission unavailable")
  }
  const context = admitted.value
  const issue = async () => {
    const issued = await sources.issue("procurement-request", base.requestId, context)
    if (issued.status !== "ok") throw new Error(`Actual source issuance failed: ${issued.reason}`)
    const resolved = await sources.resolveForPreparation(issued.value, context)
    if (resolved.status !== "ok") throw new Error(`Actual source resolution failed: ${resolved.reason}`)
    return resolved.value.evidence
  }
  const original = await issue()
  const snapshots = () => Promise.all((["dashboard", "planner", "procurement"] as const).map((surface) =>
    base.persistence.transaction(surface, async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))))
  return { ...base, authorization, host, ui, sources, observation, controller, request, context, original, issue, snapshots,
    dispose: async () => { ui.finish(context); await base.dispose() },
  }
}

export type ProcurementContractFixture = Awaited<ReturnType<typeof createProcurementContractFixture>>

export async function sourceGrant(fixture: ProcurementContractFixture, original = fixture.original, current = original) {
  const granted = await fixture.sources.prepareReissueScope(original, current, fixture.context)
  if (granted.status !== "ok") throw new Error(`Actual private source grant unavailable: ${granted.reason}`)
  return () => fixture.persistence.transaction("procurement", async () => ({ commit: false, value: await granted.value.fence() }))
}
