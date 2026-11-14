import type { Persistence, Snapshot } from "../../runtime/contract.ts"
import { object } from "../../runtime/contract.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority, SfStateNamespace, SfStateResult, SfStateMutation } from "../contracts/state.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { sfProductStateAdditiveFields } from "../contracts/state-layout.ts"

const namespaces = ["preferences", "reviews", "relations", "threads", "confirmations", "cases", "contributions", "documents", "receipts", "atlas", "outbox", "bi-artifacts"] as const
const storedNamespaces = ["preferences", "reviews", "relations", "threads", "confirmations", "cases", "contributions", "documents", "receipts", "atlas", "outbox", "transactions"] as const

// Only selectors constructed here may project before cloning. This registry
// retains code identity, never an observed case, snapshot or admitted authority.
const caseReads = new WeakMap<object, {
  id: string
  project: (cases: SfProductState["cases"], authority: SfStateAuthority) => SfProductState["cases"][string] | undefined
}>()

export function selectSfCase(id: string, context: TrustedDomainContext) {
  const read = (state: Pick<SfProductState, "cases">, authority: SfStateAuthority) =>
    authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? state.cases[id] : undefined
  // Mutable or accessor-backed contexts retain the opaque callback path. The
  // predicate still runs after C08 admission, at its original observation time.
  const binding = Object.getOwnPropertyDescriptor(context, "binding")
  if (typeof id === "string" && Object.isFrozen(context) && binding && "value" in binding && binding.value !== null && typeof binding.value === "object" && Object.isFrozen(binding.value) &&
    ["principalRef", "policyVersion", "accessRevision"].every((key) => {
      const field = Object.getOwnPropertyDescriptor(binding.value, key)
      return !!field && "value" in field && typeof field.value === "string"
    })) caseReads.set(read, { id, project: (cases, authority) => read({ cases }, authority) })
  return read
}

/** The caller composes current product authority; a Dashboard role never grants it implicitly. */
export function createSfProductState(input: {
  persistence: Persistence
  authorize: (request: Request, snapshot: Snapshot, namespace: SfStateNamespace, mode: "read" | "write") => Promise<SfStateAuthority | undefined>
  createId: () => string
  /** Root-private callback identities; never exposed through a product capability or serialized input. */
  nativeEvidenceWrites?: WeakSet<object>
  proposalCoverageWrites?: WeakSet<object>
  nativePublicationGuards?: WeakMap<object, () => boolean>
  signalRegistryWrites?: WeakSet<object>
  caseSelectionWrites?: WeakSet<object>
  analysisSelectionWrites?: WeakSet<object>
  threadHistoryWrites?: WeakSet<object>
  dashboardHostWrites?: WeakSet<object>
  procurementEvidenceWrites?: WeakSet<object>
  resolveTarget: (request: Request, snapshot: Snapshot, namespace: SfStateNamespace, targetRef: string, command: SfStateMutation) => Promise<{ incarnation: string } | undefined>
}): SfProductStatePort {
  return {
    read: <T>(request: Request, namespace: SfStateNamespace, read: (state: Readonly<SfProductState>, authority: SfStateAuthority) => T | Promise<T>) =>
      input.persistence.transaction<SfStateResult<T>>("dashboard", async (snapshot) => {
        const authority = await input.authorize(request, snapshot, namespace, "read")
        if (!authority) return { commit: false, value: { status: "denied", reason: "product-access-unavailable" } }
        const state = readSfState(snapshot)
        if (!state) return { commit: false, value: { status: "unavailable", reason: snapshot.data.__sfProductV1 === undefined ? "product-state-uninitialized" : "invalid-product-state" } }
        const selection = namespace === "cases" ? caseReads.get(read) : undefined
        const cases = selection ? Object.getOwnPropertyDescriptor(state, "cases") : undefined
        const selected = selection && cases?.enumerable && "value" in cases && cases.value !== null && typeof cases.value === "object" && !Array.isArray(cases.value)
          ? Object.getOwnPropertyDescriptor(cases.value, selection.id) : undefined
        // Keep missing/inherited, accessor and malformed lookups on the original
        // path. Durable SQLite snapshots contain plain cloneable data.
        const value = selection && selected?.enumerable && "value" in selected && selected.value &&
          typeof selected.value === "object" && !Array.isArray(selected.value)
          ? await selection.project({ [selection.id]: structuredClone(selected.value) }, authority) as T
          : await read(structuredClone(state), authority)
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
        const checks = command.checkNamespaces ?? []
        const all = [...scope, ...checks]
        if (new Set(all.map((entry) => entry.namespace)).size !== all.length || all.some((entry) => !namespaces.includes(entry.namespace) || !Number.isSafeInteger(entry.expectedStorageVersion) || entry.expectedStorageVersion < 0))
          return { commit: false, value: { status: "conflict", reason: "invalid-expected-version" } }
        const extraAuthority = await Promise.all(scope.slice(1).map(async (entry) => ({ namespace: entry.namespace, authority: await input.authorize(request, snapshot, entry.namespace, "write") })))
        if (extraAuthority.some((entry) => !entry.authority || entry.authority.principalRef !== authority.principalRef))
          return { commit: false, value: { status: "denied", reason: "product-access-unavailable" } }
        const admitted = [{ namespace: command.namespace, authority }, ...extraAuthority.filter((entry): entry is { namespace: SfStateNamespace; authority: SfStateAuthority } => entry.authority !== undefined)]
        const checkAuthority = await Promise.all(checks.map((entry) => input.authorize(request, snapshot, entry.namespace, "read")))
        if (checkAuthority.some((entry) => !entry || entry.principalRef !== authority.principalRef))
          return { commit: false, value: { status: "denied", reason: "product-access-unavailable" } }
        const checksCurrent = async () => (await Promise.all(checks.map((entry) => input.authorize(request, snapshot, entry.namespace, "read"))))
          .every((entry, index) => sameAuthority(checkAuthority[index]!, entry))
        if (command.sourceFence !== undefined && command.sourceFence !== "all") return { commit: false, value: { status: "conflict", reason: "invalid-source-fence" } }
        const writeNamespaces = scope.map((entry) => entry.namespace).sort()
        const scopeIdentity = command.sourceFence === "all"
          ? { namespaces: writeNamespaces, ...(command.domainSurface && command.domainSurface !== "dashboard" ? { domainSurface: command.domainSurface } : {}), sourceFence: "all" }
          : command.domainSurface && command.domainSurface !== "dashboard" ? { namespaces: writeNamespaces, domainSurface: command.domainSurface } : writeNamespaces
        const scopeDigest = digestSfValue(command.checkNamespaces === undefined ? scopeIdentity : { scope: scopeIdentity, checks: checks.map((entry) => entry.namespace).sort() })
        if (!command.targetRef.trim() || !command.targetIncarnation.trim() || !command.idempotencyKey.trim() || !/^[a-f0-9]{64}$/.test(command.commandDigest))
          return { commit: false, value: { status: "conflict", reason: "invalid-command-identity" } }
        const stored = snapshot.data.__sfProductV1
        const state = stored === undefined ? emptySfState(input.createId()) : migrateSfStateForWrite(readSfState(snapshot))
        if (!state) return { commit: false, value: { status: "unavailable", reason: "invalid-product-state" } }
        const target = await input.resolveTarget(request, snapshot, command.namespace, command.targetRef, command)
        if (!target) return { commit: false, value: { status: "denied", reason: "target-access-unavailable" } }
        if (target.incarnation !== command.targetIncarnation)
          return { commit: false, value: { status: "conflict", reason: "target-replaced" } }
        const key = JSON.stringify([authority.principalRef, command.namespace, command.targetRef, command.idempotencyKey])
        const prior = state.transactions[key]
        if (prior) {
          if (prior.commandDigest !== command.commandDigest || prior.targetIncarnation !== command.targetIncarnation || prior.scopeDigest !== scopeDigest)
            return { commit: false, value: { status: "conflict", reason: "idempotency-content-changed" } }
          const current = await Promise.all(admitted.map((entry) => input.authorize(request, snapshot, entry.namespace, "write")))
          if (request.signal.aborted || admitted.some((entry, index) => !sameAuthority(entry.authority, current[index])) || !(await checksCurrent()))
            return { commit: false, value: { status: "denied", reason: "product-authority-changed" } }
          const currentTarget = await input.resolveTarget(request, snapshot, command.namespace, command.targetRef, command)
          if (currentTarget?.incarnation !== target.incarnation)
            return { commit: false, value: { status: "denied", reason: "target-authority-changed" } }
          return { commit: false, value: { status: "ok", storageVersion: prior.storageVersion, aggregateRevision: prior.aggregateRevision, incarnation: prior.incarnation, value: structuredClone(prior.value) as T } }
        }
        if (all.some((entry) => state.versions[entry.namespace] !== entry.expectedStorageVersion))
          return { commit: false, value: { status: "conflict", reason: "product-state-changed" } }
        const staged = structuredClone(state)
        const result = await work(staged, authority, domain)
        if (request.signal.aborted) return { commit: false, value: { status: "unavailable", reason: "cancelled" } }
        const current = await Promise.all(admitted.map((entry) => input.authorize(request, snapshot, entry.namespace, "write")))
        if (admitted.some((entry, index) => !sameAuthority(entry.authority, current[index])) || !(await checksCurrent())) return { commit: false, value: { status: "denied", reason: "product-authority-changed" } }
        const currentTarget = await input.resolveTarget(request, snapshot, command.namespace, command.targetRef, command)
        if (currentTarget?.incarnation !== target.incarnation)
          return { commit: false, value: { status: "denied", reason: "target-authority-changed" } }
        if (!result.commit) return { commit: false, value: { status: "preview", storageVersion: state.versions[command.namespace], aggregateRevision: state.revision, incarnation: state.incarnation, value: result.value } }
        if (staged.schemaVersion !== 1 || staged.revision !== state.revision || staged.incarnation !== state.incarnation)
          return { commit: false, value: { status: "conflict", reason: "product-identity-changed" } }
        const nativeMetadata = (preferences: SfProductState["preferences"]) => Object.fromEntries(Object.entries(preferences).filter(([key]) => key.startsWith("sf:native-session:")))
        if (!input.nativeEvidenceWrites?.has(work) && digestSfValue(nativeMetadata(staged.preferences)) !== digestSfValue(nativeMetadata(state.preferences)))
          return { commit: false, value: { status: "denied", reason: "native-evidence-write-outside-authority" } }
        const proposalMetadata = (preferences: SfProductState["preferences"]) => Object.fromEntries(Object.entries(preferences).filter(([key]) => key.startsWith("sf:proposal-coverage:") || key.startsWith("sf:criterion-rule:") || key.startsWith("sf:portfolio:campaign:")))
        if (!input.proposalCoverageWrites?.has(work) && digestSfValue(proposalMetadata(staged.preferences)) !== digestSfValue(proposalMetadata(state.preferences)))
          return { commit: false, value: { status: "denied", reason: "proposal-coverage-write-outside-authority" } }
        const signalMetadata = (preferences: SfProductState["preferences"]) => Object.fromEntries(Object.entries(preferences).filter(([key]) => key.startsWith("sf:memory-condition:") || key.startsWith("sf:memory-outcome:")))
        if (!input.signalRegistryWrites?.has(work) && digestSfValue(signalMetadata(staged.preferences)) !== digestSfValue(signalMetadata(state.preferences)))
          return { commit: false, value: { status: "denied", reason: "signal-registry-write-outside-authority" } }
        const caseSelectionMetadata = (preferences: SfProductState["preferences"]) => Object.fromEntries(Object.entries(preferences).filter(([key]) => key.startsWith("sf:case-work-selection:")))
        const analysisSelectionMetadata = (preferences: SfProductState["preferences"]) => Object.fromEntries(Object.entries(preferences).filter(([key]) => key.startsWith("sf:analysis-selection:")))
        if (!input.analysisSelectionWrites?.has(work) && digestSfValue(analysisSelectionMetadata(staged.preferences)) !== digestSfValue(analysisSelectionMetadata(state.preferences)))
          return { commit: false, value: { status: "denied", reason: "analysis-selection-writer-required" } }
        if (!input.caseSelectionWrites?.has(work) && digestSfValue(caseSelectionMetadata(staged.preferences)) !== digestSfValue(caseSelectionMetadata(state.preferences)))
          return { commit: false, value: { status: "denied", reason: "case-selection-write-outside-authority" } }
        if (!input.threadHistoryWrites?.has(work) && Object.entries(state.threads).some(([id, value]) => {
          const before = object(value)
          const after = object(staged.threads[id])
          if (digestSfValue(before.messageRevisions) !== digestSfValue(after.messageRevisions)) return true
          if (!Array.isArray(before.messages)) return false
          const messages = after.messages
          return !Array.isArray(messages) || messages.length < before.messages.length || before.messages.some((message, index) => digestSfValue(message) !== digestSfValue(messages[index]))
        })) return { commit: false, value: { status: "denied", reason: "thread-history-write-outside-authority" } }
        if (!input.threadHistoryWrites?.has(work) && Object.entries(staged.threads).some(([id, value]) => !Object.hasOwn(state.threads, id) && object(value).messageRevisions !== undefined))
          return { commit: false, value: { status: "denied", reason: "thread-history-write-outside-authority" } }
        const dashboardMetadata = (preferences: SfProductState["preferences"]) => Object.fromEntries(Object.entries(preferences).filter(([key]) => key.startsWith("sf:dashboard-host:")))
        if (!input.dashboardHostWrites?.has(work) && digestSfValue(dashboardMetadata(staged.preferences)) !== digestSfValue(dashboardMetadata(state.preferences)))
          return { commit: false, value: { status: "denied", reason: "dashboard-host-write-outside-authority" } }
        const procurementEvidence = (preferences: SfProductState["preferences"]) => Object.fromEntries(Object.entries(preferences).filter(([key]) => key.startsWith("sf:procurement-evidence:")))
        if (!input.procurementEvidenceWrites?.has(work) && digestSfValue(procurementEvidence(staged.preferences)) !== digestSfValue(procurementEvidence(state.preferences)))
          return { commit: false, value: { status: "denied", reason: "procurement-evidence-write-outside-authority" } }
        if (digestSfValue(staged.versions) !== digestSfValue(state.versions) || storedNamespaces.some((key) => !scope.some((entry) => entry.namespace === key) && digestSfValue(staged[key]) !== digestSfValue(state[key])) ||
          (!scope.some((entry) => entry.namespace === "contributions") && digestSfValue(staged.nativeRuns) !== digestSfValue(state.nativeRuns)) ||
          (!scope.some((entry) => entry.namespace === "bi-artifacts") && digestSfValue(staged.biArtifacts) !== digestSfValue(state.biArtifacts)) ||
          (!scope.some((entry) => entry.namespace === "cases") && (digestSfValue(staged.decisionResults) !== digestSfValue(state.decisionResults) || digestSfValue(staged.claimBindings) !== digestSfValue(state.claimBindings) || digestSfValue(staged.commandProposals) !== digestSfValue(state.commandProposals) || digestSfValue(staged.compositeScenarios) !== digestSfValue(state.compositeScenarios))))
          return { commit: false, value: { status: "denied", reason: "namespace-write-outside-authority" } }
        const nativePublicationGuard = input.nativePublicationGuards?.get(work)
        if (nativePublicationGuard && !nativePublicationGuard()) return { commit: false, value: { status: "denied", reason: "native-publication-authority-changed" } }
        staged.revision += 1
        scope.forEach((entry) => staged.versions[entry.namespace] += 1)
        staged.transactions[key] = { namespace: command.namespace, scopeDigest, principalRef: authority.principalRef, targetRef: command.targetRef, targetIncarnation: command.targetIncarnation, commandDigest: command.commandDigest, storageVersion: staged.versions[command.namespace], aggregateRevision: staged.revision, incarnation: staged.incarnation, value: structuredClone(result.value) }
        snapshot.data.__sfProductV1 = staged
        return { commit: true, value: { status: "ok", storageVersion: staged.versions[command.namespace], aggregateRevision: staged.revision, incarnation: staged.incarnation, value: result.value } }
      }
      if (command.sourceFence === "all" || command.namespace === "documents" || command.additionalNamespaces?.some((entry) => entry.namespace === "documents") || command.checkNamespaces?.some((entry) => entry.namespace === "documents") || command.domainSurface) {
        if (!input.persistence.transactionAll) return Promise.resolve({ status: "unavailable", reason: "cross-surface-transaction-unavailable" })
        const surface = command.domainSurface ?? "dashboard"
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
  return { schemaVersion: 1, revision: 0, versions: { preferences: 0, reviews: 0, relations: 0, threads: 0, confirmations: 0, cases: 0, contributions: 0, documents: 0, receipts: 0, atlas: 0, outbox: 0, "bi-artifacts": 0 }, incarnation, preferences: {}, reviews: {}, relations: {}, threads: {}, confirmations: {}, cases: {}, contributions: {}, documents: {}, receipts: {}, atlas: {}, outbox: {}, claimBindings: {}, commandProposals: {}, compositeScenarios: {}, decisionResults: {}, nativeRuns: {}, biArtifacts: {}, transactions: {} }
}

/** Add only missing v1 maps to the write baseline. Persistence still occurs only after all commit guards. */
function migrateSfStateForWrite(state: SfProductState | undefined): SfProductState | undefined {
  if (!state) return undefined
  const migrated = { ...state }
  for (const field of sfProductStateAdditiveFields) if (migrated[field] === undefined) migrated[field] = {}
  return migrated
}

function readSfState(snapshot: Snapshot): SfProductState | undefined {
  const state = object(snapshot.data.__sfProductV1)
  if (state.schemaVersion !== 1 || !Number.isSafeInteger(state.revision) || Number(state.revision) < 0 || typeof state.incarnation !== "string" || !state.incarnation.trim()) return undefined
  const versions = object(state.versions)
  const legacy = Object.keys(versions).length === 11 && versions["bi-artifacts"] === undefined && state.biArtifacts === undefined
  if ((!legacy && Object.keys(versions).length !== 12) || namespaces.some((key) => !(legacy && key === "bi-artifacts") && (!Number.isSafeInteger(versions[key]) || Number(versions[key]) < 0))) return undefined
  if (storedNamespaces.some((key) => state[key] === null || typeof state[key] !== "object" || Array.isArray(state[key]))) return undefined
  if (sfProductStateAdditiveFields.some((field) => state[field] !== undefined && (!state[field] || typeof state[field] !== "object" || Array.isArray(state[field])))) return undefined
  if (!legacy && (!state.biArtifacts || typeof state.biArtifacts !== "object" || Array.isArray(state.biArtifacts))) return undefined
  return (legacy ? { ...state, versions: { ...versions, "bi-artifacts": 0 }, biArtifacts: {} } : state) as SfProductState
}
