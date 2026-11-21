/**
 * Detach the reviewed DTO before hashing and dispatch. Solid store metadata is
 * non-enumerable and is not command data. Enumerable fields, including unknown
 * fields and undefined values, stay visible to the original strict codec.
 */
export function procurementCommandSnapshot<Value>(value: Value): Value {
  function copy(current: unknown): unknown {
    if (Array.isArray(current)) return current.map(copy)
    if (current === null || typeof current !== "object" || Object.getPrototypeOf(current) !== Object.prototype)
      return current
    return Object.fromEntries(Object.entries(current).map(([key, field]) => [key, copy(field)]))
  }
  return copy(value) as Value
}
