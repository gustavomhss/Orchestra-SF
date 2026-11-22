import { AsyncLocalStorage } from "node:async_hooks"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BiViewRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { DomainPortHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"

type Authority = ReturnType<typeof createSfProductAuthority>
type Intent = { operation: string; input: unknown }
type Provider = {
  host: DomainPortHost
  ui: Authority["ui"]
  environment: DomainPortHost["environment"]
  requestFor: DomainPortHost["requestFor"]
  revalidate: DomainPortHost["revalidate"]
  matchesIntent: Authority["ui"]["matchesIntent"]
}
type Scope = {
  call: TrustedUiContext
  incoming: BiViewRequest
  inputDigest: string
  intent: Intent
  operation: string
  intentDigest: string
  binding: string
  provider: Provider
  request?: Request
  requestDigest?: string
  at?: string
  open: boolean
  invalid: boolean
}
type Read = { scope: Scope; selectionRef: string; open: boolean }

/** One original observation instant, never a cached projection or authorization. */
export function createSfBiObservationScope(authority: Authority) {
  const host = authority.host
  const active = new WeakMap<TrustedDomainContext, Scope>()
  const execution = new AsyncLocalStorage<Scope>()
  const reading = new AsyncLocalStorage<Read>()
  const requestDigest = (request: Request) => digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] })
  const current = (scope: Scope) => scope.open && !scope.invalid && active.get(scope.call) === scope && execution.getStore() === scope &&
    authority.host === scope.provider.host && scope.provider.host === host && authority.ui === scope.provider.ui &&
    host.environment === scope.provider.environment && host.requestFor === scope.provider.requestFor &&
    host.revalidate === scope.provider.revalidate && authority.ui.matchesIntent === scope.provider.matchesIntent &&
    scope.request !== undefined && !scope.request.signal.aborted && host.requestFor(scope.call) === scope.request &&
    requestDigest(scope.request) === scope.requestDigest && digestSfValue([scope.call.kind, scope.call.binding]) === scope.binding &&
    digestSfValue(scope.incoming) === scope.inputDigest && scope.incoming.viewId === "BI06" &&
    scope.intent.operation === scope.operation && digestSfValue(scope.intent.input) === scope.intentDigest &&
    authority.ui.matchesIntent(scope.call, scope.operation, scope.intentDigest)
  const denied = (): PortResult<never> => ({ status: "denied", reason: "bi-observation-invocation-changed" })
  const environment: DomainPortHost["environment"] = async (request) => {
    const read = reading.getStore()
    const before = read && read.open && current(read.scope) && read.scope.request === request &&
      read.selectionRef === read.scope.incoming.selectionRef
    // Every original call still observes the live directory, keys and identity.
    // Only its real observation time is held, after the original admission was consumed.
    const observed = await (read?.scope.provider.environment ?? host.environment).call(host, request)
    if (!read) return observed
    if (!before || !read.open || !current(read.scope) || read.scope.request !== request) {
      read.scope.invalid = true
      return observed
    }
    read.scope.at ??= observed.at
    return { ...observed, at: read.scope.at }
  }
  const read = async <Value>(selectionRef: string, call: TrustedDomainContext,
    produce: () => Promise<PortResult<Value>>): Promise<PortResult<Value>> => {
    const scope = active.get(call)
    if (!scope) return produce()
    if (execution.getStore() !== scope) return denied()
    // C16 consumes its admission before reaching the collection port. Bootstrap
    // callers supply their own already-consumed operation and exact input digest.
    if (scope.request === undefined) {
      scope.request = host.requestFor(call)
      scope.requestDigest = scope.request && requestDigest(scope.request)
    }
    if (!current(scope) || selectionRef !== scope.incoming.selectionRef) {
      scope.invalid = true
      return denied()
    }
    const observation: Read = { scope, selectionRef, open: true }
    return reading.run(observation, async () => {
      try {
        const result = await produce()
        if (!current(scope)) { scope.invalid = true; return denied() }
        return result
      } finally { observation.open = false }
    })
  }
  const run = async <Value>(incoming: BiViewRequest, call: TrustedDomainContext, intent: Intent,
    work: () => Promise<PortResult<Value>>): Promise<PortResult<Value>> => {
    if (incoming.viewId !== "BI06" || call.kind !== "ui") return work()
    if (active.has(call)) return denied()
    const scope: Scope = { call, incoming, inputDigest: digestSfValue(incoming), intent,
      operation: intent.operation, intentDigest: digestSfValue(intent.input),
      binding: digestSfValue([call.kind, call.binding]),
      provider: { host, ui: authority.ui, environment: host.environment, requestFor: host.requestFor,
        revalidate: host.revalidate, matchesIntent: authority.ui.matchesIntent }, open: true, invalid: false }
    active.set(call, scope)
    return execution.run(scope, async () => {
      try {
        const result = await work()
        if (result.status !== "ok") return result
        if (!current(scope) || !await host.revalidate(call) || !current(scope)) return denied()
        return result
      } catch (error) {
        if (scope.request && !current(scope)) return denied()
        throw error
      } finally {
        scope.open = false
        if (active.get(call) === scope) active.delete(call)
      }
    })
  }
  return { environment, read, run }
}
