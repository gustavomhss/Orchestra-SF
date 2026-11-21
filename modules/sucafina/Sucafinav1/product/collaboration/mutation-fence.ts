import { hasSfDashboardSourceFence } from "../../runtime/contract.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import type { Surface } from "../../src/identity.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost } from "../contracts/ports.ts"

export type CollaborationMutationFence = {
  prepare: (authorize: () => Promise<boolean>) => Promise<string | undefined>
  check: (expected: string) => boolean
}

/** Sources are checked before C08; the commit compares the same locked source snapshots. */
export function createCollaborationMutationFence(host: Pick<DomainPortHost, "persistence">): CollaborationMutationFence {
  const persistence = host.persistence as typeof host.persistence & {
    transactionAll?: <T>(work: (snapshots: Record<Surface, Snapshot>) => Promise<{ commit: boolean; value: T }>) => Promise<T>
    currentSnapshots?: () => Readonly<Record<Surface, Snapshot>> | undefined
  }
  const digest = (snapshots: Readonly<Record<Surface, Snapshot>>) => digestSfValue(Object.fromEntries((["dashboard", "planner", "procurement"] as const).map((surface) => {
    const snapshot = snapshots[surface]
    return [surface, { data: Object.fromEntries(Object.entries(snapshot.data).filter(([key]) => key !== "__sfProductV1")), versions: snapshot.versions, sequences: snapshot.sequences, sfSources: snapshot.sfSources }]
  })))
  const digests = new WeakMap<object, string>()
  return {
    prepare: async (authorize) => {
      const transactionAll = persistence.transactionAll
      const currentSnapshots = persistence.currentSnapshots
      if (!transactionAll || !currentSnapshots || !await authorize()) return undefined
      const atomic = hasSfDashboardSourceFence(persistence) ? persistence.dashboardSourceFence : undefined
      const read = atomic?.readSealed
      const current = () => host.persistence === persistence && persistence.transactionAll === transactionAll &&
        persistence.currentSnapshots === currentSnapshots && (!atomic || persistence.dashboardSourceFence === atomic &&
          hasSfDashboardSourceFence(persistence) && atomic.readSealed === read)
      const capture = () => {
        if (!current()) return undefined
        if (!atomic || !read) return persistence.transactionAll?.(async (snapshots) => ({ commit: false, value: digest(snapshots) }))
        return atomic.transaction("dashboard", async () => {
          const observed = current() ? read.call(atomic) : undefined
          if (!observed?.current()) return { commit: false, value: undefined }
          const identity = observed.bytesIdentity ?? observed.identity
          const stored = digests.get(identity)
          const snapshots = stored ? undefined : observed.read()
          const value = stored ?? (snapshots && digest(snapshots))
          if (!value || !observed.current() || !current()) return { commit: false, value: undefined }
          digests.set(identity, value)
          return { commit: false, value }
        }, { targetPreimageCurrent: atomic.holdTargetPreimage().current, sealedRead: true })
      }
      const before = await capture()
      if (!before || !current() || !await authorize()) return undefined
      const after = await capture()
      return current() && before === after ? before : undefined
    },
    check: (expected) => {
      const snapshots = persistence.currentSnapshots?.()
      return !!snapshots && digest(snapshots) === expected
    },
  }
}
