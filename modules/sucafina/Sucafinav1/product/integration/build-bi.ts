import path from "node:path"

const build = await Bun.build({ entrypoints: [path.join(import.meta.dir, "../interface/bi-entry.ts")], target: "browser", format: "iife", minify: true })
if (!build.success || build.outputs.length !== 1) throw new Error(`SF_BI_BUILD_FAILED:${build.logs.map((log) => log.message).join(";")}`)
const output = path.join(import.meta.dir, "generated/bi-entry.txt")
const source = await build.outputs[0]!.text()
if (Bun.argv.includes("--check")) {
  if (!await Bun.file(output).exists() || await Bun.file(output).text() !== source) throw new Error("SF_BI_BROWSER_BUNDLE_STALE")
}
if (!Bun.argv.includes("--check")) await Bun.write(output, source)
process.stdout.write(`SF BI browser: ${new Bun.CryptoHasher("sha256").update(source).digest("hex")}\n`)
