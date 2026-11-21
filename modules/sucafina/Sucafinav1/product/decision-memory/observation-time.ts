import { isSfPeriod } from "../contracts/validation.ts"

/** Observation clocks may advance independently of a source's material identity. */
export function isSfObservationTime(value: string): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.test(value)) return false
  const date = value.slice(0, 10)
  return isSfPeriod({ start: date, end: date }) && Number.isFinite(Date.parse(value))
}

export function sfObservationTimeAdvances(previous: string, current: string): boolean {
  return isSfObservationTime(previous) && isSfObservationTime(current) && Date.parse(current) >= Date.parse(previous)
}
