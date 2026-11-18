import { expect, test } from "bun:test"
import { mkdir, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { AgentV2 } from "@orchestra/core/agent"
import { PermissionV2 } from "@orchestra/core/permission"
import { SessionV2 } from "@orchestra/core/session"
import { Effect } from "effect"
import type { SkillLoadReceipt } from "../../../product/contracts/resident-ai.ts"
import type { SfSourceCapability } from "../../../product/contracts/runtime.ts"
import { loadSfSkill } from "../../../product/host-binding/skill-loader.ts"
import { withSkillHost } from "./skill-host-fixture.ts"

test("public SF host loads 18 distributed skills for all 25 authorized profile bindings into real SessionV2 messages", async () => {
  const receipts = await withSkillHost((host) => Effect.gen(function* () {
    expect(host.bundle.selected).toHaveLength(5)
    expect(host.bundle.skills).toHaveLength(18)
    const loaded: SkillLoadReceipt[] = []
    for (const selected of host.bundle.selected) {
      const agent = yield* host.agents.get(AgentV2.ID.make(selected.profile.id))
      if (!agent) throw new Error(`Resident profile not installed: ${selected.profile.id}`)
      expect(agent.engine).toBe("orchestra")
      expect(agent.system).toBe(selected.profile.mission)
      expect(agent.steps).toBe(selected.profile.maxSteps)
      for (const forbidden of ["bash", "edit", "write", "maestro_approve", "sf_apply", "sf_approve", "mcp__untrusted__tool"])
        expect(PermissionV2.evaluate(forbidden, "*", agent.permissions).effect).toBe("deny")
      for (const operation of selected.operationIds)
        expect(PermissionV2.evaluate(operation, "*", agent.permissions).effect).toBe("allow")
      for (const skill of host.bundle.skills.filter((skill) => !selected.skills.some((allowed) => allowed.id === skill.id)))
        expect(PermissionV2.evaluate("skill", skill.id, agent.permissions).effect).toBe("deny")
      const created = yield* host.session.create({ location: host.location, agent: agent.id })
      expect(created.agent).toBe(AgentV2.ID.make(selected.profile.id))
      for (const skill of selected.skills) {
        expect(PermissionV2.evaluate("skill", skill.id, agent.permissions).effect).toBe("allow")
        const before = yield* host.session.messages({ sessionID: created.id })
        const receipt = yield* loadSfSkill({
          session: host.session, skills: host.skills, sourceCapability: host.sourceCapability,
          selected, sessionID: created.id, profile: selected.profile, skill,
          runId: `component-load-${selected.profile.id}-${skill.id}`, manifestDigest: host.bundle.manifestDigest,
        })
        const messages = yield* host.session.messages({ sessionID: created.id, order: "asc" })
        const newlyLoaded = messages.filter((message) => !before.some((prior) => prior.id === message.id))
        expect(newlyLoaded).toHaveLength(1)
        const observed = newlyLoaded[0]!
        expect(receipt).toMatchObject({
          nativeSessionId: created.id, profileId: selected.profile.id, profileVersion: selected.profile.version,
          profileDigest: selected.profile.sourceDigest, skillId: skill.id, skillVersion: skill.version,
          sourceDigest: skill.sourceDigest, instructionsDigest: skill.instructionsDigest,
          manifestDigest: host.bundle.manifestDigest, loadedMessageId: observed.id,
        })
        expect(observed.type).toBe("synthetic")
        if (observed.type !== "synthetic") throw new Error("SessionV2 did not persist its skill context")
        const file = yield* host.skills.get(skill.id)
        if (!file) throw new Error("Loaded skill disappeared")
        expect(observed.text).toContain(`<skill_content name="${skill.id}">\n# Skill: ${skill.id}\n\n${file.content.trim()}\n\n`)
        expect(new Bun.CryptoHasher("sha256").update(file.content.trim()).digest("hex")).toBe(receipt.instructionsDigest)
        expect(yield* host.session.message({ sessionID: created.id, messageID: observed.id })).toEqual(observed)
        expect((yield* host.session.context(created.id)).find((message) => message.id === observed.id)).toEqual(observed)
        loaded.push(receipt)
      }
      // These are observed loader receipts. No provider result, Task or business output is implied.
      expect((yield* host.session.messages({ sessionID: created.id })).every((message) => message.type === "synthetic")).toBe(true)
    }
    expect(yield* host.session.active).toEqual(new Set())
    return loaded
  }))
  expect(receipts).toHaveLength(25)
  expect(new Set(receipts.map((receipt) => receipt.loadedMessageId)).size).toBe(25)
  expect(new Set(receipts.map((receipt) => receipt.skillId)).size).toBe(18)
  expect(new Set(receipts.map((receipt) => receipt.profileId)).size).toBe(5)
  console.info("SF68_SKILL_LOAD_RECEIPTS", JSON.stringify({
    scope: "real SessionV2.skill load only; synthetic run labels; no Task or provider execution",
    receipts,
  }))
}, 30_000)

test("real loader rejects copied capability, changed manifest and forged grants without inserting context", async () => {
  await withSkillHost((host) => Effect.gen(function* () {
    const selected = host.bundle.selected.find((item) => item.profile.id === "sf_finance")!
    const skill = selected.skills.find((item) => item.id === "sf-explicar-forecast")!
    const created = yield* host.session.create({ location: host.location, agent: AgentV2.ID.make(selected.profile.id) })
    const input = { session: host.session, skills: host.skills, sourceCapability: host.sourceCapability,
      selected, sessionID: created.id, profile: selected.profile, skill, runId: "component-negative", manifestDigest: host.bundle.manifestDigest }
    for (const changed of [
      { ...input, sourceCapability: {} as SfSourceCapability },
      { ...input, manifestDigest: "0".repeat(64) },
      { ...input, profile: { ...input.profile, allowedSkills: [...input.profile.allowedSkills, "sf-unknown"] } },
      { ...input, skill: { ...skill, instructionsDigest: "0".repeat(64) } },
    ]) {
      const result = yield* Effect.result(loadSfSkill(changed))
      expect(result._tag).toBe("Failure")
      if (result._tag === "Failure") expect(result.failure).toEqual({ code: "invalid-skill", reason: "resident-source-capability-invalid" })
      expect(yield* host.session.messages({ sessionID: created.id })).toEqual([])
    }
    const missing = yield* Effect.result(loadSfSkill({ ...input, sessionID: SessionV2.ID.make("ses_sf68_missing") }))
    expect(missing._tag).toBe("Failure")
    if (missing._tag === "Failure") expect(missing.failure).toEqual({ code: "unavailable", reason: "session-messages-unavailable" })
  }))
}, 30_000)

test("source capability cannot be transplanted between actual Location services", async () => {
  await withSkillHost((host) => Effect.gen(function* () {
    const selected = host.bundle.selected.find((item) => item.profile.id === "sf_finance")!
    const otherDirectory = path.join(host.directory, "other-project")
    yield* Effect.promise(() => mkdir(otherDirectory))
    const other = yield* host.at(otherDirectory)
    expect(other.skills).not.toBe(host.skills)
    expect(other.sourceCapability).not.toBe(host.sourceCapability)
    const created = yield* host.session.create({ location: other.location, agent: AgentV2.ID.make(selected.profile.id) })
    const result = yield* Effect.result(loadSfSkill({
      session: host.session, skills: other.skills, sourceCapability: host.sourceCapability,
      selected, sessionID: created.id, profile: selected.profile, skill: selected.skills[0]!,
      runId: "component-cross-location", manifestDigest: host.bundle.manifestDigest,
    }))
    expect(result._tag).toBe("Failure")
    if (result._tag === "Failure") expect(result.failure.reason).toBe("resident-source-capability-invalid")
    expect(yield* host.session.messages({ sessionID: created.id })).toEqual([])
  }))
}, 30_000)

test("source bytes changed or removed after public registration never receive a loading receipt", async () => {
  await withSkillHost((host) => Effect.gen(function* () {
    const selected = host.bundle.selected.find((item) => item.profile.id === "sf_finance")!
    const skill = selected.skills.find((item) => item.id === "sf-explicar-forecast")!
    const created = yield* host.session.create({ location: host.location, agent: AgentV2.ID.make(selected.profile.id) })
    const input = { session: host.session, skills: host.skills, sourceCapability: host.sourceCapability,
      selected, sessionID: created.id, profile: selected.profile, skill, runId: "component-source-change", manifestDigest: host.bundle.manifestDigest }
    const file = yield* host.skills.get(skill.id)
    if (!file) throw new Error("Distributed fixture skill missing")
    yield* Effect.promise(() => writeFile(file.location, "---\nname: sf-explicar-forecast\ndescription: Changed\n---\nChanged instructions\n"))
    const changed = yield* Effect.result(loadSfSkill(input))
    expect(changed._tag).toBe("Failure")
    if (changed._tag === "Failure") expect(changed.failure).toEqual({ code: "invalid-skill", reason: "skill-digest-mismatch" })
    yield* Effect.promise(() => unlink(file.location))
    const missing = yield* Effect.result(loadSfSkill(input))
    expect(missing._tag).toBe("Failure")
    if (missing._tag === "Failure") expect(missing.failure).toEqual({ code: "invalid-skill", reason: "skill-source-unavailable" })
    expect(yield* host.session.messages({ sessionID: created.id })).toEqual([])
  }))
}, 30_000)
