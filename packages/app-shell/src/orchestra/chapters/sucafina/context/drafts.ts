import type {
  SfContext, SfContextDependencies, SfDraftReadBinding, SfDraftRegistry,
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
}
type RegistryState = "active" | "quarantined" | "revoked"

/** One ephemeral owner registry outside every keyed chapter boundary. */
export function createSfOwnerDrafts(
  deps: SfContextDependencies,
  initial: Readonly<{ key: SfOwnerKey; identity: SfOwnerIdentity }>,
) {
  const entries = new Map<string, DraftEntry>()
  let owner = initial
  let state: RegistryState = "active"
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
  })
  const registry: SfDraftRegistry = {
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
      })
      return facade
    },
    discard(input) {
      if (!live()) return
      const key = identityKey(input.surfaceId, input.identity, input.editScopeKey)
      const found = entries.get(key)
      found?.controller.discard()
      entries.delete(key)
    },
  }

  const quarantine = () => {
    if (state !== "active") return
    state = "quarantined"
    entries.forEach((entry) => {
      const snapshot = entry.controller.snapshot()
      if (snapshot.availability === "active") {
        entry.quarantinedBaseVersion = snapshot.baseVersion
        entry.quarantinedDirty = snapshot.dirty
      }
      entry.controller.quarantine()
    })
  }
  const revoke = (reason: "logout" | "owner-changed" | "access-revoked" | "authority-changed") => {
    if (state === "revoked") return
    state = "revoked"
    entries.forEach((entry) => entry.controller.revoke(reason))
    entries.clear()
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
    context: SfContext,
    transport: SfTransport,
    signal: AbortSignal,
  ): Promise<boolean> => {
    if (state !== "quarantined" || !sameAuthority(owner.identity, incoming.identity)) {
      revoke("authority-changed")
      return false
    }
    // No optimistic or cached access: every retained edit must be proved again.
    for (const entry of entries.values()) {
      const proof: SfDraftRevalidation = await deps.revalidateDraft({
        surfaceId: entry.surfaceId,
        identity: entry.identity,
        editScopeKey: entry.editScopeKey,
        originalOwner: entry.originalOwner,
        read: entry.read,
      }, context, transport, signal)
      if (signal.aborted) return false
      if (proof.status !== "authorized" ||
          proof.authority !== "unchanged" ||
          proof.stamp.installationId !== context.stamp.installationId ||
          proof.stamp.projectId !== context.stamp.projectId ||
          proof.stamp.hostId !== context.stamp.hostId ||
          proof.stamp.principalRef !== context.stamp.principalRef ||
          proof.stamp.policyVersion !== context.stamp.policyVersion ||
          proof.stamp.accessRevision !== context.stamp.accessRevision) {
        revoke("authority-changed")
        return false
      }
      const previousVersion = entry.quarantinedBaseVersion
      const wasDirty = entry.quarantinedDirty
      entry.controller.restoreSameAuthority(incoming.key)
      if (wasDirty && previousVersion !== proof.sourceVersion)
        entry.controller.setPhase("conflict") // No automatic merge or reuse of old review admission.
    }
    if (signal.aborted) return false
    owner = incoming
    state = "active"
    return true
  }
  const dirty = () => [...entries.values()].some((entry) => {
    const snapshot = entry.controller.snapshot()
    return snapshot.availability === "active" && (snapshot.dirty || snapshot.pendingOperation !== null)
  })
  return Object.freeze({ registry, quarantine, revoke, revalidate, dirty, sameAuthority, owner: () => owner, state: () => state })
}
