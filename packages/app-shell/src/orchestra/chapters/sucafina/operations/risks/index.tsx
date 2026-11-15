import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import { SfDomain, SfDomainRisk } from "@orchestra/schema/sucafina/domain"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfNativeCollection, readFailure, writeOutcome } from "./collection"
import type { CollectionSpec, Field } from "./collection"
type Risk = typeof SfDomainRisk.Type
type RiskCommand = typeof SfDomain.operations["domain.command.CAP13.save"]["input"]["Type"]
type RiskValues = RiskCommand["values"]
const txt = (value: unknown) => value === undefined || value === null ? "" :
  typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : ""
const optionalText = (value: unknown) => value === null || value === undefined ? undefined : txt(value)
const riskStatus = (value: unknown): RiskValues["status"] =>
  value === "open" || value === "mitigating" || value === "monitoring" || value === "closed" ? value : undefined
const fields: readonly Field<Risk, RiskValues>[] = [
  {name:"title",label:"sf.u30.risk.title",kind:"text"},
  {name:"name",label:"sf.u30.risk.name",kind:"text",required:true},
  {name:"action",label:"sf.u30.risk.action",kind:"textarea"},
  {name:"responsible",label:"sf.u30.risk.responsible",kind:"text"},
  {name:"desc",label:"sf.u30.risk.desc",kind:"textarea"},
  {name:"category",label:"sf.u30.risk.category",kind:"text"},
  {name:"impact",label:"sf.u30.risk.impact",kind:"select", options: [{ value: "", label: "sf.u30.factor.choose" }, { value: "1", label: "sf.u30.number.1" }, { value: "2", label: "sf.u30.number.2" }, { value: "3", label: "sf.u30.number.3" }, { value: "4", label: "sf.u30.number.4" }, { value: "5", label: "sf.u30.number.5" }]},
  {name:"probability",label:"sf.u30.risk.probability",kind:"select", options: [{ value: "", label: "sf.u30.factor.choose" }, { value: "1", label: "sf.u30.number.1" }, { value: "2", label: "sf.u30.number.2" }, { value: "3", label: "sf.u30.number.3" }, { value: "4", label: "sf.u30.number.4" }, { value: "5", label: "sf.u30.number.5" }]},
  {name:"status",label:"sf.u30.risk.status",kind:"select", options: [{value:"",label:"sf.u30.all"}, {value:"open",label:"sf.u30.risk.option.status.open"}, {value:"mitigating",label:"sf.u30.risk.option.status.mitigating"}, {value:"monitoring",label:"sf.u30.risk.option.status.monitoring"}, {value:"closed",label:"sf.u30.risk.option.status.closed"}]},
  {name:"owner",label:"sf.u30.risk.owner",kind:"text"},
  {name:"mitigation",label:"sf.u30.risk.mitigation",kind:"textarea"},
  {name:"due",label:"sf.u30.risk.due",kind:"date"},
  {name:"notes",label:"sf.u30.risk.notes",kind:"textarea"},
]
const riskValues = (row?: Risk): RiskValues => ({
  title: row ? optionalText(row.title) : "",
  name: row ? optionalText(row.name) : "",
  action: row ? optionalText(row.action) : "",
  responsible: row ? optionalText(row.responsible) : "",
  desc: row ? optionalText(row.desc) : "",
  category: row ? optionalText(row.category) : "",
  impact: row?.impact === null ? null : row?.impact === undefined ? undefined : txt(row.impact),
  probability: row?.probability === null ? null : row?.probability === undefined ? undefined : txt(row.probability),
  status: riskStatus(row?.status),
  owner: row ? optionalText(row.owner) : "",
  mitigation: row ? optionalText(row.mitigation) : "",
  due: row ? optionalText(row.due) : "",
  notes: row ? optionalText(row.notes) : "",
})
const spec: CollectionSpec<"CAP13", Risk, RiskValues> = {
  id:"CAP13", collection:"risks", title:"sf.cap13.title", primary:"sf.cap13.primary",
  readOperation:"domain.page.CAP13",saveOperation:"domain.command.CAP13.save",
  deleteOperation:"domain.command.CAP13.delete",
  fields,
  columns:[
    {name:"title",label:"sf.u30.risk.title"}, {name:"name",label:"sf.u30.risk.name"},
    {name:"responsible",label:"sf.u30.risk.responsible"},
    {name:"status",label:"sf.u30.risk.status"}, {name:"impact",label:"sf.u30.risk.impact"},
    {name:"probability",label:"sf.u30.risk.probability"},
    {name:"due",label:"sf.u30.risk.due"},
  ],
  name:(row)=>txt(row.title)||txt(row.name),
  initial:riskValues,
  deepRef:(route)=>route.kind==="detail"||route.kind==="edit"?String(route.params.riskRef):null,
  query:(route)=>({status:route.query.status,filter:route.query.filter}),
  read:async (transport,query,signal)=>{
    const response=await createSfDomainClient(transport)["domain.page.CAP13"](query,{signal})
    if(response.kind!=="response"||response.body.status!=="ok")return {kind:"error",state:readFailure(response)}
    const rows=response.body.value.data.risks
    return rows===undefined?{kind:"error",state:"unavailable"}:{
      kind:"ok", rows, versions:response.body.value.versions,
      actions:response.body.value.allowedActionIds,
    }
  },
  save:async(transport,command,signal,idempotencyKey)=>
    writeOutcome(await createSfDomainClient(transport)["domain.command.CAP13.save"](
      {id:command.id,version:command.version,values:command.values},{signal,idempotencyKey})),
  delete:async(transport,command,signal,idempotencyKey)=>
    writeOutcome(await createSfDomainClient(transport)["domain.command.CAP13.delete"](
      {id:command.id,version:command.version,values:{}},{signal,idempotencyKey})),
}
export function SfRisksView(props:SfSurfaceProps<"CAP13">) {
  return <SfNativeCollection {...props} spec={spec}/>
}
