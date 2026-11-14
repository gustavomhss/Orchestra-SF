import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { Location } from "@orchestra/core/location"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { createSfProductState } from "../../../../product/host-binding/state-provider.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import { testPersistence } from "../../../fixture/persistence.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { sfOperationInputSchemas } from "../../../../product/contracts/operations.ts"
import { sfOperationOutputSchemas } from "../../../../product/contracts/output-schemas.ts"
import { decodeSfOperationOutput } from "../../../../product/contracts/schema-admission.ts"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfExtendedBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/extended-business-services.ts"
import { createSfExtendedAssets } from "../../../../../../../apps/cli/src/sucafina-product/extended-assets.ts"
import { readSfDecisionBiSelection, readSfPlannerBiSelection, sfDecisionBiSelection, sfPlannerBiSelection } from "../../../../../../../apps/cli/src/sucafina-product/bi-selections.ts"

async function setup() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-extended-composition-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(join(directory, "store"))
  const active = { value: true }
  const at = "2026-11-14T00:00:00Z"
  const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, createId: randomUUID,
    projectScope: createSfSourceScopeProjector(() => at) })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "person" }]
    snapshot.data.opexOwners = [{ id: "owner", budget: 1200 }]
    snapshot.data.opexEntries = []
    snapshot.data.capexProjects = []
    snapshot.data.capexEntries = []
    return { commit: true, value: undefined }
  })
  const guards = { proposalCoverageWrites: new WeakSet<object>(), dashboardHostWrites: new WeakSet<object>(), procurementEvidenceWrites: new WeakSet<object>(),
    caseSelectionWrites: new WeakSet<object>(), threadHistoryWrites: new WeakSet<object>(), analysisSelectionWrites: new WeakSet<object>() }
  const authority = createSfProductAuthority({ installationId: "installation", origin: "https://example.test", policyVersion: "policy", ...guards,
    identity: () => ({ installationId: "installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }),
    persistence, grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "bi-artifacts", "reviews", "documents", "threads", "relations", "confirmations"],
      operations: ["sf_dashboard_read", "sf_bi_view", "sf_review_prepare", "sf_report_prepare", "sf_artifact_get", "sf_portfolio_evaluate", "sf_sensitivity_evaluate"],
      humanActions: ["bi.artifact.save", "bi.artifact.read", "bi.selection.set", "bi.selection.read", "decisions.sensitivity.select", "decisions.sensitivity.selection.read", "reviews.preserve"] }],
    createId: randomUUID, now: Date.now, commandIdentity: async () => randomUUID(),
    authenticate: async (_request, context) => active.value && context ? { id: "person", canWrite: true, roles: [{ surface: context.surface, role: "admin" }] } : null,
    environment: async () => ({ at, id: randomUUID, directory: [] }), inspectSession: async () => undefined,
    verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined })
  const business = createSfBusinessServices({ authority, persistence, ...guards })
  const extended = createSfExtendedBusinessServices({ authority, business, persistence, ...guards, origin: "https://example.test" })
  return { extended, business, active, dispose: async () => { extended.dispose(); business.dispose(); await store.dispose(); await rm(directory, { recursive: true, force: true }) } }
}

test("the installed factories mount six unique canonical operations and read BI through the real source store", async () => {
  const fixture = await setup()
  try {
    const { extended, business } = fixture
    expect(extended.descriptors.map((descriptor) => descriptor.id).sort()).toEqual([
      "sf_artifact_get", "sf_bi_view", "sf_portfolio_evaluate", "sf_report_prepare", "sf_review_prepare", "sf_sensitivity_evaluate",
    ])
    const replaced = new Set(extended.replacements.map((descriptor) => descriptor.id))
    const composed = [...business.descriptors.filter((descriptor) => !replaced.has(descriptor.id)), ...extended.replacements, ...extended.descriptors]
    expect(new Set(composed.map((descriptor) => descriptor.id)).size).toBe(composed.length)
    for (const descriptor of extended.descriptors) {
      const operation = descriptor.id as keyof typeof sfOperationInputSchemas
      expect(descriptor.inputSchema).toEqual(sfOperationInputSchemas[operation])
      expect(descriptor.outputSchema).toEqual(sfOperationOutputSchemas[operation])
    }
    expect(extended.analysisBindings.biSelection).toBeFunction()
    expect(extended.analysisBindings.selectedSensitivity).toBeFunction()
    expect(extended.analysisBindings.changeProposals.readSet).toBeFunction()
    expect(extended.replacements.some((descriptor) => descriptor.id === "sf_change_prepare")).toBe(true)
    expect(extended.replacements.some((descriptor) => descriptor.id === "sf_alternative_draft")).toBe(true)
    expect(extended.analysisBindings.replayAlternative).toBeFunction()
    expect(extended.portfolioProof).toBeDefined()
    const url = "https://example.test/dashboard?sf=bi-data&viewId=BI01&start=2026-01-01&end=2026-12-31"
    const response = await extended.productHttp(new Request(url), "dashboard")
    expect(response?.status).toBe(200)
    const value: unknown = await response!.json()
    expect(value).toHaveProperty("receipt.kind", "ui")
    if (!value || typeof value !== "object" || !("projection" in value)) throw new Error("BI projection missing")
    expect(decodeSfOperationOutput("sf_bi_view", value.projection).ok).toBe(true)
    fixture.active.value = false
    expect((await extended.productHttp(new Request(url), "dashboard"))?.status).toBe(403)
    expect((await extended.productHttp(new Request(url), "planner"))?.status).toBe(403)
  } finally { await fixture.dispose() }
})

test("analysis selections require the exact private write capability and an authenticated actor", async () => {
  const storage = testPersistence()
  const analysisSelectionWrites = new WeakSet<object>()
  let authenticated = true
  const state = createSfProductState({ persistence: storage.persistence, analysisSelectionWrites,
    authorize: async () => authenticated ? { principalRef: "person", accessRevision: "access", policyVersion: "policy" } : undefined,
    createId: () => "state", resolveTarget: async () => ({ incarnation: "incarnation" }) })
  const command = { namespace: "preferences" as const, expectedStorageVersion: 0, targetRef: "case", targetIncarnation: "incarnation", idempotencyKey: "select", commandDigest: "a".repeat(64) }
  const work = async (value: SfProductState) => {
    value.preferences["sf:analysis-selection:chosen"] = { projectionRef: "projection", tableRef: "table" }
    return { commit: true, value: true }
  }
  const request = new Request("https://example.test/product")
  expect(await state.transaction(request, command, work)).toMatchObject({ status: "denied", reason: "analysis-selection-writer-required" })
  analysisSelectionWrites.add(work)
  expect(await state.transaction(request, command, (value) => work(value))).toMatchObject({ status: "denied", reason: "analysis-selection-writer-required" })
  authenticated = false
  expect(await state.transaction(request, command, work)).toMatchObject({ status: "denied" })
  authenticated = true
  expect(await state.transaction(request, command, work)).toMatchObject({ status: "ok", storageVersion: 1 })
})

test("BI selector envelopes cannot introduce extra scope fields or malformed operation input", () => {
  const comparison = { baseRef: "base", candidateRef: "candidate", period: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD" }
  expect(readSfPlannerBiSelection(sfPlannerBiSelection(comparison))).toEqual(comparison)
  expect(readSfPlannerBiSelection("sf-bi-planner:%zz")).toBeUndefined()
  expect(readSfPlannerBiSelection(`sf-bi-planner:${encodeURIComponent(JSON.stringify({ ...comparison, role: "admin" }))}`)).toBeUndefined()
  expect(readSfDecisionBiSelection(sfDecisionBiSelection({ scenarioResultRef: "scenario", comparisonRef: "comparison" }))).toEqual({ scenarioResultRef: "scenario", comparisonRef: "comparison" })
  expect(readSfDecisionBiSelection(`sf-bi-decision:${encodeURIComponent(JSON.stringify({ scenarioResultRef: "scenario", comparisonRef: "comparison", accessRevision: "forged" }))}`)).toBeUndefined()
})

test("the hosted build creates real BI and review browser bundles and memoizes successful outputs", async () => {
  const assets = createSfExtendedAssets()
  try {
    const bi = await assets.bi()
    const reviews = await assets.reviews()
    expect(bi.length).toBeGreaterThan(100)
    expect(reviews.length).toBeGreaterThan(100)
    expect(bi).not.toContain("Bun.CryptoHasher")
    expect(reviews).not.toContain("Bun.CryptoHasher")
    expect(await assets.bi()).toBe(bi)
    expect(await assets.reviews()).toBe(reviews)
  } finally { assets.dispose() }
})
