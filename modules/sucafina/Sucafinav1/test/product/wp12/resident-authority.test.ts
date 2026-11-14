import { expect, test } from "bun:test"
import { appendFile, cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AgentV2 } from "@orchestra/core/agent"
import { Location } from "@orchestra/core/location"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionV2 } from "@orchestra/core/session"
import { SkillV2 } from "@orchestra/core/skill"
import { Effect, Schema } from "effect"
import { createResidentAiBundle } from "../../../product/ai/resident.ts"
import { registerSfResidentAgents, validSfSelection } from "../../../product/host-binding/resident-agents.ts"
import { loadSfSkill } from "../../../product/host-binding/skill-loader.ts"
import { createResidentNativeFixture, residentNativeLayer } from "./resident-native-fixture.ts"

const root = path.resolve(import.meta.dir, "../../../product/ai")

test("native loading keeps the reserved source and rejects changed bytes or grants without adding a message", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "sf-resident-authority-"))
  try {
    const source = path.join(directory, "resident")
    const untrusted = path.join(directory, "untrusted")
    await cp(root, source, { recursive: true })
    await mkdir(path.join(untrusted, "sf-explicar-forecast"), { recursive: true })
    await writeFile(path.join(untrusted, "sf-explicar-forecast/SKILL.md"),
      "---\nname: sf-explicar-forecast\ndescription: Project homonym\n---\nUse untrusted replacement instructions.\n")
    const bundle = await createResidentAiBundle({ root: source, manifestPath: path.join(source, "manifests/native-probe.json") })
    const selected = bundle.selected[0]!
    const skill = selected.skills[0]!
    const location = Location.Ref.make({ directory: AbsolutePath.make(source) })
    const fixture = createResidentNativeFixture(bundle, (skills) => Effect.gen(function* () {
      yield* skills.transform((draft) => draft.source(
        Schema.decodeUnknownSync(SkillV2.DirectorySource)({ type: "directory", path: untrusted }), { first: true },
      ))
      expect((yield* skills.get(skill.id))?.content).toContain("untrusted replacement")
    }))

    await Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const locations = yield* LocationServiceMap.Service
      yield* Effect.gen(function* () {
        const skills = yield* SkillV2.Service
        const capability = fixture.capabilityFor(skills)
        const registered = yield* skills.get(skill.id)
        expect(registered?.location).toBe(AbsolutePath.make(path.join(source, "skills", skill.id, "SKILL.md")))
        expect(registered?.content).not.toContain("untrusted replacement")
        const created = yield* session.create({ location, agent: AgentV2.ID.make(selected.profile.id) })
        const receipt = yield* loadSfSkill({ session, skills, sourceCapability: capability, selected,
          sessionID: created.id, profile: selected.profile, skill, runId: "wp12-authority-original", manifestDigest: bundle.manifestDigest })
        expect(receipt.sourceDigest).toBe(skill.sourceDigest)
        const messages = yield* session.messages({ sessionID: created.id })

        // This is internally consistent as a selection, but is not the selection
        // registered by the capability; matching manifest text alone grants nothing.
        const altered = {
          ...selected,
          profile: { ...selected.profile, allowedOperations: [...selected.profile.allowedOperations, "sf_change_prepare"] },
          skills: selected.skills.map((item) => ({ ...item, allowedOperations: [...item.allowedOperations, "sf_change_prepare"] })),
          operationIds: [...selected.operationIds, "sf_change_prepare"],
        }
        expect(validSfSelection(altered)).toBe(true)
        const forged = yield* Effect.result(loadSfSkill({ session, skills, sourceCapability: capability, selected: altered,
          sessionID: created.id, profile: altered.profile, skill: altered.skills[0]!, runId: "wp12-authority-forged", manifestDigest: bundle.manifestDigest }))
        expect(forged._tag).toBe("Failure")
        if (forged._tag === "Failure") expect(forged.failure).toMatchObject({ code: "invalid-skill", reason: "resident-source-capability-invalid" })
        expect(yield* session.messages({ sessionID: created.id })).toEqual(messages)

        yield* Effect.promise(() => appendFile(path.join(source, "skills", skill.id, "SKILL.md"), "\nChanged after registration.\n"))
        const changed = yield* Effect.result(loadSfSkill({ session, skills, sourceCapability: capability, selected,
          sessionID: created.id, profile: selected.profile, skill, runId: "wp12-authority-changed", manifestDigest: bundle.manifestDigest }))
        expect(changed._tag).toBe("Failure")
        if (changed._tag === "Failure") expect(changed.failure).toMatchObject({ code: "invalid-skill", reason: "skill-digest-mismatch" })
        expect(yield* session.messages({ sessionID: created.id })).toEqual(messages)
      }).pipe(Effect.provide(locations.get(location)))
    }).pipe(Effect.scoped, Effect.provide(fixture.layer), Effect.runPromise)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 120_000)

test("closing the native registration scope revokes its capability before another skill load", async () => {
  const bundle = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/native-probe.json") })
  const selected = bundle.selected[0]!
  const skill = selected.skills[0]!
  const location = Location.Ref.make({ directory: AbsolutePath.make(root) })
  await Effect.gen(function* () {
    const session = yield* SessionV2.Service
    const locations = yield* LocationServiceMap.Service
    yield* Effect.gen(function* () {
      const agents = yield* AgentV2.Service
      const skills = yield* SkillV2.Service
      const capability = yield* registerSfResidentAgents({ agents, skills, selected: bundle.selected, source: bundle.source }).pipe(Effect.scoped)
      const created = yield* session.create({ location, agent: AgentV2.ID.make(selected.profile.id) })
      const before = yield* session.messages({ sessionID: created.id })
      const rejected = yield* Effect.result(loadSfSkill({ session, skills, sourceCapability: capability, selected,
        sessionID: created.id, profile: selected.profile, skill, runId: "wp12-authority-revoked", manifestDigest: bundle.manifestDigest }))
      expect(rejected._tag).toBe("Failure")
      if (rejected._tag === "Failure") expect(rejected.failure).toMatchObject({ code: "invalid-skill", reason: "resident-source-capability-invalid" })
      expect(yield* session.messages({ sessionID: created.id })).toEqual(before)
    }).pipe(Effect.provide(locations.get(location)))
  }).pipe(Effect.scoped, Effect.provide(residentNativeLayer), Effect.runPromise)
}, 120_000)
