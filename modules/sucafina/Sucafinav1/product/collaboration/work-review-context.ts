import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { ReviewActionContext } from "../reviews/closure-action.ts"

export type WorkReviewContexts = (topicId: string, context: TrustedDomainContext) => Promise<PortResult<readonly ReviewActionContext[]>>

/** The review producer decides visibility; an action assignment never grants review access. */
export async function readWorkReviewContexts(read: WorkReviewContexts, topicId: string, context: TrustedDomainContext): Promise<PortResult<readonly ReviewActionContext[]>> {
  const unavailable = { status: "unavailable" as const, reason: "work-review-context-unavailable" }
  try {
    const result = await read(topicId, context)
    if (result.status !== "ok") return unavailable
    if (!Array.isArray(result.value)) return unavailable
    const selected: ReviewActionContext[] = []
    const keys = ["closureRef", "reviewRef", "reviewVersion", "reviewDigest"]
    for (const entry of result.value) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry) || Object.keys(entry).length !== keys.length || Object.keys(entry).some((key) => !keys.includes(key))) return unavailable
      const value = { closureRef: entry.closureRef, reviewRef: entry.reviewRef, reviewVersion: entry.reviewVersion, reviewDigest: entry.reviewDigest }
      if (typeof value.closureRef !== "string" || !value.closureRef.trim() || typeof value.reviewRef !== "string" || !value.reviewRef.trim() || !Number.isSafeInteger(value.reviewVersion) || value.reviewVersion < 1 || typeof value.reviewDigest !== "string" || !/^[a-f0-9]{64}$/.test(value.reviewDigest)) return unavailable
      selected.push(value)
    }
    if (new Set(selected.map((entry) => entry.closureRef)).size !== selected.length) return unavailable
    return { status: "ok", value: selected.sort((a, b) => a.closureRef.localeCompare(b.closureRef)) }
  } catch {
    return unavailable
  }
}
