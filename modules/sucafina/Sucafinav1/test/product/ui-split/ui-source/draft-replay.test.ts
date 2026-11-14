import { expect, test } from "bun:test"
import { createRecoveryFixture, draftRequest, post, preferences, advanceCase } from "./replay-fixture.ts"

test("lost-register -> legitimate-case-advance -> exact-replay returns the original draft with one durable effect", async () => {
  const f = await createRecoveryFixture()
  try {
    const request = await draftRequest(f), key = "lost-register-exact-replay"
    const first = await post(f, "dashboard-hot-topic-draft", request, key)
    expect(first.status).toBe(200)
    // Delivery-only fault: the real HTTP producer committed, but its ACK is not consumed.
    await first.body?.cancel()
    const committed = await preferences(f)
    const histories = Object.entries(committed.value.preferences).filter(([name]) => name.startsWith("sf:proposal-coverage:hot-topic:history:"))
    expect(histories).toHaveLength(1)
    const stored = histories[0]![1] as { draftRef: string; version: number }
    const currentCase = await advanceCase(f)
    const beforeReplay = await preferences(f)
    const visible = await f.read((context) => f.decisions.drafts.readCurrent({ caseRef: currentCase, draftRef: stored.draftRef }, context))
    expect(visible.status).toBe("ok")
    // A new command carrying the old version remains ineligible to write.
    const staleNew = await post(f, "dashboard-hot-topic-draft", request, "different-command-old-case")
    expect(staleNew.status).toBe(403)
    const replay = await post(f, "dashboard-hot-topic-draft", request, key), body = await replay.json()
    expect(await preferences(f)).toEqual(beforeReplay)
    const domain = await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.hotTopics) }))
    expect(domain).toMatchObject([{ id: "topic", action: "Original action" }])
    expect(f.delayed.calls).toBe(0)
    console.log("UI_SOURCE_LOST_REGISTER", JSON.stringify({ firstStatus: first.status, responseDiscarded: true, caseVersion: currentCase.version,
      currentDraftReadable: visible.status, replayStatus: replay.status, replayBody: body, historyCount: histories.length, staleNewStatus: staleNew.status,
      preferencesUnchanged: true, domainWrites: 0, applyCalls: f.delayed.calls }))
    // Required acceptance assertion stays strong: a 403 is the external producer defect.
    expect(replay.status).toBe(200)
    expect(body).toEqual({ status: "ok", value: { draftRef: stored.draftRef, version: stored.version } })
  } finally { await f.close() }
}, 60000)

test("register exact replay without case advance has one effect; changed content and revoked current authority are refused", async () => {
  const f = await createRecoveryFixture()
  try {
    const request = await draftRequest(f), key = "register-baseline"
    const first = await post(f, "dashboard-hot-topic-draft", request, key)
    expect(first.status).toBe(200)
    const receipt = await first.json(), committed = await preferences(f)
    const replay = await post(f, "dashboard-hot-topic-draft", request, key)
    expect(replay.status).toBe(200)
    expect(await replay.json()).toEqual(receipt)
    expect(await preferences(f)).toEqual(committed)
    const changed = await post(f, "dashboard-hot-topic-draft", { ...request, fields: { ...request.fields, notes: "Different content" } }, key)
    expect(changed.status).toBe(409)
    expect(await preferences(f)).toEqual(committed)
    f.policy.writable = false
    const revoked = await post(f, "dashboard-hot-topic-draft", request, key)
    expect(revoked.status).toBe(403)
    expect(await preferences(f)).toEqual(committed)
    console.log("UI_SOURCE_REPLAY_CONTROLS", JSON.stringify({ replayStatus: replay.status, changedStatus: changed.status, revokedStatus: revoked.status, duplicateWrites: 0 }))
  } finally { await f.close() }
}, 60000)
