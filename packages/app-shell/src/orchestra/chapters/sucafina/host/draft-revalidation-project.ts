import { Option, Schema } from "effect"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import type { SfReadableContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { readSfProjectPage, sfProjectVersion } from "../portfolio/projects/model"
import { draftAvailability } from "./draft-revalidation-availability"

const fields = ["name", "desc", "status", "risk", "priority", "pm", "start", "end",
  "budget", "spent", "pct", "watchList", "notes"]
export async function revalidateProjectDraft(
  input: SfDraftRevalidationInput, fresh: SfReadableContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (input.surfaceId !== "CAP10" || input.read.operationId !== "domain.page.CAP10" ||
      input.read.actionIds.length !== 1 || input.read.actionIds[0] !== "save" ||
      input.read.fieldPaths.some((field) => !fields.includes(field)) ||
      input.identity.kind === "new" && input.read.fieldPaths.length) return { status: "unavailable" }
  const identity = input.identity.kind === "new" ? input.identity.newIntentRef : input.identity.recordRef
  const key = JSON.stringify([fresh.stamp.installationId, fresh.stamp.principalRef,
    input.identity.kind === "new" ? "new" : "edit", identity])
  if (input.editScopeKey !== "CAP10:All Projects:" + key) return { status: "unavailable" }
  const original = input.read.input
  if (!original || typeof original !== "object" || Array.isArray(original) ||
      Object.keys(original).some((key) => key !== "year")) return { status: "unavailable" }
  const selection = Schema.decodeUnknownOption(SfDomain.operations["domain.page.CAP10"].input,
    { onExcessProperty: "error" })(original)
  if (Option.isNone(selection)) return { status: "unavailable" }
  const availability = draftAvailability(fresh, "domain-read", "CAP10", ["domain.page.CAP10", "domain.command.CAP10.save"])
  if (availability) return availability
  if (!fresh.destinations.some((item) => item.capabilityId === "CAP10" && item.surface === "dashboard" &&
      item.page === "All Projects" && item.canRead && item.allowedActionIds.includes("save"))) return { status: "denied" }
  const result = await createSfDomainClient(transport)["domain.page.CAP10"](selection.value, { signal }).catch(() => undefined)
  if (signal.aborted || !result || result.kind !== "response") return { status: "unavailable" }
  if (result.status === 401 || result.status === 403 || result.body.status === "unauthenticated" ||
      result.body.status === "denied") return { status: "denied" }
  if (result.status !== 200 || result.body.status !== "ok") return { status: "unavailable" }
  const stamp = result.body.context
  if (stamp.installationId !== fresh.stamp.installationId || stamp.projectId !== fresh.stamp.projectId ||
      stamp.hostId !== fresh.stamp.hostId || stamp.principalRef !== fresh.stamp.principalRef ||
      stamp.policyVersion !== fresh.stamp.policyVersion || stamp.accessRevision !== fresh.stamp.accessRevision)
    return { status: "authority-changed" }
  if (result.body.value.capabilityId !== "CAP10" || selection.value.year !== undefined &&
      result.body.value.selection.year !== selection.value.year) return { status: "unavailable" }
  if (!result.body.value.allowedActionIds.includes("save")) return { status: "denied" }
  const page = readSfProjectPage(result.body)
  if (!page) return { status: "unavailable" }
  // The source save command creates a new project when id is omitted.
  if (input.identity.kind === "new")
    return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: null }
  const ref = input.identity.recordRef
  const rows = page.records.filter((row) => row.id === ref)
  if (rows.length !== 1) return { status: "unavailable" }
  if (input.read.fieldPaths.some((field) => !Object.entries(rows[0]!).some(([key, value]) => key === field && value !== undefined)))
    return { status: "denied" }
  const version = sfProjectVersion(page, ref)
  if (version === null) return { status: "unavailable" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: version }
}
