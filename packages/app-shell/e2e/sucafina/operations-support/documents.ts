import type { WorkflowCapture } from "../design-support/workflow-polish-capture"
import { createHash, randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { expect } from "@playwright/test"
import { Schema } from "effect"
import { SfContextResult, type SfContextStamp } from "@orchestra/schema/sucafina/context"
import { SfProcurement } from "@orchestra/schema/sucafina/procurement"
import type { APIResponse, Locator, Page, Request, Response, Route, TestInfo } from "@playwright/test"
import type { DocumentEvidence } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import { chapterURL, forwardOnce, login, modeURL, observation } from "./runtime.ts"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import type { Account } from "./runtime.ts"
import { captureRecord, captureRecordVariants, capturePortugueseRecord, describeRecordPage } from "./final-records"
import { closeRecordObservers, observeRecordFileOperation, withRecordNavigation, type RecordFileOperation } from "./final-records-file-fence"
import { observeFinalGet } from "../design-support/final-navigation"

type Source = { selectionRef: string; label: string; surface: string }
type DocumentSchema = { id: string; version: number; ref: string; fields: { id: string; type: string; unit?: string }[] }
type Presentation = { title: string; excerpt: string; location: string; href?: string }

function observeDocumentCatalog(page: Page, account: Account, info: TestInfo) {
  const operations = ["files.document-requests", "files.document-sources", "files.document-candidates"] as const
  const mount = new URL(account.baseURL).pathname
  const started = performance.now()
  type Event = {
    mode: "document-requests" | "document-sources" | "context"
    phase: "request" | "response" | "failed"
    elapsedMs: number
    status?: number
    failure?: string
    contextStatus?: SfContextResult["status"] | "pending" | "invalid" | "unreadable"
    readiness?: { operation: typeof operations[number]; states: readonly ("ready" | "denied" | "unavailable")[] }[]
  }
  const events: Event[] = []
  let dropped = 0
  const record = (request: Request, phase: Event["phase"], status?: number) => {
    const url = new URL(request.url())
    if (request.method() !== "GET" || url.origin !== account.origin) return
    const selector = url.searchParams.get("sf")
    const mode = url.pathname === `${mount}/api/ui/context` &&
      url.searchParams.get("installationId") === account.installationId && url.searchParams.get("projectId") === account.projectId
      ? "context" : url.pathname === `${mount}/procurement` && (selector === "document-requests" || selector === "document-sources")
        ? selector : undefined
    if (!mode) return
    if (events.length === 64) { dropped++; return }
    const event: Event = { mode, phase, elapsedMs: Math.round(performance.now() - started), status }
    events.push(event)
    return event
  }
  const requested = (request: Request) => { record(request, "request") }
  const failed = (request: Request) => {
    const event = record(request, "failed")
    if (event) event.failure = request.failure()?.errorText?.replace(/https?:\/\/\S+/g, "[url]").slice(0, 160)
  }
  const responded = (response: Response) => {
    const event = record(response.request(), "response", response.status())
    if (event?.mode !== "context") return
    event.contextStatus = "pending"
    // Read the browser's observed response. Never issue a diagnostic HTTP request.
    void response.json().then((body: unknown) => {
      const decoded = Schema.decodeUnknownOption(SfContextResult, { onExcessProperty: "error" })(body)
      if (decoded._tag === "None") { event.contextStatus = "invalid"; return }
      const result = decoded.value
      event.contextStatus = result.status
      if (result.status !== "ok") return
      const reported = result.value.availability.flatMap((resource) => resource.family === "files" ? resource.operations : [])
      event.readiness = operations.map((operation) => ({ operation,
        states: [...new Set(reported.filter((entry) => entry.operationId === operation).map((entry) => entry.state))],
      }))
    }).catch(() => { event.contextStatus = "unreadable" })
  }
  page.on("request", requested)
  page.on("requestfailed", failed)
  page.on("response", responded)
  return async (catalogFailed = false) => {
    page.off("request", requested)
    page.off("requestfailed", failed)
    page.off("response", responded)
    const evidence = JSON.stringify({ elapsedMs: Math.round(performance.now() - started), events, dropped })
    if (catalogFailed || !events.some((event) => event.mode === "document-sources" && event.phase === "response" && event.status === 200))
      console.info("SF_FILES_DOCUMENT_CATALOG_PHASES", evidence)
    await info.attach("operations-document-catalog-phases.json", { body: evidence, contentType: "application/json" }).catch(() => undefined)
  }
}

async function captureCommandResponse(page: Page, account: Account, expected: { action: "create" } | { action: "delete"; id: string }, button: Locator) {
  const endpoint = new URL(account.baseURL + "/procurement?page=Suppliers").href
  const match = (url: URL) => url.href === endpoint
  const producer = Promise.withResolvers<{ response: APIResponse; command: unknown }>()
  let attempts = 0
  const forward = async (route: Route) => {
    const request = route.request()
    if (request.method() !== "POST") return route.fallback()
    try {
      const command = request.postDataJSON()
      if (command?.page !== "Suppliers" || command.action !== expected.action ||
        (expected.action === "create" ? Object.hasOwn(command, "id") : command.id !== expected.id)) return route.fallback()
      expect(++attempts, `one CAP27 ${expected.action} POST per confirmation`).toBe(1)
      // Retain the producer response even if Chromium loses its copy during readback.
      const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
      await route.fulfill({ response })
      producer.resolve({ response, command })
    } catch (error) {
      producer.reject(error)
      await route.abort("failed").catch(() => undefined)
    }
  }
  await page.route(match, forward)
  try {
    const [{ response, command }] = await Promise.all([producer.promise, button.click()])
    const body: unknown = await response.json()
    expect(attempts).toBe(1)
    return { status: response.status(), body, command }
  } finally {
    await page.unroute(match, forward)
  }
}

async function valueOf<T>(response: APIResponse | Response): Promise<T> {
  expect(response.status()).toBe(200)
  const body = await response.json() as { status: string; value: T }
  expect(body.status).toBe("ok")
  return body.value
}

/** The original native supplier creation, shared by document admission and its narrow prerequisite proof. */
export async function createDocumentSupplier(page: Page, account: Account, key: string, name: string) {
  expect((await withRecordNavigation(page, account, () =>
    page.goto(chapterURL(account, "/orchestra/sf-procurement/suppliers").href)))?.status()).toBe(200)
  const suppliers = page.locator(".sf-u14-layout")
  await expect(suppliers).toHaveCount(1)
  await page.getByRole("button", { name: "New supplier", exact: true }).click()
  const editor = suppliers.locator(".sf-u14-editor")
  await expect(editor).toHaveCount(1)
  await expect(editor.getByRole("heading", { name: "Create supplier", exact: true })).toBeVisible()
  for (const [label, value] of [
    ["Legal name", name],
    ["Country", "France"],
    ["Address", "Isolated E2E supplier"],
    ["Tax ID", key],
    ["Contact email", "operations@example.invalid"],
    ["Payment terms", "Net 45"],
    ["Currency", "USD"],
    ["Risk rating", "Low"],
  ]) await editor.getByLabel(label!, { exact: true }).fill(value!)
  const openReview = editor.getByRole("button", { name: "Create supplier", exact: true })
  await expect(openReview).toBeEnabled()
  await openReview.click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  await expect(review.getByRole("heading", { name: "Create supplier", exact: true })).toBeVisible()
  await expect(review).toContainText(name)
  const confirmCreate = review.getByRole("button", { name: "Create supplier", exact: true })
  await expect(confirmCreate).toBeEnabled()
  const created = await captureCommandResponse(page, account, { action: "create" }, confirmCreate)
  expect(created.status).toBe(200)
  expect(created.body).toMatchObject({ ok: true })
  expect(created.command).toMatchObject({
    page: "Suppliers", action: "create", version: 0,
    values: { supplier: { legalName: name, country: "France", address: "Isolated E2E supplier", taxId: key, contactEmail: "operations@example.invalid", paymentTerms: "Net 45", currency: "USD", riskRating: "Low" } },
  })
  await expect(suppliers.getByRole("status").filter({ hasText:
    "Operation accepted.",
  })).toBeVisible()
  const supplierRow = page.locator("tr[data-sf-row]").filter({ has: page.getByRole("cell", { name, exact: true }) })
  await expect(supplierRow).toHaveCount(1)
  const numberCell = supplierRow.locator(".sf-s01-cell-value").filter({ hasText: /^SUP-\d+$/ })
  await expect(numberCell).toHaveCount(1)
  const supplierNumber = (await numberCell.innerText()).trim()
  expect(supplierNumber).toMatch(/^SUP-\d+$/)
  const supplier = await supplierRow.getAttribute("data-sf-row")
  if (!supplier || !/^[a-zA-Z0-9_-]+$/.test(supplier)) throw new Error("The supplier chapter did not expose the created supplier identity")
  return { supplier, supplierNumber }
}

/** PR34 15df31a: real private bytes, explicit schema and confirmation, then removal of the same source. */
export async function documentJourney(page: Page, info: TestInfo, capture?: WorkflowCapture) {
  const releases: (() => Promise<void>)[] = []
  let failed = false
  try { await observeDocumentJourney(page, info, releases, capture) }
  catch (error) { failed = true; throw error }
  finally { await closeRecordObservers(releases, failed) }
}

async function observeDocumentJourney(page: Page, info: TestInfo, releases: (() => Promise<void>)[], capture?: WorkflowCapture) {
  const account = await login(page, "first", "suppliers")
  const key = randomUUID(), name = "Operations document " + key, filename = key + ".txt"
  const text = "Price: 42\nReference: " + key + "\n"
  const bytes = Buffer.from(text, "utf8"), blobDigest = createHash("sha256").update(bytes).digest("hex")
  const endpoint = (mode: string, query: Record<string, string> = {}) => modeURL(account, "procurement", mode, query).href
  const isMode = (url: string, mode: string) => {
    const candidate = new URL(url)
    return candidate.origin === account.origin && candidate.pathname === new URL(account.baseURL).pathname + "/procurement" && candidate.searchParams.get("sf") === mode
  }
  const observe = async (tab: Page, target: Parameters<typeof forwardOnce>[1], method: "GET" | "POST" = "GET",
    beforeDelivery?: (response: APIResponse) => Promise<void>) => {
    const capture = await forwardOnce(tab, target, method, beforeDelivery)
    const completed = capture.completed.finally(() => capture.close())
    void completed.catch(() => undefined)
    return { completed }
  }
  const presentationEndpoint = (ref: DocumentEvidence["ref"]) => (url: URL) => {
    if (!isMode(url.href, "document-open") || url.searchParams.size !== 2 || url.searchParams.getAll("ref").length !== 1) return false
    const requested = url.searchParams.get("ref")
    if (!requested) return false
    const value = JSON.parse(requested) as { refId?: unknown; refDigest?: unknown } | null
    return value?.refId === ref.refId && value.refDigest === ref.refDigest
  }
  const { supplier, supplierNumber } = await createDocumentSupplier(page, account, key, name)
  const supplierRow = page.locator(`tr[data-sf-row="${supplier}"]`).filter({ has: page.getByRole("cell", { name, exact: true }) })
  await expect(supplierRow).toHaveCount(1)
  await supplierRow.getByRole("button", { name: "Open record", exact: true }).click()
  const supplierDetail = page.locator(`[data-sf-supplier-ref="${supplier}"]`)
  await expect(supplierDetail).toHaveCount(1)
  await expect(supplierDetail).toHaveAttribute("data-source-version", /^\d+$/)
  const beforeVersion = Number(await supplierDetail.getAttribute("data-source-version"))
  expect(Number.isSafeInteger(beforeVersion)).toBe(true)
  const upload = supplierDetail.locator(`.sf-bound-assets[data-sf-asset-record="${supplier}"]`)
  await expect(upload).toHaveCount(1)
  await upload.getByLabel("Attach a source document (server scan required)", { exact: true })
    .setInputFiles({ name: filename, mimeType: "text/plain", buffer: bytes })
  const supplierPage = account.baseURL + "/api/ui/pages/CAP27?" + new URLSearchParams({ supplier })
  const reconciled = await observe(page, supplierPage)
  // Chromium may lose its cached response body after the native request finishes.
  // Observe one original POST before delivery; forwardOnce preserves its complete
  // response and forbids redirects/retries. A body-tool failure was not a verdict.
  const uploaded = await observe(page, (url) =>
    url.origin === account.origin && url.pathname === new URL(account.baseURL).pathname + "/procurement" &&
      url.searchParams.get("upload") === "supplier" && url.searchParams.get("record") === supplier, "POST")
  const [{ response: uploadResponse, request: uploadRequest }] = await Promise.all([
    uploaded.completed, upload.getByRole("button", { name: `Admit / scan / link (version ${beforeVersion})`, exact: true }).click(),
  ])
  expect(uploadRequest.method()).toBe("POST")
  await observation(info, "operations-document-original-upload-response", {
    stage: "supplier-private-upload", httpStatus: uploadResponse.status(),
    contentType: uploadResponse.headers()["content-type"] ?? null,
    scannerConfigured: Boolean(process.env.SF_OPERATIONS_CLAMD_PORT),
    source: "one forwarded original POST", responseSubstituted: false, automaticRetries: 0,
    priorBodyToolFailureQualifiedProducer: false,
  })
  const uploadResult = await uploadResponse.json() as { ok?: boolean; errors?: unknown }
  if (uploadResponse.status() !== 200) {
    const knownErrors = new Set([
      "Attachment limit is not configured.",
      "Attachment exceeds the configured limit.",
      "The scanner did not accept this file.",
      "The file was not accepted by the scanner.",
      "Unsupported file.",
    ])
    await observation(info, "operations-document-upload-blocked", {
      stage: "supplier-private-upload", httpStatus: uploadResponse.status(),
      producerErrors: Array.isArray(uploadResult.errors)
        ? uploadResult.errors.filter((value): value is string => typeof value === "string" && knownErrors.has(value))
        : [],
      scannerConfigured: Boolean(process.env.SF_OPERATIONS_CLAMD_PORT),
      bypassedScanner: false,
    })
  }
  expect(uploadResponse.status()).toBe(200)
  expect(new URL(uploadResponse.url()).searchParams.get("recordVersion")).toBe(String(beforeVersion))
  expect(uploadResult).toMatchObject({ ok: true })
  const { response: supplierRead } = await reconciled.completed
  expect(supplierRead.status()).toBe(200)
  const projectionAfterUpload = Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP27"].output)(await supplierRead.json())
  expect(projectionAfterUpload).toMatchObject({
    status: "ok",
    context: { principalRef: account.principal, installationId: account.installationId, projectId: account.projectId },
    value: { selection: { supplier }, versions: { ["suppliers:" + supplier]: { version: beforeVersion + 1 } } },
  })
  if (projectionAfterUpload.status !== "ok") throw new Error("The uploaded supplier could not be read back")
  const projectedFiles = projectionAfterUpload.value.data.suppliers.find((row) => row.id === supplier)?.attachments?.filter((item) => item.name === filename)
  expect(projectedFiles).toHaveLength(1)
  await expect(supplierDetail).toHaveAttribute("data-source-version", String(beforeVersion + 1))
  const file = upload.getByRole("listitem").filter({ has: page.getByText(filename, { exact: true }) })
  await expect(file).toHaveCount(1)
  const asset = (await file.locator("span").allInnerTexts())
    .map((text) => text.match(/^ · ref: ([A-Za-z0-9_-]+)$/)?.[1])
    .find((ref) => ref !== undefined)
  expect(asset).toMatch(/^[A-Za-z0-9_-]+$/)
  expect(asset).toBe(projectedFiles?.[0]?.id)
  if (!asset) throw new Error("The reconciled supplier asset did not expose its reference")
  const assetEndpoint = new URL(account.baseURL + "/procurement")
  const linkURL = new URL(assetEndpoint)
  linkURL.searchParams.set("asset-link", asset)
  const contextEndpoint = new URL(account.baseURL + "/api/ui/context")
  const started = performance.now()
  const elapsedMs = () => Math.round(performance.now() - started)
  const phases: Partial<Record<"linkRequested" | "linkIssued" | "linkDelivered" | "linkBrowserResponse" |
    "signedBytesRequested" | "signedBytesResponse" | "signedBytesFailed" | "chromiumDownload",
    { elapsedMs: number; status?: number }>> = {}
  const contextCounts = { request: 0, response: 0, failed: 0 }
  const contextEvents: { phase: keyof typeof contextCounts; elapsedMs: number; status?: number }[] = []
  const recordContext = (phase: keyof typeof contextCounts, request: Request, status?: number) => {
    if (request.method() !== "GET") return
    const url = new URL(request.url())
    if (url.origin !== contextEndpoint.origin || url.pathname !== contextEndpoint.pathname) return
    contextCounts[phase]++
    if (contextEvents.length < 48) contextEvents.push({ phase, elapsedMs: elapsedMs(), status })
  }
  const signedAssetRequest = (request: Request, observedURL = request.url()) => {
    const url = new URL(observedURL)
    return request.method() === "GET" && url.origin === assetEndpoint.origin &&
      url.pathname === assetEndpoint.pathname && url.searchParams.get("asset") === asset &&
      url.searchParams.has("expires") && url.searchParams.has("signature")
  }
  const requestObserved = (request: Request) => {
    if (request.method() === "GET" && request.url() === linkURL.href)
      phases.linkRequested = { elapsedMs: elapsedMs() }
    if (signedAssetRequest(request)) phases.signedBytesRequested = { elapsedMs: elapsedMs() }
    recordContext("request", request)
  }
  const requestFailed = (request: Request) => {
    if (signedAssetRequest(request)) phases.signedBytesFailed = { elapsedMs: elapsedMs() }
    recordContext("failed", request)
  }
  const responseObserved = (response: Response) => {
    if (response.request().method() === "GET" && response.url() === linkURL.href)
      phases.linkBrowserResponse = { elapsedMs: elapsedMs(), status: response.status() }
    recordContext("response", response.request(), response.status())
  }
  page.on("request", requestObserved)
  page.on("requestfailed", requestFailed)
  page.on("response", responseObserved)
  const issuedLink = page.waitForResponse((response) =>
    response.request().method() === "GET" && response.url() === linkURL.href).then(async (response) => {
    expect(response.status()).toBe(200)
    const link = await response.json() as { ok?: boolean; query?: string }
    phases.linkDelivered = { elapsedMs: elapsedMs(), status: response.status() }
    expect(link.ok).toBe(true)
    return link.query
  })
  const linkedAsset = page.waitForResponse((response) => signedAssetRequest(response.request(), response.url())).then((response) => {
    phases.signedBytesResponse = { elapsedMs: elapsedMs(), status: response.status() }
    expect(response.status()).toBe(200)
    return new URL(response.url())
  })
  const downloaded = page.waitForEvent("download").then((download) => {
    phases.chromiumDownload = { elapsedMs: elapsedMs() }
    return download
  })
  const [signedQuery, assetURL, download] = await Promise.all([
    issuedLink, linkedAsset, downloaded, file.getByRole("button", { name: "Download (verify access)", exact: true }).click(),
  ]).finally(async () => {
    page.off("request", requestObserved)
    page.off("requestfailed", requestFailed)
    page.off("response", responseObserved)
    const evidence = JSON.stringify({ elapsedMs: elapsedMs(), phases, contextCounts, contextEvents })
    if (!phases.chromiumDownload) console.info("SF_FILES_DOCUMENT_DOWNLOAD_PHASES", evidence)
    await info.attach("operations-document-download-phases.json", { body: evidence, contentType: "application/json" }).catch(() => undefined)
  })
  expect(assetURL.search.slice(1) === signedQuery, "download uses the producer's exact signed query").toBe(true)
  expect(assetURL.searchParams.get("asset")).toBe(asset)
  expect(assetURL.searchParams.get("expires")).toMatch(/^[1-9]\d*$/)
  expect(/^[a-f0-9]{64}$/.test(assetURL.searchParams.get("signature") ?? ""), "signed query contains an HMAC").toBe(true)
  expect(download.suggestedFilename()).toBe(filename)
  expect(await readFile(await download.path())).toEqual(bytes)
  const requests: string[] = []
  page.context().on("request", (request) => {
    const mode = new URL(request.url()).searchParams.get("sf")
    if (request.method() === "POST" && mode && ["document-admit", "document-schema", "document-extract", "document-confirm"].includes(mode) && isMode(request.url(), mode)) requests.push(mode)
  })
  const catalogRoute = chapterURL(account, "/orchestra/sf-documents")
  const catalogLeaf = '[data-sf-leaf="u24"][data-sf-surface="UI58"]'
  const root = page.locator(catalogLeaf)
  const finishCatalogObservation = observeDocumentCatalog(page, account, info)
  // Capture only the original provider and route reads. Files preflight/egress
  // reads follow those two and remain under their own original authority fences.
  const navigation = await observeFinalGet(page, account.origin,
    new URL(account.baseURL).pathname + "/api/ui/context", 2, (url) =>
      url.searchParams.get("installationId") === account.installationId &&
      url.searchParams.get("projectId") === account.projectId)
  const navigationStamp = (async () => {
    let expected: SfContextStamp | undefined
    for (let index = 0; index < 2; index += 1) {
      const original = await navigation.next()
      expect(original.status).toBe(200)
      const query = new URL(original.request.url()).searchParams
      expect([...query.keys()].sort()).toEqual(["hostId", "installationId", "projectId"])
      expect(query.getAll("installationId")).toEqual([account.installationId])
      expect(query.getAll("projectId")).toEqual([account.projectId])
      const context = Schema.decodeUnknownSync(SfContextResult, { onExcessProperty: "error" })(original.body)
      if (context.status !== "ok") throw new Error("The original document catalog context is unavailable")
      expect(context.value.stamp).toMatchObject({
        installationId: account.installationId, projectId: account.projectId, principalRef: account.principal,
      })
      expect(query.getAll("hostId")).toEqual([context.value.stamp.hostId])
      if (expected) expect(context.value.stamp).toEqual(expected)
      expected = context.value.stamp
    }
    if (!expected) throw new Error("The original catalog navigation supplied no context stamp")
    return expected
  })()
  void navigationStamp.catch(() => undefined)
  let discovered: Awaited<ReturnType<typeof observeRecordFileOperation>> | undefined
  let catalogFailed = false
  const { selected, document } = await (async () => {
    discovered = await observeRecordFileOperation(page, account, navigationStamp,
      "files.document-sources", endpoint("document-sources"), "GET")
    expect((await page.goto(catalogRoute.href))?.status()).toBe(200)
    await navigationStamp
    const sources = await valueOf<Source[]>((await discovered.completed).response)
    const selected = sources.filter((source) => source.label === filename)
    expect(selected).toHaveLength(1)
    expect(selected[0]!.surface).toBe("procurement")
    // HTTP200 precedes the Files transport's original outgoing F01 validation.
    // Keep its exact owner/stamp/readiness check before the unchanged DOM10.
    await discovered.finish()
    await expect(root).toHaveCount(1)
    await expect(root.getByRole("searchbox")).toBeVisible()
    await expect(root.getByRole("button", { name: "Open document", exact: true })).toBeDisabled()
    const document = root.getByRole("combobox", { name: "Document", exact: true })
    await expect(document.getByRole("option", { name: filename, exact: true })).toHaveAttribute("value", selected[0]!.selectionRef)
    return { selected, document }
  })().catch((error: unknown) => { catalogFailed = true; throw error })
    .finally(async () => {
      try { await discovered?.close() }
      finally {
        try { await navigation.close() }
        finally { await finishCatalogObservation(catalogFailed) }
      }
    })
  const fileStamp = await navigationStamp
  const observeFile = async (tab: Page, operation: RecordFileOperation, target: Parameters<typeof forwardOnce>[1],
    method: "GET" | "POST" = "GET", options?: Parameters<typeof observeRecordFileOperation>[6]) => {
    const original = await observeRecordFileOperation(tab, account, fileStamp, operation, target, method, options)
    releases.push(original.close)
    return original
  }
  const navigateCatalog = async (tab: Page, href: string) => {
    const sources = await observeFile(tab, "files.document-sources", endpoint("document-sources"))
    expect((await withRecordNavigation(tab, account, () => tab.goto(href)))?.status()).toBe(200)
    const catalog = await valueOf<Source[]>((await sources.completed).response)
    expect(catalog.filter((source) => source.label === filename).map(({ label, surface }) => ({ label, surface })))
      .toEqual([{ label: filename, surface: "procurement" }])
    await sources.finish()
  }
  const navigateCandidates = (expected: DocumentEvidence[]) => async (tab: Page, href: string) => {
    const candidates = await observeFile(tab, "files.document-candidates", endpoint("document-candidates", { documentRef: expected[0]!.fileRef }))
    expect((await withRecordNavigation(tab, account, () => tab.goto(href)))?.status()).toBe(200)
    expect(await valueOf<DocumentEvidence[]>((await candidates.completed).response)).toEqual(expected)
    await candidates.finish()
  }
  const register = root.locator("details.sf-records-register")
  await register.locator("summary").click()
  const documentInput = register.getByLabel("Document · PDF, TXT or DOCX (up to 20 MiB)", { exact: true })
  const attachDocument = register.getByRole("button", { name: "Scan and attach to record", exact: true })
  await expect(documentInput).toBeVisible()
  await expect(attachDocument).toBeDisabled()
  await expect(register.getByLabel("Existing record ID", { exact: true })).toHaveCount(0)
  await expect(register.getByLabel("Current record version (CAS)", { exact: true })).toHaveCount(0)
  const targetCatalogURL = new URL(account.baseURL + "/api/ui/pages/CAP27").href
  const catalogTargets = await observe(page, targetCatalogURL)
  await register.getByRole("combobox", { name: "Classification", exact: true }).selectOption("supplier")
  const { response: catalogTargetResponse } = await catalogTargets.completed
  expect(catalogTargetResponse.status()).toBe(200)
  const catalogTargetBody = Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP27"].output)(await catalogTargetResponse.json())
  if (catalogTargetBody.status !== "ok") throw new Error("The original supplier upload catalog is unavailable")
  expect(catalogTargetBody.context).toEqual(fileStamp)
  expect(catalogTargetBody.value.versions["suppliers:" + supplier]?.version).toBe(beforeVersion + 1)
  expect(catalogTargetBody.value.data.suppliers.filter((row) => row.id === supplier)).toHaveLength(1)
  const targetRecord = register.getByRole("combobox", { name: "Target record", exact: true })
  const targetLabel = name + " · " + supplierNumber
  await expect(targetRecord).toBeEnabled()
  await expect(targetRecord.getByRole("option", { name: targetLabel, exact: true })).toHaveAttribute("value", supplier)
  await targetRecord.selectOption({ label: targetLabel })
  await expect(targetRecord).toHaveValue(supplier)
  await expect(attachDocument).toBeDisabled()
  await captureRecord(page, info, "UI58", "register-authorized-target")
  const catalogFilename = "catalog-" + filename
  await documentInput.setInputFiles({ name: catalogFilename, mimeType: "text/plain", buffer: bytes })
  await expect(attachDocument).toBeEnabled()
  // Observe exactly one original scanned upload. Record identity and CAS come
  // from the authorized catalog, not a manually entered ID or asset revision.
  const catalogUpload = await observe(page, (url) =>
    url.origin === account.origin && url.pathname === new URL(account.baseURL).pathname + "/procurement" &&
      url.searchParams.get("upload") === "supplier" && url.searchParams.get("record") === supplier, "POST")
  const refreshedTargets = await observe(page, targetCatalogURL)
  const refreshedSources = await observeFile(page, "files.document-sources", endpoint("document-sources"))
  await attachDocument.click()
  const { response: catalogUploadResponse, request: catalogUploadRequest } = await catalogUpload.completed
  expect(catalogUploadRequest.method()).toBe("POST")
  expect(catalogUploadResponse.status()).toBe(200)
  const catalogUploadQuery = new URL(catalogUploadRequest.url()).searchParams
  expect(catalogUploadQuery.get("record")).toBe(supplier)
  expect(catalogUploadQuery.get("recordVersion")).toBe(String(beforeVersion + 1))
  expect(catalogUploadQuery.get("name")).toBe(catalogFilename)
  expect(await catalogUploadResponse.json()).toMatchObject({ ok: true })
  const { response: refreshedTargetResponse } = await refreshedTargets.completed
  expect(refreshedTargetResponse.status()).toBe(200)
  const refreshedTargetBody = Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP27"].output)(await refreshedTargetResponse.json())
  if (refreshedTargetBody.status !== "ok") throw new Error("The uploaded catalog target could not be read back")
  expect(refreshedTargetBody.context).toEqual(fileStamp)
  expect(refreshedTargetBody.value.versions["suppliers:" + supplier]?.version).toBe(beforeVersion + 2)
  expect(refreshedTargetBody.value.data.suppliers.find((row) => row.id === supplier)?.attachments
    ?.filter((item) => item.name === catalogFilename)).toHaveLength(1)
  const refreshedCatalog = await valueOf<Source[]>((await refreshedSources.completed).response)
  await refreshedSources.finish()
  expect(refreshedCatalog.filter((source) => source.label === catalogFilename)).toHaveLength(1)
  const originalSource = refreshedCatalog.filter((source) => source.label === filename)
  expect(originalSource).toHaveLength(1)
  const selectedSourceRef = originalSource[0]!.selectionRef
  await expect(root).toHaveAttribute("data-sf-read-state", "ready")
  await expect(root.locator("[data-sf-upload-outcome]")).toHaveText(
    "File accepted by the server scanner and attached to the authorized record. Refresh and choose the newly admitted source for extraction.",
  )
  await expect(document.getByRole("option", { name: filename, exact: true })).toHaveAttribute("value", selectedSourceRef)
  await observation(info, "operations-document-authorized-upload-target", {
    source: "original CAP27 record catalog and original supplier upload",
    targetLabel, record: supplier, catalogVersion: beforeVersion + 1,
    uploadedVersion: beforeVersion + 2, httpStatus: catalogUploadResponse.status(),
    scannerConfigured: Boolean(process.env.SF_OPERATIONS_CLAMD_PORT),
    manualRecordId: false, manualVersion: false, responseSubstituted: false, automaticRetries: 0,
  })
  if (await register.getAttribute("open") !== null) await register.locator("summary").click()
  await document.selectOption({ value: selectedSourceRef })
  await captureRecordVariants(page, info, "UI58", "authorized-catalog")
  // Extra locale re-mounts belong to the existing opt-in visual sweep;
  // keep the default lane's original 180s budget for confirmation and revocation.
  if (capture) {
    await capturePortugueseRecord(page, info, "UI58", "authorized-catalog", async (localized) => {
      const choice = localized.getByRole("combobox", { name: "Documento", exact: true })
      const option = choice.locator("option").filter({ hasText: filename })
      await expect(option).toHaveCount(1)
      await expect(option).toHaveText(filename)
      // An opaque selection reference belongs to this newly authorized catalog read.
      // Match the unique original attachment name and use this context's current option.
      await choice.selectOption({ label: filename })
      const currentRef = await option.getAttribute("value")
      expect(currentRef).toBeTruthy()
      await expect(choice).toHaveValue(currentRef!)
      await expect(localized.getByRole("button", { name: "Abrir documento", exact: true })).toBeEnabled()
    }, navigateCatalog)
  }
  let admittedRef: string | undefined
  const [admitted, emptyCandidates] = await Promise.all([
    observeFile(page, "files.document-admit", endpoint("document-admit"), "POST", { beforeDelivery: async (response) => {
      admittedRef = (await valueOf<{ documentRef: string }>(response)).documentRef
      expect(admittedRef).not.toBe("")
    } }),
    observeFile(page, "files.document-candidates", () => admittedRef ? endpoint("document-candidates", { documentRef: admittedRef }) : undefined),
  ])
  await root.getByRole("button", { name: "Open document", exact: true }).click()
  const admission = await admitted.completed
  expect(admission.request.postDataJSON()).toEqual({ selectionRef: selectedSourceRef })
  const { documentRef } = await valueOf<{ documentRef: string }>(admission.response)
  expect(documentRef).toBe(admittedRef)
  await admitted.finish()
  expect(await valueOf<DocumentEvidence[]>((await emptyCandidates.completed).response)).toEqual([])
  await emptyCandidates.finish()
  await expect(root).toHaveAttribute("data-sf-read-state", "ready")
  await expect(root.getByText("No extracted candidates yet.", { exact: true })).toBeVisible()
  await capture?.(page, info, { surface: "UI58", state: "admitted-empty-evidence", evidence: "Original private attachment admitted; original candidates read returned an empty array.", attributes: { "data-sf-read-state": "ready" } })
  await capture?.(page, info, { surface: "UI58", state: "authorized-extraction-fields", evidence: "The original admitted document remains selected; extraction fields are inspected before any schema or extraction command.", attributes: { "data-sf-read-state": "ready" }, focus: 'form.sf-files-fields:has(input[maxlength="120"])' })
  const documentRoute = `/orchestra/sf-documents/${encodeSfRouteRef(documentRef)}`
  const evidenceURL = chapterURL(account, documentRoute + "/evidence")
  const scenarioURL = chapterURL(account, documentRoute + "/scenario")
  const observeCandidates = (expectedStatus: 200 | 503 = 200) => observeFile(page,
    "files.document-candidates", endpoint("document-candidates", { documentRef }), "GET", { expectedStatus })
  const readSchemas = () => page.request.get(endpoint("document-schemas", { documentRef }), { maxRetries: 0 }).then((response) => valueOf<DocumentSchema[]>(response))
  const readCandidates = () => page.request.get(endpoint("document-candidates", { documentRef }), { maxRetries: 0 }).then((response) => valueOf<DocumentEvidence[]>(response))
  expect(await readSchemas()).toEqual([])
  const invalid = await page.request.post(endpoint("document-schema"), { maxRetries: 0, headers: { Origin: account.origin, "Idempotency-Key": randomUUID() }, data: { documentRef, fields: [{ id: "Price", type: "currency" }] } })
  expect(invalid.status()).toBe(400)
  expect(await invalid.json()).toMatchObject({ status: "needs-input" })
  expect(await readSchemas()).toEqual([])
  expect(await readCandidates()).toEqual([])
  await root.getByLabel("Field label", { exact: true }).fill("Price")
  await root.getByRole("combobox", { name: "Type", exact: true }).selectOption("number")
  await root.getByLabel("Unit", { exact: true }).fill("USD")
  const [schemaResponse, extractionResponse, candidateResponse] = await Promise.all([
    observeFile(page, "files.document-schema", endpoint("document-schema"), "POST"),
    observeFile(page, "files.document-extract", endpoint("document-extract"), "POST"),
    observeCandidates(),
  ])
  await root.getByRole("button", { name: "Extract candidate", exact: true }).click()
  const schemaTransport = await schemaResponse.completed
  expect(schemaTransport.request.postDataJSON()).toEqual({ documentRef, fields: [{ id: "Price", type: "number", unit: "USD" }] })
  const schema = await valueOf<DocumentSchema>(schemaTransport.response)
  expect(schema).toMatchObject({ version: 1, fields: [{ id: "Price", type: "number", unit: "USD" }] })
  expect(schema.ref).toBe(`schema:${schema.id}:1`)
  expect(schema.id).toMatch(/^schema_[a-f0-9]{40}$/)
  await schemaResponse.finish()
  const extractionTransport = await extractionResponse.completed
  expect(extractionTransport.request.postDataJSON()).toEqual({ documentRef, fieldSchemaRef: schema.ref })
  const candidate = await valueOf<DocumentEvidence>(extractionTransport.response)
  expect(candidate).toMatchObject({ fileRef: documentRef, fieldCandidate: "Price", value: 42, unit: "USD", status: "extracted", textRange: { start: 7, end: 9, unit: "utf16" } })
  expect(candidate.ref).toMatchObject({ schema: "sf-evidence-v1", kind: "document", refId: candidate.id, target: { documentId: documentRef, revision: candidate.version, blobDigest: { algorithm: "sha256", value: blobDigest }, fieldCandidateId: candidate.id, segment: { start: 7, end: 9, unit: "utf16", textDigest: { algorithm: "sha256", value: createHash("sha256").update("42").digest("hex") } } } })
  expect(candidate.ref.target.confirmationVersion).toBeUndefined()
  await extractionResponse.finish()
  expect(await valueOf<DocumentEvidence[]>((await candidateResponse.completed).response)).toEqual([candidate])
  await candidateResponse.finish()
  await expect(root).toHaveAttribute("data-sf-phase", "candidates")
  await expect(root.locator("[data-sf-evidence-id]")).toHaveCount(1)
  await expect(root.getByRole("button", { pressed: false }).filter({ hasText: "Price: 42 USD" })).toBeVisible()
  await capture?.(page, info, { surface: "UI58", state: "original-extracted-candidate", evidence: "Original schema and extraction returned Price 42 USD with exact text range and blob digest; confirmation is absent.", attributes: { "data-sf-phase": "candidates" }, focus: `[data-sf-evidence-id=${JSON.stringify(candidate.id)}]` })
  await captureRecord(page, info, "UI58", "extracted-candidate")
  const continueToEvidence = root.getByRole("link", { name: /^(Document evidence|Evidência do documento)$/ })
  await expect(continueToEvidence).toHaveAttribute("href", evidenceURL.pathname + evidenceURL.search)
  const routedCandidates = await observeCandidates()
  await continueToEvidence.click()
  await expect(page).toHaveURL(evidenceURL.href)
  expect(await valueOf<DocumentEvidence[]>((await routedCandidates.completed).response)).toEqual([candidate])
  await routedCandidates.finish()

  const evidence = page.locator('[data-sf-leaf="u24"][data-sf-surface="UI59"]')
  const cards = evidence.locator("[data-sf-evidence-id]")
  const extractedCard = evidence.locator(`[data-sf-evidence-id=${JSON.stringify(candidate.id)}][data-sf-evidence-state="extracted"]`)
  await expect(cards).toHaveCount(1)
  const reviewSelection = extractedCard.getByRole("button", { name: /^(Confirm selection|Confirmar seleção)$/ })
  await expect(reviewSelection).toBeDisabled()
  const presentationResponse = await observeFile(page, "files.document-open", presentationEndpoint(candidate.ref))
  await extractedCard.getByRole("button", { pressed: false }).filter({ hasText: "Price: 42 USD" }).click()
  const presentationTransport = (await presentationResponse.completed).response
  expect(JSON.parse(new URL(presentationTransport.url()).searchParams.get("ref")!)).toEqual(candidate.ref)
  const presentation = await valueOf<Presentation>(presentationTransport)
  expect(presentation).toMatchObject({ title: filename, excerpt: text.slice(candidate.textRange.start, candidate.textRange.end), location: candidate.location })
  await presentationResponse.finish()
  const sourceText = evidence.getByRole("region", { name: "source-text", exact: true })
  await expect(sourceText.getByRole("heading", { name: filename, exact: true })).toBeVisible()
  await expect(sourceText.locator("blockquote")).toHaveText("42")
  const scenarioLabel = "Use confirmed amount in a scenario"
  const scenarioLink = evidence.getByRole("link", { name: scenarioLabel, exact: true })
  await expect(scenarioLink).toHaveCount(0)
  await reviewSelection.click()
  const confirmationReview = evidence.locator('[data-sf-confirmation="review"]')
  await expect(confirmationReview).toContainText("Price: 42 USD")
  await expect(confirmationReview.locator("blockquote")).toHaveText("42")
  expect(requests).toEqual(["document-admit", "document-schema", "document-extract"])
  await capture?.(page, info, { surface: "UI59", state: "source-confirmation-review", evidence: "Selected original extracted value and original source excerpt are both 42; confirmation has not been sent.", focus: '[data-sf-confirmation="review"]' })
  const rejection = confirmationReview.locator("details.sf-records-reject")
  await rejection.locator("summary").click()
  await expect(rejection.getByLabel("Reason for rejection (required)", { exact: true })).toBeVisible()
  await expect(rejection.getByRole("button", { name: "Reject candidate; save reason and page", exact: true })).toBeDisabled()
  await captureRecord(page, info, "UI59", "rejection-requires-reason")
  await rejection.locator("summary").click()
  await captureRecordVariants(page, info, "UI59", "review-original-source", true, { lightDesktop: true, lightNarrow: true })
  // Reopening the same review in another locale belongs to the existing optional
  // visual sweep; keep the original functional journey inside its 180s budget.
  if (capture) {
    await capturePortugueseRecord(page, info, "UI59", "review-original-source", async (localized) => {
      const card = localized.locator(`[data-sf-evidence-id=${JSON.stringify(candidate.id)}]`)
      const opened = await observeFile(localized, "files.document-open", presentationEndpoint(candidate.ref))
      await card.getByRole("button", { pressed: false }).filter({ hasText: "Price: 42 USD" }).click()
      expect(await valueOf<Presentation>((await opened.completed).response)).toMatchObject({
        title: filename, excerpt: presentation.excerpt, location: presentation.location,
      })
      await opened.finish()
      await expect(localized.locator('[data-sf-surface="UI59"] blockquote')).toHaveText("42")
      await card.getByRole("button", { name: /^(Confirm selection|Confirmar seleção)$/ }).click()
      await expect(localized.locator('[data-sf-confirmation="review"] blockquote')).toHaveText("42")
    }, navigateCandidates([candidate]))
  }
  const [confirmResponse, confirmedCandidates] = await Promise.all([
    observeFile(page, "files.document-confirm", endpoint("document-confirm"), "POST"), observeCandidates(),
  ])
  await confirmationReview.getByRole("button", { name: "Confirm this field", exact: true }).click()
  const confirmationTransport = await confirmResponse.completed
  expect(confirmationTransport.request.postDataJSON()).toEqual(candidate)
  const confirmed = await valueOf<DocumentEvidence>(confirmationTransport.response)
  expect(confirmed).toEqual({ ...candidate, status: "confirmed", ref: { ...candidate.ref, refDigest: expect.stringMatching(/^[a-f0-9]{64}$/), target: { ...candidate.ref.target, confirmationVersion: 1 } } })
  expect(confirmed.ref.refDigest).not.toBe(candidate.ref.refDigest)
  await confirmResponse.finish()
  expect(await valueOf<DocumentEvidence[]>((await confirmedCandidates.completed).response)).toEqual([confirmed])
  await confirmedCandidates.finish()
  await expect(evidence).toHaveAttribute("data-sf-phase", "confirmed")
  await expect(cards).toHaveCount(1)
  const confirmedSelector = `[data-sf-evidence-id=${JSON.stringify(confirmed.id)}][data-sf-evidence-state="confirmed"]`
  await expect(evidence.locator(confirmedSelector)).toHaveCount(1)
  await expect(evidence.getByRole("button", { name: "Confirm this field", exact: true })).toHaveCount(0)
  await expect(scenarioLink).toHaveAttribute("href", scenarioURL.pathname + scenarioURL.search)
  expect(await readSchemas()).toEqual([schema])
  expect(await readCandidates()).toEqual([confirmed])
  await capture?.(page, info, { surface: "UI59", state: "original-confirmed-evidence", evidence: "The original confirmation response returned confirmationVersion 1 and the native evidence route re-read that exact record.", attributes: { "data-sf-phase": "confirmed" } })
  await captureRecord(page, info, "UI59", "confirmed-source-reference")
  const scenarioCandidates = await observeCandidates()
  await scenarioLink.click()
  await expect(page).toHaveURL(scenarioURL.href)
  expect(await valueOf<DocumentEvidence[]>((await scenarioCandidates.completed).response)).toEqual([confirmed])
  await scenarioCandidates.finish()
  const scenario = page.locator('[data-sf-leaf="u24"][data-sf-surface="UI60"]')
  await describeRecordPage(page, info, "scenario-candidates-read")
  const scenarioCard = scenario.locator(confirmedSelector)
  const scenarioAction = scenarioCard.getByRole("button", { name: scenarioLabel, exact: true })
  await expect(scenarioAction).toBeVisible()
  await expect(scenario.getByRole("button", { name: "Preview scenario", exact: true })).toBeDisabled()
  await expect(scenario.locator('[data-sf-scenario="preview"]')).toHaveCount(0)
  const confirmedSource = await observeFile(page, "files.document-open", presentationEndpoint(confirmed.ref))
  await scenarioCard.getByRole("button", { pressed: false }).filter({ hasText: "Price: 42 USD" }).click()
  const confirmedSourceTransport = (await confirmedSource.completed).response
  expect(JSON.parse(new URL(confirmedSourceTransport.url()).searchParams.get("ref")!)).toEqual(confirmed.ref)
  const currentPresentation = await valueOf<Presentation>(confirmedSourceTransport)
  expect(currentPresentation).toMatchObject({ title: presentation.title, excerpt: presentation.excerpt, location: presentation.location })
  expect(new URL(currentPresentation.href!, account.origin).searchParams.get("asset")).toBe(assetURL.searchParams.get("asset"))
  await confirmedSource.finish()
  await expect(scenario.getByRole("region", { name: "source-text", exact: true }).locator("blockquote")).toHaveText("42")
  await capture?.(page, info, { surface: "UI60", state: "confirmed-source-prerequisite", evidence: "The original confirmed evidence and source excerpt are visible. Planner scenario preview remains unavailable and is not claimed." })

  // This original fixture intentionally excludes scenario simulation grants.
  // Preserve that policy: the UI explains the unavailable action and the original
  // producer independently rejects discovery for the same confirmed reference.
  await expect(scenarioAction).toBeDisabled()
  await expect(scenario.getByRole("button", { name: "Refresh destinations", exact: true })).toBeDisabled()
  await expect(scenario.getByRole("status").filter({ hasText: "Scenario preview is unavailable for your current access." })).toBeVisible()
  const deniedTargets = await page.request.get(endpoint("document-scenario-targets", { ref: JSON.stringify(confirmed.ref) }), { maxRetries: 0 })
  expect(deniedTargets.status()).toBe(403)
  expect(await deniedTargets.json()).toMatchObject({ status: "denied" })
  await observation(info, "final-records-restricted-scenario", {
    targetsStatus: deniedTargets.status(), confirmedSource: confirmed.ref,
    simulationGrantsAdded: false, sourceRemainsReadable: true,
  })
  await captureRecordVariants(page, info, "UI60", "confirmed-source-restricted-simulation")
  // Locale remounts stay in the existing optional visual sweep.
  if (capture) {
    await capturePortugueseRecord(page, info, "UI60", "confirmed-evidence", async (localized) => {
      const opened = await observeFile(localized, "files.document-open", presentationEndpoint(confirmed.ref))
      await localized.locator(confirmedSelector).getByRole("button", { pressed: false }).filter({ hasText: "Price: 42 USD" }).click()
      expect(await valueOf<Presentation>((await opened.completed).response)).toMatchObject({
        title: currentPresentation.title, excerpt: currentPresentation.excerpt, location: currentPresentation.location,
      })
      await opened.finish()
      await expect(localized.locator('[data-sf-surface="UI60"] blockquote')).toHaveText("42")
    }, navigateCandidates([confirmed]))
  }

  // Leave the confirmed UI60 card and source open while the second page deletes the supplier.
  const reader = await page.context().newPage()
  // Capture the initial original source read as well as the subsequent reload.
  // A missing UI option must be distinguishable from a producer/catalog failure.
  const initialSources = await observeFile(reader, "files.document-sources", endpoint("document-sources"))
  expect((await withRecordNavigation(reader, account, () => reader.goto(catalogRoute.href)))?.status()).toBe(200)
  expect((await valueOf<Source[]>((await initialSources.completed).response))
    .filter((source) => source.label === filename).map(({ label, surface }) => ({ label, surface })))
    .toEqual([{ label: filename, surface: "procurement" }])
  await initialSources.finish()
  const readerCatalog = reader.locator(catalogLeaf)
  await expect(readerCatalog).toHaveCount(1)
  await expect(reader.getByRole("combobox", { name: "Document", exact: true }).getByRole("option", { name: filename, exact: true })).toHaveCount(1)
  const reloadSources = await observeFile(reader, "files.document-sources", endpoint("document-sources"))
  expect((await withRecordNavigation(reader, account, () => reader.reload()))?.status()).toBe(200)
  expect((await valueOf<Source[]>((await reloadSources.completed).response)).filter((source) => source.label === filename).map(({ label, surface }) => ({ label, surface }))).toEqual([{ label: filename, surface: "procurement" }])
  await reloadSources.finish()
  expect(await readCandidates()).toEqual([confirmed])
  expect(await readSchemas()).toEqual([schema])
  expect(requests).toEqual(["document-admit", "document-schema", "document-extract", "document-confirm"])
  const cap27 = new URL(account.baseURL + "/api/ui/pages/CAP27").href
  const projection = await observe(reader, cap27)
  expect((await withRecordNavigation(reader, account, () =>
    reader.goto(chapterURL(account, "/orchestra/sf-procurement/suppliers").href)))?.status()).toBe(200)
  const projected = (await projection.completed).response
  expect(projected.status()).toBe(200)
  const projectedBody = await projected.json() as { status: string; value?: { versions?: Record<string, { version?: number }> } }
  expect(projectedBody.status).toBe("ok")
  const projectedVersion = projectedBody.value?.versions?.["suppliers:" + supplier]?.version
  expect(projectedVersion).toBe(beforeVersion + 2)
  const readerRow = reader.locator(`tr[data-sf-row="${supplier}"]`)
  await expect(readerRow).toHaveCount(1)
  await expect(readerRow.locator('button[data-sf-action="edit"]')).toBeEnabled()
  await readerRow.getByRole("button", { name: "Open record", exact: true }).click()
  const readerDetail = reader.locator("[data-sf-record-detail]")
  await expect(readerDetail).toHaveCount(1)
  await expect(reader.locator(`[data-sf-supplier-ref="${supplier}"]`)).toHaveCount(1)
  const supplierReference = readerDetail.locator("details.sf-s01-secondary")
  await expect(supplierReference).toHaveCount(1)
  await expect(supplierReference.locator("summary")).toHaveText("Record reference")
  await supplierReference.locator("summary").click()
  await expect(supplierReference.locator("bdi")).toBeVisible()
  await expect(supplierReference.locator("bdi")).toHaveText(supplierNumber)
  const remove = readerDetail.getByRole("button", { name: "Delete pending supplier", exact: true })
  await expect(remove).toHaveCount(1)
  await expect(remove).toBeEnabled()
  await expect(scenarioCard.getByRole("button", { pressed: true })).toContainText("Price: 42 USD")
  await expect(scenario.getByRole("region", { name: "source-text", exact: true }).locator("blockquote")).toHaveText("42")
  await remove.click()
  const deleteReview = reader.locator('[data-component="sf-change-review"]')
  await expect(deleteReview).toHaveCount(1)
  await expect(deleteReview.getByRole("heading", { name: "Delete pending supplier", exact: true })).toBeVisible()
  await expect(deleteReview).toContainText(supplier)
  const confirmDelete = deleteReview.getByRole("button", { name: "Delete pending supplier", exact: true })
  await expect(confirmDelete).toBeEnabled()
  const deleted = await captureCommandResponse(reader, account, { action: "delete", id: supplier }, confirmDelete)
  expect(deleted.status).toBe(200)
  expect(deleted.body).toMatchObject({ ok: true })
  expect(deleted.command).toMatchObject({ page: "Suppliers", action: "delete", id: supplier, version: beforeVersion + 2, values: {} })
  await expect(reader.locator(".sf-u14-layout").getByRole("status").filter({ hasText:
    "Operation accepted.",
  })).toBeVisible()
  await expect(reader.locator(`tr[data-sf-row="${supplier}"]`)).toHaveCount(0)
  await expect(reader.getByRole("cell", { name, exact: true })).toHaveCount(0)
  await expect(reader.getByText(filename, { exact: true })).toHaveCount(0)
  const revokedAsset = await page.request.get(assetURL.href, { maxRetries: 0 })
  expect(revokedAsset.status()).toBe(403)
  expect(await revokedAsset.text()).toBe("Access denied")
  const revokedSource = await page.request.get(endpoint("document-open", { ref: JSON.stringify(confirmed.ref) }), { maxRetries: 0 })
  expect(revokedSource.status()).toBe(409)
  const revokedBody = await revokedSource.json() as { status: string; value?: unknown }
  expect(revokedBody.status).toBe("stale")
  expect(revokedBody.value).toBeUndefined()
  const revokedCandidates = await observeCandidates(503)
  await scenario.getByRole("button", { name: "Refresh sources", exact: true }).click()
  const revokedCandidateRead = (await revokedCandidates.completed).response
  expect(revokedCandidateRead.status()).toBe(503)
  expect(await revokedCandidateRead.json()).toMatchObject({ status: "unavailable" })
  await revokedCandidates.finish()
  await expect(page).toHaveURL(scenarioURL.href)
  await expect(scenario).toHaveAttribute("data-sf-read-state", "unavailable")
  await expect(scenario.locator("[data-sf-evidence-id]")).toHaveCount(0)
  await expect(scenario.locator("blockquote")).toHaveCount(0)
  await expect(scenarioAction).toHaveCount(0)
  await expect(scenario.locator('[data-sf-scenario="preview"]')).toHaveCount(0)

  await capture?.(page, info, { surface: "UI60", state: "source-revoked", evidence: "Original supplier removal revoked the source; native refresh removed all source text and candidates.", attributes: { "data-sf-read-state": "unavailable" } })
  await captureRecord(page, info, "UI60", "revoked-source-unavailable")
  const refreshed = await observeFile(reader, "files.document-sources", endpoint("document-sources"))
  expect((await withRecordNavigation(reader, account, () => reader.goto(catalogRoute.href)))?.status()).toBe(200)
  expect((await valueOf<Source[]>((await refreshed.completed).response)).filter((source) => source.label === filename)).toEqual([])
  await refreshed.finish()
  await expect(readerCatalog.getByRole("combobox", { name: "Document", exact: true }).getByRole("option", { name: filename, exact: true })).toHaveCount(0)
  await expect(readerCatalog.locator("[data-sf-evidence-id]")).toHaveCount(0)
  await expect(readerCatalog.getByRole("button", { name: "Open document", exact: true })).toBeDisabled()
  expect(requests).toEqual(["document-admit", "document-schema", "document-extract", "document-confirm"])
  await observation(info, "operations-document-real-reference", { supplier, asset: assetURL.searchParams.get("asset"), blobDigest, documentRef, schema, candidate, confirmed, scenario: "UI60 confirmed evidence remains readable; original restricted policy denies scenario discovery. Positive native preview is a separate journey.", sourceRevocation: { assetStatus: revokedAsset.status(), evidenceStatus: revokedSource.status(), candidateStatus: revokedCandidateRead.status(), discoveryCount: 0 }, supportedFormat: "UTF-8 text; no OCR assertion" })
  await reader.close()
}
