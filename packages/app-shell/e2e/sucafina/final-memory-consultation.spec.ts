import { expect } from "@playwright/test"
import type { Page, Request, TestInfo } from "@playwright/test"
import type { DesignInstallation } from "./design-support/installation"
import { waveFourTest, scheme, reflow, scrollPageTop, observePage } from "./design-support/wave-four"
import { captureFinalSurface } from "./design-support/final-capture"
import { finalMemoryData, seedFinalMemory } from "./design-support/final-memory-seed"
import { enterFinalMemorySurface, withFinalMemoryPortuguese } from "./design-support/final-memory-browser"
import { observeFinalGet } from "./design-support/final-navigation"

// These two installations qualify interruption of the browser's wait.
// The positive materiality/recall assertions in final-memory.spec.ts remain intact.
waveFourTest.use({ designWave: "four-decisions" })
waveFourTest.beforeEach(async ({ page }, info) => {
  waveFourTest.setTimeout(300_000)
  page.setDefaultTimeout(15_000)
  expect(info.project.metadata.bundle).toBe("production")
})

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


type SeededMemory = Awaited<ReturnType<typeof seedInstalledMemory>>
type Consultation = "materiality" | "signals"
type Locale = "en" | "br"

function isConsultation(request: Request, installation: DesignInstallation, seeded: SeededMemory, kind?: Consultation) {
  const url = new URL(request.url())
  return request.method() === "GET" && url.origin === installation.origin &&
    url.pathname === installation.mount + "/dashboard" &&
    (kind ? url.searchParams.get("sf") === "memory-" + kind :
      ["memory-materiality", "memory-signals"].includes(url.searchParams.get("sf") ?? "")) &&
    url.searchParams.get("caseId") === seeded.caseRef.id &&
    url.searchParams.get("incarnation") === seeded.caseRef.incarnation &&
    url.searchParams.get("version") === String(seeded.caseRef.version)
}

function observeConsultations(page: Page, installation: DesignInstallation, seeded: SeededMemory) {
  const requests: Request[] = []
  page.on("request", (request) => { if (isConsultation(request, installation, seeded)) requests.push(request) })
  return requests
}

async function readCondition(
  page: Page, installation: DesignInstallation, seeded: SeededMemory, conditionId: string, locale: Locale,
) {
  const surface = page.locator('[data-sf-surface="UI61"]')
  const picker = surface.getByRole("combobox", { name: locale === "br" ? "Caso autorizado" : "Authorized case", exact: true })
  await expect(picker.locator("option", { hasText: finalMemoryData.objective })).toHaveCount(1)
  await picker.selectOption(seeded.reference)
  const conditions = await observeFinalGet(page, installation.origin, installation.mount + "/dashboard", 1, (url) =>
    url.searchParams.get("sf") === "memory-conditions" &&
    url.searchParams.get("caseId") === seeded.caseRef.id &&
    url.searchParams.get("incarnation") === seeded.caseRef.incarnation &&
    url.searchParams.get("version") === String(seeded.caseRef.version))
  try {
    await surface.getByRole("button", { name: locale === "br" ? "Consultar caso autorizado" : "Read authorized case", exact: true }).click()
    const original = await conditions.next()
    expect(original.status).toBe(200)
    expect(original.body).toMatchObject({ status: "ok" })
  } finally { await conditions.close() }
  await expect(surface.locator("[data-sf-condition-id]")).toHaveCount(1)
  await expect(surface.locator('[data-sf-condition-id="' + conditionId + '"]')).toContainText(finalMemoryData.condition)
  await expect(surface.locator("[data-sf-memory-signals-state]")).toHaveAttribute("data-sf-memory-signals-state", "idle")
  await expect(surface.locator("[data-sf-memory-materiality]")).toHaveCount(0)
}

async function cancelNativeConsultation(input: {
  page: Page; installation: DesignInstallation; seeded: SeededMemory; conditionId: string;
  kind: Consultation; locale: Locale; requests: Request[]; info: TestInfo;
}) {
  const { page, installation, seeded, conditionId, kind, locale, requests, info } = input
  const br = locale === "br"
  const surface = page.locator('[data-sf-surface="UI61"]')
  const condition = surface.locator('[data-sf-condition-id="' + conditionId + '"]')
  const attribute = "data-sf-memory-" + kind + "-state"
  const state = surface.locator("[" + attribute + "]")
  const initialName = kind === "materiality" ? (br ? "Revisar condição" : "Review condition") :
    (br ? "Consultar sinais atuais" : "Read current signals")
  const initial = (kind === "materiality" ? condition : state).getByRole("button", { name: initialName, exact: true })
  const cancelName = kind === "materiality" ?
    (br ? "Cancelar consulta de materialidade" : "Cancel materiality consultation") :
    (br ? "Cancelar consulta de sinais" : "Cancel signal consultation")
  const againName = kind === "materiality" ? (br ? "Consultar materialidade" : "Read materiality") : initialName
  const cancelledCopy = kind === "materiality" ?
    (br ? "Consulta de materialidade interrompida nesta tela. Nenhum resultado atual foi recebido. Você pode consultar novamente." :
      "Materiality consultation stopped in this view. No current result was received. You can check again.") :
    (br ? "Consulta interrompida nesta tela. Nenhum resultado atual foi recebido. Você pode consultar novamente." :
      "Signal consultation stopped in this view. No current result was received. You can check again.")
  const emptyCopy = br ? "Nenhum sinal de materialidade registrado para este caso autorizado." :
    "No materiality signals are recorded for this authorized case."

  // All original conditions and language reads completed before this expensive request.
  // No route.fetch handler observes this request: cancellation must reach the browser's fetch.
  await page.setViewportSize({ width: 1440, height: 1100 })
  await scheme(page, "dark")
  expect(requests).toEqual([])
  const requested = page.waitForRequest((request) => isConsultation(request, installation, seeded, kind), { timeout: 40_000 })
  await initial.click()
  const request = await requested
  if (kind === "materiality") expect(new URL(request.url()).searchParams.get("conditionId")).toBe(conditionId)
  await expect(state).toHaveAttribute(attribute, "loading")
  await expect(initial).toBeDisabled()
  await expect(state.getByRole("button", { name: cancelName, exact: true })).toBeEnabled()
  await expect(condition).toContainText(finalMemoryData.condition)
  await expect(surface.locator("[data-sf-memory-materiality]")).toHaveCount(0)
  await expect(surface.getByText(emptyCopy, { exact: true })).toHaveCount(0)
  if (kind === "materiality") {
    await expect(condition.getByRole("button", { name: initialName, exact: true })).toHaveAttribute("aria-expanded", "true")
    await expect(surface.locator("[data-sf-memory-signals-state]")).toHaveAttribute("data-sf-memory-signals-state", "idle")
  }
  expect(requests).toHaveLength(1)
  const cancelled = page.waitForEvent("requestfailed", { predicate: (failed) => failed === request, timeout: 40_000 })
  await state.getByRole("button", { name: cancelName, exact: true }).click()
  const failed = await cancelled
  expect(failed.failure()?.errorText).toMatch(/ERR_ABORTED|NS_BINDING_ABORTED/)
  await expect(state).toHaveAttribute(attribute, "cancelled")
  await expect(state).toContainText(cancelledCopy)
  await expect(state.getByRole("button", { name: againName, exact: true })).toBeEnabled()
  if (kind === "materiality") await expect(state.getByRole("button", { name: againName, exact: true })).toBeFocused()
  await expect(state.getByRole("button", { name: cancelName, exact: true })).toHaveCount(0)
  await expect(condition).toContainText(finalMemoryData.condition)
  await expect(surface.locator("[data-sf-memory-materiality]")).toHaveCount(0)
  await expect(surface.getByText(emptyCopy, { exact: true })).toHaveCount(0)
  expect(requests).toHaveLength(1)
  expect(requests[0]).toBe(request)

  // Only local presentation and selection assertions follow the native abortion.
  // This does not claim that source reconciliation stopped or that any mutation rolled back.
  await state.scrollIntoViewIfNeeded()
  await captureFinalSurface(page, info, "UI61", locale + "-dark-desktop-" + kind + "-local-cancel", { preview: true })
  await scheme(page, "light")
  await page.setViewportSize({ width: 320, height: 900 })
  await reflow(page)
  await state.scrollIntoViewIfNeeded()
  await captureFinalSurface(page, info, "UI61", locale + "-light-320-" + kind + "-local-cancel", { preview: true })
  await surface.locator("[data-sf-memory-case]").selectOption("")
  await expect(surface.locator("[data-sf-condition-id]")).toHaveCount(0)
  await expect(surface.locator("[data-sf-memory-signals-state]")).toHaveCount(0)
  await expect(surface.locator("[data-sf-memory-materiality-state]")).toHaveCount(0)
  await expect(surface.locator("[data-sf-memory-materiality]")).toHaveCount(0)
  await expect(surface.getByRole("button", { name: br ? "Consultar caso autorizado" : "Read authorized case", exact: true })).toBeDisabled()
  expect(requests).toHaveLength(1)

  console.info("SF_FINAL_MEMORY_NATIVE_CANCEL " + JSON.stringify({
    kind, locale, requestCount: requests.length, browserAbort: failed.failure()?.errorText,
    localState: "cancelled", originalResultQualified: false, sourceReconciliationStopped: "not-claimed",
  }))
  await info.attach("UI61-" + kind + "-native-local-cancellation", {
    contentType: "application/json", body: JSON.stringify({
      area: "UI61", kind, locale, originalRequests: requests.length, browserAbort: failed.failure()?.errorText,
      conditionsRetainedUntilSelectionChanged: true, selectionCleared: true, originalResultQualified: false,
      limitations: [
        "Cancellation interrupts this view's wait; it does not establish that source reconciliation stopped.",
        "No late source response was supplied or claimed as exercised; controller and owner fences are reviewed in source.",
        "The positive materiality assertions remain in final-memory.spec.ts and are not qualified by this cancellation test.",
        "Actual browser zoom was not measured.",
      ],
    }, null, 2),
  })
}

for (const kind of ["materiality", "signals"] as const) {
  waveFourTest("UI61 · native " + kind + " consultation cancellation in its own installation",
    async ({ page, browser, installation, owner }, info) => {
      const diagnostics = observePage(page)
      const seeded = await seedInstalledMemory(page, installation)
      const registered = await seeded.registerCondition()
      const writes = observeMemoryCommands(page, installation.origin)
      const requests = observeConsultations(page, installation, seeded)
      await page.setViewportSize({ width: 1440, height: 1100 })
      await enterFinalMemorySurface(page, owner, installation,
        installation.origin + "/orchestra/sf-memory/signals", "Signals", "UI61")
      await scheme(page, "dark")
      await expect(page.locator('[data-sf-surface="UI61"]')).toHaveAttribute("data-sf-wave", "six")
      await readCondition(page, installation, seeded, registered.conditionId, "en")
      expect(requests).toEqual([])
      await scrollPageTop(page)
      await captureFinalSurface(page, info, "UI61", "en-dark-desktop-" + kind + "-conditions-before-consultation", { preview: true })
      await scheme(page, "light")
      await captureFinalSurface(page, info, "UI61", "en-light-desktop-" + kind + "-conditions-before-consultation")
      await page.setViewportSize({ width: 320, height: 900 })
      await reflow(page)
      await captureFinalSurface(page, info, "UI61", "en-light-320-" + kind + "-conditions-before-consultation")

      await withFinalMemoryPortuguese(browser, page, installation, async (localized) => {
        const localizedWrites = observeMemoryCommands(localized, installation.origin)
        const localizedRequests = observeConsultations(localized, installation, seeded)
        await enterFinalMemorySurface(localized, owner, installation,
          installation.origin + "/orchestra/sf-memory/signals", "Sinais", "UI61")
        await readCondition(localized, installation, seeded, registered.conditionId, "br")
        await expect(localized.getByRole("button", { name: "Consultar sinais atuais", exact: true })).toBeEnabled()
        expect(localizedRequests).toEqual([])
        await captureFinalSurface(localized, info, "UI61", "pt-br-dark-desktop-" + kind + "-conditions-before-consultation", { preview: true })
        if (kind === "signals") {
          await cancelNativeConsultation({ page: localized, installation, seeded, conditionId: registered.conditionId,
            kind, locale: "br", requests: localizedRequests, info })
        }
        expect(localizedWrites).toEqual([])
      })
      if (kind === "materiality") {
        await cancelNativeConsultation({ page, installation, seeded, conditionId: registered.conditionId,
          kind, locale: "en", requests, info })
      } else expect(requests).toEqual([])
      expect(writes).toEqual([])
      expect(diagnostics.pageErrors).toEqual([])
      expect(diagnostics.consoleErrors).toEqual([])
    })
}
