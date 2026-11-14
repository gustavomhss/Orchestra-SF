#!/usr/bin/env node
// Inspect compiler evidence. This tool never executes a test or invokes a compiler.
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { parseArgs } from "node:util"

const { values } = parseArgs({ options: {
  inventory: { type: "boolean", default: false },
  config: { type: "string" },
  log: { type: "string" },
  "config-status": { type: "string" },
  "typecheck-status": { type: "string" },
  output: { type: "string" },
} })
const root = realpathSync(process.cwd())
const app = path.join(root, "packages/app-shell")
const configPath = path.join(app, "tsconfig.sf-e2e.json")
const config = JSON.parse(readFileSync(configPath, "utf8"))
const base = JSON.parse(readFileSync(path.join(app, "tsconfig.json"), "utf8"))
const manifest = JSON.parse(readFileSync(new URL("./requests.json", import.meta.url), "utf8"))
const nominal = ["operations", "decisions", "reports"].map((name) => `e2e/sucafina/${name}.spec.ts`)
const includes = ["e2e/playwright.production.config.ts", "e2e/utils/flaky-reporter.ts",
  "e2e/sucafina/**/*.ts", "e2e/sucafina/**/*.tsx"]
const runtimeRoots = [
  "e2e/utils/flaky-reporter.ts",
  "e2e/sucafina/wp03/installation-setup.ts",
  "e2e/sucafina/wp04/host.ts",
  "e2e/sucafina/reports-support/production-state.ts",
]
const failures = []
const requireCheck = (condition, message) => { if (!condition) failures.push(message) }
const relative = (file) => path.relative(root, file).split(path.sep).join("/")
const isFile = (file) => statSync(file, { throwIfNoEntry: false })?.isFile() ?? false
const digest = (file) => {
  const bytes = readFileSync(file)
  return { path: relative(file), bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    git_blob_sha: createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex") }
}
const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const file = path.join(directory, entry.name)
  if (entry.isDirectory()) return walk(file)
  if (!/\.tsx?$/.test(entry.name)) return []
  requireCheck(entry.isFile(), `NON_REGULAR_INPUT: ${relative(file)}`)
  return entry.isFile() ? [file] : []
})
const sourceDirectory = path.join(app, "e2e/sucafina")
const sources = statSync(sourceDirectory, { throwIfNoEntry: false })?.isDirectory() ? walk(sourceDirectory) : []
const roots = [...new Set([...sources, ...includes.filter((file) => !file.includes("*")).map((file) => path.join(app, file)),
  ...nominal.map((file) => path.join(app, file))])].sort()
requireCheck(config.extends === "./tsconfig.json", "CONFIG_DRIFT: expected the unchanged app base")
requireCheck(JSON.stringify(config.files) === JSON.stringify(nominal), "CONFIG_DRIFT: preserve all three required specs")
requireCheck(JSON.stringify(config.include) === JSON.stringify(includes), "CONFIG_DRIFT: preserve the complete Sucafina helper tree")
requireCheck(!Object.hasOwn(config, "exclude"), "CONFIG_DRIFT: no new exclusions in the scoped config")
requireCheck(config.compilerOptions?.composite === false && config.compilerOptions?.noEmit === true &&
  config.compilerOptions?.emitDeclarationOnly === false, "CONFIG_DRIFT: scoped check must be noncomposite and nonemitting")
requireCheck(config.compilerOptions?.allowImportingTsExtensions === true &&
  path.resolve(app, config.compilerOptions?.rootDir ?? ".") === root, "CONFIG_DRIFT: preserve repository-wide import resolution")
requireCheck(base.compilerOptions?.strict === true && config.compilerOptions?.strict !== false &&
  config.compilerOptions?.noCheck !== true && config.compilerOptions?.noResolve !== true, "CONFIG_DRIFT: strict checking and dependency resolution are required")
requireCheck(JSON.stringify(config.compilerOptions?.types) === JSON.stringify(["node", "bun", "vite/client"]),
  "CONFIG_DRIFT: preserve E2E ambient types")
const scripts = JSON.parse(readFileSync(path.join(app, "package.json"), "utf8")).scripts
requireCheck(scripts["typecheck:sf-e2e"] === "tsgo -p tsconfig.sf-e2e.json", "COMMAND_DRIFT: invoke the real package compiler")
requireCheck(scripts.typecheck === "tsgo -b" && scripts["typecheck:e2e"] === "tsgo -p e2e/tsconfig.json",
  "COMMAND_DRIFT: preserve the existing app and E2E checks")
const recipes = manifest.recipes.filter((recipe) => recipe.request.runner === "playwright")
requireCheck(recipes.length === 3 && recipes.every((recipe, index) =>
  recipe.directory === "packages/app-shell" && recipe.request.package === "app" &&
  recipe.request.config === "e2e/playwright.production.config.ts" &&
  JSON.stringify(recipe.request.args) === JSON.stringify([nominal[index]])), "SELECTION_DRIFT: preserve the three nominal production requests")
requireCheck(sources.length > 0, "EMPTY_INPUTS: Sucafina source tree is empty")
for (const file of roots) requireCheck(isFile(file), `MISSING_INPUT: ${relative(file)}`)
for (const file of runtimeRoots) requireCheck(roots.includes(path.join(app, file)) && isFile(path.join(app, file)),
  `MISSING_RUNTIME_ROOT: ${file}`)

const observation = {
  schema: "sf2-e2e-typecheck-evidence-v1",
  mode: values.inventory ? "declared-source-inventory" : "compiler-evidence",
  candidate_sha: process.env.GITHUB_SHA ?? null,
  product_tree: process.env.SF_PRODUCT_TREE ?? null,
  run_id: process.env.GITHUB_RUN_ID ?? null,
  attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  commands: {
    cwd: "packages/app-shell",
    effective_config: "bun run typecheck:sf-e2e --showConfig",
    typecheck: "bun run typecheck:sf-e2e --listFiles --pretty false",
  },
  input_configs: [configPath, path.join(app, "tsconfig.json"), path.join(app, "e2e/tsconfig.json"),
    path.join(app, "package.json")].map(digest),
  nominal_specs: nominal.map((file) => `packages/app-shell/${file}`),
  declared_runtime_roots: runtimeRoots.map((file) => `packages/app-shell/${file}`),
  declared_inputs: roots.filter(isFile).map(digest),
  compiler_status: "NOT_RUN",
  compiler_files: [],
  diagnostics: [],
  failures,
}

if (!values.inventory) {
  requireCheck([values["config-status"], values["typecheck-status"]].every((value) => /^\d+$/.test(value ?? "")),
    "MISSING_EXIT_STATUS: both real compiler commands need an exit status")
  const configStatus = Number(values["config-status"] ?? -1)
  const typecheckStatus = Number(values["typecheck-status"] ?? -1)
  observation.command_statuses = { effective_config: configStatus, typecheck: typecheckStatus }
  observation.compiler_status = typecheckStatus === 0 ? "PASS" : "FAIL"
  requireCheck(configStatus === 0, `CONFIG_FAILED: exit ${configStatus}`)
  requireCheck(typecheckStatus === 0, `TYPECHECK_FAILED: exit ${typecheckStatus}`)
  requireCheck(/^[a-f0-9]{40}$/.test(observation.candidate_sha ?? "") &&
    /^[a-f0-9]{40}$/.test(observation.product_tree ?? ""), "MISSING_IDENTITY: candidate SHA and tree are required")
  const outputFiles = [values.config, values.log].map((file) => file ? path.resolve(root, file) : "")
  requireCheck(outputFiles.every((file) => file && isFile(file)), "MISSING_EVIDENCE: effective config and compiler log are required")
  if (outputFiles.every((file) => file && isFile(file))) {
    observation.compiler_evidence = outputFiles.map(digest)
    const effectiveText = readFileSync(outputFiles[0], "utf8")
    // A failed showConfig may contain a diagnostic instead of JSON. Preserve it as failed evidence.
    const effective = configStatus === 0 ? JSON.parse(effectiveText) : null
    if (effective) {
      const files = new Set((effective.files ?? []).map((file) => path.resolve(app, file)))
      requireCheck(files.size > 0, "EMPTY_COMPILER_CONFIG: showConfig selected no files")
      requireCheck(effective.compilerOptions?.strict === true && effective.compilerOptions?.noEmit === true &&
        effective.compilerOptions?.composite === false && effective.compilerOptions?.noCheck !== true &&
        effective.compilerOptions?.noResolve !== true, "EFFECTIVE_OPTIONS: strict, nonemitting, noncomposite, resolved check required")
      for (const file of roots) requireCheck(files.has(file), `CONFIG_OMISSION: ${relative(file)}`)
      observation.effective_root_count = files.size
    }
    const log = readFileSync(outputFiles[1], "utf8")
    const program = [...new Set(log.split(/\r?\n/).map((line) => line.trim())
      .filter((line) => /\.(?:[cm]?[tj]sx?|json)$/.test(line))
      .map((line) => path.resolve(app, line)).filter(isFile).map((file) => realpathSync(file)))].sort()
    requireCheck(program.length > 0, "EMPTY_COMPILER_PROGRAM: --listFiles emitted no existing files")
    for (const file of roots) requireCheck(program.includes(file), `PROGRAM_OMISSION: ${relative(file)}`)
    observation.compiler_files = program.map((file) => ({ ...digest(file),
      kind: file.includes(`${path.sep}node_modules${path.sep}`) ? "dependency" :
        roots.includes(file) ? "declared-input" : "transitive-source" }))
    observation.diagnostics = log.split(/\r?\n/).filter((line) => /error TS\d+:/.test(line))
    requireCheck(observation.diagnostics.length === 0, `COMPILER_DIAGNOSTICS: ${observation.diagnostics.length} errors; preserve the complete log`)
    observation.compiler_file_count = program.length
    observation.transitive_source_count = observation.compiler_files.filter((file) => file.kind === "transitive-source").length
  }
}

observation.status = failures.length ? "FAIL" : values.inventory ? "INPUTS_PRESENT_COMPILER_NOT_RUN" : "PASS"
const serialized = JSON.stringify(observation, null, 2) + "\n"
if (values.output) {
  const destination = path.resolve(root, values.output)
  mkdirSync(path.dirname(destination), { recursive: true })
  writeFileSync(destination, serialized)
}
console.log(values.output ? JSON.stringify({ status: observation.status, compiler_status: observation.compiler_status,
  declared_inputs: observation.declared_inputs.length, compiler_files: observation.compiler_files.length,
  diagnostic_count: observation.diagnostics.length, failures, evidence: values.output }, null, 2) : serialized)
process.exitCode = failures.length ? 1 : 0
