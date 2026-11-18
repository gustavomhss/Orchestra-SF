/**
 * N24 U16/U17: authorized case projection reader. The A04 client and F01
 * context are the only IO/authority boundary; a view never scans product state.
 * Each request is fenced by owner generation, source scope and AbortSignal.
 */
import { createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import type { Schema } from "effect"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import { useSfContext } from "../../context"
import type { SfUiState } from "../../shared/frame"
import type { SfContext, SfContextHandle } from "../../context/contracts"

type CaseEnvelope = Schema.Schema.Type<(typeof SfDecisions.operations)["projection.case"]["output"]>
type CasesEnvelope = Schema.Schema.Type<(typeof SfDecisions.operations)["projection.cases"]["output"]>
export type SfCaseProjection = Extract<CaseEnvelope, { status: "ok" }>["value"]["projection"]
export type SfCaseRecord = SfCaseProjection["case"]
export type SfCaseListEntry = Extract<CasesEnvelope, { status: "ok" }>["value"]["cases"][number]

export function sfOperationReady(context: SfContext, operationId: string): boolean {
  return context.availability.some((resource) =>
    resource.operations.some((op) => op.operationId === operationId && op.state === "ready" && op.operational),
  )
}

export function sfContextUiState(status: ReturnType<ReturnType<typeof useSfContext>["state"]>["status"]): SfUiState {
  if (status === "denied") return "denied"
  if (status === "unauthenticated") return "session-expired"
  if (status === "context-mismatch") return "invalid"
  if (status === "unavailable") return "unavailable"
  return "loading"
}
export function sfFailureUiState(status: string, httpStatus: number): SfUiState {
  if (status === "denied" || httpStatus === 403) return "denied"
  if (status === "unauthenticated" || httpStatus === 401) return "session-expired"
  if (status === "not-found" && httpStatus === 404) return "not-found"
  if (status === "stale") return "stale"
  if (status === "conflict" || status === "provider-conflict" || httpStatus === 409) return "conflict"
  if (status === "needs-input" || status === "invalid") return "invalid"
  return "unavailable"
}

/** The producer's projection context must agree with the CURRENT authenticated owner. */
function sameAuthorizedProjection(projection: SfCaseProjection, context: SfContext): boolean {
  const stamp = context.stamp
  return projection.context.installationId === stamp.installationId
    && projection.context.projectId === stamp.projectId
    && projection.context.principalRef === stamp.principalRef
    && projection.context.policyVersion === stamp.policyVersion
    && projection.context.accessRevision === stamp.accessRevision
}

export function useSfCase(caseRef: () => string): {
  owner: SfContextHandle
  read: {
    state: SfUiState
    projection?: SfCaseProjection
    refresh: number
    returnTo?: string
  }
  reload: () => void
} {
  const owner = useSfContext()
  const [read, setRead] = createStore<{
    state: SfUiState
    projection?: SfCaseProjection
    refresh: number
    returnTo?: string
  }>({ state: "loading", refresh: 0 })
  let epoch = 0
  createEffect(() => {
    const active = owner.ready()
    const status = owner.state().status
    const generation = owner.generation()
    const target = caseRef()
    const revision = read.refresh
    const ticket = ++epoch
    setRead({ state: active ? "loading" : sfContextUiState(status), projection: undefined, returnTo: undefined })
    if (!active || !target) {
      if (!target) setRead("state", "invalid")
      return
    }
    if (!sfOperationReady(active.context, "projection.case")) {
      setRead("state", "unavailable")
      return
    }
    const abort = new AbortController()
    onCleanup(() => abort.abort())
    const client = createSfDecisionsClient(active.transport)
    void client["projection.case"]({ caseRef: target }, { signal: abort.signal }).then((result) => {
      if (abort.signal.aborted || ticket !== epoch || owner.generation() !== generation) return
      if (result.kind === "transport-error") {
        setRead("state", result.reason === "aborted" ? "loading" : "unavailable")
        return
      }
      const response = result.body
      if (response.status !== "ok") {
        setRead("state", sfFailureUiState(response.status, result.status))
        return
      }
      const stamp = response.context
      const latest = owner.ready()
      if (!latest || latest.context.stamp.accessRevision !== stamp.accessRevision
        || latest.context.stamp.policyVersion !== stamp.policyVersion
        || latest.context.stamp.hostId !== stamp.hostId
        || latest.context.stamp.principalRef !== stamp.principalRef
        || !sameAuthorizedProjection(response.value.projection, latest.context)) {
        setRead({ state: "denied", projection: undefined })
        return
      }
      setRead({ state: "ready", projection: response.value.projection, returnTo: response.value.returnTo })
    }).catch((error: unknown) => {
      if (abort.signal.aborted || ticket !== epoch) return
      console.error("Sucafina case projection failed", error)
      setRead("state", "unavailable")
    })
    void revision
  })
  return {
    owner,
    read,
    reload: () => setRead("refresh", (previous) => previous + 1),
  } as const
}

export function useSfCases() {
  const owner = useSfContext()
  const [read, setRead] = createStore<{
    state: SfUiState
    cases: readonly SfCaseListEntry[]
    refresh: number
  }>({ state: "loading", cases: [], refresh: 0 })
  let epoch = 0
  createEffect(() => {
    const active = owner.ready()
    const status = owner.state().status
    const generation = owner.generation()
    const revision = read.refresh
    const ticket = ++epoch
    setRead({ state: active ? "loading" : sfContextUiState(status), cases: [] })
    if (!active) return
    if (!sfOperationReady(active.context, "projection.cases")) {
      setRead("state", "unavailable")
      return
    }
    const abort = new AbortController()
    onCleanup(() => abort.abort())
    const client = createSfDecisionsClient(active.transport)
    void client["projection.cases"]({}, { signal: abort.signal }).then((result) => {
      if (abort.signal.aborted || ticket !== epoch || owner.generation() !== generation) return
      if (result.kind === "transport-error") {
        setRead("state", result.reason === "aborted" ? "loading" : "unavailable")
        return
      }
      if (result.body.status !== "ok") {
        setRead("state", sfFailureUiState(result.body.status, result.status))
        return
      }
      const stamp = result.body.context
      const latest = owner.ready()
      if (!latest || stamp.installationId !== latest.context.stamp.installationId
        || stamp.projectId !== latest.context.stamp.projectId
        || stamp.hostId !== latest.context.stamp.hostId
        || stamp.principalRef !== latest.context.stamp.principalRef
        || stamp.policyVersion !== latest.context.stamp.policyVersion
        || stamp.accessRevision !== latest.context.stamp.accessRevision) {
        setRead({ state: "denied", cases: [] })
        return
      }
      setRead({ state: result.body.value.cases.length ? "ready" : "empty", cases: result.body.value.cases })
    }).catch((error: unknown) => {
      if (abort.signal.aborted || ticket !== epoch) return
      console.error("Sucafina case list failed", error)
      setRead("state", "unavailable")
    })
    void revision
  })
  return { owner, read, reload: () => setRead("refresh", (previous) => previous + 1) } as const
}
