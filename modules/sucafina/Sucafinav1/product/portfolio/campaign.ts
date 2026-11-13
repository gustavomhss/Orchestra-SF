import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { DomainProjection, Period } from "../contracts/context.ts"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { ContractReadRequest } from "../contracts/operations.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../contracts/state.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import { parseCaseRef } from "../decisions/case-port.ts"
import type { createDecisionCandidateResolver } from "./candidates.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type Fences = { dashboard: string; planner: string; procurement: string }
type Candidate = { ref: string; selectionOrder: number; caseRef: CaseRef; candidateDigest: string }
type StoredCommitment = { kind: "contract" | "project"; recordId: string; fields: readonly string[]; period?: Period; page?: string; sourceRef: string; projectionFingerprint: string }
export type PortfolioCampaign = {
  schema: "sf-portfolio-campaign-v1"
  campaignRef: string
  ownerCase: CaseRef
  commandDigest: string
  candidates: readonly Candidate[]
  constraints: readonly string[]
  scope: { horizon: Period; currency: string }
  explorationLimit: number
  proposals: readonly { outputRef: string; outputDigest: string; state: "provisional" }[]
  commitments: readonly StoredCommitment[]
  sourceFingerprint: string
  version: number
  principalRef: string
  accessRevision: string
  policyVersion: string
  createdAt: string
  campaignDigest: string
}
export type PortfolioCampaignEdit = {
  ownerCase: CaseRef
  expectedVersion: number
  candidateRefs: readonly { ref: string; selectionOrder: number }[]
  constraints: readonly string[]
  scope: { horizon: Period; currency: string }
  explorationLimit: number
  proposalRefs: readonly string[]
  commitments: readonly (
    | { kind: "contract"; id: string; fields: readonly string[]; period: Period }
    | { kind: "project"; page: string; recordId: string; fields: readonly string[]; period: Period }
  )[]
}

/** Selection order is only the human review sequence. It is not an objective weight. */
export function createPortfolioCampaign(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  cases: Pick<DecisionCasePort, "read">
  resolveCandidate: ReturnType<typeof createDecisionCandidateResolver>
  validateCandidate: (candidate: import("./port.ts").PortfolioCandidate, context: TrustedDomainContext) => Promise<PortResult<true>>
  contracts: { issueContract: (selection: { id: string; fields: readonly string[]; period: Period }, context: TrustedDomainContext) => Promise<PortResult<string>>; readContractSource: (request: ContractReadRequest, context: TrustedDomainContext) => Promise<PortResult<DomainProjection>> }
  records: { issue: (selection: { page: string; recordType: "projects"; recordId: string; fields: readonly string[]; period: Period }, context: TrustedDomainContext) => Promise<PortResult<import("../contracts/business-context.ts").BusinessEvidenceRef & { kind: "record" }>>; read: (reference: string, context: TrustedDomainContext) => Promise<PortResult<DomainProjection>> }
  readSourceFences: (context: TrustedDomainContext) => Promise<Fences | undefined>
  lockedSourceFences: () => Fences | undefined
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  verifyProposal?: (proposalRef: string, context: TrustedDomainContext) => Promise<PortResult<{ outputDigest: string }>>
  verifyHistoricalProposal?: (proposalRef: string, context: TrustedDomainContext) => Promise<PortResult<{ outputDigest: string }>>
  proposalCoverageWrites: WeakSet<object>
  now: () => string
}) {
  const owner = async (ownerCase: CaseRef, context: TrustedDomainContext) => {
    const decision = await input.cases.read({ caseRef: `case:${encodeURIComponent(ownerCase.id)}:${encodeURIComponent(ownerCase.incarnation)}` }, context)
    if (decision.status !== "ok") return decision
    if (!allowed(decision.value.case, ownerCase, context)) return { status: "denied" as const, reason: "campaign-access-unavailable" }
    return decision
  }
  const prove = async (campaign: PortfolioCampaign, context: TrustedDomainContext): Promise<PortResult<true>> => {
    const before = await input.readSourceFences(context)
    if (!before || digestSfValue(before) !== campaign.sourceFingerprint) return { status: "stale", reason: "campaign-source-changed" }
    for (const candidate of campaign.candidates) {
      const resolved = await input.resolveCandidate(candidate.ref, context)
      if (resolved.status !== "ok") return resolved
      const supported = await input.validateCandidate(resolved.value, context)
      if (supported.status !== "ok" || supported.value !== true) return { status: "unavailable", reason: "campaign-candidate-unavailable" }
      const parsed = parseCaseRef(resolved.value.caseRef)
      const pinned = pinnedCase(candidate.ref)
      if (!parsed || !pinned || parsed.id !== candidate.caseRef.id || parsed.incarnation !== candidate.caseRef.incarnation || pinned.version !== candidate.caseRef.version || digestSfValue(resolved.value) !== candidate.candidateDigest) return { status: "stale", reason: "candidate-case-changed" }
      const again = await input.resolveCandidate(candidate.ref, context)
      if (again.status !== "ok" || digestSfValue(again.value) !== candidate.candidateDigest) return { status: "stale", reason: "candidate-case-changed" }
    }
    for (const proposal of campaign.proposals) {
      if (!input.verifyProposal) return { status: "unavailable", reason: "campaign-proposal-unavailable" }
      const current = await input.verifyProposal(proposal.outputRef, context)
      if (current.status !== "ok" || current.value.outputDigest !== proposal.outputDigest) return { status: "stale", reason: "campaign-proposal-changed" }
    }
    for (const commitment of campaign.commitments) {
      const projection = commitment.kind === "contract" ? await input.contracts.readContractSource({ contractRef: commitment.sourceRef, fields: commitment.fields }, context) : await input.records.read(commitment.sourceRef, context)
      if (projection.status !== "ok") return projection
      if (projectionFingerprint(projection.value) !== commitment.projectionFingerprint) return { status: "stale", reason: "campaign-source-changed" }
    }
    const after = await input.readSourceFences(context)
    if (!after || digestSfValue(after) !== campaign.sourceFingerprint || !await input.host.revalidate(context)) return { status: "stale", reason: "campaign-source-changed" }
    return { status: "ok", value: true }
  }
  const readOriginal = async (request: { ownerCase: CaseRef; commandDigest: string }, context: TrustedDomainContext): Promise<PortResult<PortfolioCampaign>> => {
    const source = input.host.requestFor(context)
    const decision = await owner(request.ownerCase, context)
    if (!source || !request.commandDigest.trim() || decision.status !== "ok") return decision.status === "ok" ? { status: "denied", reason: "campaign-access-unavailable" } : decision
    const stored = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[historyKey(request.commandDigest)] : undefined)
    if (stored.status !== "ok" || !isCampaign(stored.value) || stored.value.commandDigest !== request.commandDigest || stored.value.campaignDigest !== campaignDigest(stored.value) || digestSfValue(stored.value.ownerCase) !== digestSfValue(request.ownerCase)) return { status: "unavailable", reason: "campaign-original-unavailable" }
    const proof = await prove(stored.value, context)
    if (proof.status !== "ok") return proof
    const again = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[historyKey(request.commandDigest)] : undefined)
    if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(stored.value) || (await owner(request.ownerCase, context)).status !== "ok" || !await input.host.revalidate(context)) return { status: "stale", reason: "campaign-source-changed" }
    return { status: "ok", value: structuredClone(stored.value) }
  }
  const read = async (ownerCase: CaseRef, context: TrustedDomainContext): Promise<PortResult<PortfolioCampaign>> => {
    const source = input.host.requestFor(context)
    const decision = await owner(ownerCase, context)
    if (!source || decision.status !== "ok") return decision.status === "ok" ? { status: "denied", reason: "campaign-access-unavailable" } : decision
    const stored = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[campaignKey(ownerCase)] : undefined)
    if (stored.status !== "ok") return { status: "unavailable", reason: "campaign-unavailable" }
    if (stored.value === undefined) return { status: "needs-input", reason: "campaign-not-created" }
    if (!isCampaign(stored.value) || stored.value.campaignDigest !== campaignDigest(stored.value) || digestSfValue(stored.value.ownerCase) !== digestSfValue(ownerCase)) return { status: "unavailable", reason: "campaign-invalid" }
    const proof = await prove(stored.value, context)
    if (proof.status !== "ok") return proof
    const again = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[campaignKey(ownerCase)] : undefined)
    if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(stored.value) || (await owner(ownerCase, context)).status !== "ok" || !await input.host.revalidate(context)) return { status: "stale", reason: "campaign-source-changed" }
    return { status: "ok", value: structuredClone(stored.value) }
  }
  const readHistorical = async (request: { ownerCase: CaseRef; commandDigest: string }, context: TrustedDomainContext): Promise<PortResult<{ state: "historical"; campaign: PortfolioCampaign }>> => {
    const source = input.host.requestFor(context)
    const decision = await owner(request.ownerCase, context)
    if (!source || decision.status !== "ok" || !/^[a-f0-9]{64}$/.test(request.commandDigest)) return { status: "denied", reason: "campaign-history-access-unavailable" }
    const load = () => input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[historyKey(request.commandDigest)] : undefined)
    const stored = await load()
    if (stored.status !== "ok" || !isCampaign(stored.value) || stored.value.commandDigest !== request.commandDigest || stored.value.campaignDigest !== campaignDigest(stored.value) || stored.value.ownerCase.id !== request.ownerCase.id || stored.value.ownerCase.incarnation !== request.ownerCase.incarnation || stored.value.ownerCase.version >= request.ownerCase.version) return { status: "unavailable", reason: "campaign-history-unavailable" }
    const campaign = stored.value
    const inspect = async () => {
      const candidates = await Promise.all(campaign.candidates.map(async (candidate) => {
        const current = await input.cases.read({ caseRef: `case:${encodeURIComponent(candidate.caseRef.id)}:${encodeURIComponent(candidate.caseRef.incarnation)}` }, context)
        if (current.status !== "ok" || current.value.case.id !== candidate.caseRef.id || current.value.case.incarnation !== candidate.caseRef.incarnation || current.value.case.version < candidate.caseRef.version) return false
        const match = /^portfolio-candidate:([^:]+):([1-9]\d*):([^:]+):([1-9]\d*)$/.exec(candidate.ref)
        if (!match) return false
        const identity = decodeURIComponent(match[3]!)
        const alternative = current.value.case.alternatives.find((item) => item.id === identity && item.version === Number(match[4]))
        return !!alternative && digestSfValue({ ref: candidate.ref, caseRef: `case:${encodeURIComponent(candidate.caseRef.id)}:${encodeURIComponent(candidate.caseRef.incarnation)}`, operations: alternative.scenario.operations, scenario: alternative.scenario, result: alternative.result }) === candidate.candidateDigest
      }))
      if (!candidates.every(Boolean)) return false
      for (const proposal of campaign.proposals) {
        if (!input.verifyHistoricalProposal) return false
        const verified = await input.verifyHistoricalProposal(proposal.outputRef, context)
        if (verified.status !== "ok" || verified.value.outputDigest !== proposal.outputDigest) return false
      }
      for (const commitment of campaign.commitments) {
        const projection = commitment.kind === "contract" ? await input.contracts.readContractSource({ contractRef: commitment.sourceRef, fields: commitment.fields }, context) : await input.records.read(commitment.sourceRef, context)
        if (projection.status !== "ok" || projectionFingerprint(projection.value) !== commitment.projectionFingerprint) return false
      }
      return await input.host.revalidate(context)
    }
    if (!await inspect()) return { status: "unavailable", reason: "campaign-history-sources-unavailable" }
    const again = await load()
    if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(campaign) || (await owner(request.ownerCase, context)).status !== "ok" || !await inspect()) return { status: "stale", reason: "campaign-history-changed" }
    return { status: "ok", value: { state: "historical", campaign: structuredClone(campaign) } }
  }
  const list = async (ownerCase: CaseRef, context: TrustedDomainContext): Promise<PortResult<readonly { campaignRef: string; version: number; createdAt: string; commandDigest: string }[]>> => {
    const source = input.host.requestFor(context)
    const decision = await owner(ownerCase, context)
    if (!source || decision.status !== "ok") return decision.status === "ok" ? { status: "denied", reason: "campaign-access-unavailable" } : decision
    const load = () => input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[indexKey(ownerCase)] : undefined)
    const first = await load()
    const second = await load()
    if (first.status !== "ok" || second.status !== "ok" || digestSfValue(first.value) !== digestSfValue(second.value) || !Array.isArray(first.value)) return { status: "unavailable", reason: "campaign-list-unavailable" }
    const entries = first.value.filter(isIndexEntry)
    if (entries.length !== first.value.length || !await input.host.revalidate(context)) return { status: "stale", reason: "campaign-list-changed" }
    const checked = await Promise.all(entries.map((entry) => readOriginal({ ownerCase, commandDigest: entry.commandDigest }, context)))
    if (checked.some((item) => item.status !== "ok")) return { status: "stale", reason: "campaign-list-changed" }
    const final = await load()
    if (final.status !== "ok" || digestSfValue(final.value) !== digestSfValue(first.value) || !await input.host.revalidate(context)) return { status: "stale", reason: "campaign-list-changed" }
    return { status: "ok", value: entries.map(({ campaignRef, version, createdAt, commandDigest }) => ({ campaignRef, version, createdAt, commandDigest })) }
  }
  const listHistorical = async (ownerCase: CaseRef, context: TrustedDomainContext): Promise<PortResult<readonly { state: "historical"; campaign: PortfolioCampaign }[]>> => {
    const source = input.host.requestFor(context)
    if (!source || (await owner(ownerCase, context)).status !== "ok") return { status: "denied", reason: "campaign-history-access-unavailable" }
    const load = () => input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[indexKey(ownerCase)] : undefined)
    const first = await load()
    if (first.status !== "ok" || !Array.isArray(first.value)) return { status: "unavailable", reason: "campaign-history-unavailable" }
    const entries = first.value.filter(isIndexEntry)
    if (entries.length !== first.value.length) return { status: "unavailable", reason: "campaign-history-unavailable" }
    const checked = await Promise.all(entries.map((entry) => readHistorical({ ownerCase, commandDigest: entry.commandDigest }, context)))
    const again = await load()
    if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(first.value) || (await owner(ownerCase, context)).status !== "ok" || !await input.host.revalidate(context)) return { status: "stale", reason: "campaign-history-changed" }
    return { status: "ok", value: checked.flatMap((item) => item.status === "ok" ? [item.value] : []) }
  }
  const save = async (incoming: PortfolioCampaignEdit, context: TrustedDomainContext): Promise<PortResult<PortfolioCampaign>> => {
    if (context.kind !== "ui") return { status: "denied", reason: "human-campaign-edit-required" }
    const request = structuredClone(incoming)
    const source = input.host.requestFor(context)
    const operation = input.operationIdentity(context)
    if (!source || !operation || source.signal.aborted || !shape(request) || !Number.isSafeInteger(request.expectedVersion) || request.expectedVersion < 0 || !await input.host.revalidate(context)) return { status: "denied", reason: "campaign-access-unavailable" }
    const commandDigest = digestSfValue(request)
    const decision = await owner(request.ownerCase, context)
    const cases = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.ownerCase.id] : undefined)
    const preferences = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? { active: state.preferences[campaignKey(request.ownerCase)], prior: state.transactions[JSON.stringify([authority.principalRef, "preferences", request.ownerCase.id, `portfolio-campaign:${operation}`])], index: state.preferences[indexKey(request.ownerCase)] } : undefined)
    const contributions = request.proposalRefs.length ? await input.state.read(source, "contributions", (_state, authority) => sameAuthority(authority, context)) : undefined
    if (decision.status !== "ok" || cases.status !== "ok" || preferences.status !== "ok" || (contributions && (contributions.status !== "ok" || !contributions.value)) || !preferences.value || !allowed(cases.value, request.ownerCase, context) || !cases.value || !await input.authorizeCase(cases.value, context)) return { status: "denied", reason: "campaign-access-unavailable" }
    if (request.scope.currency !== decision.value.case.currency || digestSfValue(request.scope.horizon) !== digestSfValue(decision.value.case.horizon)) return { status: "needs-input", reason: "campaign-scope-mismatch" }
    if (preferences.value.prior) {
      if (preferences.value.prior.commandDigest !== commandDigest) return { status: "conflict", reason: "idempotency-content-changed" }
      return readOriginal({ ownerCase: request.ownerCase, commandDigest }, context)
    }
    if (preferences.value.active !== undefined && !isCampaign(preferences.value.active)) return { status: "unavailable", reason: "campaign-invalid" }
    const priorVersion = isCampaign(preferences.value.active) ? preferences.value.active.version : 0
    if (priorVersion !== request.expectedVersion || (preferences.value.index !== undefined && !Array.isArray(preferences.value.index))) return { status: "stale", reason: "campaign-changed" }
    const opened = await input.readSourceFences(context)
    if (!opened) return { status: "unavailable", reason: "campaign-source-fence-unavailable" }
    const candidates: Candidate[] = []
    for (const requested of request.candidateRefs) {
      const resolved = await input.resolveCandidate(requested.ref, context)
      if (resolved.status !== "ok") return resolved
      const supported = await input.validateCandidate(resolved.value, context)
      if (supported.status !== "ok") return supported
      if (supported.value !== true) return { status: "unavailable", reason: "campaign-candidate-unavailable" }
      const parsed = parseCaseRef(resolved.value.caseRef)
      const pinned = pinnedCase(requested.ref)
      if (!parsed || !pinned) return { status: "needs-input", reason: "invalid-candidate-reference" }
      const repeated = await input.resolveCandidate(requested.ref, context)
      if (repeated.status !== "ok" || digestSfValue(repeated.value) !== digestSfValue(resolved.value)) return { status: "stale", reason: "candidate-case-changed" }
      candidates.push({ ref: requested.ref, selectionOrder: requested.selectionOrder, caseRef: { id: parsed.id, incarnation: parsed.incarnation, version: pinned.version }, candidateDigest: digestSfValue(resolved.value) })
    }
    const proposals = []
    for (const outputRef of request.proposalRefs) {
      if (!input.verifyProposal) return { status: "unavailable", reason: "campaign-proposal-unavailable" }
      const resolved = await input.verifyProposal(outputRef, context)
      if (resolved.status !== "ok") return resolved
      if (!/^[a-f0-9]{64}$/.test(resolved.value.outputDigest)) return { status: "unavailable", reason: "campaign-proposal-unavailable" }
      proposals.push({ outputRef, outputDigest: resolved.value.outputDigest, state: "provisional" as const })
    }
    const commitments: StoredCommitment[] = []
    for (const commitment of request.commitments) {
      if (commitment.kind === "contract") {
        const issued = await input.contracts.issueContract({ id: commitment.id, fields: commitment.fields, period: commitment.period }, context)
        if (issued.status !== "ok") return issued
        const projection = await input.contracts.readContractSource({ contractRef: issued.value, fields: commitment.fields }, context)
        if (projection.status !== "ok") return projection
        const source = projection.value.values[0]?.sourceRefs[0]
        if (!source || source.kind !== "record" || source.target.recordType !== "contracts" || source.target.recordId !== commitment.id || source.refId !== issued.value || source.refDigest !== digestSfEvidenceRef(source)) return { status: "denied", reason: "contract-source-mismatch" }
        const again = await input.contracts.readContractSource({ contractRef: issued.value, fields: commitment.fields }, context)
        if (again.status !== "ok" || projectionFingerprint(again.value) !== projectionFingerprint(projection.value)) return { status: "stale", reason: "campaign-source-changed" }
        commitments.push({ kind: "contract", recordId: commitment.id, fields: commitment.fields, period: commitment.period, sourceRef: issued.value, projectionFingerprint: projectionFingerprint(projection.value) })
      } else {
        const issued = await input.records.issue({ page: commitment.page, recordType: "projects", recordId: commitment.recordId, fields: commitment.fields, period: commitment.period }, context)
        if (issued.status !== "ok") return issued
        if (issued.value.target.recordType !== "projects" || issued.value.refDigest !== digestSfEvidenceRef(issued.value)) return { status: "denied", reason: "project-source-mismatch" }
        const projection = await input.records.read(issued.value.refId, context)
        if (projection.status !== "ok") return projection
        const again = await input.records.read(issued.value.refId, context)
        if (again.status !== "ok" || projectionFingerprint(again.value) !== projectionFingerprint(projection.value)) return { status: "stale", reason: "campaign-source-changed" }
        commitments.push({ kind: "project", page: commitment.page, recordId: commitment.recordId, fields: commitment.fields, period: commitment.period, sourceRef: issued.value.refId, projectionFingerprint: projectionFingerprint(projection.value) })
      }
    }
    const fingerprint = await input.readSourceFences(context)
    if (!fingerprint || digestSfValue(fingerprint) !== digestSfValue(opened)) return { status: "stale", reason: "campaign-source-changed" }
    const drafted = { schema: "sf-portfolio-campaign-v1" as const, campaignRef: `portfolio-campaign:${digestSfValue({ ownerCase: request.ownerCase, operation, commandDigest })}`, ownerCase: request.ownerCase, commandDigest, candidates, constraints: [...request.constraints], scope: request.scope, explorationLimit: request.explorationLimit, proposals, commitments, sourceFingerprint: digestSfValue(fingerprint), version: priorVersion + 1, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, createdAt: input.now(), campaignDigest: "" }
    const campaign: PortfolioCampaign = { ...drafted, campaignDigest: campaignDigest(drafted) }
    if (!Number.isFinite(Date.parse(campaign.createdAt))) return { status: "unavailable", reason: "campaign-clock-unavailable" }
    const work = async (state: SfProductState, authority: SfStateAuthority, _snapshot: Snapshot) => {
      const fences = input.lockedSourceFences()
      const existing = state.preferences[campaignKey(request.ownerCase)]
      if (!fences || digestSfValue(fences) !== campaign.sourceFingerprint || !sameAuthority(authority, context) || !allowed(state.cases[request.ownerCase.id], request.ownerCase, context) || (isCampaign(existing) ? existing.version : existing === undefined ? 0 : -1) !== priorVersion || state.preferences[historyKey(commandDigest)] !== undefined) return { commit: false, value: null }
      const index = state.preferences[indexKey(request.ownerCase)]
      const entries = Array.isArray(index) ? index.filter(isIndexEntry) : []
      if (index !== undefined && entries.length !== index.length) return { commit: false, value: null }
      state.preferences[historyKey(commandDigest)] = campaign
      state.preferences[campaignKey(request.ownerCase)] = campaign
      state.preferences[indexKey(request.ownerCase)] = [...entries, { campaignRef: campaign.campaignRef, version: campaign.version, createdAt: campaign.createdAt, commandDigest }]
      return { commit: true, value: campaign }
    }
    input.proposalCoverageWrites.add(work)
    const saved = await input.state.transaction(source, { namespace: "preferences", sourceFence: "all", expectedStorageVersion: preferences.storageVersion, checkNamespaces: [{ namespace: "cases", expectedStorageVersion: cases.storageVersion }, ...(contributions?.status === "ok" ? [{ namespace: "contributions" as const, expectedStorageVersion: contributions.storageVersion }] : [])], targetRef: request.ownerCase.id, targetIncarnation: request.ownerCase.incarnation, idempotencyKey: `portfolio-campaign:${operation}`, commandDigest }, work).finally(() => input.proposalCoverageWrites.delete(work))
    if (saved.status !== "ok" || !saved.value) return { status: saved.status === "preview" || saved.status === "conflict" ? "conflict" : "unavailable", reason: "campaign-locked-proof-unavailable" }
    const proved = await prove(saved.value, context)
    if (proved.status !== "ok") return proved
    return readOriginal({ ownerCase: request.ownerCase, commandDigest }, context)
  }
  return { read, list, save, readOriginal, readHistorical, listHistorical }
}

function campaignKey(ref: CaseRef) { return `sf:portfolio:campaign:${digestSfValue({ id: ref.id, incarnation: ref.incarnation })}` }
function historyKey(commandDigest: string) { return `sf:portfolio:campaign:history:${commandDigest}` }
function indexKey(ref: CaseRef) { return `sf:portfolio:campaign:index:${digestSfValue({ id: ref.id, incarnation: ref.incarnation })}` }
function campaignDigest(value: PortfolioCampaign) { return digestSfValue(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "campaignDigest"))) }
function projectionFingerprint(value: DomainProjection) { return digestSfValue({ version: value.version, engineVersion: value.engineVersion, values: value.values.map((item) => ({ id: item.id, value: item.value, unit: item.unit, currency: item.currency, period: item.period, evidenceState: item.evidenceState, sourceRefs: item.sourceRefs })) }) }
function sameAuthority(authority: SfStateAuthority, context: TrustedDomainContext) { return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision }
function allowed(value: Pick<DecisionCase, "id" | "incarnation" | "version" | "participants"> | undefined, ref: CaseRef, context: TrustedDomainContext) { return !!value && value.id === ref.id && value.incarnation === ref.incarnation && value.version === ref.version && value.participants.includes(context.binding.principalRef) && (context.kind !== "native" || (context.binding.caseId === value.id && context.binding.caseIncarnation === value.incarnation && context.binding.caseVersion === value.version)) }
function shape(value: PortfolioCampaignEdit) {
  if (!value || !value.ownerCase || typeof value.ownerCase.id !== "string" || !value.ownerCase.id.trim() || typeof value.ownerCase.incarnation !== "string" || !value.ownerCase.incarnation.trim() || !Number.isSafeInteger(value.ownerCase.version) || value.ownerCase.version < 1 || !value.scope || typeof value.scope.currency !== "string" || !value.scope.currency.trim() || !isSfPeriod(value.scope.horizon) || !Array.isArray(value.candidateRefs) || !Array.isArray(value.proposalRefs) || !Array.isArray(value.constraints) || !Array.isArray(value.commitments)) return false
  if ((!value.candidateRefs.length && !value.proposalRefs.length) || value.candidateRefs.length > 64 || value.proposalRefs.length > 64 || value.commitments.length > 64 || !Number.isSafeInteger(value.explorationLimit) || value.explorationLimit < 1 || value.explorationLimit > 1024) return false
  if (value.candidateRefs.some((candidate) => !candidate || typeof candidate.ref !== "string" || !candidate.ref.trim() || !Number.isSafeInteger(candidate.selectionOrder) || candidate.selectionOrder < 1) || value.proposalRefs.some((ref) => typeof ref !== "string" || !ref.trim()) || value.constraints.some((item) => typeof item !== "string" || item.trim() !== item || !item.length)) return false
  if (value.commitments.some((item) => !item || !["contract", "project"].includes(item.kind) || !Array.isArray(item.fields) || !item.fields.length || item.fields.some((field) => typeof field !== "string" || !field.trim()) || !isSfPeriod(item.period) || (item.kind === "contract" ? typeof item.id !== "string" || !item.id.trim() : typeof item.page !== "string" || !item.page.trim() || typeof item.recordId !== "string" || !item.recordId.trim()))) return false
  return new Set(value.candidateRefs.map((candidate) => candidate.selectionOrder)).size === value.candidateRefs.length && new Set(value.candidateRefs.map((candidate) => candidate.ref)).size === value.candidateRefs.length && new Set(value.proposalRefs).size === value.proposalRefs.length && new Set(value.constraints).size === value.constraints.length && new Set(value.commitments.map((item) => digestSfValue(item))).size === value.commitments.length
}
function pinnedCase(ref: string) { const match = /^portfolio-candidate:([^:]+):([1-9]\d*):([^:]+):([1-9]\d*)$/.exec(ref); if (!match) return undefined; try { const caseRef = decodeURIComponent(match[1] ?? ""); return parseCaseRef(caseRef) ? { version: Number(match[2]) } : undefined } catch { return undefined } }
function isIndexEntry(value: unknown): value is { campaignRef: string; version: number; createdAt: string; commandDigest: string } { if (!value || typeof value !== "object" || Array.isArray(value)) return false; const entry = value as Partial<{ campaignRef: string; version: number; createdAt: string; commandDigest: string }>; return typeof entry.campaignRef === "string" && typeof entry.commandDigest === "string" && typeof entry.createdAt === "string" && Number.isSafeInteger(entry.version) }
function isCampaign(value: unknown): value is PortfolioCampaign { if (!value || typeof value !== "object" || Array.isArray(value)) return false; const campaign = value as Partial<PortfolioCampaign>; return campaign.schema === "sf-portfolio-campaign-v1" && !!campaign.ownerCase && typeof campaign.commandDigest === "string" && typeof campaign.sourceFingerprint === "string" && Array.isArray(campaign.candidates) && Array.isArray(campaign.proposals) && !!campaign.scope && Number.isSafeInteger(campaign.explorationLimit) && Array.isArray(campaign.commitments) && Number.isSafeInteger(campaign.version) && typeof campaign.campaignDigest === "string" }
