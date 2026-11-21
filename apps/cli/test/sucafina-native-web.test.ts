import { expect } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { testEffect } from "@orchestra/core/test/lib/effect"
import { SfContextResult, SfInstallationList } from "@orchestra/schema/sucafina/context"
import { Effect, Schema } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { withNativeInstallation } from "./fixture/sucafina-native-installation"

const it = testEffect(LayerNode.compile(AppProcess.node))
const web = path.resolve(import.meta.dir, "../../web")

it.live.skipIf(process.platform !== "linux")(
  "the installed SF operator host serves the native Web bundle and its authenticated context",
  () => Effect.scoped(Effect.gen(function* () {
    expectSpawn(import.meta.path)
    const webRoot = yield* Effect.acquireRelease(
      Effect.promise(() => mkdtemp(path.join(tmpdir(), "sf-native-web-"))),
      (root) => Effect.promise(() => rm(root, { recursive: true, force: true })),
    )
    const processService = yield* AppProcess.Service
    const bundle = yield* processService.run(ChildProcess.make(process.execPath, ["run", "build", "--outDir", webRoot], {
      cwd: web,
    }))
    if (bundle.exitCode !== 0) throw new Error(`Native Web bundle failed: ${bundle.stderr.toString()}`)
    const serverPassword = randomUUID()
    const installed = yield* withNativeInstallation({ webRoot, serverPassword, seed: async () => {} })

    yield* Effect.promise(async () => {
      const shell = await fetch(installed.origin + "/orchestra/sf-documents", { redirect: "manual" })
      expect(shell.status).toBe(200)
      expect(shell.headers.get("content-type")).toContain("text/html")
      const html = await shell.text()
      expect(html).toContain('id="root"')
      const script = /<script\b[^>]*\bsrc="(\/assets\/[A-Za-z0-9_.-]+\.js)"/.exec(html)?.[1]
      if (!script) throw new Error("Native Web HTML did not reference a built JavaScript asset")
      const javascript = await fetch(installed.origin + script, { redirect: "manual" })
      expect(javascript.status).toBe(200)
      expect(javascript.headers.get("content-type")).toContain("javascript")
      expect(Buffer.from(await javascript.arrayBuffer())).toEqual(await readFile(path.join(webRoot, script.slice(1))))

      const discovery = new URL("/api/sucafina/installations", installed.origin)
      discovery.search = new URLSearchParams({ select: "location", "location[directory]": installed.root }).toString()
      expect((await fetch(discovery)).status).toBe(401)
      const authorized = await fetch(discovery, {
        headers: { Authorization: "Basic " + Buffer.from(`orchestra:${serverPassword}`).toString("base64") },
      })
      expect(authorized.status).toBe(200)
      const result = Schema.decodeUnknownSync(SfInstallationList, { onExcessProperty: "error" })(await authorized.json())
      expect(result.installations).toHaveLength(1)
      const descriptor = result.installations[0]!
      expect(descriptor).toMatchObject({ authMode: "local-operator", mount: installed.mount, publicOrigin: installed.origin })
      const query = new URLSearchParams({
        installationId: descriptor.installationId, projectId: descriptor.projectId, hostId: descriptor.hostId,
      })
      const contextPath = "/api/ui/context?" + query.toString()
      expect((await fetch(installed.origin + installed.mount + contextPath)).status).toBe(401)
      const response = await installed.request(contextPath)
      expect(response.status).toBe(200)
      const context = Schema.decodeUnknownSync(SfContextResult, { onExcessProperty: "error" })(await response.json())
      expect(context).toMatchObject({ status: "ok", value: { stamp: { principalRef: installed.actorId, hostId: descriptor.hostId } } })
    })
  })),
  240_000,
)
