import { expect } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"
import { object, text } from "../reports-support/model"

/** Called by the real WP10 installation spec after operator enrollment; does not start or mock a service. */
export async function qualifyWp10ExtendedUi(input: { page: Page; origin: string; testInfo: TestInfo }) {
  const { page, origin, testInfo } = input
  const facts: Record<string, string | number | boolean> = {}
  const query = (mode: "bi" | "review", extra: Record<string, string>) => {
    if (mode === "review" && extra.sectionId) {
      throw new Error("UNBOUND WP4: UI48 has no native sectionId deep-link binding; a whole-review URL cannot qualify the selected section.")
    }
    const reference = text(mode === "bi" ? extra.viewId : extra.reviewRef)
    return (mode === "bi" ? "/orchestra/sf-bi/" : "/orchestra/sf-reviews/reviews/") +
      "r_" + Buffer.from(reference, "utf8").toString("base64url")
  }
  // UNBOUND: the native BI route admits no legacy page/start/end query or data-sf-bi form.
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

  await page.goto("/orchestra/sf-dashboard/opex?year=2027")
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
  // Edit the exact owner returned by CAP04, through its native draft and confirmation.
  const loaded = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return response.request().method() === "GET" && url.origin === origin &&
      url.pathname === "/sucafina/api/ui/pages/CAP04" && url.searchParams.get("year") === "2027"
  })
  await page.goto("/orchestra/sf-dashboard/opex?year=2027")
  const loadedResponse = await loaded
  expect(loadedResponse.status()).toBe(200)
  const loadedBody = object(await loadedResponse.json())
  expect(loadedBody.status).toBe("ok")
  const owners = object(object(loadedBody.value).data).opexOwners
  if (!Array.isArray(owners)) throw new Error("CAP04 did not expose authorized OPEX owners")
  const ownerIds = owners.map((owner: unknown) => text(object(owner).id)).sort()
  expect(ownerIds.length).toBeGreaterThan(0)
  const ownerId = ownerIds[0]!
  const ownerRow = page.locator('tr[data-sf-row="' + ownerId + '"]')
  await expect(ownerRow).toHaveCount(1)
  await ownerRow.locator('button[data-sf-action="edit"]').click()
  const ownerForm = page.locator('section.sf-budget-editor[data-sf-action="save"] form.sf-budget-form')
  await expect(ownerForm).toHaveCount(1)
  const oldBudget = Number(await ownerForm.getByLabel("Annual budget", { exact: true }).inputValue())
  expect(Number.isFinite(oldBudget)).toBe(true)
  const newBudget = oldBudget + 120
  await ownerForm.getByLabel("Annual budget", { exact: true }).fill(String(newBudget))
  await ownerForm.getByRole("button", { name: /^(Review changes|Revisar alterações)$/ }).click()
  const change = page.locator('[data-component="sf-change-review"]')
  await expect(change).toHaveCount(1)
  const edited = page.waitForResponse((response) => {
    const url = new URL(response.url())
    if (response.request().method() !== "POST" || url.origin !== origin || url.pathname !== "/sucafina/dashboard") return false
    const body = object(response.request().postDataJSON())
    return body.page === "OPEX Detail" && body.action === "save" && body.id === ownerId
  })
  await expect(change.getByRole("button", { name: "Save", exact: true })).toBeEnabled()
  await change.getByRole("button", { name: "Save", exact: true }).click()
  const edit = await edited
  expect(edit.status()).toBe(200)
  expect(object(edit.request().postDataJSON())).toMatchObject({ id: ownerId, values: { budget: newBudget } })
  expect(await edit.json()).toMatchObject({ ok: true })
  await expect(ownerForm).toHaveCount(0)
  await page.reload()
  await expect(ownerRow).toHaveCount(1)
  await ownerRow.locator('button[data-sf-action="edit"]').click()
  await expect(ownerForm.getByLabel("Annual budget", { exact: true })).toHaveValue(String(newBudget))
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
  facts.reviewRevocationUrl = query("review", { reviewRef: successor!, sectionId: current.value.sections[0].id })
  facts.reviewPredecessorLinked = true; facts.reviewNonBudgetContextPreserved = true; facts.reviewRequiresNewRecordSelection = true; facts.reviewOrdinarySourceEditPreservedHistory = true
  await testInfo.attach("wp10-review-linked-section.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
  await testInfo.attach("wp10-extended-ui.json", { body: JSON.stringify({ schema: "wp10-extended-ui-v1", facts }), contentType: "application/json" })
  return facts
}
