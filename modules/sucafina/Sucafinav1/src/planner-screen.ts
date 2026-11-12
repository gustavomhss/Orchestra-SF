// Secção 8.0. Sete tabs. Excel não é tab. Não importa dashboard nem procurement.

import { PLANNER_DEFAULT, excelFile, openPlanner, plannerKeys } from "./nav.ts"
import { documentHtml, links, listed, openKey, pageMain } from "./screen-shell.ts"
import type { Drawn, ScreenActor } from "./screen-shell.ts"

export function plannerScreen(input: { actor: ScreenActor; key?: string }): { drawn: Drawn; html: string } {
  const keys = plannerKeys(input.actor)
  const nav = listed(keys, "planner")
  const requested = input.key ?? (nav.length ? PLANNER_DEFAULT : undefined)
  const opened = openKey(keys, requested, (key) => openPlanner(key, input.actor))
  const file = excelFile()
  const drawn = {
    surface: "planner" as const,
    nav,
    active: opened,
    aside: file.file && nav.length ? [{ key: "Excel", page: false as const }] : [],
  }
  const excel = drawn.aside.length ? `<div data-slot="excel" data-page="false">Excel</div>` : ""
  return { drawn, html: documentHtml("IT Budget Planner", "planner", links(nav), pageMain(opened), excel) }
}
