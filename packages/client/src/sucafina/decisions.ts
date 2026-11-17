/**
 * W16/A04 native decision API. There is exactly one call per user intent;
 * transport owns credentials, current owner fencing, response decoding and
 * explicit one-shot Idempotency-Key. This client never retries a lost reply.
 */
import type { Schema } from "effect"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import type { SfCallOptions, SfTransport } from "./transport.ts"

/**
 * 21 operation-specific methods: no operation:string or generic dispatcher,
 * no inferred authority from a caller-supplied principal or caseRef.
 * Result is the transport tagged union, preserving denial/stale/conflict,
 * optional financial values, and uncertain effects after network loss.
 */
export function createSfDecisionsClient(transport: SfTransport) {
  return Object.freeze({
    "projection.cases": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["projection.cases"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["projection.cases"], input, options),

    "projection.case": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["projection.case"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["projection.case"], input, options),

    "decisions.command.sf_case_draft": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.command.sf_case_draft"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["decisions.command.sf_case_draft"], input, options),

    "decisions.command.sf_question_prepare": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.command.sf_question_prepare"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["decisions.command.sf_question_prepare"], input, options),

    "decisions.command.sf_change_prepare": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.command.sf_change_prepare"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["decisions.command.sf_change_prepare"], input, options),

    "decisions.choice.read": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.choice.read"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["decisions.choice.read"], input, options),

    "decisions.current-choice-prepare": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.current-choice-prepare"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["decisions.current-choice-prepare"], input, options),

    "decisions.current-choice-promote": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.current-choice-promote"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["decisions.current-choice-promote"], input, options),

    "decisions.controls.read": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.controls.read"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["decisions.controls.read"], input, options),

    "decisions.decision-coverage": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-coverage"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["decisions.decision-coverage"], input, options),

    "decisions.decision-criteria": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-criteria"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["decisions.decision-criteria"], input, options),

    "decisions.decision-select-portfolio": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-select-portfolio"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["decisions.decision-select-portfolio"], input, options),

    "decisions.decision-condition": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-condition"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["decisions.decision-condition"], input, options),

    "decisions.decision-choose": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-choose"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["decisions.decision-choose"], input, options),

    "decisions.decision-add-question": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-add-question"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["decisions.decision-add-question"], input, options),

    "decisions.decision-answer-question": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-answer-question"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["decisions.decision-answer-question"], input, options),

    "decisions.decision-promote": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-promote"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["decisions.decision-promote"], input, options),

    "decisions.decision-prepare-changes": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-prepare-changes"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["decisions.decision-prepare-changes"], input, options),

    "decisions.decision-review": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-review"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["decisions.decision-review"], input, options),

    "decisions.decision-apply": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-apply"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["decisions.decision-apply"], input, options),

    "decisions.decision-recover": (input: Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-recover"]["input"]>, options: SfCallOptions) =>
      transport.execute(SfDecisions.operations["decisions.decision-recover"], input, options),
  })
}

export type SfDecisionsClient = ReturnType<typeof createSfDecisionsClient>
