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

