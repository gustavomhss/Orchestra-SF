import type { Locator, Page, Request, Response } from "@playwright/test"

/** Observe the original UI request. A transport failure cannot produce a later response. */
export async function clickForResponse(page: Page, button: Locator, matches: (request: Request) => boolean) {
  const pending = Promise.withResolvers<Response>()
  const matching = (request: Request) => {
    try { return matches(request) } catch (error) { pending.reject(error); return false }
  }
  const responded = (response: Response) => {
    if (matching(response.request())) pending.resolve(response)
  }
  const failed = (request: Request) => {
    if (matching(request)) pending.reject(new Error(`The original UI request failed before a response: ${request.failure()?.errorText ?? "requestfailed"}`))
  }
  page.on("response", responded)
  page.on("requestfailed", failed)
  try {
    const [response] = await Promise.all([pending.promise, button.click()])
    return response
  } finally {
    page.off("response", responded)
    page.off("requestfailed", failed)
  }
}
