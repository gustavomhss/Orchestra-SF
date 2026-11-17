#!/usr/bin/env node
/** Pure offline fixture validation. Never contacts tenant or executes product flow. */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const here=new URL(".",import.meta.url);
const files=await Promise.all(["org.json","catalog.json","scenarios.json"].map(async n=>JSON.parse(await readFile(new URL(n,here),"utf8"))));
const [org,cat,sc]=files;
const fail=(text)=>{throw new Error("FLA-DEMO-INVALID:"+text)};
const assert=(ok,text)=>{if(!ok)fail(text)};
const distinct=(arr)=>new Set(arr).size===arr.length;
const sum=(list)=>list.reduce((a,b)=>a+b,0);
assert(org.schema==="sf-demo-flamengo-org-v1" && cat.schema==="sf-demo-flamengo-catalog-v1" && sc.schema==="sf-demo-flamengo-scenarios-v1","schema");
assert(org.synthetic===true&&cat.synthetic===true&&sc.synthetic===true&&org.realData===false,"data-origin");
assert(org.directorates.length===3&&org.departments.length===6&&org.costCenters.length===12,"hierarchy-count");
assert(distinct(org.directorates.map(x=>x.id))&&distinct(org.departments.map(x=>x.id))&&distinct(org.costCenters.map(x=>x.id)),"duplicate-hierarchy-id");
const directorates=new Set(org.directorates.map(x=>x.id)),departments=new Set(org.departments.map(x=>x.id)),costs=new Set(org.costCenters.map(x=>x.id));
for(const d of org.departments){
  assert(directorates.has(d.parent)&&d.monthBudgetBRL.length===12&&d.monthForecastBRL.length===12,"department-parent-or-month");
  assert(sum(d.monthBudgetBRL)===d.annualBudgetBRL&&sum(d.monthForecastBRL)===d.annualForecastBRL,"month-sum");
  const cs=org.costCenters.filter(x=>x.department===d.id);assert(cs.length===2,"department-needs-two-cost-centres");
  assert(sum(cs.map(x=>x.annualBudgetBRL))===d.annualBudgetBRL,"cost-budget-rollup");
  assert(sum(cs.map(x=>x.annualForecastBRL))===d.annualForecastBRL,"cost-forecast-rollup");
}
for(const c of org.costCenters)assert(departments.has(c.department),"orphan-cost:"+c.id);
assert(org.actors.map(x=>x.key).join(",")==="Daniel,Caio,Pedro,Gabriel,Sofie,Zico","actors");
assert(org.actors.every(x=>x.tenantPrincipalRef===null && x.identitySource==="real-tenant-session"),"fake-principal-ref");
assert(["dashboard","planner","procurement"].every(x=>org.actors.find(a=>a.key==="Zico").roleBySurface[x].length===0),"Zico-unguarded");
assert(cat.categories.length===5&&cat.suppliers.length===10&&cat.contracts.length===10,"catalog-count");
assert(distinct(cat.suppliers.map(x=>x.id))&&distinct(cat.contracts.map(x=>x.id)),"duplicate-supplier-contract");
const sup=new Set(cat.suppliers.map(x=>x.id));
for(const contract of cat.contracts)assert(sup.has(contract.supplierId)&&contract.start<=contract.end,"orphan-or-expired-contract:"+contract.id);
assert(cat.suppliers.every(x=>x.notRealEntity===true&&x.registeredTaxId===null&&x.contactEmail===null&&x.bankDetails===null),"no-person-or-bank-data");
assert(cat.fxRates.pending.some(x=>x.currency==="EUR")&&sc.planner.lines.some(x=>x.currency==="EUR"),"FX-missing-counterexample");
assert(sc.procurement.requests.length===10&&distinct(sc.procurement.requests.map(x=>x.id))&&distinct(sc.procurement.requests.map(x=>x.title)),"request-count-or-duplication");
for(const req of sc.procurement.requests)assert(costs.has(req.costCenter)&&departments.has(req.department)&&req.title.startsWith("[FLA-DEMO/2026]"),"request-foreign-key:"+req.id);
const statuses=new Set(sc.procurement.requests.map(x=>x.stageTarget));
for(const stage of ["draft","pr_pending","sourcing","src_pending","po_draft","po_pending","po_approved","pr_rejected"])assert(statuses.has(stage),"stage-not-covered:"+stage);
assert(sc.procurement.requests.some(x=>x.id==="PR-FX-MISSING")&&sc.procurement.requests.some(x=>x.id==="PR-REVISION"),"negative-fixtures");
assert(sc.decisions.cases.length===2&&sc.decisions.cases.every(x=>x.alternatives.length>=2&&x.sensitivity.length>=1),"alternatives-sensitivity");
assert(sc.reports.length>=1&&sc.imports.length>=1&&sc.schedules.length===2,"reports-imports-schedules");
assert(sc.denial.expectedHttpStatus===403&&sc.denial.probes.join(",")==="dashboard,planner,procurement","denial");
const scenarios=new Set(sc.matrix.map(x=>x.id));
assert(distinct(sc.matrix.map(x=>x.id)),"duplicate-scenario");
for(const s of sc.matrix)assert(s.status==="PENDING"&&typeof s.reason==="string"&&s.reason.length>0,"unexecuted-claim:"+s.id);
for(const id of ["DASH-OPS","DASH-CAPEX","PLN-FX","PROC-FX-MISSING","IMPORT-PLANNER","DECISIONS","REPORT-DRILLDOWN","SCHEDULE-DIGEST","ZICO-DENIED"])assert(scenarios.has(id),"scenario-uncovered:"+id);
const sha256=createHash("sha256").update(files.map(x=>JSON.stringify(x)).join("\n")).digest("hex");
console.log(JSON.stringify({status:"FIXTURE_VALID_ONLY",fixture:org.fixture,sha256,counts:{directors:3,departments:6,costCenters:12,suppliers:10,contracts:10,requests:10,scenarios:sc.matrix.length},proofs:"PENDING — no tenant/CI/F04/AM run"},null,2));
