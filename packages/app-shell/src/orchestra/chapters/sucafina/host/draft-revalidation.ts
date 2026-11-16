import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContext, SfContextStamp, SfDraftRevalidation, SfDraftRevalidationInput } from "../context/contracts"
import { revalidateRequestsDraft } from "./draft-revalidation-requests"
import { revalidateSupplierDraft } from "./draft-revalidation-supplier"
import { revalidateSettingsDraft } from "./draft-revalidation-settings"
import { revalidateSourcingDraft } from "./draft-revalidation-sourcing"
import { revalidatePlannerVersionDraft } from "./draft-revalidation-planner-version"
import { revalidateVendorContractDraft } from "./draft-revalidation-vendor"
import { revalidateRiskStakeholderDraft } from "./draft-revalidation-risk-stakeholder"
import { revalidatePeopleDraft } from "./draft-revalidation-people"
import { revalidatePlannerCatalogDraft } from "./draft-revalidation-planner-catalog"
import { revalidateHotTopicDraft } from "./draft-revalidation-hot-topic"
import { revalidateProjectDraft } from "./draft-revalidation-project"

export async function revalidateSfNativeDraft(
  input: SfDraftRevalidationInput, fresh: SfContext, transport: SfTransport, signal: AbortSignal,
): Promise<SfDraftRevalidation> {
  if (signal.aborted) return { status: "unavailable" }
  if (input.originalOwner.installationId !== fresh.stamp.installationId ||
      input.originalOwner.projectId !== fresh.stamp.projectId ||
      input.originalOwner.principalRef !== fresh.stamp.principalRef) return { status: "authority-changed" }
  if (input.read.operationId === "domain.page.CAP25" && input.editScopeKey === "CAP25:sourcing")
    return revalidateSourcingDraft(input, fresh, transport, signal)
  if (input.read.operationId === "domain.page.CAP25")
    return revalidateRequestsDraft(input, fresh, transport, signal)
  if (input.read.operationId === "domain.page.CAP27")
    return revalidateSupplierDraft(input, fresh, transport, signal)
  if (input.read.operationId === "domain.page.CAP28")
    return revalidateSettingsDraft(input, fresh, transport, signal)
  if (input.read.operationId === "domain.page.CAP23")
    return revalidatePlannerVersionDraft(input, fresh, transport, signal)
  if (input.read.operationId === "domain.page.CAP14")
    return revalidateVendorContractDraft(input, fresh, transport, signal)
  if (input.read.operationId === "domain.page.CAP13" || input.read.operationId === "domain.page.CAP15")
    return revalidateRiskStakeholderDraft(input, fresh, transport, signal)
  if (input.read.operationId === "domain.page.CAP07" || input.read.operationId === "domain.page.CAP08")
    return revalidatePeopleDraft(input, fresh, transport, signal)
  if (input.read.operationId === "domain.page.CAP21")
    return revalidatePlannerCatalogDraft(input, fresh, transport, signal)
  if (input.read.operationId === "domain.page.CAP02")
    return revalidateHotTopicDraft(input, fresh, transport, signal)
  if (input.read.operationId === "domain.page.CAP10")
    return revalidateProjectDraft(input, fresh, transport, signal)
  if (input.read.operationId !== "projection.case" || input.identity.kind !== "record" ||
      input.read.fieldPaths.length || input.read.actionIds.length) return { status: "unavailable" }

  const ready = fresh.availability.some((resource) => resource.operations.some((operation) =>
    operation.operationId === "projection.case" && operation.state === "ready" && operation.operational))
  if (!ready) return { status: "denied" }
  const originalInput = input.read.input
  if (!originalInput || typeof originalInput !== "object" || Array.isArray(originalInput) ||
      !("caseRef" in originalInput) || originalInput.caseRef !== input.identity.recordRef || Object.keys(originalInput).length !== 1)
    return { status: "denied" }
  const result = await createSfDecisionsClient(transport)["projection.case"]({
    caseRef: input.identity.recordRef,
  }, { signal }).catch(() => undefined)
  if (signal.aborted || !result || result.kind !== "response") return { status: "unavailable" }
  if (result.status === 401 || result.status === 403 ||
      result.body.status === "denied" || result.body.status === "unauthenticated") return { status: "denied" }
  if (result.status !== 200 || result.body.status !== "ok") return { status: "unavailable" }
  const projection = result.body.value.projection
  // The original selector is opaque and is not projection.case.id.
  if (!sameDraftStamp(result.body.context, fresh.stamp) ||
      projection.context.installationId !== fresh.stamp.installationId ||
      projection.context.projectId !== fresh.stamp.projectId ||
      projection.context.principalRef !== fresh.stamp.principalRef ||
      projection.context.policyVersion !== fresh.stamp.policyVersion ||
      projection.context.accessRevision !== fresh.stamp.accessRevision ||
      !projection.case.id || !projection.case.incarnation ||
      !Number.isSafeInteger(projection.case.version)) return { status: "denied" }
  return { status: "authorized", authority: "unchanged", stamp: fresh.stamp, sourceVersion: projection.case.version }
}

export function sameDraftStamp(a: SfContextStamp, b: SfContextStamp) {
  return a.installationId === b.installationId && a.projectId === b.projectId &&
    a.hostId === b.hostId && a.principalRef === b.principalRef &&
    a.policyVersion === b.policyVersion && a.accessRevision === b.accessRevision
}
