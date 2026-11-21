import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import { SfDomain, SfDomainStakeholder } from "@orchestra/schema/sucafina/domain"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfNativeCollection, readFailure, writeOutcome } from "../risks/collection"
import type { CollectionSpec, Field } from "../risks/collection"
type Stakeholder = typeof SfDomainStakeholder.Type
type Save = typeof SfDomain.operations["domain.command.CAP15.save"]["input"]["Type"]
type Values = Save["values"]
const txt = (value: unknown) => value === undefined || value === null ? "" :
  typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : ""
const optionalText = (value: unknown) => value === null || value === undefined ? undefined : txt(value)
const fields: readonly Field<Stakeholder, Values>[] = [
  {name:"name",label:"sf.u30.stakeholder.name",kind:"text",required:true},
  {name:"position",label:"sf.u30.stakeholder.position",kind:"text"},
  {name:"title",label:"sf.u30.stakeholder.title",kind:"text"},
  {name:"company",label:"sf.u30.stakeholder.company",kind:"text"},
  {name:"department",label:"sf.u30.stakeholder.department",kind:"text"},
  {name:"role",label:"sf.u30.stakeholder.role",kind:"text"},
  {name:"email",label:"sf.u30.stakeholder.email",kind:"email"},
  {name:"biz",label:"sf.u30.stakeholder.biz",kind:"select", options: [{ value: "", label: "sf.u30.factor.choose" }, { value: "1", label: "sf.u30.number.1" }, { value: "2", label: "sf.u30.number.2" }, { value: "3", label: "sf.u30.number.3" }, { value: "4", label: "sf.u30.number.4" }, { value: "5", label: "sf.u30.number.5" }]},
  {name:"iti",label:"sf.u30.stakeholder.iti",kind:"select", options: [{ value: "", label: "sf.u30.factor.choose" }, { value: "1", label: "sf.u30.number.1" }, { value: "2", label: "sf.u30.number.2" }, { value: "3", label: "sf.u30.number.3" }, { value: "4", label: "sf.u30.number.4" }, { value: "5", label: "sf.u30.number.5" }]},
  {name:"perc",label:"sf.u30.stakeholder.perc",kind:"select", options: [{ value: "", label: "sf.u30.factor.choose" }, { value: "1", label: "sf.u30.number.1" }, { value: "2", label: "sf.u30.number.2" }, { value: "3", label: "sf.u30.number.3" }, { value: "4", label: "sf.u30.number.4" }, { value: "5", label: "sf.u30.number.5" }]},
  {name:"priority",label:"sf.u30.stakeholder.priority",kind:"select", options: [{value:"",label:"sf.u30.priority.choose"},{value:"action",label:"sf.u30.priority.action"},{value:"monitor",label:"sf.u30.priority.monitor"},{value:"low",label:"sf.u30.priority.low"} ]},
  {name:"owner",label:"sf.u30.stakeholder.owner",kind:"text"},
  {name:"action",label:"sf.u30.stakeholder.action",kind:"textarea"},
  {name:"actions",label:"sf.u30.stakeholder.actions",kind:"textarea"},
  {name:"notes",label:"sf.u30.stakeholder.notes",kind:"textarea"},
]
const initial = (row?: Stakeholder): Values => ({
  name: row ? optionalText(row.name) : "", position: row ? optionalText(row.position) : "",
  title: row ? optionalText(row.title) : "", company: row ? optionalText(row.company) : "",
  department: row ? optionalText(row.department) : "",
  role: row ? optionalText(row.role) : undefined, email: row ? optionalText(row.email) : "",
  biz: row?.biz === null ? null : row?.biz === undefined ? undefined : txt(row.biz),
  iti: row?.iti === null ? null : row?.iti === undefined ? undefined : txt(row.iti),
  perc: row?.perc === null ? null : row?.perc === undefined ? undefined : txt(row.perc),
  priority: row ? optionalText(row.priority) : "",
  owner: row ? optionalText(row.owner) : "", action: row ? optionalText(row.action) : "",
  actions: row ? optionalText(row.actions) : undefined,
  notes: row ? optionalText(row.notes) : "",
})
const spec: CollectionSpec<"CAP15", Stakeholder, Values> = {
  id:"CAP15", collection:"stakeholders", title:"sf.cap15.title", primary:"sf.cap15.primary",
  readOperation:"domain.page.CAP15",saveOperation:"domain.command.CAP15.save",
  deleteOperation:"domain.command.CAP15.delete",
  fields,
  columns:[
    {name:"name",label:"sf.u30.stakeholder.name"},
    {name:"position",label:"sf.u30.stakeholder.position"},
    {name:"company",label:"sf.u30.stakeholder.company"},
    {name:"department",label:"sf.u30.stakeholder.department"},
    {name:"biz",label:"sf.u30.stakeholder.biz"},
    {name:"iti",label:"sf.u30.stakeholder.iti"},
    {name:"perc",label:"sf.u30.stakeholder.perc"},
    {name:"priority",label:"sf.u30.stakeholder.priority"},
    {name:"owner",label:"sf.u30.stakeholder.owner"},
  ],
  name:(row)=>txt(row.name),
  initial,
  deepRef:(route)=>route.kind==="detail"||route.kind==="edit"?String(route.params.stakeholderRef):null,
  query:(route)=>({status:route.query.status,filter:route.query.filter}),
  read:async (transport,query,signal)=>{
    const response=await createSfDomainClient(transport)["domain.page.CAP15"](query,{signal})
    if(response.kind!=="response"||response.body.status!=="ok")return {kind:"error",state:readFailure(response)}
    const rows=response.body.value.data.stakeholders
    return rows===undefined?{kind:"error",state:"unavailable"}:{
      kind:"ok",rows,versions:response.body.value.versions,
      actions:response.body.value.allowedActionIds,
    }
  },
  save:async(transport,command,signal,idempotencyKey)=>{
    const values = { ...command.values }
    for (const field of fields) {
      if (values[field.name] === undefined) delete values[field.name]
    }
    return writeOutcome(await createSfDomainClient(transport)["domain.command.CAP15.save"](
      { ...(command.id === undefined ? {} : { id: command.id }), version: command.version, values },
      {signal,idempotencyKey}))
  },
  delete:async(transport,command,signal,idempotencyKey)=>
    writeOutcome(await createSfDomainClient(transport)["domain.command.CAP15.delete"](
      {id:command.id,version:command.version,values:{}},{signal,idempotencyKey})),
}
export function SfStakeholdersView(props:SfSurfaceProps<"CAP15">) {
  return <SfNativeCollection {...props} spec={spec}/>
}
