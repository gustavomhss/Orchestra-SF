import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import type { ImportManifest } from "../../../../product/contracts/context.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import type { ImportDetail, ImportReceiptSummary } from "../../../../product/imports/store.ts"
import { createApplyRecoveryFixture, importResponse } from "./apply-fixture.ts"

type Recovery = { manifest: ImportManifest; detail: ImportDetail; digest: string; receipt: ImportReceiptSummary }
type Version = { id: string; lines: { id: string; b: number[]; a: (number | null)[]; f: (number | null)[] }[] }
type Composition = Awaited<ReturnType<Awaited<ReturnType<typeof createApplyRecoveryFixture>>["open"]>>

async function loseApplyResponse(app: Composition, cookie: string, payload: { manifestId: string; version: number }, intent: string) {
  const response = await app.call(cookie, "import-apply", payload, {}, intent)
  if (response.status !== 200) throw new Error(`Apply did not reach the loss boundary: ${response.status} ${await response.text()}`)
  // The real HTTP handler has settled the durable Apply. No response body or receipt reaches the caller.
  await response.body?.cancel()
  throw new Error("injected-response-lost-after-apply")
}

for (const newVersion of [false, true]) test(`E-OPS-02: lost Apply response, SQLite restart and fresh HTTP recovery preserve one effect (newVersion=${newVersion})`, async () => {
  const fixture = await createApplyRecoveryFixture()
  try {
    const first = await fixture.open()
    await fixture.seed(first)
    const cookie = await first.login()
    const preview = await first.prepare(cookie, newVersion)
    const payload = { manifestId: preview.id, version: preview.version }, intent = randomUUID()
    const before = await first.snapshots()
    await expect(loseApplyResponse(first, cookie, payload, intent)).rejects.toThrow("injected-response-lost-after-apply")
    const committed = await first.snapshots()
    const state = committed.dashboard.data.__sfProductV1 as SfProductState
    const priorState = before.dashboard.data.__sfProductV1 as SfProductState
    const receipts = Object.values(state.receipts)
    expect(receipts).toHaveLength(1)
    expect(state.versions.receipts).toBe(priorState.versions.receipts + 1)
    expect(state.versions.documents).toBe(priorState.versions.documents + 1)
    expect(state.revision).toBe(priorState.revision + 1)
    expect(Object.keys(state.transactions)).toHaveLength(Object.keys(priorState.transactions).length + 1)
    const versions = committed.planner.data.versions as Version[]
    expect(versions).toHaveLength(newVersion ? 2 : 1)
    const applied = versions.find((version) => newVersion ? version.id !== "v1" : version.id === "v1")!
    expect(applied.lines.find((line) => line.id === "fixed")!.f).toEqual([518000, ...Array(11).fill(null)])
    expect(applied.lines.find((line) => line.id === "renewal")!).toMatchObject({ b: Array(12).fill(0), a: Array(12).fill(null), f: [84000, ...Array(11).fill(null)] })
    if (newVersion) expect(versions.find((version) => version.id === "v1")).toEqual((before.planner.data.versions as Version[])[0])
    expect(committed.planner.audit.length).toBeGreaterThan(before.planner.audit.length)
    expect(committed.planner.versions).not.toEqual(before.planner.versions)
    await first.close()
    await expect(first.snapshots()).rejects.toThrow("Local store is disposed")
    expect((await first.call(cookie, "import-reference", undefined, { importPreviewRef: preview.id })).status).toBe(503)

    fixture.advance()
    const reopened = await fixture.open()
    expect(reopened.store).not.toBe(first.store)
    expect(reopened.authority).not.toBe(first.authority)
    expect(reopened.service).not.toBe(first.service)
    expect(reopened.installation.hostId).not.toBe(first.installation.hostId)
    const freshCookie = await reopened.login()
    expect(freshCookie).not.toBe(cookie)
    const recovered = await importResponse<Recovery>(await reopened.call(freshCookie, "import-reference", undefined, { importPreviewRef: preview.id }))
    expect(recovered.manifest).toMatchObject({ id: preview.id, version: preview.version, sourceDigest: preview.sourceDigest, state: "applied", domainApplied: true })
    expect(recovered.manifest.context).toEqual(preview.context)
    expect(recovered.manifest.commands).toEqual(preview.commands)
    const receipt = receipts[0]!
    const { result, ...publicReceipt } = receipt
    expect(result.ok).toBe(true)
    expect(recovered.manifest.receipts).toEqual([{ ...publicReceipt, status: "applied", errors: [] }])
    expect(recovered.receipt).toMatchObject({ receiptId: receipt.id, manifestId: preview.id, idempotencyKey: receipt.idempotencyKey, commandDigest: receipt.commandDigest, outcome: "applied" })
    expect(recovered.receipt.changedFields).toBeGreaterThan(0)
    expect(recovered.detail).toMatchObject({ manifestId: preview.id, version: preview.version, sourceDigest: preview.sourceDigest })
    const detail = await importResponse<{ detail: ImportDetail; digest: string; receipt: ImportReceiptSummary }>(await reopened.call(freshCookie, "import-detail", undefined, { manifestId: preview.id, version: String(preview.version) }))
    expect(detail).toEqual({ detail: recovered.detail, digest: recovered.digest, receipt: recovered.receipt })
    expect(await importResponse<ImportManifest>(await reopened.call(freshCookie, "import-apply", payload, {}, intent))).toEqual(recovered.manifest)
    expect(await reopened.snapshots()).toEqual(committed)
    const reread = await importResponse<Recovery>(await reopened.call(freshCookie, "import-reference", undefined, { importPreviewRef: preview.id }))
    expect(reread).toEqual(recovered)
  } finally { await fixture.dispose() }
}, 90_000)

test("E-OPS-02: durable session revocation before restart denies receipt recovery and exact Apply retry", async () => {
  const fixture = await createApplyRecoveryFixture()
  try {
    const first = await fixture.open()
    await fixture.seed(first)
    const cookie = await first.login()
    const preview = await first.prepare(cookie, false)
    const payload = { manifestId: preview.id, version: preview.version }, intent = randomUUID()
    await expect(loseApplyResponse(first, cookie, payload, intent)).rejects.toThrow("injected-response-lost-after-apply")
    const committed = await first.snapshots()
    const logout = await first.identity.handle(new Request(`${fixture.origin}/sucafina/auth/logout`, { method: "POST", headers: { cookie, origin: fixture.origin } }))
    expect(logout?.status).toBe(204)
    await first.close()
    fixture.advance()
    const reopened = await fixture.open()
    expect(await reopened.identity.person(new Request(`${fixture.origin}/sucafina/planner`, { headers: { cookie } }))).toBeNull()
    for (const response of [
      await reopened.call(cookie, "import-reference", undefined, { importPreviewRef: preview.id }),
      await reopened.call(cookie, "import-detail", undefined, { manifestId: preview.id, version: String(preview.version) }),
      await reopened.call(cookie, "import-apply", payload, {}, intent),
    ]) {
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ status: "denied" })
    }
    expect(await reopened.snapshots()).toEqual(committed)
  } finally { await fixture.dispose() }
}, 90_000)

test("E-OPS-02: persisted Planner grant revocation denies recovery after restart and fresh authentication", async () => {
  const fixture = await createApplyRecoveryFixture()
  try {
    const first = await fixture.open()
    await fixture.seed(first)
    const cookie = await first.login()
    const preview = await first.prepare(cookie, false)
    const payload = { manifestId: preview.id, version: preview.version }, intent = randomUUID()
    await expect(loseApplyResponse(first, cookie, payload, intent)).rejects.toThrow("injected-response-lost-after-apply")
    const committed = await first.snapshots()
    expect(await first.revokePlanner(cookie)).toEqual({ ok: true })
    const revoked = await first.snapshots()
    expect(revoked.planner.data.versions).toEqual(committed.planner.data.versions)
    expect(revoked.dashboard.data.__sfProductV1).toEqual(committed.dashboard.data.__sfProductV1)
    await first.close()
    fixture.advance()

    const reopened = await fixture.open()
    const freshCookie = await reopened.login()
    expect(freshCookie).not.toBe(cookie)
    expect(await reopened.identity.person(new Request(`${fixture.origin}/sucafina/planner`, { headers: { cookie: freshCookie } }))).toMatchObject({ id: fixture.principalRef })
    for (const response of [
      await reopened.call(freshCookie, "import-reference", undefined, { importPreviewRef: preview.id }),
      await reopened.call(freshCookie, "import-detail", undefined, { manifestId: preview.id, version: String(preview.version) }),
      await reopened.call(freshCookie, "import-apply", payload, {}, intent),
    ]) {
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ status: "denied" })
    }
    expect(await reopened.snapshots()).toEqual(revoked)
  } finally { await fixture.dispose() }
}, 90_000)
