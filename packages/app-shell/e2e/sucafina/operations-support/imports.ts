import { createHash, randomUUID } from "node:crypto"
import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import type { APIResponse, Locator, Page, Response, TestInfo } from "@playwright/test"
import type { ImportManifest } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { ImportDetail, ImportReceiptSummary } from "../../../../../modules/sucafina/Sucafinav1/product/imports/store.ts"
import { login, modeURL, observation } from "./runtime.ts"
import type { Account } from "./runtime.ts"

// ExcelJS belongs to the existing Sucafina package. Resolve there under Bun's isolated workspace linker.
const { Workbook } = createRequire(new URL("../../../../../modules/sucafina/package.json", import.meta.url))("exceljs") as typeof import("../../../../../modules/sucafina/node_modules/exceljs")

type Detail = { detail: ImportDetail; digest: string; receipt?: ImportReceiptSummary }
type Reference = Detail & { manifest: ImportManifest }
type Destination = { label: string; selectionRef: string; surface: string; formats: string[] }

async function valueOf<T>(response: APIResponse | Response): Promise<T> {
  expect(response.status()).toBe(200)
  const body = await response.json() as { status: string; value: T }
  expect(body.status).toBe("ok")
  return body.value
}

/** Decode the application's own export, preserving its financial values and formulas. */
async function exported(page: Page, account: Account, version: string) {
  const response = await page.request.get(account.baseURL + "/planner?download=xlsx&version=" + encodeURIComponent(version), { maxRetries: 0 })
  expect(response.status()).toBe(200)
  const workbook = new Workbook()
  await workbook.xlsx.load(new Uint8Array(await response.body()).buffer)
  return Object.fromEntries(workbook.worksheets.map((sheet) => {
    const rows: unknown[][] = []
    sheet.eachRow((row) => {
      if (sheet.name === "Info" && row.getCell(1).value === "Exported") return
      rows.push(Array.from({ length: sheet.columnCount }, (_, column) => row.getCell(column + 1).value))
    })
    return [sheet.name, rows]
  }))
}

async function tokens(page: Page, account: Account, version: string, ids: string[]) {
  expect((await page.goto(`/orchestra/sf-planner/opex?${new URLSearchParams({ version })}`))?.status()).toBe(200)
  const result: Record<string, number> = {}
  for (const id of ids) {
    const row = page.locator("tbody tr").filter({ has: page.locator("code", { hasText: id }) })
    await expect(row).toHaveCount(1)
    await row.getByRole("button", { name: "Show details", exact: true }).click()
    const detail = page.locator("section.sf-u07-detail")
    const line = detail.locator("p").filter({ has: page.locator("code", { hasText: id }) })
    await expect(line).toHaveCount(1)
    const match = /Source revision:\s*(\d+)/.exec(await line.innerText())
    expect(match).not.toBeNull()
    const revision = Number(match![1])
    expect(Number.isSafeInteger(revision)).toBe(true)
    result[id] = revision
  }
  return result
}

function versionSave(page: Page, account: Account) {
  const path = new URL(account.baseURL).pathname + "/planner"
  return page.waitForResponse((response) => {
    const request = response.request()
    const url = new URL(request.url())
    return request.method() === "POST" && url.origin === account.origin && url.pathname === path && url.searchParams.get("page") === "Versions" && request.postDataJSON()?.action === "save"
  })
}

async function confirmVersion(page: Page, account: Account, opener: Locator) {
  await expect(opener).toBeEnabled()
  await opener.click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  await expect(review.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible()
  const confirm = review.getByRole("button", { name: "Confirm", exact: true })
  await expect(confirm).toBeEnabled()
  const pending = versionSave(page, account)
  await confirm.click()
  const response = await pending
  expect(response.status()).toBe(200)
  const body = await response.json() as { ok?: boolean; value?: unknown }
  expect(body).toMatchObject({ ok: true })
  return { response, body }
}

/** PR34 15df31a: actual XLSX admission, C02 preview, one Apply, delivery loss and read-only reconciliation. */
export async function importJourney(page: Page, info: TestInfo) {
  const account = await login(page, "first", "journey")
  const name = "Operations import " + randomUUID()
  const renewal = randomUUID(), fixed = randomUUID()
  const isMode = (url: string, mode: string) => {
    const candidate = new URL(url)
    return candidate.origin === account.origin && candidate.pathname === new URL(account.baseURL).pathname + "/planner" && candidate.searchParams.get("sf") === mode
  }
  const waiting = (mode: string, method = "GET") => {
    const response = page.waitForResponse((response) => isMode(response.url(), mode) && response.request().method() === method)
    // Admission can fail before the later preview/detail responses exist. Observe teardown
    // rejection eagerly; returning the original promise preserves every awaited failure.
    void response.catch(() => undefined)
    return response
  }
  expect((await page.goto("/orchestra/sf-planner/versions/new"))?.status()).toBe(200)
  const surface = page.locator('[data-sf-surface="CAP23"]')
  const created = await confirmVersion(page, account, surface.getByRole("button", { name: "Create first version", exact: true }))
  expect(created.response.request().postDataJSON()).toMatchObject({ page: "Versions", action: "save", confirmed: true, values: {} })
  expect(created.response.request().postDataJSON().id).toBeUndefined()
  const versionDetail = page.locator("[data-sf-record-detail]")
  await expect(versionDetail).toHaveCount(1)
  const identity = versionDetail.locator("p.sf-s01-secondary bdi")
  await expect(identity).toHaveText(/\S+/)
  const version = (await identity.innerText()).trim()
  expect(created.body.value).toBe(version)
  const year = versionDetail.locator("#sf-u46-year")
  await expect(year).toHaveValue(/^\d{4}$/)
  const nameField = versionDetail.locator("#sf-u46-name")
  await expect(nameField).toBeEnabled()
  await nameField.fill(name)
  const renamed = await confirmVersion(page, account, versionDetail.getByRole("button", { name: "Save", exact: true }))
  expect(renamed.response.request().postDataJSON()).toMatchObject({ page: "Versions", action: "save", id: version, confirmed: true, values: { name } })
  await expect(versionDetail.locator("#sf-u46-name")).toHaveValue(name)
  await expect(versionDetail.getByRole("heading", { name, exact: true })).toBeVisible()
  const fiscalYear = await year.inputValue()
  expect((await page.goto(`/orchestra/sf-planner/versions?${new URLSearchParams({ year: fiscalYear })}`))?.status()).toBe(200)
  const versionRow = page.locator("tr[data-sf-row]").filter({ has: page.getByText(name, { exact: true }) })
  await expect(versionRow).toHaveCount(1)
  expect(await versionRow.getAttribute("data-sf-row")).toBe(version)
  await expect(versionRow.locator(".sf-s01-cell-value")).toHaveText(name)
  await expect(versionRow.getByRole("cell").nth(1)).toHaveText(fiscalYear)
  // Seed isolated preconditions through the real domain; line creation is not claimed as UI coverage.
  for (const [id, label, amount] of [[renewal, "Renewal", 72000], [fixed, "Unchanged", 518000]] as const) {
    const response = await page.request.post(account.baseURL + "/planner", { maxRetries: 0, headers: { Origin: account.origin }, data: { page: "OPEX", action: "save", id, version: 0, values: { versionId: version, name: label, el: "licenses", cur: "USD", owner: account.principal, f0: amount } } })
    expect(response.status()).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true })
  }
  const reader = await page.context().newPage()
  const beforeTokens = await tokens(reader, account, version, [renewal, fixed])
  const before = await exported(reader, account, version)
  expect(before.OPEX?.filter((row) => row[0] === renewal || row[0] === fixed)).toHaveLength(6)
  expect(before.OPEX?.filter((row) => row[0] === renewal && row[8] === "Forecast").map((row) => row[9])).toEqual([72000])
  expect(before.OPEX?.filter((row) => row[0] === fixed && row[8] === "Forecast").map((row) => row[9])).toEqual([518000])
  const workbook = new Workbook()
  workbook.addWorksheet("OPEX").addRows([["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Jan"], [renewal, "Licenses", "Renewal", "USD", "Forecast", 84000]])
  const bytes = Buffer.from(await workbook.xlsx.writeBuffer())
  const sourceDigest = createHash("sha256").update(bytes).digest("hex")
  expect((await page.goto("/orchestra/sf-imports"))?.status()).toBe(200)
  const root = page.locator("[data-import-workbench]")
  await expect(root).toHaveCount(1)
  const status = root.locator(":scope > [role='status']")
  await expect(status).toHaveCount(1)
  const invalid = await page.request.post(modeURL(account, "planner", "import-preview").href, { maxRetries: 0, headers: { Origin: account.origin, "Idempotency-Key": randomUUID() }, data: { admittedFileRef: "invalid-schema-probe", format: "xlsx", options: { unknown: true } } })
  expect(invalid.status()).toBe(400)
  expect(await invalid.json()).toEqual({ status: "invalid" })
  const destinations = waiting("import-targets")
  await root.getByRole("button", { name: "Find destinations", exact: true }).click()
  const targets = await valueOf<Destination[]>(await destinations)
  expect(targets.filter((target) => target.label === name)).toHaveLength(1)
  const index = targets.findIndex((target) => target.label === name)
  expect(targets[index]).toMatchObject({ surface: "planner", formats: expect.arrayContaining(["xlsx"]) })
  await root.getByLabel("Destination", { exact: true }).selectOption(String(index))
  await root.getByLabel("File", { exact: true }).setInputFiles({ name: name + ".xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: bytes })
  await expect(root.getByLabel("Create a new Planner version", { exact: true })).not.toBeChecked()
  await expect(root.getByLabel("Remove records missing from supplied sheets", { exact: true })).not.toBeChecked()
  const admission = waiting("import-admit", "POST"), previewResponse = waiting("import-preview", "POST"), detailResponse = waiting("import-detail")
  await root.getByRole("button", { name: "Preview changes", exact: true }).click()
  const admissionTransport = await admission
  if (admissionTransport.status() !== 200) {
    const statusBody = await admissionTransport.json().catch(() => null) as { status?: unknown } | null
    // Preserve the original producer's denial; attach only the public status
    // category, never enrollment, selectors, source bytes or authority internals.
    await observation(info, "operations-import-admission-blocked", {
      stage: "import-admit", httpStatus: admissionTransport.status(),
      producerStatus: typeof statusBody?.status === "string" &&
        ["denied", "unavailable", "stale", "needs-input", "invalid", "conflict"].includes(statusBody.status)
        ? statusBody.status : "unclassified",
      scannerConfigured: Boolean(process.env.SF_OPERATIONS_CLAMD_PORT),
      syntheticApprovalUsed: false,
    })
  }
  const admitted = await valueOf<{ ref: string }>(admissionTransport)
  const previewTransport = await previewResponse
  expect(previewTransport.request().postDataJSON()).toEqual({ admittedFileRef: admitted.ref, format: "xlsx", options: {} })
  const preview = await valueOf<ImportManifest>(previewTransport)
  const detail = await valueOf<Detail>(await detailResponse)
  expect(preview).toMatchObject({ sourceDigest, format: "xlsx", state: "preview", domainApplied: false, receipts: [], issues: [], context: { principalRef: account.principal, surface: "planner" } })
  expect(preview.baseIdentity).toEqual([expect.objectContaining({ surface: "planner", type: "planner-version", id: version })])
  expect(preview.commands).toHaveLength(1)
  const command = preview.commands[0]!
  expect(command.target).toEqual(preview.baseIdentity[0])
  expect(command.preview.engineVersion).toBe("planner-runtime-v1")
  for (const [id, prior, next] of [[renewal, 72000, 84000], [fixed, 518000, 518000]] as const) {
    expect(command.preview.values.filter((value) => value.id === `before:${id}:1:forecast`)).toEqual([expect.objectContaining({ value: prior, currency: "USD" })])
    expect(command.preview.values.filter((value) => value.id === `after:${id}:1:forecast`)).toEqual([expect.objectContaining({ value: next, currency: "USD" })])
  }
  expect(detail.detail).toMatchObject({ manifestId: preview.id, version: preview.version, sourceDigest })
  expect(detail.receipt).toBeUndefined()
  expect(detail.detail.changes.filter((change) => change.path === `/versions/@id=${version}/lines/@id=${renewal}/f/0`)).toEqual([expect.objectContaining({ kind: "changed", before: { state: "present", value: 72000 }, after: { state: "present", value: 84000 }, source: { kind: "file", sheet: "OPEX", row: 2, column: 6, address: "F2", field: "Jan" } })])
  await expect(status).toHaveText("Review the simulation, including ignored and rejected items. Apply requires your explicit action.")
  expect(await exported(reader, account, version)).toEqual(before)
  expect(await tokens(reader, account, version, [renewal, fixed])).toEqual(beforeTokens)
  const applies: string[] = [], committed: ImportManifest[] = []
  page.on("request", (request) => { if (isMode(request.url(), "import-apply") && request.method() === "POST") applies.push(request.postData() ?? "") })
  // Send the real mutation once and discard only its delivery. No response is manufactured.
  await page.route((url) => isMode(url.href, "import-apply"), async (route) => {
    expect(route.request().postDataJSON()).toEqual({ manifestId: preview.id, version: preview.version })
    committed.push(await valueOf<ImportManifest>(await route.fetch({ maxRetries: 0 })))
    await route.abort("failed")
  }, { times: 1 })
  const failedDelivery = page.waitForEvent("requestfailed", (request) => isMode(request.url(), "import-apply"))
  const recoveredResponse = waiting("import-reference")
  await root.getByRole("button", { name: "Apply reviewed import", exact: true }).click()
  await failedDelivery
  const recovered = await valueOf<Reference>(await recoveredResponse)
  expect(committed).toHaveLength(1)
  expect(recovered.manifest).toEqual(committed[0])
  expect(recovered.manifest.receipts).toHaveLength(1)
  const receipt = recovered.manifest.receipts[0]!
  expect(recovered.manifest).toEqual({ ...preview, state: "applied", domainApplied: true, receipts: [receipt] })
  expect(receipt).toMatchObject({ idempotencyKey: command.idempotencyKey, commandDigest: command.commandDigest, targetIncarnation: command.target.incarnation, principalRef: account.principal, surface: "planner", status: "applied", errors: [] })
  expect(recovered.receipt).toMatchObject({ receiptId: receipt.id, manifestId: preview.id, idempotencyKey: command.idempotencyKey, commandDigest: command.commandDigest, outcome: "applied" })
  expect(recovered.receipt?.changedFields).toBeGreaterThan(0)
  expect(recovered.detail).toEqual(detail.detail)
  await expect(status).toHaveText("Confirmed receipt refreshed under your current access.")
  await expect(root.locator("[data-receipt]")).toContainText("Receipt: " + receipt.id)
  await expect(root.locator("[data-receipt]")).toContainText("Manifest: " + preview.id)
  await expect(root.locator("[data-receipt]")).toContainText("Actor: " + account.principal + " · Version: " + receipt.version)
  const after = await exported(reader, account, version)
  expect(after.OPEX?.filter((row) => row[0] === renewal && row[8] === "Forecast").map((row) => row[9])).toEqual([84000])
  expect(after.OPEX?.filter((row) => row[0] === fixed)).toEqual(before.OPEX?.filter((row) => row[0] === fixed))
  expect(after.OPEX?.filter((row) => row[0] === renewal || row[0] === fixed)).toHaveLength(6)
  expect(after.OPEX?.map((row) => [row[0], row[8]])).toEqual(before.OPEX?.map((row) => [row[0], row[8]]))
  expect(after.OPEX?.filter((row) => row[0] !== renewal || row[8] !== "Forecast")).toEqual(before.OPEX?.filter((row) => row[0] !== renewal || row[8] !== "Forecast"))
  const priorRow = before.OPEX!.find((row) => row[0] === renewal && row[8] === "Forecast")!
  const changedRow = after.OPEX!.find((row) => row[0] === renewal && row[8] === "Forecast")!
  expect(changedRow.slice(0, 9)).toEqual(priorRow.slice(0, 9))
  expect(changedRow.slice(10, 21)).toEqual(priorRow.slice(10, 21))
  expect(changedRow[21]).toEqual({ ...(priorRow[21] as { formula: string }), result: 84000 })
  for (const sheet of Object.keys(before).filter((name) => name !== "OPEX")) expect(after[sheet]).toEqual(before[sheet])
  const afterTokens = await tokens(reader, account, version, [renewal, fixed])
  expect(afterTokens).toEqual({ [renewal]: beforeTokens[renewal]! + 1, [fixed]: beforeTokens[fixed] })
  const refreshed = waiting("import-reference")
  await root.getByRole("button", { name: "Refresh receipt", exact: true }).click()
  expect(await valueOf<Reference>(await refreshed)).toEqual(recovered)
  const reloaded = waiting("import-reference")
  expect((await page.goto("/orchestra/sf-imports"))?.status()).toBe(200)
  expect(await valueOf<Reference>(await reloaded)).toEqual(recovered)
  await expect(root.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeDisabled()
  expect(applies).toEqual([JSON.stringify({ manifestId: preview.id, version: preview.version })])
  expect(await exported(reader, account, version)).toEqual(after)
  expect(await tokens(reader, account, version, [renewal, fixed])).toEqual(afterTokens)
  const viewerPage = await page.context().newPage()
  const viewer = await login(viewerPage, "viewer", "journey")
  // Sign out in the same operator's reader tab while the workbench retains the previously valid reference.
  const signedOut = reader.waitForResponse((response) => response.url() === account.baseURL + "/auth/logout" && response.request().method() === "POST")
  await reader.getByRole("button", { name: "Sign out", exact: true }).click()
  expect((await signedOut).status()).toBe(204)
  const denied = waiting("import-reference")
  await root.getByRole("button", { name: "Refresh receipt", exact: true }).click()
  const deniedResponse = await denied
  expect(deniedResponse.status()).toBe(403)
  expect(await deniedResponse.json()).toEqual({ status: "denied" })
  await expect(status).toHaveText("Access changed. The previous preview is no longer available.")
  for (const selector of ["[data-context]", "[data-impact]", "[data-changes]", "[data-receipt]"]) await expect(root.locator(selector)).toBeEmpty()
  await expect(root.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeDisabled()
  expect(applies).toHaveLength(1)
  const visibleAfterRevocation = await exported(viewerPage, viewer, version)
  expect(visibleAfterRevocation.OPEX).toEqual(after.OPEX)
  await observation(info, "operations-import-real-receipt", { version, renewal, fixed, sourceDigest, manifest: recovered.manifest, receipt: recovered.receipt, beforeTokens, afterTokens, applyRequests: applies.length, recovery: "real Apply response delivery lost; automatic GET, Refresh receipt, reload", revocation: "same credential logged out; cached reference denied" })
  await reader.close()
  await viewerPage.close()
}
