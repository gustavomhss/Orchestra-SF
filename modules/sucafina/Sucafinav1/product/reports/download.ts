import { digestSfValue } from "../contracts/canonical.ts"
import type { TrustedUiContext } from "../contracts/sf-execution.ts"
import type { createSfUiAuthority } from "../integration/ui-authority.ts"
import type { createReviewArtifactStorage } from "./storage.ts"

/** Mount in the existing route; every request receives a new, operation-bound UI lease. */
export function createReviewDownloadHandler(input: {
  authority: Pick<ReturnType<typeof createSfUiAuthority>, "admit" | "validate" | "requestFor" | "revalidate" | "finish">
  storage: Pick<ReturnType<typeof createReviewArtifactStorage>, "download">
}) {
  return async (request: Request, artifactRef: string): Promise<Response> => {
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET", "Cache-Control": "no-store" } })
    if (request.signal.aborted || !/^report:[a-f0-9]{64}$/.test(artifactRef)) return new Response("Access denied", { status: 403, headers: { "Cache-Control": "no-store" } })
    const digest = digestSfValue({ artifactRef })
    const admitted = await input.authority.admit(request, "sf_artifact_get", digest)
    if (admitted.status !== "ok") return new Response("Access denied", { status: 403, headers: { "Cache-Control": "no-store" } })
    const context: TrustedUiContext = admitted.value
    try {
      if (!await input.authority.validate(context, "sf_artifact_get", digest) || input.authority.requestFor(context) !== request || !await input.authority.revalidate(context) || request.signal.aborted) return new Response("Access denied", { status: 403, headers: { "Cache-Control": "no-store" } })
      return await input.storage.download(artifactRef, context)
    } finally {
      input.authority.finish(context)
    }
  }
}
