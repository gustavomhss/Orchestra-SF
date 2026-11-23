import { captureWorkflowState, type WorkflowCapture } from "../design-support/workflow-polish-capture"
import { createHash, randomUUID } from "node:crypto"
import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { Schema } from "effect"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import type { APIResponse, Locator, Page, Request, Response, Route, TestInfo } from "@playwright/test"
import type { ImportManifest } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { ImportDetail, ImportReceiptSummary } from "../../../../../modules/sucafina/Sucafinav1/product/imports/store.ts"
import { chapterURL, forwardOnce, login, modeURL, observation } from "./runtime.ts"
import type { Account } from "./runtime.ts"
import { captureRecord, captureRecordVariants, captureRecordDetail, capturePortugueseRecord } from "./final-records"
import { closeRecordObservers, observeRecordContext, observeRecordFileExit, observeRecordFileOperation, withRecordNavigation, type RecordContextStamp } from "./final-records-file-fence"

// ExcelJS belongs to the existing Sucafina package. Resolve there under Bun's isolated workspace linker.
const { Workbook } = createRequire(new URL("../../../../../modules/sucafina/package.json", import.meta.url))("exceljs") as typeof import("../../../../../modules/sucafina/node_modules/exceljs")

type Detail = { detail: ImportDetail; digest: string; receipt?: ImportReceiptSummary }
type Reference = Detail & { manifest: ImportManifest }
type Destination = { label: string; selectionRef: string; surface: string; formats: string[] }

async function valueOf<T>(response: APIResponse): Promise<T> {
  expect(response.status()).toBe(200)
  const body = await response.json() as { status: string; value: T }
  expect(body.status).toBe("ok")
  return body.value
}

async function forwardedRead<T>(page: Page, url: string, action: () => Promise<T>) {
  const producer = await forwardOnce(page, url, "GET")
  try {
    const [{ response }, result] = await Promise.all([producer.completed, action()])
    return { response, result }
  } finally {
    await producer.close()
  }
}

async function captureAdmission(page: Page, url: string, beforeDelivery?: (status: number) => Promise<void>) {
  type Body = { status?: unknown; value?: { ref: string; digest: string } } | null
  const session = await page.context().newCDPSession(page)
  const producer = Promise.withResolvers<{ status: number; body: Body }>()
  void producer.promise.catch(() => undefined)
  let posts = 0
  session.on("Fetch.requestPaused", async (event) => {
    const { requestId, responseStatusCode: status } = event
    try {
      if (event.request.url !== url || event.request.method !== "POST") {
        await session.send("Fetch.continueRequest", { requestId })
        return
      }
      expect(++posts, "one multipart admission POST per confirmation").toBe(1)
      if (status === undefined) {
        throw new Error(`Import admission failed before receiving HTTP headers (${event.responseErrorReason ?? "unknown"})`)
      }
      let body: Body = null
      try {
        const raw = await session.send("Fetch.getResponseBody", { requestId })
        const text = raw.base64Encoded ? Buffer.from(raw.body, "base64").toString("utf8") : raw.body
        body = JSON.parse(text) as Body
      } catch (error) {
        if (status === 200) throw error
      }
      await beforeDelivery?.(status)
      await session.send("Fetch.continueResponse", { requestId })
      producer.resolve({ status, body })
    } catch (error) {
      producer.reject(error)
      await session.send("Fetch.continueRequest", { requestId }).catch(() => undefined)
    }
  })
  // Response stage only: Chromium sends its own multipart boundary and XLSX bytes.
  // Request-stage replay cannot rely on CDP's multipart postData retaining binary parts.
  try {
    await session.send("Fetch.enable", { patterns: [{ urlPattern: url.replace(/[\\*?]/g, "\\$&"), requestStage: "Response" }] })
  } catch (error) {
    await session.detach()
    throw error
  }
  return { completed: producer.promise, close: () => session.detach() }
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

async function tokens(page: Page, account: Account, year: string, version: string, ids: string[], observeControls = true) {
  const query = new URLSearchParams({ year, version })
  const endpoint = account.baseURL + "/api/ui/pages/CAP18?" + query
  const projection = observeControls
    ? (await forwardedRead(page, endpoint, async () => {
        const route = chapterURL(account, `/orchestra/sf-planner/opex?${query}`)
        expect((await withRecordNavigation(page, account, () => page.goto(route.href)))?.status()).toBe(200)
      })).response
    : await page.request.get(endpoint, { maxRetries: 0 })
  expect(projection.status()).toBe(200)
  const decoded = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP18"].output)(await projection.json())
  expect(decoded).toMatchObject({
    status: "ok",
    context: { principalRef: account.principal, installationId: account.installationId, projectId: account.projectId },
    value: { selection: { year: Number(year), versionId: version }, data: { selectedVersion: { year: Number(year), id: version } } },
  })
  if (decoded.status !== "ok" || !decoded.value.data.grid) throw new Error("The authorized CAP18 grid is unavailable")
  const grid = decoded.value.data.grid
  const surface = page.locator('[data-sf-surface="CAP18"]')
  const result: Record<string, number> = {}
  for (const id of ids) {
    const matching = grid.rows.filter((row) => row.id === id)
    expect(matching).toHaveLength(1)
    const revision = matching[0]!.revision
    expect(Number.isSafeInteger(revision)).toBe(true)
    result[id] = revision
    if (!observeControls) continue
    await surface.getByRole("tab", { name: "Lines", exact: true }).click()
    const lines = surface.getByRole("tabpanel", { name: "Lines", exact: true })
    await expect(lines).toBeVisible()
    const row = lines.locator(`tbody tr[data-sf-row="${id}"]`)
    await expect(row).toHaveCount(1)
    await row.getByRole("button", { name: "Manage", exact: true }).click()
    const detail = surface.getByRole("region", { name: "Manage", exact: true })
    await expect(detail).toBeVisible()
    const provenance = detail.locator("details.sf-u07-source")
    await provenance.locator("summary").click()
    const line = provenance.locator("p").filter({ has: page.getByText(id, { exact: true }) })
    await expect(line).toHaveCount(1)
    await expect(line).toBeVisible()
    await expect(line).toContainText(new RegExp(`Source revision:\\s*${revision}(?![0-9])`))
    await detail.getByRole("button", { name: "Back to plan", exact: true }).click()
    await expect(lines).toBeVisible()
    await expect(surface.getByRole("tab", { name: "Lines", exact: true })).toHaveAttribute("aria-selected", "true")
  }
  return result
}

async function confirmVersion(page: Page, account: Account, opener: Locator, expected: { id?: string; version: number; values: { name?: string } },
  beforeConfirmation?: () => Promise<void>) {
  await expect(opener).toBeEnabled()
  await opener.click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  await expect(review.getByRole("heading", { name: "Save version", exact: true })).toBeVisible()
  const confirm = review.getByRole("button", { name: "Save version", exact: true })
  await expect(confirm).toBeEnabled()
  const endpoint = account.baseURL + "/planner?page=Versions"
  const match = (url: URL) => url.href === endpoint
  const producer = Promise.withResolvers<APIResponse>()
  let saves = 0
  const forward = async (route: Route) => {
    const request = route.request()
    if (request.method() !== "POST") return route.fallback()
    try {
      const payload = request.postDataJSON()
      if (payload?.page !== "Versions" || payload.action !== "save") return route.fallback()
      expect(++saves, "one CAP23 save per confirmation").toBe(1)
      expect(payload).toEqual({ page: "Versions", action: "save", confirmed: true, ...expected })
      // Capture before Chromium can discard its copy during CAP23 readback.
      const response = await route.fetch({ maxRedirects: 0, maxRetries: 0 })
      await route.fulfill({ response })
      producer.resolve(response)
    } catch (error) {
      producer.reject(error)
      await route.abort("failed").catch(() => undefined)
    }
  }
  await page.route(match, forward)
  try {
    await beforeConfirmation?.()
    const [response] = await Promise.all([producer.promise, confirm.click()])
    expect(response.status()).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true })
    expect(saves).toBe(1)
  } finally {
    await page.unroute(match, forward)
  }
}

/** One read-only recovery, only after an observed CAP23 read failure, inside the original 10s budget. */
async function reconcileCreatedVersion(page: Page, account: Account, createdRow: Locator, info: TestInfo,
  observedFailures: readonly { kind: "transport" | "http"; detail: string | number }[] = []) {
  const source = account.baseURL + "/api/ui/pages/CAP23"
  const matches = (request: Request) => request.method() === "GET" &&
    new URL(request.url()).origin === account.origin && new URL(request.url()).pathname === new URL(source).pathname
  const failures: { kind: "transport" | "http"; detail: string | number }[] = [...observedFailures]
  const failed = (request: Request) => {
    if (matches(request) && failures.length < 8)
      failures.push({ kind: "transport", detail: (request.failure()?.errorText ?? "failed").slice(0, 160) })
  }
  const responded = (response: Response) => {
    if (matches(response.request()) && response.status() >= 400 && failures.length < 8)
      failures.push({ kind: "http", detail: response.status() })
  }
  page.on("requestfailed", failed)
  page.on("response", responded)
  const deadline = Date.now() + 10_000
  const remaining = () => Math.max(1, deadline - Date.now())
  let recoveryAttempted = false
  let independentVersion: string | undefined
  try {
    await expect.poll(async () => {
      if (await createdRow.count() === 1) return 1
      if (failures.length && !recoveryAttempted) {
        recoveryAttempted = true
        // The save already returned200. Do not repeat it. Check the same original
        // source independently, then use a native browser reload to reopen it.
        const response = await page.request.get(source, { maxRetries: 0, timeout: remaining() })
        expect(response.status()).toBe(200)
        const body = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP23"].output)(await response.json())
        if (body.status !== "ok") throw new Error("The original CAP23 readback is unavailable")
        expect(body.context.principalRef).toBe(account.principal)
        expect(body.value.data.versions).toHaveLength(1)
        independentVersion = body.value.data.versions[0]!.id
        expect(body.value.versions["versions:" + independentVersion]?.version).toBe(1)
        expect((await page.reload({ timeout: remaining() }))?.status()).toBe(200)
      }
      return createdRow.count()
    }, { timeout: 10_000, message: "the same original CAP23 version is visible after its single acknowledged save" }).toBe(1)
    if (independentVersion) await expect(createdRow).toHaveAttribute("data-sf-row", independentVersion)
  } finally {
    page.off("requestfailed", failed)
    page.off("response", responded)
    if (failures.length || recoveryAttempted) await observation(info, "operations-import-version-readback", {
      failures, recoveryAttempted, independentVersion, repeatedSave: false, readbackBudgetMs: 10_000,
    })
  }
}

async function prepareImport(page: Page, account: Account, stamp: RecordContextStamp,
  generate: Locator, sourceDigest: string, info: TestInfo) {
  const close: (() => Promise<void>)[] = []
  let failed = false
  let prepared: { preview: ImportManifest; referenceURL: string } | undefined
  let admissionExit: Awaited<ReturnType<typeof observeRecordFileExit>> | undefined
  try {
    // Preserve Chromium's original multipart boundary and XLSX bytes. Only arm
    // the existing outgoing authority read at the original CDP response stage.
    const admission = await captureAdmission(page, modeURL(account, "planner", "import-admit").href, async (status) => {
      if (status === 200) admissionExit = await observeRecordFileExit(page, account, stamp, "files.import-admit")
    })
    close.push(admission.close, async () => { await admissionExit?.close() })
    // Bind the reference route to the producer's ID before the browser sees the preview.
    const reference = await observeRecordFileOperation(page, account, stamp,
      "files.import-reference", () => prepared?.referenceURL, "GET")
    close.push(reference.close)
    const preview = await observeRecordFileOperation(page, account, stamp,
      "files.import-preview", modeURL(account, "planner", "import-preview").href, "POST", { beforeDelivery: async (response) => {
        const manifest = await valueOf<ImportManifest>(response)
        prepared = { preview: manifest, referenceURL: modeURL(account, "planner", "import-reference", { importPreviewRef: manifest.id }).href }
      } })
    close.push(preview.close)
    const [admitted, previewTransport, referenceTransport] = await Promise.all([
      admission.completed.then(async ({ status, body }) => {
        if (status !== 200) {
          // Report only the public status category, never selectors, source bytes or authority internals.
          await observation(info, "operations-import-admission-blocked", {
            stage: "import-admit", httpStatus: status,
            producerStatus: typeof body?.status === "string" &&
              ["denied", "unavailable", "stale", "needs-input", "invalid", "conflict"].includes(body.status)
              ? body.status : "unclassified",
            scannerConfigured: Boolean(process.env.SF_OPERATIONS_CLAMD_PORT),
            syntheticApprovalUsed: false,
          })
        }
        expect(status).toBe(200)
        expect(body?.status).toBe("ok")
        expect(body?.value).toMatchObject({ ref: expect.stringMatching(/^[a-f0-9]{64}$/), digest: sourceDigest })
        return body!.value!
      }),
      preview.completed,
      reference.completed,
      generate.click(),
    ])
    if (!prepared) throw new Error("The producer returned no import preview")
    expect(previewTransport.request.postDataJSON()).toEqual({ admittedFileRef: admitted.ref, format: "xlsx", options: {} })
    expect(referenceTransport.response.url()).toBe(prepared.referenceURL)
    const detail = await valueOf<Reference>(referenceTransport.response)
    if (!admissionExit) throw new Error("The original admission has no outgoing authority observation")
    await admissionExit.finish()
    await preview.finish()
    await reference.finish()
    return { ...prepared, detail }
  } catch (error) { failed = true; throw error }
  finally { await closeRecordObservers(close, failed) }
}

/** PR34 15df31a: actual XLSX admission, C02 preview, one Apply, delivery loss and read-only reconciliation. */
export async function importJourney(page: Page, info: TestInfo, capture?: WorkflowCapture) {
  const account = await login(page, "first", "journey")
  const name = "Operations import " + randomUUID()
  const renewal = randomUUID(), fixed = randomUUID()
  const isMode = (url: string, mode: string) => {
    const candidate = new URL(url)
    return candidate.origin === account.origin && candidate.pathname === new URL(account.baseURL).pathname + "/planner" && candidate.searchParams.get("sf") === mode
  }
  expect((await withRecordNavigation(page, account, () => page.goto("/orchestra/sf-planner/versions/new")))?.status()).toBe(200)
  const surface = page.locator('[data-sf-surface="CAP23"]')
  const reads: { event: string; method: string; path: string; status?: number; failure?: string }[] = []
  const versionRead = (request: Request) => {
    const url = new URL(request.url())
    const mount = new URL(account.baseURL).pathname
    return request.method() === "GET" && url.origin === account.origin && (
      url.pathname === mount + "/api/ui/pages/CAP23" ||
      url.pathname === mount + "/api/ui/context" ||
      url.pathname === mount + "/planner" && url.searchParams.get("page") === "Versions"
    )
  }
  const requested = (request: Request) => {
    if (versionRead(request)) reads.push({ event: "request", method: request.method(), path: new URL(request.url()).pathname })
  }
  const responded = (response: Response) => {
    if (versionRead(response.request())) reads.push({ event: "response", method: response.request().method(),
      path: new URL(response.url()).pathname, status: response.status() })
  }
  const failed = (request: Request) => {
    if (versionRead(request)) reads.push({ event: "failed", method: request.method(),
      path: new URL(request.url()).pathname, failure: request.failure()?.errorText })
  }
  page.on("request", requested)
  page.on("response", responded)
  page.on("requestfailed", failed)
  const createdRow = surface.locator("tr[data-sf-row]")
  const readObserver: { current?: Awaited<ReturnType<typeof forwardOnce>> } = {}
  try {
    await confirmVersion(page, account, surface.getByRole("button", { name: "Create first version", exact: true }),
      { version: 0, values: {} }, async () => {
        // The review is ready now; this cannot capture the page's initial empty read.
        readObserver.current = await forwardOnce(page, (url) => url.origin === account.origin &&
          url.pathname === new URL(account.baseURL).pathname + "/api/ui/pages/CAP23", "GET")
      })
    const originalRead = readObserver.current
    if (!originalRead) throw new Error("The acknowledged save has no original CAP23 observer")
    // Observe the one automatic read after the acknowledged save before starting
    // the DOM budget. An original connection failure still permits the same
    // bounded read-only recovery; the save is never repeated.
    const observed = await originalRead.completed.then(
      (value) => ({ kind: "response" as const, value }),
      (error: unknown) => {
        // Only the original producer socket closing can authorize recovery.
        // A helper/deadline, assertion, codec or browser-delivery error must fail.
        const socket = error instanceof Error
          ? /^route\.fetch: (?:socket hang up|(?:read |write )?(?:ECONNRESET|EPIPE)\b)/.exec(error.message) : null
        if (!socket) throw error
        const detail = socket[0]
        console.info("SF_FINAL_RECORDS_CAP23_READ " + JSON.stringify({ event: "original-socket-failure", detail }))
        return { kind: "transport" as const, detail }
      },
    )
    const readFailures: { kind: "transport" | "http"; detail: string | number }[] = []
    let readVersion: string | undefined
    if (observed.kind === "transport") readFailures.push(observed)
    else if (observed.value.response.status() >= 400)
      readFailures.push({ kind: "http", detail: observed.value.response.status() })
    else {
      expect(observed.value.request.method()).toBe("GET")
      expect(observed.value.response.status()).toBe(200)
      const body = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP23"].output)(await observed.value.response.json())
      if (body.status !== "ok") throw new Error("The acknowledged version's original readback is unavailable")
      expect(body.context.principalRef).toBe(account.principal)
      expect(body.value.data.versions).toHaveLength(1)
      readVersion = body.value.data.versions[0]!.id
      expect(body.value.versions["versions:" + readVersion]?.version).toBe(1)
    }
    await originalRead.close()
    await reconcileCreatedVersion(page, account, createdRow, info, readFailures)
    await expect(createdRow).toHaveCount(1)
    if (readVersion) await expect(createdRow).toHaveAttribute("data-sf-row", readVersion)
  } finally {
    await readObserver.current?.close()
    page.off("request", requested)
    page.off("response", responded)
    page.off("requestfailed", failed)
    await observation(info, "operations-first-version-readback", {
      path: new URL(page.url()).pathname, year: new URL(page.url()).searchParams.get("year"), reads,
      states: await page.locator("[data-sf-state]").evaluateAll((panels) => panels.map((panel) => ({
        state: panel.getAttribute("data-sf-state"), text: panel.textContent?.trim().slice(0, 240),
      }))),
    })
  }
  await expect(createdRow).toHaveAttribute("data-sf-row", /\S+/)
  const version = (await createdRow.getAttribute("data-sf-row"))!
  await createdRow.getByRole("button", { name: "Open record", exact: true }).click()
  const versionDetail = page.locator("[data-sf-record-detail]")
  await expect(versionDetail).toHaveCount(1)
  const reference = versionDetail.locator("details.sf-s01-secondary")
  await expect(reference.locator("summary")).toHaveText("Record reference")
  await reference.locator("summary").click()
  const identity = reference.locator("bdi")
  await expect(identity).toBeVisible()
  await expect(identity).toHaveText(version)
  const year = versionDetail.locator("#sf-u46-year")
  await expect(year).toHaveValue(/^\d{4}$/)
  const nameField = versionDetail.locator("#sf-u46-name")
  await expect(nameField).toBeEnabled()
  await nameField.fill(name)
  await confirmVersion(page, account, versionDetail.getByRole("button", { name: "Save version", exact: true }), { id: version, version: 1, values: { name } })
  await expect(versionDetail.locator("#sf-u46-name")).toHaveValue(name)
  await expect(versionDetail.getByRole("heading", { name, exact: true })).toBeVisible()
  const fiscalYear = await year.inputValue()
  expect((await withRecordNavigation(page, account, () =>
    page.goto(`/orchestra/sf-planner/versions?${new URLSearchParams({ year: fiscalYear })}`)))?.status()).toBe(200)
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
  const beforeTokens = await tokens(reader, account, fiscalYear, version, [renewal, fixed])
  const before = await exported(reader, account, version)
  expect(before.OPEX?.filter((row) => row[0] === renewal || row[0] === fixed)).toHaveLength(6)
  expect(before.OPEX?.filter((row) => row[0] === renewal && row[8] === "Forecast").map((row) => row[9])).toEqual([72000])
  expect(before.OPEX?.filter((row) => row[0] === fixed && row[8] === "Forecast").map((row) => row[9])).toEqual([518000])
  const workbook = new Workbook()
  workbook.addWorksheet("OPEX").addRows([["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Jan"], [renewal, "Licenses", "Renewal", "USD", "Forecast", 84000]])
  const bytes = Buffer.from(await workbook.xlsx.writeBuffer())
  const sourceDigest = createHash("sha256").update(bytes).digest("hex")
  expect((await withRecordNavigation(page, account, () =>
    page.goto(chapterURL(account, "/orchestra/sf-imports/new").href)))?.status()).toBe(200)
  const root = page.locator('[data-sf-leaf="u23"][data-sf-surface="UI55"]')
  await expect(root).toHaveCount(1)
  const invalid = await page.request.post(modeURL(account, "planner", "import-preview").href, { maxRetries: 0, headers: { Origin: account.origin, "Idempotency-Key": randomUUID() }, data: { admittedFileRef: "invalid-schema-probe", format: "xlsx", options: { unknown: true } } })
  expect(invalid.status()).toBe(400)
  expect(await invalid.json()).toEqual({ status: "invalid" })
  const targetsURL = modeURL(account, "planner", "import-targets", { surface: "planner" }).href
  const preflight = await observeRecordContext(page, account, 1)
  const targetObservation = await observeRecordFileOperation(page, account, preflight.stamp,
    "files.import-targets", targetsURL, "GET")
  let targetsFailed = false
  const { context, stamp, target } = await (async () => {
    const [{ response: targetsTransport }, authority] = await Promise.all([
      targetObservation.completed, preflight.completed,
      root.getByRole("button", { name: "Find destinations", exact: true }).click(),
    ])
    // Retain the exact original preflight URL for the later cross-tab logout.
    const context = authority.first.request
    expect(targetsTransport.url()).toBe(targetsURL)
    const targets = await valueOf<Destination[]>(targetsTransport)
    const matches = targets.filter((target) => target.label === name)
    expect(matches).toHaveLength(1)
    const target = matches[0]!
    expect(target).toMatchObject({ surface: "planner", formats: expect.arrayContaining(["xlsx"]) })
    await targetObservation.finish()
    return { context, stamp: authority.stamp, target }
  })().catch((error: unknown) => { targetsFailed = true; throw error })
    .finally(() => closeRecordObservers([preflight.close, targetObservation.close], targetsFailed))
  const destination = root.getByRole("combobox", { name: "Destination", exact: true })
  await expect(destination.getByRole("option", { name, exact: true })).toHaveAttribute("value", target.selectionRef)
  await destination.selectOption({ value: target.selectionRef })
  await expect(destination).toHaveValue(target.selectionRef)
  await root.getByLabel("File", { exact: true }).setInputFiles({ name: name + ".xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: bytes })
  await expect(root.getByLabel("Create a new Planner version", { exact: true })).not.toBeChecked()
  await expect(root.getByLabel("Remove records missing from supplied sheets", { exact: true })).not.toBeChecked()
  const generate = root.getByRole("button", { name: "Generate preview", exact: true })
  await expect(generate, "Preview needs the installed import admission and real scanner").toBeEnabled()
  await capture?.(page, info, { surface: "UI55", state: "source-file-selected", evidence: "Original target selection and real XLSX bytes; Generate preview is enabled." })
  const { preview, detail, referenceURL } = await prepareImport(page, account, stamp, generate, sourceDigest, info)
  const isReference = (request: Request) => request.method() === "GET" && request.url() === referenceURL
  const readReference = async (tab: Page, action: () => Promise<unknown>) => {
    const original = await observeRecordFileOperation(tab, account, stamp,
      "files.import-reference", referenceURL, "GET")
    let failed = false
    try {
      const [{ response }] = await Promise.all([original.completed, action()])
      const reference = await valueOf<Reference>(response)
      await original.finish()
      return reference
    } catch (error) { failed = true; throw error }
    finally { await closeRecordObservers([original.close], failed) }
  }
  expect(detail.manifest).toEqual(preview)
  expect(preview).toMatchObject({ sourceDigest, format: "xlsx", state: "preview", domainApplied: false, receipts: [], issues: [], context: {
    principalRef: account.principal, installationId: account.installationId, projectId: account.projectId, surface: "planner",
  } })
  expect(preview.baseIdentity).toEqual([expect.objectContaining({ surface: "planner", type: "planner-version", id: version })])
  const base = preview.baseIdentity[0]!
  expect(target.selectionRef).toBe(`planner-version:${encodeURIComponent(version)}:${encodeURIComponent(base.incarnation)}:${base.version}`)
  expect(preview.commands).toHaveLength(1)
  const command = preview.commands[0]!
  expect(command.target).toEqual(base)
  expect(command.preview.engineVersion).toBe("planner-runtime-v1")
  for (const [id, prior, next] of [[renewal, 72000, 84000], [fixed, 518000, 518000]] as const) {
    expect(command.preview.values.filter((value) => value.id === `before:${id}:1:forecast`)).toEqual([expect.objectContaining({ value: prior, currency: "USD" })])
    expect(command.preview.values.filter((value) => value.id === `after:${id}:1:forecast`)).toEqual([expect.objectContaining({ value: next, currency: "USD" })])
  }
  expect(detail.detail).toMatchObject({ manifestId: preview.id, version: preview.version, sourceDigest })
  expect(detail.receipt).toBeUndefined()
  expect(detail.detail.changes.filter((change) => change.path === `/versions/@id=${version}/lines/@id=${renewal}/f/0`)).toEqual([expect.objectContaining({ kind: "changed", before: { state: "present", value: 72000 }, after: { state: "present", value: 84000 }, source: { kind: "file", sheet: "OPEX", row: 2, column: 6, address: "F2", field: "Jan" } })])
  await expect(root).toHaveAttribute("data-sf-phase", "reviewing")
  await expect(root.getByRole("heading", { name: "Simulation · no domain changes applied", exact: true })).toBeVisible()
  const previewPresentation = await assertPreviewPresentation(root, preview, detail.detail)
  await observation(info, "operations-import-preview-presentation", previewPresentation)
  const [afterPreview, previewTokens] = await Promise.all([
    exported(reader, account, version), tokens(reader, account, fiscalYear, version, [renewal, fixed], false),
  ])
  expect(afterPreview).toEqual(before)
  expect(previewTokens).toEqual(beforeTokens)
  const applies: Request[] = []
  const applyURL = modeURL(account, "planner", "import-apply").href
  const applyPayload = { manifestId: preview.id, version: preview.version }
  const countApply = (request: Request) => {
    if (isMode(request.url(), "import-apply") && request.method() === "POST") applies.push(request)
  }
  page.context().on("request", countApply)
  await captureWorkflowState(page, info, { surface: "UI55", state: "source-gap-context", evidence: "Original source gaps use admitted cell labels and localized reasons; complete paths and reason codes remain in disclosures.", focus: ".sf-files-gaps" })
  await captureWorkflowState(page, info, { surface: "UI55", state: "original-preview", evidence: "Original scanned import preview; independent export and version tokens prove no domain changes.", attributes: { "data-sf-phase": "reviewing" }, focus: '.sf-files-section[aria-label="Item and field changes"]' })
  // UI56 is permanent regression coverage: this only rereads the original preview.
  {
    const previewPage = await page.context().newPage()
    try {
      const previewURL = chapterURL(account, "/orchestra/sf-imports/r_" + Buffer.from(preview.id).toString("base64url") + "/preview")
      expect((await withRecordNavigation(previewPage, account, () => previewPage.goto(previewURL.href)))?.status()).toBe(200)
      const previewRoot = previewPage.locator('[data-sf-surface="UI56"]')
      await expect(previewRoot).toBeVisible()
      const reread = await readReference(previewPage, () => previewRoot.locator(".sf-files-fields")
        .getByRole("button", { name: "Refresh receipt", exact: true }).click())
      expect(reread).toEqual(detail)
      await expect(previewRoot.getByRole("region", { name: "Item and field changes", exact: true })).toBeVisible()
      const independentPresentation = await assertPreviewPresentation(previewRoot, preview, reread.detail)
      expect(independentPresentation).toEqual(previewPresentation)
      await captureWorkflowState(previewPage, info, { surface: "UI56", state: "source-gap-context", evidence: "The independent preview preserves the same original source gaps and disclosure references.", focus: ".sf-files-gaps" })
      await captureWorkflowState(previewPage, info, { surface: "UI56", state: "original-manifest-preview", evidence: "Independent native preview route re-read the exact original manifest; no Apply was invoked.", focus: '.sf-files-section[aria-label="Item and field changes"]' })
    } finally { await previewPage.close() }
  }
  expect(applies, "preview and independent review do not apply the import").toHaveLength(0)
  const applied = Promise.withResolvers<ImportManifest>()
  // Send the real mutation once and discard only its delivery. No response is manufactured.
  const loseApply = async (route: Route) => {
    try {
      expect(route.request().method()).toBe("POST")
      expect(route.request().postDataJSON()).toEqual(applyPayload)
      const committed = await valueOf<ImportManifest>(await route.fetch({ maxRedirects: 0, maxRetries: 0 }))
      await route.abort("failed")
      applied.resolve(committed)
    } catch (error) {
      applied.reject(error)
      await route.abort("failed").catch(() => undefined)
    }
  }
  await page.route(applyURL, loseApply, { times: 1 })
  const { response: checkTransport, result: [committed] } = await forwardedRead(page, referenceURL, () => Promise.all([
    applied.promise,
    page.waitForEvent("requestfailed", (request) => request.method() === "POST" && request.url() === applyURL),
    root.getByRole("button", { name: "Apply reviewed import", exact: true }).click(),
  ])).finally(() => page.unroute(applyURL, loseApply))
  const checked = await valueOf<Reference>(checkTransport)
  expect(checked).toEqual(detail)
  await expect(root).toHaveAttribute("data-sf-phase", "unknown")
  await expect(root.getByRole("button", { name: "Apply reviewed import", exact: true })).toHaveCount(0)
  const refreshReceipt = root.getByRole("button", { name: "Refresh receipt", exact: true })
  const lostRead = Promise.withResolvers<void>()
  const dropReceipt = async (route: Route) => {
    if (!isReference(route.request())) return route.fallback()
    try {
      await route.abort("failed")
      lostRead.resolve()
    } catch (error) {
      lostRead.reject(error)
    }
  }
  await page.route(referenceURL, dropReceipt, { times: 1 })
  await Promise.all([lostRead.promise, refreshReceipt.click()]).finally(() => page.unroute(referenceURL, dropReceipt))
  await expect(root).toHaveAttribute("data-sf-phase", "unknown")
  await expect(root).toHaveAttribute("data-sf-read-state", "unavailable")
  await expect(refreshReceipt).toBeEnabled()
  await expect(root.getByRole("button", { name: "Apply reviewed import", exact: true })).toHaveCount(0)
  expect(applies).toHaveLength(1)
  await capture?.(page, info, { surface: "UI55", state: "lost-delivery-unavailable", evidence: "The original Apply committed once; only its delivery and one reconciliation read were dropped. Apply is absent.", attributes: { "data-sf-phase": "unknown", "data-sf-read-state": "unavailable" } })
  const recovered = await readReference(page, () => refreshReceipt.click())
  expect(recovered.manifest).toEqual(committed)
  expect(recovered.manifest.receipts).toHaveLength(1)
  const receipt = recovered.manifest.receipts[0]!
  expect(recovered.manifest).toEqual({ ...preview, state: "applied", domainApplied: true, receipts: [receipt] })
  expect(receipt).toMatchObject({ idempotencyKey: command.idempotencyKey, commandDigest: command.commandDigest, targetIncarnation: command.target.incarnation, principalRef: account.principal, surface: "planner", status: "applied", errors: [] })
  expect(recovered.receipt).toMatchObject({ receiptId: receipt.id, manifestId: preview.id, idempotencyKey: command.idempotencyKey, commandDigest: command.commandDigest, outcome: "applied" })
  expect(recovered.receipt?.changedFields).toBeGreaterThan(0)
  expect(recovered.detail).toEqual(detail.detail)
  await expect(root).toHaveAttribute("data-sf-phase", "receipt")
  const receiptPanel = root.locator('[data-sf-receipt="producer"]')
  await expect(receiptPanel.getByRole("heading", { name: "Confirmed receipt", exact: true })).toBeVisible()
  await expect(receiptPanel).toContainText(receipt.id + " · Outcome: applied")
  await expect(receiptPanel).toContainText(receipt.id + " · " + receipt.at + " · applied · " + receipt.version)
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
  const afterTokens = await tokens(reader, account, fiscalYear, version, [renewal, fixed])
  expect(afterTokens).toEqual({ [renewal]: beforeTokens[renewal]! + 1, [fixed]: beforeTokens[fixed] })
  const refreshed = await readReference(page, () => refreshReceipt.click())
  expect(refreshed).toEqual(recovered)
  await expect(root.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeDisabled()
  const resultLink = root.getByRole("link", { name: "View result", exact: true })
  await expect(resultLink).toBeVisible()
  const resultHref = await resultLink.getAttribute("href")
  if (!resultHref) throw new Error("The producer receipt has no installed result route")
  const resultURL = chapterURL(account, `/orchestra/sf-imports/r_${Buffer.from(preview.id).toString("base64url")}/receipt`)
  expect(new URL(resultHref, page.url()).href).toBe(resultURL.href)
  const resultRoot = '[data-sf-leaf="u23"][data-sf-surface="UI57"]'
  const openResult = async (tab: Page, principal: string) => {
    const ownerReads = await observeRecordContext(tab, account, 2, principal)
    let failed = false
    try {
      const [navigation, authority] = await Promise.all([tab.goto(resultURL.href), ownerReads.completed])
      const owner = authority.first.response
      expect(navigation?.status()).toBe(200)
      expect(owner.status()).toBe(200)
      expect(await owner.json()).toMatchObject({
        status: "ok",
        value: { stamp: { principalRef: principal, installationId: account.installationId, projectId: account.projectId } },
      })
      return tab.locator(resultRoot)
    } catch (error) { failed = true; throw error }
    finally { await closeRecordObservers([ownerReads.close], failed) }
  }
  const resultPage = await page.context().newPage()
  try {
    const result = await openResult(resultPage, account.principal)
    await expect(result).toHaveCount(1)
    await expect(result).toBeVisible()
    const read = result.locator(".sf-files-fields").getByRole("button", { name: "Refresh receipt", exact: true })
    const reopened = await readReference(resultPage, () => read.click())
    expect(reopened).toEqual(recovered)
    await expect(result).toHaveAttribute("data-sf-phase", "receipt")
    await expect(result.locator('[data-sf-receipt="producer"]')).toContainText(receipt.id + " · " + receipt.at + " · applied · " + receipt.version)
    await expect(result.getByRole("button", { name: "Apply reviewed import", exact: true })).toHaveCount(0)
    await capture?.(resultPage, info, { surface: "UI57", state: "original-confirmed-receipt", evidence: "Independent native receipt route matches the committed producer receipt and one original Apply.", attributes: { "data-sf-phase": "receipt" }, focus: '[data-sf-receipt="producer"]' })
    await captureRecordVariants(resultPage, info, "UI57", "recovered-receipt", false)
    await capturePortugueseRecord(resultPage, info, "UI57", "recovered-receipt", async (localized) => {
      const localizedRead = await readReference(localized, () => localized.locator(".sf-files-fields")
        .getByRole("button", { name: "Atualizar recibo", exact: true }).click())
      expect(localizedRead).toEqual(recovered)
      await expect(localized.locator(resultRoot)).toHaveAttribute("data-sf-phase", "receipt")
      await expect(localized.locator('[data-sf-receipt="producer"]')).toContainText(receipt.id)
    }, async (localized, href) => {
      expect((await withRecordNavigation(localized, account, () => localized.goto(href)))?.status()).toBe(200)
    })
    const changes = result.getByRole("region", { name: "Item and field changes", exact: true })
    const changedCount = detail.detail.changes.filter((change) => change.kind === "changed").length
    expect(changedCount).toBeGreaterThan(0)
    await changes.getByText("changed (" + changedCount + ")", { exact: true }).click()
    await expect(changes.locator(".sf-records-diff")).toHaveCount(detail.detail.changes.length)
    await captureRecordDetail(resultPage, info, "UI57", "changed-fields-original-values", changes)
    expect((await withRecordNavigation(resultPage, account, () =>
      resultPage.goto(chapterURL(account, "/orchestra/sf-imports").href)))?.status()).toBe(200)
    const history = resultPage.locator(resultRoot)
    await expect(history.getByRole("heading", { name: "Find an import", exact: true })).toBeVisible()
    await captureRecord(resultPage, info, "UI57", "history-empty-reference")
    await history.getByLabel("Import preview reference", { exact: true }).fill(preview.id)
    // History serially reconciles reference and detail before publishing. Arm
    // both original reads before the one submit; do not query a second time.
    const detailURL = modeURL(account, "planner", "import-detail", { manifestId: recovered.manifest.id, version: String(recovered.manifest.version) }).href
    const historyDetail = await observeRecordFileOperation(resultPage, account, stamp,
      "files.import-detail", detailURL, "GET")
    let historyFailed = false
    try {
      const historyRead = await readReference(resultPage, () => history.locator("form")
        .getByRole("button", { name: "Refresh receipt", exact: true }).click())
      expect(historyRead).toEqual(recovered)
      const detailRead = (await historyDetail.completed).response
      expect(detailRead.url()).toBe(detailURL)
      expect(await valueOf<Detail>(detailRead)).toEqual({
        detail: recovered.detail, digest: recovered.digest, receipt: recovered.receipt,
      })
      await historyDetail.finish()
    } catch (error) { historyFailed = true; throw error }
    finally { await closeRecordObservers([historyDetail.close], historyFailed) }
    await expect(history.locator('[data-sf-receipt="producer"]')).toContainText(receipt.id)
    await captureRecord(resultPage, info, "UI57", "history-authorized-reference")
  } finally {
    await resultPage.close()
  }
  expect(applies.map((request) => request.postDataJSON())).toEqual([applyPayload])
  const [afterRecovery, recoveryTokens] = await Promise.all([
    exported(reader, account, version), tokens(reader, account, fiscalYear, version, [renewal, fixed], false),
  ])
  expect(afterRecovery).toEqual(after)
  expect(recoveryTokens).toEqual(afterTokens)
  // The reader remains on native CAP18; its access actions live in the context menu.
  await reader.getByRole("button", { name: "Context and access", exact: true }).click()
  const access = reader.getByRole("menu", { name: "Context and access", exact: true })
  await expect(access).toBeVisible()
  const signOut = access.getByRole("menuitem", { name: "Sign out", exact: true })
  await expect(signOut).toBeEnabled()
  // The Files transport preflights context before issuing a receipt read after cross-tab logout.
  const signedOut = reader.waitForResponse((response) => response.url() === account.baseURL + "/auth/logout" && response.request().method() === "POST")
  await signOut.click()
  expect((await signedOut).status()).toBe(204)
  const { response: revoked } = await forwardedRead(page, context.url(), () => refreshReceipt.click())
  expect(revoked.status()).toBe(401)
  expect(await revoked.json()).toEqual({ status: "unauthenticated" })
  await expect(root).toHaveAttribute("data-sf-read-state", "unavailable")
  for (const name of ["Domain impact", "Item and field changes"]) await expect(root.getByRole("region", { name, exact: true })).toHaveCount(0)
  await expect(receiptPanel).toHaveCount(0)
  await expect(resultLink).toHaveCount(0)
  await expect(root.getByRole("button", { name: "Apply reviewed import", exact: true })).toHaveCount(0)
  const denied = await page.request.get(referenceURL, { maxRedirects: 0, maxRetries: 0 })
  expect(denied.status()).toBe(403)
  expect(await denied.json()).toEqual({ status: "denied" })
  const browser = page.context().browser()
  if (!browser) throw new Error("The viewer requires a separate browser context")
  const viewerPage = await browser.newPage()
  try {
    viewerPage.context().on("request", countApply)
    const viewer = await login(viewerPage, "viewer", "journey")
    expect(viewer.principal).not.toBe(account.principal)
    const visibleAfterRevocation = await exported(viewerPage, viewer, version)
    expect(visibleAfterRevocation.OPEX).toEqual(after.OPEX)
    const result = await openResult(viewerPage, viewer.principal)
    const { response: foreign } = await forwardedRead(viewerPage, referenceURL, () =>
      result.locator(".sf-files-fields").getByRole("button", { name: "Refresh receipt", exact: true }).click())
    expect(foreign.status()).toBe(403)
    expect(await foreign.json()).toEqual({ status: "denied" })
    await expect(result).toHaveAttribute("data-sf-read-state", "denied")
    await expect(result.locator('[data-sf-receipt="producer"]')).toHaveCount(0)
    await expect(result.getByRole("region", { name: "Item and field changes", exact: true })).toHaveCount(0)
    await expect(result.getByRole("button", { name: "Apply reviewed import", exact: true })).toHaveCount(0)
    await capture?.(viewerPage, info, { surface: "UI57", state: "real-owner-denied", evidence: "A separately authenticated read-only operator received the original HTTP 403 denied for the owner's exact manifest. No response or role was fabricated.", attributes: { "data-sf-read-state": "denied" } })
  } finally {
    await viewerPage.close()
  }
  expect(applies).toHaveLength(1)
  page.context().off("request", countApply)
  await observation(info, "operations-import-real-receipt", { version, renewal, fixed, sourceDigest, manifest: recovered.manifest, receipt: recovered.receipt, beforeTokens, afterTokens, applyRequests: applies.length, recovery: "real Apply response delivery lost; explicit Refresh receipt and independent result-route reread", revocation: "cross-tab logout blocked receipt refresh at context preflight; the producer denied the exact reference", isolation: "a separate signed-in viewer could export the committed data but could not read the owner's receipt" })
  await reader.close()
}

/** Assertions consume the original returned manifest/detail, not a reconstructed import. */
async function assertPreviewPresentation(root: Locator, preview: ImportManifest, detail: ImportDetail) {
  const kinds = ["added", "changed", "removed", "unchanged", "ignored", "rejected"] as const
  const populated = kinds.filter((kind) => detail.changes.some((entry) => entry.kind === kind))
  const empty = kinds.filter((kind) => !detail.changes.some((entry) => entry.kind === kind))
  const changes = root.getByRole("region", { name: "Item and field changes", exact: true })
  await expect(changes.locator(".sf-files-change-group")).toHaveCount(populated.length)
  expect(await changes.locator(".sf-files-change-group").evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-sf-import-kind")))).toEqual(populated)
  expect(empty.length, "the original fixture retains empty categories for compact-summary coverage").toBeGreaterThan(0)
  const emptyGroups = changes.locator(".sf-files-empty-groups")
  await expect(emptyGroups).toHaveJSProperty("open", false)
  await expect(emptyGroups.locator("summary")).toHaveText("Categories without entries (" + empty.length + ")")
  await expect(changes.locator(":scope > details > summary")).toHaveCount(populated.length + 1)
  await emptyGroups.locator("summary").click()
  expect(await emptyGroups.locator("[data-sf-import-empty]").evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-sf-import-empty")))).toEqual(empty)
  await expect(emptyGroups.locator("li > span:first-child")).toHaveText(empty)
  await expect(emptyGroups.locator("li > span:last-child")).toHaveText(empty.map(() => "No entries · 0"))
  await emptyGroups.locator("summary").click()

  const missing = preview.commands.flatMap((command) => command.preview.missing)
  expect(missing.length, "the original fixture retains source gaps").toBeGreaterThan(0)
  const gaps = root.locator("[data-sf-import-gap]")
  await expect(gaps).toHaveCount(missing.length)
  await expect(gaps.locator(".sf-files-gap-source code")).toHaveText(missing.flatMap((gap) => [gap.field, gap.reason]))
  const missingIndex = missing.findIndex((gap) => gap.reason === "missing")
  expect(missingIndex).toBeGreaterThanOrEqual(0)
  const gap = gaps.nth(missingIndex)
  await expect(gap.getByText("Not provided by the source.", { exact: true })).toBeVisible()
  await expect(gap.locator(".sf-files-gap-heading")).not.toContainText(missing[missingIndex]!.field)
  const reference = gap.locator(".sf-files-gap-source")
  await expect(reference.locator("code").first()).toBeHidden()
  await reference.locator("summary").click()
  await expect(reference.locator("code").first()).toBeVisible()
  await expect(reference.locator("code").first()).toHaveText(missing[missingIndex]!.field)
  await reference.locator("summary").click()
  return {
    changeCounts: Object.fromEntries(kinds.map((kind) => [kind, detail.changes.filter((entry) => entry.kind === kind).length])),
    populatedKinds: populated, emptyKinds: empty, emptySummaryCount: 1,
    sourceGaps: missing.map((gap) => ({ field: gap.field, reason: gap.reason })),
    gapHeadings: await gaps.locator(".sf-files-gap-heading").allTextContents(),
    rawReferencesInitiallyHidden: true,
    exactReferenceDisclosureOpenedAndClosed: true,
  }
}
