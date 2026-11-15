import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import {
  SfProcurement, SfProcurementRequest, SfProcurementTitleSave,
} from "../../../../../packages/schema/src/sucafina/procurement.ts"
import { createSfProcurementClient } from "../../../../../packages/client/src/sucafina/procurement.ts"
import type { SfTransport } from "../../../../../packages/client/src/sucafina/transport.ts"
import { domain } from "../../runtime/procurement.ts"
import { object } from "../../runtime/contract.ts"
import type { Snapshot } from "../../runtime/contract.ts"

// Component/contract tests only. An injected transport is NOT an installed
// Electron, Microsoft identity, durable CAS or owner-fence qualification.
const environment = {
  at: "2026-11-15T12:00:00Z",
  id: () => "supplier-1",
  directory: [{ id: "requester", name: "Requester" }, { id: "holder", name: "Holder" }],
}
function snapshot(): Snapshot {
  return { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
}
const requester = { id: "requester", roles: ["requester"], canWrite: true }
const admin = { id: "admin", roles: ["admin"], canWrite: true }
const originalPr = {
  title: "Original", type: "product", description: "Operations",
  estAmount: 100, costCenter: "IT", needBy: "2026-12-01",
  justification: "Renewal", recurring: false, expenseType: "OPEX",
}

describe("W11 Procurement A03 public contract", () => {
  test("the 39 operations have distinct, frozen operation IDs", () => {
    const ids = Object.keys(SfProcurement.operations)
    expect(ids).toHaveLength(39)
    expect(new Set(ids).size).toBe(39)
    for (const id of ids) {
      const operation = SfProcurement.operations[id as keyof typeof SfProcurement.operations]
      expect(operation.operationId).toBe(id)
    }
    expect(ids).toContain("domain.command.CAP25.save")
    expect(ids).toContain("domain.command.CAP26.approve")
    expect(ids).toContain("procurement.sourcing.prepare")
    expect(ids).toContain("procurement.procurement-scenario-preview")
  })

  test("title-save is a save of the exact request CAS version, never approval", () => {
    const titleSave = {
      page: "Requests", action: "save", id: "PR-2026-0001",
      version: 7, values: { pr: { title: "New title" } },
    }
    expect(Schema.decodeUnknownSync(SfProcurementTitleSave)(titleSave)).toEqual(titleSave)
    expect(() => Schema.decodeUnknownSync(SfProcurementTitleSave)({
      ...titleSave, action: "approve",
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(SfProcurementTitleSave)({
      ...titleSave, version: -1,
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(
      SfProcurement.operations["domain.command.CAP26.approve"].input,
    )({ ...titleSave, action: "approve" })).toThrow()
  })

  test("preserves zero, null and missing values without fabricating amounts", () => {
    const record = {
      number: "PR-2026-0001", status: "draft", createdBy: "requester",
      pr: { title: "No amount yet", estAmount: 0, estAnnual: null },
      value: null,
    }
    expect(Schema.decodeUnknownSync(SfProcurementRequest)(record)).toMatchObject(record)
    const absent = { number: "PR-2026-0002", status: "draft", createdBy: "requester" }
    const decoded = Schema.decodeUnknownSync(SfProcurementRequest)(absent)
    expect(Object.hasOwn(decoded, "value")).toBe(false)
  })

  test("real producer protects visibility before disclosing CAS and keeps save distinct from approval", () => {
    const state = snapshot()
    const reset = domain.execute(state, admin, {
      page: "Settings", action: "reset", version: 0, values: {},
    }, environment)
    expect(reset.ok).toBe(true)
    const created = domain.execute(state, requester, {
      page: "Requests", action: "create", version: 0, values: { pr: originalPr },
    }, environment)
    expect(created.ok).toBe(true)
    if (!created.ok) throw new Error("canonical creation did not create a request")
    const id = String(object(created.value).number)
    expect(state.versions["requests:" + id]?.version).toBe(1)
    const invisible = domain.execute(state, {
      id: "other-requester", canWrite: true, roles: ["requester"],
    }, { page: "Requests", action: "approve", id, version: 0, values: {} }, environment)
    expect(invisible).toMatchObject({ ok: false, status: 404 })
    const before = structuredClone(state)
    const stale = domain.execute(state, requester, {
      page: "Requests", action: "save", id, version: 0, values: { pr: { title: "Wrong CAS" } },
    }, environment)
    expect(stale).toMatchObject({ ok: false, status: 409 })
    expect(state).toEqual(before)
    const saved = domain.execute(state, requester, {
      page: "Requests", action: "save", id, version: 1, values: { pr: { title: "New title" } },
    }, environment)
    expect(saved.ok).toBe(true)
    expect(state.versions["requests:" + id]?.version).toBe(2)
    const [visible] = domain.view(state, requester, environment).data.requests as Record<string, unknown>[]
    expect(object(visible.pr).title).toBe("New title")
    expect(visible.status).toBe("draft")
    const forbiddenApproval = domain.execute(state, requester, {
      page: "Requests", action: "approve", id, version: 2, values: {},
    }, environment)
    expect(forbiddenApproval.ok).toBe(false)
  })

  test("typed client forwards the exact operation and caller-supplied intent, never retries", async () => {
    const calls: { id: string; input: unknown; signal: AbortSignal }[] = []
    const transport: SfTransport = {
      async execute(operation, input, options) {
        calls.push({ id: operation.operationId, input, signal: options.signal })
        return { kind: "transport-error", reason: "outcome-unknown" }
      },
    }
    const controller = new AbortController()
    const client = createSfProcurementClient(transport)
    const input = {
      page: "Requests" as const, action: "save" as const, id: "PR-2026-0001",
      version: 3, values: { pr: { title: "Only the title" } },
    }
    const outcome = await client["domain.command.CAP25.save"](input, {
      signal: controller.signal, idempotencyKey: "intent:stable-0001",
    })
    expect(outcome).toEqual({ kind: "transport-error", reason: "outcome-unknown" })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      id: "domain.command.CAP25.save", input,
      signal: controller.signal,
    })
  })

  test("scenario controls cannot represent a financial approval", () => {
    const input = {
      status: "ok", value: {
        caseRef: { id: "case", incarnation: "i-1", version: 1 },
        authority: {
          installationId: "installation", projectId: "project", principalRef: "principal",
          accessRevision: "ar", policyVersion: "pv",
        },
        sources: [], financialApproval: "approved",
        financialApprovalReason: "not a real financial decision",
      },
    }
    expect(() => Schema.decodeUnknownSync(
      SfProcurement.operations["procurement.procurement-scenario-controls"].output,
    )(input)).toThrow()
  })
})
