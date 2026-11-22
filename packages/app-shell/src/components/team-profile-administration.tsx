import { createUniqueId, For, onCleanup, onMount, Show } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { Option, Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { createSfTeamProfileClient } from "@orchestra/client/sucafina/team-profile"
import { useLanguage } from "../context/language"

export type TeamAdministrationNotice =
  | "sf.teams.adminSaved" | "sf.teams.adminUnknown" | "sf.teams.adminConflict" | "sf.teams.adminFailed"

type View =
  | { status: "loading" | "denied" | "unavailable" }
  | { status: "ready"; profiles: readonly TeamProfile.AdminProfile[]; configRevision: TeamProfile.ConfigRevision }

/** This panel edits shared enablement only; it never supplies a business owner or a grant. */
export function TeamProfileAdministration(props: Readonly<{
  binding: SfTeamInstallationDescriptor
  context: SfTeamContext
  generation: number
  currentGeneration(): number
  currentContext(): SfTeamContext | undefined
  refresh(): void
  notice?: TeamAdministrationNotice
  notify(value?: TeamAdministrationNotice): void
}>) {
  const language = useLanguage()
  const inputId = createUniqueId()
  const [ui, setUi] = createStore<{ view: View; input: string; busy: boolean; invalid: boolean; limit: number }>({
    view: { status: "unavailable" }, input: "", busy: false, invalid: false, limit: 100,
  })
  const principal = { ...props.context.profile.principal }
  const generation = props.generation
  const href = window.location.href
  let disposed = false
  let serial = 0
  let operation: AbortController | undefined
  let pendingWrite = false
  const current = () => {
    const context = props.currentContext()
    return !disposed && generation === props.currentGeneration() && window.location.href === href &&
      context?.profile.administration.status === "available" &&
      context.profile.installationId === props.binding.installationId &&
      context.profile.principal.tenantId === principal.tenantId &&
      context.profile.principal.principalObjectId === principal.principalObjectId
  }
  const client = createSfTeamProfileClient({
    binding: props.binding, generation, currentGeneration: props.currentGeneration,
    fetch: (input, init) => fetch(input, init),
  })
  const read = async () => {
    if (pendingWrite || !current()) return
    const attempt = ++serial
    operation?.abort()
    operation = new AbortController()
    const signal = operation.signal
    setUi({ busy: false, invalid: false, limit: 100 })
    setUi("view", reconcile({ status: "loading" }))
    try {
      const reply = await client.list({ signal })
      if (signal.aborted || serial !== attempt || !current()) return
      if (reply.kind === "response" && reply.body.status === "ok") {
        setUi("view", reconcile({ status: "ready", profiles: reply.body.profiles, configRevision: reply.body.configRevision }))
        props.notify()
        return
      }
      const denied = reply.kind === "response" && (reply.body.status === "denied" || reply.body.status === "unauthenticated")
      setUi("view", reconcile({ status: denied ? "denied" : "unavailable" }))
      console.error("Teams administrative configuration read unavailable")
      if (denied) {
        props.notify("sf.teams.adminFailed")
        props.refresh()
      }
    } catch (error) {
      if (signal.aborted || serial !== attempt || !current()) return
      setUi("view", reconcile({ status: "unavailable" }))
      console.error("Teams administrative configuration read failed", error instanceof Error ? error.name : "unknown")
    }
  }
  const configure = async (action: TeamProfile.AdminCommand["action"], profile: TeamProfile.Ref) => {
    const view = ui.view
    if (ui.busy || view.status !== "ready" || !current()) return
    const decoded = Schema.decodeUnknownOption(TeamProfile.AdminCommand)({
      action, profile, expectedRevision: view.configRevision,
    })
    if (Option.isNone(decoded)) { setUi("invalid", true); return }
    const attempt = ++serial
    operation?.abort()
    operation = new AbortController()
    const signal = operation.signal
    setUi({ busy: true, invalid: false })
    props.notify()
    pendingWrite = true
    try {
      const reply = await client.configure(decoded.value, { signal })
      if (signal.aborted || serial !== attempt || !current()) return
      pendingWrite = false
      if (reply.kind === "response" && reply.body.status === "ok") {
        setUi("input", "")
        props.notify("sf.teams.adminSaved")
        // Revalidate the selected Team as well as the administration before showing any further controls.
        props.refresh()
        return
      }
      const unknown = reply.kind === "transport-error" && reply.reason === "outcome-unknown"
      const conflict = reply.kind === "response" && reply.body.status === "conflict"
      props.notify(unknown ? "sf.teams.adminUnknown" : conflict ? "sf.teams.adminConflict" : "sf.teams.adminFailed")
      setUi("view", reconcile({ status: "unavailable" }))
      console.error("Teams administrative change was not confirmed")
      if (reply.kind === "response" && (reply.body.status === "denied" || reply.body.status === "unauthenticated"))
        props.refresh()
    } catch (error) {
      if (signal.aborted || serial !== attempt || !current()) return
      pendingWrite = false
      props.notify("sf.teams.adminUnknown")
      setUi("view", reconcile({ status: "unavailable" }))
      console.error("Teams administrative change failed", error instanceof Error ? error.name : "unknown")
    } finally {
      if (!disposed && serial === attempt) setUi("busy", false)
    }
  }
  const enable = () => {
    const decoded = Schema.decodeUnknownOption(TeamProfile.Ref)({
      installationId: props.binding.installationId, tenantId: props.binding.tenantId, teamObjectId: ui.input.trim(),
    })
    if (Option.isNone(decoded)) { setUi("invalid", true); return }
    void configure("enable", decoded.value)
  }
  const ready = () => ui.view.status === "ready" ? ui.view : undefined
  onMount(() => {
    // A pending/conflicted write needs an explicit new read, including after focus or history remounts.
    if (!props.notice || props.notice === "sf.teams.adminSaved") void read()
  })
  onCleanup(() => {
    disposed = true
    serial++
    if (pendingWrite) {
      props.notify("sf.teams.adminUnknown")
      console.error("Teams administrative change outcome is unknown after navigation")
    }
    operation?.abort()
  })
  return <section class="mx-card flex w-full flex-col gap-4" data-sf-team-administration={ui.view.status}>
    <header>
      <h2 class="text-lg font-semibold">{language.t("sf.teams.administration")}</h2>
      <p>{language.t("sf.teams.adminDescription")}</p>
    </header>
    <Show when={ui.view.status === "loading"}><p role="status">{language.t("sf.ui67.loading")}</p></Show>
    <Show when={ui.view.status === "denied"}><p role="alert">{language.t("sf.teams.adminDenied")}</p></Show>
    <Show when={ui.view.status === "unavailable"}><p role="alert">{language.t("sf.teams.adminUnavailable")}</p></Show>
    <Show when={ui.invalid}><p role="alert">{language.t("sf.teams.invalidTeam")}</p></Show>
    <button type="button" class="mx-btn self-start" data-sf-admin-read disabled={ui.busy || ui.view.status === "loading"}
      onClick={() => void read()}>{language.t("sf.teams.adminRead")}</button>
    <Show when={ready()}>{(view) => <>
      <form class="flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); enable() }}>
        <label for={inputId}>{language.t("sf.teams.teamId")}</label>
        <input id={inputId} data-sf-team-id-input class="mx-btn" autocomplete="off" maxlength={36}
          value={ui.input} disabled={ui.busy} aria-describedby={inputId + "-help"} aria-invalid={ui.invalid}
          onInput={(event) => setUi({ input: event.currentTarget.value, invalid: false })} />
        <p id={inputId + "-help"}>{language.t("sf.teams.enterTeam")}</p>
        <button type="submit" class="mx-btn self-start" disabled={ui.busy}>{language.t("sf.teams.enable")}</button>
      </form>
      <Show when={view().profiles.length} fallback={<p>{language.t("sf.teams.adminEmpty")}</p>}>
        <ul class="flex flex-col gap-3"><For each={view().profiles.slice(0, ui.limit)}>{(row) =>
          <li class="flex flex-wrap items-center gap-2" data-sf-admin-team={row.profile.teamObjectId}>
            <bdi class="break-all">{row.profile.teamObjectId}</bdi>
            <span>{language.t(row.enabled ? "sf.teams.enabled" : "sf.teams.disabled")}</span>
            <button type="button" class="mx-btn" disabled={ui.busy}
              data-sf-admin-action={row.enabled ? "disable" : "enable"}
              onClick={() => void configure(row.enabled ? "disable" : "enable", row.profile)}>
              {language.t(row.enabled ? "sf.teams.disable" : "sf.teams.enable")}</button>
            <button type="button" class="mx-btn" disabled={ui.busy} data-sf-admin-action="remove"
              onClick={() => void configure("remove", row.profile)}>{language.t("sf.teams.remove")}</button>
          </li>
        }</For></ul>
      </Show>
      <Show when={ui.limit < view().profiles.length}>
        <button type="button" class="mx-btn self-start" onClick={() => setUi("limit", (value) => value + 100)}>
          {language.t("sf.teams.more")}</button>
      </Show>
    </>}</Show>
  </section>
}
