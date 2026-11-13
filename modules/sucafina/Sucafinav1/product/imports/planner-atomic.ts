import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { ImportManifest, StoredImportManifest } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { ImportFileHost } from "./files.ts"
import { createPlannerImportMutation, plannerWorkbookHasRoster } from "./planner.ts"
import { rejectedReceiptId, settleSfImportReceipt, settleSfImportRejection } from "./store.ts"
import type { ImportExecution } from "./store.ts"
import type { ImportTarget } from "./staged-files.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"

/** Compose with the e4 C08 provider: Planner snapshot, preview and receipt commit together. */
export function createSfPlannerImportAtomic(input: {
  host: DomainPortHost
  state: SfProductStatePort
  files: ImportFileHost
  authorizeTarget: (target: ImportTarget, context: TrustedDomainContext, mode?: "receipt") => Promise<boolean>
  verifyTarget: (snapshot: Snapshot, target: ImportTarget, actor: Actor, context: TrustedDomainContext) => boolean
  verifyRoster?: (snapshot: Snapshot, evidence: Extract<BusinessEvidenceRef, { kind: "record" }>, actor: Actor, context: TrustedDomainContext) => boolean
  readView: (id: string, context: TrustedDomainContext) => Promise<PortResult<ImportManifest>>
}) {
  return async (manifest: StoredImportManifest, scope: { fileRef: string; target: ImportTarget; previewDigest: string; execution?: ImportExecution }, context: TrustedDomainContext): Promise<PortResult<ImportManifest>> => {
    const request = input.host.requestFor(context)
    const execution = scope.execution
    if (context.kind !== "ui" || !request || !execution || execution.kind === "dashboard" || scope.target.surface !== "planner" || manifest.commands.length !== 1 || !await input.host.revalidate(context) || !await input.authorizeTarget(scope.target, context, manifest.state === "applied" ? "receipt" : undefined)) return { status: "denied", reason: "import-access-unavailable" }
    if (manifest.state !== "applied" && !await input.files.revalidate(scope.fileRef, manifest.sourceDigest, context)) return { status: "stale", reason: "file-changed" }
    if (!("transactionAll" in input.host.persistence) || typeof input.host.persistence.transactionAll !== "function") return { status: "unavailable", reason: "atomic-domain-unavailable" }
    const command = manifest.commands[0]!
    const hasRoster = plannerWorkbookHasRoster(object(command.command.values.sheets))
    const roster = execution.rosterEvidence
    const rosterSource = manifest.baseIdentity.filter((source) => source.surface === "planner" && source.type === "planner-roster")
    if (hasRoster !== !!roster || rosterSource.length !== (roster ? 1 : 0) || (roster && (!input.verifyRoster || rosterSource[0]!.id !== roster.target.recordId || rosterSource[0]!.incarnation !== roster.target.incarnation || rosterSource[0]!.version !== roster.target.version || digestSfValue(rosterSource[0]!.fields) !== digestSfValue(roster.target.fields) || digestSfValue(roster.target.period) !== digestSfValue(command.target.period) || digestSfValue(rosterSource[0]!.period) !== digestSfValue(command.target.period)))) return { status: "conflict", reason: "roster-scope-mismatch" }
    if (execution.actorId !== context.binding.principalRef || execution.commandDigest !== command.commandDigest || execution.idempotencyKey !== command.idempotencyKey || execution.targetIncarnation !== command.target.incarnation || execution.targetIncarnation !== scope.target.incarnation) return { status: "conflict", reason: "preview-identity-mismatch" }
    if (manifest.state === "applied") {
      const receipt = manifest.receipts.find((entry) => entry.principalRef === execution.actorId && entry.targetIncarnation === execution.targetIncarnation && entry.commandDigest === execution.commandDigest && entry.idempotencyKey === execution.idempotencyKey && entry.result.ok)
      if (!manifest.domainApplied || !receipt) return { status: "conflict", reason: "receipt-inconsistent" }
      const stored = await input.state.read(request, "receipts", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.receipts[receipt.id] : undefined)
      if (stored.status !== "ok" || !stored.value || digestSfValue(stored.value) !== digestSfValue(receipt) || !await input.host.revalidate(context) || !await input.authorizeTarget(scope.target, context, "receipt")) return { status: "denied", reason: "receipt-access-unavailable" }
      return input.readView(manifest.id, context)
    }
    const mutation = createPlannerImportMutation({ ...execution, command: command.command, verifyTarget: (snapshot, _, incarnation, actor) => incarnation === scope.target.incarnation && input.verifyTarget(snapshot, scope.target, actor, context) })
    if (!mutation) return { status: "conflict", reason: "invalid-preview-command" }
    const docs = await input.state.read(request, "documents", (_, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion)
    const receipts = await input.state.read(request, "receipts", (_, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion)
    if (docs.status !== "ok" || !docs.value || receipts.status !== "ok" || !receipts.value) return { status: "denied", reason: "import-access-unavailable" }
    const environment = await input.host.environment(request)
    const stateCommand = { namespace: "documents" as const, domainSurface: "planner" as const, expectedStorageVersion: docs.storageVersion, additionalNamespaces: [{ namespace: "receipts" as const, expectedStorageVersion: receipts.storageVersion }], targetRef: scope.target.selectionRef, targetIncarnation: scope.target.incarnation, idempotencyKey: execution.idempotencyKey, commandDigest: execution.commandDigest }
    const saved = await input.state.transaction(request, stateCommand, async (state, authority, snapshot) => {
      if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion) return { commit: false, value: false }
      if (!await input.files.revalidate(scope.fileRef, manifest.sourceDigest, context)) return { commit: false, value: false }
      const file = object(state.documents[`import-file:${scope.fileRef}`])
      if (file.schema !== "sf-import-file-v1" || file.id !== scope.fileRef || file.digest !== manifest.sourceDigest || file.principalRef !== authority.principalRef || file.accessRevision !== authority.accessRevision || file.policyVersion !== authority.policyVersion || digestSfValue(file.target) !== digestSfValue(scope.target) || typeof file.expiresAt !== "string" || !Number.isFinite(Date.parse(environment.at)) || !Number.isFinite(Date.parse(file.expiresAt)) || Date.parse(file.expiresAt) <= Date.parse(environment.at)) return { commit: false, value: false }
      const principal = await input.host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
      if (!principal || principal.id !== execution.actorId || !principal.canWrite) return { commit: false, value: false }
      const access = object(object(snapshot.data.access)[principal.id])
      const roles = principal.roles.filter((row) => row.surface === "planner").map((row) => row.role)
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      if (roster && !input.verifyRoster?.(snapshot, roster, actor, context)) return { commit: false, value: false }
      const rejection = { manifestId: manifest.id, previewDigest: scope.previewDigest, idempotencyKey: execution.idempotencyKey, commandDigest: execution.commandDigest, principalRef: actor.id }
      const prior = state.documents[`import-rejection:${rejectedReceiptId(rejection)}`] as { outcome?: string } | undefined
      if (prior) return { commit: false, value: false }
      const staged = mutation.execute(snapshot, actor, environment)
      if (!staged.commit) {
        if ("reason" in staged.value && staged.value.reason === "command-rejected" && (staged.value.status === "denied" || staged.value.status === "failed") && settleSfImportRejection(state, rejection)) return { commit: true, value: "rejected" as const }
        return { commit: false, value: false }
      }
      const receipt = { id: digestSfValue({ principal: actor.id, target: scope.target.incarnation, key: execution.idempotencyKey }), idempotencyKey: execution.idempotencyKey, commandDigest: execution.commandDigest, targetIncarnation: scope.target.incarnation, principalRef: actor.id, surface: "planner" as const, version: snapshot.versions[`versions:${command.target.id}`]?.version ?? 0, result: { ok: true as const, value: staged.value }, at: environment.at }
      if (!settleSfImportReceipt(state, { manifestId: manifest.id, expectedDigest: scope.previewDigest, receipt })) return { commit: false, value: false }
      return { commit: true, value: true }
    })
    if (saved.status !== "ok" || !saved.value) return { status: saved.status === "conflict" || saved.status === "preview" ? "conflict" : "unavailable", reason: "import-not-applied" }
    if (saved.value === "rejected") return { status: "denied", reason: "import-rejected" }
    if (!await input.host.revalidate(context) || !await input.authorizeTarget(scope.target, context, "receipt")) return { status: "denied", reason: "import-access-unavailable" }
    return input.readView(manifest.id, context)
  }
}
