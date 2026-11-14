import { expect, test } from "bun:test"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { createReviewComposition } from "../../../product/reviews/composition.ts"
import type { ReviewCompositionInput } from "../../../product/reviews/composition.ts"
import { createExactReviewThreadSourceMapping } from "../../../product/reviews/thread-access.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"
import { testPersistence } from "../../fixture/persistence.ts"

test("composition consumes the real Planner projection and protected review storage under a UI lease", async () => {
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const at = "2026-11-13T00:00:00Z"
  const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
  const snapshot: Snapshot = { data: { roleMap: [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }], versions: [100, 110].map((amount, index) => ({ id: `v${index}`, year: 2027, closed: 0, lines: [{ id: "license", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(amount) }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })) }, versions: {}, sequences: {}, audit: [], notices: [] }
  const storage = testPersistence({ planner: snapshot })
  const refs = ["v0", "v1"].map((id): Extract<BusinessEvidenceRef, { kind: "record" }> => {
    const projection = projectPlannerSource(storage.state.planner, actor, id)!
    const ref: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: id, installationId: "installation", projectId: "project", refDigest: "", evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: id, incarnation: `inc-${id}`, version: 1, fields: Object.keys(projection), period, projectionDigest: digestSfValue({ versionId: id, projection }) } }
    return { ...ref, refDigest: digestSfEvidenceRef(ref) }
  })
  const access = { allowed: true, nextId: 0 }
  const ui = createSfUiAuthority({ authorize: async () => access.allowed ? { installationId: "installation", projectId: "project", principalRef: "finance", policyVersion: "policy", accessRevision: "access" } : undefined, commandIdentity: async () => "review-command", createId: () => `ui-${++access.nextId}`, now: () => Date.parse(at) })
  const request = new Request("https://example.test/reviews")
  const admitted = await ui.admit(request, "sf_review_prepare", digestSfValue({ selection: "planner" }))
  if (admitted.status !== "ok") throw new Error("UI authority unavailable")
  const context = admitted.value
  expect(await ui.validate(context, "sf_review_prepare", digestSfValue({ selection: "planner" }))).toBe(true)
  const host: DomainPortHost = {
    persistence: storage.persistence,
    authenticate: async (_request, input) => access.allowed ? resolve("finance", [...input!.roleMap], (group) => group === "finance-group") : null,
    environment: async () => ({ at, id: () => "unused", directory: [] }),
    requestFor: (binding) => binding.kind === "ui" ? ui.requestFor(binding) : undefined,
    revalidate: (binding) => binding.kind === "ui" ? ui.revalidate(binding) : Promise.resolve(false),
  }
  const authority: SfDomainValidation = {
    validateDomainContext: async (binding, operation, digest) => binding.kind === "ui" && await ui.validate(binding, operation, digest),
    revalidateDomainContext: host.revalidate,
    receiptFor: (binding, operation, digest, resultDigest) => binding.kind === "ui" ? ui.receiptFor(binding, operation, digest, resultDigest) : undefined,
  }
  const planner = createPlannerPort({ host, sources: {
    resolveForecastSource: async (id, binding) => {
      const ref = refs.find((entry) => entry.refId === id)
      return ref && await host.revalidate(binding) ? { status: "ok", value: { versionId: id, evidence: ref } } : { status: "unavailable", reason: "source-unavailable" }
    },
    resolveForecastCoverage: async () => ({ status: "unavailable", reason: "coverage-not-supplied" }),
  } })
  const state = createSfProductState({ persistence: storage.persistence, createId: () => "state-incarnation", resolveTarget: async (_request, _snapshot, namespace, ref) => namespace === "reviews" && ref === "review-creation" ? { incarnation: "review-incarnation" } : undefined, authorize: async () => access.allowed ? { principalRef: "finance", accessRevision: "access", policyVersion: "policy" } : undefined })
  const evidence: ReviewCompositionInput["evidence"] = { resolve: async (ref, binding) => ({ state: await host.revalidate(binding) && refs.some((candidate) => digestSfValue(candidate) === digestSfValue(ref)) ? "fresh" : "unavailable", ref, accessRevision: binding.binding.accessRevision, checkedAt: at }) }
  const revalidateSources: ReviewCompositionInput["access"]["revalidate"] = async (binding, sources) => await host.revalidate(binding) && sources.every((source) => refs.some((ref) => source.surface === ref.target.surface && source.type === ref.target.recordType && source.id === ref.target.recordId && source.incarnation === ref.target.incarnation && source.version === ref.target.version && digestSfValue(source.period) === digestSfValue(ref.target.period) && digestSfValue([...source.fields].sort()) === digestSfValue([...ref.target.fields].sort())))
  // Absent Dashboard/C06 history producers stay unavailable; this test makes no native or three-product claim.
  const input: ReviewCompositionInput = {
    state, host, authority, evidence, creationTarget: { ref: "review-creation", incarnation: "review-incarnation" }, operationIdentity: () => "review-operation", requiredAuthority: [], maxBytes: 5_000_000, now: () => at,
    ports: { planner, procurement: { read: async () => ({ status: "unavailable", reason: "producer-not-supplied" }), readSupplier: async () => ({ status: "unavailable", reason: "producer-not-supplied" }), readContract: async () => ({ status: "unavailable", reason: "producer-not-supplied" }) }, selectDashboardAgenda: async () => ({ status: "unavailable", reason: "producer-not-supplied" }) },
    access: { revalidate: revalidateSources, authorizeSections: (binding, sections) => revalidateSources(binding, sections.flatMap((section) => section.sourceRefs)), authorizeOutcomeComparison: async (_binding, values) => values.length === 0, authorizeOutcome: async (_binding, values) => values.length === 0, authorizeDecision: async (_binding, values) => values.length === 0, authorizeSensitivity: async (_binding, values) => values.length === 0 },
    collaboration: { threads: { read: async () => ({ status: "unavailable", reason: "producer-not-supplied" }) }, history: { readVersion: async () => ({ status: "unavailable", reason: "producer-not-supplied" }) }, authorizeSourceMapping: createExactReviewThreadSourceMapping({ host, evidence }), maxMessages: 100 },
  }
  const composed = createReviewComposition(input)
  const agenda = await composed.agenda.create([{ id: "forecast", kind: "forecast-comparison", title: "Forecast", baseRef: "v0", candidateRef: "v1", currency: "USD", sides: ["candidate"], period, agendaNote: "Financial review" }], context)
  if (agenda.status !== "ok") throw new Error(agenda.reason)
  const captured = agenda.value.sections[0]!.projection
  expect(captured.components.reduce((total, component) => total + (component.amount ?? 0), 0)).toBe(1320)
  const saved = await composed.reviews.preserve({ id: "review-1", selectionRef: agenda.value.selectionRef, sectionRefs: agenda.value.sectionRefs, expectedStorageVersion: 0, idempotencyKey: "preserve", targetIncarnation: "review-incarnation" }, context)
  if (saved.status !== "ok") throw new Error(saved.reason)
  expect(saved.value.sections[0]?.content).toMatchObject({ reviewAgendaNote: "Financial review" })
  expect(digestSfValue((saved.value.sections[0]!.content as DomainProjection).values)).toBe(digestSfValue(captured.values))
  const restarted = createReviewComposition(input)
  const recovered = await restarted.reviews.read("review-1", context)
  expect(recovered.status).toBe("ok")
  if (recovered.status === "ok") expect(digestSfValue(recovered.value)).toBe(digestSfValue(saved.value))
  expect(restarted.descriptors.map((descriptor) => descriptor.id)).toEqual(["sf_review_prepare", "sf_report_prepare", "sf_artifact_get"])
  access.allowed = false
  expect((await restarted.reviews.read("review-1", context)).status).not.toBe("ok")
  ui.finish(context)
})
