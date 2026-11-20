/** F04 prerequisities for U15/CAP14 and U39–U40/CAP04–05.
 * All access evidence is freshly read from the real installed host.
 * Navigation and a matching name never create a permission or identity.
 */
import type { Page } from "@playwright/test"
import { observeNativeBinding } from "./readiness.ts"
import { nativeOwnerQuery, nativeTeamRef } from "./manifest-contract.ts"
import type { NativeActor, NativeManifest, NativeTarget } from "./readiness.ts"
import type { NativeFaultTarget } from "./response-faults.ts"

export type NativeJourney = "CAP14" | "CAP04" | "CAP05"
export type NativeJourneyIntent = "read" | "readonly" | "edit" | "denied"

const routes: Readonly<Record<NativeJourney, Readonly<{
  entry: string
  sourcePage: string
  sourceSurface: "dashboard"
}>>> = {
  CAP14: { entry: "/orchestra/sf-procurement/contracts", sourcePage: "Vendor Contracts", sourceSurface: "dashboard" },
  CAP04: { entry: "/orchestra/sf-dashboard/opex", sourcePage: "OPEX Detail", sourceSurface: "dashboard" },
  CAP05: { entry: "/orchestra/sf-dashboard/capex", sourcePage: "CAPEX Projects", sourceSurface: "dashboard" },
}

export function nativeJourneyEntryHref(target: NativeTarget, capabilityId: NativeJourney, year?: number) {
  if (year !== undefined && (!Number.isSafeInteger(year) || year < 2024 || year > 2100))
    throw new Error("F04_INVALID_PRODUCER_YEAR")
  const url = new URL(routes[capabilityId].entry, target.shellOrigin)
  url.search = nativeOwnerQuery(target).toString()
  if (year !== undefined) url.searchParams.set("year", String(year))
  return url.toString()
}

/** Verify an href supplied by the real F01 route resolver, never construct a
 * record reference or infer authorization from the URL. */
export function nativeJourneyResolvedHref(
  target: NativeTarget, capabilityId: NativeJourney, resolvedHref: string,
) {
  const url = new URL(resolvedHref)
  if (url.origin !== target.shellOrigin || url.username || url.password ||
      url.hash || !url.pathname.startsWith(routes[capabilityId].entry + "/") ||
      url.pathname.includes("//"))
    throw new Error("F04_RESOLVED_SOURCE_ROUTE_OWNER_MISMATCH")
  const expected = nativeOwnerQuery(target)
  if ([...expected].some(([key, value]) => url.searchParams.getAll(key).length !== 1 || url.searchParams.get(key) !== value) ||
      [...url.searchParams.keys()].some((key) => !expected.has(key) && key !== "year"))
    throw new Error("F04_RESOLVED_SOURCE_ROUTE_OWNER_MISMATCH")
  return url.toString()
}

export function nativeDashboardCommandTarget(
  manifest: Pick<NativeManifest, "target">, capabilityId: NativeJourney,
): NativeFaultTarget {
  return {
    origin: manifest.target.publicOrigin,
    pathname: manifest.target.mount + "/dashboard",
    method: "POST",
    query: { page: routes[capabilityId].sourcePage },
  }
}

export async function requireNativeJourney(input: Readonly<{
  page: Page
  manifest: NativeManifest
  actor: NativeActor
  capabilityId: NativeJourney
  intent: NativeJourneyIntent
  year?: number
}>) {
  const expectedPrincipal = input.manifest.actors[input.actor]
  if (!expectedPrincipal) throw new Error("F04_REAL_" + input.actor.toUpperCase() + "_IDENTITY_REQUIRED")
  if (input.actor === "denied" && input.intent !== "denied")
    throw new Error("F04_DENIED_ACTOR_CANNOT_BE_SELECTED_AS_AUTHORIZED")
  if (input.intent === "denied" && input.actor !== "denied")
    throw new Error("F04_NEGATIVE_JOURNEY_REQUIRES_DENIED_IDENTITY")
  const live = await observeNativeBinding(input.page, input.manifest.target)
  if (live.authMode !== "microsoft")
    throw new Error("F04_DISTINCT_ACTORS_REQUIRE_REAL_MICROSOFT_IDENTITY")
  if (live.stamp.principalRef !== expectedPrincipal)
    throw new Error("F04_INSTALLED_CONTEXT_ACTOR_MISMATCH")
  const route = routes[input.capabilityId]
  const allowed = live.destinations.find((entry) =>
    entry.capabilityId === input.capabilityId &&
    entry.page === route.sourcePage && entry.surface === route.sourceSurface)
  if (input.intent === "denied") {
    if (allowed?.canRead) throw new Error("F04_NEGATIVE_ACTOR_HAS_CAPABILITY_READ")
  } else {
    if (!allowed?.canRead || !live.stamp.team) throw new Error("F04_CURRENT_PRODUCER_CAPABILITY_READ_DENIED")
    if (input.intent === "readonly" && allowed.allowedActionIds.includes("save"))
      throw new Error("F04_READONLY_ACTOR_HAS_CURRENT_SAVE")
    if (input.intent === "edit" && !allowed.allowedActionIds.includes("save"))
      throw new Error("F04_CURRENT_PRODUCER_SAVE_NOT_AUTHORIZED")
  }
  return {
    proofClass: "INSTALLED_CURRENT_CONTEXT_PRECONDITION_ONLY" as const,
    href: nativeJourneyEntryHref(input.manifest.target, input.capabilityId, input.year),
    capabilityId: input.capabilityId,
    principalRef: live.stamp.principalRef, tenantId: live.profile.principal.tenantId,
    profile: nativeTeamRef(input.manifest.target),
    policyVersion: live.stamp.policyVersion,
    accessRevision: live.stamp.accessRevision,
    canRead: allowed?.canRead ?? false,
    canSave: allowed?.allowedActionIds.includes("save") ?? false,
    candidateSha: input.manifest.candidateSha,
    originalProducerTarget: nativeDashboardCommandTarget(input.manifest, input.capabilityId),
    desktop: "NOT_RUN_D01_REAL_ELECTRON_REQUIRED" as const,
  }
}
