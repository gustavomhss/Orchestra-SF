import type { SfContextHandle } from "../context/contracts"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"

/** Only human selectors and focus hints survive a same-owner route change.
 * No options, projection, source link, capability or successful authority read
 * is retained. Every returning catalog reauthorizes and reads its producers.
 */
export type SfBiHumanSelection = Readonly<{
  viewId: string; start: string; end: string; choice: string
  baseRef: string; candidateRef: string; currency: string
  focus: string; focusOrigin?: string; requested: boolean
}>
type Retention = { fence: string; routes: Map<string, SfBiHumanSelection> }
const retained = new WeakMap<SfContextHandle, Retention>()

export function sfBiStampKey(stamp: SfContextStamp): string {
  return JSON.stringify([stamp.installationId, stamp.projectId, stamp.hostId,
    stamp.principalRef, stamp.policyVersion, stamp.accessRevision])
}

export function sfBiOwnerFence(context: SfContextHandle): string | undefined {
  const state = context.state()
  return state.status === "ready" && context.ready()
    ? JSON.stringify([state.ownerKey, context.generation(), sfBiStampKey(state.context.stamp)])
    : undefined
}

export function clearSfBiRetention(context: SfContextHandle): void { retained.delete(context) }

/** Called by the mounted native owner even while the catalog is not mounted. */
export function reconcileSfBiRetention(context: SfContextHandle): void {
  const fence = sfBiOwnerFence(context), previous = retained.get(context)
  if (!fence || previous && previous.fence !== fence) retained.delete(context)
}

export function retainSfBiSelection(context: SfContextHandle, route: string, value: SfBiHumanSelection): void {
  const fence = sfBiOwnerFence(context)
  if (!fence) { retained.delete(context); return }
  let owner = retained.get(context)
  if (!owner || owner.fence !== fence) {
    owner = { fence, routes: new Map() }
    retained.set(context, owner)
  }
  // Bound memory to the closed catalog and its eleven view routes.
  if (!owner.routes.has(route) && owner.routes.size >= 12) owner.routes.clear()
  owner.routes.set(route, { ...value })
}

export function readSfBiSelection(context: SfContextHandle, route: string): SfBiHumanSelection | undefined {
  reconcileSfBiRetention(context)
  const value = retained.get(context)?.routes.get(route)
  return value ? { ...value } : undefined
}
