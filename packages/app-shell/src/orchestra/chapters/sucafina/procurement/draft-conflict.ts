import type { SfVersion } from "@orchestra/schema/sucafina/context"
import type { SfDraftInput, SfDraftState } from "../shared/draft"
import type { SfDraftReadBinding, SfDraftRegistry } from "../context/contracts"

/** F01 can mark a revalidated dirty draft conflicted without a remote merge value. */
export function sfDraftConflicted<Value>(snapshot: SfDraftState<Value> | undefined, version: SfVersion | null | undefined): boolean {
  return snapshot?.availability === "active" && (snapshot.phase === "conflict" || snapshot.conflict !== null ||
    version !== undefined && !Object.is(snapshot.baseVersion, version))
}

export function sfDraftForEdit<Value>(snapshot: SfDraftState<Value> | undefined, version: SfVersion | null | undefined) {
  return snapshot?.availability === "active" && !snapshot.pendingOperation && !sfDraftConflicted(snapshot, version)
    ? snapshot : undefined
}

/** A refreshed projection cannot replace the retained draft's original read contract. */
export function sfRetainDraft<Value>(drafts: SfDraftRegistry, input: Omit<SfDraftInput<Value>, "ownerKey"> & Readonly<{ revalidation: SfDraftReadBinding }>) {
  return drafts.peek<Value>(input) ?? drafts.acquire<Value>(input)
}
