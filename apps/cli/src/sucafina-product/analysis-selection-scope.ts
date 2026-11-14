import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfProductState, SfStateAuthority } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest } from "./analysis-verifier.ts"
import type { SfAnalysisPreparation } from "./analysis-services.ts"

export type SfAnalysisSelectionScope = {
  prepare: <T>(incoming: SfAnalysisPreparation, call: TrustedUiContext, work: () => Promise<PortResult<T>>) => Promise<PortResult<T>>
  verify: <T>(value: unknown, request: SfAnalysisRequest, call: TrustedDomainContext, work: () => Promise<PortResult<T>>) => Promise<PortResult<T>>
}

type Subject = ReturnType<typeof subject>
type SelectionRecord = {
  schema: "sf-analysis-selection-v1"
  subject: Subject
  request: SfAnalysisRequest
  selection: unknown
  material: Readonly<Record<string, unknown>>
  inputDigest: string
  createdAt: number
  expiresAt: number
  recordDigest: string
}
type ActiveSelection = {
  incoming: SfAnalysisPreparation
  subject: Subject
  material: Readonly<Record<string, unknown>>
  inputDigest?: string
  record?: SelectionRecord
}

const prefix = "sf:analysis-selection:"
const unavailable = (): PortResult<never> => ({ status: "unavailable", reason: "analysis-human-selection-unavailable" })

/** Human selections are addressed by the exact prepared input. There is no latest-selection fallback. */
export function createSfAnalysisSelectionScope(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  cases: SfAnalysisDependencies["cases"]
  selectionWrites: WeakSet<object>
  skills: readonly string[]
  prepareMaterial?: (incoming: SfAnalysisPreparation, call: TrustedUiContext) => Promise<PortResult<Readonly<Record<string, unknown>>>>
  now?: () => number
  ttlMs?: number
}) {
  const active = new WeakMap<TrustedDomainContext, ActiveSelection>()
  const now = input.now ?? Date.now
  const ttl = input.ttlMs ?? 60 * 60_000
  if (!Number.isSafeInteger(ttl) || ttl < 1000 || ttl > 24 * 60 * 60_000 || new Set(input.skills).size !== input.skills.length) throw new Error("SF_ANALYSIS_SELECTION_CONFIG_INVALID")
  const host = input.authority.host
  const currentCase = async (request: SfAnalysisRequest, call: TrustedDomainContext) => {
    if (!await host.revalidate(call)) return undefined
    const value = await input.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
    return value.status === "ok" && same({ id: value.value.case.id, incarnation: value.value.case.incarnation, version: value.value.case.version }, request.caseRef) &&
      value.value.case.participants.includes(call.binding.principalRef) && await host.revalidate(call) ? value.value.case : undefined
  }
  const keyFor = (request: SfAnalysisRequest, valueDigest: string, call: TrustedDomainContext) => `${prefix}${digestSfValue({ subject: subject(call), request, inputDigest: valueDigest })}`
  const validRecord = (raw: unknown, request: SfAnalysisRequest, inputDigest: string, call: TrustedDomainContext): raw is SelectionRecord => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false
    const value = raw as Partial<SelectionRecord>
    return value.schema === "sf-analysis-selection-v1" && same(value.subject, subject(call)) && same(value.request, request) &&
      value.inputDigest === inputDigest && typeof value.createdAt === "number" && Number.isSafeInteger(value.createdAt) && value.createdAt <= now() &&
      typeof value.expiresAt === "number" && Number.isSafeInteger(value.expiresAt) && value.expiresAt > now() && value.expiresAt - value.createdAt <= ttl &&
      !!value.material && typeof value.material === "object" && !Array.isArray(value.material) && typeof value.recordDigest === "string" &&
      value.recordDigest === digestSfValue(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "recordDigest")))
  }
  const nativeMatches = (state: Readonly<SfProductState>, request: SfAnalysisRequest, inputDigest: string, call: TrustedDomainContext) => {
    if (call.kind !== "native") return true
    const run = state.nativeRuns?.[call.binding.runId]
    return !!run && ["queued", "running", "ready"].includes(run.state) && !!run.native && run.native.sessionID === call.binding.nativeSessionId &&
      run.skillId === request.skillId && run.skillInputDigest === inputDigest && same(run.caseRef, request.caseRef) &&
      run.principalRef === call.binding.principalRef && run.accessRevision === call.binding.accessRevision && run.policyVersion === call.binding.policyVersion &&
      call.binding.caseId === request.caseRef.id && call.binding.caseIncarnation === request.caseRef.incarnation && call.binding.caseVersion === request.caseRef.version &&
      call.binding.profileId === request.profileId && call.binding.profileVersion === request.profileVersion && call.binding.manifestDigest === request.manifestDigest &&
      call.binding.skillReceipts.some((receipt) => same(receipt, run.native!.skillReceipt))
  }
  const load = async (request: SfAnalysisRequest, valueDigest: string, call: TrustedDomainContext) => {
    const source = host.requestFor(call)
    if (!source || source.signal.aborted || !await currentCase(request, call)) return undefined
    const key = keyFor(request, valueDigest, call)
    const record = await input.authority.state.read(source, "preferences", (state, actor) => {
      const value = state.preferences[key]
      return actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion &&
        validRecord(value, request, valueDigest, call) && nativeMatches(state, request, valueDigest, call) ? value : undefined
    })
    return record.status === "ok" && record.value && await currentCase(request, call) && !source.signal.aborted ? record.value : undefined
  }
  const read = async (caseRef: SfAnalysisRequest["caseRef"], skillId: string, call: TrustedDomainContext): Promise<PortResult<{ selection: unknown; material: Readonly<Record<string, unknown>> }>> => {
    const value = active.get(call)
    const binding = digestSfValue([call.kind, call.binding])
    if (!value || value.incoming.request.skillId !== skillId || !same(value.incoming.request.caseRef, caseRef) || !same(value.subject, subject(call)) || !await currentCase(value.incoming.request, call)) return unavailable()
    if (value.record) {
      const current = await load(value.incoming.request, value.record.inputDigest, call)
      if (!current || !same(current, value.record)) return unavailable()
    } else if (call.kind !== "ui" || !await input.authority.human.authorize(call, "analysis.prepare", value.incoming)) return unavailable()
    return active.get(call) === value && binding === digestSfValue([call.kind, call.binding]) && await host.revalidate(call)
      ? { status: "ok", value: structuredClone({ selection: value.incoming.selection, material: value.material }) } : unavailable()
  }
  const selectionScope: SfAnalysisSelectionScope = {
    prepare: async (incoming, call, work) => {
      if (!input.skills.includes(incoming.request.skillId)) return work()
      const captured = structuredClone(incoming)
      const digest = digestSfValue(captured)
      const binding = digestSfValue([call.kind, call.binding])
      const source = host.requestFor(call)
      if (!source || source.signal.aborted || active.has(call) || JSON.stringify(captured).length > 65536 || !await input.authority.human.authorize(call, "analysis.prepare", captured) || !await currentCase(captured.request, call)) return unavailable()
      const value: ActiveSelection = { incoming: captured, subject: subject(call), material: {} }
      active.set(call, value)
      try {
        if (input.prepareMaterial) {
          const material = await input.prepareMaterial(structuredClone(captured), call)
          if (material.status !== "ok") return material
          value.material = structuredClone(material.value)
        }
        const result = await work()
        if (result.status !== "ok") return result
        const inputDigest = digestSfValue(result.value)
        if (value.inputDigest !== inputDigest || digestSfValue(captured) !== digest || binding !== digestSfValue([call.kind, call.binding]) ||
          !await input.authority.human.authorize(call, "analysis.prepare", captured) || !await currentCase(captured.request, call)) return unavailable()
        const key = keyFor(captured.request, inputDigest, call)
        const current = await input.authority.state.read(source, "cases", (state, actor) => actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion ? state.cases[captured.request.caseRef.id] : undefined)
        const before = await input.authority.state.read(source, "preferences", (state, actor) => actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion ? { existing: state.preferences[key], count: Object.keys(state.preferences).filter((entry) => entry.startsWith(prefix)).length } : undefined)
        if (current.status !== "ok" || !current.value || before.status !== "ok" || !before.value) return unavailable()
        if (before.value.existing !== undefined) {
          const existing = before.value.existing
          if (!validRecord(existing, captured.request, inputDigest, call) || !same(existing.selection, captured.selection) || !same(existing.material, value.material)) return { status: "conflict", reason: "analysis-selection-conflict-or-expired" }
          return await input.authority.human.authorize(call, "analysis.prepare", captured) && await load(captured.request, inputDigest, call) ? result : unavailable()
        }
        if (before.value.count >= 4096) return { status: "unavailable", reason: "analysis-selection-capacity" }
        const createdAt = now()
        const material = { schema: "sf-analysis-selection-v1" as const, subject: value.subject, request: captured.request, selection: captured.selection,
          material: value.material, inputDigest, createdAt, expiresAt: createdAt + ttl }
        if (JSON.stringify(material).length > 131072) return unavailable()
        const record: SelectionRecord = { ...material, recordDigest: digestSfValue(material) }
        const operation = input.authority.ui.operationIdentity(call)
        if (!operation) return unavailable()
        const commitSelection = async (state: SfProductState, actor: SfStateAuthority) => {
          const selected = state.cases[captured.request.caseRef.id]
          if (!selected || !same(selected, current.value) || !same({ id: selected.id, incarnation: selected.incarnation, version: selected.version }, captured.request.caseRef) ||
            !selected.participants.includes(actor.principalRef) || actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion ||
            state.preferences[key] !== undefined || !await input.authority.human.authorize(call, "analysis.prepare", captured) || binding !== digestSfValue([call.kind, call.binding])) return { commit: false, value: false }
          state.preferences[key] = record
          return { commit: true, value: true }
        }
        input.selectionWrites.add(commitSelection)
        const saved = await input.authority.state.transaction(source, { namespace: "preferences", expectedStorageVersion: before.storageVersion,
          checkNamespaces: [{ namespace: "cases", expectedStorageVersion: current.storageVersion }], targetRef: encodeCaseRef(captured.request.caseRef), targetIncarnation: captured.request.caseRef.incarnation,
          idempotencyKey: `analysis-selection:${operation}`, commandDigest: digestSfValue({ key, selection: captured.selection, inputDigest, material: value.material }) }, commitSelection).finally(() => input.selectionWrites.delete(commitSelection))
        if (saved.status !== "ok" || !saved.value || !await input.authority.human.authorize(call, "analysis.prepare", captured) || binding !== digestSfValue([call.kind, call.binding]) || !same(await load(captured.request, inputDigest, call), record)) return unavailable()
        return result
      } finally { active.delete(call) }
    },
    verify: async (incoming, request, call, work) => {
      if (!input.skills.includes(request.skillId)) return work()
      const valueDigest = digestSfValue(incoming)
      const wanted = structuredClone(request)
      const binding = digestSfValue([call.kind, call.binding])
      const previous = active.get(call)
      if (previous) {
        if (previous.record || !same(previous.incoming.request, wanted) || !same(previous.subject, subject(call)) || previous.inputDigest !== undefined && previous.inputDigest !== valueDigest ||
          call.kind !== "ui" || !await input.authority.human.authorize(call, "analysis.prepare", previous.incoming)) return unavailable()
        previous.inputDigest = valueDigest
        const result = await work()
        return binding === digestSfValue([call.kind, call.binding]) && await currentCase(wanted, call) && await input.authority.human.authorize(call, "analysis.prepare", previous.incoming) ? result : unavailable()
      }
      const record = await load(wanted, valueDigest, call)
      if (!record) return unavailable()
      const selected: ActiveSelection = { incoming: { request: wanted, selection: record.selection }, subject: record.subject, material: record.material, inputDigest: valueDigest, record }
      active.set(call, selected)
      try {
        const result = await work()
        return binding === digestSfValue([call.kind, call.binding]) && same(await load(wanted, valueDigest, call), record) ? result : unavailable()
      } finally { active.delete(call) }
    },
  }
  return { selectionScope, read }
}

function subject(call: TrustedDomainContext) {
  return { installationId: call.binding.installationId, projectId: call.binding.projectId, principalRef: call.binding.principalRef,
    accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion }
}
function same(left: unknown, right: unknown) { return digestSfValue(left) === digestSfValue(right) }
