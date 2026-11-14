import { expect } from "bun:test"
import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { HotTopicDraftRequest } from "../../../../product/decisions/hot-topic-draft.ts"
import { createRecoveryFixture, initialCaseRef } from "../../wp02/workbench-recovery-fixture.ts"

export { createRecoveryFixture, initialCaseRef }
export type Fixture = Awaited<ReturnType<typeof createRecoveryFixture>>
export async function post(f: Fixture, mode: string, body: unknown, key: string = randomUUID()) {
  const headers = new Headers(f.request().headers)
  headers.set("idempotency-key", key)
  return fetch(`${f.origin}/sucafina/dashboard?sf=${mode}`, { method: "POST", headers, body: JSON.stringify(body) })
}
export async function draftRequest(f: Fixture): Promise<HotTopicDraftRequest> {
  const day = f.clock.at.slice(0, 10)
  const response = await post(f, "dashboard-hot-topic-source", { recordId: "topic", period: { start: day, end: day } })
  expect(response.status).toBe(200)
  const result = await response.json()
  expect(result.status).toBe("ok")
  return { caseRef: initialCaseRef, ...result.value, fields: { action: "Unsaved human proposal", owner: "Operations", due: "2026-12-08", priority: "high", notes: "Retain this human wording" }, sourceRefs: [result.value.targetEvidence], expectedVersion: 0 }
}
export async function preferences(f: Fixture) {
  const current = await f.authority.state.read(f.request(), "preferences", (state) => ({ preferences: structuredClone(state.preferences), transactions: structuredClone(state.transactions) }))
  if (current.status !== "ok") throw new Error(`Preferences unavailable: ${current.status}`)
  return current
}
export async function advanceCase(f: Fixture) {
  const current = await f.authority.state.read(f.request(), "cases", (state) => state.cases[initialCaseRef.id])
  if (current.status !== "ok" || !current.value) throw new Error("Current case unavailable")
  const before = current.value
  // Authorized C08 fixture event: objective-only advance. Identity, participants,
  // horizon, currency, criteria and source evidence are unchanged; no C12 apply occurs.
  const after = { ...before, version: before.version + 1, objective: "Review the action after the working meeting" }
  const result = await f.authority.state.transaction(f.request(), { namespace: "cases", expectedStorageVersion: current.storageVersion,
    targetRef: before.id, targetIncarnation: before.incarnation, idempotencyKey: "legitimate-objective-advance", commandDigest: digestSfValue(after) }, async (state) => {
      expect(state.cases[before.id]).toEqual(before)
      state.cases[before.id] = after
      return { commit: true, value: { id: after.id, incarnation: after.incarnation, version: after.version } }
    })
  expect(result.status).toBe("ok")
  return { id: after.id, incarnation: after.incarnation, version: after.version }
}
