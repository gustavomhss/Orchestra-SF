import { expect, test } from "bun:test"
import { bindStoredPortfolioBiPort } from "../../../product/analytics/portfolio.ts"
import type { PortfolioBiBundle } from "../../../product/analytics/portfolio.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiLease } from "../../../product/contracts/sf-execution.ts"

type Project = (projection: DomainProjection, context: TrustedDomainContext) => Promise<PortResult<PortfolioBiBundle>>

// Adapter-only fixture: supplied observations exercise the binding boundary. It
// does not claim real host admission, persistence or financial calculation.
function fixture(project?: Project) {
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const source: { current: DomainProjection } = { current: {
    context: { installationId: "i", projectId: "p", principalRef: "finance", policyVersion: "1", accessRevision: "a", surface: "planner", period, currency: "USD", capabilities: [], sourceRefs: [{ surface: "planner", type: "planner-version", id: "forecast", incarnation: "forecast-inc", version: 2, fields: ["cost"], period, observedAt: "2027-01-01T00:00:00Z" }] },
    version: 2, engineVersion: "planner-v1", values: [], components: [],
    decision: { kind: "portfolio", portfolioResultRef: "portfolio-ref", portfolio: { combinations: [], evidenceRefs: [], limitations: ["external-operation-cost-unresolved"] } },
    missing: [{ field: "portfolio:unresolved:analysis", reason: "unavailable" }],
  } }
  const context = { kind: "ui" as const, lease: {} as TrustedUiLease, binding: { installationId: "i", projectId: "p", principalRef: "finance", requestId: "request", policyVersion: "1", accessRevision: "a", expiresAt: "2030-01-01T00:00:00Z" } }
  const request = { viewId: "BI09", selectionRef: "selection", period }
  const calls = { read: 0, present: 0 }
  const input: Parameters<typeof bindStoredPortfolioBiPort>[0] = {
    readProjection: async (selection) => {
      calls.read++
      return selection.selectionRef === request.selectionRef && selection.portfolioResultRef === "portfolio-ref"
        ? { status: "ok", value: source.current } : { status: "denied", reason: "selection-unavailable" }
    },
    resolve: async () => ({ status: "ok", value: { portfolioResultRef: "portfolio-ref", present: () => {
      calls.present++
      return { viewId: "BI09", series: [], limitations: ["legacy-table"] }
    }, ...(project ? { project } : {}) } }),
    revalidate: async () => true,
  }
  return { source, context, request, calls, input, host: bindStoredPortfolioBiPort(input) }
}

function bundle(projection: DomainProjection): PortfolioBiBundle {
  return {
    projection: { ...projection, components: [{ id: "producer-zero", amount: 0, currency: "USD", period: projection.context.period, sourceRefs: projection.context.sourceRefs, evidenceState: "confirmed" }], values: [{ id: "producer-zero", value: 0, currency: "USD", unit: "money", period: projection.context.period, granularity: "aggregate", sourceRefs: [], drilldown: null, evidenceState: "confirmed" }] },
    presentation: { viewId: "BI09", series: [{ id: "producer-cost", label: "Supplied producer observation", role: "cost", unit: "USD", valueIds: ["producer-zero"] }], limitations: ["external-operation-cost-unresolved"] },
  }
}

test("portfolio projection seam preserves the original envelope and isolates callback output", async () => {
  const retained: { value?: PortfolioBiBundle; input?: DomainProjection } = {}
  const f = fixture(async (projection, context) => {
    expect(context).toBe(f.context)
    retained.input = projection
    retained.value = bundle(projection)
    return { status: "ok", value: retained.value }
  })
  const original = structuredClone(f.source.current)
  const result = await f.host.readView(f.request, f.context)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  expect(f.calls).toEqual({ read: 2, present: 0 })
  expect(result.value.projection.decision).toEqual(original.decision)
  expect(result.value.projection.missing).toEqual(original.missing)
  expect(result.value.projection.context).toEqual(original.context)
  expect(result.value.projection.values).toEqual(bundle(original).projection.values)
  expect(f.source.current).toEqual(original)
  expect(retained.input).not.toBe(f.source.current)
  retained.value!.projection.values = []
  retained.value!.presentation.limitations = []
  expect(result.value.projection.values).toHaveLength(1)
  expect(result.value.presentation.limitations).toEqual(["external-operation-cost-unresolved"])
})

test("portfolio projection seam keeps the existing presentation path when project is absent", async () => {
  const f = fixture()
  expect(await f.host.readView(f.request, f.context)).toEqual({ status: "ok", value: { projection: f.source.current, presentation: { viewId: "BI09", series: [], limitations: ["legacy-table"] } } })
  expect(f.calls).toEqual({ read: 1, present: 1 })
})

test("portfolio projection seam withholds an input-mutating projector", async () => {
  const f = fixture(async (projection) => {
    projection.missing = []
    return { status: "ok", value: bundle(projection) }
  })
  const original = structuredClone(f.source.current)
  expect(await f.host.readView(f.request, f.context)).toEqual({ status: "stale", reason: "projection-changed-by-projector" })
  expect(f.source.current).toEqual(original)
  expect(f.calls.read).toBe(1)
})

const alteredEnvelopes: [string, (projection: DomainProjection) => DomainProjection][] = [
  ["currency", (projection) => ({ ...projection, context: { ...projection.context, currency: "EUR" } })],
  ["horizon", (projection) => ({ ...projection, context: { ...projection.context, period: { start: "2026-01-01", end: "2026-12-31" } } })],
  ["scope", (projection) => ({ ...projection, context: { ...projection.context, projectId: "foreign-project" } })],
  ["version", (projection) => ({ ...projection, version: projection.version + 1 })],
  ["engine", (projection) => ({ ...projection, engineVersion: "other-engine" })],
  ["persisted result", (projection) => ({ ...projection, decision: { kind: "portfolio", portfolioResultRef: "forged-result", portfolio: { combinations: [], evidenceRefs: [], limitations: [] } } })],
  ["missing costs", (projection) => ({ ...projection, missing: [] })],
]

for (const [label, change] of alteredEnvelopes) test(`portfolio projection seam refuses changed ${label}`, async () => {
  const f = fixture(async (projection) => ({ status: "ok", value: bundle(change(projection)) }))
  expect(await f.host.readView(f.request, f.context)).toEqual({ status: "stale", reason: "portfolio-projection-envelope-changed" })
  expect(f.calls.read).toBe(1)
})

test("portfolio projection seam refuses a presentation for a different BI view", async () => {
  const f = fixture(async (projection) => ({ status: "ok", value: { ...bundle(projection), presentation: { viewId: "BI10", series: [], limitations: [] } } }))
  expect(await f.host.readView(f.request, f.context)).toEqual({ status: "unavailable", reason: "view-mismatch" })
})

test("portfolio projection seam rereads and refuses a changed original source", async () => {
  const f = fixture(async (projection) => {
    f.source.current = { ...f.source.current, engineVersion: "changed-while-projecting" }
    return { status: "ok", value: bundle(projection) }
  })
  expect(await f.host.readView(f.request, f.context)).toEqual({ status: "stale", reason: "portfolio-source-changed-during-projection" })
  expect(f.calls.read).toBe(2)
})

test("portfolio projection seam treats reread observation time as non-material", async () => {
  const f = fixture(async (projection) => {
    f.source.current = { ...f.source.current, context: { ...f.source.current.context, sourceRefs: f.source.current.context.sourceRefs.map((source) => ({ ...source, observedAt: "2027-01-02T00:00:00Z" })) } }
    return { status: "ok", value: bundle(projection) }
  })
  const result = await f.host.readView(f.request, f.context)
  expect(result.status).toBe("ok")
  expect(f.calls.read).toBe(2)
})

test("portfolio projection seam propagates source revocation on the final read without a result", async () => {
  const f = fixture(async (projection) => ({ status: "ok", value: bundle(projection) }))
  f.input.readProjection = async () => ++f.calls.read === 1 ? { status: "ok", value: f.source.current } : { status: "denied", reason: "source-revoked" }
  expect(await f.host.readView(f.request, f.context)).toEqual({ status: "denied", reason: "source-revoked" })
  expect(f.calls.read).toBe(2)
})

test("portfolio projection seam pins the original reader across the projector await", async () => {
  const replacement = { reads: 0 }
  const f = fixture(async (projection) => {
    f.source.current = { ...f.source.current, version: 3 }
    f.input.readProjection = async () => {
      replacement.reads++
      return { status: "ok", value: projection }
    }
    return { status: "ok", value: bundle(projection) }
  })
  expect(await f.host.readView(f.request, f.context)).toEqual({ status: "stale", reason: "portfolio-source-changed-during-projection" })
  expect(f.calls.read).toBe(2)
  expect(replacement.reads).toBe(0)
})

test("portfolio projection seam refuses a request changed while its callback was awaited", async () => {
  const f = fixture(async (projection) => {
    await Promise.resolve()
    f.request.selectionRef = "different-selection"
    return { status: "ok", value: bundle(projection) }
  })
  expect(await f.host.readView(f.request, f.context)).toEqual({ status: "stale", reason: "selection-changed" })
})

test("portfolio projection seam refuses a binding changed by the projector", async () => {
  const f = fixture(async (projection) => {
    f.context.binding.accessRevision = "revoked"
    return { status: "ok", value: bundle(projection) }
  })
  expect(await f.host.readView(f.request, f.context)).toEqual({ status: "denied", reason: "portfolio-projection-authority-changed" })
})
