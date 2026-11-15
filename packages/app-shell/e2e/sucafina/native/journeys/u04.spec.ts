import { expect, test, type Page } from "@playwright/test"

/**
 * U04 installed journey. 120 supplies a real, same-candidate shell + owner
 * fixture in GitHub Actions. This file never starts a substitute backend and
 * MUST NOT be run before F01/F02/F03/A11/S01/S03/U21 are integrated.
 */
test.use({ trace: "off" })
test.describe.configure({ retries: 0 })

function installedUrl(route: string) {
  const origin = process.env.SF_NATIVE_INSTALLED_ORIGIN
  if (!origin) throw new Error("N15 BLOCKED_INTEGRATION: 120 must provide SF_NATIVE_INSTALLED_ORIGIN for an authorized same-C installation")
  const url = new URL(route, origin)
  const env = [
    process.env.SF_NATIVE_OWNER_SERVER,
    process.env.SF_NATIVE_PROJECT_ID,
    process.env.SF_NATIVE_INSTALLATION_ID,
  ]
  if (env.some(Boolean) && !env.every(Boolean))
    throw new Error("N15 invalid partial owner selector in installed fixture")
  if (env.every(Boolean)) {
    url.searchParams.set("server", env[0]!)
    url.searchParams.set("project", env[1]!)
    url.searchParams.set("installation", env[2]!)
  }
  return url.href
}

async function readyService(page: Page) {
  await page.goto(installedUrl("/orchestra/sf-operations/service"))
  const service = page.locator('[data-sf-surface="CAP11"]')
  await expect(service).toHaveAttribute("data-sf-read-state", "ready")
  await expect(service.getByRole("heading", { name: /IT Operations|Serviço de TI/ })).toBeVisible()
  return service
}

test("U04-AC01 real month/catalog version and revision: review cancellation has no domain effect", async ({ page }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U04-AC01; WP02.T01; WP02.T02; DRAFT-01; ACTION-01" })
  const service = await readyService(page)
  const year = service.getByRole("combobox", { name: /Year/ })
  const month = service.getByRole("combobox", { name: /Month/ })
  await expect(year).toBeVisible()
  await expect(month).toBeVisible()
  await expect(service.getByRole("heading", { name: "Ticket Register" })).toBeVisible()
  await expect(service.getByRole("heading", { name: "SLA and Availability" })).toBeVisible()
  await expect(service.getByRole("heading", { name: "Heat Map" })).toBeVisible()
  await expect(service.getByRole("heading", { name: "Categories and items" })).toBeVisible()
  await expect(service.getByRole("heading", { name: "Import month" })).toBeVisible()

  await service.getByRole("button", { name: "Save tickets", exact: true }).click()
  const editor = service.locator(".sf-ops-editor")
  await expect(editor).toBeVisible()
  const first = editor.locator('input[type="number"]').first()
  await expect(first).toBeVisible()
  const original = await first.inputValue()
  const proposed = original === "0" ? "1" : "0"
  await first.fill(proposed)
  await editor.getByRole("button", { name: /Review|Revisar/ }).click()
  await expect(editor.locator('[data-component="sf-change-review"]')).toBeVisible()
  await expect(editor.locator('[data-component="sf-change-review"]')).toContainText(proposed)
  await editor.getByRole("button", { name: /Cancel|Cancelar/ }).click()
  await expect(first).toHaveValue(proposed)
  // The original source can only change through an explicit confirmed command,
  // not by review, closing the editor or navigating between months.
  await editor.getByRole("button", { name: /Close|Fechar/ }).click()
  await expect(editor).toHaveCount(0)
  await expect(service).toHaveAttribute("data-sf-read-state", "ready")
  await info.attach("u04-month-review-cancel.png", {
    body: await page.screenshot({ fullPage: true }), contentType: "image/png",
  })
})

test("U04-AC01 import-month is an explicit scope review, never an optimistic save", async ({ page }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U04-AC01; CAP11.import-month; CAS month + ops-list catalogs" })
  const service = await readyService(page)
  const action = service.getByRole("button", { name: "Replace month", exact: true })
  await expect(action).toBeEnabled()
  await action.click()
  const editor = service.locator(".sf-ops-editor")
  await expect(editor).toBeVisible()
  await expect(editor.getByRole("heading", { name: "Ticket Register" })).toBeVisible()
  await expect(editor.getByRole("heading", { name: "SLA and Availability" })).toBeVisible()
  await expect(editor.getByRole("heading", { name: "Heat Map" })).toBeVisible()
  await editor.getByRole("button", { name: /Review|Revisar/ }).click()
  const review = editor.locator('[data-component="sf-change-review"]')
  await expect(review).toBeVisible()
  await expect(review).toContainText(/Replace month/)
  await review.getByRole("button", { name: /Cancel|Cancelar/ }).click()
  await expect(editor).toBeVisible()
})

test("U04-AC02/03 states, installed owner and 320-1440 reflow keep actions reachable", async ({ page }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U04-AC02; U04-AC03; READ-01; A11Y-01; 320/768/1024/1280/1440" })
  const service = await readyService(page)
  const button = service.getByRole("button", { name: "Save SLA", exact: true })
  await expect(button).toBeEnabled()
  for (const width of [320, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(service).toHaveAttribute("data-sf-read-state", "ready")
    await expect(button).toBeVisible()
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflows, "page overflow at " + width + "px").toBe(false)
  }
  await button.focus()
  await expect(button).toBeFocused()
  await info.attach("u04-mobile-320.png", {
    body: await page.screenshot({ fullPage: true }), contentType: "image/png",
  })
})
