// CI-only structural evidence for the frozen diagnostic. Never changes G09 dispositions.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")
const gitBlob = (bytes) => createHash("sha1").update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest("hex")
export function safeRelative(value) {
  assert(typeof value === "string" && value.length && !value.includes("\\") && !value.includes("\0"))
  assert(!value.startsWith("/") && !/^[A-Za-z]:/.test(value))
  assert(value.split("/").every((part) => part && part !== "." && part !== ".."))
  return value
}
export function registryURL(value) {
  const url = new URL(value)
  assert.equal(url.protocol, "https:")
  assert.equal(url.hostname, "registry.npmjs.org")
  assert(!url.port && !url.username && !url.password && !url.search && !url.hash)
  assert(url.pathname.endsWith(".tgz") && !/%(?:2f|5c|2e)/i.test(url.pathname))
  return url.href
}
export function verifySRI(bytes, integrity) {
  assert.match(integrity, /^sha512-[A-Za-z0-9+/]{86}==$/)
  assert.equal("sha512-" + createHash("sha512").update(bytes).digest("base64"), integrity)
}
export function verifyGitBytes(bytes, oid, inventorySha256) {
  assert.equal(gitBlob(bytes), oid, "Git blob differs")
  assert.equal(sha256(bytes), inventorySha256, "diagnostic file digest differs")
}
export function exportLeaves(value, conditions = []) {
  if (typeof value === "string") {
    assert(value.startsWith("./"), "only package-relative export targets are supported")
    return [{ conditions, target: safeRelative(value.slice(2)) }]
  }
  assert(value && typeof value === "object" && !Array.isArray(value), "unsupported export shape")
  const entries = Object.entries(value)
  assert(entries.length && entries.every(([key]) => key && !key.startsWith(".") && !key.includes("*")))
  return entries.flatMap(([key, child]) => exportLeaves(child, [...conditions, key]))
}
export function exactExport(pkg, subpath) {
  const value = pkg.exports
  if (value === undefined) return null
  if (typeof value === "string") return subpath === "." ? exportLeaves(value) : null
  assert(value && typeof value === "object" && !Array.isArray(value), "unsupported exports shape")
  const keys = Object.keys(value)
  if (!keys.some((key) => key.startsWith("."))) return subpath === "." ? exportLeaves(value) : null
  assert(keys.every((key) => key.startsWith(".")), "mixed subpath and condition keys")
  // No wildcard/fallback guessing: this supplement only uses actual exact subpaths.
  return Object.hasOwn(value, subpath) ? exportLeaves(value[subpath]) : null
}
export function verifiedMembers(leaves, members) {
  assert(leaves?.length, "no exact exported subpath")
  return leaves.map((leaf) => {
    const member = members.get("package/" + leaf.target)
    assert(member, "exported target missing from SRI-bound tar: " + leaf.target)
    assert.match(member.sha256, /^[a-f0-9]{64}$/)
    return { ...leaf, path: member.path, sha256: member.sha256, byteLength: member.byteLength }
  })
}
export function verifyFinding(item) {
  assert.equal(item.kind, "unresolved-import-or-content-edge")
  assert.equal(item.domain, "source")
  assert.equal(item.disposition, null)
  const { id, disposition: _disposition, ...body } = item
  assert.equal(sha256(JSON.stringify(body)), id, "finding ID differs")
  const { id: edgeId, ...edgeBody } = item.edge
  assert.equal(sha256(JSON.stringify(edgeBody)), edgeId, "edge ID differs")
  assert.deepEqual([item.path, item.fileSha256, item.domain],
    [item.edge.from, item.edge.fileSha256, item.edge.domain])
  assert.equal(item.edge.status, "unresolved")
  assert.deepEqual(item.edge.targets, [])
  safeRelative(item.path)
}
export const idSetHash = (rows) => sha256(rows.map((row) => row.id).sort().join("\n") + "\n")
const pins = Object.freeze({
  source: "3ef84da65d6b8ad7cd3250412bbcabdf90924172", tree: "48d57887656fd2e325dee97a7c066bcb8e84bbc8",
  scanner: "ebed903a650cd979d30faa5f4ba6d1f1b175036a", scannerBlob: "10ae99ab085821f0e312ee05479cad3fb723c7b0",
  artifact: "14722264806", tar: "dc11455bbcce4565b24cdca53ce3e5ab05f883757f6c0765910a0e4c98147d83",
  inventory: "f0b248636e95e469a5a12499b810b8bf849e9c9fc492d844f33e1b0828e83fe8",
  graph: "1d7cf8e04e23978ba63cba91c678eb97bdf299ea2ca7d64fb38897fcd81cd074",
  gaps: "7d1e34f5f94d0597c98c1d7332c768e6083c74ef449562a207c7199d7911cb0d",
  atlasIds: "4e626c58a49da3685043d106833caf5181c2f64b2cc4a6a2a4a62c3fd5b2bbad",
  registryIds: "87533926546cd6eff9543b95f7ca5b2ef2291f2c1e4ca4cdb360059b95748155",
  importIds: "a5f5208820a0c936e7f1a431a4a2f40240bb976d644ec2449a99af8de16e9d94",
})

async function main() {
  const args = process.argv.slice(2)
  assert.equal(args.length, 5, "usage: <candidate> <scanner> <input> <diagnostic-directory> <output-directory>")
  const [candidate, scannerRoot, input, diagnostic] = await Promise.all(args.slice(0, 4).map((item) => realpath(item)))
  const output = path.resolve(args[4])
  assert(![candidate, scannerRoot, input, diagnostic].includes(output))
  assert(![candidate, scannerRoot, input].some((root) => output.startsWith(root + path.sep)))
  await mkdir(output, { recursive: true, mode: 0o700 })
  assert.equal(await realpath(output), output)
  const receipt = { schema: "sf-g09-structural-supplement-v1", status: "BLOCKED", formalG09Pass: false,
    inheritedClassifications: 0, assignedDispositions: 0, inheritedSignatures: 0,
    originalBuildSelectionProven: false, productExecuted: false, productRebuilt: false,
    packageInstallationPerformed: false, completeOriginalCheckpointEquality: "NOT_VERIFIABLE",
    sourceSHA: pins.source, sourceTreeSHA: pins.tree, artifactId: pins.artifact, archiveSha256: pins.tar,
    execution: { workflowSHA: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT, jobId: process.env.G09_CHECK_RUN_ID },
    rows: [], registryArchives: [], limitations: [
      "Structural contracts and file membership do not assign a semantic disposition or satisfy the signed G09 review.",
      "All conditional export leaves are enumerated; no runtime condition or original build selection is inferred.",
      "Registry tar members prove availability in a separately acquired locked package, not inclusion or execution in the original product.",
      "Atlas dist targets are not generated. Missing targets and non-exported subpaths remain explicit.",
      "No transitive dependency closure, runtime loading, semantic call graph, or TUI behavior is proved.",
    ] }
  try {
    assert.deepEqual([process.env.GITHUB_ACTIONS, process.env.GITHUB_REPOSITORY, process.env.GITHUB_REPOSITORY_ID,
      process.env.RUNNER_OS, process.env.RUNNER_ARCH], ["true", "gustavomhss/Orchestra-SF", "1455724710", "Linux", "X64"])
    assert.match(process.env.GITHUB_SHA ?? "", /^[a-f0-9]{40}$/)
    for (const key of ["GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT", "G09_CHECK_RUN_ID"])
      assert.match(process.env[key] ?? "", /^[1-9][0-9]*$/)
    const scannerPath = path.join(scannerRoot, "script/sf-ci/team-profile-residue.mjs")
    assert.equal(gitBlob(await readFile(scannerPath)), pins.scannerBlob)
    const scanner = await import(pathToFileURL(scannerPath).href)
    const source = scanner.verifyGitSource(await readFile(path.join(input, "source.commit")),
      await readFile(path.join(input, "source.tree")), pins.source)
    assert.equal(source.tree, pins.tree)
    const entries = new Map(source.entries.map((item) => [item.path, item]))
    const reportBytes = await readFile(path.join(diagnostic, "independent-diagnostic-report.json"))
    const report = JSON.parse(reportBytes)
    const metadata = JSON.parse(await readFile(path.join(diagnostic, "independent-diagnostic-metadata.json")))
    assert.equal(metadata.reportSha256, sha256(reportBytes))
    assert.deepEqual(metadata.binding, report.binding)
    assert.deepEqual(metadata.execution, receipt.execution)
    assert.equal(metadata.scanner.sourceSHA, pins.scanner)
    assert.equal(report.status, "DIAGNOSTIC_UNQUALIFIED")
    assert.equal(report.counts.classified, 0)
    assert.deepEqual([report.binding.sourceSHA, report.binding.sourceTreeSHA, report.binding.inventorySha256,
      report.binding.graphSha256, report.binding.gapsSha256, report.artifact.artifact.id, report.artifact.archiveSha256],
    [pins.source, pins.tree, pins.inventory, pins.graph, pins.gaps, pins.artifact, pins.tar])
    const inventory = new Map(report.inventory.filter((item) => item.domain === "source").map((item) => [item.path, item]))
    const touched = new Map()
    async function sourceFile(relative) {
      safeRelative(relative)
      const entry = entries.get(relative), item = inventory.get(relative)
      assert(entry && item && ["100644", "100755"].includes(String(entry.mode)), "regular Git source required: " + relative)
      const physical = path.join(candidate, relative)
      assert.equal(await realpath(physical), physical, "source traverses symlink")
      const stat = await lstat(physical)
      assert(stat.isFile() && !stat.isSymbolicLink())
      const data = await readFile(physical)
      verifyGitBytes(data, entry.oid, item.sha256)
      const result = { path: relative, gitBlob: entry.oid, sha256: item.sha256, byteLength: data.length }
      touched.set(relative, result)
      return { ...result, data }
    }
    async function jsonFile(relative) {
      const { data, ...binding } = await sourceFile(relative)
      return { binding, json: JSON.parse(data) }
    }
    const base = "modules/atlas"
    const root = await jsonFile(base + "/package.json"), lock = await jsonFile(base + "/package-lock.json")
    assert.equal(lock.json.lockfileVersion, 3)
    assert.deepEqual(root.json.workspaces, ["packages/*"])
    assert.deepEqual(lock.json.packages[""].workspaces, root.json.workspaces)
    for (const field of ["dependencies", "devDependencies"])
      assert.deepEqual(lock.json.packages[""][field], root.json[field])
    const workspace = new Map()
    for (const relative of entries.keys()) {
      if (!/^modules\/atlas\/packages\/[^/]+\/package\.json$/.test(relative)) continue
      const pkg = await jsonFile(relative), dir = path.posix.dirname(relative), key = dir.slice(base.length + 1)
      assert(!workspace.has(pkg.json.name), "duplicate Atlas package name")
      assert.deepEqual(lock.json.packages["node_modules/" + pkg.json.name], { resolved: key, link: true })
      assert.equal(lock.json.packages[key]?.name, pkg.json.name)
      assert.equal(lock.json.packages[key]?.version, pkg.json.version)
      workspace.set(pkg.json.name, { ...pkg, dir, lockKey: key })
    }
    const all = report.reachability.findings.filter((item) => item.kind === "unresolved-import-or-content-edge" && item.domain === "source")
    const atlas = all.filter((item) => item.path.startsWith(base + "/") && item.edge.specifier?.startsWith("@atlas/"))
    const registry = all.filter((item) => item.path.startsWith(base + "/") && ["vitest", "vitest/config", "fast-check"].includes(item.edge.specifier))
    const imports = all.filter((item) => item.edge.specifier?.startsWith("#"))
    for (const [rows, count, hash] of [[atlas, 1891, pins.atlasIds], [registry, 625, pins.registryIds], [imports, 7, pins.importIds]]) {
      assert.equal(rows.length, count)
      assert.equal(idSetHash(rows), hash)
    }
    receipt.reportSha256 = sha256(reportBytes)
    receipt.reportBinding = report.binding
    receipt.nestedWorkspace = { manifest: root.binding, lock: lock.binding, packages: workspace.size,
      scannerLimitation: "Published scanner uses the repository root workspace list and does not recurse into this nested workspace." }
    const nearestPackage = (relative) => {
      let dir = path.posix.dirname(relative)
      for (;;) {
        const name = dir === "." ? "package.json" : dir + "/package.json"
        if (entries.has(name)) return name
        assert(dir !== ".", "package scope not found")
        dir = path.posix.dirname(dir)
      }
    }
    async function rowBase(item, family) {
      verifyFinding(item)
      const { data: _data, ...importer } = await sourceFile(item.path)
      assert.equal(importer.sha256, item.fileSha256)
      return { findingId: item.id, edgeId: item.edge.id, reportSha256: receipt.reportSha256,
        family, importer, specifier: item.edge.specifier, edgeKind: item.edge.kind,
        start: item.edge.start, end: item.edge.end, disposition: null,
        originalBuildSelectionProven: false, runtimeExecutionProven: false }
    }
    for (const item of atlas) {
      const row = await rowBase(item, "atlas-workspace-contract")
      const name = item.edge.specifier.split("/").slice(0, 2).join("/"), pkg = workspace.get(name)
      assert(pkg, "unknown Atlas package")
      const scope = await jsonFile(nearestPackage(item.path))
      const subpath = item.edge.specifier === name ? "." : "." + item.edge.specifier.slice(name.length)
      const leaves = exactExport(pkg.json, subpath)
      const targets = []
      for (const leaf of leaves ?? []) {
        const relative = safeRelative(pkg.dir + "/" + leaf.target)
        const found = entries.has(relative) ? await sourceFile(relative) : null
        if (found) { const { data: _data, ...binding } = found; targets.push({ ...leaf, ...binding, presentInGit: true }) }
        else targets.push({ ...leaf, path: relative, presentInGit: false, sha256: null })
      }
      receipt.rows.push({ ...row, status: leaves ? "WORKSPACE_EXPORT_CONTRACT_ONLY" : "EXACT_SUBPATH_NOT_EXPORTED",
        importerPackage: scope.binding, fixturePath: item.path.includes("/fixtures/"),
        importerDependencyDeclaration: ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]
          .flatMap((field) => scope.json[field]?.[name] === undefined ? [] : [{ field, value: scope.json[field][name] }]),
        exporterPackage: pkg.binding, lock: lock.binding, lockLink: lock.json.packages["node_modules/" + name],
        subpath, targets, resolutionProven: false,
        remaining: leaves ? "Export contract identified; missing Git-tracked targets are not synthesized and runtime resolution remains unproved."
          : "Exact subpath is not exported; this evidence does not approve or resolve the reference." })
    }
    const acquired = new Map()
    for (const name of ["vitest", "fast-check"]) {
      const entry = lock.json.packages["node_modules/" + name]
      assert(root.json.devDependencies[name] && entry?.integrity && entry.resolved)
      const url = registryURL(entry.resolved)
      const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(45000) })
      assert(response.ok && response.body, "registry acquisition failed: " + response.status)
      const chunks = []; let size = 0
      for await (const chunk of response.body) {
        size += chunk.length; assert(size <= 16 * 1024 * 1024, "registry archive exceeds size cap"); chunks.push(chunk)
      }
      const bytes = Buffer.concat(chunks)
      verifySRI(bytes, entry.integrity)
      const files = scanner.readTarArchive(bytes, 64 * 1024 * 1024)
      assert(files.every((file) => safeRelative(file.path).startsWith("package/")))
      const members = new Map(files.map((file) => [file.path, file]))
      assert.equal(members.size, files.length)
      const manifest = members.get("package/package.json")
      assert(manifest)
      const pkg = JSON.parse(manifest.text)
      assert.equal(pkg.name, name); assert.equal(pkg.version, entry.version)
      const archiveFile = name + "-" + entry.version + ".tgz"
      await writeFile(path.join(output, archiveFile), bytes, { flag: "wx", mode: 0o600 })
      const evidence = { name, version: entry.version, declaredRange: root.json.devDependencies[name],
        declaringManifest: root.binding, lock: lock.binding, lockKey: "node_modules/" + name,
        resolved: url, integrity: entry.integrity, archiveFile, archiveSha256: sha256(bytes),
        archiveBytes: bytes.length, memberCount: files.length, packageManifestSha256: manifest.sha256 }
      acquired.set(name, { pkg, members, evidence }); receipt.registryArchives.push(evidence)
    }
    for (const item of registry) {
      const row = await rowBase(item, "atlas-registry-export-members")
      const name = item.edge.specifier.split("/")[0], pkg = acquired.get(name)
      const subpath = item.edge.specifier === name ? "." : "./" + item.edge.specifier.slice(name.length + 1)
      const leaves = exactExport(pkg.pkg, subpath)
      const scope = await jsonFile(nearestPackage(item.path))
      receipt.rows.push({ ...row, status: "LOCKED_EXPORT_MEMBERS_VERIFIED", importerPackage: scope.binding,
        nestedWorkspaceRoot: root.binding, registryArchive: pkg.evidence, subpath,
        targets: verifiedMembers(leaves, pkg.members), resolutionProven: false,
        transitiveDependencyClosureProven: false, presentInOriginalProductProven: false,
        remaining: "Only the exact direct package export members are verified; runtime condition selection, installation, transitive closure and product inclusion remain unproved." })
    }
    for (const item of imports) {
      const row = await rowBase(item, "package-import-map-targets")
      const scope = await jsonFile(nearestPackage(item.path))
      assert(["packages/core/package.json", "modules/relay/package.json"].includes(scope.binding.path))
      assert(Object.hasOwn(scope.json.imports ?? {}, item.edge.specifier), "nearest package imports entry missing")
      const targets = []
      for (const leaf of exportLeaves(scope.json.imports[item.edge.specifier])) {
        const { data: _data, ...binding } = await sourceFile(path.posix.dirname(scope.binding.path) + "/" + leaf.target)
        targets.push({ ...leaf, ...binding, presentInGit: true })
      }
      receipt.rows.push({ ...row, status: "IMPORT_MAP_TARGET_FILES_VERIFIED", packageScope: scope.binding, targets,
        resolutionProven: false, remaining: "Declared conditional target bytes exist in Git; no runtime condition or original build selection is claimed." })
    }
    assert.equal(receipt.rows.length, 2523)
    assert.equal(new Set(receipt.rows.map((row) => row.findingId)).size, 2523)
    for (const relative of touched.keys()) await sourceFile(relative)
    assert.equal(gitBlob(await readFile(scannerPath)), pins.scannerBlob)
    assert.equal(sha256(await readFile(path.join(diagnostic, "independent-diagnostic-report.json"))), receipt.reportSha256)
    receipt.touchedSourceFiles = [...touched.values()].sort((a, b) => a.path.localeCompare(b.path))
    receipt.coverage = { totalFindings: report.reachability.findings.length, totalSourceUnresolved: all.length,
      selected: 2523, atlasWorkspace: atlas.length, registryExports: registry.length, packageImports: imports.length,
      otherFindingsNotCovered: report.reachability.findings.length - 2523,
      atlasRowsWithMissingTargets: receipt.rows.filter((row) => row.family === "atlas-workspace-contract" && row.targets.some((target) => !target.presentInGit)).length,
      atlasSubpathsNotExported: receipt.rows.filter((row) => row.status === "EXACT_SUBPATH_NOT_EXPORTED").length }
    receipt.status = "STRUCTURAL_EVIDENCE_READY_FOR_INDEPENDENT_REVIEW"
  } catch (error) {
    receipt.failure = error instanceof Error ? error.stack : String(error)
    process.exitCode = 1
  }
  receipt.harnessSha256 = sha256(await readFile(new URL(import.meta.url)))
  await writeFile(path.join(output, "structural-supplement.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 })
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
