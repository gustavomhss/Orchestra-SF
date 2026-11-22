import { lstat, realpath } from "node:fs/promises"
import path from "node:path"
import { Database } from "@orchestra/core/database/database"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventV2 } from "@orchestra/core/event"
import { ClaudeCodeAccount } from "@orchestra/core/claude-code-account"
import { FSUtil } from "@orchestra/core/fs-util"
import { AppProcess } from "@orchestra/core/process"
import { Location } from "@orchestra/core/location"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { MoveSession } from "@orchestra/core/control-plane/move-session"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionV2 } from "@orchestra/core/session"
import { SessionOwner } from "@orchestra/core/session/owner"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SessionProcess } from "@orchestra/core/session-process"
import { SessionSubagentModels } from "@orchestra/core/session/subagent-models"
import { TaskBackground } from "@orchestra/core/tool/task-background"
import { makeInstalledSessionHttp } from "@orchestra/server/session-http"
import { Effect, Exit, Layer, Scope } from "effect"

export interface SfTeamSessionHttpOptions {
  readonly origin: string
  readonly mount: string
  readonly directory: string
  readonly workspaceDirectory: string
  readonly readAdmission: (original: Request) => Promise<SessionOwner.Admission | undefined>
}

const services = LayerNode.group([
  Database.node, EventV2.node, SessionV2.node, SessionOwner.node, SessionExecution.node,
  SessionSubagentModels.node, SessionProcess.node, AppProcess.node, FSUtil.node,
  MoveSession.node, TaskBackground.node, LocationServiceMap.node, ClaudeCodeAccount.node,
])

/**
 * Loaded by the Microsoft entry only after a private admission succeeds.
 * Own exactly one coordinator and Location map for this dedicated installation.
 * Corporate database/control activation belongs to the reviewed migration path.
 */
export async function createSfTeamSessionHttp(options: SfTeamSessionHttpOptions) {
  const filename = path.join(options.directory, "host-data", "orchestra.db")
  if (Database.path() !== filename) throw new Error("Dedicated Microsoft session database required")
  await privatePath(path.dirname(filename), true)
  await privatePath(filename, false)
  await privatePath(filename + ".authority.sqlite", false)
  await privatePath(options.workspaceDirectory, true)
  const location = Location.Ref.make({ directory: AbsolutePath.make(options.workspaceDirectory) })
  const graph = AppNodeBuilder.build(services, [
    [Database.node, Database.layerFromPath(filename)],
    [SessionExecution.node, SessionExecutionLocal.node],
  ])
  const scope = Effect.runSync(Scope.make())
  let disposed = false
  const dispose = async () => {
    if (disposed) return
    disposed = true
    await Effect.runPromise(Scope.close(scope, Exit.succeed(undefined)))
  }
  try {
    const context = await Effect.runPromise(Layer.build(graph).pipe(Effect.provideService(Scope.Scope, scope)))
    const handler = await Effect.runPromise(makeInstalledSessionHttp({
      origin: options.origin, mount: options.mount, location: () => location,
      readAdmission: options.readAdmission,
    }).pipe(Effect.provide(Layer.succeedContext(context)), Effect.provideService(Scope.Scope, scope)))
    return {
      handler: (request: Request) => disposed
        ? Promise.resolve(new Response(null, { status: 503, headers: { "cache-control": "no-store" } }))
        : handler(request),
      dispose,
    }
  } catch (error) {
    await dispose()
    throw error
  }
}

async function privatePath(filename: string, directory: boolean) {
  const metadata = await lstat(filename)
  if ((directory ? !metadata.isDirectory() : !metadata.isFile()) || metadata.isSymbolicLink() ||
    process.getuid?.() !== metadata.uid || (metadata.mode & 0o077) !== 0 ||
    await realpath(filename) !== filename)
    throw new Error("Existing private Microsoft session storage required")
}
