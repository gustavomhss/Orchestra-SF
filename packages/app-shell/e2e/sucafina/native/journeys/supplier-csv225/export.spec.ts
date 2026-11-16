/**
 * Mission 225 / U14-AC01 / S1-R1-207-005: real installed producer CSV.
 * No API mock, frontend CSV, invented session, policy change, private token,
 * browser launch, storageState or synthesized permission. 223 owns dispatch.
 */
import { createHash } from "node:crypto"
import { expect, type Page, type Request } from "@playwright/test"
import {
  nativeInstalledFixture as test, admittedContext, armHeldResponse,
  connectNativeInstalledBrowser, observeNativeBinding,
} from "../../fixture"
import type { NativeTarget } from "../../fixture"

test.describe.configure({ retries: 0, mode: "serial" })
const csvButton = (page: Page) => page.locator('[data-sf-frame="page"]')
  .getByRole("button", { name: /Export suppliers CSV|Exportar CSV de fornecedores/ })
const isSupplierCsv = (request: Request, target: NativeTarget) => {
  const url = new URL(request.url())
  return request.method() === "GET" && url.origin === target.publicOrigin &&
    url.pathname === target.mount + "/procurement" && url.searchParams.size === 1 &&
    url.searchParams.get("download") === "suppliers"
}

async function originalExportReadiness(page: Page, target: NativeTarget): Promise<boolean> {
  const source = new URL(target.mount + "/api/ui/context", target.publicOrigin)
  source.search = new URLSearchParams({
    installationId: target.installationId, projectId: target.projectId, hostId: target.hostId,
  }).toString()
  const response = await page.request.get(source.href, { maxRedirects: 0, maxRetries: 0 })
  if (response.status() !== 200) throw new Error("U14_CSV_ORIGINAL_CONTEXT_NOT_READY")
  const body = await response.json()
  if (body.status !== "ok") throw new Error("U14_CSV_ORIGINAL_CONTEXT_NOT_ADMITTED")
  return body.value.availability.some((resource: {
    family: string; resource: string
    operations: readonly { operationId: string; state: string; operational: boolean }[]
  }) => resource.family === "files" && resource.resource === "exports" &&
    resource.operations.some((op) => op.operationId === "files.export.suppliers" &&
      op.state === "ready" && op.operational === true))
}
async function openSupplierPage(page: Page, target: NativeTarget) {
  const chapter = new URL(target.chapterHref, target.shellOrigin)
  await page.goto(chapter.href)
  const dest = new URL("/orchestra/sf-procurement/suppliers", target.shellOrigin)
  dest.search = chapter.search
  await page.goto(dest.href)
  await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
}

test("225/U14-AC01 authorized supplier export is byte-identical to original producer", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U14-AC01; S1-R1-207-005; original CSV source, roles, bankmasking and audit through producer" })
  const target = nativeHarness.manifest.target
  const live = await observeNativeBinding(page, target)
  expect(live.destinations.some((dest) => dest.capabilityId === "CAP27" &&
    dest.page === "Suppliers" && dest.surface === "procurement" && dest.canRead)).toBe(true)
  expect(await originalExportReadiness(page, target)).toBe(true)
  await openSupplierPage(page, target)
  await expect(csvButton(page)).toBeEnabled()
  const search = page.locator(".sf-u14-layout").getByRole("searchbox")
  await search.fill("~~225-preserve-filter~~")
  const producerPromise = page.waitForResponse((response) => isSupplierCsv(response.request(), target))
  const downloadPromise = page.waitForEvent("download")
  const writes: Request[] = []
  page.on("request", (request) => {
    if (request.method() === "POST" &&
        new URL(request.url()).pathname === target.mount + "/procurement") writes.push(request)
  })
  await csvButton(page).click()
  const producer = await producerPromise, saved = await downloadPromise
  expect(producer.status()).toBe(200)
  expect(producer.headers()["content-type"]).toMatch(/^text\/csv;\s*charset=utf-8$/i)
  expect(producer.headers()["content-disposition"]).toBe("attachment; filename*=UTF-8''suppliers.csv")
  expect(producer.headers()["cache-control"]).toBe("no-store")
  expect(producer.headers()["x-content-type-options"]).toBe("nosniff")
  expect(saved.suggestedFilename()).toBe("suppliers.csv")
  const originalDigest = createHash("sha256").update(await producer.body()).digest("hex")
  const stream = await saved.createReadStream()
  if (!stream) throw new Error("U14_CSV_BROWSER_DOWNLOAD_STREAM_UNAVAILABLE")
  const sink = createHash("sha256")
  for await (const chunk of stream) sink.update(chunk)
  expect(sink.digest("hex")).toBe(originalDigest)
  await expect(search).toHaveValue("~~225-preserve-filter~~")
  expect(writes).toHaveLength(0)
})

test("225/U14-AC01 denied installed principal gets no CSV egress or bank artifact", async ({ nativeHarness }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U14-AC01; denied actor, no original supplier CSV request/no downloaded bytes" })
  // Reattach to an ALREADY-authenticated, distinct Microsoft browser context.
  // No credential, grant or session is created by this driver.
  const session = await connectNativeInstalledBrowser()
  try {
    const context = await admittedContext(session, "denied")
    const target = nativeHarness.manifest.target
    const page = context.pages().find((entry) => {
      try { return new URL(entry.url()).origin === target.shellOrigin }
      catch { return false }
    })
    if (!page) throw new Error("U14_CSV_REAL_DENIED_SHELL_PAGE_REQUIRED")
    const live = await observeNativeBinding(page, target)
    const readable = live.destinations.some((dest) => dest.capabilityId === "CAP27" &&
      dest.surface === "procurement" && dest.page === "Suppliers" && dest.canRead)
    const exportReady = await originalExportReadiness(page, target)
    if (readable && exportReady) throw new Error("U14_CSV_DENIED_PRINCIPAL_WAS_ACTUALLY_AUTHORIZED")
    let intercepted = 0, downloads = 0
    page.on("request", (request) => { if (isSupplierCsv(request, target)) intercepted++ })
    page.on("download", () => { downloads++ })
    await openSupplierPage(page, target)
    await expect(csvButton(page)).toBeDisabled()
    expect(intercepted).toBe(0)
    expect(downloads).toBe(0)
  } finally {
    await session.disconnect()
  }
})

test("225/U14-AC01 held ORIGINAL response cannot download after source page owner exit", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U14-AC01; response-after-owner exit; no stale browser download" })
  const target = nativeHarness.manifest.target
  expect(await originalExportReadiness(page, target)).toBe(true)
  await openSupplierPage(page, target)
  await expect(csvButton(page)).toBeEnabled()
  const held = await armHeldResponse(page, {
    origin: target.publicOrigin, pathname: target.mount + "/procurement",
    method: "GET", query: { download: "suppliers" },
  })
  const pending = page.waitForRequest((request) => isSupplierCsv(request, target))
  const downloads: string[] = []
  page.on("download", (download) => downloads.push(download.suggestedFilename()))
  try {
    await csvButton(page).click()
    await pending
    const chapter = new URL(target.chapterHref, target.shellOrigin)
    const exit = new URL("/orchestra/sf-procurement/requests", target.shellOrigin)
    exit.search = chapter.search
    await page.goto(exit.href)
    held.release()
    await expect(page.locator(".sf-u14-layout")).toHaveCount(0)
    expect(downloads).toHaveLength(0)
  } finally {
    await held.dispose()
  }
})
