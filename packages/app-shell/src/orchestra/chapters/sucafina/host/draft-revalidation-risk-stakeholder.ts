import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { draftAvailability } from "./draft-revalidation-availability"

const riskFields = ["title", "name", "action", "responsible", "desc", "category", "impact", "probability",
  "status", "owner", "ownerId", "leaderId", "mitigation", "due", "notes"]
const stakeholderFields = ["name", "position", "title", "company", "department", "role", "email", "biz", "iti",
  "perc", "priority", "owner", "action", "actions", "notes"]

export async function revalidateRiskStakeholderDraft(
  input: SfDraftRevalidationInput, fresh: SfContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  const risk = input.surfaceId === "CAP13" && input.read.operationId === "domain.page.CAP13"
  const stakeholder = input.surfaceId === "CAP15" && input.read.operationId === "domain.page.CAP15"
  if ((!risk && !stakeholder) || input.editScopeKey !== "native-record:" + input.surfaceId ||
      input.read.actionIds.length !== 1 || input.read.actionIds[0] !== "save" ||
      input.read.fieldPaths.some((field) => !(risk ? riskFields : stakeholderFields).includes(field)) ||
      input.identity.kind === "new" && (input.identity.newIntentRef !== "n16-new:" + input.surfaceId || input.read.fieldPaths.length))
    return { status: "unavailable" }
  const source = input.read.input
  if (!source || typeof source !== "object" || Array.isArray(source)) return { status: "unavailable" }
  const entries = Object.entries(source)
  if (entries.some(([key, value]) => !["q", "status", "filter", "owner"].includes(key) || typeof value !== "string"))
    return { status: "unavailable" }
  const selection = Object.fromEntries(entries)
  const pageName = risk ? "IT Risks" : "Stakeholder Management"
  const command = risk ? "domain.command.CAP13.save" : "domain.command.CAP15.save"
  const availability = draftAvailability(fresh, "domain-read", input.surfaceId, [input.read.operationId, command])
  if (availability) return availability
  if (!fresh.destinations.some((item) => item.capabilityId === input.surfaceId && item.surface === "dashboard" &&
      item.page === pageName && item.canRead && item.allowedActionIds.includes("save"))) return { status: "denied" }
  const client = createSfDomainClient(transport)
  const result = await (risk ? client["domain.page.CAP13"](selection, { signal }) :
    client["domain.page.CAP15"](selection, { signal })).catch(() => undefined)
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
  if (page.capabilityId !== input.surfaceId || entries.some(([key, value]) =>
    !Object.entries(page.selection).some(([selected, actual]) => selected === key && actual === value)))
    return { status: "unavailable" }
  if (!page.allowedActionIds.includes("save")) return { status: "denied" }
  if (input.identity.kind === "new")
    return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: null }
  const records = "risks" in page.data ? page.data.risks : "stakeholders" in page.data ? page.data.stakeholders : undefined
  if (!records) return { status: "unavailable" }
  const ref = input.identity.recordRef
  const rows = records.filter((row) => String(row.id) === ref)
  if (rows.length !== 1) return { status: "unavailable" }
  if (input.read.fieldPaths.some((field) => !Object.entries(rows[0]!).some(([key, value]) => key === field && value !== undefined)))
    return { status: "denied" }
  const version = page.versions[(risk ? "risks:" : "stakeholders:") + ref]
  if (!Number.isSafeInteger(version) || version < 0) return { status: "unavailable" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: version }
}
