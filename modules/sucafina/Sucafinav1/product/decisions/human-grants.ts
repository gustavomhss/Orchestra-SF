import { digestSfValue } from "../contracts/canonical.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../contracts/sf-execution.ts"
import type { DecisionMutationOperation } from "./mutations.ts"

type Action = "decisions.edit" | "decisions.coverage" | "decisions.criteria" | "decisions.select-portfolio" | "decisions.accept-analysis" | "decisions.apply" | "decisions.promote-alternative" | "decisions.prepare-changes" | "decisions.choose"

/** Reuse the human admission's full payload digest; a derived portfolio grant needs its own proof. */
export function createDecisionHumanGrants(input: {
  human: { authorize: (context: TrustedDomainContext, action: Action, payload: unknown) => Promise<boolean> }
  ui: { matchesIntent: (context: TrustedUiContext, operation: string, digest: string) => boolean }
  authorizePortfolioMutation: (operation: DecisionMutationOperation, payload: unknown, context: TrustedDomainContext) => Promise<boolean>
  matchesPortfolioMutation: (operation: DecisionMutationOperation, payload: unknown, context: TrustedDomainContext) => boolean
}) {
  const actions: Partial<Record<DecisionMutationOperation, Action>> = { "add-alternative": "decisions.promote-alternative", "prepare-changes": "decisions.prepare-changes", "record-choice": "decisions.choose" }
  const authorize = (action: Action, payload: unknown, context: TrustedDomainContext) => input.human.authorize(context, action, payload)
  const matches = (action: Action, payload: unknown, context: TrustedDomainContext) => context.kind === "ui" && input.ui.matchesIntent(context, `sf-human:${action}`, digestSfValue(payload))
  return {
    authorize,
    matches,
    authorizeMutation: async (operation: DecisionMutationOperation, payload: unknown, context: TrustedDomainContext) => {
      const action = actions[operation]
      return !!action && (await authorize(action, payload, context) || operation !== "record-choice" && await input.authorizePortfolioMutation(operation, payload, context))
    },
    matchesMutation: (operation: DecisionMutationOperation, payload: unknown, context: TrustedDomainContext) => {
      const action = actions[operation]
      return !!action && (matches(action, payload, context) || operation !== "record-choice" && input.matchesPortfolioMutation(operation, payload, context))
    },
  }
}
