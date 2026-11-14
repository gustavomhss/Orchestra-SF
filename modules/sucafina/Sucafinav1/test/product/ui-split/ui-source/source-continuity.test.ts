import { expect, test } from "bun:test"
import { sfSourceIdentity } from "../../../../product/integration/source-lifecycle.ts"
import { createRecoveryFixture, draftRequest, post } from "./replay-fixture.ts"

test("F04 boundary: read-only reissue changes scoped identity while physical source stays the same; record ID alone also survives ABA", async () => {
  const f = await createRecoveryFixture()
  try {
    const unsaved = await draftRequest(f)
    const physical = () => f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "hotTopics", "topic") }))
    const originalPhysical = await physical()
    expect(originalPhysical?.alive).toBe(true)
    f.policy.writable = false
    const fresh = await draftRequest(f)
    expect(await physical()).toEqual(originalPhysical)
    expect(fresh.target.id).toBe(unsaved.target.id)
    expect(fresh.target.incarnation).not.toBe(unsaved.target.incarnation)
    const resolution = await f.read((context) => f.business.context.resolve(unsaved.targetEvidence, context))
    expect(resolution.state).toBe("unavailable")
    const register = await post(f, "dashboard-hot-topic-draft", fresh, "write-after-revocation")
    expect(register.status).toBe(403)
    // The existing source endpoint accepts only recordId + period. It cannot certify
    // continuity from this original unsaved source. This is a boundary reproduction,
    // not a passing F04 browser-retention claim or a fabricated endpoint implementation.
    const continuity = await post(f, "dashboard-hot-topic-source", { recordId: "topic", period: fresh.target.period, originalEvidence: unsaved.targetEvidence })
    expect(continuity.status).toBe(400)
    await f.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.hotTopics = []; return { commit: true, value: undefined } })
    await f.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.hotTopics = [{ id: "topic", action: "Replacement action", owner: "Operations", due: "2026-12-01", priority: "normal", status: "open", notes: "" }]
      return { commit: true, value: undefined }
    })
    const replacement = await draftRequest(f), replacementPhysical = await physical()
    expect(replacement.target.id).toBe(unsaved.target.id)
    expect(replacementPhysical?.incarnation).not.toBe(originalPhysical?.incarnation)
    expect(replacement.target.incarnation).not.toBe(fresh.target.incarnation)
    expect((await f.read((context) => f.business.context.resolve(unsaved.targetEvidence, context))).state).toBe("unavailable")
    console.log("UI_SOURCE_F04_BOUNDARY", JSON.stringify({ readOnlySource: "ok", samePhysicalSource: true, scopedIncarnationChanged: true,
      originalEvidence: resolution.state, writeStatus: register.status, continuityRequestStatus: continuity.status, sameRecordIdAfterABA: true,
      originalPhysical: originalPhysical?.incarnation, replacementPhysical: replacementPhysical?.incarnation, f04Acceptance: "BLOCKED_EXTERNAL_PORT" }))
  } finally { await f.close() }
}, 60000)
