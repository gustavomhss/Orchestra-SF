import { expect } from "@playwright/test"
import type { BrowserContext, Page, Request, TestInfo } from "@playwright/test"

/** Hold only genuine authorized responses; authority and returned payloads stay original. */
export async function prepareWp10ReviewRevocation(input: { context: BrowserContext; url: string; testInfo: TestInfo }) {
  const pages: Page[] = []
  const sourceGate = Promise.withResolvers<void>(), updateGate = Promise.withResolvers<void>()
  const sourceReady = Promise.withResolvers<number>(), updateReady = Promise.withResolvers<number>()
  const sourceDone = Promise.withResolvers<void>(), updateDone = Promise.withResolvers<void>()
  let originalSourceUrl = "", reviewRef = ""
  let sourceRequest: Request | undefined, updateRequest: Request | undefined
  let sourceAborted = false, updateAborted = false
  const dispose = async () => {
    sourceGate.resolve(); updateGate.resolve()
    await Promise.all(pages.map((page) => page.close()))
  }
  try {
    const sourceLate = await input.context.newPage(), sourceDenied = await input.context.newPage(), readDenied = await input.context.newPage()
    pages.push(sourceLate, sourceDenied, readDenied)
    const target = new URL(input.url)
    const sectionRef = target.searchParams.get("sectionRef")
    expect(sectionRef).toMatch(/\S+/)
    for (const page of pages) {
      await page.goto(input.url)
      const selected = page.locator("[data-sf-review-selected-section]")
      await expect(selected).toBeVisible()
      await expect(selected).toHaveAttribute("data-section-id", sectionRef!)
      await expect(selected.getByRole("heading", { name: "OPEX Detail", exact: true })).toBeVisible()
      await expect(selected.getByRole("button", { name: /^Open source / }).first()).toBeEnabled()
      await expect(page.locator("script[data-sf-review-bootstrap]")).toHaveCount(0)
      const observed = await page.locator("article[data-review-ref]").getAttribute("data-review-ref")
      expect(observed).toMatch(/\S+/)
      if (reviewRef) expect(observed).toBe(reviewRef)
      else reviewRef = observed!
    }
    sourceLate.on("requestfailed", (request) => {
      if (request === sourceRequest && /ERR_ABORTED/.test(request.failure()?.errorText ?? "")) sourceAborted = true
    })
    readDenied.on("requestfailed", (request) => {
      if (request === updateRequest && /ERR_ABORTED/.test(request.failure()?.errorText ?? "")) updateAborted = true
    })
    await sourceLate.route((url) => url.searchParams.get("sf") === "review-source", async (route) => {
      sourceRequest = route.request()
      originalSourceUrl = sourceRequest.url()
      const response = await route.fetch()
      sourceReady.resolve(response.status())
      await sourceGate.promise
      try { await route.fulfill({ response }) }
      catch (error) { if (!sourceAborted) throw error }
      finally { sourceDone.resolve() }
    })
    await readDenied.route((url) => url.searchParams.get("sf") === "review-update", async (route) => {
      updateRequest = route.request()
      const response = await route.fetch()
      updateReady.resolve(response.status())
      await updateGate.promise
      try { await route.fulfill({ response }) }
      catch (error) { if (!updateAborted) throw error }
      finally { updateDone.resolve() }
    })
    await sourceLate.locator("[data-sf-review-selected-section]").getByRole("button", { name: /^Open source / }).first().click()
    await readDenied.getByRole("button", { name: "Check for updates", exact: true }).click()
    expect(await sourceReady.promise, "The held source response is the real authorized producer response").toBe(200)
    expect(await updateReady.promise, "The held update response is the real authorized producer response").toBe(200)
    return {
      dispose,
      async verifyAfterLogout() {
        const statuses: Record<string, number> = {}
        const updateRefused = sourceLate.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "review-update")
        await sourceLate.getByRole("button", { name: "Check for updates", exact: true }).click()
        statuses.update = (await updateRefused).status()
        expect([401, 403]).toContain(statuses.update)
        await expect(sourceLate.locator("article[data-review-ref]")).toHaveCount(0)

        // Native source navigation first revalidates the preserved review. A
        // refused read must prevent a second source fetch and purge the old UI.
        const readRefused = sourceDenied.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "review-read")
        await sourceDenied.locator("[data-sf-review-selected-section]").getByRole("button", { name: /^Open source / }).first().click()
        statuses.read = (await readRefused).status()
        expect([401, 403]).toContain(statuses.read)
        await expect(sourceDenied.locator("article[data-review-ref]")).toHaveCount(0)
        expect(originalSourceUrl).not.toBe("")
        const deniedSource = await input.context.request.get(originalSourceUrl)
        statuses.source = deniedSource.status()
        expect([401, 403]).toContain(statuses.source)

        // The third tab still holds an actual pre-logout update200. Revalidate
        // its owner before releasing it; the new generation must reject it.
        for (const page of pages) {
          const denied = page.waitForResponse((response) => new URL(response.url()).pathname === "/sucafina/api/ui/context" && response.status() === 401)
          await page.getByRole("button", { name: "Refresh access", exact: true }).click()
          expect((await denied).status()).toBe(401)
          await expect(page.locator('[data-sf-f01="unauthenticated"]')).toBeVisible()
        }
        sourceGate.resolve(); updateGate.resolve()
        await Promise.all([sourceDone.promise, updateDone.promise])
        for (const [index, page] of pages.entries()) {
          await expect(page.locator("article[data-review-ref], [data-sf-review-selected-section]")).toHaveCount(0)
          await expect(page.locator('[data-sf-surface="UI48"] table, [data-sf-surface="UI48"] a')).toHaveCount(0)
          await expect(page.locator("script[data-sf-review-bootstrap]")).toHaveCount(0)
          await expect(page.locator("body")).not.toContainText("OPEX Detail")
          await expect(page.locator("body")).not.toContainText(reviewRef)
          await input.testInfo.attach(`wp10-review-revoked-${index}.png`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
        }
        await input.testInfo.attach("wp10-review-revocation.json", { body: JSON.stringify({
          schema: "wp10-review-revocation-v1", statuses,
          sourceResponse: "Original authorized200 released only after denied update and owner generation401; no repopulation",
          readResponse: "Original authorized update200 released after logout and the tab's context401 fence",
          identity: "Original local-operator session and logout, native owner and producer denials",
        }), contentType: "application/json" })
        return statuses
      },
    }
  } catch (error) { await dispose(); throw error }
}
