import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import type { SfOperationId } from "@orchestra/schema/sucafina/common"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import type { createReviewApplication } from "../../../../../modules/sucafina/Sucafinav1/product/reviews/application.ts"
import { sfHasOperationalResource } from "./live-context.ts"

/** C14 infrastructure only: no report generation, artifact bytes or record authorization. */
export async function observeSfReportHealth(input: { ui: SfHostServices["ui"]; state: SfHostServices["state"];
  source: ReturnType<typeof createReviewApplication> | undefined }, request: Request, stamp: SfContextStamp) {
  if (!input.source || request.signal.aborted) return []
  const source = input.source
  const candidates = [
    { id: "reviews.report.prepare", operation: "sf_report_prepare", handler: "prepareReport", write: true },
    { id: "files.export.review", operation: "sf_artifact_get", handler: "readArtifact", write: false },
  ] as const
  const results = await Promise.allSettled(candidates.map(async (candidate) => {
    const id = Object.keys(SfOperationRegistry).find((key) => key === candidate.id)
    const descriptors = source.descriptors.filter((item) => item.id === candidate.operation)
    if (!id || !isOperation(id) || !sfHasOperationalResource(id) || descriptors.length !== 1 || descriptors[0]?.handlerExport !== candidate.handler ||
      typeof source.http !== "function" || typeof source.reviews.read !== "function" || typeof source.artifacts.download !== "function") return []
    if (candidate.write) {
      const dependencies = await Promise.all([import("docx"), import("pptxgenjs")]).catch(() => undefined)
      if (!dependencies) return []
    }
    const digest = digestSfValue({ purpose: "report-source-health", operation: candidate.operation })
    const admitted = await input.ui.admit(request, candidate.operation, digest)
    if (admitted.status !== "ok") return []
    try {
      const binding = admitted.value.binding
      if (binding.installationId !== stamp.installationId || binding.projectId !== stamp.projectId ||
        binding.principalRef !== stamp.principalRef || binding.policyVersion !== stamp.policyVersion ||
        binding.accessRevision !== stamp.accessRevision || !await input.ui.validate(admitted.value, candidate.operation, digest) ||
        input.ui.requestFor(admitted.value) !== request) return []
      let stateFence: { revision: number; incarnation: string } | undefined
      for (const namespace of ["reviews", "documents"] as const) {
        const health = await input.state.read(request, namespace, selectSfNamespaceHealth(namespace, stamp,
          candidate.write && namespace === "documents" ? "write" : "read"))
        if (health.status !== "ok" || !health.value || health.storageVersion !== health.value.storageVersion ||
          health.aggregateRevision !== health.value.aggregateRevision || health.incarnation !== health.value.incarnation) return []
        if (stateFence && (stateFence.revision !== health.aggregateRevision || stateFence.incarnation !== health.incarnation)) return []
        stateFence = { revision: health.aggregateRevision, incarnation: health.incarnation }
      }
      if (request.signal.aborted || !await input.ui.revalidate(admitted.value)) return []
      return [{ operationId: id, state: "ready" as const, reason: null, operational: true as const }]
    } finally { input.ui.finish(admitted.value) }
  }))
  return results.flatMap((item) => item.status === "fulfilled" ? item.value : [])
}

function isOperation(value: string): value is SfOperationId {
  return Object.hasOwn(SfOperationRegistry, value)
}
