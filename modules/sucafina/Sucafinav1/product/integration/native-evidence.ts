import { object } from "../../runtime/contract.ts"
import type { Persistence } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { SfProductStatePort, SfStateAuthority } from "../contracts/state.ts"
import type { TrustedExecutionBinding } from "../contracts/sf-execution.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"

export type SfNativeReservation = {
  sessionID: string
  runId: string
  caseRef: { id: string; incarnation: string; version: number }
  manifestDigest: string
  profileId: TrustedExecutionBinding["profileId"]
}

export type SfDurableTokenCount = {
  schema: "sf-token-count-v1"
  oracle: "https://api.openai.com/v1/responses/input_tokens"
  model: string
  inputDigest: string
  requestDigest: string
  inputTokens: number
  contextBudgetTokens: number
  maxOutputTokens: number
  observedAt: string
}

/** Private C08 metadata. Preferences exposed to a user must select their own explicit keys. */
export function createSfNativeEvidenceStore(input: {
  state: SfProductStatePort
  /** The same root-private set supplied to createSfProductState. */
  nativeEvidenceWrites: WeakSet<object>
  persistence: Persistence
  requestForRun: (runId: string) => Request | undefined
  authorizeRun: (reservation: SfNativeReservation, authority: SfStateAuthority) => Promise<boolean>
  authorizeBinding: (binding: TrustedExecutionBinding) => Promise<boolean>
  createId: () => string
}) {
  const keyFor = (sessionID: string) => `sf:native-session:${sessionID}`
  const transaction: SfProductStatePort["transaction"] = (request, command, work) => {
    input.nativeEvidenceWrites.add(work)
    return input.state.transaction(request, command, work).finally(() => input.nativeEvidenceWrites.delete(work))
  }
  return {
    // This read only classifies a denial. It never restores a Request, binding or execution permission.
    isSfOwned: (sessionID: string) => input.persistence.transaction("dashboard", async (snapshot) => {
      const stored = snapshot.data.__sfProductV1
      if (stored === undefined) return { commit: false, value: false }
      const state = object(stored)
      if (state.schemaVersion !== 1 || !Number.isSafeInteger(state.revision) || !state.preferences || typeof state.preferences !== "object" || Array.isArray(state.preferences)) throw new Error("SF_NATIVE_OWNERSHIP_STORAGE_INVALID")
      return { commit: false, value: Object.hasOwn(state.preferences, keyFor(sessionID)) }
    }),
    reserveSession: async (requested: SfNativeReservation) => {
      const reservation = structuredClone(requested)
      if (![reservation.sessionID, reservation.runId, reservation.caseRef.id, reservation.caseRef.incarnation].every((value) => typeof value === "string" && value.trim()) || !Number.isSafeInteger(reservation.caseRef.version) || reservation.caseRef.version < 1 || !/^[a-f0-9]{64}$/.test(reservation.manifestDigest)) throw new Error("SF_NATIVE_RESERVATION_INVALID")
      const request = input.requestForRun(reservation.runId)
      if (!request || request.signal.aborted) throw new Error("SF_NATIVE_REQUEST_UNAVAILABLE")
      const before = await input.state.read(request, "preferences", (_state, authority) => authority)
      if (before.status !== "ok") throw new Error("SF_NATIVE_STORAGE_UNAVAILABLE")
      if (!await input.authorizeRun(reservation, before.value)) throw new Error("SF_NATIVE_CASE_UNAVAILABLE")
      const targetRef = encodeCaseRef(reservation.caseRef)
      const saved = await transaction(request, { namespace: "preferences", expectedStorageVersion: before.storageVersion,
        targetRef, targetIncarnation: reservation.caseRef.incarnation,
        idempotencyKey: `native-reserve:${reservation.sessionID}`, commandDigest: digestSfValue(reservation),
      }, async (state, authority) => {
        const current = state.cases[reservation.caseRef.id]
        if (digestSfValue(authority) !== digestSfValue(before.value) || !current || current.incarnation !== reservation.caseRef.incarnation || current.version !== reservation.caseRef.version || !current.participants.includes(authority.principalRef)) throw new Error("SF_NATIVE_CASE_UNAVAILABLE")
        const key = keyFor(reservation.sessionID)
        // Even an identical marker from another admission is not adopted as a new reservation.
        if (Object.hasOwn(state.preferences, key)) throw new Error("SF_NATIVE_SESSION_ALREADY_RESERVED")
        state.preferences[key] = { schema: "sf-native-session-v1", reservation, principalRef: authority.principalRef,
          accessRevision: authority.accessRevision, policyVersion: authority.policyVersion, tokenReceipts: [] }
        return { commit: true, value: true }
      })
      if (saved.status !== "ok" || saved.value !== true || request.signal.aborted || !await input.authorizeRun(reservation, before.value)) throw new Error("SF_NATIVE_RESERVATION_NOT_DURABLE")
    },
    persistTokenReceipt: async (binding: TrustedExecutionBinding, requested: SfDurableTokenCount) => {
      const receipt = structuredClone(requested)
      if (receipt.schema !== "sf-token-count-v1" || receipt.oracle !== "https://api.openai.com/v1/responses/input_tokens" || !receipt.model.trim() || ![receipt.inputDigest, receipt.requestDigest].every((value) => /^[a-f0-9]{64}$/.test(value)) || ![receipt.inputTokens, receipt.contextBudgetTokens, receipt.maxOutputTokens].every(Number.isSafeInteger) || receipt.inputTokens < 0 || receipt.maxOutputTokens < 1 || receipt.contextBudgetTokens < receipt.inputTokens + receipt.maxOutputTokens || !Number.isFinite(Date.parse(receipt.observedAt))) throw new Error("SF_NATIVE_TOKEN_RECEIPT_INVALID")
      const request = input.requestForRun(binding.runId)
      if (!request || request.signal.aborted || !await input.authorizeBinding(binding)) throw new Error("SF_NATIVE_BINDING_UNAVAILABLE")
      const before = await input.state.read(request, "preferences", () => null)
      if (before.status !== "ok") throw new Error("SF_NATIVE_STORAGE_UNAVAILABLE")
      const attemptId = input.createId()
      if (!attemptId.trim()) throw new Error("SF_NATIVE_ATTEMPT_ID_UNAVAILABLE")
      const saved = await transaction(request, { namespace: "preferences", expectedStorageVersion: before.storageVersion,
        targetRef: encodeCaseRef({ id: binding.caseId, incarnation: binding.caseIncarnation }), targetIncarnation: binding.caseIncarnation,
        idempotencyKey: `native-token:${binding.nativeSessionId}:${attemptId}`, commandDigest: digestSfValue({ receipt, generation: binding.providerGeneration }),
      }, async (state, authority) => {
        const record = object(state.preferences[keyFor(binding.nativeSessionId)])
        const reservation = object(record.reservation)
        const current = state.cases[binding.caseId]
        if (record.schema !== "sf-native-session-v1" || reservation.sessionID !== binding.nativeSessionId || reservation.runId !== binding.runId || reservation.profileId !== binding.profileId || reservation.manifestDigest !== binding.manifestDigest || digestSfValue(reservation.caseRef) !== digestSfValue({ id: binding.caseId, incarnation: binding.caseIncarnation, version: binding.caseVersion }) || record.principalRef !== authority.principalRef || record.accessRevision !== authority.accessRevision || record.policyVersion !== authority.policyVersion || authority.principalRef !== binding.principalRef || authority.accessRevision !== binding.accessRevision || authority.policyVersion !== binding.policyVersion || !current || current.incarnation !== binding.caseIncarnation || current.version !== binding.caseVersion || !current.participants.includes(authority.principalRef) || !Array.isArray(record.tokenReceipts)) throw new Error("SF_NATIVE_BINDING_CHANGED")
        record.tokenReceipts.push({ attemptId, providerGeneration: binding.providerGeneration, receipt })
        return { commit: true, value: true }
      })
      if (saved.status !== "ok" || saved.value !== true || request.signal.aborted || !await input.authorizeBinding(binding)) throw new Error("SF_NATIVE_TOKEN_RECEIPT_NOT_DURABLE")
    },
  }
}
