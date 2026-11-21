import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Actor, Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessContextService } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { PlannerPort, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { createDecisionBaselineCoverage } from "../../../../modules/sucafina/Sucafinav1/product/decisions/baseline-coverage.ts"
import { createDecisionBaselineFence } from "../../../../modules/sucafina/Sucafinav1/product/decisions/baseline-fence.ts"
import { createDecisionIntentFences } from "../../../../modules/sucafina/Sucafinav1/product/decisions/intent-fences.ts"

type CaseRef = { id: string; incarnation: string; version: number }

/** Construct before Planner; the lazy port is resolved only after composition has completed. */
export function createSfDecisionBaselineServices(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  evidence: BusinessContextService
  selectedCase: (call: TrustedDomainContext) => Promise<PortResult<CaseRef>>
  planner: () => Pick<PlannerPort, "compareForecast"> | undefined
  proposalCoverageWrites: WeakSet<object>
  readSourceFences: Parameters<typeof createDecisionIntentFences>[0]["readSourceFences"]
  lockedSourceFences: Parameters<typeof createDecisionIntentFences>[0]["lockedSourceFences"]
}) {
  const host = input.authority.host
  const actors = createSfDecisionPlannerActors(input.authority)
  const intents = createDecisionIntentFences({ human: input.authority.human, ui: input.authority.ui,
    readSourceFences: input.readSourceFences, lockedSourceFences: input.lockedSourceFences })
  const verifySnapshot = createDecisionBaselineFence({ resolveActor: actors.locked, matchesIntent: intents.verify })
  const baseline = createDecisionBaselineCoverage({ state: input.authority.state, host, resolveCase: input.selectedCase,
    authorizeCase: async (value, call) => value.participants.includes(call.binding.principalRef) &&
      (call.kind !== "native" || value.id === call.binding.caseId && value.incarnation === call.binding.caseIncarnation && value.version === call.binding.caseVersion) && await host.revalidate(call),
    authorizeCoverage: (request, call) => intents.authorize(call, "decisions.coverage", request),
    projectForecast: async (sourceRef, caseRef, call) => {
      const request = host.requestFor(call)
      const planner = input.planner()
      const selected = await input.selectedCase(call)
      if (!request || !planner || selected.status !== "ok" || !same(selected.value, caseRef) || !await host.revalidate(call)) return { status: "unavailable", reason: "baseline-selected-case-unavailable" }
      const current = await input.authority.state.read(request, "cases", (state, actor) => actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion ? state.cases[caseRef.id] : undefined)
      if (current.status !== "ok" || !current.value || current.value.incarnation !== caseRef.incarnation || current.value.version !== caseRef.version || !current.value.participants.includes(call.binding.principalRef)) return { status: "unavailable", reason: "baseline-selected-case-unavailable" }
      const comparison = await planner.compareForecast({ baseRef: sourceRef, candidateRef: sourceRef, period: current.value.horizon, currency: current.value.currency }, call)
      const again = await input.authority.state.read(request, "cases", (state, actor) => actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion ? state.cases[caseRef.id] : undefined)
      const latest = await input.selectedCase(call)
      return comparison.status === "ok" && again.status === "ok" && same(again.value, current.value) && latest.status === "ok" && same(latest.value, caseRef) && await host.revalidate(call)
        ? { status: "ok", value: comparison.value.baseline } : comparison.status !== "ok" ? comparison : { status: "stale", reason: "baseline-source-changed" }
    },
    resolveEvidence: (refs, call) => input.evidence.context({ refs }, call),
    // The published factory proves included entries by its classification. This host has
    // no producer for a not-applicable assertion and rejects those requests before entry.
    supports: () => { throw new Error("SF_BASELINE_NOT_APPLICABLE_UNSUPPORTED") },
    verifySnapshot, operationIdentity: (call) => call.kind === "ui" ? input.authority.ui.operationIdentity(call) : input.authority.native.operationIdentity?.(call),
    proposalCoverageWrites: input.proposalCoverageWrites, now: () => new Date().toISOString() })
  return { ...baseline,
    register: async (request: Parameters<typeof baseline.register>[0], call: TrustedDomainContext) => {
      if (request.entries.some((entry) => entry.status === "not-applicable")) return { status: "needs-input" as const, reason: "baseline-not-applicable-proof-unavailable" }
      if (call.kind !== "ui" || !await input.authority.human.authorize(call, "decisions.coverage", request) || !await actors.capture(call)) return { status: "denied" as const, reason: "baseline-human-authority-unavailable" }
      try { return await baseline.register(request, call) } finally { actors.release(call) }
    } }
}

/** Snapshot callbacks consume an actor authenticated earlier by this same installation. */
export function createSfDecisionPlannerActors(authority: ReturnType<typeof createSfProductAuthority>) {
  const captured = new WeakMap<TrustedDomainContext, { actor: Actor; roles: string; access: string; binding: string; expires: number }>()
  const host = authority.host
  return {
    capture: async (call: TrustedDomainContext) => {
      const request = host.requestFor(call)
      if (!request || !await host.revalidate(call)) return false
      const binding = digestSfValue([call.kind, call.binding])
      const value = await host.persistence.transaction("planner", async (snapshot) => {
        const principal = await host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
        if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
        const access = object(object(snapshot.data.access)[principal.id])
        if (access.assigned !== undefined && (!Array.isArray(access.assigned) || access.assigned.some((value: unknown) => typeof value !== "string")) ||
          access.domains !== undefined && (!Array.isArray(access.domains) || access.domains.some((value: unknown) => typeof value !== "string"))) return { commit: false, value: undefined }
        const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
        if (!roles.length) return { commit: false, value: undefined }
        const actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
          assigned: Array.isArray(access.assigned) ? access.assigned as string[] : [], domains: Array.isArray(access.domains) ? access.domains as string[] : [] }
        return { commit: false, value: { actor, roles: digestSfValue(roleMap(snapshot, "planner")), access: digestSfValue(object(snapshot.data.access)[principal.id]), binding, expires: Date.now() + 30_000 } }
      }, { signal: request.signal })
      if (!value || binding !== digestSfValue([call.kind, call.binding]) || !await host.revalidate(call)) return false
      captured.set(call, value)
      return true
    },
    locked: (snapshot: Snapshot, call: TrustedDomainContext) => {
      const value = captured.get(call)
      return value && value.expires > Date.now() && value.binding === digestSfValue([call.kind, call.binding]) && value.roles === digestSfValue(roleMap(snapshot, "planner")) &&
        value.access === digestSfValue(object(snapshot.data.access)[value.actor.id]) ? structuredClone(value.actor) : undefined
    },
    release: (call: TrustedDomainContext) => { captured.delete(call) },
  }
}

function same(left: unknown, right: unknown) { return digestSfValue(left) === digestSfValue(right) }
