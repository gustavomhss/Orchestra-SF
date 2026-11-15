import { expect, type Page, type Request } from "@playwright/test"

type PausedResponse = {
  requestId: string
  request: { url: string; method: string; postData?: string }
  responseStatusCode?: number
  responseHeaders?: { name: string; value: string }[]
}

/** Drop the browser's original response after the real server answered; never resend the command. */
export async function loseCreationResponse(page: Page, origin: string) {
  const session = await page.context().newCDPSession(page)
  const completed = Promise.withResolvers<{ httpStatus: number; contentType: string; body: unknown; payload: unknown }>()
  const state = { responsePaused: false }
  const failed = (request: Request) => {
    if (request.url() === `${origin}/sucafina/dashboard?sf=workbench-command` && request.method() === "POST" && !state.responsePaused)
      completed.reject(new Error(`Creation failed before the original response could be intercepted: ${request.failure()?.errorText ?? "requestfailed"}`))
  }
  const listener = async (event: PausedResponse) => {
    state.responsePaused = true
    try {
      const payload: unknown = event.request.postData ? JSON.parse(event.request.postData) : undefined
      expect(event.request.url).toBe(`${origin}/sucafina/dashboard?sf=workbench-command`)
      expect(event.request.method).toBe("POST")
      expect(payload).toMatchObject({ operation: "sf_case_draft" })
      const contentType = event.responseHeaders?.find((header) => header.name.toLowerCase() === "content-type")?.value ?? ""
      const raw = await session.send("Fetch.getResponseBody", { requestId: event.requestId }) as { body: string; base64Encoded: boolean }
      const body: unknown = contentType.includes("application/json")
        ? JSON.parse(raw.base64Encoded ? Buffer.from(raw.body, "base64").toString("utf8") : raw.body) : undefined
      await session.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "ConnectionReset" })
      completed.resolve({ httpStatus: event.responseStatusCode ?? 0, contentType, body, payload })
    } catch (error) {
      completed.reject(error)
    }
  }
  page.on("requestfailed", failed)
  session.once("Fetch.requestPaused", listener)
  await session.send("Fetch.enable", { patterns: [{ urlPattern: `${origin}/sucafina/dashboard\\?sf=workbench-command`, requestStage: "Response" }] })
  return { completed: completed.promise, close: async () => { page.off("requestfailed", failed); await session.send("Fetch.disable"); await session.detach() } }
}
