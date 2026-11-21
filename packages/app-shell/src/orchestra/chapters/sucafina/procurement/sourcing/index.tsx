import { createEffect, createMemo, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore, unwrap } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { useSfContext } from "../../context"
import type { SfContext, SfEditScopeKey, SfSurfaceProps } from "../../context/contracts"
import type { SfDraftState, SfPendingOperation } from "../../shared/draft"
import type { SfIntentRef, SfOperationRef, SfRef } from "@orchestra/schema/sucafina/context"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { SfDataTable } from "../../shared/table"
import { SfChangeReview } from "../../shared/change-review"
import type { SfReviewSnapshot, SfReviewField } from "../../shared/change-review"
import type { SfCopyKey, SfMessage, SfText, SfUiState } from "../../shared/frame"
import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import { sfDraftConflicted, sfDraftForEdit, sfRetainDraft } from "../draft-conflict"
import type { SfU12CopyKey } from "@/i18n/orchestra-chapters/sf-u12"
import { isPoWritable } from "../requests/model"
import {
  editableSourcing, editableStages, quoteIsPersisted, recordedFx, requestRevision, sourcingSourceFields,
  requestVersion, uniqueRequest, type Cap25PageOk, type QuoteEdit, type SourcingAction,
  type SourcingEdit, type SourcingRequest,
} from "./model"
import "./sourcing.css"

type PageRead =
  | Readonly<{kind:"ok";page:Cap25PageOk}>
  | Readonly<{kind:"unavailable"|"denied"|"session-expired"|"stale"|"not-found"|"invalid"}>
type Phase = "idle" | "reviewing" | "checking" | "submitting" | "outcome-unknown" | "verifying" | "producer-confirmed" | "conflict" | "failed"
type Intent = Readonly<{
  action: SourcingAction
  requestRef: string
  version: number
  sourceRevision: string
  token: string
  sourcing: SourcingEdit
  quoteId: string | null
  intentRef: SfIntentRef
}>
const k = (key:SfU12CopyKey) => key as SfCopyKey
const m = (key:SfU12CopyKey):SfMessage => ({key:k(key)})
const data = (text:string):SfText => ({kind:"data",text})
const asString = (v:unknown):string => v == null ? "" : typeof v === "string" ? v : String(v)
const truth = (v:unknown) => v === true || v === "true" || v === "on"
const active = (v:Phase) => ["reviewing","checking","submitting","verifying","outcome-unknown"].includes(v)
const toView = (v:unknown) => ({kind:"text" as const,text:data(v == null || v === "" ? "—" : asString(v))})
const scoreValue = (scores:QuoteEdit["scores"], index:number):string|number|null|undefined => {
  if (scores == null) return undefined
  if (Array.isArray(scores)) return (scores as readonly (string|number|null)[])[index]
  return (scores as Readonly<Record<string, string|number|null>>)[String(index)]
}

/** Source-read and editable-stage admission must not depend on operational save. */
export function sourcingDraftReadAuthorized(row:SourcingRequest,context:SfContext):boolean {
  if(!editableStages.some((stage)=>stage===row.status)||
    row.allowedDraftActions?.includes("save-sourcing")!==true||
    !context.destinations.some((destination)=>destination.capabilityId==="CAP25"&&
      destination.surface==="procurement"&&destination.page==="Requests"&&destination.canRead))return false
  const resources=context.availability.filter((resource)=>
    resource.family==="procurement"&&resource.resource==="CAP25")
  if(resources.length!==1||(resources[0]?.state!=="ready"&&resources[0]?.state!=="partial"))return false
  const reads=resources[0]!.operations.filter((operation)=>operation.operationId==="domain.page.CAP25")
  return reads.length===1&&reads[0]?.state==="ready"&&reads[0]?.operational===true
}

export function sourcingDraftDispatchable(
  state:SfDraftState<SourcingEdit>|undefined,version:number,action:SourcingAction,value:SourcingEdit,
):boolean {
  if(state?.availability!=="active"||state.conflict!==null||state.pendingOperation!==null||
    state.baseVersion!==version||state.phase==="outcome-unknown"||state.phase==="submitting")return false
  // Selecting a persisted quote cannot silently overwrite local unsaved sourcing edits.
  return action==="select_quote"?!state.dirty:JSON.stringify(state.value)===JSON.stringify(value)
}

export function sourcingPendingMatches(
  state:SfDraftState<SourcingEdit>,pending:SfPendingOperation,
):boolean {
  if(state.availability!=="active"||!state.pendingOperation)return false
  const recorded=state.pendingOperation
  return recorded.operationRef===pending.operationRef&&recorded.idempotencyKey===pending.idempotencyKey&&
    recorded.payloadDigest===pending.payloadDigest&&Object.is(recorded.expectedVersion,pending.expectedVersion)
}

export function SfSourcingView(props:SfSurfaceProps<"CAP25">):JSX.Element {
  const host = useSfContext()
  const language = useLanguage()
  const t = (key:SfU12CopyKey) => language.t(k(key) as Parameters<typeof language.t>[0])
  const [ui,setUi] = createStore<{
    token:string|null
    page:Cap25PageOk|null
    state:SfUiState
    selected:string|null
    quoteChoice:string
    stage:"sourcing"|"quotes"
    phase:Phase
    sending:boolean
    review:Intent|null
    unknownOperation:string|null
    lastError:SfUiState|null
    sourceWarnings:readonly string[]
    fieldErrors:readonly {field:string;message:string}[]
    sort: "source"|"supplier"|"currency"
    search:string
    layoutMode:"single"|"split"|"split-context"
  }>({
    token:null,page:null,state:"loading",selected:null,quoteChoice:"",
    stage:"sourcing",phase:"idle",sending:false,review:null,unknownOperation:null,lastError:null,
    sourceWarnings:[],fieldErrors:[],sort:"source",search:"",layoutMode:"split",
  })
  let readController:AbortController|undefined
  let commandController:AbortController|undefined
  let readSequence=0
  const authority=()=>{
    const state=host.state(),ready=host.ready()
    if(state.status!=="ready"||!ready)return null
    const selected=props.route.ownerSelection
    if(state.selection.serverKey!==selected.serverKey||
      state.selection.projectId!==selected.projectId||
      state.selection.installationId!==selected.installationId)return null
    return JSON.stringify([state.ownerKey,host.generation(),state.owner.authEpoch,state.context.stamp,props.route.href])
  }
  const directRef=()=>props.route.kind==="sourcing"||props.route.kind==="quotes"||
    props.route.kind==="detail"||props.route.kind==="requisition"||
    props.route.kind==="po"||props.route.kind==="history"
    ? props.route.params.requestRef : null
  const ref=()=>directRef()??ui.selected
  const page=()=>authority()!==null&&ui.token===authority()?ui.page:null
  const request=createMemo(()=>{
    const current=page(),requestRef=ref()
    return current&&requestRef?uniqueRequest(current,requestRef):null
  })
  const sourceVersion=()=>{
    const current=page(),recordRef=ref()
    return current&&recordRef?requestVersion(current,recordRef):null
  }
  const can=(action:SourcingAction)=>{
    const current=page(),ready=host.ready(),row=request()
    return !!current&&!!ready&&!!row&&editableStages.includes(row.status as typeof editableStages[number])&&
      row.allowedDraftActions?.includes("save-sourcing")===true&&
      ready.context.destinations.some((destination)=>destination.capabilityId==="CAP25"&&
        destination.surface==="procurement"&&destination.page==="Requests"&&destination.canRead&&
        destination.allowedActionIds.includes(action))&&
      current.value.allowedActionIds.includes(action)&&
      ready.context.availability.some((resource)=>resource.family==="procurement"&&resource.resource==="CAP25"&&
        resource.state!=="denied"&&resource.state!=="unavailable"&&
        resource.operations.some((operation)=>operation.operationId==="domain.command.CAP25."+action&&
          operation.state==="ready"&&operation.operational))
  }
  const poSubmitOpen=()=>{
    const current=page(),ready=host.ready(),row=request()
    if(!current||!ready||!row||!isPoWritable(row))return false
    return ready.context.destinations.some((destination)=>destination.capabilityId==="CAP25"&&
        destination.canRead&&destination.allowedActionIds.includes("submit_po"))&&
      current.value.allowedActionIds.includes("submit_po")&&
      ready.context.availability.some((resource)=>resource.family==="procurement"&&resource.resource==="CAP25"&&
        resource.state!=="denied"&&resource.state!=="unavailable"&&
        resource.operations.some((operation)=>operation.operationId==="domain.command.CAP25.submit_po"&&
          operation.state==="ready"&&operation.operational))
  }
  const read=async(token:string,requestRef:string|undefined,signal:AbortSignal):Promise<PageRead>=>{
    const ready=host.ready()
    if(!ready||authority()!==token)return {kind:"unavailable"}
    try{
      const result=await createSfProcurementClient(ready.transport)["domain.page.CAP25"](
        requestRef?{request:requestRef}:{},{signal})
      if(signal.aborted||authority()!==token)return {kind:"unavailable"}
      if(result.kind==="transport-error")return {kind:"unavailable"}
      if(result.status===401||result.body.status==="unauthenticated")return {kind:"session-expired"}
      if(result.status===403||result.body.status==="denied")return {kind:"denied"}
      if(result.status===404)return {kind:"not-found"}
      if(result.status===409||result.body.status==="stale")return {kind:"stale"}
      if(result.status!==200||result.body.status!=="ok")return {kind:"unavailable"}
      const page=result.body
      if(page.value.capabilityId!=="CAP25"||
        Object.keys(ready.context.stamp).some((field)=>
          page.context[field as keyof typeof page.context] !==
          ready.context.stamp[field as keyof typeof ready.context.stamp]))
        return {kind:"invalid"}
      return {kind:"ok",page}
    }catch{return {kind:"unavailable"}}
  }
  const refresh=async(token:string,requestRef?:string)=>{
    readController?.abort()
    const controller=new AbortController()
    readController=controller
    const sequence=++readSequence
    const result=await read(token,requestRef,controller.signal)
    if(controller.signal.aborted||sequence!==readSequence||authority()!==token)return null
    if(result.kind!=="ok"){
      if(["denied","session-expired","invalid"].includes(result.kind))setUi("page",null)
      setUi("state",result.kind)
      return null
    }
    if(ui.review&&requestRevision(result.page,ui.review.requestRef)!==ui.review.sourceRevision){
      draft()?.setPhase("conflict")
      setUi({review:null,phase:"conflict"})
    }
    setUi("page",result.page)
    setUi("state","ready")
    if(requestRef){
      const selected=uniqueRequest(result.page,requestRef)
      if(selected?.sourcing?.selectedId)setUi("quoteChoice",selected.sourcing.selectedId)
    }
    return result.page
  }
  createEffect(()=>{
    const token=authority(),wanted=directRef()
    readController?.abort()
    commandController?.abort()
    commandController=undefined
    setUi({token,page:null,state:token?"loading":"session-expired",
      selected:wanted,quoteChoice:"",stage:props.route.kind==="quotes"?"quotes":"sourcing",
      phase:"idle",sending:false,review:null,unknownOperation:null,lastError:null,sourceWarnings:[],fieldErrors:[]})
    if(token)void refresh(token,wanted??undefined)
    onCleanup(()=>{readController?.abort();commandController?.abort()})
  })
  const draft=createMemo(()=>{
    const ready=host.ready(),row=request(),version=sourceVersion()
    if(!ready||!page()||!row?.number||version===null||!sourcingDraftReadAuthorized(row,ready.context))return null
    const original=editableSourcing(row)
    const selection={surfaceId:"CAP25" as const,identity:{kind:"record" as const,recordRef:row.number as SfRef},
      editScopeKey:"CAP25:sourcing" as SfEditScopeKey}
    return sfRetainDraft<SourcingEdit>(ready.drafts,{
      ...selection,
      baseVersion:version,base:original,value:original,
      revalidation:{operationId:"domain.page.CAP25",input:{request:row.number},
        fieldPaths:sourcingSourceFields(row)??["sourcing.unidentified-item"],actionIds:["save"]},
    })
  })
  createEffect(()=>{
    const row=request(),version=sourceVersion(),controller=draft()
    if(!row||version===null||!controller)return
    const state=controller.snapshot()
    // A dirty draft intentionally keeps its original CAS when a newer remote
    // version conflicts. Replaying that *same* remote witness from this effect
    // causes receiveRemote() to publish again and recursively rerun Solid.
    // A genuinely newer source version may still update the conflict witness.
    if(state.availability==="active"&&state.baseVersion!==version&&
      state.conflict?.currentVersion!==version)
      controller.receiveRemote({baseVersion:version,value:editableSourcing(row)})
  })
  const snapshot=()=>draft()?.snapshot()
  const draftPending=()=>{const state=snapshot();return state?.availability==="active"&&!!state.pendingOperation}
  const draftConflict=()=>sfDraftConflicted(snapshot(),sourceVersion()??undefined)
  const editable=()=>!!sfDraftForEdit(snapshot(),sourceVersion()??undefined)
  const edit=():SourcingEdit=>{
    return sfDraftForEdit(snapshot(),sourceVersion()??undefined)?.value??{}
  }
  const update=(fn:(old:SourcingEdit)=>SourcingEdit)=>{
    const controller=draft(),state=controller?.snapshot()
    if(!controller||!sfDraftForEdit(state,sourceVersion()??undefined)||state?.availability!=="active"||active(ui.phase))return
    controller.edit(fn(state.value))
  }
  const changeField=(field:"evaluator"|"fewQuotesJustification"|"selectionJustification"|"contractStrategy",next:string)=>
    update((old)=>({...old,[field]:next}))
  const updateQuote=(index:number,field:keyof QuoteEdit,next:string|number|boolean|null)=>{
    update((old)=>({...old,quotes:(old.quotes??[]).map((item,position)=>
      position===index?{...item,[field]:next}:item)}))
  }
  const score=(index:number,kind:"scores"|"cscores",criterion:number,raw:string)=>{
    update((old)=>({...old,quotes:(old.quotes??[]).map((item,position)=>{
      if(position!==index)return item
      const scores=item[kind]
      if(scores==null){
        const created:Record<string,string|number|null>={}
        created[String(criterion)]=raw
        return {...item,[kind]:created}
      }
      if(Array.isArray(scores)){
        const values=[...scores]
        // Automatic criteria have no manual score; keep those positions as JSON null.
        while(values.length<=criterion)values.push(null)
        values[criterion]=raw
        return {...item,[kind]:values}
      }
      const values={...scores} as Record<string,string|number|null>
      values[String(criterion)]=raw
      return {...item,[kind]:values}
    })}))
  }
  const addQuote=()=>update((old)=>({...old,quotes:[...(old.quotes??[]),{
    id:"quote-"+crypto.randomUUID(),supplier:"",currency:"",total:null,
    qty:"",unitPrice:"",techPass:true,scores:[],cscores:[],
  }]}))
  const removeQuote=(index:number)=>update((old)=>({...old,quotes:(old.quotes??[]).filter((_,i)=>i!==index)}))
  const updateWeight=(field:"tech"|"comm",raw:string)=>
    update((old)=>({...old,weights:{...old.weights,[field]:raw}}))
  const updateCriterion=(kind:"criteria"|"commCriteria",index:number,field:"name"|"weight"|"auto",next:string|boolean)=>
    update((old)=>({...old,weights:{...old.weights,[kind]:(old.weights?.[kind]??[]).map((entry,i)=>
      i===index?{...entry,[field]:next}:entry)}}))
  const addCriterion=(kind:"criteria"|"commCriteria")=>
    update((old)=>({...old,weights:{...old.weights,[kind]:[...(old.weights?.[kind]??[]),{name:"",weight:"",auto:false}]}}))
  const removeCriterion=(kind:"criteria"|"commCriteria",index:number)=>
    update((old)=>({...old,weights:{...old.weights,[kind]:(old.weights?.[kind]??[]).filter((_,i)=>i!==index)}}))
  const requestRows=()=>page()?.value.data.requests.filter((row)=>
    editableStages.includes(row.status as typeof editableStages[number]))??[]
  const quotes=()=>{
    const recorded=ui.stage==="quotes"?request()?.sourcing?.quotes??[]:edit().quotes??request()?.sourcing?.quotes??[]
    const query=ui.search.trim().toLocaleLowerCase()
    const shown=recorded.filter((quote)=>!query||[quote.id,quote.supplier,quote.currency].some((v)=>
      asString(v).toLocaleLowerCase().includes(query)))
    const sort=ui.sort
    if(sort==="source")return shown
    return [...shown].sort((a,b)=>asString(a[sort]).localeCompare(asString(b[sort])))
  }
  const state=():SfUiState=>{
    if(!authority()||ui.token!==authority()){
      const status=host.state().status
      return status==="denied"?"denied":status==="resolving"?"loading":
        status==="context-mismatch"?"invalid":
        status==="unavailable"||status==="choose-installation"?"unavailable":"session-expired"
    }
    if(ui.state!=="ready")return ui.state
    if(ui.phase==="outcome-unknown"||draftPending())return "outcome-unknown"
    if(ui.phase==="conflict"&&!request())return "conflict"
    if(ui.phase==="failed"){
      const snap=snapshot()
      return ui.lastError==="denied"||ui.lastError==="session-expired"||ui.lastError==="not-found"||
        !!(snap?.availability==="active"&&snap.pendingOperation) ? ui.lastError??"unavailable" : "ready"
    }
    if(ref()&&!request())return "not-found"
    if(!ref()&&requestRows().length===0)return "empty"
    return "ready"
  }
  const message=():SfU12CopyKey=>({
    loading:"sf.u12.loading",unavailable:"sf.u12.unavailable",denied:"sf.u12.denied",
    "session-expired":"sf.u12.sessionExpired","not-found":"sf.u12.notFound",
    invalid:"sf.u12.invalid",empty:"sf.u12.empty",stale:"sf.u12.stale",
    conflict:"sf.u12.conflict","outcome-unknown":"sf.u12.unknown",
    "filtered-empty":"sf.u12.filteredEmpty",
  } as Partial<Record<SfUiState,SfU12CopyKey>>)[state()]??"sf.u12.unavailable"
  const begin=(action:SourcingAction)=>{
    const row=request(),current=page(),token=authority(),requestRef=row?.number,version=sourceVersion()
    if(!row||!current||!token||!requestRef||version===null||
       ui.review||active(ui.phase)||ui.phase==="conflict"||ui.sending||draftConflict()||draftPending())return
    const controller=draft(),sourcing=action==="select_quote"?editableSourcing(row):edit()
    if(!controller||!sourcingDraftDispatchable(controller.snapshot(),version,action,sourcing)){
      setUi({state:"unavailable",lastError:"unavailable"})
      return
    }
    if(!can(action))return
    const sourceRevision=requestRevision(current,requestRef)
    if(!sourceRevision)return
    const winning=action==="select_quote"?ui.quoteChoice:null
    if(action==="select_quote"&&(!winning||!quoteIsPersisted(row,winning)))return
    const intent:Intent={action,requestRef,version,sourceRevision,token,
      sourcing,quoteId:winning,intentRef:crypto.randomUUID() as SfIntentRef}
    controller.setPhase("reviewing")
    setUi("review",intent)
    setUi("phase","reviewing")
    setUi("lastError",null)
  }
  const quoteAmount = (quote: QuoteEdit) => {
    const amount = quote.total == null ? "" : asString(quote.total)
    const currency = typeof quote.currency === "string" ? quote.currency.trim() : ""
    if (!amount && !currency) return null
    return amount ? amount + (currency ? " " + currency : " unspecified") : currency
  }
  const fields=(intent:Intent):SfReviewField[]=>[
    {path:"status",label:m("sf.u12.stage"),value:toView(request()?.status)},
    {path:"sourcing.evaluator",label:m("sf.u12.evaluator"),value:toView(intent.sourcing.evaluator)},
    {path:"sourcing.selectionJustification",label:m("sf.u12.selectionJustification"),value:toView(intent.sourcing.selectionJustification)},
    {path:"sourcing.contractStrategy",label:m("sf.u12.contractStrategy"),value:toView(intent.sourcing.contractStrategy)},
    {path:"sourcing.quotes",label:m("sf.u12.quotes"),value:toView(intent.sourcing.quotes?.length)},
    ...(intent.sourcing.quotes ?? []).flatMap((quote, index) => [
      {path:"sourcing.quotes." + index + ".currency",label:m("sf.u12.quoteCurrency"),value:toView(quote.currency)},
      {path:"sourcing.quotes." + index + ".total",label:m("sf.u12.quoteTotal"),value:toView(quoteAmount(quote))},
    ]),
    {path:"quoteId",label:m("sf.u12.selectId"),value:toView(intent.quoteId)},
  ]
  const reviewSnapshot=(intent:Intent):SfReviewSnapshot=>({
    kind:"persisted",ref:intent.requestRef as SfRef,version:intent.version,
    fields:fields({...intent,sourcing:request()?editableSourcing(request()!):intent.sourcing,
      quoteId:request()?.sourcing?.selectedId??null}),
  })
  const proposed=(intent:Intent):SfReviewSnapshot=>({
    kind:"draft",intentRef:intent.intentRef,sourceRef:intent.requestRef as SfRef,
    sourceVersion:intent.version,fields:fields(intent),
  })
  const confirmation=()=>{
    const intent=ui.review
    if(!intent||draftConflict()||draftPending()||!can(intent.action)||intent.token!==authority()||
      !sourcingDraftDispatchable(draft()?.snapshot(),intent.version,intent.action,intent.sourcing))
      return {kind:"blocked",labelKey:k("sf.u12.readOnly"),reasons:[m("sf.u12.readOnly")]} as const
    return {kind:"admitted",labelKey:k("sf.u12.confirm"),purpose:
      (intent.action==="select_quote"?"select":intent.action==="save"?"save":"submit") as "select"|"submit"|"save",
      binding:{kind:"catalog-command",operationId:
        ("domain.command.CAP25."+intent.action) as
        "domain.command.CAP25.save"|"domain.command.CAP25.select_quote"|"domain.command.CAP25.submit_sourcing",
        version:{kind:"record",expectedVersion:intent.version},
        confirmation:"presentation-only"},
    } as const
  }
  const confirm=async(admitted:Extract<ReturnType<typeof confirmation>,{kind:"admitted"}>)=>{
    const intent=ui.review,token=authority()
    if(!intent||!token||ui.sending||ui.phase!=="reviewing"||draftConflict()||draftPending()||!can(intent.action)||
      admitted.binding.kind!=="catalog-command"||
      admitted.binding.operationId!=="domain.command.CAP25."+intent.action||
      admitted.binding.version.kind!=="record"||
      admitted.binding.version.expectedVersion!==intent.version)return
    const controllerDraft=draft()
    if(!controllerDraft||!sourcingDraftDispatchable(controllerDraft.snapshot(),intent.version,intent.action,intent.sourcing)){
      setUi({state:"unavailable",lastError:"unavailable",review:null,phase:"failed"})
      return
    }
    commandController?.abort()
    const controller=new AbortController()
    commandController=controller
    setUi("sending",true)
    const release=()=>{if(commandController===controller){commandController=undefined;setUi("sending",false)}}
    setUi("phase","checking")
    const fresh=await read(token,intent.requestRef,controller.signal)
    if(controller.signal.aborted||commandController!==controller||authority()!==token){release();return}
    // Fresh reads of phase; static narrowing above predates setUi("phase","checking").
    const phaseNow=()=>ui.phase
    if(ui.review!==intent||phaseNow()!=="checking"||ref()!==intent.requestRef){release();return}
    const next=fresh.kind==="ok"?uniqueRequest(fresh.page,intent.requestRef):null
    if(fresh.kind!=="ok"||!next||
      requestRevision(fresh.page,intent.requestRef)!==intent.sourceRevision||
      !fresh.page.value.allowedActionIds.includes(intent.action)||
      (intent.action==="select_quote"&&!quoteIsPersisted(next,intent.quoteId??""))){
      if(fresh.kind==="ok")setUi("page",fresh.page)
      controllerDraft.setPhase("conflict")
      setUi("review",null);setUi("phase","conflict");release();return
    }
    if(draft()!==controllerDraft||
      !sourcingDraftDispatchable(controllerDraft.snapshot(),intent.version,intent.action,intent.sourcing)){
      if(draft()===controllerDraft)controllerDraft.setPhase("conflict")
      setUi("review",null);setUi("phase","conflict");release();return
    }
    // Hash and dispatch the same plain, reviewed payload rather than the Solid store proxy.
    const sourcing=structuredClone(unwrap(intent.sourcing))
    const intentRef=crypto.randomUUID() as SfOperationRef
    const idempotencyKey=crypto.randomUUID()
    const payload=intent.action==="select_quote"?{page:"Requests",action:"select_quote",
      id:intent.requestRef,version:intent.version,values:{quoteId:intent.quoteId}}:
      {page:"Requests",action:intent.action,id:intent.requestRef,
       version:intent.version,values:{sourcing}}
    const payloadJson=JSON.stringify(payload)
    let digest:string
    try{
      const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(payloadJson)))
      digest=Array.from(bytes,(item)=>item.toString(16).padStart(2,"0")).join("")
    }catch{if(commandController===controller&&authority()===token&&ui.review===intent&&phaseNow()==="checking"){setUi("phase","failed");setUi("lastError","unavailable")}release();return}
    if(controller.signal.aborted||commandController!==controller||authority()!==token){release();return}
    const current=page(),row=request(),currentDraft=draft()
    if(ui.review!==intent||phaseNow()!=="checking"||!ui.sending||ui.state!=="ready"||ui.token!==token||ref()!==intent.requestRef||
       !current||!row||row.number!==intent.requestRef||sourceVersion()!==intent.version||
       requestRevision(current,intent.requestRef)!==intent.sourceRevision||!can(intent.action)||JSON.stringify(payload)!==payloadJson||
       (intent.action!=="select_quote"&&JSON.stringify(sourcing)!==JSON.stringify(intent.sourcing))||
       draftConflict()||draftPending()||currentDraft!==controllerDraft||
       !sourcingDraftDispatchable(controllerDraft.snapshot(),intent.version,intent.action,intent.sourcing)||
       (intent.action==="select_quote"&&(ui.quoteChoice!==intent.quoteId||!quoteIsPersisted(row,intent.quoteId??"")||
         JSON.stringify(editableSourcing(row))!==JSON.stringify(intent.sourcing)))){
      if(commandController===controller&&ref()===intent.requestRef&&(ui.review===intent||!ui.review)){
        controllerDraft.setPhase("conflict")
        setUi({review:null,phase:"conflict"})
      }
      release();return
    }
    const pending={operationRef:intentRef,idempotencyKey,payloadDigest:digest,expectedVersion:intent.version}
    controllerDraft.setPending(pending)
    if(!sourcingPendingMatches(controllerDraft.snapshot(),pending)){
      setUi({review:null,phase:"failed",lastError:"unavailable"})
      release();return
    }
    controllerDraft.setPhase("submitting")
    const submitting=controllerDraft.snapshot()
    if(submitting.availability!=="active"||submitting.phase!=="submitting"){
      setUi({review:null,phase:"failed",lastError:"unavailable"})
      release();return
    }
    setUi("phase","submitting")
    try{
      const client=createSfProcurementClient(host.ready()!.transport)
      const options={signal:controller.signal,idempotencyKey}
      const requestBody={page:"Requests" as const,id:intent.requestRef,version:intent.version}
      const response=intent.action==="select_quote"
        ? await client["domain.command.CAP25.select_quote"]({...requestBody,action:"select_quote",
          values:{quoteId:intent.quoteId!}},options)
        : intent.action==="submit_sourcing"
          ? await client["domain.command.CAP25.submit_sourcing"]({...requestBody,action:"submit_sourcing",
             values:{sourcing}},options)
          : await client["domain.command.CAP25.save"]({...requestBody,action:"save",
             values:{sourcing}},options)
      if(controller.signal.aborted||authority()!==token)return
      if(response.kind==="transport-error"){
        controllerDraft.setPhase("outcome-unknown")
        setUi("phase","outcome-unknown");setUi("unknownOperation",intentRef)
        setUi("review",null);return
      }
      if(response.status>=500||(response.body.ok?response.status!==200:response.body.status!==response.status)){
        controllerDraft.setPhase("outcome-unknown")
        setUi("phase","outcome-unknown");setUi("unknownOperation",intentRef)
        setUi("review",null);return
      }
      if(response.status!==200||!response.body.ok){
        const code=response.body.ok?response.status:response.body.status
        const fieldErrors=response.body.ok?[]:response.body.fieldErrors??[]
        setUi("fieldErrors",fieldErrors)
        setUi("sourceWarnings",response.body.ok?[]:fieldErrors.length?fieldErrors.map((error)=>
          error.field+": "+error.message):response.body.errors??[])
        if(response.status===409&&!response.body.ok&&response.body.status===409)controllerDraft.rejectSave({status:409,operation:pending})
        else if(response.status===422&&!response.body.ok&&response.body.status===422)controllerDraft.rejectSave({status:422,operation:pending})
        else controllerDraft.setPhase("failed")
        setUi("review",null)
        setUi("phase",code===409?"conflict":"failed")
        setUi("lastError",code===401?"session-expired":code===403?"denied":code===404?"not-found":
          code===409?"conflict":code===422?"invalid":"unavailable")
        if(code===401||code===403)setUi("page",null)
        return
      }
      setUi("review",null)
      setUi("sourceWarnings",response.body.warnings??[])
      setUi("fieldErrors",[])
      setUi("phase","verifying")
      // The producer returned an explicit success, not a receipt. Close the
      // exact pending draft fence only with that acknowledgement, and use a
      // later authorized projection only when its version actually advanced.
      const confirmedPage=await refresh(token,intent.requestRef)
      if(controller.signal.aborted||authority()!==token)return
      const confirmedRecord=confirmedPage?uniqueRequest(confirmedPage,intent.requestRef):null
      const confirmedVersion=confirmedPage?requestVersion(confirmedPage,intent.requestRef):null
      if(confirmedRecord&&confirmedVersion!==null&&confirmedVersion!==intent.version)
        controllerDraft.confirmSave({kind:"projected",operationRef:intentRef,
          baseVersion:confirmedVersion,value:editableSourcing(confirmedRecord)})
      else controllerDraft.confirmSave({kind:"confirmed-without-projection",
        operationRef:intentRef,resultVersion:confirmedVersion})
      setUi("phase","producer-confirmed")
    }catch{
      if(!controller.signal.aborted&&authority()===token){
        controllerDraft.setPhase("outcome-unknown")
        setUi("phase","outcome-unknown");setUi("unknownOperation",intentRef)
        setUi("review",null)
      }
    }finally{release()}
  }
  const renderCriterion=(kind:"criteria"|"commCriteria",index:number):JSX.Element=>{
    const criterion=edit().weights?.[kind]?.[index]
    if(!criterion)return null
    return <fieldset class="sf-u12-criterion">
      <legend>{t(kind==="criteria"?"sf.u12.criteria":"sf.u12.commCriteria")} {index+1}</legend>
      <label>{t("sf.u12.criteriaName")}<input value={criterion.name??""}
        onInput={(event)=>updateCriterion(kind,index,"name",event.currentTarget.value)}/></label>
      <label>{t("sf.u12.criteriaWeight")}<input type="number" step="any" value={asString(criterion.weight)}
        onInput={(event)=>updateCriterion(kind,index,"weight",event.currentTarget.value)}/></label>
      <label>{t("sf.u12.criteriaAutomatic")}<input type="checkbox" checked={truth(criterion.auto)}
        onChange={(event)=>updateCriterion(kind,index,"auto",event.currentTarget.checked)}/></label>
      <button class="mx-btn" type="button" onClick={()=>removeCriterion(kind,index)}>{t("sf.u12.removeCriterion")}</button>
    </fieldset>
  }
  const quoteEditor=(quote:QuoteEdit,index:number):JSX.Element=>{
    const fields=[
      ["supplier","sf.u12.quoteSupplier"],
      ["currency","sf.u12.quoteCurrency"],
      ["total","sf.u12.quoteTotal"],
      ["qty","sf.u12.quoteQty"],
      ["unitPrice","sf.u12.quotePrice"],
      ["description","sf.u12.quoteDescription"],
      ["notes","sf.u12.quoteNotes"],
    ] as const
    const criteria=edit().weights?.criteria??page()?.value.data.formSettings.criteria??[]
    const commercial=edit().weights?.commCriteria??page()?.value.data.formSettings.commCriteria??[]
    return <fieldset class="sf-u12-quote">
      <legend>{t("sf.u12.quotes")} {index+1} · {quote.id??t("sf.u12.missing")}</legend>
      <div class="sf-u12-fields">
        <For each={fields}>{([name,key])=>{
          const refusal=name==="currency"?ui.fieldErrors.find((error)=>error.field==="sourcing.quotes."+index+".currency"):undefined
          const described=refusal?"sf-u12-currency-"+index:undefined
          return <>
            <label>{t(key)}
              <input type={["total","qty","unitPrice"].includes(name)?"number":"text"}
                step={["total","qty","unitPrice"].includes(name)?"any":undefined}
                value={asString(quote[name])}
                aria-invalid={refusal?"true":undefined}
                aria-describedby={described}
                onInput={(event)=>updateQuote(index,name,name==="total"
                  ? event.currentTarget.value === "" ? null : event.currentTarget.valueAsNumber
                  : event.currentTarget.value)}/>
            </label>
            <Show when={refusal}>
              <span id={described}>{refusal?.message}</span>
            </Show>
          </>
        }}</For>
        <label>{t("sf.u12.quoteSupplierId")}
          <select value={quote.supplierId??""}
            onChange={(event)=>updateQuote(index,"supplierId",event.currentTarget.value||null)}>
            <option value="">{t("sf.u12.missing")}</option>
            <For each={page()?.value.data.suppliers??[]}>{(supplier)=>
              <option value={supplier.id??""} disabled={supplier.status==="inactive"}>{supplier.legalName??supplier.id}</option>
            }</For>
          </select>
        </label>
        <label>{t("sf.u12.quoteTechnical")}<input type="checkbox" checked={truth(quote.techPass)}
          onChange={(event)=>updateQuote(index,"techPass",event.currentTarget.checked)}/></label>
      </div>
      <div class="sf-u12-scores">
        <section><h4>{t("sf.u12.quoteScores")}</h4>
          <For each={criteria}>{(criterion,indexCriterion)=><label>
            {criterion.name??t("sf.u12.criteriaName")}
            <input type="number" min="0" max="5" step="any"
              value={asString(scoreValue(quote.scores,indexCriterion()))}
              disabled={truth(criterion.auto)}
              onInput={(event)=>score(index,"scores",indexCriterion(),event.currentTarget.value)}/>
          </label>}</For>
        </section>
        <section><h4>{t("sf.u12.quoteCommercial")}</h4>
          <For each={commercial}>{(criterion,indexCriterion)=><label>
            {criterion.name??t("sf.u12.criteriaName")}
            <input type="number" min="0" max="5" step="any"
              value={asString(scoreValue(quote.cscores,indexCriterion()))}
              disabled={truth(criterion.auto)}
              onInput={(event)=>score(index,"cscores",indexCriterion(),event.currentTarget.value)}/>
          </label>}</For>
        </section>
      </div>
      <button class="mx-btn" type="button" onClick={()=>removeQuote(index)}>{t("sf.u12.removeQuote")}</button>
    </fieldset>
  }

  const conflictPanel=():JSX.Element=><section class="sf-u12-editor" data-draft-conflict="sourcing">
    <p role="alert">{t("sf.u12.conflict")}</p>
    <button class="mx-btn" type="button" disabled={draftPending()||active(ui.phase)||ui.sending}
      onClick={()=>{
        const ready=host.ready(),token=authority(),row=request()
        if(!ready||!token||!row?.number||active(ui.phase)||ui.sending)return
        const selection={surfaceId:"CAP25" as const,identity:{kind:"record" as const,recordRef:row.number as SfRef},
          editScopeKey:"CAP25:sourcing" as SfEditScopeKey}
        const state=ready.drafts.peek(selection)?.snapshot()
        if(state&&(state.availability!=="active"||state.pendingOperation))return
        ready.drafts.discard(selection)
        if(ready.drafts.peek(selection))return
        setUi({page:null,state:"loading",review:null,phase:"idle"})
        void refresh(token,row.number)
      }}>{language.t("sf.common.discard")}</button>
  </section>
  const editor=():JSX.Element=>{
    if(ui.phase==="conflict")return conflictPanel()
    const state=snapshot()
    if(state?.availability!=="active")
      return <SfStatePanel state="unavailable" messageKey={k("sf.u12.readOnly")}/>
    if(draftPending())return <SfStatePanel state="outcome-unknown" messageKey={k("sf.u12.unknown")}/>
    if(draftConflict())return conflictPanel()
    const current=edit()
    const keyFields=[
      ["evaluator","sf.u12.evaluator"],["fewQuotesJustification","sf.u12.fewQuotesJustification"],
      ["selectionJustification","sf.u12.selectionJustification"],["contractStrategy","sf.u12.contractStrategy"],
    ] as const
    return <section class="sf-u12-editor">
      <h3>{t("sf.u12.sourcing")}</h3>
      <div class="sf-u12-fields">
        <For each={keyFields}>{([name,key])=><label>{t(key)}
          <textarea value={current[name]??""}
            onInput={(event)=>changeField(name,event.currentTarget.value)} />
        </label>}</For>
      </div>
      <div class="sf-u12-weights">
        <label>{t("sf.u12.technicalWeight")}
          <input type="number" step="any" value={asString(current.weights?.tech??page()?.value.data.formSettings.techWeight)}
            onInput={(event)=>updateWeight("tech",event.currentTarget.value)} />
        </label>
        <label>{t("sf.u12.commercialWeight")}
          <input type="number" step="any" value={asString(current.weights?.comm??page()?.value.data.formSettings.commWeight)}
            onInput={(event)=>updateWeight("comm",event.currentTarget.value)} />
        </label>
      </div>
      <For each={["criteria","commCriteria"] as const}>{(kind)=>
        <section class="sf-u12-criteria"><h4>{t(kind==="criteria"?"sf.u12.criteria":"sf.u12.commCriteria")}</h4>
          <For each={current.weights?.[kind]??[]}>{(_,index)=>renderCriterion(kind,index())}</For>
          <button class="mx-btn" type="button" onClick={()=>addCriterion(kind)}>{t("sf.u12.addCriterion")}</button>
        </section>
      }</For>
      <section class="sf-u12-quotes" aria-label={t("sf.u12.quotes")}>
        <h4>{t("sf.u12.quotes")}</h4>
        <For each={current.quotes??[]}>{(quote,index)=>quoteEditor(quote,index())}</For>
        <button class="mx-btn" type="button" onClick={addQuote}>{t("sf.u12.addQuote")}</button>
      </section>
      <p>{t("sf.u12.noBrowserCalculation")}</p>
      <div class="sf-u12-actions">
        <button class="mx-btn-primary" type="button" disabled={!state.dirty||!!state.conflict||active(ui.phase)||!can("save")}
          onClick={()=>begin("save")}>{t("sf.u12.save")}</button>
        <button class="mx-btn" type="button" disabled={!!state.conflict||active(ui.phase)||!can("submit_sourcing")}
          onClick={()=>begin("submit_sourcing")}>{t("sf.u12.submit")}</button>
      </div>
      <Show when={state.conflict}><p role="alert">{t("sf.u12.conflict")}</p></Show>
    </section>
  }
  const comparison=():JSX.Element=>{
    if(ui.phase==="conflict")return conflictPanel()
    if(draftPending())return <SfStatePanel state="outcome-unknown" messageKey={k("sf.u12.unknown")}/>
    if(draftConflict())return conflictPanel()
    const row=request()
    if(!row)return <SfStatePanel state="not-found" messageKey={k("sf.u12.notFound")}/>
    const recorded=row.sourcing?.quotes??[]
    const fx=recordedFx(row)
    const facts=row.sourcing?.comparison??null
    const limited=!!facts&&facts.eligibleCount<2
    const fxRow=(quote:QuoteEdit)=>{
      const id=quote.id
      if(!id||!facts)return null
      const matches=facts.quotes.filter((item)=>item.id===id)
      return matches.length===1?matches[0]!:null
    }
    const scoreCopy=(quote:QuoteEdit,kind:"scores"|"cscores")=>
      quote[kind]===undefined?"—":Array.isArray(quote[kind])
        ? quote[kind].map((x)=>asString(x)).join(", ")
        : JSON.stringify(quote[kind])
    return <section class="sf-u12-comparison">
      <h3>{t("sf.u12.compare")}</h3>
      <p>{t("sf.u12.sourceOnly")}</p>
      <div class="sf-u12-filters">
        <label>{t("sf.u12.quotes")}
          <input type="search" value={ui.search} onInput={(event)=>setUi("search",event.currentTarget.value)}/>
        </label>
        <label>{t("sf.u12.stage")}
          <select value={ui.sort} onChange={(event)=>setUi("sort",event.currentTarget.value as typeof ui.sort)}>
            <option value="source">{t("sf.u12.quotes")}</option>
            <option value="supplier">{t("sf.u12.quoteSupplier")}</option>
            <option value="currency">{t("sf.u12.quoteCurrency")}</option>
          </select>
        </label>
      </div>
      <SfDataTable<QuoteEdit>
        rows={quotes()}
        getRowKey={(quote)=>(quote.id??"") as SfRef}
        columns={[
          {id:"supplier",labelKey:k("sf.u12.quoteSupplier"),align:"start",widthPolicy:{kind:"flex",minPx:120,weight:2},render:(quote)=><>{quote.supplier??""}</>},
          {id:"eligibility",labelKey:k("sf.u12.eligibility"),align:"start",widthPolicy:{kind:"content",minPx:120,maxPx:240},render:(quote)=><>{fxRow(quote)?.eligibility??""}</>},
          {id:"currency",labelKey:k("sf.u12.quoteCurrency"),align:"start",widthPolicy:{kind:"content",minPx:60,maxPx:120},render:(quote)=><>{quote.currency??""}</>},
          {id:"total",labelKey:k("sf.u12.quoteTotal"),align:"end",widthPolicy:{kind:"content",minPx:100,maxPx:170},render:(quote)=><>{asString(quote.total)||t("sf.u12.missing")}</>},
          {id:"baseFx",labelKey:k("sf.u12.baseFx"),align:"end",widthPolicy:{kind:"content",minPx:220,maxPx:360},render:(quote)=><>{fxRow(quote)?.baseFxText??t("sf.u12.missing")}</>},
          {id:"technical",labelKey:k("sf.u12.technical"),align:"end",widthPolicy:{kind:"content",minPx:72,maxPx:120},render:(quote)=><>{fxRow(quote)?.technicalText??""}</>},
          {id:"price",labelKey:k("sf.u12.price"),align:"end",widthPolicy:{kind:"content",minPx:72,maxPx:120},render:(quote)=><>{fxRow(quote)?.priceText??""}</>},
          {id:"commercial",labelKey:k("sf.u12.commercial"),align:"end",widthPolicy:{kind:"content",minPx:88,maxPx:140},render:(quote)=><>{fxRow(quote)?.commercialText??""}</>},
          {id:"overall",labelKey:k("sf.u12.overall"),align:"end",widthPolicy:{kind:"content",minPx:72,maxPx:120},render:(quote)=><>{fxRow(quote)?.overallText??""}</>},
          {id:"rank",labelKey:k("sf.u12.rank"),align:"end",widthPolicy:{kind:"content",minPx:56,maxPx:88},render:(quote)=>{
            const rank=fxRow(quote)?.rank
            return <>{typeof rank==="number"?String(rank):""}</>
          }},
          {id:"excluded",labelKey:k("sf.u12.excludedReason"),align:"start",widthPolicy:{kind:"content",minPx:140,maxPx:360},render:(quote)=>{
            const reason=fxRow(quote)?.excludedReason
            return <>{typeof reason==="string"?reason:""}</>
          }},
          {id:"qty",labelKey:k("sf.u12.quoteQty"),align:"end",widthPolicy:{kind:"content",minPx:85,maxPx:140},render:(quote)=><>{asString(quote.qty)||t("sf.u12.missing")}</>},
          {id:"unitPrice",labelKey:k("sf.u12.quotePrice"),align:"end",widthPolicy:{kind:"content",minPx:100,maxPx:160},render:(quote)=><>{asString(quote.unitPrice)||t("sf.u12.missing")}</>},
          {id:"scores",labelKey:k("sf.u12.quoteScores"),align:"start",widthPolicy:{kind:"content",minPx:120,maxPx:260},render:(quote)=><>{scoreCopy(quote,"scores")}</>},
          {id:"cscores",labelKey:k("sf.u12.quoteCommercial"),align:"start",widthPolicy:{kind:"content",minPx:120,maxPx:260},render:(quote)=><>{scoreCopy(quote,"cscores")}</>},
        ]}
        sort={{kind:"none"}} page={{kind:"none",total:quotes().length}}
        onSort={()=>{}} onPage={()=>{}}
        onSelect={(key)=>setUi("quoteChoice",key)}
        selectedKey={ui.quoteChoice as SfRef}
        rowActions={()=>[]}
        onRowAction={()=>{}}
        captionKey={k("sf.u12.quotes")} density="comfortable"
        state={recorded.length===0?"empty":quotes().length===0?"filtered-empty":"ready"}
      />
      <Show when={facts?.rankLine}>{(line)=><p role="status">{line()}</p>}</Show>
      <Show when={facts?.premiumLine}>{(line)=><p role="status">{line()}</p>}</Show>
      <Show when={facts?.rankingUnavailable}>{(line)=><p role="status">{line()}</p>}</Show>
      <Show when={!facts}>
        <p role="status">{t("sf.u12.rankUnavailable")}</p>
        <p>{t("sf.u12.fxUnavailable")}</p>
      </Show>
      <Show when={!!facts&&!limited&&!facts.rankLine}><p role="status">{t("sf.u12.rankUnavailable")}</p></Show>
      <Show when={fx}><dl>{Object.entries(fx??{}).map(([currency,rate])=>
        <div><dt>{currency}</dt><dd>{rate===null?t("sf.u12.missing"):asString(rate)}</dd></div>)}</dl></Show>
      <p>{t("sf.u12.selectedSaved")}</p>
      <p>{t("sf.u12.noManualApproval")}</p>
      <label>{t("sf.u12.selectId")}
        <select value={ui.quoteChoice} onChange={(event)=>setUi("quoteChoice",event.currentTarget.value)}>
          <option value="">{t("sf.u12.noSelection")}</option>
          <For each={recorded.filter((quote)=>quote.id)}>{(quote)=>
            <option value={quote.id}>{quote.supplier??quote.id} · {quote.currency??""} {asString(quote.total)}</option>
          }</For>
        </select>
      </label>
      <button class="mx-btn-primary" type="button"
        disabled={!can("select_quote")||!ui.quoteChoice||!quoteIsPersisted(row,ui.quoteChoice)||active(ui.phase)}
        onClick={()=>begin("select_quote")}>{t("sf.u12.select")}</button>
    </section>
  }
  return <SfPageFrame
    titleKey={k("sf.cap25.title")}
    subtitleKey={k("sf.u12.title")}
    context={[]} tabs={[]} activeTab={null}
    density="comfortable" layout={ui.layoutMode==="single"?"reading":"split"}
    onLayoutMode={(layout)=>setUi("layoutMode",layout)}
    secondaryActions={[{id:"refresh",labelKey:k("sf.u12.refresh"),tone:"secondary",disabled:active(ui.phase),busy:false,
      onInvoke:()=>{const token=authority();if(token)void refresh(token,ref()??undefined)}}]}
  >
    <div class="sf-u12-root">
      <For each={ui.sourceWarnings}>{(message)=><p role="alert">{message}</p>}</For>
      <Show when={state()==="ready"||state()==="empty"||state()==="filtered-empty"||state()==="outcome-unknown"}
        fallback={<SfStatePanel state={state()} messageKey={k(message())}
          onRetryRead={()=>{const token=authority();if(token)void refresh(token,ref()??undefined)}}/>}>
        <Show when={ui.phase==="outcome-unknown"||draftPending()}>
          <p role="alert">{t("sf.u12.unknown")}</p>
          <button class="mx-btn" type="button" onClick={()=>{
            const token=authority();if(token)void refresh(token,ref()??undefined)
          }}>{t("sf.u12.refresh")}</button>
        </Show>
        <Show when={ui.phase==="producer-confirmed"}><p role="status">{t("sf.u12.confirmed")}</p></Show>
        <Show when={ui.phase==="failed"}><p role="alert">{t("sf.u12.failed")}</p></Show>
        <Show when={ui.phase!=="outcome-unknown"&&!draftPending()}>
        <Show when={!ref()}>
          <section><h3>{t("sf.u12.request")}</h3>
            <ul><For each={requestRows()}>{(row)=>
              <li><button type="button" class="mx-btn" onClick={()=>setUi("selected",row.number??null)}>
                {row.number??t("sf.u12.missing")} · {row.pr?.title??""} · {row.status}
              </button></li>
            }</For></ul>
          </section>
        </Show>
        <Show when={request()}>
          <header class="sf-u12-heading">
            <h2>{request()?.pr?.title??t("sf.u12.requestTitle")}</h2>
            <p data-sf-sourcing-stage>{t("sf.u12.stage")}: {request()?.status} · {t("sf.u12.version")}: {sourceVersion()??t("sf.u12.missing")}</p>
            <Show when={request()?.requestSummary}>
              <p data-request-summary={request()?.number}>{request()?.requestSummary}</p>
            </Show>
            <Show when={request()?.moneySentence}>
              <p data-request-money={request()?.number}>{request()?.moneySentence}</p>
            </Show>
          </header>
          <Show when={request()?.status==="sourcing"||request()?.po}>
            <section>
              <Show when={request()?.po}>
                <fieldset disabled>
                  <label>{t("sf.u12.quoteSupplier")}
                    <input type="text" value={request()?.po?.supplier??""} disabled/>
                  </label>
                  <label>{t("sf.u12.quoteCurrency")}
                    <input type="text" value={request()?.po?.currency??""} disabled/>
                  </label>
                  <label>{t("sf.u12.quotePrice")}
                    <input type="number" step="any" value={asString(request()?.po?.lines?.[0]?.unitPrice)} disabled/>
                  </label>
                </fieldset>
              </Show>
              <Show when={request()?.poEstimate}><p role="status">{request()?.poEstimate}</p></Show>
              <Show when={request()?.orderDifference}><p role="status">{request()?.orderDifference}</p></Show>
              <Show when={request()?.status==="sourcing"||request()?.status==="src_pending"}>
                <button type="button" disabled={!poSubmitOpen()}>{language.t("sf.u11.remaining.submitPo")}</button>
              </Show>
            </section>
          </Show>
          <div class="sf-u12-switch">
            <button type="button" aria-pressed={ui.stage==="sourcing"} class="mx-btn"
              onClick={()=>setUi("stage","sourcing")}>{t("sf.u12.sourcing")}</button>
            <button type="button" aria-pressed={ui.stage==="quotes"} class="mx-btn"
              onClick={()=>setUi("stage","quotes")}>{t("sf.u12.compare")}</button>
          </div>
          <Show when={!ui.review} fallback={<SfChangeReview
            operation={{ref:(ui.review?.intentRef??"CAP25:unknown") as SfOperationRef,
              label:m("sf.u12.review"),scope:data(ui.review?.requestRef??"")}}
            base={ui.review?reviewSnapshot(ui.review):null}
            current={ui.review?reviewSnapshot(ui.review):null}
            proposed={ui.review?proposed(ui.review):{kind:"not-provided",reason:m("sf.u12.unavailable")}}
            effects={[{id:"sourcing",domain:"procurement",title:data(ui.review?.action??""),
              state:"proposed",details:[]}]}
            coverage={{state:"partial",summary:m("sf.u12.coverage"),
              reasons:[m("sf.u12.rankUnavailable")],knownCount:null,expectedCount:null}}
            blockingReasons={[]}
            confirmation={confirmation()}
            state={ui.phase==="conflict"?"conflict":"ready"}
            onConfirm={(review)=>void confirm(review as Extract<ReturnType<typeof confirmation>,{kind:"admitted"}>)}
            onRevise={()=>{setUi("review",null);setUi("phase","idle")}}
            onCancel={()=>{setUi("review",null);setUi("phase","idle")}}
          />}>
            <Show when={ui.stage==="quotes"} fallback={editor()}>{comparison()}</Show>
             <Show when={!can("save")}><p role="status" aria-label={t("sf.u12.notEditable")}>{t("sf.u12.notEditable")}</p></Show>
          </Show>
        </Show>
        </Show>
      </Show>
    </div>
  </SfPageFrame>
}
