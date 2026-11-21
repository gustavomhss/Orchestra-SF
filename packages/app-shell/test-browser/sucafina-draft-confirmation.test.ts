import { expect, test } from "bun:test"
import type { SfEditScopeKey, SfOperationRef, SfOwnerKey, SfRef } from "@orchestra/schema/sucafina/context"
import { createSfOwnerDrafts } from "../src/orchestra/chapters/sucafina/context/drafts"
import { createSfDraft } from "../src/orchestra/chapters/sucafina/shared/draft"

const operationRef = "topic-save:confirmed-registry-test" as SfOperationRef
const selection = {
  surfaceId: "CAP02" as const,
  identity: { kind: "record" as const, recordRef: "topic:registry-test" as SfRef },
  editScopeKey: "hotTopics:registry-test" as SfEditScopeKey,
}
const input = {
  ...selection,
  baseVersion: 4,
  base: { action: "Original action" },
  value: { action: "Original action" },
  revalidation: {
    operationId: "domain.page.CAP02" as const,
    input: {},
    fieldPaths: ["action"],
    actionIds: ["save"],
  },
}
const pending = {
  operationRef,
  idempotencyKey: "idempotency:registry-test",
  payloadDigest: "digest:registry-test",
  expectedVersion: 4,
}

function registry() {
  const externalAccess = (): never => { throw new Error("Unexpected external access in isolated draft test") }
  return createSfOwnerDrafts({
    listInstallations: externalAccess,
    loadContext: externalAccess,
    createTransport: externalAccess,
    resolveTransportIdentity: externalAccess,
    createDraft: createSfDraft,
    revalidateDraft: externalAccess,
  }, {
    key: "owner:registry-test" as SfOwnerKey,
    identity: {
      serverKey: "server:registry-test",
      transportIdentity: "transport:registry-test",
      publicOrigin: "http://127.0.0.1",
      projectId: "project:registry-test",
      installationId: "installation:registry-test",
      principalRef: "principal:registry-test",
      authEpoch: 1,
    },
  })
}

test("only the exact resolved confirmation releases a completed draft for a fresh edit", () => {
  const owner = registry()
  const draft = owner.registry.acquire(input)
  draft.edit({ action: "Saved action" })
  draft.setPending(pending)
  draft.setPhase("submitting")
  draft.confirmSave({ kind: "confirmed-without-projection", operationRef, resultVersion: 5 })
  expect(draft.snapshot().availability).toBe("confirmed-without-projection")

  owner.registry.discard(selection)
  expect(owner.registry.peek(selection)).toBe(draft)
  owner.registry.discard(selection, "topic-save:different" as SfOperationRef)
  expect(owner.registry.peek(selection)).toBe(draft)

  owner.registry.markUnresolved(selection, true)
  owner.registry.discard(selection, operationRef)
  expect(owner.registry.peek(selection)).toBe(draft)
  owner.registry.markUnresolved(selection, false)
  owner.registry.discard(selection, operationRef)
  expect(owner.registry.peek(selection)).toBeUndefined()

  const reopened = owner.registry.acquire({
    ...input,
    baseVersion: 5,
    base: { action: "Saved action" },
    value: { action: "Saved action" },
  })
  expect(reopened).not.toBe(draft)
  expect(reopened.snapshot()).toMatchObject({
    availability: "active",
    phase: "clean",
    baseVersion: 5,
    value: { action: "Saved action" },
    dirty: false,
    pendingOperation: null,
  })
})

test.each(["submitting", "outcome-unknown"] as const)(
  "confirmation cleanup cannot discard a %s operation",
  (phase) => {
    const owner = registry()
    const draft = owner.registry.acquire(input)
    draft.edit({ action: "Unconfirmed action" })
    draft.setPending(pending)
    draft.setPhase(phase)
    const before = draft.snapshot()

    owner.registry.discard(selection, operationRef)
    expect(owner.registry.peek(selection)).toBe(draft)
    expect(draft.snapshot()).toBe(before)
    owner.registry.discard(selection)
    expect(owner.registry.peek(selection)).toBe(draft)
    expect(draft.snapshot()).toBe(before)
    expect(owner.dirty()).toBe(true)
  },
)

test.each(["clean", "dirty", "conflict"] as const)(
  "confirmation cleanup preserves an active %s draft and ordinary discard still works",
  (phase) => {
    const owner = registry()
    const draft = owner.registry.acquire(input)
    if (phase !== "clean") draft.edit({ action: "Unsent edit" })
    if (phase === "conflict") draft.receiveRemote({ baseVersion: 5, value: { action: "Remote edit" } })
    const before = draft.snapshot()
    expect(before).toMatchObject({ availability: "active", phase })

    owner.registry.discard(selection, operationRef)
    expect(owner.registry.peek(selection)).toBe(draft)
    expect(draft.snapshot()).toBe(before)
    owner.registry.discard(selection)
    expect(owner.registry.peek(selection)).toBeUndefined()
  },
)
