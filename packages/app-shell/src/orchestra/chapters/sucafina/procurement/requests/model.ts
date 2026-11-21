import type { SfContextStamp, SfRef } from "@orchestra/schema/sucafina/context"
import { SfProcurementRequest } from "@orchestra/schema/sucafina/procurement"
import type { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"

/** U11-only PR/PO projection model. W19 owns title save, U12 sourcing, U13 approvals. */
type Client = ReturnType<typeof createSfProcurementClient>
type ReadCall = Awaited<ReturnType<Client["domain.page.CAP25"]>>
type ReadBody = Extract<ReadCall, { kind: "response" }>["body"]
export type SfRequest = typeof SfProcurementRequest.Type
export type SfRequestInput = Parameters<Client["domain.page.CAP25"]>[0]
export type SfRequestCreate = Parameters<Client["domain.command.CAP25.create"]>[0]
export type SfRequestSave = Parameters<Client["domain.command.CAP25.save"]>[0]
export type SfRequestSubmitPr = Parameters<Client["domain.command.CAP25.submit_pr"]>[0]
export type SfRequestSubmitPo = Parameters<Client["domain.command.CAP25.submit_po"]>[0]
export type SfPrEdit = Extract<SfRequestSave["values"], { pr: unknown }>["pr"]
export type SfPoEdit = Extract<SfRequestSave["values"], { po: unknown }>["po"]
export type SfPoLine = NonNullable<SfPoEdit["lines"]>[number]
export type SfRequestCommand = "create" | "save-pr" | "save-po" | "submit_pr" |
  "submit_po" | "issue" | "cancel" | "delete"

export type SfRequestsRead = Readonly<{
  kind: "ready"
  records: readonly SfRequest[]
  versions: Readonly<Record<string, { readonly version: number; readonly by: string }>>
  actionIds: readonly string[]
}> | Readonly<{ kind: "denied" | "unauthenticated" | "unavailable" | "stale" | "invalid" }>

const stampsEqual = (a: SfContextStamp, b: SfContextStamp) =>
  a.installationId === b.installationId && a.projectId === b.projectId &&
  a.hostId === b.hostId && a.principalRef === b.principalRef &&
  a.policyVersion === b.policyVersion && a.accessRevision === b.accessRevision

export function decodeRequestsPage(value: ReadBody, expected: SfContextStamp): SfRequestsRead {
  if (value.status !== "ok") {
    if (value.status === "denied" || value.status === "unauthenticated" ||
        value.status === "stale") return { kind: value.status }
    return { kind: "unavailable" }
  }
  if (!stampsEqual(value.context, expected)) return { kind: "stale" }
  const page = value.value
  if (page.capabilityId !== "CAP25" || !Array.isArray(page.data.requests) ||
      !Array.isArray(page.allowedActionIds) || !page.versions) return { kind: "invalid" }
  return { kind: "ready", records: page.data.requests, versions: page.versions, actionIds: page.allowedActionIds }
}
export function requestRef(row: SfRequest): SfRef | undefined {
  return typeof row.number === "string" && row.number ? row.number as SfRef : undefined
}
export function requestVersion(
  read: Extract<SfRequestsRead, { kind: "ready" }>, ref: SfRef,
): number | undefined {
  const version = read.versions["requests:" + ref]?.version
  return Number.isSafeInteger(version) && version >= 0 ? version : undefined
}
const numberInput = (item: string | number | boolean | null | undefined): string | number | null | undefined =>
  item === null ? null : typeof item === "number" || typeof item === "string" ? item : undefined
const booleanInput = (item: string | boolean | undefined): boolean | "true" | "false" | "on" | undefined =>
  item === true || item === "true" || item === "on" ? true : item === false || item === "false" ? false : undefined

export function prFromRecord(row?: SfRequest): SfPrEdit {
  const pr = row?.pr
  return {
    // Existing title belongs to W19. Never send it in a residual PR save.
    ...(row ? {} : { title: "" }),
    type: pr?.type, description: pr?.description,
    estAmount: numberInput(pr?.estAmount),
    costCenter: pr?.costCenter, needBy: pr?.needBy,
    justification: pr?.justification,
    recurring: booleanInput(pr?.recurring),
    frequency: pr?.frequency, estAnnual: numberInput(pr?.estAnnual),
    expenseType: pr?.expenseType, category: pr?.category,
  }
}
export function reviewedPr(values: SfPrEdit): SfPrEdit {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined))
}
export function postedPoLine(line: SfPoLine): SfPoLine {
  return {
    ...(line.id !== undefined ? { id: line.id } : {}),
    ...(line.desc !== undefined ? { desc: line.desc } : {}),
    ...(line.qty !== undefined ? { qty: line.qty } : {}),
    ...(line.unitPrice !== undefined ? { unitPrice: line.unitPrice } : {}),
    ...(line.unit !== undefined ? { unit: line.unit } : {}),
    ...(line.notes !== undefined ? { notes: line.notes } : {}),
  }
}
export function poFromRecord(row: SfRequest): SfPoEdit {
  const po = row.po
  return {
    currency: po?.currency, expenseType: po?.expenseType,
    supplier: po?.supplier, supplierId: po?.supplierId,
    description: po?.description,
    // The source's nested line IDs/order must survive all edits and refetches.
    // description is not an editor field and must not ride along on save.
    ...(po?.lines ? { lines: po.lines.map(postedPoLine) } : {}),
    paymentTerms: po?.paymentTerms, deliveryDate: po?.deliveryDate,
    deliveryConditions: po?.deliveryConditions,
    contractRef: po?.contractRef, incoterm: po?.incoterm, incoterms: po?.incoterms,
    assetRef: po?.assetRef, supplierContact: po?.supplierContact, quoteRef: po?.quoteRef,
    billingAddress: po?.billingAddress, deliveryAddress: po?.deliveryAddress,
    acceptance: po?.acceptance, warranty: po?.warranty, notes: po?.notes,
  }
}
export function isPrWritable(row: SfRequest) {
  return (row.status === "draft" || row.status === "pr_rejected") &&
    row.allowedDraftActions?.includes("save-pr") === true
}
export function isPoWritable(row: SfRequest) {
  return (row.status === "po_draft" || row.status === "po_rejected") &&
    row.allowedDraftActions?.includes("save-po") === true
}
export function uiCommandAction(command: SfRequestCommand): string {
  return command === "save-pr" || command === "save-po" ? "save" : command
}
export function validatePr(values: SfPrEdit, creating: boolean): boolean {
  if (creating && !values.title?.trim()) return false
  if (values.estAmount !== undefined && values.estAmount !== null && values.estAmount !== "" &&
      !Number.isFinite(Number(values.estAmount))) return false
  if (values.estAnnual !== undefined && values.estAnnual !== null && values.estAnnual !== "" &&
      !Number.isFinite(Number(values.estAnnual))) return false
  return true
}
export function validatePo(values: SfPoEdit): boolean {
  return Array.isArray(values.lines) && values.lines.every((line) =>
    (line.qty === undefined || line.qty === null || line.qty === "" || Number.isFinite(Number(line.qty))) &&
    (line.unitPrice === undefined || line.unitPrice === null || line.unitPrice === "" ||
      Number.isFinite(Number(line.unitPrice))),
  )
}
export function displayScalar(value: unknown): string {
  return value === null || value === undefined ? "" : String(value)
}
