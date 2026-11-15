import { SfProcurement } from "@orchestra/schema/sucafina/procurement"
export type Cap26Page = typeof SfProcurement.operations["domain.page.CAP26"]["output"]["Type"]
export type Cap26PageOk = Extract<Cap26Page,{status:"ok"}>
export type ApprovalRequest = Cap26PageOk["value"]["data"]["requests"][number]
export type ApprovalStage = "sourcing" | "po"
export type ApprovalDecision = "approve" | "reject"
export type ApprovalGroup = "you" | "others" | "unassigned"
export type PendingApproval = Readonly<{
  kind:"submitted"
  requestRef:string
  request:ApprovalRequest
  stage:ApprovalStage
  version:number
  stepOrdinal:number
  holderId:string|null
  holderName:string|null
  amount:number
  baseCurrency:string|null
  group:ApprovalGroup
  actions:readonly ApprovalDecision[]
  revision:string
}>
export type Lookup =
  | PendingApproval
  | Readonly<{kind:"not-found"|"not-pending"|"source-unavailable";reason?:string}>

export function findPendingApproval(page:Cap26PageOk,ref:string):Lookup {
  const matches=page.value.data.requests.filter((request)=>request.number===ref)
  if(matches.length===0)return {kind:"not-found"}
  if(matches.length!==1)return {kind:"source-unavailable",reason:"duplicate-record"}
  const request=matches[0]!
  if(request.status!=="src_pending"&&request.status!=="po_pending")
    return {kind:"not-pending",reason:request.status}
  const stage:ApprovalStage=request.status==="src_pending"?"sourcing":"po"
  const approval=stage==="sourcing"?request.sourcing?.approval:request.po?.approval
  const version=page.value.versions["requests:"+ref]?.version
  if(typeof version!=="number"||!Number.isSafeInteger(version)||version<0)
    return {kind:"source-unavailable",reason:"missing-version"}
  if(!approval||typeof approval.amount!=="number"||!Number.isFinite(approval.amount))
    return {kind:"source-unavailable",reason:"missing-submitted-amount"}
  const pending=approval.steps?.map((step,index)=>({step,index})).filter(({step})=>step.status==="pending")??[]
  if(pending.length!==1)return {kind:"source-unavailable",reason:"ambiguous-step"}
  const current=pending[0]!,holderId=current.step.holderId
  if(holderId!==null&&(typeof holderId!=="string"||!holderId.trim()))
    return {kind:"source-unavailable",reason:"invalid-holder"}
  const groups:ApprovalGroup[]=[
    ...(page.value.data.waitingForYou.some((row)=>row.number===ref)?["you" as const]:[]),
    ...(page.value.data.waitingForOthers.some((row)=>row.number===ref)?["others" as const]:[]),
    ...(page.value.data.unassigned.some((row)=>row.number===ref)?["unassigned" as const]:[]),
  ]
  if(groups.length!==1||(holderId===null)!==(groups[0]==="unassigned"))
    return {kind:"source-unavailable",reason:"queue-group-mismatch"}
  const submittedCurrency=stage==="sourcing"?request.sourcing?.approvalBaseCurrency:
    request.po?.approvalBaseCurrency
  const baseCurrency=typeof submittedCurrency==="string"&&/^[A-Z]{3}$/.test(submittedCurrency)
    ? submittedCurrency : null
  const actions=(["approve","reject"] as const).filter((action)=>
    groups[0]!=="others"&&baseCurrency!==null&&page.value.allowedActionIds.includes(action))
  const holderName=holderId===null?null:page.value.data.directory.find((person)=>person.id===holderId)?.name??null
  const revision=JSON.stringify({request,version,approval,stage,current:current.step,
    groups,allowedActionIds:page.value.allowedActionIds,stamp:page.context,
    selection:page.value.selection,blockSelfApproval:page.value.data.formSettings.blockSelfApproval})
  return {kind:"submitted",requestRef:ref,request,stage,version,stepOrdinal:current.index,
    holderId,holderName,amount:approval.amount,baseCurrency,group:groups[0]!,actions,revision}
}
export function sameApproval(left:PendingApproval,right:Lookup):right is PendingApproval {
  return right.kind==="submitted"&&right.requestRef===left.requestRef&&right.revision===left.revision
}
export function sourceChangedAfterUnknown(left:PendingApproval,page:Cap26PageOk):boolean {
  const next=findPendingApproval(page,left.requestRef)
  return next.kind==="not-pending"||(next.kind==="submitted"&&next.revision!==left.revision)
}
