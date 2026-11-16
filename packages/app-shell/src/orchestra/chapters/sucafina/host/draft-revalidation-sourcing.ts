import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { editableStages, isSourcingSourceField, requestVersion, sourcingSourceFields, uniqueRequest } from "../procurement/sourcing/model"
import { draftAvailability } from "./draft-revalidation-availability"

export async function revalidateSourcingDraft(
  input: SfDraftRevalidationInput, fresh: SfContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (input.surfaceId !== "CAP25" || input.read.operationId !== "domain.page.CAP25" ||
      input.editScopeKey !== "CAP25:sourcing" || input.identity.kind !== "record" ||
      input.read.actionIds.length !== 1 || input.read.actionIds[0] !== "save" ||
      input.read.fieldPaths.some((field) => !isSourcingSourceField(field))) return { status: "unavailable" }
  const source = input.read.input
  if (!source || typeof source !== "object" || Array.isArray(source) ||
      Object.keys(source).length !== 1 || !("request" in source) || source.request !== input.identity.recordRef)
    return { status: "unavailable" }
  const availability = draftAvailability(fresh, "procurement", "CAP25", ["domain.page.CAP25", "domain.command.CAP25.save"])
  if (availability) return availability
  if (!fresh.destinations.some((item) => item.capabilityId === "CAP25" && item.surface === "procurement" &&
      item.page === "Requests" && item.canRead && item.allowedActionIds.includes("save")))
    return { status: "denied" }
  const result = await createSfProcurementClient(transport)["domain.page.CAP25"](
    { request: input.identity.recordRef }, { signal },
  ).catch(() => undefined)
  if (signal.aborted || !result || result.kind !== "response") return { status: "unavailable" }
  if (result.status === 401 || result.status === 403 || result.body.status === "unauthenticated" ||
      result.body.status === "denied") return { status: "denied" }
  if (result.status !== 200 || result.body.status !== "ok") return { status: "unavailable" }
  const page = result.body
  const stamp = page.context
  if (stamp.installationId !== fresh.stamp.installationId || stamp.projectId !== fresh.stamp.projectId ||
      stamp.hostId !== fresh.stamp.hostId || stamp.principalRef !== fresh.stamp.principalRef ||
      stamp.policyVersion !== fresh.stamp.policyVersion || stamp.accessRevision !== fresh.stamp.accessRevision)
    return { status: "authority-changed" }
  if (page.value.capabilityId !== "CAP25" || Object.keys(page.value.selection).length !== 1 ||
      page.value.selection.request !== input.identity.recordRef) return { status: "unavailable" }
  if (!page.value.allowedActionIds.includes("save")) return { status: "denied" }
  const row = uniqueRequest(page, input.identity.recordRef)
  if (!row) return { status: "unavailable" }
  if (!editableStages.some((stage) => stage === row.status)) return { status: "denied" }
  if (row.allowedDraftActions === undefined) return { status: "unavailable" }
  if (row.allowedDraftActions?.includes("save-sourcing") !== true) return { status: "denied" }
  const visible = sourcingSourceFields(row)
  if (!visible) return { status: "unavailable" }
  const version = requestVersion(page, input.identity.recordRef)
  if (version === null) return { status: "unavailable" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: version }
}
