import { object, rows, text } from "../../runtime/contract.ts"
import type { Actor, View } from "../../runtime/contract.ts"
import { plannerField } from "../../src/planner-role.ts"
import { normName } from "../../src/planner-accounts.ts"
import { plannerKeys } from "../../src/nav.ts"
import { esc } from "../../src/screen-shell.ts"

export type MonthlyMeasure = "budget" | "actual" | "forecast"

/** Present domain-produced values and command permissions without writing inherited forecast cells. */
export function projectMonthlyGrid(view: View, actor: Actor, page: "OPEX" | "CAPEX", versionId: string) {
  if (!plannerKeys(actor).includes(page)) return undefined
  const version = rows(view.data.versions).find((entry) => entry.id === versionId)
  if (!version) return undefined
  const official = text(object(view.data.officials)[String(version.year)])
  const plan = { id: versionId, year: Number(version.year), locked: version.locked === true }
  return {
    versionId,
    versionName: text(version.name),
    year: version.year,
    page,
    closedThrough: Number(version.closed),
    rows: rows(object(version.summary).lines).filter((line) => {
      if (line.sec !== (page === "OPEX" ? "opex" : "capex")) return false
      const idOf = (value: unknown) => typeof value === "string" || typeof value === "number" && Number.isFinite(value) ? String(value) : ""
      const project = rows(version.projects).find((entry) => entry.id === line.proj)
      const owner = idOf(object(line.owner).id) || idOf(line.owner) || idOf(object(project?.owner).id) || idOf(project?.owner)
      return (!view.data.owner || owner === idOf(view.data.owner)) && (!view.data.class || text(line.cls) === text(view.data.class)) && (!view.data.q || normName(`${text(line.name)} ${text(line.desc)}`).includes(normName(text(view.data.q))))
    }).map((line) => {
      const id = text(line.id)
      const permission = { ownerId: text(line.ownerId) || text(object(line.owner).id) || text(line.owner), domain: text(line.domain), hr: line.synthetic === true }
      return {
        id,
        label: text(line.name) || id,
        currency: text(line.cur) || "USD",
        synthetic: line.synthetic === true,
        revision: view.versions[`${versionId}:${line.synthetic === true ? "hrAF" : "lines"}:${id}`]?.version ?? 0,
        cells: Array.from({ length: 12 }, (_, index) => {
          const read = (values: unknown) => Array.isArray(values) && typeof values[index] === "number" && Number.isFinite(values[index]) ? values[index] as number : null
          const budget = read(line.b)
          const actual = read(line.a)
          const forecast = read(line.f)
          return {
            month: index + 1,
            closed: index < Number(version.closed),
            manual: Array.isArray(line.bm) && line.bm[index] === true,
            budget: { value: budget, stored: budget, source: line.synthetic === true ? "derived" as const : budget === null ? "absent" as const : "explicit" as const, editable: plannerField("budget", plan, official, actor, permission) },
            actual: { value: actual, stored: actual, source: actual === null ? "absent" as const : "explicit" as const, editable: plannerField("actual", plan, official, actor, permission) },
            forecast: { value: forecast ?? budget, stored: forecast, source: forecast !== null ? "explicit" as const : budget !== null ? "inherited-budget" as const : "absent" as const, editable: plannerField("forecast", plan, official, actor, permission) },
          }
        }),
      }
    }),
  }
}

/** The real runtime can mount this contribution next to its existing command forms. */
export function renderMonthlyGrid(view: View, actor: Actor, page: "OPEX" | "CAPEX", versionId: string, measure: MonthlyMeasure = "forecast") {
  const grid = projectMonthlyGrid(view, actor, page, versionId)
  if (!grid) return ""
  const label = `${page} ${measure} · ${grid.versionName || grid.versionId} · ${grid.year}`
  return `<details class="planner-monthly-state"><summary>${esc(label)} — saved monthly values</summary><p>Empty forecast inherits budget without saving it. Explicit zero remains zero. Closed months use actual for outlook. Manual marks apply to budget spread.</p><div class="table-scroll" role="region" tabindex="0" aria-label="${esc(label)}"><table><thead><tr><th scope="col">Line · currency</th>${Array.from({ length: 12 }, (_, index) => `<th scope="col">${index + 1}</th>`).join("")}</tr></thead><tbody>${grid.rows.map((row) => `<tr data-planner-line="${esc(row.id)}"><th scope="row">${esc(row.label)} · ${esc(row.currency)}</th>${row.cells.map((cell) => {
    const value = cell[measure]
    const state = value.source === "inherited-budget" ? "Inherited budget" : value.source === "derived" ? "Derived from headcount" : value.source === "absent" ? "Absent" : value.value === 0 ? "Explicit zero" : "Saved"
    const notes = [state, ...(cell.closed ? ["Closed month"] : []), ...(measure === "budget" && cell.manual ? ["Manual"] : []), ...(!value.editable ? ["Read only"] : [])]
    return `<td><span>${value.value === null ? "—" : esc(String(value.value))}</span><small>${notes.map(esc).join(" · ")}</small></td>`
  }).join("")}</tr>`).join("")}</tbody></table></div></details>`
}
