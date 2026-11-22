import { expect, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test"
import { stat } from "node:fs/promises"
import type { DesignInstallation } from "./installation"
import type { authenticateRecordingInstallation } from "./recording-installation"
import plan from "./capture-plan.json" with { type: "json" }

export type FilmOwner = Awaited<ReturnType<typeof authenticateRecordingInstallation>>
export type CueId = keyof typeof plan
type Box = { x: number; y: number; width: number; height: number } | null
type Marker = { atMs: number; kind: string; label: string; box?: Box; path: string; [key: string]: unknown }
type Beat = { id: CueId; startMs: number; readableAtMs: number; endMs: number; observedStatus: string;
  snapshot?: string; visibleDom?: string; evidence: Record<string, unknown>[]; error?: string; critical: boolean }

/** Real recorded dwell, used only for narration pacing after asserted UI readiness. */
const dwell = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

export async function createFilm(context: BrowserContext, info: TestInfo, installed: DesignInstallation, owner: FilmOwner, example: string) {
  const epoch = performance.now()
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  const video = page.video()
  const actionMarkers: Marker[] = []
  const beats: Beat[] = []
  const errors: { atMs: number; kind: string; message: string }[] = []
  const evidence: Record<string, unknown>[] = []
  const clock = () => Math.round(performance.now() - epoch)
  const safe = (value: string) => value.replaceAll(installed.root, "[isolated-installation]")
    .replaceAll(installed.serverPassword, "[credential]")
    .replace(/[a-f0-9]{64}/gi, "[digest-or-secret]")
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, "[credential]")
    .replace(/([?&](?:code|token|key|password|secret|authorization)=)[^&\s"'<>]+/gi, "$1[redacted]")
  const route = () => { try { return new URL(page.url()).pathname } catch { return "not-navigated" } }
  const mark = (kind: string, label: string, extra: Record<string, unknown> = {}) => {
    actionMarkers.push({ atMs: clock(), kind, label: safe(label), path: route(), ...extra })
  }
  const issue = (kind: string, message: string) => {
    if (errors.length < 30) errors.push({ atMs: clock(), kind, message: safe(message).slice(0, 1200) })
  }
  page.on("pageerror", (error) => issue("pageerror", error.message))
  page.on("console", (message) => { if (message.type() === "error") issue("console", message.text()) })

  const focus = async (locator: Locator, label: string) => {
    await expect(locator, label).toHaveCount(1)
    await expect(locator, label).toBeVisible()
    await locator.scrollIntoViewIfNeeded()
    const box = await locator.boundingBox()
    if (!box) throw new Error("Visible target omitted its bounds: " + label)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 28 })
    mark("focus", label, { box })
    return box
  }
  const click = async (locator: Locator, label: string) => {
    await expect(locator, label).toBeEnabled()
    const box = await focus(locator, label)
    await dwell(700)
    mark("click", label, { box })
    await locator.click({ delay: 100 })
    mark("click-complete", label)
  }
  const input = async (locator: Locator, value: string, label: string, type = false) => {
    await focus(locator, label)
    mark("input", label, { box: await locator.boundingBox(), demonstrationValue: value })
    if (type) { await locator.fill(""); await locator.pressSequentially(value, { delay: 35 }) }
    else await locator.fill(value)
    if (await locator.getAttribute("contenteditable") === "true") await expect(locator).toHaveText(value)
    else await expect(locator).toHaveValue(value)
    mark("input-complete", label)
  }
  const select = async (locator: Locator, option: { label: string } | { value: string } | { index: number }, label: string) => {
    await focus(locator, label)
    mark("select", label, { box: await locator.boundingBox(), option })
    await locator.selectOption(option)
    mark("select-complete", label)
  }
  const nativeReady = async (title?: string) => {
    const host = page.locator('[data-sf-host="owner-runtime231"]')
    await expect(host).toHaveCount(1)
    const heading = title ? host.getByRole("heading", { level: 1, name: title, exact: true }) : host.getByRole("heading", { level: 1 })
    await expect(heading).toBeVisible({ timeout: 60_000 })
    for (const attribute of ["data-sf-discovery-state", "data-sf-provider-state", "data-sf-view-state"])
      await expect(host).toHaveAttribute(attribute, "ready", { timeout: 60_000 })
    await expect(host.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 })
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    mark("ready", title ?? await heading.innerText())
  }
  const go = async (pathname: string, title?: string) => {
    const target = new URL(pathname, installed.origin)
    if (target.origin !== installed.origin) throw new Error("Film navigation must remain on the original installation")
    const native = target.pathname.startsWith("/orchestra/sf-")
    target.searchParams.set("server", installed.origin)
    if (native) {
      target.searchParams.set("project", owner.projectId)
      target.searchParams.set("installation", owner.installationId)
    }
    // Prefer an exact original visible native link. Otherwise record a real
    // document navigation, never a fabricated click or an invented record ID.
    const links = page.locator("a[href]")
    const matches: Locator[] = []
    for (let index = 0; index < await links.count(); index++) {
      const link = links.nth(index)
      const href = await link.getAttribute("href")
      if (!href || !await link.isVisible()) continue
      const value = new URL(href, page.url())
      if (value.origin === target.origin && value.pathname === target.pathname &&
          (!native || (value.searchParams.get("project") === owner.projectId && value.searchParams.get("installation") === owner.installationId)))
        matches.push(link)
    }
    if (matches.length === 1) await click(matches[0]!, "Navigate / " + (title ?? target.pathname))
    else {
      mark("navigate", title ?? target.pathname, { destinationPath: target.pathname })
      await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 45_000 })
    }
    if (native) await nativeReady(title)
    else await expect(page.locator('[data-component="orchestra-sidebar"]')).toBeVisible()
  }
  const sidebar = async (label: string) => {
    const shell = page.locator('[data-component="orchestra-sidebar"]')
    const button = shell.getByRole("button", { name: label, exact: true })
    if (await button.count() === 0 || !await button.isVisible()) {
      const advanced = shell.getByRole("button", { name: "Extensions", exact: true })
      if (await advanced.count() === 1 && await advanced.getAttribute("aria-expanded") === "false")
        await click(advanced, "Expand Extensions navigation")
    }
    await click(button, "Sidebar / " + label)
  }
  const snap = async (id: string) => {
    const name = example + "-" + id
    const snapshot = info.outputPath(name + ".png")
    await page.screenshot({ path: snapshot, fullPage: false, animations: "allow" })
    const dom = await page.evaluate(() => {
      const visible = (element: Element) => element instanceof HTMLElement && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden"
      const box = (element: Element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }
      const description = (element: Element) => ({ tag: element.tagName, role: element.getAttribute("role"),
        text: (element.getAttribute("aria-label") ?? element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 300), box: box(element) })
      return {
        title: document.title, visibleText: document.body.innerText.slice(0, 40_000),
        headings: [...document.querySelectorAll("h1,h2,h3,h4")].filter(visible).map(description).slice(0, 100),
        controls: [...document.querySelectorAll("button,a,summary,label,[role=tab],[role=status],dt")].filter(visible).map(description).slice(0, 200),
        nativeStates: [...document.querySelectorAll("[data-sf-host],[data-sf-surface],[data-sf-decision]")].map((element) => ({
          host: element.getAttribute("data-sf-host"), surface: element.getAttribute("data-sf-surface") ?? element.getAttribute("data-sf-decision"),
          state: element.getAttribute("data-state"), discovery: element.getAttribute("data-sf-discovery-state"),
          provider: element.getAttribute("data-sf-provider-state"), view: element.getAttribute("data-sf-view-state"),
        })),
      }
    })
    const visibleDom = name + "-visible-dom"
    await info.attach(name + "-full-interface", { path: snapshot, contentType: "image/png" })
    await info.attach(visibleDom, { body: safe(JSON.stringify({ atMs: clock(), path: route(), ...dom }, null, 2)), contentType: "application/json" })
    return { snapshot, visibleDom }
  }
  const cue = async (id: CueId, action: () => Promise<void>, critical = false) => {
    const startMs = clock()
    const firstEvidence = evidence.length
    mark("cue-start", id)
    const result = await action().then(() => ({ observedStatus: "observed" })).catch((error: unknown) => ({
      observedStatus: "unavailable-or-not-ready", error: safe(error instanceof Error ? error.message : String(error)).slice(0, 1800),
    }))
    const readableAtMs = clock()
    mark("cue-readable", id, { observedStatus: result.observedStatus })
    const captures = await snap(id).catch((error: unknown) => {
      issue("capture", error instanceof Error ? error.message : String(error)); return {}
    })
    // These seconds are intentional continuous product footage for narration,
    // after readiness assertions; they never substitute for waiting on state.
    await dwell(plan[id].seconds * 1000)
    const beat: Beat = { id, startMs, readableAtMs, endMs: clock(), ...result, ...captures,
      evidence: evidence.slice(firstEvidence), critical }
    beats.push(beat)
    mark("cue-end", id, { observedStatus: result.observedStatus })
    console.info("SF_FILM_BEAT " + JSON.stringify({ example, id, startMs, readableAtMs, endMs: beat.endMs, observedStatus: beat.observedStatus }))
  }
  const proof = (value: Record<string, unknown>) => { evidence.push({ atMs: clock(), ...value }); mark("evidence", String(value.kind ?? "source-readback")) }
  const finish = async () => {
    mark("recording-end", example)
    const report = {
      schema: "sf-onboarding-film-v1", sourceRevision: "55d332a2451d2146e825d494b87878875d63b1c7",
      executionRevision: process.env.GITHUB_SHA ?? "not-provided", installationExample: example,
      viewport: { width: 1920, height: 1080 },
      source: "original isolated installation and producer-accepted demonstration records; actual continuous browser actions",
      clock: "monotonic milliseconds from immediately before page creation; align first navigate marker to its first visible video frame",
      firstNavigationMs: actionMarkers.find((entry) => entry.kind === "navigate")?.atMs ?? null,
      videoAttachment: example + "-continuous-video", beats, actionMarkers, evidence, errors,
    }
    try {
      await info.attach(example + "-film-report", { body: safe(JSON.stringify(report, null, 2)), contentType: "application/json" })
    } finally { await context.close() }
    if (!video) throw new Error("Continuous video was not created")
    const file = await video.path()
    if ((await stat(file)).size === 0) throw new Error("Continuous video is empty")
    await info.attach(example + "-continuous-video", { path: file, contentType: "video/webm" })
    await info.attach(example + "-video-source", { body: JSON.stringify({ attachment: example + "-continuous-video", path: file,
      firstNavigationMs: report.firstNavigationMs, clock: report.clock }), contentType: "application/json" })
  }
  return { page, cue, click, input, select, focus, go, sidebar, nativeReady, mark, proof, snap, finish, beats,
    pause: dwell, installed, owner, context,
    missingCritical: () => beats.filter((beat) => beat.critical && beat.observedStatus !== "observed").map((beat) => ({ id: beat.id, error: beat.error })) }
}

export type Film = Awaited<ReturnType<typeof createFilm>>

/** Select the actual original workspace through the normal project picker. */
export async function selectOriginalProject(film: Film) {
  await film.go("/orchestra/agents")
  const empty = film.page.locator('[data-slot="orchestra-chapter-empty"]')
  const agents = film.page.getByRole("list", { name: "Configured agents", exact: true })
  await expect.poll(async () => await empty.isVisible() || await agents.isVisible(), { timeout: 30_000 }).toBe(true)
  if (await empty.isVisible()) {
    await film.click(empty.getByRole("button", { name: "Open project", exact: true }), "Choose real project")
    const directory = film.installed.root + "/workspace"
    await film.input(film.page.getByPlaceholder("Search folders", { exact: true }), directory, "Find original runtime workspace")
    const item = film.page.locator('[data-directory-path=' + JSON.stringify(directory) + ']')
    await film.click(item, "Select original runtime workspace")
    const skip = film.page.getByRole("button", { name: "Add without git", exact: true })
    await expect.poll(async () => await skip.isVisible() || await agents.isVisible(), { timeout: 30_000 }).toBe(true)
    if (await skip.isVisible()) await film.click(skip, "Add workspace without creating git repository")
  }
  await expect(agents).toBeVisible({ timeout: 40_000 })
  film.proof({ kind: "shared-project-selection", mechanism: "original Open project UI", directory: "verified private runtime workspace", catalog: "actual Configured agents" })
}
