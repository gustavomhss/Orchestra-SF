import { SfBiOwnedFigure } from "../finance/visual"
import type { SfBiFigureProps, SfBiOperationalView } from "../finance/model"

export type SfOperationalFigureProps = SfBiFigureProps<SfBiOperationalView>

/**
 * U21 owns BI05–BI08: current work stock, admitted aging,
 * actual ticket-series projections and observed milestones.
 * It never derives historical cohorts, SLA, age, or dates from event strings.
 */
export function SfOperationalFigure(props: SfOperationalFigureProps) {
  return <SfBiOwnedFigure {...props} copy="sf.u21" />
}
