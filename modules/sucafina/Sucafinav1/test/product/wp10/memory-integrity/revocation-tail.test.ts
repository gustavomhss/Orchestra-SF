import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { createSfMemoryInputProducer } from "../../../../../../../apps/cli/src/sucafina-product/input-producer-memory.ts"
import { createSfDecisionMemoryVerifier } from "../../../../../../../apps/cli/src/sucafina-product/analysis-verifier-memory.ts"
import { createSfAnalysisSelectionReaders } from "../../../../../../../apps/cli/src/sucafina-product/analysis-services-readers.ts"
import { sfAnalysisSourcesAuthorized } from "../../../../../../../apps/cli/src/sucafina-product/analysis-memory-evidence.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { verifierOutputFixture } from "../analysis-composition/verifier-output-fixture.ts"
import { withMemoryIntegrityFixture } from "./fixture.ts"

type IntegrityFixture = Parameters<Parameters<typeof withMemoryIntegrityFixture>[0]>[0]

function realMemoryAdapters(f: IntegrityFixture) {
  const dependencies = { cases: f.business.cases, planner: f.business.planner, procurement: f.business.procurement,
    context: f.business.context, host: f.authority.host, caseRecall: f.business.caseRecall,
    withMemoryObservation: f.business.withMemoryObservation }
  const readers = createSfAnalysisSelectionReaders({ authority: f.authority, business: f.business })
  return {
    producer: createSfMemoryInputProducer(dependencies),
    verifier: createSfDecisionMemoryVerifier({ ...dependencies, readRecallSelection: readers.recallSelection(f.value) }),
  }
}

type Tail = {
  f: IntegrityFixture
  call: TrustedDomainContext
  request: Request
  adapters: ReturnType<typeof realMemoryAdapters>
  canonicalReads: () => number
}

// The chosen case/source seed is synthetic. C08/SQLite, C12, BCS, Atlas,
// selection readers and producer/verifier/proof reads remain real. No native
// model, Session, loaded skill or output publication is claimed by these tests.
// These separate cases reach the three revocation boundaries from the historical
// test's final assertions; they do not claim that its full sequence completed.
async function withHistoricalTail(scenario: string, work: (tail: Tail) => Promise<void>) {
  await withMemoryIntegrityFixture(async (f) => {
    await f.edit(150)
    const request = f.request()
    const admission = await f.authority.human.admit(request, "analysis.prepare", { request: f.analysis, selection: f.value })
    if (admission.status !== "ok") throw new Error(admission.reason)
    const call = admission.value
    const recall = f.atlas.memory.recall
    let completed = 0
    f.atlas.memory.recall = async (caseRef, trusted) => {
      const result = await recall(caseRef, trusted)
      if (result.status === "ok") completed += 1
      return result
    }
    try {
      const source = await f.deadline.phase("tail.resolve-original", () => f.business.context.resolve(f.original, call))
      expect(source.state).toBe("historical")
      expect(source.ref).toEqual(f.original)
      expect(source.currentRef?.refDigest).not.toBe(f.original.refDigest)
      expect(source.differences).toContainEqual({ field: "originalAmount", before: 100, after: 150 })
      const atlasBefore = await f.readAtlas()
      const inputIdentity = digestSfValue([f.value, f.analysis])
      const headers = digestSfValue([...request.headers.entries()])
      await work({ f, call, request, adapters: realMemoryAdapters(f), canonicalReads: () => completed })
      expect(f.access.allowed).toBe(false)
      expect(request.signal.aborted).toBe(false)
      expect(digestSfValue([...request.headers.entries()])).toBe(headers)
      expect(digestSfValue([f.value, f.analysis])).toBe(inputIdentity)
      expect(await f.readAtlas()).toEqual(atlasBefore)
    } finally {
      f.atlas.memory.recall = recall
      f.authority.human.finish(call)
    }
  }, `revocation-tail:${scenario}`)
}

function revoke(tail: Tail) {
  expect(tail.request.signal.aborted).toBe(false)
  expect(tail.f.authority.host.requestFor(tail.call)).toBe(tail.request)
  tail.f.access.allowed = false
}

test("Memory integrity revocation tail refuses producer preparation after an authorized historical positive", async () => {
  expectSpawn(import.meta.path)
  await withHistoricalTail("producer", async (tail) => {
    const { f, call, adapters: { producer }, canonicalReads } = tail
    const { value, analysis } = f
    const before = canonicalReads()
    const prepared = await f.deadline.phase("tail.prepare-authorized", () => producer.prepare(value, analysis, call))
    expect(prepared).toEqual({ status: "ok", value })
    expect(canonicalReads()).toBeGreaterThan(before)
    revoke(tail)
    const rejected = await f.deadline.phase("tail.prepare-revoked", () => producer.prepare(value, analysis, call))
    expect(rejected.status).toBe("unavailable")
    console.info("SF_MEMORY_INTEGRITY_REVOCATION_TAIL", JSON.stringify({ boundary: "producer.prepare",
      positive: prepared.status, revoked: rejected.status, completedCanonicalReads: canonicalReads(), nativeExecution: false }))
  })
}, 120_000)

test("Memory integrity revocation tail refuses verification after an authorized historical positive", async () => {
  expectSpawn(import.meta.path)
  await withHistoricalTail("verifier", async (tail) => {
    const { f, call, adapters: { verifier }, canonicalReads } = tail
    const { value, analysis } = f
    const before = canonicalReads()
    const verified = await f.deadline.phase("tail.verify-authorized", () => verifier.verify(value, analysis, call))
    expect(verified.status).toBe("ok")
    if (verified.status !== "ok") throw new Error(verified.reason)
    expect(canonicalReads()).toBeGreaterThan(before)
    expect(sfAnalysisSourcesAuthorized(verified.value, analysis, call)).toBe(true)
    expect(verified.value.sources.some((source) => source.state === "historical" && source.ref.refDigest === f.original.refDigest)).toBe(true)
    revoke(tail)
    const rejected = await f.deadline.phase("tail.verify-revoked", () => verifier.verify(value, analysis, call))
    expect(rejected.status).toBe("unavailable")
    console.info("SF_MEMORY_INTEGRITY_REVOCATION_TAIL", JSON.stringify({ boundary: "verifier.verify",
      positive: verified.status, revoked: rejected.status, completedCanonicalReads: canonicalReads(), nativeExecution: false }))
  })
}, 120_000)

test("Memory integrity revocation tail refuses the same output proof after authorized historical acceptance", async () => {
  expectSpawn(import.meta.path)
  await withHistoricalTail("output-proof", async (tail) => {
    const { f, call, adapters: { verifier }, canonicalReads } = tail
    const { value, analysis } = f
    const beforeVerify = canonicalReads()
    const verified = await f.deadline.phase("tail.output-proof-verify", () => verifier.verify(value, analysis, call))
    expect(verified.status).toBe("ok")
    if (verified.status !== "ok") throw new Error(verified.reason)
    expect(canonicalReads()).toBeGreaterThan(beforeVerify)
    const proof = verified.value
    expect(sfAnalysisSourcesAuthorized(proof, analysis, call)).toBe(true)
    expect(proof.sources.some((source) => source.state === "historical" && source.ref.refDigest === f.original.refDigest)).toBe(true)
    const prompt = proof.promptContext && "decisionRecall" in proof.promptContext ? proof.promptContext.decisionRecall : undefined
    if (!prompt) throw new Error("Real historical output proof absent")
    expect(prompt.result.matches).toHaveLength(1)
    expect(prompt.result.matches[0]!.explanation.sourceStates).toContain("historical")
    // Canonically decoded but explicitly unpublished structural output, exactly
    // as in the historical verifier test; this confers no native execution grant.
    const output = verifierOutputFixture(analysis, { kind: "CaseRecall", state: "ready",
      payload: prompt.result, evidenceRefs: proof.sources.map((source) => source.ref) })
    const outputIdentity = digestSfValue(output)
    const beforeAccept = canonicalReads()
    const accepted = await f.deadline.phase("tail.output-authorized", () => proof.acceptsOutput(output, call))
    expect(accepted).toEqual({ status: "ok", value: true })
    expect(canonicalReads()).toBeGreaterThan(beforeAccept)
    revoke(tail)
    const rejected = await f.deadline.phase("tail.output-revoked", () => proof.acceptsOutput(output, call))
    expect(rejected.status).toBe("unavailable")
    expect(digestSfValue(output)).toBe(outputIdentity)
    console.info("SF_MEMORY_INTEGRITY_REVOCATION_TAIL", JSON.stringify({ boundary: "proof.acceptsOutput",
      positive: accepted.status, revoked: rejected.status, completedCanonicalReads: canonicalReads(), nativeExecution: false }))
  })
}, 120_000)

