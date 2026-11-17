#!/usr/bin/env node
/** FLA-DEMO-2026: deterministic input, authenticated original product APIs only.
 * No direct DB access, fixture role impersonation, fake transitions or invented routes.
 * --apply is the only mode with HTTP effects. Unproven outcomes remain PENDING.
 */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir=dirname(fileURLToPath(import.meta.url));
const read=async f=>JSON.parse(await readFile(join(dir,f),"utf8"));
const [org,catalog,fixtures]=await Promise.all(["org.json","catalog.json","scenarios.json"].map(read));
const supported=["settings","suppliers","procurement","planner","dashboard","imports","decisions","reports","denial","schedules"];
const flags=process.argv.slice(2);
const has=x=>flags.includes("--"+x);
const arg=(key,fallback)=>flags.find(x=>x.startsWith("--"+key+"="))?.slice(key.length+3)||fallback;
const phases=arg("phase","all")==="all"?supported:arg("phase","all").split(",");
const apply=has("apply"), strict=has("strict");
const report={fixture:"FLA-DEMO-2026",mode:apply?"live-product":"dry-run",checks:[],status:"PENDING"};
const status=(phase,state,evidence)=>report.checks.push({phase,state,evidence});
const demand=(ok,msg)=>{if(!ok)throw new Error(msg)};
const hash=x=>createHash("sha256").update(x).digest("hex");
function key(label){const raw=hash("FLA-DEMO:v1:"+label).slice(0,32).split("");raw[12]="4";raw[16]="89ab"[parseInt(raw[16],16)%4];const s=raw.join("");return s.slice(0,8)+"-"+s.slice(8,12)+"-"+s.slice(12,16)+"-"+s.slice(16,20)+"-"+s.slice(20);}
function staticChecks(){
  demand(org.synthetic===true&&catalog.synthetic===true&&fixtures.synthetic===true&&!org.realData,"fixtures-not-synthetic");
  demand(org.departments.length===6&&org.costCenters.length===12&&catalog.suppliers.length===10,"inventory-wrong");
  demand(org.actors.map(a=>a.key).join(",")==="Daniel,Caio,Pedro,Gabriel,Sofie,Zico","actors-wrong");
  demand(org.actors.find(a=>a.key==="Zico").roleBySurface.dashboard.length===0&&fixtures.denial.expectedHttpStatus===403,"denial-wrong");
  const c=new Set(org.costCenters.map(x=>x.id));
  demand(fixtures.procurement.requests.every(x=>c.has(x.costCenter)),"cost-centre-missing");
  demand(new Set(fixtures.procurement.requests.map(x=>x.title)).size===fixtures.procurement.requests.length,"request-title-duplicate");
  demand(fixtures.planner.lines.some(x=>x.currency==="EUR")&&catalog.fxRates.pending.some(x=>x.currency==="EUR"),"missing-FX-scenario-lost");
  demand(phases.every(x=>supported.includes(x))&&phases.length>0,"unknown-phase");
}
staticChecks();
let origin, mount;
function location(surface,params={}){
  const u=new URL(mount+"/"+surface,origin+"/");
  for(const [k,v]of Object.entries(params))if(v!==undefined)u.searchParams.set(k,String(v));
  return u;
}
function session(actor){
  const v=process.env["SF_DEMO_"+actor.toUpperCase()+"_COOKIE"];
  demand(typeof v==="string"&&v.length>10&&!/[\r\n]/.test(v),"real-cookie-required:"+actor);
  return v;
}
async function wire(actor,u,{method="GET",body,kind="json",headers={},exceptions=[]}={}){
  demand(u.origin===origin,"cross-origin-session-refused");
  const res=await fetch(u,{method,redirect:"manual",headers:{Cookie:session(actor),Origin:origin,Accept:"*/*",...headers},body,signal:AbortSignal.timeout(20000)});
  demand(![301,302,303,307,308].includes(res.status),"identity-redirect-not-authorization:"+actor);
  demand(res.status!==401,"unauthenticated-actor:"+actor);
  if(exceptions.includes(res.status))return {status:res.status,body:await res.text()};
  demand(res.status===200,"http-"+res.status+":"+actor+":"+u.pathname+"?"+u.searchParams.toString());
  const ct=res.headers.get("content-type")||"";
  if(kind==="html"){demand(ct.includes("text/html"),"expected-html");return res.text();}
  if(kind==="bytes")return {ct,bytes:new Uint8Array(await res.arrayBuffer())};
  if(kind==="csv"){demand(ct.includes("csv")||ct.includes("plain"),"expected-csv");return csv(await res.text());}
  demand(ct.includes("json"),"expected-json");
  const obj=await res.json();
  demand(obj&&typeof obj==="object"&&!Array.isArray(obj),"invalid-json-domain-result");
  return obj;
}
function csv(text){
  const data=[];let row=[],value="",q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'&&text[i+1]==='"'){value+='"';i++;}else if(c==='"')q=false;else value+=c;}
    else if(c==='"')q=true;else if(c===","){row.push(value);value="";}
    else if(c==="\r"||c==="\n"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(value);if(row.some(v=>v))data.push(row);row=[];value="";}
    else value+=c;
  }
  demand(!q,"truncated-csv");row.push(value);if(row.some(v=>v))data.push(row);
  if(!data.length)return [];
  const headers=data.shift().map(x=>x.replace(/^\uFEFF/,""));
  return data.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||""])));
}
async function html(actor,surface,params={}){return wire(actor,location(surface,params),{kind:"html"});}
function forms(body,page,action,id){
  return [...body.matchAll(/<form data-command="([^"]+)" data-page="([^"]+)" data-record="([^"]*)" data-version="(\d+)"[^>]*>([\s\S]*?)<\/form>/g)]
    .map(m=>({action:m[1],page:m[2],id:m[3],version:Number(m[4]),content:m[5]}))
    .filter(f=>(!page||page===f.page)&&(!action||action===f.action)&&(id===undefined||f.id===id));
}
function findForm(body,page,action,id,field){
  const hit=forms(body,page,action,id).filter(f=>!field||f.content.includes('name="'+field+'"'));
  demand(hit.length===1,"form-not-unique:"+page+":"+action+":"+id);
  demand(!/<button[^>]*\sdisabled(?:\s|>)/.test(hit[0].content),"action-disabled:"+page+":"+action);
  return hit[0];
}
async function command(actor,surface,page,action,id,version,values={}){
  const result=await wire(actor,location(surface),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({page,action,...(id?{id}:{}),version,values})});
  demand(result.ok===true,"legacy-command-did-not-commit:"+page+":"+action);
}
async function transport(actor,surface,mode,data,keyName,form=false){
  const headers={"Idempotency-Key":key(keyName)};
  if(!form)headers["Content-Type"]="application/json";
  const res=await wire(actor,location(surface,{sf:mode}),{method:"POST",headers,body:form?data:JSON.stringify(data)});
  demand(res.status==="ok","domain-transport-not-accepted:"+mode);
  return res;
}
async function discovery(actor,surface,mode,params={}){
  const res=await wire(actor,location(surface,{sf:mode,...params}));
  demand(res.status==="ok","discovery-not-authorized:"+mode);
  return res.value;
}
async function doSettings(){
  const page=await html("Daniel","procurement",{page:"Settings"}),f=findForm(page,"Settings","save","");
  const matches=[...page.matchAll(/<option value="([^"]+)"[^>]*>Gabriel<\/option>/g)];
  demand(matches.length===1,"Gabriel-tenant-principal-must-resolve-uniquely-in-real-directory");
  const holder=matches[0][1];
  const mark='name="levels.0.id" type="text" value="FLA-DEMO-GABRIEL"';
  if(page.includes(mark)){
    demand(page.includes('name="currency" type="text" value="BRL"')&&page.includes('value="'+holder+'" selected'),"demo-settings-drift");
    demand(!page.includes('name="fxRates.2.code" type="text" value="EUR"'),"EUR-rate-unexpected");
    return status("settings","READY","same real Settings screen; no duplicate write");
  }
  const settings={currency:"BRL",levels:[{id:"FLA-DEMO-GABRIEL",name:"Gabriel demo approval",threshold:0,holderId:holder}],prApprovalMode:"first",blockSelfApproval:true,fxRates:[{code:"BRL",rate:1},{code:"USD",rate:5}],minQuotes:2,requireActiveSupplier:false};
  await command("Daniel","procurement","Settings","save",undefined,f.version,{settings});
  demand((await html("Daniel","procurement",{page:"Settings"})).includes(mark),"real-settings-readback-missing");
  status("settings","READY","real Settings save + owner readback; missing EUR intentional");
}
async function doSuppliers(){
  for(const supplier of catalog.suppliers){
    const all=await wire("Pedro",location("procurement",{download:"suppliers"}),{kind:"csv"});
    const found=all.filter(x=>x.legalName===supplier.legalName);
    demand(found.length<=1,"duplicate-supplier:"+supplier.id);
    if(!found.length){
      const f=findForm(await html("Pedro","procurement",{page:"Suppliers"}),"Suppliers","create","");
      await command("Pedro","procurement","Suppliers","create",undefined,f.version,{supplier:{legalName:supplier.legalName,tradingName:supplier.tradingName,type:"service",country:"BR",categories:supplier.categories,notes:"FLA-DEMO/2026 "+supplier.id,currency:supplier.currency,paymentTerms:"Net 30"}});
      demand((await wire("Pedro",location("procurement",{download:"suppliers"}),{kind:"csv"})).filter(x=>x.legalName===supplier.legalName).length===1,"supplier-create-unconfirmed");
    }
  }
  status("suppliers","READY","ten supplier entities reconciled through real CSV and product create");
}
async function idsForSuppliers(){
  const all=forms(await html("Pedro","procurement",{page:"Suppliers"}),"Suppliers","save");
  const result=new Map();
  for(const s of catalog.suppliers){
    const match=all.filter(f=>f.content.includes('name="legalName" type="text" value="'+s.legalName+'"'));
    demand(match.length===1,"supplier-master-id-unresolved:"+s.id);result.set(s.id,match[0].id);
  }
  return result;
}
async function register(){return wire("Caio",location("procurement",{download:"register"}),{kind:"csv"});}
async function rowOf(fixture){
  const matches=(await register()).filter(x=>x.Title===fixture.title);
  demand(matches.length<=1,"duplicate-product-requisition:"+fixture.id);
  return matches[0]||null;
}
async function stage(fixture){const row=await rowOf(fixture);return row?{id:row["PR number"],status:row.Status}:null;}
async function move(actor,fixture,action,values={},field){
  const before=await stage(fixture);demand(before?.id,"PR-identity-missing:"+fixture.id);
  const page=await html(actor,"procurement",{page:"Requests",request:before.id,filter:"All"});
  const form=findForm(page,"Requests",action,before.id,field);
  await command(actor,"procurement","Requests",action,before.id,form.version,values);
  const after=await stage(fixture);demand(after?.id===before.id,"PR-identity-changed:"+fixture.id);return after.status;
}
const order=["draft","pr_pending","sourcing","src_pending","po_draft","po_pending","po_approved"];
const transitions={
 pr_pending:["Caio","submit_pr",{}],
 sourcing:["Gabriel","approve",{comment:"FLA-DEMO requisition approved"}],
 src_pending:["Pedro","submit_sourcing",{}],
 po_draft:["Gabriel","approve",{comment:"FLA-DEMO sourcing reviewed"}],
 po_pending:["Pedro","submit_po",{}],
 po_approved:["Gabriel","approve",{comment:"FLA-DEMO purchase order approved"}],
 pr_rejected:["Gabriel","reject",{reason:"FLA-DEMO expected rejection"}]
};
function twoSuppliers(fixture){
  const cat=fixture.category==="Tecnologia"?"TECH":fixture.category==="Logística"?"LOG":fixture.category==="Nutrição"?"NUTRI":fixture.category==="Serviços de estádio"?"STAD":"SPORT";
  const list=catalog.suppliers.filter(x=>x.id.includes("-"+cat+"-"));demand(list.length===2,"supplier-category-missing");return list;
}
async function sourcing(fixture,ids){
  const picked=twoSuppliers(fixture),missing=fixture.id==="PR-FX-MISSING";
  const quotes=picked.map((x,i)=>({id:"FLA-DEMO-Q-"+fixture.id+"-"+i,supplier:x.legalName,supplierId:ids.get(x.id),currency:missing?"EUR":"BRL",qty:1,total:missing?83000-i*3500:fixture.amount+i*7500,unitPrice:missing?83000-i*3500:fixture.amount+i*7500,techPass:true,scores:[4,4,4,4,4],cscores:[0,4,4]}));
  await move("Pedro",fixture,"save",{sourcing:{quotes,evaluator:"Sofie",selectedId:null,contractStrategy:"new"}},'name="sourcing.evaluator"');
  await move("Pedro",fixture,"select_quote",{quoteId:quotes[0].id});
}
async function purchaseOrder(fixture){
  const supplier=twoSuppliers(fixture)[0];
  await move("Pedro",fixture,"save",{po:{currency:"BRL",expenseType:fixture.id==="PR-APPROVED"?"CAPEX":"OPEX",supplier:supplier.legalName,description:fixture.description,paymentTerms:"Net 30",deliveryDate:fixture.needBy,deliveryConditions:"Synthetic demo delivery only",contractRef:supplier.contractId}},'name="po.currency"');
}
async function ensureRequest(fixture,ids){
  let at=await stage(fixture);
  if(!at){
    const form=findForm(await html("Caio","procurement",{page:"Requests"}),"Requests","create","");
    await command("Caio","procurement","Requests","create",undefined,form.version,{pr:{title:fixture.title,type:fixture.type,description:fixture.description,estAmount:fixture.amount,costCenter:fixture.costCenter,needBy:fixture.needBy,justification:fixture.justification,category:fixture.category,recurring:false}});
    at=await stage(fixture);demand(at?.status==="draft","PR-create-readback-failed");
  }
  let count=0;
  while(at.status!==fixture.stageTarget){
    demand(++count<10,"transition-loop");
    const idx=order.indexOf(at.status);
    const next=fixture.stageTarget==="pr_rejected"&&at.status==="pr_pending"?"pr_rejected":order[idx+1];
    demand(idx>=0&&next,"target-stage-not-reachable-without-rewind:"+fixture.id+":"+at.status);
    if(next==="src_pending")await sourcing(fixture,ids);
    if(next==="po_pending")await purchaseOrder(fixture);
    const t=transitions[next];demand(t,"no-real-transition:"+next);
    const actual=await move(t[0],fixture,t[1],t[2]);
    demand(actual===next,"producer-stage-"+actual+"-expected-"+next);
    at=await stage(fixture);
  }
  if(fixture.id==="PR-FX-MISSING"){
    const page=await html("Pedro","procurement",{page:"Requests",request:at.id,filter:"All"});
    if(!page.includes("FLA-DEMO-Q-"+fixture.id))await sourcing(fixture,ids);
    const form=findForm(await html("Pedro","procurement",{page:"Requests",request:at.id,filter:"All"}),"Requests","submit_sourcing",at.id);
    const attempt=await wire("Pedro",location("procurement"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({page:"Requests",action:"submit_sourcing",id:at.id,version:form.version,values:{}}),exceptions:[422]});
    demand(attempt.status===422&&/fx|rate/i.test(attempt.body)&& (await stage(fixture)).status==="sourcing","missing-FX-422-not-proven");
  }
  status("procurement","READY",fixture.id+" -> "+at.status+" via product transitions");
}
async function doProcurement(){
  const ids=await idsForSuppliers();
  for(const r of fixtures.procurement.requests){
    await ensureRequest(r,ids);
    if(r.id==="PR-SOURCING"){
      const current=await stage(r);
      const page=await html("Pedro","procurement",{page:"Requests",request:current.id,filter:"All"});
      if(!page.includes("FLA-DEMO-Q-"+r.id))await sourcing(r,ids);
    }
  }
  const rev=fixtures.procurement.requests.find(x=>x.id==="PR-REVISION"),row=await stage(rev);
  const p=await html("Caio","procurement",{page:"Requests",request:row.id,filter:"All"});
  if(!p.includes("FLA-DEMO revised assumption")){
    const form=findForm(p,"Requests","save",row.id,'name="pr.title"');
    await command("Caio","procurement","Requests","save",row.id,form.version,{pr:{description:rev.description+" | FLA-DEMO revised assumption"}});
    const stale=await wire("Caio",location("procurement"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({page:"Requests",action:"save",id:row.id,version:form.version,values:{pr:{description:"stale forbidden"}}}),exceptions:[409]});
    demand(stale.status===409,"stale-CAS-must-409");
    status("procurement","READY","PR-REVISION successful version bump + stale 409");
  }
}
async function planVersion(){
  let p=await html("Daniel","planner",{page:"Versions"});
  const versions=()=>forms(p,"Versions","save").filter(x=>x.id);
  const own=()=>versions().filter(f=>f.content.includes('name="name" value="'+fixtures.planner.versionName+'"'));
  demand(own().length<=1,"duplicate-planner-version");
  if(own().length===1)return own()[0].id;
  demand(versions().length===0,"non-demo-plan-already-exists; do not mutate shared data");
  const form=findForm(p,"Versions","save","");
  await command("Daniel","planner","Versions","save",undefined,form.version,{});
  p=await html("Daniel","planner",{page:"Versions"});
  const one=versions();demand(one.length===1,"first-plan-unresolved");
  await command("Daniel","planner","Versions","save",one[0].id,one[0].version,{name:fixtures.planner.versionName,year:2026});
  p=await html("Daniel","planner",{page:"Versions"});
  demand(own().length===1,"plan-version-readback-failed");return own()[0].id;
}
async function doPlanner(){
  const id=await planVersion();let screen=await html("Daniel","planner",{page:"OPEX",version:id});
  for(const line of fixtures.planner.lines){
    const lineId=key("planner:"+line.id);
    if(forms(screen,"OPEX","save",lineId).length)continue;
    await command("Daniel","planner","OPEX","save",lineId,0,{versionId:id,collection:"lines",name:line.description,el:line.element,cur:line.currency,annual:line.budgetAnnual,f0:line.forecastJanuary});
    screen=await html("Daniel","planner",{page:"OPEX",version:id});
    demand(forms(screen,"OPEX","save",lineId).length>0,"planner-line-not-observed:"+line.id);
  }
  status("planner","READY","real version + 7 deterministic OPEX budget/forecast lines; EUR unresolved");
}

/** Original Dashboard domain: OPEX Detail and CAPEX Projects are canonical producers
 * consumed by native U39 (CAP04) and U40 (CAP05). The legacy HTML is only read
 * for CAS versions and producer-issued IDs; writes are product commands.
 */
async function doDashboard(){
  const configured=[
    {page:"OPEX Detail",prefix:"DEMO-OPEX-",lines:org.departments.map(d=>({name:"FLA-DEMO "+d.name,budget:d.annualBudgetBRL,monthly:d.monthForecastBRL[0]}))},
    {page:"CAPEX Projects",prefix:"DEMO-CAPEX-",lines:org.costCenters.filter(c=>c.id.endsWith("-02")).map(c=>({name:"FLA-DEMO CAPEX "+c.label,budget:c.annualBudgetBRL,monthly:Math.round(c.annualForecastBRL/12)}))}
  ];
  for(const group of configured){
    let content=await html("Daniel","dashboard",{page:group.page,year:2026});
    for(const line of group.lines){
      // Legacy save has producer-generated IDs; match the exact visible heading,
      // then ask that same authorized page for the current row ID and CAS version.
      function ownerSection(markup){
        const head="<section><h2>"+line.name.replace(/&/g,"&amp;")+"</h2>";
        const at=markup.indexOf(head);
        if(at<0)return null;
        const end=markup.indexOf("</section>",at+head.length);
        demand(end>at,"dashboard-owner-section-not-closed");
        return markup.slice(at,end);
      }
      let section=ownerSection(content);
      if(section===null){
        const form=findForm(content,group.page,"save","");
        await command("Daniel","dashboard",group.page,"save",undefined,form.version,{name:line.name,budget:line.budget});
        content=await html("Daniel","dashboard",{page:group.page,year:2026});
        section=ownerSection(content);
        demand(section!==null,"dashboard-owner-readback-missing:"+line.name);
      }
      const owners=forms(section,group.page,"save").filter(x=>x.id);
      demand(owners.length===1,"dashboard-producer-owner-ID-ambiguous:"+line.name);
      // One real monthly entry per cost owner; unseeded months remain missing,
      // not fabricated as historical actuals.
      const january=forms(section,group.page,"save-entry").filter(f=>f.content.includes('name="month" type="number" value="1"'));
      demand(january.length===1,"dashboard-month-form-missing:"+line.name);
      if(!january[0].id){
        const field=group.page==="CAPEX Projects"?"projId":"ownerId";
        await command("Daniel","dashboard",group.page,"save-entry",undefined,january[0].version,{[field]:owners[0].id,year:2026,month:1,budget:Math.round(line.budget/12),forecast:line.monthly});
        content=await html("Daniel","dashboard",{page:group.page,year:2026});
        section=ownerSection(content);
        demand(section!==null&&forms(section,group.page,"save-entry").some(f=>!!f.id&&f.content.includes('name="month" type="number" value="1"')),"dashboard-month-entry-not-persisted");
      }
      status("dashboard","READY",group.page+" producer row and January entry: "+line.name);
    }
  }
}

async function fileWorkbook(){
  const require=createRequire(new URL("../../../modules/sucafina/package.json",import.meta.url));
  const {Workbook}=require("exceljs"),book=new Workbook();
  book.creator="FLA-DEMO";book.created=new Date("2026-01-01T00:00:00Z");book.modified=new Date("2026-01-01T00:00:00Z");
  const sheet=book.addWorksheet("OPEX");sheet.addRow(["Line ID","Cost element","Vendor / item","Currency","Measure","Jan"]);
  for(const l of fixtures.planner.lines)sheet.addRow([key("planner:"+l.id),l.element==="licenses"?"Licenses":"Services",l.description,l.currency,"Forecast",l.forecastJanuary]);
  return new Uint8Array(await book.xlsx.writeBuffer());
}
async function doImports(){
  const targets=await discovery("Daniel","planner","import-targets",{surface:"planner",start:"2026-01-01",end:"2026-12-31"});
  demand(Array.isArray(targets),"real-import-targets-unavailable");
  const selection=process.env.SF_DEMO_PLANNER_SELECTION_REF;
  const candidates=targets.filter(t=>t.surface==="planner"&&Array.isArray(t.formats)&&t.formats.includes("xlsx")&&(selection?t.selectionRef===selection:String(t.label).includes(fixtures.planner.versionName)&&(!t.sheet||t.sheet==="OPEX")));
  demand(candidates.length===1,"operator-must-select-real-planner-import-target");
  const target=candidates[0],bytes=await fileWorkbook(),options={newVersion:false,removeMissing:false,preview:{sheet:"OPEX"}};
  const form=new FormData();form.set("file",new Blob([bytes],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),"flamengo-opex-2026.xlsx");form.set("surface","planner");form.set("selectionRef",target.selectionRef);form.set("options",JSON.stringify(options));
  const intent="import:planner:"+target.selectionRef+":"+hash(bytes);
  const admitted=(await transport("Daniel","planner","import-admit",form,intent+":admit",true)).value;
  demand(typeof admitted?.ref==="string","no-admitted-file-ref");
  const preview=(await transport("Daniel","planner","import-preview",{admittedFileRef:admitted.ref,format:"xlsx",options:options.preview},intent+":preview")).value;
  demand(preview?.state==="preview"&&preview.domainApplied===false&&!preview.issues?.length,"preview-nonmutating-and-clean-required");
  const details=await discovery("Daniel","planner","import-detail",{manifestId:preview.id,version:preview.version});
  demand(Array.isArray(details?.detail?.changes),"no-producer-preview-changes");
  const applied=(await transport("Daniel","planner","import-apply",{manifestId:preview.id,version:preview.version},intent+":apply")).value;
  demand(applied?.domainApplied===true&&applied.state==="applied","explicit-import-apply-not-proven");
  const receipt=await discovery("Daniel","planner","import-detail",{manifestId:applied.id,version:applied.version});
  demand(receipt?.receipt,"durable-import-receipt-missing");
  status("imports","READY","real admitted XLSX, pure preview, reviewed Apply and durable detail receipt");
}
async function doDecisions(){
  for(const d of fixtures.decisions.cases){
    const pre=await html("Daniel","dashboard",{sf:"workbench"});
    if(pre.includes(d.objective))continue;
    const cmd={operation:"sf_case_draft",input:{objective:d.objective,horizon:d.horizon,currency:d.currency,criteria:d.criteria,sourceRefs:[]}};
    const scopes=[...pre.matchAll(/data-creation-scope="([a-f0-9]{64})"/g)].map(m=>m[1]);
    demand(scopes.length===1,"real-case-creation-scope-missing-or-ambiguous");
    const result=await wire("Daniel",location("dashboard",{sf:"workbench-command"}),{
      method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":key("decision:"+d.id),"X-SF-Creation-Scope":scopes[0]},body:JSON.stringify(cmd)
    });
    demand(result.status==="ok"&&typeof result.outputRef==="string"&&result.outputRef.startsWith("case:"),"authorized-case-creation-not-confirmed");
    demand((await html("Daniel","dashboard",{sf:"workbench"})).includes(d.objective),"created-decision-readback-missing");
  }
  status("decisions","PENDING","real draft cases may be seeded; human alternative authoring/sensitivities and approval must run in installed UI");
}
async function doReports(){
  const r=fixtures.reports[0],u=location("dashboard",{download:"docx",year:r.year,title:r.title,topic:"Executive Dashboard"});
  const file=await wire("Daniel",u,{kind:"bytes"});
  demand(file.ct.includes("wordprocessingml.document")&&file.bytes.length>1000,"real-docx-output-unavailable");
  status("reports","READY","real DOCX download verified bytes="+file.bytes.length+" sha256="+hash(file.bytes));
}
async function doDenial(){
  for(const surf of fixtures.denial.probes){
    const response=await fetch(location(surf),{headers:{Cookie:session("Zico"),Origin:origin},redirect:"manual",signal:AbortSignal.timeout(20000)});
    demand(response.status===403,"authenticated-Zico-must-be-403:"+surf+" got="+response.status);
    const text=await response.text();
    demand(!text.includes("[FLA-DEMO/2026]"),"denied-page-private-record-leak");
    status("denial","READY","Zico session "+surf+" -> HTTP 403 (real product)");
  }
}
async function doSchedules(){
  // createSfWorkbenchHttp exposes sf=workbench-routine (read), NOT schedule-create.
  // The real schedules.create requires a trusted UI binding and real recipeRef/conditionRef.
  status("schedules","PENDING","native schedule admission/recipe/condition/owner not provisioned; never invent an HTTP endpoint");
}
const steps={settings:doSettings,suppliers:doSuppliers,procurement:doProcurement,planner:doPlanner,dashboard:doDashboard,imports:doImports,decisions:doDecisions,reports:doReports,denial:doDenial,schedules:doSchedules};
if(!apply)for(const phase of phases)status(phase,"PENDING","dry-run only; no network or execution proof");
else {
  demand(process.env.SF_DEMO_ISOLATED_INSTALLATION==="yes","SF_DEMO_ISOLATED_INSTALLATION=yes required");
  const root=process.env.SF_DEMO_BASE_URL;demand(root,"SF_DEMO_BASE_URL missing");
  const parsed=new URL(root);
  demand(parsed.pathname.endsWith("/sucafina")&&!parsed.search&&!parsed.hash&&!parsed.username&&!parsed.password,"exact existing /sucafina mount required");
  demand(parsed.hostname===process.env.SF_DEMO_ALLOW_HOST,"exact host allowlist required");
  demand(parsed.protocol==="https:"||parsed.protocol==="http:"&&["127.0.0.1","localhost","[::1]"].includes(parsed.hostname),"secure transport required for real cookies");
  origin=parsed.origin;mount=parsed.pathname;
  for(const phase of phases)try{await steps[phase]();if(!report.checks.some(x=>x.phase===phase))status(phase,"READY","real product flow completed");}
  catch(e){status(phase,"PENDING","fail-closed: "+String(e.message||e));if(strict)break;}
}
report.status=report.checks.every(x=>x.state==="READY")?"READY":"PENDING";
console.log(JSON.stringify(report,null,2));
if(apply&&report.status==="PENDING")process.exitCode=2;
