import { digestSfValue } from "../contracts/canonical.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../contracts/sf-execution.ts"
import type { createSfUiAuthority } from "./ui-authority.ts"

/** Closed private read list: financial write permission is never required by these reads.
 * Every action still needs an explicit installation grant and domain authorization.
 */
export const sfHumanReadActions = ["views.read", "analysis.read", "decisions.portfolio.read", "bi.artifact.read", "bi.selection.read", "decisions.sensitivity.selection.read",
  "collaboration.question.output", "collaboration.thread.read", "collaboration.thread.history", "collaboration.relation.read",
  "collaboration.confirmation.prepare", "collaboration.confirmation.project", "collaboration.answer.prepare", "collaboration.answer.read",
  "collaboration.selection.list", "collaboration.selection.version", "collaboration.cycle.read", "collaboration.work.list",
  "collaboration.work.destination", "collaboration.recipients", "collaboration.storage.version"] as const

export const sfHumanActions = ["collaboration.thread.create", "collaboration.thread.reply", "collaboration.thread.edit", "collaboration.thread.resolve", "collaboration.question.confirm",
  "collaboration.relation.confirm", "collaboration.handoff.confirm", "collaboration.confirmation.confirm", "collaboration.answer.confirm", "collaboration.selection.create",
  ...sfHumanReadActions, "bi.artifact.save", "bi.selection.set", "decisions.sensitivity.select", "decisions.alternative.select", "views.save", "views.remove", "decisions.coverage", "decisions.select-portfolio", "decisions.promote-portfolio", "decisions.prepare-portfolio",
  "decisions.portfolio.evaluate", "decisions.sensitivity.evaluate", "documents.schema", "planner.preview", "planner.apply", "documents.confirm", "analysis.prepare", "analysis.start", "analysis.cancel", "imports.admit", "imports.apply", "decisions.edit", "decisions.criteria", "decisions.accept-analysis", "decisions.promote-alternative",
  "decisions.choose", "decisions.add-question", "decisions.answer-question", "decisions.draft-hot-topic", "decisions.promote-analysis", "decisions.condition.record", "decisions.outcome.select", "decisions.prepare-changes", "decisions.apply", "reviews.preserve",
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
