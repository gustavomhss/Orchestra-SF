import { Option, Schema } from "effect"
import { createSfOperationsClient } from "@orchestra/client/sucafina/operations"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { SfOperationsSelection } from "@orchestra/schema/sucafina/operations"
import type { SfContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { serviceListVersion, serviceMonthVersion, serviceTicketKeys } from "../operations/service/model"
import { draftAvailability } from "./draft-revalidation-availability"

export async function revalidateServiceDraft(
  input: SfDraftRevalidationInput, fresh: SfContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (input.surfaceId !== "CAP11" || input.read.operationId !== "domain.page.CAP11" || input.read.actionIds.length !== 1)
    return { status: "unavailable" }
  const action = input.read.actionIds[0]
  if (action !== "save-categories" && action !== "save-items" && action !== "save-tickets" &&
      action !== "save-sla" && action !== "save-heatmap") return { status: "unavailable" }
  const allowedFields = action === "save-categories" ? ["opsCats"] : action === "save-items" ? ["opsHmItems"] :
    action === "save-sla" ? ["incSLA", "svcSLA", "avail"] : ["item", "p1", "p2", "tickets", "comments"]
  if (input.read.fieldPaths.some((field) => action === "save-tickets" ?
    !/^[^|]+\|(Incidents|Service Requests)\|(Initial Balance|Open|Closed)$/.test(field) : !allowedFields.includes(field)))
    return { status: "unavailable" }
  const original = input.read.input
  if (!original || typeof original !== "object" || Array.isArray(original) ||
      Object.keys(original).some((key) => key !== "opsYear" && key !== "operationsMonth")) return { status: "unavailable" }
  const selection = Schema.decodeUnknownOption(SfOperationsSelection.CAP11, { onExcessProperty: "error" })(original)
  if (Option.isNone(selection)) return { status: "unavailable" }
  const availability = draftAvailability(fresh, "domain-read", "CAP11", ["domain.page.CAP11", "domain.command.CAP11." + action])
  if (availability) return availability
  if (!fresh.destinations.some((item) => item.capabilityId === "CAP11" && item.surface === "dashboard" &&
      item.page === "IT Operations" && item.canRead && item.allowedActionIds.includes(action))) return { status: "denied" }
  const result = await createSfOperationsClient(transport)["domain.page.CAP11"](selection.value, { signal }).catch(() => undefined)
  if (signal.aborted || !result || result.kind !== "response") return { status: "unavailable" }
  if (result.status === 401 || result.status === 403 || result.body.status === "unauthenticated" ||
      result.body.status === "denied") return { status: "denied" }
  if (result.status !== 200 || result.body.status !== "ok") return { status: "unavailable" }
  const stamp = result.body.context
  if (stamp.installationId !== fresh.stamp.installationId || stamp.projectId !== fresh.stamp.projectId ||
      stamp.hostId !== fresh.stamp.hostId || stamp.principalRef !== fresh.stamp.principalRef ||
      stamp.policyVersion !== fresh.stamp.policyVersion || stamp.accessRevision !== fresh.stamp.accessRevision)
    return { status: "authority-changed" }
  const page = result.body.value
  if (page.capabilityId !== "CAP11" || selection.value.opsYear !== undefined && selection.value.opsYear !== page.selection.year ||
      selection.value.operationsMonth !== undefined && selection.value.operationsMonth !== page.selection.month) return { status: "unavailable" }
  if (!page.allowedActionIds.some((id) => id === action)) return { status: "denied" }
  // A missing month row still uses the aggregate operations CAS, not a null new-record CAS.
  if (input.identity.kind === "new") return { status: "unavailable" }
  const ref = input.identity.recordRef
  const scope = "CAP11:" + action + ":" + page.selection.year + "-" + page.selection.month
  if (action === "save-categories" || action === "save-items") {
    const collection = action === "save-categories" ? "opsCats" : "opsHmItems"
    if (ref !== collection || input.editScopeKey !== scope || !page.data[collection]) return { status: "unavailable" }
    return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: serviceListVersion(page, collection) }
  }
  const rows = action === "save-tickets" ? page.data.opsTickets : action === "save-sla" ? page.data.opsSLA : page.data.opsHeatmap
  if (!rows) return { status: "unavailable" }
  const matched = rows.filter((row) => (typeof row.id === "string" || typeof row.id === "number") && String(row.id) === ref &&
    row.year === page.selection.year && row.month === page.selection.month)
  if (matched.length !== 1) return { status: "unavailable" }
  const row = matched[0]!
  const item = action === "save-heatmap" && "item" in row ? row.item : undefined
  if (input.editScopeKey !== scope + (action === "save-heatmap" ? ":" + item : "") ||
      action === "save-heatmap" && typeof item !== "string") return { status: "unavailable" }
  if (action === "save-tickets" && (!page.data.opsCats || input.read.fieldPaths.some((field) => !serviceTicketKeys(page).includes(field))))
    return { status: "unavailable" }
  if (input.read.fieldPaths.some((field) => !Object.entries(row).some(([key, value]) => key === field && value !== undefined)))
    return { status: "denied" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: serviceMonthVersion(page) }
}
