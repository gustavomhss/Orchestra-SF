import { createEffect, createSignal, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { createSfWorkClient } from "@orchestra/client/sucafina/work"
import { SfProjectionHome } from "@orchestra/schema/sucafina/work"
import type { Schema } from "effect"
import type { SfContextHandle, SfSurfaceProps } from "../context/contracts"
import type { SfContextStamp, SfOwnerKey, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import { useSfContext } from "../context"
import { SfPageFrame, type SfCopyKey, type SfUiState } from "../shared/frame"
import { SfStatePanel } from "../shared/states"
import { useSfPresentation } from "../shared/frame/presentation"

type Home = Extract<Schema.Schema.Type<typeof SfProjectionHome.Output>, { status: "ok" }>["value"]
type HomeCase = Extract<Home["cases"], { status: "ok" }>["items"][number]
// Solid store state: no Readonly<> wrapper, see security/index.tsx.
type State = { status: SfUiState; data: Home | null }
type ResumeRequest = Readonly<{
  caseRef: HomeCase["caseRef"]
  sourceVersion: HomeCase["version"]
  ownerKey: SfOwnerKey
  sourceStamp: SfContextStamp
  returnRoute: SfResolvedRoute<"UI29">
  focusCaseRef: HomeCase["caseRef"]
}>
type ResumeResult = Readonly<{
  status: "committed" | "aborted" | "kept-editing" | "denied" | "not-found" | "invalid-link" | "unavailable" | "stale"
}>
/**
 * Pending I00/F01 public navigation seam, NOT an existing provider guarantee.
 * The callback must build/reauthorize UI34, mint an owner-bound returnRef and
 * restore focus from focusCaseRef. Never accept a client-constructed href.
 * Installed by F01's provider only when I00 supplies true owner navigation.
 */
export type SfTodayResumePort = Readonly<{
  resumeCase(request: ResumeRequest, signal: AbortSignal): Promise<ResumeResult>
}>
function hasResumePort(handle: SfContextHandle): handle is SfContextHandle & SfTodayResumePort {
  return "resumeCase" in handle && typeof handle.resumeCase === "function"
}
const key = (value: string) => value as SfCopyKey

/**
 * UI29 reads the installed home projection. Its availability flags are NOT
 * actual work items, meeting records, or material-change events. Never turn
 * them into successful work, completed routines, or synthetic meetings.
 */
export function SfTodayView(props: SfSurfaceProps<"UI29">): JSX.Element {
  const owner = useSfContext()
  const { t } = useSfPresentation()
  const [screen, setScreen] = createStore<State>({ status: "loading", data: null })
  const [adminHref, setAdminHref] = createSignal<string | null>(null)
  // This is a *discovery* hint only: HEAD verifies the live group membership
  // on the installed server. All GET/POST checks still happen server-side.
  createEffect(() => {
    const state = owner.state()
    const ready = owner.ready()
    const generation = owner.generation()
    setAdminHref(null)
    if (!ready || state.status !== "ready" || state.binding.authMode !== "microsoft" ||
      state.context.authMode !== "microsoft" || typeof window === "undefined") return
    const { publicOrigin, mount } = state.binding
    if (!URL.canParse(publicOrigin) || new URL(publicOrigin).origin !== publicOrigin ||
      publicOrigin !== window.location.origin ||
      !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(mount)) return
    const href = publicOrigin + mount + "/admin/access"
    const ownerKey = state.ownerKey
    const abort = new AbortController()
    void fetch(href, {
      method: "HEAD", credentials: "include", cache: "no-store", redirect: "error",
      signal: abort.signal,
    }).then((response) => {
      const latest = owner.state()
      if (!abort.signal.aborted && generation === owner.generation() &&
        latest.status === "ready" && latest.ownerKey === ownerKey &&
        latest.binding.publicOrigin === publicOrigin && latest.binding.mount === mount &&
        response.status === 204) setAdminHref(href)
    }).catch(() => undefined)
    onCleanup(() => { abort.abort(); setAdminHref(null) })
  })

  const [resume, setResume] = createStore<{ caseRef: string | null; status: SfUiState | "idle" }>({
    caseRef: null, status: "idle",
  })
  let resumeInFlight: AbortController | undefined
  createEffect(() => {
    owner.generation()
    owner.state().status
    resumeInFlight?.abort()
    setResume({ caseRef: null, status: "idle" })
    onCleanup(() => resumeInFlight?.abort())
  })
  const statusFromContext = (): SfUiState => {
    const status = owner.state().status
    if (status === "resolving") return "loading"
    if (status === "unauthenticated") return "session-expired"
    if (status === "denied") return "denied"
    if (status === "context-mismatch") return "invalid"
    return "unavailable"
  }
  const load = (signal: AbortSignal, generation: number): void => {
    const ready = owner.ready()
    if (!ready) return
    const operation = ready.context.availability
      .find((entry) => entry.family === "domain-read" && entry.resource === "home")
      ?.operations.find((entry) => entry.operationId === "projection.home")
    if (!operation || operation.state !== "ready" || !operation.operational) {
      setScreen({ status: operation?.state === "denied" ? "denied" : "unavailable", data: null })
      return
    }
    setScreen({ status: "loading", data: null })
    void createSfWorkClient(ready.transport)["projection.home"]({}, { signal }).then((result) => {
      if (signal.aborted || generation !== owner.generation()) return
      if (result.kind !== "response") {
        if (result.reason !== "aborted") console.error("SF Today projection read failed", result.reason)
        setScreen({ status: "unavailable", data: null })
        return
      }
      if (result.body.status === "ok") {
        setScreen({ status: "ready", data: result.body.value })
        return
      }
      const status: SfUiState =
        result.body.status === "denied" ? "denied"
        : result.body.status === "stale" ? "stale"
        : result.body.status === "conflict" ? "conflict"
        : result.body.status === "invalid" || result.body.status === "needs-input" ? "invalid"
        : "unavailable"
      if (status === "unavailable") console.error("SF Today source unavailable")
      setScreen({ status, data: null })
    }).catch((error: unknown) => {
      if (signal.aborted || generation !== owner.generation()) return
      console.error("SF Today projection read failed", error instanceof Error ? error.name : "unknown")
      setScreen({ status: "unavailable", data: null })
    })
  }
  createEffect(() => {
    const state = owner.state()
    const generation = owner.generation()
    if (state.status !== "ready" || !owner.ready()) {
      setScreen({ status: statusFromContext(), data: null })
      return
    }
    const request = new AbortController()
    load(request.signal, generation)
    onCleanup(() => request.abort())
  })
  const refresh = () => { void owner.reload() }
  const data = () => screen.status === "ready" ? screen.data : null
  const caseItems = () => {
    const cases = data()?.cases
    return cases?.status === "ok" ? cases.items : []
  }
  const routineItems = () => {
    const routines = data()?.routines
    return routines?.status === "ok" ? routines.items : []
  }
  const caseState = (): SfUiState => {
    if (resume.status === "denied" || resume.status === "not-found" ||
        resume.status === "invalid" || resume.status === "stale") return resume.status
    const cases = data()?.cases
    return cases?.status !== "ok" ? "unavailable" : cases.items.length ? "ready" : "empty"
  }
  const canResume = () => owner.state().status === "ready" && hasResumePort(owner)
  const beginResume = (item: HomeCase) => {
    const state = owner.state()
    const ready = owner.ready()
    if (state.status !== "ready" || !ready || !hasResumePort(owner)) return
    if (props.route.ownerSelection.serverKey !== state.selection.serverKey ||
        props.route.ownerSelection.projectId !== state.selection.projectId ||
        props.route.ownerSelection.installationId !== state.selection.installationId) {
      setResume({ caseRef: item.caseRef, status: "invalid" })
      return
    }
    const source = caseItems().find((candidate) => candidate.caseRef === item.caseRef)
    if (!source || source.version !== item.version) {
      setResume({ caseRef: item.caseRef, status: "stale" })
      return
    }
    resumeInFlight?.abort()
    const request = new AbortController()
    resumeInFlight = request
    const generation = owner.generation()
    setResume({ caseRef: item.caseRef, status: "loading" })
    void owner.resumeCase({
      caseRef: source.caseRef,
      sourceVersion: source.version,
      ownerKey: state.ownerKey,
      sourceStamp: ready.context.stamp,
      returnRoute: props.route,
      focusCaseRef: source.caseRef,
    }, request.signal).then((result) => {
      if (request.signal.aborted || generation !== owner.generation() || owner.state().status !== "ready") return
      if (result.status === "committed" || result.status === "aborted" || result.status === "kept-editing") {
        setResume({ caseRef: null, status: "idle" })
        return
      }
      if (result.status === "denied" || result.status === "not-found" ||
          result.status === "invalid-link" || result.status === "stale") {
        // Revoked, removed, malformed or version-changed cases must not leave their
        // previously authorized title/version in the in-memory home list.
        const current = screen.data
        if (current?.cases.status === "ok") {
          setScreen("data", {
            ...current,
            cases: { status: "ok", items: current.cases.items.filter((entry) => entry.caseRef !== source.caseRef) },
          })
        }
      }
      setResume({
        caseRef: source.caseRef,
        status: result.status === "invalid-link" ? "invalid" : result.status,
      })
    }).catch((error: unknown) => {
      if (request.signal.aborted || generation !== owner.generation()) return
      console.error("SF case navigation failed", error instanceof Error ? error.name : "unknown")
      setResume({ caseRef: source.caseRef, status: "unavailable" })
    })
  }
  const routineState = (): SfUiState => {
    const routines = data()?.routines
    return routines?.status !== "ok" ? "unavailable" : routines.items.length ? "ready" : "empty"
  }

  return (
    <SfPageFrame
      titleKey={key("sf.ui29.title")}
      subtitleKey={key("sf.ui29.subtitle")}
      context={[]}
      tabs={[]}
      activeTab={null}
      secondaryActions={[]}
      density="comfortable"
      layout="reading"
      onLayoutMode={() => undefined}
    >
      <Show when={adminHref()}>
        {(href) => (
          <section class="mx-card mb-4 flex min-w-0 flex-wrap items-center justify-between gap-4"
            data-sf-native-admin-entry="supreme" aria-label="Governança de acessos">
            <div class="min-w-0">
              <h2 class="m-0">Governança de acessos · Sucafina</h2>
              <p class="mt-1 text-sm">Estrutura real do Teams, papéis por tela e grants por perfil Entra.</p>
            </div>
            <a class="mx-btn" href={href()} rel="noreferrer">Administração de acessos</a>
          </section>
        )}
      </Show>
      <SfStatePanel
        state={screen.status}
        messageKey={key(screen.status === "ready" ? "sf.ui29.title" : screen.status === "denied" ? "sf.common.noAccess" : screen.status === "session-expired" ? "sf.common.loginAgain" : screen.status === "loading" ? "sf.common.loading" : "sf.common.unavailable")}
        onRetryRead={refresh}
      >
        <div class="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2" data-sf-home="authorized">
          <section class="mx-card min-w-0" aria-labelledby="sf-u01-attention">
            <h2 id="sf-u01-attention">{t(key("sf.ui29.attention"))}</h2>
            <SfStatePanel
              state={data()?.workProducer === "available" ? "partial" : "unavailable"}
              messageKey={key(data()?.workProducer === "available" ? "sf.ui29.workSourceReady" : "sf.ui29.workUnavailable")}
            >
              <p>{t(key("sf.ui29.workRequiresSelection"))}</p>
            </SfStatePanel>
          </section>
          <section class="mx-card min-w-0" aria-labelledby="sf-u01-resume">
            <h2 id="sf-u01-resume">{t(key("sf.ui29.resume"))}</h2>
            <h3>{t(key("sf.ui29.cases"))}</h3>
            <SfStatePanel
              state={caseState()}
              messageKey={key(
                caseState() === "denied" ? "sf.common.noAccess"
                : caseState() === "not-found" ? "sf.common.removed"
                : caseState() === "invalid" ? "sf.common.invalidLink"
                : caseState() === "stale" ? "sf.common.stale"
                : data()?.cases.status === "ok" && !caseItems().length ? "sf.common.empty"
                : "sf.ui29.casesUnavailable"
              )}
              onRetryRead={refresh}
              onBack={() => { setResume({ caseRef: null, status: "idle" }); void owner.reload() }}
            >
              <Show when={caseItems().length > 0}>
                <Show when={!canResume()}>
                  <p role="status" data-sf-case-resume="blocked">{t(key("sf.ui29.resumeUnavailable"))}</p>
                </Show>
                <ul class="list-disc ps-5">
                  <For each={caseItems()}>
                    {(item) => (
                      <li class="min-w-0 py-2" data-sf-case-row="authorized">
                        <strong><bdi>{item.title}</bdi></strong>
                        <span class="block text-sm">{t(key("sf.ui29.caseVersion"), { version: item.version })}</span>
                        <Show when={canResume()}>
                          <button
                            type="button"
                            class="mx-btn mt-2"
                            data-sf-resume-case="authorized"
                            aria-label={t(key("sf.ui29.resumeCaseLabel"), { title: item.title })}
                            ref={(button) => {
                              const state = owner.state()
                              const ready = owner.ready()
                              const generation = owner.generation()
                              if (state.status !== "ready" || !ready ||
                                  !owner.claimResumeFocus?.({
                                    caseRef: item.caseRef,
                                    sourceVersion: item.version,
                                    ownerKey: state.ownerKey,
                                    accessRevision: ready.context.stamp.accessRevision,
                                    returnRoute: props.route,
                                  })) return
                              queueMicrotask(() => {
                                const latest = owner.state()
                                if (button.isConnected && owner.generation() === generation &&
                                    latest.status === "ready" && latest.ownerKey === state.ownerKey)
                                  button.focus()
                              })
                            }}
                            disabled={resume.status === "loading"}
                            onClick={() => beginResume(item)}
                          >
                            {t(key("sf.ui29.resumeCase"))}
                          </button>
                        </Show>
                        <Show when={resume.caseRef === item.caseRef && (
                          resume.status === "loading" || resume.status === "stale" ||
                          resume.status === "unavailable"
                        )}>
                          <SfStatePanel
                            state={resume.status === "idle" ? "unavailable" : resume.status}
                            messageKey={key(
                              resume.status === "loading" ? "sf.common.loading"
                              : resume.status === "stale" ? "sf.common.stale"
                              : "sf.common.unavailable"
                            )}
                            onRetryRead={() => { setResume({ caseRef: null, status: "idle" }); void owner.reload() }}
                          />
                        </Show>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </SfStatePanel>
            <h3>{t(key("sf.ui29.routines"))}</h3>
            <SfStatePanel
              state={routineState()}
              messageKey={key(data()?.routines.status === "ok" && !routineItems().length ? "sf.common.empty" : "sf.ui29.routinesUnavailable")}
              onRetryRead={refresh}
            >
              <Show when={routineItems().length > 0}>
                <ul class="list-disc ps-5">
                  <For each={routineItems()}>
                    {(item) => (
                      <li>
                        <span>{t(key("sf.ui29.admission"))}: </span>
                        <bdi>{item.admission}</bdi>
                        <Show when={item.runRef}><span class="block"><bdi>{item.runRef}</bdi></span></Show>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </SfStatePanel>
          </section>
          <section class="mx-card min-w-0" aria-labelledby="sf-u01-meetings">
            <h2 id="sf-u01-meetings">{t(key("sf.ui29.meetings"))}</h2>
            <SfStatePanel state="unavailable" messageKey={key("sf.ui29.meetingsNotProjected")} />
          </section>
          <section class="mx-card min-w-0" aria-labelledby="sf-u01-changes">
            <h2 id="sf-u01-changes">{t(key("sf.ui29.materialChanges"))}</h2>
            <SfStatePanel state="unavailable" messageKey={key("sf.ui29.changesNotProjected")} />
          </section>
        </div>
      </SfStatePanel>
    </SfPageFrame>
  )
}
