import { expect } from "@playwright/test"
import type { BrowserContext, Page, TestInfo } from "@playwright/test"

/** Reorder genuine authorized HTTP responses; no fabricated payload, identity, or product write. */
export async function prepareWp10ReviewRevocation(input: { context: BrowserContext; url: string; testInfo: TestInfo }) {
  const pages: Page[] = []
  let releaseSource = () => {}, releaseUpdate = () => {}
  const sourceRelease = new Promise<void>((resolve) => { releaseSource = resolve })
  const updateRelease = new Promise<void>((resolve) => { releaseUpdate = resolve })
  const dispose = async () => {
    releaseSource(); releaseUpdate()
    await Promise.all(pages.map((page) => page.close().catch(() => undefined)))
  }
  try {
    const sourceLate = await input.context.newPage(), sourceDenied = await input.context.newPage(), readDenied = await input.context.newPage()
    pages.push(sourceLate, sourceDenied, readDenied)
    for (const page of pages) {
      await page.goto(input.url)
      await expect(page.locator("[data-sf-review-selected-section] table")).toBeVisible()
      await expect(page.locator("script[data-sf-review-bootstrap]")).toHaveCount(0)
    }
    let sourceObserved = (_status: number) => {}, updateObserved = (_status: number) => {}
    const sourceReady = new Promise<number>((resolve) => { sourceObserved = resolve })
    const updateReady = new Promise<number>((resolve) => { updateObserved = resolve })
    await sourceLate.route((url) => url.searchParams.get("sf") === "review-source", async (route) => {
      const response = await route.fetch()
      sourceObserved(response.status())
      await sourceRelease
      await route.fulfill({ response }).catch(() => undefined) // Revocation may already have aborted this request.
    })
    await readDenied.route((url) => url.searchParams.get("sf") === "review-update", async (route) => {
      const response = await route.fetch()
      updateObserved(response.status())
      await updateRelease
      await route.fulfill({ response }).catch(() => undefined)
    })
    await sourceLate.locator("[data-sf-review-selected-section]").getByRole("button", { name: "Abrir origem", exact: true }).first().click()
    await readDenied.getByRole("button", { name: "Check for updates", exact: true }).click()
    expect(await sourceReady, "The delayed source body must come from the authorized real host").toBe(200)
    expect(await updateReady, "The delayed update body must come from the authorized real host").toBe(200)
    return {
      dispose,
      async verifyAfterLogout() {
        const statuses: Record<string, number> = {}
        const updateDenied = sourceLate.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "review-update")
        // DOM activation keeps tab-focus revalidation from winning this deliberately ordered race.
        await sourceLate.getByRole("button", { name: "Check for updates", exact: true }).evaluate((button) => (button as HTMLButtonElement).click())
        statuses.update = (await updateDenied).status()
        const sourceRefused = sourceDenied.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "review-source")
        await sourceDenied.locator("[data-sf-review-selected-section]").getByRole("button", { name: "Abrir origem", exact: true }).first().evaluate((button) => (button as HTMLButtonElement).click())
        statuses.source = (await sourceRefused).status()
        const readRefused = readDenied.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "review-read")
        releaseUpdate()
        statuses.read = (await readRefused).status()
        releaseSource()
        for (const status of Object.values(statuses)) expect([401, 403]).toContain(status)
        for (const [index, page] of pages.entries()) {
          const workspace = page.locator("[data-sf-review-workspace]")
          await expect(workspace.getByRole("status")).toHaveText("O acesso mudou. Reabra uma revisão autorizada.")
          await expect(workspace.locator("table, a, button, [data-sf-review-selected-section]")).toHaveCount(0)
          await expect(page.locator("script[data-sf-review-bootstrap]")).toHaveCount(0)
          await expect(workspace).not.toContainText("OPEX Detail")
          await input.testInfo.attach(`wp10-review-revoked-${index}.png`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
        }
        await input.testInfo.attach("wp10-review-revocation.json", { body: JSON.stringify({ schema: "wp10-review-revocation-v1", statuses,
          sourceResponse: "Actual authorized200 held until after denied update; aborted/discarded without repopulating",
          readResponse: "Actual authorized update200 released after logout, followed by new denied read",
          identity: "Real local-operator session and logout; no enterprise/native/global acceptance" }), contentType: "application/json" })
        return statuses
      },
    }
  } catch (error) { await dispose(); throw error }
}
