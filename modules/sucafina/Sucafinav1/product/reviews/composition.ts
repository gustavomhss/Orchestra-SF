import { createReviewServices } from "./services.ts"
import { createReviewAgendaSelection } from "./selection.ts"
import type { ReviewAgendaPorts } from "./selection.ts"
import { createReviewThreadComments } from "./thread-access.ts"

type Services = Parameters<typeof createReviewServices>[0]
type Comments = Parameters<typeof createReviewThreadComments>[0]

export type ReviewCompositionInput = Omit<Services, "selection"> & {
  ports: Omit<ReviewAgendaPorts, "threadComments">
  access: Omit<Services["selection"], "select" | "authorizeComments">
  collaboration: Omit<Comments, "host" | "history"> & { history: NonNullable<Comments["history"]> }
  maxSelections?: number
}

/** The host supplies authenticated producer instances; this factory creates no host, listener or alternate domain store. */
export function createReviewComposition(input: ReviewCompositionInput) {
  if ([input.ports?.selectDashboardAgenda, input.ports?.planner?.compareForecast, input.ports?.procurement?.read, input.ports?.procurement?.readSupplier, input.ports?.procurement?.readContract, input.collaboration?.threads?.read, input.collaboration?.history?.readVersion, input.collaboration?.authorizeSourceMapping, input.access?.authorizeSections, input.access?.authorizeOutcomeComparison, input.access?.authorizeOutcome, input.access?.authorizeDecision, input.access?.authorizeSensitivity, input.access?.revalidate].some((operation) => typeof operation !== "function")) throw new Error("SF_REVIEW_PRODUCERS_UNAVAILABLE")
  const comments = createReviewThreadComments({ ...input.collaboration, host: input.host })
  const agenda = createReviewAgendaSelection({
    ports: { ...input.ports, threadComments: comments },
    revalidate: (context) => input.host.revalidate(context),
    now: input.now,
    ...(input.maxSelections === undefined ? {} : { maxSelections: input.maxSelections }),
  })
  const services = createReviewServices({
    state: input.state,
    host: input.host,
    authority: input.authority,
    evidence: input.evidence,
    selection: { ...input.access, select: agenda.select, authorizeComments: comments.authorizeComments },
    creationTarget: input.creationTarget,
    operationIdentity: input.operationIdentity,
    requiredAuthority: input.requiredAuthority,
    maxBytes: input.maxBytes,
    now: input.now,
  })
  return { agenda, comments, services, ...services }
}
