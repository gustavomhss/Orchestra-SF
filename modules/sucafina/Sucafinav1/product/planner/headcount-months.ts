import { object, rows, text } from "../../runtime/contract.ts"
import { chosenRate, usdAmount } from "../../src/planner-accounts.ts"
import type { RateCard } from "../../src/planner-accounts.ts"

type Missing = "missing-rate" | "missing-fx" | "missing" | "restricted"
export type PlannerHrMonthState = {
  budgetUsd: number | null
  actualUsd: number | null
  forecastUsd: number | null
  outlookUsd: number | null
  source: "actual" | "forecast" | "budget"
  budgetMissing: Missing[]
  outlookMissing: Missing[]
}

function cachedMonth(projection: Record<string, unknown>, line: Record<string, unknown>, month: number): PlannerHrMonthState | undefined {
  const states = object(projection.hrMonthStates)[text(line.id)]
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Array.isArray(states) || states.length !== 12) return undefined
  const value = object(states[month - 1])
  const amounts = [value.budgetUsd, value.actualUsd, value.forecastUsd, value.outlookUsd]
  const missing = (items: unknown) => Array.isArray(items) && items.every((item) => ["missing-rate", "missing-fx", "missing", "restricted"].includes(item))
  if (!amounts.every((amount) => amount === null || typeof amount === "number" && Number.isFinite(amount)) || !["actual", "forecast", "budget"].includes(String(value.source)) || !missing(value.budgetMissing) || !missing(value.outlookMissing)) return undefined
  return { budgetUsd: value.budgetUsd as number | null, actualUsd: value.actualUsd as number | null, forecastUsd: value.forecastUsd as number | null, outlookUsd: value.outlookUsd as number | null, source: value.source as PlannerHrMonthState["source"], budgetMissing: [...value.budgetMissing as Missing[]], outlookMissing: [...value.outlookMissing as Missing[]] }
}

/** Qualify the engine's HR cell; an independent actual/forecast never depends on its budget rate. */
export function plannerHrMonthState(projection: Record<string, unknown>, line: Record<string, unknown>, month: number): PlannerHrMonthState {
  // The source projector regenerates this aggregate metadata before redacting private rate inputs.
  const saved = cachedMonth(projection, line, month)
  if (saved) return saved
  const read = (value: unknown) => Array.isArray(value) && typeof value[month - 1] === "number" && Number.isFinite(value[month - 1]) ? value[month - 1] as number : null
  const rawForecast = Array.isArray(line.f) ? line.f[month - 1] : undefined
  const source = month <= Number(projection.closed) ? "actual" as const : rawForecast != null ? "forecast" as const : "budget" as const
  const budgetMissing: Missing[] = []
  const restricted = projection.restrictedHr === true
  if (restricted) budgetMissing.push("restricted")
  if (!Number.isInteger(month) || month < 1 || month > 12 || read(line.b) === null || read(line.budget) === null || projection.fteInputsKnown !== true) budgetMissing.push("missing")
  const domain = text(line.domain) || text(line.id).replace(/^HR:/, "")
  const positions = rows(object(projection.hc).positions).filter((position) => (text(position.domain) || "Unassigned") === domain && position.include === true && Number(position.start) <= month && Number(position.end) >= month)
  for (const position of positions) {
    const rate = chosenRate(rows(object(projection.hc).rates) as RateCard[], text(position.type), text(position.location), text(position.rateId), position.rateOverride as number | string | null | undefined)
    if (!rate || !Number.isFinite(rate.annual)) {
      budgetMissing.push("missing-rate")
      continue
    }
    const fx = rate.cur === "USD" ? 1 : rows(projection.fx).find((item) => item.cur === rate.cur)?.rate
    if (usdAmount(0, rate.cur, fx as number | null | undefined).warning) budgetMissing.push("missing-fx")
  }
  const budgetUsd = budgetMissing.length ? null : read(line.budget)
  const actualUsd = !restricted && read(line.a) !== null ? read(line.actual) : null
  const forecastUsd = !restricted ? read(line.f) : null
  const outlookMissing: Missing[] = restricted ? ["restricted"] : source === "budget" ? [...new Set(budgetMissing)] : (source === "actual" ? actualUsd : forecastUsd) === null ? ["missing"] : []
  if (read(line.outlook) === null && !outlookMissing.includes("missing")) outlookMissing.push("missing")
  return { budgetUsd, actualUsd, forecastUsd, outlookUsd: outlookMissing.length ? null : read(line.outlook), source, budgetMissing: [...new Set(budgetMissing)], outlookMissing }
}
