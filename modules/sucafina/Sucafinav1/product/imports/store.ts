import { digestSfValue } from "../contracts/canonical.ts"
import type { CommandReceipt, ImportManifest, StoredImportManifest } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort } from "../contracts/state.ts"
import type { ImportTarget } from "./staged-files.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"

export type ImportDetail = {
  manifestId: string
  version: number
  sourceDigest: string
  changes: readonly { path: string; kind: "added" | "changed" | "removed" | "unchanged" | "ignored" | "rejected"; before: { state: "absent" | "undefined" } | { state: "present"; value: unknown }; after: { state: "absent" | "undefined" } | { state: "present"; value: unknown }; source: { kind: "file"; sheet: string; row: number; column: number; address: string; field: string } | { kind: "domain"; reference: string }; reason?: string }[]
}
export type ImportExecution = { operationId: string; previewDigest: string; previewAt: string; actorId: string; idempotencyKey: string; targetIncarnation: string; commandDigest: string } & ({ kind?: "planner" } | { kind: "dashboard"; format: "all-members" | "all-projects" | "ticket-register" | "backup"; baseDigest: string; impactDigest: string; evidence: Extract<BusinessEvidenceRef, { kind: "record" }> })
type StoredPreview = { schema: "sf-import-preview-v1"; fileRef: string; target: ImportTarget; manifest: StoredImportManifest; detail: ImportDetail; execution?: ImportExecution; digest: string }

/** Called inside the domain + receipts C08 transaction after the real command succeeds. */
export function settleSfImportReceipt(state: SfProductState, input: { manifestId: string; expectedDigest: string; receipt: CommandReceipt }): boolean {
  const stored = state.documents[`import-preview:${input.manifestId}`] as StoredPreview | undefined
  if (!stored || stored.schema !== "sf-import-preview-v1" || stored.digest !== input.expectedDigest || stored.digest !== digestSfValue({ schema: stored.schema, fileRef: stored.fileRef, target: stored.target, manifest: stored.manifest, detail: stored.detail, ...(stored.execution ? { execution: stored.execution } : {}) }) || stored.manifest.state !== "preview" || stored.manifest.commands.length !== 1 || !input.receipt.result.ok) return false
  const command = stored.manifest.commands[0]!
  if (input.receipt.principalRef !== stored.manifest.context.principalRef || input.receipt.surface !== command.target.surface || input.receipt.targetIncarnation !== command.target.incarnation || input.receipt.commandDigest !== command.commandDigest || input.receipt.idempotencyKey !== command.idempotencyKey || (state.receipts[input.receipt.id] && digestSfValue(state.receipts[input.receipt.id]) !== digestSfValue(input.receipt))) return false
  const manifest: StoredImportManifest = { ...stored.manifest, state: "applied", domainApplied: true, receipts: [input.receipt] }
  const payload = { schema: stored.schema, fileRef: stored.fileRef, target: stored.target, manifest, detail: stored.detail, ...(stored.execution ? { execution: stored.execution } : {}) }
  state.documents[`import-preview:${input.manifestId}`] = { ...payload, digest: digestSfValue(payload) }
  state.receipts[input.receipt.id] = structuredClone(input.receipt)
  return true
}

/** C08 is the sole store. Commands remain private; output contains only authorized views. */
export function createSfImportPreviewStore(input: { host: DomainPortHost; state: SfProductStatePort; operationIdentity: (context: TrustedDomainContext) => string | undefined; validateFile: (fileRef: string, digest: string, context: TrustedDomainContext) => Promise<boolean>; authorizeTarget: (target: ImportTarget, context: TrustedDomainContext, mode?: "receipt") => Promise<boolean> }) {
  const view = (manifest: StoredImportManifest): ImportManifest => ({ id: manifest.id, version: manifest.version, sourceDigest: manifest.sourceDigest, format: manifest.format, context: manifest.context, baseIdentity: manifest.baseIdentity, issues: manifest.issues, state: manifest.state, domainApplied: manifest.domainApplied,
    commands: manifest.commands.map((entry) => { const { command, ...rest } = entry; return { ...rest, action: command.action, operationRef: entry.id } }),
    receipts: manifest.receipts.map((receipt) => { const { result, ...rest } = receipt; return { ...rest, status: result.ok ? "applied" as const : result.status === 409 ? "conflict" as const : "failed" as const, errors: result.ok ? [] : ["The domain rejected the import."] } }),
  })
  return {
    save: async (manifest: StoredImportManifest, detail: ImportDetail, fileRef: string, target: ImportTarget, context: TrustedDomainContext, execution?: ImportExecution): Promise<PortResult<ImportManifest>> => {
      const request = input.host.requestFor(context)
      const operation = input.operationIdentity(context)
      if (!request || !operation || !manifest.id || !fileRef || manifest.state !== "preview" || manifest.domainApplied || manifest.receipts.length || manifest.context.principalRef !== context.binding.principalRef || manifest.context.installationId !== context.binding.installationId || manifest.context.projectId !== context.binding.projectId || manifest.context.accessRevision !== context.binding.accessRevision || manifest.context.policyVersion !== context.binding.policyVersion || !await input.host.revalidate(context) || !await input.authorizeTarget(target, context) || !await input.validateFile(fileRef, manifest.sourceDigest, context)) return { status: "denied", reason: "preview-access-unavailable" }
      if (!detail || detail.manifestId !== manifest.id || detail.version !== manifest.version || detail.sourceDigest !== manifest.sourceDigest || !Array.isArray(detail.changes) || detail.changes.some((change) => !change.path || !["added", "changed", "removed", "unchanged", "ignored", "rejected"].includes(change.kind) || !change.source || (change.source.kind === "file" && (!change.source.sheet || !Number.isSafeInteger(change.source.row) || change.source.row < 1 || !Number.isSafeInteger(change.source.column) || change.source.column < 1 || !change.source.address || !change.source.field)) || (change.source.kind === "domain" && !change.source.reference) || !["file", "domain"].includes(change.source.kind))) return { status: "needs-input", reason: "invalid-preview-detail" }
      const payload = { schema: "sf-import-preview-v1" as const, fileRef, target, manifest, detail, ...(execution ? { execution } : {}) }
      const entry: StoredPreview = { ...payload, digest: digestSfValue(payload) }
      const current = await input.state.read(request, "documents", (state) => state.documents[`import-preview:${manifest.id}`])
      if (current.status !== "ok") return { status: "unavailable", reason: "preview-store-unavailable" }
      const write = { namespace: "documents" as const, domainSurface: target.surface, expectedStorageVersion: current.storageVersion, targetRef: target.selectionRef, targetIncarnation: target.incarnation, idempotencyKey: `${operation}:preview`, commandDigest: entry.digest }
      const saved = await input.state.transaction(request, write, async (state, authority) => {
        if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion) return { commit: false, value: false }
        const prior = state.documents[`import-preview:${manifest.id}`]
        if (prior !== undefined && digestSfValue(prior) !== digestSfValue(entry)) return { commit: false, value: false }
        state.documents[`import-preview:${manifest.id}`] = structuredClone(entry)
        return { commit: true, value: true }
      })
      if (saved.status !== "ok" || !saved.value) return { status: saved.status === "conflict" ? "conflict" : "unavailable", reason: "preview-store-unavailable" }
      if (!await input.host.revalidate(context) || !await input.authorizeTarget(target, context) || !await input.validateFile(fileRef, manifest.sourceDigest, context)) return { status: "stale", reason: "preview-context-changed" }
      return { status: "ok", value: view(manifest) }
    },
    read: async (id: string, context: TrustedDomainContext): Promise<PortResult<{ manifest: StoredImportManifest; detail: ImportDetail; execution?: ImportExecution; digest: string; fileRef: string; target: ImportTarget }>> => {
      const request = input.host.requestFor(context)
      if (!request || !id || !await input.host.revalidate(context)) return { status: "denied", reason: "preview-access-unavailable" }
      const read = await input.state.read(request, "documents", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.documents[`import-preview:${id}`] : undefined)
      if (read.status !== "ok" || !read.value || typeof read.value !== "object") return { status: "unavailable", reason: "preview-unavailable" }
      const entry = read.value as StoredPreview
      if (entry.schema !== "sf-import-preview-v1" || !entry.manifest || entry.manifest.id !== id || !entry.detail || entry.detail.manifestId !== id || entry.detail.version !== entry.manifest.version || entry.detail.sourceDigest !== entry.manifest.sourceDigest || !entry.target || !entry.fileRef || entry.digest !== digestSfValue({ schema: entry.schema, fileRef: entry.fileRef, target: entry.target, manifest: entry.manifest, detail: entry.detail, ...(entry.execution ? { execution: entry.execution } : {}) }) || entry.manifest.context.principalRef !== context.binding.principalRef || entry.manifest.context.installationId !== context.binding.installationId || entry.manifest.context.projectId !== context.binding.projectId || entry.manifest.context.accessRevision !== context.binding.accessRevision || entry.manifest.context.policyVersion !== context.binding.policyVersion || !await input.authorizeTarget(entry.target, context, entry.manifest.state === "applied" ? "receipt" : undefined) || (entry.manifest.state !== "applied" && !await input.validateFile(entry.fileRef, entry.manifest.sourceDigest, context)) || !await input.host.revalidate(context)) return { status: "denied", reason: "preview-access-unavailable" }
      return { status: "ok", value: { manifest: entry.manifest, detail: entry.detail, execution: entry.execution, digest: entry.digest, fileRef: entry.fileRef, target: entry.target } }
    },
    view,
  }
}
