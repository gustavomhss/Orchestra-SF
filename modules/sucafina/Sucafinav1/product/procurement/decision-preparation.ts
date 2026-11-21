import { digestSfValue } from "../contracts/canonical.ts"
import { roleMap } from "../../runtime/admin.ts"
import { object, rows, text } from "../../runtime/contract.ts"
import type { Actor, Command, Environment, Snapshot } from "../../runtime/contract.ts"
import { domain } from "../../runtime/procurement.ts"
import { validatePR } from "../../src/form.ts"
import { approvalDecision } from "../../src/procurement-screen.ts"
import type { RequestView } from "../../src/procurement-screen.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { CommercialComparison } from "../contracts/outputs.ts"
import type { DomainPortHost, PortResult, ProcurementPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { createProcurementReadonlySourceResolver } from "./scenario-producer.ts"

/** Read-only material for the purchase dossier; it never prepares or applies a command. */
export function createProcurementDecisionPreparation(port: ProcurementPort) {
  return async (requestRef: string, binding: TrustedDomainContext): Promise<PortResult<{ request: DomainProjection; comparison: CommercialComparison | null; limitations: readonly string[] }>> => {
    const request = await port.read({ requestRef }, binding)
    if (request.status !== "ok") return request
    const comparison = await port.compareSourcing({ requestRef, proposalRefs: [], criteria: [] }, binding)
    if (comparison.status !== "ok" && comparison.status !== "needs-input") return comparison
    const current = await port.read({ requestRef }, binding)
    if (current.status !== "ok") return current
    const stable = (value: DomainProjection) => ({ ...value, values: value.values.filter((item) => item.id !== "ageDays") })
    if (digestSfValue(stable(current.value)) !== digestSfValue(stable(request.value))) return { status: "stale", reason: "Request changed during preparation" }
    if (comparison.status === "ok") {
      const evidence = request.value.values.flatMap((value) => value.sourceRefs)
      if (comparison.value.requestVersion !== request.value.version || !comparison.value.sourceRefs.length || comparison.value.sourceRefs.some((ref) => !evidence.some((item) => item.refDigest === ref.refDigest))) return { status: "stale", reason: "Comparison source changed" }
    }
    return { status: "ok", value: { request: current.value, comparison: comparison.status === "ok" ? comparison.value : null, limitations: comparison.status === "needs-input" ? [comparison.reason] : [] } }
  }
}

export type ProcurementApprovalAction =
  | { kind: "save-estimate"; amount: number }
  | { kind: "submit-current"; amount: number }
  | { kind: "approve-submitted"; amount: number; holderId: string | null; comment: string }
  | { kind: "reject-submitted"; amount: number; holderId: string | null; reason: string }

export type ProcurementApprovalReview = {
  kind: "procurement-pr-review-v1"
  source: Extract<BusinessEvidenceRef, { kind: "record" }>
  domainVersion: number
  stage: string
  amount: number | null
  currency: string
  submittedAmount: number | null
  submittedCurrency: string | null
  holderId: string | null
  allowedActions: readonly ProcurementApprovalAction["kind"][]
  authorityDigest: string
  recordDigest: string
  policyDigest: string
}

export type ProcurementApprovalPlan = {
  kind: "procurement-pr-lifecycle-v1"
  command: Command
  review: ProcurementApprovalReview
  action: ProcurementApprovalAction
  requiresExplicitAction: true
  approvalGranted: false
  receipt: null
}

export type ProcurementApprovalAdmission = {
  // The host calls this synchronously inside the canonical command transaction,
  // after fresh authentication and immediately before its single domain.execute.
  current: (snapshot: Snapshot, actor: Actor, command: Command, environment: Environment) => PortResult<true>
  finish: () => void
}

/** Read-only adaptation to the existing Requests form commands, never a C12 Apply or an approval grant. */
export function createProcurementApprovalLifecycle(input: { host: DomainPortHost }) {
  const sources = createProcurementReadonlySourceResolver(input)
  const snapshotReview = (snapshot: Snapshot, actor: Actor, environment: Environment, evidence: ProcurementApprovalReview["source"], binding: TrustedDomainContext): PortResult<{ review: ProcurementApprovalReview; requisition: Record<string, unknown> }> => {
    if (binding.kind !== "ui" || actor.id !== binding.binding.principalRef || actor.id.startsWith("local:") || !actor.canWrite || !actor.roles.some((role) => role !== "viewer") || evidence.installationId !== binding.binding.installationId || evidence.projectId !== binding.binding.projectId) return { status: "denied", reason: "current-authority-unavailable" }
    const scopes = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.alive && entry.incarnation === evidence.target.incarnation)
    if (scopes.length !== 1) return { status: "stale", reason: "requisition-source-changed" }
    const scope = scopes[0]!.scope
    const selected = object(scope.selector)
    const selector = { kind: "procurement-record-v1", roles: actor.roles, canWrite: actor.canWrite, roleMapDigest: digestSfValue(roleMap(snapshot, "procurement")), fields: selected.fields, period: selected.period, currency: selected.currency }
    if (scope.principalRef !== binding.binding.principalRef || scope.accessRevision !== binding.binding.accessRevision || scope.policyVersion !== binding.binding.policyVersion || scope.recordType !== "procurement-request" || scope.recordId !== evidence.target.recordId || digestSfValue(selector) !== digestSfValue(scope.selector)) return { status: "denied", reason: "current-authority-unavailable" }
    if (!sources.isCurrent(snapshot, evidence)) return { status: "stale", reason: "requisition-source-changed" }
    if (!Number.isFinite(Date.parse(environment.at))) return { status: "unavailable", reason: "observation-time-unavailable" }
    const view = domain.view(snapshot, actor, environment)
    const current = rows(view.data.requests).find((item) => item.number === evidence.target.recordId)
    const version = snapshot.versions[`requests:${evidence.target.recordId}`]?.version
    if (!current || !Number.isSafeInteger(version) || version === undefined || version < 0) return { status: "unavailable", reason: "requisition-unavailable" }
    const settings = object(object(snapshot.data.store).settings)
    const stage = text(current.status)
    const approval = object(current.prApproval)
    const holder = stage === "pr_pending" ? rows(approval.steps).find((step) => step.status === "pending") : undefined
    const currency = stage === "pr_pending" ? text(current.prApprovalBaseCurrency) : text(settings.currency)
    if (!/^[A-Z]{3}$/.test(currency)) return { status: "needs-input", reason: "requisition-currency-unavailable" }
    const draft = stage === "draft" || stage === "pr_rejected"
    const creator = current.createdBy === actor.id
    const admin = actor.roles.includes("admin")
    const decision = stage === "pr_pending" && approvalDecision(current as RequestView, actor, settings.blockSelfApproval === true).allowed
    const allowedActions: ProcurementApprovalAction["kind"][] = [
      ...(draft && (creator || admin) ? ["save-estimate" as const] : []),
      ...(draft && (creator || admin || actor.roles.includes("requester")) ? ["submit-current" as const] : []),
      ...(decision ? ["approve-submitted" as const, "reject-submitted" as const] : []),
    ]
    // Procurement authorization uses id/canWrite/roles. Other surfaces' assignments
    // must not make HTTP and readonly review produce different authority digests.
    const authorityActor: Actor = { id: actor.id, canWrite: actor.canWrite, roles: actor.roles, assigned: [], domains: [] }
    const review: ProcurementApprovalReview = {
      kind: "procurement-pr-review-v1", source: evidence, domainVersion: version, stage,
      amount: finiteApprovalAmount(object(current.pr).estAmount), currency,
      submittedAmount: finiteApprovalAmount(approval.amount), submittedCurrency: text(current.prApprovalBaseCurrency) || null,
      holderId: typeof holder?.holderId === "string" ? holder.holderId : null, allowedActions,
      authorityDigest: digestSfValue({ installationId: binding.binding.installationId, projectId: binding.binding.projectId, principalRef: actor.id, accessRevision: binding.binding.accessRevision, policyVersion: binding.binding.policyVersion, actor: authorityActor }),
      recordDigest: digestSfValue(current), policyDigest: digestSfValue({ settings, roleMap: roleMap(snapshot, "procurement") }),
    }
    return { status: "ok", value: { review, requisition: object(current.pr) } }
  }
  const read = async (sourceRef: string, binding: TrustedDomainContext) => {
    // A native/model invocation cannot turn a proposal into a human command plan.
    const request = input.host.requestFor(binding)
    if (binding.kind !== "ui" || !request || request.signal.aborted || !await input.host.revalidate(binding) || input.host.requestFor(binding) !== request) return { status: "denied" as const, reason: "current-authority-unavailable" }
    const source = await sources.resolveSource(sourceRef, binding)
    if (source.status !== "ok") return source
    const environment = await input.host.environment(request)
    if (!Number.isFinite(Date.parse(environment.at))) return { status: "unavailable" as const, reason: "observation-time-unavailable" }
    const snapshotRead = () => input.host.persistence.transaction<PortResult<{ review: ProcurementApprovalReview; requisition: Record<string, unknown> }>>("procurement", async (snapshot) => {
      const principal = await input.host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
      if (!principal || principal.id !== binding.binding.principalRef || principal.id.startsWith("local:") || !principal.canWrite || request.signal.aborted) return { commit: false, value: { status: "denied", reason: "current-authority-unavailable" } }
      const roles = principal.roles.filter((role) => role.surface === "procurement").map((role) => role.role)
      const actor: Actor = { id: principal.id, canWrite: roles.some((role) => role !== "viewer"), roles, assigned: [], domains: [] }
      return { commit: false, value: snapshotReview(snapshot, actor, environment, source.value.evidence, binding) }
    }, { signal: request.signal })
    const before = await snapshotRead()
    if (before.status !== "ok") return before
    const after = await snapshotRead()
    if (!await input.host.revalidate(binding) || request.signal.aborted || input.host.requestFor(binding) !== request || after.status === "denied") return { status: "denied" as const, reason: "current-authority-unavailable" }
    if (after.status !== "ok" || digestSfValue(after.value) !== digestSfValue(before.value)) return { status: "stale" as const, reason: "requisition-review-changed" }
    return before
  }
  const prepare = async (incoming: { review: ProcurementApprovalReview; action: ProcurementApprovalAction }, binding: TrustedDomainContext): Promise<PortResult<ProcurementApprovalPlan>> => {
    if (!approvalValue(incoming) || !exactKeys(incoming, ["review", "action"]) || !validApprovalReview(incoming.review) || !validApprovalAction(incoming.action)) return { status: "needs-input", reason: "explicit-requisition-action-required" }
    const selected = structuredClone(incoming)
    const current = await read(selected.review.source.refId, binding)
    if (current.status !== "ok") return current
    // This compares the reviewed CAS and holder, not just the amount. Never refresh a retained command silently.
    if (digestSfValue(current.value.review) !== digestSfValue(selected.review)) return { status: "stale", reason: "requisition-review-changed" }
    return approvalPlan(current.value, selected.action)
  }
  return {
    async review(sourceRef: string, binding: TrustedDomainContext): Promise<PortResult<ProcurementApprovalReview>> {
      const current = await read(sourceRef, binding)
      return current.status === "ok" ? { status: "ok", value: structuredClone(current.value.review) } : current
    },
    prepare,
    async admission(incoming: ProcurementApprovalPlan, binding: TrustedDomainContext): Promise<PortResult<ProcurementApprovalAdmission>> {
      if (!approvalValue(incoming) || !exactKeys(incoming, ["kind", "command", "review", "action", "requiresExplicitAction", "approvalGranted", "receipt"]) || incoming.kind !== "procurement-pr-lifecycle-v1" || incoming.requiresExplicitAction !== true || incoming.approvalGranted !== false || incoming.receipt !== null) return { status: "needs-input", reason: "explicit-requisition-plan-required" }
      const selected = structuredClone(incoming)
      const prepared = await prepare({ review: selected.review, action: selected.action }, binding)
      if (prepared.status !== "ok") return prepared
      if (digestSfValue(prepared.value) !== digestSfValue(selected)) return { status: "denied", reason: "requisition-command-mismatch" }
      const request = input.host.requestFor(binding)
      if (!request || request.method !== "POST" || request.signal.aborted || !await input.host.revalidate(binding) || input.host.requestFor(binding) !== request) return { status: "denied", reason: "current-authority-unavailable" }
      let finished = false
      return { status: "ok", value: {
        current(snapshot, actor, command, environment) {
          if (finished || request.signal.aborted || input.host.requestFor(binding) !== request) return { status: "denied", reason: "current-authority-unavailable" }
          if (!approvalValue(command) || digestSfValue(command) !== digestSfValue(selected.command)) return { status: "denied", reason: "requisition-command-mismatch" }
          const current = snapshotReview(snapshot, actor, environment, selected.review.source, binding)
          if (current.status !== "ok") return current
          if (digestSfValue(current.value.review) !== digestSfValue(selected.review)) return { status: "stale", reason: "requisition-review-changed" }
          const plan = approvalPlan(current.value, selected.action)
          if (plan.status !== "ok") return plan
          if (digestSfValue(plan.value) !== digestSfValue(selected)) return { status: "stale", reason: "requisition-plan-changed" }
          finished = true
          return { status: "ok", value: true }
        },
        finish() { finished = true },
      } }
    },
  }
}

function approvalPlan(current: { review: ProcurementApprovalReview; requisition: Record<string, unknown> }, action: ProcurementApprovalAction): PortResult<ProcurementApprovalPlan> {
  const review = current.review
  if (!review.allowedActions.includes(action.kind)) return { status: "denied", reason: "requisition-action-unavailable" }
  if (action.kind === "save-estimate" && action.amount === review.amount) return { status: "needs-input", reason: "requisition-already-matches" }
  if (action.kind !== "save-estimate" && action.amount !== review.amount) return { status: "needs-input", reason: "requisition-amount-mismatch" }
  if (action.kind === "submit-current" && validatePR(current.requisition as Parameters<typeof validatePR>[0]).length) return { status: "needs-input", reason: "requisition-fields-incomplete" }
  if ((action.kind === "approve-submitted" || action.kind === "reject-submitted") && (review.submittedAmount !== action.amount || review.submittedCurrency !== review.currency || review.holderId !== action.holderId)) return { status: "needs-input", reason: "submitted-snapshot-mismatch" }
  const command: Command = {
    page: "Requests", id: review.source.target.recordId, version: review.domainVersion, confirmed: false,
    action: action.kind === "save-estimate" ? "save" : action.kind === "submit-current" ? "submit_pr" : action.kind === "approve-submitted" ? "approve" : "reject",
    values: action.kind === "save-estimate" ? { pr: { estAmount: action.amount } } : action.kind === "submit-current" ? {} : action.kind === "approve-submitted" ? { comment: action.comment } : { reason: action.reason },
  }
  return { status: "ok", value: { kind: "procurement-pr-lifecycle-v1", command, review: structuredClone(review), action: structuredClone(action), requiresExplicitAction: true, approvalGranted: false, receipt: null } }
}

function finiteApprovalAmount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function validApprovalAction(action: ProcurementApprovalAction) {
  if (!action || typeof action !== "object" || typeof action.amount !== "number" || !Number.isFinite(action.amount) || action.amount < 0) return false
  const keys = Object.keys(action).sort()
  if (action.kind === "save-estimate" || action.kind === "submit-current") return digestSfValue(keys) === digestSfValue(["amount", "kind"])
  if (action.kind !== "approve-submitted" && action.kind !== "reject-submitted") return false
  if (action.holderId !== null && (typeof action.holderId !== "string" || !action.holderId.trim())) return false
  if (action.kind === "approve-submitted") return typeof action.comment === "string" && digestSfValue(keys) === digestSfValue(["amount", "comment", "holderId", "kind"])
  return typeof action.reason === "string" && !!action.reason.trim() && digestSfValue(keys) === digestSfValue(["amount", "holderId", "kind", "reason"])
}

function exactKeys(value: unknown, keys: readonly string[]) {
  return !!value && typeof value === "object" && !Array.isArray(value) && digestSfValue(Object.keys(value).sort()) === digestSfValue([...keys].sort())
}

function validApprovalReview(review: ProcurementApprovalReview) {
  if (!exactKeys(review, ["kind", "source", "domainVersion", "stage", "amount", "currency", "submittedAmount", "submittedCurrency", "holderId", "allowedActions", "authorityDigest", "recordDigest", "policyDigest"])) return false
  if (review.kind !== "procurement-pr-review-v1" || !Number.isSafeInteger(review.domainVersion) || review.domainVersion < 0 || typeof review.stage !== "string" || !/^[A-Z]{3}$/.test(review.currency)) return false
  const source = review.source
  if (!source || source.kind !== "record" || source.schema !== "sf-evidence-v1" || typeof source.refId !== "string" || !source.refId || !source.target || source.target.surface !== "procurement" || source.target.recordType !== "procurement-request") return false
  if (![review.amount, review.submittedAmount].every((value) => value === null || typeof value === "number" && Number.isFinite(value))) return false
  if (review.submittedCurrency !== null && (typeof review.submittedCurrency !== "string" || !/^[A-Z]{3}$/.test(review.submittedCurrency))) return false
  if (review.holderId !== null && (typeof review.holderId !== "string" || !review.holderId.trim())) return false
  return Array.isArray(review.allowedActions) && review.allowedActions.every((value) => ["save-estimate", "submit-current", "approve-submitted", "reject-submitted"].includes(value)) && [review.authorityDigest, review.recordDigest, review.policyDigest].every((value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value))
}

// A malformed transport object must be refused before cloning, hashing or reading its fields.
function approvalValue(value: unknown, active = new WeakSet<object>(), depth = 0): boolean {
  if (depth > 24) return false
  if (value === null || typeof value === "string" || typeof value === "boolean") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (!value || typeof value !== "object" || active.has(value) || (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) || Object.getOwnPropertySymbols(value).length) return false
  active.add(value)
  const descriptors = Object.getOwnPropertyDescriptors(value)
  const valid = Object.values(descriptors).every((entry) => "value" in entry && approvalValue(entry.value, active, depth + 1))
  active.delete(value)
  return valid
}
