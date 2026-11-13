import type { SfHostServices } from "../contracts/host-context.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import { documentHtml, esc, pageMain } from "../../src/screen-shell.ts"
import { htmlPolicy } from "../../runtime/application.ts"
import { decisionDesk, routineStatus, workList } from "../ui/components.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import { handleSfAnalysis } from "./analysis-http.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { decisionCreateForm, decisionCreateScript } from "../ui/decision-create.ts"
import { handleSfPlannerMonthly } from "./planner-http.ts"
import { handleSfForecastInput } from "./forecast-http.ts"
import { forecastAnalysisForm, forecastAnalysisScript } from "../ui/forecast-analysis.ts"
import { decisionEditForm, decisionEditScript } from "../ui/decision-edit.ts"
import { decisionChoiceForm, decisionChoiceScript } from "../ui/decision-choice.ts"
import { handleSfViews } from "./views-http.ts"
import { personalViewsScript, personalViewsWidget } from "../ui/personal-views.ts"
import { documentSearchScript } from "../ui/document-search.ts"
import { portfolioHistory, portfolioScript, portfolioWidget } from "../ui/portfolio.ts"

/** Mount in the existing authenticated application; authority remains private to the host. */
export function createSfWorkbenchHttp(input: { origin: string; mount: string; runtime: () => SfHostServices | undefined }) {
  const modes = ["workbench", "workbench-case", "workbench-work", "workbench-work-select", "workbench-search", "workbench-routine", "workbench-command", "workbench-analysis", "workbench-planner", "workbench-forecast", "workbench-views"] as const
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    const mode = url.searchParams.get("sf")
    if (!mode || !modes.some((entry) => entry === mode)) return undefined
    const reply = (value: unknown, status: number) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    if (url.origin !== input.origin || !["dashboard", "planner", "procurement"].includes(surface) || url.pathname !== `${input.mount}/${surface}`) return reply({ status: "denied" }, 403)
    const runtime = input.runtime()
    if (!runtime) return reply({ status: "unavailable", reason: "workbench-unavailable" }, 503)
    if (mode === "workbench-analysis") {
      if ([...url.searchParams.keys()].some((key) => key !== "sf") || url.searchParams.getAll("sf").length !== 1) return reply({ status: "invalid" }, 400)
      return handleSfAnalysis(request, input.origin, runtime)
    }
    if (mode === "workbench-planner") {
      if (surface !== "planner" || [...url.searchParams.keys()].some((key) => key !== "sf") || url.searchParams.getAll("sf").length !== 1) return reply({ status: "invalid" }, 400)
      return handleSfPlannerMonthly(request, input.origin, runtime)
    }
    if (mode === "workbench-forecast") {
      if ([...url.searchParams.keys()].some((key) => key !== "sf") || url.searchParams.getAll("sf").length !== 1) return reply({ status: "invalid" }, 400)
      return handleSfForecastInput(request, input.origin, runtime)
    }
    if (mode === "workbench-views") {
      if ([...url.searchParams.keys()].some((key) => key !== "sf") || url.searchParams.getAll("sf").length !== 1) return reply({ status: "invalid" }, 400)
      return handleSfViews(request, input.origin, runtime)
    }
    if (mode === "workbench-work-select") {
      if (request.method !== "GET" && request.method !== "HEAD") return reply({ status: "denied" }, 405)
      if ([...url.searchParams.keys()].some((key) => !["sf", "start", "end"].includes(key) || url.searchParams.getAll(key).length !== 1)) return reply({ status: "invalid" }, 400)
      const period = { start: url.searchParams.get("start") ?? "", end: url.searchParams.get("end") ?? "" }
      if (!isSfPeriod(period)) return reply({ status: "invalid" }, 400)
      if (!runtime.procurementSelections) return reply({ status: "unavailable" }, 503)
      const digest = digestSfValue({ purpose: "work-selection", period })
      const access = await runtime.ui.admit(request, "sf_work_list", digest)
      if (access.status !== "ok") return reply({ status: access.status }, 403)
      try {
        if (!await runtime.ui.validate(access.value, "sf_work_list", digest)) return reply({ status: "denied" }, 403)
        const selection = await runtime.procurementSelections.create(access.value, period).catch(() => undefined)
        if (!selection || selection.status !== "ok") return reply({ status: selection?.status ?? "unavailable" }, selection?.status === "denied" ? 403 : 503)
        if (!await runtime.ui.revalidate(access.value)) return reply({ status: "denied" }, 403)
        const query = new URLSearchParams({ sf: "workbench-work", selectionRef: selection.value.selectionRef, start: selection.value.period.start, end: selection.value.period.end })
        const body = `<p><a href="?sf=workbench">Workbench</a></p><h2>Work selection</h2><p><a href="?${esc(query.toString())}">${esc(selection.value.label)}</a> · ${esc(selection.value.period.start)} – ${esc(selection.value.period.end)}</p>`
        const html = documentHtml("Workbench", surface, "", pageMain({ drawn: true, key: "Workbench", index: 0 }, body), "")
        return new Response(request.method === "HEAD" ? null : html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": htmlPolicy(html), "X-Content-Type-Options": "nosniff" } })
      } finally { runtime.ui.finish(access.value) }
    }
    if (mode === "workbench-command") {
      if (request.method !== "POST") return reply({ status: "denied" }, 405)
      if (request.headers.get("origin") !== input.origin || request.headers.get("sec-fetch-site") === "cross-site") return reply({ status: "denied" }, 403)
      if ([...url.searchParams.keys()].some((key) => key !== "sf") || url.searchParams.getAll("sf").length !== 1 || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply({ status: "invalid" }, 400)
      const body = await request.text()
      if (new TextEncoder().encode(body).byteLength > 65536) return reply({ status: "invalid" }, 413)
      const parsed: unknown = await Promise.resolve().then(() => JSON.parse(body)).catch(() => undefined)
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).some((key) => !["operation", "input"].includes(key)) || !("operation" in parsed) || !("input" in parsed)) return reply({ status: "invalid" }, 400)
      const operation = parsed.operation
      if (operation !== "sf_case_draft" && operation !== "sf_question_prepare" && operation !== "sf_change_prepare") return reply({ status: "denied" }, 403)
      const decoded = decodeSfOperationInput(operation, parsed.input)
      if (!decoded.ok) return reply({ status: "invalid" }, 400)
      const admitted = await runtime.ui.admit(request, operation, digestSfValue(decoded.value))
      if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
      try {
        const result = await runtime.dispatch(operation, decoded.value, admitted.value).catch(() => undefined)
        if (!result) return reply({ status: "unavailable", reason: "workbench-unavailable" }, 503)
        if (result.status !== "ok") return reply({ status: result.status }, result.status === "denied" ? 403 : result.status === "stale" ? 409 : 503)
        const output = decodeSfOperationOutput(operation, result.result)
        if (!output.ok || !await runtime.ui.revalidate(admitted.value)) return reply({ status: "unavailable" }, 503)
        return reply({ status: "ok", value: output.value, outputRef: result.outputRef }, 200)
      } finally { runtime.ui.finish(admitted.value) }
    }
    if (request.method !== "GET" && request.method !== "HEAD") return reply({ status: "denied" }, 405)
    const allowed = mode === "workbench" ? ["sf"] : mode === "workbench-case" ? ["sf", "caseRef"] : mode === "workbench-work" ? ["sf", "selectionRef", "start", "end"] : mode === "workbench-search" ? ["sf", "q"] : ["sf", "runRef"]
    if ([...url.searchParams.keys()].some((key) => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) return reply({ status: "invalid" }, 400)
    const operation = mode === "workbench" || mode === "workbench-case" ? "sf_case_read" : mode === "workbench-search" ? "sf_knowledge_search" : mode === "workbench-routine" ? "sf_routine_status" : "sf_work_list"
    const payload = mode === "workbench-case" ? { caseRef: url.searchParams.get("caseRef") ?? "" } : mode === "workbench-search" ? { query: url.searchParams.get("q") ?? "", limit: 20 } : mode === "workbench-routine" ? { runRef: url.searchParams.get("runRef") ?? "" } : { selectionRef: url.searchParams.get("selectionRef") ?? "", period: { start: url.searchParams.get("start") ?? "", end: url.searchParams.get("end") ?? "" } }
    const decoded = mode === "workbench" ? undefined : decodeSfOperationInput(operation, payload)
    if (decoded && !decoded.ok) return reply({ status: "invalid", reason: "invalid-selection" }, 400)
    const landing = { caseAccess: false }
    const admitted = mode === "workbench" ? await (async () => {
      for (const candidate of ["sf_case_read", "sf_work_list", "sf_knowledge_search", "sf_routine_catalog"] as const) {
        const access = await runtime.ui.admit(request, candidate, digestSfValue({}))
        if (access.status === "ok") { landing.caseAccess = candidate === "sf_case_read"; return access }
      }
      return { status: "denied" as const, reason: "workbench-unavailable" }
    })() : await runtime.ui.admit(request, operation, digestSfValue(decoded?.ok ? decoded.value : {}))
    if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
    try {
      if (mode === "workbench-work" && runtime.work) {
        const selection = decodeSfOperationInput("sf_work_list", payload)
        if (!selection.ok) return reply({ status: "invalid" }, 400)
        if (!await runtime.ui.validate(admitted.value, "sf_work_list", digestSfValue(selection.value))) return reply({ status: "denied" }, 403)
        const work = await runtime.work.listPresentation(selection.value, admitted.value).catch(() => undefined)
        if (!work) return reply({ status: "unavailable" }, 503)
        if (work.status !== "ok") return reply({ status: work.status }, work.status === "denied" ? 403 : work.status === "stale" || work.status === "conflict" ? 409 : 503)
        if (!await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
        const body = `<p><a href="?sf=workbench">Workbench</a></p><h2>My work</h2>${work.value.items.length ? `<ul>${work.value.items.map((item) => `<li><strong>${esc(item.title ?? "Work item")}</strong> · ${esc(item.state)}${item.ownerLabel ? ` · ${esc(item.ownerLabel)}` : ""}</li>`).join("")}</ul>` : "<p>No work is currently assigned in this selection.</p>"}`
        const html = documentHtml("Workbench", surface, "", pageMain({ drawn: true, key: "Workbench", index: 0 }, body), "")
        return new Response(request.method === "HEAD" ? null : html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": htmlPolicy(html), "X-Content-Type-Options": "nosniff" } })
      }
      const search = `<form method="get"><input type="hidden" name="sf" value="workbench-search"><label>Search documents<input name="q" required></label><button>Search</button></form>`
      const listed = mode === "workbench" && landing.caseAccess ? await runtime.state.read(request, "cases", (state, authority) => Object.values(state.cases).filter((item) => item.participants.includes(authority.principalRef)).map((item) => encodeCaseRef(item))).catch(() => ({ status: "unavailable" as const, reason: "decision-list-unavailable" })) : undefined
      const cases = listed?.status === "ok" ? await Promise.all(listed.value.map(async (caseRef) => {
        const selection = { caseRef }
        const access = await runtime.ui.admit(request, "sf_case_read", digestSfValue(selection))
        if (access.status !== "ok") return undefined
        try {
          const result = await runtime.dispatch("sf_case_read", selection, access.value).catch(() => undefined)
          if (!result || result.status !== "ok" || !await runtime.ui.revalidate(access.value)) return undefined
          const output = decodeSfOperationOutput("sf_case_read", result.result)
          return output.ok ? { caseRef, title: output.value.case.objective, version: output.value.case.version } : undefined
        } finally { runtime.ui.finish(access.value) }
      })) : []
      const visible = cases.filter((item) => item !== undefined)
      const listUnavailable = !landing.caseAccess || (listed && listed.status !== "ok" && !(listed.status === "unavailable" && listed.reason === "product-state-uninitialized"))
      const work = runtime.procurementSelections ? `<form method="get"><input type="hidden" name="sf" value="workbench-work-select"><h2>My work</h2><label>Start<input name="start" type="date" required></label><label>End<input name="end" type="date" required></label><button>Find work</button></form>` : "<p>Work list is currently unavailable.</p>"
      const runs = mode === "workbench" && runtime.routineRuns ? await (async () => {
        const digest = digestSfValue({ purpose: "routine-discovery" })
        const access = await runtime.ui.admit(request, "sf_routine_status", digest)
        if (access.status !== "ok") return undefined
        try {
          if (!await runtime.ui.validate(access.value, "sf_routine_status", digest)) return undefined
          const result = await runtime.routineRuns!.discoverRuns(access.value).catch(() => undefined)
          if (!result || result.status !== "ok" || !await runtime.ui.revalidate(access.value)) return undefined
          return result.value
        } finally { runtime.ui.finish(access.value) }
      })() : undefined
      const routines = runs ? `<h2>Routines</h2>${runs.length ? `<ul>${runs.map((run, index) => `<li>${run.runRef ? `<a href="?${esc(new URLSearchParams({ sf: "workbench-routine", runRef: run.runRef }).toString())}">Routine ${index + 1}</a>` : `Routine ${index + 1}`} · ${esc(run.admission)}</li>`).join("")}</ul>` : "<p>No accessible routine runs.</p>"}` : "<p>Routine list is currently unavailable.</p>"
      const forms = `<h2>Decisions</h2>${listUnavailable ? "<p>Decision list unavailable.</p>" : visible.length ? `<ul>${visible.map((item) => `<li><a href="?${esc(new URLSearchParams({ sf: "workbench-case", caseRef: item.caseRef }).toString())}">${esc(item.title)}</a> · version ${item.version}</li>`).join("")}</ul>` : "<p>No accessible decisions.</p>"}${decisionCreateForm}${portfolioWidget}${search}${work}${runtime.personalViews ? personalViewsWidget() : ""}${routines}`
      const result = decoded?.ok ? await runtime.dispatch(operation, decoded.value, admitted.value).catch(() => undefined) : undefined
      if (decoded?.ok && !result) return reply({ status: "unavailable", reason: "workbench-unavailable" }, 503)
      if (result && result.status !== "ok") return reply({ status: result.status }, result.status === "denied" ? 403 : result.status === "stale" ? 409 : 503)
      const output = result?.status === "ok" ? decodeSfOperationOutput(operation, result.result) : undefined
      if (output && !output.ok) return reply({ status: "unavailable" }, 503)
      if (!await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
      const caseOutput = operation === "sf_case_read" && result?.status === "ok" ? decodeSfOperationOutput("sf_case_read", result.result) : undefined
      const workOutput = operation === "sf_work_list" && result?.status === "ok" ? decodeSfOperationOutput("sf_work_list", result.result) : undefined
      const routineOutput = operation === "sf_routine_status" && result?.status === "ok" ? decodeSfOperationOutput("sf_routine_status", result.result) : undefined
      const searchOutput = operation === "sf_knowledge_search" && result?.status === "ok" ? decodeSfOperationOutput("sf_knowledge_search", result.result) : undefined
      const body = caseOutput?.ok ? decisionDesk(caseOutput.value) + decisionEditForm(caseOutput.value) + decisionChoiceForm(caseOutput.value) + portfolioHistory(caseOutput.value) + await forecastAnalysisForm(caseOutput.value, runtime) : workOutput?.ok ? workList(workOutput.value) : routineOutput?.ok ? routineStatus(routineOutput.value) : searchOutput?.ok ? `<h2>Search results</h2>${searchOutput.value.matches.length ? `<ul>${searchOutput.value.matches.map((item) => `<li data-document-result data-ref="${esc(JSON.stringify(item.documentRef))}"><strong data-document-title>Checking source…</strong><p data-document-text>${esc(item.text)}</p></li>`).join("")}</ul>` : "<p>No accessible results.</p>"}${searchOutput.value.limitations.map((item) => `<p>${esc(item)}</p>`).join("")}` : forms
      if (!await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
      const html = documentHtml("Workbench", surface, "", pageMain({ drawn: true, key: "Workbench", index: 0 }, `<p><a href="?sf=workbench">Workbench</a></p>${body}`), "").replace("</script>", `${decisionCreateScript}${decisionEditScript}${decisionChoiceScript}${forecastAnalysisScript}${personalViewsScript}${documentSearchScript}${portfolioScript}</script>`)
      return new Response(request.method === "HEAD" ? null : html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": htmlPolicy(html), "X-Content-Type-Options": "nosniff" } })
    } finally { runtime.ui.finish(admitted.value) }
  }
}
