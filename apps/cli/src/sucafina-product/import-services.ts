import type { CreateSfHostRuntime } from "../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { CapabilityDescriptor, CapabilityResult, TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { sfOperationInputSchemas } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import { sfOperationOutputSchemas } from "../../../../modules/sucafina/Sucafinav1/product/contracts/output-schemas.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Actor } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { sfPlannerProjectionSelector } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import { createSfPlannerSourceHost, sfPlannerSourceSelector } from "../../../../modules/sucafina/Sucafinav1/product/integration/planner-sources.ts"
import { createDashboardSourceHost } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/sources.ts"
import { createDashboardSourceIssuer } from "../../../../modules/sucafina/Sucafinav1/product/integration/dashboard-sources.ts"
import { projectPlanner } from "../../../../modules/sucafina/Sucafinav1/product/planner/adapter.ts"
import { rows } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { createSfImportHost } from "../../../../modules/sucafina/Sucafinav1/product/imports/host.ts"
import { verifyDashboardImportTarget, verifyPlannerImportTarget } from "../../../../modules/sucafina/Sucafinav1/product/imports/source-fences.ts"
import type { ImportTarget } from "../../../../modules/sucafina/Sucafinav1/product/imports/staged-files.ts"

export function createSfImportServices(input: { runtime: Parameters<CreateSfHostRuntime>[0]; authority: ReturnType<typeof createSfProductAuthority> }) {
  const assets = input.runtime.assets
  if (!assets || !Object.is(assets.persistence, input.runtime.persistence)) return undefined
  const authority = input.authority
  const host = authority.host
  const dashboardSources = createDashboardSourceHost({ host, scopedSources: input.runtime.persistence })
  const plannerSources = createSfPlannerSourceHost({ host, scopedSources: input.runtime.persistence, coverageFor: async () => ({ status: "unavailable", reason: "not-used-by-import" }) })
  const datasetActor = async (snapshot: Parameters<typeof roleMap>[0], request: Request, context: TrustedDomainContext) => {
    const principal = await host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
    if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return undefined
    const access = object(object(snapshot.data.access)[principal.id])
    const roles = principal.roles.filter((row) => row.surface === "dashboard").map((row) => row.role)
    const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
    return actor.canWrite && actor.roles.includes("admin") ? actor : undefined
  }
  const resolveDataset = async (target: ImportTarget, context: TrustedDomainContext) => {
    const request = host.requestFor(context)
    if (!request || target.surface !== "dashboard" || target.selectionRef !== `sf-dataset:${encodeURIComponent(target.incarnation)}:${target.version}` || !await host.revalidate(context)) return { status: "denied" as const, reason: "dataset-unavailable" }
    const source = await input.runtime.persistence.resolveScopedSource("dashboard", target.incarnation, async (snapshot, scope) => {
      if (scope.principalRef !== context.binding.principalRef || scope.accessRevision !== context.binding.accessRevision || scope.policyVersion !== context.binding.policyVersion || scope.recordType !== "dashboard-dataset" || scope.recordId !== "all") return false
      const actor = await datasetActor(snapshot, request, context)
      return !!actor && digestSfValue(scope.selector) === digestSfValue({ kind: "dashboard-dataset-v1", actor, roleMapDigest: digestSfValue(roleMap(snapshot, "dashboard")), fields: ["data"] })
    })
    if (!source || source.incarnation !== target.incarnation || source.version !== target.version || !await host.revalidate(context)) return { status: "stale" as const, reason: "dataset-changed" }
    const ref: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", evidenceLevel: "observed", refId: target.selectionRef, installationId: context.binding.installationId, projectId: context.binding.projectId, refDigest: "", target: { surface: "dashboard", recordType: "dashboard-dataset", recordId: "all", incarnation: source.incarnation, version: source.version, fields: ["data"], projectionDigest: source.inputDigest } }
    return { status: "ok" as const, value: { page: "IT Risks", evidence: { ...ref, refDigest: digestSfEvidenceRef(ref) } } }
  }
  const authorizeTarget = async (target: ImportTarget, context: TrustedDomainContext, mode?: "receipt") => {
    const request = host.requestFor(context)
    if (!request || !await host.revalidate(context)) return false
    if (target.surface === "dashboard" && target.selectionRef.startsWith("sf-dataset:")) {
      if (mode !== "receipt") return (await resolveDataset(target, context)).status === "ok"
      const actor = await host.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: await datasetActor(snapshot, request, context) }), { signal: request.signal })
      return !!actor && await host.revalidate(context)
    }
    const source = await input.runtime.persistence.resolveScopedSource(target.surface, target.incarnation, async (snapshot, scope) => {
      if (scope.principalRef !== context.binding.principalRef || scope.accessRevision !== context.binding.accessRevision || scope.policyVersion !== context.binding.policyVersion || scope.recordType !== (target.surface === "planner" ? "planner-version" : "dashboard-page")) return false
      const principal = await host.authenticate(request, { surface: target.surface, roleMap: roleMap(snapshot, target.surface) })
      if (!principal || principal.id !== scope.principalRef || principal.id.startsWith("local:")) return false
      const access = object(object(snapshot.data.access)[principal.id])
      const roles = principal.roles.filter((row) => row.surface === target.surface).map((row) => row.role)
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      if (!actor.canWrite) return false
      const selector = object(scope.selector)
      if (target.surface === "planner") return target.selectionRef === `planner-version:${encodeURIComponent(scope.recordId)}:${encodeURIComponent(target.incarnation)}:${target.version}` && digestSfValue(scope.selector) === digestSfValue(sfPlannerProjectionSelector(snapshot, actor))
      return target.selectionRef === `sf-source:${encodeURIComponent(target.incarnation)}:${target.version}` && selector.page === scope.recordId && selector.roleMapDigest === digestSfValue(roleMap(snapshot, "dashboard")) && digestSfValue(selector.actor) === digestSfValue(actor)
    })
    return !!source && source.incarnation === target.incarnation && await host.revalidate(context)
  }
  const imports = createSfImportHost({ host, assets: assets.persistence, services: assets.services, state: authority.state, operationIdentity: (context, operation) => {
    if (context.kind === "ui") return authority.ui.operationIdentity(context)
    if (!operation) return undefined
    const receipt = authority.authority.receiptFor(context, operation.name, operation.digest)
    return receipt?.kind === "native" ? digestSfValue({ runId: receipt.runId, callId: receipt.callId, operation: operation.name }) : undefined
  }, authorizeTarget, authorizeAdmission: (payload, context) => authority.human.authorize(context, "imports.admit", payload), preview: { revalidate: host.revalidate }, apply: { revalidate: host.revalidate, confirm: (manifest, context) => authority.human.authorize(context, "imports.apply", { manifestId: manifest.id, version: manifest.version }) }, planner: { resolveTarget: (target, context) => plannerSources.resolveForecastSource(target.selectionRef, context), verifyTarget: verifyPlannerImportTarget }, dashboard: { resolveTarget: (target, context) => target.selectionRef.startsWith("sf-dataset:") ? resolveDataset(target, context) : dashboardSources.resolveDashboardSource(target.selectionRef, context), verifyScope: verifyDashboardImportTarget } })
  const prepareTarget = async (selection: { surface: "planner" | "dashboard"; selectionRef: string; options: ImportTarget["options"] }, context: TrustedDomainContext) => {
    const match = /^sf-dataset:([^:]+):([1-9]\d*)$/.exec(selection.selectionRef)
    const incarnation = match ? (() => { try { return decodeURIComponent(match[1]!) } catch { return undefined } })() : undefined
    const source = selection.surface === "planner" ? await plannerSources.resolveForecastSource(selection.selectionRef, context) : incarnation ? await resolveDataset({ surface: "dashboard", selectionRef: selection.selectionRef, incarnation, version: Number(match![2]), options: selection.options }, context) : await dashboardSources.resolveDashboardSource(selection.selectionRef, context)
    if (source.status !== "ok") return source
    const target: ImportTarget = { surface: selection.surface, selectionRef: selection.selectionRef, incarnation: source.value.evidence.target.incarnation, version: source.value.evidence.target.version, options: structuredClone(selection.options) }
    return await authorizeTarget(target, context) ? { status: "ok" as const, value: target } : { status: "denied" as const, reason: "target-access-unavailable" }
  }
  const discover = async (surface: "planner" | "dashboard", context: TrustedDomainContext, period?: Period) => {
    const request = host.requestFor(context)
    if (!request || !await host.revalidate(context)) return { status: "denied" as const, reason: "target-access-unavailable" }
    const environment = await host.environment(request)
    const date = new Date(environment.at)
    if (!Number.isFinite(date.getTime())) return { status: "unavailable" as const, reason: "clock-unavailable" }
    if (surface === "planner") {
      const observed = await host.persistence.transaction("planner", async (snapshot) => {
        const principal = await host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
        if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:") || !principal.canWrite) return { commit: false, value: undefined }
        const roles = principal.roles.filter((row) => row.surface === "planner").map((row) => row.role)
        const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer") }
        if (!actor.canWrite) return { commit: false, value: undefined }
        return { commit: false, value: { selector: sfPlannerProjectionSelector(snapshot, actor), versions: rows(projectPlanner(snapshot, actor, environment).data.versions).flatMap((row) => typeof row.id === "string" && typeof row.name === "string" && row.name.trim() ? [{ id: row.id, label: row.name }] : []) } }
      }, { signal: request.signal })
      if (!observed || observed.versions.length > 100) return { status: "unavailable" as const, reason: "targets-unavailable" }
      const choices = await Promise.all(observed.versions.map(async (version) => {
        const scope = { principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, recordType: "planner-version", recordId: version.id, selector: observed.selector }
        const source = await input.runtime.persistence.readScopedSource("planner", scope, async (snapshot) => {
          const principal = await host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
          if (!principal || principal.id !== context.binding.principalRef || !principal.canWrite) return false
          const roles = principal.roles.filter((row) => row.surface === "planner").map((row) => row.role)
          return digestSfValue(sfPlannerProjectionSelector(snapshot, { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer") })) === digestSfValue(observed.selector)
        })
        return source ? { label: version.label, surface: "planner" as const, selectionRef: sfPlannerSourceSelector(version.id, source.incarnation, source.version), formats: ["xlsx", "xls"] } : undefined
      }))
      if (!await host.revalidate(context)) return { status: "denied" as const, reason: "target-access-unavailable" }
      return { status: "ok" as const, value: choices.filter((value): value is NonNullable<typeof value> => !!value) }
    }
    const year = date.getUTCFullYear(), month = date.getUTCMonth() + 1
    if (period && (!isSfPeriod(period) || period.start.slice(0, 7) !== period.end.slice(0, 7) || period.start.slice(8) !== "01" || Number(period.end.slice(8)) !== new Date(Date.UTC(Number(period.start.slice(0, 4)), Number(period.start.slice(5, 7)), 0)).getUTCDate())) return { status: "needs-input" as const, reason: "single-month-required" }
    const annual = { start: `${year}-01-01`, end: `${year}-12-31` }
    const monthly = { start: `${year}-${String(month).padStart(2, "0")}-01`, end: `${year}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}` }
    const issue = createDashboardSourceIssuer({ host, scopedSources: input.runtime.persistence })
    const candidates = [{ label: "Members", page: "Talent Review", fields: ["members"], period: annual, sheet: "All Members" }, { label: "Projects", page: "All Projects", fields: ["projects"], period: annual, sheet: "Projects Import" }, { label: "Operations", page: "IT Operations", fields: ["opsTickets"], period: period ?? monthly, sheet: "Ticket Register" }]
    const choices = await Promise.all(candidates.map(async (candidate) => {
      const source = await issue({ page: candidate.page, fields: candidate.fields, period: candidate.period }, context)
      return source.status === "ok" ? { label: candidate.label, surface: "dashboard" as const, selectionRef: source.value.selectionRef, sheet: candidate.sheet, period: candidate.period, formats: ["xlsx", "xls", "json"] } : undefined
    }))
    const admin = await host.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: await datasetActor(snapshot, request, context) }), { signal: request.signal })
    const dataset = admin ? await input.runtime.persistence.readScopedSource("dashboard", { principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, recordType: "dashboard-dataset", recordId: "all", selector: { kind: "dashboard-dataset-v1", actor: admin, roleMapDigest: digestSfValue(await host.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: roleMap(snapshot, "dashboard") }), { signal: request.signal })), fields: ["data"] } }, async (snapshot) => {
      const current = await datasetActor(snapshot, request, context)
      return !!current && digestSfValue(current) === digestSfValue(admin)
    }) : undefined
    if (!await host.revalidate(context)) return { status: "denied" as const, reason: "target-access-unavailable" }
    const pages = choices.filter((value): value is NonNullable<typeof value> => !!value).map((value) => ({ ...value, formats: ["xlsx", "xls"] }))
    return { status: "ok" as const, value: [...pages, ...(dataset ? [{ label: "Entire Dashboard backup (administrator)", surface: "dashboard" as const, selectionRef: `sf-dataset:${encodeURIComponent(dataset.incarnation)}:${dataset.version}`, formats: ["json"] }] : [])] }
  }
  const preview = async (payload: unknown, context: TrustedDomainContext): Promise<CapabilityResult> => {
    const operation = "sf_import_preview"
    const parsed = decodeSfOperationInput(operation, payload)
    if (!parsed.ok) return { status: "needs-input", reason: "invalid-input", receipt: { kind: "unbound", operation, code: "invalid-input", at: new Date().toISOString() } }
    const digest = digestSfValue(parsed.value)
    const admission = authority.authority.receiptFor(context, operation, digest)
    if (!admission) return { status: "denied", reason: "invalid-binding", receipt: { kind: "unbound", operation, code: "invalid-binding", at: new Date().toISOString() } }
    const result = await imports.preview(parsed.value, context)
    if (result.status !== "ok") return { status: result.status === "conflict" ? "failed" : result.status, reason: result.reason, receipt: admission }
    const output = decodeSfOperationOutput(operation, result.value)
    if (!output.ok || !await host.revalidate(context)) return { status: "unavailable", reason: "preview-unavailable", receipt: admission }
    const receipt = authority.authority.receiptFor(context, operation, digest, digestSfValue(output.value))
    return receipt ? { status: "ok", result: output.value, receipt } : { status: "unavailable", reason: "receipt-unavailable", receipt: admission }
  }
  const descriptors: readonly CapabilityDescriptor[] = [{ id: "sf_import_preview", pack: "documents_reports", mode: "simulate", inputSchema: sfOperationInputSchemas.sf_import_preview, outputSchema: sfOperationOutputSchemas.sf_import_preview, handler: preview, handlerExport: "previewImport", producerTask: "WP06.T02", grantProfiles: ["sf_maestro", "sf_finance"], requiredAuthority: ["documents:read"] }]
  return { imports, prepareTarget, discover, descriptors }
}
