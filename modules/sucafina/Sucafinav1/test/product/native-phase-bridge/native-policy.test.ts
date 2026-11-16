import { expect, test } from "bun:test"
import { inArray } from "drizzle-orm"
import { Effect, Exit, Fiber } from "effect"
import { AgentV2 } from "@orchestra/core/agent"
import { EventV2 } from "@orchestra/core/event"
import { GovernanceDispatchV2 } from "../../../../../maestro/coordination/src/v2/governance/dispatch.ts"
import { WorkflowGateV2 } from "../../../../../maestro/coordination/src/v2/governance/workflow.ts"
import { createSfRoutineNativePhasePolicy } from "../../../../../../apps/cli/src/sucafina-product/routine-native-phase-policy.ts"
import { ids, withOwnerFixture } from "../routine-native-owner-binding/fixture.ts"

/** Canonical records and Permission service; approval/Task/arm rows are synthetic component facts, not consent. */
test("component: native deny revokes its independent witness while the fixture SF source is still authorized", () => withOwnerFixture((f) => Effect.gen(function* () {
  yield* f.resources.database.db.delete(EventV2.EventTable).where(inArray(EventV2.EventTable.id,
    [GovernanceDispatchV2.reservationID(ids.authorization), WorkflowGateV2.eventID(f.childID)])).run().pipe(Effect.orDie)
  const before = (yield* Effect.promise(() => f.resources.records.readAdmission(ids.authorization)))!
  const policy = createSfRoutineNativePhasePolicy(f.resources, before)
  expect(yield* Effect.promise(policy.current)).toBe(true)
  yield* f.resources.agents.transform((editor) => editor.update(AgentV2.defaultID, (agent) => {
    agent.permissions.push({ action: "task", resource: "backend", effect: "deny" })
  }))
  expect(f.state.authorized).toBe(true)
  expect(yield* Effect.promise(policy.current)).toBe(false)
  expect(policy.signal.aborted).toBe(true)
})))

test("component: an unobserved real native ask remains pending; observing policy never replies or grants it", () => withOwnerFixture((f) => Effect.gen(function* () {
  yield* f.resources.database.db.delete(EventV2.EventTable).where(inArray(EventV2.EventTable.id,
    [GovernanceDispatchV2.reservationID(ids.authorization), WorkflowGateV2.eventID(f.childID)])).run().pipe(Effect.orDie)
  const before = (yield* Effect.promise(() => f.resources.records.readAdmission(ids.authorization)))!
  const policy = createSfRoutineNativePhasePolicy(f.resources, before)
  expect(yield* Effect.promise(policy.current)).toBe(true)
  const asking = yield* Effect.forkDetach(f.resources.permission.authorize({ sessionID: ids.parent, agent: AgentV2.defaultID,
    action: "task", resources: ["backend"], source: { type: "tool", messageID: ids.task, callID: "unobserved-call" } }).pipe(Effect.exit))
  for (let attempt = 0; attempt < 100; attempt++) {
    if ((yield* f.resources.permission.forSession(ids.parent)).length) break
    yield* Effect.sleep("10 millis")
  }
  expect((yield* f.resources.permission.forSession(ids.parent)).length).toBe(1)
  expect(yield* Effect.promise(policy.current)).toBe(false)
  expect((yield* f.resources.permission.forSession(ids.parent)).length).toBe(1)
  yield* f.resources.permission.cancelSession(ids.parent)
  expect(Exit.isFailure(yield* Fiber.join(asking))).toBe(true)
})))
