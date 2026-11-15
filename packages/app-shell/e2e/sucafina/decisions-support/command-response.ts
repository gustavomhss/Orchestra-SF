import type { Locator, Page, Request, Response } from "@playwright/test"

type CommandRequest = Pick<Request, "url" | "method" | "postDataJSON">
export type CommandResponse = Pick<Response, "url" | "status" | "headers" | "json">
type PausedResponse = {
  requestId: string
  request: { url: string; method: string; postData?: string; headers: Record<string, string> }
  responseStatusCode?: number
  responseErrorReason?: string
  responseHeaders?: { name: string; value: string }[]
}

/** Copy the original response while paused, then resume it unchanged; never replay a UI command. */
export async function clickForResponse<T>(page: Page, button: Locator, urlPattern: string, matches: (request: CommandRequest) => boolean,
  read: (response: CommandResponse) => Promise<T>) {
  const session = await page.context().newCDPSession(page)
  const pending = Promise.withResolvers<T>()
  const running = new Set<Promise<void>>()
  let claimed = false
  let closing = false
  const capture = async (event: PausedResponse) => {
    const request: CommandRequest = {
      url: () => event.request.url,
      method: () => event.request.method,
      postDataJSON: () => {
        if (!event.request.postData) return null
        const type = Object.entries(event.request.headers).find(([name]) => name.toLowerCase() === "content-type")?.[1] ?? ""
        return type.includes("application/x-www-form-urlencoded")
          ? Object.fromEntries(new URLSearchParams(event.request.postData)) : JSON.parse(event.request.postData)
      },
    }
    if (closing || claimed || !matches(request)) return
    claimed = true
    if (event.responseErrorReason) throw new Error(`The original UI response failed: ${event.responseErrorReason}`)
    if ([301, 302, 303, 307, 308].includes(event.responseStatusCode ?? 0) && event.responseHeaders?.some(({ name }) => name.toLowerCase() === "location"))
      throw new Error(`The original UI response redirected with HTTP ${event.responseStatusCode}; its body is unavailable`)
    const raw = await session.send("Fetch.getResponseBody", { requestId: event.requestId }) as { body: string; base64Encoded: boolean }
    const body = raw.base64Encoded ? Buffer.from(raw.body, "base64").toString("utf8") : raw.body
    const headers = Object.fromEntries((event.responseHeaders ?? []).map(({ name, value }) => [name.toLowerCase(), value]))
    const response: CommandResponse = {
      url: () => event.request.url,
      status: () => event.responseStatusCode ?? 0,
      headers: () => headers,
      json: async () => JSON.parse(body),
    }
    return { value: await read(response) }
  }
  const paused = (event: PausedResponse) => {
    const task = capture(event)
      .then((value) => ({ status: "fulfilled" as const, value }), (reason: unknown) => ({ status: "rejected" as const, reason }))
      .then(async (outcome) => {
        try { await session.send("Fetch.continueRequest", { requestId: event.requestId }) }
        catch (error) {
          pending.reject(outcome.status === "rejected"
            ? new AggregateError([outcome.reason, error], "Original response capture and continuation failed") : error)
          return
        }
        if (outcome.status === "rejected") pending.reject(outcome.reason)
        else if (outcome.value) pending.resolve(outcome.value.value)
      })
      .catch((error: unknown) => { pending.reject(error) })
    running.add(task)
    void task.then(() => { running.delete(task) })
  }
  const failed = (request: Request) => {
    try {
      if (matches(request)) pending.reject(new Error(`The original UI request failed before a response: ${request.failure()?.errorText ?? "requestfailed"}`))
    } catch (error) { pending.reject(error) }
  }
  page.on("requestfailed", failed)
  session.on("Fetch.requestPaused", paused)
  try {
    await session.send("Fetch.enable", { patterns: [{ urlPattern, requestStage: "Response" }] })
    const [result] = await Promise.all([pending.promise, button.click()])
    return result
  } finally {
    closing = true
    page.off("requestfailed", failed)
    // Fetch must stay enabled until every body read and original-response continuation completes.
    await Promise.all(running)
    try { await session.send("Fetch.disable") }
    finally { session.off("Fetch.requestPaused", paused); await Promise.all(running); await session.detach() }
  }
}
