/**
 * Native commands carry nested JSON, so numeric controls must retain numeric
 * values before review. The legacy producer normalizes dotted form fields only.
 * Empty input remains absent; invalid text stays available to validation.
 */
export function procurementNumberInput(raw: string): string | number | null {
  if (raw.trim() === "") return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : raw
}
