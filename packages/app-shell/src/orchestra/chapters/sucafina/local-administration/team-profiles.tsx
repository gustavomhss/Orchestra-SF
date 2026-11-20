import { createEffect, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { Option, Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { createSfTeamProfileClient } from "@orchestra/client/sucafina/team-profile"
import type { SfTransportFetch } from "@orchestra/client/sucafina/transport"
import { useLanguage } from "../../../../context/language"

type CopyKey = Parameters<ReturnType<typeof useLanguage>["t"]>[0]
type View = Readonly<{ status: "loading" | "ready" | "denied" | "unavailable";
  profiles: readonly TeamProfile.AdminProfile[]; configRevision?: number }>
export function SfTeamProfilesAdministration(props: Readonly<{
  binding: SfTeamInstallationDescriptor; context: () => SfTeamContext | undefined
  generation: () => number; fetch: SfTransportFetch; refresh(): Promise<void>
}>): JSX.Element {
  const language = useLanguage()
  const [ui, setUi] = createStore<{ view: View; input: string; busy: boolean; message?: CopyKey; limit: number }>({
    view: { status: "loading", profiles: [] }, input: "", busy: false, limit: 100,
  })
  let disposed = false, serial = 0, operation: AbortController | undefined
  const current = (generation: number, principal: TeamProfile.Principal) => {
    const context = props.context()
    return !disposed && props.generation() === generation && context?.profile.administration.status === "available" &&
      context.profile.principal.tenantId === principal.tenantId &&
      context.profile.principal.principalObjectId === principal.principalObjectId
  }
  const read = async () => {
    const context = props.context()
    if (!context || context.profile.administration.status !== "available") return
    const generation = props.generation(), principal = context.profile.principal, epoch = ++serial
    operation?.abort(); operation = new AbortController()
    const abort = operation
    setUi("view", reconcile({ status: "loading", profiles: [] })); setUi("busy", false)
    const client = createSfTeamProfileClient({ binding: props.binding, generation,
      currentGeneration: props.generation, fetch: props.fetch })
    try {
      const reply = await client.list({ signal: abort.signal })
      if (abort.signal.aborted || serial !== epoch || !current(generation, principal)) return
      if (reply.kind === "response" && reply.body.status === "ok") {
        setUi("view", reconcile({ status: "ready", profiles: reply.body.profiles, configRevision: reply.body.configRevision }))
        return
      }
      const denied = reply.kind === "response" && (reply.body.status === "denied" || reply.body.status === "unauthenticated")
      setUi("view", reconcile({ status: denied ? "denied" : "unavailable", profiles: [] }))
      if (denied) await props.refresh()
      console.error("Teams administrative configuration read unavailable")
    } catch (error) {
      if (abort.signal.aborted || serial !== epoch || !current(generation, principal)) return
      setUi("view", reconcile({ status: "unavailable", profiles: [] }))
      console.error("Teams administrative configuration read failed", error instanceof Error ? error.name : "unknown")
    }
  }
  const configure = async (action: TeamProfile.AdminCommand["action"], profile: TeamProfile.Ref) => {
    const context = props.context(), revision = ui.view.configRevision
    if (ui.busy || ui.view.status !== "ready" || revision === undefined || !context ||
        context.profile.administration.status !== "available") return
    const generation = props.generation(), principal = context.profile.principal, epoch = ++serial
    operation?.abort(); operation = new AbortController()
    const abort = operation
    setUi({ busy: true, message: undefined })
    const client = createSfTeamProfileClient({ binding: props.binding, generation,
      currentGeneration: props.generation, fetch: props.fetch })
    try {
      const command = Schema.decodeUnknownSync(TeamProfile.AdminCommand)({ action, profile, expectedRevision: revision })
      const reply = await client.configure(command, { signal: abort.signal })
      if (abort.signal.aborted || serial !== epoch || !current(generation, principal)) return
      if (reply.kind === "response" && reply.body.status === "ok") {
        setUi({ input: "", message: "sf.teams.adminSaved", busy: false })
        await props.refresh()
        // The context-generation effect owns the next read; no mutation is retried.
        return
      }
      const unknown = reply.kind === "transport-error" && reply.reason === "outcome-unknown"
      const conflict = reply.kind === "response" && reply.body.status === "conflict"
      setUi("message", unknown ? "sf.teams.adminUnknown" : conflict ? "sf.teams.adminConflict" : "sf.teams.adminFailed")
      // CAS must come from an explicit new read. Never reuse a stale revision or retry a write.
      setUi("view", reconcile({ status: "unavailable", profiles: [] }))
      if (reply.kind === "response" && (reply.body.status === "denied" || reply.body.status === "unauthenticated"))
        await props.refresh()
      console.error("Teams administrative change was not confirmed")
    } catch (error) {
      if (abort.signal.aborted || serial !== epoch || !current(generation, principal)) return
      setUi("message", "sf.teams.adminUnknown")
      setUi("view", reconcile({ status: "unavailable", profiles: [] }))
      console.error("Teams administrative change failed", error instanceof Error ? error.name : "unknown")
    } finally { if (!disposed && serial === epoch) setUi("busy", false) }
  }
  const enable = () => {
    const decoded = Schema.decodeUnknownOption(TeamProfile.Ref, { onExcessProperty: "error" })({
      installationId: props.binding.installationId, tenantId: props.binding.tenantId, teamObjectId: ui.input.trim(),
    })
    if (Option.isNone(decoded)) { setUi("message", "sf.teams.invalidTeam"); return }
    void configure("enable", decoded.value)
  }
  createEffect(() => {
    const generation = props.generation(), context = props.context()
    if (!context || context.profile.administration.status !== "available") {
      serial++; operation?.abort()
      setUi({ input: "", busy: false, message: undefined,
        view: { status: context?.profile.administration.status === "denied" ? "denied" : "unavailable", profiles: [] } })
      return
    }
    void generation
    void read()
  })
  onCleanup(() => { disposed = true; serial++; operation?.abort(); setUi("input", "") })
  return <section class="sf-team-admin mx-card" data-sf-team-administration={ui.view.status}>
    <header><h2>{language.t("sf.teams.administration")}</h2><p>{language.t("sf.teams.adminDescription")}</p></header>
    <Show when={ui.message}><p role="status">{language.t(ui.message!)}</p></Show>
    <Show when={ui.view.status === "loading"}><p role="status">{language.t("sf.teams.loading")}</p></Show>
    <Show when={ui.view.status === "denied"}><p role="alert">{language.t("sf.teams.adminDenied")}</p></Show>
    <Show when={ui.view.status === "unavailable"}><p role="alert">{language.t("sf.teams.adminUnavailable")}</p></Show>
    <button type="button" class="mx-btn" disabled={ui.busy || ui.view.status === "loading"}
      onClick={() => { setUi("message", undefined); void read() }}>{language.t("sf.teams.adminRead")}</button>
    <Show when={ui.view.status === "ready"}>
      <form onSubmit={(event) => { event.preventDefault(); enable() }} class="sf-team-enable">
        <label for="sf-team-enable-id">{language.t("sf.teams.teamId")}</label>
        <input id="sf-team-enable-id" data-sf-team-id-input autocomplete="off" maxlength={36}
          value={ui.input} disabled={ui.busy}
          onInput={(event) => setUi("input", event.currentTarget.value)} aria-describedby="sf-team-enable-help" />
        <p id="sf-team-enable-help">{language.t("sf.teams.enterTeam")}</p>
        <button type="submit" class="mx-btn" disabled={ui.busy}>{language.t("sf.teams.enable")}</button>
      </form>
      <Show when={ui.view.profiles.length} fallback={<p>{language.t("sf.teams.adminEmpty")}</p>}>
        <ul class="sf-team-profile-list"><For each={ui.view.profiles.slice(0, ui.limit)}>{(row) =>
          <li data-sf-admin-team={row.profile.teamObjectId}>
            <bdi>{row.profile.teamObjectId}</bdi>
            <span>{language.t(row.enabled ? "sf.teams.enabled" : "sf.teams.disabled")}</span>
            <button type="button" class="mx-btn" disabled={ui.busy}
              onClick={() => { void configure(row.enabled ? "disable" : "enable", row.profile) }}>
              {language.t(row.enabled ? "sf.teams.disable" : "sf.teams.enable")}</button>
            <button type="button" class="mx-btn" disabled={ui.busy}
              onClick={() => { void configure("remove", row.profile) }}>{language.t("sf.teams.remove")}</button>
          </li>
        }</For></ul>
      </Show>
      <Show when={ui.limit < ui.view.profiles.length}>
        <button type="button" class="mx-btn" onClick={() => setUi("limit", (value) => value + 100)}>{language.t("sf.teams.more")}</button>
      </Show>
    </Show>
  </section>
}
