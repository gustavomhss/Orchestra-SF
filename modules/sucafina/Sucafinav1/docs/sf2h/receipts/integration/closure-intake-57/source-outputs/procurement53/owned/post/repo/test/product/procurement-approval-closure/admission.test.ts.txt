import { expect, test } from "bun:test"
import { createApplication } from "../../../runtime/application.ts"
import { object } from "../../../runtime/contract.ts"
import type { Command } from "../../../runtime/contract.ts"
import { domain, pages } from "../../../runtime/procurement.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { ProcurementApprovalPlan } from "../../../product/procurement/decision-preparation.ts"
import { createApprovalFixture } from "./fixture.ts"

test("the synchronous admission permits exactly the reviewed command before the canonical HTTP effect", async () => {
  const fixture = await createApprovalFixture()
  try {
    const plan = await draftPlan(fixture)
    const before = await fixture.snapshot()
    const writes = fixture.writes.length
    const changed = await admittedHttp(fixture, plan, { ...plan.command, values: { pr: { estAmount: 160 } } })
    expect(await fixture.snapshot()).toEqual(before)
    expect(fixture.writes).toHaveLength(writes)
    expect((await changed.post()).status).toBe(403)
    expect(changed.calls.executed).toBe(0)
    expect(changed.calls.statuses).toEqual(["denied"])
    expect(await fixture.snapshot()).toEqual(before)
    expect(fixture.writes).toHaveLength(writes)

    const exact = await admittedHttp(fixture, plan)
    expect(await fixture.snapshot()).toEqual(before)
    expect(fixture.writes).toHaveLength(writes)
    expect((await exact.post()).status).toBe(200)
    expect(exact.calls.executed).toBe(1)
    expect(exact.calls.statuses).toEqual(["ok"])
    const committed = await fixture.snapshot()
    expect(committed.versions[`requests:${fixture.requestId}`]?.version).toBe(plan.command.version + 1)
    expect(committed.audit).toHaveLength(before.audit.length + 1)
    expect(fixture.writes).toHaveLength(writes + 1)
    expect(await fixture.current()).toMatchObject({ status: "draft", pr: { estAmount: 140 } })
    expect(exact.gate.current(committed, fixture.actors.alice!, plan.command, await fixture.host.environment(exact.request))).toEqual({ status: "denied", reason: "current-authority-unavailable" })
    expect(await fixture.snapshot()).toEqual(committed)
    expect(fixture.writes).toHaveLength(writes + 1)
  } finally { await fixture.dispose() }
})

test.each(["policy", "currency", "roles"] as const)("transaction admission refuses %s drift while the request CAS is unchanged", async (change) => {
  const fixture = await createApprovalFixture()
  try {
    const plan = await draftPlan(fixture)
    const admitted = await admittedHttp(fixture, plan)
    if (change === "roles") fixture.actors.alice!.roles = ["admin"]
    if (change !== "roles") {
      const snapshot = await fixture.snapshot()
      const settings = object(object(snapshot.data.store).settings)
      const values = change === "currency" ? { currency: "EUR" } : { blockSelfApproval: settings.blockSelfApproval !== true }
      const updated = await fixture.execute({ id: "admin", canWrite: true, roles: ["admin"] }, { page: "Settings", action: "save", version: snapshot.versions.settings!.version, values })
      expect(updated.ok).toBe(true)
    }
    const changed = await fixture.snapshot()
    expect(changed.versions[`requests:${fixture.requestId}`]?.version).toBe(plan.command.version)
    const writes = fixture.writes.length
    expect((await admitted.post()).status).toBe(change === "roles" ? 403 : 409)
    expect(admitted.calls.statuses).toEqual([change === "roles" ? "denied" : "stale"])
    expect(admitted.calls.executed).toBe(0)
    expect(await fixture.snapshot()).toEqual(changed)
    expect(fixture.writes).toHaveLength(writes)
    expect(await fixture.current()).toMatchObject({ status: "draft", pr: { estAmount: 100 } })
  } finally { await fixture.dispose() }
})

test.each(["finished-gate", "finished-ui", "replaced-request"] as const)("transaction admission refuses %s without executing the domain", async (change) => {
  const fixture = await createApprovalFixture()
  try {
    const plan = await draftPlan(fixture)
    const admitted = await admittedHttp(fixture, plan)
    const before = await fixture.snapshot()
    const writes = fixture.writes.length
    if (change === "finished-gate") admitted.gate.finish()
    if (change === "finished-ui") fixture.ui.finish(admitted.context)
    if (change === "replaced-request") {
      const replacement = new Request(admitted.request.url, { method: "POST", headers: admitted.request.headers, body: JSON.stringify(plan.command) })
      fixture.host.requestFor = () => replacement
    }
    expect((await admitted.post()).status).toBe(403)
    expect(admitted.calls.statuses).toEqual(["denied"])
    expect(admitted.calls.executed).toBe(0)
    expect(await fixture.snapshot()).toEqual(before)
    expect(fixture.writes).toHaveLength(writes)
  } finally { await fixture.dispose() }
})

test("malformed prepare payloads fail closed without throwing or writing", async () => {
  const fixture = await createApprovalFixture()
  try {
    const draft = await fixture.review()
    const action = { kind: "save-estimate" as const, amount: 140 }
    const cycle: Record<string, unknown> = { review: draft.review, action }
    cycle.cycle = cycle
    const malformed: unknown[] = [
      undefined, null, [], {}, new Date(), cycle,
      { review: null, action },
      { review: draft.review, action: null },
      { review: { ...draft.review, source: null }, action },
      { review: { ...draft.review, domainVersion: "1" }, action },
      { review: { ...draft.review, amount: Number.NaN }, action },
      { review: draft.review, action: { ...action, amount: "140" } },
      { review: draft.review, action: { ...action, amount: Number.POSITIVE_INFINITY } },
      { review: draft.review, action: { ...action, confirmed: true } },
      { review: draft.review, action, extra: true },
      { review: draft.review, get action() { throw new Error("Transport getter must not execute") } },
    ]
    const before = await fixture.snapshot()
    const writes = fixture.writes.length
    for (const incoming of malformed) {
      // Deliberately cross the typed boundary to exercise runtime admission of transport input.
      expect(await fixture.lifecycle.prepare(incoming as Parameters<typeof fixture.lifecycle.prepare>[0], draft.context)).toEqual({ status: "needs-input", reason: "explicit-requisition-action-required" })
      expect(await fixture.snapshot()).toEqual(before)
      expect(fixture.writes).toHaveLength(writes)
    }
  } finally { await fixture.dispose() }
})

async function draftPlan(fixture: Awaited<ReturnType<typeof createApprovalFixture>>) {
  const draft = await fixture.review()
  const result = await fixture.lifecycle.prepare({ review: draft.review, action: { kind: "save-estimate", amount: 140 } }, draft.context)
  if (result.status !== "ok") throw new Error(`Draft plan unavailable: ${result.reason}`)
  return result.value
}

/** Composition harness only: this does not claim that the integrator's shared HTTP hook has shipped. */
async function admittedHttp(fixture: Awaited<ReturnType<typeof createApprovalFixture>>, plan: ProcurementApprovalPlan, command: Command = plan.command) {
  const request = new Request("https://scenario.invalid/sf/procurement", { method: "POST", headers: { authorization: "Bearer alice", origin: "https://scenario.invalid", "content-type": "application/json" }, body: JSON.stringify(command) })
  const digest = digestSfValue({ fixture: "explicit-procurement-command", command })
  const admitted = await fixture.ui.admit(request, "sf_scenario_simulate", digest)
  if (admitted.status !== "ok" || !await fixture.ui.validate(admitted.value, "sf_scenario_simulate", digest)) throw new Error("HTTP UI admission unavailable")
  const admission = await fixture.lifecycle.admission(plan, admitted.value)
  if (admission.status !== "ok") throw new Error(`Command admission unavailable: ${admission.reason}`)
  const calls = { executed: 0, statuses: [] as string[] }
  const http = createApplication("/sf", { persistence: fixture.persistence, authenticate: fixture.host.authenticate, environment: fixture.host.environment, maxJsonBytes: 1024 * 1024, domains: { dashboard: [], planner: [], procurement: [{ pages, render: () => undefined, domain: {
    view: domain.view,
    execute(snapshot, actor, incoming, environment) {
      const current = admission.value.current(snapshot, actor, incoming, environment)
      calls.statuses.push(current.status)
      if (current.status !== "ok") return { ok: false, status: current.status === "stale" ? 409 : 403, errors: [current.reason] }
      calls.executed += 1
      return domain.execute(snapshot, actor, incoming, environment)
    },
  } }] } })
  return { request, context: admitted.value, gate: admission.value, calls, post: async () => {
    const response = await http(request)
    if (!response) throw new Error("Canonical HTTP route unavailable")
    return response
  } }
}
