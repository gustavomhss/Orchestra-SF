import { describe, expect, test } from "bun:test"
import squawk from "../../src/backend-toolkit/packs/squawk"
import { ReviewCatalog } from "../../src/review/catalog"
import { ReviewRoute } from "../../src/review/route"

// Independent repeat of the pinned rule ids. Do not import the review-toolkit primitive:
// it is not on this branch until the analyzer merge. That cross-check belongs there.

const RULES = [
  "require-concurrent-index-creation", "require-concurrent-index-deletion", "constraint-missing-not-valid",
  "adding-field-with-default", "adding-foreign-key-constraint", "changing-column-type",
  "adding-not-nullable-field", "adding-serial-primary-key-field", "renaming-column", "renaming-table",
  "disallowed-unique-constraint", "ban-drop-database", "prefer-bigint-over-int", "prefer-bigint-over-smallint",
  "prefer-identity", "prefer-repack", "prefer-robust-stmts", "prefer-text-field", "prefer-timestamp-tz",
  "ban-char-field", "ban-drop-column", "ban-drop-table", "ban-drop-not-null", "transaction-nesting",
  "adding-required-field", "ban-concurrent-index-creation-in-transaction", "unused-ignore",
  "ban-create-domain-with-constraint", "ban-alter-domain-with-add-constraint", "ban-truncate-cascade",
  "require-timeout-settings", "ban-uncommitted-transaction", "require-enum-value-ordering",
  "require-table-schema", "identifier-too-long", "require-concurrent-partition-detach",
  "require-concurrent-reindex", "require-lock-timeout", "require-statement-timeout",
  "ban-duplicate-column-assignments", "ban-drop-view", "ban-drop-function", "ban-drop-type",
  "ban-drop-default", "ban-drop-trigger",
] as const

const catalog = ReviewCatalog.current
const settings = { acceptedUnavailable: [] }

describe("squawk catalog", () => {
  test("the pack reuses the backend pin and stays a no-build SQL probation check", () => {
    const pack = catalog.packs.find((entry) => entry.id === "squawk")
    expect(pack).toMatchObject({
      id: "squawk",
      tool: "squawk",
      version: "2.67.0",
      licence: "pinned",
      backend: "pinned",
      languages: ["sql"],
      detection: { manifests: [], extensions: [".sql"], absent: [] },
      lane: "no-build",
      tiers: ["standard", "deep"],
      output: { format: "json", parser: "squawk" },
      cost: "low",
      network: { kind: "none" },
      scratchWrites: false,
      template: "squawk-json",
      lenses: ["contracts"],
      status: "probation",
    })
    expect(pack?.version).toBe(squawk.version)
    expect(pack?.pin).toEqual({
      source: "backend-toolkit/packs/squawk",
      integrity: Object.fromEntries(Object.entries(squawk.targets).map(([target, entry]) => [target, entry.artifact.integrity])),
    })
    expect(pack?.tiers).not.toContain("quick")
  })

  test("sql detection is extension-only and does not name an unsourced team-stack node", () => {
    const language = catalog.languages.find((entry) => entry.id === "sql")
    expect(language?.detection).toEqual({ manifests: [], extensions: [".sql"], absent: [] })
    expect(language?.node).toBe("sql")
    expect(language?.node.startsWith("team-stack")).toBe(false)
  })

  test("all 45 native rules map to contracts.data at P2 probation and name their trigger", () => {
    const rules = catalog.rules.filter((entry) => entry.pack === "squawk")
    expect(rules.map((entry) => entry.rule)).toEqual([...RULES])
    expect(new Set(rules.map((entry) => entry.rule)).size).toBe(45)
    for (const entry of rules) {
      expect(entry).toMatchObject({ pack: "squawk", class: "contracts.data", lens: "contracts", severity: { "*": "P2" }, status: "probation" })
      expect(entry.triage.startsWith(`${entry.rule}:`)).toBe(true)
      expect(entry.triage).toContain("possible migration hazard")
      expect(entry.triage).toContain("structural warning alone does not confirm")
      expect(entry.triage).toContain("deployed project's data or operating constraint")
      expect(entry.triage.length).toBeLessThanOrEqual(240)
    }
    expect(catalog.overlays.find((overlay) => overlay.id === "data-migration")?.checks).toEqual(["squawk"])
  })

  test("a standard .sql change routes sql and squawk; a .ts change does not", () => {
    const sql = route("standard", "src/schema.sql", "select 1;")
    expect(sql.languages).toContainEqual({ id: "sql", source: "path", signal: "src/schema.sql" })
    expect(sql.packs).toContainEqual({ id: "squawk", source: "catalog", lane: "no-build", status: "routed" })
    expect(sql.overlays.find((overlay) => overlay.id === "data-migration")).toBeUndefined()
    const ts = route("standard", "src/app.ts", "const n = 1")
    expect(ts.languages.some((language) => language.id === "sql")).toBe(false)
    expect(ts.packs.some((pack) => pack.id === "squawk")).toBe(false)
  })

  test("a migrations path binds squawk; added-line content does not", () => {
    const bound = route("standard", "db/migrations/001.sql", "select 1;")
    expect(bound.overlays).toContainEqual({ id: "data-migration", source: "path", signal: "db/migrations/001.sql" })
    expect(bound.packs).toContainEqual({ id: "squawk", source: "path", lane: "no-build", status: "routed" })
    const suggested = route("standard", "src/notes.ts", "ALTER TABLE job ADD COLUMN x INTEGER;")
    expect(suggested.overlays.find((overlay) => overlay.id === "data-migration")).toEqual({
      id: "data-migration",
      source: "content",
      signal: "src/notes.ts:1 alter-table",
    })
    expect(suggested.packs.some((pack) => pack.id === "squawk")).toBe(false)
  })

  test("Quick does not run squawk on a plain .sql file, but a path-required migration still routes it", () => {
    const plain = route("quick", "src/schema.sql", "select 1;")
    expect(plain.tier.id).toBe("quick")
    expect(plain.packs.some((pack) => pack.id === "squawk")).toBe(false)
    // routePacks returns a path-required pack before the tier filter. Squawk's tiers are standard/deep.
    // Quick still records it routed. That policy is unchanged here; it needs a lead decision.
    const required = route("quick", "db/migrations/001.sql", "select 1;")
    expect(required.tier.id).toBe("quick")
    expect(required.overlays).toContainEqual({ id: "data-migration", source: "path", signal: "db/migrations/001.sql" })
    expect(required.packs).toContainEqual({ id: "squawk", source: "path", lane: "no-build", status: "routed" })
  })
})

function route(tier: string, file: string, text: string) {
  return ReviewRoute.route(
    { stage: "code", tier, settings },
    { files: [] },
    { files: [file], changes: [{ path: file, added: [{ line: 1, text }], removed: 0 }] },
    catalog,
  )
}
