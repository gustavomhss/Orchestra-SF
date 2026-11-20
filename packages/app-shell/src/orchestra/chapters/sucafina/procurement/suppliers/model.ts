import { SfProcurement } from "@orchestra/schema/sucafina/procurement"

export type Cap27Page = typeof SfProcurement.operations["domain.page.CAP27"]["output"]["Type"]
export type Cap27PageOk = Extract<Cap27Page, { status: "ok" }>
export type Supplier = Cap27PageOk["value"]["data"]["suppliers"][number]
export type SupplierEdit = typeof SfProcurement.operations["domain.command.CAP27.save"]["input"]["Type"]["values"]["supplier"]
export type SupplierAction = "create" | "save" | "activate" | "block" | "inactivate" | "delete" | "change-bank"

export const generalFields = [
  "legalName", "tradingName", "type", "country", "address", "taxId", "regNo",
  "contactName", "contactEmail", "contactPhone", "financeEmail", "paymentTerms",
  "currency", "incoterm", "riskRating", "dueDiligence", "sanctionsDate", "nda", "dpa",
  "certifications", "categories", "notes",
] as const satisfies readonly (keyof SupplierEdit)[]
export const bankFields = ["iban", "account", "bankName", "swift", "accountHolder", "bankCountry"] as const satisfies readonly (keyof SupplierEdit)[]
export const booleanFields: readonly (keyof SupplierEdit)[] = ["dueDiligence","nda","dpa"]
export const multilineFields: readonly (keyof SupplierEdit)[] = ["address","notes","certifications","categories"]

/** Stable source-issued edit groups, including optional fields initially absent. */
export const generalDraftFields = [...generalFields, "contacts", "commercial.notes", "compliance.notes"] as const

// Never copy bank data from source projection into a general draft. Buyer
// source values are redacted; privileged bank updates use their own intent.
export function supplierEdit(source: Supplier): SupplierEdit {
  return Object.fromEntries([
    ...generalFields.map((field) => [field, source[field]]),
    ["contacts", source.contacts], ["commercial", source.commercial], ["compliance", source.compliance],
  ].filter(([, value]) => value !== undefined)) as SupplierEdit
}

export function supplierVersion(page: Cap27PageOk, ref: string): number | null {
  const version = page.value.versions["suppliers:" + ref]?.version
  return typeof version === "number" && Number.isSafeInteger(version) && version >= 0 ? version : null
}

export function linkedRequests(page: Cap27PageOk, ref: string) {
  return page.value.data.requests.filter((request) =>
    request.po?.supplierId === ref ||
    request.sourcing?.quotes?.some((quote) => quote.supplierId === ref) === true,
  )
}

export function uniqueSupplier(page: Cap27PageOk, ref: string) {
  const matches = page.value.data.suppliers.filter((row) => row.id === ref)
  return matches.length === 1 ? matches[0] : null
}

/** Snapshot equality is an invalidation check, never an authorization grant. */
export function supplierRevision(page: Cap27PageOk, ref: string): string | null {
  const record = uniqueSupplier(page, ref), version = supplierVersion(page, ref)
  if (!record || version === null) return null
  return JSON.stringify({ record, version, stamp: page.context, selection: page.value.selection, actions: page.value.allowedActionIds })
}
