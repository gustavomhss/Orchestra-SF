import { digestSfValue } from "../contracts/canonical.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../contracts/sf-execution.ts"
import type { createSfUiAuthority } from "./ui-authority.ts"

export const sfHumanActions = ["collaboration.thread.create", "collaboration.thread.reply", "collaboration.thread.resolve",
  "collaboration.relation.confirm", "collaboration.handoff.confirm", "collaboration.confirmation.confirm",
  "views.read", "views.save", "views.remove", "decisions.coverage", "decisions.select-portfolio", "decisions.promote-portfolio", "decisions.prepare-portfolio",
  "decisions.portfolio.read", "decisions.portfolio.evaluate", "decisions.sensitivity.evaluate", "documents.schema", "planner.preview", "planner.apply", "documents.confirm", "analysis.start", "analysis.read", "analysis.cancel", "imports.admit", "imports.apply", "decisions.edit", "decisions.criteria", "decisions.accept-analysis", "decisions.promote-alternative",
  "decisions.choose", "decisions.prepare-changes", "decisions.apply", "reviews.preserve",
  "routines.admit", "routines.run", "schedules.create", "schedules.update", "schedules.pause"] as const
export type SfHumanAction = typeof sfHumanActions[number]

/** Private HTTP command admission. These actions are never registered as resident capabilities. */
export function createSfHumanAuthority(input: { origin: string; ui: ReturnType<typeof createSfUiAuthority> }) {
  return {
    admit: async (request: Request, action: SfHumanAction, payload: unknown): Promise<PortResult<TrustedUiContext>> => {
      if (request.method !== "POST" || new URL(request.url).origin !== input.origin || request.headers.get("origin") !== input.origin ||
        request.headers.get("sec-fetch-site") === "cross-site" || !sfHumanActions.some((value) => value === action))
        return { status: "denied", reason: "human-command-unavailable" }
      const operation = `sf-human:${action}`
      const digest = digestSfValue(payload)
      const admitted = await input.ui.admit(request, operation, digest)
      if (admitted.status !== "ok") return admitted
      if (!await input.ui.validate(admitted.value, operation, digest)) {
        input.ui.finish(admitted.value)
        return { status: "denied", reason: "human-command-unavailable" }
      }
      return admitted
    },
    authorize: async (context: TrustedDomainContext, action: SfHumanAction, payload: unknown) => {
      if (context.kind !== "ui") return false
      const operation = `sf-human:${action}`
      const digest = digestSfValue(payload)
      return input.ui.matchesIntent(context, operation, digest) && await input.ui.revalidate(context) &&
        input.ui.matchesIntent(context, operation, digest)
    },
    finish: input.ui.finish,
  }
}
