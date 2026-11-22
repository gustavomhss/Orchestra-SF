/** F04 transport-only fault seams on the original, authenticated producer.
 * No route.fulfill mock, forged status/receipt, role override, or replay.
 */
import type { Page, Request, Response, Route } from "@playwright/test"
import { Schema } from "effect"
import { SfTeamContextResult } from "@orchestra/schema/sucafina/context"
import az02 from "../../../../../../sf/azure/identity/az02-proof.cjs"
import { nativeOriginalRequest } from "./browser-transport.ts"
import { observeNativeBinding, nativeContextURL } from "./readiness.ts"
import type { NativeManifest } from "./readiness.ts"

export type NativeFaultTarget = Readonly<{
  origin: string
  pathname: string
  method: "POST" | "GET"
  query?: Readonly<Record<string, string>>
  headers?: Readonly<Record<string, string>>
}>

function sameTarget(url: URL, target: NativeFaultTarget) {
  return url.origin === target.origin && url.pathname === target.pathname &&
    Object.entries(target.query ?? {}).every(([key, value]) => {
      const matches = url.searchParams.getAll(key)
      return matches.length === 1 && matches[0] === value
    })
}
function exactURL(request: Request, target: NativeFaultTarget) {
  return request.method() === target.method && sameTarget(new URL(request.url()), target) &&
    request.headers()["x-sf-native-observation"] === undefined &&
    Object.entries(target.headers ?? {}).every(([key, value]) => request.headers()[key] === value)
}
function requireFaultTarget(target: NativeFaultTarget) {
  const origin = new URL(target.origin)
  if (target.origin !== origin.origin || origin.username || origin.password ||
      !target.pathname.startsWith("/") || target.pathname.startsWith("//") ||
      Object.values(target.query ?? {}).some((value) => typeof value !== "string" || !value) ||
      Object.entries(target.headers ?? {}).some(([key, value]) =>
        key !== "x-sf-team-profile" || typeof value !== "string" || !value))
    throw new Error("F04_FAULT_TARGET_MUST_BE_EXACT_ORIGINAL_PRODUCER")
}

/** Let the original producer respond to ONE mutation, then discard its response.
 * A 2xx response is still NOT proof of durable commit or an approvable receipt.
 */
export async function armLostResponse(page: Page, target: NativeFaultTarget) {
  requireFaultTarget(target)
  if (target.method !== "POST") throw new Error("F04_LOST_RESPONSE_REQUIRES_EXPLICIT_POST")
  let attempts = 0
  let producerStatus: number | null = null
  let armed = true
  let pending: Promise<void> | undefined
  // A path regexp avoids intercepting unrelated requests; query/Team remain checked on the original Request.
  const escaped = (target.origin + target.pathname).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const matchesURL = new RegExp("^" + escaped + "(?:\\?.*)?$")
  const handler = (route: Route) => {
    if (!armed) return route.fallback()
    if (!exactURL(route.request(), target)) return route.continue()
    attempts++
    if (attempts !== 1) return route.continue()
    pending = (async () => {
      const actual = await route.fetch({ maxRedirects: 0, maxRetries: 0 })
      producerStatus = actual.status()
      await route.abort("failed")
    })()
    return pending
  }
  await page.route(matchesURL, handler)
  return {
    observations: () => {
      if (attempts !== 1 || producerStatus === null)
        throw new Error("F04_REAL_PRODUCER_RESPONSE_NOT_OBSERVED")
      return {
        phase: "RESPONSE_DELIVERY_LOST_AFTER_REAL_PRODUCER_STATUS" as const,
        attempts, producerStatus,
        producerCommit: "UNPROVEN_REQUIRES_ORIGINAL_AUTHORIZED_READ" as const,
        automaticRetryProhibited: true, outcomeUnknownUntilOriginalRead: true,
      }
    },
    // The owned Page closes at fixture teardown. Removing its last route while
    // readback is live can break Chromium interception; retain a passive fallback.
    dispose: async () => { armed = false; await pending },
  }
}

/** Hold exactly one real producer response until the caller confirms the
 * actual owner transition; waiting on the gate has no timer or fake body.
 */
export async function armHeldResponse(page: Page, target: NativeFaultTarget) {
  requireFaultTarget(target)
  let attempts = 0
  let producerStatus: number | null = null
  let armed = true
  let pending: Promise<void> | undefined
  let releaseResponse: () => void = () => {}
  const gate = new Promise<void>((resolve) => { releaseResponse = resolve })
  // A path regexp avoids intercepting unrelated requests; query/Team remain checked on the original Request.
  const escaped = (target.origin + target.pathname).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const matchesURL = new RegExp("^" + escaped + "(?:\\?.*)?$")
  const handler = (route: Route) => {
    if (!armed) return route.fallback()
    if (!exactURL(route.request(), target)) return route.continue()
    attempts++
    if (attempts !== 1) return route.continue()
    pending = (async () => {
      const response = await route.fetch({ maxRedirects: 0, maxRetries: 0 })
      producerStatus = response.status()
      await gate
      await route.fulfill({ response })
    })()
    return pending
  }
  await page.route(matchesURL, handler)
  return {
    observations: () => {
      if (attempts !== 1 || producerStatus === null)
        throw new Error("F04_HELD_REAL_PRODUCER_RESPONSE_NOT_OBSERVED")
      return {
        phase: "REAL_PRODUCER_RESPONSE_HELD" as const,
        attempts, producerStatus,
        ownerTransition: "REQUIRES_SEPARATE_INSTALLED_PRODUCER_PROOF" as const,
      }
    },
    release: () => releaseResponse(),
    // Disarm and settle this delivery without changing routing on the live Page.
    dispose: async () => { armed = false; releaseResponse(); await pending },
  }
}

/** Read only the already observed F02 refusal. Status alone is not evidence of
 * authentication loss; keep the producer's closed DTO and duplicate-key refusal.
 */
export async function requireNativeRevocationRefusal(
  response: Pick<Response, "status" | "headers" | "text">, origin: string,
): Promise<void> {
  const status = response.status(), headers = response.headers()
  if ((status !== 401 && status !== 403) ||
      headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json" ||
      headers["cache-control"]?.trim().toLowerCase() !== "no-store" ||
      headers.location !== undefined ||
      (headers["access-control-allow-origin"] !== undefined && headers["access-control-allow-origin"] !== origin))
    throw new Error("F04_ORIGINAL_REVOCATION_REFUSAL_NOT_PROVEN")
  try {
    const result = Schema.decodeUnknownSync(Schema.toCodecJson(SfTeamContextResult), { onExcessProperty: "error" })(
      az02.strictJson(await response.text()),
    )
    if (result.status === (status === 401 ? "unauthenticated" : "denied")) return
  } catch {
    // A malformed private response is a failed proof, never body text in a receipt.
  }
  throw new Error("F04_ORIGINAL_REVOCATION_REFUSAL_NOT_PROVEN")
}

/** Invoke only the real privileged producer action supplied by the approved
 * fixture, then demand an independent, same-cookie original context reread.
 * The callback's own committed bit is NOT accepted as a permission proof.
 */
export async function requestRealRevocation(input: Readonly<{
  page: Page
  manifest: Pick<NativeManifest, "target">
  capabilityId: string
  revokeViaProducer: () => Promise<{ committed: boolean }>
}>) {
  const before = await observeNativeBinding(input.page, input.manifest.target)
  if (!before.destinations.some((entry) => entry.capabilityId === input.capabilityId && entry.canRead))
    throw new Error("F04_REVOCATION_PRECONDITION_UNAUTHORIZED")
  const actual = await input.revokeViaProducer()
  if (!actual.committed) throw new Error("F04_REAL_PRODUCER_REVOCATION_NOT_CONFIRMED")
  const response = await nativeOriginalRequest(input.page, nativeContextURL(input.manifest.target))
  if (response.status() === 401 || response.status() === 403) {
    await requireNativeRevocationRefusal(response, input.manifest.target.publicOrigin)
    return { phase: "PRODUCER_AUTHENTICATION_REVOKED" as const,
      status: response.status(), clientProjection: "REQUIRES_SEPARATE_UI_ASSERTION" as const }
  }
  if (response.status() !== 200) throw new Error("F04_REVOCATION_REFETCH_UNAVAILABLE")
  const after = await observeNativeBinding(input.page, input.manifest.target)
  if (after.stamp.principalRef !== before.stamp.principalRef ||
      after.stamp.accessRevision === before.stamp.accessRevision ||
      after.destinations.some((entry) =>
        entry.capabilityId === input.capabilityId && entry.canRead))
    throw new Error("F04_REVOCATION_NOT_PROVEN_BY_ORIGINAL_CONTEXT")
  return {
    phase: "PRODUCER_ACCESS_REVOCATION_OBSERVED" as const,
    principalRef: before.stamp.principalRef,
    oldAccessRevision: before.stamp.accessRevision,
    newAccessRevision: after.stamp.accessRevision,
    clientProjection: "REQUIRES_SEPARATE_UI_ASSERTION" as const,
  }
}
