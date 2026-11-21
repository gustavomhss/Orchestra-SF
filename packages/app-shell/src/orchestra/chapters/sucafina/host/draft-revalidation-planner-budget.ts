import { Option, Schema } from "effect"
import { createSfPlannerClient } from "@orchestra/client/sucafina/planner"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import type { SfContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { draftAvailability } from "./draft-revalidation-availability"

/** CAP18/CAP19: CAS keys are the ones the installed planner's cas() emits. */
export async function revalidatePlannerBudgetDraft(
  input: SfDraftRevalidationInput, fresh: SfContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (signal.aborted) return { status: "unavailable" }
  if (input.originalOwner.installationId !== fresh.stamp.installationId ||
      input.originalOwner.projectId !== fresh.stamp.projectId ||
      input.originalOwner.principalRef !== fresh.stamp.principalRef) return { status: "authority-changed" }
  const cap = input.read.operationId === "domain.page.CAP18" ? "CAP18" :
    input.read.operationId === "domain.page.CAP19" ? "CAP19" : undefined
  if (!cap || input.surfaceId !== cap || input.identity.kind !== "record" ||
      input.read.actionIds.length !== 1 || input.read.actionIds[0] !== "save" ||
      input.read.fieldPaths.length !== 1) return { status: "unavailable" }
  const field = input.read.fieldPaths[0]
  if (field !== "lines" && field !== "grid" && !(cap === "CAP19" && field === "projects"))
    return { status: "unavailable" }
  const source = input.read.input
  if (!source || typeof source !== "object" || Array.isArray(source) ||
      Object.keys(source).some((key) => !["year", "version", "q"].includes(key)))
    return { status: "unavailable" }
  // The component's pageQuery() registers year, chosen version and its actual q filter.
  const selection = Schema.decodeUnknownOption(SfPlanner.operations["domain.page.CAP18"].input,
    { onExcessProperty: "error" })(source)
  if (Option.isNone(selection)) return { status: "unavailable" }
  const available = draftAvailability(fresh, "planner", cap,
    [`domain.page.${cap}`, `domain.command.${cap}.save`])
  if (available) return available
  if (!fresh.destinations.some((destination) => destination.capabilityId === cap &&
      destination.surface === "planner" && destination.page === (cap === "CAP18" ? "OPEX" : "CAPEX") &&
      destination.canRead && destination.allowedActionIds.includes("save"))) return { status: "denied" }
  const client = createSfPlannerClient(transport)
  const response = await (cap === "CAP18"
    ? client["domain.page.CAP18"](selection.value, { signal })
    : client["domain.page.CAP19"](selection.value, { signal })).catch(() => undefined)
  if (signal.aborted || !response || response.kind !== "response") return { status: "unavailable" }
  if (response.status === 401 || response.status === 403 ||
      response.body.status === "unauthenticated" || response.body.status === "denied")
    return { status: "denied" }
  if (response.status !== 200 || response.body.status !== "ok") return { status: "unavailable" }
  const stamp = response.body.context
  if (stamp.installationId !== fresh.stamp.installationId || stamp.projectId !== fresh.stamp.projectId ||
      stamp.hostId !== fresh.stamp.hostId || stamp.principalRef !== fresh.stamp.principalRef ||
      stamp.policyVersion !== fresh.stamp.policyVersion || stamp.accessRevision !== fresh.stamp.accessRevision)
    return { status: "authority-changed" }
  const page = response.body.value
  if (page.capabilityId !== cap || selection.value.year !== undefined && page.selection.year !== selection.value.year ||
      selection.value.version !== undefined && page.selection.versionId !== selection.value.version ||
      selection.value.q !== undefined && page.selection.q !== selection.value.q)
    return { status: "unavailable" }
  if (!page.allowedActionIds.includes("save")) return { status: "denied" }
  const selected = page.data.selectedVersion
  if (!selected || !page.selection.versionId || selected.id !== page.selection.versionId)
    return { status: "unavailable" }
  if (selected.locked) return { status: "denied" }
  const scope = JSON.stringify([page.selection.year, selected.id, field === "grid" ? "monthly" : "metadata"])
  if (input.editScopeKey !== scope) return { status: "unavailable" }

  if (field === "grid" &&
      (!page.data.grid || page.data.grid.versionId !== selected.id ||
       page.data.grid.year !== page.selection.year ||
       page.data.grid.page !== (cap === "CAP18" ? "OPEX" : "CAPEX")))
    return { status: "unavailable" }
  const ref = input.identity.recordRef
  const rows = field === "grid" ? page.data.grid?.rows.filter((row) => row.id === ref) :
    field === "lines" ? page.data.lines.filter((row) => row.id === ref) :
    page.capabilityId === "CAP19" ? page.data.projects.filter((row) => row.id === ref) : undefined
  if (!rows || rows.length !== 1) return { status: "unavailable" }
  if (field === "grid" && !page.data.grid?.rows.some((row) => row.id === ref &&
      row.cells.some((cell) => cell.budget.editable || cell.actual.editable || cell.forecast.editable)))
    return { status: "denied" }
  const key = field === "projects" ? `${selected.id}:projects:${ref}` :
    `${selected.id}:${ref.startsWith("HR:") ? "hrAF" : "lines"}:${ref}`
  const cas = page.versions[key]?.version
  if (cas === undefined || !Number.isSafeInteger(cas) || cas < 0 || rows[0]?.revision !== cas)
    return { status: "unavailable" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: cas }
}
