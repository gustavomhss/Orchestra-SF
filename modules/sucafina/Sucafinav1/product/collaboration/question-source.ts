import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createThreadPort } from "./threads.ts"

/** WP11 consumes the same currently authorized thread, not a second question ledger. */
export function createQuestionSource(threads: Pick<ReturnType<typeof createThreadPort>, "read">) {
  return async (questionRef: string, context: TrustedDomainContext): Promise<PortResult<{ id: string; text: string; evidenceRefs: readonly BusinessEvidenceRef[] }>> => {
    const result = await threads.read(questionRef, context)
    if (result.status !== "ok") return result
    const thread = result.value
    const message = thread.messages[0]
    if (thread.id !== questionRef || thread.kind === "comment" || !message?.body.trim() || !thread.evidenceRefs.length) return { status: "unavailable", reason: "question-unavailable" }
    return { status: "ok", value: { id: thread.id, text: message.body, evidenceRefs: thread.evidenceRefs } }
  }
}
