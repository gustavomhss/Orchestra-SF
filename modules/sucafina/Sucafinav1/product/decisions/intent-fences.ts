import { digestSfValue } from "../contracts/canonical.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../contracts/sf-execution.ts"

type Action = "decisions.edit" | "decisions.coverage" | "decisions.criteria" | "decisions.select-portfolio" | "decisions.accept-analysis" | "decisions.apply" | "decisions.promote-alternative" | "decisions.prepare-changes" | "decisions.choose" | "decisions.promote-portfolio" | "decisions.prepare-portfolio"
type SourceFences = { dashboard: string; planner: string; procurement: string }

/** Capture one authenticated intent and the preflight source revisions for its locked write. */
export function createDecisionIntentFences(input: {
  human: { authorize: (context: TrustedDomainContext, action: Action, payload: unknown) => Promise<boolean> }
  ui: { matchesIntent: (context: TrustedUiContext, operation: string, digest: string) => boolean }
  readSourceFences: (context: TrustedDomainContext) => Promise<SourceFences | undefined>
  lockedSourceFences: () => SourceFences | undefined
}) {
  const records = new WeakMap<TrustedUiContext, { action: Action; digest: string; payload: unknown; fences: SourceFences }>()
  const matches = (context: TrustedDomainContext, action: Action, payload: unknown) => context.kind === "ui" && input.ui.matchesIntent(context, `sf-human:${action}`, digestSfValue(payload))
  return {
    authorize: async (context: TrustedDomainContext, action: Action, payload: unknown) => {
      try {
        if (context.kind !== "ui" || !await input.human.authorize(context, action, payload)) return false
        const digest = digestSfValue(payload)
        const prior = records.get(context)
        if (prior) return prior.action === action && prior.digest === digest && matches(context, action, payload)
        const fences = await input.readSourceFences(context)
        if (!fences || !await input.human.authorize(context, action, payload) || !matches(context, action, payload)) return false
        const existing = records.get(context)
        if (existing) return existing.action === action && existing.digest === digest && digestSfValue(existing.fences) === digestSfValue(fences)
        records.set(context, { action, digest, payload: structuredClone(payload), fences: structuredClone(fences) })
        return true
      } catch { return false }
    },
    verify: (context: TrustedDomainContext, action: Action, payload: unknown) => {
      try {
        if (context.kind !== "ui") return false
        const prior = records.get(context)
        const current = input.lockedSourceFences()
        return !!prior && prior.action === action && prior.digest === digestSfValue(payload) && !!current && digestSfValue(current) === digestSfValue(prior.fences) && matches(context, action, payload)
      } catch { return false }
    },
    payload: (context: TrustedDomainContext, action: Action) => {
      if (context.kind !== "ui") return undefined
      const prior = records.get(context)
      return prior?.action === action && matches(context, action, prior.payload) ? structuredClone(prior.payload) : undefined
    },
  }
}
