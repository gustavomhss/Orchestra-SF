import corpus from "./corpus-v2.json"
import inputs from "./consumer-inputs.json"
import type { Snapshot } from "../../../../runtime/contract.ts"

/** Maps explicit monthly inputs to the existing Planner snapshot, without a second calculator. */
export function createPlannerCorpus(): Snapshot {
  const finance = corpus.datasets.finance
  const months = finance.budget.monthly.map((month) => month.period)
  return {
    data: {
      versions: [{
        id: inputs.planner.versionId, year: 2027, closed: inputs.planner.closedMonths, locked: false,
        lines: [
          {
            id: inputs.planner.baseLineId, sec: "opex", el: "services", cur: finance.currency,
            b: finance.budget.monthly.map((month) => month.amount),
            a: months.map((period) => finance.actual.monthly.find((month) => month.period === period)?.amount ?? null),
            f: months.map((period) => finance.forecast.other_open_forecast_monthly.find((month) => month.period === period)?.amount ?? null),
          },
          {
            id: inputs.planner.licenseLineId, sec: "opex", el: "licenses", cur: finance.currency,
            b: months.map(() => 0),
            a: months.map((_, index) => index < inputs.planner.closedMonths ? 0 : null),
            f: months.map((period, index) => index < inputs.planner.closedMonths ? null : period === finance.decision_item.period ? finance.decision_item.amount : 0),
          },
        ],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {},
      }],
    },
    versions: {}, sequences: {}, audit: [], notices: [],
  }
}
