import { AsyncLocalStorage } from "node:async_hooks"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"

type Root = { open: boolean; children: number; current: (call: TrustedDomainContext) => boolean }
type Prepared = { run: <Value>(work: () => Promise<PortResult<Value>>) => Promise<PortResult<Value>> }

/** Prepare sources before the witness, then own only the ancestral replay's physical read root. */
export function createSfPlannerCalculationRoot(input: { host: DomainPortHost }) {
  const roots = new AsyncLocalStorage<Root>()
  const unavailable = () => ({ status: "unavailable", reason: "calculation-read-root-unavailable" } as const)
  const prepare = async (call: TrustedDomainContext, initialize: () => Promise<boolean>,
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
      const currentSnapshot = persistence.currentSnapshot
      const requestFor = host.requestFor, revalidate = host.revalidate
      const authenticate = host.authenticate, environment = host.environment
      const request = requestFor.call(host, call), binding = call.binding, lease = call.lease
      if (!request || request.signal.aborted) return undefined
      const identity = digestSfValue([call.kind, binding]), headers = requestIdentity(request)
      const pinned = () => input.host === host && host.persistence === persistence &&
        persistence.readSnapshotRoot === root && persistence.currentSnapshots === snapshots &&
        persistence.transaction === transaction && persistence.transactionAll === transactionAll &&
        persistence.currentSnapshot === currentSnapshot && host.requestFor === requestFor &&
        host.revalidate === revalidate && host.authenticate === authenticate && host.environment === environment &&
        call.binding === binding && call.lease === lease && digestSfValue([call.kind, call.binding]) === identity &&
        !request.signal.aborted && requestFor.call(host, call) === request && requestIdentity(request) === headers && ownerCurrent()
      const current = () => pinned() && unchanged()
      const live = () => {
        const value = snapshots.call(persistence)
        return value !== undefined && value !== null && typeof value === "object"
      }
      if (!current()) return undefined
      const inherited = snapshots.call(persistence)
      if (inherited !== undefined) {
        // A pre-existing C08 owner (including Memory preflight/commit) keeps its
        // original route. Do not prepare sources, open a root or borrow ownership.
        if (!inherited || typeof inherited !== "object") return undefined
        // Snapshot metadata does not report a swallowed nested write. An actual
        // readonly driver operation checks poison at its exit. These extra
        // observations test health now; they do not accept the foreign root.
        const healthy = async () => {
          if (!current() || !live()) return false
          let callbacks = 0
          const accepted = await transaction.call(persistence, "planner", async () => {
            callbacks++
            return { commit: false, value: callbacks === 1 && current() && live() }
          }, { signal: request.signal })
          return accepted === true && callbacks === 1 && current() && live()
        }
        if (!await healthy()) return undefined
        return once(async (work) => {
          if (!await healthy()) return unavailable()
          const result = await work()
          return await healthy() ? result : unavailable()
        })
      }
      if (!await revalidate.call(host, call) || !current() || !await initialize() || !current() ||
        snapshots.call(persistence) !== undefined) return undefined
      // The caller opens its original full C08/source witness only after this
      // preparation returns. No prepared observation is accepted as evidence.
      return once(async <Value>(work: () => Promise<PortResult<Value>>): Promise<PortResult<Value>> => {
        if (!current() || snapshots.call(persistence) !== undefined) return unavailable()
        let invocations = 0, completed = false
        let staged: PortResult<Value> | undefined
        const accepted = await root.call(persistence, async () => {
          invocations++
          if (invocations !== 1 || !current() || !live()) return false
          const owner: Root = { open: true, children: 0, current: (candidate) =>
            candidate === call && owner.open && roots.getStore() === owner && pinned() && live() }
          try {
            return await roots.run(owner, async () => {
              if (!owner.current(call) || !current() || !await revalidate.call(host, call) || !owner.current(call) || !current()) return false
              const result = await work()
              if (!owner.current(call) || !current() || owner.children || !await revalidate.call(host, call) ||
                !owner.current(call) || !current() || owner.children) return false
              // The adapter receives only the Boolean. The product value remains
              // private until LocalStore accepts all reads and an unpoisoned root.
              staged = structuredClone(result)
              completed = true
              return true
            })
          } finally { owner.open = false }
        }, { signal: request.signal })
        if (accepted !== true || !completed || invocations !== 1 || !staged || !current() ||
          snapshots.call(persistence) !== undefined) return unavailable()
        return staged
      })
    } catch {
      // Poison, abort or adapter refusal never selects an alternative path.
      return undefined
    }
  }
  return {
    prepare,
    // The consumer consults this before routing, including when a closed
    // ancestral frame would otherwise look ineligible for the optimization.
    allows: (call: TrustedDomainContext) => {
      try { const owner = roots.getStore(); return !owner || owner.current(call) }
      catch { return false }
    },
  }
}

function requestIdentity(request: Request) {
  return digestSfValue({ method: request.method, url: request.url, headers: [...request.headers.entries()] })
}
