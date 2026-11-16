import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { decodeRequestsPage, isPoWritable, isPrWritable, requestRef, requestVersion } from "../procurement/requests/model"

// Exactly the fields registered by requests/page.tsx, excluding the separately-owned title.
const prFields = ["type", "description", "estAmount", "costCenter", "needBy", "justification",
  "recurring", "frequency", "estAnnual", "expenseType", "category"]
const poFields = ["currency", "expenseType", "supplier", "supplierId", "description", "lines",
  "paymentTerms", "deliveryDate", "deliveryConditions", "contractRef", "incoterm", "incoterms",
  "assetRef", "supplierContact", "quoteRef", "billingAddress", "deliveryAddress", "acceptance", "warranty", "notes"]

export async function revalidateRequestsDraft(
  input: SfDraftRevalidationInput, fresh: SfContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (input.surfaceId !== "CAP25" || input.read.operationId !== "domain.page.CAP25" ||
      (input.editScopeKey !== "pr.details" && input.editScopeKey !== "po.fields")) return { status: "unavailable" }
  const creating = input.identity.kind === "new"
  const action = creating ? "create" : "save"
  if (creating && (input.editScopeKey !== "pr.details" || input.read.fieldPaths.length) ||
      input.read.actionIds.length !== 1 || input.read.actionIds[0] !== action) return { status: "unavailable" }
  const source = input.read.input
  if (!source || typeof source !== "object" || Array.isArray(source)) return { status: "unavailable" }
  if (creating ? Object.keys(source).length !== 0 :
    Object.keys(source).length !== 1 || source.request !== input.identity.recordRef) return { status: "unavailable" }
  const fields = input.editScopeKey === "pr.details" ? prFields : poFields
  const prefix = input.editScopeKey === "pr.details" ? "pr." : "po."
  if (input.read.fieldPaths.some((path) => !fields.some((field) => path === prefix + field)))
    return { status: "unavailable" }
  const destination = fresh.destinations.find((item) => item.capabilityId === "CAP25" && item.canRead)
  if (!destination || !destination.allowedActionIds.includes(action)) return { status: "denied" }
  if (!fresh.availability.some((resource) => resource.operations.some((operation) =>
    operation.operationId === "domain.page.CAP25" && operation.state === "ready" && operation.operational)))
    return { status: "denied" }
  const result = await createSfProcurementClient(transport)["domain.page.CAP25"](
    input.identity.kind === "record" ? { request: input.identity.recordRef } : {}, { signal },
  ).catch(() => undefined)
  if (signal.aborted || !result || result.kind !== "response") return { status: "unavailable" }
  if (result.status === 401 || result.status === 403) return { status: "denied" }
  if (result.status !== 200) return { status: "unavailable" }
  const read = decodeRequestsPage(result.body, fresh.stamp)
  if (read.kind === "denied" || read.kind === "unauthenticated") return { status: "denied" }
  if (read.kind === "stale") return { status: "authority-changed" }
  if (read.kind !== "ready") return { status: "unavailable" }
  if (!read.actionIds.includes(action)) return { status: "denied" }
  if (input.identity.kind === "new")
    return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: null }

  const ref = input.identity.recordRef
  const rows = read.records.filter((record) => requestRef(record) === ref)
  if (rows.length !== 1) return { status: "unavailable" }
  const row = rows[0]!
  if (!(input.editScopeKey === "pr.details" ? isPrWritable(row) : isPoWritable(row))) return { status: "denied" }
  const visible = input.editScopeKey === "pr.details" ? row.pr : row.po
  if (input.read.fieldPaths.some((path) => !visible || !Object.entries(visible).some(([key, value]) =>
    path === prefix + key && value !== undefined))) return { status: "denied" }
  const version = requestVersion(read, ref)
  if (version === undefined) return { status: "unavailable" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: version }
}
