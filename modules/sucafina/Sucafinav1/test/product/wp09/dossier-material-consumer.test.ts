import { expect, test } from "bun:test"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainProjection, SourceRef } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSourcingDossierPreparation } from "../../../product/routines/dossier-host.ts"

// Real dossier preparation/egress consumer, with explicit C02/C14 port boundary fixtures.
// The domain cannot be reconfigured to another engine/unit; those adversarial producer projections are intentional.
test.each(["null-to-zero", "zero-to-null", "foreign-unit", "foreign-engine", "clock-only"] as const)("dossier material fence handles %s without normalizing by label alone", async (change) => {
  const period = { start: "2027-01-01", end: "2027-01-31" }
  const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "buyer", accessRevision: "1", policyVersion: "1" } } as TrustedDomainContext
  const source: SourceRef = { surface: "procurement", type: "requests", id: "r1", incarnation: "request-inc", version: 1, fields: ["ageDays", "stageEnteredAt"], period, observedAt: "2027-01-10T00:00:00Z" }
  const record = (refId: string, recordType: string, fields: readonly string[]): Extract<BusinessEvidenceRef, { kind: "record" }> => {
    const value: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId, refDigest: "", installationId: "i", projectId: "p", evidenceLevel: "observed",
      target: { surface: "procurement", recordType, recordId: "r1", incarnation: "request-inc", version: 1, fields, period, projectionDigest: digestSfValue({ stageEnteredAt: "2027-01-01T00:00:00Z" }) } }
    return { ...value, refDigest: digestSfEvidenceRef(value) }
  }
  const ageEvidence = record("age", "requests", ["ageDays"])
  const sourcingEvidence = record("request", "procurement-request", ["sourcing"])
  const projection = (value: number | null): DomainProjection => ({
    context: { ...context.binding, surface: "procurement", period, currency: "USD", sourceRefs: [source], capabilities: [] },
    version: 1, engineVersion: change === "foreign-engine" ? "other-producer-v1" : "procurement-v1", components: [], missing: [],
    values: [{ id: "ageDays", value, unit: change === "foreign-unit" ? "hours" : "days", period, granularity: "record", evidenceState: "confirmed", sourceRefs: [ageEvidence], drilldown: ageEvidence }],
  })
  const before = projection(change === "null-to-zero" ? null : 0)
  const after = projection(change === "zero-to-null" ? null : change === "null-to-zero" ? 0 : 1)
  let reads = 0
  const prepare = createSourcingDossierPreparation({
    procurement: { read: async () => ({ status: "ok", value: structuredClone(++reads === 1 ? before : after) }) },
    sourcingEvidence: async () => ({ status: "ok", value: { stage: "sourcing", offers: [], submittedBaseCurrency: null, submittedFx: [],
      weights: { technical: null, commercial: null, technicalCriteria: [], commercialCriteria: [] }, evidence: sourcingEvidence, context: before.context, comparison: null } }),
    selectedDocuments: async () => ({ status: "ok", value: [] }),
    reader: async () => { throw new Error("No document was selected") },
    revalidateAuthority: async () => true,
  })
  const result = await prepare("request", context)
  expect(reads).toBeGreaterThanOrEqual(2)
  if (change === "clock-only") {
    expect(result).toMatchObject({ status: "ok", value: { request: { values: [{ id: "ageDays", value: 0 }] }, complete: false, synthesisIncluded: false } })
  } else {
    expect(result).toEqual({ status: "denied", reason: "access-changed" })
    expect(result).not.toHaveProperty("value")
  }
})
