import { readFileSync } from "node:fs"

const fail = (reason) => { throw new Error("SF_CANDIDATE_IDENTITY_INVALID: " + reason) }
const commit = (value) => typeof value === "string" && /^[a-f0-9]{40}$/.test(value)

/** Product checkout identity is separate from GitHub's synthetic PR workflow SHA. */
export function candidateSource(env = process.env, suppliedEvent) {
  if (!commit(env.GITHUB_SHA) || !commit(env.SF_PRODUCT_SOURCE_SHA)) fail("missing workflow or declared product SHA")
  let expected
  if (env.GITHUB_EVENT_NAME === "pull_request") {
    let event = suppliedEvent
    if (event === undefined) {
      if (!env.GITHUB_EVENT_PATH) fail("missing actual pull request event")
      try { event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")) }
      catch { fail("unreadable pull request event") }
    }
    expected = event?.pull_request?.head?.sha
    if (!commit(expected)) fail("missing immutable pull request head")
  } else if (env.GITHUB_EVENT_NAME === "push" || env.GITHUB_EVENT_NAME === "workflow_dispatch") {
    expected = env.GITHUB_SHA
  } else fail("unsupported workflow event")
  if (env.SF_PRODUCT_SOURCE_SHA !== expected) fail("declared product source differs from actual event")
  return expected
}
