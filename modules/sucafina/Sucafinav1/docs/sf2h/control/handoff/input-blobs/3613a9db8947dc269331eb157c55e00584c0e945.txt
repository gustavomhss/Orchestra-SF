import { digestSfValue } from "../contracts/canonical.ts"

type Value = { state: "absent" | "undefined" } | { state: "present"; value: unknown }
export type ImportChange = { path: string; kind: "added" | "changed" | "removed"; before: Value; after: Value }

/** Diff only already-authorized domain projections. Array records use stable IDs when available. */
export function compareImportProjections(before: unknown, after: unknown): ImportChange[] {
  const changes: ImportChange[] = []
  const segment = (value: string) => value.replace(/~/g, "~0").replace(/\//g, "~1")
  const visit = (path: string, left: unknown, right: unknown, leftPresent: boolean, rightPresent: boolean) => {
    if (leftPresent === rightPresent && digestSfValue(left) === digestSfValue(right)) return
    const leftArray = Array.isArray(left) ? left : []
    const rightArray = Array.isArray(right) ? right : []
    if ((Array.isArray(left) || !leftPresent) && (Array.isArray(right) || !rightPresent) && (leftArray.length || rightArray.length)) {
      const ids = (values: unknown[]) => values.map((value) => value && typeof value === "object" && !Array.isArray(value) && (typeof (value as Record<string, unknown>).id === "string" || typeof (value as Record<string, unknown>).id === "number") ? String((value as Record<string, unknown>).id) : "")
      const leftIds = ids(leftArray)
      const rightIds = ids(rightArray)
      if ([...leftIds, ...rightIds].every(Boolean) && new Set(leftIds).size === leftIds.length && new Set(rightIds).size === rightIds.length) {
        for (const id of [...new Set([...leftIds, ...rightIds])].sort()) {
          const l = leftIds.indexOf(id)
          const r = rightIds.indexOf(id)
          visit(`${path}/@id=${segment(id)}`, leftArray[l], rightArray[r], l >= 0, r >= 0)
        }
        return
      }
      Array.from({ length: Math.max(leftArray.length, rightArray.length) }, (_, index) => visit(`${path}/${index}`, leftArray[index], rightArray[index], index < leftArray.length, index < rightArray.length))
      return
    }
    const leftObject = left && typeof left === "object" && !Array.isArray(left) ? left as Record<string, unknown> : undefined
    const rightObject = right && typeof right === "object" && !Array.isArray(right) ? right as Record<string, unknown> : undefined
    if ((leftObject || !leftPresent) && (rightObject || !rightPresent) && (Object.keys(leftObject ?? {}).length || Object.keys(rightObject ?? {}).length)) {
      for (const key of [...new Set([...Object.keys(leftObject ?? {}), ...Object.keys(rightObject ?? {})])].sort()) visit(`${path}/${segment(key)}`, leftObject?.[key], rightObject?.[key], !!leftObject && Object.hasOwn(leftObject, key), !!rightObject && Object.hasOwn(rightObject, key))
      return
    }
    changes.push({ path: path || "/", kind: !leftPresent ? "added" : !rightPresent ? "removed" : "changed", before: !leftPresent ? { state: "absent" } : left === undefined ? { state: "undefined" } : { state: "present", value: left }, after: !rightPresent ? { state: "absent" } : right === undefined ? { state: "undefined" } : { state: "present", value: right } })
  }
  visit("", before, after, true, true)
  return changes
}
