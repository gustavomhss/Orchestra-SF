import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { sourcingAnalysisScript } from "../../../../../modules/sucafina/Sucafinav1/product/procurement/sourcing-analysis"
import { analysisHistoryScript } from "../../../../../modules/sucafina/Sucafinav1/product/ui/forecast-analysis"
import { documentHtml, esc, pageMain } from "../../../../../modules/sucafina/Sucafinav1/src/screen-shell"

// This boundary test executes the production shell and controller with controlled
// transport replies. It proves no model, resident service, receipt or AI output.
test.describe.configure({ retries: 0 })

async function mountController(page: Page, options: { preparation?: Promise<void>; unconfirmedStart?: boolean } = {}) {
  const replies: { state: string; unavailable: boolean; holdNextRead?: Promise<void> } = { state: "running", unavailable: false }
  const traffic = { pages: 0, starts: 0, preparations: 0, lists: 0, cancels: 0, reads: [] as string[] }
  const config = {
    caseRef: { id: "controller-case", incarnation: "controller-incarnation", version: 1 }, objective: "Controller isolation only",
    profileId: "controller-profile", profileVersion: "1", skillId: "controller-skill", skillVersion: "1", manifestDigest: "controller-only",
    outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: [], requestRefs: ["controller-request"],
    models: [{ providerID: "controller-only", id: "never-executed" }],
  }
  await page.route("**/__wp04_sourcing_controller*", async (route) => {
    const request = route.request()
    if (request.method() === "GET") {
      traffic.pages += 1
      const body = `<section data-analysis-history data-case="${esc(JSON.stringify(config.caseRef))}"><h3>Analysis history</h3><p role="status"></p><div data-results></div></section>
        <form data-sourcing-analysis data-controller-render="${traffic.pages}" data-config="${esc(JSON.stringify(config))}">
          <label>Procurement request<select name="requestRef" required><option value="">Choose a request</option><option value="controller-request">Controller request</option></select></label>
          <label>Model<select name="model" required><option value="">Choose a model</option><option value="0">Never executed</option></select></label>
          <button type="submit">Start sourcing analysis</button><button type="button" data-sourcing-cancel hidden>Cancel analysis</button>
          <button type="button" data-sourcing-status hidden>Check analysis status</button><button type="button" data-sourcing-history>Refresh analysis history</button><p role="status"></p>
        </form>`
      const initialize = `;(() => { const initialize = () => {${analysisHistoryScript}${sourcingAnalysisScript}}; initialize(); new MutationObserver(initialize).observe(document.querySelector('#content'), { childList: true, subtree: true }) })();`
      const html = documentHtml("Sourcing controller boundary", "procurement", "", pageMain({ drawn: true, key: "Sourcing controller boundary", index: 0 }, body), "").replace("</script>", initialize + "</script>")
      await route.fulfill({ status: 200, contentType: "text/html", body: html })
      return
    }
    const mode = new URL(request.url()).searchParams.get("sf")
    const payload = request.postDataJSON() as { action?: string; runRef?: string }
    if (mode === "workbench-sourcing-input") {
      traffic.preparations += 1
      await options.preparation
      await route.fulfill({ json: { status: "ok", value: { controllerInput: true } } })
      return
    }
    if (payload.action === "start") {
      traffic.starts += 1
      await route.fulfill(options.unconfirmedStart ? { status: 503, json: { status: "unavailable" } } : { json: { status: "ok", value: { runRef: "observed-controller-run-" + traffic.starts } } })
      return
    }
    if (payload.action === "read") {
      traffic.reads.push(payload.runRef ?? "missing")
      const response = replies.unavailable ? { status: 503, json: { status: "unavailable" } } : { json: { status: "ok", value: { runRef: payload.runRef, state: replies.state } } }
      const held = replies.holdNextRead
      delete replies.holdNextRead
      await held
      await route.fulfill({ ...response, ...(held ? { headers: { "X-Controller-Delayed": "true" } } : {}) })
      return
    }
    if (payload.action === "cancel") {
      traffic.cancels += 1
      replies.state = "cancelled"
      await route.fulfill({ json: { status: "ok", value: { runRef: payload.runRef } } })
      return
    }
    if (payload.action === "list") {
      traffic.lists += 1
      await route.fulfill({ json: { status: "ok", value: [] } })
      return
    }
    await route.fulfill({ status: 400, json: { status: "invalid" } })
  })
  await page.goto("http://localhost/__wp04_sourcing_controller")
  const form = page.locator("form[data-sourcing-analysis]")
  await expect(form).toHaveAttribute("data-sf-sourcing-ready", "true")
  await form.getByRole("combobox", { name: "Procurement request", exact: true }).selectOption("controller-request")
  await form.getByRole("combobox", { name: "Model", exact: true }).selectOption("0")
  return { form, replies, traffic }
}

async function refreshShell(page: Page) {
  // Move focus outside forms, then await the exact refresh entry point used by
  // the shell's 30-second timer. Focus must not be what saves this controller.
  await page.getByRole("heading", { name: "Sourcing controller boundary", exact: true }).click()
  await page.evaluate(async () => {
    if (document.activeElement?.closest("form")) throw new Error("Focus still protects the form")
    const refresh = Reflect.get(window, "sucafinaRefresh")
    if (typeof refresh !== "function") throw new Error("Production shell refresh is unavailable")
    await refresh(true)
  })
}

test("isolated sourcing controller survives shell refresh while preparing, running and uncertain until an observed terminal read", async ({ page }, info) => {
  info.annotations.push({ type: "scope", description: "Isolated production DOM controller and shell; controlled responses; no native execution proof." })
  const prepared: { release?: () => void } = {}
  const preparation = new Promise<void>((resolve) => { prepared.release = resolve })
  const { form, replies, traffic } = await mountController(page, { preparation })
  const submit = form.getByRole("button", { name: "Start sourcing analysis", exact: true })
  const check = form.getByRole("button", { name: "Check analysis status", exact: true })
  try {
    await submit.click()
    await expect(form).toHaveAttribute("data-sf-sourcing-state", "preparing")
    await expect(submit).toBeDisabled()
    await refreshShell(page)
    expect(traffic.pages).toBe(2)
    expect(traffic.starts).toBe(0)
    await expect(form).toHaveAttribute("data-controller-render", "1")
    await expect(form).toHaveAttribute("data-dirty", "true")
  } finally { prepared.release?.() }

  await expect(form).toHaveAttribute("data-sf-sourcing-state", "running")
  await refreshShell(page)
  await expect(form).toHaveAttribute("data-controller-render", "1")
  await expect(submit).toBeDisabled()
  expect(traffic.starts).toBe(1)

  replies.unavailable = true
  await check.click()
  await expect(form).toHaveAttribute("data-sf-sourcing-state", "uncertain")
  await expect(check).toBeEnabled()
  await refreshShell(page)
  await expect(form).toHaveAttribute("data-controller-render", "1")
  await expect(submit).toBeDisabled()
  const lists = traffic.lists
  await form.getByRole("button", { name: "Refresh analysis history", exact: true }).click()
  await expect.poll(() => traffic.lists).toBeGreaterThan(lists)
  await expect(form).toHaveAttribute("data-dirty", "true")
  await expect(submit).toBeDisabled()

  replies.unavailable = false
  replies.state = "unrecognized-state"
  const unrecognized = page.waitForResponse((response) => response.request().method() === "POST" && response.request().postDataJSON().action === "read")
  await check.click()
  await unrecognized
  await expect(check).toBeEnabled()
  await expect(form).toHaveAttribute("data-sf-sourcing-state", "uncertain")
  await expect(form).toHaveAttribute("data-dirty", "true")
  await expect(submit).toBeDisabled()

  // A terminal read from the previous generation arrives after cancellation and
  // a deliberate new start. It must not unlock or overwrite the new run.
  const delayed: { release?: () => void } = {}
  replies.holdNextRead = new Promise<void>((resolve) => { delayed.release = resolve })
  replies.state = "ready"
  const reads = traffic.reads.length
  const stale = page.waitForResponse((response) => response.headers()["x-controller-delayed"] === "true")
  try {
    await check.click()
    await expect.poll(() => traffic.reads.length).toBeGreaterThan(reads)
    await form.getByRole("button", { name: "Cancel analysis", exact: true }).click()
    await expect(form).toHaveAttribute("data-sf-sourcing-state", "cancelled")
    await expect(submit).toBeEnabled()
    expect(traffic.reads.every((ref) => ref === "observed-controller-run-1")).toBe(true)
    replies.state = "running"
    await submit.click()
    await expect(form).toHaveAttribute("data-sf-sourcing-state", "running")
  } finally { delayed.release?.() }
  await (await stale).finished()
  await refreshShell(page)
  await expect(form).toHaveAttribute("data-controller-render", "1")
  await expect(form).toHaveAttribute("data-sf-sourcing-state", "running")
  await expect(form).toHaveAttribute("data-dirty", "true")
  await expect(submit).toBeDisabled()

  replies.state = "ready"
  await check.click()
  await expect(form).toHaveAttribute("data-sf-sourcing-state", "ready")
  await expect(form).not.toHaveAttribute("data-dirty")
  await expect(submit).toBeEnabled()
  expect(traffic.reads.length).toBeGreaterThanOrEqual(4)
  expect(traffic.reads.at(-1)).toBe("observed-controller-run-2")
  await refreshShell(page)
  await expect(form).not.toHaveAttribute("data-controller-render", "1")
  expect(traffic.starts).toBe(2)
  expect(traffic.preparations).toBe(2)
  expect(traffic.cancels).toBe(1)
})

test("isolated sourcing controller cannot repeat an unconfirmed start after history or shell refresh", async ({ page }, info) => {
  info.annotations.push({ type: "scope", description: "Isolated production DOM controller and shell; controlled lost-start response; no native execution proof." })
  const { form, traffic } = await mountController(page, { unconfirmedStart: true })
  const submit = form.getByRole("button", { name: "Start sourcing analysis", exact: true })
  await submit.click()
  await expect(form).toHaveAttribute("data-sf-sourcing-state", "uncertain")
  await expect(form.getByRole("status")).toContainText("Could not confirm whether analysis started")
  await refreshShell(page)
  expect(traffic.pages).toBe(2)
  await expect(form).toHaveAttribute("data-controller-render", "1")
  await expect(submit).toBeDisabled()
  const lists = traffic.lists
  await form.getByRole("button", { name: "Refresh analysis history", exact: true }).click()
  await expect.poll(() => traffic.lists).toBeGreaterThan(lists)
  await refreshShell(page)
  await expect(form).toHaveAttribute("data-controller-render", "1")
  await expect(form).toHaveAttribute("data-dirty", "true")
  await expect(submit).toBeDisabled()
  await form.evaluate((element) => {
    if (!(element instanceof HTMLFormElement)) throw new Error("Sourcing form is unavailable")
    element.requestSubmit()
  })
  expect(traffic.starts).toBe(1)
  expect(traffic.preparations).toBe(1)
  expect(traffic.reads).toEqual([])
})
