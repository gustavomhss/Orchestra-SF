import { createHash } from "node:crypto"
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises"
import path from "node:path"

/**
 * Builds the owner-selected SF installation as a second, *loadable* entrypoint.
 * The compiled CLI cannot bundle an absolute import whose path is only known at runtime.
 * No node_modules or checkout is allowed at the consumer location.
 */
export async function stageSfFactory(input: { workspace: string; bin: string }) {
  const root = await realpath(input.workspace)
  const bin = path.resolve(input.bin)
  const factory = path.join(root, "modules/sucafina/Sucafinav1/local/entry.ts")
  const source = path.join(root, "modules/sucafina/Sucafinav1/product/ai")
  const target = path.join(bin, "local/entry.mjs")
  const ledger = path.join(bin, "local/closure.json")

  // A single bundle prevents resolution of @orchestra/* or relative source imports
  // from the extracted consumer. BUN file/url imports and disk-read policies are
  // separately accounted for in the asset list below.
  const built = await Bun.build({
    entrypoints: [factory],
    target: "bun",
    format: "esm",
    splitting: false,
    minify: true,
    sourcemap: "none",
    metafile: true,
    loader: { ".txt": "text", ".json": "json" },
  })
  if (!built.success || built.outputs.length !== 1 || !built.metafile || !Object.keys(built.metafile.inputs).length) {
    for (const log of built.logs) console.error(log)
    throw new Error("SF_FACTORY_BUNDLE_INCOMPLETE")
  }
  const bundle = Buffer.from(await built.outputs[0]!.arrayBuffer())
  if (!bundle.length) throw new Error("SF_FACTORY_BUNDLE_EMPTY")

  const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
  const inputs = await Promise.all(Object.keys(built.metafile.inputs).map(async (key) => {
    // Bun metafile source keys are relative to the build working directory.
    // The source may be a workspace symlink: record its real, repository-relative path.
    const file = await realpath(path.resolve(process.cwd(), key))
    if (!file.startsWith(root + path.sep)) throw new Error("SF_FACTORY_INPUT_OUTSIDE_WORKSPACE")
    const info = await lstat(file)
    if (!info.isFile() || !info.size) throw new Error("SF_FACTORY_INPUT_NOT_FILE")
    return { path: path.relative(root, file).split(path.sep).join("/"), sha256: digest(await readFile(file)) }
  }))
  inputs.sort((a, b) => a.path.localeCompare(b.path, "en"))
  if (new Set(inputs.map((value) => value.path)).size !== inputs.length)
    throw new Error("SF_FACTORY_INPUT_COLLISION")

  // These sources are read *at runtime* by createResidentAiBundle in host-context.ts.
  // The resident manifest is authoritative about the approved profiles and skills.
  const residentBytes = await requiredSource(path.join(source, "manifests/resident.json"))
  const resident: unknown = JSON.parse(residentBytes.toString("utf8"))
  if (!resident || typeof resident !== "object" || !("profiles" in resident) ||
    !("skills" in resident) || !Array.isArray(resident.profiles) || !Array.isArray(resident.skills) ||
    resident.profiles.length !== 5 || resident.skills.length !== 18)
    throw new Error("SF_FACTORY_RESIDENT_MANIFEST_INVALID")
  const profiles = resident.profiles as { id?: unknown; sourceDigest?: unknown }[]
  const skills = resident.skills as { id?: unknown; sourceDigest?: unknown }[]
  if (new Set(profiles.map((profile) => profile.id)).size !== 5 ||
    new Set(skills.map((skill) => skill.id)).size !== 18)
    throw new Error("SF_FACTORY_RESIDENT_ROSTER_DUPLICATE")
  const assets: { path: string; sha256: string }[] = []
  const stage = async (relative: string, bytes: Buffer, declared?: unknown) => {
    const hash = digest(bytes)
    if (declared !== undefined && (typeof declared !== "string" || declared !== hash))
      throw new Error(`SF_FACTORY_POLICY_SOURCE_DIGEST_MISMATCH: ${relative}`)
    const to = path.join(bin, "product/ai", relative)
    await mkdir(path.dirname(to), { recursive: true })
    await writeFile(to, bytes, { flag: "wx", mode: 0o644 })
    assets.push({ path: `bin/product/ai/${relative}`, sha256: hash })
  }
  await stage("manifests/resident.json", residentBytes)
  for (const profile of profiles) {
    if (typeof profile.id !== "string" || !/^sf_(maestro|finance|procurement|portfolio|reviewer)$/.test(profile.id))
      throw new Error("SF_FACTORY_PROFILE_ID_INVALID")
    const relative = `profiles/${profile.id}.json`
    await stage(relative, await requiredSource(path.join(source, relative)), profile.sourceDigest)
  }
  for (const skill of skills) {
    if (typeof skill.id !== "string" || !/^sf-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.id))
      throw new Error("SF_FACTORY_SKILL_ID_INVALID")
    const relative = `skills/${skill.id}/SKILL.md`
    await stage(relative, await requiredSource(path.join(source, relative)), skill.sourceDigest)
  }
  assets.sort((a, b) => a.path.localeCompare(b.path, "en"))
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, bundle, { flag: "wx", mode: 0o644 })
  const closure = {
    schema: "sf-factory-closure-v1" as const,
    entry: "modules/sucafina/Sucafinav1/local/entry.ts",
    bundle: { path: "bin/local/entry.mjs", sha256: digest(bundle) },
    inputs,
    assets,
  }
  await writeFile(ledger, JSON.stringify(closure, null, 2) + "\n", { flag: "wx", mode: 0o644 })
  if (digest(await readFile(target)) !== closure.bundle.sha256 ||
    (await Promise.all(assets.map(async (entry) =>
      digest(await readFile(path.join(bin, "..", entry.path))) === entry.sha256))).some((valid) => !valid))
    throw new Error("SF_FACTORY_STAGED_BYTES_CHANGED")
  return closure

  async function requiredSource(file: string) {
    const stat = await lstat(file)
    const canonical = await realpath(file)
    if (!canonical.startsWith(source + path.sep) || !stat.isFile() || stat.nlink !== 1 || !stat.size || canonical !== file)
      throw new Error(`SF_FACTORY_UNSAFE_ASSET: ${path.relative(root, file)}`)
    return readFile(canonical)
  }
}
