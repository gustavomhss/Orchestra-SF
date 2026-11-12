import type { Persistence, Snapshot } from "../../runtime/contract.ts"
import type { Surface } from "../../src/identity.ts"

/** Test implementation only. Production must supply durable isolated transactions. */
export function testPersistence(initial: Partial<Record<Surface, Snapshot>> = {}) {
  const state: Record<Surface, Snapshot> = {
    dashboard: empty(),
    planner: empty(),
    procurement: empty(),
    ...structuredClone(initial),
  }
  const tails: Partial<Record<Surface, Promise<void>>> = {}
  const fail = { beforeCommit: false }
  const persistence: Persistence = {
    transaction(surface, work) {
      const result = (tails[surface] ?? Promise.resolve()).then(async () => {
        const snapshot = structuredClone(state[surface])
        const result = await work(snapshot)
        if (fail.beforeCommit) throw new Error("Injected commit failure")
        if (result.commit) state[surface] = snapshot
        return result.value
      })
      tails[surface] = result.then(
        () => undefined,
        () => undefined,
      )
      return result
    },
  }
  return { persistence, state, fail }
}
export function empty(): Snapshot {
  return { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
}
