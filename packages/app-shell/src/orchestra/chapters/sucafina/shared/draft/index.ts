import { createSignal, type Accessor } from "solid-js"
import type {
  SfEditScopeKey,
  SfIntentRef,
  SfOperationRef,
  SfOwnerKey,
  SfRef,
  SfVersion,
  SurfaceId,
} from "@orchestra/schema/sucafina/context"

export type SfDraftPhase =
  | "clean" | "dirty" | "validating" | "validation-error" | "reviewing"
  | "submitting" | "outcome-unknown" | "conflict" | "failed"

export type SfDraftIdentity =
  | Readonly<{ kind: "record"; recordRef: SfRef }>
  | Readonly<{ kind: "new"; newIntentRef: SfIntentRef }>

export type SfDraftConflict<Value> = Readonly<{
  currentVersion: SfVersion
  current: Readonly<Value>
}>

export type SfPendingOperation = Readonly<{
  operationRef: SfOperationRef
  idempotencyKey: string
  payloadDigest: string
  expectedVersion: SfVersion | null
}>

type ActiveDraft<Value> = Readonly<{
  availability: "active"
  phase: SfDraftPhase
  value: Readonly<Value>
  base: Readonly<Value> | null
  baseVersion: SfVersion | null
  dirty: boolean
  conflict: SfDraftConflict<Value> | null
  pendingOperation: SfPendingOperation | null
}>

export type SfDraftState<Value> =
  | ActiveDraft<Value>
  | Readonly<{ availability: "confirmed-without-projection"; operationRef: SfOperationRef; resultVersion: SfVersion | null }>
  | Readonly<{ availability: "quarantined"; reason: "session-expired"; dirty: boolean }>
  | Readonly<{ availability: "revoked"; reason: "logout" | "owner-changed" | "access-revoked" | "authority-changed" }>

export type SfDraftInput<Value> = Readonly<{
  ownerKey: SfOwnerKey
  editScopeKey: SfEditScopeKey
  surfaceId: SurfaceId
  identity: SfDraftIdentity
  baseVersion: SfVersion | null
  base: Readonly<Value> | null
  value: Readonly<Value>
}>

export type SfSaveConfirmation<Value> =
  | Readonly<{ kind: "projected"; operationRef: SfOperationRef; baseVersion: SfVersion; value: Readonly<Value> }>
  | Readonly<{ kind: "confirmed-without-projection"; operationRef: SfOperationRef; resultVersion: SfVersion | null }>

export type SfDraftController<Value> = Readonly<{
  snapshot: Accessor<SfDraftState<Value>>
  edit(value: Readonly<Value>): void
  discard(): void
  receiveRemote(remote: Readonly<{ baseVersion: SfVersion; value: Readonly<Value> }>): void
  setPhase(phase: SfDraftPhase): void
  setPending(operation: SfPendingOperation): void
  confirmSave(result: SfSaveConfirmation<Value>): void
  rejectSave(result: Readonly<{ status: 409 | 422; operation: SfPendingOperation }>): void
  quarantine(): void
  restoreSameAuthority(newOwnerKey: SfOwnerKey): void
  revoke(reason: "logout" | "owner-changed" | "access-revoked" | "authority-changed"): void
}>

/**
 * Pure ephemeral editor state. No data requests, persistence, permission decision
 * or producer result is inferred here. The F01 owner registry is the only caller
 * of the private quarantine/restore/revoke methods after its own revalidation.
 */
export function createSfDraft<Value>(input: SfDraftInput<Value>): SfDraftController<Value> {
  // This private reset baseline is explicitly dropped on revocation/confirmation.
  let initialValue: Readonly<Value> | undefined = input.value
  const initiallyDirty = input.identity.kind === "new" && input.base === null
  const [snapshot, publish] = createSignal<SfDraftState<Value>>({
    availability: "active",
    phase: initiallyDirty ? "dirty" : "clean",
    value: input.value,
    base: input.base,
    baseVersion: input.baseVersion,
    dirty: initiallyDirty,
    conflict: null,
    pendingOperation: null,
  }, { equals: false })

  // Never expose either the quarantined private snapshot or the owner fence.
  // Revocation erases both from this controller, including any pending intent.
  let suspended: ActiveDraft<Value> | undefined
  let outcomeUnknown = false
  let fence: Readonly<Pick<SfDraftInput<Value>, "ownerKey" | "editScopeKey" | "surfaceId" | "identity">> | undefined = {
    ownerKey: input.ownerKey,
    editScopeKey: input.editScopeKey,
    surfaceId: input.surfaceId,
    identity: input.identity,
  }

  const active = () => {
    const state = snapshot()
    return state.availability === "active" ? state : undefined
  }
  const unresolved = (state: ActiveDraft<Value>) =>
    state.pendingOperation !== null && (
      state.phase === "submitting" || state.phase === "outcome-unknown"
    )

  return {
    snapshot,
    edit(value) {
      const state = active()
      if (!state || state.pendingOperation !== null) return
      if (Object.is(state.value, value)) return
      publish({ ...state, value, dirty: true, phase: state.conflict ? "conflict" : "dirty" })
    },
    discard() {
      const state = active()
      // Discard cannot clear an unresolved submission.
      if (!state || state.pendingOperation !== null) return
      const next = state.conflict
        ? { value: state.conflict.current, version: state.conflict.currentVersion }
        : { value: state.base ?? initialValue ?? state.value, version: state.baseVersion }
      publish({
        availability: "active",
        phase: "clean",
        value: next.value,
        base: state.conflict ? next.value : state.base,
        baseVersion: next.version,
        dirty: false,
        conflict: null,
        pendingOperation: null,
      })
    },
    receiveRemote(remote) {
      const state = active()
      if (!state) return
      if (!state.dirty && state.pendingOperation === null) {
        publish({
          availability: "active", phase: "clean",
          value: remote.value, base: remote.value, baseVersion: remote.baseVersion,
          dirty: false, conflict: null, pendingOperation: null,
        })
        return
      }
      if (Object.is(remote.baseVersion, state.baseVersion)) return
      publish({
        ...state,
        conflict: { currentVersion: remote.baseVersion, current: remote.value },
        phase: unresolved(state) ? state.phase : "conflict",
      })
    },
    setPhase(phase) {
      const state = active()
      if (!state) return
      // A lost response cannot be marked failed, clean or reviewed merely by
      // presentation state changes. No automatic reenactment of the mutation.
      if (unresolved(state) && phase !== "submitting" && phase !== "outcome-unknown") return
      if ((phase === "submitting" || phase === "outcome-unknown") && !state.pendingOperation) return
      if (state.conflict && (phase === "submitting" || phase === "reviewing")) return
      if (phase === "outcome-unknown") outcomeUnknown = true
      publish({ ...state, phase })
    },
    setPending(operation) {
      const state = active()
      if (!state || state.conflict || unresolved(state)) return
      if (!operation.operationRef || !operation.idempotencyKey || !operation.payloadDigest) return
      // Bind the command fence to the exact reviewed version (including numeric
      // zero and null for a new intent); never silently coerce a stale CAS.
      if (!Object.is(operation.expectedVersion, state.baseVersion)) return
      if (state.pendingOperation) {
        // A second command cannot replace the first exact intent or its key.
        if (
          state.pendingOperation.operationRef === operation.operationRef &&
          state.pendingOperation.idempotencyKey === operation.idempotencyKey &&
          state.pendingOperation.payloadDigest === operation.payloadDigest &&
          Object.is(state.pendingOperation.expectedVersion, operation.expectedVersion)
        ) return
        return
      }
      outcomeUnknown = false
      publish({ ...state, pendingOperation: { ...operation } })
    },
    rejectSave(result) {
      const state = active(), pending = state?.pendingOperation, operation = result.operation
      if ((result.status !== 409 && result.status !== 422) || !state || state.phase !== "submitting" || !pending || outcomeUnknown ||
          pending.operationRef !== operation.operationRef || pending.idempotencyKey !== operation.idempotencyKey ||
          pending.payloadDigest !== operation.payloadDigest || !Object.is(pending.expectedVersion, operation.expectedVersion)) return
      publish({ ...state, pendingOperation: null, phase: result.status === 409 ? "conflict" : "validation-error" })
    },
    confirmSave(result) {
      const state = active()
      if (!state?.pendingOperation || state.pendingOperation.operationRef !== result.operationRef) return
      if (result.kind === "confirmed-without-projection") {
        suspended = undefined
        initialValue = undefined
        publish({ availability: "confirmed-without-projection", operationRef: result.operationRef, resultVersion: result.resultVersion })
        return
      }
      initialValue = undefined
      publish({
        availability: "active", phase: "clean",
        value: result.value, base: result.value, baseVersion: result.baseVersion,
        dirty: false, conflict: null, pendingOperation: null,
      })
    },
    quarantine() {
      const state = active()
      if (!state) return
      suspended = state
      publish({ availability: "quarantined", reason: "session-expired", dirty: state.dirty })
    },
    restoreSameAuthority(newOwnerKey) {
      if (snapshot().availability !== "quarantined" || !suspended || !fence || !newOwnerKey) return
      // Called only after F01 proves identical authority and current authorized
      // entity/field/action scope; a new authEpoch is not that proof by itself.
      fence = { ...fence, ownerKey: newOwnerKey }
      const previous = suspended
      suspended = undefined
      const wasSubmitted = unresolved(previous)
      if (wasSubmitted) outcomeUnknown = true
      publish({
        ...previous,
        pendingOperation: wasSubmitted ? previous.pendingOperation : null,
        phase: wasSubmitted ? "outcome-unknown" :
          previous.dirty ? (previous.conflict ? "conflict" : "dirty") : "clean",
      })
    },
    revoke(reason) {
      if (snapshot().availability === "revoked") return
      suspended = undefined
      initialValue = undefined
      fence = undefined
      publish({ availability: "revoked", reason })
    },
  }
}
