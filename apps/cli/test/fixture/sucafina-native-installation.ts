import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir, userInfo } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { AppProcess } from "@orchestra/core/process"
import { Deferred, Effect, Stream } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { prepareLocalConfiguration, loadLocalConfiguration } from "../../../../modules/sucafina/Sucafinav1/runtime/local-configuration.ts"
import { prepareOperatorAccess } from "../../../../modules/sucafina/Sucafinav1/local/enroll.ts"
import { openLocalStore } from "../../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"

const entry = fileURLToPath(new URL("../../src/index.ts", import.meta.url))
const factory = fileURLToPath(new URL("../../../../modules/sucafina/Sucafinav1/local/entry.ts", import.meta.url))
const memoryFactory = fileURLToPath(new URL("./sucafina-memory-installation.ts", import.meta.url))
const hostname = "127.0.0.1"

export type NativeFixtureSeed = {
  root: string
  config: string
  origin: string
  mount: string
  actorId: string
  store: Awaited<ReturnType<typeof openLocalStore>>
  keys: Awaited<ReturnType<typeof loadLocalConfiguration>>["keys"]
}

export function withNativeInstallation(input: {
  memoryPrecedent?: boolean
  scanner?: { host: string; port: number }
  webRoot?: string
  serverPassword?: string
  seed: (seed: NativeFixtureSeed) => Promise<void>
}) {
  return Effect.gen(function* () {
    const root = yield* Effect.acquireRelease(
      Effect.promise(async () => mkdtemp(path.join(await realpath(tmpdir()), "sf-native-host-"))),
      (root) => Effect.promise(() => rm(root, { recursive: true, force: true })),
    )
    const reservation = Bun.serve({ hostname, port: 0, fetch: () => new Response() })
    const port = reservation.port!
    yield* Effect.promise(async () => { await reservation.stop(true) })
    const origin = `http://${hostname}:${port}`
    const seed = yield* Effect.promise(async () => {
      const config = await prepareLocalConfiguration(root, origin)
      if (input.scanner) {
        const current = await Bun.file(config).json()
        await Bun.write(config, JSON.stringify({ ...current, scanner: input.scanner }))
      }
      const access = await prepareOperatorAccess(config, true)
      const loaded = await loadLocalConfiguration(config)
      const operator = loaded.config.localOperator
      if (!operator?.name) throw new Error("Fixture enrollment did not persist its local operator identity")
      const actorId = `macos:${operator.installationId}:${userInfo().uid}`
      const shop = path.join(root, "business-local")
      const store = await openLocalStore(shop)
      try {
        await input.seed({ root, config, origin, mount: loaded.config.mount, actorId, store, keys: loaded.keys })
      } finally {
        await store.dispose()
      }
      const html = await Bun.file(access.artifact).text()
      const encodedUrl = /location\.replace\(("(?:[^"\\]|\\.)*")\)/.exec(html)?.[1]
      if (!encodedUrl) throw new Error("Fixture enrollment handoff missing")
      return { config, mount: loaded.config.mount, actorId, shop, signIn: JSON.parse(encodedUrl) as string }
    })
    const app = yield* AppProcess.Service
    const child = yield* app.spawn(ChildProcess.make(process.execPath, [
      entry, "serve", "--hostname", hostname, "--port", String(port), "--installation", input.memoryPrecedent ? memoryFactory : factory,
    ], {
      cwd: root,
      extendEnv: false,
      ...(input.memoryPrecedent ? { stdin: "pipe" as const } : {}),
      // Preserve host tools (tar/unzip for pinned acquisition) and the requested
      // runtime mode. Credentials and every writable store remain isolated below.
      env: {
        ...Object.fromEntries(["PATH", "ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER", "ORCHESTRA_CHANNEL"].flatMap((key) => {
          const value = process.env[key]
          return value === undefined ? [] : [[key, value]]
        })),
        SUCAFINA_LOCAL_CONFIG: seed.config,
        ORCHESTRA_DB: path.join(root, "host-data", "orchestra.db"),
        ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"),
        ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "host-credential.key"),
        ORCHESTRA_INHERIT_CREDENTIALS: "0",
        TMPDIR: path.join(root, "host-tmp"),
        XDG_DATA_HOME: path.join(root, "host-data"),
        XDG_CONFIG_HOME: path.join(root, "host-config"),
        XDG_CACHE_HOME: path.join(root, "host-cache"),
        XDG_STATE_HOME: path.join(root, "host-state"),
        ...(input.webRoot ? { ORCHESTRA_WEB_UI_DIR: input.webRoot } : {}),
        ...(input.serverPassword ? { ORCHESTRA_SERVER_PASSWORD: input.serverPassword } : {}),
      },
    }))
    const ready = yield* Deferred.make<void>()
    const published = yield* Deferred.make<void, Error>()
    const publication = { used: false }
    const diagnostic = { last: "" }
    yield* Effect.forkScoped(child.stdout.pipe(Stream.decodeText, Stream.splitLines, Stream.runForEach((line) => {
      if (/^SF_PLANNER_COST \d+(?: \d+){65}$/.test(line)) console.info(line)
      if (input.memoryPrecedent && line === "SF_NATIVE_MEMORY_COMMITTED") return Effect.asVoid(Deferred.succeed(published, undefined))
      const failed = input.memoryPrecedent && /^SF_NATIVE_MEMORY_FAILED (input|owner|scanner|manifest|admission|case|ledger|publication|receipt) ([a-z-]+)$/.exec(line)
      if (failed) return Effect.asVoid(Deferred.fail(published, new Error("Canonical memory precedent preparation failed: " + failed[1] + " (" + failed[2] + ")")))
      return line.includes(`server listening on ${origin}`) ? Effect.asVoid(Deferred.succeed(ready, undefined)) : Effect.void
    })))
    yield* Effect.forkScoped(child.stderr.pipe(Stream.decodeText, Stream.splitLines, Stream.runForEach((line) =>
      Effect.sync(() => { diagnostic.last = line.slice(0, 256) }),
    )))
    yield* Deferred.await(ready).pipe(
      Effect.raceFirst(child.exitCode.pipe(Effect.flatMap((code) =>
        Effect.fail(new Error(`Native serve exited before readiness (${code}): ${diagnostic.last}`)),
      ))),
      Effect.timeout("60 seconds"),
    )
    const cookie = yield* Effect.promise(async () => {
      const response = await fetch(seed.signIn, { redirect: "manual", signal: AbortSignal.timeout(10_000) })
      const cookie = response.headers.getSetCookie()[0]?.split(";")[0]
      if (response.status !== 303 || !cookie)
        throw new Error(`Native installation enrollment failed (HTTP ${response.status}, session cookie issued: ${Boolean(cookie)})`)
      return cookie
    })
    return {
      root,
      origin,
      mount: seed.mount,
      actorId: seed.actorId,
      businessDirectory: seed.shop,
      // A private, one-use setup command. It carries the genuine enrollment cookie
      // only through the owned subprocess pipe, never a URL, reporter or log.
      publishMemoryPrecedent: (caseRef: { id: string; incarnation: string; version: number }) => Effect.gen(function* () {
        if (!input.memoryPrecedent || publication.used) throw new Error("Memory precedent preparation is not available")
        publication.used = true
        yield* Stream.run(Stream.make(new TextEncoder().encode(JSON.stringify({ cookie, caseRef }))), child.stdin)
        yield* Deferred.await(published).pipe(
          Effect.raceFirst(child.exitCode.pipe(Effect.flatMap(() => Effect.fail(new Error("Native host stopped during memory preparation"))))),
          Effect.timeout("40 seconds"),
        )
      }),
      request: (pathname: string, init?: RequestInit) => {
        const headers = new Headers(init?.headers)
        headers.set("cookie", cookie)
        if (init?.method === "POST") headers.set("origin", origin)
        return fetch(origin + seed.mount + pathname, {
          ...init, headers, redirect: "manual", signal: AbortSignal.timeout(40_000),
        })
      },
    }
  })
}
