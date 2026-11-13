import type { ImportChange } from "./changes.ts"
import type { ImportDetail } from "./store.ts"

/** Only explicit parser locations are called file provenance; domain-only changes retain the source reference. */
export function plannerImportDetail(input: { manifestId: string; version: number; sourceDigest: string; domainReference: string; changes: readonly ImportChange[]; locations: Readonly<Record<string, WorkbookLocation>>; outcomes?: readonly WorkbookOutcome[] }): ImportDetail {
  return {
    manifestId: input.manifestId,
    version: input.version,
    sourceDigest: input.sourceDigest,
    changes: [...input.changes.map((change) => {
      const location = input.locations[change.path]
      return { ...change, source: location ? { kind: "file" as const, ...location } : { kind: "domain" as const, reference: input.domainReference } }
    }), ...workbookOutcomeDetails(input.outcomes ?? [])],
  }
}

type WorkbookLocation = { sheet: string; row: number; column: number; address: string; field: string }

/** Outcomes are supplied only after the importer/domain classified a physical workbook cell. */
export type WorkbookOutcome =
  | { kind: "unchanged"; source: WorkbookLocation; reason: "domain-no-change" | "domain-retained-value" }
  | { kind: "ignored"; source: WorkbookLocation; reason: "not-consumed-by-import" | "outside-selected-scope" | "protected-field" }

function workbookOutcomeDetails(outcomes: readonly WorkbookOutcome[]) {
  return outcomes.flatMap((outcome) => {
    const source = outcome.source
    if (!source.sheet.trim() || !source.field.trim() || !Number.isSafeInteger(source.row) || source.row < 1 || !Number.isSafeInteger(source.column) || source.column < 1 || source.address !== `${columnName(source.column)}${source.row}` || /salary|compensation|annual cost|rate override|pay rate/i.test(source.field)) return []
    const segment = (value: string) => value.replace(/~/g, "~0").replace(/\//g, "~1")
    return [{
      path: `/workbook/${segment(source.sheet)}/rows/${source.row}/${segment(source.field)}`,
      kind: outcome.kind,
      before: { state: "undefined" as const },
      after: { state: "undefined" as const },
      source: { kind: "file" as const, ...source },
      reason: outcome.reason === "domain-no-change" ? "The domain reported no change." : outcome.reason === "domain-retained-value" ? "The domain retained the existing value." : outcome.reason === "outside-selected-scope" ? "The field is outside the selected import scope." : outcome.reason === "protected-field" ? "The field is protected from import." : "The original importer does not consume this field.",
    }]
  })
}

function columnName(column: number) {
  let value = column
  let name = ""
  while (value > 0) {
    value -= 1
    name = String.fromCharCode(65 + value % 26) + name
    value = Math.floor(value / 26)
  }
  return name
}
