import { roleMap } from "../../runtime/admin.ts"
import { object, rows } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import { domain, requestCurrentActions } from "../../runtime/procurement.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { DecisionCase, PreparedChange } from "../contracts/decisions.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedUiContext } from "../contracts/sf-execution.ts"
import { sfScopedSourceIdentity } from "../integration/source-lifecycle.ts"
import { prepareProcurementMutation, procurementPreparedRevision } from "./prepared.ts"
import { projectProcurementScope } from "./source-projection.ts"

export type C12ProposalSelector = Readonly<{
  caseRef: Readonly<{ id: string; incarnation: string; version: number }>
  choiceId: string
  changeId: string
}>

export type C12ProposalAction = Readonly<{ kind: "submit" | "approve"; reviewDigest: string }>
export type C12ProposalReview = Readonly<{
  proposalDigest: string
  reviewDigest: string
  state: "unsubmitted" | "pending" | "approved"
  targetId: string
  domainVersion: number
  currentAmount: number | null
  amount: number
  currency: string
  step: Readonly<{ index: number; levelId: string; holderId: string | null }> | null
  allowedActions: readonly C12ProposalAction["kind"][]
  domainApplied: false
}>

type Event = Readonly<{ kind: "submit" | "approve"; actor: Actor; at: string }>
/** Store privately. Neither these events nor the digest are client approval credentials. */
export type C12ProposalRecord = Readonly<{
  schema: "sf-c12-procurement-proposal-v1"
  proposalDigest: string
  events: readonly Event[]
}>

type Decision = Pick<DecisionCase, "id" | "incarnation" | "version" | "state" | "participants" | "choices" | "preparedChanges">
type ProposalState = {
  procurement: Snapshot
  decision: Readonly<Decision>
  record: C12ProposalRecord | undefined
}
export type C12ProposalTransaction = ProposalState & {
  /** Save only the private proposal record under this same lock. */
  persist: (record: C12ProposalRecord) => boolean
}

type ProposalResult = PortResult<C12ProposalReview>
export type C12ProposalHost = Pick<DomainPortHost, "requestFor" | "revalidate" | "authenticate" | "environment"> & {
  /** Resolve authorized current case, exact stored change and private proposal in ONE serializable installation transaction.
   * Both snapshots and record must roll back on commit:false, abort or failed commit. Never populate them from a request body.
   */
  transaction: (selector: C12ProposalSelector, context: TrustedUiContext, request: Request, work: (transaction: C12ProposalTransaction) => Promise<{ commit: boolean; value: ProposalResult }>) => Promise<ProposalResult>
  /** Recheck exact explicit human intent (including reviewDigest), under the lock, for every write. */
  authorizeHuman: (context: TrustedUiContext, selector: C12ProposalSelector, action: C12ProposalAction) => Promise<boolean>
}

/** The scoped estimate proposal is distinct from an ordinary Procurement draft edit. */
export function requiresC12ProcurementProposal(change: PreparedChange) {
  const command = change.operation.command
  const amount = object(command.values.pr).estAmount
  return change.target.surface === "procurement" && change.target.type === "procurement-request" &&
    command.page === "Requests" && command.action === "save" && command.id === change.target.id &&
    command.version > 0 && typeof amount === "number" && Number.isFinite(amount) &&
    digestSfValue(command.values) === digestSfValue({ pr: { estAmount: amount } })
}

export function c12ProposalKey(selector: C12ProposalSelector, context: TrustedUiContext) {
  return digestSfValue([context.binding.installationId, context.binding.projectId, selector])
}

/** Isolated submit and approval never write a live requisition. */
export function createC12ProcurementProposal(host: C12ProposalHost) {
  const run = async (incoming: C12ProposalSelector, context: TrustedUiContext, action?: C12ProposalAction): Promise<ProposalResult> => {
    const selector = structuredClone(incoming)
    const command = action && structuredClone(action)
    const request = host.requestFor(context)
    const denied = { status: "denied", reason: "current-authority-unavailable" } as const
    const currentLease = async () => !!request && !request.signal.aborted && host.requestFor(context) === request && await host.revalidate(context) && !request.signal.aborted && host.requestFor(context) === request
    if (context.kind !== "ui" || !request || (command && request.method !== "POST") || !await currentLease()) return denied
    return host.transaction(selector, context, request, async (tx) => {
      const stop = (value: ProposalResult) => ({ commit: false, value })
      const authenticate = async () => {
        if (!await currentLease()) return undefined
        const principal = await host.authenticate(request, { surface: "procurement", roleMap: roleMap(tx.procurement, "procurement") })
        if (!principal?.canWrite || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return undefined
        const roles = principal.roles.filter((entry) => entry.surface === "procurement").map((entry) => entry.role)
        if (!roles.length || roles.every((role) => role === "viewer")) return undefined
        return { id: principal.id, roles, canWrite: true, assigned: [], domains: [] } satisfies Actor
      }
      const actor = await authenticate()
      if (!actor) return stop(denied)
      const environment = await host.environment(request)
      if (!Number.isFinite(Date.parse(environment.at))) return stop({ status: "unavailable", reason: "observation-time-unavailable" })
      const proposal = currentProposal(tx, selector, context)
      if (!proposal) return stop(tx.decision.participants.includes(actor.id) ? { status: "stale", reason: "proposal-source-or-choice-changed" } : denied)
      const record: C12ProposalRecord = tx.record ?? { schema: "sf-c12-procurement-proposal-v1", proposalDigest: proposal.digest, events: [] }
      const staged = replay(tx.procurement, proposal, record)
      if (!staged) return stop(tx.decision.participants.includes(actor.id) ? { status: "conflict", reason: "proposal-chain-invalid" } : denied)
      const canEdit = canUsePrepared(tx, proposal, context, actor)
      const candidate = readRequest(staged, proposal.target.id)
      const canApprove = candidate.status === "pr_pending" && !record.events.some((event) => event.actor.id === actor.id) && requestCurrentActions(staged, actor, candidate).has("approve")
      if (!canEdit && !canApprove) return stop(denied)
      const review = summarize(proposal, record, staged, context, actor, canEdit, canApprove)
      if (!command) return stop(digestSfValue(await authenticate()) === digestSfValue(actor) && await currentLease() ? { status: "ok", value: review } : denied)
      if (command.reviewDigest !== review.reviewDigest) return stop({ status: "stale", reason: "proposal-review-changed" })
      if (!review.allowedActions.includes(command.kind) || !await host.authorizeHuman(context, selector, command) || digestSfValue(await authenticate()) !== digestSfValue(actor) || !await currentLease()) return stop(denied)

      if (command.kind === "submit" && !matchesPrepared(tx.procurement, proposal, context, actor)) return stop({ status: "conflict", reason: "prepared-estimate-changed" })
      const event: Event = { kind: command.kind, actor, at: environment.at }
      const last = record.events.at(-1)
      if ((last && Date.parse(event.at) < Date.parse(last.at)) || !transition(staged, proposal, event)) return stop({ status: "denied", reason: "canonical-proposal-transition-refused" })
      const next = { ...record, events: [...record.events, event] }
      if (!tx.persist(next)) return stop({ status: "unavailable", reason: "proposal-persistence-unavailable" })
      return { commit: true, value: { status: "ok", value: summarize(proposal, next, staged, context, actor, canEdit, false) } }
    })
  }
  return { review: (selector: C12ProposalSelector, context: TrustedUiContext) => run(selector, context), advance: (selector: C12ProposalSelector, action: C12ProposalAction, context: TrustedUiContext) => run(selector, context, action) }
}

/** Read-only gate for the existing C12 receipt transaction. The host must supply the
 * freshly authenticated Apply actor, revalidated human intent, and private record read
 * under the same lock as the current case, source, receipt and eventual mutation. */
export function verifyC12ProcurementProposal(input: ProposalState & { selector: C12ProposalSelector; context: TrustedUiContext; actor: Actor }): PortResult<{ proposalDigest: string }> {
  const proposal = currentProposal(input, input.selector, input.context)
  if (!proposal) return { status: "stale", reason: "proposal-source-or-choice-changed" }
  if (!canUsePrepared(input, proposal, input.context, input.actor)) return { status: "denied", reason: "current-authority-unavailable" }
  if (!input.record) return { status: "denied", reason: "proposal-approval-required" }
  const staged = replay(input.procurement, proposal, input.record)
  if (!staged) return { status: "conflict", reason: "proposal-chain-invalid" }
  if (!isApproved(readRequest(staged, proposal.target.id))) return { status: "denied", reason: "proposal-approval-required" }
  return matchesPrepared(input.procurement, proposal, input.context, input.actor) ? { status: "ok", value: { proposalDigest: proposal.digest } } : { status: "conflict", reason: "prepared-estimate-changed" }
}

function currentProposal(tx: ProposalState, selector: C12ProposalSelector, context: TrustedUiContext) {
  if (context.kind !== "ui") return undefined
  const decision = tx.decision
  if (decision.id !== selector.caseRef.id || decision.incarnation !== selector.caseRef.incarnation || decision.version !== selector.caseRef.version || !["chosen", "partially-applied"].includes(decision.state) || decision.choices.at(-1)?.id !== selector.choiceId) return undefined
  const choices = decision.choices.filter((choice) => choice.id === selector.choiceId)
  const changes = decision.preparedChanges.filter((change) => change.id === selector.changeId)
  if (choices.length !== 1 || changes.length !== 1) return undefined
  const choice = choices[0]!
  const change = changes[0]!
  if (change.caseId !== decision.id || change.choiceId !== choice.id || change.caseVersion > decision.version || change.state !== "planned" || change.receipt || change.idempotencyKey !== change.operation.idempotencyKey || decision.preparedChanges.filter((item) => item.idempotencyKey === change.idempotencyKey).length !== 1) return undefined
  const target = change.target
  const command = change.operation.command
  const amount = object(command.values.pr).estAmount
  if (target.surface !== "procurement" || target.type !== "procurement-request" || digestSfValue(target) !== digestSfValue(change.operation.target) || command.page !== "Requests" || command.action !== "save" || command.id !== target.id || command.confirmed !== false || change.expectedVersion !== command.version || change.operation.expectedVersion !== command.version || typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || digestSfValue(command.values) !== digestSfValue({ pr: { estAmount: amount } })) return undefined
  const snapshot = tx.procurement
  const version = procurementPreparedRevision(snapshot, command)
  if (version !== command.version || version < 1) return undefined
  const store = object(snapshot.data.store)
  const settings = object(store.settings)
  const currency = settings.currency
  // PR estimates are in the installation base currency; canonical PR submission applies no FX conversion.
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency) || choice.result.currency !== currency) return undefined
  const row = object(object(store.requests)[target.id])
  const request = object(row.request)
  if (row.version !== version || request.number !== target.id || !["draft", "pr_rejected"].includes(String(request.status)) || object(request.pr).estAmount === amount) return undefined

  const binding = context.binding
  const preview = change.operation.preview
  const preparation = preview.context
  if (preparation.installationId !== binding.installationId || preparation.projectId !== binding.projectId || preparation.policyVersion !== binding.policyVersion || preparation.currency !== currency) return undefined
  const scopes = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.alive && entry.incarnation === target.incarnation && entry.version === target.version && entry.scope.recordType === target.type && entry.scope.recordId === target.id && entry.scope.principalRef === preparation.principalRef && entry.scope.accessRevision === preparation.accessRevision && entry.scope.policyVersion === preparation.policyVersion)
  if (scopes.length !== 1) return undefined
  const scope = scopes[0]!.scope
  const identity = sfScopedSourceIdentity(snapshot, scope)
  const projection = projectProcurementScope("procurement", snapshot, scope)
  const references = preview.values.flatMap((value) => value.sourceRefs)
  const evidence = references[0]
  if (!identity || !projection || identity.inputDigest !== digestSfValue(projection) || !evidence || evidence.kind !== "record" || evidence.evidenceLevel !== "observed" || evidence.refDigest !== digestSfEvidenceRef(evidence) || evidence.installationId !== binding.installationId || evidence.projectId !== binding.projectId || evidence.target.surface !== target.surface || evidence.target.recordId !== target.id || evidence.target.recordType !== target.type || evidence.target.incarnation !== target.incarnation || evidence.target.version !== target.version || evidence.target.projectionDigest !== object(projection).privateDependencyDigest || digestSfValue(evidence.target.fields) !== digestSfValue(target.fields) || digestSfValue(evidence.target.period) !== digestSfValue(target.period) || preview.values.some((value) => value.sourceRefs.length !== 1) || references.some((ref) => digestSfValue(ref) !== digestSfValue(evidence))) return undefined
  if (!choice.result.sourceRefs.some((ref) => digestSfValue(ref) === digestSfValue(evidence)) || digestSfValue(choice.result.horizon) !== digestSfValue(target.period) || choice.scenario.operations.filter((item) => item.kind === "replace" && item.targetRef === evidence.refId && item.replacementRef === undefined && item.amount === amount && item.currency === currency && digestSfValue(item.period) === digestSfValue(target.period)).length !== 1) return undefined

  const digest = digestSfValue({ schema: "sf-c12-procurement-proposal-v1", installationId: binding.installationId, projectId: binding.projectId, selector, change, choice, scope, identity, physicalIncarnation: scopes[0]!.sourceIncarnation, domainVersion: version, rowDigest: digestSfValue(row), settingsVersion: snapshot.versions.settings?.version ?? 0, settings, roleMap: roleMap(snapshot, "procurement"), amount, currency })
  return { digest, change, target, evidence, scope, row, version, amount, currency }
}

type Proposal = NonNullable<ReturnType<typeof currentProposal>>

function canUsePrepared(state: ProposalState, proposal: Proposal, context: TrustedUiContext, actor: Actor) {
  const scope = proposal.scope
  const settings = object(scope.selector)
  return actor.id === context.binding.principalRef && actor.id === scope.principalRef && !actor.id.startsWith("local:") && actor.canWrite && settings.canWrite === true && digestSfValue(actor.roles) === digestSfValue(settings.roles) && context.binding.accessRevision === scope.accessRevision && state.decision.participants.includes(actor.id) && requestCurrentActions(state.procurement, actor, object(proposal.row.request)).has("submit_pr")
}

function matchesPrepared(snapshot: Snapshot, proposal: Proposal, context: TrustedUiContext, actor: Actor) {
  const command = proposal.change.operation
  const prepared = prepareProcurementMutation({ snapshot, actor: { id: actor.id, roles: actor.roles, canWrite: actor.canWrite, assigned: [], domains: [] }, environment: { at: proposal.target.observedAt, id: () => "", directory: [] }, context, target: proposal.target, scope: proposal.scope, evidence: proposal.evidence, command: command.command, operationId: command.id, idempotencyKey: command.idempotencyKey })
  return !!prepared && digestSfValue(prepared.command) === digestSfValue(command)
}

function replay(snapshot: Snapshot, proposal: Proposal, record: C12ProposalRecord) {
  if (record.schema !== "sf-c12-procurement-proposal-v1" || record.proposalDigest !== proposal.digest) return undefined
  const settings = object(object(snapshot.data.store).settings)
  const events = record.events
  if (!Array.isArray(events) || events.length > rows(settings.levels).length + 1) return undefined
  const id = proposal.target.id
  const key = `requests:${id}`
  const staged: Snapshot = { data: { store: structuredClone({ settings, requests: { [id]: proposal.row } }) }, versions: { [key]: { version: proposal.version, by: String(proposal.row.by) } }, audit: [], sequences: {}, notices: [] }
  const actors = new Set<string>()
  for (const [index, event] of events.entries()) {
    if (!event || !event.actor || actors.has(event.actor.id) || event.kind !== (index ? "approve" : "submit") || !Number.isFinite(Date.parse(event.at)) || (index ? Date.parse(event.at) < Date.parse(events[index - 1]!.at) : event.actor.id !== proposal.scope.principalRef) || !transition(staged, proposal, event)) return undefined
    actors.add(event.actor.id)
  }
  return staged
}

function readRequest(snapshot: Snapshot, id: string) {
  return object(object(object(object(snapshot.data.store).requests)[id]).request)
}

function transition(staged: Snapshot, proposal: Proposal, event: Event) {
  const id = proposal.target.id
  const submit = event.kind === "submit"
  const allowed = requestCurrentActions(staged, event.actor, readRequest(staged, id))
  const action = submit ? "submit_pr" : "approve"
  if (!allowed.has(action)) return false
  const result = domain.execute(staged, event.actor, { page: submit ? "Requests" : "My approvals", action, id, version: staged.versions[`requests:${id}`]!.version, confirmed: false, values: submit ? { pr: { estAmount: proposal.amount } } : {} }, { at: event.at, id: () => "", directory: [] })
  const request = readRequest(staged, id)
  const approval = object(request.prApproval)
  return result.ok && object(request.pr).estAmount === proposal.amount && request.prApprovalBaseCurrency === proposal.currency && approval.amount === proposal.amount && approval.fxRate === null && rows(approval.steps).length > 0
}

function isApproved(candidate: Record<string, unknown>) {
  const steps = rows(object(candidate.prApproval).steps)
  return candidate.status === "sourcing" && steps.length > 0 && steps.every((step) => step.status === "approved")
}

function summarize(proposal: Proposal, record: C12ProposalRecord, staged: Snapshot, context: TrustedUiContext, actor: Actor, canEdit: boolean, canApprove: boolean): C12ProposalReview {
  const candidate = readRequest(staged, proposal.target.id)
  const steps = rows(object(candidate.prApproval).steps)
  const index = steps.findIndex((step) => step.status === "pending")
  const pending = steps[index]
  const state = !record.events.length ? "unsubmitted" : isApproved(candidate) ? "approved" : "pending"
  const allowedActions = [...(canEdit && state === "unsubmitted" ? ["submit" as const] : []), ...(canApprove && state === "pending" ? ["approve" as const] : [])]
  const currentAmount = object(object(proposal.row.request).pr).estAmount
  const reviewDigest = digestSfValue({ record, actor, accessRevision: context.binding.accessRevision, allowedActions })
  return { proposalDigest: proposal.digest, reviewDigest, state, targetId: proposal.target.id, domainVersion: proposal.version, currentAmount: typeof currentAmount === "number" ? currentAmount : null, amount: proposal.amount, currency: proposal.currency, step: state === "pending" && pending ? { index, levelId: String(pending.levelId), holderId: typeof pending.holderId === "string" ? pending.holderId : null } : null, allowedActions, domainApplied: false }
}
