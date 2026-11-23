import type { SfContextStamp, SfRef } from "@orchestra/schema/sucafina/context"
import { SfDomainContract } from "@orchestra/schema/sucafina/domain"
import type { createSfDomainClient } from "@orchestra/client/sucafina/domain"

// The canonical A01 page/command schemas own every accepted value. This leaf
// never reads a dashboard HTML representation, private Snapshot or global data.
type DomainClient = ReturnType<typeof createSfDomainClient>
type PageCall = Awaited<ReturnType<DomainClient["domain.page.CAP14"]>>
type PageBody = Extract<PageCall, { kind: "response" }>["body"]
export type SfVendorContract = typeof SfDomainContract.Type
export type SfVendorSave = Parameters<DomainClient["domain.command.CAP14.save"]>[0]
export type SfVendorEdit = SfVendorSave["values"]
export type SfVendorRead = Readonly<{
  kind: "ready"
  records: readonly SfVendorContract[]
  versions: Readonly<Record<string, number>>
  actionIds: readonly string[]
}> | Readonly<{ kind: "denied" | "unauthenticated" | "unavailable" | "stale" | "invalid" }>

const equalsStamp = (expected: SfContextStamp, actual: SfContextStamp) =>
  expected.installationId === actual.installationId &&
  expected.projectId === actual.projectId &&
  expected.hostId === actual.hostId &&
  expected.principalRef === actual.principalRef &&
  expected.policyVersion === actual.policyVersion &&
  expected.accessRevision === actual.accessRevision

export function decodeVendorContractsPage(
  response: PageBody, expected: SfContextStamp,
): SfVendorRead {
  if (response.status !== "ok") {
    if (response.status === "unauthenticated" || response.status === "denied" ||
        response.status === "stale") return { kind: response.status }
    return { kind: "unavailable" }
  }
  if (!equalsStamp(expected, response.context)) return { kind: "stale" }
  if (response.value.capabilityId !== "CAP14" || !response.value.data.contracts ||
      !Array.isArray(response.value.allowedActionIds) ||
      typeof response.value.versions !== "object") return { kind: "invalid" }
  return {
    kind: "ready",
    records: response.value.data.contracts,
    versions: response.value.versions,
    actionIds: response.value.allowedActionIds,
  }
}

export function vendorRef(row: SfVendorContract): SfRef {
  // The source allows both string and numeric record IDs; never use the row index.
  return String(row.id) as SfRef
}
export function vendorVersion(read: Extract<SfVendorRead, { kind: "ready" }>, ref: SfRef): number | undefined {
  const version = read.versions["contracts:" + ref]
  return Number.isSafeInteger(version) && version >= 0 ? version : undefined
}

const stringOf = (value: string | number | boolean | null | undefined): string | undefined =>
  value === undefined || value === null ? undefined : String(value)
const numberInput = (value: string | number | boolean | null | undefined): string | number | null | undefined =>
  value === null ? null : value === undefined ? undefined :
  typeof value === "number" || typeof value === "string" ? value : undefined
const oneOf = <T extends string>(value: unknown, values: readonly T[]): T | undefined =>
  typeof value === "string" && values.includes(value as T) ? value as T : undefined

/** Format only exact numeric representations; the command keeps its original scalar. */
export function vendorAmountText(value: unknown, locale: string): string {
  if (typeof value !== "number" && typeof value !== "string") return value == null ? "" : String(value)
  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric) || (typeof value === "string" && String(numeric) !== value)) return String(value)
  return new Intl.NumberFormat(locale, { maximumSignificantDigits: 21 }).format(numeric)
}

export function vendorEditFromRecord(row?: SfVendorContract): SfVendorEdit {
  // Readonly fields ownerId, currency, createdAt/updatedAt and docs MUST NOT
  // become new writable controls merely because the projection has them.
  return {
    vendor: stringOf(row?.vendor) ?? "",
    num: stringOf(row?.num), renewal: stringOf(row?.renewal),
    name: stringOf(row?.name), desc: stringOf(row?.desc),
    category: stringOf(row?.category), owner: stringOf(row?.owner),
    start: stringOf(row?.start), end: stringOf(row?.end),
    amount: numberInput(row?.amount) ?? (row ? undefined : null),
    amtType: oneOf(row?.amtType, ["total", "monthly", "annual"]) ?? "total",
    renewType: oneOf(row?.renewType, ["fixed", "na", "auto"]) ?? "fixed",
    notice: stringOf(row?.notice),
    eval: oneOf(row?.eval, ["", "A", "B", "C", "D"]) ?? "",
    notes: stringOf(row?.notes),
  }
}

export type SfVendorAction = "save" | "delete"
export function vendorCommandInput(
  action: "save", ref: SfRef | undefined, version: number, values: SfVendorEdit,
): SfVendorSave
export function vendorCommandInput(
  action: "delete", ref: SfRef, version: number, values: SfVendorEdit,
): Parameters<DomainClient["domain.command.CAP14.delete"]>[0]
export function vendorCommandInput(
  action: SfVendorAction, ref: SfRef | undefined, version: number, values: SfVendorEdit,
): SfVendorSave | Parameters<DomainClient["domain.command.CAP14.delete"]>[0] {
  if (action === "delete") return { id: ref, version, values: {} }
  // Snapshot the review store before hashing or dispatching. Reactive metadata
  // and undefined optionals are not JSON fields; every other value stays literal.
  return { ...(ref ? { id: ref } : {}), version,
    values: Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) }
}

export function vendorAuthorizedAction(
  contextAllowed: readonly string[], projectionAllowed: readonly string[], action: SfVendorAction,
): boolean {
  return contextAllowed.includes(action) && projectionAllowed.includes(action)
}
