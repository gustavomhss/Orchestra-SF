import { expect } from "bun:test"
import { Database } from "bun:sqlite"
import { chmod, lstat, mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { randomUUID } from "node:crypto"
import { Deferred, Effect, Fiber, Option, Schema, Stream } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { AppProcess } from "@orchestra/core/process"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { testEffect } from "@orchestra/core/test/lib/effect"
import { prepareLocalConfiguration } from "@orchestra/sucafina/configuration"

const it = testEffect(LayerNode.compile(AppProcess.node))
const entry = fileURLToPath(new URL("../src/index.ts", import.meta.url))
const origin = "http://localhost:4111"
const mount = "/api/sucafina"
const Ready = Schema.Struct({ event: Schema.Literal("native-installation-ready"), artifact: Schema.String })
const decodeJson = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)
const decodeReady = Schema.decodeUnknownOption(Ready)

async function fixture() {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "native-serve-"))
  await chmod(root, 0o700)
  const installation = path.join(root, "installation")
  const configuration = await prepareLocalConfiguration(installation)
  const uid = process.getuid?.()
  if (uid === undefined) throw new Error("Native serve acceptance requires an OS owner UID")
  const installationId = randomUUID()
  await Bun.write(configuration, JSON.stringify({
    ...await Bun.file(configuration).json(),
    origin, authentication: "local-operator", localOperator: { uid, installationId },
  }))
  await chmod(configuration, 0o600)
  const webRoot = path.join(root, "public-web")
  const project = path.join(root, "project")
  await mkdir(webRoot)
  await mkdir(project)
  // Public serving/profile fixture only: this is deliberately not the actual native web bundle.
  await Bun.write(path.join(webRoot, "index.html"), '<!doctype html><title>Native serve fixture</title><p>PUBLIC-SERVE-FIXTURE</p>')
  await Bun.write(path.join(webRoot, "native-manifest.json"), JSON.stringify({ product: "Orchestra-SF", native: true, version: 1 }))
  const { openLocalStore } = await import("../../../modules/sucafina/Sucafinav1/runtime/local-store")
  const store = await openLocalStore(path.join(installation, "business-local"))
  try {
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.risks = [{ id: "serve-risk", name: "Serve fixture risk", status: "open", impact: 2, probability: 2 }]
      snapshot.versions["risks:serve-risk"] = { version: 2, by: "fixture" }
      return { commit: true, value: undefined }
    })
  } finally {
    await store.dispose()
  }
  return {
    root, installation, configuration, webRoot, project, installationId, uid,
    database: path.join(installation, "host-data", "orchestra.db"),
    environment: {
      PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
      LANG: "C",
      ORCHESTRA_SF_INSTALLATION: configuration,
      ORCHESTRA_WEB_UI_DIR: webRoot,
      ORCHESTRA_DB: path.join(installation, "host-data", "orchestra.db"),
      ORCHESTRA_CONFIG_DIR: path.join(installation, "host-config"),
      ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(installation, "host-credential.key"),
      ORCHESTRA_INHERIT_CREDENTIALS: "0",
      ORCHESTRA_DISABLE_PROJECT_CONFIG: "1",
      ORCHESTRA_DISABLE_MODELS_FETCH: "1",
      ORCHESTRA_DISABLE_AUTOUPDATE: "1",
      ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER: "1",
      XDG_DATA_HOME: path.join(installation, "host-data"),
      XDG_CONFIG_HOME: path.join(installation, "host-config"),
      XDG_CACHE_HOME: path.join(installation, "host-cache"),
      XDG_STATE_HOME: path.join(installation, "host-state"),
      TMPDIR: path.join(installation, "host-tmp"),
    },
  }
}

async function request(signal: AbortSignal, route: string, init: RequestInit = {}) {
  signal.throwIfAborted()
  return fetch(`${origin}${route}`, {
    ...init, redirect: "manual", signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
  })
}

it.live("source native serve admits the private installation and proves real cookies, APIs and Core DB writes", () =>
  Effect.scoped(Effect.gen(function* () {
    expectSpawn(import.meta.path)
    const lifetime = { started: false, drained: false }
    const f = yield* Effect.acquireRelease(
      Effect.promise(fixture),
      (value) => Effect.promise(async () => {
        if (lifetime.started && !lifetime.drained) throw new Error("Preserving fixture until owned child exits and output drains")
        await rm(value.root, { recursive: true, force: true })
      }),
    )
    yield* Effect.scoped(Effect.gen(function* () {
      const app = yield* AppProcess.Service
      const ready = yield* Deferred.make<string>()
      const output = { stdout: "", stderr: "", events: [] as unknown[] }
      const secrets: string[] = []
      const handle = yield* Effect.uninterruptibleMask(() => Effect.gen(function* () {
        const child = yield* app.spawn(ChildProcess.make(process.execPath, [
          entry, "serve", "--hostname", "localhost", "--port", "4111",
        ], { cwd: f.project, env: f.environment, extendEnv: false, stdin: "ignore", stdout: "pipe", stderr: "pipe" }))
        lifetime.started = true
        const stderrReader = yield* child.stderr.pipe(
          Stream.decodeText,
          Stream.runForEach((chunk) => Effect.sync(() => { output.stderr += chunk })),
          Effect.interruptible,
          Effect.forkScoped,
        )
        const stdoutReader = yield* child.stdout.pipe(
          Stream.decodeText, Stream.splitLines,
          Stream.runForEach((line) => Effect.gen(function* () {
            output.stdout += `${line}\n`
            const json = decodeJson(line)
            if (Option.isNone(json)) return
            const event = decodeReady(json.value)
            if (Option.isNone(event)) return
            output.events.push(json.value)
            yield* Deferred.succeed(ready, event.value.artifact)
          })),
          Effect.interruptible,
          Effect.forkScoped,
        )
        // Registered after the readers: stop and drain before their scope finalizers can interrupt them.
        yield* Effect.addFinalizer(() => Effect.gen(function* () {
          if (yield* child.isRunning) yield* child.kill({ forceKillAfter: "2 seconds" })
          yield* child.exitCode
          yield* Effect.all([Fiber.join(stdoutReader), Fiber.join(stderrReader)], { concurrency: "unbounded" })
          lifetime.drained = true
          yield* Effect.promise(async () => {
            const passwordFile = Bun.file(path.join(f.installation, "host-state", "orchestra", "password"))
            if (await passwordFile.exists()) secrets.push((await passwordFile.text()).trim())
            for (const secret of secrets) {
              expect(secret.length).toBeGreaterThan(0)
              expect(output.stdout).not.toContain(secret)
              expect(output.stderr).not.toContain(secret)
            }
            if (output.events.length > 0) expect(output.events).toHaveLength(1)
          })
        }).pipe(Effect.interruptible, Effect.timeout("15 seconds"), Effect.orDie))
        return child
      }))
      const artifact = yield* Deferred.await(ready).pipe(
        Effect.raceFirst(handle.exitCode.pipe(Effect.flatMap((code) => Effect.fail(new Error(`CLI exited before native readiness: ${code}`))))),
        Effect.timeout("60 seconds"),
      )
      yield* Effect.tryPromise(async (signal) => {
        const send = (route: string, init?: RequestInit) => request(signal, route, init)
        expect(artifact).toBe(path.join(f.installation, "open-native.html"))
        expect(output.events).toEqual([{ event: "native-installation-ready", artifact }])
        expect((await lstat(artifact)).mode & 0o777).toBe(0o600)
        const publicPage = await send("/")
        expect(publicPage.status).toBe(200)
        expect(await publicPage.text()).toContain("PUBLIC-SERVE-FIXTURE")
        const marker = await send("/native-manifest.json")
        expect(marker.status).toBe(200)
        expect(await marker.json()).toEqual({ product: "Orchestra-SF", native: true, version: 1 })
        const anonymous = await send(`${mount}/status`)
        expect(anonymous.status).toBe(200)
        expect(await anonymous.json()).toMatchObject({ configured: true, authentication: "local-operator", authenticated: false })
        expect((await send("/api/health")).status).toBe(401)
        expect((await send(`${mount}/dashboard/state?page=IT%20Risks`)).status).toBe(401)

        const html = await Bun.file(artifact).text()
        const encoded = html.match(/location\.replace\(("[^\n]+")\)/)?.[1]
        if (!encoded) throw new Error("Actual one-use enrollment artifact required")
        const target = new URL(JSON.parse(encoded))
        expect(target.origin).toBe(origin)
        expect(target.pathname).toBe(`${mount}/auth/local`)
        const code = target.searchParams.get("code")
        if (code) secrets.push(code)
        expect(code).toMatch(/^[a-f0-9]{64}$/)
        const redemption = await send(`${target.pathname}${target.search}`)
        expect(redemption.status).toBe(303)
        expect(redemption.headers.get("location")).toBe("/orchestra/sucafina/dashboard")
        const cookies = redemption.headers.getSetCookie()
        expect(cookies).toHaveLength(2)
        const native = cookies.find((cookie) => /(?:^|;\s*)Path=\/api\/sucafina(?:;|$)/i.test(cookie))
        const bridge = cookies.find((cookie) => /(?:^|;\s*)Path=\/api(?:;|$)/i.test(cookie))
        if (!native || !bridge) throw new Error("Separate native and Host bridge cookies required")
        for (const cookie of cookies) {
          expect(cookie).toMatch(/HttpOnly/i)
          expect(cookie).toMatch(/SameSite=Lax/i)
        }
        const nativePair = native.split(";")[0]
        const bridgePair = bridge.split(";")[0]
        expect(nativePair).toMatch(/^sucafina_operator_[a-f0-9]{24}=[a-f0-9]{64}$/)
        expect(bridgePair).toBe(`sucafina_host_bridge=${nativePair.replace("=", ".")}`)
        secrets.push(nativePair.slice(nativePair.indexOf("=") + 1), bridgePair.slice(bridgePair.indexOf("=") + 1), nativePair, bridgePair)
        const cookie = `${nativePair}; ${bridgePair}`
        const status = await send(`${mount}/status`, { headers: { cookie } })
        expect(status.status).toBe(200)
        expect(await status.json()).toMatchObject({
          configured: true, authentication: "local-operator", authenticated: true, hostAuthenticated: true,
          principal: { id: `macos:${f.installationId}:${f.uid}` },
        })
        expect((await send("/api/health", { headers: { cookie: bridgePair } })).status).toBe(200)
        const replay = await send(`${target.pathname}${target.search}`)
        expect(replay.status).toBe(403)
        expect(replay.headers.getSetCookie().some((value) => /Path=\/api(?:;|$)/i.test(value))).toBe(false)
        const before = await send(`${mount}/dashboard/state?page=IT%20Risks`, { headers: { cookie } })
        expect(before.status).toBe(200)
        const state = await before.json() as { data: { risks: { id: string; name: string }[] }; versions: Record<string, { version: number }> }
        expect(state.data.risks).toContainEqual(expect.objectContaining({ id: "serve-risk", name: "Serve fixture risk" }))
        const command = {
          page: "IT Risks", action: "save", id: "serve-risk", version: state.versions["risks:serve-risk"].version,
          values: { name: "Updated through actual CLI" },
        }
        const wrongOrigin = await send(`${mount}/dashboard/commands`, {
          method: "POST", headers: { cookie, origin: "http://localhost:4110", "content-type": "application/json" }, body: JSON.stringify(command),
        })
        expect(wrongOrigin.status).toBe(403)
        const saved = await send(`${mount}/dashboard/commands`, {
          method: "POST", headers: { cookie, origin, "content-type": "application/json" }, body: JSON.stringify(command),
        })
        expect(saved.status).toBe(200)
        expect(await saved.json()).toEqual({ ok: true })
        const after = await send(`${mount}/dashboard/state?page=IT%20Risks`, { headers: { cookie } })
        expect(after.status).toBe(200)
        expect((await after.json() as { data: { risks: unknown[] } }).data.risks)
          .toContainEqual(expect.objectContaining({ id: "serve-risk", name: "Updated through actual CLI" }))

        // The real Core API admits a Session without prompting a model or executing a provider turn.
        const created = await send("/api/session", {
          method: "POST", headers: { cookie: bridgePair, origin, "content-type": "application/json" },
          body: JSON.stringify({ location: { directory: f.project } }),
        })
        expect(created.status).toBe(200)
        const session = await created.json() as { data: { id: string } }
        expect(session.data.id).toMatch(/^ses_/)
        expect((await send(`/api/session/${session.data.id}`, { headers: { cookie: bridgePair } })).status).toBe(200)
        expect(await Bun.file(f.database).exists()).toBe(true)
        const database = new Database(f.database, { readonly: true })
        try {
          expect(database.query<{ id: string }, [string]>("select id from session where id = ?").get(session.data.id))
            .toEqual({ id: session.data.id })
        } finally {
          database.close()
        }
        for (const other of [
          path.join(f.installation, "host-data", "orchestra", "orchestra.db"),
          path.join(f.project, "orchestra.db"),
          path.join(f.root, "orchestra.db"),
          path.join(f.installation, "host-state", "orchestra", "server.json"),
        ]) expect(await Bun.file(other).exists()).toBe(false)

        expect((await send("/api/health", { headers: { cookie: bridgePair, origin: "http://localhost:4110" } })).status).toBe(401)
        const logout = await send(`${mount}/auth/logout`, { method: "POST", headers: { cookie, origin } })
        expect(logout.status).toBe(204)
        expect(logout.headers.getSetCookie()).toHaveLength(2)
        expect((await send("/api/health", { headers: { cookie: bridgePair } })).status).toBe(401)
        expect((await send(`${mount}/dashboard/state?page=IT%20Risks`, { headers: { cookie } })).status).toBe(401)
        expect(await Bun.file(path.join(f.installation, "host-state", "orchestra", "password")).exists()).toBe(true)
        expect(output.events).toHaveLength(1)
      })
    }))
  })).pipe(Effect.timeout("90 seconds")),
  120_000,
)
