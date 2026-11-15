import { expect, test } from "bun:test"
import { AgentV2 } from "@orchestra/core/agent"
import { Location } from "@orchestra/core/location"
import { ModelV2 } from "@orchestra/core/model"
import { ProviderV2 } from "@orchestra/core/provider"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionSchema } from "@orchestra/core/session/schema"
import { Effect } from "effect"
import { reclaimSfPreparedSession } from "../../../../../../apps/cli/src/sucafina-product/native-host.ts"

/** Fault-injection against the production cleanup boundary, not an installed
 * Session/HTTP/provider run. Only 149/150 can establish integrated proof.
 */
const sessionID = SessionSchema.ID.make("ses_" + "1".repeat(64))
const model = ModelV2.Ref.make({ providerID: ProviderV2.ID.make("openai"), id: ModelV2.ID.make("gpt-5") })
const location = Location.Ref.make({ directory: AbsolutePath.make("/tmp/sf-native-preparation") })
const agent = AgentV2.ID.make("sf_finance")
const owned = { id: sessionID, agent, model, location }

function lifecycle(options: {
  createAttempted?: boolean
  identityMismatch?: boolean
  current?: typeof owned
  failRead?: boolean
  failRemove?: boolean
} = {}) {
  let reads = 0
  let removes = 0
  const get = () => {
    reads++
    return options.failRead ? Effect.fail(new Error("injected store failure")) : Effect.succeed(options.current ?? owned)
  }
  const remove = () => {
    removes++
    return options.failRemove ? Effect.fail(new Error("injected Session.remove failure")) : Effect.void
  }
  const cleanup = () => Effect.runPromise(reclaimSfPreparedSession({
    sessionID, agent, model, location,
    createAttempted: options.createAttempted ?? true,
    identityMismatch: options.identityMismatch ?? false,
    get, remove,
  }))
  return { cleanup, calls: () => ({ reads, removes }) }
}

test("C08 reserved session created before a failed skill or narrow is removed by the public Session API", async () => {
  const f = lifecycle()
  expect(await f.cleanup()).toBe("removed")
  expect(f.calls()).toEqual({ reads: 1, removes: 1 })
})

test("create failure after persistence is reconciled by checking the real Session identity", async () => {
  const f = lifecycle()
  expect(await f.cleanup()).toBe("removed")
  expect(f.calls().removes).toBe(1)
})

test("no Session.create attempt never deletes an unrelated Session", async () => {
  const f = lifecycle({ createAttempted: false })
  expect(await f.cleanup()).toBe("not-owned")
  expect(f.calls()).toEqual({ reads: 0, removes: 0 })
})

test("identity mismatch is a hard stop, not permission to delete an adopted Session", async () => {
  const f = lifecycle({ identityMismatch: true })
  expect(await f.cleanup()).toBe("not-owned")
  expect(f.calls()).toEqual({ reads: 0, removes: 0 })
})

test("foreign parent, model and location never match the native cleanup identity", async () => {
  const cases = [
    { ...owned, parentID: SessionSchema.ID.make("ses_" + "2".repeat(64)) },
    { ...owned, model: ModelV2.Ref.make({ providerID: ProviderV2.ID.make("openai"), id: ModelV2.ID.make("another") }) },
    { ...owned, location: Location.Ref.make({ directory: AbsolutePath.make("/tmp/other-project") }) },
    { ...owned, agent: AgentV2.ID.make("other-agent") },
  ]
  for (const current of cases) {
    let removed = 0
    const verdict = await Effect.runPromise(reclaimSfPreparedSession({
      sessionID, agent, model, location, createAttempted: true, identityMismatch: false,
      get: () => Effect.succeed(current),
      remove: () => Effect.sync(() => { removed++ }),
    }))
    expect(verdict).toBe("not-owned")
    expect(removed).toBe(0)
  }
})

test("cleanup errors cannot report removal or turn a durable deny marker into retry permission", async () => {
  const failedRead = lifecycle({ failRead: true })
  expect(await failedRead.cleanup()).toBe("cleanup-failed")
  expect(failedRead.calls()).toEqual({ reads: 1, removes: 0 })
  const failedRemove = lifecycle({ failRemove: true })
  expect(await failedRemove.cleanup()).toBe("cleanup-failed")
  expect(failedRemove.calls()).toEqual({ reads: 1, removes: 1 })
})
