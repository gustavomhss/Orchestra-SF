import { expect } from "bun:test"
import type { Page } from "@playwright/test"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"
import { closeWp01Browser, launchWp01Browser } from "../wp01/browser-fixture.ts"
import { forecastPage } from "./fixture.ts"
import { readForecastControls } from "./controls.ts"

type RequestObservation = { mode: string; action: unknown; payload: unknown; key: string | null }
type Scenario = {
  state: SfNativeRunRecord["state"]
  started: boolean
  failReads: number
  denyReads: boolean
  loseCancelResponse: boolean
  lastRead?: { runRef: string; state: SfNativeRunRecord["state"]; version: number }
}

// Only the HTTP boundary and source/model data are fixtures. The actual renderer,
// controller, shell, native browser driver and state transitions in the DOM run.
export async function withForecastRun(
  name: string,
  work: (context: Awaited<ReturnType<typeof contextFor>>) => Promise<void>,
) {
  const context = await contextFor(name)
  try {
    await work(context)
    expect(context.pageErrors).toEqual([])
    expect(context.requests.every((request) => !!request.key)).toBe(true)
    expect(context.requests.filter((request) => request.mode === "workbench-forecast")).toHaveLength(1)
    expect(context.requests.filter((request) => request.action === "start")).toHaveLength(1)
    expect(context.requests.filter((request) => request.action === "read").every((request) =>
      JSON.stringify(request.payload) === JSON.stringify({ action: "read", runRef: context.runRef }))).toBe(true)
    console.info("SF_FORECAST_MATRIX_PROOF", JSON.stringify({ name, pageErrors: context.pageErrors,
      observations: context.observations, requests: context.requests.map((request) => ({
        mode: request.mode, action: request.action, payload: request.payload, keyPresent: !!request.key,
      })) }))
  } finally {
    try { await closeWp01Browser(context.browser) }
    finally { await context.server.stop(true) }
  }
}

async function contextFor(name: string) {
  const started = performance.now()
  const observed: { page?: Page } = {}
  const phase = async <T>(label: string, work: () => Promise<T>) => {
    const remaining = Math.floor(18_000 - (performance.now() - started))
    if (remaining <= 0) throw new Error(name + ": work deadline before " + label)
    observed.page?.setDefaultTimeout(Math.min(5_000, remaining))
    observed.page?.setDefaultNavigationTimeout(Math.min(5_000, remaining))
    const result = await work()
    if (performance.now() - started >= 18_000) throw new Error(name + ": work deadline after " + label)
    return result
  }
  const fixture = await phase("fixture", forecastPage)
  const runRef = "ui-fixture-run"
  const scenario: Scenario = { state: "running", started: false, failReads: 0, denyReads: false, loseCancelResponse: false }
  const requests: RequestObservation[] = []
  const pageErrors: string[] = []
  const observations: { phase: string; lastRead: Scenario["lastRead"]; controls: Awaited<ReturnType<typeof readForecastControls>> }[] = []
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => {
    const mode = new URL(request.url).searchParams.get("sf")
    if (request.method === "GET" && !mode) return new Response(fixture.html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
    if (request.method !== "POST" || !mode) return new Response(null, { status: 404 })
    const payload: unknown = await request.json()
    const action = payload && typeof payload === "object" && "action" in payload ? payload.action : undefined
    requests.push({ mode, action, payload, key: request.headers.get("Idempotency-Key") })
    if (mode === "workbench-forecast") return Response.json({ status: "ok", value: { uiFixtureBoundary: true, selectedForecast: "prepared-once" } })
    if (mode !== "workbench-analysis") return new Response(null, { status: 404 })
    if (action === "list") return Response.json({ status: "ok", value: scenario.started ? [{ runRef, state: scenario.state, version: 1 }] : [] })
    if (action === "start") { scenario.started = true; return Response.json({ status: "ok", value: { runRef } }) }
    if (action === "read") {
      if (scenario.denyReads) return Response.json({ status: "denied" }, { status: 403 })
      if (scenario.failReads > 0) { scenario.failReads--; return Response.json({ status: "unavailable" }, { status: 503 }) }
      scenario.lastRead = { runRef, state: scenario.state, version: 1 }
      return Response.json({ status: "ok", value: scenario.lastRead })
    }
    if (action === "cancel") {
      scenario.state = "cancelled"
      if (scenario.loseCancelResponse) return Response.json({ status: "unavailable" }, { status: 503 })
      return Response.json({ status: "ok", value: { runRef } })
    }
    if (action === "output") return Response.json({ status: "ok", value: { html: "<p>Forecast result supplied by the explicit UI fixture.</p>" } })
    return new Response(null, { status: 400 })
  } })
  const browser = await launchWp01Browser().catch(async (error) => { await server.stop(true); throw error })
  try {
    const page = await phase("page", () => browser.newPage())
    observed.page = page
    page.on("pageerror", (error) => pageErrors.push(error.message))
    expect((await phase("navigate", () => page.goto(server.url.href)))?.status()).toBe(200)
    const form = page.locator("form[data-forecast-analysis][data-sf-forecast-ready=true]")
    await phase("form ready", () => form.waitFor())
    await phase("history ready", () => page.locator("[data-analysis-history]").getByText("No analyses yet.", { exact: true }).waitFor())
    const submit = form.getByRole("button", { name: "Start analysis", exact: true })
    const cancel = form.locator("[data-analysis-cancel]")
    const retry = form.locator("button").filter({ hasText: /^Refresh analysis status$/ })
    const capture = async (label: string) => {
      const controls = await phase(label, () => readForecastControls(form))
      observations.push({ phase: label, lastRead: scenario.lastRead ? { ...scenario.lastRead } : undefined, controls })
      console.info("SF_FORECAST_CONTROL_STATE", JSON.stringify({ scenario: name, phase: label, lastRead: scenario.lastRead ?? null, controls }))
      return controls
    }
    const idle = await capture("idle")
    expect(idle.ready).toBe("true")
    expect(idle.cancel).toMatchObject({ hidden: true, hiddenAttribute: "", display: "none", rectangles: 0 })
    expect(idle.retry).toMatchObject({ hidden: true, hiddenAttribute: "", display: "none", rectangles: 0 })
    expect(idle.start).toMatchObject({ hidden: false, display: "flex", disabled: false })
    await phase("comparison", () => form.locator('select[name="candidateRef"]').selectOption(fixture.sources[1]!.refId))
    await phase("start period", () => form.getByLabel("Start", { exact: true }).fill("2027-02-01"))
    await phase("end period", () => form.getByLabel("End", { exact: true }).fill("2027-11-30"))
    await phase("currency", () => form.getByLabel("Currency", { exact: true }).fill("EUR"))
    const status = async (state: string) => phase("status " + state, () => form.getByText(state, { exact: true }).waitFor())
    return { fixture, scenario, requests, runRef, pageErrors, observations, server, browser, page, form, submit, cancel, retry, capture, phase, status }
  } catch (error) {
    try { await closeWp01Browser(browser) }
    finally { await server.stop(true) }
    throw error
  }
}
