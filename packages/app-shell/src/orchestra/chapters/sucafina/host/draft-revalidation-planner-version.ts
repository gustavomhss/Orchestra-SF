import { createSfPlannerClient } from "@orchestra/client/sucafina/planner"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfReadableContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { draftAvailability } from "./draft-revalidation-availability"

export async function revalidatePlannerVersionDraft(
  input: SfDraftRevalidationInput, fresh: SfReadableContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (input.surfaceId !== "CAP23" || input.read.operationId !== "domain.page.CAP23" ||
      input.identity.kind !== "record" || input.read.actionIds.length !== 1 || input.read.actionIds[0] !== "save" ||
      input.read.fieldPaths.length !== 2 || input.read.fieldPaths[0] !== "name" || input.read.fieldPaths[1] !== "year")
    return { status: "unavailable" }
  const source = input.read.input
  if (!source || typeof source !== "object" || Array.isArray(source) ||
      Object.keys(source).some((key) => key !== "year")) return { status: "unavailable" }
  const year = "year" in source ? source.year : undefined
  if (year !== undefined && (typeof year !== "number" || !Number.isSafeInteger(year))) return { status: "unavailable" }
  const availability = draftAvailability(fresh, "planner", "CAP23", ["domain.page.CAP23", "domain.command.CAP23.save"])
  if (availability) return availability
  if (!fresh.destinations.some((item) => item.capabilityId === "CAP23" && item.surface === "planner" &&
      item.page === "Versions" && item.canRead && item.allowedActionIds.includes("save")))
    return { status: "denied" }
  const result = await createSfPlannerClient(transport)["domain.page.CAP23"](
    typeof year === "number" ? { year } : {}, { signal },
  ).catch(() => undefined)
  if (signal.aborted || !result || result.kind !== "response") return { status: "unavailable" }
  if (result.status === 401 || result.status === 403 || result.body.status === "unauthenticated" ||
      result.body.status === "denied") return { status: "denied" }
  if (result.status !== 200 || result.body.status !== "ok") return { status: "unavailable" }
  const page = result.body.value
  const stamp = result.body.context
  if (stamp.installationId !== fresh.stamp.installationId || stamp.projectId !== fresh.stamp.projectId ||
      stamp.hostId !== fresh.stamp.hostId || stamp.principalRef !== fresh.stamp.principalRef ||
      stamp.policyVersion !== fresh.stamp.policyVersion || stamp.accessRevision !== fresh.stamp.accessRevision)
    return { status: "authority-changed" }
  if (page.capabilityId !== "CAP23" || year !== undefined && page.selection.year !== year) return { status: "unavailable" }
  if (!page.allowedActionIds.includes("save")) return { status: "denied" }
  const ref = input.identity.recordRef
  const rows = page.data.versions.filter((row) => row.id === ref)
  if (rows.length !== 1) return { status: "unavailable" }
  const row = rows[0]!
  if (input.editScopeKey !== "planner:" + row.year + ":" + row.id) return { status: "unavailable" }
  // The original version editor's producer uses zero for a never-written CAS key.
  const version = page.versions["versions:" + row.id]?.version ?? 0
  if (!Number.isSafeInteger(version) || version < 0) return { status: "unavailable" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: version }
}
