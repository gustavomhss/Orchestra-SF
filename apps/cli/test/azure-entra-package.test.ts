import { expect } from "bun:test"
import { createHash } from "node:crypto"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { AppProcess } from "@orchestra/core/process"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { testEffect } from "@orchestra/core/test/lib/effect"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { prepareLocalConfiguration } from "../../../modules/sucafina/Sucafinav1/runtime/local-configuration"
import { binding, payloadFixture, payloadSnapshot } from "./fixture/distribution-payload"

const it = testEffect(LayerNode.compile(AppProcess.node))
const target = "linux-x64-baseline"
const archiveFile = "orchestra-sf-entra-linux-x64-baseline.tar.gz"
const factorySource = "modules/sucafina/Sucafinav1/local/microsoft-entry.ts"
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")

type PackagedFactory = {
  default: unknown
  createMicrosoftInstallation: (
    context: { origin: string },
    file: string,
    environment: Record<string, string>,
    overrides: { fetch(): Promise<Response> },
  ) => Promise<{
    mount: string
    trustedIngress: { origin: string; authorize(proof?: string): boolean }
    handler(request: Request): Promise<Response | undefined>
    dispose(): Promise<void>
  }>
}

it.live.skipIf(process.platform !== "linux")(
  "Azure Entra package preserves the raw CLI and mounts the extracted Microsoft factory",
  () => Effect.scoped(Effect.gen(function* () {
    const fixture = yield* Effect.acquireRelease(
      Effect.promise(() => payloadFixture([])),
      (fixture) => Effect.promise(() => rm(fixture.root, { recursive: true, force: true })),
    )
    const workspace = resolve(import.meta.dir, "../../..")
    const source = join(fixture.input.dist, `cli-${target}`)
    const out = join(fixture.root, "entra-package")
    const before = yield* Effect.promise(async () => {
      await rename(fixture.source, source)
      await writeFile(join(source, "package.json"), JSON.stringify({
        name: `@humanguardrail/cli-${target}`, version: fixture.input.version, os: ["linux"], cpu: ["x64"],
      }))
      await Promise.all(["orchestra", "hugr-omni-supervisor"].map((name) => writeFile(join(source, "bin", name), binding())))
      return payloadSnapshot(source)
    })
    const app = yield* AppProcess.Service
    expectSpawn(import.meta.path)
    const git = yield* app.run(ChildProcess.make("git", ["rev-parse", "--verify", "HEAD"], { cwd: workspace }))
    expect(git.exitCode).toBe(0)
    const sha = git.stdout.toString().trim()
    const produced = yield* app.run(ChildProcess.make(process.execPath, [
      join(workspace, "apps/cli/script/azure-entra-package.ts"),
      "--dist", fixture.input.dist, "--out", out, "--source-sha", sha,
    ], { cwd: workspace }))
    if (produced.exitCode !== 0) throw new Error(produced.stderr.toString())

    yield* Effect.promise(async () => {
      expect(await payloadSnapshot(source)).toEqual(before)
      const bytes = await readFile(join(out, archiveFile))
      const extracted = join(fixture.root, "extracted")
      await mkdir(extracted)
      await new Bun.Archive(bytes).extract(extracted)
      const bundlePath = join(extracted, "bin/local/entry.mjs")
      const bundleSha256 = hash(await readFile(bundlePath))
      const receipt = await Bun.file(join(out, "orchestra-sf-entra-package-receipt.json")).json()
      expect(receipt).toMatchObject({
        schema: "sf-entra-factory-package-v1", proof: "packaged", target, archiveFile,
        sourceSHA: sha, checkoutSHA: sha, expectedSourceSHA: sha,
        archiveSha256: hash(bytes), bundleSha256, manifestSha256: hash(await readFile(join(extracted, "distribution.json"))),
      })
      const closure = await Bun.file(join(extracted, "bin/local/closure.json")).json()
      expect(closure).toMatchObject({
        schema: "sf-factory-closure-v1", entry: factorySource, bundle: { path: "bin/local/entry.mjs", sha256: bundleSha256 }, assets: [],
      })
      expect(closure.inputs).toContainEqual({ path: factorySource, sha256: hash(await readFile(join(workspace, factorySource))) })

      const origin = "http://127.0.0.1:4110"
      const ingress = "http://sf-ingress.example.test:4110"
      const directory = join(fixture.root, "installation")
      const workspaceDirectory = join(fixture.root, "workspace")
      const file = await prepareLocalConfiguration(directory)
      const proof = "a".repeat(64)
      await mkdir(workspaceDirectory, { mode: 0o700 })
      await writeFile(file, JSON.stringify({
        version: 1, deployment: "azure-https", authentication: "microsoft",
        origin: "https://sf.example.test", listenerOrigin: origin, ingressOrigin: ingress, mount: "/sucafina",
        tenantId: "11111111-1111-4111-8111-111111111111", clientId: "22222222-2222-4222-8222-222222222222",
        workspaceDirectory, groups: { dashboard: {}, planner: {}, procurement: {} }, grants: [], scanner: null,
      }))
      await writeFile(join(directory, "client-secret.txt"), "synthetic-package-test", { mode: 0o600 })
      await writeFile(join(directory, "ingress-secret.txt"), proof, { mode: 0o600 })

      const factory: PackagedFactory = await import(pathToFileURL(bundlePath).href)
      expect(typeof factory.default).toBe("function")
      const external = { calls: 0 }
      const installation = await factory.createMicrosoftInstallation({ origin }, file, {
        ORCHESTRA_DB: join(directory, "host-data", "orchestra.db"),
        ORCHESTRA_INHERIT_CREDENTIALS: "0",
        ORCHESTRA_CONFIG_DIR: join(directory, "host-config"),
        ORCHESTRA_CREDENTIAL_KEY_FILE: join(directory, "host-credential.key"),
        TMPDIR: join(directory, "host-tmp"),
        XDG_DATA_HOME: join(directory, "host-data"),
        XDG_CONFIG_HOME: join(directory, "host-config"),
        XDG_CACHE_HOME: join(directory, "host-cache"),
        XDG_STATE_HOME: join(directory, "host-state"),
      }, {
        fetch() {
          external.calls++
          throw new Error("Anonymous dashboard must not fetch Microsoft identity or Graph")
        },
      })
      try {
        expect(installation.mount).toBe("/sucafina")
        expect(installation.trustedIngress.origin).toBe(ingress)
        expect(installation.trustedIngress.authorize(undefined)).toBe(false)
        expect(installation.trustedIngress.authorize(proof)).toBe(true)
        expect((await installation.handler(new Request(origin + "/sucafina/dashboard")))?.status).toBe(403)
        const response = await installation.handler(new Request(ingress + "/sucafina/dashboard", {
          headers: { host: new URL(ingress).host },
        }))
        expect(response?.status).toBe(303)
        expect(response?.headers.get("location")).toBe("/sucafina/auth/login")
        expect(external.calls).toBe(0)
      } finally {
        await installation.dispose()
      }
    })
  })),
  60_000,
)
