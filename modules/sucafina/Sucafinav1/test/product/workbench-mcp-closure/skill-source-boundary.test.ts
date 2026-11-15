import { expect, test } from "bun:test"
import type { BunFile } from "bun"
import { AgentV2 } from "@orchestra/core/agent"
import { Effect } from "effect"
import { sfSourceFor } from "../../../product/host-binding/resident-agents.ts"
import { loadSfSkill } from "../../../product/host-binding/skill-loader.ts"
import { withSkillHost } from "./skill-host-fixture.ts"

/** Gate one completion after the real bytes were read. This changes scheduling only:
 * SessionV2, its persisted message, the filesystem bytes and source disposal remain real.
 */
function holdSecondRead(location: string) {
  const file = Bun.file(location)
  let prototype = Object.getPrototypeOf(file)
  while (prototype && !Object.hasOwn(prototype, "arrayBuffer")) prototype = Object.getPrototypeOf(prototype)
  const descriptor = prototype && Object.getOwnPropertyDescriptor(prototype, "arrayBuffer")
  if (!descriptor || typeof descriptor.value !== "function") throw new Error("BunFile arrayBuffer descriptor unavailable")
  const read = file.arrayBuffer
  let enter = () => {}
  let release = () => {}
  const entered = new Promise<void>((resolve) => { enter = resolve })
  const released = new Promise<void>((resolve) => { release = resolve })
  let reads = 0
  Object.defineProperty(prototype, "arrayBuffer", {
    ...descriptor,
    value: async function (this: BunFile) {
      const bytes = await read.call(this)
      if (this.name === location && ++reads === 2) {
        enter()
        await released
      }
      return bytes
    },
  })
  return { entered, release, reads: () => reads, restore: () => Object.defineProperty(prototype, "arrayBuffer", descriptor) }
}

test("real source disposal during the last digest read cannot issue a skill receipt", async () => {
  let release = () => {}
  let restore = () => {}
  let pending: Promise<unknown> | undefined
  try {
    const closed = await withSkillHost((host) => Effect.gen(function* () {
      const selected = host.bundle.selected.find((item) => item.profile.id === "sf_finance")!
      const skill = selected.skills.find((item) => item.id === "sf-explicar-forecast")!
      const file = yield* host.skills.get(skill.id)
      if (!file) throw new Error("Distributed fixture skill missing")
      const created = yield* host.session.create({ location: host.location, agent: AgentV2.ID.make(selected.profile.id) })
      const input = { session: host.session, skills: host.skills, sourceCapability: host.sourceCapability,
        selected, sessionID: created.id, profile: selected.profile, skill,
        runId: "component-revocation-during-read", manifestDigest: host.bundle.manifestDigest }
      const gate = holdSecondRead(file.location)
      release = gate.release
      restore = gate.restore
      // A detached observation allows the real host scope to close while its last read is held.
      const loaded = Effect.runPromise(loadSfSkill(input).pipe(Effect.result))
      pending = loaded
      yield* Effect.promise(() => Promise.race([
        gate.entered,
        loaded.then(() => { throw new Error("Loader settled before its final file read") }),
      ]))
      expect(gate.reads()).toBe(2)
      expect(sfSourceFor(host.sourceCapability, host.skills, selected)).toBeDefined()
      const messages = yield* host.session.messages({ sessionID: created.id })
      expect(messages).toHaveLength(1)
      expect(messages[0]?.type).toBe("synthetic")
      return { loaded, input, messageID: messages[0]!.id }
    }))
    // The production contribution's scoped finalizer revoked the opaque capability.
    expect(sfSourceFor(closed.input.sourceCapability, closed.input.skills, closed.input.selected)).toBeUndefined()
    release()
    const result = await closed.loaded
    expect(result._tag).toBe("Failure")
    if (result._tag === "Failure") expect(result.failure).toEqual({ code: "invalid-skill", reason: "skill-source-changed" })
    console.info("SF68_SKILL_REVOCATION", JSON.stringify({
      scope: "real source finalizer and SessionV2 message; delayed real file-read completion; no provider execution",
      sessionID: closed.input.sessionID, observedMessageID: closed.messageID,
      receiptIssued: result._tag === "Success", reason: result._tag === "Failure" ? result.failure.reason : undefined,
    }))
  } finally {
    release()
    await pending?.catch(() => undefined)
    restore()
  }
}, 30_000)
