import { expect, test } from "bun:test"
import { object, rows } from "../../../runtime/contract.ts"
import type { Command } from "../../../runtime/contract.ts"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"
import { createPrivacyFixture, requestData, requestVersion, validPR } from "./fixture.ts"

type Fixture = Awaited<ReturnType<typeof createPrivacyFixture>>
const actions = ["save", "submit_pr", "submit_sourcing", "select_quote", "submit_po", "approve", "reject", "issue", "cancel", "delete"] as const
const values = { pr: validPR("Synthetic attempted replacement73"), reason: "Synthetic rejection73", comment: "Synthetic approval73", quoteId: "synthetic-quote73" }
const command = (id: string, action: string, version: number, input: Record<string, unknown> = {}): Command => ({ page: "Requests", action, id, version, values: input })
async function current(fixture: Fixture, id: string, action: string, input: Record<string, unknown> = {}) {
  return command(id, action, requestVersion(await fixture.snapshot(), id), input)
}
async function accepted(fixture: Fixture, principal: string, id: string, action: string, input: Record<string, unknown> = {}) {
  const response = await fixture.post(principal, await current(fixture, id, action, input))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ ok: true })
}
async function refused(fixture: Fixture, principal: string, input: Command, status: number) {
  const before = await fixture.snapshot()
  const response = await fixture.post(principal, input)
  expect(response.status).toBe(status)
  // Entire durable state: records, CAS, audit, notices, allocations, actCalls and private metadata.
  expect(await fixture.snapshot()).toEqual(before)
  return response.json()
}

test.each(actions)("M73 %s: requester-only sees identical missing/hidden responses at equal and divergent versions", async (action) => {
  const fixture = await createPrivacyFixture()
  try {
    await fixture.create("alice")
    const hidden = await fixture.create("bob", "Synthetic private B73")
    const before = await fixture.snapshot()
    const version = requestVersion(before, hidden)
    const responses = []
    // The hidden draft is a fully valid PR: submit_pr used to mutate it for this requester.
    expect(requestData(before, hidden)).toMatchObject({ createdBy: "bob", status: "draft", pr: validPR("Synthetic private B73") })
    for (const id of ["PR-2099-9999", hidden]) for (const submitted of [version, version - 1, version + 1]) {
      const response = await fixture.post("alice", command(id, action, submitted, values))
      responses.push({ status: response.status, body: await response.text(), headers: [...response.headers.entries()] })
      expect(await fixture.snapshot()).toEqual(before)
    }
    expect(responses).toHaveLength(6)
    for (const response of responses) {
      expect(response).toEqual(responses[0]!)
      expect(response.status).toBe(404)
      expect(response.body).toBe('{"ok":false,"status":404}')
    }
  } finally { await fixture.dispose() }
})

test("M73 inherited object identifiers are absent across all request commands and versions", async () => {
  const fixture = await createPrivacyFixture()
  try {
    await fixture.create("bob")
    for (const id of ["toString", "valueOf", "hasOwnProperty"]) for (const action of actions) for (const version of [0, 1]) {
      expect(await refused(fixture, "alice", command(id, action, version, values), 404)).toEqual({ ok: false, status: 404 })
    }
  } finally { await fixture.dispose() }
})

test("M73 visible requests retain exact conflict content before action and stage validation", async () => {
  const fixture = await createPrivacyFixture()
  try {
    const id = await fixture.create("alice", "Synthetic visible CAS73")
    const before = await fixture.snapshot()
    const version = requestVersion(before, id)
    for (const action of actions) for (const submitted of [version - 1, version + 1]) {
      expect(await refused(fixture, "alice", command(id, action, submitted, values), 409)).toEqual({
        ok: false, status: 409, stored: requestData(before, id), by: "alice", currentVersionCAS: version,
      })
    }
  } finally { await fixture.dispose() }
})

test("M73 real save, submission, rejection and approval preserve holder authority, CAS and submitted amounts", async () => {
  const fixture = await createPrivacyFixture()
  try {
    const id = await fixture.create("alice")
    const save = await current(fixture, id, "save", { pr: { estAmount: 140 } })
    expect((await fixture.post("alice", save)).status).toBe(200)
    const saved = await fixture.snapshot()
    expect(requestData(saved, id)).toMatchObject({ status: "draft", pr: { estAmount: 140 } })
    expect(await refused(fixture, "alice", save, 409)).toMatchObject({ stored: requestData(saved, id), by: "alice", currentVersionCAS: requestVersion(saved, id) })
    await accepted(fixture, "alice", id, "submit_pr")
    const pending = await fixture.snapshot()
    expect(requestData(pending, id)).toMatchObject({ status: "pr_pending", prApproval: { amount: 140 }, prApprovalBaseCurrency: "USD" })
    expect(rows(object(requestData(pending, id).prApproval).steps)).toMatchObject([{ status: "pending", holderId: "holder" }])
    for (const principal of ["other", "admin", "alice"]) for (const action of ["approve", "reject"]) {
      await refused(fixture, principal, await current(fixture, id, action, values), 403)
    }
    const oldApproval = await current(fixture, id, "approve", { comment: "Retained approval73" })
    await accepted(fixture, "holder", id, "reject", { reason: "Revise estimate73" })
    expect(requestData(await fixture.snapshot(), id).status).toBe("pr_rejected")
    await accepted(fixture, "alice", id, "save", { pr: { estAmount: 160 } })
    await accepted(fixture, "alice", id, "submit_pr")
    const resubmitted = await fixture.snapshot()
    expect(requestData(resubmitted, id)).toMatchObject({ prApproval: { amount: 160 }, pr: { estAmount: 160 } })
    expect(await refused(fixture, "holder", oldApproval, 409)).toMatchObject({ stored: requestData(resubmitted, id), by: "alice", currentVersionCAS: requestVersion(resubmitted, id) })
    await accepted(fixture, "holder", id, "approve", { comment: "Approve current submitted 16073" })
    const approved = await fixture.snapshot()
    expect(requestData(approved, id)).toMatchObject({ status: "sourcing", prApproval: { amount: 160 }, pr: { estAmount: 160 } })
    expect(approved.audit.at(-1)).toMatchObject({ who: "holder", name: "Synthetic holder73", record: `requests:${id}` })
    expect(approved.notices.at(-1)).toMatchObject({ kind: "approved", record: id, to: ["alice"] })
    await refused(fixture, "alice", await current(fixture, id, "save", { pr: { estAmount: 1 } }), 403)
  } finally { await fixture.dispose() }
})

test("M73 canonical self-approval settings retain both allowed and blocked behavior without changing thresholds", async () => {
  const fixture = await createPrivacyFixture()
  try {
    const configured = object(object((await fixture.snapshot()).data.store).settings)
    const initial = initialProcurementSettings()
    expect(configured).toEqual({ ...initial, levels: initial.levels.map((level) => ({ ...level, holderId: "holder" })) })
    await fixture.configureHolder("self")
    const allowed = await fixture.create("self")
    await accepted(fixture, "self", allowed, "submit_pr")
    await accepted(fixture, "self", allowed, "approve")
    const beforeSetting = await fixture.snapshot()
    expect((await fixture.post("admin", { page: "Settings", action: "save", version: beforeSetting.versions.settings!.version, values: { blockSelfApproval: true } })).status).toBe(200)
    const blocked = await fixture.create("self")
    await accepted(fixture, "self", blocked, "submit_pr")
    expect(await refused(fixture, "self", await current(fixture, blocked, "approve"), 403)).toMatchObject({ errors: ["self_approval"] })
    await refused(fixture, "admin", await current(fixture, blocked, "approve"), 403)
    const final = object(object((await fixture.snapshot()).data.store).settings)
    expect(final).toEqual({ ...initial, blockSelfApproval: true, levels: initial.levels.map((level) => ({ ...level, holderId: "self" })) })
  } finally { await fixture.dispose() }
})

test("M73 create ignores caller-selected record IDs and preserves creation CAS without foreign metadata", async () => {
  const fixture = await createPrivacyFixture()
  try {
    const hidden = await fixture.create("bob", "Synthetic foreign canary73")
    await accepted(fixture, "bob", hidden, "submit_pr")
    await accepted(fixture, "holder", hidden, "approve")
    await accepted(fixture, "buyer", hidden, "save", { sourcing: {
      evaluator: "Foreign metadata canary73", quotes: [{ id: "private-quote73", supplier: "Synthetic supplier73", currency: "USD", total: 100, techPass: true,
        description: "Foreign quote detail73", notes: "Foreign metadata canary73", scores: [5, 5, 5, 5, 5], cscores: [5, 5, 5] }],
    } })
    for (const callerId of [hidden, "PR-2099-9999", "toString"]) {
      const before = await fixture.snapshot()
      expect(await refused(fixture, "alice", command(callerId, "create", 1, { pr: validPR() }), 409)).toEqual({ ok: false, status: 409, currentVersionCAS: 0 })
      const oldRequests = object(object(before.data.store).requests)
      expect((await fixture.post("alice", command(callerId, "create", 0, { pr: validPR("Synthetic new A73") }))).status).toBe(200)
      const after = await fixture.snapshot()
      const requests = object(object(after.data.store).requests)
      expect(requests[hidden]).toEqual(oldRequests[hidden])
      const added = Object.keys(requests).filter((id) => !Object.hasOwn(oldRequests, id))
      expect(added).toHaveLength(1)
      expect(added[0]).not.toBe(callerId)
      const created = requestData(after, added[0]!)
      expect(created).toMatchObject({ createdBy: "alice", status: "draft", pr: validPR("Synthetic new A73"), attachments: [], sourcing: null, po: null })
      expect(JSON.stringify(created)).not.toContain("Foreign")
      expect(after.audit.at(-1)).toMatchObject({ who: "alice", was: null, record: `requests:${added[0]}` })
    }
  } finally { await fixture.dispose() }
})

test("M73 independent SQLite instances enforce one successful CAS and retain privacy after restart", async () => {
  const fixture = await createPrivacyFixture()
  let second: Fixture | undefined
  let reopened: Fixture | undefined
  try {
    const hidden = await fixture.create("bob")
    const id = await fixture.create("alice")
    second = await createPrivacyFixture({ directory: fixture.directory })
    const before = await fixture.snapshot()
    const version = requestVersion(before, id)
    const results = await Promise.all([
      fixture.post("alice", command(id, "save", version, { pr: { title: "Synthetic winner A73" } })),
      second.post("alice", command(id, "save", version, { pr: { title: "Synthetic winner B73" } })),
    ])
    expect(results.map((response) => response.status).sort()).toEqual([200, 409])
    const committed = await fixture.snapshot()
    expect(await second.snapshot()).toEqual(committed)
    expect(requestVersion(committed, id)).toBe(version + 1)
    expect(committed.audit).toHaveLength(before.audit.length + 1)
    expect(committed.notices).toEqual(before.notices)
    expect(committed.sequences).toEqual(before.sequences)
    expect(object(committed.data.store).actCalls).toBe(object(before.data.store).actCalls)
    expect(await results.find((response) => response.status === 409)!.json()).toEqual({ ok: false, status: 409, stored: requestData(committed, id), by: "alice", currentVersionCAS: version + 1 })
    await second.close()
    second = undefined
    await fixture.close()
    reopened = await createPrivacyFixture({ directory: fixture.directory })
    expect(await reopened.snapshot()).toEqual(committed)
    expect(await refused(reopened, "alice", command(hidden, "submit_pr", requestVersion(committed, hidden)), 404)).toEqual({ ok: false, status: 404 })
    await refused(reopened, "alice", command(id, "save", version), 409)
  } finally {
    await second?.close()
    await reopened?.close()
    await fixture.dispose()
  }
})

test("M73 visible cancellation and draft deletion retain their stage restrictions and allocations", async () => {
  const fixture = await createPrivacyFixture()
  try {
    const cancelled = await fixture.create("alice")
    await accepted(fixture, "alice", cancelled, "cancel", { reason: "Synthetic cancelled demand73" })
    expect(requestData(await fixture.snapshot(), cancelled).status).toBe("cancelled")
    for (const action of ["cancel", "delete"]) await refused(fixture, "alice", await current(fixture, cancelled, action, values), 403)
    const deleted = await fixture.create("alice")
    await accepted(fixture, "alice", deleted, "delete")
    expect(await refused(fixture, "alice", command(deleted, "save", 1), 404)).toEqual({ ok: false, status: 404 })
    expect(await fixture.create("alice")).not.toBe(deleted)
  } finally { await fixture.dispose() }
})
