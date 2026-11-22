import { expect, type APIRequestContext } from "@playwright/test"
import { randomUUID } from "node:crypto"
import type { DesignInstallation } from "./installation"

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Original proposal response required")
  return value as Record<string, unknown>
}
function text(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Original proposal reference required")
  return value
}

/** Original authenticated producers create the test case and draft. No store, grant or receipt is patched. */
export async function seedWaveFiveReviewProposal(request: APIRequestContext, installation: DesignInstallation) {
  const base = installation.origin + installation.mount + "/dashboard"
  const post = async (mode: string, data: unknown, mutation = false) => {
    const response = await request.post(base + "?sf=" + mode, {
      headers: { Origin: installation.origin, "Content-Type": "application/json",
        ...(mutation ? { "Idempotency-Key": randomUUID() } : {}) },
      data, timeout: 60_000,
    })
    const body = object(await response.json())
    console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "wave-five-original-proposal-setup",
      mode, httpStatus: response.status(), status: body.status, reason: body.reason ?? null }))
    expect(response.status(), "Original proposal setup " + mode).toBe(200)
    expect(body.status).toBe("ok")
    return body
  }
  const period = { start: installation.year + "-01-01", end: installation.year + "-12-31" }
  const discovered = object((await post("dashboard-workbench", { page: "Hot Topics & Actions", period })).value)
  const records = discovered.records
  if (!Array.isArray(records)) throw new Error("Original workbench omitted its record catalog")
  const row = records.map(object).find((entry) => entry.label === installation.topicName)
  if (!row) throw new Error("Original workbench omitted the labeled design source")
  const source = object(row.draft)
  const fields = object(source.fields)
  const evidence = object(source.targetEvidence)
  const action = "Design test data · Review regional sourcing evidence before the next meeting"
  const created = await post("workbench-command", { operation: "sf_case_draft", input: {
    objective: "Design test data · Preserve the sourcing follow-up proposal",
    horizon: period, currency: "USD",
    criteria: ["Design test data · Confirm source evidence before any application"],
    sourceRefs: [evidence],
  } }, true)
  const reference = text(created.outputRef)
  const control = await request.get(base, { params: { sf: "decision-controls", case: reference, format: "json" }, timeout: 40_000 })
  expect(control.status()).toBe(200)
  const controls = object(await control.json())
  expect(controls.status).toBe("ok")
  const selected = object(object(controls.value).selected)
  const caseRef = object(selected.caseRef)
  const saved = await post("dashboard-hot-topic-draft", {
    caseRef, target: source.target, targetEvidence: evidence,
    fields: { action, owner: text(fields.owner), due: text(fields.due),
      priority: text(fields.priority), notes: "Design test data · Original source draft; no chosen alternative or application." },
    sourceRefs: [evidence], expectedVersion: 0,
  }, true)
  const draftRef = text(object(saved.value).draftRef)
  const checked = object((await post("dashboard-workbench", { page: "Hot Topics & Actions", period })).value)
  const decisions = object(checked.decisions)
  const drafts = decisions.drafts
  if (!Array.isArray(drafts)) throw new Error("Original discovery omitted its drafts")
  expect(drafts.map(object).filter((entry) => entry.draftRef === draftRef)).toHaveLength(1)
  expect(Array.isArray(decisions.preparations) ? decisions.preparations.length : undefined).toBe(0)
  expect(Array.isArray(decisions.changes) ? decisions.changes.length : undefined).toBe(0)
  return { draftRef, action }
}
