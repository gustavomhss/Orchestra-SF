import type { AuthorizedWorkList } from "../contracts/outputs.ts"
import type { PortResult } from "../contracts/ports.ts"

/** Inputs are current, authorized projections from the owning domains; no status is stored here. */
export function projectMyWork(principalRef: string, sources: readonly AuthorizedWorkList["items"][number][]): PortResult<AuthorizedWorkList> {
  if (!principalRef.trim()) return { status: "denied", reason: "principal-unavailable" }
  const items: AuthorizedWorkList["items"][number][] = []
  for (const source of sources) {
    if (source.ownerRef !== principalRef) continue
    if (!source.actionRef.trim() || !source.state.trim()) return { status: "unavailable", reason: "invalid-work-source" }
    const existing = items.find((item) => item.actionRef === source.actionRef)
    if (!existing) {
      items.push({ ...source, sourceRefs: [...source.sourceRefs] })
      continue
    }
    if (existing.state !== source.state || existing.ownerRef !== source.ownerRef) return { status: "stale", reason: "work-source-conflict" }
    const refs = [...existing.sourceRefs, ...source.sourceRefs]
    items[items.indexOf(existing)] = { ...existing, sourceRefs: refs.filter((ref, index) => refs.findIndex((other) => other.refDigest === ref.refDigest) === index) }
  }
  return { status: "ok", value: { items } }
}
