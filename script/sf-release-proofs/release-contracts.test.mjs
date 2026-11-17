import { test } from "node:test"
import assert from "node:assert/strict"
import { generateKeyPairSync, sign } from "node:crypto"
import {
  CI_JOB_IDS, CI_RECIPE_IDS, PROOF_IDS, AZURE_IDS, sha256,
  assertFactoryReceipt, validateSignedBundleStructure,
  verifyOwnerDetachedSignature,
} from "./release-contracts.mjs"

// STATIC NEGATIVE TEST DATA ONLY: never an installed principal, grant, fixture
// for F04 or evidence of an Azure, Entra, Task/Relay or business transaction.
const C="a".repeat(40), TREE="b".repeat(40)
const H="c".repeat(64), ART="d".repeat(64), MAN="e".repeat(64)
const CTX={candidateSha:C,treeSha:TREE,artifactSha256:ART,manifestSha256:MAN}
const OWNER="Daniel França"
function factoryReceipt() {
  return {
    schema:"sf-factory-package-proof-v1",sourceSHA:C,checkoutSHA:C,
    expectedSourceSHA:C,workflowSHA:C,eventName:"push",
    runID:"101",runAttempt:"1",version:"1.18.27",target:"linux-x64-baseline",
    archiveFile:"orchestra-sf-factory-linux-x64-baseline.tar.gz",
    archiveSha256:H,manifestSha256:H,bundleSha256:H,
    compilerInputCount:750,assetCount:24,
    checkedEndpoint:"/sucafina/status",status:200,
    origin:"http://localhost:4110",extractedOutsideCheckout:true,
  }
}
function bundle(){
  const releaseRoot="/opt/orchestra-sf/releases/"+C
  return {
    schema:"sf2h.f04-am-go-no-go.v1",
    candidateSha:C,treeSha:TREE,artifactSha256:ART,
    installedArtifactSha256:ART,manifestSha256:MAN,
    distribution:{
      cli:{
        artifactName:"orchestra-sf-linux-"+C,runId:100,attempt:1,
        sourceSHA:C,checkoutSHA:C,selectedRevision:C,
        archiveFile:"orchestra-sf-linux-x64-baseline.tar.gz",
        archiveSha256:H,binarySha256:H,buildReceiptSha256:H,
      },
      factory:{
        artifactName:"sf-factory-package-101-1-"+C,runId:101,attempt:1,
        githubRunHeadSha:C,sourceSHA:C,checkoutSHA:C,expectedSourceSHA:C,
        archiveFile:"orchestra-sf-factory-linux-x64-baseline.tar.gz",
        archiveSha256:H,manifestSha256:H,bundleSha256:H,
        factoryReceiptSha256:H,githubRunSnapshotSha256:H,
        extractedOutsideCheckout:true,
      },
      installed:{
        sourceSha:C,artifactSha256:ART,releaseRoot,
        binaryPath:releaseRoot+"/bin/orchestra",
        factoryPath:releaseRoot+"/factory/installation.mjs",
        policyRoot:releaseRoot+"/product/ai",
        webRoot:releaseRoot+"/web",cliBinarySha256:H,factoryBundleSha256:H,
        policyAssetCount:24,installationReceiptSha256:H,
      },
    },
    ci:{
      candidateSha:C,checkoutSha:C,effectiveGithubSha:C,
      runId:103,attempt:1,verify:"success",
      jobs:CI_JOB_IDS.map((id,i)=>({
        id,jobId:1000+i,runId:103,attempt:1,
        sourceSha:C,checkoutSha:C,conclusion:"success",
        artifactOrLogSha256:H,
      })),
      recipeReceipts:CI_RECIPE_IDS.map(id=>({
        id,sha256:H,receipt:{
          schemaVersion:1,suiteId:id,
          kind:id.includes("CI-UI-")?"playwright":"bun",status:"PASS",
          exitCode:0,sourceSha:C,checkoutSha:C,runId:"103",attempt:"1",
          runnerOS:"Linux",runnerArch:"X64",executedTests:3,reportSha256:H,
        },
      })),
    },
    proofs:PROOF_IDS.map(id=>({
      id,status:"PASS_REVIEWED",independentReviewRef:"review-ref",
      processReceiptSha256:H,originalProducerObservationSha256:H,
    })),
    azure:AZURE_IDS.map(id=>({
      id,status:"PASS_REVIEWED",candidateSha:C,artifactSha256:ART,
      immutableEvidenceSha256:H,independentReviewRef:"review-ref",
    })),
    reviews:[1,2,3].map(n=>({
      personId:"independent-reviewer-"+n,
      reviewRef:"review-"+n+"-reference",signedReviewSha256:H,
      disposition:"APPROVE",
    })),
    owner:{
      personId:OWNER,decision:"GO",approvalRef:"owner-approval-reference",
      approvedUtc:"2026-11-16T23:00:00Z",
    },
  }
}

test("complete structural fixture is only a structural admission, never live F04 PASS",()=>{
  assert.equal(validateSignedBundleStructure(bundle(),CTX,OWNER),true)
  assert.equal(assertFactoryReceipt(factoryReceipt(),C,C),true)
})
test("factory receipt SHA != GitHub head C is rejected (regression for 43988598685)",()=>{
  const receipt=factoryReceipt()
  const runHead="55a366a8920affff20adb18dd8ff32402952db29"
  receipt.sourceSHA="6d1ff11e018d9cca6cee82baa6a4af9cf29b4fed"
  receipt.checkoutSHA=receipt.sourceSHA
  receipt.expectedSourceSHA=receipt.sourceSHA
  assert.throws(()=>assertFactoryReceipt(receipt,runHead,runHead),
    /F04_FACTORY_SOURCE_CHECKOUT_EXPECTED_SHA_MISMATCH/)
})
test("factory source/checkout/expected source have to equal frozen C",()=>{
  for(const key of ["sourceSHA","checkoutSHA","expectedSourceSHA"]){
    const receipt=factoryReceipt()
    receipt[key]="f".repeat(40)
    assert.throws(()=>assertFactoryReceipt(receipt,C,C),
      /F04_FACTORY_SOURCE_CHECKOUT_EXPECTED_SHA_MISMATCH/)
  }
  assert.throws(()=>assertFactoryReceipt(factoryReceipt(),C,"f".repeat(40)),
    /F04_FACTORY_GITHUB_HEAD_SHA_NOT_C/)
})
test("mismatched CI source/checkout receipt or job SHA is rejected",()=>{
  for(const key of ["sourceSha","checkoutSha"]){
    const b=bundle()
    b.ci.recipeReceipts[0].receipt[key]="f".repeat(40)
    assert.throws(()=>validateSignedBundleStructure(b,CTX,OWNER),
      /F04_GATE_EIGHT_CI_RECIPE_SOURCE_OR_COVERAGE_MISMATCH/)
    const c=bundle()
    c.ci.jobs[0][key]="f".repeat(40)
    assert.throws(()=>validateSignedBundleStructure(c,CTX,OWNER),
      /F04_GATE_CI_JOB_NOT_QUALIFIED/)
  }
})
test("distribution summary source SHA and run head mismatch are rejected",()=>{
  for(const kind of ["cli","factory"]){
    const b=bundle()
    b.distribution[kind].sourceSHA="f".repeat(40)
    assert.throws(()=>validateSignedBundleStructure(b,CTX,OWNER),/F04_GATE_/)
  }
  const b=bundle()
  b.distribution.factory.githubRunHeadSha="f".repeat(40)
  assert.throws(()=>validateSignedBundleStructure(b,CTX,OWNER),
    /F04_GATE_FACTORY_ARCHIVE_SOURCE_OR_HEAD_MISMATCH/)
})
test("invalid or altered owner detached Ed25519 signature fails",()=>{
  const {privateKey,publicKey}=generateKeyPairSync("ed25519")
  const pem=publicKey.export({format:"pem",type:"spki"})
  const bytes=Buffer.from(JSON.stringify(bundle(),null,2)+"\n")
  const signature=sign(null,bytes,privateKey).toString("base64")
  assert.equal(verifyOwnerDetachedSignature(bytes,signature,pem,sha256(pem)),true)
  assert.throws(()=>verifyOwnerDetachedSignature(Buffer.concat([bytes,Buffer.from(" ")]),
    signature,pem,sha256(pem)),/F04_GATE_OWNER_SIGNATURE_INVALID/)
  const corrupted=(signature[0]==="A"?"B":"A")+signature.slice(1)
  assert.throws(()=>verifyOwnerDetachedSignature(bytes,
    corrupted,pem,sha256(pem)),/F04_GATE_OWNER_SIGNATURE_INVALID/)
  assert.throws(()=>verifyOwnerDetachedSignature(bytes,
    signature,pem,"0".repeat(64)),/F04_GATE_OWNER_PIN_MISMATCH/)
})
test("reviewer equal owner is rejected even with three distinct reviewer ids",()=>{
  const b=bundle()
  b.reviews[0].personId=OWNER
  assert.throws(()=>validateSignedBundleStructure(b,CTX,OWNER),
    /F04_GATE_EXPLICIT_SEPARATE_HUMAN_OWNER_GO_REQUIRED/)
})
test("missing CI job or recipe blocks go-no-go",()=>{
  const b=bundle()
  b.ci.jobs.pop()
  assert.throws(()=>validateSignedBundleStructure(b,CTX,OWNER),
    /F04_GATE_MANDATORY_MEMBER_SET_INCOMPLETE/)
  const c=bundle()
  c.ci.recipeReceipts.pop()
  assert.throws(()=>validateSignedBundleStructure(c,CTX,OWNER),
    /F04_GATE_MANDATORY_MEMBER_SET_INCOMPLETE/)
})
test("missing proof or Azure witness blocks go-no-go",()=>{
  const b=bundle()
  b.proofs.pop()
  assert.throws(()=>validateSignedBundleStructure(b,CTX,OWNER),
    /F04_GATE_MANDATORY_MEMBER_SET_INCOMPLETE/)
  const c=bundle()
  c.azure.pop()
  assert.throws(()=>validateSignedBundleStructure(c,CTX,OWNER),
    /F04_GATE_MANDATORY_MEMBER_SET_INCOMPLETE/)
})
test("non-GO owner or a different out-of-band owner identity fails",()=>{
  const b=bundle()
  b.owner.decision="NO_GO"
  assert.throws(()=>validateSignedBundleStructure(b,CTX,OWNER),
    /F04_GATE_EXPLICIT_SEPARATE_HUMAN_OWNER_GO_REQUIRED/)
  const c=bundle()
  assert.throws(()=>validateSignedBundleStructure(c,CTX,"someone-else"),
    /F04_GATE_EXPLICIT_SEPARATE_HUMAN_OWNER_GO_REQUIRED/)
})
