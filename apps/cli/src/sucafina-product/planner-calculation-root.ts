import { AsyncLocalStorage } from "node:async_hooks"
import { sfRecallCost, sfRecallAsyncCost } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/recall-observation-cost.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import { currentSfPlannerReadonlySnapshotScope, currentSfReadonlySnapshotScope, hasSfLocalSnapshotScope } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { plannerRequestIdentity } from "./planner-calculation-read-scope.ts"

/** An opaque capability born only inside this factory's active native readonly frame. */
export type SfPlannerCalculationRootProof = Readonly<object>
type Proof = Readonly<{ host: DomainPortHost; call: TrustedDomainContext; identity: object; bytesIdentity: object; current: () => boolean }>
const rootProofs = new WeakMap<SfPlannerCalculationRootProof, Proof>()

export function readSfPlannerCalculationRootProof(proof: SfPlannerCalculationRootProof, host: DomainPortHost, call: TrustedDomainContext) {
  const found = proof && typeof proof === "object" ? rootProofs.get(proof) : undefined
  return found?.host === host && found.call === call ? found : undefined
}

type Root = { open: boolean; children: number; current: (call: TrustedDomainContext) => boolean; proof?: SfPlannerCalculationRootProof }
type Prepared = { run: <Value>(work: () => Promise<PortResult<Value>>) => Promise<PortResult<Value>> }

/** Prepare sources before the witness, then own only the local replay's physical read root. */
export function createSfPlannerCalculationRoot(input: { host: DomainPortHost }) {
  const roots = new AsyncLocalStorage<Root>()
  const unavailable = () => ({ status: "unavailable", reason: "calculation-read-root-unavailable" } as const)
  const prepare = async (call: TrustedDomainContext, initialize: () => Promise<boolean | "unsupported">,
    unchanged: () => boolean, ownerCurrent: () => boolean = unchanged): Promise<Prepared | undefined> => {
    try {
      let used = false
      const once = (run: Prepared["run"]): Prepared => ({ run: async <Value>(work: () => Promise<PortResult<Value>>) => {
        if (used) return unavailable()
        used = true
        try { return await run(work) } catch { return unavailable() }
      } })
      const parent = roots.getStore()
      if (parent) {
        if (!parent.current(call) || !unchanged()) return undefined
        return once(async (work) => {
          // The root is already prepared. This descendant executes its complete
          // producer and cannot survive or publish beyond the owner's callback.
          if (!parent.current(call) || !unchanged()) return unavailable()
          parent.children++
          try {
            const result = await work()
            return parent.current(call) && unchanged() ? result : unavailable()
          } finally { parent.children-- }
        })
      }
      const host = input.host, persistence = host.persistence
      const root = persistence.readSnapshotRoot, snapshots = persistence.currentSnapshots
      // Older adapters keep the complete original producer, without preparation
      // or a claim that an owned root protected its observation.
      if (!root || !snapshots) return once((work) => work())
      const transaction = persistence.transaction, transactionAll = persistence.transactionAll
      const snapshotScope = persistence.currentSnapshotScope
      const requestFor = host.requestFor, revalidate = host.revalidate
      const authenticate = host.authenticate, environment = host.environment
      const request = requestFor.call(host, call), binding = call.binding, lease = call.lease
      if (!request || request.signal.aborted) return undefined
      const identity = sfRecallCost("root-binding-digest", () => digestSfValue([call.kind, binding])), headers = sfRecallCost("root-request-identity", () => plannerRequestIdentity(request))
      const pinned = () => input.host === host && host.persistence === persistence &&
        persistence.readSnapshotRoot === root && persistence.currentSnapshots === snapshots &&
        persistence.transaction === transaction && persistence.transactionAll === transactionAll &&
        persistence.currentSnapshotScope === snapshotScope && host.requestFor === requestFor &&
        host.revalidate === revalidate && host.authenticate === authenticate && host.environment === environment &&
        call.binding === binding && call.lease === lease && sfRecallCost("root-binding-digest", () => digestSfValue([call.kind, call.binding])) === identity &&
        !request.signal.aborted && requestFor.call(host, call) === request && sfRecallCost("root-request-identity", () => plannerRequestIdentity(request)) === headers && sfRecallCost("root-owner-current", () => ownerCurrent())
      const current = () => sfRecallCost("root-pinned", () => pinned()) && unchanged()
      const live = () => {
        const local = hasSfLocalSnapshotScope(persistence)
        if (local !== undefined) return local
        const value = snapshots.call(persistence)
        return value !== undefined && value !== null && typeof value === "object"
      }
      if (!sfRecallCost("root-current", () => current())) return undefined
      const local = hasSfLocalSnapshotScope(persistence)
      const inherited = local === undefined ? snapshots.call(persistence) : undefined
      const present = () => hasSfLocalSnapshotScope(persistence) ?? snapshots.call(persistence) !== undefined
      if (local === true || inherited !== undefined) {
        // A pre-existing C08 owner (including Memory preflight/commit) keeps its
        // original route. Do not prepare sources, open a root or borrow ownership.
        if (local !== true && (!inherited || typeof inherited !== "object")) return undefined
        // Snapshot metadata does not report a swallowed nested write. An actual
        // readonly driver operation checks poison at its exit. These extra
        // observations test health now; they do not accept the foreign root.
        const healthy = async () => {
          if (!sfRecallCost("root-current", () => current()) || !live()) return false
          let callbacks = 0
          const accepted = await transaction.call(persistence, "planner", async () => {
            callbacks++
            return { commit: false, value: callbacks === 1 && sfRecallCost("root-current", () => current()) && live() }
          }, { signal: request.signal })
          return accepted === true && callbacks === 1 && sfRecallCost("root-current", () => current()) && live()
        }
        if (!await sfRecallAsyncCost("root-healthy", healthy)) return undefined
        return once(async (work) => {
          if (!await sfRecallAsyncCost("root-healthy", healthy)) return unavailable()
          const result = await work()
          return await sfRecallAsyncCost("root-healthy", healthy) ? result : unavailable()
        })
      }
      if (!await revalidate.call(host, call) || !sfRecallCost("root-current", () => current())) return undefined
      const initialized = await initialize()
      if (initialized !== true && initialized !== "unsupported") return undefined
      if (!sfRecallCost("root-current", () => current()) || present()) return undefined
      if (initialized === "unsupported") {
        // Eligibility was inspected without opening a root or warming sources.
        // Preserve the full producer only while these exact observations live.
        return once(async (work) => {
          if (!sfRecallCost("root-current", () => current()) || present() || !await revalidate.call(host, call) || !sfRecallCost("root-current", () => current()) || present()) return unavailable()
          const result = await work()
          return sfRecallCost("root-current", () => current()) && !present() && await revalidate.call(host, call) && sfRecallCost("root-current", () => current()) && !present() ? result : unavailable()
        })
      }
      // The caller opens its original full C08/source witness only after this
      // preparation returns. No prepared observation is accepted as evidence.
      return once(async <Value>(work: () => Promise<PortResult<Value>>): Promise<PortResult<Value>> => {
        if (!sfRecallCost("root-current", () => current()) || present()) return unavailable()
        let invocations = 0, completed = false
        let staged: PortResult<Value> | undefined
        const accepted = await root.call(persistence, async () => {
          invocations++
          if (invocations !== 1 || !sfRecallCost("root-current", () => current())) return false
          const native = sfRecallCost("root-native-lookup", () => currentSfPlannerReadonlySnapshotScope(persistence))
          // A C08 descendant has its own logical scope within this same physical
          // root. Use that scope's original strict current, never a parent-scope
          // closure in the child, and require both original physical identities.
          const healthy = native?.bytesIdentity ? () => {
            const active = sfRecallCost("root-native-lookup", () => currentSfPlannerReadonlySnapshotScope(persistence))
            return !!active && active.identity === native.identity && active.bytesIdentity === native.bytesIdentity && sfRecallCost("root-native-current", () => active.current())
          } : currentSfReadonlySnapshotScope(persistence)?.current ?? live
          if (!sfRecallCost("root-healthy", () => healthy())) return false
          const owner: Root = { open: true, children: 0, current: (candidate) =>
            candidate === call && owner.open && roots.getStore() === owner && sfRecallCost("root-pinned", () => pinned()) && sfRecallCost("root-healthy", () => healthy()) }
          if (native?.bytesIdentity) {
            const proof = Object.freeze({})
            let failed = false
            owner.proof = proof
            rootProofs.set(proof, Object.freeze({ host, call, identity: native.identity, bytesIdentity: native.bytesIdentity, current: () => {
              if (failed) return false
              try {
                const valid = owner.current(call)
                if (!valid) failed = true
                return valid
              } catch (error) { failed = true; throw error }
            } }))
          }
          try {
            return await roots.run(owner, async () => {
              if (!owner.current(call) || !sfRecallCost("root-current", () => current()) || !await revalidate.call(host, call) || !owner.current(call) || !sfRecallCost("root-current", () => current())) return false
              const result = await work()
              if (!owner.current(call) || !sfRecallCost("root-current", () => current()) || owner.children || !await revalidate.call(host, call) ||
                !owner.current(call) || !sfRecallCost("root-current", () => current()) || owner.children) return false
              // The adapter receives only the Boolean. The product value remains
              // private until LocalStore accepts all reads and an unpoisoned root.
              staged = structuredClone(result)
              completed = true
              return true
            })
          } finally { owner.open = false; if (owner.proof) rootProofs.delete(owner.proof) }
        }, { signal: request.signal })
        if (accepted !== true || !completed || invocations !== 1 || !staged || !sfRecallCost("root-current", () => current()) ||
          present()) return unavailable()
        return staged
      })
    } catch {
      // Poison, abort or adapter refusal never selects an alternative path.
      return undefined
    }
  }
  return {
    prepare,
    // An emitted token stays distinguishable from unsupported ownership even
    // after drift/close. Its consumer must revalidate it and refuse without replay.
    proof: (_call: TrustedDomainContext): SfPlannerCalculationRootProof | undefined => roots.getStore()?.proof,
    // The consumer consults this before routing, including when a closed
    // ancestral frame would otherwise look ineligible for the optimization.
    allows: (call: TrustedDomainContext) => {
      try { const owner = roots.getStore(); return !owner || owner.current(call) }
      catch { return false }
    },
  }
}
