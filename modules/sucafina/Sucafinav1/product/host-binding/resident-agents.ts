import path from "node:path"
import { AgentV2 } from "@orchestra/core/agent"
import { Effect } from "effect"
import type { RegisterSfResidentAgents } from "../contracts/runtime.ts"

/** Install SF agents and their reserved source in the owning Location scope. */
export const registerSfResidentAgents: RegisterSfResidentAgents = (input) => Effect.gen(function* () {
  if (input.source.type !== "directory" || input.profiles.length === 0 ||
    new Set(input.profiles.map((profile) => profile.id)).size !== input.profiles.length ||
    input.profiles.some((profile) => !profile.mission || !profile.version || !profile.allowedSkills.length ||
      !Number.isSafeInteger(profile.maxSteps) || profile.maxSteps <= 0))
    return yield* Effect.fail({ code: "invalid-manifest", reason: "invalid-resident-profiles" } as const)
  const root = input.source.path
  const sources = yield* input.skills.sources()
  if (sources.some((source) => source.type === "directory" && source.path === root))
    return yield* Effect.fail({ code: "invalid-manifest", reason: "resident-source-already-registered" } as const)
  yield* input.skills.transform((draft) => draft.source(input.source, { first: true, reserved: true }))
  const found = yield* input.skills.list()
  if (input.profiles.flatMap((profile) => profile.allowedSkills).some((name) => !found.some((skill) => skill.name === name)))
    return yield* Effect.fail({ code: "invalid-skill", reason: "resident-skill-missing" } as const)
  if (input.profiles.flatMap((profile) => profile.allowedSkills).some((name) => {
    const skill = found.find((item) => item.name === name)
    if (!skill) return true
    const relative = path.relative(root, skill.location)
    return !relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
  })) return yield* Effect.fail({ code: "invalid-skill", reason: "resident-source-collision" } as const)
  yield* input.agents.transform((draft) => {
    input.profiles.forEach((profile) => draft.update(AgentV2.ID.make(profile.id), (agent) => {
      agent.engine = "orchestra"
      agent.system = profile.mission
      agent.description = profile.mission
      agent.mode = "primary"
      agent.hidden = false
      agent.steps = profile.maxSteps
      agent.permissions.push(
        { action: "*", resource: "*", effect: "deny" },
        ...profile.allowedSkills.map((skill) => ({ action: "skill", resource: skill, effect: "allow" as const })),
        ...profile.allowedOperations.map((operation) => ({ action: operation, resource: "*", effect: "allow" as const })),
      )
    }))
  })
})
