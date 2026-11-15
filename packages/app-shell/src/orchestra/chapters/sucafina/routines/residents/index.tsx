import { createEffect, createMemo, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { createSfAnalysesClient } from "@orchestra/client/sucafina/analyses"
import { SfResidentCatalog } from "@orchestra/schema/sucafina/analyses"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import type { SfUiState } from "../../shared/frame"
import { n29ContextState, n29Key, n29Permitted, n29ResponseState, n29SameAuthority, n29StateKey, useN29Copy } from "../catalog/ui"
import "./residents.css"

type Profile = (typeof SfResidentCatalog)["Type"]["profiles"][number]
type View = {
  state: SfUiState
  profiles: readonly Profile[]
  search: string
  selected: string | null
  reason: string | null
}
const empty = (): View => ({ state: "loading", profiles: [], search: "", selected: null, reason: null })

/** UI70 — actual installed and currently granted resident inventory only.
 * No load receipt, pack count, contribution or execution is inferred from a
 * profile appearing in this projection.
 */
export function SfResidentsView(props: SfSurfaceProps<"UI70">): JSX.Element {
  const owner = useSfContext()
  const { t } = useN29Copy()
  const [view, setView] = createStore<View>(empty())

  createEffect(() => {
    const generation = owner.generation()
    const current = owner.ready()
    if (!current) {
      setView(reconcile({ ...empty(), state: n29ContextState(owner.state().status) }))
      return
    }
    const availability = current.context.availability.find((entry) =>
      entry.family === "intelligence" && entry.resource === "residents")
    if (!n29Permitted(current.context, "residents", "projection.residents")) {
      setView(reconcile({ ...empty(), state: availability?.state === "denied" ? "denied" : "unavailable" }))
      return
    }
    const abort = new AbortController()
    const stamp = current.context.stamp
    setView(reconcile({ ...empty(), state: "loading" }))
    onCleanup(() => abort.abort())
    void createSfAnalysesClient(current.transport)["projection.residents"]({}, { signal: abort.signal }).then((response) => {
      if (abort.signal.aborted || !n29SameAuthority(owner, generation, stamp)) return
      const next = n29ResponseState(response)
      if (response.kind !== "response" || response.body.status !== "ok") {
        setView(reconcile({ ...empty(), state: next }))
        if (next === "unavailable") console.error("N29 UI70: authorized resident read unavailable")
        return
      }
      const returned = response.body.context
      if (returned.hostId !== stamp.hostId || returned.projectId !== stamp.projectId
        || returned.installationId !== stamp.installationId || returned.principalRef !== stamp.principalRef
        || returned.policyVersion !== stamp.policyVersion || returned.accessRevision !== stamp.accessRevision) {
        setView(reconcile({ ...empty(), state: "stale" }))
        return
      }
      const profiles = response.body.value.profiles
      setView("profiles", profiles)
      setView("state", profiles.length ? "ready" : "empty")
      setView("reason", null)
    }).catch((error: unknown) => {
      if (abort.signal.aborted || !n29SameAuthority(owner, generation, stamp)) return
      console.error("N29 UI70: resident projection request failed", error instanceof Error ? error.name : "unknown")
      setView(reconcile({ ...empty(), state: "unavailable" }))
    })
  })

  const visible = createMemo(() => {
    const query = view.search.trim().toLocaleLowerCase()
    if (!query) return view.profiles
    return view.profiles.filter((profile) =>
      [profile.id, profile.mission, profile.version,
        ...profile.skills.flatMap((skill) => [skill.id, skill.version, ...skill.allowedOperations])].some((item) =>
        item.toLocaleLowerCase().includes(query)))
  })
  const pageState = (): SfUiState => view.state === "ready" && !visible().length
    ? "filtered-empty" : view.state
  const selected = createMemo(() => view.profiles.find((profile) => profile.id === view.selected))
  const installedCount = () => view.profiles.reduce((count, profile) => count + profile.skills.length, 0)
  const currentStamp = () => owner.ready()?.context.stamp

  return (
    <SfPageFrame
      titleKey={n29Key("sf.ui70.title")}
      context={[]}
      tabs={[]}
      activeTab={null}
      secondaryActions={[{
        id: "refresh", labelKey: n29Key("sf.u35.refresh"), tone: "secondary",
        disabled: owner.state().status !== "ready", busy: view.state === "loading",
        onInvoke: () => { void owner.reload() },
      }]}
      density="comfortable"
      layout="reading"
      onLayoutMode={() => undefined}
    >
      <section class="sf-n29-residents" data-sf-surface={props.surfaceId} data-state={pageState()}>
        <Show when={view.state === "ready" || view.state === "empty"}>
          <div class="sf-n29-summary" aria-label={t("sf.u35.coverage")}>
            <p><strong>{t("sf.u35.profiles")}:</strong> {t("sf.u35.count", { count: view.profiles.length })}</p>
            <p><strong>{t("sf.u35.skills")}:</strong> {t("sf.u35.count", { count: installedCount() })}</p>
            <p><strong>{t("sf.u35.packs")}:</strong> {t("sf.u35.noPackProof")}</p>
            <p><strong>{t("sf.u35.execution")}:</strong> {t("sf.u35.noExecutionProof")}</p>
          </div>
          <label class="sf-n29-field">
            <span>{t("sf.u35.filter")}</span>
            <input type="search" value={view.search}
              onInput={(event) => setView("search", event.currentTarget.value)} />
          </label>
        </Show>
        <SfStatePanel state={pageState()} messageKey={n29StateKey(pageState())}
          onRetryRead={() => { void owner.reload() }}>
          <Show when={pageState() === "ready"}>
            <div class="sf-n29-resident-layout">
              <div class="sf-n29-resident-list" aria-label={t("sf.u35.profiles")}>
                <For each={visible()}>
                  {(profile) => (
                    <article class="mx-card">
                      <h2><bdi>{profile.id}</bdi></h2>
                      <p><bdi>{profile.mission}</bdi></p>
                      <p>{t("sf.u35.version")}: <bdi>{profile.version}</bdi></p>
                      <button type="button" class="mx-btn"
                        aria-pressed={view.selected === profile.id}
                        onClick={() => setView("selected", view.selected === profile.id ? null : profile.id)}>
                        {t("sf.u35.details")}
                      </button>
                    </article>
                  )}
                </For>
              </div>
              <Show when={selected()}>
                {(profile) => (
                  <article class="mx-card sf-n29-resident-detail">
                    <h2>{t("sf.u35.profile")}: <bdi>{profile().id}</bdi></h2>
                    <section aria-label={t("sf.u35.contribution")}>
                      <h3>{t("sf.u35.contribution")}</h3>
                      <p>{t("sf.u35.noProof")}</p>
                    </section>
                    <section aria-label={t("sf.u35.coverage")}>
                      <h3>{t("sf.u35.coverage")}</h3>
                      <p>{t("sf.u35.skills")}: {t("sf.u35.count", { count: profile().skills.length })}</p>
                      <div class="sf-n29-skill-list">
                        <For each={profile().skills}>
                          {(skill) => (
                            <div class="sf-n29-skill" data-sf-skill={skill.id}>
                              <h4>{t("sf.u35.skill")}: <bdi>{skill.id}</bdi></h4>
                              <p>{t("sf.u35.version")}: <bdi>{skill.version}</bdi></p>
                              <details>
                                <summary>{t("sf.u35.allowed")}</summary>
                                <ul><For each={skill.allowedOperations}>
                                  {(operation) => <li><code><bdi>{operation}</bdi></code></li>}
                                </For></ul>
                              </details>
                              <details>
                                <summary>{t("sf.u35.schema")}</summary>
                                <ul><For each={skill.outputSchemaRefs}>
                                  {(schema) => <li><code><bdi>{schema}</bdi></code></li>}
                                </For></ul>
                              </details>
                              <p><strong>{t("sf.u35.status")}:</strong> {t("sf.u35.notLoaded")}</p>
                            </div>
                          )}
                        </For>
                      </div>
                    </section>
                    <section aria-label={t("sf.u35.source")}>
                      <h3>{t("sf.u35.source")}</h3>
                      <p>{t("sf.u35.installation")}: <bdi>{currentStamp()?.installationId}</bdi></p>
                      <p>{t("sf.u35.current")}</p>
                    </section>
                    <section aria-label={t("sf.u35.execution")}>
                      <h3>{t("sf.u35.execution")}</h3>
                      <p>{t("sf.u35.noExecutionProof")}</p>
                    </section>
                  </article>
                )}
              </Show>
            </div>
          </Show>
        </SfStatePanel>
      </section>
    </SfPageFrame>
  )
}
