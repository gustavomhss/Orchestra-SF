import { batch } from "solid-js"
import type {
  SfContext, SfReadableContext, SfDraftDependencies, SfDraftReadBinding, SfDraftRegistry,
  SfDraftRevalidation, SfOwnerIdentity, SfPublicDraftController,
} from "./contracts"
import type { SfDraftController, SfDraftIdentity, SfDraftInput } from "../shared/draft"
import type { SfEditScopeKey, SfOwnerKey, SfVersion, SurfaceId } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"

type DraftEntry = {
  key: string
  shape: string
  surfaceId: SurfaceId
  identity: SfDraftIdentity
  editScopeKey: SfEditScopeKey
  read: SfDraftReadBinding
  originalOwner: SfOwnerIdentity
  controller: SfDraftController<unknown>
  facade: SfPublicDraftController<unknown>
  quarantinedBaseVersion: SfVersion | null
  quarantinedDirty: boolean
  quarantinedPending: boolean
}
type RegistryState = "active" | "quarantined" | "revoked"

/** One ephemeral owner registry outside every keyed chapter boundary. */
export function createSfOwnerDrafts<Context extends SfReadableContext = SfContext>(
  deps: SfDraftDependencies<Context>,
  initial: Readonly<{ key: SfOwnerKey; identity: SfOwnerIdentity }>,
) {
  const entries = new Map<string, DraftEntry>()
  const unresolved = new Set<string>()
  let owner = initial
  let state: RegistryState = "active"
  let revocationReason: "logout" | "owner-changed" | "access-revoked" | "authority-changed" | undefined
  const identityKey = (surfaceId: SurfaceId, identity: SfDraftIdentity, editScopeKey: SfEditScopeKey) =>
    JSON.stringify([surfaceId, identity.kind, identity.kind === "record" ? identity.recordRef : identity.newIntentRef, editScopeKey])
  const shapeOf = (value: unknown): string => {
    if (value === null || typeof value !== "object") return typeof value
    if (Array.isArray(value)) return "array"
    return Object.keys(value).sort().map((key) => JSON.stringify(key)).join(",")
  }
  const live = () => state === "active"
  const exposed = <Value,>(raw: SfDraftController<Value>): SfPublicDraftController<Value> => ({
    snapshot: raw.snapshot,
    edit: (value) => { if (live()) raw.edit(value) },
    discard: () => { if (live()) raw.discard() },
    receiveRemote: (remote) => { if (live()) raw.receiveRemote(remote) },
    setPhase: (phase) => { if (live()) raw.setPhase(phase) },
    setPending: (operation) => { if (live()) raw.setPending(operation) },
    confirmSave: (result) => { if (live()) raw.confirmSave(result) },
    rejectSave: (result) => { if (live()) raw.rejectSave(result) },
  })
  const registry: SfDraftRegistry = {
    peek<Value>(input: Readonly<{ surfaceId: SurfaceId; identity: SfDraftIdentity; editScopeKey: SfEditScopeKey }>) {
      if (!live()) return undefined
      return entries.get(identityKey(input.surfaceId, input.identity, input.editScopeKey))
        ?.facade as SfPublicDraftController<Value> | undefined
    },
    acquire<Value>(input: Omit<SfDraftInput<Value>, "ownerKey"> & Readonly<{ revalidation: SfDraftReadBinding }>) {
      if (!live()) throw new Error("Sucafina draft authority unavailable")
      const key = identityKey(input.surfaceId, input.identity, input.editScopeKey)
      const previous = entries.get(key)
      const shape = shapeOf(input.value)
      if (previous) {
        if (shape !== previous.shape || JSON.stringify(input.revalidation) !== JSON.stringify(previous.read))
          throw new Error("Sucafina draft identity reused with a conflicting contract")
        // The only type-erasure site: immutable selection, field shape and read contract matched.
        return previous.facade as SfPublicDraftController<Value>
      }
      const raw = deps.createDraft({ ...input, ownerKey: owner.key })
      const facade = exposed(raw)
      entries.set(key, {
        key, shape,
        surfaceId: input.surfaceId,
        identity: input.identity,
        editScopeKey: input.editScopeKey,
        read: input.revalidation,
        originalOwner: owner.identity,
        controller: raw as SfDraftController<unknown>,
        facade: facade as SfPublicDraftController<unknown>,
        quarantinedBaseVersion: input.baseVersion,
        quarantinedDirty: false,
        quarantinedPending: false,
      })
      return facade
    },
    discard(input, confirmedOperationRef) {
      if (!live()) return
      const key = identityKey(input.surfaceId, input.identity, input.editScopeKey)
      const found = entries.get(key)
      if (!found) return
      const snapshot = found.controller.snapshot()
      if (confirmedOperationRef !== undefined) {
        if (snapshot.availability !== "confirmed-without-projection" ||
            snapshot.operationRef !== confirmedOperationRef || unresolved.has(key)) return
        entries.delete(key)
        return
      }
      if (snapshot.availability !== "active" || snapshot.pendingOperation !== null || unresolved.has(key)) return
      found.controller.discard()
      entries.delete(key)
    },
    markUnresolved(input, pending) {
      if (!live()) return
      const key = identityKey(input.surfaceId, input.identity, input.editScopeKey)
      if (pending) unresolved.add(key)
      else unresolved.delete(key)
    },
  }

  // A submitted command's status cannot be cleared by a UI discard prompt or a new transport generation.
  const hasUnresolvedOperations = () => unresolved.size > 0 || [...entries.values()].some((entry) => {
      if (state === "quarantined") return entry.quarantinedPending
      const snapshot = entry.controller.snapshot()
      return snapshot.availability !== "active" || snapshot.pendingOperation !== null ||
        snapshot.phase === "submitting" || snapshot.phase === "outcome-unknown"
    })
  const discardAll = () => {
    if (state === "revoked" || hasUnresolvedOperations()) return false
    if (state === "quarantined") {
      revoke("owner-changed")
      return true
    }
    entries.forEach((entry) => entry.controller.revoke("owner-changed"))
    entries.clear()
    return true
  }

  const quarantine = () => {
    if (state !== "active") return
    state = "quarantined"
    entries.forEach((entry) => {
      const snapshot = entry.controller.snapshot()
      if (snapshot.availability === "active") {
        entry.quarantinedBaseVersion = snapshot.baseVersion
        entry.quarantinedDirty = snapshot.dirty
        entry.quarantinedPending = snapshot.pendingOperation !== null ||
          snapshot.phase === "submitting" || snapshot.phase === "outcome-unknown"
      } else {
        // Confirmed-but-unprojected entries are submitted, not unsent drafts.
        entry.quarantinedPending = true
      }
      entry.controller.quarantine()
    })
  }
  const revoke = (reason: "logout" | "owner-changed" | "access-revoked" | "authority-changed") => {
    if (state === "revoked") return
    state = "revoked"
    revocationReason = reason
    entries.forEach((entry) => entry.controller.revoke(reason))
    entries.clear()
    unresolved.clear()
  }
  const sameAuthority = (left: SfOwnerIdentity, right: SfOwnerIdentity) =>
    left.serverKey === right.serverKey &&
    left.transportIdentity === right.transportIdentity &&
    left.publicOrigin === right.publicOrigin &&
    left.projectId === right.projectId &&
    left.installationId === right.installationId &&
    left.principalRef === right.principalRef
  const revalidate = async (
    incoming: Readonly<{ key: SfOwnerKey; identity: SfOwnerIdentity }>,
    context: Context,
    transport: SfTransport,
    signal: AbortSignal,
  ): Promise<boolean> => {
    if (!sameAuthority(owner.identity, incoming.identity) ||
        incoming.identity.installationId !== context.stamp.installationId ||
        incoming.identity.projectId !== context.stamp.projectId ||
        incoming.identity.principalRef !== context.stamp.principalRef) {
      revoke("authority-changed")
      return false
    }
    if (state !== "quarantined" || signal.aborted) return false
    // No optimistic or cached access: every retained edit must be proved again.
    const proofs: { entry: DraftEntry; sourceVersion: SfVersion | null }[] = []
    for (const entry of entries.values()) {
      const proof: SfDraftRevalidation | undefined = await Promise.resolve().then(() => deps.revalidateDraft({
        surfaceId: entry.surfaceId,
        identity: entry.identity,
        editScopeKey: entry.editScopeKey,
        originalOwner: entry.originalOwner,
        read: entry.read,
      }, context, transport, signal)).catch(() => undefined) // Source failure retains the quarantine for retry.
      if (signal.aborted || state !== "quarantined") return false
      if (accessDeniedProof(proof)) {
        revoke("access-revoked")
        return false
      }
      if (!proof || proof.status === "unavailable") continue
      if (proof.status !== "authorized" || proof.authority !== "unchanged" || !proof.stamp ||
          proof.stamp.installationId !== context.stamp.installationId ||
          proof.stamp.projectId !== context.stamp.projectId ||
          proof.stamp.hostId !== context.stamp.hostId ||
          proof.stamp.principalRef !== context.stamp.principalRef ||
          proof.stamp.policyVersion !== context.stamp.policyVersion ||
          proof.stamp.accessRevision !== context.stamp.accessRevision) {
        revoke("authority-changed")
        return false
      }
      proofs.push({ entry, sourceVersion: proof.sourceVersion })
    }
    if (signal.aborted || state !== "quarantined" || proofs.length !== entries.size) return false
    batch(() => {
      proofs.forEach(({ entry, sourceVersion }) => {
        entry.controller.restoreSameAuthority(incoming.key)
        if (entry.quarantinedDirty && entry.quarantinedBaseVersion !== sourceVersion)
          entry.controller.setPhase("conflict") // No automatic merge or reuse of old review admission.
      })
      owner = incoming
      state = "active"
    })
    return true
  }
  const dirty = () => unresolved.size > 0 || [...entries.values()].some((entry) => {
    const snapshot = entry.controller.snapshot()
    if (state === "quarantined") return entry.quarantinedDirty || entry.quarantinedPending
    return snapshot.availability === "active" && (snapshot.dirty || snapshot.pendingOperation !== null)
  })
  return Object.freeze({ registry, discardAll, quarantine, revoke, revalidate, dirty, sameAuthority, hasUnresolvedOperations,
    owner: () => owner, state: () => state, revocationReason: () => revocationReason })
}

function accessDeniedProof(proof: SfDraftRevalidation | undefined): boolean {
  if (!proof) return false
  if (proof.status === "denied") return true
  if (proof.status !== "unavailable") return false
  const detail = proof as { httpStatus?: unknown; reason?: unknown }
  return detail.httpStatus === 401 || detail.httpStatus === 403
    || detail.reason === "denied" || detail.reason === "unauthenticated"
}

