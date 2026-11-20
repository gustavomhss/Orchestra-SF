import { createHash } from "node:crypto"
import { lstat, readdir, readFile, realpath } from "node:fs/promises"
import { isBuiltin } from "node:module"
import path from "node:path"

const hooks = ["preinstall", "install", "postinstall", "prepare"]
const recipe = ".github/actions/setup-bun/action.yml"
const implementation = "script/ci-cache-inputs.ts"
const postinstall = "packages/core/script/fix-node-pty.ts"

export async function dependencyFingerprint(
  directory: string,
  runtime: { bunVersion: string; nodeAbi: string; nodeEnv?: string },
) {
  const root = await realpath(directory)
  if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(runtime.bunVersion) || !/^\d+$/.test(runtime.nodeAbi))
    throw new Error("CACHE_RUNTIME_INVALID")
  const files = new Map<string, Uint8Array>()
  const add = async (file: string, optional = false) => {
    safePath(file)
    const disk = path.join(root, file)
    const stat = await lstat(disk).catch((error: unknown) => {
      if (optional && isRecord(error) && error.code === "ENOENT") return undefined
      throw error
    })
    if (!stat) return undefined
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("CACHE_INPUT_NOT_REGULAR: " + file)
    safePath(path.relative(root, await realpath(disk)).split(path.sep).join("/"))
    if (stat.size > 64 * 1024 * 1024) throw new Error("CACHE_INPUT_TOO_LARGE: " + file)
    const bytes = await readFile(disk)
    files.set(file, bytes)
    return bytes
  }
  const manifest = async (file: string, optional = false) => {
    const bytes = await add(file, optional)
    if (!bytes) return undefined
    const value: unknown = JSON.parse(Buffer.from(bytes).toString("utf8"))
    if (!isRecord(value)) throw new Error("CACHE_MANIFEST_INVALID: " + file)
    return value
  }
  const top = await manifest("package.json")
  if (!top || top.packageManager !== "bun@" + runtime.bunVersion)
    throw new Error("CACHE_BUN_VERSION_MISMATCH")
  await add("bun.lock")
  await add("bunfig.toml", true)
  await add(".npmrc", true)
  await add(recipe)
  await add(implementation)

  const workspaceSpec = Array.isArray(top.workspaces)
    ? top.workspaces
    : isRecord(top.workspaces)
      ? top.workspaces.packages
      : undefined
  if (!Array.isArray(workspaceSpec) || workspaceSpec.length === 0 || workspaceSpec.length > 128)
    throw new Error("CACHE_WORKSPACES_INVALID")
  const manifests = new Map<string, Record<string, unknown>>([["package.json", top]])
  for (const spec of workspaceSpec) {
    if (typeof spec !== "string") throw new Error("CACHE_WORKSPACE_PATTERN_INVALID")
    const wildcard = spec.endsWith("/*")
    const parent = wildcard ? spec.slice(0, -2) : spec
    safePath(parent)
    if (!/^[A-Za-z0-9_./-]+$/.test(parent)) throw new Error("CACHE_WORKSPACE_PATTERN_UNSUPPORTED: " + spec)
    const directories = wildcard
      ? (await readdir(path.join(root, parent), { withFileTypes: true }))
        .filter((entry) => !entry.name.startsWith(".") && entry.name !== "node_modules")
        .map((entry) => {
          if (entry.isSymbolicLink()) throw new Error("CACHE_WORKSPACE_SYMLINK: " + parent + "/" + entry.name)
          return entry.isDirectory() ? parent + "/" + entry.name : undefined
        }).filter((entry) => entry !== undefined)
      : [parent]
    if (directories.length > 256) throw new Error("CACHE_WORKSPACE_LIMIT")
    for (const workspace of directories) {
      if (!/^[A-Za-z0-9_./-]+$/.test(workspace)) throw new Error("CACHE_WORKSPACE_PATTERN_UNSUPPORTED: " + workspace)
      const file = workspace + "/package.json"
      const value = await manifest(file, wildcard)
      if (value) manifests.set(file, value)
      if (manifests.size > 256) throw new Error("CACHE_WORKSPACE_LIMIT")
    }
  }

  for (const [file, value] of manifests) {
    const scripts = value.scripts === undefined ? {} : value.scripts
    if (!isRecord(scripts)) throw new Error("CACHE_SCRIPTS_INVALID: " + file)
    for (const hook of hooks) {
      if (scripts[hook] === undefined) continue
      const admitted = file === "package.json" &&
        ((hook === "postinstall" && scripts[hook] === "bun run --cwd packages/core fix-node-pty") ||
          (hook === "prepare" && scripts[hook] === "husky"))
      if (!admitted) throw new Error("CACHE_INSTALL_HOOK_UNADMITTED: " + file + "#" + hook)
    }
    for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
      const dependencies = value[field]
      if (dependencies === undefined) continue
      if (!isRecord(dependencies)) throw new Error("CACHE_DEPENDENCIES_INVALID: " + file)
      for (const spec of Object.values(dependencies)) {
        if (typeof spec !== "string") throw new Error("CACHE_DEPENDENCY_SPEC_INVALID: " + file)
        if (
          spec.startsWith("link:") || spec.startsWith("~/") || spec.includes("\\") ||
          path.posix.isAbsolute(spec) || /^[A-Za-z]:/.test(spec)
        ) throw new Error("CACHE_LOCAL_DEPENDENCY_UNSUPPORTED: " + file)
        const target = spec.startsWith("file:")
          ? spec.slice(5)
          : spec.startsWith("./") || spec.startsWith("../") ? spec : undefined
        if (target === undefined) continue
        if (
          path.posix.isAbsolute(target) || /^[A-Za-z]:/.test(target) ||
          target.includes("\\") || !/\.(?:tgz|tar\.gz)$/.test(target)
        ) throw new Error("CACHE_LOCAL_DEPENDENCY_UNSUPPORTED: " + file)
        await add(path.posix.normalize(path.posix.join(path.posix.dirname(file), target)))
      }
    }
  }

  const rootScripts = isRecord(top.scripts) ? top.scripts : {}
  if (rootScripts.postinstall !== undefined) {
    const core = manifests.get("packages/core/package.json")
    if (!core || !isRecord(core.scripts) || core.scripts["fix-node-pty"] !== "bun run script/fix-node-pty.ts")
      throw new Error("CACHE_POSTINSTALL_COMMAND_UNADMITTED")
    await add("packages/core/bunfig.toml", true)
    const source = await add(postinstall)
    if (!source) throw new Error("CACHE_POSTINSTALL_MISSING")
    // This admitted hook currently reads only the installed node-pty tree.
    // A new repository/module dependency requires an explicit input-policy update.
    // Bun.Transpiler expects module source without a hashbang; the fingerprint
    // still uses every original file byte collected above.
    const moduleSource = Buffer.from(source).toString("utf8").replace(/^#![^\r\n]*(?:\r\n?|\n|$)/, "")
    const imports = new Bun.Transpiler({ loader: "ts" }).scanImports(moduleSource)
    if (imports.some((entry) => !isBuiltin(entry.path))) throw new Error("CACHE_POSTINSTALL_IMPORT_UNADMITTED")
  }
  if (top.patchedDependencies !== undefined) {
    if (!isRecord(top.patchedDependencies)) throw new Error("CACHE_PATCHES_INVALID")
    for (const file of Object.values(top.patchedDependencies)) {
      if (typeof file !== "string") throw new Error("CACHE_PATCH_PATH_INVALID")
      await add(file)
    }
  }

  const inputs = [...files.keys()].sort()
  const hash = createHash("sha256").update(
    "installed-inputs-v1\0" + runtime.bunVersion + "\0" + runtime.nodeAbi + "\0" + (runtime.nodeEnv ?? "") + "\0",
  )
  for (const file of inputs) {
    const bytes = files.get(file)
    if (!bytes) throw new Error("CACHE_INPUT_DISAPPEARED: " + file)
    hash.update(file + "\0" + bytes.length + "\0").update(bytes).update("\0")
  }
  const modulesPaths = [...new Set([
    "node_modules",
    ...[...manifests.keys()].filter((file) => file !== "package.json")
      .map((file) => path.posix.dirname(file) + "/node_modules"),
  ])].sort()
  return { fingerprint: hash.digest("hex"), inputs, modulesPaths }
}

function safePath(file: string) {
  if (
    !file || path.posix.isAbsolute(file) || /^[A-Za-z]:/.test(file) ||
    file.includes("\\") || /[\x00-\x1f\x7f]/.test(file) ||
    file.split("/").some((part) => part === "" || part === "." || part === ".." || part === "node_modules" || part === ".git")
  ) throw new Error("CACHE_INPUT_PATH_INVALID: " + file)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

if (import.meta.main) {
  const result = await dependencyFingerprint(process.cwd(), {
    bunVersion: Bun.version,
    nodeAbi: process.env.ORCHESTRA_CACHE_NODE_ABI ?? "",
    nodeEnv: process.env.NODE_ENV ?? "",
  })
  console.log("fingerprint=" + result.fingerprint)
  console.log("input-count=" + result.inputs.length)
  console.log("modules-paths<<CACHE_MODULE_PATHS")
  console.log(result.modulesPaths.join("\n"))
  console.log("CACHE_MODULE_PATHS")
}
