import { createHash, randomUUID } from "node:crypto"
import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"
import { Schema } from "effect"
import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import { collabTest, capture, enter, observePage, ready, reflow, scheme, scrollPageTop } from "./design-support/wave-five-collab"
import { seedWaveFiveCollab, waveFiveCollabData } from "./design-support/wave-five-collab-seed"
import { captureOriginalImportPreview } from "./design-support/wave-five-collab-imports"
import { waveFourTest } from "./design-support/wave-four"
import { waveThreeData } from "./design-support/wave-three-data"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"

const { Workbook } = createRequire(new URL("../../../../modules/sucafina/package.json", import.meta.url))("exceljs") as typeof import("../../../../modules/sucafina/node_modules/exceljs")
type Destination = { label: string; selectionRef: string; surface: "planner" | "dashboard"; formats: string[] }

collabTest("UI55 UI56 · original scanned import preview, cancellation and provenance", async ({ page, browser, installation, owner }, info) => {
  collabTest.setTimeout(900_000)
  page.setDefaultTimeout(20_000)
  expect(info.project.metadata.bundle).toBe("production")
  const diagnostics = observePage(page)
  const mutations: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.origin !== installation.origin || !url.pathname.startsWith(installation.mount + "/") || request.method() !== "POST") return
    const mode = url.searchParams.get("sf")
    if (mode && ["collaboration-thread-reply", "collaboration-relation-create", "collaboration-relation-remove",
      "collaboration-confirmation-confirm", "import-admit", "import-preview", "import-apply"].includes(mode))
      mutations.push(mode)
  })
  page.on("response", async (response) => {
    if (!new URL(response.url()).pathname.endsWith("/api/ui/context") || response.status() !== 200) return
    try {
      const context = await response.json()
      if (context.status !== "ok") return
      const reads = ["collaboration.relation-read", "collaboration.thread-read", "collaboration.confirmation-project"]
      console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "collaboration-route-source-health",
        operations: context.value.availability.flatMap((resource: { operations: Array<{ operationId: string }> }) =>
          resource.operations.filter((operation) => reads.includes(operation.operationId))) }))
    } catch { /* A navigation can close an already superseded response. */ }
  })
  for (const event of ["requestfinished", "requestfailed"] as const) page.on(event, (request) => {
    const selected = new URL(request.url()), mode = selected.searchParams.get("sf")
    if (selected.origin !== installation.origin || !mode?.startsWith("import-")) return
    console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "original-import-request", event, mode,
      method: request.method(), failure: request.failure()?.errorText ?? null }))
  })
  const sourceRequest = async (pathname: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    if (init?.method === "POST") headers.set("Origin", installation.origin)
    const response = await page.context().request.fetch(installation.origin + installation.mount + pathname, {
      method: init?.method ?? "GET", headers: Object.fromEntries(headers),
      ...(typeof init?.body === "string" ? { data: init.body } : {}), timeout: 40_000,
    })
    return new Response(new Uint8Array(await response.body()), { status: response.status(), headers: response.headers() })
  }
  const url = (pathname: string) => new URL(pathname, installation.origin).href
  await collabTest.step("UI55 opens a native source and file setup without admitting bytes", async () => {
    await enter(page, owner, url("/orchestra/sf-imports/new"), "Import file")
    const surface = page.locator('[data-sf-surface="UI55"]')
    await expect(surface).toHaveAttribute("data-sf-wave", "five")
    await expect(surface.getByRole("button", { name: "Generate preview", exact: true })).toBeDisabled()
    await looks(page, info, "UI55-setup")
    expect(mutations).toEqual([])
  })

  let manifestId = ""
  let sourceDigest = ""
  await collabTest.step("UI55 admits actual scanned XLSX bytes and previews an original Planner line without applying", async () => {
    await enter(page, owner, url("/orchestra/sf-imports/new"), "Import file")
    const surface = page.locator('[data-sf-surface="UI55"]')
    await surface.getByLabel("Period start", { exact: true }).fill(installation.year + "-01-01")
    await surface.getByLabel("Period end", { exact: true }).fill(installation.year + "-12-31")
    const targetsResponse = page.waitForResponse((response) => {
      const selected = new URL(response.url())
      return selected.origin === installation.origin && selected.searchParams.get("sf") === "import-targets" && response.request().method() === "GET"
    })
    await surface.getByRole("button", { name: "Find destinations", exact: true }).click()
    const response = await targetsResponse
    expect(response.status()).toBe(200)
    // Qualify the native options with a fresh authenticated original read.
    // Chromium may release observed response bytes; no target data is injected.
    const originalTargets = await page.context().request.get(response.url(), { maxRetries: 0, timeout: 40_000 })
    expect(originalTargets.status()).toBe(200)
    const targetResult = await originalTargets.json() as { status: string; value: Destination[] }
    expect(targetResult.status).toBe("ok")
    const targets = targetResult.value.filter((entry) => entry.label === waveThreeData.planner.version && entry.surface === "planner")
    expect(targets).toHaveLength(1)
    const target = targets[0]!
    expect(target.formats).toContain("xlsx")
    const destination = surface.getByRole("combobox", { name: "Destination", exact: true })
    await expect(destination.getByRole("option", { name: target.label, exact: true })).toHaveAttribute("value", target.selectionRef)
    await destination.selectOption(target.selectionRef)
    const versionParts = target.selectionRef.split(":")
    expect(versionParts[0]).toBe("planner-version")
    expect(versionParts).toHaveLength(4)
    const versionId = decodeURIComponent(versionParts[1]!)
    const gridResponse = await page.context().request.get(installation.origin + installation.mount +
      "/api/ui/pages/CAP18?" + new URLSearchParams({ year: String(installation.year), version: versionId }), { timeout: 40_000 })
    expect(gridResponse.status()).toBe(200)
    const original = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP18"].output)(await gridResponse.json())
    if (original.status !== "ok" || !original.value.data.grid) throw new Error("Original Planner grid unavailable")
    const rows = original.value.data.grid.rows.filter((entry) => entry.label === waveThreeData.planner.opex)
    expect(rows).toHaveLength(1)
    const sourceRow = rows[0]!
    const workbook = new Workbook()
    workbook.addWorksheet("OPEX").addRows([
      ["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Jan"],
      [sourceRow.id, "Licenses", sourceRow.label, "USD", "Forecast", 11200],
    ])
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer())
    sourceDigest = createHash("sha256").update(bytes).digest("hex")
    await surface.getByLabel("File", { exact: true }).setInputFiles({
      name: "design-test-data-source-review.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: bytes,
    })
    await surface.locator(".sf-files-options > summary").click()
    await expect(surface.getByLabel("Create a new Planner version", { exact: true })).not.toBeChecked()
    await expect(surface.getByLabel("Remove records missing from supplied sheets", { exact: true })).not.toBeChecked()
    await capture(page, info, "UI55-dark-desktop-selected-file-options")
    const [prepared] = await Promise.all([
      captureOriginalImportPreview(page, { origin: installation.origin, mount: installation.mount, sourceDigest,
        generate: surface.getByRole("button", { name: "Generate preview", exact: true }),
        observe: async (facts) => {
          const activity = await surface.getAttribute("data-sf-import-activity")
          const phase = await surface.getAttribute("data-sf-phase")
          const state = await surface.getAttribute("data-sf-read-state")
          console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({
            kind: "original-import-progress", ...facts, activity, phase, state,
          }))
        },
      }),
      expect(surface).toHaveAttribute("data-sf-phase", "reviewing", { timeout: 90_000 }),
    ])
    manifestId = prepared.manifest.id
    expect(manifestId).not.toBe("")
    // The fresh authenticated source read is independent of the delivered response.
    const originalPreview = await sourceRequest("/planner?" + new URLSearchParams({
      sf: "import-reference", importPreviewRef: manifestId,
    }))
    expect(originalPreview.status).toBe(200)
    expect(await originalPreview.json()).toMatchObject({ status: "ok",
      value: { manifest: { id: manifestId, domainApplied: false, state: "preview", sourceDigest } } })
    await expect(surface).toHaveAttribute("data-sf-phase", "reviewing")
    await expect(surface.locator(".sf-files-setup")).toBeHidden()
    await expect(surface.getByRole("heading", { name: "Simulation · no domain changes applied", exact: true })).toBeVisible()
    await capture(page, info, "UI55-dark-desktop-scanned-simulation")
    await surface.getByRole("region", { name: "Item and field changes", exact: true }).locator("summary").filter({ hasText: /^changed / }).click()
    await expect(surface.getByText("11200", { exact: false }).first()).toBeVisible()
    await capture(page, info, "UI55-dark-desktop-field-change")
    await surface.locator(".sf-files-preview-heading").getByRole("button", { name: "Cancel preview", exact: true }).click()
    await expect(surface.locator(".sf-files-setup")).toBeVisible()
    expect(await surface.getByLabel("File", { exact: true }).evaluate((element) =>
      element instanceof HTMLInputElement ? element.files?.[0]?.name : undefined)).toBe("design-test-data-source-review.xlsx")
    await expect(surface.getByRole("combobox", { name: "Destination", exact: true })).toHaveValue(target.selectionRef)
    await capture(page, info, "UI55-dark-desktop-cancel-retains-file")
    expect(mutations.filter((value) => value === "import-apply")).toHaveLength(0)
  })

  const previewPath = "/orchestra/sf-imports/" + encodeSfRouteRef(manifestId) + "/preview"
  await collabTest.step("UI56 reads the original preview and preserves its owner-bound review continuation", async () => {
    await enter(page, owner, url(previewPath), "Import preview")
    const surface = page.locator('[data-sf-surface="UI56"]')
    await expect(surface).toHaveAttribute("data-sf-wave", "five")
    await surface.getByRole("button", { name: "Refresh receipt", exact: true }).click()
    await expect(surface.getByRole("heading", { name: "Simulation · no domain changes applied", exact: true })).toBeVisible()
    const continuation = surface.getByRole("link", { name: "Review impact", exact: true })
    await expect(continuation).toHaveAttribute("href", new RegExp("/orchestra/sf-imports/" + encodeSfRouteRef(manifestId) + "/review\\?"))
    await looks(page, info, "UI56-preview")
    await surface.getByRole("region", { name: "Item and field changes", exact: true }).locator("summary").filter({ hasText: /^changed / }).click()
    await capture(page, info, "UI56-dark-desktop-field-provenance")
    const read = await sourceRequest("/planner?" + new URLSearchParams({ sf: "import-reference", importPreviewRef: manifestId }))
    expect(read.status).toBe(200)
    expect(await read.json()).toMatchObject({ status: "ok", value: { manifest: { id: manifestId, sourceDigest, domainApplied: false, state: "preview" } } })
    expect(mutations.filter((value) => value === "import-apply")).toHaveLength(0)
  })

  await collabTest.step("UI55 and UI56 have real pt-BR native captures", async () => {
    const cookies = await page.context().cookies()
    const portuguese = await browser.newContext({
      locale: "pt-BR", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
      reducedMotion: "reduce", colorScheme: "dark",
      httpCredentials: { username: "orchestra", password: installation.serverPassword },
      storageState: { cookies, origins: [{ origin: installation.origin,
        localStorage: [{ name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) }] }] },
    })
    try {
      const localized = await portuguese.newPage()
      const localDiagnostics = observePage(localized)
      for (const screen of [
        { id: "UI55", path: "/orchestra/sf-imports/new", title: "Importar arquivo" },
        { id: "UI56", path: previewPath, title: "Prévia da importação" },
      ]) {
        await enter(localized, owner, url(screen.path), screen.title)
        if (screen.id === "UI56") {
          await localized.locator('[data-sf-surface="UI56"]').getByRole("button", { name: /Refresh receipt|Atualizar recibo/, exact: true }).click()
          await expect(localized.locator('[data-sf-surface="UI56"] .sf-files-preview')).toBeVisible()
        }
        await scheme(localized, "dark")
        await capture(localized, info, screen.id + "-pt-BR-dark-desktop")
      }
      expect(localDiagnostics.pageErrors).toEqual([])
      expect(localDiagnostics.consoleErrors).toEqual([])
    } finally { await portuguese.close() }
  })

  expect(mutations.filter((value) => value === "import-admit")).toHaveLength(1)
  expect(mutations.filter((value) => value === "import-preview")).toHaveLength(1)
  expect(mutations.filter((value) => value === "import-apply")).toHaveLength(0)
  expect(diagnostics.pageErrors).toEqual([])
  expect(diagnostics.consoleErrors).toEqual([])
  await info.attach("wave-five-import-evidence", { body: JSON.stringify({
    areas: ["UI55", "UI56"], widths: [1440, 390], schemes: ["dark", "light"], locales: ["en-US", "pt-BR"], mutations,
    originalSource: "Original Planner row, live ClamD INSTREAM, original preview reference and byte digest",
    manifestId, sourceDigest, limitations: ["No import Apply invoked", "Upload acknowledgement body not inferred",
      "Actual browser zoom not measured", "No golden-image approval is inferred"], ...diagnostics,
  }, null, 2), contentType: "application/json" })
})

waveFourTest("UI51 UI52 UI53 · original relationships, unsent discussion and material confirmation", async ({ page, browser, installation, owner }, info) => {
  waveFourTest.setTimeout(600_000)
  page.setDefaultTimeout(20_000)
  expect(info.project.metadata.bundle).toBe("production")
  const diagnostics = observePage(page)
  const mutations: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.origin !== installation.origin || !url.pathname.startsWith(installation.mount + "/") || request.method() !== "POST") return
    const mode = url.searchParams.get("sf")
    if (mode && ["collaboration-thread-reply", "collaboration-relation-create", "collaboration-relation-remove",
      "collaboration-confirmation-confirm", "import-admit", "import-preview", "import-apply"].includes(mode))
      mutations.push(mode)
  })
  page.on("response", async (response) => {
    if (!new URL(response.url()).pathname.endsWith("/api/ui/context") || response.status() !== 200) return
    try {
      const context = await response.json()
      if (context.status !== "ok") return
      const reads = ["collaboration.relation-read", "collaboration.thread-read", "collaboration.confirmation-project"]
      console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "collaboration-route-source-health",
        operations: context.value.availability.flatMap((resource: { operations: Array<{ operationId: string }> }) =>
          resource.operations.filter((operation) => reads.includes(operation.operationId))) }))
    } catch { /* A navigation can close an already superseded response. */ }
  })
  const sourceRequest = async (pathname: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    if (init?.method === "POST") headers.set("Origin", installation.origin)
    const response = await page.context().request.fetch(installation.origin + installation.mount + pathname, {
      method: init?.method ?? "GET", headers: Object.fromEntries(headers),
      ...(typeof init?.body === "string" ? { data: init.body } : {}), timeout: 40_000,
    })
    return new Response(new Uint8Array(await response.body()), { status: response.status(), headers: response.headers() })
  }
  const url = (pathname: string) => new URL(pathname, installation.origin).href
  const mode = (operation: string) => (response: { url(): string; request(): { method(): string } }) => {
    const selected = new URL(response.url())
    return selected.origin === installation.origin && selected.pathname.startsWith(installation.mount + "/") &&
      selected.searchParams.get("sf") === operation && response.request().method() === "POST"
  }

  const seeded = await seedWaveFiveCollab({ actorId: installation.actorId, request: sourceRequest }, installation.year)
  const relationshipPath = "/orchestra/sf-work/relations/" + encodeSfRouteRef(seeded.relation.id)
  const threadPath = "/orchestra/sf-work/threads/" + encodeSfRouteRef(seeded.thread.id)

  await waveFourTest.step("UI51 reads a producer relationship and preserves explicit evidence through review cancellation", async () => {
    await enter(page, owner, url(relationshipPath), "Record relationships")
    const surface = page.locator('[data-sf-surface="UI51"]')
    await expect(surface).toHaveAttribute("data-sf-wave", "five")
    await expect(surface.locator("[data-sf-relations-source]")).toHaveValue(seeded.relation.fromRef)
    await expect(surface.locator(".sf-collab-pair")).toContainText(seeded.relation.toRef)
    await expect(surface.locator(".sf-collab-kind")).toHaveText("Observed relationship type: " + seeded.relation.kind)
    await looks(page, info, "UI51-relationship")

    await surface.getByRole("button", { name: "Remove relationship", exact: true }).click()
    const removal = surface.locator("[data-sf-relation-remove-review]")
    await expect(removal).toBeVisible()
    await expect(surface.locator(".sf-u44-relation-workspace")).toBeHidden()
    await capture(page, info, "UI51-dark-desktop-removal-review")
    await removal.getByRole("button", { name: "Keep editing", exact: true }).click()
    await expect(removal).toHaveCount(0)
    const removeButton = surface.getByRole("button", { name: "Remove relationship", exact: true })
    await expect(removeButton).toBeEnabled()
    await expect(removeButton).toBeFocused()
    await removeButton.click()
    await expect(removal).toBeVisible()
    await removal.getByRole("button", { name: "Keep editing", exact: true }).click()
    await expect(removeButton).toBeEnabled()
    expect(mutations.filter((value) => value === "collaboration-relation-remove")).toHaveLength(0)

    await enter(page, owner, url("/orchestra/sf-work/relations/new"), "Record relationships")
    await surface.locator("[data-sf-relations-source]").fill(seeded.relation.fromRef)
    await surface.getByRole("button", { name: "Read relationships", exact: true }).click()
    const editor = surface.locator(".sf-u44-relation-create")
    await expect(editor).toBeVisible()
    await surface.locator("[data-sf-relations-target]").fill(seeded.relation.toRef)
    await surface.locator("[data-sf-relations-kind]").fill(seeded.relation.kind)
    const evidence = JSON.stringify(seeded.relation.evidenceRefs, null, 2)
    await surface.locator("[data-sf-relations-evidence]").fill(evidence)
    await capture(page, info, "UI51-dark-desktop-explicit-editor")
    await editor.getByRole("button", { name: "Review relationship", exact: true }).click()
    const review = surface.locator("[data-sf-relation-review]")
    await expect(review).toBeVisible()
    await expect(review.getByText("Observed relationship type: " + seeded.relation.kind, { exact: true })).toBeVisible()
    await expect(surface.locator(".sf-u44-relation-workspace")).toBeHidden()
    await capture(page, info, "UI51-dark-desktop-create-review")
    await review.getByRole("button", { name: "Keep editing", exact: true }).click()
    await expect(surface.locator("[data-sf-relations-target]")).toBeFocused()
    await expect(surface.locator("[data-sf-relations-target]")).toHaveValue(seeded.relation.toRef)
    await expect(surface.locator("[data-sf-relations-evidence]")).toHaveValue(evidence)
    await editor.getByRole("button", { name: "Back to relationships", exact: true }).click()
    await expect(editor).toBeHidden()
    await surface.locator(".sf-u44-toolbar").getByRole("button", { name: "Link record", exact: true }).click()
    await expect(surface.locator("[data-sf-relations-evidence]")).toHaveValue(evidence)
    expect(mutations.filter((value) => value === "collaboration-relation-create")).toHaveLength(0)

    await enter(page, owner, url("/orchestra/sf-decisions/" + encodeSfRouteRef(seeded.caseRef) + "/relations"), "Record relationships")
    await expect(surface.locator("[data-sf-relations-source]")).toHaveValue(seeded.caseRef)
    await surface.getByRole("button", { name: "Read relationships", exact: true }).click()
    await expect(surface.locator('.sf-state-panel[data-sf-state="empty"]').first()).toBeVisible()
    await capture(page, info, "UI51-dark-desktop-case-alias-empty")
  })

  await waveFourTest.step("UI52 reads an original internal thread, exposes provenance and retains an unsent draft", async () => {
    await enter(page, owner, url(threadPath), "Discussion")
    const surface = page.locator('[data-sf-surface="UI52"]')
    await expect(surface).toHaveAttribute("data-sf-wave", "five")
    await expect(surface.getByText(waveFiveCollabData.comment, { exact: true })).toBeVisible()
    await looks(page, info, "UI52-discussion")
    await surface.getByRole("textbox", { name: "Comment", exact: true }).fill(waveFiveCollabData.draft)
    await surface.getByRole("button", { name: "Open originating record", exact: true }).click()
    await expect(surface.locator("[data-sf-thread-origin]")).toBeVisible()
    await expect(surface.locator("[data-sf-thread-origin]")).toContainText(seeded.thread.sourceRef)
    await expect(surface.getByRole("textbox", { name: "Comment", exact: true })).toHaveValue(waveFiveCollabData.draft)
    await capture(page, info, "UI52-dark-desktop-origin-unsent-draft")
    await page.setViewportSize({ width: 390, height: 1100 })
    await reflow(page)
    await capture(page, info, "UI52-dark-390-unsent-draft")
    await page.setViewportSize({ width: 1440, height: 1100 })
    expect(mutations.filter((value) => value === "collaboration-thread-reply")).toHaveLength(0)
  })

  const freshlyPrepared = Schema.decodeUnknownSync(SfCollaboration.operations["collaboration.confirmation-prepare"].output)(
    await seeded.post("collaboration-confirmation-prepare", { scope: seeded.scope }),
  )
  if (freshlyPrepared.status !== "ok" || !freshlyPrepared.value.selectionRef)
    throw new Error("The original current material could not be refreshed")
  const directSelection = await sourceRequest("/dashboard?sf=collaboration-confirmation-project", {
    method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
    body: JSON.stringify({ selectionRef: freshlyPrepared.value.selectionRef }),
  })
  const directSelectionBody = await directSelection.json()
  console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "confirmation-prepare-project",
    httpStatus: directSelection.status, status: directSelectionBody.status,
    reason: typeof directSelectionBody.reason === "string" ? directSelectionBody.reason : undefined,
    preparedSourceVersion: freshlyPrepared.value.sourceVersion,
  }))
  let confirmationId = ""
  await waveFourTest.step("UI53 reviews exact current material, cancels review and records one no-change confirmation", async () => {
    await enter(page, owner, url("/orchestra/sf-work/confirmations/" + encodeSfRouteRef(freshlyPrepared.value.selectionRef!)), "Confirm no change")
    const surface = page.locator('[data-sf-surface="UI53"]')
    await expect(surface).toHaveAttribute("data-sf-wave", "five")
    await expect(surface.locator("[data-sf-confirm-material]")).toBeVisible()
    await looks(page, info, "UI53-material")
    await surface.getByRole("button", { name: "Review confirmation", exact: true }).click()
    const review = surface.locator(".sf-u44-confirmation-review")
    await expect(review).toBeVisible()
    await expect(surface.locator(".sf-u44-material-content")).toBeHidden()
    await capture(page, info, "UI53-dark-desktop-confirmation-review")
    await review.getByRole("button", { name: "Back to material", exact: true }).click()
    await expect(surface.locator(".sf-u44-material-content")).toBeVisible()
    await surface.getByRole("button", { name: "Review confirmation", exact: true }).click()
    const confirm = review.getByRole("button", { name: "Confirm no change", exact: true })
    await expect(confirm).toBeEnabled()
    const received = page.waitForResponse(mode("collaboration-confirmation-confirm"))
    await confirm.click()
    const response = await received
    expect(response.status()).toBe(200)
    const record = Schema.decodeUnknownSync(SfCollaboration.operations["collaboration.confirmation-confirm"].output)(await response.json())
    if (record.status !== "ok") throw new Error("Original no-change confirmation was not recorded")
    confirmationId = record.value.id
    await expect(surface.locator("[data-sf-confirm-receipt]")).toBeVisible()
    await expect(surface.locator("[data-sf-confirm-receipt]")).toContainText("Valid for the current source")
    await capture(page, info, "UI53-dark-desktop-original-receipt")
    expect(mutations.filter((value) => value === "collaboration-confirmation-confirm")).toHaveLength(1)
    await enter(page, owner, url("/orchestra/sf-work/confirmations/" + encodeSfRouteRef(confirmationId)), "Confirm no change")
    await expect(surface.locator("[data-sf-confirm-record-project]")).toContainText("Valid for the current source")
    await capture(page, info, "UI53-dark-desktop-recorded-validity")
  })

  await waveFourTest.step("UI51, UI52 and UI53 have real pt-BR native captures", async () => {
    const cookies = await page.context().cookies()
    const portuguese = await browser.newContext({
      locale: "pt-BR", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
      reducedMotion: "reduce", colorScheme: "dark",
      httpCredentials: { username: "orchestra", password: installation.serverPassword },
      storageState: { cookies, origins: [{ origin: installation.origin,
        localStorage: [{ name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) }] }] },
    })
    try {
      const localized = await portuguese.newPage()
      const localDiagnostics = observePage(localized)
      for (const screen of [
        { id: "UI51", path: relationshipPath, title: "Relações entre registros" },
        { id: "UI52", path: threadPath, title: "Discussão" },
        { id: "UI53", path: "/orchestra/sf-work/confirmations/" + encodeSfRouteRef(confirmationId), title: "Confirmar sem alteração" },
      ]) {
        await enter(localized, owner, url(screen.path), screen.title)
        await scheme(localized, "dark")
        if (screen.id === "UI51") await expect(localized.locator(".sf-collab-kind")).toHaveText("Tipo de relação observado: " + seeded.relation.kind)
        await capture(localized, info, screen.id + "-pt-BR-dark-desktop")
      }
      expect(localDiagnostics.pageErrors).toEqual([])
      expect(localDiagnostics.consoleErrors).toEqual([])
    } finally { await portuguese.close() }
  })

  expect(mutations.filter((value) => value === "collaboration-thread-reply")).toHaveLength(0)
  expect(mutations.filter((value) => value === "collaboration-confirmation-confirm")).toHaveLength(1)
  expect(diagnostics.pageErrors).toEqual([])
  expect(diagnostics.consoleErrors).toEqual([])
  await info.attach("wave-five-collaboration-evidence", { body: JSON.stringify({
    areas: ["UI51", "UI52", "UI53"], widths: [1440, 390], schemes: ["dark", "light"], locales: ["en-US", "pt-BR"], mutations,
    originalSources: ["Handoff relationship and authorized record evidence", "Internal unaddressed comment thread",
      "Dashboard material and original no-change confirmation receipt"],
    limitations: ["Reply remains an unsent draft", "No relationship create/remove submitted",
      "Actual browser zoom not measured", "No golden-image approval is inferred"], ...diagnostics,
  }, null, 2), contentType: "application/json" })
})

async function looks(page: Page, info: TestInfo, name: string) {
  await scheme(page, "dark")
  await scrollPageTop(page)
  await capture(page, info, name + "-dark-desktop")
  await scheme(page, "light")
  await capture(page, info, name + "-light-desktop")
  await page.setViewportSize({ width: 390, height: 1100 })
  await reflow(page)
  await scrollPageTop(page)
  await capture(page, info, name + "-light-390")
  await page.setViewportSize({ width: 1440, height: 1100 })
  await scheme(page, "dark")
  await page.setViewportSize({ width: 390, height: 1100 })
  await reflow(page)
  await scrollPageTop(page)
  await capture(page, info, name + "-dark-390")
  await page.setViewportSize({ width: 1440, height: 1100 })
  await reflow(page)
}
