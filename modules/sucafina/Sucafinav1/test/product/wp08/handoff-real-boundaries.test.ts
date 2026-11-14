import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { object, rows } from "../../../runtime/contract.ts"
import { createCollaborationComposition } from "../../../product/collaboration/composition.ts"
import type { SfProductStatePort } from "../../../product/contracts/state.ts"
import { available, createRelationsFixture } from "./relations-fixture.ts"

test("real SQLite handoff survives lost commit acknowledgement without copying private notes or changing source domains", async () => {
  const fixture = await createRelationsFixture()
  try {
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.access = { ...object(snapshot.data.access), "blocked-person": { assigned: [], domains: [] } }
      return { commit: true, value: undefined }
    })
    const host = { ...fixture.host, environment: async (request: Request) => ({ ...await fixture.host.environment(request), directory: [fixture.person, { id: "blocked-person", name: "Other Person" }] }) }
    const source = available(await fixture.records.issue({ page: "All Projects", recordType: "projects", recordId: "project", fields: ["status"], period: fixture.period }, fixture.read))
    const lost = { nextCommit: true }
    // The real C08 transaction has returned from SQLite before this transport fault.
    const state: SfProductStatePort = { read: fixture.state.read, transaction: async (request, command, work) => {
      const result = await fixture.state.transaction(request, command, work)
      if (lost.nextCommit && command.idempotencyKey.startsWith("sf:hot-topic:transaction:") && result.status === "ok") {
        lost.nextCommit = false
        throw new Error("response lost after durable commit")
      }
      return result
    } }
    const compose = (state: SfProductStatePort) => createCollaborationComposition({ host, state, creationTarget: fixture.creationTarget, evidence: fixture.evidence, recordEvidence: fixture.records, human: fixture.human, procurement: { list: async () => ({ status: "unavailable", reason: "not-selected" }) }, selections: { resolve: async () => ({ status: "unavailable", reason: "not-selected" }), contains: async () => ({ status: "unavailable", reason: "not-selected" }) }, createId: randomUUID, now: () => "2026-11-13T00:00:00Z" })
    const factory = compose(state)
    const intent = { intent: { correlationKey: "durable-action", sourceRefs: [source], action: "Review the explicit project", owner: fixture.person.name, due: "2026-12-01", priority: "normal" as const, notes: "" }, sourceRef: source.refId, recipientRef: fixture.person.id, relationKey: "durable-relation" }
    const topics = () => fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(rows(snapshot.data.hotTopics)) }))
    const before = await fixture.snapshots()
    const originalTopics = await topics()
    const privateNotes = { ...intent, intent: { ...intent.intent, notes: "PRIVATE clarification body must stay in its thread" } }
    expect(await factory.handoff.create(privateNotes, await fixture.admit("collaboration.handoff.confirm", privateNotes))).toMatchObject({ status: "denied" })
    const deniedRecipient = { ...intent, recipientRef: "blocked-person", intent: { ...intent.intent, owner: "Other Person" } }
    expect(await factory.handoff.create(deniedRecipient, await fixture.admit("collaboration.handoff.confirm", deniedRecipient))).toMatchObject({ status: "denied" })
    expect(await topics()).toEqual(originalTopics)
    expect(await fixture.snapshots()).toEqual(before)
    const uncertain = await factory.handoff.create(intent, await fixture.admit("collaboration.handoff.confirm", intent))
    expect(uncertain).toEqual({ status: "unavailable", reason: "action-outcome-unknown-retry-same-correlation" })
    const committed = (await topics()).filter((topic) => !originalTopics.some((original) => original.id === topic.id))
    expect(committed).toHaveLength(1)
    expect(committed[0]).toMatchObject({ action: intent.intent.action, notes: "", status: "open" })
    const afterLoss = await fixture.state.read(fixture.request(), "relations", (value) => value.relations)
    if (afterLoss.status !== "ok") throw new Error("durable correlation unavailable")
    expect(Object.keys(afterLoss.value).filter((key) => key.startsWith("sf:hot-topic:"))).toHaveLength(1)
    expect(Object.values(afterLoss.value).filter((value) => object(value).kind === "handoff")).toHaveLength(0)
    const recovered = compose(fixture.state)
    const retried = available(await recovered.handoff.create(intent, await fixture.admit("collaboration.handoff.confirm", intent)))
    expect(retried).toMatchObject({ state: "existing", topic: { id: committed[0]!.id, action: intent.intent.action, notes: "" } })
    expect(available(await recovered.handoff.create(intent, await fixture.admit("collaboration.handoff.confirm", intent)))).toMatchObject({ state: "existing", topic: { id: retried.topic.id }, relationId: retried.relationId })
    expect(await topics()).toHaveLength(originalTopics.length + 1)
    const relations = await fixture.state.read(fixture.request(), "relations", (value) => value.relations)
    if (relations.status !== "ok") throw new Error("recovered relation unavailable")
    expect(Object.values(relations.value).filter((value) => object(value).kind === "handoff")).toHaveLength(1)
    expect(Object.keys(relations.value).filter((key) => key.startsWith("sf:assignment:"))).toHaveLength(1)
    const conflict = { ...intent, intent: { ...intent.intent, action: "Different content with the same correlation" } }
    expect((await recovered.handoff.create(conflict, await fixture.admit("collaboration.handoff.confirm", conflict))).status).toBe("conflict")
    expect(await topics()).toHaveLength(originalTopics.length + 1)
    const after = await fixture.snapshots()
    expect(after.planner).toEqual(before.planner)
    expect(after.procurement).toEqual(before.procurement)
    const sourceData = (data: Record<string, unknown>) => Object.fromEntries(Object.entries(data).filter(([key]) => key !== "hotTopics"))
    const sourceVersions = (versions: typeof after.dashboard.versions) => Object.fromEntries(Object.entries(versions).filter(([key]) => !key.startsWith("hotTopics:")))
    expect(sourceData(after.dashboard.data)).toEqual(sourceData(before.dashboard.data))
    expect(sourceVersions(after.dashboard.versions)).toEqual(sourceVersions(before.dashboard.versions))
    expect(JSON.stringify(after.dashboard.data)).not.toContain(privateNotes.intent.notes)
  } finally {
    await fixture.dispose()
  }
})
