/**
 * Snapshot-only diagnosis, copied from the unchanged UI62 journey at cf18f92.
 * This isolated reproduction is not qualification. The original spec, fixtures,
 * helpers, time bounds, actions and assertions remain unchanged.
 */
import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import type { DesignInstallation } from "./design-support/installation"
import { waveFourTest, scheme, reflow, observePage } from "./design-support/wave-four"
import { captureFinalSurface } from "./design-support/final-capture"
import { seedFinalMemory } from "./design-support/final-memory-seed"
import { enterFinalMemorySurface, observeFinalMemoryOutcomeFailures, withFinalMemoryPortuguese } from "./design-support/final-memory-browser"
import { waveFourDecisionsData } from "./design-support/wave-four-decisions-data"
import { observeFinalGet } from "./design-support/final-navigation"
import { observeFinalMemoryRecall } from "./design-support/final-memory-recall"

waveFourTest.use({ designWave: "four-decisions" })
waveFourTest.beforeEach(async ({ page }, info) => {
  waveFourTest.setTimeout(300_000)
  page.setDefaultTimeout(15_000)
  expect(info.project.metadata.bundle).toBe("production")
})

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

waveFourTest("[diagnostic] UI62 · private authorized case recall in an isolated installation", async ({ page, browser, installation, owner }, info) => {
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
