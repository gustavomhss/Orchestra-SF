import { digestSfValue } from "../contracts/canonical.ts"
import type { SfHostServices } from "../contracts/host-context.ts"
import type { TrustedUiContext } from "../contracts/sf-execution.ts"

type AnalysisHistory = Awaited<ReturnType<NonNullable<SfHostServices["analyses"]>["list"]>>
const identityFields = ["installationId", "projectId", "principalRef", "policyVersion", "accessRevision"] as const

/** Compose a read in the original Workbench GET; human command admission remains POST-only. */
export async function withSfAnalysisHistory<T>(input: {
  request: Request
  parent: TrustedUiContext
  runtime: Pick<SfHostServices, "ui" | "analyses">
  caseRef: { id: string; incarnation: string; version: number }
  render: (history: AnalysisHistory) => Promise<T>
  denied: () => T
}): Promise<T> {
  const { request, parent, runtime } = input
  if ((request.method !== "GET" && request.method !== "HEAD") || runtime.ui.requestFor(parent) !== request) return input.denied()
  if (!runtime.analyses) return input.render({ status: "unavailable", reason: "analysis-history-unavailable" })
  const intent = { caseRef: { ...input.caseRef } }
  const operation = "sf-human:analysis.read"
  const digest = digestSfValue(intent)
  const admitted = await runtime.ui.admit(request, operation, digest)
  // Case-read access does not grant analysis-read access. Preserve the case page
  // with an explicit unavailable history when this independent grant is absent.
  if (admitted.status !== "ok") return input.render({ status: "unavailable", reason: "analysis-history-unavailable" })
  const context = admitted.value
  const bound = () => runtime.ui.requestFor(context) === request && runtime.ui.requestFor(parent) === request &&
    identityFields.every((key) => context.binding[key] === parent.binding[key]) &&
    runtime.ui.matchesIntent(context, operation, digest)
  try {
    if (!await runtime.ui.validate(context, operation, digest) || !bound()) return input.denied()
    // The installed list port retains both case reads, all access filters and its
    // own final authorization. This lease is not a replacement for that work.
    const history = await runtime.analyses.list(context, intent.caseRef).catch(() => ({ status: "unavailable" as const, reason: "analysis-history-unavailable" }))
    const result = await input.render(history)
    // Keep the private read lease alive across rendering and its async fences.
    if (!bound() || !await runtime.ui.revalidate(context) || !bound()) return input.denied()
    return result
  } finally { runtime.ui.finish(context) }
}
