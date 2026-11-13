import path from "node:path"
import { realpath } from "node:fs/promises"
import { Effect } from "effect"
import { digestSfValue } from "../contracts/canonical.ts"
import { sfSourceFor, validSfSelection } from "./resident-agents.ts"
import type { LoadSfSkill } from "../contracts/runtime.ts"

/** A receipt is created only for a uniquely observed SessionV2 skill message. */
export const loadSfSkill: LoadSfSkill = (input) => Effect.gen(function* () {
  const source = sfSourceFor(input.sourceCapability, input.skills, input.selected)
  if (!source || !validSfSelection(input.selected) || digestSfValue(input.profile) !== digestSfValue(input.selected.profile) ||
    input.manifestDigest !== input.selected.manifestDigest || !input.selected.skills.some((skill) => digestSfValue(skill) === digestSfValue(input.skill)))
    return yield* Effect.fail({ code: "invalid-skill", reason: "resident-source-capability-invalid" } as const)
  if (!input.profile.allowedSkills.includes(input.skill.id) || !input.skill.allowedProfiles.includes(input.profile.id) ||
    !input.runId || !/^[a-f0-9]{64}$/.test(input.manifestDigest))
    return yield* Effect.fail({ code: "invalid-skill", reason: "skill-not-granted" } as const)
  const skill = yield* input.skills.get(input.skill.id)
  if (!skill || skill.name !== input.skill.id || path.basename(skill.location) !== "SKILL.md" ||
    path.basename(path.dirname(skill.location)) !== input.skill.id ||
    !input.skill.sourcePath.endsWith(`/${input.skill.id}/SKILL.md`))
    return yield* Effect.fail({ code: "invalid-skill", reason: "skill-not-found" } as const)
  const sources = yield* input.skills.sources()
  const owner = sources.filter((source) => source.type === "directory" && (() => {
    const relative = path.relative(source.path, skill.location)
    return !!relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
  })())
  const directory = owner[0]
  if (owner.length !== 1 || !directory || directory.type !== "directory")
    return yield* Effect.fail({ code: "invalid-skill", reason: "skill-source-owner-ambiguous" } as const)
  const physical = yield* Effect.tryPromise({
    try: () => Promise.all([realpath(directory.path), realpath(skill.location)]),
    catch: () => ({ code: "invalid-skill", reason: "skill-source-unavailable" } as const),
  })
  const relative = path.relative(physical[0]!, physical[1]!)
  if (directory.path !== source.root || physical[0] !== source.physical || !relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    return yield* Effect.fail({ code: "invalid-skill", reason: "skill-source-escapes-root" } as const)
  const bytes = yield* Effect.tryPromise({
    try: () => Bun.file(skill.location).arrayBuffer(),
    catch: () => ({ code: "invalid-skill", reason: "skill-source-unavailable" } as const),
  })
  const sourceDigest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
  const instructionsDigest = new Bun.CryptoHasher("sha256").update(skill.content.trim()).digest("hex")
  if (sourceDigest !== input.skill.sourceDigest || instructionsDigest !== input.skill.instructionsDigest)
    return yield* Effect.fail({ code: "invalid-skill", reason: "skill-digest-mismatch" } as const)
  const before = yield* input.session.messages({ sessionID: input.sessionID }).pipe(
    Effect.mapError(() => ({ code: "unavailable", reason: "session-messages-unavailable" } as const)),
  )
  yield* input.session.skill({ sessionID: input.sessionID, skill: input.skill.id, resume: false }).pipe(
    Effect.mapError(() => ({ code: "invalid-skill", reason: "skill-load-failed" } as const)),
  )
  const after = yield* input.session.messages({ sessionID: input.sessionID }).pipe(
    Effect.mapError(() => ({ code: "unavailable", reason: "session-messages-unavailable" } as const)),
  )
  const seen = new Set(before.map((message) => message.id))
  const added = after.filter((message) => !seen.has(message.id))
  const message = added.length === 1 ? added[0] : undefined
  const prefix = `<skill_content name="${skill.name}">\n# Skill: ${skill.name}\n\n${skill.content.trim()}\n\n`
  const suffix = `Base directory for this skill: ${path.dirname(skill.location)}\nRelative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.\nNote: file list is sampled.\n\n<skill_files>\n`
  if (!message || message.type !== "synthetic" || !message.id || !message.text.startsWith(prefix + suffix) ||
    !message.text.endsWith("\n</skill_files>\n</skill_content>"))
    return yield* Effect.fail({ code: "invalid-skill", reason: "skill-message-unverified" } as const)
  const sample = message.text.slice((prefix + suffix).length, -"</skill_files>\n</skill_content>".length)
  if (sample.split("\n").filter(Boolean).some((line) => {
    const match = /^<file>([^<>\n]+)<\/file>$/.exec(line)
    if (!match) return true
    const relative = path.relative(path.dirname(skill.location), match[1]!)
    return !relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
  })) return yield* Effect.fail({ code: "invalid-skill", reason: "skill-message-file-list-invalid" } as const)
  const current = yield* input.skills.get(input.skill.id)
  const currentPhysical = yield* Effect.tryPromise({
    try: () => Promise.all([realpath(directory.path), realpath(skill.location)]),
    catch: () => ({ code: "invalid-skill", reason: "skill-source-unavailable" } as const),
  })
  if (currentPhysical[0] !== physical[0] || currentPhysical[1] !== physical[1] || !sfSourceFor(input.sourceCapability, input.skills, input.selected) || !current || current.location !== skill.location || current.content !== skill.content ||
    new Bun.CryptoHasher("sha256").update(yield* Effect.tryPromise({
      try: () => Bun.file(skill.location).arrayBuffer(),
      catch: () => ({ code: "invalid-skill", reason: "skill-source-unavailable" } as const),
    })).digest("hex") !== sourceDigest)
    return yield* Effect.fail({ code: "invalid-skill", reason: "skill-source-changed" } as const)
  return {
    runId: input.runId, nativeSessionId: input.sessionID, profileId: input.profile.id,
    profileVersion: input.profile.version, profileDigest: input.profile.sourceDigest,
    skillId: input.skill.id, skillVersion: input.skill.version, sourceDigest, instructionsDigest,
    loadedMessageId: message.id, loadedAt: new Date().toISOString(), manifestDigest: input.manifestDigest,
  }
})
