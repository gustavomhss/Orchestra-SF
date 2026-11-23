import { createHash, randomUUID } from "node:crypto"
import { expect } from "@playwright/test"
import type { Browser, Page, TestInfo } from "@playwright/test"
import { Schema } from "effect"
import { SfContextResult } from "@orchestra/schema/sucafina/context"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import { SfFiles } from "@orchestra/schema/sucafina/files"
import { SfDocumentEvidence } from "@orchestra/schema/sucafina/files/structures"
import { authenticateDesignInstallation, withDesignInstallation } from "../design-support/installation"
import { ServerConnection } from "../../../src/context/server-connection"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import type { Account } from "./runtime"
import { modeURL, observation } from "./runtime"
import { prepareRecordScenario, previewRecordScenario } from "./final-records-scenario"
import { captureRecordVariants, captureRecordDetail, captureRecordFailure } from "./final-records"

/** Local diagnostics have no Playwright fixture or suite-registration side effects. */
function observeNativeScenario(page: Page) {
  const diagnostics = { pageErrors: [] as string[], consoleErrors: [] as string[] }
  const record = (list: string[], message: string) => {
    const safe = message.replace(/[a-f0-9]{64}/g, "[redacted]")
      .replace(/https?:\/\/[^\s"'<>]+/g, "[url]")
      .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, "[credential]")
      .replace(/\b(code|token|password|secret|authorization)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s&,]+)/gi, "$1=[redacted]")
      .slice(0, 1024)
    if (!list.includes(safe)) list.push(safe)
    if (list.length > 8) list.shift()
  }
  page.on("pageerror", (error) => record(diagnostics.pageErrors, error.stack ?? error.message))
  page.on("console", (entry) => { if (entry.type() === "error") record(diagnostics.consoleErrors, entry.text()) })
  return diagnostics
}

async function enterNativeScenario(page: Page, account: Account, documentRef: string) {
  const target = new URL("/orchestra/sf-documents/" + encodeSfRouteRef(documentRef) + "/scenario", account.origin)
  target.searchParams.set("server", ServerConnection.key({ type: "http", http: { url: account.origin } }))
  target.searchParams.set("project", account.projectId)
  target.searchParams.set("installation", account.installationId)
  expect((await page.goto(target.href))?.status()).toBe(200)
  const host = page.locator('[data-sf-host="owner-runtime231"]')
  for (const attribute of ["data-sf-discovery-state", "data-sf-provider-state", "data-sf-view-state"])
    await expect(host).toHaveAttribute(attribute, "ready")
  await expect(host.getByRole("heading", { level: 1, name: "Evidence in scenario", exact: true })).toBeVisible()
  await expect(page).toHaveURL(target.href)
}

async function readContracts(page: Page, account: Account) {
  const response = await page.request.get(account.baseURL + "/api/ui/pages/CAP14", { maxRetries: 0 })
  expect(response.status()).toBe(200)
  const body = Schema.decodeUnknownSync(SfDomain.operations["domain.page.CAP14"].output)(await response.json())
  if (body.status !== "ok") throw new Error("The original contract source is unavailable")
  expect(body.context.principalRef).toBe(account.principal)
  expect(Array.isArray(body.value.data.contracts)).toBe(true)
  return body.value
}

/** API setup accepted by the original local administrator; only the subsequent UI60 interaction is UI coverage. */
async function prepareConfirmedSource(page: Page, account: Account, info: TestInfo) {
  const key = randomUUID(), filename = "confirmed-price-" + key + ".txt"
  const bytes = Buffer.from("Price: 42\nReference: " + key + "\n", "utf8")
  const before = await readContracts(page, account)
  const name = "Design test data · Confirmed document " + key
  // The basic native operator already administers contracts. No buyer policy,
  // procurement role, upload setting or grant is introduced for this precondition.
  const created = await page.request.post(account.baseURL + "/dashboard?" +
    new URLSearchParams({ page: "Vendor Contracts" }), {
    maxRetries: 0, headers: { Origin: account.origin },
    data: { page: "Vendor Contracts", action: "save", version: 0, confirmed: true,
      values: { vendor: name, num: key, amount: 42, currency: "USD", amtType: "total", renewType: "fixed" } },
  })
  expect(created.status()).toBe(200)
  expect(await created.json()).toMatchObject({ ok: true })
  const current = await readContracts(page, account)
  const own = current.data.contracts!.filter((entry) => entry.vendor === name && entry.num === key &&
    !before.data.contracts!.some((prior) => prior.id === entry.id))
  expect(own).toHaveLength(1)
  const contract = String(own[0]!.id)
  const revision = current.versions["contracts:" + contract]
  expect(revision).toBe(1)
  if (revision === undefined) throw new Error("The new contract has no original CAS")
  const query = new URLSearchParams({
    page: "Vendor Contracts", upload: "contract", record: contract, recordVersion: String(revision), name: filename,
  })
  const uploaded = await page.request.post(account.baseURL + "/dashboard?" + query, {
    maxRetries: 0, headers: { Origin: account.origin, "Content-Type": "text/plain" }, data: bytes,
  })
  expect(uploaded.status(), "the real qualified scanner must accept the exact source bytes").toBe(200)
  expect(await uploaded.json()).toMatchObject({ ok: true })
  const attached = await readContracts(page, account)
  expect(attached.versions["contracts:" + contract]).toBe(revision + 1)
  const files = attached.data.contracts!.find((entry) => String(entry.id) === contract)?.docs?.filter((entry) => entry.name === filename)
  expect(files).toHaveLength(1)
  expect(files![0]?.size).toBe(bytes.byteLength)

  const endpoint = (mode: string, selection: Record<string, string> = {}) => modeURL(account, "dashboard", mode, selection).href
  const sourceResponse = await page.request.get(endpoint("document-sources"), { maxRetries: 0 })
  expect(sourceResponse.status()).toBe(200)
  const sources = Schema.decodeUnknownSync(SfFiles.operations["files.document-sources"].output)(await sourceResponse.json())
  if (sources.status !== "ok") throw new Error("The admitted attachment was not listed by its original source")
  const selected = sources.value.filter((entry) => entry.label === filename && entry.surface === "dashboard")
  expect(selected).toHaveLength(1)
  const post = (mode: string, data: unknown) => page.request.post(endpoint(mode), {
    maxRetries: 0, headers: { Origin: account.origin, "Idempotency-Key": randomUUID() }, data,
  })
  const admittedResponse = await post("document-admit", { selectionRef: selected[0]!.selectionRef })
  expect(admittedResponse.status()).toBe(200)
  const admitted = Schema.decodeUnknownSync(SfFiles.operations["files.document-admit"].output)(await admittedResponse.json())
  if (admitted.status !== "ok") throw new Error("The original document reader refused the uploaded source")
  const documentRef = admitted.value.documentRef
  const schemaResponse = await post("document-schema", { documentRef, fields: [{ id: "Price", type: "number", unit: "USD" }] })
  expect(schemaResponse.status()).toBe(200)
  const schema = Schema.decodeUnknownSync(SfFiles.operations["files.document-schema"].output)(await schemaResponse.json())
  if (schema.status !== "ok") throw new Error("The original explicit document schema was not accepted")
  const extractedResponse = await post("document-extract", { documentRef, fieldSchemaRef: schema.value.ref })
  expect(extractedResponse.status()).toBe(200)
  const extracted = Schema.decodeUnknownSync(SfFiles.operations["files.document-extract"].output)(await extractedResponse.json())
  if (extracted.status !== "ok") throw new Error("The original document extraction did not produce a candidate")
  const candidate = extracted.value
  expect(candidate).toMatchObject({ fileRef: documentRef, fieldCandidate: "Price", value: 42, unit: "USD",
    status: "extracted", textRange: { start: 7, end: 9, unit: "utf16" } })
  expect(candidate.ref.target).toMatchObject({
    blobDigest: { algorithm: "sha256", value: createHash("sha256").update(bytes).digest("hex") },
    segment: { start: 7, end: 9, unit: "utf16",
      textDigest: { algorithm: "sha256", value: createHash("sha256").update("42").digest("hex") } },
  })
  const confirmedResponse = await post("document-confirm", candidate)
  expect(confirmedResponse.status()).toBe(200)
  const confirmation = Schema.decodeUnknownSync(SfFiles.operations["files.document-confirm"].output)(await confirmedResponse.json())
  if (confirmation.status !== "ok") throw new Error("The original document confirmation was not accepted")
  const confirmed = Schema.decodeUnknownSync(SfDocumentEvidence)(confirmation.value)
  expect(confirmed).toEqual({ ...candidate, status: "confirmed", ref: {
    ...candidate.ref, refDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    target: { ...candidate.ref.target, confirmationVersion: 1 },
  } })
  const reread = await page.request.get(endpoint("document-candidates", { documentRef }), { maxRetries: 0 })
  expect(reread.status()).toBe(200)
  const candidates = Schema.decodeUnknownSync(SfFiles.operations["files.document-candidates"].output)(await reread.json())
  expect(candidates).toMatchObject({ status: "ok", value: [confirmed] })
  await observation(info, "final-records-native-source-preconditions", {
    source: "original Dashboard contract upload through qualified ClamD; explicit field schema and human confirmation",
    contract, filename, documentRef, evidence: confirmed.ref, uploadStatus: uploaded.status(),
    grantsModified: false, uiCoverageClaimed: false,
  })
  return confirmed
}

export async function nativeRecordScenarioJourney(browser: Browser, info: TestInfo) {
  const configuredPort = process.env.SF_OPERATIONS_CLAMD_PORT
  if (!configuredPort || !/^[1-9]\d*$/.test(configuredPort))
    throw new Error("UI60 positive coverage requires the existing qualified Operations ClamD lane")
  const port = Number(configuredPort)
  if (!Number.isSafeInteger(port) || port > 65535) throw new Error("Invalid qualified scanner port")
  await withDesignInstallation(async (installed) => {
    const context = await browser.newContext({
      locale: "en-US", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
      reducedMotion: "reduce", colorScheme: "dark",
      httpCredentials: { username: "orchestra", password: installed.serverPassword },
    })
    const page = await context.newPage()
    const diagnostics = observeNativeScenario(page)
    let failed = false
    try {
      const owner = await authenticateDesignInstallation(context, installed)
      const account: Account = {
        baseURL: installed.origin + installed.mount, origin: installed.origin,
        principal: installed.actorId, projectId: owner.projectId, installationId: owner.installationId,
      }
      const fixture = await prepareRecordScenario(page, account)
      const confirmed = await prepareConfirmedSource(page, account, info)
      const contextResponse = await page.request.get(account.baseURL + "/api/ui/context?" + new URLSearchParams({
        installationId: owner.installationId, projectId: owner.projectId, hostId: owner.hostId,
      }), { maxRetries: 0 })
      expect(contextResponse.status()).toBe(200)
      const current = Schema.decodeUnknownSync(SfContextResult)(await contextResponse.json())
      if (current.status !== "ok") throw new Error("The native scenario owner could not be read")
      const reported = current.value.availability.flatMap((resource) => resource.family === "files" ? resource.operations : [])
      for (const operation of ["files.document-scenario-targets", "files.document-scenario-preview"]) {
        const matches = reported.filter((entry) => entry.operationId === operation)
        expect(matches).toHaveLength(1)
        expect(matches[0]).toMatchObject({ state: "ready", operational: true })
      }
      await enterNativeScenario(page, account, confirmed.fileRef)
      const surface = page.locator('[data-sf-surface="UI60"]')
      // Select the original Dashboard source with its native control, including
      // if the default source is unavailable. The server reauthorizes the read.
      const source = surface.getByRole("combobox", { name: "Source", exact: true })
      await expect(source).toBeEnabled()
      await source.selectOption("dashboard")
      await expect(source).toHaveValue("dashboard")
      await expect(surface).toHaveAttribute("data-sf-read-state", "ready")
      await expect(surface.locator("[data-sf-evidence-id]")).toHaveCount(1)
      await previewRecordScenario(page, info, account, confirmed, fixture, "dashboard")
      await captureRecordVariants(page, info, "UI60", "native-authorized-preview", false)
      await captureRecordDetail(page, info, "UI60", "preview-from-confirmed-evidence",
        surface.locator('[data-sf-scenario="preview"]'))
      expect(diagnostics.pageErrors).toEqual([])
      expect(diagnostics.consoleErrors).toEqual([])
    } catch (error) {
      failed = true
      console.info("SF_FINAL_RECORDS_NATIVE_DIAGNOSTICS " + JSON.stringify(diagnostics))
      await captureRecordFailure(page, info).catch(() => undefined)
      throw error
    } finally {
      await (failed ? context.close().catch(() => undefined) : context.close())
    }
  }, "one", { scanner: { host: "127.0.0.1", port } })
}
