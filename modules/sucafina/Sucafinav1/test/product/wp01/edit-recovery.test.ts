import { expect, test } from "bun:test"
import type { Page } from "@playwright/test"
import { plannerMonthlyScript } from "../../../product/ui/planner-monthly.ts"
import { caseQuestionScript } from "../../../product/ui/work-collaboration.ts"
import { forecastAnalysisScript } from "../../../product/ui/forecast-analysis.ts"

// These transport fixtures exercise the shipped browser consumers, including a lost
// response after admission. They do not qualify native execution or domain policy.
async function browserCase(body: string, post: (request: Request) => Response | Promise<Response>, check: (page: Page) => Promise<void>) {
  const server = Bun.serve({ hostname: "localhost", port: 0, fetch: (request) => request.method === "GET"
    ? new Response(`<!doctype html><html><body>${body}</body></html>`, { headers: { "Content-Type": "text/html" } })
    : post(request) })
  const { chromium } = await import("@playwright/test")
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] })
  try {
    const page = await browser.newPage()
    await page.goto(server.url.href)
    await check(page)
  } finally {
    await browser.close()
    await server.stop(true)
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
      await started
      expect(await cell.isDisabled()).toBe(true)
      expect(await page.getByLabel("Measure", { exact: true }).isDisabled()).toBe(true)
      expect(await page.getByLabel("Annual budget").isDisabled()).toBe(true)
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
      expect(admitted.size).toBe(1)
      expect(await cell.isDisabled()).toBe(true)
      expect(await cell.inputValue()).toBe("42")
      expect(await page.locator("form[data-dirty]").count()).toBe(0)
    })
  } finally { wait.release?.() }
}, 30_000)

test("an uncertain annual budget change also locks the monthly grid until exact retry", async () => {
  const calls: { body: string; key: string | null }[] = []
  await browserCase(planner, async (request) => {
    const body = await request.text()
    const input = JSON.parse(body)
    if (input.action === "apply") {
      calls.push({ body, key: request.headers.get("idempotency-key") })
      if (calls.length === 1) return new Response("response interrupted after admission")
    }
    return Response.json({ status: "ok", value: { operation: { errors: [], before: [{ month: 1, value: 100 }], after: [{ month: 1, value: 200 }], changedMonths: [1] } } })
  }, async (page) => {
    await page.getByLabel("Annual budget").fill("2400")
    await page.getByRole("button", { name: "Preview annual budget", exact: true }).click()
    await page.getByText(/current 100, proposed 200/).waitFor()
    await page.getByRole("button", { name: "Apply budget change", exact: true }).click()
    await page.getByText("Could not confirm the budget change. Your monthly entries are preserved; retry the same request.").waitFor()
    expect(await page.locator('section input[data-row="line"][data-month="1"]').isDisabled()).toBe(true)
    expect(await page.getByLabel("Measure", { exact: true }).isDisabled()).toBe(true)
    expect(await page.getByLabel("Annual budget").isDisabled()).toBe(true)
    expect(await page.getByRole("button", { name: "Preview annual budget", exact: true }).isDisabled()).toBe(true)
    await page.getByRole("button", { name: "Apply budget change", exact: true }).click()
    await page.getByText("Budget change saved. Refresh before editing these months again.").waitFor()
    expect(calls).toHaveLength(2)
    expect(calls[1]).toEqual(calls[0])
  })
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
    expect(await page.getByLabel("First", { exact: true }).isDisabled()).toBe(true)
    expect(await page.getByLabel("Second", { exact: true }).isDisabled()).toBe(true)
    await page.getByRole("button", { name: "Retry the same analysis request", exact: true }).click()
    await page.getByText("Analysis started. Follow progress in analysis history.").waitFor()
    expect(prepares).toBe(1)
    expect(starts).toHaveLength(2)
    expect(starts[1]).toEqual(starts[0])
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
    expect(await page.getByLabel("Model", { exact: true }).isDisabled()).toBe(true)
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
    expect(await page.getByLabel("First", { exact: true }).isDisabled()).toBe(false)
    expect(await page.getByLabel("Second", { exact: true }).isDisabled()).toBe(false)
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
      await started
      await page.locator("[data-analysis-history]").dispatchEvent("sf-analysis-refresh")
      wait.release?.()
      await page.getByRole("button", { name: "Open result", exact: true }).waitFor()
      expect(wait.calls).toBe(2)
    })
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
      await started
      await page.getByRole("button", { name: "Open result", exact: true }).click()
      await page.getByText("Analysis access changed. Reopen the decision with your current access.").waitFor()
      wait.release?.()
      await page.waitForLoadState("networkidle")
      expect(await page.locator("[data-results] article").count()).toBe(0)
      expect(await page.getByText("Analysis access changed. Reopen the decision with your current access.").isVisible()).toBe(true)
      expect(wait.calls).toBe(2)
    })
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
