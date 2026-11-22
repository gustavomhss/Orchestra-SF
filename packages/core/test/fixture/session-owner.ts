import path from "node:path"
import { chmod, mkdir } from "node:fs/promises"
import { Effect, Layer, Schema, Scope } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SessionAccess } from "@orchestra/schema/session-access"
import { Database } from "../../src/database/database"
import type { CredentialVault } from "../../src/credential/vault"
import type { ProviderAdmission } from "../../src/provider/admission"
import { AuthorityControl } from "../../src/database/authority-control"
import { AuthorityControlFile } from "../../src/database/authority-control-file"
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
import { SessionProjector } from "../../src/session/projector"
import { SessionStore } from "../../src/session/store"
import { tmpdir } from "./tmpdir"

export const profileA = Schema.decodeUnknownSync(TeamProfile.Ref)({
  installationId: "core-owner-component",
  tenantId: "11111111-1111-4111-8111-111111111111",
  teamObjectId: "22222222-2222-4222-8222-222222222222",
})
export const profileB = Schema.decodeUnknownSync(TeamProfile.Ref)({
  ...profileA, teamObjectId: "33333333-3333-4333-8333-333333333333",
})
export const ownerA = Schema.decodeUnknownSync(TeamProfile.Owner)({
  profile: profileA,
  principal: { tenantId: profileA.tenantId, principalObjectId: "44444444-4444-4444-8444-444444444444" },
})
export const ownerB = Schema.decodeUnknownSync(TeamProfile.Owner)({ ...ownerA, profile: profileB })
export const ownerPerson = Schema.decodeUnknownSync(TeamProfile.Owner)({
  ...ownerA, principal: { ...ownerA.principal, principalObjectId: "55555555-5555-4555-8555-555555555555" },
})

type Services = Database.Service | EventV2.Service | SessionV2.Service | SessionStore.Service |
  SessionOwner.Service | AuthorityGeneration.Service

/**
 * Core component boundary: explicit test admissions drive the real opaque owner
 * service, SQL projectors, durable generation and independent control file.
 * No Microsoft login, product grant, Case ACL or model execution is claimed.
 * The execution port only counts advisory wakes; it cannot run a model.
 */
export async function sessionOwnerFixture<Extra extends LayerNode.Node<unknown, unknown, LayerNode.Tag | undefined> = never>(input: {
  actions?: readonly SessionAccess.Action[]
  storageLayout?: "component" | "installation"
  legacyID?: SessionV2.ID
  extraNodes?: readonly Extra[]
  inspection?: boolean
  connections?: (owner: TeamProfile.Owner) => CredentialVault.Factory
  providers?: (owner: TeamProfile.Owner) => ProviderAdmission.Factory
  replacements?: LayerNode.Replacements
} = {}) {
  const temporary = await tmpdir()
  const directory = temporary.path
  const workspaceDirectory = path.join(directory, "workspace")
  await mkdir(workspaceDirectory, input.storageLayout === "installation" ? { mode: 0o700 } : undefined)
  const filename = input.storageLayout === "installation"
    ? path.join(directory, "host-data", "orchestra.db") : path.join(directory, "core-owned.sqlite")
  if (input.storageLayout === "installation") await mkdir(path.dirname(filename), { mode: 0o700 })
  const hooks: { beforeProject?: () => Promise<void>; beforeConfiguration?: () => Promise<void> } = {}
  const calls = { projects: 0, resumes: 0, wakes: 0 }
  const projects = Layer.succeed(ProjectV2.Service, ProjectV2.Service.of({
    resolve: (placement) => Effect.promise(async () => {
      calls.projects++
      await hooks.beforeProject?.()
      return { id: ProjectV2.ID.global, directory: placement }
    }),
    list: () => Effect.succeed([]), directories: () => Effect.succeed([]), commit: () => Effect.void,
  }))
  const execution = Layer.succeed(SessionExecution.Service, SessionExecution.Service.of({
    active: Effect.succeed(new Set<SessionV2.ID>()),
    exclusive: (_, effect) => Effect.asSome(effect),
    withRunner: () => Effect.die("No model runner in a Core ownership component fixture"),
    resume: () => Effect.sync(() => { calls.resumes++ }),
    wake: () => Effect.sync(() => { calls.wakes++ }),
    interrupt: () => Effect.void,
  }))
  const layer = () => Layer.fresh(AppNodeBuilder.build(
    LayerNode.group([
      LayerNode.group([Database.node, EventV2.node, SessionProjector.node, SessionStore.node,
        SessionV2.node, SessionOwner.node, AuthorityGenerationRuntime.node]),
      LayerNode.group(input.extraNodes ?? []),
    ]),
    [
      [Database.node, Database.layerFromPath(filename)],
      [ProjectV2.node, projects],
      [SessionExecution.node, execution],
      [Global.node, Global.layerWith({ home: directory, data: directory, config: directory,
        cache: directory, state: directory })],
      ...input.replacements ?? [],
    ],
  ))
  const run = <A, E>(body: Effect.Effect<A, E, Services | LayerNode.Output<Extra> | Scope.Scope>) =>
    Effect.runPromise(body.pipe(Effect.provide(layer()), Effect.scoped))
  const location = Location.Ref.make({ directory: AbsolutePath.make(workspaceDirectory) })
  await run(Effect.gen(function* () {
    if (!input.legacyID) return
    const sessions = yield* SessionV2.Service
    yield* sessions.create({ id: input.legacyID, location })
  }))
  if (input.storageLayout === "installation") await chmod(filename, 0o600)
  const business = openAuthorityControl(filename)
  const controlDriver = AuthorityControlFile.open(filename + ".authority.sqlite", openAuthorityControl)
  const control = AuthorityControl.open(controlDriver)
  const storage = AuthorityGeneration.storageID(business, filename)
  const marker = () => AuthoritySqlFence.marker(business)
  const planHash = "a".repeat(64)
  control.registerSuspended(storage, planHash)
  business.execute("BEGIN IMMEDIATE")
  AuthoritySqlFence.install(business, { generation: 1, controlId: control.controlId })
  business.execute("COMMIT")
  control.activate(storage, 1, planHash, marker)

  const profileKey = (profile: TeamProfile.Ref) =>
    JSON.stringify([profile.installationId, profile.tenantId, profile.teamObjectId])
  const ownerKey = (owner: TeamProfile.Owner) =>
    JSON.stringify([profileKey(owner.profile), owner.principal.tenantId, owner.principal.principalObjectId])
  const revoked = new Set<string>()
  const exclusions = new Map<string, readonly SessionV2.ID[]>()
  const documents = new Map<string, TeamProfile.ConfigurationDocument>()
  const revision: { sequence: number; value: TeamProfile.ConfigRevision } = { sequence: 0, value: "cfg:0" }
  const actions = new Set(input.actions ?? SessionAccess.Actions)
  const configure = (profile: TeamProfile.Ref, document: TeamProfile.ConfigurationDocument) => {
    documents.set(profileKey(profile), Schema.decodeUnknownSync(TeamProfile.ConfigurationDocument)(document))
    revision.value = "cfg:" + ++revision.sequence
  }
  const capture = (owner: TeamProfile.Owner = ownerA) => Effect.gen(function* () {
    const owners = yield* SessionOwner.Service
    const capturedRevision = revision.value
    const valid = () => !revoked.has(ownerKey(owner)) && capturedRevision === revision.value
    const excluded = () => exclusions.get(ownerKey(owner)) ?? []
    const authorized = (action: SessionAccess.Action, sessionID?: SessionV2.ID) =>
      valid() && actions.has(action) && (!sessionID || !excluded().includes(sessionID))
    const admission: SessionOwner.Admission = {
      binding: { owner, revisions: { configRevision: capturedRevision, accessRevision: "core-test-authority" } },
      verifyCurrent: () => Effect.sync(valid),
      ...(input.connections ? { connections: input.connections(owner) } : {}),
      ...(input.providers ? { providers: input.providers(owner) } : {}),
      authorize: (action, sessionID) => Effect.sync(() => authorized(action, sessionID)),
      excludedSessions: () => Effect.sync(() => [...excluded()]),
      configuration: () => Effect.promise(async () => {
        await hooks.beforeConfiguration?.()
        const document = documents.get(profileKey(owner.profile))
        const snapshot: TeamProfile.ConfigurationSnapshot | undefined = document
          ? { origin: "installation-team-store", profile: owner.profile, configRevision: revision.value, document }
          : undefined
        return snapshot
      }),
      ...(input.inspection ? { inspect: (operations: ReadonlyArray<SessionOwner.InspectionOperation>) =>
        Effect.sync(() => valid() ? {
          authorized: operations.every((operation) => authorized(operation.action, operation.sessionID)),
          excludedSessions: [...excluded()],
        } : undefined) } : {}),
    }
    const lease = yield* owners.capture(() => Effect.succeed(admission))
    if (!lease) return yield* Effect.die("Core test admission was not captured")
    return lease
  })
  const admitted = <A, E, R>(owner: TeamProfile.Owner, effect: Effect.Effect<A, E, R>) =>
    Effect.flatMap(capture(owner), (lease) => SessionOwner.withLease(lease, effect))
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
    directory, workspaceDirectory, filename, location, hooks, calls, run, capture, admitted, configure,
    revoke: (owner: TeamProfile.Owner = ownerA) => { revoked.add(ownerKey(owner)) },
    exclude: (owner: TeamProfile.Owner, sessions: readonly SessionV2.ID[]) => { exclusions.set(ownerKey(owner), sessions) },
    business, controlDriver, control, storage, marker, advance,
    async [Symbol.asyncDispose]() {
      if (business.inTransaction()) business.execute("ROLLBACK")
      business.close()
      controlDriver.close()
      await temporary[Symbol.asyncDispose]()
    },
  }
}

export function barrier() {
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  return {
    entered: entered.promise,
    hold: async () => { entered.resolve(); await release.promise },
    release: () => release.resolve(),
  }
}
