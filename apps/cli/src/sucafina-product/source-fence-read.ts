import { sfRunSourceFence } from "../../../../modules/sucafina/Sucafinav1/product/ai/run-store.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { DomainPortHost } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { Persistence, Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Surface } from "../../../../modules/sucafina/Sucafinav1/src/identity.ts"

type SourceFences = Record<Surface, string>
type Snapshots = Readonly<Record<Surface, Snapshot>>

/** Borrow only the actual provider's active atomic read; never open a nested writer. */
export function createSfSourceFenceReader(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  persistence: Pick<Persistence, "currentSnapshots" | "transactionAll">
}) {
  return async (call: TrustedDomainContext): Promise<SourceFences | undefined> => {
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
      const initial = input.persistence.currentSnapshots?.()
      if (initial && !complete(initial)) return undefined
      const captured = initial ? structuredClone(initial) : undefined
      const snapshotDigest = captured ? digestSfValue(captured) : undefined
      if (!await input.host.revalidate(call) || !current()) return undefined
      if (captured) {
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
      const found = await input.persistence.transactionAll(async (snapshots) => ({ commit: false, value: fences(snapshots) }), { signal: request.signal })
      return await input.host.revalidate(call) && current() ? found : undefined
    } catch { return undefined }
  }
}

function fences(snapshots: Snapshots): SourceFences {
  return { dashboard: sfRunSourceFence(snapshots.dashboard), planner: sfRunSourceFence(snapshots.planner), procurement: sfRunSourceFence(snapshots.procurement) }
}
function complete(snapshots: Snapshots) {
  return [snapshots.dashboard, snapshots.planner, snapshots.procurement].every((snapshot) => !!snapshot && typeof snapshot === "object")
}
function requestIdentity(request: Request) { return digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] }) }
