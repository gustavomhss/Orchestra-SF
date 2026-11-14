import { expect, type Page } from "@playwright/test"

type PausedResponse = {
  requestId: string
  request: { url: string; method: string; postData?: string }
  responseStatusCode?: number
  responseHeaders?: { name: string; value: string }[]
}

/** Lose the original alternative response after its real handler answered; never replay or fabricate it. */
export async function loseAlternativeResponse(page: Page, origin: string) {
  const session = await page.context().newCDPSession(page)
  const completed = Promise.withResolvers<{ httpStatus: number; contentType: string; body: unknown; payload: unknown }>()
  session.once("Fetch.requestPaused", async (event: PausedResponse) => {
    try {
      expect(event.request.url).toBe(`${origin}/sucafina/dashboard?sf=decision-promote`)
      expect(event.request.method).toBe("POST")
      const payload: unknown = event.request.postData ? JSON.parse(event.request.postData) : undefined
      const contentType = event.responseHeaders?.find((header) => header.name.toLowerCase() === "content-type")?.value ?? ""
      const raw = await session.send("Fetch.getResponseBody", { requestId: event.requestId }) as { body: string; base64Encoded: boolean }
      const body: unknown = contentType.includes("application/json")
        ? JSON.parse(raw.base64Encoded ? Buffer.from(raw.body, "base64").toString("utf8") : raw.body) : undefined
      await session.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "ConnectionReset" })
      completed.resolve({ httpStatus: event.responseStatusCode ?? 0, contentType, body, payload })
    } catch (error) { completed.reject(error) }
  })
  await session.send("Fetch.enable", { patterns: [{ urlPattern: `${origin}/sucafina/dashboard\\?sf=decision-promote`, requestStage: "Response" }] })
  return { completed: completed.promise, close: async () => { await session.send("Fetch.disable"); await session.detach() } }
}
