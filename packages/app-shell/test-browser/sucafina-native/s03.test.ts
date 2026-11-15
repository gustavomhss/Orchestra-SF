import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import type {
  SfEditScopeKey, SfIntentRef, SfOperationRef, SfOwnerKey, SfRef,
  SfVersion, SurfaceId,
} from "../../src/orchestra/chapters/sucafina/context/contracts"
import { createSfDraft } from "../../src/orchestra/chapters/sucafina/shared/draft"

const owner = "owner-epoch-1" as SfOwnerKey
const sameAuthorityNewEpoch = "owner-epoch-2-revalidated-by-F01" as SfOwnerKey
const scope = "business-year-2027" as SfEditScopeKey
const surface = "UI67" as SurfaceId
const recordRef = "record-real-ref" as SfRef
const intentRef = "intent-local-only" as SfIntentRef
const v1 = "version-1" as SfVersion
const v2 = "version-2" as SfVersion
const op1 = "operation-1" as SfOperationRef
const op2 = "operation-2" as SfOperationRef

function draft() {
  return createRoot(() => createSfDraft({
    ownerKey: owner,
    editScopeKey: scope,
    surfaceId: surface,
    identity: { kind: "record", recordRef },
    baseVersion: v1,
    base: { amount: 100, note: "existing" },
    value: { amount: 100, note: "existing" },
  }))
}
function pending(operationRef = op1) {
  return {
    operationRef,
    idempotencyKey: "client-operation-key-exact",
    payloadDigest: "producer-payload-digest-exact",
    expectedVersion: v1,
  }
}

test("an uncertain write keeps exact pending intent; no implicit retry, discard or edited replacement", () => {
  const d = draft()
  d.edit({ amount: 120, note: "proposed" })
  d.setPhase("reviewing")
  d.setPending(pending())
  d.setPhase("submitting")
  d.setPhase("outcome-unknown")

  d.setPending({ ...pending(op2), idempotencyKey: "different-key" })
  d.edit({ amount: 900, note: "a second draft cannot rewrite the submitted payload" })
  d.discard()
  d.setPhase("failed")
  d.receiveRemote({ baseVersion: v2, value: { amount: 180, note: "changed elsewhere" } })

  const unknown = d.snapshot()
  expect(unknown.availability).toBe("active")
  if (unknown.availability !== "active") throw new Error("expected authorized active draft")
  expect(unknown.phase).toBe("outcome-unknown")
  expect(unknown.pendingOperation).toEqual(pending())
  expect(unknown.value).toEqual({ amount: 120, note: "proposed" })
  expect(unknown.baseVersion).toBe(v1)
  expect(unknown.conflict?.currentVersion).toBe(v2)

  d.confirmSave({ kind: "projected", operationRef: op2, baseVersion: v2, value: { amount: 900, note: "not ours" } })
  expect(d.snapshot()).toEqual(unknown)

  d.confirmSave({ kind: "projected", operationRef: op1, baseVersion: v2, value: { amount: 120, note: "verified server source" } })
  const complete = d.snapshot()
  expect(complete.availability).toBe("active")
  if (complete.availability !== "active") throw new Error("expected authorized projected state")
  expect(complete.value).toEqual({ amount: 120, note: "verified server source" })
  expect(complete.base).toEqual(complete.value)
  expect(complete.baseVersion).toBe(v2)
  expect(complete.dirty).toBe(false)
  expect(complete.pendingOperation).toBeNull()
  expect(complete.conflict).toBeNull()
})

test("remote changes never overwrite dirty values and discard uses the authorized latest remote", () => {
  const d = draft()
  d.receiveRemote({ baseVersion: v2, value: { amount: 110, note: "new" } })
  const fresh = d.snapshot()
  expect(fresh.availability).toBe("active")
  if (fresh.availability !== "active") throw new Error("expected active state")
  expect(fresh.value.amount).toBe(110)
  expect(fresh.baseVersion).toBe(v2)

  d.edit({ amount: 130, note: "draft wins while dirty" })
  d.receiveRemote({ baseVersion: v1, value: { amount: 90, note: "source conflict" } })
  const conflict = d.snapshot()
  expect(conflict.availability).toBe("active")
  if (conflict.availability !== "active") throw new Error("expected dirty draft")
  expect(conflict.value.amount).toBe(130)
  expect(conflict.conflict?.currentVersion).toBe(v1)
  expect(conflict.phase).toBe("conflict")

  d.setPending(pending())
  const held = d.snapshot()
  expect(held.availability).toBe("active")
  if (held.availability !== "active") throw new Error("expected active conflicted draft")
  expect(held.pendingOperation).toBeNull()
  d.discard()
  const reset = d.snapshot()
  expect(reset.availability).toBe("active")
  if (reset.availability !== "active") throw new Error("expected active state")
  expect(reset.value.amount).toBe(90)
  expect(reset.baseVersion).toBe(v1)
  expect(reset.conflict).toBeNull()
  expect(reset.dirty).toBe(false)
})

test("session expiration quarantines the private value; owner revocation destroys it permanently", () => {
  const d = draft()
  d.edit({ amount: 123, note: "PRIVATE_VALUE_SHOULD_BE_HIDDEN" })
  d.quarantine()
  expect(d.snapshot()).toEqual({ availability: "quarantined", reason: "session-expired", dirty: true })
  expect(JSON.stringify(d.snapshot())).not.toContain("PRIVATE_VALUE_SHOULD_BE_HIDDEN")
  d.edit({ amount: 1, note: "no edit without access" })
  expect(d.snapshot().availability).toBe("quarantined")

  // Only F01 is authorized to call restore after a same-identity/field ACL reread.
  d.restoreSameAuthority(sameAuthorityNewEpoch)
  const restored = d.snapshot()
  expect(restored.availability).toBe("active")
  if (restored.availability !== "active") throw new Error("expected F01-authorized restore")
  expect(restored.value.amount).toBe(123)
  expect(restored.dirty).toBe(true)

  d.revoke("access-revoked")
  expect(d.snapshot()).toEqual({ availability: "revoked", reason: "access-revoked" })
  d.restoreSameAuthority(owner)
  d.confirmSave({ kind: "projected", operationRef: op1, baseVersion: v2, value: { amount: 200, note: "late response" } })
  d.receiveRemote({ baseVersion: v2, value: { amount: 200, note: "late read" } })
  expect(d.snapshot()).toEqual({ availability: "revoked", reason: "access-revoked" })
})

test("outcome after reauthorization is still uncertain, never automatically submitted again", () => {
  const d = draft()
  d.edit({ amount: 190, note: "submitted" })
  d.setPending(pending())
  d.setPhase("submitting")
  d.quarantine()
  d.restoreSameAuthority(sameAuthorityNewEpoch)
  const state = d.snapshot()
  expect(state.availability).toBe("active")
  if (state.availability !== "active") throw new Error("expected active state")
  expect(state.phase).toBe("outcome-unknown")
  expect(state.pendingOperation).toEqual(pending())
  d.setPhase("reviewing")
  expect(d.snapshot()).toEqual(state)
})

test("confirmation without a producer projection never synthesizes a current value or receipt", () => {
  const d = createRoot(() => createSfDraft({
    ownerKey: owner,
    editScopeKey: scope,
    surfaceId: surface,
    identity: { kind: "new" as const, newIntentRef: intentRef },
    base: null,
    baseVersion: null,
    value: { title: "pending creation" },
  }))
  const created = d.snapshot()
  expect(created.availability).toBe("active")
  if (created.availability !== "active") throw new Error("expected new local draft")
  expect(created.dirty).toBe(true)
  d.setPending({ operationRef: op1, idempotencyKey: "creation-exact", payloadDigest: "digest-exact", expectedVersion: null })
  d.setPhase("submitting")
  d.confirmSave({ kind: "confirmed-without-projection", operationRef: op1, resultVersion: null })
  expect(d.snapshot()).toEqual({ availability: "confirmed-without-projection", operationRef: op1, resultVersion: null })
  expect("value" in d.snapshot()).toBe(false)
  expect("receipt" in d.snapshot()).toBe(false)
  d.edit({ title: "should not expose an asserted server projection" })
  expect(d.snapshot().availability).toBe("confirmed-without-projection")
})


test("pending CAS rejects a stale base while retaining the edited value", () => {
  const d = draft()
  d.receiveRemote({ baseVersion: v2, value: { amount: 101, note: "current" } })
  d.edit({ amount: 111, note: "unsent draft" })
  d.setPending(pending(op1))
  const state = d.snapshot()
  expect(state.availability).toBe("active")
  if (state.availability !== "active") throw new Error("expected active draft")
  expect(state.pendingOperation).toBeNull()
  expect(state.baseVersion).toBe(v2)
  expect(state.value.amount).toBe(111)
  expect(state.dirty).toBe(true)
  const current = { ...pending(op1), expectedVersion: v2 }
  d.setPending(current)
  d.setPhase("submitting")
  d.setPhase("outcome-unknown")
  const submitted = d.snapshot()
  expect(submitted.availability).toBe("active")
  if (submitted.availability !== "active") throw new Error("expected submitted state")
  expect(submitted.pendingOperation).toEqual(current)
  d.setPending({ ...current, payloadDigest: "different-payload" })
  expect(d.snapshot()).toEqual(submitted)
})

test("version zero and a new local intent preserve distinct CAS fences", () => {
  const d = createRoot(() => createSfDraft({
    ownerKey: owner,
    editScopeKey: scope,
    surfaceId: surface,
    identity: { kind: "record" as const, recordRef },
    base: { value: 0 },
    baseVersion: 0,
    value: { value: 0 },
  }))
  d.edit({ value: 1 })
  d.setPending({ ...pending(), expectedVersion: null })
  const wrong = d.snapshot()
  expect(wrong.availability).toBe("active")
  if (wrong.availability !== "active") throw new Error("expected active state")
  expect(wrong.pendingOperation).toBeNull()
  d.setPending({ ...pending(), expectedVersion: 0 })
  const correct = d.snapshot()
  expect(correct.availability).toBe("active")
  if (correct.availability !== "active") throw new Error("expected active state")
  expect(correct.pendingOperation?.expectedVersion).toBe(0)
})
