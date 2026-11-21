import { unwrap } from "solid-js/store"

/**
 * Copy producer JSON values out of reactive storage before closed-schema
 * admission. Solid's non-enumerable tracking symbols are not wire fields.
 * String keys, including unexpected keys, stay intact for F02 to validate.
 */
export function snapshotDecisionRequest<T>(value: T): T {
  return structuredClone(unwrap(value))
}
