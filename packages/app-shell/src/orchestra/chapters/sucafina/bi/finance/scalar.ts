/**
 * Presentation only: retain the original scalar and its separate producer unit.
 * Significant digits keep arbitrarily small nonzero quantities distinguishable
 * from zero. Integer counts remain exact; currency uses its existing formatter.
 */
export function sfBiScalarLabel(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, Number.isInteger(value)
    ? { maximumFractionDigits: 0 }
    : { maximumSignificantDigits: 6 }).format(value)
}
