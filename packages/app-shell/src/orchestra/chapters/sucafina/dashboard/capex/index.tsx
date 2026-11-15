import type { JSX } from "solid-js"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfStatePanel } from "../../shared/states"
import { sfCommonKey } from "../../shared/frame/presentation"
import { SfBudgetSurface } from "../opex/surface"

/** U40 leaf. Uses the CAP05 A01 producer with no second financial engine. */
export function SfDashboardCapexView(props: SfSurfaceProps): JSX.Element {
  if (props.surfaceId !== "CAP05" || props.route.surfaceId !== "CAP05") {
    return <SfStatePanel state="invalid" messageKey={sfCommonKey("sf.common.invalidLink")} />
  }
  return <SfBudgetSurface capability="CAP05" route={props.route} />
}
