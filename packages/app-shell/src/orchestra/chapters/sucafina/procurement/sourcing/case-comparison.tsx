import { createEffect, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { useSfContext } from "../../context"
import type { SfContextStamp } from "../../context/contracts"
import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import { SfProcurement } from "@orchestra/schema/sucafina/procurement"
import type { SfU12CopyKey } from "@/i18n/orchestra-chapters/sf-u12"

type PrepareOutput = typeof SfProcurement.operations["procurement.sourcing.prepare"]["output"]["Type"]
type ControlsOutput = typeof SfProcurement.operations["procurement.procurement-scenario-controls"]["output"]["Type"]
type PreviewOutput = typeof SfProcurement.operations["procurement.procurement-scenario-preview"]["output"]["Type"]
type CaseRef = typeof SfProcurement.operations["procurement.sourcing.prepare"]["input"]["Type"]["caseRef"]
type Props = Readonly<{
  // A genuine, previously authorized decision-case reference supplied by F01
  // or a decision-capability composer; never built from the request URL.
  caseRef: CaseRef
  requestRef: string
  requestVersion: number
  ownerStamp: SfContextStamp
}>

const admitted = (stamp:SfContextStamp,received:SfContextStamp)=>
  Object.keys(stamp).every((name)=>stamp[name as keyof SfContextStamp]===received[name as keyof SfContextStamp])

/**
 * Optional case-bound, READ-ONLY consumer of the original A03 ports.
 * CAP25 alone has no caseRef; U12 must not invent a case or route a free URL.
 * 125 composes this only when the real decision owner supplies Props.caseRef.
 * All preview totals, sources and coverage are producer facts; no browser math,
 * approval, mutated case, or parallel scenario service is introduced.
 */
export function SfSourcingCaseComparison(props:Props):JSX.Element {
  const host=useSfContext()
  const language=useLanguage()
  const t=(key:SfU12CopyKey)=>language.t(key as Parameters<typeof language.t>[0])
  const [ui,setUi]=createStore<{
    token:string|null
    state:"ready"|"loading"|"denied"|"unavailable"|"stale"
    prepared:Extract<PrepareOutput,{status:"ok"}>["value"]|null
    controls:Extract<ControlsOutput,{status:"ok"}>["value"]|null
    preview:Extract<PreviewOutput,{status:"ok"}>["value"]|null
    sourceDigest:string
    error:string|null
  }>({
    token:null,state:"ready",prepared:null,controls:null,preview:null,
    sourceDigest:"",error:null,
  })
  let abort:AbortController|undefined
  let generation=0
  const authorized=()=>{
    const state=host.state(),ready=host.ready()
    if(state.status!=="ready"||!ready||!admitted(props.ownerStamp,ready.context.stamp))return null
    return JSON.stringify([state.ownerKey,host.generation(),state.context.stamp,
      props.caseRef,props.requestRef,props.requestVersion])
  }
  const available=(operationId:string)=>{
    const ready=host.ready()
    return !!authorized()&&!!ready&&ready.context.availability.some((resource)=>
      resource.family==="procurement"&&resource.resource==="CAP25"&&
      resource.operations.some((operation)=>operation.operationId===operationId&&
        operation.state==="ready"&&operation.operational))
  }
  createEffect(()=>{
    const token=authorized()
    abort?.abort()
    generation++
    setUi({token,state:token?"ready":"denied",prepared:null,
      controls:null,preview:null,sourceDigest:"",error:null})
    onCleanup(()=>abort?.abort())
  })
  const prepare=async()=>{
    const token=authorized(),ready=host.ready()
    if(!token||!ready||ui.state==="loading"||!available("procurement.sourcing.prepare"))return
    abort?.abort()
    const controller=new AbortController()
    abort=controller
    const seq=++generation
    setUi("state","loading")
    try{
      const client=createSfProcurementClient(ready.transport)
      const result=await client["procurement.sourcing.prepare"]({
        caseRef:props.caseRef,requestRef:props.requestRef,
      },{signal:controller.signal})
      if(controller.signal.aborted||token!==authorized()||seq!==generation)return
      if(result.kind==="transport-error"||result.status!==200||result.body.status!=="ok"){
        setUi("state","unavailable");return
      }
      if(result.body.value.request.requestRef!==props.requestRef||
         result.body.value.request.version!==props.requestVersion){
        setUi("state","stale");return
      }
      setUi("prepared",result.body.value)
      setUi("state","ready")
    }catch{if(!controller.signal.aborted&&token===authorized())setUi("state","unavailable")}
  }
  const controls=async()=>{
    const token=authorized(),ready=host.ready()
    if(!token||!ready||ui.state==="loading"||
       !available("procurement.procurement-scenario-controls")||!ui.prepared)return
    abort?.abort()
    const controller=new AbortController()
    abort=controller
    const seq=++generation
    setUi("state","loading")
    try{
      const client=createSfProcurementClient(ready.transport)
      const result=await client["procurement.procurement-scenario-controls"]({
        case:props.caseRef.id,version:props.caseRef.version,
      },{signal:controller.signal})
      if(controller.signal.aborted||token!==authorized()||seq!==generation)return
      if(result.kind==="transport-error"||result.status!==200||result.body.status!=="ok"){
        setUi("state","unavailable");return
      }
      const value=result.body.value
      if(value.caseRef.id!==props.caseRef.id||
         value.caseRef.incarnation!==props.caseRef.incarnation||
         value.caseRef.version!==props.caseRef.version||
         !admitted(ready.context.stamp,{
           ...ready.context.stamp,installationId:value.authority.installationId,
           projectId:value.authority.projectId,principalRef:value.authority.principalRef,
           policyVersion:value.authority.policyVersion,
           accessRevision:value.authority.accessRevision,
         })||value.financialApproval!=="blocked"){
        setUi("state","stale");return
      }
      setUi("controls",value)
      setUi("sourceDigest","")
      setUi("state","ready")
    }catch{if(!controller.signal.aborted&&token===authorized())setUi("state","unavailable")}
  }
  const preview=async()=>{
    const token=authorized(),ready=host.ready()
    if(!token||!ready||ui.state==="loading"||
       !available("procurement.procurement-scenario-preview")||!ui.controls||
       !ui.controls.sources.some((source)=>source.sourceDigest===ui.sourceDigest)||
       !/^[a-f0-9]{64}$/.test(ui.sourceDigest))return
    abort?.abort()
    const controller=new AbortController()
    abort=controller
    const seq=++generation
    const digest=ui.sourceDigest
    setUi("state","loading")
    try{
      const client=createSfProcurementClient(ready.transport)
      const result=await client["procurement.procurement-scenario-preview"]({
        caseRef:props.caseRef,sourceDigest:digest,costInventory:"renewal-transition-v1",
        operation:{kind:"baseline"},
      },{signal:controller.signal})
      if(controller.signal.aborted||token!==authorized()||seq!==generation)return
      if(result.kind==="transport-error"||result.status!==200||result.body.status!=="ok"){
        setUi("state","unavailable");return
      }
      const value=result.body.value
      if(value.producer.sourceDigest!==digest||
         value.caseRef.id!==props.caseRef.id||
         value.caseRef.version!==props.caseRef.version||
         value.financialApproval!=="blocked"){
        setUi("state","stale");return
      }
      setUi("preview",value)
      setUi("state","ready")
    }catch{if(!controller.signal.aborted&&token===authorized())setUi("state","unavailable")}
  }
  return <section class="sf-u12-case-comparison" aria-label={t("sf.u12.prepare")}>
    <h3>{t("sf.u12.prepare")}</h3>
    <p>{t("sf.u12.prepareUnavailable")}</p>
    <p>{t("sf.u12.noManualApproval")}</p>
    <Show when={ui.state!=="ready"}><p role="status">{t(ui.state==="stale"?"sf.u12.stale":
      ui.state==="denied"?"sf.u12.denied":ui.state==="loading"?"sf.u12.loading":"sf.u12.unavailable")}</p></Show>
    <button class="mx-btn" type="button" onClick={()=>void prepare()}
      disabled={!available("procurement.sourcing.prepare")||ui.state==="loading"}>
      {t("sf.u12.prepare")}
    </button>
    <Show when={ui.prepared}>
      <p>{t("sf.u12.version")}: {ui.prepared?.request.version}</p>
      <p>{t("sf.u12.quotes")}: {ui.prepared?.authorizedOffers.length}</p>
      <ul><For each={ui.prepared?.authorizedOffers??[]}>{(offer)=>
        <li>{offer.offerRef}: {offer.amount??t("sf.u12.missing")} {offer.currency} ·
          {t("sf.u12.sourceOnly")}</li>
      }</For></ul>
      <p>{t("sf.u12.submittedFx")}: {ui.prepared?.submittedFx.length}</p>
      <button class="mx-btn" type="button" onClick={()=>void controls()}
        disabled={!available("procurement.procurement-scenario-controls")||ui.state==="loading"}>
        {t("sf.u12.compare")}
      </button>
    </Show>
    <Show when={ui.controls}>
      <p role="status">{t("sf.u12.noManualApproval")}: {ui.controls?.financialApprovalReason}</p>
      <label>{t("sf.u12.sourceOnly")}
        <select value={ui.sourceDigest} onChange={(event)=>{
          setUi("sourceDigest",event.currentTarget.value);setUi("preview",null)
        }}>
          <option value="">{t("sf.u12.missing")}</option>
          <For each={ui.controls?.sources??[]}>{(source)=>
            <option value={source.sourceDigest}>{source.label} · {source.currency} ·
              {source.period.start}–{source.period.end}</option>
          }</For>
        </select>
      </label>
      <button class="mx-btn" type="button" onClick={()=>void preview()}
        disabled={!ui.sourceDigest||ui.state==="loading"||
          !available("procurement.procurement-scenario-preview")}>
        {t("sf.u12.compare")}
      </button>
    </Show>
    <Show when={ui.preview}>
      <p>{t("sf.u12.coverage")}: {ui.preview?.assessment.coverageState}</p>
      <p>{t("sf.u12.quoteTotal")}: {ui.preview?.scenario.total??t("sf.u12.missing")}
        {ui.preview?.scenario.currency}</p>
      <p>{t("sf.u12.sourceOnly")}: {ui.preview?.scenario.comparisonStatus}</p>
      <ul><For each={ui.preview?.scenario.unresolvedConditions??[]}>{(reason)=>
        <li>{reason}</li>
      }</For></ul>
      <p>{t("sf.u12.noManualApproval")}: {ui.preview?.financialApprovalReason}</p>
    </Show>
  </section>
}
