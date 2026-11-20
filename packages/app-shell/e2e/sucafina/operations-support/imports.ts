import { createHash, randomUUID } from "node:crypto"
import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { Schema } from "effect"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import type { APIResponse, Locator, Page, TestInfo } from "@playwright/test"
import type { ImportManifest } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { ImportDetail, ImportReceiptSummary } from "../../../../../modules/sucafina/Sucafinav1/product/imports/store.ts"
import { captureCommandResponse, chapterURL, login, modeURL, observation } from "./runtime.ts"
import type { Account } from "./runtime.ts"
import { retainedFor, retainResponses } from "../reports-support/retained-response.ts"

// ExcelJS belongs to the existing Sucafina package. Resolve there under Bun's isolated workspace linker.
const { Workbook } = createRequire(new URL("../../../../../modules/sucafina/package.json", import.meta.url))("exceljs") as typeof import("../../../../../modules/sucafina/node_modules/exceljs")

type Detail = { detail: ImportDetail; digest: string; receipt?: ImportReceiptSummary }
type Reference = Detail & { manifest: ImportManifest }
type Destination = { label: string; selectionRef: string; surface: string; formats: string[] }

async function valueOf<T>(response: Pick<APIResponse, "status" | "json">): Promise<T> {
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

async function tokens(page: Page, account: Account, version: string, year: string, ids: string[]) {
  expect((await page.goto(chapterURL(account, `/orchestra/sf-planner/opex?${new URLSearchParams({ version, year })}`).href))?.status()).toBe(200)
  const result: Record<string, number> = {}
  for (const id of ids) {
    const row = page.locator(`tr[data-sf-row="${id}"]`)
    await expect(row).toHaveCount(1)
    await row.getByRole("button", { name: "Manage", exact: true }).click()
    const detail = page.getByRole("region", { name: "Manage record", exact: true })
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

async function confirmVersion(page: Page, account: Account, opener: Locator) {
  await expect(opener).toBeEnabled()
  await opener.click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  await expect(review.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible()
  const confirm = review.getByRole("button", { name: "Confirm", exact: true })
  await expect(confirm).toBeEnabled()
  const response = await captureCommandResponse(page, account, "planner", { page: "Versions", action: "save" }, confirm)
  expect(response.status).toBe(200)
  expect(response.body).toMatchObject({ ok: true })
  return response
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
  const endpoint = account.baseURL + "/planner"
  const beforeVersionsResponse = await page.request.get(account.baseURL + "/api/ui/pages/CAP23")
  expect(beforeVersionsResponse.status()).toBe(200)
  const beforeVersions = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP23"].output)(await beforeVersionsResponse.json())
  expect(beforeVersions.status).toBe("ok")
  if (beforeVersions.status !== "ok") throw new Error("The installed Planner versions were not admitted")
  expect((await page.goto(chapterURL(account, "/orchestra/sf-planner/versions/new").href))?.status()).toBe(200)
  const surface = page.locator('[data-sf-surface="CAP23"]')
  const created = await confirmVersion(page, account, surface.getByRole("button", { name: "Create first version", exact: true }))
  expect(created.command).toMatchObject({ page: "Versions", action: "save", confirmed: true, values: {} })
  expect(created.command).not.toHaveProperty("id")
  await expect(page.locator('[data-component="sf-change-review"]')).toHaveCount(0)
  const afterVersionsResponse = await page.request.get(account.baseURL + "/api/ui/pages/CAP23")
  expect(afterVersionsResponse.status()).toBe(200)
  const afterVersions = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP23"].output)(await afterVersionsResponse.json())
  expect(afterVersions.status).toBe("ok")
  if (afterVersions.status !== "ok") throw new Error("The installed Planner readback was not admitted")
  const inserted = afterVersions.value.data.versions.filter((record) =>
    !beforeVersions.value.data.versions.some((before) => before.id === record.id))
  expect(inserted).toHaveLength(1)
  const persisted = inserted[0]!
  const version = persisted.id
  expect((await page.goto(chapterURL(account, "/orchestra/sf-planner/versions?" + new URLSearchParams({ year: String(persisted.year) })).href))?.status()).toBe(200)
  const insertedRow = page.locator(`tr[data-sf-row="${version}"]`)
  await expect(insertedRow).toHaveCount(1)
  await expect(insertedRow.locator(".sf-s01-cell-value")).toHaveText(persisted.name)
  await insertedRow.locator('button[data-sf-action="select"]').click()
  const versionDetail = page.locator("[data-sf-record-detail]")
  await expect(versionDetail).toHaveCount(1)
  const identity = versionDetail.locator("p.sf-s01-secondary bdi")
  await expect(identity).toHaveText(version)
  const year = versionDetail.locator("#sf-u46-year")
  await expect(year).toHaveValue(/^\d{4}$/)
  const nameField = versionDetail.locator("#sf-u46-name")
  await expect(nameField).toBeEnabled()
  await nameField.fill(name)
  const renamed = await confirmVersion(page, account, versionDetail.getByRole("button", { name: "Save", exact: true }))
  expect(renamed.command).toMatchObject({ page: "Versions", action: "save", id: version, confirmed: true, values: { name } })
  await expect(versionDetail.locator("#sf-u46-name")).toHaveValue(name)
  await expect(versionDetail.getByRole("heading", { name, exact: true })).toBeVisible()
  const fiscalYear = await year.inputValue()
  expect((await page.goto(chapterURL(account, `/orchestra/sf-planner/versions?${new URLSearchParams({ year: fiscalYear })}`).href))?.status()).toBe(200)
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
  const beforeTokens = await tokens(reader, account, version, fiscalYear, [renewal, fixed])
  const before = await exported(reader, account, version)
  expect(before.OPEX?.filter((row) => row[0] === renewal || row[0] === fixed)).toHaveLength(6)
  expect(before.OPEX?.filter((row) => row[0] === renewal && row[8] === "Forecast").map((row) => row[9])).toEqual([72000])
  expect(before.OPEX?.filter((row) => row[0] === fixed && row[8] === "Forecast").map((row) => row[9])).toEqual([518000])
  const workbook = new Workbook()
  workbook.addWorksheet("OPEX").addRows([["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Jan"], [renewal, "Licenses", "Renewal", "USD", "Forecast", 84000]])
  const bytes = Buffer.from(await workbook.xlsx.writeBuffer())
  const sourceDigest = createHash("sha256").update(bytes).digest("hex")
  expect((await page.goto(chapterURL(account, "/orchestra/sf-imports/new").href))?.status()).toBe(200)
  const root = page.locator('[data-sf-leaf="u23"][data-sf-surface="UI55"]')
  await expect(root).toHaveCount(1)
  await expect(root).toHaveAttribute("data-sf-read-state", "ready")
  await expect(root.locator('.sf-state-panel[data-sf-state="ready"]')).toHaveCount(1)
  await expect(root.getByLabel("source", { exact: true })).toHaveValue("planner")
  const invalid = await page.request.post(modeURL(account, "planner", "import-preview").href, { maxRetries: 0, headers: { Origin: account.origin, "Idempotency-Key": randomUUID() }, data: { admittedFileRef: "invalid-schema-probe", format: "xlsx", options: { unknown: true } } })
  expect(invalid.status()).toBe(400)
  expect(await invalid.json()).toEqual({ status: "invalid" })
  const find = root.getByRole("button", { name: "Find destinations", exact: true })
  await expect(find).toBeEnabled()
  const [destinations] = await retainResponses(page,
    [{ ...retainedFor(endpoint, "import-targets", "GET"), query: { sf: "import-targets", surface: "planner" } }],
    () => find.click())
  const targets = await valueOf<Destination[]>(destinations)
  const matched = targets.filter((target) => target.label === name)
  expect(matched).toHaveLength(1)
  const target = matched[0]!
  expect(target).toMatchObject({ surface: "planner", formats: expect.arrayContaining(["xlsx"]) })
  expect(target.selectionRef).not.toBe("")
  const destination = root.getByLabel("Destination", { exact: true })
  await expect(destination).toBeEnabled()
  await destination.selectOption(target.selectionRef)
  await expect(destination).toHaveValue(target.selectionRef)
  await root.getByLabel("File", { exact: true }).setInputFiles({ name: name + ".xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: bytes })
  await expect(root.getByLabel("Create a new Planner version", { exact: true })).not.toBeChecked()
  await expect(root.getByLabel("Remove records missing from supplied sheets", { exact: true })).not.toBeChecked()
  const generate = root.getByRole("button", { name: "Generate preview", exact: true })
  await expect(generate).toBeEnabled()
  // Multipart admission stays on its original Response; its payload is not a
  // JSON identity accepted by the retained-response observer.
  const admittedResponse = page.waitForResponse((response) =>
    isMode(response.url(), "import-admit") && response.request().method() === "POST").then(async (response) => {
    if (response.status() !== 200) {
      const statusBody = await response.json().catch(() => null) as { status?: unknown } | null
      // Keep the original denial. No enrollment, selectors, bytes or authority internals leave this diagnostic.
      await observation(info, "operations-import-admission-blocked", {
        stage: "import-admit", httpStatus: response.status(),
        producerStatus: typeof statusBody?.status === "string" &&
          ["denied", "unavailable", "stale", "needs-input", "invalid", "conflict"].includes(statusBody.status)
          ? statusBody.status : "unclassified",
        scannerConfigured: Boolean(process.env.SF_OPERATIONS_CLAMD_PORT),
        syntheticApprovalUsed: false,
      })
    }
    return valueOf<{ ref: string }>(response)
  })
  // If admission fails, propagate that assertion from the capture action too;
  // waiting for a preview that was correctly refused must not conceal its cause.
  const capturedPreview = retainResponses(page, [
    retainedFor(endpoint, "import-preview", "POST"),
    retainedFor(endpoint, "import-reference", "GET"),
  ], async () => { await generate.click(); await admittedResponse })
  const [admitted, [previewTransport, referenceTransport]] = await Promise.all([admittedResponse, capturedPreview])
  expect(previewTransport.request().postDataJSON()).toEqual({ admittedFileRef: admitted.ref, format: "xlsx", options: {} })
  const preview = await valueOf<ImportManifest>(previewTransport)
  const reference = await valueOf<Reference>(referenceTransport)
  expect(new URL(referenceTransport.url()).searchParams.get("importPreviewRef")).toBe(preview.id)
  expect(reference.manifest).toEqual(preview)
  expect(reference.digest).not.toBe("")
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
  expect(reference.detail).toMatchObject({ manifestId: preview.id, version: preview.version, sourceDigest })
  expect(reference.receipt).toBeUndefined()
  const changedPath = `/versions/@id=${version}/lines/@id=${renewal}/f/0`
  expect(reference.detail.changes.filter((change) => change.path === changedPath)).toEqual([expect.objectContaining({ kind: "changed", before: { state: "present", value: 72000 }, after: { state: "present", value: 84000 }, source: { kind: "file", sheet: "OPEX", row: 2, column: 6, address: "F2", field: "Jan" } })])
  await expect(root).toHaveAttribute("data-sf-phase", "reviewing")
  await expect(root).toHaveAttribute("data-sf-read-state", "ready")
  await expect(root.getByRole("heading", { name: "Simulation · no domain changes applied", exact: true })).toBeVisible()
  const changes = root.getByRole("region", { name: "Item and field changes", exact: true })
  await expect(changes).toHaveCount(1)
  for (const kind of ["added", "changed", "removed", "unchanged", "ignored", "rejected"] as const)
    await expect(changes.getByText(kind + " (" + reference.detail.changes.filter((change) => change.kind === kind).length + ")", { exact: true })).toBeVisible()
  await changes.getByText("changed (" + reference.detail.changes.filter((change) => change.kind === "changed").length + ")", { exact: true }).click()
  const changedField = changes.locator("article.sf-files-change").filter({ has: page.getByRole("heading", { name: changedPath, exact: true }) })
  await expect(changedField).toHaveCount(1)
  await expect(changedField.getByText("72000 → 84000", { exact: true })).toBeVisible()
  await expect(changedField.getByText("OPEX · row 2, column 6 · F2", { exact: true })).toBeVisible()
  const apply = root.getByRole("button", { name: "Apply reviewed import", exact: true })
  await expect(apply).toBeEnabled()
  expect(await exported(reader, account, version)).toEqual(before)
  expect(await tokens(reader, account, version, fiscalYear, [renewal, fixed])).toEqual(beforeTokens)
  const applies: string[] = [], committed: ImportManifest[] = []
  page.on("request", (request) => { if (isMode(request.url(), "import-apply") && request.method() === "POST") applies.push(request.postData() ?? "") })
  // Send the real mutation once and discard only its delivery. No response is manufactured.
  await page.route((url) => isMode(url.href, "import-apply"), async (route) => {
    expect(route.request().postDataJSON()).toEqual({ manifestId: preview.id, version: preview.version })
    committed.push(await valueOf<ImportManifest>(await route.fetch({ maxRetries: 0 })))
    await route.abort("failed")
  }, { times: 1 })
  const referenceTarget = {
    ...retainedFor(endpoint, "import-reference", "GET"),
    query: { sf: "import-reference", importPreviewRef: preview.id },
  }
  const failedDelivery = page.waitForEvent("requestfailed", (request) =>
    isMode(request.url(), "import-apply") && request.method() === "POST")
  void failedDelivery.catch(() => undefined)
  // This GET precedes the POST and must still be the reviewed, unapplied source.
  // The deliberately aborted Apply is never a retained-response target.
  const [beforeApply] = await retainResponses(page, [referenceTarget],
    async () => { await apply.click(); await failedDelivery })
  expect(await valueOf<Reference>(beforeApply)).toEqual(reference)
  expect(committed).toHaveLength(1)
  expect(applies).toEqual([JSON.stringify({ manifestId: preview.id, version: preview.version })])
  await expect(root).toHaveAttribute("data-sf-phase", "unknown")
  await expect(root).toHaveAttribute("data-sf-read-state", "outcome-unknown")
  const unknown = root.locator('.sf-state-panel[data-sf-state="outcome-unknown"]')
  await expect(unknown).toHaveCount(1)
  await expect(apply).toHaveCount(0)
  const reconcile = unknown.getByRole("button", { name: "Checking the outcome…", exact: true })
  await expect(reconcile).toHaveCount(1)
  await expect(reconcile).toBeEnabled()
  // Register only after the original POST failed delivery; a fresh pre-Apply
  // reference cannot satisfy this read-only recovery.
  const [recoveredResponse] = await retainResponses(page, [referenceTarget], () => reconcile.click())
  const recovered = await valueOf<Reference>(recoveredResponse)
  expect(recovered.manifest).toEqual(committed[0])
  expect(recovered.manifest.receipts).toHaveLength(1)
  const receipt = recovered.manifest.receipts[0]!
  expect(recovered.manifest).toEqual({ ...preview, state: "applied", domainApplied: true, receipts: [receipt] })
  expect(receipt).toMatchObject({ idempotencyKey: command.idempotencyKey, commandDigest: command.commandDigest, targetIncarnation: command.target.incarnation, principalRef: account.principal, surface: "planner", status: "applied", errors: [] })
  expect(recovered.receipt).toMatchObject({ receiptId: receipt.id, manifestId: preview.id, idempotencyKey: command.idempotencyKey, commandDigest: command.commandDigest, outcome: "applied" })
  expect(recovered.receipt?.changedFields).toBeGreaterThan(0)
  expect(recovered.detail).toEqual(reference.detail)
  expect(recovered.digest).not.toBe(reference.digest)
  const visibleReceipt = async (surface: Locator) => {
    await expect(surface).toHaveCount(1)
    await expect(surface).toHaveAttribute("data-sf-read-state", "ready")
    await expect(surface).toHaveAttribute("data-sf-phase", "receipt")
    const recorded = surface.locator('[data-sf-receipt="producer"]')
    await expect(recorded).toHaveCount(1)
    await expect(recorded.getByRole("heading", { name: "Confirmed receipt", exact: true })).toBeVisible()
    await expect(recorded.getByText(receipt.id + " · Outcome: applied · " + recovered.receipt!.changedFields, { exact: true })).toBeVisible()
    await expect(recorded.getByText("Manifest: " + preview.id, { exact: true })).toBeVisible()
    await expect(recorded.getByText("Actor: " + account.principal + " · Version: " + receipt.version, { exact: true })).toBeVisible()
  }
  await visibleReceipt(root)
  await expect(apply).toBeDisabled()
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
  const afterTokens = await tokens(reader, account, version, fiscalYear, [renewal, fixed])
  expect(afterTokens).toEqual({ [renewal]: beforeTokens[renewal]! + 1, [fixed]: beforeTokens[fixed] })
  const [refreshed] = await retainResponses(page, [referenceTarget],
    () => root.getByRole("button", { name: "Refresh receipt", exact: true }).click())
  expect(await valueOf<Reference>(refreshed)).toEqual(recovered)
  await visibleReceipt(root)
  const receiptPath = "/orchestra/sf-imports/r_" + Buffer.from(preview.id, "utf8").toString("base64url") + "/receipt"
  const result = root.getByRole("link", { name: "View result", exact: true })
  await expect(result).toHaveAttribute("href", receiptPath)
  await result.click()
  await expect(page).toHaveURL((url) => url.origin === account.origin && url.pathname === receiptPath)
  const receiptPage = page.locator('[data-sf-leaf="u23"][data-sf-surface="UI57"]')
  await expect(receiptPage).toHaveCount(1)
  await expect(receiptPage).toHaveAttribute("data-sf-read-state", "ready")
  await expect(receiptPage.locator('[data-sf-receipt="producer"]')).toHaveCount(0)
  // UI57 intentionally requires an explicit original-source read on entry/reload.
  // Scope to the source controls: after a receipt loads, its action bar also has Refresh receipt.
  const refresh = receiptPage.locator(".sf-files-fields").getByRole("button", { name: "Refresh receipt", exact: true })
  await expect(refresh).toHaveCount(1)
  await expect(refresh).toBeEnabled()
  const [entered] = await retainResponses(page, [referenceTarget], () => refresh.click())
  expect(await valueOf<Reference>(entered)).toEqual(recovered)
  await visibleReceipt(receiptPage)
  expect((await page.reload())?.status()).toBe(200)
  await expect(receiptPage).toHaveAttribute("data-sf-read-state", "ready")
  await expect(receiptPage.locator('[data-sf-receipt="producer"]')).toHaveCount(0)
  await expect(refresh).toBeEnabled()
  const [reloaded] = await retainResponses(page, [referenceTarget], () => refresh.click())
  expect(await valueOf<Reference>(reloaded)).toEqual(recovered)
  await visibleReceipt(receiptPage)
  await expect(receiptPage.getByRole("button", { name: "Apply reviewed import", exact: true })).toHaveCount(0)
  // The new-import page must not restore a private selection or a reusable Apply.
  expect((await page.goto(chapterURL(account, "/orchestra/sf-imports/new").href))?.status()).toBe(200)
  await expect(root).toHaveAttribute("data-sf-read-state", "ready")
  await expect(destination).toHaveValue("")
  await expect(root.getByLabel("File", { exact: true })).toHaveValue("")
  await expect(root.locator('[data-sf-receipt="producer"]')).toHaveCount(0)
  await expect(generate).toBeDisabled()
  await expect(apply).toHaveCount(0)
  expect((await page.goto(chapterURL(account, receiptPath).href))?.status()).toBe(200)
  await expect(receiptPage).toHaveAttribute("data-sf-read-state", "ready")
  await expect(refresh).toBeEnabled()
  const [reentered] = await retainResponses(page, [referenceTarget], () => refresh.click())
  expect(await valueOf<Reference>(reentered)).toEqual(recovered)
  await visibleReceipt(receiptPage)
  expect(applies).toEqual([JSON.stringify({ manifestId: preview.id, version: preview.version })])
  expect(await exported(reader, account, version)).toEqual(after)
  expect(await tokens(reader, account, version, fiscalYear, [renewal, fixed])).toEqual(afterTokens)
  const browser = page.context().browser()
  if (!browser) throw new Error("Operations requires an isolated viewer browser context")
  const viewerContext = await browser.newContext({ baseURL: account.origin })
  const viewerPage = await viewerContext.newPage()
  const viewer = await login(viewerPage, "viewer", "journey")
  expect(viewer.principal).not.toBe(account.principal)
  expect([viewer.installationId, viewer.projectId]).toEqual([account.installationId, account.projectId])
  const crossOwner = await viewerPage.request.get(modeURL(viewer, "planner", "import-reference", { importPreviewRef: preview.id }).href, { maxRetries: 0 })
  expect(crossOwner.status()).toBe(403)
  expect(await crossOwner.json()).toEqual({ status: "denied" })
  // Sign out in the original operator's reader tab while UI57 retains a valid receipt.
  const signedOut = reader.waitForResponse((response) => response.url() === account.baseURL + "/auth/logout" && response.request().method() === "POST")
  await reader.getByRole("button", { name: "Sign out", exact: true }).click()
  expect((await signedOut).status()).toBe(204)
  const [denied] = await retainResponses(page, [referenceTarget], () => refresh.click())
  expect(denied.status()).toBe(403)
  expect(await denied.json()).toEqual({ status: "denied" })
  await expect(receiptPage).toHaveAttribute("data-sf-read-state", "denied")
  const deniedState = receiptPage.locator('.sf-state-panel[data-sf-state="denied"]')
  await expect(deniedState).toHaveCount(1)
  await expect(deniedState.getByRole("alert")).toHaveText("You do not have access to this content.")
  await expect(receiptPage.locator(".sf-state-content")).toHaveCount(0)
  await expect(receiptPage.getByRole("region", { name: "Domain impact", exact: true })).toHaveCount(0)
  await expect(receiptPage.getByRole("region", { name: "Item and field changes", exact: true })).toHaveCount(0)
  await expect(receiptPage.locator('[data-sf-receipt="producer"]')).toHaveCount(0)
  await expect(receiptPage.getByRole("button", { name: "Apply reviewed import", exact: true })).toHaveCount(0)
  expect(applies).toHaveLength(1)
  const visibleAfterRevocation = await exported(viewerPage, viewer, version)
  expect(visibleAfterRevocation.OPEX).toEqual(after.OPEX)
  await observation(info, "operations-import-real-receipt", { version, renewal, fixed, sourceDigest, manifest: recovered.manifest, receipt: recovered.receipt, beforeTokens, afterTokens, applyRequests: applies.length, recovery: "real Apply response delivery lost; explicit reconciliation, Refresh receipt, canonical receipt reload and reentry", crossOwner: "different authenticated viewer denied the original reference; fresh export remains authorized", revocation: "same credential logged out; cached reference denied and private DOM removed" })
  await reader.close()
  await viewerContext.close()
}
