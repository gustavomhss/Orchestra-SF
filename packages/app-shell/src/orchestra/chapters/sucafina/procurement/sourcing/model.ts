import { SfProcurement } from "@orchestra/schema/sucafina/procurement"
export type Cap25Page = typeof SfProcurement.operations["domain.page.CAP25"]["output"]["Type"]
export type Cap25PageOk = Extract<Cap25Page, { status:"ok" }>
export type SourcingRequest = Cap25PageOk["value"]["data"]["requests"][number]
export type SourcingEdit = typeof SfProcurement.operations["domain.command.CAP25.submit_sourcing"]["input"]["Type"]["values"]["sourcing"]
export type QuoteEdit = NonNullable<SourcingEdit["quotes"]>[number]
export type CriterionEdit = NonNullable<NonNullable<SourcingEdit["weights"]>["criteria"]>[number]
export type SourcingAction = "save" | "submit_sourcing" | "select_quote"
export const editableStages = ["sourcing","src_rejected"] as const

/** Preserve source IDs, quote metadata, criteria and each score byte. */
export function editableSourcing(request: SourcingRequest): SourcingEdit {
  const source = request.sourcing
  return {
    quotes: source?.quotes?.map((quote) => ({ ...quote })) ?? [],
    evaluator: source?.evaluator,
    selectedId: source?.selectedId,
    fewQuotesJustification: source?.fewQuotesJustification,
    selectionJustification: source?.selectionJustification,
    contractStrategy: source?.contractStrategy,
    weights: source?.weights
      ? { ...source.weights,criteria:source.weights.criteria?.map((entry)=>({...entry})),
          commCriteria:source.weights.commCriteria?.map((entry)=>({...entry})) }
      : undefined,
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
