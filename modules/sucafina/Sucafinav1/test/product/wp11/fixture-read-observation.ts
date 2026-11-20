import { AsyncLocalStorage } from "node:async_hooks"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../../../product/contracts/ports.ts"
import type { SfProductStatePort } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { PlannerReadObservation } from "../../../product/planner/sensitivity-observation.ts"
import { sfRunSourceFence } from "../../../product/ai/run-store.ts"
import { roleMap } from "../../../runtime/admin.ts"

type Owner = {
  call: TrustedDomainContext
  current: () => boolean
  pins: Set<() => boolean>
  open: boolean
  accepting: boolean
  invalid: boolean
  children: number
}

/** Test composition for the explicit WP05/WP11 synthetic source boundary.
 * LocalStore owns the physical read; every original producer still executes.
 * No authorization, financial result or scoped-source metadata is manufactured,
 * and no observation survives an invocation or includes a durable publication. */
export function createFixtureReadObservation(input: {
  host: DomainPortHost
  state: SfProductStatePort
  identities: () => readonly unknown[]
  witness: () => unknown
}): PlannerReadObservation {
  const local = new AsyncLocalStorage<Owner>()
  const unavailable = <Value>(): PortResult<Value> => ({ status: "unavailable", reason: "fixture-read-observation-changed" })
  const live = (owner: Owner) => owner.open && !owner.invalid && local.getStore() === owner &&
    owner.current() && [...owner.pins].every((pin) => pin())
  const observe: PlannerReadObservation = async (incoming, call, work) => {
    const parent = local.getStore()
    if (parent) {
      if (parent.call !== call || !parent.accepting || !live(parent)) {
        parent.invalid = true
        return unavailable()
      }
      const digest = digestSfValue(incoming)
      parent.pins.add(() => digestSfValue(incoming) === digest)
      parent.children++
      try {
        // The enclosing owner keeps this argument pinned until its fresh egress.
        // Nested reads execute in full, without an answer/proof memo.
        const value = await work()
        if (!live(parent)) { parent.invalid = true; return unavailable() }
        return structuredClone(value)
      } catch {
        parent.invalid = true
        return unavailable()
      } finally { parent.children-- }
    }
    const host = input.host, persistence = host.persistence
    const root = persistence.readSnapshotRoot, snapshots = persistence.currentSnapshots
    // A production verifier may already own this read. Delegate its original
    // callbacks; snapshot presence grants this helper no authority to nest.
    if (call.kind !== "ui" || !root || !snapshots || snapshots()) return work()
    const request = host.requestFor(call)
    if (!request || request.signal.aborted) return work()
    const requestFor = host.requestFor, revalidate = host.revalidate, authenticate = host.authenticate, environmentFor = host.environment
    const transaction = persistence.transaction, transactionAll = persistence.transactionAll, state = input.state, stateRead = state.read
    const identities = input.identities, readers = [...identities()], witness = input.witness
    const external = digestSfValue(witness()), digest = digestSfValue(incoming)
    const binding = call.binding, bindingDigest = digestSfValue([call.kind, binding]), lease = call.lease
    const requestDigest = requestIdentity(request)
    const current = () => call.kind === "ui" && call.binding === binding && call.lease === lease &&
      digestSfValue([call.kind, call.binding]) === bindingDigest && digestSfValue(incoming) === digest &&
      requestFor(call) === request && !request.signal.aborted && requestIdentity(request) === requestDigest &&
      input.host === host && host.persistence === persistence && host.requestFor === requestFor &&
      host.revalidate === revalidate && host.authenticate === authenticate && host.environment === environmentFor &&
      persistence.readSnapshotRoot === root && persistence.currentSnapshots === snapshots && persistence.transaction === transaction && persistence.transactionAll === transactionAll &&
      input.state === state && state.read === stateRead && input.identities === identities && sameIdentities(identities(), readers) &&
      input.witness === witness && digestSfValue(witness()) === external
    const owner: Owner = { call, current, pins: new Set(), open: true, accepting: false, invalid: false, children: 0 }
    const environment = async () => {
      const value = await environmentFor(request)
      const at = Date.parse(value.at)
      return Number.isFinite(at) ? { day: new Date(at).toISOString().slice(0, 10), directory: structuredClone(value.directory),
        bankKey: value.bankKey ? Array.from(value.bankKey) : undefined } : undefined
    }
    const snapshot = async (): Promise<string | undefined> => {
      if (!live(owner) || !await revalidate(call) || !live(owner)) return undefined
      const observed = await stateRead(request, "cases", async (value, authority) => {
        if (!live(owner) || authority.principalRef !== binding.principalRef || authority.accessRevision !== binding.accessRevision ||
          authority.policyVersion !== binding.policyVersion) return undefined
        const locked = snapshots()
        if (!locked?.dashboard || !locked.planner || !locked.procurement) return undefined
        const protectedDigest = digestSfValue(locked)
        const before = await environment()
        const principal = structuredClone(await authenticate(request, { surface: "planner", roleMap: roleMap(locked.planner, "planner") }))
        if (!before || !principal || principal.id !== authority.principalRef || principal.id.startsWith("local:") || !live(owner)) return undefined
        const after = await environment()
        const again = await authenticate(request, { surface: "planner", roleMap: roleMap(locked.planner, "planner") })
        if (!after || digestSfValue(before) !== digestSfValue(after) || digestSfValue(principal) !== digestSfValue(again) ||
          !await revalidate(call) || !live(owner) || digestSfValue(snapshots()) !== protectedDigest) return undefined
        return { state: value, authority, snapshots: locked, principal, environment: after,
          sourceFences: { dashboard: sfRunSourceFence(locked.dashboard), planner: sfRunSourceFence(locked.planner), procurement: sfRunSourceFence(locked.procurement) },
          external, input: digest, request: requestDigest, binding: bindingDigest }
      })
      // Include the real C08 envelope (incarnation and both revisions), not just
      // its selected value. The provider performs its own final authority read.
      return live(owner) && observed.status === "ok" && observed.value ? digestSfValue(observed) : undefined
    }
    try {
      return await local.run(owner, async () => {
        const observed = await root(async () => {
          const before = await snapshot()
          if (!before || !live(owner)) return undefined
          owner.accepting = true
          const value = await work()
          owner.accepting = false
          if (owner.children || !live(owner)) return undefined
          const after = await snapshot()
          return after === before && live(owner) ? { value: structuredClone(value), witness: after } : undefined
        }, { signal: request.signal })
        if (!observed || owner.children || !live(owner) || snapshots()) return unavailable()
        // This C08 read opens a new physical transaction AFTER LocalStore closes
        // the first snapshot. External fixture authority is checked after every
        // await too, including revocations performed by the final authorization.
        const fresh = await snapshot()
        return fresh === observed.witness && live(owner) ? observed.value : unavailable()
      })
    } catch {
      // A caught write still poisons the real readonly owner. Never retry work.
      owner.invalid = true
      return unavailable()
    } finally {
      owner.accepting = false
      owner.open = false
      owner.pins.clear()
    }
  }
  return observe
}

function requestIdentity(request: Request) { return digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] }) }
function sameIdentities(left: readonly unknown[], right: readonly unknown[]) { return left.length === right.length && left.every((value, index) => value === right[index]) }

/** Preserve method names as well as object/function identity across awaits. */
export function fixtureReaderIdentities(...readers: readonly object[]): readonly unknown[] {
  return readers.flatMap((reader) => [reader, ...Object.entries(reader).flatMap(([key, value]) => [key, value])])
}
