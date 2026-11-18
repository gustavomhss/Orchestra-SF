import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import { createModule } from "../../../index.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { rows } from "../../../runtime/contract.ts"

/** A valid 256x128 24-bit BMP, larger than the Workbench budget and containing arbitrary binary octets. */
export function binaryUploadBytes() {
  const bytes = new Uint8Array(54 + 256 * 128 * 3)
  const header = new DataView(bytes.buffer)
  bytes.set([0x42, 0x4d])
  header.setUint32(2, bytes.byteLength, true)
  header.setUint32(10, 54, true)
  header.setUint32(14, 40, true)
  header.setInt32(18, 256, true)
  header.setInt32(22, 128, true)
  header.setUint16(26, 1, true)
  header.setUint16(28, 24, true)
  header.setUint32(34, 256 * 128 * 3, true)
  for (let offset = 54; offset < bytes.byteLength; offset++) bytes[offset] = offset % 256
  return bytes
}

/** Real upload/domain/SQLite/auth; scanner is an explicit exact-digest component fixture, not malware qualification. */
export async function binaryFixture(origin: string) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-body-binary-74-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const accepted = binaryUploadBytes()
    const acceptedDigest = createHash("sha256").update(accepted).digest("hex")
    const scans: { digest: string; type: string; bytes: number; accepted: boolean }[] = []
    const operator = { installationId: randomUUID(), uid: 1000, name: "Binary upload test operator" }
    const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator, secrets: store.secrets, key: randomBytes(32) })
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.contracts = [{ id: "binary-c1", vendor: "Binary fixture vendor" }]
      snapshot.versions["contracts:binary-c1"] = { version: 3, by: "fixture-initializer" }
      snapshot.versions.dataset = { version: 7, by: "fixture-initializer" }
      return { commit: true, value: undefined }
    })
    const handler = createModule("/sucafina", {
      persistence: store, authenticate: identity.authenticate,
      environment: async (request) => ({ at: "2026-11-13T08:00:00Z", id: randomUUID, directory: await identity.directory(request) }),
      assets: { persistence: store, services: {
        signingKey: randomBytes(32),
        scan: async (bytes, type) => {
          const digest = createHash("sha256").update(bytes).digest("hex")
          const allowed = digest === acceptedDigest && bytes.byteLength === accepted.byteLength && type === "image/bmp"
          scans.push({ digest, type, bytes: bytes.byteLength, accepted: allowed })
          return allowed
        },
      } },
      maxJsonBytes: 100000,
    })
    const response = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`))
    const cookie = response?.headers.get("set-cookie")?.split(";")[0]
    if (response?.status !== 303 || !cookie) throw new Error("Binary fixture enrollment failed")
    return {
      origin, cookie, handler, scans, accepted, acceptedDigest,
      uploadPath: (version = 3) => `/sucafina/dashboard?${new URLSearchParams({ page: "Vendor Contracts", upload: "contract", record: "binary-c1", recordVersion: String(version), name: "binary.bmp" })}`,
      async state() {
        return store.transaction("dashboard", async (snapshot, blobs) => ({ commit: false, value: {
          snapshot: structuredClone(snapshot),
          files: await Promise.all(rows(snapshot.data.assets).map(async (asset) => ({ key: asset.key, bytes: typeof asset.key === "string" ? await blobs.get(asset.key) : undefined }))),
        } }))
      },
      logout: () => identity.handle(new Request(`${origin}/sucafina/auth/logout`, { method: "POST", headers: { cookie, origin } })),
      async close() { await store.dispose(); await rm(directory, { recursive: true, force: true }) },
    }
  } catch (error) { await store.dispose(); await rm(directory, { recursive: true, force: true }); throw error }
}
