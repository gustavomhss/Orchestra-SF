import { expect, test } from "bun:test"
import { createSfProductState } from "../../../../product/host-binding/state-provider.ts"
import { createSfDocumentSchemas } from "../../../../product/documents/schemas.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { documentTestPersistence } from "./fixture.ts"

test("human schema registration is versioned, source-bound and revocable", async () => {
  const storage = documentTestPersistence()
  const request = new Request("https://example.test/documents")
  const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "u", accessRevision: "a", policyVersion: "v", requestId: "r", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
  const state = createSfProductState({ persistence: storage.persistence, authorize: async () => ({ principalRef: "u", accessRevision: "a", policyVersion: "v" }), resolveTarget: async () => ({ incarnation: "workspace" }), createId: () => "state" })
  const bytes = new TextEncoder().encode("Price: 42")
  const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
  storage.state.dashboard.sfSources = { schemaVersion: 1, records: { [JSON.stringify(["document-asset", "doc"])]: { incarnation: "inc", version: 1, alive: true, inputDigest: digest } } }
  await state.transaction(request, { namespace: "documents", expectedStorageVersion: 0, targetRef: "workspace", targetIncarnation: "workspace", idempotencyKey: "init", commandDigest: "a".repeat(64) }, async (snapshot) => { snapshot.documents["asset:doc"] = { schema: "sf-asset-v1", documentId: "doc", assetId: "doc", surface: "dashboard", incarnation: "inc", revision: 1, blobDigest: digest }; return { commit: true, value: true } })
  let active = true
  let operation = "first"
  const documents = { read: async (ref: string) => active && ref === "doc" ? { status: "ok" as const, value: { documentId: "doc", incarnation: "inc", revision: 1, fileName: "terms.txt", mediaType: "text/plain" as const, blobDigest: { algorithm: "sha256" as const, value: digest }, bytes } } : { status: "denied" as const, reason: "revoked" }, revalidate: async () => active }
  const schemas = createSfDocumentSchemas({ state, documents, host: { requestFor: () => request, revalidate: async () => active }, creationTarget: { ref: "workspace", incarnation: "workspace" }, operationIdentity: () => operation, confirm: async (payload) => payload.documentRef === "doc" })
  const payload = { documentRef: "doc", fields: [{ id: "Price", type: "number" as const, unit: "USD" }] }
  const created = await schemas.register(payload, context)
  expect(created.status).toBe("ok")
  if (created.status !== "ok") return
  expect(await schemas.register(payload, context)).toEqual(created)
  expect(await schemas.resolve(created.value.ref, context, "doc")).toMatchObject({ status: "ok", value: { version: "1", fields: payload.fields } })
  expect((await schemas.resolve(created.value.ref, context, "other")).status).not.toBe("ok")
  operation = "second"
  const next = await schemas.register({ ...payload, id: created.value.id, expectedVersion: 1, fields: [{ id: "Price", type: "string" }] }, context)
  expect(next).toMatchObject({ status: "ok", value: { version: 2 } })
  if (next.status !== "ok") return
  expect((await schemas.resolve(created.value.ref, context, "doc")).status).not.toBe("ok")
  expect((await schemas.register({ ...payload, id: created.value.id, expectedVersion: 1 }, context)).status).toBe("conflict")
  active = false
  expect((await schemas.resolve(next.value.ref, context, "doc")).status).not.toBe("ok")
})
