#!/usr/bin/env node
"use strict";
// A8/AZ-02 owner-operated proof. Node >=20, standard library only.
// Never sends credentials off the configured origin; never prints secrets/PII.
const fs=require("node:fs"), path=require("node:path"), https=require("node:https");
const {URL,URLSearchParams}=require("node:url");
const argv=process.argv.slice(2), phase=arg("phase");
const cases=[]; let c,origin,mount;
function arg(k){const n=argv.indexOf("--"+k);return n<0?undefined:argv[n+1]}
function has(k){return argv.includes("--"+k)}
function assert(p,k){if(!p)throw Error(k)}
function privateRead(f,max=131072){
  assert(typeof f==="string"&&path.isAbsolute(f)&&path.normalize(f)===f,"PRIVATE_PATH_REQUIRED");
  const d=path.dirname(f),ds=fs.lstatSync(d),s=fs.lstatSync(f);
  assert(ds.isDirectory()&&!ds.isSymbolicLink()&&(ds.mode&0o077)===0&&ds.uid===process.getuid()&&fs.realpathSync(d)===d,"PRIVATE_0700_REQUIRED");
  assert(s.isFile()&&!s.isSymbolicLink()&&(s.mode&0o077)===0&&s.uid===process.getuid()&&s.nlink===1&&s.size>0&&s.size<=max&&fs.realpathSync(f)===f,"PRIVATE_0600_REQUIRED");
  return fs.readFileSync(f,"utf8");
}
function cookie(role){
  const raw=privateRead(c.actorCookies?.[role],4096).trim();
  assert(/^__Secure-sucafina_[a-f0-9]{12}_session=[a-f0-9]{64}$/.test(raw),"INVALID_ACTOR_COOKIE");
  return raw;
}
function validate(){
  assert(["preflight","actors","producer","after-revoke","logout","after-restart"].includes(phase),"PHASE_REQUIRED");
  assert(process.platform==="linux"&&process.arch==="x64"&&typeof process.getuid==="function","LINUX_X64_REQUIRED");
  c=JSON.parse(privateRead(arg("config")));
  const u=new URL(c.origin);
  assert(u.protocol==="https:"&&u.origin===c.origin&&!u.port&&!u.username&&!u.password&&
    u.hostname.includes(".")&&!u.hostname.endsWith(".local")&&!u.hostname.endsWith(".localhost")&&
    !/^[0-9.]+$/.test(u.hostname),"PUBLIC_HTTPS_ORIGIN_REQUIRED");
  origin=u.origin;
  assert(/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(c.mount),"MOUNT_REQUIRED");mount=c.mount;
  const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
  assert(uuid.test(c.tenantId)&&uuid.test(c.clientId),"TENANT_APP_IDS_REQUIRED");
  for(const key of ["installationId","projectId","hostId"])
    assert(typeof c[key]==="string"&&/^[A-Za-z0-9._:-]{8,128}$/.test(c[key]),"INSTALLED_BINDING_REQUIRED");
  assert(/^[a-f0-9]{40}$/i.test(c.candidateSha)&&/^[a-f0-9]{64}$/i.test(c.artifactSha256)&&
    Number.isSafeInteger(c.runId)&&c.runId>0&&Number.isSafeInteger(c.runAttempt)&&c.runAttempt>0,"CANDIDATE_RECEIPT_REQUIRED");
}
function url(p){
  const u=new URL(origin+p);
  assert(u.origin===origin&&!u.username&&!u.password&&!u.hash&&u.pathname.startsWith(mount+"/"),"UNTRUSTED_DESTINATION");
  return u;
}
function send(method,p,headers={},body){
  const u=url(p);
  return new Promise((resolve,reject)=>{
    const req=https.request(u,{method,headers:{"Accept":"application/json",...headers},timeout:15000,maxHeaderSize:16384},res=>{
      const parts=[];let length=0;
      res.on("data",chunk=>{length+=chunk.length;if(length>8388608)req.destroy(Error("RESPONSE_LIMIT"));else parts.push(chunk)});
      res.on("end",()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(parts).toString("utf8")}));
      res.on("error",reject);
    });
    req.on("timeout",()=>req.destroy(Error("TIMEOUT")));req.on("error",reject);req.end(body);
  });
}
function data(r){if(!/^application\/json(?:\s*;|$)/i.test(String(r.headers["content-type"]||"")))return null;try{return JSON.parse(r.body)}catch{return null}}
function safe(r){return /\bno-store\b/i.test(String(r.headers["cache-control"]||""))&&
  (!r.headers["access-control-allow-origin"]||r.headers["access-control-allow-origin"]===origin)}
function is(r,status,shape){return status.includes(r.status)&&safe(r)&&(!shape||shape.includes(data(r)?.status))}
function csrfDeny(r){return r.status===403&&
  (!r.headers["access-control-allow-origin"]||r.headers["access-control-allow-origin"]===origin)}

function qp(changes={}){
  return new URLSearchParams({installationId:c.installationId,projectId:c.projectId,hostId:c.hostId,...changes}).toString()
}
function ctx(changes={}){return mount+"/api/ui/context?"+qp(changes)}
function stampOk(r){
  const v=data(r)?.value,s=v?.stamp;
  return is(r,[200])&&data(r)?.status==="ok"&&v?.authMode==="microsoft"&&
    v?.contractRevision==="sf-native-ui/1"&&s?.installationId===c.installationId&&
    s?.projectId===c.projectId&&s?.hostId===c.hostId&&
    ["principalRef","policyVersion","accessRevision"].every(k=>typeof s?.[k]==="string"&&s[k].length>0)&&
    Boolean(r.headers["x-sf-contract-revision"])&&Boolean(r.headers["x-sf-access-revision"]);
}
async function check(id,expected,fn){
  try{const r=await fn();cases.push({id,expected,observed:r.status??"CHECK",result:r.ok?"PASS":"FAIL"})}
  catch{cases.push({id,expected,observed:"ERROR",result:"FAIL"})}
}
function changed(x){return (x[0]==="a"?"b":"a")+x.slice(1)}
async function preflight(){
  await check("GUEST","401|403 JSON",async()=>{const r=await send("GET",ctx());return{status:r.status,ok:is(r,[401,403],["unauthenticated","denied"])}});
  await check("MISSING_SELECTORS","400",async()=>{const r=await send("GET",mount+"/api/ui/context");return{status:r.status,ok:is(r,[400])&&/^application\/json/i.test(String(r.headers["content-type"]))}});
  await check("DUPLICATE_SELECTOR","400",async()=>{const r=await send("GET",ctx()+"&projectId="+encodeURIComponent(c.projectId));return{status:r.status,ok:is(r,[400])}});
  for(const key of ["installationId","projectId","hostId"])
    await check("BIND_"+key,"409 contract-mismatch",async()=>{const r=await send("GET",ctx({[key]:changed(c[key])}));return{status:r.status,ok:is(r,[409],["unavailable"])&&data(r)?.reason==="contract-mismatch"}});
  await check("CROSS_ORIGIN_GET","400",async()=>{const r=await send("GET",ctx(),{"Origin":"https://unauthorized.invalid"});return{status:r.status,ok:is(r,[400])}});
  await check("CROSS_SITE_GET","400",async()=>{const r=await send("GET",ctx(),{"Sec-Fetch-Site":"cross-site"});return{status:r.status,ok:is(r,[400])}});
  for(const [id,h] of [["NO_ORIGIN",{}],["OTHER_ORIGIN",{"Origin":"https://unauthorized.invalid"}],["CROSS_SITE",{"Origin":origin,"Sec-Fetch-Site":"cross-site"}]])
    await check("CSRF_"+id,"403",async()=>{const r=await send("POST",mount+"/auth/logout",h);return{status:r.status,ok:csrfDeny(r)}});
  await check("OIDC_REDIRECT","303 confidential code+PKCE S256; secure login cookie",async()=>{
    const r=await send("GET",mount+"/auth/login");
    const u=new URL(String(r.headers.location||"https://invalid.invalid/")),q=u.searchParams;
    const required=["client_id","response_type","response_mode","redirect_uri","scope","state","nonce","code_challenge","code_challenge_method"];
    const scopes=new Set((q.get("scope")||"").split(/\s+/).filter(Boolean));
    const good=u.origin==="https://login.microsoftonline.com"&&
      u.pathname.toLowerCase()==="/"+c.tenantId.toLowerCase()+"/oauth2/v2.0/authorize"&&
      q.get("client_id")?.toLowerCase()===c.clientId.toLowerCase()&&
      q.get("redirect_uri")===origin+mount+"/auth/callback"&&
      q.get("response_type")==="code"&&q.get("response_mode")==="query"&&
      q.get("code_challenge_method")==="S256"&&/^[A-Za-z0-9_-]{43}$/.test(q.get("code_challenge")||"")&&
      /^[a-f0-9]{64}$/.test(q.get("state")||"")&&/^[a-f0-9]{64}$/.test(q.get("nonce")||"")&&
      scopes.size===4&&["openid","profile","offline_access","User.Read"].every(s=>scopes.has(s))&&
      required.every(s=>q.getAll(s).length===1);
    const cookie=(r.headers["set-cookie"]||[]).find(s=>/^__Secure-sucafina_[a-f0-9]{12}_login=/.test(s));
    const attrs=cookie?.split(";").map(s=>s.trim().toLowerCase())||[];
    const secure=Boolean(cookie)&&/^[a-f0-9]{64}$/.test(cookie.split(";")[0].split("=")[1]||"")&&
      ["secure","httponly","samesite=lax","path="+mount.toLowerCase()].every(x=>attrs.includes(x))&&
      !attrs.some(x=>x.startsWith("domain="));
    return{status:r.status,ok:r.status===303&&good&&secure&&safe(r)}
  });
  await check("CALLBACK_WITHOUT_CHALLENGE","403",async()=>{const r=await send("GET",mount+"/auth/callback?state="+("a".repeat(64))+"&code=bogus");return{status:r.status,ok:is(r,[403])}});
  await check("CALLBACK_DUPLICATE_STATE","403",async()=>{const s="a".repeat(64),r=await send("GET",mount+"/auth/callback?state="+s+"&state="+s+"&code=bogus");return{status:r.status,ok:is(r,[403])}});
}
async function actors(){
  const okActors=[];
  for(const role of ["requester","holder","denied"]){
    await check("ACTOR_"+role.toUpperCase(),role==="denied"?"401|403":"200 Microsoft stamp",async()=>{
      const raw=cookie(role),r=await send("GET",ctx(),{"Cookie":raw});
      const ok=role==="denied"?is(r,[401,403],["unauthenticated","denied"]):stampOk(r);
      if(ok&&role!=="denied")okActors.push({raw,id:data(r)?.value?.stamp?.principalRef});
      return{status:r.status,ok};
    });
  }
  await check("DISTINCT_ACTORS","distinct sessions and principalRefs",async()=>({ok:okActors.length===2&&
    okActors[0].raw!==okActors[1].raw&&okActors[0].id!==okActors[1].id}));
  for(const [id,h] of [["NO_ORIGIN",{}],["OTHER_ORIGIN",{"Origin":"https://unauthorized.invalid"}],["CROSS_SITE",{"Origin":origin,"Sec-Fetch-Site":"cross-site"}]])
    await check("AUTH_CSRF_"+id,"403, session preserved",async()=>{const r=await send("POST",mount+"/auth/logout",{"Cookie":cookie("requester"),...h});return{status:r.status,ok:csrfDeny(r)}});
}
async function producer(){
  assert(has("confirm-producer-writes")&&c.isolated?.approvedForNegativeWrites===true&&
    typeof c.isolated.requestId==="string"&&c.isolated.requestId.length>0&&
    c.isolated.cas409BodyFile&&c.isolated.validation422BodyFile,"PRODUCER_APPROVAL_REQUIRED");
  const headers={"Cookie":cookie("requester")};
  async function snapshot(){
    const r=await send("GET",mount+"/api/ui/pages/CAP25?request="+encodeURIComponent(c.isolated.requestId),headers),v=data(r);
    const k="requests:"+c.isolated.requestId;
    assert(r.status===200&&v?.status==="ok"&&Object.prototype.hasOwnProperty.call(v.value?.versions||{},k),"SOURCE_SNAPSHOT_REQUIRED");
    const row=v.value.data?.requests?.find(x=>x.number===c.isolated.requestId);
    assert(row,"VISIBLE_SANDBOX_REQUEST_REQUIRED");
    const wireVersion=v.value.versions[k];
    assert(wireVersion&&typeof wireVersion==="object"&&Number.isSafeInteger(wireVersion.version)&&wireVersion.version>=0,"PRODUCER_VERSION_INVALID");
    return{version:wireVersion.version,versionRecord:JSON.stringify(wireVersion),row:JSON.stringify(row)};
  }
  const before=await snapshot();
  for(const [id,file,status] of [["CAS_409",c.isolated.cas409BodyFile,409],["VALIDATION_422",c.isolated.validation422BodyFile,422]])
    await check(id,status+"; same producer version and record",async()=>{
      const payload=JSON.parse(privateRead(file,65536));
      assert(payload?.page==="Requests"&&payload?.action==="save"&&
        payload?.id===c.isolated.requestId&&Number.isSafeInteger(payload.version)&&
        payload.version>=0&&payload.values&&typeof payload.values==="object"&&!Array.isArray(payload.values)&&
        (status===409?payload.version!==before.version:payload.version===before.version),"PRODUCER_BODY_INVALID");
      const r=await send("POST",mount+"/procurement",{"Cookie":headers.Cookie,"Origin":origin,
        "Sec-Fetch-Site":"same-origin","Content-Type":"application/json"},JSON.stringify(payload));
      const after=await snapshot();
      return{status:r.status,ok:r.status===status&&data(r)?.ok===false&&safe(r)&&
        JSON.stringify(before)===JSON.stringify(after)};
    });
}
async function revoked(){
  const h={"Cookie":cookie("requester")};
  await check("REVOKE_CONTEXT","401|403 same session",async()=>{const r=await send("GET",ctx(),h);return{status:r.status,ok:is(r,[401,403],["unauthenticated","denied"])}});
  await check("REVOKE_SOURCE","401|403 same session",async()=>{const r=await send("GET",mount+"/api/ui/pages/CAP25",h);return{status:r.status,ok:is(r,[401,403],["unauthenticated","denied"])}});
}
async function logout(){
  assert(has("confirm-logout"),"LOGOUT_APPROVAL_REQUIRED");
  const h={"Cookie":cookie("requester")};
  await check("LOGOUT_204","204 and two cleared cookies",async()=>{
    const r=await send("POST",mount+"/auth/logout",{"Cookie":h.Cookie,"Origin":origin,"Sec-Fetch-Site":"same-origin"});
    const x=(r.headers["set-cookie"]||[]).filter(s=>/Max-Age=0/i.test(s));
    return{status:r.status,ok:r.status===204&&safe(r)&&x.some(s=>/_login=/.test(s))&&x.some(s=>/_session=/.test(s))};
  });
  await check("REPLAY_AFTER_LOGOUT","401|403 same cookie",async()=>{const r=await send("GET",ctx(),h);return{status:r.status,ok:is(r,[401,403],["unauthenticated","denied"])}});
}
async function restart(){
  assert(arg("restart-receipt"),"A7_RESTART_RECEIPT_REQUIRED");
  const receipt=JSON.parse(privateRead(arg("restart-receipt")));
  assert(receipt.schema==="sf.az02.a7-restart-witness.v1"&&receipt.candidateSha===c.candidateSha&&
    receipt.artifactSha256===c.artifactSha256&&receipt.restartObserved===true&&
    typeof receipt.witness==="string"&&receipt.witness.trim().length>=4,"A7_RESTART_WITNESS_INVALID");
  await check("REPLAY_AFTER_RESTART","401|403 same cookie after A7 witness",async()=>{
    const r=await send("GET",ctx(),{"Cookie":cookie("requester")});
    return{status:r.status,ok:is(r,[401,403],["unauthenticated","denied"])}
  });
}
async function main(){
  try{
    validate();
    if(phase==="preflight")await preflight();
    else if(phase==="actors")await actors();
    else if(phase==="producer")await producer();
    else if(phase==="after-revoke")await revoked();
    else if(phase==="logout")await logout();
    else if(phase==="after-restart")await restart();
    const passed=cases.filter(x=>x.result==="PASS").length,status=cases.length&&passed===cases.length?"PASS":"FAIL";
    const report={schema:"sf.az02.proof.v1",phase,status,candidateSha:c.candidateSha,
      artifactSha256:c.artifactSha256,runId:c.runId,runAttempt:c.runAttempt,
      timestamp:new Date().toISOString(),counts:{total:cases.length,passed,failed:cases.length-passed},
      cases,scope:"Only observed HTTP; independent Entra/VM/release review still required"};
    const output=JSON.stringify(report,null,2)+"\n";
    if(arg("out")){
      const dest=arg("out"),dir=fs.lstatSync(path.dirname(dest));
      assert(path.isAbsolute(dest)&&!fs.existsSync(dest)&&dir.isDirectory()&&
        dir.uid===process.getuid()&&(dir.mode&0o077)===0,"PRIVATE_OUTPUT_PATH_REQUIRED");
      fs.writeFileSync(dest,output,{flag:"wx",mode:0o600});
    }
    process.stdout.write(output);process.exitCode=status==="PASS"?0:1;
  }catch{
    process.stdout.write(JSON.stringify({schema:"sf.az02.proof.v1",phase:phase||"unknown",
      status:"BLOCKED",reason:"OWNER_INPUT_OR_EXECUTION_PRECONDITION_UNMET",
      completedCases:cases.length,scope:"NOT_RUN/PARTIAL; no success inferred"})+"\n");
    process.exitCode=2;
  }
}
main();
