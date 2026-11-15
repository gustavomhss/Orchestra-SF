import { expect, test, type Page, type Request } from "@playwright/test"

/**
 * U15 uses the real F04 installed, owner-scoped Dashboard producer. No
 * route.fulfill, synthetic HTTP success, seeded financial result or fake approval.
 * F04 must explicitly provide the isolated fixture URLs; 120 owns execution.
 */
const fixtures = {
  list: process.env.SF_NATIVE_U15_LIST_URL,
  editable: process.env.SF_NATIVE_U15_EDIT_URL,
  denied: process.env.SF_NATIVE_U15_DENIED_URL,
  stale: process.env.SF_NATIVE_U15_STALE_URL,
  lost: process.env.SF_NATIVE_U15_LOST_RESPONSE_URL,
}
test.use({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" })

function isContractMutation(request: Request) {
  const url = new URL(request.url())
  return request.method() === "POST" &&
    url.pathname.endsWith("/dashboard") &&
    url.searchParams.get("page") === "Vendor Contracts"
}
function surface(page: Page) {
  return page.locator('[data-component="sf-vendor-contracts"]')
}

test("CAP14 real authorized list reads Dashboard contracts and keeps filters on filtered-empty", async ({ page }) => {
  test.skip(!fixtures.list, "F04 installed CAP14 list owner/fixture unavailable")
  const responses = page.waitForResponse((response) =>
    response.request().method() === "GET" && response.url().includes("/api/ui/pages/CAP14") && response.ok())
  await page.goto(fixtures.list!)
  const read = await (await responses).json()
  expect(read).toMatchObject({ status: "ok", value: { capabilityId: "CAP14" } })
  expect(Array.isArray(read.value.data.contracts)).toBe(true)
  await expect(surface(page)).toBeVisible()
  const filter = surface(page).getByRole("searchbox")
  await filter.fill("~~a-contract-never-matching-authorized-fixture~~")
  await expect(filter).toHaveValue("~~a-contract-never-matching-authorized-fixture~~")
  await expect(surface(page).locator('[data-sf-table-state="filtered-empty"]')).toBeVisible()
  expect(await filter.inputValue()).toContain("never-matching")
})

test("CAP14 real edit uses source version and only dashboard save; confirms after authorized reread", async ({ page }) => {
  test.skip(!fixtures.editable, "F04 isolated editable CAP14 owner/fixture unavailable")
  const writes: Request[] = []
  page.on("request", (request) => { if (isContractMutation(request)) writes.push(request) })
  const beforeRead = page.waitForResponse((response) =>
    response.url().includes("/api/ui/pages/CAP14") && response.request().method() === "GET" && response.ok())
  await page.goto(fixtures.editable!)
  const source = await (await beforeRead).json()
  const vendor = surface(page).locator('[data-field="vendor"] input').first()
  await expect(vendor).toBeEditable()
  const original = await vendor.inputValue()
  const nextVendor = original + " u15 isolated e2e"
  await vendor.fill(nextVendor)
  await surface(page).getByRole("button", { name: /Review contract change|Revisar alteração contratual/ }).click()
  const submit = surface(page).getByRole("button", { name: /Confirm|Confirmar/ })
  await expect(submit).toBeEnabled()
  const commandResponse = page.waitForResponse((response) => isContractMutation(response.request()))
  await submit.click()
  const response = await commandResponse
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true })
  const body = response.request().postDataJSON()
  expect(body).toMatchObject({ page: "Vendor Contracts", action: "save",
    values: { vendor: nextVendor }, version: expect.any(Number) })
  expect(body.version).toBe(source.value.versions["contracts:" + body.id])
  expect(body.values).not.toHaveProperty("docs")
  expect(body.values).not.toHaveProperty("createdAt")
  expect(body.values).not.toHaveProperty("updatedAt")
  expect(body.values).not.toHaveProperty("ownerId")
  expect(writes).toHaveLength(1)
  expect(response.request().headers()["idempotency-key"]).toEqual(expect.any(String))
  await expect(surface(page).getByRole("status")).toContainText(/verified|verificado/)
  await page.reload()
  await expect(surface(page).getByText(nextVendor).first()).toBeVisible()
})

test("CAP14 real denied second actor displays no unauthorized contract values or write control", async ({ page }) => {
  test.skip(!fixtures.denied, "F04 denied second identity for CAP14 is unavailable")
  const writes: Request[] = []
  page.on("request", (request) => { if (isContractMutation(request)) writes.push(request) })
  await page.goto(fixtures.denied!)
  await expect(surface(page)).toBeVisible()
  await expect(surface(page).locator('[data-field="vendor"] input')).toHaveCount(0)
  expect(writes).toHaveLength(0)
})

test("CAP14 real version conflict cannot be shown saved", async ({ page }) => {
  test.skip(!fixtures.stale, "F04 isolated stale source version injection unavailable")
  await page.goto(fixtures.stale!)
  const vendor = surface(page).locator('[data-field="vendor"] input').first()
  await expect(vendor).toBeEditable()
  await vendor.fill((await vendor.inputValue()) + " stale")
  await surface(page).getByRole("button", { name: /Review contract change|Revisar alteração contratual/ }).click()
  const responsePromise = page.waitForResponse((response) => isContractMutation(response.request()))
  await surface(page).getByRole("button", { name: /Confirm|Confirmar/ }).click()
  expect((await responsePromise).status()).toBe(409)
  await expect(surface(page).getByText(/verified after saving|verificado após o salvamento/)).toHaveCount(0)
})

test("CAP14 real lost response does not automatically replay the command", async ({ page }) => {
  test.skip(!fixtures.lost, "F04 isolated post-commit response-loss injection unavailable")
  const writes: Request[] = []
  page.on("request", (request) => { if (isContractMutation(request)) writes.push(request) })
  await page.goto(fixtures.lost!)
  const vendor = surface(page).locator('[data-field="vendor"] input').first()
  await expect(vendor).toBeEditable()
  await vendor.fill((await vendor.inputValue()) + " response loss")
  await surface(page).getByRole("button", { name: /Review contract change|Revisar alteração contratual/ }).click()
  await surface(page).getByRole("button", { name: /Confirm|Confirmar/ }).click()
  await expect(surface(page).getByRole("alert")).toContainText(/not retry|não reenvie/)
  expect(writes).toHaveLength(1)
  await surface(page).getByRole("button", { name: /Refresh source|Atualizar fonte/ }).click()
  expect(writes).toHaveLength(1)
})

test("CAP14 real owner-scoped 320px reflow and keyboard reachability", async ({ page }) => {
  test.skip(!fixtures.list, "F04 installed CAP14 list fixture unavailable")
  await page.goto(fixtures.list!)
  await expect(surface(page)).toBeVisible()
  for (const width of [320, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect(surface(page).getByRole("searchbox")).toBeVisible()
    await expect(surface(page).getByRole("searchbox")).toBeEnabled()
  }
  await page.keyboard.press("Tab")
  await expect(page.locator(":focus")).toHaveCount(1)
})
