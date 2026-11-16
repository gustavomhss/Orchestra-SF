import { Option, Schema } from "effect"
import { createSfOperationsClient } from "@orchestra/client/sucafina/operations"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { SfOperationsSelection } from "@orchestra/schema/sucafina/operations"
import type { SfContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { SECURITY_CAMPAIGN_FIELDS, SECURITY_KPI_FIELDS, securityVersion } from "../operations/security/model"
import { draftAvailability } from "./draft-revalidation-availability"

const kpiFields = [...SECURITY_KPI_FIELDS, "notes"]
const actionFields = ["text", "done"]
const incidentFields = ["title", "date", "impact", "notes", "contained", "remediated", "rootCause", "consequences"]
const campaignFields = ["name", "start", "end", "notes", ...SECURITY_CAMPAIGN_FIELDS, "departments"]
export async function revalidateSecurityDraft(
  input: SfDraftRevalidationInput, fresh: SfContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (input.surfaceId !== "CAP12" || input.read.operationId !== "domain.page.CAP12" || input.read.actionIds.length !== 1)
    return { status: "unavailable" }
  const action = input.read.actionIds[0]
  const entity = action === "save-kpi" || action === "delete-kpi" ? "kpi" :
    action === "save-action" || action === "delete-action" ? "action" :
    action === "save-incident" || action === "delete-incident" ? "incident" :
    action === "save-campaign" || action === "delete-campaign" ? "campaign" : undefined
  if (!entity) return { status: "unavailable" }
  const fields = entity === "kpi" ? kpiFields : entity === "action" ? actionFields : entity === "incident" ? incidentFields : campaignFields
  if (input.read.fieldPaths.some((field) => !fields.includes(field))) return { status: "unavailable" }
  // Department rows have no stable identity or individual retained-field paths.
  if (input.read.fieldPaths.includes("departments")) return { status: "unavailable" }
  const original = input.read.input
  if (!original || typeof original !== "object" || Array.isArray(original) ||
      Object.keys(original).some((key) => key !== "secYear" && key !== "securityMonth")) return { status: "unavailable" }
  const selection = Schema.decodeUnknownOption(SfOperationsSelection.CAP12, { onExcessProperty: "error" })(original)
  if (Option.isNone(selection)) return { status: "unavailable" }
  const availability = draftAvailability(fresh, "domain-read", "CAP12", ["domain.page.CAP12", "domain.command.CAP12." + action])
  if (availability) return availability
  if (!fresh.destinations.some((item) => item.capabilityId === "CAP12" && item.surface === "dashboard" &&
      item.page === "IT Security KPIs" && item.canRead && item.allowedActionIds.includes(action))) return { status: "denied" }
  const result = await createSfOperationsClient(transport)["domain.page.CAP12"](selection.value, { signal }).catch(() => undefined)
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
  if (page.capabilityId !== "CAP12" || selection.value.secYear !== undefined && selection.value.secYear !== page.selection.year ||
      selection.value.securityMonth !== undefined && selection.value.securityMonth !== page.selection.month) return { status: "unavailable" }
  if (!page.allowedActionIds.some((id) => id === action)) return { status: "denied" }
  if (input.identity.kind === "new") {
    // KPI is a month upsert governed by shared CAS; other save actions create
    // a fresh id and use the producer's zero-version create contract.
    const scope = "CAP12:" + action + ":" + page.selection.year + ":" + page.selection.month + ":new"
    if (entity === "kpi" || !action.startsWith("save-") || input.editScopeKey !== scope ||
        input.identity.newIntentRef !== "u29:" + scope || input.read.fieldPaths.length ||
        securityVersion(page, entity) !== 0) return { status: "unavailable" }
    return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: null }
  }
  const ref = input.identity.recordRef
  if (input.editScopeKey !== "CAP12:" + action + ":" + page.selection.year + ":" + page.selection.month + ":" + ref)
    return { status: "unavailable" }
  const rows = entity === "kpi" ? page.data.secKpi : entity === "action" ? page.data.secActions :
    entity === "incident" ? page.data.secIncidents : page.data.secPhishing
  if (!rows) return { status: "unavailable" }
  const matched = rows.filter((row) => row.id !== undefined && row.id !== null && String(row.id) === ref &&
    (entity !== "kpi" || "year" in row && row.year === page.selection.year && "month" in row && row.month === page.selection.month))
  if (matched.length !== 1) return { status: "unavailable" }
  if (input.read.fieldPaths.some((field) => !Object.entries(matched[0]!).some(([key, value]) => key === field && value !== undefined)))
    return { status: "denied" }
  const version = securityVersion(page, entity, ref)
  if (!Number.isSafeInteger(version) || version < 0) return { status: "unavailable" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: version }
}
