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
  const capture = () => persistence.transactionAll?.(async (snapshots) => ({ commit: false, value: digest(snapshots) }))
  return {
    prepare: async (authorize) => {
      if (!persistence.transactionAll || !persistence.currentSnapshots) return undefined
      if (!await authorize()) return undefined
      const before = await capture()
      if (!before || !await authorize()) return undefined
      const after = await capture()
      return before === after ? before : undefined
    },
    check: (expected) => {
      const current = persistence.currentSnapshots?.()
      return !!current && digest(current) === expected
    },
  }
}
