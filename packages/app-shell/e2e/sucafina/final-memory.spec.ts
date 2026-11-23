import { expect } from "@playwright/test"
import type { Page, Request } from "@playwright/test"
import { waveFourTest, enter, ready, scheme, reflow, reviewActions, scrollPageTop, observePage } from "./design-support/wave-four"
import { captureFinalSurface } from "./design-support/final-capture"
import { finalMemoryData, seedFinalMemory } from "./design-support/final-memory-seed"
import { withFinalMemoryPortuguese } from "./design-support/final-memory-browser"
import { waveFourDecisionsData } from "./design-support/wave-four-decisions-data"

waveFourTest.use({ designWave: "four-decisions" })
waveFourTest.beforeEach(async ({ page }, info) => {
  waveFourTest.setTimeout(300_000)
  page.setDefaultTimeout(15_000)
  expect(info.project.metadata.bundle).toBe("production")
})

function summaryMutation(request: Request) {
  if (request.method() !== "POST") return false
  try {
    const body: unknown = request.postDataJSON()
    return !!body && typeof body === "object" && "pages" in body && Array.isArray(body.pages) &&
      "version" in body && typeof body.version === "number" && "context" in body
  } catch { return false }
}

async function selectMemory(page: Page, reference: string, area: "UI61" | "UI63", localized = false) {
  const picker = page.locator("[data-sf-memory-case]")
  await expect(picker.locator("option", { hasText: finalMemoryData.objective })).toHaveCount(1)
  await picker.selectOption(reference)
  await page.getByRole("button", { name: localized ? "Consultar caso autorizado" : "Read authorized case", exact: true }).click()
  await expect(page.locator(area === "UI61" ? "[data-sf-condition-id]" : "[data-sf-memory-choice]")).toHaveCount(1)
}

waveFourTest("UI61–UI63 · original condition, month outcome and authorized case recall", async ({ page, browser, installation, owner }, info) => {
  const diagnostics = observePage(page)
  const seeded = await seedFinalMemory({
    actorId: installation.actorId,
    request: async (pathname, init) => {
      const headers = new Headers(init?.headers)
      if (init?.method === "POST") headers.set("Origin", installation.origin)
      const response = await page.context().request.fetch(installation.origin + installation.mount + pathname, {
        method: init?.method ?? "GET", headers: Object.fromEntries(headers),
        ...(typeof init?.body === "string" ? { data: init.body } : {}), timeout: 40_000,
      })
      return new Response(new Uint8Array(await response.body()), { status: response.status(), headers: response.headers() })
    },
  }, installation.year)
  const memoryWrites: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.origin === installation.origin && request.method() === "POST" &&
        ["memory-condition", "memory-outcome-selection"].includes(url.searchParams.get("sf") ?? ""))
      memoryWrites.push(url.searchParams.get("sf")!)
  })

  await waveFourTest.step("UI63 opens a real recorded choice without a condition and reopens its opaque outcome locator", async () => {
    await page.setViewportSize({ width: 1440, height: 1100 })
    await enter(page, owner, installation.origin + "/orchestra/sf-memory/outcomes", "Expected and observed")
    await scheme(page, "dark")
    const surface = page.locator('[data-sf-surface="UI63"]')
    await selectMemory(page, seeded.reference, "UI63")
    expect(seeded.initialConditionCount).toBe(0)
    await expect(surface.locator("[data-sf-condition-id]")).toHaveCount(0)
    const choice = surface.locator('[data-sf-memory-choice="' + seeded.choiceId + '"]')
    await expect(choice).toContainText(waveFourDecisionsData.plannerCandidate)
    await expect(choice).toContainText(finalMemoryData.reason)
    await choice.getByRole("button", { name: "Review choice outcome", exact: true }).click()
    const outcome = surface.locator("[data-sf-memory-outcome]")
    await expect(outcome).toBeVisible()
    await expect(outcome.locator("[data-sf-memory-expected]")).toHaveText(String(seeded.expected) + " USD")
    await expect(outcome.locator("[data-sf-memory-observed]")).toHaveText(String(seeded.observed) + " USD")
    await expect(outcome.locator("[data-sf-memory-delta]")).toHaveText(String(seeded.delta))
    await expect(outcome).toContainText("No causal attribution is made from an observed difference.")
    await expect(choice.getByRole("button", { name: "Review choice outcome", exact: true })).toHaveAttribute("aria-expanded", "true")
    await scrollPageTop(page)
    await captureFinalSurface(page, info, "UI63", "dark-desktop-recorded-choice-no-condition", { preview: true })
    await surface.locator("[data-sf-memory-case]").selectOption("")
    await expect(outcome).toBeHidden()
    await expect(surface.locator("[data-sf-memory-choice]")).toHaveCount(0)
    await expect(surface.getByRole("button", { name: "Read authorized case", exact: true })).toBeDisabled()
    await enter(page, owner, installation.origin + "/orchestra/sf-memory/outcomes/" + seeded.selectionRef, "Expected and observed")
    await expect(outcome).toBeVisible()
    await expect(surface.locator("[data-sf-memory-case]")).toHaveCount(0)
    await captureFinalSurface(page, info, "UI63", "dark-desktop-source-comparison")
    await scheme(page, "light")
    await captureFinalSurface(page, info, "UI63", "light-desktop-source-comparison")
    await page.setViewportSize({ width: 320, height: 900 })
    await reflow(page)
    await captureFinalSurface(page, info, "UI63", "light-320-source-comparison")
  })

  const registered = await seeded.registerCondition()

  await waveFourTest.step("UI61 selects the original case, reopens its registered condition and clears detail on a new selection", async () => {
    await page.setViewportSize({ width: 1440, height: 1100 })
    await scheme(page, "dark")
    await enter(page, owner, installation.origin + "/orchestra/sf-memory/signals", "Signals")
    const surface = page.locator('[data-sf-surface="UI61"]')
    await expect(surface).toHaveAttribute("data-sf-wave", "six")
    await expect(surface.getByRole("button", { name: "Read authorized case", exact: true })).toBeDisabled()
    await captureFinalSurface(page, info, "UI61", "dark-desktop-case-selection")
    await selectMemory(page, seeded.reference, "UI61")
    const condition = surface.locator('[data-sf-condition-id="' + registered.conditionId + '"]')
    await expect(condition).toContainText(finalMemoryData.condition)
    await condition.getByRole("button", { name: "Review condition", exact: true }).click()
    const materiality = surface.locator("[data-sf-memory-materiality]")
    await expect(materiality).toBeVisible()
    await expect(materiality).toContainText(seeded.period.start)
    await expect(condition.getByRole("button", { name: "Review condition", exact: true })).toHaveAttribute("aria-expanded", "true")
    await scrollPageTop(page)
    await captureFinalSurface(page, info, "UI61", "dark-desktop-recorded-condition", { preview: true })
    await scheme(page, "light")
    await captureFinalSurface(page, info, "UI61", "light-desktop-recorded-condition")
    await page.setViewportSize({ width: 320, height: 900 })
    await reflow(page)
    await materiality.scrollIntoViewIfNeeded()
    await captureFinalSurface(page, info, "UI61", "light-320-materiality")
    await surface.locator("[data-sf-memory-case]").selectOption("")
    await expect(materiality).toBeHidden()
    await expect(surface.locator("[data-sf-condition-id]")).toHaveCount(0)
    await expect(surface.getByRole("button", { name: "Read authorized case", exact: true })).toBeDisabled()
  })

  await waveFourTest.step("UI62 sends a private recall question and explicit authorized candidates to the original producer", async () => {
    await page.setViewportSize({ width: 1440, height: 1100 })
    await enter(page, owner, installation.origin + "/orchestra/sf-memory/cases", "Similar cases")
    await scheme(page, "dark")
    const surface = page.locator('[data-sf-surface="UI62"]')
    await surface.getByLabel("Original decision case", { exact: true }).selectOption(seeded.reference)
    const query = "Review the original regional service renewal decision and its pending cost coverage."
    await surface.getByLabel("Recall question", { exact: true }).fill(query)
    const precedent = surface.getByRole("checkbox", { name: new RegExp(waveFourDecisionsData.objective) })
    await precedent.check()
    const response = page.waitForResponse((reply) => reply.request().method() === "POST" &&
      new URL(reply.url()).searchParams.get("sf") === "memory-similar-cases", { timeout: 40_000 })
      .then(async (reply) => ({ status: reply.status(), url: reply.url(), body: reply.request().postDataJSON() as unknown,
        result: await reply.json() as unknown }))
    await surface.getByRole("button", { name: "Find similar cases", exact: true }).click()
    const original = await response
    expect(original.status).toBe(200)
    expect(new URL(original.url).searchParams.has("query")).toBe(false)
    expect(page.url()).not.toContain(encodeURIComponent(query))
    expect(original.body).toMatchObject({ query, caseId: seeded.caseRef.id, incarnation: seeded.caseRef.incarnation,
      version: seeded.caseRef.version, period: seeded.period, includeHistorical: false })
    const result = original.result
    if (!result || typeof result !== "object" || !("status" in result) || result.status !== "ok" ||
        !("matches" in result) || !Array.isArray(result.matches))
      throw new Error("Original similar-case response omitted its authorized matches")
    const matches: readonly unknown[] = result.matches
    if (matches.length === 0) {
      await expect(surface.getByText("No authorized matching cases were returned for this selection.", { exact: true })).toBeVisible()
    } else {
      await expect(surface.locator("[data-sf-similar-case]")).toHaveCount(matches.length)
      for (const match of matches) {
        if (!match || typeof match !== "object" || !("memoryRecordRef" in match) || typeof match.memoryRecordRef !== "string")
          throw new Error("Original match omitted its evidence event")
        const row = surface.locator("[data-sf-memory-record]").filter({ has: page.locator("strong", { hasText: waveFourDecisionsData.objective }) })
        await expect(row).toHaveCount(matches.length)
        const event = surface.locator('[data-sf-memory-record="' + match.memoryRecordRef + '"]')
        await event.getByRole("button", { name: "Open original case", exact: true }).click()
        await expect(surface.locator("[data-sf-similar-detail]")).toContainText(waveFourDecisionsData.objective)
      }
    }
    await info.attach("UI62-original-recall-count", { body: JSON.stringify({ matchingCases: matches.length }), contentType: "application/json" })
    await captureFinalSurface(page, info, "UI62", "dark-desktop-original-recall", { preview: true })
    await scheme(page, "light")
    await captureFinalSurface(page, info, "UI62", "light-desktop-original-recall")
    await page.setViewportSize({ width: 320, height: 900 })
    await reflow(page)
    await captureFinalSurface(page, info, "UI62", "light-320-original-recall")
    // A changed source selection immediately removes any former result/detail.
    await surface.getByLabel("Original decision case", { exact: true }).selectOption("")
    await expect(surface.locator("[data-sf-similar-matches]")).toHaveCount(0)
    await expect(surface.locator("[data-sf-similar-detail]")).toHaveCount(0)
  })

  await withFinalMemoryPortuguese(browser, page, installation, async (localized) => {
    await enter(localized, owner, installation.origin + "/orchestra/sf-memory/signals", "Sinais")
    await selectMemory(localized, seeded.reference, "UI61", true)
    await localized.getByRole("button", { name: "Revisar condição", exact: true }).click()
    await expect(localized.locator("[data-sf-memory-materiality]")).toBeVisible()
    await captureFinalSurface(localized, info, "UI61", "pt-br-dark-desktop-condition")
    await enter(localized, owner, installation.origin + "/orchestra/sf-memory/outcomes/" + seeded.selectionRef, "Previsto e observado")
    await expect(localized.locator("[data-sf-memory-outcome]")).toBeVisible()
    await captureFinalSurface(localized, info, "UI63", "pt-br-dark-desktop-comparison")
    await enter(localized, owner, installation.origin + "/orchestra/sf-memory/cases", "Casos semelhantes")
    await localized.getByLabel("Caso de decisão original", { exact: true }).selectOption(seeded.reference)
    await captureFinalSurface(localized, info, "UI62", "pt-br-dark-desktop-authorized-candidates")
  })
  expect(memoryWrites).toEqual([])
  expect(diagnostics.pageErrors).toEqual([])
  expect(diagnostics.consoleErrors).toEqual([])
  await info.attach("UI61-UI63-original-memory-evidence", { contentType: "application/json", body: JSON.stringify({
    areas: ["UI61", "UI62", "UI63"], source: "original human decision, memory and Planner HTTP producers",
    caseVersion: seeded.caseRef.version, period: seeded.period, expected: seeded.expected, observed: seeded.observed,
    delta: seeded.delta, browserMemorySelectionCommands: memoryWrites.length,
    choicesWithoutConditions: 1, initialConditionCount: seeded.initialConditionCount,
    limitations: ["Other decision cost categories remain pending.", "No causal effect inferred.", "Actual browser zoom not measured."],
  }, null, 2) })
})

waveFourTest("UI67 · current owner details and refresh remain scoped to the installed context", async ({ page, browser, installation, owner }, info) => {
  const diagnostics = observePage(page)
  await enter(page, owner, installation.origin + "/orchestra/sf-home/context", "Context and access")
  const surface = page.locator('[data-sf-surface="UI67"]')
  const details = surface.locator('[data-sf-context="authorized"]')
  await expect(details).toContainText(owner.projectId)
  await expect(details).toContainText(owner.installationId)
  await expect(details).toContainText(installation.actorId)
  await captureFinalSurface(page, info, "UI67", "dark-desktop-current-context", { preview: true })
  const contextReply = page.waitForResponse((response) =>
    new URL(response.url()).pathname === installation.mount + "/api/ui/context" && response.request().method() === "GET")
    .then((response) => response.status())
  await surface.getByRole("button", { name: "Refresh access", exact: true }).click()
  expect(await contextReply).toBe(200)
  await ready(page, "Context and access")
  await expect(details).toContainText(installation.actorId)
  await scheme(page, "light")
  await captureFinalSurface(page, info, "UI67", "light-desktop-refreshed-context")
  await page.setViewportSize({ width: 320, height: 900 })
  await reflow(page)
  await captureFinalSurface(page, info, "UI67", "light-320-current-context")
  await withFinalMemoryPortuguese(browser, page, installation, async (localized) => {
    await enter(localized, owner, installation.origin + "/orchestra/sf-home/context", "Contexto e acesso")
    await expect(localized.getByRole("heading", { name: "Contexto atual", exact: true })).toBeVisible()
    await captureFinalSurface(localized, info, "UI67", "pt-br-dark-desktop-current-context")
  })
  expect(diagnostics.pageErrors).toEqual([])
  expect(diagnostics.consoleErrors).toEqual([])
})

waveFourTest("UI69 · one reviewed summaries save, retained draft and persisted original readback", async ({ page, browser, installation, owner }, info) => {
  const diagnostics = observePage(page)
  const writes: unknown[] = []
  page.on("request", (request) => { if (summaryMutation(request)) writes.push(request.postDataJSON()) })
  await enter(page, owner, installation.origin + "/orchestra/sf-home/administration", "Local administration")
  const surface = page.locator('[data-sf-surface="UI69"]')
  await expect(surface).toHaveAttribute("data-sf-owner", "local-operator")
  const settings = surface.locator("[data-sf-summary-settings]")
  const version = settings.locator("[data-sf-summary-version]")
  const before = Number(await version.textContent())
  expect(Number.isSafeInteger(before)).toBe(true)
  const projects = settings.locator('input[name="pages"][value="All Projects"]')
  const proposed = !await projects.isChecked()
  await projects.setChecked(proposed)
  await captureFinalSurface(page, info, "UI69", "dark-desktop-summary-settings", { preview: true })
  await settings.getByRole("button", { name: "Review", exact: true }).click()
  const review = settings.locator('[data-component="sf-change-review"]')
  await expect(review).toBeVisible()
  await expect(settings.locator("[data-sf-summary-form]")).toBeHidden()
  expect(writes).toEqual([])
  await review.getByRole("button", { name: "Revise", exact: true }).click()
  await expect(projects).toBeChecked({ checked: proposed })
  await settings.getByRole("button", { name: "Review", exact: true }).click()
  await scheme(page, "light")
  await scrollPageTop(page)
  await captureFinalSurface(page, info, "UI69", "light-desktop-summary-review")
  await page.setViewportSize({ width: 320, height: 900 })
  await reflow(page)
  await reviewActions(page)
  await captureFinalSurface(page, info, "UI69", "light-320-summary-review-actions")
  await review.getByRole("button", { name: "Cancel review", exact: true }).click()
  await expect(projects).toBeChecked({ checked: proposed })
  expect(writes).toEqual([])
  await settings.getByRole("button", { name: "Review", exact: true }).click()
  const saved = page.waitForResponse((response) => summaryMutation(response.request())).then((response) => response.status())
  await review.getByRole("button", { name: "Save summaries", exact: true }).click()
  expect(await saved).toBe(200)
  await expect(review).toBeHidden()
  await expect(version).toHaveText(String(before + 1))
  await expect(projects).toBeChecked({ checked: proposed })
  expect(writes).toHaveLength(1)
  await page.setViewportSize({ width: 1440, height: 1100 })
  await enter(page, owner, installation.origin + "/orchestra/sf-home/administration", "Local administration")
  await expect(version).toHaveText(String(before + 1))
  await expect(projects).toBeChecked({ checked: proposed })
  await captureFinalSurface(page, info, "UI69", "light-desktop-persisted-summaries")
  await withFinalMemoryPortuguese(browser, page, installation, async (localized) => {
    await enter(localized, owner, installation.origin + "/orchestra/sf-home/administration", "Administração local")
    await expect(localized.getByRole("heading", { name: "Resumos adicionais para consulta", exact: true })).toBeVisible()
    await expect(localized.locator('input[name="pages"][value="All Projects"]')).toBeChecked({ checked: proposed })
    await captureFinalSurface(localized, info, "UI69", "pt-br-dark-desktop-administration")
  })
  expect(writes).toHaveLength(1)
  expect(diagnostics.pageErrors).toEqual([])
  expect(diagnostics.consoleErrors).toEqual([])
})
