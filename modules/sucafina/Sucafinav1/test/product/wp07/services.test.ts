import { expect, test } from "bun:test"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { canonicalSfValue, digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createReviewServices } from "../../../product/reviews/services.ts"
import { testPersistence } from "../../fixture/persistence.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const at = "2026-11-13T00:00:00Z"
const reference: Extract<BusinessEvidenceRef, { kind: "record" }> = {
  schema: "sf-evidence-v1", kind: "record", refId: "record-evidence", installationId: "installation", projectId: "project",
  refDigest: "", evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: "v1", incarnation: "v1-inc", version: 1, fields: ["forecast"], period, projectionDigest: "a".repeat(64) },
}
reference.refDigest = digestSfEvidenceRef(reference)

async function fixture(refs: readonly BusinessEvidenceRef[], mode?: "revoke" | "mutate") {
  const access = { allowed: true, next: 0 }
  const seen: string[] = []
  const binding = { installationId: "installation", projectId: "project", principalRef: "finance", policyVersion: "policy", accessRevision: "access" }
  const ui = createSfUiAuthority({ authorize: async () => access.allowed ? binding : undefined, commandIdentity: async () => "preview", createId: () => `request-${++access.next}`, now: () => Date.parse(at) })
  const request = new Request("https://example.test/reviews")
  const digest = digestSfValue({ selectionRef: "selection", sectionRefs: ["one"] })
  const admitted = await ui.admit(request, "sf_review_prepare", digest)
  if (admitted.status !== "ok" || !await ui.validate(admitted.value, "sf_review_prepare", digest)) throw new Error("WP07_TEST_UI_ADMISSION_FAILED")
  const context = admitted.value
  const host = {
    requestFor: (value: typeof context) => ui.requestFor(value),
    revalidate: async () => ui.revalidate(context),
  }
  const storage = testPersistence()
  const state = createSfProductState({ persistence: storage.persistence, createId: () => "state", authorize: async () => access.allowed ? binding : undefined, resolveTarget: async () => ({ incarnation: "workspace" }) })
  const projection: DomainProjection = {
    context: { ...binding, surface: "planner", period, currency: "USD", capabilities: [], sourceRefs: [{ surface: "planner", type: "planner-version", id: "v1", incarnation: "v1-inc", version: 1, fields: ["forecast"], period, observedAt: at }] },
    version: 1, engineVersion: "controlled-projection", components: [], missing: [],
    values: refs.map((ref, index) => ({ id: `amount-${index}`, value: index, currency: "USD", period, granularity: "record", sourceRefs: [ref], evidenceState: "confirmed" })),
  }
  const authorized = async () => host.revalidate()
  const services = createReviewServices({
    state,
    host: { requestFor: (value) => value.kind === "ui" ? ui.requestFor(value) : undefined, revalidate: async (value) => value.kind === "ui" && await ui.revalidate(value) },
    authority: { validateDomainContext: async (value, operation, inputDigest) => value.kind === "ui" && await ui.validate(value, operation, inputDigest), revalidateDomainContext: async (value) => value.kind === "ui" && await ui.revalidate(value), receiptFor: (value, operation, inputDigest, resultDigest) => value.kind === "ui" ? ui.receiptFor(value, operation, inputDigest, resultDigest) : undefined },
    // This narrow producer is controlled; the review service and UI lease are real.
    evidence: { resolve: async (ref, value) => {
      seen.push(canonicalSfValue(ref))
      const valid = canonicalSfValue(ref) === canonicalSfValue(reference)
      if (mode === "revoke") access.allowed = false
      if (mode === "mutate" && ref.kind === "record") ref.target.recordId = "changed-by-resolver"
      return { state: valid ? "historical" : "unavailable", ref, accessRevision: value.binding.accessRevision, checkedAt: at }
    } },
    selection: {
      select: async () => ({ status: "ok", value: [{ id: "one", title: "Selected values", period, recordCount: 1, projection }] }),
      authorizeOutcomeComparison: authorized, authorizeOutcome: authorized, authorizeDecision: authorized,
      authorizeSections: authorized, authorizeComments: authorized, authorizeSensitivity: authorized, revalidate: authorized,
    },
    creationTarget: { ref: "workspace", incarnation: "workspace" }, operationIdentity: () => "preview", requiredAuthority: [], maxBytes: 5_000_000, now: () => at,
  })
  return { seen, read: () => services.reviews.preview("selection", ["one"], context), finish: () => ui.finish(context) }
}

test("many cells sharing identical evidence resolve once per authorization pass without caching another read", async () => {
  const value = await fixture(Array.from({ length: 128 }, () => structuredClone(reference)))
  try {
    const first = await value.read()
    expect(first.status).toBe("ok")
    if (first.status === "ok") expect(first.value[0]?.projection.values).toHaveLength(128)
    expect(value.seen).toEqual([canonicalSfValue(reference)])
    expect((await value.read()).status).toBe("ok")
    expect(value.seen).toEqual([canonicalSfValue(reference), canonicalSfValue(reference)])
  } finally { value.finish() }
})

test("different evidence bodies sharing a claimed digest are independently checked and refused", async () => {
  const changed = { ...reference, target: { ...reference.target, recordId: "foreign-record" } }
  const value = await fixture([structuredClone(reference), changed])
  try {
    const result = await value.read()
    expect(result.status).toBe("denied")
    expect("value" in result).toBe(false)
    expect(new Set(value.seen)).toEqual(new Set([canonicalSfValue(reference), canonicalSfValue(changed)]))
    expect(value.seen).toHaveLength(2)
  } finally { value.finish() }
})

test.each(["revoke", "mutate"] as const)("evidence %s during resolution cannot escape the authorization boundary", async (mode) => {
  const value = await fixture([structuredClone(reference)], mode)
  try {
    const result = await value.read()
    expect(result.status).toBe("denied")
    expect("value" in result).toBe(false)
    expect(value.seen).toEqual([canonicalSfValue(reference)])
  } finally { value.finish() }
})
