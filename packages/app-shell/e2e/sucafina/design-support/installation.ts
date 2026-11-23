import type { BrowserContext } from "@playwright/test"
import type { ChildProcessHandle } from "effect/unstable/process/ChildProcessSpawner"
import { chmod, mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

export type DesignInstallation = {
  root: string
  workspace: string
  origin: string
  mount: string
  actorId: string
  signIn: string
  serverPassword: string
  year: number
  month: number
  topicName: string
  opexName: string
  riskName: string
  projectName: string
}

/** Node owns the Bun adapter's scope; the existing fixture owns the real CLI. */
export async function withDesignInstallation<T>(use: (installation: DesignInstallation) => Promise<T>, wave: "one" | "two" | "three" | "four" | "four-decisions" | "four-files" = "one", options: { scanner?: { host: "127.0.0.1"; port: number } } = {}) {
  const scanner = options.scanner
  if (scanner && (scanner.host !== "127.0.0.1" || !Number.isInteger(scanner.port) || scanner.port < 1 || scanner.port > 65535))
    throw new Error("The native capture scanner must be the qualified loopback ClamD")
  if (wave === "four-files" && (process.env.GITHUB_ACTIONS !== "true" ||
      process.env.RUNNER_OS !== "Linux" || process.env.RUNNER_ARCH !== "X64" ||
      process.env.GITHUB_REPOSITORY !== "gustavomhss/Orchestra-SF"))
    throw new Error("The Files design fixture requires the actual Linux X64 GitHub Actions runner")
  const support = path.dirname(fileURLToPath(import.meta.url))
  const repository = path.resolve(support, "../../../../..")
  // Test listing must not initialize the process graph.
  const [{ AppProcess }, { LayerNode }, { Deferred, Effect, Stream }, { ChildProcess }] = await Promise.all([
    import("@orchestra/core/process"),
    import("@orchestra/core/effect/layer-node"),
    import("effect"),
    import("effect/unstable/process"),
  ])
  const owned: { child?: ChildProcessHandle } = {}
  return Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const launcher = yield* AppProcess.Service
    const root = yield* Effect.acquireRelease(
      Effect.promise(async () => {
        const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-design-capture-"))
        await chmod(directory, 0o700)
        await Promise.all(["host-data", "host-config", "host-cache", "host-state", "host-tmp"].map((name) =>
          mkdir(path.join(directory, name), { mode: 0o700 })))
        return directory
      }),
      (directory) => Effect.gen(function* () {
        if (owned.child && (yield* owned.child.isRunning))
          throw new Error("Owned native design host did not stop; private files retained")
        yield* Effect.promise(() => rm(directory, { recursive: true, force: true }))
      }).pipe(Effect.orDie),
    )
    const installed = yield* Effect.gen(function* () {
      const ready = yield* Deferred.make<void, Error>()
      const diagnostic = { tail: "" }
      const child = yield* launcher.spawn(ChildProcess.make("bun", [path.join(support, "native-host.ts"), root, wave, ...(scanner ? [JSON.stringify(scanner)] : [])], {
        cwd: repository,
        env: isolatedEnvironment(root),
        extendEnv: false,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        killSignal: "SIGTERM",
        forceKillAfter: "10 seconds",
      }))
      owned.child = child
      yield* Effect.forkScoped(child.stdout.pipe(Stream.decodeText, Stream.splitLines, Stream.runForEach((line) => {
        if (/^SF_DESIGN_STAGE [a-z-]+$/.test(line) || line.startsWith("SF_IMPORT_PROFILE ")) console.info(line)
        return line === "SF_DESIGN_READY" ? Effect.asVoid(Deferred.succeed(ready, undefined)) : Effect.void
      }), Effect.catch(() => Deferred.fail(ready, new Error("Native design host output failed")))))
      yield* Effect.forkScoped(child.stderr.pipe(Stream.decodeText, Stream.splitLines, Stream.runForEach((line) =>
        Effect.sync(() => { diagnostic.tail = (diagnostic.tail + "\n" + redact(line)).slice(-8192) }),
      )))
      yield* Deferred.await(ready).pipe(Effect.raceFirst(child.exitCode.pipe(Effect.flatMap((code) =>
        Effect.promise(async () => {
          const saved = await readFile(path.join(root, "failure.txt"), "utf8").catch(() => "")
          throw new Error("Native design host exited before readiness (" + code + "): " + redact(saved || diagnostic.tail))
        }),
      ))))
      if (!(yield* child.isRunning)) throw new Error("Native design host stopped after readiness")
      const file = path.join(root, "installation.json")
      const value: unknown = JSON.parse(yield* Effect.promise(() => readFile(file, "utf8")))
      if (!isInstallation(value)) throw new Error("Native design host returned invalid metadata")
      yield* Effect.promise(() => rm(file))
      return value
    }).pipe(Effect.timeoutOrElse({
      duration: "180 seconds",
      orElse: () => Effect.fail(new Error("Native design build/setup deadline exceeded")),
    }))
    return yield* Effect.promise(() => use(installed))
  })).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
}

function isolatedEnvironment(root: string): Record<string, string> {
  // In particular, do not inherit the production config's VITE_* server override.
  const inherited: Record<string, string> = {}
  for (const key of ["PATH", "SystemRoot", "WINDIR", "PATHEXT", "LANG", "LC_ALL", "TZ",
    "ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER", "ORCHESTRA_CHANNEL"]) {
    const value = process.env[key]
    if (value !== undefined) inherited[key] = value
  }
  return {
    ...inherited,
    ORCHESTRA_INHERIT_CREDENTIALS: "0",
    ORCHESTRA_DISABLE_PROJECT_CONFIG: "1",
    ORCHESTRA_DB: path.join(root, "host-data/orchestra.db"),
    ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"),
    ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "host-credential.key"),
    TMPDIR: path.join(root, "host-tmp"),
    XDG_DATA_HOME: path.join(root, "host-data"),
    XDG_CONFIG_HOME: path.join(root, "host-config"),
    XDG_CACHE_HOME: path.join(root, "host-cache"),
    XDG_STATE_HOME: path.join(root, "host-state"),
  }
}

function isInstallation(value: unknown): value is DesignInstallation {
  if (!value || typeof value !== "object") return false
  const fields = ["root", "workspace", "origin", "mount", "actorId", "signIn", "serverPassword", "topicName", "opexName", "riskName", "projectName"] as const
  if (!fields.every((field) => field in value && typeof Reflect.get(value, field) === "string")) return false
  return "year" in value && typeof value.year === "number" && Number.isSafeInteger(value.year) &&
    "month" in value && typeof value.month === "number" && Number.isInteger(value.month) && value.month >= 1 && value.month <= 12
}

/** Real discovery, unauthorized control, one-use enrollment, then original context. */
export async function authenticateDesignInstallation(context: BrowserContext, installed: DesignInstallation) {
  const [{ Schema }, { SfInstallationList, SfContextResult }] = await Promise.all([
    import("effect"), import("@orchestra/schema/sucafina/context"),
  ])
  const origin = new URL(installed.origin)
  if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || installed.mount !== "/sucafina")
    throw new Error("Expected the isolated native loopback installation")
  const discovery = new URL("/api/sucafina/installations", origin)
  discovery.search = new URLSearchParams({ select: "location", "location[directory]": installed.workspace }).toString()
  const found = await context.request.get(discovery.href, { timeout: 20_000 })
  if (found.status() !== 200) throw new Error("Native installation discovery failed (" + found.status() + ")")
  const list = Schema.decodeUnknownSync(SfInstallationList, { onExcessProperty: "error" })(await found.json())
  console.info("SF_DESIGN_DISCOVERY " + JSON.stringify({
    selector: "native-workspace",
    count: list.installations.length,
    installations: list.installations.map(({ installationId, projectId, hostId }) => ({ installationId, projectId, hostId })),
  }))
  if (list.installations.length !== 1)
    throw new Error("Expected exactly one actual installed owner (received " + list.installations.length + ")")
  const descriptor = list.installations[0]!
  if (descriptor.authMode !== "local-operator" || descriptor.publicOrigin !== installed.origin || descriptor.mount !== installed.mount)
    throw new Error("Discovered owner does not match the actual local operator installation")
  const query = new URLSearchParams({
    installationId: descriptor.installationId, projectId: descriptor.projectId, hostId: descriptor.hostId,
  })
  const contextURL = installed.origin + installed.mount + "/api/ui/context?" + query
  const denied = await context.request.get(contextURL, { timeout: 20_000 })
  if (denied.status() !== 401) throw new Error("Native context did not require the operator session")
  const handoff = new URL(installed.signIn)
  if (handoff.origin !== installed.origin || handoff.pathname !== installed.mount + "/auth/local" ||
      handoff.searchParams.size !== 1 || !/^[a-f0-9]{64}$/.test(handoff.searchParams.get("code") ?? ""))
    throw new Error("Enrollment handoff is outside the actual native installation")
  // Playwright reports API request URLs even with tracing off. Redeem the real
  // handoff through native fetch so its one-use code never enters reporter steps.
  // Do not follow the legacy redirect; the first document is /orchestra/.
  const login = await fetch(handoff, { redirect: "manual", signal: AbortSignal.timeout(20_000) }).catch(() => {
    throw new Error("Original operator enrollment transport failed")
  })
  if (login.status !== 303 || login.headers.get("location") !== installed.mount + "/dashboard")
    throw new Error("Original operator enrollment failed (" + login.status + ")")
  const issued = readOperatorSessionCookie(login.headers, origin.hostname, installed.mount)
  await context.addCookies([{ ...issued, expires: Math.floor(Date.now() / 1000) + 28_800 }])
  const cookies = (await context.cookies(installed.origin + installed.mount)).filter((cookie) =>
    /^sucafina_operator_[a-f0-9]{24}$/.test(cookie.name))
  if (cookies.length !== 1 || !/^[a-f0-9]{64}$/.test(cookies[0]!.value) ||
      cookies[0]!.path !== installed.mount || !cookies[0]!.httpOnly || cookies[0]!.sameSite !== "Lax")
    throw new Error("Original enrollment did not install its scoped HttpOnly browser session")
  const response = await context.request.get(contextURL, { timeout: 20_000 })
  if (response.status() !== 200) throw new Error("Authenticated native context failed (" + response.status() + ")")
  const result = Schema.decodeUnknownSync(SfContextResult, { onExcessProperty: "error" })(await response.json())
  if (result.status !== "ok" || result.value.stamp.principalRef !== installed.actorId ||
      result.value.stamp.hostId !== descriptor.hostId || result.value.stamp.projectId !== descriptor.projectId ||
      result.value.stamp.installationId !== descriptor.installationId)
    throw new Error("Authenticated native context does not belong to the actual operator")
  return descriptor
}

/** Preserve the exact cookie emitted by the original handler, including its policy. */
function readOperatorSessionCookie(headers: Headers, hostname: string, mount: string) {
  const values = headers.getSetCookie()
  if (values.length !== 1) throw new Error("Original enrollment did not issue exactly one session")
  const parts = values[0]!.split(";").map((part) => part.trim())
  const issued = /^(sucafina_operator_[a-f0-9]{24})=([a-f0-9]{64})$/.exec(parts[0]!)
  const attributes = parts.slice(1)
  const required = ["Path=" + mount, "HttpOnly", "SameSite=Lax", "Max-Age=28800"]
  if (!issued || attributes.length !== required.length || new Set(attributes).size !== required.length ||
      !required.every((attribute) => attributes.includes(attribute)))
    throw new Error("Original enrollment cookie policy did not match the native installation")
  return { name: issued[1]!, value: issued[2]!, domain: hostname, path: mount,
    httpOnly: true, secure: false, sameSite: "Lax" as const }
}

function redact(value: string) {
  return value.replace(/[a-f0-9]{64}/g, "[redacted]").replace(/code=[^&\s"']+/g, "code=[redacted]")
}
