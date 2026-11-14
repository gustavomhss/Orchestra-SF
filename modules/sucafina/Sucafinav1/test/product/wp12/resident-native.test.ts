import { expect, test } from "bun:test"
import path from "node:path"
import { AgentV2 } from "@orchestra/core/agent"
import { Location } from "@orchestra/core/location"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionV2 } from "@orchestra/core/session"
import { SkillV2 } from "@orchestra/core/skill"
import { Effect } from "effect"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { createResidentAiBundle } from "../../../product/ai/resident.ts"
import { validSfSelection } from "../../../product/host-binding/resident-agents.ts"
import { loadSfSkill } from "../../../product/host-binding/skill-loader.ts"
import { createResidentNativeFixture } from "./resident-native-fixture.ts"

const root = path.resolve(import.meta.dir, "../../../product/ai")

// This exercises real AgentV2 registration and SessionV2.skill loading. No inference,
// domain operation, persisted contribution or consumer witness is implied by a load.
test("five profiles register and all eighteen distributed skills load into distinct native sessions", async () => {
  // Resolving the real Git Location invokes canonical Git/AppProcess discovery.
  expectSpawn(import.meta.path)
  const bundle = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/resident.json") })
  expect(bundle.selected).toHaveLength(5)
  expect(bundle.selected.every(validSfSelection)).toBe(true)
  const maestro = bundle.selected.find((selection) => selection.profile.id === "sf_maestro")!
  expect(maestro.profile.allowedOperations).toContain("sf_watch_prepare")
  expect(maestro.operationIds).not.toContain("sf_watch_prepare")
  const portfolio = bundle.selected.find((selection) => selection.profile.id === "sf_portfolio")!
  expect(portfolio.profile.outputTypes).toContain("AlternativeDraft")
  expect(portfolio.skills.find((skill) => skill.id === "sf-compor-portfolio")!.outputSchemaRefs).toContain("AlternativeDraft")

  const fixture = createResidentNativeFixture(bundle)
  const location = Location.Ref.make({ directory: AbsolutePath.make(root) })
  const receipts = await Effect.gen(function* () {
    const session = yield* SessionV2.Service
    const locations = yield* LocationServiceMap.Service
    return yield* Effect.gen(function* () {
      const agents = yield* AgentV2.Service
      const skills = yield* SkillV2.Service
      const capability = fixture.capabilityFor(skills)
      yield* Effect.forEach(bundle.selected, (selection) => Effect.gen(function* () {
        const registered = yield* agents.get(AgentV2.ID.make(selection.profile.id))
        expect(registered?.engine).toBe("orchestra")
        expect(registered?.steps).toBe(selection.profile.maxSteps)
        expect(registered?.permissions).toContainEqual({ action: "*", resource: "*", effect: "deny" })
        expect(registered?.permissions.filter((rule) => rule.effect === "allow" && rule.action.startsWith("sf_"))
          .map((rule) => rule.action).sort()).toEqual([...selection.operationIds].sort())
      }))
      const registered = yield* agents.get(AgentV2.ID.make("sf_maestro"))
      expect(registered?.engine).toBe("orchestra")
      expect(registered?.permissions).toContainEqual({ action: "*", resource: "*", effect: "deny" })
      expect(registered?.permissions.some((rule) => rule.action === "sf_watch_prepare" && rule.effect === "allow")).toBe(false)

      return yield* Effect.forEach(bundle.skills, (skill) => Effect.gen(function* () {
        const selected = bundle.selected.find((selection) => selection.skills.some((item) => item.id === skill.id))!
        const created = yield* session.create({ location, agent: AgentV2.ID.make(selected.profile.id) })
        const receipt = yield* loadSfSkill({ session, skills, sourceCapability: capability, selected,
          sessionID: created.id, profile: selected.profile, skill, runId: `wp12-load-${skill.id}`, manifestDigest: bundle.manifestDigest }).pipe(
          Effect.tapError((error) => Effect.sync(() => console.error("WP12 native skill load failed:", JSON.stringify({ profileId: selected.profile.id, skillId: skill.id, sessionID: created.id, error })))),
        )
        const messages = yield* session.messages({ sessionID: created.id })
        const loaded = messages.find((message) => message.id === receipt.loadedMessageId)
        const source = yield* skills.get(skill.id)
        expect(loaded?.type).toBe("synthetic")
        expect(loaded?.type === "synthetic" && loaded.text.includes(source!.content.trim())).toBe(true)
        expect(receipt).toMatchObject({ profileId: selected.profile.id, skillId: skill.id, nativeSessionId: created.id,
          sourceDigest: skill.sourceDigest, instructionsDigest: skill.instructionsDigest, manifestDigest: bundle.manifestDigest })
        if (skill.id === "sf-explicar-forecast") {
          const forbidden = bundle.skills.find((item) => item.id === "sf-preparar-compra")!
          const rejected = yield* Effect.result(loadSfSkill({ session, skills, sourceCapability: capability, selected,
            sessionID: created.id, profile: selected.profile, skill: forbidden, runId: "wp12-forbidden", manifestDigest: bundle.manifestDigest }))
          expect(rejected._tag).toBe("Failure")
          if (rejected._tag === "Failure") expect(rejected.failure).toMatchObject({ code: "invalid-skill" })
          expect(yield* session.messages({ sessionID: created.id })).toEqual(messages)
        }
        return receipt
      }))
    }).pipe(Effect.provide(locations.get(location)))
  }).pipe(Effect.scoped, Effect.provide(fixture.layer), Effect.runPromise)
  expect(receipts).toHaveLength(18)
  expect(new Set(receipts.map((receipt) => receipt.nativeSessionId)).size).toBe(18)
  expect(new Set(receipts.map((receipt) => receipt.loadedMessageId)).size).toBe(18)
  expect(new Set(receipts.map((receipt) => receipt.skillId))).toEqual(new Set(bundle.skills.map((skill) => skill.id)))
  console.log("WP12 native skill loads:", JSON.stringify({ scope: "registration-and-load-only", receipts }))
}, 120_000)

test("native probe registration grants only its one announced operation", async () => {
  const bundle = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/native-probe.json") })
  expect(bundle.selected).toHaveLength(1)
  expect(bundle.selected[0]!.skills.map((skill) => skill.id)).toEqual(["sf-explicar-forecast"])
  expect(bundle.selected[0]!.operationIds).toEqual(["sf_forecast_compare"])
  expect(validSfSelection(bundle.selected[0]!)).toBe(true)
})
