import { createEffect, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { createSfWorkClient } from "@orchestra/client/sucafina/work"
import { SfProjectionSearch } from "@orchestra/schema/sucafina/work"
import { SfOperationRegistry, type SfNativeOperationRoute } from "@orchestra/schema/sucafina/operation-registry"
import type { Schema } from "effect"
import type { SfSurfaceProps } from "../context/contracts"
import { useSfContext } from "../context"
import { SfPageFrame, type SfCopyKey, type SfUiState } from "../shared/frame"
import { SfStatePanel } from "../shared/states"
import { useSfPresentation } from "../shared/frame/presentation"

type Result = Extract<Schema.Schema.Type<typeof SfProjectionSearch.Output>, { status: "ok" }>["value"]
type Match = Result["matches"][number]
type KindFilter = "all" | Match["documentRef"]["kind"]
type State = {
  query: string
  submitted: string
  kind: KindFilter
  state: SfUiState
  searched: boolean
  matches: readonly Match[]
  limitations: readonly string[]
  sourceRevision: string | null
}
const key = (value: string) => value as SfCopyKey
const TYPES: readonly KindFilter[] = ["all", "document", "record", "calculation", "receipt", "case-event", "policy"]

/**
 * The published GET search route serializes q in the HTTP URL. Neither an
 * unchanged address bar nor no-store makes that safe. This is deliberately a
 * fail-closed consumer fence, not a new route: 153/132 must publish the real
 * POST-read contract across HTTP and desktop before search can dispatch.
 */
function hasPrivateSearchBodyRoute(route: SfNativeOperationRoute): boolean {
  return route.method === "POST" && route.effect === "read" &&
    route.responseMode === "json" &&
    route.pathTemplate === "{mount}/api/ui/projections/search" &&
    route.fixedQuery === undefined && route.fixedBodyDiscriminator === undefined &&
    route.maxRequestBytes !== undefined && Number.isInteger(route.maxRequestBytes) &&
    route.maxRequestBytes >= 2_048 && route.maxRequestBytes <= 8_192
}

/** UI31. Search is scoped by the real source; no cross-owner cache or local corpus. */
export function SfSearchView(_props: SfSurfaceProps<"UI31">): JSX.Element {
  const owner = useSfContext()
  const { t } = useSfPresentation()
  const [screen, setScreen] = createStore<State>({
    query: "", submitted: "", kind: "all",
    state: "ready", searched: false, matches: [], limitations: [], sourceRevision: null,
  })
  let inFlight: AbortController | undefined
  let lastScope: string | undefined
  const statusFromContext = (): SfUiState => {
    const status = owner.state().status
    if (status === "resolving") return "loading"
    if (status === "unauthenticated") return "session-expired"
    if (status === "denied") return "denied"
    if (status === "context-mismatch") return "invalid"
    return "unavailable"
  }
  const privateRouteReady = () => hasPrivateSearchBodyRoute(SfOperationRegistry["projection.search"])
  const sourceReady = () => {
    const ready = owner.ready()
    const operation = ready?.context.availability
      .find((entry) => entry.family === "domain-read" && entry.resource === "search")
      ?.operations.find((entry) => entry.operationId === "projection.search")
    return !!ready && operation?.state === "ready" && operation.operational && privateRouteReady()
  }
  const selected = () => screen.kind === "all"
    ? screen.matches
    : screen.matches.filter((match) => match.documentRef.kind === screen.kind)
  const clear = (state: SfUiState, forgetQuery: boolean) => {
    inFlight?.abort()
    inFlight = undefined
    setScreen({
      query: forgetQuery ? "" : screen.query,
      submitted: "",
      kind: forgetQuery ? "all" : screen.kind,
      state,
      searched: false,
      matches: [],
      limitations: [],
      sourceRevision: null,
    })
  }
  createEffect(() => {
    const state = owner.state()
    const ready = owner.ready()
    if (state.status !== "ready" || !ready) {
      clear(statusFromContext(), state.status === "denied" || state.status === "context-mismatch")
      return
    }
    const stamp = ready.context.stamp
    const scope = [state.ownerKey, stamp.hostId, stamp.accessRevision, stamp.policyVersion].join(":")
    if (lastScope !== scope) {
      clear(sourceReady() ? "ready" : "unavailable", true)
      lastScope = scope
      return
    }
    if (!sourceReady()) clear("unavailable", false)
    onCleanup(() => inFlight?.abort())
  })
  const submit = () => {
    const ready = owner.ready()
    const value = screen.query.trim()
    if (!ready || !sourceReady()) {
      clear(owner.state().status === "ready" ? "unavailable" : statusFromContext(), false)
      return
    }
    if (!value || value.length > 500) {
      setScreen({ state: "invalid", searched: false, submitted: "", matches: [], limitations: [] })
      return
    }
    inFlight?.abort()
    const request = new AbortController()
    inFlight = request
    const generation = owner.generation()
    const revision = ready.context.stamp.accessRevision
    setScreen({ state: "loading", searched: true, submitted: value, matches: [], limitations: [], sourceRevision: null })
    void createSfWorkClient(ready.transport)["projection.search"]({ q: value }, { signal: request.signal }).then((result) => {
      if (request.signal.aborted || generation !== owner.generation() ||
          revision !== owner.ready()?.context.stamp.accessRevision) return
      if (result.kind !== "response") {
        if (result.reason !== "aborted") console.error("SF search request failed", result.reason)
        setScreen({ state: "unavailable", matches: [], limitations: [], sourceRevision: null })
        return
      }
      if (result.body.status === "ok") {
        setScreen({
          state: result.body.value.matches.length ? "ready" : "filtered-empty",
          matches: result.body.value.matches,
          limitations: result.body.value.limitations,
          sourceRevision: result.headers["x-sf-access-revision"] ?? revision,
        })
        return
      }
      const next: SfUiState =
        result.body.status === "denied" ? "denied"
        : result.body.status === "stale" ? "stale"
        : result.body.status === "conflict" ? "conflict"
        : result.body.status === "needs-input" || result.body.status === "invalid" ? "invalid"
        : "unavailable"
      setScreen({ state: next, matches: [], limitations: [], sourceRevision: null })
      if (next === "unavailable") console.error("SF search producer unavailable")
    }).catch((error: unknown) => {
      if (request.signal.aborted || generation !== owner.generation()) return
      console.error("SF search request failed", error instanceof Error ? error.name : "unknown")
      setScreen({ state: "unavailable", matches: [], limitations: [], sourceRevision: null })
    })
  }
  const retry = () => {
    if (screen.searched && screen.submitted && sourceReady()) {
      submit()
      return
    }
    void owner.reload()
  }
  const feedback = (): SfCopyKey =>
    key(screen.state === "denied" ? "sf.common.noAccess"
      : screen.state === "session-expired" ? "sf.common.loginAgain"
      : screen.state === "loading" ? "sf.common.loading"
      : screen.state === "invalid" ? "sf.ui31.queryRequired"
      : screen.state === "stale" ? "sf.common.stale"
      : screen.state === "filtered-empty" || (screen.searched && !selected().length) ? "sf.common.filterEmpty"
      : "sf.common.unavailable")

  return (
    <SfPageFrame
      titleKey={key("sf.ui31.title")}
      subtitleKey={key("sf.ui31.subtitle")}
      context={[]}
      tabs={[]}
      activeTab={null}
      secondaryActions={[]}
      density="comfortable"
      layout="reading"
      onLayoutMode={() => undefined}
    >
      <section class="mx-card min-w-0" aria-labelledby="sf-u42-query">
        <h2 id="sf-u42-query">{t(key("sf.ui31.query"))}</h2>
        <Show when={owner.state().status === "ready" && !privateRouteReady()}>
          <p role="status" data-sf-search-privacy="blocked">{t(key("sf.ui31.privateRouteUnavailable"))}</p>
        </Show>
        <form onSubmit={(event) => { event.preventDefault(); submit() }}>
          <div class="flex min-w-0 flex-col gap-3 sm:flex-row">
            <label class="min-w-0 flex-1">
              <span class="block">{t(key("sf.ui31.queryLabel"))}</span>
              <input
                type="search"
                class="mx-input w-full"
                value={screen.query}
                maxLength={500}
                onInput={(event) => setScreen("query", event.currentTarget.value)}
                disabled={!sourceReady()}
                aria-invalid={screen.state === "invalid"}
              />
            </label>
            <button class="mx-btn primary self-end" type="submit" disabled={!sourceReady() || screen.state === "loading"}>
              {t(key("sf.ui31.primary"))}
            </button>
          </div>
        </form>
        <label class="mt-3 block">
          <span class="block">{t(key("sf.ui31.typeFilter"))}</span>
          <select
            class="mx-input"
            value={screen.kind}
            disabled={!sourceReady()}
            onChange={(event) => {
              const kind = event.currentTarget.value
              if (TYPES.some((candidate) => candidate === kind)) setScreen("kind", kind as KindFilter)
            }}
          >
            <For each={TYPES}>
              {(kind) => <option value={kind}>{t(key(`sf.ui31.kind.${kind}`))}</option>}
            </For>
          </select>
        </label>
      </section>
      <section class="mx-card min-w-0" aria-labelledby="sf-u42-results">
        <h2 id="sf-u42-results">{t(key("sf.ui31.results"))}</h2>
        <Show when={screen.searched && screen.state === "ready"}>
          <p role="status">
            {t(key("sf.ui31.resultCount"), { shown: selected().length, returned: screen.matches.length })}
          </p>
        </Show>
        <Show
          when={owner.state().status === "ready" && sourceReady() && (!screen.searched || screen.state === "ready")}
          fallback={
            <SfStatePanel
              state={screen.state === "ready"
                ? (screen.searched && !selected().length ? "filtered-empty" : "unavailable")
                : screen.state}
              messageKey={feedback()}
              onRetryRead={retry}
            />
          }
        >
          <Show when={!screen.searched}><p>{t(key("sf.ui31.noQuery"))}</p></Show>
          <Show when={screen.searched && selected().length === 0}>
            <SfStatePanel state="filtered-empty" messageKey={key("sf.common.filterEmpty")} />
          </Show>
          <Show when={selected().length > 0}>
            <ol class="list-decimal ps-5" data-sf-search-results="authorized">
              <For each={selected()}>
                {(match) => (
                  <li class="min-w-0 py-3" data-sf-match-kind={match.documentRef.kind}>
                    <p class="break-words"><bdi>{match.text}</bdi></p>
                    <dl class="text-sm">
                      <dt>{t(key("sf.ui31.typeFilter"))}</dt>
                      <dd>{t(key(`sf.ui31.kind.${match.documentRef.kind}`))}</dd>
                      <dt>{t(key("sf.ui31.evidenceLevel"))}</dt>
                      <dd><bdi>{match.documentRef.evidenceLevel}</bdi></dd>
                    </dl>
                    <p>{t(key("sf.ui31.sourceNavigationRequiresAuth"))}</p>
                  </li>
                )}
              </For>
            </ol>
          </Show>
          <Show when={screen.limitations.length > 0}>
            <h3>{t(key("sf.ui31.limitations"))}</h3>
            <ul class="list-disc ps-5">
              <For each={screen.limitations}>{(limit) => <li><bdi>{limit}</bdi></li>}</For>
            </ul>
          </Show>
        </Show>
      </section>
      <section class="mx-card min-w-0" aria-labelledby="sf-u42-source">
        <h2 id="sf-u42-source">{t(key("sf.ui31.sourceContext"))}</h2>
        <p>{t(key("sf.ui31.sourceScope"))}</p>
        <Show when={screen.sourceRevision && screen.state === "ready"}>
          <p>{t(key("sf.ui31.authorityRevision"), { revision: screen.sourceRevision! })}</p>
        </Show>
      </section>
    </SfPageFrame>
  )
}
