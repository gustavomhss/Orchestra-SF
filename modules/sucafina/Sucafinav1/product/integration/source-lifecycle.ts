import type { Snapshot } from "../../runtime/contract.ts"
import type { AssetPersistence } from "../../runtime/assets.ts"
import type { Surface } from "../../src/identity.ts"
import { digestSfValue } from "../contracts/canonical.ts"

export type SfSourceIdentityInput = { recordType: string; recordId: string; inputDigest: string }

/** Wrap the installation's existing driver once, shared by HTTP, jobs and restore. No new store. */
export function createSfSourcePersistence(input: {
  persistence: AssetPersistence
  enumerate: (surface: Surface, snapshot: Snapshot) => readonly SfSourceIdentityInput[]
  createId: () => string
  purpose?: "business-restore"
}): AssetPersistence & { initializeSources: (surface: Surface) => Promise<void> } {
  return {
    initializeSources: (surface) => input.persistence.transaction(surface, async (snapshot) => {
      if (snapshot.sfSources) {
        requireSourceIdentities(snapshot)
        return { commit: false, value: undefined }
      }
      snapshot.sfSources = { schemaVersion: 1, records: {} }
      synchronizeSources(snapshot, input.enumerate(surface, snapshot), input.createId, false)
      return { commit: true, value: undefined }
    }),
    transaction: (surface, work, options) => input.persistence.transaction(surface, async (snapshot, blobs) => {
      requireSourceIdentities(snapshot)
      const before = digestSfValue(snapshot.sfSources)
      const auditStart = snapshot.audit.length
      const auditPrefix = digestSfValue(snapshot.audit)
      const productState = structuredClone(snapshot.data.__sfProductV1)
      const result = await work(snapshot, blobs)
      if (!result.commit) return result
      if (before !== digestSfValue(snapshot.sfSources)) throw new Error("SF_SOURCE_IDENTITY_MUTATION")
      if (snapshot.audit.length < auditStart || digestSfValue(snapshot.audit.slice(0, auditStart)) !== auditPrefix) throw new Error("SF_SOURCE_AUDIT_REWRITTEN")
      // Dataset import/restore already appends this canonical audit record inside its transaction.
      const replacement = snapshot.audit.slice(auditStart).some((event) => event.record === "dataset")
      if (input.purpose === "business-restore") {
        if (!replacement) throw new Error("SF_RESTORE_MARKER_MISSING")
        if (productState === undefined) delete snapshot.data.__sfProductV1
        if (productState !== undefined) snapshot.data.__sfProductV1 = productState
      }
      synchronizeSources(snapshot, input.enumerate(surface, snapshot), input.createId, replacement)
      return result
    }, options),
  }
}

export function sfSourceIdentity(snapshot: Snapshot, recordType: string, recordId: string) {
  requireSourceIdentities(snapshot)
  const identity = snapshot.sfSources!.records[JSON.stringify([recordType, recordId])]
  return identity?.alive ? structuredClone(identity) : undefined
}

function synchronizeSources(snapshot: Snapshot, entries: readonly SfSourceIdentityInput[], createId: () => string, replacement: boolean) {
  const keys = entries.map((entry) => JSON.stringify([entry.recordType, entry.recordId]))
  if (new Set(keys).size !== keys.length || entries.some((entry) => !entry.recordType.trim() || !entry.recordId.trim() || !/^[a-f0-9]{64}$/.test(entry.inputDigest))) throw new Error("SF_SOURCE_INPUT_INVALID")
  const records = snapshot.sfSources!.records
  for (const [key, identity] of Object.entries(records)) if (!keys.includes(key)) records[key] = { ...identity, alive: false }
  entries.forEach((entry, index) => {
    const prior = records[keys[index]!]
    if (!prior || !prior.alive || replacement) {
      const incarnation = createId()
      if (!incarnation.trim() || Object.values(records).some((identity) => identity.incarnation === incarnation)) throw new Error("SF_SOURCE_INCARNATION_INVALID")
      records[keys[index]!] = { incarnation, version: 1, alive: true, inputDigest: entry.inputDigest }
      return
    }
    records[keys[index]!] = { ...prior, inputDigest: entry.inputDigest, version: prior.version + Number(prior.inputDigest !== entry.inputDigest) }
  })
}

function requireSourceIdentities(snapshot: Snapshot) {
  const state = snapshot.sfSources
  if (!state || state.schemaVersion !== 1 || !state.records || Array.isArray(state.records) || Object.values(state.records).some((entry) => !entry || typeof entry.incarnation !== "string" || !entry.incarnation.trim() || !Number.isSafeInteger(entry.version) || entry.version < 1 || typeof entry.alive !== "boolean" || !/^[a-f0-9]{64}$/.test(entry.inputDigest))) throw new Error("SF_SOURCE_IDENTITIES_UNAVAILABLE")
}
