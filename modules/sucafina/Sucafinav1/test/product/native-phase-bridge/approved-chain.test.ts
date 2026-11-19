import { expect, test } from "bun:test"
import { eq, inArray } from "drizzle-orm"
import { Effect, Schema } from "effect"
import { EventV2 } from "@orchestra/core/event"
import { MaestroEvent } from "@orchestra/schema/maestro-event"
import { GovernanceDispatchV2 } from "../../../../../maestro/coordination/src/v2/governance/dispatch.ts"
import { GovernanceRecordsV2 } from "../../../../../maestro/coordination/src/v2/governance/records.ts"
import { WorkflowGateV2 } from "../../../../../maestro/coordination/src/v2/governance/workflow.ts"
import { captureSfRoutineApprovedChain } from "../../../../../../apps/cli/src/sucafina-product/routine-native-phase-chain.ts"
import { ids, withOwnerFixture } from "../routine-native-owner-binding/fixture.ts"

/** Canonical SQLite/native record projection, with explicitly synthetic native approvals/Task/arm fixture rows.
 * This proves only the bridge's immutable-chain/monotonic observation boundary, not execution or human consent.
 */
test("component: approved preparing can advance only through its actual native reservation and binding", () =>
  withOwnerFixture((f) => Effect.gen(function* () {
    const db = f.resources.database.db
    const reservedID = GovernanceDispatchV2.reservationID(ids.authorization)
    const boundID = WorkflowGateV2.eventID(f.childID)
    const reserved = yield* GovernanceRecordsV2.row(db, reservedID)
    const bound = yield* GovernanceRecordsV2.row(db, boundID)
    if (!reserved || !bound) return yield* Effect.die("Synthetic native reservation fixture missing")
    yield* db.delete(EventV2.EventTable).where(inArray(EventV2.EventTable.id, [reservedID, boundID])).run().pipe(Effect.orDie)
    const preparing = yield* Effect.promise(() => f.resources.records.readAdmission(ids.authorization))
    expect(preparing?.state).toBe("preparing")
    if (!preparing) return yield* Effect.die("Canonical approved preparing projection missing")
    const chain = captureSfRoutineApprovedChain(preparing)
    expect(chain).toBeDefined()
    expect(chain?.accept(preparing)).toBe(true)
    expect(captureSfRoutineApprovedChain({ ...preparing, approval: undefined })).toBeUndefined()
    expect(chain?.accept({ ...preparing, version: preparing.version + 1 })).toBe(false)
    expect(chain?.accept({ ...preparing, authorizationID: "another-authorization" })).toBe(false)
    expect(chain?.accept({ ...preparing, review: undefined })).toBe(false)
    yield* f.resources.events.publish(MaestroEvent.Dispatch.ReservedV2,
      Schema.decodeUnknownSync(MaestroEvent.Dispatch.ReservedV2.data)(reserved.data), { id: reservedID })
    const reserving = yield* Effect.promise(() => f.resources.records.readAdmission(ids.authorization))
    expect(reserving?.reservation).toBeDefined()
    expect(reserving?.state).toBe("preparing")
    if (!reserving) return yield* Effect.die("Canonical intermediate reservation missing")
    expect(chain?.accept(reserving)).toBe(true)
    expect(chain?.accept(preparing)).toBe(false)
    yield* f.resources.events.publish(MaestroEvent.Task.WorkflowBound,
      Schema.decodeUnknownSync(MaestroEvent.Task.WorkflowBound.data)(bound.data), { id: boundID })
    const admitted = yield* Effect.promise(() => f.resources.records.readAdmission(ids.authorization))
    expect(admitted?.state).toBe("admitted")
    if (!admitted) return yield* Effect.die("Canonical admitted projection missing")
    expect(chain?.accept(admitted)).toBe(true)
    expect(chain?.accept(reserving)).toBe(false)
    expect(captureSfRoutineApprovedChain(admitted)).toBeUndefined()
    expect(chain?.accept({ ...admitted, bound: { ...admitted.bound!, authorityCallID: "different-core-call" } })).toBe(false)
    // Real reader re-observation, not a second caller-provided version, also remains accepted.
    expect(chain?.accept((yield* Effect.promise(() => f.resources.records.readAdmission(ids.authorization)))!)).toBe(true)
    yield* db.delete(EventV2.EventTable).where(eq(EventV2.EventTable.id, boundID)).run().pipe(Effect.orDie)
    const regressed = yield* Effect.promise(() => f.resources.records.readAdmission(ids.authorization))
    expect(regressed?.state).toBe("preparing")
    expect(chain?.accept(regressed!)).toBe(false)
  })))
