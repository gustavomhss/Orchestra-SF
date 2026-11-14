import path from "node:path"
import { ModelV2 } from "@orchestra/core/model"
import { Schema } from "effect"
import { createResidentAiBundle } from "../../../product/ai/resident.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { AuthorizedCaseProjection, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import { forecastAnalysisForm, forecastAnalysisScript } from "../../../product/ui/forecast-analysis.ts"
import { documentHtml, pageMain } from "../../../src/screen-shell.ts"

// UI-only regression proof for FIN-IND-004. The renderer, distributed resident
// catalog, complete client script and browser form semantics are real. Case data
// and HTTP responses are explicit fixtures; no native run, financial producer,
// contribution acceptance or AM05 outcome is claimed by this test.
// Actions order: wp01/browser-startup.test.ts, this file, wp01/browser-lifecycle.test.ts.
export async function forecastPage() {
  const root = path.resolve(import.meta.dir, "../../../product/ai")
  const bundle = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/resident.json") })
  const profile = bundle.profiles.find((item) => item.id === "sf_finance")
  const skill = bundle.skills.find((item) => item.id === "sf-explicar-forecast")
  if (!profile || !skill) throw new Error("The installed finance profile and forecast skill must be present")
  const models = [Schema.decodeUnknownSync(ModelV2.Ref)({ providerID: "ui-fixture-catalog", id: "ui-fixture-model" })]
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const sources = ["baseline", "candidate"].map((id): BusinessEvidenceRef => {
    const ref: BusinessEvidenceRef = {
      schema: "sf-evidence-v1", refId: `ui-fixture-${id}`, installationId: "ui-fixture-installation", projectId: "ui-fixture-project",
      refDigest: "", evidenceLevel: "observed", kind: "record",
      target: { surface: "planner", recordType: "planner-version", recordId: id, incarnation: `ui-fixture-${id}-incarnation`, version: 1,
        fields: ["forecast"], period, projectionDigest: digestSfValue({ fixture: id }) },
    }
    return { ...ref, refDigest: digestSfEvidenceRef(ref) }
  })
  const projection: AuthorizedCaseProjection = {
    context: { installationId: "ui-fixture-installation", projectId: "ui-fixture-project", principalRef: "ui-fixture-reader", policyVersion: "1", accessRevision: "1", kind: "ui" },
    case: { id: "ui-fixture-case", incarnation: "ui-fixture-case-incarnation", version: 3, state: "investigating", objective: "Explain the selected forecast change",
      horizon: period, currency: "USD", criteria: [], participants: ["ui-fixture-reader"], sourceRefs: sources,
      alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] },
    events: [], evidenceRefs: sources, checkedAt: "2026-11-14T12:00:00Z",
  }
  const unavailable = async (): Promise<never> => { throw new Error("This renderer fixture must not call an in-process domain or native service") }
  const services: Pick<SfHostServices, "selected" | "models" | "analyses" | "forecastInputs"> = {
    selected: [{ profile, skills: [skill], manifestDigest: bundle.manifestDigest, operationIds: skill.allowedOperations }],
    models: async () => models,
    analyses: { start: unavailable, list: unavailable, read: unavailable, output: unavailable, cancel: unavailable },
    forecastInputs: { prepare: unavailable },
  }
  // forecastAnalysisForm currently accepts the full host type, but reads only
  // this catalog surface. This cast marks the UI fixture boundary, never a host.
  const form = await forecastAnalysisForm(projection, services as SfHostServices)
  const html = documentHtml("Dashboard", "dashboard", "", pageMain({ drawn: true, key: "Budget Overview", index: 2 }, `${form}<script>${forecastAnalysisScript}</script>`), "")
  const caseRef = { id: projection.case.id, incarnation: projection.case.incarnation, version: projection.case.version }
  return { html, sources, caseRef, request: {
    caseRef, objective: projection.case.objective, profileId: profile.id, profileVersion: profile.version,
    skillId: skill.id, skillVersion: skill.version, manifestDigest: bundle.manifestDigest,
    outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: skill.allowedOperations,
  }, model: models[0] }
}

