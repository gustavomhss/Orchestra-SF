import { spawnSync } from "node:child_process"

const REPO = "gustavomhss/Orchestra-SF"
const [OWNER, NAME] = REPO.split("/")
const SHA_RE = /^[0-9a-f]{40}$/i

const QUERY = `
query QueueFreeze($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(states: OPEN, first: 100, after: $after, orderBy: {field: CREATED_AT, direction: ASC}) {
      nodes {
        number
        headRefOid
        headRefName
        baseRefName
        isDraft
        labels(first: 100) {
          nodes { name }
          pageInfo { hasNextPage }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}`

export function ghJson(args, input) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    input,
    maxBuffer: 32 * 1024 * 1024,
    timeout: 60_000,
  })
  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? result.stderr?.trim() ?? `exit ${result.status}`
    throw new Error(`GH_FAILED: ${detail}`)
  }
  try {
    return JSON.parse(result.stdout)
  } catch {
    throw new Error("GH_INVALID_JSON: GitHub CLI did not return a JSON response")
  }
}

export function validatePrs(prs, source) {
  if (!Array.isArray(prs)) throw new Error(`INVALID_QUEUE: ${source} is not an array`)
  const seen = new Set()
  for (const pr of prs) {
    if (!pr || !Number.isSafeInteger(pr.number) || pr.number <= 0) {
      throw new Error(`INVALID_QUEUE: ${source} has a missing/invalid PR number`)
    }
    if (seen.has(pr.number)) throw new Error(`DUPLICATE_PR: ${source} #${pr.number}`)
    seen.add(pr.number)
    if (typeof pr.headRefOid !== "string" || !SHA_RE.test(pr.headRefOid)) {
      throw new Error(`INVALID_HEAD_SHA: ${source} #${pr.number}`)
    }
    if (typeof pr.headRefName !== "string" || !pr.headRefName ||
        typeof pr.baseRefName !== "string" || !pr.baseRefName ||
        typeof pr.isDraft !== "boolean") {
      throw new Error(`INVALID_PR_FIELDS: ${source} #${pr.number}`)
    }
    if (!Array.isArray(pr.labels) || pr.labels.some(label => typeof label !== "string" || !label)) {
      throw new Error(`INVALID_LABELS: ${source} #${pr.number}`)
    }
    if (new Set(pr.labels).size !== pr.labels.length) {
      throw new Error(`DUPLICATE_LABELS: ${source} #${pr.number}`)
    }
  }
  return prs
}

export function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot.capturedAt !== "string" ||
      !Number.isFinite(Date.parse(snapshot.capturedAt))) {
    throw new Error("INVALID_SNAPSHOT: missing/invalid capturedAt")
  }
  validatePrs(snapshot.prs, "snapshot")
  if (snapshot.prs.some((pr, i) => i > 0 && snapshot.prs[i - 1].number >= pr.number)) {
    throw new Error("INVALID_SNAPSHOT: prs must be sorted by number")
  }
  return snapshot
}

function normalizeNode(node) {
  if (node?.labels?.pageInfo?.hasNextPage !== false || !Array.isArray(node.labels.nodes)) {
    throw new Error(`LABELS_TRUNCATED: PR #${node?.number ?? "?"}`)
  }
  return {
    number: node.number,
    headRefOid: node.headRefOid,
    headRefName: node.headRefName,
    baseRefName: node.baseRefName,
    isDraft: node.isDraft,
    labels: node.labels.nodes.map(label => label.name).sort(),
  }
}

export function fetchOpenPrs() {
  const prs = []
  let cursor = null
  const visited = new Set()
  while (true) {
    const args = ["api", "graphql", "-f", `query=${QUERY}`, "-f", `owner=${OWNER}`, "-f", `name=${NAME}`]
    if (cursor !== null) args.push("-f", `after=${cursor}`)
    const response = ghJson(args)
    if (response.errors?.length) {
      throw new Error(`GRAPHQL_ERROR: ${JSON.stringify(response.errors)}`)
    }
    const page = response.data?.repository?.pullRequests
    if (!page || !Array.isArray(page.nodes) || !page.pageInfo) {
      throw new Error("INCOMPLETE_QUEUE_RESPONSE: missing PR page")
    }
    prs.push(...page.nodes.map(normalizeNode))
    if (!page.pageInfo.hasNextPage) break
    const next = page.pageInfo.endCursor
    if (typeof next !== "string" || !next || visited.has(next)) {
      throw new Error("INVALID_QUEUE_CURSOR: pagination cannot continue safely")
    }
    visited.add(next)
    cursor = next
  }
  prs.sort((a, b) => a.number - b.number)
  return validatePrs(prs, "live queue")
}

export function fetchStableOpenPrs() {
  const first = fetchOpenPrs()
  const second = fetchOpenPrs()
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    throw new Error("QUEUE_CHANGED_DURING_CAPTURE: repeat the capture when the queue is stable")
  }
  return second
}

export function diffQueues(frozenPrs, livePrs) {
  validatePrs(frozenPrs, "frozen queue")
  validatePrs(livePrs, "live queue")
  const frozen = new Map(frozenPrs.map(pr => [pr.number, pr]))
  const live = new Map(livePrs.map(pr => [pr.number, pr]))
  const newPrs = []
  const closedPrs = []
  const movedPrs = []
  const unchangedPrs = []

  for (const pr of livePrs) {
    const before = frozen.get(pr.number)
    if (!before) newPrs.push(pr)
    else if (before.headRefOid !== pr.headRefOid) {
      movedPrs.push({ number: pr.number, headRefName: pr.headRefName,
        from: before.headRefOid, to: pr.headRefOid })
    } else unchangedPrs.push(pr)
  }
  for (const pr of frozenPrs) {
    if (!live.has(pr.number)) closedPrs.push(pr)
  }
  for (const group of [newPrs, closedPrs, movedPrs, unchangedPrs]) {
    group.sort((a, b) => a.number - b.number)
  }
  return { newPrs, closedPrs, movedPrs, unchangedPrs }
}

export function hasDrift(result) {
  return result.newPrs.length > 0 || result.closedPrs.length > 0 || result.movedPrs.length > 0
}

export function driftLines(result) {
  return [
    ...result.newPrs.map(pr => `NEW_PR #${pr.number} ${pr.headRefOid} (${pr.headRefName})`),
    ...result.closedPrs.map(pr => `CLOSED_PR #${pr.number} ${pr.headRefOid} (${pr.headRefName})`),
    ...result.movedPrs.map(pr => `HEAD_MOVED #${pr.number} ${pr.from} -> ${pr.to} (${pr.headRefName})`),
  ]
}

export { REPO }
