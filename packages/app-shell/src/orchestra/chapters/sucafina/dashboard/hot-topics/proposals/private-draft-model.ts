import { Option, Schema } from "effect"
import { SfDashboardDashboardHotTopicDraft, SfDashboardDashboardDraftRead,
  SfDashboardDashboardHotTopicDraftOutcome } from "@orchestra/schema/sucafina/domain"

export type DraftRequest = Schema.Schema.Type<typeof SfDashboardDashboardHotTopicDraft.input>
export type DraftReadRequest = Schema.Schema.Type<typeof SfDashboardDashboardDraftRead.input>
export type CaseRef = DraftRequest["caseRef"]
export type Fields = DraftRequest["fields"]
export type DraftValue = Readonly<{ request: DraftRequest; id: string | null; incarnation: string | null }>
export type Source = Readonly<{ label: string; sourceRef: string; draft: unknown }>
export type Candidate = Readonly<{ label: string; value: DraftValue }>
export type Permissions = Readonly<{ draft: boolean; prepare: boolean; apply: boolean; capture: boolean; preserve: boolean }>
export type Workbench = Readonly<{
  cases: readonly Readonly<{ label: string; caseRef: CaseRef }>[]
  records: readonly Source[]
  drafts: readonly Candidate[]
  permissions: Permissions
}>
export type CurrentRead = Readonly<{
  current: DraftValue; sourceFields: Fields; permissions: Permissions
}>

const sameJson = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right))
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, index) => sameJson(item, right[index]))
  const a = object(left), b = object(right)
  return !!a && !!b && Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every((key) => Object.hasOwn(b, key) && sameJson(a[key], b[key]))
}
export function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}
const text = (value: unknown): value is string => typeof value === "string" && !!value.trim()
const decodeDraft = (value: unknown) => Schema.decodeUnknownOption(SfDashboardDashboardHotTopicDraft.input, { onExcessProperty: "error" })(value)
const sameCase = (a: CaseRef, b: CaseRef) => a.id === b.id && a.incarnation === b.incarnation
// The original producer proves physical continuity. C02 scope incarnations may
// change when authority/field scope changes without replacing the record.
const evidenceMatches = (value: DraftRequest["targetEvidence"], expected: DraftRequest["targetEvidence"]) =>
  value.installationId === expected.installationId && value.projectId === expected.projectId &&
  value.target.surface === expected.target.surface && value.target.recordType === expected.target.recordType &&
  value.target.recordId === expected.target.recordId && value.target.incarnation === expected.target.incarnation

export function readSelection(value: DraftValue): DraftReadRequest {
  return { caseRef: value.request.caseRef, targetEvidence: value.request.targetEvidence,
    ...(value.request.draftRef ? { draftRef: value.request.draftRef } : {}) }
}

function validTarget(request: DraftRequest) {
  const source = request.targetEvidence
  return source.evidenceLevel === "observed" && source.target.surface === "dashboard" && source.target.recordType === "hotTopics" &&
    source.target.recordId === request.target.id && source.target.incarnation === request.target.incarnation &&
    source.target.version === request.target.version &&
    request.fields.action.trim() && request.fields.owner.trim() && /^\d{4}-\d{2}-\d{2}$/.test(request.fields.due) &&
    request.sourceRefs.some((entry) => entry.refId === source.refId && entry.refDigest === source.refDigest)
}

export function copyPrivateDraft(value: DraftValue): DraftValue {
  const decoded = decodeDraft(JSON.parse(JSON.stringify(value.request)))
  if (Option.isNone(decoded)) throw new Error("SF_PRIVATE_DRAFT_CONTRACT_CHANGED")
  return { request: decoded.value, id: value.id, incarnation: value.incarnation }
}

export function sourceDraft(source: Source, caseRef: CaseRef): DraftValue | undefined {
  const draft = object(source.draft)
  if (!draft) return
  const decoded = decodeDraft({
    caseRef, target: draft.target, targetEvidence: draft.targetEvidence, fields: draft.fields,
    sourceRefs: [draft.targetEvidence], expectedVersion: 0,
  })
  if (Option.isNone(decoded) || !validTarget(decoded.value)) return
  return { request: decoded.value, id: null, incarnation: null }
}

function storedDraft(raw: unknown): DraftValue | undefined {
  const row = object(raw)
  if (!row || !text(row.id) || !text(row.incarnation) || !text(row.draftRef) ||
      typeof row.version !== "number" || !Number.isSafeInteger(row.version) || row.version < 1) return
  const decoded = decodeDraft({
    caseRef: row.caseRef, target: row.target, targetEvidence: row.targetEvidence, fields: row.fields,
    sourceRefs: row.sourceRefs, expectedVersion: row.version, draftRef: row.draftRef,
  })
  if (Option.isNone(decoded) || !validTarget(decoded.value)) return
  return { request: decoded.value, id: row.id, incarnation: row.incarnation }
}

export function decodePrivateWorkbench(raw: unknown): Workbench | undefined {
  const root = object(raw), decisions = object(root?.decisions), actions = object(decisions?.permissions)
  const capture = object(root?.permissions)
  if (!root || !decisions || !actions || !capture || !Array.isArray(root.records) ||
    !Array.isArray(decisions.cases) || !Array.isArray(decisions.drafts) ||
    ["draft", "prepare", "apply"].some((key) => typeof actions[key] !== "boolean") ||
    ["capture", "preserve"].some((key) => typeof capture[key] !== "boolean")) return
  const cases: Workbench["cases"][number][] = []
  for (const rawCase of decisions.cases) {
    const candidate = object(rawCase)
    const decoded = Schema.decodeUnknownOption(SfDashboardDashboardHotTopicDraftOutcome.input, { onExcessProperty: "error" })({ caseRef: candidate?.caseRef })
    if (!candidate || !text(candidate.label) || Option.isNone(decoded)) return
    cases.push({ label: candidate.label, caseRef: decoded.value.caseRef })
  }
  const records: Source[] = []
  for (const rawSource of root.records) {
    const source = object(rawSource)
    if (!source || !text(source.label) || !text(source.sourceRef)) return
    records.push({ label: source.label, sourceRef: source.sourceRef, draft: source.draft })
  }
  const drafts: Candidate[] = []
  for (const rawDraft of decisions.drafts) {
    const entry = object(rawDraft), value = storedDraft(rawDraft)
    if (!entry || !text(entry.label) || !value || !cases.some((item) => sameCase(item.caseRef, value.request.caseRef))) return
    drafts.push({ label: entry.label, value })
  }
  return { cases, records, drafts, permissions: {
    draft: actions.draft === true, prepare: actions.prepare === true, apply: actions.apply === true,
    capture: capture.capture === true, preserve: capture.preserve === true,
  } }
}

export function decodeCurrentPrivateDraft(raw: unknown, original: DraftValue): CurrentRead | undefined {
  const root = object(raw), originalSource = object(root?.originalSource), source = object(root?.source)
  const actions = object(root?.permissions)
  if (!root || !source || !actions || ["draft", "prepare", "apply", "capture", "preserve"].some((key) => typeof actions[key] !== "boolean") ||
    originalSource?.refId !== original.request.targetEvidence.refId ||
    originalSource?.refDigest !== original.request.targetEvidence.refDigest) return
  const caseValue = Schema.decodeUnknownOption(SfDashboardDashboardHotTopicDraftOutcome.input, { onExcessProperty: "error" })({ caseRef: root.caseRef })
  if (Option.isNone(caseValue) || !sameCase(caseValue.value.caseRef, original.request.caseRef)) return
  if (!text(source.label) || !text(source.sourceRef)) return
  const freshSource = sourceDraft({ label: source.label, sourceRef: source.sourceRef, draft: source.draft }, caseValue.value.caseRef)
  if (!freshSource || !evidenceMatches(freshSource.request.targetEvidence, original.request.targetEvidence) ||
    !sameJson(root.currentSource, freshSource.request.targetEvidence)) return
  const persisted = root.draft === undefined ? undefined : storedDraft(root.draft)
  if (original.request.draftRef && (!persisted || persisted.id !== original.id || persisted.incarnation !== original.incarnation ||
      !sameCase(persisted.request.caseRef, original.request.caseRef))) return
  if (!original.request.draftRef && persisted) return
  const selected = persisted ?? freshSource
  const sourceRefs = selected.request.sourceRefs.map((entry) =>
    entry.refId === selected.request.targetEvidence.refId && entry.refDigest === selected.request.targetEvidence.refDigest
      ? freshSource.request.targetEvidence : entry)
  const next = decodeDraft({ ...selected.request, caseRef: caseValue.value.caseRef, target: freshSource.request.target,
    targetEvidence: freshSource.request.targetEvidence, sourceRefs })
  if (Option.isNone(next) || !validTarget(next.value)) return
  return {
    current: { request: next.value, id: selected.id, incarnation: selected.incarnation },
    sourceFields: freshSource.request.fields,
    permissions: { draft: actions.draft === true, prepare: actions.prepare === true, apply: actions.apply === true,
      capture: actions.capture === true, preserve: actions.preserve === true },
  }
}

export function changedPrivateBase(a: DraftValue, b: DraftValue) {
  return a.id !== b.id || a.incarnation !== b.incarnation || a.request.draftRef !== b.request.draftRef ||
    a.request.expectedVersion !== b.request.expectedVersion ||
    !sameCase(a.request.caseRef, b.request.caseRef) || a.request.caseRef.version !== b.request.caseRef.version ||
    a.request.targetEvidence.refId !== b.request.targetEvidence.refId ||
    a.request.targetEvidence.refDigest !== b.request.targetEvidence.refDigest
}

export function privateFieldsValid(fields: Fields) {
  return fields.action.trim().length > 0 && fields.action.length <= 16384 &&
    fields.owner.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(fields.due) &&
    ["critical", "high", "normal"].includes(fields.priority) && fields.notes.length <= 16384
}
