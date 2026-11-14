import type { Page } from "@playwright/test"
import { localBrowser } from "../../fixture/local-browser.ts"

/** Keep browser waits inside the test lifetime so the shared listener is always released. */
export async function inspectWp05Browser(label: string, inspect: (page: Page, phase: (name: string) => void) => Promise<void>) {
  const fixture = await localBrowser()
  const deadline = {
    milliseconds: 60000,
    phase: "navigate",
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
    error: undefined as Error | undefined,
  }
  const phase = (name: string) => {
    if (deadline.error) throw deadline.error
    deadline.phase = name
  }
  try {
    const expired = new Promise<never>((_, reject) => {
      deadline.timer = setTimeout(() => {
        deadline.error = new Error(`WP05 browser ${label} exceeded ${deadline.milliseconds}ms during ${deadline.phase}`)
        reject(deadline.error)
      }, deadline.milliseconds)
    })
    const body = async () => {
      // Reuse the fixture's enrolled page instead of leaving it alive in a second context.
      const page = fixture.page
      page.setDefaultTimeout(10000)
      page.setDefaultNavigationTimeout(10000)
      await page.goto("about:blank")
      phase("inspect")
      await inspect(page, phase)
    }
    // The race retains rejection handlers if closing the browser rejects a pending operation.
    await Promise.race([body(), expired])
  } finally {
    if (deadline.timer) clearTimeout(deadline.timer)
    await fixture.dispose()
  }
}
