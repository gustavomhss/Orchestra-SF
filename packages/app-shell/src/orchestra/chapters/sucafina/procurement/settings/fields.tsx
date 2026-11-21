import { For, Show, type JSX } from "solid-js"
import { useSfPresentation, sfCommonKey } from "../../shared/frame/presentation"
import type { SfCopyKey } from "../../shared/frame"
import type { Settings } from "./model"

type DirectoryEntry = Readonly<{ id: string; name: string }>
type Props = Readonly<{
  settings: Readonly<Settings>
  directory: readonly DirectoryEntry[]
  disabled: boolean
  onEdit: (next: Readonly<Settings>) => void
}>
type Numeric = string | number | null
const asText = (value: unknown): string => value == null ? "" : String(value)
const asLines = (value: string | readonly string[] | undefined): string =>
  Array.isArray(value) ? value.join("\n") : typeof value === "string" ? value : ""
const isChecked = (value: unknown): boolean => value === true || value === "true" || value === "on"
const numericInput = (raw: string): Numeric => {
  if (raw.trim() === "") return null // absence is never numeric zero
  const value = Number(raw)
  return Number.isFinite(value) ? value : raw // validation belongs to the producer
}

/** Exact CAP28 fieldnames only; no client policy/FX validator and no empty-to-zero coercion. */
export function SfProcurementSettingsFields(props: Props): JSX.Element {
  const { t } = useSfPresentation()
  const key = (name: string) => name as SfCopyKey
  const label = (name: string, id: string) => <label for={id}>{t(key(name))}</label>
  const edit = (name: keyof Settings, value: Settings[keyof Settings]) =>
    props.onEdit({ ...props.settings, [name]: value })
  const has = (name: keyof Settings) => Object.hasOwn(props.settings, name)
  const numberText = (value: Numeric | undefined) => value == null ? "" : String(value)
  const id = (group: string, field: string, index?: number) =>
    ["sf-u36", group, field, ...(index === undefined ? [] : [index])].join("-")
  const scalar = (
    name: keyof Settings, copyKey: string, kind: "text" | "number" | "date" | "textarea",
  ): JSX.Element => (
    <Show when={has(name)}>
      <div class="sf-n21-field">
        {label(copyKey, id("field", name))}
        <Show when={kind !== "textarea"} fallback={
          <textarea id={id("field", name)} rows={3} disabled={props.disabled}
            value={asLines(props.settings[name] as string | readonly string[] | undefined)}
            onInput={(event) => edit(name, event.currentTarget.value)}
          />
        }>
          <input id={id("field", name)} type={kind} step={kind === "number" ? "any" : undefined}
            disabled={props.disabled} value={asText(props.settings[name])}
            onInput={(event) => edit(name, kind === "number"
              ? numericInput(event.currentTarget.value)
              : event.currentTarget.value)}
          />
        </Show>
      </div>
    </Show>
  )
  const toggle = (name: "blockSelfApproval" | "requireActiveSupplier", copyKey: string) => (
    <Show when={has(name)}>
      <label class="sf-n21-checkbox">
        <input type="checkbox" disabled={props.disabled} checked={isChecked(props.settings[name])}
          onChange={(event) => edit(name, event.currentTarget.checked)} />
        <span>{t(key(copyKey))}</span>
      </label>
    </Show>
  )
  const changeLevel = (index: number, patch: Partial<NonNullable<Settings["levels"]>[number]>) => {
    const list = props.settings.levels
    if (list) edit("levels", list.map((row, i) => i === index ? { ...row, ...patch } : row))
  }
  const changeRate = (index: number, patch: Partial<NonNullable<Settings["fxRates"]>[number]>) => {
    const list = props.settings.fxRates
    if (list) edit("fxRates", list.map((row, i) => i === index ? { ...row, ...patch } : row))
  }
  const changeCriterion = (name: "criteria" | "commCriteria", index: number,
    patch: Partial<NonNullable<Settings["criteria"]>[number]>) => {
    const list = props.settings[name]
    if (list) edit(name, list.map((row, i) => i === index ? { ...row, ...patch } : row))
  }
  const add = (name: "levels" | "fxRates" | "criteria" | "commCriteria") => {
    if (props.disabled || !has(name)) return
    switch (name) {
      case "levels": edit(name, [
        ...(props.settings.levels ?? []), { id: crypto.randomUUID(), name: "", threshold: null, holderId: null },
      ]); break
      case "fxRates": edit(name, [...(props.settings.fxRates ?? []), { code: "", rate: null }]); break
      case "criteria": edit(name, [...(props.settings.criteria ?? []), { name: "", weight: null }]); break
      case "commCriteria": edit(name, [...(props.settings.commCriteria ?? []), { name: "", weight: null, auto: false }]); break
    }
  }
  const remove = (name: "levels" | "fxRates" | "criteria" | "commCriteria", index: number) => {
    if (props.disabled || !has(name)) return
    if (name === "levels") {
      if (props.settings.levels && props.settings.levels.length > 1)
        edit(name, props.settings.levels.filter((_, i) => i !== index))
    } else if (name === "fxRates") {
      edit(name, (props.settings.fxRates ?? []).filter((_, i) => i !== index))
    } else {
      const list = props.settings[name]
      const row = list?.[index]
      if (row && ("auto" in row) && isChecked(row.auto)) return
      if (list) edit(name, list.filter((_, i) => i !== index))
    }
  }
  const addButton = (name: "levels" | "fxRates" | "criteria" | "commCriteria") => (
    <Show when={has(name)}>
      <button class="mx-btn" type="button" disabled={props.disabled} onClick={() => add(name)}>
        {t(key("sf.u36.add"))}
      </button>
    </Show>
  )
  const removeButton = (name: "levels" | "fxRates" | "criteria" | "commCriteria",
    index: number, disabled = false) => (
    <button class="mx-btn sf-n21-remove" type="button" disabled={props.disabled || disabled}
      onClick={() => remove(name, index)}>
      {t(key("sf.u36.remove"))}
    </button>
  )
  return (
    <div class="sf-n21-settings-groups">
      <nav class="sf-n21-settings-nav" aria-label={t(key("sf.cap28.title"))}>
        <a href="#sf-procurement-settings-general">{t(key("sf.u36.general"))}</a>
        <a href="#sf-procurement-settings-matrix">{t(key("sf.u36.matrix"))}</a>
        <a href="#sf-procurement-settings-currencies">{t(key("sf.u36.currencies"))}</a>
        <a href="#sf-procurement-settings-criteria">{t(key("sf.u36.technical"))}</a>
        <a href="#sf-procurement-settings-commCriteria">{t(key("sf.u36.commercial"))}</a>
        <a href="#sf-procurement-settings-payments">{t(key("sf.u36.payments"))}</a>
        <a href="#sf-procurement-settings-attachments">{t(key("sf.u36.attachments"))}</a>
      </nav>
      <fieldset class="sf-n21-fieldset" id="sf-procurement-settings-general">
        <legend>{t(key("sf.u36.general"))}</legend>
        <div class="sf-n21-field-grid">
          {scalar("currency", "sf.u36.currency", "text")}
          <Show when={has("prApprovalMode")}>
            <div class="sf-n21-field">
              {label("sf.u36.mode", "sf-u36-mode")}
              <select id="sf-u36-mode" disabled={props.disabled} value={props.settings.prApprovalMode ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  if (value === "first" || value === "matrix") edit("prApprovalMode", value)
                }}>
                <option value="first">{t(key("sf.u36.first"))}</option>
                <option value="matrix">{t(key("sf.u36.matrixOption"))}</option>
              </select>
            </div>
          </Show>
          {scalar("minQuotes", "sf.u36.minimum", "number")}
          {scalar("techWeight", "sf.u36.techWeight", "number")}
          {scalar("commWeight", "sf.u36.commWeight", "number")}
          {toggle("blockSelfApproval", "sf.u36.self")}
          {toggle("requireActiveSupplier", "sf.u36.active")}
        </div>
      </fieldset>
      <fieldset class="sf-n21-fieldset" id="sf-procurement-settings-attachments">
        <legend>{t(key("sf.u36.attachments"))}</legend>
        <div class="sf-n21-field-grid">
          {scalar("uploadCap", "sf.u36.upload", "number")}
          {scalar("reminderDays", "sf.u36.reminder", "number")}
          {scalar("escalationDays", "sf.u36.escalation", "number")}
        </div>
      </fieldset>
      <fieldset class="sf-n21-fieldset" id="sf-procurement-settings-matrix">
        <legend>{t(key("sf.u36.matrix"))}</legend>
        <div class="sf-n21-repeat">
          <For each={props.settings.levels ?? []}>{(row, index) => (
            <div class="sf-n21-repeat-row">
              <div class="sf-n21-field">
                {label("sf.u36.name", id("level", "name", index()))}
                <input id={id("level", "name", index())} type="text" value={row.name}
                  disabled={props.disabled}
                  onInput={(event) => changeLevel(index(), { name: event.currentTarget.value })} />
              </div>
              <div class="sf-n21-field">
                {label("sf.u36.threshold", id("level", "threshold", index()))}
                <input id={id("level", "threshold", index())} type="number" step="any"
                  value={numberText(row.threshold)} disabled={props.disabled}
                  onInput={(event) => changeLevel(index(), {
                    threshold: event.currentTarget.value === "" ? null : event.currentTarget.value,
                  })} />
              </div>
              <div class="sf-n21-field">
                {label("sf.u36.holder", id("level", "holder", index()))}
                <select id={id("level", "holder", index())} value={row.holderId ?? ""}
                  disabled={props.disabled}
                  onChange={(event) => changeLevel(index(), { holderId: event.currentTarget.value || null })}>
                  <option value="">{t(key("sf.u36.unassigned"))}</option>
                  <Show when={row.holderId && !props.directory.some((person) => person.id === row.holderId)}>
                    <option value={row.holderId!}>{t(sfCommonKey("sf.common.unknown"))}</option>
                  </Show>
                  <For each={props.directory}>{(person) => <option value={person.id}>{person.name}</option>}</For>
                </select>
              </div>
              {removeButton("levels", index(), (props.settings.levels?.length ?? 0) <= 1)}
            </div>
          )}</For>
          {addButton("levels")}
        </div>
      </fieldset>
      <fieldset class="sf-n21-fieldset" id="sf-procurement-settings-currencies">
        <legend>{t(key("sf.u36.currencies"))}</legend>
        <div class="sf-n21-repeat">
          <For each={props.settings.fxRates ?? []}>{(rate, index) => (
            <div class="sf-n21-repeat-row">
              <div class="sf-n21-field">
                {label("sf.u36.code", id("fx", "code", index()))}
                <input id={id("fx", "code", index())} type="text" value={rate.code}
                  disabled={props.disabled}
                  onInput={(event) => changeRate(index(), { code: event.currentTarget.value })} />
              </div>
              <div class="sf-n21-field">
                {label("sf.u36.rate", id("fx", "rate", index()))}
                <input id={id("fx", "rate", index())} type="number" step="any"
                  value={numberText(rate.rate)} disabled={props.disabled}
                  onInput={(event) => changeRate(index(), {
                    rate: event.currentTarget.value === "" ? null : event.currentTarget.value,
                  })} />
              </div>
              {removeButton("fxRates", index())}
            </div>
          )}</For>
          {addButton("fxRates")}
        </div>
        {scalar("fxUpdated", "sf.u36.rateDate", "date")}
      </fieldset>
      <For each={["criteria", "commCriteria"] as const}>{(group) => (
        <fieldset class="sf-n21-fieldset" id={"sf-procurement-settings-" + group}>
          <legend>{t(key(group === "criteria" ? "sf.u36.technical" : "sf.u36.commercial"))}</legend>
          <div class="sf-n21-repeat">
            <For each={props.settings[group] ?? []}>{(criterion, index) => (
              <div class="sf-n21-repeat-row">
                <div class="sf-n21-field">
                  {label("sf.u36.name", id(group, "name", index()))}
                  <input id={id(group, "name", index())} type="text"
                    disabled={props.disabled} value={criterion.name ?? ""}
                    onInput={(event) => changeCriterion(group, index(), { name: event.currentTarget.value })} />
                </div>
                <div class="sf-n21-field">
                  {label("sf.u36.weight", id(group, "weight", index()))}
                  <input id={id(group, "weight", index())} type="number" step="any"
                    disabled={props.disabled} value={numberText(criterion.weight)}
                    onInput={(event) => changeCriterion(group, index(), {
                      weight: event.currentTarget.value === "" ? null : event.currentTarget.value,
                    })} />
                </div>
                <Show when={group === "commCriteria" && ("auto" in criterion)}>
                  <label class="sf-n21-checkbox">
                    <input type="checkbox" checked={isChecked(criterion.auto)}
                      disabled={props.disabled || isChecked(criterion.auto)}
                      onChange={(event) => changeCriterion(group, index(), { auto: event.currentTarget.checked })} />
                    <span>{t(key("sf.u36.auto"))}</span>
                  </label>
                </Show>
                {removeButton(group, index(), ("auto" in criterion) && isChecked(criterion.auto))}
              </div>
            )}</For>
            {addButton(group)}
          </div>
        </fieldset>
      )}</For>
      <fieldset class="sf-n21-fieldset" id="sf-procurement-settings-payments">
        <legend>{t(key("sf.u36.payments"))}</legend>
        <div class="sf-n21-field-grid">
          {scalar("paymentTerms", "sf.u36.paymentTerms", "textarea")}
          {scalar("categories", "sf.u36.categories", "textarea")}
          {scalar("incoterms", "sf.u36.incoterms", "textarea")}
          {scalar("billingAddress", "sf.u36.invoice", "textarea")}
          {scalar("defaultDeliveryAddress", "sf.u36.delivery", "textarea")}
        </div>
      </fieldset>
    </div>
  )
}
