import type { Persistence, Snapshot, TransactionOptions } from "../../../runtime/contract.ts"
import type { Surface } from "../../../src/identity.ts"

/**
 * Test-only in-memory adapter for WP07 regression fixtures.
 * All single/cross-surface operations share one queue and commit isolated snapshots.
 * This is not durable installation storage or a C17/native integration proof.
 */
export function testPersistence(initial: Partial<Record<Surface, Snapshot>> = {}) {
  const state: Record<Surface, Snapshot> = {
    dashboard: empty(),
    planner: empty(),
    procurement: empty(),
    ...structuredClone(initial),
  }
  const queue = { tail: Promise.resolve() }
  const fail = { beforeCommit: false }
  const transactionAll = <T>(work: (snapshots: Record<Surface, Snapshot>) => Promise<{ commit: boolean; value: T }>, options?: TransactionOptions): Promise<T> => {
    const result = queue.tail.then(async () => {
      options?.signal?.throwIfAborted()
      const staged = structuredClone(state)
      const result = await work(staged)
      options?.signal?.throwIfAborted()
      if (!result.commit) return result.value
      if (fail.beforeCommit) throw new Error("Injected commit failure")
      // Complete cloning before publishing any surface; callback/returned references stay detached.
      const committed = structuredClone(staged)
      options?.signal?.throwIfAborted()
      Object.assign(state, committed)
      return result.value
    })
    queue.tail = result.then(() => undefined, () => undefined)
    return result
  }
  const persistence: Persistence & { transactionAll: typeof transactionAll } = {
    transaction: (surface, work, options) => transactionAll((snapshots) => work(snapshots[surface]), options),
    transactionAll,
  }
  return { persistence, state, fail }
}

export function empty(): Snapshot {
  return { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
}
