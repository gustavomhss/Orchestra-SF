import { AsyncLocalStorage } from "node:async_hooks"
import { digestSfValue, sfEvidenceSourceMaps } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { ScenarioResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { DomainPortHost, PlannerPort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfProductState, SfStateAuthority } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import { historicalCalculationMatches } from "../../../../modules/sucafina/Sucafinav1/product/decisions/calculation-history.ts"
import type { HistoricalCalculationRead } from "../../../../modules/sucafina/Sucafinav1/product/decisions/calculation-history.ts"
import { createSfDecisionResultStore } from "../../../../modules/sucafina/Sucafinav1/product/decisions/result-store.ts"
import { createScenarioRequestStore } from "../../../../modules/sucafina/Sucafinav1/product/decisions/scenario-request-store.ts"
import { createPlannerCalculationEvidence } from "../../../../modules/sucafina/Sucafinav1/product/planner/calculation-evidence.ts"
import type { SfCalculationCaseScope } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/atlas-recall-scope.ts"

type Calculation = Extract<BusinessEvidenceRef, { kind: "calculation" }>
type Capture = { ref: BusinessEvidenceRef; projection: NonNullable<BusinessEvidenceResolution["authorizedProjection"]> }
type ResultInput = Parameters<typeof createSfDecisionResultStore>[0]
type SourceFences = Record<"dashboard" | "planner" | "procurement", string>

/** Read an already protected original through the explicit ledger lane. This
 * reader never supplies a current result, registers a request or writes Atlas. */
export function createSfPlannerCalculationHistory(input: {
  host: DomainPortHost
  state: ResultInput["state"]
  authorizeCase: ResultInput["authorizeCase"]
  evidence: BusinessContextService
  replayRecordOnly: PlannerPort["simulateScenario"]
  withCalculationCase: SfCalculationCaseScope
  lockedSourceFences: () => SourceFences | undefined
  /** The host's current Planner record admission, not an assumed historical grant. */
  verifyCurrentPlannerRecords?: (refs: readonly Extract<BusinessEvidenceRef, { kind: "record" }>[], call: TrustedDomainContext) => Promise<boolean>
}) {
  const active = new AsyncLocalStorage<{ call: TrustedDomainContext; request: Request; requestDigest: string; binding: string; runs: ReadonlySet<string>; open: boolean }>()
  const currentSourceScope = (call: TrustedDomainContext) => {
    const scope = active.getStore()
    return !!scope?.open && scope.call === call && input.host.requestFor(call) === scope.request && !scope.request.signal.aborted &&
      requestIdentity(scope.request) === scope.requestDigest && digestSfValue([call.kind, call.binding]) === scope.binding
  }
  const readOnly = () => { throw new Error("historical-calculation-read-only") }
  const results = createSfDecisionResultStore({ host: input.host, state: input.state, authorizeCase: input.authorizeCase,
    verifySources: async (_value, refs, call) => {
      if (!refs.length || refs.some((ref) => ref.kind !== "record")) return false
      // The same scoped source resolver used by current calculations compares
      // every complete record ref with its live projection identity. The two
      // actual financial replays below still reconstruct every numeric value.
      if (call.kind === "ui" && input.verifyCurrentPlannerRecords && refs.every((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> =>
        ref.kind === "record" && ref.target.surface === "planner" && ref.target.recordType === "planner-version")) {
        const scope = active.getStore()
        return currentSourceScope(call) && await input.verifyCurrentPlannerRecords(refs, call) && active.getStore() === scope && currentSourceScope(call)
      }
      const current = await input.evidence.context({ refs }, call)
      return current.length === refs.length && current.every((value, index) => value.state === "fresh" && !!value.authorizedProjection && !!value.currentRef &&
        value.accessRevision === call.binding.accessRevision && same(value.ref, refs[index]) && same(value.currentRef, refs[index])) && await input.host.revalidate(call)
    }, createId: readOnly, now: () => new Date().toISOString() })
  const requests = createScenarioRequestStore({ host: input.host, state: input.state, results, authorizeCase: input.authorizeCase,
    authorizeProducer: async () => false, verifySnapshot: () => false, operationIdentity: () => undefined, writes: new WeakSet<object>() })

  const resolve = async (incoming: BusinessEvidenceRef, call: TrustedDomainContext,
    readCapture: (caseRef: HistoricalCalculationRead["caseRef"], digest: string, call: TrustedDomainContext) => Promise<Capture | undefined>): Promise<BusinessEvidenceResolution> => {
    const ref = structuredClone(incoming)
    const unavailable = (): BusinessEvidenceResolution => ({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() })
    if (ref.kind !== "calculation" || ref.target.calculationId !== "planner:scenario" || ref.target.engineVersion !== "planner-runtime-v1" ||
      !ref.target.sourceRefs.length || ref.target.sourceRefs.some((source) => source.kind !== "record")) return unavailable()
    const request = input.host.requestFor(call), binding = digestSfValue([call.kind, call.binding]), selected = digestSfValue(ref)
    const parent = active.getStore()
    const ancestors = parent?.open && parent.call === call && parent.request === request && parent.binding === binding ? parent.runs : new Set<string>()
    if (!request || request.signal.aborted || call.binding.principalRef.startsWith("local:") || ancestors.has(ref.target.runId) || ancestors.size >= 16) return unavailable()
    const requestDigest = requestIdentity(request)
    const current = () => input.host.requestFor(call) === request && !request.signal.aborted && requestIdentity(request) === requestDigest &&
      digestSfValue([call.kind, call.binding]) === binding && same(incoming, ref)
    const snapshot = async () => {
      if (!current() || !await input.host.revalidate(call) || !current()) return undefined
      const observe = async (state: Readonly<SfProductState>, actor: SfStateAuthority) => {
        if (!current() || actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion) return undefined
        const stored = state.decisionResults?.[ref.target.runId]
        const decision = stored && state.cases[stored.caseRef.id]
        if (!stored || stored.kind !== "scenario" || !decision || !decision.participants.includes(actor.principalRef) || decision.version <= stored.caseRef.version ||
          call.kind === "native" && (call.binding.caseId !== decision.id || call.binding.caseIncarnation !== decision.incarnation || call.binding.caseVersion !== decision.version)) return undefined
        const caseRef = { id: decision.id, incarnation: decision.incarnation, version: decision.version }
        const selections = decision.ledger.map((event) => ({ caseRef, eventId: event.id, reference: ref }))
          .filter((selection) => historicalCalculationMatches(decision, stored, selection, call)).sort((left, right) => left.eventId.localeCompare(right.eventId))
        if (!selections.length) return undefined
        const sources = input.lockedSourceFences()
        const day = (await input.host.environment(request)).at
        if (!sources || !Number.isFinite(Date.parse(day)) || !await input.host.revalidate(call) || !current()) return undefined
        const finalDay = (await input.host.environment(request)).at
        if (!Number.isFinite(Date.parse(finalDay)) || new Date(finalDay).toISOString().slice(0, 10) !== new Date(day).toISOString().slice(0, 10) ||
          !await input.host.revalidate(call) || !current()) return undefined
        const bound = state.preferences[`sf:proposal-coverage:scenario-request:${digestSfValue(ref.target.runId)}`]
        if (!bound) return undefined
        return { selection: selections[0]!, stored: structuredClone(stored),
          fence: digestSfValue({ decision, stored, bound, selections, atlas: state.atlas, sources, binding, selected, day: new Date(day).toISOString().slice(0, 10) }) }
      }
      const first = await input.state.read(request, "cases", observe)
      const second = await input.state.read(request, "preferences", observe)
      return first.status === "ok" && second.status === "ok" && first.value && second.value && first.value.fence === second.value.fence && current() ? second.value : undefined
    }
    try {
      sfEvidenceSourceMaps([ref])
      const scope = { call, request, requestDigest, binding, runs: new Set([...ancestors, ref.target.runId]), open: true }
      return await active.run(scope, async () => {
        try {
          const before = await snapshot()
          if (!before) return unavailable()
          const selectedCase = before.selection.caseRef
          const capture = await readCapture(selectedCase, ref.refDigest, call)
          if (!capture || !same(capture.ref, ref) || !calculationProjection(capture.projection, ref, before.stored.result)) return unavailable()
          const original = structuredClone(capture)
          const producer = createPlannerCalculationEvidence({ host: input.host,
            loadRecordOnlyRequest: (runId, trusted) => runId === ref.target.runId ? requests.readHistorical(before.selection, trusted)
              : Promise.resolve({ status: "denied", reason: "historical-calculation-outside-ledger-selection" }),
            readForCalculation: (target, trusted) => target.resultRef === ref.target.runId ? results.readHistoricalCalculation(before.selection, trusted)
              : Promise.resolve({ status: "denied", reason: "historical-calculation-outside-ledger-selection" }),
            replayRecordOnly: input.replayRecordOnly,
          })
          const replayed = await input.withCalculationCase<BusinessEvidenceResolution>(call, selectedCase, async () => {
            const issued = await producer.issue(ref.target.runId, call)
            if (issued.status !== "ok" || !same(issued.value, ref)) return { status: "unavailable", reason: "historical-calculation-replay-unavailable" }
            const captured = await readCapture(selectedCase, ref.refDigest, call)
            if (!captured || !same(captured, original) || !current()) return { status: "unavailable", reason: "historical-calculation-capture-changed" }
            return { status: "ok", value: { state: "historical", ref, currentRef: ref, authorizedProjection: original.projection,
              differences: [{ field: "case.version", before: before.stored.caseRef.version, after: selectedCase.version }],
              accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() } }
          }, async (result) => {
            if (result.status !== "ok") return result
            const captured = await readCapture(selectedCase, ref.refDigest, call)
            const after = await snapshot()
            return captured && same(captured, original) && after && after.fence === before.fence && current()
              ? result : { status: "unavailable", reason: "historical-calculation-authority-changed" }
          })
          return replayed.status === "ok" && current() ? replayed.value : unavailable()
        } finally { scope.open = false }
      })
    } catch { return unavailable() }
  }
  return { resolve }
}

function same(left: unknown, right: unknown) { return digestSfValue(left) === digestSfValue(right) }
function requestIdentity(request: Request) { return digestSfValue({ method: request.method, url: request.url, headers: [...request.headers.entries()] }) }

function calculationProjection(projection: Capture["projection"], ref: Calculation, result: ScenarioResult): projection is DomainProjection {
  if (!("values" in projection) || !("components" in projection) || projection.context.installationId !== ref.installationId ||
    projection.context.projectId !== ref.projectId || projection.context.surface !== "planner" || projection.engineVersion !== ref.target.engineVersion ||
    !same(projection.context.period, ref.target.period) || projection.context.currency !== ref.target.currency || projection.version !== result.version || !same(projection.components, result.components)) return false
  const value = (id: string) => projection.values.find((value) => value.id === id)?.value
  return value("scenario:result-ref") === ref.target.runId && value("scenario:request-digest") === ref.target.inputDigest &&
    value("scenario:result-digest") === ref.target.resultDigest && value("scenario:result") === JSON.stringify(result) &&
    value("scenario:known-subtotal") === result.knownSubtotal && value("scenario:total") === result.total
}
