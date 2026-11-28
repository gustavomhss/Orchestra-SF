import { currentSfE16Route, linkSfE16Work, tapSfE16ProviderSelection } from "../../runtime/preview-progress-e16-diagnostic.ts"
import { types } from "node:util"
import type { Persistence, Snapshot } from "../../runtime/contract.ts"
import type { AssetPersistence } from "../../runtime/assets.ts"
import { sfReviewArtifactBlobKey } from "../../runtime/artifact.ts"
import { hasSfDashboardSourceFence, object } from "../../runtime/contract.ts"
import { consumeLocalTransactionAbort, observeLocalTransactionAbort, observeLocalProductRead } from "../../runtime/local-store.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority, SfStateNamespace, SfStateResult, SfStateMutation } from "../contracts/state.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { isSfAclStateAuthorize } from "./acl-state-authorize.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { sfProductStateAdditiveFields } from "../contracts/state-layout.ts"


type SfAbortCommand = Pick<SfStateMutation, "namespace" | "domainSurface" | "targetRef" | "targetIncarnation" | "idempotencyKey" | "commandDigest">
export type SfConfirmedTransactionAbort = {
  storageIdentity: string
  transactionId: string
  command: SfStateMutation
  envelope: { incarnation: string; aggregateRevision: number; versions: SfProductState["versions"] }
}
const transactionAborts = new WeakMap<object, { state: SfProductStatePort; request: Request; proof: SfConfirmedTransactionAbort }>()
const abortJournalWrites = new WeakSet<object>()
const abortJournalPrefix = "decision-application-abort:"

function matchesAbortCommand(command: SfStateMutation, expected: SfAbortCommand) {
  return command.namespace === expected.namespace && command.domainSurface === expected.domainSurface &&
    command.targetRef === expected.targetRef && command.targetIncarnation === expected.targetIncarnation &&
    command.idempotencyKey === expected.idempotencyKey && command.commandDigest === expected.commandDigest
}

/** Transfer the private observation along the actual producer result, never through serialized data. */
export function forwardSfTransactionAbort(input: { state: SfProductStatePort; request: Request; expected: SfAbortCommand; from: unknown; to: object }) {
  if (!input.from || typeof input.from !== "object") return
  const observed = transactionAborts.get(input.from)
  if (!observed || observed.state !== input.state || observed.request !== input.request || !matchesAbortCommand(observed.proof.command, input.expected)) return
  transactionAborts.delete(input.from)
  transactionAborts.set(input.to, observed)
}

/** Append one authenticated rollback observation. Public C08 callbacks cannot create this journal. */
export async function appendSfTransactionAbort(input: {
  state: SfProductStatePort
  request: Request
  result: object
  expected: SfAbortCommand
  expectedStorageVersion: number
  targetRef: string
  targetIncarnation: string
  idempotencyKey: string
  value: Record<string, unknown>
  validate: (state: Readonly<SfProductState>, authority: SfStateAuthority, proof: SfConfirmedTransactionAbort) => boolean | Promise<boolean>
}): Promise<SfStateResult<unknown>> {
  const observed = transactionAborts.get(input.result)
  if (!observed || observed.state !== input.state || observed.request !== input.request ||
    !input.idempotencyKey.startsWith(abortJournalPrefix) || !matchesAbortCommand(observed.proof.command, input.expected))
    return { status: "unavailable", reason: "transaction-abort-unproven" }
  // A failed or ambiguous journal write cannot reuse a capability. A retry is
  // admitted only from the durable journal, never from a retained error object.
  transactionAborts.delete(input.result)
  const value = { ...structuredClone(input.value), rollback: structuredClone(observed.proof) }
  const work = async (state: SfProductState, authority: SfStateAuthority) => ({
    commit: await input.validate(structuredClone(state), structuredClone(authority), structuredClone(observed.proof)),
    value,
  })
  abortJournalWrites.add(work)
  try {
    return await input.state.transaction(input.request, {
      namespace: "cases", expectedStorageVersion: input.expectedStorageVersion,
      targetRef: input.targetRef, targetIncarnation: input.targetIncarnation,
      idempotencyKey: input.idempotencyKey, commandDigest: digestSfValue(value),
    }, work)
  } finally {
    abortJournalWrites.delete(work)
  }
}

const stagedReviewThreadWrites = new WeakSet<object>()
const reviewReceiptReads = new WeakSet<object>()
const installedStateReads = new WeakSet<object>()
const installedStateTransactions = new WeakMap<object, SfProductStatePort["transaction"]>()
const reviewAuthorityReads = new WeakMap<object, (authority: SfStateAuthority) => unknown>()

export function isInstalledSfStateRead(read: SfProductStatePort["read"]) {
  return installedStateReads.has(read)
}

export function isInstalledSfStateTransaction(read: SfProductStatePort["read"], transaction: SfProductStatePort["transaction"]) {
  return installedStateTransactions.get(read) === transaction
}

/** The existing transaction validator returns a receipt; this probe cannot commit. */
export async function probeSfReviewMutationReceipt<T>(
  state: SfProductStatePort,
  request: Request,
  command: SfStateMutation,
  context: TrustedDomainContext,
  current: () => boolean,
): Promise<SfStateResult<T | null> | undefined> {
  const read = state.read
  const transaction = state.transaction
  if (installedStateTransactions.get(read) !== transaction) return undefined
  const binding = digestSfValue([context.kind, context.binding])
  const live = () => current() && state.read === read && state.transaction === transaction &&
    !request.signal.aborted && digestSfValue([context.kind, context.binding]) === binding
  const denied = { status: "denied" as const, reason: "product-authority-changed" }
  const candidate = await state.read(request, "threads", (stored, actor) => {
    const bound = actor.principalRef === context.binding.principalRef && actor.accessRevision === context.binding.accessRevision &&
      actor.policyVersion === context.binding.policyVersion
    return { bound, exists: bound && !!stored.transactions[JSON.stringify([actor.principalRef, command.namespace, command.targetRef, command.idempotencyKey])] }
  })
  if (!live()) return denied
  if ("reason" in candidate) return candidate
  if (candidate.status !== "ok") return { status: "unavailable", reason: "thread-read-unavailable" }
  if (!candidate.value.bound) return denied
  if (!candidate.value.exists) return undefined
  const result = await state.transaction(request, command, stageSfReviewThreadWrite<T | null>(async () => ({ commit: false, value: null })))
  return live() ? result : denied
}

/** Bind review/receipt observers to their two C08 maps. The state provider
 * still checks the original namespace and executes the caller on a fresh copy. */
export function selectSfReviewReceipts<T>(read: (state: Pick<SfProductState, "reviews" | "transactions">, authority: SfStateAuthority) => T | Promise<T>) {
  reviewReceiptReads.add(read)
  return read
}

/** Observe C08 authority and the storage version without materializing its state for the caller. */
export function selectSfReviewAuthority<T>(project: (authority: SfStateAuthority) => T | Promise<T>) {
  const read = (_state: Readonly<SfProductState>, authority: SfStateAuthority) => project(authority)
  reviewAuthorityReads.set(read, project)
  return read
}

/** A review thread mutation owns only staged product state, never the live domain snapshot. */
export function stageSfReviewThreadWrite<T>(work: (state: SfProductState, authority: SfStateAuthority) => Promise<{ commit: boolean; value: T }>) {
  stagedReviewThreadWrites.add(work)
  return work
}

type ReviewArtifactWrite = Readonly<{ ref: string; bytes: Uint8Array; mediaType: string; digest: string }>
const stagedReviewArtifactWrites = new WeakMap<object, ReviewArtifactWrite>()
const reviewArtifactBlobReaders = new WeakMap<SfProductStatePort,
  (request: Request, ref: string, metadataDigest: string, expected: SfStateAuthority) => Promise<Uint8Array | undefined>>()

export function stageSfReviewArtifactWrite<T>(artifact: ReviewArtifactWrite,
  work: (state: SfProductState, authority: SfStateAuthority) => Promise<{ commit: boolean; value: T }>) {
  stagedReviewArtifactWrites.set(work, Object.freeze({ ...artifact, bytes: new Uint8Array(artifact.bytes) }))
  return work
}

export function sfReviewArtifactBlobReader(port: SfProductStatePort) {
  return reviewArtifactBlobReaders.get(port)
}

const namespaces = ["preferences", "reviews", "relations", "threads", "confirmations", "cases", "contributions", "documents", "receipts", "atlas", "outbox", "bi-artifacts"] as const
const storedNamespaces = ["preferences", "reviews", "relations", "threads", "confirmations", "cases", "contributions", "documents", "receipts", "atlas", "outbox", "transactions"] as const

// Only selectors constructed here may project before cloning. This registry
// retains code identity, never an observed case, snapshot or admitted authority.
const caseReads = new WeakMap<object, {
  id: string
  project: (cases: SfProductState["cases"], authority: SfStateAuthority) => SfProductState["cases"][string] | undefined
}>()
const readinessReads = new WeakMap<object, { namespace: SfStateNamespace; mode: "read" | "write"; select: (state: SfProductState, authority: SfStateAuthority) => { storageVersion: number; aggregateRevision: number; incarnation: string } | undefined }>()

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

// This private registry records an explicit read-set contract, never a
// snapshot, observed result or admitted authority.
const preferencesReads = new WeakMap<object,
  (state: Pick<SfProductState, "preferences">, authority: SfStateAuthority) => unknown | Promise<unknown>>()

/** Explicit opt-in to the complete preferences graph, cloned afresh in each C08.
 * Effects and errors reachable only through unselected namespaces are outside
 * this callback's read-set. This is not equivalence to cloning the whole state.
 * Opaque callbacks, contexts and map shapes keep the original full-state path;
 * both authority checks and the callback's observation time remain unchanged. */
export function selectSfPreferencesProjection<T>(context: TrustedDomainContext,
  project: (preferences: SfProductState["preferences"], authority: SfStateAuthority) => T | Promise<T>) {
  const read = (state: Pick<SfProductState, "preferences">, authority: SfStateAuthority) => project(state.preferences, authority)
  if (!types.isProxy(project) && frozenSelectionContext(context)) preferencesReads.set(read, read)
  return read
}

/** Explicit opt-in to the complete preferences graph for one authority-gated
 * lookup. The callback retains the original comparison order before accessing
 * the namespace, including on opaque state ports. Only the existing plain,
 * frozen context admission marks it; no binding, value or authority is retained.
 * The provider clones all of preferences afresh, including every reachable
 * alias. Effects solely in unreachable namespaces remain outside this read-set. */
export function selectSfPreference(key: string, context: TrustedDomainContext) {
  const read = (state: Pick<SfProductState, "preferences">, authority: SfStateAuthority) =>
    authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? state.preferences[key] : undefined
  if (typeof key === "string" && frozenSelectionContext(context)) preferencesReads.set(read, read)
  return read
}

/** Declare the complete preferences read-set without adapting the callback.
 * Return the same function and never observe state, authority or the callback.
 * Its own guards, repeated getters and observation time stay in their original
 * order, including on custom ports. Admission only opts into the existing fresh
 * whole-preferences clone; it does not prove purity or reuse an authority. */
export function selectSfPreferencesRead<T>(context: TrustedDomainContext,
  read: (state: Pick<SfProductState, "preferences">, authority: SfStateAuthority) => T | Promise<T>) {
  if (typeof read === "function" && !types.isProxy(read) && frozenSelectionContext(context)) preferencesReads.set(read, read)
  return read
}

function plainSelectionMap(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !types.isProxy(value) && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
}

function frozenSelectionContext(context: TrustedDomainContext) {
  const dataFields = (value: object) => Reflect.ownKeys(value).every((key) => {
    const field = Object.getOwnPropertyDescriptor(value, key)
    return !!field && "value" in field
  })
  if (!plainSelectionMap(context) || !Object.isFrozen(context) || !dataFields(context)) return false
  const binding = Object.getOwnPropertyDescriptor(context, "binding")
  return !!binding && "value" in binding && plainSelectionMap(binding.value) && Object.isFrozen(binding.value) && dataFields(binding.value) &&
    ["principalRef", "policyVersion", "accessRevision"].every((key) => {
      const field = Object.getOwnPropertyDescriptor(binding.value, key)
      return !!field && "value" in field && typeof field.value === "string"
    })
}

function projectPreferencesRead(state: SfProductState): Pick<SfProductState, "preferences"> | undefined {
  if (!plainSelectionMap(state)) return undefined
  const preferences = Object.getOwnPropertyDescriptor(state, "preferences")
  if (!preferences?.enumerable || !("value" in preferences) || !plainSelectionMap(preferences.value)) return undefined
  // Clone the complete graph once: aliases and cycles stay connected; getters
  // are observed and clone errors propagate according to structuredClone.
  return { preferences: structuredClone(preferences.value) }
}

// A caller declares the complete cases read-set without moving its own guard or
// key lookup. Registration retains callback identity, never selected data.
const caseGraphReads = new WeakMap<object,
  (state: Pick<SfProductState, "cases">, authority: SfStateAuthority) => unknown | Promise<unknown>>()

/** Explicit opt-in to a fresh clone of the whole cases graph in each C08.
 * Effects and errors reachable only through unselected namespaces are outside
 * this callback's read-set; this is not global full-state clone equivalence.
 * Return the same callback so opaque ports preserve guards, late IDs and
 * repeated getters. Mutable contexts and opaque maps retain the full path. */
export function selectSfCasesRead<T>(context: TrustedDomainContext,
  read: (state: Pick<SfProductState, "cases">, authority: SfStateAuthority) => T | Promise<T>) {
  if (typeof read === "function" && !types.isProxy(read) && frozenSelectionContext(context)) caseGraphReads.set(read, read)
  return read
}

function projectCasesRead(state: SfProductState): Pick<SfProductState, "cases"> | undefined {
  if (!plainSelectionMap(state)) return undefined
  const cases = Object.getOwnPropertyDescriptor(state, "cases")
  if (!cases?.enumerable || !("value" in cases) || !plainSelectionMap(cases.value)) return undefined
  // One fresh whole-graph clone retains reachable aliases, cycles and failures.
  return { cases: structuredClone(cases.value as SfProductState["cases"]) }
}

/** Namespace infrastructure health only; this never observes or authorizes individual cases. */
export function selectSfCaseHealth(context: Pick<SfStateAuthority, "principalRef" | "policyVersion" | "accessRevision">) {
  return selectSfNamespaceHealth("cases", context)
}

/** Trusted metadata-only selector for the original C08 namespace. */
export function selectSfNamespaceHealth(namespace: "cases" | "reviews" | "documents" | "atlas" | "outbox" | "preferences" | "receipts", context: Pick<SfStateAuthority, "principalRef" | "policyVersion" | "accessRevision">, mode: "read" | "write" = "read") {
  if (!["cases", "reviews", "documents", "atlas", "outbox", "preferences", "receipts"].includes(namespace) || !["read", "write"].includes(mode)) throw new Error("SF_STATE_HEALTH_SELECTOR_INVALID")
  const expected = Object.freeze({ principalRef: context.principalRef, policyVersion: context.policyVersion, accessRevision: context.accessRevision })
  const select = (state: Readonly<SfProductState>, authority: SfStateAuthority) => {
    if (!sameAuthority(expected, authority)) return undefined
    return { storageVersion: state.versions[namespace], aggregateRevision: state.revision, incarnation: state.incarnation }
  }
  const read = (state: Readonly<SfProductState>, authority: SfStateAuthority) => select(state, authority)
  readinessReads.set(read, { namespace, mode, select })
  return read
}

// Only these constructor-owned C08 callbacks may project cases plus stored
// result envelopes. The registry never holds an observed snapshot, outcome or
// grant. Opaque and wrapped functions still receive the whole private clone.
type ResultSelection = { references: readonly string[]; fixedCaseId?: string; skip?: (index: number) => boolean }
const resultReads = new WeakMap<object, ResultSelection>()

type SfDecisionReadValue = {
  stored: NonNullable<SfProductState["decisionResults"]>[string]
  current: SfProductState["cases"][string] | undefined
}
export function selectSfDecisionResult(resultRef: string, context: TrustedDomainContext): (state: Readonly<SfProductState>, authority: SfStateAuthority) => SfDecisionReadValue | undefined
export function selectSfDecisionResult(resultRef: string, context: TrustedDomainContext, fixedCaseId: string): (state: Readonly<SfProductState>, authority: SfStateAuthority) => { stored: SfDecisionReadValue["stored"] | undefined; current: SfDecisionReadValue["current"] } | undefined
export function selectSfDecisionResult(resultRef: string, context: TrustedDomainContext, fixedCaseId?: string): (state: Readonly<SfProductState>, authority: SfStateAuthority) => SfDecisionReadValue | { stored: SfDecisionReadValue["stored"] | undefined; current: SfDecisionReadValue["current"] } | undefined {
  const read = (state: Readonly<SfProductState>, authority: SfStateAuthority) => {
    if (authority.principalRef !== context.binding.principalRef || authority.policyVersion !== context.binding.policyVersion || authority.accessRevision !== context.binding.accessRevision) return undefined
    const stored = state.decisionResults?.[resultRef]
    return fixedCaseId !== undefined ? { current: state.cases[fixedCaseId], stored }
      : stored ? { stored, current: state.cases[stored.caseRef.id] } : undefined
  }
  registerResultRead(read, context, { references: [resultRef], fixedCaseId })
  return read
}

export function selectSfDecisionResultBatch(references: readonly string[], context: TrustedDomainContext, skip: (index: number) => boolean) {
  const refs = [...references]
  const read = (state: Readonly<SfProductState>, authority: SfStateAuthority) => {
    if (authority.principalRef !== context.binding.principalRef || authority.policyVersion !== context.binding.policyVersion || authority.accessRevision !== context.binding.accessRevision) return undefined
    return refs.map((resultRef, index) => {
      if (skip(index)) return undefined
      const stored = state.decisionResults?.[resultRef]
      return stored ? { stored, current: state.cases[stored.caseRef.id] } : undefined
    })
  }
  registerResultRead(read, context, { references: refs, skip })
  return read
}

function registerResultRead(read: object, context: TrustedDomainContext, selection: ResultSelection) {
  const binding = Object.getOwnPropertyDescriptor(context, "binding")
  // A mutable context or accessor retains the opaque full-clone path; the
  // predicate is evaluated at the original callback observation, not cached.
  if (!Object.isFrozen(context) || !binding || !("value" in binding) || !binding.value || typeof binding.value !== "object" || !Object.isFrozen(binding.value) ||
    !selection.references.every((ref) => typeof ref === "string") ||
    !["principalRef", "policyVersion", "accessRevision"].every((key) => {
      const field = Object.getOwnPropertyDescriptor(binding.value, key)
      return !!field && "value" in field && typeof field.value === "string"
    })) return
  resultReads.set(read, selection)
}

function projectResultRead(state: SfProductState, selection: ResultSelection): SfProductState | undefined {
  const casesField = Object.getOwnPropertyDescriptor(state, "cases")
  const resultsField = Object.getOwnPropertyDescriptor(state, "decisionResults")
  if (!casesField?.enumerable || !("value" in casesField) || !resultsField?.enumerable || !("value" in resultsField)) return undefined
  const plain = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))
  if (!plain(casesField.value) || !plain(resultsField.value)) return undefined
  const cases = casesField.value
  const results = resultsField.value
  const chosenCases: Record<string, unknown> = Object.create(null)
  const chosenResults: Record<string, unknown> = Object.create(null)
  for (const [index, ref] of selection.references.entries()) {
    if (selection.skip?.(index)) continue
    const field = Object.getOwnPropertyDescriptor(results, ref)
    if (!field) { if (ref in results || ref in Object.prototype) return undefined }
    else {
      if (!field.enumerable || !("value" in field)) return undefined
      chosenResults[ref] = field.value
    }
    const stored = field && "value" in field ? field.value : undefined
    const caseId = (() => {
      if (selection.fixedCaseId !== undefined) return selection.fixedCaseId
      if (stored === undefined) return undefined
      if (!plain(stored)) return null
      const caseRef = Object.getOwnPropertyDescriptor(stored, "caseRef")
      if (!caseRef?.enumerable || !("value" in caseRef) || !plain(caseRef.value)) return null
      const id = Object.getOwnPropertyDescriptor(caseRef.value, "id")
      return id?.enumerable && "value" in id && typeof id.value === "string" ? id.value : null
    })()
    if (caseId === null) return undefined
    if (caseId === undefined) continue
    const current = Object.getOwnPropertyDescriptor(cases, caseId)
    if (!current) { if (caseId in cases || caseId in Object.prototype) return undefined; continue }
    if (!current.enumerable || !("value" in current)) return undefined
    chosenCases[caseId] = current.value
  }
  // Clone one joint selected graph to retain aliases, structuredClone errors,
  // getter behaviour *inside* selected records and cross-occurrence separation.
  // Durable SQLite snapshots have plain cloneable root maps; unsafe selected
  // descriptors, inherited fields and legacy state take the original path.
  return structuredClone({ cases: chosenCases, decisionResults: chosenResults }) as unknown as SfProductState
}


/** Only this factory-owned callback may omit unrelated namespaces from a clone.
 * All result envelopes remain one graph; filtering still occurs after cloning. */
const scenarioReads = new WeakMap<object, {
  project: (decisionResults: SfProductState["decisionResults"], authority: SfStateAuthority) => NonNullable<SfProductState["decisionResults"]>[string][] | undefined
}>()

export function selectSfScenarioCandidates(request: { caseRef: { id: string; incarnation: string; version: number } }, requestDigest: string, resultDigest: string, context: TrustedDomainContext) {
  const read = (state: Pick<SfProductState, "decisionResults">, authority: SfStateAuthority) =>
    authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? Object.values(state.decisionResults ?? {}).filter((item) => item.kind === "scenario" && item.caseRef.id === request.caseRef.id && item.caseRef.incarnation === request.caseRef.incarnation && item.caseRef.version <= request.caseRef.version && item.requestDigest === requestDigest && item.resultDigest === resultDigest) : undefined
  // Do not snapshot the caller's mutable request or invoke proxy traps during
  // registration. The original predicate observes both after C08 admission.
  if (types.isProxy(context)) return read
  const binding = Object.getOwnPropertyDescriptor(context, "binding")
  if (Object.isFrozen(context) && binding && "value" in binding && binding.value && typeof binding.value === "object" && !types.isProxy(binding.value) && Object.isFrozen(binding.value) &&
    ["principalRef", "policyVersion", "accessRevision"].every((key) => {
      const field = Object.getOwnPropertyDescriptor(binding.value, key)
      return !!field && "value" in field && typeof field.value === "string"
    })) scenarioReads.set(read, { project: (decisionResults, authority) => read({ decisionResults }, authority) })
  return read
}

function scenarioResultMap(state: SfProductState) {
  if (types.isProxy(state)) return undefined
  const field = Object.getOwnPropertyDescriptor(state, "decisionResults")
  if (!field?.enumerable || !("value" in field) || !field.value || typeof field.value !== "object" || Array.isArray(field.value) || types.isProxy(field.value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(field.value))) return undefined
  return field.value as NonNullable<SfProductState["decisionResults"]>
}


type CaseIdentity = Pick<SfProductState["cases"][string], "id" | "incarnation" | "version">
const caseIdentityReads = new WeakMap<object, {
  project: (cases: SfProductState["cases"], actor: SfStateAuthority) => CaseIdentity | undefined
}>()

/** Current case membership only; the consumer retains its own Request and scope fences. */
export function selectSfCaseIdentity(captured: CaseIdentity, call: TrustedDomainContext) {
  const read = (state: Pick<SfProductState, "cases">, actor: SfStateAuthority) => {
    const value = state.cases[captured.id]
    return value && value.incarnation === captured.incarnation && value.version === captured.version && value.participants.includes(actor.principalRef) &&
      actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion
      ? { id: value.id, incarnation: value.incarnation, version: value.version } : undefined
  }
  // Preserve the original observation of captured and call inside the C08
  // callback. Registration recognizes code and immutable data context only.
  if (types.isProxy(call)) return read
  const binding = Object.getOwnPropertyDescriptor(call, "binding")
  if (Object.isFrozen(call) && binding && "value" in binding && binding.value && typeof binding.value === "object" && !types.isProxy(binding.value) && Object.isFrozen(binding.value) &&
    ["principalRef", "policyVersion", "accessRevision"].every((key) => {
      const field = Object.getOwnPropertyDescriptor(binding.value, key)
      return !!field && "value" in field && typeof field.value === "string"
    })) caseIdentityReads.set(read, { project: (cases, actor) => read({ cases }, actor) })
  return read
}

function caseIdentityMap(state: SfProductState) {
  if (types.isProxy(state)) return undefined
  const field = Object.getOwnPropertyDescriptor(state, "cases")
  if (!field?.enumerable || !("value" in field) || !field.value || typeof field.value !== "object" || Array.isArray(field.value) || types.isProxy(field.value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(field.value))) return undefined
  return field.value as SfProductState["cases"]
}

const productStateReaders = new WeakMap<SfProductStatePort, (persistence: Persistence) => boolean>()
const productSnapshotReads = new WeakMap<object, (transaction: object) => boolean>()
const productSnapshotSelections = new WeakMap<object, (transaction: object) => "cases" | "preferences" | "case-identities" | "decisionResults" | undefined>()
const selectionGet = WeakMap.prototype.get, selectionSet = WeakMap.prototype.set, selectionApply = Reflect.apply
const selectionValue = <T>(registry: WeakMap<object, T>, read: object): T | undefined =>
  selectionApply(selectionGet, registry, [read])

// Only closed factories and explicit whole-graph declarations may narrow the
// native copy. Scenario candidates retain the entire decisionResults collection;
// never inspect IDs, filter envelopes or run selectors before authorization.
function productReadSelection(namespace: SfStateNamespace, read: object) {
  if (selectionValue(readinessReads, read)) return undefined
  if (namespace === "cases" && !selectionValue(resultReads, read) && !selectionValue(scenarioReads, read)) {
    const selected = selectionValue(caseReads, read), graph = selectionValue(caseGraphReads, read)
    const identity = selectionValue(caseIdentityReads, read)
    // Concurrent declarations retain the full path; later registration invalidates
    // an already materialized selection instead of changing its callback route.
    if (selected ? !graph && !identity : !identity && graph === read) return "cases" as const
    if (identity && !selected && !graph) return "case-identities" as const
  }
  if (namespace === "cases" && selectionValue(scenarioReads, read) && !selectionValue(caseReads, read) &&
    !selectionValue(resultReads, read) && !selectionValue(caseGraphReads, read) && !selectionValue(caseIdentityReads, read))
    return "decisionResults" as const
  if (namespace === "preferences" && selectionValue(preferencesReads, read) === read) return "preferences" as const
  return undefined
}

/** A finite read-set query, never a callback registrar or a snapshot reader. */
export function sfProductSnapshotReadSelection(work: object, transaction: unknown) {
  if (typeof transaction !== "function") return undefined
  return selectionValue(productSnapshotSelections, work)?.(transaction)
}

/** Only this factory's closed C08 read body can request the fixed native view. */
export function isSfProductSnapshotRead(work: object, transaction: object) {
  return productSnapshotReads.get(work)?.(transaction) === true
}

/** Authenticate the original read callback and its exact snapshot provider. */
export function isSfProductStateReader(port: SfProductStatePort, persistence: Persistence) {
  return productStateReaders.get(port)?.(persistence) === true
}

/** The caller composes current product authority; a Dashboard role never grants it implicitly. */
export function createSfProductState(input: {
  persistence: Persistence
  stagedReviewThreadTarget?: string
  reviewArtifactPersistence?: AssetPersistence
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
  const artifacts = input.reviewArtifactPersistence
  const assetTransaction = artifacts?.transaction
  const artifactFence = () => artifacts && assetTransaction && input.reviewArtifactPersistence === artifacts &&
    artifacts.transaction === assetTransaction && Object.is(artifacts, input.persistence) &&
    hasSfDashboardSourceFence(input.persistence) ? input.persistence.dashboardSourceFence : undefined
  const plainInput = !types.isProxy(input) && Object.getPrototypeOf(input) === Object.prototype
  const readerAuthority = plainInput ? Object.getOwnPropertyDescriptor(input, "authorize") : undefined
  const readerPersistence = plainInput ? Object.getOwnPropertyDescriptor(input, "persistence") : undefined
  const projectionCurrent = () => {
    if (!readerAuthority || !Object.hasOwn(readerAuthority, "value") || !isSfAclStateAuthorize(readerAuthority.value) ||
      !readerPersistence || !Object.hasOwn(readerPersistence, "value") || !readerPersistence.value ||
      typeof readerPersistence.value !== "object" || types.isProxy(readerPersistence.value) ||
      Object.getPrototypeOf(readerPersistence.value) !== Object.prototype || types.isProxy(input) ||
      Object.getPrototypeOf(input) !== Object.prototype) return false
    const authority = Object.getOwnPropertyDescriptor(input, "authorize")
    const persistence = Object.getOwnPropertyDescriptor(input, "persistence")
    return !!authority && Object.hasOwn(authority, "value") && authority.value === readerAuthority.value &&
      !!persistence && Object.hasOwn(persistence, "value") && persistence.value === readerPersistence.value &&
      isSfProductStateReader(port, persistence.value)
  }
  const productRead = <T>(work: (snapshot: Snapshot) => Promise<{ commit: boolean; value: SfStateResult<T> }>, namespace: SfStateNamespace, read: object) => {
    productSnapshotReads.set(work, (transaction) => {
      if (!projectionCurrent()) return false
      const method = Object.getOwnPropertyDescriptor(readerPersistence!.value, "transaction")
      return !!method && Object.hasOwn(method, "value") && method.value === transaction
    })
    selectionApply(selectionSet, productSnapshotSelections, [work, (transaction: object) =>
      isSfProductSnapshotRead(work, transaction) ? productReadSelection(namespace, read) : undefined])
    return linkSfE16Work(currentSfE16Route(), "provider-read", work, read)
  }
  const port: SfProductStatePort = {
    read: <T>(request: Request, namespace: SfStateNamespace, read: (state: Readonly<SfProductState>, authority: SfStateAuthority) => T | Promise<T>) =>
      input.persistence.transaction<SfStateResult<T>>("dashboard", productRead<T>(async (snapshot) => {
        const projection = observeLocalProductRead(snapshot)
        const selectionCurrent = () => !projection?.selection || productReadSelection(namespace, read) === projection.selection
        if (projection && (!projectionCurrent() || !projection.current() || !selectionCurrent()))
          return { commit: false, value: { status: "denied", reason: "product-authority-changed" } }
        const candidate = readinessReads.get(read)
        const readiness = candidate?.namespace === namespace ? candidate : undefined
        const mode = readiness?.mode ?? "read"
        const authority = await input.authorize(request, snapshot, namespace, mode)
        if (!authority) return { commit: false, value: { status: "denied", reason: "product-access-unavailable" } }
        if (projection && (!projectionCurrent() || !projection.current() || !selectionCurrent()))
          return { commit: false, value: { status: "denied", reason: "product-authority-changed" } }
        const state = readSfState(snapshot)
        if (!state) return { commit: false, value: { status: "unavailable", reason: snapshot.data.__sfProductV1 === undefined ? "product-state-uninitialized" : "invalid-product-state" } }
        const selection = namespace === "cases" ? caseReads.get(read) : undefined
        const cases = selection ? caseIdentityMap(state) : undefined
        const selected = selection && cases ? Object.getOwnPropertyDescriptor(cases, selection.id) : undefined
        const resultSelection = namespace === "cases" ? resultReads.get(read) : undefined
        const selectedResults = resultSelection ? projectResultRead(state, resultSelection) : undefined
        const casesSelection = namespace === "cases" ? caseGraphReads.get(read) : undefined
        let selectedCases: Pick<SfProductState, "cases"> | undefined
        const preferencesSelection = namespace === "preferences" ? preferencesReads.get(read) : undefined
        let selectedPreferences: Pick<SfProductState, "preferences"> | undefined
        const scenarioSelection = namespace === "cases" ? scenarioReads.get(read) : undefined
        const scenarioResults = scenarioSelection ? scenarioResultMap(state) : undefined
        const identitySelection = namespace === "cases" ? caseIdentityReads.get(read) : undefined
        const identityCases = identitySelection ? caseIdentityMap(state) : undefined
        const persistence = input.persistence
        const authorityOnly = namespace === "reviews" ? reviewAuthorityReads.get(read) : undefined
        const fence = namespace === "reviews" && (authorityOnly || reviewReceiptReads.has(read)) && hasSfDashboardSourceFence(persistence)
          ? persistence.dashboardSourceFence : undefined
        const seal = fence?.observeAuthority?.([])
        const sealCurrent = () => !!seal && seal.current() && input.persistence === persistence &&
          persistence.dashboardSourceFence === fence && hasSfDashboardSourceFence(persistence)
        const sealed = sealCurrent()
        const receipts = sealed && !authorityOnly ? structuredClone({ reviews: state.reviews, transactions: state.transactions }) as SfProductState : undefined
        // A reduced native view must never reach the opaque callback branch.
        // Recheck the actual precedence after admission, then keep the existing
        // fresh selected clone and callback at this original observation point.
        if (projection?.selection) {
          if (!selectionCurrent() || (tapSfE16ProviderSelection(read, projection.selection) === "cases"
            ? readiness || resultSelection || scenarioSelection ||
              (selection ? casesSelection || identitySelection : identitySelection ? casesSelection : casesSelection !== read)
            : projection.selection === "case-identities"
            ? readiness || selection || resultSelection || casesSelection || scenarioSelection || !identitySelection
            : projection.selection === "decisionResults"
            ? readiness || selection || resultSelection || casesSelection || !scenarioSelection || identitySelection
            : readiness || preferencesSelection !== read))
            return { commit: false, value: { status: "denied", reason: "product-authority-changed" } }
          if (projection.selection === "cases" && casesSelection === read) selectedCases = projectCasesRead(state)
          if (projection.selection === "preferences") selectedPreferences = projectPreferencesRead(state)
          if (projection.selection === "cases" ? selection ? !cases : identitySelection ? !identityCases : !selectedCases
            : projection.selection === "case-identities" ? !identityCases
            : projection.selection === "decisionResults" ? !scenarioResults : !selectedPreferences)
            return { commit: false, value: { status: "denied", reason: "product-authority-changed" } }
        }
        // Keep missing/inherited, accessor and malformed lookups on the original
        // path. Durable SQLite snapshots contain plain cloneable data.
        const value = readiness
          ? structuredClone(readiness.select(state, authority)) as T
          : selection && selected?.enumerable && "value" in selected && selected.value &&
          typeof selected.value === "object" && !Array.isArray(selected.value)
          ? await selection.project({ [selection.id]: structuredClone(selected.value) }, authority) as T
          : selectedResults ? await read(selectedResults, authority)
          : casesSelection && (selectedCases ??= projectCasesRead(state))
          ? await casesSelection(selectedCases, authority) as T
          : preferencesSelection && (selectedPreferences ??= projectPreferencesRead(state))
          ? await preferencesSelection(selectedPreferences, authority) as T
          : scenarioSelection && scenarioResults ? await scenarioSelection.project(structuredClone(scenarioResults), authority) as T
          : identitySelection && identityCases ? await identitySelection.project(structuredClone(identityCases), authority) as T
          : sealed && authorityOnly ? await authorityOnly(authority) as T
          // Missing or malformed single-case entries keep the factory's original
          // cases lookup; a reduced view can never fall through to an opaque read.
          : projection?.selection === "cases" && selection
          ? await selection.project(structuredClone(cases!), authority) as T
          : await read(receipts ?? structuredClone(state), authority)
        if (sealed && !sealCurrent()) return { commit: false, value: { status: "denied", reason: "product-authority-changed" } }
        if (request.signal.aborted) return { commit: false, value: { status: "unavailable", reason: "cancelled" } }
        if (projection && (!projectionCurrent() || !projection.current() || !selectionCurrent()))
          return { commit: false, value: { status: "denied", reason: "product-authority-changed" } }
        const current = await input.authorize(request, snapshot, namespace, mode)
        if (!sameAuthority(authority, current) || sealed && !sealCurrent() || projection && (!projectionCurrent() || !projection.current() || !selectionCurrent()))
          return { commit: false, value: { status: "denied", reason: "product-authority-changed" } }
        return { commit: false, value: { status: "ok", storageVersion: state.versions[namespace], aggregateRevision: state.revision, incarnation: state.incarnation, value } }
      }, namespace, read), { signal: request.signal, ...(input.stagedReviewThreadTarget && hasSfDashboardSourceFence(input.persistence)
        ? { targetPreimageCurrent: input.persistence.dashboardSourceFence?.holdTargetPreimage().current, sealedRead: true } : {}) }),
    transaction: <T>(request: Request, command: SfStateMutation, work: (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => Promise<{ commit: boolean; value: T }>) => {
      if (command.idempotencyKey.startsWith(abortJournalPrefix) && !abortJournalWrites.has(work))
        return Promise.resolve({ status: "denied", reason: "transaction-abort-writer-required" })
      const rollback: { observation?: object; command?: SfStateMutation; envelope?: SfConfirmedTransactionAbort["envelope"] } = {}
      const run = async (snapshot: Snapshot, domain: Snapshot, releasePreimage?: () => void): Promise<{ commit: boolean; value: SfStateResult<T> }> => {
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
        if (command.namespace === "receipts" && command.domainSurface) {
          rollback.observation = observeLocalTransactionAbort(snapshot)
          rollback.command = structuredClone(command)
          rollback.envelope = { incarnation: state.incarnation, aggregateRevision: state.revision, versions: structuredClone(state.versions) }
        }
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
        releasePreimage?.()
        snapshot.data.__sfProductV1 = staged
        return { commit: true, value: { status: "ok", storageVersion: staged.versions[command.namespace], aggregateRevision: staged.revision, incarnation: staged.incarnation, value: result.value } }
      }
      const artifact = stagedReviewArtifactWrites.get(work)
      if (artifact) {
        const atomic = artifactFence()
        if (!atomic || !artifacts || !assetTransaction || !atomic.current() ||
            command.namespace !== "documents" || command.targetRef !== input.stagedReviewThreadTarget || command.domainSurface ||
            command.sourceFence || command.additionalNamespaces?.length || command.checkNamespaces?.length)
          return Promise.resolve({ status: "denied", reason: "report-blob-storage-unavailable" })
        const preimage = atomic.holdTargetPreimage()
        const current = () => artifactFence() === atomic && !request.signal.aborted
        return artifacts.transaction<SfStateResult<T>>("dashboard", async (snapshot, blobs) => {
          if (!current()) return { commit: false, value: { status: "denied", reason: "report-blob-storage-unavailable" } }
          const result = await run(snapshot, snapshot, preimage.release)
          if (!result.commit) return result
          const stored = object(object(object(snapshot.data.__sfProductV1).documents)[artifact.ref])
          if (!current() || stored.kind !== "sf-review-artifact-v2" || stored.byteLength !== artifact.bytes.byteLength ||
              stored.digest !== artifact.digest || stored.mediaType !== artifact.mediaType)
            throw new Error("SF_REPORT_BLOB_METADATA_CHANGED")
          const key = sfReviewArtifactBlobKey(artifact.ref)
          if (await blobs.get(key)) throw new Error("SF_REPORT_BLOB_ALREADY_EXISTS")
          await blobs.put(key, artifact.bytes, artifact.mediaType)
          if (!current()) throw new Error("SF_REPORT_BLOB_STORAGE_CHANGED")
          return result
        }, { signal: request.signal, targetPreimageCurrent: preimage.current })
      }
      if (command.sourceFence === "all" || command.namespace === "documents" || command.additionalNamespaces?.some((entry) => entry.namespace === "documents") || command.checkNamespaces?.some((entry) => entry.namespace === "documents") || command.domainSurface) {
        if (!input.persistence.transactionAll) return Promise.resolve({ status: "unavailable", reason: "cross-surface-transaction-unavailable" })
        const atomic = hasSfDashboardSourceFence(input.persistence) ? input.persistence.dashboardSourceFence : undefined
        if (atomic && input.stagedReviewThreadTarget === command.targetRef && stagedReviewThreadWrites.has(work) &&
          command.namespace === "threads" && command.sourceFence === "all" && command.domainSurface === undefined &&
          !command.additionalNamespaces?.length && command.checkNamespaces?.length === 1 && command.checkNamespaces[0]?.namespace === "reviews" &&
          atomic.current()) {
          const preimage = atomic.holdTargetPreimage()
          const persistence = input.persistence
          const current = () => input.persistence === persistence && persistence.dashboardSourceFence === atomic && hasSfDashboardSourceFence(persistence)
          const changed = () => ({ commit: false, value: { status: "denied" as const, reason: "product-authority-changed" } })
          return atomic.transaction("dashboard", async (snapshot) => {
            if (!current()) return changed()
            const result = await run(snapshot, snapshot, () => {
              if (!current()) throw new Error("SF_STAGED_THREAD_STORAGE_CHANGED")
              preimage.release()
            })
            return current() ? result : changed()
          }, {
            signal: request.signal, targetPreimageCurrent: preimage.current,
          })
        }
        const surface = command.domainSurface ?? "dashboard"
        return input.persistence.transactionAll((snapshots) => run(snapshots.dashboard, snapshots[surface]), { signal: request.signal }).catch((error: unknown): SfStateResult<T> => {
          const proof = rollback.observation && consumeLocalTransactionAbort(rollback.observation, error)
          if (!proof || !rollback.command || !rollback.envelope || digestSfValue(rollback.command) !== digestSfValue(command)) throw error
          const result = { status: "unavailable" as const, reason: "transaction-rolled-back" }
          transactionAborts.set(result, { state: port, request, proof: { ...proof, command: rollback.command, envelope: rollback.envelope } })
          return result
        })
      }
      return input.persistence.transaction("dashboard", linkSfE16Work(currentSfE16Route(), "provider-write", (snapshot: Snapshot) => run(snapshot, snapshot)), { signal: request.signal })
    },
  }
  if (artifactFence() && artifacts) {
    reviewArtifactBlobReaders.set(port, (request, ref, metadataDigest, expected) => {
      const atomic = artifactFence()
      if (!atomic || request.signal.aborted) return Promise.resolve(undefined)
      const current = () => artifactFence() === atomic && !request.signal.aborted
      return artifacts.transaction("dashboard", async (snapshot, blobs) => {
        const admitted = await input.authorize(request, snapshot, "documents", "read")
        const metadata = readSfState(snapshot)?.documents[ref]
        if (!current() || !sameAuthority(expected, admitted) || digestSfValue(metadata) !== metadataDigest)
          return { commit: false, value: undefined }
        const bytes = await blobs.get(sfReviewArtifactBlobKey(ref))
        const latest = await input.authorize(request, snapshot, "documents", "read")
        return { commit: false, value: current() && sameAuthority(expected, latest) ? bytes : undefined }
      }, { signal: request.signal, sealedRead: true, targetPreimageCurrent: atomic.holdTargetPreimage().current })
    })
  }
  if (!types.isProxy(input) && Object.getPrototypeOf(input) === Object.prototype) {
    const driver = Object.getOwnPropertyDescriptor(input, "persistence")
    const read = port.read
    if (driver && Object.hasOwn(driver, "value") && driver.value) productStateReaders.set(port, (persistence) => {
      const active = Object.getOwnPropertyDescriptor(input, "persistence")
      const method = Object.getOwnPropertyDescriptor(port, "read")
      return driver.value === persistence && Object.getPrototypeOf(input) === Object.prototype &&
        !!active && Object.hasOwn(active, "value") && active.value === persistence &&
        Object.getPrototypeOf(port) === Object.prototype && !!method && Object.hasOwn(method, "value") && method.value === read
    })
  }
  if (hasSfDashboardSourceFence(input.persistence)) {
    installedStateReads.add(port.read)
    installedStateTransactions.set(port.read, port.transaction)
  }
  return port
}

function sameAuthority(expected: SfStateAuthority, current: SfStateAuthority | undefined) {
  return current?.principalRef === expected.principalRef && current.accessRevision === expected.accessRevision && current.policyVersion === expected.policyVersion
}

/**
 * One-time installation schema bootstrap. Materializes a real, durable empty
 * product namespace before the first native read; never manufactures a user,
 * role, case or grant, and never repairs an invalid existing product state.
 * Called only after configured installation and source initialization.
 */
export async function initializeAbsentSfProductState(
  persistence: Pick<Persistence, "transaction">,
  createId: () => string,
): Promise<void> {
  await persistence.transaction("dashboard", async (snapshot) => {
    if (snapshot.data.__sfProductV1 !== undefined) {
      if (!readSfState(snapshot)) throw new Error("SF_PRODUCT_BOOTSTRAP_EXISTING_STATE_INVALID")
      return { commit: false, value: undefined }
    }
    const initial = emptySfState(createId())
    if (!initial) throw new Error("SF_PRODUCT_BOOTSTRAP_INVALID_INCARNATION")
    snapshot.data.__sfProductV1 = initial
    return { commit: true, value: undefined }
  })
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

/**
 * Private recovery comparison only. This contains digests and monotone metadata,
 * never an access grant or a receipt that can authorize replay.
 */
export function inspectSfProductRestoreFrontier(snapshot: Snapshot) {
  if (snapshot.data.__sfProductV1 === undefined) return undefined
  const state = readSfState(snapshot)
  if (!state) throw new Error("SF_RESTORE_CURRENT_PRODUCT_FRONTIER_INVALID")
  return Object.freeze({
    incarnation: state.incarnation, revision: state.revision,
    versions: Object.freeze({ ...state.versions }),
    transactions: Object.freeze(Object.entries(state.transactions)
      .map(([key, value]) => Object.freeze({ key: digestSfValue(key), value: digestSfValue(value) }))
      .sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
  })
}
