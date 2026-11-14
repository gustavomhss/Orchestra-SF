import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { SessionSchema } from "@orchestra/core/session/schema"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { ProductContext } from "../../../product/contracts/context.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { ResidentProfile, SkillLoadReceipt } from "../../../product/contracts/resident-ai.ts"
import { createSfExecutionBindingRegistry } from "../../../product/host-binding/execution-context.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { projectSfProcurementScope } from "../../../product/integration/procurement-projections.ts"
import { buildPlannerFinancialProjection, projectPlannerSource } from "../../../product/planner/port.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import { createProcurementCollectionRegistry, createProcurementSourceResolver } from "../../../product/procurement/sources.ts"
import { selection } from "../wp10/resident-runtime/fixture.ts"
import inputs from "./fixtures/consumer-inputs.json"

const period = { start: "2027-01-01", end: "2027-01-31" }
const identity = { installationId: "synthetic-installation", projectId: "synthetic-project", principalRef: "synthetic-buyer", accessRevision: "synthetic-access", policyVersion: "synthetic-policy" }

test("C02 does not publish a sum of valid USD and EUR amounts without FX", async () => {
  const authorized = await admitUi("sf_forecast_compare")
  const projection = (fx: { cur: string; rate: number }[]) => {
    const snapshot: Snapshot = { data: { versions: [{
      id: "synthetic-mixed-currency", year: 2027, closed: 0, locked: false,
      lines: [
        { id: "usd", sec: "opex", el: "services", cur: "USD", b: [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], a: [], f: [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
        { id: "eur", sec: "opex", el: "licenses", cur: "EUR", b: [50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], a: [], f: [50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      ], fx, hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {},
    }] }, versions: {}, sequences: {}, audit: [], notices: [] }
    const source = projectPlannerSource(snapshot, inputs.authorization.finance, "synthetic-mixed-currency")
    if (!source) throw new Error("The real Planner source did not project the synthetic version")
    const ref: Extract<BusinessEvidenceRef, { kind: "record" }> = {
      schema: "sf-evidence-v1", kind: "record", refId: "synthetic-mixed-currency", installationId: identity.installationId,
      projectId: identity.projectId, refDigest: "", evidenceLevel: "observed", target: {
        surface: "planner", recordType: "planner-version", recordId: "synthetic-mixed-currency", incarnation: "synthetic-version-v1",
        version: 1, fields: Object.keys(source).sort(), period, projectionDigest: digestSfValue({ versionId: "synthetic-mixed-currency", projection: source }),
      },
    }
    return buildPlannerFinancialProjection({ projection: source, ref: { ...ref, refDigest: digestSfEvidenceRef(ref) }, period, binding: authorized.binding, at: "2027-01-01T00:00:00Z" })
  }
  const missing = projection([])
  expect(missing.values.find((value) => value.id === "eur:1:forecast")).toMatchObject({ value: 50, currency: "EUR" })
  expect(missing.components.find((component) => component.id === "usd:1")).toMatchObject({ amount: 100, currency: "USD" })
  expect(missing.components.find((component) => component.id === "eur:1")).toMatchObject({ amount: null, evidenceState: "absent" })
  expect(missing.values.filter((value) => value.id.endsWith(":outlook"))).toEqual([expect.objectContaining({ value: null, evidenceState: "absent" })])
  expect(missing.missing).toContainEqual({ field: "eur:1:fx", reason: "missing-fx" })
  const converted = projection([{ cur: "EUR", rate: 1.2 }])
  expect(converted.components.find((component) => component.id === "eur:1")).toMatchObject({ amount: 60, currency: "USD" })
  expect(converted.values.filter((value) => value.id.endsWith(":outlook"))).toEqual([expect.objectContaining({ value: 160, currency: "USD" })])
})

test("C01 resolves a well-formed absent reference and refuses real restricted supplier fields", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-wp00-boundaries-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: projectSfProcurementScope })
    await persistence.initializeSources("procurement")
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { requests: {}, settings: { currency: "USD" }, suppliers: [{ id: "synthetic-supplier", legalName: "Synthetic public supplier", iban: "synthetic-restricted-bank-value" }] }
      return { commit: true, value: undefined }
    })
    const authorized = await admitUi("sf_supplier_read")
    const context: ProductContext = { ...identity, surface: "procurement", period, currency: "USD", sourceRefs: [], capabilities: ["sf_supplier_read"] }
    const host: DomainPortHost = {
      persistence,
      requestFor: (binding) => binding.kind === "ui" ? authorized.ui.requestFor(binding) : undefined,
      revalidate: (binding) => binding.kind === "ui" ? authorized.ui.revalidate(binding) : Promise.resolve(false),
      environment: async () => ({ at: "2027-01-01T00:00:00Z", directory: [], id: randomUUID }),
      authenticate: async (request) => request === authorized.request ? { id: identity.principalRef, canWrite: true, roles: [{ surface: "procurement", role: "buyer" }] } : null,
    }
    const sources = createProcurementSourceResolver({ host, scopedSources: persistence, contextFor: async () => ({ status: "ok", value: context }) })
    const collections = createProcurementCollectionRegistry({ host, scopedSources: persistence, contextFor: async () => ({ status: "ok", value: context }) })
    const port = createProcurementPort({ ...host, ...collections, resolveRequestSource: sources.resolve, resolveSupplierSource: sources.resolve,
      isCurrentRequestSource: sources.isCurrent, isCurrentSupplierSource: sources.isCurrent,
      readContractSource: async () => ({ status: "unavailable", reason: "Contract reading is outside this supplier test" }),
    })
    const issued = await sources.issue("procurement-supplier", "synthetic-supplier", authorized.binding)
    expect(issued.status).toBe("ok")
    if (issued.status !== "ok") throw new Error(`Real supplier source issuance failed: ${issued.reason}`)
    const publicResult = await port.readSupplier({ supplierRef: issued.value, fields: ["legalName"] }, authorized.binding)
    expect(publicResult).toMatchObject({ status: "ok", value: { values: [{ id: "legalName", value: "Synthetic public supplier" }] } })
    expect(JSON.stringify(publicResult)).not.toContain("synthetic-restricted-bank-value")
    expect(JSON.stringify(publicResult)).not.toContain("iban")

    // This follows the real resolver's valid syntax; only the issued incarnation is absent.
    const invented = `sf-procurement:${encodeURIComponent("synthetic-never-issued")}:1`
    expect(invented).toMatch(/^sf-procurement:[^:]+:[1-9]\d*$/)
    expect(await sources.resolve(invented, authorized.binding)).toEqual({ status: "unavailable", reason: "Source unavailable" })
    expect(await port.readSupplier({ supplierRef: invented, fields: ["legalName"] }, authorized.binding)).toEqual({ status: "unavailable", reason: "Source unavailable" })
    expect(await sources.issue("procurement-supplier", "synthetic-missing-supplier", authorized.binding)).toEqual({ status: "unavailable", reason: "Source unavailable" })
    expect(await port.readSupplier({ supplierRef: issued.value, fields: ["iban"] }, authorized.binding)).toEqual({ status: "denied", reason: "Field unavailable" })
    expect(await port.readSupplier({ supplierRef: issued.value, fields: ["legalName", "iban"] }, authorized.binding)).toEqual({ status: "denied", reason: "Field unavailable" })
    expect(await persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: snapshot.data.store }))).toEqual({
      requests: {}, settings: { currency: "USD" }, suppliers: [{ id: "synthetic-supplier", legalName: "Synthetic public supplier", iban: "synthetic-restricted-bank-value" }],
    })
  } finally {
    try { await store.dispose() } finally { await rm(directory, { recursive: true, force: true }) }
  }
})

test("C16 rejects an empty SkillLoadReceipt list before authority lookup while a matching receipt admits", async () => {
  // The registry and validation are real; this fixture does not qualify a native Session/model run.
  const profile: ResidentProfile = { id: "sf_finance", version: "1", mission: "Synthetic finance fixture", sourcePath: "profile.json", sourceDigest: "a".repeat(64),
    allowedSkills: ["sf-explicar-forecast"], allowedOperations: ["sf_forecast_compare", "sf_context_get"], outputTypes: [], contextBudgetTokens: 1000,
    maxSteps: 2, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh" }
  const sessionID = SessionSchema.ID.make("ses_wp00_missing_receipt")
  const request = new Request("https://synthetic.invalid/wp00")
  const calls: string[] = []
  const registry = createSfExecutionBindingRegistry({
    authenticateAndResolve: async () => {
      calls.push("authenticate")
      return { ...identity, hostId: "synthetic-host", locationId: "synthetic-location", providerGeneration: 1, expiresAt: new Date(Date.now() + 60_000).toISOString() }
    },
    revalidateAdmission: async () => { calls.push("revalidate"); return true },
  })
  const admission = { request, selected: selection(profile), sessionID, runId: "synthetic-run", caseRef: { id: "synthetic-case", incarnation: "synthetic-case-v1", version: 1 },
    profile, manifestDigest: "d".repeat(64), entryMode: "interactive" as const }
  expect(await registry.bind({ ...admission, skillReceipts: [] })).toEqual({ status: "denied", reason: "invalid-native-admission" })
  expect(calls).toEqual([])
  const receipt: SkillLoadReceipt = { runId: admission.runId, nativeSessionId: sessionID, profileId: profile.id, profileVersion: profile.version,
    profileDigest: profile.sourceDigest, skillId: "sf-explicar-forecast", skillVersion: "1", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64),
    loadedMessageId: "synthetic-loaded-message", loadedAt: "2026-11-13T04:01:10Z", manifestDigest: admission.manifestDigest }
  const bound = await registry.bind({ ...admission, skillReceipts: [receipt] })
  expect(bound.status).toBe("ok")
  expect(calls).toEqual(["authenticate", "revalidate"])
  if (bound.status === "ok") registry.revoke(bound.value)
})

async function admitUi(operation: string) {
  const request = new Request("https://synthetic.invalid/wp00")
  const ui = createSfUiAuthority({ authorize: async (candidate) => candidate === request ? identity : undefined,
    commandIdentity: async () => "synthetic-command", createId: randomUUID, now: Date.now })
  const inputDigest = digestSfValue({ synthetic: true, operation })
  const admitted = await ui.admit(request, operation, inputDigest)
  expect(admitted.status).toBe("ok")
  if (admitted.status !== "ok") throw new Error(`Real UI authority refused the synthetic fixture: ${admitted.reason}`)
  expect(await ui.validate(admitted.value, operation, inputDigest)).toBe(true)
  return { request, ui, binding: admitted.value }
}
