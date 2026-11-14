import { expect, test } from "bun:test"
import type { AuthorizedCaseProjection, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { CostCoverageBasis } from "../../../product/contracts/decisions.ts"
import { decisionAlternativesForm, decisionAlternativesScript, decisionFormContext } from "../../../product/ui/decision-alternatives.ts"
import { decisionEditForm, decisionEditScript } from "../../../product/ui/decision-edit.ts"

test("the emitted browser initializers parse after the intention helper is serialized", () => {
  // Parsing catches malformed embedded JavaScript; it does not execute a simulated UI.
  const parser = new Bun.Transpiler({ loader: "js" })
  expect(() => parser.transformSync(decisionEditScript)).not.toThrow()
  expect(() => parser.transformSync(decisionAlternativesScript)).not.toThrow()
})

test("decision form context binds identity, current CAS, authority, currency and source horizons", () => {
  const input = projection()
  const context = decisionFormContext(input)
  expect(context.scope).toBe('["installation-one","project-one","principal-one","case:one","inc/one"]')
  expect(context.caseSelector).toBe("case:case%3Aone:inc%2Fone")
  expect(context.caseRef).toEqual({ id: "case:one", incarnation: "inc/one", version: 7 })
  expect(context.authority).toEqual({ kind: "ui", installationId: "installation-one", projectId: "project-one", principalRef: "principal-one", policyVersion: "policy-3", accessRevision: "access-5" })
  expect(context.horizon).toEqual({ start: "2027-01-01", end: "2027-12-31" })
  expect(context.currency).toBe("USD")
  expect(context.sourceRefs).toEqual(input.case.sourceRefs)
  expect(context.sourceRefs.map((ref) => ref.kind === "record" ? ref.target.version : undefined)).toEqual([4, 8])
})

test("retry scope survives a newer case revision while another principal or incarnation has a different scope", () => {
  const input = projection()
  const original = decisionFormContext(input)
  const newer = decisionFormContext({ ...input, case: { ...input.case, version: 8 } })
  expect(newer.scope).toBe(original.scope)
  expect(newer.caseRef.version).toBe(8)
  expect(decisionFormContext({ ...input, case: { ...input.case, incarnation: "replacement" } }).scope).not.toBe(original.scope)
  expect(decisionFormContext({ ...input, context: { ...input.context, principalRef: "another-principal" } }).scope).not.toBe(original.scope)
  expect(decisionFormContext({ ...input, context: { ...input.context, installationId: "another-installation" } }).scope).not.toBe(original.scope)
})

test("initial alternatives expose the complete supported inventory and reject incomplete or foreign inventories", () => {
  const input = projection()
  const complete = input.case.costCoverageBases[0]!
  const rendered = decisionAlternativesForm({ ...input, case: { ...input.case, costCoverageBases: [
    complete,
    { ...complete, id: "incomplete-inventory", categoryIds: complete.categoryIds.filter((category) => category !== "training") },
    { ...complete, id: "unknown-inventory", decisionType: "unsupported-inventory" },
  ] } })
  const context = embeddedContext(rendered)
  expect(context.categories).toEqual([
    "service", "service_overlap", "implementation", "contract_exit", "migration", "taxes", "training", "internal_costs", "other_relevant_costs",
  ])
  expect(context.bases).toEqual([complete])
  expect(context.bases[0]?.additionalCategoryIds).toEqual(["regulatory_review"])
  expect(context.bases[0]?.sourceRefs).toEqual(input.case.sourceRefs)
  expect(rendered).not.toContain("incomplete-inventory")
  expect(rendered).not.toContain("unknown-inventory")
  expect(rendered).toContain('type="submit" disabled>Create alternative')
  expect(rendered).toContain("neither changes the official plan nor approves a purchase")
})

test("rendering keeps an empty case empty and does not create financial inputs or mutate authorized evidence", () => {
  const input = projection()
  const before = structuredClone(input)
  const alternatives = decisionAlternativesForm(input)
  const edit = decisionEditForm(input)
  expect(input).toEqual(before)
  expect(input.case.alternatives).toHaveLength(0)
  expect(embeddedContext(alternatives).sourceRefs).toEqual(before.case.sourceRefs)
  expect(embeddedContext(edit).sourceRefs).toEqual(before.case.sourceRefs)
  expect(alternatives).not.toContain('type="number"')
  expect(alternatives).not.toContain('name="amount"')
  expect(alternatives).not.toContain('name="total"')
  expect(edit).not.toContain('name="sourceRefs"')
  expect(edit).toContain("Inspect selected source")
  expect(edit).toContain("Attach source to draft")
})

test("case objective, criterion and reference text cannot break out of their rendered elements", () => {
  const input = projection()
  const title = '<img src=x onerror="alert(1)">'
  const reference = input.case.sourceRefs[0]!
  if (reference.kind !== "record") throw new Error("fixture-record-required")
  const item = { ...input, case: { ...input.case, objective: title,
    criteria: [{ id: "cost", description: '<script>alert("criterion")</script>', required: true }],
    sourceRefs: [{ ...reference, target: { ...reference.target, recordId: title } }],
  } }
  const html = decisionEditForm(item)
  expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;")
  expect(html).toContain("&lt;script&gt;alert(&quot;criterion&quot;)&lt;/script&gt;")
  expect(html).not.toContain("<img src=x")
  expect(html).not.toContain("<script>alert")
  expect(embeddedContext(html).sourceRefs).toEqual(item.case.sourceRefs)
})

function projection(): AuthorizedCaseProjection {
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const source: BusinessEvidenceRef = {
    schema: "sf-evidence-v1", kind: "record", refId: "source-one", installationId: "installation-one", projectId: "project-one",
    refDigest: "a".repeat(64), evidenceLevel: "observed",
    target: { surface: "planner", recordType: "planner-version", recordId: "version-one", incarnation: "source-inc-one", version: 4,
      fields: ["amount", "currency"], period: horizon, projectionDigest: "b".repeat(64) },
  }
  const second: BusinessEvidenceRef = { ...source, refId: "source-two", refDigest: "c".repeat(64),
    target: { ...source.target, recordId: "version-two", incarnation: "source-inc-two", version: 8, projectionDigest: "d".repeat(64) } }
  const sourceRefs = [source, second]
  return {
    context: { kind: "ui", installationId: "installation-one", projectId: "project-one", principalRef: "principal-one", policyVersion: "policy-3", accessRevision: "access-5" },
    case: {
      id: "case:one", incarnation: "inc/one", version: 7, state: "draft", objective: "Compare the two authorized Planner versions",
      horizon, currency: "USD", criteria: [{ id: "cost", description: "Total cost", required: true }], participants: ["principal-one"], sourceRefs,
      alternatives: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [],
      costCoverageBases: [{ id: "coverage-basis", version: 3, decisionType: "renewal-transition-v1", sourceRefs,
        categoryIds: ["service", "service_overlap", "implementation", "contract_exit", "migration", "taxes", "training", "internal_costs", "other_relevant_costs"],
        additionalCategoryIds: ["regulatory_review"] }],
    },
    evidenceRefs: sourceRefs, events: [], checkedAt: "2026-11-14T21:00:00Z",
  }
}

function embeddedContext(html: string) {
  const value = html.match(/data-context="([^"]+)"/)?.[1]
  if (!value) throw new Error("rendered-context-missing")
  return JSON.parse(value.replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&")) as ReturnType<typeof decisionFormContext> & {
    bases: readonly CostCoverageBasis[]
    categories: readonly string[]
  }
}
