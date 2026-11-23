import { describe, expect, test } from "bun:test"
import { sfDecisionCategoryKey, sfDecisionGap, sfDecisionIssueKey } from "./presentation"

describe("decision condition presentation", () => {
  test("labels only exact owned codes and retains their source identity", () => {
    expect(sfDecisionGap("cost-coverage-unresolved-or-source-mismatch")).toEqual({
      code: "cost-coverage-unresolved-or-source-mismatch",
      label: "sf.ui36.issue.coverageUnresolved",
    })
    expect(sfDecisionIssueKey("Cost coverage is incomplete")).toBeUndefined()
    expect(sfDecisionGap("cost-coverage-unresolved-or-source-mismatch:extension")).toEqual({
      code: "cost-coverage-unresolved-or-source-mismatch:extension",
    })
  })

  test("explains the producer's category and coded reason without changing the raw condition", () => {
    expect(sfDecisionGap("coverage:migration:missing-category")).toEqual({
      code: "coverage:migration:missing-category",
      category: "sf.ui36.category.migration",
      reason: "missing-category",
      reasonKey: "sf.ui36.issue.missingCategory",
    })
  })

  test("preserves producer-authored reasons, including their language and separators", () => {
    const reason = "Confirmar custo: migração assistida"
    expect(sfDecisionGap("coverage:migration:" + reason)).toEqual({
      code: "coverage:migration:" + reason,
      category: "sf.ui36.category.migration",
      reason,
      reasonKey: undefined,
    })
    expect(sfDecisionGap(reason)).toEqual({ code: reason })
  })

  test("does not interpret unknown categories or malformed extensions", () => {
    for (const value of ["coverage:custom-category:missing-category", "coverage:migration:",
      "coverage:custom:category:missing-category", "Coverage:migration:missing-category"]) {
      expect(sfDecisionGap(value)).toEqual({ code: value })
    }
    expect(sfDecisionCategoryKey("service_overlap")).toBe("sf.ui36.category.serviceOverlap")
    expect(sfDecisionCategoryKey("custom-category")).toBeUndefined()
  })

  test("does not treat object prototype names as business codes", () => {
    for (const value of ["constructor", "toString", "__proto__"]) {
      expect(sfDecisionCategoryKey(value)).toBeUndefined()
      expect(sfDecisionIssueKey(value)).toBeUndefined()
      expect(sfDecisionGap(value)).toEqual({ code: value })
    }
  })
})
