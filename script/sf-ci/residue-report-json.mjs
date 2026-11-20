// The immutable G09 report can exceed V8's maximum single-string size.
// Validate every byte and JSON token, while materializing only navigation data.
// Lexical call expressions are retained by the original report and their own
// byte digests; this reader never substitutes an empty call graph or a PASS.
import { createHash } from "node:crypto"

const fail = () => { throw new Error("TEAM_PROFILE_RESIDUE_REVIEW_JSON_INVALID") }
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex")
export function parseResidueReviewJson(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 2) fail()
  const decoder = new TextDecoder("utf-8", { fatal: true })
  try {
    for (let offset = 0; offset < bytes.length; offset += 1024 * 1024)
      decoder.decode(bytes.subarray(offset, offset + 1024 * 1024), { stream: true })
    decoder.decode()
  } catch { fail() }
  let at = 0
  const notMaterialized = []
  const whitespace = () => {
    while (at < bytes.length && [0x20, 0x09, 0x0a, 0x0d].includes(bytes[at])) at++
  }
  const hex = (value) => value >= 48 && value <= 57 || value >= 65 && value <= 70 || value >= 97 && value <= 102
  const string = (retain, key = false) => {
    if (bytes[at++] !== 34) fail()
    const start = at - 1
    while (at < bytes.length) {
      const byte = bytes[at++]
      if (byte === 34) {
        if (!retain) return undefined
        if (at - start > (key ? 16384 : 16 * 1024 * 1024)) fail()
        return JSON.parse(bytes.subarray(start, at).toString("utf8"))
      }
      if (byte < 32) fail()
      if (byte !== 92) continue
      const escaped = bytes[at++]
      if (escaped === 117) {
        for (let index = 0; index < 4; index++) if (!hex(bytes[at++])) fail()
      } else if (![34, 92, 47, 98, 102, 110, 114, 116].includes(escaped)) fail()
    }
    fail()
  }
  const value = (retain, route, depth) => {
    if (depth > 128) fail()
    whitespace()
    const start = at
    const omitted = retain && Array.isArray(route) && route.length === 3 &&
      route[0] === "reachability" && ["source", "archive"].includes(route[1]) && route[2] === "calls"
    if (omitted && bytes[at] !== 91) fail()
    if (bytes[at] === 34) return string(retain)
    if (bytes[at] === 123) {
      at++; whitespace()
      const result = retain ? {} : undefined, keys = new Set()
      if (bytes[at] === 125) { at++; return result }
      for (;;) {
        const key = string(true, true)
        if (keys.has(key)) fail()
        keys.add(key); whitespace()
        if (bytes[at++] !== 58) fail()
        const child = value(retain, retain && route !== null ? [...route, key] : null, depth + 1)
        if (retain) Object.defineProperty(result, key, { value: child, writable: true, enumerable: true, configurable: true })
        whitespace()
        const separator = bytes[at++]
        if (separator === 125) return result
        if (separator !== 44) fail()
        whitespace()
      }
    }
    if (bytes[at] === 91) {
      at++; whitespace()
      const result = retain && !omitted ? [] : undefined
      let elements = 0
      if (bytes[at] !== 93) {
        for (;;) {
          const child = value(retain && !omitted, null, depth + 1)
          if (result) result.push(child)
          elements++; whitespace()
          const separator = bytes[at++]
          if (separator === 93) break
          if (separator !== 44) fail()
          whitespace()
        }
      } else at++
      if (!omitted) return result
      const summary = { jsonType: "array", notMaterialized: true, elements,
        byteLength: at - start, sha256: digest(bytes.subarray(start, at)) }
      notMaterialized.push({ path: route.join("."), ...summary })
      return summary
    }
    for (const [word, literal] of [["true", true], ["false", false], ["null", null]]) {
      if (bytes[at] !== word.charCodeAt(0)) continue
      if (bytes.subarray(at, at + word.length).toString("ascii") !== word) fail()
      at += word.length
      return retain ? literal : undefined
    }
    if (bytes[at] === 45) at++
    if (bytes[at] === 48) at++
    else {
      if (!(bytes[at] >= 49 && bytes[at] <= 57)) fail()
      while (bytes[at] >= 48 && bytes[at] <= 57) at++
    }
    if (bytes[at] === 46) {
      at++
      if (!(bytes[at] >= 48 && bytes[at] <= 57)) fail()
      while (bytes[at] >= 48 && bytes[at] <= 57) at++
    }
    if (bytes[at] === 69 || bytes[at] === 101) {
      at++
      if (bytes[at] === 43 || bytes[at] === 45) at++
      if (!(bytes[at] >= 48 && bytes[at] <= 57)) fail()
      while (bytes[at] >= 48 && bytes[at] <= 57) at++
    }
    if (at - start > 128) fail()
    const number = Number(bytes.subarray(start, at).toString("ascii"))
    if (!Number.isFinite(number)) fail()
    return retain ? number : undefined
  }
  whitespace()
  if (bytes[at] !== 123) fail()
  const report = value(true, [], 0)
  whitespace()
  if (at !== bytes.length) fail()
  return { report, notMaterialized }
}

export function isReportArraySummary(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === 5 && value.jsonType === "array" && value.notMaterialized === true &&
    Number.isSafeInteger(value.elements) && value.elements >= 0 &&
    Number.isSafeInteger(value.byteLength) && value.byteLength >= 2 && /^[a-f0-9]{64}$/.test(value.sha256)
}
