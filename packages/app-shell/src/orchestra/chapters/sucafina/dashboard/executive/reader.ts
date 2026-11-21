import { batch, createEffect, createSignal, onCleanup, type Accessor } from "solid-js"
import { createStore } from "solid-js/store"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfRef, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfUiState } from "../../shared/frame/types"
import { useSfContext } from "../../context"

/**
 * U02 read lifecycle. A single authorized producer request per selection; no
 * HTML scraping, persisted cache, speculative default year or stale-owner data.
 * Both CAP01 and CAP03 have their own frozen typed client methods.
 */
type Failure = Readonly<{ status: "unauthenticated" | "denied" }> |
  Readonly<{ status: "needs-input" | "stale" | "unavailable"; reason: string }>
type Selection = Readonly<{ year?: number; month?: number; execYear?: number; executiveMonth?: number; opsMonth?: number }>
type Projection<T> = Readonly<{
  capabilityId: "CAP01" | "CAP03"
  selection: Selection
  data: T
  versions: Readonly<Record<string, number>>
  allowedActionIds: readonly string[]
}>
export type U02Response<T> =
  | Readonly<{ kind: "transport-error"; reason: string }>
  | Readonly<{ kind: "response"; status: number; body: Failure | Readonly<{ status: "ok"; value: Projection<T> }> }>
type Request<T> = (transport: SfTransport, selection: Readonly<{ year?: number; month?: number; opsMonth?: number }>, signal: AbortSignal) => Promise<U02Response<T>>

function validYear(value: number | undefined): number | undefined {
  return value !== undefined && Number.isInteger(value) && value >= 2024 && value <= 2027 ? value : undefined
}
function validMonth(value: number | undefined): number | undefined {
  return value !== undefined && Number.isInteger(value) && value >= 1 && value <= 12 ? value : undefined
}
export function useU02Projection<T>(
  surfaceId: "CAP01" | "CAP03",
  route: Accessor<SfResolvedRoute<"CAP01" | "CAP03">>,
  operationId: "domain.page.CAP01" | "domain.page.CAP03",
  request: Request<T>,
) {
  const context = useSfContext()
  const [revision, setRevision] = createSignal(0)
  const [selection, setSelection] = createStore({
    year: validYear(route().query.year),
    month: validMonth(route().query.month),
    opsMonth: undefined as number | undefined,
  })
  const [store, setStore] = createStore<{
    state: SfUiState
    projection: Projection<T> | null
    diagnostic: string | null
    periodPending: boolean
    periodFailure: SfUiState | null
  }>({ state: "loading", projection: null, diagnostic: null, periodPending: false, periodFailure: null })
  let periodRequest: AbortController | undefined
  const current = () => context.state().status === "ready" ? context.ready() : undefined
  // CAP03 follows only a route already committed by F01, including Back/Reload.
  // CAP01 keeps its independent executive producer selection.
  createEffect(() => {
    const selectedRoute = route()
    if (surfaceId !== "CAP03" || selectedRoute.surfaceId !== "CAP03") return
    batch(() => {
      setSelection({ year: validYear(selectedRoute.query.year), month: validMonth(selectedRoute.query.month) })
      setStore("periodFailure", null)
    })
  })
  const changeBudgetPeriod = async (period: Readonly<{ year?: number; month?: number }>) => {
    const source = route(), ready = current(), generation = context.generation()
    if (source.surfaceId !== "CAP03" || !ready || !context.changeBudgetPeriod) {
      console.error("Sucafina budget period navigation is unavailable")
      setStore("periodFailure", "unavailable")
      return
    }
    if (period.year === selection.year && period.month === selection.month) return
    const abort = new AbortController()
    periodRequest?.abort()
    periodRequest = abort
    setStore({ periodPending: true, periodFailure: null })
    const stillCurrent = () => !abort.signal.aborted && context.generation() === generation &&
      current()?.transport === ready.transport
    try {
      const status = await context.changeBudgetPeriod({ ...source, surfaceId: "CAP03" }, period, abort.signal)
      if (!stillCurrent() || status === "committed" || status === "aborted" || status === "kept-editing") return
      console.error("Sucafina budget period navigation did not commit", { status })
      setStore("periodFailure", status === "denied" ? "denied" : status === "invalid-link" ? "invalid" : "unavailable")
    } catch (error) {
      if (!stillCurrent()) return
      console.error("Sucafina budget period navigation failed", error instanceof Error ? error.name : "unknown")
      setStore("periodFailure", "unavailable")
    } finally {
      if (periodRequest === abort) {
        periodRequest = undefined
        setStore("periodPending", false)
      }
    }
  }
  onCleanup(() => periodRequest?.abort())
  const admitted = (operation: string): boolean => {
    const ready = current()
    if (!ready) return false
    const destination = ready.context.destinations.find((item) => item.capabilityId === surfaceId)
    if (!destination?.canRead) return false
    return ready.context.availability.some((resource) =>
      resource.family === "domain-read" && resource.resource === surfaceId &&
      resource.operations.some((item) => item.operationId === operation && item.state === "ready" && item.operational),
    )
  }
  const canAction = (action: string, operation: string): boolean => {
    const ready = current()
    if (!ready) return false
    const destination = ready.context.destinations.find((item) => item.capabilityId === surfaceId)
    return !!destination?.canRead && destination.allowedActionIds.includes(action) &&
      !!store.projection?.allowedActionIds.includes(action) &&
      ready.context.availability.some((resource) =>
        resource.family === "domain-read" && resource.resource === surfaceId &&
        resource.operations.some((item) => item.operationId === operation && item.state === "ready" && item.operational),
      )
  }

  createEffect(() => {
    const generation = context.generation()
    const ready = current()
    const state = context.state()
    const _refresh = revision()
    const year = selection.year
    const month = selection.month
    const opsMonth = selection.opsMonth
    const periodPending = store.periodPending, periodFailure = store.periodFailure
    void _refresh
    if (!ready || state.status !== "ready") {
      periodRequest?.abort()
      periodRequest = undefined
      setStore({ projection: null, diagnostic: null, periodPending: false, periodFailure: null,
        state: state.status === "unauthenticated" ? "session-expired"
          : state.status === "denied" || state.status === "context-mismatch" ? "denied"
          : state.status === "unavailable" ? "unavailable" : "loading" })
      return
    }
    if (!ready.context.destinations.some((item) => item.capabilityId === surfaceId && item.canRead)) {
      setStore({ projection: null, diagnostic: null, state: "denied" })
      return
    }
    if (!admitted(operationId)) {
      setStore({ projection: null, diagnostic: "The producer operation is not currently admitted", state: "unavailable" })
      return
    }
    if (surfaceId === "CAP03" && (periodPending || periodFailure)) {
      setStore({ projection: null, diagnostic: null, state: periodPending ? "loading" : periodFailure! })
      return
    }
    const abort = new AbortController()
    setStore({ projection: null, diagnostic: null, state: "loading" })
    void request(ready.transport, { year, month, opsMonth }, abort.signal).then((reply) => {
      if (abort.signal.aborted || context.generation() !== generation || context.ready()?.transport !== ready.transport) return
      if (reply.kind !== "response") {
        setStore({ projection: null, diagnostic: reply.reason,
          state: reply.reason === "outcome-unknown" ? "outcome-unknown" : "unavailable" })
        return
      }
      if (reply.body.status !== "ok") {
        const status = reply.body.status
        setStore({ projection: null, diagnostic: "reason" in reply.body ? reply.body.reason : status,
          state: status === "unauthenticated" ? "session-expired"
            : status === "denied" ? "denied" : status === "stale" ? "stale"
            : status === "needs-input" ? "invalid" : "unavailable" })
        return
      }
      if (reply.body.value.capabilityId !== surfaceId || reply.status < 200 || reply.status >= 300) {
        setStore({ projection: null, diagnostic: "producer-contract-mismatch", state: "unavailable" })
        return
      }
      const snapshot = reply.body.value
      setStore({ projection: snapshot, diagnostic: null, state: "ready" })
    }).catch((error: unknown) => {
      if (!abort.signal.aborted) {
        setStore({ projection: null,
          diagnostic: error instanceof Error ? error.message : "read-failed", state: "unavailable" })
      }
    })
    onCleanup(() => abort.abort())
  })
  return {
    state: () => store.state,
    snapshot: () => store.projection,
    diagnostic: () => store.diagnostic,
    refresh: () => batch(() => { setStore("periodFailure", null); setRevision((count) => count + 1) }),
    selection: () => ({ year: selection.year, month: selection.month, opsMonth: selection.opsMonth }),
    resetBudgetPeriod: () => { if (surfaceId === "CAP03") void changeBudgetPeriod({}) },
    setYear: (year: number) => {
      if (validYear(year) === undefined) return
      if (surfaceId === "CAP03") { void changeBudgetPeriod({ year, ...(selection.month === undefined ? {} : { month: selection.month }) }); return }
      setSelection("year", year)
    },
    setMonth: (month: number) => {
      if (validMonth(month) === undefined) return
      if (surfaceId === "CAP03") { void changeBudgetPeriod({ ...(selection.year === undefined ? {} : { year: selection.year }), month }); return }
      setSelection("month", month)
    },
    setOpsMonth: (month: number) => { if (validMonth(month) !== undefined) setSelection("opsMonth", month) },
    canAction,
    context,
    owner: current,
  }
}

export function valueAt(record: Readonly<Record<string, number | null | undefined>> | undefined, year: number | undefined) {
  return year === undefined ? undefined : record?.[String(year)]
}
export function knownNumber(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}
export function asSourceRef(id: string): SfRef {
  // Domain IDs come from the admitted typed producer, never from a URL guess.
  return id as SfRef
}
