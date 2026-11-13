import { expect, test } from "bun:test"
import JSZip from "jszip"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createReviewApplication } from "../../../product/reviews/application.ts"
import { prepareReview } from "../../../product/reviews/capabilities.ts"
import { testPersistence } from "../../fixture/persistence.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const source = { surface: "procurement", type: "requests", id: "request-1", incarnation: "request-original", version: 1, fields: ["amount"], period, observedAt: "2026-11-13T00:00:00Z" } as const
const evidence = { schema: "sf-evidence-v1", refId: "request-evidence", installationId: "installation", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "procurement", recordType: "requests", recordId: "request-1", incarnation: "request-original", version: 1, fields: ["amount"], period, projectionDigest: "b".repeat(64) } } as const
type Operation = "sf_review_prepare" | "sf_report_prepare" | "sf_artifact_get"

// Synthetic domain inputs; the product state provider, UI authority, dispatcher and artifact renderer are real.
function fixture() {
  const control = { allowed: true, available: true, amount: 1320, now: 0, sequence: 0, afterRead: undefined as (() => void) | undefined }
  const identity = { installationId: "installation", projectId: "project", principalRef: "principal", policyVersion: "policy", accessRevision: "access" }
  const persistence = testPersistence()
  const ui = createSfUiAuthority({
    authorize: async () => control.allowed ? identity : undefined,
    commandIdentity: async (_request, operation, digest) => `${operation}:${digest}`,
    createId: () => `request-${++control.sequence}`, now: () => control.now,
    privateCommands: ["sf-human:reviews.preserve", "sf-human:collaboration.handoff.confirm"],
  })
  const authority: SfDomainValidation = {
    validateDomainContext: (context, operation, digest) => context.kind === "ui" ? ui.validate(context, operation, digest) : Promise.resolve(false),
    revalidateDomainContext: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
    receiptFor: (context, operation, digest, result) => context.kind === "ui" ? ui.receiptFor(context, operation, digest, result) : undefined,
  }
  const host = {
    requestFor: (context: TrustedDomainContext) => context.kind === "ui" ? ui.requestFor(context) : undefined,
    revalidate: authority.revalidateDomainContext,
  }
  const state = createSfProductState({
    persistence: persistence.persistence, createId: () => "state-original",
    resolveTarget: async (_request, _snapshot, _namespace, target) => target === "workspace" ? { incarnation: "installation" } : undefined,
    authorize: async () => control.allowed ? identity : undefined,
  })
  const projection = (): DomainProjection => ({
    context: { ...identity, surface: "procurement", period, currency: "USD", sourceRefs: [source], capabilities: [] },
    version: 1, engineVersion: "synthetic-procurement-v1", components: [], missing: [],
    values: [{ id: "request.amount", value: control.amount, currency: "USD", period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: "confirmed" }],
  })
  const unavailable = async () => ({ status: "unavailable", reason: "not-selected" } as const)
  const humanAuthority = createSfHumanAuthority({ origin: "https://example.test", ui })
  const app = createReviewApplication({
    state, host, authority, ui, humanAuthority, origin: "https://example.test", maxBodyBytes: 8000,
    creationTarget: { ref: "workspace", incarnation: "installation" },
    operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined,
    requiredAuthority: [], maxBytes: 5_000_000, now: () => "2026-11-13T00:00:00Z",
    evidence: { resolve: async (ref, context) => ({ state: control.allowed ? "historical" : "revoked", ref, accessRevision: context.binding.accessRevision, checkedAt: "2026-11-13T00:00:00Z" }) },
    access: {
      authorizeSections: async () => control.allowed, authorizeOutcomeComparison: async () => control.allowed,
      authorizeOutcome: async () => control.allowed, authorizeDecision: async () => control.allowed,
      authorizeSensitivity: async () => control.allowed, revalidate: async () => control.allowed,
    },
    collaboration: { threads: { read: unavailable }, history: { readVersion: unavailable }, authorizeSourceMapping: async () => false, maxMessages: 20 },
    ports: {
      selectDashboardAgenda: unavailable,
      planner: { compareForecast: unavailable, simulateScenario: unavailable, compareScenarios: unavailable, evaluateSensitivity: unavailable },
      procurement: { read: async () => {
        if (!control.available) return { status: "unavailable", reason: "source-unavailable" }
        const value = projection()
        control.afterRead?.()
        return { status: "ok", value }
      }, readSupplier: unavailable, readContract: unavailable, compareSourcing: unavailable },
    },
  })
  const request = (mode: string, payload?: unknown) => new Request(`https://example.test/dashboard?sf=${mode}`, payload === undefined ? {} : { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json" }, body: JSON.stringify(payload) })
  const dispatch = async (operation: Operation, payload: unknown) => {
    const admitted = await ui.admit(request("review-preview"), operation, digestSfValue(payload))
    if (admitted.status !== "ok") return admitted
    try {
      return await dispatchSfCapability({ operation, payload, context: admitted.value, descriptors: app.descriptors, authority,
        validateInput: (_descriptor, value) => decodeSfOperationInput(operation, value).ok,
        validateOutput: (_descriptor, value) => value.status !== "ok" || decodeSfOperationOutput(operation, value.result).ok,
      })
    } finally { ui.finish(admitted.value) }
  }
  const agenda = async () => {
    const response = await app.http(request("review-agenda", { items: [{ id: "request", kind: "procurement-request", title: "Procurement request", requestRef: "request-1", period }] }), "dashboard")
    expect(response?.status).toBe(200)
    const result = await response!.json() as { status: string; value: { selectionRef: string; sectionRefs: string[] } }
    expect(result.status).toBe("ok")
    return { selectionRef: result.value.selectionRef, sectionRefs: result.value.sectionRefs }
  }
  return { control, persistence, state, ui, authority, app, request, dispatch, agenda }
}

test("application consumes agenda, shared review/report/artifact capabilities and a preserved byte download", async () => {
  const f = fixture()
  const selection = await f.agenda()
  const payload = { ...selection, period }
  const preview = await f.app.http(f.request("review-preview", payload), "dashboard")
  expect(preview?.status).toBe(200)
  expect(await preview!.json()).toMatchObject({ status: "ok", receipt: { kind: "ui", operation: "sf_review_prepare", handlerExport: "prepareReview" } })
  const preserved = await f.app.http(f.request("review-preserve", selection), "dashboard")
  expect(preserved?.status).toBe(200)
  const saved = await preserved!.json() as { value: { id: string } }
  f.control.amount = 1400
  f.control.available = false
  const report = await f.dispatch("sf_report_prepare", { reviewRef: saved.value.id, sectionRefs: selection.sectionRefs, format: "docx" })
  expect(report.status).toBe("ok")
  if (report.status !== "ok" || !("outputRef" in report) || !report.outputRef) throw new Error("report not produced")
  const artifact = await f.dispatch("sf_artifact_get", { artifactRef: report.outputRef })
  expect(artifact.status).toBe("ok")
  expect(artifact).toMatchObject({ result: { recordCount: 1, format: "docx" }, receipt: { operation: "sf_artifact_get", handlerExport: "readArtifact", kind: "ui" } })
  const downloaded = await f.app.http(f.request(`review-download&artifactRef=${encodeURIComponent(report.outputRef)}`), "dashboard")
  expect(downloaded?.status).toBe(200)
  expect(downloaded?.headers.get("cache-control")).toBe("no-store")
  const zip = await JSZip.loadAsync(await downloaded!.arrayBuffer())
  const document = await zip.file("word/document.xml")!.async("string")
  expect(document).toContain("1320")
  expect(document).not.toContain("1400")
  const comparison = await f.app.http(f.request(`review-comparison&reviewRef=${encodeURIComponent(saved.value.id)}`), "dashboard")
  expect(comparison?.status).toBe(200)
  expect(await comparison!.json()).toMatchObject({ status: "ok", value: { comparison: { state: "first-review" }, forwardingCoverage: "unavailable" } })
  const storedBefore = structuredClone(f.persistence.state.dashboard)
  f.control.allowed = false
  expect((await f.dispatch("sf_artifact_get", { artifactRef: report.outputRef })).status).toBe("denied")
  expect((await f.app.http(f.request(`review-download&artifactRef=${encodeURIComponent(report.outputRef)}`), "dashboard"))?.status).toBe(403)
  expect(f.persistence.state.dashboard).toEqual(storedBefore)
})

test("shared dispatcher refuses forged arguments, missing admission, reused leases, expiry and source loss", async () => {
  const f = fixture()
  const selection = await f.agenda()
  const payload = { ...selection, period }
  expect((await f.dispatch("sf_review_prepare", { ...payload, role: "admin" })).status).toBe("denied")
  const admitted = await f.ui.admit(f.request("review-preview"), "sf_review_prepare", digestSfValue(payload))
  if (admitted.status !== "ok") throw new Error("admission unavailable")
  expect((await prepareReview(payload, admitted.value, { reviews: f.app.reviews, artifacts: f.app.artifacts, authority: f.authority, requiredAuthority: [] })).status).toBe("denied")
  const dispatch = () => dispatchSfCapability({ operation: "sf_review_prepare", payload, context: admitted.value, descriptors: f.app.descriptors, authority: f.authority, validateInput: (_descriptor, value) => decodeSfOperationInput("sf_review_prepare", value).ok, validateOutput: (_descriptor, value) => value.status !== "ok" || decodeSfOperationOutput("sf_review_prepare", value.result).ok })
  expect((await dispatch()).status).toBe("ok")
  expect((await dispatch()).status).toBe("denied")
  f.ui.finish(admitted.value)
  const expired = await f.ui.admit(f.request("review-preview"), "sf_review_prepare", digestSfValue(payload))
  if (expired.status !== "ok") throw new Error("admission unavailable")
  f.control.now = 300_001
  expect(await f.ui.validate(expired.value, "sf_review_prepare", digestSfValue(payload))).toBe(false)
  f.control.available = false
  expect((await f.dispatch("sf_review_prepare", payload)).status).toBe("unavailable")
})

test("HTTP rejects cross-site writes, unknown fields, oversized bodies and revoked sources during preparation", async () => {
  const f = fixture()
  const selection = await f.agenda()
  const payload = { ...selection, period }
  const crossSite = new Request("https://example.test/dashboard?sf=review-preview", { method: "POST", headers: { origin: "https://foreign.test", "content-type": "application/json" }, body: JSON.stringify(payload) })
  expect((await f.app.http(crossSite, "dashboard"))?.status).toBe(403)
  expect((await f.app.http(f.request("review-preview", { ...payload, actor: "other" }), "dashboard"))?.status).toBe(400)
  expect((await f.app.http(f.request("review-preview", { text: "x".repeat(9000) }), "dashboard"))?.status).toBe(413)
  expect((await f.app.http(f.request("review-preview", payload), "procurement"))?.status).toBe(403)
  f.control.afterRead = () => { f.control.allowed = false }
  const revoked = await f.app.http(f.request("review-preview", payload), "dashboard")
  expect(revoked?.status).toBe(403)
  expect(await revoked!.text()).not.toContain("1320")
})
