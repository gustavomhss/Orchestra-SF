import { types } from "node:util"
import { beginSfReadonlyDiagnostic, endSfReadonlyDiagnostic, countSfReadonlyDiagnostic } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/diagnostic-timing.ts"
import { sfRunSourceFence } from "../../../../modules/sucafina/Sucafinav1/product/ai/run-store.ts"
import { digestSfValue, sfCanonicalSerializerUnhooked } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { DomainPortHost } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { Persistence, Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { currentSfReadonlySnapshotScope } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import type { Surface } from "../../../../modules/sucafina/Sucafinav1/src/identity.ts"

type SourceFences = Record<Surface, string>
type Snapshots = Readonly<Record<Surface, Snapshot>>

/** Borrow only the actual provider's active atomic read; never open a nested writer. */
export function createSfSourceFenceReader(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  persistence: Pick<Persistence, "currentSnapshots" | "transactionAll" | "currentSnapshotScope">
}) {
  // Retain only deterministic fences, indexed by a sealed LocalStore root.
  // Each reader still observes its live scope and reauthorizes the real Request.
  const sealed = new WeakMap<object, SourceFences>()
  const observe = () => {
    const measured = beginSfReadonlyDiagnostic("fence.observe")
    try {
    if (types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype || !sfCanonicalSerializerUnhooked()) { countSfReadonlyDiagnostic("fence.observe.unsupported-input-or-serializer"); return undefined }
    const descriptor = Object.getOwnPropertyDescriptor(input, "persistence")
    if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.value || typeof descriptor.value !== "object") { countSfReadonlyDiagnostic("fence.observe.unsupported-owner"); return undefined }
    const owner: typeof input.persistence = descriptor.value
    const scope = currentSfReadonlySnapshotScope(owner)
    if (!scope) { countSfReadonlyDiagnostic("fence.observe.no-readonly-proof"); return undefined }
    countSfReadonlyDiagnostic("fence.observe.recognized")
    return { owner, scope, current: () => {
      const active = Object.getOwnPropertyDescriptor(input, "persistence")
      const current = Object.getPrototypeOf(input) === Object.prototype && !!active && Object.hasOwn(active, "value") &&
        active.value === owner && sfCanonicalSerializerUnhooked() && scope.current()
      countSfReadonlyDiagnostic(current ? "fence.current.valid" : "fence.current.invalid")
      return current
    } }
    } finally { endSfReadonlyDiagnostic(measured) }
  }
  const fromScope = (observation: NonNullable<ReturnType<typeof observe>>) => {
    const measured = beginSfReadonlyDiagnostic("fence.sealed.lookup")
    try {
    if (!observation.current()) { countSfReadonlyDiagnostic("fence.sealed.invalid-before"); return undefined }
    const identity = observation.scope.bytesIdentity ?? observation.scope.identity
    const remembered = sealed.get(identity)
    if (remembered) { countSfReadonlyDiagnostic("fence.memo.hit"); return { ...remembered } }
    countSfReadonlyDiagnostic("fence.memo.miss")
    const snapshots = observation.owner.currentSnapshots?.()
    if (!snapshots || !complete(snapshots)) { countSfReadonlyDiagnostic("fence.sealed.incomplete"); return undefined }
    const result = fences(snapshots)
    if (!observation.current()) { countSfReadonlyDiagnostic("fence.sealed.invalid-after"); return undefined }
    sealed.set(identity, { ...result })
    return result
    } finally { endSfReadonlyDiagnostic(measured) }
  }
  const locked = () => {
    const measured = beginSfReadonlyDiagnostic("fence.locked")
    try {
    const observation = observe()
    if (observation) return fromScope(observation)
    countSfReadonlyDiagnostic("fence.locked.legacy")
    const snapshots = input.persistence.currentSnapshots?.()
    return snapshots && complete(snapshots) ? fences(snapshots) : undefined
    } finally { endSfReadonlyDiagnostic(measured) }
  }
  const read = async (call: TrustedDomainContext): Promise<SourceFences | undefined> => {
    const measured = beginSfReadonlyDiagnostic("fence.read")
    try {
      // Capture authority and the complete provider snapshot before the first
      // asynchronous callback. A source-only fence excludes C08 and is not enough
      // to notice a changed case, ACL, receipt or captured body in the same group.
      const request = input.host.requestFor(call)
      if (!request || request.signal.aborted) return undefined
      const binding = digestSfValue([call.kind, call.binding])
      const requestDigest = requestIdentity(request)
      const current = () => input.host.requestFor(call) === request && !request.signal.aborted &&
        requestIdentity(request) === requestDigest && digestSfValue([call.kind, call.binding]) === binding
      const observation = observe()
      if (observation) {
        const observed = fromScope(observation)
        if (!observed || !await input.host.revalidate(call) || !current() || !observation.current()) { countSfReadonlyDiagnostic("fence.read.sealed-refused"); return undefined }
        if (!await input.host.revalidate(call) || !current() || !observation.current()) { countSfReadonlyDiagnostic("fence.read.sealed-refused"); return undefined }
        countSfReadonlyDiagnostic("fence.read.sealed-accepted")
        return observed
      }
      countSfReadonlyDiagnostic("fence.read.legacy")
      const initial = input.persistence.currentSnapshots?.()
      if (initial && !complete(initial)) return undefined
      const captured = initial ? structuredClone(initial) : undefined
      const snapshotDigest = captured ? digestSfValue(captured) : undefined
      if (!await input.host.revalidate(call) || !current()) return undefined
      if (captured) {
        countSfReadonlyDiagnostic("fence.legacy.captured")
        const reopened = input.persistence.currentSnapshots?.()
        if (!reopened || !complete(reopened) || digestSfValue(reopened) !== snapshotDigest) return undefined
        const observed = fences(reopened)
        if (!await input.host.revalidate(call) || !current()) return undefined
        const final = input.persistence.currentSnapshots?.()
        // currentSnapshots returns defensive copies. Reopen after every await;
        // neither reference equality nor the held pre-authentication copy grants access.
        if (!final || !complete(final) || digestSfValue(final) !== snapshotDigest ||
          digestSfValue(fences(final)) !== digestSfValue(observed)) return undefined
        return fences(final)
      }
      // Outside a provider scope, retain the existing serializable read. A scope
      // appearing across authentication must not turn this into a nested writer.
      if (!input.persistence.transactionAll || input.persistence.currentSnapshots?.()) return undefined
      countSfReadonlyDiagnostic("fence.legacy.transaction-all")
      const found = await input.persistence.transactionAll(async (snapshots) => ({ commit: false, value: fences(snapshots) }), { signal: request.signal })
      return await input.host.revalidate(call) && current() ? found : undefined
    } catch { countSfReadonlyDiagnostic("fence.read.error"); return undefined }
    finally { endSfReadonlyDiagnostic(measured) }
  }
  return Object.assign(read, { locked })
}

function fences(snapshots: Snapshots): SourceFences {
  const measured = beginSfReadonlyDiagnostic("fence.calculate")
  try {
  return { dashboard: sfRunSourceFence(snapshots.dashboard), planner: sfRunSourceFence(snapshots.planner), procurement: sfRunSourceFence(snapshots.procurement) }
  } finally { endSfReadonlyDiagnostic(measured) }
}
function complete(snapshots: Snapshots) {
  return [snapshots.dashboard, snapshots.planner, snapshots.procurement].every((snapshot) => !!snapshot && typeof snapshot === "object")
}
function requestIdentity(request: Request) { return digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] }) }
