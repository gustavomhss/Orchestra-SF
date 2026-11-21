import type { JSX } from "solid-js"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfBudgetView } from "./budget-view"
/** U07 CAP18 — one source-bound OPEX route, composed by I00/125. */
export function SfPlannerOpexView(props: SfSurfaceProps<"CAP18">): JSX.Element {
  return <SfBudgetView {...props} />
}
