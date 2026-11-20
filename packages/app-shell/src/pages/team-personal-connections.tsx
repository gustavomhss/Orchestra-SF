import { createMemo, createUniqueId, For, onCleanup, onMount, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import type { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import type { SfTransportFetch } from "@orchestra/client/sucafina/transport"
import { createTeamPersonalConnections, type TeamPersonalNotice } from "../context/team-personal-connections"
import type { TeamAdministrativeDraft } from "../orchestra/chapters/sucafina/local-administration/team-configuration-state"
import type { TeamWindowIdentity } from "../utils/team-profile-storage"
import { useLanguage } from "../context/language"

export function SfTeamPersonalConnections(props: Readonly<{
  binding: SfTeamInstallationDescriptor
  window: TeamWindowIdentity
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">
  context(): SfTeamContext | undefined
  generation(): number
  fetch: SfTransportFetch
  confirmDiscard(): Promise<boolean>
  registerDraft(draft: TeamAdministrativeDraft): () => void
  notice(key: TeamPersonalNotice): void
}>): JSX.Element {
  const language = useLanguage(), id = createUniqueId()
  const editor = createTeamPersonalConnections(props), state = editor.state
  const [ui, setUi] = createStore({ remove: false })
  const provider = createMemo(() => state.providers.find((item) => item.providerId === state.selected))
  const disabled = () => state.busy || state.pending || !state.canWrite
  const act = async (run: () => Promise<boolean>) => {
    try { await run() }
    catch {
      editor.guard.retire(); props.notice("sf.teams.personalUnavailable")
      console.error("Personal connection action failed unexpectedly")
    }
  }
  const unregister = props.registerDraft(editor.guard)
  onMount(() => { void act(editor.open) })
  onCleanup(() => { unregister(); editor.dispose() })
  return <section class="mx-card sf-team-context" data-sf-personal-connections={state.status}>
    <h1>{language.t("sf.teams.personalConnections")}</h1>
    <p>{language.t("sf.teams.personalDescription")}</p>
    <p>{language.t("sf.teams.personalScope")}</p>
    <Show when={state.message}><p role="alert" data-sf-personal-notice>{language.t(state.message!)}</p></Show>
    <Show when={state.status === "loading"}><p role="status">{language.t("sf.teams.loading")}</p></Show>
    <Show when={state.status === "denied"}><p role="alert">{language.t("sf.teams.personalDenied")}</p></Show>
    <Show when={state.status === "unavailable"}><p role="alert">{language.t("sf.teams.personalUnavailable")}</p></Show>
    <button type="button" class="mx-btn" disabled={state.busy} data-sf-personal-catalog
      onClick={() => { setUi("remove", false); void act(editor.open) }}>{language.t("sf.teams.personalReloadCatalog")}</button>
    <Show when={state.status === "ready"}>
      <Show when={state.providers.length > 0} fallback={<p role="status">{language.t("sf.teams.personalEmpty")}</p>}>
        <label for={id + "-provider"}>{language.t("sf.teams.personalProvider")}</label>
        <select id={id + "-provider"} data-sf-personal-provider value={state.selected ?? ""} disabled={state.busy}
          onChange={(event) => { setUi("remove", false); void act(() => editor.choose(event.currentTarget.value)) }}>
          <option value="">{language.t("sf.teams.personalChooseProvider")}</option>
          <For each={state.providers}>{(item) => <option value={item.providerId}>{item.name}</option>}</For>
        </select>
        <Show when={provider()}>{(selected) => <div>
          <h2>{selected().name}</h2>
          <p>{language.t("sf.teams.personalModels")}</p>
          <ul><For each={selected().models}>{(model) => <li>{model.name}</li>}</For></ul>
          <button type="button" class="mx-btn" disabled={state.busy} data-sf-personal-read
            onClick={() => { setUi("remove", false); void act(editor.refresh) }}>{language.t("sf.teams.personalRead")}</button>
          <Show when={state.connection}>{(connection) => <>
            <p role="status" data-sf-personal-record={connection().state}>
              {language.t(connection().state === "active" ? "sf.teams.personalActive" :
                connection().state === "removed" ? "sf.teams.personalAbsentRemoved" : "sf.teams.personalAbsent")}
            </p>
            <p>{language.t("sf.teams.personalNotVerified")}</p>
            <Show when={state.pending}>
              <p>{language.t("sf.teams.personalUnknown")}</p>
              <button type="button" class="mx-btn" disabled={state.busy || !state.observed} data-sf-personal-accept-observed
                onClick={() => editor.acceptObserved()}>{language.t("sf.teams.personalUseObserved")}</button>
            </Show>
            <Show when={!state.canWrite && !state.pending}><p>{language.t("sf.teams.personalReadBeforeChange")}</p></Show>
            <form autocomplete="off" onSubmit={(event) => { event.preventDefault(); setUi("remove", false); void act(() => editor.submit()) }}>
              <fieldset class="sf-team-config-fields" disabled={disabled()}>
                <label for={id + "-label"}>{language.t("sf.teams.personalLabel")}</label>
                <input id={id + "-label"} data-sf-personal-label autocomplete="off" maxLength={256} value={state.label}
                  onInput={(event) => editor.edit("label", event.currentTarget.value)} />
                <label for={id + "-key"}>{language.t("sf.teams.personalApiKey")}</label>
                <input id={id + "-key"} data-sf-personal-secret type="password" autocomplete="off"
                  spellcheck={false} maxLength={16384} value={state.secret}
                  onInput={(event) => editor.edit("secret", event.currentTarget.value)} />
                <p>{language.t("sf.teams.personalSecretHelp")}</p>
                <button type="submit" class="mx-btn" disabled={!state.secret} data-sf-personal-save>
                  {language.t(connection().state === "active" ? "sf.teams.personalUpdate" : "sf.teams.personalCreate")}
                </button>
              </fieldset>
            </form>
            <Show when={connection().state === "active"}>
              <button type="button" class="mx-btn" disabled={disabled()} data-sf-personal-remove
                onClick={() => setUi("remove", true)}>{language.t("sf.teams.personalRemove")}</button>
              <Show when={ui.remove}><div role="alert">
                <p>{language.t("sf.teams.personalRemoveConfirm")}</p>
                <button type="button" class="mx-btn" disabled={disabled()} onClick={() => setUi("remove", false)}>
                  {language.t("common.cancel")}</button>
                <button type="button" class="mx-btn" disabled={disabled()} data-sf-personal-confirm-remove
                  onClick={() => { setUi("remove", false); void act(() => editor.submit(true)) }}>
                  {language.t("sf.teams.personalRemove")}</button>
              </div></Show>
            </Show>
          </>}</Show>
        </div>}</Show>
      </Show>
    </Show>
  </section>
}
