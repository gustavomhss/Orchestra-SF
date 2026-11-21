import { createEffect, createSignal, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { createSfPeopleClient } from "@orchestra/client/sucafina/people"
import { useSfContext } from "../../context"
import type { SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfUiState } from "../../shared/frame/types"
import type { SfPeopleTopic } from "@orchestra/schema/sucafina/people"

export type Topic = SfPeopleTopic
export type TopicStatus = "" | "open" | "progress" | "blocked" | "done"
export function topicStatus(value: unknown): TopicStatus {
  return value === "open" || value === "progress" || value === "blocked" || value === "done" ? value : ""
}

/** Typed CAP02 projection; owner revocation immediately drops all private rows. */
export function useHotTopicsSource(route: SfResolvedRoute<"CAP02">) {
  const context = useSfContext()
  const [filter, setFilter] = createSignal<TopicStatus>(topicStatus(route.query.status))
  const [revision, setRevision] = createSignal(0)
  const [store, setStore] = createStore<{
    state: SfUiState
    records: readonly Topic[] | null
    versions: Readonly<Record<string, number>>
    allowedActionIds: readonly string[]
    diagnostic: string | null
  }>({ state: "loading", records: null, versions: {}, allowedActionIds: [], diagnostic: null })
  const current = () => context.state().status === "ready" ? context.ready() : undefined
  const admitted = (operation: string, action?: string): boolean => {
    const ready = current()
    if (!ready) return false
    const destination = ready.context.destinations.find((item) => item.capabilityId === "CAP02")
    if (!destination?.canRead) return false
    if (action && (!destination.allowedActionIds.includes(action) || !store.allowedActionIds.includes(action))) return false
    return ready.context.availability.some((resource) =>
      resource.family === "domain-read" && resource.resource === "CAP02" &&
      resource.operations.some((item) =>
        item.operationId === operation && item.state === "ready" && item.operational))
  }
  createEffect(() => {
    const generation = context.generation()
    const state = context.state()
    const ready = current()
    const selected = filter()
    const refresh = revision()
    void refresh
    if (state.status !== "ready" || !ready) {
      setStore({ records: null, versions: {}, allowedActionIds: [], diagnostic: null,
        state: state.status === "unauthenticated" ? "session-expired" :
          state.status === "denied" || state.status === "context-mismatch" ? "denied" :
          state.status === "unavailable" ? "unavailable" : "loading" })
      return
    }
    if (!ready.context.destinations.some((item) => item.capabilityId === "CAP02" && item.canRead)) {
      setStore({ state: "denied", records: null, versions: {}, allowedActionIds: [] });return
    }
    if (!admitted("domain.page.CAP02")) {
      setStore({ state: "unavailable", records: null, versions: {}, allowedActionIds: [] });return
    }
    const abort = new AbortController()
    setStore({ state: "loading", records: null, versions: {}, allowedActionIds: [] })
    const params = { topicStatus: selected,
      ...(route.query.year !== undefined ? { year: route.query.year } : {}),
      ...(route.query.month !== undefined ? { month: route.query.month } : {}) }
    void createSfPeopleClient(ready.transport)["domain.page.CAP02"](params, { signal: abort.signal })
      .then((response) => {
        if (abort.signal.aborted || context.generation() !== generation ||
          context.ready()?.transport !== ready.transport) return
        if (response.kind !== "response") {
          setStore({ state: response.reason === "outcome-unknown" ? "outcome-unknown" : "unavailable",
            diagnostic: response.reason, records: null })
          return
        }
        if (response.status < 200 || response.status >= 300) {
          setStore({ state: "unavailable", records: null, diagnostic: "producer-response-error" });return
        }
        if (response.body.status !== "ok") {
          setStore({ state: response.body.status === "unauthenticated" ? "session-expired" :
            response.body.status === "denied" ? "denied" :
            response.body.status === "needs-input" ? "invalid" :
            response.body.status === "stale" ? "stale" : "unavailable",
            records: null, diagnostic: "reason" in response.body ? response.body.reason : response.body.status })
          return
        }
        if (response.body.value.capabilityId !== "CAP02") {
          setStore({ state: "unavailable", records: null, diagnostic: "wrong-capability" });return
        }
        setStore({ records: response.body.value.data.hotTopics,
          versions: response.body.value.versions,
          allowedActionIds: response.body.value.allowedActionIds,
          diagnostic: null,
          state: response.body.value.data.hotTopics.length === 0 ? selected ? "filtered-empty" : "empty" : "ready" })
      }).catch((error: unknown) => {
        if (!abort.signal.aborted) setStore({ state: "unavailable", records: null,
          diagnostic: error instanceof Error ? error.message : "read-failed" })
      })
    onCleanup(() => abort.abort())
  })
  return {
    context,
    owner: current,
    state: () => store.state,
    records: () => store.records,
    versions: () => store.versions,
    allowed: (action: "save" | "delete") => admitted("domain.command.CAP02." + action, action),
    filter,
    setFilter,
    refresh: () => setRevision((value) => value + 1),
    diagnostic: () => store.diagnostic,
  }
}
