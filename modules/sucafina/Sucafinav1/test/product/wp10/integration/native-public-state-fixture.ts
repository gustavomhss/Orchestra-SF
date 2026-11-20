import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { initializeAbsentSfProductState } from "../../../../product/host-binding/state-provider.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../../runtime/operator-identity.ts"

/** Installed native HTTP handlers, real operator enrollment and SQLite.
 * No browser, network listener, synthetic context or replacement domain view.
 */
export async function nativePublicStateFixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-native-public-state-"))
  await chmod(directory, 0o700)
  const cleanups: (() => Promise<void>)[] = [() => rm(directory, { recursive: true, force: true })]
  const close = async () => {
    const failures: unknown[] = []
    for (const cleanup of [...cleanups].reverse()) {
      try { await cleanup() } catch (error) { failures.push(error) }
    }
    if (failures.length) throw new AggregateError(failures, "Native public state fixture cleanup failed")
  }
  try {
    const driver = await openLocalStore(directory)
    cleanups.push(() => driver.dispose())
    const at = "2026-11-13T04:01:10Z", origin = "http://127.0.0.1", mount = "/sucafina"
    const persistence = { ...driver, ...createSfSourcePersistence({
      persistence: driver, enumerate: enumerateSfSources, createId: randomUUID,
      projectScope: createSfSourceScopeProjector(() => at),
    }) }
    for (const surface of ["dashboard", "planner", "procurement"] as const)
      await persistence.initializeSources(surface)
    await initializeAbsentSfProductState(persistence, randomUUID)
    const installationId = randomUUID()
    const identity = createOperatorIdentity({
      origin, mount, operator: { installationId, uid: 1000, name: "Privacy operator" },
      secrets: driver.secrets, key: randomBytes(32),
    })
    const principalRef = "macos:" + installationId + ":1000"
    await import("@orchestra/core/global")
    const { createOperationsInstallation } = await import("../../../../../../../packages/app-shell/e2e/sucafina/operations-support/installation.ts")
    const { createEmbeddedRoutes } = await import("../../../../../../../packages/server/src/routes.ts")
    const { AppNodeBuilder } = await import("@orchestra/core/effect/app-node-builder")
    const { PermissionSaved } = await import("@orchestra/core/permission/saved")
    const { ClaudeCodeAccount } = await import("@orchestra/core/claude-code-account")
    const installation = await createOperationsInstallation({
      installationId, directory, origin, mount,
      operators: [{ principalRef, readOnly: false }], persistence,
      authenticate: identity.authenticate, isAuthenticated: async (request) => Boolean(await identity.person(request)),
      environment: async (request) => ({ at, id: randomUUID, directory: await identity.directory(request) }),
      signingKey: randomBytes(32), scanner: null,
    })
    const embedded = HttpRouter.toWebHandler(createEmbeddedRoutes({
      host: installation.host, sucafinaInstallations: installation.discovery,
    }).pipe(
      HttpRouter.provideRequest(AppNodeBuilder.build(LayerNode.group([PermissionSaved.node, ClaudeCodeAccount.node]))),
      Layer.provide(HttpServer.layerServices),
    ), { disableLogger: true })
    cleanups.push(() => embedded.dispose())
    const health = await embedded.handler(new Request(origin + "/api/health"))
    const binding = installation.identity()
    if (health.status !== 200 || !binding) throw new Error("Native public state host did not initialize")
    const enrollment = await identity.handle(new Request(origin + mount + "/auth/local?code=" + await identity.enroll()))
    if (enrollment?.status !== 303) throw new Error("Native public state enrollment failed")
    const cookie = enrollment.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ")
    if (!cookie) throw new Error("Native public state session missing")
    const read = (pathname: string) => installation.application(new Request(origin + pathname, { headers: { cookie, origin } }))
    const post = (body: unknown) => installation.application(new Request(origin + mount + "/dashboard", {
      method: "POST", headers: { cookie, origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
    }))
    const context = await read(mount + "/api/ui/context?" + new URLSearchParams({
      installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
    }))
    if (context?.status !== 200 || (await context.json()).status !== "ok") throw new Error("Native public state authority unavailable")
    return { persistence, at, principalRef, read, post, close }
  } catch (error) {
    try { await close() } catch (cleanup) { throw new AggregateError([error, cleanup], "Native public state setup failed") }
    throw error
  }
}
