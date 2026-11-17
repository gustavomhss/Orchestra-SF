/**
 * Staging-preview archive of the SF Linux distribution.
 *
 * Produces the same archive shape as the release factory (CLI + factory + Web),
 * but without the release qualification suite. It exists only so an operator can
 * install a preview build on a staging host; it is never a release artifact and
 * carries no receipt claim.
 */
import path from "node:path"
import { mkdir, writeFile, readFile } from "node:fs/promises"
import { archiveDistribution, prepareDistribution, verifyDistribution } from "./distribution-payload"

const target = "linux-x64-baseline"
const cli = path.resolve(import.meta.dir, "..")
const root = path.resolve(cli, "../..")
const out = path.join(root, "distribution-preview")
const version = String((await Bun.file(path.join(cli, "package.json")).json()).version)

await mkdir(out, { recursive: true })
const models = path.join(out, "models.json")
await writeFile(models, "{}\n")

const run = async (args: string[], cwd: string) => {
  const child = Bun.spawn([process.execPath, ...args], {
    cwd,
    env: { ...process.env, ORCHESTRA_VERSION: version, ORCHESTRA_CHANNEL: "dev", MODELS_DEV_API_JSON: models },
    stdout: "pipe", stderr: "pipe",
  })
  const [output, failure, code] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ])
  if (code !== 0) throw new Error(`SF_PREVIEW_COMMAND_FAILED: ${args.join(" ")}\n${failure.slice(-4000)}\n${output.slice(-1500)}`)
  console.log(`ok ${args.join(" ")}`)
}

await run(["script/build.ts", "--target", target, "--single", "--skip-install"], cli)
await run(["run", "--cwd", path.join(root, "apps/web"), "build"], root)

const manifest = await prepareDistribution({
  dist: path.join(cli, "dist"), web: path.join(root, "apps/web/dist"),
  out: path.join(out, "payload"), version, target,
})
const verified = await verifyDistribution(path.join(out, "payload"), { version, target })
if (JSON.stringify(verified) !== JSON.stringify(manifest)) throw new Error("SF_PREVIEW_VERIFY_MISMATCH")
const archive = await archiveDistribution({ directory: path.join(out, "payload"), file: path.join(out, "orchestra-sf-factory-linux-x64-baseline.tar.gz") })

await writeFile(path.join(out, "preview-receipt.json"), JSON.stringify({
  schema: "sf-preview-package-v1",
  kind: "staging-preview-not-a-release",
  sourceSHA: process.env.SF_PREVIEW_SOURCE_SHA ?? "",
  version,
  target,
  archiveFile: "orchestra-sf-factory-linux-x64-baseline.tar.gz",
  archiveSha256: archive.sha256,
  files: manifest.files.length,
  sourcemaps: manifest.files.filter((file: { path: string }) => file.path.endsWith(".map")).length,
  bytes: (await readFile(path.join(out, "orchestra-sf-factory-linux-x64-baseline.tar.gz"))).length,
}, null, 2) + "\n")
console.log(`SF_PREVIEW_PACKAGE_READY ${archive.sha256}`)
