/**
 * Fast local reproduction of the packaged-install local operator login.
 * Not a test: it builds the factory bundle the same way build.ts does, prepares
 * a private installation, enrolls the owner and drives the real CLI serve.
 *
 * The child binds 127.0.0.1 while "localhost" may resolve to ::1 first, where an
 * unrelated Sucafina runtime can already be listening. Requests therefore target
 * 127.0.0.1 with the installation's public Host header, which is the same origin
 * the packaged install sees in CI.
 */
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { prepareOperatorAccess } from "../../../modules/sucafina/Sucafinav1/local/enroll.ts"
import { prepareLocalConfiguration } from "../../../modules/sucafina/Sucafinav1/runtime/local-configuration.ts"

const cli = path.resolve(import.meta.dir, "..")
const root = path.resolve(cli, "../..")
const external = await realpath(await mkdtemp(path.join(await realpath(tmpdir()), "sf-repro-login-")))
const privateDir = path.join(external, "private-installation")

const built = await Bun.build({
  entrypoints: [path.join(root, "modules/sucafina/Sucafinav1/local/entry.ts")],
  target: "bun", format: "esm", splitting: false, minify: true, sourcemap: "none",
  loader: { ".txt": "text", ".json": "json" },
})
if (!built.success || built.outputs.length !== 1) throw new Error("SF_REPRO_BUNDLE_FAILED")

const config = await prepareLocalConfiguration(privateDir)
const bundlePath = path.join(privateDir, "local/entry.mjs")
await mkdir(path.dirname(bundlePath), { recursive: true, mode: 0o700 })
await writeFile(bundlePath, new Uint8Array(await built.outputs[0]!.arrayBuffer()))
await cp(path.join(root, "modules/sucafina/Sucafinav1/product/ai"), path.join(privateDir, "product/ai"), { recursive: true })

const access = await prepareOperatorAccess(config, true)
const handoff = (await readFile(access.artifact, "utf8")).match(/location\.replace\(("(?:\\.|[^"\\])*")\)/)?.[1]
if (!handoff) throw new Error("SF_REPRO_HANDOFF_MISSING")
const loginUrl: string = JSON.parse(handoff)
console.log("LOGIN URL:", loginUrl)

async function request(target: string, headers: string[] = []) {
  const child = Bun.spawn(["curl", "-s", "-D", "-", "-o", "-", "--max-time", "10",
    "-H", "Host: localhost:4110", ...headers.flatMap((header) => ["-H", header]),
    `http://127.0.0.1:4110${target}`], { stdout: "pipe", stderr: "pipe" })
  const [output, failure] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  if (failure) throw new Error(`SF_REPRO_REQUEST_FAILED: ${output} ${failure.slice(-300)}`)
  const split = output.indexOf("\r\n\r\n")
  const head = split < 0 ? output : output.slice(0, split)
  const body = split < 0 ? "" : output.slice(split + 4)
  const lines = head.split("\r\n").filter(Boolean)
  const status = Number(lines[0]?.split(" ")[1] ?? 0)
  const found = lines.slice(1).map((line) => {
    const at = line.indexOf(":")
    return [line.slice(0, at).toLowerCase(), line.slice(at + 1).trim()] as const
  })
  return { status, header: (name: string) => found.find(([key]) => key === name)?.[1], body }
}

const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    ["PATH", "LANG", "LC_ALL", "TZ", "HUGR_OMNI_ADDON", "HUGR_OMNI_SUPERVISOR"].includes(key))),
  HOME: privateDir,
  XDG_DATA_HOME: path.join(privateDir, "host-data"),
  XDG_CONFIG_HOME: path.join(privateDir, "host-config"),
  XDG_CACHE_HOME: path.join(privateDir, "host-cache"),
  XDG_STATE_HOME: path.join(privateDir, "host-state"),
  ORCHESTRA_CONFIG_DIR: path.join(privateDir, "host-config"),
  ORCHESTRA_INHERIT_CREDENTIALS: "0",
  ORCHESTRA_DISABLE_PROJECT_CONFIG: "1",
  ORCHESTRA_EXPERIMENTAL_DISABLE_FILEWATCHER: "true",
  ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(privateDir, "host-credential.key"),
  ORCHESTRA_DB: path.join(privateDir, "host-data/orchestra.db"),
  TMPDIR: path.join(privateDir, "host-tmp"),
  SUCAFINA_LOCAL_CONFIG: config,
}
const child = Bun.spawn([process.execPath, "src/index.ts", "serve", "--hostname", "localhost", "--port", "4110", "--installation", bundlePath], {
  cwd: cli, env, stdout: "pipe", stderr: "pipe",
})
const logs: string[] = []
void new Response(child.stdout as ReadableStream<Uint8Array>).text().then((text) => logs.push(text))
void new Response(child.stderr as ReadableStream<Uint8Array>).text().then((text) => logs.push(text))
try {
  const deadline = Date.now() + 420000
  for (;;) {
    if (child.exitCode !== null) throw new Error(`SF_REPRO_SERVE_EXITED: ${child.exitCode}\n${logs.join("").slice(-3000)}`)
    const status = await request("/sucafina/status").catch(() => undefined)
    if (status?.status === 200) { console.log("STATUS BODY:", status.body); break }
    if (Date.now() > deadline) throw new Error("SF_REPRO_SERVE_NEVER_READY")
    await Bun.sleep(1000)
  }
  const target = new URL(loginUrl)
  const login = await request(target.pathname + target.search)
  console.log("LOGIN STATUS:", login.status)
  console.log("LOGIN BODY:", login.body)
  const cookie = login.header("set-cookie")?.split(";")[0] ?? ""
  console.log("COOKIE:", cookie || "(none)")
  if (cookie) {
    const dashboard = await request("/sucafina/dashboard", [`Cookie: ${cookie}`])
    console.log("DASHBOARD STATUS:", dashboard.status)
    console.log("DASHBOARD HAS BANNER:", dashboard.body.includes("Homologação local"))
  }
} finally {
  child.kill("SIGKILL")
  await Promise.race([child.exited, Bun.sleep(5000)])
  if (!process.env.SF_REPRO_KEEP) await rm(external, { recursive: true, force: true })
  else console.log("KEPT:", external)
}
