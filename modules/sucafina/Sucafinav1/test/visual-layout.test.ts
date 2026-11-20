import { test } from "bun:test"
import { expect } from "@playwright/test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import type { Response as BrowserResponse } from "@playwright/test"
import { Schema } from "effect"
import { SfContextResult } from "@orchestra/schema/sucafina/context"
import { SfOperationId } from "@orchestra/schema/sucafina/common"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { localBrowser } from "./fixture/local-browser.ts"

// Independent original page identities mapped to the frozen native paths.
// CAP14 keeps its original Dashboard source inside the native Procurement chapter.
const chapters: readonly { chapter: string; pages: readonly { cap: string; path: string; page: string }[] }[] = [
  { chapter: "sf-dashboard", pages: [
    {"cap":"CAP01","path":"/orchestra/sf-dashboard/executive","page":"Executive Dashboard"},
    {"cap":"CAP02","path":"/orchestra/sf-dashboard/hot-topics","page":"Hot Topics & Actions"},
    {"cap":"CAP03","path":"/orchestra/sf-dashboard/budget","page":"Budget Overview"},
    {"cap":"CAP04","path":"/orchestra/sf-dashboard/opex","page":"OPEX Detail"},
    {"cap":"CAP05","path":"/orchestra/sf-dashboard/capex","page":"CAPEX Projects"},
  ] },
  { chapter: "sf-people", pages: [
    {"cap":"CAP06","path":"/orchestra/sf-people/overview","page":"Headcount Overview"},
    {"cap":"CAP07","path":"/orchestra/sf-people/structure","page":"Team Structure"},
    {"cap":"CAP08","path":"/orchestra/sf-people/talent","page":"Talent Review"},
  ] },
  { chapter: "sf-portfolio", pages: [
    {"cap":"CAP09","path":"/orchestra/sf-portfolio/overview","page":"Portfolio Dashboard"},
    {"cap":"CAP10","path":"/orchestra/sf-portfolio/projects","page":"All Projects"},
  ] },
  { chapter: "sf-operations", pages: [
    {"cap":"CAP11","path":"/orchestra/sf-operations/service","page":"IT Operations"},
    {"cap":"CAP12","path":"/orchestra/sf-operations/security","page":"IT Security KPIs"},
    {"cap":"CAP13","path":"/orchestra/sf-operations/risks","page":"IT Risks"},
    {"cap":"CAP15","path":"/orchestra/sf-operations/stakeholders","page":"Stakeholder Management"},
    {"cap":"CAP16","path":"/orchestra/sf-operations/performance","page":"IT Performance Contract"},
  ] },
  { chapter: "sf-procurement", pages: [
    {"cap":"CAP14","path":"/orchestra/sf-procurement/contracts","page":"Vendor Contracts"},
    {"cap":"CAP24","path":"/orchestra/sf-procurement/overview","page":"Dashboard"},
    {"cap":"CAP25","path":"/orchestra/sf-procurement/requests","page":"Requests"},
    {"cap":"CAP26","path":"/orchestra/sf-procurement/approvals","page":"My approvals"},
    {"cap":"CAP27","path":"/orchestra/sf-procurement/suppliers","page":"Suppliers"},
    {"cap":"CAP28","path":"/orchestra/sf-procurement/settings","page":"Settings"},
  ] },
  { chapter: "sf-planner", pages: [
    {"cap":"CAP17","path":"/orchestra/sf-planner/overview","page":"Overview"},
    {"cap":"CAP18","path":"/orchestra/sf-planner/opex","page":"OPEX"},
    {"cap":"CAP19","path":"/orchestra/sf-planner/capex","page":"CAPEX"},
    {"cap":"CAP20","path":"/orchestra/sf-planner/headcount","page":"Headcount"},
    {"cap":"CAP21","path":"/orchestra/sf-planner/allocations","page":"Entities & allocations"},
    {"cap":"CAP22","path":"/orchestra/sf-planner/fx","page":"FX rates"},
    {"cap":"CAP23","path":"/orchestra/sf-planner/versions","page":"Versions"},
  ] },
]

async function within<T>(operation: Promise<T>, stage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Visual layout timed out at: " + stage)), 10_000)
    })])
  } finally { clearTimeout(timer) }
}

test("Executive metrics align, fill the content area and fit desktop and mobile viewports", async () => {
  expectSpawn(import.meta.path)
  let fixture: Awaited<ReturnType<typeof localBrowser>> | undefined
  let stage = "open owned, isolated native browser fixture"
  let failure: unknown
  const failures: string[] = []
  const step = <T>(name: string, operation: () => T | Promise<T>) => {
    stage = name
    return within(Promise.resolve().then(operation), name)
  }
  try {
    fixture = await localBrowser({ nativePlanner: true })
    const page = fixture.page
    const origin = new URL(page.url()).origin
    page.setDefaultTimeout(10_000)
    page.setDefaultNavigationTimeout(10_000)
    page.on("pageerror", (error) => { failures.push(error.message) })
    await step("prepare screenshot directory", () => mkdir(path.join(import.meta.dir, "artifacts"), { recursive: true }))
    // Preserve the original durable setup command in this private installation.
    const plan = await step("create planner version through durable command", () => page.request.post(origin + "/sucafina/planner", {
      headers: { Origin: origin }, timeout: 10_000,
      data: { page: "Versions", action: "save", version: 0, values: {} },
    }))
    expect(plan.status()).toBe(200)
    expect(await step("read planner version receipt", () => plan.json())).toMatchObject({ ok: true })
    const nativePage = (response: BrowserResponse, cap: string) => {
      const url = new URL(response.url())
      return response.request().method() === "GET" && url.origin === origin && url.pathname === "/sucafina/api/ui/pages/" + cap
    }
    const [contextResponse, executiveResponse, document] = await step("open native Executive and original context", () => Promise.all([
      page.waitForResponse((response) => {
        const url = new URL(response.url())
        return response.request().method() === "GET" && url.origin === origin && url.pathname === "/sucafina/api/ui/context"
      }, { timeout: 10_000 }),
      page.waitForResponse((response) => nativePage(response, "CAP01"), { timeout: 10_000 }),
      page.goto(origin + "/orchestra/sf-dashboard/executive"),
    ]))
    expect(document?.status()).toBe(200)
    expect(contextResponse.status()).toBe(200)
    const context = Schema.decodeUnknownSync(SfContextResult)(await step("decode original context", () => contextResponse.json()))
    expect(context.status).toBe("ok")
    if (context.status !== "ok") throw new Error("Visual journey has no original admitted context")
    expect(context.value.authMode).toBe("local-operator")
    expect(context.value.stamp.principalRef).toBe(fixture.actorId)
    const expected = chapters.flatMap((chapter) => chapter.pages)
    const destinations = context.value.destinations.filter((item) => /^CAP(?:0[1-9]|1[0-9]|2[0-8])$/.test(item.capabilityId))
    expect(destinations).toHaveLength(28)
    expect(new Set(destinations.map((item) => item.capabilityId)).size).toBe(28)
    expect(["dashboard", "planner", "procurement"].map((surface) =>
      destinations.filter((item) => item.surface === surface && item.canRead).length)).toEqual([16, 7, 5])
    for (const entry of expected) expect(destinations.find((item) => item.capabilityId === entry.cap))
      .toMatchObject({ page: entry.page, canRead: true })
    const verifySource = async (response: BrowserResponse, cap: string) => {
      expect(response.status()).toBe(200)
      const operation = Schema.decodeUnknownSync(SfOperationId)("domain.page." + cap)
      const codec = SfNativeOperationBindings[operation]
      if (!codec) throw new Error("Missing original native page codec: " + cap)
      const decoded = codec.decodeOutput(await step(cap + ": decode original page response", () => response.json()))
      expect(decoded.status).toBe("ok")
      if (decoded.status !== "ok") throw new Error("Original source violated its codec: " + cap)
      expect(decoded.value).toMatchObject({ status: "ok", context: context.value.stamp, value: { capabilityId: cap } })
      if (cap === "CAP18") expect(decoded.value).toHaveProperty("value.data.selectedVersion.id")
    }
    const ready = async () => {
      await expect(page.locator('[data-sf-host="owner-runtime231"]')).toHaveAttribute("data-sf-view-state", "ready")
      await expect(page.locator('[data-sf-state="loading"]')).toHaveCount(0)
    }
    await verifySource(executiveResponse, "CAP01")
    await step("Executive initial state", ready)
    await step("Executive initial screenshot", () => page.screenshot({ path: path.join(import.meta.dir, "artifacts", "visual-dashboard-desktop.png"), fullPage: true, timeout: 10_000 }))
    const financial = page.locator(".sf-u02-financial-metrics [data-sf-metric]")
    expect(await financial.count()).toBe(3)
    const first = await step("Executive first financial metric", () => financial.nth(0).boundingBox())
    const third = await step("Executive third financial metric", () => financial.nth(2).boundingBox())
    const content = await step("Executive usable content bounds", () => page.locator(".sf-frame-body").boundingBox())
    expect(first).not.toBeNull()
    expect(third).not.toBeNull()
    expect(content).not.toBeNull()
    expect(third!.x + third!.width - first!.x).toBeGreaterThan(content!.width * 0.85)
    const people = page.locator(".sf-u02-people-metrics [data-sf-metric]")
    await expect(people.locator("dt")).toHaveText(["Total IT users", "Cost per User (OPEX)", "Cost per User (OPEX + CAPEX)", "Attrition YTD"])
    const visited: { width: number; cap: string }[] = []
    for (const width of [1440, 1024, 768, 390, 320]) {
      await step("set viewport to " + width + "px", () => page.setViewportSize({ width, height: 1000 }))
      const seen: string[] = []
      for (const chapter of chapters) {
        const entry = chapter.chapter + " at " + width + "px"
        console.info("SF native visual layout phase: " + entry)
        const initial = chapter.pages[0]!
        const [source, document] = await step(entry + ": navigate", () => Promise.all([
          page.waitForResponse((response) => nativePage(response, initial.cap), { timeout: 10_000 }),
          page.goto(origin + initial.path),
        ]))
        expect(document?.status()).toBe(200)
        await verifySource(source, initial.cap)
        await step(entry + ": ready", ready)
        const navigation = page.locator('[data-sf-source-navigation="' + chapter.chapter + '"]')
        const hrefs = await step(entry + ": read admitted navigation", () => navigation.locator("a").evaluateAll((links) =>
          links.map((link) => ({ cap: link.getAttribute("data-sf-capability"), href: link.getAttribute("href")!, label: link.textContent?.trim() }))))
        expect(hrefs.map((item) => item.cap)).toEqual(chapter.pages.map((item) => item.cap))
        expect(hrefs.map((item) => item.label)).toEqual(chapter.pages.map((item) => item.page))
        expect(new Set(hrefs.map((item) => item.href)).size).toBe(chapter.pages.length)
        for (const [index, link] of hrefs.entries()) {
          const href = new URL(link.href, origin)
          expect(href.origin).toBe(origin)
          expect(href.pathname).toBe(chapter.pages[index]!.path)
          expect([...href.searchParams.keys()].sort()).toEqual(["installation", "project", "server"])
          expect(href.searchParams.get("server")).toBeTruthy()
          expect(href.searchParams.get("project")).toBe(context.value.stamp.projectId)
          expect(href.searchParams.get("installation")).toBe(context.value.stamp.installationId)
        }
        if (chapter.chapter === "sf-dashboard") {
          await expect(people).toHaveCount(4)
          const cards = await step(entry + ": people metric bounds", () => people.evaluateAll((nodes) => nodes.map((node) => {
            const box = node.getBoundingClientRect()
            return { x: box.x, y: box.y, width: box.width, height: box.height }
          })))
          expect(cards).toHaveLength(4)
          expect(new Set(cards.map((box) => Math.round(box.x))).size).toBe(width === 1440 ? 4 : 2)
          expect(new Set(cards.map((box) => Math.round(box.y))).size).toBe(width === 1440 ? 1 : 2)
          expect(Math.max(...cards.map((box) => box.width)) - Math.min(...cards.map((box) => box.width))).toBeLessThanOrEqual(2)
          expect(Math.max(...cards.map((box) => box.height)) - Math.min(...cards.map((box) => box.height))).toBeLessThanOrEqual(2)
          expect(Math.min(...cards.map((box) => box.height))).toBeGreaterThanOrEqual(100)
        }
        await step(entry + ": screenshot", () => page.screenshot({ path: path.join(import.meta.dir, "artifacts", "visual-" + chapter.chapter + "-" + width + ".png"), fullPage: true, timeout: 10_000 }))
        // Cycle back to the entry last: all 28 real links are clicked once at
        // each width, and every transition mounts a different source page.
        for (const target of [...chapter.pages.slice(1), initial]) {
          const route = target.cap + " " + target.page + " at " + width + "px"
          const [response] = await step(route + ": follow real F01 link", () => Promise.all([
            page.waitForResponse((response) => nativePage(response, target.cap), { timeout: 10_000 }),
            navigation.locator('a[data-sf-capability="' + target.cap + '"]').click(),
          ]))
          await verifySource(response, target.cap)
          await step(route + ": current URL", () => page.waitForURL((url) => url.pathname === target.path))
          await step(route + ": ready", ready)
          // CAP25 intentionally contains the native queue Dashboard and the
          // original Requests frame. Both headings are checked exactly.
          await expect(page.locator("h1")).toHaveText(target.cap === "CAP25" ? ["Dashboard", "Requests"] : [target.page])
          expect(await step(route + ": document width", () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))).toBe(true)
          const charts = await step(route + ": chart bounds", () => page.locator("figure svg, .sf-chart-visual svg, svg[role=img]").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height)))
          expect(charts.every((height) => height <= 241)).toBe(true)
          const active = navigation.locator('a[aria-current="page"]')
          await expect(active).toHaveCount(1)
          await expect(active).toHaveAttribute("data-sf-capability", target.cap)
          seen.push(target.cap)
          visited.push({ width, cap: target.cap })
          if (width === 1440) await step(route + ": screenshot", () => page.screenshot({
            path: path.join(import.meta.dir, "artifacts", "visual-" + target.cap.toLowerCase() + ".png"), fullPage: true, timeout: 10_000,
          }))
        }
      }
      expect(seen.toSorted()).toEqual(expected.map((entry) => entry.cap).toSorted())
      expect(new Set(seen).size).toBe(28)
    }
    expect(visited).toHaveLength(140)
    await page.context().clearCookies()
    await page.getByRole("button", { name: "Refresh access", exact: true }).click()
    await expect(page.locator('[data-sf-host="owner-runtime231"]')).toHaveAttribute("data-sf-provider-state", "unauthenticated")
    await expect(page.locator("[data-sf-source-navigation]")).toHaveCount(0)
    expect(failures).toEqual([])
    expect(fixture.errors).toEqual([])
  } catch (error) {
    failure = error
    console.error("SF visual layout failed at: " + stage)
    throw error
  } finally {
    try { await fixture?.dispose() }
    catch (error) { throw new AggregateError(failure ? [failure, error] : [error], "Visual layout assertion/setup and cleanup failures") }
  }
  if (!fixture) throw new Error("Visual browser fixture did not start")
  console.info("SF native visual physical browser closure", fixture.report())
  // The original 28 pages × five widths, 10s step deadlines and 120s aggregate
  // ceiling remain. This installed journey is distinct from component controls.
}, 120000)
