import { expect, test } from "bun:test"
import { createProcurementSourceResolver, procurementSourceSelector } from "../../../product/procurement/sources.ts"
import type { ProductContext } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const context: ProductContext = { installationId: "i", projectId: "p", principalRef: "a", accessRevision: "1", policyVersion: "1", surface: "procurement", period: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", sourceRefs: [], capabilities: [] }
const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "a", accessRevision: "1", policyVersion: "1", requestId: "r", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext

test("source resolver uses authorized requester scope and lifecycle identity", async () => {
  const snapshot = { data: { store: { requests: { "PR-1": { request: { number: "PR-1", status: "draft", createdBy: "a", pr: { title: "Owned" } }, version: 4, by: "a" }, "PR-2": { request: { number: "PR-2", status: "draft", createdBy: "other" }, version: 4, by: "other" } }, settings: { currency: "USD" }, suppliers: [] } }, versions: {}, sequences: {}, audit: [], notices: [], sfSources: { schemaVersion: 1 as const, records: {
    [JSON.stringify(["procurement-request", "PR-1"])]: { incarnation: "one", version: 1, alive: true, inputDigest: "a".repeat(64) },
    [JSON.stringify(["procurement-request", "PR-2"])]: { incarnation: "two", version: 1, alive: true, inputDigest: "b".repeat(64) },
  } } }
  const identity = { role: "requester" }
  const resolve = createProcurementSourceResolver({
    contextFor: async () => ({ status: "ok", value: context }),
    host: {
      requestFor: () => new Request("https://local.invalid/procurement"), revalidate: async () => true,
      environment: async () => ({ at: "2026-01-01T00:00:00Z", directory: [], id: () => "unused" }),
      authenticate: async () => ({ id: "a", canWrite: true, roles: [{ surface: "procurement", role: identity.role }] }),
      persistence: { transaction: async (_surface, work) => (await work(structuredClone(snapshot))).value },
    },
  })
  const result = await resolve(procurementSourceSelector("procurement-request", "PR-1", "one", 1), binding)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.evidence.target).toMatchObject({ recordId: "PR-1", incarnation: "one", version: 1 })
  expect((await resolve(procurementSourceSelector("procurement-request", "PR-2", "two", 1), binding)).status).toBe("unavailable")
  expect((await resolve(procurementSourceSelector("procurement-request", "PR-1", "replacement", 1), binding)).status).toBe("stale")
  identity.role = "unrecognized"
  expect((await resolve(procurementSourceSelector("procurement-request", "PR-1", "one", 1), binding)).status).toBe("unavailable")
})

test("projection digest excludes bank details while retaining authorized business fields", async () => {
  const { digestProcurementSource } = await import("../../../product/procurement/sources.ts")
  const settings = { currency: "USD" }
  const before = { id: "s", legalName: "Supplier", iban: "private-a", history: [{ field: "account", value: "private-a" }] }
  const after = { id: "s", legalName: "Supplier", iban: "private-b", history: [{ field: "account", value: "private-b" }] }
  expect(digestProcurementSource(before, settings)).toBe(digestProcurementSource(after, settings))
  expect(digestProcurementSource(before, settings)).not.toBe(digestProcurementSource({ ...before, legalName: "Other" }, settings))
  const request = { number: "PR-1", createdBy: "a", status: "draft", pr: { title: "Owned", internalNote: "private-a" } }
  expect(digestProcurementSource(request, settings)).toBe(digestProcurementSource({ ...request, pr: { ...request.pr, internalNote: "private-b" } }, settings))
})
