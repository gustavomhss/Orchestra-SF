import { describe, expect } from "bun:test"
import { Cause, Deferred, Effect, Fiber, Queue, Ref, Stream } from "effect"
import * as TestClock from "effect/testing/TestClock"
import { HttpClientRequest, type HttpClientResponse } from "effect/unstable/http"
import { LLMError, type LLMRequest } from "../src/schema"
import { Framing } from "../src/route/framing"
import { httpJson } from "../src/route/transport/http"
import { it } from "./lib/effect"

const fixture = () => Effect.gen(function* () {
  const chunks = yield* Queue.unbounded<Uint8Array, Cause.Done>()
  const observed = yield* Queue.unbounded<void>()
  const started = yield* Deferred.make<void>()
  const finalized = yield* Ref.make(0)
  const attempts = yield* Ref.make(0)
  const stream = Stream.unwrap(Effect.gen(function* () {
    yield* Deferred.succeed(started, undefined)
    return Stream.fromQueue(chunks).pipe(
      Stream.tap(() => Queue.offer(observed, undefined)),
      Stream.ensuring(Ref.update(finalized, (n) => n + 1)),
    )
  }))
  const prepared = { request: HttpClientRequest.post("https://provider.test"), framing: Framing.sse }
  const request = { model: { provider: "test", route: { id: "test" } } } as LLMRequest
  const runtime = { http: { execute: () => Ref.update(attempts, (n) => n + 1).pipe(
    Effect.as({ stream } as unknown as HttpClientResponse.HttpClientResponse),
  ) } }
  return { chunks, observed, started, finalized, attempts, prepared, request, runtime }
})

describe("HTTP response body idle timeout", () => {
  it.effect("fails a silent body at the default deadline and finalizes without retry", () =>
    Effect.gen(function* () {
      const f = yield* fixture()
      const fiber = yield* httpJson({ framing: Framing.sse }).frames(f.prepared, f.request, f.runtime).pipe(
        Stream.runCollect, Effect.flip, Effect.forkChild,
      )
      yield* Effect.gen(function* () {
        yield* Deferred.await(f.started)
        yield* TestClock.adjust("10 minutes")
        yield* Effect.yieldNow
        const result = fiber.pollUnsafe()
        expect(result?._tag).toBe("Success")
        if (result?._tag !== "Success") return
        expect(result.value).toBeInstanceOf(LLMError)
        expect(result.value.reason).toMatchObject({ _tag: "Transport", kind: "Timeout" })
        expect(result.value.retryable).toBe(false)
        expect(yield* Ref.get(f.finalized)).toBe(1)
        expect(yield* Ref.get(f.attempts)).toBe(1)
      }).pipe(Effect.ensuring(Fiber.interrupt(fiber)))
    }),
  )

  it.effect("SSE comment bytes reset the timer without producing a frame or imposing a total deadline", () =>
    Effect.gen(function* () {
      const f = yield* fixture()
      const fiber = yield* httpJson({ framing: Framing.sse }).frames(f.prepared, f.request, f.runtime).pipe(
        Stream.runCollect, Effect.forkChild,
      )
      yield* Effect.gen(function* () {
        yield* Deferred.await(f.started)
        yield* TestClock.adjust("9 minutes")
        yield* Queue.offer(f.chunks, new TextEncoder().encode(": heartbeat\n\n"))
        yield* Queue.take(f.observed)
        yield* Effect.yieldNow
        yield* TestClock.adjust("9 minutes")
        expect(fiber.pollUnsafe()).toBeUndefined()
        yield* Queue.offer(f.chunks, new TextEncoder().encode("data: hello\n\n"))
        yield* Queue.take(f.observed)
        yield* Queue.end(f.chunks)
        const frames = yield* Fiber.join(fiber)
        expect(Array.from(frames)).toEqual(["hello"])
        yield* TestClock.adjust("20 minutes")
        expect(fiber.pollUnsafe()?._tag).toBe("Success")
        expect(yield* Ref.get(f.finalized)).toBe(1)
      }).pipe(Effect.ensuring(Fiber.interrupt(fiber)))
    }),
  )

  it.effect("empty chunks do not reset a custom idle timeout set via with", () =>
    Effect.gen(function* () {
      const f = yield* fixture()
      const transport = httpJson({ framing: Framing.sse }).with({ idleTimeout: "10 seconds" })
      const fiber = yield* transport.frames(f.prepared, f.request, f.runtime).pipe(Stream.runCollect, Effect.flip, Effect.forkChild)
      yield* Effect.gen(function* () {
        yield* Deferred.await(f.started)
        yield* TestClock.adjust("9 seconds")
        yield* Queue.offer(f.chunks, new Uint8Array())
        yield* Queue.take(f.observed)
        yield* Effect.yieldNow
        yield* TestClock.adjust("1 second")
        yield* Effect.yieldNow
        const result = fiber.pollUnsafe()
        expect(result?._tag).toBe("Success")
        if (result?._tag !== "Success") return
        expect(result.value).toBeInstanceOf(LLMError)
        expect(result.value.reason).toMatchObject({ _tag: "Transport", kind: "Timeout" })
        expect(yield* Ref.get(f.finalized)).toBe(1)
      }).pipe(Effect.ensuring(Fiber.interrupt(fiber)))
    }),
  )

  it.effect("disabling the timeout leaves explicit cancellation to the owner", () =>
    Effect.gen(function* () {
      const f = yield* fixture()
      const fiber = yield* httpJson({ framing: Framing.sse, idleTimeout: false }).frames(f.prepared, f.request, f.runtime).pipe(
        Stream.runCollect, Effect.forkChild,
      )
      yield* Effect.gen(function* () {
        yield* Deferred.await(f.started)
        yield* TestClock.adjust("30 minutes")
        expect(fiber.pollUnsafe()).toBeUndefined()
        yield* Fiber.interrupt(fiber)
        const exit = fiber.pollUnsafe()
        expect(exit?._tag).toBe("Failure")
        if (exit?._tag === "Failure") expect(Cause.hasInterrupts(exit.cause)).toBe(true)
        expect(yield* Ref.get(f.finalized)).toBe(1)
        expect(yield* Ref.get(f.attempts)).toBe(1)
      }).pipe(Effect.ensuring(Fiber.interrupt(fiber)))
    }),
  )
})
