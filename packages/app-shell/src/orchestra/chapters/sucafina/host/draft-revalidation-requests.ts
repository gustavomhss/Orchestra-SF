import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { decodeRequestsPage, isPoWritable, isPrWritable, requestRef, requestVersion } from "../procurement/requests/model"
import { draftAvailability } from "./draft-revalidation-availability"

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
  if (input.identity.kind === "new" ? Object.keys(source).length !== 0 :
    Object.keys(source).length !== 1 || !("request" in source) || source.request !== input.identity.recordRef) return { status: "unavailable" }
  const fields = input.editScopeKey === "pr.details" ? prFields : poFields
  const prefix = input.editScopeKey === "pr.details" ? "pr." : "po."
  if (input.read.fieldPaths.some((path) => !fields.some((field) => path === prefix + field)))
    return { status: "unavailable" }
  const availability = draftAvailability(fresh, "procurement", "CAP25", ["domain.page.CAP25", "domain.command.CAP25." + action])
  if (availability) return availability
  const destination = fresh.destinations.find((item) => item.capabilityId === "CAP25" &&
    item.surface === "procurement" && item.page === "Requests" && item.canRead)
  if (!destination || !destination.allowedActionIds.includes(action)) return { status: "denied" }
  const result = await createSfProcurementClient(transport)["domain.page.CAP25"](
    input.identity.kind === "record" ? { request: input.identity.recordRef } : {}, { signal },
  ).catch(() => undefined)
  if (signal.aborted || !result || result.kind !== "response") return { status: "unavailable" }
  if (result.status === 401 || result.status === 403) return { status: "denied" }
  if (result.status !== 200) return { status: "unavailable" }
  const read = decodeRequestsPage(result.body, fresh.stamp)
  if (read.kind === "denied" || read.kind === "unauthenticated") return { status: "denied" }
  if (read.kind === "stale") return { status: result.body.status === "stale" ? "unavailable" : "authority-changed" }
  if (read.kind !== "ready") return { status: "unavailable" }
  if (result.body.status !== "ok" || (input.identity.kind === "new"
    ? Object.keys(result.body.value.selection).length !== 0
    : Object.keys(result.body.value.selection).length !== 1 ||
      result.body.value.selection.request !== input.identity.recordRef)) return { status: "unavailable" }
  if (!read.actionIds.includes(action)) return { status: "denied" }
  if (input.identity.kind === "new")
    return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: null }

  const ref = input.identity.recordRef
  const rows = read.records.filter((record) => requestRef(record) === ref)
  if (rows.length !== 1) return { status: "unavailable" }
  const row = rows[0]!
  const stages = input.editScopeKey === "pr.details" ? ["draft", "pr_rejected"] : ["po_draft", "po_rejected"]
  if (!stages.includes(row.status)) return { status: "denied" }
  // Older source revisions omit this optional proof; omission is not a revocation.
  if (row.allowedDraftActions === undefined) return { status: "unavailable" }
  if (!(input.editScopeKey === "pr.details" ? isPrWritable(row) : isPoWritable(row))) return { status: "denied" }
  const version = requestVersion(read, ref)
  if (version === undefined) return { status: "unavailable" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: version }
}
