/** The PR's default GITHUB_SHA is a synthetic merge commit, NOT the branch source. */
export type SfFactoryRunIdentity = {
  sourceSHA: string
  checkoutSHA: string
  expectedSourceSHA: string
  workflowSHA: string
  eventName: "push" | "pull_request"
  runID: string
  runAttempt: string
}

const sha40 = (value: string) => /^[a-f0-9]{40}$/.test(value)
const positive = (value: string) => /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value))

/**
 * Receipt gate, called immediately before writing ANY success receipt.
 *
 * - sourceSHA = actual checked-out branch commit, never github.sha on a PR;
 * - expectedSourceSHA = github.event.pull_request.head.sha (PR) or github.sha (push);
 * - workflowSHA = github.sha, which denotes refs/pull/*/merge on PR.
 *
 * These are distinct provenances and must never be conflated.
 */
export function requireSfFactoryRunIdentity(value: SfFactoryRunIdentity) {
  if (!sha40(value.sourceSHA) || !sha40(value.checkoutSHA) || !sha40(value.expectedSourceSHA) ||
    !sha40(value.workflowSHA) || !positive(value.runID) || !positive(value.runAttempt) ||
    (value.eventName !== "push" && value.eventName !== "pull_request"))
    throw new Error("SF_FACTORY_RUN_IDENTITY_INVALID")
  if (value.sourceSHA !== value.checkoutSHA || value.sourceSHA !== value.expectedSourceSHA)
    throw new Error("SF_FACTORY_SOURCE_SHA_MISMATCH")
  // On push github.sha *is* the branch commit. On PR it is a synthetic
  // merge commit, so requiring equality to sourceSHA would be a false gate.
  if (value.eventName === "push" && value.workflowSHA !== value.sourceSHA)
    throw new Error("SF_FACTORY_PUSH_WORKFLOW_SHA_MISMATCH")
  return Object.freeze({ ...value })
}
