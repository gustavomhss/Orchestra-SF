import path from "node:path"
import { realpath } from "node:fs/promises"
import { AgentV2 } from "@orchestra/core/agent"
import type { SkillV2 } from "@orchestra/core/skill"
import { Effect } from "effect"
import { digestSfValue } from "../contracts/canonical.ts"
import type { RegisterSfResidentAgents, SfSelectedRuntime, SfSourceCapability } from "../contracts/runtime.ts"

const sources = new WeakMap<SfSourceCapability, { skills: SkillV2.Interface; root: string; physical: string; selections: readonly SfSelectedRuntime[]; active: boolean }>()

export function validSfSelection(selected: SfSelectedRuntime) {
  return /^[a-f0-9]{64}$/.test(selected.manifestDigest) && selected.skills.length > 0 &&
    new Set(selected.skills.map((skill) => skill.id)).size === selected.skills.length &&
    new Set(selected.operationIds).size === selected.operationIds.length &&
    selected.skills.every((skill) => selected.profile.allowedSkills.includes(skill.id) && skill.allowedProfiles.includes(selected.profile.id) &&
      skill.allowedOperations.every((operation) => selected.profile.allowedOperations.includes(operation))) &&
    selected.operationIds.every((operation) => selected.profile.allowedOperations.includes(operation) &&
      selected.skills.some((skill) => skill.allowedOperations.includes(operation)))
}

export function sfSourceFor(capability: SfSourceCapability, skills: SkillV2.Interface, selected: SfSelectedRuntime) {
  const source = sources.get(capability)
  if (!source?.active || source.skills !== skills || !validSfSelection(selected) || !source.selections.some((registered) =>
    registered.manifestDigest === selected.manifestDigest && digestSfValue(registered.profile) === digestSfValue(selected.profile) &&
    selected.skills.every((skill) => registered.skills.some((original) => digestSfValue(original) === digestSfValue(skill))) &&
    selected.operationIds.every((operation) => registered.operationIds.includes(operation)))) return undefined
  return Object.freeze({ root: source.root, physical: source.physical })
}

/** Install SF agents and their reserved source in the owning Location scope. */
export const registerSfResidentAgents: RegisterSfResidentAgents = (input) => Effect.gen(function* () {
  if (input.source.type !== "directory" || input.selected.length === 0 ||
    new Set(input.selected.map((selected) => selected.profile.id)).size !== input.selected.length ||
    input.selected.some((selected) => !validSfSelection(selected) || !selected.profile.mission || !selected.profile.version ||
      !Number.isSafeInteger(selected.profile.maxSteps) || selected.profile.maxSteps <= 0))
    return yield* Effect.fail({ code: "invalid-manifest", reason: "invalid-resident-profiles" } as const)
  const selected = structuredClone(input.selected)
  const source = { ...input.source }
  const root = source.path
  const physical = yield* Effect.tryPromise({ try: () => realpath(root), catch: () => ({ code: "invalid-skill", reason: "resident-source-unavailable" } as const) })
  const current = yield* input.skills.sources()
  if (current.some((source) => source.type === "directory" && source.path === root))
    return yield* Effect.fail({ code: "invalid-manifest", reason: "resident-source-already-registered" } as const)
  yield* input.skills.transform((draft) => draft.source(source, { first: true, reserved: true }))
  const found = yield* input.skills.list()
  const names = selected.flatMap((selected) => selected.skills.map((skill) => skill.id))
  if (names.some((name) => !found.some((skill) => skill.name === name)))
    return yield* Effect.fail({ code: "invalid-skill", reason: "resident-skill-missing" } as const)
  if (names.some((name) => {
    const skill = found.find((item) => item.name === name)
    if (!skill) return true
    const relative = path.relative(root, skill.location)
    return !relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
  })) return yield* Effect.fail({ code: "invalid-skill", reason: "resident-source-collision" } as const)
  yield* input.agents.transform((draft) => {
    selected.forEach((selected) => draft.update(AgentV2.ID.make(selected.profile.id), (agent) => {
      agent.engine = "orchestra"
      agent.system = selected.profile.mission
      agent.description = selected.profile.mission
      agent.mode = "primary"
      agent.hidden = false
      agent.steps = selected.profile.maxSteps
      agent.permissions.push(
        { action: "*", resource: "*", effect: "deny" },
        ...selected.skills.map((skill) => ({ action: "skill", resource: skill.id, effect: "allow" as const })),
        ...selected.operationIds.map((operation) => ({ action: operation, resource: "*", effect: "allow" as const })),
      )
    }))
  })
  const capability = Object.freeze({}) as SfSourceCapability
  const state = { skills: input.skills, root, physical, selections: selected, active: true }
  sources.set(capability, state)
  yield* Effect.addFinalizer(() => Effect.sync(() => { state.active = false }))
  return capability
})
