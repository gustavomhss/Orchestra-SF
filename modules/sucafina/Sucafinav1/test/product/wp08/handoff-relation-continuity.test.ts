import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { sfSourceIdentity } from "../../../product/integration/source-lifecycle.ts"
import { DashboardPeople } from "../../../runtime/dashboard-people.ts"
import { rows } from "../../../runtime/contract.ts"
import { available } from "./relations-fixture.ts"
import { createThreadActorsFixture } from "./thread-actors-fixture.ts"

// Actual Dashboard action/source lifecycle, C08 relation storage and product reader.
// The fixture's recipient lease is an explicit boundary; it is not native execution.
test("a completed handoff keeps one protected relation and rejects a replacement action with the same textual id", async () => {
  const fixture = await createThreadActorsFixture()
  try {
    const source = await fixture.issueProject(fixture.author)
    const request = { sourceRef: source.refId, recipientRef: "person", relationKey: "current-action-link", intent: { correlationKey: "current-action", sourceRefs: [source], action: "Close the selected review action", owner: "Author", due: "2026-12-01", priority: "normal" as const, notes: "" } }
    const action = available(await fixture.port.handoff.create(request, await fixture.admit("person", "collaboration.handoff.confirm", request)))
    const storedRelation = async () => {
      const stored = await fixture.state.read(fixture.request("person"), "relations", (state) => state.relations[action.relationId])
      if (stored.status !== "ok") throw new Error("Canonical relation unavailable")
      return stored.value
    }
    const stored = structuredClone(await storedRelation())
    const original = available(await fixture.port.relations.readVersioned([source.refId], fixture.author))
    expect(original).toHaveLength(1)
    const before = await fixture.snapshots()
    const physical = sfSourceIdentity(before.dashboard, "hotTopics", action.topic.id)
    await fixture.mutate("dashboard", DashboardPeople.domain, { page: "Hot Topics & Actions", action: "save", id: action.topic.id, version: action.topic.version, values: { status: "done" } })
    const current = available(await fixture.port.relations.readVersioned([source.refId], fixture.author))
    expect(current).toHaveLength(1)
    expect(current[0]).toMatchObject({ id: action.relationId, version: 1, from: source, state: "confirmed" })
    expect(current[0]!.to.refDigest).not.toBe(original[0]!.to.refDigest)
    const projection = available(await fixture.records.read(current[0]!.to.refId, fixture.author))
    expect(projection.values.find((value) => value.id === `hotTopics:${action.topic.id}:status`)?.value).toBe("done")
    expect(digestSfValue(await storedRelation())).toBe(digestSfValue(stored))
    const completed = await fixture.snapshots()
    const saved = rows(completed.dashboard.data.hotTopics).find((row) => row.id === action.topic.id)!
    expect(sfSourceIdentity(completed.dashboard, "hotTopics", action.topic.id)?.incarnation).toBe(physical?.incarnation)
    fixture.actors.person!.enabled = false
    expect((await fixture.port.relations.readVersioned([source.refId], fixture.author)).status).not.toBe("ok")
    fixture.actors.person!.enabled = true
    // Revocation retires this UI grant permanently; restoration needs a new admission.
    expect((await fixture.port.relations.readVersioned([source.refId], fixture.author)).status).not.toBe("ok")
    const restored = await fixture.admitRead("person")
    expect(available(await fixture.port.relations.readVersioned([source.refId], restored))).toHaveLength(1)
    await fixture.mutate("dashboard", DashboardPeople.domain, { page: "Hot Topics & Actions", action: "delete", id: action.topic.id, version: completed.dashboard.versions[`hotTopics:${action.topic.id}`]!.version, values: {} })
    expect(available(await fixture.port.relations.readVersioned([source.refId], restored))).toEqual([])
    // The lawful producer refuses tombstone reuse. Inject hostile storage through
    // the real lifecycle to ensure textual equality cannot authorize a new record.
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.hotTopics = [...rows(snapshot.data.hotTopics), { ...saved }]
      return { commit: true, value: undefined }
    })
    const replaced = await fixture.snapshots()
    expect(sfSourceIdentity(replaced.dashboard, "hotTopics", action.topic.id)?.incarnation).not.toBe(physical?.incarnation)
    expect(available(await fixture.port.relations.readVersioned([source.refId], restored))).toEqual([])
    expect(digestSfValue(await storedRelation())).toBe(digestSfValue(stored))
  } finally {
    await fixture.dispose()
  }
})
