import { expect, test } from "bun:test"
import path from "node:path"
import { ModelV2 } from "@orchestra/core/model"
import { Schema } from "effect"
import { createResidentAiBundle } from "../../../product/ai/resident.ts"
import type { AuthorizedCaseProjection, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { createSfWorkbenchHttp } from "../../../product/interface/http.ts"
import { sourcingAnalysisForm } from "../../../product/procurement/sourcing-analysis.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const request: Extract<BusinessEvidenceRef, { kind: "record" }> = {
  schema: "sf-evidence-v1", refId: "authorized-request-source", installationId: "installation", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", kind: "record",
  target: { surface: "procurement", recordType: "procurement-request", recordId: "PR-1<&", incarnation: "request-incarnation", version: 4, fields: ["sourcing"], period, projectionDigest: "b".repeat(64) },
}

function projection(refs: readonly BusinessEvidenceRef[]): AuthorizedCaseProjection {
  return {
    context: { installationId: "installation", projectId: "project", principalRef: "buyer", policyVersion: "1", accessRevision: "1", kind: "ui" },
    case: { id: "decision", incarnation: "decision-incarnation", version: 3, state: "investigating", objective: 'Compare <&quot;> "authorized" proposals', horizon: period, currency: "USD",
      criteria: [], participants: ["buyer"], sourceRefs: refs, alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] },
    events: [], evidenceRefs: refs, checkedAt: "2026-11-13T12:00:00Z",
  }
}

async function fixture() {
  const root = path.resolve(import.meta.dir, "../../../product/ai")
  const bundle = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/resident.json") })
  const profile = bundle.profiles.find((item) => item.id === "sf_procurement")!
  const skills = bundle.skills.filter((item) => item.id === "sf-comparar-sourcing")
  const unavailable = async (): Promise<never> => { throw new Error("Rendering must never execute an analysis or prepare domain material") }
  // A renderer catalog fixture is a selector only. It is never used as native-run evidence.
  const models = [Schema.decodeUnknownSync(ModelV2.Ref)({ providerID: "provided-catalog", id: "provided-model" })]
  const runtime = {
    selected: [{ profile, skills, manifestDigest: bundle.manifestDigest, operationIds: ["sf_sourcing_compare", "sf_request_read"] }],
    models: async () => models,
    analyses: { start: unavailable, list: unavailable, read: unavailable, output: unavailable, cancel: unavailable },
    sourcingInputs: { prepare: unavailable },
  } satisfies Parameters<typeof sourcingAnalysisForm>[1]
  return { runtime, models, bundle }
}

test("sourcing entry renders only attached authorized request selectors with the verified resident manifest and supplied catalog", async () => {
  const { runtime, models, bundle } = await fixture()
  const refs: BusinessEvidenceRef[] = [request,
    { ...request, refId: "supplier-source", target: { ...request.target, recordType: "procurement-supplier" } },
    { ...request, refId: "planner-source", target: { ...request.target, surface: "planner", recordType: "planner-version" } },
    { ...request, refId: "request-without-sourcing", target: { ...request.target, fields: ["status"] } },
    { ...request, refId: "unobserved-request", evidenceLevel: "claim" },
  ]
  const html = await sourcingAnalysisForm(projection(refs), runtime)
  const config: string[] = []
  const selected: string[] = []
  const history: string[] = []
  // Bun HTMLRewriter exposes serialized attributes; a browser's dataset decodes them.
  // Decode each entity once, preserving an escaped literal entity in user data.
  const entities: Record<string, string> = { "&quot;": '"', "&amp;": "&", "&lt;": "<", "&gt;": ">", "&#39;": "'" }
  const attribute = (value: string) => value.replace(/&(?:quot|amp|lt|gt|#39);/g, (entity) => entities[entity] ?? entity)
  await new HTMLRewriter()
    .on("form[data-sourcing-analysis]", { element: (element) => { config.push(attribute(element.getAttribute("data-config")!)) } })
    .on('select[name="requestRef"] option', { element: (element) => {
      if (!element.hasAttribute("value")) throw new Error("Every request option must declare its value")
      // HTMLRewriter reports the explicitly empty placeholder attribute as null.
      selected.push(element.getAttribute("value") ?? "")
    } })
    .on("[data-analysis-history]", { element: (element) => { history.push(attribute(element.getAttribute("data-case")!)) } })
    .transform(new Response(html)).text()
  expect(selected).toEqual(["", request.refId])
  expect(html).toContain('<option value="">Choose an attached request</option>')
  expect(config).toHaveLength(1)
  expect(JSON.parse(config[0]!)).toEqual({ caseRef: { id: "decision", incarnation: "decision-incarnation", version: 3 }, objective: 'Compare <&quot;> "authorized" proposals',
    profileId: "sf_procurement", profileVersion: runtime.selected[0]!.profile.version, skillId: "sf-comparar-sourcing", skillVersion: runtime.selected[0]!.skills[0]!.version,
    manifestDigest: bundle.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: ["sf_request_read", "sf_sourcing_compare"], requestRefs: [request.refId], models })
  expect(history).toEqual([JSON.stringify({ id: "decision", incarnation: "decision-incarnation", version: 3 })])
  expect(html).toContain("Request PR-1&lt;&amp;")
  expect(html).not.toContain("supplier-source")
  expect(html).not.toContain("planner-source")
  expect(html).not.toContain("request-without-sourcing")
  expect(html).not.toContain("unobserved-request")
  expect(html).not.toContain("data-forecast-analysis")
})

test("sourcing entry remains unavailable without a catalog, sourcing source or mounted analysis port", async () => {
  const { runtime } = await fixture()
  for (const current of [{ ...runtime, models: async () => [] }, { ...runtime, models: async () => { throw new Error("catalog unavailable") } },
    { ...runtime, sourcingInputs: undefined }, { ...runtime, analyses: undefined }, { ...runtime, selected: [] }]) {
    const html = await sourcingAnalysisForm(projection([request]), current)
    expect(html).not.toContain("data-sourcing-analysis")
    expect(html).not.toContain("provided-model")
  }
  const html = await sourcingAnalysisForm(projection([{ ...request, target: { ...request.target, fields: ["status"] } }]), runtime)
  expect(html).toContain("needs an authorized procurement request with sourcing evidence")
  expect(html).not.toContain("data-sourcing-analysis")
})

test("sourcing input is mounted in the workbench and refuses absent runtime or an unrelated origin and path", async () => {
  const handler = createSfWorkbenchHttp({ origin: "http://localhost", mount: "/sucafina", runtime: () => undefined })
  const request = new Request("http://localhost/sucafina/procurement?sf=workbench-sourcing-input", { method: "POST" })
  expect((await handler(request, "procurement"))?.status).toBe(503)
  expect((await handler(new Request("https://unrelated.invalid/sucafina/procurement?sf=workbench-sourcing-input"), "procurement"))?.status).toBe(403)
  expect((await handler(new Request("http://localhost/wrong/procurement?sf=workbench-sourcing-input"), "procurement"))?.status).toBe(403)
})
