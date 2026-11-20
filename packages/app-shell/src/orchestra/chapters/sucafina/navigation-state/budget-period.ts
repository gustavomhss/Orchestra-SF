import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContextStamp, SfOwnerKey, SfOwnerSelection, SfReadableContext, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import { dashboardRouteAvailable, parseDashboardRouteQuery } from "../host/dashboard-route"
import { matchSfNativeRoutePath } from "../route-registry"
import type { SfNativeNavigationState, SfNativeTransitionResult } from "./index"
import { sfAppendOwnerQuery, sfParseOwnerQuery, sfSameContextStamp, sfSameOwnerSelection, sfSelectionFromQuery } from "./owner"

export type SfBudgetPeriod = Readonly<{ year?: number; month?: number }>
export type SfBudgetPeriodPort = (
  from: SfResolvedRoute<"CAP03">, period: SfBudgetPeriod, signal: AbortSignal,
) => Promise<SfNativeTransitionResult["status"]>
export type SfCurrentBudgetOwner = Readonly<{
  ownerKey: SfOwnerKey
  generation: number
  selection: SfOwnerSelection
  stamp: SfContextStamp
  transport: SfTransport
  budgetReadReady: boolean
}>
const pathname = "/orchestra/sf-dashboard/budget"
const candidate = matchSfNativeRoutePath(pathname)!
export const sfBudgetPeriodAvailable = (context: SfReadableContext) => dashboardRouteAvailable(context, candidate)

/** Preserve the admitted route's named/implicit owner mode; F01 still authorizes the candidate. */
export function sfBudgetPeriodRequest(from: SfResolvedRoute<"CAP03">, period: SfBudgetPeriod): string | undefined {
  const owner = from.ownerSelection
  if (from.surfaceId !== "CAP03" || from.kind !== "entry" || from.pathname !== pathname ||
      Object.keys(from.params).length || Object.keys(from.query).some((key) => key !== "year" && key !== "month") ||
      Object.keys(period).some((key) => key !== "year" && key !== "month") ||
      (period.year !== undefined && typeof period.year !== "number") ||
      (period.month !== undefined && typeof period.month !== "number") ||
      !owner.serverKey || !owner.projectId || !owner.installationId) return
  try {
    const url = new URL(String(from.href), "http://orchestra.invalid")
    if (url.origin !== "http://orchestra.invalid" || url.pathname !== pathname || url.hash ||
        /%(?![\da-fA-F]{2})/.test(url.search)) return
    const source = parseDashboardRouteQuery(url.searchParams, candidate)
    if (!source || source.year !== from.query.year || source.month !== from.query.month) return
    const parsed = sfParseOwnerQuery(url.searchParams)
    if (owner.team && parsed.kind !== "team") return
    const selected = sfSelectionFromQuery(url.searchParams, owner)
    if (!selected || !sfSameOwnerSelection(selected, owner)) return
    const query = new URLSearchParams()
    if (parsed.kind !== "absent") sfAppendOwnerQuery(query, owner)
    if (period.year !== undefined) query.set("year", String(period.year))
    if (period.month !== undefined) query.set("month", String(period.month))
    // The original CAP03 input codec owns the finite year/month domain.
    if (!parseDashboardRouteQuery(query, candidate)) return
    const tail = query.toString()
    return pathname + (tail ? "?" + tail : "")
  } catch {
    return
  }
}

/** Installed only beside the original F01 owner; no history or router fallback. */
export function createSfBudgetPeriodPort(
  navigation: SfNativeNavigationState, current: () => SfCurrentBudgetOwner | undefined,
): SfBudgetPeriodPort {
  return async (from, period, signal) => {
    if (signal.aborted) return "aborted"
    const initial = current()
    if (!initial || !initial.budgetReadReady) return "unavailable"
    // Copy primitive authority fields before awaiting; reactive store proxies are not snapshots.
    const team = initial.stamp.team
    const owner = {
      ...initial,
      selection: { ...initial.selection, team: initial.selection.team && { ...initial.selection.team } },
      stamp: { ...initial.stamp, team: team && {
        owner: { profile: { ...team.owner.profile }, principal: { ...team.owner.principal } },
        revisions: { ...team.revisions },
      } },
    }
    if (!sfSameOwnerSelection(from.ownerSelection, owner.selection)) return "denied"
    const destination = sfBudgetPeriodRequest(from, period)
    if (!destination) return "invalid-link"
    const stillCurrent = () => {
      const latest = current()
      return !!latest && latest.budgetReadReady && latest.generation === owner.generation &&
        latest.ownerKey === owner.ownerKey && latest.transport === owner.transport &&
        sfSameOwnerSelection(latest.selection, owner.selection) && sfSameContextStamp(latest.stamp, owner.stamp)
    }
    const result = await navigation.requestNativeTransition(destination, "link", {
      signal, expectedOwnerKey: owner.ownerKey,
      admit: (resolved) => stillCurrent() && resolved.surfaceId === "CAP03" &&
        resolved.kind === "entry" && sfSameOwnerSelection(resolved.ownerSelection, owner.selection) &&
        resolved.query.year === period.year && resolved.query.month === period.month &&
        sfBudgetPeriodRequest({ ...resolved, surfaceId: "CAP03" }, period) === destination,
      preCommit: async (_resolved, admissionSignal) => !admissionSignal.aborted && stillCurrent(),
    })
    return result.status
  }
}
