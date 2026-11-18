/**
 * A11 authored regression cases, NOT execution evidence.
 * 120 dispatches selected CI only after I00 composes actual F01/F02 bindings;
 * 119 owns compiler guards. No local suite or producer authorization mock.
 */
import { describe, expect, test } from "bun:test"
import { Option, Schema } from "effect"
import {
  SfOperations, SfDomainPageCap11, SfDomainPageCap12,
} from "../../../../../packages/schema/src/sucafina/operations.ts"
import { createSfOperationsClient } from "../../../../../packages/client/src/sucafina/operations.ts"
import type { SfTransport } from "../../../../../packages/client/src/sucafina/transport.ts"
import {
  SF_OPERATIONS_ACTIONS, SF_OPERATIONS_PAGES,
  projectSfOperationsData, projectSfOperationsVersions,
} from "../../../../../apps/cli/src/sucafina-product/native-ui/operations/projection.ts"

const expected = [
  "domain.page.CAP11",
  "domain.command.CAP11.save-categories",
  "domain.command.CAP11.save-items",
  "domain.command.CAP11.save-tickets",
  "domain.command.CAP11.save-sla",
  "domain.command.CAP11.save-heatmap",
  "domain.command.CAP11.import-month",
  "domain.page.CAP12",
  "domain.command.CAP12.save-kpi",
  "domain.command.CAP12.delete-kpi",
  "domain.command.CAP12.save-action",
  "domain.command.CAP12.delete-action",
  "domain.command.CAP12.save-incident",
  "domain.command.CAP12.delete-incident",
  "domain.command.CAP12.save-campaign",
  "domain.command.CAP12.delete-campaign",
] as const

function valid<S extends Schema.Top>(schema: S, value: unknown): boolean {
  return Option.isSome(Schema.decodeUnknownOption(schema)(value, { onExcessProperty: "error" }))
}
const stamp = {
  installationId: "test-installation", projectId: "test-project",
  hostId: "test-current-host", principalRef: "test-current-principal",
  policyVersion: "policy1", accessRevision: "access1",
}

describe("A11 operation fidelity", () => {
  test("exactly the sixteen IDs, two source pages, fourteen closed actions", () => {
    expect(Object.keys(SfOperations.operations)).toEqual(expected)
    expect(SF_OPERATIONS_PAGES).toEqual({
      CAP11: "IT Operations", CAP12: "IT Security KPIs",
    })
    expect(SF_OPERATIONS_ACTIONS.CAP11).toHaveLength(6)
    expect(SF_OPERATIONS_ACTIONS.CAP12).toHaveLength(8)
    for (const key of expected)
      expect(SfOperations.operations[key].operationId).toBe(key)
  })

  test("the typed client forwards operation ID, exact CAS and caller signal unchanged", async () => {
    const signal = new AbortController().signal
    const calls: { operationId: string; input: unknown; options: unknown }[] = []
    const transport: SfTransport = {
      execute: async (operation, input, options) => {
        calls.push({ operationId: operation.operationId, input, options })
        return { kind: "transport-error", reason: "contract-unavailable" }
      },
    }
    const client = createSfOperationsClient(transport)
    const options = { signal, idempotencyKey: "a11-intent-0001" }
    const payload = { id: "current-id", version: 7, values: {
      year: 2026, month: 11, socPending: 0,
    } }
    expect(await client["domain.command.CAP12.save-kpi"](payload, options)).toEqual({
      kind: "transport-error", reason: "contract-unavailable",
    })
    expect(await client["domain.page.CAP11"]({ opsYear: 2026, operationsMonth: 11 }, { signal })).toEqual({
      kind: "transport-error", reason: "contract-unavailable",
    })
    expect(calls).toEqual([
      { operationId: "domain.command.CAP12.save-kpi", input: payload, options },
      {
        operationId: "domain.page.CAP11",
        input: { opsYear: 2026, operationsMonth: 11 }, options: { signal },
      },
    ])
  })

  test("closed input rejects unknown keys, unknown actions and invalid months", () => {
    const action = SfOperations.operations["domain.command.CAP12.save-action"].input
    expect(valid(action, { version: 0, values: { text: "Rotate key", done: false } })).toBe(true)
    expect(valid(action, { version: 0, values: { text: "Rotate key", secret: "x" } })).toBe(false)
    expect(valid(action, { version: 0, values: { text: "Rotate key" }, action: "delete-kpi" })).toBe(false)
    expect(valid(action, { version: -1, values: { text: "Rotate key" } })).toBe(false)
    expect(valid(SfDomainPageCap11.input, { opsYear: 2026, operationsMonth: 13 })).toBe(false)
    expect(valid(SfDomainPageCap12.input, { opsYear: 2026 })).toBe(false)
  })

  test("monthly operations values: dynamic source keyspace, zero, CAS and explicit import confirmation", () => {
    const ticket = SfOperations.operations["domain.command.CAP11.save-tickets"].input
    expect(valid(ticket, { version: 3, values: {
      year: 2026, month: 11, "IT Security|Incidents|Open": 0,
    } })).toBe(true)
    expect(valid(ticket, { version: 3, values: {
      year: 2026, month: 11, "Other key": 10,
    } })).toBe(false)
    expect(valid(ticket, { version: 3, values: {
      year: 2026, month: 11, "IT Security|Incidents|Open": -1,
    } })).toBe(false)
    const imported = SfOperations.operations["domain.command.CAP11.import-month"].input
    const values = {
      year: 2026, month: 11, tickets: { "IT Security|Incidents|Closed": 0 },
      categoriesVersion: 3, itemsVersion: 1,
    }
    expect(valid(imported, { version: 9, confirmed: true, values })).toBe(true)
    expect(valid(imported, { version: 9, confirmed: false, values })).toBe(false)
    expect(valid(imported, { version: 9, values })).toBe(false)
    const list = SfOperations.operations["domain.command.CAP11.save-categories"].input
    expect(valid(list, { version: 0, values: { names: ["IT Security", "Operations"] } })).toBe(true)
    expect(valid(list, { version: 0, values: { names: ["same", "same"] } })).toBe(false)
    expect(valid(list, { version: 0, values: { names: ["a|b"] } })).toBe(false)
  })

  test("security validators keep source lists, dates, nonnegative counts and destructive ID", () => {
    const incident = SfOperations.operations["domain.command.CAP12.save-incident"].input
    expect(valid(incident, { version: 0, values: {
      title: "Incident", date: "2026-11-15",
      consequences: ["Data loss"], contained: false,
    } })).toBe(true)
    expect(valid(incident, { version: 0, values: {
      title: "Incident", date: "2026-02-30",
    } })).toBe(false)
    expect(valid(incident, { version: 0, values: {
      title: "Incident", date: "2026-11-15", consequences: ["Not in source"],
    } })).toBe(false)
    const campaign = SfOperations.operations["domain.command.CAP12.save-campaign"].input
    expect(valid(campaign, { version: 0, values: {
      name: "Phishing", targeted: 0,
      departments: [{ name: "IT", users: 0, failed: 0 }],
    } })).toBe(true)
    expect(valid(campaign, { version: 0, values: { name: "Phishing", targeted: -1 } })).toBe(false)
    const del = SfOperations.operations["domain.command.CAP12.delete-incident"].input
    expect(valid(del, { id: "incident-1", version: 2, values: {} })).toBe(true)
    expect(valid(del, { version: 2, values: {} })).toBe(false)
  })

  test("legacy result stays original safeFailure, never an invented PortResult", () => {
    const output = SfOperations.operations["domain.command.CAP12.delete-incident"].output
    expect(valid(output, { ok: true, warnings: [] })).toBe(true)
    expect(valid(output, { ok: false, status: 409, stored: null, currentVersionCAS: 0 })).toBe(true)
    expect(valid(output, { status: "ok", value: { id: "privileged" } })).toBe(false)
  })

  test("CAP11 output preserves absent/null/zero; does not echo privileged snapshot", () => {
    const source = {
      opsTickets: [
        { id: "2026-11", year: 2026, month: 11,
          "IT Security|Incidents|Open": 0,
          "IT Security|Incidents|Closed": 3,
          secret: "never" },
        { id: "2025-11", year: 2025, month: 11,
          "IT Security|Incidents|Open": 100 },
      ],
      opsSLA: null,
      opsHmItems: ["SAP TOM"],
      opsHeatmap: [{ id: "2026-11:SAP TOM", year: 2026, month: 11,
        item: "SAP TOM", p1: 0, p2: 0, tickets: 0, secret: "hidden" }],
      audit: ["never"], roles: ["never"], versions: { private: true },
    }
    const data = projectSfOperationsData("CAP11", source, 2026, 11)
    if (!("opsTickets" in data)) throw new Error("CAP11 projection not selected")
    expect("opsTickets" in data).toBe(true)
    expect("opsSLA" in data && data.opsSLA).toBeNull()
    expect("opsCats" in data).toBe(false)
    expect(data.display.opened[10]).toBe(0)
    expect(data.display.closed[10]).toBe(3)
    expect(JSON.stringify(data)).not.toContain("secret")
    expect(JSON.stringify(data)).not.toContain("audit")
    expect(JSON.stringify(data)).not.toContain("roles")
    expect(JSON.stringify(data)).not.toContain("never")
    const versions = projectSfOperationsVersions("CAP11", {
      "ops:2026-11": { version: 4, by: "private-user" },
      "ops-list:opsCats": { version: 0, by: "private-user" },
      "secActions:secret": { version: 5, by: "private" },
      "dataset": { version: 9, by: "private" },
    }, data, 2026, 11)
    expect(versions).toEqual({ "ops:2026-11": 4, "ops-list:opsCats": 0 })
    expect(JSON.stringify(versions)).not.toContain("private")
    expect(valid(SfDomainPageCap11.output, {
      status: "ok", context: stamp,
      value: { capabilityId: "CAP11", selection: { year: 2026, month: 11 },
        data, versions, allowedActionIds: ["save-tickets"] },
    })).toBe(true)
  })

  test("CAP12 current action/campaign scope is not mislabeled historical", () => {
    const data = projectSfOperationsData("CAP12", {
      secKpi: [
        { id: "2026-11", year: 2026, month: 11, socPending: 0 },
        { id: "2025-11", year: 2025, month: 11, socPending: 5 },
      ],
      secActions: [{ id: "a1", text: "Patch", done: false, credential: "hidden" }],
      secIncidents: [
        { id: "i1", title: "Outage", date: "2026-11-15",
          contained: true, remediated: false, rootCause: false, leaked: "hidden" },
        { id: "i2", title: "Old", date: "2025-10-01" },
      ],
      secPhishing: [{ id: "p1", name: "Test", targeted: 0, clicked: 0,
        departments: [{ name: "IT", users: 0, failed: 0, token: "hidden" }],
        privateConfig: "hidden" }],
    }, 2026, 11)
    if (!("secActions" in data)) throw new Error("CAP12 projection not selected")
    expect("secActions" in data && data.secActions?.length).toBe(1)
    expect("secIncidents" in data && data.secIncidents?.length).toBe(1)
    expect(data.display.campaigns[0]?.failureRate).toBeNull()
    expect(data.display.openIncidents).toBe(1)
    expect(JSON.stringify(data)).not.toContain("hidden")
    const versions = projectSfOperationsVersions("CAP12", {
      "security:2026-11": { version: 0, by: "internal" },
      "secActions:a1": { version: 2, by: "internal" },
      "secIncidents:i1": { version: 3, by: "internal" },
      "secIncidents:i2": { version: 4, by: "internal" },
      "secPhishing:p1": { version: 5, by: "internal" },
      "access": { version: 100, by: "internal" },
    }, data, 2026, 11)
    expect(versions).toEqual({
      "security:2026-11": 0, "secActions:a1": 2,
      "secIncidents:i1": 3, "secPhishing:p1": 5,
    })
    expect(valid(SfDomainPageCap12.output, {
      status: "ok", context: stamp,
      value: { capabilityId: "CAP12", selection: { year: 2026, month: 11 },
        data, versions, allowedActionIds: [] },
    })).toBe(true)
  })

  test("source corruption blocks projection instead of fabricating an empty success", () => {
    expect(() => projectSfOperationsData("CAP11", { opsTickets: "corrupt" }, 2026, 11)).toThrow()
    expect(() => projectSfOperationsData("CAP11", { opsSLA: [null] }, 2026, 11)).toThrow()
    expect(() => projectSfOperationsData("CAP12", { secActions: { id: "bad" } }, 2026, 11)).toThrow()
    expect(projectSfOperationsData("CAP12", {}, 2026, 11)).not.toHaveProperty("secActions")
    expect(projectSfOperationsData("CAP12", { secActions: [] }, 2026, 11)).toHaveProperty("secActions", [])
  })
})
