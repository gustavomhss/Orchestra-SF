import { Option, Schema } from "effect"
import { SfDashboardDashboardDraftRead, SfDashboardDashboardHotTopicDraft } from "@orchestra/schema/sucafina/domain"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { object } from "../dashboard/hot-topics/proposals/private-draft-model"

const fields = ["action", "owner", "due", "priority", "notes"]
/** Read retention only: a withdrawn write permission never grants a save or purges readable unsent values. */
export async function revalidatePrivateHotTopicDraft(
  input: SfDraftRevalidationInput, fresh: SfContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (signal.aborted || input.surfaceId !== "UI54" || input.editScopeKey !== "UI54:private-hot-topic" ||
    input.read.operationId !== "dashboard.dashboard-draft-read" || input.read.actionIds.length ||
    input.read.fieldPaths.length !== fields.length || !fields.every((field) => input.read.fieldPaths.includes(field))) return { status: "unavailable" }
  const decoded = Schema.decodeUnknownOption(SfDashboardDashboardDraftRead.input, { onExcessProperty: "error" })(input.read.input)
  if (Option.isNone(decoded)) return { status: "unavailable" }
  const selected = decoded.value, original = selected.targetEvidence
  if (original.installationId !== fresh.stamp.installationId || original.projectId !== fresh.stamp.projectId ||
    original.target.surface !== "dashboard" || original.target.recordType !== "hotTopics" || original.evidenceLevel !== "observed" ||
    input.identity.kind === "record" && !selected.draftRef || input.identity.kind === "new" && !!selected.draftRef) return { status: "unavailable" }
  if (!fresh.availability.some((resource) => resource.family === "domain-read" && resource.resource === "hot-topic-proposal" &&
    resource.operations.some((entry) => entry.operationId === "dashboard.dashboard-draft-read" && entry.state === "ready" && entry.operational)))
    return { status: "unavailable" }
  const response = await createSfDomainClient(transport)["dashboard.dashboard-draft-read"](selected, { signal }).catch(() => undefined)
  if (signal.aborted || !response || response.kind !== "response") return { status: "unavailable" }
  if (response.status === 401 || response.status === 403 || response.body.status === "denied") return { status: "denied" }
  if (response.status !== 200 || response.body.status !== "ok") return { status: "unavailable" }
  const result = object(response.body.value), previous = object(result?.originalSource)
  if (!result || previous?.refId !== original.refId || previous?.refDigest !== original.refDigest) return { status: "unavailable" }
  const source = Schema.decodeUnknownOption(SfDashboardDashboardDraftRead.input, { onExcessProperty: "error" })({
    caseRef: result.caseRef, targetEvidence: result.currentSource,
  })
  if (Option.isNone(source) || source.value.caseRef.id !== selected.caseRef.id ||
    source.value.caseRef.incarnation !== selected.caseRef.incarnation ||
    source.value.targetEvidence.installationId !== fresh.stamp.installationId ||
    source.value.targetEvidence.projectId !== fresh.stamp.projectId ||
    source.value.targetEvidence.evidenceLevel !== "observed" ||
    source.value.targetEvidence.target.surface !== original.target.surface ||
    source.value.targetEvidence.target.recordType !== original.target.recordType ||
    source.value.targetEvidence.target.recordId !== original.target.recordId) return { status: "unavailable" }
  // The canonical read above proves the original physical record. Its newly
  // issued C02 scope incarnation may change after write authority is withdrawn.
  let sourceVersion = 0
  if (input.identity.kind === "record") {
    const draft = object(result.draft)
    if (!draft || draft.id !== input.identity.recordRef || typeof draft.incarnation !== "string" ||
      !draft.incarnation || typeof draft.draftRef !== "string" || typeof draft.version !== "number" ||
      !Number.isSafeInteger(draft.version) || draft.version < 1) return { status: "unavailable" }
    const checked = Schema.decodeUnknownOption(SfDashboardDashboardHotTopicDraft.input, { onExcessProperty: "error" })({
      caseRef: draft.caseRef, target: draft.target, targetEvidence: draft.targetEvidence,
      fields: draft.fields, sourceRefs: draft.sourceRefs, draftRef: draft.draftRef, expectedVersion: draft.version,
    })
    if (Option.isNone(checked) || checked.value.caseRef.id !== selected.caseRef.id ||
      checked.value.caseRef.incarnation !== selected.caseRef.incarnation) return { status: "unavailable" }
    sourceVersion = draft.version
  } else if (result.draft !== undefined) return { status: "unavailable" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion }
}
