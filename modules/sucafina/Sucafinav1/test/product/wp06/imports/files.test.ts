import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { createSfUiAuthority } from "../../../../product/integration/ui-authority.ts"
import { parseAdmittedImport } from "../../../../product/imports/files.ts"

async function fixture() {
  const request = new Request("https://example.test/import")
  const ui = createSfUiAuthority({
    authorize: async (input) => input === request ? { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a" } : undefined,
    createId: () => "request-1", now: () => Date.parse("2026-11-13T04:01:10Z"), commandIdentity: async () => "command-1",
  })
  const admitted = await ui.admit(request, "sf_import_preview", "a".repeat(64))
  if (admitted.status !== "ok") throw new Error(admitted.reason)
  return admitted.value
}

test("private file parsing preserves zero and null and detects changed bytes", async () => {
  const context = await fixture()
  const bytes = new TextEncoder().encode('{"zero":0,"empty":null,"text":"a,b|c"}')
  const digest = createHash("sha256").update(bytes).digest("hex")
  const request = { admittedFileRef: "private", format: "json", options: {} }
  const host = { read: async () => ({ status: "ok" as const, value: { bytes, digest } }), revalidate: async () => true }
  expect(await parseAdmittedImport(request, context, host)).toEqual({ status: "ok", value: { sourceDigest: digest, format: "json", data: { zero: 0, empty: null, text: "a,b|c" } } })
  expect((await parseAdmittedImport(request, context, { ...host, read: async () => ({ status: "ok" as const, value: { bytes, digest: "0".repeat(64) } }) })).status).toBe("stale")
  expect((await parseAdmittedImport(request, context, { ...host, revalidate: async () => false })).status).toBe("denied")
})

test("file format mismatch and malformed backups fail without a parsed value", async () => {
  const context = await fixture()
  const bytes = new TextEncoder().encode("[]")
  const digest = createHash("sha256").update(bytes).digest("hex")
  const host = { read: async () => ({ status: "ok" as const, value: { bytes, digest } }), revalidate: async () => true }
  expect((await parseAdmittedImport({ admittedFileRef: "private", format: "json", options: {} }, context, host)).status).toBe("needs-input")
  expect((await parseAdmittedImport({ admittedFileRef: "private", format: "xlsx", options: {} }, context, host)).status).toBe("needs-input")
})
