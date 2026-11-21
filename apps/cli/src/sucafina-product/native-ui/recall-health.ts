import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import type { SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import type { createSfBusinessServices } from "../business-services.ts"
import { sfHasOperationalResource } from "./live-context.ts"

/** CaseRecall infrastructure only; candidate and evidence authority remain record-scoped. */
export async function observeSfRecallHealth(input: { ui: SfHostServices["ui"]; state: SfHostServices["state"];
  source: ReturnType<typeof createSfBusinessServices>["caseRecallSource"] }, request: Request, stamp: SfContextStamp) {
  if (request.signal.aborted || !sfHasOperationalResource("intelligence.memory-similar-cases")) return []
  const initial = input.source()
  if (!initial || Object.values(initial.atlas.runtimeVersions).some((value) => typeof value !== "string" || !value.trim())) return []
  const operation = "sf-human:analysis.read"
  const digest = digestSfValue({ purpose: "case-recall-source-health" })
  const admitted = await input.ui.admit(request, operation, digest)
  if (admitted.status !== "ok") return []
  try {
    const binding = admitted.value.binding
    if (binding.installationId !== stamp.installationId || binding.projectId !== stamp.projectId ||
      binding.principalRef !== stamp.principalRef || binding.policyVersion !== stamp.policyVersion ||
      binding.accessRevision !== stamp.accessRevision || !await input.ui.validate(admitted.value, operation, digest) ||
      input.ui.requestFor(admitted.value) !== request) return []
    let stateFence: { revision: number; incarnation: string } | undefined
    for (const namespace of ["cases", "atlas", "outbox"] as const) {
      const health = await input.state.read(request, namespace, selectSfNamespaceHealth(namespace, stamp))
      if (health.status !== "ok" || !health.value || health.storageVersion !== health.value.storageVersion ||
        health.aggregateRevision !== health.value.aggregateRevision || health.incarnation !== health.value.incarnation) return []
      if (stateFence && (stateFence.revision !== health.aggregateRevision || stateFence.incarnation !== health.incarnation)) return []
      stateFence = { revision: health.aggregateRevision, incarnation: health.incarnation }
    }
    const current = input.source()
    if (!current || current.recall !== initial.recall || current.evidence !== initial.evidence || current.atlas !== initial.atlas ||
      request.signal.aborted || !await input.ui.revalidate(admitted.value)) return []
    return [{ operationId: "intelligence.memory-similar-cases" as const, state: "ready" as const, reason: null, operational: true as const }]
  } finally { input.ui.finish(admitted.value) }
}
