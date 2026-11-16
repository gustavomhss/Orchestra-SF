import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import type { SfContext, SfContextStamp, SfDraftRevalidation, SfDraftRevalidationInput } from "../../context/contracts"
import { decodeRequestsPage, isPrWritable, requestRef, requestVersion } from "./model"

export const sameTitleStamp = (a: SfContextStamp, b: SfContextStamp) =>
  a.installationId === b.installationId && a.projectId === b.projectId && a.hostId === b.hostId &&
  a.principalRef === b.principalRef && a.policyVersion === b.policyVersion && a.accessRevision === b.accessRevision

export function titleReadiness(context: SfContext): "ready" | "denied" | "unavailable" {
  const resources = context.availability.filter((item) => item.family === "procurement" && item.resource === "CAP25")
  if (resources.length !== 1) return "unavailable"
  const resource = resources[0]!
  if (resource.state === "denied") return "denied"
  if (resource.state === "unavailable") return "unavailable"
  for (const id of ["domain.page.CAP25", "domain.command.CAP25.save"]) {
    const operations = resource.operations.filter((item) => item.operationId === id)
    if (operations.length !== 1) return "unavailable"
    if (operations[0]!.state === "denied") return "denied"
    if (operations[0]!.state !== "ready" || !operations[0]!.operational) return "unavailable"
  }
  const destinations = context.destinations.filter((item) => item.capabilityId === "CAP25" &&
    item.surface === "procurement" && item.page === "Requests")
  if (destinations.length !== 1) return "unavailable"
  return destinations[0]!.canRead && destinations[0]!.allowedActionIds.includes("save") ? "ready" : "denied"
}

/** A locator is not a grant: read and check the exact original request every time. */
export async function readRequestTitle(context: SfContext, transport: SfTransport, ref: SfRef, signal: AbortSignal) {
  const readiness = titleReadiness(context)
  if (signal.aborted || readiness !== "ready") return { status: readiness === "ready" ? "unavailable" : readiness } as const
  try {
    const response = await createSfProcurementClient(transport)["domain.page.CAP25"]({ request: ref }, { signal })
    if (signal.aborted || response.kind !== "response") return { status: "unavailable" } as const
    if (response.status === 403 || response.body.status === "denied") return { status: "denied" } as const
    if (response.status !== 200 || response.body.status !== "ok") return { status: "unavailable" } as const
    if (!sameTitleStamp(response.body.context, context.stamp)) return { status: "authority-changed" } as const
    if (response.body.value.selection.request !== ref) return { status: "unavailable" } as const
    const page = decodeRequestsPage(response.body, context.stamp)
    if (page.kind !== "ready") return { status: "unavailable" } as const
    if (!page.actionIds.includes("save")) return { status: "denied" } as const
    const rows = page.records.filter((row) => requestRef(row) === ref)
    if (rows.length !== 1) return { status: "unavailable" } as const
    const row = rows[0]!
    if (!isPrWritable(row)) return { status: "denied" } as const
    if (!row.allowedDraftActions) return { status: "unavailable" } as const
    if (!row.allowedDraftActions.includes("save-pr")) return { status: "denied" } as const
    const version = requestVersion(page, ref)
    if (version === undefined || !row.pr || (row.pr.title !== undefined && typeof row.pr.title !== "string"))
      return { status: "unavailable" } as const
    return { status: "authorized", version, title: row.pr.title ?? "", stage: row.status } as const
  } catch { return { status: "unavailable" } as const }
}

/** Dispatcher integration: retain private values only after original typed read reauthorization. */
export async function revalidateRequestTitleDraft(input: SfDraftRevalidationInput, fresh: SfContext,
  transport: SfTransport, signal: AbortSignal): Promise<SfDraftRevalidation> {
  if (signal.aborted || input.surfaceId !== "CAP25" || input.identity.kind !== "record" ||
      !input.identity.recordRef || input.editScopeKey !== "pr.title" || input.read.operationId !== "domain.page.CAP25" ||
      input.read.fieldPaths.length !== 1 || input.read.fieldPaths[0] !== "pr.title" ||
      input.read.actionIds.length !== 1 || input.read.actionIds[0] !== "save") return { status: "unavailable" }
  const query = input.read.input
  if (!query || typeof query !== "object" || Array.isArray(query) || Object.keys(query).length !== 1 ||
      !("request" in query) || query.request !== input.identity.recordRef) return { status: "unavailable" }
  if (input.originalOwner.installationId !== fresh.stamp.installationId ||
      input.originalOwner.projectId !== fresh.stamp.projectId || input.originalOwner.principalRef !== fresh.stamp.principalRef)
    return { status: "authority-changed" }
  const result = await readRequestTitle(fresh, transport, input.identity.recordRef, signal)
  if (result.status !== "authorized") return { status: result.status }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: result.version }
}
