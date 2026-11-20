import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DecisionCasePort, DomainPortHost, PlannerSourceHost } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfProductStatePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { sfPlannerEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/integration/planner-sources.ts"
import { projectSfSourceScope, sfPlannerProjectionSelector } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import { sfScopedSourceIdentity, sfSourceIdentity } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { sfPlannerCaseDependencies } from "./planner-case-read-scope.ts"
import { createSfCaseReadBatch } from "./case-read-batch.ts"
import type { SfCaseReadBatchAdmission } from "./case-read-batch.ts"

type RecordRef = Extract<BusinessEvidenceRef, { kind: "record" }>

/** Planner admission remains separate from mixed records and from logical proof
 * reuse. The common owner executes every canonical read and a fresh egress. */
export function createSfPlannerCaseReadBatch(input: {
  host: DomainPortHost
  state: SfProductStatePort
  read: DecisionCasePort["read"]
  sources: Pick<PlannerSourceHost, "resolveForecastSource">
  readerIdentity: () => BusinessContextService | undefined
  lockedSourceFences: () => Record<"dashboard" | "planner" | "procurement", string> | undefined
}): DecisionCasePort["read"] {
  return createSfCaseReadBatch(input, sfPlannerCaseReadAdmission(input))
}

/** Reuse the exact domain admission for complete read-only producer phases. */
export function sfPlannerCaseReadAdmission(input: Omit<Parameters<typeof createSfPlannerCaseReadBatch>[0], "read">): SfCaseReadBatchAdmission {
  return { kind: "planner",
    identity: () => [input.sources, input.sources.resolveForecastSource],
    forCall: (call) => ({ current: () => true, dependencies: sfPlannerCaseDependencies,
      witness: async (refs, snapshots, principal) => refs.every((ref) => sfPlannerRecordMaterialized(ref, call, snapshots.planner, principal))
        ? { kind: "current", value: {} } : { kind: "unsupported" } }),
  }
}

/** Prove only that the exact current actor scope needs no C02 write. The actual
 * source producer still opens and verifies it twice inside each canonical read. */
export function sfPlannerRecordMaterialized(ref: RecordRef, call: TrustedDomainContext, snapshot: Snapshot,
  principal: NonNullable<Awaited<ReturnType<DomainPortHost["authenticate"]>>>) {
  const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
  const selector = sfPlannerProjectionSelector(snapshot, { id: principal.id, roles,
    canWrite: principal.canWrite && roles.some((role) => role !== "viewer") })
  const scope = { principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision,
    policyVersion: call.binding.policyVersion, recordType: "planner-version", recordId: ref.target.recordId, selector }
  const entry = snapshot.sfSources?.scopes?.[digestSfValue(scope)]
  const source = sfSourceIdentity(snapshot, scope.recordType, scope.recordId), identity = sfScopedSourceIdentity(snapshot, scope)
  const projection = projectSfSourceScope("planner", snapshot, scope)
  if (!entry || !source || !identity || !projection || typeof projection !== "object" || Array.isArray(projection) ||
    identity.incarnation !== entry.incarnation || identity.version !== entry.version || identity.inputDigest !== digestSfValue(projection))
    return false
  const expected = sfPlannerEvidenceRef({ versionId: scope.recordId, projection: projection as Record<string, unknown>, identity }, call)
  return !!expected && digestSfValue(expected) === digestSfValue(ref) &&
    digestSfValue(entry) === digestSfValue({ scope, sourceIncarnation: source.incarnation, incarnation: entry.incarnation,
      alive: true, inputDigest: identity.inputDigest, version: entry.version })
}
