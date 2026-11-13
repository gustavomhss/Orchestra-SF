import { Sucafina } from "@orchestra/schema/sucafina"
import { Option, Schema } from "effect"
import { batch, createEffect, createMemo, createSignal, createUniqueId, For, Index, Match, onCleanup, onMount, Show, Switch, untrack } from "solid-js"
import type { JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import type { Controller } from "./contract"
import "./native-commands.css"

export type NativeCommandControls = {
  save: () => void
  navigate: (run: () => void) => void
  label: () => string | undefined
}

type Path = readonly (string | number)[]
type Action = Sucafina.NativeAction
type Field = Sucafina.NativeField
type Editor = {
  read: (path: Path) => unknown
  change: (path: Path, value: unknown, omit?: boolean) => void
  disabled: () => boolean
  text: (value: Sucafina.NativeText) => string
  copy: (en: string, br: string) => string
}

export function NativeCommands(props: { controller: Controller; onControls: (controls: NativeCommandControls | undefined) => void }): JSX.Element {
  const language = useLanguage()
  const copy = (en: string, br: string) => language.locale() === "br" ? br : en
  const text = (value: Sucafina.NativeText) => language.locale() === "br" ? value.br : value.en
  const state = () => props.controller.state()
  const page = createMemo(() => state().page)
  const [selection, setSelection] = createSignal<{ key: string; fingerprint: string; fields: readonly Field[] }>()
  const [problem, setProblem] = createSignal(false)
  const [pending, setPending] = createSignal<{ message: string; run: () => void }>()
  const refs: { form?: HTMLFormElement } = {}
  const actions = createMemo(() => {
    const current = page()
    if (!current || !current.actor.canWrite || !current.pages.includes(current.page)) return []
    const decoded = Schema.decodeUnknownOption(Schema.Array(Sucafina.NativeAction), { onExcessProperty: "error" })(current.actions ?? [])
    if (Option.isNone(decoded)) return []
    const result = decoded.value
    if (new Set(result.map((action) => action.key)).size !== result.length || result.some((action) =>
      !action.key || action.command.page !== current.page || !Number.isSafeInteger(action.command.version) || action.command.version < 0 || !safeJson(action.command.values) ||
      !validFields(action.fields, action.command.values))) return []
    return result
  })
  const active = createMemo(() => {
    const selected = selection()
    return selected ? actions().find((action) => action.key === selected.key && fingerprint(action) === selected.fingerprint) : undefined
  })
  const busy = () => state().loading || state().saving
  const command = () => {
    const action = active()
    const draft = state().draft
    return action && draft && draft.page === action.command.page && draft.action === action.command.action && draft.id === action.command.id ? draft : undefined
  }

  // Defaults and CAS belong to the admitted draft, never to a later descriptor refresh.
  createEffect(() => {
    const selected = selection()
    if (!selected) return
    const permitted = active()
    const draft = state().draft
    if (permitted && command()) return
    untrack(() => {
      batch(() => {
        setSelection(undefined)
        setPending(undefined)
        setProblem(false)
      })
      if (draft) void props.controller.discardDraft()
    })
  })

  function choose(key: string) {
    if (busy() || key === selection()?.key) return
    navigate(() => {
      const action = actions().find((item) => item.key === key)
      if (!action) return
      batch(() => {
        setSelection({ key, fingerprint: fingerprint(action), fields: action.fields })
        setProblem(false)
        props.controller.edit({ ...action.command, confirmed: false })
      })
    })
  }

  function navigate(run: () => void) {
    if (state().saving || pending()) return
    if (!state().draft) {
      run()
      return
    }
    setPending({
      message: copy("Discard unsaved changes and continue?", "Descartar alterações não salvas e continuar?"),
      run: () => {
        batch(() => {
          setSelection(undefined)
          setProblem(false)
          void props.controller.discardDraft()
          run()
        })
      },
    })
  }

  function save() {
    const action = active()
    const draft = command()
    if (!action || !draft || busy() || pending()) return
    if (problem()) { refs.form?.reportValidity(); return }
    if (!refs.form?.reportValidity() || !validValues(action.fields, draft.values)) {
      setProblem(true)
      return
    }
    setProblem(false)
    const submit = (confirmed: boolean) => {
      // Recheck after a dialog: permission withdrawal must invalidate its captured command.
      const current = active()
      if (!current || fingerprint(current) !== fingerprint(action) || command() !== draft || busy()) return
      props.controller.edit({ ...draft, confirmed })
      void props.controller.save()
    }
    if (action.confirm) {
      setPending({ message: text(action.confirm), run: () => submit(true) })
      return
    }
    submit(false)
  }

  const editor: Editor = {
    read: (path) => own(command()?.values, path).value,
    change: (path, value, omit = false) => {
      const draft = command()
      if (!draft || busy() || pending()) return
      const values = structuredClone(draft.values)
      if (!replace(values, path, value, omit)) {
        setProblem(true)
        return
      }
      const decoded = Schema.decodeUnknownOption(Sucafina.Command)({ ...draft, values, confirmed: false })
      if (Option.isNone(decoded)) {
        setProblem(true)
        return
      }
      props.controller.edit(decoded.value)
      setProblem(false)
    },
    disabled: () => busy() || !!pending() || !command(),
    text,
    copy,
  }
  const controls: NativeCommandControls = { save, navigate, label: () => active() ? text(active()!.label) : undefined }
  onMount(() => props.onControls(controls))
  onCleanup(() => props.onControls(undefined))

  return (
    <>
      <Show when={actions().length > 0}>
        <section class="mx-card sf-native-commands" data-sf-native-commands aria-label={copy("Actions", "Ações")}>
          <label class="mx-field">
            <span>{copy("Action", "Ação")}</span>
            <select value={selection()?.key ?? ""} disabled={busy()} onChange={(event) => {
              const key = event.currentTarget.value
              // The controlled selection must also return to its old value when a dialog is cancelled.
              event.currentTarget.value = selection()?.key ?? ""
              if (key) choose(key)
            }}>
              <option value="" disabled>{copy("Choose an action", "Escolha uma ação")}</option>
              <For each={actions()}>{(action) => <option value={action.key}>{action.group ? `${text(action.group)} · ` : ""}{text(action.label)}</option>}</For>
            </select>
          </label>
          <Show when={active() && command()}>
            <form aria-label={active() ? text(active()!.label) : undefined} data-sf-action={selection()?.key} classList={{ "sf-native-command-danger": active()?.danger === true }} ref={(element) => { refs.form = element }} onSubmit={(event) => { event.preventDefault(); save() }} aria-busy={busy()}>
              <h2>{active() ? text(active()!.label) : ""}</h2>
              <Fields fields={selection()?.fields ?? []} prefix={[]} editor={editor} readOnly={false} />
              <Show when={problem()}><p role="alert">{copy("Check the required fields, values and list limits.", "Verifique os campos obrigatórios, os valores e os limites das listas.")}</p></Show>
            </form>
          </Show>
        </section>
      </Show>
      <Show when={pending()} keyed>{(request) => (
        <Confirmation message={request.message} copy={copy} cancel={() => setPending(undefined)} accept={() => {
          setPending(undefined)
          request.run()
        }} />
      )}</Show>
    </>
  )
}

function Fields(props: { fields: readonly Field[]; prefix: Path; editor: Editor; readOnly: boolean }): JSX.Element {
  return <div class="sf-native-command-fields">
    <For each={props.fields}>{(field) => {
      if (field.kind === "group")
        return <fieldset><Show when={field.label}>{(label) => <legend>{props.editor.text(label())}</legend>}</Show><Fields fields={field.fields} prefix={props.prefix} editor={props.editor} readOnly={props.readOnly} /></fieldset>
      if (field.kind === "list")
        return <ListField field={field} prefix={props.prefix} editor={props.editor} readOnly={props.readOnly} />
      return <ScalarField field={field} prefix={props.prefix} editor={props.editor} readOnly={props.readOnly} />
    }}</For>
  </div>
}

function ScalarField(props: { field: Sucafina.NativeScalar; prefix: Path; editor: Editor; readOnly: boolean }): JSX.Element {
  const id = createUniqueId()
  const path = () => [...props.prefix, ...props.field.path]
  const value = () => props.editor.read(path())
  const display = () => typeof value() === "string" || typeof value() === "number" ? String(value()) : ""
  const disabled = () => props.readOnly || props.field.readOnly === true || props.editor.disabled()
  const input = (raw: string) => {
    if (disabled()) return
    if (raw === "") {
      props.editor.change(path(), props.field.blank === "null" ? null : "", props.field.blank === "omit")
      return
    }
    if (props.field.kind !== "number") {
      props.editor.change(path(), raw)
      return
    }
    if (Number.isFinite(Number(raw))) props.editor.change(path(), Number(raw))
  }
  return <label class="mx-field" for={id}>
    <span>{props.editor.text(props.field.label)}{props.field.required ? " *" : ""}</span>
    <Switch fallback={
      <input id={id} type={props.field.kind === "number" ? "number" : props.field.kind === "date" ? "date" : "text"}
        value={display()} disabled={disabled()} required={props.field.required} min={props.field.min} max={props.field.max}
        step={props.field.step ?? (props.field.kind === "number" ? "any" : undefined)}
        onInput={(event) => { if (!event.currentTarget.validity.badInput) input(event.currentTarget.value) }} />
    }>
      <Match when={props.field.kind === "textarea"}>
        <textarea id={id} value={display()} disabled={disabled()} required={props.field.required} onInput={(event) => input(event.currentTarget.value)} />
      </Match>
      <Match when={props.field.kind === "checkbox"}>
        <input id={id} type="checkbox" checked={value() === true} disabled={disabled()} required={props.field.required}
          onChange={(event) => { if (!disabled()) props.editor.change(path(), event.currentTarget.checked) }} />
      </Match>
      <Match when={props.field.kind === "select"}>
        <select id={id} disabled={disabled()} required={props.field.required}
          value={String(props.field.options?.findIndex((option) => Object.is(option.value, value())) ?? -1)}
          onChange={(event) => {
            if (disabled()) return
            if (event.currentTarget.value === "-1" && !props.field.required && props.field.blank !== undefined) {
              input("")
              return
            }
            if (!/^(0|[1-9][0-9]*)$/.test(event.currentTarget.value)) return
            const option = props.field.options?.[Number(event.currentTarget.value)]
            if (option) props.editor.change(path(), option.value)
          }}>
          <option value="-1" disabled={props.field.required || props.field.blank === undefined}>{props.editor.copy("Choose a value", "Escolha um valor")}</option>
          <For each={props.field.options}>{(option, index) => <option value={String(index())}>{props.editor.text(option.label)}</option>}</For>
        </select>
      </Match>
    </Switch>
  </label>
}

function ListField(props: { field: Sucafina.NativeList; prefix: Path; editor: Editor; readOnly: boolean }): JSX.Element {
  const path = () => [...props.prefix, ...props.field.path]
  const rows = () => {
    const value = props.editor.read(path())
    return Array.isArray(value) ? value as unknown[] : []
  }
  const readonly = () => props.readOnly || props.field.readOnly === true
  const disabled = () => readonly() || props.editor.disabled()
  return <fieldset class="sf-native-command-list">
    <legend>{props.editor.text(props.field.label)}</legend>
    <Index each={rows()}>{(_row, index) => <div class="sf-native-command-row">
      <span class="mx-meta">{props.editor.copy("Row", "Linha")} {index + 1}</span>
      <Fields fields={props.field.fields} prefix={[...path(), index]} editor={props.editor} readOnly={readonly()} />
      <Show when={props.field.remove === true && !readonly()}>
        <button type="button" class="mx-btn" disabled={disabled() || rows().length <= (props.field.minimum ?? 0)}
          aria-label={`${props.editor.copy("Remove row", "Remover linha")} ${index + 1}: ${props.editor.text(props.field.label)}`}
          onClick={() => {
            if (disabled() || props.field.remove !== true || rows().length <= (props.field.minimum ?? 0)) return
            props.editor.change(path(), rows().filter((_, current) => current !== index))
          }}>{props.editor.copy("Remove", "Remover")}</button>
      </Show>
    </div>}</Index>
    <Show when={props.field.add !== undefined && !readonly()}>
      <button type="button" class="mx-btn" disabled={disabled() || rows().length >= (props.field.maximum ?? Infinity)} onClick={() => {
        if (disabled() || props.field.add === undefined || rows().length >= (props.field.maximum ?? Infinity)) return
        props.editor.change(path(), [...rows(), structuredClone(props.field.add)])
      }}>{props.editor.copy("Add row", "Adicionar linha")}</button>
    </Show>
  </fieldset>
}

function Confirmation(props: { message: string; copy: Editor["copy"]; cancel: () => void; accept: () => void }): JSX.Element {
  const id = createUniqueId()
  let dialog!: HTMLDialogElement
  onMount(() => dialog.showModal())
  onCleanup(() => { if (dialog.open) dialog.close() })
  return <dialog ref={dialog} class="mx-dialog sf-native-command-confirm" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`}
    on:keydown={(event) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      props.cancel()
    }}
    onCancel={(event) => { event.preventDefault(); props.cancel() }}>
    <h2 id={`${id}-title`}>{props.copy("Confirm", "Confirmar")}</h2>
    <p id={`${id}-message`}>{props.message}</p>
    <div class="mx-meta">
      <button type="button" class="mx-btn" autofocus onClick={props.cancel}>{props.copy("Cancel", "Cancelar")}</button>
      <button type="button" class="mx-btn primary" onClick={props.accept}>{props.copy("Yes, continue", "Sim, continuar")}</button>
    </div>
  </dialog>
}

function fingerprint(action: Action) {
  return JSON.stringify([action.key, action.command.page, action.command.action, action.command.id, action.target, action.fields, action.confirm, action.danger])
}

function safeJson(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (Array.isArray(value)) return Array.from({ length: value.length }, (_, index) => Object.hasOwn(value, index) && safeJson(value[index])).every(Boolean)
  return record(value) && Object.keys(value).every((key) => safeKey(key) && safeJson(value[key]))
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function safeKey(key: string | number) {
  return typeof key === "number" ? Number.isSafeInteger(key) && key >= 0 : !["__proto__", "prototype", "constructor"].includes(key)
}

function own(root: unknown, path: Path): { valid: boolean; value?: unknown } {
  if (!path.length || path.some((key) => !safeKey(key))) return { valid: false }
  return path.reduce<{ valid: boolean; value?: unknown }>((current, key, index) => {
    if (!current.valid) return current
    const parent = current.value
    if (Array.isArray(parent)) {
      if (typeof key !== "number" || key >= parent.length || !Object.hasOwn(parent, key)) return { valid: false }
      return { valid: true, value: parent[key] }
    }
    if (!record(parent) || typeof key !== "string") return { valid: false }
    if (!Object.hasOwn(parent, key)) return { valid: index === path.length - 1 }
    return { valid: true, value: parent[key] }
  }, { valid: true, value: root })
}

function replace(root: unknown, path: Path, value: unknown, omit: boolean) {
  if (!own(root, path).valid) return false
  const parent = path.length === 1 ? root : own(root, path.slice(0, -1)).value
  const key = path[path.length - 1]
  if (Array.isArray(parent) && typeof key === "number" && !omit) {
    parent[key] = value
    return true
  }
  if (!record(parent) || typeof key !== "string") return false
  if (omit) delete parent[key]
  if (!omit) parent[key] = value
  return true
}

function validFields(fields: readonly Field[], values: unknown): boolean {
  const paths: Path[] = []
  function walk(items: readonly Field[]): boolean {
    return items.every((field) => {
      if (field.kind === "group") return walk(field.fields)
      // Overlapping editors could otherwise bypass a readonly ancestor or replace a sibling container.
      if (paths.some((path) => path.slice(0, Math.min(path.length, field.path.length)).every((key, index) => key === field.path[index]))) return false
      paths.push(field.path)
      const current = own(values, field.path)
      if (!current.valid) return false
      if (field.kind !== "list") return !(field.blank === "omit" && typeof field.path[field.path.length - 1] === "number") &&
        (field.min === undefined || field.max === undefined || field.min <= field.max) &&
        (field.step === undefined || field.step > 0) &&
        (field.kind !== "select" || (!!field.options && new Set(field.options.map((option) => JSON.stringify(option.value))).size === field.options.length))
      if (field.minimum !== undefined && field.maximum !== undefined && field.minimum > field.maximum) return false
      return Array.isArray(current.value) && current.value.every((row) => record(row) && validFields(field.fields, row)) &&
        (field.add === undefined || (safeJson(field.add) && validFields(field.fields, field.add)))
    })
  }
  return walk(fields)
}

function validValues(fields: readonly Field[], values: unknown): boolean {
  if (!validFields(fields, values)) return false
  return fields.every((field) => {
    if (field.kind === "group") return validValues(field.fields, values)
    const value = own(values, field.path).value
    if (field.kind === "list") return Array.isArray(value) && value.length >= (field.minimum ?? 0) && value.length <= (field.maximum ?? Infinity) && value.every((row) => validValues(field.fields, row))
    if (field.readOnly || (value === undefined && !field.required)) return true
    if (field.kind === "select") {
      if (!field.required && ((field.blank === "null" && value === null) || (field.blank === "empty" && value === ""))) return true
      return field.options?.some((option) => Object.is(option.value, value)) === true && (!field.required || (value !== null && value !== ""))
    }
    if (value === undefined || value === null || value === "") return !field.required
    if (field.kind === "checkbox") return typeof value === "boolean" && (!field.required || value)
    if (field.kind === "number") {
      if (typeof value !== "number" || !Number.isFinite(value) || value < (field.min ?? -Infinity) || value > (field.max ?? Infinity)) return false
      if (field.step === undefined) return true
      const steps = (value - (field.min ?? 0)) / field.step
      return Math.abs(steps - Math.round(steps)) <= 1e-8
    }
    if (typeof value !== "string") return false
    if (field.kind !== "date") return true
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + "T00:00:00Z")) && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  })
}
