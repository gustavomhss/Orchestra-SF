import { expect, test } from "bun:test"
import type { Browser, Page } from "@playwright/test"
import { plannerMonthlyScript } from "../../../product/ui/planner-monthly.ts"
import { caseQuestionScript } from "../../../product/ui/work-collaboration.ts"
import { forecastAnalysisScript } from "../../../product/ui/forecast-analysis.ts"

// These transport fixtures exercise the shipped browser consumers, including a lost
// response after admission. They do not qualify native execution or domain policy.
async function within<T>(operation: Promise<T>, step: string, timeout = 5_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Recovery fixture timed out: ${step}`)), timeout) })])
  } finally { clearTimeout(timer) }
}

async function browserCase(body: string, post: (request: Request) => Response | Promise<Response>, check: (page: Page) => Promise<void>, release?: () => void) {
  const server = Bun.serve({ hostname: "localhost", port: 0, idleTimeout: 30, fetch: (request) => request.method === "GET"
    ? new Response(`<!doctype html><html><body>${body}</body></html>`, { headers: { "Content-Type": "text/html" } })
    : post(request) })
  let browser: Browser | undefined
  try {
    const { chromium } = await import("@playwright/test")
    browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"], timeout: 8_000 })
    const page = await within(browser.newPage(), "open browser page")
    page.setDefaultTimeout(5_000)
    page.setDefaultNavigationTimeout(8_000)
    await page.goto(server.url.href)
    await check(page)
  } finally {
    release?.()
    try { if (browser) await within(browser.close(), "close browser") }
    finally { await within(Promise.resolve(server.stop(true)), "stop fixture server") }
  }
}

const planner = `<div class="table-scroll"><table><tbody><tr><td>Planning line</td><td>Licenses</td><td><form data-command="save" data-page="OPEX" data-record="line" data-version="1"><input name="versionId" value="v1"><input name="collection" value="lines">${["b", "a", "f"].flatMap((prefix) => Array.from({ length: 12 }, (_, index) => `<input name="${prefix}${index}" value="100">`)).join("")}<button type="submit">Save row</button></form></td></tr></tbody></table></div><script>${plannerMonthlyScript}</script>`

test("monthly apply freezes its draft and replays the exact admitted request after a lost response", async () => {
  const calls: { body: string; key: string | null }[] = []
  const admitted = new Set<string | null>()
  const wait: { release?: () => void; started?: () => void } = {}
  const started = new Promise<void>((resolve) => { wait.started = resolve })
  try {
    await browserCase(planner, async (request) => {
      const body = await request.text()
      const input = JSON.parse(body)
      const result = { status: "ok", value: { rows: input.input.drafts.map((draft: unknown) => ({ draft, errors: [], result: { ok: true } })) } }
      if (input.action !== "apply") return Response.json(result)
      calls.push({ body, key: request.headers.get("idempotency-key") })
      admitted.add(request.headers.get("idempotency-key"))
      if (calls.length === 1) {
        await new Promise<void>((resolve) => { wait.release = resolve; wait.started?.() })
        return new Response("response interrupted after admission")
      }
      return Response.json(result)
    }, async (page) => {
      const cell = page.locator('section input[data-row="line"][data-month="1"]')
      await cell.fill("42")
      await page.getByRole("button", { name: "Preview changes", exact: true }).click()
      await page.getByText("Preview complete. Review the entries and save when ready.").waitFor()
      await page.getByRole("button", { name: "Save changes", exact: true }).click()
      await within(started, "monthly apply entered the delayed handler")
      expect(await cell.isDisabled()).toBe(true)
      expect(await page.getByLabel("Measure", { exact: true }).isDisabled()).toBe(true)
      wait.release?.()
      await page.getByText("Could not confirm the operation. Your entries are preserved and locked; retry the same save request.").waitFor()
      expect(await cell.isDisabled()).toBe(true)
      expect(await page.getByRole("button", { name: "Preview changes", exact: true }).isDisabled()).toBe(true)
      await cell.evaluate((element) => {
        if (!(element instanceof HTMLInputElement)) throw new Error("expected input")
        element.value = "999"
        element.dispatchEvent(new Event("input", { bubbles: true }))
      })
      expect(await cell.inputValue()).toBe("42")
      await page.getByRole("button", { name: "Save changes", exact: true }).click()
      await page.getByText("Changes saved. Refresh before editing these rows again.").waitFor()
      expect(calls).toHaveLength(2)
      expect(calls[1]).toEqual(calls[0])
      expect(JSON.parse(calls[0]!.body).input).not.toHaveProperty("operation")
      expect(JSON.parse(calls[0]!.body).input).not.toHaveProperty("entity")
      expect(admitted.size).toBe(1)
      expect(await cell.isDisabled()).toBe(true)
      expect(await cell.inputValue()).toBe("42")
      expect(await page.locator("form[data-dirty]").count()).toBe(0)
    }, () => wait.release?.())
  } finally { wait.release?.() }
}, 30_000)

test("the live monthly grid exposes only the published draft contract and preserves the existing record form", async () => {
  await browserCase(planner, () => Response.json({ status: "unavailable" }, { status: 503 }), async (page) => {
    expect(await page.getByRole("button", { name: "Preview annual budget", exact: true }).count()).toBe(0)
    expect(await page.getByRole("button", { name: "Preview spread", exact: true }).count()).toBe(0)
    expect(await page.getByRole("button", { name: "Preview reset", exact: true }).count()).toBe(0)
    expect(await page.getByRole("button", { name: "Apply budget change", exact: true }).count()).toBe(0)
    expect(await page.getByLabel("Annual budget", { exact: true }).count()).toBe(0)
    expect(await page.getByText("This grid saves monthly values. For annual budgets, spread and reset, use the actions available on each record below.", { exact: true }).isVisible()).toBe(true)
    expect(await page.locator('form[data-command="save"][data-record="line"]').count()).toBe(1)
    expect(await page.getByRole("button", { name: "Save row", exact: true }).isVisible()).toBe(true)
  })
}, 30_000)

test("monthly apply times out while reading an unfinished response body and retries the identical request", async () => {
  const attempts: { body: string; key: string | null }[] = []
  const stream: { close?: () => void } = {}
  await browserCase(planner, async (request) => {
    const body = await request.text()
    const input = JSON.parse(body)
    const result = { status: "ok", value: { rows: input.input.drafts.map((draft: unknown) => ({ draft, errors: [], result: { ok: true } })) } }
    if (input.action === "apply") {
      attempts.push({ body, key: request.headers.get("idempotency-key") })
      if (attempts.length === 1) {
        const unfinished = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"status":"ok","value":'))
            stream.close = () => { stream.close = undefined; controller.close() }
          },
          cancel() { stream.close = undefined },
        })
        return new Response(unfinished, { headers: { "Content-Type": "application/json", "X-Fixture-Body-Pending": "yes" } })
      }
    }
    return Response.json(result)
  }, async (page) => {
    const cell = page.locator('section input[data-row="line"][data-month="1"]')
    await cell.fill("42")
    await page.getByRole("button", { name: "Preview changes", exact: true }).click()
    await page.getByText("Preview complete. Review the entries and save when ready.").waitFor()
    const headers = page.waitForResponse((response) => response.headers()["x-fixture-body-pending"] === "yes")
    const aborted = page.waitForEvent("requestfailed", { predicate: (request) => new URL(request.url()).searchParams.get("sf") === "workbench-planner", timeout: 15_000 })
    await page.getByRole("button", { name: "Save changes", exact: true }).click()
    expect((await headers).status()).toBe(200)
    expect(await cell.isDisabled()).toBe(true)
    const [failed] = await Promise.all([
      aborted,
      page.getByText("Could not confirm the operation. Your entries are preserved and locked; retry the same save request.", { exact: true }).waitFor({ timeout: 15_000 }),
    ])
    expect(failed.failure()?.errorText).toContain("ERR_ABORTED")
    expect(await cell.inputValue()).toBe("42")
    expect(await cell.isDisabled()).toBe(true)
    expect(await page.getByRole("button", { name: "Save changes", exact: true }).isDisabled()).toBe(false)
    await page.getByRole("button", { name: "Save changes", exact: true }).click()
    await page.getByText("Changes saved. Refresh before editing these rows again.").waitFor()
    expect(attempts).toHaveLength(2)
    expect(attempts[1]).toEqual(attempts[0])
    expect(await cell.inputValue()).toBe("42")
    expect(await page.locator("form[data-dirty]").count()).toBe(0)
  }, () => stream.close?.())
}, 30_000)

const caseRef = { id: "case", incarnation: "incarnation", version: 1 }
const request = { caseRef, objective: "Compare alternatives", profileId: "finance", profileVersion: "1", skillId: "sf-comparar-cenarios", skillVersion: "1", manifestDigest: "digest", outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: [] }
const scenario = `<form data-scenario-analysis data-config='${JSON.stringify({ request, alternatives: [{ id: "first", version: 1 }, { id: "second", version: 1 }], model: { id: "model", providerID: "provider" } })}'><label>First<select name="first"><option value="0">First</option><option value="1">Second</option></select></label><label>Second<select name="second"><option value="0">First</option><option value="1" selected>Second</option></select></label><button type="submit">Start specialist analysis</button><p role="status"></p></form><script>${forecastAnalysisScript}</script>`

test("scenario analysis retries the prepared input and admission key without preparing another run", async () => {
  const starts: { body: string; key: string | null }[] = []
  let prepares = 0
  await browserCase(scenario, async (request) => {
    const body = await request.text()
    if (JSON.parse(body).action === "prepare") { prepares++; return Response.json({ status: "ok", value: { binding: "prepared-source-v1" } }) }
    starts.push({ body, key: request.headers.get("idempotency-key") })
    if (starts.length === 1) return new Response("response interrupted after admission")
    return Response.json({ status: "ok", value: { runRef: "same-run" } })
  }, async (page) => {
    await page.getByRole("button", { name: "Start specialist analysis", exact: true }).click()
    await page.getByText("Could not confirm whether analysis started. Retry the same request to recover its result.").waitFor()
    expect(await page.locator('[data-scenario-analysis] select[name="first"]').isDisabled()).toBe(true)
    expect(await page.locator('[data-scenario-analysis] select[name="second"]').isDisabled()).toBe(true)
    await page.getByRole("button", { name: "Retry the same analysis request", exact: true }).click()
    await page.getByText("Analysis started. Follow progress in analysis history.").waitFor()
    expect(prepares).toBe(1)
    expect(starts).toHaveLength(2)
    expect(starts[1]).toEqual(starts[0])
  })
}, 30_000)

test("decision framing retries its exact prepared input and start key without preparing again", async () => {
  const framingRequest = { ...request, objective: "Frame this decision", skillId: "sf-enquadrar-decisao" }
  const model = { id: "model", providerID: "provider" }
  const intent = `<form data-intent-analysis data-config='${JSON.stringify({ request: framingRequest, model })}'><button type="submit">Prepare decision framing</button><p role="status"></p></form><script>${forecastAnalysisScript}</script>`
  const preparedInput = { binding: "framing-source-v1", objective: "Frame this decision" }
  const preparations: string[] = []
  const starts: { body: string; key: string | null }[] = []
  await browserCase(intent, async (incoming) => {
    const body = await incoming.text()
    if (JSON.parse(body).action === "prepare") { preparations.push(body); return Response.json({ status: "ok", value: preparedInput }) }
    starts.push({ body, key: incoming.headers.get("idempotency-key") })
    return starts.length === 1 ? new Response("response lost after framing admission") : Response.json({ status: "ok", value: { runRef: "same-framing-run" } })
  }, async (page) => {
    await page.getByRole("button", { name: "Prepare decision framing", exact: true }).click()
    await page.getByText("Could not confirm whether analysis started. Retry the same request to recover its result.", { exact: true }).waitFor()
    await page.locator('[data-intent-analysis]').dispatchEvent("change")
    await page.getByRole("button", { name: "Retry the same analysis request", exact: true }).click()
    await page.getByText("Analysis started. Follow progress in analysis history.", { exact: true }).waitFor()
    expect(preparations).toHaveLength(1)
    expect(JSON.parse(preparations[0]!)).toEqual({ action: "prepare", input: { request: framingRequest, selection: {} } })
    expect(starts).toHaveLength(2)
    expect(starts[1]).toEqual(starts[0])
    expect(JSON.parse(starts[0]!.body)).toEqual({ action: "start", input: { request: framingRequest, skillInput: preparedInput, model } })
    expect(await page.locator('[data-intent-analysis] button[type="submit"]').isDisabled()).toBe(true)
    await page.locator('[data-intent-analysis]').dispatchEvent("submit")
    expect(starts).toHaveLength(2)
  })
}, 30_000)

test.each([401, 403])("scenario %i revokes its options and configuration and prevents another start", async (denial) => {
  const actions: string[] = []
  await browserCase(scenario, async (incoming) => {
    const command = await incoming.json()
    actions.push(command.action)
    return command.action === "prepare" ? Response.json({ status: "ok", value: { binding: "restricted-preparation" } }) : Response.json({ status: "denied", detail: "PRIVATE-ANALYSIS-DENIAL" }, { status: denial })
  }, async (page) => {
    await page.locator('[data-scenario-analysis]').dispatchEvent("change")
    await page.getByRole("button", { name: "Start specialist analysis", exact: true }).click()
    await page.getByText("Analysis access changed. Reopen this decision with your current access.", { exact: true }).waitFor()
    expect(await page.locator('[data-scenario-analysis] option').count()).toBe(0)
    expect(await page.locator('[data-scenario-analysis]').getAttribute("data-config")).toBeNull()
    expect(await page.locator('[data-scenario-analysis]').getAttribute("data-dirty")).toBeNull()
    expect(await page.locator('[data-scenario-analysis] select[name="first"]').isDisabled()).toBe(true)
    expect(await page.locator('[data-scenario-analysis] select[name="second"]').isDisabled()).toBe(true)
    expect(await page.locator('[data-scenario-analysis] button[type="submit"]').isDisabled()).toBe(true)
    expect(await page.content()).not.toContain("PRIVATE-ANALYSIS-DENIAL")
    await page.locator('[data-scenario-analysis]').dispatchEvent("submit")
    expect(actions).toEqual(["prepare", "start"])
  })
}, 30_000)

const forecast = `<form data-forecast-analysis data-config='${JSON.stringify({ ...request, skillId: "sf-explicar-forecast", models: [{ id: "model", providerID: "provider" }] })}'><label>Baseline<select name="baseRef"><option>base</option></select></label><label>Comparison<select name="candidateRef"><option>candidate</option></select></label><label>Start<input name="start" value="2027-01-01"></label><label>End<input name="end" value="2027-12-31"></label><label>Currency<input name="currency" value="USD"></label><label>Model<select name="model"><option value="0">Model</option></select></label><button>Start analysis</button><button type="button" data-analysis-cancel hidden>Cancel analysis</button><p role="status"></p></form><script>${forecastAnalysisScript}</script>`

test("forecast start recovers an uncertain admission without changing its model or payload", async () => {
  const starts: { body: string; key: string | null }[] = []
  let prepares = 0
  await browserCase(forecast, async (request) => {
    const body = await request.text()
    if (new URL(request.url).searchParams.get("sf") === "workbench-forecast") { prepares++; return Response.json({ status: "ok", value: { binding: "forecast-v1" } }) }
    if (JSON.parse(body).action === "read") return Response.json({ status: "ok", value: { runRef: "forecast-run", state: "running" } })
    starts.push({ body, key: request.headers.get("idempotency-key") })
    if (starts.length === 1) return new Response("response interrupted after admission")
    return Response.json({ status: "ok", value: { runRef: "forecast-run" } })
  }, async (page) => {
    await page.getByRole("button", { name: "Start analysis", exact: true }).click()
    await page.getByText("Could not confirm whether analysis started. Retry the same request to recover its result.").waitFor()
    expect(await page.getByLabel("Currency", { exact: true }).isDisabled()).toBe(true)
    expect(await page.locator('[data-forecast-analysis] select[name="model"]').isDisabled()).toBe(true)
    await page.getByRole("button", { name: "Retry the same analysis request", exact: true }).click()
    await page.getByText("Analysis: running.", { exact: true }).waitFor()
    expect(prepares).toBe(1)
    expect(starts).toHaveLength(2)
    expect(starts[1]).toEqual(starts[0])
    expect(await page.getByRole("button", { name: "Start analysis", exact: true }).isDisabled()).toBe(true)
    expect(await page.getByRole("button", { name: "Refresh analysis status", exact: true }).isVisible()).toBe(true)
  })
}, 30_000)

const history = `<section data-analysis-history data-case='${JSON.stringify(caseRef)}'><h3>Analysis history</h3><p role="status"></p><div data-results></div></section><script>${forecastAnalysisScript}</script>`

test("history preserves a reason on transient failure, then removes restricted output on revocation", async () => {
  const state = { mode: "ready" }
  await browserCase(history, async (request) => {
    const input = await request.json()
    if (input.action === "output") return Response.json({ status: "ok", value: { html: "<p>Restricted source contribution</p>", outputRef: "output" } })
    if (state.mode === "transient") return Response.json({ status: "unavailable" }, { status: 503 })
    if (state.mode === "denied") return Response.json({ status: "denied" }, { status: 403 })
    return Response.json({ status: "ok", value: [{ runRef: "run", state: "ready", version: 1, outputRef: "output" }] })
  }, async (page) => {
    await page.getByRole("button", { name: "Open result", exact: true }).click()
    const reason = page.getByLabel("Reason for accepting this contribution")
    await reason.fill("My unsent reason")
    state.mode = "transient"
    await page.locator("[data-analysis-history]").dispatchEvent("sf-analysis-refresh")
    await page.getByText("Analysis history unavailable. Your open result and reason are preserved.").waitFor()
    expect(await reason.inputValue()).toBe("My unsent reason")
    expect(await page.getByText("Restricted source contribution", { exact: true }).isVisible()).toBe(true)
    state.mode = "ready"
    await page.locator("[data-analysis-history]").dispatchEvent("sf-analysis-refresh")
    expect(await reason.inputValue()).toBe("My unsent reason")
    state.mode = "denied"
    await page.locator("[data-analysis-history]").dispatchEvent("sf-analysis-refresh")
    await page.getByText("Analysis access changed. Reopen the decision with your current access.").waitFor()
    expect(await page.getByText("Restricted source contribution", { exact: true }).count()).toBe(0)
    expect(await page.locator("textarea").count()).toBe(0)
    expect(await page.locator("[data-analysis-history]").getAttribute("data-case")).toBeNull()
  })
}, 30_000)

test("a stale analysis preserves the reason but disables acceptance and removes its old result", async () => {
  const state = { mode: "ready" }
  await browserCase(history, async (request) => {
    if ((await request.json()).action === "output") return Response.json({ status: "ok", value: { html: "<p>Prior calculation</p>", outputRef: "output" } })
    return Response.json({ status: "ok", value: [{ runRef: "run", state: state.mode, version: state.mode === "ready" ? 1 : 2, outputRef: "output" }] })
  }, async (page) => {
    await page.getByRole("button", { name: "Open result", exact: true }).click()
    await page.getByLabel("Reason for accepting this contribution").fill("Keep this reason")
    state.mode = "stale"
    await page.locator("[data-analysis-history]").dispatchEvent("sf-analysis-refresh")
    await page.getByText(/This result changed/).waitFor()
    expect(await page.getByLabel("Reason for accepting this contribution").inputValue()).toBe("Keep this reason")
    expect(await page.getByRole("button", { name: "Accept contribution", exact: true }).isDisabled()).toBe(true)
    expect(await page.getByText("Prior calculation", { exact: true }).count()).toBe(0)
  })
}, 30_000)

const conversation = `<article data-case-thread data-thread="question" data-case='${JSON.stringify(caseRef)}'><h4>Restricted question</h4><button type="button" data-open-thread>Open conversation</button><div data-thread-messages></div><p role="status"></p></article><script>${caseQuestionScript}</script>`

test("conversation refresh asks before discarding an unsent reply and preserves it when reading fails", async () => {
  const state = { mode: "ready", reads: 0 }
  await browserCase(conversation, () => {
    state.reads++
    if (state.mode === "transient") return Response.json({ status: "unavailable" }, { status: 503 })
    if (state.mode === "denied") return Response.json({ status: "denied" }, { status: 403 })
    return Response.json({ status: "ok", value: { state: "open", messages: [{ id: "question", body: "Private question body" }] } })
  }, async (page) => {
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    const reply = page.getByLabel("Reply", { exact: true })
    await reply.fill("My reply is not sent")
    page.once("dialog", (dialog) => dialog.dismiss())
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    expect(state.reads).toBe(1)
    expect(await reply.inputValue()).toBe("My reply is not sent")
    state.mode = "transient"
    page.once("dialog", (dialog) => dialog.accept())
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await page.getByText("Conversation unavailable. Your unsent reply is preserved.").waitFor()
    expect(await reply.inputValue()).toBe("My reply is not sent")
    expect(await reply.isDisabled()).toBe(false)
    state.mode = "denied"
    page.once("dialog", (dialog) => dialog.accept())
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await page.getByText("Conversation access changed. Reopen the decision with your current access.").waitFor()
    expect(await page.getByText("Private question body", { exact: true }).count()).toBe(0)
    expect(await page.getByText("Restricted question", { exact: true }).count()).toBe(0)
    expect(await page.locator("textarea").count()).toBe(0)
  })
}, 30_000)

test("reply retry preserves the exact thread mutation after an uncertain write", async () => {
  const replies: { body: string; key: string | null }[] = []
  await browserCase(conversation, async (request) => {
    const mode = new URL(request.url).searchParams.get("sf")
    if (mode === "collaboration-storage-version") return Response.json({ status: "ok", value: 4 })
    if (mode === "collaboration-thread-reply") {
      replies.push({ body: await request.text(), key: request.headers.get("idempotency-key") })
      if (replies.length === 1) return new Response("response interrupted after admission")
      return Response.json({ status: "ok", value: {} })
    }
    return Response.json({ status: "ok", value: { state: "open", messages: [{ id: "question", body: "Question" }, ...(replies.length ? [{ id: "reply", body: "Confirmed answer" }] : [])] } })
  }, async (page) => {
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await page.getByLabel("Reply", { exact: true }).fill("Confirmed answer")
    await page.getByRole("button", { name: "Send reply", exact: true }).click()
    await page.getByText("Could not confirm the reply. Your text is preserved; retry the same request.").waitFor()
    expect(await page.getByLabel("Reply", { exact: true }).isDisabled()).toBe(true)
    expect(await page.getByRole("button", { name: "Open conversation", exact: true }).isDisabled()).toBe(true)
    await page.getByRole("button", { name: "Send reply", exact: true }).click()
    await page.getByText("Confirmed answer", { exact: true }).waitFor()
    expect(replies).toHaveLength(2)
    expect(replies[1]).toEqual(replies[0])
    expect(await page.getByLabel("Reply", { exact: true }).inputValue()).toBe("")
  })
}, 30_000)

test("an unknown monthly write followed by a row conflict remains unresolved and locked", async () => {
  const attempts: { body: string; key: string | null }[] = []
  await browserCase(planner, async (request) => {
    const body = await request.text()
    const input = JSON.parse(body)
    if (input.action === "apply") {
      attempts.push({ body, key: request.headers.get("idempotency-key") })
      if (attempts.length === 1) return new Response("response lost after admission")
    }
    return Response.json({ status: "ok", value: { rows: input.input.drafts.map((draft: unknown) => ({ draft, errors: [], result: input.action === "apply" ? { ok: false, status: 409, stored: { b: [42] } } : { ok: true } })) } })
  }, async (page) => {
    const cell = page.locator('section input[data-row="line"][data-month="1"]')
    await cell.fill("42")
    await page.getByRole("button", { name: "Preview changes", exact: true }).click()
    await page.getByText("Preview complete. Review the entries and save when ready.").waitFor()
    await page.getByRole("button", { name: "Save changes", exact: true }).click()
    await page.getByText("Could not confirm the operation. Your entries are preserved and locked; retry the same save request.").waitFor()
    await page.getByRole("button", { name: "Save changes", exact: true }).click()
    await page.getByText(/The retry could not reconcile the earlier save/).waitFor()
    expect(attempts[1]).toEqual(attempts[0])
    expect(await cell.inputValue()).toBe("42")
    expect(await cell.isDisabled()).toBe(true)
    expect(await page.getByRole("button", { name: "Save changes", exact: true }).isDisabled()).toBe(true)
    expect(await page.getByRole("button", { name: "Preview changes", exact: true }).isDisabled()).toBe(true)
    expect(await page.getByText("budget month 1: current 42; your entry 42", { exact: true }).isVisible()).toBe(true)
    expect(await page.locator("form[data-dirty]").count()).toBe(1)
  })
}, 30_000)

test("a definitive rejected analysis start unlocks input without treating it as an uncertain admission", async () => {
  await browserCase(scenario, async (request) => (await request.json()).action === "prepare"
    ? Response.json({ status: "ok", value: { binding: "source" } })
    : Response.json({ status: "stale" }, { status: 409 }), async (page) => {
    await page.getByRole("button", { name: "Start specialist analysis", exact: true }).click()
    await page.getByText("The analysis request was rejected. Review the alternatives and current decision before retrying.").waitFor()
    expect(await page.locator('[data-scenario-analysis] select[name="first"]').isDisabled()).toBe(false)
    expect(await page.locator('[data-scenario-analysis] select[name="second"]').isDisabled()).toBe(false)
    expect(await page.getByRole("button", { name: "Start specialist analysis", exact: true }).isDisabled()).toBe(false)
  })
}, 30_000)

test("a queued history refresh observes a new run after an older empty list finishes", async () => {
  const wait: { release?: () => void; started?: () => void; calls: number } = { calls: 0 }
  const started = new Promise<void>((resolve) => { wait.started = resolve })
  try {
    await browserCase(history, async () => {
      wait.calls++
      if (wait.calls === 1) {
        await new Promise<void>((resolve) => { wait.release = resolve; wait.started?.() })
        return Response.json({ status: "ok", value: [] })
      }
      return Response.json({ status: "ok", value: [{ runRef: "new-run", state: "ready", version: 1 }] })
    }, async (page) => {
      await within(started, "first history list entered the delayed handler")
      await page.locator("[data-analysis-history]").dispatchEvent("sf-analysis-refresh")
      wait.release?.()
      await page.getByRole("button", { name: "Open result", exact: true }).waitFor()
      expect(wait.calls).toBe(2)
    }, () => wait.release?.())
  } finally { wait.release?.() }
}, 30_000)

test("an earlier authorized list cannot repopulate results after an output revocation", async () => {
  const wait: { release?: () => void; started?: () => void; calls: number } = { calls: 0 }
  const started = new Promise<void>((resolve) => { wait.started = resolve })
  try {
    await browserCase(history, async (request) => {
      if ((await request.json()).action === "output") return Response.json({ status: "denied" }, { status: 403 })
      wait.calls++
      if (wait.calls === 2) await new Promise<void>((resolve) => { wait.release = resolve; wait.started?.() })
      return Response.json({ status: "ok", value: [{ runRef: "run", state: "ready", version: 1, outputRef: "private-output" }] })
    }, async (page) => {
      await page.getByRole("button", { name: "Open result", exact: true }).waitFor()
      await page.locator("[data-analysis-history]").dispatchEvent("sf-analysis-refresh")
      await within(started, "history refresh entered the delayed handler")
      await page.getByRole("button", { name: "Open result", exact: true }).click()
      await page.getByText("Analysis access changed. Reopen the decision with your current access.").waitFor()
      wait.release?.()
      await page.waitForLoadState("networkidle")
      expect(await page.locator("[data-results] article").count()).toBe(0)
      expect(await page.getByText("Analysis access changed. Reopen the decision with your current access.").isVisible()).toBe(true)
      expect(wait.calls).toBe(2)
    }, () => wait.release?.())
  } finally { wait.release?.() }
}, 30_000)

test("answer confirmation preflight failure restores the reply and conversation controls", async () => {
  await browserCase(conversation, (request) => new URL(request.url).searchParams.get("sf") === "collaboration-thread-read"
    ? Response.json({ status: "ok", value: { state: "open", recipientRef: "recipient", messages: [{ id: "question", body: "Question" }, { id: "answer", authorRef: "recipient", body: "Answer" }] } })
    : Response.json({ status: "unavailable" }, { status: 503 }), async (page) => {
    await page.getByRole("button", { name: "Open conversation", exact: true }).click()
    await page.getByLabel("Reply", { exact: true }).fill("Unsent draft")
    page.once("dialog", (dialog) => dialog.accept())
    await page.getByRole("button", { name: "Confirm this answer and add to decision", exact: true }).click()
    await page.getByText("Could not confirm the answer. Retry this same request.").waitFor()
    expect(await page.getByLabel("Reply", { exact: true }).isDisabled()).toBe(false)
    expect(await page.getByLabel("Reply", { exact: true }).inputValue()).toBe("Unsent draft")
    expect(await page.getByRole("button", { name: "Open conversation", exact: true }).isDisabled()).toBe(false)
    expect(await page.getByRole("button", { name: "Send reply", exact: true }).isDisabled()).toBe(false)
  })
}, 30_000)

const questionContext = { caseRef, period: { start: "2027-01-01", end: "2027-12-31" }, sources: [{ refId: "restricted-record", target: { incarnation: "record-incarnation", version: 3, recordType: "budget", surface: "planner" } }] }
const questionForm = `<form data-case-question data-context='${JSON.stringify(questionContext)}'><label>Record<select name="source"><option value="0">Restricted budget source</option></select></label><button type="button" data-find-recipients>Find recipients</button><label>Recipient<select name="recipient" required><option value="recipient-1" selected>Restricted recipient</option></select></label><label>Question<textarea name="question" required></textarea></label><button type="submit">Create question</button><p role="status"></p></form><script>${caseQuestionScript}</script>`

test.each([401, 403])("question %i clears the draft and context and fences an older recipient response", async (denial) => {
  const gate: { release?: () => void; started?: () => void } = {}
  const started = new Promise<void>((resolve) => { gate.started = resolve })
  const calls: string[] = []
  await browserCase(questionForm, async (request) => {
    const mode = new URL(request.url).searchParams.get("sf")!
    calls.push(mode)
    if (mode === "collaboration-recipient-list") {
      await new Promise<void>((resolve) => { gate.release = resolve; gate.started?.() })
      return Response.json({ status: "ok", value: [{ id: "late-recipient", name: "Late restricted recipient" }] }, { headers: { "X-Late-Fixture": "question-recipients" } })
    }
    return Response.json({ status: "denied", detail: "PRIVATE-DENIAL" }, { status: denial })
  }, async (page) => {
    await page.getByLabel("Question", { exact: true }).fill("Private unsent question")
    await page.getByRole("button", { name: "Find recipients", exact: true }).click()
    await within(started, "recipient lookup entered its delayed handler")
    await page.getByRole("button", { name: "Create question", exact: true }).click()
    await page.getByText("Question access changed. Reopen the decision with your current access.", { exact: true }).waitFor()
    expect(await page.locator('[data-case-question] input, [data-case-question] select, [data-case-question] textarea, [data-case-question] button').count()).toBe(0)
    expect(await page.locator('[data-case-question]').getAttribute("data-context")).toBeNull()
    expect(await page.locator('[data-case-question]').getAttribute("data-dirty")).toBeNull()
    const late = page.waitForResponse((response) => response.headers()["x-late-fixture"] === "question-recipients")
    gate.release?.()
    expect(await within((await late).finished(), "finish the older recipient response")).toBeNull()
    await within(page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))), "settle the older recipient response")
    expect(await page.locator('[data-case-question] select, [data-case-question] textarea').count()).toBe(0)
    expect(await page.content()).not.toContain("Late restricted recipient")
    expect(await page.content()).not.toContain("Restricted budget source")
    expect(await page.content()).not.toContain("restricted-record")
    expect(await page.content()).not.toContain("PRIVATE-DENIAL")
    await page.locator('[data-case-question]').dispatchEvent("submit")
    expect(calls).toEqual(["collaboration-recipient-list", "collaboration-storage-version"])
  }, () => gate.release?.())
}, 30_000)

test("transient question recipient and preflight failures preserve the selected recipient and editable draft", async () => {
  const calls: string[] = []
  await browserCase(questionForm, (request) => {
    calls.push(new URL(request.url).searchParams.get("sf")!)
    return Response.json({ status: "unavailable" }, { status: 503 })
  }, async (page) => {
    await page.getByLabel("Question", { exact: true }).fill("Keep my unsent question")
    await page.getByRole("button", { name: "Find recipients", exact: true }).click()
    await page.getByText("Recipients are temporarily unavailable. Your question and current selection are preserved; try again.", { exact: true }).waitFor()
    expect(await page.locator('[data-case-question] select[name="recipient"]').inputValue()).toBe("recipient-1")
    expect(await page.getByLabel("Question", { exact: true }).inputValue()).toBe("Keep my unsent question")
    await page.getByRole("button", { name: "Create question", exact: true }).click()
    await page.getByText("Could not prepare the question. Your entries are preserved; try again.", { exact: true }).waitFor()
    expect(await page.getByLabel("Question", { exact: true }).isDisabled()).toBe(false)
    expect(await page.getByLabel("Question", { exact: true }).inputValue()).toBe("Keep my unsent question")
    expect(await page.locator('[data-case-question] select[name="recipient"]').inputValue()).toBe("recipient-1")
    expect(await page.locator('[data-case-question]').getAttribute("data-context")).not.toBeNull()
    expect(await page.locator('[data-case-question]').getAttribute("data-dirty")).toBe("true")
    await page.getByLabel("Question", { exact: true }).fill("I can still correct the question")
    expect(calls).toEqual(["collaboration-recipient-list", "collaboration-storage-version"])
  })
}, 30_000)

test("question creation replays its frozen request after uncertainty and retries attachment without creating another thread", async () => {
  const creations: { body: string; key: string | null }[] = []
  const attachments: { body: string; key: string | null }[] = []
  const gate: { release?: () => void; started?: () => void; preflights: number } = { preflights: 0 }
  const started = new Promise<void>((resolve) => { gate.started = resolve })
  await browserCase(questionForm, async (request) => {
    const mode = new URL(request.url).searchParams.get("sf")
    if (mode === "collaboration-storage-version") { gate.preflights++; return Response.json({ status: "ok", value: 4 }) }
    if (mode === "collaboration-thread-create") {
      creations.push({ body: await request.text(), key: request.headers.get("idempotency-key") })
      if (creations.length === 1) { await new Promise<void>((resolve) => { gate.release = resolve; gate.started?.() }); return new Response("response lost after admission") }
      if (creations.length === 2) return Response.json({ status: "conflict" }, { status: 409 })
      return Response.json({ status: "ok", value: { id: "known-question" } })
    }
    if (mode === "decision-add-question") {
      attachments.push({ body: await request.text(), key: request.headers.get("idempotency-key") })
      return attachments.length === 1 ? Response.json({ status: "unavailable" }, { status: 503 }) : Response.json({ status: "ok", value: {} })
    }
    return Response.json({ status: "unavailable" }, { status: 503 })
  }, async (page) => {
    await page.getByLabel("Question", { exact: true }).fill("Original question")
    await page.getByRole("button", { name: "Create question", exact: true }).click()
    await within(started, "question create entered its delayed handler")
    expect(await page.getByLabel("Question", { exact: true }).isDisabled()).toBe(true)
    expect(await page.getByRole("button", { name: "Find recipients", exact: true }).isDisabled()).toBe(true)
    await page.locator('[data-case-question]').dispatchEvent("submit")
    await page.getByLabel("Question", { exact: true }).evaluate((element) => {
      if (!(element instanceof HTMLTextAreaElement)) throw new Error("expected question textarea")
      element.value = "Replacement must not become a new intention"
      element.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(await page.getByLabel("Question", { exact: true }).inputValue()).toBe("Original question")
    expect(creations).toHaveLength(1)
    gate.release?.()
    await page.getByText("Could not confirm the question. Your text is preserved and locked; retry the same request.", { exact: true }).waitFor()
    await page.getByRole("button", { name: "Retry same question", exact: true }).click()
    await page.getByText("Could not confirm the question. Your text is preserved and locked; retry the same request.", { exact: true }).waitFor()
    expect(await page.getByLabel("Question", { exact: true }).isDisabled()).toBe(true)
    expect(creations).toHaveLength(2)
    await page.getByRole("button", { name: "Retry same question", exact: true }).click()
    await page.getByText("The question exists but could not be added to this decision. Retry the same request.", { exact: true }).waitFor()
    expect(creations).toHaveLength(3)
    expect(await page.getByLabel("Question", { exact: true }).isDisabled()).toBe(true)
    await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Retry adding question", exact: true }).click()])
    expect(gate.preflights).toBe(1)
    expect(creations).toHaveLength(3)
    expect(creations.every((attempt) => attempt.body === creations[0]!.body && attempt.key === creations[0]!.key)).toBe(true)
    expect(JSON.parse(creations[0]!.body)).toMatchObject({ draft: { body: "Original question", recipientRef: "recipient-1", sourceRef: "restricted-record" }, mutation: { expectedStorageVersion: 4, idempotencyKey: creations[0]!.key } })
    expect(attachments).toHaveLength(2)
    expect(attachments[1]).toEqual(attachments[0])
    expect(JSON.parse(attachments[0]!.body)).toEqual({ caseRef, questionRef: "known-question" })
  }, () => gate.release?.())
}, 30_000)

test("an initial definite question rejection permits correction with a new request identity", async () => {
  const creations: { key: string | null; body: string }[] = []
  await browserCase(questionForm, async (request) => {
    if (new URL(request.url).searchParams.get("sf") === "collaboration-storage-version") return Response.json({ status: "ok", value: 4 })
    creations.push({ key: request.headers.get("idempotency-key"), body: await request.text() })
    return Response.json({ status: "needs-input" }, { status: 400 })
  }, async (page) => {
    await page.getByLabel("Question", { exact: true }).fill("First question")
    await page.getByRole("button", { name: "Create question", exact: true }).click()
    await page.getByText("The question request was rejected. Your entries are preserved; review the record and recipient before trying again.", { exact: true }).waitFor()
    expect(await page.getByLabel("Question", { exact: true }).isDisabled()).toBe(false)
    await page.getByLabel("Question", { exact: true }).fill("Corrected question")
    await page.getByRole("button", { name: "Create question", exact: true }).click()
    await page.getByText("The question request was rejected. Your entries are preserved; review the record and recipient before trying again.", { exact: true }).waitFor()
    expect(creations).toHaveLength(2)
    expect(creations[1]!.key).not.toBe(creations[0]!.key)
    expect(JSON.parse(creations[1]!.body).draft.body).toBe("Corrected question")
  })
}, 30_000)
