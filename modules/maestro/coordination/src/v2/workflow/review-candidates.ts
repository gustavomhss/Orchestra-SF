export * as ReviewCandidatesV2 from "./review-candidates"

import type { ReviewOutcomes } from "@orchestra/core/review/outcomes"
import type { ReviewItem } from "@orchestra/core/review-toolkit/item"
import type { ReviewResultV2 } from "../../governance/review-result"

export type Merged = Omit<ReviewResultV2.Candidate, "source"> & {
  readonly id: string
  readonly fingerprint: string
  readonly lenses: ReadonlyArray<string>
  readonly sources: ReadonlyArray<string>
  readonly agreement: number
  readonly observation: boolean
}

// Fingerprint dedup across lens children, with agreement counted per lens and per overlapping analyzer item. An
// observation outside a lens becomes a candidate of its class with the lowest rank. Agreement only orders the queue.
export function decisionState(state: string | undefined) {
  if (state === "confirmed") return "confirmed" as const
  if (state === "dropped") return "refuted" as const
  return "question" as const
}

export function admitSources(candidates: ReadonlyArray<ReviewResultV2.Candidate>, items: ReadonlyArray<ReviewItem.ToolItem>) {
  const sources: Array<string | undefined> = []
  const invalid: string[] = []
  for (const candidate of candidates) {
    if (!candidate.source) {
      sources.push(undefined)
      continue
    }
    const end = candidate.endLine ?? candidate.line
    const overlaps = items.some((entry) => entry.fingerprint === candidate.source && entry.class === candidate.class && entry.path === candidate.path && entry.line <= end && (entry.endLine ?? entry.line) >= candidate.line)
    if (!overlaps) {
      invalid.push(candidate.source)
      sources.push(undefined)
      continue
    }
    sources.push(candidate.source)
  }
  return { sources, invalid }
}

export function outcomeDecisions(
  settled: ReadonlyArray<{ readonly candidate: Merged; readonly result?: { readonly state: string } }>,
  overflow: ReadonlyArray<Merged>,
): ReviewOutcomes.Decision[] {
  const decided = [
    ...settled.map((item) => ({
      candidate: item.candidate,
      state: decisionState(item.result?.state),
    })),
    ...overflow.map((candidate) => ({ candidate, state: "question" as const })),
  ]
  return decided.flatMap((item) => item.candidate.sources.map((source) => ({
    source,
    class: item.candidate.class,
    path: item.candidate.path,
    line: item.candidate.line,
    ...(item.candidate.endLine ? { endLine: item.candidate.endLine } : {}),
    state: item.state,
  })))
}

export function omitSource(candidate: ReviewResultV2.Candidate) {
  const { source: claimed, ...without } = candidate
  void claimed
  return without
}

export function claimKey(fingerprint: string, candidate: { readonly line: number; readonly endLine?: number }) {
  return JSON.stringify([fingerprint, candidate.line, candidate.endLine ?? candidate.line])
}
