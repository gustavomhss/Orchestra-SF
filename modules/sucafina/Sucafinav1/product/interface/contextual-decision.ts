import type { SfHostServices } from "../contracts/host-context.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { Period } from "../contracts/context.ts"
import type { SfScopedSourcePort } from "../integration/source-lifecycle.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { createDashboardRecordSourceIssuer } from "../integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost } from "../dashboard/sources.ts"
import { sfViewSelectionKeys } from "./personal-views.ts"
import { decisionCreateFromContext, decisionCreateScript } from "../ui/decision-create.ts"
import { documentHtml, esc, pageMain } from "../../src/screen-shell.ts"
import { htmlPolicy } from "../../runtime/application.ts"

/** Navigation is a selector. Only the mounted issuer can authorize its record evidence. */
export function canonicalContractReturn(input: { origin: string; mount: string; returnTo: string; recordId: string; period: Period }): string | undefined {
  if (!input.recordId.trim() || input.recordId.length > 512 || !isSfPeriod(input.period)) return undefined
  const year = input.period.start.slice(0, 4)
  if (!/^202[4-7]$/.test(year) || input.period.start !== `${year}-01-01` || input.period.end !== `${year}-12-31`) return undefined
  const url = URL.canParse(input.returnTo, input.origin) ? new URL(input.returnTo, input.origin) : undefined
  if (!url || url.origin !== input.origin || url.username || url.password || url.pathname !== `${input.mount}/dashboard` || url.searchParams.get("page") !== "Vendor Contracts" || url.searchParams.get("year") !== year || !url.hash.startsWith("#record-")) return undefined
  try { if (decodeURIComponent(url.hash.slice(8)) !== input.recordId) return undefined } catch { return undefined }
  const allowed = ["page", "q", "view", ...sfViewSelectionKeys("dashboard", "Vendor Contracts")]
  for (const [key, value] of url.searchParams) {
    if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1 || value.length > 512 || /[\u0000-\u001f\u007f]/.test(value)) return undefined
    if ((key === "year" || key.endsWith("Year")) && value && !/^202[4-7]$/.test(value)) return undefined
    if (key.endsWith("Month") && value && !/^(?:[1-9]|1[0-2])$/.test(value)) return undefined
  }
  url.hash = `record-${encodeURIComponent(input.recordId)}`
  return `${url.pathname}${url.search}${url.hash}`
}

export function contextualCaseReturn(input: { origin: string; mount: string; returnTo: string; sourceRefs: readonly BusinessEvidenceRef[] }) {
  for (const ref of input.sourceRefs) {
    if (ref.kind !== "record" || ref.target.surface !== "dashboard" || ref.target.recordType !== "contracts" || !ref.target.period) continue
    const value = canonicalContractReturn({ ...input, recordId: ref.target.recordId, period: ref.target.period })
    if (value) return value
  }
  return undefined
}

function scopedSourcePort(value: unknown): value is SfScopedSourcePort {
  return !!value && typeof value === "object" && "readScopedSource" in value && typeof value.readScopedSource === "function" && "resolveScopedSource" in value && typeof value.resolveScopedSource === "function"
}

export async function handleContextualDecision(request: Request, input: { origin: string; mount: string; surface: string; runtime: SfHostServices }) {
  const { runtime } = input
  const url = new URL(request.url)
  const render = (body: string, status: number, revision = "") => {
    const html = documentHtml("Workbench", input.surface, "", pageMain({ drawn: true, key: "Workbench", index: 0 }, `<p><a href="?sf=workbench">Workbench</a></p>${body}`), "", "", revision).replace("</body>", `<script>${decisionCreateScript}</script></body>`)
    return new Response(request.method === "HEAD" ? null : html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": htmlPolicy(html), "X-Content-Type-Options": "nosniff", ...(revision ? { "X-SF-Access-Revision": revision } : {}) } })
  }
  if (input.surface !== "dashboard" || (request.method !== "GET" && request.method !== "HEAD")) return render("<h2>Context unavailable</h2><p>Open an authorized contract in Dashboard to create a contextual decision.</p>", input.surface !== "dashboard" ? 403 : 405)
  if ([...url.searchParams.keys()].some((key) => !["sf", "recordId", "start", "end", "returnTo"].includes(key) || url.searchParams.getAll(key).length !== 1)) return render("<h2>Invalid context</h2><p>Open the contract again and select Create decision.</p>", 400)
  const recordId = url.searchParams.get("recordId") ?? ""
  const period = { start: url.searchParams.get("start") ?? "", end: url.searchParams.get("end") ?? "" }
  const returnTo = canonicalContractReturn({ ...input, returnTo: url.searchParams.get("returnTo") ?? "", recordId, period })
  if (!returnTo) return render("<h2>Invalid context</h2><p>Open the contract again to choose an available period and record.</p>", 400)
  const back = `<p><a href="${esc(returnTo)}">Return to contract</a></p>`
  const persistence = runtime.host.persistence
  if (!scopedSourcePort(persistence)) return render(`<h2>Source unavailable</h2><p>This installation cannot issue contract evidence. Return to the contract and retry when its source service is available.</p>${back}`, 503)
  const digest = digestSfValue({ purpose: "contextual-decision", recordId, period })
  const admitted = await runtime.ui.admit(request, "sf_case_draft", digest)
  if (admitted.status !== "ok") return render("<h2>Access unavailable</h2><p>Your access changed or could not be checked. Reopen the application before continuing.</p>", admitted.status === "denied" ? 403 : 503)
  try {
    if (!await runtime.ui.validate(admitted.value, "sf_case_draft", digest)) return render("<h2>Access unavailable</h2><p>Reopen the application before continuing.</p>", 403)
    const records = createDashboardRecordEvidenceHost({ host: runtime.host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host: runtime.host, scopedSources: persistence }) })
    const issued = await records.issue({ page: "Vendor Contracts", recordType: "contracts", recordId, fields: ["vendor", "amount"], period }, admitted.value).catch(() => undefined)
    if (!await runtime.ui.revalidate(admitted.value)) return render("<h2>Access unavailable</h2><p>Your access changed. Reopen the application before continuing.</p>", 403)
    if (!issued || issued.status !== "ok") return render(`<h2>Source unavailable</h2><p>The selected contract could not be revalidated. Return to its current record and try again.</p>${back}`, 503)
    const projection = await records.read(issued.value.refId, admitted.value).catch(() => undefined)
    if (!await runtime.ui.revalidate(admitted.value)) return render("<h2>Access unavailable</h2><p>Your access changed. Reopen the application before continuing.</p>", 403)
    if (!projection || projection.status !== "ok") return render(`<h2>Source unavailable</h2><p>The contract changed while its evidence was read. Return to the contract and try again.</p>${back}`, 409)
    const vendor = projection.value.values.find((value) => value.id === `contracts:${encodeURIComponent(recordId)}:vendor`)?.value
    const label = typeof vendor === "string" && vendor.trim() ? vendor : "Selected contract"
    return render(`<section data-decision-context><h2>Create a decision from ${esc(label)}</h2><p>Contract evidence for ${esc(period.start)} – ${esc(period.end)} will be revalidated when you create the decision. Enter the decision currency explicitly.</p>${back}${decisionCreateFromContext({ sourceRefs: [issued.value], period, returnTo })}</section>`, 200, admitted.value.binding.accessRevision)
  } finally { runtime.ui.finish(admitted.value) }
}
