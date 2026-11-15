import { expect, test } from "bun:test"
import { observeSfRoutineNative } from "../../../../../../apps/cli/src/sucafina-product/routine-native-origin.ts"

// Component only: this observes async boundaries; it cannot certify a native C15 producer.
test("native observe exports a working bounded read and rejects reader exceptions", async () => {
  const signal = new AbortController().signal
  const value = { authorization: "synthetic-value" }
  expect(await observeSfRoutineNative(async () => value, signal)).toBe(value)
  expect(await observeSfRoutineNative(async () => { throw new Error("untrusted reader") }, signal))
    .toBeUndefined()
})

test("invalid, infinite and oversized budgets fail closed before touching the reader", async () => {
  let calls = 0
  const read = async () => { calls++; return "forbidden" }
  const signal = new AbortController().signal
  for (const budget of [0, -1, NaN, Infinity, 30_001, 0.5])
    expect(await observeSfRoutineNative(read, signal, budget)).toBeUndefined()
  expect(calls).toBe(0)
})

test("pre-aborted and same-turn-aborted signals never start queued native callbacks", async () => {
  const cancelled = new AbortController()
  cancelled.abort()
  let calls = 0
  const read = async () => { calls++; return "forbidden" }
  expect(await observeSfRoutineNative(read, cancelled.signal)).toBeUndefined()
  const late = new AbortController()
  const pending = observeSfRoutineNative(read, late.signal)
  late.abort()
  expect(await pending).toBeUndefined()
  expect(calls).toBe(0)
})

test("revocation wins against an in-flight read and its late completion cannot escape", async () => {
  const controller = new AbortController()
  let release: (value: string) => void = () => {}
  const held = new Promise<string>((resolve) => { release = resolve })
  let entered: () => void = () => {}
  const enteredPromise = new Promise<void>((resolve) => { entered = resolve })
  const pending = observeSfRoutineNative(() => { entered(); return held }, controller.signal)
  await enteredPromise
  controller.abort()
  expect(await pending).toBeUndefined()
  release("late-restricted-result")
  await Promise.resolve()
  expect(controller.signal.aborted).toBe(true)
})

test("a never-settling reader ends on its explicit deadline, without infinite timeout", async () => {
  const signal = new AbortController().signal
  let calls = 0
  const value = await observeSfRoutineNative(() => {
    calls++
    return new Promise<string>(() => {})
  }, signal, 20)
  expect(value).toBeUndefined()
  expect(calls).toBe(1)
})

test("revocation during the reader prevents its synchronous result escaping", async () => {
  const controller = new AbortController()
  const value = await observeSfRoutineNative(async () => {
    controller.abort()
    return { confidential: "not-for-egress" }
  }, controller.signal)
  expect(value).toBeUndefined()
})
