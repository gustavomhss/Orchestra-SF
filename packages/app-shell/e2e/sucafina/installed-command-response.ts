import { expect } from "@playwright/test"
import type { APIResponse, Locator, Page, Route } from "@playwright/test"

type CommandCapture = { forward(route: Route): Promise<void>; reject(reason: Error): void }
type CommandInterceptor = { endpoint: string; ready: Promise<void>; active?: CommandCapture }
const commandInterceptors = new WeakMap<Page, CommandInterceptor>()

/** Chromium enables CDP Fetch for all requests while any Playwright route exists.
 * Keep this endpoint's route until Page closure: removing the last route during
 * command delivery can strand the automatic authorized readback. Other requests and
 * commands outside the one active capture continue through the normal handlers. */
async function commandInterceptor(page: Page, endpoint: URL) {
  let state = commandInterceptors.get(page)
  if (state) {
    if (state.endpoint !== endpoint.href) throw new Error("A command Page cannot switch command endpoints")
    await state.ready
    return state
  }
  state = { endpoint: endpoint.href, ready: Promise.resolve() }
  commandInterceptors.set(page, state)
  const owned = state
  const routePattern = new RegExp("^" + endpoint.href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:\\?|$)")
  owned.ready = page.route(routePattern, (route) => owned.active
    ? owned.active.forward(route) : route.fallback()).then(() => undefined)
  page.once("close", () => {
    // Closing the Page disposes its route; never toggle interception while live.
    commandInterceptors.delete(page)
    const active = owned.active
    owned.active = undefined
    active?.reject(new Error("Command Page closed before command capture completed"))
  })
  try {
    await owned.ready
  } catch (error) {
    if (commandInterceptors.get(page) === owned) commandInterceptors.delete(page)
    throw error
  }
  return owned
}

type CommandMatch = { page?: unknown; action?: unknown; id?: unknown } | null

export async function captureInstalledCommand(page: Page, endpoint: URL, confirm: Locator, expected: {
  page: string; action: string; id?: string; version?: number; values?: Record<string, unknown>
}, options: {
  beforeDelivery?: (response: APIResponse) => Promise<void>
  /** Preserve a caller's original command predicate when it did not match an ID. */
  matchesCommand?: (command: CommandMatch) => boolean
} = {}) {
  const beforeDelivery = options.beforeDelivery
  const interceptor = await commandInterceptor(page, endpoint)
  if (interceptor.active) throw new Error("Concurrent command captures on one Page are not allowed")
  const match = (url: URL) => url.origin === endpoint.origin && url.pathname === endpoint.pathname &&
    url.searchParams.size === 1 && url.searchParams.get("page") === expected.page
  const producer = Promise.withResolvers<{ response: APIResponse; command: unknown }>()
  void producer.promise.catch(() => undefined)
  let posts = 0
  const forward = async (route: Route) => {
    const request = route.request()
    if (request.method() !== "POST" || !match(new URL(request.url()))) return route.fallback()
    try {
      const command = request.postDataJSON() as { page?: unknown; action?: unknown; id?: unknown } | null
      const matched = options.matchesCommand?.(command) ??
        (command?.page === expected.page && command.action === expected.action && command.id === expected.id)
      if (!matched) return route.fallback()
      expect(++posts, `one ${expected.page} ${expected.action} POST per confirmation`).toBe(1)
      expect(command).toMatchObject(expected)
      // Retain the real response before Chromium can discard its copy during readback.
      const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
      try {
        await beforeDelivery?.(response)
      } finally {
        await route.fulfill({ response })
      }
      producer.resolve({ response, command })
    } catch (error) {
      producer.reject(error)
      await route.abort("failed").catch(() => undefined)
    }
  }
  const capture: CommandCapture = { forward, reject: producer.reject }
  interceptor.active = capture
  try {
    const [{ response, command }] = await Promise.all([producer.promise, confirm.click()])
    const body: unknown = await response.json()
    expect(posts).toBe(1)
    return { status: response.status(), contentType: response.headers()["content-type"], body, command }
  } finally {
    if (interceptor.active === capture) interceptor.active = undefined
  }
}

