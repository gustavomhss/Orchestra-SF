import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createRecipientThreadReader } from "./recipient-thread.ts"
import type { createThreadPort } from "./threads.ts"

/** Internal adapter for consumers that require the thread shape and current actor-scoped evidence. */
export function createRecipientAwareThreadReads(threads: Pick<ReturnType<typeof createThreadPort>, "read">, recipientThread?: ReturnType<typeof createRecipientThreadReader>) {
  return { read: async (id: string, context: TrustedDomainContext) => {
    if (recipientThread) {
      const projected = await recipientThread(id, context)
      if (projected.status === "ok") return { status: "ok" as const, value: { ...projected.value, sourceRef: projected.value.current.sourceRef.refId, sourceIncarnation: projected.value.current.sourceRef.target.incarnation, observedVersion: projected.value.observed.version, period: projected.value.observed.period, evidenceRefs: projected.value.current.evidenceRefs } }
    }
    return threads.read(id, context)
  } }
}
