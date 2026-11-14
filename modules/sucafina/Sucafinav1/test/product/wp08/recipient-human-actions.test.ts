import { expect, test } from "bun:test"
import { collaborationHumanActions, createCollaborationHumanAuthority } from "../../../product/collaboration/human.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"

function authority(privateCommands = collaborationHumanActions.map((action) => `sf-human:${action}`)) {
  const state = { now: Date.parse("2026-11-13T00:00:00Z"), active: true, id: 0 }
  const ui = createSfUiAuthority({
    privateCommands,
    authorize: async (request) => state.active && request.headers.get("authorization") === "person" ? { installationId: "installation", projectId: "project", principalRef: "person", accessRevision: "access", policyVersion: "policy" } : undefined,
    commandIdentity: async () => "intent",
    createId: () => `request-${++state.id}`,
    now: () => state.now,
  })
  return { state, ui, human: createCollaborationHumanAuthority({ origin: "https://example.test", ui }) }
}

function request(input: { method?: string; origin?: string; site?: string; signal?: AbortSignal } = {}) {
  return new Request("https://example.test/collaboration", { method: input.method ?? "POST", headers: { origin: input.origin ?? "https://example.test", "sec-fetch-site": input.site ?? "same-origin", authorization: "person" }, signal: input.signal })
}

test("extended collaboration actions require explicitly registered commands and live human grants", async () => {
  const selected = { questionId: "question", answerRef: "answer", mutation: { observationRef: "observed", observedSourceVersion: 7, expectedScopeFingerprint: "scope", expectedStorageVersion: 2, idempotencyKey: "confirm" } }
  expect((await authority([]).human.admit(request(), "collaboration.answer.confirm", selected)).status).toBe("denied")
  const fixture = authority()
  fixture.state.active = false
  expect((await fixture.human.admit(request(), "collaboration.answer.confirm", selected)).status).toBe("denied")
  fixture.state.active = true
  const admitted = await fixture.human.admit(request(), "collaboration.answer.confirm", selected)
  if (admitted.status !== "ok") throw new Error("No human admission")
  expect(await fixture.human.authorize(admitted.value, "collaboration.answer.confirm", selected)).toBe(true)
  expect(await fixture.human.authorize(admitted.value, "collaboration.answer.confirm", { ...selected, answerRef: "different-answer" })).toBe(false)
  expect(await fixture.human.authorize(admitted.value, "collaboration.selection.create", selected)).toBe(false)
  expect(await fixture.human.authorize(structuredClone(admitted.value), "collaboration.answer.confirm", selected)).toBe(false)
  fixture.human.finish(admitted.value)
  expect(await fixture.human.authorize(admitted.value, "collaboration.answer.confirm", selected)).toBe(false)
})

test("thread edit admission is confined to POST, same origin and the retained current request", async () => {
  const fixture = authority()
  const selected = { id: "thread", messageId: "message", expectedVersion: 1, body: "Edited", mutation: { expectedStorageVersion: 1, idempotencyKey: "edit" } }
  for (const candidate of [request({ method: "GET" }), request({ origin: "https://other.test" }), request({ site: "cross-site" })]) expect((await fixture.human.admit(candidate, "collaboration.thread.edit", selected)).status).toBe("denied")
  const admitted = await fixture.human.admit(request(), "collaboration.thread.edit", selected)
  if (admitted.status !== "ok") throw new Error("No edit admission")
  expect(await fixture.human.authorize(admitted.value, "collaboration.thread.edit", selected)).toBe(true)
  fixture.state.active = false
  expect(await fixture.human.authorize(admitted.value, "collaboration.thread.edit", selected)).toBe(false)
  fixture.state.active = true
  expect(await fixture.human.authorize(admitted.value, "collaboration.thread.edit", selected)).toBe(false)
})

test("cancelled and expired selection admissions never regain authority", async () => {
  const fixture = authority()
  const payload = { caseRef: { id: "case", incarnation: "case-inc", version: 2 }, memberRefs: ["member"] }
  const controller = new AbortController()
  const admitted = await fixture.human.admit(request({ signal: controller.signal }), "collaboration.selection.create", payload)
  if (admitted.status !== "ok") throw new Error("No selection admission")
  controller.abort()
  expect(await fixture.human.authorize(admitted.value, "collaboration.selection.create", payload)).toBe(false)
  const expires = await fixture.human.admit(request(), "collaboration.selection.create", payload)
  if (expires.status !== "ok") throw new Error("No expiring selection admission")
  fixture.state.now += 5 * 60 * 1000
  expect(await fixture.human.authorize(expires.value, "collaboration.selection.create", payload)).toBe(false)
})
