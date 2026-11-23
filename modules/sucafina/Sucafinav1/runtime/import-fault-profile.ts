// Diagnostic snapshot only. IDs below identify ephemeral local operations, never domain entities.
import { types } from "node:util"

type Facts = Readonly<Record<string, string | number | boolean>>
export type SfImportFaultTrace = Readonly<{
  mark: (reason: string) => void
  caught: (error: unknown) => void
  emit: (actorPresent: boolean) => void
}>
const storageFaults = new WeakMap<object, Facts>()
const requests = new WeakMap<Request, { id: number; attempt: number; started: number }>()
let requestSequence = 0
let emittedLines = 0
let forwardedLines = 0

/** Preserve the exact thrown object; the diagnostic never annotates, wraps or replaces it. */
export function rememberSfImportStorageFault(error: unknown, facts: () => Facts) {
  try {
    if (error === null || typeof error !== "object" || types.isProxy(error) || storageFaults.has(error)) return
    storageFaults.set(error, facts())
  } catch { /* Diagnostic bookkeeping cannot change the original rejection. */ }
}

function classify(error: unknown) {
  try {
    const inspect = error !== null && typeof error === "object" && !types.isProxy(error)
    const message = inspect ? Object.getOwnPropertyDescriptor(error, "message") : undefined
    const name = inspect ? Object.getOwnPropertyDescriptor(error, "name") : undefined
    const detail: unknown = message && Object.hasOwn(message, "value") ? message.value : undefined
    const named: unknown = name && Object.hasOwn(name, "value") ? name.value : undefined
    return detail === "Local storage lock timeout" ? "local-storage-lock-timeout" :
      detail === "Local storage operation aborted" || named === "AbortError" ? "abort" :
      detail === "SF_DASHBOARD_AUTHORITY_ROOT_CHANGED" ? "dashboard-authority-root-changed" :
      detail === "SF_SEALED_READ_CHANGED" ? "sealed-read-changed" :
      detail === "SF_PRODUCT_ACCESS_SCOPE_INVALID" ? "product-access-scope-invalid" :
      detail === "Local store is disposed" ? "store-disposed" : "other"
  } catch { return "classification-unavailable" }
}

function validLine(line: string) {
  try {
    const prefix = "SF_IMPORT_FAULT "
    if (!line.startsWith(prefix) || line.length + 1 > 1024 || !/^[\x20-\x7e]+$/.test(line)) return false
    const value: unknown = JSON.parse(line.slice(prefix.length))
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        !("schema" in value) || value.schema !== "sf-import-fault-v1" ||
        !("qualification" in value) || value.qualification !== false ||
        !("source" in value) || value.source !== "97c921ab0054bd5154227593adcbcca56b0538c3" ||
        !("kind" in value) || value.kind !== "authorize-denied" ||
        !("reason" in value) || typeof value.reason !== "string" ||
        !("request" in value) || typeof value.request !== "number" ||
        !("attempt" in value) || typeof value.attempt !== "number" ||
        !("timeMs" in value) || typeof value.timeMs !== "number" ||
        !("storageObserved" in value) || typeof value.storageObserved !== "boolean") return false
    return Object.entries(value).every(([key, item]) => {
      if (["schema", "qualification", "source", "kind"].includes(key)) return true
      if (["reason", "opKind", "phase", "activeKind", "activePhase"].includes(key))
        return typeof item === "string" && /^[a-z-]{1,48}$/.test(item)
      if (["request", "attempt", "timeMs", "elapsedMs", "attemptElapsedMs", "store", "operation",
        "opElapsedMs", "budgetMs", "activeAtEntry", "active", "activeElapsedMs", "activePhaseElapsedMs"].includes(key))
        return typeof item === "number" && Number.isFinite(item)
      if (["actorPresent", "aborted", "storageObserved", "write", "signalPresent", "signalAborted",
        "previousPresent", "activeSignalPresent", "activeAborted", "sameActive"].includes(key))
        return typeof item === "boolean"
      return false
    })
  } catch { return false }
}

/** The two existing stdout boundaries forward only bounded, recognized failure packets. */
export function createSfImportFaultForwarder() {
  return (line: string) => {
    try {
      if (forwardedLines >= 64 || !validLine(line)) return
      forwardedLines++
      console.info(line)
    } catch { /* Forwarding cannot affect host readiness or the original test. */ }
  }
}

export function createSfImportFaultTrace(request: Request, operation: string): SfImportFaultTrace | undefined {
  try {
    if (operation !== "sf_import_preview" || request.method !== "GET") return undefined
    let observed = requests.get(request)
    if (!observed) {
      if (new URL(request.url).searchParams.get("sf") !== "import-reference") return undefined
      observed = { id: ++requestSequence, attempt: 0, started: performance.now() }
      requests.set(request, observed)
    }
    const requestId = observed.id
    const requestStarted = observed.started
    const attempt = ++observed.attempt
    const started = performance.now()
    let reason = "resolve-returned-undefined"
    let caught: unknown
    let emitted = false
    return {
      mark(value) {
        try { if (reason === "resolve-returned-undefined") reason = value }
        catch { /* No diagnostic state may alter authorization. */ }
      },
      caught(error) {
        try { caught = error; reason = classify(error) }
        catch { /* Retain the original authority catch behavior. */ }
      },
      emit(actorPresent) {
        try {
          if (emitted || emittedLines >= 64) return
          emitted = true
          const storage = caught !== null && typeof caught === "object" ? storageFaults.get(caught) : undefined
          const at = performance.now()
          const line = "SF_IMPORT_FAULT " + JSON.stringify({
            schema: "sf-import-fault-v1", qualification: false,
            source: "97c921ab0054bd5154227593adcbcca56b0538c3", kind: "authorize-denied",
            request: requestId, attempt, timeMs: Date.now(), elapsedMs: Math.round(at - requestStarted),
            attemptElapsedMs: Math.round(at - started), reason, actorPresent, aborted: request.signal.aborted,
            storageObserved: !!storage, ...storage,
          })
          if (!validLine(line)) return
          emittedLines++
          console.info(line)
        } catch { /* Output failure cannot replace the original authority result. */ }
      },
    }
  } catch { return undefined }
}
