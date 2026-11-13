import { expect, test } from "bun:test"
import type { Snapshot } from "../../../../runtime/contract.ts"
import type { SfStateAuthority, SfProductStatePort, SfProductState } from "../../../../product/contracts/state.ts"
import { createSfProductState } from "../../../../product/host-binding/state-provider.ts"
import { testPersistence } from "../../../fixture/persistence.ts"

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
    state.outbox.event = "acknowledged"
    return { commit: true, value: "saved" }
  })
  expect(result).toMatchObject({ status: "ok", storageVersion: 1, aggregateRevision: 1 })
  expect(await f.port.read(request(), "atlas", (state) => ({ atlas: state.atlas.event, outbox: state.outbox.event, versions: state.versions }))).toMatchObject({
    status: "ok", value: { atlas: "event-1", outbox: "acknowledged", versions: { atlas: 1, outbox: 1, preferences: 0 } },
  })
  const before = structuredClone(f.storage.state.dashboard)
  f.storage.fail.beforeCommit = true
  await expect(f.port.transaction(request(), { ...input, expectedStorageVersion: 1, additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: 1 }], idempotencyKey: "command-2" }, async (state) => {
    state.atlas.event = "event-2"
    state.outbox.event = "new"
    return { commit: true, value: "saved" }
  })).rejects.toThrow("Injected commit failure")
  expect(f.storage.state.dashboard).toEqual(before)
})

test("stale secondary namespace blocks all work", async () => {
  const f = fixture()
  expect((await f.port.transaction(request(), { ...command, namespace: "outbox" }, async (state) => {
    state.outbox.event = "existing"
    return { commit: true, value: null }
  })).status).toBe("ok")
  const before = structuredClone(f.storage.state.dashboard)
  expect(await f.port.transaction(request(), { ...command, namespace: "atlas", additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: 0 }] }, async () => {
    throw new Error("stale secondary must not execute")
  })).toEqual({ status: "conflict", reason: "product-state-changed" })
  expect(f.storage.state.dashboard).toEqual(before)
})

test("secondary authority revoked at egress rolls back both sections", async () => {
  let outboxChecks = 0
  const f = fixture(async (_request, _snapshot, namespace) => namespace === "outbox" && ++outboxChecks > 1 ? undefined : authority)
  const before = structuredClone(f.storage.state.dashboard)
  expect(await f.port.transaction(request(), { ...command, namespace: "atlas", additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: 0 }] }, async (state) => {
    state.atlas.event = "secret"
    state.outbox.event = "secret"
    return { commit: true, value: "secret" }
  })).toEqual({ status: "denied", reason: "product-authority-changed" })
  expect(f.storage.state.dashboard).toEqual(before)
})

test("retry with a changed admitted namespace scope conflicts without executing", async () => {
  const f = fixture()
  const input = { ...command, namespace: "atlas" as const, additionalNamespaces: [{ namespace: "outbox" as const, expectedStorageVersion: 0 }] }
  const first = await f.port.transaction(request(), input, async (state) => {
    state.atlas.event = "event-1"
    state.outbox.event = "acknowledged"
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
