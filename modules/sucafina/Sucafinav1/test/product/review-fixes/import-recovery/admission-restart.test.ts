import { expect, test } from "bun:test"
import { object } from "../../../../runtime/contract.ts"
import { createAdmissionFixture } from "./admission-fixture.ts"

test("OPS-REV-04: blob commit survives restart and exact authorized admission publishes one catalog entry", async () => {
  const fixture = await createAdmissionFixture()
  try {
    const originalExpiry = new Date(fixture.clock.now + 60 * 60_000).toISOString()
    const before = await fixture.open("before-catalog")
    expect(await before.admit()).toEqual({ status: "unavailable", reason: "file-admission-unavailable" })
    expect(before.boundary.hits).toBe(1)
    const orphan = await before.inspect()
    expect(orphan.blob).toEqual(before.file.bytes)
    expect(orphan.admission).toBeDefined()
    expect(orphan.catalog).toBeUndefined()
    await before.close()
    await expect(before.inspect()).rejects.toThrow("disposed")

    fixture.clock.now += 20 * 60_000
    const reopened = await fixture.open()
    expect(reopened.request.headers.get("cookie")).not.toBe(before.request.headers.get("cookie"))
    expect(reopened.ref).toBe(before.ref)
    const recovered = await reopened.admit()
    expect(recovered.status).toBe("ok")
    if (recovered.status !== "ok") throw new Error(recovered.reason)
    expect(recovered.value).toEqual({
      ref: before.ref, digest: new Bun.CryptoHasher("sha256").update(before.file.bytes).digest("hex"),
      expiresAt: originalExpiry,
    })
    const context = await reopened.grant()
    expect(await reopened.files.read(recovered.value.ref, context)).toEqual({
      status: "ok", value: { bytes: before.file.bytes, digest: recovered.value.digest },
    })
    const published = await reopened.inspect()
    expect(published.blob).toEqual(orphan.blob)
    expect(published.admission).toEqual(orphan.admission)
    expect(published.catalog).toMatchObject({ id: recovered.value.ref, target: before.file.target, expiresAt: originalExpiry })
    const product = object(published.snapshot.data.__sfProductV1)
    expect(Object.keys(object(product.documents))).toEqual([`import-file:${recovered.value.ref}`])
    expect(object(product.versions).documents).toBe(1)
    expect(Object.keys(object(product.transactions))).toHaveLength(1)
    expect(await reopened.admit()).toEqual(recovered)
    expect(await reopened.inspect()).toEqual(published)
  } finally { await fixture.dispose() }
}, 30_000)

test("OPS-REV-04: divergent bytes, target, format and options cannot claim the orphan after restart", async () => {
  const fixture = await createAdmissionFixture()
  try {
    const before = await fixture.open("before-catalog")
    expect((await before.admit()).status).toBe("unavailable")
    await before.close()
    const reopened = await fixture.open()
    const orphan = await reopened.inspect()
    const divergent = [
      { ...reopened.file, bytes: new TextEncoder().encode('{"members":[{}]}') },
      { ...reopened.file, target: reopened.otherTarget },
      { ...reopened.file, format: "xlsx" as const },
      { ...reopened.file, target: { ...reopened.file.target, options: { ...reopened.file.target.options, removeMissing: true } } },
      { ...reopened.file, target: { ...reopened.file.target, options: { ...reopened.file.target.options, preview: { sheet: "Other" } } } },
    ]
    for (const changed of divergent) {
      expect(await reopened.admit(changed)).toEqual({ status: "conflict", reason: "file-admission-conflict" })
      expect(await reopened.inspect()).toEqual(orphan)
    }
    expect((await reopened.admit()).status).toBe("ok")
    expect((await reopened.inspect()).blob).toEqual(orphan.blob)
  } finally { await fixture.dispose() }
}, 30_000)

test("OPS-REV-04: uncertain catalog commit keeps bytes and recovers its original reference without republishing", async () => {
  const fixture = await createAdmissionFixture()
  try {
    const originalExpiry = new Date(fixture.clock.now + 60 * 60_000).toISOString()
    const before = await fixture.open("after-catalog")
    expect(await before.admit()).toEqual({ status: "unavailable", reason: "file-admission-unavailable" })
    expect(before.boundary).toEqual({ hits: 1, catalogCommitted: true })
    const committed = await before.inspect()
    expect(committed.catalog).toMatchObject({ id: before.ref, expiresAt: originalExpiry })
    expect(committed.blob).toEqual(before.file.bytes)
    expect(committed.admission).toBeDefined()
    await before.close()

    fixture.clock.now += 10 * 60_000
    const reopened = await fixture.open()
    expect(reopened.request.headers.get("cookie")).not.toBe(before.request.headers.get("cookie"))
    const recovered = await reopened.admit()
    expect(recovered.status).toBe("ok")
    if (recovered.status !== "ok") throw new Error(recovered.reason)
    expect(recovered.value.ref).toBe(before.ref)
    expect(recovered.value.expiresAt).toBe(originalExpiry)
    expect(reopened.boundary.hits).toBe(0)
    expect(await reopened.inspect()).toEqual(committed)
    expect(await reopened.admit()).toEqual(recovered)
    expect(await reopened.inspect()).toEqual(committed)
  } finally { await fixture.dispose() }
}, 30_000)

test("OPS-REV-04: durable session revocation before recovery denies a fresh post-restart grant", async () => {
  const fixture = await createAdmissionFixture()
  try {
    const before = await fixture.open("before-catalog")
    expect((await before.admit()).status).toBe("unavailable")
    await before.close()
    const reopened = await fixture.open()
    const orphan = await reopened.inspect()
    const context = await reopened.grant()
    expect((await reopened.logout())?.status).toBe(204)
    expect(await reopened.files.admit(reopened.file, context)).toEqual({ status: "denied", reason: "human-authority-required" })
    expect((await reopened.files.read(reopened.ref, context)).status).toBe("denied")
    expect(await reopened.inspect()).toEqual(orphan)
    await reopened.close()

    const authenticatedAgain = await fixture.open()
    expect((await authenticatedAgain.identity.person(reopened.request))).toBeNull()
    expect((await authenticatedAgain.admit()).status).toBe("ok")
  } finally { await fixture.dispose() }
}, 30_000)

test("OPS-REV-04: retry cannot extend an expired interrupted admission", async () => {
  const fixture = await createAdmissionFixture()
  try {
    const before = await fixture.open("before-catalog")
    expect((await before.admit()).status).toBe("unavailable")
    const orphan = await before.inspect()
    await before.close()
    fixture.clock.now += 60 * 60_000
    const reopened = await fixture.open()
    expect(await reopened.admit()).toEqual({ status: "conflict", reason: "file-admission-conflict" })
    expect(await reopened.inspect()).toEqual(orphan)
  } finally { await fixture.dispose() }
}, 30_000)

test("OPS-REV-04: legacy orphan without durable target proof remains unavailable and is never deleted", async () => {
  const fixture = await createAdmissionFixture()
  try {
    const before = await fixture.open()
    await before.store.transaction("dashboard", async (_, blobs) => {
      await blobs.put(`sf-import/${before.ref}`, before.file.bytes, "application/octet-stream")
      return { commit: true, value: undefined }
    })
    const orphan = await before.inspect()
    expect(orphan.admission).toBeUndefined()
    expect(orphan.catalog).toBeUndefined()
    await before.close()
    const reopened = await fixture.open()
    expect(await reopened.admit()).toEqual({ status: "conflict", reason: "file-admission-conflict" })
    expect(await reopened.inspect()).toEqual(orphan)
  } finally { await fixture.dispose() }
}, 30_000)

test("OPS-REV-04: concurrent identical recovery after restart publishes the catalog once", async () => {
  const fixture = await createAdmissionFixture()
  try {
    const before = await fixture.open("before-catalog")
    expect((await before.admit()).status).toBe("unavailable")
    const orphan = await before.inspect()
    await before.close()
    const reopened = await fixture.open()
    const [first, second] = await Promise.all([reopened.admit(), reopened.admit()])
    expect(first?.status).toBe("ok")
    expect(second).toEqual(first)
    const recovered = await reopened.inspect()
    expect(recovered.blob).toEqual(orphan.blob)
    expect(recovered.admission).toEqual(orphan.admission)
    const product = object(recovered.snapshot.data.__sfProductV1)
    expect(Object.keys(object(product.documents))).toEqual([`import-file:${reopened.ref}`])
    expect(object(product.versions).documents).toBe(1)
    expect(Object.keys(object(product.transactions))).toHaveLength(1)
    expect(await reopened.admit()).toEqual(first)
    expect(await reopened.inspect()).toEqual(recovered)
  } finally { await fixture.dispose() }
}, 30_000)


