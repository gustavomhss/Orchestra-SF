import { expect, test } from "bun:test"
import path from "node:path"
import { createResidentAiBundle } from "../../../product/ai/resident.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { sfProductStateNamespaceFields, sfProductStateAdditiveFields } from "../../../product/contracts/state-layout.ts"
import { testPersistence } from "../../fixture/persistence.ts"
import type { SfProductState, SfStateNamespace } from "../../../product/contracts/state.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import freeze from "../../../product/contracts/freeze-v1.json"

const authority = { principalRef: "synthetic-principal", policyVersion: "policy-1", accessRevision: "access-1" }
const request = new Request("https://example.test/wp00-contract-consumer")
const command = { namespace: "preferences" as const, expectedStorageVersion: 0, targetRef: "preferences:synthetic-principal", targetIncarnation: "target-incarnation", idempotencyKey: "initial", commandDigest: "a".repeat(64) }

// These are acceptance assertions against current consumers. A failure remains a release blocker.
test("every declared operation has an actual exported producer in the composed candidate", async () => {
  const root = path.resolve(import.meta.dir, "../../../../../..")
  for (const operation of freeze.operations) {
    const source = await Bun.file(path.join(root, operation.handlerPath)).text()
    expect(source).toMatch(new RegExp(`export (?:async )?(?:function|const) ${operation.handlerExport}\\b`))
  }
})

test("the distributed five-profile/eighteen-skill bundle consumes the frozen C15 contract", async () => {
  const root = path.resolve(import.meta.dir, "../../../product/ai")
  const bundle = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/resident.json") })
  expect(bundle.profiles).toHaveLength(5)
  expect(bundle.skills).toHaveLength(18)
  expect(bundle.profiles.find((profile) => profile.id === "sf_portfolio")?.outputTypes).toContain("AlternativeDraft")
  expect(bundle.skills.find((skill) => skill.id === "sf-compor-portfolio")?.outputSchemaRefs).toContain("AlternativeDraft")
  expect(bundle.manifestDigest).toMatch(/^[a-f0-9]{64}$/)
})

test("the existing C08 provider creates all contracted namespace versions", async () => {
  const consumer = stateConsumer()
  expect(await consumer.port.transaction(request, command, async (state) => {
    state.preferences.theme = "dark"
    return { commit: true, value: "saved" }
  })).toMatchObject({ status: "ok", storageVersion: 1 })
  const stored = await consumer.port.read(request, "preferences", (state) => Object.keys(state.versions).sort())
  expect(stored).toMatchObject({ status: "ok", value: Object.keys(sfProductStateNamespaceFields).sort() })
})

test("C08 adds the v1 fields on an authorized write and an exact retry does not migrate twice", async () => {
  const initial = stateConsumer()
  expect(await initial.port.transaction(request, command, async () => ({ commit: true, value: "saved" }))).toMatchObject({ status: "ok" })
  const legacy = structuredClone(initial.storage.state.dashboard)
  const value = legacy.data.__sfProductV1 as Record<string, unknown>
  const versions = value.versions as Record<string, number>
  delete versions["bi-artifacts"]
  for (const field of sfProductStateAdditiveFields) delete value[field]
  const migrated = stateConsumer(legacy)
  const next = { ...command, idempotencyKey: "migrate", expectedStorageVersion: 1, commandDigest: "b".repeat(64) }
  expect(await migrated.port.transaction(request, next, async (state) => {
    state.preferences.theme = "light"
    return { commit: true, value: "migrated" }
  })).toMatchObject({ status: "ok", storageVersion: 2 })
  const once = structuredClone(migrated.storage.state.dashboard)
  const callbacks: string[] = []
  expect(await migrated.port.transaction(request, next, async () => {
    callbacks.push("unexpected-retry")
    return { commit: true, value: "duplicate" }
  })).toMatchObject({ status: "ok", storageVersion: 2, value: "migrated" })
  expect(callbacks).toEqual([])
  expect(migrated.storage.state.dashboard).toEqual(once)
  expect(await migrated.port.read(request, "bi-artifacts", (state) => ({ version: state.versions["bi-artifacts"], artifacts: state.biArtifacts }))).toMatchObject({ status: "ok", value: { version: 0, artifacts: {} } })
})

test("C08 checkNamespaces rejects a stale read dependency before invoking the write callback", async () => {
  const consumer = stateConsumer()
  expect(await consumer.port.transaction(request, command, async () => ({ commit: true, value: "initialized" }))).toMatchObject({ status: "ok" })
  const before = structuredClone(consumer.storage.state.dashboard)
  const callbacks: string[] = []
  const result = await consumer.port.transaction(request, { ...command, expectedStorageVersion: 1, idempotencyKey: "guarded", checkNamespaces: [{ namespace: "cases", expectedStorageVersion: 1 }] }, async (state) => {
    callbacks.push("unexpected-write")
    state.preferences.recalledCase = "stale-case"
    return { commit: true, value: "stale-write" }
  })
  expect(result).toMatchObject({ status: "conflict" })
  expect(callbacks).toEqual([])
  expect(consumer.storage.state.dashboard).toEqual(before)
})

test("C08 checkNamespaces requires current read authority and does not increment the read version", async () => {
  const consumer = stateConsumer()
  expect(await consumer.port.transaction(request, command, async () => ({ commit: true, value: "initialized" }))).toMatchObject({ status: "ok" })
  expect(await consumer.port.transaction(request, { ...command, expectedStorageVersion: 1, idempotencyKey: "read-fence", checkNamespaces: [{ namespace: "cases", expectedStorageVersion: 0 }] }, async (state) => {
    state.preferences.recalledCase = "authorized-case"
    return { commit: true, value: "saved" }
  })).toMatchObject({ status: "ok" })
  expect(consumer.authorizations).toContainEqual({ namespace: "cases", mode: "read" })
  expect(await consumer.port.read(request, "cases", (state) => state.versions.cases)).toMatchObject({ status: "ok", value: 0 })
})

test("C08 refuses an unreadable check namespace before invoking any write callback", async () => {
  const consumer = stateConsumer(undefined, "cases")
  expect(await consumer.port.transaction(request, command, async () => ({ commit: true, value: "initialized" }))).toMatchObject({ status: "ok" })
  const before = structuredClone(consumer.storage.state.dashboard)
  const callbacks: string[] = []
  const result = await consumer.port.transaction(request, {
    ...command,
    expectedStorageVersion: 1,
    idempotencyKey: "denied-read-fence",
    checkNamespaces: [{ namespace: "cases", expectedStorageVersion: 0 }],
  }, async (state) => {
    callbacks.push("unauthorized-callback")
    state.preferences.recalledCase = "unreadable-case"
    return { commit: true, value: "unauthorized-write" }
  })
  expect(result).toMatchObject({ status: "denied" })
  expect(consumer.authorizations).toContainEqual({ namespace: "cases", mode: "read" })
  expect(callbacks).toEqual([])
  expect(consumer.storage.state.dashboard).toEqual(before)
})

test("C08 namespace fences cover every additive field before a durable commit", async () => {
  for (const field of sfProductStateAdditiveFields) {
    const consumer = stateConsumer()
    const before = structuredClone(consumer.storage.state.dashboard)
    const result = await consumer.port.transaction(request, { ...command, idempotencyKey: `outside:${field}` }, async (state) => {
      Reflect.set(state, field, { unauthorized: { marker: "synthetic-only" } })
      return { commit: true, value: field }
    })
    expect(result).toMatchObject({ status: "denied" })
    expect(consumer.storage.state.dashboard).toEqual(before)
  }
})

test("C08 retains existing preference CAS and idempotency semantics", async () => {
  const consumer = stateConsumer()
  const callbacks: string[] = []
  const apply = async (state: SfProductState) => {
    callbacks.push("write")
    state.preferences.theme = "dark"
    return { commit: true, value: "saved" }
  }
  expect(await consumer.port.transaction(request, command, apply)).toMatchObject({ status: "ok", storageVersion: 1 })
  expect(await consumer.port.transaction(request, command, apply)).toMatchObject({ status: "ok", storageVersion: 1, value: "saved" })
  expect(callbacks).toEqual(["write"])
  expect(await consumer.port.transaction(request, { ...command, idempotencyKey: "stale" }, apply)).toMatchObject({ status: "conflict" })
  expect(await consumer.port.transaction(request, { ...command, commandDigest: "c".repeat(64) }, apply)).toMatchObject({ status: "conflict" })
  expect(callbacks).toEqual(["write"])
})

function stateConsumer(initial?: Snapshot, deniedRead?: SfStateNamespace) {
  const storage = testPersistence(initial ? { dashboard: initial } : {})
  const authorizations: { namespace: SfStateNamespace; mode: "read" | "write" }[] = []
  const port = createSfProductState({
    persistence: storage.persistence,
    authorize: async (_request, _snapshot, namespace, mode) => {
      authorizations.push({ namespace, mode })
      if (namespace === deniedRead && mode === "read") return undefined
      return authority
    },
    createId: () => "synthetic-state-incarnation",
    resolveTarget: async () => ({ incarnation: command.targetIncarnation }),
  })
  return { storage, port, authorizations }
}
