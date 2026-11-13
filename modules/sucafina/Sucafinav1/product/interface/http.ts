import type { SfHostServices } from "../contracts/host-context.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import { documentHtml, esc, pageMain } from "../../src/screen-shell.ts"
import { htmlPolicy } from "../../runtime/application.ts"
import { decisionDesk, routineStatus, workList } from "../ui/components.ts"

/** Mount in the existing authenticated application; authority remains private to the host. */
export function createSfWorkbenchHttp(input: { origin: string; mount: string; runtime: () => SfHostServices | undefined }) {
  const modes = ["workbench", "workbench-case", "workbench-work", "workbench-search", "workbench-routine", "workbench-command"] as const
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    const mode = url.searchParams.get("sf")
    if (!mode || !modes.some((entry) => entry === mode)) return undefined
    const reply = (value: unknown, status: number) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    if (url.origin !== input.origin || !["dashboard", "planner", "procurement"].includes(surface) || url.pathname !== `${input.mount}/${surface}`) return reply({ status: "denied" }, 403)
    const runtime = input.runtime()
    if (!runtime) return reply({ status: "unavailable", reason: "workbench-unavailable" }, 503)
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
        const result = await runtime.dispatch(operation, decoded.value, admitted.value)
        if (result.status !== "ok") return reply({ status: result.status, reason: result.reason }, result.status === "denied" ? 403 : result.status === "stale" ? 409 : 503)
        const output = decodeSfOperationOutput(operation, result.result)
        if (!output.ok || !await runtime.ui.revalidate(admitted.value)) return reply({ status: "unavailable" }, 503)
        return reply({ status: "ok", value: output.value, outputRef: result.outputRef }, 200)
      } finally { runtime.ui.finish(admitted.value) }
    }
    if (request.method !== "GET" && request.method !== "HEAD") return reply({ status: "denied" }, 405)
    const allowed = mode === "workbench" ? ["sf"] : mode === "workbench-case" ? ["sf", "caseRef"] : mode === "workbench-work" ? ["sf", "selectionRef", "start", "end"] : mode === "workbench-search" ? ["sf", "q"] : ["sf", "runRef"]
    if ([...url.searchParams.keys()].some((key) => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) return reply({ status: "invalid" }, 400)
    const operation = mode === "workbench-case" ? "sf_case_read" : mode === "workbench-search" ? "sf_knowledge_search" : mode === "workbench-routine" ? "sf_routine_status" : "sf_work_list"
    const payload = mode === "workbench-case" ? { caseRef: url.searchParams.get("caseRef") ?? "" } : mode === "workbench-search" ? { query: url.searchParams.get("q") ?? "", limit: 20 } : mode === "workbench-routine" ? { runRef: url.searchParams.get("runRef") ?? "" } : { selectionRef: url.searchParams.get("selectionRef") ?? "", period: { start: url.searchParams.get("start") ?? "", end: url.searchParams.get("end") ?? "" } }
    const decoded = mode === "workbench" ? undefined : decodeSfOperationInput(operation, payload)
    if (decoded && !decoded.ok) return reply({ status: "invalid", reason: "invalid-selection" }, 400)
    const admitted = await runtime.ui.admit(request, operation, digestSfValue(decoded?.ok ? decoded.value : {}))
    if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
    try {
      const forms = `<p>Open a decision, work list, source search or routine using an authorized reference.</p><form method="get"><input type="hidden" name="sf" value="workbench-case"><label>Decision reference<input name="caseRef" required></label><button>Open decision</button></form><form method="get"><input type="hidden" name="sf" value="workbench-work"><label>Selection reference<input name="selectionRef" required></label><label>Start<input name="start" type="date" required></label><label>End<input name="end" type="date" required></label><button>Open work</button></form><form method="get"><input type="hidden" name="sf" value="workbench-search"><label>Search documents<input name="q" required></label><button>Search</button></form><form method="get"><input type="hidden" name="sf" value="workbench-routine"><label>Routine reference<input name="runRef" required></label><button>Open routine</button></form>`
      const result = decoded?.ok ? await runtime.dispatch(operation, decoded.value, admitted.value) : undefined
      if (result && result.status !== "ok") return reply({ status: result.status, reason: result.reason }, result.status === "denied" ? 403 : result.status === "stale" ? 409 : 503)
      const output = result?.status === "ok" ? decodeSfOperationOutput(operation, result.result) : undefined
      if (output && !output.ok) return reply({ status: "unavailable" }, 503)
      if (!await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
      const caseOutput = operation === "sf_case_read" && result?.status === "ok" ? decodeSfOperationOutput("sf_case_read", result.result) : undefined
      const workOutput = operation === "sf_work_list" && result?.status === "ok" ? decodeSfOperationOutput("sf_work_list", result.result) : undefined
      const routineOutput = operation === "sf_routine_status" && result?.status === "ok" ? decodeSfOperationOutput("sf_routine_status", result.result) : undefined
      const searchOutput = operation === "sf_knowledge_search" && result?.status === "ok" ? decodeSfOperationOutput("sf_knowledge_search", result.result) : undefined
      const body = caseOutput?.ok ? decisionDesk(caseOutput.value) : workOutput?.ok ? workList(workOutput.value) : routineOutput?.ok ? routineStatus(routineOutput.value) : searchOutput?.ok ? `<h2>Search results</h2>${searchOutput.value.matches.length ? `<ul>${searchOutput.value.matches.map((item) => `<li><strong>${esc(item.documentRef.refId)}</strong><p>${esc(item.text)}</p></li>`).join("")}</ul>` : "<p>No accessible results.</p>"}${searchOutput.value.limitations.map((item) => `<p>${esc(item)}</p>`).join("")}` : forms
      const html = documentHtml("Workbench", surface, "", pageMain({ drawn: true, key: "Workbench", index: 0 }, `<p><a href="?sf=workbench">Workbench</a></p>${body}`), "")
      return new Response(request.method === "HEAD" ? null : html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": htmlPolicy(html), "X-Content-Type-Options": "nosniff" } })
    } finally { runtime.ui.finish(admitted.value) }
  }
}
