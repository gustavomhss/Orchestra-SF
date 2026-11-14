import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Effect, Layer, Schema } from "effect"
import { Database } from "@orchestra/core/database/database"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventV2 } from "@orchestra/core/event"
import { Project } from "@orchestra/core/project"
import { ProjectTable } from "@orchestra/core/project/sql"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionSchema } from "@orchestra/core/session/schema"
import { SessionStore } from "@orchestra/core/session/store"
import { SessionTable } from "@orchestra/core/session/sql"
import { MaestroEvent } from "@orchestra/schema/maestro-event"
import { GovernanceRecordsV2 } from "../../../../../maestro/coordination/src/v2/governance/records.ts"
import type { NativePlan } from "../../../../../../apps/cli/src/sucafina-product/routine-native-records.ts"

/** Real SQLite, durable EventV2 and SessionStore; synthetic rows are not an installed-host AM06 witness. */
const layer = () => AppNodeBuilder.build(
  LayerNode.group([Database.node, EventV2.node, SessionStore.node]),
  [[Database.node, Database.layerFromPath(":memory:")]],
)

export const withNativeRecords = <A, E>(
  body: (directory: string) => Effect.Effect<A, E, Layer.Success<ReturnType<typeof layer>>>,
) => Effect.runPromise(Effect.scoped(Effect.gen(function* () {
  const directory = yield* Effect.acquireRelease(
    Effect.promise(async () => realpath(await mkdtemp(path.join(tmpdir(), "sf-routine-records-")))),
    (directory) => Effect.promise(() => rm(directory, { recursive: true, force: true })),
  )
  return yield* body(directory).pipe(Effect.provide(layer()))
})))

export const seedSession = Effect.fn("SfRoutineFixture.seedSession")(function* (input: {
  id: SessionSchema.ID
  directory: string
  agent: string
  parentID?: SessionSchema.ID
}) {
  const database = yield* Database.Service
  yield* database.db.insert(ProjectTable)
    .values({ id: Project.ID.global, worktree: AbsolutePath.make(input.directory), sandboxes: [] })
    .onConflictDoNothing().run().pipe(Effect.orDie)
  yield* database.db.insert(SessionTable).values({
    id: input.id, project_id: Project.ID.global, parent_id: input.parentID,
    slug: input.id, directory: input.directory, title: "Synthetic native routine reader fixture",
    version: "test", agent: input.agent,
  }).run().pipe(Effect.orDie)
  return input.id
})

/** The engine's own closed schema and stable hash build every synthetic retained plan. */
export function fixturePlan(sessionID: string, workflow?: true, parameters?: Record<string, string>): NativePlan
export function fixturePlan(sessionID: string, workflow: false, parameters?: Record<string, string>): Schema.Schema.Type<typeof MaestroEvent.PlanRevision.RecordedV3.data> & { id: EventV2.ID }
export function fixturePlan(sessionID: string, workflow = true, parameters: Record<string, string> = { selectedCase: "case-fixture" }) {
  const body = {
    sessionID, admissionMessageID: "msg_sf_owner", methodVersion: "plan-v1", revision: "v3" as const,
    goal: { value: "Prepare the selected review", source: "stakeholder" as const },
    acceptance: [{ value: "Return factual sources to the originating case", source: "stakeholder" as const }],
    scope: [{ value: "The selected case only", source: "stakeholder" as const }],
    constraints: [], reviewRequirement: { value: "Human review required", source: "stakeholder" as const },
    contextRequirement: "PENDING" as const, assumptions: [], risks: [], status: "PROPOSED" as const,
    ...(workflow ? { workflowBinding: {
      publication: { projectID: Project.ID.global, documentID: "sf-review-fixture", activeVersionID: "published-fixture-v1",
        immutableVersionBodyChecksum: "1".repeat(64), livePublicationChecksum: "2".repeat(64) },
      materialization: { schemaIdentifier: "RelaySprint.Sprint" as const, digest: "3".repeat(64), byteLength: 27 },
      resolvedSkills: [], parameters, writePaths: ["review-output"],
    } } : {}),
  }
  const revisionHash = GovernanceRecordsV2.hash(body)
  const decoded = Schema.decodeUnknownSync(MaestroEvent.PlanRevision.RecordedV3.data)({
    ...body, id: `evt_maestro_plan_revision_${revisionHash}`, revisionHash, createdAt: 1_700_000_000_000,
  })
  const id = EventV2.ID.make(decoded.id)
  if (!workflow) return { ...decoded, id }
  if (!decoded.workflowBinding) throw new Error("Native fixture workflow definition is missing")
  return { ...decoded, id, workflowBinding: decoded.workflowBinding }
}
