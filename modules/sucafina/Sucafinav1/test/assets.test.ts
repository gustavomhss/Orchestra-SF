import { expect, test } from "bun:test"
import { assetLink, captureRecordAssets, deleteRecordAssets, downloadAsset, uploadAsset } from "../runtime/assets.ts"
import type { AssetPersistence, BlobTransaction } from "../runtime/assets.ts"
import type { Snapshot } from "../runtime/contract.ts"
import { empty } from "./fixture/persistence.ts"

function fixture() {
  const storage = {
    snapshot: empty(),
    blobs: new Map<string, Uint8Array>(),
    failCommit: false,
  }
  storage.snapshot.data.contracts = [{ id: "c1", vendor: "Vendor" }]
  const persistence: AssetPersistence = {
    async transaction(surface, work) {
      const next = structuredClone(storage.snapshot)
      const files = structuredClone(storage.blobs)
      const blobs: BlobTransaction = {
        put: async (key, value) => {
          files.set(key, new Uint8Array(value))
        },
        get: async (key) => files.get(key),
        remove: async (key) => {
          files.delete(key)
        },
      }
      const result = await work(next, blobs)
      if (storage.failCommit) throw new Error("Asset transaction failed")
      if (result.commit) {
        storage.snapshot = next
        storage.blobs = files
      }
      return result.value
    },
  }
  const actor = { id: "admin", canWrite: true, roles: ["admin"] }
  const environment = {
    at: "2026-11-11T12:00:00Z",
    id: () => "document-1",
    directory: [],
  }
  const services = {
    signingKey: new Uint8Array(32).fill(7),
    scan: async (bytes: Uint8Array) => !new TextDecoder().decode(bytes).includes("QUARANTINE"),
  }
  const file = {
    name: "contract.txt",
    type: "text/plain",
    bytes: new TextEncoder().encode("Agreed terms"),
  }
  return { storage, persistence, actor, environment, services, file }
}

test("private contract upload coordinates bytes, metadata, version and audit; scanner rejects without any write", async () => {
  const f = fixture()
  const command = {
    page: "Vendor Contracts",
    action: "upload",
    id: "c1",
    version: 0,
    values: {},
  }
  const result = await f.persistence.transaction("dashboard", async (snapshot, blobs) => {
    const value = await uploadAsset(snapshot, blobs, f.actor, command, f.environment, f.services, "contract", f.file)
    return { commit: value.ok, value }
  })
  expect(result.ok).toBe(true)
  expect(f.storage.blobs.get("contracts/c1/document-1")).toEqual(f.file.bytes)
  expect(f.storage.snapshot.data.contracts).toMatchObject([
    {
      docs: [
        {
          id: "document-1",
          key: "contracts/c1/document-1",
          name: "contract.txt",
          size: f.file.bytes.byteLength,
          bytes: f.file.bytes.byteLength,
          type: "text/plain",
        },
      ],
    },
  ])
  expect(f.storage.snapshot.versions["contracts:c1"]).toEqual({
    version: 1,
    by: "admin",
  })
  expect(f.storage.snapshot.audit).toHaveLength(1)
  const before = structuredClone(f.storage)
  const rejected = await f.persistence.transaction("dashboard", async (snapshot, blobs) => {
    const value = await uploadAsset(
      snapshot,
      blobs,
      f.actor,
      { ...command, version: 1 },
      f.environment,
      f.services,
      "contract",
      { ...f.file, bytes: new TextEncoder().encode("QUARANTINE") },
    )
    return { commit: value.ok, value }
  })
  expect(rejected.ok).toBe(false)
  expect(f.storage).toEqual(before)
})

test("asset transaction failure leaves neither visible metadata nor orphan bytes", async () => {
  const f = fixture()
  f.storage.failCommit = true
  const before = structuredClone(f.storage)
  await expect(
    f.persistence.transaction("dashboard", async (snapshot, blobs) => {
      const value = await uploadAsset(
        snapshot,
        blobs,
        f.actor,
        {
          page: "Vendor Contracts",
          action: "upload",
          id: "c1",
          version: 0,
          values: {},
        },
        f.environment,
        f.services,
        "contract",
        f.file,
      )
      return { commit: value.ok, value }
    }),
  ).rejects.toThrow("Asset transaction failed")
  expect(f.storage).toEqual(before)
})

test("signed private downloads expire after five minutes, bind the current identity and disappear with the contract", async () => {
  const f = fixture()
  await f.persistence.transaction("dashboard", async (snapshot, blobs) => {
    const result = await uploadAsset(
      snapshot,
      blobs,
      f.actor,
      {
        page: "Vendor Contracts",
        action: "upload",
        id: "c1",
        version: 0,
        values: {},
      },
      f.environment,
      f.services,
      "contract",
      f.file,
    )
    return { commit: result.ok, value: result }
  })
  const link = assetLink(f.storage.snapshot, f.actor, f.environment, f.services, "document-1")
  if (!link.ok || !("query" in link)) throw new Error("No private link")
  const get = (snapshot: Snapshot, blobs: BlobTransaction) =>
    downloadAsset(snapshot, blobs, f.actor, f.environment, f.services, new URLSearchParams(link.query))
  const response = await f.persistence.transaction("dashboard", async (snapshot, blobs) => ({
    commit: false,
    value: await get(snapshot, blobs),
  }))
  expect(await response.text()).toBe("Agreed terms")
  const expired = await f.persistence.transaction("dashboard", async (snapshot, blobs) => ({
    commit: false,
    value: await downloadAsset(
      snapshot,
      blobs,
      f.actor,
      { ...f.environment, at: "2026-11-11T12:05:00Z" },
      f.services,
      new URLSearchParams(link.query),
    ),
  }))
  expect(expired.status).toBe(403)
  const wrongUser = await f.persistence.transaction("dashboard", async (snapshot, blobs) => ({
    commit: false,
    value: await downloadAsset(
      snapshot,
      blobs,
      { ...f.actor, id: "other" },
      f.environment,
      f.services,
      new URLSearchParams(link.query),
    ),
  }))
  expect(wrongUser.status).toBe(403)
  await f.persistence.transaction("dashboard", async (snapshot, blobs) => {
    const captured = captureRecordAssets(snapshot, "contract", "c1")
    snapshot.data.contracts = []
    await deleteRecordAssets(snapshot, blobs, "contract", "c1", captured)
    return { commit: true, value: null }
  })
  expect(f.storage.blobs.size).toBe(0)
  expect(
    (
      await f.persistence.transaction("dashboard", async (snapshot, blobs) => ({
        commit: false,
        value: await get(snapshot, blobs),
      }))
    ).status,
  ).toBe(403)
})

test("procurement attachment ceiling is not inherited from contracts and cannot be supplied by the client", async () => {
  const f = fixture()
  f.storage.snapshot.data.store = {
    settings: { uploadCap: null },
    requests: { r1: { request: { createdBy: "buyer", status: "sourcing" } } },
  }
  const before = structuredClone(f.storage)
  const denied = await f.persistence.transaction("procurement", async (snapshot, blobs) => {
    const result = await uploadAsset(
      snapshot,
      blobs,
      { id: "buyer", canWrite: true, roles: ["buyer"] },
      {
        page: "Requests",
        action: "upload",
        id: "r1",
        version: 0,
        values: { uploadCap: 999999 },
      },
      f.environment,
      f.services,
      "quote",
      f.file,
    )
    return { commit: result.ok, value: result }
  })
  expect(denied).toMatchObject({ ok: false, status: 422 })
  expect(f.storage).toEqual(before)
  const store = f.storage.snapshot.data.store as {
    settings: { uploadCap: number | null }
  }
  store.settings.uploadCap = f.file.bytes.byteLength
  const accepted = await f.persistence.transaction("procurement", async (snapshot, blobs) => {
    const result = await uploadAsset(
      snapshot,
      blobs,
      { id: "buyer", canWrite: true, roles: ["buyer"] },
      {
        page: "Requests",
        action: "upload",
        id: "r1",
        version: 0,
        values: {},
      },
      f.environment,
      f.services,
      "quote",
      f.file,
    )
    return { commit: result.ok, value: result }
  })
  expect(accepted.ok).toBe(true)
})

function guardedBlobs() {
  const calls: string[] = []
  const blobs: BlobTransaction = {
    put: async (key) => {
      calls.push(`put:${key}`)
    },
    get: async (key) => {
      calls.push(`get:${key}`)
      return new Uint8Array([1])
    },
    remove: async (key) => {
      calls.push(`remove:${key}`)
    },
  }
  return { calls, blobs }
}

async function uploaded() {
  const f = fixture()
  await f.persistence.transaction("dashboard", async (snapshot, blobs) => {
    const value = await uploadAsset(
      snapshot,
      blobs,
      f.actor,
      {
        page: "Vendor Contracts",
        action: "upload",
        id: "c1",
        version: 0,
        values: {},
      },
      f.environment,
      f.services,
      "contract",
      f.file,
    )
    return { commit: value.ok, value }
  })
  return f
}

test("crafted imported index cannot redirect links, downloads or deletion to a victim blob", async () => {
  const f = await uploaded()
  const link = assetLink(f.storage.snapshot, f.actor, f.environment, f.services, "document-1")
  if (!link.ok || !("query" in link)) throw new Error("No link")
  const assets = f.storage.snapshot.data.assets as Record<string, unknown>[]
  assets[0]!.key = "supplier/victim/bank-document"
  expect(assetLink(f.storage.snapshot, f.actor, f.environment, f.services, "document-1")).toMatchObject({
    ok: false,
    status: 403,
  })
  const guarded = guardedBlobs()
  expect(
    (
      await downloadAsset(
        f.storage.snapshot,
        guarded.blobs,
        f.actor,
        f.environment,
        f.services,
        new URLSearchParams(link.query),
      )
    ).status,
  ).toBe(403)
  const before = structuredClone(f.storage.snapshot)
  await expect(deleteRecordAssets(f.storage.snapshot, guarded.blobs, "contract", "c1")).rejects.toThrow()
  expect(guarded.calls).toEqual([])
  expect(f.storage.snapshot).toEqual(before)
})

test("index alone never authorizes reads and metadata key mismatch fails closed", async () => {
  const f = await uploaded()
  const contract = (f.storage.snapshot.data.contracts as Record<string, unknown>[])[0]!
  const docs = contract.docs
  contract.docs = []
  expect(assetLink(f.storage.snapshot, f.actor, f.environment, f.services, "document-1")).toMatchObject({
    ok: false,
    status: 403,
  })
  contract.docs = docs
  const document = (contract.docs as Record<string, unknown>[])[0]!
  document.key = "contracts/other/document-1"
  const guarded = guardedBlobs()
  expect(assetLink(f.storage.snapshot, f.actor, f.environment, f.services, "document-1")).toMatchObject({
    ok: false,
    status: 403,
  })
  await expect(deleteRecordAssets(f.storage.snapshot, guarded.blobs, "contract", "c1")).rejects.toThrow()
  expect(guarded.calls).toEqual([])
})

test("permission, scan and CAS denial invoke no blob operations or audit", async () => {
  for (const condition of ["permission", "scan", "cas"] as const) {
    const f = fixture()
    const guarded = guardedBlobs()
    const before = structuredClone(f.storage.snapshot)
    const value = await uploadAsset(
      f.storage.snapshot,
      guarded.blobs,
      condition === "permission" ? { ...f.actor, canWrite: false } : f.actor,
      {
        page: "Vendor Contracts",
        action: "upload",
        id: "c1",
        version: condition === "cas" ? 1 : 0,
        values: {},
      },
      f.environment,
      condition === "scan" ? { ...f.services, scan: async () => false } : f.services,
      "contract",
      f.file,
    )
    expect(value.ok).toBe(false)
    expect(guarded.calls).toEqual([])
    expect(f.storage.snapshot).toEqual(before)
  }
})

test("current role revocation, removed parent metadata and invalid clock deny signed downloads", async () => {
  const f = await uploaded()
  const link = assetLink(f.storage.snapshot, f.actor, f.environment, f.services, "document-1")
  if (!link.ok || !("query" in link)) throw new Error("No link")
  const guarded = guardedBlobs()
  for (const actor of [
    { ...f.actor, roles: [] },
    { ...f.actor, roles: ["viewer"] },
  ]) {
    expect(
      (
        await downloadAsset(
          f.storage.snapshot,
          guarded.blobs,
          actor,
          f.environment,
          f.services,
          new URLSearchParams(link.query),
        )
      ).status,
    ).toBe(403)
  }
  expect(
    (
      await downloadAsset(
        f.storage.snapshot,
        guarded.blobs,
        f.actor,
        { ...f.environment, at: "invalid" },
        f.services,
        new URLSearchParams(link.query),
      )
    ).status,
  ).toBe(403)
  ;(f.storage.snapshot.data.contracts as Record<string, unknown>[])[0]!.docs = []
  expect(
    (
      await downloadAsset(
        f.storage.snapshot,
        guarded.blobs,
        f.actor,
        f.environment,
        f.services,
        new URLSearchParams(link.query),
      )
    ).status,
  ).toBe(403)
  expect(guarded.calls).toEqual([])
})

test("unsafe record and generated document ids are rejected without blob calls", async () => {
  for (const id of [
    "",
    ".",
    "..",
    "__proto__",
    "constructor",
    "prototype",
    "a/b",
    "a\\b",
    "a\u0000b",
    "a\nb",
    "bad%2Fid",
    "\ud800",
  ]) {
    const f = fixture()
    const guarded = guardedBlobs()
    expect(
      (
        await uploadAsset(
          f.storage.snapshot,
          guarded.blobs,
          f.actor,
          {
            page: "Vendor Contracts",
            action: "upload",
            id,
            version: 0,
            values: {},
          },
          f.environment,
          f.services,
          "contract",
          f.file,
        )
      ).ok,
    ).toBe(false)
    expect(
      (
        await uploadAsset(
          f.storage.snapshot,
          guarded.blobs,
          f.actor,
          {
            page: "Vendor Contracts",
            action: "upload",
            id: "c1",
            version: 0,
            values: {},
          },
          { ...f.environment, id: () => id },
          f.services,
          "contract",
          f.file,
        )
      ).ok,
    ).toBe(false)
    expect(guarded.calls).toEqual([])
  }
})

test("capture is bound, unforgeable and supports metadata-only cleanup after parent deletion", async () => {
  const f = await uploaded()
  f.storage.snapshot.data.assets = []
  const captured = captureRecordAssets(f.storage.snapshot, "contract", "c1")
  f.storage.snapshot.data.contracts = []
  const guarded = guardedBlobs()
  await deleteRecordAssets(f.storage.snapshot, guarded.blobs, "contract", "c1", captured)
  expect(guarded.calls).toEqual(["remove:contracts/c1/document-1"])
  await expect(deleteRecordAssets(f.storage.snapshot, guarded.blobs, "contract", "other", captured)).rejects.toThrow()
  await expect(
    deleteRecordAssets(f.storage.snapshot, guarded.blobs, "contract", "c1", {
      kind: "contract",
      record: "c1",
    }),
  ).rejects.toThrow()
})

test("all metadata is validated before any deletion, including the second document", async () => {
  const f = await uploaded()
  const contract = (f.storage.snapshot.data.contracts as Record<string, unknown>[])[0]!
  ;(contract.docs as Record<string, unknown>[]).push({
    id: "second",
    key: "supplier/victim/private",
  })
  const guarded = guardedBlobs()
  const before = structuredClone(f.storage.snapshot)
  await expect(deleteRecordAssets(f.storage.snapshot, guarded.blobs, "contract", "c1")).rejects.toThrow()
  expect(guarded.calls).toEqual([])
  expect(f.storage.snapshot).toEqual(before)
})

test("canonical keys encode safe IDs and preserve procurement metadata on attachments", async () => {
  const f = fixture()
  const guarded = guardedBlobs()
  f.storage.snapshot.data.store = {
    settings: { uploadCap: 1024 },
    requests: {
      "PR 1": {
        request: { number: "PR 1", createdBy: "buyer", status: "sourcing" },
      },
    },
  }
  const actor = { id: "buyer", canWrite: true, roles: ["buyer"] }
  const value = await uploadAsset(
    f.storage.snapshot,
    guarded.blobs,
    actor,
    { page: "Requests", action: "upload", id: "PR 1", version: 0, values: {} },
    { ...f.environment, id: () => "résumé 1" },
    f.services,
    "quote",
    f.file,
  )
  expect(value.ok).toBe(true)
  expect(guarded.calls).toEqual(["put:quote/PR%201/r%C3%A9sum%C3%A9%201"])
  const store = f.storage.snapshot.data.store as {
    requests: Record<string, { request: Record<string, unknown> }>
  }
  expect(store.requests["PR 1"]?.request.attachments).toMatchObject([
    { id: "résumé 1", key: "quote/PR%201/r%C3%A9sum%C3%A9%201" },
  ])
  expect(store.requests["PR 1"]?.request.docs).toBeUndefined()
  expect(assetLink(f.storage.snapshot, actor, f.environment, f.services, "résumé 1").ok).toBe(true)
  expect(
    assetLink(
      f.storage.snapshot,
      { id: "other", canWrite: true, roles: ["requester"] },
      f.environment,
      f.services,
      "résumé 1",
    ),
  ).toMatchObject({ ok: false, status: 403 })
})

test("unknown kind, duplicate index and inconsistent metadata all deny without blob reads", async () => {
  for (const corruption of ["kind", "duplicate", "metadata"] as const) {
    const f = await uploaded()
    const link = assetLink(f.storage.snapshot, f.actor, f.environment, f.services, "document-1")
    if (!link.ok || !("query" in link)) throw new Error("No link")
    const assets = f.storage.snapshot.data.assets as Record<string, unknown>[]
    if (corruption === "kind") assets[0]!.kind = "unknown"
    if (corruption === "duplicate") assets.push({ ...assets[0] })
    if (corruption === "metadata") assets[0]!.name = "private-path"
    const guarded = guardedBlobs()
    expect(assetLink(f.storage.snapshot, f.actor, f.environment, f.services, "document-1")).toMatchObject({
      ok: false,
      status: 403,
    })
    expect(
      (
        await downloadAsset(
          f.storage.snapshot,
          guarded.blobs,
          f.actor,
          f.environment,
          f.services,
          new URLSearchParams(link.query),
        )
      ).status,
    ).toBe(403)
    expect(guarded.calls).toEqual([])
  }
})

test("a valid signed link cannot be rebound to another parent's canonical metadata", async () => {
  const f = await uploaded()
  const link = assetLink(f.storage.snapshot, f.actor, f.environment, f.services, "document-1")
  if (!link.ok || !("query" in link)) throw new Error("No link")
  const assets = f.storage.snapshot.data.assets as Record<string, unknown>[]
  assets[0]!.record = "c2"
  assets[0]!.key = "contracts/c2/document-1"
  f.storage.snapshot.data.contracts = [
    {
      id: "c2",
      vendor: "Other",
      docs: [
        {
          id: "document-1",
          key: "contracts/c2/document-1",
          name: f.file.name,
          type: f.file.type,
          bytes: f.file.bytes.byteLength,
        },
      ],
    },
  ]
  expect(assetLink(f.storage.snapshot, f.actor, f.environment, f.services, "document-1").ok).toBe(true)
  const guarded = guardedBlobs()
  expect(
    (
      await downloadAsset(
        f.storage.snapshot,
        guarded.blobs,
        f.actor,
        f.environment,
        f.services,
        new URLSearchParams(link.query),
      )
    ).status,
  ).toBe(403)
  expect(guarded.calls).toEqual([])
})

test("captures cannot cross snapshots or be reused after cleanup", async () => {
  const f = await uploaded()
  const captured = captureRecordAssets(f.storage.snapshot, "contract", "c1")
  const guarded = guardedBlobs()
  await expect(
    deleteRecordAssets(structuredClone(f.storage.snapshot), guarded.blobs, "contract", "c1", captured),
  ).rejects.toThrow()
  expect(guarded.calls).toEqual([])
  f.storage.snapshot.data.contracts = []
  await deleteRecordAssets(f.storage.snapshot, guarded.blobs, "contract", "c1", captured)
  await expect(deleteRecordAssets(f.storage.snapshot, guarded.blobs, "contract", "c1", captured)).rejects.toThrow()
  expect(guarded.calls).toEqual(["remove:contracts/c1/document-1"])
})

test("prototype-named requests cannot become attachment parents", async () => {
  const f = fixture()
  f.storage.snapshot.data.store = {
    settings: { uploadCap: 1024 },
    requests: {},
  }
  const guarded = guardedBlobs()
  expect(
    (
      await uploadAsset(
        f.storage.snapshot,
        guarded.blobs,
        { id: "buyer", roles: ["buyer"], canWrite: true },
        {
          page: "Requests",
          action: "upload",
          id: "__proto__",
          version: 0,
          values: {},
        },
        f.environment,
        f.services,
        "quote",
        f.file,
      )
    ).ok,
  ).toBe(false)
  expect(guarded.calls).toEqual([])
})

test("index tampering after capture is rejected before deletion", async () => {
  const f = await uploaded()
  const captured = captureRecordAssets(f.storage.snapshot, "contract", "c1")
  f.storage.snapshot.data.contracts = []
  ;(f.storage.snapshot.data.assets as Record<string, unknown>[])[0]!.key = "supplier/victim/blob"
  const guarded = guardedBlobs()
  await expect(deleteRecordAssets(f.storage.snapshot, guarded.blobs, "contract", "c1", captured)).rejects.toThrow(
    "Attachment index changed after capture",
  )
  expect(guarded.calls).toEqual([])
})

test("missing metadata keys and signing configuration never fall back to permissive access", async () => {
  const f = await uploaded()
  expect(() =>
    assetLink(
      f.storage.snapshot,
      f.actor,
      f.environment,
      { ...f.services, signingKey: new Uint8Array(0) },
      "document-1",
    ),
  ).toThrow("Installation signing key")
  const contract = (f.storage.snapshot.data.contracts as Record<string, unknown>[])[0]!
  delete (contract.docs as Record<string, unknown>[])[0]!.key
  expect(assetLink(f.storage.snapshot, f.actor, f.environment, f.services, "document-1")).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(() => captureRecordAssets(f.storage.snapshot, "contract", "c1")).toThrow("Invalid attachment binding")
})
