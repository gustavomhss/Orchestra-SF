import { createEffect, For, onCleanup, Show, type JSX } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { createSfPeopleClient } from "@orchestra/client/sucafina/people"
import type { SfPeopleTopic } from "@orchestra/schema/sucafina/people"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import { SfDomainPageData, SfDomainRisk } from "@orchestra/schema/sucafina/domain"
import { encodeSfRouteRef } from "../navigation-state"
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
type Risk = typeof SfDomainRisk.Type
type Executive = typeof SfDomainPageData.CAP01.Type
type Attention = {
  topicState: SfUiState; topics: readonly SfPeopleTopic[]
  riskState: SfUiState; risks: readonly Risk[]
  forecastState: SfUiState; totals: Executive["totals"] | undefined
}
/** Only real CAP02/CAP13/CAP01 producer projections, never derived tasks or totals. */
const priorityScore = (value: SfPeopleTopic["priority"]) =>
  value === "critical" ? 0 : value === "high" ? 1 : 2
const scalar = (value: string | number | boolean | null | undefined) =>
  value === undefined || value === null ? "" : String(value)
const stampEqual = (a: SfContextStamp, b: SfContextStamp) =>
  a.installationId === b.installationId && a.projectId === b.projectId &&
  a.hostId === b.hostId && a.principalRef === b.principalRef &&
  a.policyVersion === b.policyVersion && a.accessRevision === b.accessRevision
const readState = (result: { kind: string; status?: number; body?: { status: string } }): SfUiState =>
  result.status === 401 || result.body?.status === "unauthenticated" ? "session-expired" :
  result.status === 403 || result.body?.status === "denied" ? "denied" :
  result.body?.status === "stale" ? "stale" : "unavailable"
const attentionMessage = (state: SfUiState): string =>
  state === "ready" ? "sf.ui29.title" : state === "empty" ? "sf.common.empty" :
  state === "loading" ? "sf.common.loading" : state === "denied" ? "sf.common.noAccess" :
  state === "session-expired" ? "sf.common.loginAgain" :
  state === "stale" ? "sf.common.stale" : "sf.common.unavailable"
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
  const navigate = useNavigate()
  const { t, locale } = useSfPresentation()
  const [screen, setScreen] = createStore<State>({ status: "loading", data: null })
  const [attention, setAttention] = createStore<Attention>({
    topicState: "loading", topics: [], riskState: "loading", risks: [],
    forecastState: "loading", totals: undefined,
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
      if (result.status === 401 || result.status === 403 || result.body.status === "denied") {
        setScreen({ status: "denied", data: null })
        return
      }
      if (result.status === 200 && result.body.status === "ok") {
        setScreen({ status: "ready", data: result.body.value })
        return
      }
      const status: SfUiState =
        result.body.status === "stale" ? "stale"
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

  // The work-selection indicator on projection.home cannot substitute for the
  // source records. Every card is independently admitted at the current owner.
  createEffect(() => {
    const state = owner.state()
    const generation = owner.generation()
    const ready = state.status === "ready" ? owner.ready() : undefined
    const absent = statusFromContext()
    setAttention({
      topicState: ready ? "loading" : absent, topics: [],
      riskState: ready ? "loading" : absent, risks: [],
      forecastState: ready ? "loading" : absent, totals: undefined,
    })
    if (!ready || state.status !== "ready") return
    const stamp = ready.context.stamp
    const abort = new AbortController()
    const current = () => {
      const live = owner.state()
      return !abort.signal.aborted && generation === owner.generation() &&
        live.status === "ready" && live.ownerKey === state.ownerKey &&
        live.context.stamp.accessRevision === stamp.accessRevision &&
        owner.ready()?.transport === ready.transport
    }
    const admitted = (capabilityId: "CAP01" | "CAP02" | "CAP13", operationId: string) =>
      ready.context.destinations.some((item) => item.capabilityId === capabilityId && item.canRead) &&
      ready.context.availability.some((resource) =>
        resource.family === "domain-read" && resource.resource === capabilityId &&
        resource.operations.some((item) => item.operationId === operationId &&
          item.state === "ready" && item.operational))
    if (admitted("CAP02", "domain.page.CAP02")) {
      void createSfPeopleClient(ready.transport)["domain.page.CAP02"](
        { topicStatus: "" }, { signal: abort.signal },
      ).then((response) => {
        if (!current()) return
        if (response.kind === "response" && response.status === 200 && response.body.status === "ok" &&
            response.body.value.capabilityId === "CAP02" &&
            stampEqual(response.body.context, stamp)) {
          const rows = response.body.value.data.hotTopics
          setAttention({ topicState: rows.length ? "ready" : "empty", topics: rows })
          return
        }
        setAttention({ topicState: response.kind === "response" && (response.status === 401 || response.status === 403) ? "denied" : readState(response), topics: [] })
      }).catch(() => { if (current()) setAttention({ topicState: "unavailable", topics: [] }) })
    } else setAttention({ topicState: "unavailable", topics: [] })
    if (admitted("CAP13", "domain.page.CAP13")) {
      void createSfDomainClient(ready.transport)["domain.page.CAP13"]({}, { signal: abort.signal })
        .then((response) => {
          if (!current()) return
          if (response.kind === "response" && response.status === 200 && response.body.status === "ok" &&
              response.body.value.capabilityId === "CAP13" &&
              stampEqual(response.body.context, stamp)) {
            const rows = response.body.value.data.risks
            setAttention({ riskState: !rows ? "unavailable" : rows.length ? "ready" : "empty",
              risks: rows ?? [] })
            return
          }
          setAttention({ riskState: response.kind === "response" && (response.status === 401 || response.status === 403) ? "denied" : readState(response), risks: [] })
        }).catch(() => { if (current()) setAttention({ riskState: "unavailable", risks: [] }) })
    } else setAttention({ riskState: "unavailable", risks: [] })
    if (admitted("CAP01", "domain.page.CAP01")) {
      void createSfDomainClient(ready.transport)["domain.page.CAP01"]({}, { signal: abort.signal })
        .then((response) => {
          if (!current()) return
          if (response.kind === "response" && response.status === 200 && response.body.status === "ok" &&
              response.body.value.capabilityId === "CAP01" &&
              stampEqual(response.body.context, stamp)) {
            const totals = response.body.value.data.totals
            setAttention({ forecastState: totals ? "ready" : "unavailable", totals })
            return
          }
          setAttention({ forecastState: response.kind === "response" && (response.status === 401 || response.status === 403) ? "denied" : readState(response), totals: undefined })
        }).catch(() => { if (current()) setAttention({ forecastState: "unavailable", totals: undefined }) })
    } else setAttention({ forecastState: "unavailable", totals: undefined })
    onCleanup(() => abort.abort())
  })
  const orderedTopics = () => [...attention.topics].sort((a, b) =>
    Number(a.status === "done") - Number(b.status === "done") ||
    priorityScore(a.priority) - priorityScore(b.priority) ||
    (a.due ?? "").localeCompare(b.due ?? ""))
  const openSource = (pathname: string): void => {
    const state = owner.state()
    const selected = props.route.ownerSelection
    if (state.status !== "ready" || !selected.installationId ||
        state.selection.serverKey !== selected.serverKey ||
        state.selection.projectId !== selected.projectId ||
        state.selection.installationId !== selected.installationId) return
    const query = new URLSearchParams({
      server: selected.serverKey, project: selected.projectId, installation: selected.installationId,
    })
    // This only requests the native route; F01 rechecks current source authority.
    navigate(pathname + "?" + query.toString())
  }
  const formatNumber = (amount: number) =>
    new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(amount)
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
      <SfStatePanel
        state={screen.status}
        messageKey={key(screen.status === "ready" ? "sf.ui29.title" : screen.status === "denied" ? "sf.common.noAccess" : screen.status === "session-expired" ? "sf.common.loginAgain" : screen.status === "loading" ? "sf.common.loading" : "sf.common.unavailable")}
        onRetryRead={refresh}
      >
        <div class="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2" data-sf-home="authorized">
          <section class="mx-card min-w-0" aria-labelledby="sf-u01-attention">
            <h2 id="sf-u01-attention">{t(key("sf.ui29.attention"))}</h2>
            <h3>{t(key("sf.ui29.hotTopics"))}</h3>
            <SfStatePanel state={attention.topicState} messageKey={key(attentionMessage(attention.topicState))} onRetryRead={refresh}>
              <ul class="list-disc ps-5" data-sf-home-priorities>
                <For each={orderedTopics()}>{(topic) => (
                  <li class="py-2" data-sf-home-topic={topic.id}>
                    <button type="button" class="mx-btn" onClick={() => openSource(
                      "/orchestra/sf-dashboard/hot-topics/" + encodeSfRouteRef(topic.id),
                    )}>{topic.action || topic.id}</button>
                    <span class="block">{t(key("sf.ui29.priority"))}: {topic.priority ?? t(key("sf.ui29.notProjected"))} · {topic.status ?? t(key("sf.ui29.notProjected"))}</span>
                    <span class="block">{t(key("sf.ui29.owner"))}: <bdi>{topic.owner || t(key("sf.ui29.notProjected"))}</bdi></span>
                    <span class="block">{t(key("sf.ui29.deadline"))}: {topic.due || t(key("sf.ui29.notProjected"))}</span>
                  </li>
                )}</For>
              </ul>
              <p class="text-sm">{t(key("sf.ui29.authorshipUnavailable"))}</p>
            </SfStatePanel>
            <p class="text-sm">{t(key("sf.ui29.workRequiresSelection"))}</p>
          </section>
          <section class="mx-card min-w-0" aria-labelledby="sf-u01-risks" data-sf-home-risks>
            <h2 id="sf-u01-risks">{t(key("sf.ui29.risks"))}</h2>
            <SfStatePanel state={attention.riskState} messageKey={key(attentionMessage(attention.riskState))} onRetryRead={refresh}>
              <ul class="list-disc ps-5">
                <For each={attention.risks}>{(risk) => (
                  <li class="py-2" data-sf-home-risk={String(risk.id)}>
                    <button type="button" class="mx-btn" onClick={() => openSource(
                      "/orchestra/sf-operations/risks/" + encodeSfRouteRef(String(risk.id)),
                    )}>{scalar(risk.title) || scalar(risk.name) || String(risk.id)}</button>
                    <span class="block">{t(key("sf.ui29.owner"))}: <bdi>{scalar(risk.owner) || scalar(risk.responsible) || t(key("sf.ui29.notProjected"))}</bdi></span>
                    <span class="block">{t(key("sf.ui29.deadline"))}: {scalar(risk.due) || t(key("sf.ui29.notProjected"))}</span>
                    <span class="block">{t(key("sf.ui29.riskStatus"))}: {scalar(risk.status) || t(key("sf.ui29.notProjected"))}</span>
                  </li>
                )}</For>
              </ul>
            </SfStatePanel>
          </section>
          <section class="mx-card min-w-0" aria-labelledby="sf-u01-forecast" data-sf-home-forecast>
            <h2 id="sf-u01-forecast">{t(key("sf.ui29.forecast"))}</h2>
            <SfStatePanel state={attention.forecastState} messageKey={key(attentionMessage(attention.forecastState))} onRetryRead={refresh}>
              <Show when={attention.totals}>{(totals) => (
                <dl>
                  <dt>{t(key("sf.ui29.forecastTotal"))}</dt><dd>{formatNumber(totals().totalForecast)}</dd>
                  <dt>{t(key("sf.ui29.forecastOpex"))}</dt><dd>{formatNumber(totals().opexForecast)}</dd>
                  <dt>{t(key("sf.ui29.forecastCapex"))}</dt><dd>{formatNumber(totals().capexForecast)}</dd>
                  <dt>{t(key("sf.ui29.forecastSource"))}</dt><dd>CAP01</dd>
                  <dt>{t(key("sf.ui29.owner"))} / {t(key("sf.ui29.deadline"))}</dt>
                  <dd>{t(key("sf.ui29.notProjected"))}</dd>
                </dl>
              )}</Show>
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
