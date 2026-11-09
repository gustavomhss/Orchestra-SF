export * as PromptEstimate from "./prompt-estimate"

import { Token } from "../util/token"

// Cache immutable text lengths, never objects: normal JSON traversal and toJSON still observe each current request.
export const make = (encodeString = (value: string) => JSON.stringify(value).length) => {
  const cache = new Map<string, number>()
  let retained = 0
  return (value: unknown) => {
    let removed = 0
    const serialized = JSON.stringify(value, (_key, item: unknown) => {
      if (typeof item !== "string" || item.length < 256 || item.length > 262_144) return item
      const cached = cache.get(item)
      const length = cached ?? encodeString(item)
      if (cached === undefined) {
        if (cache.size >= 128 || retained + item.length > 262_144) {
          cache.clear()
          retained = 0
        }
        cache.set(item, length)
        retained += item.length
      }
      // The placeholder retains its two quotes; restore only the omitted encoded contents before total rounding.
      removed += length - 2
      return ""
    })
    if (serialized === undefined) throw new TypeError("Cannot estimate a value that does not serialize to JSON")
    return Token.estimateLength(serialized.length + removed)
  }
}
