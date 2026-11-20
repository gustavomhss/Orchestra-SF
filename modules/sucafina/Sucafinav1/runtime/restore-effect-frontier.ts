import { createHash } from "node:crypto"
import type { Snapshot } from "./contract.ts"
import { inspectSfProductRestoreFrontier } from "../product/host-binding/state-provider.ts"

/**
 * Deliberate recovery classes, not a generic merge of lifecycle records.
 * Current policy stays current. The coupled C08 state (including transactions,
 * native runs, confirmations, receipts, tombstones and their referenced objects)
 * stays together so an older checkpoint cannot make a consumed intention new.
 * The caller still supplies current authorization and an atomic private store.
 */
export function captureSfRestoreRetention(current: Snapshot, checkpoint: Snapshot) {
  const frontier = inspectSfProductRestoreFrontier(current)
  const before = inspectSfProductRestoreFrontier(checkpoint)
  if (before) {
    if (!frontier || before.incarnation !== frontier.incarnation || before.revision > frontier.revision)
      throw new Error("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
    const versions = new Map(Object.entries(frontier.versions))
    if (Object.entries(before.versions).some(([key, value]) => value > (versions.get(key) ?? -1)))
      throw new Error("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
    const retained = new Map(frontier.transactions.map((entry) => [entry.key, entry.value]))
    if (before.transactions.some((entry) => retained.get(entry.key) !== entry.value))
      throw new Error("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
  }
  const keys = ["roleMap", "access", "__sfProductV1"] as const
  const retained = keys.map((key) => ({
    key, present: Object.hasOwn(current.data, key), value: structuredClone(current.data[key]),
  }))
  const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex")
  return Object.freeze({
    // A mutable business attachment must not overwrite an object possibly
    // referenced by the retained coupled product state. An explicit resource
    // reconciliation is required for that conflict; absence of evidence is not permission.
    verifyBlobReplacement(existing: Uint8Array | undefined, restored: Uint8Array) {
      if (frontier && frontier.revision > 0 && existing && hash(existing) !== hash(restored))
        throw new Error("SF_RESTORE_BLOB_FRONTIER_CONFLICT")
    },
    apply(data: Record<string, unknown>) {
      for (const entry of retained) {
        if (entry.present) data[entry.key] = structuredClone(entry.value)
        else delete data[entry.key]
      }
    },
  })
}
