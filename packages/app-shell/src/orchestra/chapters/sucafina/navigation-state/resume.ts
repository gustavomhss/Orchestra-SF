/**
 * UI29 -> UI34 through the existing F01 native transition. A Home row is a
 * source hint, never authority: read the current original case and its
 * incarnation/version before requesting a host-owned route admission.
 */
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type {
  SfContextStamp, SfOwnerKey, SfOwnerSelection, SfResolvedRoute,
} from "@orchestra/schema/sucafina/context"
import type { SfTodayResumePort } from "../home"
import { encodeSfRouteRef, type SfNativeNavigationState } from "./index"

export type SfCurrentResumeOwner = Readonly<{
  ownerKey: SfOwnerKey
  generation: number
  selection: SfOwnerSelection
  stamp: SfContextStamp
  transport: SfTransport
  caseReadReady: boolean
}>

const sameSelection = (a: SfOwnerSelection, b: SfOwnerSelection) =>
  !!a.installationId && !!b.installationId &&
  a.serverKey === b.serverKey &&
  a.projectId === b.projectId &&
  a.installationId === b.installationId

const sameStamp = (a: SfContextStamp, b: SfContextStamp) =>
  a.installationId === b.installationId &&
  a.projectId === b.projectId &&
  a.hostId === b.hostId &&
  a.principalRef === b.principalRef &&
  a.policyVersion === b.policyVersion &&
  a.accessRevision === b.accessRevision

const liveOwner = (previous: SfCurrentResumeOwner, current: () => SfCurrentResumeOwner | undefined) => {
  const latest = current()
  return !!latest && latest.generation === previous.generation &&
    latest.ownerKey === previous.ownerKey &&
    sameSelection(latest.selection, previous.selection) &&
    sameStamp(latest.stamp, previous.stamp)
}

function returnRouteValid(route: SfResolvedRoute<"UI29">, selection: SfOwnerSelection) {
  return route.surfaceId === "UI29" && route.kind === "entry" &&
    sameSelection(route.ownerSelection, selection) &&
    route.pathname === "/orchestra/sf-home"
}

/**
 * Only the genuine owner navigation object may be supplied by the composition
 * root. No simulated fallback, alternate history controller, or title-derived
 * URL is created here. A missing F01 binding leaves the port absent.
 */
export function createSfTodayResumePort(
  navigation: SfNativeNavigationState,
  current: () => SfCurrentResumeOwner | undefined,
): SfTodayResumePort {
  return Object.freeze({
    async resumeCase(request, signal) {
      if (signal.aborted) return { status: "aborted" }
      const owner = current()
      if (!owner || !owner.caseReadReady) return { status: "unavailable" }
      if (request.ownerKey !== owner.ownerKey ||
          !sameStamp(request.sourceStamp, owner.stamp))
        return { status: "denied" }
      if (!returnRouteValid(request.returnRoute, owner.selection))
        return { status: "invalid-link" }
      if (typeof request.caseRef !== "string" ||
          request.caseRef.length === 0 || request.caseRef.length > 16_384 ||
          request.focusCaseRef !== request.caseRef)
        return { status: "invalid-link" }
      if (!Number.isSafeInteger(request.sourceVersion) || request.sourceVersion < 0)
        return { status: "stale" }
      const result = await createSfDecisionsClient(owner.transport)["projection.case"](
        { caseRef: request.caseRef }, { signal },
      ).catch(() => undefined)
      if (signal.aborted || !liveOwner(owner, current)) return { status: "aborted" }
      if (!result || result.kind !== "response")
        return { status: "unavailable" }
      if (result.body.status !== "ok") {
        if (result.body.status === "denied" || result.body.status === "unauthenticated")
          return { status: "denied" }
        if (result.body.status === "stale" || result.body.status === "conflict" ||
            result.body.status === "provider-conflict") return { status: "stale" }
        if (result.body.status === "invalid" || result.body.status === "needs-input")
          return { status: "invalid-link" }
        return { status: result.status === 404 ? "not-found" : "unavailable" }
      }
      const projection = result.body.value.projection
      const stamp = projection.context
      if (!sameStamp(result.body.context, owner.stamp) ||
          stamp.installationId !== owner.stamp.installationId ||
          stamp.projectId !== owner.stamp.projectId ||
          stamp.principalRef !== owner.stamp.principalRef ||
          stamp.policyVersion !== owner.stamp.policyVersion ||
          stamp.accessRevision !== owner.stamp.accessRevision)
        return { status: "denied" }
      // Source caseRef is an opaque producer selector, not necessarily case.id.
      // Original sf_case_read owns that binding; never decode it as a local ID.
      if (!projection.case.id || !projection.case.incarnation)
        return { status: "invalid-link" }
      if (projection.case.version !== request.sourceVersion)
        return { status: "stale" }
      if (!liveOwner(owner, current)) return { status: "aborted" }

      // Q01 UI34 frozen entry template. F01 still independently authorizes it.
      const destination = "/orchestra/sf-decisions/" + encodeSfRouteRef(request.caseRef) +
        "?" + new URLSearchParams({
          server: owner.selection.serverKey,
          project: owner.selection.projectId,
          installation: owner.selection.installationId!,
        }).toString()
      const returnRef = navigation.rememberResumeFocus({
        ownerKey: owner.ownerKey,
        accessRevision: owner.stamp.accessRevision,
        caseRef: request.caseRef,
        sourceVersion: request.sourceVersion,
        returnHref: request.returnRoute.href,
      })
      let committed = false
      let preflightFailure: "aborted" | "denied" | "stale" | "not-found" | "invalid-link" | "unavailable" | undefined
      try {
        const transition = await navigation.requestNativeTransition(destination, "link", {
          signal,
          expectedOwnerKey: owner.ownerKey,
          admit: (route) => route.surfaceId === "UI34" && route.kind === "entry" &&
            route.params.caseRef === request.caseRef &&
            sameSelection(route.ownerSelection, owner.selection) &&
            liveOwner(owner, current),
          preCommit: async (_route, admissionSignal) => {
            if (signal.aborted || admissionSignal.aborted || !liveOwner(owner, current)) {
              preflightFailure = "aborted"
              return false
            }
            // Detect deletion, ID reuse and version drift occurring while F01
            // resolved the candidate. This is a real second original GET.
            const again = await createSfDecisionsClient(owner.transport)["projection.case"](
              { caseRef: request.caseRef }, { signal: admissionSignal },
            ).catch(() => undefined)
            if (signal.aborted || admissionSignal.aborted || !liveOwner(owner, current)) {
              preflightFailure = "aborted"
              return false
            }
            if (!again || again.kind !== "response") {
              preflightFailure = "unavailable"
              return false
            }
            if (again.body.status !== "ok") {
              preflightFailure = again.body.status === "denied" ||
                again.body.status === "unauthenticated" ? "denied"
                : again.body.status === "stale" || again.body.status === "conflict" ||
                  again.body.status === "provider-conflict" ? "stale"
                : again.body.status === "invalid" || again.body.status === "needs-input" ? "invalid-link"
                : again.status === 404 ? "not-found" : "unavailable"
              return false
            }
            const fresh = again.body.value.projection
            if (!sameStamp(again.body.context, owner.stamp) ||
                fresh.context.installationId !== owner.stamp.installationId ||
                fresh.context.projectId !== owner.stamp.projectId ||
                fresh.context.principalRef !== owner.stamp.principalRef ||
                fresh.context.policyVersion !== owner.stamp.policyVersion ||
                fresh.context.accessRevision !== owner.stamp.accessRevision) {
              preflightFailure = "denied"
              return false
            }
            if (fresh.case.id !== projection.case.id ||
                fresh.case.incarnation !== projection.case.incarnation ||
                fresh.case.version !== request.sourceVersion) {
              preflightFailure = "stale"
              return false
            }
            return true
          },
        })
        if (transition.status === "committed") committed = true
        return { status: transition.status === "denied" && preflightFailure
          ? preflightFailure : transition.status }
      } catch {
        return { status: signal.aborted ? "aborted" : "unavailable" }
      } finally {
        if (!committed) navigation.clearResumeFocus(returnRef)
      }
    },
  } satisfies SfTodayResumePort)
}
