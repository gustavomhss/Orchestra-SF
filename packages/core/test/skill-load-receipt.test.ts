import { expect } from "bun:test"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { eq } from "drizzle-orm"
import { Deferred, Effect, Fiber, Stream } from "effect"
import { Database } from "@orchestra/core/database/database"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventV2 } from "@orchestra/core/event"
import { EventTable } from "@orchestra/core/event/sql"
import { FSUtil } from "@orchestra/core/fs-util"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionSchema } from "@orchestra/core/session"
import { ExecutionHost } from "@orchestra/core/session/runner"
import { SkillV2 } from "@orchestra/core/skill"
import { SessionDirectCommands } from "../src/session/runner/direct-commands"
import { tempLocationLayer } from "./fixture/location"
import { tmpdir } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"

const it = testEffect(AppNodeBuilder.build(
  LayerNode.group([Database.node, EventV2.node, FSUtil.node, SkillV2.node, Location.node]),
  [[Location.node, tempLocationLayer]],
))
const sessionID = SessionSchema.ID.make("ses_receipt")
const input = { sessionID, skill: "maestro-run-governed" }
const makeHost = (observeSkillLoad?: ExecutionHost.Interface["observeSkillLoad"]): ExecutionHost.Interface => ({
  id: "test", stateKey: "test", stream: () => Stream.empty, observeSkillLoad,
})

const fixture = Effect.gen(function* () {
  const tmp = yield* Effect.acquireRelease(Effect.promise(() => tmpdir()), (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()))
  yield* Effect.promise(async () => {
    await fs.mkdir(path.join(tmp.path, input.skill))
    await fs.writeFile(path.join(tmp.path, input.skill, "SKILL.md"), `---\nname: ${input.skill}\ndescription: Test\n---\nTrusted instructions\n`)
  })
  const skills = yield* SkillV2.Service
  yield* skills.transform((draft) => draft.source({ type: "directory", path: AbsolutePath.make(tmp.path) }, { reserved: true }))
  return { skills, events: yield* EventV2.Service, fs: yield* FSUtil.Service, database: yield* Database.Service }
})

it.live("receipts bind the committed synthetic material, exact host, and callback lifetime", () => Effect.gen(function* () {
  const deps = yield* fixture
  const other = makeHost()
  const captured: { receipt?: ExecutionHost.SkillLoadReceipt; facts?: ExecutionHost.SkillLoadFacts } = {}
  const host = makeHost((receipt) => Effect.gen(function* () {
    captured.receipt = receipt
    expect(ExecutionHost.consumeSkillLoad({ ...receipt }, host)).toBeUndefined()
    expect(ExecutionHost.consumeSkillLoad(receipt, other)).toBeUndefined()
    expect(() => JSON.stringify(receipt)).toThrow()
    const facts = ExecutionHost.consumeSkillLoad(receipt, host)
    expect(facts).toBeDefined()
    captured.facts = facts
    expect(ExecutionHost.consumeSkillLoad(receipt, host)).toBeUndefined()
    const rows = yield* deps.database.db.select().from(EventTable).where(eq(EventTable.aggregate_id, sessionID)).all().pipe(Effect.orDie)
    const row = rows.find((item) => item.type === "session.next.synthetic")
    expect(row?.data.messageID).toBe(facts?.loadedMessageID)
    expect(facts?.source.contentDigest).toBe(createHash("sha256").update(String(row?.data.text), "utf8").digest("hex"))
    expect(facts?.source.reserved).toBe(true)
    expect(Object.isFrozen(facts)).toBe(true)
    expect(Object.isFrozen(facts?.source)).toBe(true)
  }))
  expect(yield* SessionDirectCommands.skill({ ...deps, host }, input)).toBe(true)
  expect(captured.facts?.sessionID).toBe(sessionID)
  expect(ExecutionHost.consumeSkillLoad(captured.receipt, host)).toBeUndefined()
}))

it.live("expired and interrupted callbacks cannot leave a usable receipt", () => Effect.gen(function* () {
  const deps = yield* fixture
  const ready = yield* Deferred.make<ExecutionHost.SkillLoadReceipt>()
  const host = makeHost((receipt) => Deferred.succeed(ready, receipt).pipe(Effect.andThen(Effect.never)))
  const fiber = yield* Effect.forkChild(SessionDirectCommands.skill({ ...deps, host }, input))
  const receipt = yield* Deferred.await(ready)
  yield* Fiber.interrupt(fiber)
  expect(ExecutionHost.consumeSkillLoad(receipt, host)).toBeUndefined()
  const stored: { receipt?: ExecutionHost.SkillLoadReceipt } = {}
  const done = makeHost((receipt) => Effect.sync(() => { stored.receipt = receipt }))
  expect(yield* SessionDirectCommands.skill({ ...deps, host: done }, input)).toBe(true)
  expect(ExecutionHost.consumeSkillLoad(stored.receipt, done)).toBeUndefined()
}))

it.live("source revocation while an observer is suspended defeats consumption", () => Effect.gen(function* () {
  const deps = yield* fixture
  const ready = yield* Deferred.make<void>()
  const resume = yield* Deferred.make<void>()
  const seen: { facts?: ExecutionHost.SkillLoadFacts } = {}
  const host = makeHost((receipt) => Effect.gen(function* () {
    yield* Deferred.succeed(ready, undefined)
    yield* Deferred.await(resume)
    seen.facts = ExecutionHost.consumeSkillLoad(receipt, host)
  }))
  const fiber = yield* Effect.forkChild(SessionDirectCommands.skill({ ...deps, host }, input))
  yield* Deferred.await(ready)
  yield* deps.skills.reload()
  yield* Deferred.succeed(resume, undefined)
  expect(yield* Fiber.join(fiber)).toBe(false)
  expect(seen.facts).toBeUndefined()
}))

it.live("stale source, failed publication and absent provenance never notify", () => Effect.gen(function* () {
  const deps = yield* fixture
  const observed: unknown[] = []
  const host = makeHost((receipt) => Effect.sync(() => void observed.push(receipt)))
  const changing: EventV2.Interface = { ...deps.events, publish: (definition, data, options) =>
    deps.events.publish(definition, data, options).pipe(Effect.tap(() => deps.skills.reload())) }
  expect(yield* SessionDirectCommands.skill({ ...deps, events: changing, host }, input)).toBe(false)
  const missing = { ...deps.skills, sourceOf: undefined }
  expect(yield* SessionDirectCommands.skill({ ...deps, skills: missing, host }, input)).toBe(false)
  const failing: EventV2.Interface = { ...deps.events, publish: () => Effect.die("publish failed") }
  expect((yield* Effect.exit(SessionDirectCommands.skill({ ...deps, events: failing, host }, input)))._tag).toBe("Failure")
  expect(observed).toEqual([])
}))

it.live("an in-flight reload and an uncommitted event cannot mint", () => Effect.gen(function* () {
  const deps = yield* fixture
  const observed: unknown[] = []
  const host = makeHost((receipt) => Effect.sync(() => void observed.push(receipt)))
  const gated: FSUtil.Interface = { ...deps.fs, readDirectoryEntries: (directory) =>
    deps.fs.readDirectoryEntries(directory).pipe(Effect.tap(() => deps.skills.reload())) }
  expect(yield* SessionDirectCommands.skill({ ...deps, fs: gated, host }, input)).toBe(false)
  expect(yield* deps.events.transact(SessionDirectCommands.skill({ ...deps, host }, input))).toBe(false)
  expect(observed).toEqual([])
}))

it.live("no observer, a missing skill, and observer defects preserve the boolean contract", () => Effect.gen(function* () {
  const deps = yield* fixture
  expect(yield* SessionDirectCommands.skill(deps, input)).toBe(true)
  expect(yield* SessionDirectCommands.skill(deps, { ...input, skill: "missing" })).toBe(false)
  expect(yield* SessionDirectCommands.skill({ ...deps, host: makeHost(() => Effect.die("observer")) }, input)).toBe(false)
}))

it.live("sourceOf recognizes only current winning identity and revokes it after reload", () => Effect.gen(function* () {
  const deps = yield* fixture
  const found = (yield* deps.skills.list())[0]!
  const first = deps.skills.sourceOf?.(found)
  expect(first?.reserved).toBe(true)
  expect(deps.skills.sourceOf?.({ ...found })).toBeUndefined()
  expect(deps.skills.sourceOf?.(found)).toBe(first)
  yield* deps.skills.reload()
  expect(deps.skills.sourceOf?.(found)).toBeUndefined()
  const next = (yield* deps.skills.list())[0]!
  expect(deps.skills.sourceOf?.(next)).not.toBe(first)
}))

it.live("an embedded Info reused after reload cannot revive the old source pin", () => Effect.gen(function* () {
  const deps = yield* fixture
  const info = SkillV2.Info.make({ name: "embedded", content: "instructions", location: AbsolutePath.make("/embedded.md") })
  yield* deps.skills.transform((draft) => draft.source({ type: "embedded", skill: info }, { reserved: true }))
  const found = (yield* deps.skills.list()).find((item) => item.name === info.name)!
  const first = deps.skills.sourceOf?.(found)
  yield* deps.skills.reload()
  expect(deps.skills.sourceOf?.(found)).toBeUndefined()
  const next = (yield* deps.skills.list()).find((item) => item.name === info.name)!
  expect(next).toBe(found)
  expect(deps.skills.sourceOf?.(next)).not.toBe(first)
}))
