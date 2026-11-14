import { isSfPeriod } from "../contracts/validation.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { SourceRef } from "../contracts/context.ts"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { ScenarioOperation } from "../contracts/operations.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../contracts/state.ts"
import type { Snapshot } from "../../runtime/contract.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type Fields = { action: string; owner: string; due: string; priority: "critical" | "high" | "normal"; notes: string }
export type HotTopicDraftRequest = { caseRef: CaseRef; target: SourceRef; targetEvidence: Extract<BusinessEvidenceRef, { kind: "record" }>; fields: Fields; sourceRefs: readonly BusinessEvidenceRef[]; draftRef?: string; expectedVersion: number }
export type HotTopicDraft = { schema: "sf-hot-topic-draft-v1"; id: string; incarnation: string; version: number; draftRef: string; caseRef: CaseRef; caseScopeDigest: string; target: SourceRef; targetEvidence: Extract<BusinessEvidenceRef, { kind: "record" }>; fields: Fields; sourceRefs: readonly BusinessEvidenceRef[]; principalRef: string; accessRevision: string; policyVersion: string; createdAt: string; recordDigest: string }

/** A human drafts fields before choosing; a draft is a selector, never a domain grant. */
export function createHotTopicDraftStore(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  authorizeDraft: (request: HotTopicDraftRequest, context: TrustedDomainContext) => Promise<boolean>
  verifySources: (draft: HotTopicDraft, context: TrustedDomainContext) => Promise<boolean>
  verifySnapshot: (snapshot: Snapshot, request: HotTopicDraftRequest, draft: HotTopicDraft, context: TrustedDomainContext) => boolean
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  proposalCoverageWrites: WeakSet<object>
  createId: () => string
  now: () => string
}) {
  const readCurrent = async (incoming: { caseRef: CaseRef; draftRef: string }, context: TrustedDomainContext): Promise<PortResult<HotTopicDraft>> => {
    try {
      const request = structuredClone(incoming)
      const source = input.host.requestFor(context)
      if (!source || !request.draftRef.trim() || !await input.host.revalidate(context)) return { status: "denied", reason: "hot-topic-draft-access-unavailable" }
      const readCase = () => input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      const readDraft = () => input.state.read(source, "preferences", (state, authority) => {
        if (!sameAuthority(authority, context)) return undefined
        const draft = state.preferences[historyKey(request.draftRef)]
        return isDraft(draft) ? { draft, active: state.preferences[activeKey(draft.id)] } : undefined
      })
      const current = await readCase()
      const found = await readDraft()
      if (current.status !== "ok" || !allowed(current.value, request.caseRef, context) || !await input.authorizeCase(current.value!, context) || found.status !== "ok" || !found.value || !isDraft(found.value.active)) return { status: "unavailable", reason: "hot-topic-draft-unavailable" }
      const draft = found.value.draft
      if (draft.draftRef !== request.draftRef || digestSfValue(found.value.active) !== digestSfValue(draft) || draft.recordDigest !== recordDigest(draft) || draft.caseRef.id !== request.caseRef.id || draft.caseRef.incarnation !== request.caseRef.incarnation || draft.caseRef.version > request.caseRef.version || draft.caseScopeDigest !== caseScopeDigest(current.value!) || !await input.verifySources(draft, context)) return { status: "stale", reason: "hot-topic-draft-changed" }
      const again = await readCase()
      const draftAgain = await readDraft()
      if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(current.value) || !allowed(again.value, request.caseRef, context) || !await input.authorizeCase(again.value!, context) || draftAgain.status !== "ok" || digestSfValue(draftAgain.value) !== digestSfValue(found.value) || !await input.verifySources(draft, context) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "hot-topic-draft-changed" }
      // Source and case callbacks may await other work. Observe the exact authorized
      // case and draft together after their last callback, with no callback on egress.
      const final = await input.state.read(source, "preferences", (state, authority) => {
        if (!sameAuthority(authority, context)) return undefined
        const draft = state.preferences[historyKey(request.draftRef)]
        return { current: state.cases[request.caseRef.id], draft, active: isDraft(draft) ? state.preferences[activeKey(draft.id)] : undefined }
      })
      if (final.status !== "ok" || !final.value || !allowed(final.value.current, request.caseRef, context) || digestSfValue(final.value.current) !== digestSfValue(again.value) || !isDraft(final.value.draft) || digestSfValue(final.value.draft) !== digestSfValue(draft) || !isDraft(final.value.active) || digestSfValue(final.value.active) !== digestSfValue(found.value.active) || source.signal.aborted || input.host.requestFor(context) !== source) return { status: "stale", reason: "hot-topic-draft-changed" }
      return { status: "ok", value: structuredClone(final.value.draft) }
    } catch { return { status: "unavailable", reason: "hot-topic-draft-unavailable" } }
  }
  const list = async (incoming: { caseRef: CaseRef }, context: TrustedDomainContext): Promise<PortResult<readonly { draftRef: string; label: string; version: number; target: SourceRef }[]>> => {
    try {
      const request = structuredClone(incoming)
      const source = input.host.requestFor(context)
      if (!source || !await input.host.revalidate(context)) return { status: "denied", reason: "hot-topic-draft-access-unavailable" }
      const readCase = () => input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      const selectedDrafts = (state: Readonly<SfProductState>) => Object.entries(state.preferences).filter(([name]) => name.startsWith("sf:proposal-coverage:hot-topic:active:")).map(([, value]) => value).filter(isDraft).filter((draft) => draft.caseRef.id === request.caseRef.id && draft.caseRef.incarnation === request.caseRef.incarnation && draft.caseRef.version <= request.caseRef.version)
      const readDrafts = () => input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? selectedDrafts(state) : undefined)
      const current = await readCase()
      const drafts = await readDrafts()
      if (current.status !== "ok" || !allowed(current.value, request.caseRef, context) || !await input.authorizeCase(current.value!, context) || drafts.status !== "ok" || !drafts.value) return { status: "denied", reason: "hot-topic-draft-access-unavailable" }
      const checked = await Promise.all(drafts.value.map((draft) => readCurrent({ caseRef: request.caseRef, draftRef: draft.draftRef }, context)))
      const again = await readCase()
      const draftsAgain = await readDrafts()
      if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(current.value) || !allowed(again.value, request.caseRef, context) || !await input.authorizeCase(again.value!, context) || draftsAgain.status !== "ok" || digestSfValue(draftsAgain.value) !== digestSfValue(drafts.value) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "hot-topic-draft-changed" }
      const final = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? { current: state.cases[request.caseRef.id], drafts: selectedDrafts(state) } : undefined)
      if (final.status !== "ok" || !final.value || !allowed(final.value.current, request.caseRef, context) || digestSfValue(final.value.current) !== digestSfValue(again.value) || digestSfValue(final.value.drafts) !== digestSfValue(draftsAgain.value) || source.signal.aborted || input.host.requestFor(context) !== source) return { status: "stale", reason: "hot-topic-draft-changed" }
      return { status: "ok", value: checked.flatMap((item) => item.status === "ok" ? [{ draftRef: item.value.draftRef, label: item.value.fields.action, version: item.value.version, target: item.value.target }] : []) }
    } catch { return { status: "unavailable", reason: "hot-topic-draft-unavailable" } }
  }
  const register = async (incoming: HotTopicDraftRequest, context: TrustedDomainContext): Promise<PortResult<{ draftRef: string; version: number }>> => {
    try {
      const request = structuredClone(incoming)
      const source = input.host.requestFor(context)
      const operation = input.operationIdentity(context)
      if (context.kind !== "ui" || !source || !operation || !valid(request, context) || !await input.authorizeDraft(request, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "hot-topic-draft-access-unavailable" }
      const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      const preferences = await input.state.read(source, "preferences", (state, authority) => {
        if (!sameAuthority(authority, context)) return undefined
        const previous = request.draftRef ? state.preferences[historyKey(request.draftRef)] : undefined
        return { previous, active: isDraft(previous) ? state.preferences[activeKey(previous.id)] : undefined, prior: state.transactions[JSON.stringify([authority.principalRef, "preferences", request.caseRef.id, `hot-topic-draft:${operation}`])] }
      })
      if (current.status !== "ok" || !allowed(current.value, request.caseRef, context) || !await input.authorizeCase(current.value!, context) || preferences.status !== "ok" || !preferences.value) return { status: "denied", reason: "hot-topic-draft-access-unavailable" }
      if (preferences.value.prior) {
        if (preferences.value.prior.commandDigest !== digestSfValue(request) || preferences.value.prior.targetIncarnation !== request.caseRef.incarnation) return { status: "conflict", reason: "idempotency-content-changed" }
        const saved = preferences.value.prior.value
        if (!saved || typeof saved !== "object" || !("draftRef" in saved) || typeof saved.draftRef !== "string") return { status: "unavailable", reason: "hot-topic-draft-unavailable" }
        const checked = await readCurrent({ caseRef: request.caseRef, draftRef: saved.draftRef }, context)
        if (checked.status !== "ok" || !await input.authorizeDraft(request, context) || source.signal.aborted || input.host.requestFor(context) !== source) return { status: "unavailable", reason: "hot-topic-draft-unavailable" }
        return { status: "ok", value: { draftRef: checked.value.draftRef, version: checked.value.version } }
      }
      const previous = preferences.value.previous
      if (request.draftRef && (!isDraft(previous) || !isDraft(preferences.value.active) || digestSfValue(previous) !== digestSfValue(preferences.value.active) || previous.draftRef !== request.draftRef || previous.caseRef.id !== request.caseRef.id || previous.caseRef.incarnation !== request.caseRef.incarnation || previous.caseScopeDigest !== caseScopeDigest(current.value!) || previous.version !== request.expectedVersion)) return { status: "stale", reason: "hot-topic-draft-changed" }
      if (!request.draftRef && request.expectedVersion !== 0) return { status: "stale", reason: "hot-topic-draft-changed" }
      const id = isDraft(previous) ? previous.id : input.createId()
      const incarnation = isDraft(previous) ? previous.incarnation : input.createId()
      const version = request.expectedVersion + 1
      if (!id.trim() || !incarnation.trim()) return { status: "unavailable", reason: "hot-topic-draft-identity-unavailable" }
      const draftRef = `hot-topic-draft:${digestSfValue({ id, incarnation, version, caseRef: request.caseRef, request })}`
      const value = { schema: "sf-hot-topic-draft-v1" as const, id, incarnation, version, draftRef, caseRef: request.caseRef, caseScopeDigest: caseScopeDigest(current.value!), target: request.target, targetEvidence: request.targetEvidence, fields: request.fields, sourceRefs: request.sourceRefs, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, createdAt: input.now(), recordDigest: "" }
      const draft: HotTopicDraft = { ...value, recordDigest: recordDigest(value) }
      if (!Number.isFinite(Date.parse(draft.createdAt)) || !await input.verifySources(draft, context) || !await input.authorizeDraft(request, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "hot-topic-draft-evidence-unavailable" }
      const work = async (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => {
        const actual = state.cases[request.caseRef.id]
        const active = state.preferences[activeKey(id)]
        if (!sameAuthority(authority, context) || !allowed(actual, request.caseRef, context) || caseScopeDigest(actual!) !== draft.caseScopeDigest || (isDraft(previous) ? !isDraft(active) || digestSfValue(active) !== digestSfValue(previous) : active !== undefined) || state.preferences[historyKey(draftRef)] !== undefined || !input.verifySnapshot(snapshot, request, draft, context)) return { commit: false, value: null }
        state.preferences[historyKey(draftRef)] = draft
        state.preferences[activeKey(id)] = draft
        return { commit: true, value: { draftRef, version } }
      }
      input.proposalCoverageWrites.add(work)
      const saved = await input.state.transaction(source, { namespace: "preferences", domainSurface: "dashboard", expectedStorageVersion: preferences.storageVersion, additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: current.storageVersion }], targetRef: request.caseRef.id, targetIncarnation: request.caseRef.incarnation, idempotencyKey: `hot-topic-draft:${operation}`, commandDigest: digestSfValue(request) }, work).finally(() => input.proposalCoverageWrites.delete(work))
      if (saved.status !== "ok" || !saved.value) return { status: saved.status === "conflict" || saved.status === "preview" ? "conflict" : "unavailable", reason: "hot-topic-draft-unavailable" }
      const checked = await readCurrent({ caseRef: request.caseRef, draftRef: saved.value.draftRef }, context)
      if (checked.status !== "ok" || !await input.authorizeDraft(request, context) || source.signal.aborted || input.host.requestFor(context) !== source) return { status: "unavailable", reason: "hot-topic-draft-unavailable" }
      return { status: "ok", value: saved.value }
    } catch { return { status: "unavailable", reason: "hot-topic-draft-unavailable" } }
  }
  return { register, readCurrent, list }
}

/** Called only while the case and preferences are locked by C08. */
export function verifyHotTopicDraftBinding(state: SfProductState, caseRef: CaseRef, choiceId: string, operation: ScenarioOperation, draft: HotTopicDraft) {
  const current = state.cases[caseRef.id]
  const active = state.preferences[activeKey(draft.id)]
  const history = state.preferences[historyKey(draft.draftRef)]
  const choices = current?.choices.filter((item) => item.id === choiceId) ?? []
  return !!current && current.incarnation === caseRef.incarnation && current.version === caseRef.version && draft.caseRef.id === caseRef.id && draft.caseRef.incarnation === caseRef.incarnation && draft.caseRef.version <= caseRef.version && draft.caseScopeDigest === caseScopeDigest(current) && draft.recordDigest === recordDigest(draft) && isDraft(active) && isDraft(history) && digestSfValue(active) === digestSfValue(draft) && digestSfValue(history) === digestSfValue(draft) && choices.length === 1 && choices[0]!.scenario.operations.filter((item) => digestSfValue(item) === digestSfValue(operation)).length === 1 && operation.kind === "replace" && operation.targetRef === draft.targetEvidence.refId && operation.replacementRef === draft.draftRef
}
function valid(request: HotTopicDraftRequest, context: TrustedDomainContext) {
  const target = request.target
  const evidence = request.targetEvidence
  return Number.isSafeInteger(request.expectedVersion) && request.expectedVersion >= 0 && (request.draftRef === undefined || !!request.draftRef.trim()) && target.surface === "dashboard" && target.type === "hotTopics" && !!target.id.trim() && !!target.incarnation.trim() && Number.isSafeInteger(target.version) && target.version >= 0 && Number.isFinite(Date.parse(target.observedAt)) && isSfPeriod(target.period) && target.fields.length > 0 && new Set(target.fields).size === target.fields.length && target.fields.every((field) => !!field.trim()) && evidence.kind === "record" && evidence.installationId === context.binding.installationId && evidence.projectId === context.binding.projectId && evidence.refDigest === digestSfEvidenceRef(evidence) && evidence.target.surface === target.surface && evidence.target.recordType === target.type && evidence.target.recordId === target.id && evidence.target.incarnation === target.incarnation && evidence.target.version === target.version && !!evidence.target.period && evidence.target.period.start <= target.period.start && evidence.target.period.end >= target.period.end && target.fields.every((field) => evidence.target.fields.includes(field)) && request.sourceRefs.some((ref) => digestSfValue(ref) === digestSfValue(evidence)) && !!request.fields.action.trim() && !!request.fields.owner.trim() && isSfPeriod({ start: request.fields.due, end: request.fields.due }) && ["critical", "high", "normal"].includes(request.fields.priority) && typeof request.fields.notes === "string"
}
function sameAuthority(authority: SfStateAuthority, context: TrustedDomainContext) { return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision }
function allowed(value: DecisionCase | undefined, ref: CaseRef, context: TrustedDomainContext) { return !!value && value.id === ref.id && value.incarnation === ref.incarnation && value.version === ref.version && value.participants.includes(context.binding.principalRef) && (context.kind !== "native" || (context.binding.caseId === value.id && context.binding.caseIncarnation === value.incarnation && context.binding.caseVersion === value.version)) }
function caseScopeDigest(value: DecisionCase) { return digestSfValue({ id: value.id, incarnation: value.incarnation, horizon: value.horizon, currency: value.currency, criteria: value.criteria }) }
function activeKey(id: string) { return `sf:proposal-coverage:hot-topic:active:${digestSfValue(id)}` }
function historyKey(ref: string) { return `sf:proposal-coverage:hot-topic:history:${digestSfValue(ref)}` }
function recordDigest(value: HotTopicDraft) { return digestSfValue(Object.fromEntries(Object.entries(value).filter(([name]) => name !== "recordDigest"))) }
function isDraft(value: unknown): value is HotTopicDraft { if (!value || typeof value !== "object" || Array.isArray(value)) return false; const draft = value as Partial<HotTopicDraft>; return draft.schema === "sf-hot-topic-draft-v1" && typeof draft.id === "string" && typeof draft.incarnation === "string" && Number.isSafeInteger(draft.version) && typeof draft.draftRef === "string" && !!draft.caseRef && typeof draft.caseScopeDigest === "string" && !!draft.target && !!draft.targetEvidence && !!draft.fields && Array.isArray(draft.sourceRefs) && typeof draft.recordDigest === "string" }
