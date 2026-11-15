/**
 * Q02.complete / Q02-AC02 — installed responsive, resize and keyboard proof.
 * This is a pairwise LAYOUT-01/A11Y-01 sample, NOT 70 x 7 x 5 x states.
 * No local test, fake installed host, domain mock, authorization bypass or skip.
 */
import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { nativeInstalledFixture } from "./fixture.ts"
import type { InstalledNativeHarness } from "./fixture.ts"

const test = nativeInstalledFixture
test.use({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" })
test.describe.configure({ mode: "default", retries: 0 })

const patterns = [
  { width: 320, id: "UI29", pattern: "overview", route: "/orchestra/sf-home", title: "Today" },
  { width: 768, id: "CAP25", pattern: "request-flow", route: "/orchestra/sf-procurement/requests", title: "Requests" },
  { width: 1024, id: "UI33", pattern: "collection", route: "/orchestra/sf-decisions", title: "Decisions" },
  { width: 1280, id: "UI45", pattern: "catalog", route: "/orchestra/sf-bi", title: "Analytics" },
  { width: 1440, id: "CAP01", pattern: "overview-wide", route: "/orchestra/sf-dashboard/executive", title: "Executive Dashboard" },
] as const

async function realShell(page: Page, harness: InstalledNativeHarness) {
  const target = harness.manifest.target
  expect((await page.goto(new URL(target.chapterHref, target.shellOrigin).href))?.status()).toBe(200)
  const proof = await harness.proveWeb(page.getByRole("main"))
  expect(proof.proofClass).toBe("WEB_INSTALLED_CONTEXT_OBSERVED")
  expect(proof.candidateSha).toBe(harness.manifest.candidateSha)
  return target.shellOrigin
}

async function pageFrame(page: Page, shellOrigin: string, route: string, title: string) {
  expect((await page.goto(new URL(route, shellOrigin).href))?.status()).toBe(200)
  const frame = page.locator('[data-sf-frame="page"]')
  await expect(frame, "F03 native frame, not legacy WP04 DOM").toBeVisible()
  await expect(frame.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible()
  await expect(frame.locator('[aria-busy="true"]')).toHaveCount(0)
  return frame
}

async function assertReflowAndFocusable(page: Page, expectedWidth: number) {
  const geometry = await page.evaluate(() => {
    const root = document.documentElement
    return {
      viewport: window.innerWidth,
      document: root.scrollWidth,
      body: document.body.scrollWidth,
      visual: window.visualViewport?.width ?? window.innerWidth,
    }
  })
  expect(geometry.viewport).toBe(expectedWidth)
  expect(geometry.document, "No document-level horizontal scrolling; grid/table may scroll locally")
    .toBeLessThanOrEqual(geometry.viewport + 1)
  await page.keyboard.press("Tab")
  const focus = await page.evaluate(() => {
    const element = document.activeElement
    if (!(element instanceof HTMLElement) || element === document.body) return null
    const styles = getComputedStyle(element)
    const box = element.getBoundingClientRect()
    return {
      tag: element.tagName,
      ariaHidden: element.getAttribute("aria-hidden"),
      display: styles.display,
      visibility: styles.visibility,
      width: box.width, height: box.height,
      left: box.left, right: box.right, top: box.top, bottom: box.bottom,
    }
  })
  expect(focus, "Tab reaches an actual visible focusable control").not.toBeNull()
  expect(focus!.ariaHidden).not.toBe("true")
  expect(focus!.display).not.toBe("none")
  expect(focus!.visibility).not.toBe("hidden")
  expect(focus!.width).toBeGreaterThan(0)
  expect(focus!.height).toBeGreaterThan(0)
  expect(focus!.left).toBeGreaterThanOrEqual(-1)
  expect(focus!.right).toBeLessThanOrEqual(expectedWidth + 1)
  expect(focus!.top).toBeGreaterThanOrEqual(-1)
  expect(focus!.bottom).toBeLessThanOrEqual(901)
  return { geometry, focus }
}

for (const sample of patterns) {
  test("Q02-AC02 " + sample.width + "px · " + sample.id + " / " + sample.pattern + " (real shell + focus/reflow)", async ({ page, nativeHarness }, testInfo) => {
    await page.setViewportSize({ width: sample.width, height: 900 })
    const origin = await realShell(page, nativeHarness)
    const frame = await pageFrame(page, origin, sample.route, sample.title)
    const workarea = frame.locator("[data-sf-usable-width]")
    await expect(workarea).toBeVisible()
    const usable = Number(await workarea.getAttribute("data-sf-usable-width"))
    expect(usable, "Breakpoint must be measured from actual usable width").toBeGreaterThan(0)
    const mode = await frame.getAttribute("data-sf-mode")
    expect(["single", "split", "split-context"]).toContain(mode)
    if (usable < 801) expect(mode).toBe("single")
    if (sample.width === 320) expect(mode).toBe("single")
    const observation = await assertReflowAndFocusable(page, sample.width)
    await testInfo.attach("q02-reflow-" + sample.width + ".json", {
      contentType: "application/json",
      body: Buffer.from(JSON.stringify({
        proofClass: "INSTALLED_LAYOUT_AND_KEYBOARD_OBSERVATION",
        candidate: nativeHarness.manifest.candidateSha, surface: sample.id,
        pattern: sample.pattern, cssWidth: sample.width, usable, mode, ...observation,
      })),
    })
  })
}

test("Q02-AC02 200% text-only scaling — names, actions and 320px document reflow survive", async ({ page, nativeHarness }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  const origin = await realShell(page, nativeHarness)
  const frame = await pageFrame(page, origin, "/orchestra/sf-procurement/requests", "Requests")
  // Text-only resize probe: CSS font-size 200%, independent of viewport resize.
  // 129 must additionally record actual hosted browser text-only zoom evidence.
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" })
  const rootFont = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize))
  expect(rootFont).toBeGreaterThanOrEqual(30)
  await expect(frame.getByRole("heading", { level: 1, name: "Requests" })).toBeVisible()
  await assertReflowAndFocusable(page, 320)
  const draftBars = frame.locator(".sf-draft-bar")
  const count = await draftBars.count()
  if (count > 0) {
    const last = await draftBars.evaluateAll((elements) => elements.map((node) => node.getBoundingClientRect().bottom))
    expect(last.every((bottom) => bottom <= 901), "Draft footer must not obscure last visible field").toBe(true)
  }
})

test("Q02-AC02 400% reflow — 1280 physical CSS window to 320 CSS-equivalent usable layout", async ({ page, nativeHarness }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const origin = await realShell(page, nativeHarness)
  await pageFrame(page, origin, "/orchestra/sf-decisions", "Decisions")
  const before = await page.evaluate(() => window.innerWidth)
  expect(before).toBe(1280)
  // WCAG 1.4.10 equivalent width: at 400% zoom a 1280px browser exposes
  // 320 CSS px. Emulate that *layout* precisely; hosted real zoom remains
  // a separate observation and cannot be marked passed by this proxy alone.
  await page.setViewportSize({ width: 320, height: 900 })
  const frame = page.locator('[data-sf-frame="page"]')
  await expect(frame).toHaveAttribute("data-sf-mode", "single")
  const result = await assertReflowAndFocusable(page, 320)
  expect(result.geometry.document).toBeLessThanOrEqual(321)
  await expect(frame.getByRole("heading", { level: 1, name: "Decisions" })).toBeVisible()
})

test("Q02-AC02 monthly-grid APG — single roving tab stop, arrows/Home/Escape, no domain write", async ({ page, nativeHarness }) => {
  const origin = await realShell(page, nativeHarness)
  await pageFrame(page, origin, "/orchestra/sf-planner/opex", "OPEX")
  const grid = page.getByRole("grid")
  await expect(grid).toBeVisible()
  const active = grid.locator('[role="gridcell"][tabindex="0"]')
  await expect(active, "S02 must expose exactly one keyboard entry for the monthly grid").toHaveCount(1)
  const posted: string[] = []
  page.on("request", (request) => {
    if (request.method() === "POST") posted.push(new URL(request.url()).pathname)
  })
  await active.focus()
  await expect(active).toBeFocused()
  await active.press("Home")
  await expect(active).toHaveCount(1)
  const start = Number(await active.getAttribute("aria-colindex"))
  expect(Number.isFinite(start)).toBe(true)
  await active.press("ArrowRight")
  await expect(active).toHaveCount(1)
  const next = Number(await active.getAttribute("aria-colindex"))
  expect(next).toBeGreaterThan(start)
  await active.press("Escape")
  expect(posted, "Keyboard navigation and Escape do not save a monthly financial cell").toHaveLength(0)
})

test("Q02-AC02 keyboard palette — Home/End/Arrow select real token, focus remains visible", async ({ page, nativeHarness }) => {
  const origin = await realShell(page, nativeHarness)
  await page.goto(new URL("/orchestra/settings?section=general", origin).href)
  const palette = page.locator('[data-action="settings-palette"]')
  await expect(palette).toBeVisible()
  const radios = palette.getByRole("radio")
  await expect(radios).toHaveCount(8) // System plus 7 frozen palettes.
  const checked = palette.locator('button[role="radio"][aria-checked="true"]')
  await expect(checked).toHaveCount(1)
  await checked.focus()
  await checked.press("Home")
  await expect(palette.locator('button[data-palette="system"]')).toHaveAttribute("aria-checked", "true")
  await palette.locator('button[data-palette="system"]').press("End")
  const amoled = palette.locator('button[data-palette="amoled"]')
  await expect(amoled).toHaveAttribute("aria-checked", "true")
  await expect(amoled).toBeFocused()
  await amoled.press("ArrowLeft")
  await expect(palette.locator('button[data-palette="nord"]')).toHaveAttribute("aria-checked", "true")
  await expect(palette.locator('button[data-palette="nord"]')).toBeFocused()
})

test("Q02-AC02 chart has accessible tabular alternative, no source values inferred by color", async ({ page, nativeHarness }) => {
  const origin = await realShell(page, nativeHarness)
  const frame = await pageFrame(page, origin, "/orchestra/sf-dashboard/executive", "Executive Dashboard")
  const chart = frame.locator(".sf-chart-frame")
  await expect(chart).toBeVisible()
  const table = chart.getByRole("table")
  await expect(table, "ChartFrame must expose source-backed accessible table/caption").toBeVisible()
  await expect(table.locator("caption")).not.toBeEmpty()
  await expect(chart.getByRole("heading")).toBeVisible()
  // Empty/zero/unavailable semantics are sourced by the producer. No synthetic
  // legend or local currency arithmetic is introduced by this qualification.
})
