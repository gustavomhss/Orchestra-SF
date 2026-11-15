import { createEffect, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import type { SfSurfaceProps } from "../context/contracts"
import { useSfContext } from "../context"
import { SfPageFrame } from "../shared/frame"
import type { SfCopyKey, SfUiState } from "../shared/frame"
import { SfStatePanel } from "../shared/states"
import "./administration.css"

type AdminReply = typeof SfDomain.operations["projection.local-admin"]["output"]["Type"]
type AdminValue = Extract<AdminReply, { status: "ok" }>["value"]
const copyKey = (key: string) => key as SfCopyKey
const empty: AdminValue = { notifications: [], backups: [] }

/**
 * UI69 is a local-operator READ surface. The frozen catalog publishes only
 * projection.local-admin, not backup/restore/import commands. No button here
 * bypasses those missing admitted operations or proxies the legacy HTML route.
 */
export function SfLocalAdministrationView(_props: SfSurfaceProps<"UI69">): JSX.Element {
  const owner = useSfContext()
  const language = useLanguage()
  const [state, setState] = createStore({
    page: "loading" as SfUiState,
    ownerKey: "",
    data: undefined as AdminValue | undefined,
    selectedBackup: null as string | null,
    revision: 0,
  })
  const currentOwner = () => {
    const context = owner.state()
    const active = owner.ready()
    if (context.status !== "ready" || !active ||
        context.context.authMode !== "local-operator" ||
        context.binding.authMode !== "local-operator") return null
    return [context.ownerKey, context.context.stamp.accessRevision].join("|")
  }
  const authorizedData = () => currentOwner() === state.ownerKey && !!state.ownerKey && state.data

  createEffect(() => {
    const context = owner.state()
    const ready = owner.ready()
    const generation = owner.generation()
    void state.revision
    if (context.status !== "ready" || !ready) {
      // State is never a cache of a former principal's private projection.
      setState({ ownerKey: "", data: undefined, selectedBackup: null,
        page: context.status === "resolving" ? "loading"
          : context.status === "unauthenticated" ? "session-expired"
          : context.status === "denied" ? "denied"
          : context.status === "context-mismatch" ? "invalid" : "unavailable" })
      return
    }
    if (context.context.authMode !== "local-operator" || context.binding.authMode !== "local-operator") {
      setState({ ownerKey: "", data: undefined, selectedBackup: null, page: "denied" })
      return
    }
    const ownerKey = [context.ownerKey, context.context.stamp.accessRevision].join("|")
    setState({ page: "loading", ownerKey: "", data: undefined, selectedBackup: null })
    const abort = new AbortController()
    let active = true
    void createSfDomainClient(ready.transport)["projection.local-admin"]({}, { signal: abort.signal })
      .then((result) => {
        if (!active || owner.generation() !== generation || owner.ready() !== ready ||
            currentOwner() !== ownerKey) return
        if (result.kind !== "response") {
          setState({ page: "unavailable", ownerKey: "", data: undefined })
          return
        }
        if (result.status === 401 || result.body.status === "unauthenticated") {
          setState({ page: "session-expired", ownerKey: "", data: undefined })
          return
        }
        if (result.status === 403 || result.body.status === "denied") {
          setState({ page: "denied", ownerKey: "", data: undefined })
          return
        }
        if (result.body.status === "ok" && result.status >= 200 && result.status < 300) {
          // Service-provided public rows only; never expose filesystem paths, bytes,
          // credentials, or unadmitted backup restore affordances.
          setState({ page: "ready", ownerKey, data: result.body.value })
          return
        }
        setState({ page: result.body.status === "stale" ? "stale"
          : result.body.status === "needs-input" ? "invalid" : "unavailable",
          ownerKey: "", data: undefined })
      })
      .catch((error: unknown) => {
        if (!active || abort.signal.aborted) return
        console.error("N16 U28 local administration read failed")
        setState({ page: "unavailable", ownerKey: "", data: undefined })
      })
    onCleanup(() => { active = false; abort.abort() })
  })

  const heading = (key: string) => language.t(key as Parameters<typeof language.t>[0])
  const data = () => authorizedData() || empty
  const selected = () => data().backups.find((entry) => entry.id === state.selectedBackup)
  const refresh = () => setState("revision", (value) => value + 1)

  return (
    <div data-sf-surface="UI69" data-sf-owner={authorizedData() ? "local-operator" : "not-authorized"}>
      <SfPageFrame
        titleKey={copyKey("sf.ui69.title")}
        context={[]}
        tabs={[]}
        activeTab={null}
        secondaryActions={[]}
        density="comfortable"
        layout="reading"
        onLayoutMode={() => undefined}
      >
        <SfStatePanel
          state={state.page}
          messageKey={copyKey(state.page === "loading" ? "sf.common.loading"
            : state.page === "denied" ? "sf.common.noAccess"
            : state.page === "session-expired" ? "sf.common.loginAgain"
            : state.page === "invalid" ? "sf.common.invalidLink"
            : state.page === "stale" ? "sf.common.stale" : "sf.common.unavailable")}
          onRetryRead={refresh}
        >
          <Show when={authorizedData()}>
            <div class="sf-u28-layout">
              <section aria-labelledby="sf-u28-profile">
                <h2 id="sf-u28-profile">{heading("sf.u28.profile")}</h2>
                <dl class="sf-u28-definition">
                  <dt>{heading("sf.u28.mode")}</dt><dd>{heading("sf.u28.localOperator")}</dd>
                  <dt>{heading("sf.u28.access")}</dt><dd>{heading("sf.common.readOnly")}</dd>
                  <Show when={data().maintenance}>
                    {(status) => <>
                      <dt>{heading("sf.u28.maintenance")}</dt><dd><bdi>{status()}</bdi></dd>
                    </>}
                  </Show>
                </dl>
              </section>
              <section aria-labelledby="sf-u28-notifications">
                <h2 id="sf-u28-notifications">{heading("sf.u28.notifications")}</h2>
                <Show when={data().notifications.length} fallback={<p>{heading("sf.common.empty")}</p>}>
                  <ul class="sf-u28-notifications">
                    <For each={data().notifications}>
                      {(notification) => (
                        <li data-sf-notification={notification.id}>
                          <time dateTime={notification.at}>{notification.at}</time>
                          <span><bdi>{notification.surface}</bdi></span>
                          <span>{heading(notification.read ? "sf.u28.read" : "sf.u28.unread")}</span>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </section>
              <section aria-labelledby="sf-u28-export">
                <h2 id="sf-u28-export">{heading("sf.u28.backups")}</h2>
                <Show when={data().backups.length} fallback={<p>{heading("sf.common.empty")}</p>}>
                  <div class="sf-u28-table-scroll" role="region" aria-label={heading("sf.u28.backups")} tabindex="0">
                    <table>
                      <caption>{heading("sf.u28.backups")}</caption>
                      <thead><tr>
                        <th scope="col">{heading("sf.u28.application")}</th>
                        <th scope="col">{heading("sf.u28.created")}</th>
                        <th scope="col">{heading("sf.u28.retention")}</th>
                        <th scope="col">{heading("sf.u28.attachments")}</th>
                        <th scope="col">{heading("sf.u28.bytes")}</th>
                        <th scope="col">{heading("sf.u28.actions")}</th>
                      </tr></thead>
                      <tbody><For each={data().backups}>{(backup) => (
                        <tr data-sf-backup={backup.id}>
                          <th scope="row"><bdi>{backup.surface}</bdi></th>
                          <td><time dateTime={backup.at}>{backup.at}</time></td>
                          <td><bdi>{backup.tier}</bdi></td>
                          <td>{backup.assets}</td><td>{backup.bytes}</td>
                          <td><button type="button" class="mx-btn" aria-expanded={state.selectedBackup === backup.id}
                            onClick={() => setState("selectedBackup", state.selectedBackup === backup.id ? null : backup.id)}>
                            {heading("sf.ui69.primary")}
                          </button></td>
                        </tr>
                      )}</For></tbody>
                    </table>
                  </div>
                </Show>
                <Show when={selected()}>
                  {(backup) => (
                    <dl class="sf-u28-definition" data-sf-backup-review>
                      <dt>{heading("sf.u28.application")}</dt><dd><bdi>{backup().surface}</bdi></dd>
                      <dt>{heading("sf.u28.created")}</dt><dd>{backup().at}</dd>
                      <dt>{heading("sf.u28.retention")}</dt><dd><bdi>{backup().tier}</bdi></dd>
                      <dt>{heading("sf.u28.version")}</dt><dd>{backup().version}</dd>
                    </dl>
                  )}
                </Show>
              </section>
              <section aria-labelledby="sf-u28-import">
                <h2 id="sf-u28-import">{heading("sf.u28.import")}</h2>
                <p role="status">{heading("sf.common.unavailable")}</p>
              </section>
            </div>
          </Show>
        </SfStatePanel>
      </SfPageFrame>
    </div>
  )
}
