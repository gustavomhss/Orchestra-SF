import { expect, type Page, type TestInfo } from "@playwright/test"
import { spawn, execFile } from "node:child_process"
import { chmod, mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { readOperatorSessionCookie } from "../decisions-support/operator-session-cookie"
import { connectInstalledShell, installedShellOrigin } from "../installed-shell"

const run = promisify(execFile)
const here = path.dirname(fileURLToPath(import.meta.url))
const repository = path.resolve(here, "../../../../..")
const origin = installedShellOrigin()

/** Launch the distributed CLI and installation factory; no alternate application or route handler. */
export async function startPlannerInstallation(info: TestInfo) {
  // The fixture owns this private upstream listener. Refuse to borrow an
  // existing service, and never terminate a process the fixture did not create.
  const reservation = createServer()
  await new Promise<void>((resolve, reject) => {
    reservation.once("error", reject)
    reservation.listen(4174, "127.0.0.1", () => resolve())
  })
  await new Promise<void>((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()))
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-wp03-browser-"))
  await chmod(directory, 0o700)
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    ["PATH", "BUN_INSTALL", "LANG", "LC_ALL", "TZ", "CI", "SYSTEMROOT", "WINDIR"].includes(key) || key.startsWith("HUGR_OMNI_")))
  const environment = {
    ...inherited,
    ORCHESTRA_DB: path.join(directory, "host-data", "orchestra.db"),
    ORCHESTRA_CONFIG_DIR: path.join(directory, "host-config"),
    ORCHESTRA_INHERIT_CREDENTIALS: "0",
    ORCHESTRA_DISABLE_PROJECT_CONFIG: "1",
    ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(directory, "host-credential.key"),
    ORCHESTRA_LOG_LEVEL: "DEBUG",
    SUCAFINA_LOCAL_CONFIG: path.join(directory, "installation.json"),
    TMPDIR: path.join(directory, "host-tmp"),
    XDG_DATA_HOME: path.join(directory, "host-data"),
    XDG_CONFIG_HOME: path.join(directory, "host-config"),
    XDG_CACHE_HOME: path.join(directory, "host-cache"),
    XDG_STATE_HOME: path.join(directory, "host-state"),
  }
  try {
    // The child runtime can initialize XDG directories before the setup entry runs.
    await Promise.all(["host-data", "host-config", "host-cache", "host-state", "host-tmp", "business"]
      .map((name) => mkdir(path.join(directory, name), { mode: 0o700 })))
    await run("bun", ["run", path.join(here, "installation-setup.ts"), directory, origin], {
      cwd: repository, env: environment, timeout: 30_000, encoding: "utf8",
    })
  } catch (error) {
    await rm(directory, { recursive: true, force: true })
    throw new Error(redactDiagnostics(error instanceof Error ? error.message : String(error)))
  }
  const child = spawn("bun", ["run", path.join(repository, "apps/cli/src/index.ts"), "serve", "--hostname", "127.0.0.1", "--port", "4174",
    "--public-origin", origin, "--installation", path.join(repository, "modules/sucafina/Sucafinav1/local/entry.ts")], {
    cwd: directory, env: environment, stdio: ["ignore", "pipe", "pipe"],
  })
  const state = { log: "", error: undefined as Error | undefined, stopped: false, secrets: [] as string[] }
  const capture = (chunk: Buffer) => { state.log = (state.log + chunk.toString("utf8")).slice(-64_000) }
  child.stdout.on("data", capture)
  child.stderr.on("data", capture)
  child.once("error", (error) => { state.error = error })
  const exited = () => child.exitCode !== null || child.signalCode !== null || !!state.error
  const stop = async () => {
    if (state.stopped) return
    state.stopped = true
    let listenerReleased = false
    try {
      if (!exited()) child.kill("SIGTERM")
      try { await expect.poll(exited, { message: "the fixture-owned CLI exits after SIGTERM", timeout: 15_000 }).toBe(true) }
      catch {
        if (!exited()) child.kill("SIGKILL")
        await expect.poll(exited, { message: "the fixture-owned CLI is no longer running", timeout: 5_000 }).toBe(true)
      }
      await expect.poll(portAvailable, { message: "the fixture-owned local listener releases 127.0.0.1:4174", timeout: 5_000 }).toBe(true)
      listenerReleased = true
    } finally {
      // DEBUG diagnostics can include authentication URLs or HTTP headers. Redact
      // known credentials and credential-shaped fields before creating an artifact.
      await info.attach("wp03-real-cli.log", { body: redactDiagnostics(state.log, state.secrets), contentType: "text/plain" })
      if (exited() && listenerReleased) await rm(directory, { recursive: true, force: true })
    }
  }
  try {
    await expect.poll(async () => {
      if (exited()) return `CLI exited: ${state.error?.message ?? child.exitCode ?? child.signalCode}`
      try {
        const response = await fetch(`${origin}/sucafina/status`, { signal: AbortSignal.timeout(1_000) })
        if (!response.ok) return `HTTP ${response.status}`
        const contentType = response.headers.get("content-type") ?? ""
        if (!contentType.includes("application/json")) return `Unexpected status content type: ${contentType}`
        const body = await response.json() as { login?: string }
        return body.login
      } catch { return "not-listening" }
    }, { message: "the real CLI serves the isolated local-operator installation", timeout: 75_000 }).toBe("local-operator")
    console.info("[sf-installed] The real CLI installation is ready")
    const config = JSON.parse(await readFile(environment.SUCAFINA_LOCAL_CONFIG, "utf8")) as { localOperator: { installationId: string; uid: number } }
    const handoff = (await readFile(path.join(directory, "open-local.html"), "utf8")).match(/location\.replace\(("[^"\r\n]*")\)/)?.[1]
    if (!handoff) throw new Error("Production enrollment artifact is malformed")
    const enrollment = new URL(JSON.parse(handoff) as string)
    if (enrollment.origin !== origin || enrollment.pathname !== "/sucafina/auth/local" || !enrollment.searchParams.has("code"))
      throw new Error("Production enrollment destination is unexpected")
    state.secrets.push(enrollment.searchParams.get("code")!)
    // Consume the real one-use code through Node's HTTP client so its private URL
    // never appears in a Playwright action, trace or assertion failure. The browser
    // receives only the session actually issued by the production identity handler.
    const admitted = await fetch(enrollment, { redirect: "manual", signal: AbortSignal.timeout(10_000) })
    if (admitted.status !== 303 || admitted.headers.get("location") !== "/")
      throw new Error(`Production local enrollment failed with HTTP ${admitted.status}`)
    const cookie = { ...readOperatorSessionCookie(admitted.headers), domain: new URL(origin).hostname }
    state.secrets.push(cookie.value)
    const actorId = `macos:${config.localOperator.installationId}:${config.localOperator.uid}`
    return { origin, cookie, actorId, stop,
      signIn: async (page: Page) => {
        await page.context().addCookies([cookie])
        return connectInstalledShell(page, { root: directory, origin, mount: "/sucafina", actorId })
      },
    }
  } catch (error) {
    await stop()
    throw error
  }
}

async function portAvailable() {
  const probe = createServer()
  const available = await new Promise<boolean>((resolve, reject) => {
    probe.once("error", (error: NodeJS.ErrnoException) => error.code === "EADDRINUSE" ? resolve(false) : reject(error))
    probe.listen(4174, "127.0.0.1", () => resolve(true))
  })
  if (available) await new Promise<void>((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()))
  return available
}

function redactDiagnostics(value: string, secrets: readonly string[] = []) {
  for (const secret of secrets) {
    value = value.split(secret).join("[redacted]")
    value = value.split(encodeURIComponent(secret)).join("[redacted]")
  }
  return value
    .replace(/([?&](?:code|token|password|secret)=)[^&#\s"'<>]*/gi, "$1[redacted]")
    .replace(/(sucafina_operator_[a-f0-9]{24}=)[^;\s"']*/gi, "$1[redacted]")
    .replace(/((?:authorization|set-cookie|cookie)\s*[:=]\s*)[^\r\n]*/gi, "$1[redacted]")
    .replace(/\b[a-f0-9]{32,}\b/gi, "[redacted-hex]")
}
