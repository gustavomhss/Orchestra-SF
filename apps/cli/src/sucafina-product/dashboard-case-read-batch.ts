import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Actor, Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { DashboardPort, DecisionCasePort, DomainPortHost, PlannerSourceHost } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfProductStatePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { isSfPeriod } from "../../../../modules/sucafina/Sucafinav1/product/contracts/validation.ts"
import type { DashboardSourceHost } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/port.ts"
import { dashboardSourceSelector } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/sources.ts"
import type { createDashboardRecordEvidenceHost } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/sources.ts"
import { projectSfSourceScope } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import { sfScopedSourceIdentity, sfSourceIdentity } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import type { SfScopedSourcePort } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { createSfCaseReadBatch } from "./case-read-batch.ts"
import { sfPlannerRecordMaterialized } from "./planner-case-read-batch.ts"

type RecordRef = Extract<BusinessEvidenceRef, { kind: "record" }>

/** Dashboard admission proves a complete existing C02 scope before entering the
 * canonical reader. It shares only the physical root, never a source proof. */
export function createSfDashboardCaseReadBatch(input: {
  host: DomainPortHost
  state: SfProductStatePort
  read: DecisionCasePort["read"]
  sources: Pick<PlannerSourceHost, "resolveForecastSource">
  readerIdentity: () => BusinessContextService | undefined
  lockedSourceFences: () => Record<"dashboard" | "planner" | "procurement", string> | undefined
  dashboard: {
    port: DashboardPort
    sources: DashboardSourceHost
    records: Pick<ReturnType<typeof createDashboardRecordEvidenceHost>, "resolve" | "read" | "issue">
    scopedSources: SfScopedSourcePort
    readerIdentity: () => readonly unknown[]
  }
}): DecisionCasePort["read"] {
  return createSfCaseReadBatch(input, { kind: "dashboard",
    identity: () => [input.sources, input.sources.resolveForecastSource,
      input.dashboard, input.dashboard.port, input.dashboard.port.read,
      input.dashboard.sources, input.dashboard.sources.resolveDashboardSource, input.dashboard.sources.resolveDashboardMetric,
      input.dashboard.records, input.dashboard.records.resolve, input.dashboard.records.read, input.dashboard.records.issue,
      input.dashboard.scopedSources, input.dashboard.scopedSources.resolveScopedSource, input.dashboard.scopedSources.readScopedSource,
      input.dashboard.scopedSources.readScopedSourcePrepared, input.dashboard.scopedSources.checkScopedSource,
      input.dashboard.readerIdentity, ...input.dashboard.readerIdentity()],
    forCall: (call) => {
      const request = input.host.requestFor(call)
      if (!request || request.signal.aborted) return undefined
      const current = () => input.host.requestFor(call) === request && !request.signal.aborted
      return { current, dependencies: dashboardDependencies, witness: async (refs, snapshots, plannerPrincipal) => {
        const environment = await input.host.environment(request)
        if (!current() || !Number.isFinite(Date.parse(environment.at))) return { kind: "changed" }
        const principal = structuredClone(await input.host.authenticate(request, {
          surface: "dashboard", roleMap: roleMap(snapshots.dashboard, "dashboard") }))
        if (!current() || !principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:"))
          return { kind: "changed" }
        if (!refs.every((ref) => ref.target.surface === "planner"
          ? sfPlannerRecordMaterialized(ref, call, snapshots.planner, plannerPrincipal)
          : dashboardRecordMaterialized(ref, call, snapshots.dashboard, principal, environment.at)))
          return { kind: "unsupported" }
        const again = await input.host.environment(request)
        if (!current() || !Number.isFinite(Date.parse(again.at))) return { kind: "changed" }
        const actor = await input.host.authenticate(request, {
          surface: "dashboard", roleMap: roleMap(snapshots.dashboard, "dashboard") })
        // The source projector uses this actual host clock and normalizes its
        // date internally. Seconds advancing within the same day are not drift.
        const day = new Date(environment.at).toISOString().slice(0, 10)
        if (!current() || new Date(again.at).toISOString().slice(0, 10) !== day ||
          digestSfValue(actor) !== digestSfValue(principal) || !await input.host.revalidate(call) || !current())
          return { kind: "changed" }
        return { kind: "current", value: { principal, day } }
      } }
    },
  })
}

/** Reconstruct the current actor scope using the real projector. Exact equality
 * with the stored entry proves readScopedSource will not create or renew it. */
function dashboardRecordMaterialized(ref: RecordRef, call: TrustedDomainContext, snapshot: Snapshot,
  principal: NonNullable<Awaited<ReturnType<DomainPortHost["authenticate"]>>>, at: string) {
  if (ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId ||
    ref.target.surface !== "dashboard" || !isSfPeriod(ref.target.period) || !ref.target.fields.length ||
    new Set(ref.target.fields).size !== ref.target.fields.length) return false
  const entries = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) =>
    entry.alive && entry.incarnation === ref.target.incarnation)
  const entry = entries.length === 1 ? entries[0] : undefined
  if (!entry) return false
  const selected = object(entry.scope.selector)
  if (typeof selected.page !== "string" || !selected.page) return false
  const access = object(object(snapshot.data.access)[principal.id])
  const roles = principal.roles.filter((role) => role.surface === "dashboard").map((role) => role.role)
  const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
    assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [],
    domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
  const scope = { principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision,
    policyVersion: call.binding.policyVersion, recordType: ref.target.recordType, recordId: ref.target.recordId,
    selector: { page: selected.page, fields: [...ref.target.fields].sort(), period: structuredClone(ref.target.period),
      actor, roleMapDigest: digestSfValue(roleMap(snapshot, "dashboard")) } }
  if (digestSfValue(scope) !== digestSfValue(entry.scope)) return false
  const source = sfSourceIdentity(snapshot, scope.recordType, scope.recordId), identity = sfScopedSourceIdentity(snapshot, scope)
  const observed = structuredClone(snapshot)
  const projection = projectSfSourceScope("dashboard", observed, scope, at)
  if (!source || !identity || !projection || typeof projection !== "object" || Array.isArray(projection) ||
    identity.incarnation !== entry.incarnation || identity.version !== entry.version ||
    identity.inputDigest !== digestSfValue(projection) || digestSfValue(observed) !== digestSfValue(snapshot)) return false
  if (scope.recordType !== "dashboard-page" && (digestSfValue(Object.keys(projection).sort()) !== digestSfValue(scope.selector.fields) ||
    Object.values(projection).some((value) => value !== null && value !== undefined && typeof value !== "string" &&
      typeof value !== "boolean" && !(typeof value === "number" && Number.isFinite(value))))) return false
  const expected: RecordRef = { schema: "sf-evidence-v1", kind: "record",
    refId: dashboardSourceSelector(identity.incarnation, identity.version),
    installationId: call.binding.installationId, projectId: call.binding.projectId, refDigest: "", evidenceLevel: "observed",
    target: { surface: "dashboard", recordType: scope.recordType, recordId: scope.recordId,
      incarnation: identity.incarnation, version: identity.version, fields: scope.selector.fields,
      period: scope.selector.period, projectionDigest: identity.inputDigest } }
  expected.refDigest = digestSfEvidenceRef(expected)
  return digestSfValue(expected) === digestSfValue(ref) &&
    digestSfValue(entry) === digestSfValue({ scope, sourceIncarnation: source.incarnation, incarnation: entry.incarnation,
      alive: true, inputDigest: identity.inputDigest, version: entry.version })
}

/** Only ordinary current Planner/Dashboard record closures qualify. In
 * particular, signals can issue additional C02 records and remain canonical. */
function dashboardDependencies(value: DecisionCase): readonly RecordRef[] | undefined {
  if (value.preparedChanges.length || value.receipts.length ||
    [...value.alternatives, ...value.choices].some((item) => item.scenario.operations.some((operation) =>
      operation.replacementRef !== undefined || operation.targetRef.startsWith("sf-procurement:") ||
      !["replace", "exclude", "include", "defer"].includes(operation.kind)))) return undefined
  const refs = new Map<string, RecordRef>(), seen = new Set<object>()
  const visit = (item: unknown): boolean => {
    if (!item || typeof item !== "object") return true
    if (seen.has(item)) return true
    seen.add(item)
    if (Array.isArray(item)) return item.every(visit)
    if ("schema" in item && item.schema === "sf-evidence-v1") {
      const ref = item as BusinessEvidenceRef
      if (ref.kind !== "record" || !ref.target.period || ref.refDigest !== digestSfEvidenceRef(ref)) return false
      const planner = ref.target.surface === "planner" && ref.target.recordType === "planner-version"
      const dashboard = ref.target.surface === "dashboard" && ref.refId.startsWith("sf-source:") &&
        ref.target.recordType !== "dashboard-dataset" && ref.target.recordId !== "__singleton__" &&
        (ref.target.recordType !== "dashboard-page" || !ref.target.fields.includes("signals"))
      if (!planner && !dashboard) return false
      refs.set(digestSfValue(ref), ref)
    }
    return Object.values(item).every(visit)
  }
  if (!visit(value)) return undefined
  const selected = [...refs.values()], bases = new Set(selected.filter((ref) => ref.target.surface === "planner").map((ref) => ref.refId))
  if (!bases.size || !selected.some((ref) => ref.target.surface === "dashboard")) return undefined
  return [...value.alternatives, ...value.choices].every((item) => bases.has(item.scenario.baseRef)) ? selected : undefined
}
