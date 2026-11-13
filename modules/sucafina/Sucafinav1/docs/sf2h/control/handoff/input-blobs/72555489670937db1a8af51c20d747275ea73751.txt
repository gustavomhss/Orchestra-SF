import { roleMap } from "../../runtime/admin.ts"
import type { Actor, Command, Snapshot } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { sfScopedSourceIdentity } from "../integration/source-lifecycle.ts"
import { projectSfSourceScope, sfPlannerProjectionSelector } from "../integration/source-projections.ts"
import type { ImportTarget } from "./staged-files.ts"

/** Rebuild the source selector from the authenticated actor and check its current durable identity. */
export function verifyPlannerImportTarget(snapshot: Snapshot, target: ImportTarget, actor: Actor, context: TrustedDomainContext) {
  if (target.surface !== "planner" || !snapshot.sfSources || actor.id !== context.binding.principalRef || !actor.canWrite) return false
  const match = /^planner-version:([^:]+):([^:]+):([1-9]\d*)$/.exec(target.selectionRef)
  if (!match) return false
  const id = (() => { try { return decodeURIComponent(match[1]!) } catch { return undefined } })()
  if (!id || encodeURIComponent(id) !== match[1] || encodeURIComponent(target.incarnation) !== match[2] || Number(match[3]) !== target.version) return false
  const scope = { principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, recordType: "planner-version", recordId: id, selector: sfPlannerProjectionSelector(snapshot, actor) }
  const identity = sfScopedSourceIdentity(snapshot, scope)
  const projection = projectSfSourceScope("planner", snapshot, scope)
  return !!identity && projection !== undefined && identity.incarnation === target.incarnation && identity.version === target.version && identity.inputDigest === digestSfValue(projection)
}

/** The page-scoped source and its selected fields must still be current inside C08. */
export function verifyDashboardImportTarget(snapshot: Snapshot, _staged: Snapshot, target: ImportTarget, actor: Actor, command: Command, evidence: Extract<BusinessEvidenceRef, { kind: "record" }>, context: TrustedDomainContext, at: string) {
  const source = evidence.target
  if (command.action === "backup-import") {
    if (target.surface !== "dashboard" || !snapshot.sfSources || actor.id !== context.binding.principalRef || !actor.canWrite || !actor.roles.includes("admin") || source.surface !== "dashboard" || source.recordType !== "dashboard-dataset" || source.recordId !== "all" || source.period !== undefined || digestSfValue(source.fields) !== digestSfValue(["data"]) || source.incarnation !== target.incarnation || source.version !== target.version || evidence.refId !== target.selectionRef || target.selectionRef !== `sf-dataset:${encodeURIComponent(target.incarnation)}:${target.version}`) return false
    const scope = { principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, recordType: "dashboard-dataset", recordId: "all", selector: { kind: "dashboard-dataset-v1", actor, roleMapDigest: digestSfValue(roleMap(snapshot, "dashboard")), fields: ["data"] } }
    const identity = sfScopedSourceIdentity(snapshot, scope)
    const projection = projectSfSourceScope("dashboard", snapshot, scope, at)
    return !!identity && projection !== undefined && identity.incarnation === source.incarnation && identity.version === source.version && identity.inputDigest === source.projectionDigest && identity.inputDigest === digestSfValue(projection)
  }
  if (target.surface !== "dashboard" || !snapshot.sfSources || actor.id !== context.binding.principalRef || !actor.canWrite || source.surface !== "dashboard" || source.recordType !== "dashboard-page" || source.recordId !== command.page || !source.period || source.incarnation !== target.incarnation || source.version !== target.version || evidence.refId !== target.selectionRef || target.selectionRef !== `sf-source:${encodeURIComponent(target.incarnation)}:${target.version}`) return false
  const scope = { principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, recordType: source.recordType, recordId: source.recordId, selector: { page: command.page, fields: [...source.fields].sort(), period: source.period, actor, roleMapDigest: digestSfValue(roleMap(snapshot, "dashboard")) } }
  const identity = sfScopedSourceIdentity(snapshot, scope)
  const projection = projectSfSourceScope("dashboard", snapshot, scope, at)
  return !!identity && projection !== undefined && identity.incarnation === source.incarnation && identity.version === source.version && identity.inputDigest === source.projectionDigest && identity.inputDigest === digestSfValue(projection)
}
