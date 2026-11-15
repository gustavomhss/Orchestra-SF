import type { Locator, Page, Request, Response } from "@playwright/test"

/** Read the original response before a successful UI command navigates away. */
export async function clickForResponse<T>(page: Page, button: Locator, matches: (request: Request) => boolean,
  read: (response: Response) => Promise<T>) {
  const pending = Promise.withResolvers<T>()
  const matching = (request: Request) => {
    try { return matches(request) } catch (error) { pending.reject(error); return false }
  }
  const responded = (response: Response) => {
    if (!matching(response.request())) return
    page.off("response", responded)
    try { pending.resolve(read(response)) } catch (error) { pending.reject(error) }
  }
  const failed = (request: Request) => {
    if (matching(request)) pending.reject(new Error(`The original UI request failed before a response: ${request.failure()?.errorText ?? "requestfailed"}`))
  }
  page.on("response", responded)
  page.on("requestfailed", failed)
  try {
    const [result] = await Promise.all([pending.promise, button.click()])
    return result
  } finally {
    page.off("response", responded)
    page.off("requestfailed", failed)
  }
}
