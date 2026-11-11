import { afterEach, expect, test } from "bun:test"
import { noteFailedZoom, settleZoom } from "./zoom-failure"

const logged: unknown[] = []
const original = console.error

afterEach(() => {
  console.error = original
  logged.length = 0
})

test("a failed current zoom reverts, is reported, and does not reject", async () => {
  const error = new Error("zoom failed")
  const applied: number[] = []
  const reverted: number[] = []
  const reported: unknown[] = []
  const ok = await settleZoom({
    write: Promise.reject(error),
    current: () => true,
    apply: () => applied.push(1),
    revert: () => reverted.push(1),
    report: (cause) => reported.push(cause),
  })
  expect(ok).toBe(false)
  expect(applied).toEqual([])
  expect(reverted).toEqual([1])
  expect(reported).toEqual([error])
})

test("a stale failed zoom is not this request", async () => {
  const error = new Error("stale")
  const applied: number[] = []
  const reverted: number[] = []
  const reported: unknown[] = []
  const ok = await settleZoom({
    write: Promise.reject(error),
    current: () => false,
    apply: () => applied.push(1),
    revert: () => reverted.push(1),
    report: (cause) => reported.push(cause),
  })
  expect(ok).toBe(false)
  expect(applied).toEqual([])
  expect(reverted).toEqual([])
  expect(reported).toEqual([])
})

test("a current zoom applies and does not report", async () => {
  const reported: unknown[] = []
  const applied: number[] = []
  const ok = await settleZoom({
    write: Promise.resolve(),
    current: () => true,
    apply: () => applied.push(1),
    revert: () => {
      throw new Error("reverted")
    },
    report: (cause) => reported.push(cause),
  })
  expect(ok).toBe(true)
  expect(applied).toEqual([1])
  expect(reported).toEqual([])
})

test("a stale successful zoom does not apply", async () => {
  const applied: number[] = []
  const ok = await settleZoom({
    write: Promise.resolve(),
    current: () => false,
    apply: () => applied.push(1),
    revert: () => {
      throw new Error("reverted")
    },
    report: () => {
      throw new Error("reported")
    },
  })
  expect(ok).toBe(false)
  expect(applied).toEqual([])
})

test("the first failed zoom is shown and a repeat is only logged", () => {
  console.error = (...args) => {
    logged.push(args[0])
  }
  const error = new Error("zoom failed")
  const reported: unknown[] = []
  const report = (cause: unknown) => reported.push(cause)
  const shown = noteFailedZoom({ error, shown: false, report })
  noteFailedZoom({ error, shown, report })
  expect(shown).toBe(true)
  expect(reported).toEqual([error])
  expect(logged).toEqual([error, error])
})
