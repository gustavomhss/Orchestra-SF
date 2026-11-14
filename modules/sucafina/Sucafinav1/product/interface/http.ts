import type { SfHostServices } from "../contracts/host-context.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import { documentHtml, esc, pageMain } from "../../src/screen-shell.ts"
import { htmlPolicy } from "../../runtime/application.ts"
import { decisionDesk, routineStatus } from "../ui/components.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import { handleSfAnalysis } from "./analysis-http.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { decisionCreateForm, decisionCreateScript } from "../ui/decision-create.ts"
import { handleSfPlannerMonthly } from "./planner-http.ts"
import { handleSfForecastInput } from "./forecast-http.ts"
import { forecastAnalysisForm, forecastAnalysisScript, scenarioAnalysisForm, intentAnalysisForm } from "../ui/forecast-analysis.ts"
import { sourcingAnalysisForm, sourcingAnalysisScript } from "../procurement/sourcing-analysis.ts"
import { handleSfSourcingInput } from "../procurement/sourcing-input-http.ts"
import { decisionEditForm, decisionEditScript } from "../ui/decision-edit.ts"
import { decisionChoiceForm, decisionChoiceScript } from "../ui/decision-choice.ts"
import { handleSfViews } from "./views-http.ts"
import { personalViewsScript, personalViewsWidget } from "../ui/personal-views.ts"
import { documentSearchScript } from "../ui/document-search.ts"
import { recordSearchScript, recordSearchWidget } from "../ui/record-search.ts"
import { portfolioHistory, portfolioScript, portfolioWidget } from "../ui/portfolio.ts"
import { decisionApplyForms, decisionApplyScript } from "../ui/decision-apply.ts"
import { caseQuestionForm, caseQuestionScript, caseQuestionThreads, workDestinationScript } from "../ui/work-collaboration.ts"
import { workReviewContext } from "../ui/work-review-context.ts"
import { caseWorkSelectionForm, caseWorkSelectionScript } from "../ui/case-work-selection.ts"
import { contextualCaseReturn, handleContextualDecision } from "./contextual-decision.ts"

/** Mount in the existing authenticated application; authority remains private to the host. */
export function createSfWorkbenchHttp(input: { origin: string; mount: string; runtime: () => SfHostServices | undefined }) {
  const modes = ["workbench", "workbench-case", "workbench-context", "workbench-work", "workbench-work-select", "workbench-search", "workbench-routine", "workbench-command", "workbench-analysis", "workbench-planner", "workbench-forecast", "workbench-sourcing-input", "workbench-views"] as const
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    const mode = url.searchParams.get("sf")
    if (!mode || !modes.some((entry) => entry === mode)) return undefined
    const reply = (value: unknown, status: number) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    if (url.origin !== input.origin || !["dashboard", "planner", "procurement"].includes(surface) || url.pathname !== `${input.mount}/${surface}`) return reply({ status: "denied" }, 403)
    const pageReply = (body: string, status: number, revision = "") => {
      const html = documentHtml("Workbench", surface, "", pageMain({ drawn: true, key: "Workbench", index: 0 }, `<p><a href="?sf=workbench">Workbench</a></p>${body}`), "", "", revision)
      return new Response(request.method === "HEAD" ? null : html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": htmlPolicy(html), "X-Content-Type-Options": "nosniff", ...(revision ? { "X-SF-Access-Revision": revision } : {}) } })
    }
    const workMode = mode === "workbench-work" || mode === "workbench-work-select"
    const runtime = input.runtime()
    if (!runtime) return workMode ? pageReply("<h2>Work unavailable</h2><p>The work service is not available in this installation. Return to Workbench and retry when the service is available.</p>", 503) : reply({ status: "unavailable", reason: "workbench-unavailable" }, 503)
    const workForm = () => `<form method="get"><input type="hidden" name="sf" value="workbench-work-select"><label>Start<input name="start" type="date" required value="${esc(url.searchParams.get("start") ?? "")}"></label><label>End<input name="end" type="date" required value="${esc(url.searchParams.get("end") ?? "")}"></label><button${runtime.work && runtime.procurementSelections ? "" : " disabled"}>Find work</button></form>`
    const workFailure = (status: number, message: string) => pageReply(`<h2>${status === 403 ? "Work access unavailable" : status === 400 ? "Review the work period" : status === 409 ? "Work selection changed" : "Work unavailable"}</h2><p role="status">${esc(message)}</p>${status !== 403 ? `<p>Selected period: ${esc(url.searchParams.get("start") ?? "Not selected")} – ${esc(url.searchParams.get("end") ?? "Not selected")}</p>${status === 400 || runtime.work && runtime.procurementSelections ? workForm() : `<p><a href="${esc(url.pathname + url.search)}">Retry this selection</a></p>`}` : ""}`, status)
    if (mode === "workbench-context") return handleContextualDecision(request, { ...input, surface, runtime })
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
    if (mode === "workbench-sourcing-input") {
      if ([...url.searchParams.keys()].some((key) => key !== "sf") || url.searchParams.getAll("sf").length !== 1) return reply({ status: "invalid" }, 400)
      return handleSfSourcingInput(request, input.origin, runtime)
    }
    if (mode === "workbench-views") {
      if ([...url.searchParams.keys()].some((key) => key !== "sf") || url.searchParams.getAll("sf").length !== 1) return reply({ status: "invalid" }, 400)
      return handleSfViews(request, input.origin, runtime)
    }
    if (mode === "workbench-work-select") {
      if (request.method !== "GET" && request.method !== "HEAD") return workFailure(405, "Open My work from Workbench to choose a period.")
      if ([...url.searchParams.keys()].some((key) => !["sf", "start", "end"].includes(key) || url.searchParams.getAll(key).length !== 1)) return workFailure(400, "Choose a valid start and end date, then find work again.")
      const period = { start: url.searchParams.get("start") ?? "", end: url.searchParams.get("end") ?? "" }
      if (!isSfPeriod(period)) return workFailure(400, "Choose a valid start date and an end date on or after it.")
      if (!runtime.procurementSelections || !runtime.work) return workFailure(503, "Work discovery is not available in this installation. Return to Workbench and retry when the work service is available.")
      const digest = digestSfValue({ purpose: "work-selection", period })
      const access = await runtime.ui.admit(request, "sf_work_list", digest)
      if (access.status !== "ok") return workFailure(access.status === "denied" ? 403 : 503, access.status === "denied" ? "Your access changed or does not permit this work. Reopen the application before continuing." : "Work access could not be checked. Your period is preserved; retry.")
      try {
        if (!await runtime.ui.validate(access.value, "sf_work_list", digest)) return workFailure(403, "Your access changed. Reopen the application before continuing.")
        const selection = await runtime.procurementSelections.create(access.value, period).catch(() => undefined)
        if (!selection || selection.status !== "ok") return workFailure(selection?.status === "denied" ? 403 : selection?.status === "stale" || selection?.status === "conflict" ? 409 : selection?.status === "needs-input" ? 400 : 503, selection?.status === "denied" ? "Your access changed. Reopen the application before continuing." : "The work selection could not be confirmed. Review the period and select it again.")
        if (!await runtime.ui.revalidate(access.value)) return workFailure(403, "Your access changed. Reopen the application before continuing.")
        const query = new URLSearchParams({ sf: "workbench-work", selectionRef: selection.value.selectionRef, start: selection.value.period.start, end: selection.value.period.end })
        const body = `<p><a href="?sf=workbench">Workbench</a></p><h2>Work selection</h2><p><a href="?${esc(query.toString())}">${esc(selection.value.label)}</a> · ${esc(selection.value.period.start)} – ${esc(selection.value.period.end)}</p>`
        const html = documentHtml("Workbench", surface, "", pageMain({ drawn: true, key: "Workbench", index: 0 }, body), "", "", access.value.binding.accessRevision)
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
    if (request.method !== "GET" && request.method !== "HEAD") return workMode ? workFailure(405, "Open My work from Workbench to choose a period.") : reply({ status: "denied" }, 405)
    const allowed = mode === "workbench" ? ["sf"] : mode === "workbench-case" ? ["sf", "caseRef", "returnTo"] : mode === "workbench-work" ? ["sf", "selectionRef", "start", "end"] : mode === "workbench-search" ? ["sf", "q"] : ["sf", "runRef"]
    if ([...url.searchParams.keys()].some((key) => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) return workMode ? workFailure(400, "Review the work period and choose a new selection.") : reply({ status: "invalid" }, 400)
    const operation = mode === "workbench" || mode === "workbench-case" ? "sf_case_read" : mode === "workbench-search" ? "sf_knowledge_search" : mode === "workbench-routine" ? "sf_routine_status" : "sf_work_list"
    const payload = mode === "workbench-case" ? { caseRef: url.searchParams.get("caseRef") ?? "" } : mode === "workbench-search" ? { query: url.searchParams.get("q") ?? "", limit: 20 } : mode === "workbench-routine" ? { runRef: url.searchParams.get("runRef") ?? "" } : { selectionRef: url.searchParams.get("selectionRef") ?? "", period: { start: url.searchParams.get("start") ?? "", end: url.searchParams.get("end") ?? "" } }
    const decoded = mode === "workbench" ? undefined : decodeSfOperationInput(operation, payload)
    if (decoded && !decoded.ok) return workMode ? workFailure(400, "Choose a valid period and find work again.") : reply({ status: "invalid", reason: "invalid-selection" }, 400)
    if (workMode && !runtime.work) return workFailure(503, "The work presentation service is not available in this installation. Return to Workbench and retry when the service is available.")
    const landing = { caseAccess: false }
    const admitted = mode === "workbench" ? await (async () => {
      for (const candidate of ["sf_case_read", "sf_work_list", "sf_knowledge_search", "sf_routine_catalog"] as const) {
        const access = await runtime.ui.admit(request, candidate, digestSfValue({}))
        if (access.status === "ok") { landing.caseAccess = candidate === "sf_case_read"; return access }
      }
      return { status: "denied" as const, reason: "workbench-unavailable" }
    })() : await runtime.ui.admit(request, operation, digestSfValue(decoded?.ok ? decoded.value : {}))
    if (admitted.status !== "ok") return workMode ? workFailure(admitted.status === "denied" ? 403 : 503, "Work access could not be confirmed. Reopen the application before continuing.") : reply({ status: admitted.status }, 403)
    try {
      if (mode === "workbench-work" && runtime.work) {
        const selection = decodeSfOperationInput("sf_work_list", payload)
        if (!selection.ok) return workFailure(400, "Choose a valid period and find work again.")
        if (!await runtime.ui.validate(admitted.value, "sf_work_list", digestSfValue(selection.value))) return workFailure(403, "Your access changed. Reopen the application before continuing.")
        const work = await runtime.work.listPresentation(selection.value, admitted.value).catch(() => undefined)
        if (!work) return workFailure(503, "Work could not be loaded. Your period is preserved; find work again to retry.")
        if (work.status !== "ok") return workFailure(work.status === "denied" ? 403 : work.status === "stale" || work.status === "conflict" ? 409 : work.status === "needs-input" ? 400 : 503, work.status === "denied" ? "Your access changed. Reopen the application before continuing." : "Work could not be confirmed for this selection. Review the period and select it again.")
        if (!await runtime.ui.revalidate(admitted.value)) return workFailure(403, "Your access changed. Reopen the application before continuing.")
        const body = `<p><a href="?sf=workbench">Workbench</a></p><section data-work-list><h2>My work</h2>${work.value.items.length ? `<ul>${work.value.items.map((item) => `<li><strong>${esc(item.title ?? "Work item")}</strong> · ${esc(item.state)}${item.ownerLabel ? ` · ${esc(item.ownerLabel)}` : ""}${item.due ? ` · Due ${esc(item.due)}` : ""}${item.period ? ` · ${esc(item.period.start)} – ${esc(item.period.end)}` : ""}${item.observedVersion === undefined ? "" : ` · Observed version ${item.observedVersion}`}${item.sourceVersion === undefined ? "" : ` · Current version ${item.sourceVersion}`}${item.destination ? ` <button type="button" data-work-destination data-selection="${esc(JSON.stringify(selection.value))}" data-action-ref="${esc(item.actionRef)}" data-mount="${esc(input.mount.replace(/\/$/, ""))}">Open work</button><span role="status" aria-live="polite"></span>` : ""}${workReviewContext(item)}</li>`).join("")}</ul>` : "<p>No work is currently assigned in this selection.</p>"}</section>`
        const html = documentHtml("Workbench", surface, "", pageMain({ drawn: true, key: "Workbench", index: 0 }, body), "", "", admitted.value.binding.accessRevision).replace("</body>", `<script>${workDestinationScript}</script></body>`)
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
      const work = runtime.procurementSelections && runtime.work ? `<h2>My work</h2>${workForm()}` : "<p>Work list is currently unavailable.</p>"
      const runs = mode === "workbench" && runtime.routineRuns ? await (async () => {
        const digest = digestSfValue({ purpose: "routine-discovery" })
        const access = await runtime.ui.admit(request, "sf_routine_status", digest)
        if (access.status !== "ok") return undefined
        try {
          if (!await runtime.ui.validate(access.value, "sf_routine_status", digest)) return undefined
          const result: unknown = await runtime.routineRuns!.discoverRuns(access.value).catch(() => undefined)
          if (!result || typeof result !== "object" || !("status" in result) || result.status !== "ok" || !("value" in result) || !Array.isArray(result.value) || !await runtime.ui.revalidate(access.value)) return undefined
          const entries: unknown[] = result.value
          if (!entries.every((run): run is { admission: string; runRef?: string } => !!run && typeof run === "object" && "admission" in run && typeof run.admission === "string" && (!("runRef" in run) || run.runRef === undefined || typeof run.runRef === "string"))) return undefined
          return entries
        } finally { runtime.ui.finish(access.value) }
      })() : undefined
      const routines = runs ? `<h2>Routines</h2>${runs.length ? `<ul>${runs.map((run, index) => `<li>${run.runRef ? `<a href="?${esc(new URLSearchParams({ sf: "workbench-routine", runRef: run.runRef }).toString())}">Routine ${index + 1}</a>` : `Routine ${index + 1}`} · ${esc(run.admission)}</li>`).join("")}</ul>` : "<p>No accessible routine runs.</p>"}` : "<p>Routine list is currently unavailable.</p>"
      const forms = `<h2>Decisions</h2>${listUnavailable ? "<p>Decision list unavailable.</p>" : visible.length ? `<ul>${visible.map((item) => `<li><a href="?${esc(new URLSearchParams({ sf: "workbench-case", caseRef: item.caseRef }).toString())}">${esc(item.title)}</a> · version ${item.version}</li>`).join("")}</ul>` : "<p>No accessible decisions.</p>"}${decisionCreateForm}${portfolioWidget}${recordSearchWidget(surface)}${search}${work}${runtime.personalViews ? personalViewsWidget() : ""}${routines}`
      const result = decoded?.ok ? await runtime.dispatch(operation, decoded.value, admitted.value).catch(() => undefined) : undefined
      if (decoded?.ok && !result) return reply({ status: "unavailable", reason: "workbench-unavailable" }, 503)
      if (result && result.status !== "ok") return reply({ status: result.status }, result.status === "denied" ? 403 : result.status === "stale" ? 409 : 503)
      const output = result?.status === "ok" ? decodeSfOperationOutput(operation, result.result) : undefined
      if (output && !output.ok) return reply({ status: "unavailable" }, 503)
      if (!await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
      const caseOutput = operation === "sf_case_read" && result?.status === "ok" ? decodeSfOperationOutput("sf_case_read", result.result) : undefined
      const routineOutput = operation === "sf_routine_status" && result?.status === "ok" ? decodeSfOperationOutput("sf_routine_status", result.result) : undefined
      const searchOutput = operation === "sf_knowledge_search" && result?.status === "ok" ? decodeSfOperationOutput("sf_knowledge_search", result.result) : undefined
      const returnTo = caseOutput?.ok && url.searchParams.has("returnTo") ? contextualCaseReturn({ ...input, returnTo: url.searchParams.get("returnTo")!, sourceRefs: caseOutput.value.case.sourceRefs }) : undefined
      if (caseOutput?.ok && url.searchParams.has("returnTo") && !returnTo) return pageReply("<h2>Source context unavailable</h2><p>The return destination does not match this decision's contract evidence. Open the decision again from Workbench.</p>", 400)
      const analysis = caseOutput?.ok ? await (caseOutput.value.evidenceRefs.some((ref) => ref.kind === "record" && ref.target.surface === "procurement" && ref.target.recordType === "procurement-request") ? sourcingAnalysisForm : forecastAnalysisForm)(caseOutput.value, runtime) : ""
      const body = caseOutput?.ok ? (returnTo ? `<p><a href="${esc(returnTo)}">Return to contract</a></p>` : "") + decisionDesk(caseOutput.value) + decisionEditForm(caseOutput.value) + decisionChoiceForm(caseOutput.value) + decisionApplyForms(caseOutput.value) + caseWorkSelectionForm(caseOutput.value) + caseQuestionForm(caseOutput.value) + caseQuestionThreads(caseOutput.value) + portfolioHistory(caseOutput.value) + analysis + await scenarioAnalysisForm(caseOutput.value, runtime) + await intentAnalysisForm(caseOutput.value, runtime) : routineOutput?.ok ? routineStatus(routineOutput.value) : searchOutput?.ok ? `<h2>Search results</h2>${searchOutput.value.matches.length ? `<ul>${searchOutput.value.matches.map((item) => `<li data-document-result data-ref="${esc(JSON.stringify(item.documentRef))}"><strong data-document-title>Checking source…</strong><p data-document-text>${esc(item.text)}</p></li>`).join("")}</ul>` : "<p>No accessible results.</p>"}${searchOutput.value.limitations.map((item) => `<p>${esc(item)}</p>`).join("")}` : forms
      if (!await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
      const script = `;(() => { const initialize = () => {${decisionCreateScript}${decisionEditScript}${decisionChoiceScript}${decisionApplyScript}${caseWorkSelectionScript}${caseQuestionScript}${forecastAnalysisScript}${sourcingAnalysisScript}${personalViewsScript}${documentSearchScript}${recordSearchScript}${portfolioScript}}; initialize(); const root = document.querySelector('#content'); if (root) new MutationObserver(initialize).observe(root, { childList: true, subtree: true }) })();`
      const html = documentHtml("Workbench", surface, "", pageMain({ drawn: true, key: "Workbench", index: 0 }, `<p><a href="?sf=workbench">Workbench</a></p>${body}`), "", "", admitted.value.binding.accessRevision).replace("</script>", `${script}</script>`)
      return new Response(request.method === "HEAD" ? null : html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": htmlPolicy(html), "X-Content-Type-Options": "nosniff" } })
    } finally { runtime.ui.finish(admitted.value) }
  }
}

