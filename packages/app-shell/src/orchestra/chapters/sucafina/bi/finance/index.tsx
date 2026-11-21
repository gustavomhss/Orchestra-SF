import { SfBiOwnedFigure } from "./visual"
import type { SfBiFigureProps, SfBiFinancialView } from "./model"

export type SfFinancialFigureProps = SfBiFigureProps<SfBiFinancialView>

/** U20 owns exactly BI01–BI04; BI05–BI08 and BI09–BI11 have other authors. */
export function SfFinancialFigure(props: SfFinancialFigureProps) {
  return <SfBiOwnedFigure {...props} copy="sf.u20" />
}
