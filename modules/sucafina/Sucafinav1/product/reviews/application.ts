import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import { dispatchSfCapability } from "../host-binding/capability-dispatch.ts"
import type { createSfHumanAuthority } from "../integration/human-authority.ts"
import type { createSfUiAuthority } from "../integration/ui-authority.ts"
import { createReviewClosurePort } from "./closure-action.ts"
import { createReviewComparisonPort } from "./comparison-port.ts"
import { createReviewComposition } from "./composition.ts"
import { createReviewContributionConsumer } from "./contribution.ts"
import { createReviewHumanPort } from "./human.ts"
import { createReviewHttp } from "./http.ts"

/** The existing host supplies authenticated services; this factory opens no server or store. */
export function createReviewApplication(input: Parameters<typeof createReviewComposition>[0] & {
  origin: string
  ui: ReturnType<typeof createSfUiAuthority>
  humanAuthority: ReturnType<typeof createSfHumanAuthority>
  maxBodyBytes: number
  handoffs?: Pick<Parameters<typeof createReviewClosurePort>[0], "handoff" | "verifyHandoff" | "readAction">
  contributions?: Pick<Parameters<typeof createReviewContributionConsumer>[0], "contributions" | "results">
}) {
  const composed = createReviewComposition(input)
  const human = createReviewHumanPort({ state: input.state, reviews: composed.reviews, human: input.humanAuthority, ui: input.ui, creationTarget: input.creationTarget })
  const closures = input.handoffs ? createReviewClosurePort({
    ...input.handoffs, state: input.state, host: input.host, reviews: composed.reviews,
    human: input.humanAuthority, ui: input.ui, creationTarget: input.creationTarget,
    operationIdentity: input.operationIdentity,
  }) : undefined
  const comparison = createReviewComparisonPort({ reviews: composed.reviews, closures, host: input.host })
  const contribution = input.contributions ? createReviewContributionConsumer({ ...input.contributions, reviews: composed.reviews, artifacts: composed.artifacts, revalidate: input.host.revalidate }) : undefined
  const download = async (request: Request, artifactRef: string): Promise<Response> => {
    const denied = () => new Response("Access denied", { status: 403, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET", "Cache-Control": "no-store" } })
    if (request.signal.aborted || !/^report:[a-f0-9]{64}$/.test(artifactRef)) return denied()
    const payload = { artifactRef }
    const admitted = await input.ui.admit(request, "sf_artifact_get", digestSfValue(payload))
    if (admitted.status !== "ok") return denied()
    try {
      const result = await dispatchSfCapability({
        operation: "sf_artifact_get", payload, context: admitted.value,
        descriptors: composed.descriptors, authority: input.authority,
        validateInput: (_descriptor, value) => decodeSfOperationInput("sf_artifact_get", value).ok,
        validateOutput: (_descriptor, value) => value.status !== "ok" || decodeSfOperationOutput("sf_artifact_get", value.result).ok,
      })
      if (result.status !== "ok" || input.ui.requestFor(admitted.value) !== request || !await input.ui.revalidate(admitted.value)) return denied()
      // The byte reader repeats snapshot/ACL checks after the shared capability admission.
      return await composed.artifacts.download(artifactRef, admitted.value)
    } finally { input.ui.finish(admitted.value) }
  }
  const http = createReviewHttp({
    origin: input.origin, ui: input.ui, human, humanAuthority: input.humanAuthority,
    closure: closures, authority: input.authority, descriptors: composed.descriptors,
    reviews: composed.reviews, agenda: composed.agenda, comparison, contribution, download,
    maxBodyBytes: input.maxBodyBytes,
  })
  return { ...composed, human, closures, comparison, contribution, download, http }
}
