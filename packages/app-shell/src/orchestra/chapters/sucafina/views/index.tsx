import { A } from "@solidjs/router"
import { sfPlannerSavedViewHref } from "./planner-view"
import { createEffect, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { createSfWorkClient } from "@orchestra/client/sucafina/work"
import { SfViewsList, SfViewsOpen } from "@orchestra/schema/sucafina/work"
import type { SfCallOptions } from "@orchestra/client/sucafina/transport"
import type { SfEditScopeKey, SfOperationRef, SfRef } from "@orchestra/schema/sucafina/context"
import type { Schema } from "effect"
import { useSfContext } from "../context"
import type { SfPublicDraftController, SfSurfaceProps } from "../context/contracts"
import { SfPageFrame, type SfCopyKey, type SfUiState } from "../shared/frame"
import { SfStatePanel } from "../shared/states"
import { useSfPresentation } from "../shared/frame/presentation"
import { SfChangeReview, type SfReviewField, type SfReviewSnapshot } from "../shared/change-review"
import "./views.css"

type ListEntry = Extract<Schema.Schema.Type<typeof SfViewsList.Output>, { status: "ok" }>["value"][number]
type RecordView = Extract<Schema.Schema.Type<typeof SfViewsOpen.Output>, { status: "ok" }>["value"]
type PersonalView = RecordView["view"]
type LegacySurface = "dashboard" | "planner" | "procurement"
type MutationPhase = "idle" | "review-remove" | "submitting" | "outcome-unknown" | "conflict" | "failed"
type State = {
  list: readonly ListEntry[]
  listState: SfUiState
  detail: RecordView | null
  detailState: SfUiState
  mutation: MutationPhase
  error: SfUiState | null
}
const key = (value: string) => value as SfCopyKey
const canOpenLegacy = (id: string) => /^[A-Za-z0-9_-]{8,128}$/.test(id)
const message = (name: string) => ({ key: key(name) })
const field = (path: "title" | "density", value: PersonalView): SfReviewField => ({
  path,
  label: message(path === "title" ? "sf.ui32.name" : "sf.ui32.density"),
  value: path === "title"
    ? { kind: "text", text: { kind: "data", text: value.title } }
    : { kind: "text", text: { kind: "message", message: message(
      value.density === "compact" ? "sf.ui32.density.compact" : "sf.ui32.density.comfortable",
    ) } },
})
const snapshot = (record: RecordView, value: PersonalView): SfReviewSnapshot => ({
  kind: "persisted",
  ref: value.id as SfRef,
  version: record.version,
  fields: [field("title", value), field("density", value)],
})

/**
 * UI32 consumes the *actual* legacy personal-view port. V2 native views and
 * preferred landing remain unavailable until the real source is released and
 * A12/125 admit schemaVersion:2. Supported V1 planner views are re-read by the
 * native destination; no V2 record or preferred-entry permission is fabricated.
 * Drafts are held only by F01/S03, never localStorage or an alternate store.
 */
export function SfSavedViewsView(props: SfSurfaceProps<"UI32">): JSX.Element {
  const owner = useSfContext()
  const { t } = useSfPresentation()
  const [screen, setScreen] = createStore<State>({
    list: [], listState: "loading", detail: null, detailState: "empty",
    mutation: "idle", error: null,
  })
  let editor: SfPublicDraftController<PersonalView> | undefined
  let listRequest: AbortController | undefined
  let detailRequest: AbortController | undefined
  let mutationRequest: AbortController | undefined
  let scope: string | undefined

  const restoreHref = (view: PersonalView) => sfPlannerSavedViewHref(view, props.route.ownerSelection)
  const current = () => owner.ready()
  const operationReady = (name: "views.list" | "views.open" | "views.save" | "views.remove") => {
    const operation = current()?.context.availability
      .find((entry) => entry.family === "domain-read" && entry.resource === "views")
      ?.operations.find((entry) => entry.operationId === name)
    return !!operation && operation.state === "ready" && operation.operational
  }
  const legacySurface = (): LegacySurface | undefined => current()?.context.destinations
    .find((destination) => destination.canRead)?.surface
  const reset = (status: SfUiState) => {
    listRequest?.abort()
    detailRequest?.abort()
    mutationRequest?.abort()
    listRequest = undefined
    detailRequest = undefined
    mutationRequest = undefined
    editor = undefined
    setScreen({ list: [], listState: status, detail: null, detailState: status, mutation: "idle", error: null })
  }
  const translate = (status: string): SfUiState =>
    status === "denied" ? "denied"
    : status === "stale" ? "stale"
    : status === "conflict" ? "conflict"
    : status === "invalid" || status === "needs-input" ? "invalid"
    : "unavailable"
  const contextStatus = (): SfUiState => {
    const state = owner.state().status
    return state === "resolving" ? "loading"
      : state === "denied" ? "denied"
      : state === "unauthenticated" ? "session-expired"
      : state === "context-mismatch" ? "invalid" : "unavailable"
  }
  const loadList = () => {
    const ready = current()
    const surface = legacySurface()
    if (!ready || !surface || !operationReady("views.list")) {
      setScreen("listState", "unavailable")
      return
    }
    listRequest?.abort()
    const request = new AbortController()
    listRequest = request
    const generation = owner.generation()
    const revision = ready.context.stamp.accessRevision
    setScreen({ listState: "loading", list: [] })
    void createSfWorkClient(ready.transport)["views.list"](
      { surface, action: "list", input: {} }, { signal: request.signal },
    ).then((result) => {
      if (request.signal.aborted || generation !== owner.generation() || revision !== current()?.context.stamp.accessRevision) return
      if (result.kind !== "response") {
        if (result.reason !== "aborted") console.error("SF saved views list failed", result.reason)
        setScreen("listState", "unavailable")
        return
      }
      if (result.body.status !== "ok") {
        setScreen("listState", translate(result.body.status))
        return
      }
      setScreen({ list: result.body.value, listState: result.body.value.length ? "ready" : "empty" })
    }).catch((error: unknown) => {
      if (request.signal.aborted || generation !== owner.generation()) return
      console.error("SF saved views list failed", error instanceof Error ? error.name : "unknown")
      setScreen("listState", "unavailable")
    })
  }
  const open = (id: string, surface: LegacySurface) => {
    const ready = current()
    if (!canOpenLegacy(id)) { setScreen("detailState", "invalid"); return }
    if (!ready || !operationReady("views.open")) { setScreen("detailState", "unavailable"); return }
    detailRequest?.abort()
    const request = new AbortController()
    detailRequest = request
    const generation = owner.generation()
    const revision = ready.context.stamp.accessRevision
    editor = undefined
    setScreen({ detail: null, detailState: "loading", mutation: "idle", error: null })
    void createSfWorkClient(ready.transport)["views.open"](
      { surface, action: "open", input: { id } }, { signal: request.signal },
    ).then((result) => {
      if (request.signal.aborted || generation !== owner.generation() || revision !== current()?.context.stamp.accessRevision) return
      if (result.kind !== "response") {
        if (result.reason !== "aborted") console.error("SF saved view open failed", result.reason)
        setScreen("detailState", "unavailable")
        return
      }
      if (result.body.status !== "ok") {
        // V1 returns unavailable for an unknown/removed view: never fabricate not-found.
        setScreen("detailState", translate(result.body.status))
        return
      }
      const record = result.body.value
      if (record.view.id !== id || !current()) {
        setScreen("detailState", "invalid")
        return
      }
      editor = current()!.drafts.acquire<PersonalView>({
        surfaceId: "UI32",
        editScopeKey: `personal-view:v1:${record.view.surface}:${record.view.page}` as SfEditScopeKey,
        identity: { kind: "record", recordRef: record.view.id as SfRef },
        baseVersion: record.version,
        base: record.view,
        value: record.view,
        revalidation: {
          operationId: "views.open",
          input: { surface, action: "open", input: { id } },
          fieldPaths: ["title", "density", "filters", "period", "currency"],
          actionIds: ["views.save", "views.remove"],
        },
      })
      setScreen({ detail: record, detailState: "ready" })
    }).catch((error: unknown) => {
      if (request.signal.aborted || generation !== owner.generation()) return
      console.error("SF saved view open failed", error instanceof Error ? error.name : "unknown")
      setScreen("detailState", "unavailable")
    })
  }

  createEffect(() => {
    const state = owner.state()
    const ready = current()
    if (state.status !== "ready" || !ready) {
      reset(contextStatus())
      scope = undefined
      return
    }
    const stamp = ready.context.stamp
    const next = [state.ownerKey, stamp.hostId, stamp.accessRevision, stamp.policyVersion].join(":")
    if (next === scope) return
    reset("loading")
    scope = next
    const surface = legacySurface()
    if (props.route.kind === "new") {
      setScreen({ listState: "unavailable", detailState: "unavailable" })
    } else if (props.route.kind === "entry") {
      if (surface) open(props.route.params.viewId, surface)
      else setScreen("detailState", "unavailable")
    } else {
      // This route has no selected view. Only the list is loading; an editor
      // spinner must not remain active after the original list has returned.
      setScreen("detailState", "empty")
      loadList()
    }
    onCleanup(() => {
      listRequest?.abort()
      detailRequest?.abort()
      mutationRequest?.abort()
    })
  })

  const draft = () => screen.detail && editor ? editor.snapshot() : undefined
  const activeDraft = () => {
    const state = draft()
    return state?.availability === "active" ? state : undefined
  }
  const mayMutate = (name: "views.save" | "views.remove") =>
    operationReady(name) && screen.detailState === "ready" && screen.mutation === "idle"
  const reviewSave = () => {
    const state = activeDraft()
    if (!mayMutate("views.save") || !state || !state.dirty || !state.value.title.trim() || state.value.title.length > 120 || state.conflict) {
      setScreen("error", "invalid")
      return
    }
    editor?.setPhase("reviewing")
    setScreen("error", null)
  }
  const reviewRemove = () => {
    if (!mayMutate("views.remove") || !screen.detail) { setScreen("error", "unavailable"); return }
    setScreen("mutation", "review-remove")
  }
  const source = () => screen.detail
  const reviewKind = (): "save" | "remove" | null => {
    if (screen.mutation === "review-remove") return "remove"
    if (screen.mutation !== "idle") return null
    return activeDraft()?.phase === "reviewing" ? "save" : null
  }

  const submit = async (kind: "save" | "remove") => {
    const ready = current()
    const record = source()
    const state = activeDraft()
    const mutationName = kind === "save" ? "views.save" : "views.remove"
    if (!ready || !record || !operationReady(mutationName) || !state ||
        (screen.mutation !== "idle" && screen.mutation !== "review-remove")) return
    if (kind === "save" && (!state.value.title.trim() || state.value.title.length > 120 || state.conflict)) {
      setScreen("error", "invalid")
      return
    }
    // Fence repeated confirmations synchronously, before the async digest.
    setScreen({ mutation: "submitting", error: null })
    const request = new AbortController()
    mutationRequest = request
    const options: SfCallOptions = { signal: request.signal, idempotencyKey: crypto.randomUUID() }
    const generation = owner.generation()
    const revision = ready.context.stamp.accessRevision
    const operationRef = crypto.randomUUID() as SfOperationRef
    const payload = kind === "save"
      ? { surface: record.view.surface, action: "save" as const, input: { view: state.value, expectedVersion: record.version } }
      : { surface: record.view.surface, action: "remove" as const, input: { id: record.view.id, expectedVersion: record.version } }
    // Ephemeral UI fingerprint, not an authority or substitute for host CAS.
    const bytes = new TextEncoder().encode(JSON.stringify(payload))
    const hash = await crypto.subtle.digest("SHA-256", bytes)
    if (request.signal.aborted || generation !== owner.generation() || revision !== current()?.context.stamp.accessRevision) return
    const payloadDigest = [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
    editor?.setPending({ operationRef, idempotencyKey: options.idempotencyKey!, payloadDigest, expectedVersion: record.version })
    editor?.setPhase("submitting")
    setScreen({ mutation: "submitting", error: null })
    try {
      const client = createSfWorkClient(ready.transport)
      const result = kind === "save"
        ? await client["views.save"]({ surface: record.view.surface, action: "save", input: {
            view: state.value, expectedVersion: record.version,
          } }, options)
        : await client["views.remove"]({ surface: record.view.surface, action: "remove", input: {
            id: record.view.id, expectedVersion: record.version,
          } }, options)
      if (request.signal.aborted || generation !== owner.generation() || revision !== current()?.context.stamp.accessRevision) return
      if (result.kind !== "response") {
        if (result.reason !== "aborted") console.error("SF saved view mutation failed", result.reason)
        setScreen("mutation", result.reason === "contract-unavailable" || result.reason === "contract-mismatch" ? "failed" : "outcome-unknown")
        editor?.setPhase("outcome-unknown")
        return
      }
      if (result.body.status !== "ok") {
        setScreen({ mutation: result.body.status === "conflict" || result.body.status === "stale" ? "conflict" : "failed", error: translate(result.body.status) })
        return
      }
      if (kind === "remove") {
        setScreen({
          list: screen.list.filter((item) => !("view" in item && item.view.id === record.view.id)),
          listState: screen.list.filter((item) => !("view" in item && item.view.id === record.view.id)).length ? "ready" : "empty",
          detail: null, detailState: "empty", mutation: "idle", error: null,
        })
        editor = undefined
        return
      }
      if ("view" in result.body.value && "version" in result.body.value) {
        const saved = result.body.value as RecordView
        if (saved.view.id !== record.view.id) {
          setScreen({ mutation: "outcome-unknown", error: "stale" })
          editor?.setPhase("outcome-unknown")
          return
        }
        editor?.confirmSave({ kind: "projected", operationRef, baseVersion: saved.version, value: saved.view })
        setScreen({
          detail: saved, mutation: "idle", error: null,
          list: screen.list.map((item) => "view" in item && item.view.id === saved.view.id ? saved : item),
        })
      }
    } catch (error) {
      if (request.signal.aborted || generation !== owner.generation()) return
      console.error("SF saved view mutation failed", error instanceof Error ? error.name : "unknown")
      setScreen("mutation", "outcome-unknown")
      editor?.setPhase("outcome-unknown")
    }
  }
  const retryList = () => loadList()
  const reviewLabel = (kind: "save" | "remove") => kind === "remove" ? "sf.ui32.confirmRemove" : "sf.ui32.confirmSave"
  const reviewContext = () => {
    const kind = reviewKind()
    const record = source()
    const draft = activeDraft()
    return kind && record && draft ? { kind, record, draft } : undefined
  }
  const reviewState = () => screen.mutation === "outcome-unknown" ? "outcome-unknown" as const
    : screen.mutation === "conflict" ? "conflict" as const : "ready" as const
  const closeReview = () => {
    if (screen.mutation === "review-remove") setScreen("mutation", "idle")
    if (activeDraft()?.phase === "reviewing") editor?.setPhase("dirty")
  }

  return (
    <SfPageFrame
      titleKey={key("sf.ui32.title")}
      subtitleKey={key("sf.ui32.subtitle")}
      context={[]}
      tabs={[]}
      activeTab={null}
      secondaryActions={[]}
      density="comfortable"
      layout="work"
      onLayoutMode={() => undefined}
    >
      <div class="sf-saved-views" data-sf-surface="UI32" data-sf-polish="planner" data-sf-wave="four" data-sf-views-stage={reviewKind() ? "review" : screen.detail ? "editor" : "list"}>
      <section class="sf-saved-view-collection" aria-labelledby="sf-u43-legacy">
        <h2 id="sf-u43-legacy">{t(key("sf.ui32.legacy"))}</h2>
        <p>{t(key("sf.ui32.legacyDescription"))}</p>
        <Show when={props.route.kind === "list"}>
          <div hidden={!!screen.detail || screen.detailState === "loading"}>
          <SfStatePanel
            state={screen.listState}
            messageKey={key(screen.listState === "empty" ? "sf.common.empty" : screen.listState === "loading" ? "sf.common.loading" : screen.listState === "denied" ? "sf.common.noAccess" : "sf.common.unavailable")}
            onRetryRead={retryList}
          >
            <ul class="sf-saved-view-list">
              <For each={screen.list}>
                {(item) => (
                  <li>
                    <Show when={"view" in item} fallback={<span>{t(key("sf.ui32.inaccessible"))}</span>}>
                      <button class="mx-btn" type="button" disabled={!operationReady("views.open")} onClick={() => {
                        if ("view" in item) open(item.view.id, item.view.surface)
                      }}>
                        {"view" in item ? item.view.title : ""}
                      </button>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </SfStatePanel>
          </div>
        </Show>
        <Show when={props.route.kind === "entry" || screen.detailState === "ready" || screen.detailState === "loading"}>
          <SfStatePanel
            state={screen.detailState}
            messageKey={key(screen.detailState === "loading" ? "sf.common.loading" : screen.detailState === "denied" ? "sf.common.noAccess" : screen.detailState === "invalid" ? "sf.common.invalidLink" : "sf.common.unavailable")}
          >
            <Show when={screen.detail} keyed>
              {(record) => (
                <section aria-labelledby="sf-u43-editor" class="sf-saved-view-editor" hidden={!!reviewKind()}>
                  <div class="sf-saved-view-heading">
                    <h3 id="sf-u43-editor">{t(key("sf.ui32.legacyEditor"))}</h3>
                    <Show when={props.route.kind === "list"}>
                      <button type="button" class="mx-btn" disabled={screen.mutation !== "idle" || !!activeDraft()?.pendingOperation}
                        onClick={() => setScreen({ detail: null, detailState: "empty" })}>{t(key("sf.common.returnToList"))}</button>
                    </Show>
                  </div>
                  <p>{t(key("sf.ui32.sourcePage"))}: <bdi>{record.view.page}</bdi></p>
                  <p>{t(key("sf.ui32.version"), { version: record.version })}</p>
                  <Show when={restoreHref(record.view)}>
                    {(href) => <A class="mx-btn" href={href()}>{t(key("sf.ui32.openSource"))}</A>}
                  </Show>
                  <Show when={activeDraft()}>
                    {(state) => (
                      <div class="sf-saved-view-fields">
                        <label class="block">
                          <span class="block">{t(key("sf.ui32.name"))}</span>
                          <input
                            type="text"
                            class="mx-input w-full"
                            maxLength={120}
                            value={state().value.title}
                            disabled={!mayMutate("views.save") || !!state().pendingOperation}
                            onInput={(event) => {
                              const active = activeDraft()
                              if (!active) return
                              editor?.edit({ ...active.value, title: event.currentTarget.value } as PersonalView)
                            }}
                          />
                        </label>
                        <label>
                          <span class="block">{t(key("sf.ui32.density"))}</span>
                          <select
                            class="mx-input"
                            aria-label={t(key("sf.ui32.density"))}
                            value={state().value.density ?? "comfortable"}
                            disabled={!mayMutate("views.save") || !!state().pendingOperation}
                            onChange={(event) => {
                              const active = activeDraft()
                              const density = event.currentTarget.value
                              if (active && (density === "compact" || density === "comfortable"))
                                editor?.edit({ ...active.value, density } as PersonalView)
                            }}
                          >
                            <option value="comfortable">{t(key("sf.ui32.density.comfortable"))}</option>
                            <option value="compact">{t(key("sf.ui32.density.compact"))}</option>
                          </select>
                        </label>
                        <Show when={state().value.filters}>
                          <p>{t(key("sf.ui32.filtersPreserved"))}</p>
                        </Show>
                        <div class="sf-saved-view-actions">
                          <button type="button" class="mx-btn primary" disabled={!mayMutate("views.save") || !state().dirty || !!state().pendingOperation} onClick={reviewSave}>
                            {t(key("sf.ui32.reviewSave"))}
                          </button>
                          <button type="button" class="mx-btn" disabled={screen.mutation !== "idle" || !state().dirty || !!state().pendingOperation} onClick={() => editor?.discard()}>
                            {t(key("sf.common.discard"))}
                          </button>
                          <button type="button" class="mx-btn" disabled={!mayMutate("views.remove") || !!state().pendingOperation} onClick={reviewRemove}>
                            {t(key("sf.ui32.remove"))}
                          </button>
                        </div>
                      </div>
                    )}
                  </Show>
                </section>
              )}
            </Show>
          </SfStatePanel>
        </Show>
        <Show when={screen.error}>
          {(error) => (
            <SfStatePanel state={error()} messageKey={key(error() === "conflict" ? "sf.common.conflict" : error() === "invalid" ? "sf.ui32.nameInvalid" : "sf.common.unavailable")} />
          )}
        </Show>
        <Show when={screen.mutation === "outcome-unknown"}>
          <SfStatePanel state="outcome-unknown" messageKey={key("sf.common.operationUnknown")} />
        </Show>
        <Show when={screen.mutation === "submitting"}>
          <SfStatePanel state="loading" messageKey={key("sf.common.pending")} />
        </Show>
        <Show when={reviewContext()} keyed>
          {(context) => (
          <SfChangeReview
            operation={{
              ref: `ui32:${context.record.view.id}` as SfOperationRef,
              label: message(reviewLabel(context.kind)),
              scope: { kind: "data", text: context.record.view.page },
            }}
            base={snapshot(context.record, context.record.view)}
            current={snapshot(context.record, context.record.view)}
            proposed={snapshot(context.record, context.draft.value)}
            effects={[]}
            coverage={{ state: "complete", summary: message("sf.ui32.legacyReviewScope"), reasons: [], knownCount: null, expectedCount: null }}
            blockingReasons={[]}
            confirmation={{
              kind: "admitted",
              purpose: context.kind === "remove" ? "delete" : "save",
              labelKey: key(reviewLabel(context.kind)),
              binding: {
                kind: "catalog-command",
                operationId: context.kind === "remove" ? "views.remove" : "views.save",
                version: { kind: "record", expectedVersion: context.record.version },
                confirmation: "presentation-only",
              },
            }}
            state={reviewState()}
            onConfirm={() => { void submit(context.kind) }}
            onRevise={closeReview}
            onCancel={closeReview}
          />
          )}
        </Show>
      </section>
      <section class="sf-saved-view-availability" aria-labelledby="sf-u43-native">
        <h2 id="sf-u43-native">{t(key("sf.ui32.native"))}</h2>
        <SfStatePanel state="unavailable" messageKey={key("sf.ui32.nativeUnavailable")} />
        <details><summary>{t(key("sf.ui32.sourcePage"))}</summary><p>{t(key("sf.ui32.noPseudoView"))}</p>
        <p>{t(key("sf.ui32.entryUnavailable"))}</p></details>
      </section>
      </div>
    </SfPageFrame>
  )
}
