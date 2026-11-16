import { expect, test } from "bun:test"
import { Schema } from "effect"
import { SfFiles } from "@orchestra/schema/sucafina/files"
import type { SfImportHistoryOwner } from "../../../../../../packages/app-shell/src/orchestra/chapters/sucafina/imports/history.ts"
import { readSfAuthorizedImportHistoryReference } from "../../../../../../packages/app-shell/src/orchestra/chapters/sucafina/imports/history.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { importHostFixture } from "../wp06/imports/host-fixture.ts"

type LiveFixture = Awaited<ReturnType<typeof importHostFixture>>
type ReadOptions = Parameters<typeof readSfAuthorizedImportHistoryReference>[0]
type LiveClient = ReadOptions["client"]

// Only the transport projection is adapted in these tests. The producer,
/// UI admission, actor, role policy, C08 persistence and Planner calculations
// are the original real SQLite/source services in the existing WP06 fixture.
function liveClient(app: LiveFixture): LiveClient {
  return {
    "files.import-reference": async (input, options) => {
      if (options.signal?.aborted) return { kind: "transport-error", reason: "aborted" }
      const payload = { importPreviewRef: input.importPreviewRef }
      const digest = digestSfValue(payload)
      const admitted = await app.ui.admit(app.request, "sf_import_preview", digest)
      if (admitted.status !== "ok") return {
        kind: "response", status: 403, headers: {}, body: { status: "denied" },
      }
      try {
        if (!await app.ui.validate(admitted.value, "sf_import_preview", digest)) return {
          kind: "response", status: 403, headers: {}, body: { status: "denied" },
        }
        const source = await app.imports.readPreviewReference(input.importPreviewRef, admitted.value)
        const body = Schema.decodeUnknownSync(SfFiles.operations["files.import-reference"].output)(source)
        return { kind: "response", status: source.status === "ok" ? 200 : source.status === "denied" ? 403 : 503,
          headers: {}, body }
      } finally { app.ui.finish(admitted.value) }
    },
    "files.import-detail": async (input, options) => {
      if (options.signal?.aborted) return { kind: "transport-error", reason: "aborted" }
      const payload = { manifestId: input.manifestId, version: input.version }
      const digest = digestSfValue(payload)
      const admitted = await app.ui.admit(app.request, "sf_import_preview", digest)
      if (admitted.status !== "ok") return {
        kind: "response", status: 403, headers: {}, body: { status: "denied" },
      }
      try {
        if (!await app.ui.validate(admitted.value, "sf_import_preview", digest)) return {
          kind: "response", status: 403, headers: {}, body: { status: "denied" },
        }
        const source = await app.imports.detail(payload, admitted.value)
        const body = Schema.decodeUnknownSync(SfFiles.operations["files.import-detail"].output)(source)
        return { kind: "response", status: source.status === "ok" ? 200 : source.status === "denied" ? 403 : source.status === "stale" ? 409 : 503,
          headers: {}, body }
      } finally { app.ui.finish(admitted.value) }
    },
  }
}

const rows = [["owned", "Licenses", "owned", "USD", "Forecast", 0]] as const
async function persistedFixture(app: LiveFixture) {
  const preview = await app.prepare(rows.map((row) => [...row]))
  if (preview.status !== "ok") throw new Error("REAL_IMPORT_PREVIEW_REQUIRED: " + preview.reason)
  const confirmed = await app.apply({ manifestId: preview.value.id, version: preview.value.version })
  if (confirmed.status !== "ok") throw new Error("REAL_IMPORT_APPLY_REQUIRED: " + confirmed.reason)
  const api = liveClient(app)
  const first = await api["files.import-reference"]({ surface: "planner", importPreviewRef: preview.value.id }, { signal: new AbortController().signal })
  if (first.kind !== "response" || first.body.status !== "ok") throw new Error("REAL_PERSISTED_RECEIPT_REQUIRED")
  const owner: SfImportHistoryOwner = {
    installationId: first.body.value.manifest.context.installationId,
    projectId: first.body.value.manifest.context.projectId,
    principalRef: first.body.value.manifest.context.principalRef,
    accessRevision: first.body.value.manifest.context.accessRevision,
    policyVersion: first.body.value.manifest.context.policyVersion,
  }
  return { id: preview.value.id, owner, api }
}
const read = (value: Awaited<ReturnType<typeof persistedFixture>>, signal = new AbortController().signal,
  isCurrent = () => true) => readSfAuthorizedImportHistoryReference({
    client: value.api, manifestId: value.id, surface: "planner",
    owner: value.owner, signal, isCurrent,
  })

test("218 real C08 confirmed receipt: read by owner, current manifest/version and detail, no new Apply", async () => {
  const app = await importHostFixture()
  try {
    const source = await persistedFixture(app)
    const before = await app.read()
    const result = await read(source)
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") throw new Error("AUTHORIZED_RECEIPT_NOT_READ")
    expect(result.reference.manifest.id).toBe(source.id)
    expect(result.reference.manifest.domainApplied).toBe(true)
    expect(result.reference.receipt).toMatchObject({ manifestId: source.id })
    expect(result.detail.detail.version).toBe(result.reference.manifest.version)
    expect(result.detail.digest).toBe(result.reference.digest)
    expect(await app.read()).toEqual(before)
  } finally { await app.close() }
})

test("218 revoked C08 actor denies the original receipt and never returns private data; return re-reads", async () => {
  const app = await importHostFixture()
  try {
    const source = await persistedFixture(app)
    app.policy.active = false
    expect(await read(source)).toMatchObject({ kind: "error", state: "denied" })
    app.policy.active = true
    expect((await read(source)).kind).toBe("ready")
  } finally { await app.close() }
})

test("218 wrong owner/principal, record version and invalid reference cannot be interpreted as authorized history", async () => {
  const app = await importHostFixture()
  try {
    const source = await persistedFixture(app)
    const mismatched = await readSfAuthorizedImportHistoryReference({
      client: source.api, manifestId: source.id, surface: "planner",
      owner: { ...source.owner, principalRef: "foreign-principal" },
      signal: new AbortController().signal, isCurrent: () => true,
    })
    expect(mismatched).toMatchObject({ kind: "error", state: "denied" })
    const badId = await readSfAuthorizedImportHistoryReference({
      client: source.api, manifestId: source.id + "\n", surface: "planner",
      owner: source.owner, signal: new AbortController().signal, isCurrent: () => true,
    })
    expect(badId).toMatchObject({ kind: "error", state: "invalid" })
    const notKnown = await readSfAuthorizedImportHistoryReference({
      client: source.api, manifestId: "not-an-existing-preview", surface: "planner",
      owner: source.owner, signal: new AbortController().signal, isCurrent: () => true,
    })
    expect(notKnown.kind).not.toBe("ready")
    // Private original producer may intentionally return denied instead of 404.
    expect(notKnown.kind === "error" && ["denied", "not-found", "unavailable"].includes(notKnown.state)).toBe(true)
  } finally { await app.close() }
})

test("218 late reply on owner swap is discarded even if the old producer later returns success", async () => {
  const app = await importHostFixture()
  try {
    const source = await persistedFixture(app)
    let entered!: () => void
    let release!: () => void
    const started = new Promise<void>((resolve) => { entered = resolve })
    const held = new Promise<void>((resolve) => { release = resolve })
    let generationCurrent = true
    const blocked: LiveClient = {
      ...source.api,
      "files.import-detail": async (input, options) => {
        entered()
        await held
        return source.api["files.import-detail"](input, options)
      },
    }
    const pending = readSfAuthorizedImportHistoryReference({
      client: blocked, manifestId: source.id, surface: "planner",
      owner: source.owner, signal: new AbortController().signal,
      isCurrent: () => generationCurrent,
    })
    await started
    generationCurrent = false
    release()
    expect(await pending).toEqual({ kind: "discarded" })
    expect((await read(source)).kind).toBe("ready")
  } finally { await app.close() }
})

test("218 lost read is unavailable, not removed/empty/confirmed/unknown-mutation", async () => {
  const app = await importHostFixture()
  try {
    const source = await persistedFixture(app)
    const api: LiveClient = {
      ...source.api,
      "files.import-detail": async () => ({ kind: "transport-error", reason: "network" }),
    }
    const result = await readSfAuthorizedImportHistoryReference({
      client: api, manifestId: source.id, surface: "planner",
      owner: source.owner, signal: new AbortController().signal, isCurrent: () => true,
    })
    expect(result).toEqual({ kind: "error", state: "unavailable" })
  } finally { await app.close() }
})
