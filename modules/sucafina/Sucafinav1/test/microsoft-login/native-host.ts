import { mkdir } from "node:fs/promises"
import path from "node:path"
import { Database } from "@orchestra/core/database/database"
import { makeGlobalNode } from "@orchestra/core/effect/app-node"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { PermissionSaved } from "@orchestra/core/permission/saved"
import { ClaudeCodeAccount } from "@orchestra/core/claude-code-account"
import { Global } from "@orchestra/core/global"
import type { Host } from "@orchestra/core/host"
import { Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { createEmbeddedRoutes } from "../../../../../packages/server/src/routes.ts"
import type { SfInstallation } from "../../../../../apps/cli/src/sucafina-product/installation.ts"
import type { privateFixture } from "./private-fixture.ts"

/** Initialize the original host graph with real SQLite and private test paths.
 * Only storage locations differ from the installed graph; identity, sessions,
 * role resolution, product grants and native producers are never substituted.
 */
export async function microsoftNativeHost(
  disk: {
    root: string
    directory: string
    environment: Pick<Awaited<ReturnType<typeof privateFixture>>["environment"],
      "ORCHESTRA_DB" | "ORCHESTRA_INHERIT_CREDENTIALS" | "ORCHESTRA_CONFIG_DIR" | "ORCHESTRA_CREDENTIAL_KEY_FILE">
  },
  installation: Omit<SfInstallation, "mount"> & { mount: string },
) {
  const data = path.join(disk.directory, "host-data")
  const locations = {
    home: disk.root, data, cache: path.join(disk.directory, "host-cache"),
    config: path.join(disk.directory, "host-config"), state: path.join(disk.directory, "host-state"),
    tmp: path.join(disk.directory, "host-tmp"), bin: path.join(data, "bin"),
    log: path.join(data, "log"), repos: path.join(data, "repos"),
  }
  await Promise.all(Object.values(locations).map((directory) => mkdir(directory, { recursive: true, mode: 0o700 })))
  const privateStorage: Host.Contribution = {
    id: "microsoft-test-private-storage",
    replacements: [
      [Database.node, makeGlobalNode({
        service: Database.Service, layer: Database.layerFromPath(disk.environment.ORCHESTRA_DB), deps: [],
      })],
      [Global.node, makeGlobalNode({
        service: Global.Service, layer: Global.layerWith(locations), deps: [],
      })],
    ],
  }
  const keys = ["ORCHESTRA_INHERIT_CREDENTIALS", "ORCHESTRA_CONFIG_DIR", "ORCHESTRA_CREDENTIAL_KEY_FILE"] as const
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  for (const key of keys) process.env[key] = disk.environment[key]
  const restore = () => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
  const router = HttpRouter.toWebHandler(createEmbeddedRoutes({
    host: [...installation.host ?? [], privateStorage],
    sucafinaInstallations: installation.discovery,
  }).pipe(
    HttpRouter.provideRequest(AppNodeBuilder.build(
      LayerNode.group([PermissionSaved.node, ClaudeCodeAccount.node]), privateStorage.replacements,
    )),
    Layer.provide(HttpServer.layerServices),
  ), { disableLogger: true })
  try {
    const selected = await installation.discovery?.current(new AbortController().signal)
    const origin = installation.transport?.ingressOrigin ?? selected?.publicOrigin
    if (!origin || !installation.host?.length || !installation.discovery) throw new Error("MICROSOFT_NATIVE_INSTALLATION_REQUIRED")
    const health = await router.handler(new Request(origin + "/api/health"))
    if (health.status !== 200) throw new Error("MICROSOFT_NATIVE_HOST_UNAVAILABLE:" + health.status)
    if (!selected?.identity()) throw new Error("MICROSOFT_NATIVE_IDENTITY_UNAVAILABLE")
    return { handler: router.handler, dispose: async () => { try { await router.dispose() } finally { restore() } } }
  } catch (error) {
    try { await router.dispose() } finally { restore() }
    throw error
  }
}
