import type { Persistence, Snapshot } from "../../runtime/contract.ts"
import { object } from "../../runtime/contract.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority, SfStateNamespace, SfStateResult } from "../contracts/state.ts"

const namespaces = ["preferences", "reviews", "relations", "threads", "confirmations", "cases", "contributions", "documents", "receipts", "atlas", "outbox", "transactions"] as const

/** The caller composes current product authority; a Dashboard role never grants it implicitly. */
export function createSfProductState(input: {
  persistence: Persistence
  authorize: (request: Request, snapshot: Snapshot, namespace: SfStateNamespace, mode: "read" | "write") => Promise<SfStateAuthority | undefined>
  createId: () => string
}): SfProductStatePort {
  return {
    read: <T>(request: Request, namespace: SfStateNamespace, read: (state: Readonly<SfProductState>, authority: SfStateAuthority) => T | Promise<T>) =>
      input.persistence.transaction<SfStateResult<T>>("dashboard", async (snapshot) => {
        const authority = await input.authorize(request, snapshot, namespace, "read")
        if (!authority) return { commit: false, value: { status: "denied", reason: "product-access-unavailable" } }
        const state = readSfState(snapshot)
        if (!state) return { commit: false, value: { status: "unavailable", reason: "product-state-uninitialized-or-invalid" } }
        const value = await read(structuredClone(state), authority)
        if (request.signal.aborted) return { commit: false, value: { status: "unavailable", reason: "cancelled" } }
        const current = await input.authorize(request, snapshot, namespace, "read")
        if (!sameAuthority(authority, current)) return { commit: false, value: { status: "denied", reason: "product-authority-changed" } }
        return { commit: false, value: { status: "ok", revision: state.revision, incarnation: state.incarnation, value } }
      }, { signal: request.signal }),
    transaction: <T>(request: Request, command: { namespace: SfStateNamespace; expectedVersion: number; idempotencyKey: string; commandDigest: string }, work: (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => Promise<{ commit: boolean; value: T }>) =>
      input.persistence.transaction<SfStateResult<T>>("dashboard", async (snapshot) => {
        const authority = await input.authorize(request, snapshot, command.namespace, "write")
        if (!authority) return { commit: false, value: { status: "denied", reason: "product-access-unavailable" } }
        if (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion < 0)
          return { commit: false, value: { status: "conflict", reason: "invalid-expected-version" } }
        if (!command.idempotencyKey.trim() || !/^[a-f0-9]{64}$/.test(command.commandDigest))
          return { commit: false, value: { status: "conflict", reason: "invalid-command-identity" } }
        const stored = snapshot.data.__sfProductV1
        const state = stored === undefined ? emptySfState(input.createId()) : readSfState(snapshot)
        if (!state) return { commit: false, value: { status: "unavailable", reason: "invalid-product-state" } }
        const key = JSON.stringify([authority.principalRef, command.namespace, command.idempotencyKey])
        const prior = state.transactions[key]
        if (prior) {
          if (prior.commandDigest !== command.commandDigest)
            return { commit: false, value: { status: "conflict", reason: "idempotency-content-changed" } }
          const current = await input.authorize(request, snapshot, command.namespace, "write")
          if (request.signal.aborted || !sameAuthority(authority, current))
            return { commit: false, value: { status: "denied", reason: "product-authority-changed" } }
          return { commit: false, value: { status: "ok", revision: prior.revision, incarnation: prior.incarnation, value: structuredClone(prior.value) as T } }
        }
        if (state.revision !== command.expectedVersion)
          return { commit: false, value: { status: "conflict", reason: "product-state-changed" } }
        const staged = structuredClone(state)
        const result = await work(staged, authority, snapshot)
        if (request.signal.aborted) return { commit: false, value: { status: "unavailable", reason: "cancelled" } }
        const current = await input.authorize(request, snapshot, command.namespace, "write")
        if (!sameAuthority(authority, current)) return { commit: false, value: { status: "denied", reason: "product-authority-changed" } }
        if (!result.commit) return { commit: false, value: { status: "ok", revision: state.revision, incarnation: state.incarnation, value: result.value } }
        if (staged.schemaVersion !== 1 || staged.revision !== state.revision || staged.incarnation !== state.incarnation)
          return { commit: false, value: { status: "conflict", reason: "product-identity-changed" } }
        staged.revision += 1
        staged.transactions[key] = { namespace: command.namespace, principalRef: authority.principalRef, commandDigest: command.commandDigest, revision: staged.revision, incarnation: staged.incarnation, value: structuredClone(result.value) }
        snapshot.data.__sfProductV1 = staged
        return { commit: true, value: { status: "ok", revision: staged.revision, incarnation: staged.incarnation, value: result.value } }
      }, { signal: request.signal }),
  }
}

function sameAuthority(expected: SfStateAuthority, current: SfStateAuthority | undefined) {
  return current?.principalRef === expected.principalRef && current.accessRevision === expected.accessRevision && current.policyVersion === expected.policyVersion
}

function emptySfState(incarnation: string): SfProductState | undefined {
  if (!incarnation.trim()) return undefined
  return { schemaVersion: 1, revision: 0, incarnation, preferences: {}, reviews: {}, relations: {}, threads: {}, confirmations: {}, cases: {}, contributions: {}, documents: {}, receipts: {}, atlas: {}, outbox: {}, transactions: {} }
}

function readSfState(snapshot: Snapshot): SfProductState | undefined {
  const state = object(snapshot.data.__sfProductV1)
  if (state.schemaVersion !== 1 || !Number.isSafeInteger(state.revision) || Number(state.revision) < 0 || typeof state.incarnation !== "string" || !state.incarnation.trim()) return undefined
  if (namespaces.some((key) => state[key] === null || typeof state[key] !== "object" || Array.isArray(state[key]))) return undefined
  return state as SfProductState
}
