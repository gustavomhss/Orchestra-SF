import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfSourcingInput, createSfSourcingVerifier } from "../../../../../../apps/cli/src/sucafina-product/analysis-verifier-procurement.ts"
import { createSfBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfSourcingInputs } from "../../../../../../apps/cli/src/sucafina-product/sourcing-inputs.ts"
import atlasPackage from "../../../../../atlas/boundary/package.json" with { type: "json" }
import contractFreeze from "../../../product/contracts/freeze-v1.json" with { type: "json" }
import { openLocalStore } from "../../../runtime/local-store.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"
import { digestSfContribution, digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfContributionEnvelope, decodeSfContributionOutput, decodeSfOperationInput, decodeSfOperationOutput, decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import type { ContributionEnvelope } from "../../../product/contracts/resident-ai.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createResidentAiBundle } from "../../../product/ai/resident.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createSfProcurementSourceAccess } from "../../../product/decision-memory/source-access.ts"
import { createProcurementCapabilities } from "../../../product/procurement/capabilities.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import { createProcurementSourceResolver } from "../../../product/procurement/sources.ts"
import { projectProcurementScope } from "../../../product/procurement/source-projection.ts"
import { createProcurementSourcingEvidence } from "../../../product/procurement/sourcing-evidence.ts"
import { handleSfSourcingInput } from "../../../product/procurement/sourcing-input-http.ts"
import { createProcurementUiBindings } from "../../../product/procurement/ui-bindings.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const at = "2026-11-13T00:00:00Z"

test("sourcing comparison crosses the shared dispatcher with frozen money, criteria and a real UI receipt", async () => {
  const fixture = await sourcingFixture()
  try {
    const before = await fixture.requestMaterial()
    const result = await fixture.compare()
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error("shared sourcing dispatch unavailable")
    const decoded = decodeSfOperationOutput("sf_sourcing_compare", result.result)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("closed comparison schema refused actual producer")
    expect(decodeSfContributionOutput("CommercialComparison", result.result).ok).toBe(true)
    expect(decoded.value.ranking).toEqual(["A", "B"])
    expect(decoded.value.weights?.technical).toBe(60)
    expect(decoded.value.weights?.commercial).toBe(40)
    expect(decoded.value.weights?.technicalCriteria).toHaveLength(5)
    expect(decoded.value.weights?.commercialCriteria).toHaveLength(3)
    const euro = decoded.value.proposals.find((proposal) => proposal.proposalRef === "B")
    expect(euro?.money).toEqual({ originalAmount: 28000, originalCurrency: "EUR", baseCurrency: "USD", fxRate: 1.08, fxSource: "submitted" })
    expect(euro?.convertedAmount).toBeCloseTo(30240, 6)
    expect(euro?.components?.overall).toBe(85)
    expect(decoded.value.proposals.find((proposal) => proposal.proposalRef === "A")?.score).toBeCloseTo(87.93333333333334, 10)
    expect(decoded.value.proposals.find((proposal) => proposal.proposalRef === "C")?.eligible).toBe(false)
    expect(decoded.value.selection).toEqual({ proposalRef: "A", reason: "Recorded technical preference" })
    expect(decoded.value.sourceRefs).toEqual([fixture.evidence])
    expect(result.receipt.kind).toBe("ui")
    if (result.receipt.kind !== "ui") throw new Error("UI receipt absent")
    expect(result.receipt.handlerExport).toBe("compareSourcing")
    expect(result.receipt.principalRef).toBe("buyer")
    expect(result.receipt.inputDigest).toBe(digestSfValue(fixture.payload))
    expect(result.receipt.resultDigest).toBe(digestSfValue(result.result))
    expect(await fixture.requestMaterial()).toEqual(before)

    expect(decodeSfOperationOutput("sf_sourcing_compare", { ...decoded.value, actor: "forged" }).ok).toBe(false)
    expect(decodeSfOperationOutput("sf_sourcing_compare", { ...decoded.value, proposals: decoded.value.proposals.map((proposal) => ({ ...proposal, money: { ...proposal.money, secret: "extra" } })) }).ok).toBe(false)
    expect(decodeSfOperationOutput("sf_sourcing_compare", { ...decoded.value, weights: { ...decoded.value.weights, forgedWeight: 1 } }).ok).toBe(false)
    expect(decodeSfOperationOutput("sf_sourcing_compare", { ...decoded.value, proposals: decoded.value.proposals.map((proposal) => ({ ...proposal, score: Number.NaN })) }).ok).toBe(false)

    const call = await fixture.admit("sf_sourcing_compare", fixture.payload, false)
    expect((await fixture.dispatch({ ...fixture.payload, actor: "forged" }, call)).status).toBe("denied")
    expect((await fixture.dispatch(fixture.payload, call)).status).toBe("ok")
    expect((await fixture.dispatch(fixture.payload, call)).status).toBe("denied")
  } finally { await fixture.dispose() }
})

test("incomplete sourcing remains conditioned across the closed shared dispatcher and input verifier", async () => {
  for (const variant of ["missing-fx", "missing-assessment", "single-offer"] as const) {
    const fixture = await sourcingFixture(variant)
    try {
      const result = await fixture.compare()
      expect(result.status).toBe("ok")
      if (result.status !== "ok") throw new Error(`${variant}: sourcing dispatch unavailable`)
      const comparison = decodeSfOperationOutput("sf_sourcing_compare", result.result)
      if (!comparison.ok) throw new Error(`${variant}: closed comparison schema refused output`)
      expect(comparison.value.ranking).toEqual([])
      expect(comparison.value.proposals.every((proposal) => proposal.score === null)).toBe(true)
      expect(comparison.value.conditions.length).toBeGreaterThan(0)
      if (variant === "missing-fx") expect(comparison.value.proposals.find((proposal) => proposal.proposalRef === "B")?.convertedAmount).toBeNull()
      const input = await fixture.prepareInput(fixture.evidence.refId, fixture.issuer)
      expect(input.status).toBe("ok")
      if (input.status !== "ok") throw new Error(`${variant}: explicit incomplete material unavailable`)
      expect((await fixture.verifier.verify(input.value, fixture.analysisRequest, fixture.issuer)).status).toBe("ok")
      if (variant === "missing-fx") expect(input.value.submittedFx.find((rate) => rate.from === "EUR")?.rate).toBeNull()
    } finally { await fixture.dispose() }
  }
})

test("sourcing verifier checks current weights, manual requirements, evidence and offer eligibility", async () => {
  const fixture = await sourcingFixture()
  try {
    const prepared = await fixture.prepareInput(fixture.evidence.refId, fixture.issuer)
    if (prepared.status !== "ok") throw new Error("host sourcing input unavailable")
    const input = prepared.value
    expect(input.weightsAndEligibility).toHaveLength(10)
    expect(input.weightsAndEligibility.find((criterion) => criterion.criterionRef === '["procurement-sourcing-v1","technical",0,"Functional / technical fit"]')).toEqual({ criterionRef: '["procurement-sourcing-v1","technical",0,"Functional / technical fit"]', weight: 35, required: true, evidenceRefs: [fixture.evidence] })
    expect(input.weightsAndEligibility.find((criterion) => criterion.criterionRef === '["procurement-sourcing-v1","commercial",0,"Price (calculated — lowest offer scores highest)"]')?.required).toBe(false)
    expect((await fixture.verifier.verify(input, fixture.analysisRequest, fixture.issuer)).status).toBe("ok")
    const forged = [
      { ...input, weightsAndEligibility: [] },
      { ...input, weightsAndEligibility: input.weightsAndEligibility.map((criterion, index) => index === 0 ? { ...criterion, weight: criterion.weight + 1 } : criterion) },
      { ...input, weightsAndEligibility: input.weightsAndEligibility.map((criterion, index) => index === 2 ? { ...criterion, required: false } : criterion) },
      { ...input, weightsAndEligibility: input.weightsAndEligibility.map((criterion, index) => index === 2 ? { ...criterion, criterionRef: input.weightsAndEligibility[0]!.criterionRef } : criterion) },
      { ...input, weightsAndEligibility: input.weightsAndEligibility.map((criterion, index) => index === 2 ? { ...criterion, evidenceRefs: [] } : criterion) },
      { ...input, authorizedOffers: input.authorizedOffers.map((offer, index) => index === 0 ? { ...offer, amount: 1 } : offer) },
      { ...input, submittedFx: input.submittedFx.map((rate) => rate.from === "EUR" ? { ...rate, rate: 2 } : rate) },
    ]
    for (const value of forged) expect((await fixture.verifier.verify(value, fixture.analysisRequest, fixture.issuer)).status).toBe("unavailable")
    expect((await fixture.verifier.verify({ ...input, authority: "forged" }, fixture.analysisRequest, fixture.issuer)).status).toBe("needs-input")

    await fixture.persistence.transaction("procurement", async (snapshot) => {
      const record = object(object(object(snapshot.data.store).requests)["PR-1"]).request
      const proposal = rows(object(object(record).sourcing).quotes).find((quote) => quote.id === "C")
      if (!proposal) throw new Error("noncompliant offer unavailable")
      proposal.techPass = true
      return { commit: true, value: undefined }
    })
    expect((await fixture.verifier.verify(input, fixture.analysisRequest, fixture.issuer)).status).toBe("unavailable")
    expect((await fixture.compare()).status).toBe("stale")
  } finally { await fixture.dispose() }
})

test("revoked sourcing authority cannot reuse a prepared input or a dispatched comparison", async () => {
  const fixture = await sourcingFixture()
  try {
    const input = await fixture.prepareInput(fixture.evidence.refId, fixture.issuer)
    if (input.status !== "ok") throw new Error("host sourcing input unavailable")
    expect((await fixture.compare()).status).toBe("ok")
    fixture.revoke()
    expect((await fixture.compare()).status).toBe("denied")
    expect((await fixture.prepareInput(fixture.evidence.refId, fixture.issuer)).status).toBe("denied")
    expect((await fixture.verifier.verify(input.value, fixture.analysisRequest, fixture.issuer)).status).toBe("unavailable")
  } finally { await fixture.dispose() }
})

test("case-bound sourcing input crosses the real business composition and HTTP authority boundary", async () => {
  const fixture = await sourcingFixture()
  try {
    const composed = await sourcingHostFixture(fixture)
    try {
      const before = await fixture.requestMaterial()
      const direct = await composed.authority.ui.admit(composed.post(composed.selector), "sf_sourcing_compare", digestSfValue(composed.selector))
      if (direct.status !== "ok") throw new Error("real sourcing input admission unavailable")
      expect((await composed.sourcingInputs.prepare(direct.value, composed.selector)).status).toBe("denied")
      expect(await composed.authority.ui.validate(direct.value, "sf_sourcing_compare", digestSfValue(composed.selector))).toBe(true)
      const prepared = await composed.sourcingInputs.prepare(direct.value, composed.selector)
      expect(prepared.status).toBe("ok")
      if (prepared.status !== "ok") throw new Error(`case-bound sourcing preparation failed: ${prepared.reason}`)
      expect(prepared.value.sourceRefs).toEqual([composed.evidence])
      expect(prepared.value.weightsAndEligibility).toHaveLength(10)
      composed.authority.ui.finish(direct.value)
      expect((await composed.sourcingInputs.prepare(direct.value, composed.selector)).status).toBe("denied")

      const response = await handleSfSourcingInput(composed.post(composed.selector), composed.origin, composed)
      expect(response.status).toBe(200)
      expect(response.headers.get("cache-control")).toBe("no-store")
      const body: unknown = await response.json()
      expect(object(body).status).toBe("ok")
      const decoded = decodeSfSkillInput("SourcingComparisonInput", object(body).value)
      expect(decoded.ok).toBe(true)
      if (!decoded.ok) throw new Error("HTTP returned a noncanonical sourcing input")
      expect(decoded.value).toEqual(prepared.value)
      expect(object(body)).not.toHaveProperty("authority")
      expect(object(body)).not.toHaveProperty("lease")
      expect(await fixture.requestMaterial()).toEqual(before)

      const outside = await handleSfSourcingInput(composed.post({ ...composed.selector, requestRef: composed.outsideRef }), composed.origin, composed)
      expect(outside.status).toBe(403)
      expect(await outside.json()).toEqual({ status: "denied" })
      const injected = await handleSfSourcingInput(composed.post({ ...composed.selector, authority: "forged" }), composed.origin, composed)
      expect(injected.status).toBe(400)
      const crossOrigin = await handleSfSourcingInput(composed.post(composed.selector, { origin: "https://other.invalid" }), composed.origin, composed)
      expect(crossOrigin.status).toBe(403)

      let preparedBeforeRevocation = false
      const revoked = await handleSfSourcingInput(composed.post(composed.selector), composed.origin, { ui: composed.ui, sourcingInputs: {
        prepare: async (call, selection) => {
          const result = await composed.sourcingInputs.prepare(call, selection)
          preparedBeforeRevocation = result.status === "ok"
          fixture.revoke()
          return result
        },
      } })
      expect(preparedBeforeRevocation).toBe(true)
      expect(revoked.status).toBe(403)
      expect(await revoked.json()).toEqual({ status: "denied" })
      expect(await fixture.requestMaterial()).toEqual(before)
    } finally { composed.dispose() }
  } finally { await fixture.dispose() }
})

test("sourcing output verifier rejects non-ready envelopes and tampered replay material", async () => {
  const fixture = await sourcingFixture()
  try {
    const input = await fixture.prepareInput(fixture.evidence.refId, fixture.issuer)
    if (input.status !== "ok") throw new Error("sourcing input unavailable")
    const proof = await fixture.verifier.verify(input.value, fixture.analysisRequest, fixture.issuer)
    if (proof.status !== "ok") throw new Error("sourcing proof unavailable")
    const dispatched = await fixture.compare()
    if (dispatched.status !== "ok") throw new Error("sourcing replay unavailable")
    const comparison = decodeSfOperationOutput("sf_sourcing_compare", dispatched.result)
    if (!comparison.ok) throw new Error("sourcing replay invalid")
    // These contract envelopes exercise the pure output predicate only. They are
    // never admitted or stored as a native Session or a verified SkillLoadReceipt.
    const harnessDigest = digestSfValue({ purpose: "adversarial-envelope-only; no native execution" })
    const base: Omit<Extract<ContributionEnvelope, { kind: "CommercialComparison"; state: "ready" }>, "state" | "payload"> = {
      id: "adversarial-envelope-only", caseRef: fixture.analysisRequest.caseRef, kind: "CommercialComparison", schemaVersion: "sf-contribution-v1",
      evidenceRefs: [fixture.evidence], accessRevision: fixture.issuer.binding.accessRevision, createdAt: at, outputDigest: "",
      runProvenance: { runId: "unadmitted-harness", nativeSessionId: "no-native-session", profileId: "sf_procurement", profileVersion: "1.0.0", profileDigest: harnessDigest,
        skillId: "sf-comparar-sourcing", skillVersion: "1.0.0", sourceDigest: harnessDigest, instructionsDigest: harnessDigest,
        loadedMessageId: "no-skill-load", loadedAt: at, manifestDigest: harnessDigest, actualModel: "harness/not-executed", contextFingerprint: harnessDigest },
    }
    const ready: Extract<ContributionEnvelope, { kind: "CommercialComparison"; state: "ready" }> = { ...base, state: "ready", payload: comparison.value }
    ready.outputDigest = digestSfContribution(ready)
    expect(await proof.value.acceptsOutput(ready, fixture.issuer)).toEqual({ status: "ok", value: true })
    expect((await proof.value.acceptsOutput({ ...ready, evidenceRefs: [] }, fixture.issuer)).status).toBe("unavailable")
    expect((await proof.value.acceptsOutput({ ...ready, payload: { ...ready.payload, ranking: ["B", "A"] } }, fixture.issuer)).status).toBe("unavailable")
    const stale: ContributionEnvelope = { ...base, state: "stale", reason: "adversarial non-ready envelope" }
    stale.outputDigest = digestSfContribution(stale)
    expect((await proof.value.acceptsOutput(stale, fixture.issuer)).status).toBe("unavailable")
    // Also attack the predicate directly with a mutated runtime object. The
    // closed envelope decoder and the autonomous predicate must both reject it.
    const malformed = structuredClone(ready)
    expect(Reflect.set(malformed, "state", "stale")).toBe(true)
    malformed.outputDigest = digestSfContribution(malformed)
    expect(decodeSfContributionEnvelope(malformed).ok).toBe(false)
    expect((await proof.value.acceptsOutput(malformed, fixture.issuer)).status).toBe("unavailable")
    fixture.revoke()
    expect((await proof.value.acceptsOutput(ready, fixture.issuer)).status).toBe("unavailable")
  } finally { await fixture.dispose() }
})

async function sourcingHostFixture(fixture: Awaited<ReturnType<typeof sourcingFixture>>) {
  await fixture.persistence.transaction("procurement", async (snapshot) => {
    const store = object(snapshot.data.store)
    const requests = object(store.requests)
    const original = object(requests["PR-1"])
    requests["PR-2"] = { ...structuredClone(original), request: { ...structuredClone(object(original.request)), number: "PR-2" } }
    const issued = object(store.issued)
    if (!Array.isArray(issued.pr)) throw new Error("issued request registry unavailable")
    issued.pr = [...issued.pr, "PR-2"]
    return { commit: true, value: undefined }
  })
  const origin = "https://local.invalid"
  const proposalCoverageWrites = new WeakSet<object>()
  const procurementEvidenceWrites = new WeakSet<object>()
  const authority = createSfProductAuthority({
    identity: () => ({ installationId: "i", hostId: "sourcing-http-host", projectId: "p", location: Location.Ref.make({ directory: AbsolutePath.make(fixture.directory) }) }),
    installationId: "i", origin, policyVersion: "1", persistence: fixture.persistence, authenticate: fixture.host.authenticate, environment: fixture.host.environment,
    grants: [{ principalRef: "buyer", namespaces: ["cases", "preferences"], operations: ["sf_work_list", "sf_request_read", "sf_case_draft", "sf_sourcing_compare"] }],
    createId: randomUUID, now: Date.now, commandIdentity: async () => randomUUID(), inspectSession: async () => undefined,
    verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
    proposalCoverageWrites, procurementEvidenceWrites,
  })
  const business = createSfBusinessServices({ authority, persistence: fixture.persistence, proposalCoverageWrites, procurementEvidenceWrites })
  const sourceRoot = path.resolve(import.meta.dir, "../../../product/ai")
  const bundle = await createResidentAiBundle({ root: sourceRoot, manifestPath: path.join(sourceRoot, "manifests/resident.json") })
  business.initializeAtlas(undefined, { boundaryVersion: atlasPackage.version, schemaVersion: contractFreeze.canonicalSha256,
    manifestVersion: bundle.manifestDigest, skillVersion: digestSfValue(bundle.skills.map((skill) => ({ id: skill.id, version: skill.version, sourceDigest: skill.sourceDigest }))) })
  const post = (payload: unknown, headers: Record<string, string> = {}) => new Request(`${origin}/procurement?sf=sourcing-input`, {
    method: "POST", headers: { authorization: "Bearer buyer", origin, "content-type": "application/json", "idempotency-key": randomUUID(), ...headers }, body: JSON.stringify(payload),
  })
  const admit = async (operation: string, payload: unknown) => {
    const result = await authority.ui.admit(post(payload), operation, digestSfValue(payload))
    if (result.status !== "ok" || !await authority.ui.validate(result.value, operation, digestSfValue(payload))) throw new Error(`real composition admission unavailable: ${operation}`)
    return result.value
  }
  const selected = await admit("sf_work_list", { purpose: "work-selection", period })
  const selection = await business.procurementSelections.create(selected, period)
  if (selection.status !== "ok") throw new Error(`real procurement selection unavailable: ${selection.reason}`)
  const issued = await business.individual.issue("procurement-request", "PR-1", selected)
  const outside = await business.individual.issue("procurement-request", "PR-2", selected)
  if (issued.status !== "ok" || outside.status !== "ok") throw new Error("real request selectors unavailable")
  const source = await business.individual.resolve(issued.value, selected)
  if (source.status !== "ok") throw new Error("real source evidence unavailable")
  authority.ui.finish(selected)
  const draft = { objective: "Prepare sourcing from the selected case", criteria: ["Technical fit", "Commercial terms"], horizon: period, currency: "USD", sourceRefs: [source.value.evidence] }
  const draftCall = await admit("sf_case_draft", draft)
  const created = await business.cases.draft(draft, draftCall)
  authority.ui.finish(draftCall)
  if (created.status !== "ok") throw new Error(`real business case unavailable: ${created.reason}`)
  const sourcingInputs = createSfSourcingInputs({ authority, business })
  return { authority, ui: authority.ui, sourcingInputs, origin, post, evidence: source.value.evidence, outsideRef: outside.value,
    selector: { requestRef: issued.value, caseRef: { id: created.value.id, incarnation: created.value.incarnation, version: created.value.version } },
    dispose: business.dispose,
  }
}

async function sourcingFixture(variant?: "missing-fx" | "missing-assessment" | "single-offer") {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-sourcing-dispatch-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: projectProcurementScope })
  await persistence.initializeSources("dashboard")
  await persistence.initializeSources("procurement")
  const settings = initialProcurementSettings()
  settings.fxRates = [{ code: "USD", rate: 1 }, { code: "EUR", rate: 2 }]
  const quotes = [
    { id: "A", supplier: "A", total: 32400, currency: "USD", techPass: true, scores: [5, 4, 4, 4, 4], cscores: [null, 4, 4] },
    { id: "B", supplier: "B", total: 28000, currency: "EUR", techPass: true, scores: [4, 4, 4, 3, 4], cscores: [null, 5, 4] },
    { id: "C", supplier: "C", total: 29000, currency: "USD", techPass: false, scores: [5, 5, 5, 5, 5], cscores: [null, 5, 5] },
  ]
  if (variant === "missing-assessment") quotes[0]!.cscores[2] = null
  await persistence.transaction("procurement", async (snapshot) => {
    snapshot.data.store = {
      requests: { "PR-1": { request: { number: "PR-1", createdBy: "buyer", status: "src_pending", pr: { title: "Sourcing comparison" }, sourcing: { selectedId: "A", selectionJustification: "Recorded technical preference", approvalBaseCurrency: "USD", fxSnapshot: { USD: 1, EUR: variant === "missing-fx" ? null : 1.08 }, quotes: variant === "single-offer" ? quotes.slice(0, 1) : quotes } }, version: 1, by: "buyer" } },
      settings, suppliers: [], issued: { pr: ["PR-1"], po: [] },
    }
    return { commit: true, value: undefined }
  })
  const access = { allowed: true }
  const authorized = (request: Request) => access.allowed && request.headers.get("authorization") === "Bearer buyer"
  const ui = createSfUiAuthority({
    authorize: async (request) => authorized(request) ? { installationId: "i", projectId: "p", principalRef: "buyer", accessRevision: "1", policyVersion: "1" } : undefined,
    commandIdentity: async () => randomUUID(), createId: randomUUID, now: Date.now,
  })
  const request = new Request("https://local.invalid/procurement", { headers: { authorization: "Bearer buyer" } })
  const host: DomainPortHost = {
    persistence,
    requestFor: (call) => call.kind === "ui" ? ui.requestFor(call) : undefined,
    revalidate: (call) => call.kind === "ui" ? ui.revalidate(call) : Promise.resolve(false),
    environment: async () => ({ at, directory: [], id: randomUUID }),
    authenticate: async (request) => authorized(request) ? { id: "buyer", canWrite: true, roles: [{ surface: "procurement", role: "buyer" }] } : null,
  }
  const admit = async (operation: string, payload: unknown, consume = true) => {
    const admitted = await ui.admit(request, operation, digestSfValue(payload))
    if (admitted.status !== "ok") throw new Error("UI admission unavailable")
    if (consume && !await ui.validate(admitted.value, operation, digestSfValue(payload))) throw new Error("UI intent unavailable")
    return admitted.value
  }
  const issuer = await admit("sf_request_read", { requestRef: "issuer" })
  const contextFor = async () => ({ status: "ok" as const, value: { installationId: "i", projectId: "p", principalRef: "buyer", accessRevision: "1", policyVersion: "1", surface: "procurement" as const, period, currency: "USD", sourceRefs: [], capabilities: [] } })
  const sources = createProcurementSourceResolver({ host, scopedSources: persistence, contextFor })
  const issued = await sources.issue("procurement-request", "PR-1", issuer)
  if (issued.status !== "ok") throw new Error("scoped request unavailable")
  const source = await sources.resolve(issued.value, issuer)
  if (source.status !== "ok") throw new Error("scoped evidence unavailable")
  const evidence = source.value.evidence
  const unavailable = async () => ({ status: "unavailable" as const, reason: "outside-fixture-scope" })
  const sourceHost = { ...host, resolveRequestSource: sources.resolve, resolveSupplierSource: sources.resolve, isCurrentRequestSource: sources.isCurrent, isCurrentSupplierSource: sources.isCurrent, resolveRequestCollection: unavailable, isCurrentRequestCollection: () => false, readContractSource: unavailable }
  const port = createProcurementPort(sourceHost)
  const authority: SfDomainValidation = {
    validateDomainContext: (call, operation, digest) => call.kind === "ui" ? ui.validate(call, operation, digest) : Promise.resolve(false),
    revalidateDomainContext: host.revalidate,
    receiptFor: (call, operation, digest, result) => call.kind === "ui" ? ui.receiptFor(call, operation, digest, result) : undefined,
  }
  const descriptors = createProcurementCapabilities({ port, authority })
  const dispatch = (payload: unknown, call: TrustedDomainContext) => dispatchSfCapability({ operation: "sf_sourcing_compare", payload, context: call, descriptors, authority,
    validateInput: (descriptor, value) => descriptor.id === "sf_sourcing_compare" && decodeSfOperationInput("sf_sourcing_compare", value).ok,
    validateOutput: (descriptor, value) => descriptor.id === "sf_sourcing_compare" && (value.status !== "ok" || decodeSfOperationOutput("sf_sourcing_compare", value.result).ok),
  })
  const bindings = createProcurementUiBindings({ authority: ui, dispatch: (_operation, payload, call) => dispatch(payload, call) })
  const payload = { requestRef: issued.value, proposalRefs: variant === "single-offer" ? ["A"] : ["A", "B", "C"], criteria: [...settings.criteria, ...settings.commCriteria].map((criterion) => criterion.name) }
  const resolveSource = createSfProcurementSourceAccess({ host, resolve: sources.resolve, procurement: port })
  const context = createSfBusinessContext({ revalidate: host.revalidate, resolveSource, proveContinuity: async () => false, recall: async () => [], emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" }, reason: "not requested by sourcing verification" }) })
  const state = createSfProductState({ persistence, createId: randomUUID,
    authorize: async (request) => authorized(request) ? { principalRef: "buyer", accessRevision: "1", policyVersion: "1" } : undefined,
    resolveTarget: async (request, _snapshot, _namespace, targetRef) => authorized(request) && targetRef === "cases-root" ? { incarnation: "cases-root-v1" } : undefined,
  })
  const cases = createDecisionCasePort({ state, host, creationTarget: { ref: "cases-root", incarnation: "cases-root-v1" }, operationIdentity: (call) => call.kind === "ui" ? ui.operationIdentity(call) : undefined, authorizeCase: async (value, call) => value.participants.includes(call.binding.principalRef) && await host.revalidate(call), evidence: context, createId: randomUUID, now: () => at })
  const draft = { objective: "Compare the recorded sourcing proposals", criteria: ["Technical fit", "Commercial terms"], horizon: period, currency: "USD", sourceRefs: [evidence] }
  const caseCall = await admit("sf_case_draft", draft)
  const created = await cases.draft(draft, caseCall)
  if (created.status !== "ok") throw new Error(`case draft unavailable: ${created.reason}`)
  const sourcingEvidence = createProcurementSourcingEvidence(sourceHost)
  const verifier = createSfSourcingVerifier({ cases, context, host, sourcingEvidence })
  const analysisRequest = { caseRef: { id: created.value.id, incarnation: created.value.incarnation, version: created.value.version }, profileId: "sf_procurement", profileVersion: "1.0.0", skillId: "sf-comparar-sourcing", skillVersion: "1.0.0", manifestDigest: "a".repeat(64), outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: ["sf_sourcing_compare"], objective: draft.objective }
  return { directory, host, persistence, issuer, evidence, payload, admit, dispatch, verifier, analysisRequest,
    compare: () => bindings.compareSourcing(request, payload), prepareInput: createSfSourcingInput({ sourcingEvidence }),
    revoke: () => { access.allowed = false },
    requestMaterial: () => persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.store) })),
    dispose: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}
