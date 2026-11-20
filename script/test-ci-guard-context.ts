// Approval is GitHub state, never a .ci-run.json capability. This reader is read-only
// and grants only the original protected-paths rule for one unchanged source PR.
const repositoryName = "gustavomhss/Orchestra-SF"
const baseRef = "sf-join-four"
const approvalLabels = ["guardrail-approved", "guardrail-approved:protected-paths"]
const shaPattern = /^[a-f0-9]{40}$/

type ReadGitHub = (path: string) => Promise<unknown>
type Actor = { id: number; login: string; type: string }
type Repository = { id: number; fullName: string; owner: Actor }
type PullRequest = {
  number: number; author: Actor; headRef: string; headSha: string; baseSha: string; labels: string[]
}
type Approval = { eventId: number; actor: Actor; label: string }
export type GuardContextInput = {
  repository?: string; eventName?: string; refName?: string; snapshot?: string; requestBlob?: string
  request: { package: string; directory?: string; runner: string }
}
export type GuardContext = {
  schema: "test-ci-guard-context-v1"; repository: string; snapshot: string
  approved: "" | "protected-paths"; status: "unapproved" | "approved"; reason: string
  source?: string; pullRequest?: number; headRef?: string; baseRef?: string; baseSha?: string
  approval?: { eventId: number; label: string; actor: string; actorId: number }
}

class Refusal extends Error {}

function requireValue(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Refusal(reason)
}

function object(value: unknown): Record<string, unknown> {
  requireValue(value !== null && typeof value === "object" && !Array.isArray(value), "github-shape-invalid")
  return value as Record<string, unknown>
}

function actor(value: unknown): Actor {
  const user = object(value)
  requireValue(Number.isSafeInteger(user.id) && Number(user.id) > 0 &&
    typeof user.login === "string" && /^[A-Za-z0-9][A-Za-z0-9-]*$/.test(user.login) &&
    typeof user.type === "string", "github-actor-invalid")
  return { id: Number(user.id), login: user.login, type: user.type }
}

function repository(value: unknown): Repository {
  const repo = object(value)
  requireValue(Number.isSafeInteger(repo.id) && Number(repo.id) > 0 &&
    repo.full_name === repositoryName, "repository-mismatch")
  const owner = actor(repo.owner)
  requireValue(owner.login === repositoryName.split("/")[0], "repository-owner-mismatch")
  return { id: Number(repo.id), fullName: repositoryName, owner }
}

function sameRepository(value: unknown, repo: Repository) {
  const candidate = object(value)
  return candidate.id === repo.id && candidate.full_name === repo.fullName
}

function pullRequest(value: unknown, repo: Repository, source: string): PullRequest {
  const pr = object(value), head = object(pr.head), base = object(pr.base)
  requireValue(pr.state === "open" && pr.draft === false && pr.merged === false &&
    pr.merged_at === null && pr.closed_at === null, "source-pr-not-open-ready")
  requireValue(Number.isSafeInteger(pr.number) && Number(pr.number) > 0 &&
    sameRepository(head.repo, repo) && sameRepository(base.repo, repo), "source-pr-repository-mismatch")
  requireValue(head.sha === source && typeof head.ref === "string" &&
    /^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(head.ref) && !head.ref.includes("..") &&
    !head.ref.startsWith("ci-run-") && head.ref !== baseRef, "source-head-mismatch")
  requireValue(base.ref === baseRef && typeof base.sha === "string" && shaPattern.test(base.sha),
    "source-base-mismatch")
  requireValue(Array.isArray(pr.labels), "source-labels-invalid")
  const labels = pr.labels.map((item) => object(item).name)
  requireValue(labels.every((label): label is string => typeof label === "string"), "source-labels-invalid")
  return { number: Number(pr.number), author: actor(pr.user), headRef: head.ref,
    headSha: source, baseSha: base.sha, labels: labels.filter((label) => approvalLabels.includes(label)).sort() }
}

// Never accept a truncated collection as proof that a label was not revoked.
async function list(read: ReadGitHub, path: string) {
  const items: unknown[] = []
  for (let page = 1; page <= 10; page++) {
    const response = await read(path + "?per_page=100&page=" + page)
    requireValue(Array.isArray(response) && response.length <= 100, "github-page-invalid")
    items.push(...response)
    if (response.length < 100) return items
  }
  throw new Refusal("github-pagination-incomplete")
}

function latestApproval(events: unknown[], labels: string[]): Approval {
  const current = labels.flatMap((label) => {
    const matching = events.map(object).filter((event) =>
      (event.event === "labeled" || event.event === "unlabeled") && object(event.label).name === label)
    requireValue(matching.every((event) => Number.isSafeInteger(event.id) && Number(event.id) > 0),
      "approval-event-invalid")
    const latest = matching.sort((a, b) => Number(b.id) - Number(a.id))[0]
    if (!latest || latest.event !== "labeled") return []
    return [{ eventId: Number(latest.id), actor: actor(latest.actor), label }]
  })
  requireValue(current.length > 0, "approval-label-event-missing")
  return current.sort((a, b) => b.eventId - a.eventId)[0]!
}

async function verifyRefs(read: ReadGitHub, prefix: string, pr: PullRequest) {
  const refs: [string, string][] = [[pr.headRef, pr.headSha], [baseRef, pr.baseSha]]
  for (const [name, expected] of refs) {
    const ref = object(await read(prefix + "/git/ref/heads/" + encodeURIComponent(name)))
    const target = object(ref.object)
    requireValue(ref.ref === "refs/heads/" + name && target.type === "commit" && target.sha === expected,
      "source-ref-moved")
  }
}

async function verifyApprover(read: ReadGitHub, prefix: string, repo: Repository, pr: PullRequest, approval: Approval) {
  const person = approval.actor
  requireValue(person.type === "User", "approval-actor-not-human")
  const permission = object(await read(prefix + "/collaborators/" + encodeURIComponent(person.login) + "/permission"))
  const current = actor(permission.user)
  requireValue(current.id === person.id && current.login === person.login && current.type === "User" &&
    ["admin", "maintain", "write"].includes(String(permission.permission)), "approval-actor-not-authorized")
  const isOwner = repo.owner.type === "User" && repo.owner.id === person.id && repo.owner.login === person.login
  requireValue(isOwner || person.id !== pr.author.id, "approval-author-not-independent")
}

export async function resolveGuardContext(input: GuardContextInput, read: ReadGitHub): Promise<GuardContext> {
  const result: GuardContext = { schema: "test-ci-guard-context-v1", repository: repositoryName,
    snapshot: input.snapshot ?? "", approved: "", status: "unapproved", reason: "not-applicable" }
  try {
    requireValue(input.repository === repositoryName && input.eventName === "push" &&
      typeof input.refName === "string" && /^ci-run-linux-(?!arm64-)[A-Za-z0-9-]+$/.test(input.refName),
      "event-context-mismatch")
    requireValue(input.request.package === "sucafina" && input.request.directory === "modules/sucafina" &&
      input.request.runner === "bun", "package-not-applicable")
    requireValue(typeof input.snapshot === "string" && shaPattern.test(input.snapshot) &&
      typeof input.requestBlob === "string" && shaPattern.test(input.requestBlob), "snapshot-identity-invalid")
    const prefix = "repos/" + repositoryName
    const repo = repository(await read(prefix))
    const snapshot = object(await read(prefix + "/git/commits/" + input.snapshot))
    requireValue(snapshot.sha === input.snapshot && Array.isArray(snapshot.parents) && snapshot.parents.length === 1,
      "snapshot-parent-invalid")
    const source = object(snapshot.parents[0]).sha
    requireValue(typeof source === "string" && shaPattern.test(source), "snapshot-parent-invalid")
    const diff = object(await read(prefix + "/compare/" + source + "..." + input.snapshot))
    requireValue(diff.status === "ahead" && diff.ahead_by === 1 && diff.behind_by === 0 && diff.total_commits === 1 &&
      object(diff.base_commit).sha === source && object(diff.merge_base_commit).sha === source &&
      Array.isArray(diff.commits) && diff.commits.length === 1 && object(diff.commits[0]).sha === input.snapshot,
      "snapshot-range-invalid")
    requireValue(Array.isArray(diff.files) && diff.files.length === 1, "snapshot-has-code-changes")
    const file = object(diff.files[0])
    requireValue(file.filename === ".ci-run.json" && file.previous_filename === undefined &&
      (file.status === "added" || file.status === "modified") && file.sha === input.requestBlob,
      "snapshot-request-mismatch")
    const candidates = (await list(read, prefix + "/commits/" + source + "/pulls")).map(object).filter((pr) =>
      object(pr.head).sha === source && object(pr.base).ref === baseRef &&
      sameRepository(object(pr.head).repo, repo) && sameRepository(object(pr.base).repo, repo))
    requireValue(candidates.length === 1, "source-pr-not-unique")
    const number = candidates[0]!.number
    requireValue(Number.isSafeInteger(number) && Number(number) > 0, "source-pr-number-invalid")
    const prPath = prefix + "/pulls/" + number
    const pr = pullRequest(await read(prPath), repo, source)
    requireValue(pr.number === number, "source-pr-number-mismatch")
    await verifyRefs(read, prefix, pr)
    const eventsPath = prefix + "/issues/" + pr.number + "/events"
    const approval = latestApproval(await list(read, eventsPath), pr.labels)
    await verifyApprover(read, prefix, repo, pr, approval)

    // Re-read mutable authority. Commit times are not evidence of fresh approval:
    // this retains the existing policy of a current label on the current source PR.
    const finalPr = pullRequest(await read(prPath), repo, source)
    requireValue(JSON.stringify(finalPr) === JSON.stringify(pr), "source-pr-changed")
    await verifyRefs(read, prefix, finalPr)
    const finalApproval = latestApproval(await list(read, eventsPath), finalPr.labels)
    requireValue(JSON.stringify(finalApproval) === JSON.stringify(approval), "approval-event-changed")
    await verifyApprover(read, prefix, repo, finalPr, finalApproval)
    return { ...result, approved: "protected-paths", status: "approved", reason: "source-pr-label-verified",
      source, pullRequest: pr.number, headRef: pr.headRef, baseRef, baseSha: pr.baseSha,
      approval: { eventId: approval.eventId, label: approval.label, actor: approval.actor.login, actorId: approval.actor.id } }
  } catch (error) {
    return { ...result, reason: error instanceof Refusal ? error.message : "github-api-unavailable" }
  }
}

// No URL supplied by a PR/request, redirects, write method, or elevated token.
// Permission and API failures leave the approval empty and the guards enforced.
export function githubGuardReader(token: string, fetcher: (url: string, init: RequestInit) => Promise<Response> = fetch): ReadGitHub {
  return async (path) => {
    requireValue(token.length > 0 && (path === "repos/" + repositoryName || path.startsWith("repos/" + repositoryName + "/")) &&
      !/[\\\x00-\x20#]/.test(path) && !path.split(/[/?]/).some((part) => part === "." || part === ".."),
      "github-api-unavailable")
    const response = await fetcher("https://api.github.com/" + path, {
      method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + token,
        "X-GitHub-Api-Version": "2022-11-28" },
    })
    requireValue(response.status === 200, "github-api-unavailable")
    return response.json()
  }
}
