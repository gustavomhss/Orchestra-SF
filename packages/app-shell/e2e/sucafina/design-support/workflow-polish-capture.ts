import { expect, type Page, type TestInfo } from "@playwright/test"
import { capture, reflow, scheme, scrollPageTop } from "./wave-three"

export type WorkflowCheckpoint = {
  surface: string
  state: string
  evidence: string
  attributes?: Readonly<Record<string, string>>
  focus?: string
}
export type WorkflowCapture = (page: Page, info: TestInfo, checkpoint: WorkflowCheckpoint) => Promise<void>

/**
 * Call only after the original journey has asserted its source and visible result.
 * Artifacts require visual review; they do not qualify an unavailable producer.
 * Theme and viewport changes never create data, credentials, grants or receipts.
 */
export const captureWorkflowState: WorkflowCapture = async (page, info, checkpoint) => {
  const surface = page.locator("[data-sf-surface=" + JSON.stringify(checkpoint.surface) + "]")
  const originalViewport = page.viewportSize()
  const originalScheme = await page.locator("html").getAttribute("data-color-scheme")
  const verify = async () => {
    await expect(surface).toHaveCount(1)
    await expect(surface).toBeVisible()
    await expect(page.locator('[data-sf-frame="page"]')).toHaveCount(1)
    await expect(surface.locator('[aria-busy="true"]')).toHaveCount(0)
    for (const [attribute, value] of Object.entries(checkpoint.attributes ?? {}))
      await expect(surface).toHaveAttribute(attribute, value)
  }
  await verify()
  const observed = await surface.evaluate((element) => ({
    readState: element.getAttribute("data-sf-read-state"),
    state: element.getAttribute("data-state"),
    phase: element.getAttribute("data-sf-phase") ?? element.getAttribute("data-phase"),
    panels: [...element.querySelectorAll("[data-sf-state]")].map((panel) => panel.getAttribute("data-sf-state")),
    headings: [...element.querySelectorAll("h2,h3")].map((heading) => heading.textContent?.trim()),
  }))
  const name = checkpoint.surface + "-" + checkpoint.state
  await info.attach(name + "-source-state", {
    contentType: "application/json",
    body: JSON.stringify({
      surface: checkpoint.surface, state: checkpoint.state, evidence: checkpoint.evidence,
      route: new URL(page.url()).pathname, observed, source: "original isolated installed producer",
      syntheticSuccess: false, liveMicrosoftClaimed: false, visualApprovalClaimed: false,
      variants: ["dark-desktop", "light-desktop", "dark-320"],
    }, null, 2),
  })
  try {
    for (const variant of [
      { scheme: "dark", width: 1440, height: 1100, name: "dark-desktop" },
      { scheme: "light", width: 1440, height: 1100, name: "light-desktop" },
      { scheme: "dark", width: 320, height: 800, name: "dark-320" },
    ] as const) {
      await page.setViewportSize({ width: variant.width, height: variant.height })
      await scheme(page, variant.scheme)
      await verify()
      await reflow(page)
      await scrollPageTop(page)
      if (checkpoint.focus) {
        const focus = surface.locator(checkpoint.focus)
        await expect(focus).toHaveCount(1)
        await expect(focus).toBeVisible()
        await focus.scrollIntoViewIfNeeded()
      }
      await capture(page, info, name + "-" + variant.name)
    }
  } finally {
    if (originalViewport) await page.setViewportSize(originalViewport)
    if (originalScheme === "dark" || originalScheme === "light") await scheme(page, originalScheme)
    await scrollPageTop(page)
  }
}
