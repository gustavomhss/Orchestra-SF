import type { Actor, Environment, Snapshot } from "../../runtime/contract.ts"
import { object, rows } from "../../runtime/contract.ts"
import { roleMap } from "../../runtime/admin.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ChoiceRecord } from "../contracts/decisions.ts"
import type { ScenarioOperation } from "../contracts/operations.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { SourceRef } from "../contracts/context.ts"
import { simulateDashboardCommand } from "./commands.ts"
import { hotTopicView } from "../../runtime/dashboard-people.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type Fields = { action: string; owner: string; due: string; priority: "critical" | "high" | "normal"; notes: string }
export type HotTopicDraft = {
  schema: "sf-hot-topic-draft-v1"
  id: string
  incarnation: string
  version: number
  draftRef: string
  caseRef: CaseRef
  caseScopeDigest: string
  target: SourceRef
  targetEvidence: Extract<BusinessEvidenceRef, { kind: "record" }>
  fields: Fields
  sourceRefs: readonly BusinessEvidenceRef[]
  principalRef: string
  accessRevision: string
  policyVersion: string
  createdAt: string
  recordDigest: string
}

export function hotTopicReceiptVersion(snapshot: Snapshot, actor: Actor, target: { surface: string; type: string; id: string }) {
  if (target.surface !== "dashboard" || target.type !== "hotTopics" || !target.id.trim()) return undefined
  const matches = hotTopicView(snapshot, actor).filter((row) => String(row.id) === target.id)
  const version = snapshot.versions[`hotTopics:${target.id}`]?.version
  if (matches.length !== 1 || version === undefined || !Number.isSafeInteger(version) || version < 0) return undefined
  return version
}

/** Resolves a selected draft as external evidence before choice; it never applies a domain change. */
export async function resolveHotTopicDraftOperation(input: {
  caseRef: CaseRef
  draftRef: string
  operation: ScenarioOperation
  actor: Actor
  context: TrustedDomainContext
  expectedAccessRevision: string
  expectedPolicyVersion: string
  readCurrent: (request: { caseRef: CaseRef; draftRef: string }, context: TrustedDomainContext) => Promise<PortResult<HotTopicDraft>>
  issueCurrentTarget: (target: { recordType: string; recordId: string; fields: readonly string[]; period: SourceRef["period"] }, context: TrustedDomainContext) => Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>>
}) {
  if (!input.draftRef.trim()) return { status: "needs-input" as const, reason: "hot-topic-draft-reference-required" as const }
  const loaded = await input.readCurrent({ caseRef: input.caseRef, draftRef: input.draftRef }, input.context).catch(() => undefined)
  if (!loaded || loaded.status !== "ok") return loaded ?? { status: "unavailable" as const, reason: "hot-topic-draft-unavailable" as const }
  const draft = loaded.value
  if (!input.actor.canWrite || !input.actor.roles.some((role) => role === "admin" || role === "domain leader")) return { status: "denied" as const, reason: "hot-topic-write-denied" as const }
  if (!["action", "owner", "due", "priority", "notes"].every((field) => draft.target.fields.includes(field) && draft.targetEvidence.target.fields.includes(field))) return { status: "denied" as const, reason: "hot-topic-target-fields-unavailable" as const }
  if (draft.recordDigest !== digestSfValue(Object.fromEntries(Object.entries(draft).filter(([key]) => key !== "recordDigest"))) || draft.draftRef !== input.draftRef || draft.caseRef.id !== input.caseRef.id || draft.caseRef.incarnation !== input.caseRef.incarnation || draft.caseRef.version > input.caseRef.version || draft.principalRef !== input.actor.id || draft.principalRef !== input.context.binding.principalRef || draft.accessRevision !== input.expectedAccessRevision || draft.accessRevision !== input.context.binding.accessRevision || draft.policyVersion !== input.expectedPolicyVersion || draft.policyVersion !== input.context.binding.policyVersion) return { status: "stale" as const, reason: "hot-topic-draft-binding-changed" as const }
  if (draft.target.surface !== "dashboard" || draft.target.type !== "hotTopics" || draft.targetEvidence.refDigest !== digestSfEvidenceRef(draft.targetEvidence) || draft.targetEvidence.target.surface !== "dashboard" || draft.targetEvidence.target.recordType !== "hotTopics" || draft.targetEvidence.target.recordId !== draft.target.id || draft.targetEvidence.target.incarnation !== draft.target.incarnation || draft.targetEvidence.target.version !== draft.target.version || !draft.sourceRefs.some((ref) => digestSfValue(ref) === digestSfValue(draft.targetEvidence))) return { status: "stale" as const, reason: "hot-topic-target-evidence-changed" as const }
  const issued = await input.issueCurrentTarget({ recordType: draft.target.type, recordId: draft.target.id, fields: draft.target.fields, period: draft.target.period }, input.context).catch(() => undefined)
  if (issued?.status === "denied") return { status: "denied" as const, reason: "hot-topic-target-access-revoked" as const }
  if (!issued || issued.status !== "ok" || digestSfValue(issued.value) !== digestSfValue(draft.targetEvidence)) return { status: "stale" as const, reason: "hot-topic-target-evidence-changed" as const }
  if (input.operation.kind !== "replace" || input.operation.targetRef !== draft.targetEvidence.refId || input.operation.replacementRef !== draft.draftRef) return { status: "conflict" as const, reason: "hot-topic-choice-binding-mismatch" as const }
  return { status: "ok" as const, value: { operationDigest: digestSfValue(input.operation), kind: "external" as const, sourceRefs: draft.sourceRefs, condition: "Financial impact of the Hot Topic change is not assessed." } }
}

/** The host must verify every source and bind the draft and choice under its C08 lock. */
export async function previewHotTopicDraft(input: {
  snapshot: Snapshot
  actor: Actor
  environment: Environment
  draft: HotTopicDraft
  choice: ChoiceRecord
  operation: ScenarioOperation
  caseRef: CaseRef
  expectedAccessRevision: string
  expectedPolicyVersion: string
  context: TrustedDomainContext
  issueCurrentTarget: (target: { recordType: string; recordId: string; fields: readonly string[]; period: SourceRef["period"] }, context: TrustedDomainContext) => Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>>
}) {
  const draft = input.draft
  if (!["action", "owner", "due", "priority", "notes"].every((field) => draft.target.fields.includes(field) && draft.targetEvidence.target.fields.includes(field))) return { status: "denied" as const, reason: "hot-topic-target-fields-unavailable" as const }
  if (draft.schema !== "sf-hot-topic-draft-v1" || !draft.id.trim() || !draft.incarnation.trim() || !draft.draftRef.trim() || !validVersion(draft.version) || !draft.principalRef.trim() || draft.principalRef !== input.actor.id || !draft.accessRevision || draft.accessRevision !== input.expectedAccessRevision || !draft.policyVersion || draft.policyVersion !== input.expectedPolicyVersion || !validVersion(draft.caseRef.version) || draft.caseRef.id !== input.caseRef.id || draft.caseRef.incarnation !== input.caseRef.incarnation || draft.caseRef.version > input.caseRef.version || !validVersion(draft.target.version) || draft.target.surface !== "dashboard" || draft.target.type !== "hotTopics" || !draft.target.id.trim() || !draft.target.incarnation.trim() || draft.targetEvidence.kind !== "record" || draft.targetEvidence.refDigest !== digestSfEvidenceRef(draft.targetEvidence) || draft.targetEvidence.target.surface !== draft.target.surface || draft.targetEvidence.target.recordType !== draft.target.type || draft.targetEvidence.target.recordId !== draft.target.id || draft.targetEvidence.target.incarnation !== draft.target.incarnation || draft.targetEvidence.target.version !== draft.target.version || !draft.sourceRefs.some((ref) => digestSfValue(ref) === digestSfValue(draft.targetEvidence)) || !draft.fields.action.trim() || !draft.fields.owner.trim() || !draft.fields.due.trim() || !["critical", "high", "normal"].includes(draft.fields.priority) || typeof draft.fields.notes !== "string") return { status: "stale" as const, reason: "hot-topic-draft-invalid-or-stale" as const }
  const recordDigest = digestSfValue(Object.fromEntries(Object.entries(draft).filter(([key]) => key !== "recordDigest")))
  if (draft.recordDigest !== recordDigest) return { status: "conflict" as const, reason: "hot-topic-draft-digest-mismatch" as const }
  if (draft.principalRef !== input.context.binding.principalRef || draft.accessRevision !== input.context.binding.accessRevision || draft.policyVersion !== input.context.binding.policyVersion) return { status: "denied" as const, reason: "hot-topic-draft-authority-changed" as const }
  const issued = await input.issueCurrentTarget({ recordType: draft.target.type, recordId: draft.target.id, fields: draft.target.fields, period: draft.target.period }, input.context).catch(() => undefined)
  if (issued?.status === "denied") return { status: "denied" as const, reason: "hot-topic-target-access-revoked" as const }
  if (!issued || issued.status !== "ok" || digestSfValue(issued.value) !== digestSfValue(draft.targetEvidence)) return { status: "stale" as const, reason: "hot-topic-target-evidence-changed" as const }
  const operations = input.choice.scenario.operations.filter((operation) => digestSfValue(operation) === digestSfValue(input.operation))
  if (operations.length !== 1 || input.operation.kind !== "replace" || input.operation.targetRef !== draft.targetEvidence.refId || input.operation.replacementRef !== draft.draftRef) return { status: "conflict" as const, reason: "hot-topic-choice-binding-mismatch" as const }
  const current = rows(input.snapshot.data.hotTopics).filter((row) => String(row.id) === draft.target.id)
  const identity = input.snapshot.sfSources?.records[JSON.stringify(["hotTopics", draft.target.id])]
  const scope = Object.values(input.snapshot.sfSources?.scopes ?? {}).filter((entry) => {
    const selector = object(entry.scope.selector)
    return entry.alive && entry.incarnation === draft.target.incarnation && entry.scope.principalRef === draft.principalRef && entry.scope.accessRevision === draft.accessRevision && entry.scope.policyVersion === draft.policyVersion && entry.scope.recordType === "hotTopics" && entry.scope.recordId === draft.target.id && selector.page === "Hot Topics & Actions" && digestSfValue(selector.actor) === digestSfValue(input.actor) && digestSfValue(selector.fields) === digestSfValue([...draft.target.fields].sort()) && digestSfValue(selector.period) === digestSfValue(draft.target.period) && selector.roleMapDigest === digestSfValue(roleMap(input.snapshot, "dashboard"))
  })
  const domainVersion = input.snapshot.versions[`hotTopics:${draft.target.id}`]?.version ?? 0
  if (current.length !== 1 || !identity?.alive || !scope.some((entry) => entry.version === draft.target.version && entry.inputDigest === draft.targetEvidence.target.projectionDigest && entry.sourceIncarnation === identity.incarnation)) return { status: "stale" as const, reason: "hot-topic-target-changed" as const }
  const command = { page: "Hot Topics & Actions", action: "save", id: draft.target.id, version: domainVersion, values: draft.fields }
  const preview = simulateDashboardCommand(input.snapshot, input.actor, command, input.environment)
  if (preview.status !== "preview") return preview
  return { status: "preview" as const, draftRef: draft.draftRef, recordDigest: draft.recordDigest, caseRef: input.caseRef, choiceRef: input.choice.id, operation: input.operation, command, preview }
}

function validVersion(value: number) {
  return Number.isSafeInteger(value) && value >= 0
}
