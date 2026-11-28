import { createSfE16Forwarder } from "../../../../modules/sucafina/Sucafinav1/runtime/preview-progress-e16-diagnostic.ts"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { createHash } from "node:crypto"
import { Buffer } from "node:buffer"
import { lstatSync, readFileSync, realpathSync } from "node:fs"
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
    const eventEnvironment = nativePreviewE16EventEnvironment(root)
    const child = yield* app.spawn(ChildProcess.make(process.execPath, [
      entry, "serve", "--hostname", hostname, "--port", String(port), "--installation", factory,
    ], {
      cwd: root,
      env: {
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
        ...eventEnvironment,
      },
    }))
    const e16Forward = createSfE16Forwarder()
    const ready = yield* Deferred.make<void>()
    const diagnostic = { last: "" }
    yield* Effect.forkScoped(child.stdout.pipe(Stream.decodeText, Stream.map(e16Forward), Stream.splitLines, Stream.runForEach((line) => {
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


/** Neutralize only our diagnostic keys on refusal, including possible inherited values. */
function nativePreviewE16EventEnvironment(privateRoot: string): Record<string, string> {
  const directoryKey = "SF_PREVIEW_E16_EVENT_EVIDENCE_DIR", bindingKey = "SF_PREVIEW_E16_EVENT_EVIDENCE_BINDING"
  const disabled = { [directoryKey]: "", [bindingKey]: "" }
  const source = "ad3a4a7527baf1e092e87b5478626b2f0a3be57c", sourceTree = "11bf210f469be26630c39db586bcfcce87e0de1b"
  let stage = "binding"
  try {
    const directory = process.env[directoryKey], encoded = process.env[bindingKey]
    if (!directory && !encoded) return disabled
    if (!directory || !encoded || encoded.length > 4096 || process.platform !== "linux" || process.arch !== "x64" ||
        Bun.version !== "1.3.14" || Bun.revision !== "0d9b296af33f2b851fcbf4df3e9ec89751734ba4") throw new Error("cpu-binding")
    const value: unknown = JSON.parse(encoded)
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("cpu-binding")
    const binding = value as Record<string, unknown>
    if (binding.schema !== "sf-preview-e16-event-launch-v1" || binding.source !== source || binding.sourceTree !== sourceTree ||
        typeof binding.snapshot !== "string" || !/^[a-f0-9]{40}$/.test(binding.snapshot) ||
        typeof binding.runId !== "string" || !/^[0-9]{1,20}$/.test(binding.runId) || binding.attempt !== "1" ||
        typeof binding.nonce !== "string" || !/^sf613-e16-event-[A-Za-z0-9]{6}$/.test(binding.nonce) ||
        typeof binding.launcherBytes !== "number" || binding.launcherBytes < 1 || binding.launcherBytes > 8192 ||
        binding.launcherBytes % 1 !== 0 || typeof binding.launcherSha256 !== "string" || !/^[a-f0-9]{64}$/.test(binding.launcherSha256))
      throw new Error("cpu-binding")
    stage = "directory"
    const repository = realpathSync(path.resolve(path.dirname(entry), "../../.."))
    const base = path.join(repository, "test-ci-evidence"), info = lstatSync(directory)
    const relative = path.relative(realpathSync(privateRoot), directory)
    if (!path.isAbsolute(directory) || path.dirname(directory) !== base || path.basename(directory) !== binding.nonce ||
        realpathSync(base) !== base || realpathSync(directory) !== directory || !info.isDirectory() || info.isSymbolicLink() ||
        relative === "" || relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative))
      throw new Error("cpu-directory")
    stage = "launcher"
    const launcherPath = path.join(directory, "launcher.json"), launcherInfo = lstatSync(launcherPath)
    if (!launcherInfo.isFile() || launcherInfo.isSymbolicLink() || launcherInfo.size !== binding.launcherBytes)
      throw new Error("cpu-launcher")
    const text = readFileSync(launcherPath, "utf8")
    if (Buffer.byteLength(text, "utf8") !== binding.launcherBytes ||
        createHash("sha256").update(text, "utf8").digest("hex") !== binding.launcherSha256) throw new Error("cpu-launcher-hash")
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("cpu-launcher-shape")
    const launcher = parsed as Record<string, unknown>
    for (const key of ["schema", "source", "sourceTree", "snapshot", "runId", "attempt", "nonce"] as const)
      if (launcher[key] !== binding[key]) throw new Error("cpu-launcher-binding")
    if (launcher.processRole !== "native-cli" || launcher.streamName !== "preview-events.jsonl")
      throw new Error("cpu-launcher-role")
    return { [directoryKey]: directory, [bindingKey]: encoded }
  } catch {
    try {
      createSfE16Forwarder()("SF_PREVIEW_E16_LAUNCHER " + JSON.stringify({ schema: "sf-preview-causal-e16-launcher-v1", source, sourceTree,
        qualification: false, role: "native-launcher", kind: "disabled", reason: stage }) + "\n")
    } catch { /* The original child must still be spawned with its original settings. */ }
    return disabled
  }
}
