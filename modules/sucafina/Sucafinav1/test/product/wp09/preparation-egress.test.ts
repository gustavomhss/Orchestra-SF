import { expect, test } from "bun:test"
import { prepareFactualReview } from "../../../product/routines/review.ts"
import { prepareForecastReview } from "../../../product/routines/forecast.ts"
import { prepareSourcingDossier } from "../../../product/routines/dossier.ts"
import type { ConfirmationValidityProjection, DomainProjection } from "../../../product/contracts/context.ts"
import type { ForecastCompareRequest } from "../../../product/contracts/operations.ts"
import type { FinancialAnalysis } from "../../../product/contracts/ports.ts"
import type { CommercialComparison } from "../../../product/contracts/outputs.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { digestSfEvidenceRef } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"

const context = {} as TrustedDomainContext
const period = { start: "2027-01-01", end: "2027-01-31" }
const projection = { context: { period, sourceRefs: [{ observedAt: "2026-12-20T00:00:00Z" }] }, version: 8, values: [], components: [], missing: [] } as unknown as DomainProjection
const confirmation: ConfirmationValidityProjection = { confirmationId: "jan", state: "valid", scopeFingerprint: "jan-fingerprint", evaluatedSourceVersion: 8, evaluatedAt: "2027-01-03T00:00:00Z", reason: "unchanged-scope" }
const request = { baseRef: "baseline", candidateRef: "current", period, currency: "USD" } as ForecastCompareRequest
const comparison = { knownDifference: 12000, completeDifference: 12000, baseline: projection, candidate: projection, sourceRefs: [], gaps: [], comparison: { comparisonStatus: "complete" } } as unknown as FinancialAnalysis

test("review rechecks an earlier topic after a later source revokes it", async () => {
  let revoked = false
  const result = await prepareFactualReview({ topicRefs: ["first", "second"], period, context, host: {
    readTopic: async (topic) => {
      if (topic === "first" && revoked) return { status: "denied", reason: "private-source" }
      if (topic === "second") revoked = true
      return { status: "ok", value: { projection, recordCount: 2, confirmation } }
    },
    revalidate: async () => true,
  } })
  expect(result).toEqual({ status: "denied", reason: "access-changed" })
  expect(JSON.stringify(result)).not.toContain("first")
})

test("review refuses a mixed source snapshot but accepts a new C06 evaluation timestamp", async () => {
  let reads = 0
  const changed = await prepareFactualReview({ topicRefs: ["january"], period, context, host: {
    readTopic: async () => ({ status: "ok", value: { projection: { ...projection, version: ++reads === 1 ? 8 : 9 }, recordCount: 2, confirmation } }),
    revalidate: async () => true,
  } })
  expect(changed).toEqual({ status: "stale", reason: "review-source-changed" })
  let evaluations = 0
  const stable = await prepareFactualReview({ topicRefs: ["january", "january"], period, context, host: {
    readTopic: async () => ({ status: "ok", value: { projection, recordCount: 2, confirmation: { ...confirmation, evaluatedAt: `2027-01-03T00:00:0${++evaluations}Z` } } }),
    revalidate: async () => true,
  } })
  expect(stable).toMatchObject({ status: "ok", value: { synthesisIncluded: false, topics: [{ review: "confirmed", sourceObservedAt: ["2026-12-20T00:00:00Z"] }], draft: { pendencies: [], coverage: { selectedTopics: 1, includedTopics: 1, unavailableTopics: 0, omittedTopics: 0, includedRecordCount: 2 } } } })
})

test("review coverage declares unavailable topics and unknown record counts without counting metrics", async () => {
  const result = await prepareFactualReview({ topicRefs: ["available", "private"], period, context, host: {
    readTopic: async (topic) => topic === "private" ? { status: "denied", reason: "restricted" } : { status: "ok", value: { projection, confirmation: null } },
    revalidate: async () => true,
  } })
  expect(result).toMatchObject({ status: "ok", value: { draft: { coverage: { selectedTopics: 2, includedTopics: 1, unavailableTopics: 1, includedRecordCount: null } } } })
  expect(JSON.stringify(result)).not.toContain("private")
})

test("review declares empty selections and omits a section whose producer supplied no usable period", async () => {
  const host = {
    readTopic: async () => ({ status: "ok" as const, value: { projection: { version: 1, values: [], components: [], missing: [] } as unknown as DomainProjection, recordCount: 0, confirmation: null } }),
    revalidate: async () => true,
  }
  expect(await prepareFactualReview({ topicRefs: [], context, host })).toMatchObject({ status: "ok", value: { topics: [], draft: { sections: [], pendencies: [], coverage: { selectedTopics: 0, includedTopics: 0, unavailableTopics: 0, omittedTopics: 0, includedRecordCount: 0 } } } })
  expect(await prepareFactualReview({ topicRefs: ["no-period"], context, host })).toMatchObject({ status: "ok", value: { draft: { sections: [], coverage: { selectedTopics: 1, includedTopics: 0, unavailableTopics: 0, omittedTopics: 1, includedRecordCount: 0 } } } })
})

test("forecast suppresses a comparison changed while confirmation was being read", async () => {
  const mutable = structuredClone(comparison)
  const result = await prepareForecastReview({ request, context, host: {
    planner: { compareForecast: async () => ({ status: "ok", value: mutable }) },
    confirmations: async () => {
      mutable.candidate.version = 9
      return { status: "ok", value: [confirmation] }
    },
    revalidate: async () => true,
  } })
  expect(result).toEqual({ status: "stale", reason: "forecast-source-changed" })
})

test("forecast rechecks C06 validity and never releases the old fingerprint after revocation", async () => {
  let reads = 0
  const result = await prepareForecastReview({ request, context, host: {
    planner: { compareForecast: async () => ({ status: "ok", value: comparison }) },
    confirmations: async () => ({ status: "ok", value: ++reads === 1 ? [confirmation] : [{ confirmationId: "jan", state: "unavailable", reason: "access-unavailable", evaluatedSourceVersion: 8, evaluatedAt: "2027-01-03" }] }),
    revalidate: async () => true,
  } })
  expect(result).toEqual({ status: "unavailable", reason: "review-source-unavailable" })
  expect(JSON.stringify(result)).not.toContain("jan-fingerprint")
})

test("a single sourced proposal remains an incomplete factual dossier without fabricated alternatives", async () => {
  const comparison: CommercialComparison = { requestRef: "request", requestVersion: 8, currency: "USD", proposals: [{ proposalRef: "q1", eligible: true, score: null, convertedAmount: 42, evidenceRefs: [], issues: [] }], ranking: [], sourceRefs: [], conditions: [] }
  const result = await prepareSourcingDossier({ requestRef: "request", context,
    prepareProcurement: async () => ({ status: "ok", value: { request: projection, comparison, limitations: [] } }),
    selectedDocuments: async () => ({ status: "ok", value: [] }),
    reader: async () => { throw new Error("There is no selected document") },
    revalidate: async () => true,
    revalidateProcurement: async () => true,
  })
  expect(result).toMatchObject({ status: "ok", value: { comparison, complete: false, synthesisIncluded: false, summary: { proposalCount: 1, comparisonAvailable: true, ranking: [] }, draft: { alternatives: [], domainApplied: false, gaps: ["comparison-needs-multiple-proposals", "document-evidence-unavailable"] } } })
})

test("dossier pins the initial procurement snapshot and fences it after the final document read", async () => {
  const selectedContext = { binding: { installationId: "i", projectId: "p", accessRevision: "a" } } as TrustedDomainContext
  const document: Extract<BusinessEvidenceRef, { kind: "document" }> = { schema: "sf-evidence-v1", kind: "document", refId: "doc", refDigest: "", installationId: "i", projectId: "p", evidenceLevel: "observed", target: { documentId: "doc", incarnation: "inc", revision: 1, blobDigest: { algorithm: "sha256", value: "a".repeat(64) }, segment: { start: 0, end: 1, unit: "utf16", textDigest: { algorithm: "sha256", value: "b".repeat(64) } } } }
  document.refDigest = digestSfEvidenceRef(document)
  const material = { request: structuredClone(projection), comparison: null, limitations: [] }
  let reads = 0
  const result = await prepareSourcingDossier({ requestRef: "request", context: selectedContext,
    prepareProcurement: async () => ({ status: "ok", value: material }),
    selectedDocuments: async () => ({ status: "ok", value: [document] }),
    reader: async () => {
      if (++reads === 2) material.request.version = 9
      return { status: "unavailable", accessRevision: "a" }
    },
    revalidate: async () => true,
    revalidateProcurement: async (initial) => initial.request.version === material.request.version,
  })
  expect(reads).toBe(2)
  expect(result).toEqual({ status: "denied", reason: "access-changed" })
  expect(result).not.toHaveProperty("value")
})
