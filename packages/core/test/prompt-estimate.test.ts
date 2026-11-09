import { expect, test } from "bun:test"
import { PromptEstimate } from "../src/session/prompt-estimate"
import { Token } from "../src/util/token"

const reference = (value: unknown) => Token.estimate(JSON.stringify(value))

test("matches whole JSON serialization across structured values and rounding boundaries", () => {
  const estimate = PromptEstimate.make()
  const long = ('"\\\n😀\ud800é' + "a".repeat(256)).repeat(3)
  const fixtures = [
    { system: [long, "short"], messages: [{ role: "user", content: long }], tools: [{ description: long }] },
    [null, , undefined, () => 1, NaN, Infinity, -Infinity, -0, long],
    { omitted: undefined, fn: () => 1, array: [long, null], unicode: "😀\udfff\u0000" },
    ...Array.from({ length: 8 }, (_, index) => ({ a: long, b: "x".repeat(index) })),
  ]
  fixtures.forEach((value) => expect(estimate(value)).toBe(reference(value)))
  const value = ["a".repeat(258), "b".repeat(258)]
  expect(estimate(value)).toBe(reference(value))
  expect(estimate(value)).not.toBe(value.reduce((sum, item) => sum + Token.estimate(JSON.stringify(item)), 0))
})

test("reuses exact strings across rebuilt requests and misses edited text", () => {
  let calls = 0
  const estimate = PromptEstimate.make((value) => { calls++; return JSON.stringify(value).length })
  const text = 'a"\\\n'.repeat(100)
  const edited = text + "changed"
  const requests = [
    { system: [text], messages: [{ content: text }], tools: [text] },
    { tools: [text], messages: [{ content: text }], system: [text] },
    { messages: [{ content: edited }], system: [text] },
  ]
  requests.forEach((request) => expect(estimate(request)).toBe(reference(request)))
  expect(calls).toBe(2)
  expect(estimate({ again: text, other: text })).toBe(reference({ again: text, other: text }))
  expect(calls).toBe(2)
})

test("runs dynamic toJSON on every occurrence with the actual key", () => {
  let calls = 0
  const keys: string[] = []
  const item = { toJSON(key: string) { keys.push(key); return `${key}:${"x".repeat(256)}:${++calls}` } }
  const estimate = PromptEstimate.make()
  const actual = estimate({ left: item, right: item })
  expect(keys).toEqual(["left", "right"])
  expect(actual).toBe(reference({ left: `left:${"x".repeat(256)}:1`, right: `right:${"x".repeat(256)}:2` }))
  const next = estimate({ left: item })
  expect(calls).toBe(3)
  expect(next).toBe(reference({ left: `left:${"x".repeat(256)}:3` }))
})

test("clears on entry pressure", () => {
  let calls = 0
  const estimate = PromptEstimate.make((value) => { calls++; return JSON.stringify(value).length })
  const strings = Array.from({ length: 129 }, (_, index) => `${index}:${"a".repeat(256)}`)
  strings.forEach((value) => expect(estimate(value)).toBe(reference(value)))
  expect(calls).toBe(129)
  expect(estimate(strings[0])).toBe(reference(strings[0]))
  expect(calls).toBe(130)
})

test("clears independently on character pressure; small and oversized strings bypass encoding", () => {
  let calls = 0
  const estimate = PromptEstimate.make((value) => { calls++; return JSON.stringify(value).length })
  const strings = ["a".repeat(100_000), "b".repeat(100_000), "c".repeat(100_000)]
  strings.forEach((value) => expect(estimate(value)).toBe(reference(value)))
  expect(estimate(strings[0])).toBe(reference(strings[0]))
  expect(calls).toBe(4)
  const bypass = ["a".repeat(255), "b".repeat(262_145)]
  expect(estimate(bypass)).toBe(reference(bypass))
  expect(calls).toBe(4)
})

test("preserves JSON errors and rejects undefined top-level serialization", () => {
  const estimate = PromptEstimate.make()
  const cycle: { self?: unknown } = {}
  cycle.self = cycle
  expect(() => estimate(cycle)).toThrow(TypeError)
  expect(() => estimate({ n: 1n })).toThrow(TypeError)
  expect(() => estimate(undefined)).toThrow(TypeError)
})
