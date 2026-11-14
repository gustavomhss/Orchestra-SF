import { describe, expect, test } from "bun:test"
import { memoryKindOf, validate } from "@orchestra/atlas-boundary/business-memory-ports"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { AuthorizedCaseProjection, AuthorizedPolicyProjection, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { deriveSfMemoryOwner, mapSfAtlasEntry } from "../../../product/decision-memory/atlas-projection.ts"

const context = { installationId: "install", projectId: "project", principalRef: "principal", accessRevision: "a1", policyVersion: "p1", kind: "native", profileId: "sf_finance" } as const
const evidenceBase = { schema: "sf-evidence-v1", refId: "evidence", installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "quote", recordId: "q", incarnation: "one", version: 1, fields: ["price"], projectionDigest: "b".repeat(64) } } as const
const evidence = { ...evidenceBase, refDigest: digestSfEvidenceRef(evidenceBase) }
const event = { id: "event", caseRef: { id: "case", incarnation: "one", version: 1 }, kind: "choice-recorded", principalRef: "principal", at: "2026-01-01T00:00:00Z", consideredActions: ["renew", "replace"], factualGaps: ["delivery pending"], lifecycleState: "chosen", rationale: "Compare the options", evidenceRefs: [evidence], outputDigest: "c".repeat(64) } as const
const bundleBase = { schema: "sf-evidence-v1", refId: "bundle", installationId: "install", projectId: "project", refDigest: "d".repeat(64), evidenceLevel: "decision", kind: "case-event", target: { caseId: "case", caseIncarnation: "one", caseVersion: 1, eventId: "event", outputDigest: event.outputDigest, evidenceRefs: [evidence] } } as const satisfies BusinessEvidenceRef
const bundle = { ...bundleBase, refDigest: digestSfEvidenceRef(bundleBase) }
const projection = { context, case: { id: "case", incarnation: "one", version: 1, state: "chosen", objective: "Compare alternatives", horizon: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", criteria: [{ id: "cost", description: "Cost", required: true }], participants: ["principal"], sourceRefs: [evidence], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [event] }, events: [event], evidenceRefs: [evidence], checkedAt: "2026-01-01T00:00:00Z" } as const satisfies AuthorizedCaseProjection
const policyBase = { schema: "sf-evidence-v1", refId: "policy", installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "decision", kind: "policy", target: { packageId: "rules", version: "p1", sourceDigest: "f".repeat(64), ruleId: "r1", reviewRef: "review", scope: "finance" } } as const
const policy = { context, policyRef: { ...policyBase, refDigest: digestSfEvidenceRef(policyBase) }, rule: "Review evidence", scope: "finance", reviewedAt: "2026-01-01T00:00:00Z", reviewedBy: "principal", sourceDigest: "f".repeat(64), ruleDigest: digestSfValue("Review evidence"), sourceEventId: "policy-event", validCitationCount: 2, dependencies: [evidence] } as const satisfies AuthorizedPolicyProjection

describe("Atlas translation", () => {
  test("maps a ledger event deterministically and preserves its dependencies", () => {
    const input = { kind: "task" as const, projection, eventId: "event", bundleRef: bundle }
    const result = mapSfAtlasEntry(input)
    expect(result.status).toBe("mapped")
    if (result.status !== "mapped") return
    expect(result.projection.evidenceRefs).toEqual([bundle, evidence])
    expect(mapSfAtlasEntry(input)).toEqual(result)
    expect(deriveSfMemoryOwner(context, { id: "case", incarnation: "one" })).not.toBe(deriveSfMemoryOwner(context, { id: "case", incarnation: "two" }))
    expect(mapSfAtlasEntry({ ...input, projection: { ...projection, case: { ...projection.case, ledger: [] } } }).status).toBe("refused")
    expect(mapSfAtlasEntry({ ...input, projection: { ...projection, evidenceRefs: [] } }).status).toBe("refused")
    expect(mapSfAtlasEntry({ ...input, bundleRef: { ...bundle, refDigest: "0".repeat(64) } }).status).toBe("refused")
  })
  test("requires a reviewed policy bound to a native profile and its rule digest", () => {
    expect(mapSfAtlasEntry({ kind: "project", projection: policy }).status).toBe("mapped")
    expect(mapSfAtlasEntry({ kind: "project", projection: { ...policy, rule: "Different rule" } }).status).toBe("refused")
    expect(mapSfAtlasEntry({ kind: "project", projection: { ...policy, context: { installationId: "install", projectId: "project", principalRef: "principal", accessRevision: "a1", policyVersion: "p1", kind: "ui" } } }).status).toBe("refused")
  })
  test("rejects a nested foreign source even when every digest is valid", () => {
    const foreignBase = { ...evidence, projectId: "another-project" }
    const foreign = { ...foreignBase, refDigest: digestSfEvidenceRef(foreignBase) }
    const calculationBase = { schema: "sf-evidence-v1", refId: "calculation", installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", kind: "calculation", target: { calculationId: "calculation", runId: "run", engineVersion: "1", inputDigest: "a".repeat(64), resultDigest: "b".repeat(64), sourceRefs: [foreign], period: projection.case.horizon, currency: "USD" } } as const satisfies BusinessEvidenceRef
    const calculation = { ...calculationBase, refDigest: digestSfEvidenceRef(calculationBase) }
    const nestedEvent = { ...event, evidenceRefs: [calculation] }
    const nestedBase = { ...bundle, target: { ...bundle.target, evidenceRefs: [calculation] } }
    const nestedBundle = { ...nestedBase, refDigest: digestSfEvidenceRef(nestedBase) }
    const nestedProjection = { ...projection, evidenceRefs: [calculation], events: [nestedEvent], case: { ...projection.case, ledger: [nestedEvent] } }
    expect(mapSfAtlasEntry({ kind: "task", projection: nestedProjection, eventId: event.id, bundleRef: nestedBundle })).toEqual({ status: "refused", reason: "invalid-evidence-scope" })
    expect(mapSfAtlasEntry({ kind: "project", projection: { ...policy, dependencies: [calculation] } })).toEqual({ status: "refused", reason: "invalid-evidence-scope" })
  })
  test("requires current case access and a real ledger event identity", () => {
    const input = { kind: "task" as const, projection, eventId: event.id, bundleRef: bundle }
    expect(mapSfAtlasEntry({ ...input, projection: { ...projection, context: { ...context, principalRef: "outsider" } } }).status).toBe("refused")
    const invalidEvent = { ...event, at: "not-a-date" }
    expect(mapSfAtlasEntry({ ...input, projection: { ...projection, events: [invalidEvent], case: { ...projection.case, ledger: [invalidEvent] } } }).status).toBe("refused")
    expect(mapSfAtlasEntry({ ...input, projection: { ...projection, context: { ...context, accessRevision: "" } } }).status).toBe("refused")
  })
  test("uses the real closed Atlas templates for mapped entries and rejects raw evidence and extra keys", () => {
    const mapped = [mapSfAtlasEntry({ kind: "task", projection, eventId: event.id, bundleRef: bundle }), mapSfAtlasEntry({ kind: "project", projection: policy })]
    for (const result of mapped) {
      expect(result.status).toBe("mapped")
      if (result.status !== "mapped") throw new Error("Authorized Atlas mapping missing")
      expect(validate(result.projection.kind, result.projection.entry)).toEqual({ valid: true, reasons: [] })
      expect(memoryKindOf(result.projection.entry)).toBe(result.projection.kind)
      // Metadata belongs to the envelope, even when an entry's required fields are intact.
      const extended = { ...result.projection.entry, kind: result.projection.kind }
      expect(validate(result.projection.kind, extended).valid).toBe(false)
      expect(() => memoryKindOf(extended)).toThrow("MEM-5 kind derivation")
      expect(result.projection.entry).not.toHaveProperty("owner")
      expect(result.projection.entry).not.toHaveProperty("projectionDigest")
      for (const raw of [evidence, bundle, policy.policyRef]) {
        // Deliberate runtime boundary negatives: BusinessEvidenceRef is not MemoryEntry.
        expect(Reflect.apply(validate, undefined, [result.projection.kind, raw])).toMatchObject({ valid: false })
        expect(() => Reflect.apply(memoryKindOf, undefined, [raw])).toThrow("MEM-5 kind derivation")
      }
    }
  })
  test("refuses unsupported kinds and missing owner context while ignoring forged owner and PR fields", () => {
    const task = { kind: "task" as const, projection, eventId: event.id, bundleRef: bundle }
    const project = { kind: "project" as const, projection: policy }
    for (const kind of ["pr", "logbook"]) {
      // The public TypeScript union excludes these kinds; exercise the runtime refusal too.
      expect(Reflect.apply(mapSfAtlasEntry, undefined, [{ ...task, kind, prId: "invented-pr" }]))
        .toEqual({ status: "refused", reason: "unsupported-memory-kind" })
    }
    for (const source of [task, project]) {
      const expected = mapSfAtlasEntry(source)
      expect(expected.status).toBe("mapped")
      if (expected.status !== "mapped") throw new Error("Authorized Atlas mapping missing")
      expect(expected.projection.owner).toMatch(/^sf-(case|policy)-v1:[a-f0-9]{64}$/)
      for (const owner of ["maestro", "lucy", "backend", "model-supplied-owner", ""]) {
        const injected = { ...source, owner, prId: "invented-pr", projection: { ...source.projection, owner, context: { ...context, owner } } }
        const result = Reflect.apply(mapSfAtlasEntry, undefined, [injected])
        expect(result).toEqual(expected)
        expect(result.projection.owner).not.toBe(owner)
        expect(result.projection.entry).not.toHaveProperty("prId")
        expect(result.projection.entry).not.toHaveProperty("owner")
      }
      for (const field of ["installationId", "projectId", "principalRef", "accessRevision", "policyVersion"]) {
        const absent = Object.fromEntries(Object.entries(context).filter(([key]) => key !== field))
        for (const invalid of [absent, { ...context, [field]: "" }, { ...context, [field]: null }, { ...context, [field]: 7 }]) {
          // Missing/malformed runtime metadata must refuse, not throw from String.trim.
          expect(Reflect.apply(mapSfAtlasEntry, undefined, [{ ...source, projection: { ...source.projection, context: invalid } }]))
            .toEqual({ status: "refused", reason: "invalid-scope-or-reference" })
        }
      }
      for (const invalid of [undefined, null, 7]) {
        expect(Reflect.apply(deriveSfMemoryOwner, undefined, [invalid])).toBeUndefined()
        expect(Reflect.apply(mapSfAtlasEntry, undefined, [{ ...source, projection: { ...source.projection, context: invalid } }]))
          .toEqual({ status: "refused", reason: "invalid-scope-or-reference" })
      }
    }
    for (const field of ["id", "incarnation"]) {
      const absent = Object.fromEntries(Object.entries(projection.case).filter(([key]) => key !== field))
      for (const invalid of [absent, { ...projection.case, [field]: "" }, { ...projection.case, [field]: null }]) {
        expect(Reflect.apply(deriveSfMemoryOwner, undefined, [context, invalid])).toBeUndefined()
        expect(Reflect.apply(mapSfAtlasEntry, undefined, [{ ...task, projection: { ...projection, case: invalid } }]))
          .toEqual({ status: "refused", reason: "invalid-scope-or-reference" })
      }
    }
    const absentProfile = Object.fromEntries(Object.entries(context).filter(([key]) => key !== "profileId"))
    for (const invalid of [absentProfile, { ...context, profileId: "" }, { ...context, profileId: null }]) {
      expect(Reflect.apply(deriveSfMemoryOwner, undefined, [invalid])).toBeUndefined()
      expect(Reflect.apply(mapSfAtlasEntry, undefined, [{ ...project, projection: { ...policy, context: invalid } }]))
        .toEqual({ status: "refused", reason: "invalid-scope-or-reference" })
    }
  })
  test("maps a coherent new case incarnation to a different owner reference and projection digest", () => {
    const nextEvent = { ...event, caseRef: { ...event.caseRef, incarnation: "two" } }
    const nextBundleBase = { ...bundle, target: { ...bundle.target, caseIncarnation: "two" } }
    const nextBundle = { ...nextBundleBase, refDigest: digestSfEvidenceRef(nextBundleBase) }
    const nextProjection = { ...projection, events: [nextEvent], case: { ...projection.case, incarnation: "two", ledger: [nextEvent] } }
    const original = mapSfAtlasEntry({ kind: "task", projection, eventId: event.id, bundleRef: bundle })
    const input = { kind: "task" as const, projection: nextProjection, eventId: nextEvent.id, bundleRef: nextBundle }
    const next = mapSfAtlasEntry(input)
    expect(original.status).toBe("mapped")
    expect(next.status).toBe("mapped")
    if (original.status !== "mapped" || original.projection.kind !== "task" || next.status !== "mapped" || next.projection.kind !== "task") throw new Error("Authorized task mappings missing")
    expect<string | undefined>(next.projection.owner).toBe(deriveSfMemoryOwner(context, nextProjection.case))
    expect(next.projection.owner).not.toBe(original.projection.owner)
    expect(next.projection.entry.ref).not.toBe(original.projection.entry.ref)
    expect(next.projection.projectionDigest).not.toBe(original.projection.projectionDigest)
    expect(next.projection.entry.taskId).toBe(original.projection.entry.taskId)
    expect(next.projection.evidenceRefs).toEqual([nextBundle, evidence])
    expect(mapSfAtlasEntry(input)).toEqual(next)
    expect(mapSfAtlasEntry({ ...input, bundleRef: bundle })).toEqual({ status: "refused", reason: "event-bundle-mismatch" })
  })
  test("refuses omitted or malformed review metadata incompatible policy versions and unreviewed preferences", () => {
    expect(mapSfAtlasEntry({ kind: "project", projection: policy }).status).toBe("mapped")
    for (const field of ["reviewedBy", "reviewedAt", "rule", "scope", "sourceEventId"]) {
      const absent = Object.fromEntries(Object.entries(policy).filter(([key]) => key !== field))
      for (const invalid of [absent, { ...policy, [field]: "" }, { ...policy, [field]: null }, { ...policy, [field]: 7 }]) {
        // These objects intentionally violate AuthorizedPolicyProjection at runtime.
        expect(Reflect.apply(mapSfAtlasEntry, undefined, [{ kind: "project", projection: invalid }]))
          .toEqual({ status: "refused", reason: "policy-not-reviewed" })
      }
    }
    for (const invalid of [undefined, "", null, 7]) {
      const changed = structuredClone(policy)
      if (invalid === undefined) Reflect.deleteProperty(changed.policyRef.target, "reviewRef")
      if (invalid !== undefined) Reflect.set(changed.policyRef.target, "reviewRef", invalid)
      // Keep the whole reference digest valid so refusal specifically requires review metadata.
      const policyRef = { ...changed.policyRef, refDigest: digestSfEvidenceRef(changed.policyRef) }
      expect(mapSfAtlasEntry({ kind: "project", projection: { ...changed, policyRef } }))
        .toEqual({ status: "refused", reason: "policy-not-reviewed" })
    }
    expect(mapSfAtlasEntry({ kind: "project", projection: { ...policy, reviewedAt: "not-a-date" } }))
      .toEqual({ status: "refused", reason: "policy-not-reviewed" })
    expect(mapSfAtlasEntry({ kind: "project", projection: { ...policy, context: { ...context, policyVersion: "p2" } } }))
      .toEqual({ status: "refused", reason: "policy-not-reviewed" })
    const preference = { ...structuredClone(policy), rule: "Prefer the cheapest supplier", ruleDigest: digestSfValue("Prefer the cheapest supplier") }
    Reflect.deleteProperty(preference, "reviewedBy")
    Reflect.deleteProperty(preference, "reviewedAt")
    Reflect.deleteProperty(preference.policyRef.target, "reviewRef")
    const policyRef = { ...preference.policyRef, refDigest: digestSfEvidenceRef(preference.policyRef) }
    expect(mapSfAtlasEntry({ kind: "project", projection: { ...preference, policyRef } }))
      .toEqual({ status: "refused", reason: "policy-not-reviewed" })
  })
  test("shares a reviewed profile namespace across actors without granting case access and versions reviewed policies", () => {
    const otherContext = { ...context, principalRef: "other-principal", accessRevision: "a2" }
    const original = mapSfAtlasEntry({ kind: "project", projection: policy })
    const samePolicy = mapSfAtlasEntry({ kind: "project", projection: { ...policy, context: otherContext } })
    expect(original.status).toBe("mapped")
    expect(samePolicy).toEqual(original)
    expect(deriveSfMemoryOwner(otherContext, projection.case)).toBe(deriveSfMemoryOwner(context, projection.case))
    // A namespace is not a grant: a second actor still needs current case participation.
    expect(mapSfAtlasEntry({ kind: "task", eventId: event.id, bundleRef: bundle, projection: { ...projection, context: otherContext } }))
      .toEqual({ status: "refused", reason: "unauthorized-case" })
    expect(mapSfAtlasEntry({ kind: "task", eventId: event.id, bundleRef: bundle,
      projection: { ...projection, context: otherContext, case: { ...projection.case, participants: ["principal", "other-principal"] } } }).status).toBe("mapped")
    const nextContext = { ...context, policyVersion: "p2" }
    const nextRefBase = { ...policy.policyRef, target: { ...policy.policyRef.target, version: "p2", reviewRef: "review-p2" } }
    const nextPolicy = { ...policy, context: nextContext, policyRef: { ...nextRefBase, refDigest: digestSfEvidenceRef(nextRefBase) },
      reviewedAt: "2026-02-01T00:00:00Z", sourceEventId: "policy-event-p2" }
    const next = mapSfAtlasEntry({ kind: "project", projection: nextPolicy })
    expect(next.status).toBe("mapped")
    if (original.status !== "mapped" || original.projection.kind !== "project" || next.status !== "mapped" || next.projection.kind !== "project") throw new Error("Reviewed policy mappings missing")
    expect<string | undefined>(next.projection.owner).toBe(deriveSfMemoryOwner(nextContext))
    expect(next.projection.owner).not.toBe(original.projection.owner)
    expect(next.projection.entry.grounding).not.toBe(original.projection.entry.grounding)
    expect(next.projection.projectionDigest).not.toBe(original.projection.projectionDigest)
    expect(next.projection.evidenceRefs).toEqual([nextPolicy.policyRef, evidence])
  })
})
