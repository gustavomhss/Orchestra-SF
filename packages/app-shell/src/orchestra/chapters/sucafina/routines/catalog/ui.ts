import { useLanguage } from "@/context/language"
import type { SfReadableContext, SfContextStamp } from "@orchestra/schema/sucafina/context"
import type { SfCopyKey, SfUiState } from "../../shared/frame"
import type { SfContextHandle } from "../../context/contracts"

// N29 presents F01's current installed/current-grant verdict; a source file or
// method signature is never evidence that the installed capability is operational.
export function n29Permitted(context: SfReadableContext, resource: "routine-admission" | "routine-runs" | "schedules" | "residents" | "analysis", operationId: string) {
  const entry = context.availability.find((item) => item.family === "intelligence" && item.resource === resource)
  if (!entry || (entry.state !== "ready" && entry.state !== "partial")) return false
  return entry.operations.some((item) => item.operationId === operationId && item.state === "ready" && item.operational)
}

export function n29ContextState(status: ReturnType<SfContextHandle["state"]>["status"]): SfUiState {
  if (status === "denied" || status === "context-mismatch") return "denied"
  if (status === "unauthenticated") return "session-expired"
  if (status === "unavailable") return "unavailable"
  return "loading"
}

type ResultStatus = "ok" | "invalid" | "not-found" | "denied" | "unauthenticated" |
  "needs-input" | "unavailable" | "stale" | "conflict" | "provider-conflict" | "failed"

export function n29ResponseState(result: Readonly<{ kind: "transport-error"; reason: string }> |
  Readonly<{ kind: "response"; status: number; body: Readonly<{ status: ResultStatus; reason?: string }> }>): SfUiState {
  if (result.kind === "transport-error") {
    if (result.reason === "outcome-unknown") return "outcome-unknown"
    if (result.reason === "contract-mismatch") return "stale"
    return "unavailable"
  }
  switch (result.body.status) {
    case "ok": return "ready"
    case "not-found": return "not-found"
    case "unauthenticated": return "session-expired"
    case "denied": return "denied"
    case "stale": return "stale"
    case "conflict":
    case "provider-conflict": return "conflict"
    case "needs-input": return "partial"
    case "invalid": return "invalid"
    default: return "unavailable"
  }
}

export function n29SameAuthority(handle: SfContextHandle, generation: number, stamp: SfContextStamp) {
  const current = handle.ready()?.context.stamp
  return handle.generation() === generation && !!current
    && current.installationId === stamp.installationId
    && current.projectId === stamp.projectId
    && current.hostId === stamp.hostId
    && current.principalRef === stamp.principalRef
    && current.policyVersion === stamp.policyVersion
    && current.accessRevision === stamp.accessRevision
}

export const n29Key = (key: string): SfCopyKey => key as SfCopyKey

export function useN29Copy() {
  const language = useLanguage()
  const t = (key: string, params?: Readonly<Record<string, string | number>>) =>
    language.t(key as Parameters<typeof language.t>[0], params ? { ...params } : undefined)
  return { t }
}

export function n29StateKey(state: SfUiState) {
  switch (state) {
    case "loading": return n29Key("sf.common.loading")
    case "empty": return n29Key("sf.common.empty")
    case "filtered-empty": return n29Key("sf.common.filterEmpty")
    case "partial": return n29Key("sf.common.needsInput")
    case "invalid": return n29Key("sf.common.invalidLink")
    case "not-found": return n29Key("sf.common.removed")
    case "stale": return n29Key("sf.common.stale")
    case "conflict": return n29Key("sf.common.conflict")
    case "unavailable": return n29Key("sf.common.unavailable")
    case "denied": return n29Key("sf.common.noAccess")
    case "session-expired": return n29Key("sf.common.loginAgain")
    case "outcome-unknown": return n29Key("sf.common.operationUnknown")
    case "ready": return n29Key("sf.common.currentSource")
  }
}
