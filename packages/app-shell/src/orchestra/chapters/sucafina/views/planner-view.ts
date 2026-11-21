import { Option, Schema } from "effect"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import { SfPersonalViewLegacy } from "@orchestra/schema/sucafina/work"
import type { SfOwnerSelection } from "@orchestra/schema/sucafina/context"

type PersonalView = Schema.Schema.Type<typeof SfPersonalViewLegacy>
type PlannerQuery = Schema.Schema.Type<(typeof SfPlanner)["operations"]["domain.page.CAP18"]["input"]>
export type SfPlannerSavedView = Readonly<{
  id: string; title: string; page: "OPEX" | "CAPEX"; density: "comfortable" | "compact"; query: PlannerQuery
}>

/** An explicit V1 compatibility read. Unsupported source semantics are never discarded. */
export function sfPlannerSavedView(view: PersonalView): SfPlannerSavedView | undefined {
  if (view.surface !== "planner" || (view.page !== "OPEX" && view.page !== "CAPEX") || view.currency !== undefined) return
  const selections = view.filters?.selections ?? {}
  if (Object.keys(selections).some((key) => !["year", "version", "mode", "owner", "class"].includes(key))) return
  let year = selections.year ? Number(selections.year) : undefined
  if (view.period) {
    const match = /^(\d{4})-01-01$/.exec(view.period.start)
    if (!match || view.period.end !== match[1] + "-12-31" || year !== undefined && year !== Number(match[1])) return
    year = Number(match[1])
  }
  const query = {
    ...(year === undefined ? {} : { year }),
    ...(selections.version === undefined ? {} : { version: selections.version }),
    ...(selections.mode === undefined ? {} : { mode: selections.mode }),
    ...(selections.owner === undefined ? {} : { owner: selections.owner }),
    ...(selections.class === undefined ? {} : { class: selections.class }),
    ...(view.filters?.query === undefined ? {} : { q: view.filters.query }),
  }
  const decoded = Schema.decodeUnknownOption(SfPlanner.operations["domain.page.CAP18"].input, { onExcessProperty: "error" })(query)
  if (Option.isNone(decoded)) return
  return { id: view.id, title: view.title, page: view.page, density: view.density ?? "comfortable", query: decoded.value }
}

/** A candidate link only. The destination reopens the private view and reauthorizes its source. */
export function sfPlannerSavedViewHref(view: PersonalView, owner: SfOwnerSelection): string | undefined {
  const saved = sfPlannerSavedView(view)
  if (!saved || !owner.installationId) return
  const query = new URLSearchParams({
    server: owner.serverKey, project: owner.projectId, installation: owner.installationId, view: saved.id,
  })
  return "/orchestra/sf-planner/" + (saved.page === "OPEX" ? "opex" : "capex") + "?" + query
}
