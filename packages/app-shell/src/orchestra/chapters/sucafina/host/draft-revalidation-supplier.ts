import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"

// Existing supplier registrations track only "id", not the actual editable
// fieldset; they cannot prove retained fields survived source redaction.
export async function revalidateSupplierCreateDraft(
  input: SfDraftRevalidationInput, fresh: SfContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (input.surfaceId !== "CAP27" || input.read.operationId !== "domain.page.CAP27" ||
      input.editScopeKey !== "CAP27:general" || input.identity.kind !== "new" ||
      input.identity.newIntentRef !== "CAP27:supplier-create" || input.read.fieldPaths.length ||
      input.read.actionIds.length !== 1 || input.read.actionIds[0] !== "create") return { status: "unavailable" }
  const source = input.read.input
  if (!source || typeof source !== "object" || Array.isArray(source) || Object.keys(source).length)
    return { status: "unavailable" }
  if (!fresh.destinations.some((item) => item.capabilityId === "CAP27" && item.surface === "procurement" &&
      item.page === "Suppliers" && item.canRead && item.allowedActionIds.includes("create")) ||
      !fresh.availability.some((resource) => resource.family === "procurement" && resource.resource === "CAP27" &&
        resource.state !== "denied" && resource.state !== "unavailable" && resource.operations.some((operation) =>
          operation.operationId === "domain.command.CAP27.create" && operation.state === "ready" && operation.operational)))
    return { status: "denied" }
  const result = await createSfProcurementClient(transport)["domain.page.CAP27"]({}, { signal }).catch(() => undefined)
  if (signal.aborted || !result || result.kind !== "response") return { status: "unavailable" }
  if (result.status === 401 || result.status === 403 || result.body.status === "denied" ||
      result.body.status === "unauthenticated") return { status: "denied" }
  if (result.status !== 200 || result.body.status !== "ok") return { status: "unavailable" }
  const stamp = result.body.context
  if (stamp.installationId !== fresh.stamp.installationId || stamp.projectId !== fresh.stamp.projectId ||
      stamp.hostId !== fresh.stamp.hostId || stamp.principalRef !== fresh.stamp.principalRef ||
      stamp.policyVersion !== fresh.stamp.policyVersion || stamp.accessRevision !== fresh.stamp.accessRevision)
    return { status: "authority-changed" }
  if (result.body.value.capabilityId !== "CAP27" || Object.keys(result.body.value.selection).length)
    return { status: "unavailable" }
  if (!result.body.value.allowedActionIds.includes("create")) return { status: "denied" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: null }
}
