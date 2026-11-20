import { Option, Schema } from "effect"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import type { SfReadableContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { draftAvailability } from "./draft-revalidation-availability"

export async function revalidateDashboardScalarDraft(
  input: SfDraftRevalidationInput, fresh: SfReadableContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (signal.aborted) return { status: "unavailable" }
  if (input.originalOwner.installationId !== fresh.stamp.installationId ||
      input.originalOwner.projectId !== fresh.stamp.projectId ||
      input.originalOwner.principalRef !== fresh.stamp.principalRef) return { status: "authority-changed" }
  const cap = input.read.operationId === "domain.page.CAP01" ? "CAP01" :
    input.read.operationId === "domain.page.CAP03" ? "CAP03" : undefined
  if (!cap || input.surfaceId !== cap || input.read.actionIds.length !== 1 || input.read.fieldPaths.length !== 1)
    return { status: "unavailable" }
  const action = input.read.actionIds[0]
  const collection = cap === "CAP01" && action === "save-users" ? "itUsersMonthly" :
    cap === "CAP01" && action === "save-benchmark" ? "costPerUserBenchmarks" :
    cap === "CAP03" && action === "save-month" ? "budgetCurrentMonth" :
    cap === "CAP03" && action === "save-revenue" ? "revenueByYear" : undefined
  if (!collection || input.read.fieldPaths[0] !== "data." + collection) return { status: "unavailable" }
  const original = input.read.input
  const selectorKeys = cap === "CAP01" ? action === "save-users" ? ["execYear", "executiveMonth"] : ["execYear"] : ["year"]
  if (!original || typeof original !== "object" || Array.isArray(original) ||
      Object.keys(original).length !== selectorKeys.length || Object.keys(original).some((key) => !selectorKeys.includes(key)))
    return { status: "unavailable" }
  const selection = Schema.decodeUnknownOption(SfDomain.operations["domain.page.CAP01"].input,
    { onExcessProperty: "error" })(original)
  if (Option.isNone(selection)) return { status: "unavailable" }
  const year = cap === "CAP01" ? selection.value.execYear : selection.value.year
  const month = selection.value.executiveMonth
  if (year === undefined || action === "save-users" && month === undefined) return { status: "unavailable" }
  const scope = cap === "CAP01" ? action === "save-users" ? `${year}:${month}:users` : `${year}:benchmark` :
    action === "save-month" ? `${year}:month` : `${year}:revenue`
  if (input.editScopeKey !== `${cap}:${scope}` || cap === "CAP03" && input.identity.kind !== "new")
    return { status: "unavailable" }
  const availability = draftAvailability(fresh, "domain-read", cap, [input.read.operationId, `domain.command.${cap}.${action}`])
  if (availability) return availability
  if (!fresh.destinations.some((item) => item.capabilityId === cap && item.surface === "dashboard" &&
      item.page === (cap === "CAP01" ? "Executive Dashboard" : "Budget Overview") &&
      item.canRead && item.allowedActionIds.includes(action!))) return { status: "denied" }
  const client = createSfDomainClient(transport)
  const result = await (cap === "CAP01" ? client["domain.page.CAP01"](selection.value, { signal }) :
    client["domain.page.CAP03"](selection.value, { signal })).catch(() => undefined)
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
  if (page.capabilityId !== cap || page.selection.year !== year ||
      cap === "CAP01" && page.selection.execYear !== year || action === "save-users" &&
      (page.selection.month !== month || page.selection.executiveMonth !== month)) return { status: "unavailable" }
  if (!page.allowedActionIds.includes(action!)) return { status: "denied" }
  if (page.capabilityId === "CAP01") {
    const rows = collection === "itUsersMonthly" ? page.data.itUsersMonthly : page.data.costPerUserBenchmarks
    if (!rows) return { status: "unavailable" }
    const selected = rows.filter((row) => row.year === year && (collection !== "itUsersMonthly" || row.month === month))
    if (selected.length > 1) return { status: "unavailable" }
    if (input.identity.kind === "new") {
      if (selected.length) return { status: "unavailable" }
      return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: 0 }
    }
    const row = selected[0]
    if (!row || row.id === undefined || String(row.id) !== input.identity.recordRef ||
        rows.filter((item) => item.id !== undefined && String(item.id) === String(row.id)).length !== 1)
      return { status: "unavailable" }
    const version = page.versions[`${collection}:${String(row.id)}`]
    if (version === undefined || !Number.isSafeInteger(version) || version < 0) return { status: "unavailable" }
    return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: version }
  }
  const map = collection === "budgetCurrentMonth" ? page.data.budgetCurrentMonth : page.data.revenueByYear
  if (!map) return { status: "unavailable" }
  const version = page.versions[collection]
  if (version === undefined || !Number.isSafeInteger(version) || version < 0) return { status: "unavailable" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: version }
}
