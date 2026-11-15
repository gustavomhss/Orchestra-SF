import { expect, test, type Page } from "@playwright/test"

/**
 * U29 installed-only checks. 150 supplies the actual same-C authenticated
 * F01/F02/CLI fixture and selects this spec after integration. No fake server,
 * privileged shortcut, mock approval, or generated receipt.
 */
test.use({ trace: "off" })
test.describe.configure({ mode: "serial", retries: 0 })

function installedUrl(route: string) {
  const origin = process.env.SF_NATIVE_INSTALLED_ORIGIN
  if (!origin) throw new Error("N15 BLOCKED_INTEGRATION: 150 must configure SF_NATIVE_INSTALLED_ORIGIN for installed security journeys")
  const url = new URL(route, origin)
  const owner = [
    process.env.SF_NATIVE_OWNER_SERVER,
    process.env.SF_NATIVE_PROJECT_ID,
    process.env.SF_NATIVE_INSTALLATION_ID,
  ]
  if (owner.some(Boolean) && !owner.every(Boolean))
    throw new Error("N15 partial URL owner selector is not admissible")
  if (owner.every(Boolean)) {
    url.searchParams.set("server", owner[0]!)
    url.searchParams.set("project", owner[1]!)
    url.searchParams.set("installation", owner[2]!)
  }
  return url.href
}

async function readySecurity(page: Page) {
  await page.goto(installedUrl("/orchestra/sf-operations/security"))
  const security = page.locator('[data-sf-surface="CAP12"]')
  await expect(security).toHaveAttribute("data-sf-read-state", "ready")
  await expect(page.getByRole("heading", { name: /IT Security KPIs|Segurança de TI/ })).toBeVisible()
  return security
}

test("U29-AC01 native KPI reference and current campaign/action/incident sections stay independent", async ({ page }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U29-AC01; CAP12 monthly reference; field coverage; current collections" })
  const security = await readySecurity(page)
  for (const heading of [
    "Monthly KPIs", "Phishing Simulation", "Security Incidents with Business Impact", "Management Actions",
    "SOC trend", "SOC severity", "Patch trend",
  ]) await expect(security.getByRole("heading", { name: heading })).toBeVisible()
  const year = security.getByRole("combobox", { name: "Year" })
  const month = security.getByRole("combobox", { name: "Month" })
  await expect(year).toBeVisible()
  await expect(month).toBeVisible()
  await expect(security.getByRole("button", { name: "Save monthly entry", exact: true })).toBeEnabled()
  await security.getByRole("button", { name: "Save monthly entry", exact: true }).click()
  const editor = security.locator(".sf-security-editor")
  await expect(editor).toBeVisible()
  // All sixteen source KPI numerics and notes must be editable without
  // coercing absent/null to a fake source zero.
  await expect(editor.locator('input[type="number"]')).toHaveCount(16)
  const inputs = editor.locator('input[type="number"]')
  await inputs.first().fill("0")
  await editor.getByRole("button", { name: /Review|Revisar/ }).click()
  const review = editor.locator('[data-component="sf-change-review"]')
  await expect(review).toBeVisible()
  await review.getByRole("button", { name: /Cancel|Cancelar/ }).click()
  await expect(editor.locator('input[type="number"]').first()).toHaveValue("0")
  await info.attach("u29-kpi-review.png", {
    body: await page.screenshot({ fullPage: true }), contentType: "image/png",
  })
})

test("U29-AC01 action creation is reviewed and can be abandoned without a domain command", async ({ page }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U29-AC01; save-action; owner draft; explicit confirmation" })
  const security = await readySecurity(page)
  await security.getByRole("button", { name: "Add action", exact: true }).click()
  const editor = security.locator(".sf-security-editor")
  await editor.getByRole("textbox", { name: "text" }).fill("N15 installed action preview — no submit")
  await editor.getByRole("checkbox", { name: "Done" }).check()
  await editor.getByRole("button", { name: /Review|Revisar/ }).click()
  const review = editor.locator('[data-component="sf-change-review"]')
  await expect(review).toBeVisible()
  await expect(review).toContainText("N15 installed action preview")
  await review.getByRole("button", { name: /Cancel|Cancelar/ }).click()
  await expect(editor.getByRole("textbox", { name: "text" })).toHaveValue("N15 installed action preview — no submit")
})

test("U29-AC01 incident/campaign nested fields expose native controlled inputs", async ({ page }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U29-AC01; save-incident; save-campaign; nested departments/consequences" })
  const security = await readySecurity(page)
  await security.getByRole("button", { name: "Add incident", exact: true }).click()
  const editor = security.locator(".sf-security-editor")
  await expect(editor.getByRole("textbox", { name: "Title" })).toBeVisible()
  await expect(editor.getByRole("checkbox", { name: "Data exfiltration" })).toBeVisible()
  await expect(editor.getByRole("checkbox", { name: "Data loss" })).toBeVisible()
  await expect(editor.getByRole("checkbox", { name: "Service unavailability" })).toBeVisible()
  await editor.getByRole("button", { name: /Close|Fechar/ }).click()
  await security.getByRole("button", { name: "Add campaign", exact: true }).click()
  await expect(editor.getByRole("textbox", { name: "Campaign name" })).toBeVisible()
  await expect(editor.getByRole("group", { name: "Department" })).toBeVisible()
  await expect(editor.getByRole("button", { name: /Add campaign/ })).toBeVisible()
})

test("U29-AC02/03 320-1440 native reflow retains action and keyboard focus", async ({ page }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U29-AC02; U29-AC03; READ-01; A11Y-01" })
  const security = await readySecurity(page)
  const addAction = security.getByRole("button", { name: "Add action", exact: true })
  for (const width of [320, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(security).toHaveAttribute("data-sf-read-state", "ready")
    await expect(addAction).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflow, "unexpected horizontal document overflow at " + width).toBe(false)
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
  await expect(addAction).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
    "200% text enlargement must not overflow the document").toBe(false)
  await page.evaluate(() => { document.documentElement.style.fontSize = "" })
  await page.setViewportSize({ width: 320, height: 900 }) // 1280px viewport at 400% browser zoom
  await addAction.focus()
  await expect(addAction).toBeFocused()
  await info.attach("u29-mobile-320.png", {
    body: await page.screenshot({ fullPage: true }), contentType: "image/png",
  })
})


test("U29-AC02 KPI drafts survive Escape and a reference change without cross-month writes", async ({ page }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U29-AC02; DRAFT-01; reference isolation; keyboard Escape" })
  const security = await readySecurity(page)
  const month = security.getByRole("combobox", { name: "Month" })
  const sourceMonth = await month.inputValue()
  const otherMonth = sourceMonth === "12" ? "11" : "12"
  const saveKpi = security.getByRole("button", { name: "Save monthly entry", exact: true })
  await saveKpi.click()
  const editor = security.locator(".sf-security-editor")
  const training = editor.getByRole("spinbutton", { name: "training" })
  const original = await training.inputValue()
  const proposed = original === "5" ? "6" : "5"
  await training.fill(proposed)
  await training.press("Escape")
  await expect(editor).toHaveCount(0)
  await expect(saveKpi).toBeFocused()
  await saveKpi.click()
  await expect(training).toHaveValue(proposed)
  await editor.getByRole("button", { name: /Close|Fechar/ }).click()
  await month.selectOption(otherMonth)
  await expect(security).toHaveAttribute("data-sf-read-state", /^(ready|empty|filtered-empty)$/)
  await month.selectOption(sourceMonth)
  await expect(security).toHaveAttribute("data-sf-read-state", "ready")
  await saveKpi.click()
  await expect(training).toHaveValue(proposed)
  page.once("dialog", (dialog) => { void dialog.accept() })
  await editor.getByRole("button", { name: /Discard draft|Descartar rascunho/ }).click()
  await expect(editor).toHaveCount(0)
  await saveKpi.click()
  await expect(training).toHaveValue(original)
})

test("U29-AC01 action lifecycle uses actual save and delete admissions on isolated producer", async ({ page }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U29-AC01; save-action; delete-action; no fake authority; source refetch" })
  test.skip(process.env.SF_NATIVE_ISOLATED_MUTATION_FIXTURE !== "true",
    "150 must attest an isolated real producer fixture before any domain mutation")
  const security = await readySecurity(page)
  const unique = "N15 installed " + crypto.randomUUID()
  await security.getByRole("button", { name: "Add action", exact: true }).click()
  const editor = security.locator(".sf-security-editor")
  await editor.getByRole("textbox", { name: "text" }).fill(unique)
  await editor.getByRole("button", { name: /Review|Revisar/ }).click()
  const review = editor.locator('[data-component="sf-change-review"]')
  await expect(review).toContainText(unique)
  await review.getByRole("button", { name: "Save action", exact: true }).click()
  await expect(security.getByRole("status").filter({ hasText: /Changes saved|Alterações salvas/ })).toBeVisible()
  const row = security.getByRole("row").filter({ hasText: unique })
  await expect(row).toBeVisible()
  await row.getByRole("button", { name: "Delete action", exact: true }).click()
  await expect(review).toBeVisible()
  await review.getByRole("button", { name: "Delete action", exact: true }).click()
  await expect(row).toHaveCount(0)
})
