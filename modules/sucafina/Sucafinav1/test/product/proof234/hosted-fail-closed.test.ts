import { expect, test } from "bun:test"
import { inspectHostedAm04, inspectHostedAm05 } from "./hosted-driver.ts"
import type { CandidatePin234 } from "./hosted-driver.ts"

/**
 * Negative-only control: a source commit, fixture, empty JSON and malformed
 * workflow tuple never become native AM04/AM05 evidence. No fake host/model,
 * scanner or Task result is created in this test.
 */
test("proof234 AM04/AM05 reject absent accepted C before reading a purported witness", () => {
  expect(inspectHostedAm04(undefined)).toMatchObject({
    state: "NOT_RUN", artifactRef: null,
  })
  expect(inspectHostedAm05(undefined)).toMatchObject({
    state: "NOT_RUN", artifactRef: null,
  })
})

test("proof234 AM04/AM05 reject a malformed CI authority tuple without any positive inference", () => {
  const invalid = {
    candidateSha: "", treeSha: "", workflowRunId: "", jobId: "",
    attempt: 0, artifactSha256: "", selectors: [],
  } satisfies CandidatePin234
  expect(inspectHostedAm04({}, invalid)).toMatchObject({
    state: "REJECTED", artifactRef: null,
  })
  expect(inspectHostedAm05({}, invalid)).toMatchObject({
    state: "REJECTED", artifactRef: null,
  })
})
