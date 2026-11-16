import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { SfProcurementSettings } from "@orchestra/schema/sucafina/procurement"
import type { SfContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { SETTINGS_REF } from "../procurement/settings/model"

export async function revalidateSettingsDraft(
  input: SfDraftRevalidationInput, fresh: SfContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (input.surfaceId !== "CAP28" || input.read.operationId !== "domain.page.CAP28" ||
      input.identity.kind !== "record" || input.identity.recordRef !== SETTINGS_REF) return { status: "unavailable" }
  const original = input.read.input
  if (!original || typeof original !== "object" || Array.isArray(original) ||
      Object.keys(original).some((key) => key !== "year" && key !== "month"))
    return { status: "unavailable" }
  const year = "year" in original ? original.year : undefined
  const month = "month" in original ? original.month : undefined
  if ((year !== undefined && (typeof year !== "number" || !Number.isSafeInteger(year) || year < 0)) ||
      (month !== undefined && (typeof month !== "number" || !Number.isSafeInteger(month) || month <= 0)))
    return { status: "unavailable" }
  const selection = { ...(typeof year === "number" ? { year } : {}),
    ...(typeof month === "number" ? { month } : {}) }
  if (input.editScopeKey !== JSON.stringify(["CAP28", selection.year ?? null, selection.month ?? null]) ||
      !input.read.actionIds.length || input.read.actionIds.some((action) => action !== "save" && action !== "reset") ||
      input.read.fieldPaths.some((field) => !Object.hasOwn(SfProcurementSettings.fields, field))) return { status: "unavailable" }
  const destination = fresh.destinations.find((item) => item.capabilityId === "CAP28" &&
    item.surface === "procurement" && item.page === "Settings" && item.canRead)
  if (!destination || input.read.actionIds.some((action) => !destination.allowedActionIds.includes(action)))
    return { status: "denied" }
  const result = await createSfProcurementClient(transport)["domain.page.CAP28"](selection, { signal }).catch(() => undefined)
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
  if (page.capabilityId !== "CAP28" || Object.keys(page.selection).length !== Object.keys(selection).length ||
      page.selection.year !== selection.year || page.selection.month !== selection.month) return { status: "unavailable" }
  if (input.read.actionIds.some((action) => !page.allowedActionIds.includes(action)) ||
      input.read.fieldPaths.some((field) => !Object.hasOwn(page.data.settings, field))) return { status: "denied" }
  const version = page.versions.settings?.version
  if (version === undefined || !Number.isSafeInteger(version) || version < 0) return { status: "unavailable" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: version }
}
