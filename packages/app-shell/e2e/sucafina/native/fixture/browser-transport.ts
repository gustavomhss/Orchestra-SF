/** Network observations from the ORIGINAL existing browser context. No copied credentials. */
import { randomUUID } from "node:crypto"
import { isIP } from "node:net"
import type { BrowserContext, Page, Response } from "@playwright/test"

type Binding = Readonly<{ origin: string; addresses: readonly string[] }>
const bindings = new WeakMap<BrowserContext, Binding>()
const observationHeader = "x-sf-native-observation"
function address(value: string) { return value.startsWith("::ffff:") ? value.slice(7) : value }

/** Called only after the installed host/process/tar observer has bound this private invocation. */
export function bindNativeBrowserContext(context: BrowserContext, origin: string, addresses: readonly string[]) {
  const url = new URL(origin)
  if (url.origin !== origin || url.protocol !== "https:" || !addresses.length ||
    addresses.some((value) => !isIP(address(value))) || new Set(addresses.map(address)).size !== addresses.length)
    throw new Error("F04_OBSERVED_HOST_PEER_REQUIRED")
  if (bindings.has(context)) throw new Error("F04_CONTEXT_ALREADY_BOUND")
  bindings.set(context, Object.freeze({ origin, addresses: Object.freeze(addresses.map(address)) }))
}
export function releaseNativeBrowserContext(context: BrowserContext) { bindings.delete(context) }

export async function requireNativePeer(page: Page, response: Response) {
  const bound = bindings.get(page.context())
  const peer = await response.serverAddr()
  if (!bound || new URL(response.url()).origin !== bound.origin || response.fromServiceWorker() ||
    response.request().serviceWorker() || response.request().redirectedFrom() || !peer ||
    peer.port !== 443 || !bound.addresses.includes(address(peer.ipAddress)))
    throw new Error("F04_ORIGINAL_BROWSER_PEER_NOT_RESERVED_HOST")
}
/** Observe the real Response before consuming any private bytes, including independent GETs. */
export async function nativeOriginalRequest(
  page: Page, url: string, method: "GET" | "POST" = "GET",
  body?: unknown, headers: Readonly<Record<string, string>> = {},
): Promise<Response> {
  const bound = bindings.get(page.context())
  if (!bound || new URL(page.url()).origin !== bound.origin || new URL(url).origin !== bound.origin ||
    Object.keys(headers).some((key) => !["x-sf-team-profile", "x-sf-access-revision", "x-sf-native-owner", "idempotency-key"].includes(key)) ||
    method === "GET" && body !== undefined)
    throw new Error("F04_ORIGINAL_BROWSER_BINDING_REQUIRED")
  const nonce = randomUUID(), serialized = body === undefined ? undefined : JSON.stringify(body)
  const [response] = await Promise.all([
    page.waitForResponse((reply) => reply.url() === url && reply.request().method() === method &&
      reply.request().headers()[observationHeader] === nonce),
    page.evaluate(async ({ url, method, serialized, nonce, observationHeader, headers }) => {
      await fetch(url, { method, credentials: "same-origin", redirect: "manual", cache: "no-store",
        signal: AbortSignal.timeout(30_000), headers: {
          ...headers, [observationHeader]: nonce, Accept: "application/json",
          ...(serialized === undefined ? {} : { "Content-Type": "application/json" }),
        }, ...(serialized === undefined ? {} : { body: serialized }) })
    }, { url, method, serialized, nonce, observationHeader, headers }),
  ])
  if (response.request().postData() !== (serialized ?? null) ||
    Object.entries(headers).some(([key, value]) => response.request().headers()[key] !== value))
    throw new Error("F04_ORIGINAL_REQUEST_CHANGED")
  await requireNativePeer(page, response)
  return response
}
/** Install the wait before the UI action; observer requests never satisfy the UI oracle. */
export async function nativeUIResponse(page: Page, url: string, method: "GET" | "POST", action: () => Promise<unknown>) {
  const expected = new URL(url)
  const response = async () => {
    const request = await page.waitForRequest((request) => {
      const actual = new URL(request.url())
      return request.method() === method && request.frame() === page.mainFrame() &&
        request.headers()[observationHeader] === undefined &&
        actual.origin === expected.origin && actual.pathname === expected.pathname &&
        actual.searchParams.size === expected.searchParams.size &&
        [...expected.searchParams].every(([key, value]) =>
          actual.searchParams.getAll(key).length === 1 && actual.searchParams.get(key) === value)
    })
    const reply = await request.response()
    if (!reply) throw new Error("F04_ORIGINAL_UI_RESPONSE_MISSING")
    await requireNativePeer(page, reply)
    return reply
  }
  const [reply] = await Promise.all([response(), action()])
  return reply
}
