import { expect, test } from "@playwright/test"
import { startPlannerInstallation } from "./installation-fixture"

test.use({ trace: "off", video: "off" })

test("the real installed operator reaches native CAP23 through the shell origin", async ({ page }, info) => {
  const installation = await test.step("Launch the real isolated installation", () => startPlannerInstallation(info))
  try {
    const live = await test.step("Discover and select the original installed context", () => installation.signIn(page))
    await page.goto("/orchestra/sf-planner/versions")
    await expect(page.locator('[data-sf-surface="CAP23"]')).toBeVisible()
    expect(new URL(page.url()).origin).toBe(installation.origin)
    expect(live.context.stamp.principalRef).toBe(installation.actorId)
    await page.reload()
    await expect(page.locator('[data-sf-surface="CAP23"]')).toBeVisible()
    await page.goto("/orchestra/sf-planner/versions?year=2026")
    await expect(page.locator('[data-sf-surface="CAP23"]')).toBeVisible()
  } finally {
    await installation.stop()
  }
})
