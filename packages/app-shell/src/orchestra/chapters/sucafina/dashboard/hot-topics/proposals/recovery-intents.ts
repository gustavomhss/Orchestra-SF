import type { SfContextHandle } from "../../../context/contracts"
import type { CaseRef } from "./private-draft-model"

export const SF_DASHBOARD_RECOVERY_PREFIX = "sf-ui54-recovery-v1:"
export const SF_DASHBOARD_RECOVERY_LIFETIME_MS = 5 * 60_000
export type SfDashboardRecoveryIntent = Readonly<{
  kind: "draft"; key: string; caseRef: CaseRef; expiresAt: number
}> | Readonly<{
  kind: "apply"; key: string; caseRef: CaseRef; choiceId: string; changeId: string; expiresAt: number
}>
export type SfDashboardRecoverySlot =
  | Readonly<{ state: "empty" }>
  | Readonly<{ state: "unavailable" }>
  | Readonly<{ state: "pending"; intent: SfDashboardRecoveryIntent; expired: boolean }>
export type SfDashboardRecoveryStore = Readonly<{
  current: () => boolean
  read: () => SfDashboardRecoverySlot
  write: (intent: SfDashboardRecoveryIntent) => boolean
  clear: (key: string) => boolean
}>
type Partition = { fingerprint: string; key: string }
const partitions = new WeakMap<SfContextHandle, Partition>()
type OwnerLease = { context: SfContextHandle; epoch: number }
let activeOwner: OwnerLease | undefined

/** F01 owns this lifetime, including routes where Dashboard is not mounted. */
export function bindSfDashboardRecoveryOwner(context: SfContextHandle): () => void {
  const lease: OwnerLease = { context, epoch: 0 }
  activeOwner = lease
  return () => {
    if (activeOwner !== lease) return
    clearSfDashboardRecovery(context)
    activeOwner = undefined
  }
}
const keyPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i

function fingerprint(context: SfContextHandle): string | undefined {
  const state = context.state()
  if (state.status !== "ready" || !context.ready()) return
  const stamp = state.context.stamp
  return JSON.stringify([state.owner.serverKey, state.owner.publicOrigin, state.binding.mount,
    stamp.installationId, stamp.projectId, stamp.hostId, stamp.principalRef, stamp.policyVersion, stamp.accessRevision])
}

/** Only opaque original correlation is persisted. Neither JSON bodies, private
 * fields, review proofs, authority, source refs nor receipts belong in storage.
 * Expiry blocks use of the selector; it never authorizes a replacement mutation.
 */
export async function openSfDashboardRecovery(context: SfContextHandle): Promise<SfDashboardRecoveryStore | undefined> {
  const lease = activeOwner, observed = fingerprint(context), generation = context.generation()
  if (!lease || lease.context !== context || !observed) return
  const epoch = lease.epoch
  const admitted = () => activeOwner === lease && lease.epoch === epoch &&
    context.generation() === generation && fingerprint(context) === observed
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(observed))
  if (!admitted()) return
  const key = SF_DASHBOARD_RECOVERY_PREFIX + [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
  // A new JavaScript owner after a reload has no WeakMap history. Purge this
  // tab's other owner partitions before any chapter can release a mutation.
  if (!purgeOtherPartitions(key) || !admitted()) return
  const partition = { fingerprint: observed, key }
  partitions.set(context, partition)
  const current = () => admitted() && partitions.get(context)?.key === key
  const read = (): SfDashboardRecoverySlot => {
    if (!current()) return { state: "unavailable" }
    try {
      const raw = sessionStorage.getItem(key)
      if (raw === null) return { state: "empty" }
      const intent = decodeIntent(JSON.parse(raw))
      return intent ? { state: "pending", intent, expired: Date.now() >= intent.expiresAt } : { state: "unavailable" }
    } catch { return { state: "unavailable" } }
  }
  return {
    current, read,
    write: (intent) => {
      const decoded = decodeIntent(intent)
      if (!current() || !decoded || Date.now() >= decoded.expiresAt) return false
      const encoded = JSON.stringify(decoded), previous = read()
      if (previous.state !== "empty" && (previous.state !== "pending" ||
        JSON.stringify(previous.intent) !== encoded)) return false
      try {
        sessionStorage.setItem(key, encoded)
        const saved = read()
        return saved.state === "pending" && !saved.expired && JSON.stringify(saved.intent) === encoded
      } catch { return false }
    },
    clear: (originalKey) => {
      const previous = read()
      if (previous.state !== "pending" || previous.intent.key !== originalKey) return false
      return remove(key)
    },
  }
}

/** Mounted F01 calls this even when the Dashboard chapter is not mounted. */
export function reconcileSfDashboardRecovery(context: SfContextHandle): void {
  if (activeOwner?.context !== context) return
  const state = context.state(), previous = partitions.get(context), observed = fingerprint(context)
  if (previous && observed && previous.fingerprint !== observed) {
    remove(previous.key); partitions.delete(context)
  }
  if (state.status === "denied" || state.status === "context-mismatch" || state.status === "unauthenticated") {
    clearSfDashboardRecovery(context)
    return
  }
  // Run for every admitted F01 owner, even before Dashboard is visited. The
  // lease, generation and exact owner stamp are rechecked after hashing.
  if (observed) void openSfDashboardRecovery(context).catch(() => undefined)
}

export function clearSfDashboardRecovery(context: SfContextHandle): void {
  partitions.delete(context)
  if (activeOwner?.context !== context) return
  activeOwner.epoch += 1
  // Denial or logout may happen before this owner's partition was hashed.
  // Removing every tab-local selector prevents resurrection after regrant.
  purgeOtherPartitions()
}

function purgeOtherPartitions(retain?: string): boolean {
  try {
    const keys = Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index))
    for (const key of keys) {
      if (key?.startsWith(SF_DASHBOARD_RECOVERY_PREFIX) && key !== retain && !remove(key)) return false
    }
    return true
  } catch { return false }
}

function remove(key: string): boolean {
  try { sessionStorage.removeItem(key); return sessionStorage.getItem(key) === null }
  catch { return false }
}
function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}
function decodeIntent(value: unknown): SfDashboardRecoveryIntent | undefined {
  const row = object(value), ref = object(row?.caseRef)
  if (!row || !ref || !keyPattern.test(String(row.key)) || !Number.isSafeInteger(row.expiresAt) || Number(row.expiresAt) < 1 ||
    Object.keys(ref).sort().join(",") !== "id,incarnation,version" || typeof ref.id !== "string" || !ref.id ||
    typeof ref.incarnation !== "string" || !ref.incarnation || !Number.isSafeInteger(ref.version) || Number(ref.version) < 1) return
  const caseRef = { id: ref.id, incarnation: ref.incarnation, version: Number(ref.version) }
  if (row.kind === "draft" && Object.keys(row).sort().join(",") === "caseRef,expiresAt,key,kind")
    return { kind: "draft", key: String(row.key), caseRef, expiresAt: Number(row.expiresAt) }
  if (row.kind === "apply" && Object.keys(row).sort().join(",") === "caseRef,changeId,choiceId,expiresAt,key,kind" &&
    typeof row.choiceId === "string" && !!row.choiceId && typeof row.changeId === "string" && !!row.changeId)
    return { kind: "apply", key: String(row.key), caseRef, choiceId: row.choiceId, changeId: row.changeId, expiresAt: Number(row.expiresAt) }
}
