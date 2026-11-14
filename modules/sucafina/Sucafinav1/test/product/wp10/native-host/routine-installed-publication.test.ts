import { afterAll, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { AgentV2 } from "@orchestra/core/agent"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Host } from "@orchestra/core/host"
import { Location } from "@orchestra/core/location"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { Relay } from "@orchestra/core/relay"
import { RelayWorkflowBinding } from "@orchestra/core/relay-workflow-binding"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionStore } from "@orchestra/core/session/store"
import { SkillV2 } from "@orchestra/core/skill"
import { AuthoringGraph } from "@orchestra/relay/authoring/graph"
import { AuthoringStore } from "@orchestra/relay/authoring/store"
import type { RelayAuthoring } from "@orchestra/schema/relay-authoring"
import { Effect, Layer, ManagedRuntime } from "effect"
import type { Scope } from "effect"
import { createSfInstalledRoutinePublication } from "../../../../../../../apps/cli/src/sucafina-product/routine-installed-publication.ts"
import { createSfRoutinePublicationContribution } from "../../../../../../../apps/cli/src/sucafina-product/routine-publication.ts"
import { sfNativeLocationRef } from "../../../../../../../apps/cli/src/sucafina-product/native-identity.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { ResidentProfile } from "../../../../product/contracts/resident-ai.ts"
import type { SfBindingRegistry, SfNativeAdmission } from "../../../../product/contracts/runtime.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { createSfExecutionBindingRegistry } from "../../../../product/host-binding/execution-context.ts"
import { loadSfSkill } from "../../../../product/host-binding/skill-loader.ts"
import { registerSfResidentAgents } from "../../../../product/host-binding/resident-agents.ts"
import { acquireRoutineWorkflow, listPublishedRoutineWorkflows } from "../../../../product/routines/publication.ts"
import type { RoutinePublicationHost } from "../../../../product/routines/publication.ts"
import { createRoutineUiFixture } from "../../wp09/ui-authority-fixture.ts"
import { selection } from "../resident-runtime/fixture.ts"

// Real Location services, SkillV2 catalog, SQLite authoring and SF lease registries.
// Publication acquisition is preparation; this file never starts a governed C07 Task or records acceptance.
test("installed routine publication reads the authenticated Relay store, real skill bytes and required controls", async () => {
  await fixture((f) => Effect.gen(function* () {
    const document = yield* f.publish({ skill: true })
    expect(yield* Effect.promise(() => f.host.authorize(f.ui.context))).toBe(true)
    expect(yield* Effect.promise(() => f.host.authorSession(f.ui.context))).toBeUndefined()
    const catalog = yield* Effect.promise(() => listPublishedRoutineWorkflows(f.host, f.ui.context))
    expect(catalog.status).toBe("ok")
    if (catalog.status !== "ok") throw new Error(catalog.reason)
    expect(catalog.value).toContainEqual(expect.objectContaining({ documentId: document.id, publishedVersion: document.versionId }))
    const acquired = yield* Effect.promise(() => acquireRoutineWorkflow({ host: f.host, context: f.ui.context,
      projectID: f.projectID, documentId: document.id, expectedPublishedVersion: document.versionId,
      parameters: {}, writePaths: [] }))
    expect(acquired.status).toBe("ok")
    if (acquired.status !== "ok") throw new Error(acquired.reason)
    const skill = yield* f.skills.get("sf-explicar-forecast")
    if (!skill) throw new Error("Real publication skill unavailable")
    expect(acquired.value.definition.resolvedSkills).toContainEqual(expect.objectContaining({ skill: skill.name,
      content: skill.content, sha256: RelayWorkflowBinding.digest(Buffer.from(skill.content, "utf8")) }))
    const controls = acquired.value.sprint.work_packages.at(-1)?.checklist ?? []
    expect(controls.filter((entry) => entry.host_check === "package-verification")).toHaveLength(1)
    expect(controls.filter((entry) => entry.host_check === "cold-review")).toHaveLength(1)
    expect(acquired.value.definition.publication).toMatchObject({ projectID: f.projectID, documentID: document.id,
      activeVersionID: document.versionId, immutableVersionBodyChecksum: AuthoringStore.checksum(yield* f.authoring.version(document.id, document.versionId)) })
    const methods = yield* f.host.publication.use((store) => Effect.sync(() => Object.keys(store).toSorted()))
    expect(methods).toEqual(["documents", "get", "version"])
    expect(Host.merge([f.installed.contribution, f.publication.contribution]).nodes).toHaveLength(2)

    const changed = yield* Effect.promise(() => acquireRoutineWorkflow({ host: f.host, context: f.ui.context,
      projectID: f.projectID, documentId: document.id, expectedPublishedVersion: "a-different-published-version",
      parameters: {}, writePaths: [] }))
    expect(changed).toEqual({ status: "stale", reason: "published-version-changed" })
    yield* f.authoring.unpublish(document.id)
    const revoked = yield* Effect.result(RelayWorkflowBinding.revalidate(f.host.publication, acquired.value.definition))
    expect(revoked._tag).toBe("Failure")
    if (revoked._tag === "Failure") expect(revoked.failure).toMatchObject({ reason: "WORKFLOW_PUBLICATION_UNPUBLISHED" })
  }))
}, 120_000)

test("installed publication refuses actual catalog drift and cannot fabricate a knowledge author from UI parameters", async () => {
  await fixture((f) => Effect.gen(function* () {
    const document = yield* f.publish({ skill: true })
    const acquired = yield* RelayWorkflowBinding.acquire({ port: f.host.publication, projectID: f.projectID,
      documentID: document.id, parameters: {}, writePaths: [] })
    const before = yield* f.skills.get("sf-explicar-forecast")
    if (!before) throw new Error("Real publication skill unavailable")
    yield* f.skills.save(f.directory, { name: before.name, description: "Changed public catalog source", content: "# Changed factual instructions\n",
      location: before.location, ...(before.mtime === undefined ? {} : { mtime: before.mtime }) })
    const drift = yield* Effect.result(RelayWorkflowBinding.revalidate(f.host.publication, acquired.definition))
    expect(drift._tag).toBe("Failure")
    if (drift._tag === "Failure") expect(drift.failure).toMatchObject({ reason: "WORKFLOW_SKILL_DRIFT" })
    const missing = yield* Effect.result(f.host.publication.skills("missing-publication-skill"))
    expect(missing._tag).toBe("Failure")
    if (missing._tag === "Failure") expect(missing.failure).toMatchObject({ code: "skill-unavailable" })

    const knowledge = yield* f.publish({ knowledge: true })
    const denied = yield* Effect.promise(() => acquireRoutineWorkflow({ host: f.host, context: f.ui.context,
      projectID: f.projectID, documentId: knowledge.id, expectedPublishedVersion: knowledge.versionId,
      parameters: { authorSessionID: "ses_model_supplied", knowledge: "model text is not an anchor" }, writePaths: [] }))
    expect(denied).toEqual({ status: "unavailable", reason: "publication-unavailable" })
    expect(yield* Effect.promise(() => f.host.authorSession(f.ui.context))).toBeUndefined()
    const resolver = f.host.publication.knowledge
    if (!resolver) throw new Error("Installed publication must expose an explicit knowledge refusal")
    const unsupported = yield* Effect.result(resolver("a".repeat(64), "ses_model_supplied"))
    expect(unsupported._tag).toBe("Failure")
    if (unsupported._tag === "Failure") expect(unsupported.failure).toMatchObject({ reason: "SF_ROUTINE_KNOWLEDGE_PORT_UNAVAILABLE" })
  }))
}, 120_000)

test("publication egress rejects a revoked real UI lease and a replaced Location while store reads are suspended", async () => {
  await fixture((f) => Effect.gen(function* () {
    yield* f.publish({})
    // Changes only scheduling: the reader and authorization remain the installed implementations.
    const interleaved: RoutinePublicationHost = { ...f.host, publication: { ...f.host.publication,
      use: (read) => f.host.publication.use((store) => Effect.gen(function* () {
        const result = yield* read(store)
        f.ui.authority.finish(f.ui.context)
        return result
      })),
    } }
    expect(yield* Effect.promise(() => listPublishedRoutineWorkflows(interleaved, f.ui.context)))
      .toEqual({ status: "denied", reason: "publication-unavailable" })
    const retained = f.installed.publication()
    if (!retained) throw new Error("Installed provider unavailable")
    const replaced = yield* Effect.result(retained.publication.use((store) => Effect.gen(function* () {
      const values = yield* store.documents()
      f.placement.current = { ...f.placement.current!, location: sfNativeLocationRef({ directory: AbsolutePath.make(path.join(f.directory, "replacement")) }) }
      return values
    })))
    expect(replaced._tag).toBe("Failure")
    if (replaced._tag === "Failure") expect(replaced.failure).toMatchObject({ reason: "SF_ROUTINE_PUBLICATION_UNAVAILABLE" })
    const reads = { count: 0 }
    const old = yield* Effect.result(retained.publication.use(() => Effect.sync(() => { reads.count++; return "must not read" })))
    expect(old._tag).toBe("Failure")
    expect(reads.count).toBe(0)
  }))
}, 120_000)

test("installed publication refuses another project before a store read and revokes retained providers on disposal", async () => {
  const retained = await fixture((f) => Effect.gen(function* () {
    const original = f.placement.current!
    f.placement.current = { ...original, projectId: "different-publication-project" }
    const other = f.installed.publication()
    if (!other) throw new Error("Expected guarded provider for the changed placement")
    const reads = { count: 0 }
    const refused = yield* Effect.result(other.publication.use(() => Effect.sync(() => { reads.count++; return "must not read" })))
    expect(refused._tag).toBe("Failure")
    if (refused._tag === "Failure") expect(refused.failure).toMatchObject({ reason: "SF_ROUTINE_PUBLICATION_PROJECT_MISMATCH" })
    expect(reads.count).toBe(0)
    expect(yield* Effect.promise(() => other.authorize(f.ui.context))).toBe(false)
    f.placement.current = original
    const current = f.installed.publication()
    if (!current) throw new Error("Restored current provider unavailable")
    expect(current).not.toBe(f.installedHost)
    expect(yield* Effect.promise(() => current.authorize(f.ui.context))).toBe(true)
    expect(yield* Effect.promise(() => f.installedHost.authorize(f.ui.context))).toBe(false)
    return { host: current, installed: f.installed, ui: f.ui }
  }))
  expect(retained.installed.publication()).toBeUndefined()
  expect(await retained.host.authorize(retained.ui.context)).toBe(false)
  const reads = { count: 0 }
  const expired = await Effect.runPromise(Effect.result(retained.host.publication.use(() => Effect.sync(() => { reads.count++; return "must not read" }))))
  expect(expired._tag).toBe("Failure")
  if (expired._tag === "Failure") expect(expired.failure).toMatchObject({ reason: "SF_ROUTINE_PUBLICATION_UNAVAILABLE" })
  expect(reads.count).toBe(0)
}, 120_000)

test("publication author comes from the real registered Core session and refuses archive, removal and lease revocation", async () => {
  await fixture((f) => Effect.gen(function* () {
    const profile: ResidentProfile = { id: "sf_finance", version: "1", mission: "Publication identity fixture", sourcePath: "profile.json",
      sourceDigest: "a".repeat(64), allowedSkills: ["sf-explicar-forecast"], allowedOperations: ["sf_forecast_compare"], outputTypes: ["FinancialAnalysis"],
      contextBudgetTokens: 1000, maxSteps: 2, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh" }
    const selected = selection(profile)
    const actual = yield* f.skills.get("sf-explicar-forecast")
    if (!actual) throw new Error("Real resident skill unavailable")
    const runtime = { ...selected, skills: [{ ...selected.skills[0]!,
      sourceDigest: new Bun.CryptoHasher("sha256").update(f.skillFile).digest("hex"),
      instructionsDigest: new Bun.CryptoHasher("sha256").update(actual.content.trim()).digest("hex") }] }
    // The shared fixture already registered the ordinary catalog source. A resident
    // source must be a distinct managed root so its real reserved registration is unique.
    const residentSource = path.join(f.directory, "resident-skills")
    const residentSkill = path.join(residentSource, "sf-explicar-forecast", "SKILL.md")
    yield* Effect.promise(async () => {
      await mkdir(path.dirname(residentSkill), { recursive: true })
      await writeFile(residentSkill, f.skillFile)
    })
    const sourceCapability = yield* registerSfResidentAgents({ agents: f.agents, skills: f.skills, selected: [runtime],
      source: { type: "directory", path: AbsolutePath.make(residentSource) } })
    expect(yield* f.skills.get("sf-explicar-forecast")).toMatchObject({ location: residentSkill, content: actual.content })
    const session = yield* f.sessions.create({ location: f.location, agent: AgentV2.ID.make(profile.id) })
    yield* Effect.addFinalizer(() => f.sessions.remove(session.id).pipe(Effect.catch(() => Effect.void)))
    const receipt = yield* loadSfSkill({ session: f.sessions, skills: f.skills, sourceCapability, selected: runtime, sessionID: session.id,
      runId: "publication-author", profile, manifestDigest: runtime.manifestDigest, skill: runtime.skills[0]! })
    const request = new Request("https://example.test/wp10/publication-author")
    const admission: SfNativeAdmission = { request, selected: runtime, sessionID: session.id, runId: receipt.runId,
      caseRef: { id: "publication-case", incarnation: "publication-case-incarnation", version: 1 }, profile,
      manifestDigest: runtime.manifestDigest, skillReceipts: [receipt], entryMode: "interactive" }
    const admittedDigest = digestSfValue({ ...admission, request: undefined })
    const expiresAt = new Date(Date.now() + 120_000).toISOString()
    const inspect = async (value: SfNativeAdmission) => {
      if (value.request !== request || request.signal.aborted || digestSfValue({ ...value, request: undefined }) !== admittedDigest) return undefined
      const found = await Effect.runPromise(f.store.get(session.id))
      const loaded = await Effect.runPromise(f.store.message(SessionMessage.ID.make(receipt.loadedMessageId)))
      if (!found || found.id !== value.sessionID || found.agent !== profile.id || found.projectID !== f.projectID ||
        digestSfValue(found.location) !== digestSfValue(f.location) || loaded?.sessionID !== session.id || loaded.message.type !== "synthetic" ||
        !loaded.message.text.startsWith(`<skill_content name="${actual.name}">\n# Skill: ${actual.name}\n\n${actual.content.trim()}\n\n`)) return undefined
      return { installationId: f.placement.current!.installationId, hostId: f.placement.current!.hostId, projectId: f.projectID,
        locationId: digestSfValue(f.location), principalRef: "person", policyVersion: "publication-policy", accessRevision: "publication-access", providerGeneration: 1, expiresAt }
    }
    const registry = createSfExecutionBindingRegistry({ authenticateAndResolve: inspect,
      revalidateAdmission: async (value, binding) => {
        const current = await inspect(value)
        return !!current && Object.entries(current).every(([key, expected]) => key in binding && Reflect.get(binding, key) === expected)
      } })
    f.native.registry = registry
    const bound = yield* Effect.promise(() => registry.bind(admission))
    expect(bound.status).toBe("ok")
    if (bound.status !== "ok") throw new Error(bound.reason)
    const digest = digestSfValue({ publication: "author-identity" })
    const lease = yield* Effect.promise(() => registry.lease({ sessionID: session.id, agent: AgentV2.ID.make(profile.id),
      assistantMessageID: SessionMessage.ID.create(), toolCallID: "publication-author-call" }, "sf_forecast_compare", digest))
    expect(lease.status).toBe("ok")
    if (lease.status !== "ok") throw new Error(lease.reason)
    expect(registry.consume(lease.value, "sf_forecast_compare", digest)).toBe(true)
    expect(yield* Effect.promise(() => f.host.authorSession(lease.value))).toBe(session.id)
    yield* f.sessions.archive({ sessionID: session.id, archived: true })
    expect(yield* Effect.promise(() => f.host.authorSession(lease.value))).toBeUndefined()
    yield* f.sessions.archive({ sessionID: session.id, archived: false })
    expect(yield* Effect.promise(() => f.host.authorSession(lease.value))).toBe(session.id)
    registry.finish(lease.value)
    expect(yield* Effect.promise(() => f.host.authorSession(lease.value))).toBeUndefined()
    const removalLease = yield* Effect.promise(() => registry.lease({ sessionID: session.id, agent: AgentV2.ID.make(profile.id),
      assistantMessageID: SessionMessage.ID.create(), toolCallID: "publication-author-removal" }, "sf_forecast_compare", digest))
    expect(removalLease.status).toBe("ok")
    if (removalLease.status !== "ok") throw new Error(removalLease.reason)
    expect(registry.consume(removalLease.value, "sf_forecast_compare", digest)).toBe(true)
    expect(yield* Effect.promise(() => f.host.authorSession(removalLease.value))).toBe(session.id)
    yield* f.sessions.remove(session.id)
    expect(yield* Effect.promise(() => f.host.authorSession(removalLease.value))).toBeUndefined()
    registry.finish(removalLease.value)
  }))
}, 120_000)

type Fixture = {
  directory: string; source: string; skillFile: string; location: Location.Ref; projectID: RelayWorkflowBinding.PublicationPort["projectID"]
  placement: { current?: NonNullable<ReturnType<Parameters<typeof createSfInstalledRoutinePublication>[0]["identity"]>> }
  native: { registry?: SfBindingRegistry }; ui: Awaited<ReturnType<typeof createRoutineUiFixture>>
  installed: ReturnType<typeof createSfInstalledRoutinePublication>; publication: ReturnType<typeof createSfRoutinePublicationContribution>
  installedHost: RoutinePublicationHost; host: RoutinePublicationHost
  skills: SkillV2.Interface; agents: AgentV2.Interface; sessions: SessionV2.Interface; store: SessionStore.Interface; authoring: AuthoringStore.Interface
  publish: (options: { skill?: boolean; knowledge?: boolean }) => Effect.Effect<RelayAuthoring.Document, AuthoringGraph.Refusal>
}

// One real process root owns Core Session/SQLite and all Location services until
// the complete file ends. Publication providers retain their own fixture scopes.
async function openPublicationRoot() {
  const layer = AppNodeBuilder.build(LayerNode.group([SessionV2.node, SessionStore.node, SessionExecution.node, LocationServiceMap.node]),
    [[SessionExecution.node, SessionExecutionLocal.node]])
  const runtime = ManagedRuntime.make(layer)
  try {
    const services = await runtime.runPromise(Effect.gen(function* () {
      return { sessions: yield* SessionV2.Service, store: yield* SessionStore.Service, locations: yield* LocationServiceMap.Service }
    }))
    return { runtime, ...services }
  } catch (error) {
    try { await runtime.dispose() }
    catch (cleanup) { throw new AggregateError([error, cleanup], "Publication root acquisition and disposal failed") }
    throw error
  }
}

type PublicationRoot = Awaited<ReturnType<typeof openPublicationRoot>>
const publicationSuite: {
  root?: PublicationRoot; opening?: Promise<PublicationRoot>; active: boolean; closed: boolean; sequence: number; directories: Set<string>
} = { active: false, closed: false, sequence: 0, directories: new Set() }

async function acquirePublicationRoot() {
  if (publicationSuite.closed) throw new Error("Publication root already disposed")
  if (publicationSuite.root) return publicationSuite.root
  const opening = publicationSuite.opening ?? openPublicationRoot()
  publicationSuite.opening = opening
  try {
    const root = await opening
    publicationSuite.root = root
    return root
  } finally {
    // A failed acquisition is disposed by openPublicationRoot and is never cached.
    if (publicationSuite.opening === opening) publicationSuite.opening = undefined
  }
}

afterAll(async () => {
  publicationSuite.closed = true
  const failures: unknown[] = []
  if (publicationSuite.active) failures.push(new Error("Publication fixture still active during suite disposal"))
  try {
    const root = publicationSuite.root ?? (publicationSuite.opening ? await publicationSuite.opening : undefined)
    // ManagedRuntime closes the actual Location graph and its scoped users before
    // releasing their Core dependencies. No temporary directory is removed early.
    await root?.runtime.dispose()
  } catch (error) { failures.push(error) }
  finally {
    publicationSuite.root = undefined
    publicationSuite.opening = undefined
    for (const directory of publicationSuite.directories) {
      try { await rm(directory, { recursive: true, force: true }) }
      catch (error) { failures.push(error) }
    }
    publicationSuite.directories.clear()
  }
  if (failures.length) throw new AggregateError(failures, "Publication suite disposal failed")
})

async function fixture<A>(work: (fixture: Fixture) => Effect.Effect<A, unknown, Scope.Scope>) {
  if (publicationSuite.closed || publicationSuite.active) throw new Error("Publication fixtures require one active scope")
  publicationSuite.active = true
  const fixtureId = ++publicationSuite.sequence
  let phase = "directory.create"
  try {
    const directory = await mkdtemp(path.join(tmpdir(), "sf-installed-publication-"))
    publicationSuite.directories.add(directory)
    const source = path.join(directory, ".orchestra", "skills")
    const skillFile = "---\nname: sf-explicar-forecast\ndescription: Publication integration fixture\n---\n# Factual publication instructions\n"
    await mkdir(path.join(source, "sf-explicar-forecast"), { recursive: true })
    await mkdir(path.join(directory, "replacement"))
    await writeFile(path.join(source, "sf-explicar-forecast", "SKILL.md"), skillFile)
    phase = "root.acquire"
    const reusedRoot = publicationSuite.root !== undefined
    const root = await acquirePublicationRoot()
    console.info("SF_PUBLICATION_LIFECYCLE", JSON.stringify({ fixtureId, state: "root-acquired", reusedRoot }))
    const { sessions, store, locations } = root
    const placement: Fixture["placement"] = {}, native: Fixture["native"] = {}
    const access: { ui?: Fixture["ui"] } = {}
    const authorized = (call: TrustedDomainContext) => call.kind === "ui" ? access.ui?.authority.revalidate(call) ?? Promise.resolve(false)
      : native.registry?.revalidate(call) ?? Promise.resolve(false)
    const installed = createSfInstalledRoutinePublication({ identity: () => placement.current,
      host: { requestFor: (call) => call.kind === "ui" ? access.ui?.authority.requestFor(call) : native.registry?.requestFor(call), revalidate: authorized } })
    const publication = createSfRoutinePublicationContribution({ identity: () => placement.current, authorize: authorized, installed: installed.publication })
    expect(installed.publication()).toBeUndefined()
    // These two dependencies are the exact live services, not replacement readers.
    // Only the publication contributions are acquired/disposed for this fixture.
    const layer = LayerNode.compile(LayerNode.group([installed.node, publication.node]), [
      [SessionStore.node, Layer.succeed(SessionStore.Service, store)],
      [LocationServiceMap.node, Layer.succeed(LocationServiceMap.Service, locations)],
    ])
    phase = "providers.acquire"
    return await root.runtime.runPromise(Effect.gen(function* () {
      const location = sfNativeLocationRef({ directory: AbsolutePath.make(directory) })
      phase = "location.acquire"
      const placed = yield* Effect.gen(function* () {
        return { location: yield* Location.Service, relay: yield* Relay.Service, skills: yield* SkillV2.Service, agents: yield* AgentV2.Service }
      }).pipe(Effect.provide(locations.get(location)))
      const projectID = placed.location.project.id
      placement.current = Object.freeze({ installationId: "wp09-install", hostId: randomUUID(), projectId: projectID, location })
      const ui = yield* Effect.promise(() => createRoutineUiFixture(projectID, "person"))
      access.ui = ui
      yield* Effect.addFinalizer(() => Effect.sync(() => ui.authority.finish(ui.context)))
      yield* placed.skills.transform((draft) => draft.source({ type: "directory", path: AbsolutePath.make(source) }))
      phase = "authoring.open"
      const authoring = yield* AuthoringStore.open(placed.relay.paths.root, projectID)
      const owned: string[] = []
      yield* Effect.addFinalizer(() => Effect.forEach(owned, (id) => authoring.remove(id).pipe(Effect.catch(() => Effect.void)), { discard: true }))
      const publish = (options: { skill?: boolean; knowledge?: boolean }) => Effect.gen(function* () {
        const graph = yield* AuthoringGraph.project(`SF publication ${randomUUID()}`, {
          ...(options.knowledge ? { knowledge: ["a".repeat(64)] } : {}), work_packages: [{ id: "facts", instructions: "Prepare authorized facts",
            checklist: [{ id: "fixture-verification", cmd: "bun run typecheck" }] }],
        })
        const document = yield* authoring.save({ body: options.skill ? { ...graph, nodes: graph.nodes.map((node) =>
          node.id === "facts" ? { ...node, parameters: { ...node.parameters, skill: "sf-explicar-forecast" } } : node) } : graph })
        owned.push(document.id)
        return yield* authoring.publish(document.id, document.versionId)
      })
      const installedHost = installed.publication(), host = publication.publication()
      if (!installedHost || !host) throw new Error("Installed publication unavailable after graph acquisition")
      phase = "test.body"
      return yield* work({ directory, source, skillFile, location, projectID, placement, native, ui, installed, publication,
        installedHost, host, skills: placed.skills, agents: placed.agents, sessions, store, authoring, publish }).pipe(
          Effect.onExit((exit) => Effect.sync(() => { if (exit._tag === "Success") phase = "fixture.dispose" })),
        )
    }).pipe(Effect.provide(layer), Effect.scoped))
  } catch (error) {
    console.error("SF_PUBLICATION_LIFECYCLE_FAILURE", JSON.stringify({ fixtureId, phase }), error)
    throw error
  } finally { publicationSuite.active = false }
}
