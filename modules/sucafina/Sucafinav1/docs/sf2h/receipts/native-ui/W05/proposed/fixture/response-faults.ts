// PROPOSED SOURCE: destination packages/app-shell/e2e/sucafina/native/fixture/response-faults.ts
import type { Page, Request, Route } from "@playwright/test"

/** Faults affect only the delivery layer. Always let the original producer run.
 * No fabricated HTTP 401/403, ACL decision, receipt, financial or scanner result.
 */
export type NativeFaultTarget = Readonly<{
  origin: string
  pathname: string
  method: "POST" | "GET"
}>

function exactURL(request: Request, target: NativeFaultTarget): boolean {
  const url = new URL(request.url())
  return request.method() === target.method && url.origin === target.origin && url.pathname === target.pathname
}

export async function armLostResponse(page: Page, target: NativeFaultTarget) {
  if (target.method !== "POST") throw new Error("F04_LOST_RESPONSE_REQUIRES_EXPLICIT_POST")
  let attempts = 0
  let producerStatus: number | null = null
  const matchesURL = (url: URL) => url.origin === target.origin && url.pathname === target.pathname
  const handler = async (route: Route) => {
    if (!exactURL(route.request(), target)) return await route.continue()
    attempts++
    if (attempts !== 1) return await route.continue()
    const actual = await route.fetch({ maxRedirects: 0, maxRetries: 0 })
    producerStatus = actual.status()
    // Real mutation has already reached the producer. The response is *not*
    // delivered, and the client must use its original canonical recovery.
    await route.abort("failed")
  }
  await page.route(matchesURL, handler)
  return {
    observations: () => ({ phase: "DELIVERY_LOST_AFTER_REAL_PRODUCER", attempts, producerStatus,
      automaticRetryProhibited: true, outcomeUnknownUntilOriginalRead: true }),
    dispose: () => page.unroute(matchesURL, handler),
  }
}

/** Deterministic held response: release after an observed owner transition.
 * No sleep, timer, fake body, or synthetic auth status.
 */
export async function armHeldResponse(page: Page, target: NativeFaultTarget) {
  let attempts = 0
  let releaseResponse: () => void = () => {}
  const gate = new Promise<void>((resolve) => { releaseResponse = resolve })
  const matchesURL = (url: URL) => url.origin === target.origin && url.pathname === target.pathname
  const handler = async (route: Route) => {
    if (!exactURL(route.request(), target)) return await route.continue()
    attempts++
    if (attempts !== 1) return await route.continue()
    const response = await route.fetch({ maxRedirects: 0, maxRetries: 0 })
    await gate
    await route.fulfill({ response })
  }
  await page.route(matchesURL, handler)
  return {
    observations: () => ({ phase: "REAL_RESPONSE_HELD_FOR_OWNER_TRANSITION", attempts }),
    release: () => releaseResponse(),
    dispose: async () => { releaseResponse(); await page.unroute(matchesURL, handler) },
  }
}

/** Revocation MUST occur in the actual authenticated producer. This helper
 * never emulates it by returning 403 or by mutating local client state.
 */
export async function requestRealRevocation(revokeViaProducer: () => Promise<{ committed: boolean }>) {
  const actual = await revokeViaProducer()
  if (!actual.committed) throw new Error("F04_REAL_PRODUCER_REVOCATION_NOT_CONFIRMED")
  return { phase: "REVOCATION_IN_REAL_PRODUCER_CONFIRMED", clientProjection: "REQUIRES_SEPARATE_UI_ASSERTION" } as const
}
