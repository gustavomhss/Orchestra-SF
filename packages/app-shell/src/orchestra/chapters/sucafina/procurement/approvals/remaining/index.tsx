import { createEffect, createMemo, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { useSfContext } from "../../../context"
import type { SfEditScopeKey, SfSurfaceProps } from "../../../context/contracts"
import type { SfIntentRef, SfOperationRef, SfRef } from "@orchestra/schema/sucafina/context"
import { SfPageFrame } from "../../../shared/frame"
import { SfStatePanel } from "../../../shared/states"
import { SfDataTable } from "../../../shared/table"
import { SfChangeReview } from "../../../shared/change-review"
import { SfReceiptView } from "../../../shared/receipt"
import type { SfReviewSnapshot, SfReviewField } from "../../../shared/change-review"
import type { SfCopyKey, SfMessage, SfText, SfUiState } from "../../../shared/frame"
import type { SfSort } from "../../../shared/table"
import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import type { SfU13RemainingCopyKey } from "@/i18n/orchestra-chapters/sf-u13"
import {
  findPendingApproval, sameApproval, sourceChangedAfterUnknown,
  type ApprovalDecision, type ApprovalGroup, type ApprovalRequest,
  type Cap26PageOk, type PendingApproval,
} from "./model"
import "./remaining.css"

type Read =
  | Readonly<{kind:"ok";page:Cap26PageOk}>
  | Readonly<{kind:"unavailable"|"denied"|"session-expired"|"stale"|"not-found"|"invalid"}>
type Draft = Readonly<{ comment:string;reason:string;commandStarted:boolean }>
type Review = Readonly<{
  source:PendingApproval
  decision:ApprovalDecision
  intentRef:SfIntentRef
  note:string
  token:string
}>
type Phase = "idle" | "reviewing" | "checking" | "submitting" | "verifying" |
  "outcome-unknown" | "source-changed" | "producer-confirmed" | "conflict" | "failed"
const k=(value:SfU13RemainingCopyKey)=>value as SfCopyKey
const m=(value:SfU13RemainingCopyKey):SfMessage=>({key:k(value)})
const d=(text:string):SfText=>({kind:"data",text})
const fv=(item:unknown)=>item===null||item===undefined||item===""
  ?{kind:"unavailable" as const,reason:m("sf.u13.remaining.missing")}
  :{kind:"text" as const,text:d(String(item))}
const phaseIsBusy=(phase:Phase)=>["reviewing","checking","submitting","verifying","outcome-unknown","source-changed"].includes(phase)
const emptyDraft:Draft={comment:"",reason:"",commandStarted:false}

export function SfRemainingApprovalsView(props:SfSurfaceProps<"CAP26">):JSX.Element {
  const host=useSfContext()
  const language=useLanguage()
  const t=(key:SfU13RemainingCopyKey)=>language.t(k(key) as Parameters<typeof language.t>[0])
  const [ui,setUi]=createStore<{
    token:string|null
    state:SfUiState
    page:Cap26PageOk|null
    selected:string|null
    group:ApprovalGroup|"all"
    search:string
    sort:SfSort
    layoutMode:"single"|"split"|"split-context"
    review:Review|null
    phase:Phase
    failure:SfUiState|null
    unknownOperation:SfOperationRef|null
    unknownBefore:PendingApproval|null
    changedAfterUnknown:boolean
  }>({
    token:null,state:"loading",page:null,selected:null,group:"all",search:"",
    sort:{kind:"none"},layoutMode:"split",review:null,phase:"idle",failure:null,
    unknownOperation:null,unknownBefore:null,changedAfterUnknown:false,
  })
  let readController:AbortController|undefined
  let commandController:AbortController|undefined
  let readSequence=0
  let sending=false
  const authority=()=>{
    const state=host.state(),ready=host.ready()
    if(state.status!=="ready"||!ready)return null
    const routeOwner=props.route.ownerSelection
    if(state.selection.serverKey!==routeOwner.serverKey||
       state.selection.projectId!==routeOwner.projectId||
       state.selection.installationId!==routeOwner.installationId)return null
    return JSON.stringify([state.ownerKey,host.generation(),state.owner.authEpoch,
      state.context.stamp,props.route.href])
  }
  const routeRef=()=>props.route.kind==="entry"?null:props.route.params.requestRef
  const ref=()=>routeRef()??ui.selected
  const page=()=>ui.token===authority()&&authority()!==null?ui.page:null
  const selected=createMemo(()=>{
    const current=page(),requestRef=ref()
    return current&&requestRef?findPendingApproval(current,requestRef):null
  })
  const approval=()=>selected()?.kind==="submitted"?selected() as PendingApproval:null
  const available=(decision:ApprovalDecision)=>{
    const current=page(),ready=host.ready(),source=approval()
    return !!current&&!!ready&&!!source&&source.actions.includes(decision)&&
      current.value.allowedActionIds.includes(decision)&&
      ready.context.availability.some((entry)=>entry.family==="procurement"&&entry.resource==="CAP26"&&
        entry.operations.some((operation)=>operation.operationId==="domain.command.CAP26."+decision&&
          operation.state==="ready"&&operation.operational))
  }
  const read=async(token:string,requestRef:string|undefined,signal:AbortSignal):Promise<Read>=>{
    const ready=host.ready()
    if(!ready||authority()!==token)return {kind:"unavailable"}
    try{
      const response=await createSfProcurementClient(ready.transport)["domain.page.CAP26"](
        requestRef?{request:requestRef}:{},{signal})
      if(signal.aborted||authority()!==token)return {kind:"unavailable"}
      if(response.kind==="transport-error")return {kind:"unavailable"}
      if(response.status===401||response.body.status==="unauthenticated")return {kind:"session-expired"}
      if(response.status===403||response.body.status==="denied")return {kind:"denied"}
      if(response.status===404)return {kind:"not-found"}
      if(response.status===409||response.body.status==="stale")return {kind:"stale"}
      if(response.status!==200||response.body.status!=="ok")return {kind:"unavailable"}
      const page=response.body
      if(page.value.capabilityId!=="CAP26"||
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
    if(controller.signal.aborted||authority()!==token||sequence!==readSequence)return null
    if(result.kind!=="ok"){
      if(["denied","session-expired","invalid"].includes(result.kind)){
        setUi("page",null)
        setUi("review",null)
      }
      setUi("state",result.kind)
      return null
    }
    setUi("page",result.page)
    setUi("state","ready")
    if(ui.unknownBefore&&sourceChangedAfterUnknown(ui.unknownBefore,result.page))
      setUi("changedAfterUnknown",true)
    return result.page
  }
  createEffect(()=>{
    const token=authority(),currentRef=routeRef()
    readController?.abort()
    commandController?.abort()
    sending=false
    setUi({token,page:null,state:token?"loading":"session-expired",selected:currentRef,
      group:"all",search:"",sort:{kind:"none"},review:null,phase:"idle",failure:null,
      unknownOperation:null,unknownBefore:null,changedAfterUnknown:false})
    if(token)void refresh(token,currentRef??undefined)
    onCleanup(()=>{readController?.abort();commandController?.abort()})
  })
  const decisionDraft=createMemo(()=>{
    const ready=host.ready(),source=approval()
    if(!ready||!source||!authority()||source.actions.length===0)return null
    return ready.drafts.acquire<Draft>({
      surfaceId:"CAP26",identity:{kind:"record",recordRef:source.requestRef as SfRef},
      editScopeKey:"CAP26:remaining-decision" as SfEditScopeKey,
      baseVersion:source.version,base:emptyDraft,value:emptyDraft,
      revalidation:{operationId:"domain.page.CAP26",input:{request:source.requestRef},
        fieldPaths:["status","createdBy",source.stage==="sourcing"?"sourcing":"po"],
        actionIds:source.actions},
    })
  })
  createEffect(()=>{
    const source=approval(),controller=decisionDraft()
    if(!source||!controller)return
    const state=controller.snapshot()
    if(state.availability==="active"&&state.baseVersion!==source.version)
      controller.receiveRemote({baseVersion:source.version,value:emptyDraft})
  })
  const draftState=()=>decisionDraft()?.snapshot()
  const draftValue=():Draft=>{
    const state=draftState()
    return state?.availability==="active"?state.value:emptyDraft
  }
  const setNote=(field:"comment"|"reason",text:string)=>{
    const controller=decisionDraft(),state=controller?.snapshot()
    if(!controller||state?.availability!=="active"||phaseIsBusy(ui.phase))return
    controller.edit({...state.value,[field]:text})
  }
  const queued=()=>{
    const current=page()
    if(!current)return []
    const pool=current.value.data.requests
      .filter((item)=>item.status==="src_pending"||item.status==="po_pending")
      .flatMap((request)=>{
        const projection=findPendingApproval(current,request.number??"")
        return projection.kind==="submitted"?[projection]:[]
      })
    const query=ui.search.trim().toLocaleLowerCase()
    const filtered=pool.filter((item)=>(ui.group==="all"||item.group===ui.group)&&
      (!query||[item.requestRef,item.request.pr?.title,item.holderName]
        .some((v)=>v?.toLocaleLowerCase().includes(query))))
    if(ui.sort.kind!=="field")return filtered
    const field=ui.sort.key
    const ordered=[...filtered].sort((a,b)=>
      String(field==="request"?a.requestRef:field==="holder"?a.holderName??"":a.stage).localeCompare(
        String(field==="request"?b.requestRef:field==="holder"?b.holderName??"":b.stage)))
    return ui.sort.direction==="desc"?ordered.reverse():ordered
  }
  const currentState=():SfUiState=>{
    if(!authority()||ui.token!==authority()){
      const status=host.state().status
      return status==="denied"?"denied":
        status==="resolving"?"loading":
        status==="context-mismatch"?"invalid":
        status==="unavailable"||status==="choose-installation"?"unavailable":"session-expired"
    }
    if(ui.state!=="ready")return ui.state
    if(ui.phase==="outcome-unknown"||ui.phase==="source-changed")return "outcome-unknown"
    if(ui.phase==="conflict")return "conflict"
    if(ui.phase==="failed"){
      const pending=decisionDraft()?.snapshot()
      return ui.failure==="denied"||ui.failure==="session-expired"||ui.failure==="not-found"||
        !!(pending?.availability==="active"&&pending.pendingOperation) ?ui.failure??"unavailable":"ready"
    }
    if(ref()&&selected()?.kind==="not-found")return "not-found"
    if(ref()&&selected()?.kind==="not-pending")return "invalid"
    if(ref()&&selected()?.kind==="source-unavailable")return "invalid"
    if(!ref()&&page()?.value.data.requests.filter((item)=>
      item.status==="src_pending"||item.status==="po_pending").length===0)return "empty"
    if(!ref()&&queued().length===0)return "filtered-empty"
    return "ready"
  }
  const stateKey=():SfU13RemainingCopyKey=>({
    loading:"sf.u13.remaining.loading",unavailable:"sf.u13.remaining.unavailable",
    denied:"sf.u13.remaining.denied","session-expired":"sf.u13.remaining.expired",
    "not-found":"sf.u13.remaining.notFound",invalid:"sf.u13.remaining.invalid",
    empty:"sf.u13.remaining.empty","filtered-empty":"sf.u13.remaining.filtered",
    stale:"sf.u13.remaining.conflict",conflict:"sf.u13.remaining.conflict",
    "outcome-unknown":"sf.u13.remaining.unknown",
  } as Partial<Record<SfUiState,SfU13RemainingCopyKey>>)[currentState()]??"sf.u13.remaining.unavailable"
  const begin=(decision:ApprovalDecision)=>{
    const source=approval(),token=authority(),state=draftState(),controller=decisionDraft()
    if(!source||!token||!available(decision)||sending||phaseIsBusy(ui.phase)||
       ui.review||!controller||state?.availability!=="active"||
       !!state.conflict||!!state.pendingOperation||state.value.commandStarted)return
    const note=decision==="reject"?state.value.reason.trim():state.value.comment.trim()
    if(decision==="reject"&&!note){setUi("failure","invalid");return}
    controller.setPhase("reviewing")
    setUi("review",{source,decision,intentRef:crypto.randomUUID() as SfIntentRef,note,token})
    setUi("phase","reviewing")
    setUi("failure",null)
  }
  const reviewFields=(source:PendingApproval):SfReviewField[]=>{
    const request=source.request
    return [
      {path:"status",label:m("sf.u13.remaining.stage"),value:fv(request.status)},
      {path:"requestRef",label:m("sf.u13.remaining.ref"),value:fv(source.requestRef)},
      {path:"holder",label:m("sf.u13.remaining.owner"),value:fv(source.holderName??source.holderId)},
      {path:"submittedAmount",label:m("sf.u13.remaining.amount"),
        value:{kind:"number",value:source.amount,unit:source.baseCurrency
          ?{kind:"currency",code:source.baseCurrency}
          :{kind:"unspecified",label:m("sf.u13.remaining.currency")},fractionDigits:2}},
      {path:"submittedBaseCurrency",label:m("sf.u13.remaining.currency"),value:fv(source.baseCurrency)},
      {path:"sourceReason",label:m("sf.u13.remaining.conditions"),
        value:fv(source.stage==="sourcing"?request.sourcing?.selectionJustification:
          request.po?.description)},
    ]
  }
  const snapshot=(source:PendingApproval):SfReviewSnapshot=>({
    kind:"persisted",ref:source.requestRef as SfRef,version:source.version,
    fields:reviewFields(source),
  })
  const proposed=(review:Review):SfReviewSnapshot=>({
    kind:"draft",intentRef:review.intentRef,sourceRef:review.source.requestRef as SfRef,
    sourceVersion:review.source.version,
    fields:[
      {path:"decision",label:m("sf.u13.remaining.submitted"),value:fv(review.decision)},
      {path:"reason",label:m(review.decision==="reject"?"sf.u13.remaining.reason":"sf.u13.remaining.comment"),
        value:fv(review.note)},
    ],
  })
  const confirmation=()=>{
    const intent=ui.review
    if(!intent||intent.token!==authority()||!available(intent.decision))
      return {kind:"blocked",labelKey:k("sf.u13.remaining.readOnly"),
        reasons:[m("sf.u13.remaining.readOnly")]} as const
    return {
      kind:"admitted",labelKey:k("sf.u13.remaining.confirm"),purpose:intent.decision,
      binding:{kind:"catalog-command",
        operationId:intent.decision==="approve"?"domain.command.CAP26.approve" as const:
          "domain.command.CAP26.reject" as const,
        version:{kind:"record",expectedVersion:intent.source.version},
        confirmation:"presentation-only"},
    } as const
  }
  const confirm=async(admitted:Extract<ReturnType<typeof confirmation>,{kind:"admitted"}>)=>{
    const intent=ui.review,token=authority()
    if(!intent||!token||sending||ui.phase!=="reviewing"||!available(intent.decision)||
      admitted.purpose!==intent.decision||
      admitted.binding.kind!=="catalog-command"||
      admitted.binding.operationId!=="domain.command.CAP26."+intent.decision||
      admitted.binding.version.kind!=="record"||
      admitted.binding.version.expectedVersion!==intent.source.version)return
    sending=true
    commandController?.abort()
    const controller=new AbortController()
    commandController=controller
    setUi("phase","checking")
    const fresh=await read(token,intent.source.requestRef,controller.signal)
    if(controller.signal.aborted||authority()!==token){sending=false;return}
    const current=fresh.kind==="ok"?findPendingApproval(fresh.page,intent.source.requestRef):null
    if(fresh.kind!=="ok"||!current||!sameApproval(intent.source,current)||
       !current.actions.includes(intent.decision)){
      setUi("review",null);setUi("phase","conflict");sending=false;return
    }
    const currentDraft=decisionDraft(),state=currentDraft?.snapshot()
    if(!currentDraft||state?.availability!=="active"||state.conflict||
       !!state.pendingOperation||state.value.commandStarted||
       state.baseVersion!==intent.source.version||
       (intent.decision==="reject"?state.value.reason.trim():state.value.comment.trim())!==intent.note){
      setUi("review",null);setUi("phase","conflict");sending=false;return
    }
    const operationRef=crypto.randomUUID() as SfOperationRef
    const idempotencyKey=crypto.randomUUID()
    const requestBody={page:"My approvals" as const,action:intent.decision,
      id:intent.source.requestRef,version:intent.source.version,
      values:intent.decision==="reject"?{reason:intent.note}:
        intent.note?{comment:intent.note}:{}}
    let payloadDigest:string
    try{
      const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",
        new TextEncoder().encode(JSON.stringify(requestBody))))
      payloadDigest=Array.from(bytes,(item)=>item.toString(16).padStart(2,"0")).join("")
    }catch{setUi("phase","failed");setUi("failure","unavailable");sending=false;return}
    if(controller.signal.aborted||authority()!==token){sending=false;return}
    // Persist the local sending fence BEFORE executing one producer command.
    currentDraft.edit({...state.value,commandStarted:true})
    currentDraft.setPending({operationRef,idempotencyKey,payloadDigest,
      expectedVersion:intent.source.version})
    currentDraft.setPhase("submitting")
    setUi("phase","submitting")
    try{
      const client=createSfProcurementClient(host.ready()!.transport)
      const options={signal:controller.signal,idempotencyKey}
      const record={page:"My approvals" as const,id:intent.source.requestRef,
        version:intent.source.version}
      const result=intent.decision==="approve"
        ?await client["domain.command.CAP26.approve"]({...record,action:"approve",
          values:intent.note?{comment:intent.note}:{}},options)
        :await client["domain.command.CAP26.reject"]({...record,action:"reject",
          values:{reason:intent.note}},options)
      if(controller.signal.aborted||authority()!==token)return
      if(result.kind==="transport-error"){
        currentDraft.setPhase("outcome-unknown")
        setUi("phase","outcome-unknown")
        setUi("unknownOperation",operationRef)
        setUi("unknownBefore",intent.source)
        setUi("review",null)
        return
      }
      if(result.status!==200||!result.body.ok){
        const status=result.body.ok?result.status:result.body.status
        currentDraft.setPhase(status===409?"conflict":"failed")
        setUi("review",null)
        setUi("phase",status===409?"conflict":"failed")
        setUi("failure",status===401?"session-expired":status===403?"denied":
          status===404?"not-found":status===409?"conflict":"invalid")
        if(status===401||status===403)setUi("page",null)
        return
      }
      // Only the original explicit 200/ok response confirms this command;
      // neither a queue move nor a changed amount is a synthetic receipt.
      currentDraft.confirmSave({kind:"confirmed-without-projection",
        operationRef,resultVersion:null})
      host.ready()?.drafts.discard({
        surfaceId:"CAP26",
        identity:{kind:"record",recordRef:intent.source.requestRef as SfRef},
        editScopeKey:"CAP26:remaining-decision" as SfEditScopeKey,
      })
      setUi("review",null)
      setUi("phase","verifying")
      // A later approval level must be loaded under a fresh current holder,
      // version and server-side action admission, not the old decision draft.
      await refresh(token,intent.source.requestRef)
      if(authority()===token)setUi("phase","producer-confirmed")
    }catch{
      if(!controller.signal.aborted&&authority()===token){
        currentDraft.setPhase("outcome-unknown")
        setUi("phase","outcome-unknown")
        setUi("unknownOperation",operationRef)
        setUi("unknownBefore",intent.source)
        setUi("review",null)
      }
    }finally{sending=false}
  }
  const detail=():JSX.Element=>{
    const source=approval()
    if(!source)return <SfStatePanel state="invalid" messageKey={k("sf.u13.remaining.notPending")}/>
    const record=source.request
    const draft=draftState()
    const conflict=draft?.availability==="active"?draft.conflict:null
    return <section class="sf-u13-remaining-detail">
      <h2>{record.pr?.title??source.requestRef}</h2>
      <p>{t("sf.u13.remaining.stage")}: {t(source.stage==="sourcing"?"sf.u13.remaining.sourcing":"sf.u13.remaining.po")} ·
        {t("sf.u13.remaining.version")}: {source.version}</p>
      <dl class="sf-u13-remaining-facts">
        <For each={reviewFields(source)}>{(field)=>
          <div><dt>{language.t(field.label.key as Parameters<typeof language.t>[0])}</dt>
            <dd>{field.value.kind==="number"?
              new Intl.NumberFormat(language.intl(),{minimumFractionDigits:2,maximumFractionDigits:2})
                .format(field.value.value)+" "+(source.baseCurrency??t("sf.u13.remaining.missing")):
              field.value.kind==="text"?(field.value.text.kind==="data"?field.value.text.text:
                t("sf.u13.remaining.missing")):
                t("sf.u13.remaining.missing")}</dd></div>
        }</For>
      </dl>
      <Show when={source.stage==="sourcing"} fallback={<section>
        <h3>{t("sf.u13.remaining.terms")}</h3>
        <p>{t("sf.u13.remaining.poSupplier")}: {record.po?.supplier??t("sf.u13.remaining.missing")}</p>
        <p>{t("sf.u13.remaining.poCurrency")}: {record.po?.currency??t("sf.u13.remaining.missing")}</p>
        <h4>{t("sf.u13.remaining.poLines")}</h4>
        <ul><For each={record.po?.lines??[]}>{(line)=>
          <li>{line.desc??line.description??t("sf.u13.remaining.missing")} ·
            {String(line.qty??t("sf.u13.remaining.missing"))} ×
            {String(line.unitPrice??t("sf.u13.remaining.missing"))}</li>
        }</For></ul>
      </section>}>
        <section>
          <h3>{t("sf.u13.remaining.offers")}</h3>
          <p>{t("sf.u13.remaining.selectedQuote")}: {record.sourcing?.selectedId??t("sf.u13.remaining.missing")}</p>
          <ul><For each={record.sourcing?.quotes??[]}>{(quote)=>
            <li>{quote.supplier??quote.id??t("sf.u13.remaining.missing")} ·
              {String(quote.total??t("sf.u13.remaining.missing"))} {quote.currency??""}</li>
          }</For></ul>
          <p>{t("sf.u13.remaining.noRank")}</p>
          <p>{t("sf.u13.remaining.fx")}: {record.sourcing?.fxSnapshot?
            JSON.stringify(record.sourcing.fxSnapshot):t("sf.u13.remaining.fxMissing")}</p>
        </section>
      </Show>
      <p>{t("sf.u13.remaining.noFinancialApproval")}</p>
      <p>{t("sf.u13.remaining.reopened")}</p>
      <Show when={draft?.availability==="active"}>
        <div class="sf-u13-remaining-decision">
          <label>{t("sf.u13.remaining.comment")}
            <textarea value={draftValue().comment} disabled={phaseIsBusy(ui.phase)}
              onInput={(event)=>setNote("comment",event.currentTarget.value)}/>
          </label>
          <label>{t("sf.u13.remaining.reason")}
            <textarea value={draftValue().reason} disabled={phaseIsBusy(ui.phase)}
              onInput={(event)=>setNote("reason",event.currentTarget.value)}/>
          </label>
          <div class="sf-u13-remaining-actions">
            <button type="button" class="mx-btn-primary"
              disabled={!available("approve")||phaseIsBusy(ui.phase)||!!conflict}
              onClick={()=>begin("approve")}>{t("sf.u13.remaining.approve")}</button>
            <button type="button" class="mx-btn"
              disabled={!available("reject")||phaseIsBusy(ui.phase)||!!conflict||
                !draftValue().reason.trim()}
              onClick={()=>begin("reject")}>{t("sf.u13.remaining.reject")}</button>
          </div>
          <Show when={conflict}><p role="alert">{t("sf.u13.remaining.conflict")}</p></Show>
        </div>
      </Show>
      <Show when={!available("approve")&&!available("reject")}>
        <p role="status">{t("sf.u13.remaining.readOnly")}</p>
      </Show>
    </section>
  }
  return <SfPageFrame
    titleKey={k("sf.cap26.title" as SfU13RemainingCopyKey)}
    subtitleKey={k("sf.u13.remaining.title")}
    context={[]} tabs={[]} activeTab={null} density="comfortable"
    layout={ui.layoutMode==="single"?"reading":"split"}
    onLayoutMode={(layout)=>setUi("layoutMode",layout)}
    secondaryActions={[{id:"refresh",labelKey:k("sf.u13.remaining.refresh"),tone:"secondary",
      disabled:phaseIsBusy(ui.phase),busy:false,onInvoke:()=>{
        const token=authority();if(token)void refresh(token,ref()??undefined)
      }}]}
  >
    <div class="sf-u13-remaining-root">
      <Show when={currentState()==="ready"||currentState()==="empty"||currentState()==="filtered-empty"||currentState()==="outcome-unknown"}
        fallback={<SfStatePanel state={currentState()} messageKey={k(stateKey())}
          onRetryRead={()=>{const token=authority();if(token)void refresh(token,ref()??undefined)}}/>}>
        <Show when={ui.phase==="outcome-unknown"||ui.phase==="source-changed"}>
          <p role="alert">{t("sf.u13.remaining.unknown")}</p>
          <Show when={ui.changedAfterUnknown}><p>{t("sf.u13.remaining.changed")}</p></Show>
          <Show when={ui.unknownOperation}><SfReceiptView
            operationRef={ui.unknownOperation!}
            producerStatus={{kind:"pending"}} effects={[]} receipts={[]}
            state="outcome-unknown"
            onReconcileRead={()=>{const token=authority();if(token)void refresh(token,ref()??undefined)}}
          /></Show>
        </Show>
        <Show when={ui.phase==="producer-confirmed"}><p role="status">
          {t("sf.u13.remaining.confirmed")} {t("sf.u13.remaining.noReceipt")}
        </p></Show>
        <Show when={ui.phase==="failed"}><p role="alert">{t("sf.u13.remaining.failed")}</p></Show>
        <Show when={ui.phase!=="outcome-unknown"&&ui.phase!=="source-changed"}>
        <Show when={!ui.review} fallback={<SfChangeReview
          operation={{ref:(ui.review?.intentRef??"CAP26:unknown") as SfOperationRef,
            label:m("sf.u13.remaining.review"),scope:d(ui.review?.source.requestRef??"")}}
          base={ui.review?snapshot(ui.review.source):null}
          current={ui.review?snapshot(ui.review.source):null}
          proposed={ui.review?proposed(ui.review):{kind:"not-provided",reason:m("sf.u13.remaining.unavailable")}}
          effects={[{id:"decision",domain:"procurement",title:d(ui.review?.decision??""),
            state:"proposed",details:[]}]}
          coverage={{state:ui.review?.source.baseCurrency?"complete":"partial",
            summary:m("sf.u13.remaining.coverage"),reasons:ui.review?.source.baseCurrency?[]:
              [m("sf.u13.remaining.fxMissing")],knownCount:1,expectedCount:1}}
          blockingReasons={[]}
          confirmation={confirmation()}
          state={ui.phase==="conflict"?"conflict":"ready"}
          onConfirm={(decision)=>void confirm(decision as Extract<ReturnType<typeof confirmation>,{kind:"admitted"}>)}
          onRevise={()=>{setUi("review",null);setUi("phase","idle")}}
          onCancel={()=>{setUi("review",null);setUi("phase","idle")}}
        />}>
          <div class="sf-u13-remaining-filters">
            <label>{t("sf.u13.remaining.search")}
              <input type="search" value={ui.search}
                onInput={(event)=>setUi("search",event.currentTarget.value)}/>
            </label>
            <label>{t("sf.u13.remaining.filter")}
              <select value={ui.group}
                onChange={(event)=>setUi("group",event.currentTarget.value as ApprovalGroup|"all")}>
                <option value="all">{t("sf.u13.remaining.all")}</option>
                <option value="you">{t("sf.u13.remaining.yours")}</option>
                <option value="others">{t("sf.u13.remaining.others")}</option>
                <option value="unassigned">{t("sf.u13.remaining.unassigned")}</option>
              </select>
            </label>
          </div>
          <SfDataTable<PendingApproval>
            rows={queued()}
            getRowKey={(item)=>item.requestRef as SfRef}
            columns={[
              {id:"request",labelKey:k("sf.u13.remaining.request"),align:"start",
                widthPolicy:{kind:"content",minPx:85,maxPx:160},sortKey:"request",
                render:(item)=><>{item.requestRef}</>},
              {id:"subject",labelKey:k("sf.u13.remaining.subject"),align:"start",
                widthPolicy:{kind:"flex",minPx:140,weight:2},
                render:(item)=><>{item.request.pr?.title??t("sf.u13.remaining.missing")}</>},
              {id:"stage",labelKey:k("sf.u13.remaining.stage"),align:"start",
                widthPolicy:{kind:"content",minPx:110,maxPx:200},sortKey:"stage",
                render:(item)=><>{t(item.stage==="sourcing"?"sf.u13.remaining.sourcing":"sf.u13.remaining.po")}</>},
              {id:"amount",labelKey:k("sf.u13.remaining.amount"),align:"end",
                widthPolicy:{kind:"content",minPx:105,maxPx:220},
                render:(item)=><>{item.amount} {item.baseCurrency??t("sf.u13.remaining.missing")}</>},
              {id:"holder",labelKey:k("sf.u13.remaining.owner"),align:"start",
                widthPolicy:{kind:"content",minPx:105,maxPx:220},sortKey:"holder",
                render:(item)=><>{item.holderName??item.holderId??t("sf.u13.remaining.unassigned")}</>},
            ]}
            selectedKey={approval()?.requestRef as SfRef|undefined}
            sort={ui.sort} page={{kind:"none",total:queued().length}}
            onSort={(sort)=>setUi("sort",sort)}
            onPage={()=>{}} onSelect={(recordRef)=>setUi("selected",recordRef)}
            rowActions={(item)=>item.actions.map((action)=>({id:action,
              labelKey:k(action==="approve"?"sf.u13.remaining.approve":"sf.u13.remaining.reject"),
              tone:action==="approve"?"secondary" as const:"danger" as const,
              disabled:phaseIsBusy(ui.phase),busy:false}))}
            onRowAction={({recordRef,actionId})=>{
              setUi("selected",recordRef)
              // Only opens the record. No command is dispatched on list action:
              // a source-bound decision must be reviewed explicitly.
              if(actionId==="approve"||actionId==="reject")setUi("failure",null)
            }}
            captionKey={k("sf.u13.remaining.title")} density="comfortable"
            state={queued().length===0?"filtered-empty":"ready"}
          />
          <Show when={approval()}>{detail()}</Show>
          <Show when={selected()?.kind==="not-pending"}><p role="status">{t("sf.u13.remaining.reopened")}</p></Show>
        </Show>
        </Show>
      </Show>
    </div>
  </SfPageFrame>
}
