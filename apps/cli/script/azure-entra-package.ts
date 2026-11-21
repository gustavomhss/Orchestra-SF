#!/usr/bin/env bun
import { $ } from "bun"
import { lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises"
import { isBuiltin } from "node:module"
import { tmpdir } from "node:os"
import { basename, dirname, join, relative, resolve, sep } from "node:path"
import { parseArgs } from "node:util"

const target = "linux-x64-baseline"
const archiveFile = `orchestra-sf-entra-${target}.tar.gz`
const receiptFile = "orchestra-sf-entra-package-receipt.json"
const entry = "modules/sucafina/Sucafinav1/local/microsoft-entry.ts"
const bundlePath = "bin/local/entry.mjs"
const usage = "Usage: bun apps/cli/script/azure-entra-package.ts --dist <raw CLI dist> --out <new directory> --source-sha <40-hex SHA>"

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      dist: { type: "string" },
      out: { type: "string" },
      "source-sha": { type: "string" },
      help: { type: "boolean" },
    },
  })
  if (values.help) {
    console.log(usage)
    process.exit(0)
  }
  const expectedSourceSHA = values["source-sha"]
  if (!values.dist || !values.out || !expectedSourceSHA || !/^[a-f0-9]{40}$/.test(expectedSourceSHA))
    throw new Error(usage)
  console.log(JSON.stringify(await packageEntra({ dist: values.dist, out: values.out, expectedSourceSHA })))
}

async function packageEntra(input: { dist: string; out: string; expectedSourceSHA: string }) {
  const workspace = await realpath(resolve(import.meta.dir, "../../.."))
  const checkoutSHA = await requireCheckout(workspace, input.expectedSourceSHA)
  const runID = process.env.GITHUB_RUN_ID
  const runAttempt = process.env.GITHUB_RUN_ATTEMPT
  const hosted = process.env.GITHUB_ACTIONS === "true" || runID !== undefined || runAttempt !== undefined
  if (hosted && (!runID || !runAttempt || !/^[1-9][0-9]*$/.test(runID) || !/^[1-9][0-9]*$/.test(runAttempt)))
    throw new Error("GitHub Actions package receipts require a decimal run ID and attempt")
  if ([input.dist, input.out].some((path) => path.includes("\0") || path.split(/[\\/]/).includes("..")))
    throw new Error("Unsafe package location")
  const dist = await realpath(input.dist)
  const output = join(await realpath(dirname(resolve(input.out))), basename(resolve(input.out)))
  if (output === dist || output.startsWith(dist + sep) || dist.startsWith(output + sep))
    throw new Error("Package output overlaps the raw CLI distribution")

  // The raw CLI build must be supplied by the producer from this same checkout.
  const rawTarget = join(dist, `cli-${target}`)
  const rawPackage = join(rawTarget, "package.json")
  if (!(await lstat(rawTarget)).isDirectory() || !(await lstat(rawPackage)).isFile())
    throw new Error("Raw CLI distribution requires a regular target package.json")
  const raw: { version?: unknown } = await Bun.file(rawPackage).json()
  if (typeof raw?.version !== "string") throw new Error("Missing raw CLI distribution version")
  const { archiveDistribution, prepareDistribution } = await import("./distribution-payload")
  const scratch = await mkdtemp(join(await realpath(tmpdir()), "sf-entra-package-"))
  try {
    const native = join(scratch, "native")
    await prepareDistribution({ dist, out: native, target, version: raw.version })
    for (const executable of ["orchestra", "hugr-omni-supervisor"]) {
      const header = Buffer.from(await Bun.file(join(native, "bin", executable)).slice(0, 20).arrayBuffer())
      if (header.length !== 20 || header.readUInt32BE(0) !== 0x7f454c46 ||
          header[4] !== 2 || header[5] !== 1 || header.readUInt16LE(18) !== 62)
        throw new Error(`Entra package requires a Linux x86_64 ELF64 executable: ${executable}`)
    }
    const stagingDist = join(scratch, "dist")
    const stagingTarget = join(stagingDist, `cli-${target}`)
    await mkdir(stagingTarget, { recursive: true })
    await rename(join(native, "bin"), join(stagingTarget, "bin"))
    await rename(join(native, "package.json"), join(stagingTarget, "package.json"))
    const bundleSha256 = await stageFactory(workspace, stagingTarget)
    const payload = join(scratch, "payload")
    const manifest = await prepareDistribution({ dist: stagingDist, out: payload, target, version: raw.version })
    if (manifest.files.find((file) => file.path === bundlePath)?.sha256 !== bundleSha256)
      throw new Error("Packaged Entra factory digest differs from the staged bundle")
    const manifestSha256 = digest(await readFile(join(payload, "distribution.json")))
    await requireCheckout(workspace, checkoutSHA)

    await mkdir(output)
    try {
      const archive = await archiveDistribution({ directory: payload, file: join(output, archiveFile) })
      const receipt = {
        schema: "sf-entra-factory-package-v1",
        proof: "packaged",
        sourceSHA: checkoutSHA,
        checkoutSHA,
        expectedSourceSHA: input.expectedSourceSHA,
        target,
        archiveFile,
        archiveSha256: archive.sha256,
        manifestSha256,
        bundleSha256,
        ...(hosted ? { runID, runAttempt } : {}),
      }
      const receiptPath = join(output, receiptFile)
      await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o644 })
      const verifier = join(workspace, "sf/azure/vm/install-factory-distribution.py")
      await $`python3 -B ${verifier} verify --artifact ${join(output, archiveFile)} --receipt ${receiptPath} --candidate ${checkoutSHA} --sha256 ${archive.sha256}`.quiet()
      return receipt
    } catch (error) {
      await rm(output, { recursive: true, force: true })
      throw error
    }
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

async function stageFactory(workspace: string, destination: string) {
  const built = await Bun.build({
    entrypoints: [join(workspace, entry)],
    target: "bun",
    format: "esm",
    splitting: false,
    minify: true,
    sourcemap: "none",
    metafile: true,
    loader: { ".txt": "text", ".json": "json" },
  })
  if (!built.success || built.outputs.length !== 1 || built.outputs[0]?.kind !== "entry-point" || !built.metafile)
    throw new Error("Entra factory must build as one ESM entry point")
  const inputs = await Promise.all(Object.entries(built.metafile.inputs).map(async ([key, input]) => {
    const file = await realpath(resolve(key))
    if (!file.startsWith(workspace + sep)) throw new Error(`Entra factory input outside checkout: ${key}`)
    for (const imported of input.imports) {
      if (imported.external && !isBuiltin(imported.path) && !imported.path.startsWith("bun:"))
        throw new Error(`Unexpected external Entra factory import: ${imported.path}`)
    }
    return { path: relative(workspace, file).split(sep).join("/"), sha256: digest(await readFile(file)) }
  }))
  inputs.sort((a, b) => a.path.localeCompare(b.path, "en"))
  if (!inputs.some((input) => input.path === entry) || new Set(inputs.map((input) => input.path)).size !== inputs.length)
    throw new Error("Entra factory source closure is missing the entry or contains duplicate inputs")

  const bundle = new Uint8Array(await built.outputs[0].arrayBuffer())
  if (!bundle.length) throw new Error("Empty Entra factory bundle")
  const sha256 = digest(bundle)
  const closure = { schema: "sf-factory-closure-v1", entry, bundle: { path: bundlePath, sha256 }, inputs, assets: [] }
  await mkdir(join(destination, "bin/local"))
  await writeFile(join(destination, bundlePath), bundle, { flag: "wx", mode: 0o644 })
  await writeFile(join(destination, "bin/local/closure.json"), JSON.stringify(closure, null, 2) + "\n", {
    flag: "wx",
    mode: 0o644,
  })
  return sha256
}

async function requireCheckout(workspace: string, expected: string) {
  const actual = (await $`git rev-parse --verify HEAD`.cwd(workspace).text()).trim()
  if (actual !== expected) throw new Error("The checkout does not match --source-sha")
  if ((await $`git status --porcelain=v1 --untracked-files=all`.cwd(workspace).text()).trim())
    throw new Error("The Entra package requires a clean source checkout")
  return actual
}

function digest(bytes: Uint8Array) {
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
}
