import { SfProcurement } from "@orchestra/schema/sucafina/procurement"

export type Cap26Page = typeof SfProcurement.operations["domain.page.CAP26"]["output"]["Type"]
export type Cap26PageOk = Extract<Cap26Page, { status: "ok" }>
export type Cap26Request = Cap26PageOk["value"]["data"]["requests"][number]
export type PrDecision = "approve" | "reject"
export type PrGroup = "you" | "others" | "unassigned"

/**
 * A presentation of the persisted producer snapshot. This is NOT an
 * authorization decision: the original Procurement transaction re-checks
 * holder, role, self-approval policy, current step and CAS.
 */
export type PrProjection = Readonly<{
  kind: "submitted-pr"
  requestRef: string
  request: Cap26Request
  version: number
  holderId: string | null
  holderName: string | null
  levelName: string | null
  group: PrGroup
  amount: number
  baseCurrency: string | null
  stepOrdinal: number
  actions: readonly PrDecision[]
  revision: string
}>
export type PrLookup =
  | PrProjection
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "not-submitted"; status: string }>
  | Readonly<{ kind: "source-unavailable"; reason: "duplicate" | "version" | "step" | "holder" | "group" | "amount" }>

/** Exact original record identity; never infer it from a title or row index. */
export function findSubmittedPr(page: Cap26PageOk, requestRef: string): PrLookup {
  const requests = page.value.data.requests.filter((request) => request.number === requestRef)
  if (requests.length === 0) return { kind: "not-found" }
  if (requests.length !== 1) return { kind: "source-unavailable", reason: "duplicate" }
  const request = requests[0]!
  if (request.status !== "pr_pending") return { kind: "not-submitted", status: request.status }

  const version = page.value.versions["requests:" + requestRef]?.version
  if (!Number.isSafeInteger(version) || version === undefined || version < 0)
    return { kind: "source-unavailable", reason: "version" }

  const steps = request.prApproval?.steps
  const pending = steps?.map((step, index) => ({ step, index })).filter(({ step }) => step.status === "pending") ?? []
  if (pending.length !== 1) return { kind: "source-unavailable", reason: "step" }
  const current = pending[0]!
  const holderId = current.step.holderId
  if (holderId !== null && (typeof holderId !== "string" || !holderId.trim()))
    return { kind: "source-unavailable", reason: "holder" }

  const groups: PrGroup[] = [
    ...(page.value.data.waitingForYou.some((item) => item.number === requestRef) ? ["you" as const] : []),
    ...(page.value.data.waitingForOthers.some((item) => item.number === requestRef) ? ["others" as const] : []),
    ...(page.value.data.unassigned.some((item) => item.number === requestRef) ? ["unassigned" as const] : []),
  ]
  if (groups.length !== 1 || (holderId === null) !== (groups[0] === "unassigned"))
    return { kind: "source-unavailable", reason: "group" }

  const amount = request.prApproval?.amount
  if (amount === undefined || !Number.isFinite(amount))
    return { kind: "source-unavailable", reason: "amount" }

  const actions = (["approve", "reject"] as const).filter((action) =>
    groups[0] !== "others" && page.value.allowedActionIds.includes(action),
  )
  const holderName = holderId === null
    ? null
    : page.value.data.directory.find((person) => person.id === holderId)?.name ?? null
  const baseCurrency = typeof request.prApprovalBaseCurrency === "string" &&
    /^[A-Z]{3}$/.test(request.prApprovalBaseCurrency)
    ? request.prApprovalBaseCurrency
    : null

  // Include the frozen submitted request, holder/stage, action admission, settings
  // affecting approval, owner stamp and CAS. A changed source requires new review.
  const revision = JSON.stringify({
    request,
    version,
    groups,
    allowedActionIds: page.value.allowedActionIds,
    blockSelfApproval: page.value.data.formSettings.blockSelfApproval,
    stamp: page.context,
    selection: page.value.selection,
  })
  return {
    kind: "submitted-pr",
    requestRef,
    request,
    version,
    holderId,
    holderName,
    levelName: current.step.levelName ?? null,
    group: groups[0]!,
    amount,
    baseCurrency,
    stepOrdinal: current.index,
    actions,
    revision,
  }
}

/**
 * The second read is from the same authorized CAP26 operation and owner.
 * No command is sent if any approval-relevant byte changed since review.
 */
export function samePrReview(left: PrProjection, right: PrLookup): right is PrProjection {
  return right.kind === "submitted-pr" &&
    left.requestRef === right.requestRef &&
    left.revision === right.revision
}

/**
 * A successful command result is NOT a receipt. For an uncertain mutation,
 * the next authorized read may show a changed producer state, but does not
 * prove that a particular lost command was accepted.
 */
export function sourceChangedAfterIntent(before: PrProjection, page: Cap26PageOk): boolean {
  const now = findSubmittedPr(page, before.requestRef)
  return now.kind === "not-submitted" ||
    (now.kind === "submitted-pr" && now.revision !== before.revision)
}
