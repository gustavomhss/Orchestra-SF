import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Browser, BrowserContext, Page } from "@playwright/test"
import { portfolioScript, portfolioWidget } from "../../../product/ui/portfolio.ts"

// These transport fixtures exercise the shipped portfolio consumer. Their catalog,
// results and receipts are declared fixtures, not domain/native execution evidence.
let browser: Browser | undefined
async function within<T>(operation: Promise<T>, step: string, timeout = 5_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Portfolio fixture timed out: ${step}`)), timeout) })])
  } finally { clearTimeout(timer) }
}
beforeAll(async () => {
  const { chromium } = await import("@playwright/test")
  browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"], timeout: 8_000 })
}, 10_000)
afterAll(async () => { if (browser) await within(browser.close(), "close browser") }, 8_000)

const actions = {
  evaluation: { mode: "decision-portfolio-evaluate", label: "Save this evaluation" },
  promotion: { mode: "decision-promote-portfolio", label: "Create alternative" },
  preparation: { mode: "decision-prepare-portfolio", label: "Prepare changes from choice" },
} as const
type Kind = keyof typeof actions
type Call = { mode: string; key: string | null; body: string }
const caseRef = { id: "fixture-case", incarnation: "fixture-incarnation", version: 1 }
const preview = {
  evaluationDigest: "a".repeat(64), selections: [{ combinationId: "combination", selectedCandidateRefs: ["fixture-candidate"] }],
  portfolio: { combinations: [{ id: "combination", eligibility: "eligible", comparisonStatus: "conditioned", conflicts: [], restrictions: [] }], limitations: ["Fixture has no monetary analysis."] },
}
const readValues: Record<string, unknown> = {
  "decision-list": [{ caseRef, objective: "Restricted decision" }],
  "decision-portfolio-catalog": { cases: [{ caseRef, caseVersion: 1, objective: "Restricted decision", criteria: [{ id: "criterion", description: "Review coverage" }], alternatives: [{ candidateRef: "fixture-candidate", title: "Selected renewal", comparisonStatus: "conditioned" }] }], explorationLimit: { minimum: 1, maximum: 16 } },
  "decision-portfolio-selection": { selection: { criteria: ["criterion"] } },
  "decision-portfolio-preview": preview,
  "decision-coverage-catalog": [{ coverageRef: "fixture-coverage", label: "Current coverage", state: "partial" }],
  "decision-choice-catalog": [{ choiceId: "fixture-choice", label: "Recorded renewal", at: "2026-11-13T08:00:00Z" }],
}
const success = (kind: Kind) => Response.json({ status: "ok", value: kind === "evaluation" ? { portfolioResultRef: "fixture-result" } : { caseRef: { ...caseRef, version: 2 } } })

async function fixture(options: {
  write: (call: Call, index: number) => Response | Promise<Response>
  history?: () => Response | Promise<Response>
  release?: () => void
}, check: (page: Page, calls: Call[]) => Promise<void>) {
  const calls: Call[] = []
  const history = options.history ? `<section data-portfolio-history data-case='${JSON.stringify(caseRef)}'><p role="status"></p><div data-results></div></section>` : ""
  const server = Bun.serve({ hostname: "localhost", port: 0, idleTimeout: 30, fetch: async (request) => {
    const mode = new URL(request.url).searchParams.get("sf")
    if (!mode) return new Response(`<!doctype html><html><body>${portfolioWidget}${history}<script>${portfolioScript}</script></body></html>`, { headers: { "Content-Type": "text/html" } })
    if (mode === "decision-portfolio-results" && options.history) return options.history()
    if (Object.values(actions).some((action) => action.mode === mode)) {
      const call = { mode, key: request.headers.get("idempotency-key"), body: await request.text() }
      calls.push(call)
      return options.write(call, calls.length)
    }
    return Object.hasOwn(readValues, mode) ? Response.json({ status: "ok", value: readValues[mode] }) : new Response(null, { status: 404 })
  } })
  let context: BrowserContext | undefined
  let page: Page | undefined
  let failure: unknown
  try {
    if (!browser?.isConnected()) throw new Error("Portfolio fixture browser is unavailable")
    context = await within(browser.newContext(), "create isolated context")
    page = await within(context.newPage(), "open page")
    page.setDefaultTimeout(5_000)
    page.setDefaultNavigationTimeout(8_000)
    await page.goto(server.url.href)
    await check(page, calls)
  } catch (error) { failure = error; throw error }
  finally {
    options.release?.()
    const cleanup: unknown[] = []
    for (const [step, close] of [
      ["close page", () => page?.close({ runBeforeUnload: false })],
      ["close context", () => context?.close()],
      ["stop server", () => server.stop(true)],
    ] as const) {
      try { await within(Promise.resolve(close()), step) } catch (error) { cleanup.push(error) }
    }
    if (cleanup.length) throw new AggregateError(failure ? [failure, ...cleanup] : cleanup, "Portfolio assertion/lifecycle failures")
  }
}

async function ready(page: Page, kind: Kind) {
  await page.getByText("Explore a portfolio", { exact: true }).click()
  await page.getByRole("button", { name: "Find decisions", exact: true }).click()
  await page.getByText("Choose decisions, then find alternatives.", { exact: true }).waitFor()
  await page.locator('[data-portfolio-case-list] input').check()
  await page.getByRole("button", { name: "Find alternatives", exact: true }).click()
  await page.getByText("Choose alternatives and enter the portfolio scope.", { exact: true }).waitFor()
  await page.locator('[data-portfolio-candidates] input').check()
  await page.getByLabel("Decision that will own this evaluation", { exact: true }).selectOption("0")
  await page.getByLabel("Portfolio start", { exact: true }).fill("2027-01-01")
  await page.getByLabel("Portfolio end", { exact: true }).fill("2027-12-31")
  await page.getByLabel("Currency", { exact: true }).fill("USD")
  await page.getByLabel("Maximum combinations", { exact: true }).fill("4")
  await page.getByLabel("Use the selected decision criteria without additional priorities", { exact: true }).check()
  await page.getByRole("button", { name: "Preview portfolio", exact: true }).click()
  await page.getByText("Preview complete. No portfolio result has been saved.", { exact: true }).waitFor()
  if (kind === "evaluation") return
  await page.getByLabel("Combination", { exact: true }).selectOption("combination")
  if (kind === "promotion") {
    await page.getByRole("button", { name: "Find coverage assessments", exact: true }).click()
    await page.getByText("Choose the coverage to review.", { exact: true }).waitFor()
    await page.getByLabel("Coverage", { exact: true }).selectOption("fixture-coverage")
    await page.getByLabel("Alternative title", { exact: true }).fill("Original renewal")
    return
  }
  await page.getByRole("button", { name: "Find recorded choices", exact: true }).click()
  await page.getByText("Choose a recorded choice and a combination above.", { exact: true }).waitFor()
  await page.getByLabel("Recorded choice", { exact: true }).selectOption("fixture-choice")
}
async function settled(page: Page) {
  await within(page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))), "settle browser response handling")
}

test.each(["evaluation", "promotion", "preparation"] as const)("portfolio %s freezes body and key after a lost response and a subsequent conflict", async (kind) => {
  let release: (() => void) | undefined
  let started: (() => void) | undefined
  const received = new Promise<void>((resolve) => { started = resolve })
  await fixture({
    write: async (_call, index) => {
      if (index === 1) await new Promise<void>((resolve) => { release = resolve; started?.() })
      return index === 2 ? Response.json({ status: "conflict", reason: "portfolio-result-mismatch" }, { status: 409 }) : success(kind)
    },
    release: () => release?.(),
  }, async (page, calls) => {
    let dropped = false
    await page.route((url) => url.searchParams.get("sf") === actions[kind].mode, async (route) => {
      if (dropped) { await route.continue(); return }
      dropped = true
      expect((await route.fetch({ timeout: 8_000 })).status()).toBe(200)
      await route.abort("failed")
    })
    await ready(page, kind)
    await page.getByRole("button", { name: actions[kind].label, exact: true }).click()
    await within(received, "enter the held mutation")
    expect(await page.getByLabel("Portfolio start", { exact: true }).isDisabled()).toBe(true)
    expect(await page.getByRole("button", { name: "Find decisions", exact: true }).isDisabled()).toBe(true)
    expect(calls.length).toBe(1)
    release?.()
    const retry = page.getByRole("button", { name: `Retry same ${kind}`, exact: true })
    await retry.waitFor()
    expect(await page.getByLabel("Maximum combinations", { exact: true }).isDisabled()).toBe(true)
    // A changed DOM value cannot replace the frozen admitted intention.
    await page.getByLabel("Maximum combinations", { exact: true }).evaluate((input) => {
      if (!(input instanceof HTMLInputElement)) throw new Error("expected portfolio limit input")
      input.value = "9"; input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    const conflict = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === actions[kind].mode)
    await retry.click()
    const response = await conflict
    expect(response.status()).toBe(409)
    expect(await within(response.finished(), "finish the conflict response")).toBeNull()
    await settled(page)
    expect(await page.getByLabel("Maximum combinations", { exact: true }).isDisabled()).toBe(true)
    expect(await page.getByRole("button", { name: "Preview portfolio", exact: true }).isDisabled()).toBe(true)
    expect(calls.length).toBe(2)
    if (kind === "evaluation") {
      await retry.click()
      await page.getByText("Portfolio evaluation saved.", { exact: true }).waitFor()
    } else await Promise.all([page.waitForEvent("domcontentloaded"), retry.click()])
    expect(calls.length).toBe(3)
    expect(calls[0]!.key).toBeTruthy()
    expect(new Set(calls.map((call) => call.key)).size).toBe(1)
    expect(new Set(calls.map((call) => call.body)).size).toBe(1)
    expect(JSON.parse(calls[0]!.body).request.explorationLimit).toBe(4)
  })
}, 30_000)

test.each(["stale", "conflict"])("an initial portfolio %s response retains the same evaluation intention", async (status) => {
  await fixture({ write: (_call, index) => index === 1 ? Response.json({ status, reason: "portfolio-result-mismatch" }, { status: 409 }) : success("evaluation") }, async (page, calls) => {
    await ready(page, "evaluation")
    await page.getByRole("button", { name: "Save this evaluation", exact: true }).click()
    const retry = page.getByRole("button", { name: "Retry same evaluation", exact: true })
    await retry.waitFor()
    expect(await page.getByLabel("Currency", { exact: true }).isDisabled()).toBe(true)
    await retry.click()
    await page.getByText("Portfolio evaluation saved.", { exact: true }).waitFor()
    expect(calls.length).toBe(2)
    expect(calls[0]!.key).toBe(calls[1]!.key)
    expect(calls[0]!.body).toBe(calls[1]!.body)
  })
}, 30_000)

test("a published pre-dispatch portfolio rejection permits correction with a new intention", async () => {
  await fixture({ write: (_call, index) => index === 1 ? Response.json({ status: "needs-input", reason: "invalid-decision-input" }, { status: 400 }) : success("promotion") }, async (page, calls) => {
    await ready(page, "promotion")
    await page.getByRole("button", { name: "Create alternative", exact: true }).click()
    await page.getByText("The promotion was rejected. Review the current inputs and try again.", { exact: true }).waitFor()
    expect(await page.getByLabel("Alternative title", { exact: true }).isEnabled()).toBe(true)
    await page.getByLabel("Alternative title", { exact: true }).fill("Corrected renewal")
    await Promise.all([page.waitForEvent("domcontentloaded"), page.getByRole("button", { name: "Create alternative", exact: true }).click()])
    expect(calls.length).toBe(2)
    expect(calls[0]!.key).not.toBe(calls[1]!.key)
    expect(JSON.parse(calls[0]!.body).title).toBe("Original renewal")
    expect(JSON.parse(calls[1]!.body).title).toBe("Corrected renewal")
  })
}, 30_000)

test.each(["promotion", "preparation"] as const)("portfolio %s does not confirm an incomplete successful acknowledgement", async (kind) => {
  await fixture({ write: (_call, index) => index === 1 ? Response.json({ status: "ok", value: {} }) : success(kind) }, async (page, calls) => {
    await ready(page, kind)
    await page.getByRole("button", { name: actions[kind].label, exact: true }).click()
    const retry = page.getByRole("button", { name: `Retry same ${kind}`, exact: true })
    await retry.waitFor()
    expect(await page.getByLabel("Portfolio start", { exact: true }).isDisabled()).toBe(true)
    expect(await page.getByRole("button", { name: "Find decisions", exact: true }).isDisabled()).toBe(true)
    await Promise.all([page.waitForEvent("domcontentloaded"), retry.click()])
    expect(calls.length).toBe(2)
    expect(calls[0]!.body).toBe(calls[1]!.body)
    expect(calls[0]!.key).toBe(calls[1]!.key)
  })
}, 30_000)

test("a closed portfolio page exposes a reload state without retaining its old context", async () => {
  await fixture({ write: () => success("evaluation") }, async (page, calls) => {
    await ready(page, "evaluation")
    await page.evaluate(() => dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })))
    await page.getByText("This portfolio view is closed. Reload to read the current decision before continuing.", { exact: true }).waitFor()
    expect(await page.locator('[data-portfolio] input, [data-portfolio] select').count()).toBe(0)
    expect(await page.locator("body").textContent()).not.toContain("Restricted decision")
    expect(await page.getByRole("button", { name: "Reload portfolio", exact: true }).isEnabled()).toBe(true)
    expect(calls.length).toBe(0)
    await Promise.all([page.waitForEvent("domcontentloaded"), page.getByRole("button", { name: "Reload portfolio", exact: true }).click()])
    await ready(page, "evaluation")
    expect(await page.getByRole("button", { name: "Save this evaluation", exact: true }).isEnabled()).toBe(true)
  })
}, 30_000)

test.each([401, 403])("portfolio %i clears context and fences a late successful mutation", async (denial) => {
  let releaseHistory: (() => void) | undefined
  let releaseWrite: (() => void) | undefined
  let startedWrite: (() => void) | undefined
  let startedHistory: (() => void) | undefined
  let finishedWrite: (() => void) | undefined
  const started = new Promise<void>((resolve) => { startedWrite = resolve })
  const historyStarted = new Promise<void>((resolve) => { startedHistory = resolve })
  const finished = new Promise<void>((resolve) => { finishedWrite = resolve })
  await fixture({
    history: async () => { await new Promise<void>((resolve) => { releaseHistory = resolve; startedHistory?.() }); return Response.json({ status: "denied", detail: "PRIVATE DENIAL" }, { status: denial }) },
    write: async () => { await new Promise<void>((resolve) => { releaseWrite = resolve; startedWrite?.() }); finishedWrite?.(); return success("evaluation") },
    release: () => { releaseHistory?.(); releaseWrite?.() },
  }, async (page, calls) => {
    await within(historyStarted, "start the held history read")
    await ready(page, "evaluation")
    const retained = await page.getByLabel("Currency", { exact: true }).elementHandle()
    let navigations = 0
    page.on("framenavigated", () => { navigations++ })
    await page.getByRole("button", { name: "Save this evaluation", exact: true }).click()
    await within(started, "start the write before revocation")
    releaseHistory?.()
    await page.locator('[data-portfolio] [role=status]').filter({ hasText: "Access changed. Portfolio content cleared; reload to continue." }).waitFor()
    expect(await page.locator('[data-portfolio] input, [data-portfolio] select').count()).toBe(0)
    expect(await page.locator('[data-portfolio-history]').getAttribute("data-case")).toBeNull()
    expect(await retained?.evaluate((input) => input instanceof HTMLInputElement ? input.value : null)).toBe("")
    releaseWrite?.()
    await within(finished, "release the old success after revocation")
    await settled(page)
    expect(navigations).toBe(0)
    expect(calls.length).toBe(1)
    expect(await page.locator("body").textContent()).not.toContain("Restricted decision")
    expect(await page.locator("body").textContent()).not.toContain("PRIVATE DENIAL")
    expect(await page.locator("body").textContent()).not.toContain("Portfolio evaluation saved.")
  })
}, 30_000)

test("portfolio evaluation times out while reading a body and replays the exact request", async () => {
  let pendingBody: ReadableStreamDefaultController<Uint8Array> | undefined
  await fixture({
    write: (_call, index) => index === 1 ? new Response(new ReadableStream<Uint8Array>({ start(controller) { pendingBody = controller; controller.enqueue(new TextEncoder().encode('{"status":"ok",')) } }), { headers: { "Content-Type": "application/json" } }) : success("evaluation"),
    release: () => { try { pendingBody?.close() } catch {} },
  }, async (page, calls) => {
    await ready(page, "evaluation")
    const failed = page.waitForEvent("requestfailed", { predicate: (request) => new URL(request.url()).searchParams.get("sf") === actions.evaluation.mode, timeout: 15_000 })
    await page.getByRole("button", { name: "Save this evaluation", exact: true }).click()
    const retry = page.getByRole("button", { name: "Retry same evaluation", exact: true })
    await retry.waitFor({ timeout: 15_000 })
    expect((await failed).failure()?.errorText).toContain("ERR_ABORTED")
    expect(await page.getByLabel("Portfolio end", { exact: true }).isDisabled()).toBe(true)
    await retry.click()
    await page.getByText("Portfolio evaluation saved.", { exact: true }).waitFor()
    expect(calls.length).toBe(2)
    expect(calls[0]!.body).toBe(calls[1]!.body)
    expect(calls[0]!.key).toBe(calls[1]!.key)
  })
}, 30_000)
