import { expect } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"

/** Called by the real WP10 installation spec after operator enrollment; does not start or mock a service. */
export async function qualifyWp10ExtendedUi(input: { page: Page; origin: string; testInfo: TestInfo }) {
  const { page, origin, testInfo } = input
  const facts: Record<string, string | number | boolean> = {}
  const query = (mode: string, extra: Record<string, string> = {}) => `${origin}/sucafina/dashboard?${new URLSearchParams({ sf: mode, page: "OPEX Detail", start: "2027-01-01", end: "2027-12-31", ...extra })}`
  await page.goto(query("bi", { viewId: "BI02" }))
  const bi = page.locator("[data-sf-bi]")
  await expect(bi.getByRole("combobox", { name: "Dados para visualizar", exact: true })).toBeVisible()
  await expect(bi.getByRole("status")).not.toHaveText("Carregando escolhas autorizadas…", { timeout: 30000 })
  await expect(bi.getByRole("combobox", { name: "Dados para visualizar", exact: true })).toHaveValue("")
  await expect(bi.getByRole("button", { name: "Atualizar visualização", exact: true })).toBeDisabled()
  await expect(page.getByRole("link", { name: "Gerenciar versões do Planner", exact: true })).toHaveAttribute("href", /\/sucafina\/planner\?page=Versions&year=2027$/)
  const available = await bi.getByRole("combobox", { name: "Dados para visualizar", exact: true }).locator('option[value="planner"]').count()
  facts.plannerChoiceAvailable = available === 1
  expect(available, "The published corpus contains three authorized Planner versions for 2027").toBe(1)
    await bi.getByRole("combobox", { name: "Dados para visualizar", exact: true }).selectOption("planner")
    await expect(bi.getByRole("combobox", { name: "Versão base", exact: true })).toHaveValue("")
    await expect(bi.getByRole("combobox", { name: "Versão candidata", exact: true })).toHaveValue("")
    await expect(bi.getByRole("button", { name: "Atualizar visualização", exact: true })).toBeDisabled()
    const candidates = await bi.getByRole("combobox", { name: "Versão base", exact: true }).locator("option").evaluateAll((options) => options.map((entry) => (entry as HTMLOptionElement).value).filter(Boolean))
    facts.plannerVersions = candidates.length
    expect(candidates.length).toBeGreaterThanOrEqual(2)
    // The test explicitly chooses both sources; the product never selects a latest version.
    await bi.getByRole("combobox", { name: "Versão base", exact: true }).selectOption(candidates[0]!)
    await bi.getByRole("combobox", { name: "Versão candidata", exact: true }).selectOption(candidates[1]!)
    const [read] = await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-data" && new URL(response.url()).searchParams.get("viewId") === "BI02"),
      bi.getByRole("button", { name: "Atualizar visualização", exact: true }).click(),
    ])
    const body = await read.json()
    facts.plannerHttp = read.status(); facts.plannerResult = read.ok() ? "authorized-projection" : String(body.reason)
    expect(read.status(), `Planner comparison failed: ${String(body.reason ?? "unavailable")}`).toBe(200)
    await expect(bi.getByRole("table", { name: "Dados e referências", exact: true })).toBeVisible()
  await testInfo.attach("wp10-bi-explicit-versions.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
  await bi.getByRole("combobox", { name: "Visualização", exact: true }).selectOption("BI05")
  await expect(bi.getByRole("status")).not.toHaveText("Carregando escolhas autorizadas…", { timeout: 30000 })
  const procurement = bi.getByRole("combobox", { name: "Dados para visualizar", exact: true })
  await expect(procurement).toHaveValue("")
  const collection = await procurement.locator("option").evaluateAll((options) => options.map((entry) => (entry as HTMLOptionElement).value).filter(Boolean))
  expect(collection.length, "The prepared installation must expose its authorized Procurement collection").toBe(1)
  await procurement.selectOption(collection[0]!)
  const [requests] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-data" && new URL(response.url()).searchParams.get("viewId") === "BI05"),
    bi.getByRole("button", { name: "Atualizar visualização", exact: true }).click(),
  ])
  facts.procurementHttp = requests.status()
  expect(requests.status()).toBe(200)
  await expect(bi.getByRole("table", { name: "Dados e referências", exact: true })).toBeVisible()
  await testInfo.attach("wp10-bi-procurement-choice.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })

  await page.goto(`${origin}/sucafina/dashboard?page=OPEX+Detail&year=2027`)
  const navigation = page.getByRole("navigation", { name: "Business analysis", exact: true })
  await navigation.getByRole("link", { name: "Prepare review and reports", exact: true }).click()
  expect(new URL(page.url()).searchParams.get("page")).toBe("OPEX Detail")
  expect(new URL(page.url()).searchParams.get("start")).toBe("2027-01-01")
  const workspace = page.locator("[data-sf-review-workspace]")
  await workspace.getByRole("button", { name: "Load selection", exact: true }).click()
  await expect(workspace.getByRole("heading", { name: "OPEX Detail", exact: true })).toBeVisible()
  await workspace.getByRole("button", { name: "Preserve this review", exact: true }).click()
  await expect(workspace.getByRole("heading", { name: "Preserved review", exact: true })).toBeVisible()
  await workspace.getByRole("button", { name: "Open meeting", exact: true }).click()
  const reference = new URL(page.url()).searchParams.get("reviewRef")
  expect(reference).toBeTruthy()
  expect(new URL(page.url()).searchParams.get("page")).toBe("OPEX Detail")
  expect(new URL(page.url()).searchParams.get("end")).toBe("2027-12-31")
  const original = await (await page.request.get(`${origin}/sucafina/dashboard?${new URLSearchParams({ sf: "review-read", reviewRef: reference! })}`)).json()
  expect(original.status).toBe("ok")
  expect(original.value.sections).toHaveLength(1)
  await workspace.getByRole("button", { name: "Check for updates", exact: true }).click()
  await expect(workspace.getByRole("status").filter({ hasText: /As fontes conferidas mantêm/ })).toBeVisible()
  // Apply one actual domain edit through the existing OPEX form, then prove the saved record survives reload.
  await page.goto(`${origin}/sucafina/dashboard?page=OPEX+Detail&year=2027`)
  const ownerForm = page.locator('form[data-page="OPEX Detail"][data-command="save"]').first()
  await expect(ownerForm).toBeAttached()
  const ownerId = await ownerForm.getAttribute("data-record")
  expect(ownerId).toBeTruthy()
  const oldBudget = Number(await ownerForm.getByLabel("Annual budget", { exact: true }).inputValue())
  expect(Number.isFinite(oldBudget)).toBe(true)
  const newBudget = oldBudget + 120
  await ownerForm.locator("..").getByText("Save", { exact: true }).first().click()
  await ownerForm.getByLabel("Annual budget", { exact: true }).fill(String(newBudget))
  const [edit] = await Promise.all([
    page.waitForResponse((response) => {
      if (response.request().method() !== "POST" || new URL(response.url()).pathname !== "/sucafina/dashboard") return false
      const body = response.request().postDataJSON()
      return body?.page === "OPEX Detail" && body?.action === "save" && body?.id === ownerId
    }),
    ownerForm.getByRole("button", { name: "Save", exact: true }).click(),
  ])
  expect(edit.status()).toBe(200)
  expect(await edit.json()).toMatchObject({ ok: true })
  await page.reload()
  const savedForm = page.locator('form[data-page="OPEX Detail"][data-command="save"]').filter({ has: page.locator('input[name="budget"]') }).first()
  expect(await savedForm.getAttribute("data-record")).toBe(ownerId)
  await expect(savedForm.getByLabel("Annual budget", { exact: true })).toHaveValue(String(newBudget))
  await page.goto(query("review", { reviewRef: reference! }))
  const reopened = await (await page.request.get(`${origin}/sucafina/dashboard?${new URLSearchParams({ sf: "review-read", reviewRef: reference! })}`)).json()
  expect(reopened).toEqual(original)
  await workspace.getByRole("button", { name: "Check for updates", exact: true }).click()
  await expect(workspace.getByRole("status").filter({ hasText: /Há uma fonte atualizada/ })).toBeVisible()
  await workspace.getByRole("button", { name: "Create an updated review", exact: true }).click()
  expect(new URL(page.url()).searchParams.get("previousReviewRef")).toBe(reference)
  expect(new URL(page.url()).searchParams.get("page")).toBe("OPEX Detail")
  await expect(workspace.getByRole("group", { name: "Seleção da revisão sucessora", exact: true })).toBeVisible()
  const confirmation = workspace.getByRole("checkbox")
  await expect(confirmation).toHaveCount(1)
  await expect(confirmation).not.toBeChecked()
  await expect(workspace.locator("[inert]")).toHaveCount(1)
  await confirmation.check()
  await expect(workspace.locator("[inert]")).toHaveCount(0)
  await workspace.getByRole("button", { name: "Load selection", exact: true }).click()
  await workspace.getByRole("button", { name: "Preserve this review", exact: true }).click()
  await expect(workspace.getByRole("heading", { name: "Preserved review", exact: true })).toBeVisible()
  await workspace.getByRole("button", { name: "Open meeting", exact: true }).click()
  const successor = new URL(page.url()).searchParams.get("reviewRef")
  const current = await (await page.request.get(`${origin}/sucafina/dashboard?${new URLSearchParams({ sf: "review-read", reviewRef: successor! })}`)).json()
  expect(current.status).toBe("ok"); expect(current.value.previousReviewRef).toBe(reference)
  expect(current.value.sections[0].id).toBe(original.value.sections[0].id)
  expect(current.value.sections[0].period).toEqual(original.value.sections[0].period)
  expect(current.value.sections[0].content).not.toEqual(original.value.sections[0].content)
  await page.goto(query("review", { reviewRef: reference!, sectionId: original.value.sections[0].id }))
  await expect(workspace.locator("[data-sf-review-selected-section]").getByRole("heading", { name: "Tópico selecionado: OPEX Detail", exact: true })).toBeVisible()
  facts.reviewPredecessorLinked = true; facts.reviewNonBudgetContextPreserved = true; facts.reviewRequiresNewRecordSelection = true; facts.reviewOrdinarySourceEditPreservedHistory = true
  await testInfo.attach("wp10-review-linked-section.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
  await testInfo.attach("wp10-extended-ui.json", { body: JSON.stringify({ schema: "wp10-extended-ui-v1", facts }), contentType: "application/json" })
  return facts
}
