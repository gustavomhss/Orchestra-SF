/**
 * Q02.complete / Q02-AC01 + Q02-AC03 — finite installed visual matrix.
 * 15 chapter entry bindings x Dark/Light; the other five palettes are checked
 * once on shared presentation state/tokens. Not 70 x 7 x widths x states.
 *
 * The snapshots are intentionally REVIEWER-APPROVED baselines. Missing snapshot,
 * installed F04 host, actual palette control or chapter binding FAILS; this file
 * never updates/auto-accepts snapshots or treats a design fixture as installed.
 * References: SURFACE-SPECS LAYOUT-01, A11Y-01, COPY-01; surface-manifest.json.
 */
import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { nativeInstalledFixture } from "./fixture.ts"
import type { InstalledNativeHarness } from "./fixture.ts"

const test = nativeInstalledFixture
test.use({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" })
test.describe.configure({ mode: "default", retries: 0 })

// First entry per chapter, exactly the frozen surface-manifest route/title.
const chapters = [
  { chapter: "sf-dashboard", surface: "CAP01", route: "/orchestra/sf-dashboard/executive", en: "Executive Dashboard" },
  { chapter: "sf-people", surface: "CAP06", route: "/orchestra/sf-people/overview", en: "Headcount Overview" },
  { chapter: "sf-portfolio", surface: "CAP09", route: "/orchestra/sf-portfolio/overview", en: "Portfolio Dashboard" },
  { chapter: "sf-operations", surface: "CAP11", route: "/orchestra/sf-operations/service", en: "IT Operations" },
  { chapter: "sf-procurement", surface: "CAP14", route: "/orchestra/sf-procurement/contracts", en: "Vendor Contracts" },
  { chapter: "sf-planner", surface: "CAP17", route: "/orchestra/sf-planner/overview", en: "Overview" },
  { chapter: "sf-home", surface: "UI29", route: "/orchestra/sf-home", en: "Today" },
  { chapter: "sf-work", surface: "UI30", route: "/orchestra/sf-work", en: "My work" },
  { chapter: "sf-decisions", surface: "UI33", route: "/orchestra/sf-decisions", en: "Decisions" },
  { chapter: "sf-bi", surface: "UI45", route: "/orchestra/sf-bi", en: "Analytics" },
  { chapter: "sf-reviews", surface: "UI47", route: "/orchestra/sf-reviews/agenda", en: "Meeting agenda" },
  { chapter: "sf-imports", surface: "UI55", route: "/orchestra/sf-imports/new", en: "Import file" },
  { chapter: "sf-documents", surface: "UI58", route: "/orchestra/sf-documents", en: "Documents" },
  { chapter: "sf-memory", surface: "UI61", route: "/orchestra/sf-memory/signals", en: "Signals" },
  { chapter: "sf-routines", surface: "UI64", route: "/orchestra/sf-routines", en: "Routines" },
] as const

type Palette = "dark" | "light" | "graphite" | "gruvbox" | "github" | "nord" | "amoled"
const extraPalettes: readonly Palette[] = ["graphite", "gruvbox", "github", "nord", "amoled"]

async function requireRealMount(page: Page, harness: InstalledNativeHarness) {
  const target = harness.manifest.target
  const response = await page.goto(new URL(target.chapterHref, target.shellOrigin).href)
  expect(response?.status(), "F04 real installed shell must answer; WP04 or static mock is invalid").toBe(200)
  const observation = await harness.proveWeb(page.getByRole("main"))
  expect(observation.proofClass).toBe("WEB_INSTALLED_CONTEXT_OBSERVED")
  expect(observation.candidateSha).toBe(harness.manifest.candidateSha)
  expect(harness.componentFixture).toBe("NOT_INSTALLED_PROOF")
  return target.shellOrigin
}

/** Drives the genuine PalettePicker registered in Orchestra Settings.
 * selector provenance: orchestra/palette/picker.tsx @ 6b14c1e3,
 * real palette IDs from palette/catalog.ts (including five recolors).
 */
async function selectPalette(page: Page, origin: string, palette: Palette) {
  const settings = await page.goto(new URL("/orchestra/settings?section=general", origin).href)
  expect(settings?.status()).toBe(200)
  const picker = page.locator('[data-action="settings-palette"]')
  await expect(picker).toBeVisible()
  const option = picker.locator('button[role="radio"][data-palette="' + palette + '"]')
  await expect(option).toHaveCount(1)
  await option.click()
  await expect(option).toHaveAttribute("aria-checked", "true")
  const selection = await page.evaluate(() => ({
    scheme: document.documentElement.dataset.colorScheme,
    palette: document.documentElement.dataset.orchestraPalette ?? null,
  }))
  expect(selection.scheme).toBe(palette === "light" || palette === "github" ? "light" : "dark")
  expect(selection.palette).toBe(palette === "light" || palette === "dark" ? null : palette)
}

async function openChapter(page: Page, origin: string, chapter: (typeof chapters)[number]) {
  const response = await page.goto(new URL(chapter.route, origin).href)
  expect(response?.status(), chapter.surface + " route must be mounted, not a fallback/legacy page").toBe(200)
  const frame = page.locator('[data-sf-frame="page"]')
  await expect(frame, "Frozen F03 SfPageFrame must be mounted for " + chapter.surface).toBeVisible()
  await expect(frame.getByRole("heading", { level: 1, name: chapter.en, exact: true })).toBeVisible()
  await expect(frame.locator('[aria-busy="true"]')).toHaveCount(0)
  // No screenshot is allowed to serve as a substitute for a real page binding.
  return frame
}

for (const chapter of chapters) {
  for (const palette of ["light", "dark"] as const) {
    test("Q02-AC01 installed " + chapter.chapter + "/" + chapter.surface + " · " + palette + " baseline", async ({ page, nativeHarness }, testInfo) => {
      const origin = await requireRealMount(page, nativeHarness)
      await selectPalette(page, origin, palette)
      const frame = await openChapter(page, origin, chapter)
      await testInfo.attach("q02-visual-source.json", {
        body: Buffer.from(JSON.stringify({
          class: "INSTALLED_VISUAL_CAPTURE_NOT_DOMAIN_ACCEPTANCE",
          candidate: nativeHarness.manifest.candidateSha,
          surface: chapter.surface,
          chapter: chapter.chapter,
          palette,
          viewportCssPx: 1280,
          baselineApprovedByReviewer: false,
          contract: "LAYOUT-01 / Q02-AC01 / Q02-AC03",
        })),
        contentType: "application/json",
      })
      // Reviewer must explicitly approve initial 30 baselines. Missing files
      // must fail; the author never snapshots from a design-only fixture.
      await expect(frame).toHaveScreenshot("q02-" + chapter.chapter + "-" + palette + "-installed.png", {
        animations: "disabled", caret: "hide", threshold: 0.2,
      })
    })
  }
}

for (const palette of extraPalettes) {
  test("Q02-AC01 shared tokens/focus in " + palette + " installed palette", async ({ page, nativeHarness }, testInfo) => {
    const origin = await requireRealMount(page, nativeHarness)
    await selectPalette(page, origin, palette)
    // Shared frame: one representative graph/primary-state page for every
    // recolor. Other chapters are light/dark; no full Cartesian repetition.
    const chapter = chapters[0]
    const frame = await openChapter(page, origin, chapter)
    const tokens = await frame.evaluate((element) => {
      const styles = getComputedStyle(element)
      const root = getComputedStyle(document.body)
      return {
        text: root.getPropertyValue("--orchestra-text").trim(),
        muted: root.getPropertyValue("--orchestra-muted").trim(),
        success: root.getPropertyValue("--orchestra-success").trim(),
        danger: root.getPropertyValue("--orchestra-danger").trim(),
        focus: styles.getPropertyValue("--orchestra-accent").trim(),
      }
    })
    for (const [name, value] of Object.entries(tokens)) {
      expect(value, "Theme must resolve shared " + name + " token without page override").not.toBe("")
    }
    await page.keyboard.press("Tab")
    const focused = await page.evaluate(() => {
      const element = document.activeElement
      if (!(element instanceof HTMLElement) || element === document.body) return null
      const rect = element.getBoundingClientRect()
      return { tag: element.tagName, width: rect.width, height: rect.height, x: rect.x, y: rect.y }
    })
    expect(focused, "Keyboard must reach a named visible control in recolored theme").not.toBeNull()
    expect(focused!.width).toBeGreaterThan(0)
    expect(focused!.height).toBeGreaterThan(0)
    await testInfo.attach("q02-shared-tokens.json", {
      body: Buffer.from(JSON.stringify({ palette, tokens, class: "INSTALLED_SHARED_PALETTE_TOKEN_OBSERVATION", candidate: nativeHarness.manifest.candidateSha })),
      contentType: "application/json",
    })
    await expect(frame).toHaveScreenshot("q02-shared-" + palette + "-installed.png", {
      animations: "disabled", caret: "hide", threshold: 0.2,
    })
  })
}
