import type { BrowserContext, Page } from "@playwright/test"

export type NativeFetchResponse = {
  method: string
  url: string
  status: number
  requestBody: unknown
  idempotencyKey?: string
  body: unknown
  error?: string
}
export type NativeFetchCapture = (page: Page, matches: (response: NativeFetchResponse) => boolean) => Promise<NativeFetchResponse>

type Endpoint = { method: "GET" | "POST"; path: string; sf?: string }

// Observe the actual browser fetch before its consumer can cancel a completed
// read or navigate away. Chromium's later Network.getResponseBody lookup does
// not retain every such response. No request or response is replaced or replayed.
export async function observeNativeFetch(context: BrowserContext, input: {
  origin: string
  endpoints: Endpoint[]
  timeoutMs: number
}): Promise<NativeFetchCapture> {
  type Waiter = { page: Page; matches: (response: NativeFetchResponse) => boolean;
    complete: (response: NativeFetchResponse) => void; close: () => void }
  const pending = new Set<Waiter>()
  const capture: NativeFetchCapture = (page, matches) => new Promise((resolve, reject) => {
    const finish = () => { clearTimeout(timeout); pending.delete(waiter) }
    const waiter: Waiter = { page, matches,
      complete: (response) => {
        finish()
        if (response.error) reject(new Error(response.error))
        else resolve(response)
      },
      close: () => { finish(); reject(new Error("Browser context closed before the real native response")) },
    }
    const timeout = setTimeout(() => {
      pending.delete(waiter)
      reject(new Error("Timed out after " + input.timeoutMs + " ms waiting for the real native response"))
    }, input.timeoutMs)
    pending.add(waiter)
  })
  await context.exposeBinding("__sfNativeFetchResponse", (source, response: NativeFetchResponse) => {
    for (const waiter of [...pending]) {
      if (source.page === waiter.page && waiter.matches(response)) waiter.complete(response)
    }
  })
  context.on("close", () => { for (const waiter of [...pending]) waiter.close() })
  await context.addInitScript(({ origin, endpoints }) => {
    const originalFetch = globalThis.fetch
    const bridge = (globalThis as unknown as {
      __sfNativeFetchResponse: (response: NativeFetchResponse) => Promise<void>
    }).__sfNativeFetchResponse
    globalThis.fetch = async function (this: unknown, ...args: Parameters<typeof fetch>) {
      const [input, init] = args
      const url = new URL(input instanceof Request ? input.url : String(input), location.href)
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()
      const observed = url.origin === origin && endpoints.some((entry) => entry.method === method &&
        entry.path === url.pathname && (entry.sf === undefined || url.searchParams.get("sf") === entry.sf))
      if (!observed) return Reflect.apply(originalFetch, this, args)
      // Read only a copy of Request input, before the genuine fetch may consume it.
      const requestText = method === "POST"
        ? typeof init?.body === "string" ? Promise.resolve(init.body)
          : input instanceof Request && init?.body === undefined ? input.clone().text() : Promise.resolve("")
        : Promise.resolve("")
      const idempotencyKey = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
        .get("idempotency-key") ?? undefined
      const response = await Reflect.apply(originalFetch, this, args)
      let requestBody: unknown
      try {
        const text = await requestText
        requestBody = text ? JSON.parse(text) : undefined
        const body: unknown = await response.clone().json()
        await bridge({ method, url: response.url, status: response.status, requestBody, idempotencyKey, body })
      } catch (error) {
        // A genuine abort/clone/parse error fails the matching observer. It never
        // triggers another fetch or fabricates a body for the installed consumer.
        await bridge({ method, url: response.url, status: response.status, requestBody, idempotencyKey, body: undefined,
          error: error instanceof Error ? error.message : String(error) }).catch(() => {})
      }
      return response
    }
  }, { origin: input.origin, endpoints: input.endpoints })
  return capture
}
