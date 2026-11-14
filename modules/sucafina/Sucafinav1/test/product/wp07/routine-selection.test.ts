import { expect, test } from "bun:test"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createReviewRoutineSelection } from "../../../product/reviews/routine-selection.ts"
import { reviewRoutineFixture } from "./routine-result-fixture.ts"

const context = { kind: "ui", binding: { installationId: "installation", projectId: "project", principalRef: "principal", accessRevision: "access", policyVersion: "policy" } } as TrustedDomainContext

test("a C07 result opens a fresh selection and retains its recorded projection after source changes", async () => {
  const f = await reviewRoutineFixture(context)
  const agenda = createReviewRoutineSelection({ results: f.reader, revalidate: async () => f.state.allowed, now: () => "2026-11-14T00:00:00Z" })
  const created = await agenda.create(f.pin, context)
  if (created.status !== "ok") throw new Error(created.reason)
  expect(created.value.selectionRef.startsWith("review-routine:")).toBe(true)
  expect(created.value.routine).toEqual(f.pin)
  expect(created.value.sections[0]?.projection.values[0]?.value).toBe(1320)
  f.section.projection.values = [{ ...f.section.projection.values[0]!, value: 1400 }]
  const readCount = f.state.reads
  const selected = await agenda.select(created.value.selectionRef, ["request"], context, f.period)
  if (selected.status !== "ok") throw new Error(selected.reason)
  expect(f.state.reads).toBeGreaterThan(readCount)
  expect(selected.value[0]?.projection.values[0]?.value).toBe(1320)
  expect(selected.value[0]?.agendaNote).toBe("Discuss the preserved source")
  const reopened = await agenda.create(f.pin, context)
  if (reopened.status !== "ok") throw new Error(reopened.reason)
  expect(reopened.value.selectionRef).not.toBe(created.value.selectionRef)
  expect(reopened.value.sections).toEqual(created.value.sections)
})

test("client snapshots and changed run/result/digest pins cannot become a review selection", async () => {
  const f = await reviewRoutineFixture(context)
  const agenda = createReviewRoutineSelection({ results: f.reader, revalidate: async () => f.state.allowed, now: () => "2026-11-14T00:00:00Z" })
  expect((await agenda.create({ ...f.pin, resultRef: "other-result" }, context)).status).toBe("stale")
  expect((await agenda.create({ ...f.pin, outputDigest: "b".repeat(64) }, context)).status).toBe("stale")
  expect((await agenda.create({ ...f.pin, runRef: "other-run" }, context)).status).not.toBe("ok")
  expect(await agenda.create({ ...f.pin, agendaSnapshot: f.content.agendaSnapshot } as typeof f.pin, context)).toEqual({ status: "needs-input", reason: "invalid-routine-review" })
})

test("existing selections cannot bypass current authority, result revocation, body tampering or expiry", async () => {
  const f = await reviewRoutineFixture(context)
  const clock = { at: "2026-11-14T00:00:00Z" }
  const agenda = createReviewRoutineSelection({ results: f.reader, revalidate: async () => true, now: () => clock.at })
  const created = await agenda.create(f.pin, context)
  if (created.status !== "ok") throw new Error(created.reason)
  const foreign = { ...context, binding: { ...context.binding, principalRef: "other-principal" } } as TrustedDomainContext
  expect((await agenda.select(created.value.selectionRef, ["request"], foreign)).status).toBe("denied")
  f.state.allowed = false
  const denied = await agenda.select(created.value.selectionRef, ["request"], context)
  expect(denied.status).toBe("denied")
  expect(JSON.stringify(denied)).not.toContain("1320")
  f.state.allowed = true
  f.content.agendaSnapshot.sections[0]!.agendaNote = "Tampered body"
  expect((await agenda.select(created.value.selectionRef, ["request"], context)).status).not.toBe("ok")
  f.content.agendaSnapshot.sections[0]!.agendaNote = "Discuss the preserved source"
  clock.at = "2026-11-14T00:15:00Z"
  expect((await agenda.select(created.value.selectionRef, ["request"], context)).status).toBe("denied")
})

test("revocation during the immutable output read releases neither comments nor values", async () => {
  const f = await reviewRoutineFixture(context)
  const agenda = createReviewRoutineSelection({ results: f.reader, revalidate: async () => f.state.allowed, now: () => "2026-11-14T00:00:00Z" })
  f.state.afterRead = () => { f.state.allowed = false }
  const result = await agenda.create(f.pin, context)
  expect(result.status).not.toBe("ok")
  expect(JSON.stringify(result)).not.toContain("1320")
  expect(JSON.stringify(result)).not.toContain("Discuss the preserved source")
})
