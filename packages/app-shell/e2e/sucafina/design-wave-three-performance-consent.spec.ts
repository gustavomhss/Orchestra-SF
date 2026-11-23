import { expect, type Page } from "@playwright/test"
import { waveThreeTest, observePage, enter, originalRead, reflow, reviewActions, capture, scrollPageTop } from "./design-support/wave-three"
import { waveThreeData } from "./design-support/wave-three-data"

// Keep the original enrollment and scoped session out of traces in every test file.
waveThreeTest.use({ trace: "off", video: "off" })
waveThreeTest.describe.configure({ retries: 0 })

const performanceScreen = {
  path: "/orchestra/sf-operations/performance", title: "IT Performance Contract",
} as const

waveThreeTest("installed native operations · weight exceptions require fresh producer-backed consent", async ({ page, installation, owner }, info) => {
  // This separate scenario includes two genuine producer refusals, explicit consent,
  // one accepted command and a fresh source readback; no existing case budget changes.
  waveThreeTest.setTimeout(300_000)
  const started = performance.now()
  expect(info.project.metadata.bundle).toBe("production")
  const messages = observePage(page)
  await enter(page, owner, new URL(performanceScreen.path, installation.origin).href, performanceScreen.title,
    undefined, { path: "/api/ui/pages/CAP16" })
  await loaded(page)
  const surface = page.locator('[data-sf-surface="CAP16"]')
  await surface.locator(".sf-u31-open").filter({ hasText: waveThreeData.operations.subitem }).click()
  const detail = surface.locator("[data-sf-performance-detail]")
  await detail.getByRole("button", { name: "Edit sub-item", exact: true }).click()
  const editor = surface.locator("[data-sf-performance-editor]")
  await expect(editor.getByLabel("Owner weight", { exact: true })).toHaveValue("0.4")
  await editor.getByLabel("Owner weight", { exact: true }).fill("0.8")
  await editor.getByLabel("Notes", { exact: true }).fill("Design test data · First allocation exception review.")
  await editor.getByRole("button", { name: "Review changes", exact: true }).click()
  const review = surface.locator('[data-component="sf-change-review"]')
  const consent = review.getByRole("checkbox", { name: "Confirm weights exceeding total allocation", exact: true })
  await expect(consent).toHaveCount(0)
  const firstResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname === installation.mount + "/dashboard" &&
    response.request().postDataJSON()?.action === "save-sub")
  await review.getByRole("button", { name: "Save", exact: true }).click()
  const first = await firstResponse
  expect(first.status()).toBe(422)
  expect(await first.json()).toMatchObject({ ok: false, errors: ["Confirm owner and co-owner weights exceeding the total before saving."] })
  expect(first.request().postDataJSON()).toMatchObject({ page: "IT Performance Contract", action: "save-sub",
    confirmed: false, values: { ownerWeight: 0.8 } })
  await expect(consent).not.toBeChecked()
  await expect(review.getByRole("button", { name: "Save", exact: true })).toBeDisabled()
  await expect(review.locator(".sf-u31-weight-context")).toContainText("The source rejected this change")
  await review.getByText("Current source allocations", { exact: true }).click()
  const source = review.locator(".sf-u31-weight-context").getByRole("region", { name: waveThreeData.operations.subitem, exact: true })
  await expect(source).toContainText("Owner weight")
  await expect(source.getByText("0.4", { exact: true })).toBeVisible()
  await expect(source.getByText("0.6", { exact: true })).toBeVisible()
  await consent.check()
  await expect(review.getByRole("button", { name: "Save", exact: true })).toBeEnabled()
  await page.setViewportSize({ width: 320, height: 900 })
  await reflow(page)
  await reviewActions(page)
  await capture(page, info, "CAP16-weight-exception-consent-dark-320-test-data")

  // Revising the proposal invalidates consent; the next command must reach the producer unconfirmed.
  await review.getByRole("button", { name: "Revise", exact: true }).click()
  await expect(editor.getByLabel("Owner weight", { exact: true })).toHaveValue("0.8")
  await editor.getByLabel("Notes", { exact: true }).fill("Design test data · Revised allocation exception explicitly accepted.")
  await editor.getByRole("button", { name: "Review changes", exact: true }).click()
  await expect(consent).toHaveCount(0)
  const secondResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname === installation.mount + "/dashboard" &&
    response.request().postDataJSON()?.action === "save-sub")
  await review.getByRole("button", { name: "Save", exact: true }).click()
  const second = await secondResponse
  expect(second.status()).toBe(422)
  expect(second.request().postDataJSON().confirmed).toBe(false)
  await expect(consent).not.toBeChecked()
  await consent.check()
  const acceptedResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname === installation.mount + "/dashboard" &&
    response.request().postDataJSON()?.action === "save-sub")
  await originalRead(page, owner, { path: "/api/ui/pages/CAP16" }, () =>
    review.getByRole("button", { name: "Save", exact: true }).click())
  const accepted = await acceptedResponse
  expect(accepted.status()).toBe(200)
  expect(await accepted.json()).toMatchObject({ ok: true })
  const payload = accepted.request().postDataJSON()
  expect(payload).toMatchObject({ confirmed: true, version: first.request().postDataJSON().version,
    values: { ownerWeight: 0.8, notes: "Design test data · Revised allocation exception explicitly accepted." } })
  const keys = await Promise.all([first, second, accepted].map((response) => response.request().headerValue("Idempotency-Key")))
  expect(keys.every((value) => !!value)).toBe(true)
  expect(new Set(keys).size).toBe(3)
  await expect(review).toHaveCount(0)
  await expect(detail).toContainText("Revised allocation exception explicitly accepted")
  await enter(page, owner, new URL(performanceScreen.path, installation.origin).href, performanceScreen.title,
    undefined, { path: "/api/ui/pages/CAP16" })
  await loaded(page)
  await surface.locator(".sf-u31-open").filter({ hasText: waveThreeData.operations.subitem }).click()
  await detail.getByRole("button", { name: "Edit sub-item", exact: true }).click()
  await expect(editor.getByLabel("Owner weight", { exact: true })).toHaveValue("0.8")
  await expect(editor.getByLabel("Notes", { exact: true })).toHaveValue("Design test data · Revised allocation exception explicitly accepted.")
  expect(messages.pageErrors).toEqual([])
  expect(messages.consoleErrors.filter((value) =>
    !/^Failed to load resource: the server responded with a status of 422 \(Unprocessable (Entity|Content)\)$/.test(value))).toEqual([])
  await info.attach("native-weight-consent-evidence", { contentType: "application/json",
    body: JSON.stringify({ source: "canonical IT Performance Contract producer", elapsedFromEntryMs: Math.round(performance.now() - started), rejected: [first.status(), second.status()],
      accepted: accepted.status(), freshIdempotencyKeys: new Set(keys).size, confirmed: [false, false, true],
      unchangedVersionAfterRejection: payload.version === first.request().postDataJSON().version, ...messages }, null, 2) })
})

async function loaded(page: Page) {
  const surface = page.locator('[data-sf-surface="CAP16"]')
  await expect(surface).toBeVisible()
  await expect(surface).toHaveAttribute("data-sf-wave", "three")
  await expect(surface.locator("[data-sf-performance-item]")).toHaveCount(2)
  await reflow(page)
  await scrollPageTop(page)
}
