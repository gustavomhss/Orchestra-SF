import { createHash } from "node:crypto"
import type { Snapshot } from "./contract.ts"
import { inspectSfProductRestoreFrontier } from "../product/host-binding/state-provider.ts"
import { digestSfValue } from "../product/contracts/canonical.ts"
import { SF_PROCUREMENT_CREATE_RECEIPTS } from "../product/integration/public-state.ts"

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
    if (!frontier) throw new Error("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
    requireFrontierDominance(frontier, before)
  }
  const keys = ["roleMap", "access", "budgetLineIds", "summaries", "__sfProductV1", SF_PROCUREMENT_CREATE_RECEIPTS] as const
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

/**
 * Internal, read-only preflight. The caller must authenticate and independently
 * observe a monotonic current pin outside both snapshots and the retained frontier,
 * verify its freshness, and hold the admission boundary through restore commit.
 * Neither a recovered snapshot nor a digest supplied by it is a current pin.
 * This comparison does not authenticate, persist, or establish freshness of a pin.
 */
export function captureSfCorporateRestoreRetention(
  current: Snapshot,
  checkpoint: Snapshot,
  externallyRetained: ReturnType<typeof inspectSfProductRestoreFrontier>,
  admission: Readonly<{
    installationDigest: string
    generation: number
    pin: Readonly<{ installationDigest: string; checkpointDigest: string; generation: number; frontierDigest: string }>
  }> | undefined,
) {
  if (!externallyRetained || !admission || !admission.pin ||
      !/^[a-f0-9]{64}$/.test(admission.installationDigest) ||
      !Number.isSafeInteger(admission.generation) || admission.generation < 1 ||
      admission.pin.installationDigest !== admission.installationDigest || admission.pin.generation !== admission.generation ||
      admission.pin.checkpointDigest !== digestSfValue(checkpoint) ||
      admission.pin.frontierDigest !== digestSfValue(externallyRetained))
    throw new Error("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
  const frontier = inspectSfProductRestoreFrontier(current)
  if (!frontier || !inspectSfProductRestoreFrontier(checkpoint) || digestSfValue(frontier) !== admission.pin.frontierDigest)
    throw new Error("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
  requireFrontierDominance(frontier, externallyRetained)
  return captureSfRestoreRetention(current, checkpoint)
}

type RestoreFrontier = NonNullable<ReturnType<typeof inspectSfProductRestoreFrontier>>

function requireFrontierDominance(current: RestoreFrontier, evidence: RestoreFrontier) {
  if (evidence.incarnation !== current.incarnation || evidence.revision > current.revision)
    throw new Error("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
  const versions = new Map(Object.entries(current.versions))
  if (Object.entries(evidence.versions).some(([key, value]) => value > (versions.get(key) ?? -1)))
    throw new Error("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
  const transactions = new Map(current.transactions.map((entry) => [entry.key, entry.value]))
  if (evidence.transactions.some((entry) => transactions.get(entry.key) !== entry.value))
    throw new Error("SF_RESTORE_EFFECT_FRONTIER_UNKNOWN")
}
