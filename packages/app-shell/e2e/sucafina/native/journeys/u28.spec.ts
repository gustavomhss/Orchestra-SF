import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"

// Installed host only: no intercepted identity, fake backup, or synthetic success.
test.describe("N16 U28 local administration", () => {
  test("renders local rows only for the authenticated local operator", async ({ page, nativeHarness }) => {
    const { target } = nativeHarness.manifest
    const url = new URL("/orchestra/sf-home/administration", target.shellOrigin)
    await page.goto(url.toString())
    const chapter = page.locator('[data-sf-surface="UI69"]')
    await expect(chapter).toBeVisible()
    const local = chapter.locator('[data-sf-owner="local-operator"]')
    const forbidden = chapter.locator("[data-sf-backup], [data-sf-notification]")
    // A cloud identity never acquires a local-operator projection through UI69.
    const contextResponse = await page.request.get(new URL(target.mount + "/api/ui/context?" +
      new URLSearchParams({ installationId: target.installationId, projectId: target.projectId, hostId: target.hostId }),
      target.publicOrigin).toString(), { maxRedirects: 0, maxRetries: 0 })
    expect(contextResponse.status()).toBe(200)
    const context = await contextResponse.json() as { status: string; value?: { authMode: string } }
    expect(context.status).toBe("ok")
    if (context.value?.authMode === "local-operator") {
      await expect(local).toBeVisible()
      await expect(chapter.locator("#sf-u28-notifications")).toBeVisible()
      await expect(chapter.locator("#sf-u28-export")).toBeVisible()
      await expect(chapter.locator("#sf-u28-import")).toBeVisible()
      await expect(chapter.getByText("Currently unavailable")).toBeVisible()
    } else {
      await expect(chapter).toHaveAttribute("data-sf-owner", "not-authorized")
      await expect(forbidden).toHaveCount(0)
    }
  })
})
