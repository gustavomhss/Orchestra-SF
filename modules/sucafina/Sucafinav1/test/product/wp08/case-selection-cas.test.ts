import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { available } from "./relations-fixture.ts"
import { createThreadActorsFixture } from "./thread-actors-fixture.ts"

// SQLite preferences CAS, case producer and human admissions are real. Only
// transport order is delayed; no conflict response or state callback is mocked.
test("a lost case-selection CAS is a known no-commit conflict and retains exact retry identity", async () => {
  const fixture = await createThreadActorsFixture()
  try {
    const port = fixture.port.caseSelection
    if (!port) throw new Error("Case selection unavailable")
    const source = await fixture.issueProject(fixture.author)
    const caseDraft = { objective: "Resolve an explicit selection race", horizon: fixture.period, currency: "USD", criteria: ["Preserve the winner and retry identity"], sourceRefs: [source] }
    const caseContext = available(await fixture.ui.admit(fixture.request("person"), "sf_case_draft", digestSfValue(caseDraft)))
    expect(await fixture.ui.validate(caseContext, "sf_case_draft", digestSfValue(caseDraft))).toBe(true)
    const decision = available(await fixture.cases.draft(caseDraft, caseContext))
    const draft = { caseRef: encodeCaseRef(decision), period: fixture.period, sourceRefs: [source] }
    const expectedStorageVersion = available(await port.storageVersion(fixture.author))
    const delayedMutation = { expectedStorageVersion, idempotencyKey: "delayed-selection" }
    const winnerMutation = { expectedStorageVersion, idempotencyKey: "winning-selection" }
    const delayedContext = await fixture.admit("person", "collaboration.selection.create", { draft, mutation: delayedMutation })
    const winner = available(await port.create(draft, winnerMutation, await fixture.admit("person", "collaboration.selection.create", { draft, mutation: winnerMutation })))
    const committed = available(await fixture.state.read(fixture.request("person"), "preferences", (state) => structuredClone(state.preferences)))
    const version = available(await port.storageVersion(fixture.author))
    expect(version).toBe(expectedStorageVersion + 1)
    const rejected = await port.create(draft, delayedMutation, delayedContext)
    expect(rejected).toEqual({ status: "conflict", reason: "selection-not-committed" })
    expect(available(await port.storageVersion(fixture.author))).toBe(version)
    expect(available(await fixture.state.read(fixture.request("person"), "preferences", (state) => state.preferences))).toEqual(committed)
    expect(available(await port.list(draft.caseRef, fixture.author))).toEqual([{ selectionRef: winner.selectionRef, period: fixture.period, state: "active" }])

    // A committed attempt is resolved before the old expected version is checked.
    expect(available(await port.create(draft, winnerMutation, await fixture.admit("person", "collaboration.selection.create", { draft, mutation: winnerMutation })))).toEqual(winner)
    expect(available(await port.storageVersion(fixture.author))).toBe(version)
    const changed = { ...draft, sourceRefs: [] }
    const changedIntent = await port.create(changed, winnerMutation, await fixture.admit("person", "collaboration.selection.create", { draft: changed, mutation: winnerMutation }))
    expect(changedIntent).toEqual({ status: "unavailable", reason: "selection-unavailable" })
    expect(available(await port.storageVersion(fixture.author))).toBe(version)

    // Reading the current version alone does not write. A new intention is
    // committed only after a distinct explicit admission with a new key.
    const reconsidered = { expectedStorageVersion: version, idempotencyKey: "reviewed-new-selection" }
    const next = available(await port.create(draft, reconsidered, await fixture.admit("person", "collaboration.selection.create", { draft, mutation: reconsidered })))
    expect(next.selectionRef).not.toBe(winner.selectionRef)
    expect(available(await port.list(draft.caseRef, fixture.author))).toHaveLength(2)
    fixture.actors.person!.enabled = false
    const denied = await port.create(draft, delayedMutation, delayedContext)
    expect(denied).toEqual({ status: "denied", reason: "selection-unavailable" })
    expect(JSON.stringify(denied)).not.toContain(winner.selectionRef)
  } finally { await fixture.dispose() }
})
