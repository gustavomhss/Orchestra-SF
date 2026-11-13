import { expect, test } from "bun:test"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createReviewCapabilities } from "../../../product/reviews/capabilities.ts"
import { createReviewHttp } from "../../../product/reviews/http.ts"
import { createReviewDownloadHandler } from "../../../product/reports/download.ts"
import { createReviewArtifactStorage } from "../../../product/reports/storage.ts"
import { createReviewHumanPort } from "../../../product/reviews/human.ts"
import { createReviewPort } from "../../../product/reviews/port.ts"
import { testPersistence } from "./persistence.ts"

test("human preservation uses the authorized creation target and reconciles an exact retry", async () => {
  const persistence = testPersistence()
  const state = createSfProductState({ persistence: persistence.persistence, createId: () => "state", resolveTarget: async (_request, _snapshot, _namespace, target) => target === "workspace" ? { incarnation: "installation" } : undefined, authorize: async () => ({ principalRef: "principal", accessRevision: "access", policyVersion: "policy" }) })
  const ui = createSfUiAuthority({ privateCommands: ["sf-human:reviews.preserve"], createId: () => "request", now: () => 0, commandIdentity: async () => "same-intention", authorize: async () => ({ principalRef: "principal", installationId: "installation", projectId: "project", accessRevision: "access", policyVersion: "policy" }) })
  const human = createSfHumanAuthority({ origin: "https://example.test", ui })
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const source = { selects: 0, available: true }
  const reviews = createReviewPort({ state, creationTarget: { ref: "workspace", incarnation: "installation" }, now: () => "2026-11-13T00:00:00Z", requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, authorizeOutcomeComparison: async () => true, authorizeOutcome: async () => true, authorizeDecision: async () => true, authorizeSections: async () => true, authorizeComments: async () => true, authorizeSensitivity: async () => true, revalidate: async () => true, revalidateEvidence: async () => true,
    select: async (selectionRef, sectionRefs) => { source.selects++; expect(selectionRef).toBe("selection"); expect(sectionRefs).toEqual(["section"]); return source.available ? { status: "ok", value: [{ id: "section", title: "Section", period, recordCount: 0, projection: { version: 1, engineVersion: "v1", context: { principalRef: "principal", installationId: "installation", projectId: "project", accessRevision: "access", policyVersion: "policy", surface: "dashboard", period, currency: "USD", sourceRefs: [], capabilities: [] }, components: [], values: [], missing: [] } }] } : { status: "unavailable", reason: "source-changed" } },
  })
  const port = createReviewHumanPort({ state, reviews, human, ui, creationTarget: { ref: "workspace", incarnation: "installation" } })
  const request = () => new Request("https://example.test/reviews", { method: "POST", headers: { origin: "https://example.test" } })
  const payload = { selectionRef: "selection", sectionRefs: ["section"] }
  const saving = port.preserve(request(), payload)
  payload.selectionRef = "mutated-after-admission"
  payload.sectionRefs[0] = "mutated-after-admission"
  const first = await saving
  expect(first.status).toBe("ok")
  payload.selectionRef = "selection"
  payload.sectionRefs[0] = "section"
  source.available = false
  const retry = await port.preserve(request(), payload)
  expect(retry).toEqual(first)
  expect(source.selects).toBe(1)
  if (first.status !== "ok") throw new Error("review unavailable")
  const artifactStore = createReviewArtifactStorage({ state, reviews, host: { requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false) }, creationTarget: { ref: "workspace", incarnation: "installation" }, operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined, maxBytes: 1_000_000 })
  const authority = { validateDomainContext: (context: TrustedDomainContext, operation: string, digest: string) => context.kind === "ui" ? ui.validate(context, operation, digest) : Promise.resolve(false), revalidateDomainContext: (context: TrustedDomainContext) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false), receiptFor: (context: TrustedDomainContext, operation: string, digest: string, result?: string) => context.kind === "ui" ? ui.receiptFor(context, operation, digest, result) : undefined }
  const descriptors = createReviewCapabilities({ reviews, artifacts: artifactStore, authority, requiredAuthority: [] })
  const http = createReviewHttp({ origin: "https://example.test", ui, human: port, reviews, descriptors, authority, download: createReviewDownloadHandler({ authority: ui, storage: artifactStore }), maxBodyBytes: 4096 })
  const endpoint = new URL("https://example.test/dashboard")
  endpoint.searchParams.set("sf", "review-read")
  endpoint.searchParams.set("reviewRef", first.value.id)
  const response = await http(new Request(endpoint), "dashboard")
  expect(response?.status).toBe(200)
  expect(await response?.json()).toMatchObject({ status: "ok", value: { id: first.value.id } })
  expect((await http(new Request(endpoint), "procurement"))?.status).toBe(403)
  const reportEndpoint = new URL("https://example.test/dashboard?sf=review-report")
  const report = await http(new Request(reportEndpoint, { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json" }, body: JSON.stringify({ reviewRef: first.value.id, format: "docx", sectionRefs: ["section"] }) }), "dashboard")
  expect(report?.status).toBe(200)
  const prepared = await report?.json() as { status: string; outputRef: string }
  expect(prepared.status).toBe("ok")
  const downloadEndpoint = new URL("https://example.test/dashboard?sf=review-download")
  downloadEndpoint.searchParams.set("artifactRef", prepared.outputRef)
  const download = await http(new Request(downloadEndpoint), "dashboard")
  expect(download?.status).toBe(200)
  expect(download?.headers.get("cache-control")).toBe("no-store")
  expect((await port.preserve(new Request("https://example.test/reviews", { method: "POST" }), payload)).status).toBe("denied")
})
