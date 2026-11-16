import { expect, test } from "bun:test"
import { inspectProof233Hosted, type HostedInput233 } from "./hosted-driver.ts"

// Absent and invalid bytes are NEGATIVE evidence-intake cases, never a mock
// model, business principal, successful native response or positive fixture.
const absent: HostedInput233 = {
  schema: "sf2h.proof233.hosted-input.v1",
  productCandidateSha: "", productTreeSha: "", sucafinaSubtreeSha: "",
  runs: [], am02Witnesses: [], am03Candidate: null,
}

test("233: shipped catalogue and an empty run envelope cannot become AM01/AM02/AM03 PASS", async () => {
  const result = await inspectProof233Hosted(absent)
  expect(result.status).toBe("NOT_RUN")
  expect(result.hosted.gaps).toContain("candidate-C-tree-or-product-subtree-not-observed")
  expect(result.hosted.gaps).toContain("no-original-GitHub-Actions-runs")
  expect(result.hosted.gaps).toContain("AM01-native-selector-coverage-incomplete")
  expect(result.AM01.status).toBe("NOT_RUN")
  expect(result.AM01.missingSelectors.length).toBeGreaterThan(0)
  expect(result.AM02.status).toBe("NOT_RUN")
  expect(result.AM02.structuralQualification).toBe("NOT_RUN")
  expect(result.AM03.status).toBe("NOT_RUN")
  expect(result.AM03.sourceToRunCorrelation).toBeNull()
  expect(result.GLOBAL_RELEASE).toBe(false)
})

test("233: malformed or unverified Actions URL and empty log cannot be treated as original run", async () => {
  const result = await inspectProof233Hosted({ ...absent, runs: [{
    id: 0, url: "", headSha: "", candidateSha: "", sucafinaSubtreeSha: "",
    ciRequestSha256: "", conclusion: "success", selectedFiles: [], log: "",
  }] })
  expect(result.status).toBe("NOT_RUN")
  expect(result.hosted.runs[0]?.shapeAdmitted).toBe(false)
  expect(result.hosted.gaps).toContain("hosted-run-fields-or-provenance-invalid:0")
  expect(result.AM01.missingSelectors.length).toBeGreaterThan(0)
  expect(result.AM02.structuralQualification).toBe("NOT_RUN")
})
