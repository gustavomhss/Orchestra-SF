import squawk from "../../backend-toolkit/packs/squawk"

// Declarative repeat of the pinned Squawk 2.67.0 rule ids. Do not import the review-toolkit parser:
// that would couple the catalog to the analyzer. The integrated branch cross-checks the primitive.

export const RULES = [
  "require-concurrent-index-creation",
  "require-concurrent-index-deletion",
  "constraint-missing-not-valid",
  "adding-field-with-default",
  "adding-foreign-key-constraint",
  "changing-column-type",
  "adding-not-nullable-field",
  "adding-serial-primary-key-field",
  "renaming-column",
  "renaming-table",
  "disallowed-unique-constraint",
  "ban-drop-database",
  "prefer-bigint-over-int",
  "prefer-bigint-over-smallint",
  "prefer-identity",
  "prefer-repack",
  "prefer-robust-stmts",
  "prefer-text-field",
  "prefer-timestamp-tz",
  "ban-char-field",
  "ban-drop-column",
  "ban-drop-table",
  "ban-drop-not-null",
  "transaction-nesting",
  "adding-required-field",
  "ban-concurrent-index-creation-in-transaction",
  "unused-ignore",
  "ban-create-domain-with-constraint",
  "ban-alter-domain-with-add-constraint",
  "ban-truncate-cascade",
  "require-timeout-settings",
  "ban-uncommitted-transaction",
  "require-enum-value-ordering",
  "require-table-schema",
  "identifier-too-long",
  "require-concurrent-partition-detach",
  "require-concurrent-reindex",
  "require-lock-timeout",
  "require-statement-timeout",
  "ban-duplicate-column-assignments",
  "ban-drop-view",
  "ban-drop-function",
  "ban-drop-type",
  "ban-drop-default",
  "ban-drop-trigger",
] as const

const triage = (rule: string) =>
  `${rule}: possible migration hazard named by this rule. A structural warning alone does not confirm it; require the deployed project's data or operating constraint.`

const rule = (name: (typeof RULES)[number]) => ({
  pack: "squawk" as const,
  rule: name,
  class: "contracts.data" as const,
  lens: "contracts" as const,
  severity: { "*": "P2" as const },
  triage: triage(name),
  status: "probation" as const,
})

export const phase4 = {
  pack: {
    id: "squawk",
    tool: "squawk",
    version: squawk.version,
    pin: {
      source: "backend-toolkit/packs/squawk",
      integrity: Object.fromEntries(Object.entries(squawk.targets).map(([target, entry]) => [target, entry.artifact.integrity])),
    },
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
  },
  rules: RULES.map(rule),
  // Language.node is required. No sourced SQL team-stack skill exists, so this is not team-stack-sql.
  language: {
    id: "sql",
    detection: { manifests: [], extensions: [".sql"], absent: [] },
    node: "sql",
  },
} as const
