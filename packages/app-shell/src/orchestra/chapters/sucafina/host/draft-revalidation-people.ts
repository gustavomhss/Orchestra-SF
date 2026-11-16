import { Option, Schema } from "effect"
import { createSfPeopleClient } from "@orchestra/client/sucafina/people"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { SfPeopleStructureSelection, SfPeopleTalentSelection } from "@orchestra/schema/sucafina/people"
import type { SfContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"

const cioFields = ["name", "title", "location", "start"]
const leaderFields = ["name", "title", "domain", "location", "start"]
const memberFields = ["name", "title", "type", "leaderId", "location", "start", "end", "status"]
const talentFields = [...memberFields, "cls", "outlook", "notes"]

export async function revalidatePeopleDraft(
  input: SfDraftRevalidationInput, fresh: SfContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (signal.aborted) return { status: "unavailable" }
  if (input.originalOwner.installationId !== fresh.stamp.installationId ||
      input.originalOwner.projectId !== fresh.stamp.projectId ||
      input.originalOwner.principalRef !== fresh.stamp.principalRef) return { status: "authority-changed" }
  const structure = input.surfaceId === "CAP07" && input.read.operationId === "domain.page.CAP07"
  const talent = input.surfaceId === "CAP08" && input.read.operationId === "domain.page.CAP08"
  if (!structure && !talent) return { status: "unavailable" }
  const decoded = structure
    ? Schema.decodeUnknownOption(SfPeopleStructureSelection, { onExcessProperty: "error" })(input.read.input)
    : Schema.decodeUnknownOption(SfPeopleTalentSelection, { onExcessProperty: "error" })(input.read.input)
  if (Option.isNone(decoded)) return { status: "unavailable" }
  const selection = decoded.value
  const scope = "people:" + (structure ? "structure:" : "talent:") + String(selection.year ?? "current") + ":"
  const entity = input.editScopeKey === scope + "cio" ? "cio" : input.editScopeKey === scope + "leader" ? "leader" :
    input.editScopeKey === scope + "member" ? "member" : input.editScopeKey === scope + "talent" ? "talent" : undefined
  if (!entity || talent && entity !== "talent" || structure && entity === "talent") return { status: "unavailable" }
  const action = entity === "cio" ? "saveCio" : entity === "leader" ? "saveLeader" : entity === "member" ? "saveMember" : "save"
  const fields = entity === "cio" ? cioFields : entity === "leader" ? leaderFields : entity === "member" ? memberFields : talentFields
  if (input.read.actionIds.length !== 1 || input.read.actionIds[0] !== action ||
      input.read.fieldPaths.some((field) => !fields.includes(field)) ||
      input.identity.kind === "new" && (entity === "cio" || input.read.fieldPaths.length ||
        input.identity.newIntentRef !== "sf-people-" + input.surfaceId + "-" + entity + "-new")) return { status: "unavailable" }
  const pageName = structure ? "Team Structure" : "Talent Review"
  if (!fresh.destinations.some((item) => item.capabilityId === input.surfaceId && item.surface === "dashboard" &&
      item.page === pageName && item.canRead && item.allowedActionIds.includes(action)) ||
      !fresh.availability.some((resource) => resource.family === "domain-read" && resource.resource === input.surfaceId &&
        resource.state !== "denied" && resource.state !== "unavailable" &&
        [input.read.operationId, "domain.command." + input.surfaceId + "." + action].every((id) => resource.operations.some((operation) =>
          operation.operationId === id && operation.state === "ready" && operation.operational)))) return { status: "denied" }
  const client = createSfPeopleClient(transport)
  const result = await (structure ? client["domain.page.CAP07"](selection, { signal }) :
    client["domain.page.CAP08"](selection, { signal })).catch(() => undefined)
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
  if (page.capabilityId !== input.surfaceId || Object.entries(selection).some(([key, value]) =>
    !Object.entries(page.selection).some(([selected, actual]) => selected === key && actual === value))) return { status: "unavailable" }
  if (!page.allowedActionIds.some((allowed) => allowed === action)) return { status: "denied" }
  // These legacy create commands use expected-absence CAS 0, not a record ID.
  if (input.identity.kind === "new")
    return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: 0 }
  const ref = input.identity.recordRef
  const rows = entity === "cio" ? (ref === "cio" && "cio" in page.data ? [page.data.cio] : []) :
    entity === "leader" ? ("leaders" in page.data ? page.data.leaders.filter((row) => row.id === ref) : []) :
      page.data.members.filter((row) => row.id === ref)
  if (rows.length !== 1) return { status: "unavailable" }
  if (input.read.fieldPaths.some((field) => !Object.entries(rows[0]!).some(([key, value]) => key === field && value !== undefined)))
    return { status: "denied" }
  const key = entity === "cio" ? "cio" : (entity === "leader" ? "leaders:" : "members:") + ref
  if (!Object.hasOwn(page.versions, key)) return { status: "unavailable" }
  const version = page.versions[key]
  if (version === undefined || !Number.isSafeInteger(version) || version < 0) return { status: "unavailable" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: version }
}
