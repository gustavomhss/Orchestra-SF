import { createEffect, createUniqueId, For, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "../../../../context/language"
import type { createTeamConfigurationState } from "./team-configuration-state"

export function SfTeamConfigurationForm(props: Readonly<{
  editor: ReturnType<typeof createTeamConfigurationState>
}>): JSX.Element {
  const language = useLanguage(), id = createUniqueId(), state = props.editor.state
  const [ui, setUi] = createStore({ agent: "", name: "" })
  const ids = () => Object.keys(state.document.settings.agents ?? {})
  const selected = () => ui.agent && Object.hasOwn(state.document.settings.agents ?? {}, ui.agent)
    ? state.document.settings.agents?.[ui.agent] : undefined
  const disabled = () => state.status !== "ready" || state.busy || state.pending
  let profile = ""
  createEffect(() => {
    const next = state.profile?.teamObjectId ?? ""
    if (next !== profile) { profile = next; setUi({ agent: "", name: "" }) }
  })
  const add = () => {
    const name = ui.name.trim()
    if (props.editor.addAgent(name)) setUi({ agent: name, name: "" })
  }
  return <Show when={state.status !== "idle"}>
    <section class="sf-team-configuration" data-sf-team-configuration={state.status}>
      <header>
        <h3>{language.t("sf.teams.configTitle")}</h3>
        <p>{language.t("sf.teams.configFor", { id: state.profile?.teamObjectId ?? "" })}</p>
        <p>{language.t("sf.teams.configDescription")}</p>
      </header>
      <Show when={state.message}><p role="status" data-sf-config-message>{language.t(state.message!)}</p></Show>
      <Show when={state.status === "loading"}><p role="status">{language.t("sf.teams.loading")}</p></Show>
      <Show when={state.status === "denied"}><p role="alert">{language.t("sf.teams.adminDenied")}</p></Show>
      <Show when={state.status === "unavailable"}><p role="alert">{language.t("sf.teams.adminUnavailable")}</p></Show>
      <Show when={state.pending}>
        <button type="button" class="mx-btn" disabled={state.busy} data-sf-config-check
          onClick={() => { void props.editor.reconcileWrite() }}>{language.t("sf.teams.configCheck")}</button>
      </Show>
      <Show when={state.profile && !state.pending}>
        <button type="button" class="mx-btn" disabled={state.busy}
          onClick={() => { const profile = state.profile; if (profile) void props.editor.open(profile) }}>
          {language.t("sf.teams.configRead")}
        </button>
      </Show>
      <Show when={state.status === "ready"}>
        <form onSubmit={(event) => { event.preventDefault(); void props.editor.save() }}>
          <fieldset disabled={disabled()} class="sf-team-config-fields">
            <label for={id + "-model"}>{language.t("sf.teams.configModel")}</label>
            <input id={id + "-model"} data-sf-config-model maxLength={512} autocomplete="off"
              value={state.document.settings.model ?? ""}
              onInput={(event) => props.editor.settings("model", event.currentTarget.value)} />
            <p>{language.t("sf.teams.configModelHelp")}</p>
            <label for={id + "-default"}>{language.t("sf.teams.configDefaultAgent")}</label>
            <input id={id + "-default"} data-sf-config-default-agent maxLength={64} autocomplete="off"
              value={state.document.settings.default_agent ?? ""}
              onInput={(event) => props.editor.settings("default_agent", event.currentTarget.value)} />
            <h4>{language.t("sf.teams.configAgents")}</h4>
            <div class="sf-team-config-agent-add">
              <label for={id + "-new"}>{language.t("sf.teams.configAgentId")}</label>
              <input id={id + "-new"} data-sf-config-agent-id value={ui.name} maxLength={64} autocomplete="off"
                onInput={(event) => setUi("name", event.currentTarget.value)} />
              <button type="button" class="mx-btn" data-sf-config-add-agent disabled={ids().length >= 100}
                onClick={add}>{language.t("sf.teams.configAddAgent")}</button>
            </div>
            <label for={id + "-agent"}>{language.t("sf.teams.configEditAgent")}</label>
            <select id={id + "-agent"} value={ui.agent} data-sf-config-agent
              onChange={(event) => setUi("agent", event.currentTarget.value)}>
              <option value="">{language.t("sf.teams.configSelectAgent")}</option>
              <For each={ids()}>{(name) => <option value={name}>{name}</option>}</For>
            </select>
            <Show when={selected()}>{(agent) => <div class="sf-team-config-agent">
              <label for={id + "-name"}>{language.t("sf.teams.configName")}</label>
              <input id={id + "-name"} value={agent().name ?? ""} maxLength={256}
                onInput={(event) => props.editor.agentText(ui.agent, "name", event.currentTarget.value)} />
              <label for={id + "-description"}>{language.t("sf.teams.configAgentDescription")}</label>
              <textarea id={id + "-description"} value={agent().description ?? ""} maxLength={2048} rows={2}
                onInput={(event) => props.editor.agentText(ui.agent, "description", event.currentTarget.value)} />
              <label for={id + "-instructions"}>{language.t("sf.teams.configInstructions")}</label>
              <textarea id={id + "-instructions"} data-sf-config-instructions value={agent().system ?? ""} maxLength={16384} rows={6}
                onInput={(event) => props.editor.agentText(ui.agent, "system", event.currentTarget.value)} />
              <label for={id + "-agent-model"}>{language.t("sf.teams.configModel")}</label>
              <input id={id + "-agent-model"} value={agent().model ?? ""} maxLength={512} autocomplete="off"
                onInput={(event) => props.editor.agentText(ui.agent, "model", event.currentTarget.value)} />
              <label for={id + "-variant"}>{language.t("sf.teams.configVariant")}</label>
              <input id={id + "-variant"} value={agent().variant ?? ""} maxLength={256} autocomplete="off"
                onInput={(event) => props.editor.agentText(ui.agent, "variant", event.currentTarget.value)} />
              <label for={id + "-mode"}>{language.t("sf.teams.configMode")}</label>
              <select id={id + "-mode"} value={agent().mode ?? ""}
                onChange={(event) => props.editor.agentMode(ui.agent, event.currentTarget.value)}>
                <option value="">{language.t("sf.teams.configUnset")}</option>
                <option value="primary">{language.t("sf.teams.configPrimary")}</option>
                <option value="subagent">{language.t("sf.teams.configSubagent")}</option>
                <option value="all">{language.t("sf.teams.configAll")}</option>
              </select>
              <label><input type="checkbox" checked={agent().hidden ?? false}
                onChange={(event) => props.editor.agentFlag(ui.agent, "hidden", event.currentTarget.checked)} />
                {language.t("sf.teams.configHidden")}</label>
              <label><input type="checkbox" checked={agent().disabled ?? false}
                onChange={(event) => props.editor.agentFlag(ui.agent, "disabled", event.currentTarget.checked)} />
                {language.t("sf.teams.configDisabled")}</label>
              <button type="button" class="mx-btn" onClick={() => {
                props.editor.removeAgent(ui.agent); setUi("agent", "")
              }}>{language.t("sf.teams.configRemoveAgent")}</button>
            </div>}</Show>
            <button type="submit" class="mx-btn" data-sf-config-save disabled={state.revision === undefined}>
              {language.t("sf.teams.configSave")}
            </button>
          </fieldset>
        </form>
      </Show>
    </section>
  </Show>
}
