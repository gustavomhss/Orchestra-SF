import { YAML } from "bun"
import { expect, test } from "bun:test"
import { githubGuardReader, resolveGuardContext, type GuardContextInput } from "../../../script/test-ci-guard-context"
import { parseOptions, validateRequest } from "../../../script/test-ci-request"

const repoName = "gustavomhss/Orchestra-SF"
const prefix = "repos/" + repoName
const source = "a".repeat(40), base = "b".repeat(40), snapshot = "c".repeat(40), blob = "d".repeat(40)
const request = { package: "sucafina", directory: "modules/sucafina", runner: "bun" }
const input: GuardContextInput = { repository: repoName, eventName: "push", refName: "ci-run-linux-guard-proof",
  snapshot, requestBlob: blob, request }
const owner = { id: 8, login: "gustavomhss", type: "User" }
const author = { id: 9, login: "pr-author", type: "User" }
const reviewer = { id: 10, login: "reviewer", type: "User" }

// Synthetic API records exercise the actual admission function. They never
// write GITHUB_ENV, label a PR, or claim a real repository approval.
function fixture() {
  const repo = { id: 101, full_name: repoName, owner }
  const pr = { number: 731, state: "open", draft: false, merged: false, merged_at: null, closed_at: null,
    user: author, head: { sha: source, ref: "sf-source", repo: structuredClone(repo) },
    base: { sha: base, ref: "sf-join-four", repo: structuredClone(repo) },
    labels: [{ name: "guardrail-approved" }, { name: "guardrail-approved:another-rule" }] }
  const event = { id: 51, event: "labeled", actor: owner, label: { name: "guardrail-approved" } }
  const diff = { status: "ahead", ahead_by: 1, behind_by: 0, total_commits: 1,
    base_commit: { sha: source }, merge_base_commit: { sha: source }, commits: [{ sha: snapshot }],
    files: [{ filename: ".ci-run.json", status: "added", sha: blob }] }
  const paths = {
    repo: prefix, commit: prefix + "/git/commits/" + snapshot,
    diff: prefix + "/compare/" + source + "..." + snapshot,
    candidates: prefix + "/commits/" + source + "/pulls?per_page=100&page=1",
    pr: prefix + "/pulls/731", events: prefix + "/issues/731/events?per_page=100&page=1",
    permission: prefix + "/collaborators/" + owner.login + "/permission",
    head: prefix + "/git/ref/heads/sf-source", base: prefix + "/git/ref/heads/sf-join-four",
  }
  const responses = new Map<string, unknown>([
    [paths.repo, repo], [paths.commit, { sha: snapshot, parents: [{ sha: source }] }],
    [paths.diff, diff], [paths.candidates, [pr]], [paths.pr, pr], [paths.events, [event]],
    [paths.permission, { permission: "admin", user: owner }],
    [paths.head, { ref: "refs/heads/sf-source", object: { type: "commit", sha: source } }],
    [paths.base, { ref: "refs/heads/sf-join-four", object: { type: "commit", sha: base } }],
  ])
  const calls: string[] = []
  const counts = new Map<string, number>()
  let change: ((path: string, count: number, value: unknown) => unknown) | undefined
  return {
    repo, pr, event, diff, paths, responses, calls,
    change(fn: NonNullable<typeof change>) { change = fn },
    async read(path: string) {
      calls.push(path)
      const count = (counts.get(path) ?? 0) + 1
      counts.set(path, count)
      if (!responses.has(path)) throw new Error("unavailable API fixture route")
      const value = structuredClone(responses.get(path))
      return change ? change(path, count, value) : value
    },
  }
}

async function refused(f: ReturnType<typeof fixture>, reason: string, context: GuardContextInput = input) {
  const result = await resolveGuardContext(context, f.read)
  expect(result).toMatchObject({ approved: "", status: "unapproved", reason })
  expect(result.approval).toBeUndefined()
  expect(result.baseSha).toBeUndefined()
  return result
}

test("only the exact unchanged source PR receives its current owner approval", async () => {
  const f = fixture()
  const result = await resolveGuardContext(input, f.read)
  expect(result).toEqual({ schema: "test-ci-guard-context-v1", repository: repoName, snapshot,
    approved: "protected-paths", status: "approved", reason: "source-pr-label-verified",
    source, pullRequest: 731, headRef: "sf-source", baseRef: "sf-join-four", baseSha: base,
    approval: { eventId: 51, label: "guardrail-approved", actor: owner.login, actorId: owner.id } })
  for (const path of [f.paths.pr, f.paths.events, f.paths.head, f.paths.base, f.paths.permission])
    expect(f.calls.filter((value) => value === path)).toHaveLength(2)
  expect(JSON.stringify(result)).not.toContain("another-rule")
})

test("an independent writer and an owner who authored the PR are both eligible", async () => {
  for (const person of [reviewer, owner]) {
    const f = fixture()
    f.responses.set(f.paths.events, [{ ...f.event, actor: person, label: { name: "guardrail-approved:protected-paths" } }])
    f.responses.set(f.paths.pr, { ...f.pr, user: person === owner ? owner : author,
      labels: [{ name: "guardrail-approved:protected-paths" }] })
    f.responses.set(prefix + "/collaborators/" + person.login + "/permission", { permission: "write", user: person })
    expect((await resolveGuardContext(input, f.read)).approved).toBe("protected-paths")
  }
})

for (const patch of [
  { repository: "other/Orchestra-SF" }, { eventName: "pull_request" }, { refName: "ci-run-sfc-7" },
  { refName: "ci-run-linux-arm64-sample" },
]) test("event identity refuses " + JSON.stringify(patch), async () => {
  const f = fixture()
  await refused(f, "event-context-mismatch", { ...input, ...patch })
  expect(f.calls).toEqual([])
})

for (const patch of [{ package: "core" }, { directory: "packages/sucafina" }, { runner: "node" }])
  test("package identity refuses " + JSON.stringify(patch), async () => {
    const f = fixture()
    await refused(f, "package-not-applicable", { ...input, request: { ...request, ...patch } })
    expect(f.calls).toEqual([])
  })

test("request environment cannot grant approval, change the base, or provide API credentials", () => {
  for (const key of ["GUARDRAIL_APPROVED", "GUARDRAIL_BASE_REF", "GITHUB_TOKEN", "GH_READ_TOKEN"]) {
    expect(() => parseOptions(["sucafina", "--env", key + "=protected-paths"])).toThrow("KEY one of")
    expect(() => validateRequest({ ...request, args: [], env: { [key]: "protected-paths" } },
      (path) => path === "modules/sucafina/package.json",
      () => ({ package: "sucafina", directory: "modules/sucafina" }))).toThrow("KEY one of")
  }
})

test("a snapshot has exactly one parent and exactly the committed request blob", async () => {
  const extraParent = fixture()
  extraParent.responses.set(extraParent.paths.commit, { sha: snapshot, parents: [{ sha: source }, { sha: base }] })
  await refused(extraParent, "snapshot-parent-invalid")
  const extraCommit = fixture()
  extraCommit.responses.set(extraCommit.paths.diff, { ...extraCommit.diff, total_commits: 2 })
  await refused(extraCommit, "snapshot-range-invalid")
  for (const changed of [
    { filename: "modules/sucafina/Sucafinav1/test/extra.test.ts", status: "added", sha: blob },
    { filename: "godfile-waivers.json", status: "modified", sha: blob },
    { filename: ".github/workflows/test-ci.yml", status: "modified", sha: blob },
  ]) {
    const f = fixture()
    f.responses.set(f.paths.diff, { ...f.diff, files: [...f.diff.files, changed] })
    await refused(f, "snapshot-has-code-changes")
  }
  for (const patch of [
    { sha: base }, { filename: "request.json" }, { status: "removed" },
    { previous_filename: "other-request.json", status: "renamed" },
  ]) {
    const f = fixture()
    f.responses.set(f.paths.diff, { ...f.diff, files: [{ ...f.diff.files[0], ...patch }] })
    await refused(f, "snapshot-request-mismatch")
  }
})

test("the source PR is unique, open, ready, unmerged and owned by this repository", async () => {
  for (const patch of [{ state: "closed" }, { draft: true }, { merged: true }, { closed_at: "2026-11-20" }]) {
    const f = fixture()
    f.responses.set(f.paths.pr, { ...f.pr, ...patch })
    await refused(f, "source-pr-not-open-ready")
  }
  const duplicate = fixture()
  duplicate.responses.set(duplicate.paths.candidates, [duplicate.pr, { ...duplicate.pr, number: 732 }])
  await refused(duplicate, "source-pr-not-unique")
  const absent = fixture()
  absent.responses.set(absent.paths.candidates, [])
  await refused(absent, "source-pr-not-unique")
  const fork = fixture()
  fork.responses.set(fork.paths.pr, { ...fork.pr, head: { ...fork.pr.head, repo: { ...fork.repo, id: 102 } } })
  await refused(fork, "source-pr-repository-mismatch")
  const oldHead = fixture()
  oldHead.responses.set(oldHead.paths.pr, { ...oldHead.pr, head: { ...oldHead.pr.head, sha: base } })
  await refused(oldHead, "source-head-mismatch")
  const wrongBase = fixture()
  wrongBase.responses.set(wrongBase.paths.pr, { ...wrongBase.pr, base: { ...wrongBase.pr.base, ref: "dev" } })
  await refused(wrongBase, "source-base-mismatch")
})

test("both live refs must still identify the PR head and base commits", async () => {
  for (const which of ["head", "base"] as const) {
    const f = fixture()
    f.responses.set(f.paths[which], { ref: which === "head" ? "refs/heads/sf-source" : "refs/heads/sf-join-four",
      object: { type: "commit", sha: snapshot } })
    await refused(f, "source-ref-moved")
  }
})

test("a current label needs its latest real labeled event and grants no other rules", async () => {
  const missing = fixture()
  missing.responses.set(missing.paths.events, [])
  await refused(missing, "approval-label-event-missing")
  const other = fixture()
  other.responses.set(other.paths.pr, { ...other.pr, labels: [{ name: "guardrail-approved:other-rule" }] })
  await refused(other, "approval-label-event-missing")
  const removed = fixture()
  removed.responses.set(removed.paths.events, [removed.event, { ...removed.event, id: 52, event: "unlabeled" }])
  await refused(removed, "approval-label-event-missing")
  const relabeled = fixture()
  relabeled.responses.set(relabeled.paths.events, [relabeled.event, { ...relabeled.event, id: 52, actor: reviewer }])
  relabeled.responses.set(prefix + "/collaborators/reviewer/permission", { permission: "read", user: reviewer })
  await refused(relabeled, "approval-actor-not-authorized")
})

test("bots, non-writers, changed identities and non-owner self-approval are refused", async () => {
  const bot = fixture()
  bot.responses.set(bot.paths.events, [{ ...bot.event, actor: { ...owner, type: "Bot" } }])
  await refused(bot, "approval-actor-not-human")
  for (const permission of ["read", "triage", "none"]) {
    const f = fixture()
    f.responses.set(f.paths.permission, { permission, user: owner })
    await refused(f, "approval-actor-not-authorized")
  }
  const changedIdentity = fixture()
  changedIdentity.responses.set(changedIdentity.paths.permission, { permission: "admin", user: { ...owner, id: 99 } })
  await refused(changedIdentity, "approval-actor-not-authorized")
  const self = fixture()
  self.responses.set(self.paths.events, [{ ...self.event, actor: author }])
  self.responses.set(prefix + "/collaborators/" + author.login + "/permission", { permission: "write", user: author })
  await refused(self, "approval-author-not-independent")
})

test("mutable PR, labels, refs and permissions are checked again before transmission", async () => {
  const cases = [
    { key: "pr", value: (f: ReturnType<typeof fixture>) => ({ ...f.pr, draft: true }), reason: "source-pr-not-open-ready" },
    { key: "pr", value: (f: ReturnType<typeof fixture>) => ({ ...f.pr, labels: [] }), reason: "source-pr-changed" },
    { key: "head", value: () => ({ ref: "refs/heads/sf-source", object: { type: "commit", sha: snapshot } }), reason: "source-ref-moved" },
    { key: "base", value: () => ({ ref: "refs/heads/sf-join-four", object: { type: "commit", sha: source } }), reason: "source-ref-moved" },
    { key: "events", value: (f: ReturnType<typeof fixture>) => [{ ...f.event, id: 53 }], reason: "approval-event-changed" },
    { key: "permission", value: () => ({ permission: "read", user: owner }), reason: "approval-actor-not-authorized" },
  ] as const
  for (const item of cases) {
    const f = fixture()
    f.change((path, count, value) => path === f.paths[item.key] && count === 2 ? item.value(f) : value)
    await refused(f, item.reason)
  }
})

test("pagination cannot conceal a revocation or silently truncate approval history", async () => {
  const f = fixture()
  const unrelated = Array.from({ length: 99 }, (_, index) => ({ id: index + 100, event: "assigned" }))
  f.responses.set(f.paths.events, [f.event, ...unrelated])
  f.responses.set(prefix + "/issues/731/events?per_page=100&page=2", [{ ...f.event, id: 250, event: "unlabeled" }])
  await refused(f, "approval-label-event-missing")
  expect(f.calls).toContain(prefix + "/issues/731/events?per_page=100&page=2")
  const truncated = fixture()
  for (let page = 1; page <= 10; page++)
    truncated.responses.set(prefix + "/issues/731/events?per_page=100&page=" + page,
      Array.from({ length: 100 }, (_, index) => ({ id: page * 100 + index, event: "assigned" })))
  await refused(truncated, "github-pagination-incomplete")
})

test("unavailable or malformed API evidence cannot grant approval or leak diagnostics", async () => {
  const f = fixture()
  f.change((path, _count, value) => {
    if (path === f.paths.permission) throw new Error("403 sensitive transport diagnostics")
    return value
  })
  const result = await refused(f, "github-api-unavailable")
  expect(JSON.stringify(result)).not.toContain("sensitive")
  const malformed = fixture()
  malformed.responses.set(malformed.paths.commit, {})
  await refused(malformed, "snapshot-parent-invalid")
})

test("the GitHub reader pins HTTPS, GET and no redirects and refuses missing permission", async () => {
  const calls: { url: string; init: RequestInit }[] = []
  const read = githubGuardReader("unit-fixture-token", async (url, init) => {
    calls.push({ url, init })
    return Response.json({ fixture: true })
  })
  expect(await read(prefix)).toEqual({ fixture: true })
  expect(calls[0]!.url).toBe("https://api.github.com/" + prefix)
  expect(calls[0]!.init).toMatchObject({ method: "GET", redirect: "error", cache: "no-store",
    headers: { Authorization: "Bearer unit-fixture-token" } })
  await expect(read("https://elsewhere.invalid/repos/x")).rejects.toThrow("github-api-unavailable")
  await expect(read(prefix + "/../other")).rejects.toThrow("github-api-unavailable")
  expect(calls).toHaveLength(1)
  for (const status of [301, 401, 403, 404, 429, 500]) {
    const denied = githubGuardReader("unit-fixture-token", async () => new Response("", { status }))
    await expect(denied(prefix)).rejects.toThrow("github-api-unavailable")
  }
})

test("workflow confines authority to the resolver output and preserves both guard bases", async () => {
  const workflow = YAML.parse(await Bun.file(new URL("../../../.github/workflows/test-ci.yml", import.meta.url)).text()) as {
    permissions: Record<string, string>
    jobs: { test: { steps: { id?: string; name: string; env?: Record<string, string>; if?: string; run?: string; with?: Record<string, unknown> }[] } }
  }
  expect(workflow.permissions).toEqual({ contents: "read", "pull-requests": "read" })
  const steps = workflow.jobs.test.steps
  const context = steps.find((step) => step.id === "guard_context")!
  expect(context.if).toBe("steps.request.outputs.package == 'sucafina' && steps.request.outputs.runner == 'bun'")
  expect(context.env).toEqual({ GH_READ_TOKEN: "$" + "{{ github.token }}", REQUEST_BLOB: "$" + "{{ steps.request.outputs.request_blob }}" })
  expect(context.run).toContain('test "$GITHUB_SHA" = "$(git rev-parse HEAD)"')
  expect(context.run).toContain("resolveGuardContext")
  expect(context.run).not.toContain("GITHUB_ENV")
  const guard = steps.find((step) => step.name === "Verify approved source PR guard bases")!
  expect(guard.if).toBe("steps.guard_context.outputs.approved == 'protected-paths'")
  expect(guard.run).toContain("bun run check:guards --base origin/dev")
  expect(guard.run).toContain('bun run check:guards --base "$SF_GUARD_PR_BASE"')
  expect(guard.run).toContain('test "$dev_status" -eq 0 && test "$pr_status" -eq 0')
  expect(guard.run).not.toContain("--warn")
  const tests = steps.find((step) => step.name === "Run tests")!
  expect(tests.env?.GUARDRAIL_APPROVED).toBe("$" + "{{ steps.guard_context.outputs.approved }}")
  expect(steps.indexOf(context)).toBeLessThan(steps.indexOf(guard))
  expect(steps.indexOf(guard)).toBeLessThan(steps.indexOf(tests))
  const evidence = steps.find((step) => step.name === "Upload source PR guard evidence")!
  expect(evidence.if).toBe("always() && steps.guard_context.outcome != 'skipped'")
  expect(evidence.with?.path).toContain("test-ci-evidence/guard-context.json")
})
