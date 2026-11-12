import { createHmac, timingSafeEqual } from "node:crypto"
import type { Actor, Command, Environment, Result, Snapshot, TransactionOptions } from "./contract.ts"
import { changed, conflict, object, rows, text } from "./contract.ts"
import type { Surface } from "../src/identity.ts"
import { dashboardPages, procurementKeys } from "../src/nav.ts"

export type AssetKind = "contract" | "quote" | "signed-po" | "supplier"
export type Asset = {
  id: string
  record: string
  kind: AssetKind
  key: string
  name: string
  type: string
  bytes: number
}
export type BlobTransaction = {
  put: (key: string, bytes: Uint8Array, type: string) => Promise<void>
  get: (key: string) => Promise<Uint8Array | undefined>
  remove: (key: string) => Promise<void>
}
export type AssetPersistence = {
  // Both database state and PRIVATE object-store changes must commit together, or all roll back.
  transaction: <T>(
    surface: Surface,
    work: (snapshot: Snapshot, blobs: BlobTransaction) => Promise<{ commit: boolean; value: T }>,
    options?: TransactionOptions,
  ) => Promise<T>
}
export type AssetServices = {
  scan: (bytes: Uint8Array, type: string) => Promise<boolean>
  signingKey: Uint8Array
}
const CONTRACT_EXTENSIONS = new Set([
  "pdf",
  "txt",
  "csv",
  "md",
  "json",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "tif",
  "tiff",
  "bmp",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
])

// Cleanup captures are process-local capabilities, never accepted from HTTP or backup JSON.
export type CapturedAssets = {
  readonly kind: AssetKind
  readonly record: string
}
const captures = new WeakMap<
  CapturedAssets,
  {
    snapshot: Snapshot
    keys: string[]
    ids: string[]
    index: Record<string, unknown>[]
  }
>()

export async function uploadAsset(
  snapshot: Snapshot,
  blobs: BlobTransaction,
  actor: Actor,
  command: Command,
  environment: Environment,
  services: AssetServices,
  kind: AssetKind,
  file: { name: string; type: string; bytes: Uint8Array },
): Promise<Result> {
  if (!actor.canWrite) return { ok: false, status: 403 }
  if (!isKind(kind) || !safeId(command.id)) return { ok: false, status: 400 }
  const record = findRecord(snapshot, kind, command.id)
  if (!record) return { ok: false, status: 404 }
  if (!canChange(actor, kind, record)) return { ok: false, status: 403 }
  if (!Number.isSafeInteger(command.version) || command.version < 0) return { ok: false, status: 400 }
  const versionKey = `${kind === "contract" ? "contracts" : kind === "supplier" ? "suppliers" : "requests"}:${command.id}`
  const stale = conflict(snapshot, versionKey, command, record)
  if (stale) return stale
  const cap =
    kind === "contract"
      ? 25 * 1024 * 1024
      : (object(object(snapshot.data.store).settings).uploadCap ??
        object(snapshot.data.attachmentCap).value ??
        snapshot.data.attachmentCap)
  if (typeof cap !== "number" || !Number.isFinite(cap) || cap <= 0)
    return {
      ok: false,
      status: 422,
      errors: ["Attachment limit is not configured."],
    }
  if (file.bytes.byteLength > cap)
    return {
      ok: false,
      status: 422,
      errors: ["Attachment exceeds the configured limit."],
    }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (!file.name || /[\r\n\0]/.test(file.name) || (kind === "contract" && !CONTRACT_EXTENSIONS.has(extension)))
    return { ok: false, status: 422, errors: ["Unsupported file."] }
  if (!(await services.scan(file.bytes, file.type)))
    return {
      ok: false,
      status: 422,
      errors: ["The file was not accepted by the scanner."],
    }
  const id = environment.id()
  if (!safeId(id)) return { ok: false, status: 422 }
  const key = canonicalKey(kind, command.id, id)
  if (
    rows(snapshot.data.assets).some((item) => identifier(item.id) === id) ||
    metadata(record, kind).some((item) => identifier(item.id) === id)
  )
    return { ok: false, status: 409 }
  const asset: Asset = {
    id,
    record: command.id,
    kind,
    key,
    name: file.name,
    type: file.type || "application/octet-stream",
    bytes: file.bytes.byteLength,
  }
  const before = structuredClone(record)
  await blobs.put(key, file.bytes, asset.type)
  snapshot.data.assets = [...rows(snapshot.data.assets), asset]
  const field = kind === "contract" ? "docs" : "attachments"
  record[field] = [
    ...rows(record[field]),
    {
      id,
      name: asset.name,
      key,
      type: asset.type,
      bytes: asset.bytes,
      size: asset.bytes,
    },
  ]
  changed(snapshot, versionKey, actor, environment.at, before, record)
  return { ok: true, value: { id, name: asset.name } }
}

export function assetLink(
  snapshot: Snapshot,
  actor: Actor,
  environment: Environment,
  services: AssetServices,
  id: string,
): { ok: true; query: string; expires: string } | Result {
  const asset = boundAsset(snapshot, id)
  const now = new Date(environment.at).getTime()
  if (!asset || !Number.isFinite(now) || !canRead(snapshot, actor, asset)) return { ok: false, status: 403 }
  requireSigningKey(services.signingKey)
  const expiry = now + 5 * 60 * 1000
  const signature = sign(asset, actor.id, expiry, services.signingKey)
  return {
    ok: true,
    query: new URLSearchParams({
      asset: id,
      expires: String(expiry),
      signature,
    }).toString(),
    expires: new Date(expiry).toISOString(),
  }
}

export async function downloadAsset(
  snapshot: Snapshot,
  blobs: BlobTransaction,
  actor: Actor,
  environment: Environment,
  services: AssetServices,
  query: URLSearchParams,
): Promise<Response> {
  const asset = boundAsset(snapshot, query.get("asset") ?? "")
  const expiry = Number(query.get("expires"))
  const now = new Date(environment.at).getTime()
  const signature = query.get("signature") ?? ""
  if (
    !asset ||
    !Number.isFinite(now) ||
    !Number.isSafeInteger(expiry) ||
    expiry <= now ||
    expiry > now + 5 * 60 * 1000 ||
    !canRead(snapshot, actor, asset)
  )
    return denied()
  requireSigningKey(services.signingKey)
  const expected = sign(asset, actor.id, expiry, services.signingKey)
  if (
    !/^[a-f0-9]{64}$/.test(signature) ||
    !timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))
  )
    return denied()
  const bytes = await blobs.get(canonicalKey(asset.kind, asset.record, asset.id))
  if (!bytes)
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    })
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  })
}

/** Call inside the deletion transaction while the persisted parent still exists. This validates binding, not business permission. */
export function captureRecordAssets(snapshot: Snapshot, kind: AssetKind, record: string): CapturedAssets {
  if (!isKind(kind) || !safeId(record)) throw new Error("Invalid attachment binding")
  const parent = findRecord(snapshot, kind, record)
  if (!parent) throw new Error("Attachment parent is missing")
  const documents = metadata(parent, kind)
  const indexed = rows(snapshot.data.assets).filter(
    (asset) => asset.kind === kind && identifier(asset.record) === record,
  )
  const keys = documents.map((document) => {
    const id = identifier(document.id)
    if (!safeId(id)) throw new Error("Invalid attachment binding")
    const key = canonicalKey(kind, record, id)
    if (document.key !== key) throw new Error("Invalid attachment binding")
    const index = rows(snapshot.data.assets).filter((asset) => identifier(asset.id) === id)
    // Metadata-only migrated documents can be removed, but an index must agree if present.
    if (
      index.length &&
      (index.length !== 1 ||
        !boundAsset(snapshot, id) ||
        index[0]?.kind !== kind ||
        identifier(index[0]?.record) !== record)
    )
      throw new Error("Invalid attachment binding")
    return key
  })
  if (indexed.some((asset) => !boundAsset(snapshot, identifier(asset.id))))
    throw new Error("Invalid attachment binding")
  const captured = Object.freeze({ kind, record })
  const ids = documents.map((document) => identifier(document.id))
  captures.set(captured, {
    snapshot,
    keys: [...new Set(keys)],
    ids,
    index: structuredClone(
      rows(snapshot.data.assets).filter(
        (asset) => ids.includes(identifier(asset.id)) || (asset.kind === kind && identifier(asset.record) === record),
      ),
    ),
  })
  return captured
}

/** After authorized domain deletion, pass the exact capture from the same snapshot/transaction. */
export async function deleteRecordAssets(
  snapshot: Snapshot,
  blobs: BlobTransaction,
  kind: AssetKind,
  record: string,
  captured?: CapturedAssets,
) {
  const token = captured ?? captureRecordAssets(snapshot, kind, record)
  const validated = captures.get(token)
  if (
    !validated ||
    validated.snapshot !== snapshot ||
    token.kind !== kind ||
    token.record !== record ||
    !isKind(kind) ||
    !safeId(record)
  )
    throw new Error("Invalid attachment capture")
  const currentIndex = rows(snapshot.data.assets).filter(
    (asset) =>
      validated.ids.includes(identifier(asset.id)) || (asset.kind === kind && identifier(asset.record) === record),
  )
  if (JSON.stringify(currentIndex) !== JSON.stringify(validated.index))
    throw new Error("Attachment index changed after capture")
  for (const key of validated.keys) await blobs.remove(key)
  snapshot.data.assets = rows(snapshot.data.assets).filter(
    (asset) =>
      !(asset.kind === kind && identifier(asset.record) === record && validated.keys.includes(text(asset.key))),
  )
  captures.delete(token)
}

function identifier(value: unknown) {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) ? String(value) : ""
}
function safeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    value.isWellFormed() &&
    ![".", "..", "__proto__", "constructor", "prototype"].includes(value) &&
    !/[/\\%\x00-\x1f\x7f]/.test(value)
  )
}
function isKind(kind: unknown): kind is AssetKind {
  return kind === "contract" || kind === "quote" || kind === "signed-po" || kind === "supplier"
}
function canonicalKey(kind: AssetKind, record: string, id: string) {
  return `${kind === "contract" ? "contracts" : kind}/${encodeURIComponent(record)}/${encodeURIComponent(id)}`
}
function metadata(record: Record<string, unknown>, kind: AssetKind) {
  return kind === "contract" ? [...rows(record.docs), ...rows(record.documents)] : rows(record.attachments)
}
function boundAsset(snapshot: Snapshot, id: string): Asset | undefined {
  if (!safeId(id)) return undefined
  const candidates = rows(snapshot.data.assets).filter((asset) => identifier(asset.id) === id)
  if (candidates.length !== 1) return undefined
  const asset = candidates[0]
  if (!asset || !isKind(asset.kind)) return undefined
  const recordId = identifier(asset.record)
  if (!safeId(recordId)) return undefined
  const key = canonicalKey(asset.kind, recordId, id)
  if (asset.key !== key) return undefined
  const parent = findRecord(snapshot, asset.kind, recordId)
  if (!parent) return undefined
  const documents = metadata(parent, asset.kind).filter((document) => identifier(document.id) === id)
  if (!documents.length || documents.some((document) => document.key !== key)) return undefined
  const document = documents[0]
  if (!document || typeof document.name !== "string" || !document.name || /[\r\n\0]/.test(document.name))
    return undefined
  if (
    asset.name !== document.name ||
    asset.type !== document.type ||
    asset.bytes !== (document.bytes ?? document.size) ||
    documents.some(
      (entry) =>
        entry.name !== document.name ||
        entry.type !== document.type ||
        (entry.bytes ?? entry.size) !== (document.bytes ?? document.size),
    )
  )
    return undefined
  return {
    id,
    record: recordId,
    kind: asset.kind,
    key,
    name: document.name,
    type: text(document.type) || "application/octet-stream",
    bytes: typeof document.bytes === "number" ? document.bytes : 0,
  }
}
function findRecord(snapshot: Snapshot, kind: AssetKind, id: string): Record<string, unknown> | undefined {
  if (!isKind(kind) || !safeId(id)) return undefined
  if (kind === "contract") return rows(snapshot.data.contracts).find((record) => identifier(record.id) === id)
  const store = object(snapshot.data.store)
  if (kind === "supplier") return rows(store.suppliers).find((record) => identifier(record.id) === id)
  const requests = object(store.requests)
  if (!Object.hasOwn(requests, id)) return undefined
  const request = object(object(requests[id]).request)
  return Object.keys(request).length ? request : undefined
}
function canChange(actor: Actor, kind: AssetKind, value: unknown) {
  if (!actor.canWrite) return false
  if (kind === "contract")
    return (
      actor.roles.includes("admin") ||
      (actor.roles.includes("contributor") && actor.assigned?.includes("contracts") === true)
    )
  if (kind === "supplier") return actor.roles.some((role) => ["admin", "supplier admin"].includes(role))
  const record = object(value)
  if (!actor.roles.includes("buyer")) return false
  return kind === "quote"
    ? ["sourcing", "src_rejected"].includes(text(record.status))
    : ["po_approved", "po_issued"].includes(text(record.status))
}
function canRead(snapshot: Snapshot, actor: Actor, asset: Asset) {
  const record = findRecord(snapshot, asset.kind, asset.record)
  if (!record) return false
  if (asset.kind === "contract")
    return dashboardPages(
      actor,
      Array.isArray(snapshot.data.summaries)
        ? snapshot.data.summaries.filter((value): value is string => typeof value === "string")
        : [],
    ).includes("Vendor Contracts")
  if (!procurementKeys(actor).length) return false
  if (asset.kind === "supplier") return true
  return (
    actor.roles.some((role) => ["buyer", "approver", "supplier admin", "admin", "viewer"].includes(role)) ||
    (actor.roles.includes("requester") && record.createdBy === actor.id)
  )
}
function sign(asset: Asset, actor: string, expires: number, key: Uint8Array) {
  return createHmac("sha256", key)
    .update(JSON.stringify([asset.id, asset.kind, asset.record, asset.key, actor, expires]))
    .digest("hex")
}
function requireSigningKey(key: Uint8Array) {
  if (key.byteLength < 32) throw new Error("Installation signing key must contain at least 32 bytes")
}
function denied() {
  return new Response("Access denied", {
    status: 403,
    headers: { "Cache-Control": "no-store" },
  })
}
