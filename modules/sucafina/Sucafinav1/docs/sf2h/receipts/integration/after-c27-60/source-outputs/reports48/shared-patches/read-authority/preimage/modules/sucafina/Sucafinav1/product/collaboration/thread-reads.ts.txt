import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createRecipientThreadReader } from "./recipient-thread.ts"
import type { createThreadPort } from "./threads.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { CollaborationThread } from "./threads.ts"

/** Internal adapter for consumers that require the thread shape and current actor-scoped evidence. */
export function createRecipientAwareThreadReads(threads: Pick<ReturnType<typeof createThreadPort>, "read">, recipientThread?: ReturnType<typeof createRecipientThreadReader>) {
  return { read: async (id: string, context: TrustedDomainContext) => {
    if (recipientThread) {
      const projected = await recipientThread(id, context)
      if (projected.status === "ok") {
        const period = projected.value.current.sourceRef.target.period
        const observed = projected.value.observed.period
        // A current-state rollover never relabels the conversation's original competence.
        if (projected.value.messages[0]?.sourceContext?.reviewContext || !period || period.start > observed.start || period.end < observed.end) return projected.value.historical
          ? { status: "ok" as const, value: { id: projected.value.id, kind: projected.value.kind, ...(projected.value.recipientRef ? { recipientRef: projected.value.recipientRef } : {}), state: projected.value.state, messages: projected.value.messages, ...projected.value.historical } }
          : { status: "unavailable" as const, reason: "thread-historical-context-unavailable" }
        return { status: "ok" as const, value: { ...projected.value, sourceRef: projected.value.current.sourceRef.refId, sourceIncarnation: projected.value.current.sourceRef.target.incarnation, observedVersion: projected.value.observed.version, period: observed, evidenceRefs: projected.value.current.evidenceRefs } }
      }
    }
    return threads.read(id, context)
  }, readHistorical: async (id: string, context: TrustedDomainContext): Promise<PortResult<CollaborationThread>> => {
    if (recipientThread) {
      const projected = await recipientThread(id, context)
      if (projected.status === "ok" && projected.value.historical) return { status: "ok", value: { id: projected.value.id, kind: projected.value.kind, ...(projected.value.recipientRef ? { recipientRef: projected.value.recipientRef } : {}), state: projected.value.state, messages: projected.value.messages, ...projected.value.historical } }
    }
    return threads.read(id, context)
  } }
}

