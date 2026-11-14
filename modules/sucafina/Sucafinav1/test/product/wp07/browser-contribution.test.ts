import { test } from "bun:test"
import { fileURLToPath } from "node:url"
import type { Browser } from "@playwright/test"
import type { ReviewContribution, ReviewContributionRequest } from "../../../product/reviews/contribution.ts"
import { captureChromiumCleanup } from "./chromium-cleanup.ts"

type Brief = Extract<ReviewContribution, { kind: "DecisionBrief" }>
type Material = Extract<ReviewContribution, { kind: "MeetingMaterialProposal" }>
// This HTTP fixture implements only the UI display/navigation contract. It omits
// runProvenance entirely and is not a C11 reader, native run or producer proof.
type DisplayFixture =
  | { kind: Brief["kind"]; output: Pick<Brief["output"], "id" | "kind" | "state" | "caseRef" | "outputDigest" | "payload">; links: Brief["links"] }
  | { kind: Material["kind"]; output: Pick<Material["output"], "id" | "kind" | "state" | "caseRef" | "outputDigest" | "payload">; review: Pick<Material["review"], "id">; artifacts: []; links: Material["links"] }

test("Chromium reauthorizes contribution navigation and discards revoked or superseded results", async () => {
  const started = Date.now()
  const checkpoint = (phase: string) => console.info(`WP07 contribution browser: ${phase} +${Date.now() - started}ms`)
  const timed = async <T>(phase: string, work: () => Promise<T>, milliseconds = 5000): Promise<T> => {
    checkpoint(`${phase}:start`)
    const deadline = { timer: undefined as ReturnType<typeof setTimeout> | undefined }
    try {
      const result = await Promise.race([work(), new Promise<never>((_, reject) => { deadline.timer = setTimeout(() => reject(new Error(`WP07_CONTRIBUTION_PHASE_TIMEOUT:${phase}`)), milliseconds) })])
      checkpoint(`${phase}:done`)
      return result
    } finally { if (deadline.timer) clearTimeout(deadline.timer) }
  }
  const { chromium, expect } = await timed("playwright-import", () => import("@playwright/test"))
  const built = await timed("browser-build", () => Bun.build({ entrypoints: [fileURLToPath(new URL("./browser-contribution-entry.ts", import.meta.url))], target: "browser", format: "esm", sourcemap: "none" }))
  expect(built.success).toBe(true)
  const bundle = built.outputs.find((output) => output.kind === "entry-point")
  if (!bundle) throw new Error("WP07_CONTRIBUTION_BUNDLE_UNAVAILABLE")
  const caseRef = { id: "fixture-case", version: 1, incarnation: "fixture-incarnation" }
  const digest = "a".repeat(64)
  const brief: DisplayFixture = {
    kind: "DecisionBrief",
    output: { id: "fixture-brief", kind: "DecisionBrief", state: "ready", caseRef, outputDigest: digest, payload: { caseRef: "fixture-case", caseVersion: 1, objective: "Fixture decision objective", orderedResultRefs: ["fixture-result", "decision-result:fixture"], evidenceRefs: [], conditions: [] } },
    links: [{ kind: "contribution", outputRef: "fixture-result" }, { kind: "decision-result", resultRef: "decision-result:fixture" }],
  }
  const material: DisplayFixture = {
    kind: "MeetingMaterialProposal",
    output: { id: "fixture-material", kind: "MeetingMaterialProposal", state: "ready", caseRef, outputDigest: digest, payload: { reviewSelectionRef: "fixture-review", orderedResultRefs: [], coverage: [{ sectionRef: "fixture-section", includedCount: 2, totalCount: 2 }], gaps: [] } },
    review: { id: "fixture-review" }, artifacts: [], links: [{ kind: "review", reviewRef: "fixture-review" }],
  }
  const state = {
    mode: "fresh" as "fresh" | "denied" | "missing-link" | "changed-digest",
    rejectDestination: false,
    requests: [] as ReviewContributionRequest[],
    callbacks: [] as { kind: string; reference: string }[],
    held: undefined as ReturnType<typeof heldRead> | undefined,
    gates: [] as ReturnType<typeof heldRead>[],
  }
  const server = Bun.serve({ hostname: "localhost", port: 0, fetch: async (request) => {
    const url = new URL(request.url)
    if (request.method === "GET" && url.pathname === "/contribution.js") return new Response(bundle, { headers: { "Content-Type": "text/javascript" } })
    if (request.method === "POST" && url.pathname === "/test-contribution-host") {
      const target = await request.json() as { kind: string; reference: string }
      state.callbacks.push(target)
      return new Response(null, { status: state.rejectDestination ? 403 : 204 })
    }
    if (request.method === "POST" && url.searchParams.get("sf") === "review-contribution") {
      const input = await request.json() as ReviewContributionRequest
      state.requests.push(structuredClone(input))
      const selected = input.outputRef === brief.output.id ? brief : input.outputRef === material.output.id ? material : undefined
      if (!selected || JSON.stringify(input.caseRef) !== JSON.stringify(caseRef)) return Response.json({ status: "needs-input", reason: "fixture-request-invalid" })
      const current = structuredClone(selected)
      if (state.mode === "missing-link") current.links = []
      if (state.mode === "changed-digest") {
        current.output.outputDigest = "b".repeat(64)
        if (current.kind === "DecisionBrief") current.output.payload.objective = "Refreshed decision objective"
      }
      const result = state.mode === "denied" ? { status: "denied", reason: "fixture-access-revoked" } : { status: "ok", value: current }
      const gate = input.expectedOutputDigest ? state.held : undefined
      if (gate) {
        state.held = undefined
        gate.enter()
        await gate.released
      }
      return Response.json(result)
    }
    if (request.method === "GET" && url.pathname === "/review") {
      const selected = url.searchParams.get("fixture") === "material" ? material : brief
      const input: ReviewContributionRequest = { outputRef: selected.output.id, caseRef }
      return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>WP07 contribution consumer test</title></head><body><main></main><script type="application/json">${JSON.stringify(input).replaceAll("<", "\\u003c")}</script><script type="module" src="/contribution.js"></script></body></html>`, { headers: { "Content-Type": "text/html" } })
    }
    return new Response(null, { status: 404 })
  } })
  const runtime: { browser?: Browser; closeBrowser?: () => Promise<void> } = {}
  const failures: unknown[] = []
  try {
    runtime.browser = await timed("chrome-launch", () => chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"], timeout: 15000 }), 20000)
    runtime.closeBrowser = await timed("chrome-ownership", () => captureChromiumCleanup(runtime.browser!))
    const context = await timed("browser-context", () => runtime.browser!.newContext({ viewport: { width: 1200, height: 900 } }))
    const page = await timed("browser-page", () => context.newPage())
    page.setDefaultTimeout(5000)
    page.setDefaultNavigationTimeout(5000)
    const errors: string[] = []
    page.on("pageerror", (error) => { errors.push(error.message) })
    const view = page.getByRole("region", { name: "Review contribution", exact: true })
    const completed = page.getByRole("status", { name: "Contribution HTTP completions", exact: true })
    const navigation = page.getByRole("status", { name: "Host navigation", exact: true })
    const openBrief = async () => {
      state.mode = "fresh"
      state.rejectDestination = false
      state.requests = []
      state.callbacks = []
      await page.goto(`${server.url.origin}/review?fixture=brief`, { waitUntil: "domcontentloaded" })
      await expect(view.getByRole("heading", { name: "Fixture decision objective", exact: true })).toBeVisible()
      await expect(completed).toHaveText("1")
    }
    const cleared = async (reason: string) => {
      await expect(view.getByText(`Contribution unavailable: ${reason}`, { exact: true })).toBeVisible()
      await expect(view.getByRole("heading")).toHaveCount(0)
      await expect(view.getByRole("button")).toHaveCount(0)
      await expect(view.getByRole("listitem")).toHaveCount(0)
      await expect(view).not.toContainText("Fixture decision objective")
      await expect(view).not.toContainText("Refreshed decision objective")
    }

    checkpoint("fresh-link-navigation")
    await openBrief()
    expect(state.requests).toEqual([{ outputRef: "fixture-brief", caseRef }])
    await view.getByRole("button", { name: "Open result fixture-result", exact: true }).click()
    await expect(navigation).toHaveText("Opened contribution fixture-result")
    expect(state.requests.at(-1)).toEqual({ outputRef: "fixture-brief", caseRef, expectedOutputDigest: digest })
    expect(state.requests).toHaveLength(2)
    expect(state.callbacks).toEqual([{ kind: "contribution", reference: "fixture-result" }])
    await view.getByRole("button", { name: "Open decision result decision-result:fixture", exact: true }).click()
    await expect(navigation).toHaveText("Opened decision-result decision-result:fixture")
    expect(state.requests).toHaveLength(3)
    expect(state.requests.at(-1)?.expectedOutputDigest).toBe(digest)
    expect(state.callbacks.at(-1)).toEqual({ kind: "decision-result", reference: "decision-result:fixture" })

    checkpoint("navigation-revoked")
    state.mode = "denied"
    await view.getByRole("button", { name: "Open result fixture-result", exact: true }).click()
    await cleared("fixture-access-revoked")
    expect(state.callbacks).toHaveLength(2)
    expect(state.requests.at(-1)?.expectedOutputDigest).toBe(digest)

    checkpoint("navigation-link-removed")
    await openBrief()
    state.mode = "missing-link"
    await view.getByRole("button", { name: "Open result fixture-result", exact: true }).click()
    await cleared("contribution-changed")
    expect(state.callbacks).toEqual([])

    checkpoint("navigation-digest-changed")
    await openBrief()
    state.mode = "changed-digest"
    await view.getByRole("button", { name: "Open decision result decision-result:fixture", exact: true }).click()
    await cleared("contribution-changed")
    expect(state.callbacks).toEqual([])

    checkpoint("async-destination-refused")
    await openBrief()
    state.rejectDestination = true
    await view.getByRole("button", { name: "Open result fixture-result", exact: true }).click()
    await cleared("destination-unavailable")
    expect(state.callbacks).toEqual([{ kind: "contribution", reference: "fixture-result" }])
    await expect(navigation).toHaveText("No navigation")

    checkpoint("dispose-during-navigation-read")
    await openBrief()
    const disposedRead = heldRead()
    state.gates.push(disposedRead)
    state.held = disposedRead
    await view.getByRole("button", { name: "Open result fixture-result", exact: true }).click()
    await timed("disposed-read-entered", () => disposedRead.entered)
    await page.getByRole("button", { name: "Host dispose", exact: true }).click()
    await expect(view).toBeEmpty()
    disposedRead.release()
    await expect(completed).toHaveText("2")
    await expect(view).toBeEmpty()
    expect(state.callbacks).toEqual([])

    checkpoint("refresh-supersedes-navigation-read")
    await openBrief()
    const refreshedRead = heldRead()
    state.gates.push(refreshedRead)
    state.held = refreshedRead
    await view.getByRole("button", { name: "Open result fixture-result", exact: true }).click()
    await timed("refreshed-read-entered", () => refreshedRead.entered)
    state.mode = "changed-digest"
    await page.getByRole("button", { name: "Host refresh", exact: true }).click()
    await expect(view.getByRole("heading", { name: "Refreshed decision objective", exact: true })).toBeVisible()
    await expect(completed).toHaveText("2")
    expect(state.requests.at(-1)).toEqual({ outputRef: "fixture-brief", caseRef })
    refreshedRead.release()
    await expect(completed).toHaveText("3")
    await expect(view.getByRole("heading", { name: "Refreshed decision objective", exact: true })).toBeVisible()
    await expect(navigation).toHaveText("No navigation")
    expect(state.callbacks).toEqual([])

    checkpoint("meeting-link-navigation")
    state.mode = "fresh"
    state.requests = []
    state.callbacks = []
    await page.goto(`${server.url.origin}/review?fixture=material`, { waitUntil: "domcontentloaded" })
    await expect(view.getByRole("heading", { name: "Meeting material", exact: true })).toBeVisible()
    await expect(view.getByText("fixture-section: 2 of 2 selected records", { exact: true })).toBeVisible()
    await view.getByRole("button", { name: "Open preserved meeting", exact: true }).click()
    await expect(navigation).toHaveText("Opened review fixture-review")
    expect(state.requests.at(-1)).toEqual({ outputRef: "fixture-material", caseRef, expectedOutputDigest: digest })
    expect(state.requests).toHaveLength(2)
    expect(state.callbacks).toEqual([{ kind: "review", reference: "fixture-review" }])
    state.mode = "missing-link"
    await view.getByRole("button", { name: "Open preserved meeting", exact: true }).click()
    await cleared("contribution-changed")
    await expect(view).not.toContainText("fixture-section")
    expect(state.callbacks).toHaveLength(1)
    expect(errors).toEqual([])
    checkpoint("body-done")
  } catch (error) {
    console.error("WP07 contribution browser: original failure before cleanup", error instanceof Error ? error.stack ?? error.message : String(error))
    failures.push(error)
  } finally {
    state.gates.forEach((gate) => gate.release())
    const cleanup: { phase: string; close: () => Promise<unknown> }[] = [
      { phase: "server-stop", close: async () => { await server.stop(true) } },
      { phase: "chrome-close", close: async () => {
        if (runtime.closeBrowser) return runtime.closeBrowser()
        if (runtime.browser) {
          await runtime.browser.close()
          throw new Error("WP07_CONTRIBUTION_CHROME_OWNERSHIP_WAS_NOT_CAPTURED")
        }
      } },
    ]
    for (const task of cleanup) {
      try { await timed(`cleanup:${task.phase}`, task.close, task.phase === "chrome-close" ? 20000 : 10000) }
      catch (error) {
        console.error(`WP07 contribution browser: cleanup failure ${task.phase}`, error instanceof Error ? error.message : String(error))
        failures.push(error)
      }
    }
  }
  if (failures.length) throw new AggregateError(failures, "WP07 contribution browser regression or cleanup failed")
}, 120000)

function heldRead() {
  const signals: { enter?: () => void; release?: () => void } = {}
  const entered = new Promise<void>((resolve) => { signals.enter = resolve })
  const released = new Promise<void>((resolve) => { signals.release = resolve })
  return { entered, released, enter: () => { signals.enter!() }, release: () => { signals.release!() } }
}
