import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { isSfPeriod } from "../../../../modules/sucafina/Sucafinav1/product/contracts/validation.ts"
import { documentHtml, pageMain } from "../../../../modules/sucafina/Sucafinav1/src/screen-shell.ts"
import { htmlPolicy } from "../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfWorkDestinations, SfWorkItemView } from "./work-destinations.ts"

/** A read-only page in the existing Dashboard mount; every URL reopens work. */
export function createSfWorkHttp(input: { authority: ReturnType<typeof createSfProductAuthority>; destinations: ReturnType<typeof createSfWorkDestinations>; origin: string; mount: string }) {
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    if (url.searchParams.get("sf") !== "work-item") return undefined
    const json = (status: number, reason: string) => new Response(request.method === "HEAD" ? null : JSON.stringify({ status: status === 403 ? "denied" : "unavailable", reason }),
      { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    if (surface !== "dashboard" || url.pathname !== `${input.mount}/dashboard` || url.origin !== input.origin || request.signal.aborted ||
      request.headers.get("sec-fetch-site") === "cross-site") return json(403, "work-surface-unavailable")
    if (request.method !== "GET" && request.method !== "HEAD") return json(405, "read-method-required")
    if ([...url.searchParams.keys()].some((key) => !["sf", "selectionRef", "actionRef", "start", "end"].includes(key) || url.searchParams.getAll(key).length !== 1)) return json(400, "invalid-work-query")
    const selection = { selectionRef: url.searchParams.get("selectionRef") ?? "", period: { start: url.searchParams.get("start") ?? "", end: url.searchParams.get("end") ?? "" } }
    const actionRef = url.searchParams.get("actionRef") ?? ""
    if (!selection.selectionRef.trim() || selection.selectionRef.length > 16_384 || !actionRef.trim() || actionRef.length > 16_384 || !isSfPeriod(selection.period)) return json(400, "invalid-work-query")
    const operation = "sf-human:collaboration.work.destination", digest = digestSfValue({ selection, actionRef })
    const admitted = await input.authority.ui.admit(request, operation, digest)
    if (admitted.status !== "ok") return json(403, "work-authority-unavailable")
    const call = admitted.value
    try {
      if (!await input.authority.ui.validate(call, operation, digest)) return json(403, "work-authority-unavailable")
      const found = await input.destinations.read(selection, actionRef, call)
      if (found.status !== "ok") return json(found.status === "denied" ? 403 : 409, found.reason)
      const back = new URL(`${input.mount}/dashboard`, input.origin)
      back.searchParams.set("sf", "workbench-work"); back.searchParams.set("selectionRef", selection.selectionRef)
      back.searchParams.set("start", selection.period.start); back.searchParams.set("end", selection.period.end)
      const html = documentHtml("My work", "dashboard", `<a href="${escapeHtml(`${back.pathname}${back.search}`)}">My work</a>`,
        pageMain({ drawn: true, key: "My work", index: 0 }, render(found.value.view)), "")
      if (!await found.value.verify()) return json(403, "work-authority-changed-before-display")
      return new Response(request.method === "HEAD" ? null : html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
        "Content-Security-Policy": htmlPolicy(html), "X-Content-Type-Options": "nosniff" } })
    } catch { return json(503, "work-destination-unavailable") }
    finally { input.authority.ui.finish(call) }
  }
}

function render(view: SfWorkItemView) {
  const item = view.item
  const fields = [{ label: "Owner", value: item.ownerLabel ?? item.ownerRef }, { label: "State", value: item.state },
    ...(item.period ? [{ label: "Period", value: `${item.period.start} – ${item.period.end}` }] : []),
    ...(item.sourceVersion === undefined ? [] : [{ label: "Current source version", value: String(item.sourceVersion) }]),
    ...(item.observedVersion === undefined ? [] : [{ label: "Observed source version", value: String(item.observedVersion) }]),
    ...(item.reason ? [{ label: "Reason", value: item.reason }] : []), ...view.details]
  return `<section data-work-item><h1>${escapeHtml(item.title ?? "Work item")}</h1><dl>${fields.map((field) => `<dt>${escapeHtml(field.label)}</dt><dd>${escapeHtml(field.value)}</dd>`).join("")}</dl>${view.links.length ? `<nav aria-label="Current sources">${view.links.map((link) => `<p><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></p>`).join("")}</nav>` : ""}</section>`
}

function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;") }
