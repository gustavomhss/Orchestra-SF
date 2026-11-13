import { digestSfValue } from "../contracts/canonical.ts"
import type { SfNativeRunRecord } from "../contracts/state.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfAnalysisHost } from "./analysis-port.ts"
import type { createSfRunStore } from "./run-store.ts"

/** Compose the real run store with host-owned execution and domain authority.
 * The host must authenticate each context and verify current evidence and domain semantics;
 * this adapter never substitutes a permissive validator. */
export function createSfAnalysisHost(input: {
  store: ReturnType<typeof createSfRunStore>
  execution: SfAnalysisHost["execution"]
  analysis: SfAnalysisHost["analysis"]
  routines: SfAnalysisHost["routines"]
  withRunContext: SfAnalysisHost["withRunContext"]
  verify: (context: TrustedDomainContext, record: SfNativeRunRecord, request: Parameters<SfAnalysisHost["revalidate"]>[1]) => Promise<PortResult<true>>
}): SfAnalysisHost {
  return {
    execution: input.execution,
    analysis: input.analysis,
    routines: input.routines,
    withRunContext: input.withRunContext,
    revalidate: async (context, request) => {
      const loaded = await input.store.read(request.runRef, context)
      if (loaded.status !== "ok") return loaded
      const run = loaded.value
      if (!run.native || run.caseRef.id !== request.caseRef.id || run.caseRef.incarnation !== request.caseRef.incarnation || run.caseRef.version !== request.caseRef.version || run.contextFingerprint !== request.contextFingerprint || run.selection.manifestDigest !== request.manifestDigest || run.accessRevision !== request.accessRevision || request.skillReceipts.length !== 1 || digestSfValue(run.native.skillReceipt) !== digestSfValue(request.skillReceipts[0]) || digestSfValue(run.reviewTarget) !== digestSfValue(request.reviewTarget)) return { status: "denied", reason: "run-binding-mismatch" }
      return input.verify(context, run, request)
    },
    fail: async (runRef, reason, context) => {
      const run = await input.store.read(runRef, context)
      if (run.status !== "ok") return run
      const saved = await input.store.transition(runRef, run.value.version, "failed", reason, context)
      if (saved.status !== "ok") return saved
      return { status: "ok", value: true }
    },
    markStale: async (runRef, reason, context) => {
      const saved = await input.store.markStale(runRef, reason, context)
      if (saved.status !== "ok") return saved
      return { status: "ok", value: true }
    },
    result: {
      write: async (request, context) => {
        const run = await input.store.read(request.runRef, context)
        if (run.status !== "ok") return run
        if (digestSfValue(request.caseRef) !== digestSfValue(run.value.caseRef)) return { status: "stale", reason: "analysis-base-changed" }
        const saved = await input.store.publish(request.runRef, run.value.version, request.output, context)
        if (saved.status !== "ok") return saved
        return { status: "ok", value: { outputRef: request.output.id, caseVersion: saved.value.caseRef.version } }
      },
    },
  }
}
