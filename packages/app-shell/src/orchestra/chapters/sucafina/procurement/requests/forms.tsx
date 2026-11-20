import { For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { sfU11Label, SF_U11_REMAINING_COPY } from "./copy"
import { postedPoLine, type SfPoEdit, type SfPoLine, type SfPrEdit } from "./model"

type Key = keyof typeof SF_U11_REMAINING_COPY
type PrField = Exclude<keyof SfPrEdit, "requesterName">
type PoField = Exclude<keyof SfPoEdit, "lines">
const prFields: readonly PrField[] = [
  "title", "type", "description", "estAmount", "costCenter", "needBy",
  "justification", "recurring", "frequency", "estAnnual", "expenseType", "category",
]
const poFields: readonly PoField[] = [
  "currency", "expenseType", "supplier", "supplierId", "description",
  "paymentTerms", "deliveryDate", "deliveryConditions", "contractRef",
  "incoterm", "incoterms", "assetRef", "supplierContact", "quoteRef",
  "billingAddress", "deliveryAddress", "acceptance", "warranty", "notes",
]
const lineFields = ["desc", "qty", "unitPrice", "unit", "notes"] as const satisfies readonly (keyof SfPoLine)[]
const tKey = (key: string) => key as Key
const textValue = (value: string | boolean | number | null | undefined) =>
  value === undefined || value === null ? "" : String(value)
type PrProps = Readonly<{
  value: SfPrEdit
  creating: boolean
  disabled: boolean
  onEdit: (updated: SfPrEdit) => void
}>
type PoProps = Readonly<{
  value: SfPoEdit
  disabled: boolean
  onEdit: (updated: SfPoEdit) => void
}>
function useCopy() {
  const language = useLanguage()
  return (key: Key) => sfU11Label(key, language.locale(), language.t(key as Parameters<typeof language.t>[0]))
}

export function SfRequisitionForm(props: PrProps) {
  const copy = useCopy()
  const edit = (key: PrField, value: SfPrEdit[PrField]) =>
    !props.disabled && props.onEdit({ ...props.value, [key]: value })
  return <fieldset class="sf-u11-fieldset" disabled={props.disabled} data-sf-pr-fields>
    <legend>{copy("sf.u11.remaining.pr")}</legend>
    <div class="sf-u11-fields">
      <For each={prFields.filter((field) => props.creating || field !== "title")}>{(field) => {
        const label = () => copy(tKey("sf.u11.remaining.field." + field))
        const value = () => props.value[field]
        return <label class="sf-u11-field" data-field={field}>
          <span>{label()}</span>
          <Show when={field === "recurring"} fallback={
            <Show when={field === "type" && props.creating} fallback={
              <Show when={field === "description" || field === "justification"} fallback={
                <input name={`pr.${field}`} type={field === "needBy" ? "date" :
                  field === "estAmount" || field === "estAnnual" ? "number" : "text"}
                  step={field === "estAmount" || field === "estAnnual" ? "any" : undefined}
                  required={props.creating && field === "title"}
                  value={textValue(value())}
                  onInput={(event) => edit(field, field === "estAmount" || field === "estAnnual" ?
                    event.currentTarget.value === "" ? null : event.currentTarget.valueAsNumber : event.currentTarget.value)} />
              }>
                <textarea name={`pr.${field}`} rows={3} value={textValue(value())}
                  onInput={(event) => edit(field, event.currentTarget.value)} />
              </Show>
            }>
              <select name="pr.type" value={textValue(value())} onChange={(event) => edit("type", event.currentTarget.value)}>
                <option value="">Choose…</option>
                <option value="product">product</option>
                <option value="service">service</option>
              </select>
            </Show>
          }>
            <input type="checkbox" checked={value() === true || value() === "true" || value() === "on"}
              onChange={(event) => edit("recurring", event.currentTarget.checked)} />
          </Show>
        </label>
      }}</For>
    </div>
    <p>{copy("sf.u11.remaining.submitSeparate")}</p>
    <Show when={!props.creating}>
      <p>{copy("sf.u11.remaining.noTitleMutation")}</p>
    </Show>
  </fieldset>
}

export function SfPurchaseOrderForm(props: PoProps) {
  const copy = useCopy()
  const edit = (key: PoField, value: SfPoEdit[PoField]) =>
    !props.disabled && props.onEdit({ ...props.value, [key]: value })
  const updateLine = (lineIndex: number, field: (typeof lineFields)[number], value: string | null) => {
    if (props.disabled || !Array.isArray(props.value.lines)) return
    props.onEdit({
      ...props.value,
      lines: props.value.lines.map((line, index) =>
        postedPoLine(index === lineIndex ? { ...line, [field]: value } : line)),
    })
  }
  const addLine = () => {
    if (props.disabled) return
    // Local row identity is an unsaved intent, not a producer ID/receipt.
    const draft: SfPoLine = { id: crypto.randomUUID(), desc: "", qty: "", unitPrice: "" }
    props.onEdit({ ...props.value, lines: [...(props.value.lines ?? []).map(postedPoLine), draft] })
  }
  const removeLine = (index: number) => {
    if (props.disabled || !props.value.lines) return
    props.onEdit({ ...props.value, lines: props.value.lines.filter((_, at) => at !== index).map(postedPoLine) })
  }
  return <fieldset class="sf-u11-fieldset" disabled={props.disabled} data-sf-po-fields>
    <legend>{copy("sf.u11.remaining.po")}</legend>
    <div class="sf-u11-fields">
      <For each={poFields}>{(field) =>
        <label class="sf-u11-field" data-field={field}>
          <span>{copy(tKey("sf.u11.remaining.field." + field))}</span>
          <Show when={field === "description" || field === "deliveryConditions" ||
            field === "acceptance" || field === "warranty" || field === "notes" ||
            field === "billingAddress" || field === "deliveryAddress"} fallback={
            <input type={field === "deliveryDate" ? "date" : "text"}
              value={textValue(props.value[field])}
              onInput={(event) => edit(field, event.currentTarget.value)} />
          }>
            <textarea rows={3} value={textValue(props.value[field])}
              onInput={(event) => edit(field, event.currentTarget.value)} />
          </Show>
        </label>
      }</For>
    </div>
    <section aria-label={copy("sf.u11.remaining.field.lines")} data-sf-po-lines>
      <h3>{copy("sf.u11.remaining.field.lines")}</h3>
      <Show when={Array.isArray(props.value.lines)}
        fallback={<p role="alert">{copy("sf.u11.remaining.invalidPo")}</p>}>
        <For each={props.value.lines}>{(line, index) =>
          <fieldset class="sf-u11-line" data-sf-line-ref={line.id ?? undefined}>
            <legend>{line.id ?? String(index() + 1)}</legend>
            <div class="sf-u11-fields">
              <For each={lineFields}>{(field) =>
                <label class="sf-u11-field" data-field={field}>
                  <span>{copy(tKey("sf.u11.remaining.field." + field))}</span>
                  <input
                    type={field === "qty" || field === "unitPrice" ? "number" : "text"}
                    step={field === "qty" || field === "unitPrice" ? "any" : undefined}
                    value={textValue(line[field])}
                    onInput={(event) => updateLine(index(), field,
                      (field === "qty" || field === "unitPrice") && event.currentTarget.value === ""
                        ? null : event.currentTarget.value)} />
                </label>
              }</For>
            </div>
            <button class="mx-btn danger" type="button" onClick={() => removeLine(index())}>
              {copy("sf.u11.remaining.removeLine")}
            </button>
          </fieldset>
        }</For>
      </Show>
      <button class="mx-btn" type="button" onClick={addLine}>
        {copy("sf.u11.remaining.addLine")}
      </button>
    </section>
    <p>{copy("sf.u11.remaining.submitSeparate")}</p>
  </fieldset>
}
