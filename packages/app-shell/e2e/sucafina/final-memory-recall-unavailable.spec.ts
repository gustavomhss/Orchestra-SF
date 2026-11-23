import { expect } from "@playwright/test"
import type { Browser, Page, Request, TestInfo } from "@playwright/test"
import { Schema } from "effect"
import { SfIntelligenceMemorySimilarCases } from "@orchestra/schema/sucafina/memory"
import type { DesignInstallation } from "./design-support/installation"
import { waveFourTest, scheme, reflow, scrollPageTop, observePage } from "./design-support/wave-four"
import { captureFinalSurface } from "./design-support/final-capture"
import { seedFinalMemory } from "./design-support/final-memory-seed"
import { enterFinalMemorySurface } from "./design-support/final-memory-browser"
import { observeFinalGet } from "./design-support/final-navigation"
import { observeFinalMemoryRecall } from "./design-support/final-memory-recall"
import { waveFourDecisionsData } from "./design-support/wave-four-decisions-data"

// Qualify the exact original refusal proved in R16. The positive 200/match
// assertions remain unchanged in final-memory.spec.ts.
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


type Owner = Parameters<typeof enterFinalMemorySurface>[1]
type Seeded = Awaited<ReturnType<typeof seedInstalledMemory>>
type Locale = "en" | "br"
const refusalCopy = {
  en: "The memory source did not complete this consultation. Your question and selected authorized cases remain on this screen. You can try again.",
  br: "A fonte de memória não concluiu esta consulta. Sua pergunta e os casos autorizados selecionados continuam nesta tela. Você pode tentar novamente.",
} as const

async function exerciseOriginalRefusal(input: {
  page: Page; owner: Owner; installation: DesignInstallation; seeded: Seeded; locale: Locale; info: TestInfo;
}) {
  const { page, owner, installation, seeded, locale, info } = input
  const br = locale === "br"
  const diagnostics = observePage(page)
  const errors: { text: string; url: string }[] = []
  page.on("console", (message) => {
    if (message.type() === "error") errors.push({ text: message.text(), url: message.location().url })
  })
  const requests: Request[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (request.method() === "POST" && url.origin === installation.origin &&
        url.pathname === installation.mount + "/dashboard" && url.searchParams.get("sf") === "memory-similar-cases")
      requests.push(request)
  })
  const writes = observeMemoryCommands(page, installation.origin)
  await page.setViewportSize({ width: 1440, height: 1100 })
  await enterFinalMemorySurface(page, owner, installation,
    installation.origin + "/orchestra/sf-memory/cases", br ? "Casos semelhantes" : "Similar cases", "UI62")
  await scheme(page, "dark")
  const surface = page.locator('[data-sf-surface="UI62"]')
  const source = surface.getByLabel(br ? "Caso de decisão original" : "Original decision case", { exact: true })
  const caseRead = await observeFinalGet(page, installation.origin, installation.mount + "/api/ui/projections/case", 1,
    (url) => url.searchParams.get("caseRef") === seeded.reference)
  try {
    await source.selectOption(seeded.reference)
    const original = await caseRead.next()
    expect(original.status).toBe(200)
    expect(original.body).toMatchObject({ status: "ok", value: { projection: { case: seeded.caseRef } } })
  } finally { await caseRead.close() }

  const question = surface.getByLabel(br ? "Pergunta para recuperar memória" : "Recall question", { exact: true })
  const query = br ? "Revisar a decisão original de renovação regional e sua cobertura de custos pendente." :
    "Review the original regional service renewal decision and its pending cost coverage."
  await question.fill(query)
  const candidate = surface.getByRole("checkbox", { name: new RegExp(waveFourDecisionsData.objective) })
  await expect(candidate).toHaveCount(1)
  const encodedCandidate = await candidate.inputValue()
  const parsed = /^case:([^:]+):([^:]+)$/.exec(encodedCandidate)
  const version = /:\s*(\d+)\s*$/.exec(await candidate.locator("..").textContent() ?? "")
  if (!parsed || !version) throw new Error("The original authorized candidate omitted its case identity/version")
  const selectedCandidate = {
    id: decodeURIComponent(parsed[1]!), incarnation: decodeURIComponent(parsed[2]!), version: Number(version[1]),
  }
  expect(Number.isSafeInteger(selectedCandidate.version) && selectedCandidate.version > 0).toBe(true)
  await candidate.check()
  const submit = surface.getByRole("button", { name: br ? "Buscar casos semelhantes" : "Find similar cases", exact: true })
  await expect(submit).toBeEnabled()
  expect(requests).toEqual([])

  const observed = await observeFinalMemoryRecall(page, installation)
  let original: Awaited<ReturnType<typeof observed.next>>
  try {
    await submit.click()
    original = await observed.next()
  } finally { await observed.close() }
  expect(original.status).toBe(503)
  const result = Schema.decodeUnknownSync(Schema.toType(SfIntelligenceMemorySimilarCases.output), {
    onExcessProperty: "error",
  })(original.result)
  expect(result).toEqual({ status: "unavailable", reason: "similarity-source-unavailable" })
  const payload = Schema.decodeUnknownSync(Schema.toType(SfIntelligenceMemorySimilarCases.input), {
    onExcessProperty: "error",
  })(original.body)
  expect(payload).toEqual({
    caseId: seeded.caseRef.id, incarnation: seeded.caseRef.incarnation, version: seeded.caseRef.version,
    query, period: seeded.period, includeHistorical: false, candidates: [selectedCandidate],
  })
  expect(requests).toHaveLength(1)
  expect(requests[0]!.url()).toBe(original.url)
  expect(requests[0]!.postDataJSON()).toEqual(payload)
  expect([...new URL(original.url).searchParams.keys()]).toEqual(["sf"])
  expect(new URL(original.url).searchParams.has("query")).toBe(false)
  expect(page.url()).not.toContain(encodeURIComponent(query))
  await expect(surface).toHaveAttribute("data-sf-memory-recall-state", "unavailable")
  await expect(surface).toHaveAttribute("data-sf-memory-recall-reason", "similarity-source-unavailable")
  await expect(surface.getByText(refusalCopy[locale], { exact: true })).toBeVisible()
  await expect(source).toHaveValue(seeded.reference)
  await expect(question).toHaveValue(query)
  await expect(candidate).toBeChecked()
  await expect(submit).toBeEnabled()
  await expect(surface.locator("[data-sf-similar-matches], [data-sf-similar-detail], [data-sf-similar-case]")).toHaveCount(0)
  const empty = br ? "Nenhum caso semelhante autorizado foi retornado para esta seleção." :
    "No authorized matching cases were returned for this selection."
  await expect(surface.getByText(empty, { exact: true })).toHaveCount(0)
  expect(requests).toHaveLength(1)

  await scrollPageTop(page)
  await surface.getByText(refusalCopy[locale], { exact: true }).scrollIntoViewIfNeeded()
  await captureFinalSurface(page, info, "UI62", locale + "-dark-desktop-original-source-unavailable", { preview: true })
  await scheme(page, "light")
  await captureFinalSurface(page, info, "UI62", locale + "-light-desktop-original-source-unavailable", { preview: !br })
  await page.setViewportSize({ width: 320, height: 900 })
  await reflow(page)
  await surface.getByText(refusalCopy[locale], { exact: true }).scrollIntoViewIfNeeded()
  await captureFinalSurface(page, info, "UI62", locale + "-light-320-original-source-unavailable", { preview: true })

  // Editing the local selection clears the old refusal without submitting again.
  await question.fill(query + (br ? " Conferir a fonte atual." : " Check the current source."))
  await expect(surface).not.toHaveAttribute("data-sf-memory-recall-reason", /.+/)
  await expect(surface.getByText(refusalCopy[locale], { exact: true })).toHaveCount(0)
  await expect(candidate).toBeChecked()
  await expect(surface.locator("[data-sf-similar-matches], [data-sf-similar-detail]")).toHaveCount(0)
  expect(requests).toHaveLength(1)
  await source.selectOption("")
  await expect(source).toHaveValue("")
  await expect(surface).not.toHaveAttribute("data-sf-memory-recall-reason", /.+/)
  await expect(question).toHaveCount(0)
  await expect(surface.locator("[data-sf-similar-matches], [data-sf-similar-detail]")).toHaveCount(0)
  expect(requests).toHaveLength(1)
  expect(writes).toEqual([])

  // Only this one verified original refusal can explain a browser 503 diagnostic.
  // No global error helper or generic 503 allowance is modified.
  const assertDiagnostics = () => {
    expect(diagnostics.pageErrors).toEqual([])
    expect(diagnostics.consoleErrors).toEqual(errors.map((error) => error.text))
    expect(errors.length).toBeLessThanOrEqual(1)
    for (const error of errors) {
      expect(error.url).toBe(requests[0]!.url())
      expect(error.url).toBe(original.url)
      expect(error.text).toBe("Failed to load resource: the server responded with a status of 503 (Service Unavailable)")
    }
  }
  assertDiagnostics()
  console.info("SF_FINAL_MEMORY_REFUSAL_QUALIFIED " + JSON.stringify({
    locale, status: original.status, reason: "similarity-source-unavailable", closedSchema: true,
    originalPostCount: requests.length, queryKeptOffUrl: true, noInventedMatches: true,
    consoleErrors: errors.length, sourceCause: "not-attributed",
  }))
  await info.attach("UI62-" + locale + "-original-source-refusal", {
    contentType: "application/json", body: JSON.stringify({
      area: "UI62", locale, originalResponse: result, originalPostCount: requests.length,
      caseVersion: seeded.caseRef.version, queryKeptOffUrl: true,
      selectionRetainedUntilEdited: true, selectionCleared: true, matchedCases: "not-returned",
      positiveRecallQualified: false, exclusiveInternalCause: "not-established",
      limitations: ["The original positive 200/match assertions remain in final-memory.spec.ts.", "Actual browser zoom was not measured."],
    }, null, 2),
  })
  return { assertDiagnostics, requests }
}

async function withRecallPortuguese(
  browser: Browser, original: Page, installation: DesignInstallation, run: (page: Page) => Promise<void>,
) {
  const cookies = await original.context().cookies(installation.origin + installation.mount)
  const context = await browser.newContext({
    locale: "pt-BR", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
    reducedMotion: "reduce", colorScheme: "dark",
    httpCredentials: { username: "orchestra", password: installation.serverPassword },
    storageState: { cookies, origins: [{ origin: installation.origin,
      localStorage: [{ name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) }] }] },
  })
  try {
    const page = await context.newPage()
    page.setDefaultTimeout(15_000)
    await run(page)
  } finally { await context.close() }
}

waveFourTest("UI62 · exact original source refusal retains private selections without inventing matches",
  async ({ page, browser, installation, owner }, info) => {
    const seeded = await seedInstalledMemory(page, installation)
    const english = await exerciseOriginalRefusal({ page, owner, installation, seeded, locale: "en", info })
    await withRecallPortuguese(browser, page, installation, async (localized) => {
      await exerciseOriginalRefusal({ page: localized, owner, installation, seeded, locale: "br", info })
    })
    english.assertDiagnostics()
    expect(english.requests).toHaveLength(1)
  })
