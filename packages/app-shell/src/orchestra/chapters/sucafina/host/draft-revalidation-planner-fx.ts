import { Option, Schema } from "effect"
import { createSfPlannerClient } from "@orchestra/client/sucafina/planner"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import type { SfContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { draftAvailability } from "./draft-revalidation-availability"

/** CAP22: reuse the source's versionId:fx:rateId CAS, with null for new-rate intents. */
export async function revalidatePlannerFxDraft(
  input: SfDraftRevalidationInput, fresh: SfContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (signal.aborted) return { status: "unavailable" }
  if (input.originalOwner.installationId !== fresh.stamp.installationId ||
      input.originalOwner.projectId !== fresh.stamp.projectId ||
      input.originalOwner.principalRef !== fresh.stamp.principalRef) return { status: "authority-changed" }
  if (input.surfaceId !== "CAP22" || input.read.operationId !== "domain.page.CAP22" ||
      input.read.actionIds.length !== 1 || input.read.actionIds[0] !== "save")
    return { status: "unavailable" }
  const creating = input.identity.kind === "new"
  const fields = creating ? ["versions", "rates"] : ["id", "cur", "rate"]
  if (input.read.fieldPaths.length !== fields.length ||
      input.read.fieldPaths.some((field, index) => field !== fields[index]))
    return { status: "unavailable" }
  const original = input.read.input
  if (!original || typeof original !== "object" || Array.isArray(original) ||
      Object.keys(original).some((key) => key !== "year" && key !== "version") ||
      !("version" in original) || typeof original.version !== "string" || !original.version.trim())
    return { status: "unavailable" }
  const selection = Schema.decodeUnknownOption(SfPlanner.operations["domain.page.CAP22"].input,
    { onExcessProperty: "error" })(original)
  if (Option.isNone(selection) || input.editScopeKey !== selection.value.version)
    return { status: "unavailable" }

  const available = draftAvailability(fresh, "planner", "CAP22",
    ["domain.page.CAP22", "domain.command.CAP22.save"])
  if (available) return available
  if (!fresh.destinations.some((destination) => destination.capabilityId === "CAP22" &&
      destination.surface === "planner" && destination.page === "FX rates" &&
      destination.canRead && destination.allowedActionIds.includes("save"))) return { status: "denied" }
  const response = await createSfPlannerClient(transport)["domain.page.CAP22"](
    selection.value, { signal },
  ).catch(() => undefined)
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
  if (page.capabilityId !== "CAP22" || page.selection.versionId !== selection.value.version ||
      selection.value.year !== undefined && page.selection.year !== selection.value.year)
    return { status: "unavailable" }
  if (!page.allowedActionIds.includes("save")) return { status: "denied" }
  const version = page.data.selectedVersion
  if (!version || version.id !== selection.value.version ||
      !page.data.versions.some((row) => row.id === version.id && row.year === version.year))
    return { status: "unavailable" }
  if (version.locked) return { status: "denied" }
  // The create command omits id and the draft has a null baseVersion, not a fake v0.
  if (creating) return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: null }
  const ref = input.identity.recordRef
  const rows = page.data.rates.filter((row) => row.id === ref)
  if (rows.length !== 1 || rows[0]?.cur === "USD") return { status: "unavailable" }
  const cas = page.versions[`${version.id}:fx:${ref}`]?.version
  if (cas === undefined || !Number.isSafeInteger(cas) || cas < 0 || cas !== rows[0]?.revision)
    return { status: "unavailable" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: cas }
}
