import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { draftAvailability } from "./draft-revalidation-availability"

const contractFields = ["name", "year"]
const itemFields = ["name", "description", "color", "totalWeight", "ownerWeight", "co1Weight", "co2Weight"]
const subFields = ["label", "objective", "description", "target", "totalWeight", "owner", "ownerWeight", "co1", "co1Weight",
  "co2", "co2Weight", "score", "status", "q1", "q2", "q3", "q4", "statusQ1", "statusQ2", "statusQ3", "statusQ4", "notes"]

export async function revalidatePerformanceDraft(
  input: SfDraftRevalidationInput, fresh: SfContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (input.surfaceId !== "CAP16" || input.read.operationId !== "domain.page.CAP16" ||
      input.read.actionIds.length !== 1) return { status: "unavailable" }
  const action = input.read.actionIds[0]
  if (action !== "save" && action !== "save-item" && action !== "save-sub") return { status: "unavailable" }
  const fields = action === "save" ? contractFields : action === "save-item" ? itemFields : subFields
  if (input.read.fieldPaths.some((field) => !fields.includes(field))) return { status: "unavailable" }
  const source = input.read.input
  if (!source || typeof source !== "object" || Array.isArray(source) || Object.keys(source).length) return { status: "unavailable" }
  const availability = draftAvailability(fresh, "domain-read", "CAP16", ["domain.page.CAP16", "domain.command.CAP16." + action])
  if (availability) return availability
  if (!fresh.destinations.some((item) => item.capabilityId === "CAP16" && item.surface === "dashboard" &&
      item.page === "IT Performance Contract" && item.canRead && item.allowedActionIds.includes(action))) return { status: "denied" }
  const result = await createSfDomainClient(transport)["domain.page.CAP16"]({}, { signal }).catch(() => undefined)
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
  if (page.capabilityId !== "CAP16" || !page.data.itperf) return { status: "unavailable" }
  if (!page.allowedActionIds.includes(action)) return { status: "denied" }
  // New nested entries still write against the shared itperf CAS, not null.
  // Their draft contract cannot safely report null until that conflict is modeled.
  if (input.identity.kind === "new") return { status: "unavailable" }
  const ref = input.identity.recordRef
  const sourceRow = (() => {
    if (action === "save") return ref === "itperf" && input.editScopeKey === "cap16:contract:root" ? page.data.itperf : undefined
    if (action === "save-item") {
      if (input.editScopeKey !== "cap16:item:" + ref) return undefined
      const items = page.data.itperf?.items?.filter((item) => item.id !== undefined && String(item.id) === ref) ?? []
      return items.length === 1 ? items[0] : undefined
    }
    const prefix = "cap16:sub:"
    if (!input.editScopeKey.startsWith(prefix)) return undefined
    const parent = input.editScopeKey.slice(prefix.length)
    const items = page.data.itperf?.items?.filter((item) => item.id !== undefined && String(item.id) === parent) ?? []
    if (items.length !== 1) return undefined
    const subs = items[0]!.subs?.filter((sub) => sub.id !== undefined && String(sub.id) === ref) ?? []
    return subs.length === 1 ? subs[0] : undefined
  })()
  if (!sourceRow) return { status: "unavailable" }
  if (input.read.fieldPaths.some((field) => !Object.entries(sourceRow).some(([key, value]) => key === field && value !== undefined)))
    return { status: "denied" }
  const version = page.versions.itperf
  if (version === undefined || !Number.isSafeInteger(version) || version < 0) return { status: "unavailable" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: version }
}
