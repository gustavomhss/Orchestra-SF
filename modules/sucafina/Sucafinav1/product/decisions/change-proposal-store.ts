import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { PreparedCommand } from "../contracts/context.ts"
import type { DecisionCase, ScenarioResult } from "../contracts/decisions.ts"
import type { ChangePrepareRequest } from "../contracts/operations.ts"
import type { SfOperationOutputMap, UnresolvedCondition } from "../contracts/outputs.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../contracts/state.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import { encodeCaseRef } from "./case-port.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type Change = { command: PreparedCommand; preview: ScenarioResult; previewRef: string; targetEvidence: Extract<BusinessEvidenceRef, { kind: "record" }> }
export type StoredChangeProposal = { schema: "sf-change-proposal-v1"; proposalRef: string; caseRef: CaseRef; request: ChangePrepareRequest; requestDigest: string; output: SfOperationOutputMap["sf_change_prepare"]; changes: readonly Change[]; principalRef: string; accessRevision: string; policyVersion: string; createdAt: string; recordDigest: string }

/** Store proposals and their private command provenance; this never executes a domain command. */
export function createChangeProposalStore(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  authorizeProposal: (request: ChangePrepareRequest, output: SfOperationOutputMap["sf_change_prepare"], context: TrustedDomainContext) => Promise<boolean>
  verifySources: (proposal: StoredChangeProposal, context: TrustedDomainContext) => Promise<boolean>
  verifySnapshot: (snapshot: Snapshot, proposal: StoredChangeProposal, context: TrustedDomainContext) => boolean
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  proposalCoverageWrites: WeakSet<object>
  now: () => string
}) {
  const read = async (request: { caseRef: CaseRef; changeRef: string }, context: TrustedDomainContext): Promise<PortResult<{ change: SfOperationOutputMap["sf_change_prepare"]["changes"][number]; caseRef: CaseRef }>> => {
    try {
      const source = input.host.requestFor(context)
      if (!source || !request.changeRef.trim() || !await input.host.revalidate(context)) return { status: "denied", reason: "change-proposal-access-unavailable" }
      const load = () => input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? Object.entries(state.preferences).filter(([name]) => name.startsWith("sf:proposal-coverage:change:")).map(([, value]) => value).filter(isProposal).filter((value) => value.output.changes.some((item) => item.changeRef === request.changeRef)) : undefined)
      const readCase = () => input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      const current = await readCase()
      const records = await load()
      if (current.status !== "ok" || !allowed(current.value, request.caseRef, context) || !await input.authorizeCase(current.value!, context) || records.status !== "ok" || records.value?.length !== 1) return { status: "unavailable", reason: "change-proposal-unavailable" }
      const proposal = records.value[0]!
      if (digestSfValue(proposal.caseRef) !== digestSfValue(request.caseRef) || proposal.recordDigest !== recordDigest(proposal) || proposal.requestDigest !== digestSfValue(proposal.request) || !decodeSfOperationInput("sf_change_prepare", proposal.request).ok || !decodeSfOperationOutput("sf_change_prepare", proposal.output).ok || !await input.verifySources(proposal, context) || !await input.authorizeProposal(proposal.request, proposal.output, context)) return { status: "unavailable", reason: "change-proposal-evidence-unavailable" }
      const again = await readCase()
      const recordsAgain = await load()
      if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(current.value) || !allowed(again.value, request.caseRef, context) || !await input.authorizeCase(again.value!, context) || recordsAgain.status !== "ok" || digestSfValue(recordsAgain.value) !== digestSfValue(records.value) || !await input.verifySources(proposal, context) || !await input.authorizeProposal(proposal.request, proposal.output, context) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "change-proposal-changed" }
      const selected = proposal.output.changes.filter((item) => item.changeRef === request.changeRef)
      if (selected.length !== 1) return { status: "unavailable", reason: "change-proposal-unavailable" }
      return { status: "ok", value: { caseRef: structuredClone(proposal.caseRef), change: structuredClone(selected[0]!) } }
    } catch { return { status: "unavailable", reason: "change-proposal-unavailable" } }
  }
  const readSet = async (request: { caseRef: CaseRef; changeRefs: readonly string[] }, context: TrustedDomainContext): Promise<PortResult<{ request: ChangePrepareRequest; output: SfOperationOutputMap["sf_change_prepare"] }>> => {
    try {
      const source = input.host.requestFor(context)
      if (!source || !request.changeRefs.length || request.changeRefs.some((ref) => !ref.trim()) || new Set(request.changeRefs).size !== request.changeRefs.length || !await input.host.revalidate(context)) return { status: "denied", reason: "change-proposal-access-unavailable" }
      const load = () => input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? Object.entries(state.preferences).filter(([name]) => name.startsWith("sf:proposal-coverage:change:")).map(([, value]) => value).filter(isProposal).filter((value) => digestSfValue(value.caseRef) === digestSfValue(request.caseRef) && value.output.changes.length === request.changeRefs.length && value.output.changes.every((item) => request.changeRefs.includes(item.changeRef))) : undefined)
      const found = await load()
      if (found.status !== "ok" || found.value?.length !== 1) return { status: "unavailable", reason: "change-proposal-set-unavailable" }
      const proposal = found.value[0]!
      if (new Set(proposal.output.changes.map((item) => item.changeRef)).size !== proposal.output.changes.length || proposal.recordDigest !== recordDigest(proposal) || proposal.requestDigest !== digestSfValue(proposal.request)) return { status: "unavailable", reason: "change-proposal-invalid" }
      const checked = await Promise.all(proposal.output.changes.map((item) => read({ caseRef: request.caseRef, changeRef: item.changeRef }, context)))
      if (checked.some((item, index) => item.status !== "ok" || digestSfValue(item.value.change) !== digestSfValue(proposal.output.changes[index]))) return { status: "unavailable", reason: "change-proposal-evidence-unavailable" }
      const again = await load()
      if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(found.value) || !await input.verifySources(proposal, context) || !await input.authorizeProposal(proposal.request, proposal.output, context) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "change-proposal-changed" }
      return { status: "ok", value: { request: structuredClone(proposal.request), output: structuredClone(proposal.output) } }
    } catch { return { status: "unavailable", reason: "change-proposal-unavailable" } }
  }
  const readByRequest = async (request: { caseRef: CaseRef; request: ChangePrepareRequest }, context: TrustedDomainContext): Promise<PortResult<{ state: "found"; output: SfOperationOutputMap["sf_change_prepare"] } | { state: "not-found" }>> => {
    try {
      const source = input.host.requestFor(context)
      const operation = input.operationIdentity(context)
      if (!source || !operation || request.request.caseRef !== encodeCaseRef(request.caseRef) || !decodeSfOperationInput("sf_change_prepare", request.request).ok || !await input.host.revalidate(context)) return { status: "denied", reason: "change-proposal-access-unavailable" }
      const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      const prior = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.transactions[JSON.stringify([authority.principalRef, "preferences", request.caseRef.id, `change-proposal:${operation}`])] : undefined)
      if (current.status !== "ok" || !allowed(current.value, request.caseRef, context) || !await input.authorizeCase(current.value!, context) || prior.status !== "ok") return { status: "denied", reason: "change-proposal-access-unavailable" }
      if (!prior.value) {
        const again = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.transactions[JSON.stringify([authority.principalRef, "preferences", request.caseRef.id, `change-proposal:${operation}`])] : undefined)
        const currentAgain = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
        if (again.status !== "ok" || again.value || currentAgain.status !== "ok" || !allowed(currentAgain.value, request.caseRef, context) || digestSfValue(currentAgain.value) !== digestSfValue(current.value) || !await input.authorizeCase(currentAgain.value!, context) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "change-proposal-changed" }
        return { status: "ok", value: { state: "not-found" } }
      }
      const proposal = prior.value.value
      if (!isProposal(proposal) || prior.value.targetIncarnation !== request.caseRef.incarnation || digestSfValue(proposal.caseRef) !== digestSfValue(request.caseRef) || proposal.requestDigest !== digestSfValue(request.request)) return { status: "conflict", reason: "idempotency-content-changed" }
      const checked = await Promise.all(proposal.output.changes.map((item) => read({ caseRef: request.caseRef, changeRef: item.changeRef }, context)))
      if (!checked.length || checked.some((item) => item.status !== "ok") || !await input.verifySources(proposal, context) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "change-proposal-unavailable" }
      return { status: "ok", value: { state: "found", output: structuredClone(proposal.output) } }
    } catch { return { status: "unavailable", reason: "change-proposal-unavailable" } }
  }
  const readCommand = async (request: { caseRef: CaseRef; changeRef: string; operationRef: string }, context: TrustedDomainContext): Promise<PortResult<{ command: PreparedCommand; previewRef: string }>> => {
    try {
      const verified = await read({ caseRef: request.caseRef, changeRef: request.changeRef }, context)
      const source = input.host.requestFor(context)
      if (verified.status !== "ok" || !source || verified.value.change.operationRef !== request.operationRef) return { status: "denied", reason: "change-proposal-access-unavailable" }
      const found = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? Object.entries(state.preferences).filter(([name]) => name.startsWith("sf:proposal-coverage:change:")).map(([, value]) => value).filter(isProposal).filter((value) => value.output.changes.some((item) => item.changeRef === request.changeRef && item.operationRef === request.operationRef)) : undefined)
      if (found.status !== "ok" || found.value?.length !== 1) return { status: "unavailable", reason: "change-proposal-unavailable" }
      const proposal = found.value[0]!
      const index = proposal.output.changes.findIndex((item) => item.changeRef === request.changeRef && item.operationRef === request.operationRef)
      const selected = proposal.changes[index]
      if (index < 0 || !selected || proposal.recordDigest !== recordDigest(proposal) || digestSfValue(proposal.caseRef) !== digestSfValue(request.caseRef) || !await input.verifySources(proposal, context) || !await input.authorizeProposal(proposal.request, proposal.output, context)) return { status: "unavailable", reason: "change-proposal-evidence-unavailable" }
      const again = await read({ caseRef: request.caseRef, changeRef: request.changeRef }, context)
      if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(verified.value) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "change-proposal-changed" }
      return { status: "ok", value: { command: structuredClone(selected.command), previewRef: selected.previewRef } }
    } catch { return { status: "unavailable", reason: "change-proposal-unavailable" } }
  }
  const register = async (incoming: { caseRef: CaseRef; request: ChangePrepareRequest; changes: readonly Change[]; conditions: readonly UnresolvedCondition[] }, context: TrustedDomainContext): Promise<PortResult<SfOperationOutputMap["sf_change_prepare"]>> => {
    try {
      const request = structuredClone(incoming)
      const source = input.host.requestFor(context)
      const operation = input.operationIdentity(context)
      if (!source || !operation || !decodeSfOperationInput("sf_change_prepare", request.request).ok || request.request.caseRef !== encodeCaseRef(request.caseRef) || !request.changes.length || request.changes.some((item) => !item.previewRef.trim() || !item.command.id.trim()) || !await input.host.revalidate(context)) return { status: "denied", reason: "change-proposal-access-unavailable" }
      const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      const preferences = await input.state.read(source, "preferences", (_state, authority) => sameAuthority(authority, context))
      if (current.status !== "ok" || !allowed(current.value, request.caseRef, context) || !await input.authorizeCase(current.value!, context) || !current.value!.choices.some((choice) => choice.id === request.request.choiceRef) || preferences.status !== "ok" || !preferences.value) return { status: "denied", reason: "change-proposal-access-unavailable" }
      const proposalRef = `change-proposal:${digestSfValue({ caseRef: request.caseRef, operation, request: request.request })}`
      const changes = request.changes.map((item, index) => { const ref = digestSfValue({ proposalRef, index, command: item.command.commandDigest }); return { changeRef: `proposed-change:${ref}`, targetRef: item.targetEvidence, expectedVersion: item.command.expectedVersion, operationRef: `proposed-operation:${ref}`, previewRef: item.previewRef, requiredAuthority: item.command.requiredAuthority } })
      const output: SfOperationOutputMap["sf_change_prepare"] = { caseRef: request.request.caseRef, caseVersion: request.caseRef.version, changes, conditions: request.conditions }
      if (!decodeSfOperationOutput("sf_change_prepare", output).ok) return { status: "unavailable", reason: "change-proposal-invalid" }
      const value = { schema: "sf-change-proposal-v1" as const, proposalRef, caseRef: request.caseRef, request: request.request, requestDigest: digestSfValue(request.request), output, changes: request.changes, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, createdAt: input.now(), recordDigest: "" }
      const proposal = { ...value, recordDigest: recordDigest(value) }
      if (!Number.isFinite(Date.parse(proposal.createdAt)) || !await input.verifySources(proposal, context) || !await input.authorizeProposal(proposal.request, proposal.output, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "change-proposal-evidence-unavailable" }
      const work = async (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => {
        const choice = state.cases[request.caseRef.id]?.choices.find((item) => item.id === request.request.choiceRef)
        if (!sameAuthority(authority, context) || !allowed(state.cases[request.caseRef.id], request.caseRef, context) || !choice || new Set(request.changes.map((item) => item.command.idempotencyKey)).size !== request.changes.length || request.changes.some((item) => {
          const stored = state.decisionResults?.[item.previewRef]
          const target = item.command.target
          const evidence = item.targetEvidence
          return !stored || stored.kind !== "scenario" || stored.caseRef.id !== request.caseRef.id || stored.caseRef.incarnation !== request.caseRef.incarnation || stored.caseRef.version > request.caseRef.version || stored.requestDigest !== digestSfValue(choice.scenario) || stored.resultDigest !== digestSfValue(choice.result) || stored.resultDigest !== digestSfValue(item.preview) || evidence.installationId !== context.binding.installationId || evidence.projectId !== context.binding.projectId || evidence.target.surface !== target.surface || evidence.target.recordType !== target.type || evidence.target.recordId !== target.id || evidence.target.incarnation !== target.incarnation || evidence.target.version !== target.version || !evidence.target.period || evidence.target.period.start > target.period.start || evidence.target.period.end < target.period.end || target.fields.some((field) => !evidence.target.fields.includes(field))
        }) || state.preferences[key(proposalRef)] !== undefined || !input.verifySnapshot(snapshot, proposal, context)) return { commit: false, value: null }
        state.preferences[key(proposalRef)] = proposal
        return { commit: true, value: proposal }
      }
      input.proposalCoverageWrites.add(work)
      const saved = await input.state.transaction(source, { namespace: "preferences", domainSurface: "planner", expectedStorageVersion: preferences.storageVersion, additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: current.storageVersion }], targetRef: request.caseRef.id, targetIncarnation: request.caseRef.incarnation, idempotencyKey: `change-proposal:${operation}`, commandDigest: digestSfValue(request) }, work).finally(() => input.proposalCoverageWrites.delete(work))
      if (saved.status !== "ok" || !saved.value) return { status: saved.status === "conflict" || saved.status === "preview" ? "conflict" : "unavailable", reason: "change-proposal-unavailable" }
      const checked = await Promise.all(saved.value.output.changes.map((item) => read({ caseRef: request.caseRef, changeRef: item.changeRef }, context)))
      if (checked.some((item) => item.status !== "ok") || !await input.host.revalidate(context)) return { status: "unavailable", reason: "change-proposal-evidence-unavailable" }
      return { status: "ok", value: structuredClone(saved.value.output) }
    } catch { return { status: "unavailable", reason: "change-proposal-unavailable" } }
  }
  return { register, read, readSet, readByRequest, readCommand }
}
function sameAuthority(authority: SfStateAuthority, context: TrustedDomainContext) { return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision }
function allowed(value: DecisionCase | undefined, ref: CaseRef, context: TrustedDomainContext) { return !!value && value.id === ref.id && value.incarnation === ref.incarnation && value.version === ref.version && value.participants.includes(context.binding.principalRef) && (context.kind !== "native" || (context.binding.caseId === value.id && context.binding.caseIncarnation === value.incarnation && context.binding.caseVersion === value.version)) }
function key(ref: string) { return `sf:proposal-coverage:change:${digestSfValue(ref)}` }
function recordDigest(value: StoredChangeProposal) { return digestSfValue(Object.fromEntries(Object.entries(value).filter(([name]) => name !== "recordDigest"))) }
function isProposal(value: unknown): value is StoredChangeProposal { if (!value || typeof value !== "object" || Array.isArray(value)) return false; const proposal = value as Partial<StoredChangeProposal>; return proposal.schema === "sf-change-proposal-v1" && typeof proposal.proposalRef === "string" && !!proposal.caseRef && !!proposal.request && typeof proposal.requestDigest === "string" && !!proposal.output && Array.isArray(proposal.changes) && typeof proposal.recordDigest === "string" }
