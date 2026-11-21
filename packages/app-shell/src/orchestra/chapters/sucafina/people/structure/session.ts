import { createEffect, onCleanup, untrack } from "solid-js"
import { createStore } from "solid-js/store"
import type { SfContextStamp, SfOwnerKey } from "@orchestra/schema/sucafina/context"
import type { SfTransportResult } from "@orchestra/schema/sucafina/common"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { useSfContext } from "../../context"
import type { SfUiState } from "../../shared/frame"

/**
 * N14 read boundary shared by CAP06, CAP07 and CAP08.
 * Neither a resolved route nor a cached page confers permission. A page can be
 * rendered only under the current F01 owner, generation and context stamp.
 * Every refresh is a new authorized A10 read, never a local Snapshot projection.
 */
export type PeopleCapability = "CAP06" | "CAP07" | "CAP08"
export type PeopleValue<Data> = Readonly<{
  capabilityId: PeopleCapability
  selection: Readonly<{ year?: number; month?: number; memberStatus?: string }>
  data: Data
  versions: Readonly<Record<string, number>>
  allowedActionIds: readonly string[]
}>
export type PeopleRead<Data> =
  | Readonly<{ status: "ok"; context: SfContextStamp; value: PeopleValue<Data> }>
  | Readonly<{ status: "unauthenticated" | "denied" }>
  | Readonly<{ status: "needs-input" | "stale" | "unavailable"; reason: string }>

type State<Data> = {
  ui: SfUiState
  value: PeopleValue<Data> | undefined
  ownerKey: SfOwnerKey | undefined
  generation: number
  reason: string | undefined
}

function sameStamp(a: SfContextStamp, b: SfContextStamp): boolean {
  return a.installationId === b.installationId &&
    a.projectId === b.projectId &&
    a.hostId === b.hostId &&
    a.principalRef === b.principalRef &&
    a.policyVersion === b.policyVersion &&
    a.accessRevision === b.accessRevision
}

export function createPeopleSession<Data>(
  capabilityId: PeopleCapability,
  routeHref: () => string,
  read: (transport: SfTransport, signal: AbortSignal) => Promise<SfTransportResult<PeopleRead<Data>>>,
) {
  const context = useSfContext()
  const [store, setStore] = createStore<State<Data>>({
    ui: "loading", value: undefined, ownerKey: undefined, generation: -1, reason: undefined,
  })
  let current: AbortController | undefined
  let serial = 0

  const clear = (ui: SfUiState, generation: number, reason?: string) => {
    setStore({
      ui, value: undefined, ownerKey: undefined,
      generation, reason,
    })
  }
  const ready = () => {
    const currentState = context.state()
    if (currentState.status !== "ready") return undefined
    if (store.generation !== context.generation() || store.ownerKey !== currentState.ownerKey) return undefined
    const active = context.ready()
    if (!active || !store.value) return undefined
    const destination = active.context.destinations.find((entry) =>
      entry.capabilityId === capabilityId && entry.surface === "dashboard" && entry.canRead)
    if (!destination) return undefined
    return { ...active, value: store.value, ownerKey: currentState.ownerKey }
  }
  const ui = (): SfUiState => {
    const state = context.state()
    if (state.status === "denied" || state.status === "context-mismatch") return "denied"
    if (state.status === "unauthenticated") return "session-expired"
    if (state.status === "unavailable") return "unavailable"
    if (state.status !== "ready") return "loading"
    if (store.ui === "ready" && !ready()) return "loading"
    return store.ui
  }
  const can = (actionId: string) => {
    const active = ready()
    if (!active) return false
    const destination = active.context.destinations.find((entry) =>
      entry.capabilityId === capabilityId && entry.surface === "dashboard" && entry.canRead)
    if (!destination || !destination.allowedActionIds.includes(actionId)) return false
    if (!active.value.allowedActionIds.includes(actionId)) return false
    const resource = active.context.availability.find((entry) =>
      entry.family === "domain-read" && entry.resource === capabilityId)
    return !!resource && resource.state !== "denied" && resource.state !== "unavailable" &&
      resource.operations.some((op) =>
        op.operationId === "domain.command." + capabilityId + "." + actionId &&
        op.state === "ready" && op.operational)
  }

  async function reload(): Promise<PeopleValue<Data> | undefined> {
    const id = ++serial
    current?.abort()
    const controller = new AbortController()
    current = controller
    const generation = context.generation()
    const state = context.state()
    if (state.status !== "ready") {
      clear(state.status === "denied" || state.status === "context-mismatch" ? "denied" :
        state.status === "unauthenticated" ? "session-expired" :
        state.status === "unavailable" ? "unavailable" : "loading", generation)
      return
    }
    const active = context.ready()
    const destination = active?.context.destinations.find((entry) =>
      entry.capabilityId === capabilityId && entry.surface === "dashboard")
    const resource = active?.context.availability.find((entry) =>
      entry.family === "domain-read" && entry.resource === capabilityId)
    if (!active || !destination?.canRead || resource?.state === "denied") {
      clear("denied", generation)
      return
    }
    if (!resource || resource.state === "unavailable") {
      clear("unavailable", generation, "resource-unavailable")
      return
    }
    const readAvailability = resource.operations.find((op) => op.operationId === "domain.page." + capabilityId)
    if (!readAvailability || readAvailability.state !== "ready" || !readAvailability.operational) {
      clear(readAvailability?.state === "denied" ? "denied" : "unavailable", generation)
      return
    }
    // Drop all previous private content even while a same-owner read is pending.
    clear("loading", generation)
    const stillCurrent = () => {
      const live = context.state()
      return !controller.signal.aborted && serial === id &&
        context.generation() === generation &&
        live.status === "ready" &&
        live.ownerKey === state.ownerKey
    }
    try {
      const result = await read(active.transport, controller.signal)
      if (!stillCurrent()) return
      if (result.kind === "transport-error") {
        clear(result.reason === "outcome-unknown" ? "outcome-unknown" : "unavailable",
          generation, result.reason)
        return
      }
      if (result.body.status !== "ok") {
        const reason = "reason" in result.body ? result.body.reason : result.body.status
        clear(result.body.status === "unauthenticated" || result.status === 401 ? "session-expired" :
          result.body.status === "denied" || result.status === 403 ? "denied" :
          result.body.status === "needs-input" ? "invalid" :
          result.body.status === "stale" ? "stale" : "unavailable", generation, reason)
        return
      }
      if (result.body.value.capabilityId !== capabilityId || !sameStamp(result.body.context, active.context.stamp)) {
        clear("stale", generation, "context-stamp-mismatch")
        return
      }
      setStore({
        ui: "ready",
        value: result.body.value,
        ownerKey: state.ownerKey,
        generation,
        reason: undefined,
      })
      return result.body.value
    } catch (error) {
      if (!stillCurrent()) return
      console.error("Sucafina people read failed", error instanceof Error ? error.name : "unknown")
      clear("unavailable", generation, "read-failed")
    }
  }

  createEffect(() => {
    context.generation()
    context.state().status
    routeHref()
    untrack(() => { void reload() })
    onCleanup(() => current?.abort())
  })
  onCleanup(() => {
    serial++
    current?.abort()
    clear("denied", context.generation())
  })
  return { context, ui, ready, can, reload, reason: () => store.reason }
}
