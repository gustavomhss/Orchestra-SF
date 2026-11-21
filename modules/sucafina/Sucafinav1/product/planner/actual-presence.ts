import { rows } from "../../runtime/contract.ts"

/** Qualify the domain's existing actual total; presence never depends on whether it is zero. */
export function plannerActualMonth(summary: Record<string, unknown>, month: number, restrictedHr = false) {
  const read = (value: unknown) => Array.isArray(value) && typeof value[month - 1] === "number" && Number.isFinite(value[month - 1]) ? value[month - 1] as number : null
  const domainValue = read(summary.actual)
  const lines = rows(summary.lines)
  const missing = !Number.isInteger(month) || month < 1 || month > 12 || !lines.length || domainValue === null || lines.some((line) =>
    read(line.a) === null || read(line.actual) === null || (line.synthetic === true ? restrictedHr : Array.isArray(summary.warnings) && summary.warnings.includes(String(line.cur ?? "USD").toUpperCase())),
  )
  return { value: missing ? null : domainValue, domainValue, evidenceState: missing ? "absent" as const : "confirmed" as const }
}
