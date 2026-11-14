import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { Period, ProductContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { BusinessContextService, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { isSfPeriod } from "../../../../modules/sucafina/Sucafinav1/product/contracts/validation.ts"
import type { ReviewAgendaCatalog, ReviewAgendaDiscoveryQuery } from "../../../../modules/sucafina/Sucafinav1/product/reviews/agenda-picker.ts"
import type { ReviewAgendaPorts } from "../../../../modules/sucafina/Sucafinav1/product/reviews/selection.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { SfScopedSourcePort } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { createProcurementCollectionRegistry, createProcurementSourceResolver } from "../../../../modules/sucafina/Sucafinav1/product/procurement/sources.ts"
import { createProcurementPort } from "../../../../modules/sucafina/Sucafinav1/product/procurement/port.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { domain } from "../../../../modules/sucafina/Sucafinav1/runtime/procurement.ts"
import { object, rows, text } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { procurementKeys } from "../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import { createDashboardAgendaSelector } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/agenda.ts"
import type { createSfBusinessServices } from "./business-services.ts"

type Business = ReturnType<typeof createSfBusinessServices>
type ProcurementCatalogIdentity = { currency: string; requests: string[]; suppliers: string[] }
export type SfReviewAgendaServicesInput = {
  authority: Pick<ReturnType<typeof createSfProductAuthority>, "host">
  business: {
    dashboardServices: Pick<Business["dashboardServices"], "discover">
    dashboardSources: Business["dashboardSources"]
    dashboardRecords: Pick<Business["dashboardRecords"], "issue" | "resolve" | "read">
    dashboard: Business["dashboard"]
    plannerProduct: Pick<Business["plannerProduct"], "versions" | "issueSource" | "planner">
    procurement: ReviewAgendaPorts["procurement"]
    contracts: Pick<Business["contracts"], "readContractSource" | "issueContract">
  }
  persistence: SfScopedSourcePort
}

const dashboardPages = ["Executive Dashboard", "Budget Overview", "OPEX Detail", "CAPEX Projects", "Headcount Overview",
  "Team Structure", "Talent Review", "Portfolio Dashboard", "All Projects", "Hot Topics & Actions", "IT Operations",
  "IT Security KPIs", "IT Risks", "Vendor Contracts", "Stakeholder Management", "IT Performance Contract"]

/** Discover current domain selectors; the existing producers remain the authority for every item. */
export function createSfReviewAgendaServices(input: SfReviewAgendaServicesInput) {
  const host = input.authority.host
  const current = async (call: TrustedDomainContext) => {
    const request = host.requestFor(call)
    return !!request && !request.signal.aborted && await host.revalidate(call) && !request.signal.aborted && host.requestFor(call) === request
  }
  const procurementSnapshot = async (call: TrustedDomainContext): Promise<PortResult<ProcurementCatalogIdentity>> => {
    const request = host.requestFor(call)
    if (!request || !await current(call)) return { status: "denied", reason: "agenda-procurement-authority-unavailable" }
    const environment = await host.environment(request)
    const result = await host.persistence.transaction<PortResult<ProcurementCatalogIdentity>>("procurement", async (snapshot) => {
      const principal = await host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
      if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: { status: "denied", reason: "agenda-procurement-authority-unavailable" } }
      const roles = principal.roles.filter((entry) => entry.surface === "procurement").map((entry) => entry.role)
      if (!procurementKeys({ roles }).length) return { commit: false, value: { status: "denied", reason: "agenda-procurement-authority-unavailable" } }
      const view = domain.view(snapshot, { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: [], domains: [] }, environment)
      const currency = text(object(view.data.formSettings).currency)
      if (!/^[A-Z]{3}$/.test(currency)) return { commit: false, value: { status: "unavailable", reason: "agenda-procurement-currency-unavailable" } }
      return { commit: false, value: { status: "ok", value: { currency, requests: rows(view.data.requests).map((row) => text(row.number)).filter(Boolean),
        suppliers: rows(view.data.suppliers).map((row) => text(row.id)).filter(Boolean) } } }
    }, { signal: request.signal })
    return await current(call) ? result : { status: "denied", reason: "agenda-procurement-authority-unavailable" }
  }
  // A separate immutable period closure for each read avoids the legacy per-principal period cache.
  const procurementFor = (period: Period) => {
    const selectedPeriod = structuredClone(period)
    const contextFor = async (call: TrustedDomainContext): Promise<PortResult<ProductContext>> => {
      const snapshot = await procurementSnapshot(call)
      if (snapshot.status !== "ok") return snapshot
      return { status: "ok", value: { installationId: call.binding.installationId, projectId: call.binding.projectId,
        principalRef: call.binding.principalRef, policyVersion: call.binding.policyVersion, accessRevision: call.binding.accessRevision,
        surface: "procurement", period: selectedPeriod, currency: snapshot.value.currency, sourceRefs: [], capabilities: [] } }
    }
    const source = createProcurementSourceResolver({ host, scopedSources: input.persistence, contextFor })
    const collection = createProcurementCollectionRegistry({ host, scopedSources: input.persistence, contextFor })
    const resolve: typeof source.resolve = async (reference, call) => {
      const result = await source.resolve(reference, call)
      if (result.status !== "ok") return result
      const request = host.requestFor(call)
      if (!request || !await current(call)) return { status: "denied", reason: "agenda-procurement-authority-unavailable" }
      const environment = await host.environment(request)
      const target = result.value.evidence.target
      if (!target.period || !Number.isFinite(Date.parse(environment.at)) || !await current(call)) return { status: "unavailable", reason: "agenda-procurement-source-unavailable" }
      // Bridge the producer's evidence identity into C01; values and calculations are unchanged.
      return { status: "ok", value: { ...result.value, context: { ...result.value.context, sourceRefs: [{ surface: target.surface,
        type: target.recordType, id: target.recordId, incarnation: target.incarnation, version: target.version,
        fields: target.fields, period: target.period, observedAt: environment.at }] } } }
    }
    const port = createProcurementPort({ ...host, ...collection, resolveRequestSource: resolve, resolveSupplierSource: resolve,
      isCurrentRequestSource: source.isCurrent, isCurrentSupplierSource: source.isCurrent, readContractSource: input.business.contracts.readContractSource })
    return { source, port }
  }
  const sourcePeriod = async (reference: string, call: TrustedDomainContext): Promise<PortResult<Period>> => {
    const parts = /^sf-procurement:([^:]+):([1-9]\d*)$/.exec(reference)
    if (!parts || !Number.isSafeInteger(Number(parts[2]))) return { status: "needs-input", reason: "agenda-procurement-selector-invalid" }
    const incarnation = decodeURIComponentSafe(parts[1]!)
    const request = host.requestFor(call)
    if (!incarnation || !request || !await current(call)) return { status: "denied", reason: "agenda-procurement-authority-unavailable" }
    const source = await input.persistence.resolveScopedSource("procurement", incarnation, async (snapshot, scope) => {
      if (request.signal.aborted || scope.principalRef !== call.binding.principalRef || scope.accessRevision !== call.binding.accessRevision ||
        scope.policyVersion !== call.binding.policyVersion || !["procurement-request", "procurement-supplier"].includes(scope.recordType)) return false
      const principal = await host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
      if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:")) return false
      const roles = principal.roles.filter((entry) => entry.surface === "procurement").map((entry) => entry.role)
      const selector = object(scope.selector)
      return procurementKeys({ roles }).length > 0 && selector.kind === "procurement-record-v1" && isSfPeriod(selector.period) &&
        selector.roleMapDigest === digestSfValue(roleMap(snapshot, "procurement")) &&
        selector.canWrite === (principal.canWrite && roles.some((role) => role !== "viewer")) && digestSfValue(selector.roles) === digestSfValue(roles)
    })
    if (!await current(call)) return { status: "denied", reason: "agenda-procurement-authority-unavailable" }
    if (!source) {
      // Revocation can tombstone a scope before the resolver invokes its callback. Inspect only
      // host-owned scope metadata so a new lease still clears an old actor's private selection.
      const status = await host.persistence.transaction<"denied" | "stale" | "unavailable">("procurement", async (snapshot) => {
        const entries = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.incarnation === incarnation)
        if (entries.length !== 1) return { commit: false, value: "unavailable" }
        const scope = entries[0]!.scope
        if (scope.principalRef !== call.binding.principalRef || scope.accessRevision !== call.binding.accessRevision || scope.policyVersion !== call.binding.policyVersion)
          return { commit: false, value: "denied" }
        const principal = await host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
        if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: "denied" }
        const roles = principal.roles.filter((entry) => entry.surface === "procurement").map((entry) => entry.role)
        const selector = object(scope.selector)
        if (!procurementKeys({ roles }).length || digestSfValue(selector.roles) !== digestSfValue(roles) ||
          selector.canWrite !== (principal.canWrite && roles.some((role) => role !== "viewer"))) return { commit: false, value: "denied" }
        return { commit: false, value: selector.roleMapDigest === digestSfValue(roleMap(snapshot, "procurement")) ? "unavailable" : "stale" }
      }, { signal: request.signal })
      return await current(call) ? { status, reason: "agenda-procurement-source-unavailable" } : { status: "denied", reason: "agenda-procurement-authority-unavailable" }
    }
    if (source.version !== Number(parts[2])) return { status: "stale", reason: "agenda-procurement-source-changed" }
    const period = object(source.scope.selector).period
    return isSfPeriod(period) ? { status: "ok", value: structuredClone(period) } : { status: "unavailable", reason: "agenda-procurement-period-unavailable" }
  }
  const procurement: ReviewAgendaPorts["procurement"] = {
    read: async (request, call) => {
      if (!request.requestRef.startsWith("sf-procurement:")) return input.business.procurement.read(request, call)
      const period = await sourcePeriod(request.requestRef, call)
      return period.status === "ok" ? procurementFor(period.value).port.read(request, call) : period
    },
    readSupplier: async (request, call) => {
      if (!request.supplierRef.startsWith("sf-procurement:")) return input.business.procurement.readSupplier(request, call)
      const period = await sourcePeriod(request.supplierRef, call)
      return period.status === "ok" ? procurementFor(period.value).port.readSupplier(request, call) : period
    },
    readContract: (request, call) => input.business.procurement.readContract(request, call),
  }
  const resolveEvidence = async (ref: Parameters<BusinessContextService["resolve"]>[0], call: TrustedDomainContext): Promise<BusinessEvidenceResolution | undefined> => {
    if (ref.kind !== "record" || ref.target.surface !== "procurement" || !ref.refId.startsWith("sf-procurement:")) return undefined
    const request = host.requestFor(call)
    const checkedAt = request ? (await host.environment(request)).at : new Date().toISOString()
    const unavailable = (state: "unavailable" | "stale" = "unavailable"): BusinessEvidenceResolution => ({ state, ref,
      accessRevision: call.binding.accessRevision, checkedAt })
    const period = await sourcePeriod(ref.refId, call)
    if (period.status !== "ok") return unavailable(period.status === "stale" ? "stale" : "unavailable")
    const scoped = procurementFor(period.value)
    const resolved = await scoped.source.resolve(ref.refId, call)
    if (resolved.status !== "ok" || digestSfValue(resolved.value.evidence) !== digestSfValue(ref)) return unavailable()
    const projection = ref.target.recordType === "procurement-request" ? await scoped.port.read({ requestRef: ref.refId }, call)
      : await scoped.port.readSupplier({ supplierRef: ref.refId, fields: ref.target.fields }, call)
    if (projection.status !== "ok" || !await current(call)) return unavailable()
    const checked = await scoped.source.resolve(ref.refId, call)
    if (checked.status !== "ok" || digestSfValue(checked.value.evidence) !== digestSfValue(ref) || !await current(call)) return unavailable()
    return { state: "fresh", ref, currentRef: checked.value.evidence, authorizedProjection: projection.value,
      accessRevision: call.binding.accessRevision, checkedAt }
  }
  const discover = async (incoming: ReviewAgendaDiscoveryQuery, call: TrustedDomainContext): Promise<PortResult<ReviewAgendaCatalog>> => {
    if (!incoming || Object.keys(incoming).some((key) => !["period", "domain"].includes(key)) || !isSfPeriod(incoming.period) ||
      incoming.domain !== undefined && !["dashboard", "planner", "procurement"].includes(incoming.domain)) return { status: "needs-input", reason: "invalid-agenda-discovery" }
    if (call.kind !== "ui" || !await current(call)) return { status: "denied", reason: "agenda-authority-unavailable" }
    const query = structuredClone(incoming), request = host.requestFor(call), binding = digestSfValue(call.binding)
    const live = async () => host.requestFor(call) === request && binding === digestSfValue(call.binding) && await current(call)
    const options: ReviewAgendaCatalog["options"][number][] = []
    const checks: (() => Promise<PortResult<never>["status"]>)[] = []
    const key = (domain: string, id: string) => `agenda:${digestSfValue({ domain, id, period: query.period })}`
    if (!query.domain || query.domain === "dashboard") {
      for (const page of dashboardPages) {
        const result = await input.business.dashboardServices.discover({ page, period: query.period }, call)
        if (!await live()) return { status: "denied", reason: "agenda-authority-unavailable" }
        if (result.status !== "ok" || !result.value.agenda) continue
        const section = result.value.agenda.section
        const source = await input.business.dashboardSources.resolveDashboardSource(section.selectionRef, call)
        if (source.status !== "ok") continue
        const digest = digestSfValue(source.value.evidence)
        options.push({ key: key("dashboard", page), label: page, domain: "dashboard", item: { kind: "dashboard", id: key("dashboard", page),
          topic: section.topic, period: section.period, selectionRef: section.selectionRef } })
        checks.push(async () => {
          const next = await input.business.dashboardSources.resolveDashboardSource(section.selectionRef, call)
          return next.status === "ok" ? digestSfValue(next.value.evidence) === digest ? "ok" : "stale" : next.status
        })
      }
    }
    if (!query.domain || query.domain === "planner") {
      const versions = await input.business.plannerProduct.versions.read(undefined, call)
      if (!await live()) return { status: "denied", reason: "agenda-authority-unavailable" }
      if (versions.status === "ok") {
        const available = versions.value.versions.filter((version) => version.year === Number(query.period.start.slice(0, 4)) && version.year === Number(query.period.end.slice(0, 4)))
        const official = available.filter((version) => version.state === "official")
        for (const candidate of available) {
          const source = await input.business.plannerProduct.issueSource(candidate.id, call)
          if (source.status !== "ok") continue
          const refs = [{ baseline: candidate, source }]
          if (official.length === 1 && official[0]!.id !== candidate.id) {
            const baseline = await input.business.plannerProduct.issueSource(official[0]!.id, call)
            if (baseline.status === "ok") refs.push({ baseline: official[0]!, source: baseline })
          }
          for (const base of refs) {
            // The existing Planner comparison port accepts and emits its canonical USD basis only.
            const comparison = { baseRef: base.source.value.evidence.refId, candidateRef: source.value.evidence.refId, period: query.period, currency: "USD" }
            const result = await input.business.plannerProduct.planner.compareForecast(comparison, call)
            if (result.status !== "ok") continue
            const label = base.baseline.id === candidate.id ? `Forecast · ${candidate.name || candidate.id}` : `${base.baseline.name || base.baseline.id} → ${candidate.name || candidate.id}`
            const id = key("planner", `${base.baseline.id}:${candidate.id}`)
            options.push({ key: id, label, domain: "planner", item: { kind: "forecast-comparison", id, title: label, ...comparison,
              sides: base.baseline.id === candidate.id ? ["candidate"] : ["baseline", "candidate"] } })
            const expected = [base.source.value.evidence.refDigest, source.value.evidence.refDigest]
            checks.push(async () => {
              const before = await input.business.plannerProduct.issueSource(base.baseline.id, call), after = await input.business.plannerProduct.issueSource(candidate.id, call)
              if (before.status !== "ok" || after.status !== "ok") return before.status !== "ok" ? before.status : after.status
              return before.value.evidence.refDigest === expected[0] && after.value.evidence.refDigest === expected[1] ? "ok" : "stale"
            })
          }
        }
        checks.push(async () => {
          const next = await input.business.plannerProduct.versions.read(undefined, call)
          return next.status === "ok" ? digestSfValue(next.value) === digestSfValue(versions.value) ? "ok" : "stale" : next.status
        })
      }
    }
    if (!query.domain || query.domain === "procurement") {
      const snapshot = await procurementSnapshot(call)
      if (!await live()) return { status: "denied", reason: "agenda-authority-unavailable" }
      if (snapshot.status === "ok") {
        const scoped = procurementFor(query.period)
        for (const kind of ["procurement-request", "procurement-supplier"] as const) {
          for (const id of kind === "procurement-request" ? snapshot.value.requests : snapshot.value.suppliers) {
            const source = await scoped.source.issue(kind, id, call)
            if (source.status !== "ok") continue
            const fields = ["number", "legalName", "status", "categories"]
            const projection = kind === "procurement-request" ? await scoped.port.read({ requestRef: source.value }, call)
              : await scoped.port.readSupplier({ supplierRef: source.value, fields }, call)
            if (projection.status !== "ok") continue
            const name = projection.value.values.find((value) => value.id === (kind === "procurement-request" ? "subject" : "legalName"))?.value
            const label = `${kind === "procurement-request" ? "Request" : "Supplier"} · ${typeof name === "string" && name.trim() ? name : id}`
            const optionId = key("procurement", `${kind}:${id}`)
            options.push({ key: optionId, label, domain: "procurement", item: kind === "procurement-request"
              ? { kind, id: optionId, title: label, period: query.period, requestRef: source.value }
              : { kind, id: optionId, title: label, period: query.period, supplierRef: source.value, fields } })
            const original = await scoped.source.resolve(source.value, call)
            if (original.status !== "ok") return { status: original.status, reason: "agenda-source-changed" }
            checks.push(async () => {
              const next = await scoped.source.resolve(source.value, call)
              return next.status === "ok" ? next.value.evidence.refDigest === original.value.evidence.refDigest ? "ok" : "stale" : next.status
            })
          }
        }
      }
      // Contracts are owned by Dashboard; Procurement permission alone never grants their content.
      const contracts = await input.business.dashboardServices.discover({ page: "Vendor Contracts", period: query.period }, call)
      const selectedContracts = contracts.status === "ok" && contracts.value.agenda
        ? await createDashboardAgendaSelector({ host, dashboard: input.business.dashboard, sources: input.business.dashboardSources, recordEvidence: input.business.dashboardRecords })(contracts.value.agenda.section, call) : undefined
      if (selectedContracts?.status === "ok") for (const reference of selectedContracts.value.recordRefs) {
        const source = await input.business.dashboardRecords.resolve(reference, call)
        if (source.status !== "ok" || source.value.target.recordType !== "contracts") continue
        const fields = ["num", "vendor", "name", "start", "end", "amount", "currency", "notes"]
        const issued = await input.business.contracts.issueContract({ id: source.value.target.recordId, fields, period: query.period }, call)
        if (issued.status !== "ok") continue
        const projection = await procurement.readContract({ contractRef: issued.value, fields }, call)
        if (projection.status !== "ok") continue
        const material = await input.business.dashboardRecords.resolve(issued.value, call)
        if (material.status !== "ok") return { status: material.status, reason: "agenda-contract-source-changed" }
        const id = key("procurement", `contract:${source.value.target.recordId}`)
        const name = projection.value.values.find((value) => value.id === "name")?.value
        const label = `Contract · ${typeof name === "string" && name.trim() ? name : source.value.target.recordId}`
        options.push({ key: id, label, domain: "procurement", item: { kind: "procurement-contract", id,
          title: label, period: query.period, contractRef: issued.value, fields } })
        checks.push(async () => {
          const next = await input.business.dashboardRecords.resolve(issued.value, call)
          return next.status === "ok" ? next.value.refDigest === material.value.refDigest ? "ok" : "stale" : next.status
        })
      }
    }
    for (const check of checks) {
      const status = await check()
      if (status !== "ok") return { status, reason: "agenda-source-or-access-changed" }
    }
    if (!await live()) return { status: "denied", reason: "agenda-authority-unavailable" }
    return { status: "ok", value: { options } }
  }
  return { discover, procurement, resolveEvidence }
}

/** Read-only route shares review admission; no identity or grants are accepted as query inputs. */
export function createSfReviewAgendaHttp(input: {
  authority: Pick<ReturnType<typeof createSfProductAuthority>, "ui">
  agenda: Pick<ReturnType<typeof createSfReviewAgendaServices>, "discover">
  origin: string
}) {
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    if (url.searchParams.get("sf") !== "review-agenda" || !["GET", "HEAD"].includes(request.method)) return undefined
    const json = (value: unknown, status = 200) => new Response(request.method === "HEAD" ? null : JSON.stringify(value), { status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    if (surface !== "dashboard" || url.origin !== input.origin || request.signal.aborted) return json({ status: "denied", reason: "agenda-authority-unavailable" }, 403)
    if ([...url.searchParams.keys()].some((key) => !["sf", "start", "end", "domain"].includes(key) || url.searchParams.getAll(key).length !== 1))
      return json({ status: "needs-input", reason: "invalid-agenda-query" }, 400)
    const period = { start: url.searchParams.get("start"), end: url.searchParams.get("end") }
    const domain = url.searchParams.get("domain")
    if (!isSfPeriod(period) || domain !== null && domain !== "dashboard" && domain !== "planner" && domain !== "procurement")
      return json({ status: "needs-input", reason: "invalid-agenda-query" }, 400)
    const query: ReviewAgendaDiscoveryQuery = { period, ...(domain ? { domain } : {}) }
    const digest = digestSfValue(query)
    const admitted = await input.authority.ui.admit(request, "sf_review_prepare", digest)
    if (admitted.status !== "ok") return json({ status: "denied", reason: "agenda-authority-unavailable" }, 403)
    try {
      if (input.authority.ui.requestFor(admitted.value) !== request || !await input.authority.ui.validate(admitted.value, "sf_review_prepare", digest) ||
        !await input.authority.ui.revalidate(admitted.value)) return json({ status: "denied", reason: "agenda-authority-unavailable" }, 403)
      const result = await input.agenda.discover(query, admitted.value)
      if (request.signal.aborted || input.authority.ui.requestFor(admitted.value) !== request || !await input.authority.ui.validate(admitted.value, "sf_review_prepare", digest) ||
        !await input.authority.ui.revalidate(admitted.value))
        return json({ status: "denied", reason: "agenda-authority-unavailable" }, 403)
      return json(result, result.status === "ok" ? 200 : result.status === "denied" ? 403 : result.status === "needs-input" ? 400 : result.status === "unavailable" || result.status === "failed" ? 503 : 409)
    } finally { input.authority.ui.finish(admitted.value) }
  }
}

function decodeURIComponentSafe(value: string) {
  try { return decodeURIComponent(value) } catch { return undefined }
}
