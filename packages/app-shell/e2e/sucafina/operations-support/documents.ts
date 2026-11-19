import { createHash, randomUUID } from "node:crypto"
import { expect } from "@playwright/test"
import type { APIResponse, Page, Response, TestInfo } from "@playwright/test"
import type { DocumentEvidence } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import { login, modeURL, observation } from "./runtime.ts"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import type { Account } from "./runtime.ts"

type Source = { selectionRef: string; label: string; surface: string }
type Schema = { id: string; version: number; ref: string; fields: { id: string; type: string; unit?: string }[] }
type Presentation = { title: string; excerpt: string; location: string; href?: string }

function domainPost(page: Page, account: Account, action: string, id?: string) {
  return page.waitForResponse((response) => {
    const request = response.request()
    const url = new URL(request.url())
    if (request.method() !== "POST" || url.origin !== account.origin || !url.pathname.endsWith("/procurement") || url.searchParams.get("page") !== "Suppliers") return false
    const body = request.postDataJSON() as { action?: string; id?: string }
    return body.action === action && (id === undefined || body.id === id)
  })
}

async function valueOf<T>(response: APIResponse | Response): Promise<T> {
  expect(response.status()).toBe(200)
  const body = await response.json() as { status: string; value: T }
  expect(body.status).toBe("ok")
  return body.value
}

/** The original native supplier creation, shared by document admission and its narrow prerequisite proof. */
export async function createDocumentSupplier(page: Page, account: Account, key: string, name: string) {
  expect((await page.goto("/orchestra/sf-procurement/suppliers"))?.status()).toBe(200)
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
  const creation = domainPost(page, account, "create")
  await confirmCreate.click()
  const created = await creation
  expect(created.status()).toBe(200)
  expect(await created.json()).toMatchObject({ ok: true })
  expect(created.request().postDataJSON()).toMatchObject({
    page: "Suppliers", action: "create", version: 0,
    values: { supplier: { legalName: name, country: "France", address: "Isolated E2E supplier", taxId: key, contactEmail: "operations@example.invalid", paymentTerms: "Net 45", currency: "USD", riskRating: "Low" } },
  })
  const suppliersURL = "/orchestra/sf-procurement/suppliers"
  expect((await page.goto(suppliersURL))?.status()).toBe(200)
  const supplierRow = page.locator("tr[data-sf-row]").filter({ has: page.getByRole("cell", { name, exact: true }) })
  await expect(supplierRow).toHaveCount(1)
  const supplierNumber = (await supplierRow.getByRole("cell").first().locator(".sf-s01-cell-value").innerText()).trim()
  expect(supplierNumber).toMatch(/^SUP-\d+$/)
  const supplier = await supplierRow.getAttribute("data-sf-row")
  if (!supplier || !/^[a-zA-Z0-9_-]+$/.test(supplier)) throw new Error("The supplier chapter did not expose the created supplier identity")
  return { supplier, supplierNumber }
}

/** PR34 15df31a: real private bytes, explicit schema and confirmation, then removal of the same source. */
export async function documentJourney(page: Page, info: TestInfo) {
  page.on("console", (message) => {
    const text = message.text()
    try {
      if (/^\[sf-asset-upload\] reason=(contract-mismatch|contract-unavailable|invalid-response|outcome-unknown|aborted|context-mismatch|network)$/.test(text)) console.info(text)
      if (/^\[sf-file-authority\] files\.asset\.upload stage=(context-metadata|context-route|context-status|context-media-type|context-body|context-codec|context-outcome|context-envelope|operation-unavailable|stamp-invalid|installation-changed|principal-changed|policy-changed|access-changed|ready|context-exception)$/.test(text)) console.info(text)
    } catch { /* Diagnostic logging never changes the test action. */ }
  })
  const account = await login(page, "first", "suppliers")
  const key = randomUUID(), name = "Operations document " + key, filename = key + ".txt"
  const text = "Price: 42\nReference: " + key + "\n"
  const bytes = Buffer.from(text, "utf8"), blobDigest = createHash("sha256").update(bytes).digest("hex")
  const endpoint = (mode: string, query: Record<string, string> = {}) => modeURL(account, "procurement", mode, query).href
  const isMode = (url: string, mode: string) => {
    const candidate = new URL(url)
    return candidate.origin === account.origin && candidate.pathname === new URL(account.baseURL).pathname + "/procurement" && candidate.searchParams.get("sf") === mode
  }
  const waiting = (mode: string, method = "GET") => page.waitForResponse((response) => isMode(response.url(), mode) && response.request().method() === method)
  const { supplier, supplierNumber } = await createDocumentSupplier(page, account, key, name)
  const suppliersURL = "/orchestra/sf-procurement/suppliers"
  const supplierRoute = `/orchestra/sf-procurement/suppliers/${encodeSfRouteRef(supplier)}`
  expect((await page.goto(supplierRoute))?.status()).toBe(200)
  const supplierDetail = page.locator(`[data-sf-supplier-ref="${supplier}"]`)
  await expect(supplierDetail).toHaveCount(1)
  await expect(supplierDetail).toHaveAttribute("data-source-version", /^\d+$/)
  const beforeVersion = Number(await supplierDetail.getAttribute("data-source-version"))
  expect(Number.isSafeInteger(beforeVersion)).toBe(true)
  const upload = supplierDetail.locator(`.sf-bound-assets[data-sf-asset-record="${supplier}"]`)
  await expect(upload).toHaveCount(1)
  await upload.getByLabel("Attach a source document (server scan required)", { exact: true })
    .setInputFiles({ name: filename, mimeType: "text/plain", buffer: bytes })
  const uploaded = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return url.origin === account.origin && url.pathname === new URL(account.baseURL).pathname + "/procurement" && url.searchParams.get("upload") === "supplier" && url.searchParams.get("record") === supplier && response.request().method() === "POST"
  })
  await upload.getByRole("button", { name: `Admit / scan / link (version ${beforeVersion})`, exact: true }).click()
  const uploadResponse = await uploaded
  if (uploadResponse.status() !== 200) {
    const responseBody = await uploadResponse.json().catch(() => null) as { errors?: unknown } | null
    const knownErrors = new Set([
      "Attachment limit is not configured.",
      "Attachment exceeds the configured limit.",
      "The scanner did not accept this file.",
      "The file was not accepted by the scanner.",
      "Unsupported file.",
    ])
    await observation(info, "operations-document-upload-blocked", {
      stage: "supplier-private-upload", httpStatus: uploadResponse.status(),
      producerErrors: Array.isArray(responseBody?.errors)
        ? responseBody.errors.filter((value): value is string => typeof value === "string" && knownErrors.has(value))
        : [],
      scannerConfigured: Boolean(process.env.SF_OPERATIONS_CLAMD_PORT),
      bypassedScanner: false,
    })
  }
  expect(uploadResponse.status()).toBe(200)
  expect(new URL(uploadResponse.url()).searchParams.get("recordVersion")).toBe(String(beforeVersion))
  const uploadResult = await uploadResponse.json() as { ok: boolean; value?: { id: string; name: string } }
  expect(uploadResult).toMatchObject({ ok: true, value: { name: filename } })
  const asset = uploadResult.value?.id
  expect(asset).toMatch(/^[A-Za-z0-9_-]+$/)
  await expect(supplierDetail).toHaveAttribute("data-source-version", String(beforeVersion + 1))
  const file = upload.getByRole("listitem").filter({ has: page.getByText(filename, { exact: true }) })
  await expect(file).toHaveCount(1)
  await expect(file).toContainText("ref: " + asset)
  const linkedAsset = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return response.request().method() === "GET" && url.origin === account.origin &&
      url.pathname === new URL(account.baseURL).pathname + "/procurement" && url.searchParams.get("asset") === asset &&
      url.searchParams.has("expires") && url.searchParams.has("signature")
  })
  const downloaded = page.waitForEvent("download")
  await file.getByRole("button", { name: "Download (verify access)", exact: true }).click()
  const original = await linkedAsset
  expect(original.status()).toBe(200)
  expect(await original.body()).toEqual(bytes)
  const assetURL = new URL(original.url())
  expect(assetURL.searchParams.get("asset")).toBe(asset)
  expect(assetURL.searchParams.get("expires")).toMatch(/^[1-9]\d*$/)
  expect(assetURL.searchParams.get("signature")).toMatch(/^[a-f0-9]{64}$/)
  expect((await downloaded).suggestedFilename()).toBe(filename)
  const requests: string[] = []
  page.context().on("request", (request) => {
    const mode = new URL(request.url()).searchParams.get("sf")
    if (request.method() === "POST" && mode && ["document-admit", "document-schema", "document-extract", "document-confirm"].includes(mode) && isMode(request.url(), mode)) requests.push(mode)
  })
  const discovered = waiting("document-sources")
  expect((await page.goto("/orchestra/sf-documents"))?.status()).toBe(200)
  const root = page.locator("[data-document-workbench]")
  await expect(root).toHaveCount(1)
  const sources = await valueOf<Source[]>(await discovered)
  const selected = sources.filter((source) => source.label === filename)
  expect(selected).toHaveLength(1)
  expect(selected[0]!.surface).toBe("procurement")
  await root.getByLabel("Document", { exact: true }).selectOption(selected[0]!.selectionRef)
  const admittedResponse = waiting("document-admit", "POST"), emptyCandidates = waiting("document-candidates")
  await root.getByRole("button", { name: "Open document", exact: true }).click()
  const admissionTransport = await admittedResponse
  expect(admissionTransport.request().postDataJSON()).toEqual({ selectionRef: selected[0]!.selectionRef })
  const { documentRef } = await valueOf<{ documentRef: string }>(admissionTransport)
  expect(documentRef).not.toBe("")
  expect(await valueOf<DocumentEvidence[]>(await emptyCandidates)).toEqual([])
  await expect(root.getByRole("status")).toHaveText("Document ready for review. Extracted fields need explicit confirmation.")
  const readSchemas = () => page.request.get(endpoint("document-schemas", { documentRef }), { maxRetries: 0 }).then((response) => valueOf<Schema[]>(response))
  const readCandidates = () => page.request.get(endpoint("document-candidates", { documentRef }), { maxRetries: 0 }).then((response) => valueOf<DocumentEvidence[]>(response))
  expect(await readSchemas()).toEqual([])
  const invalid = await page.request.post(endpoint("document-schema"), { maxRetries: 0, headers: { Origin: account.origin, "Idempotency-Key": randomUUID() }, data: { documentRef, fields: [{ id: "Price", type: "currency" }] } })
  expect(invalid.status()).toBe(400)
  expect(await invalid.json()).toMatchObject({ status: "needs-input" })
  expect(await readSchemas()).toEqual([])
  expect(await readCandidates()).toEqual([])
  await root.getByLabel("Field label", { exact: true }).fill("Price")
  await root.getByLabel("Type", { exact: true }).selectOption("number")
  await root.getByLabel("Unit", { exact: true }).fill("USD")
  const schemaResponse = waiting("document-schema", "POST"), extractionResponse = waiting("document-extract", "POST"), candidateResponse = waiting("document-candidates"), presentationResponse = waiting("document-open")
  await root.getByRole("button", { name: "Extract candidate", exact: true }).click()
  const schemaTransport = await schemaResponse
  expect(schemaTransport.request().postDataJSON()).toEqual({ documentRef, fields: [{ id: "Price", type: "number", unit: "USD" }] })
  const schema = await valueOf<Schema>(schemaTransport)
  expect(schema).toMatchObject({ version: 1, fields: [{ id: "Price", type: "number", unit: "USD" }] })
  expect(schema.ref).toBe(`schema:${schema.id}:1`)
  expect(schema.id).toMatch(/^schema_[a-f0-9]{40}$/)
  const extractionTransport = await extractionResponse
  expect(extractionTransport.request().postDataJSON()).toEqual({ documentRef, fieldSchemaRef: schema.ref })
  const candidate = await valueOf<DocumentEvidence>(extractionTransport)
  expect(candidate).toMatchObject({ fileRef: documentRef, fieldCandidate: "Price", value: 42, unit: "USD", status: "extracted", textRange: { start: 7, end: 9, unit: "utf16" } })
  expect(candidate.ref).toMatchObject({ schema: "sf-evidence-v1", kind: "document", refId: candidate.id, target: { documentId: documentRef, revision: candidate.version, blobDigest: { algorithm: "sha256", value: blobDigest }, fieldCandidateId: candidate.id, segment: { start: 7, end: 9, unit: "utf16", textDigest: { algorithm: "sha256", value: createHash("sha256").update("42").digest("hex") } } } })
  expect(candidate.ref.target.confirmationVersion).toBeUndefined()
  expect(await valueOf<DocumentEvidence[]>(await candidateResponse)).toEqual([candidate])
  const presentation = await valueOf<Presentation>(await presentationResponse)
  expect(presentation).toMatchObject({ title: filename, excerpt: text.slice(candidate.textRange.start, candidate.textRange.end), location: candidate.location })
  const cards = root.locator("[data-candidates] > section")
  await expect(cards).toHaveCount(1)
  await expect(cards.getByRole("heading", { name: "Price: 42 USD", exact: true })).toBeVisible()
  await expect(cards.locator("blockquote")).toHaveText("42")
  await expect(cards.getByRole("link", { name: "Use confirmed amount in a scenario", exact: true })).toHaveCount(0)
  await expect(root.getByRole("status")).toHaveText("Candidate extracted. Review the source before confirming.")
  const confirmResponse = waiting("document-confirm", "POST"), confirmedCandidates = waiting("document-candidates")
  await cards.getByRole("button", { name: "Confirm this field", exact: true }).click()
  const confirmationTransport = await confirmResponse
  expect(confirmationTransport.request().postDataJSON()).toEqual(candidate)
  const confirmed = await valueOf<DocumentEvidence>(confirmationTransport)
  expect(confirmed).toEqual({ ...candidate, status: "confirmed", ref: { ...candidate.ref, refDigest: expect.stringMatching(/^[a-f0-9]{64}$/), target: { ...candidate.ref.target, confirmationVersion: 1 } } })
  expect(confirmed.ref.refDigest).not.toBe(candidate.ref.refDigest)
  expect(await valueOf<DocumentEvidence[]>(await confirmedCandidates)).toEqual([confirmed])
  await expect(root.getByRole("status")).toHaveText("Field confirmed with its current source.")
  await expect(cards).toHaveCount(1)
  await expect(cards.getByRole("button", { name: "Confirm this field", exact: true })).toHaveCount(0)
  await expect(cards.getByRole("link", { name: "Use confirmed amount in a scenario", exact: true })).toHaveAttribute("href", modeURL(account, "procurement", "document-scenario", { ref: JSON.stringify(confirmed.ref) }).href)
  expect(await readSchemas()).toEqual([schema])
  expect(await readCandidates()).toEqual([confirmed])
  // Keep the confirmed card open in the first page to verify removal of an actual cached value.
  const reader = await page.context().newPage()
  expect((await reader.goto("/orchestra/sf-documents"))?.status()).toBe(200)
  await expect(reader.locator("[data-document-workbench]")).toHaveCount(1)
  await expect(reader.getByLabel("Document", { exact: true }).getByRole("option", { name: filename, exact: true })).toHaveCount(1)
  const reloadSources = reader.waitForResponse((response) => isMode(response.url(), "document-sources") && response.request().method() === "GET")
  expect((await reader.reload())?.status()).toBe(200)
  expect((await valueOf<Source[]>(await reloadSources)).filter((source) => source.label === filename).map(({ label, surface }) => ({ label, surface }))).toEqual([{ label: filename, surface: "procurement" }])
  expect(await readCandidates()).toEqual([confirmed])
  expect(await readSchemas()).toEqual([schema])
  expect(requests).toEqual(["document-admit", "document-schema", "document-extract", "document-confirm"])
  const projection = reader.waitForResponse((response) => {
    const url = new URL(response.url())
    return response.request().method() === "GET" && url.origin === account.origin && url.pathname.endsWith("/api/ui/pages/CAP27")
  })
  expect((await reader.goto("/orchestra/sf-procurement/suppliers"))?.status()).toBe(200)
  const projected = await projection
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
  const currentSource = await page.request.get(endpoint("document-open", { ref: JSON.stringify(confirmed.ref) }), { maxRetries: 0 })
  const currentPresentation = await valueOf<Presentation>(currentSource)
  expect(currentPresentation).toMatchObject({ title: presentation.title, excerpt: presentation.excerpt, location: presentation.location })
  expect(new URL(currentPresentation.href!, account.origin).searchParams.get("asset")).toBe(assetURL.searchParams.get("asset"))
  await expect(cards.getByRole("heading", { name: "Price: 42 USD", exact: true })).toBeVisible()
  await expect(cards.locator("blockquote")).toHaveText("42")
  await remove.click()
  const deleteReview = reader.locator('[data-component="sf-change-review"]')
  await expect(deleteReview).toHaveCount(1)
  await expect(deleteReview.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible()
  await expect(deleteReview).toContainText(supplier)
  const confirmDelete = deleteReview.getByRole("button", { name: "Confirm once", exact: true })
  await expect(confirmDelete).toBeEnabled()
  const deletion = domainPost(reader, account, "delete", supplier)
  await confirmDelete.click()
  const deleted = await deletion
  expect(deleted.status()).toBe(200)
  expect(await deleted.json()).toMatchObject({ ok: true })
  expect(deleted.request().postDataJSON()).toMatchObject({ page: "Suppliers", action: "delete", id: supplier, version: beforeVersion + 1, values: {} })
  expect((await reader.goto(suppliersURL))?.status()).toBe(200)
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
  const refreshed = waiting("document-sources")
  await root.getByRole("button", { name: "Refresh sources", exact: true }).click()
  expect((await valueOf<Source[]>(await refreshed)).filter((source) => source.label === filename)).toEqual([])
  await expect(root.getByLabel("Document", { exact: true }).getByRole("option", { name: filename, exact: true })).toHaveCount(0)
  await expect(root.locator("[data-candidates]")).toBeEmpty()
  await expect(root.getByRole("link", { name: "Use confirmed amount in a scenario", exact: true })).toHaveCount(0)
  await expect(root.getByRole("button", { name: "Open document", exact: true })).toBeDisabled()
  expect(requests).toEqual(["document-admit", "document-schema", "document-extract", "document-confirm"])
  await observation(info, "operations-document-real-reference", { supplier, asset: assetURL.searchParams.get("asset"), blobDigest, documentRef, schema, candidate, confirmed, sourceRevocation: { assetStatus: revokedAsset.status(), evidenceStatus: revokedSource.status(), discoveryCount: 0 }, supportedFormat: "UTF-8 text; no OCR assertion" })
  await reader.close()
}
