import { createUniqueId, onCleanup, onMount, Show } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { Option, Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { createSfTeamConfigurationClient } from "@orchestra/client/sucafina/team-configuration"
import type { TeamAdministrationNotice } from "./team-profile-administration"
import { useLanguage } from "../context/language"

type View =
  | { status: "loading" | "denied" | "unavailable" }
  | { status: "ready"; document?: TeamProfile.ConfigurationDocument; configRevision: TeamProfile.ConfigRevision }

/** Edits shared preferences without supplying provider access, personal credentials or business authority. */
export function TeamProfileConfiguration(props: Readonly<{
  binding: SfTeamInstallationDescriptor
  context: SfTeamContext
  generation: number
  currentGeneration(): number
  currentContext(): SfTeamContext | undefined
  profile: TeamProfile.Ref
  configRevision: TeamProfile.ConfigRevision
  refresh(): void
  notify(value?: TeamAdministrationNotice): void
  invalidate(): void
  close(): void
}>) {
  const language = useLanguage()
  const id = createUniqueId()
  const profile = Object.freeze({ ...props.profile })
  const principal = { ...props.context.profile.principal }
  const generation = props.generation
  const href = window.location.href
  const [ui, setUi] = createStore<{ view: View; model: string; agent: string; busy: boolean; invalid: boolean }>({
    view: { status: "loading" }, model: "", agent: "", busy: false, invalid: false,
  })
  let disposed = false
  let serial = 0
  let operation: AbortController | undefined
  let pendingWrite = false
  const current = () => {
    const context = props.currentContext()
    return !disposed && generation === props.currentGeneration() && window.location.href === href &&
      context?.profile.administration.status === "available" &&
      context.profile.installationId === profile.installationId &&
      context.profile.principal.tenantId === principal.tenantId &&
      context.profile.principal.principalObjectId === principal.principalObjectId &&
      props.profile.installationId === profile.installationId && props.profile.tenantId === profile.tenantId &&
      props.profile.teamObjectId === profile.teamObjectId
  }
  const client = createSfTeamConfigurationClient({
    binding: props.binding, generation, currentGeneration: props.currentGeneration,
    fetch: (input, init) => fetch(input, init),
  })
  const read = async () => {
    if (pendingWrite || !current()) return
    const attempt = ++serial
    operation?.abort()
    operation = new AbortController()
    const signal = operation.signal
    setUi({ model: "", agent: "", invalid: false, busy: false })
    setUi("view", reconcile({ status: "loading" }))
    try {
      const reply = await client.readConfiguration(profile, { signal })
      if (signal.aborted || serial !== attempt || !current()) return
      if (reply.kind === "response" && reply.body.status === "ok") {
        const snapshot = reply.body.configuration
        setUi({ model: snapshot.document.settings.model ?? "", agent: snapshot.document.settings.default_agent ?? "" })
        setUi("view", reconcile({ status: "ready", document: snapshot.document, configRevision: snapshot.configRevision }))
        props.notify()
        return
      }
      if (reply.kind === "response" && reply.body.status === "not-found") {
        // The preceding administrative catalog supplies CAS for the first document. A concurrent change conflicts.
        setUi("view", reconcile({ status: "ready", configRevision: props.configRevision }))
        props.notify()
        return
      }
      const denied = reply.kind === "response" && (reply.body.status === "denied" || reply.body.status === "unauthenticated")
      setUi("view", reconcile({ status: denied ? "denied" : "unavailable" }))
      console.error("Shared Team configuration read unavailable")
      if (denied) { props.notify("sf.teams.adminFailed"); props.refresh() }
    } catch (error) {
      if (signal.aborted || serial !== attempt || !current()) return
      setUi("view", reconcile({ status: "unavailable" }))
      console.error("Shared Team configuration read failed", error instanceof Error ? error.name : "unknown")
    }
  }
  const save = async () => {
    const view = ui.view
    if (ui.busy || view.status !== "ready" || !current()) return
    const decoded = Schema.decodeUnknownOption(TeamProfile.ConfigurationCommand, { onExcessProperty: "error" })({
      profile, expectedRevision: view.configRevision,
      document: { version: 1, settings: {
        model: ui.model.trim(),
        ...(ui.agent.trim() ? { default_agent: ui.agent.trim() } : {}),
        ...(view.document?.settings.agents ? { agents: view.document.settings.agents } : {}),
      } },
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
      const reply = await client.configureDocument(decoded.value, { signal })
      if (signal.aborted || serial !== attempt || !current()) return
      pendingWrite = false
      if (reply.kind === "response" && reply.body.status === "ok") {
        props.notify("sf.teams.adminSaved")
        // A confirmed configuration changes the admission revision. Revalidate the page before further controls.
        props.refresh()
        return
      }
      const unknown = reply.kind === "transport-error" && reply.reason === "outcome-unknown"
      const conflict = reply.kind === "response" && reply.body.status === "conflict"
      props.notify(unknown ? "sf.teams.adminUnknown" : conflict ? "sf.teams.adminConflict" : "sf.teams.adminFailed")
      console.error("Shared Team configuration change was not confirmed")
      props.invalidate()
      if (reply.kind === "response" && (reply.body.status === "denied" || reply.body.status === "unauthenticated"))
        props.refresh()
    } catch (error) {
      if (signal.aborted || serial !== attempt || !current()) return
      pendingWrite = false
      props.notify("sf.teams.adminUnknown")
      console.error("Shared Team configuration change failed", error instanceof Error ? error.name : "unknown")
      props.invalidate()
    } finally {
      if (!disposed && serial === attempt) setUi("busy", false)
    }
  }
  const ready = () => ui.view.status === "ready" ? ui.view : undefined
  onMount(() => { void read() })
  onCleanup(() => {
    disposed = true
    serial++
    if (pendingWrite) {
      props.notify("sf.teams.adminUnknown")
      console.error("Shared Team configuration outcome is unknown after navigation")
    }
    operation?.abort()
  })
  return <section class="mx-card flex w-full flex-col gap-3" data-sf-team-configuration={ui.view.status}>
    <header>
      <h3 class="text-lg font-semibold">{language.t("sf.teams.configuration")}</h3>
      <bdi class="break-all">{profile.teamObjectId}</bdi>
      <p>{language.t("sf.teams.configurationDescription")}</p>
    </header>
    <Show when={ui.view.status === "loading"}><p role="status">{language.t("sf.ui67.loading")}</p></Show>
    <Show when={ui.view.status === "denied"}><p role="alert">{language.t("sf.teams.adminDenied")}</p></Show>
    <Show when={ui.view.status === "unavailable"}><p role="alert">{language.t("sf.teams.adminUnavailable")}</p></Show>
    <Show when={ui.invalid}><p role="alert">{language.t("sf.teams.configurationInvalid")}</p></Show>
    <div class="flex flex-wrap gap-2">
      <button type="button" class="mx-btn" data-sf-configuration-read disabled={ui.busy || ui.view.status === "loading"}
        onClick={() => void read()}>{language.t("sf.teams.adminRead")}</button>
      <button type="button" class="mx-btn" data-sf-configuration-close disabled={ui.busy}
        onClick={props.close}>{language.t("sf.teams.configurationClose")}</button>
    </div>
    <Show when={ready()}>{(view) => <>
      <Show when={!view().document}><p>{language.t("sf.teams.configurationEmpty")}</p></Show>
      <form class="flex flex-col gap-2" data-sf-configuration-form onSubmit={(event) => { event.preventDefault(); void save() }}>
        <label for={id + "-model"}>{language.t("sf.teams.configurationModel")}</label>
        <input id={id + "-model"} class="mx-btn" data-sf-configuration-model autocomplete="off" maxlength={512}
          value={ui.model} disabled={ui.busy} aria-invalid={ui.invalid} aria-describedby={id + "-help"}
          onInput={(event) => setUi({ model: event.currentTarget.value, invalid: false })} />
        <p id={id + "-help"}>{language.t("sf.teams.configurationModelHelp")}</p>
        <label for={id + "-agent"}>{language.t("sf.teams.configurationAgent")}</label>
        <input id={id + "-agent"} class="mx-btn" data-sf-configuration-agent autocomplete="off" maxlength={64}
          value={ui.agent} disabled={ui.busy} aria-invalid={ui.invalid}
          onInput={(event) => setUi({ agent: event.currentTarget.value, invalid: false })} />
        <Show when={view().document?.settings.agents}><p>{language.t("sf.teams.configurationPreserved")}</p></Show>
        <button type="submit" class="mx-btn self-start" data-sf-configuration-save disabled={ui.busy}>
          {language.t("sf.teams.configurationSave")}</button>
      </form>
    </>}</Show>
  </section>
}
