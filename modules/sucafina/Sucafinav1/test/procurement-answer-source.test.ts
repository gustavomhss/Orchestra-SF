import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Schema } from "effect"
import { Location } from "@orchestra/schema/location"
import { object } from "../runtime/contract.ts"
import type { Command } from "../runtime/contract.ts"
import { domain } from "../runtime/procurement.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { resolve } from "../src/identity.ts"
import { digestSfValue } from "../product/contracts/canonical.ts"
import type { PortResult } from "../product/contracts/ports.ts"
import type { TrustedUiContext } from "../product/contracts/sf-execution.ts"
import { createSfProductAuthority } from "../product/integration/product-authority.ts"
import { enumerateSfSources } from "../product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../product/integration/source-projections.ts"
import { collaborationHumanActions } from "../product/collaboration/human.ts"
import type { CollaborationHumanAction } from "../product/collaboration/human.ts"
import type { AnswerConfirmationMutation } from "../product/collaboration/answer-reuse.ts"
import { createSfBusinessServices } from "../../../../apps/cli/src/sucafina-product/business-services.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const people = [{ id: "questioner", name: "Questioner" }, { id: "recipient", name: "Recipient" }]
const replyBody = "The recipient checked this Procurement request."

function ok<T>(result: PortResult<T>): T {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}

// Original shipping factories, canonical domain commands and private SQLite.
// Authentication/directory/grants are explicit fixture inputs, not installed
// Entra/Teams qualification or proof of another recipient's private access.
async function fixture(pending: boolean, work: (value: Awaited<ReturnType<typeof setup>>) => Promise<void>) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-procurement-answer-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const cleanup: { business?: ReturnType<typeof createSfBusinessServices> } = {}
  try { await work(await setup(directory, store, cleanup, pending)) }
  finally {
    cleanup.business?.dispose()
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}

async function setup(directory: string, store: Awaited<ReturnType<typeof openLocalStore>>,
  cleanup: { business?: ReturnType<typeof createSfBusinessServices> }, pending: boolean) {
  const clock = { at: "2026-11-21T08:00:00.000Z" }
  const authentication = { available: true }
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID,
    enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => clock.at) })
  for (const surface of ["dashboard", "planner", "procurement"] as const) {
    await persistence.initializeSources(surface)
    await persistence.transaction(surface, async (snapshot) => {
      snapshot.data.roleMap = [{ surface, role: "admin", entra: "admins", version: 1, by: "questioner" }]
      snapshot.data.access = Object.fromEntries(people.map((person) => [person.id, { assigned: [], domains: [] }]))
      return { commit: true, value: undefined }
    })
  }
  const environment = () => ({ at: clock.at, id: randomUUID, directory: people })
  const actor = { id: "questioner", roles: ["admin"], canWrite: true }
  const requestId = await persistence.transaction("procurement", async (snapshot) => {
    const settings = domain.execute(snapshot, actor, { page: "Settings", action: "reset", version: 0, values: {} }, environment())
    if (!settings.ok) throw new Error("Canonical settings: " + JSON.stringify(settings))
    if (pending) {
      const assigned = domain.execute(snapshot, actor, { page: "Settings", action: "save", version: snapshot.versions.settings!.version,
        values: { levels: [{ id: "L1", name: "Approver", threshold: 0, holderId: "recipient" }] } }, environment())
      if (!assigned.ok) throw new Error("Canonical matrix: " + JSON.stringify(assigned))
    }
    const created = domain.execute(snapshot, actor, { page: "Requests", action: "create", version: 0, values: { pr: {
      title: "Selected purchase", type: "product", description: "Selected source", estAmount: 100, costCenter: "IT",
      needBy: "2026-12-01", justification: "Source proof", recurring: false, expenseType: "CAPEX",
    } } }, environment())
    if (!created.ok) throw new Error("Canonical request: " + JSON.stringify(created))
    const number = object(created.value).number
    if (typeof number !== "string") throw new Error("Canonical request number missing")
    if (pending) {
      const submitted = domain.execute(snapshot, actor, { page: "Requests", action: "submit_pr", id: number,
        version: snapshot.versions["requests:" + number]!.version, values: {} }, environment())
      if (!submitted.ok) throw new Error("Canonical submission: " + JSON.stringify(submitted))
    }
    return { commit: true, value: number }
  })
  clock.at = "2026-11-22T08:00:00.000Z"
  const location = Schema.decodeUnknownSync(Location.Ref)({ directory })
  const authority = createSfProductAuthority({
    identity: () => ({ installationId: "installation", hostId: "answer-test", projectId: "project", location }),
    installationId: "installation", origin: "https://example.test", policyVersion: "policy", persistence,
    authenticate: async (candidate, options) => {
      const id = candidate.headers.get("actor")
      return authentication.available && id && people.some((person) => person.id === id) && options
        ? resolve(id, [...options.roleMap], (group) => group === "admins") : null
    },
    environment: async () => environment(),
    grants: people.map((person) => ({ principalRef: person.id,
      namespaces: ["threads", "confirmations", "relations", "cases", "preferences"] as const,
      operations: ["sf_work_list", "sf_answer_read", "sf_relation_read", "sf_question_prepare"], humanActions: collaborationHumanActions })),
    createId: randomUUID, now: Date.now, commandIdentity: async () => randomUUID(),
    inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
  })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: new WeakSet<object>() })
  cleanup.business = business
  business.initializeAtlas(undefined, { boundaryVersion: "current-source-test", schemaVersion: "current-source-test",
    manifestVersion: "current-source-test", skillVersion: "current-source-test" })
  const request = () => new Request("https://example.test/product", {
    method: "POST", headers: { origin: "https://example.test", actor: "questioner" },
  })
  const read = async (operation: string, payload: unknown) => {
    const digest = digestSfValue(payload)
    const call = ok(await authority.ui.admit(request(), operation, digest))
    expect(await authority.ui.validate(call, operation, digest)).toBe(true)
    return call
  }
  const human = async <T>(action: CollaborationHumanAction, payload: unknown, run: (call: TrustedUiContext) => Promise<PortResult<T>>) => {
    const call = ok(await authority.human.admit(request(), action, payload))
    try { return await run(call) } finally { authority.human.finish(call) }
  }
  const select = async (selected = period) => {
    const call = await read("sf_work_list", { purpose: "work-selection", period: selected })
    expect(ok(await business.procurementSelections.create(call, selected)).period).toEqual(selected)
    return call
  }
  const selection = await select()
  const sourceRef = ok(await business.individual.issue("procurement-request", requestId, selection))
  const reference = ok(await business.individual.resolve(sourceRef, selection)).evidence
  expect(reference.target.fields).toContain("ageDays")
  expect(reference.target.fields).toContain("sourcing")
  expect((await business.context.resolve(reference, selection)).state).toBe("fresh")
  const draft = { kind: "clarification" as const, sourceRef, sourceIncarnation: reference.target.incarnation,
    observedVersion: reference.target.version, period, recipientRef: "questioner", body: "Please check this purchase.", evidenceRefs: [reference] }
  const mutation = { expectedStorageVersion: 0, idempotencyKey: "self-thread" }
  const thread = ok(await human("collaboration.thread.create", { draft, mutation },
    (call) => business.collaboration.threads.create(draft, mutation, call)))
  expect(thread.messages[0]?.sourceContext?.reviewContext).toBeUndefined()
  const replyMutation = { expectedStorageVersion: ok(await business.collaboration.storageVersion("threads", selection)), idempotencyKey: "self-reply" }
  const recipientActions = business.collaboration.recipientActions
  if (!recipientActions) throw new Error("Recipient actions missing")
  const replied = ok(await human("collaboration.thread.reply", { id: thread.id, body: replyBody, mutation: replyMutation },
    (call) => recipientActions.reply(thread.id, replyBody, replyMutation, call)))
  const message = replied.messages.at(-1)
  if (!message) throw new Error("Reply missing")
  expect(message.authorRef).toBe("questioner")
  const answerRef = "sf-thread-answer:" + [thread.id, message.id, message.incarnation].map(encodeURIComponent).join(":") + ":" + message.version
  const payload = { questionRef: thread.id }
  const answerReuse = business.collaboration.answerReuse
  const capability = business.collaboration.capabilities.find((entry) => entry.id === "sf_answer_read")
  if (!answerReuse || !capability) throw new Error("Answer capability missing")
  const invoke = async (call?: TrustedUiContext) => capability.handler(payload, call ?? await read("sf_answer_read", payload))
  const prepare = async () => ok(await answerReuse.prepare(thread.id, answerRef, await read("sf_answer_read", payload)))
  const confirmation = async (prepared: Awaited<ReturnType<typeof prepare>>, idempotencyKey = randomUUID()): Promise<AnswerConfirmationMutation> => ({
    expectedStorageVersion: ok(await business.collaboration.storageVersion("threads", await read("sf_answer_read", payload))),
    idempotencyKey, observationRef: prepared.observationRef, observedSourceVersion: prepared.observedSourceVersion,
    expectedScopeFingerprint: prepared.expectedScopeFingerprint,
  })
  const confirm = async (mutation: AnswerConfirmationMutation) => human("collaboration.answer.confirm",
    { questionId: thread.id, answerRef, mutation }, (call) => answerReuse.confirm(thread.id, answerRef, mutation, call))
  const command = async (page: "Settings" | "Requests", action: string, values: Command["values"]) =>
    persistence.transaction("procurement", async (snapshot) => {
      const key = page === "Settings" ? "settings" : "requests:" + requestId
      const changed = domain.execute(snapshot, actor, { page, action, values, id: requestId, version: snapshot.versions[key]!.version }, environment())
      if (!changed.ok) throw new Error("Canonical change: " + JSON.stringify(changed))
      return { commit: true, value: changed.value }
    })
  const projection = async () => {
    const call = await read("sf_answer_read", payload)
    const current = ok(await business.individual.issue("procurement-request", requestId, call))
    return { evidence: ok(await business.individual.resolve(current, call)).evidence,
      value: ok(await business.procurement.read({ requestRef: current }, call)) }
  }
  return { business, persistence, authentication, clock, requestId, sourceRef, reference, draft, thread,
    answerRef, payload, read, human, select, invoke, answerReuse, prepare, confirmation, confirm, command, projection }
}

test("ordinary Procurement answer uses the shipped scope, real confirmation and capability receipt", async () => {
  await fixture(false, async (f) => {
    const before = await f.projection()
    expect(before.value.values.find((value) => value.id === "ageDays")?.value).toBeNull()
    const unconfirmed = await f.invoke()
    expect(unconfirmed).toMatchObject({ status: "ok", value: { state: "unconfirmed", answer: replyBody },
      receipt: { kind: "ui", operation: "sf_answer_read", principalRef: "questioner", inputDigest: digestSfValue(f.payload) } })
    const prepared = await f.prepare()
    expect(prepared.scope.scopeDefinitionVersion).toBe("procurement-answer-v1")
    expect(prepared.scope.fields).toEqual([...f.reference.target.fields].sort())
    expect(prepared.scope.period).toEqual(period)
    const mutation = await f.confirmation(prepared, "confirm-current-answer")
    const committed = await f.confirm(mutation)
    expect(committed.status).toBe("ok")
    expect(await f.confirm(mutation)).toEqual(committed)
    expect(await f.invoke()).toMatchObject({ status: "ok", value: { state: "confirmed", answer: replyBody } })

    const call = await f.read("sf_answer_read", f.payload)
    expect(await f.business.collaboration.authority.recipientSources("recipient", [f.reference], call)).toBe(false)
    const version = ok(await f.business.collaboration.storageVersion("threads", call))
    const other = { ...f.draft, recipientRef: "recipient" }
    const attempted = { expectedStorageVersion: version, idempotencyKey: "other-recipient" }
    expect((await f.human("collaboration.thread.create", { draft: other, mutation: attempted },
      (context) => f.business.collaboration.threads.create(other, attempted, context))).status).not.toBe("ok")
    expect(ok(await f.business.collaboration.storageVersion("threads", call))).toBe(version)

    await f.select({ start: "2027-01-01", end: "2027-12-31" })
    const differentPeriod = await f.invoke()
    expect(differentPeriod.status).not.toBe("ok")
    expect(JSON.stringify(differentPeriod)).not.toContain(replyBody)
    await f.select()
    expect(await f.invoke()).toMatchObject({ status: "ok", value: { state: "confirmed" } })

    const admitted = await f.read("sf_answer_read", f.payload)
    f.authentication.available = false
    const unavailable = await f.invoke(admitted)
    expect(unavailable.status).not.toBe("ok")
    expect(JSON.stringify(unavailable)).not.toContain(replyBody)
    f.authentication.available = true
    expect(await f.invoke()).toMatchObject({ status: "ok", value: { state: "confirmed" } })
    const revoked = await f.read("sf_answer_read", f.payload)
    await f.persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.roleMap = []
      return { commit: true, value: undefined }
    })
    const denied = await f.invoke(revoked)
    expect(denied.status).not.toBe("ok")
    expect(JSON.stringify(denied)).not.toContain(replyBody)
  })
}, 120_000)

test("ordinary Procurement answer rejects changed private dependencies and displayed source fields", async () => {
  await fixture(false, async (f) => {
    const prepared = await f.prepare()
    const mutation = await f.confirmation(prepared)
    const before = await f.projection()
    await f.command("Settings", "save", { minQuotes: 4 })
    const dependencyChanged = await f.projection()
    expect(dependencyChanged.evidence.target.projectionDigest).not.toBe(before.evidence.target.projectionDigest)
    expect(dependencyChanged.value.values.map(({ id, value }) => ({ id, value }))).toEqual(before.value.values.map(({ id, value }) => ({ id, value })))
    expect((await f.confirm(mutation)).status).not.toBe("ok")
    const current = await f.prepare()
    expect(current.observation.dependencyFingerprint).not.toBe(prepared.observation.dependencyFingerprint)
    expect((await f.confirm(await f.confirmation(current))).status).toBe("ok")
    expect(await f.invoke()).toMatchObject({ status: "ok", value: { state: "confirmed" } })
    await f.command("Requests", "save", { pr: { title: "Changed selected purchase" } })
    const changed = await f.projection()
    expect(changed.value.values.find((value) => value.id === "subject")?.value).toBe("Changed selected purchase")
    expect(await f.answerReuse.read(f.thread.id, await f.read("sf_answer_read", f.payload))).toEqual({ status: "stale", reason: "answer-scope-changed" })
    expect(await f.invoke()).toMatchObject({ status: "ok", value: { state: "stale" } })
  })
}, 120_000)

test("ordinary Procurement answer ages with the real projection even when canonical stored digest is unchanged", async () => {
  await fixture(true, async (f) => {
    const before = await f.projection()
    expect(before.value.values.find((value) => value.id === "status")?.value).toBe("pr_pending")
    expect(before.value.values.find((value) => value.id === "ageDays")?.value).toBe(1)
    const prepared = await f.prepare()
    const mutation = await f.confirmation(prepared)
    expect((await f.confirm(mutation)).status).toBe("ok")
    expect(await f.invoke()).toMatchObject({ status: "ok", value: { state: "confirmed" } })
    f.clock.at = "2026-11-23T08:00:00.000Z"
    const after = await f.projection()
    expect(after.value.values.find((value) => value.id === "ageDays")?.value).toBe(2)
    expect(after.evidence.target.version).toBe(before.evidence.target.version)
    expect(after.evidence.target.projectionDigest).toBe(before.evidence.target.projectionDigest)
    expect(await f.answerReuse.read(f.thread.id, await f.read("sf_answer_read", f.payload))).toEqual({ status: "stale", reason: "answer-scope-changed" })
    expect(await f.invoke()).toMatchObject({ status: "ok", value: { state: "stale" } })
    expect((await f.confirm(mutation)).status).not.toBe("ok")
    const current = await f.prepare()
    expect(current.observation.sourceFingerprint).not.toBe(prepared.observation.sourceFingerprint)
    expect(current.observation.dependencyFingerprint).toBe(prepared.observation.dependencyFingerprint)
    expect(await f.invoke()).toMatchObject({ status: "ok", value: { state: "stale" } })
  })
}, 120_000)
