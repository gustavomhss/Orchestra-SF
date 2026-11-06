import { array, check, object } from "./assertions"
import { http } from "./dsl"
import { type Scenario } from "./types"

// Skill catalog and skill file write routes (/api/skill).
const taken = ".orchestra/skills/httpapi-taken/SKILL.md"
const takenText = "---\nname: httpapi-taken\ndescription: Seeded skill\n---\n# Taken\n"
const missing = `?${new URLSearchParams({ path: "/missing/SKILL.md" })}`

function created(name: string) {
  return (value: unknown) => {
    object(value)
    check(value.name === name, "skill save should return the saved skill")
    check(
      String(value.location).endsWith(`/.orchestra/skills/${name}/SKILL.md`),
      "skill save should create a project skill file",
    )
  }
}

function located(validate: (value: unknown) => void) {
  return (body: unknown) => {
    object(body)
    object(body.location)
    validate(body.data)
  }
}

export const skillScenarios: Scenario[] = [
  http.protected.get("/api/skill/catalog", "v2.skill.catalog")
    .seeded((ctx) => ctx.file(taken, takenText))
    .json(200, located((value) => {
      array(value)
      check(value.length > 0, "metadata catalog should include the seeded skill")
      value.forEach((item) => { object(item); check(!Object.hasOwn(item, "content"), "catalog must omit instruction bodies") })
      check(value.some((item) => { object(item); return item.name === "httpapi-taken" }), "seeded skill should be registered")
    })),
  http.protected.get("/api/skill/by-name", "v2.skill.get")
    .seeded((ctx) => ctx.file(taken, takenText))
    .at((ctx) => ({ path: "/api/skill/by-name?name=httpapi-taken", headers: ctx.headers() }))
    .json(200, located((value) => {
      object(value)
      check(value.name === "httpapi-taken" && value.content === "# Taken\n", "exact-name read should include the registered body")
    })),
  http.protected.get("/api/skill/by-name", "v2.skill.get.missing")
    .at((ctx) => ({ path: "/api/skill/by-name?name=missing-skill", headers: ctx.headers() }))
    .json(200, located((value) => check(value === null, "missing registered name should return null"))),
  http.protected.get("/api/skill", "v2.skill.list").json(200, located(array)),
  http.protected
    .put("/api/skill", "v2.skill.save")
    .mutating()
    .at((ctx) => ({
      path: "/api/skill",
      headers: ctx.headers(),
      body: { name: "httpapi-skill-v2", description: "Exercise skill", content: "# Exercise" },
    }))
    .json(200, located(created("httpapi-skill-v2")), "status"),
  http.protected
    .put("/api/skill", "v2.skill.save.conflict")
    .seeded((ctx) => ctx.file(taken, takenText))
    .at((ctx) => ({
      path: "/api/skill",
      headers: ctx.headers(),
      body: { name: "httpapi-taken", description: "Again", content: "" },
    }))
    .json(
      409,
      (body) => {
        object(body)
        check(body._tag === "ConflictError", "V2 skill name conflicts should be typed conflicts")
      },
      "status",
    ),
  http.protected
    .delete("/api/skill", "v2.skill.remove")
    .at((ctx) => ({ path: `/api/skill${missing}`, headers: ctx.headers() }))
    .status(400, undefined, "status"),
]
