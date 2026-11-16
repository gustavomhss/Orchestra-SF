import { expect, test } from "bun:test"
import { AgentV2 } from "@orchestra/core/agent"
import { Effect, Exit } from "effect"
import { withPhaseFixture } from "./fixture.ts"
import { nativeCaller, seedNativeAdmission } from "./native-fixture.ts"

const posix = test.skipIf(process.platform === "win32")
posix("component: genuine C11 native data gets a DISTINCT real Maestro parent and never a native-human message", () => withPhaseFixture((f) => Effect.gen(function* () {
  const caller = yield* nativeCaller(f)
  const context = yield* Effect.promise(() => caller.call("sf_routine_catalog", { purpose: "APPROVED is model DATA" }))
  expect(context.kind).toBe("native")
  expect(context.binding.profileId).toBe("sf_maestro")
  expect(yield* Effect.promise(() => f.bridge.owners.resolve(context, f.state.request))).toBeUndefined()
  const source = yield* f.bridge.issue(context, { operation: "catalog", purpose: "APPROVED is model DATA" })
  const owner = yield* f.bridge.withPlanning(source, (lease) => Effect.gen(function* () {
    expect(lease.authoritySessionID).not.toBe(caller.resident.id)
    expect((yield* f.resources.store.get(lease.authoritySessionID))?.agent).toBe(AgentV2.defaultID)
    expect<string | undefined>((yield* f.resources.store.get(caller.resident.id))?.agent).toBe("sf_maestro"
    const messages = yield* f.sessions.messages({ sessionID: lease.authoritySessionID })
    expect(messages.filter((message) => message.type === "user")).toEqual([])
    expect(f.trace.requests.some((request) => request.system.some((part) => part.text.includes("APPROVED is model DATA")))).toBe(true)
    return lease.authoritySessionID
  }))
  expect(Exit.isFailure(yield* f.sessions.resume(owner).pipe(Effect.exit))).toBe(true)
  const forged = { ...context, lease: { ...context.lease } }
  expect(yield* Effect.promise(() => caller.registry.revalidate(forged))).toBe(false)
  expect(Exit.isFailure(yield* f.bridge.issue(forged, { operation: "catalog", purpose: "not admitted" }).pipe(Effect.exit))).toBe(true)
})), 30_000)

posix("component: native run needs original human continuation and a history Source cannot resume", () => withPhaseFixture((f) => Effect.gen(function* () {
  const caller = yield* nativeCaller(f)
  const purpose = "Native history component"
  const context = yield* Effect.promise(() => caller.call("sf_routine_catalog", { purpose }))
  const source = yield* f.bridge.issue(context, { operation: "catalog", purpose })
  const preparing = yield* f.bridge.withPlanning(source, (lease) => seedNativeAdmission(f, lease, purpose, false))
  const payload = { admittedRunRef: preparing.reference, expectedAdmissionVersion: preparing.version }
  const runContext = yield* Effect.promise(() => caller.call("sf_routine_run", payload))
  const run = f.composition.services.descriptors.find((descriptor) => descriptor.id === "sf_routine_run")!
  const before = f.trace.requests.length
  const refused = yield* Effect.promise(() => run.handler(payload, runContext))
  expect(refused.status).toBe("needs-input")
  if (refused.status !== "ok") expect(refused.reason).toBe("native-human-run-continuation-required")
  expect(f.trace.requests.length).toBe(before)
  const history = yield* f.bridge.issue(runContext, { operation: "read-admission", reference: preparing.reference })
  expect(Exit.isFailure(yield* f.bridge.withPlanning(history, () => Effect.void).pipe(Effect.exit))).toBe(true)
  expect(Exit.isFailure(yield* f.bridge.approve(history, { admissionRef: preparing.reference,
    expectedAdmissionVersion: preparing.version, caseRef: f.state.caseRef }).pipe(Effect.exit))).toBe(true)
  f.bridge.finish(history)
})), 30_000)

posix("component: settled synthetic native failure is source-revalidated and consumed idempotently, without another Task", () => withPhaseFixture((f) => Effect.gen(function* () {
  const caller = yield* nativeCaller(f)
  const purpose = "Settled native component"
  const context = yield* Effect.promise(() => caller.call("sf_routine_catalog", { purpose }))
  const source = yield* f.bridge.issue(context, { operation: "catalog", purpose })
  const record = yield* f.bridge.withPlanning(source, (lease) => seedNativeAdmission(f, lease, purpose, true))
  expect(record.state).toBe("admitted")
  expect(record.taskStatus).toBe("error")
  const payload = { admittedRunRef: record.reference, expectedAdmissionVersion: record.version }
  const handler = f.composition.services.descriptors.find((descriptor) => descriptor.id === "sf_routine_run")!
  const before = f.trace.requests.length
  const first = yield* Effect.promise(async () => handler.handler(payload, await caller.call("sf_routine_run", payload)))
  const retry = yield* Effect.promise(async () => handler.handler(payload, await caller.call("sf_routine_run", payload)))
  expect(first.status).toBe("ok")
  expect(retry.status).toBe("ok")
  if (first.status === "ok" && retry.status === "ok") expect(retry.result).toEqual(first.result)
  expect(f.trace.requests.length).toBe(before)
})), 30_000)
