import { types } from "node:util"
import type { Persistence } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"

const methods = ["readSnapshotRoot", "currentSnapshotScope", "transaction", "transactionAll", "currentSnapshots", "currentSnapshot", "hasCurrentSnapshots"] as const

/**
 * Group one audited read phase in the installed provider's original readonly
 * root. Canonical readers still execute every authorization, callback and fence.
 * This owns no authority or result cache; each top-level phase opens a fresh root.
 * Callers must keep arbitrary extensions and their awaits outside this scope.
 */
export async function runSfOperationalReadPhase<T>(
  persistence: Persistence,
  request: Request,
  work: () => Promise<T>,
): Promise<T> {
  request.signal.throwIfAborted()
  if (types.isProxy(persistence)) return work()
  const descriptors = methods.map((name) => Object.getOwnPropertyDescriptor(persistence, name))
  if (descriptors.some((entry, index) => entry ? !Object.hasOwn(entry, "value") : methods[index]! in persistence) ||
    !descriptors[0] || typeof descriptors[0].value !== "function" ||
    !descriptors[1] || typeof descriptors[1].value !== "function" ||
    !persistence.readSnapshotRoot || !persistence.currentSnapshotScope) return work()
  const readRoot = persistence.readSnapshotRoot
  const currentScope = persistence.currentSnapshotScope
  const prototype = Object.getPrototypeOf(persistence)
  const changed = () => new Error("SF_OPERATIONAL_READ_PHASE_CHANGED")
  const pinned = () => {
    request.signal.throwIfAborted()
    if (types.isProxy(persistence) || Object.getPrototypeOf(persistence) !== prototype ||
      persistence.readSnapshotRoot !== readRoot || persistence.currentSnapshotScope !== currentScope ||
      !methods.every((name, index) => {
        const current = Object.getOwnPropertyDescriptor(persistence, name), original = descriptors[index]
        return original ? !!current && Object.hasOwn(current, "value") && current.value === original.value : !current && !(name in persistence)
      })) throw changed()
  }
  pinned()
  // Existing scopes retain their original owner's lifetime and mutation rules.
  // Older providers and nested callers take this path before work is executed.
  const existing = currentScope.call(persistence)
  pinned()
  if (existing) return work()

  let calls = 0, open = false, active = true
  const outcome: { produced?: { value: T } } = {}
  try {
    const value = await readRoot.call(persistence, async () => {
      if (!active || ++calls !== 1) throw changed()
      pinned()
      const scope = currentScope.call(persistence)
      if (!scope || scope.readOnly !== true || scope.poisoned !== false || !scope.identity || typeof scope.identity !== "object") throw changed()
      const identity = scope.identity, bytesIdentity = scope.bytesIdentity
      const check = () => {
        pinned()
        const actual = currentScope.call(persistence)
        if (!active || !open || !actual || actual.readOnly !== true || actual.poisoned !== false || actual.identity !== identity ||
          actual.bytesIdentity !== bytesIdentity) throw changed()
      }
      open = true
      try {
        const result = await work()
        check()
        outcome.produced = { value: result }
        return result
      } finally { open = false }
    }, { signal: request.signal })
    pinned()
    const produced = outcome.produced
    if (calls !== 1 || !active || !produced || open || currentScope.call(persistence) || !Object.is(value, produced.value)) throw changed()
    return produced.value
  } finally { active = false }
}
