import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { DecisionIntentInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { ImportPreviewRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfProductStatePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { createSfIntentVerifier } from "./analysis-verifier-intent.ts"

export type SfImportIntentSelection = {
  caseRef: DecisionIntentInput["case"]
  previewRef: string
  importRequest: ImportPreviewRequest
  intentText: string
}

/** The closed skill input has no selected-manifest field. Keep that human selection in
 * C08, scoped to the complete input and authority, and expose only its public C04 view
 * through the verifier's prompt context. Equivalent file previews remain distinct. */
export function createSfImportIntentAnalysis(input: Parameters<typeof createSfIntentVerifier>[0] & {
  imports: NonNullable<Parameters<typeof createSfIntentVerifier>[0]["imports"]>
  state: SfProductStatePort
  operationIdentity: (call: TrustedDomainContext) => string | undefined
  authorize: (call: TrustedDomainContext, selection: SfImportIntentSelection) => Promise<boolean>
}) {
  const identity = (value: DecisionIntentInput, call: TrustedDomainContext) => ({
    schema: "sf-intent-preview-v1" as const, inputDigest: digestSfValue(value), caseRef: value.case,
    installationId: call.binding.installationId, projectId: call.binding.projectId,
    principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion,
  })
  const selectedPreviewRef: NonNullable<Parameters<typeof createSfIntentVerifier>[0]["selectedPreviewRef"]> = async (caseRef, call, value) => {
    const request = input.host.requestFor(call)
    if (!request || !value.importPreview || digestSfValue(caseRef) !== digestSfValue(value.case) || !await input.host.revalidate(call)) return { status: "denied", reason: "intent-preview-authority-unavailable" }
    const expected = identity(value, call)
    const key = `sf:intent-preview:${digestSfValue(expected)}`
    const loaded = await input.state.read(request, "documents", (state, actor) => {
      const row = object(state.documents[key])
      const current = state.cases[caseRef.id]
      return actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion &&
        current?.incarnation === caseRef.incarnation && current.version === caseRef.version && current.participants.includes(actor.principalRef) &&
        digestSfValue(row.identity) === digestSfValue(expected) && typeof row.previewRef === "string" && !!row.previewRef.trim() && typeof row.previewDigest === "string"
        ? { previewRef: row.previewRef, previewDigest: row.previewDigest } : undefined
    })
    if (loaded.status !== "ok" || !loaded.value) return { status: "unavailable", reason: "intent-preview-selection-unavailable" }
    const preview = await input.imports.readPreviewForAnalysis({ previewRef: loaded.value.previewRef, request: value.importPreview }, call)
    if (preview.status !== "ok" || preview.value.digest !== loaded.value.previewDigest || !await input.host.revalidate(call)) return { status: "unavailable", reason: "intent-preview-changed" }
    return { status: "ok", value: { previewRef: loaded.value.previewRef } }
  }
  const verifier = createSfIntentVerifier({ ...input, selectedPreviewRef })
  const prepare = async (call: TrustedDomainContext, selection: SfImportIntentSelection): Promise<PortResult<DecisionIntentInput>> => {
    const wanted = structuredClone(selection)
    const source = input.host.requestFor(call)
    const operation = input.operationIdentity(call)
    const previewInput = decodeSfOperationInput("sf_import_preview", wanted.importRequest)
    if (call.kind !== "ui" || !source || !operation || !await input.authorize(call, wanted) || !await input.host.revalidate(call)) return { status: "denied", reason: "intent-preview-authority-unavailable" }
    if (!previewInput.ok || !wanted.previewRef.trim() || !wanted.intentText.trim()) return { status: "needs-input", reason: "intent-preview-selection-invalid" }
    const current = await input.cases.read({ caseRef: encodeCaseRef(wanted.caseRef) }, call)
    if (current.status !== "ok" || current.value.case.version !== wanted.caseRef.version) return { status: "unavailable", reason: "intent-case-unavailable" }
    const preview = await input.imports.readPreviewForAnalysis({ previewRef: wanted.previewRef, request: previewInput.value }, call)
    if (preview.status !== "ok") return preview
    const manifest = preview.value.manifest
    if (manifest.id !== wanted.previewRef || manifest.state !== "preview" || manifest.domainApplied || manifest.receipts.length ||
      manifest.context.installationId !== call.binding.installationId || manifest.context.projectId !== call.binding.projectId || manifest.context.principalRef !== call.binding.principalRef || manifest.context.accessRevision !== call.binding.accessRevision || manifest.context.policyVersion !== call.binding.policyVersion ||
      manifest.context.currency !== current.value.case.currency || digestSfValue(manifest.context.period) !== digestSfValue(current.value.case.horizon) || !manifest.context.sourceRefs.length || digestSfValue(manifest.context.sourceRefs) !== digestSfValue(manifest.baseIdentity)) return { status: "unavailable", reason: "intent-preview-context-unavailable" }
    const refs = current.value.evidenceRefs.filter((ref) => ref.kind === "record" && manifest.context.sourceRefs.some((item) =>
      item.surface === manifest.context.surface && ref.target.surface === item.surface && ref.target.recordType === item.type && ref.target.recordId === item.id && ref.target.incarnation === item.incarnation && ref.target.version === item.version && ref.target.period?.start === item.period.start && ref.target.period.end === item.period.end && item.fields.every((field) => ref.target.fields.includes(field))))
    if (!refs.length || manifest.context.sourceRefs.some((item) => !refs.some((ref) => ref.kind === "record" && ref.target.surface === item.surface && ref.target.recordType === item.type && ref.target.recordId === item.id && ref.target.incarnation === item.incarnation && ref.target.version === item.version && ref.target.period?.start === item.period.start && ref.target.period.end === item.period.end && item.fields.every((field) => ref.target.fields.includes(field))))) return { status: "unavailable", reason: "intent-preview-outside-case" }
    const decoded = decodeSfSkillInput("DecisionIntentInput", { intentText: wanted.intentText,
      context: { surface: manifest.context.surface, period: manifest.context.period, currency: manifest.context.currency, sourceRefs: manifest.context.sourceRefs },
      case: wanted.caseRef, selectedSourceRefs: refs, importPreview: previewInput.value })
    if (!decoded.ok) return { status: "needs-input", reason: "intent-preview-selection-invalid" }
    const sources = await input.context.context({ refs }, call)
    if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.ref) !== digestSfValue(refs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref))) return { status: "unavailable", reason: "intent-preview-source-unavailable" }
    const row = { identity: identity(decoded.value, call), previewRef: wanted.previewRef, previewDigest: preview.value.digest }
    const key = `sf:intent-preview:${digestSfValue(row.identity)}`
    const before = await input.state.read(source, "documents", (state) => state.documents[key])
    if (before.status !== "ok") return { status: "unavailable", reason: "intent-preview-store-unavailable" }
    if (before.value !== undefined && digestSfValue(before.value) !== digestSfValue(row)) return { status: "conflict", reason: "intent-preview-selection-conflict" }
    const saved = await input.state.transaction(source, { namespace: "documents", expectedStorageVersion: before.storageVersion,
      targetRef: encodeCaseRef(wanted.caseRef), targetIncarnation: wanted.caseRef.incarnation,
      idempotencyKey: `intent-preview:${operation}`, commandDigest: digestSfValue(row) }, async (state, actor) => {
      const currentCase = state.cases[wanted.caseRef.id]
      if (actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion ||
        currentCase?.incarnation !== wanted.caseRef.incarnation || currentCase.version !== wanted.caseRef.version || !currentCase.participants.includes(actor.principalRef) ||
        object(state.documents[`import-preview:${wanted.previewRef}`]).digest !== preview.value.digest || !await input.authorize(call, wanted) || !await input.host.revalidate(call)) return { commit: false, value: false }
      const previous = state.documents[key]
      if (previous !== undefined) return { commit: false, value: digestSfValue(previous) === digestSfValue(row) }
      state.documents[key] = row
      return { commit: true, value: true }
    })
    if ((saved.status !== "ok" && saved.status !== "preview") || !saved.value) return { status: saved.status === "conflict" ? "conflict" : "unavailable", reason: "intent-preview-store-unavailable" }
    const selected = await selectedPreviewRef(wanted.caseRef, call, decoded.value)
    const again = await input.cases.read({ caseRef: encodeCaseRef(wanted.caseRef) }, call)
    if (selected.status !== "ok" || selected.value.previewRef !== wanted.previewRef || again.status !== "ok" || digestSfValue(again.value.case) !== digestSfValue(current.value.case) || !await input.authorize(call, wanted) || !await input.host.revalidate(call)) return { status: "unavailable", reason: "intent-preview-changed" }
    return { status: "ok", value: decoded.value }
  }
  return { prepare, verifier }
}
