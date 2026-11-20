import { expect, test } from "bun:test"
import { pinReviewReadProperties } from "../../../product/reviews/read-identity.ts"

test("opaque proxy admission does not observe proxy traps", () => {
  let observations = 0
  const owner = new Proxy({ read: () => 0 }, {
    get: (target, name, receiver) => { observations++; return Reflect.get(target, name, receiver) },
    getPrototypeOf: (target) => { observations++; return Reflect.getPrototypeOf(target) },
    getOwnPropertyDescriptor: (target, name) => { observations++; return Reflect.getOwnPropertyDescriptor(target, name) },
  })
  expect(pinReviewReadProperties(owner, ["read"])).toBeUndefined()
  expect(observations).toBe(0)
})

test("opaque accessor admission leaves the existing getter unobserved", () => {
  let observations = 0
  const owner = { get read() { observations++; return () => 0 } }
  expect(pinReviewReadProperties(owner, ["read"])).toBeUndefined()
  expect(observations).toBe(0)
})

test("a known own method pin refuses replacement and a newly inherited optional callback", () => {
  const read = () => 0
  const owner: { read: typeof read; revalidate?: typeof read } = { read }
  const pin = pinReviewReadProperties(owner, ["read", "revalidate"])
  expect(pin?.current()).toBe(true)
  owner.read = () => 0
  expect(pin?.current()).toBe(false)
  owner.read = read
  expect(pin?.current()).toBe(true)
  Object.setPrototypeOf(owner, { revalidate: read })
  expect(pin?.current()).toBe(false)
})

test("an initially inherited optional callback remains on the opaque path", () => {
  let observations = 0
  const owner: { read: () => number; revalidate?: () => number } = { read: () => 0 }
  Object.setPrototypeOf(owner, { get revalidate() { observations++; return () => 0 } })
  expect(pinReviewReadProperties(owner, ["read", "revalidate"])).toBeUndefined()
  expect(observations).toBe(0)
})
