import { Option, Schema } from "effect"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContext, SfOwnerSelection, SurfaceId } from "@orchestra/schema/sucafina/context"
import type { SfUiState } from "../../shared/frame"
import { readSfProjectPage, type SfProjectPage } from "./model"

type ProjectSurface = Extract<SurfaceId, "CAP09" | "CAP10">
type Command = "save" | "delete" | "save-milestone" | "delete-milestone"
export type SfProjectSourceResult =
  | Readonly<{ status: "ok"; page: SfProjectPage }>
  | Readonly<{ status: "failed"; state: SfUiState; reason: string }>
export type SfProjectCommandResult =
  | Readonly<{ status: "accepted" }>
  | Readonly<{ status: "failed"; state: SfUiState; reason: string }>

/** True only for the *exact* destination and operation admitted by the owner. */
export function sfAdmitted(
  context: SfContext,
  capability: ProjectSurface,
  operationId: string,
  action?: Command | "import",
): boolean {
  const destination = context.destinations.find((entry) =>
    entry.capabilityId === capability && entry.surface === "dashboard" &&
    entry.page === (capability === "CAP09" ? "Portfolio Dashboard" : "All Projects"))
  if (!destination?.canRead || (action !== undefined && !destination.allowedActionIds.includes(action))) return false
  const resource = context.availability.find((item) =>
    item.family === "domain-read" && item.resource === capability)
  return resource?.operations.some((op) => op.operationId === operationId &&
    op.state === "ready" && op.operational) === true
}
export function sfOwnerMatches(context: SfContext, selection: SfOwnerSelection) {
  return context.stamp.projectId === selection.projectId &&
    (!selection.installationId || context.stamp.installationId === selection.installationId)
}
function failure(status: number, reason: string): SfProjectSourceResult & SfProjectCommandResult {
  return { status: "failed", state: status === 401 ? "session-expired" : status === 403 ? "denied" :
    status === 404 ? "not-found" : status === 409 ? "conflict" :
    status === 400 || status === 422 ? "invalid" : "unavailable", reason }
}
/**
 * Reject a request before network if the A01 canonical codec rejects the
 * original source query. No generic dispatch, coercion or fallback request.
 */
export async function sfReadProjects(
  transport: SfTransport,
  capability: ProjectSurface,
  query: Readonly<{ year?: number; status?: string; filter?: string }>,
  signal: AbortSignal,
): Promise<SfProjectSourceResult> {
  const client = createSfDomainClient(transport)
  const sourceInput = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined))
  if (capability === "CAP09") {
    const decoded = Schema.decodeUnknownOption(SfDomain.operations["domain.page.CAP09"].input)(sourceInput)
    if (Option.isNone(decoded)) return failure(503, "domain.page.CAP09 input contract unavailable")
    const result = await client["domain.page.CAP09"](decoded.value, { signal })
    if (result.kind === "transport-error") return failure(503, result.reason)
    if (result.status !== 200) return failure(result.status, "domain.page.CAP09 producer failure")
    const page = readSfProjectPage(result.body)
    return page ? { status: "ok", page } : failure(503, "domain.page.CAP09 projection contract mismatch")
  }
  const decoded = Schema.decodeUnknownOption(SfDomain.operations["domain.page.CAP10"].input)(sourceInput)
  if (Option.isNone(decoded)) return failure(503, "domain.page.CAP10 input contract unavailable")
  const result = await client["domain.page.CAP10"](decoded.value, { signal })
  if (result.kind === "transport-error") return failure(503, result.reason)
  if (result.status !== 200) return failure(result.status, "domain.page.CAP10 producer failure")
  const page = readSfProjectPage(result.body)
  return page ? { status: "ok", page } : failure(503, "domain.page.CAP10 projection contract mismatch")
}
/**
 * The original operation is selected by a *closed* switch, not a caller
 * controlled action/path. Its canonical input schema is applied before send.
 * Retained idempotency key belongs to the human command, not the read.
 */
export async function sfProjectCommand(
  transport: SfTransport,
  action: Command,
  body: Readonly<{ id?: string; version: number; values: object; confirmed?: boolean }>,
  idempotencyKey: string,
  signal: AbortSignal,
): Promise<SfProjectCommandResult> {
  const client = createSfDomainClient(transport)
  const command = { page: "All Projects" as const, action, ...body }
  if (action === "save") {
    const decoded = Schema.decodeUnknownOption(SfDomain.operations["domain.command.CAP10.save"].input)(command)
    if (Option.isNone(decoded)) return failure(503, "domain.command.CAP10.save input contract unavailable")
    const response = await client["domain.command.CAP10.save"](decoded.value, { signal, idempotencyKey })
    if (response.kind === "transport-error") return response.reason === "outcome-unknown" || response.reason === "network" ?
      { status: "failed", state: "outcome-unknown", reason: response.reason } : failure(503, response.reason)
    if (response.status >= 400) return failure(response.status, "domain.command.CAP10.save producer rejected")
    return { status: "accepted" }
  }
  if (action === "delete") {
    const decoded = Schema.decodeUnknownOption(SfDomain.operations["domain.command.CAP10.delete"].input)(command)
    if (Option.isNone(decoded)) return failure(503, "domain.command.CAP10.delete input contract unavailable")
    const response = await client["domain.command.CAP10.delete"](decoded.value, { signal, idempotencyKey })
    if (response.kind === "transport-error") return response.reason === "outcome-unknown" || response.reason === "network" ?
      { status: "failed", state: "outcome-unknown", reason: response.reason } : failure(503, response.reason)
    if (response.status >= 400) return failure(response.status, "domain.command.CAP10.delete producer rejected")
    return { status: "accepted" }
  }
  if (action === "save-milestone") {
    const decoded = Schema.decodeUnknownOption(SfDomain.operations["domain.command.CAP10.save-milestone"].input)(command)
    if (Option.isNone(decoded)) return failure(503, "domain.command.CAP10.save-milestone input contract unavailable")
    const response = await client["domain.command.CAP10.save-milestone"](decoded.value, { signal, idempotencyKey })
    if (response.kind === "transport-error") return response.reason === "outcome-unknown" || response.reason === "network" ?
      { status: "failed", state: "outcome-unknown", reason: response.reason } : failure(503, response.reason)
    if (response.status >= 400) return failure(response.status, "domain.command.CAP10.save-milestone producer rejected")
    return { status: "accepted" }
  }
  const decoded = Schema.decodeUnknownOption(SfDomain.operations["domain.command.CAP10.delete-milestone"].input)(command)
  if (Option.isNone(decoded)) return failure(503, "domain.command.CAP10.delete-milestone input contract unavailable")
  const response = await client["domain.command.CAP10.delete-milestone"](decoded.value, { signal, idempotencyKey })
  if (response.kind === "transport-error") return response.reason === "outcome-unknown" || response.reason === "network" ?
      { status: "failed", state: "outcome-unknown", reason: response.reason } : failure(503, response.reason)
  if (response.status >= 400) return failure(response.status, "domain.command.CAP10.delete-milestone producer rejected")
  return { status: "accepted" }
}
