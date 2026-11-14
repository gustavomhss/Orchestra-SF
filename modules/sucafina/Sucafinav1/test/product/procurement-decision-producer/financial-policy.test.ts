import { expect, test } from "bun:test"
import { domain } from "../../../runtime/procurement.ts"
import { object, rows } from "../../../runtime/contract.ts"
import type { Actor, Command, Snapshot } from "../../../runtime/contract.ts"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"
import { procurementPreparationIssue } from "../../../product/procurement/prepared.ts"

const at = "2026-11-14T12:00:00Z"
const requester: Actor = { id: "requester", canWrite: true, roles: ["requester"] }
const holder: Actor = { id: "holder", canWrite: true, roles: ["approver"] }
const administrator: Actor = { id: "administrator", canWrite: true, roles: ["admin"] }
const environment = { at, id: () => "synthetic-id", directory: [] }

test("canonical approval reviews the exact proposed amount and ends outside the prepared PR-save stage", () => {
  const fixture = createRequisition()
  const initial = structuredClone(fixture.snapshot)
  expect(fixture.run(holder, "approve").ok).toBe(false)
  expect(fixture.snapshot).toEqual(initial)

  expect(fixture.run(requester, "submit_pr", { pr: { estAmount: 140 } }).ok).toBe(true)
  expect(fixture.current()).toMatchObject({ status: "pr_pending", pr: { estAmount: 140 }, prApproval: { amount: 140, steps: [{ holderId: "holder", status: "pending" }] }, prApprovalBaseCurrency: "USD" })
  const reviewedVersion = fixture.version()
  expect(fixture.run(holder, "approve", { comment: "Reviewed proposed USD 140" }, reviewedVersion).ok).toBe(true)
  expect(fixture.version()).toBe(reviewedVersion + 1)
  expect(fixture.current()).toMatchObject({ status: "sourcing", pr: { estAmount: 140 }, prApproval: { amount: 140, steps: [{ holderId: "holder", status: "approved" }] }, prApprovalBaseCurrency: "USD" })

  // This is a positive approval proof, not a financial Apply proof: the canonical
  // last approval changes stage, so neither a duplicate save nor another amount
  // is an admissible prepared PR effect under the existing policy.
  for (const amount of [140, 160]) {
    const command = fixture.command("save", { pr: { estAmount: amount } })
    expect(procurementPreparationIssue(fixture.snapshot, command)).toBe("requisition-stage-not-editable")
    const before = structuredClone(fixture.snapshot)
    expect(domain.execute(fixture.snapshot, requester, command, environment)).toMatchObject({ ok: false, status: 403 })
    expect(fixture.snapshot).toEqual(before)
  }
})

test("approval rejects stale CAS, another holder and admin override and applies one approval once", () => {
  const fixture = createRequisition()
  expect(fixture.run(requester, "submit_pr", { pr: { estAmount: 140 } }).ok).toBe(true)
  const reviewedVersion = fixture.version()
  const before = structuredClone(fixture.snapshot)
  expect(fixture.run(holder, "approve", {}, reviewedVersion - 1)).toMatchObject({ ok: false, status: 409 })
  expect(fixture.snapshot).toEqual(before)
  expect(fixture.run({ ...holder, id: "other-holder" }, "approve")).toMatchObject({ ok: false, status: 403, errors: ["not_approver"] })
  expect(fixture.snapshot).toEqual(before)
  expect(fixture.run(administrator, "approve")).toMatchObject({ ok: false, status: 403, errors: ["no_override"] })
  expect(fixture.snapshot).toEqual(before)
  expect(fixture.run({ ...holder, canWrite: false }, "approve")).toMatchObject({ ok: false, status: 403 })
  expect(fixture.snapshot).toEqual(before)
  expect(fixture.run(holder, "approve", {}, reviewedVersion).ok).toBe(true)
  const approved = structuredClone(fixture.snapshot)
  expect(fixture.run(holder, "approve", {}, reviewedVersion)).toMatchObject({ ok: false, status: 409 })
  expect(fixture.snapshot).toEqual(approved)
  expect(rows(fixture.current().history).filter((row) => String(row.action).includes("approved by"))).toHaveLength(1)
  expect(fixture.snapshot.audit).toHaveLength(before.audit.length + 1)
})

test("approving a pending old amount with a new amount in the payload does not approve the proposal", () => {
  const fixture = createRequisition()
  expect(fixture.run(requester, "submit_pr").ok).toBe(true)
  expect(fixture.current()).toMatchObject({ status: "pr_pending", pr: { estAmount: 100 }, prApproval: { amount: 100 } })
  expect(fixture.run(holder, "approve", { pr: { estAmount: 140 }, comment: "Attempt to approve USD 140" }).ok).toBe(true)
  expect(fixture.current()).toMatchObject({ status: "sourcing", pr: { estAmount: 100 }, prApproval: { amount: 100 } })
  expect(object(fixture.current().prApproval).amount).not.toBe(140)
  expect(procurementPreparationIssue(fixture.snapshot, fixture.command("save", { pr: { estAmount: 140 } }))).toBe("requisition-stage-not-editable")
})

test("rejected proposal requires a new submission and review version for its changed amount", () => {
  const fixture = createRequisition()
  expect(fixture.run(requester, "submit_pr").ok).toBe(true)
  const oldReviewVersion = fixture.version()
  expect(fixture.run(holder, "reject", { reason: "Request a revised proposal" }).ok).toBe(true)
  expect(fixture.current()).toMatchObject({ status: "pr_rejected", prApproval: { amount: 100, steps: [{ status: "rejected" }] } })
  expect(fixture.run(requester, "submit_pr", { pr: { estAmount: 140 } }).ok).toBe(true)
  const currentReviewVersion = fixture.version()
  expect(currentReviewVersion).toBeGreaterThan(oldReviewVersion)
  expect(fixture.current()).toMatchObject({ status: "pr_pending", pr: { estAmount: 140 }, prApproval: { amount: 140, steps: [{ status: "pending" }] } })
  const before = structuredClone(fixture.snapshot)
  expect(fixture.run(holder, "approve", {}, oldReviewVersion)).toMatchObject({ ok: false, status: 409 })
  expect(fixture.snapshot).toEqual(before)
  expect(fixture.run(holder, "approve", {}, currentReviewVersion).ok).toBe(true)
  expect(fixture.current()).toMatchObject({ status: "sourcing", pr: { estAmount: 140 }, prApproval: { amount: 140, steps: [{ status: "approved" }] } })
  expect(procurementPreparationIssue(fixture.snapshot, fixture.command("save", { pr: { estAmount: 160 } }))).toBe("requisition-stage-not-editable")
})

function createRequisition() {
  const snapshot: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
  // Synthetic fixture: preserve the existing thresholds, route and self-approval
  // policy, assigning only directory holders through the real Settings command.
  const settings = initialProcurementSettings()
  expect(domain.execute(snapshot, administrator, { page: "Settings", action: "save", version: 0, values: { ...settings, levels: settings.levels.map((level) => ({ ...level, holderId: "holder" })) } }, environment).ok).toBe(true)
  const created = domain.execute(snapshot, requester, { page: "Requests", action: "create", version: 0, values: { pr: { title: "Synthetic proposal", type: "service", description: "Explicit test data", estAmount: 100, costCenter: "IT", needBy: "2026-12-01", justification: "Compare revised proposal", recurring: false, expenseType: "OPEX" } } }, environment)
  if (!created.ok) throw new Error("Synthetic requisition creation failed")
  const id = String(object(created.value).number)
  const version = () => snapshot.versions[`requests:${id}`]!.version
  const command = (action: string, values: Record<string, unknown> = {}, expectedVersion = version()): Command => ({ page: "Requests", action, id, version: expectedVersion, values })
  return {
    snapshot,
    version,
    command,
    current: () => object(object(object(snapshot.data.store).requests)[id]).request as Record<string, unknown>,
    run: (actor: Actor, action: string, values: Record<string, unknown> = {}, expectedVersion = version()) => domain.execute(snapshot, actor, command(action, values, expectedVersion), environment),
  }
}
