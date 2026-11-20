import path from "node:path"
import { Effect, Layer, Scope } from "effect"
import { Database } from "../../src/database/database"
import { AuthorityControl } from "../../src/database/authority-control"
import { AuthoritySqlFence } from "../../src/database/authority-sql-fence"
import { openAuthorityControl } from "../../src/database/sqlite.bun"
import { AppNodeBuilder } from "../../src/effect/app-node-builder"
import { LayerNode } from "../../src/effect/layer-node"
import { EventV2 } from "../../src/event"
import { Global } from "../../src/global"
import { Location } from "../../src/location"
import { ProjectV2 } from "../../src/project"
import { AbsolutePath } from "../../src/schema"
import { SessionV2 } from "../../src/session"
import { AuthorityGeneration } from "../../src/session/authority-generation"
import { AuthorityGenerationRuntime } from "../../src/session/authority-generation-runtime"
import { SessionExecution } from "../../src/session/execution"
import { SessionOwner } from "../../src/session/owner"
import { ensureSchema } from "../../src/session/owner.sql"
import { SessionProjector } from "../../src/session/projector"
import { SessionStore } from "../../src/session/store"
import { SessionAccess } from "@orchestra/schema/session-access"
import type { SfProductGrant } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority"
import { productGrant, teamProductFixture } from "../../../../modules/sucafina/Sucafinav1/test/teams-profile/product-fixture"
import { profileA, profileB } from "../../../../modules/sucafina/Sucafinav1/test/teams-profile/installation-fixture"
import { oid, other } from "../../../../modules/sucafina/Sucafinav1/test/microsoft-login/oidc-fixture"

export { profileA, profileB, oid, other }

type Services = Database.Service | EventV2.Service | SessionV2.Service | SessionStore.Service |
  SessionOwner.Service | AuthorityGeneration.Service

/**
 * Signed OIDC, the installed private grant reader, actual role/resource snapshots,
 * real Core projectors and two durable SQLite files. The execution replacement is
 * explicitly recording-only; these tests never claim a model/provider run.
 */
export async function teamSessionFixture(input: {
  actions?: readonly SessionAccess.Action[]
  roles?: boolean
  grants?: readonly SfProductGrant[]
  legacyID?: SessionV2.ID
} = {}) {
  const declared = input.actions ?? SessionAccess.Actions
  const f = await teamProductFixture({
    roles: input.roles, enabled: [profileA, profileB],
    grants: input.grants ?? [oid, other].map((principalRef) => ({ ...productGrant(principalRef), sessionActions: declared })),
  })
  const filename = path.join(f.directory, "core-owned.sqlite")
  const hooks: { beforeProject?: () => Promise<void> } = {}
  const calls = { projects: 0, resumes: 0, wakes: 0 }
  const projects = Layer.succeed(ProjectV2.Service, ProjectV2.Service.of({
    resolve: (directory) => Effect.promise(async () => {
      calls.projects++
      await hooks.beforeProject?.()
      return { id: ProjectV2.ID.global, directory }
    }),
    list: () => Effect.succeed([]), directories: () => Effect.succeed([]), commit: () => Effect.void,
  }))
  const execution = Layer.succeed(SessionExecution.Service, SessionExecution.Service.of({
    active: Effect.succeed(new Set<SessionV2.ID>()),
    exclusive: (_, effect) => Effect.asSome(effect),
    withRunner: () => Effect.die("No model runner in a recording-only ownership fixture"),
    resume: () => Effect.sync(() => { calls.resumes++ }),
    wake: () => Effect.sync(() => { calls.wakes++ }),
    interrupt: () => Effect.void,
  }))
  const layer = () => Layer.fresh(AppNodeBuilder.build(
    LayerNode.group([Database.node, EventV2.node, SessionProjector.node, SessionStore.node,
      SessionV2.node, SessionOwner.node, AuthorityGenerationRuntime.node]),
    [
      [Database.node, Database.layerFromPath(filename)],
      [ProjectV2.node, projects],
      [SessionExecution.node, execution],
      [Global.node, Global.layerWith({ home: f.directory, data: f.directory, config: f.directory,
        cache: f.directory, state: f.directory })],
    ],
  ))
  const run = <A, E>(body: Effect.Effect<A, E, Services | Scope.Scope>) =>
    Effect.runPromise(body.pipe(Effect.provide(layer()), Effect.scoped))
  const location = Location.Ref.make({ directory: AbsolutePath.make(f.workspaceDirectory) })
  await run(Effect.gen(function* () {
    const database = yield* Database.Service
    yield* database.db.transaction(ensureSchema, { behavior: "immediate" }).pipe(Effect.orDie)
    if (input.legacyID) {
      const sessions = yield* SessionV2.Service
      yield* sessions.create({ id: input.legacyID, location })
    }
  }))
  const business = openAuthorityControl(filename)
  const controlDriver = openAuthorityControl(filename + ".authority.sqlite")
  const control = AuthorityControl.open(controlDriver)
  const storage = AuthorityGeneration.storageID(business, filename)
  const marker = () => AuthoritySqlFence.marker(business)
  const planHash = "a".repeat(64)
  control.registerSuspended(storage, planHash)
  business.execute("BEGIN IMMEDIATE")
  AuthoritySqlFence.install(business, { generation: 1, controlId: control.controlId })
  business.execute("COMMIT")
  control.activate(storage, 1, planHash, marker)

  const capture = (request = f.businessRequest()) => Effect.gen(function* () {
    const owners = yield* SessionOwner.Service
    const lease = yield* owners.capture(() => Effect.promise(() => f.authority.readCoreSessionAdmission(request)))
    if (!lease) return yield* Effect.die("Actual corporate Core admission required")
    return lease
  })
  const admitted = <A, E, R>(request: Request, effect: Effect.Effect<A, E, R>) =>
    Effect.flatMap(capture(request), (lease) => SessionOwner.withLease(lease, effect))
  let generation = 1
  const advance = () => {
    control.beginMaintenance(storage, generation)
    control.suspendDrained(storage, generation)
    const next = control.advanceSuspended(storage, generation, planHash)
    business.execute("BEGIN IMMEDIATE")
    AuthoritySqlFence.install(business, { generation: next, controlId: control.controlId })
    business.execute("COMMIT")
    control.activate(storage, next, planHash, marker)
    generation = next
  }
  return {
    ...f, filename, location, productHooks: f.hooks, hooks, calls, run, capture, admitted, business, controlDriver, control, storage, marker, advance,
    async [Symbol.asyncDispose]() {
      if (business.inTransaction()) business.execute("ROLLBACK")
      business.close()
      controlDriver.close()
      await f.close()
    },
  }
}
