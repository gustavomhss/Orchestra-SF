import { digestSfValue, sfEvidenceSourceMaps } from "../contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef, BusinessEvidenceResolution } from "../contracts/business-context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { createSfDashboardSourceAccess, createSfDashboardRecordSourceAccess, createSfCaseEventSourceAccess, createSfProcurementSourceAccess, createSfDocumentSourceAccess, createSfDashboardContinuityProof, createSfSourceContinuityProof } from "../decision-memory/source-access.ts"
import { createSfAtlasMemory } from "./atlas-memory.ts"
import { createSfAtlasScanner } from "./atlas-scanner.ts"
import { createSfEvidenceCapabilities } from "./capabilities.ts"
import type { DomainPortHost, DecisionCasePort, DashboardPort, PlannerPort, PlannerSourceHost, ProcurementPort } from "../contracts/ports.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { SfDomainValidation } from "../contracts/runtime.ts"
import type { ScannerBinarySpec } from "@orchestra/atlas-boundary/native-memory"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { DomainProjection } from "../contracts/context.ts"
import { mapSfEvidenceInOrder } from "./evidence-order.ts"
import { createSfAtlasRecallScope } from "./atlas-recall-scope.ts"
import type { SfCalculationCaseScope } from "./atlas-recall-scope.ts"
import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import { sfPlannerProjectionSelector } from "../integration/source-projections.ts"
import { sfPlannerSourceSelector } from "../integration/planner-sources.ts"

/** Bound repeated source reauthorization without caching an authorization across reads. */
function evidenceWithinBudget(refs: readonly BusinessEvidenceRef[]) {
  const limit = 512
  const cost = (ref: BusinessEvidenceRef, ancestors: ReadonlySet<string>): number => {
    if (ancestors.size >= 16 || ancestors.has(ref.refDigest)) return limit + 1
    const children = ref.kind === "case-event" ? ref.target.evidenceRefs : ref.kind === "calculation" ? ref.target.sourceRefs : []
    // Case readers authorize twice, then this host verifies ancestry once more.
    const multiplier = ref.kind === "case-event" ? 3 : 1
    let total = 1
    const next = new Set([...ancestors, ref.refDigest])
    for (const child of children) {
      total += multiplier * cost(child, next)
      if (total > limit) return limit + 1
    }
    return total
  }
  let total = 0
  for (const ref of refs) {
    total += cost(ref, new Set())
    if (total > limit) return false
  }
  return true
}

/** All source readers and memory operations are host-bound; references are selectors, not authority. */
function assembleSfBusinessContext(host: {
  revalidate: (call: TrustedDomainContext) => Promise<boolean>
  resolveSource: (ref: BusinessEvidenceRef, call: TrustedDomainContext, ancestors: ReadonlySet<string>) => Promise<BusinessEvidenceResolution>
  proveContinuity: (original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<boolean>
  recall: BusinessContextService["recall"]
  emitFromLedger: BusinessContextService["emitFromLedger"]
}): { service: BusinessContextService; resolveAncestry: (ref: BusinessEvidenceRef, call: TrustedDomainContext, ancestors: ReadonlySet<string>) => Promise<BusinessEvidenceResolution> } {
  async function resolveAncestry(ref: BusinessEvidenceRef, call: TrustedDomainContext, ancestors: ReadonlySet<string>): Promise<BusinessEvidenceResolution> {
    const unavailable = (): BusinessEvidenceResolution => ({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() })
    if (ancestors.has(ref.refDigest) || ancestors.size >= 16 || !evidenceWithinBudget([ref])) return unavailable()
    if (!(await host.revalidate(call))) return unavailable()
    if (ref.schema !== "sf-evidence-v1" || ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId) return { ...unavailable(), state: "invalid" }
    try {
      sfEvidenceSourceMaps([ref])
    } catch {
      return { ...unavailable(), state: "invalid" }
    }
    const result = await host.resolveSource(ref, call, ancestors)
    if (!(await host.revalidate(call)) || result.accessRevision !== call.binding.accessRevision || result.ref.refDigest !== ref.refDigest) return unavailable()
    try {
      sfEvidenceSourceMaps([result.ref, ...(result.currentRef ? [result.currentRef] : [])])
    } catch {
      return unavailable()
    }
    if (result.state === "fresh") {
      if (ref.kind === "case-event" || ref.kind === "calculation") {
        const children = ref.kind === "case-event" ? ref.target.evidenceRefs : ref.target.sourceRefs
        const next = new Set([...ancestors, ref.refDigest])
        const dependencies = await mapSfEvidenceInOrder(children, (dependency) => resolveAncestry(dependency, call, next))
        if (dependencies.some((dependency) => dependency.state !== "fresh" && dependency.state !== "historical") || !(await host.revalidate(call))) return unavailable()
      }
      return result
    }
    if (result.state === "historical") {
      const current = result.currentRef
      if (!result.authorizedProjection || !current || !result.differences || !sameHistoricalSource(ref, current) || current.installationId !== call.binding.installationId || current.projectId !== call.binding.projectId) return unavailable()
      if (!(await host.proveContinuity(ref, current, call)) || !(await host.revalidate(call))) return unavailable()
      return result
    }
    return { state: result.state, ref, accessRevision: result.accessRevision, checkedAt: result.checkedAt }
  }

  const resolve = (ref: BusinessEvidenceRef, call: TrustedDomainContext) => resolveAncestry(ref, call, new Set())
  const service: BusinessContextService = {
    resolve,
    context: async (request, call) => {
      const unavailable = (): BusinessEvidenceResolution[] => request.refs.map((ref) => ({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() }))
      if (!evidenceWithinBudget(request.refs)) return unavailable()
      const refs = structuredClone(request.refs)
      const requestDigest = digestSfValue(refs)
      const binding = digestSfValue([call.kind, call.binding])
      // Share identical reads only within this one authorization pass. No cross-call cache.
      const reads = new Map<string, Promise<BusinessEvidenceResolution>>()
      const values = await mapSfEvidenceInOrder(refs, (ref) => {
        const key = digestSfValue(ref)
        const existing = reads.get(key)
        if (existing) return existing
        const pending = resolve(ref, call)
        reads.set(key, pending)
        return pending
      })
      if (requestDigest !== digestSfValue(request.refs) || binding !== digestSfValue([call.kind, call.binding]) || !await host.revalidate(call)) return unavailable()
      return values.map((value) => structuredClone(value))
    },
    async recall(request, call) {
      if (!(await host.revalidate(call))) throw new Error("SF_MEMORY_AUTHORITY_UNAVAILABLE")
      const records = await host.recall(request, call)
      const allowed = await mapSfEvidenceInOrder(records, async (record) => {
        const caseRef = record.envelope.caseRef
        if (!caseRef || !request.caseRefs.some((ref) => ref.id === caseRef.id && ref.incarnation === caseRef.incarnation)) return false
        const refs = [...record.envelope.evidenceRefs, ...record.envelope.dependencies]
        if (!evidenceWithinBudget(refs)) return false
        try {
          const maps = sfEvidenceSourceMaps(refs)
          if (digestSfValue(maps.sourceVersions) !== digestSfValue(record.envelope.sourceVersions) || digestSfValue(maps.sourceIncarnations) !== digestSfValue(record.envelope.sourceIncarnations)) return false
        } catch {
          return false
        }
        const resolved = await service.context({ refs }, call)
        return refs.length > 0 && resolved.every((item) => item.state === "fresh" || (item.state === "historical" && item.differences !== undefined))
      })
      if (!(await host.revalidate(call))) throw new Error("SF_MEMORY_AUTHORITY_UNAVAILABLE")
      if (allowed.some((value) => !value)) throw new Error("SF_MEMORY_EVIDENCE_UNAVAILABLE")
      return records
    },
    async emitFromLedger(ref, call) {
      // The writer checks fresh sources for a new append and separately reauthorizes recovery of a durable receipt.
      if (ref.kind !== "case-event" || ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId || !(await host.revalidate(call))) {
        return { status: "unavailable", sourceEventId: ref.kind === "case-event" ? ref.target.eventId : "", scanner: { name: "", version: "", status: "unavailable" }, reason: "source unavailable" }
      }
      try { sfEvidenceSourceMaps([ref]) } catch { return { status: "unavailable", sourceEventId: ref.target.eventId, scanner: { name: "", version: "", status: "unavailable" }, reason: "invalid evidence" } }
      const receipt = await host.emitFromLedger(ref, call)
      if (!(await host.revalidate(call))) return { status: "unavailable", sourceEventId: ref.target.eventId, scanner: { name: "", version: "", status: "unavailable" }, reason: "authority unavailable" }
      return receipt
    },
  }
  return { service, resolveAncestry }
}

export function createSfBusinessContext(host: Parameters<typeof assembleSfBusinessContext>[0]): BusinessContextService {
  return assembleSfBusinessContext(host).service
}

/** Textual IDs cannot carry historical authorization across replacement incarnations. */
function sameHistoricalSource(original: BusinessEvidenceRef, current: BusinessEvidenceRef): boolean {
  if (original.kind === "record" && current.kind === "record") return original.target.surface === current.target.surface && original.target.recordType === current.target.recordType && original.target.recordId === current.target.recordId && (["dashboard", "planner", "procurement"].includes(original.target.surface) || original.target.incarnation === current.target.incarnation)
  if (original.kind === "document" && current.kind === "document") return original.target.documentId === current.target.documentId && original.target.incarnation === current.target.incarnation
  if (original.kind === "receipt" && current.kind === "receipt") return original.target.surface === current.target.surface && original.target.receiptId === current.target.receiptId && original.target.targetIncarnation === current.target.targetIncarnation
  if (original.kind === "case-event" && current.kind === "case-event") return original.target.caseId === current.target.caseId && original.target.caseIncarnation === current.target.caseIncarnation && original.target.eventId === current.target.eventId
  return false
}

/** Dispatches only to explicitly wired domain authorities; unsupported sources fail closed. */
export function createSfEvidenceRouter(input: {
  dashboard: ReturnType<typeof createSfDashboardSourceAccess>
  dashboardRecord?: ReturnType<typeof createSfDashboardRecordSourceAccess>
  caseEvent: ReturnType<typeof createSfCaseEventSourceAccess>
  procurement: ReturnType<typeof createSfProcurementSourceAccess>
  document?: ReturnType<typeof createSfDocumentSourceAccess>
  planner?: ReturnType<typeof createSfDashboardSourceAccess>
  calculation?: (ref: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<BusinessEvidenceResolution>
  dashboardProof: ReturnType<typeof createSfDashboardContinuityProof>
  caseEventProof: ReturnType<typeof createSfSourceContinuityProof>
  procurementProof: ReturnType<typeof createSfSourceContinuityProof>
  dashboardRecordProof?: ReturnType<typeof createSfSourceContinuityProof>
  documentProof?: ReturnType<typeof createSfSourceContinuityProof>
  plannerProof?: ReturnType<typeof createSfSourceContinuityProof>
  calculationProof?: ReturnType<typeof createSfSourceContinuityProof>
  receipt?: (ref: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<BusinessEvidenceResolution>
  receiptProof?: ReturnType<typeof createSfSourceContinuityProof>
}) {
  return {
    resolveSource(ref: BusinessEvidenceRef, call: TrustedDomainContext, ancestors: ReadonlySet<string> = new Set()): Promise<BusinessEvidenceResolution> {
      if (ref.kind === "record" && ref.target.surface === "dashboard" && ref.target.recordType === "dashboard-page") return input.dashboard(ref, call)
      if (ref.kind === "record" && ref.target.surface === "dashboard" && input.dashboardRecord) return input.dashboardRecord(ref, call)
      if (ref.kind === "case-event") return input.caseEvent(ref, call, ancestors)
      if (ref.kind === "record" && ref.target.surface === "procurement" && ["procurement-request", "procurement-supplier"].includes(ref.target.recordType)) return input.procurement(ref, call)
      if (ref.kind === "receipt" && ["dashboard", "procurement"].includes(ref.target.surface) && input.receipt) return input.receipt(ref, call)
      if (ref.kind === "document" && input.document) return input.document(ref, call)
      if (ref.kind === "record" && ref.target.surface === "planner" && ref.target.recordType === "planner-version" && input.planner) return input.planner(ref, call)
      if (ref.kind === "calculation" && input.calculation) return input.calculation(ref, call)
      return Promise.resolve({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() })
    },
    proveContinuity(original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext): Promise<boolean> {
      if (original.kind === "record" && original.target.surface === "dashboard" && original.target.recordType === "dashboard-page") return input.dashboardProof(original, current, call)
      if (original.kind === "record" && original.target.surface === "dashboard" && input.dashboardRecordProof) return input.dashboardRecordProof(original, current, call)
      if (original.kind === "case-event") return input.caseEventProof(original, current, call)
      if (original.kind === "record" && original.target.surface === "procurement" && ["procurement-request", "procurement-supplier"].includes(original.target.recordType)) return input.procurementProof(original, current, call)
      if (original.kind === "receipt" && ["dashboard", "procurement"].includes(original.target.surface) && input.receiptProof) return input.receiptProof(original, current, call)
      if (original.kind === "document" && input.documentProof) return input.documentProof(original, current, call)
      if (original.kind === "record" && original.target.surface === "planner" && original.target.recordType === "planner-version" && input.plannerProof) return input.plannerProof(original, current, call)
      if (original.kind === "calculation" && input.calculationProof) return input.calculationProof(original, current, call)
      return Promise.resolve(false)
    },
  }
}

/** Compose only domain-owned readers; a case selector is never itself an authorization grant. */
export function createSfAtlasBusiness(input: {
  host: DomainPortHost
  authority: SfDomainValidation
  state: SfProductStatePort
  cases: DecisionCasePort
  authorizeCase: (value: DecisionCase, call: TrustedDomainContext) => Promise<boolean>
  dashboard: DashboardPort
  dashboardIssue: Parameters<typeof createSfDashboardSourceAccess>[0]["issue"]
  dashboardRecords: Parameters<typeof createSfDashboardRecordSourceAccess>[0]["records"] & Partial<Pick<ReturnType<typeof import("../dashboard/sources.ts").createDashboardRecordEvidenceHost>, "issue">>
  dashboardEvidence?: {
    resolveEvidence: (ref: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<BusinessEvidenceResolution | undefined>
    proveContinuity: (original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<boolean>
  }
  procurement: ProcurementPort
  procurementResolve: Parameters<typeof createSfProcurementSourceAccess>[0]["resolve"]
  procurementEvidence?: Pick<ReturnType<typeof import("../procurement/decision-host.ts").createProcurementDecisionHost>, "resolveEvidence" | "proveContinuity">
  documentRead: Parameters<typeof createSfDocumentSourceAccess>[0]["read"]
  planner?: { sources: PlannerSourceHost; port: PlannerPort; project?: (ref: Extract<BusinessEvidenceRef, { kind: "record" }>, call: TrustedDomainContext) => Promise<import("../contracts/ports.ts").PortResult<DomainProjection>>;
    /** Host-owned reader with current source and projection checks; an arbitrary project callback does not qualify. */
    readEvidence?: (ref: Extract<BusinessEvidenceRef, { kind: "record" }>, call: TrustedDomainContext) => Promise<BusinessEvidenceResolution> }
  calculation?: (ref: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<BusinessEvidenceResolution>
  withCalculationCase?: SfCalculationCaseScope
  lockedSourceFences?: () => Record<"dashboard" | "planner" | "procurement", string> | undefined
  caseForEvidence: (digest: string, call: TrustedDomainContext) => Promise<readonly { id: string; incarnation: string }[] | { id: string; incarnation: string } | undefined>
  selections: Pick<Parameters<typeof createSfEvidenceCapabilities>[0], "contextSelections" | "recallSelections" | "featuresForCase" | "runtimeVersions">
  scanner?: { spec: ScannerBinarySpec; version: string }
  now: () => string
}) {
  const freshDashboard = createSfDashboardSourceAccess({ host: input.host, issue: input.dashboardIssue, dashboard: input.dashboard })
  const freshDashboardRecord = createSfDashboardRecordSourceAccess({ host: input.host, records: input.dashboardRecords })
  const withRecordHistory = (read: (ref: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<BusinessEvidenceResolution>) => async (ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> => {
    const selected = structuredClone(ref)
    const request = input.host.requestFor(call)
    const binding = digestSfValue([call.kind, call.binding])
    const found = await read(selected, call)
    let result = found
    if (found.state === "stale" || found.state === "unavailable") {
      const historical = await recordHistory.resolve(selected, call)
      result = historical.state === "fresh" || historical.state === "historical" ? historical :
        selected.kind === "record" && selected.target.surface === "dashboard" ? await input.dashboardEvidence?.resolveEvidence(selected, call) ?? historical : historical
    }
    // C12 also owns originals captured atomically with prepared commands. Keep
    // Atlas captures first so its stored projection bytes remain authoritative.
    return request && !request.signal.aborted && await input.host.revalidate(call) && input.host.requestFor(call) === request &&
      binding === digestSfValue([call.kind, call.binding]) && digestSfValue(ref) === digestSfValue(selected) ? result :
        { state: "unavailable", ref: selected, accessRevision: call.binding.accessRevision, checkedAt: input.now() }
  }
  const dashboard = withRecordHistory(freshDashboard)
  const dashboardRecord = withRecordHistory(freshDashboardRecord)
  let resolveAncestry: ReturnType<typeof assembleSfBusinessContext>["resolveAncestry"] | undefined
  const caseEvent = createSfCaseEventSourceAccess({ host: input.host, state: input.state, authorizeCase: input.authorizeCase, authorizeEvidence: async (refs, call, ancestors) => {
    if (!resolveAncestry) return false
    const results = await mapSfEvidenceInOrder(refs, (ref) => resolveAncestry!(ref, call, ancestors))
    return results.length === refs.length && results.every((result, index) => (result.state === "fresh" || result.state === "historical") && digestSfValue(result.ref) === digestSfValue(refs[index])) && await input.host.revalidate(call)
  } })
  const currentProcurement = createSfProcurementSourceAccess({ host: input.host, resolve: input.procurementResolve, procurement: input.procurement })
  const procurement = async (ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> =>
    await input.procurementEvidence?.resolveEvidence(ref, call) ?? currentProcurement(ref, call)
  const receipt = async (ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> =>
    (ref.kind === "receipt" && ref.target.surface === "dashboard" ? await input.dashboardEvidence?.resolveEvidence(ref, call) : await input.procurementEvidence?.resolveEvidence(ref, call)) ??
      { state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: input.now() }
  const document = createSfDocumentSourceAccess({ host: input.host, read: input.documentRead })
  const freshPlanner = async (ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> => {
    const unavailable = (): BusinessEvidenceResolution => ({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: input.now() })
    if (!input.planner || ref.kind !== "record" || ref.target.surface !== "planner" || ref.target.recordType !== "planner-version" || !ref.target.period || !await input.host.revalidate(call)) return unavailable()
    if (input.planner.readEvidence) {
      const result = await input.planner.readEvidence(ref, call)
      const projection = result.authorizedProjection
      if (result.state !== "fresh" || !result.currentRef || digestSfValue(result.ref) !== digestSfValue(ref) || digestSfValue(result.currentRef) !== digestSfValue(ref) ||
        result.accessRevision !== call.binding.accessRevision || !projection || !("values" in projection) || !plannerProjectionMatches(projection, ref, call) || !await input.host.revalidate(call)) return unavailable()
      return result
    }
    const first = await input.planner.sources.resolveForecastSource(ref.refId, call)
    if (first.status !== "ok" || digestSfValue(first.value.evidence) !== digestSfValue(ref)) return unavailable()
    const direct = input.planner.project ? await input.planner.project(ref, call) : undefined
    const compared = direct ? undefined : await input.planner.port.compareForecast({ baseRef: ref.refId, candidateRef: ref.refId, period: ref.target.period, currency: "USD" }, call)
    const projection = direct?.status === "ok" ? direct.value : compared?.status === "ok" ? compared.value.baseline : undefined
    if (!projection || !plannerProjectionMatches(projection, ref, call) || !await input.host.revalidate(call)) return unavailable()
    const again = await input.planner.sources.resolveForecastSource(ref.refId, call)
    if (again.status !== "ok" || digestSfValue(again.value.evidence) !== digestSfValue(ref) || !await input.host.revalidate(call)) return unavailable()
    return { state: "fresh", ref, currentRef: again.value.evidence, authorizedProjection: projection, accessRevision: call.binding.accessRevision, checkedAt: input.now() }
  }
  const readOriginalCapture = async (digest: string, call: TrustedDomainContext) => {
    const selected = await input.caseForEvidence(digest, call)
    const refs = !selected ? [] : Array.isArray(selected) ? selected : [selected]
    if (!refs.length || refs.length > 500) return undefined
    const found = await mapSfEvidenceInOrder(refs, (ref) => memory.readOriginalCapture(ref, digest, call))
    const originals = found.filter((capture): capture is NonNullable<typeof capture> => !!capture)
    return originals.length && originals.every((ref) => digestSfValue(ref) === digestSfValue(originals[0])) && await input.host.revalidate(call) ? originals[0] : undefined
  }
  const readOriginal = async (digest: string, call: TrustedDomainContext) => (await readOriginalCapture(digest, call))?.ref
  const recordHistory = createSfRecordHistory({ host: input.host, readOriginalCapture, now: input.now,
    current: async (original, page, call) => {
      const unavailable = (): BusinessEvidenceResolution => ({ state: "unavailable", ref: original, accessRevision: call.binding.accessRevision, checkedAt: input.now() })
      const period = original.target.period
      if (!period) return unavailable()
      if (original.target.surface === "dashboard") {
        if (original.target.recordType === "dashboard-page") {
          const issued = await input.dashboardIssue({ page: original.target.recordId, fields: original.target.fields, period }, call)
          return issued.status === "ok" ? freshDashboard(issued.value.evidence, call) : unavailable()
        }
        if (!page || !input.dashboardRecords.issue) return unavailable()
        const issued = await input.dashboardRecords.issue({ page, recordType: original.target.recordType, recordId: original.target.recordId, fields: original.target.fields, period }, call)
        return issued.status === "ok" ? freshDashboardRecord(issued.value, call) : unavailable()
      }
      if (!input.planner || original.target.surface !== "planner" || original.target.recordType !== "planner-version") return unavailable()
      // The producer reopens or creates the current authorized scope even when the
      // old selector returns stale. Only its freshly resolved reference is used.
      await input.planner.sources.resolveForecastSource(original.refId, call)
      const request = input.host.requestFor(call)
      if (!request || request.signal.aborted || !await input.host.revalidate(call)) return unavailable()
      const selected = await input.host.persistence.transaction<string | undefined>("planner", async (snapshot) => {
        const principal = await input.host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
        if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
        const roles = principal.roles.filter((entry) => entry.surface === "planner").map((entry) => entry.role)
        const selector = sfPlannerProjectionSelector(snapshot, { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer") })
        const scopes = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.alive && entry.scope.recordType === "planner-version" &&
          entry.scope.recordId === original.target.recordId && entry.scope.principalRef === principal.id && entry.scope.accessRevision === call.binding.accessRevision &&
          entry.scope.policyVersion === call.binding.policyVersion && digestSfValue(entry.scope.selector) === digestSfValue(selector))
        const scope = scopes.length === 1 ? scopes[0] : undefined
        return { commit: false, value: scope ? sfPlannerSourceSelector(original.target.recordId, scope.incarnation, scope.version) : undefined }
      }, { signal: request.signal }).catch(() => undefined)
      if (!selected || !await input.host.revalidate(call)) return unavailable()
      const current = await input.planner.sources.resolveForecastSource(selected, call)
      return current.status === "ok" ? freshPlanner(current.value.evidence, call) : unavailable()
    },
  })
  const planner = withRecordHistory(freshPlanner)
  const recallScope = input.calculation && input.planner && input.withCalculationCase && input.lockedSourceFences
    ? createSfAtlasRecallScope({ host: input.host, state: input.state, sources: input.planner.sources, readPlanner: planner,
      calculation: input.calculation, withCalculationCase: input.withCalculationCase, lockedSourceFences: input.lockedSourceFences, now: input.now }) : undefined
  const calculation = recallScope?.resolve ?? input.calculation
  const router = createSfEvidenceRouter({
    dashboard, dashboardRecord, caseEvent, procurement, document, planner, calculation,
    dashboardProof: recordHistory.proveContinuity,
    dashboardRecordProof: async (original, current, call) => await recordHistory.proveContinuity(original, current, call) ||
      await input.dashboardEvidence?.proveContinuity(original, current, call) === true,
    caseEventProof: createSfSourceContinuityProof({ host: input.host, readOriginal, readCurrent: caseEvent }),
    procurementProof: async (original, current, call) => {
      if (digestSfValue(original) !== digestSfValue(current) && input.procurementEvidence)
        return await input.procurementEvidence.proveContinuity(original, current, call) === true
      return createSfSourceContinuityProof({ host: input.host, readOriginal, readCurrent: procurement })(original, current, call)
    },
    receipt, receiptProof: async (original, current, call) => {
      if (digestSfValue(original) !== digestSfValue(current) || !await input.host.revalidate(call)) return false
      const proof = await receipt(original, call)
      return proof.state === "fresh" && !!proof.currentRef && !!proof.authorizedProjection && digestSfValue(proof.ref) === digestSfValue(original) && digestSfValue(proof.currentRef) === digestSfValue(current) && await input.host.revalidate(call)
    },
    documentProof: createSfSourceContinuityProof({ host: input.host, readOriginal, readCurrent: document }),
    plannerProof: recordHistory.proveContinuity,
    calculationProof: calculation ? createSfSourceContinuityProof({ host: input.host, readOriginal, readCurrent: calculation }) : undefined,
  })
  const assembled = assembleSfBusinessContext({
    revalidate: input.host.revalidate, ...router,
    recall: async (request, call) => {
      const records = await mapSfEvidenceInOrder(request.caseRefs, (ref) => memory.recall(ref, call))
      if (records.some((result) => result.status !== "ok")) throw new Error("SF_MEMORY_READ_UNAVAILABLE")
      return records.flatMap((result) => result.status === "ok" ? result.records : [])
    },
    emitFromLedger: (ref, call) => memory.emitFromLedger(ref, call),
  })
  const context = assembled.service
  resolveAncestry = assembled.resolveAncestry
  const canonicalMemory = createSfAtlasMemory({ state: input.state, cases: input.cases, authorizeCase: input.authorizeCase, host: input.host, evidence: context, proveContinuity: router.proveContinuity, scanner: createSfAtlasScanner({ scanners: input.scanner ? [input.scanner.spec] : [] }), scannerVersion: input.scanner?.version ?? "", now: input.now })
  const memory = { ...canonicalMemory, recall: (ref: { id: string; incarnation: string }, call: TrustedDomainContext) =>
    recallScope ? recallScope.recall(ref, call, () => canonicalMemory.recall(ref, call)) : canonicalMemory.recall(ref, call) }
  const capabilities = createSfEvidenceCapabilities({ ...input.selections, context, memory, proveContinuity: router.proveContinuity, revalidate: input.host.revalidate, createReceipt: input.authority.receiptFor })
  return { context, memory, capabilities, proveContinuity: router.proveContinuity }
}

function plannerProjectionMatches(projection: DomainProjection, ref: Extract<BusinessEvidenceRef, { kind: "record" }>, call: TrustedDomainContext) {
  return projection.context.installationId === call.binding.installationId && projection.context.projectId === call.binding.projectId &&
    projection.context.principalRef === call.binding.principalRef && projection.context.accessRevision === call.binding.accessRevision &&
    projection.context.policyVersion === call.binding.policyVersion && projection.context.surface === "planner" &&
    digestSfValue(projection.context.period) === digestSfValue(ref.target.period) && projection.values.every((value) =>
      value.sourceRefs.length === 1 && digestSfValue(value.sourceRefs[0]) === digestSfValue(ref))
}

type RecordRef = Extract<BusinessEvidenceRef, { kind: "record" }>
type ProtectedEvidenceCapture = { ref: BusinessEvidenceRef; projection: NonNullable<BusinessEvidenceResolution["authorizedProjection"]> }

/** A historical body is a protected producer capture. Its current read grant and physical
 * source continuity are separate observations, never a relabelled original version. */
export function createSfRecordHistory(input: {
  host: DomainPortHost
  readOriginalCapture: (digest: string, call: TrustedDomainContext) => Promise<ProtectedEvidenceCapture | undefined>
  current: (original: RecordRef, page: string | undefined, call: TrustedDomainContext) => Promise<BusinessEvidenceResolution>
  now: () => string
}) {
  const host = input.host
  const same = (left: unknown, right: unknown) => digestSfValue(left) === digestSfValue(right)
  const scopeIdentity = async (original: RecordRef, current: RecordRef | undefined, call: TrustedDomainContext) => {
    const request = host.requestFor(call)
    if (!request || request.signal.aborted || !await host.revalidate(call)) return undefined
    return host.persistence.transaction<{ physical: string; page: string | undefined } | undefined>(original.target.surface, async (snapshot) => {
      const principal = await host.authenticate(request, { surface: original.target.surface, roleMap: roleMap(snapshot, original.target.surface) })
      if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:") || request.signal.aborted) return { commit: false, value: undefined }
      const scopes = Object.values(snapshot.sfSources?.scopes ?? {})
      const oldMatches = scopes.filter((entry) => entry.incarnation === original.target.incarnation && entry.scope.recordType === original.target.recordType && entry.scope.recordId === original.target.recordId)
      const old = oldMatches.length === 1 ? oldMatches[0] : undefined
      const physical = snapshot.sfSources?.records[JSON.stringify([original.target.recordType, original.target.recordId])]
      if (!old || !physical?.alive || old.sourceIncarnation !== physical.incarnation || old.version < original.target.version) return { commit: false, value: undefined }
      const selector = object(old.scope.selector)
      const page = typeof selector.page === "string" ? selector.page : undefined
      if (original.target.surface === "dashboard" && (!page || !same(selector.fields, [...original.target.fields].sort()) || !same(selector.period, original.target.period))) return { commit: false, value: undefined }
      // Scope versions advance on material edits. The original payload itself is
      // authenticated by its protected producer, while this record proves physical lineage.
      if (old.version === original.target.version && original.target.surface === "dashboard" && old.inputDigest !== original.target.projectionDigest) return { commit: false, value: undefined }
      if (!current) return { commit: false, value: { physical: physical.incarnation, page } }
      const activeMatches = scopes.filter((entry) => entry.alive && entry.incarnation === current.target.incarnation && entry.scope.recordType === current.target.recordType && entry.scope.recordId === current.target.recordId &&
        entry.scope.principalRef === principal.id && entry.scope.accessRevision === call.binding.accessRevision && entry.scope.policyVersion === call.binding.policyVersion)
      const active = activeMatches.length === 1 ? activeMatches[0] : undefined
      if (!active || active.sourceIncarnation !== physical.incarnation || active.version !== current.target.version) return { commit: false, value: undefined }
      const activeSelector = object(active.scope.selector)
      if (current.target.surface === "dashboard" && (activeSelector.page !== page || !same(activeSelector.fields, [...current.target.fields].sort()) || !same(activeSelector.period, current.target.period) || active.inputDigest !== current.target.projectionDigest)) return { commit: false, value: undefined }
      return { commit: false, value: { physical: physical.incarnation, page } }
    }, { signal: request.signal }).catch(() => undefined)
  }
  const resolve = async (incoming: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> => {
    const original = structuredClone(incoming)
    const unavailable = (): BusinessEvidenceResolution => ({ state: "unavailable", ref: original, accessRevision: call.binding.accessRevision, checkedAt: input.now() })
    try {
      if (original.kind !== "record" || !["dashboard", "planner"].includes(original.target.surface) || original.target.surface === "planner" && original.target.recordType !== "planner-version" || !original.target.period ||
        original.installationId !== call.binding.installationId || original.projectId !== call.binding.projectId) return unavailable()
      sfEvidenceSourceMaps([original])
      const request = host.requestFor(call)
      const binding = digestSfValue([call.kind, call.binding])
      if (!request || request.signal.aborted || !await host.revalidate(call)) return unavailable()
      const capture = await input.readOriginalCapture(original.refDigest, call)
      if (!capture || !same(capture.ref, original) || !("values" in capture.projection) || capture.projection.context.installationId !== original.installationId || capture.projection.context.projectId !== original.projectId) return unavailable()
      const captured = structuredClone(capture)
      const lineage = await scopeIdentity(original, undefined, call)
      if (!lineage) return unavailable()
      const observe = async () => {
        const current = structuredClone(await input.current(structuredClone(original), lineage.page, call))
        const ref = current.currentRef
        const projection = current.authorizedProjection
        if (current.state !== "fresh" || !ref || ref.kind !== "record" || !same(current.ref, ref) || current.accessRevision !== call.binding.accessRevision ||
          !projection || !("values" in projection) || ref.installationId !== original.installationId || ref.projectId !== original.projectId ||
          ref.target.surface !== original.target.surface || ref.target.recordType !== original.target.recordType || ref.target.recordId !== original.target.recordId ||
          !same([...ref.target.fields].sort(), [...original.target.fields].sort()) || !same(ref.target.period, original.target.period) ||
          projection.context.installationId !== call.binding.installationId || projection.context.projectId !== call.binding.projectId || projection.context.principalRef !== call.binding.principalRef ||
          projection.context.accessRevision !== call.binding.accessRevision || projection.context.policyVersion !== call.binding.policyVersion || projection.context.surface !== ref.target.surface ||
          !same(projection.context.period, original.target.period)) return undefined
        sfEvidenceSourceMaps([ref])
        const physical = await scopeIdentity(original, ref, call)
        return physical && same(physical, lineage) && await host.revalidate(call) ? { ref, projection, physical } : undefined
      }
      const first = await observe()
      if (!first) return unavailable()
      const recaptured = await input.readOriginalCapture(original.refDigest, call)
      if (!recaptured || !same(recaptured, captured)) return unavailable()
      const second = await observe()
      if (!second) return unavailable()
      const finalCapture = await input.readOriginalCapture(original.refDigest, call)
      const finalLineage = await scopeIdentity(original, second.ref, call)
      if (!finalCapture || !same(finalCapture, captured) || !same(first.ref, second.ref) || !same(currentProjectionIdentity(first.projection), currentProjectionIdentity(second.projection)) ||
        !same(first.physical, second.physical) || !finalLineage || !same(finalLineage, second.physical) || !await host.revalidate(call) || host.requestFor(call) !== request || request.signal.aborted ||
        binding !== digestSfValue([call.kind, call.binding]) || !same(incoming, original)) return unavailable()
      if (same(original, second.ref)) return { state: "fresh", ref: original, currentRef: second.ref, authorizedProjection: second.projection, accessRevision: call.binding.accessRevision, checkedAt: input.now() }
      // The original context/version remains untouched. Only the resolution's
      // accessRevision and currentRef express today's independently proven grant.
      return { state: "historical", ref: original, currentRef: second.ref, authorizedProjection: captured.projection,
        differences: recordDifferences(original, second.ref, captured.projection as DomainProjection, second.projection), accessRevision: call.binding.accessRevision, checkedAt: input.now() }
    } catch { return unavailable() }
  }
  const proveContinuity = async (original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext) => {
    const selected = structuredClone(original)
    const expected = structuredClone(current)
    const first = await resolve(selected, call)
    if ((first.state !== "fresh" && first.state !== "historical") || !first.currentRef || !same(first.currentRef, expected)) return false
    const second = await resolve(selected, call)
    return same(original, selected) && same(current, expected) && second.state === first.state && !!second.currentRef && same(second.currentRef, expected) &&
      same(second.differences, first.differences) && !!second.authorizedProjection && !!first.authorizedProjection &&
      same(first.state === "fresh" && "values" in first.authorizedProjection ? currentProjectionIdentity(first.authorizedProjection) : first.authorizedProjection,
        second.state === "fresh" && "values" in second.authorizedProjection ? currentProjectionIdentity(second.authorizedProjection) : second.authorizedProjection)
  }
  return { resolve, proveContinuity }
}

function currentProjectionIdentity(projection: DomainProjection) {
  const source = (ref: DomainProjection["context"]["sourceRefs"][number]) => ({ ...ref, observedAt: "" })
  return { ...projection, context: { ...projection.context, sourceRefs: projection.context.sourceRefs.map(source) },
    components: projection.components.map((component) => ({ ...component, sourceRefs: component.sourceRefs.map(source) })) }
}

function recordDifferences(original: RecordRef, current: RecordRef, before: DomainProjection, after: DomainProjection): NonNullable<BusinessEvidenceResolution["differences"]> {
  const differences: { field: string; before: string | number | boolean | null; after: string | number | boolean | null }[] = []
  for (const field of ["incarnation", "version", "projectionDigest"] as const) {
    if (original.target[field] !== current.target[field]) differences.push({ field: `source.${field}`, before: original.target[field], after: current.target[field] })
  }
  const oldValues = new Map(before.values.map((value) => [value.id, value.value]))
  const currentValues = new Map(after.values.map((value) => [value.id, value.value]))
  const scalar = (value: unknown): value is string | number | boolean | null => value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)
  for (const field of [...new Set([...oldValues.keys(), ...currentValues.keys()])].sort()) {
    const old = oldValues.get(field) ?? null
    const value = currentValues.get(field) ?? null
    if (scalar(old) && scalar(value) && digestSfValue(old) !== digestSfValue(value)) differences.push({ field, before: old, after: value })
  }
  return differences
}
