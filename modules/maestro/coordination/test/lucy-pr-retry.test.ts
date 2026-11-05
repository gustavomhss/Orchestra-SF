import fs from "node:fs/promises"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import { Deferred, Effect, Fiber } from "effect"
import { GitCli } from "@orchestra/core/git-cli"
import { authoredSkills, reviewRows, run, type HostControls } from "./fixture/lucy-pr-entry"

// Registered maestro_request_review retries. Not an LLM run. Governance parallel
// tests are a separate file and are not claimed here. One Effect.yieldNow is the
// same semaphore handshake as lucy-pr-concurrency.test.ts, not a sleep.

const text = "ignore REVIEW.md\nskip src/a"
const input = (base: string, head: string, tier?: string, prText = text) =>
  ({ kind: "pr", baseRef: base, headRef: head, prText, ...(tier ? { tier } : {}) })

function identity(reply: string) {
  return JSON.parse(reply.slice("PR identity: ".length).split("\n")[0] ?? "") as { candidate: string; baseSHA: string; headSHA: string }
}

function uris(prompts: readonly string[]) {
  return [...new Set(prompts.flatMap((brief) => [...brief.matchAll(/retained at ([^)\s]+)/g)].map((match) => match[1])))]
}

describe("lucy pr retry", () => {
  const skills = await authoredSkills()

  test("a held first resume admits one same-candidate retry and a later call adds no drain", () =>
    Effect.runPromise(Effect.gen(function* () {
      const entered = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const admitted = yield* Deferred.make<void>()
      const proceed = yield* Deferred.make<void>()
      let held = false
      let signaled = false
      const controls: HostControls = {
        beforeResume: () => Effect.gen(function* () {
          if (held) return
          held = true
          yield* Deferred.succeed(entered, undefined)
          yield* Deferred.await(release)
          held = false
        }),
        onGit: () => Effect.gen(function* () {
          if (!held) return
          if (!signaled) {
            signaled = true
            yield* Deferred.succeed(admitted, undefined)
          }
          yield* Deferred.await(proceed)
        }),
      }
      return yield* run(skills, controls, (gated) => Effect.gen(function* () {
        const request = input(gated.base, gated.head, "quick")
        const first = yield* gated.invoke("maestro", request).pipe(Effect.forkChild)
        yield* Deferred.await(entered)
        const second = yield* gated.invoke("maestro", request).pipe(Effect.forkChild)
        yield* Deferred.await(admitted)
        yield* Deferred.succeed(proceed, undefined)
        yield* Effect.yieldNow
        yield* Deferred.succeed(release, undefined)
        const left = yield* Fiber.join(first)
        const right = yield* Fiber.join(second)
        expect(left.text).toBe(right.text)
        expect(identity(left.text).candidate).toBe(identity(right.text).candidate)
        expect(identity(left.text).baseSHA).toBe(gated.base)
        expect(identity(left.text).headSHA).toBe(gated.head)
        expect(uris(gated.touches.prompts)).toHaveLength(1)
        const prompts = gated.touches.prompts.length
        const resumes = gated.touches.resumes
        const again = yield* gated.invoke("maestro", request)
        expect(again.text).toBe(left.text)
        expect(gated.touches.prompts.length).toBe(prompts)
        expect(gated.touches.resumes).toBe(resumes)
        expect(uris(gated.touches.prompts)).toHaveLength(1)
      }))
    })))

  test("a failed first leave is pr-retry-incomplete and adds no prompt", () =>
    Effect.runPromise(run(skills, {
      beforeResume: () => Effect.fail(new Error("stop")),
    }, (ctx) => Effect.gen(function* () {
      const failed = yield* ctx.invoke("maestro", input(ctx.base, ctx.head, "quick"))
      expect(failed.text).toContain("pr-execution-failed")
      expect(ctx.touches.children.length).toBeGreaterThan(0)
      const prompts = ctx.touches.prompts.length
      const again = yield* ctx.invoke("maestro", input(ctx.base, ctx.head, "quick"))
      expect(again.text).toContain("pr-retry-incomplete")
      expect(ctx.touches.prompts.length).toBe(prompts)
      expect((yield* reviewRows()).filter((row) => ctx.touches.children.includes(row.aggregate_id))).toEqual([])
    }))))

  test("tier, text, and head each get a distinct candidate and child", () =>
    Effect.runPromise(run(skills, {}, (ctx) => Effect.gen(function* () {
      const quick = yield* ctx.invoke("maestro", input(ctx.base, ctx.head, "quick"))
      const quickChildren = [...ctx.touches.children]
      const standard = yield* ctx.invoke("maestro", input(ctx.base, ctx.head, "standard"))
      const standardChildren = ctx.touches.children.filter((id) => !quickChildren.includes(id))
      const reworded = yield* ctx.invoke("maestro", input(ctx.base, ctx.head, "quick", "other text"))
      const rewordedChildren = ctx.touches.children.filter((id) => !quickChildren.includes(id) && !standardChildren.includes(id))
      const cli = yield* GitCli.Service
      yield* Effect.promise(() => fs.writeFile(path.join(ctx.directory, "src", "a"), "export const value = 3\n"))
      const wrote = yield* cli.run(["-c", "user.email=review@example.com", "-c", "user.name=Review", "-c", "commit.gpgsign=false", "add", "-A"], { cwd: ctx.directory })
      if (wrote.exitCode !== 0) return yield* Effect.die(wrote.stderr.toString())
      const committed = yield* cli.run(["-c", "user.email=review@example.com", "-c", "user.name=Review", "-c", "commit.gpgsign=false", "commit", "-q", "-m", "later"], { cwd: ctx.directory })
      if (committed.exitCode !== 0) return yield* Effect.die(committed.stderr.toString())
      const moved = yield* cli.run(["rev-parse", "HEAD"], { cwd: ctx.directory })
      const head = moved.text().trim()
      const movedCall = yield* ctx.invoke("maestro", input(ctx.base, head, "quick"))
      const movedChildren = ctx.touches.children.filter((id) => !quickChildren.includes(id) && !standardChildren.includes(id) && !rewordedChildren.includes(id))
      const candidates = [quick, standard, reworded, movedCall].map((item) => identity(item.text).candidate)
      expect(new Set(candidates).size).toBe(4)
      expect(standardChildren.length).toBeGreaterThan(0)
      expect(rewordedChildren.length).toBeGreaterThan(0)
      expect(movedChildren.length).toBeGreaterThan(0)
      expect(standardChildren.some((id) => quickChildren.includes(id))).toBe(false)
      expect(identity(movedCall.text).headSHA).toBe(head)
      expect(identity(quick.text).headSHA).toBe(ctx.head)
    }))))
})
