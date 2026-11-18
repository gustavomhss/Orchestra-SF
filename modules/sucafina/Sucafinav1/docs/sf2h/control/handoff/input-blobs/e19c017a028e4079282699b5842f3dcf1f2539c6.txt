import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { PortfolioRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../contracts/state.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import type { createSfDecisionResultStore, StoredDecisionResult } from "./result-store.ts"
import type { createDecisionPortfolioSelection } from "./portfolio-selection.ts"

type CaseRef = { id: string; incarnation: string; version: number }
export type PortfolioProof = { candidates: readonly { ref: string; digest: string }[]; selectionDigest: string }
export type PortfolioBinding = { schema: "sf-portfolio-binding-v1"; caseRef: CaseRef; resultRef: string; resultDigest: string; request: PortfolioRequest; requestDigest: string; proof: PortfolioProof; createdAt: string; bindingDigest: string }

/** Capture candidate and human-selection evidence before computing a portfolio. */
export function createPortfolioResultBindings(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  results: ReturnType<typeof createSfDecisionResultStore>
  selection: ReturnType<typeof createDecisionPortfolioSelection>
  resolveCandidate: (ref: string, context: TrustedDomainContext) => Promise<PortResult<unknown>>
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  verifyBinding: (binding: PortfolioBinding, result: StoredDecisionResult, context: TrustedDomainContext) => Promise<boolean>
  verifySnapshot: (snapshot: Snapshot, binding: PortfolioBinding, context: TrustedDomainContext) => boolean
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  proposalCoverageWrites: WeakSet<object>
  now: () => string
}) {
  const proofs = async (request: { caseRef: CaseRef; request: PortfolioRequest }, context: TrustedDomainContext): Promise<PortResult<PortfolioProof>> => {
    if (!decodeSfOperationInput("sf_portfolio_evaluate", request.request).ok || new Set(request.request.candidateRefs).size !== request.request.candidateRefs.length) return { status: "needs-input", reason: "portfolio-input-invalid" }
    const selection = await input.selection.read({ caseRef: request.caseRef }, context)
    const candidates = await Promise.all(request.request.candidateRefs.map((ref) => input.resolveCandidate(ref, context)))
    if (selection.status !== "ok" || digestSfValue(selection.value.criteria) !== digestSfValue(request.request.constraints) || candidates.some((candidate) => candidate.status !== "ok")) return { status: "unavailable", reason: "portfolio-proof-unavailable" }
    return { status: "ok", value: { selectionDigest: selection.value.selectionDigest, candidates: candidates.map((candidate, index) => ({ ref: request.request.candidateRefs[index]!, digest: digestSfValue(candidate.status === "ok" ? candidate.value : null) })) } }
  }
  const validate = async (binding: PortfolioBinding, context: TrustedDomainContext) => {
    const result = await input.results.read({ resultRef: binding.resultRef, kind: "portfolio" }, context)
    const current = await proofs({ caseRef: binding.caseRef, request: binding.request }, context)
    if (result.status !== "ok" || result.value.kind !== "portfolio" || result.value.requestDigest !== binding.requestDigest || result.value.resultDigest !== binding.resultDigest || digestSfValue(result.value.caseRef) !== digestSfValue(binding.caseRef) || current.status !== "ok" || digestSfValue(current.value) !== digestSfValue(binding.proof) || !await input.verifyBinding(binding, result.value, context)) return undefined
    return result.value
  }
  const read = async (request: { caseRef: CaseRef; resultRef: string }, context: TrustedDomainContext): Promise<PortResult<PortfolioBinding>> => {
    try {
      const source = input.host.requestFor(context)
      if (!source || !request.resultRef.trim() || !await input.host.revalidate(context)) return { status: "denied", reason: "portfolio-binding-access-unavailable" }
      const load = () => input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[key(request.resultRef)] : undefined)
      const saved = await load()
      if (saved.status !== "ok" || !isBinding(saved.value)) return { status: "unavailable", reason: "portfolio-binding-unavailable" }
      const binding = saved.value
      if (binding.resultRef !== request.resultRef || digestSfValue(binding.caseRef) !== digestSfValue(request.caseRef) || binding.bindingDigest !== bindingDigest(binding) || binding.requestDigest !== digestSfValue(binding.request)) return { status: "unavailable", reason: "portfolio-binding-invalid" }
      const first = await validate(binding, context)
      const again = await load()
      const second = await validate(binding, context)
      if (!first || !second || digestSfValue(first) !== digestSfValue(second) || again.status !== "ok" || !isBinding(again.value) || digestSfValue(again.value) !== digestSfValue(binding) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "portfolio-source-changed" }
      return { status: "ok", value: structuredClone(binding) }
    } catch { return { status: "unavailable", reason: "portfolio-binding-unavailable" } }
  }
  const list = async (request: { caseRef: CaseRef }, context: TrustedDomainContext): Promise<PortResult<readonly { resultRef: string; createdAt: string }[]>> => {
    try {
      const source = input.host.requestFor(context)
      if (!source || !await input.host.revalidate(context)) return { status: "denied", reason: "portfolio-list-access-unavailable" }
      const load = () => input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? { current: state.cases[request.caseRef.id], results: Object.values(state.decisionResults ?? {}).filter((result) => result.kind === "portfolio" && digestSfValue(result.caseRef) === digestSfValue(request.caseRef)) } : undefined)
      const current = await load()
      if (current.status !== "ok" || !current.value || !allowed(current.value.current, request.caseRef, context) || !await input.authorizeCase(current.value.current!, context)) return { status: "denied", reason: "portfolio-list-access-unavailable" }
      const preferences = await input.state.read(source, "preferences", (_state, authority) => sameAuthority(authority, context))
      if (preferences.status !== "ok" || !preferences.value) return { status: "denied", reason: "portfolio-list-access-unavailable" }
      const checked = await Promise.all(current.value.results.map(async (result) => ({ result, binding: await read({ caseRef: request.caseRef, resultRef: result.resultRef }, context) })))
      const again = await load()
      const preferencesAgain = await input.state.read(source, "preferences", (_state, authority) => sameAuthority(authority, context))
      if (preferencesAgain.status !== "ok" || !preferencesAgain.value || preferencesAgain.storageVersion !== preferences.storageVersion || again.status !== "ok" || !again.value || again.storageVersion !== current.storageVersion || digestSfValue(again.value) !== digestSfValue(current.value) || !await input.authorizeCase(again.value.current!, context) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "portfolio-list-changed" }
      return { status: "ok", value: checked.flatMap((item) => item.binding.status === "ok" ? [{ resultRef: item.result.resultRef, createdAt: item.result.createdAt }] : []) }
    } catch { return { status: "unavailable", reason: "portfolio-list-unavailable" } }
  }
  const bind = async (incoming: { caseRef: CaseRef; resultRef: string; request: PortfolioRequest; expectedProof: PortfolioProof }, context: TrustedDomainContext): Promise<PortResult<PortfolioBinding>> => {
    try {
      const request = structuredClone(incoming)
      const source = input.host.requestFor(context)
      const operation = input.operationIdentity(context)
      if (!source || !operation || !request.resultRef.trim() || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "portfolio-binding-access-unavailable" }
      const cases = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      const preferences = await input.state.read(source, "preferences", (_state, authority) => sameAuthority(authority, context))
      if (cases.status !== "ok" || preferences.status !== "ok" || !preferences.value || !allowed(cases.value, request.caseRef, context) || !await input.authorizeCase(cases.value!, context)) return { status: "denied", reason: "portfolio-binding-access-unavailable" }
      const proof = await proofs(request, context)
      const result = await input.results.read({ resultRef: request.resultRef, kind: "portfolio" }, context)
      if (proof.status !== "ok" || digestSfValue(proof.value) !== digestSfValue(request.expectedProof) || result.status !== "ok" || result.value.kind !== "portfolio" || result.value.requestDigest !== digestSfValue(request.request) || digestSfValue(result.value.caseRef) !== digestSfValue(request.caseRef)) return { status: "conflict", reason: "portfolio-binding-mismatch" }
      const stored = result.value
      const value = { schema: "sf-portfolio-binding-v1" as const, caseRef: request.caseRef, resultRef: request.resultRef, resultDigest: stored.resultDigest, request: request.request, requestDigest: stored.requestDigest, proof: proof.value, createdAt: input.now(), bindingDigest: "" }
      const binding = { ...value, bindingDigest: bindingDigest(value) }
      if (!Number.isFinite(Date.parse(binding.createdAt)) || !await validate(binding, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "portfolio-binding-unavailable" }
      const work = async (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => {
        if (!sameAuthority(authority, context) || !allowed(state.cases[request.caseRef.id], request.caseRef, context) || !state.decisionResults?.[request.resultRef] || digestSfValue(state.decisionResults[request.resultRef]) !== digestSfValue(stored) || state.preferences[key(request.resultRef)] !== undefined || !matchesSelection(state, request.caseRef, binding.proof.selectionDigest) || !input.verifySnapshot(snapshot, binding, context)) return { commit: false, value: null }
        state.preferences[key(request.resultRef)] = binding
        return { commit: true, value: binding }
      }
      input.proposalCoverageWrites.add(work)
      const saved = await input.state.transaction(source, { namespace: "preferences", domainSurface: "planner", expectedStorageVersion: preferences.storageVersion, additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: cases.storageVersion }], targetRef: request.caseRef.id, targetIncarnation: request.caseRef.incarnation, idempotencyKey: `portfolio-binding:${operation}`, commandDigest: digestSfValue(request) }, work).finally(() => input.proposalCoverageWrites.delete(work))
      if (saved.status !== "ok" || !saved.value) return { status: saved.status === "preview" || saved.status === "conflict" ? "conflict" : "unavailable", reason: "portfolio-binding-unavailable" }
      return read({ caseRef: request.caseRef, resultRef: request.resultRef }, context)
    } catch { return { status: "unavailable", reason: "portfolio-binding-unavailable" } }
  }
  return { proofs, bind, read, list }
}
function sameAuthority(authority: SfStateAuthority, context: TrustedDomainContext) { return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision }
function allowed(value: DecisionCase | undefined, ref: CaseRef, context: TrustedDomainContext) { return !!value && value.id === ref.id && value.incarnation === ref.incarnation && value.version === ref.version && value.participants.includes(context.binding.principalRef) && (context.kind !== "native" || (context.binding.caseId === value.id && context.binding.caseIncarnation === value.incarnation && context.binding.caseVersion === value.version)) }
function key(ref: string) { return `sf:criterion-rule:portfolio:${digestSfValue(ref)}` }
function bindingDigest(value: PortfolioBinding) { return digestSfValue(Object.fromEntries(Object.entries(value).filter(([name]) => name !== "bindingDigest"))) }
function isBinding(value: unknown): value is PortfolioBinding { if (!value || typeof value !== "object" || Array.isArray(value)) return false; const binding = value as Partial<PortfolioBinding>; return binding.schema === "sf-portfolio-binding-v1" && !!binding.caseRef && typeof binding.resultRef === "string" && typeof binding.resultDigest === "string" && !!binding.request && typeof binding.requestDigest === "string" && !!binding.proof && typeof binding.bindingDigest === "string" }

function matchesSelection(state: SfProductState, ref: CaseRef, digest: string) { const value = state.preferences[`sf:criterion-rule:selection:active:${digestSfValue({ id: ref.id, incarnation: ref.incarnation })}`]; return !!value && typeof value === "object" && "selectionDigest" in value && value.selectionDigest === digest }
