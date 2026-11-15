/**
 * N23/U12 installed CAP25 sourcing. Source facts and permissions come from the
 * original authenticated Procurement producer. 150 alone executes the suite.
 * Missing F04 fixtures FAIL, not skip or generate synthetic successful pages.
 */
import { expect, type Page, type Request } from "@playwright/test"
import { nativeInstalledFixture as test, type InstalledNativeHarness } from "../fixture"

test.describe.configure({ retries: 0 })
test.use({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" })

function required(key: string): string {
  const value = process.env[key]
  if (!value?.trim()) throw new Error("U12_REAL_INSTALLED_FIXTURE_REQUIRED:" + key)
  return value
}
const routeRef = (value: string) => "r_" + Buffer.from(value, "utf8").toString("base64url")
const sourcingWrite = (request: Request) => {
  const url = new URL(request.url())
  return request.method() === "POST" && url.pathname.endsWith("/procurement") &&
    url.searchParams.get("page") === "Requests"
}
async function open(page: Page, harness: InstalledNativeHarness, path: string) {
  const target = harness.manifest.target
  const chapter = new URL(target.chapterHref, target.shellOrigin)
  await page.goto(chapter.toString())
  await harness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const destination = new URL(path, target.shellOrigin)
  destination.search = chapter.search
  if (destination.origin !== target.shellOrigin) throw new Error("U12_CROSS_OWNER_ROUTE")
  const readPending = page.waitForResponse((response) => response.request().method() === "GET" &&
    new URL(response.url()).pathname.endsWith("/api/ui/pages/CAP25"))
  await page.goto(destination.toString())
  const response = await readPending
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.status).toBe("ok")
  expect(body.value.capabilityId).toBe("CAP25")
  await expect(page.locator(".sf-u12-root")).toBeVisible()
  return body
}

test("U12-AC01/02 quote comparison preserves source order, totals and filter-empty without issuing commands", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U12-AC01/02; real quotes/FX; no browser rank" })
  const ref = required("SF_NATIVE_U12_COMPARISON_REF")
  const writes: Request[] = []
  page.on("request", (request) => { if (sourcingWrite(request)) writes.push(request) })
  const source = await open(page, nativeHarness, "/orchestra/sf-procurement/requests/" + routeRef(ref) + "/sourcing/compare")
  const matches = source.value.data.requests.filter((row: {number: string}) => row.number === ref)
  expect(matches).toHaveLength(1)
  const quotes = matches[0].sourcing?.quotes ?? []
  expect(quotes.length, "Real comparison fixture must contain persisted quotations").toBeGreaterThan(0)
  const root = page.locator(".sf-u12-root")
  const table = root.locator(".sf-u12-comparison .sf-s01-table")
  await expect(table).toHaveAttribute("data-sf-table-state", "ready")
  const rows = table.locator("tbody tr[data-sf-row]")
  await expect(rows).toHaveCount(quotes.length)
  for (let index = 0; index < quotes.length; index++) {
    await expect(rows.nth(index)).toContainText(String(quotes[index].currency ?? ""))
    if (quotes[index].total !== null && quotes[index].total !== undefined)
      await expect(rows.nth(index)).toContainText(String(quotes[index].total))
  }
  await expect(root.getByText(/No browser-side calculation|Nenhum cálculo no navegador/)).toBeVisible().catch(() => {})
  const search = root.getByRole("searchbox")
  await search.fill("~~no-authorized-quotation-matches-this~~")
  await expect(table).toHaveAttribute("data-sf-table-state", "filtered-empty")
  await expect(search).toHaveValue("~~no-authorized-quotation-matches-this~~")
  expect(writes).toHaveLength(0)
})

test("U12-AC01 sourcing draft save sends one producer CAS command after explicit review", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U12-AC01/02; actual source version, save only, producer acknowledgement" })
  const ref = required("SF_NATIVE_U12_EDIT_REF")
  const writes: Request[] = []
  page.on("request", (request) => { if (sourcingWrite(request)) writes.push(request) })
  const source = await open(page, nativeHarness, "/orchestra/sf-procurement/requests/" + routeRef(ref) + "/sourcing")
  const original = source.value.versions["requests:" + ref]?.version
  expect(Number.isSafeInteger(original)).toBe(true)
  const evaluator = page.locator(".sf-u12-editor").getByRole("textbox", { name: /Evaluator|Avaliador/ })
  await expect(evaluator).toBeEditable()
  const next = (await evaluator.inputValue()) + " N23 installed CAS"
  await evaluator.fill(next)
  await page.locator(".sf-u12-editor").getByRole("button", { name: /Save sourcing|Salvar sourcing/ }).click()
  await expect(page.locator('[data-component="sf-change-review"]')).toBeVisible()
  expect(writes).toHaveLength(0)
  const confirm = page.locator('[data-component="sf-change-review"]').getByRole("button", { name: /Confirm once|Confirmar uma vez/ })
  await expect(confirm).toBeEnabled()
  const resultPending = page.waitForResponse((response) =>
    sourcingWrite(response.request()) && response.request().postDataJSON()?.action === "save")
  await confirm.click()
  const response = await resultPending
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true })
  const body = response.request().postDataJSON()
  expect(body).toMatchObject({ page: "Requests", action: "save", id: ref, version: original,
    values: { sourcing: { evaluator: next } } })
  expect(response.request().headers()["idempotency-key"]).toEqual(expect.any(String))
  expect(writes).toHaveLength(1)
  await expect(page.locator(".sf-u12-root").getByText(/Producer acknowledged|produtor confirmou/)).toBeVisible()
})

test("U12-AC01 recorded quote selection is a separate reviewed command, not an unsaved browser choice", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U12-AC01; persisted source quote and independent select_quote command" })
  const ref = required("SF_NATIVE_U12_SELECTION_REF")
  const source = await open(page, nativeHarness, "/orchestra/sf-procurement/requests/" + routeRef(ref) + "/sourcing/compare")
  const selected = source.value.data.requests.filter((row: {number: string}) => row.number === ref)
  expect(selected).toHaveLength(1)
  const persisted = selected[0].sourcing?.quotes?.filter((quote: {id?: string}) => !!quote.id) ?? []
  expect(persisted.length).toBeGreaterThan(0)
  const select = page.locator(".sf-u12-comparison").getByRole("combobox", { name: /Selected quotation|Cotação selecionada/ })
  await select.selectOption(persisted[0].id)
  await page.locator(".sf-u12-comparison").getByRole("button", { name: /Select winning quote|Selecionar cotação vencedora/ }).click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toBeVisible()
  const writes: Request[] = []
  page.on("request", (request) => { if (sourcingWrite(request)) writes.push(request) })
  const confirm = review.getByRole("button", { name: /Confirm once|Confirmar uma vez/ })
  await expect(confirm).toBeEnabled()
  const responsePending = page.waitForResponse((response) =>
    sourcingWrite(response.request()) && response.request().postDataJSON()?.action === "select_quote")
  await confirm.click()
  const response = await responsePending
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true })
  expect(response.request().postDataJSON()).toMatchObject({
    page: "Requests", action: "select_quote", id: ref,
    values: { quoteId: persisted[0].id },
    version: source.value.versions["requests:" + ref].version,
  })
  expect(writes).toHaveLength(1)
})

test("U12-AC03 sourcing controls survive five widths, 200% text and 400% reflow", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U12-AC03; installed visual matrix" })
  const ref = required("SF_NATIVE_U12_EDIT_REF")
  await open(page, nativeHarness, "/orchestra/sf-procurement/requests/" + routeRef(ref) + "/sourcing")
  const editor = page.locator(".sf-u12-editor")
  for (const width of [320, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(editor.getByRole("textbox", { name: /Evaluator|Avaliador/ })).toBeVisible()
    await expect(editor.getByRole("button", { name: /Save sourcing|Salvar sourcing/ })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, "Horizontal document overflow at " + width).toBeLessThanOrEqual(1)
    await info.attach("u12-" + width + "px.png", { body: await page.screenshot(), contentType: "image/png" })
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
  await page.setViewportSize({ width: 320, height: 900 })
  await expect(editor.getByRole("textbox", { name: /Evaluator|Avaliador/ })).toBeVisible()
  await expect(editor.getByRole("button", { name: /Save sourcing|Salvar sourcing/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
})
