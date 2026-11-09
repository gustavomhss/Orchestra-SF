import { Option, Schema } from "effect"

export type SkillEntry = {
  name: string
  description?: string | null
  location: string
  content: string
  mtime?: number | null
  internal?: boolean | null
}

export type SkillCatalogEntry = Omit<SkillEntry, "content">

const Metadata = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.NullOr(Schema.String)),
  location: Schema.String,
  mtime: Schema.optional(Schema.NullOr(Schema.Number)),
  internal: Schema.optional(Schema.NullOr(Schema.Boolean)),
})
const decodeCatalog = Schema.decodeUnknownOption(Schema.Array(Metadata))

const decodeSkills = Schema.decodeUnknownOption(
  Schema.Array(
    Schema.Struct({
      name: Schema.String,
      description: Schema.optional(Schema.NullOr(Schema.String)),
      location: Schema.String,
      content: Schema.String,
      mtime: Schema.optional(Schema.NullOr(Schema.Number)),
      internal: Schema.optional(Schema.NullOr(Schema.Boolean)),
    }),
  ),
)

// The catalog reply is untrusted: a malformed one fails the load, which the page shows as its error with Retry.
export function readSkills(value: unknown): readonly SkillEntry[] {
  return Option.getOrThrowWith(decodeSkills(value), () => new Error("Skills response is malformed"))
}

/** Strip legacy bodies too: the warm catalog never needs to retain instruction text. */
export function readSkillCatalog(value: unknown): readonly SkillCatalogEntry[] {
  return Option.getOrThrowWith(decodeCatalog(value), () => new Error("Skills response is malformed"))
}

/** A refreshed name must not silently open a different source file than the selected card. */
export function readSkill(value: unknown, selected: SkillCatalogEntry): SkillEntry {
  const skill = readSkills([value])[0]
  if (!skill || skill.name !== selected.name || skill.location !== selected.location)
    throw new Error("Skill changed since the catalog was loaded. Reload the catalog and try again.")
  return skill
}

/** Old servers do not expose the split routes. Other failures must remain failures, not extra requests. */
export async function skillReply(current: () => Promise<unknown>, legacy: () => Promise<unknown>) {
  return current().catch((error: unknown) => {
    const cause = error instanceof Error ? error.cause : undefined
    const status = cause && typeof cause === "object" && "status" in cause ? cause.status : undefined
    if (status === 404 || status === 405 || status === 501) return legacy()
    throw error
  })
}

/** Skills for agent use only declare `internal: true` in their frontmatter; the server reports it and the catalog does not list them. */
export function isInternalSkill(skill: Pick<SkillEntry, "internal">) {
  return skill.internal === true
}

/**
 * The skills the catalog lists: neither internal nor a skill tree node. A node is a `SKILL.md` inside the folder of
 * another listed `SKILL.md`; it loads only through its parent's index, the same rule as the server's `SkillV2.nested`.
 */
export function listedSkills<T extends SkillCatalogEntry>(skills: readonly T[]) {
  const folders = skills
    .map((skill) => slash(skill.location))
    .filter((location) => location.endsWith("/SKILL.md"))
    .map((location) => location.slice(0, -"SKILL.md".length))
  return skills.filter((skill) => {
    if (isInternalSkill(skill)) return false
    const location = slash(skill.location)
    return !folders.some((folder) => location !== `${folder}SKILL.md` && location.startsWith(folder))
  })
}

export type SkillSource = "project" | "global" | "builtin"
/** Mirrors the server's write rule: only the project's own skill folders change, never Atlas-governed skills. */
export type SkillAccess = "edit" | "builtin" | "global" | "governed" | "fixed"

const PROJECT_ROOTS = [".orchestra/skills/", ".orchestra/skill/", ".claude/skills/", ".agents/skills/"]
const GOVERNED_ROOT = ".orchestra/skills/own/"

const SOURCE_ORDER: SkillSource[] = ["project", "global", "builtin"]

export function filterSkills<T extends SkillCatalogEntry>(skills: readonly T[], query: string) {
  const search = query.trim().toLowerCase()
  return skills.filter((skill) =>
    [skill.name, skill.description ?? "", skill.location].some((value) => value.toLowerCase().includes(search)),
  )
}

// A server's built-in skills live under the virtual absolute path /builtin/.
// Orchestra's own server ships none (playbooks are files), but other servers may.
export function skillSource(location: string, directory: string): SkillSource {
  if (location.startsWith("/builtin/")) return "builtin"
  return slash(location).startsWith(root(directory)) ? "project" : "global"
}

export function skillAccess(location: string, directory: string): SkillAccess {
  const source = skillSource(location, directory)
  if (source !== "project") return source
  const relative = slash(location).slice(root(directory).length)
  if (relative.startsWith(GOVERNED_ROOT)) return "governed"
  if (!relative.endsWith(".md") || !PROJECT_ROOTS.some((item) => relative.startsWith(item))) return "fixed"
  return "edit"
}

/** Project skills first, then the user's global skills, then built-ins; names break ties. */
export function sortSkills<T extends SkillCatalogEntry>(skills: readonly T[], directory: string) {
  return skills.toSorted(
    (a, b) =>
      SOURCE_ORDER.indexOf(skillSource(a.location, directory)) -
        SOURCE_ORDER.indexOf(skillSource(b.location, directory)) || a.name.localeCompare(b.name),
  )
}

/** Reads the message from a `{ message }` error body. */
export function skillErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return
  if ("message" in error && typeof error.message === "string") return error.message
}

const slash = (value: string) => value.replaceAll("\\", "/")
const root = (directory: string) => slash(directory).replace(/\/*$/, "/")
