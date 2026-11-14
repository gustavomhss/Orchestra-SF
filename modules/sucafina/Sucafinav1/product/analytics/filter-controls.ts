import type { PortResult } from "../contracts/ports.ts"
import type { ApprovedFilter } from "./approved-catalog.ts"

export type BiFilterControls = {
  options: readonly { field: "stage" | "holder" | "buyer"; label: string; values: readonly { value: string; label: string }[] }[]
  selected: readonly ApprovedFilter[]
  /** The host issues a new authorized selection and replaces the projection before returning ok. */
  apply: (filters: readonly ApprovedFilter[]) => Promise<PortResult<void>>
}

/** Choices come from the current domain scope. This component never filters or counts records. */
export function renderBiFilters(input: BiFilterControls) {
  const options = structuredClone(input.options)
  const selected = structuredClone(input.selected)
  const controls = document.createElement("fieldset")
  controls.style.minWidth = "0"
  controls.style.display = "flex"
  controls.style.flexWrap = "wrap"
  controls.style.gap = "0.75rem"
  const legend = document.createElement("legend")
  legend.textContent = "Filtros autorizados de pedidos"
  controls.append(legend)
  const status = document.createElement("p")
  status.setAttribute("role", "status")
  status.setAttribute("aria-live", "polite")
  if (!options.length || new Set(options.map((option) => option.field)).size !== options.length || options.some((option) => !["stage", "holder", "buyer"].includes(option.field) || !option.label.trim() || new Set(option.values.map((item) => item.value)).size !== option.values.length || option.values.some((item) => !item.value.trim() || !item.label.trim())) || new Set(selected.map((filter) => filter.field)).size !== selected.length || selected.some((filter) => !options.some((option) => option.field === filter.field && filter.values.every((value) => option.values.some((item) => item.value === value))))) {
    status.textContent = "Filtros indisponíveis. Atualize a seleção no domínio."
    controls.append(status)
    return controls
  }
  const fields = options.map((option) => {
    const label = document.createElement("label")
    label.textContent = option.label
    const select = document.createElement("select")
    select.multiple = true
    select.setAttribute("aria-label", option.label)
    select.style.maxWidth = "100%"
    for (const entry of option.values) {
      const item = document.createElement("option")
      item.value = entry.value
      item.textContent = entry.label
      item.selected = selected.some((filter) => filter.field === option.field && filter.values.includes(entry.value))
      select.append(item)
    }
    label.append(select)
    controls.append(label)
    return { field: option.field, select }
  })
  const submit = document.createElement("button")
  submit.type = "button"
  submit.textContent = "Aplicar filtros"
  submit.addEventListener("click", async () => {
    if (submit.disabled) return
    const filters = fields.flatMap((entry) => {
      const values = [...entry.select.selectedOptions].map((option) => option.value)
      return values.length ? [{ field: entry.field, values }] : []
    })
    submit.disabled = true
    status.textContent = "Atualizando seleção autorizada…"
    const result = await input.apply(filters).catch(() => ({ status: "unavailable" as const, reason: "filter-request-failed" }))
    submit.disabled = false
    status.textContent = result.status === "ok" ? "Filtros aplicados pelo domínio." : result.status === "denied" ? "Acesso alterado. Reabra os pedidos autorizados." : "Não foi possível aplicar. Atualize a seleção e tente novamente."
  })
  controls.append(submit, status)
  return controls
}
