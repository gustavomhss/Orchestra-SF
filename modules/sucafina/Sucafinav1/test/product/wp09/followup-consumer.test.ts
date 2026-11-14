import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { rows } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainPortHost, PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createCollaborationHumanAuthority } from "../../../product/collaboration/human.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { createCollaborationMutationFence } from "../../../product/collaboration/mutation-fence.ts"
import { createCollaborationHotTopicHost } from "../../../product/collaboration/hot-topic-host.ts"
import { createHandoffPort } from "../../../product/collaboration/handoff.ts"
import { createRelationPort } from "../../../product/collaboration/relations.ts"
import { createHotTopicPort } from "../../../product/dashboard/hot-topics.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { createSfDashboardRecordSourceAccess } from "../../../product/decision-memory/source-access.ts"
import { createFollowupHandoff } from "../../../product/routines/handoff.ts"

function available<T>(result: PortResult<T>) {
  if (result.status !== "ok") throw new Error(`${result.status}: ${result.reason}`)
  return result.value
}

/** SQLite, scoped Dashboard sources and C06/C08/Hot Topics are real; signed-in identity is a fixture. */
async function fixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-routine-followup-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const gate = { active: true, loseAcknowledgement: false }
  const at = "2026-11-13T00:00:00Z"
  const period = { start: at.slice(0, 10), end: at.slice(0, 10) }
  const person = { id: "person", name: "Selected Person" }
  const identity = { installationId: "installation", projectId: "project", principalRef: person.id, accessRevision: "access", policyVersion: "policy" }
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.roleMap = [{ surface: "dashboard", role: "domain leader", entra: "leaders", version: 1, by: "fixture" }]
    snapshot.data.hotTopics = [{ id: "source-topic", action: "Source topic", owner: person.name, due: "2026-12-01", status: "open", priority: "normal", notes: "Review the selected note" }]
    return { commit: true, value: undefined }
  })
  const request = () => new Request("https://example.test/followup", { method: "POST", headers: { origin: "https://example.test", actor: person.id } })
  const ui = createSfUiAuthority({ authorize: async (candidate) => gate.active && candidate.headers.get("actor") === person.id ? identity : undefined, commandIdentity: async (_request, _operation, digest) => digest, createId: randomUUID, now: () => Date.parse(at), privateCommands: ["sf-human:collaboration.handoff.confirm"] })
  const human = createCollaborationHumanAuthority({ origin: "https://example.test", ui })
  const readDigest = digestSfValue({ runRef: "run" })
  const read = available(await ui.admit(request(), "sf_routine_status", readDigest))
  if (!await ui.validate(read, "sf_routine_status", readDigest)) throw new Error("Read admission unavailable")
  const host: DomainPortHost = {
    persistence,
    authenticate: async (candidate, options) => gate.active && candidate.headers.get("actor") === person.id ? resolve(person.id, [...options!.roleMap], (group) => group === "leaders") : null,
    environment: async () => ({ at, id: randomUUID, directory: [person] }),
    requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
    revalidate: async (context) => context.kind === "ui" && await ui.revalidate(context),
  }
  const creationTarget = { ref: "workspace", incarnation: "workspace-inc" }
  const state = createSfProductState({ persistence, createId: randomUUID, resolveTarget: async (_request, _snapshot, _namespace, target) => target === creationTarget.ref ? { incarnation: creationTarget.incarnation } : undefined, authorize: async (candidate) => gate.active && candidate.headers.get("actor") === person.id ? { principalRef: person.id, accessRevision: "access", policyVersion: "policy" } : undefined })
  const records = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
  const source = available(await records.issue({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: "source-topic", fields: ["notes"], period }, read))
  const noteId = "hotTopics:source-topic:notes"
  const evidence = createSfBusinessContext({ revalidate: host.revalidate, resolveSource: createSfDashboardRecordSourceAccess({ host, records }), proveContinuity: async () => false, recall: async () => [], emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" }, reason: "not-selected" }) })
  const authorizeRefs = async (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => {
    const resolutions = await evidence.context({ refs }, context)
    return resolutions.length === refs.length && resolutions.every((entry, index) => entry.state === "fresh" && digestSfValue(entry.ref) === digestSfValue(refs[index])) && await host.revalidate(context)
  }
  const mutationFence = createCollaborationMutationFence(host)
  const active = new WeakMap<TrustedDomainContext, unknown>()
  const permit = Symbol("routine-followup")
  const nativeHotTopics = createHotTopicPort(createCollaborationHotTopicHost({ host, state, evidence, creationTarget, mutationFence, authorizeMutation: async (context) => active.has(context) && human.authorize(context, "collaboration.handoff.confirm", active.get(context)) }))
  const hotTopics = { ...nativeHotTopics, create: async (...args: Parameters<typeof nativeHotTopics.create>) => {
    const result = await nativeHotTopics.create(...args)
    if (gate.loseAcknowledgement && result.status === "ok") {
      gate.loseAcknowledgement = false
      throw new Error("transport interrupted after domain commit")
    }
    return result
  } }
  const relations = createRelationPort({ state, host, human, mutationFence, creationTarget, handoffPermit: permit, authorizePair: (pair, context) => authorizeRefs(pair.evidenceRefs, context), createId: randomUUID, now: () => at })
  const handoff = createHandoffPort({ hotTopics, relations, human, permit,
    run: async (context, payload, work) => { active.set(context, payload); try { return await work() } finally { active.delete(context) } },
    authorizeIntent: (intent, _recipient, context) => authorizeRefs(intent.sourceRefs, context),
    authorizeUpdate: (selected, context) => authorizeRefs(selected.sourceRefs, context),
    resolveTopic: async (topic, context) => {
      const current = await nativeHotTopics.read(topic.id, [source], context)
      if (current.status !== "ok") return current
      if (digestSfValue(current.value) !== digestSfValue(topic)) return { status: "stale", reason: "action-selection-changed" }
      const target = await records.issue({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: topic.id, fields: ["action", "owner", "due", "priority", "notes"], period }, context)
      return target.status === "ok" ? { status: "ok", value: { ref: target.value.refId, evidence: target.value } } : target
    },
  })
  const followups = createFollowupHandoff({
    resolveNote: async (ref, note, context) => {
      if (ref !== source.refId || note !== noteId || !await authorizeRefs([source], context)) return { status: "denied", reason: "note-unavailable" }
      const selected = await records.read(ref, context)
      if (selected.status !== "ok" || !selected.value.values.some((value) => value.id === noteId && value.value === "Review the selected note")) return { status: "denied", reason: "note-unavailable" }
      return { status: "ok", value: { sourceRef: source.refId, stableSourceKey: `${source.target.recordType}:${source.target.incarnation}:notes`, evidence: source } }
    },
    readTopic: (id, selected, context) => nativeHotTopics.read(id, [selected], context),
    revalidateUpdate: (_topic, selected, context) => authorizeRefs([selected], context), handoff,
  })
  return { gate, source, noteId, read, ui, human, followups, relations,
    admit: async (payload: unknown) => available(await human.admit(request(), "collaboration.handoff.confirm", payload)),
    topics: () => persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(rows(snapshot.data.hotTopics).filter((topic) => topic.id !== "source-topic")) })),
    revokeSource: () => persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = []; return { commit: true, value: undefined } }),
    dispose: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}

test("routine followups reach real Hot Topics once, recover lost acknowledgement and keep the source relation", async () => {
  const value = await fixture()
  try {
    const request = available(await value.followups.prepare({ noteId: value.noteId, sourceRef: value.source.refId, action: "Review the selected note", owner: "Selected Person", due: "2026-12-01", priority: "normal", notes: "" }, value.read))
    expect(await value.topics()).toEqual([])
    expect((await value.followups.confirm(request, value.read)).status).toBe("denied")
    const consent = await value.admit(request)
    expect((await value.followups.confirm({ ...request, intent: { ...request.intent, action: "Unreviewed" } }, consent)).status).toBe("denied")
    value.gate.loseAcknowledgement = true
    expect(await value.followups.confirm(request, consent)).toEqual({ status: "unavailable", reason: "action-outcome-unknown-retry-same-correlation" })
    expect(await value.topics()).toHaveLength(1)
    const retry = available(await value.followups.confirm(request, await value.admit(request)))
    expect(retry.state).toBe("existing")
    expect(retry.topic.action).toBe("Review the selected note")
    const relations = available(await value.relations.read([value.source.refId], value.read)).relations
    expect(relations).toHaveLength(1)
    expect(relations[0]).toMatchObject({ id: retry.relationId, fromRef: value.source.refId })
    expect(relations[0]!.evidenceRefs.find((ref) => ref.refId === relations[0]!.toRef)).toMatchObject({ kind: "record", target: { recordType: "hotTopics", recordId: retry.topic.id } })
    expect(await value.topics()).toHaveLength(1)
    await value.revokeSource()
    expect((await value.followups.confirm(request, await value.admit(request))).status).toBe("denied")
    expect(await value.topics()).toHaveLength(1)
  } finally { await value.dispose() }
}, 120_000)

test("routine update previews exact Hot Topic version, requires consent and rejects stale or revoked changes", async () => {
  const value = await fixture()
  try {
    const create = available(await value.followups.prepare({ noteId: value.noteId, sourceRef: value.source.refId, action: "Original", owner: "Selected Person", due: "2026-12-01", priority: "normal", notes: "" }, value.read))
    const topic = available(await value.followups.confirm(create, await value.admit(create))).topic
    const prepared = available(await value.followups.prepareUpdate({ noteId: value.noteId, sourceRef: value.source.refId, topicId: topic.id, values: { action: "Reviewed followup" } }, value.read))
    expect(prepared.before.action).toBe("Original")
    expect(prepared.after.action).toBe("Reviewed followup")
    expect((await value.topics())[0]!.action).toBe("Original")
    const changed = available(await value.followups.confirmUpdate(prepared.request, await value.admit(prepared.request)))
    expect(changed.topic.version).toBe(topic.version + 1)
    expect(changed.topic.action).toBe("Reviewed followup")
    expect(available(await value.followups.confirmUpdate(prepared.request, await value.admit(prepared.request))).topic.version).toBe(changed.topic.version)
    const stale = { ...prepared.request, idempotencyKey: "different-intention", values: { action: "Stale edit" } }
    expect((await value.followups.confirmUpdate(stale, await value.admit(stale))).status).toBe("conflict")
    const next = available(await value.followups.prepareUpdate({ noteId: value.noteId, sourceRef: value.source.refId, topicId: topic.id, values: { due: "2026-12-15" } }, value.read))
    const cancelled = await value.admit(next.request)
    value.human.finish(cancelled)
    expect((await value.followups.confirmUpdate(next.request, cancelled)).status).toBe("denied")
    const revoked = await value.admit(next.request)
    value.gate.active = false
    expect((await value.followups.confirmUpdate(next.request, revoked)).status).toBe("denied")
    expect((await value.topics())[0]!.due).toBe("2026-12-01")
  } finally { await value.dispose() }
}, 120_000)
