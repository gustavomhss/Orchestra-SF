export function sfDossierWorkbench() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sourcing dossier</title><style>
body{font:16px system-ui;margin:0;background:#f4f6f8;color:#17212b}main{max-width:960px;margin:auto;padding:28px}h1{margin:0 0 12px}fieldset{display:flex;flex-wrap:wrap;gap:12px;border:0;padding:0;margin:20px 0}label{display:grid;gap:6px}input,select,button{font:inherit;padding:10px;border:1px solid #94a3b8;border-radius:6px}button{background:#164e63;color:white;cursor:pointer}button:disabled{opacity:.5}article{background:white;border:1px solid #d7dfe7;border-radius:8px;margin:12px 0;padding:18px}pre{white-space:pre-wrap;overflow-wrap:anywhere}#status{min-height:24px}a{color:#164e63}
</style></head><body><main data-dossier-workbench><h1>Sourcing dossier</h1><p>Review the authorized Request and its current document evidence. Extracted fields remain pending until you confirm them in <a href="?sf=documents">Documents</a>.</p><form id="selection"><fieldset id="controls"><label>Start date<input id="start" type="date" required></label><label>End date<input id="end" type="date" required></label><button id="load" type="submit">Load Requests</button><label for="request">Request</label><select id="request" aria-label="Request" disabled></select><button id="show" type="button" disabled>Show dossier</button></fieldset></form><p id="status" role="status" aria-live="polite"></p><section id="result" aria-label="Dossier"></section></main><script>
const get=(id)=>document.getElementById(id), controls=get("controls"), selection=get("request"), result=get("result"), status=get("status");
const year=new Date().getUTCFullYear();get("start").value=year+"-01-01";get("end").value=year+"-12-31";
const clearSelection=()=>{selection.replaceChildren();selection.disabled=true;get("show").disabled=true;result.replaceChildren();};
const element=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
async function read(mode,params){const url=new URL(location.href);url.search="";url.searchParams.set("sf",mode);for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);const response=await fetch(url,{credentials:"same-origin",cache:"no-store"});const value=await response.json();if(!response.ok||value.status!=="ok")throw new Error("The source or access changed. Reload Requests and review current evidence.");return value.value;}
get("selection").addEventListener("submit",async(event)=>{event.preventDefault();clearSelection();controls.disabled=true;status.textContent="Loading authorized Requests…";try{const entries=await read("sourcing-dossier-requests",{start:get("start").value,end:get("end").value});for(const entry of entries){const option=document.createElement("option");option.value=entry.requestRef;option.textContent=entry.label;selection.append(option);}selection.disabled=!entries.length;get("show").disabled=!entries.length;status.textContent=entries.length?"Select a Request and show its dossier.":"No authorized Requests for this selection.";}catch(error){clearSelection();status.textContent=error.message;}finally{controls.disabled=false;}});
selection.addEventListener("change",()=>{result.replaceChildren();status.textContent="Show the selected Request to read current evidence.";});
for(const id of ["start","end"])get(id).addEventListener("change",()=>{clearSelection();status.textContent="Reload Requests for the new period.";});
get("show").addEventListener("click",async()=>{
  result.replaceChildren();controls.disabled=true;status.textContent="Reading current dossier…";
  try{
    const dossier=await read("sourcing-dossier-read",{requestRef:selection.value});
    const request=document.createElement("article");request.append(element("h2","Request"),element("pre",JSON.stringify(dossier.request.values.map((item)=>({field:item.id,value:item.value})),null,2)));result.append(request);
    for(const entry of dossier.documents){
      const article=document.createElement("article");
      if(!entry.evidence){article.append(element("h2","Evidence unavailable"),element("p","The source is unavailable."));result.append(article);continue;}
      const evidence=entry.evidence, source=await read("document-open",{ref:JSON.stringify(evidence.ref)});
      article.append(element("h2",evidence.fieldCandidate+": "+String(evidence.value)+(evidence.unit?" "+evidence.unit:"")),
        element("p",(entry.state==="confirmed"?"Confirmed evidence":"Pending confirmation")+" · "+evidence.status+" · document revision "+evidence.ref.target.revision),
        element("p","Reference "+evidence.ref.refId+" · "+source.title+" · "+source.location),element("blockquote",source.excerpt));
      if(source.href){const target=new URL(source.href,location.href);if(target.origin!==location.origin||target.pathname!==location.pathname)throw new Error("The source or access changed. Reload Requests and review current evidence.");const link=element("a","Open original");link.href=target.pathname+target.search;article.append(link);}
      result.append(article);
    }
    status.textContent=dossier.documents.length?"Current evidence loaded. This view does not confirm fields or apply changes.":"No current document evidence is available for this Request.";
  }catch(error){clearSelection();status.textContent=error.message;}finally{controls.disabled=false;}
});
</script></body></html>`
}
