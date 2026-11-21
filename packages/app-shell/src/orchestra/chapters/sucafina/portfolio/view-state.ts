import { createEffect, type Accessor } from "solid-js"
import { createStore } from "solid-js/store"
import type { SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfContextHandle, SfDraftRegistry } from "../context/contracts"
import { PROJECT_STATUS } from "./projects/model"
import { sfAdmitted, sfOwnerMatches } from "./projects/producer"

export type SfPortfolioFilters = Readonly<{ search: string; status: string; filter: string }>
type Retained = Readonly<{ owner: string; value: SfPortfolioFilters }>
const retained = new WeakMap<SfDraftRegistry, Retained>()
const empty: SfPortfolioFilters = Object.freeze({ search: "", status: "", filter: "" })

/**
 * Only presentation selectors survive the CAP09 -> CAP10 -> list transition.
 * The original owner registry is the lifetime boundary; neither source records,
 * read receipts, transport instances nor authority are retained here.
 */
export function createSfPortfolioViewState(
  context: SfContextHandle,
  route: Accessor<SfResolvedRoute<"CAP09" | "CAP10">>,
) {
  const [value, setValue] = createStore<SfPortfolioFilters>({ ...empty })
  let previous: SfDraftRegistry | undefined
  let selection: string | undefined
  let routeSeed: string | undefined
  const admitted = () => {
    const state = context.state()
    const current = state.status === "ready" ? context.ready() : undefined
    const target = route()
    if (state.status !== "ready" || !current ||
        state.selection.serverKey !== target.ownerSelection.serverKey ||
        !sfOwnerMatches(current.context, target.ownerSelection) ||
        !sfAdmitted(current.context, target.surfaceId, "domain.page." + target.surfaceId)) return
    return {
      registry: current.drafts,
      owner: JSON.stringify([state.ownerKey, current.context.stamp.accessRevision,
        current.context.stamp.policyVersion, target.query.year ?? null]),
    }
  }
  createEffect(() => {
    const state = context.state()
    const selected = JSON.stringify([state.selection.serverKey, state.selection.projectId, state.selection.installationId])
    const scope = admitted()
    const target = route()
    if (!scope) {
      // Resolving/temporary unavailability hides the selectors until a fresh,
      // identical owner/access/period admission; definitive loss purges them.
      if (previous && (selected !== selection || state.status === "denied" ||
          state.status === "context-mismatch" || state.status === "choose-installation" ||
          state.status === "ready")) retained.delete(previous)
      setValue({ ...empty })
      return
    }
    if (previous && previous !== scope.registry) retained.delete(previous)
    previous = scope.registry
    selection = selected
    const saved = retained.get(scope.registry)
    const restored = saved?.owner === scope.owner ? saved.value : empty
    const seed = JSON.stringify([target.surfaceId, target.query.year ?? null, target.query.status ?? null, target.query.filter ?? null])
    const next = {
      ...restored,
      ...(target.surfaceId === "CAP09" && (seed !== routeSeed || saved?.owner !== scope.owner) ? {
        ...(target.query.status !== undefined ? { status: target.query.status } : {}),
        ...(target.query.filter !== undefined ? { filter: target.query.filter } : {}),
      } : {}),
    }
    routeSeed = seed
    const snapshot = Object.freeze(next)
    retained.set(scope.registry, { owner: scope.owner, value: snapshot })
    setValue({ ...snapshot })
  })
  const change = (input: Partial<SfPortfolioFilters>) => {
    const scope = admitted()
    if (!scope) return false
    const saved = retained.get(scope.registry)
    const next = { ...(saved?.owner === scope.owner ? saved.value : empty), ...input }
    if (typeof next.search !== "string" || typeof next.status !== "string" || typeof next.filter !== "string" ||
        (next.status !== "" && !PROJECT_STATUS.some((status) => status === next.status)) ||
        !["", "watch", "at-risk"].includes(next.filter)) return false
    // Copy the caller's object: a later mutation cannot change retained state.
    const snapshot = Object.freeze(next)
    retained.set(scope.registry, { owner: scope.owner, value: snapshot })
    setValue({ ...snapshot })
    return true
  }
  return { value, change, reset: () => change(empty) }
}
