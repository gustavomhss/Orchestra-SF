import type { ReconsiderationSignal } from "./materiality.ts"

export type SfSignalState = { conditionId: string; correlationKey: string; status: "open" | "resolved"; seenKeys: readonly string[]; resolutionKey?: string }

export type SignalDedupePolicy = Readonly<{
  identity: "condition-and-material-change-correlation"
  duplicate: "no-op"
  distinctChangeWhileOpen: "update-existing"
  distinctChangeAfterResolution: "open-new"
  irrelevantChange: "no-signal"
}>

/** The caller supplies a correlation key derived from the canonical material-change fingerprint. */
export const sfSignalDedupePolicy: SignalDedupePolicy = {
  identity: "condition-and-material-change-correlation",
  duplicate: "no-op",
  distinctChangeWhileOpen: "update-existing",
  distinctChangeAfterResolution: "open-new",
  irrelevantChange: "no-signal",
}

/** The host owns persistence and may resolve only on an independently established resolution. */
export function reconcileSfSignal(previous: SfSignalState | undefined, event:
  | { kind: "signal"; signal: ReconsiderationSignal }
  | { kind: "resolved"; conditionId: string; resolutionKey: string }
  | { kind: "unavailable" }
  | { kind: "revoked" }
) {
  if (event.kind === "revoked") return { action: "remove" as const }
  if (event.kind === "unavailable") return { action: "unavailable" as const }
  if (event.kind === "resolved") {
    if (!event.conditionId || !event.resolutionKey || !previous || previous.conditionId !== event.conditionId || previous.status === "resolved") return { action: "none" as const, state: previous }
    return { action: "resolve" as const, state: { conditionId: event.conditionId, correlationKey: previous.correlationKey, status: "resolved" as const, seenKeys: previous.seenKeys, resolutionKey: event.resolutionKey } }
  }
  const signal = event.signal
  if (!signal.conditionId || !signal.correlationKey || (previous && previous.conditionId !== signal.conditionId)) return { action: "unavailable" as const }
  if (previous?.seenKeys.includes(signal.correlationKey)) return { action: "none" as const, state: previous }
  const state = { conditionId: signal.conditionId, correlationKey: signal.correlationKey, status: "open" as const, seenKeys: [...previous?.seenKeys ?? [], signal.correlationKey] }
  return { action: previous?.status === "open" ? "update" as const : "open" as const, state, signal }
}
