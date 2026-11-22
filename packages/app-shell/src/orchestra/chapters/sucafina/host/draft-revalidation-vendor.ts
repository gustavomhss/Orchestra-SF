import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfReadableContext, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { decodeVendorContractsPage, vendorRef, vendorVersion } from "../procurement/contracts/model"
import { draftAvailability } from "./draft-revalidation-availability"

// CAP14's original save operation explicitly creates a contract when id is absent.
const fields = ["vendor", "num", "name", "desc", "category", "owner", "start", "end", "amount",
  "amtType", "renewal", "renewType", "notice", "eval", "notes"]

export async function revalidateVendorContractDraft(
  input: SfDraftRevalidationInput, fresh: SfReadableContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (input.surfaceId !== "CAP14" || input.read.operationId !== "domain.page.CAP14" ||
      input.editScopeKey !== "vendor-contract-fields" || input.read.actionIds.length !== 1 ||
      input.read.actionIds[0] !== "save" || input.read.fieldPaths.some((field) => !fields.includes(field)) ||
      input.identity.kind === "new" && input.read.fieldPaths.length) return { status: "unavailable" }
  const source = input.read.input
  if (!source || typeof source !== "object" || Array.isArray(source) || Object.keys(source).length)
    return { status: "unavailable" }
  if (!fresh.destinations.some((item) => item.capabilityId === "CAP14" && item.surface === "dashboard" &&
      item.page === "Vendor Contracts" && item.canRead && item.allowedActionIds.includes("save"))) return { status: "denied" }
  const availability = draftAvailability(fresh, "domain-read", "CAP14", ["domain.page.CAP14", "domain.command.CAP14.save"])
  if (availability) return availability
  const result = await createSfDomainClient(transport)["domain.page.CAP14"]({}, { signal }).catch(() => undefined)
  if (signal.aborted || !result || result.kind !== "response") return { status: "unavailable" }
  if (result.status === 401 || result.status === 403 || result.body.status === "unauthenticated" ||
      result.body.status === "denied") return { status: "denied" }
  if (result.status !== 200) return { status: "unavailable" }
  const read = decodeVendorContractsPage(result.body, fresh.stamp)
  if (read.kind === "stale") return { status: result.body.status === "stale" ? "unavailable" : "authority-changed" }
  if (read.kind !== "ready") return { status: "unavailable" }
  if (!read.actionIds.includes("save")) return { status: "denied" }
  if (input.identity.kind === "new")
    return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: null }
  const ref = input.identity.recordRef
  const rows = read.records.filter((row) => vendorRef(row) === ref)
  if (rows.length !== 1) return { status: "unavailable" }
  const row = rows[0]!
  if (input.read.fieldPaths.some((field) => !Object.entries(row).some(([key, value]) => key === field && value !== undefined)))
    return { status: "denied" }
  const version = vendorVersion(read, ref)
  if (version === undefined) return { status: "unavailable" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: version }
}

