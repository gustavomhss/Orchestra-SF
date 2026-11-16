import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import { Option, Schema } from "effect"
import type { SfCallOptions, SfTransport } from "./transport"

/** A13 typed, explicit client. All 29 calls delegate to F02, which owns the
 *  current authenticated owner, aborts, response decoding and idempotency.
 *  Never retry ambiguous mutations, never cache recipient/source projections.
 */
export function createSfCollaborationClient(transport: SfTransport) {
  return {
    "collaboration.question-consume": (input: typeof SfCollaboration.operations["collaboration.question-consume"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.question-consume"], input, options),
    "collaboration.question-output": (input: typeof SfCollaboration.operations["collaboration.question-output"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.question-output"], input, options),
    "collaboration.thread-create": (input: typeof SfCollaboration.operations["collaboration.thread-create"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.thread-create"], input, options),
    "collaboration.thread-read": (input: typeof SfCollaboration.operations["collaboration.thread-read"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.thread-read"], input, options),
    "collaboration.thread-reply": (input: typeof SfCollaboration.operations["collaboration.thread-reply"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.thread-reply"], input, options),
    "collaboration.thread-resolve": (input: typeof SfCollaboration.operations["collaboration.thread-resolve"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.thread-resolve"], input, options),
    "collaboration.thread-edit": (input: typeof SfCollaboration.operations["collaboration.thread-edit"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.thread-edit"], input, options),
    "collaboration.thread-history": (input: typeof SfCollaboration.operations["collaboration.thread-history"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.thread-history"], input, options),
    "collaboration.relation-create": (input: typeof SfCollaboration.operations["collaboration.relation-create"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.relation-create"], input, options),
    "collaboration.relation-remove": (input: typeof SfCollaboration.operations["collaboration.relation-remove"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.relation-remove"], input, options),
    "collaboration.relation-read": (input: typeof SfCollaboration.operations["collaboration.relation-read"]["input"]["Type"], options: SfCallOptions) => {
      const parsed = Schema.decodeUnknownOption(Schema.toType(SfCollaboration.operations["collaboration.relation-read"].input), { onExcessProperty: "error" })(input)
      if (Option.isNone(parsed) || "recordRefs" in parsed.value && new Set(parsed.value.recordRefs).size !== parsed.value.recordRefs.length)
        return Promise.resolve({ kind: "transport-error" as const, reason: "contract-mismatch" as const })
      return transport.execute(SfCollaboration.operations["collaboration.relation-read"], parsed.value, options)
    },
    "collaboration.handoff-create": (input: typeof SfCollaboration.operations["collaboration.handoff-create"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.handoff-create"], input, options),
    "collaboration.handoff-link": (input: typeof SfCollaboration.operations["collaboration.handoff-link"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.handoff-link"], input, options),
    "collaboration.handoff-update": (input: typeof SfCollaboration.operations["collaboration.handoff-update"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.handoff-update"], input, options),
    "collaboration.confirmation-prepare": (input: typeof SfCollaboration.operations["collaboration.confirmation-prepare"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.confirmation-prepare"], input, options),
    "collaboration.confirmation-confirm": (input: typeof SfCollaboration.operations["collaboration.confirmation-confirm"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.confirmation-confirm"], input, options),
    "collaboration.confirmation-project": (input: typeof SfCollaboration.operations["collaboration.confirmation-project"]["input"]["Type"], options: SfCallOptions) => {
      const parsed = Schema.decodeUnknownOption(Schema.toType(SfCollaboration.operations["collaboration.confirmation-project"].input), { onExcessProperty: "error" })(input)
      if (Option.isNone(parsed)) return Promise.resolve({ kind: "transport-error" as const, reason: "contract-mismatch" as const })
      return transport.execute(SfCollaboration.operations["collaboration.confirmation-project"], parsed.value, options)
    },
    "collaboration.answer-prepare": (input: typeof SfCollaboration.operations["collaboration.answer-prepare"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.answer-prepare"], input, options),
    "collaboration.answer-prepare-message": (input: typeof SfCollaboration.operations["collaboration.answer-prepare-message"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.answer-prepare-message"], input, options),
    "collaboration.answer-confirm": (input: typeof SfCollaboration.operations["collaboration.answer-confirm"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.answer-confirm"], input, options),
    "collaboration.answer-read": (input: typeof SfCollaboration.operations["collaboration.answer-read"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.answer-read"], input, options),
    "collaboration.selection-create": (input: typeof SfCollaboration.operations["collaboration.selection-create"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.selection-create"], input, options),
    "collaboration.selection-list": (input: typeof SfCollaboration.operations["collaboration.selection-list"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.selection-list"], input, options),
    "collaboration.selection-version": (input: typeof SfCollaboration.operations["collaboration.selection-version"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.selection-version"], input, options),
    "collaboration.cycle-read": (input: typeof SfCollaboration.operations["collaboration.cycle-read"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.cycle-read"], input, options),
    "collaboration.work-list": (input: typeof SfCollaboration.operations["collaboration.work-list"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.work-list"], input, options),
    "collaboration.work-destination": (input: typeof SfCollaboration.operations["collaboration.work-destination"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.work-destination"], input, options),
    "collaboration.recipients": (input: typeof SfCollaboration.operations["collaboration.recipients"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.recipients"], input, options),
    "collaboration.storage-version": (input: typeof SfCollaboration.operations["collaboration.storage-version"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfCollaboration.operations["collaboration.storage-version"], input, options),
  } as const
}
