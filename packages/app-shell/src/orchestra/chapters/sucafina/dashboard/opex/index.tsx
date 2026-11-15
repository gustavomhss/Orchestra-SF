import type { JSX } from "solid-js"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfStatePanel } from "../../shared/states"
import { sfCommonKey } from "../../shared/frame/presentation"
import { SfBudgetSurface } from "./surface"

/** U39 leaf. F01/I00 own route validation, provider and navigation admission. */
export function SfDashboardOpexView(props: SfSurfaceProps): JSX.Element {
  if (props.surfaceId !== "CAP04" || props.route.surfaceId !== "CAP04") {
    return <SfStatePanel state="invalid" messageKey={sfCommonKey("sf.common.invalidLink")} />
  }
  return <SfBudgetSurface capability="CAP04" route={props.route} />
}
