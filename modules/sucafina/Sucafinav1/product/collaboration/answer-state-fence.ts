import { hasSfDashboardSourceFence, object } from "../../runtime/contract.ts"
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
  return async (expected: AnswerState, fence: () => Promise<boolean>, signal?: AbortSignal): Promise<boolean> => {
    if (!transactionAll || !currentSnapshots || !current()) return false
    const selected = structuredClone(expected)
    const atomic = hasSfDashboardSourceFence(persistence) ? persistence.dashboardSourceFence : undefined
    const single = atomic?.currentSnapshot
    const rootCurrent = () => !signal?.aborted && current() && (!atomic || hasSfDashboardSourceFence(persistence) && persistence.dashboardSourceFence === atomic && atomic.currentSnapshot === single)
    const matches = () => {
      if (!rootCurrent()) return false
      const dashboard = atomic && single ? single.call(persistence, "dashboard") : currentSnapshots.call(persistence)?.dashboard
      if (!dashboard) return false
      const threads = object(object(dashboard.data.__sfProductV1).threads)
      return !!threads[selected.questionId] && digestSfValue(threads[selected.questionId]) === selected.threadDigest
        && (!selected.baseline || digestSfValue(threads[selected.baseline.key]) === selected.baseline.digest)
    }
    try {
      const verify = async () => ({ commit: false, value: matches() && await fence() && matches() })
      const accepted = atomic
        ? await atomic.transaction("dashboard", verify, { signal, targetPreimageCurrent: atomic.holdTargetPreimage().current, sealedRead: true })
        : await transactionAll.call(persistence, verify, { signal })
      return accepted === true && rootCurrent()
    } catch { return false }
  }
}
