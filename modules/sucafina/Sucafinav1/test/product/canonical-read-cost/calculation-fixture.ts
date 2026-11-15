import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { SfProductStatePort, SfStateNamespace, SfStateResult } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import type { StoredDecisionResult } from "../../../product/decisions/result-store.ts"
import { createRenewalSourceFixture } from "../wp11/renewal-source-fixture.ts"

/** Real SQLite, UI admission and Planner output. Source membership is the existing
 * explicitly synthetic renewal fixture, never an unconditional approval. */
export async function createCalculationFixture() {
  const fixture = await createRenewalSourceFixture("omitted")
  try {
    const preview = await fixture.planner.simulateScenario(fixture.scenario, fixture.context)
    if (preview.status !== "ok") throw new Error(preview.reason)
    const trace = { events: [] as string[], sources: [] as (readonly BusinessEvidenceRef[])[], reads: 0, next: 0 }
    const hooks: {
      read?: (value: SfStateResult<unknown>, namespace: SfStateNamespace, ordinal: number) => void
      sources?: (value: Parameters<Parameters<typeof createSfDecisionResultStore>[0]["verifySources"]>[0], refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => void | Promise<void>
    } = {}
    const state: SfProductStatePort = {
      ...fixture.state,
      read: async (request, namespace, read) => {
        trace.events.push(`read:${namespace}`)
        const value = await fixture.state.read(request, namespace, read)
        hooks.read?.(value, namespace, ++trace.reads)
        return value
      },
    }
    const settings: Parameters<typeof createSfDecisionResultStore>[0] = {
      state,
      host: {
        requestFor: (context) => fixture.host.requestFor(context),
        revalidate: (context) => { trace.events.push("authority"); return fixture.host.revalidate(context) },
      },
      authorizeCase: async (value, context) => {
        trace.events.push("case")
        return value.id === fixture.caseRef.id && value.incarnation === fixture.caseRef.incarnation && value.participants.includes(context.binding.principalRef) && await fixture.host.revalidate(context)
      },
      verifySources: async (value, refs, context) => {
        trace.events.push("sources")
        trace.sources.push(structuredClone(refs))
        const observed = await fixture.evidence.context({ refs }, context)
        const allowed = observed.length === refs.length && observed.every((item, index) => item.state === "fresh" && item.accessRevision === context.binding.accessRevision && digestSfValue(item.ref) === digestSfValue(refs[index]))
        await hooks.sources?.(value, refs, context)
        return allowed
      },
      createId: () => `canonical-read-${++trace.next}`,
      now: () => "2026-11-13T00:00:00Z",
    }
    const results = createSfDecisionResultStore(settings)
    const saved = await results.write({ kind: "scenario", result: preview.value, caseRef: fixture.caseRef, requestDigest: digestSfValue(fixture.scenario), sourceRefs: [fixture.sourceRefs[0]!, fixture.sourceRefs[1]!, fixture.sourceRefs[0]!], idempotencyKey: "canonical-read-seed" }, fixture.context)
    if (saved.status !== "ok" || saved.value.kind !== "scenario") throw new Error("Canonical scenario publication failed")
    const original = structuredClone(saved.value)
    const reset = () => { trace.events.length = 0; trace.sources.length = 0; trace.reads = 0 }
    const replace = async (value: StoredDecisionResult) => {
      const current = await fixture.state.read(fixture.request, "cases", () => null)
      if (current.status !== "ok") throw new Error("Canonical state unavailable")
      const written = await fixture.state.transaction(fixture.request, { namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: fixture.caseRef.id, targetIncarnation: fixture.caseRef.incarnation, idempotencyKey: `negative-control-${++trace.next}`, commandDigest: digestSfValue(value) }, async (state) => {
        state.decisionResults![original.resultRef] = structuredClone(value)
        return { commit: true, value: true }
      })
      if (written.status !== "ok" || !written.value) throw new Error("Negative control CAS failed")
    }
    reset()
    return { fixture, settings, results, original, trace, hooks, reset, replace, cleanup: fixture.cleanup }
  } catch (error) { await fixture.cleanup(); throw error }
}
