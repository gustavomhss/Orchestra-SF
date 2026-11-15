import { createEffect, createMemo, onCleanup, Show, For, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import type { SfEditScopeKey, SfOperationRef } from "@orchestra/schema/sucafina/context"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfPageFrame, sfCommonKey, useSfPresentation } from "../../shared/frame"
import type { SfCopyKey, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { SfChangeReview } from "../../shared/change-review"
import type { SfReviewConfirmation } from "../../shared/change-review"
import { SfProcurementSettingsFields } from "./fields"
import { SETTINGS_REF, SETTINGS_INTENT, changedSettings, settingsReview } from "./model"
import type { Settings, SettingsProjection } from "./model"
import "./settings.css"

type ReviewMode = "save" | "reset" | null
const key = (value: string) => value as SfCopyKey
const stateMessage = (state: SfUiState): SfCopyKey => sfCommonKey(
  state === "ready" ? "sf.common.currentSource" :
  state === "empty" ? "sf.common.empty" :
  state === "partial" ? "sf.common.partial" :
  state === "denied" ? "sf.common.noAccess" :
  state === "session-expired" ? "sf.common.loginAgain" :
  state === "stale" ? "sf.common.stale" :
  state === "conflict" ? "sf.common.conflict" :
  state === "invalid" ? "sf.common.fieldErrorSummary" :
  state === "loading" ? "sf.common.loading" :
  state === "outcome-unknown" ? "sf.common.operationUnknown" :
  "sf.common.unavailable",
)

/** CAP28 is fenced to the real A03 projection and F01 owner. No cloned store,
 * untyped dispatch, reset defaults, or private page snapshot in browser storage. */
export function SfProcurementSettingsView(props: SfSurfaceProps<"CAP28">): JSX.Element {
  const owner = useSfContext()
  const { t } = useSfPresentation()
  const [view, setView] = createStore<{
    state: SfUiState
    projection?: SettingsProjection
    refresh: number
    busy: boolean
    review: ReviewMode
    reviewRef?: SfOperationRef
    errorLines: readonly string[]
    confirmed: boolean
  }>({
    state: "loading", refresh: 0, busy: false, review: null,
    errorLines: [], confirmed: false,
  })
  const selection = () => ({
    ...(props.route.query.year !== undefined ? { year: props.route.query.year } : {}),
    ...(props.route.query.month !== undefined ? { month: props.route.query.month } : {}),
  })
  const destination = () => owner.ready()?.context.destinations.find((item) =>
    item.capabilityId === "CAP28" && item.surface === "procurement" && item.page === "Settings")
  const pageAllowed = () => destination()?.canRead === true
  const actionAllowed = (action: "save" | "reset") =>
    pageAllowed() && destination()?.allowedActionIds.includes(action) === true &&
    view.projection?.value.allowedActionIds.includes(action) === true

  createEffect(() => {
    const current = owner.state()
    const ready = owner.ready()
    const generation = owner.generation()
    const _refresh = view.refresh
    if (current.status !== "ready" || !ready) {
      setView({
        projection: undefined, review: null, reviewRef: undefined, errorLines: [],
        busy: false,
        state: current.status === "resolving" ? "loading"
          : current.status === "unauthenticated" ? "session-expired"
          : current.status === "denied" ? "denied"
          : current.status === "context-mismatch" ? "invalid" : "unavailable",
      })
      return
    }
    const allowed = ready.context.destinations.find((item) =>
      item.capabilityId === "CAP28" && item.page === "Settings" &&
      item.surface === "procurement" && item.canRead)
    if (!allowed) {
      setView({ projection: undefined, review: null, state: "denied" })
      return
    }
    const abort = new AbortController()
    setView({ projection: undefined, state: "loading", review: null, errorLines: [] })
    void createSfProcurementClient(ready.transport)["domain.page.CAP28"](selection(), {
      signal: abort.signal,
    }).then((response) => {
      if (abort.signal.aborted || owner.generation() !== generation ||
          owner.state().status !== "ready") return
      if (response.kind !== "response") {
        setView({ projection: undefined, state: "unavailable" })
        return
      }
      const body = response.body
      if (body.status !== "ok") {
        if (body.status === "denied") owner.invalidate("revoked")
        setView({
          projection: undefined,
          state: body.status === "unauthenticated" ? "session-expired"
            : body.status === "denied" ? "denied"
            : body.status === "needs-input" ? "invalid"
            : body.status === "stale" ? "stale" : "unavailable",
        })
        return
      }
      const stamp = ready.context.stamp
      if (body.value.capabilityId !== "CAP28" ||
          body.context.installationId !== stamp.installationId ||
          body.context.projectId !== stamp.projectId ||
          body.context.hostId !== stamp.hostId ||
          body.context.principalRef !== stamp.principalRef ||
          body.context.accessRevision !== stamp.accessRevision) {
        setView({ projection: undefined, state: "denied" })
        return
      }
      setView({ projection: body, state: "ready" })
    }).catch((error: unknown) => {
      if (abort.signal.aborted || owner.generation() !== generation) return
      console.error("Procurement settings read failed", error instanceof Error ? error.name : "unknown")
      setView({ projection: undefined, state: "unavailable" })
    })
    onCleanup(() => abort.abort())
  })

  const draft = createMemo(() => {
    const ready = owner.ready()
    const projection = view.projection
    if (!ready || owner.state().status !== "ready" || !projection) return undefined
    const version = projection.value.versions.settings?.version
    if (version === undefined || !Number.isSafeInteger(version)) return undefined
    const editScopeKey = JSON.stringify([
      "CAP28", props.route.query.year ?? null, props.route.query.month ?? null,
    ]) as SfEditScopeKey
    const actions = (["save", "reset"] as const).filter((action) =>
      ready.context.destinations.some((entry) =>
        entry.capabilityId === "CAP28" && entry.canRead && entry.allowedActionIds.includes(action)) &&
      projection.value.allowedActionIds.includes(action))
    return ready.drafts.acquire<Settings>({
      surfaceId: "CAP28",
      identity: { kind: "record", recordRef: SETTINGS_REF },
      editScopeKey,
      baseVersion: version,
      base: projection.value.data.settings,
      value: projection.value.data.settings,
      revalidation: {
        operationId: "domain.page.CAP28",
        input: selection(),
        fieldPaths: Object.keys(projection.value.data.settings),
        actionIds: actions,
      },
    })
  })
  const snapshot = () => draft()?.snapshot()
  const active = () => {
    const state = snapshot()
    return state?.availability === "active" ? state : undefined
  }
  const readOnly = () => !actionAllowed("save") || !active() ||
    view.busy || active()?.pendingOperation !== null ||
    active()?.phase === "conflict" || active()?.phase === "outcome-unknown"
  const canReview = () => actionAllowed("save") && active()?.dirty === true &&
    active()?.conflict === null && active()?.pendingOperation === null &&
    changedSettings(view.projection!.value.data.settings, active()!.value).length > 0 &&
    !view.busy && view.state === "ready"
  const review = createMemo(() => {
    const projection = view.projection
    const state = active()
    if (!projection || !state || !view.review || !view.reviewRef) return undefined
    return settingsReview(projection, state.value, view.reviewRef, view.review)
  })
  const openReview = (kind: Exclude<ReviewMode, null>) => {
    if (kind === "save" && !canReview()) return
    if (kind === "reset" && (!actionAllowed("reset") || view.busy)) return
    const draftState = active()
    if (!draftState || draftState.pendingOperation !== null || draftState.conflict) return
    setView({ review: kind, reviewRef: crypto.randomUUID() as SfOperationRef, errorLines: [] })
    draft()?.setPhase("reviewing")
  }
  const closeReview = () => {
    setView({ review: null, reviewRef: undefined })
    if (active()?.dirty) draft()?.setPhase("dirty")
    else draft()?.setPhase("clean")
  }
  const discard = () => {
    if (!active() || active()?.pendingOperation !== null || view.busy) return
    // The discard is a local draft-only operation. It NEVER calls reset/delete.
    if (active()?.dirty && !window.confirm(t(sfCommonKey("sf.common.navigationDiscard")))) return
    draft()?.discard()
    setView({ review: null, errorLines: [] })
  }
  const save = async (confirmation: Extract<SfReviewConfirmation, { kind: "admitted" }>) => {
    const current = owner.state()
    const ready = owner.ready()
    const page = view.projection
    const state = active()
    if (!ready || current.status !== "ready" || !page || !state || !view.reviewRef ||
        view.busy || !actionAllowed("save") || !canReview() ||
        state.baseVersion !== page.value.versions.settings?.version ||
        confirmation.purpose !== "save" ||
        confirmation.binding.kind !== "catalog-command" ||
        confirmation.binding.operationId !== "domain.command.CAP28.save" ||
        confirmation.binding.version.kind !== "record" ||
        confirmation.binding.version.expectedVersion !== state.baseVersion) return
    const opRef = view.reviewRef
    const command = {
      page: "Settings" as const, action: "save" as const,
      version: page.value.versions.settings!.version, values: { settings: structuredClone(state.value) },
    }
    const idempotencyKey = crypto.randomUUID()
    // F01/S03 binds the exact reviewed CAS, digest and idempotency key. Never
    // dispatch a second POST for a response lost after network send.
    const bytes = new TextEncoder().encode(JSON.stringify(command))
    const hash = await crypto.subtle.digest("SHA-256", bytes)
    const digest = Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
    if (view.busy || owner.ready() !== ready || owner.state().status !== "ready" ||
        active()?.baseVersion !== command.version) return
    draft()?.setPending({
      operationRef: opRef, idempotencyKey, payloadDigest: digest, expectedVersion: command.version,
    })
    draft()?.setPhase("submitting")
    setView({ busy: true, errorLines: [], review: null })
    const abort = new AbortController()
    const generation = owner.generation()
    try {
      const reply = await createSfProcurementClient(ready.transport)["domain.command.CAP28.save"](
        command, { signal: abort.signal, idempotencyKey },
      )
      if (owner.generation() !== generation || owner.state().status !== "ready") return
      if (reply.kind !== "response") {
        draft()?.setPhase("outcome-unknown")
        setView({ busy: false, state: "outcome-unknown" })
        return
      }
      if (!reply.body.ok) {
        // Known producer denial/conflict/validation is not evidence of success.
        // The owner retains the exact pending operation until reconciliation.
        setView({
          busy: false,
          state: reply.body.status === 409 ? "conflict"
            : reply.body.status === 403 ? "denied"
            : reply.body.status === 422 || reply.body.status === 400 ? "invalid"
            : "unavailable",
          errorLines: reply.body.errors ?? [],
        })
        return
      }
      // POST confirms success but does not return the new authoritative settings.
      // Refetch the SAME owner and exact resource before marking the draft clean.
      const refreshed = await createSfProcurementClient(ready.transport)["domain.page.CAP28"](
        selection(), { signal: abort.signal },
      )
      if (owner.generation() !== generation || owner.state().status !== "ready") return
      if (refreshed.kind === "response" && refreshed.body.status === "ok" &&
          refreshed.body.value.capabilityId === "CAP28" &&
          refreshed.body.context.installationId === ready.context.stamp.installationId &&
          refreshed.body.context.projectId === ready.context.stamp.projectId &&
          refreshed.body.context.hostId === ready.context.stamp.hostId &&
          refreshed.body.context.principalRef === ready.context.stamp.principalRef &&
          refreshed.body.context.accessRevision === ready.context.stamp.accessRevision &&
          refreshed.body.value.versions.settings?.version !== undefined) {
        draft()?.confirmSave({
          kind: "projected", operationRef: opRef,
          baseVersion: refreshed.body.value.versions.settings.version,
          value: refreshed.body.value.data.settings,
        })
        setView({ projection: refreshed.body, state: "ready", busy: false, confirmed: true })
      } else {
        draft()?.confirmSave({
          kind: "confirmed-without-projection", operationRef: opRef, resultVersion: null,
        })
        setView({ projection: undefined, state: "unavailable", busy: false, confirmed: true })
      }
    } catch (error) {
      if (owner.generation() !== generation || owner.state().status !== "ready") return
      console.error("Procurement settings command outcome uncertain", error instanceof Error ? error.name : "unknown")
      draft()?.setPhase("outcome-unknown")
      setView({ busy: false, state: "outcome-unknown" })
    }
  }
  const reviewProps = () => review()
  const primary = () => ({
    id: "review-settings", labelKey: key("sf.cap28.primary"), tone: "primary" as const,
    disabled: !canReview(), busy: view.busy,
    reasonKey: !actionAllowed("save") ? sfCommonKey("sf.common.readOnly") : undefined,
    onInvoke: () => openReview("save"),
  })

  return (
    <SfPageFrame
      titleKey={key("sf.cap28.title")}
      context={[]}
      tabs={[]}
      activeTab={null}
      primaryAction={primary()}
      secondaryActions={[{
        id: "reset-settings", labelKey: key("sf.u36.reset"), tone: "danger",
        disabled: !actionAllowed("reset") || view.busy || !active(),
        busy: view.busy, onInvoke: () => openReview("reset"),
      }]}
      density="comfortable"
      layout="work"
      onLayoutMode={() => undefined}
    >
      <div class="sf-n21-settings" data-sf-surface="CAP28">
        <Show when={view.confirmed && view.state === "ready"}>
          <p class="sf-n21-settings-notice" role="status">{t(sfCommonKey("sf.common.saved"))}</p>
        </Show>
        <Show when={view.state === "outcome-unknown"}>
          <div role="status" class="mx-card sf-n21-settings-notice">
            <p>{t(sfCommonKey("sf.common.operationUnknown"))}</p>
            <button class="mx-btn" type="button"
              onClick={() => setView("refresh", (value) => value + 1)}>
              {t(sfCommonKey("sf.common.retry"))}
            </button>
          </div>
        </Show>
        <Show when={view.errorLines.length > 0 && view.state !== "denied"}>
          <div role="alert" class="sf-n21-settings-error">
            <ul><For each={view.errorLines}>{(line) => <li>{line}</li>}</For></ul>
          </div>
        </Show>
        <SfStatePanel
          state={view.state}
          messageKey={stateMessage(view.state)}
          onRetryRead={() => setView("refresh", (value) => value + 1)}
          onLogin={() => { void owner.reload() }}
        >
          <Show when={view.projection && active()}>
            {(current) => (
              <>
                <Show when={!pageAllowed() || !actionAllowed("save")}>
                  <p role="status">{t(sfCommonKey("sf.common.readOnly"))}</p>
                </Show>
                <Show when={active()?.conflict}>
                  <p role="alert">{t(sfCommonKey("sf.common.conflict"))}</p>
                </Show>
                <Show when={view.review && reviewProps()} fallback={
                  <form class="sf-n21-settings-form" onSubmit={(event) => {
                    event.preventDefault()
                    openReview("save")
                  }}>
                    <SfProcurementSettingsFields
                      settings={active()!.value}
                      directory={current().value.data.directory}
                      disabled={readOnly()}
                      onEdit={(next) => { if (!readOnly()) draft()?.edit(next) }}
                    />
                    <div class="sf-n21-settings-footer">
                      <p role="status">{active()?.dirty
                        ? t(sfCommonKey("sf.common.changesPending"))
                        : t(sfCommonKey("sf.common.currentSource"))}</p>
                      <button class="mx-btn" type="button" disabled={!active()?.dirty || view.busy}
                        onClick={discard}>{t(sfCommonKey("sf.common.discard"))}</button>
                      <button class="mx-btn primary" type="submit" disabled={!canReview()}>
                        {t(sfCommonKey("sf.common.review"))}</button>
                    </div>
                  </form>
                }>
                  <SfChangeReview
                    {...reviewProps()!}
                    onConfirm={(admitted) => { void save(admitted) }}
                    onRevise={closeReview}
                    onCancel={closeReview}
                  />
                </Show>
                <details class="mx-card sf-n21-reset-help">
                  <summary>{t(key("sf.u36.reset"))}</summary>
                  <p>{t(key("sf.u36.resetHelp"))}</p>
                  <p role="status">{t(sfCommonKey("sf.common.previousValuesUnavailable"))}</p>
                </details>
              </>
            )}
          </Show>
        </SfStatePanel>
      </div>
    </SfPageFrame>
  )
}
