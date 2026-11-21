import { createHash, randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { expect } from "@playwright/test"
import { Schema } from "effect"
import { SfProcurement } from "@orchestra/schema/sucafina/procurement"
import type { APIResponse, Locator, Page, Request, Response, Route, TestInfo } from "@playwright/test"
import type { DocumentEvidence } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import { chapterURL, forwardOnce, login, modeURL, observation } from "./runtime.ts"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import type { Account } from "./runtime.ts"

type Source = { selectionRef: string; label: string; surface: string }
type DocumentSchema = { id: string; version: number; ref: string; fields: { id: string; type: string; unit?: string }[] }
type Presentation = { title: string; excerpt: string; location: string; href?: string }

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
  expect((await page.goto(chapterURL(account, "/orchestra/sf-procurement/suppliers").href))?.status()).toBe(200)
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
  await expect(review.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible()
  await expect(review).toContainText(name)
  const confirmCreate = review.getByRole("button", { name: "Confirm once", exact: true })
  await expect(confirmCreate).toBeEnabled()
  const created = await captureCommandResponse(page, account, { action: "create" }, confirmCreate)
  expect(created.status).toBe(200)
  expect(created.body).toMatchObject({ ok: true })
  expect(created.command).toMatchObject({
    page: "Suppliers", action: "create", version: 0,
    values: { supplier: { legalName: name, country: "France", address: "Isolated E2E supplier", taxId: key, contactEmail: "operations@example.invalid", paymentTerms: "Net 45", currency: "USD", riskRating: "Low" } },
  })
  await expect(suppliers.getByRole("status").filter({ hasText:
    "The producer acknowledged the command; no synthetic receipt was created.",
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
export async function documentJourney(page: Page, info: TestInfo) {
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
  const uploaded = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return url.origin === account.origin && url.pathname === new URL(account.baseURL).pathname + "/procurement" && url.searchParams.get("upload") === "supplier" && url.searchParams.get("record") === supplier && response.request().method() === "POST"
  }).then(async (response) => ({ response, result: await response.json() as { ok?: boolean; errors?: unknown } }))
  const [{ response: uploadResponse, result: uploadResult }] = await Promise.all([
    uploaded, upload.getByRole("button", { name: `Admit / scan / link (version ${beforeVersion})`, exact: true }).click(),
  ])
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
  const linkCapture = await forwardOnce(page, linkURL.href, "GET", async (response) => {
    phases.linkIssued = { elapsedMs: elapsedMs(), status: response.status() }
  })
  page.on("request", requestObserved)
  page.on("requestfailed", requestFailed)
  page.on("response", responseObserved)
  const issuedLink = linkCapture.completed.then(async ({ response }) => {
    phases.linkDelivered = { elapsedMs: elapsedMs(), status: response.status() }
    expect(response.status()).toBe(200)
    const link = await response.json() as { ok?: boolean; query?: string }
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
    await linkCapture.close()
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
  const discovered = await observe(page, endpoint("document-sources"))
  const catalogRoute = chapterURL(account, "/orchestra/sf-documents")
  const catalogLeaf = '[data-sf-leaf="u24"][data-sf-surface="UI58"]'
  expect((await page.goto(catalogRoute.href))?.status()).toBe(200)
  const root = page.locator(catalogLeaf)
  await expect(root).toHaveCount(1)
  await expect(root.getByRole("searchbox")).toBeVisible()
  await expect(root.getByRole("button", { name: "Open document", exact: true })).toBeDisabled()
  const sources = await valueOf<Source[]>((await discovered.completed).response)
  const selected = sources.filter((source) => source.label === filename)
  expect(selected).toHaveLength(1)
  expect(selected[0]!.surface).toBe("procurement")
  const document = root.getByRole("combobox", { name: "Document", exact: true })
  await expect(document.getByRole("option", { name: filename, exact: true })).toHaveAttribute("value", selected[0]!.selectionRef)
  await document.selectOption({ value: selected[0]!.selectionRef })
  let admittedRef: string | undefined
  const [admitted, emptyCandidates] = await Promise.all([
    observe(page, endpoint("document-admit"), "POST", async (response) => {
      admittedRef = (await valueOf<{ documentRef: string }>(response)).documentRef
      expect(admittedRef).not.toBe("")
    }),
    observe(page, () => admittedRef ? endpoint("document-candidates", { documentRef: admittedRef }) : undefined),
  ])
  await root.getByRole("button", { name: "Open document", exact: true }).click()
  const admission = await admitted.completed
  expect(admission.request.postDataJSON()).toEqual({ selectionRef: selected[0]!.selectionRef })
  const { documentRef } = await valueOf<{ documentRef: string }>(admission.response)
  expect(documentRef).toBe(admittedRef)
  expect(await valueOf<DocumentEvidence[]>((await emptyCandidates.completed).response)).toEqual([])
  await expect(root).toHaveAttribute("data-sf-read-state", "ready")
  await expect(root.getByText("No extracted candidates yet.", { exact: true })).toBeVisible()
  const documentRoute = `/orchestra/sf-documents/${encodeSfRouteRef(documentRef)}`
  const evidenceURL = chapterURL(account, documentRoute + "/evidence")
  const scenarioURL = chapterURL(account, documentRoute + "/scenario")
  const observeCandidates = () => observe(page, endpoint("document-candidates", { documentRef }))
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
    observe(page, endpoint("document-schema"), "POST"),
    observe(page, endpoint("document-extract"), "POST"),
    observeCandidates(),
  ])
  await root.getByRole("button", { name: "Extract candidate", exact: true }).click()
  const schemaTransport = await schemaResponse.completed
  expect(schemaTransport.request.postDataJSON()).toEqual({ documentRef, fields: [{ id: "Price", type: "number", unit: "USD" }] })
  const schema = await valueOf<DocumentSchema>(schemaTransport.response)
  expect(schema).toMatchObject({ version: 1, fields: [{ id: "Price", type: "number", unit: "USD" }] })
  expect(schema.ref).toBe(`schema:${schema.id}:1`)
  expect(schema.id).toMatch(/^schema_[a-f0-9]{40}$/)
  const extractionTransport = await extractionResponse.completed
  expect(extractionTransport.request.postDataJSON()).toEqual({ documentRef, fieldSchemaRef: schema.ref })
  const candidate = await valueOf<DocumentEvidence>(extractionTransport.response)
  expect(candidate).toMatchObject({ fileRef: documentRef, fieldCandidate: "Price", value: 42, unit: "USD", status: "extracted", textRange: { start: 7, end: 9, unit: "utf16" } })
  expect(candidate.ref).toMatchObject({ schema: "sf-evidence-v1", kind: "document", refId: candidate.id, target: { documentId: documentRef, revision: candidate.version, blobDigest: { algorithm: "sha256", value: blobDigest }, fieldCandidateId: candidate.id, segment: { start: 7, end: 9, unit: "utf16", textDigest: { algorithm: "sha256", value: createHash("sha256").update("42").digest("hex") } } } })
  expect(candidate.ref.target.confirmationVersion).toBeUndefined()
  expect(await valueOf<DocumentEvidence[]>((await candidateResponse.completed).response)).toEqual([candidate])
  await expect(root).toHaveAttribute("data-sf-phase", "candidates")
  await expect(root.locator("[data-sf-evidence-id]")).toHaveCount(1)
  await expect(root.getByRole("button", { pressed: false }).filter({ hasText: "Price: 42 USD" })).toBeVisible()
  const continueToEvidence = root.getByRole("link", { name: /^(Document evidence|Evidência do documento)$/ })
  await expect(continueToEvidence).toHaveAttribute("href", evidenceURL.pathname + evidenceURL.search)
  const routedCandidates = await observeCandidates()
  await continueToEvidence.click()
  await expect(page).toHaveURL(evidenceURL.href)
  expect(await valueOf<DocumentEvidence[]>((await routedCandidates.completed).response)).toEqual([candidate])

  const evidence = page.locator('[data-sf-leaf="u24"][data-sf-surface="UI59"]')
  const cards = evidence.locator("[data-sf-evidence-id]")
  const extractedCard = evidence.locator(`[data-sf-evidence-id=${JSON.stringify(candidate.id)}][data-sf-evidence-state="extracted"]`)
  await expect(cards).toHaveCount(1)
  const reviewSelection = extractedCard.getByRole("button", { name: /^(Confirm selection|Confirmar seleção)$/ })
  await expect(reviewSelection).toBeDisabled()
  const presentationResponse = await observe(page, presentationEndpoint(candidate.ref))
  await extractedCard.getByRole("button", { pressed: false }).filter({ hasText: "Price: 42 USD" }).click()
  const presentationTransport = (await presentationResponse.completed).response
  expect(JSON.parse(new URL(presentationTransport.url()).searchParams.get("ref")!)).toEqual(candidate.ref)
  const presentation = await valueOf<Presentation>(presentationTransport)
  expect(presentation).toMatchObject({ title: filename, excerpt: text.slice(candidate.textRange.start, candidate.textRange.end), location: candidate.location })
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
  const [confirmResponse, confirmedCandidates] = await Promise.all([
    observe(page, endpoint("document-confirm"), "POST"), observeCandidates(),
  ])
  await confirmationReview.getByRole("button", { name: "Confirm this field", exact: true }).click()
  const confirmationTransport = await confirmResponse.completed
  expect(confirmationTransport.request.postDataJSON()).toEqual(candidate)
  const confirmed = await valueOf<DocumentEvidence>(confirmationTransport.response)
  expect(confirmed).toEqual({ ...candidate, status: "confirmed", ref: { ...candidate.ref, refDigest: expect.stringMatching(/^[a-f0-9]{64}$/), target: { ...candidate.ref.target, confirmationVersion: 1 } } })
  expect(confirmed.ref.refDigest).not.toBe(candidate.ref.refDigest)
  expect(await valueOf<DocumentEvidence[]>((await confirmedCandidates.completed).response)).toEqual([confirmed])
  await expect(evidence).toHaveAttribute("data-sf-phase", "confirmed")
  await expect(cards).toHaveCount(1)
  const confirmedSelector = `[data-sf-evidence-id=${JSON.stringify(confirmed.id)}][data-sf-evidence-state="confirmed"]`
  await expect(evidence.locator(confirmedSelector)).toHaveCount(1)
  await expect(evidence.getByRole("button", { name: "Confirm this field", exact: true })).toHaveCount(0)
  await expect(scenarioLink).toHaveAttribute("href", scenarioURL.pathname + scenarioURL.search)
  expect(await readSchemas()).toEqual([schema])
  expect(await readCandidates()).toEqual([confirmed])
  const scenarioCandidates = await observeCandidates()
  await scenarioLink.click()
  await expect(page).toHaveURL(scenarioURL.href)
  expect(await valueOf<DocumentEvidence[]>((await scenarioCandidates.completed).response)).toEqual([confirmed])
  const scenario = page.locator('[data-sf-leaf="u24"][data-sf-surface="UI60"]')
  const scenarioCard = scenario.locator(confirmedSelector)
  const scenarioAction = scenarioCard.getByRole("button", { name: scenarioLabel, exact: true })
  await expect(scenarioAction).toBeVisible()
  await expect(scenario.getByRole("button", { name: "Preview scenario", exact: true })).toBeDisabled()
  await expect(scenario.locator('[data-sf-scenario="preview"]')).toHaveCount(0)
  const confirmedSource = await observe(page, presentationEndpoint(confirmed.ref))
  await scenarioCard.getByRole("button", { pressed: false }).filter({ hasText: "Price: 42 USD" }).click()
  const confirmedSourceTransport = (await confirmedSource.completed).response
  expect(JSON.parse(new URL(confirmedSourceTransport.url()).searchParams.get("ref")!)).toEqual(confirmed.ref)
  const currentPresentation = await valueOf<Presentation>(confirmedSourceTransport)
  expect(currentPresentation).toMatchObject({ title: presentation.title, excerpt: presentation.excerpt, location: presentation.location })
  expect(new URL(currentPresentation.href!, account.origin).searchParams.get("asset")).toBe(assetURL.searchParams.get("asset"))

  // Leave the confirmed UI60 card and source open while the second page deletes the supplier.
  const reader = await page.context().newPage()
  expect((await reader.goto(catalogRoute.href))?.status()).toBe(200)
  const readerCatalog = reader.locator(catalogLeaf)
  await expect(readerCatalog).toHaveCount(1)
  await expect(reader.getByRole("combobox", { name: "Document", exact: true }).getByRole("option", { name: filename, exact: true })).toHaveCount(1)
  const reloadSources = await observe(reader, endpoint("document-sources"))
  expect((await reader.reload())?.status()).toBe(200)
  expect((await valueOf<Source[]>((await reloadSources.completed).response)).filter((source) => source.label === filename).map(({ label, surface }) => ({ label, surface }))).toEqual([{ label: filename, surface: "procurement" }])
  expect(await readCandidates()).toEqual([confirmed])
  expect(await readSchemas()).toEqual([schema])
  expect(requests).toEqual(["document-admit", "document-schema", "document-extract", "document-confirm"])
  const cap27 = new URL(account.baseURL + "/api/ui/pages/CAP27").href
  const projection = await observe(reader, cap27)
  expect((await reader.goto(chapterURL(account, "/orchestra/sf-procurement/suppliers").href))?.status()).toBe(200)
  const projected = (await projection.completed).response
  expect(projected.status()).toBe(200)
  const projectedBody = await projected.json() as { status: string; value?: { versions?: Record<string, { version?: number }> } }
  expect(projectedBody.status).toBe("ok")
  const projectedVersion = projectedBody.value?.versions?.["suppliers:" + supplier]?.version
  expect(projectedVersion).toBe(beforeVersion + 1)
  const readerRow = reader.locator(`tr[data-sf-row="${supplier}"]`)
  await expect(readerRow).toHaveCount(1)
  await readerRow.getByRole("button", { name: "Open record", exact: true }).click()
  const readerDetail = reader.locator("[data-sf-record-detail]")
  await expect(readerDetail).toHaveCount(1)
  await expect(reader.locator(`[data-sf-supplier-ref="${supplier}"]`)).toHaveCount(1)
  await expect(readerDetail.locator("p.sf-s01-secondary bdi")).toHaveText(supplierNumber)
  const remove = readerDetail.getByRole("button", { name: "Delete pending supplier", exact: true })
  await expect(remove).toHaveCount(1)
  await expect(remove).toBeEnabled()
  await expect(scenarioCard.getByRole("button", { pressed: true })).toContainText("Price: 42 USD")
  await expect(scenario.getByRole("region", { name: "source-text", exact: true }).locator("blockquote")).toHaveText("42")
  await remove.click()
  const deleteReview = reader.locator('[data-component="sf-change-review"]')
  await expect(deleteReview).toHaveCount(1)
  await expect(deleteReview.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible()
  await expect(deleteReview).toContainText(supplier)
  const confirmDelete = deleteReview.getByRole("button", { name: "Confirm once", exact: true })
  await expect(confirmDelete).toBeEnabled()
  const deleted = await captureCommandResponse(reader, account, { action: "delete", id: supplier }, confirmDelete)
  expect(deleted.status).toBe(200)
  expect(deleted.body).toMatchObject({ ok: true })
  expect(deleted.command).toMatchObject({ page: "Suppliers", action: "delete", id: supplier, version: beforeVersion + 1, values: {} })
  await expect(reader.locator(".sf-u14-layout").getByRole("status").filter({ hasText:
    "The producer acknowledged the command; no synthetic receipt was created.",
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
  const revokedCandidates = await observeCandidates()
  await scenario.getByRole("button", { name: "Refresh sources", exact: true }).click()
  const revokedCandidateRead = (await revokedCandidates.completed).response
  expect(revokedCandidateRead.status()).toBe(503)
  expect(await revokedCandidateRead.json()).toMatchObject({ status: "unavailable" })
  await expect(page).toHaveURL(scenarioURL.href)
  await expect(scenario).toHaveAttribute("data-sf-read-state", "unavailable")
  await expect(scenario.locator("[data-sf-evidence-id]")).toHaveCount(0)
  await expect(scenario.locator("blockquote")).toHaveCount(0)
  await expect(scenarioAction).toHaveCount(0)
  await expect(scenario.locator('[data-sf-scenario="preview"]')).toHaveCount(0)

  const refreshed = await observe(reader, endpoint("document-sources"))
  expect((await reader.goto(catalogRoute.href))?.status()).toBe(200)
  expect((await valueOf<Source[]>((await refreshed.completed).response)).filter((source) => source.label === filename)).toEqual([])
  await expect(readerCatalog.getByRole("combobox", { name: "Document", exact: true }).getByRole("option", { name: filename, exact: true })).toHaveCount(0)
  await expect(readerCatalog.locator("[data-sf-evidence-id]")).toHaveCount(0)
  await expect(readerCatalog.getByRole("button", { name: "Open document", exact: true })).toBeDisabled()
  expect(requests).toEqual(["document-admit", "document-schema", "document-extract", "document-confirm"])
  await observation(info, "operations-document-real-reference", { supplier, asset: assetURL.searchParams.get("asset"), blobDigest, documentRef, schema, candidate, confirmed, scenario: "UI60 confirmed evidence read; Planner preview not proven by this fixture", sourceRevocation: { assetStatus: revokedAsset.status(), evidenceStatus: revokedSource.status(), candidateStatus: revokedCandidateRead.status(), discoveryCount: 0 }, supportedFormat: "UTF-8 text; no OCR assertion" })
  await reader.close()
}
