import { expect } from "@playwright/test"
import type { Page, Request } from "@playwright/test"
import { Schema } from "effect"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import type { DesignInstallation } from "./design-support/installation"
import { waveFourTest, ready, scheme, reflow, reviewActions, scrollPageTop, observePage } from "./design-support/wave-four"
import { captureFinalSurface } from "./design-support/final-capture"
import { finalMemoryData, seedFinalMemory } from "./design-support/final-memory-seed"
import { enterFinalMemorySurface, enterFinalMemoryOutcome, observeFinalMemoryOutcomeFailures, withFinalMemoryPortuguese } from "./design-support/final-memory-browser"
import { waveFourDecisionsData } from "./design-support/wave-four-decisions-data"
import { observeFinalGet } from "./design-support/final-navigation"
import { observeFinalMemoryRecall } from "./design-support/final-memory-recall"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"

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

type MemoryCaseSelection = { reference: string; caseRef: { id: string; incarnation: string; version: number } }
type MemoryRead = "case" | "memory-conditions" | "memory-materiality"

async function originalMemoryReads(
  page: Page, installation: Pick<DesignInstallation, "origin" | "mount">,
  selection: MemoryCaseSelection, modes: readonly MemoryRead[], action: () => Promise<unknown>,
) {
  const reads: { mode: MemoryRead; started: number; observed: Awaited<ReturnType<typeof observeFinalGet>> }[] = []
  try {
    for (const mode of modes) reads.push({
      mode, started: Date.now(),
      observed: await observeFinalGet(page, installation.origin, installation.mount +
        (mode === "case" ? "/api/ui/projections/case" : "/dashboard"), 1, (url) =>
        mode === "case" ? url.searchParams.get("caseRef") === selection.reference :
          url.searchParams.get("sf") === mode && url.searchParams.get("caseId") === selection.caseRef.id &&
          url.searchParams.get("incarnation") === selection.caseRef.incarnation &&
          url.searchParams.get("version") === String(selection.caseRef.version)),
    })
    // Observe first, perform one original action, then await its original body.
    // Each response still has the shared 40s bound from its actual Request.
    await action()
    await Promise.all(reads.map(async ({ mode, started, observed }) => {
      const original = await observed.next()
      console.info("SF_FINAL_MEMORY_ORIGINAL_READ " + JSON.stringify({
        mode, status: original.status, milliseconds: Date.now() - started,
      }))
      expect(original.status).toBe(200)
      expect(original.body).toMatchObject({ status: "ok" })
      if (mode === "case") expect(original.body).toMatchObject({ value: { projection: { case: selection.caseRef } } })
    }))
  } finally {
    const closed = await Promise.allSettled(reads.map(({ observed }) => observed.close()))
    const failures = closed.flatMap((result) => result.status === "rejected" ? [result.reason] : [])
    if (failures.length) throw new AggregateError(failures, "Original memory reading observers did not close")
  }
}

async function selectMemory(page: Page, installation: DesignInstallation, selection: MemoryCaseSelection, area: "UI61" | "UI63", localized = false) {
  const picker = page.getByRole("combobox", { name: localized ? "Caso autorizado" : "Authorized case", exact: true })
  await expect(picker.locator("option", { hasText: finalMemoryData.objective })).toHaveCount(1)
  await picker.selectOption(selection.reference)
  await originalMemoryReads(page, installation, selection, area === "UI61" ? ["memory-conditions"] : ["case"], () =>
    page.getByRole("button", { name: localized ? "Consultar caso autorizado" : "Read authorized case", exact: true }).click())
  await expect(page.locator(area === "UI61" ? "[data-sf-condition-id]" : "[data-sf-memory-choice]")).toHaveCount(1)
}

function memorySteps() {
  const failures: unknown[] = []
  const independently = async (name: string, work: () => Promise<void>) => {
    try {
      await waveFourTest.step(name, work)
      console.info("SF_FINAL_MEMORY_STEP " + JSON.stringify({ name, status: "passed" }))
    } catch (error) {
      failures.push(error)
      // Bound diagnostics to assertion text and source locations; never emit request headers.
      const clean = (value: string) => value.replace(/\u001b\[[0-9;]*m/g, "").slice(0, 300)
      const detail = error instanceof Error ? {
        kind: error.name, summary: clean(error.message.split("\n")[0] ?? ""),
        assertion: error.message.split("\n").filter((line) => /^(Locator:|Expected:|Received:)/.test(line)).map(clean).slice(0, 3),
        location: (error.stack ?? "").split("\n").filter((line) => /^\s*at /.test(line)).map(clean).slice(0, 3),
      } : { kind: typeof error }
      console.info("SF_FINAL_MEMORY_STEP " + JSON.stringify({ name, status: "failed", detail }))
    }
  }
  return {
    independently,
    complete: () => {
      if (failures.length) throw new AggregateError(failures, "Independent original-memory steps failed")
    },
  }
}

async function seedInstalledMemory(page: Page, installation: DesignInstallation) {
  return seedFinalMemory({
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
}

function observeMemoryCommands(page: Page, origin: string) {
  const memoryWrites: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.origin === origin && request.method() === "POST" &&
        ["memory-condition", "memory-outcome-selection"].includes(url.searchParams.get("sf") ?? ""))
      memoryWrites.push(url.searchParams.get("sf")!)
  })
  return memoryWrites
}

function isMemorySignalRequest(request: Request, origin: string, selection: MemoryCaseSelection) {
  const url = new URL(request.url())
  return request.method() === "GET" && url.origin === origin && url.searchParams.get("sf") === "memory-signals" &&
    url.searchParams.get("caseId") === selection.caseRef.id &&
    url.searchParams.get("incarnation") === selection.caseRef.incarnation &&
    url.searchParams.get("version") === String(selection.caseRef.version)
}

waveFourTest("UI61 · original conditions, independent materiality and explicit signal cancellation", async ({ page, browser, installation, owner }, info) => {
  const diagnostics = observePage(page)
  const outcomeFailures = observeFinalMemoryOutcomeFailures(page, installation)
  const { independently, complete } = memorySteps()
  const seeded = await seedInstalledMemory(page, installation)
  const memoryWrites = observeMemoryCommands(page, installation.origin)

  const registered = await seeded.registerCondition()
  const signalRequests: Request[] = []
  page.on("request", (request) => {
    if (isMemorySignalRequest(request, installation.origin, seeded)) signalRequests.push(request)
  })
  await independently("UI61 publishes registered conditions without starting signal re-evaluation", async () => {
    await page.setViewportSize({ width: 1440, height: 1100 })
    await enterFinalMemorySurface(page, owner, installation, installation.origin + "/orchestra/sf-memory/signals", "Signals", "UI61")
    await scheme(page, "dark")
    const surface = page.locator('[data-sf-surface="UI61"]')
    await expect(surface).toHaveAttribute("data-sf-wave", "six")
    await expect(surface.getByRole("button", { name: "Read authorized case", exact: true })).toBeDisabled()
    await captureFinalSurface(page, info, "UI61", "dark-desktop-case-selection")
    await selectMemory(page, installation, seeded, "UI61")
    const condition = surface.locator('[data-sf-condition-id="' + registered.conditionId + '"]')
    await expect(condition).toContainText(finalMemoryData.condition)
    const signals = surface.locator("[data-sf-memory-signals-state]")
    await expect(signals).toHaveAttribute("data-sf-memory-signals-state", "idle")
    await expect(signals.getByText("No materiality signals are recorded for this authorized case.", { exact: true })).toHaveCount(0)
    await expect(signals.getByRole("button", { name: "Read current signals", exact: true })).toBeEnabled()
    expect(signalRequests).toEqual([])
    await scrollPageTop(page)
    await captureFinalSurface(page, info, "UI61", "dark-desktop-recorded-condition", { preview: true })
    await scheme(page, "light")
    await captureFinalSurface(page, info, "UI61", "light-desktop-recorded-condition", { preview: true })
    await page.setViewportSize({ width: 320, height: 900 })
    await reflow(page)
    await captureFinalSurface(page, info, "UI61", "light-320-recorded-condition", { preview: true })
  })
  await independently("UI61 reads original materiality independently and clears detail on a new selection", async () => {
    await page.setViewportSize({ width: 1440, height: 1100 })
    await scheme(page, "dark")
    const surface = page.locator('[data-sf-surface="UI61"]')
    const condition = surface.locator('[data-sf-condition-id="' + registered.conditionId + '"]')
    await originalMemoryReads(page, installation, seeded, ["memory-materiality"], () =>
      condition.getByRole("button", { name: "Review condition", exact: true }).click())
    const materiality = surface.locator("[data-sf-memory-materiality]")
    await expect(materiality).toBeVisible()
    await expect(materiality).toContainText(seeded.period.start)
    await expect(condition.getByRole("button", { name: "Review condition", exact: true })).toHaveAttribute("aria-expanded", "true")
    await scrollPageTop(page)
    await captureFinalSurface(page, info, "UI61", "dark-desktop-materiality", { preview: true })
    await scheme(page, "light")
    await page.setViewportSize({ width: 320, height: 900 })
    await reflow(page)
    await materiality.scrollIntoViewIfNeeded()
    await captureFinalSurface(page, info, "UI61", "light-320-materiality")
    await surface.locator("[data-sf-memory-case]").selectOption("")
    await expect(materiality).toBeHidden()
    await expect(surface.locator("[data-sf-condition-id]")).toHaveCount(0)
    await expect(surface.getByRole("button", { name: "Read authorized case", exact: true })).toBeDisabled()
  })

  await independently("UI61 Portuguese condition", async () => {
    await withFinalMemoryPortuguese(browser, page, installation, async (localized) => {
      const localizedWrites = observeMemoryCommands(localized, installation.origin)
      const signalRequests: Request[] = []
      localized.on("request", (request) => {
        if (isMemorySignalRequest(request, installation.origin, seeded)) signalRequests.push(request)
      })
      await enterFinalMemorySurface(localized, owner, installation, installation.origin + "/orchestra/sf-memory/signals", "Sinais", "UI61")
      await selectMemory(localized, installation, seeded, "UI61", true)
      await expect(localized.locator("[data-sf-memory-signals-state]")).toHaveAttribute("data-sf-memory-signals-state", "idle")
      await expect(localized.getByRole("button", { name: "Consultar sinais atuais", exact: true })).toBeEnabled()
      expect(signalRequests).toEqual([])
      await originalMemoryReads(localized, installation, seeded, ["memory-materiality"], () => localized.getByRole("button", { name: "Revisar condição", exact: true }).click())
      await expect(localized.locator("[data-sf-memory-materiality]")).toBeVisible()
      expect(signalRequests).toEqual([])
      await captureFinalSurface(localized, info, "UI61", "pt-br-dark-desktop-condition", { preview: true })
      expect(localizedWrites).toEqual([])
    })
  })

  await independently("UI61 explicitly starts the original signal read and cancels only this view's wait", async () => {
    // This costly original read is last; canceling the browser wait does not stop source reconciliation.
    // Reopen only before it starts. No subsequent assertion depends on another server response.
    // Set the theme while the original desktop toggle is visible, then enter the narrow viewport.
    await page.setViewportSize({ width: 1440, height: 1100 })
    await scheme(page, "light")
    await page.setViewportSize({ width: 320, height: 900 })
    await selectMemory(page, installation, seeded, "UI61")
    const surface = page.locator('[data-sf-surface="UI61"]')
    const signals = surface.locator("[data-sf-memory-signals-state]")
    await expect(signals).toHaveAttribute("data-sf-memory-signals-state", "idle")
    expect(signalRequests).toEqual([])
    const requested = page.waitForRequest((request) => isMemorySignalRequest(request, installation.origin, seeded), { timeout: 40_000 })
    await signals.getByRole("button", { name: "Read current signals", exact: true }).click()
    const request = await requested
    await expect(signals).toHaveAttribute("data-sf-memory-signals-state", "loading")
    await expect(signals.getByRole("button", { name: "Read current signals", exact: true })).toBeDisabled()
    await expect(surface.locator('[data-sf-condition-id="' + registered.conditionId + '"]')).toContainText(finalMemoryData.condition)
    const cancelled = page.waitForEvent("requestfailed", {
      predicate: (failed) => failed === request, timeout: 40_000,
    })
    await signals.getByRole("button", { name: "Cancel signal consultation", exact: true }).click()
    const failed = await cancelled
    expect(failed.failure()?.errorText).toMatch(/ERR_ABORTED|NS_BINDING_ABORTED/)
    await expect(signals).toHaveAttribute("data-sf-memory-signals-state", "cancelled")
    await expect(signals).toContainText("Signal consultation stopped in this view. No current result was received. You can check again.")
    await expect(signals.getByText("No materiality signals are recorded for this authorized case.", { exact: true })).toHaveCount(0)
    await expect(signals.getByRole("button", { name: "Read current signals", exact: true })).toBeEnabled()
    expect(signalRequests).toHaveLength(1)
    await captureFinalSurface(page, info, "UI61", "light-320-cancelled-consultation", { preview: true })
    // Changing the case erases local cancellation, conditions and any pending detail.
    await surface.locator("[data-sf-memory-case]").selectOption("")
    await expect(surface.locator("[data-sf-memory-signals-state]")).toHaveCount(0)
    await expect(surface.locator("[data-sf-condition-id]")).toHaveCount(0)
    await expect(surface.locator("[data-sf-memory-materiality]")).toHaveCount(0)
    await expect(surface.getByRole("button", { name: "Read authorized case", exact: true })).toBeDisabled()
    expect(signalRequests).toHaveLength(1)
  })
  await independently("No memory selection command was issued by the browser", async () => { expect(memoryWrites).toEqual([]) })
  await independently("Memory pages emitted no JavaScript errors", async () => { expect(diagnostics.pageErrors).toEqual([]) })
  await independently("Memory console contains only verified original coverage refusals", async () => {
    outcomeFailures.assertOnlyExpectedErrors(diagnostics.consoleErrors)
  })
  complete()
  await info.attach("UI61-original-memory-evidence", { contentType: "application/json", body: JSON.stringify({
    area: "UI61", source: "original human decision, memory and Planner HTTP producers",
    caseVersion: seeded.caseRef.version, period: seeded.period,
    browserMemorySelectionCommands: memoryWrites.length,
    recordedConditions: 1, signalRequests: signalRequests.length,
    signals: { status: "consultation-cancelled", originalResponseQualified: false },
    limitations: ["R8's original memory-signals request did not complete within the unchanged 40-second limit.", "Canceling this view's wait does not claim that source reconciliation was rolled back.", "Actual browser zoom not measured."],
  }, null, 2) })
})

waveFourTest("UI62 · private authorized case recall in an isolated installation", async ({ page, browser, installation, owner }, info) => {
  const diagnostics = observePage(page)
  const outcomeFailures = observeFinalMemoryOutcomeFailures(page, installation)
  const { independently, complete } = memorySteps()
  const seeded = await seedInstalledMemory(page, installation)
  const memoryWrites = observeMemoryCommands(page, installation.origin)
  await independently("UI62 sends a private recall question and explicit authorized candidates to the original producer", async () => {
    await page.setViewportSize({ width: 1440, height: 1100 })
    await enterFinalMemorySurface(page, owner, installation, installation.origin + "/orchestra/sf-memory/cases", "Similar cases", "UI62")
    await scheme(page, "dark")
    const surface = page.locator('[data-sf-surface="UI62"]')
    await originalMemoryReads(page, installation, seeded, ["case"], () => surface.getByLabel("Original decision case", { exact: true }).selectOption(seeded.reference))
    const query = "Review the original regional service renewal decision and its pending cost coverage."
    await surface.getByLabel("Recall question", { exact: true }).fill(query)
    const precedent = surface.getByRole("checkbox", { name: new RegExp(waveFourDecisionsData.objective) })
    await precedent.check()
    const response = await observeFinalMemoryRecall(page, installation)
    let original: Awaited<ReturnType<typeof response.next>>
    try {
      await surface.getByRole("button", { name: "Find similar cases", exact: true }).click()
      original = await response.next()
    } finally { await response.close() }
    const source = original.result && typeof original.result === "object" ? original.result : undefined
    const reason = source && "reason" in source && typeof source.reason === "string" ? source.reason : null
    console.info("SF_FINAL_MEMORY_RECALL_ORIGINAL " + JSON.stringify({
      httpStatus: original.status,
      status: source && "status" in source && typeof source.status === "string" ? source.status : null,
      reason: reason?.slice(0, 200) ?? null,
      reasonTruncated: reason !== null && reason.length > 200,
      matchingCases: source && "matches" in source && Array.isArray(source.matches) ? source.matches.length : null,
    }))
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
        if (!("caseRef" in match) || !match.caseRef || typeof match.caseRef !== "object" ||
            !("id" in match.caseRef) || typeof match.caseRef.id !== "string" ||
            !("incarnation" in match.caseRef) || typeof match.caseRef.incarnation !== "string" ||
            !("version" in match.caseRef) || typeof match.caseRef.version !== "number")
          throw new Error("Original match omitted its authorized case identity")
        const caseRef = { id: match.caseRef.id, incarnation: match.caseRef.incarnation, version: match.caseRef.version }
        const reference = "case:" + encodeURIComponent(caseRef.id) + ":" + encodeURIComponent(caseRef.incarnation)
        await originalMemoryReads(page, installation, { reference, caseRef }, ["case"], () =>
          event.getByRole("button", { name: "Open original case", exact: true }).click())
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
  await independently("UI62 Portuguese authorized candidates", async () => {
    await withFinalMemoryPortuguese(browser, page, installation, async (localized) => {
      const localizedWrites = observeMemoryCommands(localized, installation.origin)
      await enterFinalMemorySurface(localized, owner, installation, installation.origin + "/orchestra/sf-memory/cases", "Casos semelhantes", "UI62")
      await originalMemoryReads(localized, installation, seeded, ["case"], () => localized.getByLabel("Caso de decisão original", { exact: true }).selectOption(seeded.reference))
      await expect(localized.getByRole("checkbox", { name: new RegExp(waveFourDecisionsData.objective) })).toBeVisible()
      await captureFinalSurface(localized, info, "UI62", "pt-br-dark-desktop-authorized-candidates", { preview: true })
      expect(localizedWrites).toEqual([])
    })
  })

  await independently("No memory selection command was issued by the browser", async () => { expect(memoryWrites).toEqual([]) })
  await independently("Memory pages emitted no JavaScript errors", async () => { expect(diagnostics.pageErrors).toEqual([]) })
  await independently("Memory console contains only verified original coverage refusals", async () => {
    outcomeFailures.assertOnlyExpectedErrors(diagnostics.consoleErrors)
  })
  complete()
  await info.attach("UI62-original-memory-evidence", { contentType: "application/json", body: JSON.stringify({
    area: "UI62", source: "original human decision, memory and Planner HTTP producers",
    caseVersion: seeded.caseRef.version, period: seeded.period,
    browserMemorySelectionCommands: memoryWrites.length,
    limitations: ["Only original authorized matches are displayed; no similarity is inferred from other records.", "Actual browser zoom not measured."],
  }, null, 2) })
})

waveFourTest("UI63 · recorded choices without conditions and original incomplete coverage", async ({ page, browser, installation, owner }, info) => {
  const diagnostics = observePage(page)
  const outcomeFailures = observeFinalMemoryOutcomeFailures(page, installation)
  const { independently, complete } = memorySteps()
  const seeded = await seedInstalledMemory(page, installation)
  const memoryWrites = observeMemoryCommands(page, installation.origin)
  await independently("UI63 opens a recorded choice without a condition and preserves the original coverage refusal", async () => {
    await page.setViewportSize({ width: 1440, height: 1100 })
    await enterFinalMemorySurface(page, owner, installation, installation.origin + "/orchestra/sf-memory/outcomes", "Expected and observed", "UI63")
    await scheme(page, "dark")
    const surface = page.locator('[data-sf-surface="UI63"]')
    await selectMemory(page, installation, seeded, "UI63")
    expect(seeded.initialConditionCount).toBe(0)
    await expect(surface.locator("[data-sf-condition-id]")).toHaveCount(0)
    const choice = surface.locator('[data-sf-memory-choice="' + seeded.choiceId + '"]')
    await expect(choice).toContainText(waveFourDecisionsData.plannerCandidate)
    await expect(choice).toContainText(finalMemoryData.reason)
    await outcomeFailures.expectUnavailable(() => choice.getByRole("button", { name: "Review choice outcome", exact: true }).click())
    const outcome = surface.locator("[data-sf-memory-outcome-status]")
    await expect(outcome).toHaveAttribute("data-sf-memory-outcome-status", "unavailable")
    await expect(outcome).toHaveAttribute("data-sf-memory-reason", seeded.outcomeReason)
    await expect(outcome).toContainText("Expected and observed values cannot be compared while the recorded cost coverage is incomplete.")
    await expect(surface.locator("[data-sf-memory-expected], [data-sf-memory-observed], [data-sf-memory-delta]")).toHaveCount(0)
    await expect(choice.getByRole("button", { name: "Review choice outcome", exact: true })).toHaveAttribute("aria-expanded", "true")
    await scrollPageTop(page)
    await captureFinalSurface(page, info, "UI63", "dark-desktop-recorded-choice-no-condition", { preview: true })
    await surface.locator("[data-sf-memory-case]").selectOption("")
    await expect(outcome).toBeHidden()
    await expect(surface.locator("[data-sf-memory-choice]")).toHaveCount(0)
    await expect(surface.getByRole("button", { name: "Read authorized case", exact: true })).toBeDisabled()
    await enterFinalMemoryOutcome(page, owner, installation, installation.origin + "/orchestra/sf-memory/outcomes/" + encodeSfRouteRef(seeded.selectionRef), "Expected and observed", outcomeFailures)
    await expect(outcome).toHaveAttribute("data-sf-memory-reason", "coverage-incomplete")
    await expect(surface.locator("[data-sf-memory-case]")).toHaveCount(0)
    await captureFinalSurface(page, info, "UI63", "dark-desktop-incomplete-coverage")
    await scheme(page, "light")
    await captureFinalSurface(page, info, "UI63", "light-desktop-incomplete-coverage", { preview: true })
    await page.setViewportSize({ width: 320, height: 900 })
    await reflow(page)
    await captureFinalSurface(page, info, "UI63", "light-320-incomplete-coverage", { preview: true })
  })
  await independently("UI63 Portuguese incomplete coverage", async () => {
    await withFinalMemoryPortuguese(browser, page, installation, async (localized, localizedOutcomes) => {
      const localizedWrites = observeMemoryCommands(localized, installation.origin)
      await enterFinalMemoryOutcome(localized, owner, installation, installation.origin + "/orchestra/sf-memory/outcomes/" + encodeSfRouteRef(seeded.selectionRef), "Previsto e observado", localizedOutcomes)
      await expect(localized.locator("[data-sf-memory-outcome-status]")).toContainText("Não é possível comparar os valores previstos e observados enquanto a cobertura de custos registrada estiver incompleta.")
      await expect(localized.locator("[data-sf-memory-outcome]")).toHaveCount(0)
      await captureFinalSurface(localized, info, "UI63", "pt-br-dark-desktop-incomplete-coverage", { preview: true })
      expect(localizedWrites).toEqual([])
    })
  })

  await independently("No memory selection command was issued by the browser", async () => { expect(memoryWrites).toEqual([]) })
  await independently("Memory pages emitted no JavaScript errors", async () => { expect(diagnostics.pageErrors).toEqual([]) })
  await independently("Memory console contains only verified original coverage refusals", async () => {
    outcomeFailures.assertOnlyExpectedErrors(diagnostics.consoleErrors)
  })
  complete()
  await info.attach("UI63-original-memory-evidence", { contentType: "application/json", body: JSON.stringify({
    area: "UI63", source: "original human decision, memory and Planner HTTP producers",
    caseVersion: seeded.caseRef.version, period: seeded.period,
    browserMemorySelectionCommands: memoryWrites.length,
    outcome: { status: "unavailable", reason: seeded.outcomeReason },
    choicesWithoutConditions: 1, initialConditionCount: seeded.initialConditionCount,
    limitations: ["Original cost coverage remains pending; no numeric expected/observed comparison is claimed.", "R3 accepted nine-component inventories but original decision-compare exceeded the unchanged 40-second deadline.", "No causal effect inferred.", "Actual browser zoom not measured."],
  }, null, 2) })
})

waveFourTest("UI67 · current owner details and refresh remain scoped to the installed context", async ({ page, browser, installation, owner }, info) => {
  const diagnostics = observePage(page)
  await enterFinalMemorySurface(page, owner, installation, installation.origin + "/orchestra/sf-home/context", "Context and access", "UI67")
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
  await captureFinalSurface(page, info, "UI67", "light-desktop-refreshed-context", { preview: true })
  await page.setViewportSize({ width: 320, height: 900 })
  await reflow(page)
  await captureFinalSurface(page, info, "UI67", "light-320-current-context")
  await withFinalMemoryPortuguese(browser, page, installation, async (localized) => {
    await enterFinalMemorySurface(localized, owner, installation, installation.origin + "/orchestra/sf-home/context", "Contexto e acesso", "UI67")
    await expect(localized.getByRole("heading", { name: "Contexto atual", exact: true })).toBeVisible()
    await captureFinalSurface(localized, info, "UI67", "pt-br-dark-desktop-current-context", { preview: true })
  })
  expect(diagnostics.pageErrors).toEqual([])
  expect(diagnostics.consoleErrors).toEqual([])
})

waveFourTest("UI69 · one reviewed summaries save, retained draft and persisted original readback", async ({ page, browser, installation, owner }, info) => {
  const diagnostics = observePage(page)
  const writes: unknown[] = []
  page.on("request", (request) => { if (summaryMutation(request)) writes.push(request.postDataJSON()) })
  const context = await enterFinalMemorySurface(page, owner, installation, installation.origin + "/orchestra/sf-home/administration", "Local administration", "UI69")
  const surface = page.locator('[data-sf-surface="UI69"]')
  await expect(surface).toHaveAttribute("data-sf-owner", "local-operator")
  await expect(surface.locator("[data-sf-admin-access]")).toContainText("You are signed in as the local operator.")
  await expect(surface.locator("[data-sf-admin-state]")).toHaveAttribute("data-sf-admin-state", "unavailable")
  await expect(surface.locator("[data-sf-admin-state]")).toContainText("Notifications and backup history are currently unavailable")
  await expect(surface.locator("[data-sf-backup], [data-sf-notification]")).toHaveCount(0)
  const settings = surface.locator("[data-sf-summary-settings]")
  await expect(settings.getByText("Additional viewer summaries", { exact: true })).toHaveCount(1)
  const summaryGroup = settings.getByRole("group", { name: "Additional viewer summaries", exact: true })
  await expect(summaryGroup.getByRole("checkbox", { name: "All Projects", exact: true })).toBeVisible()
  const version = settings.locator("[data-sf-summary-version]")
  const before = Number(await version.textContent())
  expect(Number.isSafeInteger(before)).toBe(true)
  const projects = settings.locator('input[name="pages"][value="All Projects"]')
  const proposed = !await projects.isChecked()
  await projects.setChecked(proposed)
  const proposedPages = await settings.locator('input[name="pages"]:checked').evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value))
  await captureFinalSurface(page, info, "UI69", "dark-desktop-summary-settings", { preview: true })
  await settings.getByRole("button", { name: "Review changes", exact: true }).click()
  const review = settings.locator('[data-component="sf-change-review"]')
  await expect(review).toBeVisible()
  await expect(settings.locator("[data-sf-summary-form]")).toBeHidden()
  expect(writes).toEqual([])
  await review.getByRole("button", { name: "Revise", exact: true }).click()
  await expect(projects).toBeChecked({ checked: proposed })
  await settings.getByRole("button", { name: "Review changes", exact: true }).click()
  await scheme(page, "light")
  await scrollPageTop(page)
  await captureFinalSurface(page, info, "UI69", "light-desktop-summary-review")
  await page.setViewportSize({ width: 320, height: 900 })
  await reflow(page)
  await reviewActions(page)
  await captureFinalSurface(page, info, "UI69", "light-320-summary-review-actions", { preview: true })
  await review.getByRole("button", { name: "Cancel review", exact: true }).click()
  await expect(projects).toBeChecked({ checked: proposed })
  expect(writes).toEqual([])
  await settings.getByRole("button", { name: "Review changes", exact: true }).click()
  // The command's 200 precedes the original persisted readback; observe that GET
  // before the single save, then retain the original 10s DOM assertions.
  const readback = await observeFinalGet(page, installation.origin,
    installation.mount + "/api/ui/local-admin/summary-settings")
  try {
    const saved = page.waitForResponse((response) => summaryMutation(response.request())).then((response) => response.status())
    await review.getByRole("button", { name: "Save summaries", exact: true }).click()
    expect(await saved).toBe(200)
    const original = await readback.next()
    expect(original.status).toBe(200)
    const result = Schema.decodeUnknownSync(Schema.toType(SfDomain.operations["local-admin.summary-read"].output), {
      onExcessProperty: "error",
    })(original.body)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error("Original summary readback did not return saved settings")
    expect(result.context).toEqual(context.stamp)
    expect(result.value.version).toBe(before + 1)
    expect(result.value.pages).toEqual(proposedPages)
    expect(writes[0]).toMatchObject({ context: context.stamp, version: before, pages: proposedPages })
  } finally { await readback.close() }
  await expect(review).toBeHidden()
  await expect(version).toHaveText(String(before + 1))
  await expect(projects).toBeChecked({ checked: proposed })
  expect(writes).toHaveLength(1)
  await page.setViewportSize({ width: 1440, height: 1100 })
  await enterFinalMemorySurface(page, owner, installation, installation.origin + "/orchestra/sf-home/administration", "Local administration", "UI69")
  await expect(version).toHaveText(String(before + 1))
  await expect(projects).toBeChecked({ checked: proposed })
  await captureFinalSurface(page, info, "UI69", "light-desktop-persisted-summaries")
  await withFinalMemoryPortuguese(browser, page, installation, async (localized) => {
    await enterFinalMemorySurface(localized, owner, installation, installation.origin + "/orchestra/sf-home/administration", "Administração local", "UI69")
    await expect(localized.getByRole("heading", { name: "Resumos adicionais para consulta", exact: true })).toBeVisible()
    const localizedSettings = localized.locator("[data-sf-summary-settings]")
    await expect(localizedSettings.getByText("Resumos adicionais para consulta", { exact: true })).toHaveCount(1)
    await expect(localizedSettings.getByRole("group", { name: "Resumos adicionais para consulta", exact: true })).toBeVisible()
    await expect(localized.locator('input[name="pages"][value="All Projects"]')).toBeChecked({ checked: proposed })
    await captureFinalSurface(localized, info, "UI69", "pt-br-dark-desktop-administration", { preview: true })
  })
  expect(writes).toHaveLength(1)
  expect(diagnostics.pageErrors).toEqual([])
  expect(diagnostics.consoleErrors).toEqual([])
})
