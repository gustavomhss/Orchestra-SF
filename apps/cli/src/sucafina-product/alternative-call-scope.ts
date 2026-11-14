import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type Scope<Value> = { request: Request; binding: string; admitted: boolean; proof?: { fence: string; value: Value } }

/** Reuse a completed selection proof only inside one invocation and the same unchanged authorized snapshot. */
export function createSfAlternativeCallScope<Value>(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  selectedCase: (call: TrustedDomainContext) => Promise<PortResult<CaseRef>>
  lockedSourceFences: () => Record<"dashboard" | "planner" | "procurement", string> | undefined
  verifiedInputFor?: (call: TrustedDomainContext) => Promise<PortResult<unknown>>
  verifiedAlternativeSelectionFor?: (call: TrustedDomainContext) => Promise<PortResult<unknown>>
  hasAdmittedInputContext?: (call: TrustedDomainContext) => boolean
}) {
  const host = input.authority.host
  const active = new WeakMap<TrustedDomainContext, Scope<Value>>()
  const admitted = (call: TrustedDomainContext) => call.kind === "native" || input.hasAdmittedInputContext?.(call) === true
  const current = (call: TrustedDomainContext, scope: Scope<Value>) => active.get(call) === scope &&
    host.requestFor(call) === scope.request && !scope.request.signal.aborted && scope.admitted === admitted(call) &&
    scope.binding === digestSfValue([call.kind, call.binding])
  const observedDay = async (request: Request) => {
    const at = (await host.environment(request)).at
    return typeof at === "string" && Number.isFinite(Date.parse(at)) ? new Date(at).toISOString().slice(0, 10) : undefined
  }
  const fence = async (call: TrustedDomainContext, scope: Scope<Value>): Promise<string | undefined> => {
    if (!current(call, scope) || !await host.revalidate(call)) return undefined
    const day = await observedDay(scope.request)
    if (!day || !current(call, scope)) return undefined
    const selected = await input.selectedCase(call)
    if (selected.status !== "ok" || !current(call, scope)) return undefined
    // The C08 read holds the real SQLite read scope. Its complete digest detects even
    // corruption without a revision bump; domain fences cover all three surfaces.
    const found = await input.authority.state.read(scope.request, "preferences", async (state, actor) => {
      const value = state.cases[selected.value.id]
      if (actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion ||
        !value || value.id !== selected.value.id || value.incarnation !== selected.value.incarnation || value.version !== selected.value.version ||
        !value.participants.includes(actor.principalRef) || !current(call, scope) || !await host.revalidate(call)) return undefined
      let admission: unknown
      if (scope.admitted) {
        const verified = await input.verifiedInputFor?.(call)
        if (!verified || verified.status !== "ok") return undefined
        // These readers recheck the actual stored run, Request, private holder and
        // native generation. An unchanged C08 digest never substitutes for authority.
        const alternative = await input.verifiedAlternativeSelectionFor?.(call)
        admission = { input: verified.value, alternative }
      }
      const sources = input.lockedSourceFences()
      // Dashboard projections use the observed UTC day even when the raw
      // snapshots have not changed. A proof cannot cross that boundary.
      return sources && current(call, scope) && await host.revalidate(call)
        ? digestSfValue({ state, sources, day, caseRef: selected.value, binding: scope.binding, admission }) : undefined
    })
    const afterDay = await observedDay(scope.request)
    return found.status === "ok" && typeof found.value === "string" && afterDay === day && current(call, scope) &&
      await host.revalidate(call) && current(call, scope) ? found.value : undefined
  }
  const read = async (call: TrustedDomainContext, produce: () => Promise<PortResult<Value>>): Promise<PortResult<Value>> => {
    const scope = active.get(call)
    if (!scope) return produce()
    const before = await fence(call, scope)
    if (!before) return { status: "denied", reason: "alternative-call-authority-unavailable" }
    if (scope.proof?.fence === before) {
      const value = structuredClone(scope.proof.value)
      const after = await fence(call, scope)
      return after === before ? { status: "ok", value } : { status: "stale", reason: "alternative-call-proof-changed" }
    }
    scope.proof = undefined
    const result = await produce()
    if (result.status !== "ok") return result
    const after = await fence(call, scope)
    if (!after || after !== before) return { status: "stale", reason: "alternative-call-proof-changed" }
    scope.proof = { fence: after, value: structuredClone(result.value) }
    return result
  }
  const run = async <Result>(call: TrustedDomainContext, work: () => Promise<PortResult<Result>>): Promise<PortResult<Result>> => {
    const request = host.requestFor(call)
    if (!request || active.has(call) || request.signal.aborted || !await host.revalidate(call)) return { status: "denied", reason: "alternative-call-authority-unavailable" }
    if (active.has(call) || host.requestFor(call) !== request || request.signal.aborted) return { status: "denied", reason: "alternative-call-authority-unavailable" }
    const scope: Scope<Value> = { request, binding: digestSfValue([call.kind, call.binding]), admitted: admitted(call) }
    active.set(call, scope)
    try { return await work() } finally { if (active.get(call) === scope) active.delete(call) }
  }
  return { run, read }
}
