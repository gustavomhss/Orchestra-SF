import type { SfDraftRegistry, SfEditScopeKey, SfRef } from "../../../context/contracts"
import type { PrProjection } from "./model"

/**
 * F01's owner-scoped, in-memory S03 draft stores only a comment/rejection reason
 * and the local sending fence. It never stores a private source page, token,
 * role, full server response or authorization decision in URL/localStorage.
 */
export type PrDecisionDraft = Readonly<{
  comment: string
  reason: string
  commandStarted: boolean
}>
export const PR_EDIT_SCOPE = "CAP26:submitted-pr-decision" as SfEditScopeKey
const EMPTY: PrDecisionDraft = { comment: "", reason: "", commandStarted: false }

export function acquirePrDecisionDraft(registry: SfDraftRegistry, source: PrProjection) {
  if (!source.actions.length) return null
  return registry.acquire<PrDecisionDraft>({
    surfaceId: "CAP26",
    identity: { kind: "record", recordRef: source.requestRef as SfRef },
    editScopeKey: PR_EDIT_SCOPE,
    baseVersion: source.version,
    base: EMPTY,
    value: EMPTY,
    revalidation: {
      operationId: "domain.page.CAP26",
      input: {},
      fieldPaths: ["status", "createdBy", "prApproval"],
      actionIds: source.actions,
    },
  })
}

/**
 * Only an authorized refetch of the same record can advance the source version.
 * S03 keeps dirty text and reports conflict instead of overwriting it.
 */
export function receivePrSourceVersion(
  controller: NonNullable<ReturnType<typeof acquirePrDecisionDraft>>,
  version: number,
) {
  const state = controller.snapshot()
  if (state.availability !== "active" || Object.is(state.baseVersion, version)) return
  controller.receiveRemote({ baseVersion: version, value: EMPTY })
}
