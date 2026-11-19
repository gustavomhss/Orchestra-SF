import { Schema } from "effect"
import { SfContextStamp } from "@orchestra/schema/sucafina/context"
import { SfDecisionsDecisionChoose, SfProjectionCase } from "@orchestra/schema/sucafina/decisions"

/** Untrusted browser data. This is neither a grant nor a command receipt. */
export const SfRecordedChoiceIntent = Schema.Struct({
  schema: Schema.Literal("sf-recorded-choice-intent/1"),
  caseRef: SfProjectionCase.input.fields.caseRef,
  owner: SfContextStamp,
  key: Schema.String.pipe(Schema.check(Schema.isPattern(/^[A-Za-z0-9._:-]{8,128}$/))),
  body: SfDecisionsDecisionChoose.input,
})
export type SfRecordedChoiceIntent = Schema.Schema.Type<typeof SfRecordedChoiceIntent>
export type SfRecordedChoiceInspection = Readonly<{ status: "ready"; choiceId: string }> | Readonly<{ status: "unavailable" }>
type Projection = Extract<Schema.Schema.Type<typeof SfProjectionCase.output>, { status: "ok" }>["value"]["projection"]

/** The original authorized projection proves a historical choice, not its
 * private idempotency key. Only C08 may reconcile that key and the exact body.
 * An absent/ambiguous choice or version event never enables a new command.
 */
export function recordedChoiceInProjection(intent: SfRecordedChoiceIntent, projection: Projection): string | undefined {
  const { body, owner } = intent, current = projection.case, context = projection.context
  if (context.kind !== "ui" || context.installationId !== owner.installationId ||
      context.projectId !== owner.projectId || context.principalRef !== owner.principalRef ||
      context.policyVersion !== owner.policyVersion || context.accessRevision !== owner.accessRevision ||
      current.id !== body.caseRef.id || current.incarnation !== body.caseRef.incarnation ||
      !Number.isSafeInteger(current.version) || current.version < body.caseRef.version + 1 || body.comparison.scenarioRefs.length !== 2 ||
      body.comparison.scenarioRefs[0] === body.comparison.scenarioRefs[1] ||
      JSON.stringify(body.comparison.criteria) !== JSON.stringify(body.criteria)) return undefined
  const choices = current.choices.filter((choice) =>
    choice.alternativeId === body.alternativeId && choice.alternativeVersion === body.alternativeVersion &&
    choice.principalRef === owner.principalRef && choice.reason === body.reason &&
    JSON.stringify(choice.criteria) === JSON.stringify(body.criteria) &&
    choice.comparison.baselineResultRef === body.comparison.scenarioRefs[0] &&
    choice.comparison.alternativeResultRef === body.comparison.scenarioRefs[1])
  if (choices.length !== 1) return undefined
  const choice = choices[0]!
  const events = current.ledger.filter((event) =>
    event.kind === "choice-recorded" && event.caseRef.id === body.caseRef.id &&
    event.caseRef.incarnation === body.caseRef.incarnation && event.caseRef.version === body.caseRef.version + 1 &&
    event.principalRef === owner.principalRef && event.at === choice.at && event.rationale === choice.reason)
  return events.length === 1 ? choice.id : undefined
}
