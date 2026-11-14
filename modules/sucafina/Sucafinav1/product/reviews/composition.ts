import { createReviewServices } from "./services.ts"
import { createReviewAgendaSelection } from "./selection.ts"
import type { ReviewAgendaPorts } from "./selection.ts"
import { createReviewThreadComments } from "./thread-access.ts"
import { createReviewRoutineSelection } from "./routine-selection.ts"

type Services = Parameters<typeof createReviewServices>[0]
type Comments = Parameters<typeof createReviewThreadComments>[0]

export type ReviewCompositionInput = Omit<Services, "selection"> & {
  ports: Omit<ReviewAgendaPorts, "threadComments">
  access: Omit<Services["selection"], "select" | "authorizeComments" | "isHistoricalSelection">
  collaboration: Omit<Comments, "host" | "history"> & { history: NonNullable<Comments["history"]> }
  routineResults?: Parameters<typeof createReviewRoutineSelection>[0]["results"]
  maxSelections?: number
}

/** The host supplies authenticated producer instances; this factory creates no host, listener or alternate domain store. */
export function createReviewComposition(input: ReviewCompositionInput) {
  if ([input.ports?.selectDashboardAgenda, input.ports?.planner?.compareForecast, input.ports?.procurement?.read, input.ports?.procurement?.readSupplier, input.ports?.procurement?.readContract, input.collaboration?.threads?.read, input.collaboration?.history?.readVersion, input.collaboration?.authorizeSourceMapping, input.access?.authorizeSections, input.access?.authorizeOutcomeComparison, input.access?.authorizeOutcome, input.access?.authorizeDecision, input.access?.authorizeSensitivity, input.access?.revalidate].some((operation) => typeof operation !== "function")) throw new Error("SF_REVIEW_PRODUCERS_UNAVAILABLE")
  const comments = createReviewThreadComments({ ...input.collaboration, host: input.host })
  const currentAgenda = createReviewAgendaSelection({
    ports: { ...input.ports, threadComments: comments },
    revalidate: (context) => input.host.revalidate(context),
    now: input.now,
    ...(input.maxSelections === undefined ? {} : { maxSelections: input.maxSelections }),
  })
  const routineAgenda = input.routineResults ? createReviewRoutineSelection({ results: input.routineResults, revalidate: input.host.revalidate, now: input.now, ...(input.maxSelections === undefined ? {} : { maxSelections: input.maxSelections }) }) : undefined
  const agenda = {
    ...currentAgenda,
    select: ((selectionRef, sectionRefs, context, period) => typeof selectionRef === "string" && selectionRef.startsWith("review-routine:")
      ? routineAgenda?.select(selectionRef, sectionRefs, context, period) ?? Promise.resolve({ status: "unavailable" as const, reason: "routine-review-reader-unavailable" })
      : currentAgenda.select(selectionRef, sectionRefs, context, period)) satisfies typeof currentAgenda.select,
    release: (selectionRef: string) => { currentAgenda.release(selectionRef); routineAgenda?.release(selectionRef) },
  }
  const services = createReviewServices({
    state: input.state,
    host: input.host,
    authority: input.authority,
    evidence: input.evidence,
    selection: { ...input.access, select: agenda.select, isHistoricalSelection: (ref, context) => routineAgenda?.isHistoricalSelection(ref, context) ?? false, authorizeComments: comments.authorizeComments },
    creationTarget: input.creationTarget,
    operationIdentity: input.operationIdentity,
    requiredAuthority: input.requiredAuthority,
    maxBytes: input.maxBytes,
    now: input.now,
  })
  return { agenda, routineAgenda, comments, services, ...services }
}

