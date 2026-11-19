import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { startPlannerInstallation } from "../wp03/installation-fixture"
import { observeDashboardRequests } from "./support"

// Candidate destination: e2e/sucafina/dashboard-installed/transport-probe.spec.ts.
// Diagnostic only: no business mutation, route replacement or Dashboard acceptance
// claim. Both clients reach the existing production installation and real session.
test.use({ trace: "off", video: "off", screenshot: "off" })

type Observation = {
  client: "node" | "browser"
  probe: "get-dashboard" | "post-empty-json" | "post-malformed-json" | "post-views-list"
  outcome: "response" | "error"
  elapsedMs: number
  status?: number
  contentType?: "json" | "html" | "other" | "absent"
  bodyBytes?: number
  resultStatus?: "ok" | "invalid" | "denied" | "unavailable" | "needs-input" | "conflict" | "stale"
  listReceived?: boolean
  errorKind?: "aborted" | "timeout" | "network" | "other"
}

const deadlineMs = 15_000
const dashboardPath = "/sucafina/dashboard?page=Hot+Topics+%26+Actions&year=2026"
const viewsPath = "/sucafina/dashboard?sf=workbench-views"
const cases: readonly { probe: Observation["probe"]; path: string; method: "GET" | "POST"; body?: string; expectedStatus: number }[] = [
  { probe: "get-dashboard" as const, path: dashboardPath, method: "GET", expectedStatus: 200 },
  // The content type, Origin, session and idempotency key are valid. Empty JSON
  // must reach request.text()/JSON parsing before views-http can return 400.
  { probe: "post-empty-json" as const, path: viewsPath, method: "POST", body: "", expectedStatus: 400 },
  // A non-empty invalid body separates stream consumption from the subsequent
  // authority/preferences read required by the legitimate list operation.
  { probe: "post-malformed-json" as const, path: viewsPath, method: "POST", body: "{", expectedStatus: 400 },
  { probe: "post-views-list" as const, path: viewsPath, method: "POST", body: JSON.stringify({ action: "list", input: {} }), expectedStatus: 200 },
]

test("diagnostic installed CLI compares Node and browser body delivery without changing records", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "diagnostic", description: "Transport localization only; does not close Dashboard installed acceptance." })
  // The comparison must use Node's fetch, not another Bun client. This is the
  // normal Playwright runner; the production server remains the installed CLI.
  expect(process.release.name).toBe("node")
  expect(process.versions.bun).toBeUndefined()
  const installation = await startPlannerInstallation(info)
  const observations: Observation[] = []
  const documentControl: { status?: number; outcome: string } = { outcome: "not-opened" }
  const attachTransport = observeDashboardRequests(info, [{ page, label: "probe" }])
  const record = (observation: Observation) => {
    observations.push(observation)
    console.info("SF_DASHBOARD_TRANSPORT_PROBE", JSON.stringify(observation))
  }
  try {
    // Enrollment is owned by the existing fixture. Its URL and cookie never enter
    // a trace, diagnostic observation, exception message or child-process argv.
    try { await page.context().addCookies([installation.cookie]) }
    catch { throw new Error("The real operator session could not be installed in the browser") }
    try {
      // A real JSON document establishes the application's origin without
      // mounting scripts that independently issue the same views-list POST.
      const response = await page.goto(`${installation.origin}/sucafina/notifications`, { waitUntil: "domcontentloaded", timeout: deadlineMs })
      documentControl.status = response?.status()
      documentControl.outcome = response ? "response" : "no-response"
    } catch { documentControl.outcome = "navigation-error" }
    expect(documentControl, "the real same-origin browser control is available").toMatchObject({ outcome: "response", status: 200 })

    for (const selected of cases) {
      const started = performance.now()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), deadlineMs)
      try {
        const response = await fetch(`${installation.origin}${selected.path}`, {
          method: selected.method,
          headers: {
            cookie: `${installation.cookie.name}=${installation.cookie.value}`,
            origin: installation.origin,
            ...(selected.method === "POST" ? { "content-type": "application/json", "idempotency-key": randomUUID() } : {}),
          },
          ...(selected.method === "POST" ? { body: selected.body } : {}),
          redirect: "manual", signal: controller.signal,
        })
        const body = await response.text()
        const type = response.headers.get("content-type") ?? ""
        const contentType = type.includes("application/json") ? "json" : type.includes("text/html") ? "html" : type ? "other" : "absent"
        let resultStatus: Observation["resultStatus"], listReceived: boolean | undefined
        if (contentType === "json") {
          let parsed: unknown
          try { parsed = JSON.parse(body) } catch { parsed = undefined }
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const result = parsed as { status?: unknown; value?: unknown }
            if (typeof result.status === "string" && ["ok", "invalid", "denied", "unavailable", "needs-input", "conflict", "stale"].includes(result.status)) resultStatus = result.status as Observation["resultStatus"]
            listReceived = Array.isArray(result.value)
          }
        }
        record({ client: "node", probe: selected.probe, outcome: "response", elapsedMs: Math.round(performance.now() - started),
          status: response.status, contentType, bodyBytes: new TextEncoder().encode(body).byteLength,
          ...(resultStatus ? { resultStatus } : {}), ...(listReceived === undefined ? {} : { listReceived }) })
      } catch (error) {
        const name = error instanceof Error ? error.name : ""
        record({ client: "node", probe: selected.probe, outcome: "error", elapsedMs: Math.round(performance.now() - started),
          errorKind: controller.signal.aborted || name === "AbortError" ? "aborted" : name === "TimeoutError" ? "timeout" : name === "TypeError" ? "network" : "other" })
      } finally { clearTimeout(timer) }

      // The browser supplies the real Origin and session cookie. Only the fixed
      // read-only path, empty/list body and non-secret correlation enter evaluate.
      const browserStarted = performance.now()
      try {
        const observed = await page.evaluate(async ({ selected, limit, key }): Promise<Observation> => {
          const started = performance.now(), controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), limit)
          try {
            const response = await fetch(selected.path, {
              method: selected.method, credentials: "same-origin", redirect: "manual", signal: controller.signal,
              ...(selected.method === "POST" ? { body: selected.body, headers: { "Content-Type": "application/json", "Idempotency-Key": key } } : {}),
            })
            const body = await response.text(), type = response.headers.get("content-type") ?? ""
            const contentType = type.includes("application/json") ? "json" : type.includes("text/html") ? "html" : type ? "other" : "absent"
            let resultStatus: Observation["resultStatus"], listReceived: boolean | undefined
            if (contentType === "json") {
              let parsed: unknown
              try { parsed = JSON.parse(body) } catch { parsed = undefined }
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                const result = parsed as { status?: unknown; value?: unknown }
                if (typeof result.status === "string" && ["ok", "invalid", "denied", "unavailable", "needs-input", "conflict", "stale"].includes(result.status)) resultStatus = result.status as Observation["resultStatus"]
                listReceived = Array.isArray(result.value)
              }
            }
            return { client: "browser" as const, probe: selected.probe, outcome: "response" as const, elapsedMs: Math.round(performance.now() - started),
              status: response.status, contentType, bodyBytes: new TextEncoder().encode(body).byteLength,
              ...(resultStatus ? { resultStatus } : {}), ...(listReceived === undefined ? {} : { listReceived }) }
          } catch (error) {
            const name = error instanceof Error ? error.name : ""
            return { client: "browser" as const, probe: selected.probe, outcome: "error" as const, elapsedMs: Math.round(performance.now() - started),
              errorKind: controller.signal.aborted || name === "AbortError" ? "aborted" as const : name === "TimeoutError" ? "timeout" as const : name === "TypeError" ? "network" as const : "other" as const }
          } finally { clearTimeout(timer) }
        }, { selected, limit: deadlineMs, key: randomUUID() })
        record(observed)
      } catch {
        // Do not propagate a Playwright exception that could quote script inputs.
        record({ client: "browser", probe: selected.probe, outcome: "error", elapsedMs: Math.round(performance.now() - browserStarted), errorKind: "other" })
      }
    }

    // Collect the entire comparison before asserting: one missing response must
    // not hide whether the other client, empty body or authorized read completed.
    expect(observations).toHaveLength(8)
    for (const selected of cases) for (const client of ["node", "browser"] as const) {
      const observation = observations.find((value) => value.client === client && value.probe === selected.probe)
      expect.soft(observation, `${client} ${selected.probe}`).toMatchObject({ outcome: "response", status: selected.expectedStatus })
      if (selected.probe === "post-views-list") expect.soft(observation, `${client} received the real views-list result`).toMatchObject({ resultStatus: "ok", listReceived: true })
      if (selected.probe === "post-empty-json" || selected.probe === "post-malformed-json")
        expect.soft(observation, `${client} rejected invalid JSON after reading the body`).toMatchObject({ resultStatus: "invalid" })
    }
  } finally {
    // Attach only summaries. Never retain response content, cookies, request
    // headers, authentication URLs or raw exception/console messages.
    try {
      await info.attach("dashboard-installed-transport-probe.json", { body: JSON.stringify({ diagnosticOnly: true, clientRuntime: "node", deadlineMs, documentControl, observations }, null, 2), contentType: "application/json" })
    } finally { try { await attachTransport() } finally { await installation.stop() } }
  }
})
