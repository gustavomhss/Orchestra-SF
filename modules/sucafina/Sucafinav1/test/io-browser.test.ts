import { test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { Schema } from "effect"
import { SfContextResult } from "@orchestra/schema/sucafina/context"
import { SfFiles } from "@orchestra/schema/sucafina/files"
import { SfProcurement } from "@orchestra/schema/sucafina/procurement"
import { SfPeople } from "@orchestra/schema/sucafina/people"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import { Workbook } from "exceljs"
import { expect } from "@playwright/test"
import type { Locator, Page, Response } from "@playwright/test"
import path from "node:path"
import { localBrowser } from "./fixture/local-browser.ts"

test("browser previews/applies Planner XLSX and exports persisted monthly values and totals", async () => {
  expectSpawn(import.meta.path)
  console.info("browser IO: opening private native installation")
  const fixture = await localBrowser({ nativePlanner: true })
  try {
    const page = fixture.page
    const origin = new URL(page.url()).origin
    page.setDefaultTimeout(10000)
    page.on("dialog", (dialog) => dialog.accept())
    const nativePage = (response: Response, capability: string) => {
      const url = new URL(response.url())
      return response.request().method() === "GET" && url.origin === origin &&
        url.pathname === "/sucafina/api/ui/pages/" + capability
    }
    const fileResponse = (response: Response, mode: string, method: string) => {
      const url = new URL(response.url())
      return response.request().method() === method && url.origin === origin &&
        url.pathname === "/sucafina/planner" && url.searchParams.get("sf") === mode
    }
    const [contextResponse, document] = await Promise.all([
      page.waitForResponse((response) => {
        const url = new URL(response.url())
        return response.request().method() === "GET" && url.origin === origin &&
          url.pathname === "/sucafina/api/ui/context"
      }, { timeout: 10000 }),
      page.goto(origin + "/orchestra/sf-planner/versions/new", { waitUntil: "load", timeout: 10000 }),
    ])
    expect(document?.status()).toBe(200)
    expect(contextResponse.status()).toBe(200)
    const context = Schema.decodeUnknownSync(SfContextResult)(await contextResponse.json())
    expect(context.status).toBe("ok")
    if (context.status !== "ok") throw new Error("Original local operator context was not admitted")
    expect(context.value.authMode).toBe("local-operator")
    expect(context.value.stamp.principalRef).toBe(fixture.actorId)
    await expect(page.locator('[data-sf-host="owner-runtime231"]')).toHaveAttribute("data-sf-view-state", "ready")
    const versions = page.locator('[data-sf-surface="CAP23"]')
    const create = versions.getByRole("button", { name: "Create first version", exact: true })
    await expect(create).toBeVisible()
    await expect(create).toBeEnabled()
    await create.click()
    const confirm = versions.locator('[data-component="sf-change-review"]').getByRole("button", { name: "Confirm", exact: true })
    await expect(confirm).toBeVisible()
    await expect(confirm).toBeEnabled()
    const [saved] = await Promise.all([
      page.waitForResponse((response) => {
        const url = new URL(response.url())
        return response.request().method() === "POST" && url.origin === origin &&
          url.pathname === "/sucafina/planner" && !url.search
      }, { timeout: 10000 }),
      confirm.click(),
    ])
    expect(saved.status()).toBe(200)
    expect(await saved.json()).toMatchObject({ ok: true })
    await page.reload()
    const [initialResponse] = await Promise.all([
      page.waitForResponse((response) => nativePage(response, "CAP18"), { timeout: 10000 }),
      page.goto(origin + "/orchestra/sf-planner/opex"),
    ])
    const initial = await plannerIoProjection(initialResponse)
    expect(initial.data.selectedVersion).toBeDefined()
    const versionId = initial.data.selectedVersion!.id
    const book = new Workbook()
    const sheet = book.addWorksheet("OPEX")
    sheet.addRow(["Line ID", "Cost element", "Vendor / item", "Description", "Currency", "Measure", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])
    sheet.addRow(["", "Services", "Browser OPEX fixture", "Temporary acceptance record", "USD", "Budget", ...Array.from({ length: 12 }, () => 125)])
    // UI55 owns admission, original-byte preview and explicit apply. The
    // original INSTREAM/PING/EICAR fixture stays in localBrowser; this is not AV qualification.
    const importLink = page.getByRole("link", { name: "Import workbook", exact: true })
    await expect(importLink).toBeVisible()
    await importLink.click()
    const imports = page.locator('.sf-files[data-sf-surface="UI55"]')
    await expect(imports).toBeVisible()
    const [targetResponse] = await Promise.all([
      page.waitForResponse((response) => fileResponse(response, "import-targets", "GET"), { timeout: 10000 }),
      imports.getByRole("button", { name: "Find destinations", exact: true }).click(),
    ])
    expect(targetResponse.status()).toBe(200)
    const targets = Schema.decodeUnknownSync(SfFiles.operations["files.import-targets"].output)(await targetResponse.json())
    expect(targets.status).toBe("ok")
    if (targets.status !== "ok") throw new Error("Original Planner import destinations were not admitted")
    expect(targets.value).toHaveLength(1)
    const target = targets.value[0]!
    expect(target.surface).toBe("planner")
    expect(target.label).toBe(initial.data.selectedVersion!.name)
    await imports.getByLabel("Destination", { exact: true }).selectOption(target.selectionRef)
    const plannerBytes = Buffer.from(await book.xlsx.writeBuffer())
    const plannerFile = path.join(fixture.root, "browser-opex.xlsx")
    await Bun.write(plannerFile, plannerBytes)
    await imports.getByLabel("File", { exact: true }).setInputFiles(plannerFile)
    const previewControl = imports.getByRole("button", { name: "Generate preview", exact: true })
    await expect(previewControl).toBeVisible()
    await expect(previewControl).toBeEnabled()
    const [admittedResponse, previewResponse, referenceResponse] = await Promise.all([
      page.waitForResponse((response) => fileResponse(response, "import-admit", "POST"), { timeout: 10000 }),
      page.waitForResponse((response) => fileResponse(response, "import-preview", "POST"), { timeout: 10000 }),
      page.waitForResponse((response) => fileResponse(response, "import-reference", "GET"), { timeout: 10000 }),
      previewControl.click(),
    ])
    expect(admittedResponse.status()).toBe(200)
    expect(previewResponse.status()).toBe(200)
    expect(referenceResponse.status()).toBe(200)
    const admitted = Schema.decodeUnknownSync(SfFiles.operations["files.import-admit"].output)(await admittedResponse.json())
    const preview = Schema.decodeUnknownSync(SfFiles.operations["files.import-preview"].output)(await previewResponse.json())
    const reference = Schema.decodeUnknownSync(SfFiles.operations["files.import-reference"].output)(await referenceResponse.json())
    expect(admitted.status).toBe("ok")
    expect(preview.status).toBe("ok")
    expect(reference.status).toBe("ok")
    if (admitted.status !== "ok" || preview.status !== "ok" || reference.status !== "ok")
      throw new Error("The original workbook did not produce an admitted native preview")
    const sourceDigest = new Bun.CryptoHasher("sha256").update(plannerBytes).digest("hex")
    expect(admitted.value.digest).toBe(sourceDigest)
    expect(preview.value).toMatchObject({
      sourceDigest, format: "xlsx", state: "preview", domainApplied: false,
      context: { surface: "planner", principalRef: fixture.actorId },
    })
    expect(preview.value.commands).toHaveLength(1)
    expect(preview.value.commands[0]).toMatchObject({ action: "import-workbook", target: { id: versionId } })
    expect(reference.value.detail.sourceDigest).toBe(sourceDigest)
    const addedName = reference.value.detail.changes.filter((change) => change.kind === "added" &&
      change.path.endsWith("/name") && change.after.state === "present" && change.after.value === "Browser OPEX fixture")
    expect(addedName).toHaveLength(1)
    expect(addedName[0]!.path).toMatch(/^\/versions\/@id=[^/]+\/lines\/@id=[^/]+\/name$/)
    const linePath = addedName[0]!.path.slice(0, -"/name".length)
    const budgetChanges = reference.value.detail.changes.filter((change) => change.path.startsWith(linePath + "/b/"))
      .toSorted((left, right) => Number(left.path.split("/").at(-1)) - Number(right.path.split("/").at(-1)))
    expect(budgetChanges.map((change) => Number(change.path.split("/").at(-1)))).toEqual(Array.from({ length: 12 }, (_, month) => month))
    expect(budgetChanges.map((change) => change.after)).toEqual(Array.from({ length: 12 }, () => ({ state: "present", value: 125 })))
    const previewLine = imports.locator(".sf-files-change").filter({ hasText: "Browser OPEX fixture" })
    await expect(previewLine).toHaveCount(1)
    await imports.locator("details").filter({
      has: page.locator(".sf-files-change").filter({ hasText: "Browser OPEX fixture" }),
    }).locator("summary").click()
    await expect(previewLine).toBeVisible()
    // Independently re-read the same authorized projection. Preview must not have
    // changed the stored plan; the browser still owns the real review and Apply.
    const beforeApply = await plannerIoProjection(await page.request.get(initialResponse.url(), { timeout: 10000 }))
    expect(beforeApply.data).toEqual(initial.data)
    const apply = imports.getByRole("button", { name: "Apply reviewed import", exact: true })
    await expect(apply).toBeVisible()
    await expect(apply).toBeEnabled()
    const [appliedResponse] = await Promise.all([
      page.waitForResponse((response) => fileResponse(response, "import-apply", "POST"), { timeout: 10000 }),
      apply.click(),
    ])
    expect(appliedResponse.status()).toBe(200)
    const applied = Schema.decodeUnknownSync(SfFiles.operations["files.import-apply"].output)(await appliedResponse.json())
    expect(applied.status).toBe("ok")
    if (applied.status !== "ok") throw new Error("The original Planner import was not committed")
    expect(applied.value).toMatchObject({ id: preview.value.id, sourceDigest, state: "applied", domainApplied: true })
    expect(applied.value.receipts).toHaveLength(1)
    await expect(imports).toHaveAttribute("data-sf-phase", "receipt")
    await page.reload()
    const [persistedResponse] = await Promise.all([
      page.waitForResponse((response) => nativePage(response, "CAP18"), { timeout: 10000 }),
      page.goto(origin + "/orchestra/sf-planner/opex"),
    ])
    const persisted = await plannerIoProjection(persistedResponse)
    expect(persisted.data.selectedVersion?.id).toBe(versionId)
    const persistedLines = persisted.data.grid?.rows.filter((row) => row.label === "Browser OPEX fixture")
    expect(persistedLines).toHaveLength(1)
    expect(persistedLines![0]!.cells.map((cell) => cell.month)).toEqual(Array.from({ length: 12 }, (_, month) => month + 1))
    expect(persistedLines![0]!.cells.map((cell) => ({ value: cell.forecast.value, source: cell.forecast.source })))
      .toEqual(Array.from({ length: 12 }, () => ({ value: 125, source: "inherited-budget" })))
    const monthlyGrid = page.getByRole("grid")
    await expect(monthlyGrid).toHaveCount(1)
    const projectedLine = monthlyGrid.getByRole("row").filter({ hasText: "Browser OPEX fixture" })
    await expect(projectedLine).toHaveCount(1)
    await expect(projectedLine).toBeVisible()
    const forecasts = projectedLine.locator(".sf-s02-measure").filter({
      has: page.locator(".sf-s02-measure-name").filter({ hasText: /^Forecast$/ }),
    })
    await expect(forecasts).toHaveCount(12)
    await expect(forecasts.locator(".sf-s02-cell-amount")).toHaveText(Array(12).fill("125.00"))
    await expect(forecasts.locator(".sf-s02-cell-source")).toHaveText(Array(12).fill("Inherited value"))
    // The native label is generic; the observed original projection above proves
    // these twelve forecast cells specifically inherit budget.
    await page.goto(origin + "/orchestra/sf-imports/exports")
    await page.getByLabel("format", { exact: true }).selectOption("xlsx")
    const exportControl = page.getByRole("button", { name: "Export", exact: true })
    await expect(exportControl).toBeVisible()
    await expect(exportControl).toBeEnabled()
    const [exportResponse, downloaded] = await Promise.all([
      page.waitForResponse((response) => {
        const url = new URL(response.url())
        return response.request().method() === "GET" && url.origin === origin &&
          url.pathname === "/sucafina/planner" && url.searchParams.get("download") === "xlsx"
      }, { timeout: 10000 }),
      page.waitForEvent("download", { timeout: 10000 }),
      exportControl.click(),
    ])
    expect(exportResponse.status()).toBe(200)
    expect(await downloaded.failure()).toBeNull()
    // A connected Node-owned browser cannot expose Download.path(). saveAs
    // transfers that actual browser download, rather than issuing a second GET.
    const downloadPath = path.join(fixture.root, "browser-opex-export.xlsx")
    await downloaded.saveAs(downloadPath)
    const plannerDownload = Bun.file(downloadPath)
    expect(await plannerDownload.exists()).toBe(true)
    const downloadedBytes = await plannerDownload.arrayBuffer()
    expect(Buffer.from(downloadedBytes)).toEqual(await exportResponse.body())
    const exported = new Workbook()
    await exported.xlsx.load(downloadedBytes)
    const exportedOpex = exported.getWorksheet("OPEX")
    expect(exportedOpex).toBeDefined()
    const rows: unknown[][] = []
    exportedOpex!.eachRow((row) => { if (row.getCell(3).text === "Browser OPEX fixture") rows.push(Array.from({ length: 22 }, (_, column) => row.getCell(column + 1).value)) })
    const budget = rows.find((row) => String(row[8]).startsWith("Budget"))
    expect(budget).toBeDefined()
    expect(budget!.slice(9, 21)).toEqual(Array.from({ length: 12 }, () => 125))
    expect(budget![21]).toMatchObject({ formula: expect.stringMatching(/^SUM\(J\d+:U\d+\)$/), result: 1500 })
    await page.goto(origin + "/orchestra/sf-planner/opex")
    await expect(projectedLine).toBeVisible()
    await page.screenshot({ path: path.join(import.meta.dir, "artifacts/browser-business-opex.png"), fullPage: true, timeout: 10000, animations: "disabled" })
    expect(fixture.errors).toEqual([])
  } catch (error) {
    console.error("browser IO: failed before cleanup", error)
    throw error
  } finally {
    console.info("browser IO: cleanup starting")
    await fixture.dispose()
    console.info("browser IO: cleanup complete")
  }
  fixture.report()
}, 90000)

test("browser roundtrips private document bytes, supplier CSV and Members XLSX", async () => {
  expectSpawn(import.meta.path)
  console.info("browser IO: opening private native installation")
  const fixture = await localBrowser({ nativePlanner: true })
  try {
    console.info("browser IO: private installation authenticated")
    const page = fixture.page
    const origin = new URL(page.url()).origin
    page.setDefaultTimeout(10000)
    page.on("dialog", (dialog) => dialog.accept())
    const nativePage = (response: Response, capability: string) => {
      const url = new URL(response.url())
      return response.request().method() === "GET" && url.origin === origin &&
        url.pathname === "/sucafina/api/ui/pages/" + capability
    }
    const dashboardFile = (response: Response, mode: string, method: string) => {
      const url = new URL(response.url())
      return response.request().method() === method && url.origin === origin &&
        url.pathname === "/sucafina/dashboard" && url.searchParams.get("sf") === mode
    }
    const [contextResponse, initialSettingsResponse, documentResponse] = await Promise.all([
      page.waitForResponse((response) => {
        const url = new URL(response.url())
        return response.request().method() === "GET" && url.origin === origin &&
          url.pathname === "/sucafina/api/ui/context"
      }, { timeout: 10000 }),
      page.waitForResponse((response) => nativePage(response, "CAP28"), { timeout: 10000 }),
      page.goto(origin + "/orchestra/sf-procurement/settings", { waitUntil: "load", timeout: 10000 }),
    ])
    expect(documentResponse?.status()).toBe(200)
    expect(contextResponse.status()).toBe(200)
    const context = Schema.decodeUnknownSync(SfContextResult)(await contextResponse.json())
    expect(context.status).toBe("ok")
    if (context.status !== "ok") throw new Error("Original local operator context was not admitted")
    expect(context.value.authMode).toBe("local-operator")
    expect(context.value.stamp.principalRef).toBe(fixture.actorId)
    await expect(page.locator('[data-sf-host="owner-runtime231"]')).toHaveAttribute("data-sf-view-state", "ready")
    const initialSettings = await settingsIoProjection(initialSettingsResponse)
    expect(initialSettings.data.resetSettings).toBeDefined()
    expect(initialSettings.data.settingsInitialization).toEqual({ state: "absent", expectedVersion: 0 })
    expect(initialSettings.versions.settings).toBeUndefined()
    const settings = page.locator('.sf-n21-settings[data-sf-surface="CAP28"]')
    const reset = settings.locator("[data-sf-settings-reset]")
    await reset.locator("summary").click()
    const resetControl = reset.getByRole("button", { name: "Reset settings", exact: true })
    await expect(resetControl).toBeVisible()
    await expect(resetControl).toBeEnabled()
    await resetControl.click()
    const resetResponse = await confirmProcurement(page, origin,
      settings.locator('[data-component="sf-change-review"]').getByRole("button", { name: "Reset settings", exact: true }),
      { page: "Settings", action: "reset" })
    expect(resetResponse.request().postDataJSON()).toMatchObject({ version: 0, values: {} })
    const [resetRead] = await Promise.all([
      page.waitForResponse((response) => nativePage(response, "CAP28"), { timeout: 10000 }),
      page.reload(),
    ])
    const resetSettings = await settingsIoProjection(resetRead)
    // Defaults come from the original authorized producer, never a fixture baseline.
    expect(resetSettings.data.settings).toEqual(initialSettings.data.resetSettings)
    expect(resetSettings.versions.settings).toEqual({ version: 1, by: fixture.actorId })
    expect(resetSettings.data.settingsInitialization).toBeUndefined()
    // Reset remains an admitted explicit action after the first persisted write.
    await reset.locator("summary").click()
    await expect(resetControl).toBeEnabled()
    await reset.locator("summary").click()
    const policy = settings.locator("form.sf-n21-settings-form")
    await policy.getByLabel("Attachment limit (bytes)", { exact: true }).fill("1048576")
    await policy.locator("#sf-u36-level-holder-0").selectOption(fixture.actorId)
    await policy.locator("#sf-u36-level-holder-1").selectOption(fixture.actorId)
    await policy.getByRole("button", { name: "Review changes", exact: true }).click()
    await confirmProcurement(page, origin,
      settings.locator('[data-component="sf-change-review"]').getByRole("button", { name: "Save", exact: true }),
      { page: "Settings", action: "save" })
    const [policyRead] = await Promise.all([
      page.waitForResponse((response) => nativePage(response, "CAP28"), { timeout: 10000 }),
      page.reload(),
    ])
    const persistedSettings = await settingsIoProjection(policyRead)
    expect(persistedSettings.data.settings.uploadCap).toBe(1048576)
    expect(persistedSettings.data.settings.levels?.slice(0, 2).map((level) => level.holderId))
      .toEqual([fixture.actorId, fixture.actorId])
    await expect(policy.getByLabel("Attachment limit (bytes)", { exact: true })).toHaveValue("1048576")

    await page.goto(origin + "/orchestra/sf-procurement/suppliers")
    await page.getByRole("button", { name: "New supplier", exact: true }).click()
    const suppliers = page.locator(".sf-u14-layout")
    await suppliers.getByLabel("Legal name", { exact: true }).fill("Private asset fixture vendor")
    await suppliers.getByRole("button", { name: "Create supplier", exact: true }).click()
    await confirmProcurement(page, origin,
      suppliers.locator('[data-component="sf-change-review"]').getByRole("button", { name: "Confirm once", exact: true }),
      { page: "Suppliers", action: "create" })
    const [supplierRead] = await Promise.all([
      page.waitForResponse((response) => nativePage(response, "CAP27"), { timeout: 10000 }),
      page.reload(),
    ])
    const supplierPage = await suppliersIoProjection(supplierRead)
    const createdSuppliers = supplierPage.data.suppliers.filter((entry) => entry.legalName === "Private asset fixture vendor")
    expect(createdSuppliers).toHaveLength(1)
    const supplierId = createdSuppliers[0]!.id
    expect(typeof supplierId).toBe("string")
    if (!supplierId) throw new Error("The original Supplier projection omitted the created record reference")
    expect(supplierPage.data.canUploadAttachment).toBe(true)
    const supplierRow = page.getByRole("row").filter({ hasText: "Private asset fixture vendor" })
    await expect(supplierRow).toHaveCount(1)
    await supplierRow.locator('button[data-sf-action="select"]').click()
    const assets = page.locator(".sf-bound-assets")
    await expect(assets).toHaveAttribute("data-sf-asset-record", supplierId)
    const bytes = Buffer.from("Private disposable browser acceptance document\n")
    const upload = assets.locator(".sf-bound-assets-admit")
    await upload.locator('input[type="file"]').setInputFiles({ name: "browser-clean.txt", mimeType: "text/plain", buffer: bytes })
    const uploadControl = upload.getByRole("button")
    await expect(uploadControl).toHaveCount(1)
    await expect(uploadControl).toBeVisible()
    await expect(uploadControl).toBeEnabled()
    // Real private HTTP asset path; the unchanged INSTREAM/PING/EICAR fixture
    // scans these browser-selected bytes. This is not production AV qualification.
    const [uploaded] = await Promise.all([
      page.waitForResponse((response) => {
        const url = new URL(response.url())
        return response.request().method() === "POST" && url.origin === origin &&
          url.pathname === "/sucafina/procurement" && url.searchParams.get("upload") === "supplier"
      }, { timeout: 10000 }),
      uploadControl.click(),
    ])
    expect(uploaded.status()).toBe(200)
    expect(await uploaded.json()).toMatchObject({ ok: true })
    const [attachmentRead] = await Promise.all([
      page.waitForResponse((response) => nativePage(response, "CAP27"), { timeout: 10000 }),
      page.reload(),
    ])
    const attachmentPage = await suppliersIoProjection(attachmentRead)
    const persistedSupplier = attachmentPage.data.suppliers.find((entry) => entry.id === supplierId)
    expect(persistedSupplier?.attachments).toHaveLength(1)
    expect(persistedSupplier!.attachments![0]).toMatchObject({ name: "browser-clean.txt" })
    await supplierRow.locator('button[data-sf-action="select"]').click()
    const privateAsset = assets.getByRole("listitem").filter({ hasText: "browser-clean.txt" })
    await expect(privateAsset).toHaveCount(1)
    const document = await expectNativeDownload(page, privateAsset.getByRole("button"),
      path.join(fixture.root, "browser-clean-download.txt"))
    console.info("browser IO: private document byte verification starting")
    expect(Buffer.from(await document.arrayBuffer())).toEqual(bytes)
    console.info("browser IO: private document byte verification complete")
    const csv = await (await expectNativeDownload(page,
      page.getByRole("button", { name: "Export suppliers CSV", exact: true }),
      path.join(fixture.root, "browser-suppliers.csv"))).text()
    console.info("browser IO: supplier CSV parse starting")
    const records = csv.split(/\r?\n/).map((line) => [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((cell) => cell[1]!.replaceAll('""', '"')))
    expect(records).toHaveLength(2)
    expect(records[1]![records[0]!.indexOf("legalName")]).toBe("Private asset fixture vendor")
    expect(records[1]![records[0]!.indexOf("status")]).toBe("pending")
    console.info("browser IO: supplier CSV parse complete")

    const [membersRead] = await Promise.all([
      page.waitForResponse((response) => nativePage(response, "CAP08"), { timeout: 10000 }),
      page.goto(origin + "/orchestra/sf-people/talent"),
    ])
    const initialMembers = await membersIoProjection(membersRead)
    expect(initialMembers.data.members.filter((member) => member.name === "Browser acceptance member fixture")).toHaveLength(0)
    const membersBook = new Workbook()
    membersBook.addWorksheet("All Members").addRows([
      ["Name", "Title", "Type", "Status", "Notes"],
      ["Browser acceptance member fixture", "Test record", "Employee", "Active", "Synthetic business data; no corporate identity"],
    ])
    console.info("browser IO: Members XLSX generation starting")
    const memberBytes = Buffer.from(await membersBook.xlsx.writeBuffer())
    console.info("browser IO: Members XLSX generation complete")
    const memberFile = path.join(fixture.root, "browser-members.xlsx")
    await Bun.write(memberFile, memberBytes)
    const importControl = page.locator('[data-sf-talent-workbook="import"]')
    await expect(importControl).toBeVisible()
    await expect(importControl).toBeEnabled()
    await importControl.click()
    const imports = page.locator('.sf-files[data-sf-surface="UI55"]')
    await expect(imports).toBeVisible()
    await expect(page.locator('[data-sf-host="owner-runtime231"]')).toHaveAttribute("data-sf-view-state", "ready")
    const importsUrl = new URL(page.url())
    expect(importsUrl.origin).toBe(origin)
    expect(importsUrl.pathname).toBe("/orchestra/sf-imports/new")
    expect(importsUrl.searchParams.get("server")).toBeTruthy()
    expect(importsUrl.searchParams.get("project")).toBe(context.value.stamp.projectId)
    expect(importsUrl.searchParams.get("installation")).toBe(context.value.stamp.installationId)
    await imports.getByLabel("source", { exact: true }).selectOption("dashboard")
    const [targetsResponse] = await Promise.all([
      page.waitForResponse((response) => dashboardFile(response, "import-targets", "GET"), { timeout: 10000 }),
      imports.getByRole("button", { name: "Find destinations", exact: true }).click(),
    ])
    expect(targetsResponse.status()).toBe(200)
    const targets = Schema.decodeUnknownSync(SfFiles.operations["files.import-targets"].output)(await targetsResponse.json())
    expect(targets.status).toBe("ok")
    if (targets.status !== "ok") throw new Error("The original Members import destination was not admitted")
    const memberTargets = targets.value.filter((target) => target.surface === "dashboard" && target.label === "Members")
    expect(memberTargets).toHaveLength(1)
    expect(memberTargets[0]!.sheet).toBe("All Members")
    expect(memberTargets[0]!.formats).toContain("xlsx")
    await imports.getByLabel("Destination", { exact: true }).selectOption(memberTargets[0]!.selectionRef)
    await imports.getByLabel("File", { exact: true }).setInputFiles(memberFile)
    console.info("browser IO: Members workbook preview")
    const previewControl = imports.getByRole("button", { name: "Generate preview", exact: true })
    await expect(previewControl).toBeVisible()
    await expect(previewControl).toBeEnabled()
    const [admittedResponse, memberResponse, referenceResponse] = await Promise.all([
      page.waitForResponse((response) => dashboardFile(response, "import-admit", "POST"), { timeout: 10000 }),
      page.waitForResponse((response) => dashboardFile(response, "import-preview", "POST"), { timeout: 10000 }),
      page.waitForResponse((response) => dashboardFile(response, "import-reference", "GET"), { timeout: 10000 }),
      previewControl.click(),
    ])
    expect(admittedResponse.status()).toBe(200)
    expect(memberResponse.status()).toBe(200)
    expect(referenceResponse.status()).toBe(200)
    const admitted = Schema.decodeUnknownSync(SfFiles.operations["files.import-admit"].output)(await admittedResponse.json())
    const preview = Schema.decodeUnknownSync(SfFiles.operations["files.import-preview"].output)(await memberResponse.json())
    const reference = Schema.decodeUnknownSync(SfFiles.operations["files.import-reference"].output)(await referenceResponse.json())
    expect(admitted.status).toBe("ok")
    expect(preview.status).toBe("ok")
    expect(reference.status).toBe("ok")
    if (admitted.status !== "ok" || preview.status !== "ok" || reference.status !== "ok")
      throw new Error("The original Members workbook did not produce an admitted native preview")
    const sourceDigest = new Bun.CryptoHasher("sha256").update(memberBytes).digest("hex")
    expect(admitted.value.digest).toBe(sourceDigest)
    expect(preview.value).toMatchObject({
      sourceDigest, format: "xlsx", state: "preview", domainApplied: false,
      context: { surface: "dashboard", principalRef: fixture.actorId },
    })
    expect(preview.value.commands).toHaveLength(1)
    expect(preview.value.commands[0]!.action).toBe("import")
    expect(reference.value.manifest.id).toBe(preview.value.id)
    // Same-owner navigation can reuse F01's current context without another GET.
    // Both original import responses must retain its exact authority stamp.
    for (const manifest of [preview.value, reference.value.manifest]) {
      expect(manifest.context).toMatchObject({
        installationId: context.value.stamp.installationId,
        projectId: context.value.stamp.projectId,
        principalRef: context.value.stamp.principalRef,
        accessRevision: context.value.stamp.accessRevision,
        policyVersion: context.value.stamp.policyVersion,
      })
    }
    expect(reference.value.detail.sourceDigest).toBe(sourceDigest)
    const addedMembers = reference.value.detail.changes.filter((change) => change.kind === "added" &&
      change.path.endsWith("/name") && change.after.state === "present" &&
      change.after.value === "Browser acceptance member fixture")
    expect(addedMembers).toHaveLength(1)
    expect(addedMembers[0]!.path).toMatch(/^\/members\/@id=[^/]+\/name$/)
    expect(addedMembers[0]!.source).toMatchObject({ kind: "file", sheet: "All Members", row: 2, column: 1, address: "A2" })
    const memberPath = addedMembers[0]!.path.slice(0, -"/name".length)
    const importedFields = reference.value.detail.changes.filter((change) => change.path.startsWith(memberPath + "/"))
    for (const [field, value, column, address] of [
      ["name", "Browser acceptance member fixture", 1, "A2"],
      ["title", "Test record", 2, "B2"],
      ["type", "Employee", 3, "C2"],
      ["status", "Active", 4, "D2"],
      ["notes", "Synthetic business data; no corporate identity", 5, "E2"],
    ] as const) {
      expect(importedFields.find((change) => change.path === memberPath + "/" + field)).toMatchObject({
        kind: "added", after: { state: "present", value },
        source: { kind: "file", sheet: "All Members", row: 2, column, address },
      })
    }
    // The old "All Members (1)" preview is now the native field-level review:
    // prove one real record and its original All Members row, then show it in the browser.
    const previewMember = imports.locator(".sf-files-change").filter({ hasText: "Browser acceptance member fixture" })
    await expect(previewMember).toHaveCount(1)
    await imports.locator("details").filter({
      has: page.locator(".sf-files-change").filter({ hasText: "Browser acceptance member fixture" }),
    }).locator("summary").click()
    await expect(previewMember).toBeVisible()
    await expect(previewMember).toContainText("All Members")
    const beforeApply = await membersIoProjection(await page.request.get(membersRead.url(), { timeout: 10000 }))
    expect(beforeApply.data).toEqual(initialMembers.data)
    const applyControl = imports.getByRole("button", { name: "Apply reviewed import", exact: true })
    await expect(applyControl).toBeVisible()
    await expect(applyControl).toBeEnabled()
    const [appliedResponse] = await Promise.all([
      page.waitForResponse((response) => dashboardFile(response, "import-apply", "POST"), { timeout: 10000 }),
      applyControl.click(),
    ])
    expect(appliedResponse.status()).toBe(200)
    const applied = Schema.decodeUnknownSync(SfFiles.operations["files.import-apply"].output)(await appliedResponse.json())
    expect(applied.status).toBe("ok")
    if (applied.status !== "ok") throw new Error("The original Members import was not committed")
    expect(applied.value).toMatchObject({ id: preview.value.id, sourceDigest, state: "applied", domainApplied: true })
    expect(applied.value.receipts).toHaveLength(1)
    expect(applied.value.receipts[0]!.status).toBe("applied")
    await expect(imports).toHaveAttribute("data-sf-phase", "receipt")
    await page.reload()
    const [persistedResponse] = await Promise.all([
      page.waitForResponse((response) => nativePage(response, "CAP08"), { timeout: 10000 }),
      page.goto(origin + "/orchestra/sf-people/talent"),
    ])
    const persisted = await membersIoProjection(persistedResponse)
    const persistedMembers = persisted.data.members.filter((member) => member.name === "Browser acceptance member fixture")
    expect(persistedMembers).toHaveLength(1)
    expect(persistedMembers[0]).toMatchObject({
      name: "Browser acceptance member fixture", title: "Test record", type: "Employee",
      status: "Active", notes: "Synthetic business data; no corporate identity",
    })
    await expect(page.getByRole("row").filter({ hasText: "Browser acceptance member fixture" })).toHaveCount(1)
    const membersExport = new Workbook()
    const [exportResponse, memberDownload] = await Promise.all([
      page.waitForResponse((response) => {
        const url = new URL(response.url())
        return response.request().method() === "GET" && url.origin === origin &&
          url.pathname === "/sucafina/dashboard" && url.searchParams.get("download") === "members"
      }, { timeout: 10000 }),
      expectNativeDownload(page, page.locator('[data-sf-talent-workbook="export"]'),
        path.join(fixture.root, "browser-members-export.xlsx")),
    ])
    expect(exportResponse.status()).toBe(200)
    const downloadedBytes = await memberDownload.arrayBuffer()
    expect(Buffer.from(downloadedBytes)).toEqual(await exportResponse.body())
    console.info("browser IO: Members XLSX parse starting")
    await membersExport.xlsx.load(downloadedBytes)
    console.info("browser IO: Members XLSX parse complete")
    const allMembers = membersExport.getWorksheet("All Members")
    expect(allMembers?.rowCount).toBe(2)
    expect(allMembers!.getCell("A2").text).toBe("Browser acceptance member fixture")
    expect(allMembers!.getCell("I2").text).toBe("Active")
    await page.screenshot({ path: path.join(import.meta.dir, "artifacts/browser-business-members.png"), fullPage: true, timeout: 10000, animations: "disabled" })
    expect(fixture.errors).toEqual([])
  } catch (error) {
    console.error("browser IO: native bootstrap", await fixture.nativeDiagnostics().catch(() => ({ unavailable: true })))
    console.error("browser IO: failed before cleanup", error)
    throw error
  } finally {
    console.info("browser IO: cleanup starting")
    await fixture.dispose()
    console.info("browser IO: cleanup complete")
  }
  fixture.report()
}, 90000)

async function submit(page: Page, form: Locator) {
  console.info("browser IO: checking submit control")
  await expect(form).toHaveCount(1)
  await expect(form.locator('button[type="submit"]')).toHaveCount(1)
  await expect(form.locator('button[type="submit"]')).toBeVisible()
  await expect(form.locator('button[type="submit"]')).toBeEnabled()
  const command = { page: await form.getAttribute("data-page"), action: await form.getAttribute("data-command") ?? await form.getAttribute("data-private-upload") }
  console.info("browser IO: submit", JSON.stringify(command))
  const [saved] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST", { timeout: 10000 }),
    form.locator('button[type="submit"]').click(),
  ])
  console.info("browser IO: submit response", JSON.stringify(command), saved.status())
  const payload = await saved.json()
  if (saved.status() !== 200) console.error("browser acceptance response", JSON.stringify({ ...command, status: saved.status(), response: payload }))
  expect(saved.status(), `${command.page} / ${command.action}: ${JSON.stringify(payload)}`).toBe(200)
  expect(payload).toMatchObject({ ok: true })
  await page.reload()
  console.info("browser IO: persisted", JSON.stringify(command))
}
async function expectDownload(page: Page, link: Locator) {
  console.info("browser IO: download", await link.innerText())
  const [downloaded] = await Promise.all([
    page.waitForEvent("download", { timeout: 10000 }),
    link.click(),
  ])
  console.info("browser IO: download event received", downloaded.suggestedFilename())
  expect(await downloaded.failure()).toBeNull()
  const file = await downloaded.path()
  expect(file).not.toBeNull()
  console.info("browser IO: downloaded", downloaded.suggestedFilename())
  return Bun.file(file!)
}

async function confirmProcurement(page: Page, origin: string, control: Locator,
  command: { page: "Settings" | "Suppliers"; action: "reset" | "save" | "create" }) {
  await expect(control).toHaveCount(1)
  await expect(control).toBeVisible()
  await expect(control).toBeEnabled()
  const [saved] = await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url())
      return response.request().method() === "POST" && url.origin === origin &&
        url.pathname === "/sucafina/procurement" && !url.search
    }, { timeout: 10000 }),
    control.click(),
  ])
  expect(saved.request().postDataJSON()).toMatchObject(command)
  expect(saved.status()).toBe(200)
  expect(await saved.json()).toMatchObject({ ok: true })
  return saved
}
async function expectNativeDownload(page: Page, control: Locator, destination: string) {
  await expect(control).toHaveCount(1)
  await expect(control).toBeVisible()
  await expect(control).toBeEnabled()
  const [downloaded] = await Promise.all([
    page.waitForEvent("download", { timeout: 10000 }),
    control.click(),
  ])
  expect(await downloaded.failure()).toBeNull()
  // saveAs transfers the actual Node-owned browser download; no substitute GET.
  await downloaded.saveAs(destination)
  const file = Bun.file(destination)
  expect(await file.exists()).toBe(true)
  return file
}
async function settingsIoProjection(response: Pick<Response, "status" | "json">) {
  expect(response.status()).toBe(200)
  const body = Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP28"].output)(await response.json())
  expect(body.status).toBe("ok")
  if (body.status !== "ok") throw new Error("The original authorized Settings projection was unavailable")
  return body.value
}
async function suppliersIoProjection(response: Pick<Response, "status" | "json">) {
  expect(response.status()).toBe(200)
  const body = Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP27"].output)(await response.json())
  expect(body.status).toBe("ok")
  if (body.status !== "ok") throw new Error("The original authorized Supplier projection was unavailable")
  return body.value
}
async function membersIoProjection(response: Pick<Response, "status" | "json">) {
  expect(response.status()).toBe(200)
  const body = Schema.decodeUnknownSync(SfPeople.operations["domain.page.CAP08"].output)(await response.json())
  expect(body.status).toBe("ok")
  if (body.status !== "ok") throw new Error("The original authorized Members projection was unavailable")
  return body.value
}


async function plannerIoProjection(response: Pick<Response, "status" | "json">) {
  expect(response.status()).toBe(200)
  const body = Schema.decodeUnknownSync(Schema.toType(SfPlanner.operations["domain.page.CAP18"].output), { onExcessProperty: "error" })(await response.json())
  expect(body.status).toBe("ok")
  if (body.status !== "ok") throw new Error("The original authorized Planner projection was unavailable")
  return body.value
}
