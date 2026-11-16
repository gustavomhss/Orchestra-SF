import { Option, Schema } from "effect"
import { createSfPeopleClient } from "@orchestra/client/sucafina/people"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { SfPeopleTopicSelection } from "@orchestra/schema/sucafina/people"
import type { SfContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { draftAvailability } from "./draft-revalidation-availability"

const fields = ["action", "owner", "due", "status", "priority", "notes"]
export async function revalidateHotTopicDraft(
  input: SfDraftRevalidationInput, fresh: SfContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (input.surfaceId !== "CAP02" || input.read.operationId !== "domain.page.CAP02" ||
      input.read.actionIds.length !== 1 || input.read.actionIds[0] !== "save" ||
      input.read.fieldPaths.some((field) => !fields.includes(field)) ||
      (input.identity.kind === "new" ? input.editScopeKey !== "hotTopics:new" || !!input.read.fieldPaths.length :
        input.editScopeKey !== "hotTopics:" + input.identity.recordRef)) return { status: "unavailable" }
  const selection = Schema.decodeUnknownOption(SfPeopleTopicSelection, { onExcessProperty: "error" })(input.read.input)
  if (Option.isNone(selection) || selection.value.topicStatus === undefined) return { status: "unavailable" }
  const availability = draftAvailability(fresh, "domain-read", "CAP02", ["domain.page.CAP02", "domain.command.CAP02.save"])
  if (availability) return availability
  if (!fresh.destinations.some((item) => item.capabilityId === "CAP02" && item.surface === "dashboard" &&
      item.page === "Hot Topics & Actions" && item.canRead && item.allowedActionIds.includes("save"))) return { status: "denied" }
  const result = await createSfPeopleClient(transport)["domain.page.CAP02"](selection.value, { signal }).catch(() => undefined)
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
  if (page.capabilityId !== "CAP02" || Object.entries(selection.value).some(([key, value]) =>
    !Object.entries(page.selection).some(([selected, actual]) => selected === key && actual === value))) return { status: "unavailable" }
  if (!page.allowedActionIds.includes("save")) return { status: "denied" }
  // The original save command creates a topic when no id is supplied.
  if (input.identity.kind === "new")
    return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: null }
  const ref = input.identity.recordRef
  const rows = page.data.hotTopics.filter((row) => row.id === ref)
  if (rows.length !== 1) return { status: "unavailable" }
  if (input.read.fieldPaths.some((field) => !Object.entries(rows[0]!).some(([key, value]) => key === field && value !== undefined)))
    return { status: "denied" }
  const version = page.versions["hotTopics:" + ref]
  if (version === undefined || !Number.isSafeInteger(version) || version < 0) return { status: "unavailable" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: version }
}
