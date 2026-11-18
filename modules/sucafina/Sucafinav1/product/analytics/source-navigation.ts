import { canonicalSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ProjectionValue } from "../contracts/context.ts"
import type { BiSelection } from "./catalog.ts"

export type BiSourceChoice = { label: string; selection: BiSelection }

/** A producer's singular drilldown is explicit; multiple origins require an explicit human choice. */
export function biSourceChoices(row: ProjectionValue, selection: BiSelection): BiSourceChoice[] {
  const refs = row.drilldown ? [row.drilldown] : row.sourceRefs.filter((ref, index, all) => all.findIndex((candidate) => canonicalSfValue(candidate) === canonicalSfValue(ref)) === index)
  return refs.map((reference, index) => ({
    // A/B identify the displayed options, not a financial baseline/candidate inferred from array order.
    label: refs.length === 1 ? "origem" : `origem ${index < 26 ? String.fromCharCode(65 + index) : index + 1} · ${sourceLabel(reference)}`,
    selection: { ...selection, reference },
  }))
}

function sourceLabel(ref: BusinessEvidenceRef) {
  return ref.kind === "record" ? `${ref.target.recordType} ${ref.target.recordId} · v${ref.target.version}` : `${ref.kind} ${ref.refId}`
}

export function appendBiSourceButtons(container: HTMLElement, choices: readonly BiSourceChoice[], open: (selection: BiSelection) => void, singleLabel = "Abrir origem") {
  if (!choices.length) { container.textContent = "Indisponível"; return }
  for (const choice of choices) {
    const button = document.createElement("button")
    button.type = "button"
    button.setAttribute("data-bi-focus", choice.selection.valueId)
    button.setAttribute("data-bi-origin", choice.selection.reference!.refDigest)
    button.textContent = choices.length === 1 ? singleLabel : `Abrir ${choice.label}`
    button.addEventListener("click", () => open(choice.selection))
    container.append(button)
  }
}

/** A mark can reveal A/B choices without dispatching either origin or changing the financial value. */
export function createBiSourceChooser(container: HTMLElement, open: (selection: BiSelection) => void) {
  const chooser = document.createElement("fieldset")
  chooser.hidden = true
  chooser.style.minWidth = "0"
  chooser.setAttribute("data-bi-source-chooser", "")
  container.append(chooser)
  return (label: string, choices: readonly BiSourceChoice[], returnFocus: Element) => {
    if (choices.length === 1) { open(choices[0]!.selection); return }
    if (!choices.length) return
    chooser.replaceChildren()
    const legend = document.createElement("legend")
    legend.textContent = `Escolher origem de ${label}`
    chooser.setAttribute("aria-label", legend.textContent)
    chooser.append(legend)
    appendBiSourceButtons(chooser, choices, (selection) => { chooser.hidden = true; open(selection) })
    const cancel = document.createElement("button")
    cancel.type = "button"
    cancel.textContent = "Cancelar escolha de origem"
    const close = () => { chooser.hidden = true; if (returnFocus instanceof HTMLElement || returnFocus instanceof SVGElement) returnFocus.focus() }
    cancel.addEventListener("click", close)
    chooser.onkeydown = (event) => { if (event.key === "Escape") { event.preventDefault(); close() } }
    chooser.append(cancel)
    chooser.hidden = false
    chooser.querySelector("button")?.focus()
  }
}
