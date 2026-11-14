import { object } from "../../runtime/contract.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import { digestSfValue } from "../contracts/canonical.ts"

type AnswerState = { questionId: string; threadDigest: string; baseline?: { key: string; digest: string } }

/** Read-only version fence after authenticated answer/source reads. Stored
 * equality is never a grant: the producer fence must also remain current.
 */
export function createAnswerStateFence(host: Pick<DomainPortHost, "persistence">) {
  const persistence = host.persistence
  const transactionAll = persistence.transactionAll
  const currentSnapshots = persistence.currentSnapshots
  const current = () => host.persistence === persistence && persistence.transactionAll === transactionAll && persistence.currentSnapshots === currentSnapshots
  return async (expected: AnswerState, fence: () => Promise<boolean>): Promise<boolean> => {
    if (!transactionAll || !currentSnapshots || !current()) return false
    const selected = structuredClone(expected)
    const matches = () => {
      if (!current()) return false
      const snapshots = currentSnapshots.call(persistence)
      if (!snapshots) return false
      const threads = object(object(snapshots.dashboard.data.__sfProductV1).threads)
      return !!threads[selected.questionId] && digestSfValue(threads[selected.questionId]) === selected.threadDigest
        && (!selected.baseline || digestSfValue(threads[selected.baseline.key]) === selected.baseline.digest)
    }
    try {
      const accepted = await transactionAll.call(persistence, async () => ({ commit: false, value: matches() && await fence() && matches() }))
      return accepted === true && current()
    } catch { return false }
  }
}
