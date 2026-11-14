import { expect, test } from "bun:test"
import path from "node:path"
import type { Page } from "@playwright/test"
import { ModelV2 } from "@orchestra/core/model"
import { Schema } from "effect"
import { closeWp01Browser, launchWp01Browser } from "../../wp01/browser-fixture.ts"
import { createResidentAiBundle } from "../../../../product/ai/resident.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { AuthorizedCaseProjection, BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { SfHostServices } from "../../../../product/contracts/host-context.ts"
import { forecastAnalysisForm, forecastAnalysisScript } from "../../../../product/ui/forecast-analysis.ts"
import { documentHtml, pageMain } from "../../../../src/screen-shell.ts"

// UI-only regression proof for FIN-IND-004. The renderer, distributed resident
// catalog, complete client script and browser form semantics are real. Case data
// and HTTP responses are explicit fixtures; no native run, financial producer,
// contribution acceptance or AM05 outcome is claimed by this test.
// Actions order: wp01/browser-startup.test.ts, this file, wp01/browser-lifecycle.test.ts.
async function forecastPage() {
  const root = path.resolve(import.meta.dir, "../../../../product/ai")
  const bundle = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/resident.json") })
  const profile = bundle.profiles.find((item) => item.id === "sf_finance")
  const skill = bundle.skills.find((item) => item.id === "sf-explicar-forecast")
  if (!profile || !skill) throw new Error("The installed finance profile and forecast skill must be present")
  const models = [Schema.decodeUnknownSync(ModelV2.Ref)({ providerID: "ui-fixture-catalog", id: "ui-fixture-model" })]
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const sources = ["baseline", "candidate"].map((id): BusinessEvidenceRef => {
    const ref: BusinessEvidenceRef = {
      schema: "sf-evidence-v1", refId: `ui-fixture-${id}`, installationId: "ui-fixture-installation", projectId: "ui-fixture-project",
      refDigest: "", evidenceLevel: "observed", kind: "record",
      target: { surface: "planner", recordType: "planner-version", recordId: id, incarnation: `ui-fixture-${id}-incarnation`, version: 1,
        fields: ["forecast"], period, projectionDigest: digestSfValue({ fixture: id }) },
    }
    return { ...ref, refDigest: digestSfEvidenceRef(ref) }
  })
  const projection: AuthorizedCaseProjection = {
    context: { installationId: "ui-fixture-installation", projectId: "ui-fixture-project", principalRef: "ui-fixture-reader", policyVersion: "1", accessRevision: "1", kind: "ui" },
    case: { id: "ui-fixture-case", incarnation: "ui-fixture-case-incarnation", version: 3, state: "investigating", objective: "Explain the selected forecast change",
      horizon: period, currency: "USD", criteria: [], participants: ["ui-fixture-reader"], sourceRefs: sources,
      alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] },
    events: [], evidenceRefs: sources, checkedAt: "2026-11-14T12:00:00Z",
  }
  const unavailable = async (): Promise<never> => { throw new Error("This renderer fixture must not call an in-process domain or native service") }
  const services: Pick<SfHostServices, "selected" | "models" | "analyses" | "forecastInputs"> = {
    selected: [{ profile, skills: [skill], manifestDigest: bundle.manifestDigest, operationIds: skill.allowedOperations }],
    models: async () => models,
    analyses: { start: unavailable, list: unavailable, read: unavailable, output: unavailable, cancel: unavailable },
    forecastInputs: { prepare: unavailable },
  }
  // forecastAnalysisForm currently accepts the full host type, but reads only
  // this catalog surface. This cast marks the UI fixture boundary, never a host.
  const form = await forecastAnalysisForm(projection, services as SfHostServices)
  const html = documentHtml("Dashboard", "dashboard", "", pageMain({ drawn: true, key: "Budget Overview", index: 2 }, `${form}<script>${forecastAnalysisScript}</script>`), "")
  const caseRef = { id: projection.case.id, incarnation: projection.case.incarnation, version: projection.case.version }
  return { html, sources, caseRef, request: {
    caseRef, objective: projection.case.objective, profileId: profile.id, profileVersion: profile.version,
    skillId: skill.id, skillVersion: skill.version, manifestDigest: bundle.manifestDigest,
    outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: skill.allowedOperations,
  }, model: models[0] }
}

for (const outcome of ["ready", "rejected"] as const) {
  test(outcome === "ready"
    ? "FIN-IND-004 real implicit forecast button prepares, starts, polls and displays the supplied result"
    : "FIN-IND-004 real keyboard submit reports rejected preparation without starting an analysis", async () => {
    const started = performance.now()
    const observed: { page?: Page; stage: string } = { stage: "fixture" }
    const pageErrors: string[] = []
    const clientEvents: { event: string; mode?: string; status?: number; message?: string }[] = []
    const client = (event: typeof clientEvents[number]) => {
      clientEvents.push(event)
      if (clientEvents.length > 24) clientEvents.shift()
      console.info("SF_FORECAST_BROWSER_CLIENT", JSON.stringify({ outcome, stage: observed.stage, elapsedMs: Math.round(performance.now() - started), ...event }))
    }
    // Native Playwright action/navigation timeouts reject the actual operation.
    // Keep work within 18s, leaving the existing pool's at-most-10s release inside
    // Bun's unchanged 30s budget. No detached Promise.race work is introduced.
    const phase = async <T>(name: string, work: () => Promise<T>) => {
      observed.stage = name
      const remaining = Math.floor(18_000 - (performance.now() - started))
      if (remaining <= 0) throw new Error(`Forecast browser work deadline before ${name}`)
      observed.page?.setDefaultTimeout(Math.min(5_000, remaining))
      observed.page?.setDefaultNavigationTimeout(Math.min(5_000, remaining))
      const at = performance.now()
      console.info("SF_FORECAST_BROWSER_PHASE", JSON.stringify({ outcome, phase: name, state: "started", elapsedMs: Math.round(at - started) }))
      try {
        const value = await work()
        if (performance.now() - started >= 18_000) throw new Error(`Forecast browser work deadline after ${name}`)
        console.info("SF_FORECAST_BROWSER_PHASE", JSON.stringify({ outcome, phase: name, state: "returned", phaseMs: Math.round(performance.now() - at) }))
        return value
      } catch (error) {
        console.error("SF_FORECAST_BROWSER_PHASE", JSON.stringify({ outcome, phase: name, state: "failed", phaseMs: Math.round(performance.now() - at), error: error instanceof Error ? error.message : String(error) }))
        throw error
      }
    }
    const fixture = await phase("fixture", forecastPage)
    const requests: { mode: string; action: unknown; key: string | null; payload: unknown }[] = []
    const state = { started: false }
    const runRef = "ui-fixture-run"
    const skillInput = { uiFixtureBoundary: true, selectedForecast: "prepared-once" }
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => {
      const url = new URL(request.url)
      const mode = url.searchParams.get("sf")
      if (request.method === "GET" && !mode) {
        console.info("SF_FORECAST_BROWSER_HTTP", JSON.stringify({ outcome, mode: "page", method: request.method, status: 200, elapsedMs: Math.round(performance.now() - started) }))
        return new Response(fixture.html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
      }
      if (request.method !== "POST" || !mode) return new Response(null, { status: 404 })
      const payload: unknown = await request.json()
      const action = payload && typeof payload === "object" && "action" in payload ? payload.action : undefined
      requests.push({ mode, action, key: request.headers.get("Idempotency-Key"), payload })
      const respond = (value: unknown, status = 200) => {
        console.info("SF_FORECAST_BROWSER_HTTP", JSON.stringify({ outcome, stage: observed.stage, mode, action, status,
          keyPresent: !!request.headers.get("Idempotency-Key"), elapsedMs: Math.round(performance.now() - started) }))
        return Response.json(value, { status })
      }
      if (mode === "workbench-forecast") return outcome === "rejected"
        ? respond({ status: "stale" }, 409)
        : respond({ status: "ok", value: skillInput })
      if (mode !== "workbench-analysis") return new Response(null, { status: 404 })
      if (action === "list") return respond({ status: "ok", value: state.started ? [{ runRef, state: "ready", version: 1 }] : [] })
      if (action === "start") { state.started = true; return respond({ status: "ok", value: { runRef } }) }
      if (action === "read") return respond({ status: "ok", value: { runRef, state: "ready", version: 1 } })
      if (action === "output") return respond({ status: "ok", value: { html: "<p>Forecast result supplied by the explicit UI fixture.</p>" } })
      return new Response(null, { status: 400 })
    } })
    const browser = await launchWp01Browser().catch(async (error) => { await server.stop(true); throw error })
    try {
      const page = await phase("browser.page", () => browser.newPage())
      observed.page = page
      page.on("pageerror", (error) => { pageErrors.push(error.message); client({ event: "pageerror", message: error.message }) })
      page.on("console", (message) => { if (["error", "warning"].includes(message.type())) client({ event: `console.${message.type()}`, message: message.text().slice(0, 1000) }) })
      page.on("requestfailed", (request) => client({ event: "requestfailed", mode: new URL(request.url()).searchParams.get("sf") ?? "page", message: request.failure()?.errorText }))
      page.on("response", (response) => client({ event: "response", mode: new URL(response.url()).searchParams.get("sf") ?? "page", status: response.status() }))
      page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) client({ event: "navigation", mode: new URL(frame.url()).searchParams.get("sf") ?? "page" }) })
      expect((await phase("page.goto", () => page.goto(server.url.href)))?.status()).toBe(200)
      const form = page.locator("form[data-forecast-analysis][data-sf-forecast-ready=true]")
      await phase("form.ready", () => form.waitFor())
      await phase("history.empty", () => page.locator("[data-analysis-history]").getByText("No analyses yet.", { exact: true }).waitFor())
      const submit = form.getByRole("button", { name: "Start analysis", exact: true })
      // Preserve the owner's actual implicit-submit markup. No test adds a type,
      // selector fallback, event listener or synthetic submit implementation.
      expect(await phase("submit.type-attribute", () => submit.getAttribute("type"))).toBeNull()
      expect(await phase("submit.native-type", () => submit.evaluate((button) => (button as HTMLButtonElement).type))).toBe("submit")
      await phase("submit.duplicate-sources", () => submit.click())
      await phase("submit.duplicate-guard", () => form.getByText("Choose a model and two different forecast sources.", { exact: true }).waitFor())
      expect(requests.filter((entry) => entry.mode === "workbench-forecast" || entry.action === "start")).toHaveLength(0)
      await phase("selection.comparison", () => form.locator('select[name="candidateRef"]').selectOption(fixture.sources[1]!.refId))
      await phase("selection.start", () => form.getByLabel("Start", { exact: true }).fill("2027-02-01"))
      await phase("selection.end", () => form.getByLabel("End", { exact: true }).fill("2027-11-30"))
      await phase("selection.currency", () => form.getByLabel("Currency", { exact: true }).fill("EUR"))
      if (outcome === "ready") await phase("submit.click", () => submit.click())
      if (outcome === "rejected") await phase("submit.enter", () => form.getByLabel("Currency", { exact: true }).press("Enter"))

      if (outcome === "ready") {
        await phase("analysis.ready", () => form.getByText("Analysis: ready.", { exact: true }).waitFor())
        const result = page.locator(`[data-analysis-history] article[data-run-ref="${runRef}"]`)
        await phase("analysis.open-result", () => result.getByRole("button", { name: "Open result", exact: true }).click())
        await phase("analysis.rendered", () => result.locator("[data-analysis-body]").getByText("Forecast result supplied by the explicit UI fixture.", { exact: true }).waitFor())
        expect(requests.filter((entry) => entry.mode === "workbench-forecast" || ["start", "read", "output"].includes(String(entry.action))).map((entry) => entry.mode === "workbench-forecast" ? "prepare" : entry.action)).toEqual(["prepare", "start", "read", "output"])
        expect(requests.find((entry) => entry.action === "start")?.payload).toEqual({ action: "start", input: { request: fixture.request, skillInput, model: fixture.model } })
        expect(requests.find((entry) => entry.action === "read")?.payload).toEqual({ action: "read", runRef })
        expect(requests.find((entry) => entry.action === "output")?.payload).toEqual({ action: "output", runRef })
        expect(await phase("analysis.cancel-hidden", () => form.locator("[data-analysis-cancel]").isVisible())).toBe(false)
      }
      if (outcome === "rejected") {
        await phase("analysis.rejected", () => form.getByText("The analysis request was rejected. Review the sources and current decision before retrying.", { exact: true }).waitFor())
        expect(requests.filter((entry) => ["start", "read", "output"].includes(String(entry.action)))).toHaveLength(0)
        expect(await phase("analysis.no-output", () => page.locator("[data-analysis-body]").count())).toBe(0)
      }
      expect(requests.filter((entry) => entry.mode === "workbench-forecast").map((entry) => entry.payload)).toEqual([{
        caseRef: fixture.caseRef, baseRef: fixture.sources[0]!.refId, candidateRef: fixture.sources[1]!.refId,
        period: { start: "2027-02-01", end: "2027-11-30" }, currency: "EUR",
      }])
      expect(requests.every((entry) => !!entry.key)).toBe(true)
      expect(await phase("form.submit-enabled", () => submit.isEnabled())).toBe(true)
      expect(await phase("form.currency-enabled", () => form.getByLabel("Currency", { exact: true }).isEnabled())).toBe(true)
      expect(await phase("form.currency-preserved", () => form.getByLabel("Currency", { exact: true }).inputValue())).toBe("EUR")
      expect(pageErrors).toEqual([])
    } catch (error) {
      console.error("SF_FORECAST_BROWSER_FAILURE", JSON.stringify({ outcome, stage: observed.stage, elapsedMs: Math.round(performance.now() - started),
        error: error instanceof Error ? error.message : String(error), pageErrors, clientEvents,
        requests: requests.map((entry) => ({ mode: entry.mode, action: entry.action, keyPresent: !!entry.key })) }))
      throw error
    } finally {
      console.info("SF_FORECAST_BROWSER_CLEANUP", JSON.stringify({ outcome, state: "started", elapsedMs: Math.round(performance.now() - started) }))
      try { await closeWp01Browser(browser) }
      finally {
        await server.stop(true)
        console.info("SF_FORECAST_BROWSER_CLEANUP", JSON.stringify({ outcome, state: "returned", elapsedMs: Math.round(performance.now() - started) }))
      }
    }
  }, 30_000)
}
