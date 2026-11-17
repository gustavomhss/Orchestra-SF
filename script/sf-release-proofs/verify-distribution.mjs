/**
 * A9: validate two REAL Linux distribution producers and the installed mapping.
 * Never extract an archive, execute a binary, create credentials or claim AZ-01.
 * Requires A7's installed immutable root and copied ORIGINAL producer receipts.
 */
import { createReadStream } from "node:fs"
import { lstat, realpath, readFile, readdir } from "node:fs/promises"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import path from "node:path"
import { assertCliBuildReceipt, assertFactoryReceipt, requireProof, sha256 } from "./release-contracts.mjs"

const hex64=/^[0-9a-f]{64}$/
async function ordinaryFile(file, maxSize=512*1024*1024){
  const info=await lstat(file)
  requireProof(info.isFile() && !info.isSymbolicLink() &&
    info.nlink===1 && info.size>0 && info.size<=maxSize &&
    await realpath(file)===file, "F04_DISTRIBUTION_FILE_NOT_REGULAR_OR_LINKED")
  return info
}
async function hashFile(file){
  const before=await ordinaryFile(file)
  const h=createHash("sha256")
  for await(const chunk of createReadStream(file))h.update(chunk)
  const after=await ordinaryFile(file)
  requireProof(before.size===after.size && before.ino===after.ino &&
    before.mtimeMs===after.mtimeMs, "F04_DISTRIBUTION_FILE_CHANGED_DURING_HASH")
  return h.digest("hex")
}
async function privateDirectory(dir){
  const s=await lstat(dir)
  requireProof(s.isDirectory() && !s.isSymbolicLink() &&
    (s.mode & 0o777)===0o700 &&
    (typeof process.getuid!=="function" || s.uid===process.getuid()) &&
    await realpath(dir)===dir,
    "F04_DISTRIBUTION_PRIVATE_DIRECTORY_0700_REQUIRED")
  return dir
}
async function privateBytes(file, dir){
  requireProof(path.dirname(file)===dir && path.resolve(file)===file,
    "F04_DISTRIBUTION_PRIVATE_FILE_OUTSIDE_ROOT")
  const s=await ordinaryFile(file, 4*1024*1024)
  requireProof((s.mode&0o777)===0o600 &&
    (typeof process.getuid!=="function"||s.uid===process.getuid()),
    "F04_DISTRIBUTION_PROOF_FILE_NOT_0600")
  return readFile(file)
}
async function noSymlinkDirTree(root){
  const stack=[root]
  while(stack.length){
    const current=stack.pop()
    const s=await lstat(current)
    requireProof(s.isDirectory() && !s.isSymbolicLink(), "F04_DISTRIBUTION_SYMLINKED_DIR")
    for(const entry of await readdir(current,{withFileTypes:true})){
      const file=path.join(current,entry.name)
      if(entry.isDirectory())stack.push(file)
      else await ordinaryFile(file)
    }
  }
}
function originalGitRoot(){
  try{return path.resolve(execFileSync("git",["rev-parse","--show-toplevel"],{encoding:"utf8"}).trim())}
  catch{throw new Error("F04_RELEASE_CHECKOUT_REQUIRED")}
}
export async function verifyDistributionOnDisk(distribution, ctx, root){
  const d=distribution
  const privateDir=await privateDirectory(path.join(root,"distributions"))
  const cliRaw=await privateBytes(path.join(privateDir,"build-receipt.json"),privateDir)
  const factoryRaw=await privateBytes(path.join(privateDir,"factory-package-receipt.json"),privateDir)
  requireProof(sha256(cliRaw)===d.cli.buildReceiptSha256 &&
    sha256(factoryRaw)===d.factory.factoryReceiptSha256,
    "F04_DISTRIBUTION_RAW_RECEIPT_DIGEST_MISMATCH")
  const cli=JSON.parse(cliRaw.toString("utf8"))
  const factory=JSON.parse(factoryRaw.toString("utf8"))
  const binSha=assertCliBuildReceipt(cli,ctx.candidateSha)
  assertFactoryReceipt(factory,ctx.candidateSha,d.factory.githubRunHeadSha)
  requireProof(cli.archive.sha256===d.cli.archiveSha256 &&
    binSha===d.cli.binarySha256 &&
    factory.archiveSha256===d.factory.archiveSha256 &&
    factory.manifestSha256===d.factory.manifestSha256 &&
    factory.bundleSha256===d.factory.bundleSha256 &&
    Number(factory.runID)===d.factory.runId &&
    Number(factory.runAttempt)===d.factory.attempt &&
    factory.sourceSHA===d.factory.sourceSHA &&
    factory.checkoutSHA===d.factory.checkoutSHA &&
    factory.expectedSourceSHA===d.factory.expectedSourceSHA &&
    d.cli.sourceSHA===cli.sourceSHA && d.cli.checkoutSHA===ctx.candidateSha &&
    d.cli.selectedRevision===ctx.candidateSha,
    "F04_DISTRIBUTION_RECEIPT_SUMMARY_OR_GITHUB_SHA_MISMATCH")
  requireProof(await hashFile(path.join(privateDir,d.cli.archiveFile))===d.cli.archiveSha256 &&
    await hashFile(path.join(privateDir,d.factory.archiveFile))===d.factory.archiveSha256,
    "F04_DISTRIBUTION_ARCHIVE_SHA256_MISMATCH")
  const extracted=path.join(privateDir,"factory-extracted")
  await noSymlinkDirTree(extracted)
  const realExtraction=await realpath(extracted)
  const checkout=originalGitRoot()
  requireProof(realExtraction!==checkout && !realExtraction.startsWith(checkout+path.sep),
    "F04_FACTORY_EXTRACTED_INSIDE_CHECKOUT")
  requireProof(await hashFile(path.join(extracted,"distribution.json"))===d.factory.manifestSha256 &&
    await hashFile(path.join(extracted,"bin/local/entry.mjs"))===d.factory.bundleSha256,
    "F04_FACTORY_EXTRACTED_BYTES_NOT_EQUAL_PROOF")
  const closure=JSON.parse(await readFile(path.join(extracted,"bin/local/closure.json"),"utf8"))
  requireProof(closure?.schema==="sf-factory-closure-v1" &&
    closure.bundle?.sha256===d.factory.bundleSha256 &&
    Array.isArray(closure.inputs) &&
    closure.inputs.length===factory.compilerInputCount &&
    Array.isArray(closure.assets) &&
    closure.assets.length===factory.assetCount &&
    closure.assets.length===24,
    "F04_FACTORY_COMPILER_INPUT_OR_POLICY_CLOSURE_DRIFT")
  const release=d.installed.releaseRoot
  requireProof(release==="/opt/orchestra-sf/releases/"+ctx.candidateSha,
    "F04_DISTRIBUTION_NOT_INSTALLED_ON_C")
  const rootInfo=await lstat(release)
  requireProof(rootInfo.isDirectory() && !rootInfo.isSymbolicLink() &&
    await realpath(release)===release, "F04_RELEASE_NOT_IMMUTABLE_REAL_PATH")
  const a7manifest=JSON.parse(await readFile(path.join(release,"manifest.json"),"utf8"))
  requireProof(a7manifest.schema==="orchestra-sf.azure-bundle.v1" &&
    a7manifest.candidateSha===ctx.candidateSha &&
    a7manifest.treeSha===ctx.treeSha,
    "F04_A7_DEPLOYED_MANIFEST_WRONG_SHA_OR_TREE")
  const a7archive=(await readFile(path.join(release,".archive-sha256"),"utf8")).trim()
  requireProof(a7archive===ctx.artifactSha256,
    "F04_A7_INSTALLED_ARCHIVE_DIGEST_MISMATCH")
  requireProof(await hashFile(d.installed.binaryPath)===d.cli.binarySha256 &&
    await hashFile(d.installed.factoryPath)===d.factory.bundleSha256,
    "F04_INSTALLED_CLI_OR_FACTORY_BYTES_CHANGED")
  const webFile=cli.manifest.files.find((v)=>v.path==="bin/web/index.html")
  requireProof(webFile && await hashFile(path.join(d.installed.webRoot,"index.html"))===webFile.sha256,
    "F04_INSTALLED_WEB_BYTES_CHANGED")
  const expected=new Set()
  for(const asset of closure.assets){
    requireProof(typeof asset.path==="string" &&
      asset.path.startsWith("bin/product/ai/") && hex64.test(asset.sha256??"") &&
      !asset.path.split("/").some((v)=>v===".."||v==="."),
      "F04_FACTORY_ASSET_PATH_UNSAFE")
    const relative=asset.path.slice("bin/product/ai/".length)
    const file=path.join(d.installed.policyRoot,relative)
    expected.add(file)
    requireProof(await hashFile(file)===asset.sha256,
      "F04_INSTALLED_FACTORY_POLICY_ASSET_DIGEST_DRIFT")
  }
  const seen=[]
  async function collect(dir){
    for(const entry of await readdir(dir,{withFileTypes:true})){
      const full=path.join(dir,entry.name)
      if(entry.isDirectory())await collect(full)
      else {await ordinaryFile(full);seen.push(full)}
    }
  }
  await collect(d.installed.policyRoot)
  requireProof(seen.length===24 && seen.every(f=>expected.has(f)) &&
    expected.size===24,
    "F04_INSTALLED_FACTORY_POLICY_ROSTER_INCOMPLETE")
  return {sourceSha:ctx.candidateSha,cliBinarySha256:binSha,
    factoryBundleSha256:factory.bundleSha256,archiveSha256:ctx.artifactSha256,
    policyAssetCount:expected.size, status:"DISTRIBUTION_BYTES_VERIFIED_NOT_LIVE_F04_ACCEPTANCE"}
}
