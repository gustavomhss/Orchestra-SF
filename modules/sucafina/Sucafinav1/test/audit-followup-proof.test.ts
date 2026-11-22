import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { roleMap } from "../runtime/admin.ts"
import { object } from "../runtime/contract.ts"
import type { Command, Snapshot } from "../runtime/contract.ts"
import { DashboardPortfolio } from "../runtime/dashboard-portfolio.ts"
import { domain as procurementDomain } from "../runtime/procurement.ts"
import { createSfProductAuthority } from "../product/integration/product-authority.ts"
import { createSfBusinessServices } from "../../../../apps/cli/src/sucafina-product/business-services.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { resolve } from "../src/identity.ts"
import { digestSfValue } from "../product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../product/contracts/business-context.ts"
import type { DomainPortHost, PortResult } from "../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../product/contracts/sf-execution.ts"
import type { DomainProjection } from "../product/contracts/context.ts"
import type { CollaborationThread } from "../product/collaboration/threads.ts"
import { createCollaborationHost } from "../product/collaboration/host.ts"
import { collaborationHumanActions, createCollaborationHumanAuthority } from "../product/collaboration/human.ts"
import type { CollaborationHumanAction } from "../product/collaboration/human.ts"
import { createDashboardConfirmationObserver } from "../product/dashboard/confirmation.ts"
import { createDashboardRecordEvidenceHost } from "../product/dashboard/sources.ts"
import { createSfDashboardRecordSourceAccess } from "../product/decision-memory/source-access.ts"
import { createSfBusinessContext, createSfRecordHistory } from "../product/host-binding/business-context.ts"
import { createSfExecutionBindingRegistry } from "../product/host-binding/execution-context.ts"
import { createSfProductState } from "../product/host-binding/state-provider.ts"
import { createDashboardRecordSourceIssuer } from "../product/integration/dashboard-sources.ts"
import { createProcurementSourceResolver } from "../product/procurement/sources.ts"
import { enumerateSfSources } from "../product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../product/integration/source-projections.ts"
import { createSfDomainAuthority, createSfUiAuthority } from "../product/integration/ui-authority.ts"

const at = "2026-11-22T08:00:00.000Z"
const period = { start: "2026-01-01", end: "2026-12-31" }
const original = { name: "Selected project", budget: 100, spent: 20, status: "In Progress", risk: "Low", notes: "Private unselected material" }
const answer = "The recipient checked the selected project."
const people = [{ id: "questioner", name: "Questioner" }, { id: "recipient", name: "Recipient" }]

function ok<T>(result: PortResult<T>): T {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}

/** Diagnostic only. SQLite, source projection, C08 host, UI/human admission and
 * sf_answer_read are real. Authentication and the two administrator directory
 * grants are explicit fixture boundaries, not an installed Entra/Teams claim.
 */
async function fixture(options: { historyConsumer?: boolean; recipientMode?: "omitted" | "installed" } = {}) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-followup-proof-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
  const request = (actor: string) => new Request("https://example.test/product", { method: "POST", headers: { origin: "https://example.test", actor } })
  const identityFor = (id: string | null, snapshot: Snapshot) => {
    if (!people.some((person) => person.id === id)) return undefined
    const roles = roleMap(snapshot, "dashboard")
    const principal = resolve(id!, roles, (group) => group === "admins")
    if (!principal.roles.some((role) => role.surface === "dashboard" && role.role === "admin") || !Object.hasOwn(object(snapshot.data.access), id!)) return undefined
    return { installationId: "installation", projectId: "project", principalRef: id!, accessRevision: digestSfValue({ roles, access: snapshot.data.access }), policyVersion: "policy" }
  }
  const identity = (candidate: Request, snapshot: Snapshot) => identityFor(candidate.headers.get("actor"), snapshot)
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "questioner" }]
    snapshot.data.access = Object.fromEntries(people.map((person) => [person.id, { assigned: [], domains: [] }]))
    return { commit: true, value: undefined }
  })
  const mutate = (command: Command) => persistence.transaction("dashboard", async (snapshot) => {
    const result = DashboardPortfolio.domain.execute(snapshot, { id: "questioner", roles: ["admin"], canWrite: true }, command, { at, id: () => "project", directory: people })
    if (!result.ok) throw new Error("Canonical project mutation failed: " + JSON.stringify(result))
    return { commit: true, value: result }
  })
  await mutate({ page: "All Projects", action: "save", version: 0, values: original })
  const ui = createSfUiAuthority({
    authorize: async (candidate) => persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: identity(candidate, snapshot) })),
    commandIdentity: async () => randomUUID(), createId: randomUUID, now: () => Date.parse(at),
    privateCommands: collaborationHumanActions.map((action) => "sf-human:" + action),
  })
  const human = createCollaborationHumanAuthority({ origin: "https://example.test", ui })
  const host: DomainPortHost = {
    persistence,
    authenticate: async (candidate, options) => {
      const id = candidate.headers.get("actor")
      return people.some((person) => person.id === id) && options ? resolve(id!, [...options.roleMap], (group) => group === "admins") : null
    },
    environment: async () => ({ at, id: randomUUID, directory: people }),
    requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
    revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
  }
  const records = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
  const availability = { sources: true, history: false }
  // Only the protected capture boundary is a fixture. Every captured reference
  // and projection below was emitted by the real Dashboard producer.
  const archive = new Map<string, { ref: BusinessEvidenceRef; projection: DomainProjection }>()
  const resolveSource = createSfDashboardRecordSourceAccess({ host, records })
  const history = createSfRecordHistory({
    host, now: () => at,
    readOriginalCapture: async (digest, context) => availability.history && await host.revalidate(context) ? structuredClone(archive.get(digest)) : undefined,
    current: async (original, page, context): Promise<BusinessEvidenceResolution> => {
      const unavailable: BusinessEvidenceResolution = { state: "unavailable", ref: original, accessRevision: context.binding.accessRevision, checkedAt: at }
      if (!page || !original.target.period) return unavailable
      const issued = await records.issue({ page, recordType: original.target.recordType, recordId: original.target.recordId, fields: original.target.fields, period: original.target.period }, context)
      return issued.status === "ok" ? resolveSource(issued.value, context) : unavailable
    },
  })
  const evidence = createSfBusinessContext({
    revalidate: host.revalidate,
    resolveSource: async (ref, context) => {
      if (!availability.sources) return { state: "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: at }
      const current = await resolveSource(ref, context)
      return current.state === "fresh" || !availability.history ? current : history.resolve(ref, context)
    },
    proveContinuity: history.proveContinuity,
    recall: async () => { throw new Error("Recall is outside this proof") },
    emitFromLedger: async () => { throw new Error("Emission is outside this proof") },
  })
  const source = createDashboardConfirmationObserver({ host, scopedSources: persistence, readProjection: (selection, context) => records.read(selection.reference, context) })
  const issueForActor: NonNullable<Parameters<typeof createCollaborationHost>[0]["issueForActor"]> = async (target, context) => {
    if (target.surface !== "dashboard" || !target.period) return { status: "unavailable", reason: "unselected-source" }
    const page = await persistence.transaction("dashboard", async (snapshot) => {
      const entries = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.incarnation === target.incarnation && entry.scope.recordType === target.recordType && entry.scope.recordId === target.recordId)
      return { commit: false, value: entries.length === 1 ? object(entries[0]!.scope.selector).page : undefined }
    })
    if (typeof page !== "string") return { status: "unavailable", reason: "source-selector-unavailable" }
    return records.issue({ page, recordType: target.recordType, recordId: target.recordId, fields: target.fields, period: target.period }, context)
  }
  const creationTarget = { ref: "workspace", incarnation: "workspace-original" }
  const threadHistoryWrites = options.historyConsumer ? new WeakSet<object>() : undefined
  const state = createSfProductState({ persistence, createId: randomUUID, threadHistoryWrites,
    authorize: async (candidate, snapshot) => identity(candidate, snapshot),
    resolveTarget: async (candidate, snapshot, namespace, ref) => namespace === "threads" && ref === creationTarget.ref && identity(candidate, snapshot) ? { incarnation: creationTarget.incarnation } : undefined,
  })
  // This fixture grants both selected people administrator access only. The
  // synchronous commit check reads the protected ACL, not a directory ID alone.
  const grant = (snapshot: Snapshot, recipient: string, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => {
    const caller = host.requestFor(context)
    if (!caller || recipient !== "recipient" || !refs.length || refs.some((ref) => ref.kind !== "record" || ref.target.surface !== "dashboard")) return false
    const from = identity(caller, snapshot), to = identityFor(recipient, snapshot)
    return !!from && !!to && from.principalRef === context.binding.principalRef && from.accessRevision === context.binding.accessRevision
  }
  const recipientAuthority = {
    authorize: (recipient: string, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: grant(snapshot, recipient, refs, context) })),
    checkAtCommit: (recipient: string, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => {
      const snapshot = persistence.currentSnapshots?.()?.dashboard
      return !!snapshot && grant(snapshot, recipient, refs, context)
    },
  }
  const authority = createSfDomainAuthority({ ui, native: createSfExecutionBindingRegistry({ authenticateAndResolve: async () => undefined, revalidateAdmission: async () => false }) })
  // business-services.ts always installs these Procurement reissue delegates.
  // Dashboard is outside their domain; the canonical reader remains the fallback.
  const nativeReissuer = options.recipientMode === "installed" ? createProcurementSourceResolver({ host, scopedSources: persistence,
    contextFor: async () => ({ status: "unavailable", reason: "unselected-procurement" }),
  }) : undefined
  const collaboration = createCollaborationHost({ host, state, creationTarget, scopedSources: persistence, evidence, human, authority, recipientAuthority, threadHistoryWrites,
    procurement: { list: async () => ({ status: "unavailable", reason: "unselected-procurement" }) },
    collections: { resolveRequestCollection: async () => ({ status: "unavailable", reason: "unselected-collection" }) },
    cases: { read: async () => ({ status: "unavailable", reason: "unselected-case" }) },
    ...(options.recipientMode === "omitted" ? {} : {
      issueForActor: nativeReissuer?.issueForActor ?? issueForActor,
      prepareReissueScope: nativeReissuer?.prepareReissueScope ?? source.prepareReissueScope,
    }), confirmationSource: source,
    requiredAuthority: { sf_work_list: [], sf_question_prepare: [], sf_answer_read: [], sf_relation_read: [], sf_handoff_prepare: [] }, createId: randomUUID, now: () => at,
  })
  const read = async (actor: string, operation = "sf_relation_read", payload: unknown = { recordRefs: [] }) => {
    const digest = digestSfValue(payload)
    const context = ok(await ui.admit(request(actor), operation, digest))
    if (!await ui.validate(context, operation, digest)) throw new Error("Read admission unavailable")
    return context
  }
  const withHuman = async <T>(actor: string, action: CollaborationHumanAction, payload: unknown, work: (context: TrustedUiContext) => Promise<PortResult<T>>) => {
    const context = ok(await human.admit(request(actor), action, payload))
    try { return ok(await work(context)) } finally { human.finish(context) }
  }
  const createQuestion = async (recipientRef = "recipient") => {
    const context = await read("questioner")
    const reference = ok(await records.issue({ page: "All Projects", recordType: "projects", recordId: "project", fields: ["name", "status"], period }, context))
    archive.set(reference.refDigest, { ref: structuredClone(reference), projection: ok(await records.read(reference.refId, context)) })
    const draft = { kind: "clarification" as const, sourceRef: reference.refId, sourceIncarnation: reference.target.incarnation, observedVersion: reference.target.version, period, recipientRef, body: "Please check the selected project.", evidenceRefs: [reference] }
    const mutation = { expectedStorageVersion: 0, idempotencyKey: "create-question" }
    const thread = await withHuman("questioner", "collaboration.thread.create", { draft, mutation }, async (call) => {
      expect((await records.resolve(reference.refId, call)).status).toBe("ok")
      expect((await evidence.resolve(reference, call)).state).toBe("fresh")
      expect(await collaboration.authority.recipientSources(recipientRef, [reference], call)).toBe(true)
      return collaboration.threads.create(draft, mutation, call)
    })
    return { thread, reference }
  }
  const create = async () => {
    const { thread, reference } = await createQuestion()
    const version = ok(await collaboration.storageVersion("threads", await read("recipient")))
    const replyMutation = { expectedStorageVersion: version, idempotencyKey: "recipient-reply" }
    const replied = await withHuman("recipient", "collaboration.thread.reply", { id: thread.id, body: answer, mutation: replyMutation }, (call) => collaboration.recipientActions!.reply(thread.id, answer, replyMutation, call))
    const recipient = await read("recipient")
    archive.set(replied.current.sourceRef.refDigest, { ref: structuredClone(replied.current.sourceRef), projection: ok(await records.read(replied.current.sourceRef.refId, recipient)) })
    return { thread, reference, replied }
  }
  const answerRead = async (id: string, actor = "recipient") => {
    const payload = { questionRef: id }
    const context = await read(actor, "sf_answer_read", payload)
    const capability = collaboration.capabilities.find((entry) => entry.id === "sf_answer_read")
    if (!capability) throw new Error("Real sf_answer_read capability missing")
    return { context, result: await capability.handler(payload, context) }
  }
  const changeSource = () => persistence.transaction("dashboard", async (snapshot) => {
    const result = DashboardPortfolio.domain.execute(snapshot, { id: "questioner", roles: ["admin"], canWrite: true },
      { page: "All Projects", action: "save", id: "project", version: snapshot.versions["projects:project"]!.version, values: { status: "On Hold" } },
      { at, id: randomUUID, directory: people })
    if (!result.ok) throw new Error("Source change rejected: " + JSON.stringify(result))
    return { commit: true, value: result }
  })
  const changeThread = async (id: string, change: "recipient" | "period") => {
    const context = await read("questioner")
    const expectedStorageVersion = ok(await collaboration.storageVersion("threads", context))
    const result = await state.transaction(host.requestFor(context)!, {
      namespace: "threads", expectedStorageVersion, idempotencyKey: randomUUID(), commandDigest: digestSfValue({ id, change }),
      targetRef: creationTarget.ref, targetIncarnation: creationTarget.incarnation,
    }, async (value) => {
      const thread = value.threads[id] as CollaborationThread
      if (change === "recipient") thread.recipientRef = "questioner"
      else thread.period = { ...thread.period, start: "2026-02-01" }
      return { commit: true, value: true }
    })
    if (result.status !== "ok" || !result.value) throw new Error("Concurrent state write rejected: " + JSON.stringify(result))
  }
  return { store, persistence, records, state, collaboration, read, createQuestion, create, answerRead, availability, mutate, changeSource, changeThread,
    revoke: () => persistence.transaction("dashboard", async (snapshot) => {
      const access = object(snapshot.data.access)
      delete access.recipient
      snapshot.data.access = access
      return { commit: true, value: undefined }
    }),
    dispose: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}

test("diagnostic 9: non-C05 question and recipient reply reach the real sf_answer_read capability", async () => {
  const f = await fixture()
  try {
    const selected = await f.create()
    expect(selected.thread.messages[0]?.sourceContext?.reviewContext).toBeUndefined()
    expect(selected.replied.messages.at(-1)?.authorRef).toBe("recipient")
    expect(selected.replied.messages.at(-1)?.body).toBe(answer)
    const read = await f.answerRead(selected.thread.id)
    expect(read.result.status).toBe("ok")
    if (read.result.status !== "ok") throw new Error(JSON.stringify(read.result))
    expect(read.result.result).toMatchObject({ questionRef: selected.thread.id, answer, state: "unconfirmed" })
    expect(JSON.stringify(read.result)).not.toContain(original.notes)
    const current = ok(await f.collaboration.threadReads.read(selected.thread.id, read.context))
    expect(current.evidenceRefs).toHaveLength(1)
    expect(current.evidenceRefs[0]?.refDigest).not.toBe(selected.reference.refDigest)
  } finally { await f.dispose() }
}, 120_000)

test("diagnostic 9: an actual source resolver outage remains unavailable without answer text", async () => {
  const f = await fixture()
  try {
    const selected = await f.create()
    expect((await f.answerRead(selected.thread.id)).result.status).toBe("ok")
    f.availability.sources = false
    const read = await f.answerRead(selected.thread.id)
    expect(read.result.status).toBe("unavailable")
    expect(JSON.stringify(read.result)).not.toContain(answer)
  } finally { await f.dispose() }
}, 120_000)

test("diagnostic 9: persisted recipient-access revocation invalidates an admitted answer read", async () => {
  const f = await fixture()
  try {
    const selected = await f.create()
    const context = await f.read("recipient", "sf_answer_read", { questionRef: selected.thread.id })
    await f.revoke()
    const capability = f.collaboration.capabilities.find((entry) => entry.id === "sf_answer_read")!
    const result = await capability.handler({ questionRef: selected.thread.id }, context)
    expect(result.status).toBe("denied")
    expect(JSON.stringify(result)).not.toContain(answer)
  } finally { await f.dispose() }
}, 120_000)

test("diagnostic 9: historical reads require an explicit protected capture and retain the original source version", async () => {
  const f = await fixture()
  try {
    const selected = await f.create()
    const context = await f.read("recipient")
    const current = await f.collaboration.threadReads.read(selected.thread.id, context)
    expect(current.status).toBe("ok")
    const unavailable = await f.collaboration.threadReads.readHistorical(selected.thread.id, context)
    expect(unavailable.status).not.toBe("ok")
    expect(JSON.stringify(unavailable)).not.toContain(answer)
    f.availability.history = true
    const granted = ok(await f.collaboration.threadReads.readHistorical(selected.thread.id, context))
    expect(granted.sourceRef).toBe(selected.reference.refId)
    expect(granted.observedVersion).toBe(selected.reference.target.version)
    await f.changeSource()
    const historical = ok(await f.collaboration.threadReads.readHistorical(selected.thread.id, context))
    expect(historical.sourceRef).toBe(selected.reference.refId)
    expect(historical.observedVersion).toBe(selected.reference.target.version)
    const projected = ok(await f.collaboration.recipientThread!(selected.thread.id, context))
    expect(projected.continuity).toBe("historical")
    expect(projected.current.sourceRef.target.version).toBeGreaterThan(selected.replied.current.sourceRef.target.version)
    expect(projected.historical?.evidenceRefs).toEqual([selected.reference])
    f.availability.history = false
    const lost = await f.collaboration.threadReads.readHistorical(selected.thread.id, context)
    expect(lost.status).not.toBe("ok")
    expect(JSON.stringify(lost)).not.toContain(answer)
  } finally { await f.dispose() }
}, 120_000)

for (const change of ["recipient", "period", "source"] as const) {
  test("diagnostic 9: " + change + " drift after the first real thread read cannot publish an answer", async () => {
    const f = await fixture()
    try {
      const selected = await f.create()
      const read = f.collaboration.threadReads.read
      let changed = false
      // Schedule a real SQLite write between producer observations. Every read
      // still delegates to the shipped reader; no result is fabricated.
      f.collaboration.threadReads.read = async (...args) => {
        const result = await read(...args)
        if (!changed && result.status === "ok") {
          changed = true
          if (change === "source") await f.changeSource()
          else await f.changeThread(selected.thread.id, change)
        }
        return result
      }
      const result = (await f.answerRead(selected.thread.id)).result
      expect(changed).toBe(true)
      expect(result.status).not.toBe("ok")
      expect(JSON.stringify(result)).not.toContain(answer)
    } finally { await f.dispose() }
  }, 120_000)
}

test("diagnostic 9: a transient real reuse outage is not downgraded when sources recover", async () => {
  const f = await fixture()
  try {
    const selected = await f.create()
    const readThread = f.collaboration.threadReads.read
    const readReuse = f.collaboration.answerReuse!.read
    let armed = true
    let observedReuse: string | undefined
    f.collaboration.threadReads.read = async (...args) => {
      const result = await readThread(...args)
      if (armed && result.status === "ok") {
        armed = false
        f.availability.sources = false
      }
      return result
    }
    f.collaboration.answerReuse!.read = async (...args) => {
      const result = await readReuse(...args)
      observedReuse = result.status
      // A transient outage ends before dispatch receives the real reuse result.
      // Availability recovery does not make the missing observation valid.
      f.availability.sources = true
      return result
    }
    const result = (await f.answerRead(selected.thread.id)).result
    expect(armed).toBe(false)
    expect(observedReuse).toBe("unavailable")
    expect(result.status).toBe("unavailable")
    expect(JSON.stringify(result)).not.toContain(answer)
    expect((await f.answerRead(selected.thread.id)).result.status).toBe("ok")
  } finally { await f.dispose() }
}, 120_000)

test("diagnostic 9 review: the author cannot reuse another actor's uncaptured reply basis as history", async () => {
  const f = await fixture({ historyConsumer: true })
  try {
    const selected = await f.create()
    const context = await f.read("questioner")
    const message = selected.thread.messages[0]!
    expect(f.availability.history).toBe(false)
    expect((await f.collaboration.threadReads.read(selected.thread.id, context)).status).toBe("ok")
    for (const changed of [false, true]) {
      if (changed) await f.changeSource()
      const historical = await f.collaboration.threadReads.readHistorical(selected.thread.id, context)
      const version = await f.collaboration.threadHistory!.readVersion(selected.thread.id, message.id, message.incarnation, message.version, context)
      expect(historical.status).not.toBe("ok")
      expect(version.status).not.toBe("ok")
      expect(JSON.stringify([historical, version])).not.toContain(message.body)
      expect(JSON.stringify([historical, version])).not.toContain(answer)
    }
  } finally { await f.dispose() }
}, 120_000)

for (const recipientMode of ["omitted", "installed"] as const) {
  test("diagnostic 9 review: " + recipientMode + " recipient reader exposes only the author's exact current source", async () => {
    const f = await fixture({ historyConsumer: true, recipientMode })
    try {
      // A self-addressed ordinary clarification is supported without an
      // external recipient authority, as in the current Local Operator.
      const selected = await f.createQuestion("questioner")
      const context = await f.read("questioner")
      const message = selected.thread.messages[0]!
      expect(f.availability.history).toBe(false)
      if (recipientMode === "omitted") expect(f.collaboration.recipientThread).toBeUndefined()
      else {
        expect(f.collaboration.recipientThread).toBeDefined()
        expect((await f.collaboration.recipientThread!(selected.thread.id, context)).status).toBe("unavailable")
      }
      expect((await f.records.resolve(selected.reference.refId, context)).status).toBe("ok")
      const before = ok(await f.collaboration.threadReads.readHistorical(selected.thread.id, context))
      expect(before.sourceRef).toBe(selected.reference.refId)
      expect(before.sourceIncarnation).toBe(selected.reference.target.incarnation)
      expect(before.observedVersion).toBe(selected.reference.target.version)
      expect(before.evidenceRefs).toEqual([selected.reference])
      const observed = ok(await f.collaboration.threadHistory!.readVersion(selected.thread.id, message.id, message.incarnation, message.version, context))
      expect(observed.message).toEqual(message)
      expect(observed.evidenceRefs).toEqual([selected.reference])

      await f.changeSource()
      expect((await f.records.resolve(selected.reference.refId, context)).status).toBe("stale")
      const historical = await f.collaboration.threadReads.readHistorical(selected.thread.id, context)
      const version = await f.collaboration.threadHistory!.readVersion(selected.thread.id, message.id, message.incarnation, message.version, context)
      expect(historical.status).not.toBe("ok")
      expect(version.status).not.toBe("ok")
      expect(JSON.stringify([historical, version])).not.toContain(message.body)
      expect(f.availability.history).toBe(false)
    } finally { await f.dispose() }
  }, 120_000)
}


// This control uses the shipping business-services and product-authority
// factories unchanged, including their original Procurement reissue delegates,
// source resolver, answer-scope resolver, and Atlas business-context router.
// The private SQLite store, directory authentication and operation grants are
// test inputs. No scanner/capture, native session or Teams readiness is claimed.
test("diagnostic 9 shipped composition: Procurement reply has no ordinary answer scope", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-followup-shipped-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  let business: ReturnType<typeof createSfBusinessServices> | undefined
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    for (const surface of ["dashboard", "planner", "procurement"] as const) {
      await persistence.initializeSources(surface)
      await persistence.transaction(surface, async (snapshot) => {
        snapshot.data.roleMap = [{ surface, role: "admin", entra: "admins", version: 1, by: "questioner" }]
        snapshot.data.access = Object.fromEntries(people.map((person) => [person.id, { assigned: [], domains: [] }]))
        return { commit: true, value: undefined }
      })
    }
    const environment = { at, id: randomUUID, directory: people }
    const requestId = await persistence.transaction("procurement", async (snapshot) => {
      const actor = { id: "questioner", roles: ["admin"], canWrite: true }
      const settings = procurementDomain.execute(snapshot, actor, { page: "Settings", action: "reset", version: 0, values: {} }, environment)
      if (!settings.ok) throw new Error("Canonical Procurement settings failed: " + JSON.stringify(settings))
      const created = procurementDomain.execute(snapshot, actor, { page: "Requests", action: "create", version: 0, values: { pr: {
        title: "Selected purchase", type: "product", description: "Selected source", estAmount: 100, costCenter: "IT",
        needBy: "2026-12-01", justification: "Diagnostic source", recurring: false, expenseType: "CAPEX",
      } } }, environment)
      if (!created.ok || typeof object(created.value).number !== "string") throw new Error("Canonical request failed: " + JSON.stringify(created))
      return { commit: true, value: object(created.value).number as string }
    })
    const authority = createSfProductAuthority({
      identity: () => ({ installationId: "installation", hostId: "local-diagnostic", projectId: "project", location: { directory: directory as never } }),
      installationId: "installation", origin: "https://example.test", policyVersion: "policy", persistence,
      authenticate: async (candidate, options) => {
        const id = candidate.headers.get("actor")
        return people.some((person) => person.id === id) && options ? resolve(id!, [...options.roleMap], (group) => group === "admins") : null
      },
      environment: async () => environment,
      grants: people.map((person) => ({ principalRef: person.id, namespaces: ["threads", "confirmations", "relations", "cases", "preferences"] as const,
        operations: ["sf_work_list", "sf_answer_read", "sf_relation_read", "sf_question_prepare"], humanActions: collaborationHumanActions })),
      createId: randomUUID, now: Date.now, commandIdentity: async () => randomUUID(),
      inspectSession: async () => undefined, verifySelection: async () => false,
      verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
    })
    business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: new WeakSet<object>() })
    // The shipped factory accepts no scanner. Current record resolution is real;
    // no history or recall operation is exercised by these diagnostic versions.
    business.initializeAtlas(undefined, { boundaryVersion: "diagnostic-current-source", schemaVersion: "diagnostic-current-source", manifestVersion: "diagnostic-current-source", skillVersion: "diagnostic-current-source" })
    const services = business
    const request = () => new Request("https://example.test/product", { method: "POST", headers: { origin: "https://example.test", actor: "questioner" } })
    const read = async (operation: string, payload: unknown) => {
      const digest = digestSfValue(payload)
      const call = ok(await authority.ui.admit(request(), operation, digest))
      expect(await authority.ui.validate(call, operation, digest)).toBe(true)
      return call
    }
    const withHuman = async <T>(action: CollaborationHumanAction, payload: unknown, work: (call: TrustedUiContext) => Promise<PortResult<T>>) => {
      const call = ok(await authority.human.admit(request(), action, payload))
      try { return await work(call) } finally { authority.human.finish(call) }
    }
    const selectionPayload = { purpose: "work-selection", period }
    const selectionContext = await read("sf_work_list", selectionPayload)
    const selection = ok(await services.procurementSelections.create(selectionContext, period))
    expect(selection.period).toEqual(period)
    const sourceRef = ok(await services.individual.issue("procurement-request", requestId, selectionContext))
    const reference = ok(await services.individual.resolve(sourceRef, selectionContext)).evidence
    expect(reference.target.surface).toBe("procurement")
    expect(reference.target.recordId).toBe(requestId)
    expect((await services.context.resolve(reference, selectionContext)).state).toBe("fresh")
    expect((await services.procurement.read({ requestRef: sourceRef }, selectionContext)).status).toBe("ok")
    expect(await services.collaboration.authority.recipientSources("recipient", [reference], selectionContext)).toBe(false)
    expect(await services.collaboration.authority.recipientSources("questioner", [reference], selectionContext)).toBe(true)

    const draft = { kind: "clarification" as const, sourceRef, sourceIncarnation: reference.target.incarnation,
      observedVersion: reference.target.version, period, recipientRef: "recipient", body: "Please check this purchase.", evidenceRefs: [reference] }
    const mutation = { expectedStorageVersion: 0, idempotencyKey: "other-recipient" }
    const crossPerson = await withHuman("collaboration.thread.create", { draft, mutation }, (call) => services.collaboration.threads.create(draft, mutation, call))
    expect(crossPerson.status).not.toBe("ok")
    expect(ok(await services.collaboration.storageVersion("threads", selectionContext))).toBe(0)

    const selfDraft = { ...draft, recipientRef: "questioner" }
    const selfMutation = { expectedStorageVersion: 0, idempotencyKey: "self-recipient" }
    const thread = ok(await withHuman("collaboration.thread.create", { draft: selfDraft, mutation: selfMutation }, (call) => services.collaboration.threads.create(selfDraft, selfMutation, call)))
    expect(thread.messages[0]?.sourceContext?.reviewContext).toBeUndefined()
    expect(services.collaboration.recipientThread).toBeDefined()
    const replyBody = "The designated recipient checked the real Procurement request."
    const replyMutation = { expectedStorageVersion: ok(await services.collaboration.storageVersion("threads", selectionContext)), idempotencyKey: "self-reply" }
    const replied = ok(await withHuman("collaboration.thread.reply", { id: thread.id, body: replyBody, mutation: replyMutation },
      (call) => services.collaboration.recipientActions!.reply(thread.id, replyBody, replyMutation, call)))
    const message = replied.messages.at(-1)!
    expect(message.authorRef).toBe(thread.recipientRef!)
    expect(message.body).toBe(replyBody)
    expect(replied.current.sourceRef.target.surface).toBe("procurement")
    expect((await services.context.resolve(replied.current.sourceRef, selectionContext)).state).toBe("fresh")

    const payload = { questionRef: thread.id }
    const call = await read("sf_answer_read", payload)
    const visible = ok(await services.collaboration.threadReads.read(thread.id, call))
    expect(visible.messages.at(-1)?.body).toBe(replyBody)
    const answerRef = "sf-thread-answer:" + [thread.id, message.id, message.incarnation].map(encodeURIComponent).join(":") + ":" + message.version
    const prepared = await services.collaboration.answerReuse!.prepare(thread.id, answerRef, call)
    expect(prepared).toEqual({ status: "unavailable", reason: "answer-scope-unavailable" })
    const capability = services.collaboration.capabilities.find((entry) => entry.id === "sf_answer_read")!
    const result = await capability.handler(payload, call)
    expect(result).toMatchObject({ status: "unavailable", reason: "answer-reuse-unavailable",
      receipt: { kind: "ui", operation: "sf_answer_read", handlerExport: "readAnswer", principalRef: "questioner", inputDigest: digestSfValue(payload) },
    })
    expect("value" in result).toBe(false)
    expect(JSON.stringify(result)).not.toContain(replyBody)
  } finally {
    business?.dispose()
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 120_000)
