import { createHash, randomUUID } from "node:crypto"
import type { Application } from "../../runtime/application.ts"
import { htmlPolicy } from "../../runtime/application.ts"
import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import { documentHtml, pageMain } from "../../src/screen-shell.ts"
import { dashboardPages } from "../../src/nav.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { SfDomainValidation } from "../contracts/runtime.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import { createDashboardPort } from "../dashboard/port.ts"
import { createDashboardSourceHost } from "../dashboard/sources.ts"
import { presentDashboardBi, resolveDashboardBiSelection } from "../dashboard/bi-metadata.ts"
import { createBiDescriptor, readBiPresentation } from "../analytics/capabilities.ts"
import type { BiPresentationPort } from "../analytics/capabilities.ts"
import { sameBiProjection } from "../analytics/projection.ts"
import { dispatchSfCapability } from "../host-binding/capability-dispatch.ts"
import { createSfUiAuthority } from "./ui-authority.ts"
import { createDashboardSourceIssuer } from "./dashboard-sources.ts"
import type { SfScopedSourcePort } from "./source-lifecycle.ts"

/** Composed with the installation's existing authenticator, store and three surfaces. Starts no server. */
export function createSfBiHttp(input: {
  installationId: string
  projectId: string
  policyVersion: string
  identity?: () => { installationId: string; projectId: string } | undefined
  origin: string
  mount: string
  persistence: Application["persistence"] & SfScopedSourcePort
  authenticate: Application["authenticate"]
  environment: Application["environment"]
  browserScript: () => Promise<string>
}) {
  const ui = createSfUiAuthority({
    createId: randomUUID, now: Date.now, commandIdentity: async () => randomUUID(),
    authorize: (request, operation) => input.persistence.transaction("dashboard", async (snapshot) => {
      const identity = input.identity ? input.identity() : { installationId: input.installationId, projectId: input.projectId }
      if (!identity) return { commit: false, value: undefined }
      if (request.signal.aborted || !["sf_dashboard_read", "sf_bi_view"].includes(operation) || new URL(request.url).origin !== input.origin) return { commit: false, value: undefined }
      const principal = await input.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
      if (!principal || !principal.id || principal.id.startsWith("local:")) return { commit: false, value: undefined }
      const access = object(object(snapshot.data.access)[principal.id])
      const actor = { id: principal.id, roles: principal.roles.filter((row) => row.surface === "dashboard").map((row) => row.role),
        canWrite: principal.canWrite, assigned: Array.isArray(access.assigned) ? access.assigned.filter((entry): entry is string => typeof entry === "string") : [],
        domains: Array.isArray(access.domains) ? access.domains.filter((entry): entry is string => typeof entry === "string") : [] }
      const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((entry): entry is string => typeof entry === "string") : []
      if (!dashboardPages(actor, summaries).length) return { commit: false, value: undefined }
      return { commit: false, value: { installationId: identity.installationId, projectId: identity.projectId, policyVersion: input.policyVersion,
        principalRef: principal.id, accessRevision: digestSfValue(actor) } }
    }, { signal: request.signal }),
  })
  const authority: SfDomainValidation = {
    validateDomainContext: (context, operation, digest) => context.kind === "ui" ? ui.validate(context, operation, digest) : Promise.resolve(false),
    revalidateDomainContext: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
    receiptFor: (context, operation, digest, result) => context.kind === "ui" ? ui.receiptFor(context, operation, digest, result) : undefined,
  }
  const host: DomainPortHost = { persistence: input.persistence, authenticate: input.authenticate, environment: input.environment,
    requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
    revalidate: authority.revalidateDomainContext }
  const sources = createDashboardSourceHost({ host, scopedSources: input.persistence })
  const dashboard = createDashboardPort({ host, sources })
  const issue = createDashboardSourceIssuer({ host, scopedSources: input.persistence })
  const source: BiPresentationPort = {
    read: async (request, context) => {
      const route = resolveDashboardBiSelection(request.viewId, request.period)
      if (!route) return { status: "needs-input", reason: "view-or-period-unavailable" }
      const selected = await sources.resolveDashboardSource(request.selectionRef, context, { fields: route.fields, period: request.period })
      if (selected.status !== "ok") return selected
      if (selected.value.page !== route.page) return { status: "denied", reason: "selection-outside-view" }
      return dashboard.read({ selectionRef: request.selectionRef, fields: route.fields, period: request.period }, context)
    },
    describe: async (request, context, projection) => {
      if (!await host.revalidate(context)) return { status: "denied", reason: "authority-changed" }
      if (request.viewId !== "BI01" && request.viewId !== "BI07" && request.viewId !== "BI08") return { status: "unavailable", reason: "producer-unavailable" }
      return presentDashboardBi(request.viewId, projection)
    },
    revalidate: async (request, context, projection) => {
      if (!await host.revalidate(context)) return false
      const current = await source.read(request, context)
      return current.status === "ok" && (!projection || sameBiProjection(current.value, projection)) && await host.revalidate(context)
    },
  }
  const descriptor = createBiDescriptor(source, authority)
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    const mode = url.searchParams.get("sf")
    if (!mode) return undefined
    const json = (value: unknown, status = 200) => new Response(request.method === "HEAD" ? null : JSON.stringify(value), { status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    if (input.identity && !input.identity()) return json({ status: "unavailable", reason: "host-placement-unavailable" }, 503)
    if (surface !== "dashboard" || url.origin !== input.origin) return json({ status: "denied", reason: "surface-unavailable" }, 403)
    if (request.method !== "GET" && request.method !== "HEAD") return json({ status: "denied", reason: "read-method-required" }, 405)
    if (mode !== "bi" && mode !== "bi-data" && mode !== "bi-source") return json({ status: "unavailable", reason: "route-unavailable" }, 404)
    const queryKeys = mode === "bi-source" ? ["sf", "selectionRef"] : ["sf", "viewId", "start", "end"]
    if ([...url.searchParams.keys()].some((key) => !queryKeys.includes(key)) || [...url.searchParams.keys()].some((key) => url.searchParams.getAll(key).length !== 1)) return json({ status: "needs-input", reason: "invalid-query" }, 400)
    const period = { start: url.searchParams.get("start") ?? "", end: url.searchParams.get("end") ?? "" }
    const viewId = url.searchParams.get("viewId") ?? "BI01"
    const route = mode === "bi-data" ? resolveDashboardBiSelection(viewId, period) : { page: "", fields: [] }
    if (!route) return json({ status: "needs-input", reason: "view-or-period-unavailable" }, 422)
    const bootstrap = mode === "bi-data" ? { selectionRef: "host-source-admission", period, fields: route.fields }
      : { purpose: mode, selectionRef: url.searchParams.get("selectionRef") }
    const digest = digestSfValue(bootstrap)
    const admission = await ui.admit(request, "sf_dashboard_read", digest)
    if (admission.status !== "ok") return json(admission, 401)
    const context = admission.value
    try {
      if (!await ui.validate(context, "sf_dashboard_read", digest)) return json({ status: "denied", reason: "authority-unavailable" }, 403)
      if (mode === "bi-source") {
        const selectionRef = url.searchParams.get("selectionRef")
        if (!selectionRef || selectionRef.length > 2048) return json({ status: "needs-input", reason: "invalid-selection" }, 400)
        const current = await sources.resolveDashboardSource(selectionRef, context)
        if (current.status !== "ok") return json(current, current.status === "denied" ? 403 : 409)
        const target = current.value.evidence.target
        if (!target.period || !await ui.revalidate(context)) return json({ status: "denied", reason: "source-authority-changed" }, 403)
        const destination = `${input.mount}/dashboard?${new URLSearchParams({ page: current.value.page, year: target.period.start.slice(0, 4) })}`
        return json({ url: destination, source: { id: target.recordId, version: target.version } })
      }
      if (mode === "bi") {
        const script = (await input.browserScript()).replace(/<\/script/gi, "<\\/script")
        if (!await ui.revalidate(context)) return json({ status: "denied", reason: "authority-changed" }, 403)
        const html = documentHtml("Business intelligence", "dashboard", `<a href="${input.mount}/dashboard">Dashboard</a>`,
          pageMain({ drawn: true, key: "Business intelligence", index: 0 }, '<section data-sf-bi><p role="status">Loading analyses…</p></section>'), "").replace("</body>", `<script>${script}</script></body>`)
        const policy = htmlPolicy(html).replace("; style-src", ` 'sha256-${createHash("sha256").update(script).digest("base64")}'; style-src`)
        return new Response(request.method === "HEAD" ? null : html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": policy, "X-Content-Type-Options": "nosniff" } })
      }
      const selected = await issue({ ...route, period }, context)
      if (selected.status !== "ok") return json(selected, selected.status === "denied" ? 403 : 409)
      const payload = { viewId, selectionRef: selected.value.selectionRef, period }
      const next = await ui.admit(request, "sf_bi_view", digestSfValue(payload))
      if (next.status !== "ok") return json(next, 403)
      try {
        const result = await dispatchSfCapability({ operation: "sf_bi_view", payload, context: next.value, descriptors: [descriptor], authority,
          validateInput: (_descriptor, value) => decodeSfOperationInput("sf_bi_view", value).ok,
          validateOutput: (_descriptor, value) => value.status !== "ok" || decodeSfOperationOutput("sf_bi_view", value.result).ok })
        if (result.status !== "ok") return json(result, result.status === "denied" ? 403 : 409)
        const presentation = await readBiPresentation(payload, next.value, source, authority)
        if (presentation.status !== "ok") return json(presentation, 409)
        const decoded = decodeSfOperationOutput("sf_bi_view", result.result)
        if (!decoded.ok || !sameBiProjection(decoded.value, presentation.value.projection) || !await ui.revalidate(next.value)) return json({ status: "stale", reason: "projection-changed" }, 409)
        return json({ request: payload, ...presentation.value, receipt: result.receipt })
      } finally { ui.finish(next.value) }
    } finally { ui.finish(context) }
  }
}
