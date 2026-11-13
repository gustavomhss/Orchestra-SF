import type { AssetPersistence, AssetServices } from "../../runtime/assets.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { ImportPreviewRequest } from "../contracts/operations.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import { applyImport } from "./apply.ts"
import type { ImportApplyHost } from "./apply.ts"
import { createSfStagedImportFiles } from "./staged-files.ts"
import type { ImportTarget } from "./staged-files.ts"
import { previewImport } from "./capabilities.ts"
import type { ImportPreviewHost } from "./capabilities.ts"
import { createSfImportPreviewStore } from "./store.ts"
import type { ImportDetail, ImportExecution } from "./store.ts"
import { createSfPlannerImportPreview } from "./planner-preview.ts"
import { createSfPlannerImportAtomic } from "./planner-atomic.ts"
import { createSfDashboardImportPreview } from "./dashboard-preview.ts"
import { createSfDashboardImportAtomic } from "./dashboard-atomic.ts"

/** The selected target is resolved solely from private admission, never model arguments. */
export function createSfImportHost(input: {
  host: DomainPortHost
  assets: AssetPersistence
  services: AssetServices
  state: SfProductStatePort
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  authorizeTarget: (target: ImportTarget, context: TrustedDomainContext) => Promise<boolean>
  authorizeAdmission: (payload: { target: ImportTarget; format: "xlsx" | "xls" | "json"; digest: string }, context: TrustedDomainContext) => Promise<boolean>
  preview: Pick<ImportPreviewHost, "revalidate">
  apply: Pick<ImportApplyHost, "revalidate" | "confirm">
  planner: Pick<Parameters<typeof createSfPlannerImportPreview>[0], "resolveTarget" | "verifyTarget">
  dashboard: Pick<Parameters<typeof createSfDashboardImportPreview>[0], "resolveTarget" | "verifyScope">
}) {
  const files = createSfStagedImportFiles(input)
  const store = createSfImportPreviewStore({ ...input, validateFile: files.revalidate })
  const plannerPreview = createSfPlannerImportPreview({ host: input.host, operationIdentity: input.operationIdentity, ...input.planner })
  const plannerApply = createSfPlannerImportAtomic({ host: input.host, state: input.state, files, authorizeTarget: input.authorizeTarget, verifyTarget: input.planner.verifyTarget, readView: async (id, context) => { const result = await store.read(id, context); return result.status === "ok" ? { status: "ok", value: store.view(result.value.manifest) } : result } })
  const dashboardPreview = createSfDashboardImportPreview({ host: input.host, operationIdentity: input.operationIdentity, ...input.dashboard })
  const dashboardApply = createSfDashboardImportAtomic({ host: input.host, state: input.state, files, authorizeTarget: input.authorizeTarget, verifyScope: (snapshot, staged, target, actor, manifest, evidence, context, at) => !!manifest.commands[0] && input.dashboard.verifyScope(snapshot, staged, target, actor, manifest.commands[0].command, evidence, context, at), readView: async (id, context) => { const result = await store.read(id, context); return result.status === "ok" ? { status: "ok", value: store.view(result.value.manifest) } : result } })
  return {
    admit: files.admit,
    preview: async (request: ImportPreviewRequest, context: TrustedDomainContext) => {
      const admitted = await files.target(request.admittedFileRef, context)
      if (admitted.status !== "ok") return admitted
      if (request.format !== admitted.value.format || digestSfValue(request.options) !== digestSfValue(admitted.value.target.options.preview)) return { status: "stale" as const, reason: "file-options-changed" }
      const prepared: { detail?: ImportDetail; execution?: ImportExecution } = {}
      return previewImport(request, context, { ...input.preview, files, prepare: async ({ parsed }, trusted) => { const request = { parsed, target: admitted.value.target }; const result = request.target.surface === "planner" ? await plannerPreview(request, trusted) : await dashboardPreview(request, trusted); if (result.status !== "ok") return result; prepared.detail = result.value.detail; prepared.execution = result.value.execution; return { status: "ok", value: result.value.manifest } }, save: (manifest, trusted) => prepared.detail ? store.save(manifest, prepared.detail, request.admittedFileRef, admitted.value.target, trusted, prepared.execution) : Promise.resolve({ status: "unavailable", reason: "preview-detail-unavailable" }) })
    },
    detail: async (request: { manifestId: string; version: number; digest?: string }, context: TrustedDomainContext) => {
      if (context.kind !== "ui" || !await input.host.revalidate(context)) return { status: "denied" as const, reason: "human-authority-required" }
      const result = await store.read(request.manifestId, context)
      if (result.status !== "ok") return result
      if (result.value.manifest.version !== request.version || (request.digest !== undefined && result.value.digest !== request.digest)) return { status: "stale" as const, reason: "preview-changed" }
      return { status: "ok" as const, value: { digest: result.value.digest, detail: result.value.detail } }
    },
    apply: async (request: { manifestId: string; version: number }, context: TrustedDomainContext) => {
      const resolved = await store.read(request.manifestId, context)
      if (resolved.status !== "ok") return resolved
      return applyImport(request, context, { ...input.apply, read: async () => ({ status: "ok", value: resolved.value.manifest }), applyAtomically: (manifest, trusted) => { const scope = { fileRef: resolved.value.fileRef, target: resolved.value.target, previewDigest: resolved.value.digest, execution: resolved.value.execution }; return scope.target.surface === "planner" ? plannerApply(manifest, scope, trusted) : dashboardApply(manifest, scope, trusted) } })
    },
  }
}
