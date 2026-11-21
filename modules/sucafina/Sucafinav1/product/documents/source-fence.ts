import type { Snapshot } from "../../runtime/contract.ts"
import type { SfProductState } from "../contracts/state.ts"
import { sfSourceIdentity } from "../integration/source-lifecycle.ts"
import type { SfDocumentAssetCatalogEntry } from "./byte-port.ts"

/** Catalog metadata is only a locator; the source lifecycle in the locked domain snapshot is authoritative. */
export function documentAsset(state: Readonly<Pick<SfProductState, "documents">>, documentRef: string) {
  const value = state.documents[`asset:${documentRef}`]
  if (!value || typeof value !== "object") return undefined
  const entry = value as SfDocumentAssetCatalogEntry
  if (entry.schema !== "sf-asset-v1" || entry.documentId !== documentRef || !entry.assetId || !entry.incarnation || !Number.isSafeInteger(entry.revision) || entry.revision < 1 || !/^[a-f0-9]{64}$/.test(entry.blobDigest) || (entry.surface !== "dashboard" && entry.surface !== "procurement")) return undefined
  return entry
}

export function documentSourceCurrent(state: Readonly<SfProductState>, snapshot: Snapshot, documentRef: string, expected: { incarnation: string; revision: number; blobDigest: string }, surface: "dashboard" | "procurement") {
  const entry = documentAsset(state, documentRef)
  if (!entry || entry.surface !== surface || entry.incarnation !== expected.incarnation || entry.revision !== expected.revision || entry.blobDigest !== expected.blobDigest || !snapshot.sfSources) return false
  const source = sfSourceIdentity(snapshot, "document-asset", entry.assetId)
  return !!source && source.incarnation === entry.incarnation && source.version === entry.revision
}
