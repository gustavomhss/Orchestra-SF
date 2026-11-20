const promotionPath = ".github/sf-cache-source.json"
const admittedRefs = new Set(["dev", "sf-join-four", "close-final-candidate"])

function checkedSource(sourceRef, sourceSha, reason) {
  if (!admittedRefs.has(sourceRef)) throw new Error("SF_CACHE_SOURCE_REF_NOT_ADMITTED")
  if (typeof sourceSha !== "string" || !/^[0-9a-f]{40}$/.test(sourceSha) || /^0+$/.test(sourceSha))
    throw new Error("SF_CACHE_SOURCE_SHA_REQUIRED")
  return { sourceRef, sourceSha, reason }
}

// A promotion is trusted only after its file is merged into the default branch.
// Live ref equality and checked-out SHA are independently enforced by the writer.
export function selectCacheSource(input) {
  if (input.defaultBranch !== "dev" || input.refName !== input.defaultBranch)
    throw new Error("SF_CACHE_WRITER_REQUIRES_DEFAULT_BRANCH")
  const current = checkedSource(input.refName, input.sha, "default-push")
  if (input.eventName === "workflow_dispatch")
    return checkedSource(input.dispatchRef, input.dispatchSha, "manual-reviewed-source")
  if (input.eventName !== "push") throw new Error("SF_CACHE_WRITER_EVENT_NOT_ADMITTED")
  if (!Array.isArray(input.changedPaths) || input.changedPaths.some((path) => typeof path !== "string"))
    throw new Error("SF_CACHE_CHANGED_PATHS_REQUIRED")
  if (!input.changedPaths.includes(promotionPath)) return current
  const promotion = input.promotion
  if (!promotion || typeof promotion !== "object" || Array.isArray(promotion) ||
      Object.keys(promotion).sort().join(",") !== "schema,sourceRef,sourceSha" || promotion.schema !== 1)
    throw new Error("SF_CACHE_PROMOTION_INVALID")
  return checkedSource(promotion.sourceRef, promotion.sourceSha, "reviewed-promotion")
}
