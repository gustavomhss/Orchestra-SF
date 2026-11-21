import { SfProcurement } from "@orchestra/schema/sucafina/procurement"
export type Cap25Page = typeof SfProcurement.operations["domain.page.CAP25"]["output"]["Type"]
export type Cap25PageOk = Extract<Cap25Page, { status:"ok" }>
export type SourcingRequest = Cap25PageOk["value"]["data"]["requests"][number]
export type SourcingEdit = typeof SfProcurement.operations["domain.command.CAP25.submit_sourcing"]["input"]["Type"]["values"]["sourcing"]
export type QuoteEdit = NonNullable<SourcingEdit["quotes"]>[number]
export type CriterionEdit = NonNullable<NonNullable<SourcingEdit["weights"]>["criteria"]>[number]
export type SourcingAction = "save" | "submit_sourcing" | "select_quote"
export const editableStages = ["sourcing","src_rejected"] as const
const quoteFields = ["id", "supplierId", "supplier", "currency", "total", "description", "notes", "attachments", "scores", "cscores", "techPass", "qty", "unitPrice"] as const
const criterionFields = ["id", "name", "weight", "auto", "required"] as const
const scalarFields = ["evaluator", "selectedId", "fewQuotesJustification", "selectionJustification", "contractStrategy"] as const

export function isSourcingSourceField(path: string): boolean {
  if ([...scalarFields.map((field) => "sourcing." + field), "sourcing.quotes", "sourcing.weights.tech",
    "sourcing.weights.comm", "sourcing.weights.criteria", "sourcing.weights.commCriteria"].includes(path)) return true
  const quote = path.startsWith("sourcing.quote:")
  const criterion = path.startsWith("sourcing.criterion:")
  if (!quote && !criterion) return false
  try {
    const value: unknown = JSON.parse(path.slice(quote ? "sourcing.quote:".length : "sourcing.criterion:".length))
    if (!Array.isArray(value)) return false
    if (quote) return value.length === 2 && typeof value[0] === "string" && !!value[0] &&
      quoteFields.some((field) => field === value[1])
    return value.length === 3 && (value[0] === "criteria" || value[0] === "commCriteria") &&
      typeof value[1] === "string" && !!value[1] && criterionFields.some((field) => field === value[2])
  } catch { return false }
}

/** Typed source fields retained by editableSourcing. Nested rows need stable IDs. */
export function sourcingSourceFields(request: SourcingRequest): readonly string[] | undefined {
  const source = request.sourcing
  if (!source) return []
  const fields: string[] = []
  fields.push(...scalarFields.filter((field) => source[field] !== undefined).map((field) => "sourcing." + field))
  if (source.quotes !== undefined) {
    fields.push("sourcing.quotes")
    const ids = source.quotes.map((quote) => quote.id)
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length) return undefined
    source.quotes.forEach((quote) => quoteFields.filter((key) => quote[key] !== undefined).forEach((key) =>
      fields.push("sourcing.quote:" + JSON.stringify([quote.id, key]))))
  }
  if (source.weights !== undefined) {
    const weights = source.weights
    ;(["tech", "comm"] as const).filter((key) => weights[key] !== undefined).forEach((key) => fields.push("sourcing.weights." + key))
    for (const collection of ["criteria", "commCriteria"] as const) {
      const rows = weights[collection]
      if (rows === undefined) continue
      fields.push("sourcing.weights." + collection)
      const ids = rows.map((row) => row.id)
      if (ids.some((id) => !id) || new Set(ids).size !== ids.length) return undefined
      rows.forEach((row) => criterionFields.filter((key) => row[key] !== undefined).forEach((key) =>
        fields.push("sourcing.criterion:" + JSON.stringify([collection, row.id, key]))))
    }
  }
  return fields
}

/** Preserve source IDs, quote metadata, criteria and each score byte. */
export function editableSourcing(request: SourcingRequest): SourcingEdit {
  const source = request.sourcing
  return {
    quotes: source?.quotes?.map((quote) => ({ ...quote })) ?? [],
    ...Object.fromEntries(scalarFields.filter((field) => source?.[field] !== undefined)
      .map((field) => [field, source![field]])),
    ...(source?.weights ? { weights: {
      ...source.weights,
      ...(source.weights.criteria === undefined ? {} : {
        criteria: source.weights.criteria.map((entry) => ({ ...entry })),
      }),
      ...(source.weights.commCriteria === undefined ? {} : {
        commCriteria: source.weights.commCriteria.map((entry) => ({ ...entry })),
      }),
    } } : {}),
  }
}
export function uniqueRequest(page: Cap25PageOk, requestRef: string): SourcingRequest | null {
  const matches = page.value.data.requests.filter((r)=>r.number === requestRef)
  return matches.length === 1 ? matches[0]! : null
}
export function requestVersion(page: Cap25PageOk,requestRef:string): number | null {
  const version = page.value.versions["requests:"+requestRef]?.version
  return typeof version === "number" && Number.isSafeInteger(version) && version >= 0 ? version : null
}
export function requestRevision(page:Cap25PageOk,requestRef:string): string | null {
  const record=uniqueRequest(page,requestRef), version=requestVersion(page,requestRef)
  if (!record || version === null) return null
  return JSON.stringify({record,version,stamp:page.context,selection:page.value.selection,
    admitted:page.value.allowedActionIds,settings:page.value.data.formSettings})
}
export function quoteIsPersisted(request:SourcingRequest, quoteId:string):boolean {
  const quotes=request.sourcing?.quotes ?? []
  return quotes.filter((quote)=>quote.id === quoteId).length === 1
}
// No local ranking, FX conversion, quote total recomputation, authorization
// or client-selected source currency. Source financial facts remain immutable.
export function recordedFx(request:SourcingRequest) {
  return request.sourcing?.fxSnapshot ?? null
}
