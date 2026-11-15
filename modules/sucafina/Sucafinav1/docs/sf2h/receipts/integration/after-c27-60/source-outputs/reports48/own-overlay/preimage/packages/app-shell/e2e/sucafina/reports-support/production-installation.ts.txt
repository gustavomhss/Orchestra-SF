import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import type { Page } from "@playwright/test"
import { Deferred, Effect, Stream } from "effect"
import { ChildProcess } from "effect/unstable/process"
import type { ChildProcessHandle } from "effect/unstable/process/ChildProcessSpawner"
import { chmod, mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

/** This fixture starts the existing CLI installation, never a fixture HTTP server. */
export type ReportsInstallation = {
  root: string
  config: string
  origin: string
  mount: string
  actorId: string
  dashboardURL: string
  workbenchURL: string
  /** Runs only the named Reports-owned Bun setup entry, with this private config. */
  setup: (operation: string, args?: readonly string[]) => Promise<string>
  /** Redeems a new, real, single-use operator enrollment without tracing its code. */
  signIn: (page: Page) => Promise<void>
}

type InstallationInput = {
  page: Page
  /** Must be an entry in the same reports-support directory as this fixture. */
  setupEntry: string
  /** Initial snapshots are written before the installed app starts and initializes sources. */
  initialize: (installation: Omit<ReportsInstallation, "signIn">) => Promise<void>
  /** A deadline for an observed process event, never a synchronization delay. */
  startupTimeoutMs: number
}

/** The nominal CI request supplies one worker, zero retries and a production bundle. */
export async function withReportsInstallation<T>(input: InstallationInput, use: (installation: ReportsInstallation) => Promise<T>) {
  if (process.env.GITHUB_ACTIONS !== "true") throw new Error("CI-UI-REPORTS runs only in GitHub Actions")
  if (!Number.isSafeInteger(input.startupTimeoutMs) || input.startupTimeoutMs < 1) throw new Error("An explicit startup deadline is required")
  const support = path.dirname(fileURLToPath(import.meta.url))
  const repository = path.resolve(support, "../../../../..")
  const entry = path.resolve(support, input.setupEntry)
  if (path.dirname(entry) !== support || !entry.endsWith(".ts")) throw new Error("Reports setup must stay in reports-support")
  const local = path.join(repository, "modules/sucafina/Sucafinav1/local")
  const owned: { child?: ChildProcessHandle } = {}

  return Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const launcher = yield* AppProcess.Service
    // Stay outside Playwright output directories: this directory holds private keys and credentials.
    const root = yield* Effect.acquireRelease(
      Effect.promise(async () => {
        const parent = await realpath(tmpdir())
        const directory = await mkdtemp(path.join(parent, "sf-reports-"))
        await chmod(directory, 0o700)
        await Promise.all(["host-data", "host-config", "host-cache", "host-state", "host-tmp"].map((name) =>
          mkdir(path.join(directory, name), { mode: 0o700 })))
        return directory
      }),
      (directory) => Effect.gen(function* () {
        // The spawner's child finalizer runs before this finalizer. Never delete a live app's database.
        if (owned.child && (yield* owned.child.isRunning)) throw new Error("Owned Reports CLI did not stop; private installation retained")
        yield* Effect.promise(() => rm(directory, { recursive: true, force: true }))
      }).pipe(Effect.orDie),
    )
    const lifetime = new AbortController()
    const pending = new Set<Promise<unknown>>()
    const track = <A>(work: () => Promise<A>) => {
      const promise = work()
      pending.add(promise)
      return promise.finally(() => pending.delete(promise))
    }
    yield* Effect.addFinalizer(() => Effect.promise(async () => {
      // Setup calls cross the Promise/Effect boundary. Cancel and join their owned children
      // before the earlier private-directory finalizer can remove their database.
      lifetime.abort()
      await Promise.allSettled([...pending])
    }))
    const config = path.join(root, "installation.json")
    const environment = isolatedEnvironment(root)
    const command = (args: readonly string[]) => ChildProcess.make("bun", [...args], {
      cwd: repository,
      env: environment,
      extendEnv: false,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      killSignal: "SIGTERM",
      forceKillAfter: "5 seconds",
    })
    const run = (args: readonly string[]) => track(async () => {
      const result = await Effect.runPromise(launcher.run(command(args), {
        timeout: input.startupTimeoutMs,
        maxOutputBytes: 64 * 1024,
        maxErrorBytes: 64 * 1024,
        signal: lifetime.signal,
      }))
      if (result.exitCode !== 0) throw new Error(`Reports setup exited ${result.exitCode}: ${redact(result.stderr.toString("utf8"))}`)
      if (result.stdoutTruncated || result.stderrTruncated) throw new Error("Reports setup output exceeded its bounded capture")
      return result.stdout.toString("utf8")
    })
    const app = yield* Effect.gen(function* () {
      yield* Effect.promise(() => run(["run", path.join(local, "prepare.ts"), root]))
      yield* Effect.promise(() => run(["run", path.join(local, "enroll.ts"), config, "--enable-local"]))
      const enrollment = { prepared: true }
      const profile = yield* Effect.promise(() => readOperatorProfile(config))
      const installation = {
        root,
        config,
        origin: profile.origin,
        mount: profile.mount,
        actorId: `macos:${profile.localOperator.installationId}:${profile.localOperator.uid}`,
        dashboardURL: `${profile.origin}${profile.mount}/dashboard`,
        workbenchURL: `${profile.origin}${profile.mount}/dashboard?sf=workbench`,
        setup: (operation: string, args: readonly string[] = []) => run(["run", entry, operation, config, ...args]),
      }
      yield* Effect.promise(() => track(() => input.initialize(installation)))

      const ready = yield* Deferred.make<void, Error>()
      const tail = { value: "" }
      const child = yield* launcher.spawn(command([
        "run", path.join(repository, "apps/cli/src/index.ts"), "serve",
        "--hostname", "localhost", "--port", "4110", "--installation", path.join(local, "entry.ts"),
      ]))
      owned.child = child
      // The real CLI emits this event after loading the actual host graph and binding its listener.
      // An occupied port makes this child fail; this fixture never adopts or stops another server.
      yield* Effect.forkScoped(child.all.pipe(
        Stream.decodeText,
        Stream.splitLines,
        Stream.runForEach((line) => {
          tail.value = `${tail.value}\n${redact(line)}`.slice(-8192)
          return /^server listening on http:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):4110\/?$/.test(line.trim())
            ? Deferred.succeed(ready, undefined)
            : Effect.void
        }),
        Effect.catch(() => Deferred.fail(ready, new Error(`Reports CLI output failed: ${tail.value}`))),
      ))
      yield* Effect.forkScoped(child.exitCode.pipe(
        Effect.flatMap((code) => Deferred.fail(ready, new Error(`Reports CLI exited ${code} before readiness: ${tail.value}`))),
        Effect.catch(() => Deferred.fail(ready, new Error(`Reports CLI stopped before readiness: ${tail.value}`))),
      ))
      yield* Deferred.await(ready)
      if (!(yield* child.isRunning)) throw new Error("Reports CLI stopped immediately after readiness")

      const authenticated = {
        ...installation,
        signIn: (page: Page) => track(async () => {
          if (!enrollment.prepared) await run(["run", path.join(local, "enroll.ts"), config])
          await redeemOperatorEnrollment(page, installation,
            AbortSignal.any([lifetime.signal, AbortSignal.timeout(input.startupTimeoutMs)]))
          enrollment.prepared = false
        }),
      }
      yield* Effect.promise(() => authenticated.signIn(input.page))
      return authenticated
    }).pipe(Effect.timeoutOrElse({
      duration: input.startupTimeoutMs,
      orElse: () => Effect.fail(new Error("Reports production installation startup timed out")),
    }))
    return yield* Effect.promise(() => use(app))
  })).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
}

function isolatedEnvironment(root: string) {
  const inherited = Object.fromEntries([
    "PATH", "SystemRoot", "WINDIR", "PATHEXT", "LANG", "LC_ALL", "TZ",
    "ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER", "ORCHESTRA_CHANNEL",
  ].flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]!]]))
  return {
    ...inherited,
    ORCHESTRA_DB: path.join(root, "host-data/orchestra.db"),
    ORCHESTRA_INHERIT_CREDENTIALS: "0",
    ORCHESTRA_DISABLE_PROJECT_CONFIG: "1",
    ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"),
    ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "host-credential.key"),
    TMPDIR: path.join(root, "host-tmp"),
    XDG_DATA_HOME: path.join(root, "host-data"),
    XDG_CONFIG_HOME: path.join(root, "host-config"),
    XDG_CACHE_HOME: path.join(root, "host-cache"),
    XDG_STATE_HOME: path.join(root, "host-state"),
    SUCAFINA_LOCAL_CONFIG: path.join(root, "installation.json"),
  }
}

async function readOperatorProfile(config: string) {
  const value: unknown = JSON.parse(await readFile(config, "utf8"))
  if (!value || typeof value !== "object" || !("origin" in value) || value.origin !== "http://localhost:4110" ||
      !("mount" in value) || value.mount !== "/sucafina" || !("authentication" in value) || value.authentication !== "local-operator" ||
      !("localOperator" in value) || !value.localOperator || typeof value.localOperator !== "object" ||
      !("installationId" in value.localOperator) || typeof value.localOperator.installationId !== "string" ||
      !("uid" in value.localOperator) || value.localOperator.uid !== process.getuid?.()) throw new Error("Actual local-operator installation required")
  return { origin: value.origin, mount: value.mount, localOperator: { installationId: value.localOperator.installationId, uid: value.localOperator.uid } }
}

async function redeemOperatorEnrollment(page: Page, installation: Omit<ReportsInstallation, "signIn">, signal: AbortSignal) {
  signal.throwIfAborted()
  const artifact = path.join(installation.root, "open-local.html")
  const html = await readFile(artifact, "utf8")
  // The existing production helper owns this private handoff format. Never open it as fixture HTML.
  const encoded = /<script>location\.replace\(("(?:[^"\\]|\\.)*")\)<\/script>/.exec(html)?.[1]
  if (!encoded) throw new Error("Production enrollment artifact is missing its destination")
  const destination = new URL(JSON.parse(encoded) as string)
  if (destination.origin !== installation.origin || destination.pathname !== `${installation.mount}/auth/local` ||
      destination.searchParams.size !== 1 || !/^[a-f0-9]{64}$/.test(destination.searchParams.get("code") ?? "")) throw new Error("Production enrollment destination is invalid")
  // Native fetch keeps the one-use bootstrap code outside retained Playwright traces.
  // The cookie below is the real handler's persisted session, never a fabricated credential.
  const response = await fetch(destination, { redirect: "manual", signal }).catch(() => {
    throw new Error("Production operator enrollment transport failed")
  })
  if (response.status !== 303 || response.headers.get("location") !== `${installation.mount}/dashboard`) throw new Error(`Production operator enrollment failed (${response.status})`)
  const cookies = response.headers.getSetCookie()
  const match = cookies.length === 1 ? /^(sucafina_operator_[a-f0-9]{24})=([a-f0-9]{64}); Path=(\/sucafina); HttpOnly; SameSite=Lax; Max-Age=(28800)$/.exec(cookies[0]!) : undefined
  if (!match) throw new Error("Production operator enrollment did not issue the expected scoped session")
  signal.throwIfAborted()
  await page.context().addCookies([{
    name: match[1]!, value: match[2]!, domain: new URL(installation.origin).hostname,
    path: match[3]!, httpOnly: true, sameSite: "Lax", secure: false,
    expires: Math.floor(Date.now() / 1000) + Number(match[4]),
  }])
  signal.throwIfAborted()
  await rm(artifact)
}

function redact(value: string) {
  return value.replace(/[a-f0-9]{64}/g, "[redacted]").replace(/(code=)[^&\s"']+/g, "$1[redacted]")
}
