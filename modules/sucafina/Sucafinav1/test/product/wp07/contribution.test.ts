import { afterEach, expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createSfContributionReader } from "../../../product/ai/contribution-reader.ts"
import { createSfRunStore } from "../../../product/ai/run-store.ts"
import { digestSfContribution, digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DecisionBrief } from "../../../product/contracts/outputs.ts"
import type { ContributionEnvelope } from "../../../product/contracts/resident-ai.ts"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createReviewContributionConsumer } from "../../../product/reviews/contribution.ts"
import type { ReviewContributionRequest } from "../../../product/reviews/contribution.ts"
import { createReviewPort } from "../../../product/reviews/port.ts"
import type { ReviewSection } from "../../../product/reviews/port.ts"
import { renderPreservedReview } from "../../../product/reviews/render.ts"
import { createReviewArtifactStorage } from "../../../product/reports/storage.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { testPersistence } from "../../fixture/persistence.ts"

const cleanup: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanup.splice(0)) await close() })

test("review consumer uses the production C11 reader and never opens material for an absent native output", async () => {
  const storage = testPersistence()
  const access = { allowed: true, calls: 0 }
  const ui = createSfUiAuthority({ authorize: async () => access.allowed ? { installationId: "installation", projectId: "project", principalRef: "reader", accessRevision: "access", policyVersion: "policy" } : undefined, commandIdentity: async () => "read-contribution", createId: () => "request", now: () => Date.parse("2026-11-13T00:00:00Z") })
  const admitted = await ui.admit(new Request("https://example.test/review"), "sf_review_prepare", digestSfValue({ outputRef: "absent" }))
  if (admitted.status !== "ok") throw new Error("UI authority unavailable")
  expect(await ui.validate(admitted.value, "sf_review_prepare", digestSfValue({ outputRef: "absent" }))).toBe(true)
  const requestFor = (context: TrustedDomainContext) => context.kind === "ui" ? ui.requestFor(context) : undefined
  const revalidate = async (context: TrustedDomainContext) => context.kind === "ui" && await ui.revalidate(context)
  const state = createSfProductState({ persistence: storage.persistence, authorize: async () => access.allowed ? { principalRef: "reader", accessRevision: "access", policyVersion: "policy" } : undefined, createId: () => "state", resolveTarget: async () => undefined })
  const runs = createSfRunStore({ state, requestFor, revalidate, preflight: async () => ({ status: "unavailable", reason: "native-run-not-executed" }), revalidateForCommit: async () => ({ status: "denied", reason: "native-run-not-executed" }), now: () => "2026-11-13T00:00:00Z" })
  const contributions = createSfContributionReader({ state, runs, requestFor, revalidate, verify: async () => ({ status: "unavailable", reason: "native-run-not-executed" }) })
  const consume = createReviewContributionConsumer({ contributions, revalidate, reviews: { read: async () => { access.calls++; return { status: "unavailable", reason: "unselected" } } }, artifacts: { read: async () => { access.calls++; return { status: "unavailable", reason: "unselected" } } } })
  const request: ReviewContributionRequest = { outputRef: "absent", caseRef: { id: "case", incarnation: "case-inc", version: 1 } }
  const result = await consume(request, admitted.value)
  expect(result.status).toBe("unavailable")
  expect("value" in result).toBe(false)
  expect(access.calls).toBe(0)
  expect((await consume({ ...request, actor: "other" } as ReviewContributionRequest, admitted.value)).status).toBe("needs-input")
  expect((await consume({ ...request, expectedOutputDigest: "forged" }, admitted.value)).status).toBe("needs-input")
  access.allowed = false
  const revoked = await consume(request, admitted.value)
  expect(revoked.status).toBe("denied")
  expect("value" in revoked).toBe(false)
  expect(access.calls).toBe(0)
  ui.finish(admitted.value)
})

// These persisted run/envelope records are explicit test data, not a SessionV2 run,
// SkillLoadReceipt observation or native acceptance receipt. SQLite, C08, UI authority,
// run reading and contribution reading are production implementations. The C10 semantic
// verifier and source-access boundary remain controlled inputs to this consumer test.
async function briefFixture(payload: Partial<DecisionBrief> = {}) {
  const control = { allowed: true, verified: true, verificationCalls: 0, revokeOnVerification: 0, downstreamCalls: 0 }
  const identity = { installationId: "installation", projectId: "project", principalRef: "reader", accessRevision: "access", policyVersion: "policy" }
  const caseRef = { id: "case:/encoded", incarnation: "case:original/one", version: 1 }
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-wp07-contribution-"))
  const resources = { persistence: await openLocalStore(directory) }
  cleanup.push(async () => { await resources.persistence.dispose(); await rm(directory, { recursive: true, force: true }) })
  const ui = createSfUiAuthority({ authorize: async () => control.allowed ? identity : undefined, commandIdentity: async () => "read-brief", createId: () => "request", now: () => Date.parse("2026-11-14T00:00:00Z") })
  const wanted: ReviewContributionRequest = { outputRef: "fixture-brief", caseRef }
  const request = new Request("https://example.test/review")
  const admitted = await ui.admit(request, "sf_review_prepare", digestSfValue(wanted))
  if (admitted.status !== "ok" || !await ui.validate(admitted.value, "sf_review_prepare", digestSfValue(wanted))) throw new Error("UI authority unavailable")
  cleanup.push(async () => { ui.finish(admitted.value) })
  const requestFor = (context: TrustedDomainContext) => context.kind === "ui" ? ui.requestFor(context) : undefined
  const revalidate = async (context: TrustedDomainContext) => context.kind === "ui" && await ui.revalidate(context)
  const productState = () => createSfProductState({ persistence: resources.persistence, authorize: async () => control.allowed ? identity : undefined, createId: () => "state", resolveTarget: async (_request, _snapshot, _namespace, target) => target === "workspace" ? { incarnation: "installation" } : undefined })
  const skillReceipt = {
    runId: "fixture-run", nativeSessionId: "fixture-session-not-executed", profileId: "sf_maestro" as const, profileVersion: "1", profileDigest: "a".repeat(64),
    skillId: "sf-preparar-revisao-executiva", skillVersion: "1", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64),
    loadedMessageId: "fixture-message-not-observed", loadedAt: "2026-11-14T00:00:00Z", manifestDigest: "d".repeat(64),
  }
  const output: Extract<ContributionEnvelope, { kind: "DecisionBrief"; state: "ready" }> = {
    id: wanted.outputRef, caseRef, schemaVersion: "sf-contribution-v1", kind: "DecisionBrief", state: "ready", evidenceRefs: [],
    runProvenance: { ...skillReceipt, actualModel: "fixture/model-not-executed", contextFingerprint: "fixture-context" },
    accessRevision: identity.accessRevision, createdAt: "2026-11-14T00:00:00Z", outputDigest: "",
    payload: { caseRef: encodeCaseRef(caseRef), caseVersion: caseRef.version, objective: "Verified executive brief without linked results", orderedResultRefs: [], evidenceRefs: [], conditions: [], ...payload },
  }
  output.outputDigest = digestSfContribution(output)
  const run: SfNativeRunRecord = {
    schema: "sf-native-run-v1", runRef: skillReceipt.runId, version: 4, requestDigest: "e".repeat(64), skillInputDigest: "f".repeat(64),
    principalRef: identity.principalRef, accessRevision: identity.accessRevision, policyVersion: identity.policyVersion, caseRef,
    selection: {
      profile: { id: "sf_maestro", version: "1", mission: "fixture", allowedSkills: [skillReceipt.skillId], allowedOperations: [], outputTypes: ["DecisionBrief"], contextBudgetTokens: 1000, maxSteps: 1, maxDelegations: 0, modelClass: "fixture", resumePolicy: "fixture", sourcePath: "fixture-only", sourceDigest: skillReceipt.profileDigest },
      skills: [{ id: skillReceipt.skillId, version: "1", sourcePath: "fixture-only", sourceDigest: skillReceipt.sourceDigest, instructionsDigest: skillReceipt.instructionsDigest, inputSchemaRef: "ExecutiveReviewInput", outputSchemaRefs: ["DecisionBrief"], allowedProfiles: ["sf_maestro"], allowedOperations: [], workflow: [], limits: { maxSteps: 1, contextBudgetTokens: 1000 }, positiveAcceptance: [], negativeAcceptance: [] }],
      operationIds: [], manifestDigest: skillReceipt.manifestDigest,
    },
    model: { providerID: "fixture", id: "model-not-executed" }, skillId: skillReceipt.skillId, objective: output.payload.objective, contextFingerprint: output.runProvenance.contextFingerprint,
    createdAt: output.createdAt, updatedAt: output.createdAt, state: "ready", native: { sessionID: skillReceipt.nativeSessionId, skillReceipt }, outputRef: output.id,
  }
  const seeded = await productState().transaction(request, { namespace: "contributions", expectedStorageVersion: 0, additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: 0 }], targetRef: "workspace", targetIncarnation: "installation", idempotencyKey: "fixture-records", commandDigest: digestSfValue({ output, run }) }, async (state) => {
    state.cases[caseRef.id] = { ...caseRef, state: "draft", objective: output.payload.objective, currency: "USD", horizon: { start: "2026-01-01", end: "2026-12-31" }, criteria: [], participants: [identity.principalRef], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    state.nativeRuns = { [run.runRef]: run }
    state.contributions[output.id] = output
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error("fixture state unavailable")
  const readers = (consumers?: Pick<Parameters<typeof createReviewContributionConsumer>[0], "reviews" | "artifacts">) => {
    const state = productState()
    const runs = createSfRunStore({ state, requestFor, revalidate,
      preflight: async (record, context) => {
        const source = requestFor(context)
        if (!source) return { status: "denied", reason: "fixture-authority-unavailable" }
        const current = await state.read(source, "cases", (stored) => stored.cases[record.caseRef.id])
        if (current.status !== "ok" || !current.value || current.value.incarnation !== record.caseRef.incarnation || current.value.version !== record.caseRef.version || !current.value.participants.includes(context.binding.principalRef)) return { status: "denied", reason: "fixture-case-unavailable" }
        return { status: "ok", value: { sourceFence: digestSfValue(current.value) } }
      },
      revalidateForCommit: async () => ({ status: "denied", reason: "fixture-reader-does-not-create-native-runs" }), now: () => "2026-11-14T00:00:00Z",
    })
    const contributions = createSfContributionReader({ state, runs, requestFor, revalidate, verify: async () => {
      control.verificationCalls++
      if (!control.verified) return { status: "unavailable", reason: "fixture-semantic-verifier-unavailable" }
      if (control.verificationCalls === control.revokeOnVerification) control.allowed = false
      return { status: "ok", value: true }
    } })
    return createReviewContributionConsumer({ contributions, revalidate, ...(consumers ?? { reviews: { read: async () => { control.downstreamCalls++; return { status: "unavailable", reason: "not-selected" } as const } }, artifacts: { read: async () => { control.downstreamCalls++; return { status: "unavailable", reason: "not-selected" } as const } } }) })
  }
  // Seeds another controlled envelope shape for the same fixture identity. This is
  // test setup through C08, not native publication or an immutable-run transition.
  const installMaterial = async (material: Extract<ContributionEnvelope, { kind: "MeetingMaterialProposal"; state: "ready" }>, consumers: Pick<Parameters<typeof createReviewContributionConsumer>[0], "reviews" | "artifacts">) => {
    const state = productState()
    const before = await state.read(request, "contributions", () => null)
    if (before.status !== "ok") throw new Error("fixture state unavailable")
    const receipt = { ...skillReceipt, skillId: material.runProvenance.skillId }
    const saved = await state.transaction(request, { namespace: "contributions", expectedStorageVersion: before.storageVersion, targetRef: "workspace", targetIncarnation: "installation", idempotencyKey: `fixture-material:${material.outputDigest}`, commandDigest: digestSfValue(material) }, async (stored) => {
      stored.contributions[material.id] = material
      stored.nativeRuns![run.runRef] = { ...run, skillId: receipt.skillId, outputRef: material.id, native: { sessionID: receipt.nativeSessionId, skillReceipt: receipt }, selection: { ...run.selection, profile: { ...run.selection.profile, allowedSkills: [receipt.skillId], outputTypes: [material.kind] }, skills: run.selection.skills.map((skill) => ({ ...skill, id: receipt.skillId, inputSchemaRef: "MeetingMaterialInput", outputSchemaRefs: [material.kind] })) } }
      return { commit: true, value: true }
    })
    if (saved.status !== "ok") throw new Error("fixture material unavailable")
    return readers(consumers)
  }
  return { control, output, wanted, request, state: productState(), host: { requestFor, revalidate }, context: admitted.value, consume: readers(), installMaterial, reload: async () => { await resources.persistence.dispose(); resources.persistence = await openLocalStore(directory); return readers() } }
}

test("review consumer reopens a producer-format DecisionBrief from SQLite after reload without inventing result links", async () => {
  const fixture = await briefFixture()
  const reopened = await fixture.reload()
  const result = await reopened({ ...fixture.wanted, expectedOutputDigest: fixture.output.outputDigest }, fixture.context)
  expect(result.status).toBe("ok")
  if (result.status !== "ok" || result.value.kind !== "DecisionBrief") throw new Error("brief unavailable")
  expect(result.value.output).toEqual(fixture.output)
  expect(result.value.results).toEqual([])
  expect(result.value.links).toEqual([])
  expect(fixture.control.downstreamCalls).toBe(0)
  expect(fixture.control.verificationCalls).toBeGreaterThanOrEqual(4)
  expect((await reopened({ ...fixture.wanted, expectedOutputDigest: "0".repeat(64) }, fixture.context)).status).toBe("stale")
})

test("review consumer rejects another case and inconsistent persisted brief references", async () => {
  const original = await briefFixture()
  const other = await original.consume({ ...original.wanted, caseRef: { ...original.wanted.caseRef, incarnation: "another-physical-case" } }, original.context)
  expect(other.status).toBe("unavailable")
  expect("value" in other).toBe(false)
  for (const payload of [
    { caseRef: original.wanted.caseRef.id },
    { caseRef: encodeCaseRef({ id: original.wanted.caseRef.id, incarnation: "another-physical-case" }) },
    { orderedResultRefs: ["missing-output"] },
    { orderedResultRefs: ["same-output", "same-output"] },
    { orderedResultRefs: ["fixture-brief"] },
    { runRef: "unlinked-routine" },
    { resultRef: "unlinked-result" },
  ]) {
    const fixture = await briefFixture(payload)
    const result = await fixture.consume(fixture.wanted, fixture.context)
    expect(result.status).toBe("unavailable")
    expect("value" in result).toBe(false)
    expect(fixture.control.downstreamCalls).toBe(0)
  }
})

test("review consumer with the production C11 reader denies semantic and mid-read authority revocation", async () => {
  const fixture = await briefFixture()
  fixture.control.verified = false
  const unverified = await fixture.consume(fixture.wanted, fixture.context)
  expect(unverified.status).toBe("unavailable")
  expect("value" in unverified).toBe(false)
  fixture.control.verified = true
  fixture.control.revokeOnVerification = fixture.control.verificationCalls + 1
  const revoked = await fixture.consume(fixture.wanted, fixture.context)
  expect(revoked.status).toBe("denied")
  expect("value" in revoked).toBe(false)
  expect(JSON.stringify(revoked)).not.toContain(fixture.output.payload.objective)
  expect((await fixture.consume(fixture.wanted, fixture.context)).status).toBe("denied")
  expect(fixture.control.downstreamCalls).toBe(0)
})

test("meeting material consumer preserves artifact order and refuses inconsistent coverage or mixed selections", async () => {
  const fixture = await briefFixture()
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const sections = ["first", "second"].map<ReviewSection>((id, index) => {
    const source = { surface: "planner" as const, type: "forecast", id, incarnation: `original-${id}`, version: 1, fields: ["amount"], period, observedAt: "2026-11-14T00:00:00Z" }
    const evidence: BusinessEvidenceRef = { schema: "sf-evidence-v1", refId: `fixture-source:${id}`, installationId: "installation", projectId: "project", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "forecast", recordId: id, incarnation: source.incarnation, version: 1, fields: source.fields, period, projectionDigest: digestSfValue({ amount: index + 1 }) } }
    evidence.refDigest = digestSfEvidenceRef(evidence)
    return { id, title: id, period, recordCount: 1, comments: [], projection: { context: { installationId: fixture.context.binding.installationId, projectId: fixture.context.binding.projectId, principalRef: fixture.context.binding.principalRef, accessRevision: fixture.context.binding.accessRevision, policyVersion: fixture.context.binding.policyVersion, surface: "planner", period, currency: "USD", sourceRefs: [source], capabilities: [] }, version: 1, engineVersion: "controlled-source-fixture", components: [], missing: [], values: [{ id: `${id}:amount`, value: index + 1, unit: "USD", currency: "USD", period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: "confirmed" }] } }
  })
  const evidenceRefs = sections.flatMap((section) => section.projection.values.flatMap((value) => value.sourceRefs))
  const authorized = new Set(evidenceRefs.map(digestSfValue))
  const reviews = createReviewPort({ state: fixture.state, creationTarget: { ref: "workspace", incarnation: "installation" }, requestFor: fixture.host.requestFor, now: () => "2026-11-14T00:00:00Z", revalidate: fixture.host.revalidate,
    select: async () => ({ status: "ok", value: sections }),
    revalidateEvidence: async (_context, refs) => fixture.control.allowed && refs.every((ref) => authorized.has(digestSfValue(ref))),
    authorizeSections: async () => fixture.control.allowed, authorizeComments: async () => fixture.control.allowed, authorizeDecision: async () => fixture.control.allowed,
    authorizeSensitivity: async () => fixture.control.allowed, authorizeOutcome: async () => fixture.control.allowed, authorizeOutcomeComparison: async () => fixture.control.allowed,
  })
  const preserved = await reviews.preserve({ id: "fixture-meeting", selectionRef: "fixture-selection", sectionRefs: ["first", "second"], expectedStorageVersion: 0, idempotencyKey: "fixture-review", targetIncarnation: "installation" }, fixture.context)
  if (preserved.status !== "ok") throw new Error("preserved fixture review unavailable")
  const storage = createReviewArtifactStorage({ state: fixture.state, host: fixture.host, reviews, creationTarget: { ref: "workspace", incarnation: "installation" }, operationIdentity: (_context, entry) => `fixture:${entry.sectionRefs.join(":")}`, maxBytes: 5_000_000 })
  const save = async (sectionRefs: string[]) => {
    const artifact = await renderPreservedReview(preserved.value, { title: "Controlled meeting material", format: "docx", sectionRefs })
    if (!artifact.ok) throw new Error("fixture export unavailable")
    const saved = await storage.put({ reviewRef: preserved.value.id, sectionRefs, artifact, format: "docx", recordCount: 2, evidenceRefs: sectionRefs.flatMap((id) => sections.find((section) => section.id === id)!.projection.values.flatMap((value) => value.sourceRefs)) }, fixture.context)
    if (saved.status !== "ok") throw new Error("fixture artifact unavailable")
    return saved.value.artifactRef
  }
  const artifactRef = await save(["first", "second"])
  const reversedArtifactRef = await save(["second", "first"])
  const material: Extract<ContributionEnvelope, { kind: "MeetingMaterialProposal"; state: "ready" }> = {
    ...fixture.output, kind: "MeetingMaterialProposal", evidenceRefs, runProvenance: { ...fixture.output.runProvenance, skillId: "sf-produzir-material-reuniao" },
    payload: { reviewSelectionRef: preserved.value.id, orderedResultRefs: [artifactRef], coverage: [{ sectionRef: "second", includedCount: 1, totalCount: 1 }, { sectionRef: "first", includedCount: 1, totalCount: 1 }], gaps: [] },
  }
  material.outputDigest = digestSfContribution(material)
  const consume = await fixture.installMaterial(material, { reviews, artifacts: storage })
  const result = await consume(fixture.wanted, fixture.context)
  expect(result.status).toBe("ok")
  if (result.status !== "ok" || result.value.kind !== "MeetingMaterialProposal") throw new Error("meeting material unavailable")
  expect(result.value.output.payload.coverage.map((entry) => entry.sectionRef)).toEqual(["second", "first"])
  expect(result.value.review.sections.map((section) => section.id)).toEqual(["first", "second"])
  expect(result.value.links).toEqual([{ kind: "review", reviewRef: preserved.value.id }, { kind: "artifact", artifactRef }])
  const artifact = await storage.read(artifactRef, fixture.context)
  expect(artifact.status).toBe("ok")
  if (artifact.status !== "ok") throw new Error("artifact unavailable")
  expect(artifact.value.sectionRefs).toEqual(["first", "second"])
  for (const payload of [
    { ...material.payload, coverage: [{ sectionRef: "first", includedCount: 1, totalCount: 1 }, { sectionRef: "first", includedCount: 1, totalCount: 1 }] },
    { ...material.payload, coverage: [{ sectionRef: "first", includedCount: 2, totalCount: 2 }] },
    { ...material.payload, orderedResultRefs: [artifactRef, reversedArtifactRef] },
  ]) {
    const changed = { ...material, payload }
    changed.outputDigest = digestSfContribution(changed)
    const read = await fixture.installMaterial(changed, { reviews, artifacts: storage })
    const rejected = await read(fixture.wanted, fixture.context)
    expect(rejected.status).not.toBe("ok")
    expect("value" in rejected).toBe(false)
  }
  fixture.control.allowed = false
  expect((await consume(fixture.wanted, fixture.context)).status).toBe("denied")
})
