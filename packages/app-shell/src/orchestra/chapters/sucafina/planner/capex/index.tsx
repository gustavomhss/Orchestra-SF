import type { JSX } from "solid-js"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfBudgetView } from "../opex/budget-view"
/** U07 CAP19 — CAPEX retains its own source action/route catalogue. */
export function SfPlannerCapexView(props: SfSurfaceProps<"CAP19">): JSX.Element {
  return <SfBudgetView {...props} />
}
