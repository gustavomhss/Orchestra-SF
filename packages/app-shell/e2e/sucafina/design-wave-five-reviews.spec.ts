import { expect, type Page, type Request, type TestInfo } from "@playwright/test"
import { Schema } from "effect"
import { SfReviewDomainProjection, SfReviewPreserved } from "@orchestra/schema/sucafina/reviews"
import { preservedValueRows, readPreservedProjection } from "../../src/orchestra/chapters/sucafina/reviews/preserved/model"
import { seedWaveFiveReviewProposal } from "./design-support/wave-five-reviews-seed"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { waveFourTest, enter, observePage, scheme, reflow, capture, scrollPageTop } from "./design-support/wave-four"

type Owner = Parameters<typeof enter>[1]
type Screen = { id: string; href: string; title: string; titleBr: string; state: string }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Original response object required")
  return value as Record<string, unknown>
}
function monitor(page: Page) {
  const reads: { operation: string; status: number; sourceStatus: unknown; reason: unknown }[] = []
  page.on("response", (response) => {
    const url = new URL(response.url())
    const mode = url.searchParams.get("sf")
    if (!mode && !url.pathname.includes("/api/ui/projections/review")) return
    if (!/review|agenda|workbench|hot-topic/.test(mode ?? url.pathname)) return
    void response.json().then((data: unknown) => {
      const body = object(data)
      const entry = { operation: mode ?? "projection.review", status: response.status(),
        sourceStatus: typeof body.status === "string" ? body.status : null,
        reason: typeof body.reason === "string" ? body.reason : null }
      reads.push(entry)
      console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "wave-five-review-source", ...entry }))
    }).catch(() => undefined)
  })
  return reads
}
function guardExternalWrites(page: Page, writes: Request[] = []) {
  page.on("request", (request) => {
    const mode = new URL(request.url()).searchParams.get("sf") ?? ""
    if (request.method() === "POST" &&
      /collaboration|notify|send|review-report|report-prepare|hot-topic-prepare|hot-topic-apply/.test(mode))
      writes.push(request)
  })
  return writes
}
async function captureValues(page: Page, info: TestInfo, name: string, presenting: boolean) {
  const selector = presenting ? ".sf-review-meeting-values > div" : "[data-sf-review-sequence] .sf-n28-values > div"
  await page.locator(selector).first().scrollIntoViewIfNeeded()
  await capture(page, info, name)
}
async function screen(page: Page, owner: Owner, selected: Screen, br = false) {
  await enter(page, owner, selected.href, br ? selected.titleBr : selected.title, 40_000)
  const root = page.locator('[data-sf-surface="' + selected.id + '"]')
  await expect(root).toHaveAttribute("data-sf-wave", "five")
  await expect(root).toBeVisible()
  await expect(root.locator(".sf-state-panel").first()).toHaveAttribute("data-sf-state", selected.state, { timeout: 40_000 })
  expect((await root.boundingBox())?.width).toBeLessThanOrEqual(1160)
  await reflow(page)
}
async function selectAgenda(page: Page, owner: Owner, origin: string, year: number, br = false) {
  await enter(page, owner, origin + "/orchestra/sf-reviews/agenda?year=" + year,
    br ? "Pauta da reunião" : "Meeting agenda")
  const root = page.locator('[data-sf-surface="UI47"]')
  await expect(root).toHaveAttribute("data-sf-wave", "five")
  for (const source of ["Budget Overview"]) {
    await root.getByLabel(br ? "Página de origem do dashboard" : "Source dashboard page", { exact: true }).fill(source)
    await root.getByRole("button", { name: br ? "Buscar seções autorizadas" : "Find authorized sections", exact: true }).click()
    await expect(root.locator(".sf-state-panel").first()).toHaveAttribute("data-sf-state", "ready", { timeout: 40_000 })
    const add = root.getByRole("button", { name: br ? "Adicionar à pauta" : "Add to agenda", exact: true })
    expect(await add.count()).toBeGreaterThan(0)
    await add.first().click()
  }
  await expect(root.locator("[data-sf-agenda-order] > li")).toHaveCount(1)
  return root
}
async function preserve(page: Page) {
  await page.getByRole("button", { name: "Review selected sections", exact: true }).click()
  const preview = page.locator("[data-sf-agenda-preview]")
  await expect(preview).toBeVisible({ timeout: 40_000 })
  await expect(preview.locator("ol > li")).toHaveCount(1)
  await preview.getByRole("button", { name: "Confirm preservation", exact: true }).click()
  const confirmed = page.locator("[data-sf-preserved-confirmed]")
  await expect(confirmed).toBeVisible({ timeout: 40_000 })
  const reference = (await confirmed.locator("dd").first().innerText()).trim()
  expect(reference).not.toBe("")
  return reference
}

waveFourTest("wave five proposals: original draft and missing-source boundaries", async ({ page, browser, installation, owner }, info) => {
  waveFourTest.setTimeout(420_000)
  page.setDefaultTimeout(15_000)
  expect(info.project.metadata.bundle).toBe("production")
  expect(info.config.workers).toBe(1)
  const diagnostics = observePage(page)
  const reads = monitor(page)
  const externalWrites = guardExternalWrites(page)
  const draft = await seedWaveFiveReviewProposal(page.request, installation)
  const proposal: Screen = { id: "UI54",
    href: installation.origin + "/orchestra/sf-dashboard/hot-topics/proposals/" + encodeSfRouteRef(draft.draftRef),
    title: "Follow-up proposal", titleBr: "Proposta de encaminhamento", state: "ready" }
  await page.setViewportSize({ width: 1440, height: 1100 })
  await screen(page, owner, proposal)
  await expect(page.locator('[data-sf-surface="UI54"]')).toContainText(draft.action)
  await expect(page.locator('[data-component="sf-change-review"]')).toHaveCount(0)
  await capture(page, info, "UI54-dark-desktop-original-draft-test-data")
  await scheme(page, "light")
  await capture(page, info, "UI54-light-desktop-original-draft-test-data")
  await scheme(page, "dark")
  await page.setViewportSize({ width: 320, height: 800 })
  await reflow(page)
  await capture(page, info, "UI54-dark-320-original-draft-test-data")
  // Missing selector is a real negative source read, never a synthetic proposal success.
  await screen(page, owner, { ...proposal, href: installation.origin +
    "/orchestra/sf-dashboard/hot-topics/proposals/" + encodeSfRouteRef("design-test-missing-proposal"), state: "not-found" })
  await capture(page, info, "UI54-dark-320-missing-source-test-data")


  const cookies = await page.context().cookies(installation.origin + installation.mount)
  const portuguese = await browser.newContext({
    locale: "pt-BR", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
    reducedMotion: "reduce", colorScheme: "dark",
    httpCredentials: { username: "orchestra", password: installation.serverPassword },
    storageState: { cookies, origins: [{ origin: installation.origin,
      localStorage: [{ name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) }] }] },
  })
  try {
    const localized = await portuguese.newPage()
    const localizedDiagnostics = observePage(localized)
    guardExternalWrites(localized, externalWrites)
    await screen(localized, owner, proposal, true)
    await capture(localized, info, "UI54-pt-BR-dark-desktop-original-draft-test-data")
    expect(localizedDiagnostics.pageErrors).toEqual([])
  } finally { await portuguese.close() }
  expect(externalWrites).toHaveLength(0)
  expect(diagnostics.pageErrors).toEqual([])
  await info.attach("wave-five-proposals-source-manifest", { contentType: "application/json", body: JSON.stringify({
    surfaces: ["UI54"], proposalDraftRef: draft.draftRef, reads,
    originalFixture: "Independent test-scoped installation; source draft created through original registered producers.",
    limitations: ["No recorded current choice; preparation, apply and receipt remain unavailable.",
      "No proposal applied; no collaboration or notification sent.",
      "Narrow reflow is not actual browser zoom."],
  }, null, 2) })
})

waveFourTest("wave five reviews: original agenda, preserved sources, comparison and report selection", async ({ page, browser, installation, owner }, info) => {
  waveFourTest.setTimeout(720_000)
  page.setDefaultTimeout(15_000)
  expect(info.project.metadata.bundle).toBe("production")
  expect(info.config.workers).toBe(1)
  const diagnostics = observePage(page)
  const reads = monitor(page)
  const externalWrites = guardExternalWrites(page)
  const base = installation.origin + "/orchestra/sf-reviews/"
  await enter(page, owner, base + "agenda?year=" + installation.year, "Meeting agenda")
  await expect(page.locator('[data-sf-surface="UI47"] .sf-state-panel')).toHaveAttribute("data-sf-state", "empty")
  await capture(page, info, "UI47-dark-desktop-initial-selection-test-data")

  const agenda = await selectAgenda(page, owner, installation.origin, installation.year)
  // The original discovery emits one dashboard section identity across pages.
  // Preserve that identity and prove that a one-section agenda cannot be reordered.
  await expect(agenda.locator("[data-sf-agenda-order] > li").first().getByRole("button", { name: /^Move up:/ })).toBeDisabled()
  await expect(agenda.locator("[data-sf-agenda-order] > li").first().getByRole("button", { name: /^Move down:/ })).toBeDisabled()
  await capture(page, info, "UI47-dark-desktop-ordered-sections-test-data")
  await page.getByRole("button", { name: "Review selected sections", exact: true }).click()
  await expect(page.locator("[data-sf-agenda-preview]")).toBeVisible({ timeout: 40_000 })
  await capture(page, info, "UI47-dark-desktop-preservation-review-test-data")
  await page.setViewportSize({ width: 390, height: 844 })
  await reflow(page)
  await page.getByRole("button", { name: "Confirm preservation", exact: true }).scrollIntoViewIfNeeded()
  await capture(page, info, "UI47-dark-390-preservation-review-test-data")
  await page.getByRole("button", { name: "Revise agenda", exact: true }).click()
  await expect(page.locator("[data-sf-agenda-order] > li")).toHaveCount(1)
  await page.setViewportSize({ width: 1440, height: 1100 })
  const first = await preserve(page)
  await capture(page, info, "UI47-dark-desktop-producer-confirmed-test-data")
  const sourceRead = await page.request.get(installation.origin + installation.mount + "/dashboard",
    { params: { sf: "dashboard-review", id: first } })
  expect(sourceRead.status()).toBe(200)
  const sourceBody = object(await sourceRead.json())
  expect(sourceBody.status).toBe("ok")
  const originalReview = Schema.decodeUnknownSync(SfReviewPreserved)(sourceBody.value)
  const originalSections = originalReview.sections
  if (!Array.isArray(originalSections)) throw new Error("Original preserved sections required")
  const originalContent = object(object(originalSections[0]).content)
  const sourceShape = { contentKeys: Object.keys(originalContent),
    contextKeys: Object.keys(object(originalContent.context)),
    valueKeys: Array.isArray(originalContent.values) ? Object.keys(object(originalContent.values[0])) : [],
    componentKeys: Array.isArray(originalContent.components) && originalContent.components.length
      ? Object.keys(object(originalContent.components[0])) : [] }
  console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "wave-five-original-projection-shape", ...sourceShape }))
  await info.attach("original-preserved-source-test-data", { contentType: "application/json",
    body: JSON.stringify(sourceBody, null, 2) })
  try { Schema.decodeUnknownSync(SfReviewDomainProjection)(originalContent) } catch (error) {
    console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "wave-five-original-projection-decode",
      error: String(error).replace(/[a-f0-9]{64}/g, "[redacted]").slice(0, 7000) }))
    throw error
  }
  const decoded = readPreservedProjection(originalContent)
  if (!decoded) throw new Error("Original preserved projection must decode without fabricated fields")
  expect(decoded.values.length).toBeGreaterThan(0)
  const corruptions: ((content: Record<string, unknown>) => void)[] = [
    (content) => { delete content.context },
    (content) => { object(content.context).capabilities = undefined },
    (content) => { object(object(content.context).period).unexpected = "not an original period field" },
    (content) => { const values = content.values as unknown[]; object(values[0]).value = Number.NaN },
    (content) => { const values = content.values as unknown[]; object(values[0]).granularity = "invented" },
  ]
  for (const corrupt of corruptions) {
    const invalid = structuredClone(originalContent)
    corrupt(invalid)
    expect(readPreservedProjection(invalid)).toBeUndefined()
  }
  await page.locator("[data-sf-preserved-confirmed]").getByRole("button", { name: "Open preserved review", exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === "/orchestra/sf-reviews/reviews/" + encodeSfRouteRef(first))
  const renderedValues = page.locator('[data-sf-review-sequence] .sf-n28-values > div')
  await expect(renderedValues).toHaveCount(decoded.values.length)
  await expect(renderedValues.locator("[data-sf-preserved-scalar]")).toHaveText(decoded.values.map((value) =>
    value.value === null ? "Explicit null value" : String(value.value)))
  await expect(renderedValues.locator('[data-sf-evidence-state="confirmed"]')).toHaveText(
    decoded.values.filter((value) => value.evidenceState === "confirmed").map(() => "Confirmed"))
  await selectAgenda(page, owner, installation.origin, installation.year)
  const second = await preserve(page)
  expect(first).not.toBe(second)
  const secondRead = await page.request.get(installation.origin + installation.mount + "/dashboard",
    { params: { sf: "dashboard-review", id: second } })
  expect(secondRead.status()).toBe(200)
  const secondBody = object(await secondRead.json())
  expect(secondBody.status).toBe("ok")
  const secondReview = Schema.decodeUnknownSync(SfReviewPreserved)(secondBody.value)
  const comparisonRows = originalReview.sections.flatMap((before) => {
    const after = secondReview.sections.find((section) => section.id === before.id)
    return after ? preservedValueRows(before, after) : []
  })

  const entries: Screen[] = [
    { id: "UI48", href: base + "reviews", title: "Preserved review", titleBr: "Revisão preservada", state: "unavailable" },
    { id: "UI48", href: base + "reviews/" + encodeSfRouteRef(first), title: "Preserved review", titleBr: "Revisão preservada", state: "ready" },
    { id: "UI48", href: base + "reviews/" + encodeSfRouteRef(first) + "/present", title: "Preserved review", titleBr: "Revisão preservada", state: "ready" },
    { id: "UI49", href: base + "compare?previousReview=" + encodeURIComponent(first) + "&currentReview=" + encodeURIComponent(second), title: "Compare reviews", titleBr: "Comparar revisões", state: "ready" },
    { id: "UI50", href: base + "reports", title: "Report", titleBr: "Relatório", state: "unavailable" },
    { id: "UI50", href: base + "reports/" + encodeSfRouteRef(first), title: "Report", titleBr: "Relatório", state: "ready" },
  ]
  const names = ["UI48-list-unavailable", "UI48-detail", "UI48-present", "UI49-compare", "UI50-list-unavailable", "UI50-selection"]
  for (const color of ["dark", "light"] as const) {
    await selectAgenda(page, owner, installation.origin, installation.year)
    await scheme(page, color)
    await scrollPageTop(page)
    await capture(page, info, "UI47-" + color + "-desktop-sections-test-data")
    for (const [index, entry] of entries.entries()) {
      await screen(page, owner, entry)
      await scheme(page, color)
      if (entry.id === "UI49") {
        await page.locator(".sf-review-compare-form").getByRole("button", { name: "Read and compare authorized reviews", exact: true }).click()
        await expect(page.locator("[data-sf-comparison-compatibility]")).toHaveAttribute("data-sf-comparison-compatibility", "compatible", { timeout: 40_000 })
        await expect(page.getByText("Section order changed between preserved revisions.", { exact: true })).toHaveCount(0)
        await expect(page.locator('[data-change-numeric="true"]')).toHaveCount(0)
        const renderedRows = page.locator("tr[data-sf-value-id]")
        await expect(renderedRows).toHaveCount(comparisonRows.length)
        for (const [rowIndex, expected] of comparisonRows.entries()) {
          const row = renderedRows.nth(rowIndex)
          await expect(row).toHaveAttribute("data-sf-value-id", expected.id)
          await expect(row.locator("[data-sf-preserved-scalar]")).toHaveText(
            [expected.before, expected.after].flatMap((entry) => entry
              ? [entry.value === null ? "Explicit null value" : String(entry.value)] : []))
        }
      }
      if (index === 2) {
        await expect(page.locator(".sf-review-presentation")).toBeVisible()
        await expect(page.locator("[data-sf-review-sequence]")).toBeHidden()
        await expect(page.getByRole("button", { name: "Next topic", exact: true })).toBeDisabled()
        await expect(page.getByRole("button", { name: "Previous topic", exact: true })).toBeDisabled()
        if (color === "dark") {
          const updateResponse = page.waitForResponse((response) =>
            new URL(response.url()).searchParams.get("sf") === "review-update")
          await page.getByRole("button", { name: "Check for updates", exact: true }).click()
          const updateRead = await updateResponse
          expect(updateRead.status()).toBe(409)
          expect(await updateRead.json()).toMatchObject({ status: "stale", reason: "review-read-changed" })
          await expect(page.getByRole("alert").filter({ hasText:
            "The original sources changed or could not be revalidated. Read them again." })).toBeVisible()
        }
      }
      await scrollPageTop(page)
      await capture(page, info, names[index] + "-" + color + "-desktop-test-data")
      if (index === 1 || index === 2) await captureValues(page, info, names[index] + "-values-" + color + "-desktop-test-data", index === 2)
    }
  }
  await scheme(page, "dark")
  await screen(page, owner, entries[1]!)
  const unsent = "Design test data · Keep this unsent question while presenting."
  await page.getByLabel("Question", { exact: true }).fill(unsent)
  await page.getByRole("button", { name: "Present review", exact: true }).click()
  await expect(page.locator(".sf-review-discussion")).toBeHidden()
  await expect(page.locator(".sf-review-presentation")).toBeVisible()
  await page.getByRole("button", { name: "Exit presentation", exact: true }).click()
  await expect(page.getByLabel("Question", { exact: true })).toHaveValue(unsent)
  await page.getByLabel("Question", { exact: true }).scrollIntoViewIfNeeded()
  await capture(page, info, "UI48-dark-desktop-unsent-draft-retained-test-data")
  await screen(page, owner, entries[5]!)
  const selected = page.locator('[data-sf-surface="UI50"] [data-section-id] input[type="checkbox"]')
  await expect(selected).toHaveCount(1)
  await selected.first().uncheck()
  await expect(selected.first()).not.toBeChecked()
  await expect(page.getByRole("button", { name: "Generate report", exact: true })).toBeDisabled()
  await selected.first().check()
  await page.getByLabel("Office format", { exact: true }).selectOption("pptx")
  await expect(page.getByLabel("Office format", { exact: true })).toHaveValue("pptx")
  await capture(page, info, "UI50-dark-desktop-one-section-pptx-test-data")

  await scheme(page, "dark")
  await page.setViewportSize({ width: 390, height: 844 })
  await selectAgenda(page, owner, installation.origin, installation.year)
  await capture(page, info, "UI47-dark-390-sections-test-data")
  for (const [index, entry] of entries.entries()) {
    if (index === 0 || index === 4) continue
    await screen(page, owner, entry)
    if (entry.id === "UI49") {
      await page.locator(".sf-review-compare-form").getByRole("button", { name: "Read and compare authorized reviews", exact: true }).click()
      await expect(page.locator("[data-sf-comparison-compatibility]")).toBeVisible({ timeout: 40_000 })
    }
    await capture(page, info, names[index] + "-dark-390-test-data")
    if (index === 1 || index === 2) await captureValues(page, info, names[index] + "-values-dark-390-test-data", index === 2)
  }

  const cookies = await page.context().cookies(installation.origin + installation.mount)
  const portuguese = await browser.newContext({
    locale: "pt-BR", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
    reducedMotion: "reduce", colorScheme: "dark",
    httpCredentials: { username: "orchestra", password: installation.serverPassword },
    storageState: { cookies, origins: [{ origin: installation.origin,
      localStorage: [{ name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) }] }] },
  })
  try {
    const localized = await portuguese.newPage()
    const localizedDiagnostics = observePage(localized)
    guardExternalWrites(localized, externalWrites)
    await selectAgenda(localized, owner, installation.origin, installation.year, true)
    await capture(localized, info, "UI47-pt-BR-dark-desktop-test-data")
    for (const [index, entry] of entries.entries()) {
      if (index === 0 || index === 4) continue
      await screen(localized, owner, entry, true)
      if (entry.id === "UI49") {
        await localized.locator(".sf-review-compare-form").getByRole("button", { name: "Ler e comparar revisões autorizadas", exact: true }).click()
        await expect(localized.locator("[data-sf-comparison-compatibility]")).toBeVisible({ timeout: 40_000 })
      }
      await capture(localized, info, names[index] + "-pt-BR-dark-desktop-test-data")
      if (index === 1 || index === 2) await captureValues(localized, info, names[index] + "-values-pt-BR-dark-desktop-test-data", index === 2)
    }
    expect(localizedDiagnostics.pageErrors).toEqual([])
  } finally { await portuguese.close() }
  expect(externalWrites).toHaveLength(0)
  expect(diagnostics.pageErrors).toEqual([])
  await info.attach("wave-five-reviews-source-manifest", { contentType: "application/json", body: JSON.stringify({
    surfaces: ["UI47", "UI48", "UI49", "UI50"],
    producerPreservations: 2, originalReviewRefs: [first, second],
    originalComparisonValueRows: comparisonRows.length, reads,
    limitations: ["No authorized review-list or report-list operation exists.",
      "The producer emits one shared dashboard section identity; multiple native agenda sections and reordering cannot be exercised without changing it.",
      "No report generated or published; no collaboration or notification sent.",
      "Narrow reflow is not actual browser zoom."],
  }, null, 2) })
})
