import type { AssetPersistence, AssetServices } from "../../runtime/assets.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { ImportPreviewRequest } from "../contracts/operations.ts"
import type { ImportFileHost } from "./files.ts"

export type ImportTarget = { surface: "dashboard" | "planner"; selectionRef: string; incarnation: string; version: number; options: { newVersion: boolean; removeMissing: boolean; preview: ImportPreviewRequest["options"] } }
type Entry = { schema: "sf-import-file-v1"; id: string; key: string; principalRef: string; installationId: string; projectId: string; accessRevision: string; policyVersion: string; target: ImportTarget; format: "xlsx" | "xls" | "json"; digest: string; size: number; expiresAt: string }
type Dependencies = { host: DomainPortHost; assets: AssetPersistence; services: AssetServices; state: SfProductStatePort; operationIdentity: (context: TrustedDomainContext) => string | undefined; authorizeTarget: (target: ImportTarget, context: TrustedDomainContext) => Promise<boolean>; authorizeAdmission: (payload: { target: ImportTarget; format: "xlsx" | "xls" | "json"; digest: string }, context: TrustedDomainContext) => Promise<boolean> }

/** The blob and catalog are private staging, not a business attachment or mutation. */
export function createSfStagedImportFiles(input: Dependencies): ImportFileHost & {
  admit: (request: { target: ImportTarget; format: "xlsx" | "xls" | "json"; bytes: Uint8Array }, context: TrustedDomainContext) => Promise<PortResult<{ ref: string; digest: string; expiresAt: string }>>
  target: (ref: string, context: TrustedDomainContext) => Promise<PortResult<{ target: ImportTarget; format: Entry["format"]; digest: string }>>
} {
  const getEntry = async (ref: string, context: TrustedDomainContext): Promise<PortResult<Entry>> => {
    const request = input.host.requestFor(context)
    if (!request || !ref || !await input.host.revalidate(context)) return { status: "denied", reason: "file-access-unavailable" }
    const saved = await input.state.read(request, "documents", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.documents[`import-file:${ref}`] : undefined)
    if (saved.status !== "ok" || !saved.value || typeof saved.value !== "object") return { status: "unavailable", reason: "file-unavailable" }
    const entry = saved.value as Entry
    const environment = await input.host.environment(request)
    if (entry.schema !== "sf-import-file-v1" || entry.id !== ref || entry.principalRef !== context.binding.principalRef || entry.installationId !== context.binding.installationId || entry.projectId !== context.binding.projectId || entry.accessRevision !== context.binding.accessRevision || entry.policyVersion !== context.binding.policyVersion || entry.key !== `sf-import/${entry.id}` || !/^[a-f0-9]{64}$/.test(entry.digest) || !Number.isSafeInteger(entry.size) || entry.size < 1 || entry.size > 16 * 1024 * 1024 || !Number.isFinite(Date.parse(environment.at)) || !Number.isFinite(Date.parse(entry.expiresAt)) || Date.parse(entry.expiresAt) <= Date.parse(environment.at) || !["xlsx", "xls", "json"].includes(entry.format) || !entry.target || !["dashboard", "planner"].includes(entry.target.surface) || !entry.target.selectionRef || !entry.target.incarnation || !Number.isSafeInteger(entry.target.version) || entry.target.version < 0 || typeof entry.target.options?.newVersion !== "boolean" || typeof entry.target.options?.removeMissing !== "boolean") return { status: "unavailable", reason: "file-unavailable" }
    if (!entry.target.options.preview || typeof entry.target.options.preview !== "object" || Array.isArray(entry.target.options.preview)) return { status: "unavailable", reason: "file-unavailable" }
    if (!await input.authorizeTarget(entry.target, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "file-access-unavailable" }
    return { status: "ok", value: entry }
  }
  const read: ImportFileHost["read"] = async (ref, context) => {
    const request = input.host.requestFor(context)
    if (!request || !Object.is(input.host.persistence, input.assets)) return { status: "denied", reason: "file-access-unavailable" }
    const saved = await getEntry(ref, context)
    if (saved.status !== "ok") return saved
    const bytes = await input.assets.transaction("dashboard", async (_, blobs) => ({ commit: false, value: await blobs.get(saved.value.key) }), { signal: request.signal })
    if (!bytes || bytes.byteLength !== saved.value.size || new Bun.CryptoHasher("sha256").update(bytes).digest("hex") !== saved.value.digest) return { status: "unavailable", reason: "file-unavailable" }
    const current = await getEntry(ref, context)
    if (current.status !== "ok" || digestSfValue(current.value) !== digestSfValue(saved.value)) return { status: "stale", reason: "file-changed" }
    return { status: "ok", value: { bytes, digest: saved.value.digest } }
  }
  return {
    read,
    revalidate: async (ref, digest, context) => { const result = await read(ref, context); return result.status === "ok" && result.value.digest === digest },
    target: async (ref, context) => { const result = await getEntry(ref, context); return result.status === "ok" ? { status: "ok", value: { target: result.value.target, format: result.value.format, digest: result.value.digest } } : result },
    admit: async (file, context) => {
      const request = input.host.requestFor(context)
      const operation = input.operationIdentity(context)
      if (context.kind !== "ui" || !request || !operation || !Object.is(input.host.persistence, input.assets) || !await input.host.revalidate(context)) return { status: "denied", reason: "human-authority-required" }
      if (!file || !["xlsx", "xls", "json"].includes(file.format) || !(file.bytes instanceof Uint8Array) || file.bytes.byteLength < 1 || file.bytes.byteLength > 16 * 1024 * 1024 || !file.target || !["dashboard", "planner"].includes(file.target.surface) || !file.target.selectionRef || !file.target.incarnation || !Number.isSafeInteger(file.target.version) || file.target.version < 0 || typeof file.target.options?.newVersion !== "boolean" || typeof file.target.options?.removeMissing !== "boolean" || !file.target.options.preview || typeof file.target.options.preview !== "object" || Array.isArray(file.target.options.preview) || Object.keys(file.target.options.preview).some((key) => !["sheet", "replace", "headerRow"].includes(key)) || (file.target.options.preview.sheet !== undefined && typeof file.target.options.preview.sheet !== "string") || (file.target.options.preview.replace !== undefined && typeof file.target.options.preview.replace !== "boolean") || (file.target.options.preview.headerRow !== undefined && (!Number.isSafeInteger(file.target.options.preview.headerRow) || file.target.options.preview.headerRow !== 1))) return { status: "needs-input", reason: "invalid-file-admission" }
      const target = structuredClone(file.target)
      const bytes = new Uint8Array(file.bytes)
      const format = file.format
      const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
      if (!await input.authorizeAdmission({ target, format, digest }, context) || !await input.authorizeTarget(target, context)) return { status: "denied", reason: "target-access-unavailable" }
      const mediaType = format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : format === "xls" ? "application/vnd.ms-excel" : "application/json"
      if (!await input.services.scan(bytes, mediaType)) return { status: "denied", reason: "file-not-accepted" }
      const environment = await input.host.environment(request)
      const now = Date.parse(environment.at)
      const id = digestSfValue({ principalRef: context.binding.principalRef, operation })
      if (!Number.isFinite(now)) return { status: "unavailable", reason: "file-admission-unavailable" }
      const entry: Entry = { schema: "sf-import-file-v1", id, key: `sf-import/${id}`, principalRef: context.binding.principalRef, installationId: context.binding.installationId, projectId: context.binding.projectId, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, target, format, digest, size: bytes.byteLength, expiresAt: new Date(now + 60 * 60_000).toISOString() }
      const prior = await input.state.read(request, "documents", (state) => state.documents[`import-file:${id}`])
      if (prior.status !== "ok" && !(prior.status === "unavailable" && prior.reason === "product-state-uninitialized")) return { status: "unavailable", reason: "file-catalog-unavailable" }
      if (prior.status === "ok" && prior.value !== undefined) {
        const previous = await getEntry(id, context)
        if (previous.status !== "ok" || previous.value.digest !== entry.digest || previous.value.format !== entry.format || digestSfValue(previous.value.target) !== digestSfValue(entry.target)) return { status: "conflict", reason: "file-admission-conflict" }
        const verified = await read(id, context)
        return verified.status === "ok" ? { status: "ok", value: { ref: id, digest: previous.value.digest, expiresAt: previous.value.expiresAt } } : verified
      }
      const staged = await input.assets.transaction<PortResult<Entry>>("dashboard", async (_, blobs) => {
        const existing = await blobs.get(entry.key)
        const proofBytes = await blobs.get(`${entry.key}/admission`)
        if (existing || proofBytes) {
          // Bytes alone cannot prove the original target, format or authority of an interrupted admission.
          if (!existing || !proofBytes) return { commit: false, value: { status: "conflict", reason: "file-admission-conflict" } }
          const proof: unknown = JSON.parse(new TextDecoder().decode(proofBytes))
          if (!proof || typeof proof !== "object" || !("schema" in proof) || proof.schema !== "sf-import-admission-v1" || !("entryDigest" in proof) || !("expiresAt" in proof) || typeof proof.expiresAt !== "string" || !Number.isFinite(Date.parse(proof.expiresAt)) || Date.parse(proof.expiresAt) <= now) return { commit: false, value: { status: "conflict", reason: "file-admission-conflict" } }
          const recovered = { ...entry, expiresAt: proof.expiresAt }
          if (proof.entryDigest !== digestSfValue(recovered) || existing.byteLength !== recovered.size || new Bun.CryptoHasher("sha256").update(existing).digest("hex") !== recovered.digest) return { commit: false, value: { status: "conflict", reason: "file-admission-conflict" } }
          return { commit: false, value: { status: "ok", value: recovered } }
        }
        // The private proof and bytes share one durable commit; the catalog may be published on a later retry.
        await blobs.put(entry.key, bytes, "application/octet-stream")
        await blobs.put(`${entry.key}/admission`, new TextEncoder().encode(JSON.stringify({ schema: "sf-import-admission-v1", entryDigest: digestSfValue(entry), expiresAt: entry.expiresAt })), "application/json")
        return { commit: true, value: { status: "ok", value: entry } }
      }, { signal: request.signal }).catch(() => ({ status: "unavailable" as const, reason: "file-admission-unavailable" }))
      if (staged.status !== "ok") return staged
      const admitted = staged.value
      if (!await input.host.revalidate(context) || !await input.authorizeTarget(admitted.target, context)) return { status: "denied", reason: "target-access-unavailable" }
      const admission = { namespace: "documents" as const, domainSurface: admitted.target.surface, expectedStorageVersion: prior.status === "ok" ? prior.storageVersion : 0, targetRef: admitted.target.selectionRef, targetIncarnation: admitted.target.incarnation, idempotencyKey: operation, commandDigest: digestSfValue({ action: "admit-import", entry: admitted }) }
      const saved = await input.state.transaction(request, admission, async (state, authority) => {
        if (authority.principalRef !== admitted.principalRef || authority.accessRevision !== admitted.accessRevision || authority.policyVersion !== admitted.policyVersion || state.documents[`import-file:${id}`] !== undefined) return { commit: false, value: false }
        state.documents[`import-file:${id}`] = admitted
        return { commit: true, value: true }
      }).catch(() => undefined)
      if (!saved || saved.status !== "ok" || !saved.value) {
        const observed = await input.state.read(request, "documents", (state) => state.documents[`import-file:${id}`]).catch(() => undefined)
        if (observed?.status === "ok" && digestSfValue(observed.value) === digestSfValue(admitted)) {
          const verified = await read(id, context)
          return verified.status === "ok" ? { status: "ok", value: { ref: id, digest: admitted.digest, expiresAt: admitted.expiresAt } } : verified
        }
        // A concurrent/uncertain catalog commit may reference these bytes even after an empty read.
        // Keep the durable pair so an authorized identical retry can reconcile without destroying it.
        return { status: "unavailable", reason: "file-admission-unavailable" }
      }
      const verified = await read(id, context)
      if (verified.status !== "ok") return verified
      return { status: "ok", value: { ref: id, digest: admitted.digest, expiresAt: admitted.expiresAt } }
    },
  }
}

