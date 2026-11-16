import { expect, test } from "bun:test"
import { correlateAm03, type Am03HostedCandidate } from "../../../../../../script/sf2h/proofs/am03/correlation.ts"

// Negative-only evidence admission checks. All hex fields are intentionally
// non-evidential placeholders; no provider, user, run or PASS is simulated.
// These tests will stay RED against the known preimage of the complete inert
// patch until the legitimate product writer applies it.
const negativeOnly: Am03HostedCandidate = {
  productCandidateSha: "0".repeat(40), productTreeSha: "0".repeat(40),
  ciSnapshotSha: "0".repeat(40), ciRunId: 1,
  ciRunUrl: "https://github.com/gustavomhss/Orchestra-SF/actions/runs/10",
  observations: [],
}

test("233: a run-ID prefix cannot attest a different Actions run", () => {
  const actual = correlateAm03(negativeOnly)
  expect(actual.status).toBe("NOT_RUN")
  expect(actual.gaps).toContain("hosted-candidate-provenance")
  expect(actual.structurallyCorrelatable).toBe(false)
})

test("233: unknown or malformed scenario objects fail closed without a positive observation", () => {
  const input = { ...negativeOnly, ciRunUrl: "https://github.com/gustavomhss/Orchestra-SF/actions/runs/1",
    observations: [{ scenario: "not-a-canonical-AM03-scenario" }] } as unknown as Am03HostedCandidate
  const result = correlateAm03(input)
  expect(result.status).toBe("NOT_RUN")
  expect(result.structurallyCorrelatable).toBe(false)
  expect(result.gaps).toContain("unknown-or-malformed-scenario")
})
