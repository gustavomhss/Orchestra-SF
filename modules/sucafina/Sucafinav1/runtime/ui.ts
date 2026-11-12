import { esc } from "../src/screen-shell.ts"
import type { Actor, Snapshot } from "./contract.ts"

export type RenderContext = {
  actor: Actor
  year: number
  month: number
  at: string
  versions: Snapshot["versions"]
}
export type Field = {
  name: string
  label: string
  type?: "text" | "number" | "date" | "email" | "checkbox" | "textarea" | "select"
  value?: unknown
  options?: readonly string[]
  min?: number
  max?: number
  step?: string
  required?: boolean
  readonly?: boolean
}

export function fields(items: Field[]): string {
  return items
    .map((field) => {
      const value = field.value == null ? "" : String(field.value)
      const attrs = `${field.required ? " required" : ""}${field.readonly ? " disabled" : ""}${field.min == null ? "" : ` min="${field.min}"`}${field.max == null ? "" : ` max="${field.max}"`}${field.step ? ` step="${esc(field.step)}"` : ""}`
      if (field.type === "textarea")
        return `<label>${esc(displayLabel(field.label))}<textarea name="${esc(field.name)}"${attrs}>${esc(value)}</textarea></label>`
      if (field.type === "select")
        return `<label>${esc(displayLabel(field.label))}<select name="${esc(field.name)}"${attrs}>${(field.options ?? []).map((option) => `<option value="${esc(option)}"${option === value ? " selected" : ""}>${esc(option)}</option>`).join("")}</select></label>`
      return `<label>${esc(displayLabel(field.label))}<input name="${esc(field.name)}" type="${field.type ?? "text"}"${field.type === "checkbox" ? ` value="true"${field.value === true ? " checked" : ""}` : ` value="${esc(value)}"`}${attrs}></label>`
    })
    .join("")
}

export function form(
  page: string,
  action: string,
  id: string,
  version: number,
  body: string,
  label = "Save",
  disabled = false,
): string {
  return `<form data-command="${esc(action)}" data-page="${esc(page)}" data-record="${esc(id)}" data-version="${version}">${body}<button type="submit"${disabled ? " disabled" : ""}>${esc(label)}</button></form>`
}

export function table(headers: string[], data: string[][]): string {
  const action = (index: number) => ["Edit", "Delete", "Actions"].includes(headers[index] ?? "") ? ' class="table-action"' : ""
  return `<div class="table-scroll"><table><thead><tr>${headers.map((head, index) => `<th scope="col"${action(index)}>${esc(displayLabel(head))}</th>`).join("")}</tr></thead><tbody>${data.map((row) => `<tr>${row.map((cell, index) => {
    const editor = ["Edit", "Actions"].includes(headers[index] ?? "") && cell.includes("<form")
    return `<td${action(index)}>${editor ? `<button type="button" data-open-editor>${headers[index] === "Edit" ? "Edit" : "Manage"}</button><dialog class="row-dialog" aria-label="${headers[index] === "Edit" ? "Edit record" : "Manage record"}"><header><h2>${headers[index] === "Edit" ? "Edit record" : "Manage record"}</h2><button type="button" data-close-editor aria-label="Close editor">×</button></header><p data-editor-status role="status" aria-live="polite"></p>${cell}</dialog>` : cell}</td>`
  }).join("")}</tr>`).join("")}</tbody></table>${data.length ? "" : '<p class="empty">No records.</p>'}</div>`
}

export function metric(label: string, value: string): string {
  return `<article class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`
}

/** Keep statistics in a deliberate equal-width grid, including optional role-restricted cards. */
export function metricGrid(items: readonly string[], columns: 1 | 2 | 3 | 4 = 4): string {
  const cards = items.filter(Boolean)
  return cards.length ? `<div class="metric-grid metric-grid--${Math.min(columns, cards.length)}">${cards.join("")}</div>` : ""
}

/** Display-only normalization; never use this for field names or durable keys. */
export function displayLabel(label: string): string {
  if (label === "opsCats") return "Ticket categories"
  if (label === "opsHmItems") return "Heat map items"
  return label.split("|").map((part) => {
    const label = part.trim()
    const readable = label
      .replace(/([a-z\d])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .replace(/\b(?:it|soc|sla|fx|ytd|usd|id|po|pr|fte|opex|capex)\b/gi, (word) => word.toUpperCase())
    return /\s/.test(label) ? readable : readable.replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
  }).join(" · ")
}
