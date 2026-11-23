import { expect } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"

/** Record the real F01 denial separately from a rendered UI66 capture. This does
 * not claim the Schedule leaf or editor was rendered without its native port.
 */
export async function captureFinalRoutineGate(page: Page, info: TestInfo, state: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(state)) throw new Error("Use a stable gate capture name")
  const host = page.locator('[data-sf-host="owner-runtime231"]')
  await expect(host).toHaveAttribute("data-sf-discovery-state", "ready")
  await expect(host).toHaveAttribute("data-sf-provider-state", "ready")
  await expect(host).toHaveAttribute("data-sf-view-state", "denied")
  await expect(page.locator('[data-sf-surface="UI66"]')).toHaveCount(0)
  await page.evaluate(async () => { await document.fonts.ready })
  const dimensions = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight,
    documentWidth: document.documentElement.scrollWidth }))
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.width + 1)
  await info.attach("UI66-" + state + "-f01-gate", {
    body: await page.screenshot({ type: "png", fullPage: true, animations: "disabled" }), contentType: "image/png",
  })
  const preview = await page.screenshot({ type: "jpeg", quality: 60, fullPage: false, animations: "disabled" })
  if (preview.byteLength > 393_216) throw new Error("The review preview exceeds its bounded log budget")
  console.info("SF_FINAL14_GATE_VISUAL " + JSON.stringify({
    area: "UI66", state, pathname: new URL(page.url()).pathname, ...dimensions,
    surfaceRendered: false, boundary: "F01-native-schedule-port-unavailable",
    mimeType: "image/jpeg", bytes: preview.byteLength, base64: preview.toString("base64"),
  }))
}
