import { expect, test } from "bun:test"
import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { createModule } from "../../../index.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import type { SfHumanAction } from "../../../product/integration/human-authority.ts"
import { createSfSourcePersistence, sfSourceIdentity } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { createSfDashboardRecordSourceAccess } from "../../../product/decision-memory/source-access.ts"
import { createCollaborationAuthority } from "../../../product/collaboration/authority.ts"
import { createCollaborationMutationFence } from "../../../product/collaboration/mutation-fence.ts"
import { createCollaborationHotTopicHost } from "../../../product/collaboration/hot-topic-host.ts"
import { createHandoffPort } from "../../../product/collaboration/handoff.ts"
import { createRelationPort } from "../../../product/collaboration/relations.ts"
import { createHotTopicPort } from "../../../product/dashboard/hot-topics.ts"

type Handoff = Parameters<ReturnType<typeof createHandoffPort>["create"]>[0]
type Update = Parameters<ReturnType<typeof createHotTopicPort>["update"]>[0]
type Role = "admin" | "domain leader" | "contributor" | "viewer"
const at = "2026-11-13T08:00:00.000Z"
const period = { start: "2026-01-01", end: "2026-12-31" }
const sensitive = "Restricted development assessment: promotion discussion"

function value<T>(result: PortResult<T>): T {
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(`Expected producer success: ${result.status} ${result.reason}`)
  return result.value
}

/** Real encrypted login, role-map resolution, C08 and scoped evidence over the installation's SQLite.
 * The only fault injection drops a successful C03 response after its durable transaction. */
async function fixture(options: { role?: Role; handoffGrant?: boolean } = {}) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "wp02-collaboration-consumer-"))
  await chmod(directory, 0o700)
  const origin = "http://127.0.0.1:43127", installationId = randomUUID(), group = "fixture-operator-group"
  const principalRef = `macos:${installationId}:1000`, key = randomBytes(32), session: { cookie?: string } = {}
  const fault = { dropCreatedResponse: false }
  const roleRows = (role: Role) => [{ surface: "dashboard", role, entra: group, version: 0, by: principalRef }]
  const open = async (seed: boolean) => {
    const driver = await openLocalStore(directory)
    const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID, projectScope: createSfSourceScopeProjector(() => at) })
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    if (seed) await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = roleRows(options.role ?? "domain leader")
      snapshot.data.access = { [principalRef]: { assigned: ["projects"], domains: ["IT"] } }
      snapshot.data.projects = [{ id: "project-1", name: "Infrastructure review", domain: "IT", status: "Planning", pm: "Project owner", risk: "High" }]
      snapshot.data.members = [{ id: "member-1", name: "Team member", type: "Employee", status: "Active", leaderId: "", cls: "Talent", outlook: "Promote", notes: sensitive }]
      snapshot.data.hotTopics = []
      snapshot.data.opexOwners = [{ id: "untouched-budget", name: "Operations", budget: 1300 }]
      return { commit: true, value: undefined }
    })
    const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId, uid: 1000, name: "Authenticated operator" }, secrets: driver.secrets, key })
    // The login proves identity; the production role resolver consumes the current persisted map.
    const authenticate: typeof identity.authenticate = async (request, context) => {
      const person = await identity.person(request)
      return person && context ? resolve(person.id, [...context.roleMap], (name) => name === group) : null
    }
    const environment = async (request: Request) => ({ at, id: randomUUID, directory: await identity.directory(request) })
    if (!session.cookie) {
      const login = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`))
      session.cookie = login?.headers.get("set-cookie")?.split(";")[0]
      if (!session.cookie) throw new Error("Encrypted operator enrollment failed")
    }
    const request = (payload: unknown = {}, idempotencyKey: string = randomUUID()) => new Request(`${origin}/sucafina/dashboard`, {
      method: "POST", headers: { cookie: session.cookie!, origin, "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(payload),
    })
    expect((await identity.person(request()))?.id).toBe(principalRef)
    const authority = createSfProductAuthority({ installationId, origin, policyVersion: "wp02-collaboration-policy", persistence, authenticate, environment,
      identity: () => ({ installationId, hostId: "collaboration-host", projectId: "project", location: { directory: AbsolutePath.make(directory) } }),
      createId: randomUUID, now: Date.now, commandIdentity: async (source, operation) => source.headers.get("idempotency-key") ? digestSfValue({ operation, key: source.headers.get("idempotency-key") }) : undefined,
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
      grants: [{ principalRef, namespaces: ["relations"], operations: ["sf_dashboard_read"], humanActions: options.handoffGrant === false ? ["decisions.edit"] : ["collaboration.handoff.confirm", "decisions.edit"] }] })
    const records = createDashboardRecordEvidenceHost({ host: authority.host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host: authority.host, scopedSources: persistence }) })
    const evidence = createSfBusinessContext({ revalidate: authority.host.revalidate, resolveSource: createSfDashboardRecordSourceAccess({ host: authority.host, records }),
      proveContinuity: async () => false,
      recall: async () => { throw new Error("This record-only consumer does not request Atlas recall") },
      emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" }, reason: "record-only-consumer" }) })
    const collaboration = createCollaborationAuthority({ host: authority.host, evidence })
    const mutationFence = createCollaborationMutationFence(authority.host)
    const admitted = new WeakMap<TrustedDomainContext, { action: SfHumanAction; payload: unknown }>()
    const topics = createHotTopicPort(createCollaborationHotTopicHost({ host: authority.host, state: authority.state, evidence, creationTarget: authority.creationTarget, mutationFence,
      authorizeMutation: async (context) => { const active = admitted.get(context); return !!active && authority.human.authorize(context, active.action, active.payload) } }))
    const permit = Symbol("private-handoff")
    const relations = createRelationPort({ state: authority.state, host: authority.host, human: authority.human, authorizePair: collaboration.authorizePair,
      creationTarget: authority.creationTarget, mutationFence, handoffPermit: permit, createId: randomUUID, now: () => at })
    const handoff = createHandoffPort({ hotTopics: { read: topics.read, create: async (intent, context) => {
      const result = await topics.create(intent, context)
      if (fault.dropCreatedResponse && result.status === "ok" && result.value.state === "created") {
        fault.dropCreatedResponse = false
        throw new Error("Injected response loss after the real SQLite commit")
      }
      return result
    } }, relations, human: authority.human, permit, authorizeIntent: collaboration.authorizeIntent,
      run: async (context, payload, work) => {
        if (admitted.has(context)) return { status: "conflict", reason: "handoff-in-progress" }
        admitted.set(context, { action: "collaboration.handoff.confirm", payload })
        try { return await work() } finally { admitted.delete(context) }
      },
      resolveTopic: async (topic, context) => {
        const issued = await records.issue({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: topic.id, fields: ["status"], period: { start: at.slice(0, 10), end: at.slice(0, 10) } }, context)
        if (issued.status !== "ok") return issued
        if (!await collaboration.sources([issued.value], context)) return { status: "unavailable", reason: "topic-source-unavailable" }
        return { status: "ok", value: { ref: issued.value.refId, evidence: issued.value } }
      } })
    const read = async <T>(payload: unknown, work: (context: TrustedDomainContext) => Promise<T>) => {
      const digest = digestSfValue(payload), access = await authority.ui.admit(request(payload), "sf_dashboard_read", digest)
      if (access.status !== "ok") throw new Error(`Read admission failed: ${access.status}`)
      try { if (!await authority.ui.validate(access.value, "sf_dashboard_read", digest)) throw new Error("Read lease not consumed"); return await work(access.value) }
      finally { authority.ui.finish(access.value) }
    }
    const human = async <T>(action: SfHumanAction, payload: unknown, idempotencyKey: string, work: (context: TrustedDomainContext) => Promise<PortResult<T>>): Promise<PortResult<T>> => {
      const access = await authority.human.admit(request(payload, idempotencyKey), action, payload)
      if (access.status !== "ok") return access
      try { return await work(access.value) } finally { authority.human.finish(access.value) }
    }
    const module = createModule("/sucafina", { persistence, authenticate, environment, maxJsonBytes: 100000 })
    return { driver, persistence, authority, evidence, topics, relations, records, read,
      issue: (selection: Parameters<typeof records.issue>[0]) => read(selection, (context) => records.issue(selection, context)),
      handoff: (payload: Handoff, afterAdmission?: () => Promise<void>) => human("collaboration.handoff.confirm", payload, payload.relationKey, async (context) => {
        await afterAdmission?.()
        return handoff.create(payload, context)
      }),
      update: (payload: Update) => human("decisions.edit", payload, payload.idempotencyKey, async (context) => {
        admitted.set(context, { action: "decisions.edit", payload })
        try { return await topics.update(payload, context) } finally { admitted.delete(context) }
      }),
      setRole: (role: Role) => persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = roleRows(role); return { commit: true, value: undefined } }),
      command: (payload: unknown) => module(request(payload)),
      page: () => module(new Request(`${origin}/sucafina/dashboard?page=Hot+Topics+%26+Actions`, { headers: { cookie: session.cookie! } })),
      inspect: () => persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: {
        topics: structuredClone(rows(snapshot.data.hotTopics)), relations: structuredClone(object(object(snapshot.data.__sfProductV1).relations)),
        budget: structuredClone(snapshot.data.opexOwners), versions: structuredClone(snapshot.versions),
      } })),
      otherSurfaces: () => persistence.transactionAll!(async (snapshots) => ({ commit: false, value: digestSfValue({ planner: snapshots.planner.data, procurement: snapshots.procurement.data }) })),
    }
  }
  const current = { runtime: await open(true) }
  return { principalRef, installationId, fault, get runtime() { return current.runtime },
    reopen: async () => { await current.runtime.driver.dispose(); current.runtime = await open(false) },
    close: async () => { await current.runtime.driver.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}

async function projectSource(f: Awaited<ReturnType<typeof fixture>>) {
  return value(await f.runtime.issue({ page: "Portfolio Dashboard", recordType: "projects", recordId: "project-1", fields: ["name"], period }))
}
function intent(f: Awaited<ReturnType<typeof fixture>>, source: BusinessEvidenceRef, suffix = "one"): Handoff {
  return { sourceRef: source.refId, recipientRef: f.principalRef, relationKey: `handoff-link-${suffix}`, intent: {
    correlationKey: `handoff-action-${suffix}`, sourceRefs: [source], action: "Review the operational follow-up", owner: "Authenticated operator", due: "2026-12-01", priority: "high", notes: "",
  } }
}

test("WP08 handoff recovers a lost C03 response after SQLite reopen and follows the same action through update and completion", async () => {
  const f = await fixture()
  try {
    const source = await projectSource(f), request = intent(f, source), before = await f.runtime.inspect(), otherSurfaces = await f.runtime.otherSurfaces()
    expect((await f.runtime.read(source, (context) => f.runtime.evidence.resolve(source, context))).state).toBe("fresh")
    f.fault.dropCreatedResponse = true
    expect(await f.runtime.handoff(request)).toMatchObject({ status: "unavailable", reason: "action-outcome-unknown-retry-same-correlation" })
    const committed = await f.runtime.inspect()
    expect(committed.topics).toHaveLength(1)
    const id = committed.topics[0]!.id
    if (typeof id !== "string") throw new Error("Canonical Hot Topic ID missing")
    expect(Object.keys(committed.relations).filter((key) => key.startsWith("sf:hot-topic:"))).toHaveLength(1)
    expect(Object.values(committed.relations).filter((entry) => object(entry).kind === "handoff")).toHaveLength(0)
    await f.reopen()
    const recovered = value(await f.runtime.handoff(request))
    expect(recovered.state).toBe("existing")
    expect(recovered.topic).toMatchObject({ id, action: request.intent.action, owner: request.intent.owner, due: request.intent.due, priority: "high", notes: "", status: "open" })
    const linked = value(await f.runtime.read(source, (context) => f.runtime.relations.read([source.refId], context)))
    expect(linked.relations).toHaveLength(1)
    expect(linked.relations[0]).toMatchObject({ id: recovered.relationId, fromRef: source.refId, kind: "handoff", confirmedBy: f.principalRef })
    expect(linked.relations[0]!.evidenceRefs.some((ref) => ref.kind === "record" && ref.target.recordType === "hotTopics" && ref.target.recordId === id)).toBe(true)
    const repeated = value(await f.runtime.handoff(request))
    expect(repeated).toMatchObject({ state: "existing", relationId: recovered.relationId, topic: { id } })
    expect((await f.runtime.inspect()).topics).toHaveLength(1)
    const page = await f.runtime.page()
    expect(page?.status).toBe(200)
    expect(await page!.text()).toContain(`id="record-${id}"`)
    const update: Update = { id, version: recovered.topic.version, idempotencyKey: "progress-action", sourceRefs: [source], values: { status: "progress", due: "2026-12-10" } }
    const progressed = value(await f.runtime.update(update))
    expect(progressed).toMatchObject({ id, status: "progress", due: "2026-12-10", version: recovered.topic.version + 1 })
    const completion: Update = { id, version: progressed.version, idempotencyKey: "complete-action", sourceRefs: [source], values: { status: "done" } }
    const completed = value(await f.runtime.update(completion))
    expect(completed).toMatchObject({ id, status: "done", version: progressed.version + 1 })
    expect(await f.runtime.update({ ...update, idempotencyKey: "old-projection-must-not-reopen", values: { status: "open" } })).toMatchObject({ status: "conflict" })
    await f.reopen()
    expect(value(await f.runtime.update(completion))).toEqual(completed)
    expect(value(await f.runtime.read({ id }, (context) => f.runtime.topics.read(id, [source], context)))).toEqual(completed)
    const after = await f.runtime.inspect()
    expect(after.topics).toHaveLength(1)
    expect(after.topics[0]).toMatchObject({ id, status: "done" })
    const relation = object(after.relations[recovered.relationId])
    expect(relation).toMatchObject({ id: recovered.relationId, kind: "handoff", fromRef: source.refId })
    expect(relation).not.toHaveProperty("status")
    expect(Object.values(after.relations).filter((entry) => object(entry).kind === "handoff")).toHaveLength(1)
    expect(after.budget).toEqual(before.budget)
    expect(await f.runtime.otherSurfaces()).toBe(otherSurfaces)
    console.log("WP02 T04 collaboration proof:", JSON.stringify({ installationId: f.installationId, principalRef: f.principalRef,
      sourceRef: source.refId, sourceDigest: source.refDigest, topicId: id, relationId: recovered.relationId, completedVersion: completed.version,
      transport: "admitted-human-ui", storage: "LocalStore+C08", recoveredAfterReopen: true }))
  } finally { await f.close() }
}, 60000)

test("WP08 explicit intentions with the same title stay distinct and a changed correlation conflicts", async () => {
  const f = await fixture()
  try {
    const source = await projectSource(f), original = intent(f, source), first = value(await f.runtime.handoff(original))
    const another = intent(f, source, "two")
    another.intent.due = "2026-12-20"
    const second = value(await f.runtime.handoff(another))
    expect(first.topic.action).toBe(second.topic.action)
    expect(second.topic.id).not.toBe(first.topic.id)
    expect(second.relationId).not.toBe(first.relationId)
    expect(second.topic.due).toBe("2026-12-20")
    expect(await f.runtime.handoff({ ...original, intent: { ...original.intent, due: "2026-12-21" } })).toMatchObject({ status: "conflict", reason: "correlation-reused" })
    expect((await f.runtime.inspect()).topics).toHaveLength(2)
  } finally { await f.close() }
}, 60000)

test("WP08 requires the human grant and refuses a contributor even with readable source evidence", async () => {
  for (const options of [{ handoffGrant: false }, { role: "contributor" as const }]) {
    const f = await fixture(options)
    try {
      const source = await projectSource(f)
      expect((await f.runtime.read(source, (context) => f.runtime.evidence.resolve(source, context))).state).toBe("fresh")
      const result = await f.runtime.handoff(intent(f, source))
      expect(result.status).toBe("denied")
      if (options.role === "contributor") expect(result).toMatchObject({ reason: "hot-topic-write-denied" })
      const stored = await f.runtime.inspect()
      expect(stored.topics).toEqual([])
      expect(stored.relations).toEqual({})
    } finally { await f.close() }
  }
}, 60000)

test("WP08 revalidates an admitted human lease after the persisted role is withdrawn", async () => {
  const f = await fixture()
  try {
    const source = await projectSource(f)
    expect(await f.runtime.handoff(intent(f, source), () => f.runtime.setRole("contributor"))).toMatchObject({ status: "denied", reason: "handoff-access-unavailable" })
    const stored = await f.runtime.inspect()
    expect(stored.topics).toEqual([])
    expect(stored.relations).toEqual({})
  } finally { await f.close() }
}, 60000)

test("WP08 rejects revoked source scopes and removed Hot Topic references without recreating an action", async () => {
  const f = await fixture()
  try {
    const source = await projectSource(f), request = intent(f, source), created = value(await f.runtime.handoff(request))
    const deleted = await f.runtime.command({ page: "Hot Topics & Actions", action: "delete", id: created.topic.id, version: created.topic.version, values: {}, confirmed: true })
    expect(deleted?.status).toBe(200)
    expect(await deleted!.json()).toMatchObject({ ok: true })
    expect(await f.runtime.read({ id: created.topic.id }, (context) => f.runtime.topics.read(created.topic.id, [source], context))).toMatchObject({ status: "unavailable", reason: "action-unavailable" })
    expect(await f.runtime.handoff(request)).toMatchObject({ status: "unavailable", reason: "action-unavailable" })
    expect((await f.runtime.inspect()).topics).toEqual([])
    await f.runtime.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.projects = []; return { commit: true, value: undefined } })
    expect((await f.runtime.read(source, (context) => f.runtime.evidence.resolve(source, context))).state).toBe("unavailable")
    expect(await f.runtime.handoff(intent(f, source, "revoked-source"))).toMatchObject({ status: "denied", reason: "handoff-access-unavailable" })
    const stored = await f.runtime.inspect()
    expect(stored.topics).toEqual([])
    expect(Object.keys(stored.relations).filter((key) => key.startsWith("sf:hot-topic:"))).toHaveLength(1)
  } finally { await f.close() }
}, 60000)

test("C06 update replay refuses an action ID reused in a different incarnation after SQLite reopen", async () => {
  const f = await fixture()
  try {
    const source = await projectSource(f), created = value(await f.runtime.handoff(intent(f, source, "identity-fence")))
    const original = await f.runtime.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "hotTopics", created.topic.id) }))
    if (!original) throw new Error("The real source producer did not issue an action identity")
    const update: Update = { id: created.topic.id, version: created.topic.version, idempotencyKey: "complete-original-action", sourceRefs: [source], values: { status: "done" } }
    const completed = value(await f.runtime.update(update))
    expect(completed).toMatchObject({ id: created.topic.id, status: "done", version: created.topic.version + 1 })
    expect(value(await f.runtime.update(update))).toEqual(completed)
    const key = `sf:hot-topic:${digestSfValue({ correlationKey: update.idempotencyKey })}`
    expect(object((await f.runtime.inspect()).relations[key])).toMatchObject({ id: created.topic.id, targetIncarnation: original.incarnation, result: completed })

    const removed = await f.runtime.command({ page: "Hot Topics & Actions", action: "delete", id: created.topic.id, version: completed.version, values: {}, confirmed: true })
    expect(removed?.status).toBe(200)
    expect(await removed!.json()).toMatchObject({ ok: true })
    // Replacement is fixture input to the real scoped persistence, not a fabricated source receipt.
    // It deliberately reuses the public ID while the lifecycle allocates a new incarnation.
    await f.runtime.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.hotTopics = [{ id: created.topic.id, action: "Replacement action", owner: "Authenticated operator", due: "2026-12-15", priority: "normal", status: "open", notes: "" }]
      return { commit: true, value: undefined }
    })
    const replacement = await f.runtime.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "hotTopics", created.topic.id) }))
    expect(replacement?.alive).toBe(true)
    expect(replacement?.incarnation).not.toBe(original.incarnation)
    expect((await f.runtime.read(source, (context) => f.runtime.evidence.resolve(source, context))).state).toBe("fresh")
    await f.reopen()
    const beforeRetry = await f.runtime.inspect()
    expect(await f.runtime.update(update)).toMatchObject({ status: "unavailable", reason: "action-replaced" })
    expect(await f.runtime.inspect()).toEqual(beforeRetry)
    expect(beforeRetry.topics).toHaveLength(1)
    expect(beforeRetry.topics[0]).toMatchObject({ id: created.topic.id, action: "Replacement action", status: "open" })
    expect(object(beforeRetry.relations[key])).toMatchObject({ targetIncarnation: original.incarnation, result: completed })
  } finally { await f.close() }
}, 60000)

test("WP08 does not copy sensitive Talent values and rejects the source when current access is withdrawn", async () => {
  const f = await fixture({ role: "admin" })
  try {
    const selection = { page: "Talent Review", recordType: "members", recordId: "member-1", fields: ["name", "cls", "outlook", "notes"], period }
    const source = value(await f.runtime.issue(selection))
    const observed = await f.runtime.read(source, (context) => f.runtime.evidence.resolve(source, context))
    expect(observed.state).toBe("fresh")
    expect(JSON.stringify(observed.authorizedProjection)).toContain(sensitive)
    const request = intent(f, source, "talent-follow-up"), created = value(await f.runtime.handoff(request))
    expect(created.topic.notes).toBe("")
    expect(created.topic.action).toBe(request.intent.action)
    const stored = await f.runtime.inspect()
    expect(JSON.stringify(stored.topics)).not.toContain(sensitive)
    expect(JSON.stringify(stored.relations)).not.toContain(sensitive)
    expect(stored.topics[0]).not.toHaveProperty("cls")
    expect(stored.topics[0]).not.toHaveProperty("outlook")
    expect(await f.runtime.handoff({ ...intent(f, source, "copy-notes"), intent: { ...request.intent, correlationKey: "copy-notes", notes: sensitive } })).toMatchObject({ status: "denied", reason: "handoff-access-unavailable" })
    await f.runtime.setRole("domain leader")
    expect(await f.runtime.issue(selection)).toMatchObject({ status: "denied", reason: "source-unavailable" })
    expect((await f.runtime.read(source, (context) => f.runtime.evidence.resolve(source, context))).state).toBe("unavailable")
    expect(await f.runtime.handoff(intent(f, source, "unreadable-talent"))).toMatchObject({ status: "denied", reason: "handoff-access-unavailable" })
    const fresh = await projectSource(f)
    expect(value(await f.runtime.handoff(intent(f, fresh, "leader-authorized"))).topic.owner).toBe("Authenticated operator")
    expect((await f.runtime.inspect()).topics).toHaveLength(2)
  } finally { await f.close() }
}, 60000)
