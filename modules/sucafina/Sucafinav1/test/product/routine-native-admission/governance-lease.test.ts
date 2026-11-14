import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Effect, Layer, Option } from "effect"
import { AgentV2 } from "@orchestra/core/agent"
import { Board } from "@orchestra/core/board/board"
import { Config } from "@orchestra/core/config"
import { Database } from "@orchestra/core/database/database"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventV2 } from "@orchestra/core/event"
import { FSUtil } from "@orchestra/core/fs-util"
import { Location } from "@orchestra/core/location"
import { Project } from "@orchestra/core/project"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionSchema } from "@orchestra/core/session/schema"
import { SessionStore } from "@orchestra/core/session/store"
import { SkillV2 } from "@orchestra/core/skill"
import { TaskGovernance } from "@orchestra/core/tool/task-governance"
import { MaestroEvent } from "@orchestra/schema/maestro-event"
import { GovernanceBackgroundV2 } from "../../../../../maestro/coordination/src/v2/governance/background.ts"
import { WorkflowGateV2 } from "../../../../../maestro/coordination/src/v2/governance/workflow.ts"
import { createSfRoutineNativeGovernance, type SfRoutineNativeGovernanceRecords } from "../../../../../../apps/cli/src/sucafina-product/routine-native-governance.ts"
import { SF_ROUTINE_INPUT_PARAMETER } from "../../../../../../apps/cli/src/sucafina-product/routine-native-input.ts"
import { createSfRoutineNativeRecords } from "../../../../../../apps/cli/src/sucafina-product/routine-native-records.ts"
import { fixturePlan, seedSession } from "./fixture.ts"

type Guard = ReturnType<typeof createSfRoutineNativeGovernance>

/** Native governance and SQLite are real; empty config/skills and absent process Sessions are explicit fixture boundaries. */
const layer = (directory: string, guard: Guard) => AppNodeBuilder.build(
  LayerNode.group([TaskGovernance.node, AgentV2.node, SessionStore.node, Database.node, FSUtil.node, EventV2.node, Board.node]),
  [
    ...(guard.contribution.replacements ?? []),
    [Database.node, Database.layerFromPath(":memory:")],
    [Location.node, Layer.succeed(Location.Service, Location.Service.of({
      directory: AbsolutePath.make(directory),
      project: { id: Project.ID.global, directory: AbsolutePath.make(directory) },
    }))],
    [Config.node, Layer.mock(Config.Service, { entries: () => Effect.succeed([]) })],
    [SkillV2.node, Layer.mock(SkillV2.Service, { list: () => Effect.succeed([]) })],
    [GovernanceBackgroundV2.sessionsNode, Layer.succeed(GovernanceBackgroundV2.Sessions, Option.none())],
  ],
)

const run = <A, E>(guard: Guard, body: (directory: string) => Effect.Effect<A, E, Layer.Success<ReturnType<typeof layer>>>) =>
  Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const directory = yield* Effect.acquireRelease(
      Effect.promise(async () => realpath(await mkdtemp(path.join(tmpdir(), "sf-routine-governance-")))),
      (directory) => Effect.promise(() => rm(directory, { recursive: true, force: true })),
    )
    return yield* body(directory).pipe(Effect.provide(layer(directory, guard)))
  })))

const parentID = SessionSchema.ID.make("ses_sf_lease_parent_fixture")
const childID = SessionSchema.ID.make("ses_sf_lease_child_fixture")

/** A retained WorkflowBound without a reservation still has to pass the SF lease guard. It is not an admission witness. */
const boundFixture = Effect.fn("SfRoutineFixture.bound")(function* (directory: string, malformed = false) {
  const events = yield* EventV2.Service
  const store = yield* SessionStore.Service
  yield* seedSession({ id: parentID, directory, agent: "maestro" })
  yield* seedSession({ id: childID, directory, agent: "backend", parentID })
  const retained = {
    schema: "sf-routine-native-input-v1", purpose: "Prepare selected review",
    owner: { installationId: "installation-fixture", hostId: "host-fixture", projectId: Project.ID.global,
      locationId: directory, authoritySessionId: parentID, principalRef: "principal-fixture",
      policyVersion: "policy-1", accessRevision: "access-1", providerGeneration: 2 },
    caseRef: { id: "case-fixture", incarnation: "case-incarnation-fixture", version: 1 },
    publishedRecipeRef: "sf-review-fixture", inputRefs: [], parameters: {}, sourceRefs: [],
  }
  const plan = fixturePlan(parentID, true, { [SF_ROUTINE_INPUT_PARAMETER]: malformed ? "{malformed" : JSON.stringify(retained) })
  if (!plan.workflowBinding) return yield* Effect.die("Fixture lacks workflow definition")
  yield* events.publish(MaestroEvent.PlanRevision.RecordedV3, plan, { id: EventV2.ID.make(plan.id) })
  yield* events.publish(MaestroEvent.Task.WorkflowBound, {
    executionSessionID: childID, authorityMessageID: SessionMessage.ID.make("msg_synthetic_authority"), authorityCallID: "call_synthetic_task",
    token: "synthetic-sf-lease-arm", binding: {
      definition: plan.workflowBinding, planRevisionID: plan.id, executionSessionID: childID,
      authoritySessionID: parentID, logicalTaskID: "synthetic-sf-logical-task",
    },
  }, { id: WorkflowGateV2.eventID(childID) })
  const child = yield* store.get(childID)
  if (!child) return yield* Effect.die("Fixture child is missing")
  return { plan, child }
})

for (const mode of ["missing", "revoked", "aborted", "cancel-during-check", "reader-replaced", "lease-replaced", "malformed-input"] as const) {
  test(`installed native Task governance refuses a workflow-bound SF turn when ${mode}`, async () => {
    let records: SfRoutineNativeGovernanceRecords | undefined
    const guard = createSfRoutineNativeGovernance({ records: () => records })
    await run(guard, (directory) => Effect.gen(function* () {
      const database = yield* Database.Service
      const store = yield* SessionStore.Service
      const service = yield* TaskGovernance.Service
      const seeded = yield* boundFixture(directory, mode === "malformed-input")
      records = createSfRoutineNativeRecords({ database, store, relayFor: async () => undefined })
      const controller = new AbortController()
      if (mode === "aborted") controller.abort()
      if (mode !== "missing") guard.bind(seeded.plan.id, {
        signal: controller.signal,
        current: async () => {
          if (mode === "cancel-during-check") controller.abort()
          if (mode === "reader-replaced") records = { readPlan: records!.readPlan }
          if (mode === "lease-replaced") guard.bind(seeded.plan.id, {
            signal: new AbortController().signal, current: async () => true,
          })
          return mode !== "revoked"
        },
      })
      const failure = yield* service.beforeTurn(seeded.child).pipe(Effect.flip)
      expect(String(failure)).toContain(mode === "malformed-input" ? "SF_ROUTINE_NATIVE_INPUT_INVALID"
        : mode === "missing" || mode === "aborted" ? "SF_ROUTINE_NATIVE_AUTHORITY_UNAVAILABLE"
        : "SF_ROUTINE_NATIVE_AUTHORITY_REVOKED")
      // The denied provider boundary made no native admission, dispatch, or settlement event.
      expect(yield* database.db.select().from(EventV2.EventTable).all().pipe(Effect.orDie)).toHaveLength(2)
      guard.dispose()
    }))
  })
}

test("governance availability uses the installed native service identity and expires with its Location scope", async () => {
  const guard = createSfRoutineNativeGovernance({ records: () => undefined })
  let installed: TaskGovernance.Interface | undefined
  await run(guard, (directory) => Effect.gen(function* () {
    const service = yield* TaskGovernance.Service
    installed = service
    expect(guard.installed(service)).toBe(true)
    expect(guard.installed({ ...service })).toBe(false)
    expect(guard.installation(service)).toEqual({ epoch: 1, projectId: Project.ID.global, directory })
  }))
  if (!installed) throw new Error("Native service did not install")
  expect(guard.installed(installed)).toBe(false)
  expect(guard.installation(installed)).toBeUndefined()
})
