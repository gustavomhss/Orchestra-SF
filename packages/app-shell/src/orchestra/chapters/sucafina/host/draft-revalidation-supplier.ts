import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { bankFields, generalFields, supplierSourceFields, supplierVersion, uniqueSupplier } from "../procurement/suppliers/model"

export async function revalidateSupplierDraft(
  input: SfDraftRevalidationInput, fresh: SfContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (input.surfaceId !== "CAP27" || input.read.operationId !== "domain.page.CAP27" ||
      (input.editScopeKey !== "CAP27:general" && input.editScopeKey !== "CAP27:bank")) return { status: "unavailable" }
  const bank = input.editScopeKey === "CAP27:bank"
  const action = input.identity.kind === "new" ? "create" : bank ? "change-bank" : "save"
  if (input.read.actionIds.length !== 1 || input.read.actionIds[0] !== action ||
      input.identity.kind === "new" && (bank || input.identity.newIntentRef !== "CAP27:supplier-create" || input.read.fieldPaths.length))
    return { status: "unavailable" }
  const source = input.read.input
  if (!source || typeof source !== "object" || Array.isArray(source)) return { status: "unavailable" }
  if (input.identity.kind === "new" ? Object.keys(source).length !== 0 :
      Object.keys(source).length !== 1 || !("supplier" in source) || source.supplier !== input.identity.recordRef)
    return { status: "unavailable" }
  const knownFields: readonly string[] = bank ? bankFields : [...generalFields, "contacts", "commercial.notes", "compliance.notes"]
  if (input.read.fieldPaths.some((field) => !knownFields.includes(field))) return { status: "unavailable" }
  if (!fresh.destinations.some((item) => item.capabilityId === "CAP27" && item.surface === "procurement" &&
      item.page === "Suppliers" && item.canRead && item.allowedActionIds.includes(action)) ||
      !fresh.availability.some((resource) => resource.family === "procurement" && resource.resource === "CAP27" &&
        resource.state !== "denied" && resource.state !== "unavailable" && resource.operations.some((operation) =>
          operation.operationId === "domain.command.CAP27." + action && operation.state === "ready" && operation.operational)))
    return { status: "denied" }
  const result = await createSfProcurementClient(transport)["domain.page.CAP27"](
    input.identity.kind === "record" ? { supplier: input.identity.recordRef } : {}, { signal },
  ).catch(() => undefined)
  if (signal.aborted || !result || result.kind !== "response") return { status: "unavailable" }
  if (result.status === 401 || result.status === 403 || result.body.status === "denied" ||
      result.body.status === "unauthenticated") return { status: "denied" }
  if (result.status !== 200 || result.body.status !== "ok") return { status: "unavailable" }
  const stamp = result.body.context
  if (stamp.installationId !== fresh.stamp.installationId || stamp.projectId !== fresh.stamp.projectId ||
      stamp.hostId !== fresh.stamp.hostId || stamp.principalRef !== fresh.stamp.principalRef ||
      stamp.policyVersion !== fresh.stamp.policyVersion || stamp.accessRevision !== fresh.stamp.accessRevision)
    return { status: "authority-changed" }
  const page = result.body
  if (page.value.capabilityId !== "CAP27" || (input.identity.kind === "new"
    ? Object.keys(page.value.selection).length !== 0
    : Object.keys(page.value.selection).length !== 1 || page.value.selection.supplier !== input.identity.recordRef))
    return { status: "unavailable" }
  if (!page.value.allowedActionIds.includes(action) || bank && !page.value.data.bankVerificationAvailable)
    return { status: "denied" }
  if (input.identity.kind === "new")
    return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: null }
  const supplier = uniqueSupplier(page, input.identity.recordRef)
  if (!supplier) return { status: "unavailable" }
  const visible = supplierSourceFields(supplier, bank)
  if (input.read.fieldPaths.some((field) => !visible.includes(field))) return { status: "denied" }
  const version = supplierVersion(page, input.identity.recordRef)
  if (version === null) return { status: "unavailable" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: version }
}
