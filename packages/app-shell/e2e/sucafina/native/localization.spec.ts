/**
 * Q02.complete / Q02-AC01 + COPY-01/COPY-02 — installed EN and pt-BR.
 *
 * This verifies a frozen 15-chapter representative per locale and the real
 * settings-language control, not a cartesian locale x theme x viewport test.
 * The app's stored locale id is 'br' while document.lang is 'pt-BR'.
 * Legacy producer labels remain exact English only when classified by COPY-01
 * as legacy-source-copy-preserved; new UI copy has both frozen translations.
 * No fake dictionaries, hidden screenshot fallback, skip or test-side mutation.
 */
import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { nativeInstalledFixture } from "./fixture.ts"
import type { InstalledNativeHarness } from "./fixture.ts"

const test = nativeInstalledFixture
test.use({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" })
test.describe.configure({ mode: "default", retries: 0 })

// Exactly one real frozen entry route/title per each of the fifteen chapters.
// Literal source: execution/surface-manifest.json titleCopy (no invented labels).
const chapters = [
  { id: "CAP01", chapter: "sf-dashboard", route: "/orchestra/sf-dashboard/executive", en: "Executive Dashboard", br: "Visão executiva" },
  { id: "CAP06", chapter: "sf-people", route: "/orchestra/sf-people/overview", en: "Headcount Overview", br: "Visão de headcount" },
  { id: "CAP09", chapter: "sf-portfolio", route: "/orchestra/sf-portfolio/overview", en: "Portfolio Dashboard", br: "Visão do portfólio" },
  { id: "CAP11", chapter: "sf-operations", route: "/orchestra/sf-operations/service", en: "IT Operations", br: "Serviço de TI" },
  { id: "CAP14", chapter: "sf-procurement", route: "/orchestra/sf-procurement/contracts", en: "Vendor Contracts", br: "Contratos com fornecedores" },
  { id: "CAP17", chapter: "sf-planner", route: "/orchestra/sf-planner/overview", en: "Overview", br: "Visão do Planner" },
  { id: "UI29", chapter: "sf-home", route: "/orchestra/sf-home", en: "Today", br: "Hoje" },
  { id: "UI30", chapter: "sf-work", route: "/orchestra/sf-work", en: "My work", br: "Meu trabalho" },
  { id: "UI33", chapter: "sf-decisions", route: "/orchestra/sf-decisions", en: "Decisions", br: "Decisões" },
  { id: "UI45", chapter: "sf-bi", route: "/orchestra/sf-bi", en: "Analytics", br: "Análises" },
  { id: "UI47", chapter: "sf-reviews", route: "/orchestra/sf-reviews/agenda", en: "Meeting agenda", br: "Pauta da reunião" },
  { id: "UI55", chapter: "sf-imports", route: "/orchestra/sf-imports/new", en: "Import file", br: "Importar arquivo" },
  { id: "UI58", chapter: "sf-documents", route: "/orchestra/sf-documents", en: "Documents", br: "Documentos" },
  { id: "UI61", chapter: "sf-memory", route: "/orchestra/sf-memory/signals", en: "Signals", br: "Sinais" },
  { id: "UI64", chapter: "sf-routines", route: "/orchestra/sf-routines", en: "Routines", br: "Rotinas" },
] as const
const locales = [
  { id: "en", value: "en", label: "English", documentLang: "en" },
  { id: "pt-BR", value: "br", label: "Português (Brasil)", documentLang: "pt-BR" },
] as const

async function requireInstalled(page: Page, harness: InstalledNativeHarness) {
  const target = harness.manifest.target
  expect((await page.goto(new URL(target.chapterHref, target.shellOrigin).href))?.status()).toBe(200)
  const observation = await harness.proveWeb(page.getByRole("main"))
  expect(observation.proofClass).toBe("WEB_INSTALLED_CONTEXT_OBSERVED")
  expect(observation.candidateSha).toBe(harness.manifest.candidateSha)
  return target.shellOrigin
}

async function changeLocale(page: Page, origin: string, target: (typeof locales)[number]) {
  const settings = await page.goto(new URL("/orchestra/settings?section=general", origin).href)
  expect(settings?.status()).toBe(200)
  // Source: SettingsGeneralV2 LanguageSetting / SelectV2 at data-action
  // settings-language; desktop-native locale labels 'en' and 'br'.
  const control = page.locator('[data-action="settings-language"]')
  await expect(control, "Actual Orchestra locale selector, not localStorage injection").toBeVisible()
  await control.click()
  const choice = page.getByRole("option", { name: target.label, exact: true })
  await expect(choice).toBeVisible()
  await choice.click()
  await expect(page.locator("html")).toHaveAttribute("lang", target.documentLang)
  const stored = await page.evaluate(() => {
    const value = localStorage.getItem("orchestra.global.dat:language")
    if (!value) return null
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === "object" && "locale" in parsed ? parsed.locale : null
  })
  expect(stored, "Selected locale must persist through public app settings").toBe(target.value)
}

for (const locale of locales) {
  for (const chapter of chapters) {
    test("Q02-COPY-01 installed " + chapter.chapter + "/" + chapter.id + " renders " + locale.id + " title", async ({ page, nativeHarness }, testInfo) => {
      const origin = await requireInstalled(page, nativeHarness)
      await changeLocale(page, origin, locale)
      expect((await page.goto(new URL(chapter.route, origin).href))?.status()).toBe(200)
      const frame = page.locator('[data-sf-frame="page"]')
      await expect(frame).toBeVisible()
      await expect(frame.getByRole("heading", {
        level: 1, name: locale.id === "en" ? chapter.en : chapter.br, exact: true,
      })).toBeVisible()
      await expect(page.locator("html")).toHaveAttribute("lang", locale.documentLang)
      await testInfo.attach("q02-copy-provenance.json", {
        contentType: "application/json",
        body: Buffer.from(JSON.stringify({
          class: "INSTALLED_COPY_OBSERVATION_NOT_ALL_ACTIONS_TRANSLATED",
          candidate: nativeHarness.manifest.candidateSha,
          chapter: chapter.chapter, surface: chapter.id, locale: locale.id,
          source: "surface-manifest.json#titleCopy", policy: "COPY-01",
        })),
      })
    })
  }
}

for (const locale of locales) {
  test("Q02-COPY-01 source-English Title + translated review action · " + locale.id, async ({ page, nativeHarness }) => {
    const origin = await requireInstalled(page, nativeHarness)
    // W19/U11.title-save source field label is frozen English 'Title' in
    // BOTH locales (legacy-source-copy-preserved), while the new review label
    // is the frozen translated copy. One isolated test/context per locale
    // prevents unsaved-draft navigation from silently discarding a local edit.
    await changeLocale(page, origin, locale)
    await page.goto(new URL("/orchestra/sf-procurement/requests", origin).href)
    const item = page.getByRole("link", { name: "F04 real domain P0 draft title", exact: true })
    await expect(item, "F04 real seeded draft must be authorized for requester").toBeVisible()
    await item.click()
    const editor = page.locator('[data-component="sf-request-title-save"]')
    const field = editor.getByRole("textbox", { name: "Title", exact: true })
    await expect(field).toBeEditable()
    const change = editor.getByRole("button", {
      name: locale.id === "en" ? "Review title change" : "Revisar alteração do título",
      exact: true,
    })
    await field.fill("Q02 locale-only unsaved draft")
    await expect(change).toBeEnabled()
    await expect(page.locator("html")).toHaveAttribute("lang", locale.documentLang)
    // Deliberately no Save/submit/approve: this is copy, not mutation proof.
  })
}

test("Q02-COPY-01 no raw CAP/UI requirement ids in visible navigation copy", async ({ page, nativeHarness }) => {
  const origin = await requireInstalled(page, nativeHarness)
  await changeLocale(page, origin, locales[1])
  await page.goto(new URL("/orchestra/sf-home", origin).href)
  const frame = page.locator('[data-sf-frame="page"]')
  await expect(frame).toBeVisible()
  const headingsAndLinks = await frame.locator("h1,h2,h3,nav a,nav button").allTextContents()
  expect(headingsAndLinks.length).toBeGreaterThan(0)
  for (const label of headingsAndLinks) {
    expect(label.trim(), "Product labels must not use CAP/UI/WP IDs as names").not.toMatch(/^(?:CAP\d+|UI\d+|WP\d+(?:\.T\d+)?)$/)
  }
})

test("Q02-COPY-02 desktop connect consent en/pt-BR requires installed D01 native main", async ({ nativeHarness }) => {
  expect(
    String(nativeHarness.desktop),
    "Q02_BLOCKED_INTEGRATION: Electron app.getLocale native consent and Cancel-first must be observed, not inferred from web copy",
  ).not.toBe("NOT_RUN_D01_REAL_ELECTRON_REQUIRED")
  // D01 must expose an authenticated Electron main/preload proof adapter; F04
  // currently publishes no callable desktop API. Cannot use a browser dialog
  // or synthetic locale to prove native Cancel/Connect order and Escape.
  throw new Error("Q02_BLOCKED_CONTRACT: D01 native desktop consent proof API unavailable")
})
