import { expect } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"

type FinalSurface = "UI57" | "UI58" | "UI59" | "UI60" | "UI61" | "UI62" | "UI63" |
  "UI64" | "UI65" | "UI66" | "UI67" | "UI68" | "UI69" | "UI70"

/** Capture the installed page unchanged. Small log previews allow review through GitHub's text API. */
export async function captureFinalSurface(
  page: Page,
  info: TestInfo,
  area: FinalSurface,
  state: string,
  options: { preview?: boolean } = {},
) {
  if (!/^[a-z0-9-]{1,80}$/.test(state)) throw new Error("Use a stable capture state name")
  await expect(page.locator('[data-sf-surface="' + area + '"]')).toBeVisible()
  await page.evaluate(async () => { await document.fonts.ready })
  const dimensions = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    documentWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.documentWidth, area + " must not overflow the browser viewport").toBeLessThanOrEqual(dimensions.width + 1)
  const name = area + "-" + state
  const original = await page.screenshot({ type: "png", fullPage: true, animations: "disabled" })
  await info.attach(name, { body: original, contentType: "image/png" })
  const record = { area, state, pathname: new URL(page.url()).pathname, ...dimensions }
  console.info("SF_FINAL14_CAPTURE " + JSON.stringify(record))
  if (options.preview) {
    const preview = await page.screenshot({ type: "jpeg", quality: 60, fullPage: false, animations: "disabled" })
    if (preview.byteLength > 393_216) throw new Error("The review preview exceeds its bounded log budget")
    console.info("SF_FINAL14_VISUAL " + JSON.stringify({ ...record, mimeType: "image/jpeg", bytes: preview.byteLength, base64: preview.toString("base64") }))
  }
}
