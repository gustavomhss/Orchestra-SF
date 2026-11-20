import { expect, test } from "bun:test"
import { Effect, Fiber } from "effect"

test("fiber completion notifies every waiter when an earlier observer removes itself", async () => {
  const release = Promise.withResolvers<number>()
  const fiber = Effect.runFork(Effect.promise(() => release.promise))
  const observed: string[] = []
  let remove = () => {}
  remove = fiber.addObserver(() => {
    observed.push("first")
    remove()
  })
  fiber.addObserver(() => { observed.push("second") })
  const completion = Effect.runPromise(Fiber.await(fiber))
  release.resolve(42)
  const exit = await completion
  expect(exit._tag).toBe("Success")
  expect(observed).toEqual(["first", "second"])
})
