import { expect, test } from "bun:test"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"
import { quoteComparisonPresentation } from "../../../src/form.ts"
import { digestSfEvidenceRef } from "../../../product/contracts/canonical.ts"
import type { ProductContext } from "../../../product/contracts/context.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import type { ProcurementSourceHost } from "../../../product/procurement/port.ts"
import { digestProcurementSource } from "../../../product/procurement/sources.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { domain, render } from "../../../runtime/procurement.ts"
import type { Snapshot } from "../../../runtime/contract.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const context: ProductContext = {
  installationId: "i",
  projectId: "p",
  principalRef: "a",
  accessRevision: "1",
  policyVersion: "1",
  surface: "procurement",
  period,
  currency: "USD",
  sourceRefs: [],
  capabilities: [],
}
const actor = { id: "a", roles: ["buyer"], canWrite: true }
const renderContext = { actor, year: 2026, month: 1, at: "2026-01-01T00:00:00Z", versions: {} }
const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "a", accessRevision: "1", policyVersion: "1", requestId: "r", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext

function fixture(sourcing: Record<string, unknown>, settings = initialProcurementSettings()) {
  const request = { number: "PR-1", status: "src_pending", createdBy: "a", sourcing }
  const snapshot: Snapshot = {
    data: { store: { requests: { "PR-1": { request, version: 4, by: "a" } }, settings, suppliers: [] } },
    versions: { "requests:PR-1": { version: 4, by: "a" } },
    sequences: {},
    audit: [],
    notices: [],
  }
  const view = domain.view(snapshot, actor, { at: renderContext.at, directory: [], id: () => "unused" }).data
  const projectedRequest = (view.requests as Record<string, unknown>[]).find((item) => item.number === "PR-1")!
  const baseRef: Extract<BusinessEvidenceRef, { kind: "record" }> = {
    schema: "sf-evidence-v1",
    refId: "r",
    installationId: "i",
    projectId: "p",
    refDigest: "pending",
    evidenceLevel: "observed",
    kind: "record",
    target: {
      surface: "procurement",
      recordType: "procurement-request",
      recordId: "PR-1",
      incarnation: "one",
      version: 4,
      fields: ["sourcing"],
      projectionDigest: digestProcurementSource(projectedRequest, view.formSettings),
    },
  }
  const evidence = { ...baseRef, refDigest: digestSfEvidenceRef(baseRef) }
  const sourceHost = {
    requestFor: () => new Request("https://local.invalid/procurement"),
    revalidate: async () => true,
    environment: async () => ({ at: renderContext.at, directory: [], id: () => "unused" }),
    authenticate: async () => ({ id: "a", canWrite: true, roles: [{ surface: "procurement" as const, role: "buyer" }] }),
    persistence: { transaction: async (_surface, work) => (await work(structuredClone(snapshot))).value },
    resolveRequestSource: async () => ({ status: "ok" as const, value: { evidence, context } }),
    isCurrentRequestSource: () => true,
    resolveRequestCollection: async () => ({ status: "unavailable" as const, reason: "not used" }),
    isCurrentRequestCollection: () => false,
    resolveSupplierSource: async () => ({ status: "unavailable" as const, reason: "not used" }),
    isCurrentSupplierSource: () => false,
    readContractSource: async () => ({ status: "unavailable" as const, reason: "not used" }),
  } satisfies ProcurementSourceHost
  return { request, snapshot, settings, view, sourceHost, port: createProcurementPort(sourceHost) }
}

function quotes(): { id: string; supplier: string; total: number; currency: string; qty: number; unitPrice: number; techPass: boolean; scores: (number | null)[]; cscores: (number | null)[] }[] {
  return [
    { id: "A", supplier: "A", total: 32400, currency: "USD", qty: 1, unitPrice: 32400, techPass: true, scores: [5, 4, 4, 4, 4], cscores: [null, 4, 4] },
    { id: "B", supplier: "B", total: 28000, currency: "EUR", qty: 1, unitPrice: 28000, techPass: true, scores: [4, 4, 4, 3, 4], cscores: [null, 5, 4] },
  ]
}

test("producer with missing submitted FX suppresses every score and rank despite a current rate", async () => {
  const sourcing = { approvalBaseCurrency: "USD", fxSnapshot: null, quotes: quotes() }
  const currentSettings = initialProcurementSettings()
  currentSettings.fxRates = [{ code: "EUR", rate: 2 }]
  const { port } = fixture(sourcing, currentSettings)
  const result = await port.compareSourcing({ requestRef: "r", proposalRefs: ["A", "B"], criteria: [] }, binding)

  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.ranking).toEqual([])
  expect(result.value.proposals.every((proposal) => proposal.score === null)).toBe(true)
  expect(result.value.proposals.find((proposal) => proposal.proposalRef === "B")?.convertedAmount).toBeNull()
  expect(result.value.conditions).toContainEqual(expect.objectContaining({ id: "monetary-comparison-unavailable" }))
})

test("producer with absent weights or incomplete human assessments withholds ranking", async () => {
  const noWeights = fixture({ approvalBaseCurrency: "USD", fxSnapshot: { USD: 1, EUR: 1.08 }, weights: { tech: 60, comm: 40, criteria: [], commCriteria: [] }, quotes: quotes() })
  const withoutWeights = await noWeights.port.compareSourcing({ requestRef: "r", proposalRefs: ["A", "B"], criteria: [] }, binding)
  expect(withoutWeights.status).toBe("ok")
  if (withoutWeights.status === "ok") {
    expect(withoutWeights.value.ranking).toEqual([])
    expect(withoutWeights.value.proposals.every((proposal) => proposal.score === null)).toBe(true)
    expect(withoutWeights.value.proposals.some((proposal) => proposal.issues.includes("Evaluation criteria unavailable"))).toBe(true)
  }

  const incompleteQuotes = quotes()
  incompleteQuotes[1]!.scores[4] = null
  const incomplete = fixture({ approvalBaseCurrency: "USD", fxSnapshot: { USD: 1, EUR: 1.08 }, quotes: incompleteQuotes })
  const withoutRequiredScore = await incomplete.port.compareSourcing({ requestRef: "r", proposalRefs: ["A", "B"], criteria: [] }, binding)
  expect(withoutRequiredScore.status).toBe("ok")
  if (withoutRequiredScore.status !== "ok") return
  expect(withoutRequiredScore.value.ranking).toEqual([])
  expect(withoutRequiredScore.value.proposals.every((proposal) => proposal.score === null)).toBe(true)
  expect(withoutRequiredScore.value.conditions).toContainEqual(expect.objectContaining({ id: "incomplete-scores" }))
})

test("a stated total mismatch in one proposal suppresses the whole producer ranking", async () => {
  const mismatchedQuotes = quotes()
  mismatchedQuotes[1]!.qty = 2
  const source = fixture({ approvalBaseCurrency: "USD", fxSnapshot: { USD: 1, EUR: 1.08 }, quotes: mismatchedQuotes })
  const { port } = source
  const result = await port.compareSourcing({ requestRef: "r", proposalRefs: ["A", "B"], criteria: [] }, binding)
  const html = render("Requests", { requests: [source.request], formSettings: source.settings }, renderContext)!

  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.ranking).toEqual([])
  expect(result.value.proposals.every((proposal) => proposal.score === null)).toBe(true)
  expect(result.value.proposals.find((proposal) => proposal.proposalRef === "B")?.convertedAmount).toBeCloseTo(30240, 6)
  expect(result.value.proposals.find((proposal) => proposal.proposalRef === "B")?.issues).toContain("Stated total differs from quantity times unit price")
  expect(html).toContain("Comparison ranking unavailable")
  expect(html).toContain("56000 EUR (differs)")
})

test("runtime and producer present the same submitted quote amount and FX source", async () => {
  const sourcing = { approvalBaseCurrency: "USD", fxSnapshot: { USD: 1, EUR: 1.08 }, selectedId: "A", selectionJustification: "Best technical fit", quotes: quotes() }
  const currentSettings = initialProcurementSettings()
  currentSettings.fxRates = [{ code: "EUR", rate: 2 }]
  const { port, request, settings } = fixture(sourcing, currentSettings)
  const comparison = await port.compareSourcing({ requestRef: "r", proposalRefs: ["A", "B"], criteria: [] }, binding)
  const presentation = quoteComparisonPresentation({ sourcing: sourcing as Parameters<typeof quoteComparisonPresentation>[0]["sourcing"] }, { ...settings, currency: "USD" }, { submitted: true, submittedBaseCurrency: "USD" })
  const html = render("Requests", { requests: [request], formSettings: settings }, renderContext)!

  expect(comparison.status).toBe("ok")
  if (comparison.status !== "ok") return
  const row = presentation.find((item) => item.id === "B")!
  const proposal = comparison.value.proposals.find((item) => item.proposalRef === "B")!
  if (row.total == null || row.fxRate == null || proposal.convertedAmount == null) throw new Error("comparison amount unavailable")
  expect(proposal.convertedAmount).toBe(row.total * row.fxRate)
  expect(row.fxRate).toBe(1.08)
  expect(proposal.convertedAmount).toBeCloseTo(30240, 6)
  expect(html).toContain("30240 USD (submitted FX: 1.08)")
  expect(html).not.toContain("56000 USD (current FX: 2)")
  expect(html).toContain("Best technical fit")
})
