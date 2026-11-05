import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import { Effect } from "effect"
import { ReviewCatalog } from "@orchestra/core/review/catalog"
import { MaestroReviewTools } from "../src/v2/tools/review"
import { ReviewPRFactsV2 } from "../src/v2/tools/review-pr-facts"
import { ReviewChecksV2 } from "../src/v2/workflow/review-checks"

// Session doubles and scripted prompts are fixture-only. They are not a durable
// SessionRunner proof and cannot establish host round authority.

const PARENT = "ses_round_parent"
const VALIDATION = "val_round"
const STAGE = "code"
const HEAD = "abc123head"
const METHOD = "review-v2/code/standard"
const ROUTING_DIGEST = "a".repeat(64)
const CATALOG_DIGEST = "b".repeat(64)
const TUPLE = ["governed-round-v1", PARENT, VALIDATION, STAGE, HEAD, METHOD, ROUTING_DIGEST, CATALOG_DIGEST]
const KEY_LITERAL = "c93505134417a1ea447a04a6a6cafbd9960d2a61737538f629fd25dcb9eb6c89"

const routing = {
  version: "route-v1", catalog: CATALOG_DIGEST, profile: { id: "code", source: "request" },
  tier: { id: "standard", source: "request", signals: [] }, overlays: [], languages: [], lenses: [], packs: [],
  budget: { lensChildren: 1, samples: 1, verifiers: 1, itemsPerLens: 1, loadsPerSession: 1,
    candidatesPerChild: 1, candidatesPerVerifier: 1, toolCallsPerSession: 1, probeAttempts: 1 },
  deviations: [],
} as const

function hostFacts(candidate: string): ReviewPRFactsV2.Facts {
  return {
    candidate, method: METHOD, routing,
    scope: { base: "base", head: HEAD, files: 1, changedLines: 1 },
    checkFacts: ReviewChecksV2.collect({ routing, checks: [], catalog: ReviewCatalog.current, settings: undefined }),
    outcomes: [],
    confirmed: [{ id: "C1", path: "docs/export.md", line: 3, severity: "P1", class: "logic.invariant", node: "lucy-review-prove-quote",
      lens: "correctness-logic", rule: "logic.invariant", trigger: "The export claim is not held.", rungs: ["quote"],
      evidence: { kind: "quote", path: "docs/export.md", startLine: 3, endLine: 3 } }],
  }
}

test("the governed round key is the hash of the host tuple, not a model path", () => {
  expect(createHash("sha256").update(JSON.stringify(TUPLE), "utf8").digest("hex")).toBe(KEY_LITERAL)
  expect(TUPLE[0]).toBe("governed-round-v1")
  expect(CATALOG_DIGEST.startsWith("sha256:")).toBe(false)
})

test("reach-blocker: registered plan APPROVE then code FIX_FIRST cannot retain a host round yet", () =>
  Effect.runPromise(Effect.die(new Error(
    "reach-blocker: governed-round-writer-unwired. recordReview does not save ReviewPRFactsV2, review-round is absent, and WorkReview.prepare is not in this tree. A seeded receipt is not publication. Session doubles are fixture-only, not durable SessionRunner proof.",
  ))))

test("a newer candidate with no host facts does not read an older complete round", () =>
  Effect.runPromise(Effect.gen(function* () {
    const older = "c".repeat(64)
    const newer = "d".repeat(64)
    const olderStore = MaestroReviewTools.analysisStore(`pr_${older}`)
    const newerStore = MaestroReviewTools.analysisStore(`pr_${newer}`)
    yield* Effect.promise(() => fs.rm(olderStore, { recursive: true, force: true }))
    yield* Effect.promise(() => fs.rm(newerStore, { recursive: true, force: true }))
    const facts = hostFacts(older)
    expect(yield* ReviewPRFactsV2.read(newerStore, newer)).toBeUndefined()
    yield* ReviewPRFactsV2.write(olderStore, facts)
    const retained = yield* ReviewPRFactsV2.read(olderStore, older)
    expect(retained).toEqual(facts)
    expect(retained && "verdict" in retained).toBe(false)
    expect(yield* ReviewPRFactsV2.read(newerStore, newer)).toBeUndefined()
    expect(yield* ReviewPRFactsV2.read(newerStore, newer)).not.toEqual(retained)
    const target = ReviewPRFactsV2.file(olderStore, older)
    yield* Effect.promise(() => Bun.write(target, "{"))
    expect((yield* Effect.flip(ReviewPRFactsV2.read(olderStore, older))).message).toContain("pr-facts-corrupt")
    expect((yield* Effect.flip(ReviewPRFactsV2.write(olderStore, facts))).message).toContain("pr-facts-corrupt")
    yield* Effect.promise(() => fs.rm(olderStore, { recursive: true, force: true }))
    yield* ReviewPRFactsV2.write(olderStore, facts)
    yield* ReviewPRFactsV2.write(olderStore, hostFacts(older))
    const conflicting = hostFacts(older)
    expect((yield* Effect.flip(ReviewPRFactsV2.write(olderStore, {
      ...conflicting, confirmed: [{ ...conflicting.confirmed[0], id: "C9" }],
    }))).message).toContain("pr-facts-conflict")
    expect(yield* ReviewPRFactsV2.read(olderStore, older)).toEqual(facts)
  }).pipe(Effect.ensuring(Effect.promise(async () => {
    await fs.rm(MaestroReviewTools.analysisStore(`pr_${"c".repeat(64)}`), { recursive: true, force: true })
    await fs.rm(MaestroReviewTools.analysisStore(`pr_${"d".repeat(64)}`), { recursive: true, force: true })
  })))))
