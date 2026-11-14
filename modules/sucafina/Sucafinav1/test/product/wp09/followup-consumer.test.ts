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
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { createCollaborationMutationFence } from "../../../product/collaboration/mutation-fence.ts"
import { createCollaborationHotTopicHost } from "../../../product/collaboration/hot-topic-host.ts"
import { createHandoffPort } from "../../../product/collaboration/handoff.ts"
import { createRelationPort } from "../../../product/collaboration/relations.ts"
import { createHotTopicPort } from "../../../product/dashboard/hot-topics.ts"
import { createFollowupHandoff } from "../../../product/routines/handoff.ts"

function available<T>(result: PortResult<T>) {
  if (result.status !== "ok") throw new Error(`${result.status}: ${result.reason}`)
  return result.value
}

/** SQLite and C06/C08/Hot Topics are real; identity and source authority are synthetic fixtures. */
async function fixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-routine-followup-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const gate = { active: true, source: true, loseAcknowledgement: false }
  const at = "2026-11-13T00:00:00Z"
  const person = { id: "person", name: "Selected Person" }
  const identity = { installationId: "installation", projectId: "project", principalRef: person.id, accessRevision: "access", policyVersion: "policy" }
  const source: BusinessEvidenceRef = { schema: "sf-evidence-v1", kind: "record", refId: "review-note", installationId: identity.installationId, projectId: identity.projectId, refDigest: "a".repeat(64), evidenceLevel: "observed", target: { surface: "dashboard", recordType: "projects", recordId: "project", incarnation: "source-inc", version: 1, fields: ["notes"], projectionDigest: "b".repeat(64) } }
  const request = () => new Request("https://example.test/followup", { method: "POST", headers: { origin: "https://example.test", actor: person.id } })
  const ui = createSfUiAuthority({ authorize: async (candidate) => gate.active && candidate.headers.get("actor") === person.id ? identity : undefined, commandIdentity: async (_request, _operation, digest) => digest, createId: randomUUID, now: () => Date.parse(at), privateCommands: ["sf-human:collaboration.handoff.confirm"] })
  const human = createSfHumanAuthority({ origin: "https://example.test", ui })
  const readDigest = digestSfValue({ runRef: "run" })
  const read = available(await ui.admit(request(), "sf_routine_status", readDigest))
  if (!await ui.validate(read, "sf_routine_status", readDigest)) throw new Error("Read admission unavailable")
  const host: DomainPortHost = {
    persistence: store,
    authenticate: async (candidate) => gate.active && candidate.headers.get("actor") === person.id ? resolve(person.id, [{ surface: "dashboard", role: "domain leader", entra: "leaders", version: 0, by: "fixture" }], (group) => group === "leaders") : null,
    environment: async () => ({ at, id: randomUUID, directory: [person] }),
    requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
    revalidate: async (context) => context.kind === "ui" && await ui.revalidate(context),
  }
  const creationTarget = { ref: "workspace", incarnation: "workspace-inc" }
  const state = createSfProductState({ persistence: store, createId: randomUUID, resolveTarget: async () => ({ incarnation: creationTarget.incarnation }), authorize: async (candidate) => gate.active && candidate.headers.get("actor") === person.id ? { principalRef: person.id, accessRevision: "access", policyVersion: "policy" } : undefined })
  const evidence = createSfBusinessContext({ revalidate: host.revalidate, resolveSource: async (ref, context) => ({ state: gate.source ? "fresh" : "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: at }), proveContinuity: async () => false, recall: async () => [], emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" }, reason: "not-selected" }) })
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
  const relations = createRelationPort({ state, host, human, mutationFence, creationTarget, handoffPermit: permit, authorizePair: async (_pair, context) => gate.source && await host.revalidate(context), createId: randomUUID, now: () => at })
  const handoff = createHandoffPort({ hotTopics, relations, human, permit,
    run: async (context, payload, work) => { active.set(context, payload); try { return await work() } finally { active.delete(context) } },
    authorizeIntent: async (_intent, _recipient, context) => gate.source && await host.revalidate(context),
    authorizeUpdate: async (_selected, context) => gate.source && await host.revalidate(context),
    resolveTopic: async (topic) => ({ status: "ok", value: { ref: `topic:${topic.id}`, evidence: { ...source, refId: `topic:${topic.id}`, refDigest: digestSfValue(topic), target: { surface: "dashboard", recordType: "hotTopics", recordId: topic.id, incarnation: `topic-inc:${topic.id}`, version: topic.version, fields: ["action", "owner", "due", "priority"], projectionDigest: digestSfValue(topic) } } } }),
  })
  const followups = createFollowupHandoff({
    resolveNote: async (ref, note, context) => gate.source && ref === source.refId && note === "selected-note" && await host.revalidate(context) ? { status: "ok", value: { sourceRef: source.refId, stableSourceKey: "review:source-inc", evidence: source } } : { status: "denied", reason: "note-unavailable" },
    readTopic: (id, selected, context) => nativeHotTopics.read(id, [selected], context),
    revalidateUpdate: async (_topic, _source, context) => gate.source && await host.revalidate(context), handoff,
  })
  return { gate, source, read, ui, human, followups, relations,
    admit: async (payload: unknown) => available(await human.admit(request(), "collaboration.handoff.confirm", payload)),
    topics: () => store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(rows(snapshot.data.hotTopics)) })),
    dispose: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}

test("routine followups reach real Hot Topics once, recover lost acknowledgement and keep the source relation", async () => {
  const value = await fixture()
  try {
    const request = available(await value.followups.prepare({ noteId: "selected-note", sourceRef: value.source.refId, action: "Review the selected note", owner: "Selected Person", due: "2026-12-01", priority: "normal", notes: "" }, value.read))
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
    expect(available(await value.relations.read([value.source.refId], value.read)).relations).toMatchObject([{ id: retry.relationId, fromRef: value.source.refId, toRef: `topic:${retry.topic.id}` }])
    expect(await value.topics()).toHaveLength(1)
    value.gate.source = false
    expect((await value.followups.confirm(request, await value.admit(request))).status).toBe("denied")
    expect(await value.topics()).toHaveLength(1)
  } finally { await value.dispose() }
})

test("routine update previews exact Hot Topic version, requires consent and rejects stale or revoked changes", async () => {
  const value = await fixture()
  try {
    const create = available(await value.followups.prepare({ noteId: "selected-note", sourceRef: value.source.refId, action: "Original", owner: "Selected Person", due: "2026-12-01", priority: "normal", notes: "" }, value.read))
    const topic = available(await value.followups.confirm(create, await value.admit(create))).topic
    const prepared = available(await value.followups.prepareUpdate({ noteId: "selected-note", sourceRef: value.source.refId, topicId: topic.id, values: { action: "Reviewed followup" } }, value.read))
    expect(prepared.before.action).toBe("Original")
    expect(prepared.after.action).toBe("Reviewed followup")
    expect((await value.topics())[0]!.action).toBe("Original")
    const changed = available(await value.followups.confirmUpdate(prepared.request, await value.admit(prepared.request)))
    expect(changed.topic.version).toBe(topic.version + 1)
    expect(changed.topic.action).toBe("Reviewed followup")
    expect(available(await value.followups.confirmUpdate(prepared.request, await value.admit(prepared.request))).topic.version).toBe(changed.topic.version)
    const stale = { ...prepared.request, idempotencyKey: "different-intention", values: { action: "Stale edit" } }
    expect((await value.followups.confirmUpdate(stale, await value.admit(stale))).status).toBe("conflict")
    const next = available(await value.followups.prepareUpdate({ noteId: "selected-note", sourceRef: value.source.refId, topicId: topic.id, values: { due: "2026-12-15" } }, value.read))
    const cancelled = await value.admit(next.request)
    value.human.finish(cancelled)
    expect((await value.followups.confirmUpdate(next.request, cancelled)).status).toBe("denied")
    const revoked = await value.admit(next.request)
    value.gate.active = false
    expect((await value.followups.confirmUpdate(next.request, revoked)).status).toBe("denied")
    expect((await value.topics())[0]!.due).toBe("2026-12-01")
  } finally { await value.dispose() }
})
