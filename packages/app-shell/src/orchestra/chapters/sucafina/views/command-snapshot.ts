/**
 * Detach reviewed view data from Solid storage before hashing and dispatch.
 * Non-enumerable reactive metadata is not command data. Enumerable fields,
 * including unknown keys and explicit undefined, remain for the closed codec.
 */
export function savedViewCommandSnapshot<Value>(value: Value): Value {
  function copy(current: unknown): unknown {
    if (Array.isArray(current)) return current.map(copy)
    if (current === null || typeof current !== "object" || Object.getPrototypeOf(current) !== Object.prototype)
      return current
    return Object.fromEntries(Object.entries(current).map(([key, field]) => [key, copy(field)]))
  }
  return copy(value) as Value
}
