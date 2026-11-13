import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { ImportManifest, StoredImportManifest } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { ImportFileHost } from "./files.ts"
import { createDashboardImportMutation } from "./dashboard.ts"
import { dashboardImportImpact, verifyDashboardImportEvidence } from "./dashboard.ts"
import { settleSfImportReceipt } from "./store.ts"
import type { ImportExecution } from "./store.ts"
import type { ImportTarget } from "./staged-files.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"

/** C08 serializes Dashboard state, mutation and receipt in the same transaction. */
export function createSfDashboardImportAtomic(input: {
  host: DomainPortHost
  state: SfProductStatePort
  files: ImportFileHost
  authorizeTarget: (target: ImportTarget, context: TrustedDomainContext) => Promise<boolean>
  verifyScope: (snapshot: Snapshot, staged: Snapshot, target: ImportTarget, actor: Actor, manifest: StoredImportManifest, evidence: Extract<BusinessEvidenceRef, { kind: "record" }>, context: TrustedDomainContext, at: string) => boolean
  readView: (id: string, context: TrustedDomainContext) => Promise<PortResult<ImportManifest>>
}) {
  return async (manifest: StoredImportManifest, scope: { fileRef: string; target: ImportTarget; previewDigest: string; execution?: ImportExecution }, context: TrustedDomainContext): Promise<PortResult<ImportManifest>> => {
    const request = input.host.requestFor(context)
    const execution = scope.execution
    if (context.kind !== "ui" || !request || !execution || execution.kind !== "dashboard" || scope.target.surface !== "dashboard" || manifest.commands.length !== 1 || !await input.host.revalidate(context) || !await input.authorizeTarget(scope.target, context)) return { status: "denied", reason: "import-access-unavailable" }
    if (manifest.state !== "applied" && !await input.files.revalidate(scope.fileRef, manifest.sourceDigest, context)) return { status: "stale", reason: "file-changed" }
    const command = manifest.commands[0]!
    if (execution.actorId !== context.binding.principalRef || execution.commandDigest !== command.commandDigest || execution.idempotencyKey !== command.idempotencyKey || execution.targetIncarnation !== command.target.incarnation || execution.targetIncarnation !== scope.target.incarnation) return { status: "conflict", reason: "preview-identity-mismatch" }
    if (manifest.state === "applied") {
      const receipt = manifest.receipts.find((entry) => entry.principalRef === execution.actorId && entry.targetIncarnation === execution.targetIncarnation && entry.commandDigest === execution.commandDigest && entry.idempotencyKey === execution.idempotencyKey && entry.result.ok)
      if (!manifest.domainApplied || !receipt) return { status: "conflict", reason: "receipt-inconsistent" }
      const stored = await input.state.read(request, "receipts", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.receipts[receipt.id] : undefined)
      if (stored.status !== "ok" || !stored.value || digestSfValue(stored.value) !== digestSfValue(receipt) || !await input.host.revalidate(context) || !await input.authorizeTarget(scope.target, context)) return { status: "denied", reason: "receipt-access-unavailable" }
      return input.readView(manifest.id, context)
    }
    const mutation = createDashboardImportMutation({ format: execution.format, command: command.command, actorId: execution.actorId, operationId: execution.operationId, idempotencyKey: execution.idempotencyKey, target: command.target, baseDigest: execution.baseDigest, previewDigest: execution.previewDigest, commandDigest: execution.commandDigest, at: execution.previewAt, verifyScope: (snapshot, staged, actor) => { const impact = dashboardImportImpact(snapshot, staged, command.command, command.target.period); return !!impact && digestSfValue(impact) === execution.impactDigest && verifyDashboardImportEvidence(snapshot, staged, actor, command.command, execution.evidence, execution.previewAt) && input.verifyScope(snapshot, staged, scope.target, actor, manifest, execution.evidence, context, execution.previewAt) } })
    if (!mutation) return { status: "conflict", reason: "invalid-preview-command" }
    const docs = await input.state.read(request, "documents", (_, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion)
    const receipts = await input.state.read(request, "receipts", (_, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion)
    if (docs.status !== "ok" || !docs.value || receipts.status !== "ok" || !receipts.value) return { status: "denied", reason: "import-access-unavailable" }
    const environment = await input.host.environment(request)
    const stateCommand = { namespace: "documents" as const, domainSurface: "dashboard" as const, expectedStorageVersion: docs.storageVersion, additionalNamespaces: [{ namespace: "receipts" as const, expectedStorageVersion: receipts.storageVersion }], targetRef: scope.target.selectionRef, targetIncarnation: scope.target.incarnation, idempotencyKey: execution.idempotencyKey, commandDigest: execution.commandDigest }
    const saved = await input.state.transaction(request, stateCommand, async (state, authority, snapshot) => {
      if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion) return { commit: false, value: false }
      const file = object(state.documents[`import-file:${scope.fileRef}`])
      if (file.schema !== "sf-import-file-v1" || file.id !== scope.fileRef || file.digest !== manifest.sourceDigest || file.principalRef !== authority.principalRef || file.accessRevision !== authority.accessRevision || file.policyVersion !== authority.policyVersion || digestSfValue(file.target) !== digestSfValue(scope.target) || typeof file.expiresAt !== "string" || !Number.isFinite(Date.parse(environment.at)) || !Number.isFinite(Date.parse(file.expiresAt)) || Date.parse(file.expiresAt) <= Date.parse(environment.at)) return { commit: false, value: false }
      const principal = await input.host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
      if (!principal || principal.id !== execution.actorId || !principal.canWrite) return { commit: false, value: false }
      const access = object(object(snapshot.data.access)[principal.id])
      const roles = principal.roles.filter((row) => row.surface === "dashboard").map((row) => row.role)
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      const staged = mutation.execute(snapshot, actor, environment)
      if (!staged.commit) return { commit: false, value: false }
      const receipt = { id: digestSfValue({ principal: actor.id, target: scope.target.incarnation, key: execution.idempotencyKey }), idempotencyKey: execution.idempotencyKey, commandDigest: execution.commandDigest, targetIncarnation: scope.target.incarnation, principalRef: actor.id, surface: "dashboard" as const, version: execution.format === "backup" ? snapshot.versions.dataset?.version ?? command.expectedVersion : snapshot.versions[`${command.target.type}:${command.target.id}`]?.version ?? command.expectedVersion, result: { ok: true as const, value: staged.value }, at: environment.at }
      if (!settleSfImportReceipt(state, { manifestId: manifest.id, expectedDigest: scope.previewDigest, receipt })) return { commit: false, value: false }
      return { commit: true, value: true }
    })
    if (saved.status !== "ok" || !saved.value) return { status: saved.status === "conflict" || saved.status === "preview" ? "conflict" : "unavailable", reason: "import-not-applied" }
    if (!await input.host.revalidate(context) || !await input.authorizeTarget(scope.target, context)) return { status: "denied", reason: "import-access-unavailable" }
    return input.readView(manifest.id, context)
  }
}
