import { Option, Schema } from "effect"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import type { SfReadableContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { draftAvailability } from "./draft-revalidation-availability"

/** CAP04/CAP05: retain the source editor's owner, entry, deviation and YTD CAS keys. */
export async function revalidateBudgetDraft(
  input: SfDraftRevalidationInput, fresh: SfReadableContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (signal.aborted) return { status: "unavailable" }
  if (input.originalOwner.installationId !== fresh.stamp.installationId ||
      input.originalOwner.projectId !== fresh.stamp.projectId ||
      input.originalOwner.principalRef !== fresh.stamp.principalRef) return { status: "authority-changed" }
  const cap = input.read.operationId === "domain.page.CAP04" ? "CAP04" :
    input.read.operationId === "domain.page.CAP05" ? "CAP05" : undefined
  if (!cap || input.surfaceId !== cap || input.read.actionIds.length !== 1) return { status: "unavailable" }
  const action = input.read.actionIds[0]
  // CAP04 import is navigation to a separate import producer, not a budget draft.
  const actions = ["save", "delete", "save-entry", "save-deviation", "annual-entry", "year-amount"]
  if (!action || !actions.includes(action)) return { status: "unavailable" }
  const ownersKey = cap === "CAP04" ? "opexOwners" : "capexProjects"
  const entriesKey = cap === "CAP04" ? "opexEntries" : "capexEntries"
  const field = action === "save-entry" ? entriesKey :
    action === "save-deviation" ? "deviations" :
    action === "year-amount" ? "budgetYtd" : ownersKey
  if (input.read.fieldPaths.length !== 1 || input.read.fieldPaths[0] !== field)
    return { status: "unavailable" }
  const original = input.read.input
  if (!original || typeof original !== "object" || Array.isArray(original) ||
      Object.keys(original).length !== 1 || !("year" in original)) return { status: "unavailable" }
  const selection = Schema.decodeUnknownOption(SfDomain.operations["domain.page.CAP04"].input,
    { onExcessProperty: "error" })(original)
  if (Option.isNone(selection) || selection.value.year === undefined) return { status: "unavailable" }
  const year = selection.value.year
  const scope = /^(\d{4}):(save|delete|save-entry|save-deviation|annual-entry|year-amount):(.+):(\d{1,2})$/.exec(input.editScopeKey)
  if (!scope || scope[1] !== String(year) || scope[2] !== action) return { status: "unavailable" }
  const ownerId = scope[3]!
  const month = Number(scope[4])
  if (!Number.isInteger(month) || month < 1 || month > 12 || scope[4] !== String(month))
    return { status: "unavailable" }
  const creating = input.identity.kind === "new"
  if (creating && !["save", "save-entry", "save-deviation"].includes(action) ||
      action === "save" && (creating !== (ownerId === "new")) ||
      action !== "save" && ownerId === "new") return { status: "unavailable" }
  if (input.identity.kind === "new" &&
      input.identity.newIntentRef !== `${cap}:${year}:${action}:${ownerId}:${month}`)
    return { status: "unavailable" }
  if (input.identity.kind === "record" && action !== "save-entry" && input.identity.recordRef !== ownerId)
    return { status: "unavailable" }

  const available = draftAvailability(fresh, "domain-read", cap,
    [`domain.page.${cap}`, `domain.command.${cap}.${action}`])
  if (available) return available
  if (!fresh.destinations.some((destination) => destination.capabilityId === cap &&
      destination.surface === "dashboard" &&
      destination.page === (cap === "CAP04" ? "OPEX Detail" : "CAPEX Projects") &&
      destination.canRead && destination.allowedActionIds.includes(action))) return { status: "denied" }
  const client = createSfDomainClient(transport)
  const response = await (cap === "CAP04"
    ? client["domain.page.CAP04"]({ year }, { signal })
    : client["domain.page.CAP05"]({ year }, { signal })).catch(() => undefined)
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
  if (page.capabilityId !== cap || page.selection.year !== year) return { status: "unavailable" }
  if (!page.allowedActionIds.includes(action)) return { status: "denied" }

  const owners = page.capabilityId === "CAP04" ? page.data.opexOwners : page.data.capexProjects
  const entries = page.capabilityId === "CAP04" ? page.data.opexEntries : page.data.capexEntries
  const deviations = page.data.deviations
  const ytd = page.capabilityId === "CAP04" ? page.data.budgetYtd?.opex : page.data.budgetYtd?.capex
  if (!owners) return { status: "unavailable" }
  const ownerRows = owners.filter((row) => String(row.id) === ownerId)
  if (creating && action === "save") {
    // The producer allocates the record ID, and starts its never-written row at v0.
    return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: 0 }
  }
  if (ownerRows.length !== 1) return { status: "unavailable" }

  const entryRows = entries?.filter((row) =>
    String(row.ownerId ?? row.projId ?? row.projectId ?? "") === ownerId &&
    row.year === year && row.month === month)
  if (action === "save-entry") {
    if (!entryRows || entryRows.length > 1) return { status: "unavailable" }
    if (creating) {
      // No ID was submitted. The original writer looks up owner/year/month first.
      if (entryRows.length) return { status: "unavailable" }
      return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: 0 }
    }
    const ref = input.identity.kind === "record" ? input.identity.recordRef : undefined
    const rows = entries?.filter((row) => String(row.id) === ref)
    if (!ref || !rows || rows.length !== 1 || entryRows.length !== 1 || String(entryRows[0]?.id) !== ref)
      return { status: "unavailable" }
    const version = page.versions[`${entriesKey}:${ref}`]
    if (!Number.isSafeInteger(version) || version === undefined || version < 0) return { status: "unavailable" }
    return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: version }
  }

  if (action === "save-deviation") {
    if (!deviations) return { status: "unavailable" }
    const deviationId = `${cap === "CAP04" ? "opex" : "capex"}-${ownerId}-${year}-${month}`
    const present = Object.hasOwn(deviations, deviationId)
    if (creating === present) return { status: "unavailable" }
    const key = `deviations:${deviationId}`
    const version = page.versions[key]
    // An absent deviation is an actual new intent; only that case uses the writer's v0 default.
    if (creating && version === undefined)
      return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: 0 }
    if (version === undefined || !Number.isSafeInteger(version) || version < 0)
      return { status: "unavailable" }
    return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: version }
  }

  if (action === "year-amount" && !ytd) return { status: "unavailable" }
  const key = action === "year-amount" ? "budgetYtd" : `${ownersKey}:${ownerId}`
  const version = page.versions[key]
  if (version === undefined || !Number.isSafeInteger(version) || version < 0)
    return { status: "unavailable" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: version }
}

