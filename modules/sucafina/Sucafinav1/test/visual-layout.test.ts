import { test } from "bun:test"
import { Database } from "bun:sqlite"
import { expect, type Response } from "@playwright/test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { Schema } from "effect"
import { SfContextResult } from "@orchestra/schema/sucafina/context"
import { SfOperationId } from "@orchestra/schema/sucafina/common"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { localBrowser } from "./fixture/local-browser.ts"
import { observeNativeResponses } from "./fixture/native-response-capture.ts"
import { decodeSnapshot } from "../runtime/local-store.ts"

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
  let disposeResponseCapture: (() => void) | undefined
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
    const responses = await observeNativeResponses(page, origin)
    disposeResponseCapture = responses.dispose
    await step("prepare screenshot directory", () => mkdir(path.join(import.meta.dir, "artifacts"), { recursive: true }))
    // Preserve the original durable setup command in this private installation.
    const plan = await step("create planner version through durable command", () => page.request.post(origin + "/sucafina/planner", {
      headers: { Origin: origin }, timeout: 10_000,
      data: { page: "Versions", action: "save", version: 0, values: {} },
    }))
    expect(plan.status()).toBe(200)
    expect(await step("read planner version receipt", () => plan.json())).toMatchObject({ ok: true })
    // HTTP intentionally omits business values. Read the actual committed source
    // through a read-only connection to this local operator fixture's database.
    const persisted = await step("read committed Planner version from private SQLite", () => {
      const db = new Database(path.join(fixture!.root, "business-local", "installation.sqlite"), { readonly: true, strict: true })
      try {
        const row = db.query<{ payload: string }, [string]>("SELECT payload FROM snapshots WHERE surface = ?").get("planner")
        if (!row) throw new Error("Private Planner snapshot was not persisted")
        return decodeSnapshot(row.payload)
      } finally { db.close() }
    })
    const versions = Schema.decodeUnknownSync(Schema.Array(Schema.Struct({
      id: Schema.String.check(Schema.isMinLength(1)),
    })))(persisted.data.versions)
    expect(versions).toHaveLength(1)
    const createdVersionId = versions[0]!.id
    expect(persisted.versions["versions:first"]).toEqual({ version: 1, by: fixture.actorId })
    expect(persisted.versions["versions:" + createdVersionId]).toEqual({ version: 1, by: fixture.actorId })
    const nativePage = (response: Response, cap: string) => {
      const url = new URL(response.url())
      return response.request().method() === "GET" && url.origin === origin && url.pathname === "/sucafina/api/ui/pages/" + cap
    }
    const nativeContext = (response: Response) => {
      const url = new URL(response.url())
      return response.request().method() === "GET" && url.origin === origin && url.pathname === "/sucafina/api/ui/context"
    }
    const initialCopy = responses.begin([
      { label: "original context", method: "GET", pathname: "/sucafina/api/ui/context" },
      { label: "CAP01 initial page", method: "GET", pathname: "/sucafina/api/ui/pages/CAP01" },
    ])
    const [contextResponse, executiveResponse, documentResponse] = await step("open native Executive and original context", () => Promise.all([
      page.waitForResponse(nativeContext, { timeout: 10_000 }),
      page.waitForResponse((response) => nativePage(response, "CAP01"), { timeout: 10_000 }),
      page.goto(origin + "/orchestra/sf-dashboard/executive"),
    ]))
    expect(documentResponse?.status()).toBe(200)
    expect(contextResponse.status()).toBe(200)
    const context = Schema.decodeUnknownSync(SfContextResult)(await step("decode original context", () => initialCopy.json(contextResponse)))
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
    expect(chapters.map((chapter) => chapter.pages.length)).toEqual([5, 3, 2, 5, 6, 7])
    for (const entry of expected) {
      expect(destinations.find((item) => item.capabilityId === entry.cap))
        .toMatchObject({ page: entry.page, canRead: true })
      const read = context.value.availability.flatMap((resource) => resource.operations)
        .filter((operation) => operation.operationId === "domain.page." + entry.cap)
      expect(read).toHaveLength(1)
      expect(read[0]).toMatchObject({ state: "ready", reason: null, operational: true })
    }
    const verifyOwnerHref = (href: string, path: string) => {
      const url = new URL(href, origin)
      expect(url.origin).toBe(origin)
      expect(url.pathname).toBe(path)
      expect(url.hash).toBe("")
      // The fixture's real HTTP ServerConnection uses its origin as serverKey.
      expect([...url.searchParams.entries()].toSorted(([a], [b]) => a.localeCompare(b))).toEqual([
        ["installation", context.value.stamp.installationId],
        ["project", context.value.stamp.projectId],
        ["server", origin],
      ])
    }
    const verifySource = async (response: Response, cap: string, read: () => Promise<unknown>) => {
      expect(response.status()).toBe(200)
      const operation = Schema.decodeUnknownSync(SfOperationId)("domain.page." + cap)
      const codec = SfNativeOperationBindings[operation]
      if (!codec) throw new Error("Missing original native page codec: " + cap)
      const decoded = codec.decodeOutput(await step(cap + ": decode original page response", read))
      expect(decoded.status).toBe("ok")
      if (decoded.status !== "ok") throw new Error("Original source violated its codec: " + cap)
      expect(decoded.value).toMatchObject({ status: "ok", context: context.value.stamp, value: { capabilityId: cap } })
      if (cap === "CAP18") expect(decoded.value).toHaveProperty("value.data.selectedVersion.id", createdVersionId)
    }
    const ready = async () => {
      const host = page.locator('[data-sf-host="owner-runtime231"]')
      await expect(host).toHaveAttribute("data-sf-provider-state", "ready")
      await expect(host).toHaveAttribute("data-sf-view-state", "ready")
      await expect(page.locator('[data-sf-state="loading"]')).toHaveCount(0)
    }
    await verifySource(executiveResponse, "CAP01", () => initialCopy.json(executiveResponse))
    await step("Executive initial state", ready)
    initialCopy.finish()
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
    const peopleBounds = () => Promise.all([0, 1, 2, 3].map((index) => people.nth(index).boundingBox()))
    const aligned = await step("Executive initial people metric bounds", peopleBounds)
    expect(aligned.every(Boolean)).toBe(true)
    expect(Math.max(...aligned.map((box) => box!.y)) - Math.min(...aligned.map((box) => box!.y))).toBeLessThanOrEqual(2)
    expect(Math.max(...aligned.map((box) => box!.width)) - Math.min(...aligned.map((box) => box!.width))).toBeLessThanOrEqual(2)
    expect(Math.max(...aligned.map((box) => box!.height)) - Math.min(...aligned.map((box) => box!.height))).toBeLessThanOrEqual(2)
    const visited: { width: number; cap: string }[] = []
    for (const width of [1440, 1024, 768, 390, 320]) {
      await step("set viewport to " + width + "px", () => page.setViewportSize({ width, height: 1000 }))
      const seen: string[] = []
      for (const chapter of chapters) {
        const entry = chapter.chapter + " at " + width + "px"
        console.info("SF native visual layout phase: " + entry)
        const initial = chapter.pages[0]!
        const entryCopy = responses.begin([
          { label: entry, method: "GET", pathname: "/sucafina/api/ui/pages/" + initial.cap },
        ])
        const [source, documentResponse] = await step(entry + ": navigate", () => Promise.all([
          page.waitForResponse((response) => nativePage(response, initial.cap), { timeout: 10_000 }),
          page.goto(origin + initial.path),
        ]))
        expect(documentResponse?.status()).toBe(200)
        await verifySource(source, initial.cap, () => entryCopy.json(source))
        await step(entry + ": ready", ready)
        entryCopy.finish()
        const navigation = page.locator('[data-sf-source-navigation="' + chapter.chapter + '"]')
        const hrefs = await step(entry + ": read admitted navigation", () => navigation.locator("a").evaluateAll((links) =>
          links.map((link) => ({ cap: link.getAttribute("data-sf-capability"), href: link.getAttribute("href")!, label: link.textContent?.trim() }))))
        expect(hrefs.map((item) => item.cap)).toEqual(chapter.pages.map((item) => item.cap))
        expect(hrefs.map((item) => item.label)).toEqual(chapter.pages.map((item) => item.page))
        expect(new Set(hrefs.map((item) => item.href)).size).toBe(chapter.pages.length)
        for (const [index, link] of hrefs.entries()) verifyOwnerHref(link.href, chapter.pages[index]!.path)
        if (chapter.chapter === "sf-dashboard") {
          await expect(people).toHaveCount(4)
          const cards = await step(entry + ": people metric bounds", peopleBounds)
          expect(cards.every(Boolean)).toBe(true)
          expect(new Set(cards.map((box) => Math.round(box!.x))).size).toBe(width === 1440 ? 4 : 2)
          expect(new Set(cards.map((box) => Math.round(box!.y))).size).toBe(width === 1440 ? 1 : 2)
          expect(Math.max(...cards.map((box) => box!.width)) - Math.min(...cards.map((box) => box!.width))).toBeLessThanOrEqual(2)
          expect(Math.max(...cards.map((box) => box!.height)) - Math.min(...cards.map((box) => box!.height))).toBeLessThanOrEqual(2)
          expect(Math.min(...cards.map((box) => box!.height))).toBeGreaterThanOrEqual(100)
        }
        if (["sf-dashboard", "sf-procurement", "sf-planner"].includes(chapter.chapter))
          await step(entry + ": screenshot", () => page.screenshot({ path: path.join(import.meta.dir, "artifacts", "visual-" + chapter.chapter + "-" + width + ".png"), fullPage: true, timeout: 10_000 }))
        // Cycle back to the entry last: all 28 real links are clicked once at
        // each width, and every transition mounts a different source page.
        for (const target of [...chapter.pages.slice(1), initial]) {
          const route = target.cap + " " + target.page + " at " + width + "px"
          const routeCopy = responses.begin([
            { label: route, method: "GET", pathname: "/sucafina/api/ui/pages/" + target.cap },
          ])
          const [response] = await step(route + ": follow real F01 link", () => Promise.all([
            page.waitForResponse((response) => nativePage(response, target.cap), { timeout: 10_000 }),
            navigation.locator('a[data-sf-capability="' + target.cap + '"]').click(),
          ]))
          await verifySource(response, target.cap, () => routeCopy.json(response))
          await step(route + ": current URL", () => page.waitForURL((url) => url.pathname === target.path))
          verifyOwnerHref(page.url(), target.path)
          // CAP25 intentionally contains the native queue Dashboard and the
          // original Requests frame. Both headings are checked exactly.
          await step(route + ": visible page identity", () =>
            expect(page.locator("h1")).toHaveText(target.cap === "CAP25" ? ["Dashboard", "Requests"] : [target.page]))
          await step(route + ": ready", ready)
          routeCopy.finish()
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
    await step("revoke the real browser session", () => page.context().clearCookies())
    const revokedCopy = responses.begin([
      { label: "revoked context", method: "GET", pathname: "/sucafina/api/ui/context" },
    ])
    const [revoked] = await step("reread authority after revocation", () => Promise.all([
      page.waitForResponse(nativeContext, { timeout: 10_000 }),
      page.getByRole("button", { name: "Refresh access", exact: true }).click(),
    ]))
    expect(revoked.status()).toBe(401)
    expect(Schema.decodeUnknownSync(SfContextResult)(await step("decode revoked context", () => revokedCopy.json(revoked))))
      .toEqual({ status: "unauthenticated" })
    await expect(page.locator('[data-sf-host="owner-runtime231"]')).toHaveAttribute("data-sf-provider-state", "unauthenticated")
    await expect(page.locator("[data-sf-source-navigation]")).toHaveCount(0)
    await expect(page.locator('[data-sf-frame="page"]')).toHaveCount(0)
    revokedCopy.finish()
    expect(failures).toEqual([])
    expect(fixture.errors).toEqual([])
  } catch (error) {
    failure = error
    console.error("SF visual layout failed at: " + stage)
    throw error
  } finally {
    disposeResponseCapture?.()
    try { await fixture?.dispose() }
    catch (error) { throw new AggregateError(failure ? [failure, error] : [error], "Visual layout assertion/setup and cleanup failures") }
  }
  if (!fixture) throw new Error("Visual browser fixture did not start")
  fixture.report()
  // The original 28 pages × five widths, 10s step deadlines and 120s aggregate
  // ceiling remain. This installed journey is distinct from component controls.
}, 120000)
