import type { Persistence, Snapshot } from "../../runtime/contract.ts"
import { object } from "../../runtime/contract.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority, SfStateNamespace, SfStateResult, SfStateMutation } from "../contracts/state.ts"
import { digestSfValue } from "../contracts/canonical.ts"

const namespaces = ["preferences", "reviews", "relations", "threads", "confirmations", "cases", "contributions", "documents", "receipts", "atlas", "outbox"] as const
const storedNamespaces = [...namespaces, "transactions"] as const

/** The caller composes current product authority; a Dashboard role never grants it implicitly. */
export function createSfProductState(input: {
  persistence: Persistence
  authorize: (request: Request, snapshot: Snapshot, namespace: SfStateNamespace, mode: "read" | "write") => Promise<SfStateAuthority | undefined>
  createId: () => string
  /** Root-private callback identities; never exposed through a product capability or serialized input. */
  nativeEvidenceWrites?: WeakSet<object>
  resolveTarget: (request: Request, snapshot: Snapshot, namespace: SfStateNamespace, targetRef: string) => Promise<{ incarnation: string } | undefined>
}): SfProductStatePort {
  return {
    read: <T>(request: Request, namespace: SfStateNamespace, read: (state: Readonly<SfProductState>, authority: SfStateAuthority) => T | Promise<T>) =>
      input.persistence.transaction<SfStateResult<T>>("dashboard", async (snapshot) => {
        const authority = await input.authorize(request, snapshot, namespace, "read")
        if (!authority) return { commit: false, value: { status: "denied", reason: "product-access-unavailable" } }
        const state = readSfState(snapshot)
        if (!state) return { commit: false, value: { status: "unavailable", reason: snapshot.data.__sfProductV1 === undefined ? "product-state-uninitialized" : "invalid-product-state" } }
        const value = await read(structuredClone(state), authority)
        if (request.signal.aborted) return { commit: false, value: { status: "unavailable", reason: "cancelled" } }
        const current = await input.authorize(request, snapshot, namespace, "read")
        if (!sameAuthority(authority, current)) return { commit: false, value: { status: "denied", reason: "product-authority-changed" } }
        return { commit: false, value: { status: "ok", storageVersion: state.versions[namespace], aggregateRevision: state.revision, incarnation: state.incarnation, value } }
      }, { signal: request.signal }),
    transaction: <T>(request: Request, command: SfStateMutation, work: (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => Promise<{ commit: boolean; value: T }>) => {
      const run = async (snapshot: Snapshot, domain: Snapshot): Promise<{ commit: boolean; value: SfStateResult<T> }> => {
        const authority = await input.authorize(request, snapshot, command.namespace, "write")
        if (!authority) return { commit: false, value: { status: "denied", reason: "product-access-unavailable" } }
        const scope = [{ namespace: command.namespace, expectedStorageVersion: command.expectedStorageVersion }, ...command.additionalNamespaces ?? []]
        if (new Set(scope.map((entry) => entry.namespace)).size !== scope.length || scope.some((entry) => !namespaces.includes(entry.namespace) || !Number.isSafeInteger(entry.expectedStorageVersion) || entry.expectedStorageVersion < 0))
          return { commit: false, value: { status: "conflict", reason: "invalid-expected-version" } }
        const extraAuthority = await Promise.all(scope.slice(1).map(async (entry) => ({ namespace: entry.namespace, authority: await input.authorize(request, snapshot, entry.namespace, "write") })))
        if (extraAuthority.some((entry) => !entry.authority || entry.authority.principalRef !== authority.principalRef))
          return { commit: false, value: { status: "denied", reason: "product-access-unavailable" } }
        const admitted = [{ namespace: command.namespace, authority }, ...extraAuthority.filter((entry): entry is { namespace: SfStateNamespace; authority: SfStateAuthority } => entry.authority !== undefined)]
        const scopeDigest = digestSfValue(command.domainSurface && command.domainSurface !== "dashboard"
          ? { namespaces: scope.map((entry) => entry.namespace).sort(), domainSurface: command.domainSurface }
          : scope.map((entry) => entry.namespace).sort())
        if (!command.targetRef.trim() || !command.targetIncarnation.trim() || !command.idempotencyKey.trim() || !/^[a-f0-9]{64}$/.test(command.commandDigest))
          return { commit: false, value: { status: "conflict", reason: "invalid-command-identity" } }
        const stored = snapshot.data.__sfProductV1
        const state = stored === undefined ? emptySfState(input.createId()) : readSfState(snapshot)
        if (!state) return { commit: false, value: { status: "unavailable", reason: "invalid-product-state" } }
        const target = await input.resolveTarget(request, snapshot, command.namespace, command.targetRef)
        if (!target) return { commit: false, value: { status: "denied", reason: "target-access-unavailable" } }
        if (target.incarnation !== command.targetIncarnation)
          return { commit: false, value: { status: "conflict", reason: "target-replaced" } }
        const key = JSON.stringify([authority.principalRef, command.namespace, command.targetRef, command.idempotencyKey])
        const prior = state.transactions[key]
        if (prior) {
          if (prior.commandDigest !== command.commandDigest || prior.targetIncarnation !== command.targetIncarnation || prior.scopeDigest !== scopeDigest)
            return { commit: false, value: { status: "conflict", reason: "idempotency-content-changed" } }
          const current = await Promise.all(admitted.map((entry) => input.authorize(request, snapshot, entry.namespace, "write")))
          if (request.signal.aborted || admitted.some((entry, index) => !sameAuthority(entry.authority, current[index])))
            return { commit: false, value: { status: "denied", reason: "product-authority-changed" } }
          const currentTarget = await input.resolveTarget(request, snapshot, command.namespace, command.targetRef)
          if (currentTarget?.incarnation !== target.incarnation)
            return { commit: false, value: { status: "denied", reason: "target-authority-changed" } }
          return { commit: false, value: { status: "ok", storageVersion: prior.storageVersion, aggregateRevision: prior.aggregateRevision, incarnation: prior.incarnation, value: structuredClone(prior.value) as T } }
        }
        if (scope.some((entry) => state.versions[entry.namespace] !== entry.expectedStorageVersion))
          return { commit: false, value: { status: "conflict", reason: "product-state-changed" } }
        const staged = structuredClone(state)
        const result = await work(staged, authority, domain)
        if (request.signal.aborted) return { commit: false, value: { status: "unavailable", reason: "cancelled" } }
        const current = await Promise.all(admitted.map((entry) => input.authorize(request, snapshot, entry.namespace, "write")))
        if (admitted.some((entry, index) => !sameAuthority(entry.authority, current[index]))) return { commit: false, value: { status: "denied", reason: "product-authority-changed" } }
        const currentTarget = await input.resolveTarget(request, snapshot, command.namespace, command.targetRef)
        if (currentTarget?.incarnation !== target.incarnation)
          return { commit: false, value: { status: "denied", reason: "target-authority-changed" } }
        if (!result.commit) return { commit: false, value: { status: "preview", storageVersion: state.versions[command.namespace], aggregateRevision: state.revision, incarnation: state.incarnation, value: result.value } }
        if (staged.schemaVersion !== 1 || staged.revision !== state.revision || staged.incarnation !== state.incarnation)
          return { commit: false, value: { status: "conflict", reason: "product-identity-changed" } }
        const nativeMetadata = (preferences: SfProductState["preferences"]) => Object.fromEntries(Object.entries(preferences).filter(([key]) => key.startsWith("sf:native-session:")))
        if (!input.nativeEvidenceWrites?.has(work) && digestSfValue(nativeMetadata(staged.preferences)) !== digestSfValue(nativeMetadata(state.preferences)))
          return { commit: false, value: { status: "denied", reason: "native-evidence-write-outside-authority" } }
        if (digestSfValue(staged.versions) !== digestSfValue(state.versions) || storedNamespaces.some((key) => !scope.some((entry) => entry.namespace === key) && digestSfValue(staged[key]) !== digestSfValue(state[key])) ||
          (!scope.some((entry) => entry.namespace === "contributions") && digestSfValue(staged.nativeRuns) !== digestSfValue(state.nativeRuns)) ||
          (!scope.some((entry) => entry.namespace === "cases") && digestSfValue(staged.decisionResults) !== digestSfValue(state.decisionResults)))
          return { commit: false, value: { status: "denied", reason: "namespace-write-outside-authority" } }
        staged.revision += 1
        scope.forEach((entry) => staged.versions[entry.namespace] += 1)
        staged.transactions[key] = { namespace: command.namespace, scopeDigest, principalRef: authority.principalRef, targetRef: command.targetRef, targetIncarnation: command.targetIncarnation, commandDigest: command.commandDigest, storageVersion: staged.versions[command.namespace], aggregateRevision: staged.revision, incarnation: staged.incarnation, value: structuredClone(result.value) }
        snapshot.data.__sfProductV1 = staged
        return { commit: true, value: { status: "ok", storageVersion: staged.versions[command.namespace], aggregateRevision: staged.revision, incarnation: staged.incarnation, value: result.value } }
      }
      if (command.domainSurface && command.domainSurface !== "dashboard") {
        if (!input.persistence.transactionAll) return Promise.resolve({ status: "unavailable", reason: "cross-surface-transaction-unavailable" })
        const surface = command.domainSurface
        return input.persistence.transactionAll((snapshots) => run(snapshots.dashboard, snapshots[surface]), { signal: request.signal })
      }
      return input.persistence.transaction("dashboard", (snapshot) => run(snapshot, snapshot), { signal: request.signal })
    },
  }
}

function sameAuthority(expected: SfStateAuthority, current: SfStateAuthority | undefined) {
  return current?.principalRef === expected.principalRef && current.accessRevision === expected.accessRevision && current.policyVersion === expected.policyVersion
}

function emptySfState(incarnation: string): SfProductState | undefined {
  if (!incarnation.trim()) return undefined
  return { schemaVersion: 1, revision: 0, versions: { preferences: 0, reviews: 0, relations: 0, threads: 0, confirmations: 0, cases: 0, contributions: 0, documents: 0, receipts: 0, atlas: 0, outbox: 0 }, incarnation, preferences: {}, reviews: {}, relations: {}, threads: {}, confirmations: {}, cases: {}, contributions: {}, documents: {}, receipts: {}, atlas: {}, outbox: {}, transactions: {} }
}

function readSfState(snapshot: Snapshot): SfProductState | undefined {
  const state = object(snapshot.data.__sfProductV1)
  if (state.schemaVersion !== 1 || !Number.isSafeInteger(state.revision) || Number(state.revision) < 0 || typeof state.incarnation !== "string" || !state.incarnation.trim()) return undefined
  if (Object.keys(object(state.versions)).length !== 11 || namespaces.some((key) => !Number.isSafeInteger(object(state.versions)[key]) || Number(object(state.versions)[key]) < 0)) return undefined
  if (storedNamespaces.some((key) => state[key] === null || typeof state[key] !== "object" || Array.isArray(state[key]))) return undefined
  if (state.nativeRuns !== undefined && (!state.nativeRuns || typeof state.nativeRuns !== "object" || Array.isArray(state.nativeRuns))) return undefined
  return state as SfProductState
}
