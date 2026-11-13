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

type ProcurementEvidence = {
  resolve: (ref: BusinessEvidenceRef, context: TrustedDomainContext) => Promise<BusinessEvidenceResolution | undefined>
  proveContinuity: (original: BusinessEvidenceRef, current: BusinessEvidenceRef, context: TrustedDomainContext) => Promise<boolean | undefined>
}

/** All source readers and memory operations are host-bound; references are selectors, not authority. */
export function createSfBusinessContext(host: {
  revalidate: (call: TrustedDomainContext) => Promise<boolean>
  resolveSource: (ref: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<BusinessEvidenceResolution>
  proveContinuity: (original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<boolean>
  recall: BusinessContextService["recall"]
  emitFromLedger: BusinessContextService["emitFromLedger"]
}): BusinessContextService {
  const activeEvents = new WeakMap<TrustedDomainContext, Set<string>>()
  async function resolve(ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> {
    if (ref.kind !== "case-event") return resolveSource(ref, call)
    const active = activeEvents.get(call) ?? new Set<string>()
    if (active.has(ref.refDigest)) return { state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() }
    activeEvents.set(call, active)
    active.add(ref.refDigest)
    try {
      return await resolveSource(ref, call)
    } finally {
      active.delete(ref.refDigest)
      if (!active.size) activeEvents.delete(call)
    }
  }
  async function resolveSource(ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> {
    const unavailable = (): BusinessEvidenceResolution => ({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() })
    if (!(await host.revalidate(call))) return unavailable()
    if (ref.schema !== "sf-evidence-v1" || ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId) return { ...unavailable(), state: "invalid" }
    try {
      sfEvidenceSourceMaps([ref])
    } catch {
      return { ...unavailable(), state: "invalid" }
    }
    const result = await host.resolveSource(ref, call)
    if (!(await host.revalidate(call)) || result.accessRevision !== call.binding.accessRevision || result.ref.refDigest !== ref.refDigest) return unavailable()
    try {
      sfEvidenceSourceMaps([result.ref, ...(result.currentRef ? [result.currentRef] : [])])
    } catch {
      return unavailable()
    }
    if (result.state === "fresh") {
      if (ref.kind === "case-event") {
        const dependencies = await Promise.all(ref.target.evidenceRefs.map((dependency) => resolve(dependency, call)))
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

  return {
    resolve,
    context: async (request, call) => Promise.all(request.refs.map((ref) => resolve(ref, call))),
    async recall(request, call) {
      if (!(await host.revalidate(call))) throw new Error("SF_MEMORY_AUTHORITY_UNAVAILABLE")
      const records = await host.recall(request, call)
      const allowed = await Promise.all(records.map(async (record) => {
        const caseRef = record.envelope.caseRef
        if (!caseRef || !request.caseRefs.some((ref) => ref.id === caseRef.id && ref.incarnation === caseRef.incarnation)) return false
        const refs = [...record.envelope.evidenceRefs, ...record.envelope.dependencies]
        try {
          const maps = sfEvidenceSourceMaps(refs)
          if (digestSfValue(maps.sourceVersions) !== digestSfValue(record.envelope.sourceVersions) || digestSfValue(maps.sourceIncarnations) !== digestSfValue(record.envelope.sourceIncarnations)) return false
        } catch {
          return false
        }
        const resolved = await Promise.all(refs.map((ref) => resolve(ref, call)))
        return refs.length > 0 && resolved.every((item) => item.state === "fresh" || (item.state === "historical" && item.differences !== undefined))
      }))
      if (!(await host.revalidate(call))) throw new Error("SF_MEMORY_AUTHORITY_UNAVAILABLE")
      if (allowed.some((value) => !value)) throw new Error("SF_MEMORY_EVIDENCE_UNAVAILABLE")
      return records
    },
    async emitFromLedger(ref, call) {
      const source = await resolve(ref, call)
      if (ref.kind !== "case-event" || source.state !== "fresh" || !(await host.revalidate(call))) {
        return { status: "unavailable", sourceEventId: ref.kind === "case-event" ? ref.target.eventId : "", scanner: { name: "", version: "", status: "unavailable" }, reason: "source unavailable" }
      }
      const receipt = await host.emitFromLedger(ref, call)
      if (!(await host.revalidate(call))) return { status: "unavailable", sourceEventId: ref.target.eventId, scanner: { name: "", version: "", status: "unavailable" }, reason: "authority unavailable" }
      return receipt
    },
  }
}

/** Textual IDs cannot carry historical authorization across replacement incarnations. */
function sameHistoricalSource(original: BusinessEvidenceRef, current: BusinessEvidenceRef): boolean {
  if (original.kind === "record" && current.kind === "record") return original.target.surface === current.target.surface && original.target.recordType === current.target.recordType && original.target.recordId === current.target.recordId && (original.target.surface === "dashboard" || original.target.incarnation === current.target.incarnation)
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
  procurementEvidence?: ProcurementEvidence
  document?: ReturnType<typeof createSfDocumentSourceAccess>
  planner?: ReturnType<typeof createSfDashboardSourceAccess>
  dashboardProof: ReturnType<typeof createSfDashboardContinuityProof>
  caseEventProof: ReturnType<typeof createSfSourceContinuityProof>
  procurementProof: ReturnType<typeof createSfSourceContinuityProof>
  dashboardRecordProof?: ReturnType<typeof createSfSourceContinuityProof>
  documentProof?: ReturnType<typeof createSfSourceContinuityProof>
  plannerProof?: ReturnType<typeof createSfSourceContinuityProof>
}) {
  return {
    async resolveSource(ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> {
      if ((ref.kind === "record" || ref.kind === "receipt") && ref.target.surface === "procurement") {
        const resolved = await input.procurementEvidence?.resolve(ref, call)
        if (resolved) return resolved
      }
      if (ref.kind === "record" && ref.target.surface === "dashboard" && ref.target.recordType === "dashboard-page") return input.dashboard(ref, call)
      if (ref.kind === "record" && ref.target.surface === "dashboard" && input.dashboardRecord) return input.dashboardRecord(ref, call)
      if (ref.kind === "case-event") return input.caseEvent(ref, call)
      if (ref.kind === "record" && ref.target.surface === "procurement" && ["procurement-request", "procurement-supplier"].includes(ref.target.recordType)) return input.procurement(ref, call)
      if (ref.kind === "document" && input.document) return input.document(ref, call)
      if (ref.kind === "record" && ref.target.surface === "planner" && ref.target.recordType === "planner-version" && input.planner) return input.planner(ref, call)
      return Promise.resolve({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() })
    },
    async proveContinuity(original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext): Promise<boolean> {
      if (original.kind === "record" && original.target.surface === "procurement") {
        const proven = await input.procurementEvidence?.proveContinuity(original, current, call)
        if (proven !== undefined) return proven
      }
      if (original.kind === "record" && original.target.surface === "dashboard" && original.target.recordType === "dashboard-page") return input.dashboardProof(original, current, call)
      if (original.kind === "record" && original.target.surface === "dashboard" && input.dashboardRecordProof) return input.dashboardRecordProof(original, current, call)
      if (original.kind === "case-event") return input.caseEventProof(original, current, call)
      if (original.kind === "record" && original.target.surface === "procurement" && ["procurement-request", "procurement-supplier"].includes(original.target.recordType)) return input.procurementProof(original, current, call)
      if (original.kind === "document" && input.documentProof) return input.documentProof(original, current, call)
      if (original.kind === "record" && original.target.surface === "planner" && original.target.recordType === "planner-version" && input.plannerProof) return input.plannerProof(original, current, call)
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
  dashboardRecords: Parameters<typeof createSfDashboardRecordSourceAccess>[0]["records"]
  procurement: ProcurementPort
  procurementResolve: Parameters<typeof createSfProcurementSourceAccess>[0]["resolve"]
  procurementEvidence?: ProcurementEvidence
  documentRead: Parameters<typeof createSfDocumentSourceAccess>[0]["read"]
  planner?: { sources: PlannerSourceHost; port: PlannerPort }
  caseForEvidence: (digest: string, call: TrustedDomainContext) => Promise<{ id: string; incarnation: string } | undefined>
  selections: Pick<Parameters<typeof createSfEvidenceCapabilities>[0], "contextSelections" | "recallSelections" | "featuresForCase" | "runtimeVersions">
  scanner?: { spec: ScannerBinarySpec; version: string }
  now: () => string
}) {
  const dashboard = createSfDashboardSourceAccess({ host: input.host, issue: input.dashboardIssue, dashboard: input.dashboard })
  const dashboardRecord = createSfDashboardRecordSourceAccess({ host: input.host, records: input.dashboardRecords })
  const caseEvent = createSfCaseEventSourceAccess({ host: input.host, cases: input.cases })
  const procurement = createSfProcurementSourceAccess({ host: input.host, resolve: input.procurementResolve, procurement: input.procurement })
  const document = createSfDocumentSourceAccess({ host: input.host, read: input.documentRead })
  const planner = async (ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> => {
    const unavailable = (): BusinessEvidenceResolution => ({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: input.now() })
    if (!input.planner || ref.kind !== "record" || ref.target.surface !== "planner" || ref.target.recordType !== "planner-version" || !ref.target.period || !await input.host.revalidate(call)) return unavailable()
    const first = await input.planner.sources.resolveForecastSource(ref.refId, call)
    if (first.status !== "ok" || digestSfValue(first.value.evidence) !== digestSfValue(ref)) return unavailable()
    const projected = await input.planner.port.compareForecast({ baseRef: ref.refId, candidateRef: ref.refId, period: ref.target.period, currency: "USD" }, call)
    if (projected.status !== "ok" || projected.value.analysisBasis !== "domain" || digestSfValue(projected.value.sourceRefs) !== digestSfValue([ref, ref]) || projected.value.baseline.context.installationId !== call.binding.installationId || projected.value.baseline.context.projectId !== call.binding.projectId || projected.value.baseline.context.principalRef !== call.binding.principalRef || projected.value.baseline.context.accessRevision !== call.binding.accessRevision || projected.value.baseline.context.policyVersion !== call.binding.policyVersion || projected.value.baseline.context.surface !== "planner" || digestSfValue(projected.value.baseline.context.period) !== digestSfValue(ref.target.period) || projected.value.baseline.values.some((value) => value.sourceRefs.length !== 1 || digestSfValue(value.sourceRefs[0]) !== digestSfValue(ref)) || !await input.host.revalidate(call)) return unavailable()
    const again = await input.planner.sources.resolveForecastSource(ref.refId, call)
    if (again.status !== "ok" || digestSfValue(again.value.evidence) !== digestSfValue(ref) || !await input.host.revalidate(call)) return unavailable()
    return { state: "fresh", ref, currentRef: again.value.evidence, authorizedProjection: projected.value.baseline, accessRevision: call.binding.accessRevision, checkedAt: input.now() }
  }
  const readOriginal = async (digest: string, call: TrustedDomainContext) => {
    const caseRef = await input.caseForEvidence(digest, call)
    return caseRef ? memory.readOriginal(caseRef, digest, call) : undefined
  }
  const dashboardRecordProof = async (original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext) => {
    if (original.kind !== "record" || original.target.surface !== "dashboard" || original.target.recordType === "dashboard-page" || digestSfValue(original) !== digestSfValue(current)) return false
    const check = async () => {
      const saved = await readOriginal(original.refDigest, call)
      if (!saved || digestSfValue(saved) !== digestSfValue(original) || !await input.host.revalidate(call)) return false
      const resolution = await dashboardRecord(original, call)
      return resolution.state === "fresh" && !!resolution.currentRef && !!resolution.authorizedProjection && digestSfValue(resolution.currentRef) === digestSfValue(current) && await input.host.revalidate(call)
    }
    return await check() && await check()
  }
  const router = createSfEvidenceRouter({
    dashboard, dashboardRecord, caseEvent, procurement, procurementEvidence: input.procurementEvidence, document, planner,
    dashboardProof: createSfDashboardContinuityProof({ host: input.host, issue: input.dashboardIssue, dashboard: input.dashboard, readOriginal }),
    dashboardRecordProof,
    caseEventProof: createSfSourceContinuityProof({ host: input.host, readOriginal, readCurrent: caseEvent }),
    procurementProof: createSfSourceContinuityProof({ host: input.host, readOriginal, readCurrent: procurement }),
    documentProof: createSfSourceContinuityProof({ host: input.host, readOriginal, readCurrent: document }),
    plannerProof: createSfSourceContinuityProof({ host: input.host, readOriginal, readCurrent: planner }),
  })
  const context = createSfBusinessContext({
    revalidate: input.host.revalidate, ...router,
    recall: async (request, call) => {
      const records = await Promise.all(request.caseRefs.map((ref) => memory.recall(ref, call)))
      if (records.some((result) => result.status !== "ok")) throw new Error("SF_MEMORY_READ_UNAVAILABLE")
      return records.flatMap((result) => result.status === "ok" ? result.records : [])
    },
    emitFromLedger: (ref, call) => memory.emitFromLedger(ref, call),
  })
  const memory = createSfAtlasMemory({ state: input.state, cases: input.cases, host: input.host, evidence: context, proveContinuity: router.proveContinuity, scanner: createSfAtlasScanner({ scanners: input.scanner ? [input.scanner.spec] : [] }), scannerVersion: input.scanner?.version ?? "", now: input.now })
  const capabilities = createSfEvidenceCapabilities({ ...input.selections, context, memory, proveContinuity: router.proveContinuity, revalidate: input.host.revalidate, createReceipt: input.authority.receiptFor })
  return { context, memory, capabilities }
}
