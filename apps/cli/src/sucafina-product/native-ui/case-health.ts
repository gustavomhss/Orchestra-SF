import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { selectSfCaseHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"

/** C08 infrastructure health only: no case contents, list completeness or per-record access. */
export async function observeSfCaseSource(runtime: SfHostServices | undefined, request: Request, stamp: SfContextStamp) {
  if (!runtime || request.signal.aborted) return false
  const digest = digestSfValue({})
  const admitted = await runtime.ui.admit(request, "sf_case_read", digest)
  if (admitted.status !== "ok") return false
  try {
    const binding = admitted.value.binding
    if (binding.installationId !== stamp.installationId || binding.projectId !== stamp.projectId ||
      binding.principalRef !== stamp.principalRef || binding.policyVersion !== stamp.policyVersion ||
      binding.accessRevision !== stamp.accessRevision || !await runtime.ui.validate(admitted.value, "sf_case_read", digest)) return false
    const health = await runtime.state.read(request, "cases", selectSfCaseHealth(stamp))
    if (health.status !== "ok" || !health.value || health.storageVersion !== health.value.storageVersion ||
      health.aggregateRevision !== health.value.aggregateRevision || health.incarnation !== health.value.incarnation) return false
    return !request.signal.aborted && await runtime.ui.revalidate(admitted.value)
  } finally {
    runtime.ui.finish(admitted.value)
  }
}
