import { expect, type Page, type Request } from "@playwright/test"

type PausedResponse = {
  requestId: string
  request: { url: string; method: string; postData?: string }
  responseStatusCode?: number
  responseHeaders?: { name: string; value: string }[]
}

/** Fail the original response after the installed handler answers, without issuing a replacement request. */
export async function loseClosureResponse(page: Page, origin: string, surface: "dashboard" | "procurement", action: "decision-choose" | "decision-apply") {
  const session = await page.context().newCDPSession(page)
  const completed = Promise.withResolvers<{ httpStatus: number; contentType: string; body: unknown; payload: unknown }>()
  const state = { responsePaused: false, closing: undefined as Promise<void> | undefined }
  const failed = (request: Request) => {
    if (request.url() === `${origin}/sucafina/${surface}?sf=${action}` && request.method() === "POST" && !state.responsePaused)
      completed.reject(new Error(`Closure failed before the original response could be intercepted: ${request.failure()?.errorText ?? "requestfailed"}`))
  }
  const closed = () => completed.reject(new Error("The page closed before the original closure response was intercepted"))
  const paused = async (event: PausedResponse) => {
    state.responsePaused = true
    try {
      expect(event.request.url).toBe(`${origin}/sucafina/${surface}?sf=${action}`)
      expect(event.request.method).toBe("POST")
      const contentType = event.responseHeaders?.find((header) => header.name.toLowerCase() === "content-type")?.value ?? ""
      const raw = await session.send("Fetch.getResponseBody", { requestId: event.requestId }) as { body: string; base64Encoded: boolean }
      const body: unknown = contentType.includes("application/json")
        ? JSON.parse(raw.base64Encoded ? Buffer.from(raw.body, "base64").toString("utf8") : raw.body) : undefined
      const payload: unknown = event.request.postData ? JSON.parse(event.request.postData) : undefined
      await session.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "ConnectionReset" })
      completed.resolve({ httpStatus: event.responseStatusCode ?? 0, contentType, body, payload })
    } catch (error) { completed.reject(error) }
  }
  const close = () => state.closing ??= (async () => {
    page.off("requestfailed", failed)
    page.off("close", closed)
    session.off("Fetch.requestPaused", paused)
    try { await session.send("Fetch.disable") }
    finally { await session.detach() }
  })()
  session.once("Fetch.requestPaused", paused)
  try {
    await session.send("Fetch.enable", { patterns: [{ urlPattern: `${origin}/sucafina/${surface}\\?sf=${action}`, requestStage: "Response" }] })
  } catch (error) {
    await close()
    throw error
  }
  page.on("requestfailed", failed)
  page.once("close", closed)
  return { completed: completed.promise, close }
}
