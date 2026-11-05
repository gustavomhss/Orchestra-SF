export * as ReviewCardV2 from "./review-card"

import { isDeepStrictEqual } from "node:util"
import { ReviewRouting } from "@orchestra/core/review/routing"
import type { MaestroEvent } from "@orchestra/schema/maestro-event"
import { ReviewResultV2 } from "../governance/review-result"

export class ValidationError extends Error {
  readonly name = "ReviewCardValidationError"
  constructor(readonly reason: "malformed-card" | "routing-mismatch" | "scope-mismatch" | "unverified-finding" | "verdict-mismatch") {
    super(reason)
  }
}

export function validate(reply: string, expected: {
  readonly routing: ReviewRouting.Record
  readonly scope: { readonly base: string; readonly head: string; readonly files: number; readonly changedLines: number }
  readonly confirmed?: ReadonlyArray<{
    readonly id: string
    readonly path: string
    readonly line: number
    readonly endLine?: number
    readonly severity: string
    readonly class: string
    readonly node: string
    readonly rungs: ReadonlyArray<string>
    readonly evidence: MaestroEvent.Review.Evidence
  }>
}): ReviewResultV2.Card {
  const card = ReviewResultV2.parse(reply)
  if (!card) throw new ValidationError("malformed-card")
  if (
    !isDeepStrictEqual(card.routing, expected.routing) ||
    ReviewRouting.digest(card.routing) !== ReviewRouting.digest(expected.routing) ||
    card.profile !== expected.routing.profile.id || card.tier !== ReviewRouting.tier(expected.routing) ||
    !isDeepStrictEqual(card.overlays, expected.routing.overlays.map((overlay) => overlay.id))
  ) throw new ValidationError("routing-mismatch")
  if (!isDeepStrictEqual(card.scope, expected.scope)) throw new ValidationError("scope-mismatch")
  if (card.outcome === "blocked" && card.blockers.length === 0) throw new ValidationError("verdict-mismatch")
  const quick = ReviewRouting.tier(expected.routing) === "quick"
  if (!quick && expected.confirmed === undefined) throw new ValidationError("unverified-finding")
  for (const finding of card.findings) {
    if (quick) {
      if (
        !["P0", "P1"].includes(finding.severity) || !finding.rungs.includes("quote") ||
        finding.evidence.kind !== "quote" || finding.evidence.path !== finding.path ||
        finding.evidence.startLine !== finding.line || finding.evidence.endLine !== (finding.endLine ?? finding.line)
      ) throw new ValidationError("unverified-finding")
      continue
    }
    if (!expected.confirmed?.some((item) =>
      item.id === finding.id && item.path === finding.path && item.line === finding.line && item.endLine === finding.endLine &&
      item.severity === finding.severity && item.class === finding.class && item.node === finding.node &&
      isDeepStrictEqual(item.rungs, finding.rungs) && isDeepStrictEqual(item.evidence, finding.evidence)
    )) throw new ValidationError("unverified-finding")
  }
  if (card.outcome === "done" && card.verdict === "APPROVE" &&
    card.findings.some((finding) => finding.status === "open" && ["P0", "P1"].includes(finding.severity))
  ) throw new ValidationError("verdict-mismatch")
  return card
}
