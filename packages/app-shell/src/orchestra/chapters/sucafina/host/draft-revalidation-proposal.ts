import { Option, Schema } from "effect"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import type { SfContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { draftAvailability } from "./draft-revalidation-availability"

const readInput = SfDomain.operations["dashboard.dashboard-draft-read"].input
const draftInput = SfDomain.operations["dashboard.dashboard-hot-topic-draft"].input
const object = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined

/** Revalidate the original private C08 result retained across native admission. */
export async function revalidateProposalSave(
  input: SfDraftRevalidationInput, fresh: SfContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (signal.aborted || input.surfaceId !== "UI54" || input.identity.kind !== "record" ||
    input.editScopeKey !== "hot-topic-proposal:save-result" || input.read.operationId !== "dashboard.dashboard-draft-read" ||
    input.read.fieldPaths.length || input.read.actionIds.length) return { status: "unavailable" }
  const decoded = Schema.decodeUnknownOption(readInput, { onExcessProperty: "error" })(input.read.input)
  if (Option.isNone(decoded) || decoded.value.draftRef !== input.identity.recordRef) return { status: "unavailable" }
  const original = decoded.value
  const availability = draftAvailability(fresh, "domain-read", "hot-topic-proposal", ["dashboard.dashboard-draft-read"])
  if (availability) return availability
  if (!fresh.destinations.some((item) => item.capabilityId === "CAP02" && item.surface === "dashboard" &&
    item.page === "Hot Topics & Actions" && item.canRead)) return { status: "denied" }
  const response = await createSfDomainClient(transport)["dashboard.dashboard-draft-read"](original, { signal }).catch(() => undefined)
  if (signal.aborted || !response || response.kind !== "response") return { status: "unavailable" }
  if (response.status === 401 || response.status === 403 || response.body.status === "denied") return { status: "denied" }
  if (response.status !== 200 || response.body.status !== "ok") return { status: "unavailable" }
  const value = object(response.body.value), source = object(value?.originalSource), active = object(value?.draft)
  const actualCase = object(value?.caseRef)
  if (!active || !actualCase || actualCase.id !== original.caseRef.id || actualCase.incarnation !== original.caseRef.incarnation ||
    typeof actualCase.version !== "number" || actualCase.version < original.caseRef.version ||
    source?.refId !== original.targetEvidence.refId || source?.refDigest !== original.targetEvidence.refDigest) return { status: "unavailable" }
  const current = { caseRef: active.caseRef, target: active.target, targetEvidence: active.targetEvidence,
    fields: active.fields, sourceRefs: active.sourceRefs, expectedVersion: active.version, draftRef: active.draftRef }
  if (!Schema.is(draftInput)(current) || current.caseRef.id !== original.caseRef.id ||
    current.caseRef.incarnation !== original.caseRef.incarnation || current.caseRef.version > actualCase.version ||
    current.target.id !== original.targetEvidence.target.recordId ||
    current.target.incarnation !== original.targetEvidence.target.incarnation) return { status: "unavailable" }
  // The original PortResult has no context stamp. F02 fences this supplied
  // transport/generation, and F01 fences the signal/owner around revalidation.
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: current.expectedVersion }
}
