import { digestSfValue } from "../contracts/canonical.ts"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../contracts/state.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import type { createDecisionComparisonService } from "./comparison.ts"

type CaseRef = { id: string; incarnation: string; version: number }
export type PortfolioSelectionRequest = { caseRef: CaseRef; baselineAlternativeId: string; alternativeId: string; criteria: readonly string[]; expectedVersion: number }
export type PortfolioSelection = { schema: "sf-portfolio-selection-v1"; selectionRef: string; caseRef: CaseRef; baselineAlternativeId: string; alternativeId: string; baselineRef: string; alternativeRef: string; criteria: readonly string[]; comparisonDigest: string; version: number; principalRef: string; accessRevision: string; policyVersion: string; createdAt: string; selectionDigest: string }

/** A human selects both alternatives; no candidate is implicitly made the baseline. */
export function createDecisionPortfolioSelection(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  compare: ReturnType<typeof createDecisionComparisonService>
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  authorizeSelection: (request: PortfolioSelectionRequest, context: TrustedDomainContext) => Promise<boolean>
  verifySnapshot: (snapshot: Snapshot, request: PortfolioSelectionRequest, selection: PortfolioSelection, context: TrustedDomainContext) => boolean
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  proposalCoverageWrites: WeakSet<object>
  now: () => string
}) {
  const read = async (request: { caseRef: CaseRef }, context: TrustedDomainContext): Promise<PortResult<PortfolioSelection>> => {
    try {
      const source = input.host.requestFor(context)
      if (!source || !await input.host.revalidate(context)) return { status: "denied", reason: "selection-access-unavailable" }
      const readState = () => input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[selectionKey(request.caseRef)] : undefined)
      const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      if (current.status !== "ok" || !allowed(current.value, request.caseRef, context) || !await input.authorizeCase(current.value!, context)) return { status: "denied", reason: "selection-access-unavailable" }
      const saved = await readState()
      if (saved.status !== "ok") return { status: "unavailable", reason: "selection-unavailable" }
      if (saved.value === undefined) return await input.host.revalidate(context) ? { status: "needs-input", reason: "selection-not-created" } : { status: "denied", reason: "selection-access-unavailable" }
      if (!isSelection(saved.value)) return { status: "unavailable", reason: "selection-unavailable" }
      const selection = saved.value
      if (selection.selectionDigest !== selectionDigest(selection) || digestSfValue(selection.caseRef) !== digestSfValue(request.caseRef)) return { status: "stale", reason: "selection-changed" }
      const compare = () => input.compare({ caseRef: request.caseRef, baselineAlternativeId: selection.baselineAlternativeId, alternativeId: selection.alternativeId, criteria: selection.criteria }, context)
      const first = await compare()
      const again = await readState()
      const second = await compare()
      if (first.status !== "ok" || second.status !== "ok" || first.value.request.scenarioRefs[0] !== selection.baselineRef || first.value.request.scenarioRefs[1] !== selection.alternativeRef || digestSfValue(first.value) !== selection.comparisonDigest || digestSfValue(first.value) !== digestSfValue(second.value) || again.status !== "ok" || !isSelection(again.value) || digestSfValue(again.value) !== digestSfValue(selection) || !await input.authorizeCase(current.value!, context) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "selection-changed" }
      return { status: "ok", value: structuredClone(selection) }
    } catch { return { status: "unavailable", reason: "selection-unavailable" } }
  }
  const inspect = async (request: { caseRef: CaseRef }, context: TrustedDomainContext): Promise<PortResult<{ version: number; selection?: PortfolioSelection }>> => {
    try {
      const source = input.host.requestFor(context)
      if (!source || !await input.host.revalidate(context)) return { status: "denied", reason: "selection-access-unavailable" }
      const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      if (current.status !== "ok" || !allowed(current.value, request.caseRef, context) || !await input.authorizeCase(current.value!, context)) return { status: "denied", reason: "selection-access-unavailable" }
      const saved = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[selectionKey(request.caseRef)] : undefined)
      if (saved.status !== "ok" || saved.value !== undefined && !isSelection(saved.value)) return { status: "unavailable", reason: "selection-unavailable" }
      if (isSelection(saved.value) && saved.value.selectionDigest !== selectionDigest(saved.value)) return { status: "unavailable", reason: "selection-invalid" }
      const version = isSelection(saved.value) ? saved.value.version : 0
      const selection = saved.value === undefined ? undefined : await read(request, context)
      if (!await input.authorizeCase(current.value!, context) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "selection-access-unavailable" }
      return { status: "ok", value: selection?.status === "ok" ? { version, selection: selection.value } : { version } }
    } catch { return { status: "unavailable", reason: "selection-unavailable" } }
  }
  const register = async (incoming: PortfolioSelectionRequest, context: TrustedDomainContext): Promise<PortResult<PortfolioSelection>> => {
    try {
      if (context.kind !== "ui") return { status: "denied", reason: "human-selection-required" }
      const request = structuredClone(incoming)
      const source = input.host.requestFor(context)
      const operation = input.operationIdentity(context)
      if (!source || !operation || !Number.isSafeInteger(request.expectedVersion) || request.expectedVersion < 0 || !await input.authorizeSelection(request, context) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "selection-access-unavailable" }
      const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      const preferences = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? { active: state.preferences[selectionKey(request.caseRef)], prior: state.transactions[JSON.stringify([authority.principalRef, "preferences", request.caseRef.id, `portfolio-selection:${operation}`])] } : undefined)
      if (current.status !== "ok" || preferences.status !== "ok" || !preferences.value || !allowed(current.value, request.caseRef, context) || !await input.authorizeCase(current.value!, context)) return { status: "denied", reason: "selection-access-unavailable" }
      if (preferences.value.prior) {
        if (preferences.value.prior.commandDigest !== digestSfValue(request)) return { status: "conflict", reason: "idempotency-content-changed" }
        const saved = preferences.value.prior.value
        const verified = await read({ caseRef: request.caseRef }, context)
        if (verified.status !== "ok" || !saved || typeof saved !== "object" || !("selectionRef" in saved) || saved.selectionRef !== verified.value.selectionRef || !await input.authorizeSelection(request, context)) return { status: "unavailable", reason: "selection-unavailable" }
        return verified
      }
      if (preferences.value.active !== undefined && !isSelection(preferences.value.active)) return { status: "unavailable", reason: "selection-invalid" }
      const priorVersion = isSelection(preferences.value.active) ? preferences.value.active.version : 0
      if (priorVersion !== request.expectedVersion) return { status: "stale", reason: "selection-changed" }
      const compared = await input.compare(request, context)
      if (compared.status !== "ok") return compared
      const version = priorVersion + 1
      const selectionRef = `portfolio-selection:${digestSfValue({ caseRef: request.caseRef, operation, request })}`
      const value = { schema: "sf-portfolio-selection-v1" as const, selectionRef, caseRef: request.caseRef, baselineAlternativeId: request.baselineAlternativeId, alternativeId: request.alternativeId, baselineRef: compared.value.request.scenarioRefs[0]!, alternativeRef: compared.value.request.scenarioRefs[1]!, criteria: request.criteria, comparisonDigest: digestSfValue(compared.value), version, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, createdAt: input.now(), selectionDigest: "" }
      const selection: PortfolioSelection = { ...value, selectionDigest: selectionDigest(value) }
      if (!Number.isFinite(Date.parse(selection.createdAt)) || !await input.authorizeSelection(request, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "selection-access-unavailable" }
      const work = async (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => {
        const existing = state.preferences[selectionKey(request.caseRef)]
        if (!sameAuthority(authority, context) || !allowed(state.cases[request.caseRef.id], request.caseRef, context) || (isSelection(existing) ? existing.version : existing === undefined ? 0 : -1) !== priorVersion || !input.verifySnapshot(snapshot, request, selection, context)) return { commit: false, value: null }
        const history = `sf:criterion-rule:selection:history:${selectionRef}`
        if (state.preferences[history] !== undefined) return { commit: false, value: null }
        state.preferences[history] = selection
        state.preferences[selectionKey(request.caseRef)] = selection
        return { commit: true, value: selection }
      }
      input.proposalCoverageWrites.add(work)
      const saved = await input.state.transaction(source, { namespace: "preferences", domainSurface: "planner", expectedStorageVersion: preferences.storageVersion, additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: current.storageVersion }], targetRef: request.caseRef.id, targetIncarnation: request.caseRef.incarnation, idempotencyKey: `portfolio-selection:${operation}`, commandDigest: digestSfValue(request) }, work).finally(() => input.proposalCoverageWrites.delete(work))
      if (saved.status !== "ok" || !saved.value) return { status: saved.status === "preview" || saved.status === "conflict" ? "conflict" : "unavailable", reason: "selection-unavailable" }
      const verified = await read({ caseRef: request.caseRef }, context)
      if (verified.status !== "ok" || verified.value.selectionRef !== saved.value.selectionRef || !await input.authorizeSelection(request, context)) return { status: "unavailable", reason: "selection-unavailable" }
      return verified
    } catch { return { status: "unavailable", reason: "selection-unavailable" } }
  }
  return { register, read, inspect }
}
function sameAuthority(authority: SfStateAuthority, context: TrustedDomainContext) { return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision }
function allowed(value: DecisionCase | undefined, ref: CaseRef, context: TrustedDomainContext) { return !!value && value.id === ref.id && value.incarnation === ref.incarnation && value.version === ref.version && value.participants.includes(context.binding.principalRef) && (context.kind !== "native" || (context.binding.caseId === value.id && context.binding.caseIncarnation === value.incarnation && context.binding.caseVersion === value.version)) }
function selectionKey(ref: CaseRef) { return `sf:criterion-rule:selection:active:${digestSfValue({ id: ref.id, incarnation: ref.incarnation })}` }
function selectionDigest(value: PortfolioSelection) { return digestSfValue(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "selectionDigest"))) }
function isSelection(value: unknown): value is PortfolioSelection { if (!value || typeof value !== "object" || Array.isArray(value)) return false; const selection = value as Partial<PortfolioSelection>; return selection.schema === "sf-portfolio-selection-v1" && !!selection.caseRef && typeof selection.selectionRef === "string" && typeof selection.baselineRef === "string" && typeof selection.alternativeRef === "string" && typeof selection.baselineAlternativeId === "string" && typeof selection.alternativeId === "string" && Array.isArray(selection.criteria) && Number.isSafeInteger(selection.version) && typeof selection.comparisonDigest === "string" && typeof selection.selectionDigest === "string" }
