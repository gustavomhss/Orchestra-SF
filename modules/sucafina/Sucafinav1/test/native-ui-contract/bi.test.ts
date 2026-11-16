import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { SfBi } from "../../../../../packages/schema/src/sucafina/bi.ts"
import { createSfBiClient } from "../../../../../packages/client/src/sucafina/bi.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const signal = new AbortController().signal
const options = { signal }

function clientWithTrace() {
  const calls: { operationId: string; input: unknown; signal: AbortSignal }[] = []
  const transport: Parameters<typeof createSfBiClient>[0] = {
    async execute(operation, input, call) {
      calls.push({ operationId: operation.operationId, input, signal: call.signal })
      return { kind: "transport-error", reason: "network" }
    },
  }
  return { client: createSfBiClient(transport), calls }
}

// Contract fixtures are not identity/auth simulations. They verify only the
// exact PUBLIC JSON wire shape; the producer retains admission and revalidation.
describe("A08 — source-faithful BI schemas", () => {
  test("preserves 0, null, source versions, omissions and redaction reasons", () => {
    const projection = {
      context: {
        installationId: "installation-1", projectId: "project-1", principalRef: "principal-1",
        accessRevision: "rev-3", policyVersion: "policy-2", surface: "dashboard",
        period, currency: "USD",
        sourceRefs: [{
          surface: "dashboard", type: "budget", id: "record-1", incarnation: "inc-2",
          version: 0, fields: ["known", "hidden"], period, observedAt: "2026-11-15T12:00:00Z",
        }],
        capabilities: ["sf_bi_view"],
      },
      version: 0,
      engineVersion: "engine-1",
      components: [{ id: "component-1", amount: 0, currency: "USD", period, sourceRefs: [], evidenceState: "confirmed" }],
      values: [
        { id: "known", value: 0, period, granularity: "aggregate", sourceRefs: [], drilldown: null, evidenceState: "confirmed" },
        { id: "absent", value: null, period, granularity: "aggregate", sourceRefs: [], drilldown: null, evidenceState: "absent" },
      ],
      missing: [{ field: "hidden", reason: "restricted" }],
    }
    const body = {
      request: { viewId: "BI01", selectionRef: "authorized-selection", period },
      projection,
      presentation: {
        viewId: "BI01", series: [{
          id: "budget", label: "Budget", unit: "USD", role: "budget", valueIds: ["known", "absent"],
        }], limitations: ["Source restriction"],
      },
      receipt: {
        kind: "ui", operation: "sf_bi_view", handlerExport: "bi",
        inputDigest: "preserved-digest", principalRef: "principal-1", callId: "call-1",
        accessRevision: "rev-3", at: "2026-11-15T12:00:00Z", requestId: "request-1",
      },
    }
    const decoded = Schema.decodeUnknownSync(Schema.toEncoded(SfBi.operations["bi.bi-data"].output))(body)
    expect(decoded).toMatchObject(body)
    if (!("projection" in decoded)) throw new Error("expected producer BI data output")
    expect(decoded.projection.version).toBe(0)
    expect(decoded.projection.context.sourceRefs[0]?.version).toBe(0)
    expect(decoded.projection.values[0]?.value).toBe(0)
    expect(decoded.projection.values[1]?.value).toBeNull()
    expect(decoded.projection.components[0]?.amount).toBe(0)
    expect(decoded.projection.missing).toEqual([{ field: "hidden", reason: "restricted" }])
    expect("navigation" in decoded).toBe(false)
    expect("comparison" in decoded.projection).toBe(false)
  })

  test("keeps each installed producer's distinct success envelope", () => {
    const source = Schema.decodeUnknownSync(SfBi.operations["bi.bi-source"].output)({
      links: [{ label: "Original record v0", url: "/installation/dashboard?page=Budget" }],
    })
    expect(source).toEqual({ links: [{ label: "Original record v0", url: "/installation/dashboard?page=Budget" }] })
    expect("status" in source).toBe(false)

    const decision = Schema.decodeUnknownSync(SfBi.operations["bi.bi-decision"].output)({
      status: "ok", value: {
        title: "Persisted result", reference: "result-ref",
        facts: [{ label: "Version", value: "0" }],
        tables: [{ title: "Values", columns: ["Known", "Unavailable"], rows: [["0", "Indisponível"]] }],
        links: [],
      },
    })
    expect(decision).toMatchObject({ status: "ok", value: { reference: "result-ref" } })

    const catalogue = Schema.decodeUnknownSync(SfBi.operations["bi.bi-options"].output)({
      status: "ok", value: {
        choices: [{ label: "Current case", selectionRef: "selected", caseRef: { id: "c", incarnation: "inc", version: 0 } }],
        versions: [{ ref: "v0", label: "Forecast r0", year: 2026 }],
        links: [{ label: "Planner", surface: "planner", page: "Versions" }],
        limitations: [],
      },
    })
    expect(catalogue).toMatchObject({ status: "ok", value: { versions: [{ ref: "v0" }] } })
  })

  test("closed view/digest inputs reject unknown decisions and source digests", () => {
    expect(() => Schema.decodeUnknownSync(SfBi.operations["bi.bi-decision"].input, { onExcessProperty: "error" })({
      viewId: "BI99", selectionRef: "ref", snapshot: "a".repeat(64), target: "b".repeat(64),
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(SfBi.operations["bi.bi-source"].input, { onExcessProperty: "error" })({
      selectionRef: "ref", valueId: "v", referenceDigest: "not-sha256",
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(SfBi.operations["bi.bi-data"].input, { onExcessProperty: "error" })({
      baseRef: "only-base", candidateRef: "candidate", currency: "USD", viewId: "BI11",
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(SfBi.operations["bi.bi-options"].input, { onExcessProperty: "error" })({
      viewId: "BI01", sf: "arbitrary-action",
    })).toThrow()
  })

  test("redaction/stale/denial remain explicit and never become empty BI values", () => {
    for (const key of ["bi.bi-data", "bi.bi-source", "bi.bi-decision", "bi.bi-options"] as const) {
      const denied = Schema.decodeUnknownSync(Schema.toEncoded(SfBi.operations[key].output))({ status: "denied", reason: "access-revoked" })
      const stale = Schema.decodeUnknownSync(Schema.toEncoded(SfBi.operations[key].output))({ status: "stale", reason: "source-changed" })
      expect(denied).toEqual({ status: "denied", reason: "access-revoked" })
      expect(stale).toEqual({ status: "stale", reason: "source-changed" })
    }
  })
})

describe("A08 — typed client operations", () => {
  test("preserves all four literal operation IDs, selection refs, digests and AbortSignal", async () => {
    const { client, calls } = clientWithTrace()
    const snapshot = "a".repeat(64)
    const target = "b".repeat(64)
    await client["bi.bi-data"]({ viewId: "BI01", selectionRef: "selection-v0", ...period }, options)
    await client["bi.bi-source"]({ selectionRef: "selection-v0", valueId: "zero", referenceDigest: snapshot, ...period }, options)
    await client["bi.bi-decision"]({ viewId: "BI09", selectionRef: "case-v3", snapshot, target, ...period }, options)
    await client["bi.bi-options"]({ viewId: "BI01", ...period }, options)
    expect(calls.map((call) => call.operationId)).toEqual([
      "bi.bi-data", "bi.bi-source", "bi.bi-decision", "bi.bi-options",
    ])
    expect(calls.every((call) => call.signal === signal)).toBe(true)
    expect(calls[0]?.input).toMatchObject({ selectionRef: "selection-v0", start: period.start, end: period.end })
    expect(calls[1]?.input).toMatchObject({ valueId: "zero", referenceDigest: snapshot })
    expect(calls[2]?.input).toMatchObject({ selectionRef: "case-v3", snapshot, target })
  })

  test("rejects extra route selectors and ambiguous comparison without transport", async () => {
    const { client, calls } = clientWithTrace()
    const unknown = { viewId: "BI01", sf: "bi-decision" } as unknown as Parameters<typeof client["bi.bi-options"]>[0]
    expect(await client["bi.bi-options"](unknown, options)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    const ambiguous = { selectionRef: "selection-v1", baseRef: "base", candidateRef: "candidate", currency: "USD" } as unknown as Parameters<typeof client["bi.bi-data"]>[0]
    expect(await client["bi.bi-data"](ambiguous, options)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    expect(calls).toHaveLength(0)
  })
})
