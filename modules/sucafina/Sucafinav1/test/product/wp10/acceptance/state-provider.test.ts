import { expect, test } from "bun:test"
import type { Snapshot } from "../../../../runtime/contract.ts"
import type { SfStateAuthority, SfProductStatePort, SfProductState, SfAtlasOutboxEntry } from "../../../../product/contracts/state.ts"
import { digestSfEvidenceRef } from "../../../../product/contracts/canonical.ts"
import { createSfProductState } from "../../../../product/host-binding/state-provider.ts"
import { testPersistence } from "../../../fixture/persistence.ts"
import { sfProductStateAdditiveFields } from "../../../../product/contracts/state-layout.ts"

const authority: SfStateAuthority = { principalRef: "user-1", accessRevision: "access-1", policyVersion: "policy-1" }
const request = () => new Request("https://example.test/product")
const command = { namespace: "preferences", expectedStorageVersion: 0, idempotencyKey: "command-1", targetRef: "preference-1", targetIncarnation: "target-1", commandDigest: "a".repeat(64) } as const

const resolveTarget = async (_request: Request, snapshot: Snapshot) =>
  typeof snapshot.data.targetIncarnation === "string" ? { incarnation: snapshot.data.targetIncarnation } : undefined

function fixture(authorize: Parameters<typeof createSfProductState>[0]["authorize"] = async () => authority) {
  const storage = testPersistence()
  storage.state.dashboard.data.targetIncarnation = "target-1"
  const port: SfProductStatePort = createSfProductState({ persistence: storage.persistence, authorize, resolveTarget, createId: () => "incarnation-1" })
  return { storage, port }
}

test("dashboard administrator is denied without product authority", async () => {
  const f = fixture(async () => undefined)
  f.storage.state.dashboard.data.role = "admin"
  const before = structuredClone(f.storage.state.dashboard)
  expect(await f.port.transaction(request(), command, async (state) => {
    state.preferences.secret = true
    return { commit: true, value: "written" }
  })).toEqual({ status: "denied", reason: "product-access-unavailable" })
  expect(await f.port.read(request(), "preferences", () => "secret")).toEqual({ status: "denied", reason: "product-access-unavailable" })
  expect(f.storage.state.dashboard).toEqual(before)
})

test("exact retry recovers the result, digest reuse conflicts and principals remain isolated", async () => {
  const f = fixture()
  let invoked = 0
  const write = () => f.port.transaction(request(), command, async (state) => {
    invoked += 1
    state.preferences.count = Number(state.preferences.count ?? 0) + 1
    return { commit: true, value: "saved" }
  })
  const first = await write()
  expect(first).toEqual({ status: "ok", storageVersion: 1, aggregateRevision: 1, incarnation: "incarnation-1", value: "saved" })
  expect(await write()).toEqual(first)
  expect(invoked).toBe(1)
  expect((await f.port.transaction(request(), { ...command, commandDigest: "b".repeat(64) }, async () => {
    throw new Error("digest conflict must not execute")
  })).status).toBe("conflict")
  const other = createSfProductState({ persistence: f.storage.persistence, resolveTarget, createId: () => "unused", authorize: async () => ({ ...authority, principalRef: "user-2" }) })
  expect((await other.transaction(request(), command, async () => {
    throw new Error("other principal must not reuse receipt or execute stale command")
  })).status).toBe("conflict")
  expect(await f.port.read(request(), "preferences", (state) => state.preferences.count)).toMatchObject({ status: "ok", value: 1 })
})

test("concurrent different commands at the same version commit once", async () => {
  const f = fixture()
  const write = (idempotencyKey: string) => f.port.transaction(request(), { ...command, idempotencyKey }, async (state) => {
    state.preferences.value = idempotencyKey
    return { commit: true, value: idempotencyKey }
  })
  const results = await Promise.all([write("a"), write("b")])
  expect(results.filter((result) => result.status === "ok")).toHaveLength(1)
  expect(results.filter((result) => result.status === "conflict")).toHaveLength(1)
})

test("a retry after authority revocation never discloses the stored result", async () => {
  const f = fixture()
  await f.port.transaction(request(), command, async () => ({ commit: true, value: "sensitive" }))
  const revoked = createSfProductState({ persistence: f.storage.persistence, resolveTarget, createId: () => "unused", authorize: async () => undefined })
  expect(await revoked.transaction(request(), command, async () => {
    throw new Error("revoked retry must not execute")
  })).toEqual({ status: "denied", reason: "product-access-unavailable" })
})

test("failure before commit rolls back all staged changes", async () => {
  const f = fixture()
  const before = structuredClone(f.storage.state.dashboard)
  f.storage.fail.beforeCommit = true
  await expect(f.port.transaction(request(), command, async (state, _authority, snapshot) => {
    state.preferences.theme = "dark"
    snapshot.data.other = "staged"
    return { commit: true, value: "saved" }
  })).rejects.toThrow("Injected commit failure")
  expect(f.storage.state.dashboard).toEqual(before)
  f.storage.fail.beforeCommit = false
  expect(await f.port.transaction(request(), command, async (state) => {
    state.preferences.theme = "light"
    return { commit: true, value: "saved" }
  })).toMatchObject({ status: "ok", storageVersion: 1, aggregateRevision: 1 })
})

test("read callback cannot mutate persisted state", async () => {
  const f = fixture()
  await f.port.transaction(request(), command, async (state) => {
    state.preferences.theme = "light"
    return { commit: true, value: null }
  })
  const before = structuredClone(f.storage.state.dashboard)
  expect(await f.port.read(request(), "preferences", (state) => {
    state.preferences.theme = "dark"
    return state.preferences.theme
  })).toMatchObject({ status: "ok", value: "dark" })
  expect(f.storage.state.dashboard).toEqual(before)
})

test("thread messages are append-only outside the authorized history writer", async () => {
  const f = fixture()
  const input = { ...command, namespace: "threads" as const }
  await f.port.transaction(request(), input, async (state) => {
    state.threads.thread = { messages: [{ id: "m1", body: "original" }] }
    return { commit: true, value: null }
  })
  expect(await f.port.transaction(request(), { ...input, expectedStorageVersion: 1, idempotencyKey: "rewrite" }, async (state) => {
    state.threads.thread = { messages: [{ id: "m1", body: "forged" }] }
    return { commit: true, value: null }
  })).toMatchObject({ status: "denied", reason: "thread-history-write-outside-authority" })
  expect(await f.port.transaction(request(), { ...input, expectedStorageVersion: 1, idempotencyKey: "reply" }, async (state) => {
    state.threads.thread = { messages: [{ id: "m1", body: "original" }, { id: "m2", body: "reply" }] }
    return { commit: true, value: null }
  })).toMatchObject({ status: "ok", storageVersion: 2 })
})

test("revoked authority at egress prevents read disclosure and write commit", async () => {
  const f = fixture()
  await f.port.transaction(request(), command, async (state) => {
    state.preferences.secret = "sensitive"
    return { commit: true, value: null }
  })
  const before = structuredClone(f.storage.state.dashboard)
  let calls = 0
  const revoked = createSfProductState({ persistence: f.storage.persistence, resolveTarget, createId: () => "unused", authorize: async () => ++calls % 2 === 1 ? authority : undefined })
  expect(await revoked.read(request(), "preferences", (state) => state.preferences.secret)).toEqual({ status: "denied", reason: "product-authority-changed" })
  expect(await revoked.transaction(request(), { ...command, expectedStorageVersion: 1, idempotencyKey: "command-2" }, async (state) => {
    state.preferences.secret = "changed"
    return { commit: true, value: "sensitive" }
  })).toEqual({ status: "denied", reason: "product-authority-changed" })
  expect(f.storage.state.dashboard).toEqual(before)
})

test("preview does not persist state or consume the command", async () => {
  const f = fixture()
  const before = structuredClone(f.storage.state.dashboard)
  expect(await f.port.transaction(request(), command, async (state) => {
    state.preferences.theme = "preview"
    return { commit: false, value: "proposed" }
  })).toMatchObject({ status: "preview", storageVersion: 0, aggregateRevision: 0, value: "proposed" })
  expect(f.storage.state.dashboard).toEqual(before)
  expect(await f.port.transaction(request(), command, async (state) => {
    state.preferences.theme = "saved"
    return { commit: true, value: "saved" }
  })).toMatchObject({ status: "ok", storageVersion: 1, aggregateRevision: 1 })
})

test("writes in another namespace do not invalidate section CAS", async () => {
  const f = fixture()
  expect(await f.port.transaction(request(), command, async (state) => {
    state.preferences.theme = "light"
    return { commit: true, value: null }
  })).toMatchObject({ status: "ok", storageVersion: 1, aggregateRevision: 1 })
  expect(await f.port.transaction(request(), { ...command, namespace: "relations", idempotencyKey: "relation-1" }, async (state) => {
    state.relations.link = "one"
    return { commit: true, value: null }
  })).toMatchObject({ status: "ok", storageVersion: 1, aggregateRevision: 2 })
})

test("legacy state adopts the BI namespace without resetting existing versions or granting cross-namespace writes", async () => {
  const f = fixture()
  await f.port.transaction(request(), command, async (state) => { state.preferences.theme = "light"; return { commit: true, value: null } })
  const stored = f.storage.state.dashboard.data.__sfProductV1 as SfProductState
  delete stored.biArtifacts
  Reflect.deleteProperty(stored.versions, "bi-artifacts")
  expect(await f.port.read(request(), "preferences", (state) => state.versions)).toMatchObject({ status: "ok", value: { preferences: 1, "bi-artifacts": 0 } })
  expect(await f.port.transaction(request(), { ...command, expectedStorageVersion: 1, idempotencyKey: "forged-bi" }, async (state) => {
    state.biArtifacts = { forged: {} as NonNullable<SfProductState["biArtifacts"]>[string] }
    return { commit: true, value: null }
  })).toMatchObject({ status: "denied", reason: "namespace-write-outside-authority" })
  expect(await f.port.transaction(request(), { ...command, namespace: "bi-artifacts", idempotencyKey: "bi-migration" }, async (state) => {
    state.biArtifacts = {}
    return { commit: true, value: null }
  })).toMatchObject({ status: "ok", storageVersion: 1 })
  expect(await f.port.read(request(), "preferences", (state) => state.versions)).toMatchObject({ status: "ok", value: { preferences: 1, "bi-artifacts": 1 } })
})

test("additive C08 migration preserves existing maps and commits only with a new authorized command", async () => {
  const f = fixture()
  const original = await f.port.transaction(request(), command, async (state) => {
    state.preferences.theme = "light"
    return { commit: true, value: "original" }
  })
  expect(original.status).toBe("ok")
  const stored = f.storage.state.dashboard.data.__sfProductV1 as SfProductState
  expect(Object.fromEntries(sfProductStateAdditiveFields.map((field) => [field, stored[field]])))
    .toEqual(Object.fromEntries(sfProductStateAdditiveFields.map((field) => [field, {}])))
  // Opaque legacy map contents exercise storage preservation; they are not admitted domain results.
  Reflect.set(stored, "claimBindings", { preserved: { marker: "legacy-claim-map" } })
  Reflect.set(stored, "nativeRuns", { preserved: { marker: "legacy-run-map" } })
  for (const field of ["commandProposals", "compositeScenarios", "decisionResults", "biArtifacts"] as const) delete stored[field]
  Reflect.deleteProperty(stored.versions, "bi-artifacts")
  const legacy = structuredClone(f.storage.state.dashboard)
  expect(await f.port.read(request(), "preferences", (state) => state.preferences.theme)).toMatchObject({ status: "ok", value: "light" })
  expect(f.storage.state.dashboard).toEqual(legacy)
  expect(await f.port.transaction(request(), command, async () => { throw new Error("old exact retry must not migrate") })).toEqual(original)
  expect(f.storage.state.dashboard).toEqual(legacy)
  const next = { ...command, expectedStorageVersion: 1, idempotencyKey: "migrate-additive", commandDigest: "b".repeat(64) }
  const revoked = createSfProductState({ persistence: f.storage.persistence, resolveTarget, createId: () => "unused", authorize: async () => undefined })
  expect(await revoked.transaction(request(), next, async () => { throw new Error("denied migration must not run") })).toMatchObject({ status: "denied" })
  expect(f.storage.state.dashboard).toEqual(legacy)
  expect(await f.port.transaction(request(), next, async (state) => {
    expect(state.decisionResults).toEqual({})
    state.preferences.theme = "preview"
    return { commit: false, value: "preview" }
  })).toMatchObject({ status: "preview", aggregateRevision: 1, storageVersion: 1 })
  expect(f.storage.state.dashboard).toEqual(legacy)
  let grants = 0
  const lateRevoked = createSfProductState({ persistence: f.storage.persistence, resolveTarget, createId: () => "unused", authorize: async () => ++grants === 1 ? authority : undefined })
  expect(await lateRevoked.transaction(request(), next, async (state) => {
    state.preferences.theme = "revoked"
    return { commit: true, value: "must not persist migration" }
  })).toMatchObject({ status: "denied", reason: "product-authority-changed" })
  expect(f.storage.state.dashboard).toEqual(legacy)
  const result = await f.port.transaction(request(), next, async (state) => {
    state.preferences.theme = "dark"
    return { commit: true, value: "migrated" }
  })
  expect(result).toMatchObject({ status: "ok", aggregateRevision: 2, storageVersion: 2, incarnation: "incarnation-1", value: "migrated" })
  const once = structuredClone(f.storage.state.dashboard)
  const migrated = once.data.__sfProductV1 as SfProductState
  expect(migrated.claimBindings).toEqual(stored.claimBindings)
  expect(migrated.nativeRuns).toEqual(stored.nativeRuns)
  expect(migrated.versions).toEqual({ ...stored.versions, preferences: 2, "bi-artifacts": 0 })
  for (const field of ["commandProposals", "compositeScenarios", "decisionResults", "biArtifacts"] as const) expect(migrated[field]).toEqual({})
  expect(await f.port.transaction(request(), next, async () => { throw new Error("retry must not migrate twice") })).toEqual(result)
  expect(f.storage.state.dashboard).toEqual(once)
})

test("malformed additive maps cannot be normalized into an accepted state", async () => {
  for (const field of sfProductStateAdditiveFields) {
    for (const malformed of [null, [], 42]) {
      const f = fixture()
      expect((await f.port.transaction(request(), command, async () => ({ commit: true, value: "initialized" }))).status).toBe("ok")
      Reflect.set(f.storage.state.dashboard.data.__sfProductV1 as SfProductState, field, malformed)
      const before = structuredClone(f.storage.state.dashboard)
      expect(await f.port.read(request(), "preferences", () => "must not disclose"))
        .toEqual({ status: "unavailable", reason: "invalid-product-state" })
      expect(await f.port.transaction(request(), { ...command, expectedStorageVersion: 1, idempotencyKey: "invalid-map" }, async () => {
        throw new Error("invalid map must not invoke work")
      })).toEqual({ status: "unavailable", reason: "invalid-product-state" })
      expect(f.storage.state.dashboard).toEqual(before)
    }
  }
})

test("replacing the actual target blocks replay of the old receipt", async () => {
  const f = fixture()
  expect((await f.port.transaction(request(), command, async (state) => {
    state.preferences.value = "old"
    return { commit: true, value: "sensitive" }
  })).status).toBe("ok")
  f.storage.state.dashboard.data.targetIncarnation = "target-2"
  const before = structuredClone(f.storage.state.dashboard)
  expect(await f.port.transaction(request(), command, async () => {
    throw new Error("replaced target must not execute")
  })).toEqual({ status: "conflict", reason: "target-replaced" })
  expect(f.storage.state.dashboard).toEqual(before)
})

test("target replacement during work prevents commit and disclosure", async () => {
  const f = fixture()
  const before = structuredClone(f.storage.state.dashboard)
  expect(await f.port.transaction(request(), command, async (state, _authority, snapshot) => {
    state.preferences.value = "secret"
    snapshot.data.targetIncarnation = "target-2"
    return { commit: true, value: "secret" }
  })).toEqual({ status: "denied", reason: "target-authority-changed" })
  expect(f.storage.state.dashboard).toEqual(before)
})

test("a callback cannot mutate a different namespace, versions, or receipts", async () => {
  const f = fixture()
  const before = structuredClone(f.storage.state.dashboard)
  const mutations = [
    (state: SfProductState) => { state.relations.link = "forged" },
    ...sfProductStateAdditiveFields.map((field) => (state: SfProductState) => { Reflect.set(state, field, { forged: { marker: "unauthorized" } }) }),
    (state: SfProductState) => { state.versions.relations = 7 },
    (state: SfProductState) => { state.transactions.forged = { namespace: "preferences", scopeDigest: "forged", principalRef: "user-1", targetRef: "preference-1", targetIncarnation: "target-1", commandDigest: "a".repeat(64), storageVersion: 1, aggregateRevision: 1, incarnation: "incarnation-1", value: "forged" } },
  ]
  for (const mutate of mutations) {
    expect(await f.port.transaction(request(), command, async (state) => {
      state.preferences.value = "staged"
      mutate(state)
      return { commit: true, value: "staged" }
    })).toEqual({ status: "denied", reason: "namespace-write-outside-authority" })
    expect(f.storage.state.dashboard).toEqual(before)
  }
})

test("malformed command digest is rejected without work or persistence", async () => {
  const f = fixture()
  const before = structuredClone(f.storage.state.dashboard)
  expect(await f.port.transaction(request(), { ...command, commandDigest: "digest-1" }, async () => {
    throw new Error("invalid identity must not execute")
  })).toMatchObject({ status: "conflict", reason: "invalid-command-identity" })
  expect(f.storage.state.dashboard).toEqual(before)
})


test("admitted Atlas and outbox commit atomically with independent versions", async () => {
  const f = fixture()
  const input = { ...command, namespace: "atlas" as const, additionalNamespaces: [{ namespace: "outbox" as const, expectedStorageVersion: 0 }] }
  const result = await f.port.transaction(request(), input, async (state) => {
    state.atlas.event = "event-1"
    state.outbox.event = outboxEntry("acknowledged")
    return { commit: true, value: "saved" }
  })
  expect(result).toMatchObject({ status: "ok", storageVersion: 1, aggregateRevision: 1 })
  expect(await f.port.read(request(), "atlas", (state) => ({ atlas: state.atlas.event, outbox: state.outbox.event?.eventRef.refId, versions: state.versions }))).toMatchObject({
    status: "ok", value: { atlas: "event-1", outbox: "acknowledged", versions: { atlas: 1, outbox: 1, preferences: 0 } },
  })
  const before = structuredClone(f.storage.state.dashboard)
  f.storage.fail.beforeCommit = true
  await expect(f.port.transaction(request(), { ...input, expectedStorageVersion: 1, additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: 1 }], idempotencyKey: "command-2" }, async (state) => {
    state.atlas.event = "event-2"
    state.outbox.event = outboxEntry("new")
    return { commit: true, value: "saved" }
  })).rejects.toThrow("Injected commit failure")
  expect(f.storage.state.dashboard).toEqual(before)
})

test("stale secondary namespace blocks all work", async () => {
  const f = fixture()
  expect((await f.port.transaction(request(), { ...command, namespace: "outbox" }, async (state) => {
    state.outbox.event = outboxEntry("existing")
    return { commit: true, value: null }
  })).status).toBe("ok")
  const before = structuredClone(f.storage.state.dashboard)
  expect(await f.port.transaction(request(), { ...command, namespace: "atlas", additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: 0 }] }, async () => {
    throw new Error("stale secondary must not execute")
  })).toEqual({ status: "conflict", reason: "product-state-changed" })
  expect(f.storage.state.dashboard).toEqual(before)
})

test("read-only namespace guards enforce CAS without granting writes or advancing versions", async () => {
  const f = fixture(async (_request, _snapshot, namespace, mode) => namespace === "relations" && mode === "write" ? undefined : authority)
  const guarded = { ...command, checkNamespaces: [{ namespace: "relations" as const, expectedStorageVersion: 0 }] }
  expect(await f.port.transaction(request(), guarded, async (state) => {
    state.relations.forged = true
    return { commit: true, value: null }
  })).toMatchObject({ status: "denied", reason: "namespace-write-outside-authority" })
  const saved = await f.port.transaction(request(), guarded, async (state) => {
    state.preferences.value = "saved"
    return { commit: true, value: "saved" }
  })
  expect(saved.status).toBe("ok")
  expect(await f.port.read(request(), "relations", (state) => state.versions.relations)).toMatchObject({ status: "ok", value: 0 })
  expect(await f.port.transaction(request(), { ...guarded, checkNamespaces: [] }, async () => { throw new Error("changed guard must not execute") })).toMatchObject({ status: "conflict", reason: "idempotency-content-changed" })
  expect(await f.port.transaction(request(), { ...guarded, idempotencyKey: "stale", expectedStorageVersion: 1, checkNamespaces: [{ namespace: "relations", expectedStorageVersion: 1 }] }, async () => { throw new Error("stale guard must not execute") })).toMatchObject({ status: "conflict", reason: "product-state-changed" })
  expect(await f.port.transaction(request(), { ...guarded, idempotencyKey: "overlap", checkNamespaces: [{ namespace: "preferences", expectedStorageVersion: 0 }] }, async () => { throw new Error("overlap must not execute") })).toMatchObject({ status: "conflict", reason: "invalid-expected-version" })
})

test("revoked read authority for a guarded namespace prevents commit and retry disclosure", async () => {
  let checks = 0
  const f = fixture(async (_request, _snapshot, namespace, mode) => namespace === "relations" && mode === "read" && ++checks > 1 ? undefined : authority)
  expect(await f.port.transaction(request(), { ...command, checkNamespaces: [{ namespace: "relations", expectedStorageVersion: 0 }] }, async (state) => {
    state.preferences.secret = "secret"
    return { commit: true, value: "secret" }
  })).toMatchObject({ status: "denied", reason: "product-authority-changed" })
})

test("secondary authority revoked at egress rolls back both sections", async () => {
  let outboxChecks = 0
  const f = fixture(async (_request, _snapshot, namespace) => namespace === "outbox" && ++outboxChecks > 1 ? undefined : authority)
  const before = structuredClone(f.storage.state.dashboard)
  expect(await f.port.transaction(request(), { ...command, namespace: "atlas", additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: 0 }] }, async (state) => {
    state.atlas.event = "secret"
    state.outbox.event = outboxEntry("secret")
    return { commit: true, value: "secret" }
  })).toEqual({ status: "denied", reason: "product-authority-changed" })
  expect(f.storage.state.dashboard).toEqual(before)
})

test("retry with a changed admitted namespace scope conflicts without executing", async () => {
  const f = fixture()
  const input = { ...command, namespace: "atlas" as const, additionalNamespaces: [{ namespace: "outbox" as const, expectedStorageVersion: 0 }] }
  const first = await f.port.transaction(request(), input, async (state) => {
    state.atlas.event = "event-1"
    state.outbox.event = outboxEntry("acknowledged")
    return { commit: true, value: "saved" }
  })
  expect(first.status).toBe("ok")
  expect(await f.port.transaction(request(), input, async () => { throw new Error("retry must not execute") })).toEqual(first)
  const before = structuredClone(f.storage.state.dashboard)
  expect(await f.port.transaction(request(), { ...input, additionalNamespaces: [] }, async () => {
    throw new Error("changed scope must not execute")
  })).toEqual({ status: "conflict", reason: "idempotency-content-changed" })
  expect(f.storage.state.dashboard).toEqual(before)
})

test("runtime rejects internal and prototype-key namespaces before work", async () => {
  const f = fixture()
  const before = structuredClone(f.storage.state.dashboard)
  for (const namespace of ["transactions", "__proto__", "constructor", "toString"]) {
    expect(await Reflect.apply(f.port.transaction, undefined, [request(), { ...command, namespace }, async () => {
      throw new Error("invalid namespace must not execute")
    }])).toEqual({ status: "conflict", reason: "invalid-expected-version" })
    expect(f.storage.state.dashboard).toEqual(before)
  }
})

function outboxEntry(label: string): SfAtlasOutboxEntry {
  const ref: SfAtlasOutboxEntry["eventRef"] = { schema: "sf-evidence-v1", kind: "case-event", refId: label, installationId: "test-installation", projectId: "test-project", refDigest: "", evidenceLevel: "decision", target: { caseId: "test-case", caseIncarnation: "test-incarnation", caseVersion: 1, eventId: label, outputDigest: "a".repeat(64), evidenceRefs: [] } }
  return { eventRef: { ...ref, refDigest: digestSfEvidenceRef(ref) }, writerPrincipalRef: authority.principalRef, accessRevision: authority.accessRevision, createdAt: "2026-11-13T00:00:00Z", attempts: 0, state: "pending" }
}
