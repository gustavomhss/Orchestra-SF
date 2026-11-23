import { expect } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"

/** Record real F01 denial separately from a rendered routine leaf. Neither the
 * planning catalog nor Schedule editor is admitted without its native readiness.
 */
export async function captureFinalRoutineGate(page: Page, info: TestInfo, state: string, area: "UI64" | "UI66" = "UI66") {
  if (!/^[a-z0-9-]{1,80}$/.test(state)) throw new Error("Use a stable gate capture name")
  await expectFinalRoutineGate(page, area)
  await expect(page.locator('[data-sf-frame="page"] .mx-page')).toHaveCount(1)
  await page.evaluate(async () => { await document.fonts.ready })
  const dimensions = await page.evaluate(() => {
    const scroller = document.querySelector('[data-sf-frame="page"] .mx-page')
    if (!(scroller instanceof HTMLElement)) throw new Error("The contextual routine page scroller is absent")
    return { width: window.innerWidth, height: window.innerHeight,
      documentWidth: document.documentElement.scrollWidth, pageWidth: scroller.scrollWidth, pageViewport: scroller.clientWidth }
  })
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.width + 1)
  expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.pageViewport + 1)
  await info.attach(area + "-" + state + "-f01-gate", {
    body: await page.screenshot({ type: "png", fullPage: true, animations: "disabled" }), contentType: "image/png",
  })
  const preview = await page.screenshot({ type: "jpeg", quality: 60, fullPage: false, animations: "disabled" })
  if (preview.byteLength > 393_216) throw new Error("The review preview exceeds its bounded log budget")
  console.info("SF_FINAL14_GATE_VISUAL " + JSON.stringify({
    area, state, pathname: new URL(page.url()).pathname, ...dimensions,
    surfaceRendered: false, boundary: area === "UI64" ? "F01-native-routine-planning-readiness-unavailable" : "F01-native-schedule-port-unavailable",
    mimeType: "image/jpeg", bytes: preview.byteLength, base64: preview.toString("base64"),
  }))
}

export async function expectFinalRoutineGate(page: Page, area: "UI64" | "UI66") {
  const host = page.locator('[data-sf-host="owner-runtime231"]')
  await expect(host).toHaveAttribute("data-sf-discovery-state", "ready")
  await expect(host).toHaveAttribute("data-sf-provider-state", "ready")
  await expect(host).toHaveAttribute("data-sf-view-state", "denied")
  await expect(page.locator(`[data-sf-surface="${area}"]`)).toHaveCount(0)
  await expect(page.locator(`[data-sf-route-unavailable="${area}"]`)).toBeVisible()
}
