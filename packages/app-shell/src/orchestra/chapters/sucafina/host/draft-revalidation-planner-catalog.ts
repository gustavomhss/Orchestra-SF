import { Option, Schema } from "effect"
import { createSfPlannerClient } from "@orchestra/client/sucafina/planner"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { SfDomainPageCap21 } from "@orchestra/schema/sucafina/planner"
import type { SfReadableContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { draftAvailability } from "./draft-revalidation-availability"

export async function revalidatePlannerCatalogDraft(
  input: SfDraftRevalidationInput, fresh: SfReadableContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (input.surfaceId !== "CAP21" || input.read.operationId !== "domain.page.CAP21" ||
      input.read.actionIds.length !== 1 || input.read.actionIds[0] !== "save") return { status: "unavailable" }
  const collection = input.editScopeKey === "shared-catalog:entities" ? "entities" :
    input.editScopeKey === "shared-catalog:allocations" ? "allocations" : undefined
  if (!collection) return { status: "unavailable" }
  const fields = collection === "entities" ? ["id", "name", "code"] : ["id", "name", "desc"]
  if (input.read.fieldPaths.some((field) => !fields.includes(field)) ||
      input.identity.kind === "new" && input.read.fieldPaths.length) return { status: "unavailable" }
  const selection = Schema.decodeUnknownOption(SfDomainPageCap21.input, { onExcessProperty: "error" })(input.read.input)
  if (Option.isNone(selection)) return { status: "unavailable" }
  const availability = draftAvailability(fresh, "planner", "CAP21", ["domain.page.CAP21", "domain.command.CAP21.save"])
  if (availability) return availability
  if (!fresh.destinations.some((item) => item.capabilityId === "CAP21" && item.surface === "planner" &&
      item.page === "Entities & allocations" && item.canRead && item.allowedActionIds.includes("save"))) return { status: "denied" }
  const result = await createSfPlannerClient(transport)["domain.page.CAP21"](selection.value, { signal }).catch(() => undefined)
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
  if (page.capabilityId !== "CAP21" || selection.value.year !== undefined && page.selection.year !== selection.value.year)
    return { status: "unavailable" }
  if (!page.allowedActionIds.includes("save")) return { status: "denied" }
  // executeLists handles save without an id as creation, under the same save grant.
  if (input.identity.kind === "new")
    return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: null }
  const ref = input.identity.recordRef
  const rows = page.data[collection].filter((row) => row.id === ref)
  if (rows.length !== 1) return { status: "unavailable" }
  const row = rows[0]!
  if (input.read.fieldPaths.some((field) => !Object.entries(row).some(([key, value]) => key === field && value !== undefined)))
    return { status: "denied" }
  const version = page.versions[collection + ":" + ref]?.version ?? row.revision
  if (!Number.isSafeInteger(version) || version < 0) return { status: "unavailable" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: version }
}
