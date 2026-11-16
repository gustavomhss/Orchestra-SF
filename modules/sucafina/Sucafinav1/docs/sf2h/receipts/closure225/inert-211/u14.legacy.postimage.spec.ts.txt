/**
 * N23/U14 CAP27 complete supplier lifecycle on a real installed producer.
 * Bank facts remain source-masked; no browser-built CSV or fake authority.
 * 150 executes only with its F04 private host/candidate binding.
 */
import { expect, type Page, type Request } from "@playwright/test"
import { nativeInstalledFixture as test, type InstalledNativeHarness } from "../fixture"

test.describe.configure({ retries: 0 })
test.use({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" })

function required(key: string): string {
  const value = process.env[key]
  if (!value?.trim()) throw new Error("U14_REAL_INSTALLED_FIXTURE_REQUIRED:" + key)
  return value
}
const routeRef = (value: string) => "r_" + Buffer.from(value, "utf8").toString("base64url")
const supplierWrite = (request: Request) => {
  const url = new URL(request.url())
  return request.method() === "POST" && url.pathname.endsWith("/procurement") &&
    url.searchParams.get("page") === "Suppliers"
}
async function open(page: Page, harness: InstalledNativeHarness, path: string) {
  const target = harness.manifest.target
  const chapter = new URL(target.chapterHref, target.shellOrigin)
  await page.goto(chapter.href)
  await harness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const dest = new URL(path, target.shellOrigin)
  dest.search = chapter.search
  if (dest.origin !== target.shellOrigin) throw new Error("U14_CROSS_OWNER_ROUTE")
  const sourcePending = page.waitForResponse((response) => response.request().method() === "GET" &&
    new URL(response.url()).pathname.endsWith("/api/ui/pages/CAP27"))
  await page.goto(dest.href)
  const response = await sourcePending
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.status).toBe("ok")
  expect(body.value.capabilityId).toBe("CAP27")
  await expect(page.locator(".sf-u14-layout")).toBeVisible()
  return body
}

test("U14-AC01/02 supplier source list retains filters and downloads only original admitted CSV", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U14-AC01/02; source suppliers and denied CSV adapter" })
  const writes: Request[] = []
  page.on("request", (request) => { if (supplierWrite(request)) writes.push(request) })
  const source = await open(page, nativeHarness, "/orchestra/sf-procurement/suppliers")
  expect(source.value.data.suppliers.length).toBeGreaterThan(0)
  const root = page.locator(".sf-u14-layout")
  const table = root.locator(".sf-s01-table")
  await expect(table.locator("tbody tr[data-sf-row]")).toHaveCount(source.value.data.suppliers.length)
  const search = root.getByRole("searchbox")
  await search.fill("~~no-supplier-matches-this-f04-only-filter~~")
  await expect(table).toHaveAttribute("data-sf-table-state", "filtered-empty")
  await expect(search).toHaveValue("~~no-supplier-matches-this-f04-only-filter~~")
  const csv = page.locator('[data-sf-frame="page"]').getByRole("button", { name: /Export suppliers CSV|Exportar CSV de fornecedores/ })
  await expect(csv).toBeEnabled()
  const producer = page.waitForResponse((response) => {
    const u = new URL(response.url())
    return response.request().method() === "GET" && u.pathname.endsWith("/procurement") &&
      u.searchParams.get("download") === "suppliers"
  })
  const saved = page.waitForEvent("download")
  await csv.click()
  const response = await producer, download = await saved
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toMatch(/^text\/csv;\s*charset=utf-8$/i)
  expect(response.headers()["content-disposition"]).toBe("attachment; filename*=UTF-8''suppliers.csv")
  expect(download.suggestedFilename()).toBe("suppliers.csv")
  expect(writes).toHaveLength(0)
})

test("U14-AC01 general supplier save uses one original producer CAS and never writes bank fields", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U14-AC01/02; general edit/version, one source command, bank redaction" })
  const ref = required("SF_NATIVE_U14_EDIT_REF")
  const writes: Request[] = []
  page.on("request", (request) => { if (supplierWrite(request)) writes.push(request) })
  const source = await open(page, nativeHarness, "/orchestra/sf-procurement/suppliers/" + routeRef(ref) + "/edit")
  const original = source.value.versions["suppliers:" + ref]?.version
  expect(Number.isSafeInteger(original)).toBe(true)
  const editor = page.locator(".sf-u14-editor")
  const name = editor.getByRole("textbox", { name: /Legal name|Razão social/ })
  await expect(name).toBeEditable()
  const next = (await name.inputValue()) + " N23 installed CAS"
  await name.fill(next)
  await editor.getByRole("button", { name: /Save supplier|Salvar fornecedor/ }).click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toBeVisible()
  expect(writes).toHaveLength(0)
  const confirm = review.getByRole("button", { name: /Confirm once|Confirmar uma vez/ })
  await expect(confirm).toBeEnabled()
  const responsePending = page.waitForResponse((response) =>
    supplierWrite(response.request()) && response.request().postDataJSON()?.action === "save")
  await confirm.click()
  const response = await responsePending
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true })
  const body = response.request().postDataJSON()
  expect(body).toMatchObject({ page: "Suppliers", action: "save", id: ref, version: original,
    values: { supplier: { legalName: next } } })
  for (const key of ["iban", "account", "swift", "bankName", "accountHolder", "bankCountry"])
    expect(body.values.supplier).not.toHaveProperty(key)
  expect(writes).toHaveLength(1)
  expect(response.request().headers()["idempotency-key"]).toEqual(expect.any(String))
})

test("U14-AC01 bank section never exposes protected value and deletion is not an unconditional control", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U14-AC01; bank mask, linked requests, pending-only delete" })
  const ref = required("SF_NATIVE_U14_BANK_REF")
  const source = await open(page, nativeHarness, "/orchestra/sf-procurement/suppliers/" + routeRef(ref))
  const rows = source.value.data.suppliers.filter((row: {id: string}) => row.id === ref)
  expect(rows).toHaveLength(1)
  const root = page.locator(".sf-u14-layout")
  const bank = root.locator('[data-sf-section="bank"]')
  await expect(bank).toBeVisible()
  if (source.value.allowedActionIds.includes("change-bank") &&
      source.value.data.bankVerificationAvailable === true) {
    await expect(bank.getByText(/Bank details are masked|Dados bancários ocultos/)).toBeVisible()
  } else {
    await expect(bank.locator('[data-sf-state="denied"]')).toBeVisible()
    await expect(bank.getByRole("button", { name: /Review bank change|Revisar alteração bancária/ })).toHaveCount(0)
  }
  await expect(root.locator('[data-sf-section="linked"]')).toBeVisible()
  if (rows[0].status !== "pending") {
    const deletion = root.getByRole("button", { name: /Delete pending supplier|Excluir fornecedor pendente/ })
    if (await deletion.count()) await expect(deletion).toBeDisabled()
  }
  const csv = page.locator('[data-sf-frame="page"]').getByRole("button", { name: /Export suppliers CSV|Exportar CSV de fornecedores/ })
  if (await csv.isEnabled())
    await expect(root.getByText(/CSV export requires|Exportação CSV exige/)).toHaveCount(0)
  else
    await expect(root.getByText(/CSV export requires|Exportação CSV exige/)).toBeVisible()
})

test("U14-AC02 lost supplier command cannot be replayed by refreshing the source", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U14-AC02; real post-commit response loss; never retry" })
  const ref = required("SF_NATIVE_U14_LOST_RESPONSE_REF")
  const writes: Request[] = []
  page.on("request", (request) => { if (supplierWrite(request)) writes.push(request) })
  await open(page, nativeHarness, "/orchestra/sf-procurement/suppliers/" + routeRef(ref) + "/edit")
  const editor = page.locator(".sf-u14-editor")
  const name = editor.getByRole("textbox", { name: /Legal name|Razão social/ })
  await expect(name).toBeEditable()
  await name.fill((await name.inputValue()) + " N23 lost response")
  await editor.getByRole("button", { name: /Save supplier|Salvar fornecedor/ }).click()
  const confirm = page.locator('[data-component="sf-change-review"]').getByRole("button", { name: /Confirm once|Confirmar uma vez/ })
  await expect(confirm).toBeEnabled()
  await confirm.click()
  const root = page.locator(".sf-u14-layout")
  await expect(root.getByRole("alert")).toContainText(/Command outcome is unknown|Resultado do comando desconhecido/)
  await expect(root.locator(".sf-u14-editor")).toHaveCount(0)
  expect(writes).toHaveLength(1)
  await root.getByRole("button", { name: /Refresh from source|Atualizar pela fonte/ }).click()
  expect(writes).toHaveLength(1)
})

test("U14-AC03 supplier fields and actions reflow at five widths and 200% text", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U14-AC03; installed 320/768/1024/1280/1440 + 400% reflow" })
  const ref = required("SF_NATIVE_U14_EDIT_REF")
  await open(page, nativeHarness, "/orchestra/sf-procurement/suppliers/" + routeRef(ref) + "/edit")
  const editor = page.locator(".sf-u14-editor")
  for (const width of [320, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(editor.getByRole("textbox", { name: /Legal name|Razão social/ })).toBeVisible()
    await expect(editor.getByRole("button", { name: /Save supplier|Salvar fornecedor/ })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    await info.attach("u14-" + width + "px.png", { body: await page.screenshot(), contentType: "image/png" })
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
  await page.setViewportSize({ width: 320, height: 900 })
  await expect(editor.getByRole("textbox", { name: /Legal name|Razão social/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
})
