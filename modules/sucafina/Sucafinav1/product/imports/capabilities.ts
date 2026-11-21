import type { ImportManifest, StoredImportManifest } from "../contracts/context.ts"
import type { ImportPreviewRequest } from "../contracts/operations.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { parseAdmittedImport } from "./files.ts"
import type { ImportFileHost, ParsedImport } from "./files.ts"

/** The domain adapter builds the command and simulates it through its own rules.
 * The host persists the private command separately from the authorized manifest view. */
export type ImportPreviewHost = {
  files: ImportFileHost
  prepare?: (input: { parsed: ParsedImport; options: ImportPreviewRequest["options"] }, context: TrustedDomainContext) => Promise<PortResult<StoredImportManifest>>
  save: (manifest: StoredImportManifest, context: TrustedDomainContext) => Promise<PortResult<ImportManifest>>
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
}

export async function previewImport(request: ImportPreviewRequest, context: TrustedDomainContext, host: ImportPreviewHost): Promise<PortResult<ImportManifest>> {
  if (!await host.revalidate(context)) return { status: "denied", reason: "authority-unavailable" }
  if (typeof host.prepare !== "function") return { status: "unavailable", reason: "domain-adapter-unavailable" }
  const parsed = await parseAdmittedImport(request, context, host.files)
  if (parsed.status !== "ok") return parsed
  const prepared = await host.prepare({ parsed: parsed.value, options: request.options }, context)
  if (prepared.status !== "ok") return prepared
  if (prepared.value.sourceDigest !== parsed.value.sourceDigest || prepared.value.format !== parsed.value.format || prepared.value.state !== "preview" || prepared.value.domainApplied || prepared.value.receipts.length || prepared.value.context.principalRef !== context.binding.principalRef || prepared.value.context.installationId !== context.binding.installationId || prepared.value.context.projectId !== context.binding.projectId || prepared.value.context.accessRevision !== context.binding.accessRevision || prepared.value.context.policyVersion !== context.binding.policyVersion) return { status: "failed", reason: "invalid-domain-preview" }
  if (!await host.revalidate(context) || !await host.files.revalidate(request.admittedFileRef, parsed.value.sourceDigest, context)) return { status: "stale", reason: "preview-context-changed" }
  const saved = await host.save(prepared.value, context)
  if (saved.status !== "ok") return saved
  if (saved.value.id !== prepared.value.id || saved.value.version !== prepared.value.version || saved.value.sourceDigest !== prepared.value.sourceDigest || saved.value.format !== prepared.value.format || saved.value.state !== "preview" || saved.value.domainApplied || saved.value.receipts.length || saved.value.context.principalRef !== context.binding.principalRef || saved.value.context.installationId !== context.binding.installationId || saved.value.context.projectId !== context.binding.projectId || saved.value.context.accessRevision !== context.binding.accessRevision || saved.value.context.policyVersion !== context.binding.policyVersion) return { status: "unavailable", reason: "invalid-saved-preview" }
  if (!await host.revalidate(context) || !await host.files.revalidate(request.admittedFileRef, parsed.value.sourceDigest, context)) return { status: "stale", reason: "preview-context-changed" }
  return saved
}
