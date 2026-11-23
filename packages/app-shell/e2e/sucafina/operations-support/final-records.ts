import { expect } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"
import { captureFinalSurface } from "../design-support/final-capture"

type RecordArea = "UI57" | "UI58" | "UI59" | "UI60" | "UI68"

async function theme(page: Page, value: "dark" | "light") {
  const html = page.locator("html")
  await expect(html).toHaveAttribute("data-color-scheme", /^(dark|light)$/)
  if (await html.getAttribute("data-color-scheme") !== value)
    await page.locator('[data-slot="orchestra-theme-toggle"]').click()
  await expect(html).toHaveAttribute("data-color-scheme", value)
}

export async function captureRecord(page: Page, info: TestInfo, area: RecordArea, state: string,
  preview = false) {
  const scroller = page.locator('[data-sf-frame="page"] .mx-page')
  await scroller.evaluate((element) => element.scrollTo({ top: 0, left: 0, behavior: "instant" }))
  await expect.poll(() => scroller.evaluate((element) => element.scrollWidth - element.clientWidth),
    { message: area + " native page content fits its available width" }).toBeLessThanOrEqual(1)
  await captureFinalSurface(page, info, area, state, { preview })
}

/** Read the same actual state through the native theme toggle and two viewport widths. */
export async function captureRecordVariants(page: Page, info: TestInfo, area: RecordArea, state: string) {
  const original = page.viewportSize()
  const previous = await page.locator("html").getAttribute("data-color-scheme")
  await page.setViewportSize({ width: 1440, height: 1100 })
  await theme(page, "dark")
  await captureRecord(page, info, area, state + "-dark-desktop", true)
  await theme(page, "light")
  await captureRecord(page, info, area, state + "-light-desktop")
  await page.setViewportSize({ width: 320, height: 900 })
  await captureRecord(page, info, area, state + "-light-narrow")
  if (original) await page.setViewportSize(original)
  await theme(page, previous === "light" ? "light" : "dark")
}

/** Reuse the same authorized session with the native persisted language preference. */
export async function capturePortugueseRecord(page: Page, info: TestInfo, area: RecordArea,
  state: string, prepare?: (localized: Page) => Promise<void>) {
  const browser = page.context().browser()
  if (!browser) throw new Error("The localized record needs the installed browser")
  const origin = new URL(page.url()).origin
  const storage = await page.context().storageState()
  const known = storage.origins.find((entry) => entry.origin === origin)
  const preference = { name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) }
  if (known) known.localStorage = [...known.localStorage.filter((entry) => entry.name !== preference.name), preference]
  else storage.origins.push({ origin, localStorage: [preference] })
  const context = await browser.newContext({
    locale: "pt-BR", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
    colorScheme: "dark", reducedMotion: "reduce", storageState: storage,
  })
  try {
    const localized = await context.newPage()
    expect((await localized.goto(page.url()))?.status()).toBe(200)
    const surface = localized.locator('[data-sf-surface="' + area + '"]')
    await expect(surface).toBeVisible()
    await expect(surface).toHaveAttribute("data-sf-read-state", "ready")
    await prepare?.(localized)
    const titles = { UI57: "Resultado da importação", UI58: "Documentos", UI59: "Evidência do documento",
      UI60: "Evidência no cenário", UI68: "Exportações" }
    await expect(localized.getByRole("heading", { level: 1, name: titles[area], exact: true })).toBeVisible()
    await theme(localized, "dark")
    await captureRecord(localized, info, area, state + "-pt-br-desktop", true)
  } finally {
    await context.close()
  }
}
